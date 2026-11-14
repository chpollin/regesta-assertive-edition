# /// script
# requires-python = ">=3.11"
# dependencies = ["rdflib==7.6.0", "numpy", "lxml"]
# ///
"""Build the curated static site of the public edition from one factoid run.

Regime: single-file script with inline dependencies. It calls build_data.py (once per stage)
and build_tei.py as subprocesses, so each of the three scripts stays runnable on its own and
none imports another; this script only reads their output. It writes nothing outside --out
and never into the source repository. The output folder is gitignored and never committed.

Data flow
    build_data.py --stage revised     -> <out>/ansicht/data/edition.json (shown stage)
    build_data.py --stage extracted   -> temporary folder (comparison only)
    build_tei.py                      -> <out>/tei/<slug>.xml, checked against tei_all
    runs/<run>/<stage>/<uid>.ttl      -> <out>/ttl/<slug>.ttl with a licence header
    source CSVs                       -> persistent identifier, original dating, literature,
                                         footnotes, register entries
    edition/texts.json, js/nav.json   -> title, definition, licence, navigation
        -> <out>/index.html, regesten/, regesten/<slug>/, personen/, personen/<id>/,
           methode/, daten/, ueber/, json/, daten/<package>.zip, ansicht/ (the views app)

Usage
    python build_site.py
    python build_site.py --run factoid-1153-2026-11-11 --out site

Design decisions
- Content pages are pre-rendered HTML, readable without JavaScript. Scripts only enhance:
  the evidence underline on pointing, the embedded views, the RI-number jump, the name
  filter and the back link of the `zurueck` parameter.
- All page text that names title, subtitle, definition or licence comes from
  edition/texts.json; the navigation comes from js/nav.json, shared with the views app.
- knowledge/ is never copied. Third-party images from external_links are linked only.
- Output is deterministic for the same inputs: no build timestamps, sorted iteration, a
  fixed date in the zip package.
"""

from __future__ import annotations

import argparse
import csv
import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
import zipfile
from collections import defaultdict
from itertools import pairwise
from pathlib import Path
from urllib.parse import quote

HERE = Path(__file__).resolve().parent
TAG_RE = re.compile(r"<[^>]+>")
LINK_RE = re.compile(r"<link\s+(\S+)[^>]*>(.*?)</link>", re.S)
ZIP_DATE = (2026, 1, 1, 0, 0, 0)
MARKER = ".edition-build"
CURRENT = ' aria-current="page"'
# Every file this build writes, so a rebuild removes exactly the files of the previous build
# it no longer produces. The house rule forbids recursive deletes inside repositories.
WRITTEN: set[Path] = set()
STEP_PRODUCERS = ("deterministischer Workflow", "unrevidierter LLM-basierter Agent", "menschlich verifiziert")
# The agent review of twenty regesta (knowledge/data.md, Agent review): two LLM-based readers
# per statement. It is agentic review, never a human verdict, and is shown only in the local
# preview build (--preview, site-preview/) until the operator decides on publication; the
# preview marks its pages with PREVIEW_META, and publish_site.py refuses them.
AGENT_REVIEW = HERE / "edition" / "agent-review-2026-11-14.json"
PREVIEW_META = '<meta name="edition-preview" content="agent-review-2026-11-14">'


class BuildError(Exception):
    """A violated input contract; the message names the step."""


def esc(text: object) -> str:
    return html.escape(str(text), quote=True)


def slug(identifier: str) -> str:
    """Same rule as build_tei.slug; the build checks that each TEI file exists under it."""
    # Forgeries carry a dagger ("n. †4"); written as "f" in the address, as in build_tei.
    match = re.fullmatch(r"RI ([IVXLC]+),(\d+),(\d+) n\. ([\w†]+)", identifier)
    if not match:
        raise BuildError(f"identifier without the RI pattern: {identifier}")
    return "-".join(match.groups()).replace("†", "f").lower()


def person_slug(iri: str) -> str:
    """Address of an actor page from its IRI: register id or regest-local name, lower case."""
    rest = iri.removeprefix("urn:regesta:actor:")
    return re.sub(r"[^a-z0-9-]+", "-", rest.lower()).strip("-")


def plain(raw: str | None) -> str | None:
    """CSV markup as plain text; the delivery writes a missing value as the string null."""
    if raw is None or raw.strip() in ("", "null"):
        return None
    return re.sub(r"\s+", " ", html.unescape(TAG_RE.sub("", raw))).strip()


def _run(args: list[str]) -> None:
    # The children print German text; on Windows their default stdout encoding is the ANSI code
    # page, so they run in UTF-8 mode to match the decoding here.
    env = {**os.environ, "PYTHONUTF8": "1"}
    result = subprocess.run(
        [sys.executable, *args], cwd=HERE, capture_output=True, text=True, encoding="utf-8", env=env
    )
    if result.returncode != 0:
        raise BuildError(f"{args[0]} failed:\n{result.stderr.strip()}")


def _load(path: Path) -> dict:
    if not path.is_file():
        raise BuildError(f"missing input file {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def _write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")
    WRITTEN.add(path.resolve())


def _copy(src: str | Path, dst: str | Path) -> None:
    Path(dst).parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dst)
    WRITTEN.add(Path(dst).resolve())


def _copytree(src: Path, dst: Path, ignore: object = None) -> None:
    shutil.copytree(src, dst, dirs_exist_ok=True, ignore=ignore, copy_function=_copy)


# Page frame


