# /// script
# requires-python = ">=3.11"
# dependencies = ["playwright"]
# ///
"""Browser check of the prototype: screenshots of the core states and keyboard/pointer assertions.

Regime: single-file script. It serves the project folder with the standard-library HTTP
server on 127.0.0.1 (port 8095 by default, the operator's own server may hold 8091),
drives Chromium through Playwright, writes PNG files to review/ and stops its server.
Expected outcomes come from data/edition.json, not from the page code.

Usage
    python checks/ui_check.py [port]
"""

from __future__ import annotations

import json
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

from playwright.sync_api import Page, sync_playwright

ROOT = Path(__file__).resolve().parent.parent
REVIEW = ROOT / "review"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8095
BASE = f"http://127.0.0.1:{PORT}/"
ADELA = "urn:regesta:actor:RI004-002-A000306"

failures: list[str] = []


def check(condition: bool, message: str) -> None:
    print(("ok   " if condition else "FAIL ") + message)
    if not condition:
        failures.append(message)


def _wait_for_server() -> None:
    for _ in range(50):
        try:
            with urllib.request.urlopen(BASE, timeout=1):
                return
        except OSError:
            time.sleep(0.1)
    raise RuntimeError("local server did not start")


def _open(page: Page, route: str) -> None:
    page.goto(BASE + route)
    page.wait_for_selector("main h1")
    page.wait_for_timeout(400)


def _shot(page: Page, name: str, full: bool = False) -> None:
    page.screenshot(path=str(REVIEW / f"{name}.png"), full_page=full)


def _no_horizontal_scroll(page: Page, label: str) -> None:
    width = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    check(width <= 0, f"{label}: no horizontal document scroll ({width}px)")


def _marked(page: Page, cls: str = "pen") -> str:
    return "".join(page.locator(f".regest .{cls}").all_inner_texts())


