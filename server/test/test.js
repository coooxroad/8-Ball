/* Server checks, without Cloudflare: the vault's rules on node's own SQLite, and matches played again.
   npm test   (or: node tools/pack.cjs && node --no-warnings test/test.js) */
import { DatabaseSync } from 'node:sqlite';
import { VaultCore } from '../src/core.js';
import { playMatch, playPuzzle, Replay, E } from '../src/check.js';
import { logError, matchKey } from '../src/match-log.js';
import { LinkCore } from '../src/link.js';
import { originOk } from '../src/origins.js';
import { PHYS_V } from '../src/version.js';
import { datasetRow, DatasetCore, monthOf, dayOf, partsOf } from '../src/dataset-core.js';
import { PuzzleBookCore } from '../src/puzzlebook-core.js';
import { googleWho, forgetGoogleKeys, googleWhoAccess, googleWhoAny } from '../src/google.js';
import { MAX_DEVICES } from '../src/core.js';
import { LobbyCore, RoomCore, InviteCore, STAND_IN_AFTER, RETURN_WITHIN, RANKED_RULES, standInGear, standInMayResign, standInDelay, ROOM_TABLE, JOIN_WITHIN, IDLE_AFTER } from '../src/ranked.js';

let failed = 0; const fail = m => { failed++; console.log('FAIL', m); }, ok = (c, m) => { if (!c) fail(m); };
const sqlOf = () => {
  const db = new DatabaseSync(':memory:');
  const sql = { exec(q, ...a) { if (/^\s*(CREATE|BEGIN|COMMIT|ROLLBACK)/i.test(q)) { db.exec(q); return { toArray: () => [] }; } const st = db.prepare(q); if (/^\s*SELECT/i.test(q)) { const rows = st.all(...a); return { toArray: () => rows }; } st.run(...a); return { toArray: () => [] }; } };
  const tx = fn => { db.exec('BEGIN'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } };
  return { sql, tx };
};
const vault = env => { const { sql, tx } = sqlOf(); return new VaultCore(sql, env || {}, tx); };
let n = 0; const req = () => 'test-req-' + (++n).toString().padStart(4, '0');

// accounts
{ const v = vault(); ok(v.init('h1'), 'init'); ok(!v.init('h2'), 'init twice'); ok(v.authed('h1') && !v.authed('h2'), 'auth'); ok(v.me().dama === E.ECONOMY.DAMA_START, 'dama start'); }
{ const v = vault(); v.init('h'); v.set('r5', 0); v.set('dama', 19); const m = v.me(); ok(m.dama === 456 && m.rd === 250 && v.me().dama === 456, `rating: an account from before 5.0 is moved to the new scale once (${m.dama})`);
  const w = vault(); w.init('h'); w.set('r5', 0); w.set('dama', 1000); ok(w.me().dama === E.ECONOMY.DAMA_START, 'rating: one from the first days starts again'); }

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
// a puzzle solved with its answer pays once (a two-turn one with both its shots); one shot of two pays nothing
{ const Z = E.createPuzzles(), shot = s => ({ aim: s[0], V: s[1], a: s[2], b: s[3], el: s[4] });
  const one = Z.list.find(z => Z.turnsOf(z) === 1 && z.game), two = Z.list.find(z => Z.turnsOf(z) === 2);
  if (one) { const v = vault(); v.init('h'); const c0 = v.me().coin, r = v.puzzle({ req: req(), id: one.id, shot: shot(one.sol) });
    ok(r.ok && v.me().coin === c0 + E.ECONOMY.PUZZLE, 'a puzzle pays'); ok(v.puzzle({ req: req(), id: one.id, shot: shot(one.sol) }).paid === 0, 'a puzzle pays once'); }
  if (two) { const v = vault(); v.init('h');
    ok(!v.puzzle({ req: req(), id: two.id, shot: shot(two.sol[0]) }).ok, 'one shot of a two-turn puzzle pays nothing');
    ok(v.puzzle({ req: req(), id: two.id, shot: shot(two.sol[0]), shots: two.sol.map(shot) }).ok, 'a two-turn puzzle with both shots pays'); }
  console.log(`puzzles: paid when solved${two ? ', a two-turn one with both shots' : ''}`); }
// 퍼즐 레이팅 (core.js puzzleTry): solved with its shots up, missed down, a hint nothing; a solve whose shots do not solve
// it counts as missed; a puzzle counts once; the rating is in me()
{ const Z = E.createPuzzles(), shot = s => ({ aim: s[0], V: s[1], a: s[2], b: s[3], el: s[4] }), L = Z.list.filter(z => Z.turnsOf(z) === 1 && Number.isFinite(z.rating) && z.game);
  if (L.length >= 3) {
    const v = vault(), k = Z.gameOf(L[0]); v.init('h');
    const a = v.puzzleTry({ req: req(), id: L[0].id, res: 'o', shots: [shot(L[0].sol)] });
    ok(a.ok && a.res === 1 && a.pzr[k].r > Z.RATE.START && a.book && a.book.pr === Z.RATE.START, 'a solve raises the puzzle rating');
    ok(v.puzzleTry({ req: req(), id: L[0].id, res: 'x' }).again && v.me().pzr[k].r === a.pzr[k].r, 'a puzzle counts once');
    const L1 = L.find(z => Z.gameOf(z) === k && z.id !== L[0].id), b = v.puzzleTry({ req: req(), id: L1.id, res: 'o', shots: [{ aim: 0, V: 1, a: 0, b: 0, el: 0 }] });
    ok(b.ok && b.res === 0 && b.pzr[k].r < a.pzr[k].r, 'a solve without its shots counts as missed');
    const L2 = L.find(z => Z.gameOf(z) === k && z.id !== L[0].id && z.id !== L1.id), h = v.puzzleTry({ req: req(), id: L2.id, res: 'h' });
    ok(h.ok && !h.book && h.pzr[k].r === b.pzr[k].r, 'a hint counts for nothing');
    const L3 = L.find(z => Z.gameOf(z) === k && ![L[0].id, L1.id, L2.id].includes(z.id)), t = L3 && v.puzzleTry({ req: req(), id: L3.id, res: 0.75, shots: [shot(L3.sol)] });
    if (L3) ok(t.ok && t.res === 0.75 && t.book && t.book.res === 0.75 && !v.puzzleTry({ req: req(), id: L.find(z => Z.gameOf(z) === k && ![L[0].id, L1.id, L2.id, L3.id].includes(z.id)).id, res: 0.6 }).ok, 'a stage scored by its stars (0.75: the second try); no other score taken');
    console.log('puzzle rating: kept on the account, checked solves, scored by stars'); } }
// the puzzles' book (puzzlebook-core.js): an attempt rates the puzzle back - a miss gives it points; tried enough it is live
{ const Z = E.createPuzzles(), z = Z.list.find(q => Number.isFinite(q.rating));
  if (z) { const B = new PuzzleBookCore(sqlOf().sql, E), r0 = B.get(z.id).r;
    ok(B.try({ id: z.id, res: 'x', pr: z.rating, prd: 100 }).r > r0, 'a miss gives the puzzle points');
    { const B2 = new PuzzleBookCore(sqlOf().sql, E); ok(B2.try({ id: z.id, res: 0.5, pr: z.rating, prd: 100 }).r === B2.get(z.id).r && Math.abs(B2.get(z.id).r - r0) < 2, 'an even score (0.5) leaves an even puzzle where it was'); }
    for (let i = 0; i < 5; i++) B.try({ id: z.id, res: 'o', pr: z.rating + 200, prd: 80 });
    ok(B.live().live.some(q => q[0] === z.id) && B.stats().tries === 6 && B.export(0, 10).rows.length === 6 && !B.try({ id: 999999, res: 'o', pr: 1000 }).ok, 'the book: live, counted, read out');
    console.log('puzzle book: rated back, kept'); } }

