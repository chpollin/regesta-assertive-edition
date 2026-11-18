---
title: Space view
status: superseded
language: en
created: 2026-11-11
updated: 2026-11-18
---

# Space view

Superseded on 2026-11-18. The operator decided on 2026-11-17 that the view Raum goes (interface plan, accepted with that point; journal of 2026-11-17), because the space-time cube of the Atlas carries places and time and the circle around a person carries the relations; the code (`js/space.js`) and its CSS were removed with step 2 of the interface plan, and its addresses `#/raum[/<actor>]` forward to Personen, Netz. The text below describes the removed view and stays as history.

A named variant beside the holdings view of [design.md](design.md). It answers the operator's question of 2026-11-11, given at the person graph: „Könnte man dieses Netzwerk irgendwie auch in einer Raumzeit-Dimension drehbar machen? Vielleicht könnten die Richtungen hier auch etwas bedeuten: dass bestimmte Richtungen schon bestimmte Relationen darstellen. Dann kann ich quasi dieses Netzwerk in einem 3D-Bereich bewegen.“ The holdings view stays the canonical state and the fallback for keyboard and screen readers. Whether the variant stays, replaces a part of it or goes is the operator's decision at the screen.

## Interface plan

```text
Interface plan: space view, route #/raum and #/raum/<actor IRI>

Readers and tasks
  Historian in the talk: rotate the network, follow one person's relations in time order,
  see which kind of relation lies in which direction, open the statement behind a relation.

Parts, in order
  1. Tool line  purpose: rotate, zoom, return to the starting position, leave for the 2D view
     main element: buttons and one status line naming what the pointer touches
  2. Scene      purpose: the network in a space with time as height  main element: figure (SVG)
  3. Panel      purpose: the selected person's relations in time order with links into the
     reading views  main element: list
  Subpages: none. Kept fixed: header, navigation, holdings view, reading view.
  Removed: nothing; the nav gains the link "Raum".

Main figure
  Shows: time runs upwards along a vertical axis with a year scale. On the floor ring the eight
  relation families of js/relations.js stand in their fixed directions (north kinship and
  marriage, east confirmation, and so on), so a direction means the same as in the 2D sectors.
  Terms: Jahr, the eight family names, Person, Vorgang, Elternteil, gleicher Name.

Budget
  Text: the panel hint is one sentence; no prose in the scene.
  Levels per recurring entry (panel relation): year and act type with regest link / the other
  people as buttons. Two levels.
  Levels above the first entry: tool line / person name. Two levels.
  Links inside an entry: the regest as text link; people are buttons that select them.

Shown to the person            Evidence only
  name, act type, year, regest   IRIs, claim keys, x/y layout values
  year only as position on the axis and at the relation, where it orders the reading

To take away: nothing.

States
  Empty: without a selection the panel says in one sentence to choose a person in the scene
  or in the selection field, and offers the same-name case.
  Error: a person IRI in the address that the graph lacks opens the whole network.
  Long or dense: Friedrich has relations in many regesta; the panel scrolls in its column,
  labels in the scene are placed greedily and the rest appears on pointing.

Wireframe, 1280 px
  +----------------------------------------------------------------+
  | shared header                                Zeit und Personen Raum |
  +----------------------------------------------------------------+
  | [Zurück zur Ausgangslage] [+] [-] [Ganzes Netz] 2D-Ansicht  status |
  | +--------------------------------------------+ +-------------+ |
  | |            1189 -                          | | Adela       | |
  | |    Bestätigung  |   . Verwandtschaft       | | 1147 Eltern-| |
  | |        .        |  /                       | |  teil ...   | |
  | |   1150 -  ------+---- Übertragung          | | 1153 ...    | |
  | |   (floor ring with eight family names)     | | [Person ▾]  | |
  | +--------------------------------------------+ +-------------+ |
  +----------------------------------------------------------------+
  360 px: tool line wraps, scene below at 62 percent of the window height, panel below.
```

## Decisions

### Projection and library

An own perspective projection in SVG. The run has under two hundred nodes and edges, so updating the attributes of a few hundred SVG elements on each rotation step is cheap, and SVG keeps pointer events, text rendering and accessible names that a canvas would need to rebuild. No library is vendored. Rotation is yaw about the time axis and pitch of the camera; at a pitch of ninety degrees the camera looks straight down the time axis, and the picture is then the 2D sector arrangement with north up and east to the right.

### Time axis

Time runs upwards, earliest at the bottom, as in a space-time cube of time geography. Each act sits at the fractional year of its regest's `start`, as the timeline does, so the dating rule stays one rule across views (n. 103a sits in 1138 by its machine date).

### Directions

Every act takes the angle of its family from `familyOf` and `directionOf`. Inside the 45-degree sector of a family the acts spread in time order over the middle 36 degrees, so acts of one family in one regest stand side by side. Directions are measured from the vertical axis of the scene.

### Persons

