# /// script
# requires-python = ">=3.11"
# dependencies = ["rdflib==7.6.0", "numpy"]
# ///
"""Build the JSON data of the assertive edition prototype from one regesta run.

Regime: single-file script with inline dependencies. It reads one finished run of the
sibling repository regesta-rdf-demo and never writes there.

Data flow
    packets/<uid>.json            regest text, dating, locality, register candidates
    <stage>/<uid>.ttl             candidate RDF, one named graph per file
    validation/<stage>.json       technical result per record
    extracted/batch-*.json        notes of the extraction agents
    review/*.json, revised/*corrections*.json
                                  review findings, adjudication and corrections (pilot model)
    contracts/<run>/ontology/vocabulary.ttl
                                  SKOS labels of the factoid model
    source CSVs                   ordering field, commentary and transmission (apparatus)
        -> data/edition.json      reading view and overview
        -> data/questions.json    named SPARQL questions, query text and executed result

Two data models are read into the same edition.json schema. The pilot model
(pilot-2026-11-09) holds CRM events and one E13 per projected triple; the factoid model
(factoid-2026-11-11) holds rf:ActFactoid and rf:StateFactoid nodes with references,
evidence selectors and exact-wording literals. The model is detected from the RDF of the
run (rf: factoid classes present or not), never from the run name.

Usage
    python build_data.py
    python build_data.py --source ../regesta-rdf-demo --run pilot-2026-11-09 --out data
    python build_data.py --run factoid-2026-11-11 --stage extracted --out <dir>

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
- Factoid model: one factoid is one statement block, and every phrase of it is bound to the
  factoid's own evidence selectors, because the factoid carries the evidence. German labels
  come from skos:prefLabel@de of the run's frozen vocabulary, whose hash must match the
  manifest. The same-name question compares parent names after stripping German inflection
  endings, a deliberate interface heuristic that finds candidates and decides no identity.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import html
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

import rdflib
from rdflib import RDF, RDFS, SKOS, BNode, Dataset, Literal, URIRef

CRM = rdflib.Namespace("http://www.cidoc-crm.org/cidoc-crm/")
REG = rdflib.Namespace("https://example.org/regesta/ontology/")
VOC = rdflib.Namespace("https://example.org/regesta/vocab/")
RF = rdflib.Namespace("https://example.org/regesta/factoid/")
RV = rdflib.Namespace("https://example.org/regesta/concept/")
OA = rdflib.Namespace("http://www.w3.org/ns/oa#")
PROV = rdflib.Namespace("http://www.w3.org/ns/prov#")

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
    "keep": "beibehalten",
    "not_required": "nicht erforderlich",
    "model_gap": "als Modelllücke vermerkt",
}
SEVERITY_DE = {"error": "Fehler", "warning": "Hinweis", "note": "Vermerk"}

FACTOID_PREFIXES = {
    "rf": str(RF),
    "rv": str(RV),
    "crm": str(CRM),
    "oa": str(OA),
    "prov": str(PROV),
    "rdfs": str(RDFS),
}
FACTOID_CLASSES = (RF.ActFactoid, RF.StateFactoid)
# Labels of the exact-wording literals in the reading view, as the commission names them.
FACTOID_LITERALS = {
    RF.condition: "Bedingung",
    RF.exception: "Ausnahme",
    RF.ground: "Begründung laut Regest",
    RF.amount: "Betrag",
    RF.qualifier: "Wortlaut",
}
FACTOID_LINKS = {RF.partOf: ("partOf", "Teil von"), RF.refersToAct: ("refersToAct", "bezieht sich auf")}
# Roles read as "durch" and "mit" in the sentence; every other role reads "als <role>".
ROLES_BY = (RV.Grantor,)
ROLES_WITH = (RV.Spouse, RV.Kin)
# Run files the factoid path reads; any other review or correction file aborts the build,
# so a new kind of report is never silently left out.
FACTOID_REVIEWS = ("review-A.json", "review-B.json")
FACTOID_REVIEW_FILES = {*FACTOID_REVIEWS, "adjudication.json"}


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


def _qname(iri: URIRef, uid: str, prefixes: dict[str, str] = PREFIXES) -> str:
    text = str(iri)
    for prefix, ns in prefixes.items():
        if text.startswith(ns):
            return f"{prefix}:{text[len(ns) :]}"
    local_ns = f"urn:regesta:{uid}:"
    if text.startswith(local_ns):
        return f"x:{text[len(local_ns) :]}"
    return f"<{text}>"


def _turtle_term(term: object, uid: str, prefixes: dict[str, str] = PREFIXES) -> str:
    if isinstance(term, Literal):
        escaped = str(term).replace("\\", "\\\\").replace('"', '\\"')
        return f'"{escaped}"'
    return _qname(term, uid, prefixes)


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


PLURAL_DE = {"Adressat": "Adressaten", "Kind": "Kinder", "Elternteil": "Elternteile", "Lehnsmann": "Lehnsleute"}


def _plural(role: str) -> str:
    """Plural of a German role label: Zeuge -> Zeugen, Begünstigter -> Begünstigte, Kind -> Kinder."""
    if role in PLURAL_DE:
        return PLURAL_DE[role]
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
            entry = {
                "regest": uid,
                "label": short[uid],
                "claim": _local(r[f"assertion{side}"]),
                "iri": iri,
                "register": register,
            }
            if r.get(f"name{side}"):
                # Factoid rows carry the name form of each regest, which may differ by inflection.
                entry["name"] = r[f"name{side}"]
            sides.append(entry)
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
    return _finish_graph(actors, acts, edges, same_name["result"])


def _finish_graph(
    actors: dict[str, dict], acts: dict[str, dict], edges: list[dict], same_name_rows: list[dict]
) -> dict:
    """Add the same-name edges, name each actor by its most frequent label and lay out."""
    for row in same_name_rows:
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


# Factoid model: one factoid, one statement block.


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _concept_labels(contract: Path, manifest: dict) -> dict[str, str]:
    """German prefLabels of the run's frozen SKOS vocabulary, checked against the manifest hash."""
    vocabulary = contract / "ontology" / "vocabulary.ttl"
    if not vocabulary.is_file():
        raise BuildError(f"missing input file {vocabulary}")
    expected = manifest.get("contract_sha256", {}).get("ontology/vocabulary.ttl")
    if expected != _sha256(vocabulary):
        raise BuildError(f"{vocabulary} does not match the contract hash of the manifest")
    g = rdflib.Graph().parse(vocabulary, format="turtle")
    labels = {}
    for concept, label in g.subject_objects(SKOS.prefLabel):
        if isinstance(label, Literal) and label.language == "de":
            labels[str(concept)] = str(label)
    return labels


