# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Select the contiguous edition slice of regesta up to a cutoff date, in delivery order.

Single-file script regime, standard library only. It reads the supplied regesta CSV, keeps
every record whose machine `start_date` lies on or before the cutoff, orders the slice by the
delivery's `sorting` key and assigns extraction batches of a fixed size. Regesta already
selected in an earlier run (read from that run's manifest) are marked `reused`, keep the
group and reason of that run so their packets come out byte-identical, and get batch 0;
they are copied, not extracted again. The result is a JSON list in the selection format
that prepare_pilot.py reads.

The cutoff applies to the machine date only. Machine dates can conflict with the prose
(n. 103a carries 1138 in `start_date` but dates itself to 1152); the slice follows the
delivery's field as the edition plan defines it and does not correct it.

--check runs the selection and asserts the counts the coordination confirmed for the
1153 slice (224 regesta, 80 before March 1152, six reused, n. 46 and n. 167 present)
without writing anything.

Usage:
  python select_slice.py --project-dir . --reuse runs/factoid-2026-11-11/manifest.json \
      --output runs/factoid-1153-2026-11-11/selection.json [--check]
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path
from typing import Any

SOURCE = "source-material/RI_004-002-ReggBarbarossa.csv"


def _rows(project: Path) -> list[dict[str, str]]:
    with (project / SOURCE).open(encoding="utf-8", newline="") as stream:
        return list(csv.DictReader(stream, escapechar="\\", strict=True))


def select(
    rows: list[dict[str, str]],
    reused: dict[str, dict[str, Any]],
    cutoff: str,
    batch_size: int,
) -> list[dict[str, Any]]:
    """The slice in `sorting` order; ISO dates compare correctly as strings."""
    for r in rows:
        if len(r["start_date"]) != 10:
            raise ValueError(
                f"Unexpected start_date in uid {r['uid']}: {r['start_date']!r}"
            )
    chosen = sorted(
        (r for r in rows if r["start_date"] <= cutoff), key=lambda r: r["sorting"]
    )
    selection: list[dict[str, Any]] = []
    new = 0
    for r in chosen:
        entry: dict[str, Any] = {"uid": r["uid"], "identifier": r["identifier"]}
        if r["uid"] in reused:
            old = reused[r["uid"]]
            entry |= {
                "group": old["group"],
                "reason": old["reason"],
                "batch": 0,
                "reused": True,
            }
        else:
            entry |= {
                "group": "slice",
                "reason": f"start_date on or before {cutoff}",
                "batch": new // batch_size + 1,
                "reused": False,
            }
            new += 1
        entry["start_date"] = r["start_date"]
        selection.append(entry)
    return selection


def check(selection: list[dict[str, Any]]) -> None:
    """Smallest runnable check for the 1153 slice; raises AssertionError on drift."""
    uids = [s["uid"] for s in selection]
    identifiers = {s["identifier"] for s in selection}
    assert len(selection) == 224, len(selection)
    assert len(set(uids)) == len(uids), "duplicate uid"
    assert sum(s["start_date"] < "1152-03-01" for s in selection) == 80
    assert {"RI IV,2,1 n. 46", "RI IV,2,1 n. 167"} <= identifiers
    assert sum(s["reused"] for s in selection) == 6
    batches: dict[int, int] = {}
    for s in selection:
        if not s["reused"]:
            batches[s["batch"]] = batches.get(s["batch"], 0) + 1
    assert sum(batches.values()) == 218
    assert all(n <= 4 for n in batches.values())
    assert sorted(batches) == list(range(1, len(batches) + 1))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--project-dir", type=Path, required=True)
    parser.add_argument(
        "--reuse", type=Path, required=True, help="manifest of an earlier run"
    )
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--cutoff", default="1153-12-31")
    parser.add_argument("--batch-size", type=int, default=4)
    parser.add_argument(
        "--check", action="store_true", help="assert the slice, write nothing"
    )
    args = parser.parse_args()
    reuse = json.loads(args.reuse.read_text(encoding="utf-8"))
    reused = {s["uid"]: s for s in reuse["selection"]}
    selection = select(_rows(args.project_dir), reused, args.cutoff, args.batch_size)
    if args.check:
        check(selection)
        print(
            f"[OK] {len(selection)} regesta, {sum(s['reused'] for s in selection)} reused."
        )
        return
    temp = args.output.with_name(args.output.name + ".tmp")
    temp.write_text(
        json.dumps(selection, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    temp.replace(args.output)
    print(f"[OK] Wrote {len(selection)} regesta to {args.output}.")


if __name__ == "__main__":
    try:
        main()
    except AssertionError as exc:
        sys.exit(f"[FAIL] Slice check failed: {exc}")
