/**
 * The selection over the whole delivery: one index of its regesta and one rule for which of
 * them pass the facets of js/filters.js. Atlas, Regesten and Personen count and list with this
 * rule, so a time range, a place or a kind of statement gives the same regesta in every view
 * (knowledge/interface-plan.md, One filter model).
 *
 * Facets and their rule:
 * - Zeitraum: the year of the delivered start date lies in the range.
 * - Ort: the place of issue of the register is the chosen place.
 * - Person: the register names at least one of the chosen persons in the regest.
 * - Schicht „mit Aussagen“: the regest belongs to the run and carries at least one statement.
 * - Art: none pressed means all; pressed kinds keep the regesta with at least one statement of
 *   one of them (OR), so a pressed kind narrows to regesta with statements, as in the network.
 * - Text: every word of the search stands in the identifier or the regest text, folded as in
 *   the lists (lower case, umlauts spelled out, other marks stripped). Only the list evaluates
 *   it; the texts load on demand (data/holdings-texts.json).
 */
import { familyOf } from "./relations.js";
import { yearOf } from "./svg.js";

/** Search folding: lower case, umlauts spelled out, other marks stripped, other signs to spaces. */
export function fold(text) {
  return String(text)
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9†]+/g, " ");
}

/** The facets a view can leave out of the rule. */
export const FACETS = Object.freeze(["time", "place", "person", "layer", "art", "text"]);

/**
 * @param {{edition: any, holdings: any}} store
 * @param {any} filters  the state of js/filters.js
 */
export function createSelection(store, filters) {
  const H = store.holdings;
  const places = H.places;
  // The run's regesta with at least one evidenced statement, and their kinds.
  const familiesOf = new Map();
  for (const r of store.edition.regests) {
    const keys = new Set((r.blocks ?? []).filter((b) => b.head?.evidence).map((b) => familyOf(b.title).key));
    if (keys.size) familiesOf.set(r.uid, keys);
  }
  const rows = H.regesta
    .map((r) => {
      const y = yearOf(r.s);
      const placed = !!(r.p && places[r.p]);
      return { u: r.u, i: r.i, y, year: Math.floor(y), p: placed ? r.p : null, place: placed ? places[r.p].l : r.l || "", dating: r.d || "", run: store.byUid.has(r.u), stmt: familiesOf.has(r.u) };
    })
    // By date only: the sort is stable and the holdings arrive in the order of
    // edition_io.regest_order, the order check_itinerary.py checked the steps in. A second
    // rule here once moved same-day regesta, so flags named steps the cube did not draw.
    .sort((a, b) => a.y - b.y);
  const byUid = new Map(rows.map((r) => [r.u, r]));

  let personSets = [];
  let personKey = "";
  const syncPersons = () => {
    const key = filters.persons.join(",");
    if (key === personKey) return;
    personKey = key;
    personSets = filters.persons.map((id) => new Set(H.persons?.[id]?.r ?? []));
  };

  // The folded texts for the search, built once the texts are loaded.
  let textIndex = null;
  let words = [];
  let wordsOf = "";
  const syncWords = () => {
    if (wordsOf === filters.q) return;
    wordsOf = filters.q;
    words = fold(filters.q).split(" ").filter(Boolean);
  };

  /**
   * Whether a regest passes the facets; `skip` names facets the caller leaves out (a view that
   * cannot evaluate them), `layer` forces the layer (the network shows statements only).
   * @param {{u: string, year: number, p: string|null, stmt: boolean}} row
   * @param {{skip?: Set<string>, layer?: string}} [options]
   */
  function passes(row, { skip, layer } = {}) {
    syncPersons();
    const off = (facet) => skip?.has(facet);
    if (!off("time") && !filters.inYear(row.year)) return false;
    if (!off("place") && filters.place && row.p !== filters.place) return false;
    if (!off("person") && personSets.length && !personSets.some((set) => set.has(row.u))) return false;
    if (!off("layer") && (layer ?? filters.layer) === "aussagen" && !row.stmt) return false;
    if (!off("art") && filters.familiesSet() && ![...(familiesOf.get(row.u) ?? [])].some((k) => filters.familyOn(k))) return false;
    if (!off("text") && filters.q) {
      syncWords();
      const hay = textIndex?.get(row.u) ?? fold(row.i);
      if (!words.every((w) => hay.includes(w))) return false;
    }
    return true;
  }

  return {
    rows,
    byUid,
    familiesOf,
    passes,
    /** The rows that pass, in time order. */
    filter: (options) => rows.filter((r) => passes(r, options)),
    /** Which of the chosen persons a regest names: "is-pa", "is-pb", "is-pab" or "". */
    personMark(u) {
      syncPersons();
      const [a, b] = personSets.map((set) => set.has(u));
      return a && b ? "is-pab" : a ? "is-pa" : b ? "is-pb" : "";
    },
    personSets() {
      syncPersons();
      return personSets;
    },
    /** Hand in the regest texts (uid to text) for the search. */
    setTexts(texts) {
      textIndex = new Map(rows.map((r) => [r.u, fold(`${r.i} ${texts[r.u] ?? ""}`)]));
    },
    hasTexts: () => !!textIndex,
  };
}
