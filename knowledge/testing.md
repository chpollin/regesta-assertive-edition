---
title: Testing
project:
  name: Regesta Assertive Edition
  repository: https://github.com/chpollin/regesta-assertive-edition
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
status: draft
language: en
created: 2026-11-09
updated: 2026-11-17
---

# Testing

Deterministic checks establish that a run conforms to its frozen contract and that every evidence passage exists verbatim in the regest. Whether a factoid is historically right is a separate question that only human verification answers. No statement is human verified yet, no reference set exists, and precision, recall and accuracy are unmeasured.

## Executed checks

[validate_factoid.py](../pipeline/validate_factoid.py) checks a factoid run per record and writes `validation/<stage>.json` with runtime versions and fingerprints, plus a German review sheet per stage.

- Contract and packet hashes against the manifest.
- Turtle parsing and allowed classes, predicates and concepts, with the type scheme matching act or state.
- SHACL with the vocabulary merged into the data graph.
- Evidence as an exact, contiguous substring of `summary_plain`.
- Actors only from the regest's own packet, the shared ruler or the declared local identifier policy.
- Explicit abstention and one result for every assigned UID.
- With `--self-test`, mutations that must each be caught (fabricated evidence, state type on an act, unknown concept, actor outside the packet, missing status, role from the wrong scheme, empty extraction) and a valid minimal record that must pass.

The exit code is 0 only if every record passes. In the run `factoid-2026-11-11` both the extracted and the revised stage pass, and the reviews still found errors in technically passing files ([adjudication](../pipeline/runs/factoid-2026-11-11/review/adjudication.json)). This is the gap between technical conformance and correctness that the edition makes visible by showing the revised stage with the extracted stage for comparison.

## Semantic review and limits

Two review agents read the source beside the graph without the extractors' reports. The parent adjudicates every finding against the frozen contract, a correction agent writes the revised stage, and the validator runs again. Findings recorded as model gaps or as not required stay in the adjudication.

Exact wording proves that the words exist, not that they support the factoid. SHACL conformance proves compliance with the selected constraints, not complete extraction or historical truth. Agreement between agents is no substitute for a reference.

## Development cases

These regesta lie in both runs and expose characteristic difficulties. Read the full packet and Turtle before relying on the description.

| UID | Issue |
|---|---|
| 22673 | Alternative marriage dates, not a continuous duration |
| 24821 | Earlier pledge, later confirmation and assurance |
| 220540 | Addressees overasserted as participants in the pilot, corrected while keeping the wording |
| 22696 | Right holder and investiture right |
| 25897 | Marriage negotiation must not become an asserted marriage |
| 24392 | Candidate negative case requiring expert confirmation |

## Reproduction

```powershell
uv run run.py validate
uv run run.py check
```

`run.py validate` checks both stages of `factoid-1153-2026-11-11` from inside `pipeline/`; `--run factoid-2026-11-11` checks the earlier run. Preparation refuses an existing run directory, and exploration overwrites its output only with `--force`. Extraction and review are recorded agent tasks and are not repeated by these commands.

## Transfer checks

[checks/test_pipeline.py](../checks/test_pipeline.py) checks that the run `factoid-1153-2026-11-11` arrives faithfully from the two supplied CSV files through packets and RDF to `edition.json` and TEI. It builds both outputs into a temporary folder with the scripts the site uses. Each check returns its errors; each test asserts that the real data yield none and that a named mutation of the real data yields at least one.

- Completeness: every selected UID has a packet, an extracted and a revised file, a regest in `edition.json`, a TEI file and a CSV row, and no stage holds a UID outside the selection. Mutation: one revised file removed.
- Field round trip: identifier, start and end date, date string, place and the plain summary of the CSV row equal packet, `edition.json` and TEI, with runs of whitespace collapsed as the only normalisation. Mutations: a changed start date, an altered TEI regest paragraph.
- Register references: every register entry the CSV assigns to a selected regest is an identity candidate of its packet and vice versa, and every register actor of the revised RDF and of the TEI is a candidate of its own packet or the shared ruler. Mutations: a dropped candidate, an actor from a foreign packet.
- Quote round trip: every `oa:exact` of the revised RDF and every TEI evidence span is verbatim regest text, and every TEI statement cites existing spans. Mutations: a changed selector, a changed TEI span.

These checks establish faithful transfer, not that a statement is right. Whether a quote supports its statement and whether something was left out is agentic review; whether the sources warrant a statement is scholarly validation, which no statement has yet. The checks do not yet cover that every accepted review finding was carried out in `revised/`.

At the move on 2026-11-17 the validation reports and the `build_data.py` and `build_tei.py` outputs at the new place were compared file by file with those built from `regesta-rdf-demo` f65887c and were identical.

### Graph checks

[checks/test_graph.py](../checks/test_graph.py) checks that the revised stage of `factoid-1153-2026-11-11` is complete against the supplied CSV and holds together as one graph. It loads every revised Turtle file with [queries/run_queries.py](../queries/run_queries.py), the loader that `uv run run.py graph` also uses, into one rdflib dataset in memory. Each file is a named graph and the default graph is their union, so a check can ask both what the merged graph contains and which file a triple came from. The checks are SPARQL queries where that reads clearly, and they follow the same pattern of real data without errors and a named mutation with at least one.

