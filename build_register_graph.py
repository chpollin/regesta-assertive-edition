"""Export the whole RI IV,2 delivery, regests and register, as RDF (TriG) and as JSON-LD for the register network.

Regime: script of the edition's script pipeline (pyproject.toml, uv.lock); it imports
edition_io.py, register_names.py and build_graph.py. It reads pipeline/ and never writes
there. No LLM produces anything here: every triple of the deterministic layers follows from a
rule over the two CSV files, and the LLM layer is copied from frozen run files.

Data flow
    source-material/RI_004-002-ReggBarbarossa.csv     regest fields (shared reader)
    source-material/RI_004-002-RegisterBarbarossa.csv register entries and rows
    runs/<run>/revised/<uid>.ttl, packets/<uid>.json  LLM proposals of the frozen runs
    runs/<run>/manifest.json, contracts/...           producer description (build_graph)
    edition/texts.json                                licence, source, attribution, link pattern
        -> <out>/ri-iv-2.trig          named graphs records, roles, register, findings, one
                                       graph per regest with LLM proposals, description
        -> <out>/context.jsonld        the one hand-written @context of every JSON-LD file
        -> <out>/record/<uid>.jsonld   a regest with its register rows, findings, proposals
        -> <out>/entry/<id>.jsonld     a register entry with parent chain, children, rows
        -> <out>/roles.jsonld, dataset.jsonld   the role scheme and the description graph
        -> <out>/index.json            plain JSON for search and entry points
        -> <out>/report.json           counts per graph and per finding type

Usage
    uv run build_register_graph.py
    uv run build_register_graph.py --out <folder> --date 2026-11-20

Design decisions (agreed model: the maximal example of 2026-11-20 for regests 2077 and 3166a,
with the operator's changes of the same day)
- Records. urn:regesta:record:<uid> a crm:E31_Document with the properties of the example:
  label and dcterms:identifier, Lieferung, number, prefix and suffix from the identifier,
  dates as xsd:date where they parse, every filled text field as plain text with its
  language (Latin for dating clause, chancellor and incipit), the http links of
  external_links and the persistent link as rdfs:seeAlso. pid, bandpk, regestennummernorm,
  laufendenummer and exchange_identifier are database keys and stay out.
- Register entries. One node per register id, its class from the leading word of the
  register type: person -> urn:regesta:actor:<id> crm:E39_Actor (the type includes groups),
  ort -> urn:regesta:place:<id> crm:E53_Place, ereignis -> urn:regesta:event:<id>
  crm:E5_Event, sache -> urn:regesta:subject:<id> without a CIDOC class (offices, festivals
  and countries share the type, so no single class fits). An unrecognisable type and every
  parent without a row of its own get urn:regesta:register:<id>, skos:Concept only. Every
  entry is a skos:Concept in <urn:regesta:register>; rr:registerType keeps the type as
  delivered. Hierarchy is rr:parentEntry; a parent without a row gets rr:derivedLabel, the
  most frequent label prefix of its children.
- Short labels. skos:prefLabel@de is a display name by rule: register_names.py for persons,
  edition_io.place_name for places, "<last segment> (<head>)" for the rest. It is a
  normalisation of this script, not a statement of the register.
- Register rows. One rr:RegisterRow per CSV row, urn:regesta:mention:<id>:<uid>, with
  rr:entry, rr:record, one rr:role per space-separated token and rr:comment. A second row
  with the same entry and regest gets the suffix :2 and a finding. The register joins on the
  RI identifier; where it names two records (1520a) the row points to both and carries a
  finding, because the delivery does not say which is meant.
- Roles. The register tokens form the SKOS scheme rrole: without glosses and without a
  mapping onto rv:, since their meaning awaits scholarly validation (knowledge of the
  workshop demo, research.md).
- Findings. Export defects become rr:ExportFinding nodes in their own graph with type,
  concerned node, field and delivered value; nothing is repaired. An implausible or
  unparsable coordinate means no geo:lat/geo:long, while the GeoNames link stays.
- LLM proposals. Where a frozen run has revised/<uid>.ttl, that file becomes the named graph
  urn:regesta:run:<run>:revised:<uid>, skolemised and tagged @de by build_graph.py's own
  functions; SHOWN_RUN wins where both runs have the regest. Statements keep
  rf:verificationStatus rv:unchecked and prov:wasAttributedTo; any other status aborts.
  The description graph states <record> rr:proposals <graph>, the triple behind the JSON-LD
  graph object in each record file.
- JSON-LD. Each file is a view on the graphs: a node with every one of its triples, with
  neighbours embedded through the context's reverse keys. The writer chooses a key of the
  hand-written context by predicate and value kind and falls back to an expanded value under
  a compact IRI, so every file expands to exactly triples of the TriG (the check proves it).
  Keys with @container @set are always arrays; uid is the last segment of a record's id.
- Namespaces rr: and rrole: are placeholders on example.org, like rf: and rv:.
- Determinism. Sorted output throughout; the same inputs and --date give identical files.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path
from typing import Any

from rdflib import RDF, RDFS, SKOS, XSD, Graph, Literal, Namespace, URIRef
from rdflib.term import Node

import build_graph
from build_graph import CRM, DCTERMS, OA, PROV, RF, RV, SCHEMA, VOID
from edition_io import (
    REGESTA_CSV,
    REGISTER_CSV,
    SHOWN_RUN,
    BuildError,
    is_null,
    load_json,
    place_label,
    place_name,
    plain_text,
    read_csv,
    regest_order,
    sha256,
)
from register_names import register_names

RR = Namespace("https://example.org/regesta/register/")
RROLE = Namespace("https://example.org/regesta/register-role/")
GEO = Namespace("http://www.w3.org/2003/01/geo/wgs84_pos#")
EXPORT = "urn:regesta:export:ri-iv-2-csv"
LAYERS = ("records", "roles", "register", "findings", "description")
GRAPH = {name: URIRef(f"{EXPORT}:{name}") for name in LAYERS}
REGISTER_SCHEME = URIRef("urn:regesta:register")
SCRIPT_AGENT = URIRef("urn:regesta:script:build_register_graph")
LLM_RUNS = ("factoid-1153-2026-11-11", "factoid-2026-11-11")
TRIG_NAME = "ri-iv-2.trig"

ID_RE = re.compile(r"RI IV,2,(\d) n\. ([D†]*)(\d+)([a-f]*)")
DECIMAL = re.compile(r"-?\d+(\.\d+)?")
TAG = re.compile(r"<\s*/?\s*([A-Za-z][\w-]*)")
LINK = re.compile(r"<link (https?://[^\s>]+)")
# Tags the regest fields use as markup (profile of 2026-11-20); any other tag name is a text
# word that lost its brackets ("<er>", "<elf>").
KNOWN_TAGS = frozenset({"em", "span", "sup", "link", "strong", "hi", "br", "xref"})
DASHES = frozenset({"-", "–", "—"})  # noqa: RUF001 - hyphen, en dash and em dash as delivered
TITLE = "Friedrich I."
# Plausibility box of the itinerary's world, from Palencia and Lübeck to Egypt and the Levant
# (the agreed example); a coordinate outside it is reported, not used.
LAT_BOX, LONG_BOX = (25.0, 60.0), (-10.0, 40.0)
KINDS = {
    "person": ("actor", CRM.E39_Actor),
    "ort": ("place", CRM.E53_Place),
    "ereignis": ("event", CRM.E5_Event),
    "sache": ("subject", None),
}

# Regest fields that become text literals: CSV column, predicate, language (None: plain).
TEXT_FIELDS = (
    ("title", RR.title, None),
    ("date_string", DCTERMS.temporal, "de"),
    ("locality_string", DCTERMS.spatial, "de"),
    ("original_date", RR.originalDate, "la"),
    ("summary", DCTERMS.abstract, "de"),
    ("recipient", RR.recipient, "de"),
    ("witnesses", RR.witnessesAsDelivered, "de"),
    ("chancellor", RR.chancellor, "la"),
    ("clerk", RR.clerk, "de"),
    ("seal", RR.seal, None),
    ("incipit", RR.incipit, "la"),
    ("archival_history", RR.archivalHistory, "de"),
    ("commentary", RR.commentary, "de"),
    ("sorting", RR.sorting, None),
    ("urn", RR.urn, None),
)

FINDING_NOTES = {
    "UnparsableDate": "The delivered date is no ISO calendar date; no xsd:date is stated.",
    "ReversedInterval": "end_date lies before start_date; both are stated as delivered.",
    "StartYearNotInDating": "The year of start_date does not occur in the printed dating. A rule signal: "
    "lower bounds of 'vor ...' datings are intended, other cases contradict the dating.",
    "LateAdditionWithoutUrn": "Record of the late-added group: UUID persistent_identifier, urn and "
    "exchange_identifier null.",
    "DuplicateIdentifier": "Two records carry the same RI identifier.",
    "MisspeltTitle": "The title differs from 'Friedrich I.'.",
    "BrokenMarkup": "A text word stands in tag brackets and is lost when markup is removed.",
    "DashAsPlace": "A dash stands for no place in locality_string.",
    "UnexpectedIdentifier": "The identifier does not follow RI IV,2,<part> n. <number>.",
    "TruncatedLabel": "The label lacks its leading name: it starts with a comma.",
    "BrokenRegisterType": "The register type carries index text; the class follows its leading word.",
    "UnclassifiedRegisterType": "The register type is missing or names no known type; no class is assigned.",
    "UnparsableCoordinate": "The coordinate is no decimal number; no geo:lat/geo:long is stated.",
    "ImplausibleCoordinate": "The coordinate lies outside the box 25-60 N, 10 W-40 E; no geo:lat/geo:long is stated.",
    "InvalidGeonames": "The GeoNames value is no identifier; no link is stated.",
    "GeonamesAsUrl": "The GeoNames value is a web address, linked as delivered.",
    "AttributeConflict": "Rows of the same entry differ in this field; the first row is used.",
    "DuplicateRegisterRow": "A second register row with the same entry and regest.",
    "AmbiguousRegestReference": "The register names an identifier that two records carry; the row points to both.",
    "UnresolvedRegestReference": "The register names an identifier no record carries.",
    "MissingRole": "The role cell is empty.",
    "UnlabelledParent": "A parent without a row of its own whose children give no label prefix.",
}

# The one hand-written context of every JSON-LD file. The writer reads its key choices from
# here: a key is used for a triple only when predicate and value kind match its definition.
CONTEXT: dict[str, Any] = {
    "@version": 1.1,
    "rdf": str(RDF),
    "rdfs": str(RDFS),
    "xsd": str(XSD),
    "skos": str(SKOS),
    "dcterms": str(DCTERMS),
    "schema": str(SCHEMA),
    "crm": str(CRM),
    "oa": str(OA),
    "prov": str(PROV),
    "void": str(VOID),
    "geo": str(GEO),
    "rf": str(RF),
    "rv": str(RV),
    "rr": str(RR),
    "rrole": str(RROLE),
    "id": "@id",
    "type": {"@id": "@type", "@container": "@set"},
    "Document": "crm:E31_Document",
    "Actor": "crm:E39_Actor",
    "Person": "crm:E21_Person",
    "Group": "crm:E74_Group",
    "Place": "crm:E53_Place",
    "Event": "crm:E5_Event",
    "Right": "crm:E30_Right",
    "PhysicalThing": "crm:E18_Physical_Thing",
    "Concept": "skos:Concept",
    "ConceptScheme": "skos:ConceptScheme",
    "RegisterRow": "rr:RegisterRow",
    "ExportFinding": "rr:ExportFinding",
    "ActFactoid": "rf:ActFactoid",
    "StateFactoid": "rf:StateFactoid",
    "FunctionalActor": "rf:FunctionalActor",
    "Reference": "rf:Reference",
    "TextQuoteSelector": "oa:TextQuoteSelector",
    "identifier": {"@id": "dcterms:identifier"},
    "plainLabel": {"@id": "rdfs:label"},
    "label": {"@id": "rdfs:label", "@language": "de"},
    "labelEn": {"@id": "rdfs:label", "@language": "en"},
    "shortLabel": {"@id": "skos:prefLabel", "@language": "de"},
    "derivedLabel": {"@id": "rr:derivedLabel", "@language": "de"},
    "origLabel": {"@id": "rr:origLabel", "@language": "de"},
    "registerType": {"@id": "rr:registerType"},
    "inScheme": {"@id": "skos:inScheme", "@type": "@id"},
    "title": {"@id": "rr:title"},
    "volumePart": {"@id": "rr:lieferung"},
    "number": {"@id": "rr:number"},
    "numberPrefix": {"@id": "rr:numberPrefix"},
    "insertedSuffix": {"@id": "rr:insertedSuffix"},
    "startDate": {"@id": "schema:startDate", "@type": "xsd:date"},
    "endDate": {"@id": "schema:endDate", "@type": "xsd:date"},
    "dating": {"@id": "dcterms:temporal", "@language": "de"},
    "place": {"@id": "dcterms:spatial", "@language": "de"},
    "originalDate": {"@id": "rr:originalDate", "@language": "la"},
    "summary": {"@id": "dcterms:abstract", "@language": "de"},
    "recipient": {"@id": "rr:recipient", "@language": "de"},
    "witnesses": {"@id": "rr:witnessesAsDelivered", "@language": "de"},
    "chancellor": {"@id": "rr:chancellor", "@language": "la"},
    "clerk": {"@id": "rr:clerk", "@language": "de"},
    "seal": {"@id": "rr:seal"},
    "incipit": {"@id": "rr:incipit", "@language": "la"},
    "archivalHistory": {"@id": "rr:archivalHistory", "@language": "de"},
    "commentary": {"@id": "rr:commentary", "@language": "de"},
    "sorting": {"@id": "rr:sorting"},
    "riUrn": {"@id": "rr:urn"},
    "seeAlso": {"@id": "rdfs:seeAlso", "@type": "@id", "@container": "@set"},
    "parent": {"@id": "rr:parentEntry", "@type": "@id"},
    "children": {"@reverse": "rr:parentEntry", "@container": "@set"},
    "geonames": {"@id": "skos:closeMatch", "@type": "@id"},
    "lat": {"@id": "geo:lat", "@type": "xsd:decimal"},
    "long": {"@id": "geo:long", "@type": "xsd:decimal"},
    "rows": {"@reverse": "rr:record", "@container": "@set"},
    "occurrences": {"@reverse": "rr:entry", "@container": "@set"},
    "entry": {"@id": "rr:entry", "@type": "@id"},
    "record": {"@id": "rr:record", "@type": "@id", "@container": "@set"},
    "roles": {"@id": "rr:role", "@type": "@vocab", "@container": "@set"},
    "comment": {"@id": "rr:comment", "@language": "de"},
    "notation": {"@id": "skos:notation"},
    "findings": {"@reverse": "rr:concerns", "@container": "@set"},
    "concerns": {"@id": "rr:concerns", "@type": "@id"},
    "findingType": {"@id": "rr:findingType", "@type": "@vocab"},
    "field": {"@id": "rr:field", "@container": "@set"},
    "deliveredValue": {"@id": "rr:deliveredValue"},
    "note": {"@id": "rdfs:comment", "@language": "en"},
    "proposals": {"@id": "rr:proposals", "@type": "@id"},
    "factoidType": {"@id": "rf:factoidType", "@type": "@id"},
    "source": {"@id": "rf:source", "@type": "@id"},
    "evidence": {"@id": "rf:evidence", "@type": "@id", "@container": "@set"},
    "references": {"@id": "rf:reference", "@type": "@id", "@container": "@set"},
    "actor": {"@id": "rf:actor", "@type": "@id"},
    "role": {"@id": "rf:role", "@type": "@id"},
    "nameInSource": {"@id": "rf:nameInSource", "@language": "de"},
    "exact": {"@id": "oa:exact", "@language": "de"},
    "concernsRight": {"@id": "rf:concerns", "@type": "@id"},
    "hasType": {"@id": "crm:P2_has_type", "@type": "@id"},
    "partOf": {"@id": "rf:partOf", "@type": "@id"},
    "refersToAct": {"@id": "rf:refersToAct", "@type": "@id"},
    "ground": {"@id": "rf:ground", "@language": "de"},
    "attributedTo": {"@id": "prov:wasAttributedTo", "@type": "@id"},
    "status": {"@id": "rf:verificationStatus", "@type": "@id"},
    **{token: f"rrole:{token}" for token in (
        "adressat", "austOrt", "beratend", "empfaenger", "gerichtsbeisitzer", "nennung", "p_komment",
        "p_tot", "p_ueberlieferung", "petent", "rekogneszent", "subskribent", "zeuge", "zustimmend",
    )},
    **{kind: f"rr:{kind}" for kind in FINDING_NOTES},
}  # fmt: skip


def _finding(
    g: Graph,
    counts: Counter,
    kind: str,
    subject: URIRef,
    key: str,
    fields: tuple[str, ...] = (),
    value: str | None = None,
) -> None:
    """Record one export defect as an rr:ExportFinding; the IRI names type, subject key and field."""
    node = URIRef(f"urn:regesta:finding:{kind}:{key}")
    if (node, RDF.type, RR.ExportFinding) in g:
        raise BuildError(f"finding {node} would be stated twice")
    g.add((node, RDF.type, RR.ExportFinding))
    g.add((node, RR.findingType, RR[kind]))
    g.add((node, RR.concerns, subject))
    g.add((node, RDFS.comment, Literal(FINDING_NOTES[kind], lang="en")))
    for field in fields:
        g.add((node, RR.field, Literal(field)))
    if value is not None:
        g.add((node, RR.deliveredValue, Literal(value)))
    counts[kind] += 1


def record_iri(uid: str) -> URIRef:
    return URIRef(f"urn:regesta:record:{uid}")


def _records(g: Graph, findings: Graph, counts: Counter, regests: list[dict], pattern: str) -> None:
    identifiers = Counter(r["identifier"] for r in regests)
    for row in regests:
        uid, identifier = row["uid"], row["identifier"]
        record = record_iri(uid)
        g.add((record, RDF.type, CRM.E31_Document))
        g.add((record, RDFS.label, Literal(identifier)))
        g.add((record, DCTERMS.identifier, Literal(identifier)))
        if match := ID_RE.fullmatch(identifier):
            part, prefix, number, suffix = match.groups()
            g.add((record, RR.lieferung, Literal(part)))
            g.add((record, RR.number, Literal(number)))
            if prefix:
                g.add((record, RR.numberPrefix, Literal(prefix)))
            if suffix:
                g.add((record, RR.insertedSuffix, Literal(suffix)))
        else:
            _finding(findings, counts, "UnexpectedIdentifier", record, uid, ("identifier",), identifier)
        if identifiers[identifier] > 1:
            _finding(findings, counts, "DuplicateIdentifier", record, uid, ("identifier",), identifier)
        parsed: dict[str, date] = {}
        for field, predicate in (("start_date", SCHEMA.startDate), ("end_date", SCHEMA.endDate)):
            try:
                parsed[field] = date.fromisoformat(row[field])
            except ValueError:
                _finding(findings, counts, "UnparsableDate", record, f"{uid}:{field}", (field,), row[field])
                continue
            g.add((record, predicate, Literal(row[field], datatype=XSD.date)))
        if len(parsed) == 2 and parsed["start_date"] > parsed["end_date"]:
            value = f"{row['start_date']} / {row['end_date']}"
            _finding(findings, counts, "ReversedInterval", record, uid, ("start_date", "end_date"), value)
        if "start_date" in parsed and str(parsed["start_date"].year) not in plain_text(row["date_string"]):
            value = f"{row['start_date']} / {row['date_string']}"
            _finding(findings, counts, "StartYearNotInDating", record, uid, ("start_date", "date_string"), value)
        for field, predicate, lang in TEXT_FIELDS:
            if is_null(row[field]):
                continue
            broken = sorted({t for t in TAG.findall(row[field]) if t.lower() not in KNOWN_TAGS})
            if broken:
                value = " ".join(f"<{t}>" for t in broken)
                _finding(findings, counts, "BrokenMarkup", record, f"{uid}:{field}", (field,), value)
            text = plain_text(row[field])
            if text:
                g.add((record, predicate, Literal(text, lang=lang)))
        if row["title"].strip() != TITLE:
            _finding(findings, counts, "MisspeltTitle", record, uid, ("title",), row["title"])
        if row["locality_string"].strip() in DASHES:
            _finding(findings, counts, "DashAsPlace", record, uid, ("locality_string",), row["locality_string"])
        if is_null(row["urn"]):
            _finding(findings, counts, "LateAdditionWithoutUrn", record, uid, ("urn", "exchange_identifier"))
        for link in sorted(set(LINK.findall(row["external_links"]))):
            g.add((record, RDFS.seeAlso, URIRef(link)))
        g.add((record, RDFS.seeAlso, URIRef(f"{pattern}{row['persistent_identifier'].strip()}")))


def _roles(g: Graph, register: list[dict]) -> list[str]:
    tokens = sorted({t for row in register for t in row["role"].split() if not is_null(t)})
    bad = [t for t in tokens if not build_graph.LOCAL_NAME.fullmatch(t)]
    if bad:
        raise BuildError(f"role tokens that make no IRI local name: {bad}")
    scheme = URIRef(str(RROLE))
    g.add((scheme, RDF.type, SKOS.ConceptScheme))
    g.add((scheme, RDFS.label, Literal("RI IV,2 register roles as delivered", lang="en")))
    for token in tokens:
        g.add((RROLE[token], RDF.type, SKOS.Concept))
        g.add((RROLE[token], SKOS.inScheme, scheme))
        g.add((RROLE[token], SKOS.notation, Literal(token)))
    return tokens


def _kind(register_type: str) -> str | None:
    """The register type's leading word where it is a known type, else None."""
    if is_null(register_type):
        return None
    match = re.match(r"\s*(person|ort|sache|ereignis)", register_type.lower())
    return match.group(1) if match else None


