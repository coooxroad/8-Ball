/* Bots of given ratings play each other; every shot is judged (ai/60-judge.js) - how the grades fall at each rating, the
   average loss per shot (what app/50-review.js REVIEW_PERF turns into a game's rating), and what a judging costs.
     node web/tools/judge-games.js <mode> <ratings, comma-separated> [games each]     e.g. eight 300,700,1100,1500,1900,2300 3 */
const path = require('path'), fs = require('fs'), W = path.join(__dirname, '..');
const createPhysics = require(path.join(W, 'physics.js')), createGameRaw = require(path.join(W, 'game.js'));
const { SNOOKER } = require(path.join(W, 'tables.js')); global.SNOOKER = SNOOKER;
const createAI = new Function('g', fs.readdirSync(path.join(W, 'ai')).sort().map(f => fs.readFileSync(path.join(W, 'ai', f), 'utf8')).join('\n'));
const bar = { R: 0.028575, HL: 0.99, HW: 0.495, cornerMouth: 0.114, sideMouth: 0.127 };
const g = createGameRaw({ pool: createPhysics(Object.assign({ pockets: true }, bar)), carom: createPhysics({ R: 0.03275, pockets: false }), snooker: createPhysics(SNOOKER.cfg) }, createAI);
const mode = process.argv[2] || 'eight', ratings = (process.argv[3] || '600,1500,2300').split(',').map(Number), N = +process.argv[4] || 2;
let seed = 99; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
const GR = ['예술', '좋음', '무난', '아쉬움', '실수'];
for (const rating of ratings) {
  const s = { n: 0, grades: [0, 0, 0, 0, 0], fluke: 0, made: 0, loss: 0, ms: 0, worst: 0, causes: {} };
  for (let k = 0; k < N; k++) {
    g.start(mode, ['A', 'B'], true, { level: 3, target: mode === 'three' ? 6 : mode === 'four' ? 10 : 12, rnd, cushions: 3 });
    const pr = g.aiPersona(rating, rnd, {}); g.personas = [pr, pr];
    for (let n = 0; !g.over && n < 140; n++) {
      const wasBreak = g.isBreak, pl = g.aiPlan();
      if (pl.pos) { const c = g.cueBall(); c.x = c.px = pl.pos[0]; c.y = c.py = pl.pos[1]; }
      if (!(wasBreak && g.P.POCKETED)) {
        const t = Date.now(), r = g.aiReview({ pos: null, angle: pl.angle, V: pl.V, a: pl.a || 0, b: pl.b || 0, el: pl.el || 0 }), ms = Date.now() - t;
        s.ms += ms; s.worst = Math.max(s.worst, ms);
        if (r) { s.n++; s.grades[r.grade]++; if (r.fluke) s.fluke++; if (r.made) s.made++; s.loss += r.loss; if (r.cause) s.causes[r.cause] = (s.causes[r.cause] || 0) + 1; }
      }
      g.beginShot(); g.P.strike(g.world, pl.angle, pl.V, pl.a || 0, pl.b || 0, pl.el || null); g.P.run(g.world, 40); g.world.snd.length = 0; g.resolve();
    }
  }
  console.log(`${mode} ${rating}: shots ${s.n} made ${(100 * s.made / s.n).toFixed(0)}% avg loss ${(s.loss / s.n).toFixed(2)} | ${GR.map((x, i) => `${x} ${(100 * s.grades[i] / s.n).toFixed(0)}%`).join(' ')} | 요행 ${s.fluke} | ${(s.ms / s.n).toFixed(0)} ms a shot, ${s.worst} at worst | ${JSON.stringify(s.causes)}`);
}
