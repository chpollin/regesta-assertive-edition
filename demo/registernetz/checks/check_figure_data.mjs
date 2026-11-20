// Data assertions for the figure and the detail of the Registernetz, run on the real files
// with the page's own model code: node demo/registernetz/checks/check_figure_data.mjs
//  1. Beatrix (RI004-002-B000330): the sectors are disjoint and sum to her number of regests.
//  2. Every entry of the delivery: the same partition property, so no regest stands twice.
//  3. RI IV,2,3 n. 2077 (uid 24711): 27 register rows, split without loss into the two groups.
// Exit code 1 on any failure.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { regestsOf, sectorsOf, rowGroups } from "../js/model.js";

const data = fileURLToPath(new URL("../data/", import.meta.url));
const read = (p) => JSON.parse(readFileSync(data + p, "utf8"));
let failed = 0;
const check = (ok, msg) => { console.log(`${ok ? "ok  " : "FAIL"} ${msg}`); if (!ok) failed++; };

function partition(entry) {
  const regests = regestsOf(entry);
  const sectors = sectorsOf(regests);
  const uids = sectors.flatMap((s) => s.items.map((i) => i.uid));
  const distinct = new Set((entry.occurrences || []).flatMap((o) => o.record.map((r) => r.id.split(":").pop())));
  return { regests, sectors, sum: uids.length, unique: new Set(uids).size, distinct: distinct.size };
}

const beatrix = read("entry/RI004-002-B000330.jsonld");
const b = partition(beatrix);
console.log(`     Beatrix sectors: ${b.sectors.map((s) => `${s.key} ${s.items.length}`).join(", ")}`);
check(b.sum === b.distinct && b.unique === b.sum, `Beatrix: sectors sum to ${b.sum}, distinct regests ${b.distinct}`);
const index = read("index.json").entries.find((e) => e.id === "RI004-002-B000330");
check(index.rows === b.sum, `Beatrix: index rows ${index.rows} equal the sector sum`);

let bad = 0;
const files = readdirSync(data + "entry");
for (const f of files) {
  const p = partition(read(`entry/${f}`));
  if (p.sum !== p.distinct || p.unique !== p.sum) bad++;
}
check(bad === 0, `all ${files.length} entries: sectors disjoint and complete (${bad} failing)`);

const rec = read("record/24711.jsonld");
const g = rowGroups(rec);
check(rec.rows.length === 27, `RI IV,2,3 n. 2077: ${rec.rows.length} register rows`);
check(g.text.length + g.apparatus.length === 27, `RI IV,2,3 n. 2077: groups ${g.text.length} + ${g.apparatus.length} = 27`);
check(b.regests.some((r) => r.uid === "24711" && r.roles.join(" ") === "petent"), "Beatrix carries petent in n. 2077");

process.exit(failed ? 1 : 0);
