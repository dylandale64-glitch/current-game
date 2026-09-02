/* Captures screenshots into shots/ - useful for checking layout changes. */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs');
const root = path.join(__dirname, '..');
const URL = 'file://' + path.join(root, 'index.html').replace(/\\/g, '/');
const out = path.join(root, 'shots');
fs.mkdirSync(out, { recursive: true });

(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await page.goto(URL); await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(out, '1-idle.png') });

  await page.evaluate(() => {
    S.stage = 6; genBoard(); S.obs = [];
    S.branches.forEach((br, bi) => {
      const a = S.src, c = S.lamps[br.lamps[0]], n = 60;
      br.pts = []; br.heat = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        br.pts.push({ x: a.x + (c.x - a.x) * t, y: a.y + (c.y - a.y) * t, w: 0.30 });
        br.heat.push(0);
      }
      br.done = true;
    });
    solve(); energize();
  });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: path.join(out, '2-parallel-live.png') });

  await page.evaluate(() => {
    META.runs = 3; META.rp = 420; S.score = 1450; S.stage = 9;
    S.failText = ['Burned out', 'The trace opened at its thinnest point.'];
    endRun();
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, '3-run-end.png') });
  await page.click('#tolab'); await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, '4-lab.png') });
  console.log('wrote 4 screenshots to shots/');
  await b.close();
})();
