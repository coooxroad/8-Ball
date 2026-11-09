/* The accounts, for the admin console to find one by: each vault puts its name and rating here now and then (vault.js
   listed). Kept in the 'directory' lobby's SQLite. Only what is needed to find an account and tell it from others. */
export class Directory {
  constructor(sql) {
    this.sql = sql;
    sql.exec(`CREATE TABLE IF NOT EXISTS people (acct TEXT PRIMARY KEY, nick TEXT, joined INTEGER, dama INTEGER, coin INTEGER, dia INTEGER, seen INTEGER)`);
    sql.exec(`CREATE INDEX IF NOT EXISTS people_nick ON people (nick)`);
  }
  put({ acct, nick, joined, dama, coin, dia }) {
    if (typeof acct !== 'string' || !/^[0-9a-f]{32}$/.test(acct)) return { ok: false };
    this.sql.exec(`INSERT INTO people (acct, nick, joined, dama, coin, dia, seen) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(acct) DO UPDATE SET nick = excluded.nick, joined = excluded.joined, dama = excluded.dama, coin = excluded.coin, dia = excluded.dia, seen = excluded.seen`,
      acct, nick ? String(nick).slice(0, 20) : null, joined ? 1 : 0, dama | 0, coin | 0, dia | 0, Date.now());
    return { ok: true };
  }
  // by the account id (or its start, as the settings show it: 'ABCD·1234' or 'abcd1234'), or by a name; the latest seen first
  find(q) {
    const s = String(q || '').trim().replace(/[%_]/g, ''), id = s.toLowerCase().replace(/[^0-9a-f]/g, '');
    if (!s && String(q || '').trim()) return { ok: true, people: [] };
    const rows = s === '' ? this.sql.exec(`SELECT * FROM people ORDER BY seen DESC LIMIT 30`).toArray()
      : this.sql.exec(`SELECT * FROM people WHERE (? != '' AND acct LIKE ?) OR nick LIKE ? ORDER BY seen DESC LIMIT 30`, id.length >= 4 ? id : '', id + '%', '%' + s + '%').toArray();
    return { ok: true, people: rows.map(r => ({ acct: r.acct, nick: r.nick, joined: !!r.joined, dama: r.dama, coin: r.coin, dia: r.dia, seen: r.seen })) };
  }
}
