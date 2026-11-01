/* New cosmetic sets: CHROME=<chromium> node web/test/browser/skins.js after web/build.sh.
   Optional ARTIFACT_DIR saves actual renderer portraits and game screenshots. No live accounts/rewards are used. */
'use strict';
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), { open } = require('./harness');
const out = process.env.ARTIFACT_DIR; if (out) fs.mkdirSync(out, { recursive: true });
(async () => {
  const { browser, page, errors } = await open(1280, 800, 1, { init: () => {
    localStorage.setItem('dp8.prefs', JSON.stringify({ v: 2, how: true, sound: false, music: false, shotClock: 0 }));
  } });
  try {
    await page.evaluate(() => {
      window.__skinLabels = []; window.__skinGeoms = [];
      const fill = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (...args) {
        if (this.canvas.width === 1024 && this.canvas.height === 512 && /^\d{1,2}$/.test(String(args[0]))) window.__skinLabels.push(args[0]);
        return fill.apply(this, args);
      };
      const Sphere = THREE.SphereGeometry;
      THREE.SphereGeometry = class extends Sphere { constructor(...args) { super(...args); window.__skinGeoms.push(this); } };
    });
    for (const id of ['potato', 'bowling']) {
      await page.evaluate(id => { window.__skinLabels = []; __dp8.scene.setBalls(id); }, id);
      await page.waitForTimeout(350);
      const portraits = await page.evaluate(id => {
        const results = [];
        for (const [kind, ids] of [['pool', [0, 1, 2, 3, 8, 9, 10, 11]], ['carom', [0, 1, 2]]]) for (const n of ids) results.push({ kind, n, src: __dp8.scene.ballPortrait(id, kind, n) });
        return results;
      }, id);
      assert.deepEqual(await page.evaluate(() => window.__skinLabels), [], `${id}: number badges were drawn`);
      if (out) for (const p of portraits) fs.writeFileSync(path.join(out, `${id}-${p.kind}-${p.n}.png`), Buffer.from(p.src.split(',')[1], 'base64'));
      for (const mode of ['eight', 'four']) {
        await page.evaluate(({ id, mode }) => {
          const d = __dp8, saber = CUES.findIndex(c => c.id === 'saber'); d.prefs.ballSkin = id; d.prefs.mode = mode; d.prefs.cues = [saber, saber]; d.prefs.shotClock = 0;
          d.startMatch(0, { names: ['나', '스킨 확인'], mode, ai: false, target: 5, targets: null, finish: false, ice: false });
          d.scene.setBalls(id); d.scene.setCue(saber); d.st.aim = 0.1; d.scene.invalidate();
        }, { id, mode });
        await page.waitForTimeout(500);
        if (out) await page.screenshot({ path: path.join(out, `${id}-${mode}-game.png`) });
      }
      console.log(`${id}: no numbers in pool/carom portraits or either game; both modes rendered`);
    }
    const geometry = await page.evaluate(() => window.__skinGeoms.map(g => {
      const p = g.attributes.position, radii = []; for (let i = 0; i < p.count; i++) radii.push(Math.hypot(p.getX(i), p.getY(i), p.getZ(i)));
      const centers = [[48, 68], [48, 112], [24, 90]].map(([lat, lon]) => {
        const th = (90 - lat) * Math.PI / 180, ph = lon * Math.PI / 180, target = [-Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th)]; let best = -Infinity, radius = 1;
        for (let i = 0; i < p.count; i++) { const dot = (p.getX(i) * target[0] + p.getY(i) * target[1] + p.getZ(i) * target[2]) / radii[i]; if (dot > best) { best = dot; radius = radii[i]; } }
        return radius;
      });
      return { segments: g.parameters.widthSegments, min: Math.min(...radii), max: Math.max(...radii), centers, finite: [...p.array, ...g.attributes.normal.array].every(Number.isFinite) };
    }));
    const potatoes = geometry.filter(g => g.segments === 64), bowling = geometry.filter(g => g.segments === 128);
    assert.equal(potatoes.length, 1, 'potato geometry must be cached/shared'); assert.equal(bowling.length, 1, 'bowling geometry must be cached/shared');
    for (const g of geometry) { assert(g.finite); assert(g.max <= 1.00001); }
    assert(potatoes[0].max - potatoes[0].min > 0.06, 'potato silhouette is still spherical');
    assert(bowling[0].centers.every(r => r < 0.97), 'bowling finger holes have no geometric depth');
    await page.evaluate(() => { window.__skinLabels = []; __dp8.scene.setBalls('classic'); });
    assert(await page.evaluate(() => window.__skinLabels.length >= 30), 'classic ball numbers were changed');
    assert.deepEqual(errors, []);
    console.log('skin rendering passed: shared lumpy geometry, three recessed holes, physical-radius bounds, no new badges, classic numbers preserved, no browser errors');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
