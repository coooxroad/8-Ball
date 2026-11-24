/* The puzzles' book (owner 11-24: the puzzle AI learns from real play): one Durable Object for every puzzle's rating as
   the players move it, and every counted attempt kept for learning - with no account in it.
   Each counted attempt is a rated game between the player and the puzzle (as Lichess rates its puzzles: Glicko, the
   same arithmetic as the players' - puzzles.js glicko): a player who misses it gives it points, one who solves it takes
   some. A puzzle starts from the rating the puzzle AI gave it (web/tools/puzzles: virtual players), unsure (RD0), and
   grows sure as it is tried.
     /try     { id, res: 'o'|'x', pr, prd }  an attempt: the puzzle rated back, the attempt kept
     /live    the puzzles tried enough (MIN tries) and their ratings now - the app serves by these (52-puzzle.js)
     /stats   how many attempts, puzzles tried, solved
     /export  { after, limit }  the attempts after n, oldest first - what the puzzle AI's model is fitted to
              (web/tools/puzzles/fit.js: the chance a player of rating R solves a puzzle, from what the puzzle asks) */
export const BOOK = { RD0: 200, RD_MIN: 40, MIN: 5 };
export class PuzzleBookCore {
  constructor(sql, E) {
    this.sql = sql; this.Z = E.createPuzzles();
    sql.exec(`CREATE TABLE IF NOT EXISTS pz (id INTEGER PRIMARY KEY, r REAL, rd REAL, n INTEGER, o INTEGER, at INTEGER)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS tries (n INTEGER PRIMARY KEY AUTOINCREMENT, id INTEGER, res TEXT, pr INTEGER, prd INTEGER, at INTEGER)`);
  }
  get(id) {
    const r = this.sql.exec(`SELECT r, rd, n, o FROM pz WHERE id = ?`, id).toArray()[0]; if (r) return r;
    const z = this.Z.byId(id); return z ? { r: Number.isFinite(z.rating) ? z.rating : 1000, rd: BOOK.RD0, n: 0, o: 0 } : null;
  }
  try({ id, res, pr, prd }) {
    // (res: the player's score, 0 .. 1 - or the first set's 'o' 1, 'x' 0; the puzzle scores the rest)
    const ps = res === 'o' ? 1 : res === 'x' ? 0 : typeof res === 'number' && res >= 0 && res <= 1 ? res : null;
    const p = this.get(id); if (!p || ps == null || !Number.isFinite(pr)) return { ok: false, why: 'no such puzzle' };
    const s = 1 - ps, [r, rd] = this.Z.glicko(p.r, p.rd, pr, Number.isFinite(prd) ? prd : 150, s), at = Date.now();
    this.sql.exec(`INSERT INTO pz (id, r, rd, n, o, at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET r = excluded.r, rd = excluded.rd, n = excluded.n, o = excluded.o, at = excluded.at`,
      id, Math.max(100, r), Math.max(BOOK.RD_MIN, rd), p.n + 1, p.o + (ps > 0 ? 1 : 0), at);
    this.sql.exec(`INSERT INTO tries (id, res, pr, prd, at) VALUES (?, ?, ?, ?, ?)`, id, String(res === 'o' ? 1 : res === 'x' ? 0 : res), Math.round(pr), Math.round(prd || 0), at);
    return { ok: true, r: Math.round(r), n: p.n + 1 };
  }
  live() { return { ok: true, live: this.sql.exec(`SELECT id, r, n FROM pz WHERE n >= ?`, BOOK.MIN).toArray().map(q => [q.id, Math.round(q.r), q.n]) }; }
  stats() { const t = this.sql.exec(`SELECT COUNT(*) AS c, SUM(res = 'o' OR (res <> 'x' AND CAST(res AS REAL) > 0)) AS o FROM tries`).toArray()[0], p = this.sql.exec(`SELECT COUNT(*) AS c FROM pz`).toArray()[0]; return { ok: true, tries: t.c || 0, solved: t.o || 0, puzzles: p.c || 0 }; }
  export(after, limit) {
    const rows = this.sql.exec(`SELECT n, id, res, pr, prd, at FROM tries WHERE n > ? ORDER BY n LIMIT ?`, Math.max(0, after | 0), Math.max(1, Math.min(1000, limit | 0 || 500))).toArray();
    return { ok: true, rows, next: rows.length ? rows[rows.length - 1].n : after | 0 };
  }
}