// a match recorded the way the app records it, by two computers playing it out
let s = 99; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
const H = E.createHighlights();
function record(mode, opts) {
  const g = E.createGame(E.physicsFor(E.createPhysics, 'bar'), E.createAI); const o = Object.assign({ level: 3 }, opts);
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
// Structurally complete logs for paths that intentionally do not replay physics. Distinct inputs model distinct games.
function uncheckedLog(i, points = [5, 4]) {
  const g = E.createGame(E.physicsFor(E.createPhysics, 'bar'), E.createAI); g.start('four', ['A', 'B'], false, { rnd });
  const sh = { s: H.snapshot(g.world), aim: i / 1000, V: 2, a: 0, b: 0, el: 0 };
  return { mode: 'four', winner: 0, points, shots: Array.from({ length: 30 }, () => structuredClone(sh)) };
}
for (const [mode, opts] of [['four', { target: 3, targets: [3, 3], tens: true }], ['eight', {}], ['three', { target: 2, cushions: 3 }], ['nine', {}]]) {
  const log = record(mode, opts); if (log.winner == null) { console.log(`${mode}: the computers did not finish in 200 shots (skipped)`); continue; }
  const t0 = Date.now(), r = playMatch(JSON.parse(JSON.stringify(log))), ms = Date.now() - t0;
  ok(r.ok && r.winner === log.winner && r.points.join() === log.points.join(), `${mode}: played again, same result (${r.why || ''})`);
  // a shot struck differently from what was sent leaves the balls elsewhere, and the next shot's start gives it away
  // (a shot well under the strongest: a break at full power is held at the physics' top speed, and 3% more is the same shot)
  const k = log.shots.findIndex((q, i) => i < log.shots.length - 1 && q.V < 5);
  if (k >= 0) { const bad = JSON.parse(JSON.stringify(log)); bad.shots[k].V *= 1.03; ok(!playMatch(bad).ok, `${mode}: a changed shot is caught`); }
  // played in slices of a few steps, carrying on from checkpoints between shots, it comes out the same
  { let rp = null, cp = null, out = null, slices = 0; while (!out && slices < 100000) { rp = rp || new Replay(JSON.parse(JSON.stringify(log)), cp); out = rp.advance(37); slices++; const c = rp.checkpoint(); if (c && slices % 3 === 0) { cp = JSON.parse(JSON.stringify(c)); rp = null; } }
    ok(out && out.ok && out.points.join() === log.points.join() && out.winner === log.winner, `${mode}: sliced replay agrees (${out && out.why})`); }
  const moved = JSON.parse(JSON.stringify(log)); if (moved.shots.length > 1) { const j = moved.shots.length - 1, b = moved.shots[j].s.balls.findIndex((x, i) => x[2] && i !== moved.shots[j].s.cue); moved.shots[j].s.balls[b][0] += 0.01; ok(!playMatch(moved).ok, `${mode}: a moved ball is caught`); }
  // paid by the rules: checked, and unchecked within the daily allowance
  const v = vault({ CHECK_MATCHES: 'true' }); v.init('h');
  const pr = v.match({ req: req(), kind: 'cpu', log }); ok(pr.ok && pr.paid === E.matchCoins('cpu', mode, log.points, log.winner === 0), `${mode}: paid what the rules say`);
  const balance = v.me().coin;
  ok(!v.match({ req: req(), kind: 'cpu', log: structuredClone(log) }).ok && v.me().coin === balance, `${mode}: a new request cannot claim the same match again`);
  // A final shot can land exactly on a slice boundary, just before begin() reports the result.
  const end = new Replay(log); while (!end.out && !end.g.over) end.advance(1);
  const cp = structuredClone(end.lastCp), restored = new Replay(log, cp).advance(150);
  ok(restored?.ok && restored.winner === log.winner, `${mode}: terminal checkpoint retains the winner`);
  delete cp.over;
  ok(new Replay(log, cp).advance(Infinity)?.ok, `${mode}: legacy terminal checkpoints recover`);
  // Multiple pots in one pool shot still pay on the unsampled path.
  const u = vault({ CHECK_MATCHES: 'false' }); u.init('h');
  ok(u.match({ req: req(), kind: 'cpu', log }).paid === E.matchCoins('cpu', mode, log.points, log.winner === 0), `${mode}: unchecked legal match pays`);
  console.log(`${mode}: ${log.shots.length} shots, points ${log.points.join(':')}, played again in ${ms} ms, cpu pays ${pr.paid}`);
}
{
  const v = vault({ CHECK_MATCHES: 'false' }); v.init('h'); let total = 0;
  for (let i = 0; i < 20; i++) total += v.match({ req: req(), kind: 'friend', log: uncheckedLog(i) }).paid || 0;
  ok(total === E.ECONOMY.UNCHECKED_DAILY, `unchecked matches stop at the daily allowance (${total})`);
  ok(v.match({ req: req(), kind: 'friend', log: uncheckedLog(21, [50, 40]) }).paid === 0, 'more carom points than shots pays nothing');
  ok(!v.match({ req: req(), kind: 'ranked', log: { mode: 'four' } }).ok, 'ranked is not paid from the device');
  console.log('unchecked matches: checked');
}
// DAMA and the tour
{ const [a, b, ra] = E.damaAfter(500, 500, true); ok(a - 500 === 500 - b && a - 500 > 100 && ra < 350, `rating: two new players move a lot, evenly, and are surer after (${a}, ${b}, ${Math.round(ra)})`);
  const [c, d] = E.damaAfter(1500, 1500, true, 50, 50); ok(c - 1500 >= 5 && c - 1500 <= 9 && c - 1500 === 1500 - d, `rating: two settled players move a few points (${c - 1500})`);
  const [e] = E.damaAfter(1500, 1800, true, 50, 50); ok(e - 1500 > c - 1500, 'rating: beating someone higher earns more');
  const [f] = E.damaAfter(1500, 1500, true, 50, 350); ok(f - 1500 < c - 1500, 'rating: a win over someone unknown counts for less');
  const [, g] = E.damaAfter(500, 110, false); ok(g >= E.ECONOMY.DAMA_FLOOR, 'rating: nobody below the floor');
  ok(E.rdNow(50, 365) > 200 && E.rdNow(50, 0) === 50 && E.rdNow(340, 9999) === E.ECONOMY.RD_MAX, 'rating: less sure after a long time away'); ok(E.tourPayout(1000) === 1800, 'tour: the pot less 10%'); }
// the free plan's way: a new account's first matches are queued, checked a slice at a time and paid at the end; a doctored
// one is turned down, and after that every match of the account is checked
{
  const v = vault({ CHECK_MATCHES: 'slices' }); v.init('h');
  const good = record('eight', {}), bad = JSON.parse(JSON.stringify(good));
  if (good.winner != null && good.shots.length > 1) {
    // (every shot made 5% harder - one alone sometimes ends the same, and the check passed it: a flaky test, 11-11)
    for (const s of bad.shots) if (s.V) s.V *= 1.05;
    const r1 = v.match({ req: req(), kind: 'cpu', log: good }), r2 = v.match({ req: req(), kind: 'cpu', log: bad });
    ok(r1.pending && r2.pending && v.me().coin === 0 && v.me().checking === 2, 'queued, nothing paid yet');
    let n = 0; while (v.work(150) && n < 100000) { n++; if (n % 40 === 0) v.job = null; }      // (now and then forgetting the replay in hand, as a restart would)
    const want = E.matchCoins('cpu', 'eight', good.points, good.winner === 0);
    ok(v.me().coin === want && v.me().checking === 0, `paid after checking in ${n} slices: ${v.me().coin} (want ${want})`);
    ok(!!v.get('caught'), 'the doctored match marks the account');
    for (let k = 0; k < 6; k++) v.match({ req: req(), kind: 'cpu', log: uncheckedLog(k) });
    ok(v.me().checking === 6, 'a caught account has every match checked');
    const u = vault({ CHECK_MATCHES: 'slices' }); u.init('h'); let queued = 0;
    const random = Math.random;
    try { for (let k = 0; k < 40; k++) { Math.random = () => k % 4 === 0 ? 0.1 : 0.99; if (u.match({ req: req(), kind: 'cpu', log: uncheckedLog(k, [3, 1]) }).pending) queued++; } } finally { Math.random = random; }
    // (CHECK_SHARE: a share on the free plan, every match on the paid one - owner 11-16)
    ok(E.ECONOMY.CHECK_SHARE >= 1 ? queued === 40 : queued >= 3 && queued < 30, `checked as CHECK_SHARE says (${queued} of 40, share ${E.ECONOMY.CHECK_SHARE})`);
    console.log(`sliced checking: ${n} slices for two matches, paid ${v.me().coin}; ${queued} of 40 ordinary matches picked for checking`);
  }
}
// A missing receipt, ownership write or payout must roll back the entire operation and remain retryable.
{
  const v = vault({ CHECK_MATCHES: 'false' }); v.init('h');
  const original = v.sql.exec.bind(v.sql), q = req(), log = uncheckedLog(100);
  v.sql.exec = (sql, ...args) => { if (sql.startsWith('INSERT INTO reqs')) throw new Error('receipt failed'); return original(sql, ...args); };
  let threw = false; try { v.match({ req: q, kind: 'cpu', log }); } catch (e) { threw = true; }
  v.sql.exec = original;
  ok(threw && v.me().coin === 0 && !v.sql.exec('SELECT * FROM match_claims').toArray().length, 'receipt failure rolls back payment and match identity');
  ok(v.match({ req: q, kind: 'cpu', log }).paid > 0, 'retry after receipt failure pays once');
  const balance = v.me().coin; v.match({ req: q, kind: 'cpu', log }); ok(v.me().coin === balance, 'same request remains idempotent');
  const it = E.CUES.find(c => c.rarity === 1), price = E.priceOf(it).coin; v.pay('test', price, 0);
  const before = v.me().coin, purchase = req();
  v.sql.exec = (sql, ...args) => { if (sql.startsWith('INSERT INTO owned')) throw new Error('ownership failed'); return original(sql, ...args); };
  threw = false; try { v.buy({ req: purchase, kind: 'cue', id: it.id }); } catch (e) { threw = true; }
  v.sql.exec = original;
  ok(threw && v.me().coin === before && !v.owns('cue', it.id), 'ownership failure rolls back coin debit');
  ok(v.buy({ req: purchase, kind: 'cue', id: it.id }).ok && v.me().coin === before - price, 'purchase retry succeeds once');
}
// Malformed new logs are rejected; corrupt rows from the old server cannot strand valid work behind them.
{
  const v = vault({ CHECK_MATCHES: 'slices' }); v.init('h');
  const malformed = uncheckedLog(200); malformed.shots[0] = null;
  ok(!v.match({ req: req(), kind: 'cpu', log: malformed }).ok && !v.me().checking, 'malformed log never enters queue');
  for (const log of ['{broken', JSON.stringify(malformed)]) v.sql.exec("INSERT INTO matches (at, kind, mode, log, status) VALUES (?, 'cpu', 'four', ?, 'checking')", Date.now(), log);
  const good = record('four', { target: 3, targets: [3, 3], tens: true });
  v.set('caught', 1); v.match({ req: req(), kind: 'cpu', log: good });
  let steps = 0; while (v.work(150) && steps++ < 100000) {}
  ok(!v.me().checking && v.me().coin === E.matchCoins('cpu', 'four', good.points, good.winner === 0), 'corrupt rows rejected, next valid match paid');
  ok(v.sql.exec("SELECT * FROM matches WHERE status = 'rejected'").toArray().length === 2, 'corrupt rows retired');
  const retry = vault({ CHECK_MATCHES: 'slices' }); retry.init('h');
  retry.match({ req: req(), kind: 'friend', log: good });
  const pay = retry.pay.bind(retry); retry.pay = () => { throw new Error('temporary payout failure'); };
  let threw = false; try { retry.work(Infinity); } catch (e) { threw = true; }
  ok(threw && retry.me().coin === 0 && retry.me().checking === 1, 'alarm payout failure leaves match queued and wallet unchanged');
  retry.pay = pay; retry.work(Infinity); retry.work(Infinity);
  ok(retry.me().checking === 0 && retry.me().coin === E.matchCoins('friend', 'four', good.points, good.winner === 0), 'alarm retry pays once');
  const clone = structuredClone(good); clone.points = [99, 99]; clone.winner = 1 - good.winner; clone.extra = 'ignored';
  clone.shots[0].s.balls[0][5] = [0, 0, 1, 0];
  ok(matchKey(clone) === matchKey(good), 'presentation fields and claimed outcome cannot change match identity');
  ok(logError({ ...good, mode: 'toString' }) && logError({ ...good, shots: [null] }), 'unknown mode and null shots rejected');
  // 4구 with a friend: 마이너스 점수 off and 후구 are rules of their own; only 후구 can end in a draw (no winner)
  const hugu = { ...good, opts: { ...good.opts, hugu: true } }, noMinus = { ...good, opts: { ...good.opts, minus: false } };
  ok(!logError(hugu) && !logError(noMinus) && logError({ ...good, opts: { ...good.opts, hugu: 'yes' } }), '4구 rule switches checked');
  ok(new Set([matchKey(good), matchKey(hugu), matchKey(noMinus)]).size === 3, '4구 rule switches make games of their own');
  ok(!logError({ ...hugu, winner: null }) && logError({ ...good, winner: null }), 'a draw only with 후구');
  // 스누커: its 22 balls are a shot's right shape (a ranked room took its first shot for a forged one - QA 11-20 R01)
  { const snap = { cue: 0, balls: Array.from({ length: 22 }, () => [0, 0, 1, 0, 0, [0, 0, 0, 1]]) };
    ok(!logError({ ...good, mode: 'snooker', opts: {}, shots: [{ aim: 0.1, V: 2, a: 0, b: 0, el: 0, s: snap }] }) && logError({ ...good, mode: 'snooker', opts: {}, shots: [{ aim: 0.1, V: 2, a: 0, b: 0, el: 0, s: { cue: 0, balls: snap.balls.slice(0, 16) } }] }), '스누커 shots: 22 balls'); }
  console.log('reward regressions: receipts, duplicate matches, corrupt queue and terminal checkpoints checked');
}
// ranked: the lobby pairs by DAMA (the range widening with the wait), and after a while seats a stand-in
{
  let t = 0; const L = new LobbyCore('eight', () => t, () => 20000);
  ok(L.ask({ acct: 'a', dama: 30, name: 'A', icon: 1 }).waiting, 'lobby: one alone waits');
  const b = L.ask({ acct: 'b', dama: 32, name: 'B', icon: 2 }); ok(b.room && b.seat === 0 && b.opp.name === 'A', 'lobby: two close in DAMA are paired at once');
  const a = L.ask({ acct: 'a', dama: 30, name: 'A', icon: 1 }); ok(a.room === b.room && a.seat === 1 && a.token !== b.token && a.seed === b.seed, 'lobby: the other hears the same room, its own seat');
  ok(L.ask({ acct: 'c', dama: 460, name: 'C' }).waiting && L.ask({ acct: 'd', dama: 660, name: 'D' }).waiting, 'lobby: far apart, they wait');
  // (11-16: the devices played the base rules while the room replayed the tier's - every ranked game ended 무효)
  { const T = E.ECONOMY.TIER_AT, F = new LobbyCore('four', () => 0, () => 20000); F.ask({ acct: 'p', dama: T[4] + 1, name: 'P' }); const y = F.ask({ acct: 'q', dama: T[4] + 3, name: 'Q' });
    const { sql, tx } = sqlOf(), R = new RoomCore(sql, () => {}, tx); R.init(F.lastInit);
    ok(y.rules && y.rules.target === 7 && y.rules.finish === 'three' && y.rules.ot && JSON.stringify(y.rules) === JSON.stringify(R.get('room').rules), `lobby: the devices are told the room's own rules (${JSON.stringify(y.rules)})`); }
  t = 5000; L.ask({ acct: 'c', dama: 460 }); t = 10000; L.ask({ acct: 'c', dama: 460 }); L.ask({ acct: 'd', dama: 660 }); t = 14000; L.ask({ acct: 'c', dama: 460 });
  t = 16000; ok(L.ask({ acct: 'd', dama: 660 }).waiting, 'lobby: 200 apart is still too far after 16 s');
  L.ask({ acct: 'c', dama: 460 }); t = 20000; L.ask({ acct: 'd', dama: 660 });
  t = 20500; const c = L.ask({ acct: 'c', dama: 460 }); ok(c.room && c.standIn && c.standIn.name && c.opp.name === c.standIn.name, 'lobby: a stand-in after waiting long');
  ok(c.standIn.version === 3 && c.standIn.dama === c.opp.dama && c.standIn.skill > 0.1 && c.standIn.skill < 0.25, 'lobby: the stand-in carries the displayed rating and its v3 ability');
  t = 40000; ok(L.ask({ acct: 'e', dama: 30 }).waiting && !L.wait.has('d'), 'lobby: one not heard from has left');
  // each player's own wait before a stand-in (standInDelay): 30% 10-20 s, 50% 20-30 s, 20% 30-60 s
  { const n = 20000, ds = []; let s = 7; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let i = 0; i < n; i++) ds.push(standInDelay(rnd));
    const share = (a, b) => ds.filter(d => d >= a && d < b).length / n;
    ok(ds.every(d => d >= 10000 && d <= 60000), 'stand-in wait: always 10-60 s');
    ok(Math.abs(share(10000, 20000) - 0.3) < 0.02 && Math.abs(share(20000, 30000) - 0.5) < 0.02 && Math.abs(share(30000, 60001) - 0.2) < 0.02,
      `stand-in wait: 30 / 50 / 20% (${[share(10000, 20000), share(20000, 30000), share(30000, 60001)].map(x => (x * 100).toFixed(1)).join(' / ')})`);
    // a player asking every two seconds gets theirs at their own time, and one answer late by 10 s does not start it again
    let u = 0; const M = new LobbyCore('nine', () => u, () => 13000);
    for (; u < 13000; u += 2000) ok(M.ask({ acct: 'q', dama: 30, name: 'Q' }).waiting, 'stand-in wait: waits its own time');
    u = 23000; const got = M.ask({ acct: 'q', dama: 30, name: 'Q' });
    ok(got.room && got.standIn, 'stand-in wait: there at its time, a slow answer between'); }
  // what each has on reaches the other; a stand-in dresses too
  { const G = new LobbyCore('nine', () => 0); G.ask({ acct: 'g', dama: 30, name: 'G', gear: { cue: 'rose', ball: null, table: 'pool', trail: 'fire' } });
    const h = G.ask({ acct: 'h', dama: 30, name: 'H', gear: { cue: null, ball: 'disco', table: null, trail: null } });
    ok(h.opp.gear && h.opp.gear.cue === 'rose' && h.opp.gear.table === 'pool', 'lobby: the other player\'s gear comes with the room');
    ok(G.lastInit.seats.every(q => q.gear), 'lobby: the room is told both players\' gear'); }
  ok(c.opp.gear && ['cue', 'ball', 'table', 'trail'].every(k => k in c.opp.gear), 'lobby: a stand-in has gear on');
  // (11-21: the player card's face and title come with the gear - a stand-in wears known ones, or none)
  ok(['card', 'title'].every(k => k in c.opp.gear && (c.opp.gear[k] === null || (k === 'card' ? E.CARD_BGS : E.TITLES).some(q => q.id === c.opp.gear[k]))), 'lobby: a stand-in has a card face and title (known ones, or none)');
  console.log('ranked lobby: checked');
}
// ranked: a room - shots passed on and kept, the game played again, and the replay (not the devices) decides
{
  const H2 = E.createHighlights();
  // a ranked game the way two devices play it: the room's seed for the rack (and the 4구 roll-out), each shot by its seat
  function rankedGame(mode, seed, first) {
    const g = E.createGame(E.physicsFor(E.createPhysics, 'bar'), E.createAI);
    g.start(mode, ['A', 'B'], false, Object.assign({ rnd: E.seededRandom(seed), first, level: 2 }, E.rankedRules(mode, [30, 40]))   /* (the room's seats: 30 and 40 - roomOf) */); g.players[0].ai = g.players[1].ai = true; g.level = 2;
    if (mode === 'four') { g.rollOut(E.seededRandom((seed ^ 0x5bd1e995) >>> 0)); g.P.run(g.world, 40); g.world.ev = g.P.newEv(); }
    const msgs = [];
    while (!g.over && msgs.length < 300) {
      const p = g.aiPlan(), w = g.world;
      if (p.pos && g.placing) { const c = g.cueBall(); g.P.place(w, c.id, p.pos[0], p.pos[1]); }
      msgs.push({ seat: g.turn, m: { t: 'shot', n: msgs.length, shot: { s: JSON.parse(JSON.stringify(H2.snapshot(w))), aim: p.angle, V: p.V, a: p.a || 0, b: p.b || 0, el: p.el || 0, inHand: !!g.placing } } });
      g.beginShot(); g.P.strike(w, p.angle, p.V, p.a || 0, p.b || 0, p.el || 0); g.P.run(w, 40); g.resolve();
    }
    return { msgs, winner: g.over ? g.over.winner : null };
  }
  const roomOf = (mode, seed, first, standIn) => {
    const { sql, tx } = sqlOf(), sent = [[], []], R = new RoomCore(sql, (s, m) => (sent[s] || (sent[s] = [])).push(m), tx);
    R.init({ room: 'f'.repeat(32), mode, seed, first, standIn: standIn || null, seats: [{ acct: 'a'.repeat(32), token: 't0', name: 'A', icon: 0, dama: 30 }, { acct: standIn ? null : 'b'.repeat(32), token: 't1', name: 'B', icon: 1, dama: 40 }] });
    return { R, sent };
  };
  const finish = R => { let k = 0; while (R.work(500) && k < 100000) k++; return R.get('result'); };
  // quick emotes: a known one passes to the other seat, an unknown one and one too soon after the last do not
  { const { R, sent } = roomOf('four', 7, 0);
    R.message(0, { t: 'emote', id: 'poop' }); R.message(0, { t: 'emote', id: 'joy' }); R.message(1, { t: 'emote', id: '<b>hi</b>' });
    const got = sent[1].filter(m => m.t === 'emote');
    ok(got.length === 1 && got[0].id === 'poop' && got[0].seat === 0 && !sent[0].some(m => m.t === 'emote'), 'emote: one known, passed on once'); }
  // Only a real stand-in room accepts a resignation for its synthetic seat. A human cannot resign the opponent.
  // (a stand-in's resignation, sent by the human's device, is held to the game: at the start it is nowhere near behind,
  // so the device that sent it loses - see the farBehind checks below for one that holds)
  for (const [standIn, sender, as, loser, why] of [[null, 0, 1, 0], [null, 1, 0, 1], [{ name: 'S' }, 0, 1, 0, 'a resign that does not fit'], [{ name: 'S' }, 0, undefined, 0], [{ name: 'S' }, 1, 0, 1]]) {
    const { R } = roomOf('four', 7, 0, standIn);
    ok(R.message(sender, { t: 'resign', as }) === 'check', 'resign: server starts replay');
    const result = finish(R);
    ok(result.winner === 1 - loser && result.why === (why || 'resigned'), `resign: correct seat loses, including a stand-in (${result.why})`);
    ok(R.payouts().length === (standIn ? 1 : 2), 'resign: only real accounts are paid');
  }
  // when a stand-in may give up: its turn, far behind, late enough (game.js farBehind - the rule its own play follows)
  { const G = E.createGame(E.physicsFor(E.createPhysics, 'bar'), E.createAI); G.start('four', ['A', 'B'], false, { target: 5, first: 1, rnd: E.seededRandom(3) });
    G.turn = 1; Object.assign(G.players[0], { score: 4, shots: 6 }); Object.assign(G.players[1], { score: 0, shots: 5 });
    ok(standInMayResign(G), 'stand-in resign: allowed 0:4 of 5, late, on its turn');
    G.turn = 0; ok(!standInMayResign(G), 'stand-in resign: not on the other player\'s turn'); G.turn = 1;
    G.players[1].score = 2; ok(!standInMayResign(G), 'stand-in resign: not when it is close');
    G.players[1].score = 0; G.players[1].shots = 2; ok(!standInMayResign(G), 'stand-in resign: not this early'); }
  // New stroke families go through the same room log/replay as real ranked shots, including rotation and raised cues.
  for (const mode of ['eight', 'nine', 'four', 'three']) {
    const seed = 511, person = E.createAI(null).rankedPersonaFor(2000, E.seededRandom(41), { style: 'spinner' }), rules = E.rankedRules(mode, [30, 40]);
    const G = E.createGame(E.physicsFor(E.createPhysics, 'bar'), E.createAI), { R } = roomOf(mode, seed, 1, person);
    G.start(mode, ['A', 'B'], true, { ...rules, first: 1, rnd: E.seededRandom(seed), personas: [person, person] });
    G.aiRnd = E.seededRandom(seed ^ 0x2545f491);
    if (mode === 'four') { G.rollOut(E.seededRandom((seed ^ 0x5bd1e995) >>> 0)); G.P.run(G.world, 40); G.world.ev = G.P.newEv(); }
    let spun = false;
    for (let n = 0; n < 8 && !G.over; n++) {
      const who = G.turn, shot = G.aiPlan(), hand = !!G.placing;
      if (shot.pos) G.P.place(G.world, G.world.cue, ...shot.pos);
      if (shot.humanState) { if (!G.humanStates) G.humanStates = [null, null]; G.humanStates[who] = shot.humanState; }
      spun = spun || Math.hypot(shot.a, shot.b) > 0.1;
      R.message(0, { t: 'shot', n, as: who, shot: { s: JSON.parse(JSON.stringify(H2.snapshot(G.world))), aim: shot.angle, V: shot.V, a: shot.a, b: shot.b, el: shot.el, inHand: hand } });
      G.beginShot(); G.P.strike(G.world, shot.angle, shot.V, shot.a, shot.b, shot.el); G.P.run(G.world, 40); G.resolve();
    }
    R.message(0, { t: 'resign', as: 1 }); const res = finish(R);
    ok(spun, `human ${mode}: actual nonzero spin was recorded`);
    ok(res && res.why !== 'a shot that does not fit', `human ${mode}: new plans pass ranked replay`);
  }
  // 2:2 through the room: seats 0-3 shoot the sides' visits in turn (A1 B1 A2 B2), the host's device sends the computer's
  // shots 'as' its seat, the replay checks who shot and names the winning side; a shot from the wrong seat loses its side
  for (const mode of ['four', 'eight']) {
    const seed = 99, G = E.createGame(E.physicsFor(E.createPhysics, 'bar'), E.createAI), rules = E.inviteRules(mode, {});
    G.start(mode, ['A', 'B'], true, Object.assign({ rnd: E.seededRandom(seed), first: 0, team: true, level: 2 }, rules));
    if (mode === 'four') { G.rollOut(E.seededRandom((seed ^ 0x5bd1e995) >>> 0)); G.P.run(G.world, 40); G.world.ev = G.P.newEv(); }
    const { sql, tx } = sqlOf(), sent = {}, R = new RoomCore(sql, (s2, m) => (sent[s2] || (sent[s2] = [])).push(m), tx);
    R.init({ room: 'd'.repeat(32), mode, seed, first: 0, kind: 'invite', rules: {}, seats: [{ acct: 'a'.repeat(32), token: 't0', name: 'A1', dama: 1 }, { acct: 'b'.repeat(32), token: 't1', name: 'B1', dama: 1 },
      { acct: 'c'.repeat(32), token: 't2', name: 'A2', dama: 1 }, { acct: null, bot: true, level: 2, token: 't3', name: '컴퓨터' }] });
    const who = [];
    for (let n = 0; n < 150 && !G.over; n++) {
      const seat = G.shooter(), p = G.aiPlan(), w = G.world; who.push(seat);
      if (p.pos && G.placing) G.P.place(w, w.cue, p.pos[0], p.pos[1]);
      const msg = { t: 'shot', n, shot: { s: JSON.parse(JSON.stringify(H2.snapshot(w))), aim: p.angle, V: p.V, a: p.a || 0, b: p.b || 0, el: p.el || 0, inHand: !!G.placing } };
      if (seat === 3) R.message(0, Object.assign(msg, { as: 3 })); else R.message(seat, msg);
      G.beginShot(); G.P.strike(w, p.angle, p.V, p.a || 0, p.b || 0, p.el || 0); G.P.run(w, 40); G.resolve();
    }
    if (!G.over) { console.log(`2:2 ${mode}: did not finish (skipped)`); continue; }
    ok((who.every(x => x === 2) || (sent[2] || []).some(m => m.t === 'shot')) && (sent.w || []).some(m => m.t === 'shot'), `2:2 ${mode}: the seats take their turns, and every other seat hears each shot (${who.join('')} ${(sent[2] || []).length} ${(sent.w || []).length})`);
    [0, 1, 2].forEach(s2 => R.message(s2, { t: 'end' })); const res = finish(R);
    ok(res && res.winner === G.over.winner && res.why === 'ended' && res.coins.length === 4 && res.coins[3] === 0, `2:2 ${mode}: the replay names the winning side (${res && res.why} ${res && res.winner} vs ${G.over.winner} ${JSON.stringify(res && res.coins)})`);
    ok(R.payouts().length === 3 && R.payouts().every(q => q.body.won === (q.seat % 2 === G.over.winner)), `2:2 ${mode}: the three people are paid by their side`);
  }
  { const { sql, tx } = sqlOf(), R = new RoomCore(sql, () => {}, tx);
    R.init({ room: 'c'.repeat(32), mode: 'four', seed: 7, first: 0, kind: 'invite', rules: { target: 3 }, seats: [0, 1, 2, 3].map(i => ({ acct: String(i).repeat(32), token: 't' + i, name: 'P' + i, dama: 1 })) });
    const G = E.createGame(E.physicsFor(E.createPhysics, 'bar')); G.start('four', ['A', 'B'], false, { rnd: E.seededRandom(7), first: 0, team: true, target: 3 });
    G.rollOut(E.seededRandom((7 ^ 0x5bd1e995) >>> 0)); G.P.run(G.world, 40);
    // (seat 2 shooting the first visit, which is seat 0's)
    R.message(2, { t: 'shot', n: 0, shot: { s: JSON.parse(JSON.stringify(H2.snapshot(G.world))), aim: 0.3, V: 2, a: 0, b: 0, el: 0, inHand: false } });
    R.message(1, { t: 'resign' }); const res = finish(R);
    ok(res.winner === 1 && res.why === 'a shot that does not fit', `2:2: a shot from a seat whose turn it is not loses that side (${res.why})`); }
  for (const mode of ['eight', 'four']) {
    const seed = 4242, first = 1, G = rankedGame(mode, seed, first);
    if (G.winner == null) { console.log(`ranked ${mode}: the computers did not finish (skipped)`); continue; }
    const { R, sent } = roomOf(mode, seed, first);
    for (const x of G.msgs) R.message(x.seat, x.m);
    ok(sent[1 - G.msgs[0].seat].some(m => m.t === 'shot' && m.n === 0), `ranked ${mode}: a shot is passed to the other seat`);
    ok(R.message(0, { t: 'end' }) === null && R.message(1, { t: 'end' }) === 'check', `ranked ${mode}: both saying it ended starts the check`);
    const res = finish(R);
    ok(res && res.winner === G.winner && res.why === 'ended', `ranked ${mode}: the replay names the winner (${res && res.why})`);
    ok(res.coins[G.winner] > 0 && res.dama[G.winner] > [30, 40][G.winner], `ranked ${mode}: the winner is paid and gains DAMA`);
    const pay = R.payouts(); ok(pay.length === 2 && pay[G.winner].body.won && pay[G.winner].body.coins === res.coins[G.winner], `ranked ${mode}: both vaults are told`);
    const v = vault(); v.init('h'); const before = v.me().dama;
    v.ranked(pay[0].body); v.ranked(pay[0].body);
    ok(v.me().dama === before + pay[0].body.dama && v.me().coin === pay[0].body.coins, `ranked ${mode}: a vault takes a room's result once`);
    // a seat that moves a ball before its shot is caught by the replay, and loses
    if (G.msgs.length > 2) {
      const { R: R2 } = roomOf(mode, seed, first), j = G.msgs.findIndex((x, i) => i > 0 && x.seat === 1);
      if (j > 0) {
        G.msgs.forEach((x, i) => { const m = JSON.parse(JSON.stringify(x.m)); if (i === j) { const bs = m.shot.s.balls, b = bs.findIndex((q, k) => q[2] && k !== m.shot.s.cue); bs[b][0] += 0.02; } R2.message(x.seat, m); });
        R2.message(0, { t: 'end' }); R2.message(1, { t: 'end' }); const r2 = finish(R2);
        ok(r2.winner === 0 && r2.why === 'a shot that does not fit', `ranked ${mode}: a moved ball loses the game for the seat that sent it`);
      }
    }
  }
  // the room replaying as the game is played (RoomCore.ahead, owner 11-22: results came late): the same result as the
  // check from the start, and at the end little is left to play; a moved ball is still caught; a resignation mid-game
  // still decided from the replay; no endless work on a log that ends in a timeout
  for (const mode of ['eight', 'four']) {
    const seed = 4242, first = 1, G = rankedGame(mode, seed, first); if (G.winner == null) continue;
    const keep = (R, k = 0) => { while (R.ahead(150) && k < 100000) k++; return k; };
    const { R } = roomOf(mode, seed, first); let during = 0;
    for (const x of G.msgs) { R.message(x.seat, x.m); during += keep(R); }
    R.message(0, { t: 'end' }); R.message(1, { t: 'end' });
    let left = 0; while (R.work(150) && left < 100000) left++;
    const res = R.get('result'), { R: R0 } = roomOf(mode, seed, first); for (const x of G.msgs) R0.message(x.seat, x.m); R0.message(0, { t: 'end' }); R0.message(1, { t: 'end' });
    let all = 0; while (R0.work(150) && all < 100000) all++; const res0 = R0.get('result');
    ok(res && res.winner === G.winner && JSON.stringify(res) === JSON.stringify(res0), `ranked ${mode}, replayed during play: the same result as replayed at the end (${res && res.why})`);
    ok(left <= 2 && all > left && during > 0, `ranked ${mode}, replayed during play: little left at the end (${left} slices, against ${all})`);
    if (G.msgs.length > 2) {
      const { R: R2 } = roomOf(mode, seed, first), j = G.msgs.findIndex((x, i) => i > 0 && x.seat === 1);
      if (j > 0) {
        G.msgs.forEach((x, i) => { const m = JSON.parse(JSON.stringify(x.m)); if (i === j) { const bs = m.shot.s.balls, b = bs.findIndex((q, k) => q[2] && k !== m.shot.s.cue); bs[b][0] += 0.02; } R2.message(x.seat, m); keep(R2); });
        ok(R2.get('aheadBad', false) && R2.ahead(150) === false, `ranked ${mode}, replayed during play: stops at a shot that does not fit`);
        R2.message(0, { t: 'end' }); R2.message(1, { t: 'end' }); const r2 = finish(R2);
        ok(r2.winner === 0 && r2.why === 'a shot that does not fit', `ranked ${mode}, replayed during play: a moved ball still loses the game for the seat that sent it`);
      }
      const { R: R3 } = roomOf(mode, seed, first), half = G.msgs.slice(0, Math.max(1, G.msgs.length >> 1));
      for (const x of half) { R3.message(x.seat, x.m); keep(R3); }
      R3.message(0, { t: 'timeout', n: half.length }); ok(keep(R3) < 3 && R3.ahead(150) === false, `ranked ${mode}, replayed during play: a timeout at the end does not keep it busy`);
    }
  }
  // a seat that shoots out of turn loses; one that leaves and does not come back loses
  { const G = rankedGame('eight', 7, 0), { R } = roomOf('eight', 7, 0); R.message(G.msgs[0].seat, G.msgs[0].m); const m = JSON.parse(JSON.stringify(G.msgs[1] || G.msgs[0])); m.m.n = 1; R.message(G.msgs[0].seat, m.m); R.message(0, { t: 'resign' });
    const r = finish(R); ok(r.winner === 1 - G.msgs[0].seat, 'ranked: a shot out of turn loses'); }
  { const { R, sent } = roomOf('nine', 9, 0); ok(R.disconnected(1) && sent[0].some(m => m.t === 'away'), 'ranked: the other seat hears one has gone');
    const gone = R.get('gone'); gone[1] = Date.now() - RETURN_WITHIN - 1; R.set('gone', gone); ok(R.timers() === 'check', 'ranked: gone too long ends it');
    const r = finish(R); ok(r.winner === 0 && r.why === 'left', 'ranked: one who left loses'); }
  // a stand-in: its shots come from seat 0's device; DAMA moves as in any game; only the player's vault is told
  { const G = rankedGame('eight', 11, 0), { R } = roomOf('eight', 11, 0, { name: 'S', icon: 0, dama: 40, level: 2 });
    for (const x of G.msgs) R.message(0, Object.assign({}, x.m, { as: x.seat }));
    R.message(0, { t: 'end' }); const r = finish(R);
    if (G.winner != null) { const full = E.damaAfter(30, 40, G.winner === 0)[0] - 30;
      ok(r.winner === G.winner && r.dama[0] - 30 === full && R.payouts().length === 1, `ranked: a stand-in game counts like any (${r.why})`); } }
  // Codex B11-B15: what a seat sends is held to the game
  { const G = rankedGame('eight', 7, 0), s0 = G.msgs[0].seat, play = (R, msgs) => { for (const x of msgs) R.message(x.seat, x.m); };
    const sendWith = (change, by) => { const { R, sent } = roomOf('eight', 7, 0); const m = JSON.parse(JSON.stringify(G.msgs[0].m)); change(m.shot); R.message(by == null ? s0 : by, m); return { R, sent }; };
    // B11: a seat cannot run out the other's clock
    { const { R } = roomOf('eight', 7, 0); R.message(1 - s0, { t: 'timeout', n: 0 }); R.message(s0, { t: 'resign' });
      const r = finish(R); ok(r.winner === s0 && r.why === 'a shot that does not fit', `B11: a timeout sent on the other's turn loses (${r.why})`); }
    { const { R } = roomOf('eight', 7, 0); R.message(s0, { t: 'timeout', n: 0 }); R.message(s0, { t: 'resign' });
      const r = finish(R); ok(r.winner === 1 - s0 && r.why === 'resigned', `B11: a seat's own timeout stands (${r.why})`); }
    // B12: the cue ball is the game's; one in hand goes on the cloth, clear, behind the head string on a break
    { const { R } = sendWith(sh => { sh.s.cue = 1; }); R.message(1 - s0, { t: 'resign' }); const r = finish(R);
      ok(r.winner === 1 - s0 && r.why === 'a shot that does not fit', `B12: another ball as the cue ball loses (${r.why})`); }
    for (const [x, y, what] of [[100, 0, 'off the table'], [0.2, 0, 'past the head string'], [null, null, 'on a ball']]) {
      const { R } = sendWith(sh => { const c = sh.s.balls[0]; if (x == null) { const o = sh.s.balls.find((b, k) => k && b[2]); c[0] = o[0]; c[1] = o[1]; } else { c[0] = x; c[1] = y; } });
      R.message(1 - s0, { t: 'resign' }); const r = finish(R);
      ok(r.winner === 1 - s0 && r.why === 'a shot that does not fit', `B12: a break's cue ball ${what} loses (${r.why})`);
    }
    { const { R } = sendWith(sh => { sh.s.balls[0][0] = -0.7; sh.s.balls[0][1] = 0.2; }); R.message(1 - s0, { t: 'resign' }); const r = finish(R);
      ok(r.why === 'resigned', `B12: a break's cue ball anywhere fair behind the string stands (${r.why})`); }
    // B13: a shot not of the right shape is not passed on, and the seat that sent it loses
    { const { R, sent } = roomOf('eight', 7, 0); ok(R.message(s0, { t: 'shot', n: 0, shot: { aim: 0, V: 2 } }) === 'check', 'B13: a bad shot ends the game at once');
      ok(!sent[1 - s0].some(m => m.t === 'shot'), 'B13: a bad shot is not passed on'); const r = finish(R);
      ok(r.winner === 1 - s0 && r.why === 'a shot that does not fit', `B13: the seat that sent a bad shot loses (${r.why})`); }
    { const { R, sent } = roomOf('eight', 7, 0); const m = JSON.parse(JSON.stringify(G.msgs[0].m)); m.shot.junk = 'x'.repeat(100); R.message(s0, m);
      const got = sent[1 - s0].find(q => q.t === 'shot'); ok(got && !('junk' in got.shot) && got.shot.by === s0, 'B13: only a shot\'s own fields are passed on, with who sent it'); }
    { const { R } = roomOf('eight', 11, 0, { name: 'S' }); const m = JSON.parse(JSON.stringify(G.msgs[0].m)); m.shot.s.cue = 1; R.message(0, Object.assign(m, { as: 0 }));
      R.message(0, { t: 'resign', as: 1 }); const r = finish(R); ok(r.winner === 1, `B13: a stand-in game's bad shot is its player's device's (${r.why})`); }
    // B14: no harder than the seat's cue at full gauge (a break: the break's own extra counts)
    const vTop = (cue, brk) => { const g = E.createGame(E.physicsFor(E.createPhysics, 'bar')); g.start('eight', ['A', 'B'], false, { rnd: E.seededRandom(7) }); g.isBreak = brk; const c = E.CUES.find(q => q.id === cue); return g.vOf(1) * (1 + ((c && c.stat.power) || 0) / 100); };
    const gearRoom = cue => { const { sql, tx } = sqlOf(), R = new RoomCore(sql, () => {}, tx);
      R.init({ room: 'f'.repeat(32), mode: 'eight', seed: 7, first: 0, seats: [0, 1].map(s => ({ acct: String(s).repeat(32), token: 't' + s, name: 'P' + s, icon: 0, dama: 30, gear: { cue } })) }); return R; };
    for (const [cue, V, fits] of [[null, vTop(null, true), true], ['breaker', vTop('breaker', true), true], [null, vTop('breaker', true), false], ['saber', vTop('saber', true) * 1.001, false]]) {
      const R = gearRoom(cue), m = JSON.parse(JSON.stringify(G.msgs[0].m)); m.shot.V = V; R.message(s0, m); R.message(1 - s0, { t: 'resign' }); const r = finish(R);
      ok((r.why === 'resigned') === fits, `B14: a break at ${V.toFixed(3)} m/s with ${cue || 'the usual cue'} ${fits ? 'stands' : 'loses'} (${r.why})`);
    }
    // B16 (5.0): no further from the cue ball's centre than any cue strikes (a cue with no strike limit, or the computer)
    for (const [a, fits] of [[0.78, true], [0.9, false]]) {
      const R = gearRoom(null), m = JSON.parse(JSON.stringify(G.msgs[0].m)); m.shot.a = a; m.shot.b = 0; R.message(s0, m); R.message(1 - s0, { t: 'resign' }); const r = finish(R);
      ok((r.why === 'resigned') === fits, `B16: a strike ${a} of the radius out ${fits ? 'stands' : 'loses'} (${r.why})`);
    }
    // B15: nothing from either for IDLE_AFTER while both are there - the seat whose turn it was loses
    { const { R } = roomOf('eight', 7, 0); R.connected(0); R.connected(1); play(R, G.msgs.slice(0, 1)); ok(R.timers() === null && R.idleIn() > IDLE_AFTER - 1000, 'B15: a turn just begun is not quiet');
      R.set('turnAt', Date.now() - IDLE_AFTER - 1); ok(R.timers() === 'check', 'B15: a turn gone quiet ends the game');
      const turn = (() => { const g = E.createGame(E.physicsFor(E.createPhysics, 'bar')); const rp = new Replay(R.log(), null, true); rp.advance(Infinity); return rp.g.turn; })();
      const r = finish(R); ok(r.winner === 1 - turn && r.why === 'idle', `B15: whose turn went quiet loses (${r.why})`); }
    { const { R } = roomOf('eight', 7, 0); R.connected(0); R.connected(1); R.disconnected(1); R.set('turnAt', Date.now() - IDLE_AFTER - 1);
      ok(R.idleIn() === null && R.timers() === null, 'B15: a seat away is the away rule\'s (RETURN_WITHIN), not the quiet turn\'s'); }
  }
  console.log('ranked rooms: checked');
  // 증강 당구's room: the table's vote, the steps after it, the game played again for the winner, no DAMA
  {
    const A = E.ARCADE, initArc = standIn => { const { sql, tx } = sqlOf(), sent = [[], []], R = new RoomCore(sql, (s, m) => (sent[s] || (sent[s] = [])).push(m), tx);
      R.init({ room: 'e'.repeat(32), mode: 'arcade', kind: 'arcade', seed: 77, first: 0, standIn: standIn || null, seats: [{ acct: 'a'.repeat(32), token: 't0', name: 'A', icon: 0, dama: 30 }, { acct: standIn ? null : 'b'.repeat(32), token: 't1', name: 'B', icon: 1, dama: 40 }] });
      return { R, sent }; };
    { const { R, sent } = initArc(); R.connected(0); R.connected(1);
      ok(R.arcIn() > A.VOTE_MS, 'arcade: the vote\'s clock runs once both are in');
      const G = rankedGame('arcade', 77, 0);
      R.message(G.msgs[0].seat, G.msgs[0].m); ok(R.count() === 0, 'arcade: no shot before the table is chosen');
      R.message(0, { t: 'card', step: 0, id: 'circle' }); R.message(0, { t: 'card', step: 0, id: 'penta' });
      ok(sent[1].some(m => m.t === 'carded' && m.seat === 0) && !sent[1].some(m => m.t === 'step'), 'arcade: a vote is heard as made, not what');
      R.message(1, { t: 'card', step: 0, id: 'penta' }); const sh = sent[0].find(m => m.t === 'step');
      ok(sh && ['circle', 'penta'].includes(sh.id) && sh.ids.join() === 'circle,penta' && sent[1].some(m => m.t === 'step' && m.id === sh.id), `arcade: two different votes, one of the two (${sh && sh.id})`);
      const d0 = A.cards(77, 1, 0), d1 = A.cards(77, 1, 1);
      R.message(0, { t: 'card', step: 2, id: A.cards(77, 2, 0)[0] }); ok(!R.get('arc').open, 'arcade: step 2 cannot come before step 1');
      const other = A.buffs.map(c => c.id).find(x => !d0.includes(x));
      R.message(0, { t: 'card', step: 1, id: other }); ok(!R.get('arc').open, 'arcade: a card not dealt to the seat is not taken');
      R.message(0, { t: 'card', step: 1, id: d0[1] }); ok(R.get('arc').open && sent[1].some(m => m.t === 'carded' && m.step === 1), 'arcade: the first card opens the step');
      R.message(1, { t: 'card', step: 1, id: d1[2] }); const pk = sent[0].find(m => m.t === 'step' && m.step === 1);
      ok(pk && pk.ids.join() === [d0[1], d1[2]].join() && pk.id == null && !R.get('arc').open, 'arcade: a pick - both hear the two');
      // a harder vote with one card missing closes on its clock: any of the three, and one card for both
      R.message(1, { t: 'card', step: 2, id: A.cards(77, 2, 1)[0] }); const a = R.get('arc'); a.open.by = Date.now() - 1; R.set('arc', a); R.timers();
      const p2 = sent[1].find(m => m.t === 'step' && m.step === 2); ok(p2 && A.cards(77, 2, 0).includes(p2.ids[0]) && p2.ids.includes(p2.id), 'arcade: a card not given in time is one of the three');
      for (const x of G.msgs) R.message(x.seat, x.m); R.message(0, { t: 'end' }); R.message(1, { t: 'end' });
      const r = finish(R); ok(G.winner != null && r.winner === G.winner && r.dama.join() === '30,40' && R.payouts().every(p => p.body.kind === 'arcade' && p.body.dama === 0), `arcade: the replay names the winner, no DAMA (${r.why})`); }
    { const { R, sent } = initArc({ name: 'S', icon: 0, dama: 40, level: 2 }); R.connected(0);
      ok(R.arcIn() != null, 'arcade: with a stand-in the vote starts when the player comes in');
      R.message(0, { t: 'card', step: 0, id: 'bumpy' }); ok(sent[0].some(m => m.t === 'step'), 'arcade: a stand-in\'s vote is the room\'s, there already');
      R.message(0, { t: 'card', step: 1, id: A.cards(77, 1, 0)[0] }); const pk = sent[0].find(m => m.t === 'step' && m.step === 1);
      ok(pk && A.cards(77, 1, 1).includes(pk.ids[1]), 'arcade: a stand-in picks one of its own three'); }
    { const { R } = initArc(); R.connected(0); R.connected(1); const a = R.get('arc'); a.open.by = Date.now() - 1; R.set('arc', a); R.timers();
      ok(A.shapes.some(c => c.id === R.get('arc').done[0].id), 'arcade: nobody voted in time - any of the three'); }
    console.log('arcade rooms: checked');
  }
  // the server's physics version is the engine's: a change to web/physics.js that moves PHYS_V there must move it here too
  ok(Number.isInteger(E.PHYS_V) && E.PHYS_V === PHYS_V, `physics version: engine ${E.PHYS_V}, server ${PHYS_V}`);
}

