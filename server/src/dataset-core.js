/* The shot dataset (owner 11-18: the AI's next steps - real people's shots, to learn from).
   Every match the server is shown - one played on a device (with a friend, against a bot: core.js match) and every room's
   game (ranked, invited: ranked.js RoomCore.result) - is kept here once more, cut down to what learning needs and nothing
   that says who played: the game and its rules, each seat's rating and whether a person or a bot sat there, and every shot
   (where the balls stood, how it was struck). No account, no name.
     a month a Durable Object ('shots-2026-11'): each stays small, and a month can be read out on its own
     /put     a match (datasetRow below made it)                /stats  how many, by kind and game
     /export  { after, limit }: the next rows after n, oldest first - the admin console reads a month out this way
   What it is for: the reference hand fitted to how people really miss (by rating), baselines from real play (as golf's
   Strokes Gained is measured against the field), and bots that play like people of a rating (as Maia learnt from people's
   games) - docs/ai-roadmap.md. */

const MODES = ['eight', 'nine', 'four', 'three', 'snooker', 'arcade'];
const KINDS = ['cpu', 'friend', 'ranked', 'invite', 'standin'];
const r5 = x => Math.round(x * 1e5) / 1e5;
const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
export const monthOf = t => { const d = new Date(t); return `shots-${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; };

/* A match as the dataset keeps it. log: as the device or the room has it (match-log.js: { mode, table, opts, shots:
   [{ s: { cue, balls: [[x, y, on, ...]] }, aim, V, a, b, el, inHand?, t?, seat? } | { timeout }], winner, points });
   seats: [{ rating, human }] for the two sides. null if it is not a match worth keeping. A shot becomes
   [seat or -1, aim, V, a, b, el, in hand 0/1, the cue ball's index, x, y, on, x, y, on, ...] - positions to 1/100 mm. */
export function datasetRow(kind, log, seats, at) {
  if (!log || !MODES.includes(log.mode) || !KINDS.includes(kind) || !Array.isArray(log.shots) || !log.shots.length) return null;
  const shots = [];
  for (const s of log.shots.slice(0, 600)) {
    if (!s || s.timeout === true) { shots.push([-2]); continue; }
    if (!s.s || !Array.isArray(s.s.balls) || !num(s.aim, -20, 20) || !num(s.V, 0, 14)) return null;
    const seat = Number.isInteger(s.t) ? s.t : Number.isInteger(s.seat) ? s.seat : -1;
    const row = [seat, r5(s.aim), r5(s.V), r5(s.a || 0), r5(s.b || 0), r5(s.el || 0), s.inHand ? 1 : 0, s.s.cue | 0];
    for (const b of s.s.balls) { if (!Array.isArray(b) || !Number.isFinite(b[0]) || !Number.isFinite(b[1])) return null; row.push(r5(b[0]), r5(b[1]), b[2] ? 1 : 0); }
    shots.push(row);
  }
  const seat = q => ({ rating: q && Number.isFinite(q.rating) ? Math.round(q.rating) : null, human: !!(q && q.human), bot: q && typeof q.bot === 'string' ? q.bot.slice(0, 16) : undefined });
  return { v: 1, at: at || Date.now(), kind, mode: log.mode, table: typeof log.table === 'string' ? log.table.slice(0, 24) : null,
    opts: log.opts && typeof log.opts === 'object' ? JSON.parse(JSON.stringify(log.opts)) : {}, seats: [seat(seats && seats[0]), seat(seats && seats[1])],
    winner: log.winner === 0 || log.winner === 1 ? log.winner : null, points: Array.isArray(log.points) ? log.points.slice(0, 2) : null, shots };
}
// (from a vault or a room: put it in its month's dataset - never waited on by the player)
export function toDataset(env, row) {
  if (!row || !env || !env.DATASET) return null;
  return env.DATASET.get(env.DATASET.idFromName(monthOf(row.at))).fetch('https://dataset/put', { method: 'POST', body: JSON.stringify(row) }).catch(() => null);
}

export class DatasetCore {
  constructor(sql) {
    this.sql = sql;
    sql.exec(`CREATE TABLE IF NOT EXISTS rows (n INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER, kind TEXT, mode TEXT, shots INTEGER, body TEXT, key TEXT UNIQUE)`);
  }
  put(row) {
    if (!row || row.v !== 1 || !MODES.includes(row.mode) || !KINDS.includes(row.kind) || !Array.isArray(row.shots)) return { ok: false, why: 'bad row' };
    const body = JSON.stringify(row); if (body.length > 400000) return { ok: false, why: 'too big' };
    // (a match is kept once: its key - the device's match's identity, a room's id - says if it is already here)
    const key = typeof row.key === 'string' ? row.key.slice(0, 80) : null;
    const before = this.sql.exec(`SELECT COUNT(*) AS c FROM rows`).toArray()[0].c;
    this.sql.exec(`INSERT OR IGNORE INTO rows (at, kind, mode, shots, body, key) VALUES (?, ?, ?, ?, ?, ?)`, row.at || Date.now(), row.kind, row.mode, row.shots.length, body, key);
    return { ok: true, kept: this.sql.exec(`SELECT COUNT(*) AS c FROM rows`).toArray()[0].c > before };
  }
  stats() {
    const by = this.sql.exec(`SELECT kind, mode, COUNT(*) AS matches, SUM(shots) AS shots, SUM(LENGTH(body)) AS bytes FROM rows GROUP BY kind, mode ORDER BY kind, mode`).toArray();
    const last = this.sql.exec(`SELECT MAX(n) AS n FROM rows`).toArray()[0].n || 0;
    return { ok: true, by, last };
  }
  export(after, limit) {
    const n = Math.max(0, after | 0), k = Math.max(1, Math.min(200, limit | 0 || 100));
    const rows = this.sql.exec(`SELECT n, body FROM rows WHERE n > ? ORDER BY n LIMIT ?`, n, k).toArray();
    return { ok: true, rows: rows.map(r => Object.assign({ n: r.n }, JSON.parse(r.body))), next: rows.length ? rows[rows.length - 1].n : n, more: rows.length === k };
  }
}

