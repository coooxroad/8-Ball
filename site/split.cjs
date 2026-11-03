/* The web's page, split for the browser's cache (run by .github/workflows/site.yml on the built page, after web/build.sh;
   the Android app keeps its one page - it reads its files from the device, where none of this matters).
   The page the app carries is one 2 MB file: every visit downloads all of it again, the 3D's pictures and the items'
   sounds inside it as base64. On the web it becomes:
     index.html             the markup only (small, always asked for afresh)
     h/style.<hash>.css     the styles
     h/core.<hash>.js       the game's core (also what the computer player's Worker is started from: app/40-shot.js)
     h/app.<hash>.js        the app
     h/tex-<name>.<hash>.webp, h/snd-<name>.<hash>.<ext>   each picture and sound as a file of its own, fetched when used
   Everything under h/ is named by its contents, so the browser keeps it for a year (_headers) and an update fetches only
   what changed. Usage: node site/split.cjs <built assets folder> */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const dir = process.argv[2]; if (!dir) throw new Error('Usage: node site/split.cjs <assets folder>');
const hash = b => crypto.createHash('sha1').update(b).digest('hex').slice(0, 10);
const H = path.join(dir, 'h'); fs.rmSync(H, { recursive: true, force: true }); fs.mkdirSync(H);
const put = (name, ext, body) => { const f = `${name}.${hash(body)}.${ext}`; fs.writeFileSync(path.join(H, f), body); return 'h/' + f; };
let html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const must = (re, what) => { const m = html.match(re); if (!m) throw new Error('split: no ' + what + ' in the page'); return m; };

// the styles: the big block (the small one in <head> is the fonts, left where it is)
const styles = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].sort((a, b) => b[1].length - a[1].length)[0];
if (!styles || styles[1].length < 10000) throw new Error('split: the styles were not found');
html = html.replace(styles[0], () => `<link rel="stylesheet" href="${put('style', 'css', styles[1])}">`);

// the core, then the app with its embedded pictures and sounds taken out to files
const core = must(/<script id="core">([\s\S]*?)<\/script>/, 'core script');
html = html.replace(core[0], () => `<script id="core" src="${put('core', 'js', core[1])}"></script>`);
const app = must(/<script>([\s\S]*?)<\/script>(\s*<\/body>)/, 'app script');
let js = app[1];
const media = (name, prefix) => {
  const m = js.match(new RegExp(`^const ${name} = \\{\\n([\\s\\S]*?)^\\};`, 'm')); if (!m) throw new Error('split: no ' + name);
  const lines = m[1].split('\n').filter(Boolean).map(l => {
    const e = l.match(/^'([^']+)': 'data:([a-z]+)\/([a-z0-9]+);base64,([^']*)',$/); if (!e) throw new Error('split: odd line in ' + name);
    const ext = e[3] === 'mpeg' ? 'mp3' : e[3];
    return `'${e[1]}': '${put(prefix + e[1], ext, Buffer.from(e[4], 'base64'))}',`;
  });
  js = js.replace(m[0], () => `const ${name} = {\n${lines.join('\n')}\n};`);
  return lines.length;
};
const nt = media('TEXTURES', 'tex-'), ns = media('SOUNDS', 'snd-');
html = html.replace(app[0], () => `<script src="${put('app', 'js', js)}"></script>${app[2]}`);
fs.writeFileSync(path.join(dir, 'index.html'), html);

// what never changes under its name is kept; the page itself is asked for each time (Cloudflare's own default)
fs.writeFileSync(path.join(dir, '_headers'), '/h/*\n  Cache-Control: public, max-age=31536000, immutable\n');
console.log(`split: index.html ${(html.length / 1024).toFixed(0)} KB, ${fs.readdirSync(H).length} files in h/ (${nt} pictures, ${ns} sounds)`);
