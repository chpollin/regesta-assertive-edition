// The network around one register entry, drawn as inline SVG.
//
// Centre: the entry, with the number of its regests as the figure's unit. Ring: its regests as
// diamonds, in sectors by the token combination the entry carries there (model.js sectorsOf),
// time order clockwise within a sector; a sector label is the entry's own role. A sector that
// does not fit stands as a bundle and opens on click, Enter or Space. On a wide screen a
// selected regest draws its other register entries in a column beside the ring, grouped by
// token combination; each group's edges meet at a point carrying the co-named role in a
// different type than the sector labels. At narrow width the figure keeps the ring alone and
// the detail under the list line carries the co-named entries. Two entries are never joined
// directly. The layout depends only on the data and the drawing size.

import { s, entryHref } from "./dom.js";
import { isApparatusOnly, kindOf, roleKey } from "./model.js";
import { KIND_KEY, dayCount } from "./text.js";

const LABEL_FONT = '500 12.5px "Instrument Sans", system-ui, sans-serif';
const STRONG_FONT = '600 12.5px "Instrument Sans", system-ui, sans-serif';
const SMALL_FONT = 'italic 500 11px "Instrument Sans", system-ui, sans-serif';
const KEY_FONT = '500 11px "Instrument Sans", system-ui, sans-serif';
const MAX_CHARS = 30;
const TAU = Math.PI * 2;

const ctx = document.createElement("canvas").getContext("2d");
function textWidth(text, font) {
  ctx.font = font;
  // Never below 6.6 px per character at 12.5 px, after short words had been underestimated.
  const small = font !== LABEL_FONT && font !== STRONG_FONT;
  return Math.max(ctx.measureText(text).width, text.length * 6.6 * (small ? 0.88 : 1));
}

const short = (t) => (t.length > MAX_CHARS ? `${t.slice(0, MAX_CHARS - 1).trimEnd()}…` : t);

// Collision bookkeeping: axis-aligned boxes of everything drawn so far. The text box follows
// the font box the browser reports (about 0.98 em above and 0.3 em below the baseline).
class Space {
  constructor(w, h) { this.w = w; this.h = h; this.boxes = []; }
  fits(b) {
    if (b.x < 2 || b.y < 2 || b.x + b.w > this.w - 2 || b.y + b.h > this.h - 2) return false;
    return !this.boxes.some((o) => b.x < o.x + o.w + 2 && o.x < b.x + b.w + 2 && b.y < o.y + o.h + 0.5 && o.y < b.y + b.h + 0.5);
  }
  add(b) { this.boxes.push(b); }
  // A line as a chain of small boxes, so no label lies on it.
  addLine(x1, y1, x2, y2) {
    const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 4));
    for (let i = 0; i <= n; i++) {
      const x = x1 + ((x2 - x1) * i) / n, y = y1 + ((y2 - y1) * i) / n;
      this.boxes.push({ x: x - 1.5, y: y - 1.5, w: 3, h: 3 });
    }
  }
}

function box(x, y, w, anchor, size = 12.5) {
  const left = anchor === "start" ? x : anchor === "end" ? x - w : x - w / 2;
  return { x: left, y: y - size * 0.98, w, h: size * 1.28 };
}

function place(space, candidates, w, size) {
  for (const c of candidates) {
    const b = box(c.x, c.y, w, c.anchor, size);
    if (space.fits(b)) { space.add(b); return { ...c, box: b }; }
  }
  return null;
}

// Last resort for a label that must stand: the nearest free spot in the drawing.
// Every anchor is tried; candidates are ranked by the distance of the whole box to the point.
function nearest(space, ax, ay, w, size) {
  const grid = [];
  for (let gy = 14; gy < space.h - 4; gy += 5) {
    for (let gx = 4; gx < space.w - 4; gx += 6) {
      for (const anchor of ["start", "middle", "end"]) {
        const c = { x: gx, y: gy, anchor };
        c.dist = toBox(box(gx, gy, w, anchor, size), ax, ay).d;
        grid.push(c);
      }
    }
  }
  grid.sort((u, v) => u.dist - v.dist);
  return place(space, grid, w, size);
}