class Site:
    """Run-wide inputs every page needs; built once, read by the page functions."""

    def __init__(
        self, source: Path, run_id: str, out: Path, edition: dict, extracted: dict, preview: bool = False
    ) -> None:
        self.preview = preview
        self.source = source
        self.run_id = run_id
        self.out = out
        self.texts = _load(HERE / "edition" / "texts.json")
        self.nav = _load(HERE / "js" / "nav.json")["items"]
        self.manifest = _load(source / "runs" / run_id / "manifest.json")
        self.edition = edition
        self.extracted = {r["uid"]: r for r in extracted["regests"]}
        self.regests = edition["regests"]
        self.by_uid = {r["uid"]: r for r in self.regests}
        self.slugs = {r["uid"]: slug(r["identifier"]) for r in self.regests}
        self.rows = self._rows()
        self.register = self._register()
        graph = edition["graph"]
        self.nodes = {n["id"]: n for n in graph["nodes"]}
        self.actors = [n for n in graph["nodes"] if n["kind"] != "act"]
        self.pslugs = {n["id"]: person_slug(n["id"]) for n in self.actors}
        if len(set(self.pslugs.values())) != len(self.pslugs):
            raise BuildError("two actors share a page address")
        self.case = self._case()
        self.shell_css = "css/shell.css" if (HERE / "css" / "shell.css").is_file() else "css/shell-interim.css"

    def _rows(self) -> dict[str, dict]:
        path = self.source / "source-material" / "RI_004-002-ReggBarbarossa.csv"
        with path.open(encoding="utf-8-sig", newline="") as fh:
            rows = {r["uid"]: r for r in csv.DictReader(fh) if r["uid"] in self.by_uid}
        if rows.keys() != self.by_uid.keys():
            raise BuildError("regest CSV does not cover every regest of the run")
        return rows

    def _register(self) -> dict[str, dict]:
        """First register row per entry id, for the entries the actors of the run use."""
        wanted = {
            m.group(1) for n in self.edition["graph"]["nodes"] if (m := re.search(r"actor:(RI[\w-]+?)(?::|$)", n["id"]))
        }
        path = self.source / "source-material" / "RI_004-002-RegisterBarbarossa.csv"
        out: dict[str, dict] = {}
        with path.open(encoding="utf-8-sig", newline="") as fh:
            for row in csv.DictReader(fh):
                if row["id"] in wanted and row["id"] not in out:
                    out[row["id"]] = row
        return out

    def _case(self) -> dict | None:
        """The child and the two same-name parents, from the same-name edge of the graph."""
        edges = self.edition["graph"]["edges"]
        pair = next((e for e in edges if e["kind"] == "same-name"), None)
        if pair is None:
            return None
        parents = [pair["source"], pair["target"]]
        child = next((e["source"] for e in edges if e["kind"] == "parent" and e["target"] in parents), None)
        if child is None:
            return None
        regests = sorted({self.nodes[p]["case"]["regest"] for p in parents}, key=lambda u: self.by_uid[u]["sort"])
        return {"child": child, "parents": parents, "regests": regests}

    def regest_href(self, root: str, uid: str, claim: str | None = None) -> str:
        return f"{root}regesten/{self.slugs[uid]}/" + (f"#f-{claim}" if claim else "")

    def view_switch(self, key: str, root: str) -> str:
        """The switch between the representations of the object a page belongs to."""
        item = next((it for it in self.nav if any(v["key"] == key for v in it.get("views", []))), None)
        if not item:
            return ""
        links = "".join(
            f'<a href="{root}{esc(v["href"])}"{CURRENT if v["key"] == key else ""}>{esc(v["label"])}</a>'
            for v in item["views"]
        )
        return f'<nav class="view-switch" aria-label="Darstellung der {esc(item["label"])}">{links}</nav>'

    def page(
        self,
        *,
        path: str,
        key: str,
        kind: str,
        title: str,
        main: str,
        views: bool = False,
        description: str | None = None,
    ) -> None:
        """Write one page in the shared frame: header from nav.json, main, footer licence line."""
        root = "../" * (len(path.split("/")) if path else 0)
        current = ' aria-current="page"'
        # A page belongs to an object of the navigation either directly or as one of its
        # representations (the person list is the Personen object's „Liste“).
        owner = next((it["key"] for it in self.nav if any(v["key"] == key for v in it.get("views", []))), key)
        nav = "".join(
            f'<a href="{root}{esc(item["href"])}"{current if item["key"] == owner else ""}>{esc(item["label"])}</a>'
            for item in self.nav
        )
        css = [f"{root}css/tokens.css", f"{root}{self.shell_css}"]
        if views:
            css += [f"{root}ansicht/css/app.css", f"{root}ansicht/css/space.css"]
        css.append(f"{root}css/pages.css")
        links = "\n".join(f'  <link rel="stylesheet" href="{href}">' for href in css)
        full_title = title if key == "start" else f"{title} | {self.texts['title']}"
        meta = f'  <meta name="description" content="{esc(description)}">\n' if description else ""
        if self.preview:
            meta += f"  {PREVIEW_META}\n"
        footer = (
            f'<footer class="site-footer"><p>{esc(self.texts["licenceLine"])}</p>'
            f'<a href="{root}ueber/">Über die Edition</a></footer>'
        )
        doc = f"""<!doctype html>
<html lang="de" class="no-js" data-root="{root}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{esc(full_title)}</title>
{meta}{links}
  <script type="module" src="{root}js/edition/page.js"></script>
</head>
<body data-page="{kind}" data-layout="page">
<a class="skip" href="#main">Zum Inhalt</a>
<header class="site-header"><a class="site-title" href="{root or "./"}">{esc(self.texts["title"])} <span class="site-tag">{esc(self.texts["tag"])}</span></a><nav class="site-nav" aria-label="Edition">{nav}</nav></header>
<div class="site-body"><main class="site-main" id="main">
{main}
</main></div>
{footer}
</body>
</html>
"""
        _write(self.out / path / "index.html", doc)


# Shared fragments


def segments_html(segments: list[dict], site: Site, root: str) -> str:
    """Markup segments of edition.json as HTML; a regest link becomes a page link inside the run."""
    out = []
    for seg in segments:
        text = esc(seg["t"])
        if seg.get("regest") in site.by_uid:
            text = f'<a href="{site.regest_href(root, seg["regest"])}">{text}</a>'
        elif seg.get("href", "").startswith(("http://", "https://")):
            text = f'<a href="{esc(seg["href"])}" rel="noopener">{text}</a>'
        if seg.get("i"):
            text = f"<i>{text}</i>"
        if seg.get("sup"):
            text = f"<sup>{text}</sup>"
        out.append(text)
    return "".join(out)


def ri_uri(site: Site, uid: str) -> str:
    return f"{site.texts['source']['idPattern']}{site.rows[uid]['persistent_identifier']}"


def sentence_text(block: dict) -> str:
    return "".join(p if isinstance(p, str) else p["text"] for p in block["sentence"])


