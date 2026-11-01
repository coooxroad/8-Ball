/* Server checks, without Cloudflare: the vault's rules on node's own SQLite, and matches played again.
   npm test   (or: node tools/pack.cjs && node --no-warnings test/test.js) */
import { DatabaseSync } from 'node:sqlite';
import { VaultCore } from '../src/core.js';
import { playMatch, playPuzzle, Replay, E } from '../src/check.js';

let failed = 0; const fail = m => { failed++; console.log('FAIL', m); }, ok = (c, m) => { if (!c) fail(m); };
const vault = env => {
  const db = new DatabaseSync(':memory:');
  const sql = { exec(q, ...a) { if (/^\s*(CREATE|BEGIN|COMMIT|ROLLBACK)/i.test(q)) { db.exec(q); return { toArray: () => [] }; } const st = db.prepare(q); if (/^\s*SELECT/i.test(q)) { const rows = st.all(...a); return { toArray: () => rows }; } st.run(...a); return { toArray: () => [] }; } };
  const tx = fn => { db.exec('BEGIN'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } };
  return new VaultCore(sql, env || {}, tx);
};
let n = 0; const req = () => 'test-req-' + (++n).toString().padStart(4, '0');

// accounts
{ const v = vault(); ok(v.init('h1'), 'init'); ok(!v.init('h2'), 'init twice'); ok(v.authed('h1') && !v.authed('h2'), 'auth'); ok(v.me().dama === E.ECONOMY.DAMA_START, 'dama start'); }

// the shop: price by rarity, only with the money, once per request, nothing changed when short
{
  const v = vault(); v.init('h');
  const it = E.CUES.find(c => c.rarity === 1), price = E.priceOf(it).coin;
  ok(v.owns('cue', E.CUES.find(c => c.rarity === 0).id), 'a common item is owned from the start');
  const r0 = v.buy({ req: req(), kind: 'cue', id: it.id }); ok(!r0.ok && v.me().coin === 0 && !v.owns('cue', it.id), 'cannot buy without the coins');
  v.pay('test', price + 5, 0);
  const q = req(), r1 = v.buy({ req: q, kind: 'cue', id: it.id }), r2 = v.buy({ req: q, kind: 'cue', id: it.id });
  ok(r1.ok && v.me().coin === 5 && v.owns('cue', it.id), 'bought'); ok(r1.ok && r2.ok && v.me().coin === 5, 'the same request twice pays once');
  ok(!v.buy({ req: req(), kind: 'cue', id: it.id }).ok && v.me().coin === 5, 'cannot buy twice');
  ok(!v.buy({ req: req(), kind: 'cue', id: 'nope' }).ok, 'no such item');
  ok(!v.buy({ req: 'short', kind: 'cue', id: it.id }).ok, 'a request needs its number');
  console.log('shop: checked');
}

// puzzles: an unknown one, or a nonsense shot, pays nothing
{ const v = vault(); v.init('h'); ok(!v.puzzle({ req: req(), id: 99999, shot: { aim: 0, V: 2, a: 0, b: 0 } }).ok && v.me().coin === 0, 'unknown puzzle'); ok(!playPuzzle(1, { aim: 0, V: 999, a: 0, b: 0 }).ok, 'nonsense shot'); console.log('puzzles: checked (none to solve yet)'); }

