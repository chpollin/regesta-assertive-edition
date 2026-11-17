"""Evidence check of the factoid path of build_data.py against the real factoid run.

Builds runs/factoid-2026-11-11 of the sibling repository into a temporary folder, for both
stages, and asserts that every evidence span of edition.json is verbatim regest text: a
factoid span is exactly one oa:exact selector of the run's Turtle, a literal span is the
literal's own wording. Skipped when the sibling repository or the run is missing.

Usage
    python -m unittest discover -s checks -p "test_*.py"
"""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path

import rdflib

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import build_data

SOURCE = Path(__file__).resolve().parent.parent / "pipeline"
RUN = "factoid-2026-11-11"


@unittest.skipUnless((SOURCE / "runs" / RUN / "manifest.json").is_file(), "factoid run not available")
class FactoidEvidence(unittest.TestCase):
    def _build(self, stage: str) -> dict:
        with tempfile.TemporaryDirectory() as tmp, redirect_stdout(StringIO()):
            build_data.build(SOURCE, RUN, Path(tmp), stage)
            return json.loads((Path(tmp) / "edition.json").read_text(encoding="utf-8"))

    def _check_stage(self, stage: str) -> None:
        edition = self._build(stage)
        self.assertEqual(edition["run"]["dataModel"], "factoid")
        for regest in edition["regests"]:
            uid, text = regest["uid"], regest["text"]
            g = rdflib.Graph().parse(SOURCE / "runs" / RUN / stage / f"{uid}.ttl", format="turtle")
            exacts = {str(o) for o in g.objects(None, build_data.OA.exact)}
            for exact in exacts:
                self.assertIn(exact, text, f"{uid}: selector not verbatim")
            literals = {
                ln["id"]: ln["text"]
                for b in regest["blocks"]
                for ln in b["lines"]
                if ln["kind"] == "literal" and ln.get("id")
            }
            selectors = sum(1 for _ in g.subject_objects(build_data.RF.evidence))
            self.assertEqual(len(regest["spans"]) - len(literals), selectors, f"{uid}: one span per selector")
            for span in regest["spans"]:
                wording = text[span["start"] : span["end"]]
                if span["id"] in literals:
                    self.assertEqual(wording, literals[span["id"]], f"{uid} {span['id']}")
                else:
                    self.assertIn(wording, exacts, f"{uid} {span['id']}: span is not a selector of the run")
            for b in regest["blocks"]:
                phrases = [p for p in b["sentence"] if isinstance(p, dict)]
                self.assertTrue(phrases, f"{uid}: block without phrase")
                for phrase in phrases:
                    self.assertTrue(phrase["keys"], f"{uid}: phrase without evidence line")

    def test_revised_spans_are_verbatim(self) -> None:
        self._check_stage("revised")

    def test_extracted_spans_are_verbatim(self) -> None:
        self._check_stage("extracted")

    def test_same_name_parents_found(self) -> None:
        edition = self._build("revised")
        same = [e for e in edition["graph"]["edges"] if e["kind"] == "same-name"]
        self.assertEqual(
            {(e["source"], e["target"]) for e in same},
            {("urn:regesta:actor:RI004-002-T000162", "urn:regesta:actor:RI004-002-T000163")},
        )


class NameKey(unittest.TestCase):
    def test_inflection_is_ignored(self) -> None:
        self.assertEqual(
            build_data._name_key("Markgraf Diepolds von Vohburg"),
            build_data._name_key("Markgrafen Diepold von Vohburg"),
        )

    def test_different_names_differ(self) -> None:
        self.assertNotEqual(build_data._name_key("Markgraf Diepold"), build_data._name_key("Graf Diepold"))


if __name__ == "__main__":
    unittest.main()
