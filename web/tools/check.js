/* Checks the built page before it ships:   sh web/build.sh && node web/tools/check.js
   1. the whole script parses;
   2. no two files of a shared-scope folder (app/, reel/) declare the same top-level name - with several people working at
      once this is the mistake that does not show until the app is opened: the later declaration quietly replaces the earlier;
   3. files that are made by a tool have not been edited by hand since the tool made them (puzzles.js). */
const fs = require('fs'), path = require('path'), W = path.join(__dirname, '..');
let failed = 0; const fail = m => { failed++; console.log('FAIL', m); };
const page = fs.readFileSync(path.join(W, '..', 'app/src/main/assets/index.html'), 'utf8'), m = page.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
if (!m) fail('no script found in the built page'); else try { new Function(m[1]); } catch (e) { fail('the built script does not parse: ' + e.message); }
for (const dir of ['app', 'reel']) {
  const seen = {};
  for (const f of fs.readdirSync(path.join(W, dir)).sort()) {
    const src = fs.readFileSync(path.join(W, dir, f), 'utf8');
    for (const line of src.split('\n')) {
      // top level only: declarations that start in the first column
      const names = [];
      let d = line.match(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/); if (d) names.push(d[1]);
      d = line.match(/^(?:const|let)\s+(.*)$/);
      if (d) { let depth = 0, cur = '', parts = []; for (const ch of d[1]) { if ('([{'.includes(ch)) depth++; else if (')]}'.includes(ch)) depth--; if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch; } parts.push(cur);
        for (const p of parts) { const n = p.trim().match(/^([A-Za-z_$][\w$]*)\s*(=|$)/); if (n) names.push(n[1]); } }
      for (const n of names) { if (seen[n] && seen[n] !== f) fail(`${dir}/: "${n}" is declared in both ${seen[n]} and ${f}`); seen[n] = f; }
    }
  }
}
const pz = fs.readFileSync(path.join(W, 'puzzles.js'), 'utf8');
if (!/Made by tools\/gen-puzzles\.js/.test(pz)) fail('puzzles.js does not look like the output of tools/pack-puzzles.js');
console.log(failed ? `${failed} check(s) failed` : 'page checks passed');
process.exit(failed ? 1 : 0);
