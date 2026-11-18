/**
 * Whole network without a selected person, after the operator's verdict of 2026-11-14 on the
 * former drawing of all 1101 nodes („die gefällt mir nicht“): overview first. Friedrich takes
 * part in nearly every statement, so every line ran to him; the overview leaves him out and
 * shows the TOP persons most often named in statements, joined where they stand together in
 * at least one statement, the line the heavier the more statements they share. A circle grows
 * with the person's statements. A click opens the person's circle, as before.
 *
 * The layout is a small deterministic force layout (fixed start on a circle, fixed number of
 * steps), so the same data give the same picture. It honours the shared filters, since it is
 * computed from the filtered graph the view hands in.
 */
import { s } from "./svg.js";
import { t } from "./i18n.js";

const TOP = 40;

/**
 * @param {{nodes: any[], edges: any[]}} graph  the filtered graph of the view
 * @param {string} centre  the IRI left out because it takes part in nearly everything
 */
export function personNetwork(graph, centre) {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const actsOf = new Map();
  for (const e of graph.edges) {
    if (e.kind !== "role") continue;
    const person = byId.get(e.target);
    if (!person || person.kind === "act" || person.id === centre) continue;
    if (!actsOf.has(e.target)) actsOf.set(e.target, new Set());
    actsOf.get(e.target).add(e.source);
  }
  const top = [...actsOf].sort((a, b) => b[1].size - a[1].size || byId.get(a[0]).label.localeCompare(byId.get(b[0]).label, "de")).slice(0, TOP);
  const nodes = top.map(([id, acts]) => ({ id, label: byId.get(id).label, n: acts.size, acts, group: byId.get(id).kind === "group" }));
  const links = [];
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      let w = 0;
      for (const a of nodes[i].acts) if (nodes[j].acts.has(a)) w += 1;
      if (w) links.push({ a: i, b: j, w });
    }
  }
  return { nodes, links };
}

/** Fruchterman-Reingold with a fixed start and a fixed number of steps. */
function layout(net, width, height) {
  const { nodes, links } = net;
  const k = Math.sqrt((width * height) / Math.max(1, nodes.length)) * 0.6;
  const pos = nodes.map((_, i) => {
    const a = (2 * Math.PI * i) / Math.max(1, nodes.length);
    return { x: width / 2 + Math.cos(a) * width * 0.3, y: height / 2 + Math.sin(a) * height * 0.3 };
  });
  let t = width / 8;
  for (let step = 0; step < 300; step += 1) {
    const d = pos.map(() => ({ x: 0, y: 0 }));
    for (let i = 0; i < pos.length; i += 1) {
      for (let j = i + 1; j < pos.length; j += 1) {
        const dx = pos[i].x - pos[j].x || 0.01;
        const dy = pos[i].y - pos[j].y || 0.01;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const f = (k * k) / dist;
        d[i].x += (dx / dist) * f;
        d[i].y += (dy / dist) * f;
        d[j].x -= (dx / dist) * f;
        d[j].y -= (dy / dist) * f;
      }
    }
    for (const l of links) {
      const dx = pos[l.a].x - pos[l.b].x;
      const dy = pos[l.a].y - pos[l.b].y;
      const dist = Math.max(1, Math.hypot(dx, dy));
      const f = ((dist * dist) / k) * Math.min(3, 0.6 + l.w * 0.2);
      d[l.a].x -= (dx / dist) * f;
      d[l.a].y -= (dy / dist) * f;
      d[l.b].x += (dx / dist) * f;
      d[l.b].y += (dy / dist) * f;
    }
    // A weak pull to the middle keeps unlinked persons in the picture.
    for (let i = 0; i < pos.length; i += 1) {
      d[i].x += (width / 2 - pos[i].x) * 0.02 * k;
      d[i].y += (height / 2 - pos[i].y) * 0.02 * k;
      const len = Math.max(1, Math.hypot(d[i].x, d[i].y));
      pos[i].x += (d[i].x / len) * Math.min(len, t);
      pos[i].y += (d[i].y / len) * Math.min(len, t);
    }
    t *= 0.985;
  }
  // Fit into the drawing area with room for labels.
  const xs = pos.map((p) => p.x);
  const ys = pos.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const padX = Math.min(170, width * 0.18);
  // Room above for the line on the left-out person; the key below has its own room.
  const padTop = 56;
  const padBottom = 24;
  const sx = (width - 2 * padX) / Math.max(1, x1 - x0);
  const sy = (height - padTop - padBottom) / Math.max(1, y1 - y0);
  return pos.map((p) => ({ x: padX + (p.x - x0) * sx, y: padTop + (p.y - y0) * sy }));
}

/**
 * Draw the overview into host. onSelect(id) opens a person's circle; onPoint(label|null)
 * names the pointed person in the view's status line.
 */
