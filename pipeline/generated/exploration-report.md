# Exploration snapshot

Computed from the supplied files on 2026-11-09. Counts refer to export records and index occurrences. They are not historical population or event counts.

## Source fingerprints

| File | Rows | Columns | SHA-256 |
|---|---:|---:|---|
| RI_004-002-ReggBarbarossa.csv | 3582 | 32 | 62ac7b189097521cd7aba73c8fe0d555efee523a404b9c0c4a357adc3488f750 |
| RI_004-002-RegisterBarbarossa.csv | 37766 | 17 | d3480d14b418b8ece9b8aa55ec0d5e6e824b1c36c1a1907b29a9bf68296293c0 |

## Counting units and join

- Distinct index entity IDs: 11484.
- Exact, unambiguous joined index rows: 37754.
- Ambiguous index rows: 12.
- Unmatched index rows: 0.
- Regesta records with unambiguous index rows: 3543.
- Regesta records without unambiguous index rows: 39.
- Child entity IDs whose parent does not occur as an entity ID in this export: 6216.
- Repeated entity-regest-role groups: 6.

## Dating and coordinate review

- Exported date-boundary range: 1122-01-01 to 1190-12-31.
- Date review findings: {"prose_year_review_candidate": 3, "reversed_interval": 3}.
- Coordinate findings at occurrence level: 44.
- Prose-year candidates use a limited lexical heuristic. Relative dates and abbreviated ranges are excluded where recognised; every candidate still needs source review.
- Coordinate validity checks syntax and numeric range, not historical location or geocoding accuracy.

## Measured distributions

### Index occurrence types

| Value | Export rows |
|---|---:|
| person | 27021 |
| ort | 9903 |
| sache | 663 |
| ereignis | 157 |
| ort und 4 (vgl. Nachtrag Lief. III und IV) | 3 |
| ort. ─ Abt: | 3 |
| person, <i>vgl. auch</i> | 3 |
| ? | 2 |
| null | 2 |
| ort und b | 2 |
| ort(vgl. Nachtrag Lief. IV) | 2 |
| ort. ─ Edle: | 2 |
| ort° | 1 |
| person und b | 1 |
| persona | 1 |

Complete table: [aggregations/index-types.csv](aggregations/index-types.csv).

### Tokens from the delivered role field

| Value | Export rows |
|---|---:|
| nennung | 29227 |
| p_komment | 6135 |
| austOrt | 2725 |
| empfaenger | 1375 |
| rekogneszent | 833 |
| adressat | 396 |
| p_ueberlieferung | 374 |
| petent | 328 |
| zeuge | 306 |
| zustimmend | 36 |
| p_tot | 22 |
| beratend | 12 |
| gerichtsbeisitzer | 9 |
| subskribent | 8 |

Complete table: [aggregations/index-role-tokens.csv](aggregations/index-role-tokens.csv).

### Regesta by exported start year, sorted by frequency

| Value | Export rows |
|---|---:|
| 1189 | 203 |
| 1162 | 166 |
| 1159 | 162 |
| 1167 | 160 |
| 1164 | 151 |
| 1155 | 147 |
| 1177 | 138 |
| 1158 | 136 |
| 1160 | 134 |
| 1163 | 133 |
| 1185 | 109 |
| 1152 | 106 |
| 1186 | 106 |
| 1178 | 104 |
| 1184 | 97 |

Complete table: [aggregations/regesta-by-start-year.csv](aggregations/regesta-by-start-year.csv).

### Regesta by unnormalised locality string

| Value | Export rows |
|---|---:|
| null | 962 |
| Pavia | 105 |
| Lodi | 64 |
| Würzburg | 60 |
| Worms | 38 |
| Regensburg | 37 |
| Ulm | 30 |
| - | 29 |
| Frankfurt | 28 |
| Venedig | 27 |
| (Pavia) | 26 |
| – | 26 |
| S. Salvatore bei Pavia | 24 |
| vor Crema | 24 |
| Aachen | 21 |

Complete table: [aggregations/regesta-by-locality.csv](aggregations/regesta-by-locality.csv).

### Regesta by delivered volume key

| Value | Export rows |
|---|---:|
| 4002002 | 1220 |
| 4002004 | 901 |
| 4002003 | 808 |
| 4002001 | 560 |
| null | 93 |

Complete table: [aggregations/regesta-by-volume.csv](aggregations/regesta-by-volume.csv).

## Complete evidence

Field completeness and text length distributions are in the two *-columns.csv tables. Entity counts and degree rankings use distinct supplied IDs, not labels. All quality findings are retained in the issue tables. Machine-readable totals and methods are in profile.json. Real teaching examples are in teaching-examples.json.

The export contains an editorially selective index. Frequency ranks and shared regesta do not establish historical importance, direct interaction or a social relationship.
