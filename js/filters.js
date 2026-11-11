/**
 * The shared filter state of the interactive views: time range and relation families.
 *
 * The operator asked on 2026-11-11 for time as a filter instead of a second chart, and for
 * one filterable sidebar in every view (verbatim in knowledge/ui-feedback.md). Both views,
 * the flat network and the space view, read the same state, so switching between them keeps
 * person, time range and families. The state lives in the query string (von, bis, familien),
 * the hash keeps route and person.
 */
import { FAMILIES } from "./relations.js";

/** Fractional year of an ISO date, the same rule as everywhere in the interface. */
export function yearOf(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return y + ((m - 1) * 30.4 + (d - 1)) / 365;
}

/**
 * @param {{edition: any}} store
 * @returns {{from: number, to: number, lo: number, hi: number, families: Set<string>,
 *   onChange: (fn: () => void) => () => void, set: (change: object) => void, reset: () => void,
 *   inRange: (uid: string) => boolean, familyOn: (key: string) => boolean, active: () => boolean}}
 */
export function createFilters(store) {
  const starts = store.edition.regests.map((r) => Math.floor(yearOf(r.start)));
  const lo = Math.min(...starts);
  const hi = Math.max(...starts);
  const params = new URLSearchParams(location.search);
  const clampYear = (v, fallback) => (Number.isFinite(v) && v >= lo && v <= hi ? v : fallback);
  const known = new Set(FAMILIES.map((f) => f.key));
  const listed = (params.get("familien") ?? "").split(",").filter((k) => known.has(k));
  const listeners = new Set();
  const year = new Map(store.edition.regests.map((r) => [r.uid, Math.floor(yearOf(r.start))]));

  const state = {
    lo,
    hi,
    from: clampYear(Number(params.get("von")), lo),
    to: clampYear(Number(params.get("bis")), hi),
    families: new Set(listed.length ? listed : known),
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    set(change) {
      if ("from" in change) state.from = clampYear(change.from, lo);
      if ("to" in change) state.to = clampYear(change.to, hi);
      if (state.from > state.to) [state.from, state.to] = [state.to, state.from];
      if ("families" in change) state.families = new Set(change.families);
      write();
      for (const fn of listeners) fn();
    },
    reset() {
      state.set({ from: lo, to: hi, families: [...known] });
    },
    inRange(uid) {
      const y = year.get(uid);
      return y === undefined || (y >= state.from && y <= state.to);
    },
    familyOn(key) {
      return state.families.has(key);
    },
    active() {
      return state.from !== lo || state.to !== hi || state.families.size !== known.size;
    },
  };

  function write() {
    const q = new URLSearchParams(location.search);
    for (const k of ["von", "bis", "familien"]) q.delete(k);
    if (state.from !== lo) q.set("von", String(state.from));
    if (state.to !== hi) q.set("bis", String(state.to));
    if (state.families.size !== known.size) q.set("familien", [...state.families].join(","));
    const query = q.toString();
    history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}${location.hash}`);
  }

  return state;
}
