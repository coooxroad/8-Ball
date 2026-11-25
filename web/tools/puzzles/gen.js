'use strict';
/* The rated puzzles' generator (owner 11-24: puzzles by difficulty, made and rated by the puzzle AI).

     node web/tools/puzzles/gen.js run  --seed 1 --minutes 30 [--game four|pocket]   # one worker: adds to pool-<seed>.json
     node web/tools/puzzles/gen.js write                                              # every pool into web/puzzles.js

   It proposes positions, finds every way the shot can be made (search: aims at the balls, off each cushion once and
   twice, and all round), rates each candidate with the virtual players (ai.js), and keeps it if its rating's band (100
   points) still wants puzzles of its kind - so every band, from 400 to 2,400, fills:
     4구, plain (an ordinary position, a point and nothing more asked) - in every band: the low ones open, the high ones
         the hard positions of real billiards (난구: a ball on the cushion, the yellow in the way, the reds far apart,
         the cue ball tied to a rail), so a 2,000 player still meets plain billiards (owner 11-24)
     4구 with conditions, above 800 only (owner 11-23): barricades, a table of another shape (tables.js TABLE_OUTLINES),
         a cushion that must be met, a goal (모아치기, 빈쿠션, 쓰리쿠션, 쿠션 없이), two turns - one or two together
     포켓: a ball (or two) to pot, from the plain cut to kicks, banks, combinations, a ball to keep out, two turns
   Every answer kept is played again from the start exactly as the app, tests and server will (puzzles.js play).
   (11-24 밤, owner) Each band asks a least room of its answer (MIN_ROOM - the share of aims and paces around it that
   still work): up to 800 only wide answers, so what is hard there is finding the way and not a steady hand; the higher
   the band, the finer an answer may be. write() keeps the puzzles already in the list with their ids (the server pays
   and rates by id) and gives new ones ids never used (next-id.json). */
const fs = require('fs'), path = require('path');
const L = require('./lab'), AI = require('./ai');
const args = process.argv.slice(2), opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : null; };
const POOLS = __dirname;
// the bands and how many each wants: plain 4구 everywhere, 4구 with conditions above 800, 포켓 everywhere
const BANDS = []; for (let r = 400; r < 2500; r += 100) BANDS.push(r);
const WANT = { plain: 10, cond: 8, pocket: 6 };
const wantOf = (kind, band) => kind === 'cond' ? (band > 800 ? WANT.cond : 0) : kind === 'pocket' ? (band <= 2200 ? WANT.pocket : 0) : WANT.plain;
const bandOf = r => Math.max(400, Math.min(2400, Math.floor(r / 100) * 100));
const MIN_ROOM = b => b <= 800 ? 0.45 : b <= 1100 ? 0.3 : b <= 1400 ? 0.18 : b <= 1800 ? 0.08 : 0;
const roomOk = z => (z.room != null ? z.room : 1) >= MIN_ROOM(bandOf(z.rating));
// a listed puzzle's room: its answer's (the first turn's) share of the grid around it that works (ai.js centre)
function roomOf(z) { const E = L.env(z); return AI.centre(E, L.Z.shotOf(z, 0), null, 0, []).room; }
// the list as it is, each with its room (worked out once a run)
let LISTED = null;
const listed = () => LISTED || (LISTED = L.Z.list.filter(z => Number.isFinite(z.rating)).map(z => Object.assign({}, z, { room: roomOf(z) })));
const kindOf = z => z.game === 'pocket' ? 'pocket' : L.Z.plain(z) ? 'plain' : 'cond';
const r6 = v => Math.round(v * 1e6) / 1e6, r9 = v => Math.round(v * 1e9) / 1e9;

