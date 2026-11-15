/* A tool, not a check: saves the 3D canvas at a few fixed moments - aiming, mid-shot, the 3D view after it - with
   Math.random seeded and the frame clock driven by hand, so two builds give byte-identical pictures when the drawing
   has not changed. Use it to prove a rendering refactor changes nothing:
     sh web/build.sh && node web/test/browser/frames.js /tmp/before   (old code)
     sh web/build.sh && node web/test/browser/frames.js /tmp/after    (new code)
     md5sum /tmp/before-*.png /tmp/after-*.png
   It also prints the draw calls and triangles of each moment. */
const fs = require('fs');
const { open } = require('./harness.js');
const out = process.argv[2] || 'frames';
(async () => {
  const { browser, page, errors } = await open(1024, 640, 1, { init: () => {
    localStorage.setItem('dp8.prefs', JSON.stringify({ v: 2, how: true }));
    let s = 12345; Math.random = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    let id = 0, cbs = new Map();
    window.requestAnimationFrame = fn => { cbs.set(++id, fn); return id; };
    window.cancelAnimationFrame = k => cbs.delete(k);
    window.stepFrames = now => { const p = cbs; cbs = new Map(); for (const fn of p.values()) fn(now); };
  } });
  let now = 1000;
  // n frames of 1/60 s, then (if named) the canvas as it is right after the last one - before the browser clears it
  const steps = async (n, file) => {
    const r = await page.evaluate(([n, now, shot]) => {
      for (let i = 0; i < n; i++) { __dp8.scene.invalidate(); stepFrames(now); now += 1000 / 60; }
      const i = __dp8.scene.info.render;
      return [now, shot ? document.querySelector('#gl').toDataURL('image/png') : null, i.calls, i.triangles];
    }, [n, now, !!file]);
    now = r[0];
    if (file) { fs.writeFileSync(file, Buffer.from(r[1].split(',')[1], 'base64')); console.log(file, 'calls', r[2], 'triangles', r[3]); }
  };
  try {
    await page.waitForFunction(() => !!window.__dp8);
    await page.waitForTimeout(3000);                        // (the table's pictures load)
    await page.evaluate(() => __dp8.startPractice());
    await steps(40); await page.waitForTimeout(1500); await steps(5);
    await page.evaluate(() => { const d = __dp8; d.st.phase = 'aim'; d.st.aim = 0.3; d.st.power = 0.5; d.st.rev++; });
    await steps(6, out + '-aim.png');
    await page.evaluate(() => __dp8.shoot(4, 0.2, -0.1, 0));
    await steps(45, out + '-shot.png');
    await steps(400);
    await page.evaluate(() => __dp8.scene.setOrbit(true));
    await steps(30, out + '-orbit.png');
    if (errors.length) { console.log('errors', errors); process.exitCode = 1; }
  } finally { await browser.close(); }
})();
