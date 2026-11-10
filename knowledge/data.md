---
title: Data interface
status: draft
language: en
created: 2026-11-09
updated: 2026-11-09
---

# Data interface

`build_data.py` reads one run of `regesta-rdf-demo` and writes two JSON files that the page loads once. The source of truth for every value is the run directory and the two source CSVs. The JSON is a derived, deterministic product; the same inputs give byte-identical files.

## Inputs

| Input | Use |
|---|---|
| `runs/<run>/manifest.json` | run id, LLM, annotation scope, selected UIDs |
| `runs/<run>/packets/<uid>.json` | `summary_plain`, `identifier`, `date_string`, `locality_string`, `identity_candidates` |
| `runs/<run>/revised/<uid>.ttl` | candidate RDF, loaded as one named graph per file into an rdflib Dataset with union default graph |
| `runs/<run>/validation/revised.json` | `technical_pass`, `expert_accepted`, per-record `issues` and claim list |
| `runs/<run>/extracted/batch-*.json` | `unresolved_identities`, `ontology_gaps` |
| `runs/<run>/review/*.json` | review findings, adjudication, revised review and final check |
| `runs/<run>/revised/*corrections*.json` | corrections and remaining gaps |
| `source-material/RI_004-002-ReggBarbarossa.csv` | `sorting` (edition order), `commentary`, `archival_history`, `external_links`, `exchange_identifier` |
| `source-material/RI_004-002-RegisterBarbarossa.csv` | cross-check of the register entries shown for the Diepold case |

## edition.json

```
run       id, model, scope, technical_pass, expert_accepted, validator
regests[] in edition order
  uid, identifier, short, sort
  start, end           machine_start and machine_end of the packet (delivered start_date, end_date)
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
  nodes[]   actors {id, kind person|group, label, labels[{label, regests}], regests, local, x, y}
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

`VOCAB_DE` in `build_data.py` gives German display labels for the English labels of `ontology/vocabulary.ttl`. The term itself stays visible in the RDF view of a statement. A vocabulary term without a German label aborts the build.

## Rights

The JSON contains regest text, commentary and register labels from the supplied CSV delivery, whose source terms are unresolved in `regesta-rdf-demo/knowledge/data.md`. The data files therefore stay local.
