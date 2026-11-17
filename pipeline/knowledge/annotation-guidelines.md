---
title: Annotation guidelines
project:
  name: Regesta RDF Demo
  repository: https://github.com/chpollin/regesta-rdf-demo
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
status: draft
language: en
created: 2026-11-09
updated: 2026-11-09
---

# Annotation guidelines

This pilot applies the frozen [domain ontology](domain-ontology.md) to source-supported kinship, economic and legal information. The whole output is an unaccepted candidate graph. A source link does not make directly asserted triples epistemically neutral. No candidate is added to an accepted historical graph by this run.

## Source boundary

Read the whole assigned packet. Extract evidence only from `summary_plain`. The raw summary permits inspection of markup. The dating prose supplies lexical record context, not automatic event or relationship bounds. Machine dates may disagree with prose. Register labels supply identity candidates only. Their biographical details are not evidence for a claim from this regest. Do not extract diplomatic production, seal, scribal or bibliographic details. Do not model military movement alone. No external research or inferred genealogy.

One regest can contain earlier events, a present confirmation and future or conditional provisions. Negotiation about a marriage does not establish marriage. A legal grant, prohibition or claim does not establish actual performance, possession or a paid amount. Distinguish source wording from normalized interpretation. Skip formulaic Z. witness lists in the diplomatic apparatus. Include witnesses giving testimony in the narrated dispute.

## Candidate RDF contract

Use only the predicates/classes in `ontology/regesta-core.ttl`, the listed CRM terms below, RDFS labels, and types/roles from `ontology/vocabulary.ttl`. No schema additions, sameAs, invented dates or identity merges.

- Reuse CRM E21 Person, E74 Group, E7 Activity, E5 Event, E30 Right, E18 Physical Thing, E53 Place, E52 Time-Span, E31 Document, E13 Attribute Assignment and E55 Type.
- Reuse P2 has type, P3 has note, P4 has time-span, P7 took place at, P11 had participant, P14 carried out by, P75 possesses, P152 has parent, P140 assigned attribute to, P141 assigned and P177 assigned property of type.
- Local RelationshipState represents a contiguous relationship duration, never the mere date of its mention. Participation uses context, actor and role. Its E1 superclass does not imply activity or responsibility.
- A right is an E30 node. A right-holding state concerns the concrete right; its holder is represented through Participation. A legal act may concern that right without asserting a holding state.
- Keep conditions and exceptions as exact textual literals where the core cannot express their logical scope. Preserve monetary expressions as text rather than inventing units or converting currency.
- A complete Participation has one context, actor and role. If the text only establishes an unnamed actor, create an explicitly unnamed local actor. Do not invent missing participants or force every state to have two named people.
- Use P14 only for an explicit responsible performer. A judge may perform a judgment. Royal presence alone does not establish that role.
- Preserve hard-to-model details as a source-supported note and report the modelling gap. Do not force them into the nearest property.

## Evidence and projection

For each substantive extracted relation or event classification, create an E13 assertion using P140 (subject), P177 (predicate IRI), P141 (IRI object), reg:source (the packet source IRI) and reg:evidence (an exact, contiguous, case-sensitive substring of summary_plain). Also include the asserted triple in this candidate file so it can be queried and validated. This projection is explicitly provisional. Labels and technical provenance need not each have an E13. Source evidence for an event classification may cover its immediate role structure; give extra assertions where different passages support different roles.

Do not use P141 with literals in this pilot. Text conditions/exceptions can be attached to a supported candidate event/state; their literal presence does not create a logical inference. Exact source field and derivative hash are fixed in the packet manifest. Reviewer feedback and operator acceptance remain separate from these assertions.

## Identity and files

Source IRI: `urn:regesta:record:UID`.
Prefer `urn:regesta:actor:REGISTER_ID` for a clearly matched person in the packet. The common ruler candidate is supplied consistently. For institutions whose index entry mixes location and community, use `urn:regesta:actor:REGISTER_ID:community` and keep it separate from a place. A register entry is a source item, not an owl:sameAs target.

For a named or unnamed actor not safely matched, use `urn:regesta:actor:UID:local:SLUG`. Use `urn:regesta:UID:SLUG` for events, states, assertions and objects. Labels follow the source. A local actor must not silently be treated as globally reconciled.

Write one UTF-8 Turtle file per UID. Also write a per-batch JSON report with one entry per assigned UID, status `extracted`, `no_in_scope_claim` or `error`, files, unresolved identities and ontology gaps. Failure and abstention are explicit.

## Review boundary

A reviewer reports record-specific unsupported assertions, missing scope conditions, wrong roles, temporal overreach, identity errors and missing in-scope claims. It does not alter the ontology or the extraction. Correction is a separate retained stage. Expert acceptance belongs to the operator.