def _head(text: str) -> str:
    """The first name of a label segment, also where the segment starts with a comma."""
    return place_label(text) or place_label(text.lstrip(" ,")) or text.strip()


def _short_label(kind: str | None, entry_id: str, raw_label: str, persons: dict[str, str]) -> str:
    if entry_id in persons:
        return persons[entry_id]
    label = plain_text(raw_label)
    if kind == "ort" and " // " not in label and (name := place_name(entry_id, raw_label)):
        return name
    if " // " in label:
        head, last = label.split(" // ", 1)[0], label.rsplit(" // ", 1)[1]
        return f"{last.strip()} ({_head(head)})"
    return _head(label)


def _coordinates(g: Graph, findings: Graph, counts: Counter, node: URIRef, entry: dict) -> None:
    """State geo:lat/geo:long when both values are plausible decimals; report every other case."""
    if is_null(entry["lat"]) and is_null(entry["long"]):
        return
    good = True
    for field, box in (("lat", LAT_BOX), ("long", LONG_BOX)):
        value = entry[field].strip()
        if not DECIMAL.fullmatch(value):
            _finding(findings, counts, "UnparsableCoordinate", node, f"{entry['id']}:{field}", (field,), value)
            good = False
        elif not box[0] <= float(value) <= box[1]:
            _finding(findings, counts, "ImplausibleCoordinate", node, f"{entry['id']}:{field}", (field,), value)
            good = False
    if good:
        g.add((node, GEO.lat, Literal(entry["lat"].strip(), datatype=XSD.decimal)))
        g.add((node, GEO.long, Literal(entry["long"].strip(), datatype=XSD.decimal)))


