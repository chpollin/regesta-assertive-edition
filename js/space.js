/**
 * The space view: the person network turned into a rotatable space with time as height.
 *
 * Task: follow a person's relations in time order and see which kind of relation lies in
 * which direction. Directions come from js/relations.js and mean the same as in the 2D graph.
 * Every relation is drawn horizontally at the year of its regest; only a person's continuity
 * across years runs vertically. The projection is an own small perspective projection in SVG,
 * recomputed on every rotation step; nothing animates by itself. The plan and its reasons are
 * in knowledge/space-view.md.
 */
import { h, regestHref } from "./dom.js";
import { FAMILIES, familyOf, directionOf } from "./relations.js";

const SVG = "http://www.w3.org/2000/svg";
const DEG = Math.PI / 180;
/**
 * Three snapping views of the same cube in orthographic projection, after the space-time
 * cube study of 2026-11-11 (Bach et al. 2017: fewer degrees of freedom, orthographic against
 * perspective distortion). The top view flattens time into the aggregated network, the side
 * view sets time against one ground axis, the oblique view is the overview. Free rotation
 * stays as an option and starts from wherever the view is.
 */
const VIEWS = Object.freeze({
  schraeg: { label: "Schräg", yaw: -30 * DEG, pitch: 26 * DEG },
  oben: { label: "Aufsicht", yaw: 0, pitch: 90 * DEG },
  // Seen from the east, so north (kinship) and south (dispute) spread left and right; seen
  // from the south they fell onto one line in the Adela case.
  seite: { label: "Seite", yaw: 90 * DEG, pitch: 0 },
});
const START = Object.freeze({ yaw: VIEWS.schraeg.yaw, pitch: VIEWS.schraeg.pitch, zoom: 1 });
/** Slice widths in years; 0 means no slice. */
const SLICE_WIDTHS = [0, 1, 5, 10];
/** World units: acts on radius 1, the time column 3.2 high, the floor ring at radius 1.75. */
const HEIGHT = 3.2;
const RING = 1.9;

/** @param {string} tag @param {Record<string, any>} [attrs] @param {...any} children */
function s(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "text") el.textContent = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, String(v));
  }
  for (const c of children.flat()) if (c) el.append(c);
  return el;
}

/** Fractional year of an ISO date, the same rule as the timeline. */
function yearOf(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return y + ((m - 1) * 30.4 + (d - 1)) / 365;
}

/** Horizontal world position for an angle in degrees (clockwise from north) and a radius. */
function polar(angle, radius) {
  const d = directionOf({ angle });
  // directionOf gives screen coordinates with y downwards; north becomes "away" (+z).
  return { x: d.x * radius, z: -d.y * radius };
}

/** Spread n items in time order over the middle 36 degrees of a family's sector. */
function spreadAngle(base, i, n) {
  return base - 18 + (36 * (i + 0.5)) / n;
}

/**
 * @param {import("./app.js").Store} store
 * @param {{actor?: string|null}} options
 */
