/**
 * Entry of every static page. The pages are complete without scripts; this module only
 * enhances them, chosen by body[data-page]. data-root on <html> is the relative path to the
 * site root, so the site works from any folder of a static server.
 */
import { carryFilters } from "../url.js";

document.documentElement.classList.replace("no-js", "js");
// A change of view keeps the chosen filters (knowledge/interface-plan.md, One filter model).
carryFilters();

const root = document.documentElement.dataset.root ?? "";
const loaders = {
  start: () => import("./start.js"),
  regest: () => import("./regest.js"),
  regesten: () => import("./regesten.js"),
  personen: () => import("./listfilter.js"),
};

const load = loaders[document.body.dataset.page];
if (load) {
  load()
    .then((module) => module.init(root))
    .catch((error) => console.error("Erweiterung der Seite fehlgeschlagen:", error));
}
