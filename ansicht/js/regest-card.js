/**
 * The regest as one component: the detail on demand in every view and the citable page.
 *
 * Since 2026-11-14 the statements stand as notes beside the text, each at the height of its
 * passage, which carries a small number where it begins (design.md, Annotated regest); in a
 * narrow card the notes follow the text. The bracketed tags and role glosses inside the
 * sentence of 2026-11-12 were retired after the operator found them „unübersichtlich“.
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

// The human verdict at a tag: sign and word together (rule 7: a sign never stands alone).
const VERDICT_SIGN = { stimmt: ["✓", "bestätigt"], falsch: ["✗", "verworfen"], unklar: ["?", "unklar"] };

/** The regest's review state in one word: ungeprüft, teilweise geprüft or menschlich geprüft. */
function reviewState(regest) {
  const heads = (regest.blocks ?? []).map((b) => b.head).filter((hd) => hd?.evidence);
  const done = heads.filter((hd) => hd.review).length;
  if (!done) return h("abbr", { class: "card-state", title: REVIEW_TIP, text: REVIEW_WORD });
  const all = done === heads.length;
  return h("abbr", { class: "card-state is-reviewed", title: `${done} von ${heads.length} Aussagen menschlich geprüft; das Zeichen am Tag nennt das Urteil.`, text: all ? "menschlich geprüft" : "teilweise geprüft" });
}

/** Short qualifiers for the tag, at most QUAL_MAX characters together; every other literal is glossed. */
const QUAL_MAX = 24;
function literalsOf(lines) {
  const qualifiers = [];
  const literals = [];
  let used = 0;
  for (const l of lines.filter((x) => x.kind === "literal")) {
    if (l.label === "Wortlaut" && used + l.text.length <= QUAL_MAX) {
      qualifiers.push(l.text);
      used += l.text.length + 2;
    } else if (l.evidence) {
      literals.push({ label: l.label.replace(" laut Regest", ""), start: l.evidence.start, end: l.evidence.end });
    }
  }
  return { qualifiers, literals };
}

/** The statements of a regest with number, passage, kind and participants. */
export function statementsOf(regest) {
  return (regest.blocks ?? [])
    .filter((b) => b.head?.evidence)
    .map((b, i) => ({
      id: b.head.id,
      n: i + 1,
      kind: b.title,
      start: b.head.evidence.start,
      end: b.head.evidence.end,
      review: b.head.review ?? null,
      people: (b.lines ?? [])
        .filter((l) => l.phrase && (l.rel === "role" || l.rel === "concerns"))
        .map((l) => ({ phrase: l.phrase, role: l.role ?? (l.rel === "concerns" ? "Gegenstand" : "") })),
      // Verbatim literals of the statement: a short qualifier („Witwe“, „Oheim“, „eidlich“)
      // belongs to the tag, a condition, ground, amount or exception is glossed in place.
      ...literalsOf(b.lines ?? []),
    }));
}

/**
 * The regest text with its statements marked: each passage that carries a statement is a
 * marked span with its statement ids, and a small number stands where a statement's
 * passage begins. Kind, participants and roles stand in the notes beside or below the text
 * (notesOf), after the operator's verdict of 2026-11-14 that kind tags and role glosses
 * inside the sentence were „unübersichtlich“.
 */
export function notedText(text, statements) {
  const len = text.length;
  const clamp = (v) => Math.max(0, Math.min(len, v));
  const cuts = new Set([0, len, ...statements.flatMap((st) => [clamp(st.start), clamp(st.end)])]);
  const points = [...cuts].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const [a, b] = [points[i], points[i + 1]];
    const starting = statements.filter((st) => clamp(st.start) === a && clamp(st.end) > a);
    if (starting.length) out.push(h("sup", { class: "ann-n", "data-ids": starting.map((st) => st.id).join(" "), "aria-hidden": "true", text: starting.map((st) => st.n).join(",") }));
    const ids = statements.filter((st) => st.start <= a && st.end >= b).map((st) => st.id);
    const piece = text.slice(a, b);
    out.push(ids.length ? h("span", { class: "ev", "data-ids": ids.join(" ") }, piece) : piece);
  }
  return out;
}

/**
 * One note per statement: kind and number, the short qualifiers, the human verdict as sign
 * and word, and below the participants with their roles in the regest's own words.
 */
