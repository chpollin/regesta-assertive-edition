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
import { t } from "./i18n.js";

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
  // The kinds of a regest's statements as their signs, in a column of their own after the place;
  // the Art chips of the bar name them. The signs say „mit Aussagen“, so such a row carries no
  // second mark (design round of 2026-11-18); the column stays empty in a row without them.
  const signs = (r) => {
    const keys = selection.familiesOf.get(r.u);
    if (!keys) return h("span", { class: "row-fams" });
    const fams = FAMILIES.filter((f) => keys.has(f.key));
    return h("span", { class: "row-fams", title: fams.map((f) => f.label).join(", ") }, fams.map((f) => familyIcon(f, { size: 13 })), h("span", { class: "visually-hidden", text: fams.map((f) => f.label).join(", ") }));
  };
  // The beginning of the regest text, so a row says what the regest is about. The texts of the
  // delivery arrive after the list; a row drawn before fills in when they come.
  let texts = null;
  const textOf = (u) => store.byUid.get(u)?.text ?? texts?.[u] ?? "";
  const lead = (r) => h("span", { class: "row-text", lang: "de", "data-text": r.u, "aria-hidden": "true", text: textOf(r.u) });
  options.texts().then((t) => {
    texts = t;
    for (const el of list.element.querySelectorAll(".row-text[data-text]")) if (!el.textContent) el.textContent = textOf(el.dataset.text);
  });
  const list = createList({
    label: t("list.label"),
    onOpen: (u) => detail.open(u),
    mark: (r) => (filters.persons.length ? selection.personMark(r.u) : r.stmt && !selection.familiesOf.has(r.u) ? "is-evidenced" : ""),
    // The dating prose stands in the opened regest; in the row the year says when (density
    // check of the work profile, 2026-11-18).
    extra: (r) => [signs(r), lead(r)],
  });
  // Quiet column heads over the rows, for the eye only; each row names its parts itself.
  const head = h("div", { class: "reg-head", "aria-hidden": "true" }, ["year", "number", "place", "statements", "regest"].map((w) => h("span", { text: t(`list.col.${w}`) })));
  const frame = createFrame(filters, {
    name: "regesten",
    title: t("regesten.title"),
    facets: facets.element,
    count: count.element,
    list: null,
    tools: [],
    main: h("div", { class: "reg-list" }, head, list.element),
    dock: true,
    backLabel: t("regesten.back"),
    backShort: t("regesten.backShort"),
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
