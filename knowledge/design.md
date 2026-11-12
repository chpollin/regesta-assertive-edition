---
type: design-document
title: Design
status: draft
scope: ui
language: en
created: 2026-11-09
updated: 2026-11-11
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
| Density | `--bars` | `#d8d1c6` | regesta per year behind the time band |
| Map | `--map-coast`, `--map-river`, `--map-realm` | `#cfc8bc`, `#ddd6cb`, `#efeae1` | coast, rivers, the Empire about 1190 |

## Colour

Decided on 2026-11-12. The operator left the choice to the implementing agent („farben die sehr gut für die webentwicklung und das tool passen. das kannst du ausarbeiten“); the warmer version W1 of the two compared on 2026-11-11 was worked out into the one palette above and the switch `?farbe=` removed. Reasons: his remark that the light design felt cold, his rejection of tinted grounds and of red, and his slide scheme with the accent `#0097A7`. So the ground stays white and the warmth lives in greys of a yellow-grey hue (OKLCH hue 68 to 85 with chroma at most 0.02, far from red); the teal accent keeps selection and pointing, and the second data layer takes an ochre that stays apart from the grey points and from the accent also under simulated protanopia, deuteranopia and tritanopia (OKLab distance at least 0.16) and is drawn larger, so colour never carries the distinction alone. Contrasts were computed for every pair in the table. Names take the medium weight and marks a slightly larger radius, as in W1.

Rules: light only, because no dark scheme reached the same legibility; text at least 7:1; no red anywhere, the old role names `--pen` and `--machine` point to the accent text; acts are neutral ink, the accent is reserved for what is selected or pointed at.

Typography: Instrument Sans for interface and graphics in two sizes (12.5 px names, 11 px numbers and direction words) and two weights; one stroke sign per relation family (16 unit grid, current colour) in place of the direction words, beside the family name in the sidebar and with the name as title at the rim of the circle and on the floor of the space view; Junicode only for source text; Space Mono only for code. Spacing follows the `--space-*` scale. Line weights: floor and directions lightest, rings, role edges 1 to 1.1 px, parent edges 1.75 to 1.9 px, accent lines 2 to 3 px; in the oblique space view weight and opacity follow nearness to the camera.

States: rest; pointed after a 90 ms dwell, ending after a 220 ms grace; selected (accent ring or accent column); dimmed (opacity 0.3); outside the time range (opacity 0.15 in the space view, absent in the flat view); pressed controls with an accent underline. Transitions only on opacity, none under reduced motion.

## Itinerar, the whole delivery

The operator's goal for the talk on 2026-11-20, verbatim: „Ziel ist es, wirklich eine sehr spannende Informationsvisualisierung mit dem gesamten Datenbestand zu haben.“ Two honest layers in one view: the whole delivery from CSV and register, built deterministically by `build_holdings.py` (no LLM), and the regesta with evidenced statements of the run, named as extracted by LLM-based agents, technically checked and not accepted. The view `#/itinerar` (`js/itinerary.js`) answers: where and when were Friedrich's documents issued?

- Ground plan is the map of the places of issue (register coordinates, checked against a box; skipped coordinates are logged in `holdings.json`), height is time, one point per regest with a place of issue at its `start_date`, the route joining them in time order, faint unless a time range is chosen.
- The core holding 95 percent of the documents fills the floor; the crusades are compressed beyond it, and the notes say so. A quiet base map (coast and large rivers from Natural Earth, public domain, `build_basemap.py` → `js/basemap.json`) is drawn only inside the undistorted core. Beneath it lies the Empire about 1190 as the faintest soft fill (`--map-realm`, blurred), a rough own digitisation after Shepherd's public-domain map (`build_realm.py`), named in the legend and under „Herkunft der Daten“ as this project's interpretation.
- Three snapping orthographic views (Schräg, Karte, Zeit), the cube fitted to the drawing area. Pointing finds the nearest point and drops a line to the floor; a click selects the place and opens the regest on the right.
- Sidebar: place picker with counts, the shared time band, a two-line legend with sign and count (regesta with a place of issue, of them with statements), the switch for flagged jumps, „Herkunft der Daten“ folded, the regesta of the selected place.

