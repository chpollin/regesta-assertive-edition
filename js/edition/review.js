/**
 * Review on the product, in the local review build only (build_site.py --review, never
 * published; publish_site.py refuses a build that carries the review marker). After the
 * operator's rule of 2026-11-12, no separate form: the regest page itself is checked. Under
 * the annotated card of each regest of the review sheet stands one verdict per statement,
 * numbered as in the text, and one note for what is missing; the Prüfliste page lists the
 * twenty regesta with their progress. Judgements live in browser storage as a draft and leave
 * as the result file pruefbogen-2026-11-12-ergebnis.json, which build_site.py reads into the
 * public build as „menschlich geprüft“ per statement.
 */

const VERDICTS = [
  ["stimmt", "stimmt"],
  ["falsch", "stimmt nicht"],
  ["unklar", "unklar"],
];
const NONE = "__keine__";

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

/** The review sheet and its draft, shared by the regest pages and the Prüfliste. */
export async function loadReview(root) {
  const marker = document.querySelector('meta[name="edition-review"]');
  if (!marker) return null;
  const response = await fetch(`${root}pruefung/sheet.json`);
  if (!response.ok) return null;
  const sheet = await response.json();
  const key = `${sheet.sheet}-entwurf`;
  let answers = {};
  try {
    answers = JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    answers = {};
  }
  const save = () => {
    try {
      localStorage.setItem(key, JSON.stringify(answers));
    } catch {
      // Without storage the page still works; only a reload loses the draft.
    }
  };
  const statementsOf = (item) => (item.statements.length ? item.statements : [{ id: NONE, kind: "Keine Aussage" }]);
  const answerOf = (item) => (answers[item.uid] ??= { note: "", statements: {} });
  const judged = (item) => statementsOf(item).filter((s) => answerOf(item).statements[s.id]?.verdict).length;
  return { sheet, answers, save, statementsOf, answerOf, judged, setAnswers: (a) => ((answers = a), save()) };
}

function resultOf(review) {
  const { sheet, statementsOf, answerOf } = review;
  return {
    sheet: sheet.sheet,
    run: sheet.run,
    saved: new Date().toISOString(),
    items: sheet.items.map((item) => ({
      uid: item.uid,
      identifier: item.identifier,
      note: answerOf(item).note ?? "",
      statements: statementsOf(item).map((s) => ({ id: s.id, kind: s.kind, verdict: answerOf(item).statements[s.id]?.verdict ?? null, note: answerOf(item).statements[s.id]?.note ?? "" })),
    })),
  };
}

/** Save and load buttons; the file is the result, the draft only survives a reload. */
function fileControls(review, onLoaded, status) {
  const name = `${review.sheet.sheet}-ergebnis.json`;
  const save = async () => {
    const text = JSON.stringify(resultOf(review), null, 1);
    if ("showSaveFilePicker" in window) {
      try {
        const handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: "JSON", accept: { "application/json": [".json"] } }] });
        const stream = await handle.createWritable();
        await stream.write(text);
        await stream.close();
        status.textContent = `Gespeichert als ${handle.name}`;
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
  };
  const file = h("input", { type: "file", accept: "application/json,.json", hidden: true });
  file.addEventListener("change", async () => {
    try {
      const data = JSON.parse(await file.files[0].text());
      if (data.sheet !== review.sheet.sheet || !Array.isArray(data.items)) throw new Error("anderer Prüfbogen");
      for (const entry of data.items) {
        const item = review.sheet.items.find((x) => x.uid === entry.uid);
        if (!item) continue;
        const a = review.answerOf(item);
        a.note = typeof entry.note === "string" ? entry.note : "";
        for (const s of entry.statements ?? []) {
          const verdict = s.verdict === "stimmt nicht" ? "falsch" : s.verdict;
          a.statements[s.id] = { verdict: VERDICTS.some(([v]) => v === verdict) ? verdict : undefined, note: typeof s.note === "string" ? s.note : "" };
        }
      }
      review.save();
      onLoaded();
    } catch (error) {
      status.textContent = `Die Datei passt nicht zu dieser Prüfung (${error.message}).`;
    }
  });
  return [h("button", { type: "button", onclick: save }, "Ergebnis speichern"), h("button", { type: "button", onclick: () => file.click() }, "Gespeichertes laden"), file];
}

