/* Server checks, without Cloudflare: the vault's rules on node's own SQLite, and matches played again.
   npm test   (or: node tools/pack.cjs && node --no-warnings test/test.js) */
import { DatabaseSync } from 'node:sqlite';
import { VaultCore } from '../src/core.js';
import { playMatch, playPuzzle, Replay, E } from '../src/check.js';
import { logError, matchKey } from '../src/match-log.js';
import { LinkCore, CODE_MS, TRIES_PER_MIN } from '../src/link.js';
import { PHYS_V } from '../src/version.js';
import { googleWho, forgetGoogleKeys } from '../src/google.js';
import { MAX_DEVICES } from '../src/core.js';
import { LobbyCore, RoomCore, InviteCore, STAND_IN_AFTER, RETURN_WITHIN, RANKED_RULES, standInMayResign, standInDelay, ROOM_TABLE, JOIN_WITHIN, IDLE_AFTER } from '../src/ranked.js';

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
  let t = 0; const L = new LobbyCore('eight', () => t, () => 20000);
  ok(L.ask({ acct: 'a', dama: 30, name: 'A', icon: 1 }).waiting, 'lobby: one alone waits');
  const b = L.ask({ acct: 'b', dama: 32, name: 'B', icon: 2 }); ok(b.room && b.seat === 0 && b.opp.name === 'A', 'lobby: two close in DAMA are paired at once');
  const a = L.ask({ acct: 'a', dama: 30, name: 'A', icon: 1 }); ok(a.room === b.room && a.seat === 1 && a.token !== b.token && a.seed === b.seed, 'lobby: the other hears the same room, its own seat');
  ok(L.ask({ acct: 'c', dama: 20, name: 'C' }).waiting && L.ask({ acct: 'd', dama: 70, name: 'D' }).waiting, 'lobby: far apart, they wait');
  t = 5000; L.ask({ acct: 'c', dama: 20 }); t = 10000; L.ask({ acct: 'c', dama: 20 }); L.ask({ acct: 'd', dama: 70 }); t = 14000; L.ask({ acct: 'c', dama: 20 });
  t = 16000; ok(L.ask({ acct: 'd', dama: 70 }).waiting, 'lobby: 50 apart is still too far after 16 s');
  L.ask({ acct: 'c', dama: 20 }); t = 20000; L.ask({ acct: 'd', dama: 70 });
  t = 20500; const c = L.ask({ acct: 'c', dama: 20 }); ok(c.room && c.standIn && c.standIn.name && c.opp.name === c.standIn.name, 'lobby: a stand-in after waiting long');
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
  { const G = new LobbyCore('nine', () => 0); G.ask({ acct: 'g', dama: 30, name: 'G', gear: { cue: 'gold', ball: null, table: 'pool', trail: 'fire' } });
    const h = G.ask({ acct: 'h', dama: 30, name: 'H', gear: { cue: null, ball: 'disco', table: null, trail: null } });
    ok(h.opp.gear && h.opp.gear.cue === 'gold' && h.opp.gear.table === 'pool', 'lobby: the other player\'s gear comes with the room');
    ok(G.lastInit.seats.every(q => q.gear), 'lobby: the room is told both players\' gear'); }
  ok(c.opp.gear && ['cue', 'ball', 'table', 'trail'].every(k => k in c.opp.gear), 'lobby: a stand-in has gear on');
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
    const seed = 511, person = E.createAI(null).personaFor(60, E.seededRandom(41), { style: 'spinner' }), rules = E.RANKED_RULES[mode];
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
    // a stroke of its own (web/physics.js stroke) only from a cue with the stroke trait (content/20-cues.js TRAITS)
    for (const [cue, fits] of [[null, false], ['house', false], ['rose', true]]) {
      const R = gearRoom(cue), m = JSON.parse(JSON.stringify(G.msgs[0].m)); m.shot.ft = 0.6; R.message(s0, m); R.message(1 - s0, { t: 'resign' }); const r = finish(R);
      ok((r.why === 'resigned') === fits, `a stroke from ${cue || 'the usual cue'} ${fits ? 'stands' : 'loses'} (${r.why})`);
    }
    { const { R, sent } = roomOf('eight', 7, 0); const m = JSON.parse(JSON.stringify(G.msgs[0].m)); m.shot.ft = 2; R.message(s0, m); ok(!sent[1 - s0].some(q => q.t === 'shot'), 'a stroke out of 0-1 is not passed on'); }
    // B15: nothing from either for IDLE_AFTER while both are there - the seat whose turn it was loses
    { const { R } = roomOf('eight', 7, 0); R.connected(0); R.connected(1); play(R, G.msgs.slice(0, 1)); ok(R.timers() === null && R.idleIn() > IDLE_AFTER - 1000, 'B15: a turn just begun is not quiet');
      R.set('turnAt', Date.now() - IDLE_AFTER - 1); ok(R.timers() === 'check', 'B15: a turn gone quiet ends the game');
      const turn = (() => { const g = E.createGame(E.physicsFor(E.createPhysics, 'bar')); const rp = new Replay(R.log(), null, true); rp.advance(Infinity); return rp.g.turn; })();
      const r = finish(R); ok(r.winner === 1 - turn && r.why === 'idle', `B15: whose turn went quiet loses (${r.why})`); }
    { const { R } = roomOf('eight', 7, 0); R.connected(0); R.connected(1); R.disconnected(1); R.set('turnAt', Date.now() - IDLE_AFTER - 1);
      ok(R.idleIn() === null && R.timers() === null, 'B15: a seat away is the away rule\'s (RETURN_WITHIN), not the quiet turn\'s'); }
  }
  console.log('ranked rooms: checked');
  // the server's physics version is the engine's: a change to web/physics.js that moves PHYS_V there must move it here too
  ok(Number.isInteger(E.PHYS_V) && E.PHYS_V === PHYS_V, `physics version: engine ${E.PHYS_V}, server ${PHYS_V}`);
}