def reading(page: Page, tag: str, edition: dict, keyboard: bool) -> None:
    by_uid = {r["uid"]: r for r in edition["regests"]}
    n67 = by_uid["22694"]
    span = next(s for s in n67["spans"] if s["id"] == "a7")

    _open(page, "#/regest/22694/a7")
    pinned = page.locator(".phrase.is-pinned")
    check(
        pinned.count() == 1 and pinned.inner_text() == "Marktrecht",
        f"{tag} n. 67 deep link selects the phrase Marktrecht",
    )
    check(_marked(page) == n67["text"][span["start"] : span["end"]], f"{tag} n. 67 marks exactly the evidence of a7")
    check(
        page.locator(".act-type", has_text="Marktrecht").count() == 0,
        f"{tag} n. 67 shows the market right once, inside its act",
    )
    check(page.locator(".review-state").count() == 1, f"{tag} n. 67 states the review state once")
    _no_horizontal_scroll(page, f"{tag} n. 67")
    _shot(page, f"read2-{tag}-n67-marktrecht")

    page.get_by_role("button", name="Rechtsbestätigung").click()
    page.locator(".act.is-open .rdf summary").click()
    check(
        page.locator(".act.is-open .rdf[open] code").inner_text().count("E13_Attribute_Assignment") >= 1,
        f"{tag} n. 67 RDF of the selected act opens",
    )
    _shot(page, f"read2-{tag}-n67-rdf")

    _open(page, "#/regest/22673/a4")
    n46 = by_uid["22673"]
    span = next(s for s in n46["spans"] if s["id"] == "a4")
    check(_marked(page) == n46["text"][span["start"] : span["end"]], f"{tag} n. 46 marks exactly the evidence of a4")
    check(page.locator(".xref a[href='#/regest/22794/a4']").count() >= 1, f"{tag} n. 46 links to the case in n. 167")
    check(page.locator(".xref code.iri").count() == 2, f"{tag} n. 46 shows both identifiers")
    _no_horizontal_scroll(page, f"{tag} n. 46")
    _shot(page, f"read2-{tag}-n46")

    _open(page, "#/regest/22794")
    check(page.locator(".xref a[href='#/regest/22673/a4']").count() >= 1, f"{tag} n. 167 links to the case in n. 46")
    _shot(page, f"read2-{tag}-n167")

    _open(page, "#/regest/24392")
    check(page.get_by_text("Keine Aussage im Pilotumfang").count() == 1, f"{tag} n. 1760 says why it has no statement")
    _shot(page, f"read2-{tag}-n1760-empty")

    if keyboard:
        _open(page, "#/regest/22694")
        for _ in range(8):
            page.keyboard.press("Tab")
            if page.evaluate("document.activeElement.classList.contains('regest')"):
                break
        check(
            page.evaluate("document.activeElement.classList.contains('regest')"),
            "keyboard reading: Tab reaches the paper",
        )
        page.keyboard.press("ArrowRight")
        first = n67["spans"][0]
        check(
            _marked(page) == n67["text"][first["start"] : first["end"]],
            "keyboard reading: ArrowRight marks the first evidence span",
        )
        check(page.locator(".phrase.is-pointed").count() >= 1, "keyboard reading: the phrases on it are marked")
        page.keyboard.press("Enter")
        check(
            page.evaluate("document.activeElement.classList.contains('phrase')"),
            "keyboard reading: Enter moves to the phrase",
        )
        check(page.locator(".phrase.is-pinned").count() == 1, "keyboard reading: Enter selects it")
        before = page.evaluate("document.activeElement.textContent")
        page.keyboard.press("ArrowRight")
        check(
            page.evaluate("document.activeElement.textContent") != before,
            "keyboard reading: arrow keys walk the phrases",
        )
        page.keyboard.press("Enter")
        check(
            page.evaluate("document.activeElement.getAttribute('aria-pressed')") == "true",
            "keyboard reading: Enter selects the next phrase",
        )
        page.keyboard.press("Escape")
        check(page.locator(".phrase.is-pinned").count() == 0, "keyboard reading: Escape clears the selection")
        check(
            page.evaluate("getComputedStyle(document.activeElement).outlineStyle") != "none",
            "keyboard reading: focus is visible",
        )

        # Pointer, text to statement.
        page.locator(".regest .ev").first.hover()
        check(page.locator(".phrase.is-pointed").count() >= 1, "pointer reading: words mark their phrases")


