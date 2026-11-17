/**
 * Jahrzehnte: where the court was in which decade. The same map of the places of issue once
 * per decade, side by side, a dot per place sized by its regesta in that decade.
 *
 * Asked for by the operator on 2026-11-11 as one of several views on the same data
 * („Möglichkeitenräume, also mehrere Views“, verbatim in knowledge/ui-feedback.md); the
 * coordination's space-time cube study recommends small multiples as the projection that
 * compares periods, which the cube shows only by rotating. Every panel uses the same map and
 * one size scale for all decades, so sizes compare across panels. The data is the
 * deterministic layer of build_holdings.py (place of issue and coordinate from the register,
 * no LLM).
 *
 * Filters on the left, the panels in the middle, the regest on the right on demand. The
 * drawing is aria-hidden; decades, places and regesta are reachable through the sidebar.
 */
import { h } from "./dom.js";
import { timeBand } from "./sidebar.js";
import { renderRegestCard } from "./regest-card.js";
import { focusKey } from "./timeband.js";
import { s, yearOf } from "./svg.js";
import { mapProjection } from "./map.js";
import { param, writeAddress } from "./url.js";

const NOTE = "Ort und Datum aus der Lieferung der Regesta Imperii, Koordinate aus ihrem Register, ohne LLM.";

// A decade with fewer regesta than MIN_PANEL joins its neighbour: the 1130s hold three, which
// made an almost empty map (reviewed 2026-11-12).
const MIN_PANEL = 10;
// How many places a panel names at most, the largest first, none over another name.
const NAMED = 4;

/**
 * @param {import("./app.js").Store} store
 * @param {{place?: string|null, decade?: number|null, filters: any, detail?: {show: (el: Element) => void, hide: () => void}, texts?: () => Promise<Record<string, string>>}} options
 */
