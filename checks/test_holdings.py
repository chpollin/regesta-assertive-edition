"""The whole-delivery layer and the itinerary check against each other, on the real delivery.

The Atlas draws the placed regesta of data/holdings.json as one line and names, on a regest,
the flagged steps of data/itinerary-checks.json. Both files must therefore agree on the order
of the line and on the names of the places. Until 2026-11-18 they did not: the view re-sorted
same-day regesta by a rule of its own, so some flags named steps the cube did not draw, and
check_itinerary.py wrote „Cremam“ where the Atlas said Crema. The checks assert twice, as the
other checks do: the real data yield no error, and a named mutation yields at least one.

Usage
    uv run pytest -q checks/test_holdings.py
"""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import build_holdings  # noqa: E402
import check_itinerary  # noqa: E402
from edition_io import place_label  # noqa: E402

PIPELINE = ROOT / "pipeline"
COLLISION = "RI IV,2,2 n. 1520a"
# uids of RI IV,2,4 n. 3270 (dated to a span of months) and n. 3269 (dated to a day), both at Wien.
VAGUE, EXACT = "26093", "26092"
LINE = {"Tag", "Spanne"}
SEVEN, EIGHT = "RI IV,2,1 n. 5", "RI IV,2,1 n. 486"


def check_steps(line: list[str], flags: list[dict]) -> list[str]:
    """Every flagged pair is one step of the line (uids of the placed regesta in view order)."""
    position = {uid: i for i, uid in enumerate(line)}
    errors = []
    for flag in flags:
        a, b = flag["a"]["uid"], flag["b"]["uid"]
        if a not in position or b not in position or position[b] - position[a] != 1:
            errors.append(f"{flag['a']['identifier']} to {flag['b']['identifier']} is no step of the line")
    return errors


def check_line(line: list[str], holdings: dict, checks: dict) -> list[str]:
    """The line holds days and spans of at most a week only, and no flag touches a regest outside it."""
    by_uid = {r["u"]: r for r in holdings["regesta"]}
    errors = [f"{by_uid[u]['i']} ({by_uid[u]['k']}) lies in the line" for u in line if not by_uid[u]["ln"]]
    errors += [
        f"{by_uid[u]['i']} in the line is dated to a {by_uid[u]['k']}" for u in line if by_uid[u]["k"] not in LINE
    ]
    members = set(line)
    for flag in checks["flags"]:
        errors += [
            f"a flag names {s['identifier']} outside the line"
            for s in (flag["a"], flag["b"])
            if s["uid"] not in members
        ]
    return errors


def check_place_names(holdings: dict, flags: list[dict]) -> list[str]:
    """A flag names a place as the layer names it."""
    names = {p["l"] for p in holdings["places"].values()}
    return sorted(
        {f"flag names {s['place']}" for flag in flags for s in (flag["a"], flag["b"]) if s["place"] not in names}
    )


def check_collision(holdings: dict) -> list[str]:
    """The identifier of two records is reported, and its register rows reach neither record."""
    uids = holdings["ambiguous"].get(COLLISION, [])
    errors = [] if len(uids) == 2 else [f"{COLLISION} is not reported with its two records"]
    for pid, person in holdings["persons"].items():
        errors += [f"{pid} lists the ambiguous record {uid}" for uid in uids if uid in person["r"]]
    return errors


class HoldingsAndItinerary(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            cls.holdings = build_holdings.build(PIPELINE, Path(tmp))
        cls.checks = check_itinerary.build(PIPELINE)
        # The view keeps the order of the layer and sorts by date only, which the layer already is.
        cls.line = [r["u"] for r in cls.holdings["regesta"] if r["p"] and r["ln"]]

    def test_flags_are_steps_of_the_drawn_line(self) -> None:
        self.assertTrue(self.checks["flags"], "the check flags nothing")
        self.assertEqual(check_steps(self.line, self.checks["flags"]), [])
        # Mutation: a view that orders same-day regesta by a rule of its own, here the reverse one.
        placed = (r for r in self.holdings["regesta"] if r["p"] and r["ln"])
        other = sorted(placed, key=lambda r: [-ord(c) for c in r["i"]])
        other.sort(key=lambda r: r["s"])
        self.assertTrue(check_steps([r["u"] for r in other], self.checks["flags"]), "another order must break steps")

    def test_only_exact_datings_lie_in_the_line(self) -> None:
        """RI IV,2,4 n. 3270, „1189 (vor August 6, vielleicht Mitte Mai)“ at Wien, against n. 3269, „1189 Mai 18“."""
        by_uid = {r["u"]: r for r in self.holdings["regesta"]} | {r["i"]: r for r in self.holdings["regesta"]}
        vague, exact = by_uid[VAGUE], by_uid[EXACT]
        self.assertTrue(vague["p"] and exact["p"], "both regesta have a place of issue")
        self.assertEqual((vague["k"], vague["ln"]), ("Spanne", False))
        self.assertEqual((exact["k"], exact["ln"]), ("Tag", True))
        self.assertEqual(check_line(self.line, self.holdings, self.checks), [])
        self.assertNotIn(VAGUE, self.line)
        self.assertIn(EXACT, self.line)
        # The boundary on real regesta: a span of seven days is a station, one of eight days is not.
        self.assertTrue(by_uid[SEVEN]["p"] and by_uid[SEVEN]["ln"], "RI IV,2,1 n. 5, 6 to 13 April 1141")
        self.assertTrue(
            by_uid[EIGHT]["p"] and not by_uid[EIGHT]["ln"], "RI IV,2,1 n. 486, 28 September to 6 October 1157"
        )
        counts = self.checks["counts"]
        self.assertEqual(counts["inLine"], len(self.line))
        self.assertEqual(counts["inLine"] + sum(counts["outsideLine"].values()), counts["inView"])
        # Mutation: the former line through every placed regest, n. 3270 on 1 January 1189 included.
        former = [r["u"] for r in self.holdings["regesta"] if r["p"]]
        self.assertTrue(check_line(former, self.holdings, self.checks), "a line through n. 3270 must fail")

    def test_flags_name_places_as_the_layer_does(self) -> None:
        self.assertEqual(check_place_names(self.holdings, self.checks["flags"]), [])
        labels = {p["l"] for p in self.holdings["places"].values()}
        self.assertIn("Saint-Jean-de-Losne", labels)
        self.assertNotIn("Johannes", labels)
        # Mutation: the uncorrected rule, which reads the register label of Crema as „Cremam“.
        uncorrected = [
            {**f, "a": {**f["a"], "place": place_label("Cremam(am Serio)") if f["a"]["place"] == "Crema" else "x"}}
            for f in self.checks["flags"]
            if f["a"]["place"] == "Crema"
        ]
        self.assertTrue(uncorrected, "no flag at Crema to mutate")
        self.assertTrue(check_place_names(self.holdings, uncorrected))

    def test_ambiguous_identifier_is_reported_not_assigned(self) -> None:
        self.assertEqual(check_collision(self.holdings), [])
        # Mutation: the former join, where the last record of the identifier took every row.
        last = self.holdings["ambiguous"][COLLISION][-1]
        person = next(iter(self.holdings["persons"]))
        mutated = {
            **self.holdings,
            "persons": {person: {**self.holdings["persons"][person], "r": [last]}},
        }
        self.assertTrue(check_collision(mutated))


if __name__ == "__main__":
    unittest.main()
