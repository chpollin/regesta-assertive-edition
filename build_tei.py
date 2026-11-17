"""Generate one TEI P5 file per regest from the source CSV fields and the factoids of a run.

Regime: script of the edition's script pipeline (pyproject.toml, uv.lock); it imports
edition_io.py. It reads one run of the pipeline folder and never writes there.

Data flow
    runs/<run>/manifest.json            run id, LLM, selection, source and contract hashes
    runs/<run>/packets/<uid>.json       summary_plain (the regest text the evidence refers to)
    runs/<run>/<stage>/<uid>.ttl        validated factoids
    runs/<run>/validation/<stage>.json  technical result per record
    runs/<run>/review/*.json            reviewers, findings and adjudication
    runs/<run>/revised/corrections.json corrections (revised stage only)
    contracts/<run>/ontology/vocabulary.ttl
                                        German labels of factoid types, roles, status
    source-material/RI_004-002-ReggBarbarossa.csv
                                        identifier, persistent_identifier, dating, place,
                                        transmission, commentary, external links
    edition/texts.json                  title, subtitle, definition, licence, attribution
        -> <out>/<slug>.xml             one TEI document per regest

Usage
    uv run build_tei.py --out site/tei                the shown run (edition_io.SHOWN_RUN)
    uv run build_tei.py --out site/tei --schema schema/tei_all-4.12.0.rng

Encoding rules (the documented loss is recorded in knowledge/data.md)
- The regest text is summary_plain, rendered losslessly in one <p>. The text is cut at every
  boundary of an evidence selector and of a located name; every piece covered by evidence is
  a <seg type="evidence">, and a located name wraps its pieces in <persName> or <orgName>
  with @ref to the actor in <standOff>. Overlapping evidence of different factoids therefore
  never needs crossing elements.
- Every factoid is an <event> in <listEvent>, @type act or state after its RDF class and
  @subtype the local name of its factoid type. @corresp lists the evidence pieces, @resp
  the producing agent from prov:wasAttributedTo, @ana the verification status as a category
  of the taxonomy in <classDecl>. TEI has no standOff container for states; <event> with
  @type state is the closest one and the choice is deliberate.
- Each rf:Reference is a <relation> in <listRelation type="reference">, @name the role,
  @active the actor, @passive the factoid. rf:partOf and rf:refersToAct are relations of
  <listRelation type="link">. Concerned rights and things and the exact-wording literals are
  <note> elements of the event.
- The RDF stays the source of truth. Output is deterministic for the same inputs.
"""

from __future__ import annotations

import argparse
import re
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from itertools import pairwise
from pathlib import Path

import rdflib
from lxml import etree
from rdflib import RDF, RDFS, SKOS, BNode, Literal, URIRef

from edition_io import REGESTA_CSV, SHOWN_RUN, BuildError, load_json, read_csv, sha256

TEI_NS = "http://www.tei-c.org/ns/1.0"
XML_NS = "http://www.w3.org/XML/1998/namespace"
RF = rdflib.Namespace("https://example.org/regesta/factoid/")
RV = rdflib.Namespace("https://example.org/regesta/concept/")
OA = rdflib.Namespace("http://www.w3.org/ns/oa#")
PROV = rdflib.Namespace("http://www.w3.org/ns/prov#")
CRM = rdflib.Namespace("http://www.cidoc-crm.org/cidoc-crm/")

FACTOID_CLASSES = {RF.ActFactoid: "act", RF.StateFactoid: "state"}
LITERALS = {
    RF.condition: "condition",
    RF.exception: "exception",
    RF.ground: "ground",
    RF.amount: "amount",
    RF.qualifier: "qualifier",
}
LINKS = {RF.partOf: "partOf", RF.refersToAct: "refersToAct"}
TAG_RE = re.compile(r"<[^>]+>")
LINK_RE = re.compile(r"<link\s+(\S+)[^>]*>(.*?)</link>", re.S)
RUN_DATE_RE = re.compile(r"(\d{4}-\d{2}-\d{2})$")


@dataclass(frozen=True)
class Actor:
    iri: str
    xml_id: str
    kind: str  # person or group
    label: str


