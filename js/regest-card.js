/**
 * The regest as one component: the detail on demand in every view and the citable page.
 *
 * Since 2026-11-12 the statements stand in the text itself (plan in knowledge/design.md,
 * Annotated regest): each statement is a bracketed passage opened by a tag with its kind and
 * number, and every participant's name inside it carries its role as a small gloss. Nested
 * and crossing statements nest or cross their brackets. The list under the text is gone,
 * because the annotated text says the same.
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

const VERDICT_SIGN = { stimmt: ["✓", "stimmt"], falsch: ["✗", "stimmt nicht"], unklar: ["?", "unklar"] };

/** The regest's review state in one word: ungeprüft, teilweise geprüft or menschlich geprüft. */
function reviewState(regest) {
  const heads = (regest.blocks ?? []).map((b) => b.head).filter((hd) => hd?.evidence);
  const done = heads.filter((hd) => hd.review).length;
  if (!done) return h("abbr", { class: "card-state", title: REVIEW_TIP, text: REVIEW_WORD });
  const all = done === heads.length;
  return h("abbr", { class: "card-state is-reviewed", title: `${done} von ${heads.length} Aussagen menschlich geprüft; das Zeichen am Tag nennt das Urteil.`, text: all ? "menschlich geprüft" : "teilweise geprüft" });
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
    }));
}

/**
 * The regest text with its statements in place: an opening tag (kind, number, verdict sign
 * once reviewed, participants the passage does not name), the passage, a closing bracket
 * with the number. A participant's name inside its passage is set as the word with its roles
 * beneath, numbered by statement. Passages carry class „ev“ and their statement ids, so a
 * pointed statement lights its words.
 */
export function annotatedText(text, statements) {
  const len = text.length;
  const clamp = (v) => Math.max(0, Math.min(len, v));
  // Names: the first occurrence of each participant inside its passage; one name range may
  // gather roles from several statements, and ranges never overlap.
  const names = new Map();
  const missing = new Map();
  for (const st of statements) {
    for (const p of st.people) {
      const at = text.indexOf(p.phrase, clamp(st.start));
      if (at < 0 || at + p.phrase.length > clamp(st.end)) {
        // Only people the passage does not name stand at the tag; an object the agent
        // paraphrased („Besitzungen“) is part of the passage already.
        if (p.role !== "Gegenstand") {
          if (!missing.has(st.id)) missing.set(st.id, []);
          missing.get(st.id).push(p);
        }
        continue;
      }
      const key = `${at}:${p.phrase.length}`;
      const clash = [...names.values()].some((g) => g.key !== key && g.start < at + p.phrase.length && at < g.end);
      if (clash) continue;
      if (!names.has(key)) names.set(key, { key, start: at, end: at + p.phrase.length, roles: [] });
      if (p.role) names.get(key).roles.push([p.role, st.n]);
    }
  }
  // One role in several statements is said once with its numbers: „Empfänger 2, 4“.
  for (const g of names.values()) {
    const byRole = new Map();
    for (const [role, n] of g.roles) byRole.set(role, [...(byRole.get(role) ?? []), n]);
    g.label = [...byRole].map(([role, ns]) => `${role} ${[...new Set(ns)].join(", ")}`).join("; ");
  }
  const nameRanges = [...names.values()].filter((g) => g.roles.length);
  // A name must not straddle a bracket; such a name is shown without its gloss.
  const bounds = new Set(statements.flatMap((st) => [clamp(st.start), clamp(st.end)]));
  const glosses = nameRanges.filter((g) => ![...bounds].some((b) => b > g.start && b < g.end));
  const cuts = new Set([0, len, ...bounds, ...glosses.flatMap((g) => [g.start, g.end])]);
  const points = [...cuts].sort((a, b) => a - b);
  const out = [];
  const opening = (st) => {
    const sign = st.review ? VERDICT_SIGN[st.review.verdict] : null;
    const extra = missing.get(st.id) ?? [];
    return h(
      "span",
      { class: "ann-open", "data-id": st.id, title: sign ? `menschlich geprüft: ${sign[1]}` : null },
      h("span", { class: "ann-kind", text: `${st.kind} ${st.n}` }),
      sign ? h("span", { class: `ann-verdict is-${st.review.verdict}`, "aria-label": `menschlich geprüft: ${sign[1]}`, text: sign[0] }) : null,
      extra.length ? h("span", { class: "ann-extra", text: extra.map((p) => (p.role ? `${p.phrase}: ${p.role}` : p.phrase)).join(", ") }) : null,
    );
  };
  for (let i = 0; i < points.length; i += 1) {
    const at = points[i];
    // Close before open, the inner passage first; open the outer passage first.
    for (const st of statements.filter((x) => clamp(x.end) === at && clamp(x.start) < at).sort((a, b) => b.start - a.start || a.n - b.n)) {
      out.push(h("span", { class: "ann-close", "data-id": st.id, "aria-hidden": "true", text: `⟩${st.n}` }));
    }
    for (const st of statements.filter((x) => clamp(x.start) === at && clamp(x.end) > at).sort((a, b) => b.end - a.end || a.n - b.n)) {
      out.push(opening(st));
    }
    if (i === points.length - 1) break;
    const next = points[i + 1];
    const ids = statements.filter((st) => st.start <= at && st.end >= next).map((st) => st.id);
    const piece = text.slice(at, next);
    const gloss = glosses.find((g) => g.start === at && g.end === next);
    const inner = gloss
      ? // A short name stays on one line under its gloss; a long description may wrap.
      h("span", { class: piece.length > 28 ? "ann-name is-long" : "ann-name" }, h("span", { class: "ann-word", text: piece }), h("span", { class: "ann-role", text: gloss.label }))
      : piece;
    out.push(ids.length ? h("span", { class: "ev", "data-ids": ids.join(" ") }, inner) : inner);
  }
  return out;
}

