# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Explore the supplied Barbarossa regesta and index exports.

This standalone standard-library script reads immutable CSV inputs, profiles their
schema, audits identifiers and dates, joins index occurrences to regesta, and writes
deterministic JSON/CSV research artefacts. Run with --input-dir source-material
--output-dir generated. --force permits replacement of this script's outputs.
The input dialect uses backslash-escaped quotes, established from the supplied
files. Historical readings and role meanings remain editorial responsibilities.
The script performs no network, LLM, RDF conversion, publication or Git operation.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
from collections import Counter, defaultdict
from datetime import date
from html.parser import HTMLParser
from pathlib import Path
from statistics import median
from typing import Any

REGESTA_FILE = "RI_004-002-ReggBarbarossa.csv"
INDEX_FILE = "RI_004-002-RegisterBarbarossa.csv"
NULLS = frozenset({"", "null"})
TEXT_FIELDS = ("summary", "archival_history", "commentary", "external_links")
CANONICAL_TYPES = frozenset({"person", "ort", "sache", "ereignis"})


class _PlainText(HTMLParser):
    """Read inherited markup as text without executing it or fetching references."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"br", "p", "li", "div"}:
            self.parts.append(" ")

    def handle_endtag(self, tag: str) -> None:
        if tag in {"p", "li", "div"}:
            self.parts.append(" ")


def _plain(value: str) -> str:
    parser = _PlainText()
    parser.feed(value)
    parser.close()
    return " ".join("".join(parser.parts).split())


def _present(value: str) -> bool:
    return value.strip().lower() not in NULLS


def _atomic_text(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(text, encoding="utf-8", newline="\n")
    temporary.replace(path)


def _json(path: Path, value: Any) -> None:
    _atomic_text(
        path, json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n"
    )


def _csv(path: Path, fields: list[str], rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    with temporary.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    temporary.replace(path)


def _counter_rows(counter: Counter[str], field: str) -> list[dict[str, Any]]:
    return [
        {field: key, "count": count}
        for key, count in sorted(counter.items(), key=lambda item: (-item[1], item[0]))
    ]


def _read(
    path: Path, required: set[str]
) -> tuple[list[dict[str, str]], dict[str, Any]]:
    """Reject structural CSV errors and retain both physical and logical row addresses."""
    raw = path.read_bytes()
    text = raw.decode("utf-8-sig")
    follows = Counter(re.findall(r"\\(.)", text))
    if any(character != '"' for character in follows):
        raise ValueError(
            f"{path.name}: unexpected backslash escape; review the input dialect"
        )
    with path.open(encoding="utf-8-sig", newline="") as stream:
        reader = csv.reader(
            stream, delimiter=",", quotechar='"', escapechar="\\", strict=True
        )
        header = next(reader)
        if len(header) != len(set(header)) or not required <= set(header):
            raise ValueError(
                f"{path.name}: missing or duplicate header; inspect the supplied export"
            )
        rows = []
        previous_line = reader.line_num
        for record_number, values in enumerate(reader, start=2):
            first_line = previous_line + 1
            previous_line = reader.line_num
            if len(values) != len(header):
                raise ValueError(
                    f"{path.name}, logical row {record_number}: expected {len(header)} fields, got {len(values)}"
                )
            rows.append(
                dict(zip(header, values, strict=True))
                | {
                    "_csv_row": str(record_number),
                    "_physical_start": str(first_line),
                    "_physical_end": str(reader.line_num),
                }
            )
    with path.open(encoding="utf-8-sig", newline="") as stream:
        naive_widths = Counter(len(row) for row in csv.reader(stream))
    profile = {
        "filename": path.name,
        "sha256": hashlib.sha256(raw).hexdigest(),
        "bytes": len(raw),
        "encoding": "utf-8-sig" if raw.startswith(b"\xef\xbb\xbf") else "utf-8",
        "delimiter": ",",
        "quotechar": '"',
        "escapechar": "\\",
        "rows": len(rows),
        "columns": header,
        "default_parser_widths_including_header": dict(sorted(naive_widths.items())),
        "backslash_escaped_quotes": follows.get('"', 0),
        "duplicate_full_rows": sum(
            count - 1
            for count in Counter(
                tuple(row[key] for key in header) for row in rows
            ).values()
        ),
    }
    return rows, profile


def _column_profile(
    rows: list[dict[str, str]], header: list[str]
) -> list[dict[str, Any]]:
    return [
        {
            "column": key,
            "populated": sum(_present(row[key]) for row in rows),
            "empty_string": sum(not row[key].strip() for row in rows),
            "literal_null": sum(row[key].strip().lower() == "null" for row in rows),
            "unique_populated": len({row[key] for row in rows if _present(row[key])}),
            "markup_rows": sum(bool(re.search(r"<[^>]+>", row[key])) for row in rows),
            "min_characters": min(
                (len(row[key]) for row in rows if _present(row[key])), default=0
            ),
            "median_characters": median(
                [len(row[key]) for row in rows if _present(row[key])]
            )
            if any(_present(row[key]) for row in rows)
            else 0,
            "max_characters": max(
                (len(row[key]) for row in rows if _present(row[key])), default=0
            ),
        }
        for key in header
    ]


def _date_audit(
    rows: list[dict[str, str]],
) -> tuple[dict[str, Any], list[dict[str, Any]], Counter[str]]:
    issues: list[dict[str, Any]] = []
    years: Counter[str] = Counter()
    durations: Counter[str] = Counter()
    boundaries = []
    for row in rows:
        parsed = {}
        reasons = []
        for key in ("start_date", "end_date"):
            if _present(row[key]):
                try:
                    parsed[key] = date.fromisoformat(row[key])
                except ValueError:
                    reasons.append(f"invalid_{key}")
            else:
                reasons.append(f"missing_{key}")
        if "start_date" in parsed:
            years[str(parsed["start_date"].year)] += 1
            boundaries.append(parsed["start_date"].isoformat())
        if len(parsed) == 2:
            span = (parsed["end_date"] - parsed["start_date"]).days
            durations[str(span)] += 1
            boundaries.append(parsed["end_date"].isoformat())
            if span < 0:
                reasons.append("reversed_interval")
            explicit_years = set(
                re.findall(r"(?<!\d)(1\d{3})(?!\d|er)", row["date_string"])
            )
            relative_or_short_range = re.search(
                r"^\W*(?:vor|nach|um)\b|1\d{3}\s*[/\u2013-]\s*\d{2,4}",
                row["date_string"],
            )
            if (
                len(explicit_years) == 1
                and parsed["start_date"].year == parsed["end_date"].year
                and str(parsed["start_date"].year) not in explicit_years
                and not relative_or_short_range
            ):
                reasons.append("prose_year_review_candidate")
        if reasons:
            issues.append(
                {
                    "source_row": row["_csv_row"],
                    "identifier": row["identifier"],
                    "start_date": row["start_date"],
                    "end_date": row["end_date"],
                    "date_string": row["date_string"],
                    "findings": "|".join(reasons),
                }
            )
    return (
        {
            "earliest_boundary": min(boundaries, default=None),
            "latest_boundary": max(boundaries, default=None),
            "interval_duration_days": _counter_rows(durations, "days"),
            "finding_counts": dict(
                Counter(
                    reason
                    for issue in issues
                    for reason in issue["findings"].split("|")
                )
            ),
            "interpretation": "Intervals and start-year counts describe exported dating fields, not proven event dates or archival completeness.",
        },
        issues,
        years,
    )


def _join_and_entities(
    regesta: list[dict[str, str]], index: list[dict[str, str]]
) -> tuple[dict[str, Any], dict[str, Any]]:
    by_regest: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in regesta:
        by_regest[row["identifier"]].append(row)
    by_entity: dict[str, list[dict[str, str]]] = defaultdict(list)
    related: dict[str, list[dict[str, str]]] = defaultdict(list)
    joins = []
    occurrences = []
    status_counts: Counter[str] = Counter()
    for row in index:
        by_entity[row["id"]].append(row)
        matches = by_regest.get(row["regestaIdentifier"], [])
        status = (
            "matched"
            if len(matches) == 1
            else "unmatched"
            if not matches
            else "ambiguous"
        )
        status_counts[status] += 1
        if status != "matched":
            joins.append(
                {
                    "source_row": row["_csv_row"],
                    "id": row["id"],
                    "regestaIdentifier": row["regestaIdentifier"],
                    "status": status,
                }
            )
        else:
            related[row["regestaIdentifier"]].append(row)
        occurrences.append(
            {
                "source_file": INDEX_FILE,
                "source_row": int(row["_csv_row"]),
                "entity_id": row["id"],
                "parent_id": row["parentId"] if _present(row["parentId"]) else None,
                "regesta_identifier": row["regestaIdentifier"],
                "type": row["type"],
                "roles_raw": row["role"],
                "role_tokens": row["role"].split() if _present(row["role"]) else [],
                "join_status": status,
            }
        )
    entities, conflicts, geo_issues = [], [], []
    compared_fields = (
        "label",
        "origLabel",
        "parentId",
        "type",
        "lat",
        "long",
        "geonames",
        "wikidataId",
    )
    for entity_id, rows in sorted(by_entity.items()):
        alternatives = {
            key: sorted({row[key] for row in rows if _present(row[key])})
            for key in compared_fields
        }
        for key, values in alternatives.items():
            if len(values) > 1:
                conflicts.append(
                    {
                        "id": entity_id,
                        "field": key,
                        "values": json.dumps(values, ensure_ascii=False),
                    }
                )
        entities.append(
            {
                "id": entity_id,
                "label": alternatives["label"][0]
                if len(alternatives["label"]) == 1
                else "",
                "types": "|".join(alternatives["type"]),
                "occurrences": len(rows),
                "distinct_regesta": len({row["regestaIdentifier"] for row in rows}),
                "matched_regesta": len(
                    {
                        row["regestaIdentifier"]
                        for row in rows
                        if row["regestaIdentifier"] in related
                    }
                ),
                "parent_ids": "|".join(alternatives["parentId"]),
                "geonames_ids": "|".join(alternatives["geonames"]),
                "wikidata_ids": "|".join(alternatives["wikidataId"]),
                "coordinate_pairs": json.dumps(
                    sorted(
                        {
                            (r["lat"], r["long"])
                            for r in rows
                            if _present(r["lat"]) and _present(r["long"])
                        }
                    )
                ),
            }
        )
        for row in rows:
            lat_present, lon_present = _present(row["lat"]), _present(row["long"])
            reason = ""
            if lat_present != lon_present:
                reason = "incomplete_coordinate_pair"
            elif lat_present:
                try:
                    lat, lon = float(row["lat"]), float(row["long"])
                    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                        reason = "coordinate_out_of_range"
                except ValueError:
                    reason = "non_numeric_coordinate"
            if reason:
                geo_issues.append(
                    {
                        "source_row": row["_csv_row"],
                        "id": entity_id,
                        "lat": row["lat"],
                        "long": row["long"],
                        "finding": reason,
                    }
                )
    per_regest = [
        {
            "identifier": row["identifier"],
            "source_row": row["_csv_row"],
            "occurrence_rows": len(related[row["identifier"]]),
            "distinct_entity_ids": len(
                {item["id"] for item in related[row["identifier"]]}
            ),
            **{
                f"distinct_{kind}_ids": len(
                    {
                        item["id"]
                        for item in related[row["identifier"]]
                        if item["type"] == kind
                    }
                )
                for kind in sorted(CANONICAL_TYPES)
            },
        }
        for row in regesta
    ]
    unresolved = [
        {"id": row["id"], "parent_ids": row["parent_ids"]}
        for row in entities
        if any(
            parent not in by_entity for parent in row["parent_ids"].split("|") if parent
        )
    ]
    combination_counts = Counter(
        (row["id"], row["regestaIdentifier"], row["role"]) for row in index
    )
    duplicate_links = [
        {"id": key[0], "regestaIdentifier": key[1], "role": key[2], "rows": count}
        for key, count in sorted(combination_counts.items())
        if count > 1
    ]
    checks = {
        "index_occurrences": len(index),
        "entity_ids": len(by_entity),
        "join_status": {
            status: status_counts[status]
            for status in ("matched", "unmatched", "ambiguous")
        },
        "regesta_with_index_rows": sum(bool(rows) for rows in related.values()),
        "regesta_without_index_rows": sum(
            not related[row["identifier"]] for row in regesta
        ),
        "entity_field_conflicts": len(conflicts),
        "coordinate_findings": len(geo_issues),
        "entities_with_coordinate_findings": len({row["id"] for row in geo_issues}),
        "unresolved_parent_entities": len(unresolved),
        "distinct_unresolved_parent_ids": len(
            {
                parent
                for row in entities
                for parent in row["parent_ids"].split("|")
                if parent and parent not in by_entity
            }
        ),
        "repeated_entity_regest_role_groups": len(duplicate_links),
        "types": dict(Counter(row["type"] for row in index)),
        "entity_types": dict(
            Counter(
                "|".join(sorted({row["type"] for row in rows}))
                for rows in by_entity.values()
            )
        ),
        "role_combinations": dict(Counter(row["role"] for row in index)),
        "role_tokens": dict(
            Counter(
                token
                for row in index
                if _present(row["role"])
                for token in row["role"].split()
            )
        ),
        "noncanonical_type_values": sorted(
            {
                row["type"]
                for row in index
                if _present(row["type"]) and row["type"] not in CANONICAL_TYPES
            }
        ),
        "entity_coverage": {
            key: sum(
                any(_present(row[key]) for row in rows) for rows in by_entity.values()
            )
            for key in ("lat", "long", "geonames", "wikidataId", "parentId")
        },
    }
    artefacts = {
        "entities": entities,
        "occurrences": occurrences,
        "join_issues": joins,
        "entity_conflicts": conflicts,
        "coordinate_issues": geo_issues,
        "unresolved_parents": unresolved,
        "duplicate_links": duplicate_links,
        "per_regest": per_regest,
    }
    return checks, artefacts


def _reference_audit(
    regesta: list[dict[str, str]], index: list[dict[str, str]]
) -> tuple[dict[str, Any], list[dict[str, Any]], list[dict[str, Any]]]:
    exchange_ids = {row["exchange_identifier"] for row in regesta}
    links = []
    for row in regesta:
        for field in TEXT_FIELDS:
            for match in re.finditer(
                r"<link\s+([^\s>]+)", row[field], flags=re.IGNORECASE
            ):
                target = match.group(1).strip("\"'")
                internal = target.startswith("riregesten:")
                present = target.removeprefix("riregesten:") in exchange_ids
                links.append(
                    {
                        "source_row": row["_csv_row"],
                        "identifier": row["identifier"],
                        "field": field,
                        "target": target,
                        "kind": "internal_regest" if internal else "external_reference",
                        "scope_check": (
                            "in_supplied_regesta"
                            if present
                            else "outside_supplied_regesta"
                        )
                        if internal
                        else "not_fetched",
                    }
                )
    normdata_issues = []
    for row in index:
        for field, pattern in (("geonames", r"\d+"), ("wikidataId", r"Q\d+")):
            if _present(row[field]) and not re.fullmatch(pattern, row[field]):
                normdata_issues.append(
                    {
                        "source_row": row["_csv_row"],
                        "id": row["id"],
                        "field": field,
                        "value": row[field],
                        "finding": "noncanonical_identifier_syntax",
                    }
                )
    return (
        {
            "links": dict(Counter(row["kind"] for row in links)),
            "internal_reference_scope": dict(
                Counter(
                    row["scope_check"]
                    for row in links
                    if row["kind"] == "internal_regest"
                )
            ),
            "noncanonical_normdata_occurrences": len(normdata_issues),
            "external_references": "Recorded only; no external URL, geocoder or identifier was fetched.",
        },
        links,
        normdata_issues,
    )


def _snapshot(output: Path, report: dict[str, Any]) -> None:
    """Keep numerical snapshot results out of the maintained material document."""
    joins, dates = report["index_and_join"], report["dates"]
    lines = [
        "# Exploration snapshot",
        "",
        "Computed from the supplied files on 2026-11-09. Counts refer to export records and index occurrences. They are not historical population or event counts.",
        "",
        "## Source fingerprints",
        "",
        "| File | Rows | Columns | SHA-256 |",
        "|---|---:|---:|---|",
    ]
    for item in report["inputs"]:
        lines.append(
            f"| {item['filename']} | {item['rows']} | {len(item['columns'])} | {item['sha256']} |"
        )
    lines += [
        "",
        "## Counting units and join",
        "",
        f"- Distinct index entity IDs: {joins['entity_ids']}.",
        f"- Exact, unambiguous joined index rows: {joins['join_status']['matched']}.",
        f"- Ambiguous index rows: {joins['join_status']['ambiguous']}.",
        f"- Unmatched index rows: {joins['join_status']['unmatched']}.",
        f"- Regesta records with unambiguous index rows: {joins['regesta_with_index_rows']}.",
        f"- Regesta records without unambiguous index rows: {joins['regesta_without_index_rows']}.",
        f"- Child entity IDs whose parent does not occur as an entity ID in this export: {joins['unresolved_parent_entities']}.",
        f"- Repeated entity-regest-role groups: {joins['repeated_entity_regest_role_groups']}.",
        "",
        "## Dating and coordinate review",
        "",
        f"- Exported date-boundary range: {dates['earliest_boundary']} to {dates['latest_boundary']}.",
        f"- Date review findings: {json.dumps(dates['finding_counts'], sort_keys=True)}.",
        f"- Coordinate findings at occurrence level: {joins['coordinate_findings']}.",
        "- Prose-year candidates use a limited lexical heuristic. Relative dates and abbreviated ranges are excluded where recognised; every candidate still needs source review.",
        "- Coordinate validity checks syntax and numeric range, not historical location or geocoding accuracy.",
        "",
        "## Measured distributions",
        "",
    ]
    for filename, label in (
        ("index-types.csv", "Index occurrence types"),
        ("index-role-tokens.csv", "Tokens from the delivered role field"),
        (
            "regesta-by-start-year.csv",
            "Regesta by exported start year, sorted by frequency",
        ),
        ("regesta-by-locality.csv", "Regesta by unnormalised locality string"),
        ("regesta-by-volume.csv", "Regesta by delivered volume key"),
    ):
        with (output / "aggregations" / filename).open(
            encoding="utf-8", newline=""
        ) as stream:
            rows = list(csv.DictReader(stream))
        lines += [f"### {label}", "", "| Value | Export rows |", "|---|---:|"]
        key = next(iter(rows[0]))
        for row in rows[:15]:
            value = row[key].replace("|", "\\|").replace("\n", " ")
            lines.append(f"| {value} | {row['count']} |")
        lines += [
            "",
            f"Complete table: [aggregations/{filename}](aggregations/{filename}).",
            "",
        ]
    lines += [
        "## Complete evidence",
        "",
        "Field completeness and text length distributions are in the two *-columns.csv tables. Entity counts and degree rankings use distinct supplied IDs, not labels. All quality findings are retained in the issue tables. Machine-readable totals and methods are in profile.json. Real teaching examples are in teaching-examples.json.",
        "",
        "The export contains an editorially selective index. Frequency ranks and shared regesta do not establish historical importance, direct interaction or a social relationship.",
    ]
    _atomic_text(output / "exploration-report.md", "\n".join(lines) + "\n")


def _write_outputs(
    output: Path,
    regesta: list[dict[str, str]],
    index: list[dict[str, str]],
    profiles: list[dict[str, Any]],
) -> dict[str, Any]:
    dates, date_issues, years = _date_audit(regesta)
    joins, artefacts = _join_and_entities(regesta, index)
    references, links, normdata_issues = _reference_audit(regesta, index)
    regest_ids = Counter(row["identifier"] for row in regesta)
    uid_counts = Counter(row["uid"] for row in regesta)
    quality = {
        "duplicate_regest_identifiers": {
            key: count for key, count in regest_ids.items() if count > 1
        },
        "duplicate_regest_uids": {
            key: count for key, count in uid_counts.items() if count > 1
        },
        "urn_equals_persistent_identifier": sum(
            row["urn"] == row["persistent_identifier"] for row in regesta
        ),
        "title_values": dict(Counter(row["title"] for row in regesta)),
        "regesta_with_summary": sum(_present(row["summary"]) for row in regesta),
    }
    report = {
        "schema_version": "1",
        "inputs": profiles,
        "regesta_quality": quality,
        "dates": dates,
        "index_and_join": joins,
        "references": references,
    }
    for rows, profile in zip((regesta, index), profiles, strict=True):
        _csv(
            output / "aggregations" / f"{profile['filename'][:-4]}-columns.csv",
            [
                "column",
                "populated",
                "empty_string",
                "literal_null",
                "unique_populated",
                "markup_rows",
                "min_characters",
                "median_characters",
                "max_characters",
            ],
            _column_profile(rows, profile["columns"]),
        )
    _json(output / "profile.json", report)
    tables = [
        (
            "regesta-by-start-year",
            ["start_year", "count"],
            _counter_rows(years, "start_year"),
        ),
        (
            "regesta-by-locality",
            ["locality_string", "count"],
            _counter_rows(
                Counter(row["locality_string"] for row in regesta), "locality_string"
            ),
        ),
        (
            "regesta-by-volume",
            ["bandpk", "count"],
            _counter_rows(Counter(row["bandpk"] for row in regesta), "bandpk"),
        ),
        (
            "index-types",
            ["type", "count"],
            _counter_rows(Counter(row["type"] for row in index), "type"),
        ),
        (
            "index-role-combinations",
            ["role", "count"],
            _counter_rows(Counter(row["role"] for row in index), "role"),
        ),
        (
            "index-role-tokens",
            ["role_token", "count"],
            _counter_rows(
                Counter(
                    token
                    for row in index
                    if _present(row["role"])
                    for token in row["role"].split()
                ),
                "role_token",
            ),
        ),
        (
            "date-issues",
            [
                "source_row",
                "identifier",
                "start_date",
                "end_date",
                "date_string",
                "findings",
            ],
            date_issues,
        ),
        (
            "join-issues",
            ["source_row", "id", "regestaIdentifier", "status"],
            artefacts["join_issues"],
        ),
        ("entity-conflicts", ["id", "field", "values"], artefacts["entity_conflicts"]),
        (
            "coordinate-issues",
            ["source_row", "id", "lat", "long", "finding"],
            artefacts["coordinate_issues"],
        ),
        ("unresolved-parents", ["id", "parent_ids"], artefacts["unresolved_parents"]),
        (
            "duplicate-entity-regest-roles",
            ["id", "regestaIdentifier", "role", "rows"],
            artefacts["duplicate_links"],
        ),
        (
            "regesta-index-coverage",
            [
                "identifier",
                "source_row",
                "occurrence_rows",
                "distinct_entity_ids",
                "distinct_ereignis_ids",
                "distinct_ort_ids",
                "distinct_person_ids",
                "distinct_sache_ids",
            ],
            artefacts["per_regest"],
        ),
        (
            "entities",
            [
                "id",
                "label",
                "types",
                "occurrences",
                "distinct_regesta",
                "matched_regesta",
                "parent_ids",
                "geonames_ids",
                "wikidata_ids",
                "coordinate_pairs",
            ],
            artefacts["entities"],
        ),
        (
            "source-references",
            ["source_row", "identifier", "field", "target", "kind", "scope_check"],
            links,
        ),
        (
            "normdata-issues",
            ["source_row", "id", "field", "value", "finding"],
            normdata_issues,
        ),
        (
            "regesta-identifier-collisions",
            ["source_row", "identifier", "uid", "persistent_identifier", "date_string"],
            [
                {
                    "source_row": row["_csv_row"],
                    **{
                        key: row[key]
                        for key in (
                            "identifier",
                            "uid",
                            "persistent_identifier",
                            "date_string",
                        )
                    },
                }
                for row in regesta
                if regest_ids[row["identifier"]] > 1
            ],
        ),
    ]
    for name, fields, rows in tables:
        _csv(output / "aggregations" / f"{name}.csv", fields, rows)
    selected = [
        {
            "source_file": REGESTA_FILE,
            "source_row": int(row["_csv_row"]),
            "identifier": row["identifier"],
            "uid": row["uid"],
            "persistent_identifier": row["persistent_identifier"],
            "start_date": row["start_date"],
            "end_date": row["end_date"],
            "date_string": row["date_string"],
            "locality_string": row["locality_string"],
            **{
                f"{key}_plain": _plain(row[key]) if _present(row[key]) else None
                for key in TEXT_FIELDS
            },
        }
        for row in regesta
    ]
    for name, rows in (
        ("regesta", selected),
        ("occurrences", artefacts["occurrences"]),
    ):
        _atomic_text(
            output / f"{name}.jsonl",
            "".join(
                json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n"
                for row in rows
            ),
        )
    degrees = sorted(
        artefacts["entities"], key=lambda row: (-row["distinct_regesta"], row["id"])
    )
    _csv(output / "aggregations" / "entities-by-regesta.csv", list(degrees[0]), degrees)
    _json(
        output / "teaching-examples.json",
        {
            "date_review": [
                row for row in date_issues if row["identifier"] == "RI IV,2,2 n. 103a"
            ],
            "escaping": [row for row in index if row["id"] == "RI004-002-K000373"],
            "regesta_samples": selected[:3],
            "caution": "These are actual input records. Historical interpretation and RDF mapping remain unvalidated.",
        },
    )
    _snapshot(output, report)
    return report


def _verify(report: dict[str, Any], output: Path) -> None:
    regesta_rows, index_rows = (item["rows"] for item in report["inputs"])
    joins = report["index_and_join"]
    if sum(joins["join_status"].values()) != index_rows:
        raise AssertionError("Join audit does not conserve index rows")
    with (output / "aggregations" / "regesta-index-coverage.csv").open(
        encoding="utf-8", newline=""
    ) as stream:
        coverage = list(csv.DictReader(stream))
    if len(coverage) != regesta_rows:
        raise AssertionError("Coverage table does not conserve regesta")
    if (
        joins["regesta_with_index_rows"] + joins["regesta_without_index_rows"]
        != regesta_rows
    ):
        raise AssertionError("Coverage summary does not reconcile with regesta")
    if sum(int(row["occurrence_rows"]) for row in coverage) != joins["join_status"].get(
        "matched", 0
    ):
        raise AssertionError("Coverage counts do not reconcile with the exact join")
    for name, expected in (("regesta", regesta_rows), ("occurrences", index_rows)):
        with (output / f"{name}.jsonl").open(encoding="utf-8") as stream:
            if sum(1 for _ in stream) != expected:
                raise AssertionError(f"{name}: derived records do not reconcile")


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-dir", type=Path, default=Path("source-material"))
    parser.add_argument("--output-dir", type=Path, default=Path("generated"))
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    inputs, output = args.input_dir.resolve(), args.output_dir.resolve()
    if output == inputs or output in inputs.parents or inputs in output.parents:
        parser.error("Input and output directories must be separate siblings")
    if output.exists() and any(output.iterdir()) and not args.force:
        parser.error("Outputs exist; inspect them or rerun with --force")
    csv.field_size_limit(20_000_000)
    print("[OK] Step 1: inspect bytes, CSV dialect and source fingerprints")
    regesta, regesta_profile = _read(
        inputs / REGESTA_FILE,
        {"identifier", "uid", "summary", "start_date", "end_date"},
    )
    index, index_profile = _read(
        inputs / INDEX_FILE, {"id", "parentId", "regestaIdentifier", "role", "type"}
    )
    print("[OK] Step 2: profile fields and preserve source-row addresses")
    print("[OK] Step 3: audit dating fields and textual year disagreements")
    print(
        "[OK] Step 4: distinguish entity identities, index occurrences and parent links"
    )
    print("[OK] Step 5: exact identifier join and separate counting units")
    report = _write_outputs(output, regesta, index, [regesta_profile, index_profile])
    _verify(report, output)
    print("[OK] Step 6: reconcile aggregates and derived record counts")
    print(
        f"[OK] Regesta: {len(regesta)}; index rows: {len(index)}; entity IDs: {report['index_and_join']['entity_ids']}"
    )
    print(f"[OK] Results: {output}")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, csv.Error, AssertionError) as error:
        print(f"[FEHLER] {error}", file=sys.stderr)
        raise SystemExit(1) from None
