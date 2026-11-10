/**
 * Reading view of one regest, the detail view that the timeline and the person graph lead to.
 * Task: read the regest and judge each statement against the words it rests on.
 *
 * Statement -> text: pointing at, focusing or selecting a phrase underlines its evidence on
 * the paper in red, the colour of a person pointing. Text -> statement: pointing at words,
 * or stepping through the evidence with the arrow keys while the paper has focus, underlines
 * the phrases resting on them.
 */
import { h, regestHref, renderSegments, sourceField } from "./dom.js";

/**
 * @typedef {object} Phrase
 * @property {string} key
 * @property {string} text
 * @property {any[]} lines           lines of edition.json this phrase stands for
 * @property {string[]} own          evidence span ids of lines with their own E13
 * @property {string[]} inherited    span ids of the event classification it rests on
 * @property {HTMLElement} [button]
 * @property {HTMLElement} [block]
 */

/**
 * @param {import("./app.js").Store} store
 * @param {any} regest
 * @param {string|null} claimId
 */
export function renderReading(store, regest, claimId) {
  const regests = store.edition.regests;
  const index = regests.indexOf(regest);
  const known = new Set(store.byUid.keys());
  const spans = new Map(regest.spans.map((s) => [s.id, s]));
  const lineByKey = new Map();
  for (const line of allLines(regest.blocks)) if (line.key) lineByKey.set(line.key, line);

  /** @type {Phrase[]} */
  const phrases = [];
  const state = { pinned: /** @type {Phrase|null} */ (null), preview: /** @type {Phrase|null} */ (null), spanPreview: /** @type {string|null} */ (null) };

  const text = buildText(regest);

  function paint() {
    paintMarks();
    for (const holder of quoteHolders.values()) holder.replaceChildren();
    const p = state.pinned;
    const id = p ? (p.own[0] ?? p.inherited[0]) : null;
    const span = id ? spans.get(id) : null;
    if (p?.block && span) quoteHolders.get(p.block)?.append(h("q", { class: "source", text: regest.text.slice(span.start, span.end) }));
  }

  function paintMarks() {
    for (const seg of text.segments) seg.el.classList.remove("pen", "pen-inherited");
    for (const p of phrases) p.button?.classList.remove("is-pointed", "is-pinned");
    for (const b of blockEls) b.classList.remove("is-open");
    if (state.pinned) {
      state.pinned.button?.classList.add("is-pinned");
      state.pinned.block?.classList.add("is-open");
    }
    if (state.spanPreview) {
      mark(state.spanPreview, "pen");
      for (const p of phrases) if (p.own.includes(state.spanPreview) || p.inherited.includes(state.spanPreview)) p.button?.classList.add("is-pointed");
      return;
    }
    const target = state.preview ?? state.pinned;
    if (!target) return;
    target.button?.classList.add("is-pointed");
    for (const id of target.own) mark(id, "pen");
    if (!target.own.length) for (const id of target.inherited) mark(id, "pen-inherited");
  }

  function mark(id, cls) {
    const span = spans.get(id);
    if (!span) return;
    for (const seg of text.segments) if (seg.start >= span.start && seg.end <= span.end) seg.el.classList.add(cls);
  }

  function pin(phrase, { focus = false, scroll = false } = {}) {
    state.pinned = phrase;
    const claim = phrase?.lines.find((l) => l.own && l.id)?.id ?? null;
    history.replaceState(null, "", regestHref(regest.uid, claim));
    for (const p of phrases) p.button?.setAttribute("aria-pressed", String(p === phrase));
    setRoving(phrase ?? phrases[0]);
    paint();
    if (phrase && focus) phrase.button?.focus({ preventScroll: true });
    if (phrase && scroll) phrase.button?.scrollIntoView({ block: "center" });
  }

  function setRoving(current) {
    for (const p of phrases) p.button?.setAttribute("tabindex", p === current ? "0" : "-1");
  }

  // Statements: one sentence per act, built by the pipeline from the graph.
  const blockEls = [];
  const quoteHolders = new Map();
  const blocks = regest.blocks.map((block) => {
    const el = h("li", { class: "act" });
    const sentence = h(
      "p",
      { class: "act-sentence" },
      block.sentence.map((part, i) => (typeof part === "string" ? part : phraseEl(part, i === 0 && block.node !== null, el))),
    );
    const notes = block.lines.filter((l) => l.kind === "literal").map(noteEl);
    for (const line of block.lines) {
      for (const n of line.folded?.notes ?? []) notes.push(noteEl(n));
    }
    const evq = h("p", { class: "evq" });
    quoteHolders.set(el, evq);
    const detail = h("div", { class: "act-detail" }, evq, rdfDetail(block));
    const xrefs = block.lines.flatMap((l) => (l.crossrefs ?? []).map((x) => crossref(x, store)));
    const agentNotes = block.lines.flatMap((l) => (l.agentNotes ?? []).map((n) => agentNote(n, "Vermerk des Extraktionsagenten")));
    el.append(sentence, ...notes, detail, ...xrefs, ...agentNotes);
    blockEls.push(el);
    return el;
  });

  function phraseEl(part, isHead, blockEl) {
    if (!part.keys.length) return h("span", { class: "act-type untyped", text: part.text });
    const lines = part.keys.map((k) => lineByKey.get(k)).filter(Boolean);
    const own = lines.filter((l) => l.own && spans.has(l.id)).map((l) => l.id);
    const inherited = lines.filter((l) => !l.own && l.inherits && spans.has(l.inherits)).map((l) => l.inherits);
    /** @type {Phrase} */
    const phrase = { key: part.keys[0], text: part.text, lines, own, inherited, block: blockEl };
    const basis = own.length ? null : inherited.length ? "inherited" : "none";
    // A span with the button role, because a native button breaks the sentence into boxes
    // and cannot wrap inline; Enter and Space are handled below.
    const button = h(
      "span",
      {
        role: "button",
        class: `phrase${isHead ? " act-type" : ""}${basis ? ` basis-${basis}` : ""}`,
        tabindex: "-1",
        "aria-pressed": "false",
        "aria-describedby": basis ? `basis-${basis}` : null,
      },
      part.text,
    );
    phrase.button = button;
    phrases.push(phrase);
    button.addEventListener("mouseenter", () => {
      state.preview = phrase;
      paint();
    });
    button.addEventListener("mouseleave", () => {
      state.preview = null;
      paint();
    });
    button.addEventListener("focus", () => {
      state.preview = phrase;
      setRoving(phrase);
      paint();
    });
    button.addEventListener("blur", () => {
      state.preview = null;
      paint();
    });
    button.addEventListener("click", () => pin(state.pinned === phrase ? null : phrase));
    button.addEventListener("keydown", (event) => onPhraseKey(event, phrase));
    const marker = basis === "none" ? h("span", { class: "no-basis", text: " ohne Beleg" }) : null;
    return marker ? h("span", {}, button, marker) : button;
  }

  function onPhraseKey(event, phrase) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      pin(state.pinned === phrase ? null : phrase);
      return;
    }
    const at = phrases.indexOf(phrase);
    let next = null;
    if (event.key === "ArrowDown" || event.key === "ArrowRight") next = phrases[Math.min(at + 1, phrases.length - 1)];
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft") next = phrases[Math.max(at - 1, 0)];
    else if (event.key === "Home") next = phrases[0];
    else if (event.key === "End") next = phrases[phrases.length - 1];
    else if (event.key === "Escape" && state.pinned) {
      event.preventDefault();
      pin(null);
      phrase.button?.focus();
      return;
    }
    if (next) {
      event.preventDefault();
      next.button?.focus();
      next.button?.scrollIntoView({ block: "nearest" });
    }
  }

  function rdfDetail(block) {
    const lines = [block.head, ...block.lines].filter(Boolean);
    return h(
      "details",
      { class: "rdf" },
      h("summary", { text: "RDF" }),
      h(
        "pre",
        { class: "code" },
        h("code", {
          text: lines
            .filter((l) => l.kind !== "literal")
            .flatMap((l) => [l, l.folded?.head].filter(Boolean))
            .map((l) => l.turtle ?? `<${l.triple[0]}> <${l.triple[1]}> <${l.triple[2]}> .`)
            .join("\n\n"),
        }),
      ),
    );
  }

  // Paper: the regest as delivered, one segment per evidence boundary.
  const sortedSpans = [...regest.spans];
  let cursor = -1;
  const paper = h(
    "p",
    {
      class: "regest",
      lang: "de",
      tabindex: sortedSpans.length ? "0" : null,
      "aria-describedby": sortedSpans.length ? "text-keys" : null,
    },
    text.segments.map((s) => s.el),
  );
  for (const seg of text.segments) {
    if (!seg.ids.length) continue;
    const shortest = seg.ids.map((id) => spans.get(id)).sort((a, b) => a.end - a.start - (b.end - b.start))[0];
    seg.el.addEventListener("mouseenter", () => {
      state.spanPreview = shortest.id;
      paint();
    });
    seg.el.addEventListener("mouseleave", () => {
      state.spanPreview = null;
      paint();
    });
    seg.el.addEventListener("click", () => {
      const phrase = phrases.find((p) => p.own.includes(shortest.id));
      state.spanPreview = null;
      if (phrase) pin(phrase, { focus: true, scroll: true });
    });
  }
  paper.addEventListener("keydown", (event) => {
    if (!sortedSpans.length) return;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") cursor = (cursor + 1) % sortedSpans.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") cursor = cursor <= 0 ? sortedSpans.length - 1 : cursor - 1;
    else if (event.key === "Enter" && cursor >= 0) {
      event.preventDefault();
      const phrase = phrases.find((p) => p.own.includes(sortedSpans[cursor].id));
      state.spanPreview = null;
      if (phrase) pin(phrase, { focus: true, scroll: true });
      return;
    } else if (event.key === "Escape") {
      cursor = -1;
      state.spanPreview = null;
      paint();
      return;
    } else return;
    event.preventDefault();
    state.spanPreview = sortedSpans[cursor].id;
    paint();
    const related = phrases.filter((p) => p.own.includes(state.spanPreview)).map((p) => p.text);
    announce(`Belegstelle ${cursor + 1} von ${sortedSpans.length}: ${related.join(", ")}`);
  });
  paper.addEventListener("blur", () => {
    if (state.spanPreview) {
      state.spanPreview = null;
      paint();
    }
  });

  const prev = regests[index - 1];
  const next = regests[index + 1];
  const run = store.edition.run;
  const hasInherited = phrases.some((p) => !p.own.length && p.inherited.length);
  const hasNone = phrases.some((p) => !p.own.length && !p.inherited.length);

  const element = h(
    "article",
    { class: "reading-view", "aria-labelledby": "regest-title" },
    h(
      "div",
      { class: "title-row" },
      h("h1", { id: "regest-title", text: regest.identifier }),
      h(
        "nav",
        { class: "pager", "aria-label": "Benachbarte Regesten" },
        prev ? h("a", { href: regestHref(prev.uid), rel: "prev", "aria-label": `Vorheriges Regest ${prev.identifier}` }, "← ", prev.short) : null,
        next ? h("a", { href: regestHref(next.uid), rel: "next", "aria-label": `Nächstes Regest ${next.identifier}` }, next.short, " →") : null,
      ),
    ),
    h(
      "div",
      { class: "reading" },
      h(
        "section",
        { class: "text-col", "aria-label": "Regesttext" },
        h(
          "div",
          { class: "paper" },
          h("p", { class: "paper-meta" }, sourceField(regest.date, "ohne Datierung"), h("span", { class: "gap" }), sourceField(regest.place, "ohne Ortsangabe")),
          paper,
        ),
        h("span", { id: "text-keys", class: "visually-hidden", text: "Pfeiltasten wählen die Belegstellen, Eingabe wählt die zugehörige Aussage." }),
        apparatus(regest, known),
      ),
      h(
        "section",
        { class: "claims-col", "aria-labelledby": "claims-title" },
        h("h2", { id: "claims-title", text: "Aussagen des Agenten" }),
        regest.blocks.length ? reviewState(regest, run) : null,
        regest.blocks.length ? h("ul", { class: "acts", role: "list" }, blocks) : emptyState(regest),
        hasInherited || hasNone
          ? h(
              "p",
              { class: "basis-key" },
              hasInherited ? h("span", { id: "basis-inherited" }, h("span", { class: "basis-sample", text: "gepunktet" }), " ohne eigenen Beleg, gestützt auf den Beleg des Vorgangs") : null,
              hasInherited && hasNone ? h("br") : null,
              hasNone ? h("span", { id: "basis-none" }, h("span", { class: "no-basis", text: "ohne Beleg" }), " weder eigener noch Vorgangsbeleg") : null,
            )
          : null,
        historyDetails(regest),
      ),
    ),
  );

  setRoving(phrases[0] ?? null);
  const target = claimId ? phrases.find((p) => p.lines.some((l) => l.id === claimId)) : null;
  if (target) {
    state.pinned = target;
    target.button?.setAttribute("aria-pressed", "true");
    setRoving(target);
  }
  paint();

  return {
    element,
    focus: () => {
      if (target) {
        target.button?.focus({ preventScroll: true });
        target.button?.scrollIntoView({ block: "center" });
      } else {
        const heading = element.querySelector("h1");
        heading?.setAttribute("tabindex", "-1");
        heading?.focus({ preventScroll: true });
        window.scrollTo(0, 0);
      }
    },
  };
}

