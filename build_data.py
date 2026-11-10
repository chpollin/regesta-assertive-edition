# /// script
# requires-python = ">=3.11"
# dependencies = ["rdflib==7.6.0", "numpy"]
# ///
"""Build the JSON data of the assertive edition prototype from the regesta pilot run.

Regime: single-file script with inline dependencies. It reads one finished run of the
sibling repository regesta-rdf-demo and never writes there.

Data flow
    packets/<uid>.json            regest text, dating, locality, register candidates
    revised/<uid>.ttl             candidate RDF, one named graph per file
    validation/revised.json       technical result per record
    extracted/batch-*.json        notes of the extraction agents
    review/*.json, revised/*corrections*.json
                                  review findings, adjudication and corrections
    source CSVs                   ordering field, commentary and transmission (apparatus)
        -> data/edition.json      reading view and overview
        -> data/questions.json    named SPARQL questions, query text and executed result

Usage
    python build_data.py
    python build_data.py --source ../regesta-rdf-demo --run pilot-2026-11-09 --out data

Design decisions
- Every displayed statement comes from the run files. The script aborts when an
  evidence text or a quoted review passage that is shown as source wording does not
  occur verbatim in summary_plain.
- Statements are the E13 attribute assignments. Direct triples of the candidate
  projection without their own E13 are kept as visible lines that point to the evidence
  of their event classification, as the frozen annotation contract allows.
- The revised Turtle files are loaded into one rdflib Dataset, each file in its own
  named graph. Queries without GRAPH see the union, which is the merged graph. GRAPH
  patterns keep a label tied to the regest that gave it, because the same actor IRI
  carries different labels in different files.
- German display labels for the frozen English vocabulary are an interface translation
  kept in VOCAB_DE. The vocabulary term itself stays visible in the RDF view.
- Output is deterministic: queries carry ORDER BY, aggregation happens here in sorted
  order, and JSON is written with a fixed layout.
"""

from __future__ import annotations

import argparse
import csv
import html
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

import rdflib
from rdflib import RDF, RDFS, Dataset, Literal, URIRef

CRM = rdflib.Namespace("http://www.cidoc-crm.org/cidoc-crm/")
REG = rdflib.Namespace("https://example.org/regesta/ontology/")
VOC = rdflib.Namespace("https://example.org/regesta/vocab/")

PREFIXES = {
    "crm": str(CRM),
    "reg": str(REG),
    "v": str(VOC),
    "rdfs": str(RDFS),
}

SPARQL_PREFIXES = """PREFIX crm: <http://www.cidoc-crm.org/cidoc-crm/>
PREFIX reg: <https://example.org/regesta/ontology/>
PREFIX v: <https://example.org/regesta/vocab/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
"""

# Interface translation of the frozen vocabulary (ontology/vocabulary.ttl, English labels).
VOCAB_DE = {
    "Spouse": "Ehepartner",
    "Child": "Kind",
    "Parent": "Elternteil",
    "Grantor": "Verleihender",
    "Recipient": "Empfänger",
    "Beneficiary": "Begünstigter",
    "Petitioner": "Bittsteller",
    "Debtor": "Schuldner",
    "Creditor": "Gläubiger",
    "Payer": "Zahlender",
    "Payee": "Zahlungsempfänger",
    "Donor": "Schenker",
    "Buyer": "Käufer",
    "Seller": "Verkäufer",
    "Pledgor": "Verpfänder",
    "Pledgee": "Pfandnehmer",
    "Claimant": "Kläger",
    "Respondent": "Beklagter",
    "Judge": "Richter",
    "Witness": "Zeuge",
    "Mediator": "Vermittler",
    "Representative": "Vertreter",
    "Obligor": "Verpflichteter",
    "Officeholder": "Amtsträger",
    "Negotiator": "Verhandelnder",
    "Marriage": "Ehe",
    "RightHolding": "Rechtsinhaberschaft",
    "PaymentObligation": "Zahlungspflicht",
    "FeudalRelationship": "Lehnsverhältnis",
    "ProtectionRelationship": "Schutzverhältnis",
    "MarriageConclusion": "Eheschließung",
    "MarriageDissolution": "Eheauflösung",
    "RightGrant": "Rechtsverleihung",
    "RightConfirmation": "Rechtsbestätigung",
    "Dispute": "Streit",
    "Judgment": "Urteil",
    "Donation": "Schenkung",
    "Sale": "Verkauf",
    "Pledge": "Verpfändung",
    "Payment": "Zahlung",
    "DebtRelease": "Schuldenerlass",
    "Restitution": "Rückerstattung",
    "Revocation": "Widerruf",
    "Negotiation": "Verhandlung",
    "LegalEnactment": "Rechtssetzung",
    "Appointment": "Einsetzung",
    "ProtectionGrant": "Schutzverleihung",
    "Communication": "Mitteilung",
    "MintingRight": "Münzrecht",
    "TollRight": "Zollrecht",
    "MarketRight": "Marktrecht",
    "JurisdictionRight": "Gerichtsrecht",
    "AdvocacyRight": "Vogteirecht",
    "InvestitureRight": "Investiturrecht",
    "InheritanceRight": "Erbrecht",
    "ProtectionRight": "Schutzrecht",
}

NODE_CLASSES = (
    CRM.E5_Event,
    CRM.E7_Activity,
    REG.RelationshipState,
    CRM.E30_Right,
    CRM.E18_Physical_Thing,
)
LITERAL_KINDS = {CRM.P3_has_note: "Vermerk", REG.condition: "Bedingung", REG.exception: "Ausnahme"}

# Languages of the run files, so screen readers pronounce agent notes correctly.
LANG_BY_FILE = {
    "batch-1.json": "en",
    "batch-2.json": "en",
    "batch-3.json": "de",
    "batch-1-corrections.json": "en",
    "batch-2-corrections.json": "en",
    "batch-3-corrections.json": "de",
    "root-correction-220540.json": "en",
    "adjudication.json": "en",
}

DECISION_DE = {
    "correct": "korrigiert",
    "correct_conservatively": "zurückhaltend korrigiert",
    "add_context": "Kontext ergänzt",
    "not_required_as_general_rule": "als allgemeine Regel verworfen",
}
SEVERITY_DE = {"error": "Fehler", "warning": "Hinweis"}


class BuildError(Exception):
    """A violated contract between the run files and this interface."""