def _concept(labels: dict[str, str], iri: object, where: str) -> str:
    if iri is None:
        raise BuildError(f"{where}: missing concept")
    if str(iri) not in labels:
        raise BuildError(f"{where}: concept without German prefLabel: {iri}")
    return labels[str(iri)]


def _factoids(g: rdflib.Graph) -> list[URIRef]:
    return sorted({f for cls in FACTOID_CLASSES for f in g.subjects(RDF.type, cls)}, key=str)


def _ft(term: object, uid: str) -> str:
    """Turtle of one term; a blank node is written inline in brackets."""
    return _turtle_term(term, uid, FACTOID_PREFIXES)


def _inline(g: rdflib.Graph, node: object, uid: str) -> str:
    if isinstance(node, BNode):
        return "[ " + " ; ".join(_po(g, node, uid)) + " ]"
    return _ft(node, uid)


def _po(g: rdflib.Graph, node: object, uid: str) -> list[str]:
    """Predicate-object pairs of a node in a fixed order, so the Turtle text is deterministic."""
    out = []
    types = sorted(_ft(t, uid) for t in g.objects(node, RDF.type))
    if types:
        out.append("a " + ", ".join(types))
    for p in sorted({p for p in g.predicates(node) if p != RDF.type}, key=lambda p: _ft(p, uid)):
        out.append(f"{_ft(p, uid)} " + " , ".join(sorted(_inline(g, o, uid) for o in g.objects(node, p))))
    return out


def _statement(g: rdflib.Graph, s: URIRef, p: URIRef, o: object, uid: str) -> str:
    """One factoid triple, followed by the description of a named object node."""
    text = f"{_ft(s, uid)} {_ft(p, uid)} {_inline(g, o, uid)} ."
    if isinstance(o, URIRef) and any(True for _ in g.predicates(o)):
        text += f"\n{_ft(o, uid)} " + " ;\n    ".join(_po(g, o, uid)) + " ."
    return f"@prefix x: <urn:regesta:{uid}:> .\n{text}"


def _head_turtle(g: rdflib.Graph, f: URIRef, selector: object, uid: str) -> str:
    """The factoid's own frame: type, concept, source, first evidence, producer and status."""
    parts = [f"{_ft(f, uid)} a " + ", ".join(sorted(_ft(t, uid) for t in g.objects(f, RDF.type)))]
    for p in (RF.factoidType, RF.source):
        parts += [f"    {_ft(p, uid)} {_ft(o, uid)}" for o in sorted(g.objects(f, p), key=str)]
    parts.append(f"    {_ft(RF.evidence, uid)} {_inline(g, selector, uid)}")
    for p in (PROV.wasAttributedTo, RF.verificationStatus):
        parts += [f"    {_ft(p, uid)} {_ft(o, uid)}" for o in sorted(g.objects(f, p), key=str)]
    return f"@prefix x: <urn:regesta:{uid}:> .\n" + " ;\n".join(parts) + " ."


def _object_name(g: rdflib.Graph, node: object, labels: dict[str, str]) -> str:
    """Readable name of a concerned right, thing, place or community: type and source label."""
    label = g.value(node, RDFS.label)
    node_type = g.value(node, CRM.P2_has_type)
    type_de = _concept(labels, node_type, str(node)) if node_type is not None else None
    if type_de and label is not None:
        return f"{type_de} ({label})"
    if label is not None:
        return str(label)
    return type_de or _local(str(node))


def _locate_literal(text: str, literal: str, ranges: list[tuple[int, int]], where: str) -> tuple[int, int, bool]:
    """Place an exact-wording literal inside the factoid's evidence first, else in the whole text.

    A short qualifier such as "Tochter" may occur several times in the regest; inside the
    evidence of its factoid it is usually unique.
    """
    for start, end in ranges:
        at = text.find(literal, start, end)
        if at >= 0:
            return at, at + len(literal), text.find(literal, at + 1, end) >= 0
    return _locate(text, literal, where)


