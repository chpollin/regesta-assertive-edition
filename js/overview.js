/**
 * The holdings view: two linked visualisations of the pilot run.
 *
 * Timeline. Task: locate the regesta of the run in time against the whole delivery, compare
 * how many statements each carries, see which were corrected or have none, and open one.
 * Person graph. Task: find a person, follow the attested relations (kinship, marriage, roles
 * in acts) and see where the graph keeps two identities apart.
 *
 * Pointing at a regest in the timeline marks its acts and people in the graph; pointing at
 * a person in the graph marks the regesta that mention them in the timeline. Positions of
 * the graph come from build_data.py; nothing is simulated here.
 */
import { h, regestHref } from "./dom.js";

const SVG = "http://www.w3.org/2000/svg";

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
 * @param {import("./app.js").Store} store
 * @param {{actor?: string|null}} options
 */
export function renderOverview(store, options = {}) {
  const { regests, delivery, graph } = store.edition;
  const sameName = graph.edges.filter((e) => e.kind === "same-name");
  const state = { regest: /** @type {string|null} */ (null), actor: /** @type {string|null} */ (options.actor ?? null), previewActor: null };

  const timelineHost = h("div", { class: "vis timeline" });
  const tip = h("div", { class: "tip", role: "status", "aria-live": "polite" });
  const graphHost = h("div", { class: "vis graph" });
  const panel = h("div", { class: "person-panel", "aria-live": "polite" });

  let timeline = null;
  let network = null;

  function sync() {
    const actorFocus = state.previewActor ?? state.actor;
    const regestsOfActor = actorFocus ? new Set(graph.nodes.find((n) => n.id === actorFocus)?.regests ?? []) : null;
    timeline?.highlight(state.regest, regestsOfActor);
    network?.highlight(state.regest, actorFocus, state.actor);
    renderPanel();
  }

  function renderPanel() {
    panel.replaceChildren();
    const node = graph.nodes.find((n) => n.id === state.actor);
    if (!node) return;
    const rels = graph.edges.filter((e) => e.source === node.id || e.target === node.id);
    const inCase = sameName.some((e) => e.source === node.id || e.target === node.id);
    const items = [
      h("p", { class: "panel-name" }, node.label, node.local ? h("span", { class: "panel-flag", text: " lokale Kennung, ohne Registerzuordnung" }) : null),
      node.labels.length > 1 ? h("p", { class: "panel-labels" }, "Etiketten im Graphen: ", node.labels.map((l) => l.label).join(" | ")) : null,
      inCase ? h("p", {}, h("code", { class: "iri", text: node.id })) : null,
      h("ul", { class: "panel-rels", role: "list" }, rels.map((e) => relationItem(e, node.id))),
    ];
    panel.append(...items.filter(Boolean));
  }

  function relationItem(e, nodeId) {
    const other = graph.nodes.find((n) => n.id === (e.source === nodeId ? e.target : e.source));
    const where = e.regest ? h("a", { href: regestHref(e.regest, e.claim), text: store.byUid.get(e.regest).short }) : null;
    let text;
    if (e.kind === "parent") text = e.source === nodeId ? `Elternteil ist ${other.label}` : `Elternteil von ${other.label}`;
    else if (e.kind === "same-name") text = `gleicher Name wie eine zweite Kennung (${other.id})`;
    else text = `${e.label} in ${other.label}`;
    return h("li", {}, text, where ? " " : null, where);
  }

  function draw() {
    timeline = drawTimeline(timelineHost, tip, store, delivery, regests, sameName, graph, {
      onPoint: (uid) => {
        state.regest = uid;
        sync();
      },
      onCase: (actorId) => {
        state.actor = actorId;
        sync();
        graphHost.scrollIntoView({ block: "start" });
        network?.focus(actorId);
      },
    });
    network = drawGraph(graphHost, store, graph, {
      onPoint: (id) => {
        state.previewActor = id;
        sync();
      },
      onSelect: (id) => {
        state.actor = state.actor === id ? null : id;
        history.replaceState(null, "", state.actor ? `#/personen/${encodeURIComponent(state.actor)}` : "#/");
        sync();
      },
    });
    sync();
  }

  const element = h(
    "section",
    { class: "holdings", "aria-labelledby": "holdings-title" },
    h("div", { class: "title-row" }, h("h1", { id: "holdings-title", text: "Regesten des Pilotlaufs" })),
    h(
      "section",
      { class: "vis-section", "aria-labelledby": "timeline-title" },
      h("h2", { id: "timeline-title", text: "Zeit" }),
      timelineLegend(delivery, regests, sameName.length > 0),
      timelineHost,
      tip,
      regestList(regests),
    ),
    h(
      "section",
      { class: "vis-section", "aria-labelledby": "graph-title" },
      h("h2", { id: "graph-title", text: "Personen und ihre belegten Beziehungen" }),
      graphLegend(sameName.length > 0, graph),
      h("div", { class: "graph-layout" }, graphHost, panel),
      personList(store, graph),
    ),
  );

  // Draw once attached, so the SVG takes the real width; redraw on resize.
  let lastWidth = 0;
  const observer = new ResizeObserver(() => {
    const w = Math.round(timelineHost.clientWidth);
    if (w && w !== lastWidth) {
      lastWidth = w;
      draw();
    }
  });
  observer.observe(timelineHost);

  return {
    element,
    focus: options.actor
      ? () => {
          requestAnimationFrame(() => {
            graphHost.scrollIntoView({ block: "start" });
            network?.focus(options.actor);
          });
        }
      : null,
  };
}

