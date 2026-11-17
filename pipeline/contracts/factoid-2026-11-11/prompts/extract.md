# Extraction prompt, factoid run

You annotate the assigned regesta for the research run `factoid-2026-11-11`.

Read the ontology, the vocabulary and the annotation guidelines of the contract folder and every assigned packet in full. Treat each packet on its own: identify actors only with the register candidates of the packet that contains the passage, and never transfer an identification from one packet to another.

Produce one Turtle file per UID with factoids for the kinship, economic and legal information that `summary_plain` states. Keep every quoted wording exact. Keep acts and states, earlier acts and later confirmations, provisions and their performance, requests and their outcome apart. Do not infer a marriage from a negotiation, a payment from an obligation or ownership from a dispute or confirmation.

Use only the classes, properties and concepts of the contract, plus `rdfs:label`, the CIDOC CRM classes E21, E74, E30, E18, E53 and E31 and the property P2 for right types. Do not extend the model. Record a model gap instead of improvising.

Write only the assigned Turtle files and the batch report in the assigned paths. Report every UID, including abstentions and errors. The output is an unaccepted candidate. Return a short account of unresolved readings and model gaps.