export function notesOf(statements) {
  return h(
    "ol",
    { class: "card-notes", "aria-label": "Aussagen zu diesem Regest" },
    statements.map((st) => {
      const sign = st.review ? VERDICT_SIGN[st.review.verdict] : null;
      // Participants grouped by role, each role named once: „Zeuge: Otto von Moos, Erbo von Biburg“.
      const byRole = new Map();
      for (const pp of st.people) byRole.set(pp.role || "beteiligt", [...(byRole.get(pp.role || "beteiligt") ?? []), pp.phrase]);
      const people = [...byRole].map(([role, names]) => `${role}: ${names.join(", ")}`).join(". ");
      return h(
        "li",
        { "data-id": st.id, tabindex: "0" },
        h(
          "p",
          { class: "note-head" },
          h("span", { class: "note-n", text: String(st.n) }),
          h("span", { class: "note-kind", text: st.kind }),
          st.qualifiers?.length ? h("span", { class: "note-qual", text: ` (${st.qualifiers.join(", ")})` }) : null,
          sign ? h("span", { class: `ann-verdict is-${st.review.verdict}`, text: `${sign[0]} ${sign[1]}` }) : null,
        ),
        people ? h("p", { class: "note-people", text: people }) : h("p", { class: "note-people", text: "ohne genannte Beteiligte" }),
      );
    }),
  );
}

/**
 * Notes in the margin: when the card is wide enough, each note stands at the height of its
 * passage's first line, pushed down only as far as the note above needs; otherwise the notes
 * follow the text as a list. Runs after layout and again on every change of width.
 */
export function placeNotes(card, textEl, notesEl) {
  const run = () => {
    const wide = card.clientWidth >= 760;
    card.classList.toggle("has-margin", wide);
    let bottom = 0;
    for (const li of notesEl.children) {
      li.style.removeProperty("top");
      if (!wide) continue;
      const mark = textEl.querySelector(`.ann-n[data-ids~="${CSS.escape(li.dataset.id)}"]`);
      const want = mark ? mark.offsetTop - 2 : bottom;
      const top = Math.max(want, bottom);
      li.style.top = `${top}px`;
      bottom = top + li.offsetHeight + 8;
    }
    notesEl.style.minBlockSize = wide ? `${bottom}px` : "";
  };
  requestAnimationFrame(run);
  document.fonts?.ready.then(run);
  setTimeout(run, 400);
  new ResizeObserver(() => run()).observe(card);
}

/**
 * @param {import("./app.js").Store} store
 * @param {string} uid
 * @param {{claim?: string|null, onClose?: () => void, texts?: () => Promise<Record<string, string>>, notes?: string[], page?: boolean}} [options]
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
    regest ? reviewState(regest) : null,
    options.onClose ? h("button", { type: "button", class: "card-close", "aria-label": "Regest schließen", title: "Schließen", onclick: options.onClose }, "×") : null,
  );

  const textEl = h("p", { class: "card-text source is-noted" });
  // On its own citable page the component reads at page size, in a panel at sidebar size.
  const card = h("article", { class: `regest-card${options.page ? " is-page" : ""}`, "aria-label": `Regest ${identifier}` }, head, textEl);

  // A pointed tag lights its passage; options.claim keeps one statement lit.
  let notesEl = null;
  const light = (id) => {
    for (const el of textEl.querySelectorAll(".ev, .ann-n")) el.classList.toggle("is-on", !!id && el.dataset.ids.split(" ").includes(id));
    for (const el of notesEl?.children ?? []) el.classList.toggle("is-on", !!id && el.dataset.id === id);
  };

  if (regest) {
    const statements = statementsOf(regest);
    textEl.append(...notedText(regest.text, statements));
    textEl.addEventListener("mouseover", (e) => {
      const ev = e.target.closest(".ev, .ann-n");
      light(ev ? ev.dataset.ids.split(" ").at(-1) : null);
    });
    textEl.addEventListener("mouseleave", () => light(options.claim ?? null));
    if (statements.length) {
      notesEl = notesOf(statements);
      for (const li of notesEl.children) {
        const id = li.dataset.id;
        li.addEventListener("mouseenter", () => light(id));
        li.addEventListener("mouseleave", () => light(options.claim ?? null));
        li.addEventListener("focus", () => light(id));
        li.addEventListener("blur", () => light(options.claim ?? null));
      }
      // Text and notes share one row, so the notes can stand beside their passages.
      const body = h("div", { class: "card-body" });
      textEl.replaceWith(body);
      body.append(textEl, notesEl);
      placeNotes(card, textEl, notesEl);
    } else card.append(h("p", { class: "card-none", text: "Zu diesem Regest gibt es keine Aussage im Rahmen des Laufs." }));
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
