/* Drives the game with real pointer input, the way a finger would.

   These tests wait for game STATE, never for a fixed number of
   milliseconds. The game integrates real elapsed time and caps dt at
   50 ms per frame, so on a slow or loaded machine (a CI runner, say)
   the live phase takes longer in wall-clock than it does on a fast
   one. Fixed sleeps pass locally and fail in CI. Polling does not. */
const { chromium } = require('playwright');
const path = require('path');
const URL = 'file://' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/');

let pass = 0, fail = 0;
let dump = async () => ({});
const ok = async (c, m) => {
  if (c) { pass++; console.log('  PASS  ' + m); return; }
  fail++; console.log('  FAIL  ' + m);
  // Say WHY, in the log, so a red CI run explains itself instead of
  // needing to be reproduced locally.
  try { console.log('         state: ' + JSON.stringify(await dump())); }
  catch (e) { console.log('         (could not read state: ' + e.message + ')'); }
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));

  // SLOW=1 throttles the CPU to reproduce a loaded CI runner locally.
  // The game caps dt at 50 ms/frame, so under throttling the live phase
  // takes longer in wall-clock than it does on a fast machine.
  if (process.env.SLOW) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.SLOW) || 6 });
    console.log('(CPU throttled ' + (process.env.SLOW || 6) + 'x)');
  }

  // wait for a condition in page context; resolves true, or false on timeout
  const until = async (expr, ms = 25000) => {
    try { await page.waitForFunction(expr, null, { timeout: ms, polling: 100 }); return true; }
    catch { return false; }
  };

  await page.goto(URL);
  await until(() => typeof S !== 'undefined' && S.branches.length > 0);

  dump = () => page.evaluate(() => ({
    phase: S.phase, stage: S.stage, type: S.type, bi: S.bi,
    volts: +S.volts.toFixed(1), lampI: S.lamps.map(l => mA(l.I)),
    window: [mA(CFG.I_MIN), mA(iMax())], maxHeat: +S.maxHeat.toFixed(2),
    copper: +(S.copperUsed / S.budget).toFixed(2),
    pts: S.branches.map(b => b.pts.length), done: S.branches.map(b => b.done),
    verdict: document.getElementById('over-big').textContent,
    overlays: ['over','draft','resolder','lab'].filter(id =>
      document.getElementById(id).classList.contains('show'))
  }));

  const geom = () => page.evaluate(() => {
    const r = document.getElementById('board').getBoundingClientRect();
    return { src: S.src, lamps: S.lamps, unit, top: r.top, left: r.left, type: S.type };
  });

  // stepMs sets drag speed: a slow drag lays thick copper, a flick lays thin
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
  await ok(await until(() => S.phase === 'live' || S.phase === 'result'),
     'a slow drag lays a trace and energises it');
  await ok(await until(() => S.stage === 2), 'clearing stage 1 advances the run');

  console.log('\n== two-branch parallel board ==');
  // generous copper here on purpose: this test is about the two-branch input
  // flow, not the copper economy, which physics.test.js already covers.
  await page.evaluate(() => { S.stage = 6; genBoard(); S.obs = []; S.budget *= 3; });
  g = await geom();
  await ok(g.type === 'parallel', 'parallel board generated');

  await dragTo(g, g.lamps[0], 14);
  await ok(await until(() => S.bi === 1 && S.branches[0].done && S.phase === 'draw'),
     'first branch completes and the game asks for the second');

  g = await geom();
  await dragTo(g, g.lamps[1], 14);
  await ok(await until(() => S.phase === 'live' || S.phase === 'burning' || S.phase === 'result'),
     'the second branch energises the board');

  console.log('\n' + pass + ' passed, ' + fail + ' failed, page errors: ' + (errs.length ? errs.join(' | ') : 'none'));
  await browser.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
