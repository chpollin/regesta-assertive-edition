"""Transfer checks of the factoid run from the supplied CSV files to RDF, view data and TEI.

Runs against the real run pipeline/runs/factoid-1153-2026-11-11 and the two Regesta Imperii
CSV files in pipeline/source-material. Each check is a function that returns a list of
errors, so every test asserts twice: the real data yield no error, and a named mutation of
the real data yields at least one. A check that cannot fail on its mutation proves nothing.

What these checks establish is faithful transfer, not historical correctness: no statement
of the run is expert validated (manifest expert_accepted false).

1. Completeness: every selected UID has a packet, an extracted and a revised result, a
   regest in edition.json and a TEI file, and no stage holds a UID outside the selection.
2. Field round trip: identifier, dates, place and summary of each CSV row arrive unchanged
   in packet, edition.json and TEI.
3. Register references: every register entry the CSV assigns to a selected regest is an
   identity candidate of its packet, and every register actor in the revised RDF and the
   TEI is a candidate of its own packet or the shared ruler.
4. Quote round trip: every oa:exact selector of the revised RDF and every TEI evidence span
   is verbatim regest text, and the TEI regest paragraph reads back as the regest text.

Usage
    uv run pytest -q checks/test_pipeline.py
"""

from __future__ import annotations

import copy
import importlib.util
import json
import sys
import tempfile
import unittest
import xml.etree.ElementTree as ET
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path

import rdflib

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import build_data  # noqa: E402
import build_tei  # noqa: E402
from edition_io import read_csv  # noqa: E402

PIPELINE = ROOT / "pipeline"
RUN = "factoid-1153-2026-11-11"
RUN_DIR = PIPELINE / "runs" / RUN
REGESTS_CSV = PIPELINE / "source-material" / "RI_004-002-ReggBarbarossa.csv"
REGISTER_CSV = PIPELINE / "source-material" / "RI_004-002-RegisterBarbarossa.csv"
TEI = "{http://www.tei-c.org/ns/1.0}"
OA_EXACT = rdflib.URIRef("http://www.w3.org/ns/oa#exact")
ACTOR_PREFIX = "urn:regesta:actor:"


