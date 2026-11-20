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
updated: 2026-11-20
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

Steps 1 and 2 refuse an existing output folder, so they start only a new run. Step 5 refuses a run whose validation reports record a validator hash other than that of the current `validate_factoid.py`, since validating would rewrite frozen reports with another validator; `--allow-validator-change` overrides this deliberately. The run shown is `factoid-1153-2026-11-11` (`SHOWN_RUN` in `edition_io.py`), technically passing in its revised stage and not expert validated (manifest `expert_accepted` false). After the build, `uv run run.py export` derives the reusable graph ([Graph export](#graph-export)).

## Requirements

- Preserve the input bytes and record source fingerprints. Read the observed CSV dialect strictly and stop on schema or encoding violations.
- Keep exported identifiers as strings, retain source-row addresses and distinguish regest records, register IDs, occurrence rows and role tokens ([Source data](source-data.md)).
- Store statements as factoids of the [Factoid model](factoid-model.md), each with exact evidence, named producer and review state.
- Freeze each run's contract by hash in its manifest. Paths in manifests are relative to `pipeline/`, so the move into this repository left every hash valid. A model change needs a new recorded baseline, and earlier runs stay unchanged.
- Keep extracted, review, revised and validation stages separate, including failures and abstentions.
- Treat every statement as unchecked until human verification. A technical pass or an agent review never sets acceptance.
- The pipeline scripts keep their own `pipeline/ruff.toml` and their PEP 723 blocks, because the validator's hash is recorded in every validation report and reformatting would change it. The root scripts form a script pipeline with one `pyproject.toml` and a committed `uv.lock`; they share `edition_io.py`, whose one CSV reader follows the observed dialect of both delivery files. `uv run run.py check` runs pytest and ruff from the lock.

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

The build of view data, TEI and the public site follows the revised stage and is described in [Edition data](data.md); the reusable graph export under [Graph export](#graph-export).

## Graph export

`build_graph.py` (`uv run run.py export`) reads the revised stage of the shown run and writes, without touching the run, one graph to the gitignored `data/graph/`: a TriG file with one named graph per regest plus an enrichment graph and a description graph, the Turtle union of all of them, and a report with counts and findings. The rewrites are documented in its module docstring and checked in [Testing](testing.md#export-checks):

- Records get the RI identifier as `rdfs:label` and `dcterms:identifier`, the delivered start and end date as `xsd:date` where they parse, dating prose and place string as German literals and `rdfs:seeAlso` to the persistent link of Regesta Imperii. Invalid dates, reversed intervals and missing persistent identifiers are reported, never repaired.
- Blank-node references and evidence selectors become `<factoid>:reference-<n>` and `<factoid>:evidence-<n>`, numbered in a canonical order (selectors by position in the regest text, references by role, actor and name in the source), so a later judgement can point at them.
- Plain literals of the run are German regest text and get `@de`, except the RI identifier that labels a record.
- Every producing agent is described as `prov:SoftwareAgent` with run, batch or group, stage, prompt and LLM from the manifests; register persons get a normalised `skos:prefLabel` from `register_names.py`.
- A VoID description states licence, source and attribution, run, contract hashes, export date and that the statements are LLM-produced and unchecked.
- The `rf:` and `rv:` namespaces are provisional example.org namespaces; `--rf-namespace` and `--rv-namespace` rewrite them, and the queries of `queries/` answer on the export only under the current ones.

## Register graph export

`build_register_graph.py` reads the regest CSV and the register CSV of `pipeline/source-material/`, the revised Turtle and the packets of the frozen runs `factoid-1153-2026-11-11` and `factoid-2026-11-11` with their manifests and contracts, and `edition/texts.json`. Without touching `pipeline/`, it writes into the gitignored `demo/registernetz/data/` one TriG file `ri-iv-2.trig` with a named graph per layer, the hand-written JSON-LD context `context.jsonld`, one JSON-LD file per regest in `record/` and per register entry in `entry/`, `roles.jsonld`, `dataset.jsonld`, the search index `index.json` and `report.json` with the counts per graph and per finding type. Its decisions are recorded in its module docstring, and [Architecture](architecture.md#register-graph-export) describes the layers.

```powershell
uv run build_register_graph.py
uv run build_register_graph.py --out <folder> --date 2026-11-20
```

`--source` and `--texts` name other inputs, and an output path inside the source folder is refused. The step belongs to no command of `run.py` and to no site build.

- Scope. `build_graph.py` exports the revised stage of one run with an enrichment for that run's regesta. The register export maps the whole delivery and the Register by rule, without an LLM, into the layers records, roles, register, findings and description, and adds the revised stage of each frozen run as one graph per regest, the shown run winning where both runs hold a regest.
- Reuse. Skolemisation, the `@de` tags, the description of the producing agents with the contract hashes verified against the manifests, and the Turtle writer are the functions of `build_graph.py`. A namespace option is missing, so `rf:` and `rv:` stay on the provisional namespaces, and `rr:` and `rrole:` are placeholders of the same kind.
- Defects. An export defect of the delivery becomes an `rr:ExportFinding` with type, concerned node, field and delivered value and is never repaired. A proposal graph with a verification status other than `rv:unchecked` aborts the export.
- Determinism. The same inputs and `--date` give identical files.

[checks/test_register_graph.py](../checks/test_register_graph.py) builds the export once into a temporary folder and reads the written TriG back. It checks the number of records and register rows against the CSV, every register row's entry, regest, roles and comment against the CSV one by one for RI IV,2,3 n. 2077 and as a multiset over all rows, a set of known cases (the one witness row of n. 2077, the implausible coordinate of Kaiserslautern, Beatrix as petent with the comment Vermittlung, the missing URN of n. 3166a, the duplicated identifier n. 1520a, the duplicated register rows and the unchecked LLM graph of n. 3166a), and that the JSON-LD files parse, state no triple the TriG lacks, give each LLM graph exactly and keep `@set` keys as arrays. Each check also fails on a named mutation. `uv run run.py check` runs the JSON-LD check on a sample of the files. The full round trip over every file and the determinism of two runs under different hash seeds take a few minutes and start with this command:

```powershell
$env:REGISTER_GRAPH_FULL = "1"; uv run pytest -q checks/test_register_graph.py
```

What the checks establish is a faithful export of the delivery and the runs. Whether a register entry or an LLM statement is right stays open.

## Responsibilities and artefacts

| Stage | Responsibility | Persistent result |
|---|---|---|
| Exploration | Deterministic CSV parsing, profiles and exact joins | `generated/` and source fingerprints |
| Selection | Seeded draw recorded before any contract change, or the contiguous slice up to a cutoff date, reusing regesta of an earlier run without new extraction | `contracts/factoid-2026-11-11/selection.json`, `runs/factoid-1153-2026-11-11/selection.json` |
| Preparation | Verify input and derivative hashes, attach register candidates, hash the contract | `runs/<run>/packets/`, `runs/<run>/manifest.json` |
| Extraction | Read the assigned summary within the frozen contract | `runs/<run>/extracted/*.ttl` and batch outcomes |
| Validation | Syntax, allowed terms, SHACL, exact wording, actor policy, abstention and coverage | `runs/<run>/validation/extracted.json` and a German review sheet |
| Review | Read source and graph, report unsupported claims and omissions | `runs/<run>/review/review-A.json`, `review-B.json`; per group `review-gN-A.json`, `review-gN-B.json` in the shown run |
| Adjudication | Accept or reject each finding against the contract | `runs/<run>/review/adjudication.json` |
| Correction | Address accepted findings while keeping the extracted stage | `runs/<run>/revised/*.ttl`, `revised/corrections.json` |
| Revalidation | The same checks on the revised stage | `runs/<run>/validation/revised.json` and review sheet |
| Human verification | Historical judgement of readings and model fitness | Pending |

The LLM of each run stands in its manifest. The pilot ran with `gpt-6.1-terra`, the factoid run with `claude-opus-5-5`. A review agent reports findings without editing the graph, and its findings are no ground truth. In the pilot the parent rejected a reviewer demand for separate attribution on every structural edge, which the frozen contract did not require. No automatic ontology change, unlimited retry loop or automatic acceptance exists. Failed checks stay in the report of their stage.

## Identity and provenance

Register IDs are attached per regest, and the pipeline never merges actors itself. Because actor IRIs are minted from the register ID, the same register entry is one node across regesta once the files are loaded together ([Factoid model](factoid-model.md#identity-across-regesta)). The factoid contract admits register entries of the regest's own packet, the shared ruler, regest-local actors and office-bound functional actors ([Factoid model](factoid-model.md)). Each factoid names its producer and carries the review state `unchecked`. Every packet keeps the source UID, summary, selected metadata and register context, and the local filenames and hashes identify the inputs.

## Pilot pipeline, archive

The pilot `pilot-2026-11-09` ran the same stage sequence with two reviews of the extracted stage, a review of the revised stage and a focused check of the final correction, using the CIDOC CRM profile of [Domain ontology](domain-ontology.md) and `validate_pilot.py`. Its teaching graphic is [docs/pipeline.svg](../pipeline/docs/pipeline.svg) with German labels. The pilot stays unchanged and checkable against its own contract.
