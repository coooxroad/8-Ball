/* Ranked games: the lobby that pairs players and the room a game is played in - their rules, testable in node.
   lobby.js and room.js are the Durable Objects that hold them. */
import { E, Replay } from './check.js';

/* The ranked lobby: one Durable Object per game (8볼, 9볼, 4구, 3구). Players waiting for a ranked game ask it every couple
   of seconds; it pairs two whose DAMA is close, the range widening the longer they wait. Nobody close enough after
   STAND_IN_AFTER: a stand-in takes the other seat - a person-like computer player (web/ai/), shown as a player like any
   other. A pair (or a player and a stand-in) get a room (room.js) and each a token for their seat.
   What is waiting is held in memory only: a lobby that restarts loses at most a few seconds of waiting. */

export const STAND_IN_AFTER = 20000;                  // ms of waiting before a stand-in takes the other seat
const GONE = 8000;                                    // a waiting player not heard from for this long has left
const range = waited => Math.min(60, 4 + 2 * waited / 1000);    // DAMA apart that is close enough, after waiting so long (ms)
const hex = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => b.toString(16).padStart(2, '0')).join('');

// a stand-in: a person-like player near this DAMA. web/ai/51-people.js (personaFor) when it is there, else a plain one
const NAMES = ['큐잡이', '쓰리쿠션러', '빈쿠션왕', '당구장죽돌이', '하이런', 'cue_master7', '밀어치기장인', 'hall_kim', '사구사백', '대대러버',
  '끌어치기', '초크한통', 'bank88', '레일러너', '포켓헌터', 'side_spin', '중대고수', '저녁당구', 'nineball_j', '큐대한자루'];
export function standIn(dama, rnd) {
  const ai = E.createAI ? E.createAI(null) : null;
  // (a few DAMA either side, as a person waiting at the same time would be)
  if (ai && ai.personaFor) return ai.personaFor(Math.max(E.ECONOMY.DAMA_FLOOR, Math.round(dama + (rnd() - 0.5) * 8)), rnd);
  const d = Math.max(E.ECONOMY.DAMA_FLOOR, Math.round(dama + (rnd() - 0.5) * 8));
  return { name: NAMES[Math.floor(rnd() * NAMES.length)] + (rnd() < 0.4 ? Math.floor(rnd() * 90 + 10) : ''), icon: Math.floor(rnd() * 8), dama: d,
    level: d < 22 ? 0 : d < 40 ? 1 : 2 };      // (never the top level: it does not miss, and nobody is like that)
}

/* What a player has on (their cue, ball set, table, trail - ids, each checked by the vault to be theirs; null: the usual),
   shown to the other player. A stand-in dresses as a person might: mostly the usual, now and then something bought. */
const GEAR_KINDS = { cue: 'CUES', ball: 'BALLSKINS', table: 'CLOTHS', trail: 'TRAILS' };
export function standInGear(rnd) {
  const g = {};
  for (const k in GEAR_KINDS) {
    const list = (E[GEAR_KINDS[k]] || []).filter(q => (q.rarity || 0) <= 2 && !q.ice), pick = list.filter(q => (q.rarity || 0) > 0);
    g[k] = rnd() < 0.45 && pick.length ? pick[Math.floor(rnd() * pick.length)].id : null;
  }
  return g;
}

