/* 컴퓨터 대전's bots, each against itself: how each plays - the share of shots that score, its massés (and how many come off),
   cushion lines, safeties, the strokes it uses most, what a plan costs and how long it is shown thinking. Not a check: the
   picture to tune the bots' styles and quirks by (owner 11-19 night: chess.com's bots, NBA 2K's tendencies - ai/51-people.js).
     node web/tools/bots.js <mode> [games each] [bot ids, comma-separated]      e.g. four 3 lea,sean */
const path = require('path'), fs = require('fs'), W = path.join(__dirname, '..');
const createPhysics = require(path.join(W, 'physics.js')), createGameRaw = require(path.join(W, 'game.js'));
const { SNOOKER } = require(path.join(W, 'tables.js')); global.SNOOKER = SNOOKER;
const createAI = new Function('g', fs.readdirSync(path.join(W, 'ai')).sort().map(f => fs.readFileSync(path.join(W, 'ai', f), 'utf8')).join('\n'));
const bar = { R: 0.028575, HL: 0.99, HW: 0.495, cornerMouth: 0.114, sideMouth: 0.127 };
const g = createGameRaw({ pool: createPhysics(Object.assign({ pockets: true }, bar)), carom: createPhysics({ R: 0.03275, pockets: false }), snooker: createPhysics(SNOOKER.cfg) }, createAI);
const src = fs.readFileSync(path.join(W, 'app/34-desk-bots.js'), 'utf8'), at = src.indexOf('const BOTS = ') + 13;
const BOTS = new Function(`return ${src.slice(at, src.indexOf('];', at) + 1)}`)();
const mode = process.argv[2] || 'four', N = +process.argv[3] || 3, only = process.argv[4] ? process.argv[4].split(',') : null;
for (const b of BOTS.filter(b => !only || only.includes(b.id))) {
  let seed = 11; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const s = { n: 0, keep: 0, masse: 0, masseIn: 0, jump: 0, bank: 0, safety: 0, stroke: {}, ms: 0, think: 0, best: 0 };
  for (let k = 0; k < N; k++) {
    g.start(mode, ['A', 'B'], true, { level: 3, target: mode === 'three' ? 8 : mode === 'four' ? 10 : 12, rnd, cushions: 3 }); g.aiRnd = rnd;
    const pr = g.aiPersona(b.rating, rnd, { personality: b.personality, style: b.style, quirk: b.quirk }); g.personas = [pr, pr];
    let run = 0;
    for (let n = 0; !g.over && n < 150; n++) {
      const t = Date.now(), pl = g.aiPlan(); s.ms += Date.now() - t;
      if (pl.pos) { const c = g.cueBall(); c.x = c.px = pl.pos[0]; c.y = c.py = pl.pos[1]; }
      const turn = g.turn, counted = pl.decision !== 'break';
      if (counted) {
        s.n++; s.think += pl.think || 0; s.stroke[pl.stroke] = (s.stroke[pl.stroke] || 0) + 1;
        if (pl.decision === 'masse') s.masse++; if (pl.decision === 'jump') s.jump++; if (pl.decision === 'bank') s.bank++; if (pl.decision === 'safety') s.safety++;
      }
      g.beginShot(); g.P.strike(g.world, pl.angle, pl.V, pl.a || 0, pl.b || 0, pl.el || null); g.P.run(g.world, 40); g.world.snd.length = 0; g.resolve();
      const kept = g.over ? g.winner === turn : g.turn === turn;
      if (counted && kept) { s.keep++; run++; s.best = Math.max(s.best, run); if (pl.decision === 'masse') s.masseIn++; } else run = 0;
    }
  }
  const pc = x => `${Math.round(100 * x / Math.max(1, s.n))}%`;
  const top = Object.entries(s.stroke).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${pc(v)}`).join(', ');
  console.log([b.name.padEnd(5), b.rating, b.style.padEnd(9), (b.quirk || '-').padEnd(7), `샷 ${s.n}`, `득점 ${pc(s.keep)}`, `최장 ${s.best}`,
    `맛세이 ${(s.masse / N).toFixed(1)}/판(${s.masseIn} 성공)`, `점프 ${s.jump}`, `쿠션 ${pc(s.bank)}`, `수비 ${pc(s.safety)}`, '|', top, '|',
    `${Math.round(s.ms / Math.max(1, s.n))} ms`, `${(s.think / Math.max(1, s.n)).toFixed(1)} s`].join(' '));
}
