'use strict';
const { parentPort, workerData } = require('worker_threads');
const { STAGES, seeded, width, play, verify, simulations } = require('./engine');
const { propose, similar, occluded } = require('./layouts');
const { search, refine, counterexample } = require('./search');
function generate(stage, seed, count = 10) {
  const rnd = seeded((seed ^ Math.imul(stage + 1, 0x9e3779b9)) >>> 0), found = [], report = [];
  for (let attempt = 1; found.length < count && attempt <= 3000; attempt++) {
    if (attempt % 25 === 0) console.log(`stage ${stage}: proposal ${attempt}, accepted ${found.length}/${count}`);
    const balls = propose(stage, rnd), goal = STAGES[stage].goal;
    if (stage === 6 && !occluded(balls) || found.some(z => similar(balls, z.balls))) continue;
    let open;
    if (stage === 4) {
      open = search(balls, 0, { yellow: false, limit: 2000 });
      if (!open || play(balls, open.sol, 'score').ok || width(balls, open.sol, 'score', false, 3).percent < 50) continue;
    }
    const answer = search(balls, stage, { limit: stage === 5 ? 14000 : 9000 });
    if (!answer) continue;
    const sol = refine(balls, answer.sol, goal), tolerance = width(balls, sol, goal);
    if (tolerance.percent < 1 || tolerance.percent > 90 || counterexample(balls, sol, stage)) continue;
    const z = { stage, balls, sol }; verify({ ...z, id: 'candidate' });
    found.push(z); report.push({ attempt, percent: tolerance.percent, good: tolerance.good, total: tolerance.total, open: open ? open.sol : undefined });
    console.log(`stage ${stage}: ${found.length}/${count}, width ${tolerance.percent.toFixed(1)}%, proposal ${attempt}, simulations ${simulations()}`);
  }
  if (found.length !== count) throw Error(`stage ${stage}: only ${found.length}/${count} after 3000 proposals`);
  const order = found.map((z, i) => ({ z, r: report[i] })).sort((a, b) => b.r.percent - a.r.percent);
  return { stage, puzzles: order.map(({ z }, i) => ({ id: (stage + 1) * 100 + i + 1, stage, n: i + 1, balls: z.balls, sol: z.sol })), report: order.map(({ r }, i) => ({ id: (stage + 1) * 100 + i + 1, ...r })) };
}
if (parentPort) { try { parentPort.postMessage(generate(workerData.stage, workerData.seed, workerData.count)); } catch (e) { throw e; } }
module.exports = generate;
