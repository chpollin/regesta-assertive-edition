---
title: Review of 2026-11-18 with Claude Fable 5.2
status: snapshot
language: en
created: 2026-11-18
updated: 2026-11-18
---

# Review of 2026-11-18 with Claude Fable 5.2

A whole-project review, commissioned by the operator through the coordinating session ([prompt log](prompt-log.md), P38) and carried out by one session running Claude Fable 5.2 (`claude-fable-5-2`). Two read-only subagents on Claude Opus 5.5 read the knowledge base against the code and the code for correctness bugs, and a third counter-read the corrections. Every finding of a subagent that led to a change was checked against the code or the data before the change. The review is verification by executable checks and agentic review. It validates no statement of the edition, and no historian took part.

The document is a snapshot of that day and carries its figures. The reviewed state was commit 7f8a4b7, published as gh-pages ee39317.

## Scope

1. Data and pipeline: the delivery against `generated/regesta.jsonl`, the whole-delivery layer, the itinerary check, view data, TEI and the validators.
2. Interface: every kind of page of the built site, rendered in German and English at 1280 × 800 and 360 × 740.
3. Content: statements on the site and in `knowledge/` against code and data.
4. Publication: the built output against the rule that only curated content is served.

## What was checked and held

- `uv run run.py check`: all tests pass, `ruff check` and `ruff format --check` are clean, before the corrections (37 tests) and after them (43 tests).
- `uv run run.py validate`: the extracted stage fails on one record (22702) as recorded, the revised stage passes, the self-tests report no failure and the frozen reports stay byte-identical. `build_holdings.py --check`, `check_itinerary.py --check` and `run.py graph` pass.
- A rebuild of the site from commit 7f8a4b7 was byte-identical with the build of the day before and, by `publish_site.py --dry-run`, with the published state. The build is deterministic and the public site was the build of that commit.
- The regest CSV and `generated/regesta.jsonl` agree in identifier, dates, dating prose, place string, persistent identifier and plain summary for all 3582 regesta. The figures of the start page (3582 regesta, 1837 with a place of issue, 183 with statements, 1511 persons in at least three regesta) match the data.
- The view the operator named, the Atlas with RI IV,2,4 n. 3270 opened: number, dating, place, text and RI link equal the delivery. Its two flagged steps are computed as described under Open questions.
- Static check of all 1469 pages: no dead internal link, no dead fragment, every page with `lang`, title and one `h1` (the views app sets its heading by script), no image without `alt`, no file of internal material.
- Rendered check of 31 addresses at both widths: no console error, no failed request, no horizontal overflow, no control without an accessible name, no unlabelled input, no duplicate id, in German and English. Text contrast meets 4.5 to 1 on the eight pages measured, the skip link comes first and the tab order follows the page.
- i18n: no key used in code is missing in either dictionary, and no German interface text stands unmarked on English pages (subagent, by script).
- Escaping: delivery and run text reaches the pages through the escaping helpers, and the views use no `innerHTML` (subagent, by reading).

## Errors found and corrected

Code and data, commit 3725a5b:

