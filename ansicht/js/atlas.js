/**
 * Atlas: start page and place view in one (knowledge/interface-plan.md, part 1). Where and when
 * were charters issued, and which regesta belong to it?
 *
 * One implementation for both hosts: the Atlas owns its filter bar, its graphic and its detail
 * (the shared frame of js/filterbar.js), and a host only gives it a place in the page
 * (js/edition/start.js on the start page, js/app.js in the repository's views app).
 *
 * - Filter bar on the left in the plan's order: Zeitraum, Ort, Person, Art, Schicht, the line
 *   „x von y Regesten“ with a reset that clears every facet, and the result list. The count and
 *   the list hold every regest of the delivery that passes the facets (js/selection.js), the
 *   same number as in Regesten and Zeitband; the cube draws those with a place of issue.
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
import { createCount, createDetail, createFacets, createFrame, createList } from "./filterbar.js";
import { renderRegestCard } from "./regest-card.js";
import { createSelection } from "./selection.js";
import { s } from "./svg.js";
import { CAMERAS, createCube } from "./itinerary.js";
import { createDecades } from "./decades.js";
import { t, term } from "./i18n.js";

/** The representations of the Atlas in the order of the switch; the first is the default. */
export const MODES = Object.freeze([...Object.keys(CAMERAS), "jahrzehnte"].map((key) => ({ key, label: t(`atlas.mode.${key}`) })));
const MODE_KEYS = new Set(MODES.map((m) => m.key));
/** Old camera names of the place view (?ansicht=) and their representation. */
const OLD_CAMERA = { schraeg: "wuerfel", oben: "karte", seite: "zeit" };
/** The Atlas evaluates every facet but the text search of the list. */
const SKIP = new Set(["text"]);

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

/**
 * @param {any} store  edition, holdings and byUid, as in js/app.js
 * @param {{filters: any, texts?: () => Promise<Record<string, string>>, about?: string|null}} options
 */
