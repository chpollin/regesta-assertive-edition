---
title: Journal
status: draft
language: en
created: 2026-11-09
updated: 2026-11-17
---

# Journal

## Open

- The operator has not seen the pass of 2026-11-14 evening in the local preview (`python build_site.py --preview` into `site-preview/`, served with `python -m http.server 8132 --bind 127.0.0.1 --directory site-preview`): the regest page in three areas with the annotation system, the start page as the full-screen cube, the regest tooltip and relations in the cube, persons as traces in the cube, estate colours, header and footer. His next words go verbatim into ui-feedback.md.
- Nothing of it is published. The agents' verdicts go public only on his word after he has seen the restructured regest page; the coordination read his „ja, aber“ as yes in principle. The public method text changes with the next publication to the agentic check of the twenty regesta, in both builds.
- Itinerar and Jahrzehnte: put to the operator as a question with an example (the decade 1150 to 1159 chosen in the time band shows 433 regesta at 104 places, Würzburg and Crema with 28 each); the switch is not rebuilt before his answer.
- The specification carries five requirements derived from his verdicts as proposals with acceptance criteria; the older list of the first slice stays as history until he adopts them (specification.md).
- Findings of the fresh reader not yet acted on: the statement „Urteil“ of n. 103a bundles king, witnesses, judge and beneficiary; statements of a forged regest (n. †193) read like facts, the metadata now say „Fälschung“ but the statements carry no mark; the place picker lists register entries that are regions, rivers or a person (Italien, Po, Johannes).
- The regest pages exceed the word budget of the work profile by their source text alone (regest, transmission, commentary).
- No executable browser check covers the shell since `checks/ui_check.py` was retired; test tasks with computed answers per user story are planned and not built (plan.md, Test tasks).
- The estate rule (js/stand.js, data.md Estate) errs on name forms without a title (Konrad III. as a regest-local node) and on forms that name a ruler in passing.
- The model questions in factoid-model.md (Open questions for experts) wait for the operator and for experts, including the cases of the agent review of 2026-11-14: grants beside a confirmation as part of it or separate (n. †193), predecessors' acts typed as Grant (n. 145, n. 116), an exchange without a vocabulary term (n. 96), a complaint without a forum (n. 191).
- The demonstration slides Demo 1 to Demo 4 of the THM deck still name paths of `regesta-rdf-demo`; the new paths went to the Research Coordination on 2026-11-17.
- The two assertion extensions in factoid-model.md (Proposed extensions) are agreed in principle; the described producer is served by the graph export from the manifests, while both extensions inside the runs need a new contract and run.
- Questions outside this repository: whether „RI IV,2,2 n. 103a“ or its sort key of RI IV,1,2 is right is a question to the Regesta Imperii delivery (data.md).
- The graph export writes the `rf:` and `rv:` terms under the provisional example.org namespaces until the operator decides a stable namespace; `build_graph.py --rf-namespace --rv-namespace` takes it (plan.md, Pipeline after the guest unit).
- Waiting for the operator: removing the pilot path of `build_data.py`, the move of the pilot into `pipeline/archive/` (accepted for after 20 November), moving the two agent-review scripts, and the local ignored folder `site-review/`.
- `build_site.py` and `checks/test_site.py` still carry their own BuildError, JSON loader, CSV reading and run id; they are to move onto `edition_io.py`.

## 2026-11-17 Dry run of the four demonstration prompt chains

- Trigger: the operator's order to play the demo prompts of the guest unit through before 20 November.
- Found: an agent ran the four chains in a fresh clone outside this repository; all ran, and the new run of n. 3166a passed the technical check. Two independent review agents agreed on the missing parenthood („dessen Sohn“), on Grantor as an ill-fitting role for the sender of an embassy, and on the summons of Folmar having no act type; only the parenthood was corrected, the rest are model questions. One reviewer miscopied a register ID. `run.py validate` ended with exit 1 on a new run because the revised stage did not exist yet; `prepare_pilot.py` writes its pilot default as the LLM into the manifest unless `--model` is given; the house rule for interfaces stops an agent after its plan unless the prompt releases it.
- Changed: `run.py validate` checks only the stages a run has and returns the result of the last one. The prompts on the slides name the contract, `run.py prepare`, a folder `demo/` and the released plan.
- Open: `run.py prepare` should pass the LLM explicitly; the sender of an embassy has no role in the vocabulary (Open questions for experts in factoid-model.md name the related cases).
- Evidence: the clone and its run `demo-3166a-2026-11-20` lay in the session scratch folder and are not part of this repository.