/** Every line of every block, folded heads and notes included. */
function allLines(blocks) {
  const out = [];
  for (const b of blocks) {
    for (const line of [b.head, ...b.lines]) {
      if (!line) continue;
      out.push(line);
      if (line.folded) out.push(...[line.folded.head, ...line.folded.notes].filter(Boolean));
    }
  }
  return out;
}

/** The review state of the regest, once, by shape and fill; read from the run. */
function reviewState(regest, run) {
  const item = (cls, reached, text) =>
    h("span", { class: "state" }, h("span", { class: `st ${cls}${reached ? "" : " is-open"}`, "aria-hidden": "true" }), text);
  return h(
    "p",
    { class: "review-state" },
    item("st-asserted", true, "behauptet"),
    item("st-technical", regest.technical, regest.technical ? "technisch geprüft" : "technisch nicht bestanden"),
    item("st-expert", run.expert_accepted, run.expert_accepted ? "fachlich abgenommen" : "fachlich nicht abgenommen"),
  );
}

function noteEl(line) {
  if (line.verbatim) {
    return h("p", { class: "act-note" }, h("span", { class: "note-label", text: `${line.label} ` }), h("q", { class: "source", text: line.text }));
  }
  return h("p", { class: "act-note" }, h("span", { class: "note-label", text: `${line.label} des Agenten ` }), h("span", { class: "machine", text: line.text }));
}

