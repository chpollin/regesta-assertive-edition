/**
 * Zeitband: who is named when. One row per person of the register: a light span joins mentions
 * at most GAP years apart, and a small square per year in one ink, darker the more regesta of
 * that year name the person; the exact regest and year stand in the status line on pointing.
 * The axis spans the years of the shown persons' mentions within the chosen time range.
 *
 * Design round of 2026-11-18 (operator: „nicht die ganze Fläche genutzt … unruhig“): rows
 * follow the available height within a readable range, the axis is fitted to the data, the
 * ticks and hairlines became spans and year squares, the name column is wider, the names keep
 * one ink (the accent for names also found in the run's statements carried no visible meaning),
 * the years south of the Alps are named at the axis, and order and number are two small
 * labelled selects apart from the switch of the representations.
 *
 * Asked for by the operator on 2026-11-11 as one of several views on the same data
 * („Möglichkeitenräume, also mehrere Views“, verbatim in knowledge/ui-feedback.md); the
 * coordination's space-time cube study recommends it as the time projection of the persons.
 * The data is the deterministic layer of build_holdings.py: register persons named in at
 * least three regesta, no LLM.
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
import { t } from "./i18n.js";

// Row height: the rows share the available height, between 20 and 30 px with a pointer and
// at least 28 px on a narrow touch screen, where a row is a target.
const rowHeight = (avail, n) => {
  const min = matchMedia("(max-width: 40rem)").matches ? 28 : 20;
  return Math.max(min, Math.min(30, Math.floor(avail / Math.max(1, n))));
};
const AXIS = 34;
const ORDERS = Object.freeze(Object.fromEntries(["anzahl", "zeit", "name"].map((key) => [key, t(`tb.order.${key}`)])));
// Two mentions further apart than GAP years are not joined: a line from the first to the
// last mention claimed presence in between (Wibald from 1123 to 1150, reviewed 2026-11-12).
const GAP = 3;
// South of this latitude and east of this longitude a place of issue counts as Italian; the
// Alps run along about 46.3 degrees north between 6.5 and 13.5 east. Deliberate rough line.
const ITALY = { lat: 46.3, lon: 6.5 };
// The first choice fits the first screen at 1280 x 800 without scrolling.
const LIMITS = [30, 120, 400];

/**
 * @param {import("./app.js").Store} store
 * @param {{filters: any, mentionOn: (u: string) => boolean, onPerson: (id: string) => void, onOpen: (u: string) => void}} options
 */
