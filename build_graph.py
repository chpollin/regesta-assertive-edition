"""Export the revised stage of a factoid run as one reusable RDF graph, deterministically.

Regime: script of the edition's script pipeline (pyproject.toml, uv.lock); it imports
edition_io.py and register_names.py. It reads one run of the folder pipeline/ and never
writes there. The frozen run stays byte for byte as it is: every rewrite happens on a copy in
memory and goes to a gitignored build folder.

Data flow
    runs/<run>/manifest.json            selection, LLM, contract hashes, expert_accepted
    runs/<run>/revised/<uid>.ttl        the frozen statements, one file per regest
    runs/<run>/packets/<uid>.json       summary_plain, for the order of evidence selectors
    runs/<other>/manifest.json          LLM of a run whose agents a reused regest names
    contracts/<contract>/...            hashed against the manifests before use
    source-material/*.csv               regest fields (shared reader), register names
    edition/texts.json                  persistent link pattern, licence, attribution
        -> <out>/<run>.trig             one named graph per regest, an enrichment graph and
                                        a description graph
        -> <out>/<run>.ttl              the union of all graphs as Turtle
        -> <out>/<run>-report.json      counts and every finding (invalid dates and the like)

Usage
    uv run run.py export
    uv run build_graph.py --run <run> --out data/graph --date 2026-11-17
    uv run build_graph.py --rf-namespace <iri> --rv-namespace <iri>

Design decisions
- Named graphs. Each frozen file becomes the graph urn:regesta:run:<run>:revised:<uid> and
  holds exactly its statements after the documented rewrites below, so a check can restore
  the file from it. Everything the export adds stands in two further graphs, the enrichment
  (records, agents, register names) and the dataset description, whose producer is this
  deterministic script and not an LLM.
- Records. Each urn:regesta:record:<uid> gets from the regest CSV rdfs:label and
  dcterms:identifier with the RI identifier, schema:startDate and schema:endDate as xsd:date
  where the delivered date parses as an ISO calendar date, the dating prose as
  dcterms:temporal and the place string as dcterms:spatial (plain text, @de), and
  rdfs:seeAlso to the persistent link https://www.regesta-imperii.de/id/<persistent_identifier>
  (knowledge/data.md, TEI per regest; the pattern is read from edition/texts.json). An
  unparsable date, a reversed interval, a missing persistent identifier and a frozen record
  label that differs from the CSV identifier are reported, never repaired. Dublin Core
  recommends a non-literal for temporal and spatial; the delivery's prose is unnormalised, so
  it stays a literal and no period or place node is minted.
- Skolemisation. Blank-node references and evidence selectors become
  <factoid>:reference-<n> and <factoid>:evidence-<n>, numbered from 1 in a canonical order:
  selectors by the position of oa:exact in summary_plain, then its length and wording;
  references by role IRI, actor IRI and rf:nameInSource, the order build_tei.py uses. Ties
  fall back to the sorted N-Triples of the node's own statements, which only identical nodes
  share. A blank node elsewhere, one with more than one incoming statement or a skolem IRI
  that already exists aborts the export.
- Language. Every plain literal of a frozen file is German regest text or an agent's German
  label written from it, so it gets @de; Latin insertions stay inside the German literal. The
  one exception is the rdfs:label of a crm:E31_Document, an RI identifier, which stays plain.
- Agents. Each prov:wasAttributedTo agent, urn:regesta:agent:<run>:<unit>, becomes a
  prov:SoftwareAgent. Its run is a prov:Activity with a prov:qualifiedAssociation naming the
  agent, its stage as prov:Role and the frozen prompt of that stage as prov:Plan with its
  hash; the run is also associated with the LLM its manifest names. This serves proposed
  extension 1 of knowledge/factoid-model.md (described producer) from the manifest, without
  changing the contract.
- Register names. Register persons among the actors get a normalised skos:prefLabel@de from
  register_names.py beside their source-form rdfs:label values; the pool for disambiguation
  is the register persons of the export.
- Description. VoID, because the export is one RDF dataset and VoID describes exactly that
  (size, vocabularies, licence, source); DCAT's catalogue and distribution layers have no
  object here. It states licence CC BY 4.0, Regesta Imperii as source with its attribution
  text, the run, the contract with the hash of each file, the export date, and that the
  statements are produced by LLM agents and unchecked (expert_accepted from the manifest).
- Namespaces. The rf: and rv: terms carry provisional example.org namespaces; the stable one
  is an open decision of the operator. --rf-namespace and --rv-namespace rewrite every IRI in
  those namespaces and default to the current ones.
- Determinism. The writer sorts graphs, subjects, predicates and objects as text and writes
  no blank node, so the same inputs and --date give byte-identical files.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

from rdflib import RDF, RDFS, SKOS, XSD, BNode, Graph, Literal, Namespace, URIRef
from rdflib.term import Node

from edition_io import (
    REGESTA_CSV,
    REGISTER_CSV,
    SHOWN_RUN,
    BuildError,
    is_null,
    load_json,
    plain_text,
    read_csv,
    sha256,
)
from register_names import register_names

RF_DEFAULT = "https://example.org/regesta/factoid/"
RV_DEFAULT = "https://example.org/regesta/concept/"
RF = Namespace(RF_DEFAULT)
RV = Namespace(RV_DEFAULT)
CRM = Namespace("http://www.cidoc-crm.org/cidoc-crm/")
OA = Namespace("http://www.w3.org/ns/oa#")
PROV = Namespace("http://www.w3.org/ns/prov#")
DCTERMS = Namespace("http://purl.org/dc/terms/")
SCHEMA = Namespace("https://schema.org/")
VOID = Namespace("http://rdfs.org/ns/void#")
STAGE = "revised"
AGENT_RE = re.compile(r"urn:regesta:agent:([^:]+):((extraction)-batch-(\d+)|(correction)-g(\d+))")
REGISTER_ACTOR_RE = re.compile(r"urn:regesta:actor:(RI\d{3}-\d{3}-[A-Z]\d{6})")
STAGE_PROMPT = {"extraction": "prompts/extract.md", "correction": "prompts/correct.md"}
LOCAL_NAME = re.compile(r"[A-Za-z_][A-Za-z0-9_-]*")


def graph_iri(run: str, uid: str) -> URIRef:
    return URIRef(f"urn:regesta:run:{run}:{STAGE}:{uid}")


def enrichment_iri(run: str) -> URIRef:
    return URIRef(f"urn:regesta:export:{run}:enrichment")


def description_iri(run: str) -> URIRef:
    return URIRef(f"urn:regesta:export:{run}:description")


def _contract_dir(manifest: dict) -> str:
    # The contract a run names (contract_dir), else contracts/<run_id>, as in build_tei.py.
    return manifest.get("contract_dir", f"contracts/{manifest['run_id']}")


def _verify_contract(source: Path, manifest: dict) -> None:
    """Every contract file a manifest hashes must still match, or the description would lie."""
    contract = source / _contract_dir(manifest)
    for name, expected in manifest["contract_sha256"].items():
        if sha256(contract / name) != expected:
            raise BuildError(f"{contract / name} does not match the hash in the manifest of {manifest['run_id']}")


def _load_stage(run_dir: Path, uids: list[str]) -> dict[str, Graph]:
    stage_dir = run_dir / STAGE
    files = {p.stem for p in stage_dir.glob("*.ttl")}
    if files != set(uids):
        raise BuildError(f"{stage_dir}: Turtle files and manifest selection differ by {sorted(files ^ set(uids))}")
    return {uid: Graph().parse(stage_dir / f"{uid}.ttl", format="turtle") for uid in uids}


def _canonical(g: Graph, node: BNode) -> list[tuple[str, str]]:
    return sorted((p.n3(), o.n3()) for p, o in g.predicate_objects(node))


def _skolemise(g: Graph, text: str, uid: str) -> tuple[Graph, int, int]:
    """The file with every reference and selector blank node replaced by a stable IRI."""
    mapping: dict[BNode, URIRef] = {}
    counts = {"reference": 0, "evidence": 0}

    def selector_key(b: BNode) -> tuple:
        exact = str(g.value(b, OA.exact) or "")
        return (text.find(exact), len(exact), exact, _canonical(g, b))

    def reference_key(b: BNode) -> tuple:
        return (
            str(g.value(b, RF.role) or ""),
            str(g.value(b, RF.actor) or ""),
            str(g.value(b, RF.nameInSource) or ""),
            _canonical(g, b),
        )

    for factoid in sorted({s for s, _, o in g if isinstance(o, BNode)}, key=str):
        if isinstance(factoid, BNode):
            raise BuildError(f"{uid}: nested blank node under {factoid}")
        for predicate, kind, key in (
            (RF.evidence, "evidence", selector_key),
            (RF.reference, "reference", reference_key),
        ):
            nodes = sorted((o for o in g.objects(factoid, predicate) if isinstance(o, BNode)), key=key)
            for number, node in enumerate(nodes, start=1):
                mapping[node] = URIRef(f"{factoid}:{kind}-{number}")
                counts[kind] += 1
    blanks = {t for triple in g for t in triple if isinstance(t, BNode)}
    if blanks - mapping.keys():
        raise BuildError(f"{uid}: blank node outside rf:evidence and rf:reference")
    for node in mapping:
        if len(set(g.subject_predicates(node))) != 1:
            raise BuildError(f"{uid}: blank node {node} is not the object of exactly one statement")
    existing = {t for triple in g for t in triple if isinstance(t, URIRef)}
    if existing & set(mapping.values()):
        raise BuildError(f"{uid}: a skolem IRI already exists in the file")
    out = Graph()
    for triple in g:
        out.add(tuple(mapping.get(t, t) for t in triple))
    return out, counts["reference"], counts["evidence"]


def _tag_german(g: Graph) -> tuple[Graph, int]:
    """Plain literals become @de, except the RI identifier that labels a record."""
    records = set(g.subjects(RDF.type, CRM.E31_Document))
    out, tagged = Graph(), 0
    for s, p, o in g:
        if (
            isinstance(o, Literal)
            and o.language is None
            and o.datatype is None
            and not (s in records and p == RDFS.label)
        ):
            o = Literal(str(o), lang="de")
            tagged += 1
        out.add((s, p, o))
    return out, tagged


def _records(enrichment: Graph, rows: dict[str, dict], frozen: dict[str, Graph], pattern: str, report: dict) -> None:
    for uid, row in sorted(rows.items()):
        record = URIRef(f"urn:regesta:record:{uid}")
        identifier = row["identifier"]
        enrichment.add((record, RDFS.label, Literal(identifier)))
        enrichment.add((record, DCTERMS.identifier, Literal(identifier)))
        for label in frozen[uid].objects(record, RDFS.label):
            if str(label) != identifier:
                report["findings"]["recordLabelDiffers"].append({"uid": uid, "frozen": str(label), "csv": identifier})
        parsed = {}
        for field, predicate in (("start_date", SCHEMA.startDate), ("end_date", SCHEMA.endDate)):
            try:
                parsed[field] = date.fromisoformat(row[field])
            except ValueError:
                report["findings"]["invalidDates"].append({"uid": uid, "field": field, "value": row[field]})
                continue
            enrichment.add((record, predicate, Literal(row[field], datatype=XSD.date)))
        if len(parsed) == 2 and parsed["start_date"] > parsed["end_date"]:
            report["findings"]["reversedIntervals"].append(
                {"uid": uid, "start": row["start_date"], "end": row["end_date"]}
            )
        for field, predicate in (("date_string", DCTERMS.temporal), ("locality_string", DCTERMS.spatial)):
            if not is_null(row[field]):
                enrichment.add((record, predicate, Literal(plain_text(row[field]), lang="de")))
        if is_null(row["persistent_identifier"]):
            report["findings"]["missingPersistentIdentifier"].append(uid)
        else:
            enrichment.add((record, RDFS.seeAlso, URIRef(f"{pattern}{row['persistent_identifier'].strip()}")))
        report["counts"]["recordsEnriched"] += 1


def _agents(enrichment: Graph, source: Path, graphs: dict[str, Graph], report: dict) -> dict[str, dict]:
    """Describe every producing agent; return the hashes per contract directory the plans come from."""
    agents = sorted({str(o) for g in graphs.values() for o in g.objects(None, PROV.wasAttributedTo)})
    contracts: dict[str, dict] = {}
    for iri in agents:
        match = AGENT_RE.fullmatch(iri)
        if not match:
            raise BuildError(f"agent {iri} has no known form (extraction-batch-N or correction-gN)")
        run_id, unit = match.group(1), match.group(2)
        stage = match.group(3) or match.group(5)
        manifest = load_json(source / "runs" / run_id / "manifest.json")
        _verify_contract(source, manifest)
        contract = _contract_dir(manifest)
        # Hashes verified against the files above, so runs sharing a contract agree on them.
        contracts.setdefault(contract, {}).update(manifest["contract_sha256"])
        model = manifest["model"]
        agent, run = URIRef(iri), URIRef(f"urn:regesta:run:{run_id}")
        association = URIRef(f"{iri}:association")
        role = URIRef(f"urn:regesta:stage:{stage}")
        llm = URIRef(f"urn:regesta:llm:{model}")
        plan = URIRef(f"urn:regesta:{contract.replace('/', ':', 1)}:{STAGE_PROMPT[stage]}")
        number = match.group(4) or match.group(6)
        unit_label = f"batch {number}" if stage == "extraction" else f"group {number}"
        enrichment.add((agent, RDF.type, PROV.SoftwareAgent))
        enrichment.add((agent, RDFS.label, Literal(f"{stage} {unit_label} of run {run_id}, LLM {model}", lang="en")))
        enrichment.add((agent, DCTERMS.identifier, Literal(unit)))
        enrichment.add((run, RDF.type, PROV.Activity))
        enrichment.add((run, RDFS.label, Literal(run_id)))
        enrichment.add((run, DCTERMS.identifier, Literal(run_id)))
        enrichment.add((run, PROV.wasAssociatedWith, agent))
        enrichment.add((run, PROV.wasAssociatedWith, llm))
        enrichment.add((run, PROV.qualifiedAssociation, association))
        enrichment.add((association, RDF.type, PROV.Association))
        enrichment.add((association, PROV.agent, agent))
        enrichment.add((association, PROV.hadRole, role))
        enrichment.add((association, PROV.hadPlan, plan))
        enrichment.add((role, RDF.type, PROV.Role))
        enrichment.add((role, RDFS.label, Literal(stage, lang="en")))
        enrichment.add((llm, RDF.type, PROV.SoftwareAgent))
        enrichment.add((llm, RDFS.label, Literal(model)))
        enrichment.add((plan, RDF.type, PROV.Plan))
        report["counts"]["agentsDescribed"] += 1
    return contracts


def _pref_labels(enrichment: Graph, register_csv: Path, graphs: dict[str, Graph], report: dict) -> None:
    actors = {str(o) for g in graphs.values() for o in g.objects(None, RF.actor)}
    ids = {m.group(1): iri for iri in actors if (m := REGISTER_ACTOR_RE.fullmatch(iri))}
    names = register_names(register_csv, set(ids))
    for register_id, iri in sorted(ids.items()):
        if register_id in names:
            enrichment.add((URIRef(iri), SKOS.prefLabel, Literal(names[register_id], lang="de")))
            report["counts"]["prefLabelsAdded"] += 1


def _description(
    run_id: str, manifest: dict, contracts: dict[str, dict], texts: dict, export_date: str, triples: int
) -> Graph:
    g = Graph()
    dataset = URIRef(f"urn:regesta:export:{run_id}")
    shown_contract = _contract_dir(manifest)
    g.add((dataset, RDF.type, VOID.Dataset))
    g.add(
        (dataset, DCTERMS.title, Literal(f"Barbarossa-Regesten, statements of run {run_id}, {STAGE} stage", lang="en"))
    )
    g.add((dataset, DCTERMS.identifier, Literal(run_id)))
    g.add((dataset, DCTERMS.created, Literal(export_date, datatype=XSD.date)))
    g.add((dataset, DCTERMS.license, URIRef(texts["licences"]["data"]["url"])))
    g.add((dataset, DCTERMS.source, URIRef(texts["source"]["url"])))
    g.add((dataset, DCTERMS.rights, Literal(texts["attribution"], lang="de")))
    g.add((dataset, PROV.wasDerivedFrom, URIRef(f"urn:regesta:run:{run_id}")))
    g.add((dataset, DCTERMS.conformsTo, URIRef(f"urn:regesta:{shown_contract.replace('/', ':', 1)}")))
    accepted = str(manifest["expert_accepted"]).lower()
    g.add(
        (
            dataset,
            DCTERMS.description,
            Literal(
                "Statements produced by LLM agents from the regest texts of Regesta Imperii IV,2, checked "
                "technically and by agentic review, not by a historian: every factoid has verification "
                f"status rv:unchecked, and the run manifest records expert_accepted {accepted}. They are no "
                "statements of Regesta Imperii.",
                lang="en",
            ),
        )
    )
    g.add((dataset, VOID.triples, Literal(triples, datatype=XSD.integer)))
    for namespace in (RF_DEFAULT, RV_DEFAULT, str(CRM), str(OA), str(PROV), str(DCTERMS), str(SCHEMA), str(SKOS)):
        g.add((dataset, VOID.vocabulary, URIRef(namespace)))
    hashes = {**contracts, shown_contract: {**contracts.get(shown_contract, {}), **manifest["contract_sha256"]}}
    for contract, files in sorted(hashes.items()):
        node = URIRef(f"urn:regesta:{contract.replace('/', ':', 1)}")
        g.add((node, RDFS.label, Literal(contract)))
        for name, digest in sorted(files.items()):
            part = URIRef(f"{node}:{name}")
            g.add((node, DCTERMS.hasPart, part))
            g.add((part, RDFS.label, Literal(name)))
            g.add((part, DCTERMS.identifier, Literal(f"sha256:{digest}")))
    return g


def _rewrite(g: Graph, mapping: dict[str, str]) -> Graph:
    def term(t: Node) -> Node:
        if isinstance(t, URIRef):
            for old, new in mapping.items():
                if str(t).startswith(old):
                    return URIRef(new + str(t)[len(old) :])
        return t

    out = Graph()
    for triple in g:
        out.add(tuple(term(t) for t in triple))
    return out


def _prefixes(rf_ns: str, rv_ns: str) -> dict[str, str]:
    return {
        "rf": rf_ns,
        "rv": rv_ns,
        "crm": str(CRM),
        "oa": str(OA),
        "prov": str(PROV),
        "rdfs": str(RDFS),
        "skos": str(SKOS),
        "dcterms": str(DCTERMS),
        "schema": str(SCHEMA),
        "void": str(VOID),
        "xsd": str(XSD),
    }


def _term(t: Node, prefixes: dict[str, str]) -> str:
    if isinstance(t, Literal):
        if t.datatype is not None:
            return f"{Literal(str(t)).n3()}^^{_term(t.datatype, prefixes)}"
        return t.n3()
    if not isinstance(t, URIRef):
        raise BuildError(f"no blank node may reach the writer: {t}")
    # The longest namespace wins, and only a plain local name becomes a prefixed name.
    for prefix, namespace in sorted(prefixes.items(), key=lambda kv: -len(kv[1])):
        local = str(t)[len(namespace) :]
        if str(t).startswith(namespace) and LOCAL_NAME.fullmatch(local):
            return f"{prefix}:{local}"
    return f"<{t}>"


def _statements(g: Graph, prefixes: dict[str, str], indent: str) -> str:
    by_subject: dict[str, dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))
    for s, p, o in g:
        predicate = "a" if p == RDF.type else _term(p, prefixes)
        by_subject[_term(s, prefixes)][predicate].add(_term(o, prefixes))
    blocks = []
    for subject in sorted(by_subject):
        predicates = by_subject[subject]
        lines = [
            f"{indent}    {p} {' , '.join(sorted(predicates[p]))}"
            for p in sorted(predicates, key=lambda k: (k != "a", k))
        ]
        blocks.append(f"{indent}{subject}\n" + " ;\n".join(lines) + " .\n")
    return "\n".join(blocks)


def _header(run_id: str, prefixes: dict[str, str]) -> str:
    lines = [
        f"# Run {run_id}, {STAGE} stage, exported by build_graph.py. Data CC BY 4.0; source Regesta Imperii",
        "# (RI IV,2), modified. The statements are produced by LLM agents and unchecked by a historian.",
    ]
    lines += [f"@prefix {p}: <{ns}> ." for p, ns in sorted(prefixes.items())]
    return "\n".join(lines) + "\n\n"


def build(
    source: Path,
    run_id: str,
    out: Path,
    export_date: str,
    texts_path: Path,
    rf_ns: str = RF_DEFAULT,
    rv_ns: str = RV_DEFAULT,
) -> dict:
    """Write the export of one run; return the report that is also written beside it."""
    run_dir = source / "runs" / run_id
    manifest = load_json(run_dir / "manifest.json")
    _verify_contract(source, manifest)
    texts = load_json(texts_path)
    uids = [s["uid"] for s in manifest["selection"]]
    frozen = _load_stage(run_dir, uids)
    rows = {r["uid"]: r for r in read_csv(source / REGESTA_CSV) if r["uid"] in set(uids)}
    if rows.keys() != set(uids):
        raise BuildError(f"regest CSV lacks UIDs {sorted(set(uids) - rows.keys())}")
    report = {
        "run": run_id,
        "stage": STAGE,
        "date": export_date,
        "namespaces": {"rf": rf_ns, "rv": rv_ns},
        "counts": defaultdict(int),
        "findings": {
            "invalidDates": [],
            "reversedIntervals": [],
            "missingPersistentIdentifier": [],
            "recordLabelDiffers": [],
        },
    }
    statuses = {o for g in frozen.values() for o in g.objects(None, RF.verificationStatus)}
    if statuses - {RV.unchecked}:
        raise BuildError(
            f"statuses other than rv:unchecked: {sorted(map(str, statuses))}; the description says unchecked"
        )

    graphs: dict[URIRef, Graph] = {}
    for uid in uids:
        text = load_json(run_dir / "packets" / f"{uid}.json")["summary_plain"] or ""
        g, references, selectors = _skolemise(frozen[uid], text, uid)
        g, tagged = _tag_german(g)
        report["counts"]["blankReferencesSkolemised"] += references
        report["counts"]["blankSelectorsSkolemised"] += selectors
        report["counts"]["literalsTagged"] += tagged
        graphs[graph_iri(run_id, uid)] = g

    enrichment = Graph()
    _records(enrichment, rows, frozen, texts["source"]["idPattern"], report)
    contracts = _agents(enrichment, source, frozen, report)
    _pref_labels(enrichment, source / REGISTER_CSV, frozen, report)
    graphs[enrichment_iri(run_id)] = enrichment
    union = Graph()
    for g in graphs.values():
        union += g
    graphs[description_iri(run_id)] = _description(run_id, manifest, contracts, texts, export_date, len(union))

    mapping = {RF_DEFAULT: rf_ns, RV_DEFAULT: rv_ns}
    graphs = {iri: _rewrite(g, mapping) for iri, g in graphs.items()}
    union = Graph()
    for g in graphs.values():
        union += g
    report["counts"]["triplesUnion"] = len(union)
    report["counts"]["quads"] = sum(len(g) for g in graphs.values())
    report["counts"] = dict(sorted(report["counts"].items()))

    prefixes = _prefixes(rf_ns, rv_ns)
    out.mkdir(parents=True, exist_ok=True)
    trig = _header(run_id, prefixes) + "\n".join(
        f"<{iri}> {{\n{_statements(graphs[iri], prefixes, '    ')}}}\n" for iri in sorted(graphs, key=str)
    )
    (out / f"{run_id}.trig").write_text(trig, encoding="utf-8", newline="\n")
    (out / f"{run_id}.ttl").write_text(
        _header(run_id, prefixes) + _statements(union, prefixes, ""), encoding="utf-8", newline="\n"
    )
    (out / f"{run_id}-report.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=1) + "\n", encoding="utf-8", newline="\n"
    )
    return report


def main() -> int:
    here = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--source", type=Path, default=here / "pipeline")
    parser.add_argument("--run", default=SHOWN_RUN)
    parser.add_argument("--out", type=Path, default=here / "data" / "graph")
    parser.add_argument("--date", default=date.today().isoformat(), help="export date, ISO; default today")
    parser.add_argument("--texts", type=Path, default=here / "edition" / "texts.json")
    parser.add_argument("--rf-namespace", default=RF_DEFAULT)
    parser.add_argument("--rv-namespace", default=RV_DEFAULT)
    args = parser.parse_args()
    if args.out.resolve().is_relative_to(args.source.resolve()):
        print("FEHLER refusing to write into the pipeline folder", file=sys.stderr)
        return 2
    try:
        date.fromisoformat(args.date)
        report = build(args.source, args.run, args.out, args.date, args.texts, args.rf_namespace, args.rv_namespace)
    except (BuildError, ValueError) as exc:
        print(f"FEHLER export failed: {exc}", file=sys.stderr)
        return 1
    print(f"OK wrote {args.out / args.run}.trig, .ttl and -report.json")
    print("OK counts", json.dumps(report["counts"]))
    for name, items in report["findings"].items():
        if items:
            print(f"WARNUNG {name}: {len(items)}", json.dumps(items[:5], ensure_ascii=False), file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
