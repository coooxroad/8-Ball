/* Independent contact invariants, including the untuned model. Run directly or through test/run.js. */
'use strict';
const assert = require('assert/strict'), createPhysics = require('../physics');
const energy = (P, w) => w.balls.filter(b => b.on).reduce((s, b) => s + (b.vx ** 2 + b.vy ** 2 + b.vz ** 2) / 2
  + P.R * P.R * (b.wx ** 2 + b.wy ** 2 + b.wz ** 2) / 5 + 9.8 * b.z, 0);
const close = (a, b, eps = 1e-8) => assert(Math.abs(a - b) <= eps, `${a} != ${b}`);
let shots = 0, ticks = 0;
for (const R of [0.0254, 0.028575, 0.03075, 0.03275]) {
  const P = createPhysics({ R, pockets: false, squirt: 1, throw: 1 });
  assert.deepEqual(P.launch(0, 0.4, -0.2, 1.4).velocity, [0, 0, 0]);
  // Cue offsets lie on the sphere and perpendicular to the shot axis, even when viewed vertically.
  for (const el of [0, 0.3, 0.9, Math.PI / 2]) for (const a of [-0.4, 0, 0.4]) for (const b of [-0.3, 0.3]) {
    const g = P.cueContact(0.7, a, b, el), p = g.point, d = g.axis;
    close(Math.hypot(...p), R); close(Math.hypot(...d), 1);
    close(p.reduce((s, x, i) => s + x * d[i], 0), -R * Math.sqrt(1 - a * a - b * b));
  }
  const low = P.cueContact(0, 0, -0.4, Math.PI / 2), high = P.cueContact(0, 0, 0.4, Math.PI / 2);
  assert(Math.abs(low.point[0] - high.point[0]) > 0.7 * R, 'vertical tip offsets collapsed to the same displayed point');
  // Rebound of the cue is part of the vertical contact solution; it cannot keep travelling down through the ball.
  const vertical = P.launch(4, 0, 0, Math.PI / 2);
  assert(vertical.tipVelocity[2] > vertical.velocity[2] && vertical.tip[2] > R, 'tip did not clear the rebounding ball');
  const centreHeight = P.hop(4, 1), offsetHeight = P.hop(4, 1, 0, 0.4);
  assert(Math.abs(centreHeight - offsetHeight) > 0.001, 'jump ignores tip offset');
  for (const el of [0, 0.6, 1.2, Math.PI / 2]) for (const a of [-0.4, 0, 0.4]) {
    const w = P.makeWorld(3); P.place(w, 0, -0.5, 0.1); P.place(w, 1, 0, 0.05); P.place(w, 2, 0.3, -0.1);
    P.strike(w, 0.13, 3.8, a, -0.2, el); shots++;
    close(P.hop(3.8, el, a, -0.2), w.balls[0].z + Math.max(0, w.balls[0].vz) ** 2 / 19.6);
    for (let t = 0; t < 600 && !P.rest(w); t++) {
      const before = energy(P, w); P.step(w, 1 / 120); ticks++;
      assert(energy(P, w) <= before * 1.0005 + 1e-7, 'contacts made total energy');
      assert(w.balls.every(b => ['x', 'y', 'z', 'vx', 'vy', 'vz', 'wx', 'wy', 'wz'].every(k => Number.isFinite(b[k]))));
    }
  }
  // A rail must create sidespin from translation, not just multiply pre-existing spin.
  const rail = P.makeWorld(1); P.place(rail, 0, P.HL - R - 1e-8, 0);
  const b = rail.balls[0]; b.vx = 2; b.vy = 1; const before = energy(P, rail); P.step(rail, 1e-6);
  assert(Math.abs(b.wz) > 1 && b.vx < 0); assert(energy(P, rail) <= before);
  // The raised cushion's restitution still holds while the bed supports the same ball. Applying the bed afterwards
  // would reduce this separating speed and silently change the rubber's restitution.
  const nose = [-Math.sqrt(0.84), 0, -0.4], arm = nose.map(x => -R * x);
  const contactVelocity = [b.vx + b.wy * arm[2] - b.wz * arm[1], b.vy + b.wz * arm[0] - b.wx * arm[2], b.vz + b.wx * arm[1] - b.wy * arm[0]];
  close(contactVelocity.reduce((s, x, i) => s + x * nose[i], 0), 0.84 * 2 * Math.sqrt(0.84), 1e-4);
  // Normal spin is not erased unconditionally. Strong draw, stun and roll have distinct rebound states.
  const spins = [-200, 0, 200].map(wy => { const w = P.makeWorld(1); P.place(w, 0, P.HL - R - 1e-8, 0); w.balls[0].vx = 2; w.balls[0].wy = wy; P.step(w, 1e-6); return w.balls[0].wy; });
  assert(new Set(spins.map(x => x.toFixed(5))).size === 3, 'different incoming roll collapsed to one state');
  const falling = P.makeWorld(2); P.place(falling, 0, 0, 0); P.place(falling, 1, 0, 0);
  falling.balls[0].z = 0.15; falling.balls[0].vz = -30; P.step(falling, 1 / 120);
  assert.equal(falling.ev.firstHit, 1, 'vertical speed was omitted from collision subdivision');
  assert(falling.balls.every(b => b.z >= 0 && (b.z > 0 || b.vz >= 0)), 'grounded collision left unsupported downward velocity');
  const supported = P.makeWorld(2); P.place(supported, 0, 0, 0); P.place(supported, 1, 0, 0);
  supported.balls[0].z = 2 * R - 1e-8; supported.balls[0].vz = -2; P.step(supported, 1e-7);
  assert(supported.balls[0].vz > 1.8 && supported.balls[1].vz === 0, 'falling-ball restitution ignored the lower ball\'s bed support');
}
// The optional effects change only their own source, not cloth/cushion friction or jump height.
{
  const full = createPhysics({ R: 0.028575, pockets: false }), tuned = createPhysics({ R: 0.028575, pockets: false, squirt: 0, throw: 0 });
  const a = full.makeWorld(1), b = tuned.makeWorld(1); full.strike(a, 0, 3, 0.4, 0, 0); tuned.strike(b, 0, 3, 0.4, 0, 0);
  assert(Math.abs(a.balls[0].vy) > 0.01); assert(Math.abs(b.balls[0].vy) < 1e-8);
  close(energy(full, a), energy(tuned, b), 1e-7);
  const hit = P => { const w = P.makeWorld(2); P.place(w, 0, -0.1, 0); P.place(w, 1, 0, 0.025); P.strike(w, 0, 2, 0, 0, 0); while (w.ev.firstHit == null) P.step(w, 1 / 1920); return w.balls[1]; };
  assert(Math.abs(hit(full).wz) > 0.01); close(hit(tuned).wz, 0);
  close(full.hop(4, 1, 0.4, 0), tuned.hop(4, 1, 0.4, 0));
}
console.log(`contacts: 4 ball sizes, shared contact geometry, cue clearance, offset-dependent jump, ${shots} shots/${ticks} energy steps, rail spin and independent effect controls`);
