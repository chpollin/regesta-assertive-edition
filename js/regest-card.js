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

const REVIEW_WORD = "ungeprüft";
const REVIEW_TIP = "Von LLM-basierten Agenten extrahiert, technisch geprüft, fachlich nicht abgenommen.";

// The agent review at a statement (knowledge/data.md, Agent review): a small word plate, no
// glyph, since the family signs of the annotation system include a check mark (Bestätigung);
// always named as the readers' verdict, since no person has verified it. „strittig“: the
// two readers disagree, and both readings stay.
const verdictPlate = (agent) => h("span", { class: `ann-verdict is-${slug(agent.outcome)}`, title: `Urteil zweier LLM-Leser: ${agent.outcome}` }, agent.outcome);
const slug = (outcome) => outcome.replace(/\s+/g, "-");

// Small line signs for the head, drawn in the text colour; the word beside or the accessible
// name carries the meaning, so a sign never stands alone (rule 7).
const SVGNS = "http://www.w3.org/2000/svg";
const ICON = {
  date: "M3 4.5h10v8.5H3zM3 7h10M5.5 3v3M10.5 3v3",
  place: "M8 14s4.5-4.2 4.5-7.5a4.5 4.5 0 0 0-9 0C3.5 9.8 8 14 8 14zM8 8.2a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4z",
  out: "M9 3h4v4M13 3 7.5 8.5M11 9.5V13H3V5h3.5",
  agents: "M5.5 6.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM10.5 6.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM2 13c0-2.2 1.6-4 3.5-4S9 10.8 9 13M7 13c0-2.2 1.6-4 3.5-4S14 10.8 14 13",
};
function icon(name) {
  const svg = document.createElementNS(SVGNS, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("class", "head-icon");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVGNS, "path");
  path.setAttribute("d", ICON[name]);
  svg.append(path);
  return svg;
}

