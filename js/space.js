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
/** Starting position: slightly turned and seen from slightly above, east to the right. */
const START = Object.freeze({ yaw: -18 * DEG, pitch: 24 * DEG, zoom: 1 });
/** World units: acts on radius 1, the time column 2.4 high, the floor ring at radius 2.15. */
const HEIGHT = 3.2;
const RING = 1.9;
const CAMERA = 9;

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
  const toY = (year) => ((year - y0) / (y1 - y0) - 0.5) * HEIGHT;
  const isAct = (id) => byId.get(id)?.kind === "act";

  // The same-name case: the two parents and their child, labelled in every state.
  const sameName = graph.edges.filter((e) => e.kind === "same-name");
  const caseIds = new Set();
  for (const e of sameName) {
    caseIds.add(e.source).add(e.target);
    for (const p of graph.edges) if (p.kind === "parent" && (p.target === e.source || p.target === e.target)) caseIds.add(p.source);
  }
  const persons = graph.nodes.filter((n) => n.kind !== "act").sort((a, b) => a.label.localeCompare(b.label, "de"));

  const state = {
    actor: /** @type {string|null} */ (options.actor ?? null),
    view: { ...START },
    preview: /** @type {string|null} */ (null),
  };

  const tip = h("p", { class: "space-tip", role: "status", "aria-live": "polite" });
  const sceneHost = h("div", {
    class: "space-scene",
    tabindex: "0",
    role: "group",
    "aria-label": "Raumansicht des Personennetzes, Zeit als Höhe. Pfeiltasten drehen, Plus und Minus zoomen, Pos1 setzt zurück.",
  });
  const panel = h("div", { class: "space-panel", "aria-live": "polite" });
  const wholeButton = h("button", { type: "button", class: "tool", onclick: () => select(null) }, "Ganzes Netz");
  const flatLink = h("a", { class: "space-flat", href: "#/" }, "2D-Ansicht");
  const toolbar = h(
    "div",
    { class: "space-bar" },
    h(
      "div",
      { class: "space-tools" },
      h("button", { type: "button", class: "tool", onclick: reset }, "Zurück zur Ausgangslage"),
      h("button", { type: "button", class: "tool", "aria-label": "Vergrößern", onclick: () => zoom(1.15) }, "+"),
      h("button", { type: "button", class: "tool", "aria-label": "Verkleinern", onclick: () => zoom(1 / 1.15) }, "−"),
      wholeButton,
      flatLink,
    ),
    tip,
  );

  const element = h(
    "section",
    { class: "space", "aria-labelledby": "space-title" },
    h("h1", { id: "space-title", class: "visually-hidden", text: "Personen und Vorgänge im Raum, Zeit als Höhe" }),
    toolbar,
    h("div", { class: "space-main" }, sceneHost),
    h("aside", { class: "space-side", "aria-label": "Auswahl" }, panel),
  );

  /** World model of the current mode: items with column position and years, edges with ends. */
  let model = buildModel();
  let scene = null;

  function buildModel() {
    return state.actor ? egoModel(state.actor) : wholeModel();
  }

  /** Whole network: acts on a ring in their family direction, persons at the mean of their acts. */
  function wholeModel() {
    const items = new Map();
    const acts = graph.nodes.filter((n) => n.kind === "act");
    for (const fam of FAMILIES) {
      const ofFam = acts.filter((a) => familyOf(a.label) === fam).sort((a, b) => regestYear(a.regest) - regestYear(b.regest) || a.id.localeCompare(b.id));
      ofFam.forEach((a, i) => {
        const angle = spreadAngle(fam.angle, i, ofFam.length);
        items.set(a.id, { id: a.id, node: a, kind: "act", ...polar(angle, 1), years: [regestYear(a.regest)], angle });
      });
    }
    for (const p of persons) {
      const own = graph.edges.filter((e) => e.kind === "role" && (e.source === p.id || e.target === p.id));
      const actItems = own.map((e) => items.get(isAct(e.source) ? e.source : e.target)).filter(Boolean);
      // A deterministic offset from the build-time 2D layout keeps people of one act apart.
      const jitter = { x: (p.x - 0.5) * 0.36, z: (0.5 - p.y) * 0.36 };
      let pos;
      if (actItems.length) {
        const mx = actItems.reduce((t, a) => t + a.x, 0) / actItems.length;
        const mz = actItems.reduce((t, a) => t + a.z, 0) / actItems.length;
        pos = { x: mx * 1.5 + jitter.x, z: mz * 1.5 + jitter.z };
      } else {
        const kin = polar(0, 1.5);
        pos = { x: kin.x + jitter.x, z: kin.z + jitter.z };
      }
      items.set(p.id, { id: p.id, node: p, kind: "person", ...pos, years: [] });
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

  /** Perspective projection of a world point for the current rotation and zoom. */
  function projector(width, height) {
    const { yaw, pitch, zoom: z } = state.view;
    const cy = Math.cos(yaw);
    const sy = Math.sin(yaw);
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    // At the starting pitch the near edge of the floor ring reaches further down than the far
    // top of the axis reaches up, so the centre sits a little above the middle.
    const base = Math.min(width / 4.6, height / 5) * z;
    const midX = width / 2;
    const midY = height / 2 - 0.2 * base;
    return (x, y, zz) => {
      const xr = x * cy + zz * sy;
      const zr = -x * sy + zz * cy;
      const up = y * cp + zr * sp;
      const depth = zr * cp - y * sp;
      const k = CAMERA / (CAMERA + depth);
      return { x: midX + base * k * xr, y: midY - base * k * up, k, depth };
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

    const decades = [];
    for (let y = Math.ceil(y0 / 10) * 10; y <= y1; y += 10) decades.push(y);
    const rings = decades.map(() => s("polyline", { class: "sp-ring" }));
    const floor = s("polyline", { class: "sp-floor" });
    const spokes = FAMILIES.map(() => s("line", { class: "sp-spoke" }));
    const axis = s("line", { class: model.centre ? "sp-axis is-person" : "sp-axis" });
    guides.append(...rings, floor, ...spokes, axis);

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
    return { svg, width, height, rings, decades, floor, spokes, axis, edgeEls, nodeEls, labelLayer, hoverLayer };
  }

  /** Recomputes every position for the current rotation, then places the standing labels. */
  function update() {
    if (!scene) return;
    const { width, height } = scene;
    const P = projector(width, height);
    const pt = (x, year, z) => P(x, toY(year), z);
    const fog = (p) => Math.max(0.45, Math.min(1, 1 - (p.depth + 1.4) * 0.14));
    const circle = (y, r) => {
      const pts = [];
      for (let a = 0; a <= 360; a += 10) {
        const w = polar(a, r);
        const p = pt(w.x, y, w.z);
        pts.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
      }
      return pts.join(" ");
    };
    scene.decades.forEach((y, i) => scene.rings[i].setAttribute("points", circle(y, 1)));
    scene.floor.setAttribute("points", circle(y0, RING - 0.15));
    FAMILIES.forEach((f, i) => {
      const a = pt(0, y0, 0);
      const w = polar(f.angle, RING - 0.15);
      const b = pt(w.x, y0, w.z);
      setLine(scene.spokes[i], a, b);
    });
    const centre = model.centre ? model.items.get(model.centre) : null;
    const axisFrom = centre ? centre.years[0] : y0;
    const axisTo = centre ? centre.years[centre.years.length - 1] : y1;
    setLine(scene.axis, pt(0, centre ? axisFrom : y0, 0), pt(0, centre ? axisTo : y1, 0));

    const screen = new Map();
    for (const it of model.items.values()) {
      const parts = scene.nodeEls.get(it.id);
      const ps = it.years.map((y) => pt(it.x, y, it.z));
      screen.set(it.id, ps);
      const op = fog(ps[0]);
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
      ed.line.setAttribute("opacity", Math.min(fog(a), fog(b)).toFixed(2));
    }
    placeLabels(pt, screen);
    drawPreview(screen);
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
    const narrow = width < 640;
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
    // The selection and the case come first; a year tick they cover gives way to them.
    const ranked = standing();
    const first = ranked.filter((it) => it.centre || caseIds.has(it.id));
    for (const it of first) placeItem(it);
    for (let y = Math.ceil(y0 / 10) * 10; y <= y1; y += 10) tryPlace(String(y), pt(0, y, 0), "sp-year", ["left", "right"]);
    for (const f of FAMILIES) {
      const w = polar(f.angle, RING);
      const p = pt(w.x, y0, w.z);
      const text = narrow ? f.label.split(/[ ,]/)[0] : f.label;
      tryPlace(text, p, "sp-family", ["below", "above", "right", "left", "below-right", "above-right"]);
    }
    for (const it of ranked.filter((x) => !first.includes(x))) placeItem(it);
    scene.labelLayer.replaceChildren(...out);

    function placeItem(it) {
      const ps = screen.get(it.id);
      const cls = `${it.kind === "act" ? "sp-act-label" : ""}${caseIds.has(it.id) ? " sp-case-label" : ""}${it.centre ? " sp-centre-label" : ""}`;
      tryPlace(it.node.label, labelAnchor(it, ps), cls, ["right", "left", "above", "below", "above-right", "below-right"]);
    }
  }

  /** Items with a standing label: selection, case, then neighbours in time order. */
  function standing() {
    const items = [...model.items.values()];
    const rank = (it) => (it.centre ? 0 : caseIds.has(it.id) ? 1 : !model.centre ? 9 : it.kind === "person" && isKin(it.id) ? 2 : it.kind === "act" ? 3 : 4);
    return items.filter((it) => rank(it) < 9).sort((a, b) => rank(a) - rank(b) || a.years[0] - b.years[0]);
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
    state.view = { ...START };
    update();
  }

  function zoom(factor) {
    state.view.zoom = Math.min(3, Math.max(0.5, state.view.zoom * factor));
    update();
  }

  function rotate(dYaw, dPitch) {
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
      panel.replaceChildren(
        h("p", { class: "space-hint", text: "Höhe ist Zeit, die Richtung zeigt die Art der Beziehung. Wähle eine Person, um ihre Beziehungen in zeitlicher Folge zu sehen." }),
        child
          ? h(
              "ul",
              { class: "space-rels", role: "list" },
              h("li", {}, personButton(child.id, child.label), ", Elternteil mit zwei Kennungen"),
              caseParents.map((p) => h("li", {}, personButton(p.id, `Vater in ${p.case.short}`))),
            )
          : null,
        picker,
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