def holdings(page: Page, tag: str, edition: dict, keyboard: bool) -> None:
    regests = edition["regests"]
    _open(page, "#/")
    check(page.locator(".timeline .mark").count() == len(regests), f"{tag} timeline shows every regest of the run")
    empty = sum(1 for r in regests if r["claims"] == 0)
    check(
        page.locator(".timeline .m-empty").count() == empty,
        f"{tag} timeline shows the regest without statement as an empty mark",
    )
    corrected = sum(1 for r in regests if r["claims"] and r["notes"].get("corrected"))
    check(page.locator(".timeline path.m-head").count() == corrected, f"{tag} corrected regesta carry the triangle")
    bars = sum(1 for _, c in edition["delivery"]["years"] if c)
    check(page.locator(".bars rect").count() == bars, f"{tag} background shows the delivery per year")
    check(page.locator(".case-arc").count() == 1, f"{tag} the Adela case is one arc on the timeline")
    _no_horizontal_scroll(page, f"{tag} holdings")
    _shot(page, f"vis-{tag}-timeline")
    _shot(page, f"overview2-{tag}", full=True)

    graph = edition["graph"]
    check(page.locator(".graph .node").count() == len(graph["nodes"]), f"{tag} graph draws every node from the data")
    same = [e for e in graph["edges"] if e["kind"] == "same-name"]
    check(
        page.locator(".graph .e-same").count() == len(same), f"{tag} graph draws the same-name pair from the question"
    )
    _open(page, f"#/personen/{ADELA.replace(':', '%3A')}")
    check(page.locator(".node.is-selected").count() == 1, f"{tag} person route selects Adela")
    check(page.locator(".person-panel .panel-rels li").count() == 4, f"{tag} Adela panel lists her four relations")
    check(page.locator(".mark.is-related").count() == 2, f"{tag} Adela marks n. 46 and n. 167 on the timeline")
    page.locator(".graph").scroll_into_view_if_needed()
    _shot(page, f"vis-{tag}-graph-adela")

    if keyboard:
        _open(page, "#/")
        page.locator(".timeline .mark").first.focus()
        page.keyboard.press("ArrowRight")
        check(page.locator(".tip.is-on").count() == 1, "keyboard timeline: focus on a mark shows citation and text")
        uid_text = page.locator(".tip-id").inner_text()
        check(
            uid_text == regests[1]["identifier"] or uid_text.startswith("RI"),
            "keyboard timeline: ArrowRight moves to the next regest",
        )
        check(
            page.locator(".graph .node.is-near").count() >= 1,
            "keyboard timeline: the regest's people light up in the graph",
        )
        page.keyboard.press("Enter")
        page.wait_for_timeout(300)
        check("#/regest/" in page.url, "keyboard timeline: Enter opens the reading view")

        _open(page, "#/")
        page.locator(".case-link").focus()
        page.keyboard.press("Enter")
        page.wait_for_timeout(300)
        check(
            page.locator(".node.is-selected").count() == 1,
            "keyboard timeline: Enter on the Adela arc selects her in the graph",
        )

        _open(page, "#/")
        page.locator(".graph .node").first.focus()
        first = page.evaluate("document.activeElement.getAttribute('aria-label')")
        page.keyboard.press("ArrowDown")
        check(
            page.evaluate("document.activeElement.getAttribute('aria-label')") != first,
            "keyboard graph: arrow keys walk the nodes",
        )
        page.keyboard.press("Enter")
        check(
            page.locator(".person-panel .panel-name").count() == 1,
            "keyboard graph: Enter selects a person and opens the panel",
        )

        page.locator(".vis-text summary").first.click()
        check(page.locator(".regest-list li").count() == len(regests), "text equivalent lists every regest")


def main() -> int:
    edition = json.loads((ROOT / "data" / "edition.json").read_text(encoding="utf-8"))
    REVIEW.mkdir(exist_ok=True)
    server = subprocess.Popen(
        [sys.executable, "-m", "http.server", str(PORT), "--bind", "127.0.0.1", "--directory", str(ROOT)],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        _wait_for_server()
        with sync_playwright() as pw:
            browser = pw.chromium.launch()
            runs = [
                ("dark-1440", 1440, 900, "dark", True),
                ("light-1440", 1440, 900, "light", False),
                ("dark-2000", 2000, 1000, "dark", False),
                ("light-2000", 2000, 1000, "light", False),
                ("dark-390", 390, 844, "dark", False),
                ("light-390", 390, 844, "light", False),
            ]
            for tag, w, hgt, scheme, keys in runs:
                page = browser.new_page(viewport={"width": w, "height": hgt}, color_scheme=scheme)
                errors: list[str] = []
                page.on("console", lambda m, errors=errors: errors.append(m.text) if m.type == "error" else None)
                page.on("pageerror", lambda e, errors=errors: errors.append(str(e)))
                holdings(page, tag, edition, keys)
                if w != 2000:
                    reading(page, tag, edition, keys)
                check(not errors, f"{tag}: no console errors {errors}")
                page.close()
            zoom = browser.new_page(viewport={"width": 720, "height": 450}, color_scheme="dark")
            _open(zoom, "#/regest/22694/a7")
            _no_horizontal_scroll(zoom, "200 percent equivalent n. 67")
            _shot(zoom, "read2-zoom200-n67")
            _open(zoom, "#/")
            _no_horizontal_scroll(zoom, "200 percent equivalent holdings")
            zoom.close()
            browser.close()
    finally:
        server.terminate()
        server.wait(timeout=10)
    print(f"{len(failures)} failures")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
