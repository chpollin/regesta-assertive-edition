/**
 * Start page: the Atlas (ansicht/js/atlas.js), start and places in one after the interface
 * plan of 2026-11-17. This module only gives the Atlas its place in the page and keeps the
 * jump by RI number in the header; the Atlas owns its filter bar, graphic and detail.
 *
 * Earlier addresses of the start page keep working: #/itinerar/<place> (the place view's hash
 * on the start page until 2026-11-17) and ?ansicht= become the Atlas address.
 */
import { bridge, demoteHeadings, loadRoutes, loadStore, siteUrl } from "./views.js";

export async function init(root) {
  const host = document.getElementById("figure");
  // Rewrite an old address before anything reads it.
  const old = location.hash.match(/^#\/(itinerar|jahrzehnte)(?:\/(.+))?$/);
  if (old || !location.hash.startsWith("#/atlas")) {
    const { atlasAddress } = await import(siteUrl(root, "ansicht/js/atlas.js"));
    let place = null;
    try {
      place = old?.[2] ? decodeURIComponent(old[2]) : null;
    } catch {
      // A malformed place opens the Atlas on all places.
    }
    const target = atlasAddress(old?.[1] ?? "itinerar", place, location.search);
    history.replaceState(null, "", `${location.pathname}${target.search}${target.hash}`);
  }
  const [store, routes] = await Promise.all([loadStore(root), loadRoutes(root)]);
  bridge(root, routes);
  if (!store.holdings || !host) {
    initJump(root, store, routes, null);
    return;
  }
  const [{ createFilters }, { renderAtlas }] = await Promise.all([import(siteUrl(root, "ansicht/js/filters.js")), import(siteUrl(root, "ansicht/js/atlas.js"))]);
  let textsPromise = null;
  const texts = () =>
    (textsPromise ??= fetch(siteUrl(root, "ansicht/data/holdings-texts.json"))
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({})));
  const atlas = renderAtlas(store, { filters: createFilters(store), texts, about: siteUrl(root, "ueber/#daten") });
  host.replaceChildren(atlas.element);
  host.classList.add("is-atlas");
  demoteHeadings(host);
  initJump(root, store, routes, atlas);
}

/** Normalised RI number: "n. 103a", "103A" and "RI IV,2,2 n. 103a" all give "103a". */
function number(text) {
  const match = String(text).toLowerCase().match(/(?:n\.\s*)?([0-9]+[a-z]?)\s*$/);
  return match ? match[1] : "";
}

/**
 * The jump by RI number: a regest of the delivery with a place of issue opens in the Atlas,
 * another regest of the run opens its page.
 */
function initJump(root, store, routes, atlas) {
  const form = document.getElementById("jump");
  if (!form) return;
  const message = form.querySelector(".jump-msg");
  form.hidden = false;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const wanted = number(form.elements.n.value);
    const placed = store.holdings?.regesta.find((r) => r.p && store.holdings.places[r.p] && number(r.i) === wanted);
    const regest = store.edition.regests.find((r) => number(r.identifier) === wanted);
    message.textContent = "";
    if (placed && atlas) atlas.open(placed.u);
    else if (regest && routes.regests[regest.uid]) location.assign(siteUrl(root, routes.regests[regest.uid]));
    else message.textContent = wanted ? `n. ${wanted} nicht gefunden` : "Nummer eingeben";
  });
}
