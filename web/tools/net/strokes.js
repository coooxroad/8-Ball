/* Teacher labels for the stroke network (ai/58-stroke-net.js): tables as they come up in play - bots of every rating
   playing each other - and some laid out at random; for each ball the shooter may meet first, every stroke of STROKE_SET
   swept across it (32 aims, each scoring run's ends refined) and its best window's chance for the judge's reference hand.
   One JSON line a ball: { m: mode, w: whose ball shoots, f: the ball met first, b: [[x, y], ...] every ball, p: [chance a stroke] }
     node web/tools/net/strokes.js <four|three> <how many tables> <seed> <out.jsonl> [workers]
   (GitHub Actions runs many of these at once: .github/workflows/label-strokes.yml) */
const path = require('path'), fs = require('fs'), { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const W = path.join(__dirname, '..', '..');
function setup() {
  const createPhysics = require(path.join(W, 'physics.js')), createGameRaw = require(path.join(W, 'game.js'));
  const createAI = new Function('g', fs.readdirSync(path.join(W, 'ai')).sort().map(f => fs.readFileSync(path.join(W, 'ai', f), 'utf8')).join('\n'));
  const bar = { R: 0.028575, HL: 0.99, HW: 0.495, cornerMouth: 0.114, sideMouth: 0.127 };
  return createGameRaw({ pool: createPhysics(Object.assign({ pockets: true }, bar)), carom: createPhysics({ R: 0.03275, pockets: false }) }, createAI);
}
function work(mode, n, seed, emit) {
  const g = setup(); let s = seed >>> 0 || 1; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const K = () => g.aiJudge, P = () => g.P;
  const label = who => {
    const w = g.world, view = K().judgeView(w, who, null, false), c = w.balls[who], set = K().STROKE_SET[mode], R = P().R;
    const V = x => x * (mode === 'three' ? 5.0 : 3.3) * K().PACE.carom;
    for (const id of g.mode.legal(view, who).filter(i => w.balls[i] && w.balls[i].on)) {
      const T = w.balls[id], d = Math.hypot(T.x - c.x, T.y - c.y); if (d < 2 * R * 1.01) continue;
      const base = Math.atan2(T.y - c.y, T.x - c.x), half = Math.asin(Math.min(0.99, 2 * R / d)) * 0.985, steps = 32, p = [];
      for (const [v, a, b] of set) {
        const st = { V: V(v), a, b, el: 0, pos: null }, at = i => base - half + 2 * half * i / steps, scores = ang => K().judgeSim(w, who, { ...st, angle: ang }, view).made;
        const hit = []; for (let i = 0; i <= steps; i++) hit.push(scores(at(i)));
        let best = 0;
        for (let i = 0; i <= steps; i++) {
          if (!hit[i] || i && hit[i - 1]) continue;
          let j = i; while (j < steps && hit[j + 1]) j++;
          const edge = (inside, outside) => { let x = inside, y = outside; for (let k = 0; k < 3; k++) { const m = (x + y) / 2; if (scores(m)) x = m; else y = m; } return x; };
          const lo = i > 0 ? edge(at(i), at(i - 1)) : at(i), hi = j < steps ? edge(at(j), at(j + 1)) : at(j);
          best = Math.max(best, K().winChance((hi - lo) / 2)); i = j;
        }
        p.push(Math.round(best * 1000) / 1000);
      }
      emit({ m: mode, w: who, f: id, b: w.balls.map(b => [Math.round(b.x * 1e5) / 1e5, Math.round(b.y * 1e5) / 1e5]), p });
    }
  };
  let made = 0;
  while (made < n) {
    if (rnd() < 0.4) {
      g.start(mode, ['A', 'B'], true, { level: 3, rnd, cushions: 3 }); g.isBreak = false;
      const w = g.world, R = P().R;
      for (const b of w.balls) { let x, y, k = 0; do { x = (rnd() * 2 - 1) * (P().HL - R * 1.2); y = (rnd() * 2 - 1) * (P().HW - R * 1.2); k++; } while (k < 50 && w.balls.some(o => o !== b && o.id < b.id && Math.hypot(o.x - x, o.y - y) < 2.2 * R)); b.x = b.px = x; b.y = b.py = y; }
      g.turn = rnd() < 0.5 ? 0 : 1; w.cue = g.turn; label(g.turn); made++;
      continue;
    }
    g.start(mode, ['A', 'B'], true, { level: 3, rnd, target: mode === 'three' ? 8 : 12, cushions: 3 });
    g.personas = [g.aiPersona(300 + rnd() * 2000, rnd, {}), g.aiPersona(300 + rnd() * 2000, rnd, {})];
    for (let k = 0; !g.over && k < 60 && made < n; k++) {
      if (!g.isBreak && rnd() < 0.35) { label(g.turn); made++; }
      const pl = g.aiPlan(); g.beginShot(); P().strike(g.world, pl.angle, pl.V, pl.a || 0, pl.b || 0, pl.el || null); P().run(g.world, 40); g.world.snd.length = 0; g.resolve();
    }
  }
}
if (isMainThread) {
  const [mode, n, seed, out, workers] = [process.argv[2], +process.argv[3] || 100, +process.argv[4] || 1, process.argv[5] || 'strokes.jsonl', +process.argv[6] || require('os').cpus().length];
  if (!['four', 'three'].includes(mode)) { console.error('mode: four | three'); process.exit(1); }
  const f = fs.createWriteStream(out, { flags: 'a' }), per = Math.ceil(n / workers), t0 = Date.now(); let done = 0, alive = workers;
  for (let i = 0; i < workers; i++) {
    const w = new Worker(__filename, { workerData: { mode, n: per, seed: seed * 1000 + i } });
    w.on('message', m => { f.write(JSON.stringify(m) + '\n'); if (++done % 200 === 0) console.log(`${done} balls · ${((Date.now() - t0) / done).toFixed(0)} ms a ball`); });
    w.on('exit', () => { if (--alive === 0) f.end(() => console.log(`done: ${done} balls in ${((Date.now() - t0) / 1000).toFixed(0)} s`)); });
    w.on('error', e => { console.error(e); process.exitCode = 1; });
  }
} else work(workerData.mode, workerData.n, workerData.seed, m => parentPort.postMessage(m));
