#!/usr/bin/env node
'use strict';
// Independently remeasure the saved, rounded answers rather than trusting generation logs.
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), { createHash } = require('crypto');
const { STAGES, verify, width, play, seeded } = require('./engine');
const { similar, samePosition, occluded, propose } = require('./layouts');
const { counterexample } = require('./search');
const { fingerprint, assign } = require('./catalog');
const Z = require('../../puzzles.js')(), ledger = require('./ids.json'), report = require('./report.json');
assert.equal(Z.list.length, 70); assert.equal(new Set(Z.list.map(z => z.id)).size, 70);
for (let i = 0; i < Z.list.length; i++) assert(!Z.list.slice(0, i).some(z => samePosition(z.balls, Z.list[i].balls)), `global near copy ${Z.list[i].id}`);
// Reproducibility includes layout proposals, and ledger tombstones survive removals.
for (let stage = 0; stage < 7; stage++) assert.deepEqual(propose(stage, seeded(7)), propose(stage, seeded(7)));
const sample = { id: 101, stage: 0, balls: [[0, 0], [1, 0], [0.2, 0], [0.3, 0.1]] };
const retiredHash = fingerprint(sample);
const retired = [{ id: 101, stage: 0, hash: retiredHash }], result = [{ puzzles: [sample], report: [{}] }];
const after = assign(result, [], retired); assert.equal(sample.id, 102); assert.equal(after[0].hash, retiredHash);
for (let stage = 0; stage < 7; stage++) {
  const list = Z.of(stage), r = report.stages.find(s => s.stage === stage); assert.equal(list.length, 10);
  for (const [file, hash] of [['physics.js', r.physics], ['game.js', r.rules]]) assert.equal(createHash('sha256').update(fs.readFileSync(path.resolve(__dirname, '../..', file))).digest('hex'), hash, `${file} changed: regenerate`);
  let last = Infinity;
  for (let i = 0; i < list.length; i++) {
    const z = list[i], saved = r.puzzles.find(p => p.id === z.id); assert.equal(z.n, i + 1); verify(z);
    assert.equal(ledger.find(e => e.id === z.id).hash, fingerprint(z));
    assert(!list.slice(0, i).some(p => similar(z.balls, p.balls)), `near duplicate ${z.id}`);
    const measured = width(z.balls, z.sol, STAGES[stage].goal);
    assert.equal(measured.good, saved.good, `width changed ${z.id}`);
    assert(measured.percent >= 1 && measured.percent <= 90 && measured.percent <= last, `difficulty ${z.id}`); last = measured.percent;
    if (stage === 0) assert.equal(play(z.balls, z.sol, 'score').ev.cushions, 0);
    if (stage === 3 || stage === 6) assert(!counterexample(z.balls, z.sol, stage), `technique bypass ${z.id}`);
    if (stage === 6) assert(occluded(z.balls));
    if (stage === 4) {
      assert(saved.open); assert(width(z.balls, saved.open, 'score', false, 3).percent >= 50);
      assert(!play(z.balls, saved.open, 'score').ok);
    }
  }
  console.log(`audit stage ${stage}: 10 answers, widths ${last.toFixed(1)}–${r.puzzles[0].percent.toFixed(1)}%, technique checks pass`);
}
console.log('Puzzle audit passed: 70 answers at stored/slider speeds and 30/40 seconds; ids, spacing, order and technique checks.');
