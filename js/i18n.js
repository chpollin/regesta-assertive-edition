/**
 * The interface words of the edition in the language of the page (knowledge/glossary.md).
 *
 * The language comes from `<html lang>`, which the build sets from the address: the German site
 * at the root, the English one under en/. Every visible word of the interface, accessible names
 * and tooltips included, stands keyed in js/i18n/de.json and js/i18n/en.json, which build_site.py
 * reads for the static pages as well; checks/test_site.py asserts that both carry every key.
 *
 * Source text is never translated: regest texts, apparatus, quotations and the names of persons
 * and places stay as Regesta Imperii delivered them, and the views mark them lang="de". The
 * vocabulary of the model (act types, roles) is translated through the English prefLabels of the
 * run's frozen SKOS vocabulary, which build_data.py writes into edition.json as `vocabulary`.
 *
 * The module loads its dictionary with top-level await, so every module that imports it can use
 * t() while it is evaluated.
 */
export const LANG = document.documentElement.lang === "en" ? "en" : "de";

const response = await fetch(new URL(`./i18n/${LANG}.json`, import.meta.url));
if (!response.ok) throw new Error(`i18n/${LANG}.json: HTTP ${response.status}`);
const dict = await response.json();

let vocabulary = {};

/**
 * The interface text of a key, with {name} placeholders filled from vars. A value with the forms
 * one and other is chosen by vars.n. A missing key returns the key itself, so a gap shows on
 * screen instead of breaking the view.
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function t(key, vars = {}) {
  let value = dict.ui[key];
  if (value === undefined) {
    console.warn(`i18n: missing key ${key} (${LANG})`);
    return key;
  }
  if (typeof value === "object") value = vars.n === 1 ? value.one : value.other;
  return value.replace(/\{(\w+)\}/g, (whole, name) => (name in vars ? String(vars[name]) : whole));
}

/** Hand in the vocabulary map of edition.json: German label to English label. */
export function setVocabulary(map) {
  vocabulary = map ?? {};
}

/**
 * A label of the model's vocabulary in the page language: the English prefLabel of the frozen
 * vocabulary, else the English word the dictionary gives for a label the build coins itself
 * (terms), else the German label unchanged.
 * @param {string} label
 */
export function term(label) {
  if (LANG === "de" || !label) return label;
  return vocabulary[label] ?? dict.terms?.[label] ?? label;
}
