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
const EMOTES = new Set(['grin', 'joy', 'wow', 'cool', 'think', 'sad', 'angry', 'love', 'sweat', 'wink', 'sleepy', 'thumbs', 'fire', 'poop', 'party', 'skull', 'heart']);
const arcAny = list => list[Math.floor(Math.random() * list.length)].id;   // (증강 당구: a card nobody gave - RoomCore.arcVote)
const range = waited => Math.min(240, 16 + 8 * waited / 1000);   // rating apart that is close enough, after waiting so long (ms)
const hex = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => b.toString(16).padStart(2, '0')).join('');

// The packed AI uses the same rating displayed by the lobby and used for settlement.
// (the names given lately, so the next ones are not the same: owner 11-09 - there were too many alike)
const RECENT_NAMES = [], recentNames = new Set();
export function standIn(dama, rnd) {
  const rating = Math.max(E.ECONOMY.DAMA_FLOOR, Math.round(dama + (rnd() - 0.5) * 32)), ai = E.createAI(null);
  let p = ai.rankedPersonaFor(rating, rnd);
  for (let k = 0; k < 12 && recentNames.has(p.name); k++) p = ai.rankedPersonaFor(rating, rnd);
  RECENT_NAMES.push(p.name); recentNames.add(p.name);
  while (RECENT_NAMES.length > 600) recentNames.delete(RECENT_NAMES.shift());
  return { ...p, rd: 150 };
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
    // (증강 당구's lobby: its rooms are arcade games - no DAMA, the vote and the augments: RoomCore)
    const kind = this.mode === 'arcade' ? 'arcade' : undefined;
    const init = { room, mode: this.mode, seed, first, standIn: persona, kind,
      seats: seats.map((s, i) => ({ acct: s.acct, token: tokens[i], name: s.name, icon: s.icon, dama: s.dama, rd: s.rd, gear: s.gear || null })) };
    const you = i => ({ room, seat: i, token: tokens[i], seed, first, mode: this.mode, table: ROOM_TABLE, kind, opp: pub(seats[1 - i]), standIn: i === 0 && persona ? persona : undefined });
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
// a listed room's game being played stays in the list (경기 중, to watch) this long at most - the room says when it ends
export const WATCH_KEEP = 45 * 60000;
// at most this many watching one game
export const WATCH_MAX = 30;
// a host away longer than INVITE_IDLE (the app in the background - a phone freezes a hidden page, so it cannot ask) is
// off the list and cannot be joined, but the code is kept this long for them: back, it is the same code (owner 11-09:
// "다른 창에 갔다 오면 초대 코드가 바뀜")
export const INVITE_KEEP = 10 * 60000;
const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export class InviteCore {
  constructor(now) { this.now = now || (() => Date.now()); this.codes = new Map(); this.deferReady = false; }
  sweep() {
    const t = this.now();
    for (const [c, v] of this.codes) {
      if (t - v.seen > (v.made ? (v.listed && v.made.ready ? WATCH_KEEP : 120000) : INVITE_KEEP)) { this.codes.delete(c); continue; }
      // (a friend seated who has stopped asking - the app closed - gets up after a minute)
      if (!v.made) for (let i = 1; i < v.size; i++) { const q = v.seats[i]; if (q && !q.bot && t - (q.seen || 0) > 60000) v.seats[i] = null; }
    }
  }
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
    this.played(p.acct);
    let code = had && had.code; if (!code) do { code = [...crypto.getRandomValues(new Uint8Array(6))].map(b => CODE_ABC[b % CODE_ABC.length]).join(''); } while (this.codes.has(code));
    const pw = typeof p.pw === 'string' && p.pw ? p.pw.slice(0, 12) : null;
    const title = String(p.title || '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, 16) || `${p.name || '플레이어'}의 방`;
    // (the host's seat 0, friends taking the others as they come - in 2:2 the computer in any the host gives it; the host
    // starts once every seat is filled and every friend in one is ready (owner 11-10: not as soon as a friend comes in).
    // Opened again with the same size, the seats are kept)
    const size = p.size === 4 ? 4 : 2, keep = had && had.size === size ? had.seats : null;
    const host = { acct: p.acct, dama: p.dama, name: p.name, icon: p.icon, gear: p.gear || null };
    this.codes.set(code, { code, mode: p.mode, rules: E.inviteRules(p.mode, p.rules), seen: this.now(), made: null, at: had ? had.at : this.now(),
      listed: !!p.listed, id: p.listed ? (had && had.id) || hex(6) : null, pw, tries: had && had.pw === pw ? had.tries : 0, title, size,
      seats: [host].concat(keep ? keep.slice(1) : Array(size - 1).fill(null)), host, kicked: had ? had.kicked : [] });
    return { ok: true, code, mode: p.mode, rules: this.codes.get(code).rules, listed: !!p.listed, lock: !!pw, title, size, seats: this.seatsOf(this.codes.get(code)) };
  }
  /* the rooms in the list, newest first: the game, its rules, the host, whether it has a password - those waiting for
     someone, and those being played (playing: the guest too), which may be watched */
  list() {
    this.sweep(); const out = [];
    for (const v of this.codes.values()) {
      if (!v.listed || (!v.made && this.away(v)) || (v.made && !v.made.ready)) continue;
      const r = { id: v.id, title: v.title, mode: v.mode, rules: v.rules, at: v.made ? v.made.at : v.at, lock: !!v.pw, host: { name: v.host.name, dama: v.host.dama, icon: v.host.icon } };
      r.filled = v.seats.filter(Boolean).length; if (v.size === 4) r.size = 4;
      if (!v.made && r.filled >= v.size) continue;                     // (full, waiting for its host to start: not for others)
      if (v.made) { r.playing = true; r.guest = { name: v.made.g.name, dama: v.made.g.dama, icon: v.made.g.icon }; if (v.size === 4) r.names = v.made.names; }
      out.push(r);
    }
    out.sort((a, b) => (a.playing ? 1 : 0) - (b.playing ? 1 : 0) || b.at - a.at); return { ok: true, rooms: out.slice(0, 60).map(r => { delete r.at; return r; }) };
  }
  // watching a listed game being played: its room and the watchers' key - with the password if the room has one
  watch(id, pw) {
    this.sweep();
    for (const v of this.codes.values()) {
      if (!v.listed || v.id !== id) continue;
      if (!v.made || !v.made.ready) return { ok: false, why: 'not playing' };
      if (v.pw) {
        if (v.tries >= 12) return { ok: false, why: 'locked' };
        if (pw !== v.pw) { v.tries++; return { ok: false, why: 'wrong password' }; }
      }
      return { ok: true, room: v.made.room, watch: v.made.watch, mode: v.mode };
    }
    return { ok: false, why: 'no such room' };
  }
  // a game ended (its room says so) or a player of it starting another: it leaves the list
  ended(room) { for (const [c, v] of this.codes) if (v.made && v.made.room === room) this.codes.delete(c); return { ok: true }; }
  played(acct) { for (const [c, v] of this.codes) if (v.made && (v.host.acct === acct || v.made.guest === acct || (v.made.accts || []).includes(acct))) this.codes.delete(c); }
  // a 2:2 room's seats as everyone in it sees them: who is in each (the computer, or empty)
  seatsOf(v) { return v.seats.map((q, i) => q ? (q.bot ? { bot: q.level || 2, name: q.name } : Object.assign({ name: q.name, icon: q.icon, dama: q.dama }, i ? { ready: !!q.ready } : {})) : null); }
  // the code of a listed room, for taking it from the list: with its password if it has one (a room tried wrong too often
  // closes to the list - the host's code still lets a friend in)
  byId(id, pw) {
    this.sweep();
    for (const v of this.codes.values()) {
      if (!v.listed || v.id !== id) continue;
      if (v.made) return { ok: false, why: v.made.ready ? 'playing' : 'taken' };
      if (this.away(v)) return { ok: false, why: 'away' };
      if (v.pw) {
        if (v.tries >= 12) return { ok: false, why: 'locked' };
        if (pw !== v.pw) { v.tries++; return { ok: false, why: 'wrong password' }; }
      }
      return { ok: true, code: v.code };
    }
    return { ok: false, why: 'no such room' };
  }
  // the host or a friend seated asking: still waiting - with the seats - or the game (the same answer until taken)
  ask(acct, code) {
    this.sweep(); const v = this.codes.get(code);
    const at = v ? v.seats.findIndex(q => q && !q.bot && q.acct === acct) : -1;
    if (!v || at < 0) return { ok: false, why: v && v.kicked.includes(acct) ? 'kicked' : 'gone' };
    if (at === 0) v.seen = this.now(); else v.seats[at].seen = this.now();
    if (v.made && v.made.ready) return Object.assign({ ok: true }, v.made.you[at]);
    return { ok: true, waiting: true, size: v.size, seat: at, seats: this.seatsOf(v) };
  }
  // 2:2: the host puts the computer in an empty seat (level 0-3), or takes it out
  bot(acct, code, seat, level) {
    const v = this.codes.get(code);
    if (!v || v.host.acct !== acct || v.size !== 4 || v.made) return { ok: false, why: 'gone' };
    if (!(seat >= 1 && seat <= 3) || (v.seats[seat] && !v.seats[seat].bot)) return { ok: false, why: 'taken' };
    v.seats[seat] = level == null || level < 0 ? null : { bot: true, level: Math.max(0, Math.min(3, level | 0)), name: '컴퓨터' };
    return { ok: true, seats: this.seatsOf(v) };
  }
  // what a code is (for the friend before joining): the game and who is waiting
  peek(code) { this.sweep(); const v = this.codes.get(code); return v && !v.made ? { ok: true, mode: v.mode, rules: v.rules, host: { name: v.host.name } } : { ok: false, why: 'no such code' }; }
  // p (a friend) takes a seat and waits there for the host to start
  join(p, code) {
    this.sweep(); const v = this.codes.get(code);
    if (!v) return { ok: false, why: 'no such code' };
    if (v.host.acct === p.acct) return { ok: false, why: 'your own code' };
    if (this.away(v)) return { ok: false, why: 'away' };
    if (v.kicked.includes(p.acct)) return { ok: false, why: 'kicked' };
    // a seat, and wait with the others for the host to start
    const at = v.seats.findIndex(q => q && !q.bot && q.acct === p.acct);
    if (v.made) return at < 0 ? { ok: false, why: 'taken' } : v.made.ready ? Object.assign({ ok: true }, v.made.you[at]) : { ok: false, why: 'opening' };
    if (at > 0) return { ok: true, waiting: true, size: v.size, seat: at, seats: this.seatsOf(v), code };
    const free = v.seats.findIndex((q, i) => i > 0 && !q);
    if (free < 0) return { ok: false, why: v.size === 4 ? 'full' : 'taken' };
    this.played(p.acct);
    v.seats[free] = { acct: p.acct, dama: p.dama, name: p.name, icon: p.icon, gear: p.gear || null, seen: this.now(), ready: false };
    return { ok: true, waiting: true, size: v.size, seat: free, seats: this.seatsOf(v), code };
  }
  // a friend seated says they are ready (or not)
  ready1(acct, code, on) {
    const v = this.codes.get(code), at = v && !v.made ? v.seats.findIndex(q => q && !q.bot && q.acct === acct) : -1;
    if (at < 1) return { ok: false, why: 'gone' };
    v.seats[at].ready = !!on; v.seats[at].seen = this.now();
    return { ok: true, waiting: true, size: v.size, seat: at, seats: this.seatsOf(v) };
  }
  // the host sends a friend away from a seat; they cannot take a seat in this room again
  kick(acct, code, seat) {
    const v = this.codes.get(code);
    if (!v || v.host.acct !== acct || v.made) return { ok: false, why: 'gone' };
    const q = v.seats[seat]; if (!(seat >= 1) || !q || q.bot) return { ok: false, why: 'empty' };
    v.kicked.push(q.acct); v.seats[seat] = null;
    return { ok: true, seats: this.seatsOf(v) };
  }
  // the host starts, every seat filled and every friend ready - the room's init is returned with the host's answer (the
  // lobby opens it). 2:2's sides: seats 0 and 2 against 1 and 3, as they sit; the computer's seats are played by the host's device.
  start(acct, code) {
    this.sweep(); const v = this.codes.get(code);
    if (!v || v.host.acct !== acct) return { ok: false, why: 'gone' };
    if (v.made) return v.made.ready ? Object.assign({ ok: true }, v.made.you[0]) : { ok: false, why: 'opening' };
    if (v.seats.some(q => !q)) return { ok: false, why: 'not full' };
    if (v.seats.some((q, i) => i && !q.bot && !q.ready)) return { ok: false, why: 'not ready' };
    const room = hex(16), watch = hex(16), seed = crypto.getRandomValues(new Uint32Array(1))[0], first = Math.random() < 0.5 ? 0 : 1, seats = v.seats, team = v.size === 4;
    const tokens = seats.map(() => hex(16)), pub = s => ({ name: s.name, icon: s.icon || 0, dama: s.dama, gear: s.gear || null, bot: s.bot ? s.level : undefined });
    const init = { room, watch, mode: v.mode, seed, first, standIn: null, kind: 'invite', rules: v.rules,
      seats: seats.map((s, i) => s.bot ? { acct: null, bot: true, level: s.level, token: tokens[i], name: s.name, icon: 0, dama: null, gear: null }
        : { acct: s.acct, token: tokens[i], name: s.name, icon: s.icon, dama: s.dama, rd: s.rd, gear: s.gear || null }) };
    const you = i => Object.assign({ room, seat: i, token: tokens[i], seed, first, mode: v.mode, table: ROOM_TABLE, kind: 'invite', rules: v.rules, opp: pub(seats[(i + 1) % seats.length]) }, team ? { team: seats.map(pub) } : {});
    v.made = { guest: team ? null : seats[1].acct, accts: seats.filter(s => !s.bot).map(s => s.acct), g: seats[1], names: team ? seats.map(s => s.name) : undefined, room, watch, at: this.now(), you: seats.map((s, i) => you(i)), ready: !this.deferReady }; v.seen = this.now();
    return Object.assign({ ok: true, init }, you(0));
  }
  ready(code) { const v = this.codes.get(code); if (v && v.made) v.made.ready = true; }
  unjoin(code) { const v = this.codes.get(code); if (v) v.made = null; }
  // the host closing the room; a friend getting up from their seat
  leave(acct, code) {
    const v = this.codes.get(code); if (!v || v.made) return { ok: true };
    if (v.host.acct === acct) this.codes.delete(code);
    else { const at = v.seats.findIndex(q => q && !q.bot && q.acct === acct); if (at > 0) v.seats[at] = null; }
    return { ok: true };
  }
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

/* 2:2 (a friend's room for four, InviteCore size 4): seats A1 0, B1 1, A2 2, B2 3 - a seat's side is seat % 2, and the
   sides are what wins and loses. A seat of the computer's (bot) is played by the host's device (seat 0), its shots sent
   'as' that seat, as a stand-in's are. Everything below takes 2 or 4 seats. */
const sideOf = seat => seat % 2;
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
    const kind = x.kind === 'invite' ? 'invite' : x.kind === 'arcade' && x.mode === 'arcade' ? 'arcade' : 'ranked', n = kind === 'invite' && x.seats.length === 4 ? 4 : 2, seats = x.seats.slice(0, n);
    const bots = seats.map((q, i) => q.bot && i > 0 ? i : -1).filter(i => i > 0);
    this.set('room', { room: x.room, mode: x.mode, seed: x.seed >>> 0, first: x.first ? 1 : 0, standIn: x.standIn || null, at: Date.now(), kind, watch: typeof x.watch === 'string' ? x.watch : null,
      rules: kind === 'invite' ? E.inviteRules(x.mode, x.rules) : RANKED_RULES[x.mode], team: n === 4, bots });
    this.set('seats', seats); this.set('status', 'playing'); this.set('ended', seats.map((q, i) => bots.includes(i))); this.set('gone', seats.map(() => null));
    this.set('joined', seats.map((q, i) => (i === 1 && !!x.standIn) || bots.includes(i))); this.set('joinBy', Date.now() + JOIN_WITHIN);
    // 증강 당구: the table's vote (a stand-in's card drawn now, unseen till both are in), then the augments' rounds
    if (kind === 'arcade') this.set('arc', { votes: [null, x.standIn ? arcAny(E.ARCADE.shapes) : null], shape: null, voteBy: null, done: [], open: null });
    return true;
  }
  // every seat but this one (to pass a message on)
  others(seat, msg) { const n = this.get('seats', []).length; for (let s = 0; s < n; s++) if (s !== seat) this.send(s, msg); this.send('w', msg); }
  seatOf(token) { const s = this.get('seats', []); return s.findIndex(q => q.token === token); }
  // a watcher's key (a listed friend's game: InviteCore.watch) - never a seat's
  watches(key) { const r = this.get('room'); return !!(r && r.watch && key && key === r.watch); }
  // what a watcher needs: the game, both players, every shot so far (seat 2: neither)
  watchState() {
    const r = this.get('room'), s = this.get('seats'), pub = o => ({ name: o.name, icon: o.icon, dama: o.dama, gear: o.gear || null });
    return { t: 'state', watch: true, seat: -1, team: r.team || undefined, mode: r.mode, seed: r.seed, first: r.first, rules: r.rules || RANKED_RULES[r.mode], kind: r.kind || 'ranked',
      seats: s.map(pub), shots: this.shots(), status: this.get('status'), result: this.get('result', null) };
  }
  // what a device needs to play: the game, the other player (in 2:2 every seat), every shot so far
  state(seat) {
    const r = this.get('room'), s = this.get('seats'), o = s[r.team ? (seat + 1) % 4 : 1 - seat], pub = q => ({ name: q.name, icon: q.icon, dama: q.dama, gear: q.gear || null, bot: q.bot ? (q.level || 2) : undefined });
    return { t: 'state', seat, mode: r.mode, seed: r.seed, first: r.first, rules: r.rules || RANKED_RULES[r.mode], kind: r.kind || 'ranked', standIn: seat === 0 ? r.standIn : null,
      opp: pub(o), team: r.team ? s.map(pub) : undefined, shots: this.shots(), status: this.get('status'), result: this.get('result', null), arc: this.arcState(seat) };
  }
  connected(seat) {
    const j = this.get('joined', [true, true]); if (!j[seat]) { j[seat] = true; this.set('joined', j); if (j.every(Boolean)) { this.set('turnAt', Date.now()); this.arcStart(); } }
    const gone = this.get('gone'); if (gone[seat]) { gone[seat] = null; this.set('gone', gone); this.others(seat, { t: 'back', seat }); }
    this.send(seat, this.state(seat));
  }
  // a device went away: true when the room should look again in RETURN_WITHIN
  disconnected(seat) {
    if (this.get('status') !== 'playing') return false;
    const gone = this.get('gone'); gone[seat] = Date.now(); this.set('gone', gone); this.others(seat, { t: 'away', seat }); return true;
  }
  // a message from a seat's device. Answers what the Durable Object should do next: 'check' (start the replay) or null
  message(seat, m) {
    if (!m || typeof m !== 'object' || this.get('status') !== 'playing') return null;
    const r = this.get('room'), other = 1 - seat, team = !!r.team;
    // a quick emote (web/app/59-emote.js): one of the known ones, passed on as it is, at most one a second and a half
    if (m.t === 'emote') {
      const id = typeof m.id === 'string' ? m.id : '', now = Date.now(), at = this.emoteAt || (this.emoteAt = [0, 0]);
      if (EMOTES.has(id) && now - at[seat] >= 1500) { at[seat] = now; this.others(seat, { t: 'emote', id, seat }); }
      return null;
    }
    if (m.t === 'aim') { const a = { t: 'aim', aim: +m.aim || 0, power: +m.power || 0, spin: m.spin && { x: +m.spin.x || 0, y: +m.spin.y || 0 }, el: +m.el || 0, pos: Array.isArray(m.pos) ? m.pos.slice(0, 2).map(Number) : null, seat }; this.others(seat, a); return null; }
    // how a shot came out on the device that struck it, for the other to check against (relayed as it is)
    if (m.t === 'res') { if (Number.isInteger(m.n) && m.st && typeof m.st === 'object') this.others(seat, { t: 'res', n: m.n, st: m.st }); return null; }
    if (m.t === 'vote' || m.t === 'pick') { this.arcHear(seat, m); return null; }
    // (증강 당구: nothing is played before the table is chosen)
    if ((m.t === 'shot' || m.t === 'timeout') && r.kind === 'arcade' && !(this.get('arc') || {}).shape) return null;
    if (m.t === 'shot' || m.t === 'timeout') {
      // the stand-in's shots come from the other device; a shot's place must be the next one (a repeat is dropped)
      // seat: whose turn it is played as; by: the device that sent it (a stand-in's shots are its player's device's to
      // answer for). A shot not of the right shape is never kept nor passed on: it ends the game against the device that
      // sent it (Codex B13). Only the fields a shot has are kept.
      const as = r.standIn && seat === 0 && m.as === 1 ? 1 : team && seat === 0 && (r.bots || []).includes(m.as) ? m.as : seat;
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
      const pass = { t: m.t, n: m.n, shot: m.t === 'shot' ? body : undefined };
      if (team) this.others(seat, pass); else { if (!(r.standIn && as === 1)) this.send(other, pass); this.send('w', pass); }
      return null;
    }
    if (m.t === 'end') {
      const e = this.get('ended'); e[seat] = true; if (r.standIn) e[1] = true; this.set('ended', e);
      return e.every(Boolean) ? this.over('ended') : null;
    }
    // (a stand-in's resignation comes from the other player's device - whom it lets win: it is checked against the game as
    // the room plays it again, see work)
    // (in 2:2 a player resigning gives the game up for their side; loser: a side)
    if (m.t === 'resign') return r.standIn && seat === 0 && m.as === 1 ? this.over('resigned', 1, true) : this.over('resigned', sideOf(seat));
    return null;
  }
  // the room looked again: a seat gone too long loses
  timers() {
    if (this.get('status') !== 'playing') return null;
    this.arcTimers();
    const gone = this.get('gone'), now = Date.now();
    for (let s = 0; s < gone.length; s++) if (gone[s] && now - gone[s] >= RETURN_WITHIN) return this.over('left', sideOf(s));
    // (never came in at all, by the time given: that seat's side loses - both sides missing someone, the game is nobody's)
    const j = this.get('joined', [true, true]), by = this.get('joinBy', 0);
    if (by && now >= by && !j.every(Boolean)) { const miss = [0, 1].filter(sd => j.some((x, i) => !x && sideOf(i) === sd)); return this.over('left', miss.length === 1 ? miss[0] : null); }
    // (all there, and nothing from anyone for IDLE_AFTER: whose turn it was is the replay's to say - work)
    if (j.every(Boolean) && !gone.some(Boolean) && now - this.get('turnAt', now) >= IDLE_AFTER) return this.over('idle');
    return null;
  }
  // when the room should look again for a turn gone quiet (both there), in ms from now; null when it need not
  idleIn() {
    const j = this.get('joined', [true, true]), gone = this.get('gone');
    if (this.get('status') !== 'playing' || !j.every(Boolean) || gone.some(Boolean)) return null;
    return Math.max(0, this.get('turnAt', Date.now()) + IDLE_AFTER - Date.now());
  }
  // still waiting for a seat to come in for the first time (the room looks again then)
  waitingJoin() { const j = this.get('joined', [true, true]); return this.get('status') === 'playing' && !j.every(Boolean) ? Math.max(0, this.get('joinBy', 0) - Date.now()) : null; }
  /* 증강 당구 (web/game.js ARCADE): the table's vote and the augments' picks, held by the room - kv 'arc':
     { votes: [seat 0's, seat 1's], shape, voteBy, done: [[a, b] for rounds 1, 2 ...], open: { k, picks, by } | null }.
     The vote's clock starts once both are in (each device shows the table first, then its cards: LEAD_MS); both voted, or
     its time and a little more gone, the table is chosen - a card not given is any of the three - and told to both
     ({ t: 'shape', id, votes }). A round opens with the first card picked for it (both devices reach it after the same
     shot); both picked, or PICK_MS and a little more gone, it closes - a card not picked is any of the seat's three - and
     both hear the two ({ t: 'picks', round, ids }). A card must be one the seat was dealt (ARCADE.deal). A stand-in's are
     drawn by the room. Each device hears only that the other has voted or picked ({ t: 'voted' | 'picked', seat }). */
  arcStart() {
    const a = this.get('arc'); if (!a || a.voteBy) return;
    a.voteBy = Date.now() + E.ARCADE.LEAD_MS + E.ARCADE.VOTE_MS + E.ARCADE.GRACE_MS; this.set('arc', a);
  }
  arcHear(seat, m) {
    const a = this.get('arc'), r = this.get('room'); if (!a || seat > 1) return;
    if (m.t === 'vote') {
      if (a.shape || a.votes[seat] || !E.ARCADE.shapes.some(c => c.id === m.id)) return;
      a.votes[seat] = m.id; this.set('arc', a); this.send(1 - seat, { t: 'voted', seat });
      if (a.votes.every(Boolean)) this.arcVote(a);
      return;
    }
    // a pick: for the round open, or the next one (which it opens)
    const k = m.round | 0, deal = E.ARCADE.deal(r.seed, k, seat);
    if (!a.shape || !deal.includes(m.id)) return;
    if (!a.open) {
      if (k !== a.done.length + 1) return;
      a.open = { k, picks: [null, r.standIn ? arcAny(E.ARCADE.deal(r.seed, k, 1).map(id => ({ id }))) : null], by: Date.now() + E.ARCADE.PICK_MS + E.ARCADE.GRACE_MS };
    }
    if (a.open.k !== k || a.open.picks[seat]) return;
    a.open.picks[seat] = m.id; this.set('arc', a); this.send(1 - seat, { t: 'picked', seat, round: k });
    if (a.open.picks.every(Boolean)) this.arcClose(a);
  }
  arcVote(a) {
    const v = a.votes.map(x => x || arcAny(E.ARCADE.shapes)), c = v[0] === v[1] ? [v[0]] : v;
    a.votes = v; a.shape = c[Math.floor(Math.random() * c.length)]; this.set('arc', a); this.set('turnAt', Date.now());
    this.others(-1, { t: 'shape', id: a.shape, votes: v });
  }
  arcClose(a) {
    const o = a.open, r = this.get('room'), ids = o.picks.map((x, s) => x || arcAny(E.ARCADE.deal(r.seed, o.k, s).map(id => ({ id }))));
    a.done.push(ids); a.open = null; this.set('arc', a); this.set('turnAt', Date.now());
    this.others(-1, { t: 'picks', round: o.k, ids });
  }
  // (the room looked again: a clock run out)
  arcTimers() {
    const a = this.get('arc'), now = Date.now(); if (!a) return;
    if (!a.shape && a.voteBy && now >= a.voteBy) this.arcVote(a);
    else if (a.open && now >= a.open.by) this.arcClose(a);
  }
  // when the room should look again for the vote or a round, in ms from now (null: no clock running)
  arcIn() { const a = this.get('arc'); if (!a || this.get('status') !== 'playing') return null; const t = !a.shape ? a.voteBy : a.open ? a.open.by : null; return t ? Math.max(0, t - Date.now()) : null; }
  // what a seat is told on coming in: the table if chosen (the votes with it), whether each has voted; the rounds picked;
  // the round open - this seat's own card in it, and whether the other has picked
  arcState(seat) {
    const a = this.get('arc'); if (!a) return undefined;
    return { shape: a.shape, votes: a.shape ? a.votes : null, voted: a.votes.map(Boolean), mine: a.shape ? null : a.votes[seat], voteIn: !a.shape && a.voteBy ? Math.max(0, a.voteBy - Date.now() - E.ARCADE.GRACE_MS) : null,
      done: a.done, open: a.open ? { k: a.open.k, mine: a.open.picks[seat], picked: a.open.picks.map(Boolean) } : null };
  }
  over(why, loser, standIn) { this.set('status', 'checking'); this.set('end', { why, loser: loser == null ? null : loser, standIn: !!standIn }); return 'check'; }

  log() {
    const r = this.get('room'), rules = r.rules || RANKED_RULES[r.mode];
    const cues = this.get('seats').map(q => (q.gear && typeof q.gear.cue === 'string' && q.gear.cue) || null);   // (check.js vMax)
    return { v: 1, mode: r.mode, table: r.table || ROOM_TABLE, seed: r.seed, opts: Object.assign({ first: r.first, team: !!r.team }, rules), cues, shots: this.shots(), winner: 0, points: [0, 0] };
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
    if (!out.ok) { const sh = out.at != null ? shots[out.at] : null, bad = sh ? (sh.by != null ? sh.by : sh.seat) : null; if (bad != null) { winner = 1 - sideOf(bad); why = 'a shot that does not fit'; } }
    else if (out.winner != null) { winner = out.winner; why = 'ended'; }
    else if (out.draw) why = 'draw';                                   // (4구's 후구 caught up: game.js)
    // gone quiet (timers, IDLE_AFTER): the seat whose turn it was loses - in a stand-in's game, the one device playing it
    else if (end.why === 'idle') { winner = this.get('room').standIn ? 1 : 1 - g.turn; }
    // a stand-in may give up only on its own turn and only when it is far behind (game.js farBehind) - the same rule its
    // own play follows. A resignation sent for it otherwise came from the player it would let win: that player loses.
    if (winner == null && why !== 'draw' && end.standIn && !standInMayResign(g)) { winner = 1; why = 'a resign that does not fit'; }
    if (winner == null && why !== 'draw' && end.loser != null) winner = 1 - end.loser;
    this.result(winner, points, why);
    return false;
  }
  // winner: a side (in 2 seats, the seat); coins and DAMA by seat
  result(winner, points, why) {
    const r = this.get('room'), seats = this.get('seats'), n = seats.length, res = { winner, points, why, coins: seats.map(() => 0), dama: seats.map(q => q.dama) };
    const inv = r.kind === 'invite', rated = !r.kind || r.kind === 'ranked';
    // (a draw in a friend's room pays each their points, as a loss would; a ranked game has no draws)
    // (증강 당구 moves no DAMA, and pays nothing yet - economy.js matchCoins knows no 'arcade')
    if (winner != null || (inv && why === 'draw')) {
      if (rated) { const r = E.damaAfter(seats[0].dama, seats[1].dama, winner === 0, seats[0].rd, seats[1].rd); res.dama = [r[0], r[1]]; res.rd = [r[2], r[3]]; }
      for (let s = 0; s < n; s++) res.coins[s] = seats[s].bot ? 0 : E.matchCoins(inv ? 'invite' : rated ? 'ranked' : r.kind, r.mode, sideOf(s) ? [points[1], points[0]] : points, winner === sideOf(s));
    }
    this.set('result', res); this.set('status', 'done'); this.set('cp', null);
    this.sql.exec(`DELETE FROM shots`);
    for (let s = 0; s < n; s++) this.send(s, Object.assign({ t: 'result' }, res, { seat: s }));
    this.send('w', Object.assign({ t: 'result' }, res, { seat: -1 }));
    return res;
  }
  // what each player's vault is told (the Durable Object sends it, again until the vault has it): coins, and DAMA as a change
  // (a player may have finished another game since this one began)
  payouts() {
    const res = this.get('result'), seats = this.get('seats'), r = this.get('room'), paid = this.get('paid', seats.map(() => false));
    if (!res) return [];
    return seats.map((q, s) => s).filter(s => seats[s].acct && !paid[s]).map(s => ({ seat: s, acct: seats[s].acct,
      body: { room: r.room, mode: r.mode, kind: r.kind || 'ranked', won: res.winner === sideOf(s), draw: res.winner == null, coins: res.coins[s], dama: res.dama[s] - seats[s].dama, rd: res.rd ? res.rd[s] : undefined } }));
  }
  paid(seat) { const p = this.get('paid', this.get('seats').map(() => false)); p[seat] = true; this.set('paid', p); }
}

