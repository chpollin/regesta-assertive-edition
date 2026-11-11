---
title: Plan
status: draft
language: en
created: 2026-11-11
updated: 2026-11-11
---

# Plan

Accepted next steps after the session close of 2026-11-11. Operator decisions behind them are tracked in the vault's ACTIVE-WORK anchors named per step; this document records only what the repository has to do.

## Borders on the itinerary map

Decided by the Research Coordination on 2026-11-11 (way b). A rough own digitisation of the political borders after Shepherd's map "Europe 1190" (1923), drawn as soft areas and named in the view as this project's interpretation, with a half-sentence on its uncertainty. Before drawing, check the public-domain status at the map's source itself. No GPL dataset. The layer goes into `build_basemap.py` beside coast and rivers and is drawn only inside the undistorted core, like the base map. Anchor: op-thm-edition-ansicht.

## Signs instead of direction words

The operator asked for signs in place of the eight direction words in the figures. Open since the feedback of 2026-11-11, recorded in [ui-feedback.md](ui-feedback.md). Anchor: op-thm-edition-ansicht.

## Colour choice

Two warmer palettes are built and reachable with `?farbe=w1` and `?farbe=w2`; the recommendation is W1, the current light palette stays the default until the operator decides. After the decision, the chosen palette moves into the tokens of `css/tokens.css` and the switch is removed. Anchor: op-thm-edition-farbe.

## Edition title

Title and subtitle in `edition/texts.json` are provisional. Anchor: op-thm-edition-titel.

## Review of the regesta

The 224 regesta of `factoid-1153-2026-11-11` are technically checked (agent reviews, adjudication, correction, SHACL) and not accepted. The site says so per regest. Scholarly review by the accountable expert is the next step and decides what the edition may state as accepted. Anchor: op-thm-regesten-pruefung.

## Publication

The first curated build stands (`site/`, run `factoid-1153-2026-11-11`). The Research Coordination creates the public repository; after that the remote is added here and the curated build is published with the checks of `checks/test_site.py` and a review of the built output for internal material. Anchor: op-thm-edition-oeffentlich.

## Smaller open points

- Name forms in the network. Regest-local actors carry the inflected form of their regest ("Heinrich dem Löwen", "Bischof Eberhards II."), visible as standing names in the whole network. A nominative form needs either the register entry or a normalisation rule; neither is decided.
- `checks/ui_check.py` asserts the layout of the first slice. It is to be rewritten for the shell or retired.
- The validator note of `regesta-rdf-demo` (status after correction is read from the corrections log since 2026-11-11) is to be mentioned on the method page once the page lists the error logs per step.
- Export date of the regest file, model of the adjudicating and correcting agent, imprint.
- Deletion candidates in the knowledge folder and the views are collected under op-thm-loeschkandidaten.
