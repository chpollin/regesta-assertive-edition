---
title: Design
status: proposal, not accepted by the operator
language: en
created: 2026-11-09
updated: 2026-11-09
---

# Design

This document is a proposal by the implementing agent and has not been accepted by the operator. It records the second design state of 2026-11-09, which answers three judgements of the operator on the first state: the overview was too text-heavy, the questions to the data should not be an interface of their own but interactive visualisations of the holdings, and the reading view and the site as a whole needed better design. The rules come from the web-style skill, the vault documents "UI-Praxis für agentisch erzeugte Frontends", "Moderne CSS-Praxis" and the visualisation notes named under Sources, and from the operator's recorded judgements (few structures, no eyebrows, no decorative counters or numbering, few lines, descriptive names, no middle dot, no box around every text).

## Visual language

The site speaks the language of the narrated film of the same project, as fixed in `regesta-promptotyping-video/knowledge/design.md`, section "The dark stage of the narrated film". Colour has fixed roles there, and the interface takes them over.

- The stage is dark. Dark is the designed default, light is derived from the same tokens and follows the reader's system preference.
- The edition's source text lies on warm paper in Junicode. The paper is the only surface on the page and keeps its light colour in both schemes, so source text always looks the same.
- What a machine wrote is set in cool light: the statements of the extraction agent, the notes of agents, the marks of the run on the timeline, the act nodes.
- The red pen marks what a person points at or decides: the underline of the selected evidence and phrase, the open expert decision in the review state, the selected node, and the Adela case that the operator points to in his talk.
- Authored interface text is light grotesque. Space Mono is reserved for code, here the RDF of a statement and IRIs where they are the point.

The film's grain, vignette and camera are left out, because an interface is read, not watched. Contrast follows the accessibility minima: authored and machine text on the stage and ink on paper stay well above 4.5:1 by their OKLCH lightness distance; the measured check is open.

## Operator feedback on the holdings view, 2026-11-11

Verbatim, given at the screen on the factoid version and relayed by the Research Coordination: „Hier finde ich, es sind auch ein bisschen zu viele Ebenen. Jetzt haben wir hier zwei Grafiken. Die machen schon zu sehen, aber ich muss ja runterscrollen. Also müssen wir das entweder auf eigene Views überführen oder wir können sinnvoll zusammenführen. Ich finde, es ist nach wie vor viel zu textlastig.“

Consequence, built as a draft on 2026-11-11 and not yet accepted: one view that fits 1280 × 800 without scrolling. A narrow time strip across the full width, the person graph as the main surface below it, a panel on the right for the selection. Page title and section headings are gone from sight (the title stays for screen readers), legends sit behind a question mark, the lists are a switch in the panel, the case appears only when Adela or her fathers are selected and is preselected on entry. Graph labels show for the selection, its neighbours, the case and the most connected people; the rest appears on pointing and focus. At narrow width the three parts stack.

Second feedback the same day, verbatim from the operator at the connected view: „Ich sehe, dass im Herzen der Friedrich ist … Dann sehe ich hier, dass sich manche Wörter überschneiden. … Vielleicht könnten die Richtungen hier auch etwas bedeuten: dass bestimmte Richtungen schon bestimmte Relationen darstellen. Dann kann ich quasi dieses Netzwerk in einem 3D-Bereich bewegen.“ Consequence, draft: acts are drawn as diamonds, apart from persons (circles) and groups (squares). A selected person gets its own circle: its relations stand in eight fixed sectors, one per relation family of `js/relations.js`, named at the rim, with the other people of each act further out on the same bearing; deselecting returns to the whole network. Labels are placed with collision avoidance in both modes, and pointing shows only the pointed node's name. The rotatable space view with time as an axis is a separate variant, see [space-view.md](space-view.md).

## Holdings view

