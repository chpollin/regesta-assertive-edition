// The network around one register entry, drawn as inline SVG.
//
// Centre: the entry. Ring: its regests as diamonds, in sectors by the token combination the
// entry carries there (model.js sectorsOf), time order clockwise within a sector. A sector
// that does not fit stands as a bundle and opens on click, Enter or Space. A selected regest
// draws its other register entries in a column beside the ring on its side, grouped by token
// combination; each group's edge carries its tokens as text, so the role never rests on
// colour. Two entries are never joined directly. The layout depends only on the data and the
// drawing size, so the same address always gives the same picture.

import { s, entryHref } from "./dom.js";
import { isApparatusOnly, kindOf, idOf, roleKey } from "./model.js";
import { KIND_KEY, dayCount } from "./text.js";

const LABEL_FONT = '500 12.5px "Instrument Sans", system-ui, sans-serif';
const STRONG_FONT = '600 12.5px "Instrument Sans", system-ui, sans-serif';
const SMALL_FONT = '500 11px "Instrument Sans", system-ui, sans-serif';
const MAX_CHARS = 30;
const TAU = Math.PI * 2;

const ctx = document.createElement("canvas").getContext("2d");
function textWidth(text, font) {
  ctx.font = font;
  // Never below 6.6 px per character, after short words had been underestimated (design.md).
  return Math.max(ctx.measureText(text).width, text.length * 6.6 * (font === SMALL_FONT ? 0.88 : 1));
}

const short = (t) => (t.length > MAX_CHARS ? `${t.slice(0, MAX_CHARS - 1).trimEnd()}…` : t);

// Collision bookkeeping: axis-aligned boxes of everything drawn so far.
class Space {
  constructor(w, h) { this.w = w; this.h = h; this.boxes = []; }
  fits(b) {
    if (b.x < 2 || b.y < 2 || b.x + b.w > this.w - 2 || b.y + b.h > this.h - 2) return false;
    return !this.boxes.some((o) => b.x < o.x + o.w + 2 && o.x < b.x + b.w + 2 && b.y < o.y + o.h + 1 && o.y < b.y + b.h + 1);
  }
  add(b) { this.boxes.push(b); }
}

// A text box for an anchor point. anchor: start, middle or end.
function box(x, y, w, anchor, size = 12.5) {
  const left = anchor === "start" ? x : anchor === "end" ? x - w : x - w / 2;
  return { x: left, y: y - size * 0.8, w, h: size * 1.15 };
}

function place(space, candidates, w, size) {
  for (const c of candidates) {
    const b = box(c.x, c.y, w, c.anchor, size);
    if (space.fits(b)) { space.add(b); return c; }
  }
  return null;
}

// Last resort for a label that must stand: the nearest free spot in the drawing.
function nearest(space, ax, ay, w, size) {
  const grid = [];
  for (let gy = 14; gy < space.h - 4; gy += 7) for (let gx = 4; gx < space.w - 4; gx += 8) grid.push({ x: gx, y: gy, anchor: gx < ax ? "end" : "start" });
  grid.sort((u, v) => Math.hypot(u.x - ax, u.y - ay) - Math.hypot(v.x - ax, v.y - ay));
  return place(space, grid, w, size);
}

function shape(kind, x, y, r, attrs) {
  if (kind === "place") return s("rect", { x: x - r * 0.9, y: y - r * 0.9, width: r * 1.8, height: r * 1.8, ...attrs });
  if (kind === "subject") return s("path", { d: `M${x},${y - r * 1.1}L${x + r * 1.05},${y + r * 0.8}L${x - r * 1.05},${y + r * 0.8}Z`, ...attrs });
  if (kind === "event") {
    const a = r * 0.42, b = r * 1.1;
    return s("path", { d: `M${x - a},${y - b}h${2 * a}v${b - a}h${b - a}v${2 * a}h${a - b}v${b - a}h${-2 * a}v${a - b}h${a - b}v${-2 * a}h${b - a}Z`, ...attrs });
  }
  return s("circle", { cx: x, cy: y, r, ...attrs });
}

const diamond = (x, y, d, attrs) => s("path", { d: `M${x},${y - d}L${x + d},${y}L${x},${y + d}L${x - d},${y}Z`, ...attrs });

