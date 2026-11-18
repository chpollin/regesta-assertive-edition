---
title: IDE criteria mapping
project:
  name: Regesta Assertive Edition
  repository: https://github.com/chpollin/regesta-assertive-edition
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
status: snapshot
language: en
created: 2026-11-11
updated: 2026-11-11
---

# IDE criteria mapping

State of 2026-11-11. This document applies the catalogue of the Institut für Dokumentologie und Editorik (IDE) for reviewing scholarly digital editions, version 1.1 (Sahle et al., 2014), criterion by criterion to two repositories. `regesta-rdf-demo` (below RDF demo) produces RDF statements with LLM agents from the supplied CSV export of the Regesta Imperii IV,2, and `regesta-assertive-edition` (below interface) shows one run of it as a local web interface. The planned public edition, with its pages, data flow and scope, is described in [Edition plan](https://github.com/chpollin/regesta-rdf-demo/blob/f65887c/knowledge/edition-plan.md).

Each criterion carries four numbered points in the same order:

1. what the current state fulfils, with a file or route as evidence,
2. what is missing,
3. what the planned edition should do, in one or two sentences,
4. whether the criterion applies at all to a regest-based edition without facsimiles.

The catalogue requires that the general criteria are treated in their entirety and allows a justified non-application of specific criteria, either because they do not fit the documents or because the editors refrain from them for methodological reasons (Sahle et al., 2014, Application and note 3). Point 4 follows this distinction. Paths are relative to the respective repository, and routes refer to the interface under `index.html`.

## Starting position in five findings

Five findings shape almost every line of the mapping and are therefore stated first.

- The edited material is itself an edition. The regesta are summaries of the Regesta Imperii, that is published editorial work of the source project ([Data](source-data.md), section Sources). The project's contribution lies in a layer of statements over these texts.
- The interface currently shows the pilot run with fifteen regesta (`data/edition.json`, `run.id` = `pilot-2026-11-09`). The factoid run with twenty regesta is readable in the build (`data.md`, section Factoid model), but the checked-in data come from the pilot run. The delivery holds 3582 regesta (`regesta-rdf-demo/generated/exploration-report.md`). The edition is to cover the slice up to the end of 1153, whose run was being computed at this date ([Edition plan](https://github.com/chpollin/regesta-rdf-demo/blob/f65887c/knowledge/edition-plan.md), Data scope).
- No statement is accepted by an expert. Both completed runs carry `expert_accepted: false` (`runs/*/manifest.json`, `runs/*/validation/*.json`), a reference set is missing, and accuracy is unmeasured ([Testing](testing.md)).
- The rights are clarified. The regesta database of Regesta Imperii is published under CC BY 4.0, and the edition attributes RI with licence link, source link and a statement of modification ([Edition plan](https://github.com/chpollin/regesta-rdf-demo/blob/f65887c/knowledge/edition-plan.md), Rights). The live imprint still has to be checked once in a browser before publication. The interface's action layer still forbids publishing the data files because of unresolved source terms (`regesta-assertive-edition/AGENTS.md`, Boundaries), which is the state before the clarification.
- There are no facsimiles of the charters. The field `external_links` does, however, point per regest to the digitised page of the printed RI volume at the Münchener Digitalisierungszentrum, for UID 22673 for example to `https://mdz-nbn-resolving.de/bsb00009245?page=21` with the link text „Digitalisat der RI-Buchseite“ (`source-material/RI_004-002-ReggBarbarossa.csv`, column `external_links`). The targets were never fetched (`generated/aggregations/source-references.csv`, `scope_check` = `not_fetched`), and their terms of use are unchecked.

## Preliminary remarks, the three necessary conditions

The catalogue names three necessary conditions of a digital edition (Sahle et al., 2014, Scope).

### A justification of the editorial method adopted and a clear description of the rules that guided the edition

1. The rules are detailed and frozen. For the factoid run, `contracts/factoid-2026-11-11/knowledge/annotation-guidelines.md`, the ontology, the SKOS vocabulary, the SHACL shapes and three prompts bind the extraction, and their hashes stand in `runs/factoid-2026-11-11/manifest.json` (`contract_sha256`). The justification of the model is in [Factoid model](factoid-model.md).
2. Everything lies in English internal knowledge documents. A reader of the edition finds no justification of the method.
3. The method page should distil rules and justification from annotation guidelines, factoid model, architecture and testing into a reading version and link the frozen contracts as their source.
4. Applies without restriction.

### Compliance with scholarly requirements towards content and quality, which includes that the self-stated rules are followed

1. Compliance with the project's own rules is enforced technically. `validate_factoid.py` checks vocabulary, shapes and verbatim evidence, and the interface build stops as soon as an evidence passage is not verbatim in `summary_plain` (`regesta-assertive-edition/AGENTS.md`, `checks/test_build.py`, `checks/test_factoid.py`).
2. The scholarly quality is unchecked. Agent reviews still found four errors in technically passing files (`runs/factoid-2026-11-11/review/adjudication.json`), and a human check is missing entirely.
3. The edition needs a subset verified by a historian and a review state visible per statement that separates human verified from technically passed.
4. Applies without restriction and is the weakest point of the project.

### An editorial concept that is not restricted to the technological limitations of print technology but that realizes a "digital paradigm"

1. Fulfilled. Statements as a graph with evidence bound at word level, review state per statement, timeline, person graph and space view cannot be rendered in print (`specification.md`, requirements 2 to 6).
2. Nothing fundamental.
3. The method page should state which research question the statement layer makes answerable that the printed regesta volume does not answer.
4. Applies.

## 1. Opening the review

### 1.1. The reviewer

1. The criterion addresses the reviewer. The project at least records which competence the pending acceptance needs, namely historical judgement of the readings and of the model's fitness ([Architecture](pipeline.md), stage Expert review).
2. For a review, naming the required double qualification is missing, Staufer history and diplomatics on one side, RDF, CIDOC CRM and LLM methods on the other.
3. The About page should name which expertise exercised the acceptance, so that a review can relate its own perspective to it.
4. Concerns the review, the edition only indirectly.

### 1.2. Bibliographic identification of the reviewed SDE

1. A title exists, „Barbarossa-Regesten mit belegten Aussagen“ (`regesta-assertive-edition/index.html`, `<title>` and `.site-name`), now extended to the working title of the [Edition plan](https://github.com/chpollin/regesta-rdf-demo/blob/f65887c/knowledge/edition-plan.md). Run identifier and date stand in the manifest.
2. Responsible editors, participating institutions, publication and version dates and a stable address are missing. The interface runs locally under `127.0.0.1:8091`, and both repositories are private.
3. Start page and About page should carry title, responsible persons by role, the Regesta Imperii as source edition, version number with date and a permanent address with a DOI per release.
4. Applies without restriction.

### 1.3. General introduction

1. The subject is described internally (`regesta-rdf-demo/README.md`, `project.md`). A related RI project on persons and networks is mentioned only as an orientation finding ([Project](project.md), Context).
2. An introduction for readers is missing, as is the placement relative to Regesta Imperii Online, the printed volume RI IV,2 and related network projects, and the naming of the desideratum.
3. The About page should set out in a few paragraphs the subject, the relation to the Regesta Imperii and to neighbouring projects, and the desideratum of an evidenced statement layer on kinship, economy and law.
4. Applies without restriction.

### 1.4. General parameters

1. The process documentation is dense. Journals name commissioning, roles and agents ([Journal](https://github.com/chpollin/regesta-rdf-demo/blob/f65887c/knowledge/journal.md)), the manifests name the LLM per run (`gpt-6.1-terra` in `runs/pilot-2026-11-09/manifest.json`, `claude-opus-5-5` in `runs/factoid-2026-11-11/manifest.json`), and `revised/corrections.json` names the correcting agent. The occasion is the teaching unit at Technische Hochschule Mittelhessen on 20 November 2026 (`README.md`).
2. None of this is publicly named. Resources, funding and an assignment of which stage a human, a deterministic script or an LLM agent is responsible for are missing.
3. The About page should carry a table of the stages with producer (deterministic workflow, named LLM, correcting agent, human verified), date and evidence. The edition then answers exactly the question the workshop proposal finds missing in the catalogue.
4. Applies without restriction and weighs particularly for an agentically produced edition.

### 1.5. Transparency

1. Nothing public. The parameters lie in repository files.
2. Imprint, contact and institutional assignment are missing.
3. The edition needs an imprint, a contact address in functional form and, if the hosting service collects data, a privacy notice, all reachable from every page.
4. Applies without restriction.

## 2. Subject and content of the edition

### 2.1. Selection

1. The selection is documented. The pilot run selects fifteen regesta contrastively by anchors, challenges and a negative control, and the factoid run adds five regesta drawn uniformly with a fixed seed (`runs/factoid-2026-11-11/manifest.json`, field `selection`, `select_fresh.py`). [Testing](testing.md) calls the selection neither representative nor blind. The edition's scope is decided as the contiguous slice of all regesta dated up to 31 December 1153, which contains the Adela case complete ([Edition plan](https://github.com/chpollin/regesta-rdf-demo/blob/f65887c/knowledge/edition-plan.md), Data scope).
2. A selection principle derived from a research question is missing, because that question is still open ([Edition plan](https://github.com/chpollin/regesta-rdf-demo/blob/f65887c/knowledge/edition-plan.md), Open points). The slice is justified by a sound demonstration and the Adela case.
3. The method page should state the slice and its criterion and show the pilot selection separately as a method sample.
4. Applies without restriction.

### 2.2. Previous and project's achievements

1. Origin is separated in data and presentation. Regest text, commentary and transmission come from the CSV, while statements, identity assignments, review findings and data anomalies (date deviations, identifier collision) are project work ([Data](source-data.md)). The interface sets source text on „paper“ and machine text in cool light and shows commentary and transmission as a closed apparatus with the note that they are not the basis of the statements (`specification.md`, requirements 9 and 10).
2. An explicit acknowledgement of the Regesta Imperii and a statement of what is added are missing publicly.
3. The About page should separate what is taken from the Regesta Imperii from what the project adds and name the editors of the source volume by role and institution.
4. Applies without restriction, here with particular weight, because the edited text is entirely others' editorial work.

### 2.3. Content

1. Per regest the reading view offers identifier, dating, place, regest text, statements as sentences bound to evidence, the RDF per statement, agent notes, review history and apparatus (route `#/regest/<uid>/<claim>`, schema in `data.md`). Timeline, person graph and space view come in addition.
2. A quantification on the page is missing. Justified omissions are recorded only internally, for example witness lists, seal and chancery details and mere troop movements (`contracts/factoid-2026-11-11/knowledge/annotation-guidelines.md`, Source boundary). In the delivery `literature`, `footnotes` and `annotations` are empty ([Data](source-data.md)).
3. A content overview should give the holdings from a count produced at build time and name each omitted kind of content with its reason.
4. Applies. Images and transcriptions do not apply, because the material carries none.

## 3. Aims and methods

### 3.1. Documentation

1. Aims and methods are described comprehensively internally (`regesta-rdf-demo/knowledge/` with [Factoid model](factoid-model.md), [Architecture](pipeline.md), [Testing](testing.md) and the archived pilot model).
2. The documentation is English, scattered and, under the house rule, not deliverable as a page, because the `knowledge/` folder never becomes part of a public website.
3. The method page should be a curated German version with an English summary. The RIDE review of the Fontane notebooks criticises precisely the lack of an English abstract as a barrier to access (RIDE 16, 2023, para. 28).
4. Applies without restriction.

### 3.2. Scholarly objectives

1. Seven questions of a historian are recorded with executed SPARQL, on marriages, parent-child relations, parents of the same name, roles, rights, relations between acts and conditions (`questions.md`). Epics and user stories exist as proposals (`user-stories.md`).
2. A decided historical research question and a primary audience are missing ([Edition plan](https://github.com/chpollin/regesta-rdf-demo/blob/f65887c/knowledge/edition-plan.md), Open points).
3. The edition should name a research question, for example the evidenced legal and kinship situation around Friedrich I, and present the seven questions as its subtasks.
4. Applies without restriction.

### 3.3. Mission

1. The interface understands itself as an assertive edition (`project.md`) and names historians without technical experience and students of a course on graph-based systems as its audience. The RDF demo explicitly distinguishes itself from a finished research dataset (`README.md`). The edition plan names the genre in the description, an assertive edition on the basis of RI IV,2 ([Edition plan](https://github.com/chpollin/regesta-rdf-demo/blob/f65887c/knowledge/edition-plan.md), Title and genre).
2. The public promise is not yet written. The name edition raises expectations of critical text constitution that the project does not meet.
3. The start page should state aim, audience and limits in two sentences beside the self-designation.
4. Applies without restriction.

### 3.4. Method

1. The method is documentary. A factoid records what one passage of the regest says, read by a named producer, and asserts nothing about what happened ([Factoid model](factoid-model.md), Model). Only `summary_plain` is read.
2. Whether the source of a factoid is the modern regest or the medieval charter is open ([Factoid model](factoid-model.md), Open questions for experts). A position on editorial school and on work or document reference is missing.
3. The method page should fix the modern regest as the reference document or justify the opposite decision and place the factoid method in the prosopographical tradition.
4. Applies in reinterpreted form. The questions about textual witnesses and preferred manuscripts do not apply, because each regest has exactly one supplied text.

### 3.5. Representation of documents and texts

1. The regest text is shown as delivered. Raw markup stays in the unchanged CSV, and the plain-text version is documented as not lossless ([Data](source-data.md), CSV dialect, missing values and text). The interface renders markup segments without HTML parsing (`data.md`).
2. Images are missing. The derivation from `summary_raw` to `summary_plain` is not described for readers.
3. The edition should disclose the normalisation rule and link per regest to the RI record and to the digitised printed page from `external_links`, as a link and without embedding ([Edition plan](https://github.com/chpollin/regesta-rdf-demo/blob/f65887c/knowledge/edition-plan.md), Rights).
4. Applies with restriction. Transcription rules, image quality and the reconstruction of an ideal text do not apply, while fidelity to the export stays checkable.

### 3.6. Text criticism, indexing and commentary

1. Indexing uses the register entries of the Regesta Imperii as identity candidates per regest, without merging across regesta (`contracts/factoid-2026-11-11/knowledge/annotation-guidelines.md`, Actors and identity). Commentary and transmission of the source stand as apparatus, and data anomalies are collected by machine (`generated/aggregations/date-issues.csv`).
2. A scholarly commentary of the project's own is missing, for example on the case of Adela's two fathers in n. 46 and n. 167, which the project deliberately leaves open ([Journal](https://github.com/chpollin/regesta-rdf-demo/blob/f65887c/knowledge/journal.md), entry Factoid run extracted).
3. The edition should present open identity cases and dating conflicts as a signed commentary by a historian and offer registers as indices.
4. Applies with restriction. Stemma and manuscript description do not apply.

### 3.7. Data modelling

1. Modelling is the strongest side. The factoid model with `rf:Factoid` as a subclass of E13, SKOS vocabulary, SHACL shapes, Web Annotation selectors and PROV attribution is formally declared and frozen per run (`contracts/factoid-2026-11-11/ontology/`, [Factoid model](factoid-model.md)). The CIDOC CRM application profile of the pilot run stays as archive (`ontology/`).
2. The factoid model is decided as the only model. The namespaces are placeholders under `example.org` (`questions.md`, prefixes), formal CRM conformance is not established, and the vocabulary definitions are unchecked drafts of an LLM agent ([Factoid model](factoid-model.md), Model). The edition plan generates TEI by rule from the validated factoids and keeps the RDF as the source of truth ([Edition plan](https://github.com/chpollin/regesta-rdf-demo/blob/f65887c/knowledge/edition-plan.md), Data flow). A justification of RDF as primary format beside TEI is not yet written for readers.
3. The edition should assign a resolvable namespace, publish ontology, shapes and vocabulary with documentation as a formal schema, and justify on the method page why RDF is the source of truth and TEI a rendering with documented loss.
4. Applies without restriction. The question of an ODD translates into the question of published shapes and vocabulary.

## 4. Publication and presentation

### 4.1. Technical infrastructure

1. Static site without a build step, with native ES modules, prebuilt JSON, local fonts and no CDN (`regesta-assertive-edition/AGENTS.md`). The data pipeline is Python with rdflib and pySHACL (`regesta-rdf-demo/README.md`).
2. The reasons are stated only internally, and hosting is not decided.
3. A section of the method page should name technology and justification, and the edition should be delivered as a curated static build.
4. Applies.

### 4.2. Interface and Usability

1. The holdings view fits as one screen at 1280 × 800, with time strip, person graph and selection panel (route `#/`, `design.md`, section Operator feedback). Reading view and space view are reachable through navigation and routes. Keyboard operation and text equivalents are provided (`specification.md`, requirement 11). The space view is the candidate main view of the start page ([Edition plan](https://github.com/chpollin/regesta-rdf-demo/blob/f65887c/knowledge/edition-plan.md), Space).
2. The design is not accepted. The operator found it „viel zu textlastig“ with „zu viele[n] Ebenen“ (`design.md`). A start page explaining purpose and entry points is missing, and the heading still names the pilot run when the factoid run is shown (interface `journal.md`, entry Factoid run read). `checks/ui_check.py` partly checks the old layout.
3. The start page should show purpose, content and entry points at a glance, link the existing views as special views and let each view show its place in the overall architecture. A test with historians on their own questions should precede publication.
4. Applies without restriction.

### 4.3. Browse

1. Within the run everything can be browsed. The timeline shows every regest, the text equivalents list regesta and persons, and the reading view has previous and next (`design.md`).
2. Nothing outside the fifteen or twenty regesta is reachable.
3. The edition should offer a list of regesta by number, date and place over its whole scope, with a direct jump from the start page.
4. Applies without restriction.

### 4.4. Search

1. No search. It is explicitly out of scope (`specification.md`, Out of scope).
2. Full-text and faceted search are missing entirely.
3. The edition should offer a client-side full-text search over regest text and statements with facets by statement type, role and review state, and report an empty result list explicitly as such. The Fontane review tested precisely the behaviour on empty input (RIDE 16, 2023, para. 20).
4. Applies without restriction.

### 4.5. Indices

1. The person graph acts as a person index with a panel per person (route `#/personen/<iri>`), and its text list names every relation.
2. Indices of places, rights and act types are missing. Three of the seven questions have no cross-regest presentation (`questions.md`, Questions without a visualisation).
3. The edition should generate indices of persons, places, rights and act types from the graph, with the register identifiers of the Regesta Imperii and links into the reading view.
4. Applies without restriction.

### 4.6. Quality of the presentation

1. The regest text is checked byte for byte against the CSV (`generated/verification.json`), and every evidence passage is present verbatim. Statement and RDF can be switched in the reading view, and the apparatus shows the source's commentary.
2. Significant errors lie in the statements. The agent reviews of the factoid run found a wrong identification of the Lombards with the army in n. 558 and a wrong role in n. 3276 (`review/adjudication.json`), and a human check is missing. The extracted and the revised stage can only be chosen at build time (`--stage`).
3. The edition shows the revised stage with the extracted stage for comparison, as decided on 2026-11-11 and as US10 proposes ([Edition plan](https://github.com/chpollin/regesta-rdf-demo/blob/f65887c/knowledge/edition-plan.md), Pages). It should also show the review state per statement and present a human-verified subset as reference.
4. Applies in reinterpreted form. Image quality and transcription errors do not apply, and the error rate of the statements takes their place.

### 4.7. Metadata for description of and interlinkage between objects in the edition

1. Regesta carry identifier, dating and place, and statements are linked to evidence passages, timeline, graph and reading view. Internal regest references become jumps when the target lies in the run (`data.md`).
2. Links to the RI record, to authority data and to the digitised book page are missing in the interface. GeoNames is only partly present in the delivery, `wikidataId` is empty, and nothing was reconciled ([Data](source-data.md), Authority links).
3. Each regest should link to its RI record and its digitised book page, and persons to their register entry. Authority links should only be added with their own review state.
4. Applies. The text-image link reduces to the link to the book page.

### 4.8. Identification and citation

1. Internally there are stable identifiers (`urn:regesta:record:<UID>`, `urn:regesta:actor:<ID>`) and hash routes down to the statement (`#/regest/<uid>/<claim>`). The delivery carries RI identifiers in `persistent_identifier`, `urn` and `exchange_identifier`.
2. The URNs do not resolve, and a field named `urn` is not a standards-compliant URN according to [Data](source-data.md). A citation recommendation and a version statement are missing, and hash routes are unsuitable for citation.
3. The edition should assign HTTP addresses per regest and per statement under its own namespace, carry the RI identifier, offer a citation recommendation with version and date and archive each release with a DOI.
4. Applies without restriction.

### 4.9. Technical interfaces

1. SPARQL runs only at build time, and the results stand in `data/questions.json`. The browser deliberately has no SPARQL (interface `AGENTS.md`).
2. Download, API and harvesting are missing.
3. The edition should offer TEI, Turtle and JSON per regest and as a package as static files ([Edition plan](https://github.com/chpollin/regesta-rdf-demo/blob/f65887c/knowledge/edition-plan.md), Pages). A SPARQL endpoint is needed only if the research question requires cross-regest queries by users.
4. Applies without restriction.

### 4.10. Social integration

1. Nothing.
2. Shareable addresses per statement are missing, as is a presence in the scholarly community.
3. Stable addresses per statement as in 4.8 suffice as a basis for sharing and discussion.
4. Applies with low weight.

### 4.11. Spin offs and export formats

1. Review sheets in Markdown exist per run (`runs/factoid-2026-11-11/validation/revised-review-sheet.md`), but they are working material.
2. A print version and alternative formats are missing.
3. A print style for the reading view and a CSV of the statements suffice.
4. Applies with low weight.

### 4.12. Access to basic data

1. The data lie complete in private repositories, with Turtle per regest and stage under `runs/`.
2. Public access is missing. The rights no longer stand in the way since the clarification under CC BY 4.0, but the repositories are private and visibility and publication remain the operator's decision.
3. Each regest should carry a link to its data, and the whole package should lie in the repository and on Zenodo.
4. Applies without restriction.

### 4.13. Rights and licences

1. The regesta database of Regesta Imperii is under CC BY 4.0. The register file is byte-identical with the public file in the RI Lab repository, and the regest file follows the documented export schema without an identical public copy having been found ([Edition plan](https://github.com/chpollin/regesta-rdf-demo/blob/f65887c/knowledge/edition-plan.md), Rights). Code is MIT, text and data of the edition CC BY 4.0, fonts under OFL with enclosed texts (`fonts/*-OFL.txt`).
2. The live imprint has not yet been checked in a browser, because automated access is blocked. The interface's action layer and the README still carried the state before the clarification at this date. The terms of the digitised book pages are unchecked.
3. The edition should attribute RI with licence link, source link and a statement of modification, say that factoids are project results and not statements of RI, link third-party images instead of embedding them, and state the rights per part, regest text, statements, ontology and code. The Fontane review shows how a restrictive licence determines reusability in a review (RIDE 16, 2023, para. 33 and 38).
4. Applies without restriction. It no longer blocks publication once the imprint check has been made.

### 4.14. Additional features

1. Evidence binding with underlining at word level, review state per regest, the case of Adela's fathers of the same name in timeline, graph and reading view, prose years as open diamonds on the timeline, eight relation sectors, the rotatable space view (route `#/raum`, `space-view.md`).
2. The benefit is not tested with scholarly users, and the space view is a candidate whose design the [Edition plan](https://github.com/chpollin/regesta-rdf-demo/blob/f65887c/knowledge/edition-plan.md) grounds in the space-time cube literature.
3. Each special view should be justified on the method page by the task it supports. An acceptance function for historians (US08) would be the actual distinguishing feature.
4. Applies.

### 4.15. Documentation and associated texts

1. Help texts sit behind question marks in the holdings view (`design.md`). Internally project, data, model and technology are fully documented.
2. Introduction, help system, source description and editorial principles are missing publicly.
3. About and method pages should explain source, selection, editorial principles and technical implementation and give for each stage the LLM, the guidelines and the data model as well as the check and its checker.
4. Applies without restriction.

### 4.16. Long term use

1. Git versioning with byte-exact preservation of the inputs and frozen contracts (`.gitattributes`, manifests), plus dated backups in Google Drive ([Project](project.md), Locations).
2. Archiving of the basic data, institutional support and a plan for permanent access are missing. The status as a teaching experiment is not recognisable to readers.
3. The edition should state its status, closed or ongoing, archive each release with its data and name a host for hosting and maintenance. The static build keeps the maintenance effort low.
4. Applies without restriction.

## 5. Conclusion

### 5.1. Terminology

1. The project calls itself an assertive edition. It formalises statements of an existing regesta work with evidence binding and review state, and the edition plan names the genre as an assertive edition on the basis of RI IV,2 ([Edition plan](https://github.com/chpollin/regesta-rdf-demo/blob/f65887c/knowledge/edition-plan.md), Title and genre).
2. Under the catalogue's narrow definition, a critical representation of historical documents or texts, the project edits no historical documents. A review would therefore probably classify it as an indexing layer over a printed edition, a class that the catalogue explicitly names as often not an edition in the narrow sense (Sahle et al., 2014, Scope).
3. The edition should name its genre openly and justify where the editorial achievement of the statement layer lies, namely in a rule-guided, evidenced and checked reading of the regesta.
4. Applies and is decisive for the classification.

### 5.2. Realisation of aims

1. The self-set aims of the teaching experiment are reached with evidence, with separate stages, frozen contracts, evidence checking and stated limits.
2. Aims of a public edition are not yet formulated as measurable aims.
3. The edition should name checkable aims, for example every statement with evidence, every statement with review state and a human-verified reference subset with a measured error rate.
4. Applies.

### 5.3. Fulfillment of general requirements

1. „State what you do and act accordingly“ is strongly fulfilled internally, because rules are frozen and enforced technically. Transparency exists in the repository.
2. „Keep to the common scholarly standards“ is open, because no historian has checked a statement. Citability is missing entirely.
3. The edition meets the basic requirements only with public documentation, a human-verified subset and citable addresses.
4. Applies without restriction.

### 5.4. Contribution of the SDE to scholarship

1. For digital scholarly editing the contribution lies in the staged, evidenced provenance of agentically produced statements with retained errors, reviews and corrections (`runs/factoid-2026-11-11/`).
2. The contribution to Staufer history cannot be determined without a research question and acceptance.
3. The method page should state both contributions separately and claim the historical one only after acceptance.
4. Applies.

### 5.5. Particularities

1. Retained stages of extraction, review, adjudication and correction, `rf:verificationStatus` per factoid, identity only per regest without merging, the same producer attribution as in the GOSSIP project ([Factoid model](factoid-model.md), Contact with GOSSIP).
2. Nothing is missing in the sense of the criterion.
3. The About page should present these features as a methodological contribution.
4. Applies.

### 5.6. Usability, usefulness, quality

1. Implementer checks in Chromium at several widths and colour schemes (interface `journal.md`). Scholarly quality is unmeasured.
2. No user test, no screen reader check, no measured error rate.
3. A user test with historians and a measurement on the reference subset should precede publication.
4. Applies.

### 5.7. Suggestions for improvement

1. Open points are collected in the journals, in the [Edition plan](https://github.com/chpollin/regesta-rdf-demo/blob/f65887c/knowledge/edition-plan.md) and in the expert questions of [Factoid model](factoid-model.md).
2. What is still to come is not recognisable publicly.
3. A page on the state of the edition should name open questions and the next extension.
4. Concerns mainly the review. The edition can support it with a visible state.

## DH2027 workshop, fitness of the project as workshop edition

The proposal „LLMs and AI Agents in Digital Scholarly Editing. Reviewing Editions, Evaluating Workflows“ (`dh2027-ide-workshop/40_output/workshop-proposal.md`) provides for one small edition produced by agents, which participants review with the IDE criteria and evaluate against a reference. The study read the proposal in its state of the afternoon of 2026-11-11. The decision list of the workshop repository carried the Barbarossa regesta as an open variant, with the proposal text unchanged until the plan (`dh2027-ide-workshop/knowledge/decisions.md`, last entry at that time).

### What speaks for the project

- The interface was built by a Claude Code subagent (`journal.md`, entry First slice). The proposal states that it found no evaluation and no review of an edition interface built by LLMs or agents. The project supplies exactly this case.
- The demand to document per stage the model, guidelines, data model and the check with its checker is largely met. Manifests name LLM and contract hashes, and validation reports, reviews, adjudication and corrections lie separately per stage (`runs/factoid-2026-11-11/`). Only the human check is missing.
- The errors are retained. The extracted stage of the factoid run passes the technical checks (`validation/extracted.json`, `technical_pass: true`) and still contains four errors found by agent reviews. This is the RDF counterpart of the proposal's example „TEI that is valid against the schema but encodes the wrong thing“.
- Two of the six review objects are backed by real cases. Enrichment has the assignment of the complaining Lombards to the register entry of the army in n. 558, data modelling the model gaps of the adjudication and the change from the pilot model to the factoid model.
- A reference is cheaper to obtain than for unedited material. If the workshop introduces a transcription stage from the digitised book pages, the RI regest text is already the reference made by humans. That one printed page carries several regesta is shown by n. 1 and n. 2 with the same page link `page=15` (`generated/aggregations/source-references.csv`).
- The edition tests the catalogue on a genre about which it says little. This fits the proposal's question of where the catalogue does not fit and its finding that no criterion asks about the share of LLMs and agents.

### What speaks against the project, with the contradictions to the proposal text

1. Abstract, „one small edition that LLMs and agents produced from the facsimile to the interface“. The pipeline starts from a supplied CSV ([Architecture](pipeline.md)). No facsimile is input.
2. The edition, „built from about fifty pages of openly licensed facsimiles of unedited material“. The material is edited, namely the published regesta of the Regesta Imperii. Facsimiles exist only as digitised pages of the printed edition, never fetched and with unchecked terms. The regest text is openly licensed under CC BY 4.0 since the rights clarification, the book pages are not established as such.
3. The edition, „An agentic system produces every stage from the images to the interface“. Image stages are missing. Agents produce statements and interface, while exploration and packet preparation are deterministic scripts (`explore_regesta.py`, `prepare_pilot.py`).
4. The edition, „The TEI is generated once by rule from a structured transcription and once directly by an LLM“. The edition plan now generates TEI once by rule from the validated factoids, and an LLM branch does not exist. The sentence is no longer in the proposal text from commit `1c07ce7` of the workshop repository onwards.
5. The edition, „A scholar verifies a subset of the pages against the facsimiles, and this subset serves as the reference“. No subset is human verified yet ([Testing](testing.md)), and the edition plan proposes the twenty regesta of the factoid run. Checking statements against facsimiles is not possible anyway, and it would have to run against the regest text.
6. The edition, „All recorded errors are left by the workflow itself“. The project corrects errors found in a revised stage (`revised/corrections.json`). This becomes compatible only if the workshop counts the correction as part of the workflow, which the decision to show the revised stage with the extracted stage for comparison supports.
7. The six review objects of the proposal. Layout recognition and transcription drop out entirely without an image stage, and TEI encoding applies to the TEI generated by rule, which renders the RDF. Interface applies, but the proposal's example „a search that silently returns nothing“ does not, because there is no search yet.
8. Decisions, „The workshop edition is built in one model configuration“. The repository holds two runs with two LLMs (`gpt-6.1-terra`, `claude-opus-5-5`) and two data models. Since the factoid model is the only model and the pilot is archive, the edition can meet the condition if the run over the slice uses the configuration of the factoid run. The sentence is no longer in the proposal text from commit `1c07ce7` of the workshop repository onwards.
9. Instructors and materials, „All workshop materials, including the edition [...] are published under CC BY 4.0 after the workshop“. With the regesta database under CC BY 4.0 this is compatible, provided attribution and the statement of modification are kept. The interface's action layer still carries the older publication ban at this date.
10. Audience and abstract, a review „with the criteria of the Institut für Dokumentologie und Editorik“. The audience knows digital editions and thus above all TEI. A review of CIDOC CRM factoids requires a different technical qualification, and under criterion 5.1 even the classification as an edition is contested. This can enrich the discussion, but it moves the workshop's subject away from the pipeline from image to edition.

### Conclusion for the workshop

In the wording of the proposal the project does not fit as workshop edition, because facsimile input and unedited material are missing. Two paths can probably be derived from this. Either the proposal changes subtitle and edition to „from the regest text to the interface“, drops layout recognition and transcription and reads TEI encoding as the TEI rendered from the RDF, or the project gets a preceding stage from the digitised book pages via LLM transcription to the regest text, checked against the RI text as reference. The second path provides an image stage and a reference, but still violates „unedited material“ and requires clarifying the image rights with the digitisation centre. In both cases the human-verified subset remains the condition without which neither the edition nor the workshop has a reference. The edition is a candidate for the workshop edition, and the operator rereads the proposal text himself ([Edition plan](https://github.com/chpollin/regesta-rdf-demo/blob/f65887c/knowledge/edition-plan.md), DH2027 workshop).

## Sources

Sahle, Patrick, in collaboration with Georg Vogeler and the members of the IDE (2014): Criteria for Reviewing Scholarly Digital Editions, version 1.1. https://www.i-d-e.de/publikationen/weitereschriften/criteria-version-1-1/, read in the Markdown version `dh2027-ide-workshop/10_markdown/documents/ide-criteria-editions-1-1.md`.

RIDE 16 (2023): Theodor Fontane's Notebooks. A 'Digital Genetic-Critical and Commented Edition'. Review by three reviewers of the Austrian Academy of Sciences. https://doi.org/10.18716/ride.a.16.4, read in `dh2027-ide-workshop/10_markdown/documents/ride-review-fontane-notebooks-2023.md`.

The RIDE page on the criteria (`ride-criteria-page.md`) asks reviewers for a questionnaire that largely covers the catalogue, without every point having to appear in the text. The FAIR guidance for editions linked there was not read, nor the questionnaire itself or the catalogues for text collections and tools. The curation of 2026-11-11 checked the cited catalogue passages (Scope, Application, note 3) and the proposal quotations against the files named above.