@dataclass
class Context:
    """Run-wide inputs shared by every regest of the run."""

    run_id: str
    run_date: str
    stage: str
    manifest: dict
    labels: dict[str, str]
    texts: dict
    reviewers: list[str]
    findings: dict[str, int]
    decisions: dict[str, int]
    corrections: dict[str, list[str]]
    corrector: str | None
    validator_sha: str
    technical: dict[str, bool] = field(default_factory=dict)


def slug(identifier: str) -> str:
    """Address of a regest from its RI identifier: "RI IV,2,1 n. 46" gives "iv-2-1-46".

    build_site.py derives the same slug and checks that each TEI file exists.
    """
    # Forgeries carry a dagger in their number ("n. †4", "n. D†318"); the address writes it
    # as "f", so "RI IV,2,1 n. †4" gives "iv-2-1-f4".
    match = re.fullmatch(r"RI ([IVXLC]+),(\d+),(\d+) n\. ([\w†]+)", identifier)
    if not match:
        raise BuildError(f"identifier without the RI pattern: {identifier}")
    return "-".join(match.groups()).replace("†", "f").lower()


def _t(tag: str) -> str:
    return f"{{{TEI_NS}}}{tag}"


def _el(parent: etree._Element, tag: str, text: str | None = None, **attrs: str) -> etree._Element:
    el = etree.SubElement(parent, _t(tag))
    for key, value in attrs.items():
        if value is None:
            continue
        name = f"{{{XML_NS}}}{key[4:]}" if key.startswith("xml_") else key
        el.set(name, value)
    if text is not None:
        el.text = text
    return el


def _plain(raw: str | None) -> str | None:
    """CSV markup as plain text; the delivery writes a missing value as the string null."""
    if raw is None or raw.strip() in ("", "null"):
        return None
    return re.sub(r"\s+", " ", TAG_RE.sub("", raw)).strip()


def _labels(source: Path, manifest: dict) -> dict[str, str]:
    """German prefLabels of the frozen vocabulary, checked against the manifest hash."""
    # The contract a run names (contract_dir), else contracts/<run_id>, as in build_data.py.
    vocabulary = (
        source / manifest.get("contract_dir", f"contracts/{manifest['run_id']}") / "ontology" / "vocabulary.ttl"
    )
    if not vocabulary.is_file():
        raise BuildError(f"missing input file {vocabulary}")
    if manifest.get("contract_sha256", {}).get("ontology/vocabulary.ttl") != sha256(vocabulary):
        raise BuildError(f"{vocabulary} does not match the contract hash of the manifest")
    g = rdflib.Graph().parse(vocabulary, format="turtle")
    return {
        str(c): str(lab)
        for c, lab in g.subject_objects(SKOS.prefLabel)
        if isinstance(lab, Literal) and lab.language == "de"
    }


def _label(ctx: Context, iri: object, where: str) -> str:
    if iri is None or str(iri) not in ctx.labels:
        raise BuildError(f"{where}: concept without German prefLabel: {iri}")
    return ctx.labels[str(iri)]


def _local(iri: object) -> str:
    return re.split(r"[/#:]", str(iri))[-1]


def _ncname(text: str) -> str:
    """A safe xml:id fragment from an IRI local name."""
    out = re.sub(r"[^A-Za-z0-9._-]", "-", text)
    return out if re.match(r"[A-Za-z_]", out) else f"x{out}"


def _context(source: Path, run_id: str, stage: str, texts: dict) -> Context:
    run = source / "runs" / run_id
    manifest = load_json(run / "manifest.json")
    validation = load_json(run / "validation" / f"{stage}.json")
    if validation.get("stage") != stage:
        raise BuildError(f"validation report is not the {stage} stage")
    date = RUN_DATE_RE.search(run_id)
    if not date:
        raise BuildError(f"run id without a trailing date: {run_id}")
    reviewers, findings, decisions = [], defaultdict(int), defaultdict(int)
    for path in sorted((run / "review").glob("review-*.json")):
        review = load_json(path)
        reviewers.append(review["reviewer"])
        for rec in review["records"]:
            findings[rec["uid"]] += len(rec["findings"])
    adjudication = run / "review" / "adjudication.json"
    if adjudication.is_file():
        for dec in load_json(adjudication)["decisions"]:
            for uid in dec["uids"]:
                decisions[uid] += 1
    corrections: dict[str, list[str]] = defaultdict(list)
    corrector = None
    if stage == "revised":
        data = load_json(run / "revised" / "corrections.json")
        corrector = data.get("corrector")
        for rec in data["records"]:
            # One change per record in the factoid run, a list of changes in the 1153 slice.
            corrections[rec["uid"]].extend(rec.get("changes") or [rec["change"]])
    technical = {r["uid"]: bool(validation["technical_pass"]) and not r["issues"] for r in validation["records"]}
    return Context(
        run_id=manifest["run_id"],
        run_date=date.group(1),
        stage=stage,
        manifest=manifest,
        labels=_labels(source, manifest),
        texts=texts,
        reviewers=reviewers,
        findings=findings,
        decisions=decisions,
        corrections=corrections,
        corrector=corrector,
        validator_sha=validation.get("validator_sha256", ""),
        technical=technical,
    )


