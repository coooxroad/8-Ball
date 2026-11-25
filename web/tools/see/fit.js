'use strict';
/* Fitting the seeing AI (ai/64-see-mind.js) to what real players do (owner 11-25 night; plan §8-3) - run by the Fit
   workflow (.github/workflows/fit.yml) with what the server keeps, or by hand:

     node web/tools/see/fit.js --shots shots.json [--tries tries.json] [--max 3000] [--write]

   1. The shots (the anonymous shot dataset - /v1/admin/dataset rows: each shot with its table and the shooter's rating):
      each human shot read by the seeing AI at its player's rating (seeInverse). Where one way plainly was meant (its
      chance at least 0.6, and the way really there), the aim is set against that way's middle as the player pictures it
      (r = aim - pictured middle) and as it really is (aim - real middle):
        the hand  - r over the hand's spread should be a normal error of one: the hand at 1500 scaled by its typical size
                    (the median of |r| / sigma over 0.6745, robust to a stroke meant for something else);
        the picture - aim - real middle = lambda (pictured - real middle) + error: lambda, by ratings' bands, is the share
                    of the picture's lean players really show; the picture's skill s(R) = 1 - lambda (1 - s) at each band's
                    middle rating, and COMP, COMP_W the logistic through them (least squares on the logit).
      And Maia's measure (McIlroy-Young et al.): the share of shots whose aim lies in the way the model reads as meant,
      by band - how well it tells what a player of that rating does.
   2. The puzzle attempts (/v1/admin/puzzles rows: puzzle, score, the player's rating then): each puzzle's rating from
      them (tools/puzzles/fit.js puzzleRating - Elo's curve, pulled to the seeing AI's rating) against the seeing AI's
      (tools/puzzles/see-ratings.json: its rating and what its answer's way asks); a ridge regression of the difference
      on what the way asks says what each thing is worth to real players beyond the picture - FIND added to.
   Each part changes the numbers only with enough behind it (SHOTS_MIN shots, PUZZLES_MIN puzzles); the report says all.
   --write: web/ai/64a-see-fit.js (the numbers the app and the server then use) and web/tools/see/fit-report.json. */
const fs = require('fs'), path = require('path');
const W = path.join(__dirname, '../..');
const createPhysics = require(path.join(W, 'physics.js')), createGame = require(path.join(W, 'game.js')), { physicsFor } = require(path.join(W, 'tables.js'));
const createAI = new Function('g', fs.readdirSync(path.join(W, 'ai')).sort().map(f => fs.readFileSync(path.join(W, 'ai', f), 'utf8')).join('\n'));
const args = process.argv.slice(2), opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : null; };
const SHOTS_MIN = +(opt('min-shots') || 400), PUZZLES_MIN = +(opt('min-puzzles') || 40), MODES = ['four', 'three', 'eight', 'nine'], BANDS = [[0, 900], [900, 1300], [1300, 1700], [1700, 2100], [2100, 4000]];
const g = createGame(physicsFor(createPhysics, 'bar'), createAI); g.start('four', ['A', 'B'], false, { rnd: () => 0.5 });
const S = g.aiJudge.see;
const read = f => { if (!f || !fs.existsSync(f)) return []; const j = JSON.parse(fs.readFileSync(f, 'utf8')); return j.rows || j; };

// ---- 1. the shots
function shotsPart(rows, max) {
  const pts = [], maia = BANDS.map(() => ({ n: 0, hit: 0 })); let seen = 0;
  for (const row of rows) {
    if (pts.length >= max || !MODES.includes(row.mode) || !Array.isArray(row.shots)) continue;
    for (const s of row.shots) {
      if (pts.length >= max) break;
      if (!Array.isArray(s) || s.length < 9 || s[6]) continue;   // (a timeout; a ball in hand - where it was put is part of the plan)
      const seat = row.seats && row.seats[s[0]]; if (!seat || !seat.human || !Number.isFinite(seat.rating)) continue;
      g.start(row.mode, ['A', 'B'], false, Object.assign({ rnd: () => 0.5 }, row.opts || {})); g.isBreak = false; g.placing = null;
      const w = g.world; for (let i = 0; i < w.balls.length; i++) { const k = 8 + 3 * i; if (k + 2 >= s.length) break; g.P.place(w, i, s[k], s[k + 1]); w.balls[i].on = !!s[k + 2]; }
      const cue = s[7], who = g.P.POCKETED ? s[0] : cue; w.cue = g.P.POCKETED ? 0 : cue; g.turn = who; seen++;
      const shot = { angle: s[1], V: s[2], a: s[3], b: s[4], el: s[5] }, R = seat.rating;
      let inv; try { inv = S.seeInverse(w, who, shot, R, { win: 0.06 }); } catch (e) { continue; }
      const band = BANDS.findIndex(([lo, hi]) => R >= lo && R < hi), top = inv.post[0];
      if (band >= 0) { maia[band].n++; if (top && top.route.lo <= shot.angle && shot.angle <= top.route.hi) maia[band].hit++; }
      if (!top || top.p < 0.6 || !top.route.truth || top.route.kiss) continue;
      const rt = top.route, sig = S.seeHand(R, shot).aim;
      pts.push({ R, band, z: (shot.angle - rt.c) / sig, real: shot.angle - rt.truth.c, lean: rt.c - rt.truth.c, s: S.seeComp(R) });
    }
  }
  const out = { shots: seen, used: pts.length, maia: maia.map((m, i) => ({ band: BANDS[i], n: m.n, explained: m.n ? Math.round(m.hit / m.n * 1000) / 1000 : null })) };
  if (pts.length < SHOTS_MIN) return Object.assign(out, { note: `too few (${pts.length} < ${SHOTS_MIN})` });
  // the hand: |z| should have the median of a normal error's (0.6745)
  const az = pts.map(p => Math.abs(p.z)).sort((a, b) => a - b), med = az[az.length >> 1];
  out.aim1500 = +(S.SEE.AIM_1500 * med / 0.6745).toFixed(6);
  // the picture: lambda by band (aim - real middle on the picture's lean, through the origin), s at the band's middle
  const knots = [];
  BANDS.forEach((b, i) => {
    const q = pts.filter(p => p.band === i && Math.abs(p.lean) > 1e-5); if (q.length < 40) return;
    const lam = q.reduce((a, p) => a + p.real * p.lean, 0) / q.reduce((a, p) => a + p.lean * p.lean, 0);
    const Rm = q.reduce((a, p) => a + p.R, 0) / q.length, s0 = S.seeComp(Rm), s1 = Math.min(0.995, Math.max(0.005, 1 - Math.max(0, lam) * (1 - s0)));
    knots.push({ R: Rm, lam: +lam.toFixed(3), s: +s1.toFixed(3), n: q.length });
  });
  out.knots = knots;
  if (knots.length >= 2) {
    // logit(s) = (R - COMP) / COMP_W: a line through the knots, weighted by their shots
    const X = knots.map(k => k.R), Y = knots.map(k => Math.log(k.s / (1 - k.s))), Wt = knots.map(k => k.n), sw = Wt.reduce((a, x) => a + x, 0);
    const mx = X.reduce((a, x, i) => a + Wt[i] * x, 0) / sw, my = Y.reduce((a, y, i) => a + Wt[i] * y, 0) / sw;
    const b = X.reduce((a, x, i) => a + Wt[i] * (x - mx) * (Y[i] - my), 0) / X.reduce((a, x, i) => a + Wt[i] * (x - mx) ** 2, 0);
    if (b > 0) { out.compW = Math.round(1 / b); out.comp = Math.round(mx - my / b); }
  }
  return out;
}

