# Licences of texts and data

The code of this repository is under the MIT licence ([LICENSE](LICENSE)). Everything else follows the terms below.

## Texts and derived data of this project

Texts, documentation and the data this project derives (factoid runs, view data, TEI, the graph export) are licensed under Creative Commons Attribution 4.0 International (CC BY 4.0), https://creativecommons.org/licenses/by/4.0/. Copyright 2026 Christopher Pollin.

The statements in the runs were produced by LLM agents and are checked technically and by agentic review only. No historian has validated them, and they are no statements of Regesta Imperii.

## Supplied Regesta Imperii data

The regesta and register in `pipeline/source-material/` come from the Regesta Imperii, Abteilung IV,2 (Friedrich I. Barbarossa), edited by the Deutsche Kommission für die Bearbeitung der Regesta Imperii at the Akademie der Wissenschaften und der Literatur Mainz. The regesta database of Regesta Imperii is published under CC BY 4.0. The register file is byte-identical with the public file in the RI Lab repository (https://gitlab.rlp.net/adwmainz/regesta-imperii/lab/regesta-imperii-data). For the regest file no identical public copy was found, and its licence follows from that of the database; its export date is still to be established ([knowledge/data.md](knowledge/data.md#rights)).

Attribution: Regesta Imperii Online, https://www.regesta-imperii.de, CC BY 4.0. This project modified the data: markup was converted to plain text, regesta were selected and linked, and RDF statements were generated from the regest texts with an LLM. The Akademie der Wissenschaften und der Literatur Mainz is not involved in this project and has not checked it.

## Other material

- Fonts in `fonts/` keep the SIL Open Font License of their authors, with the texts beside them (`*-OFL.txt`).
- The base map `js/basemap.json` is cut from Natural Earth (public domain). The border in `js/realm.json` is this project's rough trace of W. R. Shepherd's map of 1926, whose scan the Perry-Castañeda Library states as public domain ([knowledge/data.md](knowledge/data.md#empire-about-1190)).
- The TEI schema `schema/tei_all-4.12.0.rng` is from the TEI Consortium under CC BY and BSD-2, as its header states.
