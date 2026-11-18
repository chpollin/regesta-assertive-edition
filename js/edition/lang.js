/**
 * The language switch in the header of every page (DE/EN, 2026-11-18). The build writes the
 * address of the same page in the other language into its href; this module carries the query
 * and the hash of the current address along, so filters, representation and an opened regest
 * survive the switch. The reader's choice is remembered per browser, but the address alone
 * decides the language of a page; nothing redirects by the stored choice.
 *
 * The module initialises itself on import: js/edition/page.js imports it on every static page,
 * and the index.html of the views app loads it.
 */
const KEY = "regesta-edition-lang";

for (const link of document.querySelectorAll("a.lang-switch")) {
  link.addEventListener("click", (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    try {
      localStorage.setItem(KEY, link.hreflang);
    } catch {
      // Storage may be blocked; the switch works without it.
    }
    const target = new URL(link.getAttribute("href"), location.href);
    if (target.origin !== location.origin) return;
    event.preventDefault();
    location.assign(`${target.pathname}${location.search}${location.hash}`);
  });
}
