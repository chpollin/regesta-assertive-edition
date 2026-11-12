/**
 * Zeit und Netz: the flat person network of the run, filling the drawing area of the shell.
 *
 * Task: find a person, follow the attested relations (kinship, marriage, roles in acts) in
 * their fixed directions, and see where the graph keeps two identities apart. Time is no
 * longer a second chart above the network: since the operator's feedback of 2026-11-11
 * (knowledge/ui-feedback.md) the time range and the relation families are filters in the
 * shared sidebar, and the network shows only what they let through. Positions of the whole
 * network come from build_data.py; nothing is simulated here.
 */
import { h, regestHref } from "./dom.js";
import { FAMILIES, familyIcon, familyOf } from "./relations.js";
import { createSidebar } from "./sidebar.js";
import { renderRegestCard } from "./regest-card.js";

const SVG = "http://www.w3.org/2000/svg";
const LABELLED_HUBS = 8;

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

/**
 * The graph restricted by the shared filters: acts of a family that is switched on and of a
 * regest inside the time range, the role edges to them, kinship inside the range, and the
 * people that keep at least one relation. The selected person always stays.
 */
function filteredGraph(graph, filters, keep) {
  const acts = new Set(graph.nodes.filter((n) => n.kind === "act" && filters.inRange(n.regest) && filters.familyOn(familyOf(n.label).key)).map((n) => n.id));
  const edges = graph.edges.filter((e) => {
    if (e.kind === "role") return acts.has(e.source) || acts.has(e.target);
    if (e.kind === "parent") return filters.familyOn("kin") && filters.inRange(e.regest);
    return true;
  });
  const linked = new Set([keep].filter(Boolean));
  for (const e of edges) if (e.kind !== "same-name") linked.add(e.source).add(e.target);
  const nodes = graph.nodes.filter((n) => (n.kind === "act" ? acts.has(n.id) : linked.has(n.id)));
  const ids = new Set(nodes.map((n) => n.id));
  return { nodes, edges: edges.filter((e) => ids.has(e.source) && ids.has(e.target)) };
}

/**
 * @param {import("./app.js").Store} store
 * @param {{actor?: string|null, filters: ReturnType<import("./filters.js").createFilters>}} options
 */