export class LobbyCore {
  constructor(mode, now) { this.mode = mode; this.now = now || (() => Date.now()); this.wait = new Map(); this.made = new Map(); }
  /* p: { acct, dama, name, icon } asks again. Answers { waiting, waited } or the game it is in:
     { room, seat, token, seed, first, opp: { name, icon, dama }, standIn?: persona } - the same answer until it is taken */
  ask(p) {
    const t = this.now();
    for (const [k, m] of this.made) if (t - m.at > 60000) this.made.delete(k);
    if (this.made.has(p.acct)) return this.made.get(p.acct).you;
    for (const [k, w] of this.wait) if (t - w.seen > GONE) this.wait.delete(k);
    let me = this.wait.get(p.acct);
    if (!me) this.wait.set(p.acct, me = { acct: p.acct, dama: p.dama, name: p.name, icon: p.icon, gear: p.gear || null, since: t });
    me.seen = t; me.name = p.name; me.icon = p.icon; me.gear = p.gear || null;
    // the closest of those close enough (by either one's wait)
    let best = null, bd = Infinity;
    for (const o of this.wait.values()) {
      if (o === me) continue;
      const d = Math.abs(o.dama - me.dama);
      if (d <= Math.max(range(t - me.since), range(t - o.since)) && d < bd) { bd = d; best = o; }
    }
    if (best) return this.pair(me, best, null, t);
    if (t - me.since >= STAND_IN_AFTER) {
      const seedR = Math.random, persona = standIn(me.dama, seedR);
      return this.pair(me, { acct: null, dama: persona.dama, name: persona.name, icon: persona.icon, gear: standInGear(seedR) }, persona, t);
    }
    return { waiting: true, waited: t - me.since };
  }
  leave(acct) { this.wait.delete(acct); }
  pair(a, b, persona, t) {
    this.wait.delete(a.acct); if (b.acct) this.wait.delete(b.acct);
    const room = hex(16), seed = crypto.getRandomValues(new Uint32Array(1))[0], first = Math.random() < 0.5 ? 0 : 1, seats = [a, b];
    const tokens = [hex(16), hex(16)], pub = s => ({ name: s.name, icon: s.icon, dama: s.dama, gear: s.gear || null });
    const init = { room, mode: this.mode, seed, first, standIn: persona,
      seats: seats.map((s, i) => ({ acct: s.acct, token: tokens[i], name: s.name, icon: s.icon, dama: s.dama, gear: s.gear || null })) };
    const you = i => ({ room, seat: i, token: tokens[i], seed, first, mode: this.mode, opp: pub(seats[1 - i]), standIn: i === 0 && persona ? persona : undefined });
    this.made.set(a.acct, { at: t, you: you(0) });
    if (b.acct) this.made.set(b.acct, { at: t, you: you(1) });
    this.lastInit = init;
    return you(0);
  }
}

/* Games with an invited friend: the host opens a code (six letters and digits, nothing that reads two ways) and asks after
   it every couple of seconds; a friend who enters the code - or opens the link with it - takes the other seat, and a room
   opens as for a ranked game (kind 'invite': the host's rules, no DAMA, no 당구드롭). Held in memory in one Durable Object
   (the lobby named 'invites'); a code whose host has not asked for INVITE_IDLE is gone. */
