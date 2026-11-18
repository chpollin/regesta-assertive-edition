"""Check of build_site.py against the factoid run the edition shows.

Builds the curated site into a temporary folder and asserts the contract of the build:
every content page carries exactly one h1, the licence line and a link to the full
attribution on the start page, every regest has its TEI, Turtle and JSON file and a page that holds its
regest text, the evidence pieces of a regest page give back the regest text, and nothing
from knowledge/ is part of the build. The shown run must be present: a missing run fails
the check instead of skipping it, so a renamed or moved run cannot pass unnoticed.

A second, cheap check guards the stylesheets: the hidden attribute must hide in every page,
also where a component sets its own display (the tooltip of the itinerary stood visible
while hidden until 2026-11-17).

Usage
    python -m pytest -q checks/test_site.py
"""

from __future__ import annotations

import html
import json
import re
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from html.parser import HTMLParser
from io import StringIO
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import build_site

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "pipeline"
RUN = "factoid-1153-2026-11-11"


class SiteBuild(unittest.TestCase):
    def test_pages_files_and_boundary(self) -> None:
        self.assertTrue((SOURCE / "runs" / RUN / "manifest.json").is_file(), f"shown run {RUN} missing")
        texts = json.loads((ROOT / "edition" / "texts.json").read_text(encoding="utf-8"))
        with tempfile.TemporaryDirectory() as tmp, redirect_stdout(StringIO()):
            out = Path(tmp) / "site"
            build_site.build(SOURCE, RUN, out)
            pages = sorted(out.glob("**/index.html"))
            # The German pages; the English ones under en/ are checked in Languages.
            content = [p for p in pages if "ansicht" not in p.parts and p.relative_to(out).parts[0] != "en"]
            self.assertTrue(content)
            for page in content:
                doc = page.read_text(encoding="utf-8")
                where = page.relative_to(out).as_posix()
                self.assertEqual(doc.count("<h1"), 1, where)
                self.assertIn(html.escape(texts["licenceLine"]), doc, where)
                self.assertRegex(doc, r'href="(\.\./)*(\./)?#lizenz"', where)
            edition = json.loads((out / "ansicht" / "data" / "edition.json").read_text(encoding="utf-8"))
            for r in edition["regests"]:
                s = build_site.slug(r["identifier"])
                for path in (f"tei/{s}.xml", f"ttl/{s}.ttl", f"json/{s}.json", f"regesten/{s}/index.html"):
                    self.assertTrue((out / path).is_file(), path)
                doc = (out / "regesten" / s / "index.html").read_text(encoding="utf-8")
                para = re.search(r'<p class="regest-text" lang="de">(.*?)</p>', doc, re.S).group(1)
                self.assertEqual(html.unescape(re.sub(r"<[^>]+>", "", para)), r["text"], s)
            self.assertFalse(any("knowledge" in p.parts for p in out.rglob("*")))
            # The start page is the entry to the edition, the Atlas lives at atlas/ and loads the
            # module that mounts ansicht/js/atlas.js (knowledge/interface-plan.md, Parts).
            start = (out / "index.html").read_text(encoding="utf-8")
            self.assertRegex(start, r'<a href="\./" data-nav="start" aria-current="page">Start</a>')
            self.assertIn('data-page="start"', start)
            self.assertEqual(start.count('class="entry-card"'), 3)
            # Start and Über are one page (operator, 2026-11-18): the start page carries the
            # sections of Über under their former anchors, and ueber/, methode/ and daten/
            # forward there, carrying a fragment of the old address.
            for anchor in ("methode", "entstehung", "daten", "lizenz", "impressum"):
                self.assertIn(f'id="{anchor}"', start)
            self.assertIn(html.escape(texts["attribution"]), start)
            self.assertNotIn('data-nav="ueber"', start)
            for old, section in (("ueber", "methode"), ("methode", "methode"), ("daten", "daten")):
                stub = (out / old / "index.html").read_text(encoding="utf-8")
                self.assertIn(f'content="0; url=../#{section}"', stub, old)
                self.assertIn('location.replace("../" + location.hash)', stub, old)
            atlas = (out / "atlas" / "index.html").read_text(encoding="utf-8")
            self.assertRegex(atlas, r'<a href="\.\./atlas/" data-nav="atlas" aria-current="page">Atlas</a>')
            self.assertIn('data-page="atlas"', atlas)
            self.assertTrue((out / "ansicht" / "js" / "atlas.js").is_file())
            self.assertTrue((out / "img" / "dhcraft-mark-watercolor-128.png").is_file())
            # One header and one footer on every page: the jump, the repository, the maker. The
            # forwarding stubs of former addresses (methode/, daten/) leave at once and carry none.
            for page in content:
                doc = page.read_text(encoding="utf-8")
                if 'http-equiv="refresh"' in doc:
                    continue
                for needle in (
                    'id="jump"',
                    'class="site-github"',
                    'class="site-footer"',
                    "Ein Promptotyping-Experiment",
                ):
                    self.assertIn(needle, doc, page.relative_to(out).as_posix())
            # The views app of the repository carries the German footer and header parts of the
            # static pages.
            ui = json.loads((ROOT / "js" / "i18n" / "de.json").read_text(encoding="utf-8"))["ui"]
            app_page = (ROOT / "index.html").read_text(encoding="utf-8")
            self.assertIn(build_site.footer_html(texts, ui, "../", "../"), app_page)
            self.assertIn(build_site.jump_html(ui), app_page)
            self.assertIn(build_site.github_link(texts, ui), app_page)