// a ranked game moves DAMA, an invite game does not; the break cue is not for sale
{
  const v = vault(); v.init('h');
  v.ranked({ room: '1'.repeat(32), mode: 'eight', won: true, coins: 10, dama: 3 }); v.ranked({ room: '3'.repeat(32), mode: 'eight', won: true, coins: 10, dama: 3, kind: 'invite' });
  ok(v.me().dama === 33 && v.me().drops === undefined, 'ranked: a win moves DAMA, an invite game none; no drops any more');
  ok(!v.buy({ req: req(), kind: 'cue', id: 'breaker' }).ok, 'the break cue is not for sale');
  console.log('ranked wins: checked');
}
// lessons: every 8볼 lesson done at its top level - each proof (seed, table, shot) played again - pays the coins and the
// break cue, once; a missing or doctored proof pays nothing
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
  const g = I.join({ acct: 'g'.repeat(32), dama: 50, name: 'G', icon: 1 }, o.code), h = I.ask(host.acct, o.code);
  ok(g.ok && g.init && g.seat === 1 && h.seat === 0 && h.room === g.room && h.token !== g.token && g.opp.name === 'H' && h.opp.name === 'G', 'invite: both in the same room');
  ok(!I.join({ acct: 'z'.repeat(32) }, o.code).ok, 'invite: a taken code');
  const { sql, tx } = sqlOf(), R = new RoomCore(sql, () => {}, tx); R.init(g.init);
  ok(R.state(0).kind === 'invite' && R.state(0).rules.target === 3 && R.log().opts.cushions === 1, 'invite: the room plays the host\'s rules');
  R.message(1, { t: 'resign' }); let k = 0; while (R.work(500) && k < 1000) k++;
  const res = R.get('result'), pay = R.payouts();
  ok(res.winner === 0 && res.dama[0] === 30 && res.dama[1] === 50 && pay.every(p => p.body.kind === 'invite' && p.body.dama === 0), 'invite: no DAMA moves');
  const o2 = I.open(host), o3 = I.open(host); ok(!I.peek(o2.code).ok && I.peek(o3.code).ok, 'invite: a new code closes the host\'s older one');
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
  const j = I.join({ acct: 'g', dama: 30, name: 'G' }, op.code); ok(j.ok && I.ask('h', op.code).waiting, 'invite: the host hears "waiting" while the room opens');
  I.unjoin(op.code); ok(I.join({ acct: 'g', dama: 30, name: 'G' }, op.code).init, 'invite: a room that could not open may be joined again');
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
  const a = K.make('a'.repeat(32)); ok(/^[A-Z2-9]{8}$/.test(a.code) && a.until === t + CODE_MS, `link: a code of 8 (${a.code})`);
  const b = K.make('a'.repeat(32)); ok(K.use(a.code).why === 'no such code', 'link: a newer code replaces the last one');
  ok(K.use(b.code.toLowerCase().replace(/(....)/, '$1-')).acct === 'a'.repeat(32), 'link: a code typed in any case, with a dash, works');
  ok(K.use(b.code).why === 'no such code', 'link: and only once');
  const c = K.make('c'.repeat(32)); t += CODE_MS + 1; ok(K.use(c.code).why === 'no such code', 'link: not after its time');
  t += 120000; for (let i = 0; i < TRIES_PER_MIN; i++) K.use('ZZZZZZZZ');
  const d = K.make('d'.repeat(32)); ok(K.use(d.code).why === 'slow down', 'link: too many wrong tries a minute hold everyone off');
  t += 61000; ok(K.use(d.code).acct === 'd'.repeat(32), 'link: and a minute later it works');
  ok(K.google('g1', null).why === 'not tied', 'link: a Google account tied to nothing, signed in with no account: nothing');
  ok(K.google('g1', 'e'.repeat(32)).tied && K.google('g1', 'f'.repeat(32)).acct === 'e'.repeat(32), 'link: a Google account is tied once, to the first account');
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
  console.log('google sign-in: checked');
}
console.log(failed ? `${failed} server check(s) failed` : 'server checks passed');
process.exit(failed ? 1 : 0);
