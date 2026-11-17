"""Checks of the graph export of build_graph.py against the frozen revised stage of the shown run.

Builds the export of pipeline/runs/<SHOWN_RUN> three times into temporary folders: twice with
the same date and the current namespaces, once with the sample namespace
https://regesta.test/factoid/ and https://regesta.test/concept/ (the reserved .test domain,
no real namespace). Each check returns a list of errors, and every test asserts twice: the
real export yields no error, a named mutation yields at least one.

1. Parsing: the TriG and the Turtle union parse.
2. Nothing lost: each regest's named graph, with skolem IRIs turned back into blank nodes,
   @de removed and the namespaces mapped back, is isomorphic to its frozen file, so no
   statement is lost or added there. This holds for the sample namespace too.
3. No blank node remains anywhere in the export.
4. Records: every selected record has rdfs:label, dcterms:identifier and rdfs:seeAlso.
5. Determinism: a second export with the same inputs is byte-identical.
6. Queries: every query of queries/ gives as many rows on the Turtle union as on the merged
   frozen stage.

What these checks establish is a faithful, reusable export, not that a statement is right:
no statement of the run is expert validated (manifest expert_accepted false).

Usage
    uv run pytest -q checks/test_export.py
"""

from __future__ import annotations

import importlib.util
import re
import sys
import tempfile
import unittest
from pathlib import Path
from types import ModuleType

import rdflib
from rdflib import RDFS, BNode, Literal, URIRef
from rdflib.compare import isomorphic

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import build_graph  # noqa: E402
from edition_io import SHOWN_RUN, load_json  # noqa: E402

PIPELINE = ROOT / "pipeline"
RUN_DIR = PIPELINE / "runs" / SHOWN_RUN
TEXTS = ROOT / "edition" / "texts.json"
DATE = "2026-11-17"
SAMPLE = {"rf": "https://regesta.test/factoid/", "rv": "https://regesta.test/concept/"}
DEFAULT = {"rf": build_graph.RF_DEFAULT, "rv": build_graph.RV_DEFAULT}
SKOLEM = re.compile(r".+:(evidence|reference)-\d+")
DCTERMS = rdflib.Namespace("http://purl.org/dc/terms/")


