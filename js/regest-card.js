/**
 * The regest as one component: the detail on demand in every view and the citable page.
 *
 * After the operator's feedback of 2026-11-11 on the reading view („viel zu viele
 * Strukturen“, verbatim in knowledge/ui-feedback.md) the regest has three parts and no more:
 * a head line (number, date, place, link to Regesta Imperii Online), the regest text in the
 * reading face with the evidence marked, and the statements as a compact list in text size,
 * each with its kind and participants. Pointing at a statement lights its passage in the
 * text and the reverse. The review state stands once, as a short word with a tooltip; only a
 * statement that deviates from it carries a mark. Commentary, transmission, model gaps,
 * review findings and the RDF sit behind one „Mehr“.
 *
 * Regesta of the whole delivery without statements show the same head and their text.
 */
import { h, regestHref } from "./dom.js";

const REVIEW_WORD = "ungeprüft";
const REVIEW_TIP = "Von LLM-basierten Agenten extrahiert, technisch geprüft, fachlich nicht abgenommen.";

/** The regest text cut at every evidence boundary, each piece knowing its statements. */
function markedText(text, spans) {
  const cuts = new Set([0, text.length]);
  for (const sp of spans) {
    cuts.add(Math.max(0, Math.min(text.length, sp.start)));
    cuts.add(Math.max(0, Math.min(text.length, sp.end)));
  }
  const points = [...cuts].sort((a, b) => a - b);
  const pieces = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const [a, b] = [points[i], points[i + 1]];
    const ids = spans.filter((sp) => sp.start <= a && sp.end >= b).map((sp) => sp.id);
    pieces.push(ids.length ? h("span", { class: "ev", "data-ids": ids.join(" ") }, text.slice(a, b)) : text.slice(a, b));
  }
  return pieces;
}

/**
 * @param {import("./app.js").Store} store
 * @param {string} uid
 * @param {{claim?: string|null, onClose?: () => void, texts?: () => Promise<Record<string, string>>, notes?: string[]}} [options]
 */
export function renderRegestCard(store, uid, options = {}) {
  const regest = store.byUid.get(uid) ?? null;
  const delivered = store.holdings?.regesta.find((r) => r.u === uid) ?? null;
  const identifier = regest?.identifier ?? delivered?.i ?? uid;
  const date = regest ? regest.date.map((seg) => seg.t).join("") : delivered?.s ?? "";
  const place = regest?.place?.map((seg) => seg.t).join("") || delivered?.l || "";
  const pi = delivered?.pi;

  const head = h(
    "p",
    { class: "card-head" },
    h("span", { class: "card-id", text: identifier }),
    date ? h("span", { class: "card-meta", text: date }) : null,
    place ? h("span", { class: "card-meta", text: place }) : null,
    pi ? h("a", { class: "card-ri", href: `https://www.regesta-imperii.de/id/${pi}`, title: "Dieses Regest in Regesta Imperii Online" }, "RI Online") : null,
    regest ? h("abbr", { class: "card-state", title: REVIEW_TIP, text: REVIEW_WORD }) : null,
    options.onClose ? h("button", { type: "button", class: "card-close", "aria-label": "Regest schließen", title: "Schließen", onclick: options.onClose }, "×") : null,
  );

  const textEl = h("p", { class: "card-text source" });
  const list = h("ul", { class: "card-claims", role: "list" });
  const card = h("article", { class: "regest-card", "aria-label": `Regest ${identifier}` }, head, textEl);

  // The passage and its statements light each other.
  const light = (id) => {
    for (const el of textEl.querySelectorAll(".ev")) el.classList.toggle("is-on", !!id && el.dataset.ids.split(" ").includes(id));
    for (const el of list.querySelectorAll("li")) el.classList.toggle("is-on", !!id && el.dataset.id === id);
  };

  if (regest) {
    textEl.append(...markedText(regest.text, regest.spans ?? []));
    textEl.addEventListener("mouseover", (e) => {
      const ev = e.target.closest(".ev");
      light(ev ? ev.dataset.ids.split(" ").at(-1) : null);
    });
    textEl.addEventListener("mouseleave", () => light(options.claim ?? null));
    for (const block of regest.blocks ?? []) {
      const id = block.head?.id ?? null;
      const people = (block.lines ?? []).filter((l) => l.phrase).map((l) => (l.role ? `${l.phrase} (${l.role})` : l.phrase));
      const deviates = block.head?.status && block.head.status.technical === false;
      const li = h(
        "li",
        { "data-id": id ?? "", tabindex: "0", onmouseenter: () => light(id), onmouseleave: () => light(options.claim ?? null), onfocus: () => light(id), onblur: () => light(options.claim ?? null) },
        h("span", { class: "claim-kind", text: block.title }),
        " ",
        h("span", { class: "claim-who", text: people.length ? people.join(", ") : "ohne genannte Beteiligte" }),
        deviates ? h("abbr", { class: "claim-flag", title: "Technische Prüfung nicht bestanden", text: "!" }) : null,
      );
      list.append(li);
    }
    if (list.children.length) card.append(list);
    else card.append(h("p", { class: "card-none", text: "Zu diesem Regest gibt es keine Aussage im Rahmen des Laufs." }));
    card.append(more(regest));
    if (options.claim) requestAnimationFrame(() => light(options.claim));
  } else {
    textEl.textContent = "…";
    options.texts?.().then((texts) => {
      textEl.textContent = texts[uid] || "Kein Regesttext geliefert.";
    });
    card.append(h("p", { class: "card-none", text: "Für dieses Regest liegen keine extrahierten Aussagen vor." }));
  }
  // Provenance and check results a view knows about this regest, one short line each.
  for (const note of options.notes ?? []) card.append(h("p", { class: `card-note${note.startsWith("Auffällig") ? " is-flag" : ""}`, text: note }));
  return card;
}

/** Everything a first reading does not need, behind one switch. */
function more(regest) {
  const parts = [];
  const plain = (segments) => (segments ?? []).map((seg) => seg.t).join("");
  const commentary = plain(regest.apparatus?.commentary);
  const transmission = plain(regest.apparatus?.transmission);
  if (commentary) parts.push(h("h3", { text: "Kommentar" }), h("p", { class: "source", text: commentary }));
  if (transmission) parts.push(h("h3", { text: "Überlieferung" }), h("p", { class: "source", text: transmission }));
  const gaps = regest.notes?.gaps ?? [];
  if (gaps.length) parts.push(h("h3", { text: "Modelllücken" }), h("ul", {}, gaps.map((g) => h("li", { text: g.text }))));
  const findings = regest.history?.findings ?? [];
  if (findings.length) parts.push(h("h3", { text: "Befunde der Reviews" }), h("ul", {}, findings.map((f) => h("li", { text: f.description }))));
  const turtle = (regest.blocks ?? []).flatMap((b) => [b.head?.turtle, ...(b.lines ?? []).map((l) => l.turtle)]).filter(Boolean);
  if (turtle.length) parts.push(h("h3", { text: "RDF" }), h("pre", { class: "card-rdf" }, h("code", { text: [...new Set(turtle)].join("\n\n") })));
  parts.push(h("p", {}, h("a", { href: regestHref(regest.uid) }, "Eigene Seite dieses Regests, zum Zitieren")));
  return h("details", { class: "card-more" }, h("summary", { text: "Mehr" }), ...parts);
}