def evidence_ids(block: dict) -> list[str]:
    """Span ids a factoid rests on: its selectors and its located exact-wording literals."""
    ids = []
    for line in [block["head"], *block["lines"]]:
        if line.get("id") and line.get("evidence") and line["id"] not in ids:
            ids.append(line["id"])
    return ids


def marked_text(regest: dict) -> str:
    """The regest text cut at every evidence boundary; each piece names the spans covering it."""
    text, spans = regest["text"], regest["spans"]
    cuts = sorted({0, len(text), *(s["start"] for s in spans), *(s["end"] for s in spans)})
    out = []
    for start, end in pairwise(cuts):
        ids = [s["id"] for s in spans if s["start"] <= start and end <= s["end"]]
        piece = esc(text[start:end])
        out.append(f'<span class="ev" data-ev="{esc(" ".join(ids))}">{piece}</span>' if ids else piece)
    return "".join(out)


# Pages


EXAMPLE = "RI IV,2,2 n. 103a"


def start_page(site: Site) -> None:
    """Title, the confirmed definition, the linked overview of time, places and persons, the
    worked case n. 103a and the jump by RI number (operator's rule 42 of 2026-11-14)."""
    t = site.texts
    fallback = (
        '<p class="figure-fallback">Hier stehen Orte, Personen und Jahre der Lieferung als Raum-Zeit-Würfel. '
        'Die Übersicht braucht JavaScript, die <a href="regesten/">Liste der Regesten</a> nicht.</p>'
    )
    # The start page is the figure, one window high (operator, 2026-11-14: „Man soll nicht
    # runterscrollen können“); the worked case is one entry in the sidebar's head.
    example = next((r for r in site.regests if r["identifier"] == EXAMPLE), None)
    example_link = (
        f'<a class="start-example" href="regesten/{site.slugs[example["uid"]]}/">Beispiel {esc(EXAMPLE)}</a>'
        if example
        else ""
    )
    # The header already shows the title; the h1 stays for screen readers, and the subtitle
    # opens the one sentence of description (measured subtractive pass of 2026-11-11).
    main = f"""<h1 class="visually-hidden">{esc(t["title"])}. {esc(t["subtitle"])}</h1>
<div class="start-head"><p class="start-lede">{esc(t["subtitle"])}. <a href="ueber/">Über die Edition</a></p>{example_link}
<form class="jump" id="jump" hidden><label for="jump-n" class="visually-hidden">Regest nach RI-Nummer</label><input id="jump-n" name="n" inputmode="text" autocomplete="off" placeholder="RI-Nummer, z. B. 46" size="14"> <button type="submit">Öffnen</button> <span class="jump-msg" role="status"></span></form></div>
<div class="figure" id="figure">{fallback}</div>"""
    site.page(path="", key="start", kind="start", title=t["title"], main=main, views=True, description=t["description"])


def status_marks(regest: dict) -> str:
    marks = []
    if regest["claims"] == 0:
        marks.append("ohne Aussage")
    if regest["notes"].get("corrected"):
        marks.append("nach Review korrigiert")
    if not regest["technical"]:
        marks.append("technisch nicht bestanden")
    return ", ".join(marks)


def _families() -> tuple[dict[str, str], list[tuple[str, str, str, str]]]:
    """The eight relation families of js/relations.js, the one definition shared with the views:
    act type -> family key, and per family key, short word, full label and sign path."""
    src = (HERE / "js" / "relations.js").read_text(encoding="utf-8")
    fams = re.findall(r'key: "(\w+)", short: "([^"]+)", label: "([^"]+)".*?types: \[([^\]]*)\]', src)
    icons = dict(re.findall(r'^\s+(\w+): "(M[^"]+)",$', src, re.M))
    if len(fams) != 8 or set(icons) != {f[0] for f in fams}:
        raise BuildError("js/relations.js: eight families with a sign each expected")
    by_type = {t: key for key, _, _, types in fams for t in re.findall(r'"([^"]+)"', types)}
    return by_type, [(key, short, label, icons[key]) for key, short, label, _ in fams]


FAMILY_OF, FAMILIES = _families()


def family_sign(key: str) -> str:
    """The family's sign as inline SVG, as js/relations.js draws it in the views."""
    path = next(p for k, _, _, p in FAMILIES if k == key)
    return (
        '<svg class="fam-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" '
        f'stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="{path}"/></svg>'
    )


def family_cell(keys: set[str]) -> str:
    """The signs of a row's families in the families' fixed order, with their names for screen readers."""
    ordered = [(k, label) for k, _, label, _ in FAMILIES if k in keys]
    signs = "".join(family_sign(k) for k, _ in ordered)
    names = ", ".join(label for _, label in ordered)
    return f'<span class="fams">{signs}</span><span class="visually-hidden">{esc(names)}</span>' if ordered else ""


def list_filter(placeholder: str) -> str:
    """Search field and one switch per relation family above a list; js/edition/listfilter.js
    shows and drives it, so without JavaScript the full list stands without dead controls.
    The switches carry sign and word, so they are the legend of the signs in the rows."""
    toggles = "".join(
        f'<button type="button" class="fam-toggle" aria-pressed="false" data-f="{k}">'
        f"{family_sign(k)}<span>{esc(label)}</span></button>"
        for k, _, label, _ in FAMILIES
    )
    return (
        f'<div class="list-filter" hidden><input type="search" class="list-q" aria-label="{esc(placeholder)}" '
        f'placeholder="{esc(placeholder)}" autocomplete="off">'
        f'<span class="fam-toggles" role="group" aria-label="Art der Aussage">{toggles}</span>'
        '<span class="filter-count" role="status"></span></div>'
    )


