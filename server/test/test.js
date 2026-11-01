/* Server checks, without Cloudflare: the vault's rules on node's own SQLite, and matches played again.
   npm test   (or: node tools/pack.cjs && node --no-warnings test/test.js) */
import { DatabaseSync } from 'node:sqlite';
import { VaultCore } from '../src/core.js';
import { playMatch, playPuzzle, Replay, E } from '../src/check.js';
import { logError, matchKey } from '../src/match-log.js';
import { LobbyCore, RoomCore, STAND_IN_AFTER, RETURN_WITHIN, RANKED_RULES } from '../src/ranked.js';

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
  if (log.shots.length > 1) { const bad = JSON.parse(JSON.stringify(log)); bad.shots[0].V *= 1.03; ok(!playMatch(bad).ok, `${mode}: a changed shot is caught`); }
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
    for (let k = 0; k < 6; k++) v.match({ req: req(), kind: 'cpu', log: uncheckedLog(k) });
    ok(v.me().checking === 6, 'a caught account has every match checked');
    const u = vault({ CHECK_MATCHES: 'slices' }); u.init('h'); let queued = 0;
    const random = Math.random;
    try { for (let k = 0; k < 40; k++) { Math.random = () => k % 4 === 0 ? 0.1 : 0.99; if (u.match({ req: req(), kind: 'cpu', log: uncheckedLog(k, [3, 1]) }).pending) queued++; } } finally { Math.random = random; }
    ok(queued >= 3 && queued < 30, `only a share is checked (${queued} of 40)`);
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
  console.log('reward regressions: receipts, duplicate matches, corrupt queue and terminal checkpoints checked');
}
// ranked: the lobby pairs by DAMA (the range widening with the wait), and after a while seats a stand-in
{
  let t = 0; const L = new LobbyCore('eight', () => t);
  ok(L.ask({ acct: 'a', dama: 30, name: 'A', icon: 1 }).waiting, 'lobby: one alone waits');
  const b = L.ask({ acct: 'b', dama: 32, name: 'B', icon: 2 }); ok(b.room && b.seat === 0 && b.opp.name === 'A', 'lobby: two close in DAMA are paired at once');
  const a = L.ask({ acct: 'a', dama: 30, name: 'A', icon: 1 }); ok(a.room === b.room && a.seat === 1 && a.token !== b.token && a.seed === b.seed, 'lobby: the other hears the same room, its own seat');
  ok(L.ask({ acct: 'c', dama: 20, name: 'C' }).waiting && L.ask({ acct: 'd', dama: 70, name: 'D' }).waiting, 'lobby: far apart, they wait');
  t = 5000; L.ask({ acct: 'c', dama: 20 }); t = 10000; L.ask({ acct: 'c', dama: 20 }); L.ask({ acct: 'd', dama: 70 }); t = 14000; L.ask({ acct: 'c', dama: 20 });
  t = 16000; ok(L.ask({ acct: 'd', dama: 70 }).waiting, 'lobby: 50 apart is still too far after 16 s');
  L.ask({ acct: 'c', dama: 20 }); t = 20000; L.ask({ acct: 'd', dama: 70 });
  t = 20500; const c = L.ask({ acct: 'c', dama: 20 }); ok(c.room && c.standIn && c.standIn.name && c.opp.name === c.standIn.name, 'lobby: a stand-in after waiting long');
  t = 40000; ok(L.ask({ acct: 'e', dama: 30 }).waiting && !L.wait.has('d'), 'lobby: one not heard from has left');
  console.log('ranked lobby: checked');
}
// ranked: a room - shots passed on and kept, the game played again, and the replay (not the devices) decides
{
  const H2 = E.createHighlights();
  // a ranked game the way two devices play it: the room's seed for the rack (and the 4구 roll-out), each shot by its seat
  function rankedGame(mode, seed, first) {
    const g = E.createGame(E.physicsFor(E.createPhysics, 'bar'), E.createAI);
    g.start(mode, ['A', 'B'], false, Object.assign({ rnd: E.seededRandom(seed), first, level: 2 }, RANKED_RULES[mode])); g.players[0].ai = g.players[1].ai = true; g.level = 2;
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
    const { sql, tx } = sqlOf(), sent = [[], []], R = new RoomCore(sql, (s, m) => sent[s].push(m), tx);
    R.init({ room: 'f'.repeat(32), mode, seed, first, standIn: standIn || null, seats: [{ acct: 'a'.repeat(32), token: 't0', name: 'A', icon: 0, dama: 30 }, { acct: standIn ? null : 'b'.repeat(32), token: 't1', name: 'B', icon: 1, dama: 40 }] });
    return { R, sent };
  };
  const finish = R => { let k = 0; while (R.work(500) && k < 100000) k++; return R.get('result'); };
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
  // a seat that shoots out of turn loses; one that leaves and does not come back loses
  { const G = rankedGame('eight', 7, 0), { R } = roomOf('eight', 7, 0); R.message(G.msgs[0].seat, G.msgs[0].m); const m = JSON.parse(JSON.stringify(G.msgs[1] || G.msgs[0])); m.m.n = 1; R.message(G.msgs[0].seat, m.m); R.message(0, { t: 'resign' });
    const r = finish(R); ok(r.winner === 1 - G.msgs[0].seat, 'ranked: a shot out of turn loses'); }
  { const { R, sent } = roomOf('nine', 9, 0); ok(R.disconnected(1) && sent[0].some(m => m.t === 'away'), 'ranked: the other seat hears one has gone');
    const gone = R.get('gone'); gone[1] = Date.now() - RETURN_WITHIN - 1; R.set('gone', gone); ok(R.timers() === 'check', 'ranked: gone too long ends it');
    const r = finish(R); ok(r.winner === 0 && r.why === 'left', 'ranked: one who left loses'); }
  // a stand-in: its shots come from seat 0's device; DAMA moves half as far; only the player's vault is told
  { const G = rankedGame('eight', 11, 0), { R } = roomOf('eight', 11, 0, { name: 'S', icon: 0, dama: 40, level: 2 });
    for (const x of G.msgs) R.message(0, Object.assign({}, x.m, { as: x.seat }));
    R.message(0, { t: 'end' }); const r = finish(R);
    if (G.winner != null) { const full = E.damaAfter(30, 40, G.winner === 0)[0] - 30;
      ok(r.winner === G.winner && r.dama[0] - 30 === Math.round(full * 0.5) && R.payouts().length === 1, `ranked: a stand-in game counts half (${r.why})`); } }
  console.log('ranked rooms: checked');
}
console.log(failed ? `${failed} server check(s) failed` : 'server checks passed');
process.exit(failed ? 1 : 0);
