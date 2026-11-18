---
title: Edition data
status: draft
language: en
created: 2026-11-09
updated: 2026-11-17
---

# Edition data

`build_data.py` reads one run of `pipeline/` at one stage (`--stage revised`, the default, or `--stage extracted`) and writes two JSON files that the page loads once. The source of truth for every value is the run directory and the two source CSVs. The JSON is a derived, deterministic product, and the same inputs give byte-identical files.

The build reads two data models into the same schema. It detects the model from the RDF of the run, by whether `rf:ActFactoid` or `rf:StateFactoid` nodes occur, and never from the run name. The pilot model (`pilot-2026-11-09`) is read from its revised stage only. The factoid model (`factoid-2026-11-11`, described in [factoid-model.md](factoid-model.md)) is mapped as set out under [Factoid model](#factoid-model).

## Inputs

| Input | Use |
|---|---|
| `runs/<run>/manifest.json` | run id, LLM, annotation scope, selected UIDs, contract hashes |
| `runs/<run>/packets/<uid>.json` | `summary_plain`, `identifier`, `date_string`, `locality_string`, `identity_candidates` |
| `runs/<run>/<stage>/<uid>.ttl` | candidate RDF, loaded as one named graph per file into an rdflib Dataset with union default graph |
| `runs/<run>/validation/<stage>.json` | `technical_pass`, `expert_accepted`, per-record `issues` and claim list (pilot) or factoid count (factoid) |
| `runs/<run>/extracted/batch-*.json` | `unresolved_identities`, `ontology_gaps` (pilot) or `model_gaps` (factoid) |
| `runs/<run>/review/*.json` | pilot: review findings, adjudication, revised review and final check; factoid: `review-A.json`, `review-B.json`, `adjudication.json`, or per group `review-gN-A.json`, `review-gN-B.json`, `adjudication-gN.json` as in the shown run |
| `runs/<run>/revised/*corrections*.json` | corrections and remaining gaps; factoid: `corrections.json`, read for the revised stage only |
| `contracts/<run>/ontology/vocabulary.ttl` | factoid only: German `skos:prefLabel` of every concept, checked against `contract_sha256` of the manifest |
| `source-material/RI_004-002-ReggBarbarossa.csv` | `sorting` (edition order), `commentary`, `archival_history`, `external_links`, `exchange_identifier` |
| `source-material/RI_004-002-RegisterBarbarossa.csv` | cross-check of the register entries shown for the Diepold case |

## edition.json

```
run       id, model, scope, technical_pass, expert_accepted, validator
vocabulary  factoid only: German and English prefLabel per concept, scheme and status of the frozen vocabulary
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

## TEI per regest

`build_tei.py` writes one TEI P5 file per regest of a run (`--run`, `--stage`, default revised) from the packet text, the regest CSV row, the Turtle of the stage and the run's validation, review and correction files. The edition texts (title, subtitle, definition, licence line, attribution, modification statement) come from `edition/texts.json`. `--schema schema/tei_all-4.12.0.rng` validates every file with lxml; the schema is vendored from the TEI Consortium (CC BY and BSD-2, see its header). The file name is the slug of the RI identifier, `RI IV,2,1 n. 46` gives `iv-2-1-46.xml`.

- teiHeader. `titleStmt` holds one `respStmt` per producing agent: the extraction agents from `prov:wasAttributedTo` with the run's LLM, the validator with its hash, the reviewers, the corrector where the regest was corrected, and the TEI build. `publicationStmt` carries the licence line, `sourceDesc` a `bibl` with the RI identifier, the persistent link `https://www.regesta-imperii.de/id/<persistent_identifier>`, the book-page link from `external_links` as `ref type="facsimile"`, the attribution under CC BY 4.0, the CSV row with its hash and the modification statement. `encodingDesc` holds description, provisional definition, the encoding rule and the verification status as a taxonomy. `revisionDesc` has one `change` per stage with `@who` pointing to the `respStmt` and a final change stating that no expert has checked the statements.
- Text. `summary_plain` in one `<p>`, losslessly; the build aborts when the paragraph does not give it back character for character. The text is cut at every evidence and name boundary, each piece under evidence is a `<seg type="evidence">`, a located `rf:nameInSource` wraps its pieces in `persName` or `orgName` with `@ref` to standOff. Overlapping evidence of two factoids therefore needs no crossing elements. Dating and place stand in `<head>` with `date/@from` and `@to` from the machine dates; original dating, transmission, literature, commentary and footnotes follow as `div` elements with markup stripped.
- standOff. Persons in `listPerson`, groups in `listOrg`, each with the RDF label, the register id where the IRI carries one and the IRI. Every factoid is an `<event>` in `listEvent`, `@type` act or state, `@subtype` the factoid type, `@corresp` its evidence pieces, `@resp` its agent, `@ana` its verification status. Each reference is a `relation` in `listRelation type="reference"` (`@name` role, `@active` actor, `@passive` factoid); `rf:partOf` and `rf:refersToAct` are relations of `listRelation type="link"`.
- Documented loss. A state is encoded as an `event` with `@type="state"`, because TEI has no standOff container for states. Concerned rights and things are `note type="concerns"` with type and label, not nodes of their own, and exact-wording literals are notes with their kind; the RDF stays the source of truth. Markup inside the apparatus fields (italics, links) is stripped. A name that overlaps a name already marked is not marked again in the text; its reference stays complete in standOff.

## Static site

`build_site.py --run <run> --out site` builds the curated site of the public edition into a gitignored folder. It runs `build_data.py` for the revised and the extracted stage, `build_tei.py` with tei_all, `build_holdings.py` and `check_itinerary.py` as subprocesses, so the scripts stay independent single-file scripts, and reads their output. The run id is the only switch between runs.

```
site/
  index.html, atlas/, regesten/, regesten/<slug>/, personen/, personen/<actor slug>/
  en/                   the same pages in English; data, files and scripts exist once at the root
  methode/, daten/, ueber/   forwards to the sections of the start page (since 2026-11-18)
  tei/<slug>.xml, ttl/<slug>.ttl, json/<slug>.json, LICENSE-DATA.txt, daten/<package>.zip
  data/routes.json      uid -> regest page, actor IRI -> person page, for the embedded views
  css/, js/edition/, fonts/, img/
  ansicht/              the views app (index.html, js/, css/, fonts/, data/edition.json,
                        questions.json, holdings.json, holdings-texts.json, itinerary-checks.json)
```

- The Turtle file is the run's Turtle of the shown stage with a comment header naming licence, source link and modification; the RDF itself is unchanged. The JSON file is the regest entry of edition.json with licence, attribution, source link and run. The zip holds all three folders and `LICENSE-DATA.txt` with a fixed file date.
- With JavaScript the regest page shows the shared card of the views app (`js/regest-card.js`) and keeps citation, downloads and the `zurueck` link below and above it; its static content is the reading without JavaScript. That static reading compares the stages by factoid IRI: a factoid whose sentence differs in the extracted stage shows that sentence, a factoid of the extracted stage missing from the revised one is listed once.
- Actor pages take the address from the IRI after `urn:regesta:actor:`, lower case. Persons with a register entry are named by a short nominative form built from the register (`register_names.py`, see Person names: the first name variant before "//", or the most frequent one of the entry's siblings where the register leaves it empty, plus the first part of the description, e.g. "Heinrich der Löwe" for the agents' "Heinrich dem Löwen"); the two nodes of the same-name case keep the agents' form, since their shared name is the case. Groups and regest-local actors keep the source form, and every source form stays listed on the person page.
- The build never deletes a directory. It records every file it writes in `.edition-build` and removes, file by file, what the previous build wrote and this one did not. `knowledge/` is never copied.

## Publication

`publish_site.py` turns `site/` into one commit on `gh-pages` (temporary git index with `site/` as work tree, `.nojekyll` added, `.edition-build` left out, parent `origin/gh-pages`) and pushes it as a fast-forward. Before that it aborts on files or links of internal material (knowledge, runs, review, checks, Markdown, Python). GitHub Pages serves the branch at https://chpollin.github.io/regesta-assertive-edition/.

## Person names

`register_names.py` gives every register person one short name, used by `build_data.py` for the graph and by `build_holdings.py` for the time band and the person lists: first name variant and first clause of the description in the nominative, asides and cross references cut, ordinals joined („Friedrich I. Barbarossa“), a siglum with its office („Rainald G, Notar der Reichskanzlei“). A sub-entry after a second „//“ names the people around a person and is shown as such („Kinder (Friedrich I. Barbarossa)“). Names that coincide among the persons a view shows are lengthened by a clause; two pairs stay alike because the register describes them identically (Adalbert, Bischof von Trient; Friedrich, Graf von Beichlingen). Where the register gives only Latin variants the German head stands („Fredericus“ to „Friedrich“). `PLACE_FIXES` in `edition_io.py` corrects, for display only, the two place labels that the label rule reads wrongly from the register: „Cremam“ for Crema, and „Johannes“ for Saint-Jean-de-Losne, which the register files under the name variants of the saint. `build_holdings.py` and `check_itinerary.py` both name places through it.

## Order and join of the whole-delivery layer

`build_holdings.py` and `check_itinerary.py` sort the delivery with one key (`regest_order` in `edition_io.py`): start date, then the identifier with its numbers read as numbers. The views keep that order and sort by date only, so the line the Atlas draws is the line whose steps the itinerary check judged (`checks/test_holdings.py`). Both scripts join the register on the display identifier and assign no row where the identifier names several records, as [Source data](source-data.md) requires: RI IV,2,2 n. 1520a names two records, `holdings.json` reports them under `ambiguous`, and neither record lists persons. Ten regesta carry no regest text in the delivery (RI IV,2,1 n. 107 among those of the run); card and regest page say „Kein Regesttext geliefert.“

## Identifier and sort key of n. 103a

The delivery carries „RI IV,2,2 n. 103a“ with the sort key of RI IV,1,2 (`004_001_002_000793_000000103a`, start 1138) and, separately, „RI IV,2,1 n. 103a“ with the same regest text. The lists keep the delivery's sort key, so the first regest stands before RI IV,2,1 n. 1. Which identifier is right is a question to the Regesta Imperii delivery, not decided here.

## Estate

`js/stand.js` gives a person or group one of four estates for the colour of the person drawings: Herrscher, geistlich, weltlich, ohne Angabe. It reads the register description of the person from holdings.json, or the name forms of the run where the register has none. A ruler's own title (König, Kaiser, Königin, Kaiserin, Sultan, Doge; in a register description not followed by a capitalised genitive, which names another person, as in „missus König Konrads III.“) decides first; otherwise the estate word that stands first in the text. It is a deterministic rule on the delivery, not a statement of the source, and it errs on name forms without a title (Konrad III. as a regest-local node stays without an estate) and on forms that name a ruler in passing („der nach dem König zweite Vogt“).

## Agent review

On 2026-11-14 the operator gave up checking the twenty selected regesta himself and had their statements evaluated by agents. The choice of the twenty stays as decided on 2026-11-12 (`edition/agent-review-2026-11-14/selection.json`): the Adela case (RI IV,2,1 n. 46 and n. 167) always, then by review state of the run six korrigiert, five beibehalten, five ohne Befund and two keine Aussage, inside a state the least covered relation family first, at most six statements per regest. The two regesta without statements are not judged.

- Input (`prepare_agent_review.py`): per regest its text, per statement its complete Turtle cut from the run's revised Turtle (the factoid, its references and blank nodes; embedded acts stay out), serialised anew so the run's comments do not reach the readers. A first round built the input from the edition JSON, whose literal lines carry no Turtle, and dropped every qualifier, exception and ground; its answers lie in `round1-incomplete-input/` and are not used.
- Readers: two fresh LLM-based agents per statement, each over one half of the twenty, with the brief `edition/agent-review-2026-11-14/brief.md`: the run's frozen annotation guidelines and vocabulary, the regest text and the statement, never the producing run's reasoning, its review findings or another assessment. Each gives `stimmt`, `stimmt nicht` or `unklar`, the passage it rests on, verbatim, and one sentence of reason. Raw answers in `reader-a-part*.json` and `reader-b-part*.json`.
- Result (`build_agent_review.py` → `edition/agent-review-2026-11-14.json`): per statement `outcome` (the shared verdict, or `strittig` where the readers differ, both readings kept unsettled) and `readers`; `producer` names the agentic review, model and date. The merge aborts when a quoted passage is not verbatim in the regest text.
- Status: agentic review, never scholarly validation. `rf:verificationStatus` in the run's Turtle stays `rv:unchecked`, and the statement's `expert` status stays false. `build_site.py --preview` shows the outcome at the statement as „Agenten: …“ with the readers' reasons unfolding where the outcome is not `stimmt`, and the card head says „von LLM-Agenten gelesen“ with model and date; the public build shows nothing of it until the operator decides.
- The outcomes, the agreement of the readers and the contested cases are read from the result file; the report of 2026-11-14 is in [journal.md](journal.md).

## Empire about 1190

`build_realm.py` georeferences a rough hand trace (`edition/realm-1190-trace.json`) of the Empire's border on W. R. Shepherd's map "Europe and the Mediterranean Lands about 1190" (Historical Atlas, 1926; scan of the Perry-Castañeda Library, which states its scanned maps as public domain unless marked, checked on 2026-11-12) with a quadratic fit over fifteen town control points (largest residual 0.27 degrees), softens it and writes `js/realm.json`. Corsica and Sardinia are left out. The view names the area as this project's rough interpretation.

## Rights

The rights study of 2026-11-11 (summarised in the former edition plan of `regesta-rdf-demo` at f65887c, section Rights) found the regesta database of Regesta Imperii under CC BY 4.0 and the register file byte-identical with the public RI Lab file; for the regest export the licence follows from the database licence, without an identical public copy. The site therefore carries the attribution, the licence link, the persistent link per regest and the modification statement of `edition/texts.json`, and links third-party images only. The Research Coordination treats the rights as clarified for publishing the curated build (2026-11-11); the repository exists and is private, making it public stays with the operator ([plan.md](plan.md), Public visibility), and the export date of the regest file is still to be established.
