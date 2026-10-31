/* Checks the built page before it ships:   sh web/build.sh && node web/tools/check.js
   1. the whole script parses;
   2. no two files of a shared-scope folder (app/, reel/, scene/) declare the same top-level name - with several people working at
      once this is the mistake that does not show until the app is opened: the later declaration quietly replaces the earlier;
   3. what can be owned (content/) is whole: every item has an id unique in its kind, a name, a rarity within RARITY, the
      picture its card needs, and a sound that names a recording only if web/sound/ has it; every texture and sound an
      item names exists;
   4. every id the markup has is unique, and every picture the styles or scripts name as ui/<name>.webp exists. */
const fs = require('fs'), path = require('path'), W = path.join(__dirname, '..');
let failed = 0; const fail = m => { failed++; console.log('FAIL', m); };
const page = fs.readFileSync(path.join(W, '..', 'app/src/main/assets/index.html'), 'utf8'), m = page.match(/<script>([\s\S]*?)<\/script>\s*<\/body>/);
if (!m) fail('no script found in the built page'); else try { new Function(m[1]); } catch (e) { fail('the built script does not parse: ' + e.message); }
for (const dir of ['app', 'reel', 'scene']) {
  const seen = {};
  for (const f of fs.readdirSync(path.join(W, dir)).sort()) {
    const src = fs.readFileSync(path.join(W, dir, f), 'utf8');
    for (const raw of src.split('\n')) {
      const line = dir === 'scene' ? raw.replace(/^  (?=\S)/, '') : raw;   // (scene/ is the body of one function: its top level is two spaces in)
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
// 3. content/
{
  const C = {}; for (const f of fs.readdirSync(path.join(W, 'content')).sort()) Object.assign(C, require(path.join(W, 'content', f)));
  const has = p => fs.existsSync(path.join(W, p));
  const sounds = fs.existsSync(path.join(W, 'sound')) ? fs.readdirSync(path.join(W, 'sound')).map(f => f.replace(/\.[^.]+$/, '')) : [];
  const kinds = { CUES: q => `ui/cue-${q.id}.webp`, BALLSKINS: null, CLOTHS: q => `ui/cloth-${q.id}.webp`, TRAILS: null, GLOVES: q => `ui/glove-${q.id}.webp` };
  for (const [k, pic] of Object.entries(kinds)) {
    const list = C[k]; if (!Array.isArray(list) || !list.length) { fail(`content: ${k} is missing or empty`); continue; }
    const ids = new Set();
    for (const q of list) {
      const at = `content ${k} '${q.id}'`;
      if (!q.id || !/^[a-z0-9-]+$/.test(q.id)) fail(`${at}: id must be lower-case letters, digits or -`);
      if (ids.has(q.id)) fail(`${at}: id used twice`); ids.add(q.id);
      if (!q.name) fail(`${at}: no name`);
      if (!Number.isInteger(q.rarity) || q.rarity < 0 || q.rarity >= C.RARITY.length) fail(`${at}: rarity must be 0..${C.RARITY.length - 1}`);
      if (pic && !has(pic(q))) fail(`${at}: its card picture ${pic(q)} is missing`);
      if (q.mat && !has(`tex/ball-${q.mat}.webp`)) fail(`${at}: its surface tex/ball-${q.mat}.webp is missing`);
      if (q.sound) {
        for (const n of ['rate', 'tone', 'gain']) if (q.sound[n] != null && !(q.sound[n] > 0 && q.sound[n] < 4)) fail(`${at}: sound.${n} should be a number between 0 and 4 (1 = as recorded)`);
        if (q.sound.file && !sounds.includes(q.sound.file)) fail(`${at}: sound.file '${q.sound.file}' is not in web/sound/`);
      }
    }
  }
  for (const c of C.CUES || []) for (const n of ['shaft', 'ferrule', 'tip', 'joint', 'fore', 'wrap', 'sleeve']) if (typeof c[n] !== 'number') fail(`content CUES '${c.id}': colour ${n} missing`);
}
// 4. the markup's ids, and the pictures named by path
{
  const html = fs.readFileSync(path.join(W, 'index.html'), 'utf8'), seen = new Set();
  for (const [, id] of html.matchAll(/\bid="([^"]+)"/g)) { if (seen.has(id)) fail(`index.html: id "${id}" used twice`); seen.add(id); }
  const named = new Set(); for (const [, n] of page.matchAll(/ui\/([a-z0-9-]+)\.webp/g)) named.add(n);
  for (const n of named) if (!fs.existsSync(path.join(W, 'ui', n + '.webp'))) fail(`ui/${n}.webp is named but missing`);
}
console.log(failed ? `${failed} check(s) failed` : 'page checks passed');
process.exit(failed ? 1 : 0);
