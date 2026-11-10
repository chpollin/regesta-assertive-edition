# AGENTS.md

Prototype of an assertive edition for the Barbarossa regesta pilot run of the sibling repository `regesta-rdf-demo`. Read `knowledge/project.md` first, then `knowledge/specification.md`, `knowledge/design.md` and `knowledge/data.md`.

## Boundaries

- `regesta-rdf-demo` is read only. `build_data.py` refuses an output path inside it.
- Everything shown comes from the run files. The build aborts when an evidence text or a quoted review passage is not verbatim in `summary_plain`.
- No runtime dependency from outside, no CDN, no SPARQL in the browser. Fonts are local under `fonts/` with their OFL texts.
- No commit, remote, push or publication without the operator. The source terms of the CSV delivery are unresolved, so the data files must not be published.

## Commands

Build the data (Python 3.11 with rdflib 7.6.0 and numpy, or `uv run build_data.py`):

```
python build_data.py
```

Serve and open the prototype:

```
python -m http.server 8091 --bind 127.0.0.1
```

Then open http://127.0.0.1:8091/. Port 8091 is the operator's; checks use another port.

Checks:

```
node --check js/app.js js/dom.js js/overview.js js/reading.js
python -m ruff check build_data.py checks/
python -m ruff format --check build_data.py checks/
python -m unittest discover -s checks -p "test_*.py"
python checks/ui_check.py
```

`checks/ui_check.py [port]` starts its own server on 127.0.0.1, port 8095 unless given, runs the browser assertions with Playwright and Chromium, writes screenshots to `review/` and stops the server.

## Layout

- `build_data.py` pipeline, writes `data/edition.json` (interface data) and `data/questions.json` (executed questions)
- `index.html`, `css/tokens.css`, `css/app.css`, `js/*.js` the no-build interface (native ES modules)
- `checks/` evidence-contract unit test and browser check
- `review/` screenshots of the last browser check
- `knowledge/` project knowledge; the research questions are in `knowledge/questions.md`