/** The verdict form under the annotated card of one regest. */
export function mountReview(review, uid, card, numbers, root) {
  const index = review.sheet.items.findIndex((x) => x.uid === uid);
  if (index < 0) return;
  const item = review.sheet.items[index];
  const a = review.answerOf(item);
  const light = (id) => {
    for (const el of card.querySelectorAll(".ev")) el.classList.toggle("is-on", !!id && el.dataset.ids.split(" ").includes(id));
    for (const el of card.querySelectorAll(".ann-open, .ann-close")) el.classList.toggle("is-on", !!id && el.dataset.id === id);
  };
  const status = h("p", { class: "review-status", role: "status", "aria-live": "polite" });
  const next = review.sheet.items[index + 1];
  const rows = review.statementsOf(item).map((s) => {
    const saved = a.statements[s.id] ?? {};
    const label = s.id === NONE ? "Keine Aussage: stimmt das?" : `${s.kind} ${numbers.get(s.id) ?? ""}`.trim();
    return h(
      "li",
      { onmouseenter: () => light(s.id), onmouseleave: () => light(null), onfocusin: () => light(s.id), onfocusout: () => light(null) },
      h("span", { class: "review-kind", text: label }),
      h(
        "fieldset",
        { class: "review-verdict" },
        h("legend", { class: "visually-hidden", text: `Urteil zu ${label}` }),
        VERDICTS.map(([value, text]) =>
          h(
            "label",
            {},
            h("input", {
              type: "radio",
              name: `v-${uid}-${s.id}`,
              value,
              checked: saved.verdict === value,
              onchange: () => {
                (a.statements[s.id] ??= {}).verdict = value;
                review.save();
              },
            }),
            text,
          ),
        ),
      ),
      h("input", {
        type: "text",
        class: "review-note",
        value: saved.note ?? "",
        placeholder: "Anmerkung",
        "aria-label": `Anmerkung zu ${label}`,
        oninput: (e) => {
          (a.statements[s.id] ??= {}).note = e.target.value;
          review.save();
        },
      }),
    );
  });
  const note = h("textarea", {
    class: "review-note review-regest",
    rows: 2,
    placeholder: "Anmerkung zum Regest, etwa eine fehlende Aussage",
    "aria-label": "Anmerkung zum Regest",
    oninput: (e) => {
      a.note = e.target.value;
      review.save();
    },
  });
  note.value = a.note ?? "";
  const section = h(
    "section",
    { class: "review", "aria-label": "Prüfung dieses Regests" },
    h(
      "p",
      { class: "review-head" },
      h("a", { href: `${root}pruefung/` }, "Prüfliste"),
      ` Regest ${index + 1} von ${review.sheet.items.length}`,
      next ? h("a", { href: `${root}regesten/${next.slug}/` }, `Weiter mit ${next.identifier}`) : null,
    ),
    h("ol", { class: "review-rows" }, rows),
    note,
    h("p", { class: "review-files" }, ...fileControls(review, () => location.reload(), status)),
    status,
  );
  card.after(section);
}

/** The Prüfliste page: the twenty regesta with their progress, each leading to its page. */
export async function init(root) {
  const host = document.getElementById("review-list");
  const review = await loadReview(root);
  if (!host || !review) return;
  const render = () => {
    const all = review.sheet.items.reduce((n, item) => n + item.statements.length, 0);
    const done = review.sheet.items.reduce((n, item) => n + (item.statements.length ? review.judged(item) : 0), 0);
    const status = h("p", { class: "review-status", role: "status", "aria-live": "polite" });
    host.replaceChildren(
      h("p", { class: "review-progress", text: `${done} von ${all} Aussagen beurteilt` }),
      h(
        "ol",
        { class: "review-list" },
        review.sheet.items.map((item) => {
          const n = review.statementsOf(item).length;
          const j = review.judged(item);
          return h(
            "li",
            { "data-state": j === 0 ? "open" : j === n ? "done" : "begun" },
            h("a", { href: `${root}regesten/${item.slug}/` }, item.identifier),
            h("span", { class: "review-count", text: item.statements.length ? `${j} von ${n}` : j ? "geprüft" : "keine Aussage" }),
          );
        }),
      ),
      h("p", { class: "review-files" }, ...fileControls(review, render, status)),
      status,
    );
  };
  render();
}
