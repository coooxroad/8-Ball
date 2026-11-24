'use strict';
/* The puzzle AI on the list as it is (owner 11-24): every puzzle in web/puzzles.js rated again by the virtual players
   (ai.js) on today's physics - after the physics changes, or when ai.js changes (11-24 밤: three tries). The answer is
   found again (gen.js search) and kept with the puzzle; one that can no longer be solved is said, not dropped (take it
   out by hand, or make the list again: gen.js). A 4구 puzzle with conditions that comes out at 800 or under is taken off
   the list (up to 800 only plain positions - owner 11-23); its id is not used again.

     node web/tools/puzzles/rate.js                          # rate every puzzle, write puzzles.js
     node web/tools/puzzles/rate.js --dry                    # print only
     node web/tools/puzzles/rate.js --part 0/2 --out a.json  # a share of them (one worker each), kept in a file ...
     node web/tools/puzzles/rate.js --merge a.json b.json    # ... and the shares written into puzzles.js */
const fs = require('fs'), path = require('path'), L = require('./lab'), G = require('./gen');
const args = process.argv.slice(2), opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : null; };
const DRY = args.includes('--dry'), FILE = path.join(__dirname, '../../puzzles.js');
const out = new Map(); let lost = 0;
if (args.includes('--merge')) {
  for (const f of args.slice(args.indexOf('--merge') + 1)) for (const [id, r] of JSON.parse(fs.readFileSync(f, 'utf8'))) out.set(+id, r);
} else {
  const [pi, pn] = (opt('part') || '0/1').split('/').map(Number);
  for (const z of L.Z.list.filter((q, i) => i % pn === pi)) {
    const base = Object.assign({}, z); delete base.sol; delete base.rating; delete base.fun;
    const r = G.evaluate(base, z.id);
    if (!r) { lost++; console.log(`${z.id}: no longer solved`); continue; }
    out.set(z.id, { sol: r.sol, rating: r.rating, fun: r.fun }); console.log(`${z.id}: ${z.rating} -> ${r.rating}  fun ${z.fun} -> ${r.fun}`);
  }
  console.log(`rated ${out.size}${lost ? `, ${lost} no longer solved` : ''}, ${L.sims()} shots`);
  if (opt('out')) { fs.writeFileSync(opt('out'), JSON.stringify([...out])); console.log('wrote ' + opt('out')); process.exit(0); }
}
if (!DRY) {
  let dropped = [];
  const src = fs.readFileSync(FILE, 'utf8').replace(/^(\s*)(\{"id":(\d+),.*\})(,?)\n/gm, (all, ind, json, id, comma) => {
    const q = JSON.parse(json), r = out.get(+id); if (!r) return all;
    q.sol = r.sol; q.rating = r.rating; q.fun = r.fun;
    if (L.Z.gameOf(q) === 'four' && !L.Z.plain(q) && q.rating <= 800) { dropped.push(q.id); return ''; }
    return ind + JSON.stringify(q) + comma + '\n';
  }).replace(/,(\n\s*\];)/, '$1');
  fs.writeFileSync(FILE, src); console.log(`wrote web/puzzles.js${dropped.length ? `; taken off (conditions, rated 800 or under): ${dropped.join(' ')}` : ''}`);
}