## 2026-11-17 Operator's decisions on interface, pilot guideline and pilot path

- Trigger: the operator's yes to four questions put to him after the audits.
- Decided: the interface is rebuilt after [Interface plan](interface-plan.md), including the removal of the view Raum and the head line in place of the metadata column of the regest page, both of which change earlier verdicts of his; the Atlas slice comes first and is shown to him. The pilot path of build_data.py goes with the pilot archive after 20 November.
- Changed: knowledge/annotation-guidelines.md deleted on his word. It was the pilot guideline, identical in content to pipeline/knowledge/annotation-guidelines.md, which the pilot manifest hashes; INDEX.md, domain-ontology.md and AGENTS.md point there. interface-plan.md added.
- Evidence: a diff of the two guideline bodies was empty before the deletion.

## 2026-11-17 Dating prose in the holdings data

- Trigger: the card head showed the ISO date for delivery regesta, because holdings.json had no dating prose (open point of the interface clean-up).
- Changed: build_holdings.py writes `d`, the delivery's date_string as plain text, per regest; regest-card.js already reads it. design.md no longer names the removed tokens `--pen` and `--machine`.
- Evidence: every regest of the rebuilt holdings.json has `d`; `uv run run.py check` passes.

## 2026-11-17 Frontend clean-up, phase 1: defects and refactoring without visual change

- Trigger: an audit of the frontend, carried out on the Research Coordination's commission; phase 1 fixes defects and refactors without touching design, navigation or the filter model, which stay with the operator.
- Found: the regest tooltip of the cube stood as an empty box while hidden (`.it-tip { display: grid }` beat the hidden attribute); the start page dropped the place of `#/itinerar/<place>` on reload; the tooltip stayed over an opened regest; the status line wrote about 70 words over the figure; the cube stood 16 px below the window at 1440 × 900 and 1920 × 1080 (the margin of `.figure`); delivery regesta showed the ISO date in the card head; the shared-person lines took the clerical estate colour; `checks/test_site.py` built the run `factoid-2026-11-11` and skipped when it was missing; `build_site.py` read the register in Python's default CSV dialect.
- Changed: one rule `[hidden] { display: none !important }` in the reset layer of css/shell.css replaces the local patches; start.js reads the place from the address; the itinerary hides the tooltip on opening a regest, says count and kind of the relations in one sentence, sizes the cube from the rounded-down box and fits the window; the card head prefers the delivery's dating prose (field `d` of holdings.json) over the machine date; `.it-link` takes `--muted`; the test builds `factoid-1153-2026-11-11`, fails on a missing run and asserts the global hidden rule; both CSV readers of build_site.py use `escapechar="\\", strict=True`. Refactoring: css/pages.css in a new last layer `pages`, its `--pg-*` aliases replaced by the tokens, `.mark` renamed `.row-mark`, the shared base (box sizing, body, `.source`, `.visually-hidden`) moved to css/shell.css; dead rules of the retired reading view, holdings view and timeline deleted from app.css, shell.css, views.css and pages.css, and the old role tokens `--paper*`, `--machine*`, `--pen*` and `--measure` replaced by their targets and deleted; new modules js/svg.js (`s`, `yearOf`), js/map.js (projection of the places), js/url.js (address parameters, copied to `js/` of the build for the static pages); one `linkStatements` for card and page in js/regest-card.js; `mountView` and `actorOf` removed from js/edition/views.js; build_site.py without the dead `tei_excerpt`, `_case`, `SITE_OUT`, the shell-interim fallback and unused parameters, and with the regest metadata as a JSON island `#regest-meta` that js/edition/regest.js reads instead of the DOM; js/app.js with a route table and the view contract.
- Decided: the layer `pages` comes after `components`, so the cascade keeps the order the unlayered file had; no shared camera module for itinerary and space (pending decision).
- Evidence: computed styles and boxes of every element of twelve pages at 1440 × 900 and 375 × 812 identical before and after the refactoring except the class name `row-mark`, one inert grid property of `.fam-toggles` and the JSON island; the same interactions (routes, filters, view settings, list filter, regest highlighting, metadata and comment areas of 25 regest pages, map coordinates) give the same results on the old and the new build; the defect probe shows the tooltip hidden at rest and after opening, the status line at 17 words, the cube ending at 900 and 1080 px, the place restored on reload, `.it-link` in rgb(77, 71, 65). The register dialect changes no built page, since no actor of the run uses the shifted rows. Screenshots and measurements lie in the session scratchpad.
- Open: holdings.json carries no dating prose yet, so delivery regesta still show the ISO date until `build_holdings.py` writes `"d": date_string`; moving the pointer after opening a regest shows the tooltip again over the panel; the Raum corpus mode projection (audit item 4) is untouched; design.md still says the old role names `--pen` and `--machine` point to the accent text, which is no longer true, since they are gone.

