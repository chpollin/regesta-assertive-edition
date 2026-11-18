/**
 * Personen: with whom does a person stand in an attested relation, and when is the person
 * named? (knowledge/interface-plan.md, part 3). Two representations under one switch at the
 * place of the Atlas's switch: Netz, the circle around a person from the statements of the run
 * (js/overview.js), and Zeitband, the persons of the register over the years (js/timeband.js).
 * Both share the filter bar of the Atlas; a facet a representation cannot evaluate stays greyed
 * with a tooltip.
 *
 * - Netz: the Person facet is the centre of the circle (a register person of the run's graph);
 *   an actor named only in the wording of one regest is the centre through the hash
 *   #/personen/<IRI>. The network consists of statements, so Schicht stands fixed on „mit
 *   Aussagen“, greyed.
 * - Zeitband: every facet but the text search; the rows are the persons named in the regesta
 *   of the selection, the chosen person is the marked row, a click on a row chooses the person.
 * The count line and the list hold the regesta of the selection the representation shows, by
 * the same rule as Atlas and Regesten (js/selection.js). The opened regest stands beside the
 * figure, as in the Atlas.
 */
import { h } from "./dom.js";
import { createCount, createDetail, createFacets, createFrame, createList } from "./filterbar.js";
import { renderOverview } from "./overview.js";
import { renderRegestCard } from "./regest-card.js";
import { createSelection } from "./selection.js";
import { s } from "./svg.js";
import { renderTimeband } from "./timeband.js";
import { writeAddress } from "./url.js";
import { t } from "./i18n.js";

const ACTOR = "urn:regesta:actor:";
const regOf = (iri) => iri?.match(/^urn:regesta:actor:(RI\d{3}-\d{3}-[A-Z]\d{6})$/)?.[1] ?? null;
const TEXT_OFF = t("persons.textOff");

/**
 * @param {any} store  edition, holdings and byUid, as in js/app.js
 * @param {{view: "netz"|"zeitband", actor?: string|null, filters: any, texts?: () => Promise<Record<string, string>>, personPage?: (iri: string) => string|null}} options
 */
