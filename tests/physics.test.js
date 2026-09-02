/* Physics and progression checks for Current.
   Every claim here is verified against a hand-computed value or an
   observable game state, not against another part of the same code. */
const { chromium } = require('playwright');
const path = require('path');
const URL = 'file://' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/');

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  PASS  ' : '  FAIL  ') + m); };

// lay a uniform-width trace on branch bi, through its lamps in order
const draw = (page, bi, w, pinch) => page.evaluate(({ bi, w, pinch }) => {
  const b = S.branches[bi]; b.pts = []; b.heat = [];
  const stops = [S.src].concat(b.lamps.map(i => S.lamps[i]));
  for (let s = 0; s < stops.length - 1; s++) {
    const a = stops[s], c = stops[s + 1], n = 45;
    for (let i = (s === 0 ? 0 : 1); i <= n; i++) {
      const t = i / n;
      let ww = w;
      if (pinch && s === 0 && Math.abs(t - pinch.at) < pinch.len) ww = pinch.w;
      const x = a.x + (c.x - a.x) * t, y = a.y + (c.y - a.y) * t;
      const p = b.pts[b.pts.length - 1];
      if (p) S.copperUsed += Math.hypot(x - p.x, y - p.y) * ww;
      b.pts.push({ x, y, w: ww }); b.heat.push(0);
    }
  }
  b.done = true; solve();
  return { R: +b.R.toFixed(2), I: +(b.I * 1000).toFixed(0) };
}, { bi, w, pinch });

