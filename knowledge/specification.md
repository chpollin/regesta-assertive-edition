---
title: Specification
status: draft
language: en
created: 2026-11-09
updated: 2026-11-20
---

# Specification

The requirements come from the operator's commission and three rounds of his feedback on 2026-11-09, and from the proposed user stories of 2026-11-09, condensed under Research tasks. The questions to the data that the build executes are described in [data.md](data.md#questionsjson). None of the requirements records an expert acceptance.

## Research tasks

Condensed on 2026-11-18 from the proposed user stories of 2026-11-09 that the edition serves; the document `user-stories.md` was deleted on the operator's word and its full text, with the stories on literature grounding, expert feedback, reference readings and teaching, stays in the Git history. Each task names the criteria a test task checks ([plan.md](plan.md#test-tasks-with-computed-answers)); none records an expert acceptance.

- US03, find an actor and its identity candidates. Register identifiers, labels and regesta stay apart; an unresolved identity stays unresolved and search never merges persons of similar name; a community is distinct from its place; empty and ambiguous results are explicit.
- US04, inspect attested relationships in context. Each result names actors, relation or role, context and regest, with its conditions, exceptions and evidence; shared mention creates no relation, and a missing statement is no evidence that no relation existed.
- US05, check the evidence behind a statement. A statement opens its regest with the exact evidence marked; a readable statement and its Turtle are both available; candidate, machine review and expert acceptance stay distinct; broken evidence is reported and never approximated.
- US06, tell earlier acts, confirmations and promises apart. Related acts stay individually inspectable with their evidence and actors, a promise is never shown as a completed transfer, and an unresolved link between acts stays qualified (development case: the pledge of UID 24821).
- US07, inspect uncertain and alternative dates. Alternative years stay alternatives (UID 22673), events of one regest need not share its date, the dating prose stays beside the machine date, and no chronological display orders unresolved alternatives.
- US08, accept, correct or defer a single statement. A decision names run, graph version, regest and statement, carries a reason, concerns the statement and not the model or its completeness, keeps its history when the statement changes, and is never created by a technical check or an LLM review. The decision format is not specified.
- US10, compare the extracted and the revised stage. Both stay separately accessible, accepted and rejected review findings keep their rationale, a correction names what changed, and remaining gaps of the model stay visible after validation.
- US11, see technical validation apart from interpretation. Results name input, contract and graph versions; parsing, SHACL, evidence matching, identifier policy and record coverage have inspectable outcomes; every assigned record ends in an extraction, an abstention or an error; a conforming candidate stays marked as awaiting expert acceptance.
- US13, open a concrete historical task. The start leads to a case with a question, an inspectable result and its evidence, and shows at least one decision of modelling or interpretation; public output holds only material cleared for it.

## Requirements from the operator's verdicts of 2026-11-14 (proposal)

Each with the acceptance criterion he decides in front of the running preview; derived by the implementing agent from his verdicts in [ui-feedback.md](ui-feedback.md), not yet adopted by him.

