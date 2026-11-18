/**
 * The shared filter state of the interactive views, after the filter model of
 * knowledge/interface-plan.md: Zeitraum, Ort, Person, Art and Schicht, all in the query string.
 *
 * The operator asked on 2026-11-11 for time as a filter instead of a second chart, and for
 * one filterable sidebar in every view (verbatim in knowledge/ui-feedback.md). Every view
 * reads the same state, so switching between them keeps the selection; a view that cannot
 * evaluate a facet leaves it in the address.
 *
 * Address: von, bis (years), ort (place id of the register), person (one or two register ids,
 * comma separated), art (relation families, OR; none means all), schicht (aussagen), q (the
 * text search of the list, which the other views show greyed). The
 * names before the plan are read once and rewritten, so earlier links keep working:
 * familien to art, personen to person.
 */
import { FAMILIES } from "./relations.js";
import { yearOf } from "./svg.js";
import { param, writeAddress } from "./url.js";

/** At most two persons at once, the second for comparison. */
const MAX_PERSONS = 2;

/**
 * @param {{edition: any, holdings?: any}} store
 */
export function createFilters(store) {
  // The range spans the whole delivery when its layer is loaded, otherwise the run.
  const starts = store.holdings ? store.holdings.years.map(([y]) => y) : store.edition.regests.map((r) => Math.floor(yearOf(r.start)));
  const lo = Math.min(...starts);
  const hi = Math.max(...starts);
  const clampYear = (v, fallback) => (Number.isFinite(v) && v >= lo && v <= hi ? v : fallback);
  const known = new Set(FAMILIES.map((f) => f.key));
  // Old names first read once (familien, personen), the plan's names win where both stand.
  const listed = (param("art") ?? param("familien") ?? "").split(",").filter((k) => known.has(k));
  // Place and persons are checked against the whole-delivery layer where it is loaded; a view
  // without it keeps them untouched, since it cannot evaluate them.
  const placeOk = (id) => !!id && (!store.holdings || Object.hasOwn(store.holdings.places, id));
  const personOk = (id) => !!id && (!store.holdings || Object.hasOwn(store.holdings.persons ?? {}, id));
  const listeners = new Set();
  const year = new Map(store.edition.regests.map((r) => [r.uid, Math.floor(yearOf(r.start))]));

  // A reversed range in the address (?von=1180&bis=1160) is read as the range it spans, as set() does.
  const [from, to] = [clampYear(Number(param("von")), lo), clampYear(Number(param("bis")), hi)].sort((a, b) => a - b);
  const state = {
    lo,
    hi,
    from,
    to,
    /** The families shown; all eight is the rest state, written as no art at all. */
    families: new Set(listed.length ? listed : known),
    place: placeOk(param("ort")) ? param("ort") : null,
    persons: [...new Set((param("person") ?? param("personen") ?? "").split(",").filter(personOk))].slice(0, MAX_PERSONS),
    /** "alle" or "aussagen": every regest, or only those with statements of the run. */
    layer: param("schicht") === "aussagen" ? "aussagen" : "alle",
    /** The text search of the list; the other views carry it in the address unevaluated. */
    q: (param("q") ?? "").trim(),
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    set(change) {
      if ("from" in change) state.from = clampYear(change.from, lo);
      if ("to" in change) state.to = clampYear(change.to, hi);
      if (state.from > state.to) [state.from, state.to] = [state.to, state.from];
      if ("families" in change) state.families = new Set(change.families.length ? change.families : known);
      if ("place" in change) state.place = placeOk(change.place) ? change.place : null;
      if ("persons" in change) state.persons = [...new Set(change.persons.filter(personOk))].slice(0, MAX_PERSONS);
      if ("layer" in change) state.layer = change.layer === "aussagen" ? "aussagen" : "alle";
      if ("q" in change) state.q = String(change.q ?? "").trim();
      write();
      for (const fn of listeners) fn();
    },
    /** Clears every facet. */
    reset() {
      state.set({ from: lo, to: hi, families: [...known], place: null, persons: [], layer: "alle", q: "" });
    },
    inRange(uid) {
      const y = year.get(uid);
      return y === undefined || (y >= state.from && y <= state.to);
    },
    inYear(y) {
      return y >= state.from && y <= state.to;
    },
    familyOn(key) {
      return state.families.has(key);
    },
    /** Whether the families are narrowed, i.e. at least one chip of Art is pressed. */
    familiesSet() {
      return state.families.size !== known.size;
    },
    timeActive() {
      return state.from !== lo || state.to !== hi;
    },
    /** Time or families deviate: the facets every view evaluates. */
    active() {
      return state.timeActive() || state.familiesSet();
    },
    /** Any facet deviates from the rest state. */
    any() {
      return state.active() || !!state.place || state.persons.length > 0 || state.layer !== "alle" || !!state.q;
    },
  };

  function write() {
    writeAddress({
      von: state.from !== lo ? state.from : null,
      bis: state.to !== hi ? state.to : null,
      ort: state.place,
      person: state.persons.join(","),
      art: state.familiesSet() ? [...state.families].join(",") : null,
      schicht: state.layer === "aussagen" ? "aussagen" : null,
      q: state.q || null,
      familien: null,
      personen: null,
    });
  }
  // Rewrite the old names at once, so the address shows the plan's names from the start.
  if (param("familien") !== null || param("personen") !== null) write();

  return state;
}
