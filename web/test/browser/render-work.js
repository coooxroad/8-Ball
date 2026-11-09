/* Count actual GPU buffer traffic at an identical draw cadence, not device FPS. Build first.
   CUE_COMPARE=1 reports a pre-change checkout without enforcing the optimization assertions. */
const assert = require('node:assert/strict');
const { open } = require('./harness.js');
(async () => {
  const { browser, page, errors } = await open(1180, 820, 2, { init: () => {
    localStorage.setItem('dp8.prefs', JSON.stringify({ v: 2, how: true }));
    let seed = 777;
    Math.random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    let id = 0, callbacks = new Map();
    window.requestAnimationFrame = fn => { callbacks.set(++id, fn); return id; };
    window.cancelAnimationFrame = key => callbacks.delete(key);
    window.stepMonitor = now => { const pending = callbacks; callbacks = new Map(); for (const fn of pending.values()) fn(now); };
    const idle = [];
    window.requestIdleCallback = fn => { idle.push(fn); return idle.length; };
    window.stepIdle = () => { const fn = idle.shift(); if (fn) fn({ timeRemaining: () => 50, didTimeout: false }); };
  } });
  try {
    const result = await page.evaluate(() => {
      const d = __dp8;
      let thumbnails = 0;
      const ballShot = d.scene.ballShot;
      d.scene.ballShot = (...args) => { thumbnails++; return ballShot(...args); };
      // Leave real, connected pictures waiting on the desk, then enter a match before they can render.
      document.querySelector('.dk-tab[data-t="gear"]').click();
      [...document.querySelectorAll('#dkRail .dk-rb')].find(b => b.textContent.trim() === '공').click();
      const pendingPictures = document.querySelectorAll('#dkStage img[src^="data:image/gif"]').length;
      d.prefs.mode = 'eight'; d.prefs.vsAI = false; d.startMatch(0); d.st.chalk = null;
      d.prefs.quality = 'high'; d.scene.setQuality('high');
      let now = 1000;
      // Settle the camera/insets before measuring: both versions draw exactly 60 forced frames per case.
      for (let i = 0; i < 180; i++) { stepMonitor(now += 17); stepIdle(); }
      const gl = document.querySelector('#gl').getContext('webgl2'), original = gl.bufferSubData.bind(gl);
      let calls = 0, bytes = 0;
      gl.bufferSubData = (...args) => {
        const data = args[2], offset = args[3] || 0, length = args[4] || data.length - offset;
        calls++; bytes += length * data.BYTES_PER_ELEMENT;
        return original(...args);
      };
      const draw = moving => {
        calls = bytes = 0;
        for (let i = 0; i < 60; i++) {
          if (moving) d.st.aim += 0.015;
          d.scene.invalidate(); stepMonitor(now += 17);
        }
        return { calls, bytes, drawCalls: d.scene.info.render.calls, triangles: d.scene.info.render.triangles };
      };
      const result = { stationary: draw(false), aiming: draw(true), pendingPictures, thumbnailsDuringPlay: thumbnails };
      gl.bufferSubData = original;
      d.goHome(true); stepMonitor(now += 17); stepIdle();
      result.thumbnailsOnReturn = thumbnails - result.thumbnailsDuringPlay;
      return result;
    });
    if (!process.env.CUE_COMPARE) {
      assert.equal(result.stationary.calls, 0, 'still balls and guide must keep their existing GPU buffers');
      assert(result.aiming.calls > 0 && result.aiming.bytes < 1000000, 'short guides must upload their used vertices, not every reserved slot');
      assert(result.pendingPictures > 0, 'the transition check needs uncached pictures');
      assert.equal(result.thumbnailsDuringPlay, 0, 'the connected desk must not generate pictures behind the match');
      assert(result.thumbnailsOnReturn > 0, 'returning home must resume idle pictures');
    }
    assert.deepEqual(errors, []);
    console.log('render work GPU traffic', JSON.stringify(result));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