ENTRY_FIELDS = ("parentId", "label", "origLabel", "type", "lat", "long", "geonames")


def _entries(
    g: Graph, findings: Graph, counts: Counter, register: list[dict], persons: dict[str, str]
) -> tuple[dict[str, URIRef], dict[str, str]]:
    """Entry nodes, parents without rows included; return IRI and index class per register id."""
    first: dict[str, dict] = {}
    conflicting: dict[str, set[str]] = defaultdict(set)
    for row in register:
        entry = first.setdefault(row["id"], row)
        conflicting[row["id"]].update(f for f in ENTRY_FIELDS if row[f] != entry[f])
    iris: dict[str, URIRef] = {}
    classes: dict[str, str] = {}
    for entry_id, entry in first.items():
        kind = _kind(entry["type"])
        prefix, _ = KINDS.get(kind, ("register", None))
        iris[entry_id] = URIRef(f"urn:regesta:{prefix}:{entry_id}")
        classes[entry_id] = prefix if kind else "unclassified"
    parents = sorted({e["parentId"] for e in first.values() if not is_null(e["parentId"])} - first.keys())
    for parent in parents:
        iris[parent] = URIRef(f"urn:regesta:register:{parent}")
        classes[parent] = "parent"

    for entry_id, entry in sorted(first.items()):
        node, kind = iris[entry_id], _kind(entry["type"])
        cls = KINDS.get(kind, (None, None))[1]
        if cls is not None:
            g.add((node, RDF.type, cls))
        g.add((node, RDF.type, SKOS.Concept))
        g.add((node, SKOS.inScheme, REGISTER_SCHEME))
        g.add((node, DCTERMS.identifier, Literal(entry_id)))
        label = plain_text(entry["label"])
        g.add((node, RDFS.label, Literal(label, lang="de")))
        g.add((node, SKOS.prefLabel, Literal(_short_label(kind, entry_id, entry["label"], persons), lang="de")))
        if not is_null(entry["origLabel"]) and plain_text(entry["origLabel"]):
            g.add((node, RR.origLabel, Literal(plain_text(entry["origLabel"]), lang="de")))
        if not is_null(entry["type"]):
            g.add((node, RR.registerType, Literal(entry["type"])))
        if kind is None:
            _finding(findings, counts, "UnclassifiedRegisterType", node, entry_id, ("type",), entry["type"])
        elif entry["type"].strip() != kind:
            _finding(findings, counts, "BrokenRegisterType", node, entry_id, ("type",), entry["type"])
        if label.startswith(","):
            _finding(findings, counts, "TruncatedLabel", node, entry_id, ("label",), label)
        if conflicting[entry_id]:
            _finding(findings, counts, "AttributeConflict", node, entry_id, tuple(sorted(conflicting[entry_id])))
        if not is_null(entry["parentId"]):
            g.add((node, RR.parentEntry, iris[entry["parentId"]]))
        geonames = entry["geonames"].strip()
        if re.fullmatch(r"\d+", geonames):
            g.add((node, SKOS.closeMatch, URIRef(f"https://sws.geonames.org/{geonames}/")))
        elif geonames.startswith(("http://", "https://")):
            g.add((node, SKOS.closeMatch, URIRef(geonames)))
            _finding(findings, counts, "GeonamesAsUrl", node, entry_id, ("geonames",), geonames)
        elif not is_null(geonames):
            _finding(findings, counts, "InvalidGeonames", node, entry_id, ("geonames",), geonames)
        _coordinates(g, findings, counts, node, entry)

    prefixes: dict[str, Counter] = defaultdict(Counter)
    for entry in first.values():
        label = plain_text(entry["label"])
        if entry["parentId"] in parents and " // " in label:
            prefixes[entry["parentId"]][label.rsplit(" // ", 1)[0].strip()] += 1
    for parent in parents:
        node = iris[parent]
        g.add((node, RDF.type, SKOS.Concept))
        g.add((node, SKOS.inScheme, REGISTER_SCHEME))
        g.add((node, DCTERMS.identifier, Literal(parent)))
        if prefixes[parent]:
            derived = min(prefixes[parent].items(), key=lambda kv: (-kv[1], kv[0]))[0]
            g.add((node, RR.derivedLabel, Literal(derived, lang="de")))
            g.add((node, SKOS.prefLabel, Literal(_head(derived), lang="de")))
        else:
            _finding(findings, counts, "UnlabelledParent", node, parent)
    return iris, classes


