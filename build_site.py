# /// script
# requires-python = ">=3.11"
# dependencies = ["rdflib==7.6.0", "numpy", "lxml"]
# ///
"""Build the curated static site of the public edition from one factoid run.

Regime: single-file script with inline dependencies. It calls build_data.py (once per stage),
build_tei.py, build_holdings.py and check_itinerary.py as subprocesses, so each script stays
runnable on its own and none imports another; this script only reads their output. It writes nothing outside --out
and never into the source repository. The output folder is gitignored and never committed.

Data flow
    build_data.py --stage revised     -> <out>/ansicht/data/edition.json (shown stage)
    build_data.py --stage extracted   -> temporary folder (comparison only)
    build_tei.py                      -> <out>/tei/<slug>.xml, checked against tei_all
    runs/<run>/<stage>/<uid>.ttl      -> <out>/ttl/<slug>.ttl with a licence header
    source CSVs                       -> persistent identifier, original dating, literature,
                                         footnotes, register entries
    edition/texts.json, js/nav.json   -> title, definition, licence, navigation
    js/i18n/de.json, js/i18n/en.json  -> every interface text, per language
        -> <out>/index.html, atlas/, regesten/, regesten/<slug>/, personen/, personen/<id>/,
           json/, daten/<package>.zip, ansicht/ (the views app), and methode/, daten/, ueber/,
           which forward to their sections of the start page
        -> <out>/en/ with the same pages in English (start, atlas/, regesten/, personen/,
           ansicht/), reading the same data, files and scripts at the site root

Usage
    python build_site.py
    python build_site.py --run factoid-1153-2026-11-11 --out site

Design decisions
- Content pages are pre-rendered HTML, readable without JavaScript. Scripts only enhance:
  the evidence underline on pointing, the embedded views, the RI-number jump, the name
  filter and the back link of the `zurueck` parameter.
- All page text that names title, subtitle, definition or licence comes from
  edition/texts.json; the navigation comes from js/nav.json, shared with the views app.
- Every interface text comes from the dictionary of the page language, js/i18n/<lang>.json,
  which the views read as well (js/i18n.js); the English dictionary also carries the English
  form of the language-bound fields of texts.json under `edition`. Source text (regest text,
  apparatus, quotations, names of persons and places, the LLM agents' own wording) is never
  translated and stands in English pages with lang="de" (knowledge/glossary.md).
- German pages stay at their addresses; English pages mirror them under en/. Every page links
  the same page in the other language and names both as hreflang alternates.
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
# The agent review of twenty regesta (knowledge/data.md, Agent review): two LLM-based readers
# per statement. It is agentic review, never a human verdict, and is shown only in the local
# preview build (--preview, site-preview/) until the operator decides on publication; the
# preview marks its pages with PREVIEW_META, and publish_site.py refuses them.
AGENT_REVIEW = HERE / "edition" / "agent-review-2026-11-14.json"
PREVIEW_META = '<meta name="edition-preview" content="agent-review-2026-11-14">'
# The languages of the site; the first is the language of the root, the others mirror it under
# <lang>/. The slides of the guest unit at Technische Hochschule Mittelhessen (operator, 2026-11-18).
LANGS = ("de", "en")
SLIDES = "https://docs.google.com/presentation/d/1Pzj4v6xl6nEl6z4PPMvvihy0yW11F9cH2Xmp8SrYXNU/edit?usp=sharing"
PLACEHOLDER = re.compile(r"\{(\w+)\}")


class BuildError(Exception):
    """A violated input contract; the message names the step."""


def esc(text: object) -> str:
    return html.escape(str(text), quote=True)


def _choose(ui: dict, key: str, values: dict) -> str:
    value = ui.get(key)
    if value is None:
        raise BuildError(f"missing interface text {key}")
    if isinstance(value, dict):
        value = value["one"] if values.get("n") == 1 else value["other"]
    return value


def tr(ui: dict, key: str, **values: object) -> str:
    """The interface text of a key with {name} placeholders filled, as js/i18n.js t() does."""
    return PLACEHOLDER.sub(
        lambda m: str(values[m.group(1)]) if m.group(1) in values else m.group(0), _choose(ui, key, values)
    )


def tr_html(ui: dict, key: str, **markup: object) -> str:
    """The interface text of a key as HTML: the text escaped, the placeholders filled with ready
    markup (links, source names marked lang="de")."""
    return PLACEHOLDER.sub(
        lambda m: str(markup[m.group(1)]) if m.group(1) in markup else m.group(0), esc(_choose(ui, key, markup))
    )


def de(text: object) -> str:
    """Source text inside an interface sentence: escaped and marked German."""
    return f'<span lang="de">{esc(text)}</span>'


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
        self.base_texts = _load(HERE / "edition" / "texts.json")
        self.dicts = {lang: _load(HERE / "js" / "i18n" / f"{lang}.json") for lang in LANGS}
        self.lang = LANGS[0]
        # German prefLabel to English prefLabel of the frozen vocabulary (build_data.py).
        self.vocabulary = edition.get("vocabulary", {})
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

    def _rows(self) -> dict[str, dict]:
        path = self.source / "source-material" / "RI_004-002-ReggBarbarossa.csv"
        with path.open(encoding="utf-8-sig", newline="") as fh:
            # The same dialect as the register; on this file both dialects give the same rows.
            rows = {r["uid"]: r for r in csv.DictReader(fh, escapechar="\\", strict=True) if r["uid"] in self.by_uid}
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
        # The register escapes double quotes with a backslash; the default dialect shifts the
        # fields of those rows (the entries RI004-002-K000373 and RI004-002-P000183 among them).
        with path.open(encoding="utf-8-sig", newline="") as fh:
            for row in csv.DictReader(fh, escapechar="\\", strict=True):
                if row["id"] in wanted and row["id"] not in out:
                    out[row["id"]] = row
        return out

    @property
    def texts(self) -> dict:
        """texts.json with the language-bound fields of the page language (en.json, edition)."""
        return {**self.base_texts, **self.dicts[self.lang].get("edition", {})}

    @property
    def ui(self) -> dict:
        return self.dicts[self.lang]["ui"]

    def prefix(self, lang: str | None = None) -> str:
        """The folder of a language below the site root: none for the first, en/ for English."""
        lang = lang or self.lang
        return "" if lang == LANGS[0] else f"{lang}/"

    def T(self, key: str, **values: object) -> str:
        return tr(self.ui, key, **values)

    def H(self, key: str, **markup: object) -> str:
        return tr_html(self.ui, key, **markup)

    def term(self, label: str) -> str:
        """A label of the model in the page language: the English prefLabel of the frozen
        vocabulary, else the dictionary's word for a label the build coins, else the label."""
        if self.lang == LANGS[0] or not label:
            return label
        return self.vocabulary.get(label) or self.dicts[self.lang].get("terms", {}).get(label) or label

    def rel(self, path: str) -> tuple[str, str]:
        """root, the way to the site root (data, files, scripts), and home, the way to the start
        of the page language (pages), from a page at path inside its language."""
        depth = len([p for p in path.split("/") if p])
        return "../" * (depth + len([p for p in self.prefix().split("/") if p])), "../" * depth

    def regest_href(self, home: str, uid: str, claim: str | None = None) -> str:
        return f"{home}regesten/{self.slugs[uid]}/" + (f"#f-{claim}" if claim else "")

    def header(self, path: str, nav: str) -> str:
        """The one header of every page: title, objects, the jump, the language switch and the
        repository; nav is the markup of the objects (empty in the views app, which fills it)."""
        _, home = self.rel(path)
        return (
            f'<a class="skip" href="#main">{esc(self.T("skip"))}</a>\n'
            f'<header class="site-header"><a class="site-title" href="{home or "./"}">{esc(self.texts["title"])} '
            f'<span class="site-tag">{esc(self.texts["tag"])}</span></a>{nav}{jump_html(self.ui)}'
            f"{self.lang_switch(path)}{github_link(self.texts, self.ui)}</header>"
        )

    def lang_href(self, path: str, lang: str) -> str:
        root, _ = self.rel(path)
        return f"{root}{self.prefix(lang)}{path + '/' if path else ''}" or "./"

    def lang_switch(self, path: str) -> str:
        """The link to the same page in the other language; js/edition/lang.js carries query and
        hash along. Its words come from the other language's dictionary, in that language."""
        other = next(lang for lang in LANGS if lang != self.lang)
        name = self.dicts[other]["ui"]["lang.name"]
        return (
            f'<a class="lang-switch" href="{self.lang_href(path, other)}" hreflang="{other}" lang="{other}" '
            f'aria-label="{esc(name)}" title="{esc(name)}">{esc(self.dicts[other]["ui"]["lang.code"])}</a>'
        )

    def alternates(self, path: str) -> str:
        return "".join(
            f'  <link rel="alternate" hreflang="{lang}" href="{self.lang_href(path, lang)}">\n' for lang in LANGS
        )

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
        """Write one page in the shared frame of its language: header from nav.json, main, footer.
        path is the address inside the language; English pages go below en/."""
        root, home = self.rel(path)
        # A page belongs to an object of the navigation either directly or as one of its
        # representations.
        owner = next((it["key"] for it in self.nav if any(v["key"] == key for v in it.get("views", []))), key)
        nav = "".join(
            f'<a href="{home}{esc(item["href"])}" data-nav="{esc(item["key"])}"{CURRENT if item["key"] == owner else ""}>{esc(self.T("nav." + item["key"]))}</a>'
            for item in self.nav
        )
        nav = f'<nav class="site-nav" aria-label="{esc(self.T("nav.aria"))}">{nav}</nav>'
        css = [f"{root}css/tokens.css", f"{root}css/shell.css"]
        if views:
            css += [f"{root}ansicht/css/{name}" for name in ("app.css", "space.css", "views.css", "frame.css")]
        css.append(f"{root}css/pages.css")
        links = "\n".join(f'  <link rel="stylesheet" href="{href}">' for href in css)
        full_title = title if key == "start" else f"{title} | {self.texts['title']}"
        meta = f'  <meta name="description" content="{esc(description)}">\n' if description else ""
        if self.preview:
            meta += f"  {PREVIEW_META}\n"
        footer = footer_html(self.texts, self.ui, root, home)
        doc = f"""<!doctype html>
<html lang="{self.lang}" class="no-js" data-root="{root}" data-home="{home}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{esc(full_title)}</title>
{meta}{self.alternates(path)}{links}
  <script type="module" src="{root}js/edition/page.js"></script>
</head>
<body data-page="{kind}" data-layout="page">
{self.header(path, nav)}
<div class="site-body"><main class="site-main" id="main">
{main}
</main></div>
{footer}
</body>
</html>
"""
        _write(self.out / self.prefix() / path / "index.html", doc)

    def app_page(self) -> None:
        """The views app at ansicht/ in the page language: the shell of index.html of the
        repository with this language's header and footer; js/app.js fills the navigation and
        the main area. The English shell loads the same modules and data from ansicht/."""
        path = "ansicht"
        root, home = self.rel(path)
        app = f"{root}ansicht/"
        css = "\n".join(
            f'  <link rel="stylesheet" href="{app}css/{name}">'
            for name in ("tokens.css", "app.css", "shell.css", "space.css", "views.css", "frame.css")
        )
        nav = f'<nav class="site-nav" aria-label="{esc(self.T("nav.aria"))}" id="site-nav"></nav>'
        doc = f"""<!doctype html>
<html lang="{self.lang}" data-root="{root}" data-home="{home}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{esc(self.texts["title"])}</title>
{"  " + PREVIEW_META + chr(10) if self.preview else ""}{self.alternates(path)}{css}
  <script type="module" src="{app}js/app.js"></script>
  <script type="module" src="{root}js/edition/jump.js"></script>
  <script type="module" src="{root}js/edition/lang.js"></script>
</head>
<body>
{self.header(path, nav)}
<div class="site-body">
<main class="site-main" id="main" tabindex="-1"><p class="loading">{esc(self.T("app.loading"))}</p></main>
</div>
{footer_html(self.texts, self.ui, root, home)}
<p class="visually-hidden" aria-live="polite" id="announce"></p>
</body>
</html>
"""
        _write(self.out / self.prefix() / path / "index.html", doc)


