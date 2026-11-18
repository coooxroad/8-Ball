/* Trains the carom leave network (ai/56-leave-net.js) on teacher labels (label.js) and writes its weights into
   ai/55-leave-net-w.js. Plain JavaScript, no libraries: a small network (two hidden layers of 64) trains on a CPU in minutes.
     node web/tools/net/train.js <four|three> <labels.jsonl or a folder of them> [epochs]
   It holds a tenth of the tables back and says how far the network is from the teacher on them (and how far always
   guessing the average would be), then keeps the best epoch's weights. */
const path = require('path'), fs = require('fs');
const W = path.join(__dirname, '..', '..');
const { leaveFeatures, netForward } = new Function('g', fs.readFileSync(path.join(W, 'ai', '56-leave-net.js'), 'utf8') + '\nreturn { leaveFeatures, netForward };')(null);
const P = require(path.join(W, 'physics.js'))({ R: 0.03275, pockets: false });
const mode = process.argv[2], src = process.argv[3], EPOCHS = +process.argv[4] || 60, H = [64, 64];
if (!['four', 'three'].includes(mode) || !src) { console.error('node train.js <four|three> <labels.jsonl | folder> [epochs]'); process.exit(1); }

// the tables: features and teacher's leave
const files = fs.statSync(src).isDirectory() ? fs.readdirSync(src, { recursive: true }).filter(f => /\.jsonl$/.test(f)).map(f => path.join(src, f)) : [src];
const X = [], Y = [];
for (const f of files) for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
  if (!line) continue; let r; try { r = JSON.parse(line); } catch (e) { continue; }
  if (r.m !== mode || !(r.y >= 0 && r.y <= 1)) continue;
  X.push(leaveFeatures(mode, r.b, r.w, P.HL, P.HW)); Y.push(r.y);
}
console.log(`${mode}: ${X.length} tables from ${files.length} file(s)`);
if (X.length < 500) { console.error('too few tables'); process.exit(1); }
// a tenth held back (every tenth, so a run of one game's tables does not all fall on one side)
const tr = [], va = []; X.forEach((_, i) => (i % 10 === 9 ? va : tr).push(i));
const D = X[0].length, mean = new Array(D).fill(0), std = new Array(D).fill(0);
for (const i of tr) X[i].forEach((v, k) => { mean[k] += v / tr.length; });
for (const i of tr) X[i].forEach((v, k) => { std[k] += (v - mean[k]) ** 2 / tr.length; });
for (let k = 0; k < D; k++) std[k] = Math.sqrt(std[k]) || 1;
const Z = X.map(x => Float64Array.from(x, (v, k) => (v - mean[k]) / std[k]));