def _load_json(path: Path) -> object:
    if not path.is_file():
        raise BuildError(f"missing input file {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def _vocab_label(iri: URIRef | None) -> str:
    if iri is None:
        return ""
    local = str(iri).rsplit("/", 1)[-1]
    if str(iri).startswith(str(VOC)):
        if local not in VOCAB_DE:
            raise BuildError(f"vocabulary term without German display label: {local}")
        return VOCAB_DE[local]
    return local


def _qname(iri: URIRef, uid: str) -> str:
    text = str(iri)
    for prefix, ns in PREFIXES.items():
        if text.startswith(ns):
            return f"{prefix}:{text[len(ns) :]}"
    local_ns = f"urn:regesta:{uid}:"
    if text.startswith(local_ns):
        return f"x:{text[len(local_ns) :]}"
    return f"<{text}>"


def _turtle_term(term: object, uid: str) -> str:
    if isinstance(term, Literal):
        escaped = str(term).replace("\\", "\\\\").replace('"', '\\"')
        return f'"{escaped}"'
    return _qname(term, uid)


# Source CSVs: ordering field and the edition's apparatus.

LINK_RE = re.compile(r"<link\s+([^\s>]+)[^>]*>(.*?)</link>", re.S)
TAG_RE = re.compile(r"<(/?)(\w+)[^>]*>")


def _markup_segments(raw: str | None, exchange_to_uid: dict[str, str]) -> list[dict]:
    """Turn inherited markup into typed text segments; the client never parses HTML.

    Internal regest links become jumps when the target is part of the run, external
    links stay links, <em>/<i> become italics, all other tags are dropped.
    """
    if not raw or raw.strip().lower() == "null":
        return []
    segments: list[dict] = []
    italic = False
    sup = False

    def emit(text: str, **extra: object) -> None:
        text = html.unescape(text)
        text = re.sub(r"\s+", " ", text)
        if not text:
            return
        seg: dict = {"t": text}
        if italic:
            seg["i"] = True
        if sup:
            seg["sup"] = True
        seg.update(extra)
        segments.append(seg)

    pos = 0
    tokens = []
    for m in LINK_RE.finditer(raw):
        tokens.append((m.start(), m.end(), m))
    link_iter = iter(tokens)
    next_link = next(link_iter, None)
    while pos < len(raw):
        if next_link and next_link[0] == pos:
            m = next_link[2]
            target, label = m.group(1), TAG_RE.sub("", m.group(2))
            if target.startswith("riregesten:"):
                exchange = target.split(":", 1)[1]
                if exchange in exchange_to_uid:
                    emit(label, regest=exchange_to_uid[exchange])
                else:
                    emit(label)
            elif target.startswith("http"):
                emit(label, href=target)
            else:
                emit(label)
            pos = next_link[1]
            next_link = next(link_iter, None)
            continue
        end = next_link[0] if next_link else len(raw)
        chunk = raw[pos:end]
        cursor = 0
        for tm in TAG_RE.finditer(chunk):
            emit(chunk[cursor : tm.start()])
            closing, name = tm.group(1) == "/", tm.group(2).lower()
            if name in ("em", "i"):
                italic = not closing
            elif name == "sup":
                sup = not closing
            elif name in ("li", "br") and not closing and segments:
                segments.append({"t": " | "})
            cursor = tm.end()
        emit(chunk[cursor:])
        pos = end
    # Collapse the separator emitted before the first list item.
    while segments and segments[0]["t"].strip() in ("|", ""):
        segments.pop(0)
    return segments


def _read_source_rows(csv_path: Path, uids: set[str]) -> dict[str, dict]:
    rows = {}
    with csv_path.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            if row["uid"] in uids:
                rows[row["uid"]] = row
    missing = uids - rows.keys()
    if missing:
        raise BuildError(f"regest CSV lacks UIDs {sorted(missing)}")
    return rows


def _read_register(csv_path: Path, identifiers: set[str]) -> dict[str, list[dict]]:
    """Register rows of the selected regesta; the register escapes quotes with a backslash."""
    by_identifier: dict[str, list[dict]] = defaultdict(list)
    with csv_path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle, escapechar="\\", strict=True)
        for row in reader:
            if row["regestaIdentifier"] in identifiers:
                by_identifier[row["regestaIdentifier"]].append(row)
    return by_identifier


# RDF: statements per regest.


def _node_name(g: rdflib.Graph, node: URIRef) -> str:
    label = g.value(node, RDFS.label)
    if label is not None:
        return str(label)
    node_type = g.value(node, CRM.P2_has_type)
    if node_type is not None:
        return _vocab_label(node_type)
    if (node, RDF.type, CRM.E7_Activity) in g or (node, RDF.type, CRM.E5_Event) in g:
        return "Handlung ohne Typ"
    return str(node)


def _head_title(g: rdflib.Graph, node: URIRef) -> str:
    node_type = g.value(node, CRM.P2_has_type)
    label = g.value(node, RDFS.label)
    if node_type is not None and label is not None:
        return f"{_vocab_label(node_type)} ({label})"
    return _node_name(g, node)


def _assertions(g: rdflib.Graph) -> dict[tuple, URIRef]:
    found = {}
    for a in g.subjects(RDF.type, CRM.E13_Attribute_Assignment):
        key = (
            g.value(a, CRM.P140_assigned_attribute_to),
            g.value(a, CRM.P177_assigned_property_of_type),
            g.value(a, CRM.P141_assigned),
        )
        if None in key:
            raise BuildError(f"incomplete E13 node {a}")
        if key in found:
            raise BuildError(f"two E13 nodes assign the same triple {key}")
        found[key] = a
    return found


def _locate(text: str, evidence: str, where: str) -> tuple[int, int, bool]:
    start = text.find(evidence)
    if start < 0:
        raise BuildError(f"{where}: evidence not verbatim in summary_plain: {evidence!r}")
    ambiguous = text.find(evidence, start + 1) >= 0
    return start, start + len(evidence), ambiguous


def _claim_turtle(g: rdflib.Graph, a: URIRef, extra: list[tuple], uid: str) -> str:
    preds = [
        CRM.P140_assigned_attribute_to,
        CRM.P177_assigned_property_of_type,
        CRM.P141_assigned,
        REG.source,
        REG.evidence,
    ]
    parts = [f"{_qname(a, uid)} a crm:E13_Attribute_Assignment"]
    for p in preds:
        parts.append(f"    {_qname(p, uid)} {_turtle_term(g.value(a, p), uid)}")
    lines = [" ;\n".join(parts) + " ."]
    for s, p, o in extra:
        lines.append(f"{_qname(s, uid)} {_qname(p, uid)} {_turtle_term(o, uid)} .")
    return f"@prefix x: <urn:regesta:{uid}:> .\n" + "\n".join(lines)


