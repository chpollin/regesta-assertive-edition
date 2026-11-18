/**
 * Atlas: start page and place view in one (knowledge/interface-plan.md, part 1). Where and when
 * were charters issued, and which regesta belong to it?
 *
 * One implementation for both former hosts (the start page with its own overlay and the place
 * view with the right panel of the shell): the Atlas owns its filter bar, its graphic and its
 * detail, and a host only gives it a place in the page (js/edition/start.js on the start page,
 * js/app.js in the repository's views app).
 *
 * - Filter bar on the left in the plan's order: Zeitraum, Ort, Person, Art, Schicht, the line
 *   „x von y Regesten“ with a reset that clears every facet, and the result list. The state
 *   lives in the query string (js/filters.js); on narrow screens the facets open as a sheet.
 * - Graphic: the cube on the full area (js/itinerary.js) in four representations, one switch
 *   at the same place: Würfel, Karte, Zeit and Jahrzehnte (js/decades.js).
 * - Detail: the opened regest as an overlay over the right edge of the graphic, docked beside
 *   it from 100rem, a route of its own with a back arrow on narrow screens. While it is open, a
 *   legend at the graphic counts the three kinds of relation the cube draws.
 *
 * The hash carries object, representation and opened regest only: #/atlas[/<representation>]
 * [/regest/<uid>]. Opening a regest adds a history entry, so the back button closes it.
 */
import { h } from "./dom.js";
import { timeBand } from "./sidebar.js";
import { renderRegestCard } from "./regest-card.js";
import { FAMILIES, familyIcon, familyOf } from "./relations.js";
import { s, yearOf } from "./svg.js";
import { focusKey } from "./timeband.js";
import { CAMERAS, createCube } from "./itinerary.js";
import { createDecades } from "./decades.js";
import { param } from "./url.js";

/** The representations of the Atlas in the order of the switch; the first is the default. */
export const MODES = Object.freeze([...Object.entries(CAMERAS).map(([key, c]) => ({ key, label: c.label })), { key: "jahrzehnte", label: "Jahrzehnte" }]);
const MODE_KEYS = new Set(MODES.map((m) => m.key));
/** Rows of the result list shown at once; a button adds as many again. */
const LIST_STEP = 100;
/** Old camera names of the place view (?ansicht=) and their representation. */
const OLD_CAMERA = { schraeg: "wuerfel", oben: "karte", seite: "zeit" };

/**
 * The Atlas address for an old address of the place views, so earlier links keep working:
 * #/itinerar[/<place>], #/jahrzehnte[/<place>] with ?jahrzehnt=, ?ansicht= of the cube and the
 * names of js/filters.js before the plan (rewritten there). Returns the new query and hash.
 * @param {string} view  itinerar, jahrzehnte or atlas
 * @param {string|null} place  the place named in the old hash
 * @param {string} search  the current query string
 */
export function atlasAddress(view, place, search) {
  const q = new URLSearchParams(search);
  if (place && !q.has("ort")) q.set("ort", place);
  let mode = view === "jahrzehnte" ? "jahrzehnte" : null;
  const decade = Number(q.get("jahrzehnt"));
  if (q.has("jahrzehnt")) {
    if (Number.isInteger(decade) && decade > 1000 && !q.has("von") && !q.has("bis")) {
      q.set("von", String(decade));
      q.set("bis", String(decade + 9));
    }
    q.delete("jahrzehnt");
  }
  // ?ansicht= also belongs to the view Raum; it is the Atlas's only on an old place address.
  if (view !== "atlas" && q.has("ansicht")) {
    mode ??= OLD_CAMERA[q.get("ansicht")] ?? null;
    q.delete("ansicht");
  }
  const query = q.toString();
  return { search: query ? `?${query}` : "", hash: `#/atlas${mode && mode !== MODES[0].key ? `/${mode}` : ""}` };
}

