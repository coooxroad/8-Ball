/* One player's vault: coins, diamonds, what they own, DAMA, the puzzles they were paid for. Each account is one Durable
   Object, and a Durable Object handles one request at a time - so a balance is read, checked and changed with nothing in
   between (no paying twice by sending two requests at once). Every change also carries the app's own request number:
   the same number again gets the first answer back and changes nothing (no paying twice by sending one request twice).
   The app never says how much it has; it says what it did, and this decides what that is worth.
   `sql` is the Durable Object's SQLite (ctx.storage.sql) - or, in the tests, node's. */
import { E, playPuzzle, playMatch, playLesson, Replay, DRILLS } from './check.js';
import { logError, matchKey } from './match-log.js';

const KINDS = { cue: E.CUES, ball: E.BALLSKINS, table: E.CLOTHS, trail: E.TRAILS, glove: E.GLOVES };
const day = () => new Date().toISOString().slice(0, 10);
export const MAX_DEVICES = 8;

export class VaultCore {
  // tx(fn): runs fn as one transaction - all of it happens or none (ctx.storage.transactionSync in the Durable Object)
  constructor(sql, env, tx) {
    this.sql = sql; this.env = env || {}; this.tx = tx || (fn => fn());
    sql.exec(`CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS owned (kind TEXT, id TEXT, at INTEGER, PRIMARY KEY (kind, id))`);
    sql.exec(`CREATE TABLE IF NOT EXISTS solved (id INTEGER PRIMARY KEY, at INTEGER)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS reqs (req TEXT PRIMARY KEY, res TEXT, at INTEGER)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS match_claims (digest TEXT PRIMARY KEY, at INTEGER)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS daily (day TEXT PRIMARY KEY, coins INTEGER)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS matches (n INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER, kind TEXT, mode TEXT, log TEXT, paid INTEGER, checked INTEGER, status TEXT, cp TEXT, why TEXT)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS ledger (n INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER, what TEXT, coin INTEGER, dia INTEGER)`);
  }
  get(k, d) { const r = this.sql.exec(`SELECT v FROM kv WHERE k = ?`, k).toArray(); return r.length ? JSON.parse(r[0].v) : d; }
  set(k, v) { this.sql.exec(`INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v`, k, JSON.stringify(v)); }
  // money moves only through here, and every move is written down
  pay(what, coin, dia) {
    const c = this.get('coin', 0) + (coin || 0), d = this.get('dia', 0) + (dia || 0);
    if (c < 0 || d < 0) throw new Error('not enough');
    this.set('coin', c); this.set('dia', d);
    this.sql.exec(`INSERT INTO ledger (at, what, coin, dia) VALUES (?, ?, ?, ?)`, Date.now(), what, coin || 0, dia || 0);
  }

