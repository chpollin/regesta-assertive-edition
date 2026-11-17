"""Graph checks of the factoid run: the revised Turtle files as one knowledge graph.

Runs against the revised stage of pipeline/runs/factoid-1153-2026-11-11 and the supplied
Regesta Imperii CSV. The files are merged in memory by queries/run_queries.py, the same
loader `uv run run.py graph` uses: each file is a named graph, the default graph is their
union. Each check returns a list of errors, so every test asserts twice: the real data
yield no error, and a named mutation of the real data yields at least one.

What these checks establish is that the graph is complete and holds together, not that a
statement is right: no statement of the run is expert validated (manifest expert_accepted
false).

1. CSV slice: the regesta of the CSV with start_date on or before 1153-12-31, read with the
   pipeline's dialect and selected by select_slice.py's own rule, equal in number and UID
   the crm:E31_Document record nodes of the merged graph.
2. Factoids: every rf:ActFactoid and rf:StateFactoid has a source declared as record in its
   own file, a verbatim-quote selector, a producer and a verification status.
3. Actors: every node a file declares is reached by a factoid, and every actor a reference
   names is declared in the same file.
4. Abstentions: every file declares exactly its own record, also when it holds no factoid.
5. Queries: every query of queries/ answers something on the merged graph.

Usage
    uv run pytest -q checks/test_graph.py
"""

from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path
from types import ModuleType

import rdflib
from rdflib.namespace import RDF

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from edition_io import read_csv  # noqa: E402

PIPELINE = ROOT / "pipeline"
RUN_DIR = PIPELINE / "runs" / "factoid-1153-2026-11-11"
STAGE = RUN_DIR / "revised"
REGESTS_CSV = PIPELINE / "source-material" / "RI_004-002-ReggBarbarossa.csv"
CUTOFF = "1153-12-31"
RECORD = "urn:regesta:record:"

# Namespaces as the run's Turtle files declare them.
RF = rdflib.Namespace("https://example.org/regesta/factoid/")
CRM = rdflib.Namespace("http://www.cidoc-crm.org/cidoc-crm/")
PREFIXES = {
    "rf": RF,
    "rv": rdflib.Namespace("https://example.org/regesta/concept/"),
    "crm": CRM,
    "oa": rdflib.Namespace("http://www.w3.org/ns/oa#"),
    "prov": rdflib.Namespace("http://www.w3.org/ns/prov#"),
}