def _factoid_statements(g: rdflib.Graph, uid: str, text: str, technical: bool, labels: dict[str, str]) -> dict:
    """One block per factoid; every phrase rests on the factoid's own evidence selectors."""
    status = {"asserted": True, "technical": technical, "expert": False}
    blocks: list[dict] = []
    spans: list[dict] = []
    factoids = _factoids(g)
    titles = {str(f): _concept(labels, g.value(f, RF.factoidType), f"{uid} {f}") for f in factoids}
    for f in factoids:
        claim = _local(str(f))
        selectors = []
        for sel in g.objects(f, RF.evidence):
            exact = g.value(sel, OA.exact)
            if exact is None:
                raise BuildError(f"{uid} {claim}: evidence selector without oa:exact")
            start, end, ambiguous = _locate(text, str(exact), f"{uid} {claim}")
            selectors.append((start, end, ambiguous, sel))
        if not selectors:
            raise BuildError(f"{uid} {claim}: factoid without evidence")
        selectors.sort(key=lambda s: (s[0], s[1], str(g.value(s[3], OA.exact))))
        ids = [claim] + [f"{claim}-{i}" for i in range(2, len(selectors) + 1)]
        for sid, (start, end, _, _) in zip(ids, selectors, strict=True):
            spans.append({"id": sid, "start": start, "end": end})
        first = selectors[0]
        evidence = {"start": first[0], "end": first[1], "ambiguous": first[2]}

        def line(
            rel: str,
            phrase: str,
            text_de: str,
            pred: URIRef,
            obj: object,
            turtle: str,
            f: URIRef = f,
            claim: str = claim,
            evidence: dict = evidence,
        ) -> dict:
            return {
                "kind": "line",
                "rel": rel,
                "phrase": phrase,
                "text": text_de,
                "triple": [str(f), str(pred), str(obj) if isinstance(obj, URIRef) else None],
                "status": status,
                "id": claim,
                "own": True,
                "evidence": evidence,
                "turtle": turtle,
            }

        title = titles[str(f)]
        head = line("type", title, title, RF.factoidType, g.value(f, RF.factoidType), _head_turtle(g, f, first[3], uid))
        head["kind"] = "head"
        lines = []
        refs = []
        for ref in g.objects(f, RF.reference):
            actor, role = g.value(ref, RF.actor), g.value(ref, RF.role)
            if actor is None or role is None:
                raise BuildError(f"{uid} {claim}: reference without actor or role")
            name_in_source = g.value(ref, RF.nameInSource)
            name = g.value(actor, RDFS.label) or name_in_source or _local(str(actor))
            at = text.find(str(name_in_source)) if name_in_source is not None else -1
            refs.append((at if at >= 0 else len(text), str(role), str(actor), ref, actor, role, str(name)))
        for _, _, _, ref, actor, role, name in sorted(refs, key=lambda r: r[:3]):
            role_de = _concept(labels, role, f"{uid} {claim}")
            ln = line(
                "role",
                name,
                f"{name} in der Rolle {role_de}",
                RF.reference,
                ref,
                _statement(g, f, RF.reference, ref, uid),
            )
            ln.update(role=role_de, roleIri=str(role), actors=[str(actor)])
            lines.append(ln)
        for obj in sorted(g.objects(f, RF.concerns), key=str):
            name = _object_name(g, obj, labels)
            ln = line("concerns", name, f"betrifft {name}", RF.concerns, obj, _statement(g, f, RF.concerns, obj, uid))
            ln["object"] = str(obj)
            lines.append(ln)
        for pred, (rel, words) in FACTOID_LINKS.items():
            for obj in sorted(g.objects(f, pred), key=str):
                target = titles.get(str(obj))
                if target is None:
                    raise BuildError(f"{uid} {claim}: {rel} points outside the factoids of this regest: {obj}")
                ln = line(rel, target, f"{words} {target}", pred, obj, _statement(g, f, pred, obj, uid))
                ln.update(object=str(obj), objectClaim=_local(str(obj)))
                lines.append(ln)
        for sid, (start, end, ambiguous, sel) in zip(ids[1:], selectors[1:], strict=True):
            ln = line("evidence", "", "weiterer Beleg", RF.evidence, sel, _statement(g, f, RF.evidence, sel, uid))
            ln.update(id=sid, evidence={"start": start, "end": end, "ambiguous": ambiguous})
            lines.append(ln)
        ranges = [(s[0], s[1]) for s in selectors]
        for pred, label in FACTOID_LITERALS.items():
            for o in sorted(g.objects(f, pred), key=str):
                literal_text = str(o)
                ln = {
                    "kind": "literal",
                    "label": label,
                    "text": literal_text,
                    "id": None,
                    "own": False,
                    "verbatim": literal_text in text,
                    "triple": [str(f), str(pred), None],
                    "status": status,
                }
                if ln["verbatim"]:
                    start, end, ambiguous = _locate_literal(text, literal_text, ranges, f"{uid} {claim} literal")
                    ln["evidence"] = {"start": start, "end": end, "ambiguous": ambiguous}
                lines.append(ln)
        kind = "state" if (f, RDF.type, RF.StateFactoid) in g else "act"
        blocks.append({"node": str(f), "kind": kind, "title": title, "head": head, "lines": lines, "order": first[0]})

    blocks.sort(key=lambda b: (b["order"], b["node"]))
    taken = {s["id"] for s in spans}
    counter = 0
    for b in blocks:
        for ln in b["lines"]:
            if ln["kind"] == "literal" and ln.get("evidence"):
                counter += 1
                ln["id"] = f"t{counter}"
                if ln["id"] in taken:
                    raise BuildError(f"{uid}: literal span id {ln['id']} collides with a factoid name")
                spans.append({"id": ln["id"], "start": ln["evidence"]["start"], "end": ln["evidence"]["end"]})
        del b["order"]
    if len({s["id"] for s in spans}) != len(spans):
        raise BuildError(f"{uid}: two evidence spans share an id")
    spans.sort(key=lambda s: (s["start"], -s["end"], s["id"]))
    _compose_factoids(blocks, labels)
    return {"blocks": blocks, "spans": spans}


def _compose_factoids(blocks: list[dict], labels: dict[str, str]) -> None:
    """Readable sentence for each factoid block. The template, filled from the graph only:

    <type> [durch <Aussteller>] [mit <Ehepartner, Verwandte>] [, als <role> <actors>]...
           [, betrifft <objects>] [, Teil von <act>] [, bezieht sich auf <act>].

    Every phrase names its own line and the lines of further evidence selectors, so pointing
    at any phrase underlines every passage the factoid rests on.
    """
    by_roles = {str(r) for r in ROLES_BY}
    with_roles = {str(r) for r in ROLES_WITH}
    counter = 0
    for b in blocks:
        for ln in [b["head"], *b["lines"]]:
            counter += 1
            ln["key"] = f"k{counter}"
    for b in blocks:
        extra = [ln["key"] for ln in b["lines"] if ln.get("rel") == "evidence"]

        def phrases(lines: list[dict], extra: list[str] = extra) -> list[dict]:
            return [{"keys": [ln["key"], *extra], "text": ln["phrase"]} for ln in lines]

        parts: list = [{"keys": [b["head"]["key"], *extra], "text": b["title"]}]
        refs = [ln for ln in b["lines"] if ln.get("rel") == "role"]
        by = [ln for ln in refs if ln["roleIri"] in by_roles]
        with_ = [ln for ln in refs if ln["roleIri"] in with_roles]
        if by:
            parts += [" durch ", *_join(phrases(by))]
        if with_:
            parts += [" mit ", *_join(phrases(with_))]
        roles: dict[str, list[dict]] = defaultdict(list)
        for ln in refs:
            if ln["roleIri"] not in by_roles | with_roles:
                roles[ln["role"]].append(ln)
        for role, lines in roles.items():
            parts += [f", als {_plural(role) if len(lines) > 1 else role} ", *_join(phrases(lines))]
        for rel, words in (("concerns", "betrifft"), *FACTOID_LINKS.values()):
            lines = [ln for ln in b["lines"] if ln.get("rel") == rel]
            if lines:
                parts += [f", {words} ", *_join(phrases(lines))]
        last = parts[-1] if isinstance(parts[-1], str) else parts[-1]["text"]
        if not last.endswith("."):  # "König Konrad III." already closes the sentence
            parts.append(".")
        b["sentence"] = parts
    for b in blocks:
        for ln in b["lines"]:
            ln.pop("roleIri", None)


