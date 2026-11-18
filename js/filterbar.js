/**
 * The parts every view of the edition shares (knowledge/interface-plan.md, One filter model):
 * the left filter bar with its facets in the plan's order, the count line with the reset, the
 * result list, the filter sheet of narrow screens and the opened regest beside the main
 * element. Atlas (js/atlas.js), Regesten (js/regesten.js) and Personen (js/persons.js) build
 * their frame from them, so a facet looks and works the same everywhere.
 *
 * A facet a view cannot evaluate stays in place, greyed, with a tooltip saying where it applies
 * (`applies[facet]` is true or that tooltip). The text search is a facet of the list only; the
 * other views show it greyed while the address carries it (the Atlas slice of 2026-11-18).
 */
import { h } from "./dom.js";
import { FAMILIES, familyIcon } from "./relations.js";
import { fold } from "./selection.js";

/** Rows of a result list shown at once; further rows follow on scrolling or on the button. */
export const LIST_STEP = 100;

/**
 * After a rebuild of a part, find the control that had the focus again by its name or text.
 * @param {HTMLElement} root
 */
export function focusKey(root) {
  const el = document.activeElement;
  if (!el || !root.contains(el)) return () => {};
  const key = (e) => `${e.tagName}|${e.getAttribute("aria-label") ?? e.textContent}`;
  const wanted = key(el);
  return () => [...root.querySelectorAll("select, button, input, summary")].find((e) => key(e) === wanted)?.focus();
}

/** The remove sign of a chip: a circle with a bar, not the cross, which is the sign of Streit. */
function removeSign() {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  for (const [k, v] of Object.entries({ viewBox: "0 0 16 16", class: "chip-x-sign", "aria-hidden": "true" })) svg.setAttribute(k, v);
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", "M8 2.5a5.5 5.5 0 1 0 0 11a5.5 5.5 0 1 0 0-11M5.2 8h5.6");
  svg.append(path);
  return svg;
}

/**
 * The time filter shared by every view: regesta per year of the whole delivery as a quiet
 * ground, the years of the selection as accent marks on it, and two handles for the range.
 * @param {Set<number>|number[]} markYears
 * @param {{ends?: boolean}} [options]  ends false: the first and last year stand only while the
 *   range is narrowed, so at rest no year is said twice (figure check, each number once)
 */
export function timeBand(store, filters, markYears, { ends = true } = {}) {
  const { lo, hi } = filters;
  const W = 320;
  const H = 34;
  const x = (y) => ((y - lo) / Math.max(1, hi - lo)) * W;
  const years = store.edition.delivery.years.filter(([y]) => y >= lo && y <= hi);
  const max = Math.max(1, ...years.map(([, c]) => c));
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("class", "band-svg");
  svg.setAttribute("aria-hidden", "true");
  const bw = W / Math.max(1, hi - lo + 1);
  const rect = (attrs) => {
    const r = document.createElementNS(ns, "rect");
    for (const [k, v] of Object.entries(attrs)) r.setAttribute(k, String(v));
    svg.append(r);
  };
  for (const [y, c] of years) {
    const bh = (c / max) * (H - 8);
    rect({ x: x(y), y: H - bh, width: Math.max(1, bw - 0.5), height: bh, class: y >= filters.from && y <= filters.to ? "band-bar is-in" : "band-bar" });
  }
  for (const y of markYears) rect({ x: x(y), y: 0, width: Math.max(2, bw), height: 5, class: "band-mark" });
  const label = h("span", { class: "band-label", text: `${filters.from} bis ${filters.to}` });
  const range = (which) =>
    h("input", {
      type: "range",
      class: `band-range band-${which}`,
      min: String(lo),
      max: String(hi),
      step: "1",
      value: String(which === "from" ? filters.from : filters.to),
      "aria-label": which === "from" ? "Zeitraum ab" : "Zeitraum bis",
      onchange: (e) => filters.set({ [which]: Number(e.target.value) }),
      oninput: (e) => {
        label.textContent = which === "from" ? `${e.target.value} bis ${filters.to}` : `${filters.from} bis ${e.target.value}`;
      },
    });
  const showEnds = ends || filters.from !== lo || filters.to !== hi;
  return h(
    "div",
    { class: "band", role: "group", "aria-label": "Zeitraum" },
    h("div", { class: "band-track" }, svg, range("from"), range("to")),
    h("div", { class: `band-scale${showEnds ? "" : " is-rest"}` }, showEnds ? h("span", { text: String(lo) }) : null, label, showEnds ? h("span", { text: String(hi) }) : null),
  );
}

