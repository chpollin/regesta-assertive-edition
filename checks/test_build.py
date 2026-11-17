"""Regression checks for the evidence contract of build_data.py.

Usage
    uv run pytest -q checks/test_build.py
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

import rdflib

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import build_data

TEXT = "Friedrich heiratet Adela, die Tochter Markgraf Diepolds von Vohburg."

TURTLE = """
@prefix reg: <https://example.org/regesta/ontology/> .
@prefix v: <https://example.org/regesta/vocab/> .
@prefix crm: <http://www.cidoc-crm.org/cidoc-crm/> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix x: <urn:regesta:1:> .
<urn:regesta:record:1> a crm:E31_Document .
<urn:regesta:actor:a> a crm:E21_Person ; rdfs:label "Adela" ; crm:P152_has_parent <urn:regesta:actor:d> .
<urn:regesta:actor:d> a crm:E21_Person ; rdfs:label "Markgraf Diepold von Vohburg" .
x:a4 a crm:E13_Attribute_Assignment ; crm:P140_assigned_attribute_to <urn:regesta:actor:a> ;
  crm:P177_assigned_property_of_type crm:P152_has_parent ; crm:P141_assigned <urn:regesta:actor:d> ;
  reg:source <urn:regesta:record:1> ; reg:evidence "EVIDENCE" .
"""


def graph(evidence: str) -> rdflib.Graph:
    return rdflib.Graph().parse(data=TURTLE.replace("EVIDENCE", evidence), format="turtle")


class EvidenceContract(unittest.TestCase):
    def test_verbatim_evidence_is_located(self) -> None:
        result = build_data._build_statements(
            graph("Adela, die Tochter Markgraf Diepolds von Vohburg"), "1", TEXT, True
        )
        line = result["blocks"][0]["lines"][0]
        self.assertEqual(
            TEXT[line["evidence"]["start"] : line["evidence"]["end"]],
            "Adela, die Tochter Markgraf Diepolds von Vohburg",
        )

    def test_paraphrased_evidence_aborts(self) -> None:
        with self.assertRaises(build_data.BuildError):
            build_data._build_statements(graph("Adela, Tochter des Markgrafen Diepold"), "1", TEXT, True)

    def test_case_change_aborts(self) -> None:
        with self.assertRaises(build_data.BuildError):
            build_data._build_statements(graph("adela, die Tochter"), "1", TEXT, True)


if __name__ == "__main__":
    unittest.main()