export const INVITE_IDLE = 30000;
const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export class InviteCore {
  constructor(now) { this.now = now || (() => Date.now()); this.codes = new Map(); }
  sweep() { const t = this.now(); for (const [c, v] of this.codes) if (t - v.seen > (v.made ? 120000 : INVITE_IDLE)) this.codes.delete(c); }
  // p: { acct, dama, name, icon, gear, mode, rules } - a host's new code (an older one of theirs closes)
  open(p) {
    this.sweep();
    if (!E.RANKED_RULES[p.mode]) return { ok: false, why: 'no such game' };
    for (const [c, v] of this.codes) if (v.host.acct === p.acct && !v.made) this.codes.delete(c);
    let code; do { code = [...crypto.getRandomValues(new Uint8Array(6))].map(b => CODE_ABC[b % CODE_ABC.length]).join(''); } while (this.codes.has(code));
    this.codes.set(code, { code, mode: p.mode, rules: E.inviteRules(p.mode, p.rules), seen: this.now(), made: null,
      host: { acct: p.acct, dama: p.dama, name: p.name, icon: p.icon, gear: p.gear || null } });
    return { ok: true, code, mode: p.mode, rules: this.codes.get(code).rules };
  }
  // the host asking: still waiting, or the game (the same answer until it is taken)
  ask(acct, code) {
    this.sweep(); const v = this.codes.get(code);
    if (!v || v.host.acct !== acct) return { ok: false, why: 'gone' };
    v.seen = this.now();
    return v.made ? Object.assign({ ok: true }, v.made.you[0]) : { ok: true, waiting: true };
  }
  // what a code is (for the friend before joining): the game and who is waiting
  peek(code) { this.sweep(); const v = this.codes.get(code); return v && !v.made ? { ok: true, mode: v.mode, rules: v.rules, host: { name: v.host.name } } : { ok: false, why: 'no such code' }; }
  // p (the friend) takes the other seat: the room's init is returned with their answer (the lobby opens the room)
  join(p, code) {
    this.sweep(); const v = this.codes.get(code);
    if (!v) return { ok: false, why: 'no such code' };
    if (v.host.acct === p.acct) return { ok: false, why: 'your own code' };
    if (v.made) return v.made.guest === p.acct ? Object.assign({ ok: true }, v.made.you[1]) : { ok: false, why: 'taken' };
    const room = hex(16), seed = crypto.getRandomValues(new Uint32Array(1))[0], first = Math.random() < 0.5 ? 0 : 1, seats = [v.host, { acct: p.acct, dama: p.dama, name: p.name, icon: p.icon, gear: p.gear || null }];
    const tokens = [hex(16), hex(16)], pub = s => ({ name: s.name, icon: s.icon, dama: s.dama, gear: s.gear || null });
    const init = { room, mode: v.mode, seed, first, standIn: null, kind: 'invite', rules: v.rules,
      seats: seats.map((s, i) => ({ acct: s.acct, token: tokens[i], name: s.name, icon: s.icon, dama: s.dama, gear: s.gear || null })) };
    const you = i => ({ room, seat: i, token: tokens[i], seed, first, mode: v.mode, kind: 'invite', rules: v.rules, opp: pub(seats[1 - i]) });
    v.made = { guest: p.acct, you: [you(0), you(1)] }; v.seen = this.now();
    return Object.assign({ ok: true, init }, you(1));
  }
  leave(acct, code) { const v = this.codes.get(code); if (v && v.host.acct === acct && !v.made) this.codes.delete(code); return { ok: true }; }
}

/* A ranked game: one Durable Object per game, opened by the lobby (lobby.js) for two seats. Both devices connect by
   WebSocket and play the same game: each plays its own shots and sends them; the other device plays them too (the physics
   gives both the same table). The room passes them on and keeps the log. When the game ends - both say so, or one seat
   has been gone RETURN_WITHIN - the room plays the log again (check.js, a slice at a time) and that replay, not what
   either device says, decides: who won, the points, and a seat that sent a shot that does not fit (it loses). Then each
   player's vault is paid: coins (economy.js, ranked) and the new DAMA.
   A stand-in seat (a person-like computer player, lobby.js) is played by the other player's device: its shots come in
   from seat 0, marked for seat 1. It counts exactly as any game - the same DAMA, the same coins - so nothing, on the
   screen or in the numbers, tells a stand-in from a person (the owner's rule).

   Messages, as JSON. From a device: { t: 'aim', ... } (passed on as it is: the other screen shows the aiming),
   { t: 'shot', n, shot: { s, aim, V, a, b, el, inHand }, as? } (n: the shot's place in the log), { t: 'timeout', n },
   { t: 'end' } (this device saw the game end), { t: 'resign' }.
   To a device: { t: 'state', ... } on connecting (everything so far, to carry on after a reconnect), the other's
   'aim' / 'shot' / 'timeout', { t: 'away', seat } / { t: 'back', seat }, { t: 'result', winner, points, coins, dama, why }. */

export const RETURN_WITHIN = 30000;          // ms a seat may be gone before it loses

// a ranked game's rules (web/economy.js): what each game is played to
export const RANKED_RULES = E.RANKED_RULES;

