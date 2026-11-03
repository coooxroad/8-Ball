/* Population checks and state/Worker regression. No live matchmaking or accounts. */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const createPhysics = require('../physics'), createGame = require('../game'), { physicsFor } = require('../tables');
const createAI = new Function('g', fs.readdirSync(path.join(__dirname, '../ai')).sort().map(f => fs.readFileSync(path.join(__dirname, '../ai', f), 'utf8')).join('\n'));
const seeded = createGame.seededRandom, fresh = () => createGame(physicsFor(createPhysics, 'bar'), createAI);
const g = fresh(), make = (dama, seed, axes) => g.aiPlan.personaFor(dama, seeded(seed), axes);
const count = { plain: 0, rude: 0, english: 0 }, names = new Set(), r = seeded(987);
for (let i = 0; i < 10000; i++) {
  const p = g.aiPlan.personaFor(30, r), n = p.name; names.add(n);
  assert(n.length > 0 && n.length <= 16 && !/[<>\r\n\x00-\x1f]/.test(n));
  if (!/\d$/.test(n)) count.plain++;
  if (/ㅅㅂ|존나|개같은|빡친|망할|아씨|젠장|ㅗ/.test(n)) count.rude++;
  if (/^[a-z_\d]+$/.test(n)) count.english++;
}
assert(names.size > 2000, `too few distinct nicknames: ${names.size}`);
assert(count.plain > 4500 && count.rude > 300 && count.rude < 900 && count.english > 1000, JSON.stringify(count));

// A late, one-sided position can evoke all three responses; opening/close games and resilient people cannot give up.
g.start('four', ['A', 'B'], true, { target: 5, rnd: seeded(2) }); g.humanCanResign = true;
g.players[0].shots = 4; g.players[1].shots = 7; g.players[1].score = 4; g.players[1].made = 4;
const p = make(30, 22, { personality: 'impatient', style: 'power' }); p.practice.grit = 0.45;
let quit = 0, throwing = 0, normal = 0;
for (let i = 1; i <= 20000; i++) {
  g.aiRnd = seeded(i * 917); const t = g.aiPlan.turnContext(p);
  assert(t.resignChance <= 0.018 && t.throwChance <= 0.04);
  if (t.action === 'resign') quit++; else if (t.throwing) throwing++; else normal++;
}
assert(quit > 10 && quit < 300 && throwing > 100 && throwing < 1000 && normal > 18500, `late deficit mixture: ${quit}/${throwing}/${normal}`);
for (const scenario of ['close', 'opening', 'resilient', 'cooldown']) {
  const old = JSON.parse(JSON.stringify(g.players)), q = structuredClone(p); g.humanStates = null;
  if (scenario === 'close') g.players[0].score = 3;
  if (scenario === 'opening') g.players[0].shots = 0;
  if (scenario === 'resilient') q.practice.grit = 1;
  if (scenario === 'cooldown') g.humanStates = [{ shots: 3, made: 0, eventAt: 10 }, null];
  for (let i = 1; i <= 500; i++) { g.aiRnd = seeded(i); const t = g.aiPlan.turnContext(q); assert.equal(t.action, 'play'); assert.equal(t.throwing, false); }
  g.players = old;
}
g.humanStates = [{ shots: 3, made: 0, misses: 2, tilt: 0.5, throwing: 2, eventAt: 10 }, null];
g.aiRnd = seeded(33); const next = g.aiPlan.turnContext(p); assert.equal(next.state.throwing, 1); assert(next.state.tilt > 0);
g.players[0].score = 4; g.aiRnd = seeded(33); assert.equal(g.aiPlan.turnContext(p).state.throwing, 0);
g.humanCanResign = false; g.players[0].score = 0;
for (let i = 1; i <= 100; i++) { g.aiRnd = seeded(i); assert.equal(g.aiPlan.turnContext(p).resignChance, 0); }

// Real shot output: every skill band can use spin; identities produce different strengths and consistent bank bias.
const events = new Set(), strokes = new Map(), identities = new Set();
for (const dama of [10, 30, 80]) {
  let spin = 0;
  for (let i = 1; i <= 40; i++) {
    const h = fresh(), person = make(dama, i, { personality: 'fidgety', style: i % 2 ? 'balanced' : 'defensive' });
    identities.add(JSON.stringify(person.practice));
    h.start('four', ['A', 'B'], true, { rnd: seeded(i * 17), personas: [person, person] }); h.aiRnd = seeded(i * 111);
    const before = JSON.stringify(h.world), plan = h.aiPlan();
    assert.equal(JSON.stringify(h.world), before);
    if (Math.hypot(plan.a, plan.b) > 0.1) spin++;
    events.add(plan.preShot.kind); strokes.set(plan.stroke, (strokes.get(plan.stroke) || 0) + 1);
    const end = h.aiPlan.cueAt(plan, plan.think); assert(Math.abs(end.a - plan.a) < 1e-12 && Math.abs(end.b - plan.b) < 1e-12);
    assert(Math.abs(end.angle - plan.angle) < 1e-10);
    const keys = plan.preShot.keyframes;
    assert(keys.every((k, j) => !j || k.t > keys[j - 1].t));
    if (plan.preShot.kind === 'cancel') assert(keys.some((k, j) => j && k.power < keys[j - 1].power));
  }
  assert(spin >= 8, `DAMA ${dama}: spin only ${spin}/40`);
  console.log(`human spin: DAMA ${dama}, ${spin}/40 non-break shots (balanced/defensive)`);
}
assert(identities.size > 80); assert(events.has('cancel') && events.has('mistap')); assert(strokes.has('draw') && strokes.has('follow'));

// A request with emotional history must produce the exact main-thread plan and RNG continuation in the reused Worker.
Object.assign(global, { createGame, createAI, createPhysics, physicsFor, seededRandom: seeded });
const serve = require('../ai-worker');
for (const mode of ['eight', 'nine', 'four', 'three']) {
  const h = fresh(), person = make(45, 15, { personality: 'nervous', style: 'draw' });
  h.start(mode, ['A', 'B'], true, { rnd: seeded(18), personas: [person, person], cushions: 3 });
  h.humanStates = [{ shots: 0, made: 0, misses: 2, tilt: 0.35, throwing: 0, eventAt: -20 }, null]; h.humanCanResign = true; h.aiRnd = seeded(12);
  const job = structuredClone({ id: 4, tbl: 'bar', d: h.serialize(), personas: h.personas, humanStates: h.humanStates, humanCanResign: true, rnd: h.aiRnd.state() });
  const direct = h.aiPlan(), reply = serve(job); assert(!reply.err, reply.err); assert.deepEqual(reply.plan, direct); assert.equal(reply.rnd, h.aiRnd.state());
  const cold = serve({ ...job, humanStates: null, humanCanResign: false });
  const freshG = fresh(); freshG.restore(structuredClone(job.d)); freshG.personas = job.personas; freshG.aiRnd = seeded(job.rnd);
  assert.deepEqual(cold.plan, freshG.aiPlan(), 'Worker retained the previous person\'s mood');
}
console.log(`human behavior: ${names.size} names, ${count.rude / 100}% coarse names; late deficit resign ${quit / 200}%, throw ${throwing / 200}%, normal ${normal / 200}%; corrected taps/cancellations, spin and Worker state passed`);
