/**
 * Zeitband: who is named when. One row per person of the register, a thin line from the
 * first to the last mention and a tick per regest, over the years of the whole delivery.
 *
 * Asked for by the operator on 2026-11-11 as one of several views on the same data
 * („Möglichkeitenräume, also mehrere Views“, verbatim in knowledge/ui-feedback.md); the
 * coordination's space-time cube study recommends it as the time projection of the persons.
 * The data is the deterministic layer of build_holdings.py: register persons named in at
 * least three regesta, no LLM. A name in the accent also appears in the statements of the
 * run, matched by its register id.
 *
 * The second representation of Personen (js/persons.js), which owns the filter bar, the list
 * and the opened regest. A mention counts when its regest passes the facets (js/selection.js),
 * so the rows are the persons named in the regesta of the selection; the chosen person (the
 * Person facet) is the marked row. The drawing is aria-hidden; every regest is reachable
 * through the list of the bar, every person through the Person facet.
 */
import { h } from "./dom.js";
import { s, yearOf } from "./svg.js";
import { param, writeAddress } from "./url.js";

// Row height: 20 px with a pointer, 28 px on a narrow touch screen, where a row is a target.
const rowHeight = () => (matchMedia("(max-width: 40rem)").matches ? 28 : 20);
const AXIS = 22;
const ORDERS = Object.freeze({ anzahl: "Häufigkeit", zeit: "Erste Nennung", name: "Name" });
// Two mentions further apart than GAP years are not joined: a line from the first to the
// last mention claimed presence in between (Wibald from 1123 to 1150, reviewed 2026-11-12).
const GAP = 3;
// South of this latitude and east of this longitude a place of issue counts as Italian; the
// Alps run along about 46.3 degrees north between 6.5 and 13.5 east. Deliberate rough line.
const ITALY = { lat: 46.3, lon: 6.5 };
// The first choice fits the first screen at 1280 x 800 without scrolling.
const LIMITS = [30, 120, 400];
const ACTOR = "urn:regesta:actor:";

/**
 * @param {import("./app.js").Store} store
 * @param {{filters: any, mentionOn: (u: string) => boolean, onPerson: (id: string) => void, onOpen: (u: string) => void}} options
 */
