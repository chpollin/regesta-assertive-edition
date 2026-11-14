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
 *
 * Persons in the cube (operator, 2026-11-14: „die Personen in diesen Space Time Cube
 * integrieren … in eine gemeinsame Visualisierung zusammenführen“): a person of the register
 * becomes the trace of the regesta that name them, through places and years; two persons can
 * be compared, and the regesta naming both are marked. The register of the delivery names a
 * person for every regest, so the trace covers the whole reign; the relations with roles
 * exist only for the regesta of the run and stay in the person views.
 *
 * The regest in the figure (operator, 2026-11-14: „ein schöner Tooltip, … damit ich dann das
 * Regest direkt lesen kann und dabei aber noch die Visualisierung und den Kontext sehe“): a
 * pointed or focused point or row shows the regest in a small card beside it, in the
 * annotation system of the regest page (family chip, kind, the readers' verdict). An opened
 * regest is marked strongly with what it depends on: the stations before and after it on
 * the itinerary, the other regesta of its place, and the regesta that share a person of the
 * register with it (persons named in at most RELATED_MAX regesta, so the ruler and his
 * chancellors do not join everything); the rest recedes.
 */
import { h } from "./dom.js";
import { timeBand } from "./sidebar.js";
import { renderRegestCard, statementsOf } from "./regest-card.js";
import { familyIcon, familyOf } from "./relations.js";

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
/** Standing place names on the floor: the places with most documents, as larger points. */
const NAMED_PLACES = 5;
/** A person named in more regesta than this does not make two regesta related. */
const RELATED_MAX = 60;

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
  const state = { flags: false, place: options.place ?? null, view: { yaw: VIEWS[startView].yaw, pitch: VIEWS[startView].pitch, zoom: 1 }, snap: startView, pointed: null };
  // Persons of the register with at least three regesta (holdings.json), at most two at once.
  const persons = H.persons ?? {};
  state.persons = (params.get("personen") ?? "").split(",").filter((id) => persons[id]).slice(0, 2);
  let personSets = state.persons.map((id) => new Set(persons[id].r));
  const personsOf = new Map();
  for (const [id, pp] of Object.entries(persons)) for (const u of pp.r) personsOf.set(u, [...(personsOf.get(u) ?? []), id]);
  const memberOf = (uid) => personSets.map((set) => set.has(uid));
  const personMark = (m) => (m[0] && m[1] ? "is-pab" : m[0] ? "is-pa" : m[1] ? "is-pb" : "");
  function setPersons(ids) {
    state.persons = ids.slice(0, 2);
    personSets = state.persons.map((id) => new Set(persons[id].r));
    const q = new URLSearchParams(location.search);
    if (state.persons.length) q.set("personen", state.persons.join(","));
    else q.delete("personen");
    const query = q.toString();
    history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}${location.hash}`);
    renderSide();
    update();
  }

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
  const tip = h("div", { class: "it-tip", role: "tooltip", hidden: true });
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
    tip,
    status,
  );

  let scene = null;
  let screen = [];
  // The plausibility check of check_itinerary.py, optional: flagged jumps between
  // consecutive stations, shown as a switchable state and named in the regest card.
  let checks = null;
  const flagsOf = new Map();
  fetch(new URL("../data/itinerary-checks.json", import.meta.url))
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      checks = data;
      for (const f of data?.flags ?? []) for (const [me, other] of [[f.a, f.b], [f.b, f.a]]) {
        if (!flagsOf.has(me.uid)) flagsOf.set(me.uid, []);
        flagsOf.get(me.uid).push({ ...f, other });
      }
      renderSide();
      update();
    })
    .catch(() => {});
  // The base map is a small local file; without it the cube still works.
  let basemap = null;
  fetch(new URL("./basemap.json", import.meta.url))
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      basemap = data;
      update();
    })
    .catch(() => {});

  // The Empire about 1190 as a soft area: a rough own digitisation after Shepherd's
  // public-domain map (build_realm.py), named as this project's interpretation.
  let realm = null;
  fetch(new URL("./realm.json", import.meta.url))
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      realm = data;
      renderSide();
      update();
    })
    .catch(() => {});

  function build(width, height) {
    const svg = s("svg", { width, height, viewBox: `0 0 ${width} ${height}`, class: "space-svg", "aria-hidden": "true" });
    const frames = s("g", { class: "it-frames" });
    const map = s("g", { class: "it-map" });
    const line = s("polyline", { class: "it-path" });
    const traces = s("g", { class: "it-traces" });
    const dots = s("g", { class: "it-dots" });
    const marks = s("g", { class: "it-marks it-flags" });
    const labels = s("g", { class: "sp-labels" });
    const pointer = s("g", { class: "it-pointer" });
    // The realm lies under the coast, softened by a blur and cut to the undistorted core.
    const defs = s("defs");
    const clip = s("clipPath", { id: "it-core-clip" });
    const clipShape = clip.appendChild(s("polygon"));
    const blur = s("filter", { id: "it-realm-soft", x: "-5%", y: "-5%", width: "110%", height: "110%" });
    blur.append(s("feGaussianBlur", { stdDeviation: 2.5 }));
    defs.append(clip, blur);
    const realmLayer = s("g", { class: "it-realm-layer", "clip-path": "url(#it-core-clip)" });
    svg.append(defs, frames, realmLayer, map, line, traces, dots, marks, labels, pointer);
    const dotEls = points.map((p) => dots.appendChild(s("circle", { class: evidenced.has(p.u) ? "it-dot is-evidenced" : "it-dot", r: evidenced.has(p.u) ? 3.6 : 2.2 })));
    return { svg, width, height, frames, map, realmLayer, clipShape, line, traces, dots: dotEls, marks, labels, pointer };
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
    // North is +z, which the projection draws upwards in the map view.
    const pt = (lon, lat, year) => P(mapX(lon, lat), toY(year), mapZ(lon, lat));
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
    // The quiet base map on the floor: coastlines and the large rivers (Natural Earth).
    scene.map.replaceChildren();
    scene.realmLayer.replaceChildren();
    if (realm) {
      const ring = [];
      for (let a = 0; a < 360; a += 5) {
        const rad = (a * Math.PI) / 180;
        const q = pt(midLon + (Math.cos(rad) * core) / k, midLat + Math.sin(rad) * core, first);
        ring.push(`${q.x.toFixed(1)},${q.y.toFixed(1)}`);
      }
      scene.clipShape.setAttribute("points", ring.join(" "));
      const outline = realm.ring.map(([lon, lat]) => pt(lon, lat, first)).map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`);
      scene.realmLayer.append(s("polygon", { class: "it-realm", points: outline.join(" "), filter: "url(#it-realm-soft)" }));
    }
    if (basemap) {
      // The map is drawn only inside the undistorted core; beyond it the projection
      // compresses, and a compressed coastline would read as a false shape.
      const inCore = (lon, lat) => Math.hypot((lon - midLon) * k, lat - midLat) <= core;
      const draw = (coords, cls) => {
        let run = [];
        const flush = () => {
          if (run.length > 1) scene.map.append(s("polyline", { class: cls, points: run.join(" ") }));
          run = [];
        };
        for (const [lon, lat] of coords) {
          if (!inCore(lon, lat)) {
            flush();
            continue;
          }
          const q = pt(lon, lat, first);
          run.push(`${q.x.toFixed(1)},${q.y.toFixed(1)}`);
        }
        flush();
      };
      for (const c of basemap.coast) draw(c, "it-coast");
      for (const r of basemap.rivers) draw(r, "it-river");
    }
    if (filters.active()) {
      frameAt(Math.min(last + 1, Math.max(first, filters.from)), "it-slice");
      frameAt(Math.min(last + 1, Math.max(first, filters.to + 1)), "it-slice");
    }
    screen = points.map((p) => pt(places[p.p].lo, places[p.p].la, p.y));
    const path = [];
    const trace = state.persons.map(() => []);
    points.forEach((p, i) => {
      const q = screen[i];
      const m = memberOf(p.u);
      const on = inside(p.y) && (!state.place || p.p === state.place) && (!state.persons.length || m.some(Boolean)) && (!related || related.all.has(i));
      const dot = scene.dots[i];
      dot.setAttribute("cx", q.x.toFixed(1));
      dot.setAttribute("cy", q.y.toFixed(1));
      dot.setAttribute("opacity", on ? "1" : state.persons.length || related ? "0.07" : "0.12");
      dot.classList.remove("is-pa", "is-pb", "is-pab");
      const mark = personMark(m);
      if (mark) dot.classList.add(mark);
      if (inside(p.y)) path.push(`${q.x.toFixed(1)},${q.y.toFixed(1)}`);
      m.forEach((yes, j) => yes && inside(p.y) && trace[j].push(`${q.x.toFixed(1)},${q.y.toFixed(1)}`));
    });
    scene.line.setAttribute("points", path.join(" "));
    // A person's trace: their regesta in time order, through the places of issue.
    scene.traces.replaceChildren(...trace.map((pts, j) => s("polyline", { class: `it-trace is-p${j}`, points: pts.join(" ") })));
    scene.line.classList.toggle("is-quiet", state.persons.length > 0);
    // Selected marks above the rest: re-append them, so no faint point covers them.
    if (state.persons.length) for (const dot of scene.dots) if (dot.classList.length > 1 && /is-p/.test(dot.getAttribute("class"))) scene.dots[0].parentNode.append(dot);
    // Flagged jumps, when switched on: a line between the two stations in the warning ink.
    scene.marks.replaceChildren();
    if (state.flags && checks) {
      const at = new Map(points.map((p, i) => [p.u, i]));
      for (const f of checks.flags) {
        const [ia, ib] = [at.get(f.a.uid), at.get(f.b.uid)];
        if (ia === undefined || ib === undefined || !inside(points[ia].y)) continue;
        scene.marks.append(s("line", { class: "it-flag", x1: screen[ia].x, y1: screen[ia].y, x2: screen[ib].x, y2: screen[ib].y }));
      }
    }
    // The route stays faint over the whole time; a chosen time range draws it strongly.
    scene.line.classList.toggle("is-on", filters.active());
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
      out.push(s("circle", { class: "it-place", cx: q.x.toFixed(1), cy: q.y.toFixed(1), r: 3.5 }));
      place(p.l, q, "it-place-label", 8, -6);
    }
    scene.labels.replaceChildren(...out);
  }

  /** The pointed regest: drop line to its place on the floor, its place and year named. */
  function pointer() {
    if (!scene) return;
    scene.pointer.replaceChildren();
    const P = projector();
    if (related && opened !== null && screen[opened]) {
      const o = screen[opened];
      const seg = (i, cls) => screen[i] && scene.pointer.append(s("line", { class: cls, x1: o.x, y1: o.y, x2: screen[i].x, y2: screen[i].y }));
      for (const i of related.people) seg(i, "it-link");
      for (const i of related.steps) seg(i, "it-step");
      for (const i of related.place) screen[i] && scene.pointer.append(s("circle", { class: "it-same-place", cx: screen[i].x, cy: screen[i].y, r: 4.5 }));
    }
    // The regest whose card is open keeps a ring and its drop line; pointing adds another.
    for (const [i, cls] of [
      [opened, "it-opened"],
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
    let best = null;
    let dist = 64;
    points.forEach((p, i) => {
      if (!filters.inYear(Math.floor(p.y)) || (state.place && p.p !== state.place)) return;
      if (state.persons.length && !memberOf(p.u).some(Boolean)) return;
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
    if (i === null) status.textContent = "";
    else {
      const p = points[i];
      const names = state.persons.filter((id, j) => personSets[j].has(p.u)).map((id) => persons[id].l);
      status.textContent = `${Math.floor(p.y)}, ${places[p.p].l}, ${p.i}${evidenced.has(p.u) ? ", mit belegten Aussagen" : ""}${names.length ? `, nennt ${names.join(" und ")}` : ""}`;
    }
    pointer();
  }

  /** The regest beside its point: head line, text, statements in the annotation system. */
  function showTip(i) {
    if (i === null || i === undefined || !screen[i]) {
      tip.hidden = true;
      return;
    }
    const p = points[i];
    const regest = store.byUid.get(p.u);
    const text = h("p", { class: "it-tip-text source", text: regest ? regest.text : "…" });
    if (!regest) options.texts?.().then((t) => (text.textContent = t[p.u] || "Kein Regesttext geliefert."));
    const sts = regest ? statementsOf(regest) : [];
    tip.replaceChildren(
      h("p", { class: "it-tip-head" }, h("span", { class: "card-id", text: p.i }), ` ${Math.floor(p.y)}, ${places[p.p].l}`),
      text,
      sts.length
        ? h(
            "ul",
            { class: "it-tip-sts", role: "list" },
            sts.map((st) => h("li", {}, h("span", { class: "ann-chip" }, familyIcon(familyOf(st.kind), { size: 12 }), String(st.n)), ` ${st.kind}`, st.agent ? h("span", { class: `ann-verdict is-${st.agent.outcome.replace(/\s+/g, "-")}` }, st.agent.outcome) : null)),
          )
        : h("p", { class: "it-tip-none", text: regest ? "Keine Aussage im Rahmen des Laufs." : "Ohne Aussagen des Laufs, Text aus der Lieferung." }),
      h("p", { class: "it-tip-foot", text: "Klick oder Eingabe öffnet das Regest mit seinen Bezügen." }),
    );
    tip.hidden = false;
    // Beside the point, inside the drawing, on the side with more room.
    const q = screen[i];
    const w = Math.min(340, element.clientWidth - 24);
    const left = q.x + 18 + w < element.clientWidth ? q.x + 18 : Math.max(8, q.x - 18 - w);
    tip.style.inlineSize = `${w}px`;
    tip.style.left = `${left}px`;
    tip.style.top = `${Math.max(48, Math.min(q.y - 40, element.clientHeight - tip.offsetHeight - 36))}px`;
  }

  /** What the opened regest depends on: stations before and after, its place, shared persons. */
  let related = null;
  function relate(i) {
    if (i === null) return null;
    const p = points[i];
    const place = new Set();
    points.forEach((x, j) => x.p === p.p && j !== i && place.add(j));
    const steps = new Set([i - 1, i + 1].filter((j) => j >= 0 && j < points.length));
    const mine = (personsOf.get(p.u) ?? []).filter((id) => persons[id].r.length <= RELATED_MAX);
    const people = new Set();
    const at = new Map(points.map((x, j) => [x.u, j]));
    for (const id of mine) for (const u of persons[id].r) if (u !== p.u && at.has(u)) people.add(at.get(u));
    return { place, steps, people, all: new Set([i, ...place, ...steps, ...people]), persons: mine };
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
  sceneHost.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && opened !== null) {
      opened = null;
      related = null;
      update();
      options.detail?.hide();
    }
  });
  sceneHost.addEventListener("pointerup", (e) => {
    if (drag && !drag.moved && scene) {
      const i = nearest(e);
      if (i !== null) {
        select(points[i].p);
        openRegest(i);
      }
    }
    drag = null;
  });

  // The sidebar: a place picker, the time band, the legend of the two layers, and the
  // regesta of the selected place; a regest opens as the detail on demand on the right.
  const aside = h("div", { class: "sidebar" });
  /** The regest whose card is open, marked in the cube. */
  let opened = null;
  function openRegest(i) {
    opened = i;
    related = relate(i);
    update();
    status.textContent = `${points[i].i}: vorige und nächste Station des Itinerars, ${related.place.size} weitere Regesten am selben Ort, ${related.people.size} Regesten, die eine seiner Personen nennen${related.persons.length ? ` (${related.persons.map((id) => persons[id].l).join(", ")})` : ""}`;
    // Where the point comes from, and what the plausibility check says about it.
    const notes = ["Ort und Datum aus der Lieferung der Regesta Imperii, Koordinate aus ihrem Register, ohne LLM."];
    for (const f of flagsOf.get(points[i].u) ?? []) notes.push(`Auffällig: ${f.km} km in ${f.days} ${f.days === 1 ? "Tag" : "Tagen"} zu ${f.other.identifier} (${f.other.place}). Vermutlicher Grund: ${f.class}.`);
    options.detail?.show(
      renderRegestCard(store, points[i].u, {
        notes,
        texts: options.texts,
        onClose: () => {
          opened = null;
          related = null;
          update();
          options.detail?.hide();
        },
      }),
    );
  }

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
    const applies = filters.active() ? `${filters.from === filters.to ? `nur ${filters.from}` : `${filters.from} bis ${filters.to}`}. ` : null;
    // The two layers as two lines with sign and count, each count said once and for the
    // current selection; how they arose and what the map simplifies unfolds on demand.
    const shown = state.place ? atPlace : inRange;
    const shownEvidenced = state.place ? atPlace.filter((p) => evidenced.has(p.u)).length : evidencedCount;
    const legend = h(
      "div",
      { class: "it-legend" },
      h("p", { title: "Regesten mit Ausstellungsort im gewählten Zeitraum" }, h("span", { class: "it-key" }), h("span", { class: "it-n", text: String(shown.length) }), " Regesten mit Ort"),
      h("p", { title: "davon mit belegten Aussagen der LLM-Agenten" }, h("span", { class: "it-key is-evidenced" }), h("span", { class: "it-n", text: String(shownEvidenced) }), " mit Aussagen"),
      realm ? h("p", { title: "Grobe eigene Digitalisierung nach der gemeinfreien Karte von W. R. Shepherd (1926)" }, h("span", { class: "it-key is-realm" }), h("span", { class: "it-n" }), "Reich um 1190") : null,
      checks
        ? h(
            "p",
            {},
            h("button", {
              type: "button",
              class: "fam-check it-flag-toggle",
              "aria-pressed": String(state.flags),
              "aria-label": `Auffällige Sprünge ${state.flags ? "ausblenden" : "zeigen"}`,
              title: `Mehr als ${checks.threshold.kmPerDay} km am Tag oder ${checks.threshold.floorKm} km zwischen zwei Stationen, Annahme ohne gelesene Quelle`,
              onclick: () => {
                state.flags = !state.flags;
                renderSide();
                update();
              },
            }),
            h("span", { class: "it-n", text: String(checks.flags.length) }),
            " auffällige Sprünge",
          )
        : null,
      h(
        "p",
        { class: "it-notes" },
        h("a", { href: new URL("../../ueber/#daten", import.meta.url).href, title: "Orte und Daten aus der Lieferung der Regesta Imperii und ihrem Register, ohne LLM; Fernreisen zur Mitte gestaucht; Reich um 1190 als grobe eigene Deutung nach Shepherd (1926); auffällige Sprünge sind Kandidaten, keine Befunde." }, "Herkunft der Daten"),
      ),
    );
    // Persons: a search over the register, the chosen ones as removable chips with their count.
    const byLabel = new Map();
    const personOptions = Object.entries(persons)
      .sort((a, b) => b[1].r.length - a[1].r.length)
      .map(([id, pp]) => {
        const text = `${pp.l} (${pp.r.length})`;
        byLabel.set(text, id);
        return h("option", { value: text });
      });
    const listId = "it-person-list";
    const search = h("input", {
      type: "search",
      class: "side-select it-person-search",
      list: listId,
      placeholder: state.persons.length >= 2 ? "Zwei Personen gewählt" : state.persons.length ? "Zweite Person zum Vergleich" : "Person suchen",
      "aria-label": "Person im Register suchen",
      disabled: state.persons.length >= 2,
      onchange: (e) => {
        const id = byLabel.get(e.target.value);
        if (id && !state.persons.includes(id)) setPersons([...state.persons, id]);
      },
    });
    const both = state.persons.length === 2 ? personSets[0].size && [...personSets[0]].filter((u) => personSets[1].has(u)).length : 0;
    const chips = state.persons.length
      ? h(
          "ul",
          { class: "it-persons", role: "list" },
          state.persons.map((id, j) =>
            h(
              "li",
              {},
              h("span", { class: `it-pkey is-p${j}` }),
              h("span", { class: "it-pname", text: persons[id].l, title: persons[id].f }),
              h("span", { class: "it-n", text: String(inRange.filter((p) => personSets[j].has(p.u)).length) }),
              h("button", { type: "button", class: "link-button", "aria-label": `${persons[id].l} entfernen`, title: "Entfernen", onclick: () => setPersons(state.persons.filter((x) => x !== id)) }, "×"),
            ),
          ),
          state.persons.length === 2 ? h("li", {}, h("span", { class: "it-pkey is-pab" }), h("span", { class: "it-pname", text: "beide genannt" }), h("span", { class: "it-n", text: String(both) })) : null,
        )
      : null;
    const selection = inRange.filter((p) => (!state.place || p.p === state.place) && (!state.persons.length || memberOf(p.u).some(Boolean)));
    const list = state.place || state.persons.length
      ? h(
          "ul",
          { class: "act-rows it-rows", role: "list" },
          selection.map((p) => {
            const i = points.indexOf(p);
            return h(
              "li",
              { class: "act-row" },
              h(
                "button",
                { type: "button", class: "act-open", onclick: () => openRegest(i), onmouseenter: () => point(i), onmouseleave: () => point(null), onfocus: () => point(i), onblur: () => point(null) },
                h("span", { class: "act-year", text: String(Math.floor(p.y)) }),
                h("span", { class: "act-name", text: state.place ? p.i : `${p.i}, ${places[p.p].l}` }),
                state.persons.length ? h("span", { class: `it-pkey ${personMark(memberOf(p.u))}`, title: "Person" }) : evidenced.has(p.u) ? h("span", { class: "it-key is-evidenced", title: "mit belegten Aussagen" }) : h("span"),
              ),
            );
          }),
        )
      : h("p", { class: "side-empty", text: "Wähle einen Ort oder eine Person, um die Regesten zu lesen." });
    aside.replaceChildren(
      h(
        "section",
        { class: "side-part side-selection", "aria-label": "Auswahl und Filter" },
        picker,
        h("div", { class: "it-person-pick" }, search, h("datalist", { id: listId }, personOptions)),
        chips,
        timeBand(store, filters, markYears),
        applies ? h("p", { class: "side-applies" }, applies, h("button", { type: "button", class: "link-button", onclick: () => filters.reset() }, "Zurücksetzen")) : null,
        legend,
      ),
      h("section", { class: "side-part side-acts", "aria-label": "Regesten der Auswahl" }, list),
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