/**
 * The facets of the filter bar: Zeitraum, Ort, Person, Art, Schicht and, in the list or when
 * the address carries it, Text.
 * @param {any} store
 * @param {any} filters
 * @param {{prefix: string, applies?: Record<string, true|string>, persons: Array<[string, string, number]>, layer?: string, marks?: () => Set<number>, onSearch?: () => void}} opts
 */
export function createFacets(store, filters, opts) {
  const { prefix } = opts;
  const applies = { time: true, place: true, person: true, art: true, layer: true, text: true, ...opts.applies };
  const off = (facet) => (applies[facet] === true ? null : applies[facet]);
  const places = store.holdings.places;
  const persons = store.holdings.persons ?? {};
  const bandSlot = h("div", { class: "facet-band" });
  const placeLabels = new Map();
  const placeList = h(
    "datalist",
    { id: `${prefix}-places` },
    Object.entries(places)
      .sort((a, b) => b[1].n - a[1].n)
      .map(([id, p]) => {
        const text = `${p.l} (${p.n})`;
        placeLabels.set(text, id);
        return h("option", { value: text });
      }),
  );
  const personLabels = new Map();
  const personList = h(
    "datalist",
    { id: `${prefix}-persons` },
    opts.persons.map(([id, label, n]) => {
      const text = `${label} (${n})`;
      personLabels.set(text, id);
      return h("option", { value: text });
    }),
  );
  /** A typed name to an id: an option chosen, the exact name, else the first name it begins. */
  function resolve(value, labels, nameOf) {
    if (labels.has(value)) return labels.get(value);
    const want = fold(value).trim();
    if (!want) return null;
    const ids = [...labels.values()];
    return ids.find((id) => fold(nameOf(id)).trim() === want) ?? ids.find((id) => fold(nameOf(id)).trim().startsWith(want)) ?? null;
  }
  // The field says what it searches; a word above it would repeat its placeholder.
  const searchField = (id, list, label, onPick, disabled) => {
    const input = h("input", { type: "search", class: "facet-input", id, list, autocomplete: "off", placeholder: label, "aria-label": label, disabled: disabled ? true : null });
    const pick = () => {
      if (onPick(input.value)) input.value = "";
    };
    input.addEventListener("change", pick);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        pick();
      }
    });
    return input;
  };
  const placeInput = searchField(
    `${prefix}-ort`,
    `${prefix}-places`,
    "Ort suchen",
    (value) => {
      const id = resolve(value, placeLabels, (x) => places[x].l);
      if (id) filters.set({ place: id });
      return id;
    },
    off("place"),
  );
  const personInput = searchField(
    `${prefix}-person`,
    `${prefix}-persons`,
    "Person suchen",
    (value) => {
      const id = resolve(value, personLabels, (x) => persons[x].l);
      if (id && !filters.persons.includes(id)) filters.set({ persons: [...filters.persons, id] });
      return id;
    },
    off("person"),
  );
  const placeChip = h("div", { class: "chips" });
  const personChips = h("div", { class: "chips" });
  const chip = (text, title, key, onRemove) =>
    h(
      "span",
      { class: "chip", title },
      key ? h("span", { class: `it-pkey ${key}`, "aria-hidden": "true" }) : null,
      h("span", { class: "chip-name", text }),
      h("button", { type: "button", class: "chip-x", "aria-label": `${text} entfernen`, title: "Entfernen", onclick: onRemove }, removeSign()),
    );
  const artButtons = FAMILIES.map((f) =>
    h(
      "button",
      {
        type: "button",
        class: "art-chip",
        "aria-pressed": "false",
        title: f.label,
        "data-family": f.key,
        "aria-disabled": off("art") ? "true" : null,
        onclick: () => {
          if (off("art")) return;
          const pressed = new Set(filters.familiesSet() ? filters.families : []);
          if (pressed.has(f.key)) pressed.delete(f.key);
          else pressed.add(f.key);
          filters.set({ families: [...pressed] });
        },
      },
      familyIcon(f, { size: 14 }),
      h("span", { text: f.short }),
    ),
  );
  const layerButtons = [
    ["alle", "Alle Regesten", "it-key"],
    ["aussagen", "mit Aussagen", "it-key is-evidenced"],
  ].map(([key, text, sign]) =>
    h(
      "button",
      { type: "button", class: "layer-chip", "aria-pressed": "false", "data-layer": key, "aria-disabled": off("layer") ? "true" : null, onclick: () => !off("layer") && filters.set({ layer: key }) },
      h("span", { class: sign, "aria-hidden": "true" }),
      text,
    ),
  );
  // The text search: live in the list, greyed elsewhere while the address carries it.
  const textInput = h("input", { type: "search", class: "facet-input", id: `${prefix}-q`, autocomplete: "off", placeholder: "Regesttext oder Nummer", "aria-label": "Regesttext oder Nummer", value: filters.q });
  if (off("text")) {
    textInput.readOnly = true;
    textInput.setAttribute("aria-disabled", "true");
  } else {
    let timer = 0;
    textInput.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => filters.set({ q: textInput.value }), 180);
    });
    textInput.addEventListener("focus", () => opts.onSearch?.(), { once: true });
  }
  const textFacet = h("div", { class: `facet${off("text") ? " is-off" : ""}`, title: off("text") }, textInput);
  const facet = (name, attrs, ...children) => h("div", { class: `facet${off(name) ? " is-off" : ""}`, title: off(name), ...attrs }, ...children);
  const element = h(
    "div",
    { class: "fb-facets" },
    // The list puts its own search first, since a reader of a list starts with a word.
    applies.text === true ? textFacet : null,
    // Band and chips say what they filter („1122 bis 1190“, „Alle Regesten“); only the kinds
    // of statement need their word, Art (subtractive pass of the Atlas slice).
    facet("time", { role: "group", "aria-label": "Zeitraum" }, bandSlot),
    facet("place", {}, placeInput, placeList, placeChip),
    facet("person", {}, personInput, personList, personChips),
    facet("art", { role: "group", "aria-labelledby": `${prefix}-f-art` }, h("span", { class: "facet-label", id: `${prefix}-f-art`, text: "Art" }), h("div", { class: "art-chips" }, artButtons)),
    facet("layer", { role: "group", "aria-label": "Schicht" }, h("div", { class: "layer-chips" }, layerButtons)),
  );
  const textSlot = applies.text === true ? null : textFacet;
  if (textSlot) element.append(textSlot);

  function update() {
    const restore = focusKey(bandSlot);
    bandSlot.replaceChildren(timeBand(store, filters, opts.marks?.() ?? new Set(), { ends: false }));
    restore();
    placeChip.replaceChildren(filters.place && places[filters.place] ? chip(places[filters.place].l, `Ausstellungsort ${places[filters.place].l}`, null, () => filters.set({ place: null })) : "");
    personChips.replaceChildren(...filters.persons.filter((id) => persons[id]).map((id, j) => chip(persons[id].l, persons[id].f, `is-p${j}`, () => filters.set({ persons: filters.persons.filter((x) => x !== id) }))));
    personInput.hidden = filters.persons.length >= 2;
    personInput.placeholder = filters.persons.length ? "Zweite Person" : "Person suchen";
    personInput.setAttribute("aria-label", personInput.placeholder);
    for (const b of artButtons) b.setAttribute("aria-pressed", String(filters.familiesSet() && filters.familyOn(b.dataset.family)));
    const layer = opts.layer ?? filters.layer;
    for (const b of layerButtons) b.setAttribute("aria-pressed", String(b.dataset.layer === layer));
    if (document.activeElement !== textInput) textInput.value = filters.q;
    if (textSlot) textSlot.hidden = !filters.q;
  }
  return { element, update };
}