// a match recorded the way the app records it, by two computers playing it out
let s = 99; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
const H = E.createHighlights();
function record(mode, opts) {
  const g = E.createGame(E.physicsFor(E.createPhysics, 'bar')); const o = Object.assign({ level: 3 }, opts);
  g.start(mode, ['A', 'B'], false, Object.assign({ rnd }, o)); g.players[0].ai = g.players[1].ai = true; g.level = 3;
  const log = { v: 1, mode, table: 'bar', opts: o, shots: [] }, pts = [0, 0];
  while (!g.over && log.shots.length < 200) {
    const p = g.aiPlan(), w = g.world, inHand = !!g.placing;
    if (p.pos && g.placing) { const c = g.cueBall(); g.P.place(w, c.id, p.pos[0], p.pos[1]); }
    log.shots.push({ s: JSON.parse(JSON.stringify(H.snapshot(w))), aim: p.angle, V: p.V, a: p.a || 0, b: p.b || 0, el: p.el || 0, inHand });
    const me = g.turn; g.beginShot(); g.P.strike(w, p.angle, p.V, p.a || 0, p.b || 0, p.el || 0); g.P.run(w, 40);
    const potted = w.ev.pocketed.filter(q => q.id !== 0).length, r = g.resolve().r;
    if (g.mode.table === 'carom') { if (r.pts > 0) pts[me] += r.pts; } else if (!r.foul) pts[me] += potted;
  }
  log.winner = g.over ? g.over.winner : null; log.points = pts; return log;
}
for (const [mode, opts] of [['four', { target: 3, targets: [3, 3], tens: true }], ['eight', {}], ['three', { target: 2, cushions: 3 }], ['nine', {}]]) {
  const log = record(mode, opts); if (log.winner == null) { console.log(`${mode}: the computers did not finish in 200 shots (skipped)`); continue; }
  const t0 = Date.now(), r = playMatch(JSON.parse(JSON.stringify(log))), ms = Date.now() - t0;
  ok(r.ok && r.winner === log.winner && r.points.join() === log.points.join(), `${mode}: played again, same result (${r.why || ''})`);
  // a shot struck differently from what was sent leaves the balls elsewhere, and the next shot's start gives it away
  if (log.shots.length > 1) { const bad = JSON.parse(JSON.stringify(log)); bad.shots[0].V *= 1.03; ok(!playMatch(bad).ok, `${mode}: a changed shot is caught`); }
  // played in slices of a few steps, carrying on from checkpoints between shots, it comes out the same
  { let rp = null, cp = null, out = null, slices = 0; while (!out && slices < 100000) { rp = rp || new Replay(JSON.parse(JSON.stringify(log)), cp); out = rp.advance(37); slices++; const c = rp.checkpoint(); if (c && slices % 3 === 0) { cp = JSON.parse(JSON.stringify(c)); rp = null; } }
    ok(out && out.ok && out.points.join() === log.points.join() && out.winner === log.winner, `${mode}: sliced replay agrees (${out && out.why})`); }
  const moved = JSON.parse(JSON.stringify(log)); if (moved.shots.length > 1) { const j = moved.shots.length - 1, b = moved.shots[j].s.balls.findIndex((x, i) => x[2] && i !== moved.shots[j].s.cue); moved.shots[j].s.balls[b][0] += 0.01; ok(!playMatch(moved).ok, `${mode}: a moved ball is caught`); }
  // paid by the rules: checked, and unchecked within the daily allowance
  const v = vault({ CHECK_MATCHES: 'true' }); v.init('h');
  const pr = v.match({ req: req(), kind: 'cpu', log }); ok(pr.ok && pr.paid === E.matchCoins('cpu', mode, log.points, log.winner === 0), `${mode}: paid what the rules say`);
  console.log(`${mode}: ${log.shots.length} shots, points ${log.points.join(':')}, played again in ${ms} ms, cpu pays ${pr.paid}`);
}
{
  const v = vault({ CHECK_MATCHES: 'false' }); v.init('h'); let total = 0;
  for (let i = 0; i < 20; i++) total += v.match({ req: req(), kind: 'friend', log: { mode: 'four', winner: 0, points: [5, 4], shots: new Array(30).fill({}) } }).paid || 0;
  ok(total === E.ECONOMY.UNCHECKED_DAILY, `unchecked matches stop at the daily allowance (${total})`);
  ok(v.match({ req: req(), kind: 'friend', log: { mode: 'four', winner: 0, points: [50, 40], shots: [] } }).paid === 0, 'more points than shots pays nothing');
  ok(!v.match({ req: req(), kind: 'ranked', log: { mode: 'four' } }).ok, 'ranked is not paid from the device');
  console.log('unchecked matches: checked');
}
// DAMA and the tour
{ const [a, b] = E.damaAfter(30, 30, true); ok(a === 33 && b === 27, `dama: an even game moves each by 3 (${a}, ${b})`); const [c] = E.damaAfter(30, 80, true); ok(c > 33, 'beating someone higher earns more'); const [, d] = E.damaAfter(10, 30, true); ok(d >= E.ECONOMY.DAMA_FLOOR, 'nobody below the floor'); ok(E.tourPayout(1000) === 1800, 'tour: the pot less 10%'); }
// the free plan's way: a new account's first matches are queued, checked a slice at a time and paid at the end; a doctored
// one is turned down, and after that every match of the account is checked
{
  const v = vault({ CHECK_MATCHES: 'slices' }); v.init('h');
  const good = record('eight', {}), bad = JSON.parse(JSON.stringify(good));
  if (good.winner != null && good.shots.length > 1) {
    bad.shots[0].V *= 1.05;
    const r1 = v.match({ req: req(), kind: 'cpu', log: good }), r2 = v.match({ req: req(), kind: 'cpu', log: bad });
    ok(r1.pending && r2.pending && v.me().coin === 0 && v.me().checking === 2, 'queued, nothing paid yet');
    let n = 0; while (v.work(150) && n < 100000) { n++; if (n % 40 === 0) v.job = null; }      // (now and then forgetting the replay in hand, as a restart would)
    const want = E.matchCoins('cpu', 'eight', good.points, good.winner === 0);
    ok(v.me().coin === want && v.me().checking === 0, `paid after checking in ${n} slices: ${v.me().coin} (want ${want})`);
    ok(!!v.get('caught'), 'the doctored match marks the account');
    for (let k = 0; k < 6; k++) v.match({ req: req(), kind: 'cpu', log: good });
    ok(v.me().checking === 6, 'a caught account has every match checked');
    const u = vault({ CHECK_MATCHES: 'slices' }); u.init('h'); let queued = 0;
    for (let k = 0; k < 40; k++) if (u.match({ req: req(), kind: 'cpu', log: { mode: 'four', winner: 0, points: [3, 1], shots: new Array(20).fill({}) } }).pending) queued++;
    ok(queued >= 3 && queued < 30, `only a share is checked (${queued} of 40)`);
    console.log(`sliced checking: ${n} slices for two matches, paid ${v.me().coin}; ${queued} of 40 ordinary matches picked for checking`);
  }
}
console.log(failed ? `${failed} server check(s) failed` : 'server checks passed');
process.exit(failed ? 1 : 0);
