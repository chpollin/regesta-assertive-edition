---
title: Journal
status: draft
language: en
created: 2026-11-09
updated: 2026-11-14
---

# Journal

## Open

- The operator has not yet judged on screen the revision of 2026-11-14 (notes beside the regest, persons overview of the whole network, leaner start page, one page „Über die Edition“), published as gh-pages `748afea`. His next words go verbatim into ui-feedback.md.
- The agent review of the twenty regesta is shown only in the local preview (`python build_site.py --preview`, `site-preview/`). Whether it goes public is the operator's decision, to be taken from RI IV,2,2 n. 103a; the public method text still names a human check of a selection until then. The unclear and contested cases (data.md, Agent review; entry below) wait for the model questions and for experts.
- Test tasks with computed answers per user story, RI IV,2,2 n. 103a as the fixed task, are planned and not built (plan.md, Test tasks).
- The operator's feedback of 2026-11-14 on the regest page, the network colour and persons in the space-time cube (ui-feedback.md) waits for his decision on the plan given in the chat; nothing is built for it.
- The operator asks whether the start page and the place view belong together, wants the regest list better integrated and finds the whole still too text-heavy (ui-feedback.md, 2026-11-14, start page with the places). The direction is his decision; nothing is built for it yet.
- Open interface findings: the longest register names wrap in the person index; the regest page at 360 px holds 116 words against the limit of 110 through the regest text itself; „Über die Edition“ exceeds the page profile, as the former pages did; the headings under „Mehr“ are h3 after an h1.
- The key of the signs (gh-pages after this entry) is not yet seen by the operator.
- `checks/ui_check.py` still asserts the first slice and is to be rewritten for the shell or retired.
- Questions outside this repository: the model questions from n. 103a (presiding lord, losing party, witness lists, office holding) wait for the operator in `regesta-rdf-demo/knowledge/factoid-model.md`; whether „RI IV,2,2 n. 103a“ or its sort key of RI IV,1,2 is right is a question to the Regesta Imperii delivery (data.md).

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
