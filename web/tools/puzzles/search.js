'use strict';
const { P, g, DEG, play, width } = require('./engine');
function aims(balls, stage, dense = false, walls = []) {
  const c = balls[0], out = [], seen = new Set();
  const add = a => { a = Math.atan2(Math.sin(a), Math.cos(a)); const key = a.toFixed(5); if (!seen.has(key)) { seen.add(key); out.push(a); } };
  const spread = (x, y, steps) => {
    const d = Math.hypot(x - c[0], y - c[1]), a = Math.atan2(y - c[1], x - c[0]), span = Math.asin(Math.min(0.99, 2 * P.R / d));
    for (let j = 0; j <= steps; j++) { const k = j === 0 ? 0 : Math.ceil(j / 2) * (j % 2 ? 1 : -1); add(a + k * span / Math.ceil(steps / 2)); }
  };
  for (const i of [2, 3]) spread(...balls[i], dense ? 80 : 24);
  if (stage === 2 || stage === 4 || stage === 5 || stage === 7) {
    const L = P.HL - P.R, W = P.HW - P.R, range = stage === 5 ? 2 : 1;
    for (let n = 1; n <= range * 2; n++) for (let x = -range; x <= range; x++) for (let y = -range; y <= range; y++) {
      if (Math.abs(x) + Math.abs(y) !== n) continue;
      for (const i of [2, 3]) spread(2 * L * x + (x % 2 ? -1 : 1) * balls[i][0], 2 * W * y + (y % 2 ? -1 : 1) * balls[i][1], 8);
    }
  }
  // Reflect the target in each effective wall face (ball radius included), then verify with the real engine.
  for (const q of walls) {
    const nx = -Math.sin(q.ang), ny = Math.cos(q.ang);
    for (const side of [-1, 1]) for (const i of [2, 3]) {
      const x = q.x + nx * side * (q.thick / 2 + P.R), y = q.y + ny * side * (q.thick / 2 + P.R);
      const d = (balls[i][0] - x) * nx + (balls[i][1] - y) * ny;
      spread(balls[i][0] - 2 * d * nx, balls[i][1] - 2 * d * ny, 12);
    }
  }
  return out;
}
function search(balls, stage, { yellow = true, flat = false, zero = false, limit = Infinity, walls = [] } = {}) {
  const goal = require('./engine').STAGES[stage].goal;
  const angles = aims(balls, stage, zero || flat, walls);
  const powers = stage === 1 ? [0.06, 0.1, 0.15, 0.2, 0.28] : stage === 3 ? [0.2, 0.3, 0.4, 0.55, 0.7] : stage === 6 && !flat ? [0.7, 0.85, 0.95, 0.6, 1] : stage === 5 ? [0.6, 0.75, 0.9, 0.45] : [0.18, 0.3, 0.45, 0.6, 0.8, 0.95];
  const spins = zero ? [[0, 0, 0]] : stage === 3 ? [[0, -0.7, 0], [0, -0.5, 0], [0, 0.65, 0]] : stage === 6 && !flat ? [[0, 0, 0.7], [0, -0.45, 0.8], [0, 0.45, 0.6], [0, 0, 0.95], [0.6, 0, 1.2], [-0.6, 0, 1.2]] : [[0, 0, 0], [0, 0.55, 0], [0, -0.55, 0], [0.6, 0, 0], [-0.6, 0, 0]];
  let tried = 0;
  // Cover angle, speed and spin before progressively refining the successful shot.
  for (const angle of angles) for (const power of powers) for (const [a, b, el] of spins) {
    const sol = [angle, g.vOf(power), a, b, el];
    const shot = play(balls, sol, goal, yellow, 30, walls);
    if (shot.ok && (stage !== 0 || shot.ev.cushions === 0) && (stage !== 7 || shot.ev.cushions + shot.ev.walls > 0)) return { sol, tried: ++tried };
    if (++tried >= limit) return null;
  }
  return null;
}
function refine(balls, sol, goal, walls = []) {
  let best = sol, bestWidth = width(balls, sol, goal, true, 2, walls).percent;
  // Search angle and speed around the first successful lattice point.
  for (const da of [-0.3, 0, 0.3]) for (const dv of [-0.025, 0, 0.025]) {
    const s = sol.slice(); s[0] += da * DEG; s[1] *= 1 + dv;
    if (!play(balls, s, goal, true, 30, walls).ok) continue;
    const rate = width(balls, s, goal, true, 2, walls).percent;
    if (rate > bestWidth) { best = s; bestWidth = rate; }
  }
  return best.map(n => +n.toFixed(9));
}
function counterexample(balls, sol, stage) {
  if (stage === 3) {
    // The entire direct collision cones, all slider speeds, plus a global sweep.
    const angles = [...aims(balls, stage, true), ...Array.from({ length: 360 }, (_, i) => i * DEG)];
    for (const angle of angles) for (let p = 0; p <= 20; p++) {
      if (play(balls, [angle, g.vOf(p / 20), 0, 0, 0], 'direct').ok) return true;
    }
  }
  if (stage === 6) {
    if (!require('./layouts').occluded(balls)) return true;
    // Geometry certifies all flat shots are blocked; also replay a flat neighbourhood.
    const flat = sol.slice(); flat[4] = 0;
    if (width(balls, flat, 'direct', true, 3).good) return true;
  }
  return false;
}
module.exports = { search, refine, counterexample };