1. Regest page: one head line with all metadata and actions, a reading area with the notes beside the text, and the apparatus below, in the same place on every page; the annotation follows one system ([design.md](design.md#annotation-system)). Criterion: a reader names from the page alone what is annotated and by whom, who has checked it, and what the editors' commentary says. (The three areas of 2026-11-14 became the head line by the interface plan the operator accepted on 2026-11-17.)
2. Agents' verdicts are named as the verdicts of LLM readings and never as a human check. Criterion: no page says or implies „menschlich geprüft“ for a statement.
3. Start page: the figure fills the screen under the header and the page does not scroll at desktop sizes. Criterion: at 1440 × 900 the document is no higher than the window.
4. Place view: a pointed or focused regest is readable beside its point; an opened regest is marked with what it depends on, the rest recedes; the sidebar is narrow. Criterion: the reader of RI IV,2,1 n. 135 tells from the view what it says and what it is connected to.
5. Persons can be followed through the space-time cube. Criterion: choosing a person shows their regesta as a trace through places and years.

## Registernetz user stories (proposal)

The stories below describe what scholars need from the Registernetz, the view of the whole delivery that shows a register entry, the regesta that name it, the role tokens the Register gives it there, the entries named beside it, the regest text and, where a frozen run exists, the LLM's unchecked statements with their evidence. They continue the numbering of the deleted `user-stories.md` (US01–US14). Every example was read from `pipeline/source-material/*.csv` with `edition_io.read_csv` and, for LLM statements, from the revised stage of the named run in `pipeline/runs/`. The glosses of the role tokens are proposals that have not been checked against the RI index guidelines. No story records an expert acceptance.

Drafted by an agent on 2026-11-20 from the deleted `user-stories.md`, the register practice found in the delivery and the source files, read against the CSV files by a second agent with a fresh context, and revised after its findings (journal.md, entry of 2026-11-20). The agent reading is evidence and no scholarly validation. The operator confirms, changes or strikes each story as scholarly validator.

### US15 Petitioners and intervenors in a charter

As a diplomatist at a university chair for the auxiliary sciences of history, I want to see the entries the Register marks `petent` in a charter regest beside the petition and intervention clauses of the regest text, so that I can tell who asked for the charter from who supported the request, since the Register gives both the one token `petent` and the difference stands only in the text.

Acceptance criteria:

- Each role token appears as the Register delivers it, with its `comment` beside it, and no label renders `petent` as petitioner in place of the delivered token.
- The regest text stands beside the role list, so the clauses „auf Bitten“, „auf Intervention“ and „unter Vermittlung“ can be read next to the entries they concern.
- A script check on the built view finds, for RI IV,2,3 n. 2532 and RI IV,2,3 n. 2077, the role tokens and comments listed below.

In RI IV,2,3 n. 2532 (uid 25168, Würzburg, 1180 Januar 25) Friedrich takes the church of Aquileia into his protection „auf Bitten des Patriarchen und päpstlichen Legaten Udalrich sowie auf Intervention“ of Archbishop Arnold of Trier, Bishop Konrad of Worms, the elect Bertram of Metz, the chancellor Gottfried, the protonotary Wortwin, Count Palatine Otto the Elder of Wittelsbach and the counts Hartmann and Manegold. The patriarch (`RI004-002-U000135`, comment `päpstlicher Legat`) and the intervenors Arnold (`RI004-002-A001204`), Konrad (`RI004-002-K000334`), Bertram (`RI004-002-B000793`, `petent p_komment`), Gottfried (`RI004-002-G000789`, `petent rekogneszent`), Wortwin (`RI004-002-W000864`), Otto (`RI004-002-O000442`), Hartmann (`RI004-002-H000168`) and Manegold (`RI004-002-M000314`) are all `petent`. In RI IV,2,1 n. 220 (uid 22847) Duke Welf intervenes and is `petent zeuge` (`RI004-002-W000272`), while Abbot Manegold of Kreuzlingen, who asks, is `nennung` (`RI004-002-M000311`). RI IV,2,3 n. 2077 (uid 24711) deviates from 2532 for the same person. There Dean Stephan (`RI004-002-S001152`) and the brothers of St. Marien in Aachen (`RI004-002-A001544`) ask and are `petent`, Empress Beatrix (`RI004-002-B000330`) and Friedrich's children (`RI004-002-F000483`) mediate „unter Vermittlung“ and are `petent` with the comment `Vermittlung`, the only two such rows in the Register, and Arnold of Trier intervenes „auf Intervention“ and is only `nennung`. In RI IV,2,1 n. 393 (uid 23022) Bishop Eberhard of Bamberg mediates „auf Vermittlung“ and is `nennung` with the comment `Vermittler` (`RI004-002-E000011`). Most summaries that mention an Intervention or Fürsprache have a `petent` row.

Whether a `petent` asked or intervened can only be read from the regest text, and the Register applies the token inconsistently, so a role list drawn from it alone cannot separate petitioners from intervenors.

(proposal, agent, 2026-11-20)

### US16 Witnesses of a charter

As a prosopographer of the imperial court at a research institute for medieval history, I want to read the witness list of a charter beside the entries the Register marks `zeuge` there, so that I do not mistake the Register's selective `zeuge` rows for the witnesses of the charter. The wish for a witness network is my inference, since the field `witnesses` is the only complete witness list the delivery holds.

Acceptance criteria:

- For a regest with a filled field `witnesses`, the field appears as delivered next to the register rows, and the entries carrying `zeuge` are marked as the Register's choice.
- No entry with `nennung` is labelled a witness, and no witness link between two entries is drawn from their shared mention in a regest.
- A regest that has `zeuge` rows but an empty field `witnesses` shows both facts.

The field `witnesses` of RI IV,2,3 n. 2077 names the archbishops Arnold of Trier and Wichmann of Magdeburg, the electi Reinhard of Würzburg, Konrad of Worms and Theoderich of Metz, Bishop Peter of Toul, Abbot Gregor of Prüm, Duke Matthäus of Lorraine, the counts Hugo of Dagsburg and Heinrich of Diez, and Werner of Bolanden. Only Werner of Bolanden (`RI004-002-W000334`) is `zeuge`. Arnold (`RI004-002-A001204`), Wichmann (`RI004-002-W000436`), Reinhard (`RI004-002-R000295`), Konrad (`RI004-002-K000334`), Dietrich or Theoderich (`RI004-002-D000212`), Peter (`RI004-002-P000414`), Gregor (`RI004-002-G000978`), Matthäus (`RI004-002-M000670`), Hugo (`RI004-002-H001317`) and Heinrich (`RI004-002-H000522`) are `nennung`. In RI IV,2,1 n. 220 Welf of Spoleto is `petent zeuge` and the other witnesses of the list are `nennung`. Across the delivery most regests with a witness list have no `zeuge` row, those that have one mostly have a single row, and a few `zeuge` rows stand in regesta without a witness list.

The data cannot give a witness network from the Register alone. The export also has no link from a name in the field `witnesses` to a register id, so any such link is a proposal of a person or an LLM. The criterion by which the Register assigns `zeuge` is unknown.

(proposal, agent, 2026-11-20)

### US17 Churches, chapters and monasteries filed as places

As a historian of ecclesiastical institutions at an institute for regional history, I want to see a church, chapter or monastery that the Register files under its town with the type `ort`, beside the community of its members typed `person` and the town itself, so that I can keep the institution, its members and the place apart.

Acceptance criteria:

- Each entry shows its `type` and its full index path (the segments of `label`) as delivered.
- The index hierarchy is navigable from an entry to its `parentId` and to the entries filed below it. A parent without a row of its own appears with the label segment derived from its child and is marked as having no row.
- Where the LLM run refers to an institution as a community derived from a register entry, the view labels that node as the LLM's derivation and keeps it apart from the register entry.

In RI IV,2,3 n. 2077 the Register names Aachen three times. `RI004-002-A000009` (Aachen, „auch Stadt“) is `ort` with `p_komment`, `RI004-002-A000010` (the Marienstift, Kanonikerstift St. Marien) is `ort` with `empfaenger` and the comment `Kapitel`, and `RI004-002-A001544` (the canons and brothers of St. Marien), filed below `A000010`, is `person` with `petent`. The parent of `A000010`, `RI004-002-A000008`, has no row of its own. In RI IV,2,1 n. 82 (uid 22709) the Benedictine monastery of Corvey (`RI004-002-C000961`) is `ort` with `austOrt nennung`. In RI IV,2,2 n. 103a (uid 134441) the Augustinian canons' house of Berchtesgaden (`RI004-002-B000513`) is `ort` with `nennung`. The run `factoid-1153-2026-11-11` refers to it as `RI004-002-B000513:community`, a Participant of the Dispute and the Beneficiary of the Judgment.

The data have no type for institutions, so whether an `ort` entry means the place or the institution can only be read from its label and the regest text.

(proposal, agent, 2026-11-20)

### US18 The places the Register assigns to a regest

As a historian of the itinerary of the Staufer rulers, I want to see the entries the Register marks `austOrt` beside the delivered `locality_string`, so that I can follow the place the Register assigns to each regest, for a charter its place of issue and for a stay the station, and compare it with the editors' free text.

Acceptance criteria:

- The `locality_string` appears verbatim, brackets, qualifiers and alternatives included, beside all `austOrt` rows of the regest, and the view makes no claim about how several `austOrt` rows relate to each other.
- An `austOrt` entry without coordinates is listed with a note that it has no position, and no map position is computed for it.
- A regest with a `locality_string` and no `austOrt` row shows the free text and states that the Register assigns no place.

RI IV,2,1 n. 82 (uid 22709, ? (1152 Anfang Mai)) reads „Friedrich besucht die Reichsabtei Corvey.“, and Corvey (`RI004-002-C000961`, GeoNames 10942877) is `austOrt nennung`. RI IV,2,1 n. 288 (uid 22915, 1155 (April)) has the `locality_string` „Gebiet von Piacenza“ and reads „Friedrich zieht durch das Gebiet von Piacenza und schlägt auf der Herzogswiese sein Lager auf.“, and the entry Piacenza, Gebiet (`RI004-002-P000624`) is `austOrt nennung` with the comment `Herzogswiese`. RI IV,2,1 n. 41 (uid 22668) has the `locality_string` „(Thessalonike oder Konstantinopel)“, and both Konstantinopel (`RI004-002-K000571`, GeoNames 745044) and Thessalonike (`RI004-002-T000200`, no coordinates) are `austOrt p_komment`. RI IV,2,1 n. 17 (uid 22644) has the `locality_string` „Zürich“, and Zürich (`RI004-002-Z000076`) is only `nennung`. Most regests with a `locality_string` have an `austOrt` row.

The data cannot say whether an `austOrt` marks a place of issue, a station or a camp, which only the regest text shows, and the `locality_string` carries no identifier.

(proposal, agent, 2026-11-20)

### US19 Register statements and LLM statements

As an editor of Regesta Imperii at the Academy, I want to see the roles of the Register and the statements of an LLM run for the same regest side by side, each with its producer, so that I can judge where the LLM reads more from the regest text than the index records and where it errs.

Acceptance criteria:

- Register roles and LLM statements stand in separate, labelled groups, the first as the Register of Regesta Imperii, the second with the run id, the attribution the run records and the status unchecked.
- Each LLM statement shows the evidence of its factoid, and the view does not present that evidence as evidence of a single role. No LLM role replaces or merges with the register token of the same entry.
- Where a regest lies in several frozen runs, the view shows the statements of the run named `SHOWN_RUN` in `edition_io.py` and names it, and where it shows another run, it names that run. A regest without a frozen run says that no LLM statements exist, and a regest whose run made no in-scope statement says so.

In RI IV,2,2 n. 103a the Register marks Otto of Moos (`RI004-002-O000481`) and Erbo of Biburg (`RI004-002-E000440`) as `nennung` with the comment `2x`, and Herbord of Hebingen (`RI004-002-H000788`) as `nennung`. The revised stage of `factoid-1153-2026-11-11`, the run `SHOWN_RUN` names, gives all three the role Witness in its Judgment, whose evidence is the whole first sentence of the regest. Margrave Engelbert of Kraiburg (`RI004-002-E000342`) is `nennung` with the comment `2x; erwählter Richter; von Kraiburg` in the Register and Judge in the run. The regest also lies in the earlier run `factoid-2026-11-11`, and the file `134441.ttl` of `factoid-1153-2026-11-11` attributes its factoids to `urn:regesta:agent:factoid-2026-11-11:extraction-batch-1`. RI IV,2,3 n. 2077 lies outside every frozen run. For RI IV,2,1 n. 45 (uid 22672) the shown run made no in-scope statement.

RI IV,2,4 n. 3166a (uid 220540) also serves as a teaching case for a course in the auxiliary sciences, in which students see what an index records of an embassy. It summarises a lost letter of Pope Clemens III. The Register marks Friedrich (`RI004-002-F000471`) and King Heinrich VI (`RI004-002-H000344`) as `adressat`, and Clemens (`RI004-002-C000754`), the cardinal priests Peter (`RI004-002-P000396`) and Jordan (`RI004-002-J000239`) and Folmar (`RI004-002-F000257`, „Elekt“ in the label, „Erzbischof“ in the text) as `nennung`. The envoy function stands in the comment `Legat Papst Clemens' III.` on Jordan's row, as envoy functions of the emperor's side stand in comments such as `kaiserlicher Legat` and in Friedrich's sub-entry „Amtsträger, Bote, Gesandter, Legat, Nuntius, Prokurator“ (`RI004-002-F000473`). Only the earlier run `factoid-2026-11-11` holds this regest, and it reads a Mission with Clemens as Grantor, Peter and Jordan as Envoy and Friedrich and Heinrich as Addressee, and a Request with Folmar as Beneficiary.

The data cannot settle which reading is right, since neither layer is validated by a historian and agreement between the two is no confirmation.

(proposal, agent, 2026-11-20)

### US20 Friedrich's occurrences

As a historian of Staufer rulership at a university, I want the view to state at Friedrich's entry that the Register indexes him only in a selection of regesta, so that I do not read a missing register row as his absence from a regest.

Acceptance criteria:

- The entry `RI004-002-F000471` shows the Register's note „passim, wird nur in Auswahl ins Namenregister aufgenommen“ verbatim above its list of regesta.
- The number or list of his regesta is presented as the Register's selection and never as his occurrences in the delivery.
- Entries filed below him, such as his children and his officials and envoys, remain reachable from his entry.

The note stands in the label of `RI004-002-F000471`. In RI IV,2,2 n. 103a the text opens „Vor König Friedrich (coram rege Friderico)“, the Register has no row for him, and the run `factoid-1153-2026-11-11` refers to him as Participant. In RI IV,2,1 n. 45 Friedrich, then duke of Swabia, is named as witness in DK. III. 210, the field `recipient` reads „Zeuge“, the Register has no row for him, and the run made no in-scope statement. His children (`RI004-002-F000483`) appear as `petent` with `Vermittlung` in RI IV,2,3 n. 2077.

The data cannot list Friedrich's occurrences, which have to be taken from the regest text.

(proposal, agent, 2026-11-20)

### US21 Visible export defects

As an editor responsible for the Regesta Imperii online database at the Academy, I want each defect of the export shown at the entry or regest it affects, with the delivered value and the handling the view applied, so that I can correct it at the source, since corrections belong in the RI database.

Acceptance criteria:

- A defective value is shown as delivered, marked as a defect, and any handling the view applies is named beside it.
- A defective coordinate places no point on the map. A position from the GeoNames id would need an external lookup that the delivery does not contain, and the view marks any such position as a correction from outside the delivery.

Kaiserslautern (`RI004-002-K000015`), the place of issue of RI IV,2,3 n. 2077, has the latitude `49443` with longitude `7.77161` and GeoNames 2894003. Friedrich's label (`RI004-002-F000471`) begins „, Fredericus“ and lacks its headword. Heinrich of Hegilen (`RI004-002-H000615`) has the type „person, <i>vgl. auch</i>“. RI IV,2,2 n. 1520a occurs twice (uid 134544 and 134545), and each of its register rows occurs twice. The two records differ in their identifiers and `sorting`, in the `date_string` („1165 November“ against „1165 November -“) and in the summary, which ends with „aus.“ only in the second. RI IV,2,2 n. 103a has the `start_date` 1138-06-01 against the `date_string` „(1152 Juni/Juli)“.

The data cannot say which handling is right, which needs the researchers' decision.

(proposal, agent, 2026-11-20)

### US22 Mentions in the regest text and in the apparatus

As a historian of the princes around the Staufer court, I want the entries named with a selected entry in a regest grouped by whether the Register finds them in the regest text or only in the commentary or transmission, so that I do not read a name from the apparatus as a person present at the act. This need is my inference from the tokens `p_komment` and `p_ueberlieferung`, which the Register uses for the apparatus.

Acceptance criteria:

- The entries named in a regest appear in two groups, those with a role token of the text or the act and those with only `p_komment` or `p_ueberlieferung`.
- An entry with both kinds of token, such as `petent p_komment`, appears in the first group with its apparatus token shown.
- No link between two entries is drawn from a mention in the apparatus alone.

In RI IV,2,3 n. 2532 Henry the Lion (`RI004-002-H000470`), Pope Innocent II (`RI004-002-I000110`) and Patriarch Pilgrim of Aquileia (`RI004-002-P000693`) are only `p_komment`, while Bertram of Metz (`RI004-002-B000793`) is `petent p_komment`. In RI IV,2,1 n. 82 the notary Heinrich (`RI004-002-H000404`) is only `p_ueberlieferung`. In RI IV,2,1 n. 41 King Konrad III (`RI004-002-K000316`) is `nennung p_komment`.

The data cannot say what the commentary or transmission states about the entry, which only the apparatus text shows.

(proposal, agent, 2026-11-20)

### US23 Kinds of regest and the citable source

As a diplomatist working on Staufer charters at a university, I want to filter or mark forgeries, Deperdita and inserted numbers by the regest identifier and reach the citable source from every regest, so that I can weigh a connection by the kind of record it comes from and cite the regest and its edition.

Acceptance criteria:

- The prefixes `†`, `D` and `D†` and a letter suffix of the number are shown as delivered and can serve as a filter or a mark in the view.
- Every regest links its persistent RI address, `https://www.regesta-imperii.de/id/` followed by its `persistent_identifier`.
- A delivered MGH link (`D_F_I_<n>`) is shown, and a regest without one says so.

RI IV,2,1 n. †83 (uid 22710, 1152 Mai 2) carries „Fälschung“ in its transmission and links only the digitised RI book page. RI IV,2,1 n. D101 (uid 22728) is a Deperditum whose transmission reads „erwähnt in DF. I. 158 (Reg. 435)“, and it links only the digitised RI book page. RI IV,2,1 n. D†318 (uid 22945) is both. RI IV,2,4 n. 3166a is an inserted number with the UUID `f81dd46b-c304-4999-91d5-1e16d11deb77` as `persistent_identifier` and no external links. RI IV,2,3 n. 2077 has the `persistent_identifier` `1174-05-23_1_0_4_2_3_304_2077` and links the MGH edition as `D_F_I_621`.

The data cannot grade the doubt behind a prefix, whose reasons stand in the transmission and commentary.

(proposal, agent, 2026-11-20)

## Requirements of the first slice (history)

The list below describes the first slice of 2026-11-09. It is superseded in parts by the shell and its revisions (design.md): there is no timeline of that form, no paper ground and no red pen, and the apparatus is no longer closed. It stays as history until the operator adopts the proposals above.

1. The interface consists of interactive visualisations of the holdings and a reading view per regest as their detail. The questions to the data are knowledge, not an interface view.
2. A timeline places every regest of the run at its delivered start date in front of the distribution of all regesta of the delivery per year. Mark height shows the number of statements, an empty mark the regest without statement, a triangle a regest corrected after review. The two regesta of the Adela case are joined by an arc generated from the same-name question.
3. A person graph shows actors and acts with every link taken from a triple, Adela's father as two nodes of the same name, and a deterministic layout computed at build time.
4. Pointing at a regest in the timeline marks its acts and people in the graph; pointing at or selecting a person marks her regesta in the timeline. Selection in either leads into the reading view.
5. The reading view shows the regest on paper and one readable sentence per act, every phrase bound to its evidence. Pointing, focus or selection underlines the evidence in red; pointing at words underlines the phrases resting on them. Keyboard: Tab into the paper, arrow keys through the evidence, Enter to the phrase, arrow keys through phrases, Enter or Space to select, Escape to clear.
6. The review state (asserted, technically checked, expert accepted) stands once per regest, by shape and fill, read from the run. Only deviations appear at a phrase: no own E13, or no evidence at all.
7. Agent notes, review findings, adjudication and corrections stay available per regest, closed.
8. The Diepold case is recognisable on the timeline, in the graph and from both reading views, each leading to the others.
9. Commentary and transmission from the regest CSV appear only as the edition's apparatus, closed, labelled as not being the basis of the statements.
10. Source wording appears in the serif on paper or as quotation, agent text in cool light, the red pen marks pointing and the open expert decision.
11. Every visualisation has a text equivalent and keyboard operation; meaning never rests on colour alone.

## Acceptance checks

The interface has no executable browser check since the check of the first slice (`checks/ui_check.py`) was retired on 2026-11-14; it is checked on the rendered state by the density check of `pruefansicht`, screenshots at 1280 and 360 px and a fresh reader (AGENTS.md). `checks/test_build.py` asserts that paraphrased or case-changed evidence aborts the build. The operator's screen review remains a separate acceptance step.

## Out of scope (first slice, history)

For the first slice of 2026-11-09: expert decisions and their persistence, the original-stage RDF, search, a cross-regest view of rights, references between acts and conditions, and any publication. The last item is stale, since the curated build is published on GitHub Pages since 2026-11-12 (AGENTS.md, Boundaries), and the factoid model carries references between acts and conditions; the other items were not rechecked on 2026-11-17.