def _build_statements(g: rdflib.Graph, uid: str, text: str, technical: bool) -> dict:
    """Group the graph of one regest into readable lines, each tied to its evidence."""
    assertions = _assertions(g)
    used_assertions: set[URIRef] = set()
    groups: dict[str, dict] = {}
    loose: list[dict] = []
    spans: list[dict] = []

    def group_for(node: URIRef) -> dict:
        key = str(node)
        if key not in groups:
            kind = "act"
            if (node, RDF.type, CRM.E30_Right) in g:
                kind = "right"
            elif (node, RDF.type, CRM.E18_Physical_Thing) in g:
                kind = "thing"
            groups[key] = {
                "node": key,
                "kind": kind,
                "title": _head_title(g, node),
                "head": None,
                "lines": [],
            }
        return groups[key]

    def make_line(kind: str, text_de: str, triple: tuple, extra: list[tuple], rel: str, phrase: str = "") -> dict:
        s, p, o = triple
        a = assertions.get(triple)
        line: dict = {
            "kind": kind,
            "rel": rel,
            "phrase": phrase,
            "text": text_de,
            "triple": [str(s), str(p), str(o) if not isinstance(o, Literal) else None],
            "status": {"asserted": True, "technical": technical, "expert": False},
        }
        if a is not None:
            used_assertions.add(a)
            evidence = str(g.value(a, REG.evidence))
            start, end, ambiguous = _locate(text, evidence, f"{uid} {a}")
            claim_id = str(a).rsplit(":", 1)[-1]
            line.update(
                id=claim_id,
                own=True,
                evidence={"start": start, "end": end, "ambiguous": ambiguous},
                turtle=_claim_turtle(g, a, [triple, *extra], uid),
            )
            spans.append({"id": claim_id, "start": start, "end": end})
        else:
            line.update(id=None, own=False)
        return line

    for node in sorted({s for cls in NODE_CLASSES for s in g.subjects(RDF.type, cls)}, key=str):
        grp = group_for(node)
        node_type = g.value(node, CRM.P2_has_type)
        if node_type is not None:
            grp["head"] = make_line("head", grp["title"], (node, CRM.P2_has_type, node_type), [], "type", grp["title"])
        for o in sorted(g.objects(node, CRM.P11_had_participant), key=str):
            grp["lines"].append(
                make_line(
                    "line",
                    f"beteiligt ist {_node_name(g, o)}",
                    (node, CRM.P11_had_participant, o),
                    [],
                    "participant",
                    _node_name(g, o),
                )
            )
        for o in sorted(g.objects(node, CRM.P14_carried_out_by), key=str):
            grp["lines"].append(
                make_line(
                    "line",
                    f"ausgeführt von {_node_name(g, o)}",
                    (node, CRM.P14_carried_out_by, o),
                    [],
                    "performer",
                    _node_name(g, o),
                )
            )
        for o in sorted(g.objects(node, REG.concerns), key=str):
            line = make_line(
                "line", f"betrifft {_node_name(g, o)}", (node, REG.concerns, o), [], "concerns", _node_name(g, o)
            )
            line["object"] = str(o)
            grp["lines"].append(line)
        for pred, kind in LITERAL_KINDS.items():
            for o in sorted(g.objects(node, pred), key=str):
                literal_text = str(o)
                line = {
                    "kind": "literal",
                    "label": kind,
                    "text": literal_text,
                    "id": None,
                    "own": False,
                    "verbatim": literal_text in text,
                    "triple": [str(node), str(pred), None],
                    "status": {"asserted": True, "technical": technical, "expert": False},
                }
                grp["lines"].append(line)

    for part in sorted(g.subjects(RDF.type, REG.Participation), key=str):
        ctx, actor, role = g.value(part, REG.context), g.value(part, REG.actor), g.value(part, REG.role)
        if None in (ctx, actor, role):
            raise BuildError(f"{uid}: incomplete participation {part}")
        grp = group_for(ctx)
        extra = [(part, REG.actor, actor), (part, REG.context, ctx)]
        grp["lines"].append(
            make_line(
                "line",
                f"{_node_name(g, actor)} in der Rolle {_vocab_label(role)}",
                (part, REG.role, role),
                extra,
                "role",
                _node_name(g, actor),
            )
        )
        grp["lines"][-1]["role"] = _vocab_label(role)

    for child, parent in sorted(g.subject_objects(CRM.P152_has_parent), key=lambda t: (str(t[0]), str(t[1]))):
        line = make_line(
            "line",
            f"{_node_name(g, parent)} ist Elternteil von {_node_name(g, child)}",
            (child, CRM.P152_has_parent, parent),
            [],
            "parent",
        )
        line["actors"] = [str(child), str(parent)]
        loose.append(line)
    for holder, right in sorted(g.subject_objects(CRM.P75_possesses), key=lambda t: (str(t[0]), str(t[1]))):
        loose.append(
            make_line(
                "line",
                f"{_node_name(g, holder)} besitzt {_node_name(g, right)}",
                (holder, CRM.P75_possesses, right),
                [],
                "possesses",
            )
        )

    unused = set(assertions.values()) - used_assertions
    if unused:
        raise BuildError(f"{uid}: E13 nodes without a rendered projection: {sorted(map(str, unused))}")

    # Projection lines without their own E13 point to the classification evidence of their group.
    blocks = []
    for grp in groups.values():
        head = grp["head"]
        if head is None and not grp["lines"]:
            continue  # a named thing that only appears as an object elsewhere
        for line in grp["lines"]:
            if line["kind"] != "literal" and not line["own"] and head is not None and head["own"]:
                line["inherits"] = head["id"]
            if line["kind"] == "literal" and line["verbatim"]:
                start, end, ambiguous = _locate(text, line["text"], f"{uid} literal")
                line["evidence"] = {"start": start, "end": end, "ambiguous": ambiguous}
        offsets = [ln["evidence"]["start"] for ln in [head, *grp["lines"]] if ln and ln.get("own")]
        grp["order"] = min(offsets) if offsets else len(text) + 1
        grp["lines"].sort(key=lambda ln: (ln["kind"] == "literal", ln.get("evidence", {}).get("start", len(text))))
        blocks.append(grp)
    for line in loose:
        blocks.append(
            {
                "node": None,
                "title": None,
                "head": None,
                "lines": [line],
                "order": line["evidence"]["start"] if line.get("own") else len(text) + 1,
            }
        )
    blocks.sort(key=lambda b: (b["order"], b["node"] or "", b["lines"][0]["text"] if b["lines"] else ""))

    # Literal lines receive stable ids so the text can address them too.
    counter = 0
    for b in blocks:
        for line in b["lines"]:
            if line["kind"] == "literal" and line.get("evidence"):
                counter += 1
                line["id"] = f"t{counter}"
                spans.append({"id": line["id"], "start": line["evidence"]["start"], "end": line["evidence"]["end"]})
        del b["order"]
    spans.sort(key=lambda s: (s["start"], -s["end"], s["id"]))
    blocks = _fold_objects(blocks)
    _compose(blocks)
    return {"blocks": blocks, "spans": spans}


def _fold_objects(blocks: list[dict]) -> list[dict]:
    """Fold a right or thing into the act that concerns it, so one act reads as one sentence.

    The folded block's type assignment and notes travel with the concerning line; nothing
    is dropped. A block concerned by several acts, and any event, keeps its own sentence.
    """
    by_node = {b["node"]: b for b in blocks if b["node"]}
    concerned: dict[str, list[dict]] = defaultdict(list)
    for b in blocks:
        for line in b["lines"]:
            if line.get("rel") == "concerns" and line["object"] in by_node:
                concerned[line["object"]].append(line)
    folded = set()
    for node, lines in concerned.items():
        target = by_node[node]
        only_notes = all(ln["kind"] == "literal" for ln in target["lines"])
        if len(lines) == 1 and target["kind"] in ("right", "thing") and only_notes:
            lines[0]["folded"] = {"head": target["head"], "notes": target["lines"]}
            folded.add(node)
    return [b for b in blocks if b["node"] not in folded]


def _all_lines(blocks: list[dict]) -> list[dict]:
    """Every line of every block, folded heads and notes included."""
    out = []
    for b in blocks:
        for line in [b["head"], *b["lines"]]:
            if line is None:
                continue
            out.append(line)
            folded = line.get("folded")
            if folded:
                out += [ln for ln in [folded["head"], *folded["notes"]] if ln]
    return out


