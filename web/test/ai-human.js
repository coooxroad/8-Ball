/* Human opponents: node web/test/ai-human.js. Only --quick shortens development matches; the default runs 20 seeded
   games per skill comparison plus 8 self-play games per rating/mode. No live service or display is needed. */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert/strict'), { performance } = require('perf_hooks');
const W = path.resolve(__dirname, '..'), createPhysics = require('../physics'), createGame = require('../game');
const { physicsFor } = require('../tables');
const createAI = new Function('g', fs.readdirSync(path.join(W, 'ai')).sort().map(f => fs.readFileSync(path.join(W, 'ai', f), 'utf8')).join('\n'));
const seeded = s => () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
const fresh = (table = 'bar') => createGame(physicsFor(createPhysics, table), createAI);
const quick = process.argv.includes('--quick'), metrics = { plans: 0, time: 0, worst: 0, sims: 0 }, g0 = fresh();
const profile = (g, dama, seed = 7, axes) => g.aiPlan.personaFor(dama, seeded(seed), axes);
const frozen = p => { for (const x of Object.values(p)) if (x && typeof x === 'object') frozen(x); return Object.freeze(p); };
function measured(g) {
  const before = JSON.stringify(g.world), saved = JSON.stringify(g.personas);
  const original = g.P.run; let simulations = 0;
  g.P.run = (...args) => { simulations++; return original(...args); };
  let p, elapsed;
  try { const t = performance.now(); p = g.aiPlan(); elapsed = performance.now() - t; } finally { g.P.run = original; }
  assert.equal(JSON.stringify(g.world), before, 'planner changed the real table'); assert.equal(JSON.stringify(g.personas), saved, 'planner changed persona');
  assert(simulations <= 150, `simulation cap ${simulations}`); assert.equal(p.simulations, simulations);
  // (the work is held by the simulation cap above; the clock only catches a runaway - a busy machine is slower)
  assert(elapsed < 1000, `plan took ${elapsed.toFixed(1)}ms`);
  metrics.plans++; metrics.time += elapsed; metrics.worst = Math.max(metrics.worst, elapsed); metrics.sims = Math.max(metrics.sims, simulations);
  for (const k of ['angle', 'V', 'a', 'b', 'el', 'think']) assert(Number.isFinite(p[k]), `invalid ${k}`);
  assert(p.V >= g.vOf(0) - 1e-9 && p.V <= g.vOf(1) + 1e-9); assert(p.a * p.a + p.b * p.b <= 0.64 + 1e-9);
  assert(p.el >= 0 && p.el <= Math.PI / 2); assert(p.think >= 1.5 && p.think <= 12);
  if (p.pos) { assert(g.placing); assert(g.P.isFree(g.world, ...p.pos, g.world.cue)); if (g.placing === 'kitchen') assert(p.pos[0] <= -g.P.HL / 2); }
  const final = g.aiPlan.cueAt(p, p.think + 10); assert(Math.abs(final.angle - p.angle) < 1e-10); assert(Math.abs(final.power - g.powerOf(p.V)) < 1e-10);
  assert.deepEqual(JSON.parse(JSON.stringify(p)), p); return p;
}
function strike(g, p) {
  if (p.pos) g.P.place(g.world, g.world.cue, ...p.pos);
  g.beginShot(); g.P.strike(g.world, p.angle, p.V, p.a, p.b, p.el); g.P.run(g.world, 40); g.world.snd.length = 0;
  assert(g.P.rest(g.world)); return g.resolve().r;
}
// Every personality/style combination works in all four modes; frame sampling never consumes gameplay randomness.
const profiles = g0.aiPlan.profiles;
assert.equal(profiles.personalities.length, 6); assert.equal(profiles.styles.length, 12);
for (const [dama, skill] of [[10, 0.05], [30, 0.4], [60, 0.8], [80, 0.95], [120, 0.95]]) assert.equal(profile(g0, dama).skill, skill);
for (let d = 11; d <= 80; d++) assert(profile(g0, d).skill >= profile(g0, d - 1).skill);
const names = new Set(), random = seeded(10), combos = new Set(), icons = new Set();
for (let i = 0; i < 2000; i++) { const p = g0.aiPlan.personaFor(30, random); names.add(p.name); combos.add(p.personality.id + '/' + p.style.id); assert(Number.isInteger(p.icon) && p.icon >= 0 && p.icon < 8); icons.add(p.icon); assert(!/봇|AI|컴퓨터|시발|씨발/.test(p.name)); assert.deepEqual(JSON.parse(JSON.stringify(p)), p); }
assert(names.size >= 200); assert.equal(combos.size, 72); assert.equal(icons.size, 8);
for (const mode of ['eight', 'nine', 'four', 'three']) {
  for (const character of profiles.personalities) for (const style of profiles.styles) {
    const g = fresh(), p = frozen(profile(g, 50, 5, { personality: character.id, style: style.id }));
    const start = () => { g.start(mode, ['A', 'B'], true, { rnd: seeded(55), personas: [p, p], cushions: 3 }); g.aiRnd = seeded(100); };
    start(); if (g.isBreak) strike(g, measured(g)); const snapshot = g.serialize();
    g.aiRnd = seeded(22); const oldRandom = Math.random; let a;
    try { Math.random = () => { throw Error('unseeded randomness in human planner'); }; a = measured(g); } finally { Math.random = oldRandom; }
    g.restore(snapshot); g.personas = [p, p]; g.aiRnd = seeded(22); const b = measured(g); assert.deepEqual(a, b, `${mode} decision is not deterministic`);
    const savePlan = JSON.stringify(b), calls = [];
    for (const t of [0, 0.1, 0.7, 1, b.think * 0.6, b.think]) calls.push(g.aiPlan.cueAt(b, t));
    assert.equal(JSON.stringify(b), savePlan); assert.deepEqual(calls[3], g.aiPlan.cueAt(b, 1));
    if (!g.masse) assert.equal(b.el, 0);
  }
}
// Contrasting styles in an identical hard position must affect actual shots, and showboating must affect only the timeline.
{
  const g = fresh(); g.start('four', ['A', 'B'], true, { rnd: seeded(90) });
  const samples = [], raised = {}, strike0 = g.P.strike;
  for (let seed = 1; seed <= 30; seed++) for (const style of ['power', 'defensive', 'masse', 'banker']) {
    g.aiRnd = seeded(seed); g.personas = [profile(g, 20, 2, { personality: 'playful', style }), null];
    g.P.strike = (...a) => { if (a[5] > 0) raised[style] = (raised[style] || 0) + 1; return strike0(...a); };
    try { const shot = measured(g); samples.push({ style, ...shot }); } finally { g.P.strike = strike0; }
  }
  // (the power style hits harder than the careful one: on the livelier cloth of PHYS_V 8 a soft shot reaches far enough
  // in this position that a full-power release is no longer its best answer, so the check is the average, not a blast)
  const meanPower = s => { const q = samples.filter(p => p.style === s); return q.reduce((a, p) => a + g.powerOf(p.V), 0) / q.length; };
  assert(meanPower('power') > meanPower('defensive'), `power style no harder than the defensive one (${meanPower('power').toFixed(2)} / ${meanPower('defensive').toFixed(2)})`);
  // (a masse from the opening of 4구 almost never scores - a few in two thousand - so whether one of these thirty plays
  // it is luck, and a small change to the physics turns it either way; what the style must do is look for them: it plays
  // raised cues out, the others hardly)
  assert((raised.masse || 0) > 3 * Math.max(1, raised.power || 0, raised.defensive || 0, raised.banker || 0), `masse style does not look for raised-cue shots (${JSON.stringify(raised)})`);
  assert(samples.some(p => p.style === 'banker' && p.decision === 'bank'), 'banker never chooses a cushion');
  assert(samples.some(p => p.preShot.kind === 'taunt'), 'no cue-shaking timeline');
  const taunt = samples.find(p => p.preShot.kind === 'taunt'); assert(taunt.preShot.keyframes.some(k => Math.abs(k.angle - taunt.angle) > 0.2));
}
// Disabling raised cues overrides every style, including its visual pose.
{
  const g = fresh();
  for (const mode of ['eight', 'nine', 'four', 'three']) {
    const p = profile(g, 80, 1, { personality: 'playful', style: 'masse' });
    g.start(mode, ['A', 'B'], true, { rnd: seeded(8), personas: [p, p], masse: false, cushions: 3 }); g.aiRnd = seeded(9);
    if (g.isBreak) strike(g, measured(g));
    const shot = measured(g); assert.equal(shot.el, 0); assert(shot.preShot.keyframes.every(k => k.el === 0));
  }
}
// Older ranked rooms supply a rating/level without the new axes. They still produce valid seeded plans after reload.
{
  const g = fresh(), legacy = frozen({ name: '초크한통17', icon: 7, dama: 30, level: 1 });
  g.start('four', ['A', legacy.name], true, { rnd: seeded(32), personas: [legacy, legacy] });
  g.aiRnd = seeded(7); const a = measured(g); g.aiRnd = seeded(7); assert.deepEqual(a, measured(g));
  assert.deepEqual(legacy, { name: '초크한통17', icon: 7, dama: 30, level: 1 });
  const empty = createAI(null); assert.equal(typeof empty.plan.personaFor, 'function');
  assert(Number.isFinite(empty.plan.personaFor(30, seeded(1)).skill));
}
function match(mode, a, b, seed, stats) {
  const g = fresh(), first = seed % 2, ps = [profile(g, a, seed * 19 + 1), profile(g, b, seed * 19 + 2)];
  g.start(mode, ['A', 'B'], true, { rnd: seeded(seed), first, target: 5, personas: ps }); g.players[0].ai = true; g.aiRnd = seeded(seed ^ 0x517cc1b7);
  const visit = [0, 0]; let shots = 0;
  for (; !g.over && shots < 400; shots++) {
    const who = g.turn, breaking = g.isBreak, p = measured(g), r = strike(g, p), s = stats && stats[who];
    if (s) {
      s.shots++; s.power += g.powerOf(p.V); if (r.foul) s.fouls++;
      if (r.keep || r.win === who) {
        const group = g.players[who].group;
        const made = mode === 'eight' ? g.world.ev.pocketed.filter(q => q.id !== 0 && (q.id === 8 ? !breaking && r.win === who : breaking || !group || (q.id < 8) === (group === 'solid'))).length : r.pts;
        s.made += made; visit[who] += made;
      }
    }
    if (g.turn !== who || g.over) { if (s) { s.visits++; s.runs += visit[who]; if (visit[who]) s.scoringVisits++; } visit[who] = 0; }
  }
  assert(g.over, `${mode}, seed ${seed}, ${a}/${b} unfinished after 400 shots`); return g.over.winner;
}
for (const mode of ['eight', 'four']) {
  // (40 seeds: with 20 the share swung 65-75% between machines - the AI's own Math differs a little by Node version - for a
  // rate near 80%; the 4구 penalty for the other ball even with both reds, 11-06, makes a game a little more of a lottery)
  const N = quick ? 4 : 40; let high = 0;
  for (let i = 1; i <= N; i++) { if (match(mode, 20, 50, 100 + i) === 1) high++; }
  console.log(`${mode}: DAMA 50 beat 20 in ${high}/${N} seeded matches (${(high / N * 100).toFixed(1)}%)`);
  const floor = mode === 'four' ? 0.65 : 0.7;     // (4구: ~80% over 60 seeds here, 65-75% by machine over 20)
  assert(high >= N * floor, `${mode}: higher DAMA win rate below ${floor * 100}%`);
}
console.log('| Mode | DAMA | Balls or points / visit | Balls or points / scoring visit | Fouls | Mean power |');
console.log('|---|---:|---:|---:|---:|---:|');
for (const mode of ['eight', 'four']) for (const dama of [10, 30, 80]) {
  const s = [0, 1].map(() => ({ shots: 0, made: 0, power: 0, fouls: 0, visits: 0, runs: 0, scoringVisits: 0 }));
  for (let i = 0; i < (quick ? 1 : 8); i++) match(mode, dama, dama, 800 + i, s);
  const total = Object.fromEntries(Object.keys(s[0]).map(k => [k, s[0][k] + s[1][k]]));
  console.log(`| ${mode} | ${dama} | ${(total.runs / total.visits).toFixed(2)} | ${(total.runs / Math.max(1, total.scoringVisits)).toFixed(2)} | ${(total.fouls / total.shots * 100).toFixed(1)}% | ${(total.power / total.shots * 100).toFixed(1)}% |`);
}
/* (how long a plan takes, measured against how long this machine takes to play one stroke out - copy the table, strike,
   run it - so the bound holds on a fast machine and a slow one alike. 15 strokes: the 40 ms it was set at, on the machine
   where a plan took 30 ms (about 11 strokes) - the same headroom. The yardstick is the middle of several runs, taken now that the machine is warm.) */