def regest_list_page(site: Site) -> None:
    rows = []
    for r in site.regests:
        date = segments_html(r["date"], site, "../") or '<span class="missing">ohne Datierung</span>'
        place = segments_html(r["place"], site, "../") if r["place"] and r["place"][0]["t"] != "null" else ""
        fams = {FAMILY_OF.get(b["title"], "order") for b in r["blocks"]}
        marks = status_marks(r)
        q = re.sub(r"[^a-z0-9 ]", "", _fold(" ".join([r["identifier"], r["text"] or ""])))
        rows.append(
            f'<tr data-q="{esc(q)}" data-f="{" ".join(sorted(fams))}"><th scope="row"><a href="{site.slugs[r["uid"]]}/">{esc(r["identifier"])}</a></th>'
            f"<td>{date}</td><td>{place or '<span class=missing>ohne Ort</span>'}</td>"
            f"<td>{family_cell(fams)}{f'<span class=mark>{esc(marks)}</span>' if marks else ''}</td></tr>"
        )
    main = f"""<h1 class="visually-hidden">Regesten</h1>
{list_filter("Regesttext oder Nummer")}
<div class="table-wrap"><table class="list regests">
<thead><tr><th scope="col">Regest</th><th scope="col">Datierung</th><th scope="col">Ort</th><th scope="col">Aussagen</th></tr></thead>
<tbody>
{chr(10).join(rows)}
</tbody></table></div>"""
    site.page(path="regesten", key="regesten", kind="regesten", title="Regesten", main=main)


def factoid_html(site: Site, regest: dict, block: dict, before: dict | None, root: str) -> str:
    """One factoid: its sentence, the wording it rests on, literals, case note, earlier stage."""
    claim = block["head"]["id"]
    ids = evidence_ids(block)
    parts = []
    for p in block["sentence"]:
        if isinstance(p, str):
            parts.append(esc(p))
        elif p is block["sentence"][0]:
            parts.append(f'<span class="act-type">{esc(p["text"])}</span>')
        else:
            parts.append(esc(p["text"]))
    text = regest["text"]
    quotes = []
    for line in [block["head"], *block["lines"]]:
        if line.get("rel") in ("type", "evidence") and line.get("evidence"):
            ev = line["evidence"]
            quotes.append(f"„{esc(text[ev['start'] : ev['end']])}“")
    extra = []
    for line in block["lines"]:
        if line["kind"] == "literal":
            wording = f"„{esc(line['text'])}“" if line.get("verbatim") else esc(line["text"])
            extra.append(f'<p class="lit"><span class="run-in">{esc(line["label"])}</span> {wording}</p>')
        for ref in line.get("crossrefs", []):
            other = ref["other"]
            reg = other.get("register") or {}
            extra.append(
                f'<p class="case-note">Gleicher Name in <a href="{site.regest_href(root, other["regest"], other["claim"])}">'
                f"{esc(site.by_uid[other['regest']]['identifier'])}</a>, dort „{esc(other['name'])}“"
                + (f", Registereintrag „{esc(plain(reg.get('label')))}“" if reg.get("label") else "")
                + ". Ob es dieselbe Person ist, entscheidet die Fachprüfung.</p>"
            )
    if before is not None and sentence_text(before) != sentence_text(block):
        extra.append(
            f'<p class="before"><span class="run-in">Vor der Korrektur</span> {esc(sentence_text(before))}</p>'
        )
    elif before is None and regest["uid"] in site.extracted and regest["notes"].get("corrected"):
        extra.append('<p class="before">Nach dem Review hinzugekommen.</p>')
    return (
        f'<li class="factoid" id="f-{esc(claim)}" data-ev="{esc(" ".join(ids))}">'
        f'<p class="sentence">{"".join(parts)}</p>'
        f'<p class="evq">{" … ".join(quotes)}</p>{"".join(extra)}</li>'
    )


def history_html(regest: dict) -> str:
    h, notes = regest["history"], regest["notes"]
    items = []
    for f in h["findings"]:
        items.append(f'<li lang="en"><span class="run-in" lang="de">Befund</span> {esc(f["description"])}</li>')
    for d in h["decisions"]:
        items.append(
            f'<li><span class="run-in">Abwägung, {esc(d["decision"])}</span> <span lang="en">{esc(d["reason"])}</span></li>'
        )
    for c in notes["corrections"]:
        items.append(f'<li><span class="run-in">Korrektur</span> <span lang="en">{esc(c["text"])}</span></li>')
    for g in notes["gaps"]:
        items.append(
            f'<li><span class="run-in">Lücke im Modell, {esc(g["stage"])}</span> <span lang="en">{esc(g["text"])}</span></li>'
        )
    for u in notes["unresolved"]:
        items.append(f'<li><span class="run-in">Offene Identität</span> <span lang="en">{esc(u["text"])}</span></li>')
    if not items:
        return ""
    return (
        '<details class="history"><summary>Prüfverlauf der LLM-basierten Agenten</summary>'
        f'<ul role="list">{"".join(items)}</ul></details>'
    )


