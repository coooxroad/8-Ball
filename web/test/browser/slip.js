/* (owner 11-21) 오발 방지 (app/80-input.js dialGuard): the power bar let go while the other hand is turning the dial holds
   the shot - nothing played, the bar glowing - and a tap on the bar plays it; the dial set and left, a release plays as
   always; with the guard off in 설정, the slip plays. Two fingers are two pointers, sent as the screen would send them. */
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
    // the dial's last turn and the bar's release in the same instant (as a slip is)
    const slip = () => page.evaluate(() => { const ev = (sel, id, t, f) => { const el = document.querySelector(sel), r = el.getBoundingClientRect();
      el.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: 'touch', bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height * f })); };
      ev('#fine', 2, 'pointermove', 0.8); ev('#power', 1, 'pointerup', 0.6); });
    const pull = async () => { await power.at('pointerdown', 0.3); await power.at('pointermove', 0.6); };
    const turn = async () => { await dial.at('pointerdown', 0.5); for (const f of [0.52, 0.56, 0.6, 0.66, 0.72]) await dial.at('pointermove', f); };
    const aimed = () => page.waitForFunction(() => __dp8.st.screen === 'play' && __dp8.st.phase === 'aim' && !__dp8.game.players[__dp8.game.turn].ai, null, { timeout: 60000 });
    // 1. pulled, the dial turning, the bar let go: held, not played
    await pull(); const aim0 = await page.evaluate(() => __dp8.st.aim); await turn();
    assert(await page.evaluate(a => __dp8.st.aim !== a, aim0), 'the dial did not turn the aim');
    const p0 = await page.evaluate(() => __dp8.st.power);
    await slip(); await page.waitForTimeout(300);
    assert(await page.evaluate(() => __dp8.st.phase === 'aim' && document.querySelector('#power').classList.contains('held')), 'the slip was not held');
    await dial.at('pointerup', 0.8);
    // ... a tap on the bar plays the held power
    await power.at('pointerdown', 0.9); await power.at('pointerup', 0.9);
    await page.waitForFunction(() => __dp8.st.phase !== 'aim', null, { timeout: 5000 });
    assert(await page.evaluate(() => !document.querySelector('#power').classList.contains('held')), 'the bar still glows after the shot');
    // 2. the dial set and left (its finger off), then pulled and let go: played
    await aimed(); await turn(); await dial.at('pointerup', 0.72); await page.waitForTimeout(200);
    await pull(); await power.at('pointerup', 0.6);
    await page.waitForFunction(() => __dp8.st.phase !== 'aim', null, { timeout: 5000 });
    // 3. the guard off in 설정: the slip plays
    await aimed(); await page.evaluate(() => { __dp8.prefs.safeShot = false; });
    await pull(); await turn(); await slip();
    await page.waitForFunction(() => __dp8.st.phase !== 'aim', null, { timeout: 5000 });
    await dial.at('pointerup', 0.8);
    assert(!errors.length, errors.join('\n'));
    console.log(`slip guard passed: a slip held (power ${p0.toFixed(2)}) and played by a tap, a release after the dial plays, guard off plays`);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
