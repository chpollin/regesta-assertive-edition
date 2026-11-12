/**
 * The one sidebar of the interactive views: selection and filters on top, the acts of the
 * selection below, grouped by relation family and unfolding down to the regest text with
 * the evidence marked.
 *
 * Asked for by the operator on 2026-11-11 („Kann man vielleicht irgendwie einheitlicher,
 * ein besser aufgebautes und filterbares Sidebar integrieren?“, all feedback verbatim in
 * knowledge/ui-feedback.md). The flat network and the space view build the same sidebar, so
 * a reader finds the same controls in the same place. The regest unfolds in place because
 * the operator prefers unfolding details to subpages; the regest link still opens the full,
 * citable reading view.
 */
import { h } from "./dom.js";
import { FAMILIES, familyIcon, familyOf } from "./relations.js";
import { yearOf } from "./filters.js";

/**
 * @param {{edition: any, byUid: Map<string, any>}} store
 * @param {ReturnType<import("./filters.js").createFilters>} filters
 * @param {{person: string|null, onPerson: (id: string|null) => void, onPoint: (id: string|null) => void}} options
 */
export function createSidebar(store, filters, options) {
  const graph = store.edition.graph;
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const persons = graph.nodes.filter((n) => n.kind !== "act").sort((a, b) => a.label.localeCompare(b.label, "de"));
  const registered = persons.filter((n) => !n.local);
  const local = persons.filter((n) => n.local);
  let person = options.person;
  const open = new Set();

  const element = h("div", { class: "sidebar" });

  /** The relations shown for the selection: a person's acts and kinship, or every act. */
  function relations() {
    const rows = [];
    if (person) {
      for (const e of graph.edges) {
        if (e.source !== person && e.target !== person) continue;
        const other = byId.get(e.source === person ? e.target : e.source);
        if (e.kind === "role") rows.push({ family: familyOf(other.label).key, act: other, edge: e, label: other.label, role: e.label, uid: e.regest });
        else if (e.kind === "parent") rows.push({ family: "kin", act: null, edge: e, label: e.source === person ? `Kind von ${other.label}` : `Elternteil von ${other.label}`, role: null, uid: e.regest });
      }
    } else {
      for (const n of graph.nodes) if (n.kind === "act") rows.push({ family: familyOf(n.label).key, act: n, edge: null, label: n.label, role: null, uid: n.regest });
    }
    return rows.filter((r) => r.uid && store.byUid.has(r.uid));
  }

  function render() {
    const all = relations();
    const inTime = all.filter((r) => filters.inRange(r.uid));
    const shown = inTime.filter((r) => filters.familyOn(r.family));
    element.replaceChildren(selectionPart(shown), familiesPart(inTime));
  }

  /** Person, time band, and the line saying what applies only when something deviates. */
  function selectionPart(shown) {
    const picker = h(
      "select",
      { class: "side-select", "aria-label": "Person", onchange: (e) => options.onPerson(e.target.value || null) },
      h("option", { value: "", text: "Ganzes Netz", selected: !person }),
      // Actors with a register entry first; actors the agents named only by the regest's
      // wording („den Fürsten“, „des Abtes“) follow in their own group, each with its regest,
      // since the same words stand for different people in different regesta.
      h("optgroup", { label: "Im Register" }, registered.map((p) => h("option", { value: p.id, text: p.label, selected: p.id === person }))),
      h("optgroup", { label: "Nur im Wortlaut des Regests" }, local.map((p) => h("option", { value: p.id, text: `${p.label}, ${store.byUid.get(p.regests?.[0])?.short ?? ""}`.replace(/, $/, ""), selected: p.id === person }))),
    );
    const regestCount = new Set(shown.map((r) => r.uid)).size;
    const time = filters.from === filters.to ? `nur ${filters.from}` : `${filters.from} bis ${filters.to}`;
    const fams = filters.families.size === FAMILIES.length ? "" : `, ${filters.families.size} von ${FAMILIES.length} Richtungen`;
    return h(
      "section",
      { class: "side-part side-selection", "aria-label": "Auswahl und Filter" },
      picker,
      timeBand(store, filters, new Set(relations().map((r) => Math.floor(yearOf(store.byUid.get(r.uid).start))))),
      filters.active()
        ? h("p", { class: "side-applies" }, `${time}${fams}, ${regestCount} ${regestCount === 1 ? "Regest" : "Regesten"}. `, h("button", { type: "button", class: "link-button", onclick: () => filters.reset() }, "Zurücksetzen"))
        : null,
    );
  }

  /**
   * The eight families, each one row: a switch in front (shown or hidden), the name, the
   * number of regesta in the time range; the row unfolds to its acts. The row is the filter,
   * so the families no longer appear twice.
   */
  function familiesPart(inTime) {
    return h(
      "ul",
      { class: "fam-rows", role: "list", "aria-label": "Richtungen der Beziehungen" },
      FAMILIES.map((f) => {
        const rows = inTime.filter((r) => r.family === f.key);
        const on = filters.familyOn(f.key);
        const uids = new Set(rows.map((r) => r.uid));
        const roles = rows.map((r) => r.role).filter(Boolean);
        const common = [...new Set(roles)].sort((a, b) => roles.filter((r) => r === b).length - roles.filter((r) => r === a).length)[0];
        rows.sort((a, b) => yearOf(store.byUid.get(a.uid).start) - yearOf(store.byUid.get(b.uid).start) || a.label.localeCompare(b.label, "de"));
        const toggle = h(
          "button",
          {
            type: "button",
            class: "fam-check",
            "aria-pressed": String(on),
            "aria-label": `${f.label} ${on ? "ausblenden" : "zeigen"}`,
            title: on ? "Ausblenden" : "Zeigen",
            disabled: uids.size === 0 ? true : null,
            onclick: () => {
              const next = new Set(filters.families);
              if (next.has(f.key)) next.delete(f.key);
              else next.add(f.key);
              filters.set({ families: [...next] });
            },
          },

        );
        const details = h(
          "details",
          { class: "fam-group", "data-family": f.key, open: on && open.has(f.key) && uids.size > 0 },
          h("summary", {}, familyIcon(f), h("span", { class: "fam-label", text: f.label }), h("span", { class: "fam-n", text: String(uids.size) })),
          on ? h("ul", { class: "act-rows", role: "list" }, rows.map((r) => actRow(r, common))) : null,
        );
        details.addEventListener("toggle", () => (details.open ? open.add(f.key) : open.delete(f.key)));
        return h("li", { class: `fam-row${uids.size ? "" : " is-empty"}${on ? "" : " is-off"}` }, toggle, details);
      }),
    );
  }

  /** One act: year, name, regest; a click opens the regest in the detail panel. */
  function actRow(r, common) {
    const regest = store.byUid.get(r.uid);
    const claim = r.edge?.claim ?? r.act?.claim ?? null;
    const pointId = r.act?.id ?? null;
    return h(
      "li",
      { class: "act-row" },
      h(
        "button",
        {
          type: "button",
          class: "act-open",
          onclick: () => options.onOpen?.(r.uid, claim, pointId),
          onmouseenter: () => options.onPoint(pointId),
          onmouseleave: () => options.onPoint(null),
          onfocus: () => options.onPoint(pointId),
          onblur: () => options.onPoint(null),
        },
        h("span", { class: "act-year", text: String(Math.floor(yearOf(regest.start))) }),
        h("span", { class: "act-name", text: r.role && r.role !== common ? `${r.label}, als ${r.role}` : r.label }),
        h("span", { class: "act-short", text: regest.short }),
      ),
    );
  }

  const unsubscribe = filters.onChange(render);
  render();

  return {
    element,
    /** Open one family group, for a click on its direction word in the drawing. */
    openFamily(key) {
      open.add(key);
      render();
      element.querySelector(`.fam-group[data-family="${key}"] > summary`)?.focus();
    },
    /** Another person selected inside the view. */
    setPerson(id) {
      person = id;
      render();
    },
    dispose: unsubscribe,
  };
}

