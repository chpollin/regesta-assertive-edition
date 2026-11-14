---
title: Plan
status: draft
language: en
created: 2026-11-11
updated: 2026-11-12
---

# Plan

Accepted next steps of the edition. Operator decisions behind them are tracked in the vault's ACTIVE-WORK anchors named per step; this document records only what the repository has to do. Steps finished on 2026-11-12 (borders, signs, name forms, publication, the bundled circle, the colour) are recorded in the journal and in [design.md](design.md) and [data.md](data.md).

## Edition title

Title and definition „Agentic Edition“ as on the start page, confirmed by the operator on 2026-11-12. Anchor: op-thm-edition-titel.

## Review of twenty regesta on the product

Decided on 2026-11-12: the operator checks twenty regesta against their statements himself, on the edition itself. A separate review page was built and retired the same day after his rule that he never wants a review form as an HTML page. The statements stand annotated in the regest text of the public edition; the local review build adds one verdict per annotated statement under the card of each of the twenty regesta, with a Prüfliste at http://127.0.0.1:8102/pruefung/. The choice of the twenty stays (`pruefbogen/data/sheet.json`). Next: the result file `pruefbogen/data/pruefbogen-2026-11-12-ergebnis.json`, delivered by the Research Coordination, goes into the public build as „menschlich geprüft“ per statement (format in [data.md](data.md#review-sheet)). Anchor: op-thm-regesten-pruefung.

## Review of the regesta

The 224 regesta of `factoid-1153-2026-11-11` are technically checked (agent reviews, adjudication, correction, SHACL) and not accepted. The site says so per regest. The review sheet above is the first step of the scholarly review.

## Public visibility

The build is served by GitHub Pages from the private repository since 2026-11-12; ACTIVE-WORK and slide 4 of the deck link the address, so every change to the views is published again. Making the repository itself public, a tag or a release stay with the operator. Anchor: op-thm-edition-oeffentlich.

## Test tasks with computed answers

Taken up on 2026-11-14 from a working method the Research Coordination passed on at the operator's wish. Each user story of `regesta-rdf-demo/knowledge/user-stories.md` that the edition serves gets one test task whose correct answer a script computes from the data, independent of the interface; RI IV,2,2 n. 103a is a fixed task in every round (which statements, which evidence, which roles). Per round one fresh subagent receives only task and address, solves it in the browser and records path, wrong turns and answer, which is compared with the computed one; the same task set runs again after every rebuild, and each finding is assigned to the story, the design or the data. The rule check and the recount of shown numbers stay with the existing density check, figure check and independent reviewer. Limit: an agent finds dead ends and wrong numbers, not whether a view feels slow or the question is the right one.

## Smaller open points

- Name forms of regest-local actors. Actors without a register entry (groups such as "des Vogtes", "seinen Leuten") keep the inflected form of their regest; a normalisation rule for German inflection would guess and is not built. Friedrich I. and his father keep the agents' form, because the register leaves the head name of the Friedrich entries empty.
- The borders after Shepherd show the Empire only. Kingdoms beside it (France, Hungary, Sicily) are not drawn.
- `checks/ui_check.py` asserts the layout of the first slice. It is to be rewritten for the shell or retired.
- The validator note of `regesta-rdf-demo` (status after correction is read from the corrections log since 2026-11-11) is to be mentioned on the method page once the page lists the error logs per step.
- Export date of the regest file, model of the adjudicating and correcting agent, imprint.
- Deletion candidates in the knowledge folder and the views are collected under op-thm-loeschkandidaten.
