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
 * text and the reverse. The review state stands once, as a short word with a tooltip.
 *
 * After the operator's feedback of 2026-11-14 on the page („das Mehr mit dem Ausklappen finde
 * ich schlecht“, „extrem textlastig“, „Daten … symbolisch und einheitlich“): the head is one
 * line of signs (date, place, Regesta Imperii Online, the files), a note shows number, kind,
 * qualifier and the agents' sign, and its participants appear only while the note or its
 * passage is pointed at or focused. „Mehr“ is gone: on the page the source apparatus
 * (transmission, commentary) stands below the text; model gaps, review findings and the RDF
 * stay in the files.
 *
 * Regesta of the whole delivery without statements show the same head and their text.
 */
import { h, regestHref } from "./dom.js";
import { familyIcon, familyOf } from "./relations.js";
import { s } from "./svg.js";

const REVIEW_WORD = "ungeprüft";
const REVIEW_TIP = "Die Aussagen haben LLM-basierte Agenten aus dem Regesttext extrahiert, technisch geprüft, fachlich nicht abgenommen.";

// The agent review at a statement (knowledge/data.md, Agent review): a small word plate, no
// glyph, since the family signs of the annotation system include a check mark (Bestätigung);
// always named as the readers' verdict, since no person has verified it. „strittig“: the
// two readers disagree, and both readings stay.
// The plate names its producer, since a fresh reader could not tell who had said „stimmt“ beside
// „ungeprüft“ (2026-11-18).
const verdictPlate = (agent) => h("span", { class: `ann-verdict is-${slug(agent.outcome)}`, title: `Urteil zweier LLM-Leser: ${agent.outcome}; kein Mensch hat geprüft` }, `LLM: ${agent.outcome}`);
const slug = (outcome) => outcome.replace(/\s+/g, "-");

// Small line signs for the head, drawn in the text colour; the word beside or the accessible
// name carries the meaning, so a sign never stands alone (rule 7).
const ICON = {
  date: "M3 4.5h10v8.5H3zM3 7h10M5.5 3v3M10.5 3v3",
  place: "M8 14s4.5-4.2 4.5-7.5a4.5 4.5 0 0 0-9 0C3.5 9.8 8 14 8 14zM8 8.2a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4z",
  out: "M9 3h4v4M13 3 7.5 8.5M11 9.5V13H3V5h3.5",
  agents: "M5.5 6.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM10.5 6.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM2 13c0-2.2 1.6-4 3.5-4S9 10.8 9 13M7 13c0-2.2 1.6-4 3.5-4S14 10.8 14 13",
  copy: "M5.5 5.5h7v8h-7zM3.5 10.5v-8h7",
  file: "M4 2.5h5.5L12 5v8.5H4zM9.5 2.5V5H12",
  book: "M3 3.5h4.5a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 0-1.5-1.5H3zM13 3.5H9.5A1.5 1.5 0 0 0 8 5v8.5a1.5 1.5 0 0 1 1.5-1.5H13z",
};

/** The persistent address of a regest in Regesta Imperii Online. */
const riUri = (pi) => `https://www.regesta-imperii.de/id/${pi}`;
/** The citation form of a regest of the delivery, as the citable page names it. */
export const riCitation = (identifier, pi) => `${identifier}, in: Regesta Imperii Online, URI: ${riUri(pi)}, CC BY 4.0, bearbeitet.`;

/**
 * A button that copies a citation; it says „kopiert“ for a moment. The clipboard API where the
 * page may use it, else the selection of a hidden field; where neither works the button says so
 * and the citation stands in its tooltip to copy by hand.
 */
export function copyButton(text, cls = "card-meta card-copy") {
  const word = h("span", { text: "Zitieren" });
  const button = h("button", { type: "button", class: cls, title: text, "aria-label": `Zitierweise kopieren: ${text}` }, icon("copy"), word);
  const say = (w) => {
    word.textContent = w;
    setTimeout(() => (word.textContent = "Zitieren"), 2200);
  };
  button.addEventListener("click", async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("no clipboard");
      await navigator.clipboard.writeText(text);
      say("kopiert");
    } catch {
      const field = h("textarea", { class: "visually-hidden", "aria-hidden": "true" });
      field.value = text;
      document.body.append(field);
      field.select();
      const ok = document.execCommand?.("copy");
      field.remove();
      button.focus();
      say(ok ? "kopiert" : "nicht kopiert, Zitat im Tooltip");
    }
  });
  return button;
}
function icon(name) {
  return s("svg", { viewBox: "0 0 16 16", class: "head-icon", "aria-hidden": "true" }, s("path", { d: ICON[name] }));
}