One page holds two linked visualisations. Pointing at a regest on the timeline lights up its acts and people in the graph; pointing at or selecting a person marks the regesta that mention them on the timeline. Selecting a regest opens its reading view, selecting a person opens a panel with the relations and links into the reading views.

### Timeline

- Data abstraction. Items are the regesta of the run with a quantitative position in time (the delivered `start_date`, and `end_date` for the span), a quantitative attribute (number of statements) and a categorical one (corrected after review or not). The background is a derived table of all regesta of the delivery counted per year of `start_date`.
- Task abstraction. Locate the run's regesta in time, compare their statement counts, discover the regest without a statement and the corrected ones, see how few of the delivery the run covers, identify the Adela pair (questions "Welche Ehen …" and "Personen mit mehreren Elternteilen gleichen Namens").
- Encoding. Position on a common horizontal scale for time, because position carries quantitative comparison best (Cleveland and McGill). Stem height on a common baseline for the statement count. Shape for the categorical state: a circle for a regest of the run, a triangle for one corrected after review, an empty circle on the baseline for a regest without statement. The delivery is drawn behind as muted bars, the same diagram the film shows, with the peak year named once to give the denominator. The Adela pair is a dashed red arc labelled with her name.
- Interaction. Every mark is a link. Pointing or focus names citation, dating as delivered, statement count, the opening of the regest and the persons it lights up in the graph in a line under the axis; Enter or a click opens the reading view. Arrow keys move between marks in time order, Home and End jump to the ends. The arc is a link that selects Adela in the graph.
- Uncertainty and missing values. The position is the machine-readable start date, as the commission demands. Where the dating is an interval, a span is drawn on the baseline from `start_date` to `end_date`. For "(1147 oder 1149)" the delivered dates are 1147-01-01 to 1147-12-31, so the mark sits in 1147 with a one-year span. A year the dating prose names outside the delivered interval (`proseYears` in edition.json) is drawn as an open diamond on the baseline in that year, joined to the mark by a dotted line: 1149 for n. 46, 1152 for n. 103a, whose machine date 1138-06 disagrees with "(1152 Juni/Juli)". The mark follows the machine date, the prose appears on pointing. Since 2026-11-11 every mark stands at its delivered date. Where two heads would overlap, the head moves up or down to the nearest free height, so it never leaves its year; the exact count stays in the status line, the accessible name and the list. The regest without statement keeps its place as an empty mark.

### Person graph

- Data abstraction. A network with two node types: actors (persons and groups, merged by IRI across regesta as the RDF merges them) and acts that involve at least one actor. Links are P11 and P14 and Participation roles between act and actor, P152 between child and parent, and the same-name pairs returned by the question on same-name parents. Co-mention in a regest creates no link. Node attributes are the labels per regest and whether an identity is local, meaning not matched to a register entry.
- Task abstraction. Lookup and browse a person, follow kinship and roles (questions on parents and roles), identify where the graph keeps two identities apart (same-name question).
- Encoding. Node-link diagram, because the network is small and sparse and the tasks follow paths (Okoe et al., as summarised in the vault). Shape for node type: filled circle for a person, filled square for a group or institution, small cool square for an act. An empty circle marks a local identity. Solid light line for parent, dashed red line for the same-name pair, hairline for roles. Labels name people; a greedy placement keeps them free of each other, the two identities of the case are always labelled, and labels that find no place appear on pointing.
- Layout. A force layout computed once in `build_data.py` from a fixed start (nodes on a circle in IRI order, fixed step count), so every build gives the same picture and the browser runs no simulation. Since 2026-11-11 the drawing height grows with the square root of the node count above the pilot's eighty nodes, so the denser factoid run keeps room for labels; the pilot keeps its height.
- Interaction. Pointing or focus lights the neighbourhood and the regesta of a person on the timeline. Selecting a person opens a panel with all labels the graph gives, the relations and links to the statements. Arrow keys walk the nodes in alphabetical order, acts follow in regest order; Enter selects a person or opens an act's reading view. `#/personen/<IRI>` addresses a selection.
- The case. Since 2026-11-11 the two parents of the same-name case carry a second label line with their regest and the register entry offered there, assigned or not (`case` on the node in edition.json), kept inside the image at every width. Without a selection the panel column shows the case in two sentences with a button per parent; the IRI sits in a closed detail.
- Uncertainty and missing values. Local identities stay visibly empty. A person with several labels in different regesta (Friedrich as "Friedrich", "Kaiser", "Kaiser Friedrich") is one node because the RDF uses one IRI; the panel lists every label. Two identities with the same name stay two nodes because the RDF keeps them apart.

