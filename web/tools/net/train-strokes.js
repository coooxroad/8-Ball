/* Trains the stroke network (ai/58-stroke-net.js) on teacher labels (strokes.js) and writes its weights into
   ai/57-stroke-net-w.js. Plain JavaScript, no libraries: two hidden layers of 64, one output a stroke (its chance off
   that ball). A table seen in a mirror (strokeFeatures' flip) has its strokes' sides swapped, so its labels are too.
     node web/tools/net/train-strokes.js <four|three> <labels.jsonl or a folder of them> [epochs]
   It holds a tenth back and says, on those, how often the teacher's best stroke is among the network's five, and how much
   chance the five give away against it - then keeps the best epoch's weights. */
const path = require('path'), fs = require('fs');
const W = path.join(__dirname, '..', '..');
const src0 = ['57-stroke-net-w.js', '58-stroke-net.js'].map(f => fs.readFileSync(path.join(W, 'ai', f), 'utf8')).join('\n');
const { STROKE_SET, strokeFeatures, strokeMirror, netForwardAll } = new Function('g', src0 + '\nreturn { STROKE_SET, strokeFeatures, strokeMirror, netForwardAll };')({});
const P = require(path.join(W, 'physics.js'))({ R: 0.03275, pockets: false });
const mode = process.argv[2], src = process.argv[3], EPOCHS = +process.argv[4] || 40, H = [64, 64], TOP = 5;
if (!['four', 'three'].includes(mode) || !src) { console.error('node train-strokes.js <four|three> <labels.jsonl | folder> [epochs]'); process.exit(1); }
const S = STROKE_SET[mode].length, mir = strokeMirror(mode);
const files = fs.statSync(src).isDirectory() ? fs.readdirSync(src, { recursive: true }).filter(f => /\.jsonl$/.test(f)).map(f => path.join(src, f)) : [src];
const X = [], Y = [];
for (const f of files) for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
  if (!line) continue; let r; try { r = JSON.parse(line); } catch (e) { continue; }
  if (r.m !== mode || !Array.isArray(r.p) || r.p.length !== S) continue;
  const ft = strokeFeatures(mode, r.b, r.w, r.f, P.HL, P.HW);
  X.push(ft.x); Y.push(ft.flip ? r.p.map((_, i) => r.p[mir[i]]) : r.p.slice());
}
console.log(`${mode}: ${X.length} balls from ${files.length} file(s)`);
if (X.length < 500) { console.error('too few'); process.exit(1); }
const tr = [], va = []; X.forEach((_, i) => (i % 10 === 9 ? va : tr).push(i));
const D = X[0].length, mean = new Array(D).fill(0), std = new Array(D).fill(0);
for (const i of tr) X[i].forEach((v, k) => { mean[k] += v / tr.length; });
for (const i of tr) X[i].forEach((v, k) => { std[k] += (v - mean[k]) ** 2 / tr.length; });
for (let k = 0; k < D; k++) std[k] = Math.sqrt(std[k]) || 1;
const Z = X.map(x => Float64Array.from(x, (v, k) => (v - mean[k]) / std[k]));
let seed = 42; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296, gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
const sizes = [D, ...H, S], L = sizes.length - 1;
const Wt = [], Bt = [], mW = [], vW = [], mB = [], vB = [];
for (let l = 0; l < L; l++) { const m = sizes[l], n = sizes[l + 1]; Wt.push(Float64Array.from({ length: m * n }, () => gauss() * Math.sqrt(2 / m))); Bt.push(new Float64Array(n)); mW.push(new Float64Array(m * n)); vW.push(new Float64Array(m * n)); mB.push(new Float64Array(n)); vB.push(new Float64Array(n)); }
function forward(x, acts) {
  acts[0] = x;
  for (let l = 0; l < L; l++) {
    const m = sizes[l], n = sizes[l + 1], a = acts[l], out = new Float64Array(n), w = Wt[l], b = Bt[l];
    for (let j = 0; j < n; j++) { let z = b[j]; const o = j * m; for (let i = 0; i < m; i++) z += w[o + i] * a[i]; out[j] = l === L - 1 ? 1 / (1 + Math.exp(-z)) : z > 0 ? z : 0; }
    acts[l + 1] = out;
  }
  return acts[L];
}
// held back: the teacher's best stroke among the network's five, and the chance the five give away
function score(idx) {
  const acts = []; let hit = 0, lost = 0, n = 0;
  for (const i of idx) {
    const y = Y[i], top = Math.max(...y); if (top < 0.05) continue; n++;
    const p = forward(Z[i], acts), five = Array.from(p, (v, k) => [v, k]).sort((a, b) => b[0] - a[0]).slice(0, TOP).map(x => x[1]);
    const got = Math.max(...five.map(k => y[k])); if (got >= top - 1e-9) hit++; lost += top - got;
  }
  return { hit: hit / n, lost: lost / n, n };
}
// (and the same for a fixed five - the judge's old way, roughly: the five strokes best on average)
const avgY = new Array(S).fill(0); for (const i of tr) Y[i].forEach((v, k) => { avgY[k] += v; });
const fixed = avgY.map((v, k) => [v, k]).sort((a, b) => b[0] - a[0]).slice(0, TOP).map(x => x[1]);
{ let hit = 0, lost = 0, n = 0; for (const i of va) { const y = Y[i], top = Math.max(...y); if (top < 0.05) continue; n++; const got = Math.max(...fixed.map(k => y[k])); if (got >= top - 1e-9) hit++; lost += top - got; }
  console.log(`a fixed five: best among them ${(100 * hit / n).toFixed(1)}%, chance given away ${(lost / n).toFixed(4)}`); }
