"""The internal-material check of publish_site.py on a small build folder.

Only the curated build is ever served (AGENTS.md, Boundaries), and `_check_site` is the last
gate before the push. The check asserts twice: a clean build passes, and each named mutation,
a kind of internal material placed into the build, aborts. Until 2026-11-18 the gate let the
agent review, the view data of the preview build, pipeline material and a page with an
upper-case suffix through.

Usage
    uv run pytest -q checks/test_publish.py
"""

from __future__ import annotations

import sys
import tempfile
import unittest
import zipfile
from pathlib import Path
from typing import ClassVar

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import publish_site  # noqa: E402

MUTATIONS = {
    "knowledge/plan.md": "# Plan",
    "edition/agent-review-2026-11-14/reader-a-part1.json": "{}",
    "ansicht/data/edition.json": '{"regests":[{"blocks":[{"head":{"agentReview":{}}}]}]}',
    "pipeline/contracts/x/prompts/extract.txt": "prompt",
    "daten/RI_004-002-ReggBarbarossa.csv": "identifier,uid",
    "queries/abstentions.rq": "SELECT * WHERE {}",
    "preview/INDEX.HTML": '<meta name="edition-preview" content="agent-review-2026-11-14">',
    "regesten/index.html": '<a href="../knowledge/journal.md">journal</a>',
}


def _problems(files: dict[str, str]) -> str:
    """The message of the gate for a build of these files, or the empty string when it passes."""
    with tempfile.TemporaryDirectory() as tmp:
        for name, content in files.items():
            path = Path(tmp) / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")
        site, publish_site.SITE = publish_site.SITE, Path(tmp)
        try:
            publish_site._check_site()
        except publish_site.PublishError as error:
            return str(error)
        finally:
            publish_site.SITE = site
    return ""


class InternalMaterial(unittest.TestCase):
    clean: ClassVar[dict[str, str]] = {
        "index.html": '<a href="regesten/">Regesten</a>',
        "ansicht/data/holdings.json": "{}",
    }

    def test_clean_build_passes(self) -> None:
        self.assertEqual(_problems(self.clean), "")

    def test_each_kind_of_internal_material_aborts(self) -> None:
        for name, content in MUTATIONS.items():
            with self.subTest(name=name):
                self.assertIn(name, _problems({**self.clean, name: content}))

    def test_package_with_internal_material_aborts(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            (Path(tmp) / "index.html").write_text("<p>Edition</p>", encoding="utf-8")
            (Path(tmp) / "daten").mkdir()
            with zipfile.ZipFile(Path(tmp) / "daten" / "package.zip", "w") as package:
                package.writestr("tei/iv-2-1-1.xml", "<TEI/>")
            site, publish_site.SITE = publish_site.SITE, Path(tmp)
            try:
                publish_site._check_site()
                with zipfile.ZipFile(Path(tmp) / "daten" / "package.zip", "a") as package:
                    package.writestr("knowledge/journal.md", "# Journal")
                with self.assertRaises(publish_site.PublishError):
                    publish_site._check_site()
            finally:
                publish_site.SITE = site


if __name__ == "__main__":
    unittest.main()
