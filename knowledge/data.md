---
title: Data interface
status: draft
language: en
created: 2026-11-09
updated: 2026-11-11
---

# Data interface

`build_data.py` reads one run of `regesta-rdf-demo` at one stage (`--stage revised`, the default, or `--stage extracted`) and writes two JSON files that the page loads once. The source of truth for every value is the run directory and the two source CSVs. The JSON is a derived, deterministic product, and the same inputs give byte-identical files.

The build reads two data models into the same schema. It detects the model from the RDF of the run, by whether `rf:ActFactoid` or `rf:StateFactoid` nodes occur, and never from the run name. The pilot model (`pilot-2026-11-09`) is read from its revised stage only. The factoid model (`factoid-2026-11-11`, described in `regesta-rdf-demo/knowledge/factoid-model.md`) is mapped as set out under [Factoid model](#factoid-model).

## Inputs

| Input | Use |
|---|---|
| `runs/<run>/manifest.json` | run id, LLM, annotation scope, selected UIDs, contract hashes |
| `runs/<run>/packets/<uid>.json` | `summary_plain`, `identifier`, `date_string`, `locality_string`, `identity_candidates` |
| `runs/<run>/<stage>/<uid>.ttl` | candidate RDF, loaded as one named graph per file into an rdflib Dataset with union default graph |
| `runs/<run>/validation/<stage>.json` | `technical_pass`, `expert_accepted`, per-record `issues` and claim list (pilot) or factoid count (factoid) |
| `runs/<run>/extracted/batch-*.json` | `unresolved_identities`, `ontology_gaps` (pilot) or `model_gaps` (factoid) |
| `runs/<run>/review/*.json` | pilot: review findings, adjudication, revised review and final check; factoid: `review-A.json`, `review-B.json`, `adjudication.json` |
| `runs/<run>/revised/*corrections*.json` | corrections and remaining gaps; factoid: `corrections.json`, read for the revised stage only |
| `contracts/<run>/ontology/vocabulary.ttl` | factoid only: German `skos:prefLabel` of every concept, checked against `contract_sha256` of the manifest |
| `source-material/RI_004-002-ReggBarbarossa.csv` | `sorting` (edition order), `commentary`, `archival_history`, `external_links`, `exchange_identifier` |
| `source-material/RI_004-002-RegisterBarbarossa.csv` | cross-check of the register entries shown for the Diepold case |

## edition.json

```
run       id, model, scope, technical_pass, expert_accepted, validator
regests[] in edition order
  uid, identifier, short, sort
  start, end           machine_start and machine_end of the packet (delivered start_date, end_date)
  proseYears           years the dating prose names outside start..end, e.g. [1149] for "(1147 oder 1149)"
  lead                 whole text up to 180 characters, otherwise its first sentence, never cut
  date, place          markup segments of date_string and locality_string
  text                 summary_plain
  status, technical, claims
  blocks[]             statement groups in text order
    node, kind, title  event, state, right or thing; null for loose lines
    head               line of the P2_has_type assignment, or null
    sentence           readable sentence: strings and phrases {keys, text}; keys name lines
    lines[]
      key              stable key within the regest, used by sentence phrases
      kind             head | line | literal
      rel, phrase      type | performer | participant | role | concerns | parent | possesses
                       (factoid also partOf | refersToAct | evidence)
      folded           {head, notes} of a right or thing folded into this concerns line
      id               E13 local name (a1 ...) or t<n> for verbatim literals, else null
      own              true when the line has its own E13
      inherits         id of the head whose evidence the line rests on
      evidence         {start, end, ambiguous} offsets in text
      text, label      readable German statement; label for literals
      verbatim         literal occurs verbatim in the regest
      triple           projected triple as IRIs (object null for literals)
      status           {asserted, technical, expert}
      turtle           E13 node and projection, for own lines
      crossrefs[]      identity cross references from the question gleichnamige-eltern
      agentNotes[]     unresolved-identity notes placed at this line
  spans[]              {id, start, end} of all evidence ranges
  notes                unresolved, gaps (with stage and lang), corrections, corrected
  history              findings, decisions, revised, final
  apparatus            commentary, transmission, links as markup segments
  register             [id, origLabel] pairs of the register rows for this identifier
delivery  field, total, undated, years [[year, count]] over the whole regest CSV
graph
  nodes[]   actors {id, kind person|group, label, labels[{label, regests}], regests, local, case?, x, y}
            case = {regest, short, register {id, label, assigned} | null} on the parents of a same-name case
            and acts {id, kind act, label, regest, claim, x, y}; x and y in 0..1 from the build-time layout
  edges[]   {source, target, kind role|parent|same-name, label, regest, claim}
```

Every graph edge comes from a triple of the revised Turtle, except the same-name edges, which are the rows of the question on same-name parents. The layout is a fixed-start force layout in `_layout`, deterministic for the same input.

Markup segments are `{t, i?, sup?, regest?, href?}`. The client renders them with `textContent` and never parses HTML. An internal regest link becomes a jump only when its target belongs to the run.

## questions.json

The executed questions. The interface does not read this file; the timeline arc, the graph's same-name edge and the reading-view cross references are derived from it at build time, and [questions.md](questions.md) documents it.

```
run, rdflib
questions[]
  id, title
  sparql      prefixes and query text exactly as executed
  variables   SELECT variables
  result      raw rows as executed, strings or null
  columns     German column heads
  rows        display cells: string | {regest, claim, label} | {source} | {iri} | {agent}
```

`{source}` cells are checked to be verbatim in the regest of their row. `{agent}` marks a graph literal that is not verbatim.

## Interface translation

`VOCAB_DE` in `build_data.py` gives German display labels for the English labels of the pilot vocabulary. The factoid model brings its own German labels as `skos:prefLabel@de`, and the build uses those. The term itself stays visible in the RDF view of a statement. A vocabulary term without a German label aborts the build.

## Factoid model

The factoid path fills the schema above with these mappings. `run` additionally carries `dataModel: "factoid"` and `stage`.

- One factoid is one block. `kind` is `act` for `rf:ActFactoid` and `state` for `rf:StateFactoid`, `title` and `head` are the German prefLabel of `rf:factoidType`, and `claims` counts factoids, checked against the validation report.
- Each `oa:TextQuoteSelector` gives one span. The first selector in text order carries the factoid's local name as id, further selectors `<name>-2` and so on, each as a line with `rel: evidence`. Every non-literal line of the factoid is `own` with the factoid's id and evidence, and every phrase names the evidence lines too, so pointing at any phrase underlines every passage the factoid rests on.
- The sentence is `<type> [durch <Aussteller>] [mit <Ehepartner, Verwandte>] [, als <role> <actors>]... [, betrifft <objects>] [, Teil von <act>] [, bezieht sich auf <act>].` A reference phrase shows the actor's `rdfs:label` of that regest, with `rf:nameInSource` as fallback and in the RDF view. A concerned right or thing reads `<right type> (<label>)`. `rf:partOf` and `rf:refersToAct` become phrases naming the type of the other factoid, with `rel` `partOf` or `refersToAct`.
- `rf:condition`, `rf:exception`, `rf:ground`, `rf:amount` and `rf:qualifier` become literal lines labelled Bedingung, Ausnahme, Begründung laut Regest, Betrag and Wortlaut. A literal is located inside its factoid's evidence first, so a short qualifier such as "Tochter" marks the right occurrence.
- `turtle` of the head is the factoid frame (type, concept, source, first selector, producer, status), and each further line carries the one triple it stands for with the description of a named object.
- The person graph takes actors from `rf:actor` (E21 and `rf:FunctionalActor` as person, E74 as group) and draws each factoid with actor references as an act node linked by role edges. A parenthood factoid gives a parent edge from each `rv:Child` to each `rv:Parent` reference instead of an act node.
- The question `gleichnamige-eltern` returns every pair of distinct parent IRIs of one child. The build keeps a pair whose `rf:nameInSource` or `rdfs:label` agree after German inflection endings are stripped (`_name_key`), and records that rule in the question's `filter` field. The retained pairs drive the same-name edge, the timeline arc and the cross references, whose sides carry each regest's own name form as `name`. This matching raises a question and decides no identity. In the factoid run it finds Adela (RI004-002-A000306) with RI004-002-T000162 in n. 46 ("Markgraf Diepolds von Vohburg") and RI004-002-T000163 in n. 167 ("Markgrafen Diepold von Vohburg").
- History holds the findings of both reviews and the adjudication decisions for either stage, because the reviews read the extracted stage. Review model gaps join `notes.gaps` with stage Review. Corrections set `notes.corrected` for the revised stage. A review or correction file the build does not know aborts it.
- The other questions of `questions.json` are rewritten for the factoid vocabulary under the same ids. `rollen` lists every reference, `bezug` lists `rf:partOf` and `rf:refersToAct`, and `bedingungen` lists all five exact-wording literals.

## Rights

The JSON contains regest text, commentary and register labels from the supplied CSV delivery, whose source terms are unresolved in `regesta-rdf-demo/knowledge/data.md`. The data files therefore stay local.
