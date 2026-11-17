---
title: Pipeline
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

# Pipeline

The pipeline produces the factoids the edition shows. It lives in `pipeline/` of this repository since 2026-11-17 and came from the repository `regesta-rdf-demo` at commit f65887c, whose history stays there. The edition reads it and never writes into it, apart from the validation reports, the review overview and new runs that the pipeline scripts themselves write. It combines deterministic preparation and validation scripts with extraction, review and correction agents dispatched from the conversation. Python never calls an LLM, dispatches agents or retries on its own. Each run freezes its contract by hash in its manifest and keeps every stage in its own folder.

## The eight steps

`run.py` in the repository root is the one entry point. It holds no logic of its own and calls the scripts below with the paths of the current run, so what teaching shows is what runs. Each step leaves its result in its own folder of `pipeline/runs/<run>/`.

1. Selection, `uv run run.py select`: `pipeline/select_slice.py` writes `selection.json`.
2. Packets, `uv run run.py prepare`: `pipeline/prepare_pilot.py` writes one hash-checked packet per regest to `packets/` and the manifest.
3. Contract: `pipeline/contracts/factoid-2026-11-11/` with ontology, vocabulary, shapes, annotation guidelines and prompts, frozen by hash in the manifest.
4. Extraction, agent task: one Turtle file per regest in `extracted/`, or an explicit abstention.
5. Technical check, `uv run run.py validate`: `pipeline/validate_factoid.py` for both stages, reports in `validation/`.
6. Review, agent task: two independent reviews per group and an adjudication in `review/`; `uv run run.py review` derives `review-overview.md` from the adjudications with `pipeline/summarize_review.py`.
7. Correction, agent task: accepted findings into `revised/`, then the technical check again.
8. Build, `uv run run.py build`: `build_data.py` and `build_tei.py` read the revised stage; `uv run run.py check` runs the transfer checks of [Testing](testing.md#transfer-checks).

Steps 1 and 2 refuse an existing output folder, so they start only a new run. The run shown is `factoid-1153-2026-11-11`, technically passing in its revised stage and not expert validated (manifest `expert_accepted` false).

## Requirements

- Preserve the input bytes and record source fingerprints. Read the observed CSV dialect strictly and stop on schema or encoding violations.
- Keep exported identifiers as strings, retain source-row addresses and distinguish regest records, register IDs, occurrence rows and role tokens ([Source data](source-data.md)).
- Store statements as factoids of the [Factoid model](factoid-model.md), each with exact evidence, named producer and review state.
- Freeze each run's contract by hash in its manifest. Paths in manifests are relative to `pipeline/`, so the move into this repository left every hash valid. A model change needs a new recorded baseline, and earlier runs stay unchanged.
- Keep extracted, review, revised and validation stages separate, including failures and abstentions.
- Treat every statement as unchecked until human verification. A technical pass or an agent review never sets acceptance.
- The pipeline scripts keep their own `pipeline/ruff.toml`, because the validator's hash is recorded in every validation report and reformatting would change it.

## Data-generation pipeline

```text
Supplied CSV files
        |
explore_regesta.py      profiles, exact joins, reading derivatives (generated/)
        |
selection               seeded draw (select_fresh.py) or date slice (select_slice.py)
        |
prepare_pilot.py        hash-checked packets per regest with register candidates, manifest
        |
extraction agents       one Turtle file per regest, or an explicit abstention
        |
validate_factoid.py     extracted stage
        |
review A, review B      two independent source-based LLM reviews
        |
adjudication            the parent checks each finding against the frozen contract
        |
correction              accepted findings only, written to a separate stage
        |
validate_factoid.py     revised stage
        |
human verification      of a subset, still pending
```

The build of view data, TEI and the public site follows the revised stage and is described in [Data interface](data.md).

## Responsibilities and artefacts

| Stage | Responsibility | Persistent result |
|---|---|---|
| Exploration | Deterministic CSV parsing, profiles and exact joins | `generated/` and source fingerprints |
| Selection | Seeded draw recorded before any contract change, or the contiguous slice up to a cutoff date, reusing regesta of an earlier run without new extraction | `contracts/factoid-2026-11-11/selection.json`, `runs/factoid-1153-2026-11-11/selection.json` |
| Preparation | Verify input and derivative hashes, attach register candidates, hash the contract | `runs/<run>/packets/`, `runs/<run>/manifest.json` |
| Extraction | Read the assigned summary within the frozen contract | `runs/<run>/extracted/*.ttl` and batch outcomes |
| Validation | Syntax, allowed terms, SHACL, exact wording, actor policy, abstention and coverage | `runs/<run>/validation/extracted.json` and a German review sheet |
| Review | Read source and graph, report unsupported claims and omissions | `runs/<run>/review/review-A.json`, `review-B.json` |
| Adjudication | Accept or reject each finding against the contract | `runs/<run>/review/adjudication.json` |
| Correction | Address accepted findings while keeping the extracted stage | `runs/<run>/revised/*.ttl`, `revised/corrections.json` |
| Revalidation | The same checks on the revised stage | `runs/<run>/validation/revised.json` and review sheet |
| Human verification | Historical judgement of readings and model fitness | Pending |

The LLM of each run stands in its manifest. The pilot ran with `gpt-6.1-terra`, the factoid run with `claude-opus-5-5`. A review agent reports findings without editing the graph, and its findings are no ground truth. In the pilot the parent rejected a reviewer demand for separate attribution on every structural edge, which the frozen contract did not require. No automatic ontology change, unlimited retry loop or automatic acceptance exists. Failed checks stay in the report of their stage.

## Identity and provenance

Register IDs are identity candidates per regest and are never merged across regesta. The factoid contract admits register entries of the regest's own packet, the shared ruler, regest-local actors and office-bound functional actors ([Factoid model](factoid-model.md)). Each factoid names its producer and carries the review state `unchecked`. Every packet keeps the source UID, summary, selected metadata and register context, and the local filenames and hashes identify the inputs.

## Pilot pipeline, archive

The pilot `pilot-2026-11-09` ran the same stage sequence with two reviews of the extracted stage, a review of the revised stage and a focused check of the final correction, using the CIDOC CRM profile of [Domain ontology](domain-ontology.md) and `validate_pilot.py`. Its teaching graphic is [docs/pipeline.svg](../pipeline/docs/pipeline.svg) with German labels. The pilot stays unchanged and checkable against its own contract.
