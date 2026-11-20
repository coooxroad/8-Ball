/* The menu's layers kept in budget (owner 11-20: the menu stuttered, blinked and lost parts on the tablet - each card in
   sight had carried four moving layers about its size, some 35 million pixels drawn at 1280 x 800 x 2 before the cards'
   moving ground became one small canvas each: app/39-menu-fx.js). The layers the browser draws itself, at the screen's
   sharpness (pictures and canvases are handed over at their own size and not counted), must stay under MAX_MPX, and a
   card's moving ground must be its canvas. Build first; uses the smoke harness's Chromium. */
const assert = require('node:assert/strict');
const { open } = require('./harness.js');
const MAX_MPX = 28;   // (11-20: 24.1 measured after the change, 35.4 before)
(async () => {
  const { browser, page, errors } = await open(1280, 800, 2, { init: () => { if (!localStorage.getItem('dp8.prefs')) localStorage.setItem('dp8.prefs', JSON.stringify({ v: 2, how: true })); } });
  try {
    await page.waitForFunction(() => !!window.__dp8 && document.querySelectorAll('#dkCards .mn-card').length > 3, null, { timeout: 30000 });
    await page.waitForTimeout(2500);
    const parts = await page.evaluate(() => ({ canvases: document.querySelectorAll('#dkCards .mn-card canvas.mn-fxc').length, cards: document.querySelectorAll('#dkCards .mn-card').length,
      old: document.querySelectorAll('#dkCards .mn-card :is(.lt,.dk,.mn-sym)').length }));
    assert.equal(parts.canvases, parts.cards, `every menu card's moving ground is its canvas: ${JSON.stringify(parts)}`);
    assert.equal(parts.old, 0, 'no menu card keeps the old moving layers');
    const cdp = await page.context().newCDPSession(page);
    let layers = null; cdp.on('LayerTree.layerTreeDidChange', e => { if (e.layers) layers = e.layers; });
    await cdp.send('LayerTree.enable'); await page.waitForTimeout(1200);
    let px = 0;
    for (const l of layers || []) {
      if (!l.drawsContent) continue;
      let tag = ''; if (l.backendNodeId) { try { tag = (await cdp.send('DOM.describeNode', { backendNodeId: l.backendNodeId })).node.nodeName; } catch (e) {} }
      if (tag !== 'IMG' && tag !== 'CANVAS') { px += l.width * l.height * 4; if (process.env.LIST) console.log('  ', l.width + 'x' + l.height, tag); }
    }
    assert(layers && layers.length, 'the layer tree was read');
    assert(px / 1e6 <= MAX_MPX, `menu layers drawn by the browser: ${(px / 1e6).toFixed(1)} million pixels, over ${MAX_MPX}`);
    assert.deepEqual(errors, []);
    console.log(`ui budget passed: menu ${(px / 1e6).toFixed(1)} Mpx (max ${MAX_MPX}), ${parts.canvases} card canvases`);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
