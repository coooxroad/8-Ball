/* Ranked games: the lobby that pairs players and the room a game is played in - their rules, testable in node.
   lobby.js and room.js are the Durable Objects that hold them. */
import { E, Replay } from './check.js';
import { shotError } from './match-log.js';

/* The ranked lobby: one Durable Object per game (8볼, 9볼, 4구, 3구). Players waiting for a ranked game ask it every couple
   of seconds; it pairs two whose DAMA is close, the range widening the longer they wait. Nobody close enough after a
   while - each player's own, drawn when they start waiting (standInDelay) - a stand-in takes the other seat - a person-like computer player (web/ai/), shown as a player like any
   other. A pair (or a player and a stand-in) get a room (room.js) and each a token for their seat.
   What is waiting is held in memory only: a lobby that restarts loses at most a few seconds of waiting. */

/* How long a player waits before a stand-in sits down, drawn for each player as they start waiting - always the same wait
   would give it away (owner's numbers): 30% of the time 10-20 s, 50% 20-30 s, 20% 30-60 s, evenly within each. */
export function standInDelay(rnd) {
  const u = rnd(), v = rnd();
  return Math.round(u < 0.3 ? 10000 + v * 10000 : u < 0.8 ? 20000 + v * 10000 : 30000 + v * 30000);
}
export const STAND_IN_AFTER = 60000;                  // ms of waiting after which a stand-in is always there (the longest standInDelay)
/* a waiting player not heard from for this long has left (and starts again from nothing). The app asks every two seconds;
   one slow answer, or a moment away from the app, must not set a long wait back to the start (it was 8 s). */
const GONE = 15000;
// the quick emotes a player may send in a game (web/app/59-emote.js EMOTES: the same ids)
const EMOTES = new Set(['hi', 'gl', 'nice', 'wow', 'lucky', 'close', 'oops', 'think', 'fire', 'cool', 'thx', 'gg', 'gj', 'lol', 'sad', 'sorry']);
const range = waited => Math.min(240, 16 + 8 * waited / 1000);   // rating apart that is close enough, after waiting so long (ms)
const hex = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => b.toString(16).padStart(2, '0')).join('');

// a stand-in: a person-like player near this DAMA. web/ai/51-people.js (personaFor) when it is there, else a plain one
const NAMES = ['큐잡이', '쓰리쿠션러', '빈쿠션왕', '당구장죽돌이', '하이런', 'cue_master7', '밀어치기장인', 'hall_kim', '사구사백', '대대러버',
  '끌어치기', '초크한통', 'bank88', '레일러너', '포켓헌터', 'side_spin', '중대고수', '저녁당구', 'nineball_j', '큐대한자루'];