def _locate(text: str, needle: str, where: str, within: list[tuple[int, int]] | None = None) -> tuple[int, int]:
    """Offsets of a verbatim passage, searched inside the given ranges first."""
    for start, end in within or []:
        at = text.find(needle, start, end)
        if at >= 0:
            return at, at + len(needle)
    at = text.find(needle)
    if at < 0:
        raise BuildError(f"{where}: passage not verbatim in summary_plain: {needle!r}")
    return at, at + len(needle)


def _factoid_data(g: rdflib.Graph, uid: str, text: str) -> tuple[list[dict], dict[str, Actor]]:
    """Factoids with evidence ranges and references, and the actors they name."""
    actors: dict[str, Actor] = {}
    for iri in sorted({str(a) for a in g.objects(None, RF.actor)}):
        node = URIRef(iri)
        if (node, RDF.type, CRM.E74_Group) in g:
            kind = "group"
        elif (node, RDF.type, CRM.E21_Person) in g or (node, RDF.type, RF.FunctionalActor) in g:
            kind = "person"
        else:
            raise BuildError(f"{uid}: actor {iri} is neither person nor group")
        label = g.value(node, RDFS.label)
        actors[iri] = Actor(iri, f"a{len(actors) + 1}", kind, str(label) if label is not None else _local(iri))
    factoids = []
    for f in sorted({f for cls in FACTOID_CLASSES for f in g.subjects(RDF.type, cls)}, key=str):
        claim = _local(f)
        ranges = []
        for sel in g.objects(f, RF.evidence):
            exact = g.value(sel, OA.exact)
            if exact is None:
                raise BuildError(f"{uid} {claim}: evidence selector without oa:exact")
            ranges.append(_locate(text, str(exact), f"{uid} {claim}"))
        if not ranges:
            raise BuildError(f"{uid} {claim}: factoid without evidence")
        ranges.sort()
        refs = []
        for ref in g.objects(f, RF.reference):
            actor, role = g.value(ref, RF.actor), g.value(ref, RF.role)
            if actor is None or role is None:
                raise BuildError(f"{uid} {claim}: reference without actor or role")
            name = g.value(ref, RF.nameInSource)
            refs.append({"actor": str(actor), "role": role, "name": str(name) if name is not None else None})
        refs.sort(key=lambda r: (str(r["role"]), r["actor"]))
        kind = next(k for cls, k in FACTOID_CLASSES.items() if (f, RDF.type, cls) in g)
        factoids.append(
            {
                "iri": f,
                "claim": claim,
                "xml_id": f"f-{_ncname(claim)}",
                "kind": kind,
                "type": g.value(f, RF.factoidType),
                "agent": g.value(f, PROV.wasAttributedTo),
                "status": g.value(f, RF.verificationStatus),
                "ranges": ranges,
                "refs": refs,
                "concerns": sorted(g.objects(f, RF.concerns), key=str),
                "links": [(name, o) for p, name in LINKS.items() for o in sorted(g.objects(f, p), key=str)],
                "literals": [(name, str(o)) for p, name in LITERALS.items() for o in sorted(g.objects(f, p), key=str)],
            }
        )
    return factoids, actors