## 2026-11-17 Shared CSV reader, locked gate, validator guard and graph export

- Trigger: a read-only audit of the root scripts, carried out on the Research Coordination's commission.
- Found: `build_holdings.py` and `check_itinerary.py` read the register with Python's default CSV dialect, so the 49 rows of RI004-002-K000373 and RI004-002-P000183 shifted and Paschal III. was missing from the person layer. `uv run run.py validate --run factoid-2026-11-11` would have rewritten that run's reports with a newer validator. Five root scripts carried the shown run id and duplicated helpers. The record nodes of the run carry an RI label in only some files, and the reference and selector nodes are blank nodes a later judgement cannot address.
- Decided: one module `edition_io.py` holds the CSV reader in the pipeline's dialect for both delivery files, BuildError, the JSON loader, the hash and the markup helpers and `SHOWN_RUN`; the root scripts became a script pipeline with `pyproject.toml` and `uv.lock` (rdflib 7.6.0, pyshacl 0.40.1, lxml 6.1.3, numpy 2.4.6, shapely 2.2.0, pytest 9.2.0, ruff 0.17.5), and `run.py check` runs pytest and ruff from the lock; checks whose run is missing fail instead of skipping; `run.py validate` refuses a foreign validator hash unless `--allow-validator-change`; `build_graph.py` exports the revised stage as one graph to the gitignored `data/graph/` (pipeline.md, Graph export), with VoID as description; `prepare_agent_review.py` takes its run from the review's selection, not from the shown run.
- Rejected: DCAT for the description, whose catalogue and distribution layers have no object here; minting place and period nodes from the delivered prose; inventing terms for agent attributes beside PROV and Dublin Core; touching `pipeline/*.py`, the pilot path of `build_data.py` and `build_site.py`.
- Changed: edition_io.py (new), build_graph.py (new), build_data.py, build_tei.py, build_holdings.py, check_itinerary.py, register_names.py, build_agent_review.py, prepare_agent_review.py, run.py, queries/run_queries.py, checks/test_edition_io.py and checks/test_export.py (new), the other checks except test_site.py, pyproject.toml, uv.lock, .gitignore, LICENSE, LICENSE-DATA.md, README.md, AGENTS.md; knowledge: INDEX.md, plan.md (finished narrative left for this journal), pipeline.md, testing.md, factoid-model.md, specification.md (history and the stale publication statement marked), data.md and source-data.md retitled Edition data and Source data, annotation-guidelines.md marked as pilot guideline.
- Evidence: `data/holdings.json` rebuilt, persons of the delivery 7478 to 7480, persons written 1510 to 1511 (Paschal III. with 48 regesta added), regesta, places and coordinate log unchanged; `data/itinerary-checks.json`, `data/edition.json`, `data/questions.json`, the TEI and the extracted-stage view data unchanged against the code before. `checks/test_edition_io.py` fails on the default dialect. Validating the shown run left its reports byte-identical. The export of 2026-11-17 has 19125 triples in the union, 224 records enriched with no invalid or reversed date and no missing persistent identifier, 1230 references and 827 selectors skolemised, 4022 literals tagged, 68 agents described and 246 prefLabels; the queries of `queries/` give the same row counts on it as on the stage. Under `uv run run.py check` every check passes except `checks/test_site.py::HiddenAttribute::test_global_hidden_rule`, which belongs to the interface work of a parallel session; ruff check and ruff format are clean.

## 2026-11-17 Identity across regesta and assertion extensions

- Trigger: the operator's question how the data are modelled, and his reading that a factoid is an assertion of an AI agent referred back to its source.
- Found: actor IRIs are minted from the register ID, so register actors already join across regesta in a loaded graph; pipeline.md said they were never merged, which held only for the pipeline's own behaviour.
- Decided: the operator agreed in principle to two extensions, a described producer per run and human judgements as separate assertions (factoid-model.md, Proposed extensions). Not built.
- Changed: factoid-model.md, pipeline.md.
- Evidence: a count of actor IRIs over `pipeline/runs/factoid-1153-2026-11-11/revised/*.ttl`.

