"""Short nominative names of persons from the register of the Regesta Imperii, one rule for all.

Imported by build_data.py (graph nodes of the run) and build_holdings.py (persons of the
whole delivery), so the network, the time band and the person pages say the same name.

The register writes name variants before "//" and a description after it, for example
"Heinrich, Henricus // der Löwe, Herzog von Bayern und Sachsen". The short name is the first
variant joined with the first clause of the description ("Heinrich der Löwe"). Rules, after
the operator's and the Research Coordination's findings of 2026-11-12 (agents' inflected
forms in the network, damaged and duplicate names in the time band):
- Cross references and asides are cut: everything after ";" ("zu ihm siehe auch oben in der
  Einleitung"), "irrtümlich: ..." and the register's own HTML.
- An ordinal ("(I.)", "VI.") joins with a space, and a short byname after it is kept
  ("Friedrich I. Barbarossa"); a clause starting lower case joins with a space ("Heinrich der
  Löwe"), any other with a comma ("Eberhard, Bischof von Bamberg").
- A second "//" opens a sub-entry of the person: the people around them ("Friedrich I. //
  Amtsträger, Bote, Gesandter", "// Kinder", "// Anhänger"). Such an entry is named by its
  first clause with the person in brackets ("Kinder (Friedrich I. Barbarossa)"); the old rule
  gave it the person's own name, which read as the same person twice in the time band.
- Names that coincide among the persons a view shows are lengthened by one clause ("Heinrich
  II." stands for seven persons of the register).
- Where the register leaves the head name empty and gives only Latin variants, LATIN_HEADS
  supplies the German head ("Fredericus" -> "Friedrich"); deliberate shortcut for the seven
  entries the register writes so, to be replaced if the register delivery gains the head rows.
"""

from __future__ import annotations

import csv
import html
import re
from collections import Counter, defaultdict
from pathlib import Path

LATIN_HEADS = {"Fredericus": "Friedrich"}
_ORDINAL = re.compile(r"^\(?[IVXL]+\.(\)|\s|$)")
_TITLES = {
    "König",
    "Kaiser",
    "Herzog",
    "Graf",
    "Markgraf",
    "Pfalzgraf",
    "Landgraf",
    "Papst",
    "Bischof",
    "Erzbischof",
    "Abt",
    "Propst",
    "Prinz",
    "Fürst",
    "Kardinal",
    "Patriarch",
}


def plain_text(raw: str) -> str:
    """Register markup as plain text with collapsed whitespace."""
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", raw))).strip()


def _clauses(text: str) -> list[str]:
    """Top-level comma clauses, keeping commas inside parentheses."""
    return [c.strip() for c in re.split(r",\s*(?![^()]*\))", text) if c.strip()]


def _clean_description(text: str, asides: bool = False) -> str:
    text = text.split(";", 1)[0]
    # Long bracketed asides ("(aus dem Hause der Grafen von Spitzenberg-Helfenstein)") are
    # commentary, not name; the last lengthening step keeps them, since some carry the only
    # difference ("der Ältere", "der Jüngere").
    if not asides:
        text = re.sub(r"\s*\([^()]{30,}\)", "", text)
    text = re.sub(r",?\s*irrtümlich:[^,)]*", "", text)
    text = re.sub(r"\(\s*\)", "", text)
    return text.strip(" ,")


def _join(name: str, clause: str) -> str:
    if not name or clause.split(" ")[0] == name:
        return clause
    if _ORDINAL.match(clause):
        ordinal, _, rest = clause.partition(" ")
        return f"{name} {ordinal.strip('()')}" + (f" {rest}" if rest else "")
    if clause[0].islower() or clause[0] == "(":
        return f"{name} {clause}"
    return f"{name}, {clause}"


def _candidates(row: dict, heads: dict[str, str]) -> list[str]:
    """Names from shortest to longest for one register row."""
    label = plain_text(row["label"])
    if "//" not in label:
        parts = _clauses(_clean_description(label))
        return [", ".join(parts[: n + 1]) for n in range(min(3, len(parts)))] or [label]
    names, description = (p.strip() for p in label.split("//", 1))
    description, _, sub = description.partition("//")
    # A place as head ("Cremona (am Po, ital. Prov.-Hptst.)") is named without its bracket.
    variants = [v.strip() for v in re.sub(r"\s*\(.*?\)", "", names).split(",") if v.strip()]
    name = variants[0] if variants and not names.startswith(",") else heads.get(row["parentId"], "")
    if not name and variants:
        name = LATIN_HEADS.get(variants[0], variants[0])
    name = re.sub(r"(?<=\w)\(\w+\)$", "", name)
    parts = _clauses(_clean_description(description))
    if not parts:
        return [name]
    first = _join(name, parts[0])
    rest = parts[1:]
    # A short byname after an ordinal belongs to the name ("Friedrich I. Barbarossa"), a title
    # does not ("Konrad III., König" comes from lengthening only).
    if (
        _ORDINAL.match(parts[0])
        and rest
        and re.fullmatch(r"[A-ZÄÖÜ][\wäöüß-]{2,14}", rest[0])
        and rest[0] not in _TITLES
    ):
        first, rest = f"{first} {rest[0]}", rest[1:]
    # A siglum alone names no one: "Rainald G" becomes "Rainald G, Notar der Reichskanzlei".
    elif len(parts[0]) <= 3 and not _ORDINAL.match(parts[0]) and rest:
        first, rest = f"{name} {parts[0]}, {rest[0]}", rest[1:]
    if sub.strip():
        group = _clauses(_clean_description(sub.strip()))[0]
        return [f"{group} ({first})"]
    out = [first]
    for clause in rest[:2]:
        out.append(f"{out[-1]}, {clause}")
    full = _join(name, _clean_description(description, asides=True))
    if full not in out:
        out.append(full)
    return out


def _read(csv_path: Path) -> tuple[dict[str, list[str]], dict[str, str]]:
    """Name candidates and plain full label per person id."""
    with csv_path.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle, escapechar="\\", strict=True))
    # The head name of an entry whose own row omits it: the most frequent first variant of
    # its siblings.
    counts: dict[str, Counter] = defaultdict(Counter)
    for row in rows:
        label = plain_text(row["label"])
        if "//" in label and not label.startswith(","):
            counts[row["parentId"]][label.split("//", 1)[0].split(",", 1)[0].strip()] += 1
    heads = {parent: c.most_common(1)[0][0] for parent, c in counts.items()}
    candidates: dict[str, list[str]] = {}
    full: dict[str, str] = {}
    for row in rows:
        if row.get("type") == "person" and row["id"] not in candidates:
            candidates[row["id"]] = _candidates(row, heads)
            full[row["id"]] = plain_text(row["label"])
    return candidates, full


def register_names(csv_path: Path, shown: set[str] | None = None) -> dict[str, str]:
    """Register id -> short name. A name is lengthened clause by clause, at most twice, where it
    coincides with the name of another person among `shown` (all register persons when None)."""
    candidates, _ = _read(csv_path)
    pool = set(candidates) if shown is None else shown & set(candidates)
    level = dict.fromkeys(candidates, 0)
    pick = lambda pid: candidates[pid][min(level[pid], len(candidates[pid]) - 1)]  # noqa: E731
    for _ in range(3):
        clash = Counter(pick(pid) for pid in pool)
        for pid in pool:
            if clash[pick(pid)] > 1:
                level[pid] += 1
    return {pid: pick(pid) for pid in candidates}
