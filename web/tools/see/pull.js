'use strict';
/* What the server keeps, read for the Fit workflow (.github/workflows/fit.yml) with the admin password (env PASS - the
   repository's ADMIN_PASSWORD secret, never written anywhere): the puzzle attempts (the puzzles' book, every one) into
   tries.json, and the shot dataset's rows (the months asked for, this one if none; up to --max shots) into shots.json.
     PASS=… node web/tools/see/pull.js [--months shots-2026-11 shots-2026-12] [--max 3000] */
const fs = require('fs');
const SERVER = process.env.SERVER || 'https://api.danguuu.com', PASS = process.env.PASS;
const args = process.argv.slice(2), opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : null; };
const months = (() => { const i = args.indexOf('--months'); if (i < 0) return []; const out = []; for (let j = i + 1; j < args.length && !args[j].startsWith('--'); j++) out.push(args[j]); return out.filter(m => /^shots-\d{4}-\d{2}$/.test(m)); })();
const max = +(opt('max') || 3000);
async function admin(what, body) {
  const r = await fetch(`${SERVER}/v1/admin/${what}`, { method: 'POST', headers: { 'X-Admin-Pass': PASS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ ok: false, why: 'not json' })); if (!j.ok) throw new Error(`${what}: ${j.why || r.status}`); return j;
}
(async () => {
  if (!PASS) { console.log('no PASS (the ADMIN_PASSWORD secret) - nothing read'); process.exit(1); }
  const tries = []; for (let after = 0, k = 0; k < 500; k++) { const j = await admin('puzzles', { after, limit: 1000 }); tries.push(...j.rows); if (j.rows.length < 1000) break; after = j.next; }
  fs.writeFileSync('tries.json', JSON.stringify(tries)); console.log(`puzzle attempts: ${tries.length}`);
  const rows = []; let shots = 0;
  for (const month of months.length ? months : [null]) {
    for (let after = 0, k = 0; k < 2000 && shots < max; k++) {
      const j = await admin('dataset', Object.assign({ after, limit: 100 }, month ? { month } : {}));
      for (const r of j.rows) { rows.push(r); shots += (r.shots || []).length; }
      if (!j.more) break; after = j.next;
    }
  }
  fs.writeFileSync('shots.json', JSON.stringify(rows)); console.log(`shot dataset: ${rows.length} games, ${shots} shots`);
})().catch(e => { console.log('could not read:', e.message); process.exit(1); });
