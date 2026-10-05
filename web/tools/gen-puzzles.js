/* Makes web/puzzles.js: the four-ball puzzles, each a position that has been checked to have a way to score.
   Run by hand when the set should change:  node web/tools/gen-puzzles.js
   A position is drawn at random to a tier's recipe, every direction at three speeds is played out on it, and it is kept
   if the share of shots that score falls in the range that tier asks for (a smaller share is a harder puzzle). */
const path = require('path'), fs = require('fs'), W = path.join(__dirname, '..');
const createPhysics = require(path.join(W, 'physics.js'));
const P = createPhysics({ R: 0.03275, pockets: false }), { R, HL, HW } = P;
let seed = 20261005; const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const between = (a, b) => a + (b - a) * rnd(), NA = 720, VS = [2.4, 3.4, 4.6];
const spot = () => [between(-HL + 0.12, HL - 0.12), between(-HW + 0.12, HW - 0.12)];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const segDist = (p, w) => { const dx = w[2] - w[0], dy = w[3] - w[1], l2 = dx * dx + dy * dy, u = Math.max(0, Math.min(1, ((p[0] - w[0]) * dx + (p[1] - w[1]) * dy) / l2)); return Math.hypot(p[0] - w[0] - dx * u, p[1] - w[1] - dy * u); };
function world(balls, walls) { const w = P.makeWorld(4); balls.forEach((b, i) => P.place(w, i, b[0], b[1], () => 0.5)); w.walls = walls.length ? walls.map(q => P.wall(q[0], q[1], q[2], q[3])) : null; return w; }
// every direction at each speed: which score, how many, and the middle of the widest run of scoring directions
function solve(balls, walls) {
  const base = world(balls, walls); let hits = 0, best = null;
  for (const V of VS) {
    const ok = new Array(NA).fill(false), info = new Array(NA);
    for (let i = 0; i < NA; i++) { const w = P.clone(base); P.strike(w, i * 2 * Math.PI / NA, V, 0, 0); const ev = P.run(w, 25); if (ev.hits.includes(2) && ev.hits.includes(3) && !ev.hits.includes(1)) { ok[i] = true; hits++; info[i] = { first: ev.hits[0], cush: ev.cushions }; } }
    for (let i = 0; i < NA; i++) if (ok[i] && !ok[(i + NA - 1) % NA]) { let n = 1; while (n < NA && ok[(i + n) % NA]) n++; if (!best || n > best.n) { const m = (i + Math.floor((n - 1) / 2)) % NA; best = { n, angle: m * 2 * Math.PI / NA, V, first: info[m].first, cush: info[m].cush }; } }
  }
  return { share: hits / (NA * VS.length), best };
}
// a bar across the line from a to b, somewhere along it
function barAcross(a, b, len) { const k = between(0.35, 0.65), mx = a[0] + (b[0] - a[0]) * k, my = a[1] + (b[1] - a[1]) * k, l = dist(a, b) || 1, nx = -(b[1] - a[1]) / l, ny = (b[0] - a[0]) / l, tilt = between(-0.5, 0.5), c = Math.cos(tilt), s = Math.sin(tilt), ux = nx * c - ny * s, uy = nx * s + ny * c; return [mx - ux * len / 2, my - uy * len / 2, mx + ux * len / 2, my + uy * len / 2]; }
const TIERS = [
  { name: '가까운 두 공', lo: 0.04, hi: 0.2, make() { const r1 = spot(), a = between(0, 6.28), d = between(0.14, 0.32), r2 = [r1[0] + Math.cos(a) * d, r1[1] + Math.sin(a) * d]; return { balls: [spot(), spot(), r1, r2], walls: [] }; }, ok: b => dist(b[0], b[2]) > 0.45 && dist(b[0], b[2]) < 1.1 },
  { name: '멀리 떨어진 두 공', lo: 0.012, hi: 0.04, make() { return { balls: [spot(), spot(), spot(), spot()], walls: [] }; }, ok: b => dist(b[2], b[3]) > 0.9 },
  { name: '노란 공 피하기', lo: 0.006, hi: 0.03, make() { const c = spot(), r1 = spot(), k = between(0.35, 0.65), y = [c[0] + (r1[0] - c[0]) * k + between(-0.03, 0.03), c[1] + (r1[1] - c[1]) * k + between(-0.03, 0.03)]; return { balls: [c, y, r1, spot()], walls: [] }; }, ok: b => dist(b[0], b[2]) > 0.6 && dist(b[0], b[2]) < dist(b[0], b[3]) },
  { name: '바리케이드', lo: 0.004, hi: 0.025, block: 0.6, make() { const c = spot(), r1 = spot(), r2 = spot(), mid = [(r1[0] + r2[0]) / 2, (r1[1] + r2[1]) / 2]; return { balls: [c, spot(), r1, r2], walls: [barAcross(c, mid, between(0.45, 0.8))] }; }, ok: b => dist(b[0], b[2]) > 0.55 && dist(b[0], b[3]) > 0.55 },
  { name: '미로', lo: 0.002, hi: 0.03, block: 0.75, make() { const c = spot(), r1 = spot(), r2 = spot(); return { balls: [c, spot(), r1, r2], walls: [barAcross(c, r1, between(0.4, 0.7)), barAcross(r1, r2, between(0.35, 0.6))] }; }, ok: b => dist(b[0], b[2]) > 0.55 && dist(b[2], b[3]) > 0.5 },
];
const valid = q => {
  const b = q.balls;
  for (let i = 0; i < 4; i++) { if (Math.abs(b[i][0]) > HL - R - 0.03 || Math.abs(b[i][1]) > HW - R - 0.03) return false; for (let j = 0; j < i; j++) if (dist(b[i], b[j]) < 2 * R + 0.05) return false; for (const w of q.walls) if (segDist(b[i], w) < R + 0.012 + 0.035) return false; }
  for (const w of q.walls) { for (const k of [0, 2]) if (Math.abs(w[k]) > HL - 0.1 || Math.abs(w[k + 1]) > HW - 0.1) return false; }
  if (q.walls.length === 2) { const [u, v] = q.walls; if (segDist([u[0], u[1]], v) < 0.12 || segDist([u[2], u[3]], v) < 0.12 || segDist([v[0], v[1]], u) < 0.12 || segDist([v[2], v[3]], u) < 0.12) return false; }
  return true;
};
const PER = 8, out = [], r3 = x => Math.round(x * 1000) / 1000;
// the stored answer has to survive being played a touch off: a hair either side, a little softer or harder
function sturdy(q, best) {
  const base = world(q.balls, q.walls);
  for (const da of [0, 0.003, -0.003]) for (const k of [1, 0.985, 1.015]) { const w = P.clone(base); P.strike(w, best.angle + da, best.V * k, 0, 0); const ev = P.run(w, 25); if (!(ev.hits.includes(2) && ev.hits.includes(3) && !ev.hits.includes(1))) return false; }
  return true;
}
TIERS.forEach((T, ti) => {
  const found = []; let tries = 0;
  while (found.length < PER && tries < 4000) {
    tries++; const q = T.make(); q.balls = q.balls.map(b => b.map(r3)); q.walls = q.walls.map(w => w.map(r3));   // solved exactly as it will be stored
    if (!valid(q) || !T.ok(q.balls)) continue;
    const s = solve(q.balls, q.walls); if (!s.best || s.share < T.lo || s.share > T.hi || s.best.n < 3) continue;
    s.best.angle = Math.round(s.best.angle * 1e5) / 1e5; if (!sturdy(q, s.best)) continue;
    if (T.block) { const open = solve(q.balls, []); if (!(s.share < open.share * T.block)) continue; }   // the bars have to be what makes it hard
    found.push({ share: s.share, balls: q.balls, walls: q.walls, sol: [s.best.angle, s.best.V], first: s.best.first, cush: s.best.cush });
    process.stderr.write(`tier ${ti + 1}: ${found.length}/${PER} after ${tries} tries (share ${(s.share * 100).toFixed(2)}%)\n`);
  }
  found.sort((a, b) => b.share - a.share);                        // easiest first within a tier
  for (const f of found) out.push({ id: out.length + 1, tier: ti, balls: f.balls, walls: f.walls, sol: f.sol, first: f.first, cush: f.cush });
});
const js = `/* Four-ball puzzles: positions with one shot to score. Made by tools/gen-puzzles.js, which checked that each has an answer
   (sol: [direction, speed] of one that works, with no spin). balls: cue, yellow, red, red. walls: barricades as [x0, y0, x1, y1]. */
function createPuzzles() {
  const TIERS = ${JSON.stringify(TIERS.map(t => t.name))};
  const list = [
${out.map(p => '    ' + JSON.stringify(p)).join(',\n')},
  ];
  return { list, TIERS, byId: id => list.find(p => p.id === id) };
}
if (typeof module !== 'undefined') module.exports = createPuzzles;
`;
fs.writeFileSync(path.join(W, 'puzzles.js'), js);
console.log(`wrote ${out.length} puzzles`);
