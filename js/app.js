/**
 * Entry point: loads the prebuilt JSON once, builds the shell and routes between the views.
 *
 * The shell is the same for every view (header with the edition's navigation, drawing area,
 * one sidebar), after the operator's feedback of 2026-11-11 in knowledge/ui-feedback.md.
 *
 * Routes (hash based, so every view is addressable and the browser history works):
 *   #/                         flat network (Zeit und Netz), whole network
 *   #/personen/<iri>           the same around one person
 *   #/itinerar[/<place>]       the whole delivery as a cube of the places of issue
 *   #/zeitband[/<register id>] persons of the register as rows over the years
 *   #/jahrzehnte[/<place>]     the same map once per decade, side by side
 *   #/raum[/<iri>]             space view, corpus or around one person
 *   #/regest/<uid>[/<claim>]   reading view, optionally with one statement selected
 * Filters (time range, families) and view settings live in the query string and survive
 * switching between the views.
 */
import { h } from "./dom.js";
import { createFilters } from "./filters.js";
import { renderOverview } from "./overview.js";
import { renderRegestCard } from "./regest-card.js";
import { renderSpace } from "./space.js";
import { renderItinerary } from "./itinerary.js";
import { renderTimeband } from "./timeband.js";
import { renderDecades } from "./decades.js";

/** @typedef {{edition: any, holdings: any, byUid: Map<string, any>}} Store */

const main = /** @type {HTMLElement} */ (document.getElementById("main"));
const aside = /** @type {HTMLElement} */ (document.getElementById("aside"));
const detailPanel = /** @type {HTMLElement} */ (document.getElementById("detail"));

/**
 * The detail on demand (Shneiderman): a narrow panel on the right that exists only while
 * something is selected. Views open it with a regest card and close it on deselection.
 */
const detail = {
  show(element) {
    detailPanel.replaceChildren(element);
    detailPanel.hidden = false;
    document.body.dataset.detail = "open";
  },
  hide() {
    detailPanel.replaceChildren();
    detailPanel.hidden = true;
    delete document.body.dataset.detail;
  },
};

/** Regest texts of the whole delivery, loaded once on first need. */
let textsPromise = null;
const texts = () => (textsPromise ??= loadJson("data/holdings-texts.json").catch(() => ({})));
const nav = /** @type {HTMLElement} */ (document.getElementById("site-nav"));

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

/**
 * The navigation of the whole edition from js/nav.json: one link per object (Regesten,
 * Personen, Orte, ...), and inside a view the switch between the representations of its
 * object (operator's rule 39 of 2026-11-14). Inside the curated build this app lives under
 * ansicht/, so static pages are one level up and views are local hash routes. In the
 * repository the static pages do not exist and their links are left out.
 */
const inBuild = location.pathname.includes("/ansicht/");
const VIEW_PREFIX = "ansicht/";
const hrefOf = (href) => (href.startsWith(VIEW_PREFIX) ? href.slice(VIEW_PREFIX.length) : `../${href}`);
const reachable = (href) => inBuild || href.startsWith(VIEW_PREFIX);
let navItems = [];
function buildNav(items) {
  navItems = items;
  nav.replaceChildren(...items.filter((it) => reachable(it.href)).map((it) => h("a", { href: hrefOf(it.href), "data-nav": it.key }, it.label)));
}

/** The object a view belongs to, and the switch between its representations. */
function objectOf(viewKey) {
  return navItems.find((it) => (it.views ?? []).some((v) => v.key === viewKey)) ?? null;
}
function viewSwitch(viewKey) {
  const object = objectOf(viewKey);
  if (!object) return null;
  return h(
    "nav",
    { class: "view-switch", "aria-label": `Darstellung der ${object.label}` },
    object.views.filter((v) => reachable(v.href)).map((v) => h("a", { href: hrefOf(v.href), "aria-current": v.key === viewKey ? "page" : null }, v.label)),
  );
}

let dispose = null;
/** The last view address, so the reading view can lead back with person and filters kept. */
let lastView = "#/";