  init(secretHash) { if (this.get('secret')) return false; this.set('secret', secretHash); this.set('since', Date.now()); this.set('dama', E.ECONOMY.DAMA_START); this.set('rd', E.ECONOMY.RD_START); this.set('r5', 1); return true; }
  // (any of the account's keys opens it: the first device's, and each device linked since - link.js, devices)
  authed(secretHash) { const s = this.get('secret'); return !!s && (s === secretHash || this.get('devices', []).some(d => d.h === secretHash)); }
  // another device linked to this account: its key's hash (from the front door, never from a device). At most MAX_DEVICES
  // besides the first; the longest unused goes when there would be more.
  addDevice(secretHash) {
    if (!this.get('secret') || typeof secretHash !== 'string' || !/^[0-9a-f]{64}$/.test(secretHash)) return { ok: false, why: 'bad device' };
    const d = this.get('devices', []).filter(x => x.h !== secretHash); d.push({ h: secretHash, at: Date.now() });
    while (d.length > MAX_DEVICES) d.shift();
    this.set('devices', d); return { ok: true, devices: 1 + d.length };
  }
  known(kind, id) { return (KINDS[kind] || []).some(q => q.id === id); }
  owns(kind, id) { const it = (KINDS[kind] || []).find(q => q.id === id); return !!it && (!(it.rarity > 0) || this.sql.exec(`SELECT 1 FROM owned WHERE kind = ? AND id = ?`, kind, id).toArray().length > 0); }
  me() {
    // (one read for everything owned; the 일반 things are everyone's)
    const bought = new Set(this.sql.exec(`SELECT kind, id FROM owned`).toArray().map(r => r.kind + ':' + r.id)), owned = {};
    for (const k in KINDS) owned[k] = KINDS[k].filter(q => !(q.rarity > 0) || bought.has(k + ':' + q.id)).map(q => q.id);
    /* 5.0: the rating went from DAMA's small scale (started at 30, an even game moving 3) to chess.com's (500, Glicko -
       economy.js); an account from before is moved over once, its distance from the start kept at four times the size,
       and a little surer than a new one (it has played). (An account from the very first days, at 1000, starts again.) */
    if (!this.get('r5')) { const old = this.get('dama', null);
      if (old != null) { this.set('dama', old >= 1000 ? E.ECONOMY.DAMA_START : Math.max(E.ECONOMY.DAMA_FLOOR, Math.round(E.ECONOMY.DAMA_START + (old - 30) * 4))); this.set('rd', old >= 1000 ? E.ECONOMY.RD_START : 250); }
      this.set('r5', 1); }
    return { coin: this.get('coin', 0), dia: this.get('dia', 0), dama: this.get('dama', E.ECONOMY.DAMA_START), rd: Math.round(this.rd()), owned, devices: 1 + this.get('devices', []).length,
      prizes: Object.keys(E.ECONOMY.LESSON_PRIZE).filter(v => this.get('prize:' + v)),
      // a member (signed up with Google: link.js) and their nickname; the tutorial's prize taken; the progress kept here
      // for the account's other devices (the app's own: lessons, puzzles - save())
      joined: !!this.get('joined'), nick: this.get('nick', null), tut: !!this.get('tut'), save: this.get('save', null),
      // debug mode, turned on for this account in the admin console (adminGrant debug): the app's 디버그 settings
      debug: !!this.get('debug'),
      checking: this.sql.exec(`SELECT COUNT(*) AS c FROM matches WHERE status = 'checking'`).toArray()[0].c,
      solved: this.sql.exec(`SELECT id FROM solved`).toArray().map(r => r.id) };
  }

  // a change the app asked for: once per request number
  once(req, fn) {
    if (typeof req !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(req)) return { ok: false, why: 'no request number' };
    return this.tx(() => {
      const had = this.sql.exec(`SELECT res FROM reqs WHERE req = ?`, req).toArray();
      if (had.length) return JSON.parse(had[0].res);
      const res = fn(), keep = Object.assign({}, res); delete keep.me;
      // A failed receipt write must roll back the payment too. Operational errors propagate so the client can retry.
      this.sql.exec(`INSERT INTO reqs (req, res, at) VALUES (?, ?, ?)`, req, JSON.stringify(keep), Date.now());
      if (Math.random() < 0.02) this.sql.exec(`DELETE FROM reqs WHERE at < ?`, Date.now() - 14 * 864e5);
      return res;
    });
  }

  buy({ req, kind, id }) {
    return this.once(req, () => {
      const it = (KINDS[kind] || []).find(q => q.id === id);
      if (!it) return { ok: false, why: 'no such item' };
      if (it.reward) return { ok: false, why: 'a lesson reward, not for sale' };
      if (this.owns(kind, id)) return { ok: false, why: 'already owned' };
      const price = E.priceOf(it);
      if (this.get('coin', 0) < (price.coin || 0) || this.get('dia', 0) < (price.dia || 0)) return { ok: false, why: 'not enough' };
      this.pay(`buy ${kind}:${id}`, -(price.coin || 0), -(price.dia || 0));
      this.sql.exec(`INSERT INTO owned (kind, id, at) VALUES (?, ?, ?)`, kind, id, Date.now());
      return { ok: true, me: this.me() };
    });
  }

  // a puzzle solved (perhaps offline, days ago): checked by playing the shot again, paid the first time only
  puzzle({ req, id, shot }) {
    return this.once(req, () => {
      if (this.sql.exec(`SELECT 1 FROM solved WHERE id = ?`, id).toArray().length) return { ok: true, paid: 0, me: this.me() };
      const r = playPuzzle(id, shot); if (!r.ok) return { ok: false, why: r.why };
      this.sql.exec(`INSERT INTO solved (id, at) VALUES (?, ?)`, id, Date.now());
      this.pay(`puzzle ${id}`, E.ECONOMY.PUZZLE, 0);
      return { ok: true, paid: E.ECONOMY.PUZZLE, me: this.me() };
    });
  }