def regest_page(site: Site, index: int) -> None:
    r = site.regests[index]
    uid, s = r["uid"], site.slugs[r["uid"]]
    root = "../../"
    row = site.rows[uid]

    # Paging as two arrows in the head line of the card (operator, 2026-11-14: the line
    # „Nächstes, …“ above the regest „so überhaupt nicht gut“); the name is the accessible label.
    def pager_link(i: int, rel: str, word: str, sign: str) -> str:
        other = site.regests[i]
        label = f"{word} Regest, {other['short']}"
        return f'<a href="../{site.slugs[other["uid"]]}/" rel="{rel}" aria-label="{esc(label)}" title="{esc(label)}">{sign}</a>'

    prev_link = pager_link(index - 1, "prev", "Vorheriges", "←") if index else ""
    next_link = pager_link(index + 1, "next", "Nächstes", "→") if index + 1 < len(site.regests) else ""
    date = segments_html(r["date"], site, root) or '<span class="missing">ohne Datierung</span>'
    place = segments_html(r["place"], site, root) if r["place"] and r["place"][0]["t"] != "null" else ""
    fields = []
    original = plain(row.get("original_date"))
    if original:
        fields.append(f'<p><span class="run-in">Originaldatierung</span> {esc(original)}</p>')
    if r["apparatus"]["transmission"]:
        fields.append(
            f'<p><span class="run-in">Überlieferung</span> {segments_html(r["apparatus"]["transmission"], site, root)}</p>'
        )
    literature = plain(row.get("literature"))
    if literature:
        fields.append(f'<p><span class="run-in">Literatur</span> {esc(literature)}</p>')
    if r["apparatus"]["commentary"]:
        fields.append(
            f'<p><span class="run-in">Kommentar</span> {segments_html(r["apparatus"]["commentary"], site, root)}</p>'
        )
    footnotes = plain(row.get("footnotes"))
    if footnotes:
        fields.append(f'<p><span class="run-in">Anmerkungen</span> {esc(footnotes)}</p>')
    uri = ri_uri(site, uid)
    book = "".join(
        f'<li><a href="{esc(target)}" rel="noopener">{esc(plain(label))}</a> (Bayerische Staatsbibliothek, extern)</li>'
        if "bsb" in target or "mdz" in target
        else f'<li><a href="{esc(target)}" rel="noopener">{esc(plain(label))}</a> (extern)</li>'
        for target, label in LINK_RE.findall(row.get("external_links") or "")
    )
    t = site.texts
    citation_ri = f"{r['identifier']}, in: Regesta Imperii Online, URI: {uri}, CC BY 4.0, bearbeitet."
    citation_ed = (
        f"{t['title']}. {t['subtitle']}, {r['identifier']}, Fassung {t['release']['version']} "
        f"vom {t['release']['date']}, Aussagen aus dem Lauf {site.run_id}."
    )

    ext = site.extracted.get(uid)
    before_by_node = {b["node"]: b for b in ext["blocks"]} if ext else {}
    factoids = [factoid_html(site, r, b, before_by_node.get(b["node"]), root) for b in r["blocks"]]
    removed = [b for n, b in before_by_node.items() if n not in {x["node"] for x in r["blocks"]}]
    if removed:
        factoids.append(
            '<li class="factoid removed"><p class="before"><span class="run-in">Vor der Korrektur außerdem</span> '
            + " ".join(esc(sentence_text(b)) for b in removed)
            + "</p></li>"
        )
    if r["claims"]:
        state = "Diese Aussagen hat ein LLM-basierter Agent aus dem Regesttext erzeugt. "
        state += "Sie sind technisch geprüft" if r["technical"] else "Sie haben die technische Prüfung nicht bestanden"
        state += " und fachlich nicht geprüft."
        if r["notes"].get("corrected"):
            state += " Nach zwei Reviews wurden sie korrigiert, der frühere Stand steht bei der geänderten Aussage."
        elif ext:
            state += " Der extrahierte Stand vor den Reviews ist mit diesem gleich."
        statements = f'<p class="review-state">{state}</p><ol class="factoid-list" role="list">{"".join(factoids)}</ol>'
    else:
        statements = '<p class="review-state">Der LLM-basierte Agent hat aus diesem Regest keine Aussage im Rahmen des Modells gewonnen.</p>'

    # Without JavaScript the files stand in the static reading; the card puts them in its head.
    downloads = (
        f'<p class="paper-meta"><a href="{root}tei/{s}.xml" download>TEI</a> '
        f'<a href="{root}ttl/{s}.ttl" download>Turtle</a> <a href="{root}json/{s}.json" download>JSON</a></p>'
    )
    # The page shows the shared regest card of the views app (js/regest-card.js), rendered by
    # js/edition/regest.js into #card. The static content of #card is the reading without
    # JavaScript; citation and downloads stand below it in both cases.
    main = f"""<div class="title-row"><h1 class="visually-hidden">{esc(r["identifier"])}</h1><nav class="pager" aria-label="Blättern">{prev_link}{next_link}<span class="back-slot"></span></nav></div>
<div class="card-host" id="card" data-uid="{esc(uid)}" data-slug="{esc(s)}">
<p class="paper-meta"><span>{esc(r["identifier"])}</span><span>{date}</span>{f"<span>{place}</span>" if place else ""}</p>
{downloads}
<p class="regest-text">{marked_text(r)}</p>
<h2>Aussagen</h2>
{statements}
<div class="fields">{"".join(fields)}</div>
{history_html(r)}
</div>
<div class="cite">{f'<ul class="ext" role="list">{book}</ul>' if book else ""}
<p><span class="run-in">Zitierweise des Regests</span> {esc(citation_ri)}</p>
<p><span class="run-in">Zitierweise dieser Edition</span> {esc(citation_ed)}</p></div>"""
    site.page(
        path=f"regesten/{s}",
        key="regesten",
        kind="regest",
        title=r["identifier"],
        main=main,
        description=r["lead"],
    )


def _sort_key(label: str) -> str:
    """Sort a source name form by its first capitalised word, so "des Abtes" files under A."""
    words = label.split()
    for i, w in enumerate(words):
        if w[:1].isupper():
            return " ".join(words[i:]).casefold()
    return label.casefold()


def _roles(site: Site) -> dict[str, list[dict]]:
    """Every relation of an actor: role edges from acts and parent edges, in edition order."""
    out: dict[str, list[dict]] = defaultdict(list)
    for e in site.edition["graph"]["edges"]:
        if e["kind"] == "role":
            act = site.nodes[e["source"]]
            out[e["target"]].append(
                {"role": e["label"], "act": act["label"], "regest": e["regest"], "claim": e["claim"]}
            )
        elif e["kind"] == "parent":
            out[e["source"]].append({"role": "Kind", "act": "Elternschaft", "regest": e["regest"], "claim": e["claim"]})
            out[e["target"]].append(
                {"role": "Elternteil", "act": "Elternschaft", "regest": e["regest"], "claim": e["claim"]}
            )
    for rels in out.values():
        rels.sort(key=lambda x: (site.by_uid[x["regest"]]["sort"], x["claim"], x["role"]))
    return out


def _register_id(iri: str) -> str | None:
    m = re.search(r"actor:(RI\d{3}-\d{3}-[A-Z]\d{6})$", iri)
    return m.group(1) if m else None