def _join(phrases: list[dict]) -> list:
    out: list = []
    for i, phrase in enumerate(phrases):
        if i:
            out.append(" und " if i == len(phrases) - 1 else ", ")
        out.append(phrase)
    return out


def _plural(role: str) -> str:
    """Plural of a German role label from VOCAB_DE: Zeuge -> Zeugen, Begünstigter -> Begünstigte."""
    if role.endswith("e"):
        return role + "n"
    if role.endswith(("ter", "nder")):
        return role[:-1]
    return role


def _phrases(lines: list[dict]) -> list[dict]:
    return [{"keys": [ln["key"]], "text": ln["phrase"]} for ln in lines]


def _compose(blocks: list[dict]) -> None:
    """Readable sentence for each block. The templates, filled from the graph only:

    act:    <type> [durch <P14 actors>] [mit <P11 actors>] [, als <role> <actors>]... [, betrifft <objects>].
    loose:  <parent> ist Elternteil von <child>.  |  <holder> besitzt <right>.

    A phrase names the line keys it stands for; the connecting words are interface text.
    """
    counter = 0
    for b in blocks:
        for line in [b["head"], *b["lines"]]:
            if line is None:
                continue
            counter += 1
            line["key"] = f"k{counter}"
            folded = line.get("folded")
            if folded and folded["head"]:
                counter += 1
                folded["head"]["key"] = f"k{counter}"
    for b in blocks:
        if b["node"] is None:
            line = b["lines"][0]
            b["sentence"] = [{"keys": [line["key"]], "text": line["text"]}, "."]
            continue
        head = b["head"]
        parts: list = [{"keys": [head["key"]] if head else [], "text": b["title"]}]
        by_rel: dict[str, list[dict]] = defaultdict(list)
        for line in b["lines"]:
            if line["kind"] != "literal":
                by_rel[line["rel"]].append(line)
        if by_rel["performer"]:
            parts += [" durch ", *_join(_phrases(by_rel["performer"]))]
        if by_rel["participant"]:
            parts += [" mit ", *_join(_phrases(by_rel["participant"]))]
        roles: dict[str, list[dict]] = defaultdict(list)
        for ln in by_rel["role"]:
            roles[ln["role"]].append(ln)
        for role, lines in roles.items():
            parts += [f", als {_plural(role) if len(lines) > 1 else role} ", *_join(_phrases(lines))]
        if by_rel["concerns"]:
            objects = []
            for ln in by_rel["concerns"]:
                keys = [ln["key"]]
                if ln.get("folded") and ln["folded"]["head"]:
                    keys.append(ln["folded"]["head"]["key"])
                objects.append({"keys": keys, "text": ln["phrase"]})
            parts += [", betrifft ", *_join(objects)]
        parts.append(".")
        b["sentence"] = parts


# Agent notes, review findings, adjudication and corrections.


def _agent_notes(run: Path) -> dict[str, dict]:
    notes: dict[str, dict] = defaultdict(lambda: {"unresolved": [], "gaps": [], "corrections": []})
    for path in sorted((run / "extracted").glob("batch-*.json")):
        data = _load_json(path)
        records = data["records"] if isinstance(data, dict) else data
        lang = LANG_BY_FILE[path.name]
        for rec in records:
            entry = notes[rec["uid"]]
            entry["status"] = rec["status"]
            entry["unresolved"] += [{"text": t, "lang": lang} for t in rec.get("unresolved_identities", [])]
            entry["gaps"] += [{"text": t, "lang": lang, "stage": "Extraktion"} for t in rec.get("ontology_gaps", [])]
    for path in sorted((run / "revised").glob("batch-*-corrections.json")):
        data = _load_json(path)
        records = data["records"] if isinstance(data, dict) else data
        lang = LANG_BY_FILE[path.name]
        for rec in records:
            entry = notes[rec["uid"]]
            changes = rec.get("changes") or ([rec["change"]] if rec.get("change") else [])
            changed = [c for c in changes if c != "unchanged"]
            entry["corrected"] = bool(changed) or rec.get("status") == "corrected"
            entry["corrections"] += [{"text": c, "lang": lang} for c in changed]
            gaps = rec.get("gaps", []) + rec.get("remaining_gaps", [])
            entry["gaps"] += [{"text": t, "lang": lang, "stage": "Korrektur"} for t in gaps]
    root = _load_json(run / "revised" / "root-correction-220540.json")
    notes[root["uid"]]["corrections"].append({"text": root["reason"], "lang": "en"})
    notes[root["uid"]]["corrected"] = True
    return notes


def _review_history(run: Path, texts: dict[str, str]) -> dict[str, dict]:
    history: dict[str, dict] = defaultdict(lambda: {"findings": [], "decisions": [], "revised": None, "final": None})
    for name in ("review-1.json", "review-2.json"):
        for rec in _load_json(run / "review" / name)["records"]:
            for f in rec["findings"]:
                history[rec["uid"]]["findings"].append(_finding(f, rec["uid"], texts))
    for dec in _load_json(run / "review" / "adjudication.json")["decisions"]:
        for uid in dec["uids"]:
            history[uid]["decisions"].append(
                {
                    "decision": DECISION_DE[dec["decision"]],
                    "finding": dec.get("finding"),
                    "reason": dec["reason"],
                    "lang": "en",
                }
            )
    for rec in _load_json(run / "review" / "review-revised.json")["records"]:
        history[rec["uid"]]["revised"] = {
            "disposition": rec["previous_finding_disposition"],
            "remaining": [_finding(f, rec["uid"], texts) for f in rec["remaining_semantic_findings"]],
            "gaps": rec.get("model_gaps", []),
        }
    root = _load_json(run / "review" / "root-correction-check.json")
    history[root["uid"]]["final"] = {
        "disposition": root["previous_finding_disposition"],
        "remaining": [_finding(f, root["uid"], texts) for f in root["remaining_semantic_findings"]],
        "gaps": root.get("model_gaps", []),
    }
    return history


def _finding(f: dict, uid: str, texts: dict[str, str]) -> dict:
    quote = f.get("evidence_quote")
    entry = {
        "category": f.get("category"),
        "severity": SEVERITY_DE.get(f.get("severity"), f.get("severity")),
        "subject": f.get("subject"),
        "description": f["description"],
        "proposal": f.get("proposed_correction"),
    }
    if quote:
        # A quote is displayed as source wording, so it must be verbatim.
        start, end, _ = _locate(texts[uid], quote, f"review quote {uid}")
        entry["quote"] = {"start": start, "end": end}
    return entry


# Named questions.

