'use strict';
const { P, valid } = require('./engine');
// Technique-conditioned random proposals, not a catalogue of hand-picked coordinates.
// Keep layout proposals separate so future barricades can be added here.
function propose(stage, rnd) {
  const r = (a, b) => a + (b - a) * rnd();
  for (;;) {
    let balls;
    if (stage === 3) {
      // Reds on opposite sides make a draw necessary for a cushion-free return.
      balls = [[0, 0], [r(-1, 1), r(-0.5, 0.5)], [r(0.18, 0.48), r(-0.025, 0.025)], [-r(0.12, 0.38), r(-0.06, 0.06)]];
    } else if (stage === 4 || stage === 6) {
      const d = stage === 6 ? r(0.16, 0.24) : r(0.22, 0.4);
      balls = [[0, 0], [d, r(-0.008, 0.008)], [r(0.55, 0.78), r(-0.06, 0.06)], [r(0.82, 1.08), r(-0.17, 0.17)]];
    } else if (stage < 2) {
      balls = [[0, 0], [r(-1, 1), r(-0.5, 0.5)], [r(0.12, 0.55), r(-0.2, 0.2)], [r(0.22, 0.8), r(-0.32, 0.32)]];
    } else {
      balls = Array.from({ length: 4 }, () => [r(-1, 1), r(-0.48, 0.48)]);
    }
    const angle = r(-Math.PI, Math.PI), c = Math.cos(angle), s = Math.sin(angle), tx = r(-0.4, 0.4), ty = r(-0.18, 0.18);
    balls = balls.map(([x, y]) => [+(x * c - y * s + tx).toFixed(6), +(x * s + y * c + ty).toFixed(6)]);
    if (valid(balls)) return balls;
  }
}
function similar(a, b) {
  // Red balls are interchangeable. Translated/rotated near-copies are also rejected.
  const signature = p => [Math.hypot(p[0][0] - p[1][0], p[0][1] - p[1][1]), ...[2, 3].map(i => Math.hypot(p[0][0] - p[i][0], p[0][1] - p[i][1])).sort((x, y) => x - y), Math.hypot(p[2][0] - p[3][0], p[2][1] - p[3][1])];
  const x = signature(a), y = signature(b);
  return Math.sqrt(x.reduce((s, v, i) => s + (v - y[i]) ** 2, 0) / x.length) < 0.045;
}
function occluded(balls) {
  // Both complete red-ball collision cones fit inside the yellow's cone.
  // A level cue ball cannot touch either red first, whatever its spin or speed.
  const [c, y] = balls, d = Math.hypot(y[0] - c[0], y[1] - c[1]), base = Math.atan2(y[1] - c[1], y[0] - c[0]), cone = Math.asin(2 * P.R / d);
  return balls.slice(2).every(b => {
    const dist = Math.hypot(b[0] - c[0], b[1] - c[1]), a = Math.atan2(b[1] - c[1], b[0] - c[0]);
    const da = Math.abs(Math.atan2(Math.sin(a - base), Math.cos(a - base)));
    return dist > d + 2 * P.R && da + Math.asin(2 * P.R / dist) < cone - 0.002;
  });
}
function samePosition(a, b) {
  const close = (x, y) => Math.hypot(x[0] - y[0], x[1] - y[1]) < 0.06;
  return close(a[0], b[0]) && close(a[1], b[1]) && ((close(a[2], b[2]) && close(a[3], b[3])) || (close(a[2], b[3]) && close(a[3], b[2])));
}
module.exports = { propose, similar, samePosition, occluded };