  // how sure this account's rating is now: as last set, less sure for every day since its last ranked game (economy.js)
  rd() { return E.rdNow(this.get('rd', E.ECONOMY.RD_START), (Date.now() - this.get('rdAt', Date.now())) / 86400000); }
  // a game's result from its room (room.js), once per room: coins, the change in DAMA and how sure it is now - a ranked
  // game, or one with an invited friend (kind 'invite': no DAMA).
  ranked({ room, mode, won, draw, coins, dama, kind, rd }) {
    if (typeof room !== 'string' || !/^[0-9a-f]{32}$/.test(room)) return { ok: false, why: 'no room' };
    return this.once('room-' + room, () => {
      // (증강 당구 - kind 'arcade' - moves no DAMA either, and is kept as its own kind)
      const inv = kind === 'invite' || kind === 'arcade', c = Math.max(0, Math.min(20000, coins | 0)), d = inv ? 0 : Math.max(-E.ECONOMY.DAMA_STEP_MAX, Math.min(E.ECONOMY.DAMA_STEP_MAX, dama | 0));
      this.set('dama', Math.max(E.ECONOMY.DAMA_FLOOR, this.get('dama', E.ECONOMY.DAMA_START) + d));
      if (!inv && Number.isFinite(rd)) { this.set('rd', Math.max(E.ECONOMY.RD_MIN, Math.min(E.ECONOMY.RD_MAX, rd))); this.set('rdAt', Date.now()); }
      this.sql.exec(`INSERT INTO matches (at, kind, mode, log, paid, checked, status) VALUES (?, ?, ?, NULL, ?, 1, ?)`, Date.now(), kind === 'arcade' ? 'arcade' : inv ? 'invite' : 'ranked', mode, c, draw ? 'draw' : won ? 'won' : 'lost');
      if (c) this.pay(`${kind === 'arcade' ? 'arcade' : inv ? 'invite' : 'ranked'} ${mode}`, c, 0);
      return { ok: true };
    });
  }
  /* A game's volume of lessons, every one done at its top level: each checked by playing its shot again (check.js
     playLesson), then the prize (economy.js LESSON_PRIZE), once. proofs: { [lesson id]: { table, seed, shot } } */
  // signing up: once per account, its prize (from the front door only, when a Google account is tied to this one the
  // first time - index.js linkRoute)
  joinPrize() {
    if (this.get('joined')) return { ok: true, paid: null };
    const p = E.ECONOMY.SIGNUP_PRIZE; this.set('joined', Date.now()); this.pay('signup', p.coin || 0, p.dia || 0);
    return { ok: true, paid: { coin: p.coin || 0, dia: p.dia || 0 } };
  }
  /* The admin console (index.js /v1/admin, web/admin.html, /admin on the site): everything about this account at a look, and what an admin
     gives or sets - coins and diamonds (either way, never below nothing), an item, the rating - each written in the ledger
     with who did it and why. And the account's debug mode (debug: true | false) - the app shows its debug settings. */
  adminView() {
    const me = this.me(), led = this.sql.exec(`SELECT at, what, coin, dia FROM ledger ORDER BY n DESC LIMIT 30`).toArray();
    const games = this.sql.exec(`SELECT at, kind, mode, paid, status FROM matches ORDER BY n DESC LIMIT 20`).toArray();
    const bought = this.sql.exec(`SELECT kind, id, at FROM owned ORDER BY at DESC`).toArray();
    return { ok: true, me: Object.assign({}, me, { save: undefined }), since: this.get('since', 0), ledger: led, games, bought, admin: this.get('adminLog', []) };
  }
  adminGrant({ by, why, coin, dia, kind, id, dama, take, debug }) {
    const note = `${String(by || 'admin').slice(0, 40)}${why ? ' · ' + String(why).slice(0, 80) : ''}`, did = [];
    // (all of it checked before any of it is done: a refusal leaves the account as it was)
    const v = dama != null && dama !== '' ? Math.round(+dama) : null;
    if (v != null && (!Number.isFinite(v) || v < E.ECONOMY.DAMA_FLOOR || v > 5000)) return { ok: false, why: 'bad rating' };
    if (kind && !this.known(kind, id)) return { ok: false, why: 'no such item' };
    return this.tx(() => {
      const c = coin | 0, d = dia | 0;
      if (c || d) {
        if (Math.abs(c) > 10000000 || Math.abs(d) > 1000000) return { ok: false, why: 'too much' };
        if (this.get('coin', 0) + c < 0 || this.get('dia', 0) + d < 0) return { ok: false, why: 'not enough' };
        this.pay(note, c, d); did.push(`coin ${c} dia ${d}`);
      }
      if (kind) {
        const it = (KINDS[kind] || []).find(q => q.id === id);
        if (take) { this.sql.exec(`DELETE FROM owned WHERE kind = ? AND id = ?`, kind, id); did.push(`took ${kind} ${id}`); }
        else if (it.rarity > 0 && !this.owns(kind, id)) { this.sql.exec(`INSERT INTO owned (kind, id, at) VALUES (?, ?, ?)`, kind, id, Date.now()); did.push(`gave ${kind} ${id}`); }
      }
      if (v != null) {
        did.push(`dama ${this.get('dama', E.ECONOMY.DAMA_START)} -> ${v}`); this.set('dama', v);
      }
      if (typeof debug === 'boolean' && debug !== !!this.get('debug')) { this.set('debug', debug); did.push(`debug ${debug ? 'on' : 'off'}`); }
      if (!did.length) return { ok: false, why: 'nothing to do' };
      const log = this.get('adminLog', []); log.unshift({ at: Date.now(), by: String(by || ''), why: String(why || ''), did: did.join(', ') }); this.set('adminLog', log.slice(0, 50));
      return { ok: true, did, me: this.me() };
    });
  }
  // the name the others see: 2 to 10 characters, no control characters, spaces closed up
  nick({ nick }) {
    const n = String(nick || '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim(), len = [...n].length;
    if (len < 2 || len > 10) return { ok: false, why: 'nick length' };
    this.set('nick', n); return { ok: true, me: this.me() };
  }
  // the tutorial done: its prize, once per account
  tutorial({ req }) {
    return this.once(req, () => {
      if (this.get('tut')) return { ok: true, paid: 0, me: this.me() };
      const p = E.ECONOMY.TUTORIAL_PRIZE; this.set('tut', Date.now());
      if (p.coin) this.pay('tutorial', p.coin, 0);
      if (p.id && !this.owns(p.kind, p.id)) this.sql.exec(`INSERT INTO owned (kind, id, at) VALUES (?, ?, ?)`, p.kind, p.id, Date.now());
      return { ok: true, paid: p.coin || 0, item: p.id ? { kind: p.kind, id: p.id } : null, me: this.me() };
    });
  }
  // the app's progress, kept for the account's other devices: a small object, as the app gives it
  save({ data }) {
    const s = JSON.stringify(data == null ? null : data); if (s.length > 16000) return { ok: false, why: 'too big' };
    this.set('save', data == null ? null : JSON.parse(s)); return { ok: true };
  }
  lessons({ req, vol, proofs }) {
    return this.once(req, () => {
      const prize = E.ECONOMY.LESSON_PRIZE[vol]; if (!prize) return { ok: false, why: 'no prize for that' };
      if (this.get('prize:' + vol)) return { ok: true, paid: 0, me: this.me() };
      const ids = DRILLS.list.filter(d => d.make && d.vol === vol).map(d => d.id);
      if (!ids.length) return { ok: false, why: 'no lessons yet' };
      for (const id of ids) { const r = playLesson(id, proofs && proofs[id]); if (!r.ok) return { ok: false, why: `${id}: ${r.why}` }; }
      this.set('prize:' + vol, Date.now());
      if (prize.coin) this.pay(`lessons ${vol}`, prize.coin, 0);
      if (prize.id && !this.owns(prize.kind, prize.id)) this.sql.exec(`INSERT INTO owned (kind, id, at) VALUES (?, ?, ?)`, prize.kind, prize.id, Date.now());
      return { ok: true, paid: prize.coin || 0, item: prize.id ? { kind: prize.kind, id: prize.id } : null, me: this.me() };
    });
  }

  /* A match played on the device - with a friend on it, or against the computer. CHECK_MATCHES says how it is checked:
       "slices": it is queued, played again a few hundred physics steps per request (work(), driven by the
                 Durable Object's alarm), and paid when the replay reaches the end - seconds to a minute later;
       "true":   played again at once and paid in the answer;
       "false":  paid by what the app says, kept within sense and a daily allowance, and stored. */
  match({ req, kind, log }) {
    return this.once(req, () => {
      if (kind !== 'friend' && kind !== 'cpu') return { ok: false, why: 'not a match played on the device' };
      const why = logError(log); if (why) return { ok: false, why };
      const digest = matchKey(log);
      if (this.sql.exec(`SELECT 1 FROM match_claims WHERE digest = ?`, digest).toArray().length) return { ok: false, why: 'match already submitted', me: this.me() };
      this.sql.exec(`INSERT INTO match_claims (digest, at) VALUES (?, ?)`, digest, Date.now());
      if (this.env.CHECK_MATCHES === 'slices') {
        // which to play again (economy.js): a share chosen at random, every big one, a new account's first, all of a caught one
        const X = E.ECONOMY, said = E.matchCoins(kind, log.mode, Array.isArray(log.points) ? log.points : [0, 0], log.winner === 0);
        const done = this.sql.exec(`SELECT COUNT(*) AS c FROM matches`).toArray()[0].c;
        if (this.get('caught') || said > X.CHECK_OVER || done < X.CHECK_FIRST || Math.random() < X.CHECK_SHARE) {
          this.sql.exec(`INSERT INTO matches (at, kind, mode, log, paid, checked, status) VALUES (?, ?, ?, ?, 0, 0, 'checking')`, Date.now(), kind, log.mode, JSON.stringify(log));
          return { ok: true, pending: true, me: this.me() };
        }
      }
      const check = this.env.CHECK_MATCHES === 'true';
      let points, won;
      if (check) { const r = playMatch(log); if (!r.ok) return { ok: false, why: r.why }; points = r.points; won = r.winner === 0; }
      else {
        points = Array.isArray(log.points) ? log.points.map(p => Math.max(0, Math.min(60, p | 0))) : [0, 0]; won = log.winner === 0;
        // A legal pool shot can pot several balls. Carom still allows only one point per non-timeout shot.
        const perShot = log.mode === 'eight' ? 15 : log.mode === 'nine' ? 9 : 1;
        if (log.shots.filter(s => s.timeout !== true).length * perShot < points[0] + points[1]) points = [0, 0];
      }
      let coins = E.matchCoins(kind, log.mode, points, won);
      if (!check) {
        const d = day(), had = (this.sql.exec(`SELECT coins FROM daily WHERE day = ?`, d).toArray()[0] || {}).coins || 0;
        coins = Math.max(0, Math.min(coins, E.ECONOMY.UNCHECKED_DAILY - had));
        this.sql.exec(`INSERT INTO daily (day, coins) VALUES (?, ?) ON CONFLICT(day) DO UPDATE SET coins = coins + excluded.coins`, d, coins);
      }
      this.sql.exec(`INSERT INTO matches (at, kind, mode, log, paid, checked, status) VALUES (?, ?, ?, ?, ?, ?, 'paid')`, Date.now(), kind, log.mode, null, coins, check ? 1 : 0);   // (the result is kept, not the log)
      if (coins) this.pay(`match ${kind} ${log.mode}`, coins, 0);
      return { ok: true, paid: coins, checked: check, me: this.me() };
    });
  }

  /* One slice of checking the queued matches: at most `steps` physics steps. The replay in hand stays in memory between
     slices; at every shot it finishes, where it got to is written down, so a fresh start carries on from there. A match
     that plays out as the app said is paid; one that does not is turned down (and kept, with why). Says whether there is
     more to do. */
  work(steps) {
    const row = this.sql.exec(`SELECT n, kind, log, cp FROM matches WHERE status = 'checking' ORDER BY n LIMIT 1`).toArray()[0];
    if (!row) return false;
    let log, out;
    try {
      log = JSON.parse(row.log);
      if (!this.job || this.job.n !== row.n) this.job = { n: row.n, saved: row.cp ? JSON.parse(row.cp).i : 0, rp: new Replay(log, row.cp ? JSON.parse(row.cp) : null) };
      out = this.job.rp.advance(steps);
    } catch (e) { out = { ok: false, why: 'invalid replay data' }; }                // old/corrupt queue entries must not block the next match
    const job = this.job;
    if (!out) {
      // where it got to, written down every few shots (a restart replays at most those few)
      const c = job.rp.lastCp; if (c && c.i - job.saved >= 4) { this.sql.exec(`UPDATE matches SET cp = ? WHERE n = ?`, JSON.stringify(c), row.n); job.saved = c.i; }
      return true;
    }
    this.tx(() => {
      // one that does not play out as the app said: turned down, and from now on every match of this account is checked
      if (!out.ok) { this.sql.exec(`UPDATE matches SET status = 'rejected', why = ?, cp = NULL, log = NULL WHERE n = ?`, out.why, row.n); this.set('caught', Date.now()); return; }
      const coins = E.matchCoins(row.kind, log.mode, out.points, out.winner === 0);
      this.sql.exec(`UPDATE matches SET status = 'paid', paid = ?, checked = 1, cp = NULL, log = NULL WHERE n = ?`, coins, row.n);
      if (coins) this.pay(`match ${row.kind} ${log.mode}`, coins, 0);
    });
    this.job = null;                                                          // retain the finished replay if the transaction fails
    return this.sql.exec(`SELECT 1 FROM matches WHERE status = 'checking' LIMIT 1`).toArray().length > 0;
  }
}
