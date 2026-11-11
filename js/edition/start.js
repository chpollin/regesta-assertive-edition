/**
 * Start page: the itinerary cube of the whole delivery as main view (operator's decision of
 * 2026-11-11, relayed by the coordination) and the jump to a regest by its RI number.
 */
import { bridge, loadRoutes, loadStore, mountView, siteUrl } from "./views.js";

export async function init(root) {
  const host = document.getElementById("figure");
  const [store, routes] = await Promise.all([loadStore(root), loadRoutes(root)]);
  bridge(root, routes);
  initJump(root, store, routes);
  if (!store.holdings) return;
  // A return from a regest page restores the place the view was on (#/itinerar/<place>).
  const place = location.hash.startsWith("#/itinerar/") ? decodeURIComponent(location.hash.slice(11)) : null;
  await mountView(root, host, store, "itinerary", place && store.holdings.places[place] ? place : null);
}

/** Normalised RI number: "n. 103a", "103A" and "RI IV,2,2 n. 103a" all give "103a". */
function number(text) {
  const match = String(text).toLowerCase().match(/(?:n\.\s*)?([0-9]+[a-z]?)\s*$/);
  return match ? match[1] : "";
}

function initJump(root, store, routes) {
  const form = document.getElementById("jump");
  if (!form) return;
  const message = form.querySelector(".jump-msg");
  form.hidden = false;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const wanted = number(form.elements.n.value);
    const regest = store.edition.regests.find((r) => number(r.identifier) === wanted);
    if (regest && routes.regests[regest.uid]) {
      location.assign(siteUrl(root, routes.regests[regest.uid]));
    } else {
      message.textContent = wanted ? `n. ${wanted} gehört nicht zu den Regesten dieser Auswahl.` : "Bitte eine Nummer eingeben.";
    }
  });
}
