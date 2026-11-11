# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Check the itinerary of the whole delivery for implausible jumps, deterministically.

Regime: single-file script, standard library only. It reads the sibling repository
regesta-rdf-demo, never writes there, and imports nothing from this repository.

The itinerary view (`#/itinerar`, built from data/holdings.json by build_holdings.py) draws
one point per regest with a place of issue and joins the points in start_date order. This
script asks how far that line can be trusted. It finds candidates for errors; it proves
nothing correct. A point is only as right as the delivered machine date and the register
coordinate, and a plausible line can still be wrong.

Data flow
    generated/regesta.jsonl                 dates, dating prose, locality, texts per regest
    source-material/RI_004-002-RegisterBarbarossa.csv
                                            austOrt rows with coordinates
        -> data/itinerary-checks.json       dating classes, regesta missing from the view
                                            by reason, flagged jumps with a class each

Usage
    python check_itinerary.py
    python check_itinerary.py --source ../regesta-rdf-demo --out data/itinerary-checks.json
    python check_itinerary.py --check       synthetic assertions, then a consistency run

Design decisions
- The place of issue follows build_holdings.py exactly: the first register row with the
  role token `austOrt` whose coordinates are numeric and inside the box latitude 30 to 62,
  longitude -10 to 45. The rule is copied, not imported, so the script stays one file; a
  change of the rule in build_holdings.py must be mirrored here by hand.
- Dating is read from the machine dates only. start == end is an exact day; 1 January to
  31 December of one year is a year; the 1st to the last day of one month is a month; any
  other start < end is a span; start > end is reversed; an unparsable date is undated.
- Pairs are consecutive points of the line as the view draws it (all placed regesta by
  start_date, then identifier), so a regest with a span sits at its start. Days between
  two points are the difference of their start dates.
- Threshold. A pair is flagged when its distance exceeds max(150 km, 60 km x days). This is
  a stated assumption, chosen generously so that only clearly impossible movements of a
  court with its following are flagged. 150 km allows one hard day's ride plus imprecise
  coordinates, 60 km per day allows forced marches over several days. It is not taken from
  a read source; the research literature on the travel speed of the royal court (the
  itinerary monograph on Barbarossa and studies on the speed of the court in the 11th and
  12th centuries) should replace it once read.
- Every flagged pair gets the first matching class, from the data alone: a member without
  an exact day; a member with a skipped coordinate row; a forgery (identifier with †); a
  deperditum (identifier with D, or „Deperditum“ in the transmission note); another actor
  (the summary does not name Friedrich among its first six words, as in a papal letter to
  him, so the place of issue is likely the other actor's, not Friedrich's stay; a heuristic);
  a place of issue inferred by the editor (locality in parentheses); indirect issue (summary mentions
  „erwähnt“, „verloren“, „Deperditum“, or „durch“ a legate, envoy or messenger); same day
  at two places; otherwise „unklar“. All indicators of both members are kept as well.
- A regest flagged against both its neighbours while those neighbours fit together is
  listed as an outlier: the line makes a detour through it.
- The register gives no certainty for any austOrt row, so the role is not used as a class;
  the role tokens of the place row are counted for the record.
