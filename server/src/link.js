/* Linking devices to one account, testable in node; held by the Lobby Durable Object named 'links' (lobby.js), in its
   SQLite. An account is a vault (vault.js) that any of its devices' keys opens (core.js devices). Google is the only way
   now (owner 11-16: the device codes - 다른 기기 연결, 코드로 연결 - are gone):
   - a Google account (google.js checks its sign-in token): its 'sub' is tied to one CUE account - the first time to the
     account of the device that signed in, after that any device signing in with it gets a key for that account. */

export class LinkCore {
  // sql: the Durable Object's SQLite (or node's in the tests); now(): ms; rnd(n): n random bytes (Uint8Array)
  constructor(sql, now, rnd) {
    this.sql = sql; this.now = now || (() => Date.now()); this.rnd = rnd || (n => crypto.getRandomValues(new Uint8Array(n)));
    sql.exec(`CREATE TABLE IF NOT EXISTS google (sub TEXT PRIMARY KEY, acct TEXT, at INTEGER)`);
    sql.exec(`DROP TABLE IF EXISTS codes`); sql.exec(`DROP TABLE IF EXISTS misses`);   // (the device codes' tables, gone 11-16)
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
  // an account deleted (vault.js erase): its Google account is free again - signing in with it makes a new account
  forget(acct) { this.sql.exec(`DELETE FROM google WHERE acct = ?`, acct); return { ok: true }; }
}