# Shared fragments


def jump_html(ui: dict) -> str:
    """The jump by RI number in the header of every page (js/edition/jump.js); hidden until the
    script runs, since it needs the data of the views."""
    return (
        f'<form class="jump" id="jump" hidden><label for="jump-n" class="visually-hidden">{esc(tr(ui, "jump.label"))}</label>'
        f'<input id="jump-n" name="n" type="search" autocomplete="off" placeholder="{esc(tr(ui, "jump.placeholder"))}" size="10">'
        f'<button type="submit">{esc(tr(ui, "jump.open"))}</button><span class="jump-msg" role="status"></span></form>'
    )


# The GitHub mark of Primer Octicons (MIT); the repository is private until the operator
# changes its visibility.
GITHUB_PATH = (
    "M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 "
    "0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 "
    "0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 "
    "1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55"
    "-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 "
    "1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"
)


def github_link(texts: dict, ui: dict, cls: str = "site-github") -> str:
    repo = texts["repository"]
    label = esc(tr(ui, "github"))
    return (
        f'<a class="{cls}" href="{esc(repo)}" rel="noopener" aria-label="{label}" title="{label}">'
        f'<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="{GITHUB_PATH}"/></svg></a>'
    )


def footer_html(texts: dict, ui: dict, root: str, home: str) -> str:
    """One footer for every page: the maker with the mark, the Promptotyping experiment, the
    licences with the short attribution of Regesta Imperii and the way to the full one, the
    repository and the imprint, which stand on the start page of the language (operator,
    2026-11-18). index.html of the repository's views app carries the German markup with root and
    home ../, kept in step by checks/test_site.py."""
    maker = texts["maker"]
    return (
        '<footer class="site-footer">'
        f'<a class="footer-maker" href="{esc(maker["url"])}" rel="noopener">'
        f'<img src="{root}img/dhcraft-mark-watercolor-128.png" alt="" width="20" height="23">{esc(maker["name"])}</a>'
        f'<a href="{esc(maker["promptotyping"])}" rel="noopener">{esc(tr(ui, "footer.experiment"))}</a>'
        f'<p class="footer-licence">{esc(texts["licenceLine"])} <a href="{home or "./"}#lizenz">{esc(tr(ui, "footer.attribution"))}</a></p>'
        f'<span class="footer-end">{github_link(texts, ui, "footer-github")}<a href="{home or "./"}#impressum">{esc(tr(ui, "footer.imprint"))}</a></span>'
        "</footer>"
    )


