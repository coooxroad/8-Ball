/* Desktop sizing, high-DPI input, GPU fallback and context recovery. Build first; uses the smoke harness's Chromium. */
const assert = require('node:assert/strict');
const { open } = require('./harness.js');
const ready = page => page.waitForFunction(() => !!window.__dp8, null, { timeout: 30000 });
const pause = page => page.waitForTimeout(650);
(async () => {
  for (const dpr of (process.env.DPR ? JSON.parse(process.env.DPR) : [1, 2])) {
    const { browser, page, errors } = await open(1366, 768, dpr);
    try {
      await ready(page);
      for (const [width, height] of (process.env.SZ ? JSON.parse(process.env.SZ) : [[900, 600], [1024, 768], [1201, 768], [1280, 800], [1366, 768], [1920, 1080], [2560, 1440], [3840, 2160], [860, 412], [412, 860]])) {
        await page.setViewportSize({ width, height }); await pause(page);
        await page.waitForFunction(() => {
          const a = document.querySelector('#app'), w = a.clientWidth, h = a.clientHeight;
          return a.classList.contains('compact') === !(w >= 900 && h >= 560) && a.classList.contains('portrait') === (h > w);
        });
        const measure = await page.evaluate(() => {
          const canvas = document.querySelector('#gl'), bar = document.querySelector('#deskBar');
          const buttons = [...bar.querySelectorAll('.dk-tab, .dk-top')].map(x => ({ ...x.getBoundingClientRect().toJSON(), scroll: x.scrollWidth, client: x.clientWidth }));
          const groups = [...bar.children].map(x => x.getBoundingClientRect().toJSON()).filter(x => x.width > 0);
          return { pixels: canvas.width * canvas.height, buttons, groups, ratio: __dp8.scene.pixelRatio };
        });
        assert(measure.pixels > 0 && measure.pixels <= 4.2e6, `${width}x${height}@${dpr}: pixel budget`);
        for (const b of measure.buttons) { assert(b.left >= -1 && b.right <= width + 1, `${width}x${height}@${dpr}: bar button within screen (${JSON.stringify(b)})`); assert(b.scroll <= b.client + 1, 'bar label fits'); }
        for (let i = 1; i < measure.groups.length; i++) assert(measure.groups[i].left >= measure.groups[i - 1].right - 1, `${width}x${height}@${dpr}: bar groups must not overlap (${JSON.stringify(measure.groups)})`);
        await page.evaluate(() => { const d = __dp8; d.startPractice(); }); await pause(page);
        await page.waitForFunction(() => getComputedStyle(document.querySelector('#gl')).transform === 'none');
        const input = await page.evaluate(() => {
          const d = __dp8, p = [0, 0]; d.scene.proj.begin(); d.scene.proj.at(0.1, 0.05, d.game.P.R, p);
          const c = document.querySelector('#gl').getBoundingClientRect();
          const result = d.scene.toTable({ clientX: c.x + p[0], clientY: c.y + p[1] }, d.game.P.R);
          return { x: result.x, y: result.y };
        });
        assert(Math.hypot(input.x - 0.1, input.y - 0.05) < 1e-6, `projection and pointer coordinates agree: ${JSON.stringify(input)}`);
        await page.evaluate(() => __dp8.goHome(true)); await pause(page);
        console.log(`graphics ${width}x${height}@${dpr}: layout, pixel budget, input passed`);
      }
      // The same CSS viewport can move to a monitor with a different DPR.
      await page.setViewportSize({ width: 1024, height: 768 }); await pause(page);
      const cdp = await page.context().newCDPSession(page), next = dpr === 1 ? 2 : 1;
      await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 768, deviceScaleFactor: next, mobile: false });
      try { await page.waitForFunction(r => Math.abs(__dp8.scene.pixelRatio - r) < 0.001, next); }
      catch (e) { console.error('density state', await page.evaluate(() => ({ dpr: devicePixelRatio, ratio: __dp8.scene.pixelRatio, focus: document.activeElement.tagName, quality: __dp8.prefs.quality, size: [innerWidth, innerHeight] }))); throw e; }
      await cdp.detach();
      await page.evaluate(() => __dp8.startPractice()); await pause(page);
      const before = await page.evaluate(() => __dp8.game.serialize());
      await page.evaluate(() => {
        const cv = document.querySelector('#gl'), gl = cv.getContext('webgl2') || cv.getContext('webgl');
        window.graphicsLoss = gl.getExtension('WEBGL_lose_context');
        if (!graphicsLoss) throw new Error('context loss extension missing');
        window.graphicsRestored = false; cv.addEventListener('webglcontextrestored', () => { window.graphicsRestored = true; }, { once: true });
        graphicsLoss.loseContext();
      });
      await pause(page);
      await page.setViewportSize({ width: 1100, height: 760 }); await pause(page);
      await page.evaluate(() => graphicsLoss.restoreContext());
      await page.waitForFunction(() => graphicsRestored); await pause(page);
      const after = await page.evaluate(() => __dp8.game.serialize());
      // The existing renderer normalizes ball quaternions; positions, turns and rules must remain exactly unchanged.
      for (let i = 0; i < before.balls.length; i++) {
        for (let j = 0; j < 4; j++) assert(Math.abs(after.balls[i][3][j] - before.balls[i][3][j]) < 1e-12, 'GPU restore preserves ball orientation');
        before.balls[i].splice(3, 1); after.balls[i].splice(3, 1);
      }
      assert.deepEqual(after, before, 'GPU restore preserves game state');
      assert(await page.evaluate(() => !(document.querySelector('#gl').getContext('webgl2') || document.querySelector('#gl').getContext('webgl')).isContextLost()), 'GPU restored');
      assert.deepEqual(errors, []);
      console.log(`graphics @${dpr}: density change and GPU restoration passed`);
    } finally { await browser.close(); }
  }
  // Force the preferred GPU settings to fail, as on a restricted integrated GPU.
  for (const blocked of [false, true]) {
    const { browser, page, errors } = await open(1024, 768, 1, { init: blocked ? () => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...args) { return kind.includes('webgl') ? null : original.call(this, kind, ...args); };
    } : () => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, options) {
        if (kind.includes('webgl') && options?.powerPreference === 'high-performance') return null;
        return original.call(this, kind, options);
      };
    } });
    try {
      if (blocked) { assert(await page.locator('#nogl').isVisible()); assert((await page.locator('#nogl').innerText()).includes('WebGL')); assert(await page.locator('#nogl button').isVisible()); }
      else await ready(page);
      assert.deepEqual(errors, []);
      console.log(blocked ? 'graphics: unavailable GPU gives actionable retry screen' : 'graphics: preferred context failure falls back successfully');
    } finally { await browser.close(); }
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