// ---- 2. the puzzles
function puzzlesPart(rows) {
  const PF = require(path.join(W, 'tools/puzzles/fit.js')), file = path.join(W, 'tools/puzzles/see-ratings.json');
  if (!fs.existsSync(file)) return { note: 'no see-ratings.json' };
  const see = new Map(JSON.parse(fs.readFileSync(file, 'utf8')).map(r => [r.id, r]));
  const by = new Map(); for (const t of rows) { const s = PF.scoreOf(t.res); if (s == null || !Number.isFinite(+t.pr) || !see.has(t.id)) continue; if (!by.has(t.id)) by.set(t.id, []); by.get(t.id).push({ pr: +t.pr, s }); }
  const out = { puzzles: by.size, tries: [...by.values()].reduce((a, l) => a + l.length, 0) };
  if (by.size < PUZZLES_MIN) return Object.assign(out, { note: `too few (${by.size} < ${PUZZLES_MIN})` });
  const KEYS = ['cushions', 'kick', 'bank', 'combo', 'side', 'fb', 'raised', 'wall', 'graze', 'curved', 'img'], find = {};
  for (const game of ['four', 'pocket']) {
    const list = [...by].filter(([id]) => see.get(id).game === game && see.get(id).feats);
    if (list.length < PUZZLES_MIN / 2) continue;
    const X = list.map(([id]) => KEYS.map(k => +see.get(id).feats[k] || 0)), y = list.map(([id, t]) => PF.puzzleRating(t, see.get(id).see) - see.get(id).see), wt = list.map(([, t]) => Math.min(50, t.length));
    const w = PF.ridge(X, y, wt, 0.05 * wt.reduce((a, b) => a + b, 0));
    find[game] = Object.fromEntries(KEYS.map((k, i) => [k === 'cushions' ? 'cushion' : k === 'img' ? 'len' : k, Math.round(w[i + 1])]).filter(([, v]) => Math.abs(v) >= 10));
    find[game].base = Math.round(w[0]);
  }
  return Object.assign(out, { find });
}

const shots = read(opt('shots')), tries = read(opt('tries'));
const A = shotsPart(shots, +(opt('max') || 3000)), B = puzzlesPart(tries);
const fit = {}; for (const k of ['aim1500', 'comp', 'compW']) if (A[k] != null) fit[k] = A[k]; if (B.find) fit.find = B.find;
const report = { at: new Date().toISOString(), shots: A, puzzles: B, fit };
console.log(JSON.stringify(report, null, 1));
if (args.includes('--write')) {
  fs.writeFileSync(path.join(__dirname, 'fit-report.json'), JSON.stringify(report, null, 1) + '\n');
  if (Object.keys(fit).length) fs.writeFileSync(path.join(W, 'ai/64a-see-fit.js'), `  /* (generated by web/tools/see/fit.js - the Fit workflow, .github/workflows/fit.yml - do not edit by hand: what real
     players' puzzle attempts and ranked shots have taught the seeing AI, 64-see-mind.js seeApplyFit. ${report.at.slice(0, 10)}:
     ${A.used || 0} shots, ${B.puzzles || 0} puzzles) */
  const SEE_FIT = ${JSON.stringify(Object.assign({ at: report.at.slice(0, 10) }, fit))};
  seeApplyFit(SEE_FIT);
`);
  console.log('wrote', Object.keys(fit).length ? 'web/ai/64a-see-fit.js and ' : '', 'web/tools/see/fit-report.json');
}
