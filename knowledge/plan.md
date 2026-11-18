---
title: Plan
status: draft
language: en
created: 2026-11-11
updated: 2026-11-17
---

# Plan

Accepted next steps of the edition that are still open. Operator decisions behind them are tracked in the vault's ACTIVE-WORK anchors named per step; this document records only what the repository has to do. Finished steps and how they were settled are in the [journal](journal.md), among them the term and definition „Agentic Edition“; the TEI headers carry them, and the site's title is the working title „Barbarossa-Regesten“ since 2026-11-14 (term and definition confirmed 2026-11-12, anchor op-thm-edition-titel), the publication on GitHub Pages (2026-11-12) and the agent review of twenty regesta (2026-11-14).

## Agent review of twenty regesta

The operator decides from n. 103a whether the agents' verdicts go public; until then they are shown only in the local preview (data.md, Agent review). The contested and unclear cases go to the model questions and to experts. No statement is verified by a person.

## Review of the regesta

The 224 regesta of `factoid-1153-2026-11-11` are technically checked (agent reviews, adjudication, correction, SHACL) and not accepted, and the site says so per regest. A scholarly review has no owner since the operator gave up his own check on 2026-11-14.

## Public visibility

Making the repository itself public, a tag or a release stay with the operator. Anchor: op-thm-edition-oeffentlich.

## Test tasks with computed answers

Each user story of [user-stories.md](user-stories.md) that the edition serves gets one test task whose correct answer a script computes from the data, independent of the interface; RI IV,2,2 n. 103a is a fixed task in every round (which statements, which evidence, which roles). Per round one fresh subagent receives only task and address, solves it in the browser and records path, wrong turns and answer, which is compared with the computed one; the same task set runs again after every rebuild, and each finding is assigned to the story, the design or the data. The rule check and the recount of shown numbers stay with the existing density check, figure check and independent reviewer. Limit: an agent finds dead ends and wrong numbers, not whether a view feels slow or the question is the right one. Taken up on 2026-11-14, not built.

## Pipeline after the guest unit

Accepted on 2026-11-17 with the move of the pipeline; not before 20 November.

- A transfer check that every accepted review finding (`correct`, `correct_conservatively`) is carried out in `revised/` and every rejected one is not.
- `validate_pilot.py`, `select_fresh.py`, the pilot run and the pilot ontology into `pipeline/archive/`, with their paths in manifests and knowledge followed.
- The pilot path of `build_data.py` goes with the pilot archive move after 20 November (operator's decision of 2026-11-17).
- `build_site.py` onto the shared helpers of `edition_io.py` (BuildError, JSON loader, CSV reader, shown run).
- A stable namespace for the `rf:` and `rv:` terms, an open decision of the operator; `build_graph.py` takes it as a parameter.
- A reference set verified by a historian, with precision and recall measured against it. It has no owner (Review of the regesta above).
- Open from the former edition plan: the historical research question and the primary audience, and with them the selection principle beyond the demonstration slice (ide-criteria.md, 2.1, 3.2, 3.3).

## Smaller open points

- Name forms of regest-local actors. Actors without a register entry (groups such as "des Vogtes", "seinen Leuten") keep the inflected form of their regest; a normalisation rule for German inflection would guess and is not built. Friedrich I. and his father keep the agents' form, because the register leaves the head name of the Friedrich entries empty.
- The borders after Shepherd show the Empire only. Kingdoms beside it (France, Hungary, Sicily) are not drawn.
- An executable browser check of the current shell (tasks with computed answers, see Test tasks) replaces the retired check of the first slice.
- The validator note of the pipeline (status after correction is read from the corrections log since 2026-11-11) is to be mentioned on the method page once the page lists the error logs per step.
- Export date of the regest file, model of the adjudicating and correcting agent, imprint.
- Deletion candidates in the knowledge folder and the views are collected under op-thm-loeschkandidaten.