export class RoomCore {
  // sql: the room's SQLite; send(seat, msg): to that seat's device, if it is there
  constructor(sql, send, tx) {
    this.sql = sql; this.send = send || (() => {}); this.tx = tx || (fn => fn());
    sql.exec(`CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS shots (n INTEGER PRIMARY KEY, body TEXT)`);
  }
  get(k, d) { const r = this.sql.exec(`SELECT v FROM kv WHERE k = ?`, k).toArray(); return r.length ? JSON.parse(r[0].v) : d; }
  set(k, v) { this.sql.exec(`INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v`, k, JSON.stringify(v)); }
  count() { return this.sql.exec(`SELECT COUNT(*) AS c FROM shots`).toArray()[0].c; }
  shots() { return this.sql.exec(`SELECT body FROM shots ORDER BY n`).toArray().map(r => JSON.parse(r.body)); }

  init(x) {
    if (this.get('room')) return false;
    const kind = x.kind === 'invite' ? 'invite' : 'ranked';
    this.set('room', { room: x.room, mode: x.mode, seed: x.seed >>> 0, first: x.first ? 1 : 0, standIn: x.standIn || null, at: Date.now(), kind,
      rules: kind === 'invite' ? E.inviteRules(x.mode, x.rules) : RANKED_RULES[x.mode] });
    this.set('seats', x.seats); this.set('status', 'playing'); this.set('ended', [false, false]); this.set('gone', [null, null]);
    return true;
  }
  seatOf(token) { const s = this.get('seats', []); return s.findIndex(q => q.token === token); }
  // what a device needs to play: the game, the other player, every shot so far
  state(seat) {
    const r = this.get('room'), s = this.get('seats'), o = s[1 - seat];
    return { t: 'state', seat, mode: r.mode, seed: r.seed, first: r.first, rules: r.rules || RANKED_RULES[r.mode], kind: r.kind || 'ranked', standIn: seat === 0 ? r.standIn : null,
      opp: { name: o.name, icon: o.icon, dama: o.dama, gear: o.gear || null }, shots: this.shots(), status: this.get('status'), result: this.get('result', null) };
  }
  connected(seat) {
    const gone = this.get('gone'); if (gone[seat]) { gone[seat] = null; this.set('gone', gone); this.send(1 - seat, { t: 'back', seat }); }
    this.send(seat, this.state(seat));
  }
  // a device went away: true when the room should look again in RETURN_WITHIN
  disconnected(seat) {
    if (this.get('status') !== 'playing') return false;
    const gone = this.get('gone'); gone[seat] = Date.now(); this.set('gone', gone); this.send(1 - seat, { t: 'away', seat }); return true;
  }
  // a message from a seat's device. Answers what the Durable Object should do next: 'check' (start the replay) or null
  message(seat, m) {
    if (!m || typeof m !== 'object' || this.get('status') !== 'playing') return null;
    const r = this.get('room'), other = 1 - seat;
    if (m.t === 'aim') { this.send(other, { t: 'aim', aim: +m.aim || 0, power: +m.power || 0, spin: m.spin && { x: +m.spin.x || 0, y: +m.spin.y || 0 }, el: +m.el || 0, pos: Array.isArray(m.pos) ? m.pos.slice(0, 2).map(Number) : null }); return null; }
    // how a shot came out on the device that struck it, for the other to check against (relayed as it is)
    if (m.t === 'res') { if (Number.isInteger(m.n) && m.st && typeof m.st === 'object') this.send(other, { t: 'res', n: m.n, st: m.st }); return null; }
    if (m.t === 'shot' || m.t === 'timeout') {
      // the stand-in's shots come from the other device; a shot's place must be the next one (a repeat is dropped)
      const as = r.standIn && seat === 0 && m.as === 1 ? 1 : seat;
      if (m.n !== this.count()) return null;
      if (this.count() >= 600) return this.over('too long');
      const body = m.t === 'timeout' ? { timeout: true, seat: as } : Object.assign({}, m.shot, { seat: as });
      this.sql.exec(`INSERT INTO shots (n, body) VALUES (?, ?)`, m.n, JSON.stringify(body));
      if (!(r.standIn && as === 1)) this.send(other, { t: m.t, n: m.n, shot: m.t === 'shot' ? body : undefined });
      return null;
    }
    if (m.t === 'end') {
      const e = this.get('ended'); e[seat] = true; if (r.standIn) e[1] = true; this.set('ended', e);
      return e[0] && e[1] ? this.over('ended') : null;
    }
    if (m.t === 'resign') return this.over('resigned', seat);
    return null;
  }
  // the room looked again: a seat gone too long loses
  timers() {
    if (this.get('status') !== 'playing') return null;
    const gone = this.get('gone'), now = Date.now();
    for (let s = 0; s < 2; s++) if (gone[s] && now - gone[s] >= RETURN_WITHIN) return this.over('left', s);
    return null;
  }
  over(why, loser) { this.set('status', 'checking'); this.set('end', { why, loser: loser == null ? null : loser }); return 'check'; }

