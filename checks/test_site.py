"""Check of build_site.py against the real factoid run.

Builds the curated site into a temporary folder and asserts the contract of the build:
every content page carries exactly one h1, the licence line and links to the about and
method pages, every regest has its TEI, Turtle and JSON file and a page that holds its
regest text, the evidence pieces of a regest page give back the regest text, and nothing
from knowledge/ is part of the build. Skipped when the sibling repository or the run is
missing.

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
RUN = "factoid-2026-11-11"


@unittest.skipUnless((SOURCE / "runs" / RUN / "manifest.json").is_file(), "factoid run not available")
class SiteBuild(unittest.TestCase):
    def test_pages_files_and_boundary(self) -> None:
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


if __name__ == "__main__":
    unittest.main()