def persons_pages(site: Site) -> None:
    roles = _roles(site)
    # Persons with a register entry first, the most often named on top; actors the agents
    # named only by the regest's wording („den Fürsten“) follow as a group of their own,
    # each with its regest, since the same words stand for different people.
    registered = sorted(
        (n for n in site.actors if not n["local"]), key=lambda n: (-len(n["regests"]), _sort_key(n["label"]))
    )
    local = sorted((n for n in site.actors if n["local"]), key=lambda n: (_sort_key(n["label"]), n["id"]))
    groups = []
    for title, nodes in (("Im Register der Regesta Imperii", registered), ("Nur im Wortlaut eines Regests", local)):
        rows = []
        for n in nodes:
            rels = roles.get(n["id"], [])
            fams = {"kin" if x["act"] == "Elternschaft" else FAMILY_OF.get(x["act"], "order") for x in rels}
            where = (
                f' <span class="mark">{esc(site.by_uid[n["regests"][0]]["identifier"])}</span>'
                if n["local"] and n["regests"]
                else ""
            )
            q = re.sub(r"[^a-z0-9 ]", "", _fold(" ".join([n["label"], *(lb["label"] for lb in n["labels"])])))
            rows.append(
                f'<tr data-q="{esc(q)}" data-f="{" ".join(sorted(fams))}"><th scope="row"><a href="{site.pslugs[n["id"]]}/">{esc(n["label"])}</a>{where}</th>'
                f'<td>{family_cell(fams)}</td><td class="num">{len(n["regests"])}</td></tr>'
            )
            person_page(site, n, rels)
        groups.append(
            f'<tbody><tr class="group"><th scope="rowgroup" colspan="3">{esc(title)}</th></tr>\n{chr(10).join(rows)}</tbody>'
        )
    main = f"""<h1 class="visually-hidden">Personen und Gruppen</h1>
{site.view_switch("personen-liste", "../")}
{list_filter("Name")}
<div class="table-wrap"><table class="list persons">
<thead><tr><th scope="col">Name</th><th scope="col">Aussagen</th><th scope="col" class="num">Regesten mit Aussagen</th></tr></thead>
{chr(10).join(groups)}
</table></div>"""
    site.page(path="personen", key="personen-liste", kind="personen", title="Personen und Gruppen", main=main)


def _fold(text: str) -> str:
    """Search folding: lower case, German umlauts spelled out, other diacritics stripped. The
    field carries a second folding with umlauts reduced to their base letter, so „Lowe“ finds
    „Löwe“ as well as „Loewe“ does (the query side folds umlauts spelled out)."""
    low = text.casefold()
    spelled = low.replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    strip = lambda t: "".join(c for c in unicodedata.normalize("NFD", t) if not unicodedata.combining(c))  # noqa: E731
    spelled, base = strip(spelled), strip(low.replace("ß", "ss"))
    return spelled if spelled == base else f"{spelled} {base}"


def person_page(site: Site, node: dict, rels: list[dict]) -> None:
    root = "../../"
    reg_id = _register_id(node["id"])
    register = site.register.get(reg_id) if reg_id else None
    if register:
        entry = f'<p class="register">Im Register der Regesta Imperii: <span class="source">{esc(plain(register["label"]))}</span></p>'
    else:
        entry = '<p class="register">Ohne Registereintrag. Die Kennung gilt nur innerhalb ihres Regests.</p>'
    other_labels = [lb["label"] for lb in node["labels"] if lb["label"] != node["label"]]
    forms = (
        f'<p class="forms"><span class="run-in">Weitere Namensformen</span> {esc(", ".join(other_labels))}</p>'
        if other_labels
        else ""
    )
    items = []
    by_regest: dict[str, list[dict]] = defaultdict(list)
    for x in rels:
        by_regest[x["regest"]].append(x)
    for uid in sorted(by_regest, key=lambda u: site.by_uid[u]["sort"]):
        r = site.by_uid[uid]
        acts = ", ".join(
            f'<a href="{site.regest_href(root, uid, x["claim"])}">{esc(x["act"])}</a> als {esc(x["role"])}'
            for x in by_regest[uid]
        )
        items.append(f'<li><span class="mention-head">{esc(r["identifier"])}, {esc(r["start"][:4])}</span> {acts}</li>')
    for uid in sorted(set(node["regests"]) - set(by_regest), key=lambda u: site.by_uid[u]["sort"]):
        r = site.by_uid[uid]
        items.append(
            f'<li><span class="mention-head">{esc(r["identifier"])}, {esc(r["start"][:4])}</span> '
            f'<a href="{site.regest_href(root, uid)}">genannt ohne Rolle in einer Aussage</a></li>'
        )
    main = f"""<h1>{esc(node["label"])}</h1>
{entry}
{forms}
<p><a href="{root}ansicht/#/personen/{quote(node["id"], safe="")}">Beziehungen im Netz ansehen</a></p>
<section aria-labelledby="m-title"><h2 id="m-title">Nennungen in Aussagen</h2>
<ul class="mentions" role="list">{"".join(items)}</ul></section>"""
    site.page(
        path=f"personen/{site.pslugs[node['id']]}",
        key="personen",
        kind="person",
        title=node["label"],
        main=main,
    )


def redirect_page(path: str, target: str, title: str, licence: str) -> None:
    """An earlier address that now lives as a section of another page: a short page that
    forwards at once and keeps a link for readers without automatic forwarding."""
    doc = f"""<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="0; url={esc(target)}">
  <link rel="canonical" href="{esc(target)}">
  <title>{esc(title)}</title>
</head>
<body><h1>{esc(title)}</h1><p><a href="{esc(target)}">Weiter zu {esc(title)}</a></p><p>{esc(licence)} <a href="../ueber/">Über die Edition</a></p></body>
</html>
"""
    _write(SITE_OUT[0] / path / "index.html", doc)


SITE_OUT: list[Path] = []


def method_page(site: Site, tei_excerpt: str) -> None:
    """Method, data and about stand on one page since 2026-11-14; this address forwards."""
    SITE_OUT[:] = [site.out]
    redirect_page("methode", "../ueber/#methode", "Über die Edition, Methode", site.texts["licenceLine"])


def data_page(site: Site, package: str) -> None:
    """The address of the former data page forwards to the data section of the one page."""
    SITE_OUT[:] = [site.out]
    redirect_page("daten", "../ueber/#daten", "Über die Edition, Daten", site.texts["licenceLine"])