/* ---------- positions ---------- */
// a world with the puzzle's table and barricades, to ask where a ball may stand
function freeAt(E, w, x, y, id) {
  if (!E.P.isFree(w, x, y, id)) return false;
  for (const q of w.walls) { const c = Math.cos(q.ang), s = Math.sin(q.ang), dx = x - q.x, dy = y - q.y; if (Math.hypot(Math.max(0, Math.abs(dx * c + dy * s) - q.len / 2), Math.max(0, Math.abs(-dx * s + dy * c) - q.thick / 2)) < E.P.R + 0.004) return false; }
  return true;
}
// the balls set down one by one where pick() says, each where it may stand; null if one will not go
function place(E, ids, pick, rnd) {
  const w = E.P.clone(E.w0); for (const b of w.balls) b.on = false;
  const out = [];
  for (const id of ids) {
    let ok = false;
    for (let k = 0; k < 40 && !ok; k++) { const [x, y] = pick(id, k); if (freeAt(E, w, x, y, id)) { E.P.place(w, id, x, y, rnd); w.balls[id].on = true; out.push([id, r6(x), r6(y)]); ok = true; } }
    if (!ok) return null;
  }
  return out;
}
// how far in from the cloth's edge a ball's middle can go (the ordinary table; an outline's is checked by freeAt)
const span = P => [P.HL - P.R - 0.002, P.HW - P.R - 0.002];
/* 난구's ways of making a plain position hard (one or two of them): a red on the cushion, the cue ball on the cushion,
   the yellow across the way, the reds at opposite ends, the reds together on a rail, the cue ball in a corner */
const TROPES = ['redRail', 'cueRail', 'block', 'apart', 'pair', 'corner'];
function fourLayout(E, rnd, tropes) {
  const [X, Y] = span(E.P), u = (a, b) => a + (b - a) * rnd(), t = new Set(tropes || []), onRail = () => { const k = Math.floor(rnd() * 4); return k < 2 ? [u(-X, X), (k ? 1 : -1) * (Y - u(0, 0.004))] : [(k === 2 ? 1 : -1) * (X - u(0, 0.004)), u(-Y, Y)]; };
  let red1 = null;
  const pick = (id, k) => {
    if (k > 30) return [u(-X, X), u(-Y, Y)];
    if (id === 0) { if (t.has('corner')) { const sx = rnd() < 0.5 ? -1 : 1, sy = rnd() < 0.5 ? -1 : 1; return [sx * u(X - 0.12, X), sy * u(Y - 0.12, Y)]; } return t.has('cueRail') ? onRail() : [u(-X, X), u(-Y, Y)]; }
    if (id === 2) { const p = t.has('redRail') ? onRail() : t.has('apart') ? [(rnd() < 0.5 ? -1 : 1) * u(X * 0.7, X), u(-Y, Y)] : [u(-X, X), u(-Y, Y)]; red1 = p; return p; }
    if (id === 3) {
      if (t.has('apart') && red1) return [-Math.sign(red1[0]) * u(X * 0.7, X), u(-Y, Y)];
      if (t.has('pair') && red1) { const a = u(0, 6.283), d = u(2.2, 4) * E.P.R; return [red1[0] + Math.cos(a) * d, red1[1] + Math.sin(a) * d]; }
      return [u(-X, X), u(-Y, Y)];
    }
    // the yellow: across the way from the cue ball to a red, or anywhere
    return [u(-X, X), u(-Y, Y)];
  };
  const b = place(E, [0, 2, 3, 1], pick, rnd); if (!b) return null;
  const at = id => b.find(q => q[0] === id);
  if (t.has('block')) {
    // move the yellow onto the line from the cue ball to the nearer red, a little to one side
    const c = at(0), r = [at(2), at(3)].sort((p, q) => Math.hypot(p[1] - c[1], p[2] - c[2]) - Math.hypot(q[1] - c[1], q[2] - c[2]))[0], f = u(0.35, 0.65), off = u(-1.2, 1.2) * E.P.R;
    const d = Math.hypot(r[1] - c[1], r[2] - c[2]); if (d < 6 * E.P.R) return null;
    const x = c[1] + (r[1] - c[1]) * f - (r[2] - c[2]) / d * off, y = c[2] + (r[2] - c[2]) * f + (r[1] - c[1]) / d * off;
    const w = E.P.clone(E.w0); for (const q of b) { if (q[0] === 1) { w.balls[1].on = false; continue; } E.P.place(w, q[0], q[1], q[2]); }
    if (!freeAt(E, w, x, y, 1)) return null; at(1)[1] = r6(x); at(1)[2] = r6(y);
  }
  return [0, 1, 2, 3].map(id => [at(id)[1], at(id)[2]]);
}
// pocket: the cue ball, the balls to pot, a few others in the way (one of them, sometimes, the 8 to keep out)
function pocketLayout(E, rnd, n, blockers) {
  const [X, Y] = span(E.P), u = (a, b) => a + (b - a) * rnd(), ids = [0];
  const pool = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15].sort(() => rnd() - 0.5), pot = pool.slice(0, n), others = pool.slice(n, n + blockers);
  const keep = rnd() < 0.3 && blockers > 0 ? [8] : null; if (keep) others[0] = 8;
  ids.push(...pot, ...others);
  const b = place(E, ids, () => [u(-X, X), u(-Y, Y)], rnd); if (!b) return null;
  return { balls: b, pot, keep };
}

