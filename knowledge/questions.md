---
title: Questions to the data
status: draft
language: en
created: 2026-11-09
updated: 2026-11-09
---

# Questions to the data

These are the requirement side of the interface. Each question is phrased the way a historian would ask it, names the research task it stands for, and keeps the SPARQL that `build_data.py` actually executed with rdflib over the revised Turtle files of `pilot-2026-11-09`. The visualisations are the answer side. The operator decided on 2026-11-09 that the questions are no longer an interface of their own.

The results below are a dated finding of the pilot run on 2026-11-09. The executed rows live in `data/questions.json`; the query texts here were copied from that file.

## Welche Ehen werden geschlossen, bestehen oder werden aufgelöst?

Task: Find every marriage the regesta attest, and keep its conclusion, its existence and its dissolution apart (US04, US07).

Finding on 2026-11-09: Three regesta: n. 103a (an existing marriage of Eufemia and Heinrich von Hegilen, carried by Spouse roles), n. 46 (conclusion, Adela and Friedrich) and n. 167 (dissolution, Adela and Friedrich). The marriage negotiation in n. 3077 does not appear, which is the behaviour the annotation contract demands.

Answered by: Partly. The person graph shows the conclusion and the dissolution as act nodes connected to Adela and Friedrich, and the reading views carry the evidence. No view yet sets marriages apart as their own selection.

```sparql
PREFIX crm: <http://www.cidoc-crm.org/cidoc-crm/>
PREFIX reg: <https://example.org/regesta/ontology/>
PREFIX v: <https://example.org/regesta/vocab/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?rec ?assertion ?event ?type ?partner ?partnerName ?evidence WHERE {
  GRAPH ?g {
    ?assertion a crm:E13_Attribute_Assignment ;
        crm:P140_assigned_attribute_to ?event ;
        crm:P177_assigned_property_of_type crm:P2_has_type ;
        crm:P141_assigned ?type ;
        reg:source ?rec ;
        reg:evidence ?evidence .
    VALUES ?type { v:MarriageConclusion v:Marriage v:MarriageDissolution }
    OPTIONAL {
      { ?event crm:P11_had_participant ?partner }
      UNION
      { ?part reg:context ?event ; reg:role v:Spouse ; reg:actor ?partner }
      ?partner rdfs:label ?partnerName .
    }
  }
}
ORDER BY ?rec ?event ?partnerName
```

## Welche Eltern-Kind-Beziehungen nennen die Regesten?

Task: Collect the stated parent relations as a basis for kinship, without inventing genealogy (US04).

Finding on 2026-11-09: Seven P152 statements in n. 3166a, n. 46, n. D101, n. 167, n. 545 and n. 3077 (twice).

Answered by: Yes, the person graph. Parent relations are its solid edges, and every edge leads to its statement in the reading view.

```sparql
PREFIX crm: <http://www.cidoc-crm.org/cidoc-crm/>
PREFIX reg: <https://example.org/regesta/ontology/>
PREFIX v: <https://example.org/regesta/vocab/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?rec ?assertion ?child ?childName ?parent ?parentName ?evidence WHERE {
  GRAPH ?g {
    ?assertion crm:P177_assigned_property_of_type crm:P152_has_parent ;
        crm:P140_assigned_attribute_to ?child ;
        crm:P141_assigned ?parent ;
        reg:source ?rec ;
        reg:evidence ?evidence .
    ?child rdfs:label ?childName .
    ?parent rdfs:label ?parentName .
  }
}
ORDER BY ?rec ?childName ?parentName
```

## Personen mit mehreren Elternteilen gleichen Namens

Task: Locate identities the graph keeps apart although the source names them the same, as a prompt for expert identity decisions (US03, US08).

Finding on 2026-11-09: One row: Adela (RI004-002-A000306) has the parents urn:regesta:actor:RI004-002-T000162 from n. 46 and urn:regesta:actor:22794:local:diepold from n. 167, both labelled "Markgraf Diepold von Vohburg".

Answered by: Yes, all three. The timeline draws the pair as the dashed red arc between n. 46 and n. 167, the person graph as two nodes of the same name joined by a dashed red line, and both reading views as the cross reference with both identifiers and register entries.

```sparql
PREFIX crm: <http://www.cidoc-crm.org/cidoc-crm/>
PREFIX reg: <https://example.org/regesta/ontology/>
PREFIX v: <https://example.org/regesta/vocab/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?child ?childName ?name ?parentA ?parentB ?recA ?recB ?assertionA ?assertionB WHERE {
  ?assertionA crm:P177_assigned_property_of_type crm:P152_has_parent ;
      crm:P140_assigned_attribute_to ?child ;
      crm:P141_assigned ?parentA ;
      reg:source ?recA .
  ?assertionB crm:P177_assigned_property_of_type crm:P152_has_parent ;
      crm:P140_assigned_attribute_to ?child ;
      crm:P141_assigned ?parentB ;
      reg:source ?recB .
  FILTER (STR(?parentA) < STR(?parentB))
  GRAPH ?gA { ?parentA rdfs:label ?name . ?child rdfs:label ?childName . }
  GRAPH ?gB { ?parentB rdfs:label ?name . }
}
ORDER BY ?childName ?name ?parentA ?parentB
```

## Wer tritt in welcher Rolle auf?

Task: See who acts in which role in disputes, transactions and legal acts (US04, US06).

