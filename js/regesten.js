/**
 * Regesten: which regesta match my selection, and what does one say? (knowledge/interface-plan.md,
 * part 2). The list of the whole delivery with the shared filter bar of the Atlas plus the text
 * search; the regesta of the run with statements carry the ochre mark and the signs of their
 * kinds. Year and place stand in every row (operator's decision of 2026-11-18). A row opens the
 * regest beside the list, as in the Atlas; a regest of the run leads from there to its own page.
 *
 * The list renders a page of rows and adds the next page when its end scrolls into view, so
 * the whole delivery stays fast. The regest texts for the search load on the first search.
 *
 * Hash: #/regesten[/regest/<uid>]; the facets live in the query string (js/filters.js), with
 * the list's old parameters q and art unchanged.
 */
import { h } from "./dom.js";
import { createCount, createDetail, createFacets, createFrame, createList } from "./filterbar.js";
import { renderRegestCard } from "./regest-card.js";
import { FAMILIES, familyIcon } from "./relations.js";
import { createSelection } from "./selection.js";

function readUid() {
  const m = location.hash.match(/^#\/regesten\/regest\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * @param {any} store  edition, holdings and byUid, as in js/app.js
 * @param {{filters: any, texts: () => Promise<Record<string, string>>}} options
 */
export function renderRegesten(store, options) {
  const { filters } = options;
  const selection = createSelection(store, filters);
  const persons = Object.entries(store.holdings.persons ?? {})
    .map(([id, p]) => [id, p.l, p.r.length])
    .sort((a, b) => b[2] - a[2]);
  // The texts for the search: on the first search, or at once when the address carries one.
  let loading = null;
  const loadTexts = () =>
    (loading ??= options.texts().then((texts) => {
      // The run's regesta carry their text in edition.json as well; it wins where both exist.
      selection.setTexts({ ...texts, ...Object.fromEntries(store.edition.regests.map((r) => [r.uid, r.text])) });
      render();
    }));
  if (filters.q) loadTexts();

  const facets = createFacets(store, filters, { prefix: "reg", persons, onSearch: loadTexts, marks: () => (filters.any() ? new Set(shown.map((r) => r.year)) : new Set()) });
  const count = createCount(filters);
  // The kinds of a regest's statements as their signs; the Art chips of the bar name them.
  const signs = (r) => {
    const keys = selection.familiesOf.get(r.u);
    if (!keys) return null;
    const fams = FAMILIES.filter((f) => keys.has(f.key));
    return h("span", { class: "row-fams", title: fams.map((f) => f.label).join(", ") }, fams.map((f) => familyIcon(f, { size: 13 })), h("span", { class: "visually-hidden", text: fams.map((f) => f.label).join(", ") }));
  };
  const list = createList({
    label: "Regesten der Auswahl",
    onOpen: (u) => detail.open(u),
    mark: (r) => (filters.persons.length ? selection.personMark(r.u) : r.stmt ? "is-evidenced" : ""),
    // The dating prose stands in the opened regest; in the row the year says when (density
    // check of the work profile, 2026-11-18).
    extra: (r) => signs(r),
  });
  const frame = createFrame(filters, {
    name: "regesten",
    title: "Regesten der Lieferung",
    facets: facets.element,
    count: count.element,
    list: null,
    tools: [],
    main: h("div", { class: "reg-list" }, list.element),
    backLabel: "Zurück zur Liste",
    onEscape: () => detail.close(),
  });
  const detail = createDetail(frame, {
    list,
    hashOf: (u) => (u ? `#/regesten/regest/${encodeURIComponent(u)}` : "#/regesten"),
    readUid,
    card: (u) => renderRegestCard(store, u, { texts: options.texts, onClose: () => detail.close() }),
  });

  let shown = [];
  function render() {
    shown = selection.filter();
    facets.update();
    count.update(shown.length, selection.rows.length);
    frame.updateSheet(shown.length);
    list.update(shown);
    list.setOpened(detail.opened());
  }
  const unsubscribe = filters.onChange(() => {
    if (filters.q && !selection.hasTexts()) loadTexts();
    render();
  });
  render();
  const first = readUid();
  if (first) requestAnimationFrame(() => detail.open(first, { push: false }));

  return {
    element: frame.root,
    full: true,
    dispose() {
      unsubscribe();
      frame.dispose();
      list.dispose();
      detail.dispose();
    },
  };
}