/** @param {Store} store @param {ReturnType<typeof createFilters>} filters */
function route(store, filters) {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const view = parts[0] ?? "";
  const actorOf = (rest, allowActs = false) => {
    const id = decodeURIComponent(rest.join("/"));
    return store.edition.graph.nodes.some((n) => n.id === id && (allowActs || n.kind !== "act")) ? id : null;
  };
  let content;
  let navKey = "zeit-netz";
  let title = "Zeit und Netz";
  if (view === "regest" && store.byUid.has(parts[1])) {
    // The citable page of a regest shows the same component as the detail panel.
    const regest = store.byUid.get(parts[1]);
    content = { element: h("div", { class: "regest-page" }, h("p", { class: "back-link" }, h("a", { href: lastView }, "Zurück zur Ansicht")), h("h1", { class: "visually-hidden", text: regest.identifier }), renderRegestCard(store, regest.uid, { claim: parts[2] ?? null, texts, page: true })) };
    title = regest.identifier;
    navKey = "";
  } else if (view === "" || view === "personen") {
    content = renderOverview(store, { actor: view === "personen" ? actorOf(parts.slice(1)) : null, filters, detail, texts });
  } else if (view === "itinerar" && store.holdings) {
    const place = decodeURIComponent(parts.slice(1).join("/"));
    content = renderItinerary(store, { place: store.holdings.places[place] ? place : null, filters, detail, texts });
    navKey = "itinerar";
    title = "Itinerar";
  } else if (view === "zeitband" && store.holdings) {
    const person = decodeURIComponent(parts.slice(1).join("/"));
    content = renderTimeband(store, { person: store.holdings.persons[person] ? person : null, filters, detail, texts });
    navKey = "zeitband";
    title = "Zeitband";
  } else if (view === "jahrzehnte" && store.holdings) {
    const place = decodeURIComponent(parts.slice(1).join("/"));
    content = renderDecades(store, { place: store.holdings.places[place] ? place : null, filters, detail, texts });
    navKey = "jahrzehnte";
    title = "Jahrzehnte";
  } else if (view === "raum") {
    content = renderSpace(store, { actor: actorOf(parts.slice(1)), filters, detail, texts });
    navKey = "raum";
    title = "Raum";
  } else {
    content = { element: h("p", { text: "Diese Adresse führt zu keiner Ansicht. Die Navigation oben führt zu Zeit und Netz und zum Raum." }) };
  }
  if (navKey) lastView = `${location.search}${location.hash}`;
  document.title = `${title} | Barbarossa-Regesten`;
  const objectKey = objectOf(navKey)?.key ?? navKey;
  for (const link of nav.querySelectorAll("[data-nav]")) {
    if (link.getAttribute("data-nav") === objectKey) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  dispose?.();
  detail.hide();
  dispose = content.dispose ?? null;
  const previousView = main.dataset.view;
  main.dataset.view = view === "personen" ? "" : view === "raum" ? "raum" : `${view}/${parts[1] ?? ""}`;
  document.body.dataset.layout = content.aside ? "view" : "page";
  main.replaceChildren(content.element);
  const switcher = content.aside ? viewSwitch(navKey) : null;
  aside.replaceChildren(...[switcher, content.aside].filter(Boolean));
  aside.hidden = !content.aside;
  // Move focus only when the view itself changed; a selection inside a view keeps it.
  if (previousView !== main.dataset.view) {
    if (content.focus) content.focus();
    else {
      const heading = main.querySelector("h1");
      if (heading) {
        heading.setAttribute("tabindex", "-1");
        heading.focus({ preventScroll: true });
      }
      window.scrollTo(0, 0);
    }
  } else if (content.focus) content.focus();
}

async function start() {
  try {
    // The whole-holdings layer is optional, so the views of the run work without it.
    const [edition, navData, holdings] = await Promise.all([loadJson("data/edition.json"), loadJson("js/nav.json"), loadJson("data/holdings.json").catch(() => null)]);
    buildNav(navData.items);
    /** @type {Store} */
    const store = { edition, holdings, byUid: new Map(edition.regests.map((r) => [r.uid, r])) };
    const filters = createFilters(store);
    window.addEventListener("hashchange", () => route(store, filters));
    route(store, filters);
  } catch (error) {
    main.replaceChildren(h("p", { class: "error", text: `Die Daten konnten nicht geladen werden (${error.message}).` }));
  }
}

start();
