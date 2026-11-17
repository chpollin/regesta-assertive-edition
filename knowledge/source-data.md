---
title: Source data
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

# Source data

The material consists of the supplied Barbarossa regesta export and its register export. The register records occurrences associated with regesta, while its repeated IDs identify register entries. These counting units remain distinct throughout the analysis.

The numerical snapshot is [the exploration report](../pipeline/generated/exploration-report.md). Its machine-readable source of truth is [profile.json](../pipeline/generated/profile.json), backed by the [complete aggregation tables](../pipeline/generated/aggregations/) and [executed verification](../pipeline/generated/verification.json). This maintained document distils the data contract and interpretation limits.

## Subject

The exports describe historical information in the Barbarossa regesta and an associated index of persons, places, things and events. Regesta include documentary and narrative material. A regest record must not automatically be equated with one charter or one historical event.

## Sources

| Supplied source | Function | Evidence |
|---|---|---|
| `source-material/RI_004-002-ReggBarbarossa.csv` | Regesta, dating fields, summaries, documentary details, commentary and references | Filename, column names, identifiers and original CSV bytes |
| `source-material/RI_004-002-RegisterBarbarossa.csv` | Register entries associated with particular regesta, with role/context tokens, hierarchy and selective geodata | Filename, column names and original CSV bytes |