def _rows(
    g: Graph,
    findings: Graph,
    counts: Counter,
    register: list[dict],
    regests: list[dict],
    iris: dict[str, URIRef],
) -> None:
    uids: dict[str, list[str]] = defaultdict(list)
    for r in regests:
        uids[r["identifier"]].append(r["uid"])
    seen: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for row in register:
        targets = sorted(uids.get(row["regestaIdentifier"], []), key=int)
        key = "-".join(targets) or "unresolved-" + re.sub(r"[^\w.-]", "_", row["regestaIdentifier"])
        earlier = seen[(row["id"], key)]
        node = URIRef(f"urn:regesta:mention:{row['id']}:{key}" + (f":{len(earlier) + 1}" if earlier else ""))
        finding_key = node.removeprefix("urn:regesta:mention:")
        g.add((node, RDF.type, RR.RegisterRow))
        g.add((node, RR.entry, iris[row["id"]]))
        for uid in targets:
            g.add((node, RR.record, record_iri(uid)))
        tokens = [t for t in row["role"].split() if not is_null(t)]
        for token in tokens:
            g.add((node, RR.role, RROLE[token]))
        if not tokens:
            _finding(findings, counts, "MissingRole", node, finding_key, ("role",), row["role"])
        if not is_null(row["comment"]) and plain_text(row["comment"]):
            g.add((node, RR.comment, Literal(plain_text(row["comment"]), lang="de")))
        if earlier:
            _finding(findings, counts, "DuplicateRegisterRow", node, finding_key, ("id", "regestaIdentifier"))
        if len(targets) > 1:
            field = ("regestaIdentifier",)
            _finding(findings, counts, "AmbiguousRegestReference", node, finding_key, field, row["regestaIdentifier"])
        elif not targets:
            field = ("regestaIdentifier",)
            _finding(findings, counts, "UnresolvedRegestReference", node, finding_key, field, row["regestaIdentifier"])
        earlier.append(row)