function timelineLegend(delivery, regests, hasCase) {
  const glyph = (kind) => markGlyph(kind, 14);
  return h(
    "p",
    { class: "vis-legend" },
    h("span", { class: "legend-item" }, h("span", { class: "bar-sample", "aria-hidden": "true" }), `alle ${delivery.total} Regesten der Lieferung je Jahr`),
    h("span", { class: "legend-item" }, glyph("plain"), "Regest des Laufs, Höhe nach Zahl der Aussagen"),
    regests.some((r) => r.notes.corrected) ? h("span", { class: "legend-item" }, glyph("corrected"), "nach Review korrigiert") : null,
    regests.some((r) => r.claims === 0) ? h("span", { class: "legend-item" }, glyph("empty"), "keine Aussage") : null,
    h("span", { class: "legend-item" }, h("span", { class: "span-sample", "aria-hidden": "true" }), "Spanne der Datierung"),
    hasCase ? h("span", { class: "legend-item" }, h("span", { class: "case-sample", "aria-hidden": "true" }), "Elternteil mit zwei Kennungen") : null,
  );
}

function graphLegend(hasCase, graph) {
  const svg = (child) => s("svg", { class: "glyph", width: 16, height: 16, viewBox: "-8 -8 16 16", "aria-hidden": "true" }, child);
  return h(
    "p",
    { class: "vis-legend" },
    h("span", { class: "legend-item" }, svg(s("circle", { r: 5, class: "n-person" })), "Person"),
    graph.nodes.some((n) => n.kind === "group") ? h("span", { class: "legend-item" }, svg(s("rect", { x: -5, y: -5, width: 10, height: 10, class: "n-group" })), "Gruppe oder Institution") : null,
    graph.nodes.some((n) => n.local) ? h("span", { class: "legend-item" }, svg(s("circle", { r: 4.5, class: "n-person n-local" })), "lokale Kennung, ohne Registerzuordnung") : null,
    h("span", { class: "legend-item" }, svg(s("rect", { x: -3.5, y: -3.5, width: 7, height: 7, class: "n-act" })), "Vorgang, mit Rolle verbunden"),
    h("span", { class: "legend-item" }, svg(s("line", { x1: -8, y1: 0, x2: 8, y2: 0, class: "e-parent" })), "Elternteil"),
    hasCase ? h("span", { class: "legend-item" }, svg(s("line", { x1: -8, y1: 0, x2: 8, y2: 0, class: "e-same" })), "gleicher Name, andere Kennung") : null,
  );
}

/** Small mark used in legend and list, the same form as on the axis. */
function markGlyph(kind, size) {
  const svg = s("svg", { class: "glyph", width: size, height: size, viewBox: "-7 -7 14 14", "aria-hidden": "true" });
  if (kind === "corrected") svg.append(s("path", { d: "M0,-6 L5.5,4 L-5.5,4 Z", class: "m-head" }));
  else if (kind === "empty") svg.append(s("circle", { r: 4.5, class: "m-empty" }));
  else svg.append(s("circle", { r: 4.5, class: "m-head" }));
  return svg;
}