/** The number of facets that deviate from rest, for the button of the filter sheet. */
export function facetsSet(filters) {
  return (filters.timeActive() ? 1 : 0) + (filters.place ? 1 : 0) + filters.persons.length + (filters.familiesSet() ? 1 : 0) + (filters.layer !== "alle" ? 1 : 0) + (filters.q ? 1 : 0);
}

/**
 * The count line „x von y Regesten“ with the reset that clears every facet; at rest the total
 * alone, so each number stands once.
 */
export function createCount(filters, { onReset } = {}) {
  const element = h("p", { class: "fb-count", role: "status" });
  function update(n, total) {
    element.replaceChildren(h("b", { text: String(n) }), n === total ? " Regesten" : ` von ${total} Regesten`);
    if (filters.any())
      element.append(
        h(
          "button",
          {
            type: "button",
            class: "link-button fb-reset",
            onclick: () => {
              onReset?.();
              filters.reset();
            },
          },
          "Zurücksetzen",
        ),
      );
  }
  return { element, update };
}

/**
 * The result list: one row per regest with year, number and place in every row (operator's
 * decision of 2026-11-18), the layer's or the person's mark at the end. It renders LIST_STEP
 * rows and adds the next ones when its end scrolls into view or the button is pressed, so the
 * whole delivery stays fast.
 * @param {{label: string, onOpen: (u: string) => void, onPoint?: (u: string|null) => void, mark?: (row: any) => string, extra?: (row: any) => Node|null}} opts
 */
