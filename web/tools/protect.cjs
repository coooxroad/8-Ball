/* What is shipped is not what is written: the built page's scripts minified and their local names scrambled (terser),
   comments gone - so the APK's page and the website cannot be read back into the game's source and copied as it is.
   Only the shipped copy changes: web/ stays as it is, and so does the page web/build.sh makes for the checks (they run on
   it before this). Run by CI on the APK's and the site's builds (build.yml, site.yml), after the checks:
     npm i --no-save terser@5 && node web/tools/protect.cjs app/src/main/assets
   Names at the top of each script stay (the core and the app share them across scripts, and the computer player's Worker
   is started from the core's own text - app/40-shot.js), as do property names (saved data, the server's messages).
   The real protection is the server: every result is played again there (server/src/check.js); this only makes copying
   and tampering slower. Checked: node web/tools/protect.cjs <copy> and the smoke check on the copy (11-16). */
const fs = require('fs'), path = require('path');
let terser; try { terser = require('terser'); } catch (e) { console.error('protect: terser is not installed (npm i --no-save terser@5)'); process.exit(1); }
const dir = process.argv[2]; if (!dir) throw new Error('Usage: node web/tools/protect.cjs <built assets folder>');
const file = path.join(dir, 'index.html');
const opts = {
  ecma: 2020, module: false, toplevel: false,
  compress: { passes: 1, keep_fargs: true, keep_fnames: false, unsafe: false, pure_getters: false },
  mangle: { toplevel: false, safari10: true },
  format: { comments: false, ascii_only: false },
};
const squeeze = async src => { const out = await terser.minify(src, opts); if (out.error || !out.code) throw out.error || new Error('protect: terser gave nothing'); return out.code; };
(async () => {
  // the website's page, split (site/split.cjs - run that first, on the plain page): its h/core.*.js and h/app.*.js
  const H = path.join(dir, 'h');
  if (fs.existsSync(H)) {
    const js = fs.readdirSync(H).filter(f => /^(core|app)\.[0-9a-f]+\.js$/.test(f)); if (js.length !== 2) throw new Error('protect: h/ has no core and app scripts');
    let a = 0, b = 0; for (const f of js) { const src = fs.readFileSync(path.join(H, f), 'utf8'), code = await squeeze(src); a += src.length; b += code.length; fs.writeFileSync(path.join(H, f), code); }
    return console.log(`protect: h/ ${js.join(', ')}, ${(a / 1024).toFixed(0)} KB -> ${(b / 1024).toFixed(0)} KB`);
  }
  // the APK's page: one file, the scripts inside it
  let html = fs.readFileSync(file, 'utf8'), before = html.length, n = 0;
  // the page's own scripts: the core (<script id="core">) and the app (the last one); three.min.js is a file already minified
  const blocks = [...html.matchAll(/<script( id="core")?>([\s\S]*?)<\/script>/g)].filter(m => m[2].length > 1000);
  if (blocks.length < 2) throw new Error('protect: the core and the app scripts were not found');
  for (const m of blocks) {
    const code = await squeeze(m[2]);
    // ($& and the like in the code must not be read as replace() patterns)
    html = html.replace(m[0], () => `<script${m[1] || ''}>${code}</script>`); n++;
  }
  fs.writeFileSync(file, html);
  console.log(`protect: ${n} scripts, ${(before / 1024).toFixed(0)} KB -> ${(html.length / 1024).toFixed(0)} KB`);
})().catch(e => { console.error(e); process.exit(1); });
