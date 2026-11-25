/* The accounts, for the admin console to find one by: each vault puts its name and rating here now and then (vault.js
   listed). Kept in the 'directory' lobby's SQLite. Only what is needed to find an account and tell it from others. */
export class Directory {
  constructor(sql) {
    this.sql = sql;
    sql.exec(`CREATE TABLE IF NOT EXISTS people (acct TEXT PRIMARY KEY, nick TEXT, joined INTEGER, dama INTEGER, coin INTEGER, dia INTEGER, seen INTEGER)`);
    sql.exec(`CREATE INDEX IF NOT EXISTS people_nick ON people (nick)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS admin_fails (at INTEGER)`);
    // (fair play: each account's numbers - core.js fpSummary, put after its ranked games and puzzles - and the console's
    // config: which numbers past what make a flag. The config is the server's alone - the code is public)
    sql.exec(`CREATE TABLE IF NOT EXISTS fp (acct TEXT PRIMARY KEY, at INTEGER, games INTEGER, body TEXT)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS fpcfg (k TEXT PRIMARY KEY, v TEXT)`);
  }
  fpPut(b) {
    if (!b || typeof b.acct !== 'string' || !/^[0-9a-f]{32}$/.test(b.acct)) return { ok: false };
    const body = {}; for (const k of Object.keys(b)) if (k !== 'acct' && (b[k] == null || typeof b[k] === 'number' || typeof b[k] === 'string')) body[k] = typeof b[k] === 'string' ? b[k].slice(0, 40) : b[k];
    this.sql.exec(`INSERT INTO fp (acct, at, games, body) VALUES (?, ?, ?, ?) ON CONFLICT(acct) DO UPDATE SET at = excluded.at, games = excluded.games, body = excluded.body`, b.acct, Date.now(), b.games | 0, JSON.stringify(body));
    return { ok: true };
  }
  fpCfg(set) {
    if (set && typeof set === 'object') {
      const v = JSON.stringify(set); if (v.length > 8000) return { ok: false, why: 'too big' };
      this.sql.exec(`INSERT INTO fpcfg (k, v) VALUES ('cfg', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v`, v);
    }
    const r = this.sql.exec(`SELECT v FROM fpcfg WHERE k = 'cfg'`).toArray()[0];
    return { ok: true, cfg: r ? JSON.parse(r.v) : {} };
  }
  /* the accounts with ranked games or puzzles, most games first; each with the flags its numbers raise by the config -
     { field: { min | max, n (the games it needs) } } - and how many */
  fpList({ limit, min }) {
    const cfg = this.fpCfg().cfg, rows = this.sql.exec(`SELECT acct, at, body FROM fp WHERE games >= ? ORDER BY games DESC LIMIT ?`, Math.max(0, min | 0), Math.max(1, Math.min(2000, limit | 0 || 500))).toArray();
    const people = new Map(this.sql.exec(`SELECT acct, nick, dama FROM people WHERE acct IN (${rows.map(() => '?').join(',') || "''"})`, ...rows.map(r => r.acct)).toArray().map(p => [p.acct, p]));
    return { ok: true, cfg, rows: rows.map(r => {
      const b = JSON.parse(r.body), flags = [];
      for (const [k, c] of Object.entries(cfg || {})) { const v = b[k]; if (v == null || !c || (c.n && (b.games || 0) < c.n)) continue; if (c.min != null && v >= c.min || c.max != null && v <= c.max) flags.push(k); }
      return Object.assign({ acct: r.acct, at: r.at, nick: (people.get(r.acct) || {}).nick || b.nick || null, flags }, b);
    }) };
  }
  // wrong admin passwords in the last 15 minutes (index.js adminPass), one more when add
  fails(add, now = Date.now()) {
    this.sql.exec(`DELETE FROM admin_fails WHERE at < ?`, now - 15 * 60000);
    if (add) this.sql.exec(`INSERT INTO admin_fails (at) VALUES (?)`, now);
    return { n: this.sql.exec(`SELECT COUNT(*) AS n FROM admin_fails`).toArray()[0].n };
  }
  put({ acct, nick, joined, dama, coin, dia }) {
    if (typeof acct !== 'string' || !/^[0-9a-f]{32}$/.test(acct)) return { ok: false };
    this.sql.exec(`INSERT INTO people (acct, nick, joined, dama, coin, dia, seen) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(acct) DO UPDATE SET nick = excluded.nick, joined = excluded.joined, dama = excluded.dama, coin = excluded.coin, dia = excluded.dia, seen = excluded.seen`,
      acct, nick ? String(nick).slice(0, 20) : null, joined ? 1 : 0, dama | 0, coin | 0, dia | 0, Date.now());
    return { ok: true };
  }
  // an account deleted (vault.js erase): off the list
  forget(acct) { this.sql.exec(`DELETE FROM people WHERE acct = ?`, acct); this.sql.exec(`DELETE FROM fp WHERE acct = ?`, acct); return { ok: true }; }
  // by the account id (or its start, as the settings show it: 'ABCD·1234' or 'abcd1234'), or by a name; the latest seen first
  find(q) {
    const s = String(q || '').trim().replace(/[%_]/g, ''), id = s.toLowerCase().replace(/[^0-9a-f]/g, '');
    if (!s && String(q || '').trim()) return { ok: true, people: [] };
    const rows = s === '' ? this.sql.exec(`SELECT * FROM people ORDER BY seen DESC LIMIT 30`).toArray()
      : this.sql.exec(`SELECT * FROM people WHERE (? != '' AND acct LIKE ?) OR nick LIKE ? ORDER BY seen DESC LIMIT 30`, id.length >= 4 ? id : '', id + '%', '%' + s + '%').toArray();
    return { ok: true, people: rows.map(r => ({ acct: r.acct, nick: r.nick, joined: !!r.joined, dama: r.dama, coin: r.coin, dia: r.dia, seen: r.seen })) };
  }
}
