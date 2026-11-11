/**
 * Single regest: pointing at or focusing a statement underlines the words it rests on;
 * pointing at underlined words marks the statements resting on them. A click, Enter or Space
 * keeps a statement selected and writes it into the address (#f-<claim>). The `zurueck`
 * parameter becomes a link back to the view the reader came from, same origin only.
 */

export function init() {
  backLink();
  const pieces = [...document.querySelectorAll(".regest-text .ev")];
  const statements = [...document.querySelectorAll(".factoid[data-ev]")];
  const ids = (el) => (el.dataset.ev || "").split(" ").filter(Boolean);
  let pinned = /** @type {HTMLElement|null} */ (null);

  const underline = (wanted) => {
    const set = new Set(wanted);
    for (const piece of pieces) piece.classList.toggle("is-on", ids(piece).some((id) => set.has(id)));
  };
  const show = (statement) => underline(statement ? ids(statement) : pinned ? ids(pinned) : []);

  const pin = (statement, scroll = false) => {
    pinned?.classList.remove("is-pinned");
    pinned = statement === pinned ? null : statement;
    pinned?.classList.add("is-pinned");
    history.replaceState(null, "", pinned ? `#${pinned.id}` : location.pathname + location.search);
    show(null);
    if (pinned && scroll) pinned.scrollIntoView({ block: "center" });
  };

  for (const statement of statements) {
    statement.addEventListener("mouseenter", () => show(statement));
    statement.addEventListener("mouseleave", () => show(null));
    statement.addEventListener("focus", () => show(statement));
    statement.addEventListener("blur", () => show(null));
    statement.addEventListener("click", (event) => {
      if (event.target instanceof Element && event.target.closest("a")) return;
      pin(statement);
    });
    statement.addEventListener("keydown", (event) => {
      if (event.target !== statement || (event.key !== "Enter" && event.key !== " ")) return;
      event.preventDefault();
      pin(statement);
    });
  }
  for (const piece of pieces) {
    piece.addEventListener("mouseenter", () => {
      const set = new Set(ids(piece));
      underline(ids(piece));
      for (const s of statements) s.classList.toggle("is-related", ids(s).some((id) => set.has(id)));
    });
    piece.addEventListener("mouseleave", () => {
      for (const s of statements) s.classList.remove("is-related");
      show(null);
    });
  }

  const target = location.hash.startsWith("#f-") ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
  if (target && statements.includes(target)) pin(target, true);
}

/** Validated return address: same origin, http or https, otherwise nothing is shown. */
function backLink() {
  const raw = new URLSearchParams(location.search).get("zurueck");
  const slot = document.querySelector(".back-slot");
  if (!raw || !slot) return;
  let url;
  try {
    url = new URL(raw, location.href);
  } catch {
    return;
  }
  if (url.origin !== location.origin || !/^https?:$/.test(url.protocol)) return;
  const link = document.createElement("a");
  link.href = url.href;
  link.textContent = "Zurück zur Ansicht";
  slot.append(link);
  // Paging keeps the way back.
  for (const a of document.querySelectorAll(".pager a[rel]")) {
    const next = new URL(a.getAttribute("href"), location.href);
    next.searchParams.set("zurueck", url.href);
    a.href = next.href;
  }
}