/**
 * Glosses hang below their word outside the text flow, so a long role list opens no gap in
 * the line. Where two glosses on one line would touch, the later one drops to a second row;
 * a gloss that would leave the text block on the right is aligned to its word's right edge.
 * Runs after layout and again when the text block changes width.
 */
export function placeGlosses(textEl) {
  const run = () => {
    const box = textEl.getBoundingClientRect();
    const rows = new Map();
    for (const role of textEl.querySelectorAll(".ann-role")) {
      role.style.removeProperty("--row");
      role.style.removeProperty("--shift");
      role.classList.remove("is-end");
    }
    for (const role of textEl.querySelectorAll(".ann-role")) {
      let r = role.getBoundingClientRect();
      if (r.right > box.right + 1) {
        role.classList.add("is-end");
        r = role.getBoundingClientRect();
      }
      const line = Math.round(r.top);
      const taken = rows.get(line) ?? [[], []];
      let row = 0;
      while (row < 2 && taken[row].some((o) => o.left < r.right + 6 && r.left < o.right + 6)) row += 1;
      let shift = 0;
      if (row === 2) {
        // Both rows taken here: the gloss moves right, behind the nearer row's last gloss.
        const ends = taken.map((list) => Math.max(...list.map((o) => o.right)));
        row = ends[0] <= ends[1] ? 0 : 1;
        shift = Math.max(0, ends[row] + 6 - r.left);
        // Never past the text block's right edge; a touch there is better than an overflow.
        shift = Math.max(0, Math.min(shift, box.right - r.right));
      }
      role.style.setProperty("--row", String(row));
      if (shift) role.style.setProperty("--shift", `${Math.round(shift)}px`);
      taken[row].push({ left: r.left + shift, right: r.right + shift });
      rows.set(line, taken);
    }
  };
  requestAnimationFrame(run);
  document.fonts?.ready.then(run);
  // A detail panel slides in after the card is built; place again once it has settled.
  setTimeout(run, 400);
  new ResizeObserver(() => run()).observe(textEl);
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

  const textEl = h("p", { class: "card-text source is-annotated" });
  // On its own citable page the component reads at page size, in a panel at sidebar size.
  const card = h("article", { class: `regest-card${options.page ? " is-page" : ""}`, "aria-label": `Regest ${identifier}` }, head, textEl);

  // A pointed tag lights its passage; options.claim keeps one statement lit.
  const light = (id) => {
    for (const el of textEl.querySelectorAll(".ev")) el.classList.toggle("is-on", !!id && el.dataset.ids.split(" ").includes(id));
    for (const el of textEl.querySelectorAll(".ann-open, .ann-close")) el.classList.toggle("is-on", !!id && el.dataset.id === id);
  };

  if (regest) {
    const statements = statementsOf(regest);
    textEl.append(...annotatedText(regest.text, statements));
    placeGlosses(textEl);
    textEl.addEventListener("mouseover", (e) => {
      const tag = e.target.closest(".ann-open, .ann-close");
      const ev = e.target.closest(".ev");
      light(tag ? tag.dataset.id : ev ? ev.dataset.ids.split(" ").at(-1) : null);
    });
    textEl.addEventListener("mouseleave", () => light(options.claim ?? null));
    if (!statements.length) card.append(h("p", { class: "card-none", text: "Zu diesem Regest gibt es keine Aussage im Rahmen des Laufs." }));
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
