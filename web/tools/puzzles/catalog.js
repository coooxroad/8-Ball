'use strict';
const { createHash } = require('crypto');
const fingerprint = z => createHash('sha256').update(JSON.stringify(z.walls && z.walls.length ? [z.stage, z.balls, z.walls.map(q => [q.x, q.y, q.len, q.thick, q.ang, q.h])] : [z.stage, z.balls])).digest('hex');
function assign(results, previous, ledger) {
  const entries = ledger.slice();
  // Adopt existing content as well, so even a list predating the ledger is protected.
  for (const z of previous) {
    const hash = fingerprint(z), known = entries.find(e => e.id === z.id);
    if (known && known.hash !== hash) throw Error(`published id ${z.id} changed`);
    if (!known) { entries.push({ id: z.id, stage: z.stage, hash }); }
  }
  for (const result of results) result.puzzles.forEach((z, i) => {
    const hash = fingerprint(z), known = previous.find(e => fingerprint(e) === hash);
    if (known) z.id = known.id;
    else {
      const start = (z.stage + 1) * 100, last = entries.filter(e => e.stage === z.stage).reduce((n, e) => Math.max(n, e.id), start);
      if (last + 1 >= start + 100) throw Error(`stage ${z.stage} exhausted its id range; do not recycle ids`);
      z.id = last + 1; entries.push({ id: z.id, stage: z.stage, hash });
    }
    result.report[i].id = z.id;
  });
  return entries.sort((a, b) => a.id - b.id);
}
module.exports = { fingerprint, assign };