export function renderAtlas(store, options) {
  const { filters } = options;
  const H = store.holdings;
  const places = H.places;
  const selection = createSelection(store, filters);
  // The regesta the cube can place: a place of issue with a coordinate, in time order.
  const points = selection.rows.filter((r) => r.p);
  const indexOf = new Map(points.map((p, i) => [p.u, i]));
  const withStatements = new Set(selection.familiesOf.keys());
  const isOn = (p) => selection.passes(p, { skip: SKIP });
  const personMark = (p) => selection.personMark(p.u);
  const persons = Object.entries(H.persons ?? {})
    .map(([id, p]) => [id, p.l, p.r.length])
    .sort((a, b) => b[2] - a[2]);

  // The plausibility check of check_itinerary.py, optional: flagged jumps between consecutive
  // stations, a switchable layer of the cube, named in the regest card.
  let checks = null;
  const flagsOf = new Map();
  const checksLoaded = fetch(new URL("../data/itinerary-checks.json", import.meta.url))
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      checks = data;
      for (const f of data?.flags ?? [])
        for (const [me, other] of [
          [f.a, f.b],
          [f.b, f.a],
        ])
          flagsOf.set(me.uid, [...(flagsOf.get(me.uid) ?? []), { ...f, other }]);
      flagsButton.title = checks ? t("atlas.flagsTitle", { n: checks.flags.length, perDay: checks.threshold.kmPerDay, floor: checks.threshold.floorKm }) : "";
      syncSwitch();
    })
    .catch(() => {});

  const state = { mode: readHash().mode };

  // Graphic
  const figure = h("div", { class: "atlas-figure" });
  const legend = h("p", { class: "atlas-legend", hidden: true });
  let cube = null;
  let decades = null;
  const blocked = () => (frame.detail.hidden || frame.root.dataset.dock === "true" || frame.narrow.matches ? null : frame.detail.getBoundingClientRect());
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
      onOpen: (i) => detail.open(points[i].u),
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
    const opened = detail?.opened();
    if (opened) state.mode === "jahrzehnte" ? decades.open(opened) : showLegend(cube.open(indexOf.get(opened) ?? null));
  }

  // Tool row in three groups (design round of 2026-11-18): the representations as one segmented
  // switch, zoom as two small sign buttons and, only after the reader rotated the cube, a quiet
  // state hint with the way back; at the right end the flagged ways as a toggle and the info mark.
  const switchButtons = MODES.map((m) => h("button", { type: "button", class: "seg", "data-mode": m.key, "aria-pressed": "false", onclick: () => setMode(m.key) }, m.label));
  const freeMark = h(
    "span",
    { class: "atlas-free", hidden: true },
    t("atlas.free"),
    h("button", { type: "button", class: "link-button atlas-free-reset", onclick: () => setMode(MODES[0].key) }, t("atlas.freeReset")),
  );
  const sign = (d) => s("svg", { viewBox: "0 0 16 16", class: "head-icon", "aria-hidden": "true" }, s("path", { d }));
  const tool = (label, d, onclick) => h("button", { type: "button", class: "tool", "aria-label": label, title: label, onclick }, sign(d));
  const cameraTools = h("span", { class: "atlas-camera", role: "group", "aria-label": t("atlas.zoom") }, tool(t("atlas.zoomIn"), "M8 3v10M3 8h10", () => cube?.zoom(1.15)), tool(t("atlas.zoomOut"), "M3 8h10", () => cube?.zoom(1 / 1.15)));
  // „Auffällige Wege“ replaces „Sprünge“, which a fresh reader did not understand (2026-11-18).
  const flagsButton = h(
    "button",
    {
      type: "button",
      class: "atlas-flags",
      "aria-pressed": "false",
      hidden: true,
      onclick: () => {
        const on = flagsButton.getAttribute("aria-pressed") !== "true";
        flagsButton.setAttribute("aria-pressed", String(on));
        cube?.setFlags(on);
      },
    },
    h("span", { class: "toggle-track", "aria-hidden": "true" }),
    t("atlas.flags"),
  );
  const infoPanel = h("div", { class: "atlas-info", id: "atlas-info", role: "note", hidden: true });
  const infoButton = h("button", { type: "button", class: "tool atlas-info-mark", "aria-label": t("info.button"), title: t("info.button"), "aria-expanded": "false", "aria-controls": "atlas-info", onclick: () => toggleInfo() }, sign("M8 7.2v4.6M8 4.4v.4"));
  function toggleInfo(force) {
    const on = force ?? infoPanel.hidden;
    infoPanel.hidden = !on;
    infoButton.setAttribute("aria-expanded", String(on));
    if (on) fillInfo();
  }
  /** The key of the cube's points and lines, behind the info mark (finding of 2026-11-18). */
  function cubeKey() {
    const item = (cls, text) => h("li", {}, h("span", { class: cls, "aria-hidden": "true" }), text);
    return h(
      "ul",
      { class: "atlas-key", "aria-label": t("atlas.key.aria") },
      item("it-key", t("atlas.key.placed")),
      item("it-key is-evidenced", t("atlas.key.evidenced")),
      item("it-key is-vague", t("atlas.key.vague")),
      item("rel-key is-route", t("atlas.key.route")),
      filters.persons.length ? item("it-pkey is-pa", t("atlas.key.personA")) : null,
      filters.persons.length > 1 ? item("it-pkey is-pb", t("atlas.key.personB")) : null,
      item("rel-key is-flag", t("atlas.key.flag")),
      item("it-key is-realm", t("atlas.key.realm")),
    );
  }
  function fillInfo() {
    const lines =
      state.mode === "jahrzehnte"
        ? [h("p", { text: t("atlas.info.decades") })]
        : [h("p", { text: t("atlas.info.cube") }), cubeKey()];
    lines.push(h("p", { text: t("atlas.info.source") }));
    // The cube follows the Space-Time Cube idea the operator took from Windhager et al. 2019.
    lines.push(h("p", {}, t("atlas.info.idea"), " ", h("a", { href: "https://doi.org/10.1109/TVCG.2018.2830759", rel: "noopener" }, "Windhager et al. (2019)"), "."));
    if (options.about) lines.push(h("p", {}, h("a", { href: options.about }, t("atlas.info.about"))));
    infoPanel.replaceChildren(...lines);
  }
  function syncSwitch() {
    const free = cube?.snap() === "frei" && state.mode !== "jahrzehnte";
    for (const b of switchButtons) b.setAttribute("aria-pressed", String(!free && b.dataset.mode === state.mode));
    freeMark.hidden = !free;
    cameraTools.hidden = state.mode === "jahrzehnte";
    flagsButton.hidden = !checks || state.mode === "jahrzehnte";
  }
  function setMode(key) {
    state.mode = key;
    history.replaceState(history.state, "", `${location.pathname}${location.search}${hashOf(key, detail.opened())}`);
    mountMode();
    syncSwitch();
    if (!infoPanel.hidden) fillInfo();
  }

  // Filter bar, count line and result list.
  const facets = createFacets(store, filters, {
    prefix: "atlas",
    applies: { text: t("atlas.textOff") },
    persons,
    marks: () => (filters.place || filters.persons.length ? new Set(shown.map((r) => r.year)) : new Set()),
  });
  const count = createCount(filters);
  const list = createList({
    label: t("list.label"),
    onOpen: (u) => detail.open(u),
    onPoint: (u) => cube?.point(u && indexOf.has(u) ? indexOf.get(u) : null),
    mark: (r) => (filters.persons.length ? selection.personMark(r.u) : r.stmt ? "is-evidenced" : ""),
  });
  const frame = createFrame(filters, {
    name: "atlas",
    title: t("atlas.title"),
    facets: facets.element,
    count: count.element,
    list: list.element,
    tools: [h("div", { class: "segs", role: "group", "aria-label": t("atlas.modes") }, switchButtons), cameraTools, freeMark],
    toolsEnd: [flagsButton, infoButton, infoPanel],
    main: figure,
    backLabel: t("atlas.back"),
    backShort: t("atlas.backShort"),
    onEscape: () => detail.close(),
  });

  /**
   * The legend of the three kinds of relation of an opened regest, each with its count, in the
   * colours and forms of the cube. Of the shared persons the cube draws the nearest in time; the
   * legend says how many and shows all on demand.
   */
  function showLegend(counts) {
    legend.hidden = !counts;
    if (!counts) return legend.replaceChildren();
    const item = (cls, label, n) => h("span", { class: "atlas-legend-item" }, h("span", { class: `rel-key ${cls}`, "aria-hidden": "true" }), `${label} `, h("b", { text: String(n) }));
    const people = item("is-people", t("atlas.legend.people"), counts.people);
    if (counts.people > counts.drawn) {
      const nearest = t("atlas.legend.nearest", { n: counts.drawn });
      const all = h("button", { type: "button", class: "atlas-legend-all", "aria-pressed": "false", title: t("atlas.legend.nearestTitle", { n: counts.drawn }) }, nearest);
      all.addEventListener("click", () => {
        const on = all.getAttribute("aria-pressed") !== "true";
        all.setAttribute("aria-pressed", String(on));
        all.textContent = on ? t("atlas.legend.all") : nearest;
        cube?.allPeople(on);
      });
      people.append(" ", all);
    }
    legend.replaceChildren(item("is-step", t("atlas.legend.steps"), counts.steps), item("is-place", t("atlas.legend.place"), counts.place), people);
  }

  const detail = createDetail(frame, {
    list,
    hashOf: (u) => hashOf(state.mode, u),
    readUid: () => (location.hash.startsWith("#/atlas") ? readHash().uid : null),
    card: (u) => {
      // The class of a flag is a German label of check_itinerary.py, translated as a term.
      // A placed regest without an exact day says how it is dated and that the line passes it by.
      const row = selection.byUid.get(u);
      const vague = row?.p && !row.line ? [{ text: t(`atlas.vague.${row.kind}`) }] : [];
      const notes = vague.concat((flagsOf.get(u) ?? []).map((f) => ({ flag: true, text: t("atlas.flagNote", { km: f.km, n: f.days, other: f.other.identifier, place: f.other.place, reason: term(f.class) }) })));
      return renderRegestCard(store, u, { notes, texts: options.texts, onClose: () => detail.close() });
    },
    onOpen: (u) => {
      const i = indexOf.get(u);
      showLegend(state.mode !== "jahrzehnte" && i !== undefined ? cubeOf().open(i) : (cube?.open(null), null));
      if (state.mode === "jahrzehnte") decadesOf().open(u);
    },
    onShut: () => {
      cube?.open(null);
      decades?.open(null);
      showLegend(null);
    },
  });
  const onMode = () => {
    const { mode } = readHash();
    if (mode !== state.mode && location.hash.startsWith("#/atlas")) {
      state.mode = mode;
      mountMode();
      syncSwitch();
    }
  };
  window.addEventListener("popstate", onMode);

  let shown = [];
  function renderBar() {
    shown = selection.filter({ skip: SKIP });
    facets.update();
    count.update(shown.length, selection.rows.length);
    frame.updateSheet(shown.length);
    list.update(shown);
    list.setOpened(detail.opened());
  }

  const unsubscribe = filters.onChange(() => {
    renderBar();
    (state.mode === "jahrzehnte" ? decades : cube)?.update();
    if (!infoPanel.hidden) fillInfo();
  });

  renderBar();
  mountMode();
  syncSwitch();
  const first = readHash().uid;
  // A regest named in the address opens once the checks are read (or have failed), so its card
  // carries the flagged steps like one opened later; the card is rendered once.
  if (first) checksLoaded.then(() => requestAnimationFrame(() => detail.open(first, { push: false })));

  return {
    element: frame.root,
    full: true,
    open: (u) => detail.open(u),
    dispose() {
      unsubscribe();
      frame.dispose();
      list.dispose();
      detail.dispose();
      window.removeEventListener("popstate", onMode);
      cube?.dispose();
      decades?.dispose();
    },
  };
}