  log() {
    const r = this.get('room'), rules = r.rules || RANKED_RULES[r.mode];
    return { v: 1, mode: r.mode, table: 'bar', seed: r.seed, opts: Object.assign({ first: r.first }, rules), shots: this.shots(), winner: 0, points: [0, 0] };
  }
  /* A slice of the replay. Returns true while there is more. At the end: who won and why - the replay's winner; else a seat
     that resigned, left or sent a shot that does not fit; else (the game stopped with no winner and nobody to blame) a
     draw - and the result is paid. */
  work(steps) {
    if (this.get('status') !== 'checking') return false;
    if (!this.job) { const cp = this.get('cp', null); this.job = { rp: new Replay(this.log(), cp, true), saved: cp ? cp.i : 0 }; }
    const out = this.job.rp.advance(steps);
    if (!out) { const c = this.job.rp.lastCp; if (c && c.i - this.job.saved >= 4) { this.set('cp', c); this.job.saved = c.i; } return true; }
    const end = this.get('end'), shots = this.shots(); this.job = null;
    let winner = null, why = end.why, points = out.points || this.get('cp', { points: [0, 0] }).points;
    if (!out.ok) { const bad = out.at != null && shots[out.at] ? shots[out.at].seat : null; if (bad != null) { winner = 1 - bad; why = 'a shot that does not fit'; } }
    else if (out.winner != null) { winner = out.winner; why = 'ended'; }
    if (winner == null && end.loser != null) winner = 1 - end.loser;
    this.result(winner, points, why);
    return false;
  }
  result(winner, points, why) {
    const r = this.get('room'), seats = this.get('seats'), res = { winner, points, why, coins: [0, 0], dama: [seats[0].dama, seats[1].dama] };
    const inv = r.kind === 'invite';
    if (winner != null) {
      if (!inv) res.dama = E.damaAfter(seats[0].dama, seats[1].dama, winner === 0);
      for (let s = 0; s < 2; s++) res.coins[s] = E.matchCoins(inv ? 'invite' : 'ranked', r.mode, s ? [points[1], points[0]] : points, winner === s);
    }
    this.set('result', res); this.set('status', 'done'); this.set('cp', null);
    this.sql.exec(`DELETE FROM shots`);
    for (let s = 0; s < 2; s++) this.send(s, Object.assign({ t: 'result' }, res, { seat: s }));
    return res;
  }
  // what each player's vault is told (the Durable Object sends it, again until the vault has it): coins, and DAMA as a change
  // (a player may have finished another game since this one began)
  payouts() {
    const res = this.get('result'), seats = this.get('seats'), r = this.get('room'), paid = this.get('paid', [false, false]);
    if (!res) return [];
    return [0, 1].filter(s => seats[s].acct && !paid[s]).map(s => ({ seat: s, acct: seats[s].acct,
      body: { room: r.room, mode: r.mode, kind: r.kind || 'ranked', won: res.winner === s, draw: res.winner == null, coins: res.coins[s], dama: res.dama[s] - seats[s].dama } }));
  }
  paid(seat) { const p = this.get('paid', [false, false]); p[seat] = true; this.set('paid', p); }
}

