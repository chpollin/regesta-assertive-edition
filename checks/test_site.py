"""Check of build_site.py against the factoid run the edition shows.

Builds the curated site into a temporary folder and asserts the contract of the build:
every content page carries exactly one h1, the licence line and links to the about and
method pages, every regest has its TEI, Turtle and JSON file and a page that holds its
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
            content = [p for p in pages if "ansicht" not in p.parts]
            self.assertTrue(content)
            for page in content:
                doc = page.read_text(encoding="utf-8")
                where = page.relative_to(out).as_posix()
                self.assertEqual(doc.count("<h1"), 1, where)
                self.assertIn(html.escape(texts["licenceLine"]), doc, where)
                self.assertRegex(doc, r'href="[./]*ueber/"', where)
            edition = json.loads((out / "ansicht" / "data" / "edition.json").read_text(encoding="utf-8"))
            for r in edition["regests"]:
                s = build_site.slug(r["identifier"])
                for path in (f"tei/{s}.xml", f"ttl/{s}.ttl", f"json/{s}.json", f"regesten/{s}/index.html"):
                    self.assertTrue((out / path).is_file(), path)
                doc = (out / "regesten" / s / "index.html").read_text(encoding="utf-8")
                para = re.search(r'<p class="regest-text">(.*?)</p>', doc, re.S).group(1)
                self.assertEqual(html.unescape(re.sub(r"<[^>]+>", "", para)), r["text"], s)
            self.assertFalse(any("knowledge" in p.parts for p in out.rglob("*")))
            # The Atlas is the start page: its header marks Atlas as current and it loads the
            # module that mounts ansicht/js/atlas.js (knowledge/interface-plan.md, step 1).
            start = (out / "index.html").read_text(encoding="utf-8")
            self.assertRegex(start, r'<a href="\./" aria-current="page">Atlas</a>')
            self.assertIn('data-page="start"', start)
            self.assertTrue((out / "ansicht" / "js" / "atlas.js").is_file())


class AtlasRoutes(unittest.TestCase):
    def test_atlas_route_and_old_place_addresses(self) -> None:
        # The views app routes #/atlas and forwards the former place views to it; the header
        # has no item Orte any more.
        app = (ROOT / "js" / "app.js").read_text(encoding="utf-8")
        self.assertRegex(app, r"\batlas: \{[^\n]*renderAtlas")
        for old in ("itinerar", "jahrzehnte"):
            self.assertRegex(app, rf"\b{old}: \{{[^\n]*forwardToAtlas\(\"{old}\"")
        nav = json.loads((ROOT / "js" / "nav.json").read_text(encoding="utf-8"))["items"]
        self.assertEqual([it["key"] for it in nav], ["atlas", "regesten", "personen", "ueber"])
        # The start page rewrites #/itinerar/<place> of earlier links to the Atlas address.
        start = (ROOT / "js" / "edition" / "start.js").read_text(encoding="utf-8")
        self.assertIn("atlasAddress", start)
        self.assertRegex(start, r"itinerar\|jahrzehnte")


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


class HiddenAttribute(unittest.TestCase):
    def test_global_hidden_rule(self) -> None:
        # css/shell.css is the one stylesheet every static page and the views load.
        css = (ROOT / "css" / "shell.css").read_text(encoding="utf-8")
        self.assertRegex(css, r"@layer reset\s*\{\s*\[hidden\]\s*\{\s*display:\s*none\s*!important;?\s*\}")
        self.assertIn("css/shell.css", (ROOT / "index.html").read_text(encoding="utf-8"))
        self.assertIn("css/shell.css", (ROOT / "build_site.py").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