/** Split the regest at every evidence boundary; each piece knows the spans covering it. */
function buildText(regest) {
  const cuts = new Set([0, regest.text.length]);
  for (const s of regest.spans) {
    cuts.add(s.start);
    cuts.add(s.end);
  }
  const points = [...cuts].sort((a, b) => a - b);
  const segments = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    const ids = regest.spans.filter((s) => s.start <= start && s.end >= end).map((s) => s.id);
    const el = h("span", { class: ids.length ? "ev" : null, text: regest.text.slice(start, end) });
    segments.push({ start, end, ids, el });
  }
  return { segments };
}

function crossref(x, store) {
  const otherRegest = store.byUid.get(x.other.regest);
  const otherNotes = [];
  for (const block of otherRegest?.blocks ?? []) {
    for (const line of block.lines) if (line.id === x.other.claim && line.agentNotes) otherNotes.push(...line.agentNotes);
  }
  const row = (side, here) =>
    h(
      "tr",
      {},
      h("th", { scope: "row" }, here ? `${side.label} (hier)` : h("a", { href: regestHref(side.regest, side.claim), text: side.label })),
      h("td", {}, h("code", { class: "iri", text: side.iri })),
      h(
        "td",
        {},
        side.register ? h("span", { class: "source", text: side.register.label }) : "kein Registereintrag gefunden",
        side.register ? h("span", { class: "reg-state", text: side.register.assigned ? " zugeordnet" : " im Paket angeboten, nicht zugeordnet" }) : null,
      ),
    );
  return h(
    "div",
    { class: "xref" },
    h(
      "p",
      {},
      "Gleicher Name, andere Kennung in ",
      h("a", { href: regestHref(x.other.regest, x.other.claim), text: x.other.label }),
      ". Eine Identität ist im Graphen nicht behauptet.",
    ),
    h(
      "div",
      { class: "table-scroll" },
      h(
        "table",
        { class: "xref-table" },
        h("thead", {}, h("tr", {}, h("th", { scope: "col", text: "Regest" }), h("th", { scope: "col", text: "Kennung des Elternteils" }), h("th", { scope: "col", text: "Register" }))),
        h("tbody", {}, row(x.here, true), row(x.other, false)),
      ),
    ),
    otherNotes.map((n) => agentNote(n, `Vermerk des Extraktionsagenten zu ${x.other.label}`)),
    x.graphNode ? h("p", {}, h("a", { href: `#/personen/${encodeURIComponent(x.graphNode)}`, text: `${x.child} im Personengraphen` })) : null,
  );
}