/* ---------- search ---------- */
// the aims worth trying from world w: at each ball (a spread across it), at each ball seen in each cushion (once; on an
// ordinary table twice too), at the ghost ball that sends a target to a pocket (and that seen in a cushion: a kick), and
// all round every 1.5°
function aims(E, w, targets, pockets) {
  const P = E.P, c = w.balls[0], out = [], seen = new Set(), R = P.R;
  const add = a => { a = Math.atan2(Math.sin(a), Math.cos(a)); const k = a.toFixed(4); if (!seen.has(k)) { seen.add(k); out.push(a); } };
  const at = (x, y, n, wide) => { const d = Math.hypot(x - c.x, y - c.y); if (d < 1e-6) return; const a = Math.atan2(y - c.y, x - c.x), sp = wide ? Math.asin(Math.min(0.99, 2 * R / d)) : 0.012; for (let j = -n; j <= n; j++) add(a + sp * j / Math.max(1, n)); };
  // the cushions as lines a ball's middle can reach: the ordinary table's four, or an outline's longer faces
  const lines = [];
  if (w.shape) { for (const f of w.shape.faces) { if (f.len < 0.12) continue; let nx = -f.ty, ny = f.tx; const mx = f.cx + nx * 0.02, my = f.cy + ny * 0.02; if (!P.inShape(w.shape, mx, my)) { nx = -nx; ny = -ny; } lines.push({ px: f.cx + nx * R, py: f.cy + ny * R, nx, ny }); } }
  else { const X = P.HL - R, Y = P.HW - R; lines.push({ px: X, py: 0, nx: -1, ny: 0 }, { px: -X, py: 0, nx: 1, ny: 0 }, { px: 0, py: Y, nx: 0, ny: -1 }, { px: 0, py: -Y, nx: 0, ny: 1 }); }
  const mirror = (x, y, l) => { const d = (x - l.px) * l.nx + (y - l.py) * l.ny; return [x - 2 * d * l.nx, y - 2 * d * l.ny]; };
  const pts = [];
  for (const id of targets) { const b = w.balls[id]; if (!b.on) continue; at(b.x, b.y, 8, true); pts.push([b.x, b.y]); }
  for (const id of targets) { const b = w.balls[id]; if (!b.on) continue;
    for (const p of pockets) { const d = Math.hypot(p.x - b.x, p.y - b.y); if (d < 1e-6) continue; const gx = b.x - (p.x - b.x) / d * 2 * R, gy = b.y - (p.y - b.y) / d * 2 * R; at(gx, gy, 5, false); pts.push([gx, gy]); } }
  for (const [x, y] of pts.slice(0, pockets.length ? 12 : pts.length)) for (const l of lines) { const m = mirror(x, y, l); at(m[0], m[1], 3, false); if (!pockets.length && !w.shape && lines.length === 4) for (const l2 of lines) if (l2 !== l && l2.nx !== -l.nx) { const m2 = mirror(m[0], m[1], l2); at(m2[0], m2[1], 2, false); } }
  for (let a = 0; a < 360; a += 1.5) add(a * L.DEG);
  return out;
}
// every working shot from world `from` at turn t: phase one plain and level over the aims and four paces, then follow and
// draw on the aims at the balls, then (barricades) a raised cue over the first finds
function search(E, from, t, before, limit) {
  const z = E.z, pocket = L.Z.gameOf(z) === 'pocket', w = from || E.w0;
  const targets = pocket ? (z.pot || []).filter(id => !(before || []).includes(id)).concat(w.balls.filter(b => b.on && b.id && !(z.pot || []).includes(b.id)).map(b => b.id)) : [2, 3];
  const pockets = pocket ? (w.shape ? w.shape.holes : E.P.POCKETS) : [];
  const A = aims(E, w, pocket ? targets : [2, 3], pockets), paces = pocket ? [0.22, 0.38, 0.55, 0.75] : [0.24, 0.42, 0.6, 0.8], found = [];
  // (a turn that is not the last must leave something to do: a two-turn puzzle done in one shot is not kept that way)
  const last = t >= L.Z.turnsOf(z) - 1;
  const tryShot = s => { const r = L.turn(E, s, w, t, before), ok = r.ok && (last || !r.done); if (ok) { const tr = AI.traits(z, r.ev, s, t); found.push({ s, ev: r.ev, tr, D: AI.findD(z, tr, t), w: r.w, down: r.down }); } return ok; };
  for (const a of A) for (const p of paces) { tryShot([r9(a), L.g.vOf(p), 0, 0, 0]); if (found.length >= limit) return found; }
  const direct = A.slice(0, 40);
  for (const a of direct) for (const p of paces) for (const [sa, sb] of [[0, 0.45], [0, -0.45], [0.45, 0], [-0.45, 0]]) { tryShot([r9(a), L.g.vOf(p), sa, sb, 0]); if (found.length >= limit) return found; }
  if (z.walls && found.length < 4) for (const a of direct) for (const p of [0.55, 0.8]) tryShot([r9(a), L.g.vOf(p), 0, -0.2, 0.35]);
  return found;
}

