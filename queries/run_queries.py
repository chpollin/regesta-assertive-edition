# /// script
# requires-python = ">=3.11"
# dependencies = ["rdflib==7.6.0"]
# ///
"""Load one stage of a factoid run into a single in-memory graph and run the queries of queries/.

Single-file script regime with inline dependencies, run with uv (`uv run run.py graph`).
checks/test_graph.py imports read_stage and merge, so the checks query the same graph this
script prints from.

Data flow: pipeline/runs/<run>/<stage>/*.ttl -> one rdflib graph per file -> one Dataset in
which each file is a named graph and the default graph is the union of all files -> every
queries/*.rq in name order -> row count and the first rows on stdout.

The per-regest files are merged in memory only. Because actor IRIs are minted from the
register ID, the same register entry becomes one node across regesta; no triple store and
no merged graph file are produced. The named graphs keep the file each triple came from,
so a check can ask whether a factoid's source is declared in its own file.

Usage
    uv run queries/run_queries.py [--run factoid-1153-2026-11-11] [--stage revised] [--limit 10]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from rdflib import Dataset, Graph, Literal, URIRef
from rdflib.term import Node

HERE = Path(__file__).resolve().parent
RUNS = HERE.parent / "pipeline" / "runs"
RUN = "factoid-1153-2026-11-11"


def read_stage(stage_dir: Path) -> dict[str, Graph]:
    """One graph per Turtle file, keyed by the UID its file name carries."""
    files = {}
    for path in sorted(stage_dir.glob("*.ttl")):
        try:
            files[path.stem] = Graph().parse(path, format="turtle")
        except Exception as exc:  # rdflib raises parser-specific exception types
            raise ValueError(f"{path} does not parse as Turtle: {exc}") from exc
    return files


def file_graph(uid: str) -> URIRef:
    """Name of the named graph that holds the file of one regest."""
    return URIRef(f"urn:file:{uid}.ttl")


def merge(files: dict[str, Graph]) -> Dataset:
    """All files in one dataset: each file a named graph, the default graph their union."""
    dataset = Dataset(default_union=True)
    for uid, graph in files.items():
        named = dataset.graph(file_graph(uid))
        named += graph
        for prefix, namespace in graph.namespaces():
            dataset.bind(prefix, namespace, override=False)
    return dataset


def queries() -> dict[str, str]:
    return {p.stem: p.read_text(encoding="utf-8") for p in sorted(HERE.glob("*.rq"))}


def _cell(dataset: Dataset, term: Node | None) -> str:
    if term is None:
        return "-"
    if isinstance(term, Literal):
        text = " ".join(str(term).split())
        return text if len(text) <= 70 else text[:67] + "..."
    return term.n3(dataset.namespace_manager)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--run", default=RUN)
    parser.add_argument("--stage", default="revised")
    parser.add_argument("--limit", type=int, default=10, help="rows printed per query")
    args = parser.parse_args()
    stage_dir = RUNS / args.run / args.stage
    if not stage_dir.is_dir():
        print(f"[FAIL] No stage folder {stage_dir}; run the pipeline steps first.", file=sys.stderr)
        return 1
    try:
        dataset = merge(read_stage(stage_dir))
    except ValueError as exc:
        print(f"[FAIL] {exc}", file=sys.stderr)
        return 1
    print(f"{args.run}/{args.stage}: {len(dataset)} triples in one graph")
    for name, text in queries().items():
        question = next((line.lstrip("# ") for line in text.splitlines() if line.startswith("#")), "")
        rows = list(dataset.query(text))
        print(f"\n{name}.rq  {question}\n  {len(rows)} rows")
        for row in rows[: args.limit]:
            print("  " + "  |  ".join(_cell(dataset, term) for term in row))
    return 0


if __name__ == "__main__":
    sys.exit(main())