/** The regest's review state in one word: ungeprüft, or read by agents with who and when. */
function reviewState(regest) {
  const heads = (regest.blocks ?? []).map((b) => b.head).filter((hd) => hd?.evidence);
  const read = heads.filter((hd) => hd.agentReview);
  if (!read.length) return h("abbr", { class: "card-state", title: REVIEW_TIP, text: REVIEW_WORD });
  const { model, date } = read[0].agentReview;
  return h(
    "abbr",
    {
      class: "card-state",
      tabindex: "0",
      title: `${read.length} von ${heads.length} Aussagen von zwei LLM-basierten Agenten unabhängig gegen den Regesttext gelesen (${model}, ${date}). Das Schild an einer Aussage nennt ihr Urteil, „strittig“, wenn sie verschieden urteilen. Keine Aussage ist menschlich verifiziert.`,
    },
    icon("agents"),
    "von LLM-Agenten gelesen",
  );
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

/**
 * One note per statement: kind and number, the short qualifiers, the human verdict as sign
 * and word, and below the participants with their roles in the regest's own words.
 */
export function notesOf(statements) {
  return h(
    "ol",
    { class: "card-notes", "aria-label": "Aussagen zu diesem Regest" },
    statements.map((st) => {
      const agent = st.agent;
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
  const date = regest ? regest.date.map((seg) => seg.t).join("") : delivered?.s ?? "";
  const place = regest?.place?.map((seg) => seg.t).join("") || delivered?.l || "";
  const pi = delivered?.pi;

  const head = h(
    "div",
    { class: "card-head" },
    h("span", { class: "card-id", text: identifier }),
    date ? h("span", { class: "card-meta", title: "Datierung" }, icon("date"), date) : null,
    place ? h("span", { class: "card-meta", title: "Ausstellungsort" }, icon("place"), place) : null,
    pi ? h("a", { class: "card-meta card-ri", href: `https://www.regesta-imperii.de/id/${pi}`, title: "Dieses Regest in Regesta Imperii Online" }, icon("out"), "RI Online") : null,
    regest && !options.page ? h("a", { class: "card-meta", href: regestHref(uid), title: "Eigene Seite dieses Regests, zum Zitieren" }, icon("out"), "Seite") : null,
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

/**
 * The citable regest page in three areas that keep their place on every page (operator,
 * 2026-11-14: „einen richtigen Lesebereich“, „einen Bereich, wo alle Meta-Daten sind, und
 * einen Bereich, wo alle zusätzlichen Kommentare sind“; design.md, Regest page and Annotation
 * system):
 * - metadata: everything about the regest and its edition as labelled fields;
 * - reading: the regest text, each annotated passage opened by the sign of its family and its
 *   number, its extent shown when it or its statement is chosen;
 * - comments: what is said about the text, the agents' statements and the apparatus of the
 *   Regesta Imperii in two blocks named by their producer.
 * The static page hands in what only it knows (options.meta: citation forms, further fields
 * and links of the delivery).
 */
function pageView(store, regest, options) {
  const statements = statementsOf(regest);
  const meta = options.meta ?? {};
  const delivered = store.holdings?.regesta.find((r) => r.u === regest.uid) ?? null;
  const date = regest.date.map((seg) => seg.t).join("");
  const place = regest.place?.map((seg) => seg.t).join("") || "";
  const files = options.files;

  const textEl = h("p", { class: "card-text source is-noted" }, ...notedText(regest.text, statements));
  const present = [...new Map(statements.map((st) => [familyOf(st.kind).key, familyOf(st.kind)])).values()];
  const reading = h(
    "section",
    { class: "reg-reading", "aria-label": "Regesttext" },
    h("p", { class: "reg-title" }, h("span", { class: "reg-id", text: regest.identifier }), options.pager ?? null),
    textEl,
    statements.length
      ? h(
          "p",
          { class: "reg-legend" },
          "Zeichen im Text: Beginn einer Aussage, nach ihrer Art. ",
          present.map((f) => h("span", { class: "reg-legend-item" }, familyIcon(f, { size: 14 }), f.label)),
        )
      : h("p", { class: "reg-legend", text: "Zu diesem Regest gibt es keine Aussage im Rahmen des Laufs." }),
  );

  // Metadata: labelled fields, one per row.
  const field = (label, ...value) => (value.flat().some((v) => v !== null && v !== "" && v !== undefined) ? [h("dt", { text: label }), h("dd", {}, ...value)] : []);
  const pi = delivered?.pi;
  const read = statements.filter((st) => st.agent);
  const metaEl = h(
    "section",
    { class: "reg-meta", "aria-labelledby": "reg-meta-h" },
    h("h2", { id: "reg-meta-h", class: "reg-area", text: "Metadaten" }),
    h(
      "dl",
      {},
      field("Datierung", date),
      field("Ausstellungsort", place),
      ...(meta.fields ?? []).filter((f) => f.where === "meta").map((f) => field(f.label, f.text)),
      field("Regesta Imperii", pi ? h("a", { href: `https://www.regesta-imperii.de/id/${pi}`, rel: "noopener" }, "Regest in RI Online") : ""),
      field("Dateien", files ? ["TEI", "TTL", "JSON"].map((k, i) => [i ? " " : "", h("a", { href: files[k], download: "" }, k)]) : ""),
      field(
        "Prüfstand",
        regest.technical ? "von LLM-Agenten erzeugt, technisch geprüft, keine Aussage menschlich verifiziert" : "von LLM-Agenten erzeugt, technische Prüfung nicht bestanden",
        read.length ? `; ${read.length} von ${statements.length} Aussagen von zwei LLM-Agenten gelesen (${read[0].agent.model}, ${read[0].agent.date})` : "",
      ),
      ...(meta.links ?? []).map((l) => field(l.label, h("a", { href: l.href, rel: "noopener" }, l.text))),
      ...(meta.citations ?? []).map((c) => field(c.label, h("span", { class: "reg-cite", text: c.text }))),
    ),
  );

  // Comments: the agents' statements, then the apparatus of the Regesta Imperii.
  const notesEl = h(
    "ol",
    { class: "reg-notes", "aria-label": "Aussagen zu diesem Regest" },
    statements.map((st) => {
      const f = familyOf(st.kind);
      const byRole = new Map();
      for (const pp of st.people) byRole.set(pp.role || "beteiligt", [...(byRole.get(pp.role || "beteiligt") ?? []), pp.phrase]);
      const agent = st.agent;
      return h(
        "li",
        { "data-id": st.id, tabindex: "0" },
        h(
          "p",
          { class: "note-head" },
          h("span", { class: "ann-chip" }, familyIcon(f, { size: 13 }), String(st.n)),
          h("span", { class: "note-kind", text: st.kind }),
          agent ? verdictPlate(agent) : null,
        ),
        h(
          "dl",
          { class: "note-fields" },
          st.qualifiers.length ? [h("dt", { text: "Wortlaut" }), h("dd", { text: st.qualifiers.map((q) => `„${q}“`).join(", ") })] : null,
          [...byRole].map(([role, names]) => [h("dt", { text: role }), h("dd", { text: names.join(", ") })]),
          st.literals.map((l) => [h("dt", { text: l.label }), h("dd", { text: regest.text.slice(l.start, l.end) })]),
        ),
        agent && agent.outcome !== "stimmt" ? agent.readers.map((r, i) => h("p", { class: "note-review" }, `LLM-Leser ${i + 1}, ${r.verdict}: ${r.reason}`)) : null,
      );
    }),
  );
  const plain = (segments) => (segments ?? []).map((seg) => seg.t).join("");
  const apparatusRows = [
    ["Überlieferung", plain(regest.apparatus?.transmission)],
    ["Kommentar", plain(regest.apparatus?.commentary)],
    ...(meta.fields ?? []).filter((f) => f.where === "comment").map((f) => [f.label, f.text]),
  ].filter(([, text]) => text);
  const comments = h(
    "section",
    { class: "reg-comments", "aria-labelledby": "reg-comments-h" },
    h("h2", { id: "reg-comments-h", class: "reg-area", text: "Kommentare" }),
    statements.length
      ? h(
          "div",
          { class: "reg-block" },
          h("h3", { class: "reg-block-h", text: "Aussagen der LLM-Agenten" }),
          h("p", { class: "reg-producer", text: "Aus dem Regesttext erzeugt, an ihren Wortlaut gebunden. Das Schild nennt das Urteil zweier LLM-Leser: stimmt, unklar oder strittig, wenn sie verschieden urteilen. Kein Mensch hat die Aussagen geprüft." }),
          notesEl,
        )
      : null,
    apparatusRows.length
      ? h(
          "div",
          { class: "reg-block" },
          h("h3", { class: "reg-block-h", text: "Apparat der Regesta Imperii" }),
          h("p", { class: "reg-producer", text: "Von den Bearbeitern der Regesta Imperii, unverändert." }),
          h("dl", { class: "reg-apparatus" }, apparatusRows.map(([label, text]) => [h("dt", { text: label }), h("dd", { class: "source", text })])),
        )
      : null,
  );

  const page = h("article", { class: "regest-page-grid", "aria-label": `Regest ${regest.identifier}` }, metaEl, reading, comments);
  // One statement lit at a time: its passage extent in the text, its chip and its entry.
  const light = (id) => {
    for (const el of textEl.querySelectorAll(".ev, .ann-n")) el.classList.toggle("is-on", !!id && el.dataset.ids.split(" ").includes(id));
    for (const el of notesEl.children) el.classList.toggle("is-on", !!id && el.dataset.id === id);
  };
  textEl.addEventListener("mouseover", (e) => {
    const ev = e.target.closest(".ann-n, .ev");
    light(ev ? ev.dataset.ids.split(" ").at(-1) : null);
  });
  textEl.addEventListener("mouseleave", () => light(options.claim ?? null));
  for (const li of notesEl.children) {
    const id = li.dataset.id;
    li.addEventListener("mouseenter", () => light(id));
    li.addEventListener("mouseleave", () => light(options.claim ?? null));
    li.addEventListener("focus", () => light(id));
    li.addEventListener("blur", () => light(options.claim ?? null));
  }
  if (options.claim) requestAnimationFrame(() => light(options.claim));
  return page;
}