def _names(text: str, factoids: list[dict], actors: dict[str, Actor], uid: str) -> list[tuple[int, int, Actor]]:
    """Located names in the text, each inside its factoid's evidence where possible.

    A name that overlaps a name already placed is not marked again; the reference itself
    stays complete in standOff.
    """
    found: dict[tuple[int, int], Actor] = {}
    for f in factoids:
        for ref in f["refs"]:
            if not ref["name"] or ref["name"] not in text:
                continue
            start, end = _locate(text, ref["name"], f"{uid} {f['claim']} name", f["ranges"])
            found.setdefault((start, end), actors[ref["actor"]])
    placed: list[tuple[int, int, Actor]] = []
    for (start, end), actor in sorted(found.items(), key=lambda kv: (kv[0][0], -kv[0][1])):
        if all(end <= s or start >= e for s, e, _ in placed):
            placed.append((start, end, actor))
    return placed


def _text_body(p: etree._Element, text: str, factoids: list[dict], names: list, prefix: str) -> dict[str, list[str]]:
    """Fill <p> with the regest text cut into evidence pieces; return the pieces per factoid."""
    cuts = {0, len(text)}
    for f in factoids:
        for start, end in f["ranges"]:
            cuts |= {start, end}
    for start, end, _ in names:
        cuts |= {start, end}
    bounds = sorted(cuts)
    pieces_of: dict[str, list[str]] = defaultdict(list)
    current = p
    open_name: tuple[int, int, Actor] | None = None
    count = 0

    def add_text(node: etree._Element, chunk: str) -> None:
        if len(node):
            node[-1].tail = (node[-1].tail or "") + chunk
        else:
            node.text = (node.text or "") + chunk

    for start, end in pairwise(bounds):
        if open_name is None:
            match = next((n for n in names if n[0] == start), None)
            if match:
                open_name = match
                actor = match[2]
                current = _el(p, "persName" if actor.kind == "person" else "orgName", ref=f"#{actor.xml_id}")
        covering = [f for f in factoids if any(s <= start and end <= e for s, e in f["ranges"])]
        chunk = text[start:end]
        if covering:
            count += 1
            seg_id = f"{prefix}s{count}"
            _el(current, "seg", chunk, type="evidence", xml_id=seg_id)
            for f in covering:
                pieces_of[f["xml_id"]].append(seg_id)
        else:
            add_text(current, chunk)
        if open_name is not None and end == open_name[1]:
            open_name = None
            current = p
    return pieces_of