function markWords(r) {
  const parts = [r.claims === 0 ? "keine Aussage" : `${r.claims} ${r.claims === 1 ? "Aussage" : "Aussagen"}`];
  if (r.notes.corrected) parts.push("nach Review korrigiert");
  return parts.join(", ");
}

/** The text counterpart of the timeline, kept quiet: closed until asked for. */
function regestList(regests) {
  return h(
    "details",
    { class: "vis-text" },
    h("summary", { text: "Die Regesten des Laufs als Liste" }),
    h(
      "ul",
      { class: "regest-list", role: "list" },
      regests.map((r) =>
        h(
          "li",
          {},
          markGlyph(r.claims === 0 ? "empty" : r.notes.corrected ? "corrected" : "plain", 12),
          h("a", { href: regestHref(r.uid), text: r.identifier }),
          h("span", { class: "visually-hidden", text: `, ${markWords(r)}: ` }),
          h("span", { class: "lead source", text: r.lead }),
        ),
      ),
    ),
  );
}

function personList(store, graph) {
  const actors = graph.nodes.filter((n) => n.kind !== "act").sort((a, b) => a.label.localeCompare(b.label, "de"));
  return h(
    "details",
    { class: "vis-text" },
    h("summary", { text: "Personen und Beziehungen als Liste" }),
    h(
      "ul",
      { class: "person-list", role: "list" },
      actors.map((a) => {
        const rels = graph.edges.filter((e) => e.source === a.id || e.target === a.id);
        return h(
          "li",
          {},
          h("span", { class: "person-name", text: a.label }),
          " ",
          rels.map((e, i) => {
            const other = graph.nodes.find((n) => n.id === (e.source === a.id ? e.target : e.source));
            const what = e.kind === "parent" ? (e.source === a.id ? `Elternteil ${other.label}` : `Elternteil von ${other.label}`) : e.kind === "same-name" ? "gleicher Name wie eine zweite Kennung" : `${e.label} in ${other.label}`;
            return h("span", {}, i ? " | " : "", what, e.regest ? " " : "", e.regest ? h("a", { href: regestHref(e.regest, e.claim), text: store.byUid.get(e.regest).short }) : null);
          }),
        );
      }),
    ),
  );
}

/** Fractional year of an ISO date. */
function yearOf(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return y + ((m - 1) * 30.4 + (d - 1)) / 365;
}