// the network: He-initialised, Adam
let seed = 42; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296, gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
const sizes = [D, ...H, 1], L = sizes.length - 1;
const Wt = [], Bt = [], mW = [], vW = [], mB = [], vB = [];
for (let l = 0; l < L; l++) { const m = sizes[l], n = sizes[l + 1]; Wt.push(Float64Array.from({ length: m * n }, () => gauss() * Math.sqrt(2 / m))); Bt.push(new Float64Array(n)); mW.push(new Float64Array(m * n)); vW.push(new Float64Array(m * n)); mB.push(new Float64Array(n)); vB.push(new Float64Array(n)); }
function forward(x, acts) {
  acts[0] = x;
  for (let l = 0; l < L; l++) {
    const m = sizes[l], n = sizes[l + 1], a = acts[l], out = new Float64Array(n), w = Wt[l], b = Bt[l];
    for (let j = 0; j < n; j++) { let z = b[j]; for (let i = 0; i < m; i++) z += w[j * m + i] * a[i]; out[j] = l === L - 1 ? 1 / (1 + Math.exp(-z)) : z > 0 ? z : 0; }
    acts[l + 1] = out;
  }
  return acts[L][0];
}
const mae = idx => { const acts = []; let s = 0; for (const i of idx) s += Math.abs(forward(Z[i], acts) - Y[i]); return s / idx.length; };
const avg = tr.reduce((s, i) => s + Y[i], 0) / tr.length, base = va.reduce((s, i) => s + Math.abs(Y[i] - avg), 0) / va.length;
let t = 0, best = { mae: Infinity }; const BATCH = 128, b1 = 0.9, b2 = 0.999, eps = 1e-8;
for (let ep = 0; ep < EPOCHS; ep++) {
  const lr = 2e-3 * Math.pow(0.5, ep / 20);
  for (let i = tr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [tr[i], tr[j]] = [tr[j], tr[i]]; }
  for (let s = 0; s < tr.length; s += BATCH) {
    const gW = Wt.map(w => new Float64Array(w.length)), gB = Bt.map(b => new Float64Array(b.length)), acts = [];
    const nb = Math.min(BATCH, tr.length - s);
    for (let q = 0; q < nb; q++) {
      const i = tr[s + q], y = forward(Z[i], acts);
      let delta = [(y - Y[i]) * y * (1 - y) * 2 / nb];   // (squared error through the sigmoid)
      for (let l = L - 1; l >= 0; l--) {
        const m = sizes[l], n = sizes[l + 1], a = acts[l], w = Wt[l], prev = new Float64Array(m);
        for (let j = 0; j < n; j++) { const d = delta[j]; if (!d) continue; gB[l][j] += d; for (let k = 0; k < m; k++) { gW[l][j * m + k] += d * a[k]; prev[k] += d * w[j * m + k]; } }
        if (l) delta = Array.from(prev, (v, k) => acts[l][k] > 0 ? v : 0);
      }
    }
    t++;
    for (let l = 0; l < L; l++) {
      for (let k = 0; k < Wt[l].length; k++) { const gk = gW[l][k] + 1e-5 * Wt[l][k]; mW[l][k] = b1 * mW[l][k] + (1 - b1) * gk; vW[l][k] = b2 * vW[l][k] + (1 - b2) * gk * gk; Wt[l][k] -= lr * (mW[l][k] / (1 - b1 ** t)) / (Math.sqrt(vW[l][k] / (1 - b2 ** t)) + eps); }
      for (let k = 0; k < Bt[l].length; k++) { const gk = gB[l][k]; mB[l][k] = b1 * mB[l][k] + (1 - b1) * gk; vB[l][k] = b2 * vB[l][k] + (1 - b2) * gk * gk; Bt[l][k] -= lr * (mB[l][k] / (1 - b1 ** t)) / (Math.sqrt(vB[l][k] / (1 - b2 ** t)) + eps); }
    }
  }
  const v = mae(va);
  if (v < best.mae) best = { mae: v, ep, layers: Wt.map((w, l) => ({ n: sizes[l + 1], w: Array.from(w, x => Math.round(x * 1e5) / 1e5), b: Array.from(Bt[l], x => Math.round(x * 1e5) / 1e5) })) };
  if (ep % 5 === 4 || ep === EPOCHS - 1) console.log(`epoch ${ep + 1}: held-back error ${v.toFixed(4)} (always the average: ${base.toFixed(4)})`);
}
// the weights into ai/55-leave-net-w.js, beside any other game's
const file = path.join(W, 'ai', '55-leave-net-w.js'), had = fs.readFileSync(file, 'utf8'), m = /const LEAVE_NET = (\{[\s\S]*\});/.exec(had);
const nets = m ? Function(`return ${m[1]}`)() : {};
nets[mode] = { trained: new Date().toISOString().slice(0, 10), tables: X.length, error: Math.round(best.mae * 1e4) / 1e4, mean: mean.map(v => Math.round(v * 1e6) / 1e6), std: std.map(v => Math.round(v * 1e6) / 1e6), layers: best.layers };
// (a check that the written network is the one tested: the first held-back table through netForward)
const chk = netForward(nets[mode], X[va[0]]); console.log(`kept epoch ${best.ep + 1}, error ${best.mae.toFixed(4)}; check: ${chk.toFixed(4)} for the teacher's ${Y[va[0]]}`);
fs.writeFileSync(file, `  // the carom leave network's weights, written by web/tools/net/train.js (56-leave-net.js): per game, when trained, on how
  // many teacher's tables, its error on the tables held back (in leave, 0..1), and the network
  const LEAVE_NET = ${JSON.stringify(nets)};\n`);
console.log(`written: ${path.relative(process.cwd(), file)} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);
