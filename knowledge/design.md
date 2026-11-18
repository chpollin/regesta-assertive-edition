---
type: design-document
title: Design
status: draft
scope: ui
language: en
created: 2026-11-09
updated: 2026-11-18
---

# Design

The design document of the edition interface, after the vault convention for design documents. Every piece of the operator's feedback on the interface is kept verbatim with its consequence and status in [ui-feedback.md](ui-feedback.md); read it before every rebuild and tick it off on the rendered state afterwards. Nothing in this document is accepted by the operator until ui-feedback.md says so.

## Agent briefing

No-build ES modules and plain CSS with cascade layers, prebuilt JSON, local fonts, no runtime CDN. The skill `web-style` and the vault yardstick "UI-Praxis für agentisch erzeugte Frontends" apply. Colour values live only in `css/tokens.css`; components use the tokens.

## Design system, since 2026-11-11

The operator rejected the dark stage, then the two tinted looks and red as lead colour („das Rot-Stichige passt mir gar nicht. Das ist schwer zu lesen. Kommen wir zu einem einfacheren, vollen, hellen Userinterface.“). The system follows his slide scheme, white ground, black text, links in `#0097A7`, so edition and slides match.

| Role | Token | Value | Use |
|---|---|---|---|
| Ground | `--stage` | `#ffffff` | page and drawing area, untinted |
| Sidebar ground | `--side` | `#f7f5f1` | the one sidebar |
| Text | `--text` | `#22201c` | all reading text, 16.3:1 on white, 14.9:1 on the sidebar |
| Muted text | `--muted` | `#4d4741` | secondary text, act marks and act names, the points of the whole delivery, 9.2:1 and 8.4:1 |
| Hairline | `--hairline` | `#e0dad1` | separators, rings, the shaded field |
| Edge | `--edge` | `#8f877c` | relation lines, 3.5:1 as a graphic |
| Accent | `--accent` | `#0097a7` | selection, pointing, the case, pressed controls, time marks; graphics only, 3.5:1 |
| Accent text | `--accent-text` | `#005c64` | text in the accent hue, links, family names, 7.7:1 on white, 7.1:1 on the sidebar |
| Accent faint | `--accent-faint` | `#e3f4f6` | the marked evidence in a regest |
| Second layer | `--layer2` | `#9c7a2e` | points with evidenced statements, 4.0:1 as a graphic, larger than the other points |
| Relations | `--rel-place`, `--rel-person` | `#a3367a`, `#4058c8` | same place and shared person of an opened regest in the cube (since 2026-11-18) |
| Density | `--bars` | `#d8d1c6` | regesta per year behind the time band |
| Map | `--map-coast`, `--map-river`, `--map-realm` | `#9a8f7f`, `#b3aa9b`, `#ece6da` | coast, rivers, the Empire about 1190 (darkened on 2026-11-18, coast 3.0:1 on the floor) |

## Colour

Decided on 2026-11-12. The operator left the choice to the implementing agent („farben die sehr gut für die webentwicklung und das tool passen. das kannst du ausarbeiten“); the warmer version W1 of the two compared on 2026-11-11 was worked out into the one palette above and the switch `?farbe=` removed. Reasons: his remark that the light design felt cold, his rejection of tinted grounds and of red, and his slide scheme with the accent `#0097A7`. So the ground stays white and the warmth lives in greys of a yellow-grey hue (OKLCH hue 68 to 85 with chroma at most 0.02, far from red); the teal accent keeps selection and pointing, and the second data layer takes an ochre that stays apart from the grey points and from the accent also under simulated protanopia, deuteranopia and tritanopia (OKLab distance at least 0.16) and is drawn larger, so colour never carries the distinction alone. Contrasts were computed for every pair in the table. Names take the medium weight and marks a slightly larger radius, as in W1.

Rules: light only, because no dark scheme reached the same legibility; text at least 7:1; no red anywhere; acts are neutral ink, the accent is reserved for what is selected or pointed at.

Typography: Instrument Sans for interface and graphics in two sizes (12.5 px names, 11 px numbers and direction words) and two weights; one stroke sign per relation family (16 unit grid, current colour) in place of the direction words, beside the family name in the sidebar and with the name as title at the rim of the circle and on the floor of the space view; Junicode only for source text; Space Mono only for code. Spacing follows the `--space-*` scale. Line weights: floor and directions lightest, rings, role edges 1 to 1.1 px, parent edges 1.75 to 1.9 px, accent lines 2 to 3 px; in the oblique space view weight and opacity follow nearness to the camera.

