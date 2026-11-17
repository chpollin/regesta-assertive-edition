# /// script
# requires-python = ">=3.11"
# dependencies = ["rdflib==7.6.0", "pyshacl==0.40.1"]
# ///
"""Validate candidate RDF against frozen contracts and source packets.

This standalone script consumes retained LLM outputs and produces deterministic
technical evidence and a source/RDF review sheet. It never calls a model or
changes candidate graphs. Run with --project-dir . --run-dir runs/RUN
--stage extracted --self-test. Correction is a separate stage. Historical truth,
coverage and expert acceptance are not established by these checks.
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
from rdflib import RDF, RDFS, Graph, Literal, Namespace, URIRef

REG = Namespace("https://example.org/regesta/ontology/")
CRM = Namespace("http://www.cidoc-crm.org/cidoc-crm/")
VOC = Namespace("https://example.org/regesta/vocab/")
ALLOWED_CRM_CLASSES = frozenset(
    {
        "E1_CRM_Entity",
        "E2_Temporal_Entity",
        "E5_Event",
        "E7_Activity",
        "E13_Attribute_Assignment",
        "E18_Physical_Thing",
        "E21_Person",
        "E30_Right",
        "E31_Document",
        "E39_Actor",
        "E52_Time-Span",
        "E53_Place",
        "E55_Type",
        "E74_Group",
    }
)
ALLOWED_CRM_PROPERTIES = frozenset(
    {
        "P2_has_type",
        "P3_has_note",
        "P4_has_time-span",
        "P7_took_place_at",
        "P11_had_participant",
        "P14_carried_out_by",
        "P75_possesses",
        "P152_has_parent",
        "P140_assigned_attribute_to",
        "P141_assigned",
        "P177_assigned_property_of_type",
    }
)


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _read(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(text, encoding="utf-8", newline="\n")
    tmp.replace(path)


def _json(path: Path, value: Any) -> None:
    _write(path, json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n")


def _issues(
    graph: Graph,
    packet: dict[str, Any],
    status: str,
    ontology: Graph,
    shapes: Graph,
    vocabulary: Graph,
) -> list[dict[str, str]]:
    issues: list[dict[str, str]] = []

    def add(code: str, subject: object, detail: str) -> None:
        issues.append({"code": code, "subject": str(subject), "detail": detail})

    source = URIRef(packet["source_iri"])
    if (source, RDF.type, CRM.E31_Document) not in graph:
        add("source_record_missing", source, "Expected source document is absent.")
    assertions = sorted(
        set(graph.subjects(RDF.type, CRM.E13_Attribute_Assignment)), key=str
    )
    if status == "extracted" and not assertions:
        add(
            "empty_extraction", source, "An extracted result must contain an assertion."
        )
    if status == "no_in_scope_claim" and assertions:
        add(
            "abstention_has_assertions",
            source,
            "Reported abstention contains assertions.",
        )

    allowed_predicates = {RDF.type, RDFS.label}
    allowed_predicates.update(
        REG[x]
        for x in (
            "context",
            "actor",
            "role",
            "concerns",
            "establishes",
            "terminates",
            "condition",
            "exception",
            "source",
            "evidence",
        )
    )
    allowed_predicates.update(CRM[x] for x in ALLOWED_CRM_PROPERTIES)
    allowed_classes = {REG.RelationshipState, REG.Participation}
    allowed_classes.update(CRM[x] for x in ALLOWED_CRM_CLASSES)
    terms = set(vocabulary.subjects(RDF.type, CRM.E55_Type))
    for s, p, o in graph:
        if p not in allowed_predicates:
            add("unknown_predicate", s, str(p))
        if p == RDF.type and o not in allowed_classes:
            add("unknown_class", s, str(o))
        if p in {REG.role, CRM.P2_has_type} and o not in terms:
            add("unknown_controlled_term", s, str(o))
        if p == CRM.P152_has_parent and s == o:
            add("self_parent", s, "Parenthood is irreflexive.")
        if p == REG.source and o != source:
            add("wrong_regest_source", s, str(o))

    for assertion in assertions:
        evidence = list(graph.objects(assertion, REG.evidence))
        if not evidence:
            add("missing_evidence", assertion, "No evidence literal.")
        for text in evidence:
            if (
                not isinstance(text, Literal)
                or not str(text)
                or str(text) not in packet["summary_plain"]
            ):
                add("evidence_not_in_source", assertion, str(text))
        for predicate in (
            CRM.P140_assigned_attribute_to,
            CRM.P177_assigned_property_of_type,
            CRM.P141_assigned,
        ):
            values = list(graph.objects(assertion, predicate))
            if len(values) != 1:
                add("assertion_cardinality", assertion, str(predicate))
        subjects = list(graph.objects(assertion, CRM.P140_assigned_attribute_to))
        predicates = list(graph.objects(assertion, CRM.P177_assigned_property_of_type))
        objects = list(graph.objects(assertion, CRM.P141_assigned))
        if len(subjects) == len(predicates) == len(objects) == 1:
            if (subjects[0], predicates[0], objects[0]) not in graph:
                add(
                    "missing_candidate_projection",
                    assertion,
                    "The claimed candidate triple is absent.",
                )
            if predicates[0] not in allowed_predicates:
                add("unknown_asserted_predicate", assertion, str(predicates[0]))

    for state in graph.subjects(CRM.P2_has_type, VOC.RightHolding):
        if not any(
            (r, RDF.type, CRM.E30_Right) in graph
            for r in graph.objects(state, REG.concerns)
        ):
            add(
                "right_holding_without_right",
                state,
                "A right-holding state must concern a concrete right.",
            )

    allowed_actor_ids = {
        "urn:regesta:actor:" + x["id"] for x in packet["identity_candidates"]
    }
    allowed_actor_ids.update(x + ":community" for x in list(allowed_actor_ids))
    allowed_actor_ids.add(packet["shared_ruler"]["iri"])
    for actor in graph.objects(None, REG.actor):
        if str(actor) not in allowed_actor_ids and not str(actor).startswith(
            f"urn:regesta:actor:{packet['uid']}:local:"
        ):
            add(
                "unregistered_actor_iri",
                actor,
                "Not an assigned identity candidate or regest-local actor.",
            )
        if (actor, RDF.type, CRM.E53_Place) in graph:
            add(
                "place_used_as_actor",
                actor,
                "Place and historical actor are separate entities.",
            )

    # This real case explicitly reports negotiation, not a concluded marriage.
    if packet["uid"] == "25897":
        for node in graph.subjects(CRM.P2_has_type, VOC.Marriage):
            add(
                "negotiation_as_marriage",
                node,
                "The packet does not attest a concluded marriage.",
            )
        for node in graph.subjects(CRM.P2_has_type, VOC.MarriageConclusion):
            add("negotiation_as_marriage", node, "The packet only attests negotiation.")

    conforms, report, _ = validate(
        graph,
        shacl_graph=shapes,
        ont_graph=ontology,
        inference="none",
        meta_shacl=True,
        advanced=False,
        do_owl_imports=False,
        inplace=False,
    )
    if not conforms:
        sh = Namespace("http://www.w3.org/ns/shacl#")
        for result in report.subjects(RDF.type, sh.ValidationResult):
            add(
                "shacl_violation",
                report.value(result, sh.focusNode),
                str(report.value(result, sh.resultMessage)),
            )
    return sorted(issues, key=lambda x: (x["code"], x["subject"], x["detail"]))


def _self_test(
    packet: dict[str, Any], ontology: Graph, shapes: Graph, vocabulary: Graph
) -> dict[str, bool]:
    source = URIRef(packet["source_iri"])
    child = URIRef("urn:regesta:actor:test-child")
    parent = URIRef("urn:regesta:actor:test-parent")
    assertion = URIRef("urn:regesta:test-assertion")
    graph = Graph()
    for triple in [
        (source, RDF.type, CRM.E31_Document),
        (child, RDF.type, CRM.E21_Person),
        (parent, RDF.type, CRM.E21_Person),
        (child, CRM.P152_has_parent, parent),
        (assertion, RDF.type, CRM.E13_Attribute_Assignment),
        (assertion, CRM.P140_assigned_attribute_to, child),
        (assertion, CRM.P177_assigned_property_of_type, CRM.P152_has_parent),
        (assertion, CRM.P141_assigned, parent),
        (assertion, REG.source, source),
        (assertion, REG.evidence, Literal("die Tochter Markgraf Diepolds von Vohburg")),
    ]:
        graph.add(triple)
    results = {
        "valid_real_evidence_fixture": not _issues(
            graph, packet, "extracted", ontology, shapes, vocabulary
        )
    }
    mutants = {
        "missing_source": (assertion, REG.source, source),
        "missing_evidence": (assertion, REG.evidence, None),
        "missing_projection": (child, CRM.P152_has_parent, parent),
    }
    for name, triple in mutants.items():
        changed = Graph()
        changed += graph
        changed.remove(triple)
        results[name] = bool(
            _issues(changed, packet, "extracted", ontology, shapes, vocabulary)
        )
    changed = Graph()
    changed += graph
    changed.set((assertion, REG.evidence, Literal("This passage is fabricated.")))
    results["fabricated_evidence"] = any(
        x["code"] == "evidence_not_in_source"
        for x in _issues(changed, packet, "extracted", ontology, shapes, vocabulary)
    )
    results["untargeted_empty_output"] = any(
        x["code"] == "empty_extraction"
        for x in _issues(Graph(), packet, "extracted", ontology, shapes, vocabulary)
    )
    # Probe the actual Participation shape, not merely the statement shape.
    changed = Graph()
    changed += graph
    role_node = URIRef("urn:regesta:test-participation")
    changed.add((role_node, RDF.type, REG.Participation))
    changed.add((role_node, REG.role, VOC.Spouse))
    results["incomplete_participation"] = any(
        x["code"] == "shacl_violation"
        for x in _issues(changed, packet, "extracted", ontology, shapes, vocabulary)
    )
    if not all(results.values()):
        raise ValueError(f"Validation regression failed: {results}")
    return results


def _review_sheet(run: Path, rows: list[dict[str, Any]], stage: str) -> None:
    text = [
        "# Candidate RDF review sheet",
        "",
        "Technical checks do not establish historical accuracy or completeness. Expert acceptance is pending.",
        "",
    ]
    for row in rows:
        packet = _read(run / "packets" / f"{row['uid']}.json")
        text.extend(
            [
                f"## {packet['identifier']} (UID {row['uid']})",
                "",
                f"Outcome: {row['status']}. Technical result: {'passed' if not row['issues'] else 'findings'}.",
                "",
                packet["summary_plain"],
                "",
                f"[Candidate RDF](../{stage}/{row['uid']}.ttl)",
                "",
            ]
        )
        if row.get("claims"):
            text.append("| Assertion | Candidate relation | Evidence |")
            text.append("|---|---|---|")
            for claim in row["claims"]:
                evidence = claim["evidence"].replace("|", "\\|").replace("\n", " ")
                relation = claim["triple"].replace("|", "\\|")
                text.append(f"| {claim['id']} | {relation} | {evidence} |")
            text.append("")
        for issue in row["issues"]:
            text.append(f"- {issue['code']}: {issue['detail']}")
        text.append("")
    _write(run / "validation" / f"{stage}-review-sheet.md", "\n".join(text))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-dir", type=Path, required=True)
    parser.add_argument("--run-dir", type=Path, required=True)
    parser.add_argument(
        "--stage", choices=("extracted", "revised"), default="extracted"
    )
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    project = args.project_dir.resolve()
    run = args.run_dir.resolve()
    manifest = _read(run / "manifest.json")
    for path, expected in manifest["contract_sha256"].items():
        if _sha(project / path) != expected:
            raise ValueError(f"Frozen contract changed: {path}")
    ontology = Graph().parse(project / "ontology/regesta-core.ttl", format="turtle")
    vocabulary = Graph().parse(project / "ontology/vocabulary.ttl", format="turtle")
    shapes = Graph().parse(project / "ontology/pilot-shapes.ttl", format="turtle")
    ontology += vocabulary
    statuses: dict[str, str] = {}
    duplicates: list[str] = []
    for report in sorted((run / "extracted").glob("batch-*.json")):
        payload = _read(report)
        batch_rows = payload if isinstance(payload, list) else payload["records"]
        if not isinstance(batch_rows, list):
            raise TypeError(f"Expected a record list in {report}")
        for row in batch_rows:
            uid = str(row["uid"])
            if row["status"] not in {"extracted", "no_in_scope_claim", "error"}:
                raise ValueError(
                    f"Unexpected extraction status in {report}: {row['status']}"
                )
            if uid in statuses:
                duplicates.append(uid)
            statuses[uid] = row["status"]
    if duplicates:
        raise ValueError(f"Duplicate reported regesta: {duplicates}")
    expected_uids = {str(r["uid"]) for r in manifest["selection"]}
    if set(statuses) != expected_uids:
        raise ValueError(
            f"Batch coverage differs: missing={expected_uids - set(statuses)}, extra={set(statuses) - expected_uids}"
        )
    output_rows = []
    for selection in manifest["selection"]:
        uid = str(selection["uid"])
        packet_path = run / "packets" / f"{uid}.json"
        if _sha(packet_path) != selection["packet_sha256"]:
            raise ValueError(f"Source packet changed: {uid}")
        packet = _read(packet_path)
        path = run / args.stage / f"{uid}.ttl"
        row: dict[str, Any] = {
            "uid": uid,
            "status": statuses[uid],
            "issues": [],
            "claims": [],
        }
        try:
            graph = Graph().parse(path, format="turtle")
            row["rdf_sha256"] = _sha(path)
            row["triples"] = len(graph)
            row["issues"] = _issues(
                graph, packet, statuses[uid], ontology, shapes, vocabulary
            )
            for claim in sorted(
                set(graph.subjects(RDF.type, CRM.E13_Attribute_Assignment)), key=str
            ):
                values = [
                    graph.value(claim, p)
                    for p in (
                        CRM.P140_assigned_attribute_to,
                        CRM.P177_assigned_property_of_type,
                        CRM.P141_assigned,
                    )
                ]
                row["claims"].append(
                    {
                        "id": str(claim),
                        "triple": " | ".join(str(x) for x in values),
                        "evidence": " / ".join(
                            str(x) for x in graph.objects(claim, REG.evidence)
                        ),
                    }
                )
        except (OSError, SyntaxError, ValueError, TypeError) as error:
            # Preserve failures per LLM-produced file; never silently drop a regest.
            row["issues"].append(
                {"code": "processing_error", "subject": str(path), "detail": str(error)}
            )
        output_rows.append(row)
    report = {
        "stage": args.stage,
        "expert_accepted": False,
        "validator_sha256": _sha(Path(__file__)),
        "runtime": {
            "python": sys.version.split()[0],
            "rdflib": importlib.metadata.version("rdflib"),
            "pyshacl": importlib.metadata.version("pyshacl"),
        },
        "technical_pass": all(not r["issues"] for r in output_rows),
        "shapes_sha256": _sha(project / "ontology/pilot-shapes.ttl"),
        "records": output_rows,
    }
    if args.self_test:
        report["validation_regressions"] = _self_test(
            _read(run / "packets/22673.json"),
            ontology,
            shapes,
            vocabulary,
        )
    _json(run / "validation" / f"{args.stage}.json", report)
    _review_sheet(run, output_rows, args.stage)
    print(f"[OK] Retained validation results for {args.stage}.")
    print(
        f"[OK] Technical pass: {report['technical_pass']}. Expert acceptance: pending."
    )
    if not report["technical_pass"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
