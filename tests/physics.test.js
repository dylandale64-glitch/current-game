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
  b.copper = 0;
  for (let s = 0; s < stops.length - 1; s++) {
    const a = stops[s], c = stops[s + 1], n = 45;
    for (let i = (s === 0 ? 0 : 1); i <= n; i++) {
      const t = i / n;
      let ww = w;
      if (pinch && s === 0 && Math.abs(t - pinch.at) < pinch.len) ww = pinch.w;
      const x = a.x + (c.x - a.x) * t, y = a.y + (c.y - a.y) * t;
      const p = b.pts[b.pts.length - 1];
      if (p) b.copper = (b.copper || 0) + Math.hypot(x - p.x, y - p.y) * ww;
      b.pts.push({ x, y, w: ww }); b.heat.push(0);
    }
  }
  b.done = true; S.copperUsed = totalCopper(); solve();
  return { R: +b.R.toFixed(2), I: +(b.I * 1000).toFixed(0) };
}, { bi, w, pinch });

const genType = (page, type, stage) => page.evaluate(({ type, stage }) => {
  for (let i = 0; i < 300; i++) {
    S.mods = baseMods(); S.needBreather = false; S.stage = stage; genBoard();
    if (S.type === type) return { ok: true, stage: S.stage, boss: S.boss ? S.boss.title : null };
  }
  return { ok: false };
}, { type, stage });

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
  await genType(page, 'series', 4);
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
  ok((await genType(page, 'parallel', 9)).ok, 'a parallel board can be generated');
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
  await genType(page, 'parallel', 9);
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

  console.log('\n== a slip must not destroy finished work ==');
  await genType(page, 'parallel', 9);
  await draw(page, 0, 0.30);
  const before = await page.evaluate(() => ({ done0: S.branches[0].done, pts0: S.branches[0].pts.length,
                                              copper: +S.copperUsed.toFixed(2) }));
  // simulate brushing a keep-out zone while drawing the second branch
  await page.evaluate(() => {
    S.bi = 1; const b = S.branches[1];
    b.pts = [{ x: S.src.x, y: S.src.y, w: 0.3 }]; b.heat = [0]; b.copper = 0.4;
    S.copperUsed = totalCopper();
    S.drawing = true; endStroke(false);
  });
  const after = await page.evaluate(() => ({ done0: S.branches[0].done, pts0: S.branches[0].pts.length,
                                             pts1: S.branches[1].pts.length, copper: +S.copperUsed.toFixed(2) }));
  console.log('   before', JSON.stringify(before), 'after', JSON.stringify(after));
  ok(after.done0 === true && after.pts0 === before.pts0, 'the finished branch survives a slip on the next one');
  ok(after.pts1 === 0, 'the branch being drawn is cleared');
  ok(Math.abs(after.copper - before.copper) < 0.01, 'copper spent on the aborted stroke is refunded');

  console.log('\n== sawtooth pacing ==');
  const pace = await page.evaluate(() => {
    const out = {};
    S.needBreather = false; S.stage = 4; genBoard();
    out.teachingStageNotEased = (S.breather === false && S.type === 'series');
    S.needBreather = false; S.stage = 7; genBoard();
    out.parallelStageNotEased = (S.breather === false && S.type === 'parallel');
    S.stage = 10; S.needBreather = true; genBoard();
    const d = Math.hypot(S.lamps[0].x - S.src.x, S.lamps[0].y - S.src.y);
    const load = S.branches[0].lamps.length * CFG.R_LOAD;
    const unEased = CFG.I_REF * (rho() * d / CFG.W_REF + load)
                  * (1 + CFG.V_RAMP * (S.stage - 1) * META.skill);
    out.breather = S.breather;
    out.volts = +S.volts.toFixed(1);
    out.sameBoardUneased = +unEased.toFixed(1);
    out.easedV = S.volts < unEased * 0.95;
    out.singleLamp = S.lamps.length === 1;
    return out;
  });
  console.log('  ', JSON.stringify(pace));
  ok(pace.teachingStageNotEased, 'stage 4 still teaches series, never eased into a breather');
  ok(pace.parallelStageNotEased, 'stage 7 still teaches parallel');
  ok(pace.breather && pace.easedV && pace.singleLamp, 'a close call schedules an easier next board');

  console.log('\n== every board is winnable with headroom ==');
  // The generator eases a board until a competent route has real margin, so a
  // player is never handed a board that cannot be won well. This samples the
  // whole stage range because the failure it guards against is random: one
  // board in twenty coming out impossible reads as the game being unfair.
  const gen = await page.evaluate(() => {
    const out = { checked: 0, worst: Infinity, floor: CFG.MIN_MARGIN, bad: [] };
    const savedSkill = META.skill;
    for (let stage = 1; stage <= 30; stage++) {
      for (let i = 0; i < 25; i++) {
        S.mods = baseMods(); META.skill = 1;
        S.needBreather = false; S.stage = stage; genBoard();
        const m = boardMargin().m;
        const floor = S.boss ? CFG.MIN_MARGIN_BOSS : CFG.MIN_MARGIN;
        out.checked++;
        if (m - floor < out.worst) out.worst = +(m - floor).toFixed(3);
        if (m < floor) out.bad.push({ stage, margin: +m.toFixed(3), type: S.type, boss: !!S.boss });
      }
    }
    META.skill = savedSkill;
    return out;
  });
  console.log('   checked ' + gen.checked + ' generated boards; closest any came to its floor: ' +
              gen.worst + ' (regular floor ' + gen.floor + ', boss floor lower)');
  ok(gen.bad.length === 0, 'no generated board falls below the solvability floor');
  if (gen.bad.length) console.log('   offenders: ' + JSON.stringify(gen.bad.slice(0, 5)));

  console.log('\n== chapters and bosses ==');
  const chap = await page.evaluate(() => {
    const out = { bosses: [], distinct: new Set(), badFloor: [], names: new Set() };
    for (let st = 1; st <= 36; st++) {
      S.mods = baseMods(); META.skill = 1; S.needBreather = false; S.stage = st; genBoard();
      out.names.add(chapter(st).name);
      if (isBoss(st)) { out.bosses.push(S.boss.title); out.distinct.add(S.boss.title); }
      else if (S.boss) out.badFloor.push('non-boss stage ' + st + ' has a boss');
      const floor = S.boss ? CFG.MIN_MARGIN_BOSS : CFG.MIN_MARGIN;
      if (boardMargin().m < floor) out.badFloor.push('stage ' + st + ' below floor');
    }
    return { bosses: out.bosses, distinct: out.distinct.size, bad: out.badFloor, names: out.names.size };
  });
  console.log('   ' + chap.bosses.length + ' bosses in 36 stages, ' + chap.distinct +
              ' distinct, ' + chap.names + ' named sectors');
  ok(chap.bosses.length === 6 && chap.distinct === 6, 'each sector ends in its own boss');
  ok(chap.names === 6, 'six named sectors across 36 stages');
  ok(chap.bad.length === 0, 'bosses bite but stay winnable');
  if (chap.bad.length) console.log('   ' + JSON.stringify(chap.bad.slice(0, 4)));

  console.log('\n== the daily board ==');
  const daily = await page.evaluate(() => {
    const snap = () => JSON.stringify({ t:S.type, src:S.src, lamps:S.lamps.map(l=>[l.x,l.y]),
                                        obs:S.obs.map(o=>[o.x,o.y,o.w,o.h]), v:+S.volts.toFixed(4),
                                        b:+S.budget.toFixed(4) });
    const out = {};
    // same day, same board - twice in a row
    startDaily(); const a = snap();
    startDaily(); const b = snap();
    out.deterministic = (a === b);
    // lab upgrades must not change the shared puzzle
    const savedUp = JSON.parse(JSON.stringify(META.up)), savedSkill = META.skill;
    META.up.copper = 3; META.up.stock = 3; META.up.reserves = 3; META.skill = 1.3;
    startDaily(); out.ignoresUpgrades = (snap() === a);
    META.up = savedUp; META.skill = savedSkill;
    out.mods = S.mods.rho === 1 && S.mods.wmax === 1 && S.mods.budget === 1;

    // streak arithmetic
    const day = dayNum();
    const run = (lastDay, freezes) => {
      META.dailyDay = lastDay; META.streak = 5; META.freezes = freezes;
      META.daysPlayed = 3;                       // not a multiple of 5
      completeDaily(50);
      return { streak: META.streak, freezes: META.freezes };
    };
    out.consecutive = run(day - 1, 0);           // yesterday -> 6
    out.gapWithFuse = run(day - 2, 1);           // missed one, had a fuse -> 6, fuse spent
    out.gapNoFuse   = run(day - 2, 0);           // missed one, no fuse -> resets to 1
    out.longGap     = run(day - 9, 2);           // long absence -> resets, fuse kept

    // replaying the same day must not double count
    META.dailyDay = null; META.streak = 0; META.daysPlayed = 0; META.freezes = 0;
    completeDaily(40); const first = META.streak;
    completeDaily(90); out.sameDay = { streak: META.streak, unchanged: META.streak === first,
                                       best: META.dailyBest };
    // a fuse is earned every fifth day played, capped
    META.daysPlayed = 4; META.freezes = 0; META.dailyDay = dayNum() - 1;
    completeDaily(10); out.earnedFuse = META.freezes;
    META.daysPlayed = 9; META.freezes = 2; META.dailyDay = dayNum() - 1;
    completeDaily(10); out.fuseCap = META.freezes;
    return out;
  });
  console.log('  ', JSON.stringify(daily));
  ok(daily.deterministic, 'the daily board is identical for the same day');
  ok(daily.ignoresUpgrades && daily.mods, 'the daily ignores lab upgrades so everyone solves the same puzzle');
  ok(daily.consecutive.streak === 6, 'playing yesterday and today extends the streak');
  ok(daily.gapWithFuse.streak === 6 && daily.gapWithFuse.freezes === 0,
     'a spare fuse covers one missed day and is spent doing it');
  ok(daily.gapNoFuse.streak === 1, 'a missed day with no fuse resets the streak');
  ok(daily.longGap.streak === 1 && daily.longGap.freezes === 2,
     'a long absence resets the streak without eating a fuse');
  ok(daily.sameDay.unchanged && daily.sameDay.best === 90,
     'replaying the same day does not double count, but a better solve still records');
  ok(daily.earnedFuse === 1 && daily.fuseCap === 2, 'a fuse is earned every fifth day, capped at two');

  console.log('\n== a failed daily costs an attempt, not the streak ==');
  const retry = await page.evaluate(() => {
    startDaily();
    const before = JSON.stringify({ src:S.src, lamps:S.lamps.map(l=>[l.x,l.y]) });
    const streakBefore = META.streak;
    S.lastFail = 'BURNED'; S.failText = ['Burned out','x']; S.daily = true;
    afterBurn();
    return { stillDaily: S.daily, phase: S.phase,
             sameBoard: JSON.stringify({ src:S.src, lamps:S.lamps.map(l=>[l.x,l.y]) }) === before,
             streakKept: META.streak === streakBefore,
             overShowing: document.getElementById('over').classList.contains('show') };
  });
  console.log('  ', JSON.stringify(retry));
  ok(retry.stillDaily && retry.phase === 'draw' && retry.sameBoard,
     'failing the daily puts the same board back, unlimited attempts');
  ok(!retry.overShowing && retry.streakKept, 'a failed attempt does not end anything or cost the streak');

  console.log('\n== mute ==');
  const muted = await page.evaluate(() => {
    document.getElementById('mute').click();
    return { flag: META.muted, cls: document.getElementById('mute').classList.contains('off'),
             stored: JSON.parse(localStorage.getItem('current.save.v2')).muted };
  });
  ok(muted.flag && muted.cls && muted.stored === true, 'mute toggles, shows state and persists');
  await page.evaluate(() => document.getElementById('mute').click());

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