/* ---------- one candidate ---------- */
// the obvious shot: straight at the nearer red (pocket: the plainest cut of the first ball to pot) - does it fail?
function naive(E, found) { return !found.some(f => (f.tr.cushions === 0 || f.tr.kick === 0) && !f.tr.side && !f.tr.fb && !f.tr.combo && !f.tr.bank); }
/* rate a candidate: search; the ways (families) - up to three, the easiest first - centred and weighed by the virtual
   players; a second turn searched from where each of the first's best ways leaves the balls. Returns the puzzle with its
   answer, rating and fun, or null */
function evaluate(z, seed) {
  const E = L.env(z), T = L.Z.turnsOf(z);
  let found = search(E, null, 0, [], 400);
  if (!found.length) return null;
  // a cushion asked for (on an outline): a rail a way meets before scoring that the easiest way does not - a whole rail
  // (tables.js rails: a curve's pieces one cushion), none shorter than RAIL.min (owner 11-25: generous, or it takes away
  // the player's own way), named by its middle edge
  if (z.wantNeed) {
    delete z.wantNeed;
    const R = E.w0.shape && E.w0.shape.spec ? E.w0.shape.spec.rails : null, railOf = e => R && R.of[e] != null ? R.of[e] : -1;
    const fam0 = AI.families(z, found), easy = new Set((fam0[0].best.ev.edges || []).map(e => railOf(e[0])));
    const met = found.flatMap(f => (f.ev.edges || []).filter(e => (L.Z.gameOf(z) === 'pocket' || e[1] < 2) && e[0] < 1000).map(e => railOf(e[0])));
    const cand = [...new Set(met)].filter(r => r >= 0 && !easy.has(r) && R.len[r] >= L.TABLE_OUTLINES.RAIL.min);
    if (!cand.length) return null;
    const r = cand[Math.floor(L.seeded(seed)() * cand.length)], es = R.edges[r];
    z.need = [es[Math.floor(es.length / 2)]];
    const E2 = L.env(z); found = found.filter(f => L.turn(E2, f.s, null, 0, []).ok).map(f => Object.assign(f, { D: AI.findD(z, f.tr, 0) }));
    if (!found.length) return null; return finish(z, L.env(z), found, seed, 1);
  }
  return finish(z, E, found, seed, T);
}
function finish(z, E, found, seed, T) {
  // (the three easiest routes to see, and the one with the most shots that work if it is not among them - with a whole
  // rail asked for (11-25) the easiest to see were sometimes needles while a wide way went unrated)
  const all = AI.families(z, found), fams = all.slice(0, 3), ways = [], wide = all.slice(3).sort((a, b) => b.n - a.n)[0];
  if (wide) fams.push(wide);
  let room = 0, sol = null;
  for (const f of fams) {
    const c = AI.centre(E, f.best.s, null, 0, []); if (!ways.length) room = c.room;
    const r1 = L.turn(E, c.s, null, 0, []); if (!r1.ok || (T > 1 && r1.done)) continue;
    if (T === 1) { ways.push([{ s: c.s, from: null, t: 0, before: [], D: f.D }]); if (!sol) sol = c.s; continue; }
    // two turns: the second searched from where the first (centred) leaves the balls
    const f2 = search(E, r1.w, 1, r1.down, 120); if (!f2.length) continue;
    const fam2 = AI.families(z, f2)[0], c2 = AI.centre(E, fam2.best.s, r1.w, 1, r1.down);
    ways.push([{ s: c.s, from: null, t: 0, before: [], D: f.D }, { s: c2.s, from: r1.w, t: 1, before: r1.down, D: fam2.D }]);
    if (!sol) sol = [c.s, c2.s];
  }
  if (!ways.length || !sol) return null;
  const rt = AI.rate(E, ways, seed);
  const out = Object.assign({}, z, { sol: T > 1 ? sol.map(s => s.map(r9)) : sol.map(r9), rating: rt.rating, fun: AI.fun(z, fams, room, naive(E, found)), room: Math.round(room * 1000) / 1000 });
  // the answer as stored, played again from the start as the app, the tests and the server play it
  const g = L.g, chk = L.Z.play(g, out, T > 1 ? out.sol : [out.sol], () => 0.5, 40); if (!chk.ok) return null;
  return out;
}