export function renderSpace(store, options = {}) {
  const graph = store.edition.graph;
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const regestYear = (uid) => (store.byUid.has(uid) ? yearOf(store.byUid.get(uid).start) : null);
  const startYears = store.edition.regests.map((r) => yearOf(r.start));
  const y0 = Math.floor(Math.min(...startYears));
  const y1 = Math.ceil(Math.max(...startYears));
  // The height spans the whole run for the network and only the selected person's years for
  // one person, so a case of a few years (Adela, 1147 to 1153) fills the scene instead of
  // sitting in a small knot under empty decades.
  const span = { lo: y0, hi: y1 };
  const toY = (year) => ((year - span.lo) / (span.hi - span.lo) - 0.5) * HEIGHT;
  /** Scale steps of 1, 2, 5, 10 or 20 years, at most eight ticks. */
  const ticks = () => {
    const step = [1, 2, 5, 10, 20].find((st) => (span.hi - span.lo) / st <= 8) ?? 50;
    const out = [];
    for (let y = Math.ceil(span.lo / step) * step; y <= span.hi; y += step) out.push(y);
    return out;
  };
  const isAct = (id) => byId.get(id)?.kind === "act";

  // The same-name case: the two parents and their child, labelled in every state.
  const sameName = graph.edges.filter((e) => e.kind === "same-name");
  const caseIds = new Set();
  for (const e of sameName) {
    caseIds.add(e.source).add(e.target);
    for (const p of graph.edges) if (p.kind === "parent" && (p.target === e.source || p.target === e.target)) caseIds.add(p.source);
  }
  const persons = graph.nodes.filter((n) => n.kind !== "act").sort((a, b) => a.label.localeCompare(b.label, "de"));

  // View, slice and look live in the query string, so a view can be linked and reloaded;
  // the hash keeps the route and the person as before.
  const params = new URLSearchParams(location.search);
  const startView = VIEWS[params.get("ansicht")] ? params.get("ansicht") : "schraeg";
  const state = {
    actor: /** @type {string|null} */ (options.actor ?? null),
    view: { yaw: VIEWS[startView].yaw, pitch: VIEWS[startView].pitch, zoom: 1 },
    /** The snapped view, or "frei" once the reader has turned the scene by hand. */
    snap: startView,
    /** Time slice: centre year and width in years; width 0 means no slice. */
    slice: { at: Number(params.get("jahr")) || null, width: SLICE_WIDTHS.includes(Number(params.get("breite"))) ? Number(params.get("breite")) : 0 },
    preview: /** @type {string|null} */ (null),
    /** Corpus mode filters: one relation family or all, and the minimum statements of a person. */
    corpus: {
      family: FAMILIES.some((f) => f.key === params.get("familie")) ? params.get("familie") : "alle",
      min: [1, 2, 3, 5].includes(Number(params.get("mindestens"))) ? Number(params.get("mindestens")) : 2,
    },
  };

  const tip = h("p", { class: "space-tip", role: "status", "aria-live": "polite" });
  const sceneHost = h("div", {
    class: "space-scene",
    tabindex: "0",
    role: "group",
    "aria-label": "Raumansicht des Personennetzes, Zeit als Höhe. Pfeiltasten drehen frei, Plus und Minus zoomen, Pos1 kehrt zur Schrägansicht zurück.",
  });
  const panel = h("div", { class: "space-panel", "aria-live": "polite" });
  const wholeButton = h("button", { type: "button", class: "tool", onclick: () => select(null) }, "Ganzes Netz");
  const flatLink = h("a", { class: "space-flat", href: "#/" }, "2D-Ansicht");
  const viewButtons = Object.entries(VIEWS).map(([key, v]) =>
    h("button", { type: "button", class: "seg", "aria-pressed": "false", "data-view": key, onclick: () => snapTo(key) }, v.label),
  );
  const freeMark = h("span", { class: "seg seg-note", "data-view": "frei", text: "frei gedreht" });
  const widthSelect = h(
    "select",
    { class: "space-width", "aria-label": "Breite der Zeitscheibe", onchange: (e) => setSlice({ width: Number(e.target.value) }) },
    SLICE_WIDTHS.map((w) => h("option", { value: String(w), text: w === 0 ? "keine Zeitscheibe" : w === 1 ? "Scheibe 1 Jahr" : `Scheibe ${w} Jahre` })),
  );
  const yearRange = h("input", { type: "range", class: "space-year-range", "aria-label": "Lage der Zeitscheibe", step: "1", oninput: (e) => setSlice({ at: Number(e.target.value) }) });
  // Corpus filters, shown only without a centre person. Each option carries its count.
  const actsPerFamily = new Map(FAMILIES.map((f) => [f.key, graph.nodes.filter((n) => n.kind === "act" && familyOf(n.label) === f).length]));
  const allActs = graph.nodes.filter((n) => n.kind === "act").length;
  const refilter = (change) => {
    Object.assign(state.corpus, change);
    model = buildModel();
    draw();
    renderPanel();
  };
  const familySelect = h(
    "select",
    { class: "space-width", "aria-label": "Relationsfamilie", onchange: (e) => refilter({ family: e.target.value }) },
    h("option", { value: "alle", text: `alle Vorgänge (${allActs})` }),
    FAMILIES.filter((f) => actsPerFamily.get(f.key)).map((f) => h("option", { value: f.key, text: `${f.label} (${actsPerFamily.get(f.key)})` })),
  );
  const minSelect = h(
    "select",
    { class: "space-width", "aria-label": "Mindestzahl der Aussagen je Person", onchange: (e) => refilter({ min: Number(e.target.value) }) },
    [1, 2, 3, 5].map((m) => h("option", { value: String(m), text: m === 1 ? "Personen ab 1 Aussage" : `Personen ab ${m} Aussagen` })),
  );
  const corpusControls = h("div", { class: "space-slice" }, familySelect, minSelect);
  const appliesText = h("span", { class: "space-applies-text" });
  const resetButton = h("button", { type: "button", class: "link-button", onclick: resetAll }, "Zurücksetzen");
  const toolbar = h(
    "div",
    { class: "space-bar" },
    h(
      "div",
      { class: "space-tools" },
      h("div", { class: "segs", role: "group", "aria-label": "Ansicht" }, viewButtons, freeMark),
      h("div", { class: "space-slice" }, widthSelect, yearRange),
      corpusControls,
      h("button", { type: "button", class: "tool", "aria-label": "Vergrößern", onclick: () => zoom(1.15) }, "+"),
      h("button", { type: "button", class: "tool", "aria-label": "Verkleinern", onclick: () => zoom(1 / 1.15) }, "−"),
      wholeButton,
      flatLink,
    ),
    h("p", { class: "space-applies" }, appliesText, " ", resetButton),
    tip,
  );

  // Two design variants for the operator's choice, reached as ?look=a or ?look=b; without the
  // parameter the view keeps its current look. Deliberate shortcut for the comparison: once
  // he has chosen, the chosen tokens move into tokens.css and the parameter goes.
  const look = new URLSearchParams(location.search).get("look");
  const element = h(
    "section",
    { class: "space", "aria-labelledby": "space-title", "data-look": look === "a" || look === "b" ? look : null },
    h("h1", { id: "space-title", class: "visually-hidden", text: "Personen und Vorgänge im Raum, Zeit als Höhe" }),
    toolbar,
    h("div", { class: "space-main" }, sceneHost),
    h("aside", { class: "space-side", "aria-label": "Auswahl" }, panel),
  );

  /** World model of the current mode: items with column position and years, edges with ends. */
  let model = buildModel();
  let scene = null;

  function buildModel() {
    const m = state.actor ? egoModel(state.actor) : wholeModel();
    if (m.centre) {
      const years = [...m.items.values()].flatMap((it) => it.years);
      span.lo = Math.floor(Math.min(...years)) - 1;
      span.hi = Math.max(span.lo + 6, Math.ceil(Math.max(...years)) + 1);
    } else {
      span.lo = y0;
      span.hi = y1;
    }
    return m;
  }

  /**
   * Corpus mode, a trial after the cube study: no centre person. Every node keeps the one
   * build-time 2D layout over the aggregated network of all years, so a person's column
   * stays vertical (Brandes and Corman 2002); acts stand at their year. Fixed directions
   * belong to the ego view, here the relation family is a filter. Filters by family and by
   * the minimum number of statements of a person keep the cube sparse.
   */
  function wholeModel() {
    const items = new Map();
    // The layout is normalised by its 5th and 95th percentile, as in the 2D graph, and the
    // few outliers are pressed into the rim.
    const spread = (values) => {
      const sorted = [...values].sort((a, b) => a - b);
      const lo = sorted[Math.floor(sorted.length * 0.05)];
      const hi = sorted[Math.ceil(sorted.length * 0.95) - 1];
      return (v) => Math.max(-1.15, Math.min(1.15, ((v - lo) / (hi - lo || 1)) * 2 - 1)) * 1.45;
    };
    const sx = spread(graph.nodes.map((n) => n.x));
    const sz = spread(graph.nodes.map((n) => n.y));
    const fam = state.corpus.family;
    const acts = graph.nodes.filter((n) => n.kind === "act" && (fam === "alle" || familyOf(n.label).key === fam));
    const actIds = new Set(acts.map((a) => a.id));
    for (const a of acts) items.set(a.id, { id: a.id, node: a, kind: "act", x: sx(a.x), z: -sz(a.y), years: [regestYear(a.regest)] });
    const count = new Map();
    for (const e of graph.edges) {
      if (e.kind !== "role") continue;
      const act = actIds.has(e.source) ? e.source : actIds.has(e.target) ? e.target : null;
      if (!act) continue;
      const pid = act === e.source ? e.target : e.source;
      count.set(pid, (count.get(pid) ?? 0) + 1);
    }
    for (const p of persons) {
      if ((count.get(p.id) ?? 0) < state.corpus.min) continue;
      items.set(p.id, { id: p.id, node: p, kind: "person", x: sx(p.x), z: -sz(p.y), years: [] });
    }
    // Acts left without any shown person are dropped too, so the cube shows only relations.
    for (const a of acts) {
      const linked = graph.edges.some((e) => e.kind === "role" && ((e.source === a.id && items.has(e.target)) || (e.target === a.id && items.has(e.source))));
      if (!linked) items.delete(a.id);
    }
    const edges = [];
    for (const e of graph.edges) {
      const a = items.get(e.source);
      const b = items.get(e.target);
      if (!a || !b) continue;
      if (e.kind === "same-name") {
        edges.push(edgeOf(e, a, ownYear(a.node), b, ownYear(b.node)));
        continue;
      }
      const year = e.kind === "role" ? (a.kind === "act" ? a.years[0] : b.years[0]) : regestYear(e.regest);
      if (year === null) continue;
      edges.push(edgeOf(e, a, year, b, year));
    }
    return finish(items, edges, null);
  }

  /** One person: the selected person is the axis, its relations stand around it by family. */
  function egoModel(id) {
    const items = new Map();
    const centre = byId.get(id);
    items.set(id, { id, node: centre, kind: "person", x: 0, z: 0, years: [], centre: true });
    const edges = [];
    const roleEdges = graph.edges.filter((e) => e.kind === "role" && (e.source === id || e.target === id));
    const myActs = roleEdges.map((e) => byId.get(e.source === id ? e.target : e.source));
    for (const fam of FAMILIES) {
      const ofFam = myActs.filter((a) => familyOf(a.label) === fam).sort((a, b) => regestYear(a.regest) - regestYear(b.regest) || a.id.localeCompare(b.id));
      ofFam.forEach((a, i) => {
        const angle = spreadAngle(fam.angle, i, ofFam.length);
        items.set(a.id, { id: a.id, node: a, kind: "act", ...polar(angle, 1), years: [regestYear(a.regest)], angle });
      });
    }
    for (const e of roleEdges) {
      const act = items.get(e.source === id ? e.target : e.source);
      edges.push(edgeOf(e, items.get(id), act.years[0], act, act.years[0]));
    }
    // Other people of each act stand further out in the act's direction. A person met in
    // several acts keeps one column, so recurrence over the years is a vertical line.
    for (const act of [...items.values()].filter((it) => it.kind === "act")) {
      const others = graph.edges.filter((e) => e.kind === "role" && (e.source === act.id || e.target === act.id)).filter((e) => (e.source === act.id ? e.target : e.source) !== id);
      others.forEach((e, k) => {
        const pid = e.source === act.id ? e.target : e.source;
        if (!items.has(pid)) {
          const angle = act.angle + (k - (others.length - 1) / 2) * 6;
          items.set(pid, { id: pid, node: byId.get(pid), kind: "person", ...polar(angle, 1.75), years: [] });
        }
        edges.push(edgeOf(e, act, act.years[0], items.get(pid), act.years[0]));
      });
    }
    // Parents and children in the kinship direction, the same-name partner beside them.
    const kin = graph.edges.filter((e) => e.kind === "parent" && (e.source === id || e.target === id));
    kin.forEach((e, j) => {
      const pid = e.source === id ? e.target : e.source;
      const year = regestYear(e.regest);
      if (year === null) return;
      if (!items.has(pid)) items.set(pid, { id: pid, node: byId.get(pid), kind: "person", ...polar((j - (kin.length - 1) / 2) * 16, 1.4), years: [] });
      edges.push(edgeOf(e, items.get(id), year, items.get(pid), year));
    });
    for (const e of sameName) {
      const ends = [e.source, e.target];
      if (ends.includes(id)) {
        const pid = ends.find((x) => x !== id);
        if (!items.has(pid)) items.set(pid, { id: pid, node: byId.get(pid), kind: "person", ...polar(-16, 1.75), years: [] });
      }
      if (ends.every((x) => items.has(x))) edges.push(edgeOf(e, items.get(e.source), ownYear(byId.get(e.source)), items.get(e.target), ownYear(byId.get(e.target))));
    }
    if (!edges.length) items.get(id).years.push(...centre.regests.map(regestYear).filter((y) => y !== null));
    return finish(items, edges, id);
  }

  /** The year a person is attested in its own regest, used for the same-name pair. */
  function ownYear(node) {
    return regestYear(node.case?.regest ?? node.regests[0]) ?? y0;
  }

  function edgeOf(e, a, ya, b, yb) {
    if (a.kind === "person") a.years.push(ya);
    if (b.kind === "person") b.years.push(yb);
    return { e, a, b, ya, yb };
  }

  function finish(items, edges, centre) {
    for (const it of items.values()) {
      if (it.kind === "person" && !it.years.length) it.years.push(...it.node.regests.map(regestYear).filter((y) => y !== null));
      it.years = [...new Set(it.years.map((y) => Math.round(y * 1000) / 1000))].sort((a, b) => a - b);
    }
    return { items, edges, centre };
  }

  /**
   * Orthographic projection of a world point for the current rotation and zoom. Sizes do not
   * shrink with distance; depth is still returned, so line weight and opacity can carry it.
   */
  function projector(width, height) {
    const { yaw, pitch, zoom: z } = state.view;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    const base = Math.min(width / 4.4, height / 4.6) * z;
    const midX = width / 2;
    // Seen from the side the column is centred; the more the camera looks down, the more the
    // floor ring below needs room, so the centre moves up a little.
    const midY = height / 2 - 0.25 * base * Math.sin(Math.max(0, Math.min(pitch, 60 * DEG)));
    return (x, y, zz) => {
      const xr = x * cy + zz * sy;
      const zr = -x * sy + zz * cy;
      const up = y * cp + zr * sp;
      const depth = zr * cp - y * sp;
      return { x: midX + base * xr, y: midY - base * up, k: 1, depth };
    };
  }

  /** Builds the SVG for the current model; update() then only moves elements. */
  function buildScene(width, height) {
    const svg = s("svg", { width, height, viewBox: `0 0 ${width} ${height}`, class: "space-svg", "aria-hidden": "true" });
    const guides = s("g", { class: "sp-guides" });
    const edgeLayer = s("g", { class: "sp-edges" });
    const nodeLayer = s("g", { class: "sp-nodes" });
    const labelLayer = s("g", { class: "sp-labels" });
    const hoverLayer = s("g", { class: "sp-labels sp-hover" });
    svg.append(guides, edgeLayer, nodeLayer, labelLayer, hoverLayer);

    const decades = ticks();
    // Rings are drawn as short segments, so each segment can take the weight of its depth:
    // the near half of a ring is stronger than the far half, which is what makes depth read.
    const SEGMENTS = 36;
    const segs = (cls) => Array.from({ length: SEGMENTS }, () => s("line", { class: cls }));
    const rings = decades.map(() => segs("sp-ring"));
    const floor = segs("sp-floor");
    // Fixed directions belong to the ego view; in the corpus the floor carries no spokes.
    const spokes = model.centre ? FAMILIES.map(() => s("line", { class: "sp-spoke" })) : [];
    const axis = s("line", { class: model.centre ? "sp-axis is-person" : "sp-axis" });
    const tickEls = decades.map(() => s("line", { class: "sp-tick" }));
    const sliceRings = [segs("sp-slice"), segs("sp-slice")];
    guides.append(...floor, ...spokes, ...rings.flat(), axis, ...tickEls, ...sliceRings.flat());

    const edgeEls = model.edges.map((ed) => {
      const cls = ed.e.kind === "parent" ? "sp-parent" : ed.e.kind === "same-name" ? "sp-same" : "sp-role";
      const line = s("line", { class: cls });
      edgeLayer.append(line);
      return { ...ed, line };
    });

    const nodeEls = new Map();
    for (const it of model.items.values()) {
      const n = it.node;
      const g = s("g", { class: `sp-node${it.kind === "act" ? " sp-act" : ""}${it.centre ? " is-selected" : ""}${caseIds.has(it.id) ? " is-case" : ""}` });
      const parts = { g, column: null, marks: [] };
      if (it.kind === "act") {
        parts.marks.push(s("rect", { class: "sp-act-mark" }));
      } else {
        if (!it.centre && it.years.length > 1) parts.column = s("line", { class: "sp-column" });
        for (let i = 0; i < (it.centre ? 0 : it.years.length); i += 1) parts.marks.push(n.kind === "group" ? s("rect", { class: "sp-group" }) : s("circle", { class: `sp-person${n.local ? " sp-local" : ""}` }));
        if (it.centre) parts.marks.push(s("circle", { class: "sp-person sp-centre" }), s("circle", { class: "sp-person sp-centre" }));
      }
      parts.hit = s("circle", { class: "sp-hit", r: 10 });
      if (parts.column) g.append(parts.column);
      g.append(...parts.marks, parts.hit);
      g.addEventListener("mouseenter", () => setPreview(it.id));
      g.addEventListener("mouseleave", () => setPreview(null));
      g.addEventListener("click", () => {
        if (it.kind === "act") location.hash = regestHref(n.regest, n.claim);
        else if (!it.centre) select(it.id);
      });
      nodeEls.set(it.id, parts);
      nodeLayer.append(g);
    }
    return { svg, width, height, rings, decades, floor, spokes, axis, ticks: tickEls, sliceRings, edgeEls, nodeEls, labelLayer, hoverLayer };
  }

  /** Recomputes every position for the current rotation, then places the standing labels. */
  function update() {
    if (!scene) return;
    const { width, height } = scene;
    const P = projector(width, height);
    const pt = (x, year, z) => P(x, toY(year), z);
    // Nearness from 1 (front) to 0 (back), from the camera depth of a point. Opacity and line
    // weight both follow it, so near rings, nodes and lines are stronger than far ones.
    const near = (p) => Math.max(0, Math.min(1, 0.5 - p.depth / 2.6));
    const fog = (p) => 0.28 + 0.72 * near(p);
    const weight = (el, p, q) => {
      const n = (near(p) + near(q)) / 2;
      el.setAttribute("opacity", (0.28 + 0.72 * n).toFixed(2));
      el.style.strokeWidth = `calc(var(--w, 1px) * ${(0.55 + 0.9 * n).toFixed(2)})`;
    };
    const ring = (lines, y, r) => {
      lines.forEach((line, i) => {
        const wa = polar((360 * i) / lines.length, r);
        const wb = polar((360 * (i + 1)) / lines.length, r);
        const a = pt(wa.x, y, wa.z);
        const b = pt(wb.x, y, wb.z);
        setLine(line, a, b);
        weight(line, a, b);
      });
    };
    // The time slice: what lies inside keeps its weight, the rest steps far back. Its two
    // bounding rings are drawn in the accent.
    const range = sliceRange();
    const inside = (y) => !range || (y >= range[0] && y <= range[1] + 0.999);
    const SLICE_OUT = 0.15;
    scene.sliceRings.forEach((lines, i) => {
      for (const line of lines) line.style.display = range ? "" : "none";
      if (range) ring(lines, i ? range[1] + 1 : range[0], 1.12);
    });
    scene.decades.forEach((y, i) => ring(scene.rings[i], y, 1));
    ring(scene.floor, span.lo, RING - 0.15);
    scene.spokes.forEach((spoke, i) => {
      const f = FAMILIES[i];
      const a = pt(0, span.lo, 0);
      const w = polar(f.angle, RING - 0.15);
      const b = pt(w.x, span.lo, w.z);
      setLine(spoke, a, b);
      weight(spoke, a, b);
    });
    const centre = model.centre ? model.items.get(model.centre) : null;
    const axisFrom = centre ? centre.years[0] : y0;
    const axisTo = centre ? centre.years[centre.years.length - 1] : y1;
    setLine(scene.axis, pt(0, centre ? axisFrom : span.lo, 0), pt(0, centre ? axisTo : span.hi, 0));
    // The year scale: a short tick on the axis at every decade, its number placed first by
    // placeLabels, so the scale stays readable at every rotation.
    // From above the time axis is a point, so the scale has nothing to measure and hides.
    const scaleShown = state.view.pitch < 70 * DEG;
    scene.decades.forEach((y, i) => {
      const p = pt(0, y, 0);
      setLine(scene.ticks[i], { x: p.x - 5, y: p.y }, { x: p.x + 5, y: p.y });
      scene.ticks[i].style.display = scaleShown ? "" : "none";
    });

    const screen = new Map();
    for (const it of model.items.values()) {
      const parts = scene.nodeEls.get(it.id);
      const ps = it.years.map((y) => pt(it.x, y, it.z));
      screen.set(it.id, ps);
      const op = fog(ps[0]) * (it.centre || it.years.some(inside) ? 1 : SLICE_OUT);
      parts.g.setAttribute("opacity", op.toFixed(2));
      if (it.kind === "act") {
        const size = 6.5 * ps[0].k;
        setAttrs(parts.marks[0], { x: ps[0].x - size / 2, y: ps[0].y - size / 2, width: size, height: size });
      } else if (it.centre) {
        // The selected person is the axis; its ends carry a mark each.
        setAttrs(parts.marks[0], { cx: ps[0].x, cy: ps[0].y, r: 6 * ps[0].k });
        const last = ps[ps.length - 1];
        setAttrs(parts.marks[1], { cx: last.x, cy: last.y, r: 6 * last.k });
      } else {
        if (parts.column) setLine(parts.column, ps[0], ps[ps.length - 1]);
        ps.forEach((p, i) => {
          const m = parts.marks[i];
          if (m.tagName === "rect") setAttrs(m, { x: p.x - 4.5 * p.k, y: p.y - 4.5 * p.k, width: 9 * p.k, height: 9 * p.k });
          else setAttrs(m, { cx: p.x, cy: p.y, r: 4.6 * p.k });
        });
      }
      const anchor = labelAnchor(it, ps);
      setAttrs(parts.hit, { cx: anchor.x, cy: anchor.y });
    }
    for (const ed of scene.edgeEls) {
      const a = pt(ed.a.x, ed.ya, ed.a.z);
      const b = pt(ed.b.x, ed.yb, ed.b.z);
      setLine(ed.line, a, b);
      weight(ed.line, a, b);
      if (!inside(ed.ya) && !inside(ed.yb)) ed.line.setAttribute("opacity", (Number(ed.line.getAttribute("opacity")) * SLICE_OUT).toFixed(2));
    }
    labelFilter = (it) => it.centre || it.years.some(inside);
    yearScaleShown = scaleShown;
    placeLabels(pt, screen);
    drawPreview(screen);
  }

  /** Items whose label may stand, and whether the year numbers are drawn; set by update(). */
  let labelFilter = (_it) => true;
  let yearScaleShown = true;

  /** The slice as [first year, last year], kept inside the current span, or null. */
  function sliceRange() {
    const w = state.slice.width;
    if (!w) return null;
    const lo = Math.floor(span.lo);
    const hi = Math.floor(span.hi);
    const at = Math.min(hi, Math.max(lo, state.slice.at ?? Math.round((lo + hi) / 2)));
    const first = Math.max(lo, at - Math.floor((w - 1) / 2));
    return [first, Math.min(hi, first + w - 1)];
  }

  /** Snap to one of the three views, animated unless the reader prefers reduced motion. */
  function snapTo(key) {
    const target = VIEWS[key];
    state.snap = key;
    syncControls();
    const from = { ...state.view };
    // Turn the short way round.
    let dYaw = (target.yaw - from.yaw) % (2 * Math.PI);
    if (dYaw > Math.PI) dYaw -= 2 * Math.PI;
    if (dYaw < -Math.PI) dYaw += 2 * Math.PI;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      state.view = { ...state.view, yaw: from.yaw + dYaw, pitch: target.pitch };
      update();
      return;
    }
    const t0 = performance.now();
    const DURATION = 450;
    const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
    const token = (animation = {});
    const step = (now) => {
      if (animation !== token) return;
      const t = Math.min(1, (now - t0) / DURATION);
      const e = ease(t);
      state.view = { ...state.view, yaw: from.yaw + dYaw * e, pitch: from.pitch + (target.pitch - from.pitch) * e };
      update();
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  let animation = {};

  function setSlice(change) {
    Object.assign(state.slice, change);
    if (state.slice.width && state.slice.at === null) state.slice.at = Math.round((span.lo + span.hi) / 2);
    syncControls();
    update();
  }

  function resetAll() {
    state.slice = { at: null, width: 0 };
    state.view.zoom = 1;
    snapTo("schraeg");
  }

  /** Buttons, slice controls, the line saying what applies, and the address follow the state. */
  function syncControls() {
    for (const b of viewButtons) b.setAttribute("aria-pressed", String(b.dataset.view === state.snap));
    freeMark.hidden = state.snap !== "frei";
    widthSelect.value = String(state.slice.width);
    const range = sliceRange();
    yearRange.hidden = !range;
    yearRange.min = String(Math.floor(span.lo));
    yearRange.max = String(Math.floor(span.hi));
    if (range) yearRange.value = String(state.slice.at ?? range[0]);
    corpusControls.hidden = !!state.actor;
    familySelect.value = state.corpus.family;
    minSelect.value = String(state.corpus.min);
    const famText = state.corpus.family === "alle" ? "alle Vorgänge" : FAMILIES.find((f) => f.key === state.corpus.family).label;
    const shown = [...model.items.values()].filter((it) => it.kind === "person").length;
    const who = state.actor ? byId.get(state.actor)?.label ?? "" : `Korpus, ${famText}, ${shown} Personen ab ${state.corpus.min} ${state.corpus.min === 1 ? "Aussage" : "Aussagen"}`;
    const view = state.snap === "frei" ? "frei gedreht" : VIEWS[state.snap].label === "Seite" ? "Seitenansicht" : VIEWS[state.snap].label === "Schräg" ? "Schrägansicht" : "Aufsicht";
    const time = range ? (range[0] === range[1] ? `nur ${range[0]}` : `nur ${range[0]} bis ${range[1]}`) : "alle Jahre";
    appliesText.textContent = `Es gilt: ${who}, ${view}, ${time}.`;
    resetButton.hidden = state.snap === "schraeg" && !range && state.view.zoom === 1;
    const q = new URLSearchParams(location.search);
    for (const k of ["ansicht", "breite", "jahr", "familie", "mindestens"]) q.delete(k);
    if (!state.actor && state.corpus.family !== "alle") q.set("familie", state.corpus.family);
    if (!state.actor && state.corpus.min !== 2) q.set("mindestens", String(state.corpus.min));
    if (state.snap !== "schraeg" && state.snap !== "frei") q.set("ansicht", state.snap);
    if (range) {
      q.set("breite", String(state.slice.width));
      q.set("jahr", String(state.slice.at));
    }
    const query = q.toString();
    history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}${location.hash}`);
  }

  /** Where a node's label hangs: an act at its mark, a person at its earliest year. */
  function labelAnchor(it, ps) {
    if (it.centre) return ps[ps.length - 1];
    return ps[0];
  }

  /**
   * Greedy placement in priority order: selection and case, year scale, families, neighbours.
   * A label that would overlap one already placed is dropped and appears on pointing.
   */
  function placeLabels(pt, screen) {
    const { width, height } = scene;
    const boxes = [];
    const out = [];
    const fits = (b) => b.x0 >= 0 && b.x1 <= width && b.y0 >= 0 && b.y1 <= height && !boxes.some((o) => o.x0 < b.x1 && b.x0 < o.x1 && o.y0 < b.y1 && b.y0 < o.y1);
    const tryPlace = (text, p, cls, options) => {
      const w = measure(text, cls);
      for (const o of options) {
        const x0 = o.endsWith("right") ? p.x + 9 : o === "left" ? p.x - 9 - w : p.x - w / 2;
        const y0 = o.startsWith("above") ? p.y - 22 : o.startsWith("below") ? p.y + 8 : p.y - 8;
        const box = { x0: x0 - 1, x1: x0 + w + 1, y0, y1: y0 + 17 };
        if (fits(box)) {
          boxes.push(box);
          out.push(s("text", { x: x0, y: y0 + 12.5, class: `sp-label ${cls}`, text }));
          return true;
        }
      }
      return false;
    };
    // The year scale comes first, so it is never dropped; then the selection and the case.
    const ranked = standing();
    const first = ranked.filter((it) => it.centre || caseIds.has(it.id));
    if (yearScaleShown) for (const y of scene.decades) tryPlace(String(y), pt(0, y, 0), "sp-year", ["left", "right"]);
    for (const it of first) placeItem(it);
    // Direction words on the floor: the same short words in capitals as at the rim of the 2D
    // circle, quieter than the data.
    for (const f of model.centre ? FAMILIES : []) {
      const w = polar(f.angle, RING);
      const p = pt(w.x, span.lo, w.z);
      tryPlace(f.short, p, "sp-family", ["below", "above", "right", "left", "below-right", "above-right"]);
    }
    for (const it of ranked.filter((x) => !first.includes(x))) placeItem(it);
    scene.labelLayer.replaceChildren(...out);

    function placeItem(it) {
      if (!labelFilter(it)) return;
      const ps = screen.get(it.id);
      const cls = `${it.kind === "act" ? "sp-act-label" : ""}${caseIds.has(it.id) ? " sp-case-label" : ""}${it.centre ? " sp-centre-label" : ""}`;
      tryPlace(it.node.label, labelAnchor(it, ps), cls, ["right", "left", "above", "below", "above-right", "below-right"]);
    }
  }

  /** Items with a standing label: selection, case, then neighbours in time order. */
  function standing() {
    const items = [...model.items.values()];
    // In the corpus the people with the longest columns get the standing names; the rest
    // appear on pointing.
    const rank = (it) => (it.centre ? 0 : caseIds.has(it.id) ? 1 : !model.centre ? (it.kind === "person" ? 5 : 9) : it.kind === "person" && isKin(it.id) ? 2 : it.kind === "act" ? 3 : 4);
    return items.filter((it) => rank(it) < 9).sort((a, b) => rank(a) - rank(b) || (model.centre ? a.years[0] - b.years[0] : b.years.length - a.years.length));
  }

  function isKin(pid) {
    return graph.edges.some((e) => (e.kind === "parent" || e.kind === "same-name") && ((e.source === model.centre && e.target === pid) || (e.target === model.centre && e.source === pid)));
  }

  /** The pointed or focused node: its label on top, its edges lit, its name in the status line. */
  function drawPreview(screen) {
    const id = state.preview;
    for (const ed of scene.edgeEls) ed.line.classList.toggle("is-on", !!id && (ed.e.source === id || ed.e.target === id));
    for (const [nid, parts] of scene.nodeEls) parts.g.classList.toggle("is-pointed", nid === id);
    const it = id ? model.items.get(id) : null;
    const standingAlready = it && [...scene.labelLayer.children].some((t) => t.textContent === it.node.label);
    if (!it || standingAlready) {
      scene.hoverLayer.replaceChildren();
      return;
    }
    const p = labelAnchor(it, screen.get(id));
    const text = it.node.label;
    const w = measure(text, "is-hover");
    const x = p.x + 9 + w > scene.width ? p.x - 9 - w : p.x + 9;
    scene.hoverLayer.replaceChildren(s("text", { x: Math.max(2, x), y: p.y + 4, class: "sp-label is-hover", text }));
  }

  /** Rendered width of a label with its classes, measured once in the scene and cached. */
  const widths = new Map();
  function measure(text, cls) {
    const key = `${cls}|${text}`;
    if (!widths.has(key)) {
      const probe = s("text", { class: `sp-label ${cls}`, text });
      scene.labelLayer.append(probe);
      widths.set(key, probe.getComputedTextLength() || text.length * 7);
      probe.remove();
    }
    return widths.get(key);
  }

  function describe(id) {
    const it = model.items.get(id) ?? null;
    const n = byId.get(id);
    if (!n) return "";
    if (n.kind === "act") return `${n.label}, ${store.byUid.get(n.regest).short}, ${Math.floor(regestYear(n.regest))}, ${familyOf(n.label).label}`;
    const years = (it?.years ?? n.regests.map(regestYear)).map(Math.floor);
    const span = years.length ? (years[0] === years[years.length - 1] ? `${years[0]}` : `${years[0]} bis ${years[years.length - 1]}`) : "";
    return `${n.label}${span ? `, ${span}` : ""}${n.local ? ", lokale Kennung" : ""}`;
  }

  function setPreview(id) {
    state.preview = id;
    tip.textContent = id ? describe(id) : "";
    tip.classList.toggle("is-on", !!id);
    if (scene) update();
  }

  function setLine(el, a, b) {
    setAttrs(el, { x1: a.x, y1: a.y, x2: b.x, y2: b.y });
  }

  function setAttrs(el, attrs) {
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, typeof v === "number" ? v.toFixed(1) : v);
  }

  function select(id) {
    state.actor = id;
    state.preview = null;
    history.replaceState(null, "", id ? `#/raum/${encodeURIComponent(id)}` : "#/raum");
    model = buildModel();
    draw();
    renderPanel();
  }

  function reset() {
    snapTo("schraeg");
  }

  function zoom(factor) {
    state.view.zoom = Math.min(3, Math.max(0.5, state.view.zoom * factor));
    syncControls();
    update();
  }

  function rotate(dYaw, dPitch) {
    // Turning by hand stops a running snap and leaves the snapped views.
    animation = {};
    if (state.snap !== "frei") {
      state.snap = "frei";
      syncControls();
    }
    state.view.yaw += dYaw;
    // From slightly below the floor to straight down the time axis, where the picture is
    // the 2D sector arrangement with north up.
    state.view.pitch = Math.min(90 * DEG, Math.max(-10 * DEG, state.view.pitch + dPitch));
    update();
  }

  sceneHost.addEventListener("keydown", (event) => {
    const step = 10 * DEG;
    const actions = {
      ArrowLeft: () => rotate(step, 0),
      ArrowRight: () => rotate(-step, 0),
      ArrowUp: () => rotate(0, step * 0.75),
      ArrowDown: () => rotate(0, -step * 0.75),
      "+": () => zoom(1.15),
      "=": () => zoom(1.15),
      "-": () => zoom(1 / 1.15),
      Home: reset,
    };
    const act = actions[event.key];
    if (act) {
      event.preventDefault();
      act();
    }
  });

  // Dragging rotates; a drag that moved does not count as a click on the node under it.
  let drag = null;
  sceneHost.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    drag = { x: event.clientX, y: event.clientY, moved: false, id: event.pointerId };
  });
  sceneHost.addEventListener("pointermove", (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    if (!drag.moved) sceneHost.setPointerCapture(event.pointerId);
    drag.moved = true;
    drag.x = event.clientX;
    drag.y = event.clientY;
    rotate(-dx * 0.008, dy * 0.006);
  });
  const endDrag = (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    if (drag.moved) {
      const swallow = (e) => {
        e.stopPropagation();
        e.preventDefault();
      };
      sceneHost.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => sceneHost.removeEventListener("click", swallow, { capture: true }), 0);
    }
    drag = null;
  };
  sceneHost.addEventListener("pointerup", endDrag);
  sceneHost.addEventListener("pointercancel", endDrag);

  function personButton(id, text) {
    return h(
      "button",
      {
        type: "button",
        class: "link-button",
        onclick: () => select(id),
        onmouseenter: () => setPreview(id),
        onmouseleave: () => setPreview(null),
        onfocus: () => setPreview(id),
        onblur: () => setPreview(null),
      },
      text,
    );
  }

  function renderPanel() {
    wholeButton.hidden = !state.actor;
    flatLink.setAttribute("href", state.actor ? `#/personen/${encodeURIComponent(state.actor)}` : "#/");
    const picker = h(
      "select",
      { class: "space-pick", "aria-label": "Person wählen", onchange: (e) => e.target.value && select(e.target.value) },
      h("option", { value: "", text: "Person wählen" }),
      persons.map((p) => h("option", { value: p.id, text: p.label, selected: p.id === state.actor })),
    );
    const node = state.actor ? byId.get(state.actor) : null;
    if (!node) {
      const caseParents = [...caseIds].map((id) => byId.get(id)).filter((n) => n?.case);
      const child = [...caseIds].map((id) => byId.get(id)).find((n) => n && !n.case);
      // The statement list coupled to the corpus cube: every shown act in time order; pointing
      // at a row lights the act and its people in the scene.
      const acts = [...model.items.values()].filter((it) => it.kind === "act").sort((a, b) => a.years[0] - b.years[0]);
      const rows = acts.map((it) => {
        const n = it.node;
        const people = graph.edges
          .filter((e) => e.kind === "role" && (e.source === n.id || e.target === n.id))
          .map((e) => (e.source === n.id ? e.target : e.source))
          .filter((pid) => model.items.has(pid));
        return h(
          "li",
          { onmouseenter: () => setPreview(n.id), onmouseleave: () => setPreview(null) },
          h("span", { class: "space-year", text: String(Math.floor(it.years[0])) }),
          " ",
          h("a", { class: "space-act", href: regestHref(n.regest, n.claim), text: n.label, onfocus: () => setPreview(n.id), onblur: () => setPreview(null) }),
          ` ${store.byUid.get(n.regest).short}`,
          people.length ? ", " : "",
          ...people.flatMap((pid, i) => [i ? ", " : "", personButton(pid, byId.get(pid).label)]),
        );
      });
      panel.replaceChildren(
        h("p", { class: "space-hint", text: "Jede Person steht an einer festen Stelle, ihre Säule reicht durch die Jahre, in denen sie belegt ist. Wähle eine Person, um ihre Beziehungen nach Richtungen geordnet zu sehen." }),
        child
          ? h(
              "ul",
              { class: "space-rels", role: "list" },
              h("li", {}, personButton(child.id, child.label), ", Elternteil mit zwei Kennungen"),
              caseParents.map((p) => h("li", {}, personButton(p.id, `Vater in ${p.case.short}`))),
            )
          : null,
        picker,
        h("ul", { class: "space-rels space-corpus", role: "list", "aria-label": "Vorgänge im Würfel" }, rows),
      );
      return;
    }
    const rows = [];
    for (const e of graph.edges) {
      if (e.source !== node.id && e.target !== node.id) continue;
      const otherId = e.source === node.id ? e.target : e.source;
      const other = byId.get(otherId);
      const year = e.kind === "same-name" ? ownYear(other) : regestYear(e.regest);
      const link = e.regest && store.byUid.has(e.regest) ? h("a", { href: regestHref(e.regest, e.claim), text: store.byUid.get(e.regest).short }) : null;
      let body;
      if (e.kind === "role") {
        const people = graph.edges
          .filter((r) => r.kind === "role" && (r.source === otherId || r.target === otherId))
          .map((r) => (r.source === otherId ? r.target : r.source))
          .filter((pid) => pid !== node.id);
        const buttons = people.flatMap((pid, i) => [i ? ", " : "", personButton(pid, byId.get(pid).label)]);
        body = [h("span", { class: "space-act", text: other.label }), ` als ${e.label}`, people.length ? " mit " : "", ...buttons];
      } else if (e.kind === "parent") {
        body = [e.source === node.id ? "Elternteil ist " : "Elternteil von ", personButton(otherId, other.label)];
      } else {
        body = ["gleicher Name wie ", personButton(otherId, other.case ? `die Person aus ${other.case.short}` : other.label)];
      }
      rows.push({ year: year ?? y0, el: h("li", {}, h("span", { class: "space-year", text: String(Math.floor(year ?? y0)) }), " ", ...body, link ? " " : null, link) });
    }
    rows.sort((a, b) => a.year - b.year);
    panel.replaceChildren(
      h("p", { class: "space-name" }, node.label, node.local ? h("span", { class: "space-flag", text: " lokale Kennung" }) : null),
      h("ul", { class: "space-rels", role: "list" }, rows.map((r) => r.el)),
      picker,
    );
  }

  function draw() {
    const wide = element.clientWidth > 900;
    const top = sceneHost.getBoundingClientRect().top + window.scrollY;
    const below = parseFloat(getComputedStyle(element.parentElement).paddingBlockEnd) || 0;
    const width = Math.max(280, sceneHost.clientWidth);
    // Narrow, the width limits the drawing, so the scene is not taller than the drawing needs.
    const height = wide ? Math.max(380, window.innerHeight - top - below - 8) : Math.round(Math.min(window.innerHeight * 0.62, width * 1.3));
    element.style.setProperty("--scene-height", `${height}px`);
    scene = buildScene(width, height);
    sceneHost.replaceChildren(scene.svg);
    syncControls();
    update();
  }

  renderPanel();
  let lastSize = "";
  const observer = new ResizeObserver(() => {
    const size = `${Math.round(sceneHost.clientWidth)}x${window.innerHeight}`;
    if (sceneHost.clientWidth && size !== lastSize) {
      lastSize = size;
      draw();
    }
  });
  observer.observe(sceneHost);
  // Label widths are measured; once the local fonts are in, measure again.
  document.fonts?.ready.then(() => {
    widths.clear();
    update();
  });

  return { element, focus: null };
}