export function renderOverview(store, options) {
  const { filters } = options;
  const graph = store.edition.graph;
  const state = { actor: options.actor ?? null };

  const graphHost = h("div", { class: "vis graph graph-fill" });
  const status = h("p", { class: "canvas-status", role: "status", "aria-live": "polite" });
  const element = h(
    "section",
    { class: "canvas", "aria-labelledby": "net-title" },
    h("h1", { id: "net-title", class: "visually-hidden", text: "Zeit und Netz: Personen und ihre belegten Beziehungen" }),
    graphHost,
    status,
  );
  let network = null;
  const sidebar = createSidebar(store, filters, {
    person: state.actor,
    onPerson: (id) => select(id),
    onPoint: (id) => network?.point(id),
    onOpen: (uid, claim, actId) => open(uid, claim, actId),
  });
  /** The selected act stays marked in the drawing while its regest is open on the right. */
  let openAct = null;
  function open(uid, claim, actId) {
    openAct = actId ?? null;
    network?.pin(openAct);
    options.detail?.show(renderRegestCard(store, uid, { claim, texts: options.texts, onClose: closeDetail }));
  }
  function closeDetail() {
    openAct = null;
    network?.pin(null);
    options.detail?.hide();
  }

  function select(id) {
    state.actor = id;
    history.replaceState(null, "", `${location.search}${id ? `#/personen/${encodeURIComponent(id)}` : "#/"}`);
    sidebar.setPerson(id);
    draw();
    if (id) network?.focus(id);
  }

  function draw() {
    const width = graphHost.clientWidth;
    const height = element.clientHeight;
    if (!width || !height) return;
    const shown = filteredGraph(graph, filters, state.actor);
    network = drawGraph(graphHost, store, shown, height, state.actor, {
      onPoint: (id) => {
        const n = id ? shown.nodes.find((x) => x.id === id) : null;
        status.textContent = n ? n.label : "";
      },
      onSelect: (id) => select(state.actor === id ? null : id),
      onOpen: (uid, claim, actId) => open(uid, claim, actId),
      onSector: (key) => sidebar.openFamily(key),
    });
    network.highlight(null, state.actor, state.actor);
    network.pin(openAct);
  }

  const unsubscribe = filters.onChange(draw);
  // Draw once attached, so the SVG takes the real size; redraw on resize.
  let lastSize = "";
  const observer = new ResizeObserver(() => {
    const size = `${graphHost.clientWidth}x${element.clientHeight}`;
    if (graphHost.clientWidth && size !== lastSize) {
      lastSize = size;
      draw();
    }
  });
  observer.observe(element);

  return {
    element,
    aside: sidebar.element,
    focus: options.actor ? () => requestAnimationFrame(() => network?.focus(options.actor)) : null,
    dispose: () => {
      unsubscribe();
      sidebar.dispose();
      observer.disconnect();
    },
  };
}

/**
 * Standing labels of the whole network: the same-name case and the most connected people,
 * placed greedily clear of each other, of nodes and of edges; the rest appear on pointing.
 */
function placeLabels(graph, px, py, width, height, degree, segments) {
  const charWidth = 7.2;
  const lineHeight = 15;
  const inCase = new Set(graph.edges.filter((e) => e.kind === "same-name").flatMap((e) => [e.source, e.target]));
  const caseChildren = new Set(graph.edges.filter((e) => e.kind === "parent" && inCase.has(e.target)).map((e) => e.source));
  // The child of the case is placed first, short and next to its node; its parents' two-line
  // labels then move around it.
  const rank = (n) => (caseChildren.has(n.id) ? 0 : inCase.has(n.id) ? 1 : 2);
  const actors = graph.nodes.filter((n) => n.kind !== "act");
  actors.sort((a, b) => rank(a) - rank(b) || (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0) || a.label.localeCompare(b.label, "de"));
  // Standing labels only for the case and the most connected people, so the picture stays
  // quiet; every other name appears on pointing, focus or as neighbour of the selection.
  const standing = new Set([...inCase, ...caseChildren, ...actors.filter((n) => rank(n) === 2).slice(0, LABELLED_HUBS).map((n) => n.id)]);
  // Every node, act diamonds included, and every edge is an obstacle for a label.
  const boxes = graph.nodes.map((n) => ({ x0: px(n) - 8, x1: px(n) + 8, y0: py(n) - 8, y1: py(n) + 8, node: n.id }));
  const spots = new Map();
  const meetsBox = (b, self) => boxes.some((o) => o.node !== self && o.x0 < b.x1 && b.x0 < o.x1 && o.y0 < b.y1 && b.y0 < o.y1);
  const meetsLabel = (b) => boxes.some((o) => o.node.startsWith("label:") && o.x0 < b.x1 && b.x0 < o.x1 && o.y0 < b.y1 && b.y0 < o.y1);
  const hits = (b, self) => meetsBox(b, self) || segments.some(([a, c]) => segmentHitsBox(a, c, b));
  // In the dense core no place is free of edges. There a label clear of nodes and labels
  // sits on a plate that covers the lines beneath it.
  const onPlate = (spot) => (spot ? { ...spot, plate: true } : null);
  for (const n of actors) {
    const cx = px(n);
    const cy = py(n);
    const w = n.label.length * charWidth;
    const options = [
      { x: cx + 10, y: cy + 4, anchor: "start", box: { x0: cx + 9, x1: cx + 11 + w, y0: cy - 9, y1: cy + 6 } },
      { x: cx - 10, y: cy + 4, anchor: "end", box: { x0: cx - 11 - w, x1: cx - 9, y0: cy - 9, y1: cy + 6 } },
      { x: cx, y: cy - 11, anchor: "middle", box: { x0: cx - w / 2, x1: cx + w / 2, y0: cy - 11 - lineHeight + 3, y1: cy - 8 } },
      { x: cx, y: cy + 21, anchor: "middle", box: { x0: cx - w / 2, x1: cx + w / 2, y0: cy + 8, y1: cy + 8 + lineHeight } },
    ];
    let fits = null;
    if (inCase.has(n.id)) {
      // The two identities of the case are named in two lines, agent label and the regest
      // with its register entry, turned away from each other and kept inside the image.
      const lines = caseLines(n);
      const cw = Math.max(...lines.map((l) => l.length)) * charWidth;
      const partner = graph.nodes.find((o) => o.id !== n.id && inCase.has(o.id));
      const away = partner && px(partner) >= cx ? "end" : "start";
      const x0 = Math.min(Math.max(2, away === "end" ? cx - 6 - cw : cx + 6), width - 2 - cw);
      const spotAt = (x, y0) => ({ x, y: y0 + lineHeight - 3, anchor: "start", lines, box: { x0: x, x1: x + cw, y0, y1: y0 + 2 * lineHeight } });
      const candidates = [];
      for (const dx of [0, away === "end" ? -40 : 40, away === "end" ? -80 : 80]) {
        for (const y0 of [cy - 8 - 2 * lineHeight, cy + 8, cy - 8 - 3 * lineHeight, cy + 8 + lineHeight, cy - 8 - 4 * lineHeight, cy + 8 + 2 * lineHeight]) {
          const x = Math.min(Math.max(2, x0 + dx), width - 2 - cw);
          if (y0 >= 0 && y0 + 2 * lineHeight <= height) candidates.push(spotAt(x, y0));
        }
      }
      fits = candidates.find((o) => !hits(o.box, n.id)) ?? onPlate(candidates.find((o) => !meetsBox(o.box, n.id)));
    } else if (standing.has(n.id)) {
      // Every standing label keeps clear of nodes, edges and labels; in the dense core it may
      // step up to two lines away from its node to find room.
      const inside = (o) => o.box.x0 >= 0 && o.box.x1 <= width && o.box.y0 >= 0 && o.box.y1 <= height;
      const near = [];
      for (const dy of [0, -14, 14, -28, 28]) {
        for (const o of options.slice(0, 2)) near.push({ ...o, y: o.y + dy, box: { ...o.box, y0: o.box.y0 + dy, y1: o.box.y1 + dy } });
      }
      const all = [...options, ...near];
      // In a whole holding the core is so dense that no place is clear of nodes either; the
      // hub's name then sits on a plate that keeps clear of the other names only.
      fits =
        all.find((o) => inside(o) && !hits(o.box, n.id)) ??
        onPlate(all.find((o) => inside(o) && !meetsBox(o.box, n.id))) ??
        onPlate(all.find((o) => inside(o) && !meetsLabel(o.box)));
    }
    if (fits) {
      spots.set(n.id, fits);
      boxes.push({ ...fits.box, node: `label:${n.id}` });
    }
  }
  return spots;
}

/**
 * Labels in the circle around a person: the person, then the relations of the inner ring,
 * then the people of the outer ring, each turned outwards and kept clear of every placed
 * label and sector name. A label without room appears on pointing or focus.
 */
function placeEgoLabels(graph, ego, selectedId, px, py, width, height, sectorBoxes, segments) {
  const charWidth = 7.4;
  const boxes = [...sectorBoxes];
  const spots = new Map();
  const clear = (b) =>
    b.x0 >= 0 &&
    b.x1 <= width &&
    b.y0 >= 0 &&
    b.y1 <= height &&
    !boxes.some((o) => o.x0 < b.x1 && b.x0 < o.x1 && o.y0 < b.y1 && b.y0 < o.y1) &&
    !segments.some(([a, c]) => segmentHitsBox(a, c, b));
  const nodes = graph.nodes.filter((n) => ego.pos.has(n.id));
  nodes.sort((a, b) => ego.pos.get(a.id).ring - ego.pos.get(b.id).ring);
  for (const n of nodes) {
    const x = px(n);
    const y = py(n);
    boxes.push({ x0: x - 8, x1: x + 8, y0: y - 8, y1: y + 8 });
  }
  const sides = (x) => (x >= width / 2 ? [true, false] : [false, true]);
  const shifts = [0, -13, 13, -26, 26, -39, 39];
  for (const n of nodes) {
    const x = px(n);
    const y = py(n);
    if (n.case) {
      // The case keeps its two lines: name, and regest with register entry.
      const lines = caseLines(n);
      const w = Math.max(...lines.map((l) => l.length)) * charWidth;
      found: for (const right of sides(x)) {
        const x0 = Math.min(Math.max(2, right ? x + 10 : x - 10 - w), width - 2 - w);
        for (const dy of shifts) {
          const box = { x0, x1: x0 + w, y0: y - 12 + dy, y1: y + 18 + dy };
          if (clear(box)) {
            spots.set(n.id, { x: x0, y: y + dy, anchor: "start", lines, box });
            boxes.push(box);
            break found;
          }
        }
      }
      continue;
    }
    const w = n.label.length * charWidth;
    if (n.id === selectedId) {
      // Edges leave the centre in every direction, so the centre's name sits on a plate,
      // placed where it covers no node.
      const free = (b) => !boxes.some((o) => o.x0 < b.x1 && b.x0 < o.x1 && o.y0 < b.y1 && b.y0 < o.y1);
      const tries = [
        [10, -8],
        [-16 - w, -8],
        [-(w + 6) / 2, -30],
        [-(w + 6) / 2, 14],
      ].map(([dx, dy]) => ({ x0: x + dx, x1: x + dx + w + 6, y0: y + dy, y1: y + dy + 16 }));
      // Without a free place the name stays off the picture; the panel heading carries it.
      const box = tries.find(free);
      if (box) {
        spots.set(n.id, { x: box.x0 + 3, y: box.y0 + 12, anchor: "start", box, plate: true });
        boxes.push(box);
      }
      continue;
    }
    found: for (const right of sides(x)) {
      for (const dy of shifts) {
        const x0 = right ? x + 10 : x - 10 - w;
        const box = { x0, x1: x0 + w, y0: y - 9 + dy, y1: y + 5 + dy };
        if (clear(box)) {
          spots.set(n.id, { x: right ? x + 10 : x - 10, y: y + 4 + dy, anchor: right ? "start" : "end", box });
          boxes.push(box);
          break found;
        }
      }
    }
  }
  return spots;
}

/** Agent label and, for a node of the same-name case, regest and register entry. */
function caseLines(n) {
  const reg = n.case.register;
  const numeral = reg?.label.match(/\(([IVXLC]+\.)\)/)?.[1];
  const entry = reg ? `Register ${numeral ?? reg.label}${reg.assigned ? "" : ", nicht zugeordnet"}` : "ohne Registereintrag";
  return [n.label, `${n.case.short}, ${entry}`];
}

/**
 * Layout around one selected person, with meaning in the directions.
 *
 * The person sits in the centre. Its acts, and persons joined to it by parenthood or the
 * same-name case, form the inner ring, each in the fixed sector of its relation family
 * (js/relations.js), so a direction means the same for every person. The other people of
 * those acts form the outer ring on the bearing of their act. Everything else is left out
 * of this picture; deselecting returns to the whole network.
 */
function egoLayout(graph, selectedId, width, height) {
  const cx = width / 2;
  const cy = height / 2;
  // At narrow width the frame names take a larger share, so the rings draw closer in.
  const scale = width < 640 ? 0.8 : 1;
  const rx = (width / 2 - 24) * scale;
  const ry = (height / 2 - 18) * scale;
  const pos = new Map([[selectedId, { x: cx, y: cy, ring: 0 }]]);
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const inner = new Map(FAMILIES.map((f) => [f.key, []]));
  for (const e of graph.edges) {
    if (e.source !== selectedId && e.target !== selectedId) continue;
    const other = byId.get(e.source === selectedId ? e.target : e.source);
    if (!other || [...inner.values()].some((list) => list.includes(other))) continue;
    const family = other.kind === "act" ? familyOf(other.label) : FAMILIES[0];
    inner.get(family.key).push(other);
  }
  const at = (angleDeg, f) => {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + Math.sin(rad) * rx * f, y: cy - Math.cos(rad) * ry * f };
  };
  const used = [];
  for (const family of FAMILIES) {
    const items = inner.get(family.key).sort((a, b) => (a.regest ?? "").localeCompare(b.regest ?? "") || a.label.localeCompare(b.label, "de"));
    if (items.length) used.push(family);
    items.forEach((n, i) => {
      // Spread inside the 45-degree sector, clear of its borders; a crowded sector alternates
      // two radii.
      const offset = items.length === 1 ? 0 : -15 + (30 * i) / (items.length - 1);
      const f = items.length > 3 && i % 2 ? 0.4 : 0.3;
      pos.set(n.id, { ...at(family.angle + offset, f), ring: 1, angle: family.angle + offset });
    });
  }
  // Outer ring: the other people of each inner act stand on the act's own bearing, one
  // behind the other, so each relation reads as one line from the centre outwards.
  for (const [id, p] of [...pos]) {
    if (p.ring !== 1 || byId.get(id).kind !== "act") continue;
    const others = graph.edges
      .filter((e) => e.kind === "role" && (e.source === id || e.target === id))
      .map((e) => (e.source === id ? e.target : e.source))
      .filter((o) => !pos.has(o));
    // The bearing has room from 0.55 to 0.79 of the radius. A long row shrinks its step
    // instead of piling the last people onto one spot, and when the step gets tight every
    // second person moves a few degrees aside so neighbours stay apart.
    const step = others.length > 1 ? Math.min(0.08, 0.24 / (others.length - 1)) : 0;
    others.forEach((o, i) => {
      const aside = step < 0.08 && i % 2 ? 8 : 0;
      pos.set(o, { ...at(p.angle + aside, 0.55 + i * step), ring: 2, angle: p.angle });
    });
  }
  return { pos, used, at };
}

