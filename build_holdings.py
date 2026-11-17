# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Build the whole-holdings layer of the edition from the delivery, without any LLM.

Regime: single-file script, standard library only. It reads the sibling repository
pipeline/ and never writes there.

The edition shows two honest layers in the same views. This script builds the first: the
whole delivery of RI IV,2 as the deterministic exploration and the register give it, so a
reader sees every regest in time, the places of issue as an itinerary, and who is named how
often and when. The second layer, the evidenced statements of the extracted slice, comes
from build_data.py; nothing here claims a statement.

Data flow
    generated/regesta.jsonl                 every regest with dates and summary_plain
                                            (explore_regesta.py, deterministic)
    source-material/RI_004-002-RegisterBarbarossa.csv
                                            labels, types, roles and coordinates
        -> data/holdings.json               regesta, places of issue, persons, years
        -> data/holdings-texts.json         summary_plain per regest, loaded on demand

Usage
    python build_holdings.py
    python build_holdings.py --source pipeline --out data
    python build_holdings.py --check        build into a temporary folder and assert

Design decisions
- The place of issue is the register row with the role token `austOrt` for a regest; the
  first such row with valid coordinates counts. Coordinates outside a box around the
  places Barbarossa can have issued from (latitude 30 to 62, longitude -10 to 45) or not
  numeric are skipped and logged, never repaired; the log is part of the output.
- Persons are register entries of type `person`. Their short label is the first name
  variant and the first clause after `//` (for example „Rainald von Dassel“); where the
  first variant is empty the parent entry's label is used. The full label stays.
- Only persons named in at least MIN_REGESTA regesta are written, to keep the file small;
  the threshold is in the output.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import html
import json
import re
import sys
import tempfile
from pathlib import Path

from register_names import register_names

MIN_REGESTA = 3
LAT = (30.0, 62.0)
LON = (-10.0, 45.0)
NUMBER = re.compile(r"-?\d+(?:\.\d+)?")
TAG = re.compile(r"<[^>]+>")


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _clean(text: str) -> str:
    return " ".join(html.unescape(TAG.sub("", text)).split())


def _null(value: str | None) -> bool:
    return value is None or value.strip().lower() in {"", "null", "none"}


def _plain_text(raw: str) -> str:
    """Delivery markup as plain text with collapsed whitespace."""
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", raw))).strip()


# Place labels the register delivery writes wrongly, corrected for display only; the register
# id stays, so the correction is traceable. "Cremam(am Serio, östl. Lodi ...)" is Crema.
PLACE_FIXES = {"RI004-002-C001005": "Crema"}


def _place_label(label: str) -> str:
    """„Pavia (am Ticino, ital. Prov.-…)“ becomes „Pavia“."""
    return re.split(r"\s*\(|\s//|,", _clean(label))[0].strip()


