/**
 * The key of node shapes and line kinds for the network and the space view, missing until
 * the reviewer's report of 2026-11-14 (knowledge/design.md). One quiet line at the lower edge
 * of the drawing, listing only the signs the current drawing contains, so it never explains
 * a sign the reader cannot see. The signs are drawn with the classes of the figures
 * themselves, so a change of colour in css/app.css reaches the key as well.
 */
import { h } from "./dom.js";
import { STANDS, standOf } from "./stand.js";

const SVG = "http://www.w3.org/2000/svg";

function sign(...shapes) {
  const svg = document.createElementNS(SVG, "svg");
  svg.setAttribute("viewBox", "0 0 18 12");
  svg.setAttribute("class", "key-sign");
  svg.setAttribute("aria-hidden", "true");
  for (const [tag, attrs] of shapes) {
    const el = document.createElementNS(SVG, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    svg.append(el);
  }
  return svg;
}

const ENTRIES = {
  person: ["Person", () => sign(["circle", { cx: 9, cy: 6, r: 4.5, class: "n-person" }])],
  local: ["nur im Wortlaut des Regests", () => sign(["circle", { cx: 9, cy: 6, r: 4, class: "n-person n-local" }])],
  group: ["Gruppe", () => sign(["rect", { x: 4.5, y: 1.5, width: 9, height: 9, class: "n-group" }])],
  act: ["Aussage", () => sign(["path", { d: "M9,1.5 L13.5,6 L9,10.5 L4.5,6 Z", class: "n-act" }])],
  role: ["beteiligt", () => sign(["line", { x1: 1, y1: 6, x2: 17, y2: 6, class: "e-role" }])],
  parent: ["Eltern und Kind", () => sign(["line", { x1: 1, y1: 6, x2: 17, y2: 6, class: "e-parent" }])],
  same: ["gleicher Name, offene Frage", () => sign(["line", { x1: 1, y1: 6, x2: 17, y2: 6, class: "e-same" }])],
  years: ["ein Zeichen je Jahr", () => sign(["line", { x1: 9, y1: 1, x2: 9, y2: 11, class: "sp-column" }], ["circle", { cx: 9, cy: 2.5, r: 2.2, class: "n-person" }], ["circle", { cx: 9, cy: 9.5, r: 2.2, class: "n-person" }])],
  shared: ["Linie: gemeinsame Aussagen", () => sign(["line", { x1: 1, y1: 6, x2: 17, y2: 6, class: "po-edge", "stroke-width": 2 }])],
  bundle: ["Aussagen einer Richtung, gebündelt", () => sign(["circle", { cx: 9, cy: 6, r: 4.5, class: "n-bundle" }])],
  ...Object.fromEntries(STANDS.map((st) => [st.key, [st.label, () => sign(["circle", { cx: 9, cy: 6, r: 4.5, class: `n-person st-${st.key}` }])]])),
  size: ["Größe: Zahl der Aussagen", () => sign(["circle", { cx: 4, cy: 6, r: 2.5, class: "n-person" }], ["circle", { cx: 12.5, cy: 6, r: 5, class: "n-person" }])],
};

/** @param {string[]} keys  entries in ENTRIES, in the order wanted */
export function shapeKey(keys) {
  const items = keys.filter((k) => ENTRIES[k]);
  return h(
    "ul",
    { class: "shape-key", role: "list", "aria-label": "Zeichen der Zeichnung", hidden: items.length === 0 },
    items.map((k) => h("li", {}, ENTRIES[k][1](), ENTRIES[k][0])),
  );
}

/** The height the key takes from the drawing, so no sign at the lower edge lies under it. */
export function keyRoom(key) {
  return !key || key.hidden ? 0 : Math.ceil(key.offsetHeight) + 8;
}

/** The estates present among the persons and groups of a drawing, in the fixed order. */
export function standKeys(store, nodes) {
  const present = new Set(nodes.filter((n) => n && n.kind !== "act" && n.kind !== "bundle").map((n) => standOf(store, n)));
  return STANDS.map((st) => st.key).filter((k) => present.has(k));
}

/** Keys for a set of nodes and edges as both views hold them. */
export function keysOf(nodes, edges) {
  const has = (f) => nodes.some(f);
  return [
    has((n) => n.kind !== "act" && n.kind !== "group" && n.kind !== "bundle" && !n.local) && "person",
    has((n) => n.kind !== "act" && n.kind !== "group" && n.local) && "local",
    has((n) => n.kind === "group") && "group",
    has((n) => n.kind === "act") && "act",
    edges.some((e) => e.kind === "role") && "role",
    edges.some((e) => e.kind === "parent") && "parent",
    edges.some((e) => e.kind === "same-name") && "same",
  ].filter(Boolean);
}
