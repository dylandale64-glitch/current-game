/* Drives the game with real pointer input, the way a finger would. */
const { chromium } = require('playwright');
const path = require('path');
const URL = 'file://' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/');

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  PASS  ' : '  FAIL  ') + m); };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(URL); await page.waitForTimeout(800);

  const geom = () => page.evaluate(() => {
    const r = document.getElementById('board').getBoundingClientRect();
    return { src: S.src, lamps: S.lamps, unit, top: r.top, left: r.left, type: S.type };
  });

  // stepMs controls drag speed: slow drag lays thick copper, a flick lays thin
  const dragTo = async (g, target, stepMs) => {
    const A = { x: g.left + g.src.x * g.unit, y: g.top + g.src.y * g.unit };
    const B = { x: g.left + target.x * g.unit, y: g.top + target.y * g.unit };
    await page.mouse.move(A.x, A.y); await page.mouse.down();
    for (let i = 1; i <= 34; i++) {
      const t = i / 34;
      await page.mouse.move(A.x + (B.x - A.x) * t, A.y + (B.y - A.y) * t);
      await page.waitForTimeout(stepMs);
    }
    await page.mouse.up();
  };

  console.log('\n== stage 1 with a real finger drag ==');
  let g = await geom();
  await dragTo(g, g.lamps[0], 20);
  await page.waitForTimeout(300);
  const st = await page.evaluate(() => ({ phase: S.phase, pts: S.branches[0].pts.length }));
  ok(st.phase === 'live' && st.pts > 20, 'a slow drag lays a trace and energises it');
  await page.waitForTimeout(4300);
  ok((await page.evaluate(() => S.stage)) === 2, 'clearing stage 1 advances the run');

  console.log('\n== two-branch parallel board ==');
  await page.evaluate(() => { S.stage = 6; genBoard(); S.obs = []; });
  g = await geom();
  ok(g.type === 'parallel', 'parallel board generated');
  await dragTo(g, g.lamps[0], 14);
  await page.waitForTimeout(200);
  const mid = await page.evaluate(() => ({ bi: S.bi, done0: S.branches[0].done, phase: S.phase }));
  ok(mid.bi === 1 && mid.done0 && mid.phase === 'draw', 'first branch completes and the game asks for the second');
  g = await geom();
  await dragTo(g, g.lamps[1], 14);
  await page.waitForTimeout(300);
  ok((await page.evaluate(() => S.phase)) === 'live', 'the second branch energises the board');

  console.log('\n' + pass + ' passed, ' + fail + ' failed, page errors: ' + (errs.length ? errs.join(' | ') : 'none'));
  await browser.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
