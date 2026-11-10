---
title: Journal
status: draft
language: en
created: 2026-11-09
updated: 2026-11-09
---

# Journal

## 2026-11-09 First slice

Commission by the operator: a first inspectable interface for the pilot run `pilot-2026-11-09`, with all regesta, the Diepold case findable, named questions with executed SPARQL, and a design proposal. Built by a Claude Code subagent in a new local folder; `regesta-rdf-demo` was only read and its working tree stayed clean.

- The pipeline found the Diepold case through the query over the merged graph. Adela (RI004-002-A000306) has two parents labelled "Markgraf Diepold von Vohburg", `urn:regesta:actor:RI004-002-T000162` from n. 46 and `urn:regesta:actor:22794:local:diepold` from n. 167. The register rows of the CSV confirm "(III.), Markgraf von Vohburg und Cham" for n. 46 and "(VI.), Markgraf von Vohburg" (RI004-002-T000163, not assigned by the agent) for n. 167.
- The graph contains projection triples without their own E13, for example the performer and roles of the acts in n. 67. The reading view shows them with the marker "über Vorgangsbeleg" or "ohne Beleg".
- Some packet fields carry markup (`locality_string` of n. 2594) or the literal `null` (place of n. 3166a); both are rendered as segments or as "ohne Ortsangabe".
- Checks run: `node --check`, ruff lint and format, the evidence-contract unit test, two builds with different hash seeds giving identical JSON, and the Playwright check at 1440 and 390 px plus a 720 px state equivalent to 200 percent zoom.

Open: operator review of the design proposal; expert acceptance of the statements; the publication terms of the CSV delivery.

## 2026-11-09 Redesign after three rounds of operator feedback

The operator found the overview too text-heavy, decided that the questions to the data are knowledge rather than an interface, asked for interactive visualisations of the holdings, and asked for a better reading view and site design. The three requests were handled as one rebuild.

- The questions view was removed. The questions with their executed SPARQL and dated findings moved to `questions.md`; the pipeline still runs them, and the timeline arc, the graph's same-name edge and the reading-view cross references are built from the result of the same-name question.
- The overview became a timeline of the run in front of the delivery's distribution per year and a person graph with a build-time deterministic layout, linked with each other.
- The reading view now shows one sentence per act built from the graph, folds a right or thing into the act that concerns it, states the review state once, marks only deviations at a phrase, and uses one highlight, the red underline.
- The visual language follows the narrated film: dark stage, paper for source text, cool light for machine text, red pen for pointing and the open decision.
- Observation: the regesta of the run are mostly one long sentence, so the first-sentence rule of the text list often shows the whole text.
- Checks run: two builds compared byte for byte, `node --check`, ruff, the evidence unit test, and `checks/ui_check.py` in dark and light at 1440, 2000 and 390 px and at 720 px. The screenshots of the first state were replaced by those of this state.

Open: operator review of the redesign; contrast measured only by OKLCH distance; no screen reader test; three questions (rights, references between acts, conditions) have no cross-regest visualisation.
