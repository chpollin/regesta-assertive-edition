/**
 * Jahrzehnte, the fourth representation of the Atlas (js/atlas.js): the same map of the places
 * of issue once per decade, side by side, a dot per place sized by its regesta in that decade.
 *
 * Asked for by the operator on 2026-11-11 as one of several views on the same data; since the
 * interface plan of 2026-11-17 it is a representation of the cube beside Würfel, Karte and
 * Zeit, with the Atlas's filter bar instead of a sidebar of its own. The coordination's
 * space-time cube study recommends small multiples as the projection that compares periods,
 * which the cube shows only by rotating. Every panel uses the same map and one size scale for
 * all decades, so sizes compare across panels. The data is the deterministic layer of
 * build_holdings.py (place of issue and coordinate from the register, no LLM).
 *
 * The drawing is aria-hidden; places and regesta are reachable through the filter bar and
 * the result list of the Atlas. A click on a place sets the place filter, a click on a decade's
 * name sets the time range to that decade.
 */
import { h } from "./dom.js";
import { s } from "./svg.js";
import { mapProjection } from "./map.js";
import { t } from "./i18n.js";

// A decade with fewer regesta than MIN_PANEL joins its neighbour: the 1130s hold three, which
// made an almost empty map (reviewed 2026-11-12).
const MIN_PANEL = 10;
// How many places a panel names at most, the largest first, none over another name.
const NAMED = 4;
// Height of the panel title row, in px.
const TITLE = 16;

/**
 * @param {any} store
 * @param {{points: Array<{u: string, i: string, p: string, y: number}>, filters: any,
 *   isOn: (p: any) => boolean, onPlace: (id: string) => void,
 *   onDecade: (from: number, to: number) => void}} options
 */
