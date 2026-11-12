/**
 * Single regest page: the shared regest card of the views app (ansicht/js/regest-card.js)
 * replaces the static reading in #card, so the citable page and the detail in every view are
 * one component. #f-<claim> in the address selects a statement. The `zurueck` parameter
 * becomes a link back to the view the reader came from, same origin only.
 */
import { bridge, loadRoutes, loadStore, siteUrl } from "./views.js";

export async function init(root) {
  backLink();
  const host = document.getElementById("card");
  if (!host) return;
  const [store, routes, { renderRegestCard }] = await Promise.all([
    loadStore(root),
    loadRoutes(root),
    import(siteUrl(root, "ansicht/js/regest-card.js")),
  ]);
  bridge(root, routes);
  const uid = host.dataset.uid;
  if (!store.byUid.has(uid)) return;
  let textsPromise = null;
  const texts = () =>
    (textsPromise ??= fetch(siteUrl(root, "ansicht/data/holdings-texts.json"))
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({})));
  const claim = location.hash.startsWith("#f-") ? decodeURIComponent(location.hash.slice(3)) : null;
  host.replaceChildren(renderRegestCard(store, uid, { claim, texts, page: true }));
}

/** Validated return address: same origin, http or https, otherwise nothing is shown. */
function backLink() {
  const raw = new URLSearchParams(location.search).get("zurueck");
  const slot = document.querySelector(".back-slot");
  if (!raw || !slot) return;
  let url;
  try {
    url = new URL(raw, location.href);
  } catch {
    return;
  }
  if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return;
  const link = document.createElement("a");
  link.href = url.href;
  link.textContent = "Zurück zur Ansicht";
  slot.append(link);
  // Paging keeps the way back.
  for (const a of document.querySelectorAll(".pager a[rel]")) {
    const next = new URL(a.getAttribute("href"), location.href);
    next.searchParams.set("zurueck", url.href);
    a.href = next.href;
  }
}