def _proposals(source: Path, uids: set[str], counts: Counter) -> dict[str, tuple[str, Graph]]:
    """uid -> (run, skolemised graph) of every regest with a revised file; SHOWN_RUN first."""
    chosen: dict[str, tuple[str, Path]] = {}
    for run in sorted(LLM_RUNS, key=lambda r: r != SHOWN_RUN):
        for path in sorted((source / "runs" / run / build_graph.STAGE).glob("*.ttl")):
            chosen.setdefault(path.stem, (run, path))
    out = {}
    for uid, (run, path) in sorted(chosen.items()):
        if uid not in uids:
            raise BuildError(f"{path}: no record with uid {uid}")
        text = load_json(source / "runs" / run / "packets" / f"{uid}.json")["summary_plain"] or ""
        g, references, selectors = build_graph._skolemise(Graph().parse(path, format="turtle"), text, uid)
        g, _ = build_graph._tag_german(g)
        statuses = set(g.objects(None, RF.verificationStatus))
        if statuses - {RV.unchecked}:
            raise BuildError(f"{path}: status other than rv:unchecked: {sorted(map(str, statuses))}")
        counts["skolemisedReferences"] += references
        counts["skolemisedSelectors"] += selectors
        out[uid] = (run, g)
    return out


def _description(
    source: Path,
    texts: dict,
    export_date: str,
    graphs: dict[URIRef, Graph],
    proposals: dict[str, tuple[str, Graph]],
    script: Path,
) -> Graph:
    g = Graph()
    dataset = URIRef(EXPORT)
    g.add((dataset, RDF.type, VOID.Dataset))
    g.add((dataset, DCTERMS.title, Literal("Barbarossa-Regesten, RI IV,2 regests and register as RDF", lang="en")))
    g.add((dataset, DCTERMS.created, Literal(export_date, datatype=XSD.date)))
    g.add((dataset, DCTERMS.license, URIRef(texts["licences"]["data"]["url"])))
    g.add((dataset, DCTERMS.source, URIRef(texts["source"]["url"])))
    g.add((dataset, DCTERMS.rights, Literal(texts["attribution"], lang="de")))
    g.add(
        (
            dataset,
            DCTERMS.description,
            Literal(
                "The graphs records, roles, register and findings map the CSV export of Regesta Imperii IV,2 by "
                "rule, without an LLM; export defects are reported as rr:ExportFinding and not repaired. The "
                "graphs urn:regesta:run:...:revised:<uid> hold statements produced by LLM agents in frozen runs, "
                "status rv:unchecked, not checked by a historian; they are no statements of Regesta Imperii.",
                lang="en",
            ),
        )
    )
    union = Graph()
    for graph in graphs.values():
        union += graph
    g.add((dataset, VOID.triples, Literal(len(union), datatype=XSD.integer)))
    for name in sorted(graphs, key=str):
        g.add((dataset, DCTERMS.hasPart, name))
    for name in LAYERS[:-1]:
        g.add((GRAPH[name], PROV.wasAttributedTo, SCRIPT_AGENT))
    g.add((SCRIPT_AGENT, RDF.type, PROV.SoftwareAgent))
    g.add((SCRIPT_AGENT, RDFS.label, Literal("build_register_graph.py, deterministic export, no LLM", lang="en")))
    g.add((SCRIPT_AGENT, DCTERMS.identifier, Literal(f"sha256:{sha256(script)}")))
    for csv_path in (REGESTA_CSV, REGISTER_CSV):
        node = URIRef(f"urn:regesta:source:{csv_path.name}")
        g.add((dataset, PROV.wasDerivedFrom, node))
        g.add((node, RDFS.label, Literal(csv_path.name)))
        g.add((node, DCTERMS.identifier, Literal(f"sha256:{sha256(source / csv_path)}")))
    for uid, (run, graph) in sorted(proposals.items()):
        name = build_graph.graph_iri(run, uid)
        g.add((record_iri(uid), RR.proposals, name))
        g.add((name, PROV.wasDerivedFrom, URIRef(f"urn:regesta:run:{run}")))
        for agent in sorted(set(graph.objects(None, PROV.wasAttributedTo))):
            g.add((name, PROV.wasAttributedTo, agent))
    contracts = build_graph._agents(
        g, source, {uid: graph for uid, (_, graph) in proposals.items()}, {"counts": Counter()}
    )
    for contract, files in sorted(contracts.items()):
        node = URIRef(f"urn:regesta:{contract.replace('/', ':', 1)}")
        g.add((node, RDFS.label, Literal(contract)))
        for name, digest in sorted(files.items()):
            part = URIRef(f"{node}:{name}")
            g.add((node, DCTERMS.hasPart, part))
            g.add((part, RDFS.label, Literal(name)))
            g.add((part, DCTERMS.identifier, Literal(f"sha256:{digest}")))
    return g