/**
 * The review state of the regest's statements, once in the head: the one word „ungeprüft“
 * (interface plan of 2026-11-17), its tip naming the producer and, where it exists, the agents'
 * reading with model and date. The tip opens on pointing, on focus and on a tap, so it is
 * reachable without a mouse. A regest without statements has no state to name.
 */
let tipCount = 0;
function reviewState(regest, run) {
  const heads = (regest.blocks ?? []).map((b) => b.head).filter((hd) => hd?.evidence);
  if (!heads.length) return null;
  const read = heads.filter((hd) => hd.agentReview);
  const agents = read.length
    ? ` ${read.length} von ${heads.length} Aussagen von zwei LLM-basierten Agenten unabhängig gegen den Regesttext gelesen (${read[0].agentReview.model}, ${read[0].agentReview.date}); das Schild an einer Aussage nennt ihr Urteil.`
    : "";
  const id = `card-state-${(tipCount += 1)}`;
  const button = h("button", { type: "button", class: "card-state", "aria-describedby": id, "aria-expanded": "false" }, read.length ? icon("agents") : null, REVIEW_WORD);
  button.addEventListener("click", () => button.setAttribute("aria-expanded", String(button.getAttribute("aria-expanded") !== "true")));
  button.addEventListener("blur", () => button.setAttribute("aria-expanded", "false"));
  // Producer, LLM and date of the run, as its manifest names them (edition.json, run).
  const when = run?.id?.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  const producer = run?.model ? `Die Aussagen haben LLM-basierte Agenten (${run.model}${when ? `, Lauf vom ${when}` : ""}) aus dem Regesttext extrahiert, ${regest.technical === false ? "die technische Prüfung haben sie nicht bestanden" : "technisch geprüft"}.` : REVIEW_TIP;
  return h("span", { class: "card-state-wrap" }, button, h("span", { class: "card-state-tip", role: "tooltip", id, text: `${producer}${agents} Kein Mensch hat sie geprüft.` }));
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
      agent: b.head.agentReview ?? null,
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
    // The opening sign of a statement: its family's sign and its number (design.md, Annotation system).
    if (starting.length) out.push(h("span", { class: "ann-n", "data-ids": starting.map((st) => st.id).join(" "), "aria-hidden": "true" }, starting.map((st) => h("span", { class: "ann-chip" }, familyIcon(familyOf(st.kind), { size: 11 }), String(st.n)))));
    const ids = statements.filter((st) => st.start <= a && st.end >= b).map((st) => st.id);
    const piece = text.slice(a, b);
    out.push(ids.length ? h("span", { class: "ev", "data-ids": ids.join(" ") }, piece) : piece);
  }
  return out;
}

/** The participants of a statement grouped by role, each role once, in the regest's own words. */
function byRoleOf(st) {
  const byRole = new Map();
  for (const pp of st.people) byRole.set(pp.role || "beteiligt", [...(byRole.get(pp.role || "beteiligt") ?? []), pp.phrase]);
  return byRole;
}

/**
 * Link the annotated text and the notes of its statements, in the card and on the page: a
 * pointed passage or chip lights its statement, a pointed or focused note lights its passage
 * and chip; `claim` keeps one statement lit at rest. notesEl is null without statements.
 */
function linkStatements(textEl, notesEl, claim) {
  const light = (id) => {
    for (const el of textEl.querySelectorAll(".ev, .ann-n")) el.classList.toggle("is-on", !!id && el.dataset.ids.split(" ").includes(id));
    for (const el of notesEl?.children ?? []) el.classList.toggle("is-on", !!id && el.dataset.id === id);
  };
  textEl.addEventListener("mouseover", (e) => {
    const ev = e.target.closest(".ev, .ann-n");
    light(ev ? ev.dataset.ids.split(" ").at(-1) : null);
  });
  textEl.addEventListener("mouseleave", () => light(claim ?? null));
  for (const li of notesEl?.children ?? []) {
    const id = li.dataset.id;
    li.addEventListener("mouseenter", () => light(id));
    li.addEventListener("mouseleave", () => light(claim ?? null));
    li.addEventListener("focus", () => light(id));
    li.addEventListener("blur", () => light(claim ?? null));
  }
  if (claim) requestAnimationFrame(() => light(claim));
}

/**
 * One note per statement: kind and number, the short qualifiers, the human verdict as sign
 * and word, and below the participants with their roles in the regest's own words.
 */
