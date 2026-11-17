# /// script
# requires-python = ">=3.11"
# dependencies = ["rdflib==7.6.0", "pyshacl==0.40.1"]
# ///
"""Validate a factoid run against its frozen contract and its source packets.

Single-file script regime with inline dependencies, run with uv. It is the counterpart of
validate_pilot.py for the factoid model of contracts/factoid-2026-11-11; the pilot validator
stays unchanged so the pilot remains checkable against its own contract.

Data flow: manifest -> contract and packet hashes -> one Turtle file per selected UID ->
parse, allowed terms, SHACL (vocabulary merged into the data graph), exact-wording checks,
actor identifier policy, abstention and coverage -> validation/<stage>.json and a German
review sheet validation/<stage>-review-sheet.md. Checks are per record and collected; the
exit code is 0 only if every record passes.

Usage:
  uv run validate_factoid.py --project-dir . --contracts contracts/factoid-2026-11-11 \
      --run-dir runs/factoid-2026-11-11 --stage extracted [--self-test]

Technical conformance is not historical acceptance. Exact wording proves that words exist,
not that they support the factoid.
"""

from __future__ import annotations

import argparse
import hashlib
import importlib.metadata
import json
import sys
from pathlib import Path
from typing import Any

from pyshacl import validate
from rdflib import BNode, Graph, Literal, Namespace, URIRef
from rdflib.namespace import RDF, RDFS, SKOS

CRM = Namespace("http://www.cidoc-crm.org/cidoc-crm/")
RF = Namespace("https://example.org/regesta/factoid/")
RV = Namespace("https://example.org/regesta/concept/")
OA = Namespace("http://www.w3.org/ns/oa#")
PROV = Namespace("http://www.w3.org/ns/prov#")

