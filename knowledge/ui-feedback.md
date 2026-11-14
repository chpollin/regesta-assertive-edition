---
title: Operator feedback on the interface
status: active
language: en
created: 2026-11-11
updated: 2026-11-11
---

# Operator feedback on the interface

Every piece of the operator's feedback on the interface, verbatim with its date, then what follows from it and whether it is done on screen. Read this list before every rebuild and tick each point against the rendered state afterwards. Feedback reached the implementing agent through the Research Coordination. The design decisions it led to are in [design.md](design.md).

Status words: done on screen (seen in a screenshot after the change), built (code changed, not yet seen by the operator), open.

## 2026-11-11, holdings view, too many levels

„Hier finde ich, es sind auch ein bisschen zu viele Ebenen. Jetzt haben wir hier zwei Grafiken. Die machen schon zu sehen, aber ich muss ja runterscrollen. Also müssen wir das entweder auf eigene Views überführen oder wir können sinnvoll zusammenführen. Ich finde, es ist nach wie vor viel zu textlastig.“

Follows: one view that fits the screen without scrolling, legends behind a question mark, lists behind a switch. Status: built, superseded in parts by the shell of the same day (time strip becomes a filter band).

## 2026-11-11, labels overlap, directions with meaning, 3D

„Ich sehe, dass im Herzen der Friedrich ist … Dann sehe ich hier, dass sich manche Wörter überschneiden. … Vielleicht könnten die Richtungen hier auch etwas bedeuten: dass bestimmte Richtungen schon bestimmte Relationen darstellen. Dann kann ich quasi dieses Netzwerk in einem 3D-Bereich bewegen.“

Follows: label collision avoidance against labels, nodes and edges; eight fixed relation directions around a selected person; a rotatable space view. Status: done on screen for labels and directions (measured: no label on a label or a node); the space view is built.

## 2026-11-11, flicker and amount of text

„Es flackert ein bisschen, kommt mir vor. Und hier ist eine sehr große Menge an Text. Das können wir nicht irgendwie eleganter machen?“

Follows: highlight after a short dwell with a grace on leaving, no panel rebuild on pointing; one row per relation family instead of one line per relation. Status: done on screen (rapid highlight switches at 1280 px from 22 to 2).

## 2026-11-11, dark ground, filtering, 3D as main view

„Ja, mir gefällt der dunkle Hintergrund noch nicht. Ich glaube, wir können nochmal am User Interface, am Design und an der Ästhetik arbeiten. Diese 3D-Grafik geht auf jeden Fall in die richtige Richtung. Wir sollten aber auch nochmal sinnvoll durchüberlegen, wie wir sie dann vielleicht noch filtern und sortieren können, wie wir weitere Daten dort ein- und ausschalten können und wie wir das sozusagen als einen zentralen Hauptview auch direkt auf der Startseite integrieren.“

Follows: the space view is the candidate main view of the start page; filters and switchable layers; a worked design system. Status: built in parts (snapping views, time slice, corpus mode); the start page integration is open.

## 2026-11-11, more complex networks, not overengineered

„Die Netzwerke sind ja immer in die Mitte zentriert. Vielleicht kann man auch wirklich komplexere Netzwerke darstellen, die ich dann sozusagen in dem 3D-Bereich explorieren kann und aus unterschiedlichen Perspektiven und Achsen betrachten kann. […] aber nicht, dass wir es überingenieren.“

Follows: snapping orthographic views, a time slice and a corpus mode without a centre person, after the space-time cube study; no transparency, no running animation, no VR. Status: built.

## 2026-11-11, no slide plan

„Diesen Folienplan, sowas brauche ich gar nie. Warum brauche ich einen Folienplan? Wieso werden das nicht einfach die direkt ausgearbeiteten Folien sein, wenn es Folien sein sollten? Also, der Button ‚Folien planen‘ gefällt mir nicht.“

Follows: no slide plans; slides are made directly in the deck. Status: done (the plan page is deleted).

## 2026-11-11, no plan pages in HTML

