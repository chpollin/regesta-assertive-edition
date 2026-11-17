---
title: User stories
project:
  name: Regesta Assertive Edition
  repository: https://github.com/chpollin/regesta-assertive-edition
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
status: draft
language: en
created: 2026-11-09
updated: 2026-11-11
---

# User stories

These proposed epics and user stories translate the operator's research, expert-review and teaching goals into inspectable requirements. They are a product draft for the expert interview. The [Edition plan](https://github.com/chpollin/regesta-rdf-demo/blob/f65887c/knowledge/edition-plan.md) fixes the first frontend scope, while the concrete historical question and the primary audience remain undecided.

Acceptance criteria below describe observable behaviour of a future implementation. They do not report completed functionality or expert acceptance. The retained runs supply development material, and the development cases named below lie in both the pilot and the factoid run.

## Basis and boundaries

The operator has selected kinship, economic and legal information, source-grounded statements in the [Factoid model](factoid-model.md), bounded agent extraction and human verification. The operator also requested literature-grounded domain knowledge and the capture of expert feedback as reusable knowledge.

The edition plan takes up US03 and US04 in the person index, US05 in the evidence underline, US08 in the review state and the human-verified subset, US10 in the revised stage shown with the extracted stage for comparison, and US13 in the start page on the Adela case.