export function standIn(dama, rnd) {
  const ai = E.createAI ? E.createAI(null) : null;
  // (a few points either side, as a person waiting at the same time would be; its skill from the rating on DAMA's old small
  // scale, which the people in web/ai are made for: 30 at the start, four times smaller steps; a settled rating's sureness)
  const d = Math.max(E.ECONOMY.DAMA_FLOOR, Math.round(dama + (rnd() - 0.5) * 32)), old = Math.max(10, Math.round(30 + (d - E.ECONOMY.DAMA_START) / 4));
  if (ai && ai.personaFor) return Object.assign(ai.personaFor(old, rnd), { dama: d, rd: 150 });
  return { name: NAMES[Math.floor(rnd() * NAMES.length)] + (rnd() < 0.4 ? Math.floor(rnd() * 90 + 10) : ''), icon: Math.floor(rnd() * 8), dama: d, rd: 150,
    level: old < 22 ? 0 : old < 40 ? 1 : 2 };      // (never the top level: it does not miss, and nobody is like that)
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
  /* deferReady: a pair's room is told it is open only once it is (lobby.js opens it, then ready(room); a failure: unpair) -
     until then those asking hear 'waiting'. Off in the tests of this core alone. */
  constructor(mode, now, delayOf) { this.mode = mode; this.now = now || (() => Date.now()); this.delayOf = delayOf || (() => standInDelay(Math.random)); this.wait = new Map(); this.made = new Map(); this.pending = new Map(); this.deferReady = false; }
  /* p: { acct, dama, name, icon, seek } asks again. Answers { waiting, waited } or the game it is in:
     { room, seat, token, seed, first, opp: { name, icon, dama }, standIn?: persona } - the same answer until it is taken.
     seek: the app's id for this one search. The room found is answered again (a lost answer, asked again) only to the same
     search; a new search - after a game ended, or given up - starts waiting afresh instead of being sent back to the old
     room. (No seek: as before, the same room for a minute.) */
  ask(p) {
    const t = this.now();
    for (const [k, m] of this.made) if (t - m.at > 60000) this.made.delete(k);
    const had = this.made.get(p.acct);
    if (had && (had.seek == null || p.seek == null || had.seek === p.seek)) return had.ready ? had.you : { waiting: true, waited: 0, opening: true };
    if (had) this.made.delete(p.acct);
    for (const [k, w] of this.wait) if (t - w.seen > GONE) this.wait.delete(k);
    let me = this.wait.get(p.acct);
    if (!me || (p.seek != null && me.seek != null && me.seek !== p.seek)) this.wait.set(p.acct, me = { acct: p.acct, dama: p.dama, rd: p.rd, name: p.name, icon: p.icon, gear: p.gear || null, since: t, standInAt: this.delayOf() });
    me.seen = t; me.name = p.name; me.icon = p.icon; me.gear = p.gear || null; me.seek = p.seek;
    // the closest of those close enough (by either one's wait)
    let best = null, bd = Infinity;
    for (const o of this.wait.values()) {
      if (o === me) continue;
      const d = Math.abs(o.dama - me.dama);
      if (d <= Math.max(range(t - me.since), range(t - o.since)) && d < bd) { bd = d; best = o; }
    }
    if (best) return this.pair(me, best, null, t);
    if (t - me.since >= Math.min(STAND_IN_AFTER, me.standInAt)) {
      const seedR = Math.random, persona = standIn(me.dama, seedR);
      return this.pair(me, { acct: null, dama: persona.dama, rd: persona.rd, name: persona.name, icon: persona.icon, gear: standInGear(seedR) }, persona, t);
    }
    return { waiting: true, waited: t - me.since };
  }
  leave(acct) { this.wait.delete(acct); }
  pair(a, b, persona, t) {
    this.wait.delete(a.acct); if (b.acct) this.wait.delete(b.acct);
    const room = hex(16), seed = crypto.getRandomValues(new Uint32Array(1))[0], first = Math.random() < 0.5 ? 0 : 1, seats = [a, b];
    const tokens = [hex(16), hex(16)], pub = s => ({ name: s.name, icon: s.icon, dama: s.dama, gear: s.gear || null });
    const init = { room, mode: this.mode, seed, first, standIn: persona,
      seats: seats.map((s, i) => ({ acct: s.acct, token: tokens[i], name: s.name, icon: s.icon, dama: s.dama, rd: s.rd, gear: s.gear || null })) };
    const you = i => ({ room, seat: i, token: tokens[i], seed, first, mode: this.mode, table: ROOM_TABLE, opp: pub(seats[1 - i]), standIn: i === 0 && persona ? persona : undefined });
    const ready = !this.deferReady;
    this.made.set(a.acct, { at: t, you: you(0), seek: a.seek, room, ready });
    if (b.acct) this.made.set(b.acct, { at: t, you: you(1), seek: b.seek, room, ready });
    this.pending.set(room, [a, b]);
    this.lastInit = init;
    return you(0);
  }
  // the room is open: those paired into it may hear of it
  ready(room) { this.pending.delete(room); for (const m of this.made.values()) if (m.room === room) m.ready = true; }
  // the room could not be opened: the pair is undone, and both go back to waiting as they were (their wait not lost)
  unpair(room) {
    const seats = this.pending.get(room) || []; this.pending.delete(room);
    for (const [k, m] of this.made) if (m.room === room) this.made.delete(k);
    for (const s of seats) if (s && s.acct) this.wait.set(s.acct, s);
  }
}

