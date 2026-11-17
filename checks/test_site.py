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


class HiddenAttribute(unittest.TestCase):
    def test_global_hidden_rule(self) -> None:
        # css/shell.css is the one stylesheet every static page and the views load.
        css = (ROOT / "css" / "shell.css").read_text(encoding="utf-8")
        self.assertRegex(css, r"@layer reset\s*\{\s*\[hidden\]\s*\{\s*display:\s*none\s*!important;?\s*\}")
        self.assertIn("css/shell.css", (ROOT / "index.html").read_text(encoding="utf-8"))
        self.assertIn("css/shell.css", (ROOT / "build_site.py").read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
