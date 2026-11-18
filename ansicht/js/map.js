/**
 * The map of the places of issue, shared by the itinerary (js/itinerary.js) and the decade
 * maps (js/decades.js): an equirectangular projection around the median place of issue. The
 * core that holds 95 percent of the documents is undistorted and fills radius 1; the far
 * journeys (the crusades of 1147 and 1189/90) are compressed beyond it, so they stay visible
 * without shrinking the core. Both views say so in their legend.
 */

const DEG = Math.PI / 180;

/**
 * @param {Array<{p: string}>} points  regesta with a place of issue
 * @param {Record<string, {lo: number, la: number}>} places  places of issue by id
 */
export function mapProjection(points, places) {
  const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const midLat = median(points.map((p) => places[p.p].la));
  const midLon = median(points.map((p) => places[p.p].lo));
  const k = Math.cos(midLat * DEG);
  const dist = points.map((p) => Math.hypot((places[p.p].lo - midLon) * k, places[p.p].la - midLat)).sort((a, b) => a - b);
  const core = dist[Math.floor(dist.length * 0.95)] || 1;
  /** Map units of a coordinate: the core within radius 1, north as +z. */
  const mapXZ = (lon, lat) => {
    const dx = (lon - midLon) * k;
    const dz = lat - midLat;
    const d = Math.hypot(dx, dz) / core;
    const r = d <= 1 ? d : 1 + 0.45 * Math.tanh((d - 1) / 1.2);
    const f = d ? r / d / core : 0;
    return [dx * f, dz * f];
  };
  /** Whether a coordinate lies in the undistorted core, where a base map may be drawn. */
  const inCore = (lon, lat) => Math.hypot((lon - midLon) * k, lat - midLat) <= core;
  return { midLat, midLon, k, core, mapXZ, inCore };
}
