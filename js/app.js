/**
 * Entry point: loads the prebuilt JSON once and routes between the three views.
 *
 * Routes (hash based, so every view is addressable and the browser history works):
 *   #/                         timeline and person graph of the run
 *   #/personen/<iri>           the same, with one person selected in the graph
 *   #/regest/<uid>[/<claim>]   reading view, optionally with one statement selected
 */
import { h } from "./dom.js";
import { renderOverview } from "./overview.js";
import { renderReading } from "./reading.js";

/** @typedef {{edition: any, byUid: Map<string, any>}} Store */

const main = /** @type {HTMLElement} */ (document.getElementById("main"));

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

/** @param {Store} store */
function route(store) {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const view = parts[0] ?? "";
  let content;
  let navKey = "bestand";
  let title = "Zeit und Personen";
  if (view === "regest" && store.byUid.has(parts[1])) {
    const regest = store.byUid.get(parts[1]);
    content = renderReading(store, regest, parts[2] ?? null);
    title = regest.identifier;
    navKey = "";
  } else if (view === "" || view === "personen") {
    const actor = view === "personen" ? decodeURIComponent(parts.slice(1).join("/")) : null;
    content = renderOverview(store, { actor: store.edition.graph.nodes.some((n) => n.id === actor) ? actor : null });
  } else {
    content = { element: h("p", { text: "Diese Adresse führt zu keiner Ansicht. Die Navigation oben führt zur Zeitachse und zum Personengraphen." }) };
  }
  document.title = `${title} | Barbarossa-Regesten mit belegten Aussagen`;
  for (const link of document.querySelectorAll("[data-nav]")) {
    if (link.getAttribute("data-nav") === navKey) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  const previousView = main.dataset.view;
  main.dataset.view = view === "personen" ? "" : `${view}/${parts[1] ?? ""}`;
  main.replaceChildren(content.element);
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
    const edition = await loadJson("data/edition.json");
    /** @type {Store} */
    const store = { edition, byUid: new Map(edition.regests.map((r) => [r.uid, r])) };
    window.addEventListener("hashchange", () => route(store));
    route(store);
  } catch (error) {
    main.replaceChildren(
      h("p", { class: "error", text: `Die Daten konnten nicht geladen werden (${error.message}).` }),
    );
  }
}

start();
