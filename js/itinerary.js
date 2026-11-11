/**
 * Itinerar: the whole delivery as a space-time cube of the places of issue.
 *
 * Task: see where the documents of Friedrich I. were issued, when, and how the court moved
 * between Germany and Italy over almost four decades; find a place and read its regesta.
 * Ground plan is the map (longitude, latitude of the place of issue from the register),
 * height is time. Every regest with a valid place of issue is one point; the itinerary line
 * joins them in time order. This is the first, deterministic layer of the edition (built by
 * build_holdings.py from the delivery and the register, no LLM). The regesta of the run with
 * evidenced statements are the second layer, set in the accent and named as such.
 *
 * Movement data is the case for which the space-time cube is studied (Kristensson et al.
 * 2009, Amini et al. 2015, per the coordination's study of 2026-11-11): patterns over time
 * read faster, single points in time not; exact reading stays with the list in the sidebar.
 * Three snapping orthographic views as in the space view: the top view is the map of all
 * places, the side view is time against west and east.
 */
import { h, regestHref } from "./dom.js";
import { timeBand } from "./sidebar.js";

const SVG = "http://www.w3.org/2000/svg";
const DEG = Math.PI / 180;
const VIEWS = Object.freeze({
  schraeg: { label: "Schräg", yaw: -20 * DEG, pitch: 24 * DEG },
  oben: { label: "Karte", yaw: 0, pitch: 90 * DEG },
  seite: { label: "Zeit", yaw: 0, pitch: 0 },
});
const HEIGHT = 3.2;
/** Half the width of the cube's floor; the core of the places fills radius 1.25 of it. */
const BOX = 1.5;
/** Standing place names on the floor: the places with most documents. */
const NAMED_PLACES = 14;

/** @param {string} tag @param {Record<string, any>} [attrs] */
function s(tag, attrs = {}) {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (k !== "text" && v !== null && v !== undefined) el.setAttribute(k, String(v));
  if (attrs.text) el.textContent = attrs.text;
  return el;
}

function yearOf(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return y + ((m - 1) * 30.4 + (d - 1)) / 365;
}

/**
 * @param {import("./app.js").Store & {holdings: any}} store
 * @param {{place?: string|null, filters: any}} options
 */
