"""Shared input reading of the edition's root scripts: the delivery CSV dialect, JSON inputs and hashes.

Regime: first-party module of the script pipeline in the repository root (pyproject.toml,
never installed). Imported by build_data.py, build_tei.py, build_holdings.py,
check_itinerary.py, register_names.py, build_agent_review.py, prepare_agent_review.py,
build_graph.py, run.py, queries/run_queries.py and the checks. build_site.py keeps its own
copies of BuildError, the JSON loader, slug and the CSV reading until it is moved onto this
module; the pipeline scripts in pipeline/ never import it, because their hashes are recorded.

Design decisions
- One reader for both Regesta Imperii CSV files. The register escapes double quotes with a
  backslash, and Python's default dialect then shifts the fields of the affected rows (the
  person entries RI004-002-K000373 and RI004-002-P000183 among them). The pipeline reads
  both files with escapechar="\\" and strict=True (pipeline/explore_regesta.py), and so does
  every reader here. On the regest file both dialects give the same rows; the shared reader
  keeps one rule for both.
- SHOWN_RUN names the run the edition shows. Every script defaults to it, so changing the
  shown run is one edit.
"""

from __future__ import annotations

import csv
import hashlib
import html
import json
import re
from calendar import monthrange
from datetime import date
from pathlib import Path
from typing import Any

SHOWN_RUN = "factoid-1153-2026-11-11"
REGESTA_CSV = Path("source-material") / "RI_004-002-ReggBarbarossa.csv"
REGISTER_CSV = Path("source-material") / "RI_004-002-RegisterBarbarossa.csv"
_TAG = re.compile(r"<[^>]+>")


class BuildError(Exception):
    """A violated contract between the run files or the delivery and a build; the message names the step."""


def read_csv(path: Path) -> list[dict[str, str]]:
    """All rows of a delivery CSV in the observed dialect; a malformed row aborts (strict)."""
    if not path.is_file():
        raise BuildError(f"missing input file {path}")
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle, escapechar="\\", strict=True))


def load_json(path: Path) -> Any:
    if not path.is_file():
        raise BuildError(f"missing input file {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def plain_text(raw: str) -> str:
    """Delivery markup as plain text: tags removed, entities resolved, whitespace collapsed."""
    return " ".join(html.unescape(_TAG.sub("", raw)).split())


def is_null(value: str | None) -> bool:
    """The delivery writes a missing value as an empty string or the string null."""
    return value is None or value.strip().lower() in {"", "null", "none"}


def place_label(label: str) -> str:
    """„Pavia (am Ticino, ital. Prov.-…)“ becomes „Pavia“."""
    return re.split(r"\s*\(|\s//|,", plain_text(label))[0].strip()


# Place labels the rule above reads wrongly from the register, corrected for display only; the
# register id stays, so the correction is traceable. "Cremam(am Serio, östl. Lodi ...)" is
# Crema; "Johannes, Iohannes, ... Jean // Saint J.- de-Losne (an der Saône ...)" files the town
# under the saint's name variants, and the rule would call it Johannes.
PLACE_FIXES = {"RI004-002-C001005": "Crema", "RI004-002-J000210": "Saint-Jean-de-Losne"}


def place_name(entry_id: str, label: str) -> str:
    """The display name of a register place: its correction, or the head of its label."""
    return PLACE_FIXES.get(entry_id) or place_label(label)


# The longest span, from start to end, that still places a regest in the line of the itinerary
# (knowledge/data.md, Line of the itinerary): a stated assumption, like the check's threshold.
LINE_SPAN_DAYS = 7


def dating_class(start: str, end: str) -> tuple[str, int | None]:
    """Class of a machine dating and, for a span, its length in days."""
    try:
        s, e = date.fromisoformat(start), date.fromisoformat(end)
    except (TypeError, ValueError):
        return "undatiert", None
    if s > e:
        return "umgekehrt", None
    if s == e:
        return "Tag", None
    if (s.month, s.day, e.month, e.day) == (1, 1, 12, 31) and s.year == e.year:
        return "Jahr", None
    if s.day == 1 and (s.year, s.month) == (e.year, e.month) and e.day == monthrange(e.year, e.month)[1]:
        return "Monat", None
    return "Spanne", (e - s).days


def in_line(start: str, end: str) -> bool:
    """A dating exact enough for the line of the itinerary: a day, or a span of at most a week."""
    kind, length = dating_class(start, end)
    return kind == "Tag" or (kind == "Spanne" and length is not None and length <= LINE_SPAN_DAYS)


def by_unique_identifier(regesta: list[dict]) -> tuple[dict[str, dict], dict[str, list[str]]]:
    """Regesta by display identifier for the register join, and the identifiers naming several records.

    The register joins on the identifier, and the join holds only where exactly one record
    matches (knowledge/source-data.md): RI IV,2,2 n. 1520a names two records. Their register
    rows are assigned to neither; the second value reports them (identifier -> uids).
    """
    uids: dict[str, list[str]] = {}
    for r in regesta:
        uids.setdefault(r["identifier"], []).append(r["uid"])
    ambiguous = {i: u for i, u in uids.items() if len(u) > 1}
    return {r["identifier"]: r for r in regesta if r["identifier"] not in ambiguous}, ambiguous


def regest_order(regest: dict[str, str]) -> tuple:
    """Sort key of the delivery in time: start date, then the identifier with its numbers as numbers.

    One key for build_holdings.py and check_itinerary.py, so the line the views draw (they keep
    this order and sort by date only) is the line whose steps were checked. Until 2026-11-18 the
    views re-sorted same-day regesta by a locale rule that the check did not share.
    """
    parts = re.split(r"(\d+)", regest["identifier"])
    return (regest["start_date"], [int(p) if p.isdigit() else p for p in parts])
