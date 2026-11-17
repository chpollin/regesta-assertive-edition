# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Derive one readable overview from the per-group adjudication files of a factoid run.

Single-file script regime, standard library only. It reads runs/<run>/review/adjudication-*.json
and writes runs/<run>/review-overview.md, which is derived and regenerated, never edited. It
lies beside review/ because the edition build refuses unknown files inside that folder. The
adjudication files stay unchanged as the evidence. Adjudication is an agent's decision against
the frozen contract; it is no expert validation.

Usage
    uv run summarize_review.py --run-dir runs/factoid-1153-2026-11-11
"""

from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path

# Decision codes of the adjudication files, with what each means for the revised stage.
DECISIONS = {
    "correct": "accepted, corrected in revised/",
    "correct_conservatively": "accepted, corrected in revised/ to the safer reading",
    "keep": "rejected, the extracted reading stays",
    "not_required": "rejected, the frozen contract does not require it",
    "model_gap": "recorded as a limit of the model, no correction",
    "reject": "rejected as wrong",
}


def _group_key(path: Path) -> int:
    return int(re.search(r"g(\d+)", path.stem).group(1))


def build(run_dir: Path) -> str:
    files = sorted((run_dir / "review").glob("adjudication-g*.json"), key=_group_key)
    total: Counter[str] = Counter()
    lines = []
    for path in files:
        data = json.loads(path.read_text(encoding="utf-8"))
        counts = Counter(d["decision"] for d in data["decisions"])
        total += counts
        uids = sorted({u for d in data["decisions"] for u in d["uids"]}, key=int)
        lines.append(f"## Group {_group_key(path)}\n")
        lines.append(
            f"Decisions: {', '.join(f'{k} {counts[k]}' for k in DECISIONS if counts[k])}. UIDs with findings: {', '.join(uids)}.\n"
        )
        for d in data["decisions"]:
            if d["decision"] in {"correct", "correct_conservatively", "model_gap"}:
                finding = " ".join(d["finding"].split())
                lines.append(f"- {d['decision']}, {', '.join(d['uids'])}: {finding}")
        lines.append("")
    unknown = set(total) - set(DECISIONS)
    if unknown:
        raise ValueError(f"Unknown decision codes: {sorted(unknown)}")
    head = [
        f"# Review overview, {run_dir.name}\n",
        "Derived by summarize_review.py from the adjudication files in review/; do not edit.",
        "Two independent LLM reviews per group, adjudicated by an agent against the frozen contract.",
        "No statement is expert validated (manifest expert_accepted false).\n",
        "## Decisions over all groups\n",
        *(f"- {code}: {total[code]}, {meaning}" for code, meaning in DECISIONS.items()),
        "\nEach group lists its corrections and the recorded model gaps; kept and rejected findings stay in the adjudication files.\n",
    ]
    return "\n".join(head + lines).rstrip() + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--run-dir", type=Path, required=True)
    args = parser.parse_args()
    out = args.run_dir / "review-overview.md"
    out.write_text(build(args.run_dir), encoding="utf-8", newline="\n")
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