const state = (page) => page.evaluate(() => ({
  phase: S.phase, type: S.type, stage: S.stage, score: S.score, chain: S.chain,
  supply: mA(S.supplyI), fuse: mA(S.fuse), maxHeat: +S.maxHeat.toFixed(2),
  over: document.getElementById('over').classList.contains('show'),
  resolder: document.getElementById('resolder').classList.contains('show'),
  big: document.getElementById('over-big').textContent, rp: META.rp, solder: S.solder
}));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(URL);
  await page.waitForTimeout(900);

  console.log('\n== crafted first board ==');
  const b1 = await page.evaluate(() => ({ type: S.type, obs: S.obs.length, lamps: S.lamps.length, solder: S.solder }));
  ok(b1.type === 'single' && b1.obs === 0 && b1.lamps === 1, 'stage 1 is one lamp with no keep-out zones');
  ok(b1.solder === 1, 'one re-solder available at base');

  console.log('\n== single-lamp solver vs hand calculation ==');
  const hand = await page.evaluate(() => {
    const d = Math.hypot(S.lamps[0].x - S.src.x, S.lamps[0].y - S.src.y);
    const R = CFG.RHO * d / 0.34;
    return { R: +R.toFixed(2), I: +(S.volts / (R + CFG.R_LOAD) * 1000).toFixed(0) };
  });
  const got = await draw(page, 0, 0.34);
  console.log('   hand', JSON.stringify(hand), 'solver', JSON.stringify(got));
  ok(Math.abs(hand.R - got.R) < 0.6 && Math.abs(hand.I - got.I) < 8, 'R and I match rho*L/w within tolerance');

  await page.evaluate(() => energize());
  await page.waitForTimeout(4200);
  let s = await state(page);
  ok(s.chain === 1 && s.score > 0, 'a clean clear scores and starts the chain');
  ok(s.stage === 2, 'clearing stage 1 advances the run');

  console.log('\n== series: two lamps, one current ==');
  await page.evaluate(() => { S.stage = 4; genBoard(); });
  const ser = await page.evaluate(() => ({ type: S.type, branches: S.branches.length, branchLamps: S.branches[0].lamps.length }));
  ok(ser.type === 'series' && ser.branches === 1 && ser.branchLamps === 2, 'one branch carrying two lamps');
  await draw(page, 0, 0.36);
  const sc = await page.evaluate(() => {
    const b = S.branches[0];
    return { hand: mA(S.volts / (b.R + 2 * CFG.R_LOAD)), a: mA(S.lamps[0].I), b: mA(S.lamps[1].I) };
  });
  console.log('  ', JSON.stringify(sc));
  ok(sc.a === sc.b && Math.abs(sc.a - sc.hand) < 2, 'both lamps carry V/(R+2*R_load)');

  console.log('\n== parallel: independent branches, shared supply ==');
  await page.evaluate(() => { S.stage = 6; genBoard(); });
  ok((await page.evaluate(() => S.branches.length)) === 2, 'two branches generated');
  await draw(page, 0, 0.30); await draw(page, 1, 0.30);
  const pc = await page.evaluate(() => ({
    I1: mA(S.branches[0].I), I2: mA(S.branches[1].I), supply: mA(S.supplyI),
    h1: mA(S.volts / (S.branches[0].R + CFG.R_LOAD)), h2: mA(S.volts / (S.branches[1].R + CFG.R_LOAD))
  }));
  console.log('  ', JSON.stringify(pc));
  ok(pc.h1 === pc.I1 && pc.h2 === pc.I2, 'each branch solves independently off the ideal supply');
  ok(Math.abs(pc.supply - (pc.I1 + pc.I2)) <= 1, 'supply current is the sum of the branch currents');

  console.log('\n== supply fuse ==');
  await page.evaluate(() => { S.stage = 6; genBoard(); });
  await draw(page, 0, 0.45); await draw(page, 1, 0.45);
  await page.evaluate(() => energize());
  await page.waitForTimeout(2600);
  s = await state(page);
  ok(s.supply > s.fuse && s.big === 'Supply tripped', 'two fat branches trip the supply fuse');

  console.log('\n== failure modes ==');
  for (const [name, setup, expect] of [
    ['thin trace', { w: 0.10 }, 'No light'],
    ['pinched trace', { w: 0.40, pinch: { at: 0.5, w: 0.10, len: 0.05 } }, 'Burned out'],
    ['over-volted', { w: 0.42, volts: 34 }, 'Filament blown']]) {
    await page.evaluate(() => { S.stage = 2; genBoard(); S.solder = 0; });
    if (setup.volts) await page.evaluate(v => { S.volts = v; }, setup.volts);
    await draw(page, 0, setup.w, setup.pinch);
    await page.evaluate(() => energize());
    await page.waitForTimeout(3400);
    ok((await state(page)).big === expect, name + ' gives "' + expect + '"');
  }

  console.log('\n== re-solder ==');
  await page.evaluate(() => { S.stage = 2; genBoard(); S.solder = 1; });
  await draw(page, 0, 0.40, { at: 0.5, w: 0.10, len: 0.05 });
  await page.evaluate(() => energize());
  await page.waitForTimeout(3400);
  ok((await state(page)).resolder, 'a burn-out offers a re-solder while one is left');
  await page.click('#do-resolder'); await page.waitForTimeout(300);
  s = await state(page);
  ok(s.phase === 'draw' && s.solder === 0 && s.chain === 0, 're-solder resumes play, spends the charge, resets the chain');

  console.log('\n== research and the lab ==');
  await page.evaluate(() => { S.solder = 0; S.score = 900; S.stage = 6; endRun(); });
  await page.waitForTimeout(300);
  ok((await page.evaluate(() => META.rp)) > 0, 'a finished run banks research points');
  await page.click('#tolab'); await page.waitForTimeout(250);
  ok((await page.evaluate(() => document.querySelectorAll('#labgrid .node').length)) === 6, 'lab renders six upgrade nodes');
  const bought = await page.evaluate(() => {
    META.rp = 500; renderLab();
    [...document.querySelectorAll('#labgrid .node')].find(n => !n.disabled).click();
    return { rp: META.rp, up: META.up };
  });
  ok(bought.rp < 500 && Object.values(bought.up).some(v => v > 0), 'buying an upgrade spends RP and raises a level');
  ok(Object.values(await page.evaluate(() => JSON.parse(localStorage.getItem('current.save.v2')).up)).some(v => v > 0),
     'the upgrade persists to storage');
  const applied = await page.evaluate(() => { newRun(); return S.mods; });
  ok(Object.values(applied).some(v => v !== 1), 'the upgrade applies to the next run');

  console.log('\n' + pass + ' passed, ' + fail + ' failed, page errors: ' + (errs.length ? errs.join(' | ') : 'none'));
  await browser.close();
  process.exit(fail || errs.length ? 1 : 0);
})();