def about_page(site: Site, package: str) -> None:
    """Method, data and the edition in one compact text, after the operator's wish of
    2026-11-14 („methoden daten und über die edition in einen kompakten text zusammenführen
    der dem readme entspricht“): what the edition is and is not, how its statements arise,
    which files there are, and its sources and licences, each part short, in the order of
    the project's README."""
    t = site.texts
    m = site.manifest
    reviewers = len(list((site.source / "runs" / site.run_id / "review").glob("review-*.json")))
    steps = [
        (
            "Auswahl und Pakete",
            0,
            f"Ein Skript wählt {len(site.regests)} Regesten aus dem CSV-Export von RI IV,2 und schreibt je Regest ein Paket mit Text, Datierung, Ort und Registerkandidaten.",
        ),
        (
            "Extraktion",
            1,
            f"LLM-basierte Agenten ({esc(m['model'])}) schreiben die Aussagen als RDF, jede an ihren Wortlaut gebunden.",
        ),
        ("Technische Prüfung", 0, "Ein Validator prüft Form, Vokabular und den wörtlichen Beleg jeder Aussage."),
        (
            "Review und Korrektur",
            1,
            f"{reviewers} Agenten prüfen unabhängig, ein weiterer wägt ab, ein dritter korrigiert; danach läuft die technische Prüfung erneut.",
        ),
        (
            (
                "Agentische Prüfung einer Auswahl",
                1,
                "Zwei weitere LLM-basierte Agenten lesen zwanzig ausgewählte Regesten unabhängig gegen den Regesttext und urteilen je Aussage. Keine Aussage ist menschlich verifiziert.",
            )
            if site.preview
            else (
                "Fachliche Prüfung",
                2,
                "Eine Auswahl wird am Regesttext geprüft. Bisher ist keine Aussage menschlich verifiziert.",
            )
        ),
        (
            "TEI und Website",
            0,
            "Skripte erzeugen nach Regeln je Regest eine TEI-Datei und diese Seiten, ohne eine Aussage hinzuzufügen.",
        ),
    ]
    items = "".join(
        f'<li><span class="step-title">{esc(title)}</span> <span class="producer">({"Mensch" if who == 2 else STEP_PRODUCERS[who]})</span> {text}</li>'
        for title, who, text in steps
    )
    src = t["source"]
    ae = t["agenticEdition"]
    main = f"""<h1>Über die Edition</h1>
<p class="intro">Diese Edition ist ein Experiment. Sie erprobt, wie weit LLM-basierte Agenten eine Edition erzeugen und prüfen können, und ist kein abgeschlossenes oder fachlich abgenommenes Werk. {esc(ae["definition"])} {esc(ae["provisionalNote"]) if ae["provisional"] else ""} Diese Edition legt über die Regesten Friedrich Barbarossas aus den Regesta Imperii eine Schicht von Aussagen, jede an ihren Wortlaut gebunden und mit Urheber und Prüfstand. Die Aussagen sind Ergebnisse dieses Projekts und keine Aussagen der Regesta Imperii; technisch geprüft heißt nicht historisch richtig oder vollständig.</p>
<section aria-labelledby="methode"><h2 id="methode">Wie die Aussagen entstehen</h2>
<ol class="steps" role="list">{items}</ol></section>
<section aria-labelledby="daten"><h2 id="daten">Daten</h2>
<p>Turtle ist die maßgebliche Fassung der Aussagen. TEI-XML gibt je Regest den Regesttext mit den Aussagen in Standoff wieder und ist gegen das Schema tei_all geprüft, JSON ist die Grundlage dieser Seiten. Jede Regestseite bietet ihre drei Dateien an.</p>
<ul class="downloads" role="list"><li><a href="../daten/{esc(package)}" download>Alle Regesten als Paket</a></li></ul></section>
<section aria-labelledby="lizenz"><h2 id="lizenz">Quellen und Lizenz</h2>
<p>{esc(t["attribution"])} Texte und Daten der Edition stehen unter <a href="{esc(t["licences"]["data"]["url"])}" rel="noopener">CC BY 4.0</a>, der Code unter <a href="{esc(t["licences"]["code"]["url"])}" rel="noopener">MIT</a>. Fassung {esc(t["release"]["version"])} vom {esc(t["release"]["date"])}.</p>
<p class="link-row"><a href="{esc(src["url"])}" rel="noopener">Regesta Imperii Online</a> <a href="{esc(src["lab"])}" rel="noopener">RI Lab, Daten</a></p>
<p class="placeholder">{esc(t["imprint"])}</p></section>"""
    site.page(path="ueber", key="ueber", kind="text", title="Über die Edition", main=main)


# Files


def write_files(site: Site, stage: str) -> str:
    """Turtle with licence header, JSON per regest, licence file and the zip package."""
    t = site.texts
    run = site.source / "runs" / site.run_id
    header = (
        f"# {t['title']}. {t['subtitle']}\n# {t['licenceLine']}\n"
        f"# Lauf {site.run_id}, Stand {stage}. {t['modification']}\n"
    )
    licence = (
        f"{t['title']}\n{t['subtitle']}\n\n{t['licenceLine']}\n\n{t['attribution']}\n\n{t['licences']['data']['url']}\n"
    )
    _write(site.out / "LICENSE-DATA.txt", licence)
    for r in site.regests:
        s = site.slugs[r["uid"]]
        ttl = (run / stage / f"{r['uid']}.ttl").read_text(encoding="utf-8")
        _write(site.out / "ttl" / f"{s}.ttl", header + f"# Quelle: {ri_uri(site, r['uid'])}\n\n" + ttl)
        record = {
            "licence": t["licences"]["data"]["url"],
            "attribution": t["attribution"],
            "source": ri_uri(site, r["uid"]),
            "run": site.edition["run"],
            "regest": r,
        }
        _write(site.out / "json" / f"{s}.json", json.dumps(record, ensure_ascii=False, indent=1) + "\n")
        if not (site.out / "tei" / f"{s}.xml").is_file():
            raise BuildError(f"build_tei.py wrote no TEI for {r['identifier']}")
    package = f"barbarossa-regesten-{site.run_id}.zip"
    with zipfile.ZipFile(site.out / "daten" / package, "w", zipfile.ZIP_DEFLATED) as zf:
        files = [site.out / "LICENSE-DATA.txt"]
        for folder in ("tei", "ttl", "json"):
            files += sorted((site.out / folder).glob("*"))
        for path in files:
            info = zipfile.ZipInfo(path.relative_to(site.out).as_posix(), ZIP_DATE)
            info.compress_type = zipfile.ZIP_DEFLATED
            zf.writestr(info, path.read_bytes())
    return package