def segments_html(segments: list[dict], site: Site, home: str) -> str:
    """Markup segments of edition.json as HTML; a regest link becomes a page link inside the run.
    The segments are source text; the caller marks their element lang="de"."""
    out = []
    for seg in segments:
        text = esc(seg["t"])
        if seg.get("regest") in site.by_uid:
            text = f'<a href="{site.regest_href(home, seg["regest"])}">{text}</a>'
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


def atlas_page(site: Site) -> None:
    """The Atlas (knowledge/interface-plan.md, part 1) at atlas/ since 2026-11-18, when the start
    page became the entry to the whole edition: js/edition/atlas.js mounts ansicht/js/atlas.js
    into #figure. Without JavaScript the page says what it shows and leads to the list."""
    list_link = f'<a href="../regesten/">{esc(site.T("atlas.fallbackList"))}</a>'
    fallback = f'<p class="figure-fallback">{site.H("atlas.fallback", list=list_link)}</p>'
    # The figure is the page, one window high (operator, 2026-11-14: „Man soll nicht
    # runterscrollen können“). The h1 stays for screen readers.
    main = f"""<h1 class="visually-hidden">{esc(site.T("atlas.title"))}</h1>
<div class="figure" id="figure">{fallback}</div>"""
    site.page(path="atlas", key="atlas", kind="atlas", title=site.T("nav.atlas"), main=main, views=True)


def _thumb_map(holdings: dict, realm: dict | None, basemap: dict | None) -> str:
    """The Atlas card: the places of issue on a small map of the core, sized by their regesta,
    over the Empire about 1190 and the coast, as the floor of the cube draws them."""
    lon0, lon1, lat0, lat1 = 3.5, 17.5, 41.0, 55.5
    k = 0.66  # cos of about 48.5 degrees north, so the map keeps its proportions
    w, h = 240, 150
    sx = w / ((lon1 - lon0) * k)
    sy = h / (lat1 - lat0)
    s = min(sx, sy)
    ox = (w - (lon1 - lon0) * k * s) / 2

    def xy(lon: float, lat: float) -> str:
        return f"{ox + (lon - lon0) * k * s:.1f},{(lat1 - lat) * s:.1f}"

    def inside(lon: float, lat: float) -> bool:
        return lon0 <= lon <= lon1 and lat0 <= lat <= lat1

    parts = []
    if realm:
        parts.append(f'<polygon class="th-realm" points="{" ".join(xy(lo, la) for lo, la in realm["ring"])}"/>')
    for line in (basemap or {}).get("coast", []):
        run = [xy(lo, la) for lo, la in line if inside(lo, la)]
        if len(run) > 1:
            parts.append(f'<polyline class="th-coast" points="{" ".join(run)}"/>')
    places = sorted(holdings["places"].values(), key=lambda pl: pl["n"])
    for pl in places:
        if inside(pl["lo"], pl["la"]):
            x, y = xy(pl["lo"], pl["la"]).split(",")
            parts.append(f'<circle class="th-dot" cx="{x}" cy="{y}" r="{min(6.0, 1.2 + pl["n"] ** 0.5 * 0.55):.1f}"/>')
    return f'<svg class="entry-thumb" viewBox="0 0 {w} {h}" aria-hidden="true">{"".join(parts)}</svg>'


def _thumb_years(holdings: dict) -> str:
    """The Regesten card: regesta per year of the whole delivery, the ground of the time band."""
    years = holdings["years"]
    lo, hi = years[0][0], years[-1][0]
    peak = max(c for _, c in years)
    w, h = 240, 150
    bw = w / (hi - lo + 1)
    bars = "".join(
        f'<rect class="th-bar" x="{(y - lo) * bw:.1f}" y="{h - c / peak * (h - 10):.1f}" width="{max(1.0, bw - 1):.1f}" height="{c / peak * (h - 10):.1f}"/>'
        for y, c in years
    )
    return f'<svg class="entry-thumb" viewBox="0 0 {w} {h}" preserveAspectRatio="none" aria-hidden="true">{bars}</svg>'


