/**
 * The operator's review sheet for twenty regesta (decision of 2026-11-12, knowledge/plan.md).
 *
 * One question per screen: does each statement hold against the regest text? Per regest the
 * text with its evidence underlined, per statement a judgement (stimmt, stimmt nicht, unklar)
 * and a free note, per regest one note for what is missing. The data come prebuilt from
 * build_review_sheet.py (data/sheet.json); judgements live in the browser while working and
 * leave as a JSON file the agent reads back. Browser storage is only a draft that survives a
 * reload; the saved file is the result.
 */
import { h } from "../js/dom.js";
import { markedText } from "../js/regest-card.js";

const VERDICTS = [
  ["stimmt", "stimmt"],
  ["falsch", "stimmt nicht"],
  ["unklar", "unklar"],
];
const NONE = "__keine__";

const main = document.getElementById("main");
const list = document.getElementById("list");
const progress = document.getElementById("progress");

let sheet = null;
let at = 0;
/** uid -> {note, statements: {id -> {verdict, note}}} */
let answers = {};
let draftKey = "";

const statementsOf = (item) => (item.statements.length ? item.statements : [{ id: NONE, kind: "Keine Aussage", who: "Die Agenten haben aus diesem Regest nichts extrahiert. Stimmt das?" }]);
const answerOf = (item) => (answers[item.uid] ??= { note: "", statements: {} });

function readDraft() {
  try {
    return JSON.parse(localStorage.getItem(draftKey) || "{}");
  } catch {
    return {};
  }
}
function writeDraft() {
  try {
    localStorage.setItem(draftKey, JSON.stringify(answers));
  } catch {
    // Without storage the page still works; only a reload loses the draft.
  }
}

function judged(item) {
  const a = answerOf(item);
  return statementsOf(item).filter((s) => a.statements[s.id]?.verdict).length;
}

function renderProgress() {
  const all = sheet.items.reduce((n, item) => n + statementsOf(item).length, 0);
  const done = sheet.items.reduce((n, item) => n + judged(item), 0);
  progress.textContent = `${done} von ${all} Aussagen beurteilt`;
}

function renderList() {
  list.replaceChildren(
    ...sheet.items.map((item, i) =>
      h(
        "li",
        {},
        // The row names the regest; its state is a sign (open, begun, done) whose words are in
        // the accessible name, so the list stays one short line per regest.
        h(
          "button",
          {
            type: "button",
            class: "sheet-row",
            "aria-current": i === at ? "true" : null,
            "data-state": judged(item) === 0 ? "open" : judged(item) === statementsOf(item).length ? "done" : "begun",
            "aria-label": `${item.identifier}, ${judged(item)} von ${statementsOf(item).length} Aussagen beurteilt`,
            title: `${judged(item)} von ${statementsOf(item).length} Aussagen beurteilt`,
            onclick: () => show(i),
          },
          h("span", { class: "row-id", text: item.identifier }),
        ),
      ),
    ),
  );
}

