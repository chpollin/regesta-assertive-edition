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
 *   #/raum[/<iri>]             space view, corpus or around one person
 *   #/regest/<uid>[/<claim>]   reading view, optionally with one statement selected
 * Filters (time range, families) and view settings live in the query string and survive
 * switching between the views.
 */
import { h } from "./dom.js";
import { createFilters } from "./filters.js";
import { renderOverview } from "./overview.js";
import { renderReading } from "./reading.js";
import { renderSpace } from "./space.js";
import { renderItinerary } from "./itinerary.js";

/** @typedef {{edition: any, holdings: any, byUid: Map<string, any>}} Store */

const main = /** @type {HTMLElement} */ (document.getElementById("main"));
const aside = /** @type {HTMLElement} */ (document.getElementById("aside"));
const nav = /** @type {HTMLElement} */ (document.getElementById("site-nav"));

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

/**
 * The navigation of the whole edition from js/nav.json. Inside the curated build this app
 * lives under ansicht/, so static pages are one level up; the two interactive views are
 * local hash routes. In the repository the static pages do not exist and their links are
 * left out, so no link leads nowhere.
 */
function buildNav(items) {
  const inBuild = location.pathname.includes("/ansicht/");
  const local = { "zeit-netz": "#/", itinerar: "#/itinerar", raum: "#/raum" };
  nav.replaceChildren(
    ...items
      .filter((it) => inBuild || it.key in local)
      .map((it) => h("a", { href: it.key in local ? local[it.key] : `../${it.href}`, "data-nav": it.key }, it.label)),
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
    const regest = store.byUid.get(parts[1]);
    content = renderReading(store, regest, parts[2] ?? null);
    content.element.prepend(h("p", { class: "back-link" }, h("a", { href: lastView }, "Zurück zur Ansicht")));
    title = regest.identifier;
    navKey = "";
  } else if (view === "" || view === "personen") {
    content = renderOverview(store, { actor: view === "personen" ? actorOf(parts.slice(1)) : null, filters });
  } else if (view === "itinerar" && store.holdings) {
    const place = decodeURIComponent(parts.slice(1).join("/"));
    content = renderItinerary(store, { place: store.holdings.places[place] ? place : null, filters });
    navKey = "itinerar";
    title = "Itinerar";
  } else if (view === "raum") {
    content = renderSpace(store, { actor: actorOf(parts.slice(1)), filters });
    navKey = "raum";
    title = "Raum";
  } else {
    content = { element: h("p", { text: "Diese Adresse führt zu keiner Ansicht. Die Navigation oben führt zu Zeit und Netz und zum Raum." }) };
  }
  if (navKey) lastView = `${location.search}${location.hash}`;
  document.title = `${title} | Barbarossa-Regesten mit belegten Aussagen`;
  for (const link of nav.querySelectorAll("[data-nav]")) {
    if (link.getAttribute("data-nav") === navKey) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  dispose?.();
  dispose = content.dispose ?? null;
  const previousView = main.dataset.view;
  main.dataset.view = view === "personen" ? "" : view === "raum" ? "raum" : `${view}/${parts[1] ?? ""}`;
  document.body.dataset.layout = content.aside ? "view" : "page";
  main.replaceChildren(content.element);
  aside.replaceChildren(...(content.aside ? [content.aside] : []));
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
