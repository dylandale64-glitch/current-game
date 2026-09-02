/* Automated balance sweep.

   Plays the game headlessly with a near-optimal bot, thousands of boards, and
   reports where the difficulty curve actually breaks. Guessing at balance from
   a few hand-played runs is how a game ends up impossible at stage 14 and
   nobody finds out until players do.

   The bot is deliberately close to optimal: it routes around keep-out zones
   with A*, then brute-forces the trace width that maximises the margin to
   every constraint at once. If the bot cannot clear a board, a human cannot
   either — so its win rate is the ceiling, not the average.

   Usage:  node tools/sweep.js [runsPerStage] [maxStage]
*/
const { chromium } = require('playwright');
const path = require('path');
const URL = 'file://' + path.join(__dirname, '..', 'index.html').replace(/\\/g, '/');

const RUNS = Number(process.argv[2]) || 60;
const MAX_STAGE = Number(process.argv[3]) || 24;

const BOT = () => {
  // ---- A* over a coarse grid, obstacles inflated by half the trace width ----
  window.__findPath = function (from, to, w) {
    const step = 0.22, cols = Math.ceil(CFG.BW / step) + 1, rows = Math.ceil(BH / step) + 1;
    const pad = w / 2 + 0.02;
    const free = (c, r) => {
      const x = c * step, y = r * step;
      if (x < pad || x > CFG.BW - pad || y < pad || y > BH - pad) return false;
      for (const o of S.obs)
        if (x > o.x - pad && x < o.x + o.w + pad && y > o.y - pad && y < o.y + o.h + pad) return false;
      return true;
    };
    const idx = (c, r) => r * cols + c;
    const sc = Math.round(from.x / step), sr = Math.round(from.y / step);
    const gc = Math.round(to.x / step), gr = Math.round(to.y / step);
    const g = new Float64Array(cols * rows).fill(Infinity);
    const prev = new Int32Array(cols * rows).fill(-1);
    const h = (c, r) => Math.hypot(c - gc, r - gr);
    const open = [[h(sc, sr), sc, sr]];
    g[idx(sc, sr)] = 0;
    const N8 = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
    let found = false, guard = 0;
    while (open.length && guard++ < 60000) {
      open.sort((a, b) => a[0] - b[0]);
      const [, c, r] = open.shift();
      if (c === gc && r === gr) { found = true; break; }
      for (const [dc, dr] of N8) {
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        if (!free(nc, nr) && !(nc === gc && nr === gr)) continue;
        const ng = g[idx(c, r)] + Math.hypot(dc, dr);
        if (ng < g[idx(nc, nr)]) {
          g[idx(nc, nr)] = ng; prev[idx(nc, nr)] = idx(c, r);
          open.push([ng + h(nc, nr), nc, nr]);
        }
      }
    }
    if (!found) return null;
    const pts = []; let cur = idx(gc, gr);
    while (cur !== -1) { pts.push({ x: (cur % cols) * step, y: Math.floor(cur / cols) * step }); cur = prev[cur]; }
    pts.reverse();
    pts[0] = { x: from.x, y: from.y }; pts[pts.length - 1] = { x: to.x, y: to.y };
    // shortcut: drop waypoints the trace can see past, so length is near-optimal
    const clear = (a, b) => {
      const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.05);
      for (let i = 0; i <= n; i++) {
        const x = a.x + (b.x - a.x) * i / n, y = a.y + (b.y - a.y) * i / n;
        if (x < pad || x > CFG.BW - pad || y < pad || y > BH - pad) return false;
        for (const o of S.obs)
          if (x > o.x - pad && x < o.x + o.w + pad && y > o.y - pad && y < o.y + o.h + pad) return false;
      }
      return true;
    };
    const out = [pts[0]];
    let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      while (j > i + 1 && !clear(pts[i], pts[j])) j--;
      out.push(pts[j]); i = j;
    }
    return out;
  };

  window.__pathLen = (p) => { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i].x - p[i-1].x, p[i].y - p[i-1].y); return L; };

  // Margin to every constraint at once, for one branch at one width.
  // Positive means comfortable; the bot maximises the worst margin.
  window.__score = function (L, w, volts, load, budgetShare) {
    const R = rho() * L / w, I = volts / (R + load);
    const inLow  = (I - CFG.I_MIN) / CFG.I_MIN;
    const inHigh = (iMax() - I) / iMax();
    const hSS = (I * I * rho() / (w * w)) * CFG.K_HEAT / (CFG.K_COOL * S.mods.cool);
    const heat = (hBurn() - hSS) / hBurn();
    const cu = (budgetShare - L * w) / Math.max(budgetShare, 0.01);
    const m = { under: inLow, over: inHigh, heat: heat, copper: cu };
    let bind = 'under', worst = Infinity;
    for (const k in m) if (m[k] < worst) { worst = m[k]; bind = k; }
    return { worst, bind, I, hSS, copper: L * w };
  };

  window.__bestW = function (L, volts, load, budgetShare) {
    let best = null;
    for (let k = 0; k <= 60; k++) {
      const w = wMin() + (wMax() - wMin()) * k / 60;
      const s = window.__score(L, w, volts, load, budgetShare);
      if (!best || s.worst > best.worst) best = { w, ...s };
    }
    return best;
  };

  // Lay a uniform-width trace along a path, matching the game's own data model.
  window.__lay = function (b, pathPts, w) {
    b.pts = []; b.heat = []; b.copper = 0;
    for (let i = 1; i < pathPts.length; i++) {
      const a = pathPts[i-1], c = pathPts[i];
      const n = Math.max(1, Math.ceil(Math.hypot(c.x-a.x, c.y-a.y) / CFG.STEP));
      for (let k = (i === 1 ? 0 : 1); k <= n; k++) {
        const t = k/n, x = a.x + (c.x-a.x)*t, y = a.y + (c.y-a.y)*t;
        const p = b.pts[b.pts.length-1];
        if (p) b.copper += Math.hypot(x-p.x, y-p.y) * w;
        b.pts.push({ x, y, w }); b.heat.push(0);
      }
    }
    b.done = true;
  };

  // Play one board with no wall-clock waiting: drive stepPhysics directly.
  window.__playBoard = function () {
    const stops = S.branches.map(b => [S.src].concat(b.lamps.map(i => S.lamps[i])));
    const paths = [];
    for (let bi = 0; bi < S.branches.length; bi++) {
      let full = [], okPath = true;
      for (let s = 0; s < stops[bi].length - 1; s++) {
        const seg = window.__findPath(stops[bi][s], stops[bi][s+1], 0.3);
        if (!seg) { okPath = false; break; }
        full = full.concat(s === 0 ? seg : seg.slice(1));
      }
      if (!okPath) return { outcome: 'NO_ROUTE', stage: S.stage, type: S.type };
      paths.push(full);
    }
    const lens = paths.map(window.__pathLen);
    const totalLen = lens.reduce((a, b) => a + b, 0);
    const load = S.branches[0].lamps.length * CFG.R_LOAD;
    const picks = paths.map((p, i) =>
      window.__bestW(lens[i], S.volts, load, S.budget * lens[i] / totalLen));

    // parallel: back both branches off together if their sum would blow the fuse
    if (S.branches.length > 1) {
      let guard = 0;
      while (guard++ < 60 && picks.reduce((a, p) => a + p.I, 0) > S.fuse) {
        const hot = picks[0].I > picks[1].I ? 0 : 1;
        picks[hot].w = Math.max(wMin(), picks[hot].w * 0.96);
        Object.assign(picks[hot], window.__score(lens[hot], picks[hot].w, S.volts, load,
                                                 S.budget * lens[hot] / totalLen));
      }
    }
    S.branches.forEach((b, i) => window.__lay(b, paths[i], picks[i].w));
    S.copperUsed = totalCopper();
    solve();
    const tight = picks.reduce((a, p) => p.worst < a.worst ? p : a);
    const margin = tight.worst, bind = tight.bind;
    const straight = S.branches.map(b => Math.hypot(
      S.lamps[b.lamps[0]].x - S.src.x, S.lamps[b.lamps[0]].y - S.src.y))
      .reduce((a, b) => a + b, 0);
    energize();
    let n = 0;
    while (S.phase === 'live' && n++ < 400) stepPhysics(1/60);
    const res = { stage: S.stage, type: S.type, margin: +margin.toFixed(3), bind,
                  detour: +(totalLen / Math.max(straight, 0.01)).toFixed(2),
                  volts: +S.volts.toFixed(1), obs: S.obs.length,
                  copper: +(S.copperUsed / S.budget).toFixed(2),
                  lampI: S.lamps.map(l => Math.round(l.I * 1000)),
                  breather: !!S.breather,
                  outcome: S.phase === 'live' ? 'TIMEOUT'
                         : (S.lastFail && S.phase !== 'result' ? S.lastFail : 'HELD') };
    cancelPending();
    return res;
  };

  window.__runOne = function (maxStage) {
    S.stage = 1; S.score = 0; S.chain = 0; S.sawChain = false; S.needBreather = false;
    S.solder = 1 + lvl('solder'); S.mods = baseMods();
    const log = [];
    for (let st = 1; st <= maxStage; st++) {
      S.stage = st; genBoard();
      const r = window.__playBoard();
      log.push(r);
      if (r.outcome !== 'HELD') break;
      // take an average draft pick so the sweep reflects a real run, not a naked one
      if (st % CFG.DRAFT_EVERY === 0) MODS[(Math.random() * MODS.length) | 0].f(S.mods);
      if (S.maxHeat > 0.72) S.needBreather = true;
    }
    return log;
  };
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(URL);
  await page.waitForFunction(() => typeof S !== 'undefined' && S.branches.length > 0);
  await page.evaluate(BOT);
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });

  const stages = {};
  let deepest = 0, totalBoards = 0;
  for (let run = 0; run < RUNS; run++) {
    const log = await page.evaluate((m) => window.__runOne(m), MAX_STAGE);
    for (const r of log) {
      totalBoards++;
      const s = stages[r.stage] || (stages[r.stage] = { n: 0, held: 0, out: {}, margin: [], type: {}, bind: {}, detour: [] });
      s.n++; if (r.outcome === 'HELD') s.held++;
      s.bind[r.bind] = (s.bind[r.bind] || 0) + 1;
      if (r.detour) s.detour.push(r.detour);
      s.out[r.outcome] = (s.out[r.outcome] || 0) + 1;
      s.type[r.type] = (s.type[r.type] || 0) + 1;
      s.margin.push(r.margin);
    }
    const last = log[log.length - 1];
    deepest = Math.max(deepest, last.outcome === 'HELD' ? last.stage : last.stage - 1);
  }

  console.log('\nBALANCE SWEEP — ' + RUNS + ' runs, ' + totalBoards + ' boards, bot playing near-optimally\n');
  console.log('stage  boards  bot win%   margin   detour   binding constraint      failures');
  console.log('-----  ------  --------   ------   ------   ------------------      --------');
  const problems = [];
  for (let st = 1; st <= MAX_STAGE; st++) {
    const s = stages[st]; if (!s) continue;
    const win = s.held / s.n;
    const med = s.margin.slice().sort((a, b) => a - b)[Math.floor(s.margin.length / 2)];
    const fails = Object.entries(s.out).filter(([k]) => k !== 'HELD')
      .map(([k, v]) => k + '×' + v).join(' ') || '—';
    const det = s.detour.length ? (s.detour.reduce((a,b)=>a+b,0)/s.detour.length) : 1;
    const binds = Object.entries(s.bind).sort((a,b)=>b[1]-a[1])
      .map(([k,v]) => k+'×'+v).join(' ');
    console.log(String(st).padStart(5) + String(s.n).padStart(8) +
      (win * 100).toFixed(0).padStart(9) + '%' + med.toFixed(3).padStart(9) +
      det.toFixed(2).padStart(9) + '   ' + binds.padEnd(22) + '  ' + fails);
    if (s.n >= 5 && win < 0.9) problems.push({ stage: st, win, fails, med });
  }
  console.log('\ndeepest stage a near-optimal bot reached: ' + deepest);
  if (problems.length) {
    console.log('\nSTAGES A PERFECT PLAYER CANNOT RELIABLY CLEAR:');
    for (const p of problems)
      console.log('  stage ' + p.stage + ': ' + (p.win * 100).toFixed(0) + '% win, margin ' +
                  p.med.toFixed(3) + ', ' + p.fails);
  } else {
    console.log('\nno stage in range is unwinnable for a perfect player.');
  }
  console.log('\npage errors: ' + (errs.length ? errs.slice(0, 3).join(' | ') : 'none'));
  await browser.close();
})();