export function renderPersons(store, options) {
  const { filters, view } = options;
  const H = store.holdings;
  const selection = createSelection(store, filters);
  const graph = store.edition.graph;
  const inGraph = new Set(graph.nodes.filter((n) => n.kind !== "act").map((n) => n.id));
  const netz = view === "netz";
  // An old address #/personen/<register IRI> becomes the Person facet; a local actor keeps the hash.
  let local = null;
  if (netz && options.actor) {
    const reg = regOf(options.actor);
    if (reg && H.persons?.[reg]) {
      if (filters.persons[0] !== reg) filters.set({ persons: [reg, ...filters.persons.filter((x) => x !== reg)] });
      writeAddress({}, "#/");
    } else if (inGraph.has(options.actor)) local = options.actor;
  }
  const skip = new Set(["text"]);
  const layer = netz ? "aussagen" : undefined;
  // The Person facet of the network offers the register persons of the run's graph.
  const persons = Object.entries(H.persons ?? {})
    .filter(([id]) => !netz || inGraph.has(`${ACTOR}${id}`))
    .map(([id, p]) => [id, p.l, p.r.length])
    .sort((a, b) => b[2] - a[2]);
  const centreOf = () => local ?? (filters.persons[0] && inGraph.has(`${ACTOR}${filters.persons[0]}`) ? `${ACTOR}${filters.persons[0]}` : null);

  // The main element of the representation.
  let figure;
  let pendingClaim = null;
  if (netz) {
    figure = renderOverview(store, {
      actor: centreOf(),
      filters,
      regestOn: (u) => {
        const row = selection.byUid.get(u);
        return !!row && selection.passes(row, { skip: new Set(["text", "person"]), layer });
      },
      onSelect: (id) => choose(id),
      onOpen: (u, claim) => {
        pendingClaim = claim;
        detail.open(u);
      },
    });
  } else {
    figure = renderTimeband(store, {
      filters,
      mentionOn: (u) => {
        const row = selection.byUid.get(u);
        return !!row && selection.passes(row, { skip });
      },
      onPerson: (id) => filters.set({ persons: filters.persons[0] === id ? [] : [id] }),
      onOpen: (u) => detail.open(u),
    });
  }

  /** A person chosen in the network: a register person through the facet, another by hash. */
  function choose(id) {
    const reg = regOf(id);
    if (!id) {
      local = null;
      writeAddress({}, "#/");
      filters.set({ persons: [] });
    } else if (reg && H.persons?.[reg]) {
      local = null;
      writeAddress({}, "#/");
      filters.set({ persons: [reg] });
    } else {
      local = id;
      writeAddress({}, `#/personen/${encodeURIComponent(id)}`);
      sync();
    }
  }

  // The switch of the representations, at the place of the Atlas's switch.
  const switchLinks = [
    ["netz", t("persons.mode.netz"), "#/"],
    ["zeitband", t("persons.mode.zeitband"), "#/zeitband"],
  ].map(([key, label, href]) => h("a", { class: "seg", href, "aria-current": key === view ? "page" : null }, label));
  const pageLink = h("a", { class: "tool person-page", hidden: true }, t("persons.page"));
  const infoPanel = h("div", { class: "atlas-info", id: "persons-info", role: "note", hidden: true });
  const sign = (d) => s("svg", { viewBox: "0 0 16 16", class: "head-icon", "aria-hidden": "true" }, s("path", { d }));
  const infoButton = h("button", { type: "button", class: "tool atlas-info-mark", "aria-label": t("info.button"), title: t("info.button"), "aria-expanded": "false", "aria-controls": "persons-info" }, sign("M8 7.2v4.6M8 4.4v.4"));
  infoButton.addEventListener("click", () => {
    const on = infoPanel.hidden;
    infoPanel.hidden = !on;
    infoButton.setAttribute("aria-expanded", String(on));
    if (on)
      infoPanel.replaceChildren(
        ...(netz
          ? [
              h("p", { text: t("persons.info.circle") }),
              h("p", { text: t("persons.info.overview") }),
            ]
          : figure.key()),
      );
  });

  const facets = createFacets(store, filters, {
    prefix: "pers",
    applies: netz ? { layer: t("persons.layerOff"), text: TEXT_OFF } : { text: TEXT_OFF },
    layer,
    persons,
    marks: () => (filters.any() ? new Set(shown.map((r) => r.year)) : new Set()),
  });
  const count = createCount(filters, { onReset: () => (local = null) });
  const list = createList({
    label: t("list.label"),
    onOpen: (u) => detail.open(u),
    mark: (r) => (filters.persons.length ? selection.personMark(r.u) : r.stmt ? "is-evidenced" : ""),
  });
  const frame = createFrame(filters, {
    name: "personen",
    title: netz ? t("persons.title.netz") : t("persons.title.zeitband"),
    facets: facets.element,
    count: count.element,
    list: list.element,
    tools: [h("div", { class: "segs", role: "group", "aria-label": t("persons.modes") }, switchLinks), netz ? pageLink : figure.controls],
    toolsEnd: [infoButton, infoPanel],
    main: h("div", { class: "persons-figure" }, figure.element),
    backLabel: netz ? t("persons.back.netz") : t("persons.back.zeitband"),
    backShort: netz ? t("persons.backShort.netz") : t("persons.backShort.zeitband"),
    onEscape: () => detail.close(),
  });
  const detail = createDetail(frame, {
    list,
    card: (u) => {
      const claim = pendingClaim;
      pendingClaim = null;
      return renderRegestCard(store, u, { claim, texts: options.texts, onClose: () => detail.close() });
    },
    onShut: () => (netz ? figure.unpin() : figure.unmark()),
  });

  let shown = [];
  function sync() {
    shown = selection.filter({ skip, layer });
    facets.update();
    count.update(shown.length, selection.rows.length);
    frame.updateSheet(shown.length);
    // The list stands in the Zeitband while a person is chosen: her regesta, which the drawing
    // shows as ticks without keyboard access. The Netz leads to its regesta through the acts of
    // the circle, by pointer and by the arrow keys; elsewhere the count line says the number
    // (density check of the work profile, 2026-11-18).
    const narrowed = !netz && filters.persons.length > 0;
    list.element.hidden = !narrowed;
    list.update(narrowed ? shown : []);
    list.setOpened(detail.opened());
    if (netz) {
      const centre = centreOf();
      figure.setActor(centre);
      figure.draw();
      const page = centre && options.personPage?.(centre);
      pageLink.hidden = !page;
      if (page) pageLink.href = page;
    }
  }
  const unsubscribe = filters.onChange(sync);
  sync();

  return {
    element: frame.root,
    full: true,
    focus: netz && centreOf() ? () => requestAnimationFrame(() => figure.focus()) : null,
    dispose() {
      unsubscribe();
      frame.dispose();
      list.dispose();
      detail.dispose();
      figure.dispose();
    },
  };
}
