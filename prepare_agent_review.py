"""Reader input for the agent review: per regest its text, per statement its complete Turtle.

The statement is cut from the run's revised Turtle (the authoritative form, `runs/<run>/revised/
<uid>.ttl` in the source repository): the factoid with every triple it carries, its references
and its blank nodes, so qualifiers, exceptions and grounds stand as in the data. A first round
on 2026-11-14 built the input from the edition JSON, whose literal lines carry no Turtle, and
dropped 24 literals; its answers are kept under round1-incomplete-input/ and not used. Comments
in the Turtle are the producing run's notes and do not reach the readers, since the subgraph is
serialised anew. Embedded acts the statement points to stay out; they are statements of their own.

Usage: python prepare_agent_review.py [--source pipeline] [--run factoid-1153-2026-11-11]
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from rdflib import BNode, Graph, Namespace, URIRef
from rdflib.namespace import RDF

HERE = Path(__file__).resolve().parent
RAW = HERE / "edition" / "agent-review-2026-11-14"
RF = Namespace("https://example.org/regesta/factoid/")


def _subgraph(g: Graph, factoid: URIRef) -> Graph:
    """The factoid, its references and blank nodes, without the acts it refers to."""
    out = Graph()
    for prefix, ns in g.namespaces():
        out.bind(prefix, ns, override=True)
    todo, seen = [factoid], set()
    while todo:
        node = todo.pop()
        if node in seen:
            continue
        seen.add(node)
        for p, o in g.predicate_objects(node):
            out.add((node, p, o))
            if isinstance(o, BNode) or (isinstance(o, URIRef) and (o, RDF.type, RF.Reference) in g):
                todo.append(o)
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--source", type=Path, default=HERE / "pipeline")
    parser.add_argument("--run", default="factoid-1153-2026-11-11")
    args = parser.parse_args()
    revised = args.source / "runs" / args.run / "revised"
    texts = {
        r["uid"]: r["text"]
        for r in json.loads((HERE / "site" / "ansicht" / "data" / "edition.json").read_text(encoding="utf-8"))[
            "regests"
        ]
    }
    for part in ("part1", "part2"):
        path = RAW / f"input-{part}.json"
        items = json.loads(path.read_text(encoding="utf-8"))
        for item in items:
            if item["text"] != texts[item["uid"]]:
                print(f"{item['identifier']}: regest text differs from the built edition", file=sys.stderr)
                return 1
            g = Graph().parse(revised / f"{item['uid']}.ttl", format="turtle")
            for st in item["statements"]:
                iri = URIRef(f"urn:regesta:{item['uid']}:{st['id']}")
                if (iri, RDF.type, None) not in g:
                    print(f"{item['identifier']} {st['id']}: not in the revised Turtle", file=sys.stderr)
                    return 1
                st["turtle"] = _subgraph(g, iri).serialize(format="turtle").strip()
        path.write_text(json.dumps(items, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        print(f"wrote {path.name}: {sum(len(i['statements']) for i in items)} statements")
    return 0


if __name__ == "__main__":
    sys.exit(main())
