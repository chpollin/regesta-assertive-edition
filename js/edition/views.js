/**
 * Embedding of the interactive views (ansicht/) in static pages.
 *
 * The views address their targets as hash routes of the single-page app (#/regest/<uid>,
 * #/personen/<iri>, #/raum). On a static page these routes are mapped to the static pages,
 * using data/routes.json written by build_site.py. A regest link carries the current address
 * as `zurueck`, so the regest page can lead back to the view with its state.
 */

/** Absolute URL of a path given relative to the site root. */
export function siteUrl(root, path) {
  return new URL(`${root}${path}`, document.baseURI).href;
}

/** The store the views expect: edition, whole-holdings layer and regests by UID, as in js/app.js. */
export async function loadStore(root) {
  const response = await fetch(siteUrl(root, "ansicht/data/edition.json"));
  if (!response.ok) throw new Error(`edition.json: HTTP ${response.status}`);
  const edition = await response.json();
  // The whole-holdings layer is optional, as in js/app.js; only the itinerary needs it.
  const holdings = await fetch(siteUrl(root, "ansicht/data/holdings.json"))
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  return { edition, holdings, byUid: new Map(edition.regests.map((r) => [r.uid, r])) };
}

export async function loadRoutes(root) {
  const response = await fetch(siteUrl(root, "data/routes.json"));
  if (!response.ok) throw new Error(`routes.json: HTTP ${response.status}`);
  return response.json();
}

/**
 * Map hash routes of the views to static pages: links by a capturing click handler, routes
 * set by script (location.hash = ...) by replacing the history entry.
 */
export function bridge(root, routes) {
  const toUrl = (hash) => {
    const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    if (parts[0] === "regest" && routes.regests[parts[1]]) {
      const back = encodeURIComponent(location.href);
      return siteUrl(root, `${routes.regests[parts[1]]}?zurueck=${back}${parts[2] ? `#f-${parts[2]}` : ""}`);
    }
    if (parts[0] === "personen") {
      const iri = decodeURIComponent(parts.slice(1).join("/"));
      return siteUrl(root, routes.persons[iri] ?? "personen/");
    }
    if (parts[0] === "raum" || parts.length === 0) return siteUrl(root, `ansicht/${hash || "#/"}`);
    return null;
  };
  document.addEventListener(
    "click",
    (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href^='#/']") : null;
      const url = link && toUrl(link.getAttribute("href"));
      if (url) {
        event.preventDefault();
        location.assign(url);
      }
    },
    true,
  );
  window.addEventListener("hashchange", () => {
    if (!location.hash.startsWith("#/")) return;
    const url = toUrl(location.hash);
    if (url) location.replace(url);
  });
}

/**
 * The views bring their own visually hidden h1; inside a page that has its title already,
 * it becomes an h2, so each page keeps one h1.
 */
export function demoteHeadings(element) {
  for (const h1 of element.querySelectorAll("h1")) {
    const h2 = document.createElement("h2");
    for (const attr of h1.attributes) h2.setAttribute(attr.name, attr.value);
    h2.append(...h1.childNodes);
    h1.replaceWith(h2);
  }
}

const MODULES = {
  itinerary: { file: "ansicht/js/itinerary.js", render: "renderItinerary" },
  space: { file: "ansicht/js/space.js", render: "renderSpace" },
  overview: { file: "ansicht/js/overview.js", render: "renderOverview" },
};

/**
 * Render one view of the app ("itinerary", "space" or "overview") into a host: drawing area and its
 * sidebar side by side, as the shell places them. The views take the shared filter state
 * of ansicht/js/filters.js and return {element, aside, dispose}. The subject is the person
 * (overview, space) or the place of issue (itinerary) the view opens on, or null.
 */
export async function mountView(root, host, store, kind, subject) {
  const [{ createFilters }, module] = await Promise.all([
    import(siteUrl(root, "ansicht/js/filters.js")),
    import(siteUrl(root, MODULES[kind].file)),
  ]);
  const filters = createFilters(store);
  const view = module[MODULES[kind].render](store, kind === "itinerary" ? { place: subject, filters } : { actor: subject, filters });
  const drawing = document.createElement("div");
  drawing.className = "embed-main";
  drawing.append(view.element);
  const parts = [drawing];
  if (view.aside) {
    const aside = document.createElement("aside");
    aside.className = "embed-aside site-aside";
    aside.setAttribute("aria-label", "Auswahl und Vorgänge");
    aside.append(view.aside);
    parts.push(aside);
  }
  host.classList.add("embed");
  host.replaceChildren(...parts);
  demoteHeadings(host);
  return view;
}

/** A graph node of kind person or group with this IRI, or null. */
export function actorOf(store, iri) {
  return store.edition.graph.nodes.some((n) => n.id === iri && n.kind !== "act") ? iri : null;
}