function drawTimeline(host, tip, store, delivery, regests, sameName, graph, handlers) {
  const width = Math.max(320, host.clientWidth);
  const narrow = width < 640;
  const height = narrow ? 240 : 300;
  const m = { l: narrow ? 8 : 12, r: narrow ? 8 : 12, t: 54, b: 30 };
  const iw = width - m.l - m.r;
  const ih = height - m.t - m.b;
  const y0 = delivery.years[0][0];
  const y1 = delivery.years[delivery.years.length - 1][0] + 1;
  const x = (year) => m.l + ((year - y0) / (y1 - y0)) * iw;
  const base = m.t + ih;
  const maxCount = Math.max(...delivery.years.map((d) => d[1]));
  const maxClaims = Math.max(...regests.map((r) => r.claims));
  const bw = Math.max(1, iw / (y1 - y0) - (narrow ? 1 : 2));

  const svg = s("svg", { width, height, viewBox: `0 0 ${width} ${height}`, role: "group", "aria-labelledby": "timeline-title", class: "vis-svg" });
  const bars = s("g", { class: "bars", "aria-hidden": "true" });
  for (const [year, count] of delivery.years) {
    if (!count) continue;
    const bh = (count / maxCount) * ih;
    bars.append(s("rect", { x: x(year) + 0.5, y: base - bh, width: bw, height: bh }));
  }
  const peak = delivery.years.reduce((a, b) => (b[1] > a[1] ? b : a));
  bars.append(s("text", { x: x(peak[0]) + bw, y: base - ih - 6, "text-anchor": "end", class: "peak", text: `${peak[1]} Regesten ${peak[0]}` }));
  svg.append(bars);

  const axis = s("g", { class: "axis", "aria-hidden": "true" });
  axis.append(s("line", { x1: m.l, x2: width - m.r, y1: base, y2: base }));
  const stepYears = narrow ? 20 : 10;
  for (let year = Math.ceil(y0 / stepYears) * stepYears; year < y1; year += stepYears) {
    axis.append(s("text", { x: x(year), y: base + 20, "text-anchor": "middle", text: String(year) }));
  }
  svg.append(axis);

  // Run marks, displaced to the right where they would overlap; a tick keeps the true date.
  const placed = regests
    .map((r) => ({ r, tx: x(yearOf(r.start)), ex: x(yearOf(r.end)) }))
    .sort((a, b) => a.tx - b.tx);
  let lastX = -Infinity;
  for (const p of placed) {
    p.x = Math.max(p.tx, lastX + (narrow ? 9 : 12));
    lastX = p.x;
    p.top = p.r.claims === 0 ? base : base - 10 - (p.r.claims / maxClaims) * (ih - 24);
  }
  const marks = s("g", { class: "marks" });
  const byUid = new Map();
  for (const p of placed) {
    const r = p.r;
    const kind = r.claims === 0 ? "empty" : r.notes.corrected ? "corrected" : "plain";
    const g = s("a", {
      href: regestHref(r.uid),
      class: "mark",
      tabindex: "-1",
      "aria-label": `${r.identifier}, ${dateText(r)}, ${markWords(r)}`,
    });
    if (p.ex - p.tx > 1.5) g.append(s("line", { x1: p.tx, x2: p.ex, y1: base + 3, y2: base + 3, class: "m-span" }));
    if (Math.abs(p.x - p.tx) > 0.5) g.append(s("line", { x1: p.tx, x2: p.x, y1: base, y2: base - 4, class: "m-shift" }));
    if (kind !== "empty") g.append(s("line", { x1: p.x, x2: p.x, y1: base, y2: p.top, class: "m-stem" }));
    if (kind === "corrected") g.append(s("path", { d: `M${p.x},${p.top - 6} L${p.x + 5.5},${p.top + 4} L${p.x - 5.5},${p.top + 4} Z`, class: "m-head" }));
    else if (kind === "empty") g.append(s("circle", { cx: p.x, cy: base - 6, r: 4.5, class: "m-empty" }));
    else g.append(s("circle", { cx: p.x, cy: p.top, r: 4.5, class: "m-head" }));
    g.append(s("circle", { cx: p.x, cy: kind === "empty" ? base - 6 : p.top, r: 11, class: "m-hit" }));
    const show = () => {
      handlers.onPoint(r.uid);
      tip.replaceChildren(
        h("span", { class: "tip-id", text: r.identifier }),
        h("span", { class: "tip-date source", text: ` ${dateText(r)}` }),
        h("span", { class: "tip-words", text: ` ${markWords(r)}` }),
        h("span", { class: "tip-lead source", text: r.lead }),
      );
      tip.classList.add("is-on");
    };
    const hide = () => {
      handlers.onPoint(null);
      tip.classList.remove("is-on");
    };
    g.addEventListener("mouseenter", show);
    g.addEventListener("mouseleave", hide);
    g.addEventListener("focus", show);
    g.addEventListener("blur", hide);
    g.addEventListener("keydown", (event) => {
      const at = placed.indexOf(p);
      let next = null;
      if (event.key === "ArrowRight") next = placed[Math.min(at + 1, placed.length - 1)];
      else if (event.key === "ArrowLeft") next = placed[Math.max(at - 1, 0)];
      else if (event.key === "Home") next = placed[0];
      else if (event.key === "End") next = placed[placed.length - 1];
      if (next) {
        event.preventDefault();
        for (const q of placed) q.el.setAttribute("tabindex", q === next ? "0" : "-1");
        next.el.focus();
      }
    });
    p.el = g;
    byUid.set(r.uid, p);
    marks.append(g);
  }
  placed[0].el.setAttribute("tabindex", "0");

  // The case found by the question on same-name parents: an arc between its two regesta.
  const caseLayer = s("g", { class: "case" });
  for (const e of sameName) {
    const parentEdges = graph.edges.filter((pe) => pe.kind === "parent" && (pe.target === e.source || pe.target === e.target));
    const ends = parentEdges.map((pe) => byUid.get(pe.regest)).filter(Boolean);
    if (ends.length !== 2) continue;
    const [a, b] = ends.sort((p1, p2) => p1.x - p2.x);
    const lift = Math.min(a.top, b.top) - 26;
    const child = graph.nodes.find((n) => n.id === parentEdges[0].source);
    const link = s(
      "a",
      { href: `#/personen/${encodeURIComponent(child.id)}`, class: "case-link", "aria-label": `${child.label}: Elternteil mit zwei Kennungen in ${a.r.short} und ${b.r.short}` },
      s("path", { d: `M${a.x},${a.top - 8} C${a.x},${lift} ${b.x},${lift} ${b.x},${b.top - 8}`, class: "case-arc" }),
      s("text", { x: (a.x + b.x) / 2, y: lift - 2, "text-anchor": "middle", class: "case-label", text: child.label }),
    );
    link.addEventListener("click", (event) => {
      event.preventDefault();
      handlers.onCase(child.id);
    });
    caseLayer.append(link);
  }
  svg.append(caseLayer, marks);
  host.replaceChildren(svg);

  return {
    highlight(uid, regestSet) {
      for (const p of placed) {
        p.el.classList.toggle("is-pointed", p.r.uid === uid);
        p.el.classList.toggle("is-related", !!regestSet && regestSet.has(p.r.uid));
        p.el.classList.toggle("is-dim", !!regestSet && !regestSet.has(p.r.uid));
      }
    },
  };
}