export function createList(opts) {
  const element = h("ul", { class: "fb-list", role: "list", "aria-label": opts.label });
  let rows = [];
  let shown = LIST_STEP;
  let opened = null;
  const more = h(
    "button",
    {
      type: "button",
      class: "link-button fb-more",
      onclick: () => {
        const restoreTo = element.querySelectorAll(".fb-row").length;
        grow();
        element.querySelectorAll(".fb-row")[restoreTo]?.focus();
      },
    },
    "",
  );
  const moreItem = h("li", { class: "fb-more-item" }, more);
  const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && grow(), { rootMargin: "200px" });
  observer.observe(moreItem);
  const rowOf = (r) => {
    const mark = opts.mark?.(r) ?? "";
    const point = (u) => !opened && opts.onPoint?.(u);
    return h(
      "li",
      {},
      h(
        "button",
        {
          type: "button",
          class: "fb-row",
          "data-uid": r.u,
          "aria-current": r.u === opened ? "true" : null,
          onclick: () => opts.onOpen(r.u),
          onmouseenter: () => point(r.u),
          onmouseleave: () => point(null),
          onfocus: () => point(r.u),
          onblur: () => point(null),
        },
        h("span", { class: "row-year", text: String(r.year) }),
        h("span", { class: "row-id", text: r.i }),
        h("span", { class: `row-place${r.place ? "" : " is-none"}`, text: r.place || "ohne Ort" }),
        opts.extra?.(r) ?? null,
        mark ? h("span", { class: mark.startsWith("is-p") ? `it-pkey ${mark}` : `it-key ${mark}`, title: mark === "is-evidenced" ? "mit Aussagen" : "Person", "aria-label": mark === "is-evidenced" ? "mit Aussagen" : null }) : null,
      ),
    );
  };
  function paint(from) {
    const items = rows.slice(from, shown).map(rowOf);
    moreItem.remove();
    element.append(...items);
    if (rows.length > shown) {
      more.textContent = `${Math.min(LIST_STEP, rows.length - shown)} weitere`;
      element.append(moreItem);
    }
  }
  function grow() {
    if (rows.length <= shown) return;
    const from = shown;
    shown += LIST_STEP;
    paint(from);
  }
  return {
    element,
    /** New rows: the list starts again at its top. */
    update(next) {
      const restore = focusKey(element);
      rows = next;
      shown = LIST_STEP;
      element.replaceChildren();
      if (!rows.length) element.append(h("li", { class: "fb-empty", text: "Keine Regesten in dieser Auswahl. Ein Facettenchip oder Zurücksetzen erweitert sie." }));
      paint(0);
      restore();
    },
    setOpened(u) {
      opened = u;
      for (const row of element.querySelectorAll("[data-uid]")) row.toggleAttribute("aria-current", row.dataset.uid === u);
    },
    /** Focus the row of a regest, rendering further pages until it stands. */
    focusRow(u) {
      const i = rows.findIndex((r) => r.u === u);
      if (i < 0) return false;
      while (shown <= i) grow();
      const row = element.querySelector(`[data-uid="${CSS.escape(u)}"]`);
      row?.focus();
      return !!row;
    },
    dispose: () => observer.disconnect(),
  };
}

