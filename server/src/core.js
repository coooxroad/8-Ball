/* One player's vault: coins, diamonds, what they own, DAMA, the puzzles they were paid for. Each account is one Durable
   Object, and a Durable Object handles one request at a time - so a balance is read, checked and changed with nothing in
   between (no paying twice by sending two requests at once). Every change also carries the app's own request number:
   the same number again gets the first answer back and changes nothing (no paying twice by sending one request twice).
   The app never says how much it has; it says what it did, and this decides what that is worth.
   `sql` is the Durable Object's SQLite (ctx.storage.sql) - or, in the tests, node's. */
import { E, playPuzzle, playMatch, Replay } from './check.js';

const KINDS = { cue: E.CUES, ball: E.BALLSKINS, table: E.CLOTHS, trail: E.TRAILS, glove: E.GLOVES };
const day = () => new Date().toISOString().slice(0, 10);

export class VaultCore {
  // tx(fn): runs fn as one transaction - all of it happens or none (ctx.storage.transactionSync in the Durable Object)
  constructor(sql, env, tx) {
    this.sql = sql; this.env = env || {}; this.tx = tx || (fn => fn());
    sql.exec(`CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS owned (kind TEXT, id TEXT, at INTEGER, PRIMARY KEY (kind, id))`);
    sql.exec(`CREATE TABLE IF NOT EXISTS solved (id INTEGER PRIMARY KEY, at INTEGER)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS reqs (req TEXT PRIMARY KEY, res TEXT, at INTEGER)`);
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

  init(secretHash) { if (this.get('secret')) return false; this.set('secret', secretHash); this.set('since', Date.now()); this.set('dama', E.ECONOMY.DAMA_START); return true; }
  authed(secretHash) { const s = this.get('secret'); return !!s && s === secretHash; }
  owns(kind, id) { const it = (KINDS[kind] || []).find(q => q.id === id); return !!it && (!(it.rarity > 0) || this.sql.exec(`SELECT 1 FROM owned WHERE kind = ? AND id = ?`, kind, id).toArray().length > 0); }
  me() {
    const owned = {}; for (const k in KINDS) owned[k] = KINDS[k].filter(q => this.owns(k, q.id)).map(q => q.id);
    return { coin: this.get('coin', 0), dia: this.get('dia', 0), dama: this.get('dama', E.ECONOMY.DAMA_START), owned,
      checking: this.sql.exec(`SELECT COUNT(*) AS c FROM matches WHERE status = 'checking'`).toArray()[0].c,
      solved: this.sql.exec(`SELECT id FROM solved`).toArray().map(r => r.id) };
  }

  // a change the app asked for: once per request number
  once(req, fn) {
    if (typeof req !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(req)) return { ok: false, why: 'no request number' };
    const had = this.sql.exec(`SELECT res FROM reqs WHERE req = ?`, req).toArray();
    if (had.length) return JSON.parse(had[0].res);
    let res; try { res = this.tx(fn); } catch (e) { res = { ok: false, why: e.message }; }        // (a throw undoes the whole change)
    this.sql.exec(`INSERT INTO reqs (req, res, at) VALUES (?, ?, ?)`, req, JSON.stringify(res), Date.now());
    return res;
  }

  buy({ req, kind, id }) {
    return this.once(req, () => {
      const it = (KINDS[kind] || []).find(q => q.id === id);
      if (!it) return { ok: false, why: 'no such item' };
      if (this.owns(kind, id)) return { ok: false, why: 'already owned' };
      const price = E.priceOf(it);
      this.pay(`buy ${kind}:${id}`, -(price.coin || 0), -(price.dia || 0));          // (throws, and nothing changes, when short)
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

  /* A match played on the device - with a friend on it, or against the computer. CHECK_MATCHES says how it is checked:
       "slices" (the free plan): it is queued, played again a few hundred physics steps per request (work(), driven by the
                 Durable Object's alarm), and paid when the replay reaches the end - seconds to a minute later;
       "true"    (a plan that may think longer): played again at once and paid in the answer;
       "false":  paid by what the app says, kept within sense and a daily allowance, and stored. */
  match({ req, kind, log }) {
    return this.once(req, () => {
      if (kind !== 'friend' && kind !== 'cpu') return { ok: false, why: 'not a match played on the device' };
      if (!log || !E.ECONOMY.PER_POINT[log.mode]) return { ok: false, why: 'bad log' };
      if (this.env.CHECK_MATCHES === 'slices') {
        this.sql.exec(`INSERT INTO matches (at, kind, mode, log, paid, checked, status) VALUES (?, ?, ?, ?, 0, 0, 'checking')`, Date.now(), kind, log.mode, JSON.stringify(log));
        return { ok: true, pending: true, me: this.me() };
      }
      const check = this.env.CHECK_MATCHES === 'true';
      let points, won;
      if (check) { const r = playMatch(log); if (!r.ok) return { ok: false, why: r.why }; points = r.points; won = r.winner === 0; }
      else {
        points = Array.isArray(log.points) ? log.points.map(p => Math.max(0, Math.min(60, p | 0))) : [0, 0]; won = log.winner === 0;
        if ((log.shots || []).length < points[0] + points[1]) points = [0, 0];                         // (more points than shots: no)
      }
      let coins = E.matchCoins(kind, log.mode, points, won);
      if (!check) {
        const d = day(), had = (this.sql.exec(`SELECT coins FROM daily WHERE day = ?`, d).toArray()[0] || {}).coins || 0;
        coins = Math.max(0, Math.min(coins, E.ECONOMY.UNCHECKED_DAILY - had));
        this.sql.exec(`INSERT INTO daily (day, coins) VALUES (?, ?) ON CONFLICT(day) DO UPDATE SET coins = coins + excluded.coins`, d, coins);
      }
      this.sql.exec(`INSERT INTO matches (at, kind, mode, log, paid, checked, status) VALUES (?, ?, ?, ?, ?, ?, 'paid')`, Date.now(), kind, log.mode, JSON.stringify(log), coins, check ? 1 : 0);
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
    if (!this.job || this.job.n !== row.n) this.job = { n: row.n, saved: -1, rp: new Replay(JSON.parse(row.log), row.cp ? JSON.parse(row.cp) : null) };
    const job = this.job, out = job.rp.advance(steps);
    if (!out) {
      const c = job.rp.lastCp; if (c && c.i !== job.saved) { this.sql.exec(`UPDATE matches SET cp = ? WHERE n = ?`, JSON.stringify(c), row.n); job.saved = c.i; }
      return true;
    }
    this.job = null;
    const log = JSON.parse(row.log);
    this.tx(() => {
      if (!out.ok) { this.sql.exec(`UPDATE matches SET status = 'rejected', why = ?, cp = NULL WHERE n = ?`, out.why, row.n); return; }
      const coins = E.matchCoins(row.kind, log.mode, out.points, out.winner === 0);
      this.sql.exec(`UPDATE matches SET status = 'paid', paid = ?, checked = 1, cp = NULL WHERE n = ?`, coins, row.n);
      if (coins) this.pay(`match ${row.kind} ${log.mode}`, coins, 0);
    });
    return this.sql.exec(`SELECT 1 FROM matches WHERE status = 'checking' LIMIT 1`).toArray().length > 0;
  }
}
