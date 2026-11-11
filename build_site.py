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
from collections import Counter, defaultdict
from itertools import pairwise
from pathlib import Path
from urllib.parse import quote

HERE = Path(__file__).resolve().parent
TAG_RE = re.compile(r"<[^>]+>")
LINK_RE = re.compile(r"<link\s+(\S+)[^>]*>(.*?)</link>", re.S)
ZIP_DATE = (2026, 1, 1, 0, 0, 0)
MARKER = ".edition-build"
# Every file this build writes, so a rebuild removes exactly the files of the previous build
# it no longer produces. The house rule forbids recursive deletes inside repositories.
WRITTEN: set[Path] = set()
STEP_PRODUCERS = ("deterministischer Workflow", "unrevidierter LLM-basierter Agent", "menschlich verifiziert")


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

    def __init__(self, source: Path, run_id: str, out: Path, edition: dict, extracted: dict) -> None:
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
        nav = "".join(
            f'<a href="{root}{esc(item["href"])}"{current if item["key"] == key else ""}>{esc(item["label"])}</a>'
            for item in self.nav
        )
        css = [f"{root}css/tokens.css", f"{root}{self.shell_css}"]
        if views:
            css += [f"{root}ansicht/css/app.css", f"{root}ansicht/css/space.css"]
        css.append(f"{root}css/pages.css")
        links = "\n".join(f'  <link rel="stylesheet" href="{href}">' for href in css)
        full_title = title if key == "start" else f"{title} | {self.texts['title']}"
        meta = f'  <meta name="description" content="{esc(description)}">\n' if description else ""
        footer = (
            f'<footer class="site-footer"><p>{esc(self.texts["licenceLine"])}</p>'
            f'<p class="link-row"><a href="{root}ueber/">Über die Edition</a> <a href="{root}methode/">Methode</a></p></footer>'
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
<header class="site-header"><a class="site-title" href="{root or "./"}">{esc(self.texts["title"])}</a><nav class="site-nav" aria-label="Edition">{nav}</nav></header>
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


def start_page(site: Site) -> None:
    t = site.texts
    persons = len(site.actors)
    fallback = (
        '<p class="figure-fallback">Hier steht das Itinerar aller Regesten der Lieferung nach Ort und Zeit. '
        'Die Ansicht braucht JavaScript, die <a href="regesten/">Liste der Regesten</a> nicht.</p>'
    )
    # The header already shows the title; the h1 stays for screen readers, and the subtitle
    # opens the one sentence of description (measured subtractive pass of 2026-11-11).
    main = f"""<h1 class="visually-hidden">{esc(t["title"])}. {esc(t["subtitle"])}</h1>
<p class="lede">{esc(t["subtitle"])}. {esc(t["description"])}</p>
<div class="figure" id="figure">{fallback}</div>
<ul class="entries" role="list">
<li><a href="regesten/">{len(site.regests)} Regesten</a></li>
<li><a href="personen/">{persons} Personen und Gruppen</a></li>
<li><form class="jump" id="jump" hidden><label for="jump-n">Regest nach RI-Nummer</label> <input id="jump-n" name="n" inputmode="text" autocomplete="off" placeholder="z. B. 46" size="8"> <button type="submit">Öffnen</button> <span class="jump-msg" role="status"></span></form></li>
</ul>"""
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


def regest_list_page(site: Site) -> None:
    rows = []
    for r in site.regests:
        date = segments_html(r["date"], site, "../") or '<span class="missing">ohne Datierung</span>'
        place = segments_html(r["place"], site, "../") if r["place"] and r["place"][0]["t"] != "null" else ""
        rows.append(
            f'<tr><th scope="row"><a href="{site.slugs[r["uid"]]}/">{esc(r["identifier"])}</a></th>'
            f"<td>{date}</td><td>{place or '<span class=missing>ohne Ort</span>'}</td>"
            f'<td class="num">{r["claims"]}</td><td>{esc(status_marks(r))}</td></tr>'
        )
    main = f"""<h1>Regesten</h1>
<p class="intro">{len(site.regests)} Regesten in der Ordnung der Regesta Imperii. Ihre Aussagen hat ein LLM-basierter Agent erzeugt, sie sind technisch geprüft und fachlich nicht geprüft. Wie die Auswahl entstand, beschreibt die <a href="../methode/">Methode</a>.</p>
<div class="table-wrap"><table class="list">
<thead><tr><th scope="col">Regest</th><th scope="col">Datierung</th><th scope="col">Ort</th><th scope="col" class="num">Aussagen</th><th scope="col">Abweichung</th></tr></thead>
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
    prev_link = (
        f'<a href="../{site.slugs[site.regests[index - 1]["uid"]]}/" rel="prev">Vorheriges, {esc(site.regests[index - 1]["short"])}</a>'
        if index
        else ""
    )
    next_link = (
        f'<a href="../{site.slugs[site.regests[index + 1]["uid"]]}/" rel="next">Nächstes, {esc(site.regests[index + 1]["short"])}</a>'
        if index + 1 < len(site.regests)
        else ""
    )
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

    downloads = (
        '<section class="downloads" aria-labelledby="dl-title"><h2 id="dl-title">Daten zu diesem Regest</h2><ul role="list">'
        f'<li><a href="{root}tei/{s}.xml" download>TEI</a></li>'
        f'<li><a href="{root}ttl/{s}.ttl" download>Turtle</a></li>'
        f'<li><a href="{root}json/{s}.json" download>JSON</a></li>'
        f'<li><a href="{root}daten/">Alle Regesten als Paket</a></li></ul></section>'
    )
    # The page shows the shared regest card of the views app (js/regest-card.js), rendered by
    # js/edition/regest.js into #card. The static content of #card is the reading without
    # JavaScript; citation and downloads stand below it in both cases.
    main = f"""<div class="title-row"><h1 class="visually-hidden">{esc(r["identifier"])}</h1><nav class="pager" aria-label="Blättern">{prev_link}{next_link}<span class="back-slot"></span></nav></div>
<div class="card-host" id="card" data-uid="{esc(uid)}">
<p class="paper-meta"><span>{esc(r["identifier"])}</span><span>{date}</span>{f"<span>{place}</span>" if place else ""}</p>
<p class="regest-text">{marked_text(r)}</p>
<h2>Aussagen</h2>
{statements}
<div class="fields">{"".join(fields)}</div>
{history_html(r)}
</div>
<div class="cite">{f'<ul class="ext" role="list">{book}</ul>' if book else ""}
<p><span class="run-in">Zitierweise des Regests</span> {esc(citation_ri)}</p>
<p><span class="run-in">Zitierweise dieser Edition</span> {esc(citation_ed)}</p></div>
{downloads}"""
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
    rows = []
    for n in sorted(site.actors, key=lambda n: (_sort_key(n["label"]), n["id"])):
        counts = Counter(x["role"] for x in roles.get(n["id"], []))
        role_text = ", ".join(
            f"{r} {c}" if c > 1 else r for r, c in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
        )
        mark = ' <span class="mark">(ohne Registereintrag)</span>' if n["local"] else ""
        q = re.sub(r"[^a-z0-9 ]", "", _fold(" ".join([n["label"], *(lb["label"] for lb in n["labels"])])))
        rows.append(
            f'<tr data-q="{esc(q)}"><th scope="row"><a href="{site.pslugs[n["id"]]}/">{esc(n["label"])}</a>{mark}</th>'
            f'<td>{esc(role_text)}</td><td class="num">{len(n["regests"])}</td></tr>'
        )
        person_page(site, n, roles.get(n["id"], []))
    main = f"""<h1>Personen und Gruppen</h1>
<p class="intro">Die Namen stehen in der Form, die das Regest verwendet, verknüpft mit dem Registereintrag der Regesta Imperii, wo der Agent einen zugeordnet hat. Rollen und Zahl der Regesten stammen aus den Aussagen.</p>
<p class="filter" hidden><label for="name-filter">Name enthält</label> <input id="name-filter" type="search" autocomplete="off"> <span class="filter-count" role="status"></span></p>
<div class="table-wrap"><table class="list persons">
<thead><tr><th scope="col">Name</th><th scope="col">Rollen</th><th scope="col" class="num">Regesten</th></tr></thead>
<tbody>
{chr(10).join(rows)}
</tbody></table></div>"""
    site.page(path="personen", key="personen", kind="personen", title="Personen und Gruppen", main=main)


def _fold(text: str) -> str:
    """Search folding: lower case, German umlauts spelled out, other diacritics stripped."""
    text = text.casefold().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    return "".join(c for c in unicodedata.normalize("NFD", text) if not unicodedata.combining(c))


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


def method_page(site: Site, tei_excerpt: str) -> None:
    m = site.manifest
    reviewers = len(list((site.source / "runs" / site.run_id / "review").glob("review-*.json")))
    steps = [
        (
            "Export und Erkundung",
            0,
            "Die Regesten und das Register von RI IV,2 liegen als CSV-Export vor. Das Manifest des Laufs hält die Prüfsummen beider Dateien fest.",
        ),
        (
            "Auswahl",
            0,
            f"Ein Skript wählt die Regesten des Laufs nach einem festgelegten Kriterium aus und hält Auswahl und Grund im Manifest fest. In diesem Arbeitsstand sind es {len(site.regests)} Regesten, darunter der Fall Adela in RI IV,2,1 n. 46 und n. 167.",
        ),
        (
            "Pakete",
            0,
            "Für jedes Regest entsteht ein Paket mit Klartext, Datierung, Ort und den Registerkandidaten, jedes mit Prüfsumme im Manifest des Laufs.",
        ),
        (
            "Extraktion",
            1,
            f"LLM-basierte Agenten ({esc(m['model'])}) lesen die Pakete einzeln nach eingefrorenem Prompt und Richtlinien und schreiben Aussagen als RDF, jede mit wörtlichem Beleg. Kein Mensch hat diese Ausgabe überarbeitet.",
        ),
        (
            "Technische Prüfung",
            0,
            "Ein Validator prüft jede Datei gegen SHACL-Formen und Vokabular, prüft jeden Beleg auf wörtliches Vorkommen im Regest und läuft vorher gegen eigene Fehlerfälle.",
        ),
        (
            "Reviews und Abwägung",
            1,
            f"{reviewers} LLM-basierte Agenten prüfen die Aussagen unabhängig voneinander, ohne die Berichte der Extraktion zu kennen. Ein weiterer Agent wägt ihre Befunde ab und entscheidet über Korrekturen.",
        ),
        (
            "Korrektur",
            1,
            "Ein LLM-basierter Agent setzt die angenommenen Korrekturen um, danach läuft die technische Prüfung erneut. Die Edition zeigt diesen überarbeiteten Stand und daneben den extrahierten.",
        ),
        (
            "Fachliche Prüfung",
            2,
            "Eine Teilmenge soll von einer Historikerin oder einem Historiker am Regesttext geprüft werden. Diese Prüfung hat noch nicht stattgefunden, keine Aussage dieses Arbeitsstands ist menschlich verifiziert.",
        ),
        (
            "TEI und Website",
            0,
            "Skripte erzeugen nach Regeln je Regest eine TEI-Datei und diese Seiten. Sie fügen keine Aussage hinzu.",
        ),
    ]
    items = "".join(
        f'<li><p class="step-head"><span class="step-title">{esc(title)}</span> <span class="producer">{STEP_PRODUCERS[who]}</span></p><p>{text}</p></li>'
        for title, who, text in steps
    )
    t = site.texts
    main = f"""<h1>Methode</h1>
<p class="intro">Jeder Schritt nennt, wer ihn ausgeführt hat, damit erkennbar bleibt, was eine Regel und was ein LLM erzeugt hat.</p>
<ol class="steps" role="list">{items}</ol>
<section aria-labelledby="tei-title"><h2 id="tei-title">Umsetzung in TEI</h2>
<p>Der Regesttext steht verlustfrei in einem Absatz. Jede Belegstelle ist ein <code>seg</code>, jeder Name ein <code>persName</code> oder <code>orgName</code> mit Verweis auf die Person in <code>standOff</code>. Jede Aussage ist ein <code>event</code> in <code>listEvent</code>, das über <code>@corresp</code> auf ihre Belege, über <code>@resp</code> auf den erzeugenden Agenten und über <code>@ana</code> auf ihren Prüfstand zeigt. Die Rollen sind <code>relation</code>-Elemente in <code>listRelation</code>. Die maßgebliche Fassung bleibt das RDF des Laufs. Was TEI davon nicht abbildet, sind die Typen der betroffenen Rechte und Sachen als eigene Knoten, sie stehen als Vermerk an der Aussage. So sieht RI IV,2,1 n. 46 aus:</p>
<pre class="code"><code>{esc(tei_excerpt)}</code></pre></section>
<section aria-labelledby="def-title"><h2 id="def-title">{esc(t["agenticEdition"]["term"])}</h2>
<p>{esc(t["agenticEdition"]["definition"])} {esc(t["agenticEdition"]["provisionalNote"]) if t["agenticEdition"]["provisional"] else ""}</p>
<p>{esc(t["genre"])}</p></section>"""
    site.page(path="methode", key="methode", kind="text", title="Methode", main=main)


def about_page(site: Site) -> None:
    t = site.texts
    m = site.manifest
    rows = [
        (
            "Regesten, Kommentare, Überlieferung, Register",
            "Regesta Imperii",
            "übernommen, in Klartext überführt",
            "CC BY 4.0",
        ),
        (
            "Auswahl, Pakete, TEI, Website",
            "Skripte des Projekts",
            "deterministischer Workflow",
            "Code MIT, Daten CC BY 4.0",
        ),
        ("Aussagen", f"LLM-basierte Agenten ({m['model']})", "unrevidierter LLM-basierter Agent", "CC BY 4.0"),
        ("Technische Prüfung", "Validator des Projekts", "deterministischer Workflow", "MIT"),
        ("Reviews, Abwägung, Korrektur", "LLM-basierte Agenten", "unrevidierter LLM-basierter Agent", "CC BY 4.0"),
        ("Fachliche Prüfung", "noch offen", "menschlich verifiziert, noch keine Aussage", ""),
    ]
    table = "".join(
        f'<tr><th scope="row">{esc(a)}</th><td>{esc(b)}</td><td>{esc(c)}</td><td>{esc(d)}</td></tr>'
        for a, b, c, d in rows
    )
    src = t["source"]
    main = f"""<h1>Über die Edition</h1>
<p class="intro">{esc(t["description"])} Ihre Aussagen und Prüfstände sind von LLM-basierten Agenten erzeugt und keine Aussagen der Regesta Imperii.</p>
<section aria-labelledby="src-title"><h2 id="src-title">Quellen und Namensnennung</h2>
<p>{esc(t["attribution"])}</p>
<p class="link-row"><a href="{esc(src["url"])}" rel="noopener">Regesta Imperii Online</a> <a href="{esc(src["lab"])}" rel="noopener">RI Lab, Daten</a> <a href="{esc(t["licences"]["data"]["url"])}" rel="noopener">Lizenztext CC BY 4.0</a></p></section>
<section aria-labelledby="prod-title"><h2 id="prod-title">Wer was erzeugt hat</h2>
<div class="table-wrap"><table class="list"><thead><tr><th scope="col">Teil</th><th scope="col">Urheber</th><th scope="col">Art</th><th scope="col">Lizenz</th></tr></thead><tbody>{table}</tbody></table></div></section>
<section aria-labelledby="lic-title"><h2 id="lic-title">Lizenzen</h2>
<p>Texte und Daten der Edition stehen unter <a href="{esc(t["licences"]["data"]["url"])}" rel="noopener">CC BY 4.0</a>, der Code unter <a href="{esc(t["licences"]["code"]["url"])}" rel="noopener">MIT</a>. Abbildungen Dritter, etwa Digitalisate der Buchseiten, sind nur verlinkt und stehen unter den Bedingungen ihrer Anbieter.</p></section>
<section aria-labelledby="rel-title"><h2 id="rel-title">Fassungen</h2>
<p>Fassung {esc(t["release"]["version"])} vom {esc(t["release"]["date"])}, {esc(t["release"]["state"])}. Die Aussagen stammen aus dem Lauf {esc(site.run_id)}.</p></section>
<section aria-labelledby="imp-title"><h2 id="imp-title">Impressum</h2>
<p class="placeholder">{esc(t["imprint"])}</p></section>"""
    site.page(path="ueber", key="ueber", kind="text", title="Über die Edition", main=main)


def data_page(site: Site, package: str) -> None:
    rows = "".join(
        f'<tr><th scope="row"><a href="../regesten/{site.slugs[r["uid"]]}/">{esc(r["identifier"])}</a></th>'
        f'<td><a href="../tei/{site.slugs[r["uid"]]}.xml" download>TEI</a></td>'
        f'<td><a href="../ttl/{site.slugs[r["uid"]]}.ttl" download>Turtle</a></td>'
        f'<td><a href="../json/{site.slugs[r["uid"]]}.json" download>JSON</a></td></tr>'
        for r in site.regests
    )
    main = f"""<h1>Daten</h1>
<p class="intro">Je Regest gibt es drei Dateien. Turtle ist die maßgebliche Fassung der Aussagen, TEI gibt den Regesttext verlustfrei und die Aussagen mit dem auf der Methodenseite genannten Verlust wieder, JSON ist die Datengrundlage dieser Seiten. Alle Dateien stehen unter CC BY 4.0 mit der Namensnennung der Regesta Imperii.</p>
<section class="downloads" aria-labelledby="pkg-title"><h2 id="pkg-title">Alles in einer Datei</h2>
<ul role="list"><li><a href="{esc(package)}" download>{esc(package)}</a></li></ul></section>
<div class="table-wrap"><table class="list data"><thead><tr><th scope="col">Regest</th><th scope="col">TEI</th><th scope="col">Turtle</th><th scope="col">JSON</th></tr></thead><tbody>{rows}</tbody></table></div>"""
    site.page(path="daten", key="daten", kind="text", title="Daten", main=main)


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
    _copy(edition_json, app / "data" / "edition.json")
    _copy(questions_json, app / "data" / "questions.json")
    routes = {
        "regests": {uid: f"regesten/{s}/" for uid, s in site.slugs.items()},
        "persons": {iri: f"personen/{s}/" for iri, s in site.pslugs.items()},
    }
    _write(out / "data" / "routes.json", json.dumps(routes, ensure_ascii=False, indent=1) + "\n")


def tei_excerpt(path: Path) -> str:
    """The body paragraph, the first event and its relations of one TEI file, for the method page."""
    text = path.read_text(encoding="utf-8")
    para = re.search(r"<p><persName.*?</p>", text, re.S)
    event = re.search(r"<event .*?</event>", text, re.S)
    rels = re.findall(r'<relation [^>]*passive="#f-marriage"[^>]*/>', text)
    parts = [para.group(0) if para else "", event.group(0) if event else "", *rels]
    return "\n".join(re.sub(r"\n\s+", "\n  ", p) for p in parts if p)


def build(source: Path, run_id: str, out: Path) -> None:
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
        site = Site(source, run_id, out, _load(rev / "edition.json"), _load(ext / "edition.json"))
        copy_assets(site, rev / "edition.json", rev / "questions.json")
    package = write_files(site, "revised")
    start_page(site)
    regest_list_page(site)
    for i in range(len(site.regests)):
        regest_page(site, i)
    persons_pages(site)
    first = site.case["regests"][0] if site.case else site.regests[0]["uid"]
    method_page(site, tei_excerpt(out / "tei" / f"{site.slugs[first]}.xml"))
    about_page(site)
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
    parser.add_argument("--out", type=Path, default=HERE / "site")
    args = parser.parse_args()
    if args.out.resolve().is_relative_to(args.source.resolve()):
        print("refusing to write into the source repository", file=sys.stderr)
        return 2
    try:
        build(args.source, args.run, args.out.resolve())
    except BuildError as exc:
        print(f"site build failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
