/**
 * Small DOM helpers. All text goes through textContent, so data never becomes markup.
 */

/**
 * Create an element.
 * @param {string} tag
 * @param {Record<string, any>} [attrs]
 * @param {...(Node|string|null|undefined|false)} children
 * @returns {HTMLElement}
 */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") el.className = value;
    else if (key === "text") el.textContent = value;
    else if (key === "dataset") Object.assign(el.dataset, value);
    else if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? "" : String(value));
  }
  append(el, children);
  return el;
}

/**
 * @param {HTMLElement} el
 * @param {Array<any>} children
 */
export function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
}

/** Route to a regest, optionally to one statement. */
export function regestHref(uid, claim) {
  return claim ? `#/regest/${uid}/${claim}` : `#/regest/${uid}`;
}

/**
 * Render markup segments prepared by the pipeline (commentary, transmission, links).
 * @param {Array<{t:string,i?:boolean,sup?:boolean,regest?:string,href?:string}>} segments
 * @param {Set<string>} knownRegests
 */
export function renderSegments(segments, knownRegests) {
  return segments.map((seg) => {
    let node;
    if (seg.regest && knownRegests.has(seg.regest)) node = h("a", { href: regestHref(seg.regest), text: seg.t });
    else if (seg.href && /^https?:\/\//.test(seg.href)) node = h("a", { href: seg.href, rel: "noopener", text: seg.t });
    else node = document.createTextNode(seg.t);
    if (seg.i) node = h("i", {}, node);
    if (seg.sup) node = h("sup", {}, node);
    return node;
  });
}

/**
 * A short source field such as dating or place; a missing value is said in interface words.
 * @param {Array<any>} segments
 * @param {string} missing
 */
export function sourceField(segments, missing) {
  if (!segments.length) return h("span", { class: "missing", text: missing });
  return h("span", { class: "source" }, renderSegments(segments, new Set()));
}
