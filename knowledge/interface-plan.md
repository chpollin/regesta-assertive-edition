---
title: Interface plan
project:
  name: Regesta Assertive Edition
  repository: https://github.com/chpollin/regesta-assertive-edition
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
status: draft
language: en
created: 2026-11-17
updated: 2026-11-18
---

# Interface plan

The plan for rebuilding the whole interface. The operator accepted it on 2026-11-17, including the two points that change earlier verdicts of his (the 3D network view "Raum" goes, the metadata column of the regest page becomes a head line). It rests on a design audit of the rendered preview of the same day at 1440 × 900, 1920 × 1080 and 360 × 740. [Design](design.md) holds the rules that stay; where this plan and design.md differ, this plan is the newer decision and design.md is curated when a part is built and accepted. Each part is shown to the operator as a rendered slice before the pattern is carried to the next.

## Findings the plan answers

- Area: the cube draws on about half of its canvas at laptop and desktop widths, and the regest page leaves more than a third of a wide screen unused.
- Text: a status line of many words over the graphic, three statements of the unchecked status per screen, six repeated labels for facsimile links, a long About page.
- Navigation: start page and place view are the same view in two implementations; the switch between representations sits in a different place on each page and below the graphic on mobile.
- Filters: the eight statement families invert their logic between list and sidebar and have three names; lists have neither time nor place.

## Parts

Four objects in the header, each with one question.

1. Atlas (start and places in one). Where and when were charters issued, and which regesta belong to it? Main element: the space-time cube on the full area; decades is a representation mode of the cube, beside oblique, map and time.
2. Regesten. Which regesta match my selection, and what does one say? Main element: the list of the whole delivery, run regesta marked; the regest page is the detail.
3. Personen. With whom does a person stand in an attested relation, and when is the person named? Main element: the circle around the person (Netz); second representation: Zeitband.
4. Über. What is this edition and how do its statements come about? Main element: a process graphic of the steps with a mark for the producer of each (script, LLM agent, person), under two sentences.

Subpages: the regest page and the person page, both citable.

Kept: colours, fonts, the annotation system, the regest component, the bundled circle, the Zeitband, the realm around 1190, the family signs.

Removed: the start page as a second copy of the itinerary; the view Raum; decades as a view of its own; status-line prose; producer paragraphs.

## One filter model

One left bar, the same order in every view, state in the query string.

| Facet | Control | Address |
|---|---|---|
| Zeitraum | band with two handles | `?von=1150&bis=1159` |
| Ort | search field with suggestions, chip | `?ort=<id>` |
| Person | search over register and run actors, chip with a mark of origin, at most two | `?person=<id>[,<id>]` |
| Art | eight sign chips with a short word, OR; none pressed means all, everywhere | `?art=kin,dispute` |
| Schicht | two chips, all regesta or with statements | `?schicht=aussagen` |
| Text | search, in lists | `?q=` |

The hash carries only `#/<object>[/<representation>][/regest/<uid>]`. One line states "x von y Regesten" with a reset that clears every facet. A facet a view cannot evaluate stands greyed with a tooltip and does not disappear. The chosen filters survive a change of view and a reload.

## Layout