def _header(tei: etree._Element, ctx: Context, packet: dict, row: dict, agents: list[str], uid: str) -> None:
    texts = ctx.texts
    header = _el(tei, "teiHeader")
    file_desc = _el(header, "fileDesc")
    title_stmt = _el(file_desc, "titleStmt")
    _el(title_stmt, "title", packet["identifier"], type="main")
    _el(title_stmt, "title", f"{texts['title']}. {texts['subtitle']}", type="sub")
    model = ctx.manifest["model"]
    for agent in agents:
        rs = _el(title_stmt, "respStmt", xml_id=f"resp-{_ncname(_local(agent))}")
        _el(rs, "resp", f"Extraktion der Aussagen, unrevidierter LLM-basierter Agent ({model})")
        _el(rs, "name", _local(agent), ref=agent)
    rs = _el(title_stmt, "respStmt", xml_id="resp-validation")
    _el(rs, "resp", "Technische Prüfung, deterministischer Workflow")
    _el(rs, "name", "validate_factoid.py", ref=f"sha256:{ctx.validator_sha}" if ctx.validator_sha else None)
    for reviewer in ctx.reviewers:
        rs = _el(title_stmt, "respStmt", xml_id=f"resp-{_ncname(_local(reviewer))}")
        _el(rs, "resp", "Review der Aussagen, LLM-basierter Agent")
        _el(rs, "name", _local(reviewer), ref=reviewer)
    if ctx.corrections.get(uid) and ctx.corrector:
        rs = _el(title_stmt, "respStmt", xml_id="resp-correction")
        _el(rs, "resp", "Abwägung der Reviews und Korrektur, LLM-basierter Agent")
        _el(rs, "name", _local(ctx.corrector), ref=ctx.corrector)
    rs = _el(title_stmt, "respStmt", xml_id="resp-tei")
    _el(rs, "resp", "TEI-Erzeugung nach Regeln, deterministischer Workflow")
    _el(rs, "name", "build_tei.py")

    stage_de = "überarbeiteter Stand" if ctx.stage == "revised" else "extrahierter Stand"
    edition_stmt = _el(file_desc, "editionStmt")
    _el(edition_stmt, "edition", f"Fassung {texts['release']['version']}, Lauf {ctx.run_id}, {stage_de}")
    pub = _el(file_desc, "publicationStmt")
    _el(pub, "authority", texts["title"])
    avail = _el(pub, "availability", status="free")
    licence = _el(avail, "licence", target=texts["licences"]["data"]["url"])
    _el(licence, "p", texts["licenceLine"])
    _el(pub, "date", texts["release"]["state"], when=texts["release"]["date"])

    source_desc = _el(file_desc, "sourceDesc")
    bibl = _el(source_desc, "bibl", type="regest")
    _el(bibl, "title", "Regesta Imperii IV,2", level="m")
    _el(bibl, "idno", packet["identifier"], type="RI")
    pid = row["persistent_identifier"]
    _el(bibl, "idno", f"{texts['source']['idPattern']}{pid}", type="URI")
    _el(bibl, "ref", texts["source"]["name"], target=f"{texts['source']['idPattern']}{pid}")
    for target, label in LINK_RE.findall(row.get("external_links") or ""):
        _el(bibl, "ref", _plain(label), type="facsimile", target=target)
    bavail = _el(bibl, "availability", status="free")
    blicence = _el(bavail, "licence", target=texts["licences"]["data"]["url"])
    _el(blicence, "p", texts["attribution"])
    sha = ctx.manifest.get("source_sha256", {}).get("RI_004-002-ReggBarbarossa.csv")
    _el(
        bibl,
        "note",
        f"CSV-Export RI_004-002-ReggBarbarossa.csv, Zeile {packet['source_row']}, SHA-256 {sha}",
        type="export",
    )
    _el(bibl, "note", texts["modification"], type="modification")

    encoding = _el(header, "encodingDesc")
    project = _el(encoding, "projectDesc")
    _el(project, "p", texts["description"])
    _el(project, "p", texts["agenticEdition"]["definition"])
    editorial = _el(encoding, "editorialDecl")
    _el(
        editorial,
        "p",
        "Der Regesttext ist der Klartext des Regests (summary_plain). Belegstellen stehen als seg, "
        "Namen als persName oder orgName mit Verweis auf standOff. Jede Aussage ist ein event in "
        "listEvent, ihre Rollen sind relation-Elemente in listRelation. Die RDF-Daten des Laufs "
        "bleiben die maßgebliche Fassung.",
    )
    class_decl = _el(encoding, "classDecl")
    taxonomy = _el(class_decl, "taxonomy", xml_id="verification")
    for concept in sorted(
        {c for c in ctx.labels if c.startswith(str(RV))} & {str(RV.unchecked), str(RV.checked), str(RV.accepted)}
    ):
        cat = _el(taxonomy, "category", xml_id=f"vs-{_local(concept)}")
        _el(cat, "catDesc", ctx.labels[concept])

    revision = _el(header, "revisionDesc")
    when = ctx.run_date
    who = " ".join(f"#resp-{_ncname(_local(a))}" for a in agents)
    _el(
        revision, "change", f"Aussagen aus dem Regesttext extrahiert ({model}).", when=when, who=who, status="extracted"
    )
    passed = "bestanden" if ctx.technical.get(uid) else "nicht bestanden"
    _el(revision, "change", f"Technische Prüfung {passed}.", when=when, who="#resp-validation", status="validated")
    if ctx.reviewers:
        n_find, n_dec = ctx.findings.get(uid, 0), ctx.decisions.get(uid, 0)
        findings = "einem Befund" if n_find == 1 else f"{n_find} Befunden"
        decisions = "eine Entscheidung" if n_dec == 1 else f"{n_dec} Entscheidungen"
        _el(
            revision,
            "change",
            f"{len(ctx.reviewers)} Reviews mit {findings}, {decisions} der Abwägung.",
            when=when,
            who=" ".join(f"#resp-{_ncname(_local(r))}" for r in ctx.reviewers),
            status="reviewed",
        )
    for change in ctx.corrections.get(uid, []):
        _el(revision, "change", change, when=when, who="#resp-correction", status="revised", xml_lang="en")
    _el(revision, "change", "TEI nach Regeln erzeugt.", when=when, who="#resp-tei", status="encoded")
    _el(revision, "change", "Fachlich nicht geprüft.", when=when, status="not-expert-accepted")


