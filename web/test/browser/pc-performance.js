/* Rendering policy, not a hardware benchmark. Drive the real app callback at synthetic monitor rates, while
   replacing just the expensive draw. Existing smoke/graphics checks exercise the actual WebGL rendering. */
const assert = require('node:assert/strict');
const { open } = require('./harness.js');
(async () => {
  const { browser, page, errors } = await open(1280, 800, 1, { init: () => {
    localStorage.setItem('dp8.prefs', JSON.stringify({ v: 2, how: true }));
    // Emulate a hardware renderer's reported name; the actual test browser may run SwiftShader.
    for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext].filter(Boolean)) {
      const get = C.prototype.getParameter;
      C.prototype.getParameter = function (p) { return p === 0x9246 ? 'Test hardware renderer' : get.call(this, p); };
    }
    let id = 0, callbacks = new Map();
    window.requestAnimationFrame = fn => { callbacks.set(++id, fn); return id; };
    window.cancelAnimationFrame = key => callbacks.delete(key);
    window.stepMonitor = now => { const pending = callbacks; callbacks = new Map(); for (const fn of pending.values()) fn(now); };
  } });
  try {
    await page.waitForFunction(() => !!window.__dp8);
    const result = await page.evaluate(() => {
      const d = __dp8, out = [], changes = [], sizes = [], app = document.querySelector('#app'), cv = document.querySelector('#gl');
      let draws = 0, now = 1000;
      d.scene.frame = () => { draws++; return true; };
      d.scene.setScale = k => changes.push(k);
      d.st.phase = 'idle'; d.st.screen = 'play';
      const run = (hz, seconds) => { const start = draws; for (let i = 0; i < hz * seconds; i++) { stepMonitor(now); now += 1000 / hz; } return draws - start; };
      for (const hz of [60, 75, 120, 144, 240]) {
        changes.length = 0; d.prefs.quality = 'auto';
        out.push({ monitor: hz, draws: run(hz, 5), changes: changes.slice() });
      }
      d.prefs.quality = 'low'; changes.length = 0; out.push({ low: true, draws: run(144, 5), changes: changes.slice() });
      d.prefs.quality = 'high'; out.push({ high: true, draws: run(240, 1) });
      Object.defineProperty(d.scene, 'softwareRendering', { configurable: true, value: true });
      changes.length = 0; d.prefs.quality = 'auto'; d.prefs.fps = true;
      out.push({ software: true, draws: run(144, 5), changes: changes.slice(), fps: document.querySelector('#fps').textContent });
      d.prefs.fps = false;
      Object.defineProperty(d.scene, 'softwareRendering', { configurable: true, value: false });
      // A visible lobby must adapt even when every gap exceeds the old 400ms cutoff.
      d.st.screen = 'home'; document.querySelector('#dkStage').dataset.win = '1';
      changes.length = 0;
      for (let i = 0; i < 12; i++) { now += 600; stepMonitor(now); }
      const lobby = changes.slice();
      // The covered card list must not keep shrinking a hidden table.
      document.querySelector('#dkStage').dataset.win = '0'; changes.length = 0;
      for (let i = 0; i < 12; i++) { now += 600; stepMonitor(now); }
      const covered = changes.slice();
      // Inspect actual buffers at native DPR 1, where the old one-pixel floor defeated the 4K cap.
      app.classList.add('tilt');
      for (const [w, h] of [[1920, 1080], [3840, 2160]]) {
        app.style.width = w + 'px'; app.style.height = h + 'px';
        for (const q of ['auto', 'low']) { d.scene.setQuality(q); sizes.push({ w, h, q, width: cv.width, height: cv.height, pixels: cv.width * cv.height }); }
      }
      // Fullscreen events queue the resize before the very next draw, even when both event names fire.
      d.prefs.quality = 'auto'; d.scene.setQuality('auto'); d.st.screen = 'play';
      let drawnWidth = 0;
      d.scene.frame = () => { drawnWidth = cv.width; return true; };
      const watch = new MutationObserver(() => {});
      watch.observe(cv, { attributes: true, attributeFilter: ['width', 'height'] });
      const fullscreen = [];
      for (const [w, h] of [[1200, 900], [900, 650]]) {
        const before = cv.width;
        app.style.width = w + 'px'; app.style.height = h + 'px';
        document.dispatchEvent(new Event('fullscreenchange'));
        document.dispatchEvent(new Event('webkitfullscreenchange'));
        const queued = cv.width;
        stepMonitor(now += 1000 / 60);
        fullscreen.push({ w, before, queued, drawnWidth, writes: watch.takeRecords().map(r => r.attributeName) });
      }
      document.dispatchEvent(new Event('fullscreenchange'));
      stepMonitor(now += 1000 / 60);
      const sameSizeWrites = watch.takeRecords().length;
      watch.disconnect();
      return { out, lobby, covered, sizes, fullscreen, sameSizeWrites };
    });
    for (const r of result.out) {
      // ('자동' keeps the screen's own rate - the owner's choice; '낮음' stops at 60, a software renderer at 30)
      const expected = r.high ? 240 : r.software ? 150 : r.low ? 300 : r.monitor * 5;
      assert(Math.abs(r.draws - expected) <= 2, `cadence: ${JSON.stringify(r)}`);
      if (!r.high) assert.deepEqual(r.changes, [], 'healthy monitor cadence must not lower resolution');
      if (r.software) { assert(r.fps.includes('30 FPS')); assert(r.fps.includes('늦음 0%')); assert(r.fps.includes('소프트웨어 렌더링')); }
    }
    assert(result.lobby.some(k => k < 1), 'very slow lobby frames must trigger the guard');
    assert.deepEqual(result.covered, [], 'covered card list must not lower 3D quality');
    for (const s of result.sizes) assert(s.pixels > 0 && s.pixels <= (s.q === 'low' ? 1.6e6 : 4.2e6), `buffer budget: ${JSON.stringify(s)}`);
    for (const s of result.fullscreen) {
      assert.equal(s.queued, s.before, 'fullscreen must keep the old buffer until the draw');
      assert.equal(s.drawnWidth, s.w, 'fullscreen must draw at the new size on the first frame');
      assert.deepEqual(s.writes, ['width', 'height'], 'fullscreen must resize the buffer once');
    }
    assert.equal(result.sameSizeWrites, 0, 'a duplicate fullscreen notification must keep the buffer');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify(result));
    console.log('PC rendering policy passed: 자동 at 60/75/120/144/240Hz, 낮음 at 60, software fallback cadence, lobby guard, 4K/low buffers');
  } finally { await browser.close(); }
  // Use the real reported renderer as well. Selecting low must not enlarge an automatic software-rendered buffer.
  const actual = await open(1920, 1080, 1, { init: () => localStorage.setItem('dp8.prefs', JSON.stringify({ v: 2, how: true })) });
  try {
    const measured = await actual.page.evaluate(() => {
      const d = __dp8, cv = document.querySelector('#gl'), pixels = () => cv.width * cv.height;
      d.scene.setQuality('auto'); const auto = pixels();
      d.scene.setQuality('low'); const low = pixels();
      return { software: d.scene.softwareRendering, renderer: d.scene.rendererName, auto, low };
    });
    assert(measured.auto > 0 && measured.auto <= (measured.software ? 0.9e6 : 4.2e6));
    assert(measured.low > 0 && measured.low <= measured.auto);
    const { page } = actual;
    const close = page.locator('#sheetX'), fullscreenButton = page.locator('#dkFull');
    if (await close.isVisible()) await close.click();
    await fullscreenButton.click();
    await page.waitForFunction(() => document.fullscreenElement && document.querySelector('#dkFull span').textContent === '창 모드');
    assert(await fullscreenButton.isVisible(), 'the exit button must stay available in browser fullscreen');
    await fullscreenButton.click();
    await page.waitForFunction(() => !document.fullscreenElement && document.querySelector('#dkFull span').textContent === '전체 화면');
    assert.deepEqual(actual.errors, []);
    console.log('Reported renderer policy passed', JSON.stringify(measured));
  } finally { await actual.browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
