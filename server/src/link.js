/* Linking devices to one account, testable in node; held by the Lobby Durable Object named 'links' (lobby.js), in its
   SQLite. An account is a vault (vault.js) that any of its devices' keys opens (core.js devices).
   - a link code: a device that has the account asks for one (make); another device types it in within CODE_MS and gets a
     key of its own for that account (use). One use, and a new code replaces the account's last one. Guessing is held off
     by the code's size (32^8) and a cap on wrong tries a minute (TRIES_PER_MIN, for everyone at once: a guesser cannot get
     round it by asking from many places).
   - a Google account (google.js checks its sign-in token): its 'sub' is tied to one CUE account - the first time to the
     account of the device that signed in, after that any device signing in with it gets a key for that account. */
export const CODE_MS = 10 * 60 * 1000, TRIES_PER_MIN = 30;
const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class LinkCore {
  // sql: the Durable Object's SQLite (or node's in the tests); now(): ms; rnd(n): n random bytes (Uint8Array)
  constructor(sql, now, rnd) {
    this.sql = sql; this.now = now || (() => Date.now()); this.rnd = rnd || (n => crypto.getRandomValues(new Uint8Array(n)));
    sql.exec(`CREATE TABLE IF NOT EXISTS codes (code TEXT PRIMARY KEY, acct TEXT, until INTEGER)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS google (sub TEXT PRIMARY KEY, acct TEXT, at INTEGER)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS misses (at INTEGER)`);
  }
  // a new code for this account (its last one, if any, no longer works): { code, until }
  make(acct) {
    const t = this.now(); this.sql.exec(`DELETE FROM codes WHERE acct = ? OR until < ?`, acct, t);
    let code; do { code = [...this.rnd(8)].map(b => ABC[b & 31]).join(''); } while (this.sql.exec(`SELECT 1 FROM codes WHERE code = ?`, code).toArray().length);
    const until = t + CODE_MS; this.sql.exec(`INSERT INTO codes (code, acct, until) VALUES (?, ?, ?)`, code, acct, until);
    return { code, until };
  }
  // a code typed in (any case, spaces and dashes ignored): { acct } once, then gone; or { why }
  use(raw) {
    const t = this.now(), code = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    this.sql.exec(`DELETE FROM misses WHERE at < ?`, t - 60000);
    if (this.sql.exec(`SELECT COUNT(*) AS c FROM misses`).toArray()[0].c >= TRIES_PER_MIN) return { why: 'slow down' };
    const r = code.length === 8 ? this.sql.exec(`SELECT acct, until FROM codes WHERE code = ?`, code).toArray()[0] : null;
    if (!r || r.until < t) { this.sql.exec(`INSERT INTO misses (at) VALUES (?)`, t); return { why: 'no such code' }; }
    this.sql.exec(`DELETE FROM codes WHERE code = ?`, code);
    return { acct: r.acct };
  }
  // a Google account signed in on a device that has `acct` (or null): the CUE account it belongs to - tied now to `acct`
  // if it was tied to none. { acct, tied } (tied: it was tied just now) or { why } (no account to tie it to)
  google(sub, acct) {
    const r = this.sql.exec(`SELECT acct FROM google WHERE sub = ?`, sub).toArray()[0];
    if (r) return { acct: r.acct, tied: false };
    if (!acct) return { why: 'not tied' };
    this.sql.exec(`INSERT INTO google (sub, acct, at) VALUES (?, ?, ?)`, sub, acct, this.now());
    return { acct, tied: true };
  }
}