/**
 * The frame of a view: the bar (facets above, count line and list below), the stage with its
 * tool row and main element, the opened regest over the right edge of the stage (docked
 * beside it from 100rem, a route of its own with a back arrow below 56rem), and the filter
 * sheet of narrow screens.
 * @param {{name: string, title: string, facets: HTMLElement, count: HTMLElement, list?: HTMLElement|null, tools: HTMLElement[], main: HTMLElement, backLabel: string, onEscape: () => void}} opts
 */
export function createFrame(filters, opts) {
  const narrow = window.matchMedia("(max-width: 56rem)");
  const wide = window.matchMedia("(min-width: 100rem)");
  const filterButton = h("button", { type: "button", class: "tool fb-filter-open", "aria-haspopup": "dialog", onclick: () => openSheet() }, "Filter");
  const sheetDone = h("button", { type: "button", class: "tool", onclick: () => sheet.close() }, "Fertig");
  const sheetReset = h("button", { type: "button", class: "link-button", hidden: true, onclick: () => filters.reset() }, "Zurücksetzen");
  const sheetBody = h("div", { class: "fb-sheet-body" });
  const sheet = h("dialog", { class: "fb-sheet", "aria-label": "Filter" }, h("div", { class: "fb-sheet-head" }, h("span", { class: "facet-label", text: "Filter" }), sheetReset, sheetDone), sheetBody);
  const result = h("div", { class: "fb-result" }, opts.count, opts.list ?? null);
  const bar = h("aside", { class: "fb-bar", "aria-label": "Filter und Regesten der Auswahl" }, opts.facets, result);
  sheet.addEventListener("close", () => {
    bar.prepend(opts.facets);
    filterButton.focus();
  });
  function openSheet() {
    sheetBody.append(opts.facets);
    sheet.showModal();
  }
  const tools = h("div", { class: "frame-tools" }, ...opts.tools, h("span", { class: "frame-tools-end" }, filterButton, ...(opts.toolsEnd ?? [])));
  const back = h("button", { type: "button", class: "tool frame-back", "aria-label": opts.backLabel, onclick: () => opts.onEscape() }, `← ${opts.backLabel.replace(/^Zurück zu[rm]? /, "")}`);
  const detail = h("aside", { class: "frame-detail", "aria-label": "Geöffnetes Regest", hidden: true });
  detail.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      opts.onEscape();
    }
  });
  const stage = h("section", { class: "frame-stage", "aria-labelledby": `${opts.name}-title` }, tools, opts.main);
  // The view's heading comes first in reading order, before its filter bar.
  const root = h("div", { class: `frame frame-${opts.name}` }, h("h1", { id: `${opts.name}-title`, class: "visually-hidden", text: opts.title }), bar, stage, detail, sheet);
  const place = () => (root.dataset.dock = String(!narrow.matches && wide.matches));
  const onNarrow = () => {
    if (!narrow.matches && sheet.open) sheet.close();
    place();
  };
  narrow.addEventListener("change", onNarrow);
  wide.addEventListener("change", place);
  place();
  // The overlay starts below the tool row, whose height follows its wrapping.
  const toolsObserver = new ResizeObserver(() => root.style.setProperty("--frame-top", `${tools.offsetHeight}px`));
  toolsObserver.observe(tools);
  return {
    root,
    bar,
    stage,
    tools,
    detail,
    narrow,
    /** Facet count on the sheet button, the count of the selection on its close button. */
    updateSheet(n) {
      const set = facetsSet(filters);
      filterButton.textContent = set ? `Filter (${set})` : "Filter";
      sheetDone.textContent = `${n} Regesten zeigen`;
      sheetReset.hidden = !filters.any();
    },
    show(card) {
      detail.replaceChildren(back, card);
      detail.hidden = false;
      root.dataset.open = "true";
      if (narrow.matches) window.scrollTo(0, 0);
    },
    hide() {
      detail.hidden = true;
      detail.replaceChildren();
      delete root.dataset.open;
    },
    isOpen: () => !detail.hidden,
    dispose() {
      toolsObserver.disconnect();
      narrow.removeEventListener("change", onNarrow);
      wide.removeEventListener("change", place);
    },
  };
}