## 2026-11-17 Pipeline moved into this repository

- Trigger: the operator's decision that everything lies in this one repository, and his wish that the workflow be clean enough to learn from and tested for faithful transfer (relayed by the Research Coordination).
- Decided: the pipeline of `regesta-rdf-demo` at f65887c moves as a closed folder `pipeline/` with its inner layout unchanged, so the relative paths in manifests and contracts and every hash stay valid. Its knowledge documents join `knowledge/`: architecture and pipeline specification as pipeline.md, its data document as source-data.md, the others under their names; project, plan and journal took up what was open. The former edition plan stays in the old repository as history. `run.py` is the single entry point; `pipeline/summarize_review.py` derives a review overview from the adjudications.
- Rejected: reformatting the pipeline scripts to this repository's line length, since the validator's hash is recorded in every validation report; they keep `pipeline/ruff.toml`. Merging the Git histories, which stays with the operator.
- Found: the CSV start date of n. 103a (1138-06-01) contradicts its date string (1152 Juni/Juli); the edition carries it over unchanged, as a transfer should.
- Changed: pipeline/, run.py, checks/test_pipeline.py, the `--source` defaults of the build and check scripts, AGENTS.md, knowledge/.
- Tidied: README.md and knowledge/INDEX.md added; `data/edition.json` and `data/questions.json` rebuilt from `factoid-1153-2026-11-11` as AGENTS.md prescribes (they still held the pilot run of 2026-11-11, and the working views at 8096 load them without console errors); the unreferenced screenshots of the first slice in `review/` removed.
- Evidence: the validation reports of both stages and the outputs of `build_data.py` and `build_tei.py` at the new place are byte-identical with those built from f65887c; every copied file matches its Git blob; `checks/` passes, and each of the four transfer checks fails on its mutations.

## 2026-11-15 Promptotyping pass: distill, curate, refactor