def build(source: Path, out: Path) -> dict:
    regesta_path = source / "generated" / "regesta.jsonl"
    register_path = source / "source-material" / "RI_004-002-RegisterBarbarossa.csv"
    for path in (regesta_path, register_path):
        if not path.exists():
            sys.exit(f"Missing input {path}; run pipeline/explore_regesta.py first.")

    regesta = [json.loads(line) for line in regesta_path.read_text(encoding="utf-8").splitlines() if line.strip()]
    by_identifier = {r["identifier"]: r for r in regesta}
    with register_path.open(encoding="utf-8-sig", newline="") as handle:
        register = list(csv.DictReader(handle))

    errors: list[dict] = []
    places: dict[str, dict] = {}
    issue_place: dict[str, str] = {}
    person_regesta: dict[str, set[str]] = {}
    person_label: dict[str, str] = {}
    recipients: dict[str, set[str]] = {}

    for row in register:
        regest = by_identifier.get(row["regestaIdentifier"])
        if regest is None:
            continue
        uid = regest["uid"]
        roles = set(row["role"].split())
        kind = row["type"].strip()
        if "austOrt" in roles and uid not in issue_place and not _null(row["lat"]):
            lat_text, lon_text = row["lat"].strip(), row["long"].strip()
            if not (NUMBER.fullmatch(lat_text) and NUMBER.fullmatch(lon_text)):
                errors.append(
                    {
                        "regest": row["regestaIdentifier"],
                        "entry": row["id"],
                        "check": "coordinate not numeric",
                        "value": f"{lat_text}, {lon_text}",
                    }
                )
                continue
            lat, lon = float(lat_text), float(lon_text)
            if not (LAT[0] <= lat <= LAT[1] and LON[0] <= lon <= LON[1]):
                errors.append(
                    {
                        "regest": row["regestaIdentifier"],
                        "entry": row["id"],
                        "check": "coordinate outside the expected box",
                        "value": f"{lat_text}, {lon_text}",
                    }
                )
                continue
            issue_place[uid] = row["id"]
            place = places.setdefault(
                row["id"],
                {
                    "l": PLACE_FIXES.get(row["id"]) or _place_label(row["label"]),
                    "la": round(lat, 4),
                    "lo": round(lon, 4),
                    "n": 0,
                },
            )
            place["n"] += 1
        if kind == "person":
            person_regesta.setdefault(row["id"], set()).add(uid)
            person_label[row["id"]] = _clean(row["label"])
            if roles & {"empfaenger", "adressat", "petent"}:
                recipients.setdefault(uid, set()).add(row["id"])

    year = lambda r: int(r["start_date"][:4])  # noqa: E731 - one-line key, read once
    regesta.sort(key=lambda r: (r["start_date"], r["identifier"]))
    persons = {pid: uids for pid, uids in person_regesta.items() if len(uids) >= MIN_REGESTA}
    # One naming rule with the run's graph (register_names.py), unique among the persons written.
    short = register_names(register_path, set(persons))
    years: dict[int, int] = {}
    for r in regesta:
        years[year(r)] = years.get(year(r), 0) + 1

    holdings = {
        "source": {
            "regesta": {
                "file": "generated/regesta.jsonl",
                "sha256": _sha256(regesta_path),
                "producer": "explore_regesta.py, deterministic",
            },
            "register": {"file": register_path.name, "sha256": _sha256(register_path)},
            "licence": "CC BY 4.0, Regesta Imperii Online, bearbeitet",
        },
        "counts": {
            "regesta": len(regesta),
            "withIssuePlace": len(issue_place),
            "issuePlaces": len(places),
            "persons": len(person_regesta),
            "personsWritten": len(persons),
            "minRegesta": MIN_REGESTA,
            "skippedCoordinates": len(errors),
        },
        "years": sorted(years.items()),
        "regesta": [
            {
                "u": r["uid"],
                "i": r["identifier"],
                "s": r["start_date"],
                "p": issue_place.get(r["uid"]),
                # The delivery writes a missing value as the string "null" and some localities
                # with markup; neither may reach a page.
                "l": None if _null(r.get("locality_string")) else _plain_text(r["locality_string"]),
                "pi": None if _null(r.get("persistent_identifier")) else r["persistent_identifier"],
                "rc": sorted(recipients.get(r["uid"], set()) & persons.keys()) or None,
            }
            for r in regesta
        ],
        "places": places,
        "persons": {
            pid: {"l": short.get(pid, person_label[pid]), "f": person_label[pid], "r": sorted(uids)}
            for pid, uids in persons.items()
        },
        "errors": errors,
    }
    texts = {r["uid"]: r.get("summary_plain") or "" for r in regesta}
    out.mkdir(parents=True, exist_ok=True)
    (out / "holdings.json").write_text(
        json.dumps(holdings, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    (out / "holdings-texts.json").write_text(
        json.dumps(texts, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    return holdings


def _check(source: Path) -> None:
    """The smallest run that fails when the layer is wrong."""
    with tempfile.TemporaryDirectory() as tmp:
        h = build(source, Path(tmp))
        texts = json.loads((Path(tmp) / "holdings-texts.json").read_text(encoding="utf-8"))
    c = h["counts"]
    assert c["regesta"] == len(texts) == len(h["regesta"]), "every regest has an entry and a text"
    assert 0 < c["withIssuePlace"] <= c["regesta"], "some regesta have a place of issue"
    assert all(LAT[0] <= p["la"] <= LAT[1] and LON[0] <= p["lo"] <= LON[1] for p in h["places"].values()), (
        "no place outside the box"
    )
    assert sum(n for _, n in h["years"]) == c["regesta"], "years count every regest once"
    assert all(len(p["r"]) >= c["minRegesta"] for p in h["persons"].values()), "threshold holds"
    print("check passed", c)


def main() -> None:
    here = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--source", type=Path, default=here / "pipeline")
    parser.add_argument("--out", type=Path, default=here / "data")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.check:
        _check(args.source)
        return
    h = build(args.source, args.out)
    print(json.dumps(h["counts"], ensure_ascii=False))
    for error in h["errors"]:
        print("skipped:", error["regest"], error["check"], error["value"])


if __name__ == "__main__":
    main()