let t = 0, best = { lost: Infinity }; const BATCH = 128, b1 = 0.9, b2 = 0.999, eps = 1e-8;
for (let ep = 0; ep < EPOCHS; ep++) {
  const lr = 2e-3 * Math.pow(0.5, ep / 15);
  for (let i = tr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [tr[i], tr[j]] = [tr[j], tr[i]]; }
  for (let s = 0; s < tr.length; s += BATCH) {
    const gW = Wt.map(w => new Float64Array(w.length)), gB = Bt.map(b => new Float64Array(b.length)), acts = [];
    const nb = Math.min(BATCH, tr.length - s);
    for (let q = 0; q < nb; q++) {
      const i = tr[s + q], y = forward(Z[i], acts), t0 = Y[i];
      let delta = Array.from(y, (v, k) => (v - t0[k]) * v * (1 - v) * 2 / nb);
      for (let l = L - 1; l >= 0; l--) {
        const m = sizes[l], n = sizes[l + 1], a = acts[l], w = Wt[l], prev = new Float64Array(m);
        for (let j = 0; j < n; j++) { const d = delta[j]; if (!d) continue; gB[l][j] += d; const o = j * m; for (let k = 0; k < m; k++) { gW[l][o + k] += d * a[k]; prev[k] += d * w[o + k]; } }
        if (l) delta = Array.from(prev, (v, k) => acts[l][k] > 0 ? v : 0);
      }
    }
    t++;
    for (let l = 0; l < L; l++) {
      for (let k = 0; k < Wt[l].length; k++) { const gk = gW[l][k] + 1e-5 * Wt[l][k]; mW[l][k] = b1 * mW[l][k] + (1 - b1) * gk; vW[l][k] = b2 * vW[l][k] + (1 - b2) * gk * gk; Wt[l][k] -= lr * (mW[l][k] / (1 - b1 ** t)) / (Math.sqrt(vW[l][k] / (1 - b2 ** t)) + eps); }
      for (let k = 0; k < Bt[l].length; k++) { const gk = gB[l][k]; mB[l][k] = b1 * mB[l][k] + (1 - b1) * gk; vB[l][k] = b2 * vB[l][k] + (1 - b2) * gk * gk; Bt[l][k] -= lr * (mB[l][k] / (1 - b1 ** t)) / (Math.sqrt(vB[l][k] / (1 - b2 ** t)) + eps); }
    }
  }
  const v = score(va);
  if (v.lost < best.lost) best = { ...v, ep, layers: Wt.map((w, l) => ({ n: sizes[l + 1], w: Array.from(w, x => Math.round(x * 1e5) / 1e5), b: Array.from(Bt[l], x => Math.round(x * 1e5) / 1e5) })) };
  console.log(`epoch ${ep + 1}: the teacher's best among the network's five ${(100 * v.hit).toFixed(1)}%, chance given away ${v.lost.toFixed(4)}`);
}
const file = path.join(W, 'ai', '57-stroke-net-w.js'), had = fs.readFileSync(file, 'utf8'), m = /const STROKE_NET = (\{[\s\S]*\});/.exec(had);
const nets = m ? Function(`return ${m[1]}`)() : {};
nets[mode] = { trained: new Date().toISOString().slice(0, 10), balls: X.length, top5: Math.round(best.hit * 1000) / 1000, lost: Math.round(best.lost * 1e4) / 1e4,
  mean: mean.map(v => Math.round(v * 1e6) / 1e6), std: std.map(v => Math.round(v * 1e6) / 1e6), layers: best.layers };
const chk = netForwardAll(nets[mode], X[va[0]]); console.log(`kept epoch ${best.ep + 1}; check: ${chk.slice(0, 3).map(v => v.toFixed(3))} for the teacher's ${Y[va[0]].slice(0, 3)}`);
fs.writeFileSync(file, `  // the stroke network's weights (58-stroke-net.js), written by web/tools/net/train-strokes.js: per game, when trained, on how
  // many balls, how often the teacher's best stroke is among its five and the chance the five give away, and the network
  const STROKE_NET = ${JSON.stringify(nets)};\n`);
console.log(`written: ${path.relative(process.cwd(), file)} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);