/**
 * Greedy label placement: people in the same-name case first, then kin, then by degree.
 * A label goes right, left, above or below its node where it hits no other label or node;
 * a label that finds no place appears on pointing or focus.
 */
function placeLabels(graph, px, py, width, height, degree) {
  const charWidth = 6.9;
  const lineHeight = 15;
  const inCase = new Set(graph.edges.filter((e) => e.kind === "same-name").flatMap((e) => [e.source, e.target]));
  const kin = new Set(graph.edges.filter((e) => e.kind === "parent").flatMap((e) => [e.source, e.target]));
  const actors = graph.nodes.filter((n) => n.kind !== "act");
  const rank = (n) => (inCase.has(n.id) ? 0 : kin.has(n.id) ? 1 : 2);
  actors.sort((a, b) => rank(a) - rank(b) || (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0) || a.label.localeCompare(b.label, "de"));
  // Acts are small and unlabeled, so labels may cross them; people and groups keep clear.
  const boxes = actors.map((n) => ({ x0: px(n) - 7, x1: px(n) + 7, y0: py(n) - 7, y1: py(n) + 7, node: n.id }));
  const spots = new Map();
  const hits = (b, self) => boxes.some((o) => o.node !== self && o.x0 < b.x1 && b.x0 < o.x1 && o.y0 < b.y1 && b.y0 < o.y1);
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
      // The two identities of the case are always named, above their node and turned away
      // from each other, so the pair stays readable at any width.
      const partner = graph.nodes.find((o) => o.id !== n.id && inCase.has(o.id));
      const away = partner && px(partner) >= cx ? "end" : "start";
      const x0 = away === "end" ? cx - 4 - w : cx + 4;
      fits = { x: away === "end" ? cx - 4 : cx + 4, y: cy - 10, anchor: away, box: { x0, x1: x0 + w, y0: cy - 24, y1: cy - 7 } };
    } else {
      fits = options.find((o) => o.box.x0 >= 0 && o.box.x1 <= width && o.box.y0 >= 0 && o.box.y1 <= height && !hits(o.box, n.id));
    }
    if (fits) {
      spots.set(n.id, fits);
      boxes.push({ ...fits.box, node: `label:${n.id}` });
    }
  }
  return spots;
}

function dateText(r) {
  return r.date.map((seg) => seg.t).join("") || "ohne Datierung";
}