export function createDecades(store, options) {
  const { filters } = options;
  const places = store.holdings.places;
  const raw = options.points.map((p) => ({ ...p, d: Math.floor(p.y / 10) * 10 }));
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
  const decadeLabel = (d) => (span.get(d)[0] === span.get(d)[1] ? t("decades.one", { d }) : t("decades.two", { a: span.get(d)[0], b: span.get(d)[1] }));
  // The panel in which a place first appears as a place of issue: its dot is dark there and
  // light in later panels, so new places stand apart from returns.
  const firstPanel = new Map();
  for (const p of [...points].sort((a, b) => a.y - b.y)) if (!firstPanel.has(p.p)) firstPanel.set(p.p, p.d);
  const state = { pointed: null, opened: null };

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

  const decadeOn = (d) => filters.from <= span.get(d)[1] + 9 && filters.to >= span.get(d)[0];
  /** Regesta per place in one decade, restricted to the selection. */
  function counts(d) {
    const out = new Map();
    for (const p of points) if (p.d === d && options.isOn(p)) out.set(p.p, (out.get(p.p) ?? 0) + 1);
    return out;
  }

  const host = h("div", { class: "dc-scene", role: "group", "aria-label": t("decades.aria") });
  const element = h("div", { class: "decades" }, host);

  let basemap = null;
  let realm = null;
  const later = (file, set) =>
    fetch(new URL(file, import.meta.url))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        set(data);
        draw();
      })
      .catch(() => {});
  later("./basemap.json", (d) => (basemap = d));
  // The Empire about 1190, as in the cube (build_realm.py), a soft area under the map.
  later("./realm.json", (d) => (realm = d));

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
    const pad = 8;
    const mapW = bounds.x1 - bounds.x0;
    const mapH = bounds.z1 - bounds.z0;
    let best = null;
    for (let cols = 1; cols <= cells; cols += 1) {
      const rowsN = Math.ceil(cells / cols);
      const cw = width / cols;
      const ch = height / rowsN;
      const scale = Math.min((cw - 2 * pad) / mapW, (ch - 2 * pad - TITLE) / mapH);
      if (!best || scale > best.scale) best = { cols, rowsN, cw, ch, scale };
    }
    return { ...best, pad };
  }

  function draw() {
    const box = host.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const width = Math.max(240, Math.floor(box.width));
    const height = Math.max(200, Math.floor(box.height));
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
      const top = oy + TITLE + (L.ch - TITLE - mapH) / 2;
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
      const label = s("text", { class: "dc-label", x: ox + L.pad, y: oy + TITLE - 2, text: decadeLabel(d) });
      g.append(label);
      // The places with most regesta of the decade are named, up to NAMED, each only where it
      // overlaps neither another name nor the panel edge, so each panel reads alone.
      const taken = [{ x0: ox, x1: ox + 150, y0: oy, y1: oy + TITLE + 4 }];
      const named = new Set();
      // Small panels name only their largest place, the smallest none; pointing names any.
      for (const [id] of order.slice(0, L.cw < 200 ? 0 : L.cw < 300 ? 1 : NAMED)) {
        const q = screen.get(id);
        const text = places[id].l;
        const w = text.length * 6.6;
        for (const right of [true, false]) {
          const x0 = right ? q.x + q.r + 4 : q.x - q.r - 4 - w;
          const b = { x0, x1: x0 + w, y0: q.y - 8, y1: q.y + 6 };
          if (b.x0 < ox + 2 || b.x1 > ox + L.cw - 4 || taken.some((o) => o.x0 < b.x1 && b.x0 < o.x1 && o.y0 < b.y1 && b.y0 < o.y1)) continue;
          taken.push(b);
          g.append(s("text", { class: "sp-label", x: (right ? b.x0 : b.x1).toFixed(1), y: (q.y + 4).toFixed(1), "text-anchor": right ? "start" : "end", text }));
          named.add(id);
          break;
        }
      }
      const marks = s("g", { class: "dc-marks" });
      g.append(marks);
      svg.append(g);
      return { d, g, ox, oy, at, screen, dots, label, named, marks, right: ox + L.cw - 4 };
    });
    // The size key fills the cell after the last decade: the reading of the encoding at the
    // marks themselves, so the view needs no legend block.
    const ki = decades.length;
    const kx = (ki % L.cols) * L.cw + L.pad;
    const ky = Math.floor(ki / L.cols) * L.ch;
    const key = s("g", { class: "dc-key" });
    // The smallest and the largest circle span the scale; values between add no reading.
    const values = [...new Set([1, maxCount])];
    let cx = kx + rMax;
    const base = ky + TITLE + Math.min(L.ch * 0.4, rMax * 2 + 16);
    for (const v of values) {
      const r = radius(v);
      key.append(s("circle", { class: "dc-dot", cx: cx.toFixed(1), cy: (base - r).toFixed(1), r: r.toFixed(1) }));
      key.append(s("text", { class: "tb-year", x: cx.toFixed(1), y: (base + 14).toFixed(1), "text-anchor": "middle", text: String(v) }));
      cx += Math.max(2 * r, 18) + 12;
    }
    key.append(s("text", { class: "tb-year", x: kx, y: base + 30, text: t("decades.perPlace") }));
    // Lightness tells new places from returns; one line each, a dot as sign.
    const ly = base + 50;
    key.append(s("circle", { class: "dc-dot is-new", cx: (kx + 5).toFixed(1), cy: (ly - 4).toFixed(1), r: 5 }));
    key.append(s("text", { class: "tb-year", x: kx + 16, y: ly, text: t("decades.new") }));
    key.append(s("circle", { class: "dc-dot", cx: (kx + 5).toFixed(1), cy: (ly + 14).toFixed(1), r: 5 }));
    key.append(s("text", { class: "tb-year", x: kx + 16, y: ly + 18, text: t("decades.earlier") }));
    svg.append(key);
    host.replaceChildren(svg);
    scene = { svg, L, panels };
    mark();
  }

  /** The chosen place, pointing and the opened regest, across all panels at once. */
  function mark() {
    if (!scene) return;
    for (const panel of scene.panels) {
      for (const dot of panel.dots.children) dot.classList.toggle("is-selected", dot.dataset.place === filters.place);
      panel.marks.replaceChildren();
      for (const [id, cls] of [
        [filters.place, "dc-chosen"],
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

  /** The panel, its title row and the place under the pointer. */
  function hitAt(event) {
    if (!scene) return null;
    const r = scene.svg.getBoundingClientRect();
    const x = event.clientX - r.left;
    const y = event.clientY - r.top;
    const { L } = scene;
    if (x > L.cols * L.cw) return null;
    const panel = scene.panels[Math.floor(y / L.ch) * L.cols + Math.floor(x / L.cw)];
    if (!panel) return null;
    const title = y - panel.oy < TITLE + 2 && x - panel.ox < 150;
    let best = null;
    let dist = Infinity;
    for (const [id, q] of panel.screen) {
      const d = Math.hypot(q.x - x, q.y - y) - q.r;
      if (d < dist && d < 8) {
        dist = d;
        best = id;
      }
    }
    return { d: panel.d, place: best, title };
  }

  host.addEventListener("pointermove", (e) => {
    const id = hitAt(e)?.place ?? null;
    if (id === state.pointed) return;
    state.pointed = id;
    mark();
  });
  host.addEventListener("pointerleave", () => {
    state.pointed = null;
    mark();
  });
  host.addEventListener("click", (e) => {
    const hit = hitAt(e);
    if (hit?.title) options.onDecade(span.get(hit.d)[0], span.get(hit.d)[1] + 9);
    else if (hit?.place) options.onPlace(hit.place);
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

  return {
    element,
    update: draw,
    /** Mark the opened regest (its uid) or none. */
    open(uid) {
      state.opened = uid ? (points.find((p) => p.u === uid) ?? null) : null;
      mark();
    },
    dispose() {
      observer.disconnect();
    },
  };
}
