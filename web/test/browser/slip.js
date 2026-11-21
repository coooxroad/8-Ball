/* (owner 11-21) The power bar let go while the other hand turns the dial plays nothing (app/80-input.js dialGuard); let go
   with the dial still, it plays as always. Two fingers are two pointers, sent as the screen would send them. */
'use strict';
const assert = require('assert/strict'), { open } = require('./harness');
(async () => {
  const { browser, page, errors } = await open(1280, 800, 1, { init: () => {
    localStorage.setItem('dp8.prefs', JSON.stringify({ v: 2, how: true, sound: false, music: false, shotClock: 0, vsAI: true, mode: 'eight' }));
  } });
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => { __dp8.prefs.vsAI = true; __dp8.prefs.mode = 'eight'; __dp8.match.start(0); });
    await page.waitForFunction(() => __dp8.st.screen === 'play' && __dp8.st.phase === 'aim' && !__dp8.game.players[__dp8.game.turn].ai, null, { timeout: 20000 });
    // a finger: down, along, up on an element - its own pointer
    const finger = (sel, id) => ({
      at: (t, f) => page.evaluate(([sel, id, t, f]) => { const el = document.querySelector(sel), r = el.getBoundingClientRect();
        el.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: 'touch', isPrimary: id === 1, bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height * f })); }, [sel, id, t, f]) });
    const power = finger('#power', 1), dial = finger('#fine', 2);
    // 1. pulled, the dial turned, the bar let go at once: no shot
    await power.at('pointerdown', 0.3); await power.at('pointermove', 0.6);
    const aim0 = await page.evaluate(() => __dp8.st.aim);
    await dial.at('pointerdown', 0.5); for (const f of [0.52, 0.56, 0.6, 0.66, 0.72]) await dial.at('pointermove', f);
    assert(await page.evaluate(a => __dp8.st.aim !== a, aim0), 'the dial did not turn the aim');
    await power.at('pointerup', 0.6);
    await page.waitForTimeout(300);
    assert(await page.evaluate(() => __dp8.st.phase === 'aim' && __dp8.st.power === 0), 'the slip played a shot');
    await dial.at('pointerup', 0.72);
    // 2. the dial left still a while, then pulled and let go: played
    await page.waitForTimeout(500);
    await power.at('pointerdown', 0.3); await power.at('pointermove', 0.6); await power.at('pointerup', 0.6);
    await page.waitForFunction(() => __dp8.st.phase !== 'aim', null, { timeout: 5000 });
    assert(!errors.length, errors.join('\n'));
    console.log('slip guard passed: a release while the dial turns plays nothing, a release after plays');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
