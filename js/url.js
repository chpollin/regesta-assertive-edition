/**
 * The address as the state of a view: filters and settings in the query string, route and
 * subject in the hash. Every change replaces the history entry, so the back button leaves
 * the view instead of stepping through its settings.
 *
 * Used by the views app (ansicht/js/) and by the static pages (js/edition/); build_site.py
 * copies this file next to both.
 */

/** One parameter of the query string, or null. */
export function param(name) {
  return new URLSearchParams(location.search).get(name);
}

/**
 * Write parameters and optionally a new hash. A null, undefined or empty value removes its
 * parameter; the others are set after the remaining ones, in the order given.
 * @param {Record<string, string|number|null|undefined>} params
 * @param {string} [hash]  the new hash with its #, by default the current one
 */
export function writeAddress(params, hash = location.hash) {
  const q = new URLSearchParams(location.search);
  for (const k of Object.keys(params)) q.delete(k);
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== "") q.set(k, String(v));
  const query = q.toString();
  history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}${hash}`);
}

/** The parameters of the filter model (js/filters.js), carried from view to view. */
const FILTER_KEYS = ["von", "bis", "ort", "person", "art", "schicht", "q"];

/**
 * Keep the chosen filters when the reader changes the view: a click on a link of the header
 * navigation or of a view switch carries the filter parameters of the current address into the
 * target, unless the target names its own. Without JavaScript the links lead to the views at rest.
 */
export function carryFilters() {
  document.addEventListener(
    "click",
    (event) => {
      const link = event.target instanceof Element ? event.target.closest(".site-nav a, a.seg, .view-switch a") : null;
      // The start page takes no facets: it would forward them to the Atlas (js/edition/start.js).
      if (!link || link.dataset.nav === "start" || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
      const here = new URLSearchParams(location.search);
      const url = new URL(link.getAttribute("href"), location.href);
      if (url.origin !== location.origin || FILTER_KEYS.some((k) => url.searchParams.has(k))) return;
      let changed = false;
      for (const k of FILTER_KEYS) {
        if (here.has(k)) {
          url.searchParams.set(k, here.get(k));
          changed = true;
        }
      }
      if (!changed) return;
      event.preventDefault();
      location.assign(url.href);
    },
    true,
  );
}