// Angles of the sectors, the bundles and the rows of the open sectors.
function layoutRing(sectors, R1, pitch, open, keep) {
  const n = sectors.length;
  const gap = n > 1 ? Math.min(0.12, 1.2 / n) : 0;
  const avail = TAU - gap * n;
  const bundleArc = (2.8 * pitch) / R1;
  const st = sectors.map((sec) => ({ sec, bundled: false, rows: 1, opened: open.has(sec.key), kept: sec === keep }));
  const need = (x) => (x.bundled ? bundleArc : (Math.ceil(x.sec.items.length / x.rows) * pitch) / R1);
  const total = () => st.reduce((a, x) => a + need(x), 0);
  // An opened sector first takes up to four rows; only then are the largest closed sectors
  // bundled, so opening one bundle does not close others; last, every open sector takes rows.
  for (let rows = 2; rows <= 4 && total() > avail; rows++) for (const x of st) if (x.opened) x.rows = rows;
  const closed = st.filter((x) => !x.opened && !x.kept).sort((a, b) => b.sec.items.length - a.sec.items.length);
  for (const x of closed) { if (total() <= avail) break; if (x.sec.items.length > 3) x.bundled = true; }
  for (let rows = 2; rows <= 4 && total() > avail; rows++) for (const x of st) if (!x.bundled) x.rows = Math.max(x.rows, rows);
  const scale = Math.min(1, avail / total());
  // Spread the slack so the ring is evenly used; sectors keep their order clockwise.
  const sum = total();
  let a = -need(st[0]) * (avail / sum) / 2 - gap / 2;
  for (const x of st) {
    x.arc = need(x) * (avail / sum);
    x.start = a + gap / 2;
    x.mid = x.start + x.arc / 2;
    a += x.arc + gap;
  }
  return { st, pitchScale: scale };
}

