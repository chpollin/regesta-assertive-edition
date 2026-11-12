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

## Review sheet for twenty regesta

Decided on 2026-11-12: the operator checks twenty regesta against their statements himself. A usable local page shows per regest the text with marked evidence and per statement a judgement (stimmt, stimmt nicht, unklar) and a free field, and saves the result as a file the agent can read back. The twenty are chosen with reasons, stratified by statement type and review state, the Adela case among them. The page is a work tool, served locally under its own address and never published; structure measured in the work profile. Anchor: op-thm-regesten-pruefung.

## Review of the regesta

The 224 regesta of `factoid-1153-2026-11-11` are technically checked (agent reviews, adjudication, correction, SHACL) and not accepted. The site says so per regest. The review sheet above is the first step of the scholarly review.

## Public visibility

The build is served by GitHub Pages from the private repository since 2026-11-12; ACTIVE-WORK and slide 4 of the deck link the address, so every change to the views is published again. Making the repository itself public, a tag or a release stay with the operator. Anchor: op-thm-edition-oeffentlich.

## Smaller open points

- Name forms of regest-local actors. Actors without a register entry (groups such as "des Vogtes", "seinen Leuten") keep the inflected form of their regest; a normalisation rule for German inflection would guess and is not built. Friedrich I. and his father keep the agents' form, because the register leaves the head name of the Friedrich entries empty.
- The borders after Shepherd show the Empire only. Kingdoms beside it (France, Hungary, Sicily) are not drawn.
- `checks/ui_check.py` asserts the layout of the first slice. It is to be rewritten for the shell or retired.
- The validator note of `regesta-rdf-demo` (status after correction is read from the corrections log since 2026-11-11) is to be mentioned on the method page once the page lists the error logs per step.
- Export date of the regest file, model of the adjudicating and correcting agent, imprint.
- Deletion candidates in the knowledge folder and the views are collected under op-thm-loeschkandidaten.
