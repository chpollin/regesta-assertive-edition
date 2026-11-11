# /// script
# requires-python = ">=3.11"
# dependencies = ["shapely>=2"]
# ///
"""Cut a quiet base map for the itinerary from Natural Earth: coastlines and major rivers.

Regime: single-file script. Input are the Natural Earth 1:50m GeoJSON files
ne_50m_coastline.geojson and ne_50m_rivers_lake_centerlines.geojson (public domain,
https://www.naturalearthdata.com, read from the repository nvkelso/natural-earth-vector).
Output is js/basemap.json, a small committed asset with lines in longitude and latitude,
so the page loads nothing from outside.

Usage
    python build_basemap.py <folder with the two GeoJSON files>

Design decisions
- Clipped to the box of the itinerary's coordinate check (longitude -10 to 45, latitude 30
  to 62) with a small margin, simplified to about 3 km, coordinates rounded to 0.01 degree.
- Rivers only with Natural Earth scalerank up to RIVER_RANK, the large rivers (Rhine,
  Danube, Po, Elbe, Rhône and the like), so the map stays a quiet orientation.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from shapely.geometry import box, shape
from shapely.geometry.base import BaseGeometry

BOX = box(-12, 28, 47, 64)
TOLERANCE = 0.03
RIVER_RANK = 4


def _lines(geom: BaseGeometry) -> list[list[list[float]]]:
    """Flatten a clipped geometry into lists of rounded points."""
    if geom.is_empty:
        return []
    parts = getattr(geom, "geoms", [geom])
    out = []
    for part in parts:
        if part.geom_type == "LineString" and len(part.coords) > 1:
            out.append([[round(x, 2), round(y, 2)] for x, y in part.coords])
        elif part.geom_type in {"MultiLineString", "GeometryCollection"}:
            out.extend(_lines(part))
    return out


def _read(path: Path, keep) -> list[list[list[float]]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    lines = []
    for feature in data["features"]:
        if not keep(feature.get("properties") or {}):
            continue
        geom = shape(feature["geometry"]).intersection(BOX).simplify(TOLERANCE)
        lines.extend(_lines(geom))
    return lines


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    folder = Path(sys.argv[1])
    coast = _read(folder / "ne_50m_coastline.geojson", lambda p: True)
    rivers = _read(
        folder / "ne_50m_rivers_lake_centerlines.geojson", lambda p: (p.get("scalerank") or 99) <= RIVER_RANK
    )
    out = {
        "source": "Natural Earth, 1:50m coastline and rivers, public domain, https://www.naturalearthdata.com",
        "coast": coast,
        "rivers": rivers,
    }
    target = Path(__file__).resolve().parent / "js" / "basemap.json"
    target.write_text(json.dumps(out, separators=(",", ":")), encoding="utf-8")
    print(f"{len(coast)} coast lines, {len(rivers)} rivers, {target.stat().st_size} bytes")


if __name__ == "__main__":
    main()