- CSV slice: the regesta of `RI_004-002-ReggBarbarossa.csv` whose `start_date` lies on or before 1153-12-31, read with the pipeline's CSV dialect and selected by the rule of `select_slice.py` itself, equal in number and UID the `crm:E31_Document` nodes `urn:regesta:record:<uid>` of the merged graph. The check starts from the CSV and does not read `selection.json`. Mutation: one record declaration removed.
- Factoids: every `rf:ActFactoid` and `rf:StateFactoid` has an `rf:source` declared as record in its own file, at least one `oa:TextQuoteSelector` with `oa:exact`, `prov:wasAttributedTo` and `rf:verificationStatus`. Mutations: the producer removed from one file's factoids, and the source of one file's factoids pointed at a record declared only in another file.
- Actors: every node a file declares, other than its record and its factoids, is reached by a factoid of that file, an actor through an `rf:Reference` or, for a community that a right or thing concerns, through `rf:concerns` as the contract's annotation guidelines allow. Every actor a reference names is declared in the same file. Mutations: the `rf:concerns` link to a community removed, and the declaration of the ruler removed from a file that references him.
- Abstentions: every file declares exactly its own record, also when it holds no factoid. Mutation: an abstention file emptied.
- Queries: every query in [queries/](../queries/) answers something on the merged graph. Mutation: an empty stage.

The queries answer concrete questions over the merged graph, namely which acts name the ruler as grantor, which actors appear in more than one regest, which factoids concern a right of advocacy, and on which regesta the extraction abstained. The actor join across regesta rests only on the register ID in the actor IRI ([Factoid model](factoid-model.md#identity-across-regesta)).

## Clean knowledge graph

A knowledge graph of this project counts as clean on four levels that build on one another. Each level names what establishes it, and a higher level presupposes the lower ones. The state given is that of the revised stage of `factoid-1153-2026-11-11`.

1. Formally clean. The run conforms to its frozen contract, every file parses as Turtle, uses only allowed classes, predicates and concepts and conforms to the SHACL shapes, every evidence passage is verbatim in `summary_plain`, and every factoid names its producer and its verification status. [validate_factoid.py](../pipeline/validate_factoid.py) establishes this under [Executed checks](#executed-checks), and the revised stage passes.
2. Structurally clean. The graph is complete against the CSV slice, record and actor IRIs are stable because they are minted from the Regesta Imperii UID and register ID, actors are joined across regesta only through register IDs, no declared node is an orphan, every referenced actor is declared, and fixed queries return answers. The [graph checks](#graph-checks) and the [transfer checks](#transfer-checks) establish this, and both pass. The join is the register's assignment adopted as it stands, so an error of the register remains an error of the graph.
3. Reviewed. Two independent agent reviews per group and an adjudication against the frozen contract were carried out, accepted findings were corrected in `revised/`, and the others were recorded as kept, not required or model gaps in the adjudication files ([review overview](../pipeline/runs/factoid-1153-2026-11-11/review-overview.md)). This level rests on agentic review, whose findings are evidence and not ground truth. No executable check yet establishes that every accepted finding was carried out in `revised/`, so the level is recorded as done and its completeness is unchecked.
4. Expert confirmed. A person with expertise in the sources has confirmed a defined sample of statements, recorded with person, date, scope and version. This has not been done, and the manifest records `expert_accepted` false. The proposed sample is the subject of [Next evaluation](#next-evaluation).

The first two levels are verification by executable checks and say nothing about whether a statement is right. Only the fourth level is scholarly validation.

## Pilot checks, archive

[validate_pilot.py](../pipeline/validate_pilot.py) checks the pilot against its CIDOC CRM contract, with [the extracted report](../pipeline/runs/pilot-2026-11-09/validation/extracted.json) and [the revised report](../pipeline/runs/pilot-2026-11-09/validation/revised.json). The extracted stage intentionally keeps a genuine SHACL failure, an untyped kinship state, and exits unsuccessfully. The revised stage passes. Repeated preparation reproduced the pilot packets byte-identically.

```powershell
cd pipeline
uv run validate_pilot.py --project-dir . --run-dir runs/pilot-2026-11-09 --stage extracted --self-test
uv run validate_pilot.py --project-dir . --run-dir runs/pilot-2026-11-09 --stage revised --self-test
```

## Next evaluation

- A historian verifies a subset against the regest text, proposed as the regesta of the factoid run ([Plan](plan.md)). Errors are logged per stage, so the error rate per stage becomes measurable.
- Evaluation separates unsupported claims from omitted in-scope facts, with actor identity, role, temporality and lost qualifications as error categories.
- Controlled mutations such as swapped actors, lost exceptions and overprecise dates show which errors the validator catches and which only human verification finds.
- An expert decision records case, statement and version, reason and scope. Generalising it into a rule or model change is a separate decision.
- An independent review of the validator and the SHACL shapes for missing targets, permissive constraints and tautological tests was requested by the operator and has not been carried out.
- No project typechecker is configured. Reports name the checks that actually ran, and a clean linter run is no audit of the validator's completeness.