def _thumb_band(holdings: dict) -> str:
    """The Personen card: the six most named persons as rows of the Zeitband, a square per year."""
    year_of = {r["u"]: int(r["s"][:4]) for r in holdings["regesta"]}
    top = sorted(holdings["persons"].values(), key=lambda pr: -len(pr["r"]))[:6]
    lo, hi = 1146, 1191
    w, h = 240, 150
    row = h / len(top)
    cell = (w - 8) / (hi - lo)
    parts = []
    for i, pr in enumerate(top):
        per: dict[int, int] = defaultdict(int)
        for u in pr["r"]:
            if u in year_of and lo <= year_of[u] < hi:
                per[year_of[u]] += 1
        y = i * row + row / 2
        parts.append(f'<rect class="th-span" x="4" y="{y - 1.5:.1f}" width="{w - 8}" height="3" rx="1.5"/>')
        for yr, n in sorted(per.items()):
            parts.append(
                f'<rect class="th-cell is-{min(4, n)}" x="{4 + (yr - lo) * cell:.1f}" y="{y - 5:.1f}" width="{max(1.0, cell - 1):.1f}" height="10" rx="1"/>'
            )
    return f'<svg class="entry-thumb" viewBox="0 0 {w} {h}" aria-hidden="true">{"".join(parts)}</svg>'


def start_page(site: Site, package: str) -> None:
    """The start page (operator, 2026-11-18; knowledge/interface-plan.md, Parts): what the edition
    is, three entries to Atlas, Regesten and Personen with a small figure from each view, the
    process with its producers, how the edition came about, data and licence, the full
    attribution and the imprint (since 2026-11-18 also what Über carried). The former Atlas
    addresses of this page (#/atlas, #/itinerar, ?ort= and the other facets) forward to atlas/
    (js/edition/start.js)."""
    t = site.texts
    root, _ = site.rel("")
    data = site.out / "ansicht" / "data"
    holdings = _load(data / "holdings.json")
    realm = _load(HERE / "js" / "realm.json") if (HERE / "js" / "realm.json").is_file() else None
    basemap = _load(HERE / "js" / "basemap.json") if (HERE / "js" / "basemap.json").is_file() else None
    counts = holdings["counts"]
    evidenced = sum(1 for r in site.regests if r["claims"] > 0)
    cards = [
        (
            "atlas/",
            site.T("nav.atlas"),
            site.T("start.card.atlas"),
            site.T("start.card.atlasCount", n=counts["withIssuePlace"]),
            _thumb_map(holdings, realm, basemap),
        ),
        (
            "regesten/",
            site.T("nav.regesten"),
            site.T("start.card.regesten"),
            site.T("start.card.regestenCount", n=counts["regesta"], m=evidenced),
            _thumb_years(holdings),
        ),
        (
            "ansicht/#/",
            site.T("nav.personen"),
            site.T("start.card.personen"),
            site.T("start.card.personenCount", n=len(holdings["persons"])),
            _thumb_band(holdings),
        ),
    ]
    entries = "".join(
        f'<li><a class="entry-card" href="{href}">{thumb}<span class="entry-title">{esc(title)}</span>'
        f'<span class="entry-purpose">{esc(purpose)}</span><span class="entry-count">{esc(count)}</span></a></li>'
        for href, title, purpose, count, thumb in cards
    )
    maker = t["maker"]
    src = t["source"]
    link = lambda href, text: f'<a href="{esc(href)}" rel="noopener">{esc(text)}</a>'  # noqa: E731
    # The slides of the guest unit, under the intro and in the section on how the edition came
    # about (operator, 2026-11-18).
    slides = link(SLIDES, site.T("start.slides"))
    # Since 2026-11-18 (operator: „Start und Über soll es nicht geben, sondern das soll
    # zusammengeführt werden“) the start page carries everything Über carried: the steps with
    # their producers and notes, how the edition came about, data and licence with the full
    # attribution, the note on the mark and the imprint. The ids are the anchors of the former
    # Über page, so ueber/, methode/ and daten/ forward to the same sections. German names of
    # the guest unit, the course and the university stay German on the English page.
    origin = site.H(
        "start.origin",
        promptotyping=link(maker["promptotyping"], "Promptotyping"),
        maker=esc(maker["name"]),
        unit=site.H("start.origin.unit"),
        course=de("Graphbasierte Systeme"),
        university=f'<span lang="de">{site.H("start.origin.university")}</span>',
        windhager=link("https://doi.org/10.1109/TVCG.2018.2830759", "Windhager et al. (2019)"),
    )
    files = site.H(
        "start.files",
        package=f'<a href="{root}daten/{esc(package)}" download>{esc(site.T("start.files.package"))}</a>',
        ccby=link(t["licences"]["data"]["url"], "CC BY 4.0"),
        mit=link(t["licences"]["code"]["url"], "MIT"),
        version=esc(t["release"]["version"]),
        date=esc(t["release"]["date"]),
        rio=link(src["url"], "Regesta Imperii Online"),
        lab=link(src["lab"], "RI Lab"),
        github=link(t["repository"], "GitHub"),
    )
    main = f"""<h1>{esc(t["title"])}</h1>
<p class="intro">{site.H("start.intro", n=counts["regesta"])}</p>
<p class="intro-slides">{slides}</p>
<ul class="entry-cards" role="list">{entries}</ul>
<section aria-labelledby="methode" class="process"><h2 id="methode">{esc(site.T("start.process"))}</h2>
{process_html(site, notes=True)}</section>
<div class="start-about">
<section aria-labelledby="entstehung" class="start-origin"><h2 id="entstehung">{esc(site.T("start.originHeading"))}</h2>
<p>{origin}</p>
<p>{slides}</p></section>
<section aria-labelledby="impressum" class="start-imprint"><h2 id="impressum">{esc(site.T("footer.imprint"))}</h2>
<p>{esc(t["imprint"])}, <a href="{esc(t["imprintUrl"])}" rel="noopener">{esc(t["imprintUrl"])}</a></p></section>
<section aria-labelledby="daten" class="start-files"><h2 id="daten">{esc(site.T("start.filesHeading"))}</h2>
<p>{files}</p>
<p id="lizenz" class="about-attribution">{esc(t["attribution"])}</p>
<p class="about-attribution">{esc(t["markNote"])}</p></section>
</div>"""
    site.page(path="", key="start", kind="start", title=t["title"], main=main, description=t["description"])


def status_marks(site: Site, regest: dict) -> str:
    marks = []
    if regest["claims"] == 0:
        marks.append(site.T("mark.none"))
    if regest["notes"].get("corrected"):
        marks.append(site.T("mark.corrected"))
    if not regest["technical"]:
        marks.append(site.T("mark.failed"))
    return ", ".join(marks)