### Text equivalents

Each visualisation has a closed list beneath it, the regesta with their mark in words and opening, and the persons with every relation and link. The marks themselves are focusable and carry accessible names that state what the shape shows.

## Reading view

1. Task: read the regest and judge each statement against the words it rests on.
2. Objects: the regest on paper; one sentence per act, built from the graph; per phrase its evidence.
3. First decision: paper and sentences side by side; the review state once above the sentences.
4. Deepening: the RDF of the selected act, the apparatus of the edition and the review history, all closed.
5. Navigation: `#/regest/<uid>/<claim>`; previous and next regest; the Diepold cross reference leads to the other regest and to Adela in the graph.
6. Wide: paper in reading width, sticky while the sentences scroll. Narrow: paper first; the selected act repeats its evidence as a quotation under itself.

Changes against the first state, each from the operator's judgement:

- The review state stands once per regest. A mark that is identical on every statement carries no information. Deviations would appear at the statement; this run has none.
- The rule is no longer marked, the exception is. A phrase without its own E13 is dotted underlined and explained once under the sentences, a phrase without any evidence carries the word "ohne Beleg".
- The statements follow the reading task instead of the graph. One act is one sentence: its type, "durch" the performer, "mit" participants, "als <role>" the role holders, "betrifft" the rights and things it concerns. A right or thing that only one act concerns is folded into that sentence with its own type assignment, so n. 67 shows the market right once. The templates are in `_compose` in `build_data.py`; every phrase stands for named lines of the graph. A small act diagram was considered and not built, because the sentence carries the same relations at reading distance and the person graph already draws them.
- One highlight, one meaning: the red underline marks what is pointed at, on paper and in the sentence. The second colour surface of the first state is gone.
- Graph notes are set by one rule: wording of the regest as a serif quotation, agent text in cool light with the label "des Agenten".

## Tokens

All colour values are in `css/tokens.css` as `light-dark()` pairs: `--stage`, `--text`, `--muted`, `--hairline`, `--paper`, `--paper-ink`, `--paper-muted`, `--machine`, `--machine-faint`, `--pen`, `--pen-on-paper`, `--warn`, `--focus`, `--bars`. Faces: Junicode, Instrument Sans, Space Mono, all local with OFL texts.

## Evidence

Screenshots of 2026-11-09 in `review/` (prefixes `read2-`, `vis-`, `overview2-`) and the assertions of `checks/ui_check.py`. They are the implementer's own check, not an independent review, and not the operator's acceptance.

## Sources

Vault notes read for this state: "Daten- und Task-Abstraktion", "Nested Model der Visualisierungsgestaltung", "Graphical Perception und Kanalrangfolge" and "Fehlende und unsichere Daten visualisieren" in their main sections, "Visualisierung von Kulturerbe-Sammlungen", "Barrierefreie Datenvisualisierung" and "Evaluation von Visualisierungen" in summary and section openings, and the film's design document. Three consequences come from them directly. Each visualisation is one tab stop with arrow-key movement inside, as the accessibility note derives from WCAG 2.4.3. Each has a text equivalent and a status line for what pointing shows. The holdings view opens with the shown holdings themselves in more than one view, following the generous-interface line of the heritage note. Following the Nested Model, none of this validates the abstraction; that needs historians working on their own questions.
