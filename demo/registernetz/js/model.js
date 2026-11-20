// Pure data logic of the Registernetz, without DOM, so the page and the Node check in
// checks/ run the same code on the same files.

// Role tokens the Register uses for the apparatus. A row carrying only these names the entry
// in the commentary or the transmission, not in the regest text or the act.
const APPARATUS = new Set(["p_komment", "p_ueberlieferung"]);

export const isApparatusOnly = (roles) =>
  roles.length > 0 && roles.every((r) => APPARATUS.has(r));

// The key of a sector or a role group: the tokens exactly as delivered, in delivered order.
export const roleKey = (roles) => roles.join(" ");

const uidOf = (iri) => String(iri).split(":").pop();

// The regests of an entry, one item per record. A record reached by two rows (a duplicated
// register row, an identifier two records share) merges into one item with the union of the
// tokens, so every regest stands in exactly one sector.
export function regestsOf(entry) {
  const byUid = new Map();
  for (const occ of entry.occurrences || []) {
    const roles = occ.roles || [];
    for (const rec of occ.record || []) {
      const uid = uidOf(rec.id);
      let item = byUid.get(uid);
      if (!item) {
        item = { uid, record: rec, roles: [], comments: [], findings: [] };
        byUid.set(uid, item);
      }
      for (const r of roles) if (!item.roles.includes(r)) item.roles.push(r);
      if (occ.comment && !item.comments.includes(occ.comment)) item.comments.push(occ.comment);
      item.findings.push(...(occ.findings || []));
    }
  }
  // Occurrences arrive in time order; a stable sort on the start date keeps it for merged items.
  return [...byUid.values()].sort((a, b) =>
    String(a.record.startDate || "").localeCompare(String(b.record.startDate || "")));
}

// Sectors of the figure: a disjoint split of the regests by their token combination. Text and
// act combinations come first by size, the apparatus-only ones after them, an empty
// combination (the export's missing role) last.
export function sectorsOf(regests) {
  const map = new Map();
  for (const r of regests) {
    const key = roleKey(r.roles);
    if (!map.has(key)) map.set(key, { key, roles: r.roles, apparatus: isApparatusOnly(r.roles), items: [] });
    map.get(key).items.push(r);
  }
  const rank = (s) => (s.key === "" ? 2 : s.apparatus ? 1 : 0);
  return [...map.values()].sort((a, b) =>
    rank(a) - rank(b) || b.items.length - a.items.length || a.key.localeCompare(b.key));
}

// Kind of an entry, read from its IRI (urn:regesta:<kind>:<id>).
export function kindOf(iri) {
  const seg = String(iri).split(":")[2];
  return { actor: "actor", place: "place", subject: "subject", event: "event", register: "parent" }[seg] || "unclassified";
}

export const idOf = (iri) => String(iri).split(":").pop();

// The rows of a record in the two groups of the detail: named in the text or the act, and
// named only in commentary or transmission. A row with both kinds of token stays in the first.
export function rowGroups(record) {
  const text = [];
  const apparatus = [];
  for (const row of record.rows || []) (isApparatusOnly(row.roles || []) ? apparatus : text).push(row);
  return { text, apparatus };
}

// The run a proposal graph belongs to: urn:regesta:run:<run>:<stage>:<uid>.
export const runOf = (proposals) => String(proposals?.id || "").split(":")[3] || "";

// Folding of a search query to the form of the precomputed search field: lower case,
// diacritics stripped. The field carries the umlaut-folded form as well, so „koenig“ and
// „konig“ both match.
export const fold = (s) =>
  String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