ALLOWED_CLASSES = frozenset(
    {
        RF.ActFactoid,
        RF.StateFactoid,
        RF.Reference,
        RF.FunctionalActor,
        OA.TextQuoteSelector,
        CRM.E21_Person,
        CRM.E74_Group,
        CRM.E30_Right,
        CRM.E18_Physical_Thing,
        CRM.E53_Place,
        CRM.E31_Document,
    }
)
EXACT_LITERALS = (
    RF.nameInSource,
    RF.condition,
    RF.exception,
    RF.ground,
    RF.amount,
    RF.qualifier,
)


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _read(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _write(path: Path, text: str) -> None:
    temp = path.with_name(path.name + ".tmp")
    temp.write_text(text, encoding="utf-8")
    temp.replace(path)


def _allowed_predicates(ontology: Graph) -> set[URIRef]:
    own = {
        p for p in ontology.subjects(RDF.type, RDF.Property) if isinstance(p, URIRef)
    }
    return own | {RDF.type, RDFS.label, CRM.P2_has_type, OA.exact, PROV.wasAttributedTo}


def _issues(
    graph: Graph,
    packet: dict,
    status: str,
    ontology: Graph,
    shapes: Graph,
    vocabulary: Graph,
) -> list[dict]:
    """All findings for one record; an empty list means the record passes."""
    found: list[dict] = []

    def add(code: str, subject: object, detail: str) -> None:
        found.append({"code": code, "subject": str(subject), "detail": detail})

    text = packet["summary_plain"] or ""
    source = URIRef(packet["source_iri"])
    factoids = sorted(
        set(graph.subjects(RDF.type, RF.ActFactoid))
        | set(graph.subjects(RDF.type, RF.StateFactoid)),
        key=str,
    )
    if status == "extracted" and not factoids:
        add("empty_extraction", source, "An extracted record must contain a factoid.")
    if status == "no_in_scope_claim" and factoids:
        add(
            "abstention_has_factoids",
            source,
            "A reported abstention contains factoids.",
        )
    if (source, RDF.type, CRM.E31_Document) not in graph:
        add("missing_source_node", source, "The source document node is absent.")

    predicates = _allowed_predicates(ontology)
    concepts = set(vocabulary.subjects(RDF.type, SKOS.Concept))
    for s, p, o in graph:
        if p not in predicates:
            add("unknown_predicate", s, str(p))
        if p == RDF.type and o not in ALLOWED_CLASSES:
            add("unknown_class", s, str(o))
        if (
            p in (RF.factoidType, RF.role, RF.verificationStatus, CRM.P2_has_type)
            and o not in concepts
        ):
            add("unknown_concept", s, str(o))
        if p == RF.source and o != source:
            add("wrong_source", s, str(o))
        exact = p in EXACT_LITERALS or p == OA.exact
        if exact and (not isinstance(o, Literal) or not str(o) or str(o) not in text):
            add("wording_not_in_source", s, f"{p.split('/')[-1].split('#')[-1]}: {o}")

    for f in factoids:
        if not any(
            isinstance(sel, (BNode, URIRef)) for sel in graph.objects(f, RF.evidence)
        ):
            add("missing_evidence", f, "No evidence selector.")
        kind = RV.ActTypes if (f, RDF.type, RF.ActFactoid) in graph else RV.StateTypes
        for t in graph.objects(f, RF.factoidType):
            if (t, SKOS.inScheme, kind) not in vocabulary:
                add("type_scheme_mismatch", f, f"{t} is not in {kind}")
        for target in graph.objects(f, RF.partOf):
            if target == f:
                add("self_reference", f, "partOf points to itself.")

    allowed_actors = {
        "urn:regesta:actor:" + c["id"] for c in packet["identity_candidates"]
    }
    allowed_actors |= {a + ":community" for a in list(allowed_actors)}
    allowed_actors.add(packet["shared_ruler"]["iri"])
    local_prefix = f"urn:regesta:actor:{packet['uid']}:local:"
    for actor in set(graph.objects(None, RF.actor)):
        if str(actor) not in allowed_actors and not str(actor).startswith(local_prefix):
            add(
                "actor_outside_packet",
                actor,
                "Neither a register candidate of this packet, the shared ruler nor regest-local.",
            )
        if (actor, RDF.type, RF.FunctionalActor) in graph and not str(actor).startswith(
            local_prefix
        ):
            add(
                "functional_actor_not_local",
                actor,
                "A functional actor must be regest-local.",
            )
        if (actor, RDF.type, CRM.E53_Place) in graph:
            add("place_used_as_actor", actor, "Place and actor are separate.")
        if graph.value(actor, RDFS.label) is None:
            add(
                "actor_without_label",
                actor,
                "Every actor needs a label in the source's words.",
            )

    # Regression from the pilot: a marriage negotiation never becomes a marriage.
    if packet["uid"] == "25897":
        for t in (RV.Marriage, RV.MarriageConclusion):
            for node in graph.subjects(RF.factoidType, t):
                add(
                    "negotiation_as_marriage",
                    node,
                    "The packet attests negotiation only.",
                )

    data = graph + vocabulary
    conforms, report, _ = validate(
        data, shacl_graph=shapes, ont_graph=ontology, inference="none", advanced=False
    )
    if not conforms:
        sh = Namespace("http://www.w3.org/ns/shacl#")
        for result in report.subjects(RDF.type, sh.ValidationResult):
            add(
                "shacl_violation",
                report.value(result, sh.focusNode),
                str(report.value(result, sh.resultMessage)),
            )
    return found


def _review_sheet(
    run: Path, uids: list[str], results: dict[str, dict], vocabulary: Graph, stage: str
) -> None:
    def pref(c: object) -> str:
        for lab in vocabulary.objects(c, SKOS.prefLabel):
            if isinstance(lab, Literal) and lab.language == "de":
                return str(lab)
        return str(c)

    out = [
        "# Prüfbogen des Faktoid-Laufs",
        "",
        "Technische Prüfungen belegen weder historische Richtigkeit noch Vollständigkeit. Alle Faktoide sind ungeprüft.",
        "",
    ]
    for uid in uids:
        packet = _read(run / "packets" / f"{uid}.json")
        res = results[uid]
        out += [
            f"## {packet['identifier']} (UID {uid})",
            "",
            f"Ergebnis: {res['status']}. Technisch: {'bestanden' if not res['issues'] else 'Befunde'}.",
            "",
            # The delivery has records without a summary (n. 107); the sheet says so.
            packet["summary_plain"]
            or "(Die Lieferung enthält für dieses Regest keinen Regesttext.)",
            "",
        ]
        path = run / stage / f"{uid}.ttl"
        if path.is_file():
            g = Graph().parse(path, format="turtle")
            used = set()
            for f in sorted(set(g.subjects(RF.factoidType, None)), key=str):
                refs = []
                for r in g.objects(f, RF.reference):
                    actor = g.value(r, RF.actor)
                    used.add(str(actor))
                    name = g.value(r, RF.nameInSource) or g.value(actor, RDFS.label)
                    refs.append(f"{name} als {pref(g.value(r, RF.role))}")
                concerns = [
                    str(g.value(c, RDFS.label) or c) for c in g.objects(f, RF.concerns)
                ]
                line = f"- {pref(g.value(f, RF.factoidType))}"
                if refs:
                    line += ": " + ", ".join(refs)
                if concerns:
                    line += ". Betrifft " + ", ".join(concerns)
                for p, word in (
                    (RF.condition, "Bedingung"),
                    (RF.exception, "Ausnahme"),
                    (RF.ground, "Begründung"),
                    (RF.amount, "Betrag"),
                    (RF.qualifier, "Wortlaut"),
                ):
                    for v in g.objects(f, p):
                        line += f". {word}: „{v}“"
                if g.value(f, RF.partOf) is not None:
                    line += ". Teil eines Hauptakts"
                if g.value(f, RF.refersToAct) is not None:
                    line += ". Bezieht sich auf einen früheren Akt"
                out.append(line + ".")
                for sel in g.objects(f, RF.evidence):
                    out.append(f"  Beleg: „{g.value(sel, OA.exact)}“")
            cands = [c for c in packet["identity_candidates"] if c["type"] == "person"]
            unused = [c for c in cands if f"urn:regesta:actor:{c['id']}" not in used]
            if unused:
                out.append("")
                out.append(
                    "Registereinträge des Pakets ohne Zuordnung: "
                    + "; ".join(f"{c['id']} {c['origLabel']}" for c in unused)
                )
        for issue in res["issues"]:
            out.append(f"- Befund {issue['code']}: {issue['detail']}")
        out.append("")
    _write(run / "validation" / f"{stage}-review-sheet.md", "\n".join(out))


def _self_test(
    packet: dict, ontology: Graph, shapes: Graph, vocabulary: Graph
) -> list[dict]:
    """Mutations that must each be caught; a valid minimal record must pass."""
    uid = packet["uid"]
    text = packet["summary_plain"]
    word = text.split(".")[0][:40]
    base = f"""
@prefix rf: <https://example.org/regesta/factoid/> . @prefix rv: <https://example.org/regesta/concept/> .
@prefix crm: <http://www.cidoc-crm.org/cidoc-crm/> . @prefix oa: <http://www.w3.org/ns/oa#> .
@prefix prov: <http://www.w3.org/ns/prov#> . @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
<{packet["source_iri"]}> a crm:E31_Document .
<{packet["shared_ruler"]["iri"]}> a crm:E21_Person ; rdfs:label "Friedrich" .
<urn:regesta:{uid}:f1> a rf:ActFactoid ; rf:factoidType rv:Grant ; rf:source <{packet["source_iri"]}> ;
  rf:evidence [ a oa:TextQuoteSelector ; oa:exact {json.dumps(word, ensure_ascii=False)} ] ;
  prov:wasAttributedTo <urn:regesta:agent:self-test> ; rf:verificationStatus rv:unchecked ;
  rf:reference [ a rf:Reference ; rf:actor <{packet["shared_ruler"]["iri"]}> ; rf:role rv:Grantor ] .
"""
    cases = {
        "valid": (base, None),
        "fabricated_evidence": (
            base.replace(
                json.dumps(word, ensure_ascii=False),
                '"Dieser Satz steht nicht im Regest"',
            ),
            "wording_not_in_source",
        ),
        "state_type_on_act": (
            base.replace("rv:Grant ;", "rv:Marriage ;"),
            "type_scheme_mismatch",
        ),
        "unknown_concept": (
            base.replace("rv:Grant ;", "rv:Conquest ;"),
            "unknown_concept",
        ),
        "foreign_actor": (
            base.replace(
                packet["shared_ruler"]["iri"], "urn:regesta:actor:RI999-999-X000001"
            ),
            "actor_outside_packet",
        ),
        "missing_status": (
            base.replace("rf:verificationStatus rv:unchecked ;", ""),
            "shacl_violation",
        ),
        "role_from_wrong_scheme": (
            base.replace("rv:Grantor", "rv:Donation"),
            "shacl_violation",
        ),
        "empty_extraction": (
            f"<{packet['source_iri']}> a <http://www.cidoc-crm.org/cidoc-crm/E31_Document> .",
            "empty_extraction",
        ),
    }
    results = []
    for name, (ttl, expected) in cases.items():
        codes = {
            i["code"]
            for i in _issues(
                Graph().parse(data=ttl, format="turtle"),
                packet,
                "extracted",
                ontology,
                shapes,
                vocabulary,
            )
        }
        passed = not codes if expected is None else expected in codes
        results.append(
            {
                "case": name,
                "expected": expected,
                "found": sorted(codes),
                "passed": passed,
            }
        )
    return results


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--project-dir", type=Path, required=True)
    parser.add_argument("--contracts", type=Path, required=True)
    parser.add_argument("--run-dir", type=Path, required=True)
    parser.add_argument("--stage", choices=("extracted", "revised"), required=True)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    run = args.run_dir
    manifest = _read(run / "manifest.json")
    for name, expected in manifest["contract_sha256"].items():
        if _sha(args.contracts / name) != expected:
            raise ValueError(f"Frozen contract changed: {name}")
    ontology = Graph().parse(
        args.contracts / "ontology/regesta-core.ttl", format="turtle"
    )
    vocabulary = Graph().parse(
        args.contracts / "ontology/vocabulary.ttl", format="turtle"
    )
    shapes = Graph().parse(args.contracts / "ontology/shapes.ttl", format="turtle")

    statuses: dict[str, str] = {}
    for report in sorted((run / "extracted").glob("batch-*.json")):
        for rec in _read(report)["records"]:
            statuses[rec["uid"]] = rec["status"]
    # A correction can turn a record into an abstention or an abstention into factoids;
    # for the revised stage its outcome in revised/corrections.json overrides the
    # extraction report. Before this, such records were falsely reported as mismatches.
    corrections = run / "revised" / "corrections.json"
    if args.stage == "revised" and corrections.is_file():
        for rec in _read(corrections).get("records", []):
            if rec.get("status_after"):
                statuses[rec["uid"]] = rec["status_after"]
    uids = [s["uid"] for s in manifest["selection"]]
    results: dict[str, dict] = {}
    for sel in manifest["selection"]:
        uid = sel["uid"]
        packet_path = run / "packets" / f"{uid}.json"
        if _sha(packet_path) != sel["packet_sha256"]:
            raise ValueError(f"Packet changed: {uid}")
        packet = _read(packet_path)
        status = statuses.get(uid, "missing")
        issues: list[dict] = []
        path = run / args.stage / f"{uid}.ttl"
        if status == "missing":
            issues.append(
                {
                    "code": "no_reported_outcome",
                    "subject": uid,
                    "detail": "No batch report lists this UID.",
                }
            )
        if not path.is_file():
            issues.append({"code": "missing_file", "subject": uid, "detail": str(path)})
            graph = Graph()
        else:
            try:
                graph = Graph().parse(path, format="turtle")
            except (
                Exception
            ) as exc:  # A parse failure of one record must not stop the others.
                issues.append(
                    {"code": "parse_error", "subject": uid, "detail": str(exc)[:300]}
                )
                graph = Graph()
        if len(graph):
            issues += _issues(graph, packet, status, ontology, shapes, vocabulary)
        factoids = len(
            set(graph.subjects(RDF.type, RF.ActFactoid))
            | set(graph.subjects(RDF.type, RF.StateFactoid))
        )
        results[uid] = {
            "uid": uid,
            "status": status,
            "factoids": factoids,
            "issues": issues,
            "rdf_sha256": _sha(path) if path.is_file() else None,
        }

    report: dict[str, Any] = {
        "run_id": manifest["run_id"],
        "stage": args.stage,
        "expert_accepted": False,
        "technical_pass": all(not r["issues"] for r in results.values()),
        "validator_sha256": _sha(Path(__file__)),
        "runtime": {
            "python": sys.version.split()[0],
            "rdflib": importlib.metadata.version("rdflib"),
            "pyshacl": importlib.metadata.version("pyshacl"),
        },
        "records": [results[u] for u in uids],
    }
    if args.self_test:
        report["self_test"] = _self_test(
            _read(run / "packets" / f"{uids[0]}.json"), ontology, shapes, vocabulary
        )
    (run / "validation").mkdir(exist_ok=True)
    _write(
        run / "validation" / f"{args.stage}.json",
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
    )
    _review_sheet(run, uids, results, vocabulary, args.stage)
    failed = [u for u, r in results.items() if r["issues"]]
    self_failed = [c["case"] for c in report.get("self_test", []) if not c["passed"]]
    print(f"records: {len(uids)}, with findings: {len(failed)} {failed}")
    if args.self_test:
        print(f"self-test failures: {self_failed or 'none'}")
    sys.exit(1 if failed or self_failed else 0)


if __name__ == "__main__":
    main()
