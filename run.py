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
      check     uv run pytest over checks/, ruff check and ruff format --check, from uv.lock
      graph     queries/run_queries.py        the revised Turtle as one graph in memory, queries/*.rq
      export    build_graph.py                one reusable graph of the revised stage in data/graph/

Python never calls an LLM. Steps 1 and 2 refuse an existing output folder, so they only
start a new run; the shown run (edition_io.SHOWN_RUN) is validated, built and checked.
No statement of the run is expert validated (manifest expert_accepted false).

validate refuses a run whose validation reports record a validator hash other than that of
the current pipeline/validate_factoid.py, because validating would overwrite the reports of a
frozen run with those of a different validator. --allow-validator-change overrides this
deliberately, for instance after a validator change that is meant to produce new reports.

Usage
    uv run run.py validate
    uv run run.py review
    uv run run.py build
    uv run run.py check
    uv run run.py graph [--export]
    uv run run.py export
    uv run run.py validate --run <run> [--allow-validator-change]
    uv run run.py select --output pipeline/runs/<new-run>
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

from edition_io import SHOWN_RUN, sha256

HERE = Path(__file__).resolve().parent
PIPELINE = HERE / "pipeline"
CONTRACT = "contracts/factoid-2026-11-11"
VALIDATOR = PIPELINE / "validate_factoid.py"
STAGES = ("extracted", "revised")
EXPORT = HERE / "data" / "graph"
# The gate runs in the project environment of uv.lock; --locked fails when pyproject.toml and
# the lock disagree, so every machine checks with the same versions.
GATE = (
    ("pytest", "-q", "-p", "no:warnings", "checks"),
    ("ruff", "check", "."),
    ("ruff", "format", "--check", "."),
)


def _uv(*args: str, cwd: Path = HERE) -> int:
    # Scripts in pipeline/ declare their own inline dependencies, which `uv run` resolves in a
    # separate environment; the root scripts run in the project environment of uv.lock.
    print("$", "uv run", *args, flush=True)
    return subprocess.run(["uv", "run", "--quiet", *args], cwd=cwd, check=False).returncode


def select(rest: list[str]) -> int:
    return _uv("select_slice.py", "--project-dir", ".", *rest, cwd=PIPELINE)


def prepare(rest: list[str]) -> int:
    return _uv("prepare_pilot.py", "--project-dir", ".", "--contracts", CONTRACT, *rest, cwd=PIPELINE)


def _foreign_validator(run: str) -> list[str]:
    """Reports of the run that a different validator wrote; empty for a new run."""
    current = sha256(VALIDATOR)
    foreign = []
    for stage in STAGES:
        report = PIPELINE / "runs" / run / "validation" / f"{stage}.json"
        if report.is_file():
            recorded = json.loads(report.read_text(encoding="utf-8")).get("validator_sha256")
            if recorded != current:
                foreign.append(f"{report.relative_to(HERE)} records validator {recorded}, current is {current}")
    return foreign


def validate(run: str, allow_validator_change: bool) -> int:
    foreign = _foreign_validator(run)
    if foreign and not allow_validator_change:
        print(
            "[FAIL] refusing to validate: the reports would be rewritten by another validator.",
            *foreign,
            "Pass --allow-validator-change to rewrite them deliberately.",
            sep="\n",
            file=sys.stderr,
        )
        return 2
    codes = [
        _uv(
            "validate_factoid.py",
            *("--project-dir", ".", "--contracts", CONTRACT, "--run-dir", f"runs/{run}"),
            *("--stage", stage, "--self-test"),
            cwd=PIPELINE,
        )
        for stage in STAGES
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


def graph(run: str, export: bool) -> int:
    if export:
        return _uv("queries/run_queries.py", "--file", str(EXPORT / f"{run}.ttl"))
    return _uv("queries/run_queries.py", "--run", run)


def export(run: str, rest: list[str]) -> int:
    return _uv("build_graph.py", "--run", run, "--out", str(EXPORT), *rest)


def check() -> int:
    codes = [_uv("--locked", *step) for step in GATE]
    return max(codes)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "step", choices=("select", "prepare", "validate", "review", "build", "check", "graph", "export")
    )
    parser.add_argument("--run", default=SHOWN_RUN)
    parser.add_argument("--allow-validator-change", action="store_true", help="validate: rewrite foreign reports")
    parser.add_argument("--export", action="store_true", help="graph: query the export instead of the stage")
    args, rest = parser.parse_known_args()
    if args.step == "select":
        return select(rest)
    if args.step == "prepare":
        return prepare(rest)
    if args.step == "validate":
        return validate(args.run, args.allow_validator_change)
    if args.step == "review":
        return review(args.run)
    if args.step == "build":
        return build(args.run)
    if args.step == "graph":
        return graph(args.run, args.export)
    if args.step == "export":
        return export(args.run, rest)
    return check()


if __name__ == "__main__":
    sys.exit(main())