def _families() -> tuple[dict[str, str], list[tuple[str, str]]]:
    """The eight relation families of js/relations.js, the one definition shared with the views:
    act type -> family key, and per family key its sign path; their words stand in the
    dictionaries (family.<key>.short, family.<key>.label)."""
    src = (HERE / "js" / "relations.js").read_text(encoding="utf-8")
    fams = re.findall(r'key: "(\w+)", angle: \d+, types: \[([^\]]*)\]', src)
    icons = dict(re.findall(r'^\s+(\w+): "(M[^"]+)",$', src, re.M))
    if len(fams) != 8 or set(icons) != {f[0] for f in fams}:
        raise BuildError("js/relations.js: eight families with a sign each expected")
    by_type = {t: key for key, types in fams for t in re.findall(r'"([^"]+)"', types)}
    return by_type, [(key, icons[key]) for key, _ in fams]


FAMILY_OF, FAMILIES = _families()


def family_sign(key: str) -> str:
    """The family's sign as inline SVG, as js/relations.js draws it in the views."""
    path = next(p for k, p in FAMILIES if k == key)
    return (
        '<svg class="fam-icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" '
        f'stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="{path}"/></svg>'
    )


def family_cell(site: Site, keys: set[str]) -> str:
    """The signs of a row's families in the families' fixed order, with their names for screen readers."""
    ordered = [(k, site.T(f"family.{k}.label")) for k, _ in FAMILIES if k in keys]
    signs = "".join(family_sign(k) for k, _ in ordered)
    names = ", ".join(label for _, label in ordered)
    return f'<span class="fams">{signs}</span><span class="visually-hidden">{esc(names)}</span>' if ordered else ""


def list_filter(site: Site, placeholder: str) -> str:
    """Search field and one switch per relation family above a list; js/edition/listfilter.js
    shows and drives it, so without JavaScript the full list stands without dead controls.
    The switches carry sign and word, so they are the legend of the signs in the rows."""
    toggles = "".join(
        f'<button type="button" class="fam-toggle" aria-pressed="false" data-f="{k}">'
        f"{family_sign(k)}<span>{esc(site.T(f'family.{k}.label'))}</span></button>"
        for k, _ in FAMILIES
    )
    return (
        f'<div class="list-filter" hidden><input type="search" class="list-q" aria-label="{esc(placeholder)}" '
        f'placeholder="{esc(placeholder)}" autocomplete="off">'
        f'<span class="fam-toggles" role="group" aria-label="{esc(site.T("listfilter.kinds"))}">{toggles}</span>'
        '<span class="filter-count" role="status"></span></div>'
    )


def regest_list_page(site: Site) -> None:
    """Regesten (knowledge/interface-plan.md, part 2): js/edition/regesten.js mounts the list of
    the whole delivery with the shared filter bar into #list. Without JavaScript the page keeps
    the table of the run's regesta and a filter row that stays hidden."""
    rows = []
    missing_date = f'<span class="missing">{esc(site.T("list.noDate"))}</span>'
    missing_place = f'<span class="missing">{esc(site.T("list.noPlace"))}</span>'
    for r in site.regests:
        date = segments_html(r["date"], site, "../")
        place = segments_html(r["place"], site, "../") if r["place"] and r["place"][0]["t"] != "null" else ""
        fams = {FAMILY_OF.get(b["title"], "order") for b in r["blocks"]}
        marks = status_marks(site, r)
        rows.append(
            f'<tr><th scope="row"><a href="{site.slugs[r["uid"]]}/">{esc(r["identifier"])}</a></th>'
            f"<td>{f'<span lang=de>{date}</span>' if date else missing_date}</td><td>{f'<span lang=de>{place}</span>' if place else missing_place}</td>"
            f"<td>{family_cell(site, fams)}{f'<span class=row-mark>{esc(marks)}</span>' if marks else ''}</td></tr>"
        )
    heads = "".join(
        f'<th scope="col">{esc(site.T(f"list.th.{k}"))}</th>' for k in ("regest", "dating", "place", "statements")
    )
    main = f"""<h1 class="visually-hidden">{esc(site.T("nav.regesten"))}</h1>
<div class="figure" id="list"><p class="figure-fallback">{esc(site.T("regesten.fallback"))}</p>
<div class="table-wrap"><table class="list regests">
<thead><tr>{heads}</tr></thead>
<tbody>
{chr(10).join(rows)}
</tbody></table></div></div>"""
    site.page(path="regesten", key="regesten", kind="regesten", title=site.T("nav.regesten"), main=main, views=True)


def statement_html(site: Site, block: dict) -> str:
    """The sentence of a statement. German pages keep the sentence build_data.py composes; an
    English page names the kind in English and the participants by their English role, with the
    regest's own words marked German."""
    if site.lang == LANGS[0]:
        parts = []
        for p in block["sentence"]:
            if isinstance(p, str):
                parts.append(esc(p))
            elif p is block["sentence"][0]:
                parts.append(f'<span class="act-type">{esc(p["text"])}</span>')
            else:
                parts.append(esc(p["text"]))
        return "".join(parts)
    people = [
        f"{esc(site.term(line['role']) if line.get('role') else site.T('role.concerns'))}: {de(line['phrase'])}"
        for line in block["lines"]
        if line.get("phrase") and line.get("rel") in ("role", "concerns")
    ]
    kind = f'<span class="act-type">{esc(site.term(block["title"]))}</span>'
    return f"{kind}: {'; '.join(people)}" if people else kind


