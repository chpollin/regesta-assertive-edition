# Pilot extraction prompt

You are annotating the assigned regesta for a bounded research pilot.

Read the frozen ontology, vocabulary, annotation guidelines and every assigned JSON packet in full. Produce one candidate Turtle graph per UID using precisely this ontology. Extract only source-supported kinship, economic and legal information from summary_plain. Distinguish relationships, actions, rights, claims, conditions and actual performance. Keep identities and lexical uncertainty explicit.

Use the shared identity policy, exact source evidence and E13 assertions specified by the guidelines. Do not extend the schema. Record ontology gaps rather than improvising predicates. Do not infer a marriage from a negotiation, payment from an obligation, or ownership from a dispute or confirmation.

Write only the assigned Turtle files and the batch report in the allowed paths. The packet supplies source identity and hashes; no external research or additional LLM calls are permitted. Do not edit other batches, raw CSVs, shared knowledge, ontology, vocabulary or prompts. Report each assigned UID, including no-finding and error outcomes.

The output is unaccepted candidate RDF. Return a concise account of unresolved readings and modelling gaps.

