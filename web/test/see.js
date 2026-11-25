/* The seeing AI (ai/64-see-mind.js): what a player of a rating pictures, sees, plays and meant - checked on set tables
   against the physics. Run with `node web/test/see.js` (about half a minute). Exits non-zero on failure. */
const path = require('path'), fs = require('fs'), W = path.join(__dirname, '..');
const createPhysics = require(path.join(W, 'physics.js')), createGameRaw = require(path.join(W, 'game.js'));
const createAI = new Function('g', fs.readdirSync(path.join(W, 'ai')).sort().map(f => fs.readFileSync(path.join(W, 'ai', f), 'utf8')).join('\n'));
const bar = { R: 0.028575, HL: 0.99, HW: 0.495, cornerMouth: 0.114, sideMouth: 0.127 };
const g = createGameRaw({ pool: createPhysics(Object.assign({ pockets: true }, bar)), carom: createPhysics({ R: 0.03275, pockets: false }) }, createAI);
let failed = 0, ok = 0; const fail = m => { failed++; console.log('FAIL', m); }, check = (c, m) => c ? ok++ : fail(m);
const S = () => g.aiJudge.see, DEG = 180 / Math.PI, t0 = Date.now();
function eight(balls, cue) {
  g.start('eight', ['A', 'B'], true, { level: 3 });
  const w = g.world; for (const b of w.balls) { b.on = false; b.x = 9 + b.id; b.y = 9; }
  g.P.place(w, 0, cue[0], cue[1]); for (const id in balls) g.P.place(w, +id, balls[id][0], balls[id][1]);
  g.isBreak = false; g.placing = null; g.turn = 0; g.players[0].group = 'solid'; g.players[1].group = 'stripe';
}
function four(pos) { g.start('four', ['A', 'B'], true, { level: 3 }); pos.forEach((p, i) => g.P.place(g.world, i, p[0], p[1])); g.isBreak = false; g.placing = null; g.turn = 0; g.world.cue = 0; }
const routeNear = (rs, key, c) => rs.filter(r => r.key === key).sort((a, b) => Math.abs(a.c - c) - Math.abs(b.c - c))[0];

