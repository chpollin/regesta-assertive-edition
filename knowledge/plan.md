---
title: Plan
status: draft
language: en
created: 2026-11-11
updated: 2026-11-12
---

# Plan

Accepted next steps of the edition. Operator decisions behind them are tracked in the vault's ACTIVE-WORK anchors named per step; this document records only what the repository has to do. Steps finished on 2026-11-12 (borders, signs, name forms, publication) are recorded in the journal and in [design.md](design.md) and [data.md](data.md).

## Colour choice

Two warmer palettes are built and reachable with `?farbe=w1` and `?farbe=w2`; the recommendation is W1, the current light palette stays the default until the operator decides. After the decision, the chosen palette moves into the tokens of `css/tokens.css` and the switch is removed. Anchor: op-thm-edition-farbe.

## Edition title

Title and subtitle in `edition/texts.json` are provisional. Anchor: op-thm-edition-titel.

## Review of the regesta

The 224 regesta of `factoid-1153-2026-11-11` are technically checked (agent reviews, adjudication, correction, SHACL) and not accepted. The site says so per regest. Scholarly review by the accountable expert is the next step and decides what the edition may state as accepted. Anchor: op-thm-regesten-pruefung.

## Public visibility

The build is served by GitHub Pages from the private repository since 2026-11-12. Making the repository itself public, a tag or a release stay with the operator. Anchor: op-thm-edition-oeffentlich.

## Smaller open points

- Name forms of regest-local actors. Actors without a register entry (groups such as "des Vogtes", "seinen Leuten") keep the inflected form of their regest; a normalisation rule for German inflection would guess and is not built. Friedrich I. and his father keep the agents' form, because the register leaves the head name of the Friedrich entries empty.
- The borders after Shepherd show the Empire only. Kingdoms beside it (France, Hungary, Sicily) are not drawn.
- `checks/ui_check.py` asserts the layout of the first slice. It is to be rewritten for the shell or retired.
- The validator note of `regesta-rdf-demo` (status after correction is read from the corrections log since 2026-11-11) is to be mentioned on the method page once the page lists the error logs per step.
- Export date of the regest file, model of the adjudicating and correcting agent, imprint.
- Deletion candidates in the knowledge folder and the views are collected under op-thm-loeschkandidaten.
