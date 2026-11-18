---
title: Prompt log
project:
  name: Regesta Assertive Edition
  repository: https://github.com/chpollin/regesta-assertive-edition
method:
  name: Promptotyping
  url: https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin
status: active
language: en
created: 2026-11-09
updated: 2026-11-18
---

# Prompt log

This process document retains the user's visible research and teaching inputs from the conversation and maps them to work steps. German wording and typing are retained. Blank-line spacing and rich-text emphasis are normalised. Environment instructions, tool calls and the Sync confirmation are excluded. The CHANGE inputs provide the prehistory of the TH Mittelhessen example.

The active slide prompts are condensed German teaching versions, following the operator's language correction. They are not transcripts of individual historical requests. They may combine several user inputs and explicitly named verification practices proposed by the agent. They do not prove that the consolidated prompt was executed. The superseded English drafts and the first German modelling version are kept in Git history before the curation of 2026-11-11.

## Work steps and slide counterparts

| Step | Inputs | Observed stage | Direct slide |
|---|---|---|---|
| Project setup and knowledge base | P08–P12 | Local preparation and empty private remote exist | [Project setup](https://docs.google.com/presentation/d/1Pzj4v6xl6nEl6z4PPMvvihy0yW11F9cH2Xmp8SrYXNU/edit#slide=id.thm_regesta_setup) |
| Data exploration and distillation | P09, P12–P15 | Python exploration executed and data.md maintained | [Explore data](https://docs.google.com/presentation/d/1Pzj4v6xl6nEl6z4PPMvvihy0yW11F9cH2Xmp8SrYXNU/edit#slide=id.thm_regesta_explore) |
| Read regesta and identify relationships | P16–P17 | Selected texts read, no corpus annotation | [Read regesta](https://docs.google.com/presentation/d/1Pzj4v6xl6nEl6z4PPMvvihy0yW11F9cH2Xmp8SrYXNU/edit#slide=id.thm_regesta_read) |
| Define the relationship model | P17 | Source and ontology scope checked with read-only subagents, proposed model remains a draft | [Model relationships](https://docs.google.com/presentation/d/1Pzj4v6xl6nEl6z4PPMvvihy0yW11F9cH2Xmp8SrYXNU/edit#slide=id.thm_regesta_model) |
| Annotation and validation | P17 | Accepted later direction, extraction prompt deferred until model finalisation | No slide claiming execution |

P10 temporarily withheld repository creation. P12 later authorised it, and P35 authorised the initial commit and push. The phrase “Startup mit MSD” in P18 remains unresolved and has not been expanded into a method or acronym.

## Conversation inputs

### P01 CHANGE source discussion

```text
um was geht es hier?
```

### P02 CHANGE examples

```text
Was könnte ich in meinem DH-Input für CHANGE beitragen? Mach mir einen Vorschlag für die inhaltlichen Schwerpunkte.

hier sind meine gedanken:

- Linked Open data, APIs (Kulturpool beispiel) --> also ein beispiel wie ich über eine api mir meine eigenes fronend baude --> da kann ich mien kulturpool api beispiel zeigen github pages udn dei videos
- Dann szd ocr htr tool --> mit den transkriptionen --> und wie man dasmit arbeiten kann
- Digitale Editionen Frontend umsetzen --> das beispiel der wiener stadtbücher weil dort auch frrauen in den vordergrudn egstellt werden --> lutter christian projekt seite gitb es auf githubpages online
- m3gim weil nachlass einer opernsängerin udn mibnoluitäsfrpschugn udn prototypen udn wie daten erfasst werden
- HerData als beispiel für correspondence (anspeilugn auf correspSearch und wuieder API)

und dann sagen --> frontier llm können das alles extrem amplifihzieren
```

### P03 Knowledge and Drive

```text
das lingt mal gut. sollen wir ein wissensdokuemtn anlegen udn es ina ctive work eintragenm?

udn dann bracuehn wir einen ort im googel drive wo das googel sldies liegt.
```

### P04 Slide preparation

```text
Dann lass uns den Google-Slides-Foliensatz für den 20-minütigen CHANGE-Input erstellen. Nutze meinen persönlichen Folien-Skill und vorhandene Folien zu den Beispielen.

aber mach keien folien. die muss ich selebr machen. außer dufisnt die folien zu den projekten was ich shcon hab.

zentral immer ein foliensatz, darunter der llinkl zum github pages udn einen titel mit dem projekt titel. und vl als screensheet udn vl 2-4 key words rechts. udn muss english sein. udn titel folie auch aus eienm ganz aktuellen satz. titelbild haben wir noch keines.

“Few-shotted for Breakfast” und sind "fancy (research) tools & workflows" könen wir direkt verwenden
```

### P05 Source slide links

```text
Dann trag die gefundenen Folien mit den direkten Links und der geplanten Reihenfolge ins Wissensdokument ein. Den Foliensatz stelle ich selbst zusammen.
```

### P06 Slide creation

```text
erzegue den folien satz
```

### P07 Introduction

```text
Und ganz natürlich soll am Anfang eine Folie sein, auf der ich mich selber vorstelle: dass ich am Institut für digitale Geisteswissenschaften gearbeitet habe, dass ich mich mit digitalen Editionen beschäftige. Auch mein Dissertationsthema soll auf dieser Folie vorkommen, damit die Leute wissen, mit was ich mich beschäftigt habe.
```

### P08 Teaching transition

```text
update active work dann kann cih später bei den folien weiter abreiten.

und ich würde auch für den am 20.11 die slide anlegen. dort ist es aber lehre. udn da muss ich dann einj beispiel mit regestn udn wie ich die nach rdf überführe also demo machen.abver also opener könen wir auch diese themen bringen. weißt du was ich meine?
```

### P09 Exploration commission

```text
im downlaod ordenr sidn zwei vsc,. die kannst ud mal ausführlich explorieren udn agrregieren mit python code. udn alle sin ein data.md wie es für promptotpyign gehört geben. udn mal ein guithbu repo anlegen. wobei ich genau die schritte mti9 der exploration ja als folien machen will.- also lege es nru sauebr im gogoel drive ab udn auch lokal das wir später weiter arbeiten können
```

### P10 Action restriction

```text
aber du darfst noch nciths commiten udn auch kein repo anlegen. nur vorberieten damti ichd ann weiter arbeiten kann und dei daten schon sauebr quasi im githbu liegen udn die wissensdokumente alels über das repo wissen
```

### P11 Tool as opener

```text
und dann würden wir auf der start setie direkt das tool, das es njoch zu definieren gibt, auf githbui apges hsoten udn das ist der opener.
```

### P12 Private repository authorisation

```text
am besten wir legen auch gleich das repo an. wie heißt es?

und wir könne ja ein sehr gutes data.md anlegen. komopakt aber mti der gesamte wissen der daten destillier.t oder ?
```

### P13 Data explanation

```text
erkläre dei daten in einem absatz
```

### P14 Inspect all fields

```text
Das heißt, wir haben einfach nur Volltext, Datum und dann ein paar Named Entities sowie Provenienz. Ist das richtig so? Also, wie heißen alle diese Datenfelder? Warum sind es zwei CSVs?
```

### P15 Check knowledge

```text
gut. udn das steht komapkt in data.md?
```

### P16 Source reading

```text
dann könen wir ja mehrer regesten einfach lesen udn schauen welceh weitern informationen drinnen sind dei wir dort extrahieren können
```

### P17 Relationship model

```text
Das heißt also: Editorische Einordnungen finde ich nicht so interessant, also die diplomatischen Sachen. Was mich interessiert, sind die Personen und die Beziehungen zwischen den Personen, also quasi ihre Verwandtschaftsbeziehungen, die Art von Beziehungen, Wirtschaftsbeziehungen und Rechtsbeziehungen. Das könnten wir auch gleich überlegen, wie wir das sauber modellieren könnten. Das heißt, wir sollten uns dann auch eine Art Data-Model.md überlegen, oder vielleicht ist das sogar Teil von Data.md, wo wir alles, was wir finden, nun in eine eigentliche, saubere Ontologie überführen. Dort haben wir eben eine Scope Note und überlegen uns, aus welcher Top-Level-Ontologie wir das ableiten, damit wir auch hier sauber die historische Information modellieren. Genau, und ich glaube aber auch, dass wir mit Subagents arbeiten müssen. Wir können uns ja auch überlegen, wie wir alle diese Regesten als Plaintext ablegen, oder vielleicht nicht als Plaintext, weil wir ja direkt ein Skript schreiben können. Für jedes Regest wollen wir eigentlich ein JSON-LD erzeugen oder ein Turtle RDF. Vielleicht ist ein Turtle RDF besser zum Lesen. Das wäre eine Pipeline, in der Subagents die Sachen annotieren, und da brauchen wir dann sicher einen Prompt, aber den brauchen wir dann, wenn ich das Datenmodell fertig habe.
```

### P18 Prompt collection and live slide authoring

```text
Und alle Prompts, die ich verwende, wollen wir auch in dieser Konversation gleich zusammensammeln, weil wir diese Prompts dann direkt in die Folien geben können. Vielleicht kannst du das auch machen: jeden Arbeitsschritt, den wir hier jetzt machen. Vielleicht sind mehrere Prompts ein Arbeitsschritt, sozusagen. Die können wir einmal auf die Folien geben.

Du kennst ja auf dem Uni4Live, wie wir Prompts auf die Folien geben. Da können wir sozusagen das erzeugende Startup mit MSD, das Explorieren, das Modellieren, das könnten alles eigene Folien sein. Die können ja gleich mitmachen, oder?
```

### P19 German teaching deck

```text
Ich denke aber TH Mittelhessen. Agentic Engineering für Forschungsdatenworkflows. 20 November 2026  --> Dass das alles auf Deutsch sein kann, auch die Prompts
```

### P20 Pilot, subagents and evaluation

```text
und wir könnten doch auch gpt 6.1 terra subagents verwenden. quasi für jedes regest einen ieigenen. oder könen wir regeste wirgednwie vorher struktuieren udn gruppieren. vl nach zeit? das wir dann snnvoll die uabegnts beauftragen können das rdf zu erzeugen.

und wir sollen usn überlegen vorher wie deren promtps alle aussehen. oder?
und wir müssen auch sicehr stellend as unse rmdoell sehr gut ist. wie könen wir das evalueiern? also ein shacl schema köntne usn helfen sicherzsutellen das wird ein gutes rdf haben. vl auch noch ander tests in python? udn sonst muss ich als experte sicher rdf anschauen um es abzunehmen. am besten mach wir strategische durchläufe mit kleinen datenbeständen damti wir alles besser verstehen vorher. oder ?
```

The response proposes contrastive pilots, separate development and evaluation material, explicit prompt contracts, SHACL and Python checks, and expert review. This is a planning discussion. Annotation and validation have not been executed.

## Continuation

Append substantive user inputs that become teaching material here, with their work-step mapping, and preserve earlier inputs and authorisation changes. From the factoid run onwards, operator inputs that ground a decision are quoted verbatim in [Edition plan](https://github.com/chpollin/regesta-rdf-demo/blob/f65887c/knowledge/edition-plan.md) and [Journal](https://github.com/chpollin/regesta-rdf-demo/blob/f65887c/knowledge/journal.md).

The UFL exemplar is recorded in the vault teaching document. Source-deck provenance and editing instructions are kept outside speaker notes.


## Active German teaching versions

### Projektstart und Wissensbasis

Stage shown on the slide: Vorbereitet.

```text
Bereite ein Projekt für eine Regesten-RDF-Demo vor. Erhalte die gelieferten CSV-Dateien unverändert und lege eine kompakte Wissensbasis an. Halte Anforderungen, Datengrundlage, Entscheidungen und nächste Schritte fest. Arbeite zunächst lokal. Erstelle keine Commits und führe keinen Push oder eine Veröffentlichung aus.
```

Follow-up:

```text
Lege das private Repository regesta-rdf-demo an. Es bleibt bis zur Freigabe von Commit und Push leer.
```

### Daten explorieren und Wissen destillieren

Stage shown on the slide: Ausgeführt.

```text
Exploriere beide CSV-Dateien mit Python. Untersuche ihre Struktur, Identifikatoren, fehlenden Werte und Verknüpfungen. Aggregiere die Daten und identifiziere Qualitätsprobleme. Erhalte die Originaldateien unverändert. Destilliere das Materialwissen in knowledge/data.md und halte die vollständigen Ergebnisse separat fest.
```

Follow-up:

```text
Prüfe die Zählungen unabhängig und wiederhole die Analyse. Erkläre den Unterschied zwischen Registereinträgen und ihren Belegvorkommen.
```

### Regesten lesen und Beziehungen erkennen

Stage shown on the slide: Auswahl gelesen.

```text
Lies mehrere Regesten und vergleiche ihre Texte mit den strukturierten Feldern. Identifiziere Verwandtschafts-, Wirtschafts- und Rechtsbeziehungen, die wir extrahieren könnten. Zeige konkrete Textstellen und unterscheide Beziehungen, Ereignisse, Beteiligte und Bedingungen. Annotiere noch nicht den gesamten Bestand.
```

Follow-up:

```text
Konzentriere dich auf Personen und ihre Beziehungen. Beziehe Institutionen ein, wo der Text dies erfordert.
```

### P21 Knowledge document functions

```text
welceh neuen knwoeldeg docuemtns sollen wir im knwoledeg ordner anlöegen`?
```

### P22 Reconsider the CIDOC CRM domain model

```text
Also bei der Domänenontologie müssen wir uns wirklich sauber überlegen, wie wir das modellieren. Ich persönlich bin ein Freund davon, dass wir etwas von CIDOC-CRM ableiten. Wir verwenden CIDOC-CRM als Top-Level-Ontology und bauen dann quasi eine kleine domänenspezifische Ontologie, um die vorhandenen Dinge abzubilden. Das soll aber kompakt und präzise und vor allem ontologisch sauber modelliert sein und auch die Daten sinnvoll und unkonstruktiv abbilden. Ich denke, das müssen wir vielleicht vorher noch mal durchüberlegen und die Daten anschauen, auch Websuchen machen und dann mal Beispieldaten in den Chat bringen.
```

This step re-reads source examples and checks candidate CRM mappings, without accepting a formal ontology or starting annotation. The user-facing examples distinguish historical relationship states, actions and source-based assignments.


### P23 Modelling prompt and evaluation slide

```text
Gut dann überleg dir noch mal auch einen sinnvollen kompakten Prompt für die Modellierung für diesen Modellierungsschritt und auch eine eigene Folie für das eigene Evaluieren/Testing aufbauen.
```

The modelling teaching prompt was revised and a separate German evaluation/testing slide was added by native duplication of the inspected prompt-slide exemplar. Both were read back and inspected through fresh native thumbnails. These are teaching prompts, not newly executed ontology or testing tasks.

### Active modelling prompt after P23

This replaces the first German modelling teaching version above.

```text
Entwirf anhand echter Regesten eine kompakte, von CIDOC CRM abgeleitete Ontologie für Verwandtschafts-, Wirtschafts- und Rechtsbeziehungen. Prüfe die offiziellen Definitionen per Websuche. Begründe Erweiterungen mit Scope Note, Domain und Range. Trenne Beziehungen, Handlungen und belegte Aussagen. Erhalte Zeit, Rollen und Bedingungen. Zeige Beispiele als Turtle und lass einen Subagenten die Zuordnungen prüfen. Halte offene Fragen in knowledge/domain-ontology.md fest. Noch keine Korpusannotation.
```

[Modelling slide](https://docs.google.com/presentation/d/1Pzj4v6xl6nEl6z4PPMvvihy0yW11F9cH2Xmp8SrYXNU/edit#slide=id.thm_regesta_model)

### Active evaluation/testing teaching prompt

```text
Plane kleine Pilotdurchläufe für Datenmodell und RDF-Extraktion. Wähle kontrastive Regesten und getrennte Entwicklungs- und Prüffälle. Definiere SHACL- und Python-Tests für Struktur, Textbelege und konsistente IDs. Prüfe die Tests auch mit absichtlich fehlerhaften Daten. Vergleiche extrahierte und fehlende Aussagen mit fachlich geprüften Referenzen. Halte den Prüfplan in knowledge/testing.md fest. Die fachliche RDF-Abnahme bleibt bei mir.
```

Follow-up:

```text
Zeige an einem Regest, welche Fehler die automatischen Tests erkennen und welche nur die fachliche Prüfung findet.
```

[Evaluation/testing slide](https://docs.google.com/presentation/d/1Pzj4v6xl6nEl6z4PPMvvihy0yW11F9cH2Xmp8SrYXNU/edit#slide=id.thm_regesta_testing)

At the time of this slide-authoring step, knowledge/testing.md and executable checks were future work. P27 records their later implementation.


### P24 Compact complete ontology draft

```text
Kann man die ontology irgendwie kompakter, präziser und auch korrekter schreiben? Gibt es hier Best Practices und kann ich mal die ganze Autonomie aufschreiben?
```

The response interprets “Autonomie” as “Ontologie” from context. A complete provisional RDFS core is prepared for discussion, with two local classes and ten local properties. Existing CRM classes and predicates remain reused through an application profile. This does not replace the maintained domain-ontology draft or constitute expert acceptance.

The core separates relationship states, context-bound roles and source-grounded attribution. Source links do not automatically entail historical truth or P16 use. RDFS domain/range are inference declarations; SHACL constraints remain separate. No identity key is asserted for participation. Text values permit language-tagged and untagged literals, with text-only restrictions deferred to SHACL.

A read-only Terra subagent reviewed the actual Turtle draft and identified refinements concerning source semantics, identity, language tags and source location. The parent incorporated the first three and retains fine-grained source location in the input/profile contract. RDFLib 6.2.0 from the existing local cache parsed the revised Turtle successfully. This verifies syntax and the bounded declaration checks, not formal CRM conformance or scholarly validity. No corpus annotation, commit or push was performed.


### P25 Terminology

```text
„Beziehungsmodell“ ist ein bisschen ein seltsamer Begriff. Können wir das besser bezeichnen? Das klingt irgendwie nach zwischenmenschlichen Beziehungen.
```

The terminology discussion suggested “Domänenontologie für historische Akteure und ihre Beziehungen” and the slide title “Historische Informationen mit CIDOC CRM modellieren”. The latter was applied during P26.

### P26 Project narrative, layout and UFL reuse

```text
Ich denke, du kannst die Prompts in Folien so machen, dass sie dann ein bisschen weiter nach rechts gerutscht werden. Man will sozusagen mehr von der Fläche nutzen und ein wenig mehr Platz für den Text haben. Es kann je nach Prompt unterschiedlich sein. Links wollen wir eine einheitlichere Struktur haben, also quasi immer einen Versuch einer Beschreibung des Arbeitsschritts und was wir da machen. Genau und das ist quasi unser roter Faden: der Aufbau dieses Projektes. Aber wir können dann genau die Folien aus unserem agentic engineering uni4life slide deck direkt kopieren. Zum Beispiel an der Stelle, wo wir Subagents direkt im Prompt beauftragen, kann das dann einer der folgenden Prompts sein, wo wir Subagents definieren. Da können wir Folien eins zu eins direkt übernehmen und dort integrieren. Das Gleiche ist zum Beispiel auch bei einem Skill: Wir haben zwar jetzt noch keinen Skill definiert, aber das könnten wir auch machen, oder bei specification-driven development oder test-driven development.
```

The five project-step slides now share a left column with step number, description and result. Prompt frames begin farther to the right and have content-specific heights. Existing prompt text is preserved. The modelling slide title now names historical information modelling with CIDOC CRM.

Native UFL source slides were inspected and linked in the vault event document: Subagents (h51448df817bc677_0_31), quality and Red/Green-TDD (qs_slide), engineering overview including SDD (lp_slide), and the PDF-skill example (h51448df817bc677_0_247). Skill reuse is a later possibility, not evidence of an existing regesta skill. The SDD source is an overview rather than a dedicated SDD slide.

Exact cross-deck insertion remains unperformed. The connector exposes no single-slide cross-deck copy operation. Computer Use stopped because it could not reliably determine the current browser URL to enforce policy. No alternative UI route was used to bypass that stop. No reconstruction was labelled an exact copy.


### P27 Curation, larger pilot and generation pipeline

```text
Gut, und damit das mal alles sauber ist, machen wir eine Kuratierungs- und Refactoringsrunde, damit wir alles schön aufgeräumt haben und in den Daten und in den Wissensdokumenten kompakt und präzise machen. Dann wollen wir noch einen ein bisschen größeren Testlauf machen, wo wir RDF erzeugen, genau in der Ontologie, die wir hier beschreiben. Dann lernen wir noch etwas über die Ontologie, wahrscheinlich, weil wir mit neuen Daten konfrontiert sind.

Das müssen wir uns überlegen: wie wir unsere Ergebnisse in unserer Pipeline richtig sehen. Das heißt, wir brauchen auch eine Grafik, wo wir die Pipeline, die Datenerzeugungspipeline, dann beschreiben. Da müssen wir uns aber erst mal überlegen, was da alles oben sein sollte.

Also quasi: Die CSV-Links als Input, dann geht das in das AI-Hardness hinein. Im AI-Hardness haben wir unterschiedlichste Subagents, die dann die Daten nach RDF überführen. Dann gibt es sicher einen LLM as a judge, also quasi einen Review-Agenten, der ein Feedback macht, ob er eine Korrektur macht oder sagt: Dann können wir das RDF verbessern. Dann wollen wir uns aber auch noch überlegen, wo wir vielleicht sogar etwas gleich besser deterministisch machen können und wo wir eben Validierungen testen und evaluieren können, wie gut das Ganze funktioniert hat.
```

The implementation interprets AI-Hardness as AI harness. The original wording remains above. The run uses a frozen model, separate original and revised RDF, an independent judge, adjudicated findings and deterministic checks. Expert acceptance remains pending.

#### Condensed teaching prompt

```text
Bereinige die Wissensbasis, ohne Quellen oder frühere Prompts zu verlieren. Friere Ontologie, Vokabular und Annotationsregeln für einen kontrastiven RDF-Pilot ein. Bereite Aufgaben deterministisch vor und verteile sie an Subagents. Trenne Extraktion, Quellenreview, geprüfte Korrekturen und erneute Validierung. Prüfe Turtle, SHACL, Textbelege, IDs und vollständige Aufgabenabdeckung. Dokumentiere Modelllücken und zeige die Pipeline als Grafik. Die fachliche Abnahme bleibt bei mir.
```

Exact shared worker prompts live in prompts/extract.md, prompts/review.md and prompts/correct.md. Batch outcome and correction records identify the actual dispatched work. Python validation does not claim historical accuracy.


### P28 Walking and remote-control opener

```text
Das sollte das Bild auf der ersten Folie sein, damit ich sage, dass ich das, was ich hier alles gemacht habe, während dem Spazierengehen gewipecoded habe. Beziehungsweise damit sie sich dann die Frage stellen kann: „Jetzt ist hier wirklich Wipecoding?“ Denn ich habe irrsinnig viele Wissensstrukturen im Obsidian Vault angelegt und quasi einen Ablauf definiert, wie das gehen soll.

Mal sagen, wie das entstanden ist: während des Spaziergangs über Remote Control in der Codex-App, in diesem Fall. Damit wir das als erste Folie verwenden. Ich glaube, das könnte ein spannender lustiger Opener sein. Dann kann man dort schon mal Webcoding, Agentic Engineering, Context Engineering, Prompt Engineering und die Begriffe dann vielleicht definieren. Nur als Gedanke.
```

### P29 Spoken input and existing knowledge

```text
Und auf dieser Titelfolie: Vielleicht kann man auch sagen, dass ich die WISPA-App verwendet habe, um alles mit Speech-to-Text zu machen. Also ich habe keine Zeile geschrieben, ich habe keinen einzigen Prompt geschrieben, sondern eben nur gesprochen und habe es sozusagen in eine Wissensstruktur hineingegeben: über Promptotyping in meinen Obsidian Vault, den du ja auch jederzeit verwenden kannst, dann später, um z. B. User Interfaces besser zu verstehen, und in dieses Ökosystem des Wissens von meinen ganzen GitHub-Repositories, wo ganz viele unterschiedliche Projekte sind, auch Projekte, wo historische Information modelliert und operationalisiert wird. Auch meine Dissertation hat was mit Call Center Design zu tun. Noch mal ein paar Stichwörter zu nennen: das, weil sie diese Wissenstruktur, dieses Second Brain, das ich hier aufgebaut habe, es mir erlaubt, das auch so umzusetzen.
```

### P30 Domain research and literature-grounded product definition

```text
Wir können uns dann überlegen, welche User Stories man hat. Wir haben jetzt aus dem Modell schon einiges verstanden, wie die Daten ausschauen. Wir können jetzt nochmal Web-Suche machen, um die Domäne besser zu verstehen: Was macht man mit Registern? Woher kommen diese Daten? Was haben andere Leute mit diesen Daten schon beforscht? Damit bauen wir eine Wissensstruktur auf.

Wir könnten uns hier einen kleinen Grounded World einzubauen überlegen, an dessen Ende ein Literaturbericht ist, aus dem all diese Quellen einen durchgehenden, sachlichen, gut verständlichen, deskriptiven, kompakten Text erzeugen. Wir können die Provenienz-Kette jeder Aussage auf eine Publikation zurückführen. Dieser Grounded World ist eine Wissensstruktur, die uns dann helfen kann. Es ist so eine Art Literature Review: Was haben die anderen gemacht? Um dann die Spezifikationen für das Front End zu erzeugen und vielleicht auch noch mal zu überlegen, ob unsere Motivierungen alle sauber sind. Genau das könnten wir mal durchplanen, als Ganzes.
```

### P31 Grounded Vault method slide

```text
Das heißt wir könnten dann auch eine Folie zum grounded Vault einführen. Zu dieser Knowledge-Engineering-/Context-Engineering-Methode, die ich hier entwickelt habe, gibt es ja ein eigenes GitHub-Repository. Das können wir dort direkt verlinken, damit ich das hier noch mal erklären kann, dass man sozusagen hier eine Wissensstruktur hat, die Agents verwenden können für einen bestimmten Zweck.
```

### P32 Expert interview

```text
Am besten überlegst du dir jetzt nur konstruktiv, welche Fragen du mich als Experte stellen kannst. Also wirklich so eine Art ExpertInnen-Interview durchführen, wo ich wirklich jetzt mal Sachen abnehmen und bestätigen muss und Entscheidungen treffen muss, damit wir hier wirklich auf allen Ebenen nachschärfen können, ob wir am richtigen Weg sind.
```

### P33 Expert feedback as Knowledge Engineering

```text
Und auch die Abnahme, meines Wissens, könnte eine Methode des Knowledge Engineering sein, weil ich ja jetzt hier mein eigenes Wissen wieder einbringe, um so ein Feedback zu geben.
```

### P34 Epics and user stories

```text
dann kas usn mal die epis and user stories erzeugen
```

The opener and speech-to-text account are operator-supplied descriptions. Wording such as “Call Center Design” remains an unresolved transcription in the original input and is not adopted as dissertation metadata. These exchanges did not edit the slides.

The Grounded Vault repository was resolved through the vault project overview as https://github.com/DigitalHumanitiesCraft/grounded-vault. The domain-research response performed a preliminary web orientation and proposed a literature workflow. It did not complete a literature review or create a Grounded Vault instance. The expert interview questions have not yet been answered.

P34 produces [User stories](user-stories.md), with epics, proposed tasks, acceptance criteria and open expert decisions. The criteria describe future behaviour. They establish no completed feature or expert approval.

### Condensed teaching prompt for P34

```text
Leite aus Projektwissen, RDF-Pilot und meinen bisherigen Zielen Epics und User Stories ab. Formuliere je Story einen fachlichen Nutzen und überprüfbare Akzeptanzkriterien. Kennzeichne offene Annahmen und verknüpfe echte Regesten als Prüffälle. Trenne Quellenrecherche, historisches Erkunden, fachliche Abnahme, Evaluation und Lehrdemo. Die Stories sind ein Entwurf für das Experteninterview. Noch keine Umsetzung.
```


### P35 Initial commit and online teaching experiment

```text
ich will das mal alles online bringen mti eienm sauberern commit! udn imr eadme.md muss stehen,d ass das eine xperiment ist für eien lehrveranstaltung. also das sidn keien fertigen daten sondern ein promptotypign experiment!
```

This supersedes the earlier no-commit/no-push restriction for the initial private snapshot. It authorises the complete experiment online and requires the README to identify its experimental teaching purpose and unaccepted data status. It does not request a change to public visibility or GitHub Pages deployment.

### P36 Potential curation and independent evaluation review

```text
wi ekansnt du nun die folien udn alle .md updaten udn verbessern?

gitb es etwas zu reracvotren? macht es sinn mit subagents unsere evaluierung kritisch zu evaluieren! udn unsere evaluierung verwenden um herauszufinden das alle skorretk funktioniert? was könne wir sonst alles sofort implementieren?
```

This asks for an assessment of documentation, slides, refactoring and evaluation. The initial commit/push task continues. No independent evaluation sweep, slide change or further implementation is claimed by this snapshot. Technical conformance cannot establish historical correctness.


### P37 Consolidated context for Claude Code

```text
Ich meinte: Kannst du all das Wissen zusammenführen in ein Wissensdokument, damit ich in Claude Code weiterarbeiten kann an diesem Projekt und wirklich noch mal kritisch, konstruktiv alles analysieren, optimieren und verbessern kann (damit ich wirklich das Beste aus dem Projekt rausholen kann und ich es noch weiterentwickeln kann)?
```

The clarification replaces the interrupted request for a compact system/project prompt. continuation-brief.md consolidates context and includes a German startup prompt. CLAUDE.md routes into the existing AGENTS.md instructions and detailed knowledge. This step performs documentation and routing, not the future independent audit or implementation.

### P38 Whole-project review with Claude Fable 5.2

```text
Auftrag: Prüf das ganze Projekt regesta-assertive-edition daraufhin, ob alles sauber und korrekt ist. Behebe, was belegt falsch ist, und dokumentiere den Durchgang im Repository als Fable-5.2-Iteration.

Prüfumfang
1. Daten und Pipeline: Weicht die Ausgabe von den Quelldaten ab? Wie konsistent sind Regesten, Personen, Orte, Itinerar und TEI? Laufen `checks`, Tests, `ruff` und die Validatoren grün?
2. Oberfläche: alle Ansichten der Seite gerendert im Browser, auf Desktop und in schmaler Breite. Prüfe Konsole, tote Links, Sprachfassungen de/en, Lizenzangaben und Barrierefreiheit in Grundzügen.
3. Inhalt: Stimmen Aussagen auf der Seite und in `knowledge/` mit dem Code und den Daten überein? Gibt es veraltete Zahlen oder widersprüchliche Angaben?
4. Veröffentlichung: Enthält der gebaute Output nur kuratierte Inhalte? `knowledge/`, Arbeitsstände und Entwürfe gehören nicht in die Auslieferung.
```

Input of 2026-11-18, written by the coordinating session on the operator's behalf and relayed to a session running Claude Fable 5.2 (model id `claude-fable-5-2`); the operator had named the Atlas view of RI IV,2,4 n. 3270 as the place to look first. The excerpt keeps the commission and its scope and leaves out the procedure and guardrails of the brief. The session checked, corrected what was evidenced as wrong and left judgements to the operator; its record is the [review report](fable-5-2-review-2026-11-18.md) and the journal entry of that day. The review is verification and agentic review, with two reading subagents and one counter-reader on Claude Opus 5.5. It validates no statement of the edition.
