// The regest list of an entry: one line per regest, the detail opening under its line.

import { h, entryHref } from "./dom.js";
import { rowGroups, runOf, isApparatusOnly } from "./model.js";
import { findingText } from "./text.js";
import { VOCAB } from "./vocab.js";

const local = (term) => String(term || "").split(":").pop();
const de = (term) => VOCAB[local(term)] || local(term);

// Fields a record finding concerns, mapped to the part of the detail where it stands.
const AT = {
  summary: "text", witnesses: "witnesses",
  date_string: "head", start_date: "head", end_date: "head", locality_string: "head", title: "head", identifier: "head",
  exchange_identifier: "links", urn: "links",
};
const where = (f) => AT[(f.field || [])[0]] || "head";

const defect = (f) => h("p", { class: "defect" }, h("span", { class: "defect-word" }, "Exportfehler"), " ", findingText(f));

export function lineOf(item, selected, onSelect) {
  const rec = item.record;
  const id = `regest-${item.uid}`;
  const roles = item.roles.length ? item.roles.join(" ") : "ohne Rolle";
  const li = h("li", { class: `line-item${selected ? " is-open" : ""}`, id: `zeile-${item.uid}` },
    h("button", { type: "button", class: `line${isApparatusOnly(item.roles) ? " quiet" : ""}`, "aria-expanded": String(selected),
      "aria-controls": id, on: { click: () => onSelect(selected ? null : item.uid) } },
      h("span", { class: "c-date" }, rec.dating || ""),
      h("span", { class: "c-place" }, rec.place || "ohne Ort"),
      h("span", { class: "c-id" }, rec.identifier),
      h("span", { class: "c-rolecell" },
        h("span", { class: "c-roles" }, roles),
        h("span", { class: "c-comment" }, item.comments.join("; ")))));
  if (selected) li.append(h("div", { class: "detail", id, role: "region", "aria-label": `${rec.identifier}, Regest` },
    h("p", { class: "loading" }, "Das Regest wird geladen.")));
  return li;
}

function rowLine(row, self, uid) {
  const e = row.entry || {};
  const roles = (row.roles || []).join(" ") || "ohne Rolle";
  const name = e.identifier === self
    ? h("span", { class: "r-name is-self", "aria-current": "page" }, e.shortLabel)
    : h("a", { class: "r-name", href: entryHref(e.identifier, uid) }, e.shortLabel || e.identifier);
  return h("li", { class: `row${(row.roles || []).includes("zeuge") ? " is-witness" : ""}` },
    name, h("span", { class: "r-roles" }, roles), row.comment ? h("span", { class: "r-comment" }, row.comment) : null,
    ...(row.findings || []).map((f) => h("span", { class: "defect inline" }, h("span", { class: "defect-word" }, "Exportfehler"), " ", findingText(f))));
}

function witnessNote(record) {
  const zeugen = (record.rows || []).filter((r) => (r.roles || []).includes("zeuge")).map((r) => r.entry?.shortLabel);
  const list = zeugen.join(", ");
  if (record.witnesses) {
    return zeugen.length
      ? `Das Register führt davon nur ${list} mit zeuge.`
      : "Das Register führt hier niemanden mit zeuge.";
  }
  return zeugen.length ? `Das Regest hat keine Zeugenliste; das Register führt ${list} mit zeuge.` : null;
}

function statements(record) {
  const graph = record.proposals?.["@graph"] || [];
  const facts = graph.filter((n) => n.factoidType);
  if (!record.proposals) return h("p", { class: "llm-none" }, "Kein LLM-Lauf hat dieses Regest gelesen.");
  const run = runOf(record.proposals);
  if (!facts.length) return h("p", { class: "llm-none" }, `Der LLM-Lauf ${run} hat zu diesem Regest keine Aussage gemacht.`);
  return h("section", { class: "llm", "aria-labelledby": `llm-${record.id}` },
    h("h2", { id: `llm-${record.id}` }, `Aussagen des LLM-Laufs ${run}, ungeprüft`),
    h("ol", { class: "facts" }, facts.map((f) => h("li", { class: "fact" },
      h("span", { class: "f-kind" }, de(f.factoidType)),
      h("span", { class: "f-refs" }, (f.references || []).map((r, i) => {
        const id = /^urn:regesta:actor:(RI\d{3}-\d{3}-[A-Z]\d{6})$/.exec(r.actor || "")?.[1];
        const name = r.nameInSource || "ohne Namen im Text";
        return h("span", { class: "f-ref" }, i ? "; " : "", `${de(r.role)}: `,
          id ? h("a", { href: entryHref(id, record.id.split(":").pop()) }, name) : name);
      })),
      (f.evidence || []).map((ev) => h("q", { class: "f-evidence" }, ev.exact))))));
}

export function fillDetail(host, record, entry) {
  const uid = String(record.id).split(":").pop();
  const self = entry.identifier;
  const fs = record.findings || [];
  const at = (part) => fs.filter((f) => where(f) === part).map(defect);
  const { text, apparatus } = rowGroups(record);
  const note = witnessNote(record);
  const links = [];
  for (const url of record.seeAlso || []) {
    if (url.startsWith("https://www.regesta-imperii.de/id/")) links.push(h("a", { href: url, rel: "external" }, "Regesta Imperii"));
    else if (url.includes("mgh.de/dmgh/")) links.push(h("a", { href: url, rel: "external" }, "MGH-Edition"));
  }
  host.replaceChildren(...[
    ...at("head"),
    h("p", { class: "summary" }, record.summary || ""),
    ...at("text"),
    h("section", { class: "rows", "aria-labelledby": `t-${uid}` },
      h("h2", { id: `t-${uid}` }, "Im Text oder Rechtsakt genannt"),
      h("ul", {}, text.map((r) => rowLine(r, self, uid)))),
    apparatus.length ? h("section", { class: "rows quiet", "aria-labelledby": `a-${uid}` },
      h("h2", { id: `a-${uid}` }, "Nur in Kommentar oder Überlieferung genannt"),
      h("ul", {}, apparatus.map((r) => rowLine(r, self, uid)))) : null,
    record.witnesses || note ? h("section", { class: "witnesses", "aria-labelledby": `z-${uid}` },
      h("h2", { id: `z-${uid}` }, "Zeugen"),
      record.witnesses ? h("p", { class: "source" }, record.witnesses) : null,
      note ? h("p", { class: "note" }, note) : null,
      ...at("witnesses")) : null,
    statements(record),
    h("p", { class: "links" }, links.length ? links.flatMap((a, i) => (i ? [" ", a] : [a])) : "Keine Verknüpfung zu Regesta Imperii geliefert.", ...at("links")),
    h("p", { class: "evidence" }, `record/${uid}.jsonld  ${record.id}  ${entry.identifier}`),
  ].filter(Boolean));
}

export function failDetail(host) {
  host.replaceChildren(h("p", { class: "load-error" }, "Dieses Regest konnte nicht geladen werden. Bitte die Seite neu laden."));
}
