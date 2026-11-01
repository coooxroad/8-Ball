#!/usr/bin/env node
'use strict';
const fs = require('fs'), path = require('path'), { Worker } = require('worker_threads'), { createHash } = require('crypto');
const { verify, STAGES } = require('./engine'), { assign } = require('./catalog'), { samePosition } = require('./layouts');
const args = process.argv.slice(2), option = (name, fallback) => { const i = args.indexOf(name); if (i >= 0 && i === args.length - 1) throw Error(`missing value: ${name}`); return i < 0 ? fallback : args[i + 1]; };
if (args.length % 2 || args.some((v, i) => i % 2 === 0 && !['--seed', '--stage'].includes(v))) throw Error('Use --seed <uint32> --stage all|0,1,...,7');
const seed = Number(option('--seed', 20261101)), selected = option('--stage', 'all');
if (selected !== 'all' && !/^[0-7](,[0-7])*$/.test(selected)) throw Error('stage must be all or 0..7');
const stages = selected === 'all' ? STAGES.map((_, i) => i) : selected.split(',').map(Number);
if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff || new Set(stages).size !== stages.length || stages.some(s => !Number.isInteger(s) || !STAGES[s])) throw Error('Use --seed <uint32> --stage all|0,1,...,7');
const dest = path.resolve(__dirname, '../../puzzles.js'), cache = path.join(__dirname, '.work');
const read = (name, fallback) => fs.existsSync(path.join(__dirname, name)) ? JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8')) : fallback;
const hashFile = file => createHash('sha256').update(fs.readFileSync(path.resolve(__dirname, '../..', file))).digest('hex');
fs.mkdirSync(cache, { recursive: true });
async function main() {
  const workers = [];
  let results;
  try {
    results = await Promise.all(stages.map(stage => new Promise((resolve, reject) => {
      const worker = new Worker(path.join(__dirname, 'stage.js'), { workerData: { seed, stage, count: 10 } }); workers.push(worker);
      worker.on('message', result => { fs.writeFileSync(path.join(cache, `${seed}-${stage}.json`), JSON.stringify(result, null, 2) + '\n'); resolve(result); });
      worker.on('error', reject); worker.on('exit', code => { if (code) reject(Error(`stage ${stage} exited ${code}`)); });
    })));
  } catch (e) { await Promise.all(workers.map(w => w.terminate())); throw e; }
  const old = require(dest)().list, ledger = assign(results, old, read('ids.json', []));
  const next = old.filter(z => !stages.includes(z.stage)).concat(results.flatMap(r => r.puzzles)).sort((a, b) => a.stage - b.stage || a.n - b.n);
  for (let i = 0; i < next.length; i++) {
    verify(next[i]);
    if (next.slice(0, i).some(z => samePosition(z.balls, next[i].balls))) throw Error(`near duplicate ${next[i].id}; choose another seed`);
  }
  const report = read('report.json', { stages: [] });
  const metadata = { seed, physics: hashFile('physics.js'), rules: hashFile('game.js') };
  report.stages = report.stages.filter(r => !stages.includes(r.stage)).concat(results.map(r => ({ stage: r.stage, ...metadata, samples: 441, percentRange: [1, 90], puzzles: r.report }))).sort((a, b) => a.stage - b.stage);
  const text = fs.readFileSync(dest, 'utf8');
  if (!/  const list = \[[\s\S]*?\];/.test(text)) throw Error('list marker missing');
  const output = text.replace(/  const list = \[[\s\S]*?\];/, '  const list = [\n' + next.map(z => '    ' + JSON.stringify(z)).join(',\n') + '\n  ];');
  // Complete all validation before replacing any published output. The ledger keeps tombstones.
  for (const [file, data] of [['ids.json', ledger], ['report.json', report]]) fs.writeFileSync(path.join(__dirname, file), JSON.stringify(data, null, 2) + '\n');
  fs.writeFileSync(dest, output);
  console.log(`Saved ${next.length} puzzles; seed ${seed}. Report: web/tools/puzzles/report.json`);
}
main().catch(e => { console.error(e); process.exitCode = 1; });