function agentNote(note, label) {
  return h("p", { class: "act-note" }, h("span", { class: "note-label", text: `${label} ` }), h("q", { class: "machine", lang: note.lang, text: note.text }));
}

function emptyState(regest) {
  const reasons = regest.notes.gaps.filter((g) => g.stage === "Extraktion");
  return h(
    "div",
    { class: "empty" },
    h("p", { text: "Keine Aussage im Pilotumfang. Begründung des Extraktionsagenten:" }),
    reasons.map((g) => h("p", { class: "machine", lang: g.lang, text: g.text })),
  );
}

function apparatus(regest, known) {
  const { commentary, transmission, links } = regest.apparatus;
  if (!commentary.length && !transmission.length && !links.length) return null;
  return h(
    "details",
    { class: "apparatus" },
    h("summary", {}, "Kommentar und Überlieferung", h("span", { class: "summary-note", text: " Apparat der Regesta Imperii, nicht Grundlage der Aussagen" })),
    commentary.length ? h("p", { class: "source" }, h("span", { class: "run-in", text: "Kommentar " }), renderSegments(commentary, known)) : null,
    transmission.length ? h("p", { class: "source" }, h("span", { class: "run-in", text: "Überlieferung " }), renderSegments(transmission, known)) : null,
    links.length ? h("p", {}, renderSegments(links, known)) : null,
  );
}