/* ---------- the worker ---------- */
function run() {
  const seed = +(opt('seed') || 1), minutes = +(opt('minutes') || 20), only = opt('game'), rnd = L.seeded(seed * 7919 + 13), file = path.join(POOLS, `pool-${seed}.json`);
  const pool = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
  // (what is there: the other workers' pools, this one's, and the list's puzzles that keep their places)
  const kept0 = listed().filter(roomOk);
  const all = () => [...fs.readdirSync(POOLS).filter(f => /^pool-\d+\.json$/.test(f) && f !== path.basename(file)).flatMap(f => { try { return JSON.parse(fs.readFileSync(path.join(POOLS, f), 'utf8')); } catch (e) { return []; } }), ...pool, ...kept0];
  const count = (kind, band) => all().filter(z => kindOf(z) === kind && bandOf(z.rating) === band).length;
  // (a band takes half as many again as it wants: the list keeps its most fun - write())
  const room = (kind, band) => count(kind, band) < Math.ceil(wantOf(kind, band) * 1.5);
  const end = Date.now() + minutes * 60000; let tried = 0, kept = 0;
  const pickOf = arr => arr[Math.floor(rnd() * arr.length)];
  while (Date.now() < end) {
    tried++;
    // what to make next: the kind whose bands want most (high plain bands want the hard positions)
    const want = k => BANDS.reduce((n, b) => n + Math.max(0, Math.ceil(wantOf(k, b) * 1.5) - count(k, b)), 0);
    const ks = (only === 'pocket' ? ['pocket'] : only === 'four' ? ['plain', 'cond'] : ['plain', 'cond', 'pocket']).filter(k => want(k) > 0);
    if (!ks.length) break;
    const kind = ks.sort((a, b) => want(b) - want(a))[rnd() < 0.7 ? 0 : Math.floor(rnd() * ks.length)];
    let z = null;
    if (kind === 'plain') {
      const hiWant = BANDS.filter(b => b >= 1300).reduce((n, b) => n + Math.max(0, wantOf('plain', b) - count('plain', b)), 0), loWant = BANDS.filter(b => b < 1300).reduce((n, b) => n + Math.max(0, wantOf('plain', b) - count('plain', b)), 0);
      const hard = rnd() < hiWant / Math.max(1, hiWant + loWant) ? 1 : 0, tropes = hard ? [pickOf(TROPES)].concat(rnd() < 0.5 ? [pickOf(TROPES)] : []) : [];
      const E = L.env({ game: 'four', goal: 'score', balls: [[-0.5, 0], [-0.5, 0.2], [0.3, 0], [0.5, 0]] }), balls = fourLayout(E, rnd, tropes);
      if (balls) z = { game: 'four', goal: 'score', balls };
    } else if (kind === 'cond') {
      // one or two conditions: a table of another shape, barricades, a goal, a cushion asked for, two turns
      const n = rnd() < 0.65 ? 1 : 2, conds = new Set(); while (conds.size < n) conds.add(pickOf(['table', 'table', 'walls', 'goal', 'need', 'turns']));
      if (conds.has('need') && !conds.has('table')) conds.add('table');
      if (conds.has('turns') && (conds.has('goal') || conds.has('need'))) conds.delete('turns');
      const table = conds.has('table') ? pickOf(L.TABLE_OUTLINES.ids.filter(id => id !== 'rect' || conds.has('need'))) : null;
      const goal = conds.has('goal') ? pickOf(['gather', 'bank', 'three', 'direct']) : 'score';
      let E = L.env({ game: 'four', goal, table, balls: [[-0.5, 0], [-0.5, 0.2], [0.3, 0], [0.5, 0]] });
      const balls = fourLayout(E, rnd, rnd() < 0.3 ? [pickOf(TROPES)] : []); if (!balls) continue;
      z = { game: 'four', goal, balls }; if (table) z.table = table; if (conds.has('turns')) z.turns = 2; if (conds.has('need')) z.wantNeed = true;
      if (conds.has('walls')) {
        // barricades across the easiest way: found first, then a bar dropped across the cue ball's path
        const E0 = L.env(z), easy = search(E0, null, 0, [], 6)[0]; if (!easy) continue;
        const walls = barsAcross(E0, z, easy, rnd); if (!walls) continue; z.walls = walls;
      }
    } else {
      const tier = rnd(), n = tier < 0.7 ? 1 : 2, turns = n === 2 && rnd() < 0.6 ? 2 : 1, blockers = Math.floor(rnd() * 4);
      const table = rnd() < 0.3 ? pickOf(L.TABLE_OUTLINES.ids) : null;
      const E = L.env({ game: 'pocket', goal: 'pot', pot: [1], table, balls: [[0, -0.5, 0], [1, 0.3, 0]] }), lay = pocketLayout(E, rnd, n, blockers); if (!lay) continue;
      z = { game: 'pocket', goal: 'pot', pot: lay.pot, balls: lay.balls }; if (lay.keep) z.keep = lay.keep; if (table) z.table = table; if (turns > 1) z.turns = 2;
      if (rnd() < 0.15 && table) z.wantNeed = true;
    }
    if (!z) continue;
    let out = null; try { out = evaluate(z, seed * 100003 + tried); } catch (e) { console.error('evaluate', e.message); continue; }
    if (!out) continue;
    const k = kindOf(out), b = bandOf(out.rating);
    if (out.rating >= 2895 || out.rating <= 205 || !room(k, b) || !roomOk(out)) continue;
    if (k === 'cond' && out.rating <= 800) continue;
    pool.push(out); kept++; fs.writeFileSync(file, JSON.stringify(pool));
    console.log(`${new Date().toISOString().slice(11, 19)} #${tried} kept ${kept}: ${k} ${out.rating} fun ${out.fun} room ${out.room}${out.table ? ' ' + out.table : ''}${out.walls ? ' walls' : ''}${out.need ? ' need' : ''}${out.turns ? ' 2턴' : ''}${out.goal !== 'score' && out.goal !== 'pot' ? ' ' + out.goal : ''}`);
  }
  console.log(`done: tried ${tried}, kept ${kept}, ${L.sims()} shots`);
}
// one or two barricades across the cue ball's path of an easy answer (each where no ball is, inside the table)
function barsAcross(E, z, easy, rnd) {
  const P = E.P, w = P.clone(E.w0), c = w.balls[0], a = easy.s[0], dx = Math.cos(a), dy = Math.sin(a), hit = P.cast(w, c.x, c.y, dx, dy, 0);
  const reach = hit && hit.t ? hit.t : 0.5; if (reach < 0.2) return null;
  const walls = [], n = rnd() < 0.6 ? 1 : 2, u = (lo, hi) => lo + (hi - lo) * rnd();
  for (let i = 0; i < n; i++) {
    let ok = false;
    for (let k = 0; k < 40 && !ok; k++) {
      const d = i ? null : u(0.1, reach - P.R - 0.02);
      const q = i ? { x: r6(u(-P.HL + 0.3, P.HL - 0.3)), y: r6(u(-P.HW + 0.2, P.HW - 0.2)), len: r6(u(0.15, 0.4)), thick: 0.03, ang: r6(u(-Math.PI, Math.PI)), h: 0.04 }
        : { x: r6(c.x + dx * d), y: r6(c.y + dy * d), len: r6(u(0.15, 0.4)), thick: 0.03, ang: r6(a + Math.PI / 2 + u(-0.35, 0.35)), h: 0.04 };
      const cs = Math.cos(q.ang), sn = Math.sin(q.ang), corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([s1, s2]) => [q.x + s1 * q.len / 2 * cs - s2 * q.thick / 2 * sn, q.y + s1 * q.len / 2 * sn + s2 * q.thick / 2 * cs]);
      if (!corners.every(([x, y]) => Math.abs(x) < P.HL - 2 * P.R && Math.abs(y) < P.HW - 2 * P.R && (!w.shape || P.inShape(w.shape, x, y)))) continue;
      const gap = b => Math.hypot(Math.max(0, Math.abs((b[0] - q.x) * cs + (b[1] - q.y) * sn) - q.len / 2), Math.max(0, Math.abs(-(b[0] - q.x) * sn + (b[1] - q.y) * cs) - q.thick / 2));
      if (!z.balls.every(b => gap(b) >= P.R + 0.006)) continue;
      if (walls.some(o => Math.hypot(o.x - q.x, o.y - q.y) < (o.len + q.len) / 2 + 0.07)) continue;
      walls.push(q); ok = true;
    }
    if (!ok) return null;
  }
  return walls;
}

