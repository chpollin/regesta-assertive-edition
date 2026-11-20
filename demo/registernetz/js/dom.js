// Node builders. Every data value enters the DOM as a text node, never as markup, since the
// record files are untrusted text at this boundary.

const SVG_NS = "http://www.w3.org/2000/svg";

function fill(el, attrs, children) {
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "on") for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
    else if (k === "text") el.textContent = String(v);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children.flat()) {
    if (c === undefined || c === null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const h = (tag, attrs, ...children) => fill(document.createElement(tag), attrs, children);
export const s = (tag, attrs, ...children) => fill(document.createElementNS(SVG_NS, tag), attrs, children);

export const entryHref = (id, regestUid) =>
  `#/eintrag/${encodeURIComponent(id)}${regestUid ? `?regest=${encodeURIComponent(regestUid)}` : ""}`;
