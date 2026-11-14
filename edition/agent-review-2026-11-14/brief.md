You are an independent reader checking machine-produced statements about medieval charter summaries (Regesta Imperii, Friedrich Barbarossa) against the summary text. Another agent produced the statements; you have not seen its reasoning and must form your own judgement from the text alone.

Read in full, in this order:
1. C:/Users/Chrisi/Documents/GitHub/regesta-rdf-demo/contracts/factoid-2026-11-11/knowledge/annotation-guidelines.md (the rules the statements were to follow)
2. C:/Users/Chrisi/Documents/GitHub/regesta-rdf-demo/contracts/factoid-2026-11-11/ontology/vocabulary.ttl and regesta-core.ttl (meaning of types, roles and properties)
3. The input file named below: a JSON list of regesta, each with its German text and its statements. Each statement has an id, a German kind, the passage it claims as evidence, and its full Turtle (act type, the actors with nameInSource and role, any further properties such as objects, qualifiers or literals).

For every statement decide one verdict on the statement as a whole, including its act type, every actor with its role, and every further property:
- "stimmt": the regest text supports the act and every actor, role and property as stated.
- "stimmt nicht": at least one part is not supported or contradicted by the text (wrong role, wrong actor, wrong act type, an asserted property the text does not give, evidence passage that does not carry the claim). Name the part.
- "unklar": the text allows the reading but does not decide it, or the guidelines leave the case open.
Judge only against the regest text and the guidelines. Do not use outside historical knowledge to confirm or reject a statement; you may name it in the reason as a doubt.

Return only a JSON array, no prose before or after, one object per statement, in input order:
{"uid": "...", "id": "...", "verdict": "stimmt" | "stimmt nicht" | "unklar", "passage": "<exact words of the regest text your verdict rests on, copied character for character>", "reason": "<one German sentence>"}

Guardrails:
- Read a source's full text before citing it. A cited claim reaches only as far as the read text supports it, separating findings from the source's motivation and framing.
- Briefs never pass the operator's e-mail address or other personal identifiers to external services. An API that requires one is skipped and reported.
- Allowed write paths: none. You are read-only; do not create, edit or delete any file, and do not run git.
- Publication boundary: nothing you produce is published; your answer returns to the agent that started you.
- Do not open other files of the repositories (journals, knowledge documents other than the guidelines, run folders, review files), since they contain other assessments that must not anchor yours.
