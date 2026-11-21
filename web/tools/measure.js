/* A tool, not a check: the numbers a tidy or an optimization is judged by (owner 11-22: three rounds of cleanup and
   optimization keeping the UI as it is - tasks/CUE-refactor-plan.md). Build first. Headless Chromium draws with SwiftShader
   (the CPU), so the times are slow and only comparable with each other, on the same machine:
     node web/tools/measure.js /tmp/m-before.json
     node web/tools/measure.js /tmp/m-after.json
     node web/tools/measure.js --compare /tmp/m-before.json /tmp/m-after.json
   Static: the page's parts in bytes (the core and app scripts, the styles, what is carried inside as data), the assets.
   Running (1280 x 800 x 2): time to the menu, the script heap, the DOM's size, the menu's browser-drawn layers (as
   test/browser/ui-budget.js counts them), main-thread work over 5 s of an idle menu, shop and 내 장비; in free practice the
   draw calls and work over 5 s idle and over a shot; the time a tab switch takes. */
const fs = require('fs'), path = require('path');
if (process.argv[2] === '--compare') {
  const [a, b] = [process.argv[3], process.argv[4]].map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
  const flat = (o, p = '', r = {}) => { for (const [k, v] of Object.entries(o)) typeof v === 'object' && v ? flat(v, p + k + '.', r) : (r[p + k] = v); return r; };
  const A = flat(a), B = flat(b);
  for (const k of Object.keys({ ...A, ...B })) {
    const x = A[k], y = B[k], d = typeof x === 'number' && typeof y === 'number' && x ? ((y - x) / x * 100) : null;
    console.log(k.padEnd(34), String(x).padStart(12), String(y).padStart(12), d == null ? '' : ((d > 0 ? '+' : '') + d.toFixed(1) + '%').padStart(9));
  }
  process.exit(0);
}
const out = process.argv[2] || '/tmp/measure.json';
const A = path.join(__dirname, '..', '..', 'app/src/main/assets');
const { open } = require('../test/browser/harness.js');
const dirSize = d => fs.readdirSync(d, { withFileTypes: true }).reduce((s, e) => s + (e.isDirectory() ? dirSize(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0);
(async () => {
  const res = { static: {}, run: {} };
  // ---- the page's parts
  const html = fs.readFileSync(path.join(A, 'index.html'), 'utf8'), S = res.static;
  S.page = Buffer.byteLength(html);
  for (const m of html.matchAll(/<(script|style)([^>]*)>([\s\S]*?)<\/\1>/g)) {
    const n = Buffer.byteLength(m[3]); if (!n) continue;
    const k = m[1] === 'style' ? 'css' : /id="core"/.test(m[2]) ? 'core' : 'app'; S[k] = (S[k] || 0) + n;
  }
  S.dataUris = [...html.matchAll(/data:[a-z/+-]+;base64,[A-Za-z0-9+/=]+/g)].reduce((s, m) => s + m[0].length, 0);
  S.ui = dirSize(path.join(A, 'ui')); S.music = dirSize(path.join(A, 'music')); S.assets = dirSize(A);
  // ---- running
  const t0 = Date.now();
  const { browser, page, errors } = await open(1280, 800, 2, { init: () => { if (!localStorage.getItem('dp8.prefs')) localStorage.setItem('dp8.prefs', JSON.stringify({ v: 2, how: true, sound: false, music: false })); } });
  const R = res.run, cdp = await page.context().newCDPSession(page);
  try {
    await page.waitForFunction(() => !!window.__dp8 && document.querySelectorAll('#dkCards .mn-card').length > 3, null, { timeout: 60000 });
    R.menuReadyMs = Date.now() - t0;
    await page.waitForTimeout(3000);
    await cdp.send('Performance.enable');
    const work = async ms => { const m0 = (await cdp.send('Performance.getMetrics')).metrics; await page.waitForTimeout(ms); const m1 = (await cdp.send('Performance.getMetrics')).metrics;
      const g = (m, k) => (m.find(x => x.name === k) || {}).value || 0;
      return { taskMs: Math.round((g(m1, 'TaskDuration') - g(m0, 'TaskDuration')) * 1000), scriptMs: Math.round((g(m1, 'ScriptDuration') - g(m0, 'ScriptDuration')) * 1000),
        layoutMs: Math.round((g(m1, 'LayoutDuration') - g(m0, 'LayoutDuration')) * 1000), styleMs: Math.round((g(m1, 'RecalcStyleDuration') - g(m0, 'RecalcStyleDuration')) * 1000) }; };
    const heap = async () => { await cdp.send('HeapProfiler.collectGarbage').catch(() => {}); const h = await cdp.send('Runtime.getHeapUsage'); return Math.round(h.usedSize / 1e5) / 10; };
    R.menuHeapMB = await heap();
    R.menuDom = await page.evaluate(() => document.getElementsByTagName('*').length);
    // the menu's layers drawn by the browser (pictures and canvases not counted - test/browser/ui-budget.js)
    let layers = null; cdp.on('LayerTree.layerTreeDidChange', e => { if (e.layers) layers = e.layers; });
    await cdp.send('LayerTree.enable'); await page.waitForTimeout(1200);
    let px = 0, n = 0;
    for (const l of layers || []) { if (!l.drawsContent) continue; n++; let tag = ''; if (l.backendNodeId) { try { tag = (await cdp.send('DOM.describeNode', { backendNodeId: l.backendNodeId })).node.nodeName; } catch (e) {} }
      if (tag !== 'IMG' && tag !== 'CANVAS') px += l.width * l.height * 4; }
    await cdp.send('LayerTree.disable');
    R.menuLayers = n; R.menuLayerMpx = Math.round(px / 1e5) / 10;
    R.menuIdle = await work(5000);
    // the tabs: switching, and idle on each
    const tab = async t => { const s = Date.now(); await page.locator(`.dk-tab[data-t="${t}"]`).click(); await page.waitForTimeout(50); await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); return Date.now() - s; };
    R.tabShopMs = await tab('shop'); await page.waitForTimeout(2500); R.shopIdle = await work(5000); R.shopDom = await page.evaluate(() => document.getElementsByTagName('*').length);
    R.tabGearMs = await tab('gear'); await page.waitForTimeout(2500); R.gearIdle = await work(5000);
    R.tabPlayMs = await tab('play'); await page.waitForTimeout(1500);
    // free practice: idle, then a shot
    await page.evaluate(() => { const b = [...document.querySelectorAll('#dkCards .mn-card')].find(c => /자유 연습/.test(c.textContent)); b && b.click(); });
    await page.waitForTimeout(1500);
    await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /^(시작|연습 시작)/.test(x.textContent.trim())); b && b.click(); });
    await page.waitForFunction(() => __dp8.st.screen === 'play' && __dp8.st.phase === 'aim', null, { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2500);
    R.playHeapMB = await heap();
    R.playIdle = await work(5000);
    R.playCalls = await page.evaluate(() => __dp8.scene.info.render.calls); R.playTris = await page.evaluate(() => __dp8.scene.info.render.triangles);
    await page.evaluate(() => { const d = __dp8; if (d.st.phase === 'aim') d.shoot(d.game.vOf(0.7), 0, 0, 0); });
    R.playShot = await work(5000);
    R.errors = errors.length;
  } finally { await browser.close(); }
  fs.writeFileSync(out, JSON.stringify(res, null, 1));
  console.log(JSON.stringify(res, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
