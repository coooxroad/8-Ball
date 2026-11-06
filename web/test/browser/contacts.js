/* The same contact inputs must produce bit-identical states in Node and Chromium. */
const assert = require('assert/strict'), { open } = require('./harness'), createPhysics = require('../../physics');
(async () => {
  const cases = [];
  for (const R of [0.028575, 0.03275]) for (const el of [0, 0.7, 1.4, Math.PI / 2]) for (const side of [-0.4, 0.4]) for (const strength of [0, 1]) {
    const cfg = { R, pockets: false, squirt: strength, throw: strength }, P = createPhysics(cfg), w = P.makeWorld(2);
    P.place(w, 0, -0.4, 0.1); P.place(w, 1, 0.1, 0.05); P.strike(w, 0.2, 3.5, side, -0.2, el);
    for (let i = 0; i < 240; i++) P.step(w, 1 / 120);
    cases.push({ cfg, el, side, expected: w.balls.map(b => [b.x, b.y, b.z, b.vx, b.vy, b.vz, b.wx, b.wy, b.wz]) });
  }
  const { browser, page, errors } = await open(1280, 800, 1);
  try {
    const actual = await page.evaluate(cases => cases.map(({ cfg, el, side }) => {
      const P = createPhysics(cfg), w = P.makeWorld(2); P.place(w, 0, -0.4, 0.1); P.place(w, 1, 0.1, 0.05); P.strike(w, 0.2, 3.5, side, -0.2, el);
      for (let i = 0; i < 240; i++) P.step(w, 1 / 120);
      return w.balls.map(b => [b.x, b.y, b.z, b.vx, b.vy, b.vz, b.wx, b.wy, b.wz]);
    }), cases);
    assert.deepEqual(actual, cases.map(c => c.expected)); assert.deepEqual(errors, []);
    console.log(`contacts browser: ${cases.length} shots bit-identical to Node`);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
