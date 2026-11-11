# AGENTS.md

Assertive edition of the Barbarossa regesta (RI IV,2) over the factoid runs of the sibling repository `regesta-rdf-demo`, with the whole delivery as a deterministic second layer. Read `knowledge/project.md` first, then `knowledge/plan.md` for the next steps, `knowledge/specification.md`, `knowledge/design.md`, `knowledge/ui-feedback.md` and `knowledge/data.md`.

## Boundaries

- `regesta-rdf-demo` is read only. `build_data.py` refuses an output path inside it.
- Everything shown comes from the run files or the delivery. The build aborts when an evidence text or a quoted review passage is not verbatim in `summary_plain`.
- No runtime dependency from outside, no CDN, no SPARQL in the browser. Fonts are local under `fonts/` with their OFL texts.
- The supplied data of Regesta Imperii are licensed CC BY 4.0 (`knowledge/data.md#rights`). Published derivatives carry attribution, licence link and a statement of modification; LLM statements never appear as statements of Regesta Imperii.
- Since 2026-11-11 the operator's standing approval covers committing and pushing this work. Creating the public repository, force pushes, merges, tags, releases and visibility changes stay with the operator. Only the curated `site/` build is ever served publicly; `knowledge/`, runs and review material never.

## Commands

Build the interface data of a run, the whole-delivery layer, the itinerary check and the base map (Python 3.11 with rdflib 7.6.0, numpy and shapely, or `uv run`):

```
python build_data.py --run factoid-1153-2026-11-11
python build_holdings.py
python check_itinerary.py
python build_basemap.py
```

Build TEI and the curated edition site (default run `factoid-1153-2026-11-11`). The site goes to the gitignored `site/` and is never committed; `build_site.py` runs the data and TEI builds itself:

```
python build_site.py
```

Local servers, all bound to 127.0.0.1:

```
python -m http.server 8100 --bind 127.0.0.1 --directory site
python -m http.server 8096 --bind 127.0.0.1
```

8100 serves the curated build (views under `ansicht/`), 8096 the repository root for working on the views. Port 8091 is the operator's; checks use other ports.

Checks:

```
node --check js/*.js js/edition/*.js
python -m ruff check .
python -m ruff format --check .
python -m pytest -q checks
```

`checks/ui_check.py` still asserts the layout of the first slice and does not apply to the current shell (see `knowledge/plan.md`).

## Layout

- `build_data.py` run data into `data/edition.json` and `data/questions.json`; `build_holdings.py` the whole delivery into `data/holdings*.json`; `check_itinerary.py` into `data/itinerary-checks.json`; `build_basemap.py` into `js/basemap.json`
- `index.html`, `css/`, `js/*.js` the no-build views (native ES modules); routes in `js/app.js`, navigation in `js/nav.json`
- `build_tei.py` TEI per regest by rule; `schema/tei_all-4.12.0.rng` the vendored TEI schema
- `build_site.py` curated static edition site into `site/`; `edition/texts.json` title, definition, licence and attribution; `js/edition/` its content pages
- `checks/` contract tests and the outdated browser check; `review/` screenshots
- `knowledge/` project knowledge
