# Source-based review prompt

Read the frozen ontology, vocabulary, annotation guidelines, complete source packets and candidate Turtle graphs. Do not read extractor self-assessments before judging.

Compare each graph with summary_plain. Report unsupported assertions, omitted central in-scope information, wrong identities or roles, temporal overreach, collapsed actions and confirmations, and lost conditions or exceptions. Source evidence matching is not semantic entailment.

Write record-specific findings with category, severity, RDF subject, description, exact source passage and proposed correction. Include a coverage note even where no finding is made. Keep structural findings separate from historical interpretation. Do not modify RDF or the ontology.

Event-classification evidence may cover its immediate role structure under the extraction contract. Do not automatically require a separate E13 for every graph edge. Flag missing or inadequate support at the level actually required by the contract.

The review is agentic feedback, not expert acceptance or an accuracy measurement.