/** Representation and opened regest from the hash #/atlas[/<mode>][/regest/<uid>]. */
function readHash() {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const out = { mode: MODES[0].key, uid: null };
  if (parts[0] !== "atlas") return out;
  let i = 1;
  if (MODE_KEYS.has(parts[i])) out.mode = parts[i++];
  if (parts[i] === "regest" && parts[i + 1]) out.uid = decodeURIComponent(parts[i + 1]);
  return out;
}
function hashOf(mode, uid) {
  return `#/atlas${mode !== MODES[0].key ? `/${mode}` : ""}${uid ? `/regest/${encodeURIComponent(uid)}` : ""}`;
}

/** Search folding as in the lists: lower case, umlauts spelled out, other marks stripped. */
function fold(text) {
  return text
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * @param {any} store  edition, holdings and byUid, as in js/app.js
 * @param {{filters: any, texts?: () => Promise<Record<string, string>>, about?: string|null}} options
 */
export function renderAtlas(store, options) {
  const { filters } = options;
  const H = store.holdings;
  const places = H.places;
  const persons = H.persons ?? {};
  // The regesta the Atlas can place: a place of issue with a coordinate, in time order.
  const points = H.regesta
    .filter((r) => r.p && places[r.p])
    .map((r) => ({ u: r.u, i: r.i, p: r.p, y: yearOf(r.s) }))
    .sort((a, b) => a.y - b.y);
  const indexOf = new Map(points.map((p, i) => [p.u, i]));
  // The second layer: regesta of the run with at least one statement, and their families.
  const familiesOf = new Map();
  for (const r of store.edition.regests) {
    const keys = new Set((r.blocks ?? []).filter((b) => b.head?.evidence).map((b) => familyOf(b.title).key));
    if (keys.size) familiesOf.set(r.uid, keys);
  }
  const withStatements = new Set(familiesOf.keys());
  // Persons the Atlas can show: those of the register (holdings.json), counted by placed regesta.
  const placedPersons = Object.entries(persons)
    .map(([id, p]) => [id, p, p.r.filter((u) => indexOf.has(u)).length])
    .filter(([, , n]) => n > 0)
    .sort((a, b) => b[2] - a[2]);
  let personSets = [];
  const syncPersons = () => (personSets = filters.persons.map((id) => new Set(persons[id].r)));
  syncPersons();

  /** Whether a regest passes every facet of the Atlas. */
  const isOn = (p) =>
    filters.inYear(Math.floor(p.y)) &&
    (!filters.place || p.p === filters.place) &&
    (!personSets.length || personSets.some((set) => set.has(p.u))) &&
    (filters.layer !== "aussagen" || withStatements.has(p.u)) &&
    (!filters.familiesSet() || [...(familiesOf.get(p.u) ?? [])].some((k) => filters.familyOn(k)));
  const personMark = (p) => {
    const [a, b] = personSets.map((set) => set.has(p.u));
    return a && b ? "is-pab" : a ? "is-pa" : b ? "is-pb" : "";
  };

  // The plausibility check of check_itinerary.py, optional: flagged jumps between consecutive
  // stations, a switchable layer of the cube, named in the regest card.
  let checks = null;
  const flagsOf = new Map();
  fetch(new URL("../data/itinerary-checks.json", import.meta.url))
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      checks = data;
      for (const f of data?.flags ?? [])
        for (const [me, other] of [
          [f.a, f.b],
          [f.b, f.a],
        ])
          flagsOf.set(me.uid, [...(flagsOf.get(me.uid) ?? []), { ...f, other }]);
      flagsButton.hidden = !checks || state.mode === "jahrzehnte";
      flagsButton.title = checks ? `Auffällige Sprünge (${checks.flags.length}): mehr als ${checks.threshold.kmPerDay} km am Tag oder ${checks.threshold.floorKm} km zwischen zwei Stationen, eine Annahme, kein Befund` : "";
    })
    .catch(() => {});

  const state = { mode: readHash().mode, opened: null, shown: LIST_STEP, pushed: false, returnTo: null };
  const narrow = window.matchMedia("(max-width: 56rem)");

  // Graphic
  const figure = h("div", { class: "atlas-figure" });
  const legend = h("p", { class: "atlas-legend", hidden: true });
  let cube = null;
  let decades = null;
  const blocked = () => (detail.hidden || root.dataset.dock === "true" || narrow.matches ? null : detail.getBoundingClientRect());
  function cubeOf() {
    cube ??= createCube(store, {
      points,
      filters,
      isOn,
      personMark,
      withStatements,
      checks: () => checks,
      texts: options.texts,
      blocked,
      onOpen: (i) => open(points[i].u),
      onFree: () => syncSwitch(),
      onHome: () => setMode(MODES[0].key),
    });
    return cube;
  }
  function decadesOf() {
    decades ??= createDecades(store, {
      points,
      filters,
      isOn,
      onPlace: (id) => filters.set({ place: id === filters.place ? null : id }),
      onDecade: (from, to) => filters.set({ from, to }),
    });
    return decades;
  }
  function mountMode() {
    const view = state.mode === "jahrzehnte" ? decadesOf() : cubeOf();
    if (figure.firstChild !== view.element) figure.replaceChildren(view.element, legend);
    if (state.mode !== "jahrzehnte") cube.snapTo(state.mode);
    view.update();
    if (state.opened) state.mode === "jahrzehnte" ? decades.open(state.opened) : cube.open(indexOf.get(state.opened) ?? null);
  }

  // Tool row: the switch of the representations, camera tools, the flagged jumps, the info mark.
  const switchButtons = MODES.map((m) => h("button", { type: "button", class: "seg", "data-mode": m.key, "aria-pressed": "false", onclick: () => setMode(m.key) }, m.label));
  const freeMark = h("span", { class: "seg seg-note", text: "frei gedreht", hidden: true });
  // Signs in the tool row carry their name as accessible name and tooltip (yardstick rule 29).
  // „Würfel“ in the switch returns to the starting position, so no tool of its own does.
  const sign = (d) => s("svg", { viewBox: "0 0 16 16", class: "head-icon", "aria-hidden": "true" }, s("path", { d }));
  const tool = (label, d, onclick) => h("button", { type: "button", class: "tool", "aria-label": label, title: label, onclick }, sign(d));
  const cameraTools = h(
    "span",
    { class: "atlas-camera" },
    tool("Vergrößern", "M8 3v10M3 8h10", () => cube?.zoom(1.15)),
    tool("Verkleinern", "M3 8h10", () => cube?.zoom(1 / 1.15)),
  );
  const flagsButton = h(
    "button",
    {
      type: "button",
      class: "tool atlas-flags",
      "aria-pressed": "false",
      hidden: true,
      onclick: () => {
        const on = flagsButton.getAttribute("aria-pressed") !== "true";
        flagsButton.setAttribute("aria-pressed", String(on));
        cube?.setFlags(on);
      },
    },
    "Sprünge",
  );
  const filterButton = h("button", { type: "button", class: "tool atlas-filter-open", "aria-haspopup": "dialog", onclick: () => openSheet() }, "Filter");
  const infoPanel = h("div", { class: "atlas-info", id: "atlas-info", role: "note", hidden: true });
  const infoButton = h("button", { type: "button", class: "tool atlas-info-mark", "aria-label": "Lesehilfe", title: "Lesehilfe", "aria-expanded": "false", "aria-controls": "atlas-info", onclick: () => toggleInfo() }, sign("M8 7.2v4.6M8 4.4v.4"));
  function toggleInfo(force) {
    const on = force ?? infoPanel.hidden;
    infoPanel.hidden = !on;
    infoButton.setAttribute("aria-expanded", String(on));
    if (on) fillInfo();
  }
  function fillInfo() {
    const lines =
      state.mode === "jahrzehnte"
        ? ["Eine Karte je Jahrzehnt; die Kreisfläche zählt die Regesten eines Ortes. Ein Klick auf das Jahrzehnt setzt den Zeitraum, auf einen Ort den Ort."]
        : ["Grundriss: Karte der Ausstellungsorte, ferne Orte zur Mitte gestaucht. Höhe: Zeit. Ziehen dreht den Würfel."];
    lines.push("Orte und Daten aus der Lieferung der Regesta Imperii und ihrem Register, ohne LLM; Reich um 1190 grob nach Shepherd (1926).");
    infoPanel.replaceChildren(...lines.map((t) => h("p", { text: t })), options.about ? h("p", {}, h("a", { href: options.about }, "Über die Edition")) : null);
  }
  const tools = h(
    "div",
    { class: "atlas-tools" },
    h("div", { class: "segs", role: "group", "aria-label": "Darstellung" }, switchButtons, freeMark),
    cameraTools,
    flagsButton,
    h("span", { class: "atlas-tools-end" }, filterButton, infoButton),
    infoPanel,
  );
  function syncSwitch() {
    const free = cube?.snap() === "frei" && state.mode !== "jahrzehnte";
    for (const b of switchButtons) b.setAttribute("aria-pressed", String(!free && b.dataset.mode === state.mode));
    freeMark.hidden = !free;
    cameraTools.hidden = state.mode === "jahrzehnte";
    flagsButton.hidden = !checks || state.mode === "jahrzehnte";
  }
  function setMode(key) {
    state.mode = key;
    history.replaceState(history.state, "", `${location.pathname}${location.search}${hashOf(key, state.opened)}`);
    mountMode();
    syncSwitch();
    if (!infoPanel.hidden) fillInfo();
  }

  // Filter bar
  const facetLabel = (id, text) => h("span", { class: "facet-label", id, text });
  const bandSlot = h("div", { class: "facet-band" });
  const placeLabels = new Map();
  const placeList = h(
    "datalist",
    { id: "atlas-places" },
    Object.entries(places)
      .sort((a, b) => b[1].n - a[1].n)
      .map(([id, p]) => {
        const text = `${p.l} (${p.n})`;
        placeLabels.set(text, id);
        return h("option", { value: text });
      }),
  );
  const personLabels = new Map();
  const personList = h(
    "datalist",
    { id: "atlas-persons" },
    placedPersons.map(([id, p, n]) => {
      const text = `${p.l} (${n})`;
      personLabels.set(text, id);
      return h("option", { value: text });
    }),
  );
  /** A typed name to an id: an option chosen, the exact name, else the first name it begins. */
  function resolve(value, labels, nameOf) {
    if (labels.has(value)) return labels.get(value);
    const want = fold(value.trim());
    if (!want) return null;
    const ids = [...labels.values()];
    return ids.find((id) => fold(nameOf(id)) === want) ?? ids.find((id) => fold(nameOf(id)).startsWith(want)) ?? null;
  }
  // The field says what it searches; a word above it would repeat its placeholder.
  const searchField = (id, list, label, onPick) => {
    const input = h("input", { type: "search", class: "facet-input", id, list, autocomplete: "off", placeholder: label, "aria-label": label });
    const pick = () => {
      const picked = onPick(input.value);
      if (picked) input.value = "";
    };
    input.addEventListener("change", pick);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        pick();
      }
    });
    return input;
  };
  const placeInput = searchField("atlas-ort", "atlas-places", "Ort suchen", (value) => {
    const id = resolve(value, placeLabels, (x) => places[x].l);
    if (id) filters.set({ place: id });
    return id;
  });
  const personInput = searchField("atlas-person", "atlas-persons", "Person suchen", (value) => {
    const id = resolve(value, personLabels, (x) => persons[x].l);
    if (id && !filters.persons.includes(id)) filters.set({ persons: [...filters.persons, id] });
    return id;
  });
  const placeChip = h("div", { class: "chips" });
  const personChips = h("div", { class: "chips" });
  const chip = (text, title, key, onRemove) =>
    h("span", { class: "chip", title }, key ? h("span", { class: `it-pkey ${key}`, "aria-hidden": "true" }) : null, h("span", { class: "chip-name", text }), h("button", { type: "button", class: "chip-x", "aria-label": `${text} entfernen`, title: "Entfernen", onclick: onRemove }, "×"));
  const artButtons = FAMILIES.map((f) =>
    h(
      "button",
      {
        type: "button",
        class: "art-chip",
        "aria-pressed": "false",
        title: f.label,
        "data-family": f.key,
        onclick: () => {
          const pressed = new Set(filters.familiesSet() ? filters.families : []);
          if (pressed.has(f.key)) pressed.delete(f.key);
          else pressed.add(f.key);
          filters.set({ families: [...pressed] });
        },
      },
      familyIcon(f, { size: 14 }),
      h("span", { text: f.short }),
    ),
  );
  const layerButtons = [
    ["alle", "Alle Regesten", "it-key"],
    ["aussagen", "mit Aussagen", "it-key is-evidenced"],
  ].map(([key, text, sign]) => h("button", { type: "button", class: "layer-chip", "aria-pressed": "false", "data-layer": key, onclick: () => filters.set({ layer: key }) }, h("span", { class: sign, "aria-hidden": "true" }), text));
  // The text search belongs to the lists (?q=); carried here from a list it stands greyed, so
  // it does not vanish, and says where it applies.
  const text = param("q");
  const facets = h(
    "div",
    { class: "atlas-facets" },
    // Band and chips say what they filter („1122 bis 1190“, „Alle Regesten“); only the kinds
    // of statement need their word, Art (subtractive pass of the slice).
    h("div", { class: "facet", role: "group", "aria-label": "Zeitraum" }, bandSlot),
    h("div", { class: "facet" }, placeInput, placeList, placeChip),
    h("div", { class: "facet" }, personInput, personList, personChips),
    h("div", { class: "facet", role: "group", "aria-labelledby": "f-art" }, facetLabel("f-art", "Art"), h("div", { class: "art-chips" }, artButtons)),
    h("div", { class: "facet", role: "group", "aria-label": "Schicht" }, h("div", { class: "layer-chips" }, layerButtons)),
    text ? h("div", { class: "facet is-off", title: "Die Textsuche wirkt in der Liste Regesten, nicht im Atlas." }, facetLabel("f-text", "Text"), h("input", { type: "search", class: "facet-input", value: text, readonly: true, "aria-disabled": "true", "aria-labelledby": "f-text" })) : null,
  );
  const countLine = h("p", { class: "atlas-count", role: "status" });
  const list = h("ul", { class: "atlas-list", role: "list", "aria-label": "Regesten der Auswahl" });
  const bar = h("aside", { class: "atlas-bar", "aria-label": "Filter und Regesten der Auswahl" }, facets, h("div", { class: "atlas-result" }, countLine, list));

  // The filter sheet on narrow screens: the same facets in a dialog from below.
  const sheetDone = h("button", { type: "button", class: "tool", onclick: () => sheet.close() }, "Fertig");
  const sheetBody = h("div", { class: "atlas-sheet-body" });
  // The sheet keeps its own reset, since the count line stands behind it.
  const sheetReset = h("button", { type: "button", class: "link-button", hidden: true, onclick: () => filters.reset() }, "Zurücksetzen");
  const sheet = h("dialog", { class: "atlas-sheet", "aria-label": "Filter" }, h("div", { class: "atlas-sheet-head" }, h("span", { class: "facet-label", text: "Filter" }), sheetReset, sheetDone), sheetBody);
  sheet.addEventListener("close", () => {
    bar.prepend(facets);
    filterButton.focus();
  });
  function openSheet() {
    sheetBody.append(facets);
    sheet.showModal();
  }
  narrow.addEventListener("change", () => {
    if (!narrow.matches && sheet.open) sheet.close();
    placeDetail();
  });

  // Detail
  const back = h("button", { type: "button", class: "tool atlas-back", "aria-label": "Zurück zum Atlas", onclick: () => close() }, "← Atlas");
  const detail = h("aside", { class: "atlas-detail", "aria-label": "Geöffnetes Regest", hidden: true });
  detail.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  });
  const stage = h(
    "section",
    { class: "atlas-stage", "aria-labelledby": "atlas-title" },
    h("h1", { id: "atlas-title", class: "visually-hidden", text: "Atlas: Regesten mit Ausstellungsort in Raum und Zeit" }),
    tools,
    figure,
  );
  const root = h("div", { class: "atlas" }, bar, stage, detail, sheet);
  function placeDetail() {
    root.dataset.dock = String(!narrow.matches && window.matchMedia("(min-width: 100rem)").matches);
  }
  window.matchMedia("(min-width: 100rem)").addEventListener("change", placeDetail);
  placeDetail();
  // The overlay starts below the tool row, whose height follows its wrapping.
  const toolsObserver = new ResizeObserver(() => root.style.setProperty("--atlas-top", `${tools.offsetHeight}px`));
  toolsObserver.observe(tools);

  /** The legend of the three kinds of relation of an opened regest, each with its count. */
  function showLegend(counts) {
    legend.hidden = !counts;
    if (!counts) return legend.replaceChildren();
    const item = (cls, label, n) => h("span", { class: "atlas-legend-item" }, h("span", { class: `rel-key ${cls}`, "aria-hidden": "true" }), `${label} `, h("b", { text: String(n) }));
    legend.replaceChildren(item("is-step", "Stationen davor und danach", counts.steps), item("is-place", "gleicher Ort", counts.place), item("is-people", "gemeinsame Person", counts.people));
  }

  function writeHash(uid, push) {
    const url = `${location.pathname}${location.search}${hashOf(state.mode, uid)}`;
    if (push) history.pushState({ atlasRegest: uid }, "", url);
    else history.replaceState(uid ? { atlasRegest: uid } : null, "", url);
  }

  /** Open a regest of the delivery: the card, its relations in the cube, the hash. */
  function open(uid, { push = true } = {}) {
    if (!uid) return;
    const wasOpen = !!state.opened;
    if (!wasOpen) state.returnTo = document.activeElement instanceof HTMLElement && !detail.contains(document.activeElement) ? document.activeElement : null;
    state.opened = uid;
    const i = indexOf.get(uid);
    showLegend(state.mode !== "jahrzehnte" && i !== undefined ? cubeOf().open(i) : null);
    if (state.mode === "jahrzehnte") decadesOf().open(uid);
    const notes = (flagsOf.get(uid) ?? []).map((f) => `Auffällig: ${f.km} km in ${f.days} ${f.days === 1 ? "Tag" : "Tagen"} zu ${f.other.identifier} (${f.other.place}). Vermutlicher Grund: ${f.class}.`);
    const card = renderRegestCard(store, uid, { notes, texts: options.texts, onClose: () => close() });
    card.setAttribute("tabindex", "-1");
    detail.replaceChildren(back, card);
    detail.hidden = false;
    root.dataset.open = "true";
    // A further regest opened from an open one replaces the entry, so back leads to the Atlas.
    writeHash(uid, push && !wasOpen);
    if (push && !wasOpen) state.pushed = true;
    for (const row of list.querySelectorAll("[data-uid]")) row.toggleAttribute("aria-current", row.dataset.uid === uid);
    if (narrow.matches) window.scrollTo(0, 0);
    card.focus({ preventScroll: true });
  }

  /** Close the regest: by the back button of the browser where opening added an entry. */
  function close() {
    if (!state.opened) return;
    if (state.pushed && history.state?.atlasRegest === state.opened) {
      history.back();
      return;
    }
    shut();
    writeHash(null, false);
  }
  function shut() {
    state.opened = null;
    state.pushed = false;
    cube?.open(null);
    decades?.open(null);
    showLegend(null);
    detail.hidden = true;
    detail.replaceChildren();
    delete root.dataset.open;
    for (const row of list.querySelectorAll("[aria-current]")) row.removeAttribute("aria-current");
    const target = state.returnTo;
    state.returnTo = null;
    if (target?.isConnected) target.focus();
    else if (target?.dataset?.uid) list.querySelector(`[data-uid="${CSS.escape(target.dataset.uid)}"]`)?.focus();
  }
  const onPop = () => {
    const { uid, mode } = readHash();
    if (mode !== state.mode && location.hash.startsWith("#/atlas")) {
      state.mode = mode;
      mountMode();
      syncSwitch();
    }
    if (!uid && state.opened) shut();
    else if (uid && uid !== state.opened) open(uid, { push: false });
  };
  window.addEventListener("popstate", onPop);

  // Rendering the bar on every change; the facets keep their elements, so focus stays.
  function renderBar() {
    syncPersons();
    const restore = focusKey(bandSlot);
    const shown = points.filter(isOn);
    const marks = filters.place || filters.persons.length ? new Set(shown.map((p) => Math.floor(p.y))) : new Set();
    bandSlot.replaceChildren(timeBand(store, filters, marks, { ends: false }));
    restore();
    placeChip.replaceChildren(filters.place ? chip(places[filters.place].l, `Ausstellungsort ${places[filters.place].l}`, null, () => filters.set({ place: null })) : "");
    personChips.replaceChildren(...filters.persons.map((id, j) => chip(persons[id].l, persons[id].f, `is-p${j}`, () => filters.set({ persons: filters.persons.filter((x) => x !== id) }))));
    personInput.hidden = filters.persons.length >= 2;
    personInput.placeholder = filters.persons.length ? "Zweite Person" : "Person suchen";
    personInput.setAttribute("aria-label", personInput.placeholder);
    for (const b of artButtons) b.setAttribute("aria-pressed", String(filters.familiesSet() && filters.familyOn(b.dataset.family)));
    for (const b of layerButtons) b.setAttribute("aria-pressed", String(b.dataset.layer === filters.layer));
    const set = (filters.timeActive() ? 1 : 0) + (filters.place ? 1 : 0) + filters.persons.length + (filters.familiesSet() ? 1 : 0) + (filters.layer !== "alle" ? 1 : 0);
    filterButton.textContent = set ? `Filter (${set})` : "Filter";
    sheetDone.textContent = `${shown.length} Regesten zeigen`;
    sheetReset.hidden = !filters.any();
    // Each number once: at rest the total alone, narrowed the share of it.
    countLine.replaceChildren(h("b", { text: String(shown.length) }), shown.length === points.length ? " Regesten" : ` von ${points.length} Regesten`);
    if (filters.any()) countLine.append(h("button", { type: "button", class: "link-button atlas-reset", onclick: () => filters.reset() }, "Zurücksetzen"));
    renderList(shown);
  }
  function renderList(shown) {
    const restore = focusKey(list);
    const rows = shown.slice(0, state.shown).map((p) => {
      const mark = personSets.length ? personMark(p) : withStatements.has(p.u) ? "is-evidenced" : "";
      // Year and place stand in every row: a reader took blank cells of a run for missing
      // places (operator's decision of 2026-11-18).
      const year = Math.floor(p.y);
      const place = places[p.p].l;
      return h(
        "li",
        {},
        h(
          "button",
          {
            type: "button",
            class: "atlas-row",
            "data-uid": p.u,
            "aria-current": p.u === state.opened ? "true" : null,
            onclick: () => open(p.u),
            onmouseenter: () => cube && !state.opened && cube.point(indexOf.get(p.u)),
            onmouseleave: () => cube?.point(null),
            onfocus: () => cube && !state.opened && cube.point(indexOf.get(p.u)),
            onblur: () => cube?.point(null),
          },
          h("span", { class: "row-year", text: String(year) }),
          h("span", { class: "row-id", text: p.i }),
          h("span", { class: "row-place", text: place }),
          mark ? h("span", { class: mark.startsWith("is-p") ? `it-pkey ${mark}` : `it-key ${mark}`, title: mark === "is-evidenced" ? "mit Aussagen" : "Person", "aria-label": mark === "is-evidenced" ? "mit Aussagen" : null }) : null,
        ),
      );
    });
    const more =
      shown.length > state.shown
        ? h(
            "li",
            {},
            h(
              "button",
              {
                type: "button",
                class: "link-button atlas-more",
                onclick: () => {
                  state.shown += LIST_STEP;
                  renderList(points.filter(isOn));
                },
              },
              `${Math.min(LIST_STEP, shown.length - state.shown)} weitere`,
            ),
          )
        : null;
    list.replaceChildren(...rows, more ?? "", shown.length ? "" : h("li", { class: "atlas-empty", text: "Keine Regesten in dieser Auswahl." }));
    restore();
  }

  const unsubscribe = filters.onChange(() => {
    state.shown = LIST_STEP;
    renderBar();
    (state.mode === "jahrzehnte" ? decades : cube)?.update();
  });

  renderBar();
  mountMode();
  syncSwitch();
  const first = readHash().uid;
  if (first) requestAnimationFrame(() => open(first, { push: false }));

  return {
    element: root,
    full: true,
    open,
    dispose() {
      unsubscribe();
      toolsObserver.disconnect();
      window.removeEventListener("popstate", onPop);
      cube?.dispose();
      decades?.dispose();
    },
  };
}