def _module(path: Path) -> ModuleType:
    spec = importlib.util.spec_from_file_location(path.stem, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


select_slice = _module(PIPELINE / "select_slice.py")
run_queries = _module(ROOT / "queries" / "run_queries.py")


def csv_slice() -> list[str]:
    """UIDs of the edition slice, read from the CSV as the pipeline reads it."""
    rows = read_csv(REGESTS_CSV)
    # The slice rule is select_slice.py's own, not a second implementation of it.
    chosen = select_slice.select(rows, reused={}, cutoff=CUTOFF, batch_size=4)
    return [entry["uid"] for entry in chosen]


def load_world() -> dict:
    return {"slice": csv_slice(), "files": run_queries.read_stage(STAGE)}


def _rows(w: dict, query: str) -> list:
    return list(run_queries.merge(w["files"]).query(query, initNs=PREFIXES))


def _uid(file: rdflib.URIRef) -> str:
    return str(file).removeprefix("urn:file:").removesuffix(".ttl")


RECORDS = "SELECT ?record WHERE { ?record a crm:E31_Document }"


def check_csv_slice(w: dict) -> list[str]:
    in_csv = w["slice"]
    in_graph = [str(row.record).removeprefix(RECORD) for row in _rows(w, RECORDS)]
    errors = [f"CSV slice repeats a UID: {u}" for u in sorted({u for u in in_csv if in_csv.count(u) > 1})]
    if len(in_csv) != len(in_graph):
        errors.append(f"{len(in_csv)} regesta in the CSV slice, {len(in_graph)} record nodes in the graph")
    errors += [f"CSV regest {u} has no record node" for u in sorted(set(in_csv) - set(in_graph))]
    errors += [f"record node {u} is not in the CSV slice" for u in sorted(set(in_graph) - set(in_csv))]
    return errors


INCOMPLETE_FACTOIDS = """
SELECT ?file ?factoid ?source ?evidence ?producer ?status WHERE {
  GRAPH ?file {
    VALUES ?class { rf:ActFactoid rf:StateFactoid }
    ?factoid a ?class .
    BIND (EXISTS { ?factoid rf:source ?record . ?record a crm:E31_Document } AS ?source)
    BIND (EXISTS { ?factoid rf:evidence ?quote . ?quote a oa:TextQuoteSelector ; oa:exact ?text } AS ?evidence)
    BIND (EXISTS { ?factoid prov:wasAttributedTo ?producerNode } AS ?producer)
    BIND (EXISTS { ?factoid rf:verificationStatus ?statusNode } AS ?status)
    FILTER (!(?source && ?evidence && ?producer && ?status))
  }
}
"""


def check_factoids(w: dict) -> list[str]:
    errors = []
    for row in _rows(w, INCOMPLETE_FACTOIDS):
        missing = [k for k in ("source", "evidence", "producer", "status") if not row[k].toPython()]
        errors.append(f"{_uid(row.file)}: {row.factoid} lacks {', '.join(missing)}")
    return errors


# A declared node no factoid reaches: actors are reached through a reference or, for a
# community a right concerns, through rf:concerns (contract annotation guidelines).
UNREACHED = """
SELECT DISTINCT ?file ?node WHERE {
  GRAPH ?file {
    ?node a ?class .
    FILTER (?class NOT IN (crm:E31_Document, rf:ActFactoid, rf:StateFactoid))
    FILTER NOT EXISTS { ?reference a rf:Reference ; rf:actor ?node }
    FILTER NOT EXISTS { ?factoid rf:concerns|rf:reference|rf:evidence ?node }
  }
}
"""

UNDECLARED = """
SELECT DISTINCT ?file ?actor WHERE {
  GRAPH ?file {
    ?reference a rf:Reference ; rf:actor ?actor .
    FILTER NOT EXISTS { ?actor a ?class }
  }
}
"""


def check_actors(w: dict) -> list[str]:
    errors = [f"{_uid(r.file)}: {r.node} is declared but no factoid reaches it" for r in _rows(w, UNREACHED)]
    errors += [f"{_uid(r.file)}: {r.actor} is referenced but not declared" for r in _rows(w, UNDECLARED)]
    return errors


def check_abstentions(w: dict) -> list[str]:
    errors = []
    for uid, graph in w["files"].items():
        records = {str(r) for r in graph.subjects(RDF.type, CRM.E31_Document)}
        if records != {RECORD + uid}:
            errors.append(f"{uid}: declares records {sorted(records)}, expected only {RECORD}{uid}")
    return errors


def abstentions(w: dict) -> list[str]:
    factoids = (RF.ActFactoid, RF.StateFactoid)
    return [uid for uid, g in w["files"].items() if not any(next(g.subjects(RDF.type, c), None) for c in factoids)]


def check_queries(w: dict) -> list[str]:
    dataset = run_queries.merge(w["files"])
    answers = {name: list(dataset.query(q)) for name, q in run_queries.queries().items()}
    return [f"queries/{name}.rq answers nothing" for name, rows in answers.items() if not rows]


class GraphChecks(unittest.TestCase):
    world: dict

    @classmethod
    def setUpClass(cls) -> None:
        cls.world = load_world()

    def _mutated(self, uid: str) -> tuple[dict, rdflib.Graph]:
        """A copy of the world in which the file of one regest can be changed."""
        graph = rdflib.Graph()
        graph += self.world["files"][uid]
        return {**self.world, "files": {**self.world["files"], uid: graph}}, graph

    def _record(self, uid: str) -> rdflib.URIRef:
        return rdflib.URIRef(RECORD + uid)

    def test_csv_slice_equals_record_nodes(self) -> None:
        self.assertEqual(check_csv_slice(self.world), [])
        self.assertEqual(len(self.world["slice"]), 224)
        w, graph = self._mutated("22640")
        graph.remove((self._record("22640"), RDF.type, CRM.E31_Document))
        self.assertTrue(check_csv_slice(w), "a record node missing for a CSV regest must fail")

    def test_factoids_carry_source_evidence_producer_status(self) -> None:
        self.assertEqual(check_factoids(self.world), [])
        w, graph = self._mutated("22640")
        graph.remove((None, PREFIXES["prov"].wasAttributedTo, None))
        self.assertTrue(check_factoids(w), "a factoid without producer must fail")
        w, graph = self._mutated("22640")
        for factoid in set(graph.subjects(RF.source, self._record("22640"))):
            graph.set((factoid, RF.source, self._record("22696")))
        self.assertTrue(check_factoids(w), "a source declared only in another file must fail")

    def test_no_orphan_or_undeclared_actors(self) -> None:
        self.assertEqual(check_actors(self.world), [])
        community = rdflib.URIRef("urn:regesta:actor:RI004-002-L000660:community")
        w, graph = self._mutated("22640")
        graph.remove((None, RF.concerns, community))
        self.assertTrue(check_actors(w), "a declared community no factoid concerns must fail")
        ruler = rdflib.URIRef("urn:regesta:actor:RI004-002-F000471")
        w, graph = self._mutated("22640")
        graph.remove((ruler, RDF.type, None))
        self.assertTrue(check_actors(w), "a referenced actor without declaration must fail")

    def test_abstentions_declare_their_record(self) -> None:
        self.assertEqual(check_abstentions(self.world), [])
        empty = abstentions(self.world)
        self.assertTrue(empty, "the run has abstentions, so this check is not vacuous")
        w, graph = self._mutated(empty[0])
        graph.remove((None, None, None))
        self.assertTrue(check_abstentions(w), "an abstention without its record must fail")

    def test_queries_answer_on_the_merged_graph(self) -> None:
        self.assertTrue(run_queries.queries(), "queries/ holds no .rq file")
        self.assertEqual(check_queries(self.world), [])
        self.assertTrue(check_queries({**self.world, "files": {}}), "an empty stage must leave queries unanswered")


if __name__ == "__main__":
    unittest.main()