def copy_assets(site: Site, edition_json: Path, questions_json: Path) -> None:
    """Static assets of the pages and the views app under ansicht/; knowledge/ never."""
    out = site.out
    for name in ("tokens.css", "pages.css", Path(site.shell_css).name):
        _copy(HERE / "css" / name, out / "css" / name)
    _copytree(HERE / "js" / "edition", out / "js" / "edition")
    _copytree(HERE / "fonts", out / "fonts")
    app = out / "ansicht"
    _copy(HERE / "index.html", app / "index.html")
    _copytree(HERE / "js", app / "js", ignore=shutil.ignore_patterns("edition"))
    _copytree(HERE / "css", app / "css")
    _copytree(HERE / "fonts", app / "fonts")
    _write(
        app / "data" / "edition.json",
        json.dumps(_with_agent_review(_load(edition_json), site.preview), ensure_ascii=False, separators=(",", ":")),
    )
    _copy(questions_json, app / "data" / "questions.json")
    routes = {
        "regests": {uid: f"regesten/{s}/" for uid, s in site.slugs.items()},
        "persons": {iri: f"personen/{s}/" for iri, s in site.pslugs.items()},
    }
    _write(out / "data" / "routes.json", json.dumps(routes, ensure_ascii=False, indent=1) + "\n")


def _with_agent_review(edition: dict, preview: bool) -> dict:
    """The agent review per statement, in the preview build only, as what it is: two LLM-based
    readers, their verdicts and one outcome, with producer, model and date. It never sets the
    expert status of a statement, which stays for a person's verification."""
    if not preview:
        return edition
    review = _load(AGENT_REVIEW)
    by = {(item["uid"], st["id"]): st for item in review["items"] for st in item["statements"]}
    producer = review["producer"]
    for r in edition["regests"]:
        for block in r.get("blocks", []):
            head = block.get("head") or {}
            st = by.get((r["uid"], head.get("id")))
            if st:
                head["agentReview"] = {
                    "outcome": st["outcome"],
                    "readers": [{"verdict": x["verdict"], "reason": x["reason"]} for x in st["readers"]],
                    "by": producer["label"],
                    "model": producer["model"],
                    "date": producer["date"],
                }
    return edition


def tei_excerpt(path: Path) -> str:
    """The body paragraph, the first event and its relations of one TEI file, for the method page."""
    text = path.read_text(encoding="utf-8")
    para = re.search(r"<p><persName.*?</p>", text, re.S)
    event = re.search(r"<event .*?</event>", text, re.S)
    rels = re.findall(r'<relation [^>]*passive="#f-marriage"[^>]*/>', text)
    parts = [para.group(0) if para else "", event.group(0) if event else "", *rels]
    return "\n".join(re.sub(r"\n\s+", "\n  ", p) for p in parts if p)


def build(source: Path, run_id: str, out: Path, preview: bool = False) -> None:
    marker = out / MARKER
    if out.exists() and any(out.iterdir()) and not marker.is_file():
        raise BuildError(f"{out} exists and is not a build folder of this script")
    previous = set()
    if marker.is_file():
        previous = {(out / line).resolve() for line in marker.read_text(encoding="utf-8").splitlines() if line}
    for sub in ("css", "daten", "data", "ansicht"):
        (out / sub).mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        rev, ext = Path(tmp) / "revised", Path(tmp) / "extracted"
        _run(["build_data.py", "--source", str(source), "--run", run_id, "--stage", "revised", "--out", str(rev)])
        _run(["build_data.py", "--source", str(source), "--run", run_id, "--stage", "extracted", "--out", str(ext)])
        schema = HERE / "schema" / "tei_all-4.12.0.rng"
        _run(
            [
                "build_tei.py",
                "--source",
                str(source),
                "--run",
                run_id,
                "--out",
                str(out / "tei"),
                "--schema",
                str(schema),
            ]
        )
        data = out / "ansicht" / "data"
        _run(["build_holdings.py", "--source", str(source), "--out", str(data)])
        _run(["check_itinerary.py", "--source", str(source), "--out", str(data / "itinerary-checks.json")])
        WRITTEN.update(p.resolve() for p in (*data.glob("holdings*.json"), data / "itinerary-checks.json"))
        site = Site(source, run_id, out, _load(rev / "edition.json"), _load(ext / "edition.json"), preview=preview)
        copy_assets(site, rev / "edition.json", rev / "questions.json")
    package = write_files(site, "revised")
    start_page(site)
    regest_list_page(site)
    for i in range(len(site.regests)):
        regest_page(site, i)
    persons_pages(site)
    first = site.case["regests"][0] if site.case else site.regests[0]["uid"]
    method_page(site, tei_excerpt(out / "tei" / f"{site.slugs[first]}.xml"))
    about_page(site, package)
    data_page(site, package)
    # Only the TEI files of this run's regesta count as written; a TEI file of an earlier
    # run with other regesta is stale, even though it still lies in the folder.
    current = set(site.slugs.values())
    WRITTEN.update(p.resolve() for p in (out / "tei").glob("*.xml") if p.stem in current)
    WRITTEN.add((out / "daten" / package).resolve())
    # Remove, file by file, what the previous build wrote and this one did not, and stale
    # TEI files of an earlier run; then the folders that became empty, never a full tree.
    stale_tei = {p.resolve() for p in (out / "tei").glob("*.xml") if p.stem not in current}
    for stale in sorted((previous - WRITTEN) | stale_tei):
        if stale.is_file() and stale.is_relative_to(out):
            parent = stale.parent
            stale.unlink()
            if parent != out and parent.is_relative_to(out) and not any(parent.iterdir()):
                parent.rmdir()
    lines = sorted(p.relative_to(out).as_posix() for p in WRITTEN)
    marker.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote the site for {run_id} to {out}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--source", type=Path, default=HERE.parent / "regesta-rdf-demo")
    parser.add_argument("--run", default="factoid-1153-2026-11-11")
    parser.add_argument("--out", type=Path, default=None)
    parser.add_argument(
        "--preview", action="store_true", help="local preview with the agent review into site-preview/, never published"
    )
    args = parser.parse_args()
    if args.out is None:
        args.out = HERE / ("site-preview" if args.preview else "site")
    if args.preview and args.out.resolve() == (HERE / "site").resolve():
        print("the preview build never goes to site/, which is published", file=sys.stderr)
        return 2
    if args.out.resolve().is_relative_to(args.source.resolve()):
        print("refusing to write into the source repository", file=sys.stderr)
        return 2
    try:
        build(args.source, args.run, args.out.resolve(), preview=args.preview)
    except BuildError as exc:
        print(f"site build failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
