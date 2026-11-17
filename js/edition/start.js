/**
 * Start page: the space-time cube of the whole delivery with places, persons and the regesta
 * of the selection (ansicht/js/itinerary.js), after the operator's wish of 2026-11-14 that
 * start page, places and the regest list belong together and that persons join the cube.
 * The page is one window high (operator, 2026-11-14); a regest opened in the cube appears in
 * a panel over the right edge of the figure, the worked case RI IV,2,2 n. 103a is one link
 * above it, and the jump to a regest by its RI number stays.
 */
import { bridge, demoteHeadings, loadRoutes, loadStore, siteUrl } from "./views.js";

export async function init(root) {
  const host = document.getElementById("figure");
  const [store, routes] = await Promise.all([loadStore(root), loadRoutes(root)]);
  bridge(root, routes);
  initJump(root, store, routes);
  if (!store.holdings || !host) return;
  const [{ createFilters }, { renderItinerary }] = await Promise.all([
    import(siteUrl(root, "ansicht/js/filters.js")),
    import(siteUrl(root, "ansicht/js/itinerary.js")),
  ]);
  const filters = createFilters(store);
  const panel = document.createElement("div");
  panel.className = "start-detail";
  panel.hidden = true;
  let textsPromise = null;
  const texts = () =>
    (textsPromise ??= fetch(siteUrl(root, "ansicht/data/holdings-texts.json"))
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({})));
  // A regest opened in the cube stands in a panel over the right edge of the figure.
  const detail = {
    show(card) {
      panel.replaceChildren(card);
      panel.hidden = false;
    },
    hide() {
      panel.hidden = true;
      panel.replaceChildren();
    },
  };
  // The itinerary writes a chosen place into the address as #/itinerar/<place>; a reload
  // opens on it again.
  let asked = "";
  try {
    asked = decodeURIComponent(location.hash.match(/^#\/itinerar\/(.+)$/)?.[1] ?? "");
  } catch {
    // A malformed address opens on all places.
  }
  const place = Object.hasOwn(store.holdings.places, asked) ? asked : null;
  const view = renderItinerary(store, { place, filters, detail, texts });
  const drawing = document.createElement("div");
  drawing.className = "embed-main";
  drawing.append(view.element, panel);
  const aside = document.createElement("aside");
  aside.className = "embed-aside site-aside";
  aside.setAttribute("aria-label", "Orte, Personen und Zeitraum");
  aside.append(view.aside);
  host.classList.add("embed", "embed-start");
  host.replaceChildren(aside, drawing);
  demoteHeadings(host);
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