A person is a vertical column, drawn as a thin line from the first to the last year in which it is connected and a dot at every such year. Every role edge runs from the act to the person's column at the act's year, so a relation is horizontal and only the continuity of a person runs vertically. This keeps the reading rule simple: height is time, horizontal distance is relation.

Two layouts share this rule.

- Whole network (`#/raum`). Acts stand on a ring around the axis. A person stands at the mean of its acts, pushed outwards, with a small deterministic offset from the build-time 2D layout so people of the same act do not coincide. A person who is only connected by parent edges stands in the kinship direction.
- One person (`#/raum/<IRI>`). The selected person becomes the axis, spanning its years. Its acts stand around it in their family direction at their year, the other people of each act further out in the same direction, the parents and children in the kinship direction, and the same-name partner beside them. A person who shares several acts with the selected one keeps one column, so recurrence over the years is a vertical line. This is the layout in which direction means the same thing as in the 2D view, measured from the selected person.

### Labels

Standing labels for the year scale, the eight families, the selected person, its direct neighbours and the three identities of the same-name case. A greedy placement after each projection drops any label that would overlap one already placed, in this priority order, so no two standing labels overlap at any rotation. Every other name appears on pointing, and the status line names it.

### Keyboard, motion and the 2D fallback

The scene is one tab stop. Arrow keys rotate, plus and minus zoom, Home resets. Persons are reached by keyboard through the selection field and the buttons in the panel, which also show their label in the scene on focus. Rotation follows input directly and never runs by itself, so `prefers-reduced-motion` needs no separate branch; no transition is animated. The 2D view is linked from the tool line as the full keyboard and screen-reader path.

### Depth, time scale and the two looks

After the operator's feedback on the dark scheme of 2026-11-11, verbatim: „Ja, mir gefällt der dunkle Hintergrund noch nicht. Ich glaube, wir können nochmal am User Interface, am Design und an der Ästhetik arbeiten. Diese 3D-Grafik geht auf jeden Fall in die richtige Richtung. Wir sollten aber auch nochmal sinnvoll durchüberlegen, wie wir sie dann vielleicht noch filtern und sortieren können, wie wir weitere Daten dort ein- und ausschalten können und wie wir das sozusagen als einen zentralen Hauptview auch direkt auf der Startseite integrieren.“ Consequences, draft:

- Depth reads through weight. Rings are drawn as segments, and every ring segment, spoke and edge takes opacity and line weight from its distance to the camera, so near parts are stronger than far ones.
- The height spans only the selected person's years, with a scale of one, two, five, ten or twenty years and at most eight ticks; the numbers are placed before any other label. Adela's case now fills the scene from 1146 to 1154 instead of a knot under empty decades.
- The floor and its directions are the quietest layer, with the same short direction words in capitals as the 2D circle.
- Two looks for the operator's choice, `?look=a` (warm paper and red) and `?look=b` (slate and blue). Each has one accent for selection, case and pointing; acts are neutral ink. The dark grounds are lifted off black and tinted. The parameter is a shortcut for the comparison and goes once a look is chosen.

### Snapping views, time slice and corpus mode

After the space-time cube study of 2026-11-11 (seven sources read in full by the coordination; recommendation and build order relayed with the operator's words „aber nicht, dass wir es überingenieren“), draft:

- Three snapping views in orthographic projection, Schräg (oblique, the overview), Aufsicht (top, time flattened into the aggregated network) and Seite (side, seen from the east so north and south spread). A segmented control switches them with a 450 ms eased transition, at once under reduced motion. Dragging or arrow keys turn the scene freely and mark it „frei gedreht“; Home returns to the oblique view. From above the year scale hides, because the time axis is a point.
- A time slice of one, five or ten years, moved by a range control. Inside the slice everything keeps its weight, outside it steps back to 15 percent, labels outside the slice do not stand, and two accent rings bound the slice.
- Corpus mode, a trial, replaces the former whole network: no centre person, every node at the one build-time 2D layout over all years, so a person's column stays vertical; acts at their year. The eight floor directions are hidden there, because fixed directions belong to the ego view; the family is a filter. Filters by family (with act counts) and by the minimum number of statements of a person (default two), and a coupled list of the shown acts in time order whose rows light the act in the scene.
- One line says what applies (person or corpus with filter and count, view, years) with a reset. View, slice and corpus filters live in the query string (`ansicht`, `breite`, `jahr`, `familie`, `mindestens`) and come back on reload; the hash keeps route and person.
- Not built, after the study: transparency of the whole cube, animation running by itself, layouts per year, lenses, VR. The time band view and juxtaposed slices wait until the operator has seen the snapping views and the slice.

Checked in Chromium at 1280 × 800 light and dark and at 360 px: every view and the slice set the pressed button, the line and the address; reload restores them; no person column bends in the corpus; no console errors; no horizontal overflow. Not accepted by the operator.

## Evidence

Screenshots `space-*.png` in the session scratchpad of 2026-11-11 and the Playwright assertions run there. They are the implementer's own check and not the operator's acceptance.