States: rest; pointed after a 90 ms dwell, ending after a 220 ms grace; selected (accent ring or accent column); dimmed (opacity 0.3); outside the time range (opacity 0.15 in the space view, absent in the flat view); pressed controls with an accent underline. Transitions only on opacity, none under reduced motion.

## Itinerar, the whole delivery

The operator's goal for the talk on 2026-11-20, verbatim: „Ziel ist es, wirklich eine sehr spannende Informationsvisualisierung mit dem gesamten Datenbestand zu haben.“ Two honest layers in one view: the whole delivery from CSV and register, built deterministically by `build_holdings.py` (no LLM), and the regesta with evidenced statements of the run, named as extracted by LLM-based agents, technically checked and not accepted. The view `#/itinerar` (`js/itinerary.js`) answers: where and when were Friedrich's documents issued?

- Ground plan is the map of the places of issue (register coordinates, checked against a box; skipped coordinates are logged in `holdings.json`), height is time, one point per regest with a place of issue at its `start_date`, the route joining them in time order, faint unless a time range is chosen.
- The core holding 95 percent of the documents fills the floor; the crusades are compressed beyond it, and the notes say so. A quiet base map (coast and large rivers from Natural Earth, public domain, `build_basemap.py` → `js/basemap.json`) is drawn only inside the undistorted core. Beneath it lies the Empire about 1190 as the faintest soft fill (`--map-realm`, blurred), a rough own digitisation after Shepherd's public-domain map (`build_realm.py`), named in the legend and under „Herkunft der Daten“ as this project's interpretation.
- Three snapping orthographic views (Schräg, Karte, Zeit), the cube fitted to the drawing area. Pointing finds the nearest point and drops a line to the floor; a click selects the place and opens the regest on the right.
- Since 2026-11-18 the cube is the Atlas (interface-plan.md, step 1): the filter bar of the plan replaces the sidebar (time band, place and person search with chips, eight kind chips, the layer chips Alle Regesten and mit Aussagen as the key of the point colours, the line „x von 1837 Regesten“ with reset, the result list); the flagged jumps are a switch „Sprünge“ in the tool row; the origin of the data stands behind the info mark. The cube is fitted to the box of the places of issue and the years, its time height follows the area. „mit Aussagen“ counts the run's regesta with at least one statement (119 with a place); the former legend counted all 146 run regesta with a place.

Relations of an opened regest (2026-11-18, after the operator's words on the cube with n. 135: „Hier sind diese Verbindungen noch viel zu dick. Können wir hier feinere Verbindungen machen und den Relationen auch eine Bedeutung geben? Gibt es ein Farbschema, wie man Bedeutung zwischen den Verknüpfungen ausdrücken kann? Vielleicht würden auch kleine Pfeile Sinn machen. Kann man das noch deutlich besser machen?“, relayed by the main session; not entered in ui-feedback.md by this session's write boundary). Three kinds, each with a colour and a form of its own: the stations before and after as accent lines of 1.4 px with an arrowhead in time direction; the other regesta of the same place as berry rings (`--rel-place` `#a3367a`) without lines; the regesta sharing a person as blue dashed hairlines (`--rel-person` `#4058c8`, 0.75 px, opacity 0.55), only the twelve nearest in time, all of them on a click in the legend, since 46 lines around n. 135 formed the grey wall. Accent, berry, blue and the ochre layer pass the palette validator of the dataviz method on white (all pairs at least 10 OKLab under the three colour-vision deficiencies, at least 18 with normal vision, contrast at least 3:1); the berry lies near red in hue and is a candidate for the operator's „no red“ rule. The route of the itinerary recedes to opacity 0.08 while a regest is open. Pointing at a related point names its number, the kind and the shared persons beside it. The legend at the graphic draws the same marks and keeps the counts.

