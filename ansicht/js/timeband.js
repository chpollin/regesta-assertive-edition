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
 * Filters on the left, the band in the middle, the regest on the right on demand, as in the
 * itinerary. The drawing is aria-hidden; every person and every regest is reachable through
 * the sidebar.
 */
import { h } from "./dom.js";
import { timeBand } from "./sidebar.js";
import { yearOf } from "./filters.js";
import { renderRegestCard } from "./regest-card.js";

const SVG = "http://www.w3.org/2000/svg";
const ROW = 18;
const AXIS = 22;
const ORDERS = Object.freeze({ anzahl: "Häufigkeit", zeit: "Erste Nennung" });
const LIMITS = [40, 120, 400];
const ACTOR = "urn:regesta:actor:";
const NOTE = "Nennung aus dem Register der Regesta Imperii, ohne LLM.";

/**
 * The sidebar is rebuilt on every change, so a keyboard user would lose the control in hand;
 * this finds the same control again by its name or text after the rebuild.
 * @param {HTMLElement} root
 */
export function focusKey(root) {
  const el = document.activeElement;
  if (!el || !root.contains(el)) return () => {};
  const key = (e) => `${e.tagName}|${e.getAttribute("aria-label") ?? e.textContent}`;
  const wanted = key(el);
  return () => [...root.querySelectorAll("select, button, input, summary")].find((e) => key(e) === wanted)?.focus();
}

/** @param {string} tag @param {Record<string, any>} [attrs] */
function s(tag, attrs = {}) {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (k !== "text" && v !== null && v !== undefined) el.setAttribute(k, String(v));
  if (attrs.text) el.textContent = attrs.text;
  return el;
}