Finding on 2026-11-09: Sixteen role statements, among them witnesses (n. 103a), claimants (n. 167), buyer and seller (n. 545), payer and payee (n. 1986), pledgor and pledgee (n. 2186) and an obligated army (n. 3276).

Answered by: Yes, the person graph. Act nodes are connected to the actors who take part in them; selecting an actor lists each role with its act and regest in the panel, and the text list under the graph names every role.

```sparql
PREFIX crm: <http://www.cidoc-crm.org/cidoc-crm/>
PREFIX reg: <https://example.org/regesta/ontology/>
PREFIX v: <https://example.org/regesta/vocab/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?rec ?assertion ?actor ?actorName ?role ?context ?contextType ?evidence WHERE {
  GRAPH ?g {
    ?assertion crm:P177_assigned_property_of_type reg:role ;
        crm:P140_assigned_attribute_to ?part ;
        crm:P141_assigned ?role ;
        reg:source ?rec ;
        reg:evidence ?evidence .
    ?part reg:actor ?actor ; reg:context ?context .
    ?actor rdfs:label ?actorName .
    OPTIONAL { ?context crm:P2_has_type ?contextType }
  }
}
ORDER BY ?rec ?role ?actorName
```

## Welche Rechte nennen die Regesten, und welcher Vorgang betrifft sie?

Task: Find the rights the regesta name and the act that grants, confirms or regulates them (US04, US06).

Finding on 2026-11-09: Six rights in n. 67 (jurisdiction, market, minting, toll), n. 69 (investiture, held by the bishop of Bamberg) and n. 545 (advocacy).

Answered by: Only in the reading view, where each right is folded into the sentence of the act that concerns it. No overview visualisation of rights exists yet.

```sparql
PREFIX crm: <http://www.cidoc-crm.org/cidoc-crm/>
PREFIX reg: <https://example.org/regesta/ontology/>
PREFIX v: <https://example.org/regesta/vocab/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?rec ?assertion ?right ?rightType ?rightLabel ?act ?actType ?holderName ?evidence WHERE {
  GRAPH ?g {
    ?assertion crm:P140_assigned_attribute_to ?right ;
        crm:P177_assigned_property_of_type crm:P2_has_type ;
        crm:P141_assigned ?rightType ;
        reg:source ?rec ;
        reg:evidence ?evidence .
    ?right a crm:E30_Right .
    OPTIONAL { ?right rdfs:label ?rightLabel }
    OPTIONAL { ?act reg:concerns ?right . OPTIONAL { ?act crm:P2_has_type ?actType } }
    OPTIONAL { ?holder crm:P75_possesses ?right ; rdfs:label ?holderName }
  }
}
ORDER BY ?rec ?rightType ?act
```

## Welche Vorgänge beziehen sich auf einen anderen Vorgang?

Task: Tell earlier acts from later confirmations and assurances that refer to them (US06).

Finding on 2026-11-09: Four relations: the confirmation and the assurance of the pledge in n. 2186, the confirmation of the judgment in n. D101 and the mission concerning the Trier election dispute in n. 3166a.

Answered by: Only in the reading view, where the later act reads "betrifft Verpfändung". No overview visualisation yet.

```sparql
PREFIX crm: <http://www.cidoc-crm.org/cidoc-crm/>
PREFIX reg: <https://example.org/regesta/ontology/>
PREFIX v: <https://example.org/regesta/vocab/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?rec ?assertion ?act ?actType ?earlier ?earlierType ?evidence WHERE {
  GRAPH ?g {
    ?assertion crm:P177_assigned_property_of_type reg:concerns ;
        crm:P140_assigned_attribute_to ?act ;
        crm:P141_assigned ?earlier ;
        reg:source ?rec ;
        reg:evidence ?evidence .
    { ?earlier a crm:E7_Activity } UNION { ?earlier a crm:E5_Event }
    OPTIONAL { ?act crm:P2_has_type ?actType }
    OPTIONAL { ?earlier crm:P2_has_type ?earlierType }
  }
}
ORDER BY ?rec ?act
```

## Welche Vorgänge stehen unter einer Bedingung oder einer Ausnahme?

Task: Keep conditions and exceptions in view, which the model holds as literals only (US04).

Finding on 2026-11-09: Six literals in n. 69, n. 1088, n. 2186 and n. 2594. They are graph text without logical scope, and some are agent paraphrases rather than verbatim wording.

Answered by: Only in the reading view, as notes under the act. No overview visualisation yet.

```sparql
PREFIX crm: <http://www.cidoc-crm.org/cidoc-crm/>
PREFIX reg: <https://example.org/regesta/ontology/>
PREFIX v: <https://example.org/regesta/vocab/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

SELECT ?rec ?context ?contextType ?kind ?wording WHERE {
  GRAPH ?g {
    ?rec a crm:E31_Document .
    { ?context reg:condition ?wording . BIND("Bedingung" AS ?kind) }
    UNION
    { ?context reg:exception ?wording . BIND("Ausnahme" AS ?kind) }
    OPTIONAL { ?context crm:P2_has_type ?contextType }
  }
}
ORDER BY ?rec ?context ?kind ?wording
```

## Questions without a visualisation

Rights and the acts that concern them, references between acts, and conditions and exceptions are answered only inside single reading views. A view across regesta would need a decision on what historians compare there, which belongs to the expert interview.