1. The cube ordered same-day regesta by a rule of its own (`js/selection.js`), the itinerary check by another. By the reading subagent's recount on the data, eighty positions of the line differed, eight flags named steps the cube did not draw, and ten drawn steps over the threshold carried no flag. One key (`regest_order` in `edition_io.py`) now orders the layer and the check, and the view sorts by date only. The check now flags 230 pairs instead of 231.
2. Ten regesta at Saint-Jean-de-Losne were shown at a place called „Johannes“, because the register files the town under the name variants of the saint and the label rule took the first variant. Three flags said „Cremam“ where the Atlas says Crema, because only one of the two scripts knew that correction. Both corrections now lie in `edition_io.py` and both scripts use them.
3. The jump by RI number answered „nicht gefunden“ for the 1667 regesta of the delivery that have no place of issue and lie outside the run. They now open in the list of Regesten. „RI IV,2,1 n. 103a“ opened RI IV,2,2 n. 103a, because only the number was compared; a typed volume now decides, and a volume without that number is not found.
4. A regest opened from its address (a shared link, a reload, the jump from another page) showed no flagged steps when the itinerary check arrived after the card was drawn. The first regest now opens after the check is read.
5. The time band drew the bar of the last year, 1190, outside its drawing, so that year was never visible. The bars now end at the right edge.
6. A reversed year range in the address (`?von=1180&bis=1160`) gave an empty list. It is now read as the range it spans.
7. The name filter of the person index travelled into the Regesten list as a full-text search when a reader followed the header. A page with a list filter no longer hands its name and kind filter on.
8. RI IV,2,1 n. 107 has no regest text in the delivery, like nine regesta outside the run. Its page showed an empty space without a word. Card and page now say „Kein Regesttext geliefert.“
9. `build_holdings.py` and `check_itinerary.py` gave every register row of RI IV,2,2 n. 1520a, an identifier of two records, to the record read last, against the join rule of [Source data](source-data.md). The rows are now assigned to neither and the collision is reported in `holdings.json`. The delivery's persons fall from 7480 to 7478; no figure on a page changes.
10. The gate of `publish_site.py` would have let through the agent review, the view data of the preview build, pipeline material, a delivery CSV and a preview page with an upper-case suffix. The published build contained none of these. The gate now refuses them, also inside a zip package and as link targets in pages (`checks/test_publish.py`).
11. `data/edition.json` in the repository was older than `build_data.py` and lacked the vocabulary the English views read. It is rebuilt; regesta, delivery and graph are unchanged.
12. The attribution on the site named a file that does not exist („RI_004-002-Barbarossa.csv“) and attached the unknown export date to the register, whose file is byte-identical with the public one, where [LICENSE-DATA.md](../LICENSE-DATA.md) attaches it to the regest export. Both language versions now name `RI_004-002-RegisterBarbarossa.csv` and the regest export as the file of unknown date.
13. Every published TEI file said „Arbeitsstand, nicht veröffentlicht“ in its publication statement. It now says „Arbeitsstand“.
14. The English tooltip of the review state said the agents validated the statements technically; the validator is a script. The sentence now says the statements passed technical validation.

Two checks came with the corrections, [checks/test_holdings.py](../checks/test_holdings.py) and [checks/test_publish.py](../checks/test_publish.py), each with the real data or a clean build passing and named mutations failing ([Testing](testing.md)).

Knowledge base, commit c3fb3ba:

- [Project](project.md), [Interface plan](interface-plan.md) and [UI feedback](ui-feedback.md) still said the operator had not seen or accepted the site; they now record his acceptance of 2026-11-18.
- [Edition data](data.md) and [Pipeline](pipeline.md) named review files the shown run does not have, a function that does not exist, a site tree without `atlas/`, `en/` and `img/`, and a repository „still to be created“.
- [Factoid model](factoid-model.md) counted the ruler four times as participant in judgments; the revised stage has five (regesta 134441, 135064, 22702, 22706, 22735).
- [Design](design.md) described the header with Über, the switch „Sprünge“ and the „Mehr“ disclosure as current; [Plan](plan.md) named „Agentic Edition“ as the title; [Questions](questions.md) said its pilot queries were those of `data/questions.json`.
- AGENTS.md lacked `register_names.py`, `queries/` and the new checks in its layout and called `SHOWN_RUN` the default of every script, which `build_site.py` is not yet.
- The `## Open` list of the journal carried two settled points (publication of the method text, the question of Itinerar and Jahrzehnte) and missed the points listed below.

## Figures that changed

Compared between the secured output of commit 7f8a4b7 and the output after the corrections.

| Figure | Before | After |
|---|---|---|
| Flagged steps of the itinerary check | 231 | 230 |
| of these with the reason „Datierung ohne genauen Tag“ | 142 | 141 |
| Persons of the delivery (register entries of type person joined to a regest) | 7480 | 7478 |
| Regesta naming Friedrich I. (RI004-002-F000471) in the person layer | 341 | 340 |

Unchanged: 3582 regesta of the delivery, 224 regesta of the run with 661 statements, 183 of them with at least one statement, 1837 regesta with a place of issue at 270 places, 1836 steps of the line, 47 detours, 1511 persons in at least three regesta, 23 skipped coordinate rows and 22 regesta left without a place by them. Ten regesta that stood at „Johannes“ stand at Saint-Jean-de-Losne.

## Counter-reading

