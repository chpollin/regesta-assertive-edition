"""Checks of build_register_graph.py against the full RI IV,2 delivery and the frozen runs.

Builds the export once into a temporary folder and reads the written TriG back, so every check
judges the files, not the graphs in memory. Each check returns a list of errors, and every
test asserts twice: the real export yields no error, a deliberately broken input yields at
least one.

1. Counts: as many records as regest rows and as many register rows as register CSV rows.
2. Rows: every register row's entry, regest, roles and comment equal the CSV, one by one for
   regest 2077 and as a multiset over all 37766 rows; role and comment triples equal the CSV
   by count.
3. Known cases: 2077 has exactly one zeuge row (Werner von Bolanden); Kaiserslautern K000015
   has no coordinate and an ImplausibleCoordinate finding; Beatrix B000330 is petent in 2077
   with the comment Vermittlung; 3166a has no urn and a LateAdditionWithoutUrn finding; the
   duplicated identifier 1520a and the six duplicated register rows carry findings; the LLM
   graph of 3166a holds only unchecked statements.
4. JSON-LD: the files parse with rdflib and state no triple the TriG lacks; each LLM graph
   object equals its TriG graph; keys declared @set are arrays. By default this runs on a
   sample (the known cases and every 100th file). The full round trip, the union of all
   files equal to the TriG graphs, and the determinism of two runs under different hash seeds
   take a few minutes and run with
       REGISTER_GRAPH_FULL=1 uv run pytest -q checks/test_register_graph.py

What these checks establish is a faithful export of the delivery and the runs, not that a
register entry or an LLM statement is right.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from collections import Counter
from pathlib import Path

import rdflib
from rdflib import RDF, URIRef
from rdflib.graph import DATASET_DEFAULT_GRAPH_ID

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import build_register_graph as brg  # noqa: E402
from edition_io import REGESTA_CSV, REGISTER_CSV, is_null, load_json, plain_text, read_csv  # noqa: E402

PIPELINE = ROOT / "pipeline"
SCRIPT = ROOT / "build_register_graph.py"
DATE = "2026-11-20"
FULL = os.environ.get("REGISTER_GRAPH_FULL") == "1"
RR, DCTERMS, GEO = brg.RR, brg.DCTERMS, brg.GEO
REC_2077, REC_3166A = URIRef("urn:regesta:record:24711"), URIRef("urn:regesta:record:220540")
SAMPLE_RECORDS = ("24711", "220540", "134544", "134545")
SAMPLE_ENTRIES = (
    "RI004-002-B000330",
    "RI004-002-K000015",
    "RI004-002-W000334",
    "RI004-002-B000329",
    "RI004-002-F000471",
)


def _layers(dataset: rdflib.Dataset) -> dict[str, rdflib.Graph]:
    return {name: dataset.graph(brg.GRAPH[name]) for name in brg.LAYERS}


def check_counts(layers: dict[str, rdflib.Graph], regests: list[dict], register: list[dict]) -> list[str]:
    records = set(layers["records"].subjects(RDF.type, brg.CRM.E31_Document))
    rows = set(layers["register"].subjects(RDF.type, RR.RegisterRow))
    errors = []
    if len(records) != len(regests):
        errors.append(f"{len(records)} records in the TriG, {len(regests)} regest rows in the CSV")
    if len(rows) != len(register):
        errors.append(f"{len(rows)} register rows in the TriG, {len(register)} in the CSV")
    return errors


def _csv_row(row: dict) -> tuple:
    roles = tuple(sorted(t for t in row["role"].split() if not is_null(t)))
    comment = None if is_null(row["comment"]) else plain_text(row["comment"]) or None
    return (row["id"], row["regestaIdentifier"], roles, comment)


def _graph_row(layers: dict[str, rdflib.Graph], row: URIRef) -> tuple:
    reg, records = layers["register"], layers["records"]
    entry_id = str(reg.value(reg.value(row, RR.entry), DCTERMS.identifier))
    identifiers = {str(records.value(r, DCTERMS.identifier)) for r in reg.objects(row, RR.record)}
    roles = tuple(sorted(str(r).removeprefix(str(brg.RROLE)) for r in reg.objects(row, RR.role)))
    comment = reg.value(row, RR.comment)
    return (
        entry_id,
        identifiers.pop() if len(identifiers) == 1 else sorted(identifiers),
        roles,
        comment and str(comment),
    )


def check_rows_sample(layers: dict[str, rdflib.Graph], register: list[dict], identifier: str, uid: str) -> list[str]:
    """Each CSV row of one regest against its row node, found by IRI."""
    errors = []
    rows = [r for r in register if r["regestaIdentifier"] == identifier]
    for row in rows:
        node = URIRef(f"urn:regesta:mention:{row['id']}:{uid}")
        if _graph_row(layers, node) != _csv_row(row):
            errors.append(f"{node}: {_graph_row(layers, node)} != {_csv_row(row)}")
    in_graph = set(layers["register"].subjects(RR.record, URIRef(f"urn:regesta:record:{uid}")))
    if len(in_graph) != len(rows) or not rows:
        errors.append(f"{identifier}: {len(in_graph)} row nodes, {len(rows)} CSV rows")
    return errors


def check_rows_total(layers: dict[str, rdflib.Graph], register: list[dict]) -> list[str]:
    reg = layers["register"]
    graph = Counter(_graph_row(layers, row) for row in reg.subjects(RDF.type, RR.RegisterRow))
    csv = Counter(_csv_row(row) for row in register)
    errors = [f"only in the TriG: {k} x{n}" for k, n in (graph - csv).items()][:5]
    errors += [f"only in the CSV: {k} x{n}" for k, n in (csv - graph).items()][:5]
    roles = sum(len(_csv_row(r)[2]) for r in register)
    comments = sum(_csv_row(r)[3] is not None for r in register)
    if len(set(reg.triples((None, RR.role, None)))) != roles:
        errors.append(f"{len(set(reg.triples((None, RR.role, None))))} role triples, {roles} role tokens in the CSV")
    if len(set(reg.triples((None, RR.comment, None)))) != comments:
        errors.append(f"{len(set(reg.triples((None, RR.comment, None))))} comment triples, {comments} in the CSV")
    return errors


def _finding_types(findings: rdflib.Graph, target: URIRef) -> set[str]:
    return {
        str(findings.value(f, RR.findingType)).removeprefix(str(RR)) for f in findings.subjects(RR.concerns, target)
    }


def check_known_cases(layers: dict[str, rdflib.Graph], dataset: rdflib.Dataset) -> list[str]:
    reg, records, findings = layers["register"], layers["records"], layers["findings"]
    errors = []
    witnesses = [r for r in reg.subjects(RR.record, REC_2077) if (r, RR.role, brg.RROLE.zeuge) in reg]
    entries = [str(reg.value(r, RR.entry)) for r in witnesses]
    if entries != ["urn:regesta:actor:RI004-002-W000334"]:
        errors.append(f"2077 zeuge rows: {entries}")
    place = URIRef("urn:regesta:place:RI004-002-K000015")
    if reg.value(place, GEO.lat) is not None or reg.value(place, GEO.long) is not None:
        errors.append("K000015 has a coordinate")
    if "ImplausibleCoordinate" not in _finding_types(findings, place):
        errors.append("K000015 has no ImplausibleCoordinate finding")
    beatrix = URIRef("urn:regesta:mention:RI004-002-B000330:24711")
    if set(reg.objects(beatrix, RR.role)) != {brg.RROLE.petent} or str(reg.value(beatrix, RR.comment)) != "Vermittlung":
        errors.append("B000330 in 2077 is not petent with comment Vermittlung")
    if records.value(REC_3166A, RR.urn) is not None or "LateAdditionWithoutUrn" not in _finding_types(
        findings, REC_3166A
    ):
        errors.append("3166a has a urn or lacks its LateAdditionWithoutUrn finding")
    for uid in ("134544", "134545"):
        if "DuplicateIdentifier" not in _finding_types(findings, URIRef(f"urn:regesta:record:{uid}")):
            errors.append(f"1520a record {uid} lacks its DuplicateIdentifier finding")
    duplicates = set(findings.subjects(RR.findingType, RR.DuplicateRegisterRow))
    if len(duplicates) != 6:
        errors.append(f"{len(duplicates)} DuplicateRegisterRow findings, 6 expected")
    llm = dataset.graph(URIRef("urn:regesta:run:factoid-2026-11-11:revised:220540"))
    statuses = set(llm.objects(None, brg.RF.verificationStatus))
    if not len(llm) or statuses != {brg.RV.unchecked}:
        errors.append(f"LLM graph of 3166a: {len(llm)} triples, statuses {statuses}")
    return errors


def _files(out: Path, full: bool) -> list[Path]:
    if full:
        return (
            sorted(out.glob("*.jsonld"))
            + sorted((out / "record").glob("*.jsonld"))
            + sorted((out / "entry").glob("*.jsonld"))
        )
    every = sorted((out / "record").glob("*.jsonld"))[::100] + sorted((out / "entry").glob("*.jsonld"))[::100]
    named = [out / "record" / f"{u}.jsonld" for u in SAMPLE_RECORDS] + [
        out / "entry" / f"{e}.jsonld" for e in SAMPLE_ENTRIES
    ]
    return sorted(set(every + named + [out / "roles.jsonld"]))


def _array_errors(value: object, sets: set[str], where: str) -> list[str]:
    if isinstance(value, list):
        return [e for item in value for e in _array_errors(item, sets, where)]
    if not isinstance(value, dict):
        return []
    errors = [f"{where}: key {k} is no array" for k in value if k in sets and not isinstance(value[k], list)]
    return errors + [e for k, v in value.items() if k != "@context" for e in _array_errors(v, sets, where)]


def check_jsonld(files: list[Path], dataset: rdflib.Dataset, full: bool) -> list[str]:
    """Parsed JSON-LD against the TriG: no extra triple anywhere, LLM graphs equal, and with
    full=True the union of the default graphs equal to the union of the deterministic layers."""
    sets = brg.Writer({}).sets
    parsed = rdflib.Dataset()
    errors = []
    for path in files:
        errors += _array_errors(json.loads(path.read_text(encoding="utf-8")), sets, path.name)
        try:
            parsed.parse(path, format="json-ld")
        except Exception as exc:  # rdflib raises parser-specific exception types
            errors.append(f"{path.name} does not parse: {str(exc)[:120]}")
    expected = set()
    for name in brg.LAYERS:
        expected |= set(dataset.graph(brg.GRAPH[name]))
    got = set(parsed.graph(DATASET_DEFAULT_GRAPH_ID))
    errors += [f"triple not in the TriG: {t}" for t in sorted(got - expected)[:5]]
    if full:
        errors += [f"triple of the TriG in no JSON-LD file: {t}" for t in sorted(expected - got)[:5]]
    trig_names = {c.identifier for c in dataset.contexts() if str(c.identifier).startswith("urn:regesta:run:")}
    json_names = {c.identifier for c in parsed.contexts() if c.identifier != DATASET_DEFAULT_GRAPH_ID and len(c)}
    for name in sorted(json_names):
        if set(parsed.graph(name)) != set(dataset.graph(name)):
            errors.append(f"graph {name} differs from the TriG")
    if full and json_names != trig_names:
        errors.append(f"LLM graphs only in one side: {sorted(json_names ^ trig_names)[:5]}")
    if not json_names:
        errors.append("no LLM graph in the JSON-LD files")
    return errors


def _run_script(out: Path, seed: str) -> dict[str, bytes]:
    env = {**os.environ, "PYTHONHASHSEED": seed, "PYTHONUTF8": "1"}
    args = [sys.executable, str(SCRIPT), "--out", str(out), "--date", DATE]
    subprocess.run(args, cwd=ROOT, env=env, check=True, capture_output=True)
    return {str(p.relative_to(out)): p.read_bytes() for p in sorted(out.rglob("*")) if p.is_file()}


class RegisterGraph(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.tmp = tempfile.TemporaryDirectory()
        cls.out = Path(cls.tmp.name) / "data"
        graphs, facts = brg.build_graphs(PIPELINE, load_json(ROOT / "edition" / "texts.json"), DATE, SCRIPT)
        brg.write(cls.out, graphs, facts, DATE)
        cls.dataset = rdflib.Dataset()
        cls.dataset.parse(cls.out / brg.TRIG_NAME, format="trig")
        cls.layers = _layers(cls.dataset)
        cls.regests = read_csv(PIPELINE / REGESTA_CSV)
        cls.register = read_csv(PIPELINE / REGISTER_CSV)

    @classmethod
    def tearDownClass(cls) -> None:
        cls.tmp.cleanup()

    def test_counts_equal_the_csv(self) -> None:
        self.assertEqual(check_counts(self.layers, self.regests, self.register), [])
        self.assertTrue(check_counts(self.layers, self.regests, self.register[1:]), "a dropped CSV row must fail")

    def test_rows_of_2077_one_by_one(self) -> None:
        self.assertEqual(check_rows_sample(self.layers, self.register, "RI IV,2,3 n. 2077", "24711"), [])
        broken = [dict(r, comment="null") if r["id"] == "RI004-002-B000330" else r for r in self.register]
        self.assertTrue(
            check_rows_sample(self.layers, broken, "RI IV,2,3 n. 2077", "24711"), "a lost comment must fail"
        )

    def test_all_rows_equal_the_csv(self) -> None:
        self.assertEqual(check_rows_total(self.layers, self.register), [])
        broken = list(self.register)
        broken[0] = dict(broken[0], role=broken[0]["role"] + " zeuge")
        self.assertTrue(check_rows_total(self.layers, broken), "an added role token must fail")

    def test_known_cases(self) -> None:
        self.assertEqual(check_known_cases(self.layers, self.dataset), [])
        reg = self.layers["register"]
        triple = (URIRef("urn:regesta:mention:RI004-002-B000330:24711"), RR.comment, None)
        removed = list(reg.triples(triple))
        reg.remove(triple)
        try:
            self.assertTrue(check_known_cases(self.layers, self.dataset), "a lost Vermittlung comment must fail")
        finally:
            for t in removed:
                reg.add(t)

    def test_jsonld_matches_the_trig(self) -> None:
        self.assertEqual(check_jsonld(_files(self.out, FULL), self.dataset, FULL), [])
        with tempfile.TemporaryDirectory() as tmp:
            broken = Path(tmp)
            (broken / "record").mkdir()
            shutil.copy(self.out / "context.jsonld", broken / "context.jsonld")
            doc = json.loads((self.out / "record" / "24711.jsonld").read_text(encoding="utf-8"))
            for row in doc["rows"]:
                if row["roles"] == ["petent"]:
                    row["roles"] = "zeuge"
            path = broken / "record" / "24711.jsonld"
            path.write_text(json.dumps(doc, ensure_ascii=False), encoding="utf-8")
            errors = check_jsonld([path], self.dataset, False)
        self.assertTrue(any("not in the TriG" in e for e in errors), "a changed role must fail")
        self.assertTrue(any("no array" in e for e in errors), "a scalar under a @set key must fail")

    @unittest.skipUnless(FULL, "full run: REGISTER_GRAPH_FULL=1")
    def test_deterministic_under_hash_seeds(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            first = _run_script(Path(tmp) / "a", "1")
            second = _run_script(Path(tmp) / "b", "2")
        differ = sorted(n for n in set(first) | set(second) if first.get(n) != second.get(n))
        self.assertEqual(differ[:5], [])
        self.assertIn("report.json", first)


if __name__ == "__main__":
    unittest.main()