def _factoid_notes(run: Path, stage: str) -> dict[str, dict]:
    """Extraction notes of the batch reports and, for the revised stage, the corrections.

    The factoid batch reports and corrections are written in English.
    """
    notes: dict[str, dict] = defaultdict(lambda: {"unresolved": [], "gaps": [], "corrections": []})
    for path in sorted((run / "extracted").glob("batch-*.json")):
        for rec in _load_json(path)["records"]:
            entry = notes[rec["uid"]]
            entry["status"] = rec["status"]
            entry["unresolved"] += [{"text": t, "lang": "en"} for t in rec.get("unresolved_identities", [])]
            entry["gaps"] += [{"text": t, "lang": "en", "stage": "Extraktion"} for t in rec.get("model_gaps", [])]
    if stage == "revised":
        unknown = sorted(p.name for p in (run / "revised").glob("*.json") if p.name != "corrections.json")
        if unknown:
            raise BuildError(f"correction files this build does not read: {unknown}")
        for rec in _load_json(run / "revised" / "corrections.json")["records"]:
            entry = notes[rec["uid"]]
            entry["corrections"].append({"text": rec["change"], "lang": "en"})
            entry["corrected"] = True
    return notes


def _factoid_history(run: Path, texts: dict[str, str], notes: dict[str, dict]) -> dict[str, dict]:
    """Findings of the two reviews and the adjudication; review model gaps join the notes.

    The reviews read the extracted stage, so they are shown for both stages.
    """
    history: dict[str, dict] = defaultdict(lambda: {"findings": [], "decisions": [], "revised": None, "final": None})
    review = run / "review"
    present = {p.name for p in review.glob("*")} if review.is_dir() else set()
    if present - FACTOID_REVIEW_FILES:
        raise BuildError(f"review files this build does not read: {sorted(present - FACTOID_REVIEW_FILES)}")
    for name in FACTOID_REVIEWS:
        if name not in present:
            continue
        for rec in _load_json(review / name)["records"]:
            for f in rec["findings"]:
                history[rec["uid"]]["findings"].append(_finding(f, rec["uid"], texts))
            notes[rec["uid"]]["gaps"] += [
                {"text": t, "lang": "en", "stage": "Review"} for t in rec.get("model_gaps", [])
            ]
    if "adjudication.json" in present:
        for dec in _load_json(review / "adjudication.json")["decisions"]:
            if dec["decision"] not in DECISION_DE:
                raise BuildError(f"adjudication decision without German label: {dec['decision']}")
            for uid in dec["uids"]:
                history[uid]["decisions"].append(
                    {
                        "decision": DECISION_DE[dec["decision"]],
                        "finding": dec.get("finding"),
                        "reason": dec["reason"],
                        "lang": "en",
                    }
                )
    return history


def _name_key(name: str) -> tuple[str, ...]:
    """Name with German inflection endings stripped, for the same-name candidate search only.

    "Markgraf Diepolds von Vohburg" and "Markgrafen Diepold von Vohburg" give the same key.
    Tokens of four letters or fewer stay as they are. Matching keys raise a question for the
    expert; they never merge identities.
    """
    out = []
    for token in re.findall(r"\w+", name.lower()):
        if len(token) > 4:
            for ending in ("en", "es", "s", "n"):
                if token.endswith(ending):
                    token = token[: -len(ending)]
                    break
        out.append(token)
    return tuple(out)


FACTOID_SPARQL_PREFIXES = """PREFIX rf: <https://example.org/regesta/factoid/>
PREFIX rv: <https://example.org/regesta/concept/>
PREFIX crm: <http://www.cidoc-crm.org/cidoc-crm/>
PREFIX oa: <http://www.w3.org/ns/oa#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
"""

