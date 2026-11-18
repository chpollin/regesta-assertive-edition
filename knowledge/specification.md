---
title: Specification
status: draft
language: en
created: 2026-11-09
updated: 2026-11-18
---

# Specification

The requirements come from the operator's commission and three rounds of his feedback on 2026-11-09, and from the proposed user stories of 2026-11-09, condensed under Research tasks. The questions to the data that the build executes are described in [data.md](data.md#questionsjson). None of the requirements records an expert acceptance.

## Research tasks

Condensed on 2026-11-18 from the proposed user stories of 2026-11-09 that the edition serves; the document `user-stories.md` was deleted on the operator's word and its full text, with the stories on literature grounding, expert feedback, reference readings and teaching, stays in the Git history. Each task names the criteria a test task checks ([plan.md](plan.md#test-tasks-with-computed-answers)); none records an expert acceptance.

- US03, find an actor and its identity candidates. Register identifiers, labels and regesta stay apart; an unresolved identity stays unresolved and search never merges persons of similar name; a community is distinct from its place; empty and ambiguous results are explicit.
- US04, inspect attested relationships in context. Each result names actors, relation or role, context and regest, with its conditions, exceptions and evidence; shared mention creates no relation, and a missing statement is no evidence that no relation existed.
- US05, check the evidence behind a statement. A statement opens its regest with the exact evidence marked; a readable statement and its Turtle are both available; candidate, machine review and expert acceptance stay distinct; broken evidence is reported and never approximated.
- US06, tell earlier acts, confirmations and promises apart. Related acts stay individually inspectable with their evidence and actors, a promise is never shown as a completed transfer, and an unresolved link between acts stays qualified (development case: the pledge of UID 24821).
- US07, inspect uncertain and alternative dates. Alternative years stay alternatives (UID 22673), events of one regest need not share its date, the dating prose stays beside the machine date, and no chronological display orders unresolved alternatives.
- US08, accept, correct or defer a single statement. A decision names run, graph version, regest and statement, carries a reason, concerns the statement and not the model or its completeness, keeps its history when the statement changes, and is never created by a technical check or an LLM review. The decision format is not specified.
- US10, compare the extracted and the revised stage. Both stay separately accessible, accepted and rejected review findings keep their rationale, a correction names what changed, and remaining gaps of the model stay visible after validation.
- US11, see technical validation apart from interpretation. Results name input, contract and graph versions; parsing, SHACL, evidence matching, identifier policy and record coverage have inspectable outcomes; every assigned record ends in an extraction, an abstention or an error; a conforming candidate stays marked as awaiting expert acceptance.
- US13, open a concrete historical task. The start leads to a case with a question, an inspectable result and its evidence, and shows at least one decision of modelling or interpretation; public output holds only material cleared for it.

## Requirements from the operator's verdicts of 2026-11-14 (proposal)

Each with the acceptance criterion he decides in front of the running preview; derived by the implementing agent from his verdicts in [ui-feedback.md](ui-feedback.md), not yet adopted by him.

1. Regest page: one head line with all metadata and actions, a reading area with the notes beside the text, and the apparatus below, in the same place on every page; the annotation follows one system ([design.md](design.md#annotation-system)). Criterion: a reader names from the page alone what is annotated and by whom, who has checked it, and what the editors' commentary says. (The three areas of 2026-11-14 became the head line by the interface plan the operator accepted on 2026-11-17.)
2. Agents' verdicts are named as the verdicts of LLM readings and never as a human check. Criterion: no page says or implies „menschlich geprüft“ for a statement.
3. Start page: the figure fills the screen under the header and the page does not scroll at desktop sizes. Criterion: at 1440 × 900 the document is no higher than the window.
4. Place view: a pointed or focused regest is readable beside its point; an opened regest is marked with what it depends on, the rest recedes; the sidebar is narrow. Criterion: the reader of RI IV,2,1 n. 135 tells from the view what it says and what it is connected to.
5. Persons can be followed through the space-time cube. Criterion: choosing a person shows their regesta as a trace through places and years.

## Requirements of the first slice (history)

The list below describes the first slice of 2026-11-09. It is superseded in parts by the shell and its revisions (design.md): there is no timeline of that form, no paper ground and no red pen, and the apparatus is no longer closed. It stays as history until the operator adopts the proposals above.

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

The interface has no executable browser check since the check of the first slice (`checks/ui_check.py`) was retired on 2026-11-14; it is checked on the rendered state by the density check of `pruefansicht`, screenshots at 1280 and 360 px and a fresh reader (AGENTS.md). `checks/test_build.py` asserts that paraphrased or case-changed evidence aborts the build. The operator's screen review remains a separate acceptance step.

## Out of scope (first slice, history)

For the first slice of 2026-11-09: expert decisions and their persistence, the original-stage RDF, search, a cross-regest view of rights, references between acts and conditions, and any publication. The last item is stale, since the curated build is published on GitHub Pages since 2026-11-12 (AGENTS.md, Boundaries), and the factoid model carries references between acts and conditions; the other items were not rechecked on 2026-11-17.