„Das verstehe ich überhaupt nicht. Du brauchst mir eigentlich nie so einen Plan als HTML schicken, oder?“

Follows: plans, drafts and questions go as text to the coordination; HTML only for what the operator uses, the edition and its views. Status: done (the edition plan page is deleted).

## 2026-11-11, time strip, one sidebar, more room

„Ja, das ist auf jeden Fall cool. Mir kommt vor, diese Barchart hier oben, das müssen wir irgendwie anders lösen. Die Zeitdimension muss irgendwie noch anders gelöst werden, am besten durch einen Filter oder sowas, und wir müssen auch die Aufteilung aufbauen. Ich möchte eine einheitliche Sidebar haben und vielleicht mehr Platz dann eben für die eigentliche Datenvisualisierung. Dort bin ich am Überlegen, ob wir das CSS und das Design eben nicht noch optimieren können.“

Follows: the time strip becomes a narrow filter band with two handles that restricts network and list, with the delivery density as a quiet ground; one sidebar for all views; header and band as flat as possible, the drawing fills the rest, direction words at the edge of the drawing. The right column must not be cut off at any width. Status: built and checked on screenshots at 1280, 1920 and 360 px (time band with two handles in the sidebar, the network fills the drawing area, nothing cut off); not yet seen by the operator.

## 2026-11-11, red tint rejected, simple light interface, way to the regest, filterable sidebar

„das finde ich wirklich cool, nur das Rot-Stichige passt mir gar nicht. Das ist schwer zu lesen. Kommen wir zu einem einfacheren, vollen, hellen Userinterface. Und ja, wie wird das dann in das ganze Projekt integriert? Also, wie komme ich dann wieder zum Regest? Kann man vielleicht irgendwie einheitlicher, ein besser aufgebautes und filterbares Sidebar integrieren?“

Follows: look A and look B are both retired; white ground without tint, near-black text, neutral grey lines, one calm accent `#0097A7` as in the operator's slide scheme, no red as text or area colour; light is the default, text contrast at least 7:1. From every act one click leads to its regest; the regest unfolds in the sidebar with the evidence marked, and the full regest page keeps a visible way back with the view state. One filterable sidebar in every view; the space view keeps a small view bar at the drawing. Status: built and checked on screenshots (light tokens with text at least 7:1, sidebar in both views, regest unfolding with the evidence marked, back link restoring person and filters); not yet seen by the operator.

## 2026-11-11, curating knowledge

„Wissen kuratieren in den Promptotyping-Repository-Vaults ist irrsinnig wichtig, also auch das unbedingt mit bedenken.“

Follows: this list, the design document, and the curation of the knowledge folders. Status: built (this document).

## 2026-11-11, map at the floor, correctness of the points, possibility spaces, filters left, warmth

„Kann unten am Boden eine Karte eingelegt werden, damit man wirklich auch das Heilige Römische Reich sieht? […] Und woher weiß ich jetzt, dass alle diese Datenpunkte korrekt sind? Und was ist noch ein bisschen zu textlastig?“ and „ich finde eben alle Versionen interessant, und ich glaube, genauso sollten wir arbeiten: Möglichkeitenräume, also mehrere Views erzeugen […]. Vielleicht können wir noch zwei andere Visualisierungen finden […] und quasi immer eine einheitliche, gleichbleibende Sidebar auf der einen Seite haben. Die Sidebars können schon angepasst sein an die jeweilige Visualisierung […]. Ich denke, auch hier sind noch einige Dinge viel zu textlastig. Wo können wir vielleicht noch mit Icons arbeiten? Ob wir bessere Farben und Stile noch verwenden? Es ist jetzt gar ein bisschen kalt und kühl und könnte vielleicht besser integriert sein. Ich finde die Sidebar mit den Filtern vielleicht immer am besten links zu haben und dann quasi einen einheitlichen Bereich, wo diese interaktive Information zu visualisieren ist, die wir dann weiter filtern können. Eben dann auch die Details, so dieses Shneiderman-Mantra, könnten wir nochmal genau überlegen und umsetzen. Aber ich finde, wir sind auf jeden Fall auf der richtigen Spur.“

