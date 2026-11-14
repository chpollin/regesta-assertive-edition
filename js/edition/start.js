/**
 * Start page: the space-time cube of the whole delivery with places, persons and the regesta
 * of the selection (ansicht/js/itinerary.js), after the operator's wish of 2026-11-14 that
 * start page, places and the regest list belong together and that persons join the cube.
 * The card below shows the regest opened in the cube; before any choice it is the worked
 * case RI IV,2,2 n. 103a. The jump to a regest by its RI number stays.
 */
import { bridge, demoteHeadings, loadRoutes, loadStore, siteUrl } from "./views.js";

export async function init(root) {
  const host = document.getElementById("figure");
  const [store, routes] = await Promise.all([loadStore(root), loadRoutes(root)]);
  bridge(root, routes);
  initJump(root, store, routes);
  await initExample(root, store);
  if (!store.holdings || !host) return;
  const [{ createFilters }, { renderItinerary }] = await Promise.all([
    import(siteUrl(root, "ansicht/js/filters.js")),
    import(siteUrl(root, "ansicht/js/itinerary.js")),
  ]);
  const filters = createFilters(store);
  const slot = document.getElementById("example");
  let textsPromise = null;
  const texts = () =>
    (textsPromise ??= fetch(siteUrl(root, "ansicht/data/holdings-texts.json"))
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({})));
  // A regest opened in the cube takes the place of the worked case below the figure.
  const detail = {
    show(card) {
      card.classList.add("is-page");
      slot?.replaceChildren(card);
    },
    hide() {},
  };
  const view = renderItinerary(store, { place: null, filters, detail, texts });
  const drawing = document.createElement("div");
  drawing.className = "embed-main";
  drawing.append(view.element);
  const aside = document.createElement("aside");
  aside.className = "embed-aside site-aside";
  aside.setAttribute("aria-label", "Orte, Personen und Zeitraum");
  aside.append(view.aside);
  host.classList.add("embed", "embed-start");
  host.replaceChildren(aside, drawing);
  demoteHeadings(host);
}

/** The worked case: the annotated card of the regest named in #example. */
async function initExample(root, store) {
  const slot = document.getElementById("example");
  const uid = slot?.dataset.uid;
  if (!slot || !store.byUid.has(uid)) return;
  const { renderRegestCard } = await import(siteUrl(root, "ansicht/js/regest-card.js"));
  slot.replaceChildren(renderRegestCard(store, uid, { page: true }));
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
