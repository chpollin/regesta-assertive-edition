// Entry view of the Registernetz. Address: #/eintrag/<register id>?regest=<uid>. The selected
// regest is one state shared by figure and list and kept in the address.

import { h, entryHref } from "./dom.js";
import { loadEntry, loadRecord, validEntryId } from "./data.js";
import { regestsOf, sectorsOf, kindOf } from "./model.js";
import { KIND, findingText, truncatedStart } from "./text.js";
import { drawFigure } from "./figure.js";
import { lineOf, fillDetail, failDetail } from "./list.js";
import { mountSearch } from "./search.js";

const EXAMPLE = "RI004-002-B000330";
const main = document.querySelector("main");

const state = { id: null, entry: null, regests: [], sectors: [], uid: null, open: [], record: null, recordFailed: false };

function parse() {
  const m = /^#\/eintrag\/([^?]+)(?:\?(.*))?$/.exec(location.hash);
  if (!m) return null;
  const params = new URLSearchParams(m[2] || "");
  return { id: decodeURIComponent(m[1]), uid: params.get("regest") };
}

// The parent chain from the top, each with its own row or only a derived label.
function pathOf(entry) {
  const chain = [];
  for (let p = entry.parent; p; p = p.parent) chain.unshift(p);
  return chain;
}

function titleRow(entry) {
  const kind = kindOf(entry.id);
  const segs = pathOf(entry).flatMap((p) => [
    p.derivedLabel ? h("span", { class: "seg" }, p.shortLabel) : h("a", { class: "seg", href: entryHref(p.identifier) }, p.shortLabel),
    h("span", { class: "sep", "aria-hidden": "true" }, "›"),
  ]);
  const passim = /\((passim[^)]*)\)/.exec(entry.label || "")?.[1];
  const findings = (entry.findings || []).map((f) => h("span", { class: "defect" }, h("span", { class: "defect-word" }, "Exportfehler"), " ",
    findingText(f), f.findingType === "TruncatedLabel" ? `, beginnt „${truncatedStart(f)}“` : ""));
  return h("div", { class: "title-row" },
    h("nav", { class: "path", "aria-label": "Stichwortpfad" }, segs,
      h("h1", {}, entry.shortLabel)),
    h("span", { class: "kind" }, kind === "parent" ? "" : KIND[kind]),
    passim ? h("span", { class: "register-note" }, `„${passim}“`) : null,
    ...findings);
}

function setAddress(uid) {
  const hash = entryHref(state.id, uid);
  if (location.hash !== hash) history.replaceState(null, "", hash);
}

let figureHost = null;
let listHost = null;

function drawAll() {
  if (!figureHost) return;
  drawFigure(figureHost, {
    entry: state.entry, sectors: state.sectors, selectedUid: state.uid, record: state.record,
    recordFailed: state.recordFailed, open: state.open,
    onSelect: (uid) => select(uid, "figure"),
    onToggle: (key) => {
      state.open = state.open.includes(key) ? state.open.filter((k) => k !== key) : [...state.open, key];
      drawAll();
      figureHost.querySelector(`[aria-expanded][aria-label^="${CSS.escape(key)}"]`)?.focus();
    },
    onRead: (uid) => {
      const line = document.getElementById(`zeile-${uid}`);
      line?.scrollIntoView({ block: "start", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      line?.querySelector("button")?.focus({ preventScroll: true });
    },
  });
}

function drawList() {
  listHost.replaceChildren(...state.regests.map((it) => lineOf(it, it.uid === state.uid, (uid) => select(uid, "list"))));
  if (state.uid && state.record) fillDetail(document.getElementById(`regest-${state.uid}`), state.record, state.entry);
  else if (state.uid && state.recordFailed) failDetail(document.getElementById(`regest-${state.uid}`));
}

// One selection for figure and list. The origin keeps keyboard focus where the reader acted.
async function select(uid, origin) {
  const valid = uid && state.regests.some((r) => r.uid === uid) ? uid : null;
  state.uid = valid;
  state.record = null;
  state.recordFailed = false;
  setAddress(valid);
  drawAll();
  drawList();
  refocus(origin);
  if (!valid) return;
  try {
    const rec = await loadRecord(valid);
    if (state.uid !== valid) return;
    state.record = rec;
  } catch {
    if (state.uid !== valid) return;
    state.recordFailed = true;
  }
  drawAll();
  drawList();
  refocus(origin);
}

function refocus(origin) {
  if (origin === "figure") figureHost.querySelector('.regest[tabindex="0"]')?.focus({ preventScroll: true });
  if (origin === "list") {
    const target = state.uid ? document.querySelector(`#zeile-${state.uid} > button`) : null;
    (target || document.activeElement)?.focus({ preventScroll: true });
  }
}

function showEmptyStart() {
  main.replaceChildren(h("p", { class: "state" }, "Suchen Sie oben nach einem Eintrag des Registers, etwa ",
    h("a", { href: entryHref(EXAMPLE, "24711") }, "Beatrix von (Hoch-)Burgund"), "."));
}

function showLoadError(id) {
  main.replaceChildren(h("p", { class: "state load-error" }, validEntryId(id)
    ? "Dieser Eintrag konnte nicht geladen werden. Vielleicht gibt es ihn im Register nicht; die Suche oben führt zu jedem Eintrag."
    : "Die Adresse nennt keinen Eintrag des Registers. Die Suche oben führt zu jedem Eintrag."));
}

async function route() {
  const r = parse();
  if (!r) { state.id = null; figureHost = null; showEmptyStart(); return; }
  if (r.id !== state.id) {
    let entry;
    try { entry = await loadEntry(r.id); } catch { state.id = null; figureHost = null; showLoadError(r.id); return; }
    state.id = r.id;
    state.entry = entry;
    state.regests = regestsOf(entry);
    state.sectors = sectorsOf(state.regests);
    state.open = [];
    state.uid = undefined;
    document.title = `${entry.shortLabel}: Registernetz`;
    if (!state.regests.length) { showChildren(entry); return; }
    figureHost = h("div", { class: "figure-host" });
    listHost = h("ol", { class: "lines", "aria-label": "Regesten des Eintrags" });
    main.replaceChildren(titleRow(entry), figureHost,
      h("section", { class: "list", "aria-label": "Regesten" },
        h("h2", { class: "visually-hidden" }, "Regesten"),
        h("div", { class: "heads", "aria-hidden": "true" },
          h("span", {}, "Datierung"), h("span", {}, "Ort"), h("span", {}, "Regest"), h("span", {}, "Rolle"), h("span", {}, "Kommentar")),
        listHost));
    window.scrollTo(0, 0);
    main.focus({ preventScroll: true });
  }
  if (r.uid !== state.uid) await select(r.uid, null);
}

// An entry without rows of its own: its children are the list.
function showChildren(entry) {
  figureHost = null;
  main.replaceChildren(titleRow(entry),
    h("p", { class: "state" }, "Das Register führt für dieses Stichwort keine eigene Zeile; die Einträge darunter tragen die Regesten."),
    h("ul", { class: "children" }, (entry.children || []).map((c) => h("li", {},
      h("a", { href: entryHref(c.identifier) }, c.shortLabel),
      h("span", { class: "kind" }, KIND[kindOf(c.id)])))));
}

let resizeTimer = 0;
addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(drawAll, 150); });
addEventListener("hashchange", route);
mountSearch(document.querySelector(".search"));
document.fonts.ready.then(route);
