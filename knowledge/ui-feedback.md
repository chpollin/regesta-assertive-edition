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