Follows: filters on the left, drawing area in the middle, details on demand on the right only when something is selected; the family rows themselves are the toggles, no second list; the line saying what applies only when something deviates; signs instead of words where they replace one; provenance of every point in the view and a plausibility check of the itinerary with a switchable state for suspicious points; the Empire on the floor map if a licensed dataset exists; two further views (time band of persons, decade maps side by side); a warmer neutral palette in two versions. Status at the end of 2026-11-11: built and checked on screenshots, not seen by the operator: filters left, detail right only on selection, family rows as switches, the line saying what applies only on deviation, provenance and the plausibility check in the itinerary (231 flagged jumps, switchable), the base map with coast and rivers, two palette versions (`?farbe=w1`, `?farbe=w2`). Open: the Empire as a soft area after Shepherd's public-domain map „Europe 1190“ (decided by the coordination: own rough digitisation, named as this project's interpretation), signs instead of words, the time band and decade views. Status on 2026-11-12: built and checked on screenshots at 1280 and 360 px, not seen by the operator: the Empire about 1190 as a soft area after Shepherd's map (1926 edition, public domain checked at the Perry-Castañeda Library), one sign per relation family in the sidebar, at the rim of the circle and on the floor of the space view; the time band and decade views were built on 2026-11-11. Status on 2026-11-12, later: one palette worked out from W1 on the operator's word, the switch removed (design.md, Colour).

## 2026-11-11, the reading view has too many structures, the regest belongs into the visualisation

„Ich würde cool finden, wenn es einen Weg geben würde, wie wir diese Unterseiten, wo wir die Regesten haben, mit dem Original und den Quellen direkt in die Informationsvisualisierung integrieren könnten, damit ich das gleich sehe. Auch hier gilt wiederum, dass es viel zu viele Strukturen sind, also passt das User Interface einfach nicht. Das muss deutlich übersichtlicher sein, und da sind zu viele Sachen, oder? Auch das ist wieder das gleiche Problem.“

Follows: one regest component as the detail on demand in every view, with a one-line head (number, date, place, link to Regesta Imperii Online), the regest text with the evidence marked, and the statements as a compact black list in text size, pointing linking statement and text both ways; the review state once as a short word with a tooltip; RDF, notes, review history, commentary and transmission behind one „Mehr“. The citable regest page shows the same component. Status at the end of 2026-11-11: built and checked on screenshots, not seen by the operator. The component (`js/regest-card.js`) opens on the right from the network, the space view and the itinerary; the citable page in the app shows it with 4 text styles instead of 12. „Streit oder Klage.“ in n. 3166a was no display error: the regest names no parties of the Trier election dispute, and the component now says „ohne genannte Beteiligte“.

## 2026-11-12, views confirmed as direction, public build

Relayed by the Research Coordination: the operator confirmed the views as the right direction and wants to show the edition publicly. No verbatim wording was relayed.

Follows: the curated build is served by GitHub Pages from the branch `gh-pages`, every build as a further commit through `publish_site.py`. The word „null“ in the head of regesta without a place (seen on n. 72) is removed at its root in `build_holdings.py`; nodes with a register entry carry a nominative name. Status: built, published and read at the public address on 2026-11-12, not yet seen by the operator.

## 2026-11-12, the circle around Friedrich is too dense and stretched

„Das scheint noch nicht ganz gut zu passen. Hier sind viel zu viele Datenpunkte zu eng beieinander, oder? Auch das wird ein bisschen gestaucht von der Breite, oder?“

Seen on his two screenshots (narrow and very wide window), as described by the Research Coordination: the figure takes the window's aspect ratio, so in the wide window the octagon becomes a flat ellipse and a sector sign leaves the image; around Friedrich nodes lie on each other in every sector, labels cover each other, names stand without a visible node, edges form grey areas. The coordination's direction: overview first and details on demand, bundled nodes with counts per sector, labels only for the few most connected counterparts, a sector opens on click or through the existing filters and time window; people with few statements such as Adela stay as they are; no new controls or explanatory text in the sidebar.