class AtlasRoutes(unittest.TestCase):
    def test_atlas_route_and_old_place_addresses(self) -> None:
        # The views app routes #/atlas and forwards the former place views to it; the header
        # has no item Orte any more.
        app = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        self.assertRegex(app, r"\batlas: \{[^\n]*renderAtlas")
        for old in ("itinerar", "jahrzehnte"):
            self.assertRegex(app, rf"\b{old}: \{{[^\n]*forwardToAtlas\(\"{old}\"")
        nav = json.loads((ROOT / "js" / "nav.json").read_text(encoding="utf-8"))["items"]
        self.assertEqual([it["key"] for it in nav], ["start", "atlas", "regesten", "personen"])
        # The start page forwards the Atlas addresses of earlier links to atlas/, which rewrites
        # #/itinerar/<place> into the Atlas address.
        start = (ROOT / "js" / "edition" / "start.js").read_text(encoding="utf-8")
        self.assertIn("atlas/", start)
        self.assertRegex(start, r"atlas\|itinerar\|jahrzehnte")
        atlas = (ROOT / "js" / "edition" / "atlas.js").read_text(encoding="utf-8")
        self.assertIn("atlasAddress", atlas)
        self.assertRegex(atlas, r"itinerar\|jahrzehnte")


class RegestenAndPersonen(unittest.TestCase):
    def test_raum_redirect_and_whole_delivery_list(self) -> None:
        # The view Raum is gone (operator, 2026-11-17): its route forwards to the Netz, its
        # module and the navigation item are gone (knowledge/interface-plan.md, step 2).
        app = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        self.assertRegex(app, r"raum: \{[^}]*forward:")
        self.assertNotIn("renderSpace", app)
        self.assertFalse((ROOT / "js" / "space.js").exists())
        nav = (ROOT / "js" / "nav.json").read_text(encoding="utf-8")
        self.assertNotIn('"raum"', nav)
        # The regest list is the whole delivery: it counts every regest of holdings.json and the
        # list page mounts it.
        regesten = (ROOT / "js" / "regesten.js").read_text(encoding="utf-8")
        self.assertIn("selection.rows.length", regesten)
        selection = (ROOT / "js" / "selection.js").read_text(encoding="utf-8")
        self.assertIn("H.regesta", selection)
        page = (ROOT / "js" / "edition" / "page.js").read_text(encoding="utf-8")
        self.assertIn('regesten: () => import("./regesten.js")', page)


class RegestPage(unittest.TestCase):
    def test_head_line_instead_of_metadata_column(self) -> None:
        # The citable page has one head line (number, dating, place, „ungeprüft“, actions with
        # the copy button and one facsimile menu) and no metadata column (interface-plan.md, step 3).
        card = (ROOT / "js" / "regest-card.js").read_text(encoding="utf-8")
        page = card[card.index("function pageView") :]
        for needle in (
            '"card-head page-head"',
            "reviewState(regest, store.edition.run)",
            "copyButton(citation)",
            '"card-menu"',
            "options.pager",
        ):
            self.assertIn(needle, page)
        self.assertNotIn("reg-meta", card)
        self.assertNotIn("Metadaten", card)