Atlas at 1440 wide: left bar of about 17rem with the facets, the count line and the result list below; the cube fitted to the bounding box of its content, not to the corners of the cube; the opened regest as an overlay of about 28rem over the right edge of the graphic, so the graphic keeps its width. At 1920 the detail docks beside the graphic. On mobile: representation switch above the graphic, graphic at 60dvh, a filter sheet as a dialog from below, the result list under it, the detail as a route of its own with a back arrow.

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ Barbarossa-Regesten [EXPERIMENT]  Atlas  Regesten  Personen  Über   [Suche]  │
├─────────────────┬────────────────────────────────────────────────────────────┤
│ Zeitraum        │ [Würfel|Karte|Zeit|Jahrzehnte]  [⌂][+][−]                ⓘ │
│ ▁▂▃▅▇▆▅▃▂▁      │                                                            │
│ ○────────○      │        ┌───────────────────────────┐   ┌─────────────┐     │
│ Ort  [chip ×]   │        │  cube, fitted to content  │   │ regest      │     │
│ Person [chip ×] │        │                           │   │ overlay     │     │
│ Art  ⚭ → ✓ ✕ …  │        └───────────────────────────┘   └─────────────┘     │
│ Schicht ○ ●     │  relations legend with counts                              │
│ 146 von 1837 ↺  │                                                            │
│ result list     │                                                            │
└─────────────────┴────────────────────────────────────────────────────────────┘
```

Regest page: the metadata column becomes a head line of signs (number, dating, place, one word "ungeprüft" with a popover that names producer, LLM, date and that no person has checked, once); actions for RI Online, TEI, TTL, JSON, a copy button for the citation, one menu for the facsimile links, previous and next. Below it two columns, the regest text with its statement chips and the notes at the height of their passage; the apparatus of the Regesta Imperii in two columns over the full width. At 360 the notes become a numbered list under the text.

## Text replaced by elements

- Status line after opening a regest: a legend of the three kinds of relation at the graphic, with a count each.
- Tooltip footer and the sentence on the missing statements: dropped; the layer shows in the point colour.
- Producer paragraphs: a block head with a producer mark and a popover.
- The fold-out on the origin of the data: an info mark at the graphic with a popover and a link to Über.
- Family rows that wrap: sign chips with the short word of `relations.js`, the full name in the tooltip.
- The hint that Friedrich is not in the picture of the network: a greyed centre node with his count, linking to his circle.

## Invariants

No runtime CDN, no client API key, prebuilt JSON, vendored libraries, working fallbacks. LLM statements never appear as statements of Regesta Imperii. Every statement keeps its way to its evidence, and no statement appears without "ungeprüft" in the head of the same card. No dark mode, no animation without input.

## Acceptance check

At 1280 × 800, 1440 × 900, 1920 × 1080 and 360 × 740, per view at rest, with a selection, with the detail open and empty.

1. The density check of the house interface yardstick per view; a view over a limit is not shown.
2. The drawn bounding box of the main graphic fills at least 85 percent of the width of its area; no SVG leaves the window; the regest page uses at least 85 percent of the width at 1920.
3. Filter tasks with answers computed beforehand from `holdings.json`: the same count for a time range in Atlas, list and Zeitband; a place survives a reload on every page; one family filter has the same logic in list and network; the reset clears every facet.
4. A keyboard task without a mouse from the Atlas to one regest and to the passage of its first statement, focus returning after closing.
5. Per screen the unchecked status or the agent verdict appears once; a popover is reachable by mouse, focus and touch.
6. No element with the hidden attribute has a visible box.
7. A fresh reader with screenshots, and an independent checking agent with tasks on the running build.

## Order of building

1. Atlas at 1440 with filter bar and overlay detail, shown to the operator as a slice. Built on 2026-11-18 in the local preview, not yet seen by the operator (journal). Deviations: the visual labels Ort, Person, Zeitraum and Schicht are gone (placeholders, the band label and the chips say it; density limit of the work profile), only Art keeps its word; the person facet searches the register persons the Atlas can show, without a mark of origin; the greyed Text facet stands only when `?q=` arrives from a list; no tool Ausgangslage, since Würfel returns to it; the year and the place stand once per run of equal values in the result list; the jump by RI number stands in the header of the start page only and steps aside below 40rem; the detail state stays over the density limit by the regest text (open).
2. The filter model carried to Regesten (whole delivery) and Personen. Built on 2026-11-18 in the local preview (journal). Deviations: the count line counts every regest of the delivery that passes the facets, also in the Atlas, which lists regesta without a place too (marked „ohne Ort“) and draws those with a place, so Atlas, Regesten and Zeitband give one number for the same facets (433 placed regesta for 1150 to 1159 in the slice became 811 regesta); the list rows carry no dating prose, which stands in the opened regest (density limit); in Personen the Person facet is the centre of the Netz, and the bar's result list stands only in the Zeitband while a person is chosen, since the circle leads to its regesta itself; the Netz fixes Schicht on „mit Aussagen“, greyed; the opened regest in Personen has no address of its own; Liste left the Personen switch, the person index stays as a page; the remove sign of a chip is a circle with a bar and the card closes with the word „Schließen“, since the cross is the sign of Streit.
3. Regest page with the head line. Built on 2026-11-18 in the local preview (journal). Deviations: Originaldatierung moved from the metadata column into the apparatus; „Fälschung“ stands as a word beside a number with the dagger; „Zitieren“ copies the citation of this edition with the page address, the card in the views that of Regesta Imperii; the notes show participants on pointing and focus, as in the card, not as always open fields.
4. Über with the process graphic.
5. Mobile layouts, then the acceptance check over everything.

Open from the clean-up before this plan: the tooltip reappears over an opened regest on pointer movement; `build_site.py` and `checks/test_site.py` still have their own reader and helpers instead of `edition_io.py`.
