'use strict';
// Overlap check of the Registernetz figure on the rendered page: no label may overlap another
// label, a mark (regest diamond, bundle, entry mark, centre, meeting point, key sign) or the
// accent line to the selected regest. Boxes come from the browser (getBoundingClientRect), so
// the check measures what is drawn, not what the layout code intended.
//
// Usage: node check_figure_overlap.cjs <url> [<url> …]   (Playwright through NODE_PATH, Chrome)
// Measures each url at 1280 x 800 and 360 x 740. Exit code 1 on any overlap.

const { chromium } = require('playwright');

const VIEWPORTS = [{ name: 'wide', width: 1280, height: 800 }, { name: 'narrow', width: 360, height: 740 }];

function measure() {
  const svg = document.querySelector('svg.figure');
  if (!svg) return { labels: 0, overlaps: [], none: true };
  const r = (el) => el.getBoundingClientRect();
  const name = (el) => (el.tagName === 'text' ? `"${el.textContent}"` : `${el.tagName}.${el.getAttribute('class') || el.parentElement.getAttribute('class')}`);
  const labels = [...svg.querySelectorAll('text')].filter((t) => !t.closest('.tip'));
  const marks = [...svg.querySelectorAll('.regest > :not(.hit), .bundle > :not(.hit), .entry > :not(.hit):not(text), .centre-mark, .junction, .key-mark')];
  const line = svg.querySelector('.edge-selected');
  const points = [];
  if (line) {
    const [x1, y1, x2, y2] = ['x1', 'y1', 'x2', 'y2'].map((k) => Number(line.getAttribute(k)));
    const o = svg.getBoundingClientRect();
    const n = Math.ceil(Math.hypot(x2 - x1, y2 - y1) / 2);
    for (let i = 0; i <= n; i++) points.push({ x: o.left + x1 + ((x2 - x1) * i) / n, y: o.top + y1 + ((y2 - y1) * i) / n });
  }
  const hit = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;
  const overlaps = [];
  labels.forEach((t, i) => {
    const a = r(t);
    for (const u of labels.slice(i + 1)) if (hit(a, r(u))) overlaps.push(`${name(t)} / ${name(u)}`);
    for (const m of marks) if (hit(a, r(m))) overlaps.push(`${name(t)} / ${name(m)}`);
    if (points.some((p) => p.x > a.left + 0.5 && p.x < a.right - 0.5 && p.y > a.top + 0.5 && p.y < a.bottom - 0.5)) overlaps.push(`${name(t)} / accent line`);
  });
  return { labels: labels.length, overlaps };
}

(async () => {
  const urls = process.argv.slice(2);
  const browser = await chromium.launch({ channel: 'chrome' });
  let failed = 0;
  for (const url of urls) {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      await page.goto(url);
      await page.waitForTimeout(1200);
      const res = await page.evaluate(measure);
      if (res.none) { console.log(`skip ${vp.name.padEnd(6)} ${url}: no figure in this state`); await page.close(); continue; }
      const ok = res.overlaps.length === 0;
      if (!ok) failed++;
      console.log(`${ok ? 'ok  ' : 'FAIL'} ${vp.name.padEnd(6)} ${url}\n     labels ${res.labels}, overlaps ${res.overlaps.length}${ok ? '' : `\n     ${res.overlaps.slice(0, 12).join('\n     ')}`}`);
      await page.close();
    }
  }
  await browser.close();
  process.exit(failed ? 1 : 0);
})();
