/* Seeded ranked AI comparison. Pass a checkout of the old main as the argument for the baseline. */
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(process.argv[2] || path.join(__dirname, '../..'), 'web');
const load = name => require(path.join(root, name));
const createPhysics = load('physics'), createGame = load('game'), { physicsFor } = load('tables');
const { RANKED_RULES } = load('economy');
const createAI = new Function('g', fs.readdirSync(path.join(root, 'ai')).sort().map(f => fs.readFileSync(path.join(root, 'ai', f), 'utf8')).join('\n'));
const seeded = createGame.seededRandom, ai = createAI(null), v3 = !!ai.rankedPersonaFor;
const person = (rating, seed, axes) => v3 ? ai.rankedPersonaFor(rating, seeded(seed), axes)
  : { ...ai.personaFor(Math.max(10, Math.round(30 + (rating - 500) / 4)), seeded(seed), axes), dama: rating };
Object.assign(global, { createGame, createAI, createPhysics, physicsFor, seededRandom: seeded });
const serve = load('ai-worker');
function game(mode, seed, profile) {
  const g = createGame(physicsFor(createPhysics, 'bar'), createAI);
  g.start(mode, ['A', 'B'], true, { ...RANKED_RULES[mode], first: 1, rnd: seeded(seed), personas: [null, profile] });
  g.aiRnd = seeded(seed ^ 0x2545f491);
  if (mode === 'four') {
    g.rollOut(seeded((seed ^ 0x5bd1e995) >>> 0)); g.P.run(g.world, 40);
    g.world.ev = g.P.newEv();
  }
  return g;
}
function play(g, p) {
  if (p.pos) g.P.place(g.world, g.world.cue, ...p.pos);
  g.beginShot();
  g.P.strike(g.world, p.angle, p.V, p.a, p.b, p.el);
  const ev = g.P.run(g.world, 40), { r } = g.resolve();
  return { ev, r };
}
const ratings = [500, 800, 1100, 1400, 1700, 2000];
const styles = ai.plan.profiles.styles, personalities = ai.plan.profiles.personalities;
const output = [];
for (const mode of ['four', 'three', 'eight', 'nine']) {
  const n = mode === 'four' ? 96 : 24;
  for (const rating of ratings) {
    const stats = { mode, rating, n, made: 0, foul: 0, direct: 0, visible: 0, spin: 0, raised: 0, off: 0, retry: 0, next: 0, sims: 0 };
    for (let i = 1; i <= n; i++) {
      const seed = i * 917, profile = person(rating, seed, { style: styles[(i - 1) % styles.length].id, personality: personalities[Math.floor((i - 1) / styles.length) % personalities.length].id });
      const g = game(mode, seed, profile);
      // Compare open-table potting as well as breaks. Play the same break in both versions.
      if (g.isBreak && g.mode.table === 'pool') play(g, { angle: 0, V: g.vOf(0.87), a: 0, b: 0, el: 0 });
      g.personas = [profile, profile];
      const me = g.turn, p = g.aiPlan();
      if (i === 1) {
        g.aiRnd = seeded(seed ^ 0x2545f491);
        const reply = serve({ id: 1, tbl: 'bar', d: g.serialize(), personas: g.personas, rnd: g.aiRnd.state() });
        assert(!reply.err, reply.err); assert.deepEqual(reply.plan, p);
      }
      const { ev, r } = play(g, p);
      const made = !r.foul && (r.keep || r.win === me);
      stats.made += Number(made);
      stats.foul += Number(!!r.foul);
      stats.direct += Number(ev.hits.length > 0 && ev.cushions === 0);
      stats.visible += Number(p.route === 'straight' || p.route === 'cut');
      stats.spin += Number(Math.hypot(p.a, p.b) > 0.1);
      stats.raised += Number(p.el > 0);
      stats.off += Number(ev.off.length > 0);
      stats.retry += Number(['mistap', 'cancel', 'reconsider'].includes(p.preShot.kind));
      stats.sims += p.simulations;
      if (mode === 'four' && made) {
        const [c, a, b] = [g.world.balls[me], ...g.world.balls.slice(2)];
        // A compact leave with at least one unobstructed red.
        const nearby = [a, b].every(t => Math.hypot(c.x - t.x, c.y - t.y) < 0.65);
        if (nearby && [a, b].some(t => g.P.pathClear(g.world, c.x, c.y, t.x, t.y, [me, t.id]))) stats.next++;
      }
    }
    output.push(stats);
  }
}
console.log(`PHYS_V ${createPhysics.PHYS_V}`);
console.table(output);
if (v3) {
  const [low, midLow, , , , high] = output;
  assert(low.spin >= low.n * 0.05 && low.spin <= low.n * 0.25 && midLow.spin <= midLow.n * 0.35);
  assert(low.raised <= low.n * 0.03 && low.direct > low.n * 0.5 && low.visible > low.n * 0.5);
  assert(high.spin > low.spin && high.made > low.made && high.sims > low.sims);
}

