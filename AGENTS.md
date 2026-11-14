# AGENTS.md

Assertive edition of the Barbarossa regesta (RI IV,2) over the factoid runs of the sibling repository `regesta-rdf-demo`, with the whole delivery as a deterministic second layer. Read `knowledge/project.md` first, then `knowledge/plan.md` for the next steps, `knowledge/specification.md`, `knowledge/design.md`, `knowledge/ui-feedback.md` and `knowledge/data.md`.

## Boundaries

- `regesta-rdf-demo` is read only. `build_data.py` refuses an output path inside it.
- Everything shown comes from the run files or the delivery. The build aborts when an evidence text or a quoted review passage is not verbatim in `summary_plain`.
- No runtime dependency from outside, no CDN, no SPARQL in the browser. Fonts are local under `fonts/` with their OFL texts.
- The supplied data of Regesta Imperii are licensed CC BY 4.0 (`knowledge/data.md#rights`). Published derivatives carry attribution, licence link and a statement of modification; LLM statements never appear as statements of Regesta Imperii.
- Since 2026-11-11 the operator's standing approval covers committing and pushing this work. Force pushes, merges, tags, releases and visibility changes stay with the operator. Only the curated `site/` build is ever served publicly; `knowledge/`, runs and review material never.
- Publication: the branch `gh-pages` carries only the content of `site/` plus `.nojekyll` and is served by GitHub Pages at https://chpollin.github.io/regesta-assertive-edition/ (repository private, decided 2026-11-12). Every build goes on it as a further commit, never by force push, and only through `publish_site.py`, which checks the build for internal material first and never switches the working tree's branch.

## Commands

Build the interface data of a run, the whole-delivery layer, the itinerary check and the base map (Python 3.11 with rdflib 7.6.0, numpy and shapely, or `uv run`):

```
python build_data.py --run factoid-1153-2026-11-11
python build_holdings.py
python check_itinerary.py
python build_basemap.py
python build_realm.py
```

Build TEI and the curated edition site (default run `factoid-1153-2026-11-11`). The site goes to the gitignored `site/` and is never committed; `build_site.py` runs the data and TEI builds itself:

```
python build_site.py
```

Publish the current `site/` build (check, commit on `origin/gh-pages`, fast-forward push; `--dry-run` builds the commit without pushing):

```
python publish_site.py
```

Then open the public address in a browser and check start page, a regest page and a view.

Local servers, all bound to 127.0.0.1:

```
python -m http.server 8100 --bind 127.0.0.1 --directory site
python -m http.server 8096 --bind 127.0.0.1
```

8100 serves the curated build (views under `ansicht/`), 8096 the repository root for working on the views. `python build_site.py --preview` writes the gitignored `site-preview/` with the agent review shown at the statements; `publish_site.py` refuses such a build, and it goes public only on the operator's word. Questions come in the chat and checks happen on the product (operator's rule of 2026-11-12). Port 8091 is the operator's; checks use other ports.

Checks:

```
node --check js/*.js js/edition/*.js
python -m ruff check .
python -m ruff format --check .
python -m pytest -q checks
```

The interface is checked on the rendered state: `node tools/check_ui_density.cjs --profile work <url>` from the repository `pruefansicht` at 1280 and 360 px, screenshots of every changed view, and a fresh reader who answers task questions from the rendered page alone. The browser check of the first slice (`checks/ui_check.py`) was retired on 2026-11-14.

## Layout

- `build_data.py` run data into `data/edition.json` and `data/questions.json`; `build_holdings.py` the whole delivery into `data/holdings*.json`; `check_itinerary.py` into `data/itinerary-checks.json`; `build_basemap.py` into `js/basemap.json`
- `prepare_agent_review.py` the reader input of the agent review from the run's revised Turtle; `build_agent_review.py` joins the two readers into `edition/agent-review-2026-11-14.json`, read by `build_site.py --preview` (knowledge/data.md, Agent review)
- `build_realm.py` the Empire about 1190 from the trace `edition/realm-1190-trace.json` into `js/realm.json`; `publish_site.py` the publication on `gh-pages`
- `index.html`, `css/`, `js/*.js` the no-build views (native ES modules); routes in `js/app.js`, navigation in `js/nav.json`
- `build_tei.py` TEI per regest by rule; `schema/tei_all-4.12.0.rng` the vendored TEI schema
- `build_site.py` curated static edition site into `site/`; `edition/texts.json` title, definition, licence and attribution; `js/edition/` its content pages
- `checks/` contract tests and the outdated browser check; `review/` screenshots
- `knowledge/` project knowledge