function historyDetails(regest) {
  const { findings, decisions, revised, final } = regest.history;
  const { unresolved, gaps, corrections } = regest.notes;
  const reviewGaps = [...(revised?.gaps ?? []), ...(final?.gaps ?? [])];
  const allGaps = dedupe([...gaps.map((g) => ({ ...g })), ...reviewGaps.map((t) => ({ text: t, lang: "de", stage: "Review" }))]);
  const remaining = [...(revised?.remaining ?? [])];
  const parts = [];
  if (findings.length) parts.push(`${findings.length} ${findings.length === 1 ? "Befund" : "Befunde"} des Review-Agenten`);
  else parts.push("keine Befunde des Review-Agenten");
  if (allGaps.length) parts.push(`${allGaps.length} ${allGaps.length === 1 ? "Modelllücke" : "Modelllücken"}`);
  if (unresolved.length) parts.push(`${unresolved.length} ungelöste ${unresolved.length === 1 ? "Identität" : "Identitäten"}`);

  const p = (label, body, lang) => h("p", { lang }, h("span", { class: "run-in", text: `${label} ` }), body);
  const findingEl = (f, label) =>
    h(
      "div",
      { class: "finding" },
      p(`${label} (${f.severity}, ${f.category})`, h("span", { class: "machine", text: f.description })),
      f.quote ? h("p", {}, h("q", { class: "source", text: regest.text.slice(f.quote.start, f.quote.end) })) : null,
      f.proposal ? p("Vorschlag", h("span", { class: "machine", text: f.proposal })) : null,
    );
  return h(
    "details",
    { class: "history" },
    h("summary", {}, "Vermerke und Prüfverlauf", h("span", { class: "summary-note", text: ` ${parts.join(" | ")}` })),
    findings.map((f) => findingEl(f, "Befund des Review-Agenten")),
    decisions.map((d) => p(`Entscheidung der Hauptsitzung: ${d.decision}`, h("span", { class: "machine", lang: d.lang, text: d.reason }))),
    corrections.map((c) => p("Korrektur", h("span", { class: "machine", lang: c.lang, text: c.text }))),
    revised ? p("Erneute Prüfung", h("span", { class: "machine", text: revised.disposition })) : null,
    remaining.map((f) => findingEl(f, "Offener Befund nach erneuter Prüfung")),
    final ? p("Abschließende Prüfung", h("span", { class: "machine", text: final.disposition })) : null,
    unresolved.map((u) => p("Ungelöste Identität", h("span", { class: "machine", lang: u.lang, text: u.text }))),
    allGaps.map((g) => p(`Modelllücke, ${g.stage}`, h("span", { class: "machine", lang: g.lang, text: g.text }))),
  );
}

function dedupe(items) {
  const seen = new Set();
  return items.filter((i) => (seen.has(i.text) ? false : (seen.add(i.text), true)));
}

function announce(message) {
  const region = document.getElementById("announce");
  if (region) region.textContent = message;
}