export function renderDecades(store, options) {
  const { filters } = options;
  const H = store.holdings;
  const places = H.places;
  const raw = H.regesta
    .filter((r) => r.p && places[r.p])
    .map((r) => {
      const y = yearOf(r.s);
      return { u: r.u, i: r.i, p: r.p, y, d: Math.floor(y / 10) * 10 };
    });
  // Panels: decades, with thin ones merged into the neighbour towards the middle.
  const perDecade = new Map();
  for (const p of raw) perDecade.set(p.d, (perDecade.get(p.d) ?? 0) + 1);
  const allDecades = [...perDecade.keys()].sort((a, b) => a - b);
  const groupOf = new Map(allDecades.map((d) => [d, d]));
  const span = new Map(allDecades.map((d) => [d, [d, d]]));
  for (const [i, d] of allDecades.entries()) {
    if (perDecade.get(d) >= MIN_PANEL || allDecades.length < 2) continue;
    const into = groupOf.get(i === 0 ? allDecades[1] : allDecades[i - 1]);
    groupOf.set(d, into);
    const sp = span.get(into);
    span.set(into, [Math.min(sp[0], d), Math.max(sp[1], d)]);
  }
  const points = raw.map((p) => ({ ...p, d: groupOf.get(p.d) }));
  const decades = [...new Set(points.map((p) => p.d))].sort((a, b) => a - b);
  const decadeLabel = (d) => (span.get(d)[0] === span.get(d)[1] ? `${d}er` : `${span.get(d)[0]}er und ${span.get(d)[1]}er`);
  // The panel in which a place first appears as a place of issue: its dot is dark there and
  // light in later panels, so new places stand apart from returns.
  const firstPanel = new Map();
  for (const p of [...points].sort((a, b) => a.y - b.y)) if (!firstPanel.has(p.p)) firstPanel.set(p.p, p.d);
  const askedDecade = Number(options.decade ?? param("jahrzehnt"));
  const state = { place: options.place ?? null, decade: decades.includes(askedDecade) ? askedDecade : null, pointed: null, opened: null };

  // The map is the itinerary's (js/map.js), its undistorted core within radius one.
  const { mapXZ, inCore } = mapProjection(points, places);
  const placeXZ = new Map(Object.entries(places).map(([id, p]) => [id, mapXZ(p.lo, p.la)]));
  const used = [...new Set(points.map((p) => p.p))].map((id) => placeXZ.get(id));
  const bounds = {
    x0: Math.min(...used.map((q) => q[0])),
    x1: Math.max(...used.map((q) => q[0])),
    z0: Math.min(...used.map((q) => q[1])),
    z1: Math.max(...used.map((q) => q[1])),
  };

  // One size scale for every panel: the largest count of any place in any decade.
  const countAll = new Map();
  for (const p of points) countAll.set(`${p.d}|${p.p}`, (countAll.get(`${p.d}|${p.p}`) ?? 0) + 1);
  const maxCount = Math.max(...countAll.values());

  const inRange = (p) => filters.inYear(Math.floor(p.y));
  const decadeOn = (d) => filters.from <= d + 9 && filters.to >= d;
  /** Regesta per place in one decade, restricted to the time range. */
  function counts(d) {
    const out = new Map();
    for (const p of points) if (p.d === d && inRange(p)) out.set(p.p, (out.get(p.p) ?? 0) + 1);
    return out;
  }

  const status = h("p", { class: "canvas-status", role: "status", "aria-live": "polite" });
  const host = h("div", { class: "dc-scene", role: "group", "aria-label": "Karten der Ausstellungsorte je Jahrzehnt. Jahrzehnte, Orte und Regesten sind in der Seitenleiste mit der Tastatur erreichbar." });
  const element = h(
    "section",
    { class: "canvas views-dc", "aria-labelledby": "dc-title" },
    h("h1", { id: "dc-title", class: "visually-hidden", text: "Jahrzehnte: Ausstellungsorte der Regesten je Jahrzehnt auf der Karte" }),
    host,
    status,
  );

  let basemap = null;
  fetch(new URL("./basemap.json", import.meta.url))
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      basemap = data;
      draw();
    })
    .catch(() => {});
  // The Empire about 1190, as in the itinerary (build_realm.py), a soft area under the map.
  let realm = null;
  fetch(new URL("./realm.json", import.meta.url))
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      realm = data;
      draw();
    })
    .catch(() => {});

  let scene = null;

  /** A place name beside its dot, on the left side where the right would leave the panel. */
  function nameAt(text, q, right) {
    const w = text.length * 6.6;
    const fitsRight = q.x + q.r + 4 + w <= right;
    return s("text", { class: "sp-label", x: (fitsRight ? q.x + q.r + 4 : q.x - q.r - 4).toFixed(1), y: (q.y + 4).toFixed(1), "text-anchor": fitsRight ? "start" : "end", text });
  }

  /** Columns and cell size that give the largest map for the drawing area. */
  function layout(width, height) {
    const cells = decades.length + 1;
    const pad = 10;
    const mapW = bounds.x1 - bounds.x0;
    const mapH = bounds.z1 - bounds.z0;
    let best = null;
    for (let cols = 1; cols <= cells; cols += 1) {
      const rowsN = Math.ceil(cells / cols);
      const cw = width / cols;
      const ch = height / rowsN;
      const scale = Math.min((cw - 2 * pad) / mapW, (ch - 2 * pad - 16) / mapH);
      if (!best || scale > best.scale) best = { cols, rowsN, cw, ch, scale };
    }
    return { ...best, pad };
  }

  function draw() {
    const width = Math.max(260, host.clientWidth);
    const height = Math.max(240, host.clientHeight - 24);
    if (!host.clientWidth) return;
    const L = layout(width, height);
    const svg = s("svg", { width, height, viewBox: `0 0 ${width} ${height}`, class: "dc-svg", "aria-hidden": "true" });
    const rMax = Math.max(5, Math.min(16, Math.min(L.cw, L.ch) * 0.065));
    const defs = s("defs");
    const blur = s("filter", { id: "dc-realm-soft", x: "-5%", y: "-5%", width: "110%", height: "110%" });
    blur.append(s("feGaussianBlur", { stdDeviation: 1.5 }));
    defs.append(blur);
    svg.append(defs);
    const radius = (n) => Math.max(1.6, rMax * Math.sqrt(n / maxCount));
    const panels = decades.map((d, idx) => {
      const col = idx % L.cols;
      const row = Math.floor(idx / L.cols);
      const ox = col * L.cw;
      const oy = row * L.ch;
      // North up: z grows to the north, the screen y downwards.
      const mapW = (bounds.x1 - bounds.x0) * L.scale;
      const mapH = (bounds.z1 - bounds.z0) * L.scale;
      const left = ox + (L.cw - mapW) / 2;
      const top = oy + 16 + (L.ch - 16 - mapH) / 2;
      const at = ([x, z]) => [left + (x - bounds.x0) * L.scale, top + (bounds.z1 - z) * L.scale];
      const g = s("g", { class: decadeOn(d) ? "dc-panel" : "dc-panel is-out" });
      if (col > 0) g.append(s("line", { class: "dc-sep", x1: ox, x2: ox, y1: oy + 6, y2: oy + L.ch - 6 }));
      if (row > 0) g.append(s("line", { class: "dc-sep", x1: ox + 6, x2: ox + L.cw - 6, y1: oy, y2: oy }));
      const mapG = s("g");
      g.append(mapG);
      if (realm) {
        // The undistorted core is a circle of radius one in map units; the area is cut to it.
        const id = `dc-core-${d}`;
        const [cx, cy] = at([0, 0]);
        const clip = s("clipPath", { id });
        clip.append(s("circle", { cx: cx.toFixed(1), cy: cy.toFixed(1), r: L.scale.toFixed(1) }));
        defs.append(clip);
        const pts = realm.ring.map(([lon, lat]) => at(mapXZ(lon, lat)).map((v) => v.toFixed(1)).join(","));
        mapG.append(s("polygon", { class: "it-realm", points: pts.join(" "), "clip-path": `url(#${id})`, filter: "url(#dc-realm-soft)" }));
      }
      if (basemap) {
        const drawLine = (coords, cls) => {
          let run = [];
          const flush = () => {
            if (run.length > 1) mapG.append(s("polyline", { class: cls, points: run.join(" ") }));
            run = [];
          };
          for (const [lon, lat] of coords) {
            if (!inCore(lon, lat)) {
              flush();
              continue;
            }
            const [x, y] = at(mapXZ(lon, lat));
            run.push(`${x.toFixed(1)},${y.toFixed(1)}`);
          }
          flush();
        };
        for (const c of basemap.coast) drawLine(c, "it-coast");
        for (const r of basemap.rivers) drawLine(r, "it-river");
      }
      const n = counts(d);
      const dots = s("g");
      const order = [...n.entries()].sort((a, b) => b[1] - a[1]);
      const screen = new Map();
      for (const [id, c] of order) {
        const [x, y] = at(placeXZ.get(id));
        screen.set(id, { x, y, r: radius(c), n: c });
        dots.append(s("circle", { class: firstPanel.get(id) === d ? "dc-dot is-new" : "dc-dot", "data-place": id, cx: x.toFixed(1), cy: y.toFixed(1), r: radius(c).toFixed(1) }));
      }
      g.append(dots);
      const label = s("text", { class: "dc-label", x: ox + L.pad, y: oy + 16, text: decadeLabel(d) });
      g.append(label);
      // The places with most regesta of the decade are named, up to NAMED, each only where it
      // overlaps neither another name nor the panel edge, so each panel reads alone.
      const lead = order[0];
      const taken = [{ x0: ox, x1: ox + 150, y0: oy, y1: oy + 20 }];
      let leadLabel = null;
      const named = new Set();
      for (const [id] of order.slice(0, L.cw < 260 ? 2 : NAMED)) {
        const q = screen.get(id);
        const text = places[id].l;
        const w = text.length * 6.6;
        for (const right of [true, false]) {
          const x0 = right ? q.x + q.r + 4 : q.x - q.r - 4 - w;
          const box = { x0, x1: x0 + w, y0: q.y - 8, y1: q.y + 6 };
          if (box.x0 < ox + 2 || box.x1 > ox + L.cw - 4 || taken.some((o) => o.x0 < box.x1 && box.x0 < o.x1 && o.y0 < box.y1 && box.y0 < o.y1)) continue;
          taken.push(box);
          const t = s("text", { class: "sp-label", x: (right ? box.x0 : box.x1).toFixed(1), y: (q.y + 4).toFixed(1), "text-anchor": right ? "start" : "end", text });
          g.append(t);
          named.add(id);
          if (id === lead?.[0]) leadLabel = t;
          break;
        }
      }
      const marks = s("g", { class: "dc-marks" });
      g.append(marks);
      svg.append(g);
      const right = ox + L.cw - 4;
      return { d, g, ox, oy, at, screen, dots, label, leadLabel, named, lead: lead?.[0] ?? null, marks, right };
    });
    // The size key fills the cell after the last decade.
    const ki = decades.length;
    const kx = (ki % L.cols) * L.cw + L.pad;
    const ky = Math.floor(ki / L.cols) * L.ch;
    const key = s("g", { class: "dc-key" });
    const values = [...new Set([1, 10, Math.round(maxCount / 2), maxCount])].filter((v) => v <= maxCount);
    let cx = kx + rMax;
    const base = ky + 16 + Math.min(L.ch * 0.45, rMax * 2 + 20);
    for (const v of values) {
      const r = radius(v);
      key.append(s("circle", { class: "dc-dot", cx: cx.toFixed(1), cy: (base - r).toFixed(1), r: r.toFixed(1) }));
      key.append(s("text", { class: "tb-year", x: cx.toFixed(1), y: (base + 14).toFixed(1), "text-anchor": "middle", text: String(v) }));
      cx += Math.max(2 * r, 18) + 12;
    }
    key.append(s("text", { class: "tb-year", x: kx, y: base + 30, text: "Regesten je Ort und Jahrzehnt" }));
    // Lightness tells new places from returns; one line each, a dot as sign.
    const ly = base + 52;
    key.append(s("circle", { class: "dc-dot is-new", cx: (kx + 5).toFixed(1), cy: (ly - 4).toFixed(1), r: 5 }));
    key.append(s("text", { class: "tb-year", x: kx + 16, y: ly, text: "Ort zum ersten Mal Ausstellungsort" }));
    key.append(s("circle", { class: "dc-dot", cx: (kx + 5).toFixed(1), cy: (ly + 14).toFixed(1), r: 5 }));
    key.append(s("text", { class: "tb-year", x: kx + 16, y: ly + 18, text: "schon in einem früheren Jahrzehnt" }));
    if (realm) {
      key.append(s("rect", { class: "it-realm dc-key-realm", x: kx, y: ly + 28, width: 10, height: 10, rx: 2 }));
      key.append(s("text", { class: "tb-year", x: kx + 16, y: ly + 37, text: "Reich um 1190 nach Shepherd" }));
    }
    svg.append(key);
    host.replaceChildren(svg);
    scene = { svg, L, panels };
    mark();
  }

  /** Selection, pointing and the opened regest, across all panels at once. */
  function mark() {
    if (!scene) return;
    for (const panel of scene.panels) {
      panel.label.classList.toggle("is-selected", panel.d === state.decade);
      for (const dot of panel.dots.children) dot.classList.toggle("is-selected", dot.dataset.place === state.place);
      panel.marks.replaceChildren();
      for (const [id, cls] of [
        [state.place, "dc-chosen"],
        [state.pointed, "dc-ring"],
      ]) {
        if (!id) continue;
        const q = panel.screen.get(id);
        const [x, y] = q ? [q.x, q.y] : panel.at(placeXZ.get(id));
        // Where the place has no regest in this decade, a small dotted ring says so.
        panel.marks.append(s("circle", { class: q ? cls : `${cls} is-absent`, cx: x.toFixed(1), cy: y.toFixed(1), r: ((q?.r ?? 2) + 3).toFixed(1) }));
        if (q && !panel.named.has(id) && cls === "dc-ring") panel.marks.append(nameAt(places[id].l, q, panel.right));
      }
      if (state.opened && state.opened.d === panel.d) {
        const q = panel.screen.get(state.opened.p);
        if (q) panel.marks.append(s("circle", { class: "dc-opened", cx: q.x.toFixed(1), cy: q.y.toFixed(1), r: (q.r + 5).toFixed(1) }));
      }
    }
  }

  /** The panel and the place under the pointer. */
  function hitAt(event) {
    if (!scene) return null;
    const r = scene.svg.getBoundingClientRect();
    const x = event.clientX - r.left;
    const y = event.clientY - r.top;
    const { L } = scene;
    const idx = Math.floor(y / L.ch) * L.cols + Math.floor(x / L.cw);
    const panel = scene.panels[idx];
    if (!panel || x > L.cols * L.cw) return null;
    let best = null;
    let dist = Infinity;
    for (const [id, q] of panel.screen) {
      const d = Math.hypot(q.x - x, q.y - y) - q.r;
      if (d < dist && d < 8) {
        dist = d;
        best = id;
      }
    }
    return { d: panel.d, place: best };
  }

  function describe(id) {
    if (!id) return "";
    const parts = decades
      .filter(decadeOn)
      .map((d) => [d, counts(d).get(id) ?? 0])
      .filter(([, n]) => n)
      .map(([d, n]) => `${decadeLabel(d)} ${n}`);
    return `${places[id].l}: ${parts.join(", ") || "keine Regesten im Zeitraum"}`;
  }

  function point(id) {
    if (id === state.pointed) return;
    state.pointed = id;
    status.textContent = describe(id);
    mark();
  }

  function select(place, decade = state.decade) {
    state.place = place;
    state.decade = decade;
    writeAddress({ jahrzehnt: decade }, `#/jahrzehnte${place ? `/${encodeURIComponent(place)}` : ""}`);
    mark();
    renderSide();
  }

  function openRegest(p) {
    state.opened = p;
    mark();
    options.detail?.show(
      renderRegestCard(store, p.u, {
        texts: options.texts,
        notes: [NOTE],
        onClose: () => {
          state.opened = null;
          mark();
          options.detail?.hide();
        },
      }),
    );
  }

  host.addEventListener("pointermove", (e) => point(hitAt(e)?.place ?? null));
  host.addEventListener("pointerleave", () => point(null));
  host.addEventListener("click", (e) => {
    const hit = hitAt(e);
    if (hit?.place) select(hit.place, hit.d);
  });

  // The sidebar: decade and place, the shared time band, the count, and the regesta of the
  // selected place in the selected decade (or in all decades).
  const aside = h("div", { class: "sidebar" });
  function renderSide() {
    const shown = points.filter((p) => inRange(p) && (state.decade === null || p.d === state.decade));
    const perPlace = new Map();
    for (const p of shown) perPlace.set(p.p, (perPlace.get(p.p) ?? 0) + 1);
    const decadePick = h(
      "select",
      { class: "side-select", "aria-label": "Jahrzehnt", onchange: (e) => select(state.place, e.target.value ? Number(e.target.value) : null) },
      h("option", { value: "", text: "Alle Jahrzehnte", selected: state.decade === null }),
      decades.map((d) => h("option", { value: String(d), text: decadeLabel(d), selected: d === state.decade, disabled: decadeOn(d) ? null : true })),
    );
    const placePick = h(
      "select",
      { class: "side-select", "aria-label": "Ausstellungsort", onchange: (e) => select(e.target.value || null) },
      h("option", { value: "", text: "Alle Ausstellungsorte", selected: !state.place }),
      [...perPlace.entries()]
        .sort((a, b) => b[1] - a[1] || places[a[0]].l.localeCompare(places[b[0]].l, "de"))
        .map(([id, n]) => h("option", { value: id, text: `${places[id].l} (${n})`, selected: id === state.place })),
      state.place && !perPlace.has(state.place) ? h("option", { value: state.place, text: `${places[state.place].l} (0)`, selected: true }) : null,
    );
    const atPlace = state.place ? shown.filter((p) => p.p === state.place).sort((a, b) => a.y - b.y) : [];
    const applies = filters.active() ? `${filters.from === filters.to ? `nur ${filters.from}` : `${filters.from} bis ${filters.to}`}. ` : null;
    const legend = h(
      "div",
      { class: "it-legend" },
      h("p", {}, h("span", { class: "it-key" }), h("span", { class: "it-n", text: String(state.place ? atPlace.length : shown.length) }), " Regesten mit Ausstellungsort"),
      h(
        "details",
        { class: "it-notes" },
        h("summary", { text: "Herkunft der Daten" }),
        h("p", { text: "Orte und Daten stammen aus der Lieferung der Regesta Imperii und ihrem Register, ohne LLM. Alle Karten haben denselben Maßstab für die Punktgröße. Die Fernreisen nach Osten sind zur Mitte hin gestaucht; die Grundkarte zeigt Küsten und große Flüsse nach Natural Earth (gemeinfrei)." }),
      ),
    );
    const list = state.place
      ? h(
          "ul",
          { class: "act-rows it-rows", role: "list", "aria-label": `Regesten aus ${places[state.place].l}` },
          atPlace.map((p) =>
            h(
              "li",
              { class: "act-row" },
              h(
                "button",
                { type: "button", class: "act-open", onclick: () => openRegest(p), onfocus: () => point(p.p), onblur: () => point(null) },
                h("span", { class: "act-year", text: String(Math.floor(p.y)) }),
                h("span", { class: "act-name", text: p.i }),
                h("span"),
              ),
            ),
          ),
        )
      : h("p", { class: "side-empty", text: "Wähle einen Ort auf einer Karte oder in der Liste oben." });
    const restore = focusKey(aside);
    aside.replaceChildren(
      h(
        "section",
        { class: "side-part side-selection", "aria-label": "Auswahl und Filter" },
        decadePick,
        placePick,
        timeBand(store, filters, new Set(atPlace.map((p) => Math.floor(p.y)))),
        applies ? h("p", { class: "side-applies" }, applies, h("button", { type: "button", class: "link-button", onclick: () => filters.reset() }, "Zurücksetzen")) : null,
        legend,
      ),
      h("section", { class: "side-part side-acts", "aria-label": "Regesten des Ortes" }, list),
    );
    restore();
  }

  const unsubscribe = filters.onChange(() => {
    draw();
    renderSide();
  });
  let lastSize = "";
  const observer = new ResizeObserver(() => {
    const size = `${host.clientWidth}x${host.clientHeight}`;
    if (host.clientWidth && size !== lastSize) {
      lastSize = size;
      draw();
    }
  });
  observer.observe(host);
  renderSide();

  return {
    element,
    aside,
    focus: null,
    dispose: () => {
      unsubscribe();
      observer.disconnect();
    },
  };
}