// Distance from a point to a box, and the box point nearest to it.
function toBox(b, x, y) {
  const nx = Math.max(b.x, Math.min(x, b.x + b.w));
  const ny = Math.max(b.y, Math.min(y, b.y + b.h));
  return { d: Math.hypot(nx - x, ny - y), x: nx, y: ny };
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
const stack = (x, y, d, angle, attrs) => {
  const g = s("g", attrs);
  for (const off of [-1, 0, 1]) g.append(diamond(x + off * Math.cos(angle) * 5, y + off * Math.sin(angle) * 5, d, {}));
  return g;
};

// Angles of the sectors, the bundles and the rows. Sectors keep their own width and the
// slack goes into the gaps, so each sector stands as a visible group.
function layoutRing(sectors, R1, pitch, open, keep) {
  const n = sectors.length;
  const minGap = n > 1 ? Math.min(0.14, 1.4 / n) : 0;
  const avail = TAU - minGap * n;
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
  const sum = total();
  const scale = Math.min(1, avail / sum);
  const gap = n > 1 ? (TAU - sum * scale) / n : 0;
  let a = -need(st[0]) * scale / 2;
  for (const x of st) {
    x.arc = need(x) * scale;
    x.start = a;
    x.mid = a + x.arc / 2;
    a += x.arc + gap;
  }
  return st;
}

export function drawFigure(host, model) {
  const { entry, sectors, selectedUid, record, recordFailed, open } = model;
  const W = Math.max(300, host.clientWidth);
  const narrow = W < 640;
  const column = !narrow;
  const basePitch = narrow ? 9.5 : 11.5;
  const d = narrow ? 3.6 : 4.3;

  const selSector = sectors.find((sec) => sec.items.some((it) => it.uid === selectedUid));
  const selItem = selSector?.items.find((x) => x.uid === selectedUid);
  const coRows = selItem && record && column ? (record.rows || []).filter((r) => r.entry?.identifier !== entry.identifier) : [];

  // Key items for every mark this drawing contains; ring and column are computed first.
  const top = host.getBoundingClientRect().top + window.scrollY;
  const room = Math.max(0, window.innerHeight - top - 12);
  let H, R1, R2, cx, cy;
  // The key is laid out against the width first, then the drawing takes the rest of the height.
  const keyItems = [];
  const keyLayout = (items) => {
    let x = 6, line = 0;
    const out = [];
    for (const it of items) {
      const w = 16 + (it.mark === "quiet" ? 14 : it.mark === "bundle" ? 6 : 0) + textWidth(it.word, KEY_FONT);
      if (x + w > W - 6 && x > 6) { x = 6; line++; }
      out.push({ ...it, x, line, w });
      x += w + 14;
    }
    return { out, lines: line + 1 };
  };
  const preKey = keyLayout([{ word: "Regest" }, { word: "gewähltes Regest" }, { word: "Bündel, öffnet per Klick" },
    { word: "nur in Kommentar oder Überlieferung genannt", mark: "quiet" }, { word: "Person oder Gruppe" }, { word: "Ort" }]);
  const keyH = preKey.lines * 16 + 8;
  if (narrow) {
    R1 = W / 2 - 52;
    R2 = R1;
    // The ring alone fills the first screen, so the list starts below it.
    H = Math.max(2 * R1 + 96 + keyH, Math.min(room, W * 1.6));
  } else {
    H = Math.max(440, Math.min(room, 760));
    R2 = Math.max(110, Math.min(W / 2 - 196, (H - keyH) / 2 - 16));
    R1 = R2 * 0.6;
  }
  cx = W / 2;
  cy = (H - keyH) / 2 + 4;
  const Rj = R1 + (R2 - R1) * 0.5;

  const st = layoutRing(sectors, R1, basePitch, new Set(open), selSector);
  const pitch = basePitch;

  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: "figure",
    role: "group", "aria-label": `Netz um ${entry.shortLabel}: Regesten nach Rolle${column ? ", mit den Einträgen des gewählten Regests" : ""}` });
  const gEdges = s("g", { class: "edges" });
  const gMarks = s("g", { class: "marks" });
  const gLabels = s("g", { class: "labels" });
  const gTip = s("g", { class: "tip", "aria-hidden": "true", visibility: "hidden" });
  svg.append(gEdges, gMarks, gLabels, gTip);
  const space = new Space(W, H);

  const tipRect = s("rect", { rx: 2 });
  const tipText = s("text", {});
  gTip.append(tipRect, tipText);
  let armed = null;
  const showTip = (text, x, y) => {
    tipText.textContent = text;
    const w = textWidth(text, LABEL_FONT) + 12;
    const tx = Math.min(Math.max(4, x - w / 2), W - w - 4);
    const ty = y - 28 < 4 ? y + 14 : y - 28;
    tipRect.setAttribute("x", tx); tipRect.setAttribute("y", ty);
    tipRect.setAttribute("width", w); tipRect.setAttribute("height", 20);
    tipText.setAttribute("x", tx + 6); tipText.setAttribute("y", ty + 14);
    gTip.setAttribute("visibility", "visible");
  };
  const hideTip = () => gTip.setAttribute("visibility", "hidden");
  // Pointer and keyboard show the full name; on touch the first tap shows it, the second acts.
  const tipOn = (el, text, x, y, touchArms = false) => {
    let touch = false;
    el.addEventListener("pointerdown", (ev) => { touch = ev.pointerType === "touch"; });
    el.addEventListener("pointerenter", (ev) => { if (ev.pointerType !== "touch") showTip(text, x, y); });
    el.addEventListener("focus", () => showTip(text, x, y));
    for (const ev of ["pointerleave", "blur"]) el.addEventListener(ev, () => { if (!touch) hideTip(); });
    if (touchArms) el.addEventListener("click", (ev) => {
      if (touch && armed !== el) { ev.preventDefault(); ev.stopImmediatePropagation(); armed = el; showTip(text, x, y); }
    }, { capture: true });
  };

  // Ring marks first (positions only), so every label later avoids them.
  const diamonds = [];
  const pos = new Map();
  const quietOf = (sec) => sec.apparatus;
  for (const x of st) {
    const n = x.sec.items.length;
    x.points = [];
    if (x.bundled) {
      const bx = cx + Math.cos(x.mid) * R1, by = cy + Math.sin(x.mid) * R1;
      x.points.push({ x: bx, y: by });
      space.add({ x: bx - 11, y: by - 11, w: 22, h: 22 });
      x.labelR = R1 - 18;
    } else {
      const cols = Math.ceil(n / x.rows);
      const step = cols > 1 ? x.arc / cols : 0;
      x.sec.items.forEach((it, i) => {
        const col = Math.floor(i / x.rows);
        const row = i % x.rows;
        const a = x.start + (col + 0.5) * (x.arc / cols);
        const r = R1 - row * pitch;
        const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
        pos.set(it.uid, { x: px, y: py, a });
        diamonds.push({ it, x: px, y: py, quiet: quietOf(x.sec) });
        x.points.push({ x: px, y: py });
        space.add({ x: px - d - 1, y: py - d - 1, w: 2 * d + 2, h: 2 * d + 2 });
      });
      if (cols > 1 && step) {
        const a0 = x.start + 0.5 * step, a1 = x.start + (cols - 0.5) * step;
        const large = a1 - a0 > Math.PI ? 1 : 0;
        gEdges.append(s("path", { class: "sector-arc", d: `M${cx + Math.cos(a0) * R1},${cy + Math.sin(a0) * R1}A${R1},${R1} 0 ${large} 1 ${cx + Math.cos(a1) * R1},${cy + Math.sin(a1) * R1}` }));
      }
      x.labelR = R1 - (x.rows - 1) * pitch - 12;
    }
  }

  // Centre mark and the accent line to the selected regest are obstacles too.
  const cKind = kindOf(entry.id);
  gMarks.append(shape(cKind === "parent" ? "actor" : cKind, cx, cy, 8, { class: "centre-mark" }));
  space.add({ x: cx - 10, y: cy - 10, w: 20, h: 20 });
  const sp = selectedUid && pos.get(selectedUid);
  if (sp) {
    gEdges.append(s("line", { x1: cx, y1: cy, x2: sp.x, y2: sp.y, class: "edge-selected" }));
    space.addLine(cx, cy, sp.x, sp.y);
  }

  // The co-named column (wide only): positions now, so ring labels avoid its marks.
  const col = column && sp && record ? layoutColumn(sp) : null;

  // Key: one quiet line (two at narrow width) at the foot of the figure, naming every mark.
  const has = {
    regest: diamonds.some((x) => !x.quiet),
    selected: !!sp,
    bundle: st.some((x) => x.bundled),
    quiet: diamonds.some((x) => x.quiet) || st.some((x) => x.bundled && quietOf(x.sec)) || (col?.nodes.some((n) => n.g.apparatus) ?? false),
  };
  if (has.regest) keyItems.push({ word: "Regest", mark: "regest" });
  if (has.selected) keyItems.push({ word: "gewähltes Regest", mark: "selected" });
  if (has.bundle) keyItems.push({ word: "Bündel, öffnet per Klick", mark: "bundle" });
  if (has.quiet) keyItems.push({ word: "nur in Kommentar oder Überlieferung genannt", mark: "quiet" });
  for (const k of ["actor", "place", "subject", "event", "unclassified"]) {
    if (col?.nodes.some((n) => kindOf(n.r.entry?.id || "") === k)) keyItems.push({ word: KIND_KEY[k], mark: k });
  }
  const key = keyLayout(keyItems);
  const keyTop = H - key.lines * 16 - 2;
  for (const it of key.out) {
    const ky = keyTop + it.line * 16 + 10;
    const mx = it.x + 6, my = ky - 4;
    if (it.mark === "regest") gLabels.append(diamond(mx, my, 4.5, { class: "key-mark" }));
    else if (it.mark === "selected") gLabels.append(diamond(mx, my, 5, { class: "key-mark selected" }));
    else if (it.mark === "bundle") gLabels.append(stack(mx + 3, my, 3.6, 0, { class: "key-mark bundle" }));
    else if (it.mark === "quiet") {
      // Hollow mark and dashed edge share one meaning.
      gLabels.append(diamond(mx, my, 4.5, { class: "key-mark quiet" }));
      gLabels.append(s("line", { x1: mx + 7, y1: my, x2: mx + 19, y2: my, class: "key-dash" }));
    } else gLabels.append(shape(it.mark, mx, my, 4.3, { class: "key-mark" }));
    gLabels.append(s("text", { x: it.x + 16 + (it.mark === "quiet" ? 14 : it.mark === "bundle" ? 6 : 0), y: ky, class: "key" }, it.word));
    space.add({ x: it.x, y: ky - 12, w: it.w, h: 16 });
  }

  // Centre label: the entry's name, once the unit of the figure, and the selected regest's
  // label, stacked on the side of the centre the accent line leaves free.
  const total = sectors.reduce((a, sec) => a + sec.items.length, 0);
  const unit = `${dayCount(total)}, nach Rolle`;
  const selText = selItem ? `${selItem.record.identifier}, ${selItem.record.dating}` : "";
  const firstSide = sp && sp.y > cy + 4 ? -1 : 1;
  const ys = (side) => (side > 0 ? [cy + 26, cy + 44, cy + 64] : [cy - 50, cy - 31, cy - 70]);
  const at = (i) => [firstSide, -firstSide].map((sd) => ({ x: cx, y: ys(sd)[i], anchor: "middle" }));
  let cName = entry.shortLabel;
  let cPos = place(space, at(0), textWidth(cName, STRONG_FONT), 12.5);
  // The full name where it fits; otherwise shortened, the full name standing in the title row.
  if (!cPos) cPos = nearest(space, cx, cy + 26 * firstSide, textWidth(cName, STRONG_FONT), 12.5);
  if (cPos) gLabels.append(s("text", { x: cPos.x, y: cPos.y, "text-anchor": cPos.anchor, class: "centre-label" }, cName));
  const uw = textWidth(unit, LABEL_FONT);
  const uPos = place(space, at(1), uw, 12.5) || nearest(space, cx, cy + 40, uw, 12.5);
  if (uPos) gLabels.append(s("text", { x: uPos.x, y: uPos.y, "text-anchor": uPos.anchor, class: "unit-label" }, unit));
  if (sp) {
    const sw = textWidth(selText, LABEL_FONT);
    const sPos = place(space, at(2), sw, 12.5) || nearest(space, cx, cy + 64 * firstSide, sw, 12.5);
    if (sPos) {
      const t = s("text", { x: sPos.x, y: sPos.y, "text-anchor": sPos.anchor, class: "selected-label", role: "link", tabindex: 0,
        "aria-label": `${selText}: Regest unten lesen` }, selText);
      const read = () => model.onRead(selectedUid);
      t.addEventListener("click", read);
      t.addEventListener("keydown", (ev) => { if (ev.key === "Enter") read(); });
      gLabels.append(t);
    }
  }

  // Sector labels: the entry's own role, semibold with its count of regests, at the sector.
  // A label that cannot stand right at its sector gets a leader ending at its nearest diamond.
  for (const x of st) {
    const n = x.sec.items.length;
    const quiet = quietOf(x.sec);
    const labelText = `${x.sec.key || "ohne Rolle"} ${n}`;
    const userOpened = open.includes(x.sec.key) && x.sec !== selSector;
    const lw = textWidth(labelText, STRONG_FONT);
    const c = Math.cos(x.mid);
    const anchor = c > 0.35 ? "end" : c < -0.35 ? "start" : "middle";
    const out = anchor === "end" ? "start" : anchor === "start" ? "end" : "middle";
    const vy = Math.sin(x.mid) > 0 ? 1 : -1;
    const cands = [];
    // Right at the sector: inside along its points, then outside them.
    const ref = x.points.length > 2 ? [x.points[Math.floor(x.points.length / 2)], x.points[0], x.points[x.points.length - 1]] : x.points;
    for (const p of ref) {
      const a = Math.atan2(p.y - cy, p.x - cx);
      for (const back of [12, 22]) cands.push({ x: p.x - Math.cos(a) * back, y: p.y - Math.sin(a) * back + 4 + (anchor === "middle" ? -vy * 6 : 0), anchor });
      for (const ahead of [12, 22]) cands.push({ x: p.x + Math.cos(a) * ahead, y: p.y + Math.sin(a) * ahead + 4 + (out === "middle" ? vy * 8 : 0), anchor: out });
    }
    for (const back of [0, 16, 32, 48]) for (const dy of [0, 13, -13, 26, -26]) {
      cands.push({ x: cx + Math.cos(x.mid) * (x.labelR - back), y: cy + Math.sin(x.mid) * (x.labelR - back) + 4 + dy, anchor });
    }
    let p = place(space, cands, lw, 12.5) || nearest(space, cx + Math.cos(x.mid) * R1, cy + Math.sin(x.mid) * R1, lw, 12.5);
    if (!p) continue;
    // Leader from the nearest point of the sector to the label, when they are not adjacent.
    let best = null;
    for (const q of x.points) { const t = toBox(p.box, q.x, q.y); if (!best || t.d < best.d) best = { ...t, q }; }
    if (best && best.d > 16) {
      const ang = Math.atan2(best.y - best.q.y, best.x - best.q.x);
      const off = x.bundled ? 12 : d + 2;
      gEdges.append(s("line", { x1: best.q.x + Math.cos(ang) * off, y1: best.q.y + Math.sin(ang) * off, x2: best.x, y2: best.y, class: "leader" }));
    }
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

  // Bundles.
  for (const x of st.filter((y) => y.bundled)) {
    const n = x.sec.items.length;
    const { x: bx, y: by } = x.points[0];
    const g = stack(bx, by, d + 1.5, x.mid + Math.PI / 2, { class: `bundle${quietOf(x.sec) ? " quiet" : ""}`, role: "button", tabindex: 0,
      "aria-expanded": "false", "aria-label": `${x.sec.key || "ohne Rolle"}: ${dayCount(n)}, aufklappen` });
    g.prepend(s("circle", { cx: bx, cy: by, r: 12, class: "hit" }));
    const toggle = () => model.onToggle(x.sec.key);
    g.addEventListener("click", toggle);
    g.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); toggle(); } });
    gMarks.append(g);
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
  const stopEl = els[diamonds.findIndex((dm) => dm.it.uid === selectedUid)] || els[0];
  if (stopEl) stopEl.setAttribute("tabindex", "0");

  if (sp && recordFailed) {
    const msg = "Die Einträge dieses Regests konnten nicht geladen werden.";
    const p = nearest(space, cx, H - 40, textWidth(msg, LABEL_FONT), 12.5);
    if (p) gLabels.append(s("text", { x: p.x, y: p.y, "text-anchor": p.anchor, class: "figure-note" }, msg));
  }
  if (col) drawColumn(col, sp);

  function layoutColumn(sp) {
    const groups = new Map();
    for (const r of coRows) {
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
    const stepY = 17.5;
    const Ry = Math.max(R2, (H - keyH) / 2 - 20);
    const maxDy = Math.min(Ry * 0.96, cy - 12, H - keyH - cy - 8);
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
    const Rjy = Rj * (Ry / R2);
    const junction = new Map();
    for (const g of ordered) {
      const mine = nodes.filter((n) => n.g === g);
      const side = mine[0].side;
      const my = mine.reduce((a, n) => a + n.y, 0) / mine.length - cy;
      const dy = Math.max(-Rjy * 0.92, Math.min(Rjy * 0.92, my));
      junction.set(g, { x: cx + side * onEllipse(Rj, Rjy, dy), y: cy + dy, side });
    }
    for (const n of nodes) space.add({ x: n.x - 6, y: n.y - 6, w: 12, h: 12 });
    for (const j of junction.values()) space.add({ x: j.x - 3, y: j.y - 3, w: 6, h: 6 });
    return { ordered, nodes, junction };
  }

  function drawColumn({ ordered, nodes, junction }, sp) {
    for (const g of ordered) {
      const j = junction.get(g);
      const cls = g.apparatus ? "edge quiet" : "edge";
      gEdges.append(s("line", { x1: sp.x, y1: sp.y, x2: j.x, y2: j.y, class: cls, "data-group": g.key }));
      for (const n of nodes.filter((m) => m.g === g)) gEdges.append(s("line", { x1: j.x, y1: j.y, x2: n.x, y2: n.y, class: cls, "data-group": g.key }));
      gEdges.append(s("circle", { cx: j.x, cy: j.y, r: 2, class: g.apparatus ? "junction quiet" : "junction" }));
    }
    // Co-named roles at the meeting points: small italic muted type, unlike the sector labels.
    for (const g of ordered) {
      const j = junction.get(g);
      const text = g.key || "ohne Rolle";
      const w = textWidth(text, SMALL_FONT);
      const a = j.side > 0 ? "end" : "start";
      const p = place(space, [
        { x: j.x - j.side * 6, y: j.y + 4, anchor: a }, { x: j.x - j.side * 6, y: j.y - 7, anchor: a },
        { x: j.x - j.side * 6, y: j.y + 15, anchor: a }, { x: j.x + j.side * 6, y: j.y - 7, anchor: j.side > 0 ? "start" : "end" },
        { x: j.x - j.side * 6, y: j.y - 18, anchor: a }, { x: j.x - j.side * 6, y: j.y + 26, anchor: a }], w, 11)
        || nearest(space, j.x, j.y, w, 11);
      if (!p) continue;
      gLabels.append(s("text", { x: p.x, y: p.y, "text-anchor": p.anchor, class: `token${g.apparatus ? " quiet" : ""}` }, text));
      const t = toBox(p.box, j.x, j.y);
      if (t.d > 6) gEdges.append(s("line", { x1: j.x, y1: j.y, x2: t.x, y2: t.y, class: "leader" }));
    }
    // At most this many names stand at once, so a dense regest stays within the density limits
    // of the work profile; the rest appear on pointing, focus and a first tap, and all stand
    // in the detail.
    const MAX_NAMES = 34;
    let named = 0;
    for (const n of nodes) {
      const id = n.r.entry?.identifier;
      const kind = kindOf(n.r.entry?.id || "");
      const label = n.r.entry?.shortLabel || id;
      const roles = (n.r.roles || []).join(" ") || "ohne Rolle";
      const a = s("a", { href: entryHref(id, selectedUid), class: `entry${n.g.apparatus ? " quiet" : ""}`, "aria-label": `${label}, ${roles}` });
      a.append(s("circle", { cx: n.x, cy: n.y, r: 9, class: "hit" }), shape(kind, n.x, n.y, 4.6, {}));
      const text = short(label);
      const w = textWidth(text, LABEL_FONT);
      const anchor = n.side > 0 ? "start" : "end";
      const p = named < MAX_NAMES ? place(space, [{ x: n.x + n.side * 9, y: n.y + 4, anchor }], w, 12.5) : null;
      if (p) { named++; a.append(s("text", { x: p.x, y: p.y, "text-anchor": anchor, class: "entry-label" }, text)); }
      if (!p || text !== label) tipOn(a, label, n.x, n.y, true);
      const lines = () => gEdges.querySelectorAll(`[data-group="${CSS.escape(n.g.key)}"]`);
      for (const ev of ["pointerenter", "focus"]) a.addEventListener(ev, () => { svg.classList.add("lit"); lines().forEach((l) => l.classList.add("on")); });
      for (const ev of ["pointerleave", "blur"]) a.addEventListener(ev, () => { svg.classList.remove("lit"); gEdges.querySelectorAll(".on").forEach((l) => l.classList.remove("on")); });
      gMarks.append(a);
    }
  }

  host.replaceChildren(svg);
}
