/**
 * Start overview: the dimensions of the holdings as linked overviews (operator's rule 42 of
 * 2026-11-14). Time is the shared band with its two handles; space is a map of the places of
 * issue, one circle per place sized by its regesta in the chosen years; persons are the most
 * often named persons of the register in the same years. The time band filters map and
 * persons; a place leads into the Orte object (itinerary), a person into the Personen object
 * (the network where the run names the person, the time band otherwise). All counts come from
 * the whole delivery (build_holdings.py, no LLM).
 *
 * Returns {element, aside} like the views, so the start page places it as the shell does.
 */
import { h } from "./dom.js";
import { timeBand } from "./sidebar.js";
import { focusKey } from "./timeband.js";
import { yearOf } from "./filters.js";

const SVG = "http://www.w3.org/2000/svg";
const DEG = Math.PI / 180;
const ACTOR = "urn:regesta:actor:";
const TOP_PERSONS = 10;
const NAMED_PLACES = 6;

function s(tag, attrs = {}) {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (k !== "text" && v !== null && v !== undefined) el.setAttribute(k, String(v));
  if (attrs.text) el.textContent = attrs.text;
  return el;
}

/**
 * @param {{edition: any, holdings: any}} store
 * @param {{filters: any, href: (route: string) => string}} options  href maps a view route
 *   (itinerar/<place>, personen/<iri>, zeitband/<id>) to a link of the page it is shown on.
 */
