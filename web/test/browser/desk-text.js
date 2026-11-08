/* Desktop text at normal and fractional Windows scaling, plus native HiDPI and phone controls.
   Run after sh web/build.sh. The live server is blocked by harness.js. */
const assert = require('assert');
const { open } = require('./harness.js');

(async () => {
  let native;
  for (const [w, h, dpr] of [[1280, 800, 2], [1280, 800, 1], [1280, 800, 1.25], [1920, 1080, 1], [412, 860, 3]]) {
    const { browser, page, errors } = await open(w, h, dpr, {
      init: () => localStorage.setItem('dp8.prefs', JSON.stringify({ v: 2, how: true, names: ['이환컴퍼니', '플레이어 2'] })),
    });
    try {
      const settle = () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      const tap = async locator => { const b = await locator.first().boundingBox(); assert(b); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await settle(); };
      // Compare the table opening with the native-density layout, including the ranked-search strip.
      await tap(page.locator('[data-b="friend"]'));
      await tap(page.locator('#dkRail .dk-rb', { hasText: '8볼' }));
      const measure = () => page.evaluate(() => {
        const d = document.querySelector('#desk'), p = document.querySelector('#deskPlane'), g = document.querySelector('#gl');
        const s = +document.querySelector('#app').style.getPropertyValue('--desk-density');
        return { density: s, w: d.clientWidth, h: d.clientHeight, pixels: d.clientWidth * d.clientHeight * (s * devicePixelRatio) ** 2,
          hole: p.style.clipPath.match(/-?\d+(?:\.\d+)?px/g).map(Number.parseFloat), canvas: [g.width, g.height] };
      });
      const plain = await measure();
      await page.evaluate(() => { document.querySelector('#app').classList.add('rk'); dispatchEvent(new Event('resize')); });
      await page.waitForTimeout(180); await settle();
      const ranked = await measure();
      await page.evaluate(() => { document.querySelector('#app').classList.remove('rk'); dispatchEvent(new Event('resize')); });
      await page.waitForTimeout(180); await settle();
      if (w === 1280) {
        if (dpr === 2) native = [plain, ranked];
        else for (const [i, current] of [plain, ranked].entries()) {
          assert(Math.abs(current.w - native[i].w) <= 2 && Math.abs(current.h - native[i].h) <= 2, 'desk layout changed with pixel density');
          assert.equal(current.hole.length, native[i].hole.length);
          current.hole.forEach((v, j) => assert(Math.abs(v - native[i].hole[j]) <= 3, 'table opening shifted at a different pixel density'));
        }
      }
      if (w > 900 && dpr < 2) { assert(plain.density > 1); assert(plain.pixels <= 8e6); }
      else assert.equal(plain.density, 1);
      // Compare at the same DPR: WebGL may legitimately have its own per-device pixel budget.
      const independent = await page.evaluate(() => {
        const app = document.querySelector('#app'), cv = document.querySelector('#gl'), before = [cv.width, cv.height];
        const density = app.style.getPropertyValue('--desk-density');
        app.style.setProperty('--desk-density', '1'); __dp8.scene.resize(true);
        const after = [cv.width, cv.height]; app.style.setProperty('--desk-density', density);
        return { before, after };
      });
      assert.deepEqual(independent.after, independent.before, 'HTML density changed the WebGL buffer');
      await tap(page.locator('.dk-tab[data-t="gear"]'));
      await tap(page.locator('#dkRail .dk-rb', { hasText: '테이블' }));
      await page.waitForFunction(() => document.querySelector('#dkHead').textContent.includes('테이블'));
      await page.evaluate(() => document.fonts.ready);
      const name = await page.locator('.dk-card .nm').first().innerText();
      await tap(page.locator('.dk-card').first());
      await page.waitForFunction(n => document.querySelector('#dkSlate h1').textContent === n, name);
      const back = page.locator('#dkSlate .dk-sec', { hasText: '카드 목록으로' });
      await tap(back);
      await page.locator('.dk-cards').evaluate(n => { n.scrollTop = n.scrollHeight; }); await settle();
      await tap(page.locator('.dk-card').last());
      await page.waitForFunction(() => !!document.querySelector('#dkSlate h1'));
      // Resizing across the compact breakpoint must release the extra raster density.
      if (dpr === 1) {
        await page.setViewportSize({ width: 412, height: 860 });
        await page.waitForFunction(() => document.querySelector('#app').classList.contains('compact') && +document.querySelector('#app').style.getPropertyValue('--desk-density') === 1);
      }
      assert.equal(errors.length, 0, errors.join('\n'));
      console.log(`${w}x${h} @${dpr}: table alignment, raster budget, card taps and scrolling passed`);
    } finally { await browser.close(); }
  }
})().catch(e => { console.error(e); process.exit(1); });