export function drawFigure(host, model) {
  const { entry, sectors, selectedUid, record, recordFailed, open } = model;
  const W = Math.max(300, host.clientWidth);
  const narrow = W < 640;
  const top = host.getBoundingClientRect().top + window.scrollY;
  const room = Math.max(0, window.innerHeight - top - 12);
  const H = narrow ? Math.max(W, Math.min(room, W * 1.55)) : Math.max(440, Math.min(room, 760));
  const cx = W / 2;
  const cy = H / 2;
  const labelRoom = narrow ? 10 : 196;
  const R2 = Math.max(110, Math.min(W / 2 - labelRoom, H / 2 - 22));
  const R1 = R2 * 0.6;
  const Rj = R1 + (R2 - R1) * 0.5;
  const basePitch = narrow ? 9.5 : 11.5;
  const d = narrow ? 3.6 : 4.3;

  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: "figure",
    role: "group", "aria-label": `Netz um ${entry.shortLabel}: Regesten nach Rolle, mit den Einträgen des gewählten Regests` });
  const gEdges = s("g", { class: "edges" });
  const gMarks = s("g", { class: "marks" });
  const gLabels = s("g", { class: "labels" });
  const gTip = s("g", { class: "tip", "aria-hidden": "true", visibility: "hidden" });
  svg.append(gEdges, gMarks, gLabels, gTip);
  const space = new Space(W, H);

  const tipRect = s("rect", { rx: 2 });
  const tipText = s("text", {});
  gTip.append(tipRect, tipText);
  const showTip = (text, x, y) => {
    tipText.textContent = text;
    const w = textWidth(text, LABEL_FONT) + 12;
    const tx = Math.min(Math.max(4, x - w / 2), W - w - 4);
    const ty = y - 26 < 4 ? y + 14 : y - 26;
    tipRect.setAttribute("x", tx); tipRect.setAttribute("y", ty);
    tipRect.setAttribute("width", w); tipRect.setAttribute("height", 20);
    tipText.setAttribute("x", tx + 6); tipText.setAttribute("y", ty + 14);
    gTip.setAttribute("visibility", "visible");
  };
  const hideTip = () => gTip.setAttribute("visibility", "hidden");
  const tipOn = (el, text, x, y) => {
    for (const ev of ["pointerenter", "focus"]) el.addEventListener(ev, () => showTip(text, x, y));
    for (const ev of ["pointerleave", "blur"]) el.addEventListener(ev, hideTip);
  };

  // Key of the shapes present, one quiet line at the lower left inside the figure, drawn
  // first so no label lands on it.
  const keyKinds = new Set(["regest"]);
  if (selectedUid && record) for (const r of record.rows || []) if (r.entry?.identifier !== entry.identifier) keyKinds.add(kindOf(r.entry?.id || ""));
  {
    let kx = 6;
    const ky = H - 8;
    for (const k of ["regest", "actor", "place", "subject", "event", "unclassified"]) {
      if (!keyKinds.has(k)) continue;
      const word = k === "regest" ? "Regest" : KIND_KEY[k];
      if (k === "regest") gLabels.append(diamond(kx + 5, ky - 4, 4.5, { class: "key-mark" }));
      else gLabels.append(shape(k, kx + 5, ky - 4, 4.3, { class: "key-mark" }));
      gLabels.append(s("text", { x: kx + 14, y: ky, class: "key" }, word));
      const w = 14 + textWidth(word, SMALL_FONT);
      space.add({ x: kx, y: ky - 12, w, h: 16 });
      kx += w + 14;
    }
  }

  // Centre.
  const cKind = kindOf(entry.id);
  gMarks.append(shape(cKind === "parent" ? "actor" : cKind, cx, cy, 8, { class: "centre-mark" }));
  space.add({ x: cx - 10, y: cy - 10, w: 20, h: 20 });
  const cLabel = short(entry.shortLabel);
  const cw = textWidth(cLabel, STRONG_FONT);
  const cPos = place(space, [{ x: cx, y: cy + 26, anchor: "middle" }, { x: cx, y: cy - 16, anchor: "middle" }], cw, 12.5);
  if (cPos) gLabels.append(s("text", { x: cPos.x, y: cPos.y, "text-anchor": "middle", class: "centre-label" }, cLabel));

  // Ring.
  const selSector = sectors.find((sec) => sec.items.some((it) => it.uid === selectedUid));
  const { st, pitchScale } = layoutRing(sectors, R1, basePitch, new Set(open), selSector);

  // The selected regest's label under the centre, placed before the sector labels.
  const selItem = selSector?.items.find((x) => x.uid === selectedUid);
  const selText = selItem ? `${selItem.record.identifier}, ${selItem.record.dating}` : "";
  const sPos = selItem ? place(space, [{ x: cx, y: cy + 44, anchor: "middle" }, { x: cx, y: cy - 34, anchor: "middle" },
    { x: cx, y: cy + 60, anchor: "middle" }], textWidth(selText, LABEL_FONT), 12.5) : null;
  const pitch = basePitch * pitchScale;
  const diamonds = [];
  const pos = new Map();
  for (const x of st) {
    const n = x.sec.items.length;
    const quiet = x.sec.apparatus || x.sec.key === "";
    const labelText = `${x.sec.key || "ohne Rolle"} ${n}`;
    const userOpened = open.includes(x.sec.key) && x.sec !== selSector;
    if (x.bundled) {
      const bx = cx + Math.cos(x.mid) * R1;
      const by = cy + Math.sin(x.mid) * R1;
      const g = s("g", { class: `bundle${quiet ? " quiet" : ""}`, role: "button", tabindex: 0,
        "aria-expanded": "false", "aria-label": `${x.sec.key || "ohne Rolle"}: ${dayCount(n)}, aufklappen` });
      for (const off of [-1, 0, 1]) g.append(diamond(bx + off * Math.cos(x.mid + Math.PI / 2) * 5, by + off * Math.sin(x.mid + Math.PI / 2) * 5, d + 1.5, {}));
      const toggle = () => model.onToggle(x.sec.key);
      g.addEventListener("click", toggle);
      g.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); toggle(); } });
      gMarks.append(g);
      space.add({ x: bx - 14, y: by - 14, w: 28, h: 28 });
      x.labelR = R1 - 18;
    } else {
      const cols = Math.ceil(n / x.rows);
      x.sec.items.forEach((it, i) => {
        const col = Math.floor(i / x.rows);
        const row = i % x.rows;
        const a = x.start + ((col + 0.5) * x.arc) / cols;
        const r = R1 - row * pitch;
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r;
        pos.set(it.uid, { x: px, y: py, a });
        diamonds.push({ it, x: px, y: py, quiet });
        space.add({ x: px - d, y: py - d, w: 2 * d, h: 2 * d });
      });
      // A hairline along the outer row ties the sector's diamonds together.
      if (cols > 1) {
        const a0 = x.start + (0.5 * x.arc) / cols;
        const a1 = x.start + ((cols - 0.5) * x.arc) / cols;
        const large = a1 - a0 > Math.PI ? 1 : 0;
        gEdges.append(s("path", { class: "sector-arc", d: `M${cx + Math.cos(a0) * R1},${cy + Math.sin(a0) * R1}A${R1},${R1} 0 ${large} 1 ${cx + Math.cos(a1) * R1},${cy + Math.sin(a1) * R1}` }));
      }
      x.labelR = R1 - (x.rows - 1) * pitch - 14;
    }
    // Sector label inside the ring, at the sector's middle.
    const lx = cx + Math.cos(x.mid) * x.labelR;
    const ly = cy + Math.sin(x.mid) * x.labelR + 4;
    const c = Math.cos(x.mid);
    const anchor = c > 0.35 ? "end" : c < -0.35 ? "start" : "middle";
    const lw = textWidth(labelText, LABEL_FONT);
    const cands = [];
    for (const back of [0, 16, 32, 48, 64]) for (const dy of [0, 13, -13, 26, -26]) {
      cands.push({ x: cx + Math.cos(x.mid) * (x.labelR - back), y: cy + Math.sin(x.mid) * (x.labelR - back) + 4 + dy, anchor });
    }
    // Outside the ring as a fallback, where the selected regest's column leaves room.
    const out = anchor === "end" ? "start" : anchor === "start" ? "end" : "middle";
    for (const ahead of [14, 28]) for (const dy of [0, 13, -13]) {
      const r = R1 + (x.bundled ? 12 : 0) + ahead;
      cands.push({ x: cx + Math.cos(x.mid) * r, y: cy + Math.sin(x.mid) * r + 4 + dy + (out === "middle" ? Math.sign(Math.sin(x.mid)) * 6 : 0), anchor: out });
    }
    let p = place(space, cands, lw, 12.5);
    if (!p) {
      // Last resort: the nearest free spot in the drawing, joined to the sector by a leader.
      const ax = cx + Math.cos(x.mid) * R1;
      const ay = cy + Math.sin(x.mid) * R1;
      p = nearest(space, ax, ay, lw, 12.5);
    }
    // A label that stands away from its own place gets a leader to its sector.
    if (p && Math.hypot(p.x - lx, p.y - ly) > 20) {
      const r0 = x.bundled ? R1 - 10 : R1 - (x.rows - 1) * pitch - 5;
      const ex = p.anchor === "end" ? p.x + 2 : p.anchor === "start" ? p.x - 2 : p.x;
      gEdges.append(s("line", { x1: cx + Math.cos(x.mid) * r0, y1: cy + Math.sin(x.mid) * r0, x2: ex, y2: p.y - 4, class: "leader" }));
    }
    if (p) {
      const t = s("text", { x: p.x, y: p.y, "text-anchor": p.anchor, class: `sector-label${quiet ? " quiet" : ""}${userOpened ? " toggle" : ""}` }, labelText);
      if (userOpened) {
        // A sector the reader opened closes again from its label.
        t.setAttribute("role", "button"); t.setAttribute("tabindex", "0");
        t.setAttribute("aria-label", `${x.sec.key}: ${dayCount(n)}, zuklappen`);
        t.setAttribute("aria-expanded", "true");
        const toggle = () => model.onToggle(x.sec.key);
        t.addEventListener("click", toggle);
        t.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); toggle(); } });
      }
      gLabels.append(t);
    }
  }

  // Diamonds, one tab stop for all, arrow keys move in ring order (roving tabindex).
  const els = diamonds.map((dm, i) => {
    const sel = dm.it.uid === selectedUid;
    const rec = dm.it.record;
    const name = `${rec.identifier}, ${rec.dating}`;
    const g = s("g", { class: `regest${sel ? " is-selected" : ""}${dm.quiet ? " quiet" : ""}`, role: "button",
      tabindex: -1, "aria-pressed": String(sel), "aria-label": `${name}, ${dm.it.roles.join(" ") || "ohne Rolle"}` });
    g.append(s("circle", { cx: dm.x, cy: dm.y, r: d + 4, class: "hit" }), diamond(dm.x, dm.y, sel ? d + 2 : d, {}));
    g.addEventListener("click", () => model.onSelect(sel ? null : dm.it.uid));
    g.addEventListener("keydown", (ev) => {
      const k = ev.key;
      if (k === "Enter" || k === " ") { ev.preventDefault(); model.onSelect(sel ? null : dm.it.uid); return; }
      const step = k === "ArrowRight" || k === "ArrowDown" ? 1 : k === "ArrowLeft" || k === "ArrowUp" ? -1 : 0;
      const to = k === "Home" ? 0 : k === "End" ? els.length - 1 : step ? (i + step + els.length) % els.length : -1;
      if (to < 0) return;
      ev.preventDefault();
      g.setAttribute("tabindex", "-1");
      els[to].setAttribute("tabindex", "0");
      els[to].focus();
    });
    tipOn(g, name, dm.x, dm.y);
    gMarks.append(g);
    return g;
  });
  const stop = els[diamonds.findIndex((dm) => dm.it.uid === selectedUid)] || els[0];
  if (stop) stop.setAttribute("tabindex", "0");

  // The selected regest and its other entries.
  const sp = selectedUid && pos.get(selectedUid);
  if (sp) {
    gEdges.append(s("line", { x1: cx, y1: cy, x2: sp.x, y2: sp.y, class: "edge-selected" }));
    if (sPos) {
      const t = s("text", { x: sPos.x, y: sPos.y, "text-anchor": "middle", class: "selected-label", role: "link", tabindex: 0,
        "aria-label": `${selText}: Regest unten lesen` }, selText);
      const read = () => model.onRead(selectedUid);
      t.addEventListener("click", read);
      t.addEventListener("keydown", (ev) => { if (ev.key === "Enter") read(); });
      gLabels.append(t);
    }
    if (record) drawCoNamed(sp);
    else if (recordFailed) {
      gLabels.append(s("text", { x: cx, y: H - 10, "text-anchor": "middle", class: "figure-note" },
        "Die Einträge dieses Regests konnten nicht geladen werden."));
    }
  }

  function drawCoNamed(sp) {
    const self = entry.identifier;
    const rows = (record.rows || []).filter((r) => r.entry?.identifier !== self);
    const groups = new Map();
    for (const r of rows) {
      const k = roleKey(r.roles || []);
      if (!groups.has(k)) groups.set(k, { key: k, apparatus: isApparatusOnly(r.roles || []), rows: [] });
      groups.get(k).rows.push(r);
    }
    const ordered = [...groups.values()].sort((a, b) =>
      (a.apparatus - b.apparatus) || b.rows.length - a.rows.length || a.key.localeCompare(b.key));
    // Slots in a column, groups apart by a free slot, the apparatus-only groups by two.
    const slots = [];
    ordered.forEach((g, gi) => {
      if (gi > 0) slots.push(null);
      if (g.apparatus && gi > 0 && !ordered[gi - 1].apparatus) slots.push(null);
      for (const r of g.rows) slots.push({ g, r });
    });
    // The column follows an ellipse as tall as the drawing, so a long list stays on the
    // regest's side; on a wide screen it is the circle of radius R2.
    const stepY = narrow ? 13 : 16.5;
    const Ry = Math.max(R2, H / 2 - 26);
    const maxDy = Ry * 0.96;
    const perSide = Math.floor((2 * maxDy) / stepY) + 1;
    const pref = Math.cos(sp.a) >= 0 ? 1 : -1;
    const sides = [slots.slice(0, perSide), slots.slice(perSide)];
    const onEllipse = (rx, ry, dy) => rx * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry)));
    const nodes = [];
    sides.forEach((part, si) => {
      if (!part.length) return;
      const side = si === 0 ? pref : -pref;
      const span = (part.length - 1) * stepY;
      const centre = Math.min(Math.max(sp.y - cy, -maxDy + span / 2), maxDy - span / 2);
      part.forEach((slot, i) => {
        if (!slot) return;
        const dy = centre - span / 2 + i * stepY;
        nodes.push({ ...slot, x: cx + side * onEllipse(R2, Ry, dy), y: cy + dy, side });
      });
    });
    // Group junctions on a smaller ellipse between ring and column, at the group's mean height.
    const Rjy = Rj * (Ry / R2);
    const junction = new Map();
    for (const g of ordered) {
      const mine = nodes.filter((n) => n.g === g);
      const side = mine[0].side;
      const my = mine.reduce((a, n) => a + n.y, 0) / mine.length - cy;
      const dy = Math.max(-Rjy * 0.92, Math.min(Rjy * 0.92, my));
      junction.set(g, { x: cx + side * onEllipse(Rj, Rjy, dy), y: cy + dy, side });
    }
    for (const g of ordered) {
      const j = junction.get(g);
      const cls = g.apparatus ? "edge quiet" : "edge";
      gEdges.append(s("line", { x1: sp.x, y1: sp.y, x2: j.x, y2: j.y, class: cls, "data-group": g.key }));
      for (const n of nodes.filter((m) => m.g === g)) {
        gEdges.append(s("line", { x1: j.x, y1: j.y, x2: n.x, y2: n.y, class: cls, "data-group": g.key }));
      }
    }
    // Entry marks first, so labels avoid them.
    for (const n of nodes) space.add({ x: n.x - 7, y: n.y - 7, w: 14, h: 14 });
    // Token labels at the junctions: the role of every edge behind them.
    for (const g of ordered) {
      const j = junction.get(g);
      const text = g.key || "ohne Rolle";
      const w = textWidth(text, SMALL_FONT);
      const a = j.side > 0 ? "end" : "start";
      const p = place(space, [
        { x: j.x - j.side * 6, y: j.y + 4, anchor: a }, { x: j.x - j.side * 6, y: j.y - 8, anchor: a },
        { x: j.x - j.side * 6, y: j.y + 16, anchor: a }, { x: j.x + j.side * 6, y: j.y - 8, anchor: j.side > 0 ? "start" : "end" },
        { x: j.x - j.side * 6, y: j.y - 20, anchor: a }, { x: j.x - j.side * 6, y: j.y + 28, anchor: a }], w, 11)
        || nearest(space, j.x, j.y, w, 11);
      gEdges.append(s("circle", { cx: j.x, cy: j.y, r: 2, class: g.apparatus ? "junction quiet" : "junction" }));
      if (p) {
        gLabels.append(s("text", { x: p.x, y: p.y, "text-anchor": p.anchor, class: `token${g.apparatus ? " quiet" : ""}` }, text));
        if (Math.hypot((p.anchor === "end" ? p.x : p.x) - j.x, p.y - 4 - j.y) > 10) {
          gEdges.append(s("line", { x1: j.x, y1: j.y, x2: p.x, y2: p.y - 4, class: "leader" }));
        }
      }
    }
    // At most this many names stand at once, so a dense regest stays within the density limits
    // of the work profile; the rest appear on pointing and focus, and all stand in the detail.
    const MAX_NAMES = 34;
    let named = 0;
    for (const n of nodes) {
      const id = n.r.entry?.identifier;
      const kind = kindOf(n.r.entry?.id || "");
      const label = n.r.entry?.shortLabel || id;
      const roles = (n.r.roles || []).join(" ") || "ohne Rolle";
      const a = s("a", { href: entryHref(id, selectedUid), class: `entry${n.g.apparatus ? " quiet" : ""}`,
        "aria-label": `${label}, ${roles}` });
      a.append(s("circle", { cx: n.x, cy: n.y, r: 9, class: "hit" }), shape(kind, n.x, n.y, 4.6, {}));
      const text = short(label);
      const w = textWidth(text, LABEL_FONT);
      const anchor = n.side > 0 ? "start" : "end";
      const p = named < MAX_NAMES ? place(space, [{ x: n.x + n.side * 9, y: n.y + 4, anchor }], w, 12.5) : null;
      if (p) named++;
      if (p) a.append(s("text", { x: p.x, y: p.y, "text-anchor": anchor, class: "entry-label" }, text));
      if (!p || text !== label) tipOn(a, label, n.x, n.y);
      // Pointing at an entry lights its path to the regest.
      const lines = () => gEdges.querySelectorAll(`[data-group="${CSS.escape(n.g.key)}"]`);
      for (const ev of ["pointerenter", "focus"]) a.addEventListener(ev, () => { svg.classList.add("lit"); lines().forEach((l) => l.classList.add("on")); });
      for (const ev of ["pointerleave", "blur"]) a.addEventListener(ev, () => { svg.classList.remove("lit"); gEdges.querySelectorAll(".on").forEach((l) => l.classList.remove("on")); });
      gMarks.append(a);
    }
  }

  host.replaceChildren(svg);
  return { focusSelected: () => els.find((e) => e.getAttribute("tabindex") === "0")?.focus() };
}