export function renderTimeband(store, options) {
  const { filters } = options;
  const H = store.holdings;
  const byUid = new Map(H.regesta.map((r) => [r.u, r]));
  const inRun = new Set(store.edition.graph.nodes.filter((n) => n.kind !== "act" && n.id.startsWith(ACTOR)).map((n) => n.id.slice(ACTOR.length)));
  const persons = Object.entries(H.persons).map(([id, p]) => ({
    id,
    label: p.l,
    run: inRun.has(id),
    mentions: p.r
      .map((u) => byUid.get(u))
      .filter(Boolean)
      .map((r) => ({ u: r.u, i: r.i, y: yearOf(r.s), place: r.p ? H.places[r.p]?.l : null }))
      .sort((a, b) => a.y - b.y),
  }));
  const byId = new Map(persons.map((p) => [p.id, p]));
  // Years in Italy, from the delivery itself: years with at least three places of issue of
  // which more than half lie south of the Alps, joined into runs of consecutive years.
  const italyYears = (() => {
    const per = new Map();
    for (const r of H.regesta) {
      const place = r.p ? H.places[r.p] : null;
      if (!place) continue;
      const y = Math.floor(yearOf(r.s));
      const c = per.get(y) ?? { all: 0, it: 0 };
      c.all += 1;
      if (place.la < ITALY.lat && place.lo > ITALY.lon) c.it += 1;
      per.set(y, c);
    }
    const years = [...per].filter(([, c]) => c.all >= 3 && c.it / c.all > 0.5).map(([y]) => y).sort((a, b) => a - b);
    const runs = [];
    for (const y of years) {
      if (runs.length && runs.at(-1)[1] === y - 1) runs.at(-1)[1] = y;
      else runs.push([y, y]);
    }
    return runs;
  })();
  const state = {
    person: null,
    order: ["zeit", "name"].includes(param("ordnung")) ? param("ordnung") : "anzahl",
    limit: LIMITS.includes(Number(param("zeige"))) ? Number(param("zeige")) : LIMITS[0],
    pointed: null,
    opened: null,
  };

  const inRange = (m) => options.mentionOn(m.u);
  /** The rows in their order: the most named persons of the time range, then sorted. */
  function rows() {
    const named = persons.map((p) => ({ p, hits: p.mentions.filter(inRange) })).filter((r) => r.hits.length);
    named.sort((a, b) => b.hits.length - a.hits.length || a.p.label.localeCompare(b.p.label, "de"));
    const top = named.slice(0, state.limit);
    if (state.person && !top.some((r) => r.p.id === state.person)) {
      const chosen = named.find((r) => r.p.id === state.person);
      if (chosen) top.push(chosen);
    }
    if (state.order === "zeit") top.sort((a, b) => a.hits[0].y - b.hits[0].y || b.hits.length - a.hits.length);
    if (state.order === "name") top.sort((a, b) => a.p.label.localeCompare(b.p.label, "de"));
    return { named, top };
  }

  const status = h("p", { class: "canvas-status", role: "status", "aria-live": "polite" });
  const axisHost = h("div", { class: "tb-axis" });
  const scroller = h("div", { class: "tb-scroll", tabindex: "0", role: "group", "aria-label": "Zeitband der Personen. Die Regesten stehen in der Liste links, die Personen in der Personensuche." });
  const element = h(
    "section",
    { class: "canvas views-tb" },
    axisHost,
    scroller,
    status,
  );

  let scene = null;
  let shown = [];
  let ROW = rowHeight();

  /** Names are cut to the name column; the full name stays in the sidebar and the status line. */
  const measure = document.createElement("canvas").getContext("2d");
  function fit(text, width) {
    measure.font = `12.5px ${getComputedStyle(element).getPropertyValue("--font-ui") || "sans-serif"}`;
    if (measure.measureText(text).width <= width) return text;
    let t = text;
    while (t.length > 1 && measure.measureText(`${t}…`).width > width) t = t.slice(0, -1);
    return `${t.trimEnd()}…`;
  }

  /** The time axis spans the chosen range, so a narrow range is read at full width. */
  function geometry(width) {
    const nameW = Math.round(Math.min(210, Math.max(110, width * 0.3)));
    const x0 = nameW + 10;
    const x1 = width - 14;
    const [lo, hi] = [filters.from, filters.to + 1];
    const x = (year) => x0 + ((Math.min(hi, Math.max(lo, year)) - lo) / (hi - lo)) * (x1 - x0);
    return { nameW, x0, x1, x };
  }

  function draw() {
    const width = Math.max(280, scroller.clientWidth);
    const g = geometry(width);
    const { top } = rows();
    shown = top;
    ROW = rowHeight();
    const height = top.length * ROW + 8;
    // The year axis stays above the scrolling rows.
    const axis = s("svg", { width, height: AXIS, class: "tb-svg", "aria-hidden": "true" });
    const svg = s("svg", { width, height, class: "tb-svg", "aria-hidden": "true" });
    const grid = s("g", { class: "tb-grid" });
    const body = s("g");
    const overlay = s("g", { class: "tb-overlay" });
    svg.append(grid, body, overlay);
    // About one year label per 70 pixels, on round years.
    const span = filters.to + 1 - filters.from;
    const step = [1, 2, 5, 10, 20].find((n) => ((g.x1 - g.x0) / span) * n >= 70) ?? 20;
    for (const [a, b] of italyYears) {
      if (b < filters.from || a > filters.to) continue;
      const xa = g.x(Math.max(a, filters.from));
      grid.append(s("rect", { class: "tb-italy", x: xa, y: 0, width: Math.max(1, g.x(Math.min(b, filters.to) + 1) - xa), height }));
      axis.append(s("rect", { class: "tb-italy", x: xa, y: 0, width: Math.max(1, g.x(Math.min(b, filters.to) + 1) - xa), height: AXIS }));
    }
    for (let y = Math.ceil(filters.from / step) * step; y <= filters.to; y += step) {
      grid.append(s("line", { x1: g.x(y), x2: g.x(y), y1: 0, y2: height }));
      axis.append(s("text", { class: "tb-year", x: g.x(y), y: AXIS - 7, "text-anchor": "middle", text: String(y) }));
    }
    const rowEls = top.map(({ p, hits }, i) => {
      const y = i * ROW + ROW / 2 + 4;
      const row = s("g", { class: "tb-row", "data-id": p.id });
      row.append(s("rect", { class: "tb-row-bg", x: 0, y: y - ROW / 2, width, height: ROW }));
      row.append(s("text", { class: p.run ? "tb-name is-run" : "tb-name", x: g.nameW, y: y + 4, "text-anchor": "end", text: fit(p.label, g.nameW - 6) }));
      // Mentions closer than GAP years are joined; a longer silence stays open.
      for (const [a, b] of p.mentions.slice(1).map((m, k) => [p.mentions[k].y, m.y])) {
        if (b - a <= GAP) row.append(s("line", { class: "tb-life", x1: g.x(a), x2: Math.max(g.x(b), g.x(a) + 1), y1: y, y2: y }));
      }
      for (const m of hits) row.append(s("line", { class: "tb-tick", x1: g.x(m.y), x2: g.x(m.y), y1: y - 4, y2: y + 4 }));
      body.append(row);
      return { row, y, hits };
    });
    axisHost.replaceChildren(axis);
    scroller.replaceChildren(svg);
    scene = { g, rowEls, overlay, width };
    mark();
  }

  /** Selection, pointed tick and opened regest, without rebuilding the rows. */
  function mark() {
    if (!scene) return;
    for (const [i, { row }] of scene.rowEls.entries()) row.classList.toggle("is-selected", shown[i].p.id === state.person);
    scene.overlay.replaceChildren();
    for (const [hit, cls] of [
      [state.opened, "tb-opened"],
      [state.pointed, "tb-pointed"],
    ]) {
      if (!hit || !inRange(hit.m)) continue;
      const i = shown.findIndex((r) => r.p.id === hit.person);
      if (i < 0) continue;
      scene.overlay.append(s("circle", { class: cls, cx: scene.g.x(hit.m.y), cy: scene.rowEls[i].y, r: 5 }));
    }
  }

  /** The row and the tick under the pointer; a tick counts within a few pixels. */
  function hitAt(event) {
    if (!scene) return null;
    const r = scroller.firstElementChild.getBoundingClientRect();
    const px = event.clientX - r.left;
    const i = Math.floor((event.clientY - r.top - 4) / ROW);
    if (i < 0 || i >= shown.length) return null;
    const { p } = shown[i];
    let best = null;
    let dist = 6;
    for (const m of p.mentions) {
      const d = Math.abs(scene.g.x(m.y) - px);
      if (d < dist && inRange(m)) {
        dist = d;
        best = m;
      }
    }
    return { person: p.id, m: best };
  }

  function describe(hit) {
    if (!hit) return "";
    const p = byId.get(hit.person);
    if (hit.m) return `${hit.m.i}, ${Math.floor(hit.m.y)}${hit.m.place ? `, ${hit.m.place}` : ""}, ${p.label}`;
    const hits = p.mentions.filter(inRange);
    return `${p.label}, ${hits.length} ${hits.length === 1 ? "Regest" : "Regesten"}, ${Math.floor(hits[0].y)} bis ${Math.floor(hits.at(-1).y)}`;
  }

  function point(hit) {
    state.pointed = hit?.m ? hit : null;
    status.textContent = describe(hit);
    mark();
  }

  /** The chosen person of the Person facet is the marked row, scrolled into view. */
  function sync() {
    state.person = filters.persons.find((id) => byId.has(id)) ?? null;
    draw();
    if (state.person) {
      const i = shown.findIndex((r) => r.p.id === state.person);
      if (i >= 0) scroller.scrollTo({ top: Math.max(0, i * ROW - scroller.clientHeight / 3) });
    }
  }

  function openRegest(person, m) {
    state.opened = { person, m };
    mark();
    options.onOpen(m.u);
  }

  scroller.addEventListener("pointermove", (e) => point(hitAt(e)));
  scroller.addEventListener("pointerleave", () => point(null));
  scroller.addEventListener("click", (e) => {
    const hit = hitAt(e);
    if (!hit) return;
    if (hit.m) openRegest(hit.person, hit.m);
    else options.onPerson(hit.person);
  });

  function setting(key, value) {
    state[key] = value;
    if (key === "order") writeAddress({ ordnung: value !== "anzahl" ? value : null });
    else writeAddress({ zeige: value !== LIMITS[0] ? value : null });
    draw();
    renderControls();
  }

  // Order and number of rows, in the tool row of Personen beside the switch.
  const controls = h("div", { class: "tb-controls" });
  function renderControls() {
    const { named } = rows();
    controls.replaceChildren(
      h(
        "div",
        { class: "segs", role: "group", "aria-label": "Reihenfolge" },
        Object.entries(ORDERS).map(([key, label]) => h("button", { type: "button", class: "seg", "aria-pressed": String(state.order === key), onclick: () => setting("order", key) }, label)),
      ),
      h(
        "select",
        { class: "tb-limit", "aria-label": "Anzahl der gezeigten Personen", onchange: (e) => setting("limit", Number(e.target.value)) },
        LIMITS.filter((n, i) => i === 0 || LIMITS[i - 1] < named.length).map((n) => h("option", { value: String(n), text: n >= named.length ? `alle ${named.length}` : `${n} meistgenannte`, selected: n === state.limit })),
      ),
    );
  }

  const unsubscribe = filters.onChange(() => {
    sync();
    renderControls();
  });
  let lastWidth = 0;
  const observer = new ResizeObserver(() => {
    if (scroller.clientWidth && scroller.clientWidth !== lastWidth) {
      lastWidth = scroller.clientWidth;
      draw();
    }
  });
  observer.observe(scroller);
  // Names are cut with the loaded face, so draw again once the fonts are there.
  document.fonts?.ready.then(() => scene && draw());
  renderControls();
  requestAnimationFrame(sync);

  /** The key of the band's two encodings, for the info mark of Personen. */
  function key() {
    const runShown = shown.filter((r) => r.p.run).length;
    return [
      h("p", {}, h("span", { class: "tb-key-name", text: "Namen in Türkis" }), ` stehen auch in Aussagen der LLM-Agenten (${runShown} der gezeigten).`),
      italyYears.length ? h("p", {}, h("span", { class: "it-key tb-key-italy", "aria-hidden": "true" }), " Jahre mit mehr als der Hälfte der Ausstellungsorte südlich der Alpen.") : null,
      h("p", { text: `Ein Strich je Nennung; eine Linie verbindet Nennungen, die höchstens ${GAP} Jahre auseinanderliegen. Personen aus dem Register der Regesta Imperii, in mindestens drei Regesten genannt, ohne LLM.` }),
    ];
  }

  return {
    element,
    controls,
    key,
    unmark() {
      state.opened = null;
      mark();
    },
    dispose: () => observer.disconnect(),
  };
}