if (v3) {
  // Vary only the shot seed and the habit on one layout. Use the same preview as the on-screen guide.
  const habits = {};
  for (const style of ['natural', 'follow', 'draw', 'spinner']) {
    const profile = person(500, 170, { style, personality: 'calm' });
    const g = game('four', 817, profile);
    const hitRed = angle => [2, 3].includes(g.P.preview(g.world, angle, g.vOf(0.45), 0, 0, 0, 0.05).hit);
    const stats = habits[style] = { spin: 0, follow: 0, draw: 0, side: 0, checks: new Set(), first: 0, final: 0 };
    for (let i = 1; i <= 72; i++) {
      g.aiRnd = seeded(i * 917);
      const p = g.aiPlan(), keys = p.preShot.keyframes;
      stats.spin += Number(Math.hypot(p.a, p.b) > 0.1);
      stats.follow += Number(p.stroke === 'follow');
      stats.draw += Number(p.stroke === 'draw');
      stats.side += Number(Math.abs(p.a) > 0.1);
      assert(keys.every((k, j) => j === 0 || k.t > keys[j - 1].t));
      if (p.preShot.kind !== 'settle') continue;
      stats.first += Number(hitRed(keys[0].angle));
      stats.final += Number(hitRed(keys.at(-1).angle));
      stats.checks.add(keys.length);
    }
    assert(stats.final > stats.first && stats.checks.size >= 2);
    console.log(`${style}: ${stats.spin}/72 with spin (follow ${stats.follow}, draw ${stats.draw}, side ${stats.side}); red on guide ${stats.first} → ${stats.final} on ordinary approaches`);
  }
  const { natural, follow, draw, spinner } = habits;
  assert(natural.spin < spinner.spin && follow.follow > follow.draw && draw.draw > draw.follow && spinner.side > follow.side);

  const names = new Set(), rng = seeded(987);
  let plain = 0, account = 0, coarse = 0;
  for (let i = 0; i < 10000; i++) {
    const { name } = ai.rankedPersonaFor(500, rng);
    assert(name.length && name.length <= 16 && !/[<>\s\x00-\x1f]/.test(name));
    names.add(name);
    plain += Number(!/\d$/.test(name));
    account += Number(/^[a-zA-Z0-9_.]+$/.test(name));
    coarse += Number(/^(아씨|아오|아놔|젠장|에이|헐|하|으악)(또키스|두께뭐냐|짧다|빈쿠션|쫑|한점만|또졌네|왜안맞아|큐미스|길다)$/.test(name));
  }
  // (owner 11-09: too many alike - names from parts, tens of thousands; the lobby also skips the recent ones)
  assert(names.size > 6000 && plain > 5500 && account > 1500 && coarse > 100 && coarse < 350);
  console.log(`names: ${names.size} distinct, ${plain / 100}% without numeric suffix, ${account / 100}% Latin accounts, ${coarse / 100}% coarse`);

  // Deliberately difficult four-ball positions. These seeds exercise rare outcomes without monkey-patching the physics.
  for (const f of [
    { style: 'masse', seed: 16 * 917, first: 0, pts: [[0, 0.18], [0, 0], [0, -0.35], [0, -0.55]], decision: 'masse' },
    { style: 'power', seed: 25 * 917, first: 1, pts: [[0, 0.22], [0, 0.5], [0, -0.05], [0.01, -0.32]], decision: 'overhit-kick' },
  ]) {
    const profile = person(500, 170, { style: f.style, personality: 'calm' });
    const g = game('four', 817, profile);
    g.start('four', ['A', 'B'], true, { ...RANKED_RULES.four, first: f.first, rnd: seeded(817), personas: [profile, profile] });
    f.pts.forEach((xy, id) => g.P.place(g.world, id, ...xy));
    g.aiRnd = seeded(f.seed);
    const p = g.aiPlan(), keys = p.preShot.keyframes;
    assert.equal(p.decision, f.decision);
    assert.deepEqual([keys[0].a, keys[0].b, keys[0].el, keys[0].power], [0, 0, 0, 0]);
    assert.deepEqual([keys.at(-1).a, keys.at(-1).b, keys.at(-1).el], [p.a, p.b, p.el]);
    assert(p.V <= g.vOf(1) && Math.hypot(p.a, p.b) <= 0.79 && p.el <= Math.PI / 2);
    if (f.decision === 'masse') {
      const solo = g.P.clone(g.world), cue = solo.balls[solo.cue];
      for (const b of solo.balls) if (b !== cue) b.on = false;
      const { x, y } = cue;
      g.P.strike(solo, p.angle, p.V, p.a, p.b, p.el);
      for (let i = 0; i < 72; i++) g.P.step(solo, 1 / 120);
      const bend = Math.abs((cue.x - x) * Math.sin(p.angle) - (cue.y - y) * Math.cos(p.angle));
      assert(bend > 0.02, `massé lateral bend only ${bend} m`);
      console.log(`blocked reds: massé bends ${(bend * 100).toFixed(1)} cm in 72 steps`);
    }
    const { ev, r } = play(g, p);
    if (f.decision === 'overhit-kick') {
      assert(ev.off.includes(f.first) && r.foul && r.pts === -1 && g.world.balls[f.first].on);
      console.log('rail-side escape: cue ball left the table, received a foul and was respotted');
    }
  }
}
