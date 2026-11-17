# Barbarossa-Regesten, an assertive edition

An experiment in building a scholarly edition with LLM agents on the regesta of Friedrich Barbarossa in the Regesta Imperii IV,2: agents extract statements (factoids) from the regest texts, each bound to its exact wording, with a named producer and a review state, and the edition shows them beside the regest. It is an experiment and a teaching example, not a validated edition. The curated site is public at https://chpollin.github.io/regesta-assertive-edition/; this repository is private.

## Data and licence

The regesta and register are a CSV export of Regesta Imperii Online, licensed CC BY 4.0 and modified here. Texts and derived data of this project are CC BY 4.0, code is MIT, fonts keep their OFL. Details and attribution are in [LICENSE-DATA.md](LICENSE-DATA.md) and [LICENSE](LICENSE). LLM statements are never statements of Regesta Imperii.

## State of validation

- Technical: the revised stage of the shown run `factoid-1153-2026-11-11` passes the validator of its frozen contract (syntax, vocabulary, SHACL, verbatim evidence, actor policy), and the checks in `checks/` establish faithful transfer from the CSV to RDF, view data, TEI and the graph export.
- Agentic review: two independent LLM reviews per group of regesta with an adjudication and a correction; a further agent reading of twenty regesta is shown only in the local preview. Agent findings are evidence, not ground truth.
- Expert: none. No historian has validated a statement (`expert_accepted` false in every run manifest).

## Quick start

Requirements: [uv](https://docs.astral.sh/uv/) and Python 3.11 or later. `uv` installs the locked dependencies of `pyproject.toml` and `uv.lock` on first use. Python never calls an LLM.

```
uv run run.py validate         technical check of both stages of the shown run
uv run run.py build            data/edition.json, data/questions.json and TEI in site/tei/
uv run run.py check            pytest over checks/, ruff check and ruff format --check
uv run run.py export           the reusable graph in data/graph/
uv run run.py graph --export   the queries of queries/ on that graph
```

`validate` refuses a run whose reports were written by another validator unless `--allow-validator-change` is given, so frozen reports are not rewritten by accident.

Local preview of the views from the repository root:

```
python -m http.server 8096 --bind 127.0.0.1
```

Then open http://127.0.0.1:8096/. Building and publishing the curated site are described in [AGENTS.md](AGENTS.md).

## The RDF

The statements lie per regest in `pipeline/runs/factoid-1153-2026-11-11/revised/*.ttl`, frozen by hash. `uv run run.py export` derives one graph from them in `data/graph/` (TriG with one named graph per regest, a Turtle union and a report), adding record metadata from the CSV, stable IRIs for references and evidence selectors, language tags, described producers and a VoID description. Model in one line: a factoid (`rf:ActFactoid` or `rf:StateFactoid`) records what one passage of a regest says, with its type, its evidence quote, references to actors with roles, its producer and `rf:verificationStatus rv:unchecked`. The `rf:` and `rv:` namespaces under example.org are provisional. See [knowledge/factoid-model.md](knowledge/factoid-model.md).

## Layout

- `pipeline/` the pipeline: source material, contracts, runs with every stage, validators
- `run.py` the entry point of the workflow; `edition_io.py` the shared CSV reader and helpers
- `build_*.py`, `check_itinerary.py`, `register_names.py` the builds of view data, TEI, site and graph export
- `index.html`, `css/`, `js/`, `fonts/` the views; `edition/` texts and the agent review
- `checks/` the tests; `queries/` SPARQL questions and their runner; `schema/` the TEI schema
- `data/` view data and the gitignored graph export
- `knowledge/` the project knowledge, starting at [knowledge/INDEX.md](knowledge/INDEX.md); agent instructions in [AGENTS.md](AGENTS.md)

## Origin

The pipeline began on 2026-11-09 in the repository `regesta-rdf-demo` for the guest unit „Agentic Engineering für Forschungsdatenworkflows“ at Technische Hochschule Mittelhessen on 20 November 2026 and moved here on 2026-11-17; its history up to commit f65887c stays there.
