/**
 * The estate (Stand) of a person or group, for the colour of the person drawings, after the
 * operator's question of 2026-11-14 („Warum muss die Netzwerkvisualisierung alles nur schwarz
 * sein? Können Farben keine Aussage bringen?“).
 *
 * A rule, not a source statement: the register description of the person (the delivery's
 * register file, through holdings.json), or the name forms of the run where the register has
 * none, is searched for estate words. A ruler's title of the person's own (König, Kaiser,
 * Königin, Kaiserin; in a register description not followed by a name in the genitive, so
 * „missus König Konrads III.“ does not count) decides first; otherwise the estate word that
 * stands first, so „Richter und missus …“ is lay. Without a word the estate stays open. The
 * key under each drawing names the colours; knowledge/data.md, Estate, holds the rule.
 */
export const STANDS = [
  { key: "ruler", label: "Herrscher" },
  { key: "church", label: "geistlich" },
  { key: "lay", label: "weltlich" },
  { key: "open", label: "ohne Angabe" },
];

const RULER = /\b(?:Kaiserin|Kaisers?|Königin|Königs?|Sultan|Doge)(?![\wäöüß])/g;
// After a ruler's word in a register description, a capitalised genitive names someone else.
const GENITIVE_AFTER = /^\s+[A-ZÄÖÜ][\wäöüß]*s(?![\wäöüß])/;
const WORDS = [
  [
    "church",
    /(?:^|[^\wäöüßÄÖÜ])(?:Papst|Patriarch|Kardin[aä]l|Legat|Erzbisch|Bisch|Elekt|Abt\b|Abtes|Äbtissin|Propst|Pröpst|Dompropst|Dekan|Prior|Mönch|Kanoniker|Domkanoniker|Kapellan|Kaplan|Priester|Diakon|Archidiakon|Kloster|Klöster|Stift|Domkapitel|Kirche|Bistum|Erzbistum|Konvent|Templer|Johanniter)/,
  ],
  [
    "lay",
    /(?:^|[^\wäöüßÄÖÜ])(?:Herzog|Markgr[aä]f|Pfalzgr[aä]f|Landgr[aä]f|Burggr[aä]f|Gr[aä]f|Ritter|Ministerial|Vogt|Vögt|Edelfrei|Konsul|Richter|Bürger|Stadt\b|Kommune|Fürst|Podest)/,
  ],
];

function standOfText(text, described) {
  for (const m of text.matchAll(RULER)) {
    if (!described || !GENITIVE_AFTER.test(text.slice(m.index + m[0].length))) return "ruler";
  }
  let best = "open";
  let at = Infinity;
  for (const [key, re] of WORDS) {
    const m = re.exec(text);
    if (m && m.index < at) {
      at = m.index;
      best = key;
    }
  }
  return best;
}

/** @param {{holdings?: any}} store @param {{id: string, label: string, labels?: string[]}} node */
export function standOf(store, node) {
  const reg = node.id.match(/actor:(RI\d{3}-\d{3}-[A-Z]\d{6})$/)?.[1];
  const described = reg ? store.holdings?.persons?.[reg]?.f : null;
  return described ? standOfText(described, true) : standOfText([node.label, ...(node.labels ?? [])].join(" "), false);
}