def factoid_html(site: Site, regest: dict, block: dict, before: dict | None, home: str) -> str:
    """One factoid: its sentence, the wording it rests on, literals, case note, earlier stage."""
    claim = block["head"]["id"]
    ids = evidence_ids(block)
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
            extra.append(
                f'<p class="lit"><span class="run-in">{esc(site.term(line["label"]))}</span> <span lang="de">{wording}</span></p>'
            )
        for ref in line.get("crossrefs", []):
            other = ref["other"]
            reg = other.get("register") or {}
            regest_link = f'<a href="{site.regest_href(home, other["regest"], other["claim"])}">{esc(site.by_uid[other["regest"]]["identifier"])}</a>'
            entry = site.H("case.entry", entry=de(f"„{plain(reg.get('label'))}“")) if reg.get("label") else ""
            name = de(f"„{other['name']}“")
            extra.append(f'<p class="case-note">{site.H("case.note", regest=regest_link, name=name, entry=entry)}</p>')
    if before is not None and sentence_text(before) != sentence_text(block):
        extra.append(
            f'<p class="before"><span class="run-in">{esc(site.T("statement.before"))}</span> {statement_html(site, before)}</p>'
        )
    elif before is None and regest["uid"] in site.extracted and regest["notes"].get("corrected"):
        extra.append(f'<p class="before">{esc(site.T("statement.added"))}</p>')
    return (
        f'<li class="factoid" id="f-{esc(claim)}" data-ev="{esc(" ".join(ids))}">'
        f'<p class="sentence">{statement_html(site, block)}</p>'
        f'<p class="evq" lang="de">{" … ".join(quotes)}</p>{"".join(extra)}</li>'
    )


def history_html(site: Site, regest: dict) -> str:
    h, notes = regest["history"], regest["notes"]
    run_in = lambda key, **v: f'<span class="run-in">{esc(site.T(key, **v))}</span>'  # noqa: E731
    items = []
    for f in h["findings"]:
        items.append(f'<li>{run_in("history.finding")} <span lang="en">{esc(f["description"])}</span></li>')
    for d in h["decisions"]:
        items.append(
            f'<li>{run_in("history.decision", decision=site.term(d["decision"]))} <span lang="en">{esc(d["reason"])}</span></li>'
        )
    for c in notes["corrections"]:
        items.append(f'<li>{run_in("history.correction")} <span lang="en">{esc(c["text"])}</span></li>')
    for g in notes["gaps"]:
        items.append(
            f'<li>{run_in("history.gap", stage=site.term(g["stage"]))} <span lang="{esc(g.get("lang", "en"))}">{esc(g["text"])}</span></li>'
        )
    for u in notes["unresolved"]:
        items.append(f'<li>{run_in("history.open")} <span lang="en">{esc(u["text"])}</span></li>')
    if not items:
        return ""
    return (
        f'<details class="history"><summary>{esc(site.T("history.summary"))}</summary>'
        f'<ul role="list">{"".join(items)}</ul></details>'
    )