def build_graphs(source: Path, texts: dict, export_date: str, script: Path) -> tuple[dict[URIRef, Graph], dict]:
    """All named graphs of the export and the facts the JSON writers need beside them."""
    regests = read_csv(source / REGESTA_CSV)
    register = read_csv(source / REGISTER_CSV)
    counts: Counter = Counter()
    findings_counts: Counter = Counter()
    records, roles, reg, findings = Graph(), Graph(), Graph(), Graph()
    _records(records, findings, findings_counts, regests, texts["source"]["idPattern"])
    _roles(roles, register)
    persons = register_names(source / REGISTER_CSV)
    iris, classes = _entries(reg, findings, findings_counts, register, persons)
    _rows(reg, findings, findings_counts, register, regests, iris)
    proposals = _proposals(source, {r["uid"] for r in regests}, counts)
    graphs: dict[URIRef, Graph] = {
        GRAPH["records"]: records,
        GRAPH["roles"]: roles,
        GRAPH["register"]: reg,
        GRAPH["findings"]: findings,
    }
    for uid, (run, graph) in proposals.items():
        graphs[build_graph.graph_iri(run, uid)] = graph
    graphs[GRAPH["description"]] = _description(source, texts, export_date, graphs, proposals, script)
    facts = {
        "regests": regests,
        "register": register,
        "iris": iris,
        "classes": classes,
        "proposals": {uid: build_graph.graph_iri(run, uid) for uid, (run, _) in proposals.items()},
        "counts": counts,
        "findings": findings_counts,
    }
    return graphs, facts


# The JSON-LD writer: key choice from CONTEXT, so the files and the context cannot disagree.


def _expand(curie: str) -> str:
    prefix, _, local = curie.partition(":")
    namespace = CONTEXT.get(prefix)
    return namespace + local if isinstance(namespace, str) and namespace.endswith(("/", "#")) else curie


class Writer:
    """Key tables derived once from CONTEXT; holds the graphs the views are cut from."""

    def __init__(self, graphs: dict[URIRef, Graph]) -> None:
        self.graphs = graphs
        self.prefixes = sorted(
            ((k, v) for k, v in CONTEXT.items() if isinstance(v, str) and v.endswith(("/", "#"))),
            key=lambda kv: -len(kv[1]),
        )
        self.keys: dict[tuple[str, Any], str] = {}
        self.vocab: dict[str, str] = {}
        self.order: dict[str, int] = {}
        self.sets: set[str] = {"type"}
        for position, (key, definition) in enumerate(CONTEXT.items()):
            self.order[key] = position
            if isinstance(definition, str):
                # A simple term naming a class, role or finding type, not a prefix or keyword.
                if not key.startswith("@") and ":" in definition and not definition.endswith(("/", "#")):
                    self.vocab[_expand(definition)] = key
                continue
            if not isinstance(definition, dict) or "@id" not in definition or definition["@id"].startswith("@"):
                continue
            iri, coercion = _expand(definition["@id"]), definition.get("@type")
            if coercion == "@id":
                kind: Any = "id"
            elif coercion == "@vocab":
                kind = "vocab"
            elif coercion:
                kind = ("dt", _expand(coercion))
            elif "@language" in definition:
                kind = ("lang", definition["@language"])
            else:
                kind = "plain"
            self.keys[(iri, kind)] = key
            if definition.get("@container") == "@set":
                self.sets.add(key)

    def compact(self, iri: str) -> str:
        for prefix, namespace in self.prefixes:
            if iri.startswith(namespace) and build_graph.LOCAL_NAME.fullmatch(iri[len(namespace) :]):
                return f"{prefix}:{iri[len(namespace) :]}"
        return iri

    def _entry(self, p: URIRef, o: Node) -> tuple[str, Any, bool]:
        """Key, value and whether the key always takes an array."""
        if p == RDF.type:
            return "type", self.vocab.get(str(o)) or self.compact(str(o)), True
        if isinstance(o, URIRef):
            if key := self.keys.get((str(p), "id")):
                return key, self.compact(str(o)), key in self.sets
            if key := self.keys.get((str(p), "vocab")):
                return key, self.vocab.get(str(o)) or self.compact(str(o)), key in self.sets
            return self.compact(str(p)), {"@id": self.compact(str(o))}, True
        if not isinstance(o, Literal):
            raise BuildError(f"no blank node may reach the JSON-LD writer: {o}")
        if o.language:
            kind: Any = ("lang", o.language)
            expanded = {"@value": str(o), "@language": o.language}
        elif o.datatype:
            kind = ("dt", str(o.datatype))
            expanded = {"@value": str(o), "@type": self.compact(str(o.datatype))}
        else:
            kind, expanded = "plain", {"@value": str(o)}
        if key := self.keys.get((str(p), kind)):
            return key, str(o), key in self.sets
        return self.compact(str(p)), expanded, True

    def node(
        self, graph: URIRef, s: URIRef, only: frozenset | None = None, skip: frozenset = frozenset()
    ) -> dict[str, Any]:
        values: dict[str, list] = defaultdict(list)
        arrays: set[str] = set()
        for p, o in self.graphs[graph].predicate_objects(s):
            if (only is not None and p not in only) or p in skip:
                continue
            key, value, always = self._entry(p, o)
            values[key].append(value)
            if always:
                arrays.add(key)
        out: dict[str, Any] = {"id": str(s)}
        for key in sorted(values, key=lambda k: (self.order.get(k, len(self.order)), k)):
            items = sorted(values[key], key=lambda v: json.dumps(v, ensure_ascii=False, sort_keys=True))
            out[key] = items if key in arrays or len(items) > 1 else items[0]
        return out

    def key_of(self, predicate: URIRef) -> str:
        return self.keys.get((str(predicate), "id")) or self.keys[(str(predicate), "vocab")]


