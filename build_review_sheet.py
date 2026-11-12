"""Choose twenty regesta for the operator's own review and write the data of the review sheet.

Regime: single script of the pipeline, standard library only.

Data flow: the edition data of the run (site/ansicht/data/edition.json, written by
build_site.py) and the relation families of js/relations.js -> a stratified, deterministic
choice of twenty regesta -> pruefbogen/data/sheet.json, read by the local page pruefbogen/.

Usage:
    python build_review_sheet.py [--edition site/ansicht/data/edition.json]

Design decisions, after the operator's decision of 2026-11-12 that he checks twenty regesta
against their statements himself (knowledge/plan.md, Review sheet):
- Review state of a regest, by the first that applies: no statement in scope ("keine
  Aussage"), corrected after adjudication ("korrigiert"), review findings with the statements
  kept ("beibehalten"), no review finding ("ohne Befund").
- The Adela case (RI IV,2,1 n. 46 and n. 167) is always in. The other eighteen follow
  QUOTA per state; inside a state the next regest is the one whose main family is least
  covered so far, ties broken by a stable hash of the uid, so no hand picks a regest.
- Regesta with more than MAX_STATEMENTS statements stay out, so one sheet stays a sitting.
- The sheet freezes the statements as shown, with their ids, so a returned file can be
  matched even after a rebuild.
"""

import argparse
import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "pruefbogen" / "data" / "sheet.json"
CASE = ("RI IV,2,1 n. 46", "RI IV,2,1 n. 167")
QUOTA = {"korrigiert": 6, "beibehalten": 5, "ohne Befund": 5, "keine Aussage": 2}
MAX_STATEMENTS = 6
STATE_TIP = {
    "korrigiert": "nach dem Review korrigiert",
    "beibehalten": "Befund im Review, Aussagen beibehalten",
    "ohne Befund": "ohne Befund im Review",
    "keine Aussage": "keine Aussage im Rahmen des Laufs",
}


class SheetError(Exception):
    """A violated input contract; the message names the step."""


def _families() -> tuple[dict[str, str], dict[str, str]]:
    """Type -> family key and key -> label, read from js/relations.js (the one definition)."""
    source = (HERE / "js" / "relations.js").read_text(encoding="utf-8")
    by_type: dict[str, str] = {}
    labels: dict[str, str] = {}
    for key, label, types in re.findall(r'key: "(\w+)".*?label: "([^"]+)".*?types: \[([^\]]*)\]', source):
        labels[key] = label
        for t in re.findall(r'"([^"]+)"', types):
            by_type[t] = key
    if len(labels) != 8:
        raise SheetError(f"js/relations.js: expected eight families, read {len(labels)}")
    return by_type, labels


def _state(r: dict) -> str:
    if r["status"] == "no_in_scope_claim":
        return "keine Aussage"
    if r["notes"].get("corrections"):
        return "korrigiert"
    if r["history"].get("findings"):
        return "beibehalten"
    return "ohne Befund"


def _main_family(r: dict, by_type: dict[str, str]) -> str | None:
    counts = Counter(by_type.get(b["title"], "order") for b in r["blocks"])
    return counts.most_common(1)[0][0] if counts else None


def _stable(uid: str) -> str:
    return hashlib.sha256(f"pruefbogen-2026-11-12:{uid}".encode()).hexdigest()


def _statement(block: dict) -> dict:
    people = [
        f"{ln['phrase']} ({ln['role']})" if ln.get("role") else ln["phrase"]
        for ln in block.get("lines", [])
        if ln.get("phrase")
    ]
    return {
        "id": block["head"]["id"],
        "kind": block["title"],
        "who": ", ".join(people) or "ohne genannte Beteiligte",
        "evidence": block["head"].get("evidence"),
    }


def choose(regests: list[dict], by_type: dict[str, str]) -> list[tuple[dict, str]]:
    by_id = {r["identifier"]: r for r in regests}
    missing = [c for c in CASE if c not in by_id]
    if missing:
        raise SheetError(f"the case regesta are missing from the edition data: {missing}")
    chosen = [(by_id[c], "Fall Adela: zwei Väter gleichen Namens") for c in CASE]
    covered = Counter(_main_family(r, by_type) for r, _ in chosen)
    taken = {r["uid"] for r, _ in chosen}
    for state, quota in QUOTA.items():
        pool = [
            r for r in regests if r["uid"] not in taken and _state(r) == state and len(r["blocks"]) <= MAX_STATEMENTS
        ]
        for _ in range(quota):
            if not pool:
                raise SheetError(f"not enough regesta in the state {state}")
            pool.sort(key=lambda r: (covered[_main_family(r, by_type)], _stable(r["uid"])))
            pick = pool.pop(0)
            chosen.append((pick, ""))
            covered[_main_family(pick, by_type)] += 1
            taken.add(pick["uid"])
    return sorted(chosen, key=lambda pair: pair[0]["sort"])


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    parser.add_argument("--edition", type=Path, default=HERE / "site" / "ansicht" / "data" / "edition.json")
    args = parser.parse_args()
    try:
        if not args.edition.is_file():
            raise SheetError(f"{args.edition} is missing; run build_site.py first")
        edition = json.loads(args.edition.read_text(encoding="utf-8"))
        by_type, labels = _families()
        chosen = choose(edition["regests"], by_type)
    except SheetError as error:
        print(error, file=sys.stderr)
        return 1
    items = []
    for r, reason in chosen:
        family = _main_family(r, by_type)
        state = _state(r)
        items.append(
            {
                "uid": r["uid"],
                "identifier": r["identifier"],
                "date": "".join(seg["t"] for seg in r["date"]),
                "text": r["text"],
                "spans": r["spans"],
                "state": state,
                "stateTip": STATE_TIP[state],
                "family": labels.get(family) if family else None,
                "reason": reason or f"{STATE_TIP[state]}, {labels[family] if family else 'ohne Aussage'}",
                "statements": [_statement(b) for b in r["blocks"]],
            }
        )
    sheet = {
        "sheet": "pruefbogen-2026-11-12",
        "run": "factoid-1153-2026-11-11",
        "selection": "Fall Adela fest, dann je Prüfstand "
        + ", ".join(f"{n} {s}" for s, n in QUOTA.items())
        + f"; innerhalb eines Prüfstands die bisher am wenigsten vertretene Aussagefamilie, sonst ein fester Hash; höchstens {MAX_STATEMENTS} Aussagen je Regest.",
        "items": items,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(sheet, ensure_ascii=False, indent=1), encoding="utf-8", newline="\n")
    print(f"{len(items)} regesta, {sum(len(i['statements']) for i in items)} statements -> {OUT}")
    for i in items:
        print(f"  {i['identifier']:22s} {i['state']:14s} {len(i['statements'])} {i['family']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