- Trigger: the operator's order, relayed by the Research Coordination, to run distill, curate, refactor and handoff in every project.
- Distilled: the operator's verdicts on regest page, start page and place view as five requirements with acceptance criteria in specification.md (proposals); the annotation system and the regest page as rules in design.md; the agent review's cases as model questions in regesta-rdf-demo.
- Corrected: specification.md named a timeline, paper and red pen that no longer exist and a browser check that asserted the first slice, now marked as history; the method text named a human check of a selection in the public build, now the agentic check in both builds; ui-feedback.md statuses of the three verdicts; plan.md and AGENTS.md on the retired check.
- Refactored: 115 one-line CSS rules whose classes no code, page or build writes any more (earlier views: the first slice's panels, legends, timeline and case marks) removed; `checks/ui_check.py` removed; the method step without a build branch; `js/dom.js` appends nested children, which the page view needs.
- Evidence: screenshots of eleven views at 1280 × 800 and 360 × 740 after the removal, no page error; pytest 11 passed, ruff and node clean; a fresh reader on n. 103a, n. †193 and the cube with n. 135.
- Not done: grounding against outside sources; a review of the knowledge documents by a fresh context.

## 2026-11-14 Regest page, estate colours, persons in the cube as start page

- Trigger: the operator's feedback on the preview („Mehr … schlecht“, unused width, text-heavy notes, the „Nächstes“ line, the title, symbolic metadata, header and footer, black network, persons in the space-time cube) and his go-ahead for the whole plan („Ja, setze das mal alles um.“).
- Decided: regest card with one head line of signs and paging arrows, notes reduced to number, kind, qualifier and sign with participants on pointing, no „Mehr“, apparatus below the text, full width; title „Barbarossa-Regesten“ with the tag „Experiment“, one-line footer; colour by estate from a rule on the register description; persons of the register as traces in the itinerary cube, two at once; the cube with its sidebar as start page, the opened regest below it.
- Rejected: dissolving the person network into the cube, since relations with roles exist only for the run's regesta; colour by first year of mention, which says less historically.
- Changed: js/regest-card.js, js/edition/regest.js, js/edition/start.js, js/itinerary.js, js/stand.js (new), js/shape-key.js, js/overview.js, js/person-overview.js, js/space.js, js/sidebar.js, js/app.js, index.html, build_site.py, edition/texts.json, css; js/start-overview.js removed; design.md, data.md (Estate), ui-feedback.md.
- Evidence: screenshots of n. 116 and n. 103a, the network, the itinerary with Heinrich der Löwe and Rainald von Dassel (210 and 249 regesta with a place in the cube, 45 naming both; Rainald's trace ends in 1167) and the start page at 1280 and 360 px; the estate rule over the run's 504 persons and groups gives 178 geistlich, 113 weltlich, 35 Herrscher, 178 ohne Angabe; density check `--profile work` ok for start, network and itinerary at both widths, regest pages over by source text only; pytest 11 passed, ruff and node clean.

## 2026-11-14 Agent review of the twenty regesta, review list removed

- Trigger: the operator's instruction, relayed by the Research Coordination: „beauftrage einen ai operator der das evaluieren alles umsetzen soll. http://127.0.0.1:8102/pruefung/ --> muss dann entfernt werden weil wir das dann nicht mehr brauchen!“ He gives up the own check of 2026-11-12.
- Found: the first round of readers had an input built from the edition JSON, whose literal lines carry no Turtle, so every qualifier, exception and ground was missing; their „stimmt nicht“ on „Witwe“, „Oheim“, the Como reservation and the Treviglio exception were artefacts of that. Seen on the preview of n. 103a, which shows „Ehe (Witwe)“ while both readers missed the qualifier. Kept in `round1-incomplete-input/`, not used.
- Found, second round on the complete Turtle: of 46 statements 33 stimmt, 8 unklar, 5 strittig, none stimmt nicht by both; the two readers agree on 41 (Cohen's kappa 0.71). By family: Verwandtschaft und Ehe 10 stimmt; Übertragung und Besitz 1 stimmt, 6 unklar, 2 strittig; Bestätigung und Zusicherung 5 stimmt, 1 unklar, 1 strittig; Streit und Urteil 5 stimmt, 1 unklar; Schutz 4 stimmt, 2 strittig; Amt und Bestimmung 4, Bitte, Gesandtschaft, Verhandlung 3, Zahlung und Pflicht 1, all stimmt. RI IV,2,2 n. 103a: all four stimmt.
- Found, the cases that matter: n. †193 four grants and assurances under rf:partOf of the confirmation, while the text sets „gewährt ihm“ beside „bestätigt“ (both unklar), and the Lucius privilege as Grant (strittig); n. 145 the precedents of Heinrich IV. and Lothar III. as Grant, where „nach dem Vorgang“ leaves grant or confirmation open (both unklar); n. 96 an exchange as Grant, the vocabulary having no exchange (unklar); n. 116 three predecessors as one act with three issuers (unklar and stimmt nicht) and „fratres“ as a recipient of its own (strittig twice); n. 186 the scope of „nämlich“ in Ludwig's grant (strittig); n. 191 a complaint without a court or ruler before whom it is made (unklar).
- Decided: two fresh readers per statement on the run's frozen guidelines, regest text and the statement only; disagreement kept as „strittig“, never settled here; the result is agentic review with producer, model and date, shown only in the local preview as „Agenten: …“ and „von LLM-Agenten gelesen“; `rf:verificationStatus` stays `rv:unchecked`. The review list, the verdict form, the review mode of the build, the review sheet and its script are removed; the choice of the twenty stays as data.
- Rejected: mapping the agents' verdicts to the former „menschlich geprüft“ path; settling contested cases by a third agent.
- Changed: prepare_agent_review.py, build_agent_review.py (new), edition/agent-review-2026-11-14.json and its folder (new), build_site.py (`--preview` instead of `--review`), publish_site.py, js/regest-card.js, js/edition/regest.js, js/edition/page.js, css; js/edition/review.js, build_review_sheet.py and pruefbogen/data/sheet.json removed; AGENTS.md, data.md, design.md, plan.md.
- Evidence: the merge checks every quoted passage verbatim against the regest text; a fresh reader, given only the rendered pages of n. 103a and n. 116 in the preview, named the status as agents' verdicts, no person, model and readers, and read the contested case of n. 116 correctly; it found „unabhängig gelesen“ and „Begründung der Agenten“ open to a human reading, so both now say LLM-Agenten. pytest 11 passed, ruff clean.

## 2026-11-14 Key of the signs in network and space

- Trigger: the reviewer's open finding that neither the circle around a person nor the space view explains its node shapes; the operator asked for the key.
- Found: the space view drew acts as squares, the network as diamonds, and the persons overview drew groups as circles, so one key could not hold for all three.
- Decided: acts are diamonds and groups squares in every drawing; one line at the lower right lists only the signs the drawing contains; the drawing leaves the key's height free.
- Rejected: the key in the sidebar, since at 800 px height it falls below the family rows and out of sight.
- Changed: js/shape-key.js (new), js/overview.js, js/space.js, js/person-overview.js, css/shell.css, design.md.
- Evidence: screenshots of the overview, the circle and the space view around Heinrich der Löwe at 1280 and 375 px; density check `--profile work` ok for all three at both widths; pytest 11 passed.

## 2026-11-14 Notes beside the regest, a persons overview, one page about the edition

After the operator's look at the published frontend (verbatim in ui-feedback.md) the annotated regest became text with notes in the margin, the whole network a persons overview without the centre person, the start page lost its duplicate place list, and method, data and about became one page. Changes in design.md, Revision after the operator's look.

- Checks run: density check (work profile) for start, regest list, person index, network and regest page at 1280 × 800 and 360 × 740, within limits except the regest page at 360 px (116 words against 110, the regest text itself) and the merged page in the page profile (as the former pages); sixteen tasks by pointer and keyboard; pytest, ruff, `node --check`; published through `publish_site.py`.

## 2026-11-14 The frontend by objects, published

The operator asked for the whole frontend improved („erzeuge das gesamte verbesserte frontend“, verbatim in ui-feedback.md) and, after the build, to publish it. Navigation by objects with switches between representations, the start page as linked overview of time, places and persons with the annotated n. 103a, list filters with family signs and verdicts as sign and word are built (design.md, Frontend by objects) and published as gh-pages `3f9ba34` from source `f937d6e`, together with the qualifier display waiting since 2026-11-12.

- Checks run: density check of `pruefansicht` in the work profile for eight views at 1280 × 800 and 360 × 740; sixteen tasks by pointer and keyboard, locally and at the public address, console clean; data assertion of the start map (every regest with a place once); ruff, pytest, `node --check`; an independent read-only reviewer, whose material findings were fixed; the public build without review markers or knowledge, `knowledge/` and `pruefung/` answering 404.
- Open: the findings named under Frontend by objects in design.md; test tasks with computed answers (plan.md). Not seen by the operator on screen yet.

## 2026-11-12 Qualifiers and literals shown at their statements

The Research Coordination's reading of RI IV,2,2 n. 103a found the marriage of Eufemia reading as a lasting marriage. The run carries the qualifier „Witwe“ (`rf:qualifier`), but the annotated card showed none of the 323 qualifiers and 121 other literals (conditions, grounds, amounts, exceptions) of the slice. Short qualifiers now stand at the tag („Ehe 3 (Witwe)“, at most 24 characters together), the other literals as glosses under their passage („Bedingung 2“). The other three findings are patterns of the model, not of single regesta, and stand as open questions in `regesta-rdf-demo/knowledge/factoid-model.md`.

- Checks run: all 224 regest pages at 1280 × 800 and 360 × 740, no overflow, three glosses touching another (n. 156, n. 183); six text styles; smoke walk; local review build rebuilt. Not published: the change waits for the coordination's word, as asked.

## 2026-11-12 Statements annotated in the regest, review on the product

After the operator's rule that he never wants a review form as a page and his direction that the statements be marked in the edition itself (verbatim in [ui-feedback.md](ui-feedback.md)), the regest card shows each statement as a bracketed passage with kind and number, the participants' roles as glosses under their names, nested and crossing statements as nested or crossing brackets; the list under the text is gone. The plan stands in [design.md](design.md#annotated-regest-plan-of-2026-11-12). The separate review page `pruefbogen/` is removed; `build_site.py --review` builds `site-review/` with the verdict form under the cards of the twenty regesta and a Prüfliste, `publish_site.py` refuses such a build, and the result file goes into the public data as „menschlich geprüft“ per statement ([data.md](data.md#review-sheet)).

- Checks run: all 224 regest pages at 1280 × 800 and 360 × 740 without a gloss on a word and without horizontal overflow, one gloss touching another in n. 183 at 360 px; the regest page with six text styles; the card in the detail panel of the network; judging, saving, loading back and the Prüfliste in the review build; the public rendering of verdicts with injected data, notes absent from the data; `publish_site.py` refusing the review build; smoke walk, pytest, ruff, `node --check`; published through `publish_site.py`.
- Open: the operator's verdicts. Draft, not accepted.

## 2026-11-12 One naming rule, a time band without false presence, decades with new places

After the operator's question on the decade maps and the time band (verbatim in [ui-feedback.md](ui-feedback.md)). The duplicates in the time band were no unmerged persons: the old short-name rule of `build_holdings.py` gave different register entries the same name, among them seven persons as „Heinrich II.“ and Friedrich's envoys, children and ministerials as „Fredericus I. Barbarossa“. `register_names.py` now names every register person once for all views ([data.md](data.md#person-names)). The person list of the network puts actors known only by the regest's wording in a group of their own, each with its regest. Time band and decade maps changed as recorded in [design.md](design.md#zeitband-and-jahrzehnte).

- Checks run: no duplicate name among the persons of the time band except the two pairs the register describes identically; the density check of `pruefansicht/tools/check_ui_density.cjs` in the work profile passes for time band, decade maps, itinerary, space view and network at 1280 × 800 and 360 × 740 (the time band had breached the text-element limit before); no overlapping place names in the decade maps; network circle unchanged without overlap; smoke walk of all pages, pytest, ruff, `node --check`; published through `publish_site.py`.
- Not built: colour by relation family or kind of regest for the whole delivery, and certainty of the place of issue, because the delivery does not carry them.

## 2026-11-12 Colour settled and the review sheet for twenty regesta

The operator left the colour to the implementing agent and confirmed title and definition „Agentic Edition“. W1 became the one palette with computed contrasts, hue and colour-vision distances; the switch `?farbe=` and the raw colour fallbacks in `css/pages.css` are gone (reasons in [design.md](design.md#colour)). For his own check of twenty regesta, `build_review_sheet.py` makes a stratified, reproducible choice and the local page `pruefbogen/` takes a verdict and a note per statement and saves them as a file ([data.md](data.md#review-sheet)).

- Checks run: contrasts of every token pair (text at least 7.1:1, graphics at least 3.5:1), OKLCH hue of the greys 68 to 85, OKLab distance of the evidenced ochre to grey and accent under simulated protanopia, deuteranopia and tritanopia at least 0.16; smoke walk of all pages and views, pytest, ruff, `node --check`; published as a further commit on gh-pages. Review sheet: judging, saving through the download path, loading the file in a fresh browser, keeping the draft over a reload, the abstention item, no console error; density check of `pruefansicht/tools/check_ui_density.cjs` in the work profile passes at 1280 × 800 and breaches the word limit at 360 × 740 (135 against 110), where the regest text of the first regest alone holds 87 words.
- Open: the operator's verdicts. Draft, not accepted.

## 2026-11-12 Overview first in the circle around a dense person

After the operator's feedback on the circle around Friedrich (verbatim in [ui-feedback.md](ui-feedback.md)): the ego layout used separate radii for width and height, so the octagon followed the window's shape; it now has one radius. Sectors with more than twelve relations around the centre stand as bundles with their count of regesta and their three most connected people, and open on click, Enter, Space, a single family filter or a narrow time window (`bundleSectors` in `js/overview.js`). The case nodes had lost the agents' form in the previous step because the register naming ran before the case was attached; the order is corrected. Label widths are now measured in the label font.

- Checks run: label overlap count, node count, bundles, rim signs inside the frame and the circle's aspect at 1280 × 800 and 2000 × 900 for Friedrich (overview, one sector open, single family, time window 1153 and 1152–1153), Adela and the whole network, every case without overlap; structure at most four text styles and nesting 2; keyboard opening by Enter and Space; the smoke walk of all pages and views, pytest, ruff, `node --check`; published as `9b4337e` and the same measurement repeated at the public address.
- Open: colour, review sheet (in [plan.md](plan.md)). Draft, not accepted.

## 2026-11-12 Publication on GitHub Pages, borders, signs and name forms

The Research Coordination gave the repository a private remote and served the first build from a branch `gh-pages`; the operator confirmed the views as direction. `publish_site.py` now makes every further build one fast-forward commit on that branch, built with a temporary git index so the working tree never switches branch, after a check for internal material. The literal „null“ that the delivery writes for a missing locality reached the head of regesta without a run place (n. 72) through the whole-delivery layer; `build_holdings.py` drops it and strips markup at the root. Actor nodes with a register entry carry a nominative name from the register instead of the inflected source form, except the two nodes of the same-name case. Each relation family has a stroke sign that replaces the direction words in the figures. The Empire about 1190 lies on the itinerary floor as a soft area, a rough hand trace of Shepherd's map (1926 edition, public domain stated by the Perry-Castañeda Library and checked there) georeferenced over fifteen town control points (largest residual 0.27 degrees); contracts in [data.md](data.md#empire-about-1190).

- Checks run: all 224 regest pages rendered without „null“ in the card head; structure measured on every changed view at 1280 × 800 and 360 × 740 (at most six text styles, nesting at most 2, no console error, no overflow); pytest (11 passed), ruff, `node --check`; `publish_site.py --dry-run` against the published state (only `.edition-build` differed), then the publication `702c7a2`; at the public address n. 72, the itinerary with the realm, the whole network with nominative names and the circle with eight rim signs read in Chrome, `knowledge/` and `.edition-build` answer 404.
- Open: palette choice, public visibility of the repository, name forms of groups and local actors; next steps in [plan.md](plan.md). Draft, not accepted.

## 2026-11-11 Shell, whole delivery and the first curated build of the 1153 run

The day's feedback (verbatim with status in [ui-feedback.md](ui-feedback.md)) turned the views into one shell after Shneiderman's mantra: filters on the left with the family list as switch, the drawing in the middle, the shared regest card as a detail on the right only while something is selected, and the same card at page size on the static regest pages. `build_holdings.py` adds the whole delivery deterministically; the itinerary cube draws it over a Natural Earth base map, `check_itinerary.py` flags implausible jumps under a stated threshold (assumption and unread literature in [design.md](design.md#itinerar-the-whole-delivery)), and Zeitband and Jahrzehnte are two further projections. The data and TEI builds now read the factoid run `factoid-1153-2026-11-11`: per-group review, adjudication and correction files, reject decisions, empty summaries and forgery numbers with a dagger, which the addresses write as "f". Child builds run in UTF-8 mode, because their German output broke the decoding under Windows. In the whole network of that run no standing name found a free place; the hubs now sit on plates drawn above the dense core.

- Checks run: `build_site.py` on the 1153 run with all TEI files valid against tei_all 4.12.0, pytest (11 passed), ruff lint, `node --check`, and every page type and view of the build on port 8100 in headless Chromium at 1280 × 800 and 360 × 740 (status 200, no console error, no horizontal overflow, at most six text styles). The whole network draws in about 0.2 s; an earlier reading of 20 s came from the hidden browser pane, which throttles background pages.
- Local servers left running: 8100 (`site/`), 8096 (repository root), 8097 (`regesta-rdf-demo/overview`); start commands in AGENTS.md. Scratch copies on 8098, 8099 and 8101 were stopped.
- Open: next steps in [plan.md](plan.md). Draft, not accepted.

## 2026-11-11 TEI per regest and the static edition site

After the operator released the edition plan (`regesta-rdf-demo/knowledge/edition-plan.md`), a subagent built the curated site of the public edition beside the views app. `build_tei.py` writes one TEI file per regest by rule, `build_site.py` builds start, regest list and pages, persons, method, data and about pages as static HTML over the prebuilt JSON, copies the views app into `ansicht/` and embeds its itinerary on the start page; person pages link into the network view. The structure of every page was measured in the first screen after the operator's rule of the same day (at most two heading levels, at most six text styles, no box inside a box in the page's own content); the measured subtractive pass removed the visible start-page title that repeated the header, the producer boxes of the method page and the embedded circle of the person pages. Title, subtitle, provisional definition, licence line and attribution live in `edition/texts.json`. Contracts in [data.md](data.md#tei-per-regest) and [data.md](data.md#static-site).

- Checks run: all TEI files of `factoid-2026-11-11` valid against tei_all 4.12.0 (`checks/test_tei.py`), the site contract (`checks/test_site.py`), ruff lint and format, `node --check`, and the build served on port 8100 and read in Chromium at 1280 × 800 and 360 × 740 with pointer, keyboard and without JavaScript. Light only, after the operator's design decision of the same day.
- Open: the export date of the regest file, the model of the adjudicating and correcting agent (not recorded in the run), the error logs per step on the method page, the imprint, and the operator's screen review.

## 2026-11-11 Flicker, compact family list and direction words

After the operator's third feedback (verbatim in design.md). Reproduced in Chromium by sweeping the pointer across the circle around Friedrich: at 1280 px the network switched between dimmed and full 38 times, 22 of them within 300 ms of the previous switch, and the panel was rebuilt 40 times. After the fix (dwell and grace on pointing, panel rebuilt only on selection) the same sweep gives 2 rapid switches and no panel rebuild. Otto von Moos shared a spot with Herbord von Hebingen because the five people of the judgment in n. 103a ran past the outer limit of their bearing; long rows now shrink their step. The panel lists eight family rows instead of the relation lines, and the rim names the directions with one short word each. Label measurement unchanged: no label on a label or a node, one act label touching an edge around Friedrich at 1280. Checked light and dark at 1280 and 800, unit tests green. Draft, not accepted.

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
