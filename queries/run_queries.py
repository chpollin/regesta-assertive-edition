"""Load one stage of a factoid run into a single in-memory graph and run the queries of queries/.

Script of the edition's script pipeline (pyproject.toml), run with `uv run run.py graph`. It
imports the shown run id from edition_io.py in the repository root. checks/test_graph.py
imports read_stage and merge, so the checks query the same graph this script prints from;
checks/test_export.py runs the same queries on the export of build_graph.py.

Data flow: pipeline/runs/<run>/<stage>/*.ttl -> one rdflib graph per file -> one Dataset in
which each file is a named graph and the default graph is the union of all files -> every
queries/*.rq in name order -> row count and the first rows on stdout.

The per-regest files are merged in memory only. Because actor IRIs are minted from the
register ID, the same register entry becomes one node across regesta; no triple store and
no merged graph file are produced. The named graphs keep the file each triple came from,
so a check can ask whether a factoid's source is declared in its own file.

With --file the queries run on one RDF file instead, such as the Turtle union written by
build_graph.py (`uv run run.py graph --export`). The queries name the provisional
example.org namespaces, so they answer on an export only while it keeps them.

Usage
    uv run queries/run_queries.py [--run <run>] [--stage revised] [--limit 10]
    uv run queries/run_queries.py --file data/graph/<run>.ttl
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from rdflib import Dataset, Graph, Literal, URIRef
from rdflib.term import Node

HERE = Path(__file__).resolve().parent
RUNS = HERE.parent / "pipeline" / "runs"
# The shared constants live in the repository root, one level up from this folder.
sys.path.insert(0, str(HERE.parent))

from edition_io import SHOWN_RUN  # noqa: E402


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
    parser.add_argument("--run", default=SHOWN_RUN)
    parser.add_argument("--stage", default="revised")
    parser.add_argument("--file", type=Path, help="one RDF file to query instead of a run stage")
    parser.add_argument("--limit", type=int, default=10, help="rows printed per query")
    args = parser.parse_args()
    if args.file is not None:
        if not args.file.is_file():
            print(f"[FAIL] No file {args.file}; run `uv run run.py export` first.", file=sys.stderr)
            return 1
        dataset = Dataset(default_union=True)
        dataset.graph(URIRef(args.file.resolve().as_uri())).parse(args.file)
        source = args.file.name
    else:
        stage_dir = RUNS / args.run / args.stage
        if not stage_dir.is_dir():
            print(f"[FAIL] No stage folder {stage_dir}; run the pipeline steps first.", file=sys.stderr)
            return 1
        try:
            dataset = merge(read_stage(stage_dir))
        except ValueError as exc:
            print(f"[FAIL] {exc}", file=sys.stderr)
            return 1
        source = f"{args.run}/{args.stage}"
    print(f"{source}: {len(dataset)} triples in one graph")
    for name, text in queries().items():
        question = next((line.lstrip("# ") for line in text.splitlines() if line.startswith("#")), "")
        rows = list(dataset.query(text))
        print(f"\n{name}.rq  {question}\n  {len(rows)} rows")
        for row in rows[: args.limit]:
            print("  " + "  |  ".join(_cell(dataset, term) for term in row))
    return 0


if __name__ == "__main__":
    sys.exit(main())