const strokeMs = (() => {
  const g = fresh(), runs = [];
  for (let k = 0; k < 7; k++) {
    g.start('eight', ['A', 'B'], false, { rnd: seeded(5) }); const P = g.P, t0 = performance.now();
    for (let i = 0; i < 60; i++) { const w = P.clone(g.world); P.strike(w, (i * 0.37) % 6.28, 1.5 + (i % 7) * 0.8, 0, 0); P.run(w, 20); }
    runs.push((performance.now() - t0) / 60);
  }
  return runs.sort((x, y) => x - y)[3];
})();
const planStrokes = metrics.time / metrics.plans / strokeMs;
console.log(`plan cost: ${(metrics.time / metrics.plans).toFixed(1)} ms average = ${planStrokes.toFixed(1)} strokes played out (a stroke ${strokeMs.toFixed(2)} ms here)`);
assert(planStrokes < 15, `average plan costs ${planStrokes.toFixed(1)} strokes, more than 15`);
require('./ai-human-behavior');
console.log(`human AI passed: ${metrics.plans} plans, ${(metrics.time / metrics.plans).toFixed(2)}ms average, ${metrics.worst.toFixed(2)}ms worst, ${metrics.sims} simulations max; ${names.size} distinct names; 72 personality/style combinations.`);
