/* The fourth check: the app in a browser at a tablet and a phone size - records, settings, free practice, an 8-ball match
   against a friend (spin pad, pause), the computer playing 4구 to the end, the result and back home. One line per size;
   "NO RESULT" or an error means it failed.   sh web/build.sh && node web/test/browser/smoke.js   (slow: a few minutes) */
const { open } = require('./harness.js');
(async () => {
  for (const [w, h] of (process.env.SZ ? JSON.parse(process.env.SZ) : [[1280, 800], [412, 860]])) {
    const { browser, page } = await open(w, h, 1);
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('dp8.rec', JSON.stringify({ '민수': { w: 7, l: 2, streak: 5, best: 5, form: ['W'] } })); localStorage.setItem('dp8.prefs', JSON.stringify({ v: 2, how: true })); });
    await page.reload({ timeout: 120000 }); await page.waitForTimeout(1500);
    await page.evaluate(() => { const o = window.requestAnimationFrame.bind(window); let fake = performance.now(); window.requestAnimationFrame = cb => o(() => cb(fake += 60)); });
    const tapOn = async sel => { const b = await page.locator(sel).first().boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(400); };
    const tapText = async (sel, t) => { const b = await page.locator(sel, { hasText: t }).first().boundingBox(); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); await page.waitForTimeout(400); };
    const out = [];
    await tapOn('#dkRec'); out.push(await page.evaluate(() => __dp8.st.screen + ':' + document.querySelectorAll('.rcard').length));
    await tapOn('.dk-tab[data-t="play"]'); out.push('back:' + await page.evaluate(() => __dp8.st.screen));
    await tapOn('#dkSet'); out.push('sheet:' + await page.evaluate(() => !document.querySelector('#sheet').hidden)); await tapOn('#sheetX');
    for (const [tab, rb] of [['train', '자유 연습'], ['play', '8볼']]) {
      await tapOn(`.dk-tab[data-t="${tab}"]`); if (tab === 'play') { await tapOn('[data-b="friend"]'); if (!(await page.locator('[data-b="eight"]').count())) console.log('DBG', await page.evaluate(() => { const b = document.querySelector('#dkBoards'); return (b && b.className) + ' ' + __dp8.st.screen + ' ' + __dp8.st.phase + ' ' + document.querySelector('#desk').className + ' ' + document.querySelector('#app').className; })); await tapOn('[data-b="eight"]'); await page.waitForTimeout(600); } else await tapText('#dkRail .dk-rb', rb); await tapOn('#dkSlate .dk-main'); await page.waitForTimeout(700);
      out.push(await page.evaluate(() => { const d = __dp8; d.st.aim += 0.05; d.shoot(d.game.vOf(0.5), 0, 0, 0); return d.st.screen + ':' + d.game.modeId; }));
      await page.waitForFunction(() => __dp8.st.phase === 'aim' || __dp8.st.phase === 'hold', null, { timeout: 90000, polling: 200 });
      if (rb === '8볼') { await tapOn('#spinBtn'); out.push('pad:' + await page.evaluate(() => !document.querySelector('#spinPop').hidden && document.querySelector('#elPad').width > 0)); await tapOn('#menuBtn'); out.push('pause:' + await page.evaluate(() => document.querySelector('#sheetTitle').textContent)); }
      await page.evaluate(() => __dp8.goHome(true)); await page.waitForTimeout(400); }
    out.push('resume:' + await page.evaluate(() => [...document.querySelectorAll('#dkSlate .dk-sec')].some(b => b.textContent.startsWith('이어서'))));
    await page.evaluate(() => { const d = __dp8; d.prefs.mode = 'four'; d.prefs.vsAI = true; d.prefs.level = 3; d.goHome(); d.startMatch(1); });
    for (let i = 0; i < 2400; i++) { const s = await page.evaluate(() => { const d = __dp8; if (d.st.screen === 'result') return 'result'; if (d.st.phase === 'aim' && !d.game.players[d.game.turn].ai) { d.st.aim = 1.57; d.shoot(d.game.vOf(0.1), 0, 0, 0); } return d.st.phase; }); if (s === 'result') break; await page.waitForTimeout(250); }
    out.push(await page.evaluate(() => __dp8.st.screen + ':' + document.querySelectorAll('#rHl .hcard').length));
    if (!(await page.locator('#homeBtn').boundingBox())) { console.log('NO RESULT', w + 'x' + h, out.join(' | '), await page.evaluate(() => __dp8.st.screen + ' ' + __dp8.st.phase + ' over:' + !!__dp8.game.over)); await browser.close(); continue; }
    await tapOn('#homeBtn'); out.push('home:' + await page.evaluate(() => __dp8.st.screen + ' desk:' + !document.querySelector('#desk').hidden));
    console.log(w + 'x' + h, out.join(' | '));
    await browser.close();
  }
})();
