/**
 * Entry point of the views app: loads the prebuilt JSON once, builds the header navigation and
 * routes between the views. Every view owns its frame (filter bar, main element, opened regest;
 * js/filterbar.js), after the interface plan of 2026-11-17 (knowledge/interface-plan.md).
 *
 * Routes (hash based, so every view is addressable and the browser history works):
 *   #/                         Personen, Netz: the persons overview or the circle around the
 *                              person of the Person facet
 *   #/personen/<iri>           the circle around an actor named only in one regest's wording;
 *                              a register person's address becomes the Person facet
 *   #/zeitband                 Personen, Zeitband; #/zeitband/<register id> becomes the facet
 *   #/atlas[/<repr.>][/regest/<uid>]  the Atlas (js/atlas.js); in the curated build it lives on
 *                              the start page, and this address forwards there
 *   #/itinerar[/<place>], #/jahrzehnte[/<place>]  the former place views, forwarded to the Atlas
 *   #/regesten[/regest/<uid>]  the list of the whole delivery (js/regesten.js); in the curated
 *                              build it lives on regesten/, and this address forwards there
 *   #/raum[/<iri>]             the former view Raum, removed on 2026-11-17; forwarded to the Netz
 *   #/regest/<uid>[/<claim>]   the regest card at page size (the citable page is regesten/<slug>/)
 * Filters live in the query string (js/filters.js) and survive switching between the views.
 */
import { h } from "./dom.js";
import { createFilters } from "./filters.js";
import { renderRegestCard } from "./regest-card.js";
import { atlasAddress, renderAtlas } from "./atlas.js";
import { renderRegesten } from "./regesten.js";
import { renderPersons } from "./persons.js";
import { carryFilters, writeAddress } from "./url.js";

/** @typedef {{edition: any, holdings: any, byUid: Map<string, any>}} Store */

const main = /** @type {HTMLElement} */ (document.getElementById("main"));
const nav = /** @type {HTMLElement} */ (document.getElementById("site-nav"));

/** Regest texts of the whole delivery, loaded once on first need. */
let textsPromise = null;
const texts = () => (textsPromise ??= loadJson("data/holdings-texts.json").catch(() => ({})));

async function loadJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

/**
 * The navigation of the whole edition from js/nav.json: one link per object. Inside the curated
 * build this app lives under ansicht/, so static pages are one level up and views are local hash
 * routes. In the repository the static pages do not exist; an item with an address inside this
 * app (`app`) keeps it there.
 */
const inBuild = location.pathname.includes("/ansicht/");
const VIEW_PREFIX = "ansicht/";
const hrefOf = (href) => (href.startsWith(VIEW_PREFIX) ? href.slice(VIEW_PREFIX.length) : `../${href}`);
const reachable = (href) => inBuild || href.startsWith(VIEW_PREFIX);
function buildNav(items) {
  const link = (it) => (inBuild || !it.app ? hrefOf(it.href) : it.app);
  nav.replaceChildren(...items.filter((it) => reachable(it.href) || it.app).map((it) => h("a", { href: link(it), "data-nav": it.key }, it.label)));
}

