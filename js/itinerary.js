/**
 * The space-time cube of the Atlas (js/atlas.js): every regest of the whole delivery with a
 * place of issue as one point, the ground plan the map of the places of issue, the height time.
 *
 * Task: see where and when the documents of Friedrich I. were issued and how the court moved
 * between Germany and Italy; point at a regest to read it, open it to see what it depends on.
 * This is the deterministic layer of the edition (build_holdings.py, no LLM); the regesta
 * with statements of the run are drawn larger in the ochre of the second layer.
 *
 * Movement data is the case for which the space-time cube is studied (Kristensson et al.
 * 2009, Amini et al. 2015, per the coordination's study of 2026-11-11): patterns over time
 * read faster, single points in time not; exact reading stays with the result list of the
 * Atlas. Three snapping orthographic views: Würfel (oblique), Karte (top), Zeit (side).
 *
 * Fit (interface plan of 2026-11-17): the cube is fitted to the bounding box of its content,
 * the box spanned by the places of issue and the years, not to a fixed square floor; its time
 * height follows the proportions of the drawing area, so the oblique view fills the width.
 *
 * The regest beside its point (operator, 2026-11-14): a pointed or focused point shows the
 * regest in a small card beside it, never while a regest is open, so it cannot stand over
 * the opened one. An opened regest is marked with what it depends on: the stations before and
 * after it on the itinerary, the other regesta of its place, and the regesta that share a
 * person of the register with it (persons named in at most RELATED_MAX regesta, so the ruler
 * and his chancellors do not join everything); the rest recedes.
 *
 * The relations of an opened regest (operator, 2026-11-18: „viel zu dick … den Relationen auch
 * eine Bedeutung geben … kleine Pfeile“): three kinds, each in its own colour of one palette
 * checked for colour-vision deficiency (css/tokens.css, --rel-*) and in its own form, so the
 * kind reads without colour too: the stations before and after as solid lines in the accent
 * with an arrowhead in time direction, the other regesta of the same place as rings without a
 * line, the regesta sharing a person as dashed hairlines, only the PEOPLE_DRAWN nearest in
 * time, all of them while the legend asks for it. Pointing at a related point names its kind
 * and the shared persons.
 */
import { h } from "./dom.js";
import { statementsOf } from "./regest-card.js";
import { familyIcon, familyOf } from "./relations.js";
import { s } from "./svg.js";
import { mapProjection } from "./map.js";

const DEG = Math.PI / 180;
/** The three camera positions; the Atlas adds Jahrzehnte as a fourth representation. */
export const CAMERAS = Object.freeze({
  wuerfel: { label: "Würfel", yaw: -28 * DEG, pitch: 20 * DEG },
  karte: { label: "Karte", yaw: 0, pitch: 90 * DEG },
  zeit: { label: "Zeit", yaw: 0, pitch: 0 },
});
/** Bounds of the time height in map units (the core of the places spans about 2.5). */
const HEIGHT_MIN = 1.1;
const HEIGHT_MAX = 4;
/** Room around the drawn box for the year scale on the left and labels elsewhere, in px. */
const MARGIN = { left: 42, right: 14, top: 14, bottom: 34 };
/** Standing place names on the floor: the places with most documents, as larger points. */
const NAMED_PLACES = 5;
/** A person named in more regesta than this does not make two regesta related. */
const RELATED_MAX = 60;
/** Shared-person relations drawn at rest: the nearest in time; the legend shows all on demand. */
const PEOPLE_DRAWN = 12;

/**
 * @param {any} store  the shared store with holdings
 * @param {{points: Array<{u: string, i: string, p: string, y: number}>, filters: any,
 *   isOn: (p: any) => boolean, personMark: (p: any) => string, withStatements: Set<string>,
 *   flagsOf: Map<string, any[]>, checks: () => any, onOpen: (i: number) => void,
 *   onFree: () => void, blocked: () => DOMRect|null}} options
 */