FACTOID_QUESTIONS = [
    {
        "id": "ehen",
        "title": "Welche Ehen werden geschlossen, bestehen oder werden aufgelöst?",
        "query": """SELECT ?rec ?factoid ?type ?partner ?partnerName WHERE {
  GRAPH ?g {
    ?factoid rf:factoidType ?type ; rf:source ?rec .
    VALUES ?type { rv:MarriageConclusion rv:Marriage rv:MarriageDissolution }
    OPTIONAL {
      ?factoid rf:reference ?ref .
      ?ref rf:role rv:Spouse ; rf:actor ?partner .
      ?partner rdfs:label ?partnerName .
    }
  }
}
ORDER BY ?rec ?factoid ?partnerName ?partner ?type""",
    },
    {
        "id": "eltern",
        "title": "Welche Eltern-Kind-Beziehungen nennen die Regesten?",
        "query": """SELECT ?rec ?factoid ?child ?childName ?parent ?parentName ?parentInSource WHERE {
  GRAPH ?g {
    ?factoid rf:factoidType rv:Parenthood ; rf:source ?rec ; rf:reference ?rc , ?rp .
    ?rc rf:role rv:Child ; rf:actor ?child .
    ?rp rf:role rv:Parent ; rf:actor ?parent .
    OPTIONAL { ?rp rf:nameInSource ?parentInSource }
    ?child rdfs:label ?childName .
    ?parent rdfs:label ?parentName .
  }
}
ORDER BY ?rec ?childName ?parentName ?factoid ?child ?parent ?parentInSource""",
    },
    {
        "id": "gleichnamige-eltern",
        "title": "Personen mit mehreren Elternteilen gleichen Namens",
        "query": """SELECT ?child ?childName ?parentA ?parentB ?nameA ?nameB ?labelA ?labelB ?recA ?recB ?factoidA ?factoidB WHERE {
  GRAPH ?gA {
    ?factoidA rf:factoidType rv:Parenthood ; rf:source ?recA ; rf:reference ?cA , ?pA .
    ?cA rf:role rv:Child ; rf:actor ?child .
    ?pA rf:role rv:Parent ; rf:actor ?parentA .
    OPTIONAL { ?pA rf:nameInSource ?nameA }
    ?parentA rdfs:label ?labelA .
    ?child rdfs:label ?childName .
  }
  GRAPH ?gB {
    ?factoidB rf:factoidType rv:Parenthood ; rf:source ?recB ; rf:reference ?cB , ?pB .
    ?cB rf:role rv:Child ; rf:actor ?child .
    ?pB rf:role rv:Parent ; rf:actor ?parentB .
    OPTIONAL { ?pB rf:nameInSource ?nameB }
    ?parentB rdfs:label ?labelB .
  }
  FILTER (STR(?parentA) < STR(?parentB))
}
ORDER BY ?childName ?parentA ?parentB ?nameA ?nameB ?labelA ?labelB ?recA ?recB ?factoidA ?factoidB ?child""",
        "filter": "Python keeps a pair whose parents agree by rf:nameInSource or rdfs:label after German "
        "inflection endings are stripped (_name_key); the raw result lists every pair of distinct parent IRIs.",
    },
    {
        "id": "rollen",
        "title": "Wer tritt in welcher Rolle auf?",
        "query": """SELECT ?rec ?factoid ?type ?actor ?actorName ?role ?nameInSource WHERE {
  GRAPH ?g {
    ?factoid rf:factoidType ?type ; rf:source ?rec ; rf:reference ?ref .
    ?ref rf:role ?role ; rf:actor ?actor .
    OPTIONAL { ?ref rf:nameInSource ?nameInSource }
    ?actor rdfs:label ?actorName .
  }
}
ORDER BY ?rec ?role ?actorName ?factoid ?actor ?nameInSource ?type""",
    },
    {
        "id": "rechte",
        "title": "Welche Rechte nennen die Regesten, und welcher Vorgang betrifft sie?",
        "query": """SELECT ?rec ?right ?rightType ?rightLabel ?factoid ?type WHERE {
  GRAPH ?g {
    ?rec a crm:E31_Document .
    ?right a crm:E30_Right .
    OPTIONAL { ?right crm:P2_has_type ?rightType }
    OPTIONAL { ?right rdfs:label ?rightLabel }
    OPTIONAL { ?factoid rf:concerns ?right ; rf:factoidType ?type }
  }
}
ORDER BY ?rec ?rightType ?right ?factoid ?rightLabel ?type""",
    },
    {
        "id": "bezug",
        "title": "Welche Vorgänge beziehen sich auf einen anderen Vorgang?",
        "query": """SELECT ?rec ?factoid ?type ?relation ?other ?otherType WHERE {
  GRAPH ?g {
    { ?factoid rf:refersToAct ?other . BIND("bezieht sich auf" AS ?relation) }
    UNION
    { ?factoid rf:partOf ?other . BIND("Teil von" AS ?relation) }
    ?factoid rf:factoidType ?type ; rf:source ?rec .
    ?other rf:factoidType ?otherType .
  }
}
ORDER BY ?rec ?relation ?factoid ?other ?type ?otherType""",
    },
    {
        "id": "bedingungen",
        "title": "Welche Faktoide tragen Bedingung, Ausnahme, Begründung, Betrag oder Wortlaut?",
        "query": """SELECT ?rec ?factoid ?type ?kind ?wording WHERE {
  GRAPH ?g {
    ?factoid rf:factoidType ?type ; rf:source ?rec .
    { ?factoid rf:condition ?wording . BIND("Bedingung" AS ?kind) }
    UNION
    { ?factoid rf:exception ?wording . BIND("Ausnahme" AS ?kind) }
    UNION
    { ?factoid rf:ground ?wording . BIND("Begründung laut Regest" AS ?kind) }
    UNION
    { ?factoid rf:amount ?wording . BIND("Betrag" AS ?kind) }
    UNION
    { ?factoid rf:qualifier ?wording . BIND("Wortlaut" AS ?kind) }
  }
}
ORDER BY ?rec ?factoid ?kind ?wording ?type""",
    },
]


def _same_name_rows(rows: list[dict]) -> list[dict]:
    """Pairs of distinct parent IRIs of one child whose names agree up to inflection.

    The rows take the field names of the pilot question, so the cross references and the
    graph treat both models alike; nameA and nameB keep each regest's own wording.
    """
    pairs: dict[tuple, dict] = {}
    for r in rows:
        names_a = {_name_key(n) for n in (r["nameA"], r["labelA"]) if n}
        names_b = {_name_key(n) for n in (r["nameB"], r["labelB"]) if n}
        if not names_a & names_b:
            continue
        key = (r["child"], r["parentA"], r["parentB"], r["factoidA"], r["factoidB"])
        pairs.setdefault(
            key,
            {
                "child": r["child"],
                "childName": r["childName"],
                "name": r["nameA"] or r["labelA"],
                "nameA": r["nameA"] or r["labelA"],
                "nameB": r["nameB"] or r["labelB"],
                "parentA": r["parentA"],
                "parentB": r["parentB"],
                "recA": r["recA"],
                "recB": r["recB"],
                "assertionA": r["factoidA"],
                "assertionB": r["factoidB"],
            },
        )
    return list(pairs.values())


