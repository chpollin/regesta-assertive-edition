---
title: Project
status: draft
language: en
created: 2026-11-09
updated: 2026-11-09
---

# Project

Regesta Assertive Edition is a first, inspectable interface prototype for the regesta of Friedrich Barbarossa (Regesta Imperii IV,2) that the pilot run `pilot-2026-11-09` of `regesta-rdf-demo` turned into CIDOC CRM based RDF. The operator commissioned it so that interface and design can be accepted at the screen.

The idea of an assertive edition follows Vogeler (2019): the edition shows the regest text, the statements formalised from it, each bound to its exact wording, and for each statement what is asserted by an LLM agent, what passed the technical checks and what a historian has accepted. Since the operator's decision of 2026-11-09 the interface consists of interactive visualisations of the holdings, a timeline and a person graph, with the reading view as their detail. Named SPARQL questions that fit the research data model are kept as requirements in [questions.md](questions.md) and feed the visualisations at build time.

## Audience

- Historians without technical experience who judge statements against the regest.
- Students of a course on graph-based systems who look at the RDF and the SPARQL behind a question.

## Scope of the first slice

All fifteen regesta of the pilot run, including the one without an in-scope statement. A timeline and a person graph of the run, linked with each other, and a reading view per regest. The case of Margrave Diepold of Vohburg in RI IV,2,1 n. 46 and n. 167 is visible on the timeline, in the graph and from both regesta, because it carries a talk.

## Status

Built and checked by the implementing agent on 2026-11-09, redesigned the same day after three rounds of operator feedback. The design is a proposal and has not been accepted by the operator. Historical acceptance of the RDF is pending in the source run (`expert_accepted: false`), and the interface shows it that way.

## Sources

- Vogeler, G. (2019). The 'assertive edition'. *International Journal of Digital Humanities* 1, 309–322. https://doi.org/10.1007/s42803-019-00025-5. Not re-read for this prototype; the reference follows the operator's vault report on edition interfaces.
- Source repository `regesta-rdf-demo`, knowledge documents `continuation-brief.md`, `data.md`, `domain-ontology.md`, `user-stories.md`, `annotation-guidelines.md`.
