/**
 * Start page: the entry to the whole edition since 2026-11-18. Until then the start page was
 * the Atlas, so published links to it carry Atlas addresses: #/atlas[...], #/itinerar/<place>,
 * #/jahrzehnte and the facets or old settings in the query string. Such an address goes on to
 * atlas/ unchanged, where js/edition/atlas.js reads it; the plain start page stays.
 */
const ATLAS_HASH = /^#\/(atlas|itinerar|jahrzehnte)(\/|$)/;
const ATLAS_QUERY = ["von", "bis", "ort", "person", "personen", "art", "familien", "schicht", "ansicht", "jahrzehnt"];

export function init(root) {
  const query = new URLSearchParams(location.search);
  if (ATLAS_HASH.test(location.hash) || ATLAS_QUERY.some((k) => query.has(k))) {
    location.replace(`${root}atlas/${location.search}${location.hash}`);
  }
}
