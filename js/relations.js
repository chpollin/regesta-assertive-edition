/**
 * Relation families with a fixed direction, shared by the person graph and the space view.
 *
 * The operator asked on 2026-11-11 that directions carry meaning. Every act type of both
 * runs (German labels from VOCAB_DE in the pilot and from the SKOS prefLabels in the factoid
 * run) belongs to one family, and every family has one fixed angle, so "up" means kinship
 * and marriage for every person. The grouping is a draft of the implementing agent for the
 * talk, not a historical classification. An unknown type falls into the last family and is
 * named there, so nothing disappears.
 */

/** @typedef {{key: string, short: string, label: string, angle: number, types: string[]}} Family */

/** Angles in degrees, clockwise from north, eight sectors of 45 degrees. */
export const FAMILIES = /** @type {Family[]} */ ([
  { key: "kin", short: "Familie", label: "Verwandtschaft und Ehe", angle: 0, types: ["Elternschaft", "Verwandtschaft", "Ehe", "Eheschließung", "Ehescheidung", "Eheauflösung"] },
  { key: "transfer", short: "Besitz", label: "Übertragung und Besitz", angle: 45, types: ["Übertragung", "Schenkung", "Rechtsverleihung", "Belehnung", "Verkauf", "Verpfändung", "Rechtsinhaberschaft", "Besitz", "Lehnsverhältnis"] },
  { key: "confirm", short: "Zusage", label: "Bestätigung und Zusicherung", angle: 90, types: ["Bestätigung", "Rechtsbestätigung", "Zusicherung"] },
  { key: "protect", short: "Schutz", label: "Schutz", angle: 135, types: ["Schutznahme", "Schutzverleihung"] },
  { key: "dispute", short: "Streit", label: "Streit und Urteil", angle: 180, types: ["Streit", "Streit oder Klage", "Urteil"] },
  { key: "contact", short: "Kontakt", label: "Bitte, Gesandtschaft, Verhandlung", angle: 225, types: ["Bitte", "Entsendung", "Schreiben", "Mitteilung", "Verhandlung"] },
  { key: "money", short: "Zahlung", label: "Zahlung und Pflicht", angle: 270, types: ["Zahlung", "Schuldenerlass", "Rückgabe", "Rückerstattung", "Verpflichtung"] },
  { key: "order", short: "Amt", label: "Amt und Bestimmung", angle: 315, types: ["Bestimmung", "Rechtssetzung", "Einsetzung", "Widerruf", "Amtsinhabe", "Handlung ohne Typ"] },
]);

const BY_TYPE = new Map(FAMILIES.flatMap((f) => f.types.map((t) => [t, f])));

/** Family of an act label; parent edges between persons count as kinship. */
export function familyOf(label) {
  return BY_TYPE.get(label) ?? FAMILIES[FAMILIES.length - 1];
}

/** Unit vector of a family's direction in screen coordinates (y grows downwards). */
export function directionOf(family) {
  const rad = (family.angle * Math.PI) / 180;
  return { x: Math.sin(rad), y: -Math.cos(rad) };
}

/**
 * One sign per family, after the operator's question of 2026-11-11 where icons could replace
 * text. Strokes on a 16 unit grid in the current colour, drawn as inline SVG so the same sign
 * serves the sidebar, the rim of the circle and the floor of the space view. The sign never
 * stands alone: the sidebar names the family beside it, the figures carry the name as title.
 */
const ICONS = {
  kin: "M5.5 4.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7M10.5 4.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7",
  transfer: "M2 8h11M9.5 4.5L13 8l-3.5 3.5",
  confirm: "M3 8.5l3.2 3.2L13 4.5",
  protect: "M8 2l5 2v4c0 3-2.2 5-5 6c-2.8-1-5-3-5-6V4z",
  dispute: "M3.5 3.5l9 9M12.5 3.5l-9 9",
  contact: "M2 4.5h12v7H2zM2 4.5l6 4.5l6-4.5",
  money: "M8 2.5a5.5 5.5 0 1 0 0 11a5.5 5.5 0 1 0 0-11M8 5v6",
  order: "M2.5 12.5h11M2.5 12.5l1-7l3 3l1.5-4.5l1.5 4.5l3-3l1 7",
};

/**
 * The family's sign as an `<svg>` element; inside an SVG figure it is placed with x, y and size.
 * @param {Family} family
 * @param {{size?: number, x?: number, y?: number, title?: boolean, cls?: string}} [options]
 */
export function familyIcon(family, { size = 16, x, y, title = false, cls = "fam-icon" } = {}) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  const attrs = { viewBox: "0 0 16 16", width: size, height: size, class: cls, "data-family": family.key, fill: "none", stroke: "currentColor", "stroke-width": 1.5, "stroke-linecap": "round", "stroke-linejoin": "round" };
  if (x !== undefined) attrs.x = x;
  if (y !== undefined) attrs.y = y;
  if (!title) attrs["aria-hidden"] = "true";
  for (const [k, v] of Object.entries(attrs)) svg.setAttribute(k, String(v));
  if (title) {
    const t = document.createElementNS(ns, "title");
    t.textContent = family.label;
    svg.append(t);
  }
  // A transparent square catches the pointer over the whole sign, not only its strokes.
  const hit = document.createElementNS(ns, "rect");
  for (const [k, v] of Object.entries({ width: 16, height: 16, fill: "transparent", stroke: "none" })) hit.setAttribute(k, String(v));
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", ICONS[family.key] ?? ICONS.order);
  svg.append(hit, path);
  return svg;
}