function drawGraph(host, store, graph, handlers) {
  const width = Math.max(320, host.clientWidth);
  const narrow = width < 640;
  const height = narrow ? 520 : 640;
  const pad = narrow ? 28 : 70;
  const px = (n) => pad + n.x * (width - 2 * pad);
  const py = (n) => pad * 0.6 + n.y * (height - 1.2 * pad);
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const degree = new Map();
  for (const e of graph.edges) for (const id of [e.source, e.target]) degree.set(id, (degree.get(id) ?? 0) + 1);

  const svg = s("svg", { width, height, viewBox: `0 0 ${width} ${height}`, role: "group", "aria-labelledby": "graph-title", class: "vis-svg" });
  const edgeLayer = s("g", { class: "edges", "aria-hidden": "true" });
  const edgeEls = graph.edges.map((e) => {
    const a = byId.get(e.source);
    const b = byId.get(e.target);
    const cls = e.kind === "parent" ? "e-parent" : e.kind === "same-name" ? "e-same" : "e-role";
    const line = s("line", { x1: px(a), y1: py(a), x2: px(b), y2: py(b), class: cls });
    edgeLayer.append(line);
    return { e, line };
  });
  svg.append(edgeLayer);

  const order = [
    ...graph.nodes.filter((n) => n.kind !== "act").sort((a, b) => a.label.localeCompare(b.label, "de")),
    ...graph.nodes.filter((n) => n.kind === "act").sort((a, b) => a.regest.localeCompare(b.regest) || a.label.localeCompare(b.label, "de")),
  ];
  const labelSpots = placeLabels(graph, px, py, width, height, degree);
  const nodeLayer = s("g", { class: "nodes" });
  const nodeEls = new Map();
  for (const n of order) {
    const cx = px(n);
    const cy = py(n);
    const isAct = n.kind === "act";
    const label = isAct ? `${n.label}, ${store.byUid.get(n.regest).short}` : n.label;
    const g = s("a", isAct ? { href: regestHref(n.regest, n.claim), class: "node node-act", tabindex: "-1", "aria-label": label } : { href: `#/personen/${encodeURIComponent(n.id)}`, class: "node", tabindex: "-1", "aria-label": `${label}${n.local ? ", lokale Kennung" : ""}` });
    if (isAct) g.append(s("rect", { x: cx - 3.5, y: cy - 3.5, width: 7, height: 7, class: "n-act" }));
    else if (n.kind === "group") g.append(s("rect", { x: cx - 5, y: cy - 5, width: 10, height: 10, class: "n-group" }));
    else g.append(s("circle", { cx, cy, r: 5.5, class: `n-person${n.local ? " n-local" : ""}` }));
    g.append(s("circle", { cx, cy, r: 12, class: "n-hit" }));
    const spot = labelSpots.get(n.id);
    const fallbackEnd = cx > width - 160;
    g.append(
      s("text", {
        x: spot ? spot.x : fallbackEnd ? cx - 9 : cx + 9,
        y: spot ? spot.y : cy + 4,
        "text-anchor": spot ? spot.anchor : fallbackEnd ? "end" : "start",
        class: `n-label${spot ? "" : " on-demand"}`,
        text: label,
      }),
    );
    g.addEventListener("mouseenter", () => {
      handlers.onPoint(isAct ? null : n.id);
      preview(n.id);
    });
    g.addEventListener("mouseleave", () => {
      handlers.onPoint(null);
      preview(null);
    });
    g.addEventListener("focus", () => {
      for (const [, el] of nodeEls) el.setAttribute("tabindex", "-1");
      g.setAttribute("tabindex", "0");
      handlers.onPoint(isAct ? null : n.id);
      preview(n.id);
    });
    g.addEventListener("blur", () => {
      handlers.onPoint(null);
      preview(null);
    });
    if (!isAct) {
      g.addEventListener("click", (event) => {
        event.preventDefault();
        handlers.onSelect(n.id);
      });
    }
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
  svg.append(nodeLayer);
  host.replaceChildren(svg);

  let previewId = null;
  let lastArgs = [null, null, null];
  function preview(id) {
    previewId = id;
    api.highlight(...lastArgs);
  }

  const api = {
    highlight(uid, actorFocus, selected) {
      lastArgs = [uid, actorFocus, selected];
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
      const active = focusId ? near : uid ? ofRegest : null;
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
  };
  return api;
}
