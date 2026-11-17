---
title: Annotation guidelines, factoid run
status: draft
language: en
created: 2026-11-11
updated: 2026-11-11
---

# Annotation guidelines, factoid run

These guidelines bind the extraction of the run `factoid-2026-11-11`. They apply the draft ontology `ontology/regesta-core.ttl` and the SKOS vocabulary `ontology/vocabulary.ttl` of this contract folder. Everything produced is an unaccepted candidate. A factoid records what a passage of the regest says, read by a named producer. It is never a claim about what happened.

## Source boundary

Read the whole packet. Take every statement and every quoted wording from `summary_plain` only. Register candidates in the packet serve to identify actors and supply no facts. Their labels, the commentary and the dating prose add nothing to a factoid. Skip formulaic witness lists (`Z.:`), chancery notes, seal and script descriptions. Military movement alone, travel, and hostage taking are out of scope unless the passage also states a kinship, economic or legal relation. No external research and no inferred genealogy.

## Unit of a factoid

One factoid per passage that states one act or one state. A passage is usually a clause. Several roles of one act stay in one factoid as several references. Typical cases:

- A donation with provisions is one main `rf:ActFactoid`. Each provision that grants, regulates or reserves something is its own factoid with `rf:partOf` to the main act.
- A confirmation of an earlier act gives two act factoids, the earlier act and the confirmation, joined by `rf:refersToAct` from the confirmation. The earlier act gets no date, and `rf:qualifier` keeps a temporal word such as `nachträglich` or `vorher` in its exact wording.
- A promise, prohibition or provision is an act of enactment. It does not establish its later performance, payment or possession.
- A negotiation about a marriage is a `rv:Negotiation`. It never becomes a marriage.
- A request or a mission keeps its addressees as references with `rv:Addressee`. Being addressed is not participation in the outcome.
- A stated parent relation is a `rf:StateFactoid` of type `rv:Parenthood` with one `rv:Parent` and one `rv:Child` reference. Other kinship words (Oheim, Bruder, Witwe) give `rv:Kinship` or `rv:Marriage` with the exact kinship word in `rf:qualifier`. Never build a chain of relations from a degree of kinship.
- A divorce keeps the reason the regest gives in `rf:ground`, in its exact wording.

## Factoid content

Every factoid has exactly one `rf:factoidType` from the act or state scheme matching its class, one `rf:source` (the packet's source IRI, typed `crm:E31_Document`), one or more `rf:evidence` selectors, `prov:wasAttributedTo` the producer IRI given in the task, and `rf:verificationStatus rv:unchecked`.

- Evidence is `[ a oa:TextQuoteSelector ; oa:exact "..." ]`, where the exact text is a contiguous, case-sensitive substring of `summary_plain` that supports the whole factoid. Use the shortest passage that carries type and roles. Add a second selector only where a role rests on a different passage.
- Each reference is `[ a rf:Reference ; rf:actor <IRI> ; rf:role rv:… ; rf:nameInSource "..." ]`. The name in source is the exact wording naming the actor in this passage, a substring of `summary_plain`.
- `rf:concerns` points to the right, thing, place or community the factoid is about. A right is a node `a crm:E30_Right` with `crm:P2_has_type` a concept of `rv:RightTypes` and an `rdfs:label` in the source's words. A thing or estate is `crm:E18_Physical_Thing`, a place `crm:E53_Place`, each with an `rdfs:label`.
- Conditions, exceptions, reasons, amounts and qualifiers are literals in the exact wording of `summary_plain` (`rf:condition`, `rf:exception`, `rf:ground`, `rf:amount`, `rf:qualifier`). Do not paraphrase them. Where only a paraphrase would capture a detail, leave it out and report the gap.

## Actors and identity

- An actor named in this regest whose register candidate in this packet matches by name and title gets `urn:regesta:actor:REGISTER_ID`, typed `crm:E21_Person` or, for a community, `urn:regesta:actor:REGISTER_ID:community` typed `crm:E74_Group`. Use only the candidates of the packet in which the passage stands. Never carry an identification over from another packet.
- The ruler uses the shared ruler IRI of the packet.
- An actor without a matching candidate gets `urn:regesta:actor:UID:local:SLUG`. An actor determined by office or function (der jeweilige Erzbischof, der kanonisch gewählte Nachfolger) is `a rf:FunctionalActor` with a local IRI, labelled with the source wording. Where the passage names an individual holder too, give that holder its own reference.
- Every actor carries an `rdfs:label` in the wording of the source. No `owl:sameAs`, no identity merges, no statements that two actors are different.

## Identifiers and files

Factoids, references, rights and things get `urn:regesta:UID:SLUG`. Write one UTF-8 Turtle file per UID and one batch report JSON listing each assigned UID with status `extracted`, `no_in_scope_claim` or `error`, the files, unresolved identities and model gaps. An abstention writes a Turtle file containing only the source document node.

## Review boundary

A reviewer reports unsupported factoids, missing in-scope passages, wrong identities or roles, temporal overreach, collapsed acts, paraphrased literals and lost conditions or exceptions. It does not change the ontology or the files. Correction is a separate, retained stage. Expert acceptance belongs to the operator.
