'use strict';
const { P } = require('./engine');
const DIAMETER = 2 * P.R, CLEARANCE = 0.003;
function corners(q) {
  const c = Math.cos(q.ang), s = Math.sin(q.ang);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [q.x + u * q.len / 2 * c - v * q.thick / 2 * s, q.y + u * q.len / 2 * s + v * q.thick / 2 * c]);
}
function pointGap(b, q) {
  const c = Math.cos(q.ang), s = Math.sin(q.ang), x = b[0] - q.x, y = b[1] - q.y;
  return Math.hypot(Math.max(0, Math.abs(x * c + y * s) - q.len / 2), Math.max(0, Math.abs(-x * s + y * c) - q.thick / 2));
}
function segmentGap(p, a, b) {
  const x = b[0] - a[0], y = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * x + (p[1] - a[1]) * y) / (x * x + y * y)));
  return Math.hypot(p[0] - a[0] - t * x, p[1] - a[1] - t * y);
}
function wallGap(a, b) {
  const A = corners(a), B = corners(b);
  const separated = [a.ang, a.ang + Math.PI / 2, b.ang, b.ang + Math.PI / 2].some(angle => {
    const project = p => p[0] * Math.cos(angle) + p[1] * Math.sin(angle), u = A.map(project), v = B.map(project);
    return Math.max(...u) < Math.min(...v) || Math.max(...v) < Math.min(...u);
  });
  if (!separated) return 0; // Crossing thin rectangles need a separating-axis check, not just vertex containment.
  let gap = Infinity;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) gap = Math.min(gap, segmentGap(A[i], B[j], B[(j + 1) % 4]), segmentGap(B[i], A[j], A[(j + 1) % 4]));
  return gap;
}
function validWalls(balls, walls) {
  return Array.isArray(walls) && walls.length >= 1 && walls.length <= 3 && walls.every((q, i) =>
    ['x', 'y', 'len', 'thick', 'ang', 'h'].every(k => Number.isFinite(q[k])) && q.len >= 0.15 && q.len <= 0.5 && q.thick === 0.03 && q.h === 0.04 &&
    corners(q).every(([x, y]) => Math.abs(x) <= P.HL - DIAMETER && Math.abs(y) <= P.HW - DIAMETER) &&
    balls.every(b => pointGap(b, q) >= P.R + CLEARANCE) && walls.slice(0, i).every(p => wallGap(p, q) >= DIAMETER));
}
function proposeWalls(balls, open, rnd, count = 1 + Math.floor(rnd() * 3)) {
  const w = P.makeWorld(4); balls.forEach((b, i) => P.place(w, i, ...b));
  const angle = open[0], dx = Math.cos(angle), dy = Math.sin(angle), hit = P.cast(w, ...balls[0], dx, dy, 0);
  if (hit.type !== 'ball' || hit.ball === 1 || hit.t < DIAMETER * 2) return null;
  const walls = [], r = (a, b) => a + (b - a) * rnd(), round = x => +x.toFixed(6);
  for (let i = 0; i < count; i++) {
    let found = false;
    for (let attempt = 0; attempt < 60 && !found; attempt++) {
      const d = r(DIAMETER, hit.t - P.R), q = {
        x: round(i ? r(-P.HL + 0.3, P.HL - 0.3) : balls[0][0] + dx * d),
        y: round(i ? r(-P.HW + 0.2, P.HW - 0.2) : balls[0][1] + dy * d),
        len: round(r(0.15, 0.5)), thick: 0.03, ang: round(i ? r(-Math.PI, Math.PI) : angle + Math.PI / 2 + r(-0.35, 0.35)), h: 0.04,
      };
      if (validWalls(balls, walls.concat(q))) { walls.push(q); found = true; }
    }
    if (!found) return null;
  }
  return walls;
}
module.exports = { corners, pointGap, wallGap, validWalls, proposeWalls };