/**
 * Opening and closing the regest in the frame's detail: the card, the mark in the list, the
 * focus back where the reader came from, and, where the view names it in the hash, a history
 * entry, so the back button of the browser closes the regest.
 * @param {ReturnType<typeof createFrame>} frame
 * @param {{card: (u: string) => HTMLElement, hashOf?: (u: string|null) => string, readUid?: () => string|null, list?: ReturnType<typeof createList>|null, onOpen?: (u: string) => void, onShut?: () => void}} opts
 */
export function createDetail(frame, opts) {
  const state = { opened: null, pushed: false, returnTo: null };
  const write = (u, push) => {
    if (!opts.hashOf) return;
    const url = `${location.pathname}${location.search}${opts.hashOf(u)}`;
    if (push) history.pushState({ frameRegest: u }, "", url);
    else history.replaceState(u ? { frameRegest: u } : null, "", url);
  };
  function open(u, { push = true } = {}) {
    if (!u) return;
    const wasOpen = !!state.opened;
    if (!wasOpen) state.returnTo = document.activeElement instanceof HTMLElement && !frame.detail.contains(document.activeElement) ? document.activeElement : null;
    state.opened = u;
    opts.onOpen?.(u);
    const card = opts.card(u);
    card.setAttribute("tabindex", "-1");
    frame.show(card);
    // A further regest opened from an open one replaces the entry, so back leads to the view.
    write(u, push && !wasOpen);
    if (push && !wasOpen && opts.hashOf) state.pushed = true;
    opts.list?.setOpened(u);
    card.focus({ preventScroll: true });
  }
  function shut() {
    const was = state.opened;
    state.opened = null;
    state.pushed = false;
    frame.hide();
    opts.list?.setOpened(null);
    opts.onShut?.();
    const target = state.returnTo;
    state.returnTo = null;
    if (target?.isConnected) target.focus();
    else if (was && !opts.list?.focusRow(was)) frame.stage.querySelector("button, [tabindex='0']")?.focus();
  }
  /** Close: by the back button of the browser where opening added an entry. */
  function close() {
    if (!state.opened) return;
    if (state.pushed && history.state?.frameRegest === state.opened) {
      history.back();
      return;
    }
    shut();
    write(null, false);
  }
  const onPop = () => {
    const u = opts.readUid?.() ?? null;
    if (!u && state.opened) shut();
    else if (u && u !== state.opened) open(u, { push: false });
  };
  if (opts.readUid) window.addEventListener("popstate", onPop);
  return {
    open,
    close,
    opened: () => state.opened,
    dispose: () => window.removeEventListener("popstate", onPop),
  };
}