def _factoid_display_rows(qid: str, rows: list[dict], ctx: dict) -> tuple[list[str], list[list]]:
    """Readable table for a factoid question; source wording is checked to be verbatim."""
    short, texts, labels = ctx["short"], ctx["texts"], ctx["labels"]

    def ref(r: dict, key: str = "factoid") -> dict:
        uid = _uid_of_record(r["rec"])
        return _ref(uid, _local(r[key]) if r.get(key) else None, short)

    def wording(uid: str, value: str | None) -> dict | str:
        if not value:
            return ""
        return {"source": value} if value in texts[uid] else {"agent": value}

    def concept(iri: str | None) -> str:
        return _concept(labels, iri, f"question {qid}") if iri else ""

    if qid == "ehen":
        grouped: dict[tuple, dict] = {}
        for r in rows:
            row = grouped.setdefault((r["rec"], r["factoid"]), {"r": r, "partners": []})
            if r.get("partnerName") and r["partnerName"] not in row["partners"]:
                row["partners"].append(r["partnerName"])
        return ["Regest", "Faktoid", "Beteiligte"], [
            [ref(v["r"]), concept(v["r"]["type"]), " und ".join(v["partners"]) or "ohne genannte Beteiligte"]
            for v in grouped.values()
        ]
    if qid == "eltern":
        return ["Regest", "Kind", "Elternteil", "Name in der Quelle"], [
            [ref(r), r["childName"], r["parentName"], wording(_uid_of_record(r["rec"]), r.get("parentInSource"))]
            for r in rows
        ]
    if qid == "gleichnamige-eltern":
        order = ctx["order"]
        out = []
        for r in ctx["same_name"]:
            sides = [("A", _uid_of_record(r["recA"])), ("B", _uid_of_record(r["recB"]))]
            sides.sort(key=lambda s: order.index(s[1]))
            row = [r["childName"]]
            for side, uid in sides:
                row += [
                    _ref(uid, _local(r[f"assertion{side}"]), short),
                    wording(uid, r[f"name{side}"]),
                    {"iri": r[f"parent{side}"]},
                ]
            out.append(row)
        cols = ["Person", "Erstes Regest", "Name dort", "Kennung dort", "Zweites Regest", "Name dort", "Kennung dort"]
        return cols, out
    if qid == "rollen":
        return ["Regest", "Person oder Gruppe", "Rolle", "Faktoid", "Name in der Quelle"], [
            [
                ref(r),
                r["actorName"],
                concept(r["role"]),
                concept(r["type"]),
                wording(_uid_of_record(r["rec"]), r.get("nameInSource")),
            ]
            for r in rows
        ]
    if qid == "rechte":
        grouped = {}
        for r in rows:
            row = grouped.setdefault((r["rec"], r["right"]), {"r": r, "acts": []})
            if r.get("factoid"):
                act = {"regest": _uid_of_record(r["rec"]), "claim": _local(r["factoid"]), "label": concept(r["type"])}
                if act not in row["acts"]:
                    row["acts"].append(act)
        out = []
        for v in grouped.values():
            r = v["r"]
            uid = _uid_of_record(r["rec"])
            acts = ", ".join(a["label"] for a in v["acts"]) or "kein Faktoid im Graphen"
            claim = v["acts"][0]["claim"] if v["acts"] else None
            out.append([_ref(uid, claim, short), concept(r.get("rightType")), wording(uid, r.get("rightLabel")), acts])
        return ["Regest", "Rechtstyp", "Bezeichnung", "Betroffen durch"], out
    if qid == "bezug":
        return ["Regest", "Faktoid", "Beziehung", "anderes Faktoid"], [
            [ref(r), concept(r["type"]), r["relation"], concept(r["otherType"])] for r in rows
        ]
    if qid == "bedingungen":
        return ["Regest", "Faktoid", "Art", "Wortlaut im Graphen"], [
            [ref(r), concept(r["type"]), r["kind"], wording(_uid_of_record(r["rec"]), r["wording"])] for r in rows
        ]
    raise BuildError(f"no display rule for question {qid}")


def _run_factoid_questions(ds: Dataset, ctx: dict) -> tuple[list[dict], list[dict]]:
    out = []
    same_name: list[dict] = []
    for q in FACTOID_QUESTIONS:
        result = ds.query(FACTOID_SPARQL_PREFIXES + q["query"])
        variables = [str(v) for v in result.vars]
        rows = []
        for row in result:
            bound = row.asdict()
            rows.append({v: (str(bound[v]) if v in bound else None) for v in variables})
        if q["id"] == "gleichnamige-eltern":
            same_name = _same_name_rows(rows)
            ctx["same_name"] = same_name
        columns, display = _factoid_display_rows(q["id"], rows, ctx)
        entry = {
            "id": q["id"],
            "title": q["title"],
            "sparql": FACTOID_SPARQL_PREFIXES + "\n" + q["query"],
            "variables": variables,
            "result": rows,
            "columns": columns,
            "rows": display,
        }
        if "filter" in q:
            entry["filter"] = q["filter"]
        out.append(entry)
    return out, same_name


def _factoid_actor_kind(g: rdflib.Graph, node: object) -> str | None:
    """Person or group; an office-bound rf:FunctionalActor is drawn as a local person."""
    if (node, RDF.type, CRM.E74_Group) in g:
        return "group"
    if (node, RDF.type, CRM.E21_Person) in g or (node, RDF.type, RF.FunctionalActor) in g:
        return "person"
    return None


def _factoid_graph(
    graphs: dict[str, rdflib.Graph], regests: list[dict], same_name: list[dict], labels: dict[str, str]
) -> dict:
    """Actors from rf:actor, acts as act nodes linked by roles, parenthood as parent edges.

    A parenthood factoid gives one edge from each child to each parent instead of an act
    node, so kinship reads as in the pilot graph. Co-mention creates no edge.
    """
    actors: dict[str, dict] = {}
    acts: dict[str, dict] = {}
    edges: list[dict] = []

    def actor(uid: str, g: rdflib.Graph, node: URIRef) -> str:
        key = str(node)
        entry = actors.setdefault(
            key,
            {"id": key, "kind": _factoid_actor_kind(g, node), "labels": {}, "regests": [], "local": ":local:" in key},
        )
        label = g.value(node, RDFS.label)
        if label is not None:
            entry["labels"].setdefault(str(label), []).append(uid)
        if uid not in entry["regests"]:
            entry["regests"].append(uid)
        return key

    for uid in [r["uid"] for r in regests]:
        g = graphs[uid]
        for f in _factoids(g):
            claim = _local(str(f))
            refs = sorted(
                ((g.value(r, RF.role), g.value(r, RF.actor)) for r in g.objects(f, RF.reference)),
                key=lambda t: (str(t[0]), str(t[1])),
            )
            refs = [(role, a) for role, a in refs if a is not None and _factoid_actor_kind(g, a)]
            if g.value(f, RF.factoidType) == RV.Parenthood:
                for child in [a for role, a in refs if role == RV.Child]:
                    for parent in [a for role, a in refs if role == RV.Parent]:
                        edges.append(
                            {
                                "source": actor(uid, g, child),
                                "target": actor(uid, g, parent),
                                "kind": "parent",
                                "label": "Elternteil",
                                "regest": uid,
                                "claim": claim,
                            }
                        )
                continue
            if not refs:
                continue
            acts[str(f)] = {
                "id": str(f),
                "kind": "act",
                "label": _concept(labels, g.value(f, RF.factoidType), str(f)),
                "regest": uid,
                "claim": claim,
            }
            for role, a in refs:
                edges.append(
                    {
                        "source": str(f),
                        "target": actor(uid, g, a),
                        "kind": "role",
                        "label": _concept(labels, role, str(f)),
                        "regest": uid,
                        "claim": claim,
                    }
                )
    return _finish_graph(actors, acts, edges, same_name)


