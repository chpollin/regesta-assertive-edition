---
title: Architecture
project:
  name: Regesta Assertive Edition
  repository: https://github.com/chpollin/regesta-assertive-edition
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
status: draft
language: en
created: 2026-11-20
updated: 2026-11-20
template:
  name: Architecture template
  version: "0.4"
  url: https://dhcraft.org/Promptotyping/templates/architecture.md
related: [pipeline, data, testing, design, specification]
---

# Architecture

The edition is a static site built by a flat script pipeline in Python from two frozen sources, the CSV delivery of Regesta Imperii IV,2 and the frozen factoid runs in `pipeline/`. Every script reads these sources and writes generated files outside `pipeline/`, the browser loads prebuilt JSON and pre-rendered HTML, and no server, database or LLM runs at build or reading time. The simplicity is deliberate, because every shown value must be traceable to a run file or a CSV row and every build must be repeatable byte for byte. What the edition must do stands in [Specification](specification.md), how it looks in [Design](design.md), the steps and agents that produce the runs in [Pipeline](pipeline.md), the content of the generated files in [Edition data](data.md) and what each check establishes in [Testing](testing.md).

## Stack

- Python 3.11 or later for every build and check, because rdflib, pySHACL and lxml cover RDF, SHACL and TEI validation without a service. The root scripts form one script pipeline with `pyproject.toml` and a committed `uv.lock` (`package = false`, never installed), and the dependencies are pinned to the versions the frozen runs and the checks were built with (rdflib, pySHACL, lxml, NumPy and Shapely, with pytest and Ruff as the development group).
- The scripts in `pipeline/` keep their own PEP 723 blocks and `pipeline/ruff.toml`, because the hash of the validator is recorded in every validation report and a reformatting would change it ([Pipeline](pipeline.md#requirements)).
- `build_site.py` also carries a PEP 723 block of its own and calls itself a single-file script, while AGENTS.md runs it with plain `python`. It starts the other builds with the interpreter it runs under.
- The interface is native ES modules and plain CSS without a framework or build step, with local fonts under `fonts/` and the OFL texts beside them, so the site has no runtime dependency from outside ([Design](design.md#agent-briefing)).
- Git and GitHub Pages carry the publication, through the branch `gh-pages`.

## Components

| Component | Purpose | Interface and boundary |
|---|---|---|
| `pipeline/` | Exploration, selection, packets, validation and review summary of the factoid runs, and the frozen runs themselves | Its own scripts write only validation reports, `review-overview.md` and new runs. Frozen runs, contracts and `source-material/` are never edited ([Pipeline](pipeline.md)) |
| `run.py` | The one entry point of the RDF workflow | Holds no logic and calls the pipeline scripts, `build_data.py`, `build_tei.py`, `queries/run_queries.py` and `build_graph.py` with the paths of a run, and `check` runs the gate |
| `edition_io.py` | Shared CSV reader in the observed dialect of both delivery files, JSON loader, hash and markup helpers, place-name corrections, dating class and line rule, sort key, and `SHOWN_RUN` | Imported by the root scripts except `build_site.py`, never by the pipeline scripts |
| `register_names.py` | One short nominative name per register person | Imported by `build_data.py`, `build_holdings.py`, `build_graph.py` and `build_register_graph.py` |
| `build_data.py` | One run at one stage into `edition.json` and `questions.json` | Aborts on evidence or quoted review text that is not verbatim in `summary_plain`, and refuses an output path inside `pipeline/` |
| `build_tei.py` | One TEI P5 file per regest of a run | Validates against the vendored `schema/tei_all-4.12.0.rng` when `--schema` is given |
| `build_holdings.py`, `check_itinerary.py` | The whole-delivery layer of the views and the itinerary check | Read `pipeline/generated/regesta.jsonl` and the register CSV, with no LLM involved. Each mirrors the place-of-issue rule of the other by hand |
| `build_basemap.py`, `build_realm.py` | Base map and the Empire about 1190 | Write the committed `js/basemap.json` and `js/realm.json`, from Natural Earth files outside the repository and from `edition/realm-1190-trace.json` |
| `prepare_agent_review.py`, `build_agent_review.py` | Input and result of the agent review of 2026-11-14 | The result `edition/agent-review-2026-11-14.json` is read only by `build_site.py --preview` ([Edition data](data.md#agent-review)) |
| `build_site.py` | The curated site, German at the root and English under `en/` | Runs `build_data.py` twice, `build_tei.py`, `build_holdings.py` and `check_itinerary.py` as subprocesses and reads only their output. Writes nothing outside `--out`, deletes only files its previous build recorded in `.edition-build`, and refuses an output inside `pipeline/` and a preview build into `site/` |
| `publish_site.py` | One further commit of `site/` on `gh-pages` | Checks the build for internal material, builds the commit with a temporary index and pushes it as a fast-forward, without switching the working tree's branch |
| `queries/` | SPARQL questions and their loader `run_queries.py` | Loads the revised Turtle of a run, or an exported Turtle file, into one rdflib dataset in memory |
| `build_graph.py` | The reusable graph of one run's revised stage | Writes `data/graph/` ([Pipeline](pipeline.md#graph-export)) |
| `build_register_graph.py` | The whole delivery and the Register as RDF and JSON-LD, with the LLM proposals of the frozen runs | Writes `demo/registernetz/data/` and imports `build_graph.py` for skolemisation, language tags, agent description and the Turtle writer ([Register graph export](#register-graph-export)) |
| `index.html`, `js/`, `css/` | The views app, routed by hash in `js/app.js`, with the content-page scripts in `js/edition/` and every interface text in `js/i18n/de.json` and `en.json` | Reads only prebuilt JSON and renders delivery markup as segments with `textContent` |
| `checks/` | Contract, transfer, graph, export, layer, site, publication and register-graph checks | Run under pytest by `run.py check` ([Testing](testing.md)) |

## Data flow

```text
 pipeline/  (read by every edition build, written only by its own scripts)
 +----------------------------------+    +-------------------------------------+
 | source-material/                 |    | runs/<run>/  manifest, packets/,    |
 |   RI_004-002-ReggBarbarossa.csv  |    |   extracted/, revised/, validation/,|
 |   RI_004-002-RegisterBarbarossa  |    |   review/   (frozen by hash)        |
 | generated/regesta.jsonl          |    | contracts/factoid-2026-11-11/       |
 +----------------------------------+    +-------------------------------------+
      |               |                      |              |             |
      | regesta.jsonl | regest CSV,          | revised and  | revised     | revised Turtle
      | register CSV  | register CSV         | extracted    | Turtle      | of both
      v               v                      v              v             | factoid runs
 build_holdings  build_data <------------- (stage)     build_graph        |
 check_itinerary  build_tei                             (run.py export)   |
      |               |                                      |            |
      v               v                                      v            |
 holdings*.json   edition.json, questions.json        data/graph/         |
 itinerary-       tei/<slug>.xml (tei_all)            <run>.trig, .ttl,   |
 checks.json                                          <run>-report.json   |
      |               |                                                   |
      +-------+-------+     edition/texts.json, js/nav.json, js/i18n/     |
              v                    |                                      |
        build_site.py  <-----------+   (runs the four builds itself)      |
              |                                                           |
              v                                                           |
          site/  (gitignored)                                             |
              |                                                           |
     publish_site.py  internal-material gate                              |
              v                                                           |
      gh-pages --> GitHub Pages                                           |
                                                                          |
 source-material/ both CSV files  +  edition/texts.json  -----------------+
              |
     build_register_graph.py
              v
   demo/registernetz/data/  (gitignored)
     ri-iv-2.trig, context.jsonld, record/, entry/, roles.jsonld,
     dataset.jsonld, index.json, report.json
```

`build_data.py` and `build_tei.py` also read the regest CSV for the apparatus and the persistent link, `build_data.py` reads the register CSV for the register rows of a regest, and `build_graph.py` reads both CSV files for record fields and register names. `run.py build` writes `data/edition.json`, `data/questions.json` and `site/tei/` directly. `build_site.py` writes the view data into `site/ansicht/data/` and keeps the extracted stage in a temporary folder, for the comparison on the regest pages only. The validation points of each transition are listed under [Checks at the boundaries](#checks-at-the-boundaries).

## Register graph export

`build_register_graph.py`, added on 2026-11-20, turns the whole delivery into one RDF dataset for the register network. It reads the regest CSV and the register CSV of `pipeline/source-material/` with the shared reader, the revised Turtle and the packets of the two frozen runs `factoid-1153-2026-11-11` and `factoid-2026-11-11`, their manifests and contracts, and `edition/texts.json` for licence, source, attribution and the pattern of the persistent link. It writes into the gitignored `demo/registernetz/data/` and refuses an output path inside the source folder. Every triple of the deterministic layers follows from a rule over the two CSV files, and the LLM statements are copied from the frozen run files.

The TriG file `ri-iv-2.trig` holds one named graph per layer under `urn:regesta:export:ri-iv-2-csv`.

- `records`. One `crm:E31_Document` per regest row, `urn:regesta:record:<uid>`, with the RI identifier as `rdfs:label` and `dcterms:identifier`, Lieferung, number, number prefix and inserted suffix parsed from the identifier, start and end date as `xsd:date` where they parse, every filled text field as plain text with its language (Latin for the original dating, chancellor and incipit), and the links of `external_links` and the persistent link as `rdfs:seeAlso`. The database keys of the delivery stay out.
- `roles`. The role tokens of the register as the SKOS scheme `rrole:`, without glosses and without a mapping onto `rv:`, because their meaning awaits scholarly validation.
- `register`. One `skos:Concept` per register id in `urn:regesta:register`, classed by the leading word of the register type (person as `crm:E39_Actor` under `urn:regesta:actor:`, ort as `crm:E53_Place` under `urn:regesta:place:`, ereignis as `crm:E5_Event` under `urn:regesta:event:`, sache under `urn:regesta:subject:` without a CIDOC class). An entry of unknown type and every parent without a row of its own stand under `urn:regesta:register:`. The type stays as delivered in `rr:registerType`, the hierarchy is `rr:parentEntry`, and a parent without a row gets `rr:derivedLabel`, the most frequent label prefix of its children. Places get `geo:lat` and `geo:long` only when both values are decimals inside a box from 25 to 60 degrees north and 10 degrees west to 40 degrees east, and a GeoNames identifier becomes `skos:closeMatch`. Each CSV row becomes an `rr:RegisterRow`, `urn:regesta:mention:<id>:<uid>`, with entry, record, one `rr:role` per token and the comment. A second row of the same entry and regest gets the suffix `:2`, and a row whose identifier names two records points to both.
- `findings`. Every export defect becomes an `rr:ExportFinding` with type, concerned node, field and delivered value, among them unparsable dates, reversed intervals, start years absent from the printed dating, records of the late-added group without URN, duplicate identifiers, markup that swallowed a word, broken or unknown register types, implausible coordinates, conflicting attributes of one entry, duplicate rows and ambiguous or unresolved regest references. Nothing is repaired.
- One graph per regest with LLM proposals, `urn:regesta:run:<run>:revised:<uid>`. Where both runs hold a regest, the shown run wins. The file is skolemised and tagged `@de` with the functions of `build_graph.py`, and the export aborts on any verification status other than `rv:unchecked` and on a revised file without a record.
- `description`. A VoID description with licence, source, attribution, export date, the hashes of both CSV files and of the script, the statement that the LLM graphs are unchecked and no statements of Regesta Imperii, `rr:proposals` from each record to its LLM graph, and the producing agents with their contract hashes, which `build_graph.py` verifies against the manifests.

`skos:prefLabel@de` of an entry is a display name by rule, from `register_names.py` for persons, `edition_io.place_name` for places and the last label segment with its head for the rest. It is a normalisation of the script and no statement of the register.

Beside the TriG the script writes `context.jsonld`, the one hand-written JSON-LD context, one file per regest in `record/` and one per register entry in `entry/`, `roles.jsonld`, `dataset.jsonld`, `index.json` and `report.json`. Each JSON-LD file is a view on the graphs, a node with every one of its triples and its neighbours embedded through the reverse keys of the context. A regest file embeds its register rows with their entries, its findings and the graph object of its LLM proposals. An entry file embeds its parent chain, its children and its occurrences with the regesta they name. The writer takes its keys from the context by predicate and value kind and falls back to an expanded value under a compact IRI, so every file expands to triples of the TriG. Keys declared as `@set` are always arrays. `index.json` is plain JSON with every entry (id, IRI, label, short label, class, number of rows and a search form folded for case, diacritics and umlauts) and every regest in the order of `regest_order`. `report.json` holds the counts per graph and per finding type, and the script prints the finding counts as a warning. Files of `record/` and `entry/` that the run did not write are removed. The namespaces `rr:` and `rrole:` are placeholders on example.org like `rf:` and `rv:`, and the same inputs and `--date` give identical files.

The export differs from `build_graph.py` in scope and in its source of truth. `build_graph.py` exports the revised stage of one run with an enrichment graph for the regesta of that run, and `--rf-namespace` and `--rv-namespace` rewrite the provisional namespaces. The register export covers every regest and every register row of the delivery by rule, adds the proposals of both factoid runs as separate graphs and has no namespace option. The views app does not read its output. The static view `demo/registernetz/`, which reads these files, is under construction.

The two exports also join the Register differently from the whole-delivery layer. `build_holdings.py` assigns no register row where an identifier names two records ([Edition data](data.md#order-and-join-of-the-whole-delivery-layer)), and the register export points such a row to both records with a finding. The plausibility box for coordinates is 30 to 62 degrees north and 10 degrees west to 45 degrees east in `build_holdings.py` and `check_itinerary.py`, and 25 to 60 north and 10 west to 40 east in the register export.

`checks/test_register_graph.py` builds the export once into a temporary folder, reads the written TriG back and checks the files in the pattern of the other checks, real data without errors and a named mutation with at least one ([Pipeline](pipeline.md#register-graph-export)).

## Checks at the boundaries

Each transition has a check that runs against the real data and fails on a named mutation. What each establishes and leaves open stands in [Testing](testing.md).

| Boundary | Guard |
|---|---|
| Delivery CSV into every script | The strict reader of `edition_io.py`, which aborts on a malformed row, and `checks/test_edition_io.py` |
| Agent output into a run stage | `pipeline/validate_factoid.py` with `--self-test`, and `run.py validate`, which refuses reports of another validator |
| Run into `edition.json` and TEI | The verbatim aborts of `build_data.py` and `build_tei.py`, the tei_all validation, `checks/test_pipeline.py`, `checks/test_factoid.py`, `checks/test_build.py` and `checks/test_tei.py` |
| Revised stage as one graph | `checks/test_graph.py` through the loader of `queries/run_queries.py` |
| Graph export | `checks/test_export.py` |
| Whole-delivery layer and itinerary | `checks/test_holdings.py`, and `--check` of `build_holdings.py` and `check_itinerary.py` |
| Site build | `checks/test_site.py` |
| Publication | The gate of `publish_site.py` and `checks/test_publish.py` |
| Register graph export | `checks/test_register_graph.py`, with a slow full mode |
| Interface code | `node --check js/*.js js/edition/*.js` and the checks on the rendered state named in AGENTS.md |

`uv run run.py check` runs pytest over `checks/`, `ruff check` and `ruff format --check` with `uv run --locked`, so every machine checks with the versions of the lock. No typechecker is configured, and no continuous integration runs the gate.

## External models and services

No script calls an LLM, a web API or a remote service. The extraction, review and correction agents are dispatched from the conversation and leave their files in the run folder, and the LLM of each run stands in its manifest ([Pipeline](pipeline.md#responsibilities-and-artefacts)). At reading time the site loads nothing from outside, and links to Regesta Imperii, its book pages and GeoNames are plain outbound links.

## Interfaces to other projects or systems

### Regesta Imperii delivery

The project receives the two CSV files of RI IV,2 under CC BY 4.0 and keeps them unchanged in `pipeline/source-material/`. [Source data](source-data.md) is the source of truth for their dialect, joins and limits. Defects of the delivery are reported and never repaired, in the itinerary check, in `holdings.json` and as findings of the register export, and the open questions to the delivery are listed in the journal.

### regesta-rdf-demo

The pipeline came from this repository at f65887c on 2026-11-17. It stays as history, and manifests record paths relative to `pipeline/`, so the move left every hash valid.

## Security

The site is static and served by GitHub Pages, so it has no server-side attack surface, no accounts and no secrets. The client renders delivery markup as segments with `textContent` and parses no HTML from the data ([Edition data](data.md#editionjson)). The main risk is publishing internal material from a public site of a private repository. `publish_site.py` therefore aborts on knowledge, run, review, pipeline and check paths, on Markdown, Python, CSV and query files, on the agent review, on preview pages and preview data and on links into internal folders, also inside the zip package. `build_site.py` never copies `knowledge/` and refuses to write the preview build into `site/`. The accepted gap is that the gate checks names, suffixes and links and does not read scripts for paths they fetch ([Testing](testing.md#whole-delivery-layer-and-publication-gate)). The builds parse only local files from the frozen runs and the delivery.

## Accessibility

The requirements stand in [Specification](specification.md) (a text equivalent and keyboard operation for every visualisation, meaning never by colour alone) and in the invariants of the [Interface plan](interface-plan.md#invariants), among them a keyboard task from the Atlas to a statement's passage. Content pages are pre-rendered HTML readable without JavaScript. The interface is checked on the rendered state with the density check of the repository `pruefansicht`, screenshots and fresh readers, and no executable browser check has covered the shell since `checks/ui_check.py` was retired on 2026-11-14. No WCAG audit is recorded.

## Repository structure

| Folder or file | Function |
|---|---|
| `pipeline/` | The pipeline scripts, `source-material/`, `generated/`, `contracts/`, `runs/` and the pilot |
| `edition_io.py`, `register_names.py`, `run.py` | Shared reading and naming, and the entry point of the RDF workflow |
| `build_*.py`, `check_itinerary.py`, `prepare_agent_review.py`, `publish_site.py` | The builds, the itinerary check and the publication |
| `queries/` | SPARQL questions and their loader |
| `edition/` | Edition texts, the realm trace and the agent review of 2026-11-14 |
| `schema/` | The vendored tei_all schema |
| `data/` | `edition.json` and `questions.json` of the shown run (committed), the whole-delivery layer and `graph/` (gitignored) |
| `index.html`, `js/`, `css/`, `fonts/`, `img/` | The no-build views app and the scripts of the content pages |
| `demo/registernetz/` | The register network, whose `data/` is the gitignored output of `build_register_graph.py` |
| `checks/` | The pytest checks |
| `site/`, `site-preview/` | Gitignored builds, the published one and the local preview with the agent review |
| `knowledge/` | Project knowledge, never served |

## Build and deployment

The commands stand in AGENTS.md, which is their source of truth, together with `pyproject.toml` and `uv.lock`. Locally `python -m http.server` serves `site/` on port 8100 and the repository root on port 8096, both bound to 127.0.0.1. `python build_site.py` builds `site/` and `python build_site.py --preview` the gitignored `site-preview/`, which `publish_site.py` refuses. `python publish_site.py` publishes the current build as a further commit on `gh-pages` (`--dry-run` builds the commit without pushing), and GitHub Pages serves that branch at https://chpollin.github.io/regesta-assertive-edition/. The register export runs on its own with `uv run build_register_graph.py` and is not a step of `run.py` or of the site build.
