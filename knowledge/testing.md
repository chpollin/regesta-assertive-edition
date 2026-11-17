---
title: Testing
project:
  name: Regesta Assertive Edition
  repository: https://github.com/chpollin/regesta-assertive-edition
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
status: draft
language: en
created: 2026-11-09
updated: 2026-11-17
---

# Testing

Deterministic checks establish that a run conforms to its frozen contract and that every evidence passage exists verbatim in the regest. Whether a factoid is historically right is a separate question that only human verification answers. No statement is human verified yet, no reference set exists, and precision, recall and accuracy are unmeasured.

## Executed checks

[validate_factoid.py](../pipeline/validate_factoid.py) checks a factoid run per record and writes `validation/<stage>.json` with runtime versions and fingerprints, plus a German review sheet per stage.

- Contract and packet hashes against the manifest.
- Turtle parsing and allowed classes, predicates and concepts, with the type scheme matching act or state.
- SHACL with the vocabulary merged into the data graph.
- Evidence as an exact, contiguous substring of `summary_plain`.
- Actors only from the regest's own packet, the shared ruler or the declared local identifier policy.
- Explicit abstention and one result for every assigned UID.
- With `--self-test`, mutations that must each be caught (fabricated evidence, state type on an act, unknown concept, actor outside the packet, missing status, role from the wrong scheme, empty extraction) and a valid minimal record that must pass.

The exit code is 0 only if every record passes. In the run `factoid-2026-11-11` both the extracted and the revised stage pass, and the reviews still found errors in technically passing files ([adjudication](../pipeline/runs/factoid-2026-11-11/review/adjudication.json)). This is the gap between technical conformance and correctness that the edition makes visible by showing the revised stage with the extracted stage for comparison.

## Semantic review and limits

Two review agents read the source beside the graph without the extractors' reports. The parent adjudicates every finding against the frozen contract, a correction agent writes the revised stage, and the validator runs again. Findings recorded as model gaps or as not required stay in the adjudication.

Exact wording proves that the words exist, not that they support the factoid. SHACL conformance proves compliance with the selected constraints, not complete extraction or historical truth. Agreement between agents is no substitute for a reference.

## Development cases

These regesta lie in both runs and expose characteristic difficulties. Read the full packet and Turtle before relying on the description.

| UID | Issue |
|---|---|
| 22673 | Alternative marriage dates, not a continuous duration |
| 24821 | Earlier pledge, later confirmation and assurance |
| 220540 | Addressees overasserted as participants in the pilot, corrected while keeping the wording |
| 22696 | Right holder and investiture right |
| 25897 | Marriage negotiation must not become an asserted marriage |
| 24392 | Candidate negative case requiring expert confirmation |

## Reproduction

```powershell
uv run run.py validate
uv run run.py check
```

`run.py validate` checks both stages of `factoid-1153-2026-11-11` from inside `pipeline/`; `--run factoid-2026-11-11` checks the earlier run. Preparation refuses an existing run directory, and exploration overwrites its output only with `--force`. Extraction and review are recorded agent tasks and are not repeated by these commands.

## Transfer checks

[checks/test_pipeline.py](../checks/test_pipeline.py) checks that the run `factoid-1153-2026-11-11` arrives faithfully from the two supplied CSV files through packets and RDF to `edition.json` and TEI. It builds both outputs into a temporary folder with the scripts the site uses. Each check returns its errors; each test asserts that the real data yield none and that a named mutation of the real data yields at least one.

- Completeness: every selected UID has a packet, an extracted and a revised file, a regest in `edition.json`, a TEI file and a CSV row, and no stage holds a UID outside the selection. Mutation: one revised file removed.
- Field round trip: identifier, start and end date, date string, place and the plain summary of the CSV row equal packet, `edition.json` and TEI, with runs of whitespace collapsed as the only normalisation. Mutations: a changed start date, an altered TEI regest paragraph.
- Register references: every register entry the CSV assigns to a selected regest is an identity candidate of its packet and vice versa, and every register actor of the revised RDF and of the TEI is a candidate of its own packet or the shared ruler. Mutations: a dropped candidate, an actor from a foreign packet.
- Quote round trip: every `oa:exact` of the revised RDF and every TEI evidence span is verbatim regest text, and every TEI statement cites existing spans. Mutations: a changed selector, a changed TEI span.

These checks establish faithful transfer, not that a statement is right. Whether a quote supports its statement and whether something was left out is agentic review; whether the sources warrant a statement is scholarly validation, which no statement has yet. The checks do not yet cover that every accepted review finding was carried out in `revised/`.

At the move on 2026-11-17 the validation reports and the `build_data.py` and `build_tei.py` outputs at the new place were compared file by file with those built from `regesta-rdf-demo` f65887c and were identical.

## Pilot checks, archive

[validate_pilot.py](../pipeline/validate_pilot.py) checks the pilot against its CIDOC CRM contract, with [the extracted report](../pipeline/runs/pilot-2026-11-09/validation/extracted.json) and [the revised report](../pipeline/runs/pilot-2026-11-09/validation/revised.json). The extracted stage intentionally keeps a genuine SHACL failure, an untyped kinship state, and exits unsuccessfully. The revised stage passes. Repeated preparation reproduced the pilot packets byte-identically.

```powershell
cd pipeline
uv run validate_pilot.py --project-dir . --run-dir runs/pilot-2026-11-09 --stage extracted --self-test
uv run validate_pilot.py --project-dir . --run-dir runs/pilot-2026-11-09 --stage revised --self-test
```

## Next evaluation

- A historian verifies a subset against the regest text, proposed as the regesta of the factoid run ([Plan](plan.md)). Errors are logged per stage, so the error rate per stage becomes measurable.
- Evaluation separates unsupported claims from omitted in-scope facts, with actor identity, role, temporality and lost qualifications as error categories.
- Controlled mutations such as swapped actors, lost exceptions and overprecise dates show which errors the validator catches and which only human verification finds.
- An expert decision records case, statement and version, reason and scope. Generalising it into a rule or model change is a separate decision.
- An independent review of the validator and the SHACL shapes for missing targets, permissive constraints and tautological tests was requested by the operator and has not been carried out.
- No project typechecker is configured. Reports name the checks that actually ran, and a clean linter run is no audit of the validator's completeness.
