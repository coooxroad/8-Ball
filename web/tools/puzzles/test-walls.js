#!/usr/bin/env node
'use strict';
const assert = require('assert/strict'), { createHash } = require('crypto');
const { seeded, P, play } = require('./engine');
const { validWalls, wallGap, proposeWalls } = require('./walls');
const { fingerprint, assign } = require('./catalog');
const wall = (x = 0, y = 0, len = 0.3, ang = 0) => ({ x, y, len, thick: 0.03, ang, h: 0.04 });
const balls = [[-0.7, 0], [-0.8, 0.4], [0.6, 0.2], [0.8, -0.3]];
assert(validWalls(balls, [wall()]));
assert(!validWalls(balls, [])); assert(!validWalls(balls, [null]));
assert(!validWalls(balls, [wall(...balls[0])]));
assert(!validWalls(balls, [wall(P.HL - 0.05, 0, 0.2, Math.PI / 4)]));
assert(!validWalls(balls, [wall(0, P.HW - 0.08, 0.3, Math.PI / 4)]), 'rotated corner approaches cushion');
assert(!validWalls(balls, [wall(), wall(0, 0, 0.3, Math.PI / 2)]), 'crossing rectangles must overlap');
assert(!validWalls(balls, [wall(), wall(0, 0.03 + 2 * P.R - 1e-6)]));
assert(validWalls(balls, [wall(), wall(0, 0.03 + 2 * P.R + 1e-6)]));
assert(Math.abs(wallGap(wall(), wall(0, 0.2)) - 0.17) < 1e-9);
for (const change of [{ len: 0.149 }, { len: 0.501 }, { thick: 0.04 }, { h: 0.05 }, { ang: NaN }]) assert(!validWalls(balls, [{ ...wall(), ...change }]));
// The generator's collision path must actually include walls; this is not a geometry-only test.
const straight = [[-0.6, 0], [-0.7, 0.4], [0.3, 0], [0.7, 0.2]], sol = [0, 2, 0, 0, 0];
const bare = play(straight, sol, 'score'), blocked = play(straight, sol, 'score', true, 30, [wall()]);
assert.equal(bare.ev.firstHit, 2); assert(blocked.ev.walls > 0); assert.notEqual(blocked.ev.firstHit, bare.ev.firstHit);
const a = proposeWalls(straight, sol, seeded(3), 3), b = proposeWalls(straight, sol, seeded(3), 3);
assert(a && validWalls(straight, a)); assert.deepEqual(a, b);
// Existing fingerprints remain byte-for-byte compatible; changing a wall must allocate a new id.
const old = require('../../puzzles.js')().list.filter(z => z.stage < 7), ledger = require('./ids.json');
assert.equal(old.length, 70);
for (const z of old) { assert.equal(fingerprint(z), ledger.find(e => e.id === z.id).hash); assert.equal(fingerprint(z), createHash('sha256').update(JSON.stringify([z.stage, z.balls])).digest('hex')); }
const z = { id: 801, stage: 7, balls, walls: [wall()] }, altered = { ...z, walls: [wall(0.1, 0)] };
assert.notEqual(fingerprint(z), fingerprint(altered));
const result = [{ puzzles: [altered], report: [{}] }], previous = [{ id: 801, stage: 7, hash: fingerprint(z) }];
const next = assign(result, [z], previous); assert.equal(altered.id, 802); assert.equal(next[0].hash, fingerprint(z));
console.log('Walls checks passed: spacing, rotated/crossing rectangles, simulation, seeded proposals, old ids and wall identity.');
