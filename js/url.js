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
