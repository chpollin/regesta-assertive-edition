/**
 * The Atlas page (atlas/): mounts ansicht/js/atlas.js, start and places in one after the
 * interface plan of 2026-11-17, at its own address since the start page became the entry to
 * the whole edition (2026-11-18). This module only gives the Atlas its place in the page and
 * hands it to the jump by RI number in the header; the Atlas owns its filter bar, graphic and
 * detail.
 *
 * Earlier addresses keep working: the start page forwards them here unchanged, and this module
 * rewrites #/itinerar/<place>, #/jahrzehnte and ?ansicht= into the Atlas address.
 */
import { setAtlas } from "./jump.js";
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
  if (!store.holdings || !host) return;
  const [{ createFilters }, { renderAtlas }] = await Promise.all([import(siteUrl(root, "ansicht/js/filters.js")), import(siteUrl(root, "ansicht/js/atlas.js"))]);
  let textsPromise = null;
  const texts = () =>
    (textsPromise ??= fetch(siteUrl(root, "ansicht/data/holdings-texts.json"))
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({})));
  const atlas = renderAtlas(store, { filters: createFilters(store), texts, about: siteUrl(root, "#daten") });
  host.replaceChildren(atlas.element);
  host.classList.add("is-atlas");
  demoteHeadings(host);
  setAtlas(atlas);
}
