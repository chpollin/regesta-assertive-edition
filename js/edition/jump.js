/**
 * The jump by RI number in the header of every page (2026-11-18; before only on the start
 * page). A regest of the delivery with a place of issue opens in the Atlas, on the Atlas page
 * in place, elsewhere through atlas/#/atlas/regest/<uid>; another regest of the run opens its
 * page; a regest of the delivery with neither opens in the list of Regesten, which shows every
 * regest. A typed volume („RI IV,2,1 n. 103a“) decides between regesta of the same number. The
 * data load on the first jump, so a page without a jump stays light.
 *
 * The module initialises itself on import: js/edition/page.js imports it on every static page,
 * and index.html of the views app loads it with data-root="../" (en/ansicht/: "../../").
 *
 * data-root leads to the site root, where data and the views app lie; data-home to the start of
 * the page's language, where its pages lie (the root itself for German, en/ for English).
 */
const root = document.documentElement.dataset.root ?? "";
const home = document.documentElement.dataset.home ?? root;
const url = (path) => new URL(`${root}${path}`, document.baseURI).href;
const page = (path) => new URL(`${home}${path}`, document.baseURI).href;
const { t } = await import(url("ansicht/js/i18n.js"));
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
      message.textContent = t("jump.empty");
      return;
    }
    const [holdings, edition, routes] = await load();
    // The same number stands in more than one volume (n. 103a); a typed volume decides.
    const squeeze = (s) => String(s).toLowerCase().replace(/\s+/g, "");
    const typed = squeeze(form.elements.n.value).replace(/^ri/, "");
    const same = (holdings?.regesta ?? []).filter((r) => number(r.i) === wanted);
    const exact = typed.includes(",") ? same.filter((r) => squeeze(r.i).endsWith(typed)) : [];
    // A typed volume without that number is not found; another volume's regest is no answer.
    const hits = typed.includes(",") ? exact : same;
    const placed = hits.find((r) => r.p && holdings.places[r.p]);
    const regest = edition?.regests.find((r) => (holdings ? hits.some((x) => x.u === r.uid) : number(r.identifier) === wanted));
    if (placed && atlas) atlas.open(placed.u);
    else if (placed) location.assign(page(`atlas/#/atlas/regest/${encodeURIComponent(placed.u)}`));
    else if (regest && routes?.regests[regest.uid]) location.assign(page(routes.regests[regest.uid]));
    // A regest of the delivery without a place of issue and outside the run: the list shows it.
    else if (hits.length) location.assign(page(`regesten/#/regesten/regest/${encodeURIComponent(hits[0].u)}`));
    else message.textContent = t("jump.missing", { n: wanted });
  });
}
