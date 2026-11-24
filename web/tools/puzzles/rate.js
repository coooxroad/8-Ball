'use strict';
/* The puzzle AI on the list as it is (owner 11-24): every puzzle in web/puzzles.js rated again by the virtual players
   (ai.js) on today's physics - after the physics changes, or when ai.js FIND changes. The answer is found again (gen.js
   search) and kept with the puzzle; one that can no longer be solved is said, not dropped (take it out by hand, or make
   the list again: gen.js).

     node web/tools/puzzles/rate.js            # rate every puzzle, write puzzles.js
     node web/tools/puzzles/rate.js --dry      # print only */
const fs = require('fs'), path = require('path'), L = require('./lab'), G = require('./gen');
const DRY = process.argv.includes('--dry'), FILE = path.join(__dirname, '../../puzzles.js');
const out = new Map(); let lost = 0;
for (const z of L.Z.list) {
  const base = Object.assign({}, z); delete base.sol; delete base.rating; delete base.fun;
  const r = G.evaluate(base, z.id);
  if (!r) { lost++; console.log(`${z.id}: no longer solved`); continue; }
  out.set(z.id, r); console.log(`${z.id}: ${z.rating} -> ${r.rating}  fun ${z.fun} -> ${r.fun}`);
}
console.log(`rated ${out.size} / ${L.Z.list.length}${lost ? `, ${lost} no longer solved` : ''}, ${L.sims()} shots`);
if (!DRY) {
  const src = fs.readFileSync(FILE, 'utf8').replace(/^(\s*)(\{"id":(\d+),.*\})(,?)$/gm, (all, ind, json, id, comma) => {
    const q = JSON.parse(json), r = out.get(+id); if (!r) return all;
    q.sol = r.sol; q.rating = r.rating; q.fun = r.fun; return ind + JSON.stringify(q) + comma;
  });
  fs.writeFileSync(FILE, src); console.log('wrote web/puzzles.js');
}