def regest_page(site: Site, index: int) -> None:
    r = site.regests[index]
    uid, s = r["uid"], site.slugs[r["uid"]]
    root, home = site.rel(f"regesten/{s}")
    row = site.rows[uid]

    # Paging as two arrows in the head line of the card (operator, 2026-11-14: the line
    # „Nächstes, …“ above the regest „so überhaupt nicht gut“); the name is the accessible label.
    def pager_link(i: int, rel: str, sign: str) -> str:
        other = site.regests[i]
        label = site.T(f"pager.{rel}", short=other["short"])
        return f'<a href="../{site.slugs[other["uid"]]}/" rel="{rel}" aria-label="{esc(label)}" title="{esc(label)}">{sign}</a>'

    prev_link = pager_link(index - 1, "prev", "←") if index else ""
    next_link = pager_link(index + 1, "next", "→") if index + 1 < len(site.regests) else ""
    date = segments_html(r["date"], site, home)
    date = f'<span lang="de">{date}</span>' if date else f'<span class="missing">{esc(site.T("list.noDate"))}</span>'
    place = segments_html(r["place"], site, home) if r["place"] and r["place"][0]["t"] != "null" else ""
    run_in = lambda key: f'<span class="run-in">{esc(site.T(key))}</span>'  # noqa: E731
    fields = []
    original = plain(row.get("original_date"))
    if original:
        fields.append(f"<p>{run_in('app.original')} {de(original)}</p>")
    if r["apparatus"]["transmission"]:
        fields.append(
            f'<p>{run_in("app.transmission")} <span lang="de">{segments_html(r["apparatus"]["transmission"], site, home)}</span></p>'
        )
    literature = plain(row.get("literature"))
    if literature:
        fields.append(f"<p>{run_in('app.literature')} {de(literature)}</p>")
    if r["apparatus"]["commentary"]:
        fields.append(
            f'<p>{run_in("app.commentary")} <span lang="de">{segments_html(r["apparatus"]["commentary"], site, home)}</span></p>'
        )
    footnotes = plain(row.get("footnotes"))
    if footnotes:
        fields.append(f"<p>{run_in('app.footnotes')} {de(footnotes)}</p>")
    uri = ri_uri(site, uid)
    external = LINK_RE.findall(row.get("external_links") or "")
    book = "".join(
        f'<li><a href="{esc(target)}" rel="noopener" lang="de">{esc(plain(label))}</a> ({esc(site.T("ext.bsb") if "bsb" in target or "mdz" in target else site.T("ext.other"))})</li>'
        for target, label in external
    )
    t = site.texts
    citation_ri = site.T("cite.ri", identifier=r["identifier"], uri=uri)
    citation_ed = site.T(
        "cite.edition",
        title=t["title"],
        subtitle=t["subtitle"],
        identifier=r["identifier"],
        version=t["release"]["version"],
        date=t["release"]["date"],
        run=site.run_id,
    )
    # What the page view of js/regest-card.js takes from the delivery beyond edition.json:
    # further fields (Originaldatierung to the metadata, Literatur and Anmerkungen to the
    # apparatus), the external links and the citation forms; js/edition/regest.js reads it and
    # names a field by its key from the dictionary (app.<key>).
    extra_fields = [
        ("original", original, "meta"),
        ("literature", literature, "comment"),
        ("footnotes", footnotes, "comment"),
    ]
    page_meta = {
        "fields": [{"key": key, "text": text, "where": where} for key, text, where in extra_fields if text],
        "citations": [
            {"key": "regest", "text": citation_ri},
            {"key": "edition", "text": citation_ed},
        ],
        "links": [{"text": str(plain(label)), "href": target} for target, label in external],
    }
    # A JSON island: every "<" is escaped, so no value can close or comment out the script element.
    meta_json = json.dumps(page_meta, ensure_ascii=False).replace("<", "\\u003c")

    ext = site.extracted.get(uid)
    before_by_node = {b["node"]: b for b in ext["blocks"]} if ext else {}
    factoids = [factoid_html(site, r, b, before_by_node.get(b["node"]), home) for b in r["blocks"]]
    removed = [b for n, b in before_by_node.items() if n not in {x["node"] for x in r["blocks"]}]
    if removed:
        factoids.append(
            f'<li class="factoid removed"><p class="before">{run_in("statement.removed")} '
            + " ".join(statement_html(site, b) for b in removed)
            + "</p></li>"
        )
    if r["claims"]:
        state = [site.T("review.made"), site.T("review.checked" if r["technical"] else "review.failed")]
        if r["notes"].get("corrected"):
            state.append(site.T("review.corrected"))
        elif ext:
            state.append(site.T("review.same"))
        statements = f'<p class="review-state">{esc(" ".join(state))}</p><ol class="factoid-list" role="list">{"".join(factoids)}</ol>'
    else:
        statements = f'<p class="review-state">{esc(site.T("review.none"))}</p>'

    # Without JavaScript the files stand in the static reading; the card puts them in its head.
    downloads = (
        f'<p class="paper-meta"><a href="{root}tei/{s}.xml" download>TEI</a> '
        f'<a href="{root}ttl/{s}.ttl" download>Turtle</a> <a href="{root}json/{s}.json" download>JSON</a></p>'
    )
    # The delivery writes no text for some regesta (RI IV,2,1 n. 107); the page says so.
    no_text = "" if r["text"] else f"<p>{esc(site.T('card.noText'))}</p>"
    # The page shows the shared regest card of the views app (js/regest-card.js), rendered by
    # js/edition/regest.js into #card. The static content of #card is the reading without
    # JavaScript; citation and downloads stand below it in both cases.
    main = f"""<div class="title-row"><h1 class="visually-hidden">{esc(r["identifier"])}</h1><nav class="pager" aria-label="{esc(site.T("pager.aria"))}">{prev_link}{next_link}<span class="back-slot"></span></nav></div>
<div class="card-host" id="card" data-uid="{esc(uid)}" data-slug="{esc(s)}">
<p class="paper-meta"><span>{esc(r["identifier"])}</span><span>{date}</span>{f'<span lang="de">{place}</span>' if place else ""}</p>
{downloads}
<p class="regest-text" lang="de">{marked_text(r)}</p>{no_text}
<h2>{esc(site.T("list.th.statements"))}</h2>
{statements}
<div class="fields">{"".join(fields)}</div>
{history_html(site, r)}
</div>
<div class="cite">{f'<ul class="ext" role="list">{book}</ul>' if book else ""}
<p>{run_in("cite.regestLabel")} {esc(citation_ri)}</p>
<p>{run_in("cite.editionLabel")} {esc(citation_ed)}</p></div>
<script type="application/json" id="regest-meta">{meta_json}</script>"""
    site.page(
        path=f"regesten/{s}",
        key="regesten",
        kind="regest",
        title=r["identifier"],
        main=main,
        description=r["lead"] if site.lang == LANGS[0] else None,
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
            # German labels of the vocabulary, as the role edges carry them; pages show them through site.term.
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
    for title, nodes in ((site.T("persons.group.register"), registered), (site.T("persons.group.local"), local)):
        rows = []
        for n in nodes:
            rels = roles.get(n["id"], [])
            fams = {"kin" if x["act"] == "Elternschaft" else FAMILY_OF.get(x["act"], "order") for x in rels}
            where = (
                f' <span class="row-mark">{esc(site.by_uid[n["regests"][0]]["identifier"])}</span>'
                if n["local"] and n["regests"]
                else ""
            )
            q = re.sub(r"[^a-z0-9 ]", "", _fold(" ".join([n["label"], *(lb["label"] for lb in n["labels"])])))
            rows.append(
                f'<tr data-q="{esc(q)}" data-f="{" ".join(sorted(fams))}"><th scope="row"><a href="{site.pslugs[n["id"]]}/" lang="de">{esc(n["label"])}</a>{where}</th>'
                f'<td>{family_cell(site, fams)}</td><td class="num">{len(n["regests"])}</td></tr>'
            )
            person_page(site, n, rels)
        groups.append(
            f'<tbody><tr class="group"><th scope="rowgroup" colspan="3">{esc(title)}</th></tr>\n{chr(10).join(rows)}</tbody>'
        )
    main = f"""<h1 class="visually-hidden">{esc(site.T("persons.indexTitle"))}</h1>
{list_filter(site, site.T("persons.th.name"))}
<div class="table-wrap"><table class="list persons">
<thead><tr><th scope="col">{esc(site.T("persons.th.name"))}</th><th scope="col">{esc(site.T("list.th.statements"))}</th><th scope="col" class="num">{esc(site.T("persons.th.regesta"))}</th></tr></thead>
{chr(10).join(groups)}
</table></div>"""
    site.page(path="personen", key="personen", kind="personen", title=site.T("persons.indexTitle"), main=main)


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
    path = f"personen/{site.pslugs[node['id']]}"
    _, home = site.rel(path)
    reg_id = _register_id(node["id"])
    register = site.register.get(reg_id) if reg_id else None
    if register:
        entry = f'<p class="register">{esc(site.T("person.register"))} <span class="source" lang="de">{esc(plain(register["label"]))}</span></p>'
    else:
        entry = f'<p class="register">{esc(site.T("person.noRegister"))}</p>'
    other_labels = [lb["label"] for lb in node["labels"] if lb["label"] != node["label"]]
    forms = (
        f'<p class="forms"><span class="run-in">{esc(site.T("person.forms"))}</span> {de(", ".join(other_labels))}</p>'
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
            site.H(
                "person.as",
                act=f'<a href="{site.regest_href(home, uid, x["claim"])}">{esc(site.term(x["act"]))}</a>',
                role=esc(site.term(x["role"])),
            )
            for x in by_regest[uid]
        )
        items.append(f'<li><span class="mention-head">{esc(r["identifier"])}, {esc(r["start"][:4])}</span> {acts}</li>')
    for uid in sorted(set(node["regests"]) - set(by_regest), key=lambda u: site.by_uid[u]["sort"]):
        r = site.by_uid[uid]
        items.append(
            f'<li><span class="mention-head">{esc(r["identifier"])}, {esc(r["start"][:4])}</span> '
            f'<a href="{site.regest_href(home, uid)}">{esc(site.T("person.noRole"))}</a></li>'
        )
    main = f"""<h1 lang="de">{esc(node["label"])}</h1>
{entry}
{forms}
<p><a href="{home}ansicht/#/personen/{quote(node["id"], safe="")}">{esc(site.T("person.network"))}</a></p>
<section aria-labelledby="m-title"><h2 id="m-title">{esc(site.T("person.mentions"))}</h2>
<ul class="mentions" role="list">{"".join(items)}</ul></section>"""
    site.page(path=path, key="personen", kind="person", title=node["label"], main=main)


def redirect_page(out: Path, path: str, section: str, title: str, licence: str) -> None:
    """An earlier address that now lives as a section of the start page: a short page that
    forwards at once and keeps a link for readers without automatic forwarding. A fragment of
    the old address (ueber/#impressum) names the same section on the start page, since the
    start page keeps the anchors of the former Über page; the one inline line carries it, the
    refresh goes to the section of the address itself."""
    target = f"../#{section}"
    doc = f"""<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script>if (location.hash) location.replace("../" + location.hash);</script>
  <meta http-equiv="refresh" content="0; url={esc(target)}">
  <link rel="canonical" href="../">
  <title>{esc(title)}</title>
</head>
<body><h1>{esc(title)}</h1><p><a href="{esc(target)}">Weiter zu {esc(title)}</a></p><p>{esc(licence)} <a href="../#lizenz">Namensnennung</a></p></body>
</html>
"""
    _write(out / path / "index.html", doc)


def forward_pages(site: Site) -> None:
    """The former pages Über (2026-11-14 to 2026-11-18), Methode and Daten forward to their
    sections of the start page (operator, 2026-11-18: Start and Über become one page)."""
    licence = site.texts["licenceLine"]
    redirect_page(site.out, "ueber", "methode", "Startseite, Wie die Aussagen entstehen", licence)
    redirect_page(site.out, "methode", "methode", "Startseite, Wie die Aussagen entstehen", licence)
    redirect_page(site.out, "daten", "daten", "Startseite, Daten und Lizenz", licence)


# The producers of the steps on the start page, with their sign (16 unit grid, current colour);
# their names stand in the dictionaries (producer.<kind>).
PRODUCERS = {
    "script": "M5.5 3C4 3 4 4.5 4 6s-1.5 2-1.5 2S4 8.5 4 10s0 3 1.5 3M10.5 3C12 3 12 4.5 12 6s1.5 2 1.5 2-1.5.5-1.5 2 0 3-1.5 3",
    "agent": "M5.5 6.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM10.5 6.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM2 13c0-2.2 1.6-4 3.5-4S9 10.8 9 13M7 13c0-2.2 1.6-4 3.5-4S14 10.8 14 13",
    "person": "M8 7a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM3 14c0-2.8 2.2-5 5-5s5 2.2 5 5",
}


def producer_sign(kind: str) -> str:
    path = PRODUCERS[kind]
    return (
        f'<svg class="step-sign" viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" fill="none" '
        f'stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="{path}"/></svg>'
    )


def process_html(site: Site, notes: bool) -> str:
    """The steps of knowledge/pipeline.md with the producer of each (script, LLM agent, person),
    on the start page. notes False reads the note of a step out only (density
    limits of the page profile, 2026-11-18); the open human check says „steht aus“ on screen."""
    m = site.manifest
    # The steps of the pipeline (knowledge/pipeline.md, The eight steps and Responsibilities) and
    # of the edition build, merged where one producer does two steps in a row; the agentic
    # reading of twenty regesta is the agent review of knowledge/data.md; the human
    # verification is pending (pipeline.md), so it is drawn open.
    steps = [
        ("select", "script"),
        ("extract", "agent"),
        ("validate", "script"),
        ("review", "agent"),
        ("reading", "agent"),
        ("build", "script"),
        ("expert", "person"),
    ]
    items = "".join(
        f'<li class="step is-{kind}{" is-open" if kind == "person" else ""}">'
        f'<span class="step-mark" title="{esc(site.T(f"producer.{kind}"))}">{producer_sign(kind)}'
        f'<span class="visually-hidden">{esc(site.T(f"producer.{kind}"))}:</span></span>'
        f'<span class="step-title">{esc(site.T(f"step.{step}"))}</span> <span class="step-note{"" if notes or kind == "person" else " visually-hidden"}">{esc(site.T(f"step.{step}.note", model=m["model"]))}</span></li>'
        for step, kind in steps
    )
    key = "".join(
        f'<li><span class="step-mark is-{k}">{producer_sign(k)}</span>{esc(site.T(f"producer.{k}"))}</li>'
        for k in PRODUCERS
    )
    return (
        f'<ol class="steps{" has-notes" if notes else ""}" role="list">{items}</ol>'
        f'<ul class="step-key" role="list" aria-label="{esc(site.T("step.keyAria"))}">{key}</ul>'
    )


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
        f"{t['title']}\n{t['subtitle']}\n\n{t['licenceLine']}\n\n{t['attribution']}\n\n{t['licences']['data']['url']}\n\n"
        f"{t['markNote']}\n"
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
    for name in ("tokens.css", "pages.css", "shell.css"):
        _copy(HERE / "css" / name, out / "css" / name)
    _copytree(HERE / "js" / "edition", out / "js" / "edition")
    # The address helper the static pages import as ../url.js, as the views app does.
    _copy(HERE / "js" / "url.js", out / "js" / "url.js")
    _copytree(HERE / "fonts", out / "fonts")
    _copytree(HERE / "img", out / "img")
    app = out / "ansicht"
    # The shell of the views app is written per language by Site.app_page; the scripts, styles
    # and data below exist once, for both languages.
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


def build(source: Path, run_id: str, out: Path, preview: bool = False) -> None:
    # A second build in the same process (the checks build twice) starts its own record.
    WRITTEN.clear()
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
    # Every page once per language: German at the root, English under en/, both reading the
    # same data, files and scripts. The former addresses forward in German only.
    for lang in LANGS:
        site.lang = lang
        start_page(site, package)
        atlas_page(site)
        regest_list_page(site)
        for i in range(len(site.regests)):
            regest_page(site, i)
        persons_pages(site)
        site.app_page()
    site.lang = LANGS[0]
    forward_pages(site)
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
    parser.add_argument("--source", type=Path, default=HERE / "pipeline")
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
        print("refusing to write into the pipeline folder", file=sys.stderr)
        return 2
    try:
        build(args.source, args.run, args.out.resolve(), preview=args.preview)
    except BuildError as exc:
        print(f"site build failed: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
