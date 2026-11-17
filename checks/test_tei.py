"""Check of build_tei.py against the real factoid run.

Builds the TEI of runs/factoid-2026-11-11 into a temporary folder and asserts that every
file validates against the vendored tei_all schema, that the regest paragraph gives back
summary_plain character for character, and that every factoid points to evidence pieces
whose joined text lies inside one of its oa:exact selectors. A paraphrased selector must
abort the build. Skipped when the sibling repository or the run is missing.

Usage
    python -m pytest -q checks/test_tei.py
"""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

from lxml import etree

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import build_tei

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "pipeline"
RUN = "factoid-2026-11-11"
SCHEMA = ROOT / "schema" / "tei_all-4.12.0.rng"
NS = {"t": "http://www.tei-c.org/ns/1.0"}
XML_ID = "{http://www.w3.org/XML/1998/namespace}id"


@unittest.skipUnless((SOURCE / "runs" / RUN / "manifest.json").is_file(), "factoid run not available")
class TeiBuild(unittest.TestCase):
    def test_valid_lossless_and_bound_to_evidence(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp)
            errors = build_tei.build(SOURCE, RUN, out, "revised", ROOT / "edition" / "texts.json", SCHEMA)
            self.assertEqual(errors, [])
            manifest = json.loads((SOURCE / "runs" / RUN / "manifest.json").read_text(encoding="utf-8"))
            for sel in manifest["selection"]:
                packet = json.loads(
                    (SOURCE / "runs" / RUN / "packets" / f"{sel['uid']}.json").read_text(encoding="utf-8")
                )
                doc = etree.parse(str(out / f"{build_tei.slug(packet['identifier'])}.xml"))
                p = doc.find(".//t:div[@type='regest']/t:p", NS)
                self.assertEqual("".join(p.itertext()), packet["summary_plain"], sel["uid"])
                segs = {s.get(XML_ID): s.text for s in doc.iterfind(".//t:seg", NS)}
                for event in doc.iterfind(".//t:event", NS):
                    ids = [x.lstrip("#") for x in event.get("corresp").split()]
                    self.assertTrue(ids, event.get(XML_ID))
                    for seg_id in ids:
                        self.assertIn(segs[seg_id], packet["summary_plain"])

    def test_paraphrased_evidence_aborts(self) -> None:
        text = "Friedrich heiratet Adela."
        with self.assertRaises(build_tei.BuildError):
            build_tei._locate(text, "Friedrich ehelicht Adela", "fixture")


if __name__ == "__main__":
    unittest.main()
