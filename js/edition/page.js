/**
 * Entry of every static page. The pages are complete without scripts; this module only
 * enhances them, chosen by body[data-page]. data-root on <html> is the relative path to the
 * site root, so the site works from any folder of a static server.
 */
document.documentElement.classList.replace("no-js", "js");

const root = document.documentElement.dataset.root ?? "";
const loaders = {
  start: () => import("./start.js"),
  person: () => import("./person.js"),
  regest: () => import("./regest.js"),
  personen: () => import("./persons.js"),
};

const load = loaders[document.body.dataset.page];
if (load) {
  load()
    .then((module) => module.init(root))
    .catch((error) => console.error("Erweiterung der Seite fehlgeschlagen:", error));
}
