# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""One entry point for the RDF workflow of the edition, step by step.

The workflow runs in eight steps. Five are scripts and run here; three are agent tasks that
are dispatched from the conversation and leave their results in the run folder. This file
holds no logic of its own: each command calls the existing script with the paths of the
current run, so what is shown in teaching is exactly what runs.

    1 select    pipeline/select_slice.py      selection.json
    2 prepare   pipeline/prepare_pilot.py     packets/, manifest.json
    3 contract  pipeline/contracts/<id>/      frozen by hash in the manifest (no command)
    4 extract   agent task                    extracted/*.ttl
    5 validate  pipeline/validate_factoid.py  validation/<stage>.json
    6 review    agent task                    review/review-*.json, adjudication-*.json
                pipeline/summarize_review.py  review-overview.md, derived from the adjudications
    7 correct   agent task                    revised/*.ttl, then validate again
    8 build     build_data.py, build_tei.py   data/edition.json, site/tei/
      check     the transfer and graph checks of checks/ and ruff
      graph     queries/run_queries.py        the revised Turtle as one graph in memory, queries/*.rq

Python never calls an LLM. Steps 1 and 2 refuse an existing output folder, so they only
start a new run; the frozen run factoid-1153-2026-11-11 is validated, built and checked.
No statement of the run is expert validated (manifest expert_accepted false).

Usage
    uv run run.py validate
    uv run run.py review
    uv run run.py build
    uv run run.py check
    uv run run.py graph
    uv run run.py select --output pipeline/runs/<new-run>
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PIPELINE = HERE / "pipeline"
RUN = "factoid-1153-2026-11-11"
CONTRACT = "contracts/factoid-2026-11-11"
CHECK_DEPS = ["pytest", "rdflib==7.6.0", "pyshacl==0.40.1", "lxml", "numpy", "shapely"]


def _uv(*args: str, cwd: Path = HERE) -> int:
    # Each script declares its own inline dependencies, which `uv run` resolves.
    print("$", "uv run", *args, flush=True)
    return subprocess.run(["uv", "run", "--quiet", *args], cwd=cwd, check=False).returncode


def select(rest: list[str]) -> int:
    return _uv("select_slice.py", "--project-dir", ".", *rest, cwd=PIPELINE)


def prepare(rest: list[str]) -> int:
    return _uv("prepare_pilot.py", "--project-dir", ".", "--contracts", CONTRACT, *rest, cwd=PIPELINE)


def validate(run: str) -> int:
    codes = [
        _uv(
            "validate_factoid.py",
            *("--project-dir", ".", "--contracts", CONTRACT, "--run-dir", f"runs/{run}"),
            *("--stage", stage, "--self-test"),
            cwd=PIPELINE,
        )
        for stage in ("extracted", "revised")
    ]
    # The extracted stage may fail by design: its findings are what review and correction fix.
    print(f"extracted exit {codes[0]}, revised exit {codes[1]}")
    return codes[1]


def review(run: str) -> int:
    return _uv("summarize_review.py", "--run-dir", f"runs/{run}", cwd=PIPELINE)


def build(run: str) -> int:
    return _uv("build_data.py", "--run", run) or _uv(
        "build_tei.py", "--run", run, "--schema", "schema/tei_all-4.12.0.rng"
    )


def graph(run: str) -> int:
    return _uv("queries/run_queries.py", "--run", run)


def check() -> int:
    deps = [arg for dep in CHECK_DEPS for arg in ("--with", dep)]
    return (
        _uv(*deps, "python", "-m", "pytest", "-q", "-p", "no:warnings", "checks")
        or subprocess.run(["uvx", "ruff", "check", "."], cwd=HERE, check=False).returncode
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("step", choices=("select", "prepare", "validate", "review", "build", "check", "graph"))
    parser.add_argument("--run", default=RUN)
    args, rest = parser.parse_known_args()
    if args.step == "select":
        return select(rest)
    if args.step == "prepare":
        return prepare(rest)
    if args.step == "validate":
        return validate(args.run)
    if args.step == "review":
        return review(args.run)
    if args.step == "build":
        return build(args.run)
    if args.step == "graph":
        return graph(args.run)
    return check()


if __name__ == "__main__":
    sys.exit(main())