The operator supplied the files on 2026-11-09. They are Regesta Imperii material by their names and internal identifiers, and the original editorial work belongs to the source project. The regesta database of Regesta Imperii is published under CC BY 4.0. The register file is byte-identical with the public file in the RI Lab repository, while for the regest file, which follows the documented export schema, no identical public copy was found. Attribution and the remaining check are in [Edition data](data.md#rights). This preparation performs parsing, profiling and aggregation.

The input fingerprints, byte sizes, encoding and dialect are recorded in `profile.json#inputs`. The working copies match the supplied files byte for byte.

## Model

### Regesta and identifiers

`uid` is unique in the supplied regesta export. The display identifier in `identifier` is almost unique, but a collision prevents treating it as a primary key. `RI IV,2,2 n. 1520a` occurs with different UIDs and different persistent identifiers. Both records are retained.

`persistent_identifier`, `urn` and `exchange_identifier` are distinct delivered fields. Some are missing, and their values must not be conflated. A field named `urn` does not by itself establish a standards-compliant URN or a dereferenceable web identifier. Numeric-looking and sorting fields remain strings.

| Regesta fields | Observed function or treatment |
|---|---|
| `identifier` | Citation-style display identifier and the join target used by the register |
| `uid` | Unique export record key in this delivery |
| `pid`, `bandpk` | Delivered collection and volume keys; their complete external codebook is not supplied |
| `persistent_identifier`, `urn`, `exchange_identifier` | Source identifiers preserved separately; internal references use the exchange identifier |
| `title` | Heading with spelling and punctuation variants, preserved as delivered |
| `start_date`, `end_date` | Machine-readable dating boundaries |
| `date_string`, `original_date` | Editorial dating prose and the delivered original-date field |
| `locality_string` | Unnormalised location string, including parenthetical, relative and placeholder forms |
| `summary` | Regest text, often with inherited markup |
| `recipient`, `incipit` | Delivered documentary content, selectively populated |
| `archival_history`, `commentary` | Transmission/reference information and editorial commentary |
| `literature`, `footnotes`, `annotations` | Declared fields without populated values in this delivery |
| `witnesses`, `clerk`, `chancellor`, `seal` | Delivered documentary descriptions with selective coverage |
| `signature`, `signature_addition`, `verso_note` | Declared fields without populated values in this delivery |
| `external_links` | Inherited link markup, including digitised book-page references |
| `regestennummernorm`, `laufendenummer`, `sorting` | Delivered numbering and ordering fields, preserved without coercion |

Per-column completeness, null counts, distinct values, markup coverage and text-length distributions are in the two `*-columns.csv` tables.

### Register entries and occurrences

The register is an association table. Its `id` repeats when the same register entry is associated with different regesta or contexts. A repeated entity ID is expected. Exact duplicate rows and repeated entity-regest-role combinations are reported separately and retained.

| Register fields | Observed function or treatment |
|---|---|
| `id` | Register-entry identifier, not an occurrence-row identifier |
| `parentId` | Hierarchical register reference; many targets do not occur as entity IDs in the supplied export |
| `label`, `origLabel` | Composite and original labels, with aliases, contextual descriptions and markup |
| `labelNorm` | Declared but unpopulated in this delivery |
| `role` | Whitespace-separated combinations of delivered tokens; both the complete string and tokens are retained |
| `sourceType`, `certainty`, `refId` | Declared but unpopulated in this delivery |
| `regestaNumber`, `regestaIdentifier` | Delivered reference number and citation-style regest identifier |
| `comment` | Selective register commentary |
| `lat`, `long` | Selective coordinate strings requiring validation |
| `wikidataId` | Declared but unpopulated in this delivery |
| `geonames` | Selective identifiers with mixed representation, including numeric strings, a full URL and `NA` |
| `type` | Mostly `person`, `ort`, `sache` and `ereignis`, with exceptional strings retained |

The exact join is `register.regestaIdentifier = regesta.identifier`. It is accepted only when exactly one regest record matches. The ambiguous rows are preserved in the occurrence output and excluded from unambiguous per-regest aggregates. No first-match selection, fuzzy matching or removal of numbering marks is applied.

The hierarchy does not establish identity equivalence. Missing parent targets are not automatically invented, and parent-child links are not converted into `sameAs` relations. Identical labels do not justify merging separate register IDs.

The `role` field mixes tokens such as `nennung`, `austOrt`, `empfaenger`, `zeuge` and `p_komment`. Their complete editorial codebook is not supplied. In particular, tokens referring to textual context must not automatically become historical participation roles. The token frequencies overlap because a row may contain multiple tokens.

### CSV dialect, missing values and text

Both files are UTF-8; the register has a byte-order mark. The delimiter is a comma and the quote character is a double quote. The register uses backslash-escaped double quotes inside fields. Python's default CSV interpretation therefore produces misleading field widths for affected records. Parsing with `escapechar="\\"` and `strict=True` restores a consistent supplied schema without editing the files.

Only empty strings and case-insensitive literal `null` are treated as missing by the analysis. Other placeholders, including `NA`, dashes and question marks, remain raw values and require field-specific review. No silent missing-value coercion is performed.

Inherited markup includes HTML-like tags and TYPO3-style `<link ...>` references. The derived plain-text fields are for search and reading. Raw markup remains in the immutable CSV inputs. Internal exchange references and external targets are extracted as separate evidence, without fetching the targets. Plain-text normalisation is not an edition or a lossless replacement of the marked-up source.

### Dates and locations

The machine-readable date boundaries and editorial prose can disagree. The analysis detects reversed intervals and a deliberately narrow set of prose-year review candidates. It excludes recognised relative dates and abbreviated year ranges from that lexical heuristic. A candidate is a review prompt, not an automatic historical correction.

Start-year aggregations count exported start dates. They do not resolve uncertain intervals, measure annual historical activity or establish corpus completeness. Date arithmetic uses Python's calendar representation and does not perform scholarly calendar conversion.

Coordinate strings include non-numeric forms and out-of-range values. The analysis reports them without guessing missing decimal separators. Numeric range checks cannot establish historical location or geocoding accuracy. Raw locality strings, register locations and place identifiers remain different fields and counting units.

## Limits

| Finding | Consequence | Complete evidence |
|---|---|---|
| Citation-style identifier collision | A register association cannot always be assigned to a unique regest record | [Identifier collisions](../pipeline/generated/aggregations/regesta-identifier-collisions.csv) and [join issues](../pipeline/generated/aggregations/join-issues.csv) |
| Reversed dating intervals and prose-year candidates | Timeline placement needs review and must retain editorial dating prose | [Date issues](../pipeline/generated/aggregations/date-issues.csv) |
| Missing parent targets | The export does not contain a self-sufficient register hierarchy | [Unresolved parents](../pipeline/generated/aggregations/unresolved-parents.csv) |
| Mixed type strings and role/context combinations | A formal controlled vocabulary needs an explicit, reviewed mapping | [Types](../pipeline/generated/aggregations/index-types.csv) and [role combinations](../pipeline/generated/aggregations/index-role-combinations.csv) |
| Invalid coordinate strings and heterogeneous GeoNames values | A map or RDF export needs validation and an explicit normalisation policy | [Coordinate issues](../pipeline/generated/aggregations/coordinate-issues.csv) and [identifier syntax review](../pipeline/generated/aggregations/normdata-issues.csv) |
| Exact duplicate index rows | Row counts and distinct associations answer different questions | [Repeated associations](../pipeline/generated/aggregations/duplicate-entity-regest-roles.csv) |
| Empty declared fields | A schema field does not establish available information | Column profiles in [aggregations](../pipeline/generated/aggregations/) |
| Register selection | Mention frequency is an editorial observation, not historical importance | The ruler's entry `RI004-002-F000471` explicitly notes selective inclusion in its delivered label |

Shared regesta do not establish direct interaction between indexed entities. Neither this preparation nor the index automatically provides a social network. Statements about relations come only from the factoids of the [Factoid model](factoid-model.md).

## Authority links and source relationship

GeoNames is selectively represented, while the Wikidata field is empty. No external identifiers were dereferenced or reconciled. `source-references.csv` distinguishes references that resolve against the supplied exchange identifiers from external references that were only recorded.

The supplied exports remain the material authority. Reading derivatives, aggregates and quality flags are new deterministic processing products. They are not written back to the source files.

## Exploration workflow for the teaching demo

| Step | Concrete operation | Reusable evidence |
|---|---|---|
| Inspect | Establish bytes, encoding, BOM, hashes and the CSV dialect | `_read`, `profile.json#inputs`, real escaped-quote example |
| Profile | Identify columns, populated fields, placeholders and text lengths | `_column_profile`, the column tables |
| Audit | Compare dating boundaries and prose; inspect coordinates and identifier syntax | `_date_audit`, `_reference_audit`, issue tables |
| Model counting units | Separate regest records, register entries and occurrence rows | `_join_and_entities`, `entities.csv`, `occurrences.jsonl` |
| Join and aggregate | Join only unambiguous references and retain all raw associations | `regesta-index-coverage.csv`, distributions and degree rankings |
| Verify | Reconcile totals, rerun deterministically and independently recount the join in SQL | `_verify`, `verification.json` |

Run `python explore_regesta.py --input-dir source-material --output-dir generated --force` from the project directory. The script uses the Python standard library and performs no network or model calls.

## Real examples

The following selected values come directly from the supplied files. Full examples are in [teaching-examples.json](../pipeline/generated/teaching-examples.json).

```json
{
  "identifier": "RI IV,2,2 n. 103a",
  "start_date": "1138-06-01",
  "end_date": "1138-06-30",
  "date_string": "(1152 Juni/Juli)"
}
```

This disagreement makes source criticism visible before a timeline or RDF date assertion is created.

```json
{
  "register_id": "RI004-002-K000373",
  "role": "nennung",
  "regestaIdentifier": "RI IV,2,2 n. 1510"
}
```

This real register row contains an embedded quoted reference in its labels. It is a bounded example for demonstrating why the observed CSV dialect matters.