QUESTIONS = [
    {
        "id": "ehen",
        "title": "Welche Ehen werden geschlossen, bestehen oder werden aufgelöst?",
        "query": """SELECT ?rec ?assertion ?event ?type ?partner ?partnerName ?evidence WHERE {
  GRAPH ?g {
    ?assertion a crm:E13_Attribute_Assignment ;
        crm:P140_assigned_attribute_to ?event ;
        crm:P177_assigned_property_of_type crm:P2_has_type ;
        crm:P141_assigned ?type ;
        reg:source ?rec ;
        reg:evidence ?evidence .
    VALUES ?type { v:MarriageConclusion v:Marriage v:MarriageDissolution }
    OPTIONAL {
      { ?event crm:P11_had_participant ?partner }
      UNION
      { ?part reg:context ?event ; reg:role v:Spouse ; reg:actor ?partner }
      ?partner rdfs:label ?partnerName .
    }
  }
}
ORDER BY ?rec ?event ?partnerName""",
    },
    {
        "id": "eltern",
        "title": "Welche Eltern-Kind-Beziehungen nennen die Regesten?",
        "query": """SELECT ?rec ?assertion ?child ?childName ?parent ?parentName ?evidence WHERE {
  GRAPH ?g {
    ?assertion crm:P177_assigned_property_of_type crm:P152_has_parent ;
        crm:P140_assigned_attribute_to ?child ;
        crm:P141_assigned ?parent ;
        reg:source ?rec ;
        reg:evidence ?evidence .
    ?child rdfs:label ?childName .
    ?parent rdfs:label ?parentName .
  }
}
ORDER BY ?rec ?childName ?parentName""",
    },
    {
        "id": "gleichnamige-eltern",
        "title": "Personen mit mehreren Elternteilen gleichen Namens",
        "query": """SELECT ?child ?childName ?name ?parentA ?parentB ?recA ?recB ?assertionA ?assertionB WHERE {
  ?assertionA crm:P177_assigned_property_of_type crm:P152_has_parent ;
      crm:P140_assigned_attribute_to ?child ;
      crm:P141_assigned ?parentA ;
      reg:source ?recA .
  ?assertionB crm:P177_assigned_property_of_type crm:P152_has_parent ;
      crm:P140_assigned_attribute_to ?child ;
      crm:P141_assigned ?parentB ;
      reg:source ?recB .
  FILTER (STR(?parentA) < STR(?parentB))
  GRAPH ?gA { ?parentA rdfs:label ?name . ?child rdfs:label ?childName . }
  GRAPH ?gB { ?parentB rdfs:label ?name . }
}
ORDER BY ?childName ?name ?parentA ?parentB""",
    },
    {
        "id": "rollen",
        "title": "Wer tritt in welcher Rolle auf?",
        "query": """SELECT ?rec ?assertion ?actor ?actorName ?role ?context ?contextType ?evidence WHERE {
  GRAPH ?g {
    ?assertion crm:P177_assigned_property_of_type reg:role ;
        crm:P140_assigned_attribute_to ?part ;
        crm:P141_assigned ?role ;
        reg:source ?rec ;
        reg:evidence ?evidence .
    ?part reg:actor ?actor ; reg:context ?context .
    ?actor rdfs:label ?actorName .
    OPTIONAL { ?context crm:P2_has_type ?contextType }
  }
}
ORDER BY ?rec ?role ?actorName""",
    },
    {
        "id": "rechte",
        "title": "Welche Rechte nennen die Regesten, und welcher Vorgang betrifft sie?",
        "query": """SELECT ?rec ?assertion ?right ?rightType ?rightLabel ?act ?actType ?holderName ?evidence WHERE {
  GRAPH ?g {
    ?assertion crm:P140_assigned_attribute_to ?right ;
        crm:P177_assigned_property_of_type crm:P2_has_type ;
        crm:P141_assigned ?rightType ;
        reg:source ?rec ;
        reg:evidence ?evidence .
    ?right a crm:E30_Right .
    OPTIONAL { ?right rdfs:label ?rightLabel }
    OPTIONAL { ?act reg:concerns ?right . OPTIONAL { ?act crm:P2_has_type ?actType } }
    OPTIONAL { ?holder crm:P75_possesses ?right ; rdfs:label ?holderName }
  }
}
ORDER BY ?rec ?rightType ?act""",
    },
    {
        "id": "bezug",
        "title": "Welche Vorgänge beziehen sich auf einen anderen Vorgang?",
        "query": """SELECT ?rec ?assertion ?act ?actType ?earlier ?earlierType ?evidence WHERE {
  GRAPH ?g {
    ?assertion crm:P177_assigned_property_of_type reg:concerns ;
        crm:P140_assigned_attribute_to ?act ;
        crm:P141_assigned ?earlier ;
        reg:source ?rec ;
        reg:evidence ?evidence .
    { ?earlier a crm:E7_Activity } UNION { ?earlier a crm:E5_Event }
    OPTIONAL { ?act crm:P2_has_type ?actType }
    OPTIONAL { ?earlier crm:P2_has_type ?earlierType }
  }
}
ORDER BY ?rec ?act""",
    },
    {
        "id": "bedingungen",
        "title": "Welche Vorgänge stehen unter einer Bedingung oder einer Ausnahme?",
        "query": """SELECT ?rec ?context ?contextType ?kind ?wording WHERE {
  GRAPH ?g {
    ?rec a crm:E31_Document .
    { ?context reg:condition ?wording . BIND("Bedingung" AS ?kind) }
    UNION
    { ?context reg:exception ?wording . BIND("Ausnahme" AS ?kind) }
    OPTIONAL { ?context crm:P2_has_type ?contextType }
  }
}
ORDER BY ?rec ?context ?kind ?wording""",
    },
]


def _uid_of_record(iri: str) -> str:
    if not iri.startswith("urn:regesta:record:"):
        raise BuildError(f"unexpected source IRI {iri}")
    return iri.rsplit(":", 1)[-1]


def _local(iri: str) -> str:
    return iri.rsplit(":", 1)[-1]


def _ref(uid: str, claim: str | None, short: dict[str, str]) -> dict:
    return {"regest": uid, "claim": claim, "label": short[uid]}