export function renderItinerary(store, options) {
  const { filters } = options;
  const H = store.holdings;
  const places = H.places;
  const evidenced = new Set(store.edition.regests.map((r) => r.uid));
  const points = H.regesta.filter((r) => r.p && places[r.p]).map((r) => ({ ...r, y: yearOf(r.s) }));
  const params = new URLSearchParams(location.search);
  const startView = VIEWS[params.get("ansicht")] ? params.get("ansicht") : "schraeg";
  const state = { place: options.place ?? null, view: { yaw: VIEWS[startView].yaw, pitch: VIEWS[startView].pitch, zoom: 1 }, snap: startView, pointed: null };

  // The map: an equirectangular projection around the median place of issue. The core that
  // holds 95 percent of the documents fills the cube; the far journeys (the crusades of 1147
  // and 1189/90) are compressed beyond it, so they stay visible without shrinking the core.
  // The legend says so.
  const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const midLat = median(points.map((p) => places[p.p].la));
  const midLon = median(points.map((p) => places[p.p].lo));
  const k = Math.cos(midLat * DEG);
  const dist = points.map((p) => Math.hypot((places[p.p].lo - midLon) * k, places[p.p].la - midLat)).sort((a, b) => a - b);
  const core = dist[Math.floor(dist.length * 0.95)] || 1;
  const squeeze = (dx, dz) => {
    const d = Math.hypot(dx, dz) / core;
    const r = d <= 1 ? d : 1 + 0.45 * Math.tanh((d - 1) / 1.2);
    return d ? r / d : 0;
  };
  const mapXZ = (lon, lat) => {
    const dx = (lon - midLon) * k;
    const dz = lat - midLat;
    const f = (squeeze(dx, dz) / core) * 1.25;
    return [dx * f, dz * f];
  };
  const mapX = (lon, lat) => mapXZ(lon, lat)[0];
  const mapZ = (lon, lat) => mapXZ(lon, lat)[1];
  // Height spans the years with a place of issue; earlier regesta have none.
  const first = Math.floor(Math.min(...points.map((p) => p.y)));
  const last = Math.floor(Math.max(...points.map((p) => p.y)));
  const toY = (year) => ((year - first) / (last + 1 - first) - 0.5) * HEIGHT;

  const status = h("p", { class: "canvas-status", role: "status", "aria-live": "polite" });
  const sceneHost = h("div", { class: "space-scene", tabindex: "0", role: "group", "aria-label": "Itinerar als Raum-Zeit-Würfel. Pfeiltasten drehen, Plus und Minus zoomen, Pos1 kehrt zur Schrägansicht zurück. Orte und Regesten sind in der Seitenleiste mit der Tastatur erreichbar." });
  const viewButtons = Object.entries(VIEWS).map(([key, v]) => h("button", { type: "button", class: "seg", "aria-pressed": "false", "data-view": key, onclick: () => snapTo(key) }, v.label));
  const freeMark = h("span", { class: "seg seg-note", text: "frei gedreht" });
  const element = h(
    "section",
    { class: "canvas space itinerary", "aria-labelledby": "it-title" },
    h("h1", { id: "it-title", class: "visually-hidden", text: "Itinerar: alle Regesten mit Ausstellungsort in Raum und Zeit" }),
    h(
      "div",
      { class: "canvas-bar" },
      h("div", { class: "segs", role: "group", "aria-label": "Ansicht" }, viewButtons, freeMark),
      h("button", { type: "button", class: "tool", onclick: () => snapTo("schraeg") }, "Ausgangslage"),
      h("button", { type: "button", class: "tool", "aria-label": "Vergrößern", onclick: () => zoom(1.15) }, "+"),
      h("button", { type: "button", class: "tool", "aria-label": "Verkleinern", onclick: () => zoom(1 / 1.15) }, "−"),
    ),
    sceneHost,
    status,
  );

  let scene = null;
  let screen = [];

  function build(width, height) {
    const svg = s("svg", { width, height, viewBox: `0 0 ${width} ${height}`, class: "space-svg", "aria-hidden": "true" });
    const frames = s("g", { class: "it-frames" });
    const line = s("polyline", { class: "it-path" });
    const dots = s("g", { class: "it-dots" });
    const marks = s("g", { class: "it-marks" });
    const labels = s("g", { class: "sp-labels" });
    const pointer = s("g", { class: "it-pointer" });
    svg.append(frames, line, dots, marks, labels, pointer);
    const dotEls = points.map((p) => dots.appendChild(s("circle", { class: evidenced.has(p.u) ? "it-dot is-evidenced" : "it-dot", r: evidenced.has(p.u) ? 3.6 : 2.2 })));
    return { svg, width, height, frames, line, dots: dotEls, marks, labels, pointer };
  }

  function projector() {
    const { width, height } = scene;
    const { yaw, pitch, zoom: z } = state.view;
    const [cy, sy, cp, sp] = [Math.cos(yaw), Math.sin(yaw), Math.cos(pitch), Math.sin(pitch)];
    const raw = (x, y, zz) => {
      const xr = x * cy + zz * sy;
      const zr = -x * sy + zz * cy;
      return { x: xr, y: -(y * cp + zr * sp), depth: zr * cp - y * sp };
    };
    // Fit the eight corners of the cube into the drawing for the current view, with room
    // for the view bar above and the status line below.
    const corners = [];
    for (const x of [-BOX, BOX]) for (const y of [-HEIGHT / 2, HEIGHT / 2]) for (const zz of [-BOX, BOX]) corners.push(raw(x, y, zz));
    const xs = corners.map((c) => c.x);
    const ys = corners.map((c) => c.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const top = 56;
    const bottom = 28;
    const base = Math.min((width - 80) / (x1 - x0), (height - top - bottom) / (y1 - y0)) * z;
    const midX = width / 2 - base * ((x0 + x1) / 2);
    const midY = top + (height - top - bottom) / 2 - base * ((y0 + y1) / 2);
    return (x, y, zz) => {
      const p = raw(x, y, zz);
      return { x: midX + base * p.x, y: midY + base * p.y, depth: p.depth };
    };
  }

  /** Recompute positions for the current view, filters and selection. */
  function update() {
    if (!scene) return;
    const P = projector();
    const pt = (lon, lat, year) => P(mapX(lon, lat), toY(year), -mapZ(lon, lat));
    const inside = (y) => filters.inYear(Math.floor(y));
    // Frames: the floor and a frame every decade, quiet; the cube's edges at the ends.
    scene.frames.replaceChildren();
    const box = [
      [-BOX, -BOX],
      [BOX, -BOX],
      [BOX, BOX],
      [-BOX, BOX],
    ];
    const frameAt = (year, cls) => {
      const c = box.map(([x, z]) => P(x, toY(year), z));
      scene.frames.append(s("polygon", { class: cls, points: c.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") }));
    };
    for (let y = Math.ceil(first / 10) * 10; y <= last; y += 10) frameAt(y, "it-frame");
    frameAt(first, "it-floor");
    if (filters.active()) {
      frameAt(Math.min(last + 1, Math.max(first, filters.from)), "it-slice");
      frameAt(Math.min(last + 1, Math.max(first, filters.to + 1)), "it-slice");
    }
    screen = points.map((p) => pt(places[p.p].lo, places[p.p].la, p.y));
    const path = [];
    points.forEach((p, i) => {
      const q = screen[i];
      const on = inside(p.y) && (!state.place || p.p === state.place);
      const dot = scene.dots[i];
      dot.setAttribute("cx", q.x.toFixed(1));
      dot.setAttribute("cy", q.y.toFixed(1));
      dot.setAttribute("opacity", on ? "1" : "0.12");
      if (inside(p.y)) path.push(`${q.x.toFixed(1)},${q.y.toFixed(1)}`);
    });
    scene.line.setAttribute("points", path.join(" "));
    labels(pt);
    pointer();
  }

  /** Year scale at the west edge, place names on the floor, a label for the selection. */
  function labels(pt) {
    const out = [];
    const boxes = [];
    const place = (text, p, cls, dx = 6, dy = 4) => {
      const w = text.length * 6.6;
      const b = { x0: p.x + dx, x1: p.x + dx + w, y0: p.y + dy - 12, y1: p.y + dy + 3 };
      if (b.x0 < 0 || b.x1 > scene.width || b.y0 < 0 || b.y1 > scene.height) return;
      if (boxes.some((o) => o.x0 < b.x1 && b.x0 < o.x1 && o.y0 < b.y1 && b.y0 < o.y1)) return;
      boxes.push(b);
      out.push(s("text", { x: b.x0, y: p.y + dy, class: `sp-label ${cls}`, text }));
    };
    if (state.place) {
      const p = places[state.place];
      place(p.l, pt(p.lo, p.la, first), "sp-case-label");
    }
    if (state.view.pitch < 70 * DEG) {
      for (let y = Math.ceil(first / 10) * 10; y <= last; y += 10) {
        // The number hangs at the leftmost corner of its decade frame.
        const P = projector();
        const corner = [-BOX, BOX].flatMap((x) => [-BOX, BOX].map((zz) => P(x, toY(y), zz))).sort((a, b) => a.x - b.x)[0];
        place(String(y), corner, "sp-year", -34, 4);
      }
    }
    const ranked = Object.entries(places).sort((a, b) => b[1].n - a[1].n).slice(0, NAMED_PLACES);
    for (const [id, p] of ranked) {
      if (id === state.place) continue;
      const q = pt(p.lo, p.la, first);
      out.push(s("circle", { class: "it-place", cx: q.x.toFixed(1), cy: q.y.toFixed(1), r: 2 }));
      place(p.l, q, "sp-family it-place-label");
    }
    scene.labels.replaceChildren(...out);
  }

  /** The pointed regest: drop line to its place on the floor, its place and year named. */
  function pointer() {
    scene.pointer.replaceChildren();
    const i = state.pointed;
    if (i === null) return;
    const p = points[i];
    const P = projector();
    const top = screen[i];
    const floor = P(mapX(places[p.p].lo, places[p.p].la), toY(first), -mapZ(places[p.p].lo, places[p.p].la));
    scene.pointer.append(s("line", { class: "it-drop", x1: top.x, y1: top.y, x2: floor.x, y2: floor.y }), s("circle", { class: "it-pointed", cx: top.x, cy: top.y, r: 5 }));
  }

  function nearest(event) {
    const r = scene.svg.getBoundingClientRect();
    const x = event.clientX - r.left;
    const y = event.clientY - r.top;
    let best = null;
    let dist = 64;
    points.forEach((p, i) => {
      if (!filters.inYear(Math.floor(p.y)) || (state.place && p.p !== state.place)) return;
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
    if (i === null) status.textContent = "";
    else {
      const p = points[i];
      status.textContent = `${Math.floor(p.y)}, ${places[p.p].l}, ${p.i}${evidenced.has(p.u) ? ", mit belegten Aussagen" : ""}`;
    }
    pointer();
  }

  function select(placeId) {
    state.place = placeId;
    history.replaceState(null, "", `${location.search}#/itinerar${placeId ? `/${encodeURIComponent(placeId)}` : ""}`);
    renderSide();
    update();
  }

  function draw() {
    scene = build(Math.max(280, element.clientWidth), Math.max(320, element.clientHeight));
    sceneHost.replaceChildren(scene.svg);
    sync();
    update();
  }

  function sync() {
    for (const b of viewButtons) b.setAttribute("aria-pressed", String(b.dataset.view === state.snap));
    freeMark.hidden = state.snap !== "frei";
    const q = new URLSearchParams(location.search);
    q.delete("ansicht");
    if (state.snap !== "schraeg" && state.snap !== "frei") q.set("ansicht", state.snap);
    const query = q.toString();
    history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}${location.hash}`);
  }

  let animation = {};
  function snapTo(key) {
    const target = VIEWS[key];
    state.snap = key;
    state.view.zoom = key === "schraeg" ? 1 : state.view.zoom;
    sync();
    const from = { ...state.view };
    let dYaw = (target.yaw - from.yaw) % (2 * Math.PI);
    if (dYaw > Math.PI) dYaw -= 2 * Math.PI;
    if (dYaw < -Math.PI) dYaw += 2 * Math.PI;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
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
      sync();
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
    const act = { ArrowLeft: () => rotate(step, 0), ArrowRight: () => rotate(-step, 0), ArrowUp: () => rotate(0, step * 0.75), ArrowDown: () => rotate(0, -step * 0.75), "+": () => zoom(1.15), "-": () => zoom(1 / 1.15), Home: () => snapTo("schraeg") }[event.key];
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
      if (i !== null) select(points[i].p);
    }
    drag = null;
  });

  // The sidebar: a place picker, the time band, one line saying what applies, and the
  // regesta of the selected place unfolding to their text.
  const aside = h("div", { class: "sidebar" });
  let texts = null;
  const loadTexts = async () => {
    if (!texts) texts = await fetch("data/holdings-texts.json").then((r) => (r.ok ? r.json() : {}));
    return texts;
  };

  function renderSide() {
    const inRange = points.filter((p) => filters.inYear(Math.floor(p.y)));
    const atPlace = state.place ? inRange.filter((p) => p.p === state.place) : [];
    const picker = h(
      "select",
      { class: "side-select", "aria-label": "Ausstellungsort", onchange: (e) => select(e.target.value || null) },
      h("option", { value: "", text: "Alle Ausstellungsorte", selected: !state.place }),
      Object.entries(places)
        .sort((a, b) => b[1].n - a[1].n)
        .map(([id, p]) => h("option", { value: id, text: `${p.l} (${p.n})`, selected: id === state.place })),
    );
    const evidencedCount = inRange.filter((p) => evidenced.has(p.u)).length;
    const markYears = new Set((state.place ? atPlace : []).map((p) => Math.floor(p.y)));
    const applies = state.place
      ? `Es gilt: ${places[state.place].l}, ${filters.from} bis ${filters.to}, ${atPlace.length} ${atPlace.length === 1 ? "Regest" : "Regesten"}.`
      : `Es gilt: ganzer Bestand, ${filters.from} bis ${filters.to}, ${inRange.length} Regesten mit Ausstellungsort, davon ${evidencedCount} mit belegten Aussagen.`;
    const legend = h(
      "p",
      { class: "it-legend" },
      h("span", { class: "it-key" }),
      " Regest mit Ausstellungsort, aus Lieferung und Register. Die Fernreisen nach Osten sind zur Mitte hin gestaucht. ",
      h("span", { class: "it-key is-evidenced" }),
      ` Regest mit belegten Aussagen, von LLM-basierten Agenten extrahiert, technisch geprüft und fachlich nicht abgenommen, ${evidenced.size} Regesten.`,
    );
    const list = state.place
      ? h(
          "ul",
          { class: "act-rows it-rows", role: "list" },
          atPlace.map((p) => {
            const textEl = h("p", { class: "act-text source", text: "…" });
            const link = evidenced.has(p.u) ? h("a", { class: "act-link", href: regestHref(p.u) }, `${p.i} mit belegten Aussagen lesen`) : p.pi ? h("a", { class: "act-link", href: `https://www.regesta-imperii.de/id/${p.pi}` }, `${p.i} in Regesta Imperii Online`) : null;
            const details = h(
              "details",
              {},
              h("summary", { onfocus: () => point(points.indexOf(p)), onblur: () => point(null) }, h("span", { class: "act-year", text: String(Math.floor(p.y)) }), h("span", { class: "act-name", text: p.i }), evidenced.has(p.u) ? h("span", { class: "act-short it-ev", text: "belegt" }) : h("span")),
              h("div", { class: "act-regest" }, textEl, link),
            );
            details.addEventListener("toggle", async () => {
              if (details.open) textEl.textContent = (await loadTexts())[p.u] || "Kein Regesttext geliefert.";
            });
            return h("li", { class: "act-row", onmouseenter: () => point(points.indexOf(p)), onmouseleave: () => point(null) }, details);
          }),
        )
      : h("p", { class: "side-empty", text: "Wähle einen Ort im Würfel oder in der Liste oben, um seine Regesten zu lesen." });
    aside.replaceChildren(
      h(
        "section",
        { class: "side-part side-selection", "aria-label": "Auswahl und Filter" },
        picker,
        timeBand(store, filters, markYears),
        h("p", { class: "side-applies" }, applies, filters.active() ? [" ", h("button", { type: "button", class: "link-button", onclick: () => filters.reset() }, "Zurücksetzen")] : null),
        legend,
      ),
      h("section", { class: "side-part side-acts", "aria-label": "Regesten des Ortes" }, list),
    );
  }

  const unsubscribe = filters.onChange(() => {
    renderSide();
    update();
  });
  let lastSize = "";
  const observer = new ResizeObserver(() => {
    const size = `${element.clientWidth}x${element.clientHeight}`;
    if (element.clientWidth && size !== lastSize) {
      lastSize = size;
      draw();
    }
  });
  observer.observe(element);
  renderSide();

  return {
    element,
    aside,
    focus: null,
    dispose: () => {
      animation = {};
      unsubscribe();
      observer.disconnect();
    },
  };
}
