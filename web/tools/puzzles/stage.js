'use strict';
const { parentPort, workerData } = require('worker_threads');
const { STAGES, seeded, width, play, verify, simulations } = require('./engine');
const { propose, similar, occluded } = require('./layouts');
const { proposeWalls } = require('./walls');
const { search, refine, counterexample } = require('./search');
function generate(stage, seed, count = 10) {
  const rnd = seeded((seed ^ Math.imul(stage + 1, 0x9e3779b9)) >>> 0), found = [], report = [];
  for (let attempt = 1; found.length < count && attempt <= 3000; attempt++) {
    if (attempt % 25 === 0) console.log(`stage ${stage}: proposal ${attempt}, accepted ${found.length}/${count}`);
    // Reuse the existing close-ball proposal for the barricade stage; walls are proposed separately.
    const balls = propose(stage === 7 ? 0 : stage, rnd), goal = STAGES[stage].goal;
    if (stage === 6 && !occluded(balls) || found.some(z => similar(balls, z.balls))) continue;
    let open, walls, openTolerance, blocked;
    if (stage === 4) {
      open = search(balls, 0, { yellow: false, limit: 2000 });
      if (!open || play(balls, open.sol, 'score').ok || width(balls, open.sol, 'score', false, 3).percent < 50) continue;
    }
    if (stage === 7) {
      open = search(balls, 0, { zero: true, limit: 2000 });
      if (!open) continue;
      open.sol = refine(balls, open.sol, goal);
      if (width(balls, open.sol, goal, true, 3).percent < 50) continue;
      openTolerance = width(balls, open.sol, goal);
      if (openTolerance.percent < 50) continue;
      walls = proposeWalls(balls, open.sol, rnd, 1 + found.length % 3);
      if (!walls) continue;
      blocked = play(balls, open.sol, goal, true, 30, walls);
      if (blocked.ok || !blocked.ev.walls) continue;
    }
    const answer = search(balls, stage, { limit: stage === 5 || stage === 7 ? 14000 : 9000, walls });
    if (!answer) continue;
    const sol = refine(balls, answer.sol, goal, walls), tolerance = width(balls, sol, goal, true, 10, walls);
    if (tolerance.percent < 1 || tolerance.percent > 90 || counterexample(balls, sol, stage)) continue;
    const z = { stage, balls, sol, ...(walls ? { walls } : {}) }; verify({ ...z, id: 'candidate' });
    const answerShot = stage === 7 ? play(balls, sol, goal, true, 30, walls) : null;
    if (stage === 7 && !answerShot.ev.walls && !answerShot.ev.cushions) continue;
    found.push(z); report.push({ attempt, percent: tolerance.percent, good: tolerance.good, total: tolerance.total, open: open ? open.sol : undefined,
      ...(stage === 7 ? { openGood: openTolerance.good, openTotal: openTolerance.total, openPercent: openTolerance.percent, blockedWalls: blocked.ev.walls, wallCount: walls.length, solutionWalls: answerShot.ev.walls, solutionCushions: answerShot.ev.cushions } : {}) });
    console.log(`stage ${stage}: ${found.length}/${count}, width ${tolerance.percent.toFixed(1)}%, proposal ${attempt}, simulations ${simulations()}`);
  }
  if (found.length !== count) throw Error(`stage ${stage}: only ${found.length}/${count} after 3000 proposals`);
  const order = found.map((z, i) => ({ z, r: report[i] })).sort((a, b) => b.r.percent - a.r.percent);
  return { stage, puzzles: order.map(({ z }, i) => ({ id: (stage + 1) * 100 + i + 1, stage, n: i + 1, balls: z.balls, sol: z.sol, ...(z.walls ? { walls: z.walls } : {}) })), report: order.map(({ r }, i) => ({ id: (stage + 1) * 100 + i + 1, ...r })) };
}
if (parentPort) { try { parentPort.postMessage(generate(workerData.stage, workerData.seed, workerData.count)); } catch (e) { throw e; } }
module.exports = generate;
