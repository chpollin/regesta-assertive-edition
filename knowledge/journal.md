---
title: Journal
status: draft
language: en
created: 2026-11-09
updated: 2026-11-09
---

# Journal

## 2026-11-11 Relation sectors and the space view

After the operator's second feedback (verbatim in design.md): acts are diamonds; a selected person gets a circle with eight fixed relation sectors from `js/relations.js`, named at the frame, the other people of each act further out on its bearing; the panel groups a person's relations by the same families; labels avoid nodes, edges and other labels in both modes, and a label that finds no clean place sits on a plate or appears on pointing. Measured in Chromium at 1280 and 360 px around Adela, around Friedrich and on the whole network: no label on a label, none on a node; one act label ("Verhandlung") still touches an edge around Friedrich at 1280. In the whole network only a few names stand, the rest appear on pointing. A separate agent built the rotatable space view at `#/raum` (js/space.js, css/space.css, plan in [space-view.md](space-view.md)): time upwards, the same relation directions, keyboard and mouse rotation, reset button. Draft, not accepted, not committed.

## 2026-11-11 Holdings view as one screen

After the operator's screen feedback on the factoid version (verbatim in design.md), the holdings view became one connected view: time strip, person graph and selection panel fit 1280 × 800 without scrolling, legends sit behind a question mark, lists behind a switch, the Adela case is preselected and shown in two lines, standing graph labels only for the case and the eight most connected people. Checked at 1280 × 800 light and dark and at 360 px, keyboard on the timeline, console clean, unit tests and lint green, pilot build byte-identical. `checks/ui_check.py` not run; some of its assertions refer to the old layout. Draft, not accepted, not committed.

## 2026-11-11 Factoid run read into the same interface

The Research Coordination asked for a second reader so the interface can show `factoid-2026-11-11` beside the pilot. `build_data.py` now detects the data model from the RDF and maps factoids into the existing schema, as recorded under [Factoid model](data.md#factoid-model). The revised stage is the default after the source repository committed it, `--stage extracted` stays possible.

- Pilot path unchanged. `python build_data.py` with defaults reproduced `data/edition.json` and `data/questions.json` byte for byte (SHA-256 compared against a copy secured before the change). The repository data files were not overwritten with factoid output.
- The same-name question finds the Adela case in the factoid data only after inflection endings are stripped, because n. 46 writes "Markgraf Diepolds" and n. 167 "Markgrafen Diepold". The matching is an interface heuristic and decides no identity.
- One frontend line: the reading-view cross reference shows the other regest's name form when it differs. The unresolved-identity notes now match a local actor's slug as a whole word, so "abt" no longer hits "Reichsabtei".
- Checks run: `node --check`, ruff lint and format, the unit tests including the new `checks/test_factoid.py` (every span verbatim, for both stages), two factoid builds with different hash seeds identical, and the factoid build served from a scratch copy on port 8098 and read in Chromium at 1280 px dark and light and at 390 px. `checks/ui_check.py` was not run.

Open: the headline still says "Regesten des Pilotlaufs" for the factoid run. The denser factoid graph crowds labels, and the case labels cross other nodes at narrow width. The reviews' `coverage_note` has no place in the schema and is not shown.

## 2026-11-11 Six proposals of the interface review

The Research Coordination commissioned, on the operator's go-ahead, proposals 1, 2, 3, 4, 6 and 7 of the interface review of 2026-11-11 (operator file `regesten` in the vault). Proposal 5, a resting mark on all evidence spans, touches the one-highlight rule of design.md and waits for the operator.

- Case named (1, 6). `build_data.py` attaches regest and register entry to the two parent nodes of the same-name case. Graph labels carry them in a second line and stay inside the image at 360 px; the panel names them, the IRI moved into a closed detail.
- Reading view (2). The case block is two sentences, one per regest, with the register wording at reading size; the table is gone, the IRIs sit in a closed detail. A link next to the pager jumps to the block, which at narrow width starts several screens down.
- Timeline (3). Marks stand at their delivered date; overlapping heads move vertically to the nearest free height. Years of the dating prose outside the machine interval (`proseYears`) appear as open diamonds. The Adela arc now ends in 1147 and 1153.
- Coupling (4). The status line under the axis names the persons lit up in the graph, the panel column shows the case without a selection, the timeline is lower.
- Accessibility (7). Delivery bars and role edges reach 3:1 against the stage by computed OKLCH contrast; stems have a stage-coloured halo against the darker bars; hit circles are 24 px; the status line no longer cuts the regest text.
- Checks run: `node --check`, ruff lint and format, the evidence unit test, two builds byte-identical, rendered views read at 1280 and 360 px in dark and light, keyboard step on the timeline. `checks/ui_check.py` waits for the operator's acceptance and was not run.

Open: in light scheme the marks stand at about 2.6:1 against the darker bars; no screen reader test; timeline hit areas still overlap in the 1152 cluster, where the list and the arrow keys are the equivalent.

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