A fresh subagent on Claude Opus 5.5 read the uncommitted corrections without an account of their reasons. It confirmed the code changes on the real data and raised fourteen points. Worked in: a typed volume that does not exist opened another volume's regest; the list-filter rule dropped the year range together with the name filter; the link rule and the zip package of the publication gate; a sentence in the interface plan that extended the acceptance to every density overshoot, where the journal names only the regest text column; a stale place name in the journal's open list; the wording of four sentences in the knowledge base. Recorded as limits in [Testing](testing.md): the layer check does not run `js/selection.js`, and it compares place names by name. Left as they are: `check_itinerary.py` does not report the ambiguous identifier itself, and on the Atlas page the jump sends a regest without a place to the list, although the Atlas lists such regesta too.

## Open questions

These are judgements, decisions of direction or matters outside the repository. None was decided in the review.

1. Imprint. The public start page shows the imprint as a placeholder that promises an entry before publication. The site is public.
2. Version. Every page and every citation says version 0.1 of 2026-11-11, while the edition changes with each publication.
3. Repository link. The site says the source code is on GitHub and links a private repository.
4. Copyright holder. LICENSE-DATA.md names Christopher Pollin, the site names Digital Humanities Craft as maker.
5. Imprecise datings in the itinerary. A regest dated to a span, a month or a year stands at its delivered start date. RI IV,2,4 n. 3270, dated „1189 (vor August 6, vielleicht Mitte Mai)“ at Wien, therefore stands on 1 January 1189 between Nürnberg (30 December 1188) and Adrianopel, 411 and 1080 km away, although the editors place it in May by its number and persistent identifier. The view flags both steps with the reason „Datierung ohne genauen Tag“, and the line still runs through Wien in January. 141 of the 230 flags have this reason. Whether such regesta leave the line, follow the edition's order or stay as they are is a question of method.
6. Flag sentence. „411 km in 2 Tagen zu …“ reads as a journey towards the other station also where that station is the earlier one, and same-day pairs read „in 0 Tagen“.
7. Threshold of the itinerary check. 150 km and 60 km per day are a stated assumption without a read source, as the script says.
8. Specification. Requirement 3 describes the former start page, and the five proposals are not marked as adopted after the acceptance.
9. Commands. AGENTS.md runs three build scripts with plain `python`, outside the locked environment.
10. Pipeline. `run.py prepare` passes no LLM; the sender of an embassy has no role in the vocabulary.
11. Delivery, for Regesta Imperii: ten regesta without regest text (RI IV,2,1 n. 107; IV,2,2 n. 622 and n. 1094; IV,2,3 n. 2047a, n. 2058a and n. 2495a; IV,2,4 n. 2740, n. 3048, n. 3198a and n. 3294), the place string „Würzburg-1150 Juli 30, -“ of RI IV,2,1 n. 49, the book-page link of RI IV,2,1 n. 135 without a page number, and the three reversed date ranges already known.
12. Documents left as they are: the operator's feedback of 2026-11-18 on Atlas, Regesten, Zeitband and the Personen network is missing from ui-feedback.md and stands only in the journal; two journal entries link the removed section `data.md#review-sheet`; user-stories.md names the specification of `regesta-rdf-demo` as authority.
13. Smaller interface findings, not changed: the regest card at `ansicht/#/regest/<uid>` has two `h1`, and an unknown address of the views app shows its message without a heading.

## What the review did not check

- Whether a statement of the run is right, and whether its evidence supports it. That is scholarly validation and has no owner ([Plan](plan.md)).
- The density check of `pruefansicht` and a fresh reader of the changed views. The corrections add one sentence to regest pages without text and change no layout.
- Screen readers, 200 percent zoom and touch operation. Accessibility was checked by script for names, labels, landmarks, contrast and tab order only.
- External links. The targets at Regesta Imperii, MGH and other hosts were listed and not fetched.
- Parts of the code the reading subagent named as unread: the statement composition, the questions and the layout in `build_data.py`, most of `build_tei.py` and `build_graph.py`, and the drawing code of `js/overview.js`, `js/person-overview.js` and `js/itinerary.js` beyond order, flags and neighbours.
- `ide-criteria.md`, `prompt-log.md`, `space-view.md`, `domain-ontology.md` and `user-stories.md` beyond their heads, and the colour tokens against the table in design.md.
- The slides of the guest unit.