def build_regest(ctx: Context, run: Path, uid: str, row: dict) -> etree._Element:
    """One TEI document for one regest of the run."""
    packet = load_json(run / "packets" / f"{uid}.json")
    text = packet["summary_plain"] or ""  # n. 107 of the delivery has no summary
    ttl = run / ctx.stage / f"{uid}.ttl"
    if not ttl.is_file():
        raise BuildError(f"missing {ctx.stage} Turtle for {uid}")
    g = rdflib.Graph().parse(ttl, format="turtle")
    factoids, actors = _factoid_data(g, uid, text)
    agents = sorted({str(f["agent"]) for f in factoids if f["agent"] is not None})
    if not agents:
        # A regest without factoids still names the extraction agent of its batch.
        batch = next(s["batch"] for s in ctx.manifest["selection"] if s["uid"] == uid)
        agents = [f"urn:regesta:agent:{ctx.run_id}:extraction-batch-{batch}"]

    tei = etree.Element(_t("TEI"), nsmap={None: TEI_NS})
    tei.set(f"{{{XML_NS}}}id", f"ri-{slug(packet['identifier'])}")
    tei.set(f"{{{XML_NS}}}lang", "de")
    _header(tei, ctx, packet, row, agents, uid)

    body = _el(_el(tei, "text"), "body")
    div = _el(body, "div", type="regest")
    head = _el(div, "head")
    date_text = _plain(packet.get("date_string"))
    place_text = _plain(packet.get("locality_string"))
    _el(head, "date", date_text or "ohne Datierung", **{"from": packet["machine_start"], "to": packet["machine_end"]})
    if place_text:
        head[-1].tail = ", "
        _el(head, "placeName", place_text)
    p = _el(div, "p")
    names = _names(text, factoids, actors, uid)
    pieces = _text_body(p, text, factoids, names, prefix="")
    for field_name, kind in (("original_date", "originalDating"), ("archival_history", "transmission")):
        value = _plain(row.get(field_name))
        if value:
            _el(_el(body, "div", type=kind), "p", value)
    for field_name in ("literature", "commentary", "footnotes"):
        value = _plain(row.get(field_name))
        if value:
            _el(_el(body, "div", type=field_name), "p", value)

    stand_off = _el(tei, "standOff")
    persons = [a for a in actors.values() if a.kind == "person"]
    groups = [a for a in actors.values() if a.kind == "group"]
    for items, list_tag, item_tag, name_tag in (
        (persons, "listPerson", "person", "persName"),
        (groups, "listOrg", "org", "orgName"),
    ):
        if not items:
            continue
        lst = _el(stand_off, list_tag)
        for a in items:
            item = _el(lst, item_tag, xml_id=a.xml_id)
            _el(item, name_tag, a.label)
            register = re.search(r"actor:(RI\d{3}-\d{3}-[A-Z]\d{6})", a.iri)
            if register:
                _el(item, "idno", register.group(1), type="register")
            _el(item, "idno", a.iri, type="URI")
    if factoids:
        events = _el(stand_off, "listEvent")
        roles = etree.Element(_t("listRelation"), type="reference")
        links = etree.Element(_t("listRelation"), type="link")
        for f in factoids:
            where = f"{uid} {f['claim']}"
            ev = _el(
                events,
                "event",
                xml_id=f["xml_id"],
                type=f["kind"],
                subtype=_local(f["type"]),
                corresp=" ".join(f"#{s}" for s in pieces[f["xml_id"]]),
                resp=f"#resp-{_ncname(_local(f['agent']))}" if f["agent"] is not None else None,
                ana=f"#vs-{_local(f['status'])}" if f["status"] is not None else None,
            )
            _el(ev, "label", _label(ctx, f["type"], where))
            _el(ev, "idno", str(f["iri"]), type="URI")
            for obj in f["concerns"]:
                label = g.value(obj, RDFS.label)
                obj_type = g.value(obj, CRM.P2_has_type)
                words = str(label) if label is not None else _local(obj)
                if obj_type is not None:
                    words = f"{_label(ctx, obj_type, where)} ({words})"
                _el(ev, "note", words, type="concerns", target=str(obj) if not isinstance(obj, BNode) else None)
            for kind, value in f["literals"]:
                _el(ev, "note", value, type=kind)
            for ref in f["refs"]:
                actor = actors[ref["actor"]]
                _el(
                    roles,
                    "relation",
                    name=_local(ref["role"]),
                    active=f"#{actor.xml_id}",
                    passive=f"#{f['xml_id']}",
                    resp=ev.get("resp"),
                )
            for name, obj in f["links"]:
                target = next((x for x in factoids if x["iri"] == obj), None)
                if target is None:
                    raise BuildError(f"{where}: {name} points outside the factoids of this regest")
                _el(links, "relation", name=name, active=f"#{f['xml_id']}", passive=f"#{target['xml_id']}")
        if len(roles):
            stand_off.append(roles)
        if len(links):
            stand_off.append(links)
    if not len(stand_off):
        tei.remove(stand_off)
    _check_spans(p, text, uid)
    return tei