The proposed research-facing and expert-review roles are functional roles. The interview must establish whether one person uses both. [Specification](https://github.com/chpollin/regesta-rdf-demo/blob/f65887c/knowledge/specification.md) remains the authority for authorised scope, and no story here authorises implementation, model changes or publication.

The [data contract](source-data.md), [Architecture](pipeline.md) and [Testing](testing.md) are the local evidence basis. The wider literature review is planned and does not yet establish a validated user need.

## Epic overview

| ID | Epic | Intended outcome | Open expert decision |
|---|---|---|---|
| E01 | Ground domain knowledge in sources | Research context and product assumptions have inspectable support | Which literature questions must be answered before choosing the tool? |
| E02 | Explore actors and attested relationships | A researcher can find and inspect relevant source-supported connections | Which historical question and relationship types define the first prototype? |
| E03 | Compare acts and temporal qualifications | A researcher can distinguish related acts and their temporal scope | Which temporal distinctions must be structured initially? |
| E04 | Review claims and capture expert knowledge | An expert can judge individual assertions and turn reasons into reusable knowledge | What evidence is necessary for acceptance, and how far does feedback generalise? |
| E05 | Evaluate model and extraction | A researcher can identify technical defects, semantic errors and omissions separately | Which reference readings and error trade-offs should guide evaluation? |
| E06 | Demonstrate the research workflow | A teacher can explain the actual project and its decisions through inspectable examples | Which demo case and frontend function should open the lesson? |

## E01 Ground domain knowledge in sources

### US01 Inspect the basis of a domain statement

As a researcher, I want to follow a statement in the domain report to its source passage so that I can assess whether the statement is supported.

Acceptance criteria:

- A substantive literature-derived statement resolves through a stable identifier to a named publication, version and page or section.
- The supporting passage and its context can be inspected. The record distinguishes metadata-only discovery from text actually read.
- A claim based on a project webpage is identified as such. The webpage does not stand in for an unread research publication.
- An unresolved or conflicting reading remains visible.

The provenance structure should reuse the [Grounded Vault method](https://github.com/DigitalHumanitiesCraft/grounded-vault) after inspecting its current contract. This story does not introduce a competing schema.

### US02 Inspect the grounds for a proposed requirement

As the responsible researcher, I want to see why a user story or interface requirement exists so that I can accept, revise or reject its motivation.

Acceptance criteria:

- A proposed requirement links to a research task and to its basis in operator instructions, inspected corpus evidence, literature or observed use.
- A design proposal is identified as a proposal even when related domain findings are well supported.
- Corpus limitations and unmet data prerequisites accompany the requirement.
- An expert decision records its scope and grounds. A deferred decision remains open.

## E02 Explore actors and attested relationships

### US03 Find an actor and inspect identity candidates

As a researcher, I want to find an actor through names and supplied register labels so that I can locate potentially relevant regesta without assuming that every matching label denotes the same actor.

Acceptance criteria:

- Results distinguish register identifiers, labels and associated regest records.
- An unresolved identity remains unresolved. Search does not silently merge people with similar names.
- An institutional community is distinguishable from its geographical location.
- A result opens its source record. Empty results and ambiguous associations are explicit.

Development examples come from the supplied register and its join issues described in [Data](source-data.md).

### US04 Inspect source-attested relationships in context

As a researcher, I want to inspect an actor's attested kinship, economic and legal connections together with their event or state context so that I can compare historically meaningful relationships.

Acceptance criteria:

- Each result identifies the actors, relation or role, context and relevant regest.
- Conditions, exceptions and unresolved qualifications remain visible.
- An asserted relation can be traced to its evidence and review status.
- Shared mention alone produces no asserted historical relationship.
- Missing extracted relations are not presented as evidence that no historical relation existed.

Which categories are included initially requires the expert interview. A network diagram is an optional presentation choice, not an acceptance criterion.

### US05 Check the evidence behind a result

As a researcher, I want to read an extracted assertion beside its exact supporting words so that I can judge its interpretation before using it.

Acceptance criteria:

- Selecting an assertion opens the corresponding regest summary and marks or quotes the exact retained evidence substring.
- A readable statement and the underlying Turtle are available for the same assertion.
- Candidate status, machine review and expert acceptance remain distinguishable.
- Claims beyond the supplied summary scope are not attributed to that summary.
- Broken evidence references are reported rather than replaced by approximate text.

## E03 Compare acts and temporal qualifications

### US06 Distinguish earlier acts, confirmations and promises

As a researcher, I want related legal or economic acts to remain individually inspectable so that I can distinguish what was done, confirmed or promised.

Acceptance criteria:

- The retained pledge example UID 24821 can show the earlier pledge, its later confirmation and the assurance as distinct source-described acts.
- A promise is not rendered as a completed transfer or payment.
- The interface exposes the evidence and actors of each act.
- Unresolved links between acts remain qualified rather than being silently joined.
- Use of this case as an accepted reference requires expert review of its actual RDF.

### US07 Inspect uncertain and alternative dates

As a researcher, I want temporal qualifications to remain visible so that I do not mistake an editorial dating interval for the precise time of every reported act.

Acceptance criteria:

- Alternative years in UID 22673 remain alternatives and are not displayed as continuous duration.
- Several events within one regest need not inherit the same event date.
- Dating prose remains accessible beside machine-readable source dates.
- Unknown, inferred and explicitly stated event times are distinguishable where used.
- A chronological display does not assign an unsupported order to unresolved alternatives.

## E04 Review claims and capture expert knowledge

### US08 Accept, correct or defer an individual assertion

As the domain expert, I want to judge a specific assertion beside its evidence so that acceptance has a clear historical and evidential scope.

Acceptance criteria:

- The decision identifies the run, graph version, source UID and assertion.
- The expert can accept, reject, request correction or defer a decision, with a reason.
- A decision distinguishes acceptance of an assertion from acceptance of the ontology or extraction completeness.
- A later changed assertion retains the previous decision as history and requires a new decision.
- Technical validation or an LLM review never creates an expert-acceptance decision.

A live interface and persistent decision format remain to be specified. The review sheets of each run are the current preparation artefact.

### US09 Turn expert feedback into bounded reusable knowledge

As the domain expert, I want my explanation of a correction to be retained with its applicability so that later annotations can benefit from my knowledge.

Acceptance criteria:

- Feedback identifies whether it concerns one reading, an identity, an annotation rule, an ontology concept or an evaluation example.
- The record links the source case, reason and intended scope of generalisation.
- A case-specific decision does not automatically become a corpus-wide rule.
- Generalised rules and ontology changes remain proposals until explicitly accepted.
- An accepted change identifies the affected contract and a regression example, while earlier frozen runs remain unchanged.

UID 220540 provides a development case for distinguishing addressees from asserted mission participants. It does not establish a universal rule about every addressee.

### US10 Compare original extraction and correction

As the domain expert, I want to inspect the original graph, review finding and correction together so that I can assess both the annotation and the review process.

Acceptance criteria:

- Original and revised outputs remain separately accessible.
- Accepted and rejected reviewer findings retain their rationale.
- A correction identifies which assertion or structural relation changed.
- New technical results apply to the identified revised graph.
- Remaining ontology gaps remain visible even when the revised graph passes validation.

## E05 Evaluate model and extraction

### US11 Inspect technical validation separately from interpretation

As a researcher, I want to see which checks passed or failed so that I can assess the technical state without mistaking it for historical acceptance.

Acceptance criteria:

- Results identify the input, contract and graph versions used.
- RDF parsing, SHACL, evidence matching, identifier policy and assigned-record coverage have inspectable outcomes.
- Every assigned record has an extraction, explicit abstention or error outcome.
- A technically conforming candidate remains labelled as awaiting expert acceptance.
- The retained original failure and revised pass can be reproduced with the documented validator.

### US12 Evaluate against expert-reviewed reference readings

As the responsible researcher, I want to compare extraction with explicit reference readings so that I can identify unsupported claims and missed relevant information.

Acceptance criteria:

- The expert defines expected assertions, exclusions and unresolved interpretations for each reference case.
- Development examples and fresh evaluation material are identified separately.
- Evaluation distinguishes unsupported claims, omissions, actor identity, role, temporality and lost qualifications.
- An empty in-scope result can be correct for an expert-confirmed negative case.
- Accuracy measurements name their reference set and method. The purposive selections of the retained runs are not presented as corpus-wide accuracy.

Candidate negative case UID 24392 requires expert confirmation before it becomes a reference.

## E06 Demonstrate the research workflow

### US13 Open a concrete historical task and inspect its result

As the teacher, I want to open the eventual tool at a concrete task so that the audience can understand the result before examining how it was produced.

Acceptance criteria:

- The selected case provides a historical question, an inspectable result and its source evidence.
- The demonstration exposes at least one meaningful modelling or interpretation decision.
- The example is selected after agreeing the first prototype's task and reviewing its data.
- Any public output includes only material explicitly cleared for that purpose. Internal knowledge and private working artefacts remain outside the served build.

### US14 Explain the workflow through actual artefacts

As a learner, I want to follow a real example through preparation, extraction, validation, review and expert judgement so that I can understand the contribution and limits of each step.

Acceptance criteria:

- The pipeline graphic, task input, candidate RDF, review finding, correction and validation result refer to the same demonstrable case where available.
- The teaching prompts are distinguished from actual execution prompts.
- Deterministic checks, LLM review and human decisions remain separately identifiable.
- The Grounded Vault explanation links the method repository and shows the purpose of the knowledge structure.
- The spoken remote-control opener describes the operator's working situation without implying that the workflow lacked specifications or review.

## Expert interview dependencies

| Decision | Stories affected |
|---|---|
| Concrete historical question and intended primary audience | US02, US03, US04, US06, US07, US13 |
| Research exploration and review in the first prototype | US03–US10, US13 |
| Literature scope and sufficiency of the summary field | US01, US02, US05, US08 |
| Permitted inference, actor distinctions and temporal requirements | US04, US06, US07, US09, US12 |
| Expert evidence needs, error trade-offs and reference readings | US05, US08–US12 |
| Demo case and publication scope | US13, US14 |

The story IDs provide traceable references for interview answers and later requirements. No priorities, delivery estimates or overall product acceptance are assigned.
