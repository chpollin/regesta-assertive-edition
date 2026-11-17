# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Prepare immutable, hash-addressed source packets for a selected RDF pilot.

This standalone standard-library script reads existing exploration derivatives
only after verifying their recorded hash and the raw CSV fingerprints. It writes
new packets and a manifest; it neither extracts historical statements nor calls
a model. Run --project-dir . --output runs/RUN. --contracts defaults to the
project directory. Existing output is refused to preserve earlier experiments.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from pathlib import Path
from typing import Any


def _sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _read(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _json(path: Path, value: Any) -> None:
    temp = path.with_name(path.name + ".tmp")
    temp.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    temp.replace(path)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-dir", type=Path, required=True)
    parser.add_argument("--contracts", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument(
        "--selection", type=Path, help="defaults to CONTRACTS/pilot-selection.json"
    )
    parser.add_argument(
        "--model", default="gpt-6.1-terra", help="LLM recorded in the manifest"
    )
    # The pilot hashed four contract files; later runs also freeze shapes and the review and
    # correction prompts, so the hashed set is a parameter with the pilot's set as default.
    parser.add_argument(
        "--contract-files",
        nargs="+",
        default=[
            "ontology/regesta-core.ttl",
            "ontology/vocabulary.ttl",
            "knowledge/annotation-guidelines.md",
            "prompts/extract.md",
        ],
    )
    args = parser.parse_args()
    project = args.project_dir.resolve()
    contracts = (args.contracts or project).resolve()
    output = args.output.resolve()
    if output.exists():
        raise ValueError(f"Output already exists: {output}")
    if output == project or project.is_relative_to(output):
        raise ValueError("Output must not contain the source project.")
    profile = _read(project / "generated/profile.json")
    sources = {}
    for entry in profile["inputs"]:
        path = project / "source-material" / entry["filename"]
        sources[path.name] = _sha(path)
        if sources[path.name] != entry["sha256"]:
            raise ValueError(f"Raw source changed: {path.name}")
    derivative = project / "generated/regesta.jsonl"
    verification = _read(project / "generated/verification.json")
    if _sha(derivative) != verification["output_sha256"]["regesta.jsonl"]:
        raise ValueError("Exploration reading derivative does not match verification.")
    rows = {
        r["uid"]: r
        for r in (
            json.loads(line)
            for line in derivative.read_text(encoding="utf-8").splitlines()
        )
    }
    with (project / "source-material/RI_004-002-ReggBarbarossa.csv").open(
        encoding="utf-8", newline=""
    ) as stream:
        raw = {
            r["uid"]: r for r in csv.DictReader(stream, escapechar="\\", strict=True)
        }
    with (project / "source-material/RI_004-002-RegisterBarbarossa.csv").open(
        encoding="utf-8-sig", newline=""
    ) as stream:
        index = list(csv.DictReader(stream, escapechar="\\", strict=True))
    selection = _read(args.selection or contracts / "pilot-selection.json")
    if len({r["uid"] for r in selection}) != len(selection):
        raise ValueError("Duplicate selected regesta.")
    # This identifier was checked against the actual index in the initial run.
    ruler_id = "RI004-002-F000471"
    if not any(r["id"] == ruler_id for r in index):
        raise ValueError("Shared ruler identity is absent from supplied index.")
    for item in selection:
        if item["uid"] not in rows or item["uid"] not in raw:
            raise ValueError(f"Selected source is absent: {item['uid']}")
    fingerprints = {name: _sha(contracts / name) for name in args.contract_files}
    output.mkdir(parents=True)
    for name in ("packets", "extracted", "review", "revised", "validation"):
        (output / name).mkdir()
    manifest: dict[str, Any] = {
        "run_id": output.name,
        "stage": "prepared",
        "expert_accepted": False,
        "model": args.model,
        "annotation_scope": "summary_plain only; date_string for lexical context; register labels only for identity candidates",
        "source_sha256": sources,
        "ontology_sha256": fingerprints["ontology/regesta-core.ttl"],
        "contract_sha256": fingerprints,
        "selection": [],
    }
    for item in selection:
        uid = item["uid"]
        r = rows[uid]
        candidates = [
            {k: x[k] for k in ("id", "label", "origLabel", "type", "role")}
            for x in index
            if x["regestaIdentifier"] == r["identifier"]
        ]
        packet = {
            "uid": uid,
            "identifier": r["identifier"],
            "source_file": r["source_file"],
            "source_row": r["source_row"],
            "source_iri": "urn:regesta:record:" + uid,
            "summary_plain": r["summary_plain"],
            "summary_raw": raw[uid]["summary"],
            "date_string": r["date_string"],
            "machine_start": r["start_date"],
            "machine_end": r["end_date"],
            "locality_string": r["locality_string"],
            "identity_candidates": candidates,
            "shared_ruler": {
                "iri": "urn:regesta:actor:" + ruler_id,
                "label": "Friedrich Barbarossa",
            },
            "selection_group": item["group"],
            "selection_reason": item["reason"],
            "caution": "Machine dates may conflict with prose. Dates of a record do not date every embedded event. Candidate labels are not extractable evidence.",
        }
        path = output / "packets" / f"{uid}.json"
        _json(path, packet)
        manifest["selection"].append(
            {
                "uid": uid,
                "identifier": r["identifier"],
                "group": item["group"],
                "reason": item["reason"],
                "batch": item["batch"],
                "packet_sha256": _sha(path),
            }
        )
    _json(output / "manifest.json", manifest)
    print("[OK] Verified sources and prepared new pilot packets.")


if __name__ == "__main__":
    main()
