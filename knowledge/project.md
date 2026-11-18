---
title: Project
status: draft
language: en
created: 2026-11-09
updated: 2026-11-17
---

# Project

Regesta Assertive Edition is a first, inspectable interface prototype for the regesta of Friedrich Barbarossa (Regesta Imperii IV,2) together with the pipeline in `pipeline/` that turns them into evidenced statements of the factoid model. LLM agents extract the statements, deterministic scripts check them, two independent agent reviews and a correction follow, and the edition shows the result beside the regest. No statement is validated by a historian (`expert_accepted: false`).

The idea of an assertive edition follows Vogeler (2019): the edition shows the regest text, the statements formalised from it, each bound to its exact wording, and for each statement what is asserted by an LLM agent, what passed the technical checks and what a historian has accepted. The edition offers a page per regest with its text, statements and evidence, and views of persons and places over time and space, beside a deterministic layer of the whole delivery. Named SPARQL questions that fit the research data model are kept as requirements in [questions.md](questions.md) and feed the visualisations at build time.

## Audience

- Historians without technical experience who judge statements against the regest.
- Students of a course on graph-based systems who look at the RDF and the SPARQL behind a question.

## Scope

The edition shows the run `factoid-1153-2026-11-11`: all 224 regesta whose start date in the delivery lies on or before 31 December 1153, six of them reused from the earlier factoid run without new extraction. Its statements follow the [Factoid model](factoid-model.md) under the frozen contract `pipeline/contracts/factoid-2026-11-11`; the steps from selection to build are in [Pipeline](pipeline.md). The whole delivery of RI IV,2 appears beside it as a deterministic layer without extracted statements.

## Status

The revised stage of the run passes the technical checks, and two agent reviews per group were adjudicated and corrected. That is conformance to the contract and agentic review, not scholarly validation: the manifest records `expert_accepted: false`, and the edition shows every statement as unchecked by a historian. The operator accepted the site on 2026-11-18 for the guest unit, in German and in English ([journal](journal.md)); the acceptance covers the interface and no statement. Next steps are in [plan.md](plan.md). The earlier pilot run `pilot-2026-11-09` with its CIDOC CRM profile is kept in `pipeline/runs/` as archive ([Domain ontology](domain-ontology.md)).

## Pipeline

The edition and the pipeline that produces its statements lie in this one repository since 2026-11-17, on the operator's decision of that day. The pipeline began on 2026-11-09 as a Promptotyping experiment for the guest unit „Agentic Engineering für Forschungsdatenworkflows“ at Technische Hochschule Mittelhessen on 20 November 2026, whose demonstrations show its steps; the operator focused extraction on kinship, economic and legal information. Teaching slides: https://docs.google.com/presentation/d/1Pzj4v6xl6nEl6z4PPMvvihy0yW11F9cH2Xmp8SrYXNU/edit.

## Sources

- Vogeler, G. (2019). The 'assertive edition'. *International Journal of Digital Humanities* 1, 309–322. https://doi.org/10.1007/s42803-019-00025-5. Not re-read for this prototype; the reference follows the operator's vault report on edition interfaces.
- The pipeline in `pipeline/` ([Pipeline](pipeline.md)), moved here on 2026-11-17 from the repository `regesta-rdf-demo` (commit f65887c), which stays as history.
