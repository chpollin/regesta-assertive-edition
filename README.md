# Barbarossa-Regesten, an assertive edition

An experiment in building a scholarly edition with LLM agents on the basis of the Regesta Imperii IV,2, the regesta of Friedrich Barbarossa. LLM agents extract statements (factoids) from the regest texts, each bound to its exact words, with a named producer and a review state. Deterministic scripts check them, two independent agent reviews and a correction follow, and the edition shows the result beside the regest.

No statement is validated by a historian (`expert_accepted` false in every run manifest). A technical pass or an agent review establishes conformance to the frozen contract, not historical truth or completeness.

The public site is served from the branch `gh-pages`: https://chpollin.github.io/regesta-assertive-edition/

## Layout

- `pipeline/` produces the statements: source material, exploration, selection, packets, frozen contracts, runs with every stage, and the validators.
- `run.py` runs the workflow step by step (`validate`, `review`, `build`, `check`; `select` and `prepare` start a new run).
- `build_*.py` build the view data, TEI per regest and the curated site; `publish_site.py` publishes it.
- `index.html`, `css/`, `js/` the views; `edition/` texts and the agent review; `checks/` the tests.
- `knowledge/` the project knowledge, starting at [knowledge/INDEX.md](knowledge/INDEX.md). Agent instructions are in [AGENTS.md](AGENTS.md).

```
uv run run.py validate
uv run run.py build
uv run run.py check
```

## Origin

The pipeline began on 2026-11-09 in the repository `regesta-rdf-demo` for the guest unit „Agentic Engineering für Forschungsdatenworkflows“ at Technische Hochschule Mittelhessen on 20 November 2026 and moved here on 2026-11-17; its history up to commit f65887c stays there.

## Licence

The regesta and register come from Regesta Imperii Online under CC BY 4.0 and were processed. Texts and data of this edition are CC BY 4.0, code is MIT. LLM statements are never statements of Regesta Imperii.
