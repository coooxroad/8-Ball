/* Teacher labels for the carom leave network (docs/ai-roadmap.md step 5; ai/56-leave-net.js): tables as they come up in
   play - bots of every rating playing each other - and some laid out at random, each with the leave for the player about
   to shoot as the judge's slow, careful sweep finds it (ai/60-judge.js leaveTeach). One JSON line a table:
     { m: mode, w: whose ball shoots, b: [[x, y], ...] every ball, y: the leave 0..1 }
   node web/tools/net/label.js <four|three> <how many> <seed> <out.jsonl> [workers]
   (GitHub Actions runs many of these at once: .github/workflows/label.yml) */
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
  const label = who => { const y = K().leaveTeach(g.world, who); emit({ m: mode, w: who, b: g.world.balls.map(b => [Math.round(b.x * 1e5) / 1e5, Math.round(b.y * 1e5) / 1e5]), y: Math.round(y * 1e4) / 1e4 }); };
  let made = 0;
  while (made < n) {
    if (rnd() < 0.3) {
      // a table laid out at random (every ball apart from the others)
      g.start(mode, ['A', 'B'], true, { level: 3, rnd, cushions: 3 }); g.isBreak = false;
      const w = g.world, R = P().R;
      for (const b of w.balls) { let x, y, k = 0; do { x = (rnd() * 2 - 1) * (P().HL - R * 1.2); y = (rnd() * 2 - 1) * (P().HW - R * 1.2); k++; } while (k < 50 && w.balls.some(o => o !== b && o.on && Math.hypot(o.x - x, o.y - y) < 2.2 * R)); P().place(w, b.id, x, y); }
      g.turn = rnd() < 0.5 ? 0 : 1; w.cue = g.turn; label(g.turn); made++;
      continue;
    }
    // a game between bots of two ratings, a table every few shots
    g.start(mode, ['A', 'B'], true, { level: 3, rnd, target: mode === 'three' ? 8 : 12, cushions: 3 });
    g.personas = [g.aiPersona(300 + rnd() * 2000, rnd, {}), g.aiPersona(300 + rnd() * 2000, rnd, {})];
    for (let k = 0; !g.over && k < 60 && made < n; k++) {
      if (!g.isBreak && rnd() < 0.35) { label(g.turn); made++; }
      const pl = g.aiPlan(); g.beginShot(); P().strike(g.world, pl.angle, pl.V, pl.a || 0, pl.b || 0, pl.el || null); P().run(g.world, 40); g.world.snd.length = 0; g.resolve();
    }
  }
}
if (isMainThread) {
  const [mode, n, seed, out, workers] = [process.argv[2], +process.argv[3] || 100, +process.argv[4] || 1, process.argv[5] || 'labels.jsonl', +process.argv[6] || require('os').cpus().length];
  if (!['four', 'three'].includes(mode)) { console.error('mode: four | three'); process.exit(1); }
  const f = fs.createWriteStream(out, { flags: 'a' }), per = Math.ceil(n / workers), t0 = Date.now(); let done = 0, alive = workers;
  for (let i = 0; i < workers; i++) {
    const w = new Worker(__filename, { workerData: { mode, n: per, seed: seed * 1000 + i } });
    w.on('message', m => { f.write(JSON.stringify(m) + '\n'); if (++done % 200 === 0) console.log(`${done}/${per * workers} · ${((Date.now() - t0) / done).toFixed(0)} ms a table`); });
    w.on('exit', () => { if (--alive === 0) f.end(() => console.log(`done: ${done} tables in ${((Date.now() - t0) / 1000).toFixed(0)} s`)); });
    w.on('error', e => { console.error(e); process.exitCode = 1; });
  }
} else work(workerData.mode, workerData.n, workerData.seed, m => parentPort.postMessage(m));
