---
title: Glossary German English
status: draft
language: en
created: 2026-11-18
updated: 2026-11-18
---

# Glossary German English

The terms of the English site and the reasons for each choice. The dictionaries `js/i18n/de.json` and `js/i18n/en.json` carry every interface text under the same keys; this glossary decides their terms. The English follows the usage of Regesta Imperii and of English-language medieval studies. Spelling is British with -ise (visualise, digitised, licence as noun), chosen once on 2026-11-18 because the anglophone diplomatic tradition the edition addresses writes it and the code already said `licence`.

## What is translated and what is not

Translated: every interface text (navigation, buttons, labels, headings, tooltips, accessible names, legends, info panels, messages, counts, the start page prose, the step notes of the process graphic, footer, licence line and attribution), the families of statements, and the vocabulary of the model. Act types and roles take the English `skos:prefLabel` of the run's frozen vocabulary (`pipeline/contracts/factoid-2026-11-11/ontology/vocabulary.ttl`), which already carries `@de` and `@en` beside each other; `build_data.py` writes the pairs into `edition.json` as `vocabulary`, and the views read the label of their language. Labels the build coins itself (literal kinds, adjudication decisions, review stages, itinerary flags) stand under `terms` in `en.json`.

Not translated, and marked `lang="de"` on English pages: regest texts, the apparatus (transmission, commentary, literature, notes, original dating), verbatim evidence and qualifiers, the dating and place strings as delivered, names of persons and places and the register descriptions, the labels of external links as Regesta Imperii delivers them (for instance „Digitalisat der RI-Buchseite“), the names of the course and the university, and the German reasons of the two LLM readers. The short German statement labels written by the LLM agents also stay German for now (operator, 2026-11-18). The agents' review notes are English already and keep `lang="en"`.

## Terms

Regest
: regest. On the start page explained once as a calendar entry, the summary of a charter or event with its date, place and sources. Regesta Imperii's English pages and the literature use regest, and calendar entry alone would hide the genre.

Regesten
: regesta, the Latin plural as Regesta Imperii uses it.

Ausstellungsort
: place of issue, the diplomatic term for where a charter was issued.

Datierung
: date (column and card); undated for a missing one. „Dating“ read as a calque to the check reader.

Itinerar
: itinerary.

Urkunde
: charter.

Intervenient
: intervener.

Reichsabtei
: imperial abbey.

Aussage
: statement, the assertion layer of the edition; factoid stays factoid in the model documents.

Raum-Zeit-Würfel
: space-time cube, the term of Windhager et al. (2019) whose idea the Atlas follows.

Lieferung
: the regesta supplied by Regesta Imperii; „delivery“ alone read oddly in running text and stays a technical word of the knowledge documents.

Register
: index, the English word for the person and place index of a calendar.

Lauf
: run.

ungeprüft, Prüfstand
: unchecked (the vocabulary's `rv:unchecked@en`), verification status.

Fachliche Prüfung
: scholarly verification, the human step after the agents.

Apparat, Überlieferung, Kommentar, Anmerkungen, Originaldatierung
: apparatus, transmission, commentary, notes, original dating.

Digitalisat
: digitised copy.

Fälschung
: forgery.

Familien der Aussagen
: families of statements, short word and long name: Familie as Family (Kinship and marriage), Besitz as Property (Transfer and possession), Zusage as Assurance (Confirmation and assurance), Schutz as Protection, Streit as Dispute (Dispute and judgment), Kontakt as Contact (Request, embassy, negotiation), Zahlung as Payment (Payment and obligation), Amt as Office (Office and enactment). Enactment is the vocabulary's English for Bestimmung.

Art, Schicht, Zeitraum
: type, layer, period, the facets of the filter bar.

Darstellung, Lesehilfe
: view, reading guide.

Würfel, Karte, Zeit, Jahrzehnte
: cube, map, time, decades.

Netz, Zeitband
: network, timeline.

Personen
: persons, as prosopography says.

Stand
: estate, with ruler, ecclesiastical, lay and not stated.

Station
: station, as itinerary research says for a stop of the ruler.

Impressum, Namensnennung
: legal notice, attribution.

Gasteinheit
: guest unit, in the operator's wording of the slide link.

Promptotyping, Agentic Edition, LLM agent
: unchanged; LLM agent for LLM-Agent.

## Not decided here

The German proper names of institutions in the attribution became their English forms (German Commission for the Editing of the Regesta Imperii, Academy of Sciences and Literature, Mainz), so the attribution reads as one English text. If the operator prefers the German names, they stand with `lang="de"`.
