/* Actual Worker, cue UI and ranked resignation wiring; all networking is stubbed locally by the harness. */
'use strict';
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), { open } = require('./harness');
const createPhysics = require('../../physics'), createGame = require('../../game'), { physicsFor } = require('../../tables');
const createAI = new Function('g', fs.readdirSync(path.join(__dirname, '../../ai')).sort().map(f => fs.readFileSync(path.join(__dirname, '../../ai', f), 'utf8')).join('\n'));
const rnd = createGame.seededRandom;
function fixture(kind) {
  const g = createGame(physicsFor(createPhysics, 'bar'), createAI), mode = kind === 'reposition' ? 'eight' : 'four';
  const person = g.aiPlan.personaFor(30, rnd(15), { personality: kind === 'resign' ? 'impatient' : 'fidgety', style: 'spinner' });
  person.practice.grit = 0.45;
  g.start(mode, ['A', 'B'], true, { first: 1, target: 5, rnd: rnd(35), personas: [person, person] });
  if (kind === 'reposition') { g.P.strike(g.world, 0, 6, 0, 0); g.P.run(g.world, 40); g.isBreak = false; g.placing = 'any'; }
  if (kind === 'resign') {
    g.humanCanResign = true; g.players[1].shots = 4; g.players[0].shots = 7; g.players[0].score = 4; g.players[0].made = 4;
  }
  for (let seed = 1; seed <= 10000; seed++) {
    if (kind === 'resign') { g.aiRnd = rnd(seed); if (g.aiPlan.turnContext(person).action !== 'resign') continue; }
    g.aiRnd = rnd(seed); const p = g.aiPlan(), keys = p.preShot.keyframes;
    const match = kind === 'resign' ? p.action === 'resign' : kind === 'reposition' ? p.preShot.kind === 'cancel' && p.pos && keys[0].pos && Math.hypot(p.pos[0] - keys[0].pos[0], p.pos[1] - keys[0].pos[1]) > 0.1 :
      p.preShot.kind === kind && Math.hypot(p.a, p.b) > 0.1 && (kind !== 'mistap' || Math.abs(Math.atan2(Math.sin(keys[1].angle - p.angle), Math.cos(keys[1].angle - p.angle))) > 0.4);
    if (match) return { game: g.serialize(), plan: p };
    if (seed > 400) throw Error(`no ${kind} fixture`);
  }
  throw Error(`no ${kind} fixture`);
}
(async () => {
  const fixtures = Object.fromEntries(['mistap', 'cancel', 'reposition', 'resign'].map(k => [k, fixture(k)]));
  const { browser, page, errors } = await open(1280, 800, 1, { init: () => {
    localStorage.setItem('dp8.prefs', JSON.stringify({ v: 2, how: true, sound: false, music: false, shotClock: 0 }));
  } });
  try {
    await page.evaluate(() => {
      // (this checks that the Worker's answer is used, not how fast it comes: on CI's software renderer it can pass the
      // game's 8 s fallback - app/40-shot.js aiw.slow)
      __dp8.aiw.slow = 60000;
      const d = __dp8, r = d.ranked;
      window.__humanMessages = []; r.connect = () => {}; r.send = m => window.__humanMessages.push(m);
      const person = createAI(null).rankedPersonaFor(500, seededRandom(170), { personality: 'calm', style: 'power' });
      r.play({ seat: 0, room: 'offline-human-test', token: 'test', seed: 35, first: 1, mode: 'four', opp: { name: person.name, dama: person.dama }, standIn: person });
      d.game.start('four', ['A', person.name], true, { first: 1, target: 5, rnd: seededRandom(35), personas: [null, person] });
      [[0, 0.22], [0, 0.5], [0, -0.05], [0.01, -0.32]].forEach((xy, id) => d.game.P.place(d.game.world, id, ...xy));
      d.game.aiRnd = seededRandom(25 * 917); d.game.humanStates = [null, null]; d.game.humanCanResign = true;
      d.match.enter();
    });
    await page.waitForFunction(() => __dp8.st.auto && __dp8.st.auto.plan && __dp8.game.humanStates[1], { timeout: 30000 });
    { const j = await page.evaluate(() => { const j = __dp8.st.auto.aiJob; return j && { err: j.res && j.res.err, ms: Math.round(performance.now() - j.t) }; });
      assert(j && !j.err, 'actual Worker answer missing ' + JSON.stringify(j)); }
    { const v = await page.evaluate(() => { const { st } = __dp8, p = st.auto.plan; return { ver: p.preShot.version, el: p.el, k0: p.preShot.keyframes[0].el, st: st.el }; });
      // (the cue starts level whatever the plan ends at: this layout's plan used to raise the cue, and since the physics of
      // 11-07 it chooses a level shot - the start is what is checked, not which shot the computer likes)
      assert(v.ver === 3 && v.k0 === 0 && v.st === 0 && v.el >= 0, 'v3 Worker must aim level before raising the cue ' + JSON.stringify(v)); }

    const install = async f => page.evaluate(f => {
      const d = __dp8; d.game.restore(f.game); d.scene.setTable(d.game.P); d.scene.invalidate();
      d.st.phase = 'auto'; d.st.auto = { t: 0, t0: 0, plan: f.plan, src: { resign() { d.ranked.resign(1); } } };
    }, f);
    const jump = async fraction => {
      const target = await page.evaluate(f => { const a = __dp8.st.auto; a.t = a.plan.preShot.duration * f; a.t0 = 0; return a.t; }, fraction);
      await page.waitForFunction(target => !__dp8.st.auto || __dp8.st.auto.t > target, target, { timeout: 15000 });
    };
    await install(fixtures.mistap); await jump(0.2);
    assert(await page.evaluate(() => Math.abs(Math.atan2(Math.sin(__dp8.st.aim - __dp8.st.auto.plan.angle), Math.cos(__dp8.st.aim - __dp8.st.auto.plan.angle))) > 0.3), 'mistap did not turn cue');
    await jump(0.8);
    assert(await page.evaluate(() => Math.abs(Math.atan2(Math.sin(__dp8.st.aim - __dp8.st.auto.plan.angle), Math.cos(__dp8.st.aim - __dp8.st.auto.plan.angle))) < 1e-8), 'mistap was not corrected');
    assert(await page.evaluate(() => Math.hypot(__dp8.st.spin.x, __dp8.st.spin.y) > 0.1), 'spin UI did not follow keyframes');

    await install(fixtures.cancel); await jump(0.24);
    assert(await page.evaluate(() => __dp8.st.power > 0.05), 'cancel never began pulling');
    await jump(0.39); assert(await page.evaluate(() => __dp8.st.power === 0), 'cancel did not release power');

    await install(fixtures.reposition); await jump(0.1);
    const first = await page.evaluate(() => [__dp8.game.cueBall().x, __dp8.game.cueBall().y]);
    await jump(0.8);
    const last = await page.evaluate(() => [__dp8.game.cueBall().x, __dp8.game.cueBall().y]);
    assert(Math.hypot(first[0] - last[0], first[1] - last[1]) > 0.1, 'ball-in-hand position never changed');
    assert.deepEqual(last, fixtures.reposition.plan.pos);

    await install(fixtures.resign); await jump(1.01);
    const sent = await page.evaluate(() => window.__humanMessages.filter(m => m.t === 'resign'));
    assert.deepEqual(sent, [{ t: 'resign', as: 1 }]);
    assert(await page.evaluate(() => !__dp8.game.over && __dp8.st.phase === 'idle'), 'client fabricated a win before server result');
    await page.evaluate(() => __dp8.ranked.result({ winner: 0, why: 'resigned', coins: [10, 0], dama: [33, 27] }));
    // (the result comes up after 승리 has been shown over the table - app/50-outro.js)
    assert(await page.evaluate(() => __dp8.outro.on && __dp8.game.over.winner === 0), 'the end of the match is shown first');
    await page.waitForFunction(() => __dp8.st.screen === 'result' && !__dp8.outro.on, { timeout: 15000 });
    assert(await page.evaluate(() => __dp8.game.over.winner === 0));
    // a stand-in the room plays (owner 11-25, server/src/ranked.js standInPlan): its shot comes in with how it lines up; the
    // device lines it up (the preShot), strikes exactly the room's shot from the room's balls, and sends nothing for it
    const f = fixtures.mistap;
    const snap = await page.evaluate(f => {
      const d = __dp8, r = d.ranked; r.leave(); window.__humanMessages = [];
      const person = createAI(null).rankedPersonaFor(500, seededRandom(171), { personality: 'calm', style: 'balanced' });
      r.play({ seat: 0, room: 'offline-room-standin', token: 'test', seed: 35, first: 1, mode: 'four', opp: { name: person.name, dama: person.dama }, standIn: person, standInServer: true });
      d.game.restore(f.game); d.scene.setTable(d.game.P); d.match.enter();
      const p = f.plan, shot = { s: JSON.parse(JSON.stringify(d.highlights.snapshot(d.game.world))), aim: p.angle, V: p.V, a: p.a || 0, b: p.b || 0, el: p.el || 0, inHand: false, seat: 1, by: 1 };
      r.hear({ t: 'shot', n: 0, shot, plan: { preShot: p.preShot, pos: null } });
      window.__snap0 = shot.s.balls; return shot.s;
    }, f);
    // (where the shot must leave the balls: struck here on the same physics from the room's balls)
    const want = (() => { const g = createGame(physicsFor(createPhysics, 'bar'), createAI); g.restore(f.game); require('../../highlights')().restore(g.world, snap); const p = f.plan;
      g.P.strike(g.world, p.angle, p.V, p.a || 0, p.b || 0, p.el || 0); g.P.run(g.world, 40); return g.world.balls.map(b => [b.x, b.y, b.on]); })();
    await page.waitForFunction(() => __dp8.st.auto && __dp8.st.auto.plan && __dp8.st.auto.plan.exact, null, { timeout: 30000 });
    await page.evaluate(() => { const a = __dp8.st.auto; a.t = a.t0 + a.plan.preShot.duration + 0.01; });
    // (struck, run and settled: the shot over - the next turn begun, the stand-in's again if it scored, or the game over)
    await page.waitForFunction(() => { const d = __dp8; return !(d.st.auto && d.st.auto.plan) && d.st.phase !== 'sim' && d.st.phase !== 'strike' && d.game.P.rest(d.game.world) && d.game.world.balls.some((b, i) => b.x !== window.__snap0[i][0] || b.y !== window.__snap0[i][1]); }, null, { timeout: 90000 });
    const got = await page.evaluate(() => ({ balls: __dp8.game.world.balls.map(b => [b.x, b.y, b.on]), sent: window.__humanMessages.filter(m => m.t === 'shot' || m.t === 'resign') }));
    assert.deepEqual(got.sent, [], 'the device sent something for the room\'s stand-in');
    assert(got.balls.every((b, i) => Math.abs(b[0] - want[i][0]) < 1e-9 && Math.abs(b[1] - want[i][1]) < 1e-9 && b[2] === want[i][2]), 'the room\'s stand-in shot was not struck exactly: ' + JSON.stringify({ got: got.balls, want }));
    assert.deepEqual(errors, []);
    console.log('human browser: real Worker state, corrected mistap, spin UI, cancel/re-aim, legal in-hand reposition, server-confirmed stand-in resignation and the room\'s stand-in struck exactly passed');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