/** Whether the segment a-b crosses or touches the box. */
function segmentHitsBox(a, b, box) {
  const inside = (p) => p.x >= box.x0 && p.x <= box.x1 && p.y >= box.y0 && p.y <= box.y1;
  if (inside(a) || inside(b)) return true;
  const corners = [
    [box.x0, box.y0, box.x1, box.y0],
    [box.x1, box.y0, box.x1, box.y1],
    [box.x1, box.y1, box.x0, box.y1],
    [box.x0, box.y1, box.x0, box.y0],
  ];
  const cross = (x1, y1, x2, y2, x3, y3, x4, y4) => {
    const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
    if (d === 0) return false;
    const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d;
    const u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  };
  return corners.some(([x3, y3, x4, y4]) => cross(a.x, a.y, b.x, b.y, x3, y3, x4, y4));
}

function drawGraph(host, store, graph, height, selected, handlers) {
  const width = Math.max(320, host.clientWidth);
  const narrow = width < 640;
  const pad = narrow ? 28 : 48;
  const ego = selected ? egoLayout(graph, selected, width, height) : null;
  // The build-time layout is normalised by its extremes, so a few small loose components at
  // the edges squeeze the connected core into the middle. The core (5th to 95th percentile)
  // is spread over the inner 88 percent, and the outliers are pressed into the margins.
  const spread = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    const lo = sorted[Math.floor(sorted.length * 0.05)];
    const hi = sorted[Math.ceil(sorted.length * 0.95) - 1];
    const span = hi - lo || 1;
    return (v) => {
      const t = (v - lo) / span;
      if (t < 0) return 0.06 + 0.06 * Math.tanh(t / 0.3);
      if (t > 1) return 0.94 + 0.06 * Math.tanh((t - 1) / 0.3);
      return 0.06 + 0.88 * t;
    };
  };
  const sx = spread(graph.nodes.map((n) => n.x));
  const sy = spread(graph.nodes.map((n) => n.y));
  const px = (n) => (ego ? ego.pos.get(n.id).x : pad + sx(n.x) * (width - 2 * pad));
  const py = (n) => (ego ? ego.pos.get(n.id).y : pad * 0.6 + sy(n.y) * (height - 1.2 * pad));
  const shown = (id) => !ego || ego.pos.has(id);
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const degree = new Map();
  for (const e of graph.edges) for (const id of [e.source, e.target]) degree.set(id, (degree.get(id) ?? 0) + 1);

  const svg = s("svg", { width, height, viewBox: `0 0 ${width} ${height}`, class: `vis-svg${ego ? " is-ego" : ""}` });
  // Sector names at the rim, outside the outer ring; sectors that hold relations of this
  // person are set stronger and get a faint wedge, so their direction reads at a glance.
  const sectorBoxes = [];
  const wedgeEls = new Map();
  if (ego) {
    const rim = s("g", { class: "sectors", "aria-hidden": "true" });
    for (const family of ego.used) {
      const a = ego.at(family.angle - 22.5, 0.9);
      const b = ego.at(family.angle + 22.5, 0.9);
      wedgeEls.set(family.key, rim.appendChild(s("path", { d: `M${width / 2},${height / 2} L${a.x},${a.y} L${b.x},${b.y} Z`, class: "sector-wedge" })));
    }
    for (const family of FAMILIES) {
      // The sign sits on the sector's bearing just outside the shaded field, so it stays next
      // to the relations it names. At narrow width the rings fill the frame, so the sign goes
      // to where the bearing meets the frame.
      const rad = (family.angle * Math.PI) / 180;
      const dx = Math.sin(rad);
      const dy = -Math.cos(rad);
      // One sign per direction, the same as in the list beside, where the family is named;
      // the sign carries the name as its title. The relation names stand inside the circle.
      const used = ego.used.includes(family);
      const w = 18;
      const h = 18;
      let p;
      if (narrow) {
        const reach = Math.min(Math.abs(dx) > 0.01 ? (width / 2 - 4) / Math.abs(dx) : Infinity, Math.abs(dy) > 0.01 ? (height / 2 - 4) / Math.abs(dy) : Infinity);
        p = { x: width / 2 + dx * reach, y: height / 2 + dy * reach };
      } else p = ego.at(family.angle, 0.97);
      const x0 = Math.min(width - w - 2, Math.max(2, p.x - w / 2));
      const top = Math.min(height - h - 2, Math.max(2, p.y - h / 2));
      sectorBoxes.push({ x0, x1: x0 + w, y0: top, y1: top + h, node: `label:sector-${family.key}` });
      const label = familyIcon(family, { size: w, x: x0, y: top, title: true, cls: `sector-label${used ? " is-used" : ""}` });
      // Pointer shortcut to the list row; the keyboard reaches the same row in the list.
      if (used) label.addEventListener("click", () => handlers.onSector?.(family.key));
      rim.append(label);
    }
    svg.append(rim);
  }
  // Every drawn edge as a segment, so labels keep clear of lines as well as of nodes.
  const segments = graph.edges
    .filter((e) => shown(e.source) && shown(e.target))
    .map((e) => [
      { x: px(byId.get(e.source)), y: py(byId.get(e.source)) },
      { x: px(byId.get(e.target)), y: py(byId.get(e.target)) },
    ]);
  const edgeLayer = s("g", { class: "edges", "aria-hidden": "true" });
  const edgeEls = graph.edges.filter((e) => shown(e.source) && shown(e.target)).map((e) => {
    const a = byId.get(e.source);
    const b = byId.get(e.target);
    const cls = e.kind === "parent" ? "e-parent" : e.kind === "same-name" ? "e-same" : "e-role";
    const line = s("line", { x1: px(a), y1: py(a), x2: px(b), y2: py(b), class: cls });
    edgeLayer.append(line);
    return { e, line };
  });
  svg.append(edgeLayer);

  const order = [
    ...graph.nodes.filter((n) => n.kind !== "act" && shown(n.id)).sort((a, b) => a.label.localeCompare(b.label, "de")),
    ...graph.nodes.filter((n) => n.kind === "act" && shown(n.id)).sort((a, b) => a.regest.localeCompare(b.regest) || a.label.localeCompare(b.label, "de")),
  ];
  const labelSpots = ego ? placeEgoLabels(graph, ego, selected, px, py, width, height, sectorBoxes, segments) : placeLabels(graph, px, py, width, height, degree, segments);
  const nodeLayer = s("g", { class: "nodes" });
  const nodeEls = new Map();
  for (const n of order) {
    const cx = px(n);
    const cy = py(n);
    const isAct = n.kind === "act";
    const label = isAct ? `${n.label}, ${store.byUid.get(n.regest).short}` : n.label;
    // In the circle around a person an act is named by its relation type alone.
    const shownLabel = isAct && ego ? n.label : label;
    const caseText = n.case ? `, ${caseLines(n)[1]}` : "";
    const g = s("a", isAct ? { href: regestHref(n.regest, n.claim), class: "node node-act", tabindex: "-1", "aria-label": label } : { href: `#/personen/${encodeURIComponent(n.id)}`, class: "node", tabindex: "-1", "aria-label": `${label}${n.local ? ", lokale Kennung" : ""}${caseText}` });
    // An act is a small diamond, so it never reads as a group (square) or a person (circle).
    if (isAct) g.append(s("path", { d: `M${cx},${cy - 5} L${cx + 5},${cy} L${cx},${cy + 5} L${cx - 5},${cy} Z`, class: "n-act" }));
    else if (n.kind === "group") g.append(s("rect", { x: cx - 5, y: cy - 5, width: 10, height: 10, class: "n-group" }));
    else g.append(s("circle", { cx, cy, r: 5.5, class: `n-person${n.local ? " n-local" : ""}` }));
    g.append(s("circle", { cx, cy, r: 12, class: "n-hit" }));
    const spot = labelSpots.get(n.id);
    const fallbackEnd = cx > width - 160;
    if (spot?.lines) {
      if (spot.plate) g.append(s("rect", { x: spot.box.x0 - 3, y: spot.box.y0, width: spot.box.x1 - spot.box.x0 + 6, height: spot.box.y1 - spot.box.y0, rx: 2, class: "label-plate" }));
      g.append(
        s(
          "text",
          { x: spot.x, y: spot.y, "text-anchor": "start", class: "n-label n-case" },
          s("tspan", { text: spot.lines[0] }),
          s("tspan", { x: spot.x, dy: 15, class: "n-sub", text: spot.lines[1] }),
        ),
      );
    } else {
      if (spot?.plate) g.append(s("rect", { x: spot.box.x0, y: spot.box.y0, width: spot.box.x1 - spot.box.x0, height: spot.box.y1 - spot.box.y0, rx: 2, class: "label-plate" }));
      g.append(
        s("text", {
          x: spot ? spot.x : fallbackEnd ? cx - 9 : cx + 9,
          y: spot ? spot.y : cy + 4,
          "text-anchor": spot ? spot.anchor : fallbackEnd ? "end" : "start",
          class: `n-label${spot ? "" : " on-demand"}`,
          text: shownLabel,
        }),
      );
    }
    g.addEventListener("mouseenter", () => hover(n.id, isAct));
    g.addEventListener("mouseleave", () => hover(null));
    g.addEventListener("focus", () => {
      for (const [, el] of nodeEls) el.setAttribute("tabindex", "-1");
      g.setAttribute("tabindex", "0");
      hover(n.id, isAct, true);
    });
    g.addEventListener("blur", () => hover(null, false, true));
    // A person selects; an act opens its regest as the detail on demand, the link stays
    // for opening in a new tab.
    g.addEventListener("click", (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey) return;
      event.preventDefault();
      if (isAct) handlers.onOpen?.(n.regest, n.claim, n.id);
      else handlers.onSelect(n.id);
    });
    g.addEventListener("keydown", (event) => {
      const at = order.indexOf(n);
      let next = null;
      if (event.key === "ArrowDown" || event.key === "ArrowRight") next = order[Math.min(at + 1, order.length - 1)];
      else if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = order[Math.max(at - 1, 0)];
      else if (event.key === "Home") next = order[0];
      else if (event.key === "End") next = order[order.length - 1];
      if (next) {
        event.preventDefault();
        nodeEls.get(next.id).focus();
      }
    });
    nodeEls.set(n.id, g);
    nodeLayer.append(g);
  }
  nodeEls.get(order[0].id).setAttribute("tabindex", "0");
  // SVG paints in document order: nodes with a standing name go last, so no later node covers
  // the name or its plate. Keyboard order follows `order`, not the DOM.
  for (const id of labelSpots.keys()) if (nodeEls.has(id)) nodeLayer.append(nodeEls.get(id));
  svg.append(nodeLayer);
  host.replaceChildren(svg);

  let previewId = null;
  let sectorKey = null;
  let lastArgs = [null, null, null];
  function preview(id) {
    previewId = id;
    api.highlight(...lastArgs);
  }

  // Pointing flickered when the highlight followed every enter and leave: the gaps between
  // dense nodes switched the whole network between dimmed and full many times a second.
  // The highlight now starts after a short dwell and ends after a short grace, so a pass
  // across neighbours moves the highlight from one node to the next without going dark.
  // Keyboard focus is immediate, because it moves on purpose.
  const DWELL = 90;
  const GRACE = 220;
  let enterTimer = 0;
  let leaveTimer = 0;
  function hover(id, isAct = false, now = false) {
    clearTimeout(enterTimer);
    if (id === null) {
      const end = () => {
        handlers.onPoint(null);
        preview(null);
      };
      if (now) end();
      else leaveTimer = setTimeout(end, GRACE);
      return;
    }
    clearTimeout(leaveTimer);
    if (id === previewId) return;
    const start = () => {
      handlers.onPoint(isAct ? null : id);
      preview(id);
    };
    if (now) start();
    else enterTimer = setTimeout(start, DWELL);
  }

  // Families of the acts around the centre, for highlighting one sector from the list.
  const familyOfNode = new Map();
  if (ego) {
    for (const n of graph.nodes) if (n.kind === "act" && ego.pos.has(n.id) && ego.pos.get(n.id).ring === 1) familyOfNode.set(n.id, familyOf(n.label).key);
    for (const e of graph.edges) if (e.kind === "parent" && (e.source === selected || e.target === selected)) familyOfNode.set(e.source === selected ? e.target : e.source, "kin");
  }

  const api = {
    highlight(uid, actorFocus, selected) {
      lastArgs = [uid, actorFocus, selected];
      if (sectorKey && !previewId && !uid) {
        // A sector pointed at in the list: its acts, their people and the centre stay.
        const keep = new Set([selected]);
        for (const [id, key] of familyOfNode) if (key === sectorKey) keep.add(id);
        for (const e of graph.edges) {
          if (familyOfNode.get(e.source) === sectorKey && e.kind === "role") keep.add(e.target);
          if (familyOfNode.get(e.target) === sectorKey && e.kind === "role") keep.add(e.source);
        }
        for (const [id, el] of nodeEls) {
          el.classList.toggle("is-dim", !keep.has(id));
          el.classList.toggle("is-near", keep.has(id));
          el.classList.toggle("is-selected", id === selected);
        }
        for (const { e, line } of edgeEls) {
          const on = keep.has(e.source) && keep.has(e.target);
          line.classList.toggle("is-on", on);
          line.classList.toggle("is-dim", !on);
        }
        for (const [key, el] of wedgeEls) el.classList.toggle("is-on", key === sectorKey);
        return;
      }
      for (const [, el] of wedgeEls) el.classList.remove("is-on");
      const focusId = previewId ?? actorFocus;
      const near = new Set();
      if (focusId) {
        near.add(focusId);
        for (const e of graph.edges) {
          if (e.source === focusId) near.add(e.target);
          if (e.target === focusId) near.add(e.source);
        }
      }
      const ofRegest = new Set();
      if (uid) {
        for (const e of graph.edges) if (e.regest === uid) (ofRegest.add(e.source), ofRegest.add(e.target));
      }
      // Around a selected person every shown node belongs to it; dimming starts only when
      // something else is pointed at.
      const egoRest = ego && focusId === selected && !uid;
      const active = egoRest ? null : focusId ? near : uid ? ofRegest : null;
      for (const [id, el] of nodeEls) {
        el.classList.toggle("is-dim", !!active && !active.has(id));
        el.classList.toggle("is-near", !!active && active.has(id));
        el.classList.toggle("is-selected", id === selected);
      }
      for (const { e, line } of edgeEls) {
        const on = active ? active.has(e.source) && active.has(e.target) && (!focusId || e.source === focusId || e.target === focusId || e.kind === "same-name") : false;
        line.classList.toggle("is-on", on);
        line.classList.toggle("is-dim", !!active && !on);
      }
    },
    focus(id) {
      nodeEls.get(id)?.focus({ preventScroll: true });
    },
    sector(key) {
      sectorKey = key;
      api.highlight(...lastArgs);
    },
    /** Mark the act whose regest is open. */
    pin(id) {
      for (const [nid, el] of nodeEls) el.classList.toggle("is-pinned", nid === id);
    },
    /** Pointing from outside, the sidebar's act rows: light that act and its people. */
    point(id) {
      preview(id && nodeEls.has(id) ? id : null);
    },
  };
  return api;
}