def _display_rows(qid: str, rows: list[dict], ctx: dict) -> tuple[list[str], list[list]]:
    """Readable table for a question; each cell is text, source wording or a jump."""
    short, texts, names = ctx["short"], ctx["texts"], ctx["node_names"]

    def node(uid: str, iri: str | None) -> str:
        if not iri:
            return ""
        return names[uid].get(iri) or iri

    def wording(uid: str, evidence: str) -> dict:
        _locate(texts[uid], evidence, f"question {qid}")
        return {"source": evidence}

    if qid == "ehen":
        grouped: dict[tuple, dict] = {}
        for r in rows:
            uid = _uid_of_record(r["rec"])
            key = (uid, r["event"])
            row = grouped.setdefault(
                key,
                {"uid": uid, "claim": _local(r["assertion"]), "type": r["type"], "partners": [], "ev": r["evidence"]},
            )
            if r.get("partnerName") and r["partnerName"] not in row["partners"]:
                row["partners"].append(r["partnerName"])
        cols = ["Regest", "Vorgang", "Beteiligte", "Beleg"]
        out = [
            [
                _ref(v["uid"], v["claim"], short),
                _vocab_label(URIRef(v["type"])),
                " und ".join(v["partners"]) if v["partners"] else "ohne genannte Beteiligte",
                wording(v["uid"], v["ev"]),
            ]
            for v in grouped.values()
        ]
        return cols, out
    if qid == "eltern":
        cols = ["Regest", "Kind", "Elternteil", "Beleg"]
        return cols, [
            [
                _ref(_uid_of_record(r["rec"]), _local(r["assertion"]), short),
                r["childName"],
                r["parentName"],
                wording(_uid_of_record(r["rec"]), r["evidence"]),
            ]
            for r in rows
        ]
    if qid == "gleichnamige-eltern":
        order = ctx["order"]
        rows = [dict(r) for r in rows]  # the raw result stays as executed
        for r in rows:
            # Show the pair in edition order, independent of the IRI order used to avoid duplicates.
            if order.index(_uid_of_record(r["recA"])) > order.index(_uid_of_record(r["recB"])):
                for a, b in (("recA", "recB"), ("parentA", "parentB"), ("assertionA", "assertionB")):
                    r[a], r[b] = r[b], r[a]
        cols = ["Person", "Name des Elternteils", "Erstes Regest", "Kennung dort", "Zweites Regest", "Kennung dort"]
        return cols, [
            [
                r["childName"],
                r["name"],
                _ref(_uid_of_record(r["recA"]), _local(r["assertionA"]), short),
                {"iri": r["parentA"]},
                _ref(_uid_of_record(r["recB"]), _local(r["assertionB"]), short),
                {"iri": r["parentB"]},
            ]
            for r in rows
        ]
    if qid == "rollen":
        cols = ["Regest", "Person oder Gruppe", "Rolle", "Vorgang", "Beleg"]
        return cols, [
            [
                _ref(_uid_of_record(r["rec"]), _local(r["assertion"]), short),
                r["actorName"],
                _vocab_label(URIRef(r["role"])),
                _vocab_label(URIRef(r["contextType"])) if r.get("contextType") else "Handlung ohne Typ",
                wording(_uid_of_record(r["rec"]), r["evidence"]),
            ]
            for r in rows
        ]
    if qid == "rechte":
        grouped = {}
        for r in rows:
            uid = _uid_of_record(r["rec"])
            key = (uid, r["right"])
            row = grouped.setdefault(
                key,
                {
                    "uid": uid,
                    "claim": _local(r["assertion"]),
                    "right": _vocab_label(URIRef(r["rightType"]))
                    + (f" ({r['rightLabel']})" if r.get("rightLabel") else ""),
                    "acts": [],
                    "holders": [],
                    "ev": r["evidence"],
                },
            )
            if r.get("act"):
                act = _vocab_label(URIRef(r["actType"])) if r.get("actType") else "Handlung ohne Typ"
                if act not in row["acts"]:
                    row["acts"].append(act)
            if r.get("holderName") and r["holderName"] not in row["holders"]:
                row["holders"].append(r["holderName"])
        cols = ["Regest", "Recht", "Betroffen durch", "Inhaber im Graphen", "Beleg"]
        return cols, [
            [
                _ref(v["uid"], v["claim"], short),
                v["right"],
                ", ".join(v["acts"]) or "kein Vorgang im Graphen",
                ", ".join(v["holders"]) or "nicht angegeben",
                wording(v["uid"], v["ev"]),
            ]
            for v in grouped.values()
        ]
    if qid == "bezug":
        cols = ["Regest", "Vorgang", "bezieht sich auf", "Beleg"]
        out = []
        for r in rows:
            uid = _uid_of_record(r["rec"])
            out.append(
                [
                    _ref(uid, _local(r["assertion"]), short),
                    node(uid, r["act"]),
                    node(uid, r["earlier"]),
                    wording(uid, r["evidence"]),
                ]
            )
        return cols, out
    if qid == "bedingungen":
        cols = ["Regest", "Vorgang", "Art", "Wortlaut im Graphen"]
        out = []
        for r in rows:
            uid = _uid_of_record(r["rec"])
            cell = {"source": r["wording"]} if r["wording"] in texts[uid] else {"agent": r["wording"]}
            out.append(
                [
                    _ref(uid, None, short),
                    node(uid, r["context"]),
                    r["kind"],
                    cell,
                ]
            )
        return cols, out
    raise BuildError(f"no display rule for question {qid}")


def _run_questions(ds: Dataset, ctx: dict) -> list[dict]:
    out = []
    for q in QUESTIONS:
        result = ds.query(SPARQL_PREFIXES + q["query"])
        variables = [str(v) for v in result.vars]
        rows = []
        for row in result:
            bound = row.asdict()
            rows.append({v: (str(bound[v]) if v in bound else None) for v in variables})
        columns, display = _display_rows(q["id"], rows, ctx)
        out.append(
            {
                "id": q["id"],
                "title": q["title"],
                "sparql": SPARQL_PREFIXES + "\n" + q["query"],
                "variables": variables,
                "result": rows,
                "columns": columns,
                "rows": display,
            }
        )
    return out


# Identity cross references (the case found by "gleichnamige-eltern").


def _identity_crossrefs(
    question: dict, packets: dict[str, dict], short: dict[str, str], graphs: dict[str, rdflib.Graph]
) -> list[dict]:
    refs = []
    for r in question["result"]:
        sides = []
        for side in ("A", "B"):
            uid = _uid_of_record(r[f"rec{side}"])
            iri = r[f"parent{side}"]
            used = {str(n) for n in graphs[uid].all_nodes() if str(n).startswith("urn:regesta:actor:RI")}
            register = _register_entry(iri, packets[uid], used)
            sides.append(
                {
                    "regest": uid,
                    "label": short[uid],
                    "claim": _local(r[f"assertion{side}"]),
                    "iri": iri,
                    "register": register,
                }
            )
        refs.append({"child": r["childName"], "childIri": r["child"], "name": r["name"], "sides": sides})
    return refs


def _register_entry(iri: str, packet: dict, used: set[str]) -> dict | None:
    """Register entry of an actor IRI as the packet offers it.

    A register IRI names its entry directly. For a local actor the packet candidates of
    type person whose register label contains the local slug, and which the graph does not
    already use for another actor, are reported as candidates the extraction agent did not
    assign; this is a lookup, not an identity claim.
    """
    candidates = packet["identity_candidates"]
    if iri.startswith("urn:regesta:actor:RI"):
        reg_id = iri.split(":")[3]
        for c in candidates:
            if c["id"] == reg_id:
                return {"id": c["id"], "label": c["origLabel"], "assigned": True}
        return {"id": reg_id, "label": None, "assigned": True}
    if ":local:" in iri:
        slug = iri.rsplit(":", 1)[-1].lower()
        hits = [
            c
            for c in candidates
            if c["type"] == "person"
            and slug in c["label"].lower()
            and not any(u.split(":")[3] == c["id"] for u in used)
        ]
        if len(hits) == 1:
            return {"id": hits[0]["id"], "label": hits[0]["origLabel"], "assigned": False}
    return None


# Overview data: distribution of the delivery, timeline links and the person graph.


def _year_distribution(csv_path: Path) -> dict:
    """Regesta of the whole delivery per year of the delivered start_date, as in the film."""
    counts: dict[int, int] = defaultdict(int)
    undated = 0
    total = 0
    with csv_path.open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            total += 1
            year = row["start_date"][:4]
            if year.isdigit():
                counts[int(year)] += 1
            else:
                undated += 1
    years = sorted(counts)
    return {
        "field": "start_date",
        "total": total,
        "undated": undated,
        "years": [[y, counts[y]] for y in range(years[0], years[-1] + 1)],
    }