export function renderTimeband(store, options) {
  const { filters } = options;
  const H = store.holdings;
  const byUid = new Map(H.regesta.map((r) => [r.u, r]));
  const persons = Object.entries(H.persons).map(([id, p]) => ({
    id,
    label: p.l,
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
  const scroller = h("div", { class: "tb-scroll", tabindex: "0", role: "group", "aria-label": t("tb.aria") });
  const element = h(
    "section",
    { class: "canvas views-tb" },
    axisHost,
    scroller,
    status,
  );

  let scene = null;
  let shown = [];
  let ROW = 20;

  /** Names are cut to the name column; the full name stays in the sidebar and the status line. */
  const measure = document.createElement("canvas").getContext("2d");
  function fit(text, width) {
    measure.font = `12.5px ${getComputedStyle(element).getPropertyValue("--font-ui") || "sans-serif"}`;
    if (measure.measureText(text).width <= width) return text;
    let t = text;
    while (t.length > 1 && measure.measureText(`${t}…`).width > width) t = t.slice(0, -1);
    return `${t.trimEnd()}…`;
  }

  /**
   * The time axis spans the years of the shown mentions within the chosen range, with a year of
   * room on each side, so the empty decades before the first mention take no width. A few early
   * outliers (Wibald and Konrad III. in the 1120s) would stretch it again, so it starts at the
   * first percentile of the mentions, or at the chosen person's first mention if earlier; the
   * mentions before stand as one mark at the row's start.
   */
  function geometry(width, top) {
    const nameW = Math.round(Math.min(290, Math.max(120, width * 0.24)));
    const x0 = nameW + 12;
    const x1 = width - 14;
    const years = top.flatMap((r) => r.hits.map((m) => m.y)).sort((a, b) => a - b);
    // The chosen person's own mentions are never cut off.
    const chosen = top.find((r) => r.p.id === state.person);
    const first = Math.min(years[Math.floor(years.length * 0.01)], chosen ? chosen.hits[0].y : Infinity);
    const lo = years.length ? Math.max(filters.from, Math.floor(first) - 1) : filters.from;
    const hi = years.length ? Math.min(filters.to + 1, Math.floor(years.at(-1)) + 2) : filters.to + 1;
    const x = (year) => x0 + ((Math.min(hi, Math.max(lo, year)) - lo) / (hi - lo)) * (x1 - x0);
    return { nameW, x0, x1, x, lo, hi };
  }

  function draw() {
    const width = Math.max(280, scroller.clientWidth);
    const { top } = rows();
    const g = geometry(width, top);
    shown = top;
    ROW = rowHeight(scroller.clientHeight - 16, top.length);
    const height = top.length * ROW + 8;
    // The year axis stays above the scrolling rows.
    const axis = s("svg", { width, height: AXIS, class: "tb-svg", "aria-hidden": "true" });
    const svg = s("svg", { width, height, class: "tb-svg", "aria-hidden": "true" });
    const grid = s("g", { class: "tb-grid" });
    const body = s("g");
    const overlay = s("g", { class: "tb-overlay" });
    svg.append(grid, body, overlay);
    // About one year label per 70 pixels, on round years.
    const span = g.hi - g.lo;
    const step = [1, 2, 5, 10, 20].find((n) => ((g.x1 - g.x0) / span) * n >= 70) ?? 20;
    // The years south of the Alps as pale bands, named at the axis where a band has room.
    for (const [a, b] of italyYears) {
      if (b < g.lo || a >= g.hi) continue;
      const xa = g.x(Math.max(a, g.lo));
      const w = Math.max(1, g.x(Math.min(b + 1, g.hi)) - xa);
      grid.append(s("rect", { class: "tb-italy", x: xa, y: 0, width: w, height }));
      axis.append(s("rect", { class: "tb-italy", x: xa, y: 0, width: w, height: AXIS }));
      if (w >= 44) axis.append(s("text", { class: "tb-italy-label", x: xa + w / 2, y: 11, "text-anchor": "middle", text: t("tb.italy") }));
    }
    for (let y = Math.ceil(g.lo / step) * step; y < g.hi; y += step) {
      grid.append(s("line", { x1: g.x(y), x2: g.x(y), y1: 0, y2: height }));
      axis.append(s("text", { class: "tb-year", x: g.x(y), y: AXIS - 7, "text-anchor": "middle", text: String(y) }));
    }
    const yearW = Math.max(2, (g.x1 - g.x0) / span - 1);
    const cell = Math.min(8, ROW - 10);
    const rowEls = top.map(({ p, hits }, i) => {
      const y = i * ROW + ROW / 2 + 4;
      const row = s("g", { class: "tb-row", "data-id": p.id });
      row.append(s("rect", { class: "tb-row-bg", x: 0, y: y - ROW / 2, width, height: ROW }));
      row.append(s("text", { class: "tb-name", x: g.nameW, y: y + 4, "text-anchor": "end", text: fit(p.label, g.nameW - 6) }, s("title", { text: p.label })));
      // A light span joins mentions closer than GAP years; a longer silence stays open.
      let from = null;
      let to = null;
      const flush = () => from !== null && row.append(s("rect", { class: "tb-life", x: g.x(from), y: y - 2, width: Math.max(1, g.x(to) - g.x(from)), height: 4, rx: 2 }));
      const early = hits.filter((m) => m.y < g.lo);
      // A small chevron, drawn rather than written, so it stays a mark and not a label.
      if (early.length) row.append(s("path", { class: "tb-early", d: `M${(g.x0 - 3).toFixed(1)} ${y - 3.5}l-3.5 3.5l3.5 3.5` }, s("title", { text: t("tb.early", { n: early.length, year: g.lo }) })));
      for (const m of hits.filter((x) => x.y >= g.lo)) {
        if (to !== null && m.y - to <= GAP) to = m.y;
        else {
          flush();
          from = to = m.y;
        }
      }
      flush();
      // One square per year with mentions, its ink darker the more regesta of the year.
      const perYear = new Map();
      for (const m of hits) if (m.y >= g.lo) perYear.set(Math.floor(m.y), (perYear.get(Math.floor(m.y)) ?? 0) + 1);
      const w = Math.min(yearW, cell + 2);
      for (const [yr, n] of perYear) row.append(s("rect", { class: `tb-cell is-${Math.min(4, n)}`, x: g.x(yr + 0.5) - w / 2, y: y - cell / 2, width: w, height: cell, rx: 1 }));
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
    return `${p.label}, ${t("count.regesta", { n: hits.length })}, ${t("band.span", { from: Math.floor(hits[0].y), to: Math.floor(hits.at(-1).y) })}`;
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

  // Order and number of rows, in the tool row of Personen beside the switch: two small labelled
  // selects, so they do not read as a second switch of the representations.
  const controls = h("div", { class: "tb-controls" });
  function renderControls() {
    const { named } = rows();
    controls.replaceChildren(
      h(
        "label",
        { class: "tb-control" },
        h("span", { text: t("tb.orderBy") }),
        h(
          "select",
          { class: "tb-limit", onchange: (e) => setting("order", e.target.value) },
          Object.entries(ORDERS).map(([key, label]) => h("option", { value: key, text: label, selected: state.order === key })),
        ),
      ),
      h(
        "select",
        { class: "tb-limit", "aria-label": t("tb.limitAria"), onchange: (e) => setting("limit", Number(e.target.value)) },
        LIMITS.filter((n, i) => i === 0 || LIMITS[i - 1] < named.length).map((n) => h("option", { value: String(n), text: n >= named.length ? t("tb.all", { n: named.length }) : t("tb.top", { n }), selected: n === state.limit })),
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
    return [
      h("p", { text: t("tb.info.cells", { gap: GAP }) }),
      italyYears.length ? h("p", {}, h("span", { class: "it-key tb-key-italy", "aria-hidden": "true" }), ` ${t("tb.info.italy")}`) : null,
      h("p", { text: t("tb.info.source") }),
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