Follows: the circle keeps its aspect ratio and fits the drawing area; a sector with more relations than fit stands as one bundle with its count and its three most connected people, and opens on a click on the bundle or its sign, or by itself once filters or the time window leave few relations. Status on 2026-11-12: built, published and checked on screenshots at 1280 and 2000 px, not seen by the operator. Around Friedrich 46 nodes in seven bundles instead of about 1100, no overlapping labels in the overview, with one sector open, with a single family or with the time window 1153, and the circle round in both widths; Adela unchanged.

## 2026-11-12, Jahrzehnte and Zeitband could do more

„Wird es irgendwie Sinn machen, diese Visualisierung noch zu verbessern, und zwar mit Farben zu arbeiten? Können die unterschiedlichen Orte etwas bedeuten? Ist das wirklich perfekt? Da kann man sicher noch etwas optimieren, oder? Auch beim Zeitband finde ich es grundsätzlich gut, aber auch hier kann man sicher noch etwas optimieren und verbessern, oder?“

Seen by the Research Coordination on the same screens: duplicate and damaged names in the time band („Fredericus I. Barbarossa“ and „Heinrich II.“ twice, „Beatrix vonBurgund“, „Rainald G“, „Markward von Grumbach; zu ihm…“), accent and black names without explanation, sentence fragments as actors in the network's person list, the overlap around Pavia, the nearly empty 1130s and 1140s, and a line from first to last mention that suggests presence.

Follows: one naming rule from the register for all views; sub-entries of a person named as such; local actors in their own group of the list; in the time band a named legend, lines only across short gaps, years in Italy as pale bands computed from the places of issue, a third order by name; in the decade maps lightness for new against returning places, up to four names per map, the Empire as in the itinerary, smaller circles, thin decades merged. Status on 2026-11-12: built, published and checked on screenshots at 1280 and 360 px, not seen by the operator. Not built because the data do not carry it: colour by relation family or by kind of regest for the whole delivery (only the 224 regesta of the run have statement types), certainty of the place of issue (not recorded per regest in the delivery).

## 2026-11-12, no review form, check the product

„Ich brauche nie einen Prüfbogen als HTML-Seiten. Das soll eine generelle Regel sein. Das macht keinen Sinn, so die Sachen einzutragen, weil alle diese Fragen, die dort stehen, die sollst du mir im Chat geben.“ and „Und wenn, dann sollte genau das ein Tool sein, damit ich gleich schön das abnehmen kann. Es soll quasi so sein, dass Urteil, Streit, Ehe und Amtsinhabe in der digitalen Edition direkt angemerkt sind. Das wäre doch viel besser, oder? Wir checken das Endprodukt ja auch gleich ab. Wenn das Endprodukt klar ist, was Urteil, Streit, Ehe und Amtsinhabe im Regest sind, dann funktioniert es ja auch.“

Follows: the separate review page is retired; the statements stand annotated in the regest text of the edition (kind and number at a bracket, roles under the names); the local review build adds the verdicts on the regest pages themselves. Status on 2026-11-12: built and published; checked on all 224 regest pages at 1280 and 360 px (one gloss touches another in n. 183 at 360 px), not seen by the operator.

## 2026-11-14, the whole frontend improved

Relayed verbatim by the Research Coordination: „beim regesten frontend will ich jetzt auch weiter arbeiten. analysier alles was wir sehr gut wissen um design ui und UX und wie wir es optimieren können erzeuge das gesamte verbesserte frontend. mit den innovativen und sehr guten lösungen.“

Follows: navigation by objects with a switch between representations, the start page as linked overview of time, places and persons with the annotated n. 103a, filters with family signs in both lists, verdicts as sign and word (design.md, Frontend by objects). Status on 2026-11-14: built in the local review build, checked on screenshots at 1280 and 360 px, by keyboard and pointer, by the density check and by an independent read-only reviewer; not seen by the operator, not published.

