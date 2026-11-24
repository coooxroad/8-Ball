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
              (web/tools/puzzles/fit.js: the chance a player of rating R solves a puzzle, from what the puzzle asks)
   The admin's hand on it (owner 11-24 밤: 어드민 콘솔로 퍼즐 레이팅 조정 - web/admin.html's 퍼즐 tab, index.js adminRoute):
     ov   a puzzle's override - r its rating set by hand (fix: held there, tries no longer move it; else the players move
          it on from there), off (not served), a note; what /live hands the app with the players' ratings
     cfg  the knobs the app follows (52-puzzle.js pzKnob): CFG below, the rest left as they are
     log  every change, who, when, before -> after
     /admin { op, ... }  list · get { id } · set { id, r, fix, note } · reset { id } (back to the puzzle AI's) ·
                         off { id, off } · batch { game, kind, el, lo, hi, d } (a group moved by d) · cfg { set } · log */
export const BOOK = { RD0: 200, RD_MIN: 40, MIN: 5 };
// the knobs: the rating a player starts from, where the next puzzle is aimed (below the rating), the harder place's lift,
// a puzzle's score by its stars (none, ★, ★★, ★★★), the rating up to which only plain positions are served
export const CFG = { start: 600, aim: -100, hard: 100, stars: [0, 0.5, 0.75, 1], plainMax: 800 };
const CFG_OK = { start: v => v >= 100 && v <= 3000, aim: v => v >= -600 && v <= 600, hard: v => v >= -600 && v <= 600, plainMax: v => v >= 0 && v <= 3000,
  stars: v => Array.isArray(v) && v.length === 4 && v.every((x, i) => Number.isFinite(x) && x >= 0 && x <= 1 && (!i || x >= v[i - 1])) };
// a puzzle's elements beyond the plain thing (as the app's pzNews names them): a table of another shape, barricades, a
// cushion asked for, two turns, balls not to pot
const ELS = ['table', 'walls', 'need', 'turns', 'keep'];
// a try's score from what is kept (the first set's 'o' / 'x'; then the number), and its stars
const SCORE_SQL = `(CASE res WHEN 'o' THEN 1 WHEN 'x' THEN 0 ELSE CAST(res AS REAL) END)`;
const STARS_SQL = `(CASE WHEN ${SCORE_SQL} >= 1 THEN 3 WHEN ${SCORE_SQL} >= 0.75 THEN 2 WHEN ${SCORE_SQL} > 0 THEN 1 ELSE 0 END)`;
export class PuzzleBookCore {
  constructor(sql, E) {
    this.sql = sql; this.Z = E.createPuzzles();
    sql.exec(`CREATE TABLE IF NOT EXISTS pz (id INTEGER PRIMARY KEY, r REAL, rd REAL, n INTEGER, o INTEGER, at INTEGER)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS tries (n INTEGER PRIMARY KEY AUTOINCREMENT, id INTEGER, res TEXT, pr INTEGER, prd INTEGER, at INTEGER)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS ov (id INTEGER PRIMARY KEY, r REAL, fix INTEGER DEFAULT 0, off INTEGER DEFAULT 0, note TEXT, at INTEGER)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS cfg (k TEXT PRIMARY KEY, v TEXT)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS log (n INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER, by TEXT, id INTEGER, what TEXT, was TEXT, now TEXT)`);
  }
  ov(id) { return this.sql.exec(`SELECT r, fix, off, note, at FROM ov WHERE id = ?`, id).toArray()[0] || null; }
  get(id) {
    const r = this.sql.exec(`SELECT r, rd, n, o FROM pz WHERE id = ?`, id).toArray()[0]; if (r) return r;
    const z = this.Z.byId(id); return z ? { r: Number.isFinite(z.rating) ? z.rating : 1000, rd: BOOK.RD0, n: 0, o: 0 } : null;
  }
  try({ id, res, pr, prd }) {
    // (res: the player's score, 0 .. 1 - or the first set's 'o' 1, 'x' 0; the puzzle scores the rest)
    const ps = res === 'o' ? 1 : res === 'x' ? 0 : typeof res === 'number' && res >= 0 && res <= 1 ? res : null;
    const p = this.get(id); if (!p || ps == null || !Number.isFinite(pr)) return { ok: false, why: 'no such puzzle' };
    // (a rating held by hand: the try is kept and counted, the rating stays)
    const o = this.ov(id), held = o && o.fix && Number.isFinite(o.r);
    const s = 1 - ps, [r, rd] = held ? [o.r, p.rd] : this.Z.glicko(p.r, p.rd, pr, Number.isFinite(prd) ? prd : 150, s), at = Date.now();
    this.sql.exec(`INSERT INTO pz (id, r, rd, n, o, at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET r = excluded.r, rd = excluded.rd, n = excluded.n, o = excluded.o, at = excluded.at`,
      id, Math.max(100, r), Math.max(BOOK.RD_MIN, rd), p.n + 1, p.o + (ps > 0 ? 1 : 0), at);
    this.sql.exec(`INSERT INTO tries (id, res, pr, prd, at) VALUES (?, ?, ?, ?, ?)`, id, String(res === 'o' ? 1 : res === 'x' ? 0 : res), Math.round(pr), Math.round(prd || 0), at);
    return { ok: true, r: Math.round(r), n: p.n + 1 };
  }
  /* what the app serves by: the puzzles tried enough, and those the admin rated, at their ratings ([id, r, n] - a held one
     at its held rating); ov the overrides ([id, r or null, held 0/1, off 0/1]); cfg the knobs */
  live() {
    const ov = this.sql.exec(`SELECT id, r, fix, off FROM ov`).toArray(), by = new Map(ov.map(o => [o.id, o])), out = [];
    for (const q of this.sql.exec(`SELECT id, r, n FROM pz`).toArray()) {
      const o = by.get(q.id), set = o && Number.isFinite(o.r);
      if (q.n >= BOOK.MIN || set) out.push([q.id, Math.round(o && o.fix && set ? o.r : q.r), q.n]);
    }
    for (const o of ov) if (o.fix && Number.isFinite(o.r) && !out.some(q => q[0] === o.id)) out.push([o.id, Math.round(o.r), 0]);
    return { ok: true, live: out, ov: ov.map(o => [o.id, Number.isFinite(o.r) ? Math.round(o.r) : null, o.fix ? 1 : 0, o.off ? 1 : 0]), cfg: this.cfg() };
  }
  cfg() {
    const c = Object.assign({}, CFG);
    for (const q of this.sql.exec(`SELECT k, v FROM cfg`).toArray()) { try { const v = JSON.parse(q.v); if (CFG_OK[q.k] && CFG_OK[q.k](v)) c[q.k] = v; } catch (e) {} }
    return c;
  }
  stats() { const t = this.sql.exec(`SELECT COUNT(*) AS c, SUM(res = 'o' OR (res <> 'x' AND CAST(res AS REAL) > 0)) AS o FROM tries`).toArray()[0], p = this.sql.exec(`SELECT COUNT(*) AS c FROM pz`).toArray()[0]; return { ok: true, tries: t.c || 0, solved: t.o || 0, puzzles: p.c || 0 }; }
  export(after, limit) {
    const rows = this.sql.exec(`SELECT n, id, res, pr, prd, at FROM tries WHERE n > ? ORDER BY n LIMIT ?`, Math.max(0, after | 0), Math.max(1, Math.min(1000, limit | 0 || 500))).toArray();
    return { ok: true, rows, next: rows.length ? rows[rows.length - 1].n : after | 0 };
  }

  /* ---- the admin's (index.js adminRoute 'puzzles': who is by, as the ledger keeps it) ---- */
  admin(b) {
    const op = b && b.op, by = String((b && b.by) || 'admin').slice(0, 40);
    if (op === 'list') return this.list();
    if (op === 'get') return this.one(b.id | 0);
    if (op === 'set') return this.set(b.id | 0, b, by);
    if (op === 'reset') return this.reset(b.id | 0, by);
    if (op === 'off') return this.offOn(b.id | 0, !!b.off, by);
    if (op === 'batch') return this.batch(b, by);
    if (op === 'cfg') return b.set ? this.cfgSet(b.set, by) : { ok: true, cfg: this.cfg(), base: CFG };
    if (op === 'log') return this.logOf(b.after, b.limit, b.id);
    return { ok: false, why: 'no such thing' };
  }
  note(id, what, was, now, by) { this.sql.exec(`INSERT INTO log (at, by, id, what, was, now) VALUES (?, ?, ?, ?, ?, ?)`, Date.now(), by, id, what, JSON.stringify(was), JSON.stringify(now)); }
  // a puzzle's elements and kind (plain: nothing asked but the plain thing)
  kindOf(z) { const g = this.Z.gameOf(z); return { game: g, plain: g === 'four' ? !!this.Z.plain(z) : (z.pot || []).length === 1 && !z.keep && !z.need && !z.walls && !z.table && !z.turns, els: ELS.filter(e => e === 'turns' ? this.Z.turnsOf(z) > 1 : e === 'table' ? z.table && z.table !== 'rect' : Array.isArray(z[e]) ? z[e].length > 0 : !!z[e]) }; }
  // every puzzle with a rating: the AI's, the players' (tries, solved, average score and stars), its override
  list() {
    const pz = new Map(this.sql.exec(`SELECT id, r, rd, n, o FROM pz`).toArray().map(q => [q.id, q])), ov = new Map(this.sql.exec(`SELECT * FROM ov`).toArray().map(o => [o.id, o]));
    const st = new Map(this.sql.exec(`SELECT id, AVG(${SCORE_SQL}) AS s, AVG(${STARS_SQL}) AS st FROM tries GROUP BY id`).toArray().map(q => [q.id, q]));
    const rows = this.Z.list.filter(z => Number.isFinite(z.rating)).map(z => {
      const p = pz.get(z.id), o = ov.get(z.id), t = st.get(z.id), k = this.kindOf(z);
      const live = o && o.fix && Number.isFinite(o.r) ? o.r : p && (p.n >= BOOK.MIN || (o && Number.isFinite(o.r))) ? p.r : null;
      return { id: z.id, game: k.game, plain: k.plain, els: k.els, goal: this.Z.goalOf(z), ai: z.rating, fun: z.fun != null ? z.fun : null,
        r: Math.round(live != null ? live : z.rating), live: live != null, rd: p ? Math.round(p.rd) : BOOK.RD0, n: p ? p.n : 0, o: p ? p.o : 0,
        score: t ? Math.round(t.s * 1000) / 1000 : null, stars: t ? Math.round(t.st * 100) / 100 : null,
        fix: !!(o && o.fix), off: !!(o && o.off), set: o && Number.isFinite(o.r) ? Math.round(o.r) : null, note: (o && o.note) || '' };
    });
    return { ok: true, rows, cfg: this.cfg(), min: BOOK.MIN };
  }
  one(id) {
    const z = this.Z.byId(id); if (!z) return { ok: false, why: 'no such puzzle' };
    const row = this.list().rows.find(q => q.id === id) || null;
    const tries = this.sql.exec(`SELECT n, res, pr, prd, at FROM tries WHERE id = ? ORDER BY n DESC LIMIT 30`, id).toArray();
    return { ok: true, row, tries, log: this.logOf(0, 30, id).rows };
  }
  // a rating by hand (fix: held), and/or a note
  set(id, { r, fix, note }, by, quiet) {
    const z = this.Z.byId(id); if (!z || !Number.isFinite(z.rating)) return { ok: false, why: 'no such puzzle' };
    const was = this.ov(id), p = this.get(id), rv = r == null || r === '' ? null : Math.round(+r);
    if (rv != null && (!Number.isFinite(rv) || rv < 100 || rv > 3500)) return { ok: false, why: 'bad rating' };
    const now = { r: rv != null ? rv : was ? was.r : null, fix: fix != null ? (fix ? 1 : 0) : was ? was.fix : 0, off: was ? was.off : 0, note: note != null ? String(note).slice(0, 200) : was ? was.note : null };
    if (now.fix && !Number.isFinite(now.r)) now.r = Math.round(p.r);
    this.sql.exec(`INSERT INTO ov (id, r, fix, off, note, at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET r = excluded.r, fix = excluded.fix, off = excluded.off, note = excluded.note, at = excluded.at`, id, now.r, now.fix, now.off, now.note, Date.now());
    // (a rating set and not held: the players move it on from there - the book's own rating starts again at it)
    if (rv != null) this.sql.exec(`INSERT INTO pz (id, r, rd, n, o, at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET r = excluded.r, rd = excluded.rd, at = excluded.at`, id, rv, Math.max(BOOK.RD_MIN, Math.min(p.rd, 120)), p.n, p.o, Date.now());
    this.note(id, 'set', Object.assign({ book: Math.round(p.r) }, was || {}), now, by);
    return quiet ? { ok: true } : { ok: true, row: this.list().rows.find(q => q.id === id) };
  }
  // back to the puzzle AI's rating: the hand's rating and hold taken off (the note and off kept), the book's rating the AI's again
  reset(id, by) {
    const z = this.Z.byId(id); if (!z || !Number.isFinite(z.rating)) return { ok: false, why: 'no such puzzle' };
    const was = this.ov(id), p = this.get(id);
    if (was) this.sql.exec(`UPDATE ov SET r = NULL, fix = 0, at = ? WHERE id = ?`, Date.now(), id);
    this.sql.exec(`UPDATE pz SET r = ?, rd = ?, at = ? WHERE id = ?`, z.rating, BOOK.RD0, Date.now(), id);
    this.note(id, 'reset', { r: Math.round(p.r), set: was && was.r, fix: was && was.fix }, { r: z.rating }, by);
    return { ok: true, row: this.list().rows.find(q => q.id === id) };
  }
  offOn(id, off, by) {
    const z = this.Z.byId(id); if (!z) return { ok: false, why: 'no such puzzle' };
    const was = this.ov(id);
    this.sql.exec(`INSERT INTO ov (id, off, at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET off = excluded.off, at = excluded.at`, id, off ? 1 : 0, Date.now());
    this.note(id, off ? 'off' : 'on', { off: !!(was && was.off) }, { off }, by);
    return { ok: true, row: this.list().rows.find(q => q.id === id) };
  }
  // a group moved by d: { game, kind 'plain' | 'cond', el (one of ELS), lo, hi (its rating now), ids } - each set by hand at
  // its rating now + d (a held one stays held)
  batch({ game, kind, el, lo, hi, ids, d }, by) {
    const dd = Math.round(+d); if (!Number.isFinite(dd) || !dd || Math.abs(dd) > 1000) return { ok: false, why: 'bad change' };
    const want = Array.isArray(ids) ? new Set(ids.map(Number)) : null;
    const rows = this.list().rows.filter(q => (!want || want.has(q.id)) && (!game || q.game === game) && (!kind || (kind === 'plain' ? q.plain : !q.plain)) && (!el || q.els.includes(el)) &&
      (lo == null || lo === '' || q.r >= +lo) && (hi == null || hi === '' || q.r <= +hi));
    if (!rows.length) return { ok: false, why: 'none' };
    for (const q of rows) this.set(q.id, { r: Math.max(100, Math.min(3500, q.r + dd)) }, by, true);
    this.note(0, 'batch', { game, kind, el, lo, hi, n: rows.length }, { d: dd }, by);
    return { ok: true, n: rows.length };
  }
  cfgSet(set, by) {
    const was = this.cfg(), bad = Object.keys(set || {}).filter(k => !CFG_OK[k] || !CFG_OK[k](set[k]));
    if (!set || !Object.keys(set).length || bad.length) return { ok: false, why: 'bad knob ' + bad.join(',') };
    for (const [k, v] of Object.entries(set)) this.sql.exec(`INSERT INTO cfg (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v`, k, JSON.stringify(v));
    this.note(0, 'cfg', was, this.cfg(), by);
    return { ok: true, cfg: this.cfg() };
  }
  logOf(after, limit, id) {
    const lim = Math.max(1, Math.min(200, limit | 0 || 50)), q = id ? this.sql.exec(`SELECT * FROM log WHERE id = ? ORDER BY n DESC LIMIT ?`, id, lim) : this.sql.exec(`SELECT * FROM log ${after ? 'WHERE n < ?' : ''} ORDER BY n DESC LIMIT ?`, ...(after ? [after | 0, lim] : [lim]));
    const rows = q.toArray().map(r => ({ n: r.n, at: r.at, by: r.by, id: r.id, what: r.what, was: JSON.parse(r.was || 'null'), now: JSON.parse(r.now || 'null') }));
    return { ok: true, rows, next: rows.length ? rows[rows.length - 1].n : 0 };
  }
}