SENTENCE_END = re.compile(r"[.!?](?=\s+[A-ZÄÖÜ])")
NO_END_BEFORE = re.compile(r"(\b[A-Z]|\b[IVXLC]+|\b(?:S|St|vgl|Reg|Regg|ca|Bf|Ebf|Bi|Kg|Ks|Hg|Gf|Mgf|Z|n|d|u|a|O))$")


def _lead(text: str, limit: int = 180) -> str:
    """Whole text when short, otherwise the first sentence, never cut inside a sentence.

    A full stop after a single capital, a Roman numeral or a listed abbreviation does not
    end a sentence ("Eugens III., der", "S. Clemente").
    """
    if len(text) <= limit:
        return text
    for m in SENTENCE_END.finditer(text):
        before = text[: m.start()].rstrip()
        if NO_END_BEFORE.search(before):
            continue
        return text[: m.end()]
    return text


def _actor_kind(g: rdflib.Graph, node: URIRef) -> str | None:
    if (node, RDF.type, CRM.E21_Person) in g:
        return "person"
    if (node, RDF.type, CRM.E74_Group) in g:
        return "group"
    return None


def _person_graph(graphs: dict[str, rdflib.Graph], regests: list[dict], same_name: dict) -> dict:
    """Actors and acts of all regesta as one network, every edge taken from a triple.

    Nodes are actors (E21, E74, merged by IRI across regesta, as the RDF merges them) and
    acts that involve at least one actor. Edges are P11, P14 and Participation roles between
    act and actor, P152 between child and parent, and the same-name pairs that the question
    gleichnamige-eltern returned. Co-mention in one regest creates no edge.
    """
    by_uid = {r["uid"]: r for r in regests}
    actors: dict[str, dict] = {}
    acts: dict[str, dict] = {}
    edges: list[dict] = []

    def claim_for(uid: str, triple: list) -> str | None:
        for line in _all_lines(by_uid[uid]["blocks"]):
            if line.get("triple") == triple and line.get("own"):
                return line["id"]
        return None

    def actor(uid: str, g: rdflib.Graph, node: URIRef) -> str:
        key = str(node)
        entry = actors.setdefault(
            key, {"id": key, "kind": _actor_kind(g, node), "labels": {}, "regests": [], "local": ":local:" in key}
        )
        label = g.value(node, RDFS.label)
        if label is not None:
            entry["labels"].setdefault(str(label), []).append(uid)
        if uid not in entry["regests"]:
            entry["regests"].append(uid)
        return key

    for uid in [r["uid"] for r in regests]:
        g = graphs[uid]
        for node in sorted(set(g.subjects(RDF.type, None)), key=str):
            if not isinstance(node, URIRef):
                continue
            is_act = any((node, RDF.type, c) in g for c in (CRM.E5_Event, CRM.E7_Activity, REG.RelationshipState))
            if not is_act:
                continue
            links = []
            for pred, rel in ((CRM.P14_carried_out_by, "ausgeführt von"), (CRM.P11_had_participant, "beteiligt")):
                for o in sorted(g.objects(node, pred), key=str):
                    if _actor_kind(g, o):
                        links.append((o, rel, [str(node), str(pred), str(o)]))
            for part in sorted(g.subjects(REG.context, node), key=str):
                o, role = g.value(part, REG.actor), g.value(part, REG.role)
                if o is not None and _actor_kind(g, o):
                    links.append((o, _vocab_label(role), [str(part), str(REG.role), str(role)]))
            if not links:
                continue
            act_id = str(node)
            acts[act_id] = {
                "id": act_id,
                "kind": "act",
                "label": _node_name(g, node),
                "regest": uid,
                "claim": claim_for(uid, [act_id, str(CRM.P2_has_type), str(g.value(node, CRM.P2_has_type))]),
            }
            for o, rel, triple in links:
                edges.append(
                    {
                        "source": act_id,
                        "target": actor(uid, g, o),
                        "kind": "role",
                        "label": rel,
                        "regest": uid,
                        "claim": claim_for(uid, triple),
                    }
                )
        for child, parent in sorted(g.subject_objects(CRM.P152_has_parent), key=lambda t: (str(t[0]), str(t[1]))):
            edges.append(
                {
                    "source": actor(uid, g, child),
                    "target": actor(uid, g, parent),
                    "kind": "parent",
                    "label": "Elternteil",
                    "regest": uid,
                    "claim": claim_for(uid, [str(child), str(CRM.P152_has_parent), str(parent)]),
                }
            )
    for row in same_name["result"]:
        edges.append(
            {
                "source": row["parentA"],
                "target": row["parentB"],
                "kind": "same-name",
                "label": "gleicher Name, andere Kennung",
                "regest": None,
                "claim": None,
            }
        )
    for a in actors.values():
        # The most frequent label names the node; all labels stay available.
        ranked = sorted(a["labels"].items(), key=lambda kv: (-len(kv[1]), kv[0]))
        a["label"] = ranked[0][0] if ranked else a["id"]
        a["labels"] = [{"label": k, "regests": v} for k, v in ranked]
    nodes = sorted(actors.values(), key=lambda n: n["id"]) + sorted(acts.values(), key=lambda n: n["id"])
    _layout(nodes, edges)
    return {"nodes": nodes, "edges": edges}


def _layout(nodes: list[dict], edges: list[dict]) -> None:
    """Deterministic force layout computed once at build time.

    Start positions lie on a circle in IRI order, the iteration count and step are fixed, so
    every build gives the same picture and the browser runs no simulation.
    """
    import numpy as np

    n = len(nodes)
    index = {node["id"]: i for i, node in enumerate(nodes)}
    angle = np.arange(n) * (2 * np.pi / n)
    pos = np.stack([np.cos(angle), np.sin(angle)], axis=1) * 3.0
    pairs = np.array([(index[e["source"]], index[e["target"]]) for e in edges if e["kind"] != "same-name"])
    rest = np.array([1.3 if e["kind"] == "parent" else 1.0 for e in edges if e["kind"] != "same-name"])
    for step in range(600):
        delta = pos[:, None, :] - pos[None, :, :]
        dist2 = (delta**2).sum(-1) + 1e-6
        force = (delta / dist2[..., None]).sum(1) * 0.6
        d = pos[pairs[:, 1]] - pos[pairs[:, 0]]
        length = np.sqrt((d**2).sum(1)) + 1e-9
        pull = (d / length[:, None]) * ((length - rest) * 0.2)[:, None]
        np.add.at(force, pairs[:, 0], pull)
        np.add.at(force, pairs[:, 1], -pull)
        force -= pos * 0.025
        cooling = 1.0 - step / 600
        pos += np.clip(force, -0.5, 0.5) * cooling
    span = pos.max(0) - pos.min(0)
    pos = (pos - pos.min(0)) / np.where(span == 0, 1, span)
    for i, node in enumerate(nodes):
        node["x"] = round(float(pos[i, 0]), 4)
        node["y"] = round(float(pos[i, 1]), 4)