Plausibility check (`check_itinerary.py`, writes `data/itinerary-checks.json`): consecutive stations are flagged when they lie further apart than 150 km, or 60 km per day between their start dates. This threshold is a stated assumption, not taken from a read source. The literature that should replace it was found but not read: the itinerary monograph on Friedrich I. (1978) and an article on the travel speed of the royal court in the 11th and 12th centuries (Blätter für deutsche Landesgeschichte 123, 1987). Flags are classed by the first matching reason (dating without a day, another issuer, forgery, deperditum, same day at two places, inferred place, unclear). The check finds candidates; it does not prove a point right. A wrong coordinate that causes no impossible jump is not found, and whether the machine date fits the dating prose is not checked. The regest card names provenance and every flag of its point.

## Shell

One frame for every view, after Shneiderman's mantra as the operator asked: overview first in the drawing area, zoom and filter in the sidebar on the left, details on demand in a narrow panel on the right that exists only while something is selected. The header carries the title and the navigation from `js/nav.json`, the current place underlined in the accent. In a view the three columns fill exactly one window; below 56 rem drawing, detail and filters stack in that order. Text pages use the same header without sidebar.

The sidebar (`js/sidebar.js`) is the same in the flat and the space view: person picker; time band (`timeBand`, shared with the itinerary) with the regesta per year of the delivery as a quiet ground, the selection's years as accent ticks and two handles; the eight families as rows, each a switch in front, name and count, unfolding to its acts; the line saying what applies only when a filter deviates, with a reset. Filter state lives in the query string (`von`, `bis`, `familien`), view settings too (`ansicht`, `mindestens`), the hash keeps route and person.

## Regest component

`js/regest-card.js`, one component in every view's detail panel and on the citable page `#/regest/<uid>[/<claim>]`. It answers: what does this regest say, and which statement rests on which words? Three parts: a head line (number, date, place, link to Regesta Imperii Online, the review state once as „ungeprüft“ with a tooltip), the regest text in the reading face with every evidence span underlined, and the statements as a compact black list (kind, participants with role; „ohne genannte Beteiligte“ where the regest names none). Pointing at a statement lights its passage and the reverse. Commentary, transmission, model gaps, review findings and RDF sit behind one „Mehr“. Regesta without statements show head, text and the provenance note. The selection stays marked in the drawing (`is-pinned`).

## Person graph

- Data abstraction: actors (persons and groups, merged by IRI as the RDF merges them) and acts with at least one actor; role edges between act and actor, parent edges, the same-name pair. Co-mention creates no link.
- Encoding: persons as circles, groups as squares, acts as small diamonds in neutral ink; parent edges heavier, the same-name pair dashed. Around a selected person eight fixed sectors (`js/relations.js`), marked by the family's sign at the rim.
- Layout: a force layout computed once in `build_data.py` from a fixed start, so every build gives the same picture; the circle around a person is computed in the browser.
- Overview first around a dense person (operator's feedback of 2026-11-12): the circle keeps one radius for both axes and fits the smaller side of the drawing area. A sector with more than twelve relations around the centre stands as one round bundle with its count of regesta, the same number as the family row in the sidebar, joined to its three most connected people; the bundle or the sector's sign opens it on click, Enter or Space, and a second click closes it. A sector opens by itself when the family filter leaves it alone or the time window thins it below the limit. A person with few relations, such as Adela, is drawn as before.
- Label widths are measured in the label font (semibold), never below 7.4 px per character, after short words had been underestimated.
- Labels avoid labels, nodes and edges; what finds no place appears on pointing. Pointing highlights after a 90 ms dwell and ends after a 220 ms grace.
- Uncertainty: local identities stay visibly empty; two identities with the same name stay two nodes because the RDF keeps them apart.

## Evidence

Measurements and screenshots of 2026-11-11 are recorded in `journal.md`; screenshots lie in the session scratchpad and are the implementer's own check. None of it is the operator's acceptance; ui-feedback.md records what is done on screen.

## Sources

Vault notes read for the first states: "Daten- und Task-Abstraktion", "Nested Model der Visualisierungsgestaltung", "Graphical Perception und Kanalrangfolge", "Fehlende und unsichere Daten visualisieren", "Visualisierung von Kulturerbe-Sammlungen", "Barrierefreie Datenvisualisierung", "Evaluation von Visualisierungen", and the yardstick "UI-Praxis für agentisch erzeugte Frontends" with its section "Messung statt Selbstauskunft". The space-time cube study of the coordination (seven sources read in full) grounds the itinerary and the space view, see [space-view.md](space-view.md). Following the Nested Model, none of this validates the abstraction; that needs historians working on their own questions.