/* ---------- writing the list ---------- */
function write() {
  const pools = fs.readdirSync(POOLS).filter(f => /^pool-\d+\.json$/.test(f)).flatMap(f => JSON.parse(fs.readFileSync(path.join(POOLS, f), 'utf8')));
  // (each new answer's speed snapped to one the power slider sets - its round trip - and played again; one that then fails is left out)
  const g = L.g, snapped = pools.map(z => { const T = L.Z.turnsOf(z), sh = (T > 1 ? z.sol : [z.sol]).map(s => [s[0], g.vOf(g.powerOf(s[1])), s[2], s[3], s[4]]); const q = Object.assign({}, z, { sol: T > 1 ? sh : sh[0] }); delete q.id; return L.Z.play(g, q, sh, () => 0.5, 40).ok ? q : null; }).filter(Boolean);
  const old = listed(), oldOk = old.filter(roomOk);
  console.log(`${pools.length} in the pools, ${snapped.length} still solved at the slider's speeds; the list ${old.length}, ${oldOk.length} with room enough for their bands`);
  // (two too alike - the same game and every ball within 2 cm - only one kept: the listed one, else the more fun)
  const keep = [];
  for (const z of oldOk.concat(snapped.sort((a, b) => b.fun - a.fun))) {
    const pos = q => q.game === 'pocket' ? q.balls.map(b => [b[1], b[2]]) : q.balls;
    if (keep.some(o => o.game === z.game && o.balls.length === z.balls.length && pos(o).every((p, i) => Math.hypot(p[0] - pos(z)[i][0], p[1] - pos(z)[i][1]) < 0.02))) continue;
    keep.push(z);
  }
  // each band: its most fun, as many as it wants
  const fill = {}; const kept = keep.sort((a, b) => b.fun - a.fun || (a.id ? -1 : 1)).filter(z => { const k = kindOf(z) + bandOf(z.rating); fill[k] = (fill[k] || 0) + 1; return fill[k] <= wantOf(kindOf(z), bandOf(z.rating)); });
  // (ids: a listed puzzle keeps its own; a new one the next never used - next-id.json; those left out are not used again)
  const NEXT = path.join(__dirname, 'next-id.json'), next = JSON.parse(fs.readFileSync(NEXT, 'utf8'));
  for (const z of kept.filter(q => !q.id).sort((a, b) => a.rating - b.rating)) z.id = z.game === 'pocket' ? next.pocket++ : next.four++;
  fs.writeFileSync(NEXT, JSON.stringify(next) + '\n');
  const four = kept.filter(z => z.game !== 'pocket').sort((a, b) => a.rating - b.rating || a.id - b.id), pocket = kept.filter(z => z.game === 'pocket').sort((a, b) => a.rating - b.rating || a.id - b.id);
  const order = ['id', 'game', 'goal', 'pot', 'keep', 'table', 'need', 'turns', 'balls', 'walls', 'sol', 'rating', 'fun'];
  const line = z => '    ' + JSON.stringify(Object.fromEntries(order.filter(k => z[k] != null).map(k => [k, z[k]])));
  const FILE = path.join(__dirname, '../../puzzles.js'), src = fs.readFileSync(FILE, 'utf8');
  const a = src.indexOf('  const list = [\n'), b = src.indexOf('\n  ];', a);
  fs.writeFileSync(FILE, src.slice(0, a) + '  const list = [\n' + four.concat(pocket).map(line).join(',\n') + src.slice(b));
  const show = list => { const by = {}; for (const z of list) { const k = bandOf(z.rating); by[k] = (by[k] || 0) + 1; } return Object.entries(by).map(([k, n]) => `${k}:${n}`).join(' '); };
  console.log(`wrote ${four.length} 4구 (${four.filter(z => L.Z.plain(z)).length} plain, ${four.concat(pocket).filter(z => old.some(o => o.id === z.id)).length} kept from the list) and ${pocket.length} 포켓 puzzles`);
  console.log(`  4구 plain ${show(four.filter(z => L.Z.plain(z)))}\n  4구 cond ${show(four.filter(z => !L.Z.plain(z)))}\n  포켓 ${show(pocket)}`);
}
if (require.main === module) { if (args[0] === 'write') write(); else run(); }
module.exports = { aims, search, evaluate, fourLayout, pocketLayout, BANDS, MIN_ROOM };
