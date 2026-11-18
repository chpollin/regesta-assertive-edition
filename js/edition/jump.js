/**
 * The jump by RI number in the header of every page (2026-11-18; before only on the start
 * page). A regest of the delivery with a place of issue opens in the Atlas, on the Atlas page
 * in place, elsewhere through atlas/#/atlas/regest/<uid>; another regest of the run opens its
 * page. The data load on the first jump, so a page without a jump stays light.
 *
 * The module initialises itself on import: js/edition/page.js imports it on every static page,
 * and index.html of the views app loads it with data-root="../".
 */
const root = document.documentElement.dataset.root ?? "";
const url = (path) => new URL(`${root}${path}`, document.baseURI).href;
let atlas = null;
let data = null;

/** The Atlas of this page, so a jump opens the regest without leaving it. */
export function setAtlas(view) {
  atlas = view;
}

/** Normalised RI number: "n. 103a", "103A" and "RI IV,2,2 n. 103a" all give "103a". */
function number(text) {
  const match = String(text).toLowerCase().match(/(?:n\.\s*)?([0-9]+[a-z]?)\s*$/);
  return match ? match[1] : "";
}

const loadJson = (path) => fetch(url(path)).then((r) => (r.ok ? r.json() : null));
const load = () => (data ??= Promise.all([loadJson("ansicht/data/holdings.json"), loadJson("ansicht/data/edition.json"), loadJson("data/routes.json")]).catch(() => [null, null, null]));

const form = document.getElementById("jump");
if (form) {
  const message = form.querySelector(".jump-msg");
  form.hidden = false;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const wanted = number(form.elements.n.value);
    message.textContent = "";
    if (!wanted) {
      message.textContent = "Nummer eingeben";
      return;
    }
    const [holdings, edition, routes] = await load();
    const placed = holdings?.regesta.find((r) => r.p && holdings.places[r.p] && number(r.i) === wanted);
    const regest = edition?.regests.find((r) => number(r.identifier) === wanted);
    if (placed && atlas) atlas.open(placed.u);
    else if (placed) location.assign(url(`atlas/#/atlas/regest/${encodeURIComponent(placed.u)}`));
    else if (regest && routes?.regests[regest.uid]) location.assign(url(routes.regests[regest.uid]));
    else message.textContent = `n. ${wanted} nicht gefunden`;
  });
}
