/**
 * SVG helper and the year rule shared by every drawing of the interface.
 */

export const SVG = "http://www.w3.org/2000/svg";

/**
 * Create an SVG element. Attributes with null, undefined or false are left out, `text` sets
 * the text content, `on…` adds a listener; children are appended in order.
 * @param {string} tag
 * @param {Record<string, any>} [attrs]
 * @param {...any} children
 * @returns {SVGElement}
 */
export function s(tag, attrs = {}, ...children) {
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

/** Fractional year of an ISO date, the same rule everywhere in the interface. */
export function yearOf(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return y + ((m - 1) * 30.4 + (d - 1)) / 365;
}