def _check_spans(p: etree._Element, text: str, uid: str) -> None:
    """The rendered paragraph must give back the regest text character for character."""
    if "".join(p.itertext()) != text:
        raise BuildError(f"{uid}: TEI text differs from summary_plain")


def _serialise(tei: etree._Element) -> bytes:
    """Indent header and standOff only; mixed content of the text must keep its exact whitespace."""
    tei.text = "\n"
    for child in tei:
        if child.tag != _t("text"):
            etree.indent(child, space="  ", level=1)
        child.tail = "\n"
    return etree.tostring(tei, xml_declaration=True, encoding="UTF-8") + b"\n"


def _read_rows(csv_path: Path, uids: set[str]) -> dict[str, dict]:
    rows = {r["uid"]: r for r in read_csv(csv_path) if r["uid"] in uids}
    missing = uids - rows.keys()
    if missing:
        raise BuildError(f"regest CSV lacks rows for {sorted(missing)}")
    return rows


def build(source: Path, run_id: str, out: Path, stage: str, texts_path: Path, schema: Path | None) -> list[str]:
    """Write every TEI file of the run; return the collected validation errors."""
    texts = load_json(texts_path)
    ctx = _context(source, run_id, stage, texts)
    run = source / "runs" / run_id
    uids = [s["uid"] for s in ctx.manifest["selection"]]
    rows = _read_rows(source / REGESTA_CSV, set(uids))
    validator = etree.RelaxNG(etree.parse(str(schema))) if schema else None
    out.mkdir(parents=True, exist_ok=True)
    errors = []
    for uid in uids:
        tei = build_regest(ctx, run, uid, rows[uid])
        name = f"{slug(rows[uid]['identifier'])}.xml"
        data = _serialise(tei)
        (out / name).write_bytes(data)
        if validator is not None and not validator.validate(etree.fromstring(data)):
            errors += [f"{name}: line {e.line}: {e.message}" for e in validator.error_log]
    return errors


def main() -> int:
    here = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--source", type=Path, default=here / "pipeline")
    parser.add_argument("--run", default=SHOWN_RUN)
    parser.add_argument("--stage", choices=("extracted", "revised"), default="revised")
    parser.add_argument("--out", type=Path, default=here / "site" / "tei")
    parser.add_argument("--texts", type=Path, default=here / "edition" / "texts.json")
    parser.add_argument("--schema", type=Path, default=None, help="RELAX NG schema, e.g. schema/tei_all-4.12.0.rng")
    args = parser.parse_args()
    if args.out.resolve().is_relative_to(args.source.resolve()):
        print("refusing to write into the pipeline folder", file=sys.stderr)
        return 2
    try:
        errors = build(args.source, args.run, args.out, args.stage, args.texts, args.schema)
    except BuildError as exc:
        print(f"TEI build failed: {exc}", file=sys.stderr)
        return 1
    if errors:
        print(f"{len(errors)} schema errors:", *errors, sep="\n", file=sys.stderr)
        return 1
    checked = f", valid against {args.schema.name}" if args.schema else ", well-formed (no schema given)"
    print(f"wrote TEI to {args.out}{checked}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