def _build_factoid(
    source: Path,
    run: Path,
    manifest: dict,
    stage: str,
    validation: dict,
    records: dict,
    src: dict,
    ds: Dataset,
    graphs: dict,
) -> tuple:
    labels = _concept_labels(source / "contracts" / manifest["run_id"], manifest)
    texts, shorts = src["texts"], src["shorts"]
    notes = _factoid_notes(run, stage)
    history = _factoid_history(run, texts, notes)

    regests = []
    for uid in src["packets"]:  # selection order of the manifest
        rec = records[uid]
        technical = bool(validation["technical_pass"]) and not rec["issues"]
        statements = _factoid_statements(graphs[uid], uid, texts[uid], technical, labels)
        claims = len(statements["blocks"])
        if claims != rec["factoids"]:
            raise BuildError(f"{uid}: {claims} rendered factoids, validation counts {rec['factoids']}")
        regests.append(
            _regest_entry(
                uid,
                src,
                rec,
                technical,
                claims,
                statements,
                notes.get(uid, {"unresolved": [], "gaps": [], "corrections": []}),
                history.get(uid, {"findings": [], "decisions": [], "revised": None, "final": None}),
            )
        )
    regests.sort(key=lambda r: r["sort"])

    ctx = {"short": shorts, "texts": texts, "labels": labels, "order": [r["uid"] for r in regests]}
    questions, same_name = _run_factoid_questions(ds, ctx)
    crossrefs = _identity_crossrefs({"result": same_name}, src["packets"], shorts, graphs)
    _link_case(regests, crossrefs, src)

    graph = _factoid_graph(graphs, regests, same_name, labels)
    _attach_case_to_nodes(graph, crossrefs)
    return regests, questions, crossrefs, graph, {"dataModel": "factoid", "stage": stage}


def build(source: Path, run_id: str, out: Path, stage: str = "revised") -> None:
    """Read one run at one stage, detect its data model from the RDF and write both JSON files."""
    run = source / "runs" / run_id
    manifest = _load_json(run / "manifest.json")
    validation = _load_json(run / "validation" / f"{stage}.json")
    if validation["stage"] != stage:
        raise BuildError(f"validation report is not the {stage} stage")
    order = [s["uid"] for s in manifest["selection"]]
    records = {r["uid"]: r for r in validation["records"]}
    if set(records) != set(order):
        raise BuildError("validation report does not cover exactly the selected UIDs")
    src = _sources(source, run, order)

    ds = Dataset(default_union=True)
    graphs = {}
    for uid in order:
        ttl = run / stage / f"{uid}.ttl"
        if not ttl.is_file():
            raise BuildError(f"missing {stage} Turtle for {uid}")
        g = ds.graph(URIRef(f"urn:regesta:graph:{uid}"))
        g.parse(ttl, format="turtle")
        graphs[uid] = g

    if any((None, RDF.type, cls) in ds for cls in FACTOID_CLASSES):
        regests, questions, crossrefs, graph, run_info = _build_factoid(
            source, run, manifest, stage, validation, records, src, ds, graphs
        )
    else:
        if stage != "revised":
            raise BuildError("the pilot model is read from its revised stage only")
        regests, questions, crossrefs, graph, run_info = _build_pilot(run, validation, records, src, ds, graphs)

    edition = {
        "run": {
            "id": manifest["run_id"],
            "model": manifest["model"],
            "scope": manifest["annotation_scope"],
            "technical_pass": validation["technical_pass"],
            "expert_accepted": validation["expert_accepted"],
            "validator": validation["runtime"],
            **run_info,
        },
        "regests": regests,
        "delivery": _year_distribution(src["regest_csv"]),
        "graph": graph,
    }
    out.mkdir(parents=True, exist_ok=True)
    _write(out / "edition.json", edition)
    _write(out / "questions.json", {"run": manifest["run_id"], "rdflib": rdflib.__version__, "questions": questions})
    print(f"wrote {out / 'edition.json'} and {out / 'questions.json'}")
    for q in questions:
        print(f"  {q['id']}: {len(q['rows'])} rows")
    for ref in crossrefs:
        print("  same-name parents:", ref["child"], "|", ref["name"], "|", [s["iri"] for s in ref["sides"]])


def _sources(source: Path, run: Path, order: list[str]) -> dict:
    """Packets, the two source CSVs and the short citations, shared by both data models."""
    packets = {uid: _load_json(run / "packets" / f"{uid}.json") for uid in order}
    regest_csv = source / "source-material" / "RI_004-002-ReggBarbarossa.csv"
    register_csv = source / "source-material" / "RI_004-002-RegisterBarbarossa.csv"
    rows = _read_source_rows(regest_csv, set(order))
    shorts = {uid: packets[uid]["identifier"].split(" ", 2)[-1] for uid in order}
    if len(set(shorts.values())) != len(shorts):
        shorts = {uid: packets[uid]["identifier"] for uid in order}
    return {
        "packets": packets,
        "texts": {uid: p["summary_plain"] for uid, p in packets.items()},
        "rows": rows,
        "exchange_to_uid": {rows[uid]["exchange_identifier"]: uid for uid in order},
        "register": _read_register(register_csv, {p["identifier"] for p in packets.values()}),
        "shorts": shorts,
        "regest_csv": regest_csv,
    }


