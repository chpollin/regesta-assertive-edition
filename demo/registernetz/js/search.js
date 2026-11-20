// The search in the page header: a combobox over the precomputed search fields of index.json,
// loaded on first use. Substring match on the folded query; entries whose short label starts
// with the query first, then by number of register rows.

import { h, entryHref } from "./dom.js";
import { loadIndex } from "./data.js";
import { fold } from "./model.js";
import { KIND, dayCount } from "./text.js";

const LIMIT = 12;

export function mountSearch(form) {
  const input = form.querySelector("input");
  const list = form.querySelector("[role=listbox]");
  const status = form.querySelector(".search-status");
  let entries = null;
  let failed = false;
  let results = [];
  let active = -1;

  const close = () => {
    list.hidden = true;
    status.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    active = -1;
  };

  const say = (sentence) => {
    list.hidden = true;
    list.replaceChildren();
    status.hidden = false;
    status.textContent = sentence;
    input.setAttribute("aria-expanded", "false");
  };

  const ensureIndex = () => {
    if (entries || failed) return Promise.resolve();
    return loadIndex().then(
      (d) => { entries = d.entries; },
      () => { failed = true; },
    );
  };

  const go = (entry) => {
    close();
    input.value = "";
    location.hash = entryHref(entry.id);
  };

  const mark = (i) => {
    active = i;
    [...list.children].forEach((li, j) => li.setAttribute("aria-selected", String(j === i)));
    if (i >= 0) {
      input.setAttribute("aria-activedescendant", list.children[i].id);
      list.children[i].scrollIntoView({ block: "nearest" });
    } else input.removeAttribute("aria-activedescendant");
  };

  const render = () => {
    const q = fold(input.value);
    if (!q) return close();
    if (failed) return say("Die Suche ist nicht verfügbar, weil das Verzeichnis der Einträge nicht geladen werden konnte.");
    if (!entries) return say("Das Verzeichnis der Einträge wird geladen.");
    const hits = [];
    for (const e of entries) if (e.search.includes(q)) hits.push(e);
    const starts = (e) => (fold(e.shortLabel).startsWith(q) ? 0 : 1);
    hits.sort((a, b) => starts(a) - starts(b) || b.rows - a.rows || a.shortLabel.localeCompare(b.shortLabel, "de"));
    results = hits.slice(0, LIMIT);
    if (!results.length) return say(`Kein Eintrag des Registers enthält „${input.value.trim()}“.`);
    status.hidden = true;
    list.replaceChildren(...results.map((e, i) =>
      h("li", { id: `treffer-${i}`, role: "option", "aria-selected": "false",
        on: { mousedown: (ev) => { ev.preventDefault(); go(e); } } },
        h("span", { class: "hit-name" }, e.shortLabel),
        h("span", { class: "hit-meta" }, e.rows ? `${KIND[e.class] || KIND.unclassified}, ${dayCount(e.rows)}` : "Stichwort ohne eigene Zeile"))));
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    mark(-1);
  };

  input.addEventListener("focus", () => { ensureIndex().then(render); });
  input.addEventListener("input", () => { ensureIndex().then(render); });
  input.addEventListener("blur", () => setTimeout(close, 120));
  input.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") { close(); return; }
    if (list.hidden) return;
    if (ev.key === "ArrowDown") { ev.preventDefault(); mark(Math.min(active + 1, results.length - 1)); }
    else if (ev.key === "ArrowUp") { ev.preventDefault(); mark(Math.max(active - 1, 0)); }
  });
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    if (list.hidden || !results.length) return;
    go(results[Math.max(active, 0)]);
  });
}