// ---- ② the picture: where the guide shows the game, the picture is the game; past it, the real game's share grows with R
{
  // a pool cut: the object ball's way is the line of centres (shown) - every rating pictures the pot where it is
  eight({ 1: [0.5, 0.2], 9: [-0.6, -0.3] }, [0, 0]);
  const sw = S().seeSweep(g.world, 0, { strokes: [{ V: 2, a: 0, b: 0, el: 0 }], kicks: 1 });
  const at = R => S().seeRoutes(sw, R), direct = R => at(R).find(r => r.key === '1>1:2|0' && r.truth);
  for (const R of [600, 1500, 2400]) { const r = direct(R); check(r && Math.abs(r.c - r.truth.c) < 0.05 / DEG, `a plain cut, pictured where it is at ${R}: ${r ? (r.c * DEG).toFixed(3) + ' vs ' + (r.truth.c * DEG).toFixed(3) : 'none'}`); }
  // a kick (a cushion first): the guide shows a mirror stub - the picture comes right as R rises (where the ball is
  // pictured going in, the cue ball's fate aside)
  const J = S().seeJudge(g.world, 0), truth = at(2400).find(r => r.key === '1>1:3|1' && r.truth).truth, recs = [];
  for (let d = -4.5; d <= 1; d += 0.02) recs.push([truth.c + d / DEG, S().seeRecord(g.world, 0, { angle: truth.c + d / DEG, V: 2, a: 0, b: 0, el: 0 }, J)]);
  const off = R => { const s = S().seeComp(R), inn = recs.filter(([, r]) => S().seeMindEv(r, s).ev.pocketed.some(q => q.id === 1 && q.pocket === 3)).map(([a]) => a); return inn.length ? Math.min(...inn.map(a => Math.abs(a - truth.c))) * DEG : Infinity; };
  const o6 = off(600), o15 = off(1500), o24 = off(2400);
  check(o6 > o15 && o15 > o24 && o24 < 0.25 && o6 > 1, `a kick pictured nearer the real one the higher the rating: 600 ${o6.toFixed(2)}°, 1500 ${o15.toFixed(2)}°, 2400 ${o24.toFixed(2)}°`);
  // a pot pictured comes to mind before a bank or a kick does
  const rs = at(1000), d = k => (rs.find(r => r.key.startsWith(k)) || {}).D;
  check(d('1>1:2|0') < d('1>1:4|0') && d('1>1:2|0') < d('1>1:3|1'), `a cut comes to mind before a bank and a kick: ${d('1>1:2|0')} / ${d('1>1:4|0')} / ${d('1>1:3|1')}`);
  // the same sweep, the same answer
  const again = S().seeRoutes(S().seeSweep(g.world, 0, { strokes: [{ V: 2, a: 0, b: 0, el: 0 }], kicks: 1 }), 1500).map(r => r.key + r.c.toFixed(6)).join(',');
  check(again === at(1500).map(r => r.key + r.c.toFixed(6)).join(','), 'the same table, the same ways');
}
{
  // 4구: with the real game wholly pictured (s = 1) the picture says what the physics does, wherever no kiss intervenes
  four([[-0.6, -0.1], [0.9, 0.5], [0, 0], [0.3, 0.35]]);
  const sw = S().seeSweep(g.world, 0, { strokes: [{ V: g.vOf(0.45), a: 0, b: 0.4, el: 0 }, { V: g.vOf(0.45), a: 0, b: -0.4, el: 0 }, { V: g.vOf(0.6), a: 0.4, b: 0, el: 0 }], kicks: 1, refine: false });
  let same = 0, n = 0, same0 = 0;
  for (const grp of sw.groups) for (const { rec } of grp.recs) { if (rec.ev.kissPre > 0 || rec.ev.kiss > 0) continue; n++; if (S().seeMindOk(rec, 1, sw.judge) === rec.ok) same++; if (S().seeMindOk(rec, 0, sw.judge) === rec.ok) same0++; }
  check(same / n > 0.93 && same > same0, `the whole game pictured says what the physics does: ${same}/${n} (the guide alone: ${same0})`);
  // ① a way of more cushions comes to mind later
  const rs = S().seeRoutes(sw, 1200), D = c => Math.min(...rs.filter(r => !r.kiss && r.feats.cushions === c && !r.feats.kick).map(r => r.D));
  check(D(0) < D(1) && D(1) < D(2), `more cushions, later to mind: ${D(0)} / ${D(1)} / ${D(2)}`);
  // ④ the hand halves every 400
  const h = S().seeHand(1100, {}), h2 = S().seeHand(1500, {}), hr = S().seeHand(1500, { el: 0.6 });
  check(Math.abs(h.aim / h2.aim - 2) < 1e-9 && Math.abs(hr.aim / h2.aim - 2.2) < 1e-9, 'the hand: twice as unsure 400 points down, 2.2 times with the cue raised');
  // ③ a sure way is chosen over an unsure one; ⑤ a stroke at a way's pictured middle was meant for it
  const ch = S().seeChoose([{ seen: 1, sure: 0.9 }, { seen: 1, sure: 0.3 }], 1500);
  check(ch.p[0] > 0.8, `the surer way chosen: ${ch.p.map(x => x.toFixed(2))}`);
  const r = rs.filter(q => !q.kiss && q.truth && q.half > 0.004 && q.sure > 0.6).sort((a, b) => b.seen - a.seen)[0];
  const inv = r && S().seeInverse(g.world, 0, { ...r.stroke, angle: r.c }, 1200);
  const top = inv && inv.post[0];
  check(top && top.route.key === r.key && Math.abs(top.route.c - r.c) < 0.003 && top.p > 0.5, `a stroke at a way's middle read as meant for it: ${top ? top.route.key + ' ' + top.p.toFixed(2) : 'none'}`);
}
// ---- ⑤ a kiss: meant by one who would see it and aimed for it; luck to one who would not
{
  let seed = 11; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  let told = 0, n = 0;
  for (let tbl = 0; tbl < 12 && n < 3; tbl++) {
    g.start('four', ['A', 'B'], true, { level: 3, rnd }); g.isBreak = false; g.turn = 0; g.world.cue = 0;
    const P = g.P, w = g.world; for (const b of w.balls) { let x, y; do { x = (rnd() * 2 - 1) * (P.HL - 0.05); y = (rnd() * 2 - 1) * (P.HW - 0.05); } while (!P.isFree(w, x, y, b.id)); P.place(w, b.id, x, y); }
    const st = { V: g.vOf(0.55), a: 0, b: 0, el: 0 };
    // (a kiss way found where the inverse looks - finely - and aimed at its middle)
    const sw = S().seeSweep(w, 0, { strokes: [st], refine: true }), rough = S().seeRoutes(sw, 2200).filter(r => r.kiss && r.half > 0.0015);
    for (const k of rough.slice(0, 2)) {
      const fine = S().seeInverse(w, 0, { ...st, angle: k.c }, 2200).routes.filter(r => r.kiss && r.half > 0.0015).sort((a, b) => Math.abs(a.c - k.c) - Math.abs(b.c - k.c))[0];
      if (!fine || S().kissSeen(fine.story, 2200) < 0.6) continue;
      const shot = { ...st, angle: fine.c }, hi = S().seeKiss(w, 0, shot, null, 2200), lo = S().seeKiss(w, 0, shot, null, 600);
      if (!hi || !lo || hi.right) continue;
      n++; if (hi.p >= 0.65 && lo.p < 0.35) told++; else console.log('  (kiss way', fine.key, 'hi', hi.p, hi.seen, 'lo', lo.p, lo.seen, ')');
    }
  }
  check(n >= 2 && told >= n - 1, `a kiss way aimed for: meant by a 2200 player who sees it, luck to a 600 one (${told}/${n})`);
}
console.log(`see: ${ok} checks passed${failed ? `, ${failed} FAILED` : ''} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
process.exit(failed ? 1 : 0);
