---
title: Factoid model
project:
  name: Regesta Assertive Edition
  repository: https://github.com/chpollin/regesta-assertive-edition
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
status: draft
language: en
created: 2026-11-11
updated: 2026-11-17
---

# Factoid model

The factoid model is the project's only data model. It started as a named variant beside the pilot model of [Domain ontology](domain-ontology.md) and was decided on 2026-11-11 as the only model, with the pilot model and the run `pilot-2026-11-09` kept unchanged and checkable as archive. Its frozen contract is [contracts/factoid-2026-11-11](../pipeline/contracts/factoid-2026-11-11/), used with identical hashes by the run `factoid-2026-11-11` and by the run `factoid-1153-2026-11-11` over the edition slice ([Edition plan](https://github.com/chpollin/regesta-rdf-demo/blob/f65887c/knowledge/edition-plan.md), Data scope).

## Decision and its ground

On 2026-11-11 the Research Coordination decided, on the operator's general word to implement well-founded decisions, that the new run stores statements as factoids. The decision is reversible and the operator can change it. It rests on a read of the CIDOC CRM 7.1.3 specification and of the factoid prosopography literature, kept in the coordination's session notes.

- E30 Right is defined generically ("legal privileges concerning material and immaterial things or their derivatives") and fits medieval rights such as investiture, advocacy and revenues. It stays the class of a right.
- CRM restricts the object of a right to E72 Legal Object, which excludes persons, groups and offices, and P75 possesses carries no time, condition or succession. Rights over an abbot or over dependants are therefore weak in plain CRM.
- The pilot already wraps each triple in an E13 Attribute Assignment and is in substance a fine-grained factoid model. Its direct candidate triples count, by the E13 scope note, as the opinion of the team maintaining the graph, which contradicts their unaccepted status.

## Model

A factoid records what one passage of a regest says, read by a named producer. It is not a claim about what happened.

- `rf:Factoid`, subclass of `crm:E13_Attribute_Assignment`, with `rf:ActFactoid` for acts and `rf:StateFactoid` for states.
- Each factoid has a type from the SKOS vocabulary, the regest as source, an evidence passage as `oa:TextQuoteSelector`, the producer through `prov:wasAttributedTo` and `rf:verificationStatus rv:unchecked`.
- `rf:Reference` holds one mention of an actor with its role and its wording in the source (`rf:nameInSource`). Actors are register entries of the regest's own packet, the shared ruler, regest-local actors or `rf:FunctionalActor` for an office-bound actor.
- `rf:partOf` binds provisions to a main act, `rf:refersToAct` a confirmation or assurance to an earlier act of the same regest.
- Conditions, exceptions, reasons, amounts and qualifiers are literals in the exact wording of the regest.
- No direct projection triples. A query view can be derived as a separate graph.

The vocabulary has schemes for act types, state types, roles, right types and status. Its definitions and the grouping of right types are drafts of an LLM agent and unchecked. Investiture and advocacy link to GND subject headings with `skos:closeMatch`.

## Identity across regesta

Actor IRIs are minted from the Regesta Imperii register ID (`urn:regesta:actor:RI004-002-F000471`), so a register entry that appears in several regesta is one node once the per-regest files are loaded into one graph. In the revised stage of `factoid-1153-2026-11-11` this joins a minority of the register actors across regesta, the ruler most often, then Pope Eugene III, Wibald of Stablo and bishops (count of 2026-11-17 over `revised/*.ttl`). Regest-local actors (`:local:`) stay unjoined. The identity is therefore the register's assignment, adopted as it stands. The project does not merge actors itself, and an error of the register becomes an error of the graph. The sentence on Adela's father below describes this: the data repeat what the register says per regest.

## Proposed extensions

Proposals of 2026-11-17, agreed in principle by the operator and not yet built. They make the model say explicitly what it already means, that a factoid is an assertion of an AI agent referred back to its source.

