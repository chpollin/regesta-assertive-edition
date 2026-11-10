---
title: Specification
status: draft
language: en
created: 2026-11-09
updated: 2026-11-09
---

# Specification

The requirements come from the operator's commission and three rounds of his feedback on 2026-11-09, and from the proposed user stories US03 to US08 and US11 of `regesta-rdf-demo/knowledge/user-stories.md`. The research questions that the interface answers are kept in [questions.md](questions.md). None of the requirements records an expert acceptance.

## Requirements

1. The interface consists of interactive visualisations of the holdings and a reading view per regest as their detail. The questions to the data are knowledge, not an interface view.
2. A timeline places every regest of the run at its delivered start date in front of the distribution of all regesta of the delivery per year. Mark height shows the number of statements, an empty mark the regest without statement, a triangle a regest corrected after review. The two regesta of the Adela case are joined by an arc generated from the same-name question.
3. A person graph shows actors and acts with every link taken from a triple, Adela's father as two nodes of the same name, and a deterministic layout computed at build time.
4. Pointing at a regest in the timeline marks its acts and people in the graph; pointing at or selecting a person marks her regesta in the timeline. Selection in either leads into the reading view.
5. The reading view shows the regest on paper and one readable sentence per act, every phrase bound to its evidence. Pointing, focus or selection underlines the evidence in red; pointing at words underlines the phrases resting on them. Keyboard: Tab into the paper, arrow keys through the evidence, Enter to the phrase, arrow keys through phrases, Enter or Space to select, Escape to clear.
6. The review state (asserted, technically checked, expert accepted) stands once per regest, by shape and fill, read from the run. Only deviations appear at a phrase: no own E13, or no evidence at all.
7. Agent notes, review findings, adjudication and corrections stay available per regest, closed.
8. The Diepold case is recognisable on the timeline, in the graph and from both reading views, each leading to the others.
9. Commentary and transmission from the regest CSV appear only as the edition's apparatus, closed, labelled as not being the basis of the statements.
10. Source wording appears in the serif on paper or as quotation, agent text in cool light, the red pen marks pointing and the open expert decision.
11. Every visualisation has a text equivalent and keyboard operation; meaning never rests on colour alone.

## Acceptance checks

`checks/ui_check.py` asserts the outcomes against values taken from `data/edition.json`, in dark and light scheme at 1440, 2000 and 390 px and at a 720 px state equivalent to 200 percent zoom. `checks/test_build.py` asserts that paraphrased or case-changed evidence aborts the build. The operator's screen review remains a separate acceptance step.

## Out of scope

Expert decisions and their persistence, the original-stage RDF, search, a cross-regest view of rights, references between acts and conditions, and any publication.