def _plain(value: str) -> str:
    # The same reading derivative the pipeline uses, so the check compares like with like.
    spec = importlib.util.spec_from_file_location("explore_regesta", PIPELINE / "explore_regesta.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module._plain(value)


def _norm(text: str) -> str:
    return " ".join(text.split())


def _null(value: str | None) -> str:
    return "" if value is None or value.strip().lower() in {"", "null"} else value


def load_world() -> dict:
    """Read the real run and build edition.json and TEI into a temporary folder."""
    selection = [s["uid"] for s in json.loads((RUN_DIR / "selection.json").read_text(encoding="utf-8"))]
    packets = {p.stem: json.loads(p.read_text(encoding="utf-8")) for p in sorted((RUN_DIR / "packets").glob("*.json"))}
    stages = {
        stage: {p.stem: p.read_text(encoding="utf-8") for p in (RUN_DIR / stage).glob("*.ttl")}
        for stage in ("extracted", "revised")
    }
    with tempfile.TemporaryDirectory() as tmp, redirect_stdout(StringIO()):
        out = Path(tmp)
        build_data.build(PIPELINE, RUN, out / "data", "revised")
        edition = json.loads((out / "data" / "edition.json").read_text(encoding="utf-8"))
        build_tei.build(PIPELINE, RUN, out / "tei", "revised", ROOT / "edition" / "texts.json", None)
        tei = {p.name: ET.parse(p).getroot() for p in (out / "tei").glob("*.xml")}
    wanted = set(selection)
    rows = {r["uid"]: r for r in read_csv(REGESTS_CSV) if r["uid"] in wanted}
    identifiers = {packets[u]["identifier"] for u in selection if u in packets}
    register: dict[str, set[str]] = {}
    for r in read_csv(REGISTER_CSV):
        if r["regestaIdentifier"] in identifiers:
            register.setdefault(r["regestaIdentifier"], set()).add(r["id"])
    tei_by_uid = {}
    for root in tei.values():
        title = root.find(f".//{TEI}title[@type='main']").text
        tei_by_uid[next(u for u in selection if packets[u]["identifier"] == title)] = root
    return {
        "selection": selection,
        "packets": packets,
        "stages": stages,
        "edition": {r["uid"]: r for r in edition["regests"]},
        "tei": tei_by_uid,
        "rows": rows,
        "register": register,
    }


def check_completeness(w: dict) -> list[str]:
    want = set(w["selection"])
    errors = []
    if len(want) != len(w["selection"]):
        errors.append("selection repeats a UID")
    for name, have in (
        ("packets", set(w["packets"])),
        ("extracted", set(w["stages"]["extracted"])),
        ("revised", set(w["stages"]["revised"])),
        ("edition.json", set(w["edition"])),
        ("TEI", set(w["tei"])),
        ("CSV", set(w["rows"])),
    ):
        errors += [f"{name}: missing {u}" for u in sorted(want - have)]
        errors += [f"{name}: outside the selection {u}" for u in sorted(have - want)]
    return errors


def check_fields(w: dict) -> list[str]:
    errors = []
    for uid in w["selection"]:
        row, packet = w["rows"].get(uid), w["packets"].get(uid)
        regest, tei = w["edition"].get(uid), w["tei"].get(uid)
        if not (row and packet and regest and tei is not None):
            errors.append(f"{uid}: missing in a stage")
            continue
        # A regest without summary (CSV "null") has no text in any stage.
        plain = _plain(_null(row["summary"]))
        expect = {
            "packet identifier": (packet["identifier"], row["identifier"]),
            "packet summary_plain": (packet["summary_plain"] or "", plain),
            "packet date_string": (packet["date_string"], row["date_string"]),
            "packet machine_start": (packet["machine_start"], row["start_date"]),
            "packet machine_end": (packet["machine_end"], row["end_date"]),
            "edition identifier": (regest["identifier"], row["identifier"]),
            "edition start": (regest["start"], row["start_date"]),
            "edition end": (regest["end"], row["end_date"]),
            "edition date": (_norm(" ".join(d["t"] for d in regest["date"])), _norm(_null(row["date_string"]))),
            "edition place": (_norm(" ".join(p["t"] for p in regest["place"])), _norm(_null(row["locality_string"]))),
            "edition lead": (regest["lead"], plain[: len(regest["lead"])]),
        }
        date = tei.find(f".//{TEI}div[@type='regest']/{TEI}head/{TEI}date")
        para = tei.find(f".//{TEI}div[@type='regest']/{TEI}p")
        expect["TEI title"] = (tei.find(f".//{TEI}title[@type='main']").text, row["identifier"])
        expect["TEI date from"] = (date.get("from") if date is not None else None, row["start_date"])
        expect["TEI date to"] = (date.get("to") if date is not None else None, row["end_date"])
        expect["TEI date text"] = (
            _norm("".join(date.itertext())) if date is not None else "",
            _norm(_null(row["date_string"])),
        )
        expect["TEI regest text"] = (_norm("".join(para.itertext())) if para is not None else "", _norm(plain))
        # The view data collapse runs of whitespace; that is the only normalisation allowed here.
        errors += [f"{uid}: {k} {a!r} != {b!r}" for k, (a, b) in expect.items() if a != b]
    return errors


def _register_actors(text: str) -> set[str]:
    g = rdflib.Graph().parse(data=text, format="turtle")
    ids = {str(n)[len(ACTOR_PREFIX) :] for n in g.all_nodes() if str(n).startswith(ACTOR_PREFIX)}
    # Regest-local and functional actors carry their own identifier policy; only register IDs are compared.
    return {i.split(":")[0] for i in ids if ":local:" not in i and not i.split(":")[0].startswith(("local", "fn"))}


def check_register(w: dict) -> list[str]:
    errors = []
    for uid in w["selection"]:
        packet = w["packets"].get(uid)
        if packet is None:
            errors.append(f"{uid}: no packet")
            continue
        candidates = {c["id"] for c in packet["identity_candidates"]}
        allowed = candidates | {packet["shared_ruler"]["iri"][len(ACTOR_PREFIX) :]}
        in_csv = w["register"].get(packet["identifier"], set())
        errors += [f"{uid}: register entry {r} missing from the packet" for r in sorted(in_csv - candidates)]
        errors += [f"{uid}: packet candidate {r} not in the register" for r in sorted(candidates - in_csv)]
        for actor in sorted(_register_actors(w["stages"]["revised"].get(uid, "")) - allowed):
            if actor.startswith("RI004-002-"):
                errors.append(f"{uid}: RDF actor {actor} outside its packet")
        tei = w["tei"].get(uid)
        if tei is not None:
            for idno in tei.iter(f"{TEI}idno"):
                if idno.get("type") == "register" and idno.text not in allowed:
                    errors.append(f"{uid}: TEI register reference {idno.text} outside its packet")
    return errors


def check_quotes(w: dict) -> list[str]:
    errors = []
    for uid in w["selection"]:
        packet = w["packets"].get(uid)
        if packet is None:
            continue
        text = packet["summary_plain"] or ""
        g = rdflib.Graph().parse(data=w["stages"]["revised"].get(uid, ""), format="turtle")
        for exact in g.objects(None, OA_EXACT):
            if str(exact) not in text:
                errors.append(f"{uid}: oa:exact not verbatim: {str(exact)[:60]!r}")
        tei = w["tei"].get(uid)
        if tei is None:
            continue
        para = tei.find(f".//{TEI}div[@type='regest']/{TEI}p")
        ids = set()
        for seg in para.iter(f"{TEI}seg") if para is not None else ():
            ids.add(seg.get("{http://www.w3.org/XML/1998/namespace}id"))
            if "".join(seg.itertext()) not in text:
                errors.append(f"{uid}: TEI evidence span not verbatim")
        for event in tei.iter(f"{TEI}event"):
            for ref in (event.get("corresp") or "").split():
                if ref.lstrip("#") not in ids:
                    errors.append(
                        f"{uid}: {event.get('{http://www.w3.org/XML/1998/namespace}id')} cites missing span {ref}"
                    )
    return errors


class PipelineTransfer(unittest.TestCase):
    world: dict

    @classmethod
    def setUpClass(cls) -> None:
        cls.world = load_world()

    def _mutated(self) -> dict:
        return copy.deepcopy(self.world)

    def test_completeness(self) -> None:
        self.assertEqual(check_completeness(self.world), [])
        self.assertEqual(len(self.world["selection"]), 224)
        w = self._mutated()
        del w["stages"]["revised"][w["selection"][5]]
        self.assertTrue(check_completeness(w), "a missing revised file must fail")

    def test_field_round_trip(self) -> None:
        self.assertEqual(check_fields(self.world), [])
        w = self._mutated()
        uid = w["selection"][1]
        w["edition"][uid]["start"] = "1122-12-21"
        self.assertTrue(check_fields(w), "a changed start date must fail")
        w = self._mutated()
        para = w["tei"][uid].find(f".//{TEI}div[@type='regest']/{TEI}p")
        para.text = (para.text or "") + "x"
        self.assertTrue(check_fields(w), "a changed TEI regest text must fail")

    def test_register_references(self) -> None:
        self.assertEqual(check_register(self.world), [])
        w = self._mutated()
        uid = w["selection"][1]
        w["packets"][uid]["identity_candidates"].pop()
        self.assertTrue(check_register(w), "a dropped register reference must fail")
        w = self._mutated()
        other = next(u for u in w["selection"] if u != uid)
        foreign = next(
            c["id"]
            for c in w["packets"][other]["identity_candidates"]
            if c["id"] not in {d["id"] for d in w["packets"][uid]["identity_candidates"]}
        )
        w["stages"]["revised"][uid] += f"\n<urn:x> <urn:y> <{ACTOR_PREFIX}{foreign}> .\n"
        self.assertTrue(check_register(w), "an actor from a foreign packet must fail")

    def test_quote_round_trip(self) -> None:
        self.assertEqual(check_quotes(self.world), [])
        w = self._mutated()
        uid = w["selection"][1]
        w["stages"]["revised"][uid] = w["stages"]["revised"][uid].replace("wird als Sohn", "wird als Erbe", 1)
        self.assertTrue(check_quotes(w), "a changed oa:exact must fail")
        w = self._mutated()
        seg = next(w["tei"][uid].iter(f"{TEI}seg"))
        seg.text = "Barbarossa"
        self.assertTrue(check_quotes(w), "a changed TEI evidence span must fail")


if __name__ == "__main__":
    unittest.main()