export function notesOf(statements, { chips = false } = {}) {
  return h(
    "ol",
    { class: "card-notes", "aria-label": "Aussagen zu diesem Regest" },
    statements.map((st) => {
      const agent = st.agent;
      // Each role named once: „Zeuge: Otto von Moos, Erbo von Biburg“.
      const people = [...byRoleOf(st)].map(([role, names]) => `${role}: ${names.join(", ")}`).join(". ");
      return h(
        "li",
        { "data-id": st.id, tabindex: "0" },
        h(
          "p",
          { class: "note-head" },
          chips ? h("span", { class: "ann-chip" }, familyIcon(familyOf(st.kind), { size: 13 }), String(st.n)) : h("span", { class: "note-n", text: String(st.n) }),
          h("span", { class: "note-kind", text: st.kind }),
          st.qualifiers?.length ? h("span", { class: "note-qual", text: ` (${st.qualifiers.join(", ")})` }) : null,
          agent ? verdictPlate(agent) : null,
        ),
        // Shown while the note or its passage is pointed at or focused (css: .note-detail).
        h(
          "div",
          { class: "note-detail" },
          h("p", { class: "note-people", text: people || "ohne genannte Beteiligte" }),
          agent && agent.outcome !== "stimmt" ? agent.readers.map((r, i) => h("p", { class: "note-review" }, `LLM-Leser ${i + 1}, ${r.verdict}: ${r.reason}`)) : null,
        ),
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
  if (options.page && regest) return pageView(store, regest, options);
  const delivered = store.holdings?.regesta.find((r) => r.u === uid) ?? null;
  const identifier = regest?.identifier ?? delivered?.i ?? uid;
  // The dating prose of the delivery (date_string, field d of holdings.json) where the layer
  // carries it, as the run's regesta show it; the machine date only as fallback.
  const date = regest ? regest.date.map((seg) => seg.t).join("") : delivered?.d || delivered?.s || "";
  const place = regest?.place?.map((seg) => seg.t).join("") || delivered?.l || "";
  const pi = delivered?.pi;

  const head = h(
    "div",
    { class: "card-head" },
    h("span", { class: "card-id", text: identifier }),
    date ? h("span", { class: "card-meta", title: "Datierung" }, icon("date"), date) : null,
    place ? h("span", { class: "card-meta", title: "Ausstellungsort" }, icon("place"), place) : null,
    pi ? h("a", { class: "card-meta card-ri", href: riUri(pi), title: "Dieses Regest in Regesta Imperii Online" }, icon("out"), "RI Online") : null,
    // „Regestseite“ replaces „Seite“, which a fresh reader did not understand (2026-11-18).
    regest && !options.page ? h("a", { class: "card-meta", href: regestHref(uid), title: "Eigene, zitierbare Seite dieses Regests mit Apparat und Dateien" }, icon("file"), "Regestseite") : null,
    pi ? copyButton(riCitation(identifier, pi)) : null,
    regest ? reviewState(regest, store.edition.run) : null,
    // A word, not the cross: the cross is the sign of Streit in the annotation (2026-11-18).
    options.onClose ? h("button", { type: "button", class: "card-close", "aria-label": "Regest schließen", onclick: options.onClose }, "Schließen") : null,
  );

  const textEl = h("p", { class: "card-text source is-noted" });
  // On its own citable page the component reads at page size, in a panel at sidebar size.
  const card = h("article", { class: `regest-card${options.page ? " is-page" : ""}`, "aria-label": `Regest ${identifier}` }, head, textEl);

  if (regest) {
    const statements = statementsOf(regest);
    textEl.append(...notedText(regest.text, statements));
    const notesEl = statements.length ? notesOf(statements) : null;
    linkStatements(textEl, notesEl, options.claim);
    if (notesEl) {
      // Text and notes share one row, so the notes can stand beside their passages.
      const body = h("div", { class: "card-body" });
      textEl.replaceWith(body);
      body.append(textEl, notesEl);
      placeNotes(card, textEl, notesEl);
    } else card.append(h("p", { class: "card-none", text: "Zu diesem Regest gibt es keine Aussage im Rahmen des Laufs." }));
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

/**
 * The citable regest page (interface plan of 2026-11-17, accepted with the head line in place of
 * the metadata column): one head line of signs and short words, below it the regest text with
 * its statement chips and the notes at the height of their passages, and the apparatus of the
 * Regesta Imperii in two columns over the full width. Below 760 px of page width the notes follow
 * the text as a numbered list (placeNotes).
 *
 * Head line: number, dating, place, the one word „ungeprüft“ with a popover (producer, LLM,
 * date, that no person has checked), then the actions: Regesta Imperii Online, the files TEI,
 * TTL and JSON, a copy button for the citation, one menu for the facsimile links, previous and
 * next. The static page hands in what only it knows (options.meta: citation forms, further fields
 * and links of the delivery; options.files; options.pager).
 */
function pageView(store, regest, options) {
  const statements = statementsOf(regest);
  const meta = options.meta ?? {};
  const delivered = store.holdings?.regesta.find((r) => r.u === regest.uid) ?? null;
  const date = regest.date.map((seg) => seg.t).join("");
  const place = regest.place?.map((seg) => seg.t).join("") || "";
  const files = options.files;
  const pi = delivered?.pi;
  const forged = regest.identifier.includes("†");

  // The facsimile links of the delivery in one menu, so their repeated labels stand once.
  const links = meta.links ?? [];
  const facsimiles = links.length
    ? h(
        "details",
        { class: "card-menu" },
        h("summary", { class: "card-meta" }, icon("book"), links.length > 1 ? `Digitalisate (${links.length})` : "Digitalisat"),
        h("ul", { class: "card-menu-list", role: "list" }, links.map((l) => h("li", {}, h("a", { href: l.href, rel: "noopener" }, l.text)))),
      )
    : null;
  const editionCitation = (meta.citations ?? []).find((c) => c.label === "Zitierweise dieser Edition")?.text;
  const citation = editionCitation ? `${editionCitation} ${location.origin}${location.pathname}` : pi ? riCitation(regest.identifier, pi) : null;
  const fileLinks = files ? h("span", { class: "card-files" }, icon("file"), ["TEI", "TTL", "JSON"].map((k) => h("a", { class: "card-meta", href: files[k], download: "", title: `${k}-Datei dieses Regests` }, k))) : null;
  const head = h(
    "div",
    { class: "card-head page-head" },
    h("h1", { class: "card-id page-id", text: regest.identifier, title: forged ? "Das Kreuz der Regesta Imperii kennzeichnet eine Fälschung." : null }),
    forged ? h("span", { class: "card-meta", text: "Fälschung" }) : null,
    date ? h("span", { class: "card-meta", title: "Datierung" }, icon("date"), date) : null,
    place ? h("span", { class: "card-meta", title: "Ausstellungsort" }, icon("place"), place) : null,
    reviewState(regest, store.edition.run),
    h(
      "span",
      { class: "page-actions" },
      pi ? h("a", { class: "card-meta", href: riUri(pi), rel: "noopener", title: "Dieses Regest in Regesta Imperii Online" }, icon("out"), "RI Online") : null,
      fileLinks,
      citation ? copyButton(citation) : null,
      facsimiles,
      options.pager ?? null,
    ),
  );

  const textEl = h("p", { class: "card-text source is-noted" }, ...notedText(regest.text, statements));
  const notesEl = statements.length ? notesOf(statements, { chips: true }) : null;
  const body = h("div", { class: "card-body" }, textEl, notesEl);
  const present = [...new Map(statements.map((st) => [familyOf(st.kind).key, familyOf(st.kind)])).values()];
  const legend = statements.length
    ? h("p", { class: "reg-legend" }, present.map((f) => h("span", { class: "reg-legend-item" }, familyIcon(f, { size: 14 }), f.label)))
    : h("p", { class: "reg-legend", text: "Zu diesem Regest gibt es keine Aussage im Rahmen des Laufs." });

  const plain = (segments) => (segments ?? []).map((seg) => seg.t).join("");
  const apparatusRows = [
    ...(meta.fields ?? []).filter((f) => f.where === "meta").map((f) => [f.label, f.text]),
    ["Überlieferung", plain(regest.apparatus?.transmission)],
    ["Kommentar", plain(regest.apparatus?.commentary)],
    ...(meta.fields ?? []).filter((f) => f.where === "comment").map((f) => [f.label, f.text]),
  ].filter(([, text]) => text);
  const apparatus = apparatusRows.length
    ? h(
        "section",
        { class: "reg-apparatus-block", "aria-labelledby": "reg-app-h" },
        h("h2", { id: "reg-app-h", class: "reg-block-h", text: "Apparat der Regesta Imperii, unverändert" }),
        h("div", { class: "reg-apparatus" }, apparatusRows.map(([label, text]) => h("p", {}, h("span", { class: "reg-app-label", text: label }), " ", h("span", { class: "source", text })))),
      )
    : null;

  const page = h("article", { class: "regest-card is-page", "aria-label": `Regest ${regest.identifier}` }, head, body, legend, apparatus);
  linkStatements(textEl, notesEl, options.claim);
  if (notesEl) placeNotes(page, textEl, notesEl);
  return page;
}