function show(i) {
  at = Math.max(0, Math.min(sheet.items.length - 1, i));
  const item = sheet.items[at];
  const a = answerOf(item);
  const textEl = h("p", { class: "sheet-text source" }, ...markedText(item.text, item.spans));
  const light = (id) => {
    for (const el of textEl.querySelectorAll(".ev")) el.classList.toggle("is-on", !!id && el.dataset.ids.split(" ").includes(id));
  };
  const statements = h(
    "ol",
    { class: "sheet-claims" },
    statementsOf(item).map((s, n) => {
      const saved = a.statements[s.id] ?? {};
      const name = `v-${item.uid}-${n}`;
      const choice = h(
        "fieldset",
        { class: "verdict" },
        h("legend", { class: "visually-hidden", text: `Urteil zu Aussage ${n + 1}` }),
        VERDICTS.map(([value, label]) =>
          h(
            "label",
            {},
            h("input", {
              type: "radio",
              name,
              value,
              checked: saved.verdict === value,
              onchange: () => {
                (a.statements[s.id] ??= {}).verdict = value;
                writeDraft();
                renderProgress();
                renderList();
              },
            }),
            label,
          ),
        ),
      );
      const note = h("input", {
        type: "text",
        class: "claim-note",
        value: saved.note ?? "",
        "aria-label": `Anmerkung zu Aussage ${n + 1}`,
        placeholder: "Anmerkung",
        oninput: (e) => {
          (a.statements[s.id] ??= {}).note = e.target.value;
          writeDraft();
        },
      });
      return h(
        "li",
        { onmouseenter: () => light(s.id), onmouseleave: () => light(null), onfocusin: () => light(s.id), onfocusout: () => light(null) },
        h("p", { class: "claim-line" }, h("span", { class: "claim-kind", text: s.kind }), " ", s.who),
        choice,
        note,
      );
    }),
  );
  const regestNote = h("textarea", {
    class: "regest-note",
    rows: 2,
    "aria-label": "Anmerkung zum Regest",
    placeholder: "Anmerkung zum Regest, etwa eine fehlende Aussage",
    oninput: (e) => {
      a.note = e.target.value;
      writeDraft();
    },
  });
  regestNote.value = a.note ?? "";
  main.replaceChildren(
    h("h2", { class: "sheet-title" }, item.identifier, h("span", { class: "sheet-date", text: item.date })),
    textEl,
    statements,
    regestNote,
    h(
      "p",
      { class: "sheet-nav" },
      h("button", { type: "button", disabled: at === 0, onclick: () => show(at - 1) }, "Vorheriges"),
      h("button", { type: "button", disabled: at === sheet.items.length - 1, onclick: () => show(at + 1) }, "Nächstes"),
      h("span", { class: "sheet-why", text: `Ausgewählt: ${item.reason}` }),
    ),
  );
  renderList();
  main.focus({ preventScroll: true });
  main.scrollTop = 0;
}

function result() {
  return {
    sheet: sheet.sheet,
    run: sheet.run,
    saved: new Date().toISOString(),
    items: sheet.items.map((item) => {
      const a = answerOf(item);
      return {
        uid: item.uid,
        identifier: item.identifier,
        note: a.note ?? "",
        statements: statementsOf(item).map((s) => ({ id: s.id, kind: s.kind, who: s.who, verdict: a.statements[s.id]?.verdict ?? null, note: a.statements[s.id]?.note ?? "" })),
      };
    }),
  };
}

async function save() {
  const text = JSON.stringify(result(), null, 1);
  const name = `${sheet.sheet}-ergebnis.json`;
  // The native save dialog where the browser has one; otherwise an ordinary download.
  if ("showSaveFilePicker" in window) {
    try {
      const handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: "JSON", accept: { "application/json": [".json"] } }] });
      const stream = await handle.createWritable();
      await stream.write(text);
      await stream.close();
      progress.textContent = `Gespeichert als ${handle.name}`;
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = h("a", { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function load(file) {
  try {
    const data = JSON.parse(await file.text());
    if (data.sheet !== sheet.sheet || !Array.isArray(data.items)) throw new Error("anderer Prüfbogen");
    const known = new Map(sheet.items.map((item) => [item.uid, item]));
    for (const entry of data.items) {
      const item = known.get(entry.uid);
      if (!item) continue;
      const a = answerOf(item);
      a.note = typeof entry.note === "string" ? entry.note : "";
      for (const s of entry.statements ?? []) {
        if (!statementsOf(item).some((x) => x.id === s.id)) continue;
        a.statements[s.id] = { verdict: VERDICTS.some(([v]) => v === s.verdict) ? s.verdict : undefined, note: typeof s.note === "string" ? s.note : "" };
      }
    }
    writeDraft();
    show(at);
    renderProgress();
  } catch (error) {
    progress.textContent = `Die Datei passt nicht zu diesem Prüfbogen (${error.message}).`;
  }
}

async function start() {
  try {
    const response = await fetch(new URL("./data/sheet.json", import.meta.url));
    if (!response.ok) throw new Error(String(response.status));
    sheet = await response.json();
  } catch {
    main.replaceChildren(h("p", { text: "Die Daten des Prüfbogens fehlen. build_review_sheet.py schreibt sie nach pruefbogen/data/sheet.json." }));
    return;
  }
  draftKey = `${sheet.sheet}-entwurf`;
  answers = readDraft();
  document.getElementById("save").addEventListener("click", save);
  const file = document.getElementById("file");
  document.getElementById("load").addEventListener("click", () => file.click());
  file.addEventListener("change", () => file.files[0] && load(file.files[0]));
  renderProgress();
  show(0);
}

start();