def _regest_entry(
    uid: str, src: dict, rec: dict, technical: bool, claims: int, statements: dict, notes: dict, history: dict
) -> dict:
    """One regest of edition.json; the key order is part of the byte-identical output."""
    row = src["rows"][uid]
    p = src["packets"][uid]
    exchange_to_uid = src["exchange_to_uid"]
    return {
        "uid": uid,
        "identifier": p["identifier"],
        "short": src["shorts"][uid],
        "sort": row["sorting"],
        "start": p["machine_start"],
        "end": p["machine_end"],
        "proseYears": _prose_years(p["date_string"], p["machine_start"], p["machine_end"]),
        "lead": _lead(src["texts"][uid]),
        "date": _markup_segments(p["date_string"], exchange_to_uid),
        "place": _markup_segments(p["locality_string"], exchange_to_uid),
        "text": src["texts"][uid],
        "status": rec["status"],
        "technical": technical,
        "claims": claims,
        **statements,
        "notes": notes,
        "history": history,
        "apparatus": {
            "commentary": _markup_segments(row["commentary"], exchange_to_uid),
            "transmission": _markup_segments(row["archival_history"], exchange_to_uid),
            "links": _markup_segments(row["external_links"], exchange_to_uid),
        },
        "register": sorted({r["id"]: r["origLabel"] for r in src["register"].get(p["identifier"], [])}.items()),
    }


def _link_case(regests: list[dict], crossrefs: list[dict], src: dict) -> None:
    """Attach the same-name case and the unresolved-identity notes to the reading view."""
    by_uid = {r["uid"]: r for r in regests}
    for ref in crossrefs:
        for side in ref["sides"]:
            other = next(s for s in ref["sides"] if s is not side)
            _attach_crossref(by_uid[side["regest"]], side, other, ref)
    _attach_unresolved(by_uid)
    _verify_register(crossrefs, src["register"], src["packets"])


def _build_pilot(run: Path, validation: dict, records: dict, src: dict, ds: Dataset, graphs: dict) -> tuple:
    texts, shorts = src["texts"], src["shorts"]
    notes = _agent_notes(run)
    history = _review_history(run, texts)

    regests = []
    node_names: dict[str, dict[str, str]] = {}
    for uid in src["packets"]:  # selection order of the manifest
        rec = records[uid]
        technical = bool(validation["technical_pass"]) and not rec["issues"]
        g = graphs[uid]
        statements = _build_statements(g, uid, texts[uid], technical)
        node_names[uid] = {str(n): _node_name(g, n) for n in set(g.subjects()) if isinstance(n, URIRef)}
        claim_count = sum(1 for ln in _all_lines(statements["blocks"]) if ln.get("own"))
        if claim_count != len(rec["claims"]):
            raise BuildError(f"{uid}: {claim_count} rendered claims, validation lists {len(rec['claims'])}")
        regests.append(
            _regest_entry(
                uid,
                src,
                rec,
                technical,
                claim_count,
                statements,
                notes.get(uid, {"unresolved": [], "gaps": [], "corrections": []}),
                history.get(uid, {"findings": [], "decisions": [], "revised": None, "final": None}),
            )
        )
    regests.sort(key=lambda r: r["sort"])

    ctx = {"short": shorts, "texts": texts, "node_names": node_names, "order": [r["uid"] for r in regests]}
    questions = _run_questions(ds, ctx)

    same_name = next(q for q in questions if q["id"] == "gleichnamige-eltern")
    crossrefs = _identity_crossrefs(same_name, src["packets"], shorts, graphs)
    _link_case(regests, crossrefs, src)

    graph = _person_graph(graphs, regests, same_name)
    _attach_case_to_nodes(graph, crossrefs)
    return regests, questions, crossrefs, graph, {}


def _attach_crossref(regest: dict, side: dict, other: dict, ref: dict) -> None:
    for block in regest["blocks"]:
        for line in block["lines"]:
            if line.get("id") == side["claim"]:
                line.setdefault("crossrefs", []).append(
                    {
                        "question": "gleichnamige-eltern",
                        "graphNode": ref["childIri"],
                        "name": side.get("name", ref["name"]),
                        "child": ref["child"],
                        "here": side,
                        "other": other,
                    }
                )
                return
    raise BuildError(f"cross reference target {side['claim']} not found in {regest['uid']}")


def _attach_case_to_nodes(graph: dict, crossrefs: list[dict]) -> None:
    """Give each actor node of a same-name case its regest and register entry.

    Two nodes of the case carry the same agent label; what tells them apart for a reader is
    the regest they come from and the register entry offered there, assigned or not.
    """
    nodes = {n["id"]: n for n in graph["nodes"]}
    for ref in crossrefs:
        for side in ref["sides"]:
            node = nodes.get(side["iri"])
            if node is None:
                raise BuildError(f"case node {side['iri']} missing from the person graph")
            node["case"] = {"regest": side["regest"], "short": side["label"], "register": side["register"]}


def _prose_years(date_string: str | None, start: str, end: str) -> list[int]:
    """Years the dating prose names outside the delivered machine interval.

    "(1147 oder 1149)" with start_date 1147 yields [1149]; "(1152 Juni/Juli)" with
    start_date 1138 yields [1152]. The timeline keeps such a second year visible.
    """
    if not date_string:
        return []
    low, high = int(start[:4]), int(end[:4])
    years = {int(y) for y in re.findall(r"(?<!\d)(1\d{3})(?!\d)", re.sub(r"<[^>]+>", "", date_string))}
    return sorted(y for y in years if not low <= y <= high)


def _attach_unresolved(by_uid: dict[str, dict]) -> None:
    """Move an unresolved-identity note to the lines that use the local actor it names."""
    for regest in by_uid.values():
        remaining = []
        for note in regest["notes"]["unresolved"]:
            placed = False
            for block in regest["blocks"]:
                for line in block["lines"]:
                    for iri in line.get("actors", []):
                        # Whole words only: the slug "abt" must not match "Reichsabtei".
                        slug = re.escape(iri.rsplit(":", 1)[-1].lower())
                        if ":local:" in iri and re.search(rf"\b{slug}\b", note["text"].lower()):
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
    parser.add_argument("--stage", choices=("extracted", "revised"), default="revised")
    args = parser.parse_args()
    if args.out.resolve().is_relative_to(args.source.resolve()):
        print("refusing to write into the source repository", file=sys.stderr)
        return 2
    try:
        build(args.source, args.run, args.out, args.stage)
    except BuildError as exc:
        print(f"build failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