// a ranked game moves DAMA, an invite game does not; the break cue is not for sale
{
  const v = vault(); v.init('h');
  v.ranked({ room: '1'.repeat(32), mode: 'eight', won: true, coins: 10, dama: 3 }); v.ranked({ room: '3'.repeat(32), mode: 'eight', won: true, coins: 10, dama: 3, kind: 'invite' });
  ok(v.me().dama === E.ECONOMY.DAMA_START + 3 && v.me().drops === undefined, 'ranked: a win moves DAMA, an invite game none; no drops any more');
  // (owner 11-16: a rating for each family - 캐롬, 포켓, 스누커; a game moves its own; me().dama is the highest, the ticket the family's)
  { const w = vault(); w.init('h'); const S = E.ECONOMY.DAMA_START;
    w.ranked({ room: '5'.repeat(32), mode: 'four', won: true, coins: 0, dama: 40, rd: 200 }); w.ranked({ room: '6'.repeat(32), mode: 'snooker', won: false, coins: 0, dama: -20 });
    const d = w.me().damas;
    ok(d.carom === S + 40 && d.pocket === S && d.snooker === S - 20 && w.me().dama === S + 40 && w.me().rds.carom === 200, 'ranked: each family its own rating, the highest shown'); }
  // 승급전 (economy.js PROMO_*): crossing into 실버 stops just under it and opens the best of three; two wins reach it and shield it;
  // a series lost closes with nothing kept; a shielded loss keeps the floor
  { const w = vault(); w.init('h'); const T = E.ECONOMY.TIER_AT; let n = 10; const room = () => (n++).toString(16).padStart(32, '0');
    w.ranked({ room: room(), mode: 'eight', won: true, coins: 0, dama: T[1] - E.ECONOMY.DAMA_START + 30 });
    let m = w.me(); ok(m.damas.pocket === T[1] - 1 && m.promo.pocket && m.promo.pocket.to === 1, 'promo: opened just under the tier');
    w.ranked({ room: room(), mode: 'nine', won: false, coins: 0, dama: -10 }); w.ranked({ room: room(), mode: 'eight', won: true, coins: 0, dama: 10 });
    ok(w.me().promo.pocket.w === 1 && w.me().promo.pocket.l === 1 && w.me().damas.pocket <= T[1] - 1, 'promo: one each, still under');
    w.ranked({ room: room(), mode: 'eight', won: true, coins: 0, dama: 10 }); m = w.me();
    ok(!m.promo.pocket && m.damas.pocket >= T[1] && m.shield.pocket === E.ECONOMY.PROMO_SHIELD, 'promo: two wins - the tier, shielded');
    w.ranked({ room: room(), mode: 'eight', won: false, coins: 0, dama: -200 }); m = w.me();
    ok(m.damas.pocket === T[1] && m.shield.pocket === E.ECONOMY.PROMO_SHIELD - 1, 'shield: a loss under the floor keeps the floor');
    const v2 = vault(); v2.init('h'); v2.ranked({ room: room(), mode: 'four', won: true, coins: 0, dama: 400 }); v2.ranked({ room: room(), mode: 'four', won: false, coins: 0, dama: -5 }); v2.ranked({ room: room(), mode: 'three', won: false, coins: 0, dama: -5 });
    ok(!v2.me().promo.carom && v2.me().damas.carom < T[1] && v2.me().promoLast.what === 'failed', 'promo: two losses close it, nothing kept'); }
  ok(!v.buy({ req: req(), kind: 'cue', id: 'breaker' }).ok, 'the break cue is not for sale');
  console.log('ranked wins: checked');
}
// lessons: every 8볼 lesson done at its top level - each proof (seed, table, shot) played again - pays the coins and the
// break cue, once; a missing or doctored proof pays nothing
// signing up, the nickname, the tutorial's prize, the progress kept for other devices
{ const v = vault(); v.init('h'); const c0 = v.me().coin, d0 = v.me().dia;
  const j1 = v.joinPrize(), j2 = v.joinPrize();
  ok(j1.paid && j1.paid.coin === 1000 && j1.paid.dia === 10 && j2.paid === null && v.me().coin === c0 + 1000 && v.me().dia === d0 + 10 && v.me().joined, 'signup: its prize once');
  ok(!v.nick({ nick: 'a' }).ok && !v.nick({ nick: '열한글자넘는긴닉네임이다' }).ok && v.nick({ nick: '  당구   왕 ' }).ok && v.me().nick === '당구 왕', 'signup: a nickname of 2 to 10 characters, spaces closed up');
  const t1 = v.tutorial({ req: req() }), t2 = v.tutorial({ req: req() });
  ok(t1.paid === 500 && t1.item.id === 'maple' && v.owns('cue', 'maple') && t2.paid === 0 && v.me().tut, 'tutorial: its prize once (the maple cue)');
  ok(v.save({ data: { a: 1 } }).ok && v.me().save.a === 1 && !v.save({ data: { x: 'y'.repeat(17000) } }).ok, 'save: kept, not too big'); }
{ const v = vault(); v.init('h'); const r = v.lessons({ req: req(), vol: 'eight', proofs: {} });
  ok(!r.ok && v.me().coin === 0 && !v.owns('cue', 'breaker'), `lessons: nothing without every lesson done (${r.why})`);
  const D = E.createDrills(), ids = D.list.filter(d => d.make && d.vol === 'eight').map(d => d.id), proofs = {};
  for (const id of ids) {
    // as the app does it: a seed, the layout made from it at the top level, its reference shot struck
    const seed = 1234567 + id.length, g = E.createGame(E.physicsFor(E.createPhysics, 'club')); g.start('practice', ['A', ''], false, {});
    const L = D.make(id, g.P, D.LEVELS, E.seededRandom(seed), g.vOf);
    proofs[id] = { table: 'club', seed, shot: { aim: L.demo.angle, V: g.vOf(L.demo.power), a: L.demo.a, b: L.demo.b, el: 0 } };
  }
  const bad = JSON.parse(JSON.stringify(proofs)); bad[ids[0]].shot.aim += 0.3;
  ok(!v.lessons({ req: req(), vol: 'eight', proofs: bad }).ok && !v.owns('cue', 'breaker'), 'lessons: a shot that does not do it pays nothing');
  const q = req(), r1 = v.lessons({ req: q, vol: 'eight', proofs }), r2 = v.lessons({ req: req(), vol: 'eight', proofs });
  ok(r1.ok && r1.paid === E.ECONOMY.LESSON_PRIZE.eight.coin && v.owns('cue', 'breaker') && v.me().prizes.includes('eight') && r2.ok && r2.paid === 0 && v.me().coin === E.ECONOMY.LESSON_PRIZE.eight.coin,
    `lessons: every lesson done pays once, with the break cue (${r1.why || ''})`);
  console.log(`lessons: checked (${ids.length} for 8볼)`); }
