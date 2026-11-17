# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Draw fresh regesta for a new run, reproducibly and before its contracts change.

Single-file script regime, standard library only. It reads the verified reading derivative
generated/regesta.jsonl, excludes the UIDs of an existing selection and every regest whose
citation identifier collides, and draws a fixed number of UIDs with a fixed seed. The
result is printed as JSON entries in the pilot-selection format with group "fresh".

The draw is uniform over the delivery and deliberately ignores lexical cues, so the fresh
regesta were seen by nobody who shaped the model. Some may hold no in-scope claim; that
tests abstention.

Usage: python select_fresh.py --project-dir . --exclude pilot-selection.json --count 5 --seed 20261111
"""

from __future__ import annotations

import argparse
import json
import random
from collections import Counter
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--project-dir", type=Path, required=True)
    parser.add_argument("--exclude", type=Path, required=True)
    parser.add_argument("--count", type=int, required=True)
    parser.add_argument("--seed", type=int, required=True)
    args = parser.parse_args()
    rows = [
        json.loads(line)
        for line in (args.project_dir / "generated/regesta.jsonl")
        .read_text(encoding="utf-8")
        .splitlines()
    ]
    excluded = {
        item["uid"] for item in json.loads(args.exclude.read_text(encoding="utf-8"))
    }
    collisions = {k for k, n in Counter(r["identifier"] for r in rows).items() if n > 1}
    pool = sorted(
        r["uid"]
        for r in rows
        if r["uid"] not in excluded
        and r["identifier"] not in collisions
        and (r["summary_plain"] or "").strip()
    )
    drawn = sorted(random.Random(args.seed).sample(pool, args.count))
    print(
        json.dumps(
            [
                {
                    "uid": uid,
                    "group": "fresh",
                    "reason": f"uniform draw, seed {args.seed}",
                }
                for uid in drawn
            ],
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