export function drawPersonNetwork(host, net, { onSelect, onPoint, height: given, centre = null }) {
  const width = Math.max(320, host.clientWidth);
  const height = Math.max(320, given || host.clientHeight || 600);
  const pos = layout(net, width, height);
  const max = Math.max(1, ...net.nodes.map((n) => n.n));
  const r = (n) => 4 + 12 * Math.sqrt(n.n / max);
  const svg = s("svg", { width, height, viewBox: `0 0 ${width} ${height}`, class: "vis-svg po-svg" });
  const edges = s("g", { class: "po-edges", "aria-hidden": "true" });
  const lines = net.links.map((l) => {
    const line = s("line", { x1: pos[l.a].x.toFixed(1), y1: pos[l.a].y.toFixed(1), x2: pos[l.b].x.toFixed(1), y2: pos[l.b].y.toFixed(1), "stroke-width": Math.min(6, 0.8 + l.w * 0.6).toFixed(1), class: "po-edge" });
    edges.append(line);
    return { l, line };
  });
  svg.append(edges);
  const nodesG = s("g", { class: "po-nodes" });
  // Labels for every person, placed beside the circle where no other label stands; a name
  // without room appears on pointing.
  const boxes = net.nodes.map((n, i) => ({ x0: pos[i].x - r(n), x1: pos[i].x + r(n), y0: pos[i].y - r(n), y1: pos[i].y + r(n) }));
  const order = net.nodes.map((n, i) => i).sort((a, b) => net.nodes[b].n - net.nodes[a].n);
  const label = new Map();
  for (const i of order) {
    const n = net.nodes[i];
    const w = n.label.length * 7;
    for (const [dx, anchor] of [[r(n) + 4, "start"], [-r(n) - 4, "end"]]) {
      const bx = anchor === "start" ? pos[i].x + dx : pos[i].x + dx - w;
      const box = { x0: bx, x1: bx + w, y0: pos[i].y - 8, y1: pos[i].y + 6 };
      if (box.x0 < 2 || box.x1 > width - 2 || boxes.some((o) => o.x0 < box.x1 && box.x0 < o.x1 && o.y0 < box.y1 && box.y0 < o.y1)) continue;
      boxes.push(box);
      label.set(i, { x: pos[i].x + dx, anchor });
      break;
    }
  }
  const nodeEls = net.nodes.map((n, i) => {
    const a = s("a", { href: `#/personen/${encodeURIComponent(n.id)}`, class: "node po-node", "aria-label": t("po.nodeAria", { label: n.label, n: n.n }) });
    // A group is a square, as in the circle of a person, so the key means the same in both.
    const rr = r(n);
    a.append(n.group ? s("rect", { x: (pos[i].x - rr * 0.9).toFixed(1), y: (pos[i].y - rr * 0.9).toFixed(1), width: (rr * 1.8).toFixed(1), height: (rr * 1.8).toFixed(1), class: `po-dot st-${n.stand ?? "open"}` }) : s("circle", { cx: pos[i].x.toFixed(1), cy: pos[i].y.toFixed(1), r: rr.toFixed(1), class: `po-dot st-${n.stand ?? "open"}` }));
    const spot = label.get(i);
    a.append(
      s("text", {
        x: (spot ? spot.x : pos[i].x + r(n) + 4).toFixed(1),
        y: (pos[i].y + 4).toFixed(1),
        "text-anchor": spot ? spot.anchor : "start",
        class: spot ? "n-label" : "n-label on-demand",
        text: n.label,
      }),
    );
    const near = new Set([i, ...net.links.filter((l) => l.a === i || l.b === i).flatMap((l) => [l.a, l.b])]);
    const lightUp = (on) => {
      for (const [j, el] of nodeEls.entries()) el.classList.toggle("is-dim", on && !near.has(j));
      for (const { l, line } of lines) line.classList.toggle("is-on", on && (l.a === i || l.b === i));
      onPoint(on ? n.label : null);
    };
    a.addEventListener("mouseenter", () => lightUp(true));
    a.addEventListener("mouseleave", () => lightUp(false));
    a.addEventListener("focus", () => lightUp(true));
    a.addEventListener("blur", () => lightUp(false));
    a.addEventListener("click", (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey) return;
      event.preventDefault();
      onSelect(n.id);
    });
    nodesG.append(a);
    return a;
  });
  svg.append(nodesG);
  // The person left out because they take part in nearly every statement: a greyed node in
  // the free corner with the number of their regesta, leading to their circle.
  if (centre) {
    const cx = 18;
    const cy = 18;
    const a = s("a", { href: `#/personen/${encodeURIComponent(centre.id)}`, class: "node po-node po-centre", "aria-label": t("po.centreAria", { label: centre.label, n: centre.count }) });
    a.append(s("title", { text: t("po.centreTitle") }));
    a.append(s("circle", { cx, cy, r: 10, class: "po-dot po-centre-dot" }));
    a.append(s("text", { x: cx + 16, y: cy + 4, class: "n-label", text: `${centre.label} (${centre.count})` }));
    a.addEventListener("click", (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey) return;
      event.preventDefault();
      onSelect(centre.id);
    });
    svg.append(a);
  }
  host.replaceChildren(svg);
}