def build(source: Path, run_id: str, out: Path) -> None:
    run = source / "runs" / run_id
    manifest = _load_json(run / "manifest.json")
    validation = _load_json(run / "validation" / "revised.json")
    if validation["stage"] != "revised":
        raise BuildError("validation report is not the revised stage")
    order = [s["uid"] for s in manifest["selection"]]
    packets = {uid: _load_json(run / "packets" / f"{uid}.json") for uid in order}
    texts = {uid: p["summary_plain"] for uid, p in packets.items()}
    records = {r["uid"]: r for r in validation["records"]}
    if set(records) != set(order):
        raise BuildError("validation report does not cover exactly the selected UIDs")

    regest_csv = source / "source-material" / "RI_004-002-ReggBarbarossa.csv"
    register_csv = source / "source-material" / "RI_004-002-RegisterBarbarossa.csv"
    rows = _read_source_rows(regest_csv, set(order))
    exchange_to_uid = {rows[uid]["exchange_identifier"]: uid for uid in order}
    register = _read_register(register_csv, {p["identifier"] for p in packets.values()})

    ds = Dataset(default_union=True)
    graphs = {}
    for uid in order:
        ttl = run / "revised" / f"{uid}.ttl"
        if not ttl.is_file():
            raise BuildError(f"missing revised Turtle for {uid}")
        g = ds.graph(URIRef(f"urn:regesta:graph:{uid}"))
        g.parse(ttl, format="turtle")
        graphs[uid] = g

    shorts = {uid: packets[uid]["identifier"].split(" ", 2)[-1] for uid in order}
    if len(set(shorts.values())) != len(shorts):
        shorts = {uid: packets[uid]["identifier"] for uid in order}

    notes = _agent_notes(run)
    history = _review_history(run, texts)

    regests = []
    node_names: dict[str, dict[str, str]] = {}
    for uid in order:
        rec = records[uid]
        technical = bool(validation["technical_pass"]) and not rec["issues"]
        g = graphs[uid]
        statements = _build_statements(g, uid, texts[uid], technical)
        node_names[uid] = {str(n): _node_name(g, n) for n in set(g.subjects()) if isinstance(n, URIRef)}
        claim_count = sum(1 for ln in _all_lines(statements["blocks"]) if ln.get("own"))
        if claim_count != len(rec["claims"]):
            raise BuildError(f"{uid}: {claim_count} rendered claims, validation lists {len(rec['claims'])}")
        row = rows[uid]
        p = packets[uid]
        regests.append(
            {
                "uid": uid,
                "identifier": p["identifier"],
                "short": shorts[uid],
                "sort": row["sorting"],
                "start": p["machine_start"],
                "end": p["machine_end"],
                "lead": _lead(texts[uid]),
                "date": _markup_segments(p["date_string"], exchange_to_uid),
                "place": _markup_segments(p["locality_string"], exchange_to_uid),
                "text": texts[uid],
                "status": rec["status"],
                "technical": technical,
                "claims": claim_count,
                **statements,
                "notes": notes.get(uid, {"unresolved": [], "gaps": [], "corrections": []}),
                "history": history.get(uid, {"findings": [], "decisions": [], "revised": None, "final": None}),
                "apparatus": {
                    "commentary": _markup_segments(row["commentary"], exchange_to_uid),
                    "transmission": _markup_segments(row["archival_history"], exchange_to_uid),
                    "links": _markup_segments(row["external_links"], exchange_to_uid),
                },
                "register": sorted({r["id"]: r["origLabel"] for r in register.get(p["identifier"], [])}.items()),
            }
        )
    regests.sort(key=lambda r: r["sort"])

    ctx = {"short": shorts, "texts": texts, "node_names": node_names, "order": [r["uid"] for r in regests]}
    questions = _run_questions(ds, ctx)

    same_name = next(q for q in questions if q["id"] == "gleichnamige-eltern")
    crossrefs = _identity_crossrefs(same_name, packets, shorts, graphs)
    by_uid = {r["uid"]: r for r in regests}
    for ref in crossrefs:
        for side in ref["sides"]:
            other = next(s for s in ref["sides"] if s is not side)
            _attach_crossref(by_uid[side["regest"]], side, other, ref)
    _attach_unresolved(by_uid)
    _verify_register(crossrefs, register, packets)

    edition = {
        "run": {
            "id": manifest["run_id"],
            "model": manifest["model"],
            "scope": manifest["annotation_scope"],
            "technical_pass": validation["technical_pass"],
            "expert_accepted": validation["expert_accepted"],
            "validator": validation["runtime"],
        },
        "regests": regests,
        "delivery": _year_distribution(regest_csv),
        "graph": _person_graph(graphs, regests, same_name),
    }
    out.mkdir(parents=True, exist_ok=True)
    _write(out / "edition.json", edition)
    _write(out / "questions.json", {"run": manifest["run_id"], "rdflib": rdflib.__version__, "questions": questions})
    print(f"wrote {out / 'edition.json'} and {out / 'questions.json'}")
    for q in questions:
        print(f"  {q['id']}: {len(q['rows'])} rows")
    for ref in crossrefs:
        print("  same-name parents:", ref["child"], "|", ref["name"], "|", [s["iri"] for s in ref["sides"]])


def _attach_crossref(regest: dict, side: dict, other: dict, ref: dict) -> None:
    for block in regest["blocks"]:
        for line in block["lines"]:
            if line.get("id") == side["claim"]:
                line.setdefault("crossrefs", []).append(
                    {
                        "question": "gleichnamige-eltern",
                        "graphNode": ref["childIri"],
                        "name": ref["name"],
                        "child": ref["child"],
                        "here": side,
                        "other": other,
                    }
                )
                return
    raise BuildError(f"cross reference target {side['claim']} not found in {regest['uid']}")


def _attach_unresolved(by_uid: dict[str, dict]) -> None:
    """Move an unresolved-identity note to the lines that use the local actor it names."""
    for regest in by_uid.values():
        remaining = []
        for note in regest["notes"]["unresolved"]:
            placed = False
            for block in regest["blocks"]:
                for line in block["lines"]:
                    for iri in line.get("actors", []):
                        if ":local:" in iri and iri.rsplit(":", 1)[-1].lower() in note["text"].lower():
                            line.setdefault("agentNotes", []).append(note)
                            placed = True
            if not placed:
                remaining.append(note)
        regest["notes"]["unresolved"] = remaining


def _verify_register(crossrefs: list[dict], register: dict[str, list[dict]], packets: dict[str, dict]) -> None:
    """Check each shown register entry against the register CSV itself, not only the packet."""
    for ref in crossrefs:
        for side in ref["sides"]:
            entry = side["register"]
            if entry is None:
                continue
            identifier = packets[side["regest"]]["identifier"]
            labels = {r["id"]: r["origLabel"] for r in register.get(identifier, [])}
            if labels.get(entry["id"]) != entry["label"]:
                raise BuildError(f"register entry {entry['id']} for {identifier} differs from the register CSV")


def _write(path: Path, data: object) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def main() -> int:
    here = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--source", type=Path, default=here.parent / "regesta-rdf-demo")
    parser.add_argument("--run", default="pilot-2026-11-09")
    parser.add_argument("--out", type=Path, default=here / "data")
    args = parser.parse_args()
    if args.out.resolve().is_relative_to(args.source.resolve()):
        print("refusing to write into the source repository", file=sys.stderr)
        return 2
    try:
        build(args.source, args.run, args.out)
    except BuildError as exc:
        print(f"build failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
