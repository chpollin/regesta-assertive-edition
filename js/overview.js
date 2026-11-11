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
import { FAMILIES, familyOf } from "./relations.js";

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
 * @param {import("./app.js").Store} store
 * @param {{actor?: string|null}} options
 */
export function renderOverview(store, options = {}) {
  const { regests, delivery, graph } = store.edition;
  const sameName = graph.edges.filter((e) => e.kind === "same-name");
  const caseInfo = findCase();
  // Without an address the view opens on the case, the entry the talk starts from.
  const state = {
    regest: /** @type {string|null} */ (null),
    actor: /** @type {string|null} */ (options.actor ?? caseInfo?.child.id ?? null),
    previewActor: null,
    list: false,
  };

  const timelineHost = h("div", { class: "vis timeline" });
  const tip = h("p", { class: "tip", role: "status", "aria-live": "polite" });
  const graphHost = h("div", { class: "vis graph" });
  const panel = h("div", { class: "person-panel", "aria-live": "polite" });
  const listButton = h("button", { type: "button", class: "tool", "aria-pressed": "false", onclick: toggleList }, "Liste");

  let timeline = null;
  let network = null;

  function sync() {
    const actorFocus = state.previewActor ?? state.actor;
    const regestsOfActor = actorFocus ? new Set(graph.nodes.find((n) => n.id === actorFocus)?.regests ?? []) : null;
    timeline?.highlight(state.regest, regestsOfActor);
    network?.highlight(state.regest, actorFocus, state.actor);
    renderPanel();
  }

  /** The child and the two parent nodes of the same-name case, if the run has one. */
  function findCase() {
    const pair = sameName[0];
    if (!pair) return null;
    const parents = [pair.source, pair.target].map((id) => graph.nodes.find((n) => n.id === id)).filter((n) => n?.case);
    const child = graph.nodes.find((n) => graph.edges.some((e) => e.kind === "parent" && e.source === n.id && e.target === pair.source));
    if (parents.length !== 2 || !child) return null;
    parents.sort((a, b) => store.byUid.get(a.case.regest).sort.localeCompare(store.byUid.get(b.case.regest).sort));
    return { child, parents, ids: new Set([child.id, ...parents.map((p) => p.id)]) };
  }

  function renderPanel() {
    if (state.list) {
      const lists = [regestList(regests), personList(store, graph)];
      for (const d of lists) d.open = true;
      panel.replaceChildren(...lists);
      return;
    }
    panel.replaceChildren();
    const node = graph.nodes.find((n) => n.id === state.actor);
    if (!node) {
      panel.append(h("p", { class: "panel-hint", text: "Wähle ein Regest auf der Zeitleiste oder eine Person im Graphen." }));
      return;
    }
    const rels = graph.edges.filter((e) => (e.source === node.id || e.target === node.id) && e.kind !== "same-name");
    const items = [
      h("p", { class: "panel-name" }, node.label, node.local ? h("span", { class: "panel-flag", text: " lokale Kennung" }) : null),
      caseInfo?.ids.has(node.id) ? caseLinesEl() : null,
      groupedRelations(rels, node.id),
      node.labels.length > 1 ? h("p", { class: "panel-labels" }, "auch: ", node.labels.slice(1).map((l) => l.label).join(" | ")) : null,
      node.case ? h("details", { class: "panel-iri" }, h("summary", { text: "Kennung" }), h("code", { class: "iri", text: node.id })) : null,
    ];
    panel.append(...items.filter(Boolean));
  }

  /** The case in two lines, one per father: regest, register entry, assignment. */
  function caseLinesEl() {
    const line = (p) => {
      const reg = p.case.register;
      return h(
        "li",
        {},
        h("button", { type: "button", class: "link-button", onclick: () => select(p.id) }, `Vater in ${p.case.short}`),
        " ",
        reg ? h("span", { class: "source", text: reg.label }) : "ohne Registereintrag",
        reg && !reg.assigned ? h("span", { class: "panel-flag", text: ", nicht zugeordnet" }) : null,
      );
    };
    return h(
      "div",
      { class: "case-box" },
      h("p", { class: "case-title", text: "Zwei Väter gleichen Namens, Identität offen" }),
      h("ul", { class: "panel-rels", role: "list" }, caseInfo.parents.map(line)),
    );
  }

  function select(id) {
    state.actor = id;
    state.previewActor = null;
    state.list = false;
    listButton.setAttribute("aria-pressed", "false");
    history.replaceState(null, "", `#/personen/${encodeURIComponent(id)}`);
    if (lastGraphHeight) drawNetwork();
    sync();
    network?.focus(id);
  }

  function toggleList() {
    state.list = !state.list;
    listButton.setAttribute("aria-pressed", String(state.list));
    renderPanel();
  }

  /**
   * The relations of a person in the order of the eight families of the circle, each
   * distinct "role in act type" once with all its regesta, so list and picture mirror.
   */
  function groupedRelations(rels, nodeId) {
    const groups = new Map(FAMILIES.map((f) => [f.key, new Map()]));
    for (const e of rels) {
      const other = graph.nodes.find((n) => n.id === (e.source === nodeId ? e.target : e.source));
      let family;
      let text;
      if (e.kind === "parent") {
        family = FAMILIES[0];
        text = e.source === nodeId ? `Elternteil ist ${other.label}` : `Elternteil von ${other.label}`;
      } else {
        family = familyOf(other.label);
        text = `${e.label} in ${other.label}`;
      }
      const entries = groups.get(family.key);
      if (!entries.has(text)) entries.set(text, []);
      if (e.regest) entries.get(text).push(e);
    }
    return h(
      "div",
      { class: "rel-groups" },
      FAMILIES.filter((f) => groups.get(f.key).size).map((f) =>
        h(
          "section",
          { class: "rel-group", "aria-label": f.label },
          h("p", { class: "rel-family", text: f.label }),
          h(
            "ul",
            { class: "panel-rels", role: "list" },
            [...groups.get(f.key)].map(([text, edges]) =>
              h("li", {}, text, " ", ...edges.flatMap((e, i) => [i ? ", " : "", h("a", { href: regestHref(e.regest, e.claim), text: store.byUid.get(e.regest).short })])),
            ),
          ),
        ),
      ),
    );
  }

  function draw() {
    // Heights follow the window, so the strip, the graph and the panel fit one screen at
    // working width; below it the parts stack and the graph keeps a fixed share.
    const wide = element.clientWidth > 900;
    const top = element.getBoundingClientRect().top + window.scrollY;
    const below = parseFloat(getComputedStyle(element.parentElement).paddingBlockEnd) || 0;
    const room = Math.max(420, window.innerHeight - top - below - 8);
    const stripHeight = Math.round(Math.min(170, Math.max(120, room * 0.24)));
    const graphHeight = wide ? Math.max(300, room - stripHeight - toolbar.offsetHeight - 12) : Math.round(window.innerHeight * 0.62);
    element.style.setProperty("--graph-height", `${graphHeight}px`);
    timeline = drawTimeline(timelineHost, tip, store, delivery, regests, sameName, graph, stripHeight, {
      onPoint: (uid) => {
        state.regest = uid;
        sync();
      },
      onCase: (actorId) => select(actorId),
    });
    lastGraphHeight = graphHeight;
    drawNetwork();
    sync();
  }

  // The graph is drawn again whenever the selection changes, because a selected person gets
  // its own circle of relations.
  let lastGraphHeight = 0;
  function drawNetwork() {
    network = drawGraph(graphHost, store, graph, lastGraphHeight, state.actor, {
      onPoint: (id) => {
        state.previewActor = id;
        sync();
      },
      onSelect: (id) => {
        const next = state.actor === id ? null : id;
        if (next) select(next);
        else {
          state.actor = null;
          state.previewActor = null;
          history.replaceState(null, "", "#/");
          drawNetwork();
          sync();
        }
      },
    });
  }

  const legend = h(
    "details",
    { class: "legend-pop" },
    h("summary", { class: "tool", "aria-label": "Zeichen erklären", title: "Zeichen erklären" }, "?"),
    h("div", { class: "legend-body" }, timelineLegend(delivery, regests, sameName.length > 0), graphLegend(sameName.length > 0, graph)),
  );
  const toolbar = h("div", { class: "holdings-bar" }, tip, h("div", { class: "tools" }, listButton, legend));

  const element = h(
    "section",
    { class: "holdings", "aria-labelledby": "holdings-title" },
    h("h1", { id: "holdings-title", class: "visually-hidden", text: store.edition.run.dataModel === "factoid" ? "Regesten des Faktoid-Laufs, Zeit und Personen" : "Regesten des Pilotlaufs, Zeit und Personen" }),
    toolbar,
    h("div", { class: "strip", role: "group", "aria-label": "Zeitleiste der Regesten vor der ganzen Lieferung" }, timelineHost),
    h("div", { class: "graph-main", role: "group", "aria-label": "Personen und ihre belegten Beziehungen" }, graphHost),
    h("aside", { class: "side", "aria-label": "Auswahl" }, panel),
  );

  // Draw once attached, so the SVG takes the real width; redraw on resize.
  let lastSize = "";
  const observer = new ResizeObserver(() => {
    const size = `${Math.round(timelineHost.clientWidth)}x${window.innerHeight}`;
    if (timelineHost.clientWidth && size !== lastSize) {
      lastSize = size;
      draw();
    }
  });
  observer.observe(timelineHost);

  return {
    element,
    focus: options.actor
      ? () => {
          requestAnimationFrame(() => network?.focus(options.actor));
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
    regests.some((r) => r.proseYears?.length)
      ? h("span", { class: "legend-item" }, s("svg", { class: "glyph", width: 14, height: 14, viewBox: "-7 -7 14 14", "aria-hidden": "true" }, s("path", { d: "M0,-5 L4.5,0 L0,5 L-4.5,0 Z", class: "m-alt" })), "anderes Jahr im Datierungstext")
      : null,
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
    h("span", { class: "legend-item" }, svg(s("path", { d: "M0,-5 L5,0 L0,5 L-5,0 Z", class: "n-act" })), "Vorgang (Relation), mit Rolle verbunden"),
    h("span", { class: "legend-item" }, "Um eine gewählte Person steht jede Relationsart in fester Richtung, beschriftet am Rand."),
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
          a.case ? ` (${caseLines(a)[1]})` : "",
          " ",
          rels.map((e, i) => {
            const other = graph.nodes.find((n) => n.id === (e.source === a.id ? e.target : e.source));
            const what = e.kind === "parent" ? (e.source === a.id ? `Elternteil ${other.label}` : `Elternteil von ${other.label}`) : e.kind === "same-name" ? (other.case ? `gleicher Name wie die Person aus ${other.case.short}` : "gleicher Name wie eine zweite Kennung") : `${e.label} in ${other.label}`;
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

function drawTimeline(host, tip, store, delivery, regests, sameName, graph, height, handlers) {
  const width = Math.max(320, host.clientWidth);
  const narrow = width < 640;
  const m = { l: narrow ? 8 : 12, r: narrow ? 8 : 12, t: 34, b: 30 };
  const iw = width - m.l - m.r;
  const ih = height - m.t - m.b;
  const y0 = delivery.years[0][0];
  const y1 = delivery.years[delivery.years.length - 1][0] + 1;
  const x = (year) => m.l + ((year - y0) / (y1 - y0)) * iw;
  const base = m.t + ih;
  const maxCount = Math.max(...delivery.years.map((d) => d[1]));
  const maxClaims = Math.max(...regests.map((r) => r.claims));
  const bw = Math.max(1, iw / (y1 - y0) - (narrow ? 1 : 2));

  const svg = s("svg", { width, height, viewBox: `0 0 ${width} ${height}`, class: "vis-svg" });
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

  // Every mark stands at its delivered date. Where two heads would overlap, the head moves up
  // or down to the nearest free height, so a mark never leaves its year. The shift is small
  // against the scale, and the exact count stays in the status line, accessible name and list.
  const gap = 10;
  const placed = regests
    .map((r) => ({ r, x: x(yearOf(r.start)), ex: x(yearOf(r.end)) }))
    .sort((a, b) => a.x - b.x || a.r.sort.localeCompare(b.r.sort));
  const heads = [];
  const lowest = base - 10;
  for (const p of placed) {
    p.top = p.r.claims === 0 ? base : base - 10 - (p.r.claims / maxClaims) * (ih - 24);
    if (p.r.claims === 0) continue;
    const free = (y) => y <= lowest && !heads.some((q) => Math.abs(q.x - p.x) < gap && Math.abs(q.top - y) < gap);
    for (let d = 0; d < ih; d += 1) {
      if (free(p.top - d)) { p.top -= d; break; }
      if (free(p.top + d)) { p.top += d; break; }
    }
    heads.push(p);
  }
  const marks = s("g", { class: "marks" });
  const byUid = new Map();
  for (const p of placed) {
    const r = p.r;
    const kind = r.claims === 0 ? "empty" : r.notes.corrected ? "corrected" : "plain";
    const others = r.proseYears ?? [];
    const g = s("a", {
      href: regestHref(r.uid),
      class: "mark",
      tabindex: "-1",
      "aria-label": `${r.identifier}, ${dateText(r)}${others.length ? `, Datierungstext nennt ${others.join(" und ")}` : ""}, ${markWords(r)}`,
    });
    if (p.ex - p.x > 1.5) g.append(s("line", { x1: p.x, x2: p.ex, y1: base + 3, y2: base + 3, class: "m-span" }));
    // A year the dating prose names outside the delivered interval stays visible as an open
    // diamond on the baseline, joined to the mark by a dotted line.
    for (const year of others) {
      const ax = x(year + 0.5);
      g.append(
        s("line", { x1: p.x, x2: ax, y1: base + 9, y2: base + 9, class: "m-alt-link" }),
        s("path", { d: `M${ax},${base + 4} L${ax + 4.5},${base + 9} L${ax},${base + 14} L${ax - 4.5},${base + 9} Z`, class: "m-alt" }),
      );
    }
    if (kind !== "empty") g.append(s("line", { x1: p.x, x2: p.x, y1: base, y2: p.top, class: "m-halo" }), s("line", { x1: p.x, x2: p.x, y1: base, y2: p.top, class: "m-stem" }));
    if (kind === "corrected") g.append(s("path", { d: `M${p.x},${p.top - 6} L${p.x + 5.5},${p.top + 4} L${p.x - 5.5},${p.top + 4} Z`, class: "m-head" }));
    else if (kind === "empty") g.append(s("circle", { cx: p.x, cy: base - 6, r: 4.5, class: "m-empty" }));
    else g.append(s("circle", { cx: p.x, cy: p.top, r: 4.5, class: "m-head" }));
    g.append(s("circle", { cx: p.x, cy: kind === "empty" ? base - 6 : p.top, r: 12, class: "m-hit" }));
    const people = graph.nodes.filter((n) => n.kind !== "act" && n.regests.includes(r.uid)).length;
    const show = () => {
      handlers.onPoint(r.uid);
      // One line only: the graph itself shows who is involved.
      tip.replaceChildren(
        h("span", { class: "tip-id", text: r.identifier }),
        h("span", { class: "tip-date source", text: ` ${dateText(r)}` }),
        h("span", { class: "tip-words", text: `, ${markWords(r)}, ${people === 1 ? "eine Person" : `${people} Personen`} im Graphen` }),
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
    const lift = Math.max(16, Math.min(a.top, b.top) - 26);
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
      fits = all.find((o) => inside(o) && !hits(o.box, n.id)) ?? onPlate(all.find((o) => inside(o) && !meetsBox(o.box, n.id)));
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

function dateText(r) {
  return r.date.map((seg) => seg.t).join("") || "ohne Datierung";
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
    others.forEach((o, i) => {
      pos.set(o, { ...at(p.angle, Math.min(0.78, 0.55 + i * 0.08)), ring: 2, angle: p.angle });
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
  if (ego) {
    const rim = s("g", { class: "sectors", "aria-hidden": "true" });
    for (const family of ego.used) {
      const a = ego.at(family.angle - 22.5, 0.9);
      const b = ego.at(family.angle + 22.5, 0.9);
      rim.append(s("path", { d: `M${width / 2},${height / 2} L${a.x},${a.y} L${b.x},${b.y} Z`, class: "sector-wedge" }));
    }
    for (const family of FAMILIES) {
      // The name sits where the sector's bearing meets the frame, so diagonal sectors are
      // named in the corners and every name stays outside the rings.
      const rad = (family.angle * Math.PI) / 180;
      const dir = { x: Math.sin(rad), y: -Math.cos(rad) };
      const reach = Math.min(Math.abs(dir.x) > 0.01 ? (width / 2 - 4) / Math.abs(dir.x) : Infinity, Math.abs(dir.y) > 0.01 ? (height / 2 - 4) / Math.abs(dir.y) : Infinity);
      const p = { x: width / 2 + dir.x * reach, y: height / 2 + dir.y * reach };
      const dx = dir.x;
      const anchor = Math.abs(dx) < 0.3 ? "middle" : dx > 0 ? "end" : "start";
      const name = narrow ? family.short : family.label;
      // Long names break at the space nearest their middle, so they stay narrow at the rim.
      const spaces = [...name.matchAll(/ /g)].map((m) => m.index);
      const mid = spaces.sort((a, b) => Math.abs(a - name.length / 2) - Math.abs(b - name.length / 2))[0];
      const lines = !narrow && name.length > 14 && mid ? [name.slice(0, mid), name.slice(mid + 1)] : [name];
      const w = Math.max(...lines.map((l) => l.length)) * 7.2;
      const h = lines.length * 13;
      const top = Math.min(height - h - 2, Math.max(2, p.y - h / 2));
      const x0 = anchor === "middle" ? p.x - w / 2 : anchor === "end" ? p.x - w : p.x;
      sectorBoxes.push({ x0, x1: x0 + w, y0: top, y1: top + h, node: `label:sector-${family.key}` });
      rim.append(
        s(
          "text",
          { x: p.x, y: top + 10, "text-anchor": anchor, class: `sector-label${ego.used.includes(family) ? " is-used" : ""}` },
          lines.map((l, i) => s("tspan", { x: p.x, dy: i ? 13 : 0, text: l })),
        ),
      );
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
  };
  return api;
}