/**
 * The time filter shared by every view: regesta per year of the whole delivery as a quiet
 * ground, the years of the selection as accent marks on it, and two handles for the range.
 * @param {Set<number>|number[]} markYears
 */
export function timeBand(store, filters, markYears) {
  const { lo, hi } = filters;
  const W = 320;
  const H = 34;
  const x = (y) => ((y - lo) / Math.max(1, hi - lo)) * W;
  const years = store.edition.delivery.years.filter(([y]) => y >= lo && y <= hi);
  const max = Math.max(1, ...years.map(([, c]) => c));
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("class", "band-svg");
  svg.setAttribute("aria-hidden", "true");
  const bw = W / Math.max(1, hi - lo + 1);
  for (const [y, c] of years) {
    const r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    const bh = (c / max) * (H - 8);
    const inside = y >= filters.from && y <= filters.to;
    r.setAttribute("x", String(x(y)));
    r.setAttribute("y", String(H - bh));
    r.setAttribute("width", String(Math.max(1, bw - 0.5)));
    r.setAttribute("height", String(bh));
    r.setAttribute("class", inside ? "band-bar is-in" : "band-bar");
    svg.append(r);
  }
  // The years of the selection's regesta as accent ticks along the top.
  for (const y of markYears) {
    const t = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    t.setAttribute("x", String(x(y)));
    t.setAttribute("y", "0");
    t.setAttribute("width", String(Math.max(2, bw)));
    t.setAttribute("height", "5");
    t.setAttribute("class", "band-mark");
    svg.append(t);
  }
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
  const label = h("span", { class: "band-label", text: `${filters.from} bis ${filters.to}` });
  return h(
    "div",
    { class: "band", role: "group", "aria-label": "Zeitraum" },
    h("div", { class: "band-track" }, svg, range("from"), range("to")),
    h("div", { class: "band-scale" }, h("span", { text: String(lo) }), label, h("span", { text: String(hi) })),
  );
}