# German function words and letters that betray German interface text in an English page; a
# word counts only as a whole word. Source text is exempt where an element marks it lang="de".
GERMAN_WORDS = frozenset(
    [
        "der",
        "die",
        "das",
        "und",
        "mit",
        "ohne",
        "nicht",
        "von",
        "bis",
        "ein",
        "eine",
        "einer",
        "zu",
        "im",
        "auf",
        "für",
        "oder",
        "wird",
        "sind",
        "ist",
        "dem",
        "den",
        "des",
        "als",
        "nach",
        "bei",
        "aus",
        "über",
        "zum",
        "zur",
        "sich",
        "noch",
        "auch",
    ]
)
GERMAN_LETTERS = re.compile(r"[äöüÄÖÜß]")
VOID = frozenset(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"])
UI_ATTRS = ("aria-label", "title", "placeholder", "alt")


class _LangText(HTMLParser):
    """Text and interface attributes of a page's body with the language each stands in."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.stack: list[tuple[str, str | None, bool]] = []
        self.parts: list[tuple[str, str]] = []

    def _lang(self) -> str:
        """The language an element states below <html>, empty where it inherits the page's."""
        return next((lang for tag, lang, _ in reversed(self.stack) if lang and tag != "html"), "")

    def _skipped(self) -> bool:
        return any(skip for _, _, skip in self.stack)

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        a = dict(attrs)
        lang = a.get("lang") or (a.get("hreflang") if tag == "a" else None)
        if tag not in VOID:
            self.stack.append((tag, lang, tag in ("script", "style", "head")))
        if not self._skipped():
            here = (lang if tag != "html" else None) or self._lang()
            for name in UI_ATTRS:
                if a.get(name):
                    self.parts.append((here, a[name]))

    def handle_endtag(self, tag: str) -> None:
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                break

    def handle_data(self, data: str) -> None:
        if data.strip() and not self._skipped():
            self.parts.append((self._lang(), data))


def german_outside(doc: str) -> list[str]:
    """Every piece of an English page's interface text that reads as German. Interface text
    inherits the language of the page; data that states its own language (source text with
    lang="de", the agents' English notes with lang="en") is not interface text."""
    parser = _LangText()
    parser.feed(doc)
    hits = []
    for lang, text in parser.parts:
        if lang:
            continue
        # Case-sensitive: German function words are lower case in running text, and "MIT" is a licence.
        words = set(re.findall(r"[A-Za-zÄÖÜäöüß]+", text))
        if GERMAN_LETTERS.search(text) or words & GERMAN_WORDS:
            hits.append(text.strip()[:80])
    return hits


def _frame(doc: str, tag: str) -> str:
    """Header or footer of a page with its relative prefixes, the current item and the target of
    the language switch removed, so the frames of different page types can be compared."""
    part = re.search(rf"<{tag}\b.*?</{tag}>", doc, re.S).group(0)
    part = re.sub(r'(href|src)="(\./|\.\./)*', r'\1="', part)
    part = part.replace(' aria-current="page"', "").replace(' id="site-nav"', "")
    part = re.sub(r'<nav class="site-nav"[^>]*>.*?</nav>', "<nav/>", part, flags=re.S)
    return re.sub(r'(class="lang-switch" href=")[^"]*', r"\1", part)


class Languages(unittest.TestCase):
    """The German site at the root and the English one under en/ (2026-11-18)."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.tmp = tempfile.TemporaryDirectory()
        cls.out = Path(cls.tmp.name) / "site"
        with redirect_stdout(StringIO()):
            build_site.build(SOURCE, RUN, cls.out)
        cls.dicts = {
            lang: json.loads((ROOT / "js" / "i18n" / f"{lang}.json").read_text(encoding="utf-8"))
            for lang in build_site.LANGS
        }

    @classmethod
    def tearDownClass(cls) -> None:
        cls.tmp.cleanup()

    def pages(self, lang: str) -> list[Path]:
        base = self.out if lang == "de" else self.out / lang
        found = [p for p in base.glob("**/index.html") if lang != "de" or "en" not in p.relative_to(self.out).parts[:1]]
        # The forwarding stubs of former addresses leave at once and carry no frame.
        return [p for p in found if 'http-equiv="refresh"' not in p.read_text(encoding="utf-8")]

    def test_every_key_in_both_languages(self) -> None:
        de, en = (self.dicts[lang]["ui"] for lang in ("de", "en"))
        self.assertEqual(sorted(de), sorted(en))
        for key in de:
            self.assertEqual(isinstance(de[key], dict), isinstance(en[key], dict), key)
            for value in (de[key], en[key]):
                forms = value.values() if isinstance(value, dict) else [value]
                self.assertTrue(all(isinstance(f, str) and f for f in forms), key)
        texts = json.loads((ROOT / "edition" / "texts.json").read_text(encoding="utf-8"))
        self.assertLessEqual(set(self.dicts["en"]["edition"]), set(texts))
        # Every literal key the scripts and the build name stands in the dictionaries.
        sources = [*(ROOT / "js").glob("*.js"), *(ROOT / "js" / "edition").glob("*.js"), ROOT / "build_site.py"]
        call = re.compile(r"""\b(?:t|T|H|tr|tr_html|run_in)\((?:ui, )?["']([a-z][\w.-]*[\w-])["']""")
        used = {key for path in sources for key in call.findall(path.read_text(encoding="utf-8"))}
        self.assertTrue(used)
        self.assertEqual(sorted(used - set(de)), [])
        # The keys the scripts compose from a closed set.
        families = re.findall(r'key: "(\w+)", angle', (ROOT / "js" / "relations.js").read_text(encoding="utf-8"))
        composed = [f"family.{k}.{w}" for k in families for w in ("short", "label")]
        composed += [f"atlas.mode.{k}" for k in ("wuerfel", "karte", "zeit", "jahrzehnte")]
        composed += [f"stand.{k}" for k in ("ruler", "church", "lay", "open")]
        composed += [f"tb.order.{k}" for k in ("anzahl", "zeit", "name")]
        composed += [f"list.col.{k}" for k in ("year", "number", "place", "statements", "regest")]
        composed += [f"verdict.{k}" for k in ("stimmt", "stimmt-nicht", "strittig", "unklar")]
        composed += [f"app.{k}" for k in ("original", "literature", "footnotes")]
        self.assertEqual(sorted(set(composed) - set(de)), [])

    def test_english_pages_carry_no_german_interface_text(self) -> None:
        pages = self.pages("en")
        self.assertGreater(len(pages), 10)
        for page in pages:
            doc = page.read_text(encoding="utf-8")
            self.assertEqual(german_outside(doc), [], page.relative_to(self.out).as_posix())
        # The scan finds German where it is not marked.
        self.assertTrue(german_outside('<html lang="en"><body><p>Zurück zur Liste</p></body></html>'))
        self.assertFalse(german_outside('<html lang="en"><body><p lang="de">Zurück zur Liste</p></body></html>'))

    def test_switch_lang_and_hreflang(self) -> None:
        for lang in build_site.LANGS:
            other = next(x for x in build_site.LANGS if x != lang)
            for page in self.pages(lang):
                doc = page.read_text(encoding="utf-8")
                where = page.relative_to(self.out).as_posix()
                self.assertIn(f'<html lang="{lang}"', doc, where)
                switch = re.search(rf'<a class="lang-switch" href="([^"]+)" hreflang="{other}" lang="{other}"', doc)
                self.assertIsNotNone(switch, where)
                for code in build_site.LANGS:
                    alt = re.search(rf'<link rel="alternate" hreflang="{code}" href="([^"]+)">', doc)
                    self.assertIsNotNone(alt, f"{where} {code}")
                    self.assertTrue((page.parent / alt.group(1) / "index.html").resolve().is_file(), f"{where} {code}")
                self.assertTrue((page.parent / switch.group(1) / "index.html").resolve().is_file(), where)

    def test_one_header_and_footer_per_language(self) -> None:
        for lang in build_site.LANGS:
            base = self.out if lang == "de" else self.out / lang
            slug = next(p.parent.name for p in (base / "regesten").glob("*/index.html"))
            person = next(p.parent.name for p in (base / "personen").glob("*/index.html"))
            kinds = ["", "atlas", "regesten", f"regesten/{slug}", "personen", f"personen/{person}", "ansicht"]
            docs = {k: (base / k / "index.html").read_text(encoding="utf-8") for k in kinds}
            for tag in ("header", "footer"):
                frames = {k: _frame(doc, tag) for k, doc in docs.items()}
                for k, frame in frames.items():
                    self.assertEqual(frame, frames[""], f"{lang} {tag} {k}")
        # Data, files and scripts exist once, at the root.
        for shared in ("ansicht/data", "ansicht/js", "tei", "ttl", "json", "daten"):
            self.assertFalse((self.out / "en" / shared).exists(), shared)
        # The slides of the guest unit stand on both start pages, under the intro and in Entstehung.
        for lang, word in (("de", "Foliensatz der Gasteinheit"), ("en", "Slides of the guest unit")):
            start = (self.out / ("" if lang == "de" else lang) / "index.html").read_text(encoding="utf-8")
            self.assertEqual(start.count(build_site.SLIDES), 2, lang)
            self.assertIn(word, start)
            self.assertIn("Windhager et al. (2019)", start)


class HiddenAttribute(unittest.TestCase):
    def test_global_hidden_rule(self) -> None:
        # css/shell.css is the one stylesheet every static page and the views load.
        css = (ROOT / "css" / "shell.css").read_text(encoding="utf-8")
        self.assertRegex(css, r"@layer reset\s*\{\s*\[hidden\]\s*\{\s*display:\s*none\s*!important;?\s*\}")
        self.assertIn("css/shell.css", (ROOT / "index.html").read_text(encoding="utf-8"))
        self.assertIn("css/shell.css", (ROOT / "build_site.py").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
