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

## Review of twenty regesta

Decided on 2026-11-12: the operator checks twenty regesta against their statements himself, on the edition itself. Superseded on 2026-11-14 by his instruction to have an agent evaluate them and to remove the review list („beauftrage einen ai operator der das evaluieren alles umsetzen soll … muss dann entfernt werden weil wir das dann nicht mehr brauchen“, relayed by the Research Coordination). Two independent LLM-based readers per statement evaluated the 46 statements; the result is agentic review and is shown only in the local preview (data.md, Agent review). Next: the operator decides from n. 103a whether the agents' verdicts go public, and the contested and unclear cases go to the model questions and to experts. No statement is verified by a person.

## Review of the regesta

The 224 regesta of `factoid-1153-2026-11-11` are technically checked (agent reviews, adjudication, correction, SHACL) and not accepted. The site says so per regest. The agent review of twenty regesta above is no scholarly review; that step has no owner since the operator gave up his own check.

## Public visibility

The build is served by GitHub Pages from the private repository since 2026-11-12; ACTIVE-WORK and slide 4 of the deck link the address, so every change to the views is published again. Making the repository itself public, a tag or a release stay with the operator. Anchor: op-thm-edition-oeffentlich.

## Test tasks with computed answers

Taken up on 2026-11-14 from a working method the Research Coordination passed on at the operator's wish. Each user story of `regesta-rdf-demo/knowledge/user-stories.md` that the edition serves gets one test task whose correct answer a script computes from the data, independent of the interface; RI IV,2,2 n. 103a is a fixed task in every round (which statements, which evidence, which roles). Per round one fresh subagent receives only task and address, solves it in the browser and records path, wrong turns and answer, which is compared with the computed one; the same task set runs again after every rebuild, and each finding is assigned to the story, the design or the data. The rule check and the recount of shown numbers stay with the existing density check, figure check and independent reviewer. Limit: an agent finds dead ends and wrong numbers, not whether a view feels slow or the question is the right one.

## Smaller open points

- Name forms of regest-local actors. Actors without a register entry (groups such as "des Vogtes", "seinen Leuten") keep the inflected form of their regest; a normalisation rule for German inflection would guess and is not built. Friedrich I. and his father keep the agents' form, because the register leaves the head name of the Friedrich entries empty.
- The borders after Shepherd show the Empire only. Kingdoms beside it (France, Hungary, Sicily) are not drawn.
- An executable browser check of the current shell (tasks with computed answers, see Test tasks) replaces the retired check of the first slice.
- The validator note of `regesta-rdf-demo` (status after correction is read from the corrections log since 2026-11-11) is to be mentioned on the method page once the page lists the error logs per step.
- Export date of the regest file, model of the adjudicating and correcting agent, imprint.
- Deletion candidates in the knowledge folder and the views are collected under op-thm-loeschkandidaten.