ENTRY_SUMMARY = frozenset({RDF.type, DCTERMS.identifier, RDFS.label, SKOS.prefLabel, RR.registerType, RR.derivedLabel})
RECORD_SUMMARY = frozenset({DCTERMS.identifier, SCHEMA.startDate, SCHEMA.endDate, DCTERMS.temporal, DCTERMS.spatial})


class Views:
    """The file views: reverse indexes over the register and findings graphs, built once."""

    def __init__(self, writer: Writer, facts: dict) -> None:
        self.w = writer
        reg, findings = writer.graphs[GRAPH["register"]], writer.graphs[GRAPH["findings"]]
        self.rows_of_record: dict[URIRef, list[URIRef]] = defaultdict(list)
        self.rows_of_entry: dict[URIRef, list[URIRef]] = defaultdict(list)
        self.children: dict[URIRef, list[URIRef]] = defaultdict(list)
        self.findings: dict[URIRef, list[URIRef]] = defaultdict(list)
        for row, record in reg.subject_objects(RR.record):
            self.rows_of_record[record].append(row)
        for row, entry in reg.subject_objects(RR.entry):
            self.rows_of_entry[entry].append(row)
        for child, parent in reg.subject_objects(RR.parentEntry):
            self.children[parent].append(child)
        for finding, target in findings.subject_objects(RR.concerns):
            self.findings[target].append(finding)
        self.order = {record_iri(r["uid"]): regest_order(r) for r in facts["regests"]}
        self.proposals = facts["proposals"]
        self.label = {s: str(o) for s, o in reg.subject_objects(SKOS.prefLabel)}

    def _findings(self, target: URIRef) -> list[dict]:
        return [
            self.w.node(GRAPH["findings"], f, skip=frozenset({RR.concerns}))
            for f in sorted(self.findings.get(target, []))
        ]

    def _with_findings(self, node: dict, target: URIRef) -> dict:
        # Always an array, empty included, so the frontend iterates without a guard; an
        # empty reverse key states no triple.
        node["findings"] = self._findings(target)
        return node

    def _by_label(self, nodes: list[URIRef]) -> list[URIRef]:
        return sorted(nodes, key=lambda n: (self.label.get(n, "").casefold(), str(n)))

    def entry_summary(self, entry: URIRef) -> dict:
        return self.w.node(GRAPH["register"], entry, only=ENTRY_SUMMARY)

    def record(self, uid: str) -> dict:
        record = record_iri(uid)
        doc: dict[str, Any] = {"@context": "../context.jsonld"}
        doc |= self._with_findings(self.w.node(GRAPH["records"], record), record)
        rows = []
        reg = self.w.graphs[GRAPH["register"]]
        for row in sorted(self.rows_of_record.get(record, []), key=lambda r: self._row_key(reg, r)):
            node = self.w.node(GRAPH["register"], row, skip=frozenset({RR.record}))
            node.setdefault("roles", [])
            node["entry"] = self.entry_summary(reg.value(row, RR.entry))
            rows.append(self._with_findings(node, row))
        doc["rows"] = rows
        if uid in self.proposals:
            doc["proposals"] = {"id": str(self.proposals[uid]), "@graph": self._proposal_nodes(self.proposals[uid])}
        return doc

    def _row_key(self, reg: Graph, row: URIRef) -> tuple:
        entry = reg.value(row, RR.entry)
        return (self.label.get(entry, "").casefold(), str(entry), str(row))

    def _proposal_nodes(self, name: URIRef) -> list[dict]:
        g = self.w.graphs[name]
        nested = {o for p in (RF.evidence, RF.reference) for o in g.objects(None, p)}
        nodes = []
        for s in sorted({s for s in g.subjects() if s not in nested}, key=str):
            node = self.w.node(name, s)
            for p in (RF.evidence, RF.reference):
                objects = sorted(g.objects(s, p), key=str)
                if objects:
                    node[self.w.key_of(p)] = [self.w.node(name, o) for o in objects]
            nodes.append(node)
        return nodes

    def _parent_chain(self, entry: URIRef, seen: frozenset) -> dict:
        reg = self.w.graphs[GRAPH["register"]]
        node = self.w.node(GRAPH["register"], entry, only=ENTRY_SUMMARY | {RR.parentEntry})
        parent = reg.value(entry, RR.parentEntry)
        if parent is not None and parent not in seen:
            node["parent"] = self._parent_chain(parent, seen | {parent})
        return node

    def entry(self, entry: URIRef) -> dict:
        reg = self.w.graphs[GRAPH["register"]]
        doc: dict[str, Any] = {"@context": "../context.jsonld"}
        doc |= self._with_findings(self.w.node(GRAPH["register"], entry), entry)
        parent = reg.value(entry, RR.parentEntry)
        if parent is not None:
            doc["parent"] = self._parent_chain(parent, frozenset({entry, parent}))
        doc["children"] = [self.entry_summary(c) for c in self._by_label(self.children.get(entry, []))]
        occurrences = []
        rows = self.rows_of_entry.get(entry, [])
        records = {row: sorted(reg.objects(row, RR.record), key=lambda r: self.order[r]) for row in rows}
        for row in sorted(rows, key=lambda r: ([self.order[x] for x in records[r]], str(r))):
            node = self.w.node(GRAPH["register"], row, skip=frozenset({RR.entry}))
            node.setdefault("roles", [])
            if records[row]:
                node["record"] = [self.w.node(GRAPH["records"], r, only=RECORD_SUMMARY) for r in records[row]]
            occurrences.append(self._with_findings(node, row))
        doc["occurrences"] = occurrences
        return doc

    def graph_doc(self, name: URIRef) -> dict:
        subjects = sorted(set(self.w.graphs[name].subjects()), key=str)
        return {"@context": "context.jsonld", "@graph": [self.w.node(name, s) for s in subjects]}


