/* A tool, not a check: the computed styles of the page on the screens that most CSS touches - the desk (the menu, the
   three ways, a friend game's setup, the add-ons, 랭킹전's games, lessons, 내 장비, 상점) at five sizes and play (free
   practice, a friend's 8볼 and 4구, the broadcast dress, a puzzle) at three - written to one JSON file, so that a CSS
   tidy (web/tools/cssmerge.py) can be shown to change nothing:
     node web/test/browser/styles.js /tmp/before.json   (old CSS, built)
     node web/test/browser/styles.js /tmp/after.json    (new CSS, built)
     node web/test/browser/styles.js --compare /tmp/before.json /tmp/after.json
   What animates (the toast, the clock, fades, the shop's badges) differs from run to run and is left out of the comparison. */
const { open } = require('./harness');
const fs = require('fs');
const DESK = ['display', 'position', 'top', 'left', 'right', 'bottom', 'width', 'height', 'padding', 'margin', 'border', 'border-image-source', 'border-radius', 'background-image', 'background-color', 'box-shadow', 'color', 'font', 'z-index', 'opacity', 'transform', 'filter', 'gap', 'flex', 'grid-template-columns', 'grid-template-rows', 'overflow', 'visibility', 'min-width', 'min-height', 'max-width', 'text-align', 'letter-spacing', '--bar', '--s', '--lip'];
const PLAY = ['display', 'position', 'top', 'left', 'right', 'bottom', 'width', 'height', 'padding', 'margin', 'border', 'border-image-source', 'border-radius', 'background-image', 'background-color', 'box-shadow', 'color', 'font', 'z-index', 'opacity', 'filter', 'gap', 'flex', 'grid-template-columns', 'overflow', 'visibility', 'min-width', 'max-width', 'text-align', 'clip-path', 'justify-self', 'grid-column'];
const dump = (page, P, inPlay) => page.evaluate(([P, inPlay]) => {
  const res = [];
  for (const e of document.querySelectorAll(inPlay ? '#app *' : '#app, #app *')) {
    if (inPlay ? e.closest('#desk, #dkBoards, canvas, svg') : e.closest('#hud, #sheet, canvas')) continue;
    for (const ps of [null, '::before', '::after']) { const c = getComputedStyle(e, ps); if (ps && c.content === 'none') continue;
      res.push((e.id ? '#' + e.id : '') + (typeof e.className === 'string' ? '.' + e.className.split(' ').join('.') : e.tagName) + (ps || '') + ' ' + P.map(p => c.getPropertyValue(p)).join('|')); }
  }
  return res;
}, [P, inPlay]);
function compare(fa, fb) {
  const a = JSON.parse(fs.readFileSync(fa, 'utf8')), b = JSON.parse(fs.readFileSync(fb, 'utf8'));
  let bad = 0;
  for (const k in a) {
    const P = k.startsWith('play/') ? PLAY : DESK;
    if (!b[k] || a[k].length !== b[k].length) { console.log('different elements:', k); bad++; continue; }
    a[k].forEach((x, i) => {
      const y = b[k][i], n = x.split(' ', 1)[0];
      if (x === y || n === '.' || n === '.::after' || /^(#clock|#dkShade|\.fxb)/.test(n)) return;
      const X = x.split('|'), Y = y.split('|');
      const d = X.map((u, j) => u !== Y[j] && P[j] !== 'opacity' && P[j] !== 'transform' ? `${P[j]}: ${u.slice(-40)} -> ${Y[j].slice(-40)}` : null).filter(Boolean);
      if (d.length) { bad++; if (bad < 20) console.log(k, n.slice(0, 60), d.slice(0, 3).join('; ')); }
    });
  }
  console.log(bad ? `${bad} differences` : 'the same');
  process.exit(bad ? 1 : 0);
}
(async () => {
  if (process.argv[2] === '--compare') return compare(process.argv[3], process.argv[4]);
  const out = {};
  for (const [W, H] of [[1280, 800], [390, 844], [915, 412], [1180, 820], [1440, 900]]) {
    const { browser, page } = await open(W, H, 1, { init: () => localStorage.setItem('dp8.prefs', JSON.stringify({ v: 2, how: true })) });
    await page.waitForFunction(() => !!window.__dp8); await page.waitForTimeout(1200);
    const frames = async () => { for (let k = 0; k < 4; k++) await page.screenshot({ timeout: 120000 }); };   // (a slow software GL: screenshots move the animations on)
    const tapT = async t => { const b = await page.getByText(t, { exact: true }).first().boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(1300); };
    const clk = async s => { await page.evaluate(s => document.querySelector(s).click(), s); await page.waitForTimeout(1500); await frames(); };
    out[`desk/${W}/home`] = await dump(page, DESK);
    await clk('[data-b="friend"]'); out[`desk/${W}/ways`] = await dump(page, DESK);
    await clk('[data-b="way-local"]'); out[`desk/${W}/local`] = await dump(page, DESK);
    await clk('.dk-addon'); out[`desk/${W}/addons`] = await dump(page, DESK);
    await clk('#dkBoards .dk-x'); await clk('#dkHead .dk-x'); await clk('#dkBoards .dk-x');
    await clk('[data-b="rank"]'); out[`desk/${W}/rank`] = await dump(page, DESK);
    await tapT('훈련'); await tapT('레슨'); out[`desk/${W}/lessons`] = await dump(page, DESK);
    await tapT('내 장비'); out[`desk/${W}/gear`] = await dump(page, DESK);
    await tapT('상점'); out[`desk/${W}/shop`] = await dump(page, DESK);
    if (W === 1280 || W === 390 || W === 915) {
      const settle = async () => { await page.waitForTimeout(1800); await page.evaluate(() => { const t = document.getElementById('toast'); if (t) t.className = ''; }); };
      await page.evaluate(() => { __dp8.prefs.lessons = false; __dp8.startPractice(); }); await settle(); out[`play/${W}/free`] = await dump(page, PLAY, true);
      await page.evaluate(() => { __dp8.goHome(); __dp8.prefs.vsAI = false; __dp8.prefs.mode = 'eight'; __dp8.startMatch(0); }); await settle(); out[`play/${W}/eight`] = await dump(page, PLAY, true);
      await page.evaluate(() => { document.getElementById('app').classList.add('bcast'); }); await settle(); out[`play/${W}/bcast`] = await dump(page, PLAY, true);
      await page.evaluate(() => { document.getElementById('app').classList.remove('bcast'); __dp8.goHome(); __dp8.prefs.mode = 'four'; __dp8.startMatch(0); }); await settle(); out[`play/${W}/four`] = await dump(page, PLAY, true);
      await page.evaluate(() => { __dp8.goHome(); __dp8.puzzle.start(); }); await settle(); out[`play/${W}/puzzle`] = await dump(page, PLAY, true);
    }
    await browser.close();
  }
  fs.writeFileSync(process.argv[2], JSON.stringify(out)); console.log('written', Object.keys(out).length, 'screens to', process.argv[2]);
})();
