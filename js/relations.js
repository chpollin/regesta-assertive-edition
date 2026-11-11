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
  { key: "confirm", short: "Bestätigung", label: "Bestätigung und Zusicherung", angle: 90, types: ["Bestätigung", "Rechtsbestätigung", "Zusicherung"] },
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