def _normalise(text: str) -> str:
    """Search form: lower case, diacritics stripped, and where different the umlaut-folded form beside it."""
    lower = " ".join(text.lower().split())

    def strip(s: str) -> str:
        return "".join(c for c in unicodedata.normalize("NFD", s) if not unicodedata.combining(c)).replace("ß", "ss")

    folded = lower.replace("ä", "ae").replace("ö", "oe").replace("ü", "ue")
    stripped, umlauts = strip(lower), strip(folded)
    return stripped if stripped == umlauts else f"{stripped} {umlauts}"


def _index(graphs: dict[URIRef, Graph], facts: dict, views: Views) -> dict:
    reg = graphs[GRAPH["register"]]
    entries = []
    for entry_id, iri in sorted(facts["iris"].items()):
        label = reg.value(iri, RDFS.label) or reg.value(iri, RR.derivedLabel)
        short = reg.value(iri, SKOS.prefLabel)
        entries.append(
            {
                "id": entry_id,
                "iri": str(iri),
                "label": str(label) if label is not None else None,
                "shortLabel": str(short) if short is not None else None,
                "class": facts["classes"][entry_id],
                "rows": len(views.rows_of_entry.get(iri, [])),
                "search": _normalise(" ".join(dict.fromkeys(str(t) for t in (short, label) if t is not None))),
            }
        )
    regests = [
        {
            "uid": r["uid"],
            "identifier": r["identifier"],
            "startDate": r["start_date"],
            "endDate": r["end_date"],
            "dating": plain_text(r["date_string"]) or None,
            "place": None if is_null(r["locality_string"]) else plain_text(r["locality_string"]) or None,
        }
        for r in sorted(facts["regests"], key=regest_order)
    ]
    return {"entries": entries, "regests": regests}


def _prefixes() -> dict[str, str]:
    return build_graph._prefixes(build_graph.RF_DEFAULT, build_graph.RV_DEFAULT) | {
        "rr": str(RR),
        "rrole": str(RROLE),
        "geo": str(GEO),
    }


def _write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n")


def write(out: Path, graphs: dict[URIRef, Graph], facts: dict, export_date: str) -> dict:
    """Write TriG, JSON-LD views, index and report; return the report."""
    prefixes = _prefixes()
    out.mkdir(parents=True, exist_ok=True)
    header = (
        "# RI IV,2 regests and register as RDF, exported by build_register_graph.py. Data CC BY 4.0; source\n"
        "# Regesta Imperii (RI IV,2), modified. The graphs urn:regesta:run:... hold LLM proposals, unchecked.\n"
        + "\n".join(f"@prefix {p}: <{ns}> ." for p, ns in sorted(prefixes.items()))
        + "\n\n"
    )
    body = "\n".join(
        f"<{name}> {{\n{build_graph._statements(graphs[name], prefixes, '    ')}}}\n"
        for name in sorted(graphs, key=str)
    )
    (out / TRIG_NAME).write_text(header + body, encoding="utf-8", newline="\n")
    _write_json(out / "context.jsonld", {"@context": CONTEXT})

    writer = Writer(graphs)
    views = Views(writer, facts)
    written: dict[str, set[str]] = {"record": set(), "entry": set()}
    for folder in written:
        (out / folder).mkdir(exist_ok=True)
    for r in facts["regests"]:
        name = f"{r['uid']}.jsonld"
        _write_json(out / "record" / name, views.record(r["uid"]))
        written["record"].add(name)
    for entry_id, iri in sorted(facts["iris"].items()):
        name = f"{entry_id}.jsonld"
        _write_json(out / "entry" / name, views.entry(iri))
        written["entry"].add(name)
    stale = [p for folder, names in written.items() for p in (out / folder).glob("*.jsonld") if p.name not in names]
    for path in stale:
        path.unlink()
    _write_json(out / "roles.jsonld", views.graph_doc(GRAPH["roles"]))
    _write_json(out / "dataset.jsonld", views.graph_doc(GRAPH["description"]))
    _write_json(out / "index.json", _index(graphs, facts, views))

    reg = graphs[GRAPH["register"]]
    report = {
        "date": export_date,
        "trig": TRIG_NAME,
        "counts": {
            "records": len(facts["regests"]),
            "registerRows": len(set(reg.subjects(RDF.type, RR.RegisterRow))),
            "registerCsvRows": len(facts["register"]),
            "entries": dict(sorted(Counter(facts["classes"].values()).items())),
            "proposalGraphs": len(facts["proposals"]),
            "files": {"record": len(written["record"]), "entry": len(written["entry"])},
            "staleFilesRemoved": len(stale),
            **dict(sorted(facts["counts"].items())),
        },
        "graphs": {
            str(name): len(graphs[name])
            for name in sorted(graphs, key=str)
            if not str(name).startswith("urn:regesta:run:")
        },
        "proposalTriples": sum(len(g) for n, g in graphs.items() if str(n).startswith("urn:regesta:run:")),
        "findings": dict(sorted(facts["findings"].items())),
    }
    _write_json(out / "report.json", report)
    return report


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    here = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--source", type=Path, default=here / "pipeline")
    parser.add_argument("--out", type=Path, default=here / "demo" / "registernetz" / "data")
    parser.add_argument("--date", default=date.today().isoformat(), help="export date, ISO; default today")
    parser.add_argument("--texts", type=Path, default=here / "edition" / "texts.json")
    args = parser.parse_args()
    if args.out.resolve().is_relative_to(args.source.resolve()):
        print("FEHLER refusing to write into the pipeline folder", file=sys.stderr)
        return 2
    try:
        date.fromisoformat(args.date)
        graphs, facts = build_graphs(args.source, load_json(args.texts), args.date, Path(__file__).resolve())
        report = write(args.out, graphs, facts, args.date)
    except (BuildError, ValueError) as exc:
        print(f"FEHLER export failed: {exc}", file=sys.stderr)
        return 1
    print(f"OK wrote {args.out}")
    print("OK counts", json.dumps(report["counts"], ensure_ascii=False))
    print("WARNUNG findings (reported, not repaired)", json.dumps(report["findings"]), file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
