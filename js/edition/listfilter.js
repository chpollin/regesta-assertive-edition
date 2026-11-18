/**
 * Filter of the regest list and the person index: a search over the field the build
 * precomputed in data-q (lower case, umlauts spelled out, diacritics stripped, matched as a
 * substring), and one switch per relation family over data-f. A row stays when it matches
 * the search and, with families switched on, carries at least one of them. The filter row is
 * hidden in the static page and shown here, so without JavaScript no dead control stands.
 */
import { param, writeAddress } from "../url.js";

function fold(text) {
  return text
    .toLowerCase()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, "");
}

export async function init(root) {
  const { t } = await import(new URL(`${root}ansicht/js/i18n.js`, document.baseURI).href);
  const box = document.querySelector(".list-filter");
  if (!box) return;
  const input = box.querySelector(".list-q");
  const count = box.querySelector(".filter-count");
  const toggles = [...box.querySelectorAll(".fam-toggle")];
  const rows = [...document.querySelectorAll("tr[data-q]")];
  const groups = [...document.querySelectorAll("tr.group")];
  // Address state: ?q=...&art=dispute,kin, so a filtered list can be linked and survives back.
  input.value = param("q") ?? "";
  const wanted = new Set((param("art") ?? "").split(",").filter(Boolean));
  for (const t of toggles) t.setAttribute("aria-pressed", String(wanted.has(t.dataset.f)));
  box.hidden = false;

  const apply = () => {
    const q = fold(input.value.trim());
    const on = toggles.filter((t) => t.getAttribute("aria-pressed") === "true").map((t) => t.dataset.f);
    let shown = 0;
    for (const row of rows) {
      const fams = (row.dataset.f ?? "").split(" ");
      const hit = (!q || row.dataset.q.includes(q)) && (!on.length || on.some((f) => fams.includes(f)));
      row.hidden = !hit;
      if (hit) shown += 1;
    }
    // A group heading stays only while a row of its group is shown.
    for (const g of groups) g.hidden = ![...g.closest("tbody").querySelectorAll("tr[data-q]")].some((r) => !r.hidden);
    // The empty state says what is and what helps (rule 16).
    count.textContent = !q && !on.length ? "" : shown ? t("listfilter.count", { n: shown, total: rows.length }) : t("listfilter.empty");
    writeAddress({ q: q ? input.value.trim() : null, art: on.join(",") });
  };
  input.addEventListener("input", apply);
  for (const t of toggles) {
    t.addEventListener("click", () => {
      t.setAttribute("aria-pressed", String(t.getAttribute("aria-pressed") !== "true"));
      apply();
    });
  }
  apply();
}
