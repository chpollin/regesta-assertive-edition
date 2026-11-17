---
title: Domain ontology
project:
  name: Regesta Assertive Edition
  repository: https://github.com/chpollin/regesta-assertive-edition
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
status: archived
language: en
created: 2026-11-09
updated: 2026-11-11
---

# Domain ontology

The pilot run `pilot-2026-11-09` used a frozen, provisional CIDOC CRM application profile for source-attested kinship, economic and legal information. Its executable declarations are [regesta-core.ttl](../pipeline/ontology/regesta-core.ttl). Since 2026-11-11 the profile is archive, kept so that the pilot stays checkable, and the [Factoid model](factoid-model.md) is the only model. Its findings below led to the factoid model.

## Scope

Represent actors, context-bound roles, relationship states and events that establish, confirm, contest or end them. Preserve concerned rights or objects, conditions, exceptions and temporal qualifications. One regest can report several differently dated acts. Co-mention establishes no relationship. Diplomatic description and formulaic witness lists fall outside the pilot scope.

The pilot reads summary_plain only. Register entries supply identity candidates. Their biographical labels and the editorial commentary cannot add historical facts. [Data](source-data.md) defines the source fields. [Annotation guidelines](annotation-guidelines.md) fix the extraction contract.

## Formal core

| Declaration | Alignment and purpose |
|---|---|
| reg:RelationshipState | Subclass of crm:E2_Temporal_Entity for qualified states such as marriage or a right-holding state |
| reg:Participation | Subclass of crm:E1_CRM_Entity connecting an actor, context and role |
| context, actor, role | Context-bound participation with E2, E39 and E55 ranges |
| concerns | Connect an E2 context to the E1 entity concerned |
| establishes, terminates | Connect E5 events to relationship states |
| condition, exception | Preserve source qualifications as literals |
| source, evidence | Connect E13 attribution to E31 source identity and exact source text |

The two classes and ten properties have scope notes, domain and range in the Turtle core. RDFS domain and range express entailments. The separate [SHACL profile](../pipeline/ontology/pilot-shapes.ttl) expresses validation constraints.

CRM classes and predicates are reused directly. P152 expresses stated parenthood without inventing a birth or asserting biological parenthood. E8 Acquisition is reserved for a change of ownership of physical things. It cannot serve as the generic class for medieval rights grants.

Each historical assertion is represented through E13, P140, P177 and P141, with a source and exact evidence substring. The local source predicate is deliberately weaker than CRM P16. Direct triples are a candidate projection for inspection and querying. Their presence does not constitute expert acceptance.

[Controlled terms](../pipeline/ontology/vocabulary.ttl) classify states, acts and roles through E55. They are provisional vocabulary entries rather than additional local ontology classes. Namespaces remain placeholders.

## Findings requiring another model iteration

The [pilot review](../pipeline/runs/pilot-2026-11-09/review/review-revised.json) and [final correction check](../pipeline/runs/pilot-2026-11-09/review/root-correction-check.json) identify concrete limits.

- A right-holder role is missing. A source-supported P75 statement can preserve possession of a right but cannot supply the missing contextual holder role.
- Addressees require their own role. Addressing a request to someone does not by itself establish participation in the mission.
- Future officeholders need a representation of an office-dependent actor rather than invented individual identities.
- Earlier grants, later confirmations and promises require distinct acts and temporal qualifications.
- An uncle relationship cannot justify an invented genealogical chain. The pilot retains the source wording.
- Amounts and historical units remain text. Unit normalisation requires a separate researched contract.

The frozen artefacts remain unchanged. The factoid model was drawn up after these findings under its own recorded baseline in `contracts/factoid-2026-11-11/`.

## Sources

The supplied CSV records are the historical evidence, with source addresses preserved in the packets. The earlier modelling step read the relevant complete CRM 7.1.3 scope notes for [P152](https://cidoc-crm.org/html/cidoc_crm_v7.1.3.html#P152) and [E8](https://cidoc-crm.org/html/cidoc_crm_v7.1.3.html#E8). The full CRM specification was not read, and formal CRM conformance has not been established.
