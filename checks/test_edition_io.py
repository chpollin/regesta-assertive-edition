"""The shared CSV reader of edition_io.py against the two supplied Regesta Imperii files.

The register escapes double quotes with a backslash. Read with Python's default dialect, the
rows of the affected entries shift: a label is split and the trailing fields land in the
wrong columns, so the person entries RI004-002-K000373 and RI004-002-P000183 lost their type
and Paschal III. was missing from data/holdings.json until 2026-11-17. The check asserts
twice, as the other checks do: the real files read with the shared reader yield no error, and
the same file read with the default dialect, the named mutation, yields errors.

Usage
    uv run pytest -q checks/test_edition_io.py
"""

from __future__ import annotations

import csv
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from edition_io import REGESTA_CSV, REGISTER_CSV, read_csv  # noqa: E402

PIPELINE = ROOT / "pipeline"
SHIFTED_ENTRIES = ("RI004-002-K000373", "RI004-002-P000183")


def check_rows(rows: list[dict], header: list[str]) -> list[str]:
    """Every row has exactly the header's fields, each a string."""
    errors = []
    for number, row in enumerate(rows, start=2):
        if list(row) != header or any(not isinstance(v, str) for v in row.values()):
            errors.append(f"row {number} ({row.get('id') or row.get('uid')}) does not fit the header")
    return errors


def check_shifted_entries(rows: list[dict]) -> list[str]:
    """The two entries whose labels carry escaped quotes stay person entries."""
    errors = []
    for entry in SHIFTED_ENTRIES:
        types = {row["type"] for row in rows if row["id"] == entry}
        if types != {"person"}:
            errors.append(f"{entry} reads as type {sorted(types, key=str)}")
    return errors


def _default_dialect(path: Path) -> list[dict]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


class SharedReader(unittest.TestCase):
    def test_both_files_fit_their_header(self) -> None:
        for name in (REGESTA_CSV, REGISTER_CSV):
            rows = read_csv(PIPELINE / name)
            self.assertTrue(rows, f"{name} is empty")
            self.assertEqual(check_rows(rows, list(rows[0])), [], name)

    def test_escaped_quotes_keep_the_register_entries(self) -> None:
        rows = read_csv(PIPELINE / REGISTER_CSV)
        self.assertEqual(check_shifted_entries(rows), [])
        shifted = _default_dialect(PIPELINE / REGISTER_CSV)
        self.assertTrue(check_rows(shifted, list(rows[0])), "the default dialect must shift rows")
        self.assertTrue(check_shifted_entries(shifted), "the default dialect must lose the person type")


if __name__ == "__main__":
    unittest.main()