export function renderStartOverview(store, options) {
  const { filters, href } = options;
  const H = store.holdings;
  const places = H.places;
  const inRun = new Set(store.edition.graph.nodes.filter((n) => n.kind !== "act" && n.id.startsWith(ACTOR)).map((n) => n.id.slice(ACTOR.length)));
  const regesta = H.regesta.map((r) => ({ u: r.u, p: r.p && places[r.p] ? r.p : null, y: Math.floor(yearOf(r.s)) }));
  const yearOfUid = new Map(regesta.map((r) => [r.u, r.y]));

  // The projection of the itinerary and the decade maps: equirectangular around the median
  // place, the core of 95 percent undistorted, outliers pressed to the rim. Repeated here as
  // in js/decades.js; upgrade path is one shared projection module.
  const located = regesta.filter((r) => r.p);
  const median = (v) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];
  const midLat = median(located.map((r) => places[r.p].la));
  const midLon = median(located.map((r) => places[r.p].lo));
  const k = Math.cos(midLat * DEG);
  const dist = located.map((r) => Math.hypot((places[r.p].lo - midLon) * k, places[r.p].la - midLat)).sort((a, b) => a - b);
  const core = dist[Math.floor(dist.length * 0.95)] || 1;
  const project = (lon, lat) => {
    const dx = (lon - midLon) * k;
    const dz = lat - midLat;
    const d = Math.hypot(dx, dz) / core;
    const r = d <= 1 ? d : 1 + 0.45 * Math.tanh((d - 1) / 1.2);
    const f = d ? r / d : 0;
    return [dx * f / core, dz * f / core];
  };
  const inCore = (lon, lat) => Math.hypot((lon - midLon) * k, lat - midLat) <= core;

  let basemap = null;
  let realm = null;
  const load = (file) =>
    fetch(new URL(file, import.meta.url))
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  Promise.all([load("./basemap.json"), load("./realm.json")]).then(([b, r]) => {
    basemap = b;
    realm = r;
    drawMap();
  });

  const mapHost = h("div", { class: "so-map", role: "group", "aria-label": "Karte der Ausstellungsorte; jeder Ort ist ein Link mit seiner Zahl" });
  const caption = h("p", { class: "so-caption" });
  const element = h("section", { class: "canvas so-canvas", "aria-labelledby": "so-title" }, h("h1", { id: "so-title", class: "visually-hidden", text: "Übersicht über Zeit, Orte und Personen" }), mapHost, caption);

  const persons = h("ol", { class: "so-persons", "aria-label": "Meistgenannte Personen" });
  const band = h("div", { class: "so-band" });
  const aside = h("div", { class: "sidebar so-side" }, band, h("p", { class: "so-label" }, h("span", { text: "Meistgenannte Personen" }), h("span", { class: "so-n", text: "Regesten" })), persons);

  const inRange = (y) => filters.inYear(y);

  function drawMap() {
    const width = Math.max(280, mapHost.clientWidth || 640);
    const height = Math.round(Math.min(width * 0.72, Math.max(320, window.innerHeight - 260)));
    const counts = new Map();
    for (const r of located) if (inRange(r.y)) counts.set(r.p, (counts.get(r.p) ?? 0) + 1);
    const all = Object.keys(places).map((id) => [id, project(places[id].lo, places[id].la)]);
    const xs = all.map(([, q]) => q[0]);
    const zs = all.map(([, q]) => q[1]);
    const [x0, x1, z0, z1] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
    const pad = 16;
    const scale = Math.min((width - 2 * pad) / (x1 - x0), (height - 2 * pad) / (z1 - z0));
    const left = (width - (x1 - x0) * scale) / 2;
    const top = (height - (z1 - z0) * scale) / 2;
    const at = ([x, z]) => [left + (x - x0) * scale, top + (z1 - z) * scale];
    const svg = s("svg", { width, height, viewBox: `0 0 ${width} ${height}`, class: "so-svg" });
    const defs = s("defs");
    const blur = s("filter", { id: "so-soft", x: "-5%", y: "-5%", width: "110%", height: "110%" });
    blur.append(s("feGaussianBlur", { stdDeviation: 2 }));
    const clip = s("clipPath", { id: "so-core" });
    const [cx, cy] = at([0, 0]);
    clip.append(s("circle", { cx, cy, r: scale }));
    defs.append(blur, clip);
    svg.append(defs);
    defs.setAttribute("aria-hidden", "true");
    if (realm) {
      const pts = realm.ring.map(([lon, lat]) => at(project(lon, lat)).map((v) => v.toFixed(1)).join(","));
      svg.append(s("polygon", { class: "it-realm", points: pts.join(" "), "clip-path": "url(#so-core)", filter: "url(#so-soft)" }));
    }
    if (basemap) {
      for (const [list, cls] of [[basemap.coast, "it-coast"], [basemap.rivers, "it-river"]]) {
        for (const coords of list) {
          let run = [];
          const flush = () => {
            if (run.length > 1) svg.append(s("polyline", { class: cls, points: run.join(" ") }));
            run = [];
          };
          for (const [lon, lat] of coords) {
            if (!inCore(lon, lat)) {
              flush();
              continue;
            }
            run.push(at(project(lon, lat)).map((v) => v.toFixed(1)).join(","));
          }
          flush();
        }
      }
    }
    const max = Math.max(1, ...counts.values());
    const rMax = Math.max(8, Math.min(20, width * 0.025));
    const radius = (n) => Math.max(2, rMax * Math.sqrt(n / max));
    const order = [...counts].sort((a, b) => b[1] - a[1]);
    const dots = s("g", { class: "so-dots" });
    // Largest first, so the small places stay visible on top.
    for (const [id, n] of order) {
      const [x, y] = at(project(places[id].lo, places[id].la));
      // The circles are the keyboard way to the places as well: links in order of size.
      const a = s("a", { href: href(`itinerar/${encodeURIComponent(id)}`), class: "so-place", "aria-label": `${places[id].l}, ${n} Regesten` });
      a.append(s("circle", { cx: x.toFixed(1), cy: y.toFixed(1), r: radius(n).toFixed(1), class: "dc-dot" }), s("title", { text: `${places[id].l}, ${n} Regesten` }));
      dots.append(a);
    }
    svg.append(dots);
    // The largest places are named on the map, none over another.
    const taken = [];
    for (const [id, n] of order.slice(0, NAMED_PLACES)) {
      const [x, y] = at(project(places[id].lo, places[id].la));
      const text = places[id].l;
      const w = text.length * 7;
      for (const right of [true, false]) {
        const bx = right ? x + radius(n) + 4 : x - radius(n) - 4 - w;
        const box = { x0: bx, x1: bx + w, y0: y - 9, y1: y + 6 };
        if (box.x0 < 2 || box.x1 > width - 2 || taken.some((o) => o.x0 < box.x1 && box.x0 < o.x1 && o.y0 < box.y1 && box.y0 < o.y1)) continue;
        taken.push(box);
        svg.append(s("text", { class: "sp-label", x: (right ? box.x0 : box.x1).toFixed(1), y: (y + 4).toFixed(1), "text-anchor": right ? "start" : "end", text }));
        break;
      }
    }
    mapHost.replaceChildren(svg);
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    caption.textContent = `Kreis je Ort nach Zahl der Regesten, ${total} mit Ausstellungsort`;
  }

  function drawSide() {
    const counts = [];
    for (const [id, p] of Object.entries(H.persons)) {
      const n = p.r.filter((u) => inRange(yearOfUid.get(u))).length;
      if (n) counts.push([id, p.l, n]);
    }
    counts.sort((a, b) => b[2] - a[2] || a[1].localeCompare(b[1], "de"));
    persons.replaceChildren(
      ...counts.slice(0, TOP_PERSONS).map(([id, label, n]) =>
        h("li", {}, h("a", { href: href(inRun.has(id) ? `personen/${encodeURIComponent(ACTOR + id)}` : `zeitband/${encodeURIComponent(id)}`) }, label), h("span", { class: "so-n", text: String(n) })),
      ),
    );
    // The band is rebuilt with every change; the handle in hand keeps the keyboard focus.
    const restore = focusKey(aside);
    band.replaceChildren(timeBand(store, filters, new Set()));
    restore();
  }

  const update = () => {
    drawMap();
    drawSide();
  };
  const unsubscribe = filters.onChange(update);
  let lastWidth = 0;
  const observer = new ResizeObserver(() => {
    if (mapHost.clientWidth && mapHost.clientWidth !== lastWidth) {
      lastWidth = mapHost.clientWidth;
      drawMap();
    }
  });
  observer.observe(mapHost);
  drawSide();

  return {
    element,
    aside,
    dispose: () => {
      unsubscribe();
      observer.disconnect();
    },
  };
}
