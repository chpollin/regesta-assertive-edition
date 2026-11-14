"""Merge the two independent readers of the agent review into one result per statement.

The operator gave up checking the twenty selected regesta himself on 2026-11-14 and had the
statements evaluated by LLM-based agents instead (knowledge/data.md, Agent review). Two fresh
readers per statement, which saw the regest text, the statement's Turtle and the run's frozen
annotation guidelines, but not the producing run's reasoning, each gave a verdict, the passage
it rests on and one sentence of reason. Their raw answers stay as returned in
edition/agent-review-2026-11-14/; this script only joins them:

- the same verdict from both readers is the outcome;
- different verdicts make the statement „strittig“, and both readings are kept, unsettled.

It is agentic review: the result carries producer, model and date, and never a human status.
Every quoted passage must stand verbatim in the regest text, otherwise the merge aborts.

Usage: python build_agent_review.py
"""

from __future__ import annotations

import json
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
RAW = HERE / "edition" / "agent-review-2026-11-14"
OUT = HERE / "edition" / "agent-review-2026-11-14.json"
VERDICTS = ("stimmt", "stimmt nicht", "unklar")
PRODUCER = {
    "label": "zwei LLM-basierte Agenten, unabhängig",
    "kind": "agentic review",
    "model": "claude-opus-5-5",
    "date": "2026-11-14",
    "note": "Keine menschliche Verifikation. Die Leser sahen Regesttext, Aussage als Turtle und die Annotationsrichtlinien des Laufs, nicht die Begründungen des erzeugenden Laufs.",
}


def _load(path: Path) -> list | dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _norm(text: str) -> str:
    """Whitespace folded, so a reader's „Corvey ,“ still matches the source spacing."""
    return " ".join(text.split())


def main() -> int:
    errors: list[str] = []
    items = []
    for part in ("part1", "part2"):
        inputs = _load(RAW / f"input-{part}.json")
        readers = [{(x["uid"], x["id"]): x for x in _load(RAW / f"reader-{r}-{part}.json")} for r in ("a", "b")]
        for item in inputs:
            text = _norm(item["text"])
            statements = []
            for st in item["statements"]:
                key = (item["uid"], st["id"])
                answers = [r.get(key) for r in readers]
                if any(a is None for a in answers):
                    errors.append(f"{item['identifier']} {st['id']}: a reader gave no verdict")
                    continue
                for a in answers:
                    if a["verdict"] not in VERDICTS:
                        errors.append(f"{item['identifier']} {st['id']}: unknown verdict {a['verdict']!r}")
                    if _norm(a["passage"]) not in text:
                        errors.append(f"{item['identifier']} {st['id']}: passage not verbatim: {a['passage'][:60]}")
                verdicts = {a["verdict"] for a in answers}
                statements.append(
                    {
                        "id": st["id"],
                        "kind": st["kind"],
                        "outcome": answers[0]["verdict"] if len(verdicts) == 1 else "strittig",
                        "readers": [
                            {"verdict": a["verdict"], "passage": a["passage"], "reason": a["reason"]} for a in answers
                        ],
                    }
                )
            items.append({"uid": item["uid"], "identifier": item["identifier"], "statements": statements})
    if errors:
        print("agent review merge failed:\n" + "\n".join(errors), file=sys.stderr)
        return 1
    selection = _load(RAW / "selection.json")
    result = {
        "review": "agent-review-2026-11-14",
        "run": selection["run"],
        "selection": selection["selection"],
        "producer": PRODUCER,
        "items": items,
    }
    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    outcomes = Counter(st["outcome"] for it in items for st in it["statements"])
    print(f"wrote {OUT.name}: {sum(outcomes.values())} statements, {dict(outcomes)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