Design round of 2026-11-18 (operator's six points on the Atlas with n. 1430 opened): the filter bar is 19rem wide with one inner padding of 1rem for every part, so the place names of the result list fit in a slightly smaller size; the tool row stands in groups (the four representations as one segmented switch, zoom as two small sign buttons, „frei gedreht“ with the way back to the default view only after the reader rotated, „Auffällige Wege“ as a toggle at the right end beside the info mark). While a regest is open, the floor names its place (accent text, bold) and the places of its related points (muted), dropping the least related name on a collision, and the standing names of the five busiest places step aside; a pointed point names its place on the floor. The opened point is a filled accent-text point of 7 px with a ring, the unrelated points recede to opacity 0.035; at rest nothing changes. Coast, rivers and realm are darker within the warm greys; the realm keeps its soft edge, since it is a rough digitisation and a crisp border would claim a precision it has not.

Plausibility check (`check_itinerary.py`, writes `data/itinerary-checks.json`): consecutive stations are flagged when they lie further apart than 150 km, or 60 km per day between their start dates. This threshold is a stated assumption, not taken from a read source. The literature that should replace it was found but not read: the itinerary monograph on Friedrich I. (1978) and an article on the travel speed of the royal court in the 11th and 12th centuries (Blätter für deutsche Landesgeschichte 123, 1987). Flags are classed by the first matching reason (dating without a day, another issuer, forgery, deperditum, same day at two places, inferred place, unclear). The check finds candidates; it does not prove a point right. A wrong coordinate that causes no impossible jump is not found, and whether the machine date fits the dating prose is not checked. The regest card names provenance and every flag of its point.

## Annotated regest, plan of 2026-11-12

Built on 2026-11-12 after the plan below. Deviations from the plan, decided on the screen: glosses hang below their word outside the text flow and move to a second row or aside where they would touch (`placeGlosses`); tags take the head's number style instead of the accent colour, so the page keeps six text styles; the card head names the review state of the whole regest (ungeprüft, teilweise geprüft, menschlich geprüft). Since the same day the statement's verbatim literals show too: short qualifiers in brackets at the tag („Ehe 3 (Witwe)“), conditions, grounds, amounts and exceptions as glosses under their passage.

The operator's direction, relayed by the Research Coordination: „Es soll quasi so sein, dass Urteil, Streit, Ehe und Amtsinhabe in der digitalen Edition direkt angemerkt sind … Wir checken das Endprodukt ja auch gleich ab.“ Review happens on the product, never in a separate form.

```text
Interface plan: regest card (citable page and detail panel), annotated

Readers and tasks
  reader of the edition: read the regest, see which statement the agent read from which words, with whom in which role
  the operator (local review build only): judge each statement, note what is missing, save the result

Parts, in order
  1. head line          purpose: which regest, when, where, state       main element: one line (unchanged)
  2. annotated text     purpose: the regest with its statements in place main element: the text
  3. Mehr               purpose: commentary, transmission, gaps, RDF   main element: closed details (unchanged)
  4. review (local)     purpose: one verdict per statement             main element: form, numbered as in 2
  Removed: the statement list under the text; the annotated text carries kind and participants, so the list said everything twice.

Main figure: the annotated text
  Shows: each statement as a bracketed passage. An opening tag before the passage names the kind and carries the
  statement's number („Urteil 1“), a thin closing bracket ends it; nested and crossing statements simply nest or
  cross their brackets, as in a critical apparatus, so no geometry is needed and 1102 nested and 87 crossing pairs
  of the run read the same way. Each participant's name inside the passage carries its role as a small gloss
  under the word, with the statement number where a name serves two statements („Beteiligte 2, Ehepartnerin 3“).
  A participant the text does not name in the passage stands after the opening tag. Pointing at a tag lights its
  passage.
  Terms: kind of statement (the vocabulary's German labels), role, „menschlich geprüft“ once a verdict exists.

Budget
  Text: no prose beyond the regest itself; tags one or two words, glosses one word each.
  Levels per statement: tag with number / passage / glosses.

States
  No statement: the text plain, one line „keine Aussage im Rahmen des Laufs“ (unchanged).
  Reviewed: the tag carries the verdict as a sign with its words as title (✓ stimmt, ✗ stimmt nicht, ? unklar),
  „menschlich geprüft“ in the title; the input itself never appears in the public build.
  Long or dense: tags wrap with the text; n. 103a, the densest case, is the acceptance case.

Wireframe, regest page at 1280 px
  | RI IV,2,2 n. 103a  (1152 Juni/Juli)  RI Online  ungeprüft                     |
  | [Urteil 1 ⟨ Vor König Friedrich ... wird der [Streit oder Klage 2 ⟨ Streit    |
  |                 Beteiligter 1                                                  |
  | zwischen Eufemia, [Ehe 3 ⟨ der Witwe Heinrichs von Hegilen ⟩ ...              |
  |          Beteiligte 2, Ehepartnerin 3      Ehepartner 3                        |
  | ... entschieden. ⟩                                                             |
  | ▸ Mehr                                                                          |

Agent review (local preview only, since 2026-11-14)
  build_site.py --preview writes site-preview/ (gitignored): at each statement of the twenty regesta the
  outcome of two LLM-based readers as sign and word („✓ Agenten: stimmt“, „? Agenten: unklar“,
  „≠ Agenten: strittig“), the readers' reasons unfolding below where the outcome is not „stimmt“; the card
  head says „von LLM-Agenten gelesen“ with model and date. Never „menschlich geprüft“. publish_site.py refuses
  the preview; the review list and the verdict form of 2026-11-12 are gone (knowledge/data.md, Agent review).
```

## Frontend by objects, 2026-11-14

Commissioned by the operator through the Research Coordination on 2026-11-14 (verbatim in ui-feedback.md); the plan was shown in the chat and built, since it carries out his rules 39 to 42 of the same day and holds no direction question of his. Accepted elements stay: the bundled circle, the annotated regest, the itinerary with the realm, the time band and the decade maps.

- Navigation by objects (rule 39): since 2026-11-18 Atlas, Regesten, Personen, Über, from `js/nav.json`. The representations of an object are a switch in the tool row above its main element, at the same place in every view: the Atlas with Würfel, Karte, Zeit and Jahrzehnte, Personen with Netz and Zeitband (Raum removed on the operator's decision of 2026-11-17, Liste left the switch; the person index stays as a page without JavaScript). The former object Orte (`#/itinerar`, `#/jahrzehnte`) forwards to the Atlas, `#/raum` to the Netz; every earlier view address keeps working.
- Start page: since 2026-11-18 the Atlas (`js/atlas.js`, mounted by `js/edition/start.js`), one window high, without the subtitle line and the worked-case link; the jump by RI number stands in the header of the start page and opens a regest with a place in the Atlas.
- Regest list, design round of 2026-11-18 (operator: „nicht die ganze Fläche sauber genutzt … ein bisschen unruhig“): the list fills the width up to the opened regest, which docks beside it at every width above 56rem and takes about a third of the window (28 to 40rem); rows of about 35 px under hairlines in aligned columns with quiet heads Jahr, Nummer, Ort, Aussagen, Regest; the family signs follow the place and replace the ochre dot (one mark, not two); a missing place is a grey dash with „ohne Ort“ as tooltip and screen-reader text, in the Atlas list too; the beginning of the regest text fills the free width in the small muted size and steps aside where the opened regest leaves the list narrower than 48rem and below 56rem.
- Regest list (since 2026-11-18, interface-plan.md step 2): the whole delivery in the frame of the Atlas, the shared filter bar with the text search first, year, number and place in every row, the kinds of a run regest's statements as signs and the ochre mark of the layer; a row opens the regest beside the list. Person index: a search and the eight family switches with sign and word above the list; the switches are the legend of the signs in the rows (rule 7), their state is kept in the address (`?q=`, `?art=`). The person index shows persons with a register entry first by number of regesta, then actors named only by the regest's wording as a group of their own; the column of roles is gone, since the family signs show the kinds of relation and the person page the roles, so a row keeps one line except for the longest register names. Counts are named by their unit: the person list counts regesta of the run with statements, the start page regesta of the whole delivery. Below 40 rem both lists become two-line entries without horizontal scrolling. Page titles of the two lists stand for screen readers only, since the head marks the object.
- Regest card (2026-11-14, after the operator's „Mehr … schlecht“, „nicht der ganze Platz genutzt“, „extrem textlastig“, „Nächstes … überhaupt nicht gut“): one head line of signs and short words (date, place, RI Online, the files TEI, TTL, JSON, the agents' state) with paging as two arrows at its end; text and notes use the page width (text up to 44rem, notes beside); a note shows number, kind, qualifier and the agents' sign (✓ alone, otherwise sign and word), and its participants and the readers' reasons appear while the note or its passage is pointed at or focused; „Mehr“ is gone, transmission and commentary of Regesta Imperii stand below the text, model gaps, review findings and RDF stay in the files.
- Checked by an independent read-only reviewer on 2026-11-14; fixed after its report: focus kept on the year handle of the start page, search folding that finds „Lowe“ for „Löwe“, list links without underline at rest, the family switches with the full family names of the sidebar, units of the counts, a sentence for the empty filter result. Open from the same report: role glosses of n. 103a that drop to a second row or stand off their word, no legend of the node shapes in network and space view, the h3 headings under „Mehr“.

## Revision after the operator's look, 2026-11-14

- Annotated regest: the bracketed tags and role glosses inside the sentence are retired („unübersichtlich“). The text keeps a small number where a statement's passage begins; each statement is a note beside the text at the height of its passage, with kind, qualifiers, verdict and the participants grouped by role; pointing at either lights the other. Below 760 px card width, and in the detail panel, the notes follow the text as a numbered list (`notedText`, `notesOf`, `placeNotes` in `js/regest-card.js`).
- Whole network: overview first. Without a selected person, `js/person-overview.js` draws the forty persons most often named in statements, without the person who takes part in nearly all of them (Friedrich), named in one line with the way to his circle; a line joins persons who share statements, its weight their number; a deterministic force layout. The former drawing of all 1101 nodes is gone.
- Start page: no list of places under the map (the circles are links with name and count), a short caption, the persons' unit as column head, no lead sentence above the example.
- One page „Über die Edition“; `methode/` and `daten/` forward to its sections. The head has four items (since 2026-11-18): Atlas, Regesten, Personen, Über. Since 2026-11-18 (interface-plan.md, step 4) the page holds two sentences, a process graphic of seven steps after knowledge/pipeline.md on one line, each with the sign of its producer (Skript as braces, LLM-Agent as two figures in the accent text colour, Person as one figure) and a key of the three signs, the open human check drawn dashed with „steht aus“; the notes of the steps are read out and do not stand on screen; downloads, licence, attribution and the imprint placeholder follow as one short block.

## Zeitband and Jahrzehnte

Both views answer where and with whom over time, from the whole delivery without LLM. Revised on 2026-11-12 after the operator's question whether colour and the places could mean more (verbatim in ui-feedback.md).

- Zeitband: a tick per mention; a line joins two mentions at most three years apart, so a long silence stays open. Years in which more than half of at least three places of issue lie south of the Alps stand as pale bands; the rule reproduces the known Italian campaigns from the data. Names in the accent also appear in the run's statements, said so in the legend. Order by frequency, first mention or name; thirty persons by default, so the first screen needs no scrolling; rows of 28 px on narrow touch screens.
- Jahrzehnte: lightness, not a new hue, tells a place of issue new in its decade (dark) from a return (light), because ochre belongs to the evidenced statements and the accent to the selection. Up to four place names per map without overlap, two on small maps; the Empire about 1190 as in the itinerary; decades with fewer than ten regesta join their neighbour (the 1130s with the 1140s).

## Shell

One frame for every view, after Shneiderman's mantra as the operator asked: overview first in the drawing area, zoom and filter in the sidebar on the left, details on demand in a narrow panel on the right that exists only while something is selected. The header carries the title and the navigation from `js/nav.json`, the current place underlined in the accent. In a view the three columns fill exactly one window; below 56 rem drawing, detail and filters stack in that order. Text pages use the same header without sidebar.

Since 2026-11-18 every view builds one frame from `js/filterbar.js`: the filter bar on the left (time band, place, person, kinds, layer, and the text search in the list), the count line „x von y Regesten“ with the reset, the result list, the tool row with the switch above the main element, the opened regest over its right edge, the filter sheet below 56rem. One rule decides which regesta of the delivery pass the facets (`js/selection.js`), so Atlas, Regesten and Zeitband give the same count for the same facets; the Netz counts the regesta with statements. A facet a view cannot evaluate stands greyed with a tooltip (the layer in the Netz, the text search outside the list while the address carries it). The facets live in the query string (`von`, `bis`, `ort`, `person`, `art`, `schicht`, `q`), and links of the header and of a switch carry them to the next view (`carryFilters` in `js/url.js`); the hash keeps object, representation and opened regest. The former sidebar (`js/sidebar.js`) with family rows that hid a family when switched off is gone; a pressed kind now narrows, as everywhere.

## Regest component

`js/regest-card.js`, one component in every view's detail panel and on the citable page `#/regest/<uid>[/<claim>]`. It answers: what does this regest say, and which statement rests on which words? Three parts: a head line (number, date, place, link to Regesta Imperii Online, the review state once as „ungeprüft“ with a tooltip), the regest text in the reading face with every evidence span underlined, and the statements as a compact black list (kind, participants with role; „ohne genannte Beteiligte“ where the regest names none). Pointing at a statement lights its passage and the reverse. Commentary, transmission, model gaps, review findings and RDF sit behind one „Mehr“. Regesta without statements show head, text and the provenance note. The selection stays marked in the drawing (`is-pinned`).

## Header and footer

- Header (2026-11-14): the title „Barbarossa-Regesten“ with a small accent tag „Experiment“, the four objects on the right; it wraps to two lines below the width of title and navigation. The former title „Barbarossa-Regesten mit belegten Aussagen“ was „kein guter Titel“ for the operator; the short title is the implementing agent's reversible choice, in `edition/texts.json`.
- Footer: one quiet line, the licence on the left, „Über die Edition“ on the right.

## Person graph

- Data abstraction: actors (persons and groups, merged by IRI as the RDF merges them) and acts with at least one actor; role edges between act and actor, parent edges, the same-name pair. Co-mention creates no link.
- Encoding: persons as circles, groups as squares, acts as small diamonds; persons and groups take the colour of their estate (Herrscher gold, geistlich plum, weltlich olive, ohne Angabe grey; `js/stand.js`, data.md Estate), after the operator's „Warum muss die Netzwerkvisualisierung alles nur schwarz sein?“ of 2026-11-14; acts stay neutral; parent edges heavier, the same-name pair dashed. Around a selected person eight fixed sectors (`js/relations.js`), marked by the family's sign at the rim. The same shapes hold in the persons overview, where groups are squares too; the person left out of the overview (Friedrich) stands as a greyed, dashed node with his number of regesta in the free upper corner and opens his circle (interface plan, text replaced by elements).
- Key of the signs (2026-11-14, open finding of the reviewer): one quiet line at the lower right of the drawing (`js/shape-key.js`), listing only the signs the current drawing contains, drawn with the figures' own classes. The drawing leaves the key's height free below it, so no sector sign at the lower rim lies under it at 360 px. The persons overview names size and line as numbers of statements.
- Layout: a force layout computed once in `build_data.py` from a fixed start, so every build gives the same picture; the circle around a person is computed in the browser.
- Overview first around a dense person (operator's feedback of 2026-11-12): the circle keeps one radius for both axes and fits the smaller side of the drawing area. A sector with more than twelve relations around the centre stands as one round bundle with its count of regesta, the same number as the family row in the sidebar, joined to its three most connected people; the bundle or the sector's sign opens it on click, Enter or Space, and a second click closes it. A sector opens by itself when the family filter leaves it alone or the time window thins it below the limit. A person with few relations, such as Adela, is drawn as before.
- Label widths are measured in the label font (semibold), never below 7.4 px per character, after short words had been underestimated.
- Labels avoid labels, nodes and edges; what finds no place appears on pointing. Pointing highlights after a 90 ms dwell and ends after a 220 ms grace.
- Uncertainty: local identities stay visibly empty; two identities with the same name stay two nodes because the RDF keeps them apart.

## Evidence

Measurements and screenshots of 2026-11-11 are recorded in `journal.md`; screenshots lie in the session scratchpad and are the implementer's own check. None of it is the operator's acceptance; ui-feedback.md records what is done on screen.

## Sources

Vault notes read for the first states: "Daten- und Task-Abstraktion", "Nested Model der Visualisierungsgestaltung", "Graphical Perception und Kanalrangfolge", "Fehlende und unsichere Daten visualisieren", "Visualisierung von Kulturerbe-Sammlungen", "Barrierefreie Datenvisualisierung", "Evaluation von Visualisierungen", and the yardstick "UI-Praxis für agentisch erzeugte Frontends" with its section "Messung statt Selbstauskunft". The space-time cube study of the coordination (seven sources read in full) grounds the itinerary and the space view, see [space-view.md](space-view.md). Following the Nested Model, none of this validates the abstraction; that needs historians working on their own questions.

## Persons in the space-time cube

Built on 2026-11-14 after the operator's question whether persons could join the space-time cube. A person of the register with at least three regesta (holdings.json) is searched in the itinerary's sidebar and becomes the trace of the regesta that name them through places and years; a second person can be added for comparison, the regesta naming both marked with a ring and counted. The first person is drawn in the accent, the second in the text ink with a dashed trace; the other points recede. The list in the sidebar shows the regesta of the selection, place and persons combined, each opening its card. The address keeps the persons (`?person=` since 2026-11-18; `?personen=` is read once and rewritten). The person views lead there („Spur im Atlas“ under the person picker). The network is not dissolved: the circle around a person with its fixed directions stays, since the relations with roles exist only for the regesta of the run, while the register names persons for the whole reign.

## One pass over the shell, 2026-11-14 evening

Three verdicts of the operator within an hour (regest page, place view, start page; ui-feedback.md) share one core: more room for the figure, fewer layers, clear areas, a narrow sidebar with signs and tooltips. They are one pass over the shell, in this order: the regest page with its areas and the annotation system first, since the tooltip of the cube and the start page reuse them; then the start page and the place view.

## Regest page

Since 2026-11-18 (interface-plan.md, step 3; the operator accepted on 2026-11-17 that the head line replaces the metadata column of 2026-11-14):

```
+-------------------------------------------------------------------------------------------+
| RI IV,2,2 n. 103a  (1152 Juni/Juli)  Regensburg  ungeprüft    RI Online  TEI TTL JSON  Zitieren  Digitalisate ▾  ← → |
+-------------------------------------------------------------+-----------------------------+
| regest text, reading face, a chip (family sign and number)  | 1 Urteil (erwählten Richters)|
| where a statement's passage begins                          |   at the height of passage 1 |
| legend: the families present                                | 2 Streit oder Klage ...      |
+-------------------------------------------------------------+-----------------------------+
| Apparat der Regesta Imperii, unverändert: Originaldatierung, Überlieferung | Kommentar, Literatur, Anmerkungen |
+-------------------------------------------------------------------------------------------+
```

- Head line: the number is the page's heading, with the word „Fälschung“ where the dagger stands; dating, place; „ungeprüft“ once, its popover naming producer, LLM and date of the run, in the preview the agents' reading with model and date, and that no person has checked; then RI Online, the three files, „Zitieren“ (copies the citation of this edition with the page address; the card in the views copies the citation of Regesta Imperii), one menu for the facsimile links of the delivery, and the paging arrows with the way back to the view.
- Below, the text (up to 46rem) and the notes at the height of their passages; a note shows chip, kind, qualifiers and, in the preview, the agents' verdict, its participants while it or its passage is pointed at or focused. Below 760 px of page width the notes follow the text as a numbered list.
- The apparatus of Regesta Imperii in two columns over the full width, named by its producer in its heading. The former producer paragraphs, the field „Prüfstand“ and the citation forms as text are gone; the unchecked status stands once per screen.

## Annotation system

The rule for every annotated regest text in the edition, on the page, in the detail panel and in tooltips:

- A statement opens where its evidence passage begins, with one chip: the sign of its relation family (js/relations.js, the same signs as at the rim of the circle and in the lists) and its number. Several statements opening at one place stand as several chips.
- The passage itself carries no mark at rest, since passages nest and overlap (a judgment spans the whole sentence that contains its dispute); its extent appears, as a tint with an accent underline, while the passage, its chip or its statement is pointed at or focused.
- The statement in the comment area repeats chip, kind and number, then the verbatim qualifier in quotation marks („Witwe“), the participants by role, further literals (Ausnahme, Begründung) with their wording, and a word plate with the readers' verdict, named by its producer („LLM: stimmt“, „LLM: unklar“, „LLM: strittig“, since 2026-11-18 after a fresh reader could not tell who had said „stimmt“); the plate carries no glyph, because the family sign of Bestätigung is a check mark.
- A legend under the text names the families present on the page with their signs.