/** The address of a person page of the curated build, by the rule of build_site.person_slug. */
function personPage(iri) {
  if (!inBuild) return null;
  const slug = iri
    .replace(/^urn:regesta:actor:/, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `../personen/${slug}/`;
}

let dispose = null;
/** The last view address, so the regest card at page size can lead back with the filters kept. */
let lastView = "#/";

/** The rest of the address as one decoded id, or null when it is malformed. */
function idOf(rest) {
  try {
    return rest.length ? decodeURIComponent(rest.join("/")) : null;
  } catch {
    return null;
  }
}

/**
 * The routes: `render` turns the rest of the address into a view; `forward` rewrites a former
 * or a build-only address and returns true when the page leaves. Every view is a function
 * render(store, options) that returns {element, full, dispose?, focus?}.
 */
const ROUTES = {
  "": { nav: "personen", title: "Personen, Netz", render: (store, rest, ctx) => renderPersons(store, { view: "netz", actor: null, personPage, ...ctx }) },
  personen: { nav: "personen", title: "Personen, Netz", render: (store, rest, ctx) => renderPersons(store, { view: "netz", actor: idOf(rest), personPage, ...ctx }) },
  zeitband: {
    nav: "personen",
    title: "Personen, Zeitband",
    render: (store, rest, ctx) => {
      // #/zeitband/<register id> of earlier links becomes the Person facet.
      const id = idOf(rest);
      if (id && store.holdings.persons?.[id]) ctx.filters.set({ persons: [id] });
      if (rest.length) writeAddress({}, "#/zeitband");
      return renderPersons(store, { view: "zeitband", personPage, ...ctx });
    },
  },
  atlas: { nav: "atlas", title: "Atlas", forward: (rest) => inBuild && forwardToAtlas("atlas", rest), render: (store, rest, ctx) => renderAtlas(store, { filters: ctx.filters, texts: ctx.texts, about: null }) },
  itinerar: { nav: "atlas", title: "Atlas", forward: (rest) => forwardToAtlas("itinerar", rest) },
  jahrzehnte: { nav: "atlas", title: "Atlas", forward: (rest) => forwardToAtlas("jahrzehnte", rest) },
  regesten: {
    nav: "regesten",
    title: "Regesten",
    forward: () => {
      if (!inBuild) return false;
      location.replace(`../regesten/${location.search}${location.hash}`);
      return true;
    },
    render: (store, rest, ctx) => renderRegesten(store, { filters: ctx.filters, texts: ctx.texts }),
  },
  // The view Raum was removed on the operator's decision of 2026-11-17; its addresses lead to
  // the circle around the same actor in the Netz, or to the persons overview.
  raum: {
    nav: "personen",
    title: "Personen, Netz",
    forward: (rest) => {
      const id = idOf(rest);
      const q = new URLSearchParams(location.search);
      for (const k of ["ansicht", "mindestens"]) q.delete(k);
      const query = q.toString();
      location.replace(`${location.pathname}${query ? `?${query}` : ""}${id ? `#/personen/${encodeURIComponent(id)}` : "#/"}`);
      return true;
    },
  },
};

/**
 * Forward a former place address (#/itinerar[/<place>], #/jahrzehnte[/<place>]) to the Atlas,
 * replacing the history entry: in the curated build to the Atlas page atlas/ (the start page
 * until 2026-11-18), in the repository to #/atlas of this app. The Atlas address in the build forwards the same way.
 */
function forwardToAtlas(view, rest) {
  const target = atlasAddress(view, idOf(rest), location.search);
  // In the build the Atlas address of this app keeps its own representation and regest.
  const hash = view === "atlas" ? location.hash : target.hash;
  location.replace(`${inBuild ? "../atlas/" : location.pathname}${target.search}${hash}`);
  return true;
}

/** The regest card at page size, with a way back to the view. */
function regestPage(store, regest, claim) {
  return {
    element: h(
      "div",
      { class: "regest-page" },
      h("p", { class: "back-link" }, h("a", { href: lastView }, "Zurück zur Ansicht")),
      h("h1", { class: "visually-hidden", text: regest.identifier }),
      renderRegestCard(store, regest.uid, { claim, texts, page: true }),
    ),
  };
}

/** @param {Store} store @param {ReturnType<typeof createFilters>} filters */
function route(store, filters) {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const view = parts[0] ?? "";
  const entry = Object.hasOwn(ROUTES, view) ? ROUTES[view] : null;
  if (entry?.forward && store.holdings && entry.forward(parts.slice(1))) return;
  // Atlas and Regesten follow their own representation and opened regest in the hash.
  if ((view === "atlas" || view === "regesten") && main.dataset.view === view) return;
  let content;
  let navKey = "";
  let title = "Barbarossa-Regesten";
  if (view === "regest" && store.byUid.has(parts[1])) {
    const regest = store.byUid.get(parts[1]);
    content = regestPage(store, regest, parts[2] ?? null);
    title = regest.identifier;
  } else if (entry?.render && store.holdings) {
    content = entry.render(store, parts.slice(1), { filters, texts });
    ({ nav: navKey, title } = entry);
  } else {
    content = { element: h("p", { text: "Diese Adresse führt zu keiner Ansicht. Die Navigation oben führt zu Atlas, Regesten und Personen." }) };
  }
  if (navKey) lastView = `${location.search}${location.hash}`;
  document.title = `${title} | Barbarossa-Regesten`;
  for (const link of nav.querySelectorAll("[data-nav]")) {
    if (link.getAttribute("data-nav") === navKey) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  dispose?.();
  dispose = content.dispose ?? null;
  const previousView = main.dataset.view;
  main.dataset.view = view === "regest" ? `regest/${parts[1] ?? ""}` : view === "personen" ? "" : view;
  document.body.dataset.layout = content.full ? "full" : "page";
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
    // The whole-delivery layer carries every view; without it the views say so.
    const [edition, navData, holdings] = await Promise.all([loadJson("data/edition.json"), loadJson("js/nav.json"), loadJson("data/holdings.json").catch(() => null)]);
    buildNav(navData.items);
    /** @type {Store} */
    const store = { edition, holdings, byUid: new Map(edition.regests.map((r) => [r.uid, r])) };
    const filters = createFilters(store);
    carryFilters();
    window.addEventListener("hashchange", () => route(store, filters));
    route(store, filters);
  } catch (error) {
    main.replaceChildren(h("p", { class: "error", text: `Die Daten konnten nicht geladen werden (${error.message}).` }));
  }
}

start();
