/* The result's newer parts (11-22), by their numbers: the rating gauge before the receipt (app/50-rise.js rise.at - where
   the ring and the count are at each moment) and the receipt's money lines (app/50-receipt.js money - copied from the
   slate's lines that the room's word writes, app/54-ranked.js paint, and kept in step as they change). No game is played:
   the room's result is put in as it would come. */
'use strict';
const assert = require('assert/strict'), { open } = require('./harness');
(async () => {
  const { browser, page, errors } = await open(1280, 800, 1, { init: () => {
    localStorage.setItem('dp8.prefs', JSON.stringify({ v: 2, how: true, sound: false, music: false }));
  } });
  try {
    await page.waitForFunction(() => !!window.__dp8);
    // ---- the gauge (ECONOMY.TIER_AT: 0 · 800 · 1100 · 1400 · 1700 · 2000)
    const at = (from, to, t) => page.evaluate(([from, to, t]) => __dp8.rise.at({ from, to }, t), [from, to, t]);
    const near = (a, b, m) => assert(Math.abs(a - b) < 1e-9, `${m}: ${a} != ${b}`);
    // a gain within 실버 (800-1100): nothing moves before .55 s; the pale gain shows from .3 s; all counted by 1.55 s
    let g = await at(860, 890, 0);
    near(g.p0, 0.2, 'gain p0'); near(g.p1, 0.3, 'gain p1'); assert(g.gain && !g.ghost && g.shown === 860 && g.fill === g.p0, 'gain at 0 ' + JSON.stringify(g));
    assert.equal(g.left, '골드까지 240');
    g = await at(860, 890, 0.4); assert(g.ghost && g.shown === 860 && g.trail === g.p1, 'gain at .4');
    g = await at(860, 890, 1.0); assert(g.shown > 860 && g.shown < 890 && g.fill > g.p0 && g.fill < g.p1, 'gain halfway ' + JSON.stringify(g));
    g = await at(860, 890, 1.6); assert(g.shown === 890 && g.fill === g.p1 && g.left === '골드까지 210', 'gain done ' + JSON.stringify(g));
    // a loss: the fill drops at once to the new place; the number with the red shown at .3 s; the red drains .95-1.75 s
    g = await at(890, 860, 0.1); assert(!g.gain && g.fill === g.p1 && g.shown === 890 && g.trail === g.p0, 'loss at .1 ' + JSON.stringify(g));
    g = await at(890, 860, 0.5); assert(g.shown === 860 && g.trail === g.p0, 'loss counted at .5');
    g = await at(890, 860, 1.8); assert(g.trail === g.p1, 'loss drained');
    // near the next tier (70% of the way, 1010 in 실버): its colour and its ball come in, the ball rising with the fill
    g = await at(1000, 1040, 0); assert(!g.near && g.paint === 0, 'not near yet ' + JSON.stringify(g));
    g = await at(1000, 1040, 1.6); assert(g.near && g.paint > 0.3 && g.paint < 0.45, 'near ' + JSON.stringify(g));
    // promoted out of the tier: a full ring in the tier the game began in; dropped out of it, an empty one
    g = await at(1090, 1112, 2); assert(g.p1 === 1 && g.fill === 1 && g.paint === 1 && g.left === '골드까지 0', 'up a tier ' + JSON.stringify(g));
    g = await at(805, 790, 2); assert(g.p1 === 0 && g.fill === 0 && !g.near, 'down a tier ' + JSON.stringify(g));
    // the top tier: always a full ring, nothing next
    g = await at(2100, 2130, 2); assert(g.p0 === 1 && g.p1 === 1 && !g.near && g.left === '최고 등급', 'top tier ' + JSON.stringify(g));

    // ---- the receipt's money lines: the slate's, copied, and copied again when the vault's word changes them
    const money = () => page.evaluate(() => [...document.querySelectorAll('#rcMoney .r')].map(r => r.textContent));
    await page.evaluate(() => {
      const d = __dp8, o = d.ranked.on = { seat: 0, kind: 'ranked', mode: 'four', dama: 1100, t0: Date.now(), opp: { name: 'B' }, flushing: true,
        result: { winner: 0, coins: [240, 0], dama: [1112, 1088] } };
      d.st.screen = 'result'; d.ranked.paint();
      d.receipt.paint({ me: 0, kind: 'win', stamp: '승리', sub: 'A', mode: '4구 · 랭킹전', opp: 'B (골드)', innings: 12, time: '8:05', table: 3, stats: [['득점', 5]], score: '5 : 3', name: 'A' });
    });
    assert.deepEqual(await money(), ['코인+240', '레이팅1100 → 1112 (+12)']);
    assert.equal(await page.evaluate(() => document.querySelector('#rcpt .tot').textContent), '합계5 : 3');
    // (the vault's own word a moment later: the rating as the vault keeps it, and the 승급전 the game began)
    await page.evaluate(() => {
      const d = __dp8, o = d.ranked.on; o.vaultSeen = true;
      Object.defineProperty(d.net, 'me', { configurable: true, get: () => ({ damas: { carom: 1099 }, promo: { carom: { to: 3, w: 0, l: 0 } }, promoLast: { f: 'carom', what: 'promo', at: o.t0 + 1 } }) });
      d.ranked.paint();
    });
    await page.waitForTimeout(50);   // (the receipt follows the slate by its MutationObserver)
    assert.deepEqual(await money(), ['코인+240', '레이팅1100 → 1099 (-1)', '승급전플래티넘 승급전 시작 · 3판 2선승']);
    // a friend's game: only the coins
    await page.evaluate(() => { const o = __dp8.ranked.on; o.kind = 'invite'; __dp8.ranked.paint(); });
    await page.waitForTimeout(50);
    assert.deepEqual(await money(), ['코인+240']);
    assert.deepEqual(errors, []);
    console.log('result: the rating gauge (gain, loss, near the next tier, out of the tier, the top) and the receipt\'s money lines passed');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
