# /// script
# requires-python = ">=3.11"
# dependencies = ["numpy"]
# ///
"""Georeference the rough trace of the Empire about 1190 and write it for the itinerary map.

Regime: single-file script. Input is edition/realm-1190-trace.json (pixel trace of the
border on Shepherd's public-domain map of 1926 and town control points with modern
coordinates). Output is js/realm.json, one soft polygon in longitude and latitude that the
itinerary draws on its floor.

Usage
    python build_realm.py           write js/realm.json
    python build_realm.py --check   print the fit residuals and write nothing

Design decisions, after the Research Coordination's decision of 2026-11-11 (way b):
- A quadratic fit from pixels to degrees over the control points; the map's conic
  projection is smooth enough over Central Europe that the residuals stay near a tenth of a
  degree. The script aborts when a control point misses by more than MAX_RESIDUAL degrees.
- Two rounds of Chaikin corner cutting soften the hand trace, since the border is shown as
  a soft area and its course is uncertain anyway; coordinates are rounded to 0.01 degree.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "edition" / "realm-1190-trace.json"
TARGET = HERE / "js" / "realm.json"
MAX_RESIDUAL = 0.4


def _design(x: np.ndarray, y: np.ndarray) -> np.ndarray:
    x, y = x / 1000, y / 1000
    return np.stack([np.ones_like(x), x, y, x * x, x * y, y * y], -1)


def _fit(points: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    a = _design(points[:, 0], points[:, 1])
    lon, *_ = np.linalg.lstsq(a, points[:, 2], rcond=None)
    lat, *_ = np.linalg.lstsq(a, points[:, 3], rcond=None)
    return lon, lat


def _chaikin(ring: list[list[float]], rounds: int = 2) -> list[list[float]]:
    for _ in range(rounds):
        out = []
        for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1], strict=True):
            out.append([0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1])
            out.append([0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1])
        ring = out
    return ring


def main() -> int:
    data = json.loads(SOURCE.read_text(encoding="utf-8"))
    cps = data["control_points"]
    points = np.array(list(cps.values()), dtype=float)
    lon_c, lat_c = _fit(points)
    a = _design(points[:, 0], points[:, 1])
    worst = 0.0
    for name, row, plon, plat in zip(cps, points, a @ lon_c, a @ lat_c, strict=True):
        miss = max(abs(plon - row[2]), abs(plat - row[3]))
        worst = max(worst, miss)
        if "--check" in sys.argv:
            print(f"{name:10s} lon {plon - row[2]:+.2f} lat {plat - row[3]:+.2f}")
    if worst > MAX_RESIDUAL:
        print(f"a control point misses by {worst:.2f} degrees; check the trace file", file=sys.stderr)
        return 1
    if "--check" in sys.argv:
        return 0
    trace = np.array(data["trace"], dtype=float)
    t = _design(trace[:, 0], trace[:, 1])
    ring = [[float(x), float(y)] for x, y in zip(t @ lon_c, t @ lat_c, strict=True)]
    ring = [[round(x, 2), round(y, 2)] for x, y in _chaikin(ring)]
    out = {
        "source": data["source"],
        "note": "Rough own digitisation of this project after Shepherd's map; the border of the Empire about 1190 was no sharp line.",
        "ring": ring,
    }
    TARGET.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(ring)} points, worst control point {worst:.2f} degrees, {TARGET.stat().st_size} bytes")
    return 0


if __name__ == "__main__":
    sys.exit(main())