/* Games with an invited friend: the host opens a code (six letters and digits, nothing that reads two ways) and asks after
   it every couple of seconds; a friend who enters the code - or opens the link with it - takes the other seat, and a room
   opens as for a ranked game (kind 'invite': the host's rules, no DAMA). Held in memory in one Durable Object
   (the lobby named 'invites'); a code whose host has not asked for INVITE_IDLE is gone. */
export const INVITE_IDLE = 30000;
// a host away longer than INVITE_IDLE (the app in the background - a phone freezes a hidden page, so it cannot ask) is
// off the list and cannot be joined, but the code is kept this long for them: back, it is the same code (owner 11-09:
// "다른 창에 갔다 오면 초대 코드가 바뀜")
export const INVITE_KEEP = 10 * 60000;
const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export class InviteCore {
  constructor(now) { this.now = now || (() => Date.now()); this.codes = new Map(); this.deferReady = false; }
  sweep() { const t = this.now(); for (const [c, v] of this.codes) if (t - v.seen > (v.made ? 120000 : INVITE_KEEP)) this.codes.delete(c); }
  away(v) { return !v.made && this.now() - v.seen > INVITE_IDLE; }
  /* p: { acct, dama, name, icon, gear, mode, rules, listed, pw, title } - a host's code. A host keeps one code: opened
     again (other rules, a password, back from away) it is the same code with the new rules.
     listed: the room shows in the list of open rooms (방 참가하기) under an id of its own - never its code, so a room with a
     password (pw) can only be taken from the list with it; the code, given by the host, is the invitation and lets in
     without one. */
  open(p) {
    this.sweep();
    if (!E.RANKED_RULES[p.mode]) return { ok: false, why: 'no such game' };
    let had = null; for (const v of this.codes.values()) if (v.host.acct === p.acct && !v.made) had = v;
    let code = had && had.code; if (!code) do { code = [...crypto.getRandomValues(new Uint8Array(6))].map(b => CODE_ABC[b % CODE_ABC.length]).join(''); } while (this.codes.has(code));
    const pw = typeof p.pw === 'string' && p.pw ? p.pw.slice(0, 12) : null;
    const title = String(p.title || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 16) || `${p.name || '플레이어'}의 방`;
    this.codes.set(code, { code, mode: p.mode, rules: E.inviteRules(p.mode, p.rules), seen: this.now(), made: null, at: had ? had.at : this.now(),
      listed: !!p.listed, id: p.listed ? (had && had.id) || hex(6) : null, pw, tries: had && had.pw === pw ? had.tries : 0, title,
      host: { acct: p.acct, dama: p.dama, name: p.name, icon: p.icon, gear: p.gear || null } });
    return { ok: true, code, mode: p.mode, rules: this.codes.get(code).rules, listed: !!p.listed, lock: !!pw, title };
  }
  // the open rooms anyone may take from the list, newest first: the game, its rules, the host, whether it has a password
  list() {
    this.sweep(); const out = [];
    for (const v of this.codes.values()) if (v.listed && !v.made && !this.away(v)) out.push({ id: v.id, title: v.title, mode: v.mode, rules: v.rules, at: v.at, lock: !!v.pw, host: { name: v.host.name, dama: v.host.dama, icon: v.host.icon } });
    out.sort((a, b) => b.at - a.at); return { ok: true, rooms: out.slice(0, 40).map(r => { delete r.at; return r; }) };
  }
  // the code of a listed room, for taking it from the list: with its password if it has one (a room tried wrong too often
  // closes to the list - the host's code still lets a friend in)
  byId(id, pw) {
    this.sweep();
    for (const v of this.codes.values()) {
      if (!v.listed || v.id !== id) continue;
      if (v.made) return { ok: false, why: 'taken' };
      if (this.away(v)) return { ok: false, why: 'away' };
      if (v.pw) {
        if (v.tries >= 12) return { ok: false, why: 'locked' };
        if (pw !== v.pw) { v.tries++; return { ok: false, why: 'wrong password' }; }
      }
      return { ok: true, code: v.code };
    }
    return { ok: false, why: 'no such room' };
  }
  // the host asking: still waiting, or the game (the same answer until it is taken)
  ask(acct, code) {
    this.sweep(); const v = this.codes.get(code);
    if (!v || v.host.acct !== acct) return { ok: false, why: 'gone' };
    v.seen = this.now();
    return v.made && v.made.ready ? Object.assign({ ok: true }, v.made.you[0]) : { ok: true, waiting: true };
  }
  // what a code is (for the friend before joining): the game and who is waiting
  peek(code) { this.sweep(); const v = this.codes.get(code); return v && !v.made ? { ok: true, mode: v.mode, rules: v.rules, host: { name: v.host.name } } : { ok: false, why: 'no such code' }; }
  // p (the friend) takes the other seat: the room's init is returned with their answer (the lobby opens the room)
  join(p, code) {
    this.sweep(); const v = this.codes.get(code);
    if (!v) return { ok: false, why: 'no such code' };
    if (v.host.acct === p.acct) return { ok: false, why: 'your own code' };
    if (this.away(v)) return { ok: false, why: 'away' };
    if (v.made) return v.made.guest !== p.acct ? { ok: false, why: 'taken' } : v.made.ready ? Object.assign({ ok: true }, v.made.you[1]) : { ok: false, why: 'opening' };
    const room = hex(16), seed = crypto.getRandomValues(new Uint32Array(1))[0], first = Math.random() < 0.5 ? 0 : 1, seats = [v.host, { acct: p.acct, dama: p.dama, name: p.name, icon: p.icon, gear: p.gear || null }];
    const tokens = [hex(16), hex(16)], pub = s => ({ name: s.name, icon: s.icon, dama: s.dama, gear: s.gear || null });
    const init = { room, mode: v.mode, seed, first, standIn: null, kind: 'invite', rules: v.rules,
      seats: seats.map((s, i) => ({ acct: s.acct, token: tokens[i], name: s.name, icon: s.icon, dama: s.dama, rd: s.rd, gear: s.gear || null })) };
    const you = i => ({ room, seat: i, token: tokens[i], seed, first, mode: v.mode, table: ROOM_TABLE, kind: 'invite', rules: v.rules, opp: pub(seats[1 - i]) });
    v.made = { guest: p.acct, you: [you(0), you(1)], ready: !this.deferReady }; v.seen = this.now();
    return Object.assign({ ok: true, init }, you(1));
  }
  ready(code) { const v = this.codes.get(code); if (v && v.made) v.made.ready = true; }
  unjoin(code) { const v = this.codes.get(code); if (v) v.made = null; }
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

export const RETURN_WITHIN = 30000;
/* The pool table an online game is played on: the room's, the same on both devices and in the replay - never a player's own
   choice of table size (a 클럽 8피트 player's balls were not where the room's 7피트 replay put them: a fair shot judged
   foul play). */
export const ROOM_TABLE = 'bar';
// a seat that never comes into its room at all (the app closed as the game was found, the room never reached) loses after
// this long from the room's opening - not only one that came and went (RETURN_WITHIN). A stand-in's seat is always there.
export const JOIN_WITHIN = 45000;
/* The room's own shot clock (Codex B15): the app gives a turn RANKED_CLOCK (60 s, web/app/54-ranked.js) and then sends the
   turn's timeout itself - but an app whose screen stopped (sent to the back, frozen) while its connection stayed open sends
   nothing, and the other player would wait for ever. So when nothing at all has come - no shot, no timeout - for this long
   while both are there, the room ends the game, and the seat whose turn it was (as the replay finds it) loses. Long enough
   for any fair turn: the clock, the balls rolling, a connection's 30 s away (RETURN_WITHIN) and some over. */
export const IDLE_AFTER = 150000;
// the stand-in (seat 1) may resign here: its turn, and far behind (the replayed game, g)
export const standInMayResign = g => !!g && !g.over && g.turn === 1 && g.farBehind(1) > 0;          // ms a seat may be gone before it loses

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
    this.set('joined', [false, !!x.standIn]); this.set('joinBy', Date.now() + JOIN_WITHIN);
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
    const j = this.get('joined', [true, true]); if (!j[seat]) { j[seat] = true; this.set('joined', j); if (j[0] && j[1]) this.set('turnAt', Date.now()); }
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
    // a quick emote (web/app/59-emote.js): one of the known ones, passed on as it is, at most one a second and a half
    if (m.t === 'emote') {
      const id = typeof m.id === 'string' ? m.id : '', now = Date.now(), at = this.emoteAt || (this.emoteAt = [0, 0]);
      if (EMOTES.has(id) && now - at[seat] >= 1500) { at[seat] = now; this.send(other, { t: 'emote', id, seat }); }
      return null;
    }
    if (m.t === 'aim') { this.send(other, { t: 'aim', aim: +m.aim || 0, power: +m.power || 0, spin: m.spin && { x: +m.spin.x || 0, y: +m.spin.y || 0 }, el: +m.el || 0, pos: Array.isArray(m.pos) ? m.pos.slice(0, 2).map(Number) : null }); return null; }
    // how a shot came out on the device that struck it, for the other to check against (relayed as it is)
    if (m.t === 'res') { if (Number.isInteger(m.n) && m.st && typeof m.st === 'object') this.send(other, { t: 'res', n: m.n, st: m.st }); return null; }
    if (m.t === 'shot' || m.t === 'timeout') {
      // the stand-in's shots come from the other device; a shot's place must be the next one (a repeat is dropped)
      // seat: whose turn it is played as; by: the device that sent it (a stand-in's shots are its player's device's to
      // answer for). A shot not of the right shape is never kept nor passed on: it ends the game against the device that
      // sent it (Codex B13). Only the fields a shot has are kept.
      const as = r.standIn && seat === 0 && m.as === 1 ? 1 : seat;
      if (m.n !== this.count()) return null;
      if (this.count() >= 600) return this.over('too long');
      let body;
      if (m.t === 'timeout') body = { timeout: true, seat: as, by: seat };
      else {
        const q = m.shot; if (shotError(q, r.mode) || (q && q.timeout)) return this.over('a shot that does not fit', seat);
        body = { s: { cue: q.s.cue, ice: !!q.s.ice, balls: q.s.balls }, aim: q.aim, V: q.V, a: q.a, b: q.b, el: q.el || 0, inHand: !!q.inHand, seat: as, by: seat };
      }
      this.set('turnAt', Date.now());
      this.sql.exec(`INSERT INTO shots (n, body) VALUES (?, ?)`, m.n, JSON.stringify(body));
      if (!(r.standIn && as === 1)) this.send(other, { t: m.t, n: m.n, shot: m.t === 'shot' ? body : undefined });
      return null;
    }
    if (m.t === 'end') {
      const e = this.get('ended'); e[seat] = true; if (r.standIn) e[1] = true; this.set('ended', e);
      return e[0] && e[1] ? this.over('ended') : null;
    }
    // (a stand-in's resignation comes from the other player's device - whom it lets win: it is checked against the game as
    // the room plays it again, see work)
    if (m.t === 'resign') return r.standIn && seat === 0 && m.as === 1 ? this.over('resigned', 1, true) : this.over('resigned', seat);
    return null;
  }
  // the room looked again: a seat gone too long loses
  timers() {
    if (this.get('status') !== 'playing') return null;
    const gone = this.get('gone'), now = Date.now();
    for (let s = 0; s < 2; s++) if (gone[s] && now - gone[s] >= RETURN_WITHIN) return this.over('left', s);
    // (never came in at all, by the time given: that seat loses - both, and the game is nobody's)
    const j = this.get('joined', [true, true]), by = this.get('joinBy', 0);
    if (by && now >= by && !(j[0] && j[1])) return this.over('left', j[0] ? 1 : j[1] ? 0 : null);
    // (both there, and nothing from either for IDLE_AFTER: whose turn it was is the replay's to say - work)
    if (j[0] && j[1] && !gone[0] && !gone[1] && now - this.get('turnAt', now) >= IDLE_AFTER) return this.over('idle');
    return null;
  }
  // when the room should look again for a turn gone quiet (both there), in ms from now; null when it need not
  idleIn() {
    const j = this.get('joined', [true, true]), gone = this.get('gone');
    if (this.get('status') !== 'playing' || !(j[0] && j[1]) || gone.some(Boolean)) return null;
    return Math.max(0, this.get('turnAt', Date.now()) + IDLE_AFTER - Date.now());
  }
  // still waiting for a seat to come in for the first time (the room looks again then)
  waitingJoin() { const j = this.get('joined', [true, true]); return this.get('status') === 'playing' && !(j[0] && j[1]) ? Math.max(0, this.get('joinBy', 0) - Date.now()) : null; }
  over(why, loser, standIn) { this.set('status', 'checking'); this.set('end', { why, loser: loser == null ? null : loser, standIn: !!standIn }); return 'check'; }

  log() {
    const r = this.get('room'), rules = r.rules || RANKED_RULES[r.mode];
    const cues = this.get('seats').map(q => (q.gear && typeof q.gear.cue === 'string' && q.gear.cue) || null);   // (check.js vMax)
    return { v: 1, mode: r.mode, table: r.table || ROOM_TABLE, seed: r.seed, opts: Object.assign({ first: r.first }, rules), cues, shots: this.shots(), winner: 0, points: [0, 0] };
  }
  /* A slice of the replay. Returns true while there is more. At the end: who won and why - the replay's winner; else a seat
     that resigned, left or sent a shot that does not fit; else (the game stopped with no winner and nobody to blame) a
     draw - and the result is paid. */
  work(steps) {
    if (this.get('status') !== 'checking') return false;
    if (!this.job) { const cp = this.get('cp', null); this.job = { rp: new Replay(this.log(), cp, true), saved: cp ? cp.i : 0 }; }
    const out = this.job.rp.advance(steps);
    if (!out) { const c = this.job.rp.lastCp; if (c && c.i - this.job.saved >= 4) { this.set('cp', c); this.job.saved = c.i; } return true; }
    const end = this.get('end'), shots = this.shots(), g = this.job.rp.g; this.job = null;
    let winner = null, why = end.why, points = out.points || this.get('cp', { points: [0, 0] }).points;
    // (the device that sent a shot that does not fit loses: by, or for a shot kept before by was, its seat)
    if (!out.ok) { const sh = out.at != null ? shots[out.at] : null, bad = sh ? (sh.by != null ? sh.by : sh.seat) : null; if (bad != null) { winner = 1 - bad; why = 'a shot that does not fit'; } }
    else if (out.winner != null) { winner = out.winner; why = 'ended'; }
    // gone quiet (timers, IDLE_AFTER): the seat whose turn it was loses - in a stand-in's game, the one device playing it
    else if (end.why === 'idle') { winner = this.get('room').standIn ? 1 : 1 - g.turn; }
    // a stand-in may give up only on its own turn and only when it is far behind (game.js farBehind) - the same rule its
    // own play follows. A resignation sent for it otherwise came from the player it would let win: that player loses.
    if (winner == null && end.standIn && !standInMayResign(g)) { winner = 1; why = 'a resign that does not fit'; }
    if (winner == null && end.loser != null) winner = 1 - end.loser;
    this.result(winner, points, why);
    return false;
  }
  result(winner, points, why) {
    const r = this.get('room'), seats = this.get('seats'), res = { winner, points, why, coins: [0, 0], dama: [seats[0].dama, seats[1].dama] };
    const inv = r.kind === 'invite';
    if (winner != null) {
      if (!inv) { const r = E.damaAfter(seats[0].dama, seats[1].dama, winner === 0, seats[0].rd, seats[1].rd); res.dama = [r[0], r[1]]; res.rd = [r[2], r[3]]; }
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
      body: { room: r.room, mode: r.mode, kind: r.kind || 'ranked', won: res.winner === s, draw: res.winner == null, coins: res.coins[s], dama: res.dama[s] - seats[s].dama, rd: res.rd ? res.rd[s] : undefined } }));
  }
  paid(seat) { const p = this.get('paid', [false, false]); p[seat] = true; this.set('paid', p); }
}