- Describe the producer. `prov:wasAttributedTo` names an extraction batch today. A `prov:SoftwareAgent` per run with LLM, prompt version and date, linked from the batch, makes each assertion traceable to the run that produced it. The values exist in the run manifest.
- Record a human judgement as a second assertion. A later confirmation or rejection by a person with expertise becomes its own node that points to the factoid, names the person and the date, and leaves the agent's factoid and its `rv:unchecked` unchanged. The graph then shows who said what, and the status of a factoid is read from the judgements about it.
- RDF 1.2 triple terms with reifiers express the same pattern directly on a triple. The factoid node remains the form used here, because RDF 1.2 is a Candidate Recommendation and tool support is preliminary ([W3C 2026](https://www.w3.org/TR/rdf12-concepts/)).

## Contact with GOSSIP

The GOSSIP project of the operator models statements in letters after the same pattern (statement, participation with role, SKOS type, text quote evidence, producer, unchecked status) and names a shared vocabulary with this project as open. The factoid run reuses the Web Annotation selector, PROV attribution and the status concept for that reason.

## Open questions for experts

- Is the source of a factoid the modern regest or the medieval charter it summarises?
- A city as a place differs from its political community. Whether the model needs both as separate entities is open.
- What kind of right is the investiture right in RI IV,2,1 n. 69, and does the grouping of right types hold?
- The ruler before whom a dispute is decided has no role of his own. The vocabulary has a judge and a mediator but no presiding lord, so in the 1153 slice the ruler appears in judgments four times as participant, four times as judge and once as mediator, also where the regest separates him (coram rege) from the elected judge (RI IV,2,2 n. 103a). A role such as Gerichtsherr would need a vocabulary change and a new run.
- A judgment names its beneficiary but not the party that loses; the parties stand in the dispute the judgment refers to. Five of the eight judgments that refer to a dispute leave dispute parties out of the judgment itself (n. 103a, n. 75, n. 128, n. 173). Whether the judgment should name the losing party, and with which role, is open.
- Formulaic witness lists are out of scope by the annotation guidelines; 61 regesta of the slice contain witness passages and three carry a witness role from a narrated testimony. Whether the edition wants the witness lists as statements is a scope decision.
- Office holding is extracted only where the office is needed for the statement (ten times in the slice), while about two hundred titled names stand in other roles; so Propst Heinrich in n. 103a has an office holding and Markgraf Engelbert does not. Whether every title in the text should become an office holding is open.
- The agent review of twenty regesta on 2026-11-14 (two independent readings of one LLM per statement, agentic review and no scholarly validation; result in `regesta-assertive-edition/edition/agent-review-2026-11-14.json`) found no statement wrong by both readers; its unclear and contested cases are model questions:
  - Several grants in one regest under `rf:partOf` of a confirmation, while the text sets „gewährt ihm“ beside „bestätigt“ as acts of their own (RI IV,2,1 n. †193, four statements unclear for both readers). Whether a grant named beside a confirmation is part of it or a separate act is open.
  - A predecessor's act recalled by „nach dem Vorgang“ or „wie seine Vorgänger“ is typed as `rv:Grant`, while the text leaves open whether the predecessor granted or confirmed (n. 145, both unclear); several predecessors stand as one act with three issuers, where the text may mean separate acts (n. 116, unclear and wrong).
  - An exchange of goods is typed as `rv:Grant`, which the vocabulary defines as one-sided; the vocabulary has no exchange (n. 96, both unclear).
  - A complaint is typed as Streit oder Klage, whose definition asks for a court or ruler, where the text names none (n. 191, both unclear).
  - Whether „fratres“ in a Latin name list is a recipient of its own or marks the two named before as brothers (n. 116, contested twice), and how far „nämlich“ extends in an enumerated grant (n. 186, contested), are questions of reading the text.
- Adela's father in n. 46 and n. 167 remains open. Register entries are assigned per regest only, so the data show what the register says for each regest and assert neither identity nor difference.