def _module(path: Path) -> ModuleType:
    spec = importlib.util.spec_from_file_location(path.stem, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


run_queries = _module(ROOT / "queries" / "run_queries.py")


def _export(out: Path, date: str = DATE, namespaces: dict = DEFAULT) -> dict:
    build_graph.build(PIPELINE, SHOWN_RUN, out, date, TEXTS, namespaces["rf"], namespaces["rv"])
    return {
        "dir": out,
        "trig": (out / f"{SHOWN_RUN}.trig").read_text(encoding="utf-8"),
        "ttl": (out / f"{SHOWN_RUN}.ttl").read_text(encoding="utf-8"),
        "bytes": {p.name: p.read_bytes() for p in sorted(out.iterdir())},
    }


def _dataset(trig: str) -> rdflib.Dataset:
    dataset = rdflib.Dataset()
    dataset.parse(data=trig, format="trig")
    return dataset


def check_parses(export: dict) -> list[str]:
    errors = []
    for name, fmt in (("trig", "trig"), ("ttl", "turtle")):
        try:
            rdflib.Dataset().parse(data=export[name], format=fmt)
        except Exception as exc:  # rdflib raises parser-specific exception types
            errors.append(f"{name} does not parse: {str(exc)[:120]}")
    return errors


def check_nothing_lost(dataset: rdflib.Dataset, frozen: dict[str, rdflib.Graph], namespaces: dict) -> list[str]:
    back = {namespaces[k]: DEFAULT[k] for k in namespaces}

    def restore(term: rdflib.term.Node, blanks: dict) -> rdflib.term.Node:
        if isinstance(term, Literal) and term.language == "de":
            return Literal(str(term))
        if isinstance(term, URIRef):
            if SKOLEM.fullmatch(term):
                return blanks.setdefault(term, BNode())
            for new, old in back.items():
                if term.startswith(new):
                    return URIRef(old + term[len(new) :])
        return term

    errors = []
    for uid, graph in frozen.items():
        exported, blanks = dataset.graph(build_graph.graph_iri(SHOWN_RUN, uid)), {}
        restored = rdflib.Graph()
        for triple in exported:
            restored.add(tuple(restore(t, blanks) for t in triple))
        if not isomorphic(restored, graph):
            errors.append(f"{uid}: {len(graph)} frozen and {len(restored)} restored statements differ")
    return errors


def check_no_blank_nodes(dataset: rdflib.Dataset) -> list[str]:
    return [f"blank node in {q[3]}: {q[:3]}" for q in dataset.quads() if any(isinstance(t, BNode) for t in q[:3])]


def check_records(union: rdflib.Graph, uids: list[str]) -> list[str]:
    errors = []
    for uid in uids:
        record = URIRef(f"urn:regesta:record:{uid}")
        for predicate in (RDFS.label, DCTERMS.identifier, RDFS.seeAlso):
            if union.value(record, predicate) is None:
                errors.append(f"record {uid} lacks {predicate}")
    return errors


def check_identical(first: dict, second: dict) -> list[str]:
    names = sorted(set(first["bytes"]) | set(second["bytes"]))
    return [f"{n} differs between two exports" for n in names if first["bytes"].get(n) != second["bytes"].get(n)]


def check_queries(union: rdflib.Graph, frozen: dict[str, rdflib.Graph]) -> list[str]:
    merged = run_queries.merge(frozen)
    errors = []
    for name, query in run_queries.queries().items():
        expected, got = len(list(merged.query(query))), len(list(union.query(query)))
        if got != expected or not got:
            errors.append(f"queries/{name}.rq: {got} rows on the export, {expected} on the stage")
    return errors


class GraphExport(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.tmp = tempfile.TemporaryDirectory()
        base = Path(cls.tmp.name)
        cls.first = _export(base / "first")
        cls.second = _export(base / "second")
        cls.sample = _export(base / "sample", namespaces=SAMPLE)
        cls.dataset = _dataset(cls.first["trig"])
        cls.union = rdflib.Graph().parse(data=cls.first["ttl"], format="turtle")
        cls.frozen = run_queries.read_stage(RUN_DIR / "revised")
        cls.uids = [s["uid"] for s in load_json(RUN_DIR / "manifest.json")["selection"]]

    @classmethod
    def tearDownClass(cls) -> None:
        cls.tmp.cleanup()

    def test_export_parses(self) -> None:
        self.assertEqual(check_parses(self.first), [])
        broken = {**self.first, "ttl": self.first["ttl"][: len(self.first["ttl"]) // 2]}
        self.assertTrue(check_parses(broken), "a truncated Turtle file must fail")

    def test_nothing_lost(self) -> None:
        self.assertEqual(len(self.frozen), len(self.uids))
        self.assertEqual(check_nothing_lost(self.dataset, self.frozen, DEFAULT), [])
        mutated = _dataset(self.first["trig"])
        graph = mutated.graph(build_graph.graph_iri(SHOWN_RUN, "22640"))
        graph.remove(next(iter(graph.triples((None, RDFS.label, None)))))
        self.assertTrue(check_nothing_lost(mutated, self.frozen, DEFAULT), "a dropped statement must fail")

    def test_sample_namespace(self) -> None:
        dataset = _dataset(self.sample["trig"])
        self.assertEqual(check_nothing_lost(dataset, self.frozen, SAMPLE), [])
        old = [t for q in dataset.quads() for t in q[:3] if str(t).startswith(tuple(DEFAULT.values()))]
        self.assertEqual(old, [], "no IRI of the provisional namespaces may remain")
        self.assertIn(f"@prefix rf: <{SAMPLE['rf']}> .", self.sample["ttl"])
        self.assertTrue(check_nothing_lost(dataset, self.frozen, DEFAULT), "unmapped namespaces must fail")

    def test_no_blank_nodes(self) -> None:
        self.assertEqual(check_no_blank_nodes(self.dataset), [])
        mutated = _dataset(self.first["trig"])
        mutated.add((BNode(), RDFS.label, Literal("x"), mutated.default_context))
        self.assertTrue(check_no_blank_nodes(mutated), "a blank node must fail")

    def test_records_have_label_identifier_link(self) -> None:
        self.assertEqual(check_records(self.union, self.uids), [])
        mutated = rdflib.Graph()
        mutated += self.union
        mutated.remove((URIRef("urn:regesta:record:22640"), RDFS.seeAlso, None))
        self.assertTrue(check_records(mutated, self.uids), "a record without persistent link must fail")

    def test_byte_identical_on_second_run(self) -> None:
        self.assertEqual(check_identical(self.first, self.second), [])
        with tempfile.TemporaryDirectory() as tmp:
            other = _export(Path(tmp), date="2026-11-18")
        self.assertTrue(check_identical(self.first, other), "another export date must change the bytes")

    def test_queries_answer_on_the_export(self) -> None:
        self.assertEqual(check_queries(self.union, self.frozen), [])
        sample_union = rdflib.Graph().parse(data=self.sample["ttl"], format="turtle")
        self.assertTrue(check_queries(sample_union, self.frozen), "queries name the provisional namespaces")


if __name__ == "__main__":
    unittest.main()