"""

from __future__ import annotations

import argparse
import csv
import html
import json
import math
import re
import statistics
import sys
from calendar import monthrange
from collections import Counter
from dataclasses import dataclass, field
from datetime import date
from itertools import pairwise
from pathlib import Path

LAT = (30.0, 62.0)
LON = (-10.0, 45.0)
NUMBER = re.compile(r"-?\d+(?:\.\d+)?")
TAG = re.compile(r"<[^>]+>")
FLOOR_KM = 150.0
KM_PER_DAY = 60.0
EARTH_KM = 6371.0
INDIRECT = re.compile(
    r"\b(erwähnt|verloren|Deperditum)\b|\bdurch\s+(?:\S+\s+){0,4}?(Legat|Boten|Bote|Gesandt)", re.IGNORECASE
)
FRIEDRICH = re.compile(r"F\(?riedrich")
CLASSES = (
    "Datierung ohne genauen Tag",
    "Koordinate fraglich",
    "Fälschung",
    "Deperditum",
    "anderer Akteur",
    "Ort erschlossen",
    "mittelbare Ausstellung",
    "gleicher Tag, zwei Orte",
    "unklar",
)


@dataclass(frozen=True)
class Station:
    uid: str
    identifier: str
    start: str
    dating: str
    place: str
    lat: float
    lon: float
    indicators: tuple[str, ...] = field(default=())


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


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_KM * math.asin(math.sqrt(a))


def limit_km(days: int) -> float:
    return max(FLOOR_KM, KM_PER_DAY * days)


def _classify(a: Station, b: Station, days: int) -> str:
    both = set(a.indicators) | set(b.indicators)
    if a.dating != "Tag" or b.dating != "Tag":
        return CLASSES[0]
    for name in CLASSES[1:7]:
        if name in both:
            return name
    return CLASSES[7] if days == 0 else CLASSES[8]


def check_pairs(stations: list[Station]) -> tuple[list[dict], list[dict]]:
    """Flag consecutive stations whose distance exceeds the threshold, and find detours."""
    flags, flagged_at = [], set()
    for i, (a, b) in enumerate(pairwise(stations)):
        days = (date.fromisoformat(b.start) - date.fromisoformat(a.start)).days
        km = haversine_km(a.lat, a.lon, b.lat, b.lon)
        if km <= limit_km(days):
            continue
        flagged_at.add(i)
        flags.append(
            {
                "a": _station_json(a),
                "b": _station_json(b),
                "km": round(km),
                "days": days,
                "kmPerDay": round(km / days) if days else None,
                "class": _classify(a, b, days),
            }
        )
    outliers = []
    for i in range(1, len(stations) - 1):
        if i - 1 in flagged_at and i in flagged_at:
            prev, here, nxt = stations[i - 1], stations[i], stations[i + 1]
            days = (date.fromisoformat(nxt.start) - date.fromisoformat(prev.start)).days
            if haversine_km(prev.lat, prev.lon, nxt.lat, nxt.lon) <= limit_km(days):
                outliers.append(
                    {"uid": here.uid, "identifier": here.identifier, "start": here.start, "place": here.place}
                )
    return flags, outliers


def _station_json(s: Station) -> dict:
    return {
        "uid": s.uid,
        "identifier": s.identifier,
        "start": s.start,
        "dating": s.dating,
        "place": s.place,
        "indicators": list(s.indicators),
    }


def _clean(text: str) -> str:
    return " ".join(html.unescape(TAG.sub("", text)).split())


def _null(value: str | None) -> bool:
    return value is None or value.strip().lower() in {"", "null", "none"}


def _place_label(label: str) -> str:
    return re.split(r"\s*\(|\s//|,", _clean(label))[0].strip()


def _indicators(regest: dict, skipped: bool) -> tuple[str, ...]:
    number = regest["identifier"].split("n. ")[-1]
    transmission = regest.get("archival_history_plain") or ""
    found = []
    if skipped:
        found.append("Koordinate fraglich")
    if "†" in number:
        found.append("Fälschung")
    if "D" in number or "Deperditum" in transmission:
        found.append("Deperditum")
    summary = regest.get("summary_plain") or ""
    if summary and not FRIEDRICH.search(" ".join(summary.split()[:6])):
        found.append("anderer Akteur")
    if (regest.get("locality_string") or "").strip().startswith("("):
        found.append("Ort erschlossen")
    if INDIRECT.search(summary):
        found.append("mittelbare Ausstellung")
    return tuple(found)


def build(source: Path) -> dict:
    regesta_path = source / "generated" / "regesta.jsonl"
    register_path = source / "source-material" / "RI_004-002-RegisterBarbarossa.csv"
    for path in (regesta_path, register_path):
        if not path.exists():
            sys.exit(f"Missing input {path}; run explore_regesta.py in regesta-rdf-demo first.")
    regesta = [json.loads(line) for line in regesta_path.read_text(encoding="utf-8").splitlines() if line.strip()]
    by_identifier = {r["identifier"]: r for r in regesta}
    with register_path.open(encoding="utf-8-sig", newline="") as handle:
        register = list(csv.DictReader(handle))

    # Same rule as build_holdings.py; outcome per regest: placed, or why not.
    placed: dict[str, tuple[str, float, float, str]] = {}
    seen_austort: set[str] = set()
    skipped: set[str] = set()
    roles: Counter[str] = Counter()
    for row in register:
        regest = by_identifier.get(row["regestaIdentifier"])
        if regest is None or "austOrt" not in row["role"].split():
            continue
        uid = regest["uid"]
        seen_austort.add(uid)
        if uid in placed or _null(row["lat"]):
            continue
        lat_text, lon_text = row["lat"].strip(), row["long"].strip()
        if not (NUMBER.fullmatch(lat_text) and NUMBER.fullmatch(lon_text)):
            skipped.add(uid)
            continue
        lat, lon = float(lat_text), float(lon_text)
        if not (LAT[0] <= lat <= LAT[1] and LON[0] <= lon <= LON[1]):
            skipped.add(uid)
            continue
        placed[uid] = (_place_label(row["label"]), lat, lon, row["id"])
        roles[row["role"]] += 1

    dating: Counter[str] = Counter()
    spans: list[int] = []
    missing: Counter[str] = Counter()
    placed_dating: Counter[str] = Counter()
    indicator_hits: Counter[str] = Counter()
    stations = []
    for r in regesta:
        kind, length = dating_class(r["start_date"], r["end_date"])
        dating[kind] += 1
        if length is not None:
            spans.append(length)
        for name in _indicators(r, False):
            indicator_hits[name] += 1
        uid = r["uid"]
        if uid not in placed:
            if uid in skipped:
                missing["Koordinate ungültig, übersprungen"] += 1
            elif uid in seen_austort:
                missing["austOrt ohne Koordinaten"] += 1
            else:
                missing["keine austOrt-Zeile"] += 1
            continue
        placed_dating[kind] += 1
        label, lat, lon, _ = placed[uid]
        stations.append(
            Station(uid, r["identifier"], r["start_date"], kind, label, lat, lon, _indicators(r, uid in skipped))
        )
    stations.sort(key=lambda s: (s.start, s.identifier))
    flags, outliers = check_pairs(stations)
    involved = {s["uid"] for f in flags for s in (f["a"], f["b"])}
    return {
        "source": {
            "regesta": "generated/regesta.jsonl",
            "register": register_path.name,
            "producer": "check_itinerary.py",
        },
        "threshold": {
            "rule": "km > max(floorKm, kmPerDay * days), days between start dates of consecutive points",
            "floorKm": FLOOR_KM,
            "kmPerDay": KM_PER_DAY,
            "basis": "stated assumption, not taken from a read source",
        },
        "counts": {
            "regesta": len(regesta),
            "dating": dict(dating.most_common()),
            "spanDays": {
                "n": len(spans),
                "median": statistics.median(spans) if spans else None,
                "max": max(spans, default=None),
                "upTo7": sum(n <= 7 for n in spans),
                "upTo31": sum(7 < n <= 31 for n in spans),
                "upTo366": sum(31 < n <= 366 for n in spans),
                "longer": sum(n > 366 for n in spans),
            },
            "placement": "a point stands at start_date; a span, month or year is not drawn as an interval",
            "inView": len(stations),
            "inViewByDating": dict(placed_dating.most_common()),
            "missingFromView": dict(missing.most_common()),
            "placeRowRoles": dict(roles.most_common()),
            "indicatorHits": dict(indicator_hits.most_common()),
            "indicatorHitsInFlagged": dict(
                Counter(i for s in stations if s.uid in involved for i in s.indicators).most_common()
            ),
            "pairs": max(len(stations) - 1, 0),
            "flagged": len(flags),
            "flaggedByClass": dict(Counter(f["class"] for f in flags).most_common()),
            "outliers": len(outliers),
        },
        "flags": flags,
        "outliers": outliers,
    }


def _check(source: Path) -> None:
    """The smallest assertions that fail when the logic is wrong."""
    assert abs(haversine_km(47.0, 15.0, 48.0, 15.0) - 111.2) < 0.5, "one degree of latitude"
    assert dating_class("1152-03-09", "1152-03-09") == ("Tag", None)
    assert dating_class("1152-02-01", "1152-02-29") == ("Monat", None), "leap year month end"
    assert dating_class("1153-01-01", "1153-12-31") == ("Jahr", None)
    assert dating_class("1153-01-01", "1153-01-08") == ("Spanne", 7)
    assert dating_class("1179-09-20", "1179-01-10") == ("umgekehrt", None)
    assert dating_class("", "1153-01-01") == ("undatiert", None)

    papal = {"identifier": "RI IV,2,1 n. 86", "summary_plain": "Papst Eugen (III.) schreibt an König F(riedrich)"}
    assert _indicators(papal, False) == ("anderer Akteur",), "a letter to Friedrich is another actor's"
    own = {"identifier": "RI IV,2,1 n. †4", "summary_plain": "Friedrich bestätigt", "locality_string": "(Ulm)"}
    assert _indicators(own, False) == ("Fälschung", "Ort erschlossen")

    def st(uid: str, start: str, lat: float, lon: float, dating: str = "Tag", ind: tuple[str, ...] = ()) -> Station:
        return Station(uid, f"n. {uid}", start, dating, uid, lat, lon, ind)

    # About 500 km apart (4.5 degrees of latitude) on consecutive days.
    flags, _ = check_pairs([st("a", "1160-05-01", 45.0, 10.0), st("b", "1160-05-02", 49.5, 10.0)])
    assert len(flags) == 1 and flags[0]["class"] == "unklar", "500 km in one day is flagged"
    flags, _ = check_pairs([st("a", "1160-05-01", 45.0, 10.0), st("b", "1160-05-08", 45.18, 10.0)])
    assert flags == [], "20 km in a week is not flagged"
    flags, _ = check_pairs([st("a", "1160-05-01", 45.0, 10.0), st("b", "1160-05-01", 47.0, 10.0)])
    assert flags[0]["class"] == "gleicher Tag, zwei Orte" and flags[0]["kmPerDay"] is None
    flags, _ = check_pairs([st("a", "1160-05-01", 45.0, 10.0, "Monat"), st("b", "1160-05-03", 49.5, 10.0)])
    assert flags[0]["class"] == "Datierung ohne genauen Tag", "dating outranks other reasons"
    flags, _ = check_pairs([st("a", "1160-05-01", 45.0, 10.0), st("b", "1160-05-03", 49.5, 10.0, ind=("Fälschung",))])
    assert flags[0]["class"] == "Fälschung"
    flags, outliers = check_pairs(
        [st("a", "1160-05-01", 45.0, 10.0), st("x", "1160-05-02", 50.0, 10.0), st("b", "1160-05-03", 45.1, 10.0)]
    )
    assert len(flags) == 2 and [o["uid"] for o in outliers] == ["x"], "a detour marks its middle point"

    report = build(source)
    c = report["counts"]
    assert sum(c["dating"].values()) == c["regesta"], "every regest has one dating class"
    assert c["inView"] + sum(c["missingFromView"].values()) == c["regesta"], "placed or missing with a reason"
    assert sum(c["flaggedByClass"].values()) == c["flagged"]
    print("check passed", {k: c[k] for k in ("regesta", "inView", "flagged")})


def main() -> None:
    here = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--source", type=Path, default=here.parent / "regesta-rdf-demo")
    parser.add_argument("--out", type=Path, default=here / "data" / "itinerary-checks.json")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.check:
        _check(args.source)
        return
    report = build(args.source)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    c = report["counts"]
    print(f"{c['regesta']} regesta, dating {c['dating']}")
    print(f"spans {c['spanDays']}")
    print(f"in view {c['inView']}, missing {c['missingFromView']}")
    print(f"threshold max({FLOOR_KM:.0f} km, {KM_PER_DAY:.0f} km x days), an assumption")
    print(f"{c['flagged']} of {c['pairs']} pairs flagged: {c['flaggedByClass']}; {c['outliers']} detours")
    print(f"indicator hits in all regesta {c['indicatorHits']}, in flagged {c['indicatorHitsInFlagged']}")
    print(f"written {args.out}")


if __name__ == "__main__":
    main()