// invites: a code, the friend joins, both get the same room; a stranger cannot take a taken code
{
  const I = new InviteCore(), host = { acct: 'h'.repeat(32), dama: 30, name: 'H', icon: 0, mode: 'three', rules: { target: 3, cushions: 1, junk: 9 } };
  const o = I.open(host); ok(o.ok && /^[A-Z2-9]{6}$/.test(o.code) && o.rules.target === 3 && o.rules.cushions === 1 && !('junk' in o.rules), 'invite: a code, with the host\'s rules kept to what the game offers');
  ok(I.ask(host.acct, o.code).waiting, 'invite: the host waits');
  ok(!I.join(host, o.code).ok, 'invite: not one\'s own code'); ok(!I.join({ acct: 'x'.repeat(32) }, 'ZZZZZZ').ok, 'invite: no such code');
  ok(I.peek(o.code).mode === 'three', 'invite: the code says its game');
  const G = { acct: 'g'.repeat(32), dama: 50, name: 'G', icon: 1 }, g0 = I.join(G, o.code), w0 = I.ask(host.acct, o.code);
  ok(g0.waiting && g0.seat === 1 && w0.waiting && w0.seats[1].name === 'G' && w0.seats[1].ready === false, 'invite: a friend takes the seat and waits - not started as they come (owner 11-10)');
  ok(I.start(host.acct, o.code).why === 'not ready' && !I.start(G.acct, o.code).ok, 'invite: only the host starts, and not before the friend is ready');
  ok(I.ready1(G.acct, o.code, true).seats[1].ready && I.ask(host.acct, o.code).seats[1].ready, 'invite: the host sees the friend ready');
  const h = I.start(host.acct, o.code), g = I.ask(G.acct, o.code);
  ok(h.ok && h.init && g.seat === 1 && h.seat === 0 && h.room === g.room && h.token !== g.token && g.opp.name === 'H' && h.opp.name === 'G', 'invite: the host starts; both in the same room');
  ok(!I.join({ acct: 'z'.repeat(32) }, o.code).ok, 'invite: a taken code');
  // the host sends a friend away: the seat is free again and they cannot take it back
  { const K = new InviteCore(), o4 = K.open(host), f = { acct: 'f'.repeat(32), dama: 1, name: 'F' };
    K.join(f, o4.code); ok(!K.kick(f.acct, o4.code, 1).ok && K.kick(host.acct, o4.code, 1).ok && !K.ask(host.acct, o4.code).seats[1], 'invite: the host sends a friend away');
    ok(K.join(f, o4.code).why === 'kicked' && K.ask(f.acct, o4.code).why === 'kicked' && K.join({ acct: 'e'.repeat(32), name: 'E' }, o4.code).waiting, 'invite: sent away, they cannot come back; another can'); }
  const { sql, tx } = sqlOf(), R = new RoomCore(sql, () => {}, tx); R.init(h.init);
  ok(R.state(0).kind === 'invite' && R.state(0).rules.target === 3 && R.log().opts.cushions === 1, 'invite: the room plays the host\'s rules');
  R.message(1, { t: 'resign' }); let k = 0; while (R.work(500) && k < 1000) k++;
  const res = R.get('result'), pay = R.payouts();
  ok(res.winner === 0 && res.dama[0] === 30 && res.dama[1] === 50 && pay.every(p => p.body.kind === 'invite' && p.body.dama === 0), 'invite: no DAMA moves');
  const o2 = I.open(host), o3 = I.open(Object.assign({}, host, { mode: 'eight' })); ok(o2.code === o3.code && I.peek(o3.code).mode === 'eight', 'invite: a host keeps one code, opened again with new rules');
  // the list of open rooms: only listed ones, never their codes; a password guards taking one from the list
  { const L = new InviteCore(), a = L.open({ acct: 'a'.repeat(32), dama: 500, name: 'A', mode: 'eight', listed: true }), b = L.open({ acct: 'b'.repeat(32), dama: 600, name: 'B', mode: 'four', listed: true, pw: '1234' });
    L.open({ acct: 'c'.repeat(32), dama: 700, name: 'C', mode: 'nine' });
    const ls = L.list().rooms; ok(ls.length === 2 && ls.every(r => /^[0-9a-f]{12}$/.test(r.id) && !('code' in r)) && ls.find(r => r.host.name === 'B').lock && !ls.find(r => r.host.name === 'A').lock, 'invite: the list has the listed rooms, by id, locked or not');
    const rb = ls.find(r => r.host.name === 'B'), ra = ls.find(r => r.host.name === 'A');
    ok(!L.byId(rb.id, '0000').ok && L.byId(rb.id, '0000').why === 'wrong password' && L.byId(rb.id, '1234').code === b.code && L.byId(ra.id).code === a.code, 'invite: a password guards a room taken from the list');
    for (let i = 0; i < 12; i++) L.byId(rb.id, 'x'); ok(L.byId(rb.id, '1234').why === 'locked', 'invite: too many wrong passwords close it to the list');
    L.join({ acct: 'g'.repeat(32), dama: 500, name: 'G' }, a.code); L.ready1('g'.repeat(32), a.code, true);
    const jr = L.start('a'.repeat(32), a.code), l2 = L.list().rooms, pa = l2.find(r => r.id === ra.id);
    ok(l2.length === 2 && pa.playing && pa.guest.name === 'G' && l2[l2.length - 1] === pa && L.byId(ra.id).why === 'playing', 'invite: a game being played stays in the list, last, as playing, not to be joined');
    // watching it: the room and the watchers' key, with the password where there is one; never while waiting
    const wa = L.watch(ra.id); ok(wa.ok && wa.room === jr.room && /^[0-9a-f]{32}$/.test(wa.watch) && L.watch(rb.id, '1234').why === 'not playing', 'invite: a game being played can be watched, a waiting room not');
    ok(L.ended(jr.room).ok && !L.list().rooms.some(r => r.id === ra.id) && L.watch(ra.id).why === 'no such room', 'invite: a game ended leaves the list');
    ok(ls.find(r => r.host.name === 'A').title === 'A의 방', 'invite: a room is named after its host unless named'); }
  // a host away (a hidden page cannot ask): off the list and not to be joined, but back within ten minutes, the same code
  { let t = 0; const L = new InviteCore(() => t), h = { acct: 'h'.repeat(32), dama: 500, name: 'H', mode: 'four', listed: true, title: '  한판 붙자 ' };
    const o = L.open(h); ok(L.list().rooms[0].title === '한판 붙자', 'invite: a room keeps the name given');
    t = 31000; ok(!L.list().rooms.length && L.join({ acct: 'g'.repeat(32), name: 'G' }, o.code).why === 'away', 'invite: a host away is off the list and cannot be joined');
    t = 5 * 60000; ok(L.ask(h.acct, o.code).waiting && L.list().rooms.length === 1 && L.open(h).code === o.code, 'invite: back within ten minutes, the same code');
    t = 20 * 60000; ok(!L.peek(o.code).ok, 'invite: away too long, the code is gone'); }
  // a locked game being watched asks its password; a player starting another game takes the old one off the list; a room
  // that never says it ended leaves the list in WATCH_KEEP
  { let t = 0; const L = new InviteCore(() => t), h = { acct: 'h'.repeat(32), dama: 500, name: 'H', mode: 'eight', listed: true, pw: '77' };
    const o = L.open(h), id = L.list().rooms[0].id; L.join({ acct: 'g'.repeat(32), dama: 400, name: 'G' }, o.code); L.ready1('g'.repeat(32), o.code, true); L.start(h.acct, o.code);
    ok(L.watch(id, '1').why === 'wrong password' && L.watch(id, '77').ok, 'invite: watching a locked game takes its password');
    L.open(Object.assign({}, h, { pw: '' })); ok(L.list().rooms.length === 1 && !L.list().rooms[0].playing, 'invite: the host opening again takes the old game off the list');
    const o2 = L.list().rooms[0], c2 = L.byId(o2.id).code; L.join({ acct: 'k'.repeat(32), dama: 400, name: 'K' }, c2); L.ready1('k'.repeat(32), c2, true); L.start(h.acct, c2);
    t = 44 * 60000; ok(L.list().rooms.length === 1, 'invite: a game being played stays a while'); t = 46 * 60000; ok(!L.list().rooms.length, 'invite: and not for ever'); }
  // the room: a watcher's key lets in to watch (not to play); watchers hear the shots, aims, emotes and the result
  { const { sql, tx } = sqlOf(), sent = { 0: [], 1: [], w: [] }, R = new RoomCore(sql, (s, m) => (sent[s] || (sent[s] = [])).push(m), tx);
    R.init({ room: 'e'.repeat(32), watch: 'w'.repeat(32), mode: 'four', seed: 5, first: 0, kind: 'invite', rules: { target: 3 }, seats: [{ acct: 'a'.repeat(32), token: 't0', name: 'A', icon: 0, dama: 30 }, { acct: 'b'.repeat(32), token: 't1', name: 'B', icon: 1, dama: 40 }] });
    ok(R.watches('w'.repeat(32)) && !R.watches('t0') && !R.watches('') && R.seatOf('w'.repeat(32)) < 0, 'room: the watch key watches and is no seat');
    R.message(0, { t: 'aim', aim: 1, power: 0.5 }); R.message(1, { t: 'emote', id: 'fire' }); R.message(0, { t: 'timeout', n: 0 });
    const ws = R.watchState(); ok(ws.watch && ws.seat === -1 && ws.seats.length === 2 && ws.seats[1].name === 'B' && !('token' in ws.seats[0]) && !('acct' in ws.seats[0]) && ws.shots.length === 1, 'room: a watcher hears both players and every shot');
    ok(['aim', 'emote', 'timeout'].every(t => sent.w.some(m => m.t === t)), 'room: watchers hear the aims, emotes and shots');
    R.message(0, { t: 'resign' }); let k = 0; while (R.work(500) && k++ < 1e5); ok(sent.w.some(m => m.t === 'result' && m.seat === -1), 'room: watchers hear the result'); }
  // which pages may call (owner 11-16: a copy of the site elsewhere may not): ours, the app's file page, a developer's machine
  ok(originOk('https://danguuu.com') && originOk('null') && originOk(null) && originOk('http://localhost:8787') && !originOk('https://danguuu.co') && !originOk('https://evil.example')
    && !originOk('http://localhost.evil.example') && originOk('http://x.test', { ORIGINS_EXTRA: 'http://x.test' }), 'origins: ours and the app answered, other pages not');
  // 다시 하기 (owner 11-15): after a friend's game, every player asking opens the next room - the loser begins; one leaving tells the other
  { const { sql, tx } = sqlOf(), sent = { 0: [], 1: [], w: [] }, R = new RoomCore(sql, (s, m) => (sent[s] || (sent[s] = [])).push(m), tx);
    R.init({ room: 'f'.repeat(32), mode: 'four', seed: 5, first: 0, kind: 'invite', rules: { target: 10, hugu: true }, seats: [{ acct: 'a'.repeat(32), token: 't0', name: 'A', dama: 30 }, { acct: 'b'.repeat(32), token: 't1', name: 'B', dama: 40 }] });
    ok(R.message(0, { t: 'again' }) == null && !R.get('again'), 'again: not while the game is played');
    R.message(1, { t: 'resign' }); let k = 0; while (R.work(500) && k++ < 1e5);
    ok(R.message(0, { t: 'again' }) == null && sent[1].some(m => m.t === 'again' && m.want[0] && !m.want[1]), 'again: one asking is told to the other');
    ok(R.state(1).again[0] === true, 'again: a device coming back hears who has asked');
    ok(R.message(1, { t: 'again' }) === 'again' && R.message(1, { t: 'again' }) == null, 'again: both asking opens the next room, once');
    const x = R.nextInit(); ok(/^[0-9a-f]{32}$/.test(x.room) && x.room !== 'f'.repeat(32) && x.first === 1 && x.kind === 'invite' && x.seats[0].token === 't0' && x.rules.target === 10, `again: the next room - new, the same seats and rules, the loser begins (${x.first})`);
    R.nextGo(x); ok(sent[0].some(m => m.t === 'next' && m.room === x.room) && sent[1].some(m => m.t === 'next' && m.seed === x.seed), 'again: both told where');
    const { sql: q2, tx: t2 } = sqlOf(), R2 = new RoomCore(q2, () => {}, t2); ok(R2.init(x) && R2.seatOf('t1') === 1 && R2.get('status') === 'playing', 'again: the next room opens with the same tokens');
    const { sql: q3, tx: t3 } = sqlOf(), s3 = { 0: [], 1: [], w: [] }, R3 = new RoomCore(q3, (s, m) => s3[s].push(m), t3);
    R3.init({ room: '9'.repeat(32), mode: 'eight', seed: 5, first: 0, kind: 'ranked', seats: [{ acct: 'a'.repeat(32), token: 't0', name: 'A', dama: 30 }, { acct: 'b'.repeat(32), token: 't1', name: 'B', dama: 40 }] });
    R3.message(1, { t: 'resign' }); k = 0; while (R3.work(500) && k++ < 1e5); ok(R3.message(0, { t: 'again' }) == null && !s3[1].some(m => m.t === 'again'), 'again: not in a ranked game');
    const { sql: q4, tx: t4 } = sqlOf(), s4 = { 0: [], 1: [], w: [] }, R4 = new RoomCore(q4, (s, m) => s4[s].push(m), t4);
    R4.init({ room: '8'.repeat(32), mode: 'eight', seed: 5, first: 0, kind: 'invite', rules: {}, seats: [{ acct: 'a'.repeat(32), token: 't0', name: 'A', dama: 30 }, { acct: 'b'.repeat(32), token: 't1', name: 'B', dama: 40 }] });
    R4.message(1, { t: 'resign' }); k = 0; while (R4.work(500) && k++ < 1e5); R4.disconnected(1); ok(s4[0].some(m => m.t === 'again' && m.left === 1), 'again: leaving the result is told to the other'); }
  // ranked by tier (owner 11-15): the room's rules are the higher tier's
  { const T = E.ECONOMY.TIER_AT, { sql, tx } = sqlOf(), R = new RoomCore(sql, () => {}, tx);
    R.init({ room: '7'.repeat(32), mode: 'four', seed: 5, first: 0, seats: [{ acct: 'a'.repeat(32), token: 't0', name: 'A', dama: 500 }, { acct: 'b'.repeat(32), token: 't1', name: 'B', dama: T[4] + 5 }] });
    const ru = R.get('room').rules; ok(ru.target === 7 && ru.finish === 'three' && ru.hugu && ru.ot, `ranked rules: a bronze against a diamond plays the diamond's (${JSON.stringify(ru)})`); }
  // 2:2: friends take seats as they come, the host gives the computer a seat and starts; everyone seated hears the room
  { const L = new InviteCore(), host = { acct: 'h'.repeat(32), dama: 500, name: 'H', mode: 'four', listed: true, size: 4 };
    const o = L.open(host); ok(o.size === 4 && o.seats.length === 4 && o.seats[0].name === 'H' && !o.seats[1], 'invite 2:2: a room for four, the host in seat 0');
    const j1 = L.join({ acct: 'a'.repeat(32), dama: 400, name: 'A' }, o.code), j2 = L.join({ acct: 'b'.repeat(32), dama: 410, name: 'B' }, o.code);
    ok(j1.waiting && j1.seat === 1 && j2.seat === 2 && L.ask('a'.repeat(32), o.code).seats[2].name === 'B', 'invite 2:2: friends take seats in turn and see the others');
    ok(!L.start(host.acct, o.code).ok && L.start(host.acct, o.code).why === 'not full', 'invite 2:2: not started with an empty seat');
    ok(!L.bot('a'.repeat(32), o.code, 3, 2).ok && L.bot(host.acct, o.code, 1, 2).why === 'taken' && L.bot(host.acct, o.code, 3, 2).seats[3].bot === 2, 'invite 2:2: only the host puts the computer in an empty seat');
    ok(L.list().rooms.length === 0, 'invite 2:2: a full room waiting to start is not offered to others');
    ok(L.join({ acct: 'c'.repeat(32), dama: 410, name: 'C' }, o.code).why === 'full', 'invite 2:2: a full room takes nobody else');
    ok(L.start(host.acct, o.code).why === 'not ready', 'invite 2:2: not started before the friends are ready');
    L.ready1('a'.repeat(32), o.code, true); L.ready1('b'.repeat(32), o.code, true);
    const st = L.start(host.acct, o.code);
    ok(st.ok && st.init.seats.length === 4 && st.init.seats[3].bot && st.seat === 0 && st.team.length === 4, 'invite 2:2: the host starts; the room has four seats, one the computer\'s');
    const ga = L.ask('a'.repeat(32), o.code), gb = L.join({ acct: 'b'.repeat(32), dama: 410, name: 'B' }, o.code);
    ok(ga.room === st.room && ga.seat === 1 && gb.seat === 2 && ga.token !== gb.token, 'invite 2:2: each friend hears the room and their own seat');
    const ls = L.list().rooms; ok(ls.length === 1 && ls[0].playing && ls[0].names.join() === 'H,A,B,컴퓨터', 'invite 2:2: the game being played is in the list with all four'); }
  console.log('invites: checked');
}
// online games (Codex B04-B07): the room's table; a room heard of only once open, and a failed one undone; a new search
// never lands in an old room; a seat that never comes in loses in its time
{
  let t = 0; const L = Object.assign(new LobbyCore('eight', () => t, () => 20000), { deferReady: true });
  L.ask({ acct: 'a', dama: 30, name: 'A', seek: 's1' }); const b = L.ask({ acct: 'b', dama: 31, name: 'B', seek: 's2' });
  ok(b.room && b.table === ROOM_TABLE && L.lastInit.room === b.room, 'online: the pair hears the room\'s table');
  ok(L.ask({ acct: 'a', dama: 30, name: 'A', seek: 's1' }).waiting, 'online: the other hears "waiting" while the room is being opened');
  L.unpair(b.room); const re = L.ask({ acct: 'a', dama: 30, name: 'A', seek: 's1' });
  ok(re.room && re.room !== b.room && L.lastInit.room === re.room, 'online: a room that could not open is undone - the two are paired again into a new one');
  const c = L.lastInit.room; L.ready(c); const a2 = L.ask({ acct: 'a', dama: 30, name: 'A', seek: 's1' });
  ok(a2.room === c, 'online: once open, the same search hears it (again, if its answer was lost)');
  const a3 = L.ask({ acct: 'a', dama: 30, name: 'A', seek: 's9' }); ok(a3.waiting && !a3.room, 'online: a new search does not land in the old room');
  const I = Object.assign(new InviteCore(), { deferReady: true }), op = I.open({ acct: 'h', dama: 30, name: 'H', mode: 'nine' });
  I.join({ acct: 'g', dama: 30, name: 'G' }, op.code); I.ready1('g', op.code, true);
  const j = I.start('h', op.code); ok(j.ok && j.init && I.ask('h', op.code).waiting, 'invite: the host hears "waiting" while the room opens');
  I.unjoin(op.code); ok(I.start('h', op.code).init, 'invite: a room that could not open may be started again');
  I.ready(op.code); ok(I.ask('h', op.code).room && I.ask('h', op.code).table === ROOM_TABLE, 'invite: then the host hears the room');
  const { sql, tx } = sqlOf(), R = new RoomCore(sql, () => {}, tx), seats = [{ acct: 'a'.repeat(32), token: 't0', name: 'A', dama: 30 }, { acct: 'b'.repeat(32), token: 't1', name: 'B', dama: 30 }];
  R.init({ room: 'e'.repeat(32), mode: 'eight', seed: 1, first: 0, standIn: null, seats });
  const t0 = Date.now(), real = Date.now; R.connected(0);
  ok(R.log().table === ROOM_TABLE, 'online: the room plays it again on its own table');
  Date.now = () => t0 + JOIN_WITHIN - 1000; ok(R.timers() === null && R.waitingJoin() > 0, 'online: a seat not yet in has its time');
  Date.now = () => t0 + JOIN_WITHIN + 10; ok(R.timers() === 'check' && R.get('end').loser === 1, 'online: a seat that never came in loses');
  Date.now = real;
  const S = new RoomCore(sqlOf().sql, () => {}, fn => fn()); S.init({ room: 'f'.repeat(32), mode: 'nine', seed: 1, first: 0, standIn: { name: 'S' }, seats: [seats[0], { acct: null, token: 't1', name: 'S', dama: 30 }] });
  S.connected(0); Date.now = () => t0 + JOIN_WITHIN + 10; ok(S.timers() === null, 'online: a stand-in\'s seat is always there'); Date.now = real;
  console.log('online rooms (B04-B07): checked');
}
// linking devices (link.js, core.js devices): a code works once, within its time, and only the last one made; wrong tries
// are capped a minute; any of an account's keys opens it, at most MAX_DEVICES besides the first
{
  let t = 1000, n = 0; const { sql } = sqlOf(), K = new LinkCore(sql, () => t, k => Uint8Array.from({ length: k }, () => (n = (n * 7 + 3) % 251)));
  // (the device codes are gone, owner 11-16: Google is the one way)
  ok(!K.make && !K.use, 'link: no device codes');
  ok(K.google('g1', null).why === 'not tied', 'link: a Google account tied to nothing, signed in with no account: nothing');
  ok(K.google('g1', 'e'.repeat(32)).tied && K.google('g1', 'f'.repeat(32)).acct === 'e'.repeat(32), 'link: a Google account is tied once, to the first account');
  K.forget('e'.repeat(32)); ok(K.google('g1', 'f'.repeat(32)).tied, 'link: an account deleted lets its Google account go - signing in again ties it anew');
  { const w = vault(); w.init('9'.repeat(64)); w.buy && 0; ok(!w.erase({}).ok && w.authed('9'.repeat(64)), 'erase: not without being sure');
    ok(w.erase({ sure: '삭제' }).ok && !w.authed('9'.repeat(64)) && w.me().coin === 0, 'erase: everything gone, the key opens nothing');
    ok(w.init('8'.repeat(64)), 'erase: the vault is as one never opened'); }
  const v = vault(); v.init('1'.repeat(64)); ok(v.authed('1'.repeat(64)) && !v.authed('2'.repeat(64)), 'devices: the first key opens it');
  ok(v.addDevice('2'.repeat(64)).ok && v.authed('2'.repeat(64)) && v.authed('1'.repeat(64)) && v.me().devices === 2, 'devices: a linked key opens it too');
  for (let i = 3; i < 3 + MAX_DEVICES + 2; i++) v.addDevice(i.toString(16).padStart(64, '0'));
  ok(v.me().devices === 1 + MAX_DEVICES && v.authed('1'.repeat(64)) && !v.authed('2'.repeat(64)), 'devices: at most MAX_DEVICES linked, the oldest goes, the first stays');
  ok(!v.addDevice('not a hash').ok && !vault().addDevice('3'.repeat(64)).ok, 'devices: only a real hash, only to an opened account');
  console.log('linking: checked');
}
// Google sign-in (google.js): a token signed with the published key, for this app, in date - and nothing else
{
  const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const jwk = Object.assign(await crypto.subtle.exportKey('jwk', pair.publicKey), { kid: 'k1' });
  const get = async () => ({ ok: true, json: async () => ({ keys: [jwk] }) }), now = 1.8e12;
  const b64 = o => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
  const tok = async (body, kid = 'k1', key = pair.privateKey) => { const h = b64({ alg: 'RS256', kid, typ: 'JWT' }), p = b64(body);
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(h + '.' + p)); return h + '.' + p + '.' + Buffer.from(sig).toString('base64url'); };
  const good = { iss: 'https://accounts.google.com', aud: 'app.apps.googleusercontent.com', sub: '1234', email: 'x@y.z', exp: now / 1000 + 600 };
  forgetGoogleKeys();
  ok((await googleWho(await tok(good), 'app.apps.googleusercontent.com', get, now)).sub === '1234', 'google: a good token says who it is');
  ok((await googleWho(await tok(good), null, get, now)).why === 'google not set up', 'google: nothing without a client id');
  ok((await googleWho(await tok({ ...good, aud: 'other' }), 'app.apps.googleusercontent.com', get, now)).why === 'not for this app', 'google: another app\'s token is refused');
  ok((await googleWho(await tok({ ...good, exp: now / 1000 - 1 }), 'app.apps.googleusercontent.com', get, now)).why === 'not for this app', 'google: an expired token is refused');
  const other = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  ok((await googleWho(await tok(good, 'k1', other.privateKey), 'app.apps.googleusercontent.com', get, now)).why === 'bad signature', 'google: a token not signed by Google is refused');
  ok((await googleWho('a.b', 'app.apps.googleusercontent.com', get, now)).why === 'bad token', 'google: not a token');
  // an access token from the account chooser: Google's tokeninfo says whose and for which app
  let asked = 0; const info = body => async () => { asked++; return { ok: true, json: async () => body }; };
  const at = 'ya29.' + 'a'.repeat(40), CID = 'app.apps.googleusercontent.com', mine = { aud: CID, azp: CID, sub: '77', email: 'o@x.y', email_verified: 'true', exp: String(now / 1000 + 3000) };
  forgetGoogleKeys();
  ok((await googleWhoAccess(at, CID, info(mine), now)).email === 'o@x.y' && (await googleWhoAccess(at, CID, info(mine), now)).sub === '77' && asked === 1, 'google: an access token says who it is (asked once)');
  forgetGoogleKeys();
  ok((await googleWhoAccess(at, CID, info({ ...mine, aud: 'x', azp: 'x' }), now)).why === 'not for this app', 'google: another app\'s access token is refused');
  forgetGoogleKeys();
  ok((await googleWhoAccess(at, CID, info({ ...mine, exp: String(now / 1000 - 5) }), now)).why === 'not for this app', 'google: an expired access token is refused');
  forgetGoogleKeys();
  ok((await googleWhoAccess(at, CID, info({ ...mine, email_verified: 'false' }), now)).email === null, 'google: an unchecked address is no address');
  forgetGoogleKeys();
  { const both = async (u, o) => ({ ok: true, json: async () => u.includes('userinfo') ? { sub: '77', email: 'u@x.y', email_verified: true } : { ...mine, email: undefined } });
    ok((await googleWhoAccess(at, CID, both, now)).email === 'u@x.y', 'google: no address in tokeninfo - userinfo gives it'); }
  forgetGoogleKeys();
  ok((await googleWhoAccess(at, CID, async () => ({ ok: false }), now)).why === 'bad token', 'google: a token Google does not know is refused');
  forgetGoogleKeys();
  { const dotted = 'ya29.c.' + 'b'.repeat(30) + '.x9'; forgetGoogleKeys(); ok((await googleWhoAny(dotted, CID, info(mine), now)).sub === '77', 'google: an access token with two dots is still an access token'); }
  forgetGoogleKeys();
  ok((await googleWhoAny(await tok(good), CID, get, now)).sub === '1234' && (await googleWhoAny(at, CID, info(mine), now)).sub === '77', 'google: either kind of token');
  console.log('google sign-in: checked');
}
// the admin console: giving, taking, setting the rating, each in the ledger and the log; and finding an account
{
  const v = vault(), rare = E.CUES.find(q => q.rarity > 0), common = E.CUES.find(q => !q.rarity);
  let r = v.adminGrant({ by: 'admin', why: '보상', coin: 5000, dia: 30 });
  ok(r.ok && r.me.coin === 5000 && r.me.dia === 30, 'admin: coins and diamonds given');
  ok(!v.adminGrant({ by: 'admin', coin: -6000 }).ok && v.me().coin === 5000, 'admin: never below nothing');
  ok(v.adminGrant({ by: 'admin', coin: -1000 }).ok && v.me().coin === 4000, 'admin: coins taken');
  ok(v.adminGrant({ by: 'admin', kind: 'cue', id: rare.id }).ok && v.owns('cue', rare.id), 'admin: an item given');
  ok(v.adminGrant({ by: 'admin', kind: 'cue', id: rare.id, take: true }).ok && !v.owns('cue', rare.id), 'admin: an item taken back');
  ok(!v.adminGrant({ by: 'admin', kind: 'cue', id: 'nope' }).ok, 'admin: no made-up items');
  ok(!v.adminGrant({ by: 'admin', kind: 'cue', id: common.id }).ok, 'admin: an item everyone has is nothing to give');
  ok(v.adminGrant({ by: 'admin', dama: 1500 }).ok && v.me().dama === 1500, 'admin: the rating set');
  ok(!v.adminGrant({ by: 'admin', dama: 99999 }).ok && v.me().dama === 1500, 'admin: a rating out of bounds refused');
  ok(!v.adminGrant({ by: 'admin', coin: 50, dama: 99999 }).ok && v.me().coin === 4000, 'admin: one bad part, none of it done');
  const w = v.adminView();
  ok(w.ok && w.admin.length === 5 && w.admin[0].did.startsWith('dama') && w.ledger.some(l => /^admin · 보상/.test(l.what)) && w.me.save === undefined, 'admin: the view has the log and the ledger');
  ok(v.me().debug === false, 'admin: debug mode off to begin with');
  ok(v.adminGrant({ by: 'admin', debug: true }).ok && v.me().debug === true && v.me().coin === 4000, 'admin: debug mode turned on, nothing else changed');
  ok(!v.adminGrant({ by: 'admin', debug: true }).ok, 'admin: debug already on is nothing to do');
  ok(v.adminGrant({ by: 'admin', debug: false }).ok && v.me().debug === false, 'admin: debug mode turned off');
  const { Directory } = await import('../src/directory.js');
  const D = new Directory(sqlOf().sql), A = 'ab'.repeat(16), B = 'cd'.repeat(16);
  D.put({ acct: A, nick: '큐대장', joined: true, dama: 1200, coin: 10, dia: 1 }); D.put({ acct: B, nick: '초보', dama: 1000 });
  D.put({ acct: A, nick: '큐대장2', joined: true, dama: 1300, coin: 10, dia: 1 }); D.put({ acct: 'nope', nick: 'x' });
  ok(D.find('큐대').people.length === 1 && D.find('큐대').people[0].dama === 1300, 'directory: found by name, the latest');
  ok(D.find('CDCD·CDCD').people[0].acct === B && D.find('').people.length === 2, 'directory: found by the id as the settings show it; all of them');
  ok(D.find('%').people.length === 0, 'directory: no wildcards from outside');
  ok(D.fails(false, 1000).n === 0 && D.fails(true, 1000).n === 1 && D.fails(true, 2000).n === 2 && D.fails(false, 1000 + 15 * 60000 + 1).n === 1, 'directory: wrong admin passwords counted for 15 minutes');
  console.log('admin: checked');
{ // (owner 11-21) a stand-in never wears a debug item (a debug account's own things - content/: debug: true)
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, debugIds = new Set();
  for (const k of ['CUES', 'BALLSKINS', 'CLOTHS', 'TRAILS']) for (const q of E[k] || []) if (q.debug) debugIds.add(q.id);
  let worn = 0; for (let i = 0; i < 4000; i++) { const g = standInGear(rnd); for (const v of Object.values(g)) if (debugIds.has(v)) worn++; }
  ok(debugIds.size > 0 && worn === 0, 'stand-ins: no debug item in 4000 dressings');
}
}
// the shot dataset (dataset-core.js): a match cut down to its shots and the seats' ratings, kept once, read out in order
{
  const shot = (x, t) => ({ s: { cue: 0, balls: [[x, 0.1234567, 1, 0, 0, [1, 0, 0, 0]], [0.5, -0.2, 0, 0, 0, [1, 0, 0, 0]], [0.3, 0.3, 1, 0, 0, [1, 0, 0, 0]]] }, aim: 1.23456789, V: 2.5, a: 0.1, b: -0.2, el: 0, inHand: false, t });
  const log = { v: 1, mode: 'three', table: 'bar', opts: { cushions: 3 }, shots: [shot(-0.5, 0), { timeout: true }, shot(-0.4, 1)], winner: 0, points: [3, 1], bot: { id: 'sua', rating: 300 } };
  const row = datasetRow('cpu', log, [{ rating: 1210.4, human: true }, { rating: 300, human: false, bot: 'sua' }], 1763400000000);
  ok(row && row.shots.length === 3 && row.shots[1][0] === -2 && row.shots[0].length === 8 + 9 && row.shots[0][1] === 1.23457 && row.shots[0][9] === 0.12346 && row.shots[2][0] === 1, 'dataset: a shot as [seat, aim, V, a, b, el, in hand, cue, x, y, on...], to 1/100 mm');
  ok(row.seats[0].rating === 1210 && row.seats[0].human && !row.seats[1].human && row.seats[1].bot === 'sua' && !('acct' in row) && !JSON.stringify(row).includes('name'), 'dataset: the seats\' ratings, no one named');
  ok(datasetRow('cpu', { mode: 'golf', shots: [shot(0, 0)] }, []) === null && datasetRow('nope', log, []) === null, 'dataset: no unknown game or kind');
  ok(monthOf(Date.UTC(2026, 10, 18)) === 'shots-2026-11', 'dataset: a month an object');
  ok(dayOf(Date.UTC(2026, 10, 18, 23)) === 'shots-2026-11-18' && partsOf('shots-2026-02').length === 29 && partsOf('shots-2026-11')[0] === 'shots-2026-11' && partsOf('shots-2026-11')[30] === 'shots-2026-11-30', 'dataset: a day an object, a month read as its own object then its days');
  const D = new DatasetCore(sqlOf().sql);
  ok(D.put(Object.assign({ key: 'k1' }, row)).kept && !D.put(Object.assign({ key: 'k1' }, row)).kept && D.put(Object.assign({ key: 'k2' }, row)).kept, 'dataset: a match kept once by its key');
  const st = D.stats(); ok(st.by.length === 1 && st.by[0].matches === 2 && st.by[0].shots === 6, 'dataset: counted by kind and game');
  const ex = D.export(0, 1); ok(ex.rows.length === 1 && ex.more && D.export(ex.next, 5).rows.length === 1 && !D.export(ex.next, 5).more, 'dataset: read out after n, a page at a time');
  ok(!D.put({ v: 1, mode: 'three', kind: 'cpu' }).ok, 'dataset: a row with no shots refused');
  console.log('dataset: checked');
}
console.log(failed ? `${failed} server check(s) failed` : 'server checks passed');
process.exit(failed ? 1 : 0);