export function createCube(store, options) {
  const { points, filters } = options;
  const places = store.holdings.places;
  const { midLat, midLon, k, core, mapXZ: unitXZ, inCore } = mapProjection(points, places);
  const mapX = (lon, lat) => unitXZ(lon, lat)[0] * 1.25;
  const mapZ = (lon, lat) => unitXZ(lon, lat)[1] * 1.25;
  const first = Math.floor(Math.min(...points.map((p) => p.y)));
  const last = Math.floor(Math.max(...points.map((p) => p.y)));
  // The content box: the places of issue on the floor, with a little room, so the floor is
  // as large as the places it holds and no larger.
  const xs = points.map((p) => mapX(places[p.p].lo, places[p.p].la));
  const zs = points.map((p) => mapZ(places[p.p].lo, places[p.p].la));
  const pad = 0.05;
  const box = { x0: Math.min(...xs) - pad, x1: Math.max(...xs) + pad, z0: Math.min(...zs) - pad, z1: Math.max(...zs) + pad };
  const corners = [
    [box.x0, box.z0],
    [box.x1, box.z0],
    [box.x1, box.z1],
    [box.x0, box.z1],
  ];
  let height = 3.2;
  const toY = (year) => ((year - first) / (last + 1 - first) - 0.5) * height;

  const state = { view: { yaw: CAMERAS.wuerfel.yaw, pitch: CAMERAS.wuerfel.pitch, zoom: 1 }, snap: "wuerfel", pointed: null, opened: null, flags: false };
  let related = null;
  let allPeople = false;

  const sceneHost = h("div", {
    class: "space-scene",
    tabindex: "0",
    role: "group",
    "aria-label": "Raum-Zeit-Würfel der Regesten mit Ausstellungsort. Pfeiltasten drehen, Plus und Minus zoomen, Pos1 kehrt zur Ausgangslage zurück. Die Regesten der Auswahl stehen in der Liste links.",
  });
  const tip = h("div", { class: "it-tip", role: "tooltip", hidden: true });
  const element = h("div", { class: "cube" }, sceneHost, tip);
  let scene = null;
  let screen = [];

  let basemap = null;
  let realm = null;
  const later = (file, set) =>
    fetch(new URL(file, import.meta.url))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        set(data);
        update();
      })
      .catch(() => {});
  // The base map and the Empire about 1190 are small local files; without them the cube works.
  later("./basemap.json", (d) => (basemap = d));
  later("./realm.json", (d) => (realm = d));

  function build(width, height_) {
    const svg = s("svg", { width, height: height_, viewBox: `0 0 ${width} ${height_}`, class: "space-svg", "aria-hidden": "true" });
    const frames = s("g", { class: "it-frames" });
    const defs = s("defs");
    const floorClip = s("clipPath", { id: "it-floor-clip" });
    const floorShape = floorClip.appendChild(s("polygon"));
    const coreClip = s("clipPath", { id: "it-core-clip" });
    const coreShape = coreClip.appendChild(s("polygon"));
    const blur = s("filter", { id: "it-realm-soft", x: "-5%", y: "-5%", width: "110%", height: "110%" });
    blur.append(s("feGaussianBlur", { stdDeviation: 2.5 }));
    // The arrowhead of the itinerary steps, in time direction; it takes the line's colour.
    const arrow = s("marker", { id: "it-arrow", viewBox: "0 0 8 8", refX: 7, refY: 4, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse", markerUnits: "userSpaceOnUse" });
    arrow.append(s("path", { d: "M0,0.5 L8,4 L0,7.5 z", class: "it-arrow" }));
    defs.append(floorClip, coreClip, blur, arrow);
    // The map lies on the floor and is cut to it; the realm also to the undistorted core.
    const ground = s("g", { "clip-path": "url(#it-floor-clip)" });
    const realmLayer = s("g", { class: "it-realm-layer", "clip-path": "url(#it-core-clip)" });
    const map = s("g", { class: "it-map" });
    ground.append(realmLayer, map);
    const line = s("polyline", { class: "it-path" });
    const traces = s("g", { class: "it-traces" });
    const dots = s("g", { class: "it-dots" });
    const marks = s("g", { class: "it-marks it-flags" });
    const labels = s("g", { class: "sp-labels" });
    const pointer = s("g", { class: "it-pointer" });
    svg.append(defs, frames, ground, line, traces, dots, marks, labels, pointer);
    const dotEls = points.map((p) => dots.appendChild(s("circle", { class: options.withStatements.has(p.u) ? "it-dot is-evidenced" : "it-dot" })));
    return { svg, width, height: height_, frames, floorShape, coreShape, map, realmLayer, line, traces, dotsG: dots, dots: dotEls, marks, labels, pointer };
  }

  /** Projected corners of the content box for a camera, unscaled. */
  function raw(yaw, pitch) {
    const [cy, sy, cp, sp] = [Math.cos(yaw), Math.sin(yaw), Math.cos(pitch), Math.sin(pitch)];
    return (x, y, zz) => {
      const xr = x * cy + zz * sy;
      const zr = -x * sy + zz * cy;
      return { x: xr, y: -(y * cp + zr * sp), depth: zr * cp - y * sp };
    };
  }
  function extent(project, h_) {
    const pts = [];
    for (const [x, zz] of corners) for (const y of [-h_ / 2, h_ / 2]) pts.push(project(x, y, zz));
    const xs_ = pts.map((c) => c.x);
    const ys_ = pts.map((c) => c.y);
    return { x0: Math.min(...xs_), x1: Math.max(...xs_), y0: Math.min(...ys_), y1: Math.max(...ys_) };
  }

  /**
   * The time height that gives the oblique view the proportions of the drawing area, so the
   * cube fills the width; within bounds, so time never collapses or towers.
   */
  function fitHeight() {
    const aw = scene.width - MARGIN.left - MARGIN.right;
    const ah = scene.height - MARGIN.top - MARGIN.bottom;
    const cam = CAMERAS.wuerfel;
    const project = raw(cam.yaw, cam.pitch);
    const flat = extent(project, 0);
    const wide = flat.x1 - flat.x0;
    const floorDepth = flat.y1 - flat.y0;
    const want = (wide * ah) / aw - floorDepth;
    height = Math.min(HEIGHT_MAX, Math.max(HEIGHT_MIN, want / Math.cos(cam.pitch)));
  }

  function projector() {
    const { width, height: H } = scene;
    const { yaw, pitch, zoom: z } = state.view;
    const project = raw(yaw, pitch);
    const e = extent(project, height);
    const aw = width - MARGIN.left - MARGIN.right;
    const ah = H - MARGIN.top - MARGIN.bottom;
    const base = Math.min(aw / (e.x1 - e.x0), ah / (e.y1 - e.y0)) * z;
    const midX = MARGIN.left + aw / 2 - base * ((e.x0 + e.x1) / 2);
    const midY = MARGIN.top + ah / 2 - base * ((e.y0 + e.y1) / 2);
    return (x, y, zz) => {
      const p = project(x, y, zz);
      return { x: midX + base * p.x, y: midY + base * p.y, depth: p.depth };
    };
  }

  const fmt = (q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`;

  /** Recompute positions for the current view, filters and selection. */
  function update() {
    if (!scene) return;
    const P = projector();
    const pt = (lon, lat, year) => P(mapX(lon, lat), toY(year), mapZ(lon, lat));
    const inside = (y) => filters.inYear(Math.floor(y));
    scene.frames.replaceChildren();
    const frameAt = (year, cls) => scene.frames.append(s("polygon", { class: cls, points: corners.map(([x, zz]) => fmt(P(x, toY(year), zz))).join(" ") }));
    for (let y = Math.ceil(first / 10) * 10; y <= last; y += 10) frameAt(y, "it-frame");
    frameAt(first, "it-floor");
    frameAt(last + 1, "it-frame");
    scene.floorShape.setAttribute("points", corners.map(([x, zz]) => fmt(P(x, toY(first), zz))).join(" "));
    scene.map.replaceChildren();
    scene.realmLayer.replaceChildren();
    if (realm) {
      const ring = [];
      for (let a = 0; a < 360; a += 5) ring.push(fmt(pt(midLon + (Math.cos(a * DEG) * core) / k, midLat + Math.sin(a * DEG) * core, first)));
      scene.coreShape.setAttribute("points", ring.join(" "));
      scene.realmLayer.append(s("polygon", { class: "it-realm", points: realm.ring.map(([lon, lat]) => fmt(pt(lon, lat, first))).join(" "), filter: "url(#it-realm-soft)" }));
    }
    if (basemap) {
      // The map is drawn only inside the undistorted core; beyond it the projection
      // compresses, and a compressed coastline would read as a false shape.
      const draw = (coords, cls) => {
        let run = [];
        const flush = () => {
          if (run.length > 1) scene.map.append(s("polyline", { class: cls, points: run.join(" ") }));
          run = [];
        };
        for (const [lon, lat] of coords) {
          if (!inCore(lon, lat)) flush();
          else run.push(fmt(pt(lon, lat, first)));
        }
        flush();
      };
      for (const c of basemap.coast) draw(c, "it-coast");
      for (const r of basemap.rivers) draw(r, "it-river");
    }
    if (filters.timeActive()) {
      frameAt(Math.min(last + 1, Math.max(first, filters.from)), "it-slice");
      frameAt(Math.min(last + 1, Math.max(first, filters.to + 1)), "it-slice");
    }
    screen = points.map((p) => pt(places[p.p].lo, places[p.p].la, p.y));
    const path = [];
    const personsOn = filters.persons.length > 0;
    const trace = filters.persons.map(() => []);
    const lifted = [];
    points.forEach((p, i) => {
      const q = screen[i];
      const on = options.isOn(p) && (!related || related.all.has(i));
      const dot = scene.dots[i];
      dot.setAttribute("cx", q.x.toFixed(1));
      dot.setAttribute("cy", q.y.toFixed(1));
      dot.setAttribute("opacity", on ? "1" : filters.any() || related ? "0.07" : "0.12");
      dot.classList.remove("is-pa", "is-pb", "is-pab");
      const mark = personsOn ? options.personMark(p) : "";
      if (mark) {
        dot.classList.add(mark);
        if (on) lifted.push(dot);
      }
      if (inside(p.y)) path.push(fmt(q));
      if (mark && inside(p.y)) {
        if (mark !== "is-pb") trace[0]?.push(fmt(q));
        if (mark !== "is-pa") trace[filters.persons.length - 1]?.push(fmt(q));
      }
    });
    scene.line.setAttribute("points", path.join(" "));
    // A person's trace: their regesta in time order, through the places of issue.
    scene.traces.replaceChildren(...trace.map((pts, j) => s("polyline", { class: `it-trace is-p${j}`, points: pts.join(" ") })));
    scene.line.classList.toggle("is-quiet", personsOn || !!related);
    // Marked points above the rest, so no faint point covers them.
    for (const dot of lifted) scene.dotsG.append(dot);
    scene.marks.replaceChildren();
    const checks = options.checks();
    if (state.flags && checks) {
      const at = new Map(points.map((p, i) => [p.u, i]));
      for (const f of checks.flags) {
        const [ia, ib] = [at.get(f.a.uid), at.get(f.b.uid)];
        if (ia === undefined || ib === undefined || !inside(points[ia].y)) continue;
        scene.marks.append(s("line", { class: "it-flag", x1: screen[ia].x, y1: screen[ia].y, x2: screen[ib].x, y2: screen[ib].y }));
      }
    }
    // The route stays faint over the whole time; a chosen time range draws it strongly.
    scene.line.classList.toggle("is-on", filters.timeActive());
    labels(pt, P);
    pointer();
  }

  /** Year scale at the west edge, place names on the floor, the realm named at its area. */
  function labels(pt, P) {
    const out = [];
    const boxes = [];
    const place = (text, p, cls, dx = 6, dy = 4) => {
      const w = text.length * 6.6;
      const b = { x0: p.x + dx, x1: p.x + dx + w, y0: p.y + dy - 12, y1: p.y + dy + 3 };
      if (b.x0 < 0 || b.x1 > scene.width || b.y0 < 0 || b.y1 > scene.height) return false;
      if (boxes.some((o) => o.x0 < b.x1 && b.x0 < o.x1 && o.y0 < b.y1 && b.y0 < o.y1)) return false;
      boxes.push(b);
      out.push(s("text", { x: b.x0, y: p.y + dy, class: `sp-label ${cls}`, text }));
      return true;
    };
    if (filters.place) {
      const p = places[filters.place];
      place(p.l, pt(p.lo, p.la, first), "sp-case-label");
    }
    if (state.view.pitch < 70 * DEG) {
      for (let y = Math.ceil(first / 10) * 10; y <= last; y += 10) {
        // The number hangs at the leftmost corner of its decade frame.
        const corner = corners.map(([x, zz]) => P(x, toY(y), zz)).sort((a, b) => a.x - b.x)[0];
        place(String(y), corner, "sp-year", -34, 4);
      }
    }
    const ranked = Object.entries(places)
      .sort((a, b) => b[1].n - a[1].n)
      .slice(0, NAMED_PLACES);
    for (const [id, p] of ranked) {
      if (id === filters.place) continue;
      const q = pt(p.lo, p.la, first);
      out.push(s("circle", { class: "it-place", cx: q.x.toFixed(1), cy: q.y.toFixed(1), r: 3.5 }));
      place(p.l, q, "it-place-label", 8, -6);
    }
    // The key of the soft area stands at the area itself (figure rule: legend at the marks).
    if (realm && state.view.pitch > 10 * DEG) {
      const [lon, lat] = realm.label ?? [10.2, 51.4];
      place("Reich um 1190", pt(lon, lat, first), "it-realm-label", -40, 4);
    }
    scene.labels.replaceChildren(...out);
  }

  /** The pointed and the opened regest, the relations of the opened one. */
  function pointer() {
    if (!scene) return;
    scene.pointer.replaceChildren();
    const P = projector();
    const o = state.opened;
    if (related && o !== null && screen[o]) {
      const from = screen[o];
      const line = (a, b, cls, attrs = {}) => scene.pointer.append(s("line", { class: cls, x1: a.x.toFixed(1), y1: a.y.toFixed(1), x2: b.x.toFixed(1), y2: b.y.toFixed(1), ...attrs }));
      // Shared persons: dashed hairlines to the nearest in time, the pointed one stronger.
      for (const j of peopleShown()) if (screen[j]) line(from, screen[j], j === state.pointed ? "it-link is-on" : "it-link");
      for (const j of related.place) screen[j] && scene.pointer.append(s("circle", { class: j === state.pointed ? "it-same-place is-on" : "it-same-place", cx: screen[j].x.toFixed(1), cy: screen[j].y.toFixed(1), r: 4 }));
      // The steps: from the station before to the opened one, from it to the station after,
      // the arrowhead stopping short of the later point.
      const shortened = (a, b) => {
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        const k = d > 14 ? (d - 7) / d : 1;
        return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
      };
      if (related.before !== null && screen[related.before]) line(screen[related.before], shortened(screen[related.before], from), "it-step", { "marker-end": "url(#it-arrow)" });
      if (related.after !== null && screen[related.after]) line(from, shortened(from, screen[related.after]), "it-step", { "marker-end": "url(#it-arrow)" });
      // What a pointed related point is to the opened regest, beside it.
      const j = state.pointed;
      if (j !== null && j !== o && related.all.has(j) && screen[j]) {
        const kinds = [];
        if (j === related.before) kinds.push("Station davor");
        if (j === related.after) kinds.push("Station danach");
        if (related.place.has(j)) kinds.push("gleicher Ort");
        const names = (related.people.get(j) ?? []).map((id) => persons[id].l);
        if (names.length) kinds.push(`gemeinsame Person: ${names.slice(0, 2).join(", ")}${names.length > 2 ? ` und ${names.length - 2} weitere` : ""}`);
        const q = screen[j];
        const text = s("text", { class: "it-rel-label", x: (q.x + 9).toFixed(1), y: (q.y - 8).toFixed(1), text: `${points[j].i}, ${kinds.join("; ")}` });
        scene.pointer.append(text);
        // Keep the label inside the drawing.
        const box = text.getBBox();
        // Keep the label inside the drawing and clear of the opened regest over its right edge.
        const cover = options.blocked();
        const right = cover ? cover.left - scene.svg.getBoundingClientRect().left : scene.width;
        if (box.x + box.width > right - 4) {
          text.setAttribute("x", (q.x - 9).toFixed(1));
          text.setAttribute("text-anchor", "end");
        }
      }
    }
    for (const [i, cls] of [
      [o, "it-opened"],
      [state.pointed, "it-pointed"],
    ]) {
      if (i === null || i === undefined || !screen[i]) continue;
      const p = points[i];
      const top = screen[i];
      const floor = P(mapX(places[p.p].lo, places[p.p].la), toY(first), mapZ(places[p.p].lo, places[p.p].la));
      scene.pointer.append(s("line", { class: "it-drop", x1: top.x, y1: top.y, x2: floor.x, y2: floor.y }), s("circle", { class: cls, cx: top.x, cy: top.y, r: 5.5 }));
    }
  }

  function nearest(event) {
    const r = scene.svg.getBoundingClientRect();
    const x = event.clientX - r.left;
    const y = event.clientY - r.top;
    // A point under the opened regest is out of reach (the overlay covers it).
    const cover = options.blocked();
    if (cover && event.clientX >= cover.left && event.clientX <= cover.right && event.clientY >= cover.top && event.clientY <= cover.bottom) return null;
    let best = null;
    let dist = 64;
    points.forEach((p, i) => {
      if (!options.isOn(p)) return;
      const d = (screen[i].x - x) ** 2 + (screen[i].y - y) ** 2;
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    return best;
  }

  function point(i) {
    state.pointed = i;
    showTip(i);
    pointer();
  }

  /**
   * The regest beside its point: head line, text, statements in the annotation system, with
   * „ungeprüft“ once where statements stand. Never while a regest is open.
   */
  function showTip(i) {
    if (i === null || i === undefined || !screen[i] || state.opened !== null) {
      tip.hidden = true;
      return;
    }
    const p = points[i];
    const regest = store.byUid.get(p.u);
    const text = h("p", { class: "it-tip-text source", text: regest ? regest.text : "…" });
    if (!regest) options.texts?.().then((t) => (text.textContent = t[p.u] || ""));
    const sts = regest ? statementsOf(regest) : [];
    tip.replaceChildren(
      h("p", { class: "it-tip-head" }, h("span", { class: "card-id", text: p.i }), ` ${Math.floor(p.y)}, ${places[p.p].l}`, sts.length ? h("span", { class: "it-tip-state", text: " ungeprüft" }) : null),
      text,
      sts.length
        ? h(
            "ul",
            { class: "it-tip-sts", role: "list" },
            sts.map((st) => h("li", {}, h("span", { class: "ann-chip" }, familyIcon(familyOf(st.kind), { size: 12 }), String(st.n)), ` ${st.kind}`, st.agent ? h("span", { class: `ann-verdict is-${st.agent.outcome.replace(/\s+/g, "-")}` }, `LLM: ${st.agent.outcome}`) : null)),
          )
        : null,
    );
    tip.hidden = false;
    // Beside the point, inside the drawing, on the side with more room.
    const q = screen[i];
    const width = element.clientWidth;
    const w = Math.min(340, width - 24);
    const left = q.x + 18 + w < width ? q.x + 18 : Math.max(8, q.x - 18 - w);
    tip.style.inlineSize = `${w}px`;
    tip.style.left = `${left}px`;
    tip.style.top = `${Math.max(8, Math.min(q.y - 40, element.clientHeight - tip.offsetHeight - 8))}px`;
  }

  /** What a regest depends on: stations before and after, its place, shared persons. */
  const personsOf = new Map();
  for (const [id, pp] of Object.entries(store.holdings.persons ?? {})) for (const u of pp.r) personsOf.set(u, [...(personsOf.get(u) ?? []), id]);
  const indexOf = new Map(points.map((x, j) => [x.u, j]));
  const persons = store.holdings.persons ?? {};
  function relate(i) {
    const p = points[i];
    const place = new Set();
    points.forEach((x, j) => x.p === p.p && j !== i && place.add(j));
    const before = i > 0 ? i - 1 : null;
    const after = i + 1 < points.length ? i + 1 : null;
    /** Related index to the shared persons. */
    const people = new Map();
    for (const id of (personsOf.get(p.u) ?? []).filter((x) => persons[x].r.length <= RELATED_MAX))
      for (const u of persons[id].r)
        if (u !== p.u && indexOf.has(u)) {
          const j = indexOf.get(u);
          people.set(j, [...(people.get(j) ?? []), id]);
        }
    // The nearest in time first, so the drawn ones are the direct context.
    const byTime = [...people.keys()].sort((a, b) => Math.abs(points[a].y - p.y) - Math.abs(points[b].y - p.y));
    const steps = new Set([before, after].filter((j) => j !== null));
    return { place, before, after, steps, people, byTime, all: new Set([i, ...place, ...steps, ...people.keys()]) };
  }
  /** The shared-person relations drawn: the nearest in time, or all on demand. */
  const peopleShown = () => (related ? (allPeople ? related.byTime : related.byTime.slice(0, PEOPLE_DRAWN)) : []);

  function draw() {
    // Rounded down: clientHeight rounds a fractional height up, and the drawing then stood
    // one pixel below its area.
    const r = sceneHost.getBoundingClientRect();
    if (!r.width || !r.height) return;
    scene = build(Math.max(240, Math.floor(r.width)), Math.max(200, Math.floor(r.height)));
    sceneHost.replaceChildren(scene.svg);
    fitHeight();
    update();
  }

  let animation = {};
  function snapTo(key) {
    const target = CAMERAS[key];
    state.snap = key;
    state.view.zoom = 1;
    let dYaw = (target.yaw - state.view.yaw) % (2 * Math.PI);
    if (dYaw > Math.PI) dYaw -= 2 * Math.PI;
    if (dYaw < -Math.PI) dYaw += 2 * Math.PI;
    const from = { ...state.view };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !scene) {
      state.view = { ...state.view, yaw: from.yaw + dYaw, pitch: target.pitch };
      update();
      return;
    }
    const t0 = performance.now();
    const token = (animation = {});
    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
    const step = (now) => {
      if (animation !== token) return;
      const t = Math.min(1, (now - t0) / 450);
      const e = ease(t);
      state.view = { ...state.view, yaw: from.yaw + dYaw * e, pitch: from.pitch + (target.pitch - from.pitch) * e };
      update();
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function rotate(dYaw, dPitch) {
    animation = {};
    if (state.snap !== "frei") {
      state.snap = "frei";
      options.onFree();
    }
    state.view.yaw += dYaw;
    state.view.pitch = Math.min(90 * DEG, Math.max(-10 * DEG, state.view.pitch + dPitch));
    update();
  }

  function zoom(f) {
    state.view.zoom = Math.min(4, Math.max(0.5, state.view.zoom * f));
    update();
  }

  sceneHost.addEventListener("keydown", (event) => {
    const step = 10 * DEG;
    const act = { ArrowLeft: () => rotate(step, 0), ArrowRight: () => rotate(-step, 0), ArrowUp: () => rotate(0, step * 0.75), ArrowDown: () => rotate(0, -step * 0.75), "+": () => zoom(1.15), "-": () => zoom(1 / 1.15), Home: () => options.onHome() }[event.key];
    if (act) {
      event.preventDefault();
      act();
    }
  });
  let drag = null;
  sceneHost.addEventListener("pointerdown", (e) => {
    if (e.button === 0) drag = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId };
  });
  sceneHost.addEventListener("pointermove", (e) => {
    if (drag && drag.id === e.pointerId) {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      if (!drag.moved) sceneHost.setPointerCapture(e.pointerId);
      drag.moved = true;
      drag.x = e.clientX;
      drag.y = e.clientY;
      rotate(-dx * 0.008, dy * 0.006);
      return;
    }
    if (scene) point(nearest(e));
  });
  sceneHost.addEventListener("pointerleave", () => point(null));
  sceneHost.addEventListener("pointerup", (e) => {
    if (drag && !drag.moved && scene) {
      const i = nearest(e);
      if (i !== null) options.onOpen(i);
    }
    drag = null;
  });

  let lastSize = "";
  const observer = new ResizeObserver(() => {
    const size = `${sceneHost.clientWidth}x${sceneHost.clientHeight}`;
    if (sceneHost.clientWidth && size !== lastSize) {
      lastSize = size;
      draw();
    }
  });
  observer.observe(sceneHost);

  return {
    element,
    update,
    snapTo,
    zoom,
    snap: () => state.snap,
    point,
    setFlags(on) {
      state.flags = on;
      update();
    },
    /** Open a point (index) or close (null); returns the counts of its relations. */
    open(i) {
      state.opened = i;
      related = i === null ? null : relate(i);
      allPeople = false;
      tip.hidden = true;
      update();
      return related ? { steps: related.steps.size, place: related.place.size, people: related.people.size, drawn: Math.min(PEOPLE_DRAWN, related.people.size) } : null;
    },
    /** Draw every shared-person relation of the opened regest, or only the nearest in time. */
    allPeople(on) {
      allPeople = on;
      pointer();
    },
    dispose() {
      animation = {};
      observer.disconnect();
    },
  };
}