/**
 * @param {import("./app.js").Store} store
 * @param {{person?: string|null, filters: any, detail?: {show: (el: Element) => void, hide: () => void}, texts?: () => Promise<Record<string, string>>}} options
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
  const params = new URLSearchParams(location.search);
  const state = {
    person: options.person && byId.has(options.person) ? options.person : null,
    order: params.get("ordnung") === "zeit" ? "zeit" : "anzahl",
    limit: LIMITS.includes(Number(params.get("zeige"))) ? Number(params.get("zeige")) : LIMITS[0],
    pointed: null,
    opened: null,
  };

  const inRange = (m) => filters.inYear(Math.floor(m.y));
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
    return { named, top };
  }

  const status = h("p", { class: "canvas-status", role: "status", "aria-live": "polite" });
  const axisHost = h("div", { class: "tb-axis" });
  const scroller = h("div", { class: "tb-scroll", tabindex: "0", role: "group", "aria-label": "Zeitband der Personen. Personen und Regesten sind in der Seitenleiste mit der Tastatur erreichbar." });
  const element = h(
    "section",
    { class: "canvas views-tb", "aria-labelledby": "tb-title" },
    h("h1", { id: "tb-title", class: "visually-hidden", text: "Zeitband: welche Personen wann in den Regesten genannt sind" }),
    axisHost,
    scroller,
    status,
  );

  let scene = null;
  let shown = [];

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
    const height = top.length * ROW + 8;
    // The year axis stays above the scrolling rows.
    const axis = s("svg", { width, height: AXIS, class: "tb-svg", "aria-hidden": "true" });
    const svg = s("svg", { width, height, class: "tb-svg", "aria-hidden": "true" });
    const grid = s("g", { class: "tb-grid" });
    const body = s("g");
    const overlay = s("g", { class: "tb-overlay" });
    svg.append(grid, body, overlay);
    // About one year label per 50 pixels, on round years.
    const span = filters.to + 1 - filters.from;
    const step = [1, 2, 5, 10, 20].find((n) => ((g.x1 - g.x0) / span) * n >= 50) ?? 20;
    for (let y = Math.ceil(filters.from / step) * step; y <= filters.to; y += step) {
      grid.append(s("line", { x1: g.x(y), x2: g.x(y), y1: 0, y2: height }));
      axis.append(s("text", { class: "tb-year", x: g.x(y), y: AXIS - 7, "text-anchor": "middle", text: String(y) }));
    }
    const rowEls = top.map(({ p, hits }, i) => {
      const y = i * ROW + ROW / 2 + 4;
      const row = s("g", { class: "tb-row", "data-id": p.id });
      row.append(s("rect", { class: "tb-row-bg", x: 0, y: y - ROW / 2, width, height: ROW }));
      row.append(s("text", { class: p.run ? "tb-name is-run" : "tb-name", x: g.nameW, y: y + 4, "text-anchor": "end", text: fit(p.label, g.nameW - 6) }));
      const first = p.mentions[0].y;
      const last = p.mentions.at(-1).y;
      row.append(s("line", { class: "tb-life", x1: g.x(first), x2: Math.max(g.x(last), g.x(first) + 1), y1: y, y2: y }));
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

  function select(id, { scroll = false } = {}) {
    state.person = id;
    history.replaceState(null, "", `${location.search}#/zeitband${id ? `/${encodeURIComponent(id)}` : ""}`);
    const listed = shown.some((r) => r.p.id === id);
    if (id && !listed) draw();
    else mark();
    renderSide();
    if (scroll && id) {
      const i = shown.findIndex((r) => r.p.id === id);
      if (i >= 0) scroller.scrollTo({ top: Math.max(0, i * ROW - scroller.clientHeight / 3) });
    }
  }

  function openRegest(person, m) {
    state.opened = { person, m };
    mark();
    options.detail?.show(
      renderRegestCard(store, m.u, {
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

  scroller.addEventListener("pointermove", (e) => point(hitAt(e)));
  scroller.addEventListener("pointerleave", () => point(null));
  scroller.addEventListener("click", (e) => {
    const hit = hitAt(e);
    if (!hit) return;
    if (hit.person !== state.person) select(hit.person);
    if (hit.m) openRegest(hit.person, hit.m);
  });

  function setting(key, value) {
    state[key] = value;
    const q = new URLSearchParams(location.search);
    q.delete(key === "order" ? "ordnung" : "zeige");
    if (key === "order" && value !== "anzahl") q.set("ordnung", value);
    if (key === "limit" && value !== LIMITS[0]) q.set("zeige", String(value));
    const query = q.toString();
    history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}${location.hash}`);
    draw();
    renderSide();
  }

  // The sidebar: who is shown and in which order, the shared time band, the legend of the
  // two layers, and the regesta of the selected person.
  const aside = h("div", { class: "sidebar" });
  function renderSide() {
    const { named, top } = rows();
    const person = state.person ? byId.get(state.person) : null;
    const hits = person ? person.mentions.filter(inRange) : [];
    const ordered = [...top].sort((a, b) => a.p.label.localeCompare(b.p.label, "de"));
    const picker = h(
      "select",
      { class: "side-select", "aria-label": "Person", onchange: (e) => select(e.target.value || null, { scroll: true }) },
      h("option", { value: "", text: "Alle gezeigten Personen", selected: !person }),
      ordered.map(({ p, hits: n }) => h("option", { value: p.id, text: `${p.label} (${n.length})`, selected: p.id === state.person })),
    );
    const orderSegs = h(
      "div",
      { class: "segs", role: "group", "aria-label": "Reihenfolge" },
      Object.entries(ORDERS).map(([key, label]) => h("button", { type: "button", class: "seg", "aria-pressed": String(state.order === key), onclick: () => setting("order", key) }, label)),
    );
    const limit = h(
      "select",
      { class: "tb-limit", "aria-label": "Anzahl der gezeigten Personen", onchange: (e) => setting("limit", Number(e.target.value)) },
      LIMITS.filter((n, i) => i === 0 || LIMITS[i - 1] < named.length).map((n) => h("option", { value: String(n), text: n >= named.length ? `alle ${named.length}` : `${n} meistgenannte`, selected: n === state.limit })),
    );
    const applies = filters.active() ? `${filters.from === filters.to ? `nur ${filters.from}` : `${filters.from} bis ${filters.to}`}. ` : null;
    const runShown = top.filter((r) => r.p.run).length;
    const legend = h(
      "div",
      { class: "it-legend" },
      h("p", {}, h("span", { class: "tb-key" }), h("span", { class: "it-n", text: String(runShown) }), ` ${runShown === 1 ? "Person" : "Personen"} auch in belegten Aussagen`),
      h(
        "details",
        { class: "it-notes" },
        h("summary", { text: "Herkunft der Daten" }),
        h("p", { text: "Personen aus dem Register der Regesta Imperii, die in mindestens drei Regesten genannt sind, ohne LLM. Hervorgehobene Namen stehen auch in den Aussagen, die LLM-basierte Agenten extrahiert haben; diese sind technisch geprüft und fachlich nicht abgenommen." }),
      ),
    );
    const list = person
      ? h(
          "ul",
          { class: "act-rows it-rows", role: "list", "aria-label": `Regesten zu ${person.label}` },
          hits.map((m) =>
            h(
              "li",
              { class: "act-row" },
              h(
                "button",
                {
                  type: "button",
                  class: "act-open",
                  onclick: () => openRegest(person.id, m),
                  onmouseenter: () => point({ person: person.id, m }),
                  onmouseleave: () => point(null),
                  onfocus: () => point({ person: person.id, m }),
                  onblur: () => point(null),
                },
                h("span", { class: "act-year", text: String(Math.floor(m.y)) }),
                h("span", { class: "act-name", text: m.i }),
                h("span", { class: "act-short", text: m.place ?? "" }),
              ),
            ),
          ),
        )
      : h("p", { class: "side-empty", text: "Wähle eine Person im Band oder in der Liste oben." });
    const restore = focusKey(aside);
    aside.replaceChildren(
      h(
        "section",
        { class: "side-part side-selection", "aria-label": "Auswahl und Filter" },
        picker,
        h("div", { class: "tb-controls" }, orderSegs, limit),
        timeBand(store, filters, new Set(hits.map((m) => Math.floor(m.y)))),
        applies ? h("p", { class: "side-applies" }, applies, h("button", { type: "button", class: "link-button", onclick: () => filters.reset() }, "Zurücksetzen")) : null,
        legend,
      ),
      h("section", { class: "side-part side-acts", "aria-label": "Regesten der Person" }, list),
    );
    restore();
  }

  const unsubscribe = filters.onChange(() => {
    draw();
    renderSide();
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
  renderSide();
  if (state.person) requestAnimationFrame(() => select(state.person, { scroll: true }));

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
