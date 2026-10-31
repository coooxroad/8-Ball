/* Opens the built page (app/src/main/assets, made by sh web/build.sh) in headless Chromium, as the phone's WebView would.
   Needs playwright (or playwright-core with a Chromium); CHROME=<path> picks a browser, otherwise playwright's own. */
const fs = require('fs'), path = require('path');
let pw; try { pw = require('playwright'); } catch (e) { pw = require('playwright-core'); }
const A = path.join(__dirname, '..', '..', '..', 'app/src/main/assets');
const types = { '.html': 'text/html', '.js': 'application/javascript', '.woff2': 'font/woff2', '.webp': 'image/webp', '.mp3': 'audio/mpeg' };
exports.open = async (w, h, dpr) => {
  const browser = await pw.chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr || 1, hasTouch: true });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') console.log('console.error', m.text()); });
  page.on('pageerror', e => console.log('PAGEERROR', e.message, (e.stack || '').split('\n').slice(1, 4).join(' <- ')));
  await page.route('http://x.test/**', r => {
    let p = new URL(r.request().url()).pathname; if (p === '/') p = '/index.html';
    const f = path.join(A, decodeURIComponent(p));
    if (!fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    r.fulfill({ body: fs.readFileSync(f), contentType: types[path.extname(f)] || 'application/octet-stream' });
  });
  await page.goto('http://x.test/', { timeout: 120000 });
  await page.waitForTimeout(1500);
  return { browser, ctx, page };
};
