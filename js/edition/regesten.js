/**
 * Regest list page: the list of the whole delivery (ansicht/js/regesten.js) with the shared
 * filter bar replaces the static table of the run's regesta, which stays as the page without
 * JavaScript. An address of the former list (?q=, ?art=) keeps its meaning.
 */
import { bridge, demoteHeadings, loadRoutes, loadStore, siteUrl } from "./views.js";

export async function init(root) {
  const host = document.getElementById("list");
  const [store, routes] = await Promise.all([loadStore(root), loadRoutes(root)]);
  bridge(root, routes);
  if (!store.holdings || !host) return;
  const [{ createFilters }, { renderRegesten }] = await Promise.all([import(siteUrl(root, "ansicht/js/filters.js")), import(siteUrl(root, "ansicht/js/regesten.js"))]);
  let textsPromise = null;
  const texts = () =>
    (textsPromise ??= fetch(siteUrl(root, "ansicht/data/holdings-texts.json"))
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({})));
  const view = renderRegesten(store, { filters: createFilters(store), texts });
  host.replaceChildren(view.element);
  host.classList.add("is-view");
  document.body.dataset.view = "regesten";
  demoteHeadings(host);
}
