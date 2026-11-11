/**
 * Persons index: a name filter over the search field the build precomputed in data-q
 * (lower case, umlauts spelled out, diacritics stripped), matched as a substring.
 */

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

export function init() {
  const box = document.querySelector(".filter");
  const input = document.getElementById("name-filter");
  const count = box?.querySelector(".filter-count");
  const rows = [...document.querySelectorAll("tr[data-q]")];
  if (!box || !input) return;
  box.hidden = false;
  input.addEventListener("input", () => {
    const q = fold(input.value.trim());
    let shown = 0;
    for (const row of rows) {
      const hit = !q || row.dataset.q.includes(q);
      row.hidden = !hit;
      if (hit) shown += 1;
    }
    count.textContent = q ? `${shown} von ${rows.length}` : "";
  });
}
