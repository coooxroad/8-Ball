/* The ball pictures of 상점 · 내 장비 and the 랭킹전 cards, made once here instead of on every device (owner 11-20: they came
   up one by one, slowly, after every update - each was drawn by the device's GPU and read back, and kept only for that
   build). Every ball set (content/30-balls.js) in both kinds: the pool balls 0-15 and the carom balls 0-3, as the game's
   own scene draws them (scene.ballShot), 128 px, into ui/balls/<set>-<kind>-<n>.webp. ui/balls/index.json keeps a stamp of
   each set as it was drawn (stampOf below); the build lists the sets whose stamp still matches (build.sh → BALL_PICS) and
   the app draws the others on the device as before (app/32-desk.js ballPic).

   Run after adding or changing a ball set:  sh web/build.sh && node web/tools/ball-pics.js [set id ...]
   (needs the Chromium of the browser checks: web/test/browser/harness.js) */
const fs = require('fs'), path = require('path');
const { stampOf, SETS } = require('./ball-stamp.js');
const OUT = path.join(__dirname, '..', 'ui', 'balls'), SIZE = 128;
const KINDS = [['pool', 16], ['carom', 4]];
/* The picture without its colour profile (R2 O2-c): Chromium writes each with an ICCP chunk of sRGB, 456 bytes - most of a
   small ball's file in some sets - and a picture with no profile is read as sRGB anyway, so it shows the same. The chunk
   goes, and the extended header's flag for it (VP8X, flags bit 0x20); the RIFF size is set again. */
function noIcc(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return buf;
  const parts = [buf.subarray(0, 12)];
  for (let o = 12; o + 8 <= buf.length;) {
    const id = buf.toString('ascii', o, o + 4), n = buf.readUInt32LE(o + 4), end = o + 8 + n + (n & 1);
    if (id !== 'ICCP') { const c = Buffer.from(buf.subarray(o, end)); if (id === 'VP8X') c[8] &= ~0x20; parts.push(c); }
    o = end;
  }
  const out = Buffer.concat(parts); out.writeUInt32LE(out.length - 8, 4); return out;
}
// (node web/tools/ball-pics.js --strip-icc: the pictures already made, their profiles taken out - no browser needed)
if (process.argv[2] === '--strip-icc') {
  let saved = 0;
  for (const f of fs.readdirSync(OUT).filter(f => f.endsWith('.webp'))) { const p = path.join(OUT, f), a = fs.readFileSync(p), b = noIcc(a); if (b.length < a.length) { fs.writeFileSync(p, b); saved += a.length - b.length; } }
  console.log(`ball pictures: ${saved} bytes of colour profiles taken out`); process.exit(0);
}

(async () => {
  const { open } = require('../test/browser/harness.js');
  const only = process.argv.slice(2), sets = SETS.filter(k => !only.length || only.includes(k.id));
  fs.mkdirSync(OUT, { recursive: true });
  const indexPath = path.join(OUT, 'index.json');
  const index = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, 'utf8')) : {};
  const { browser, page, errors } = await open(900, 600, 1, { init: () => localStorage.setItem('dp8.prefs', JSON.stringify({ v: 2, how: true })) });
  await page.waitForFunction(() => !!window.__dp8, null, { timeout: 60000 });
  for (const k of sets) {
    // (its surface pictures start loading when it is first drawn - a pool shot does not wait for the carom ones: warm both)
    await page.evaluate(id => { for (const [kind, n] of [['pool', 0], ['pool', 1], ['carom', 0], ['carom', 1], ['carom', 2], ['carom', 3]]) __dp8.scene.ballShot(id, kind, n); }, k.id);
    await page.waitForTimeout(600);
    for (const [kind, count] of KINDS) for (let n = 0; n < count; n++) {
      // (taken again until its surface pictures have loaded: done)
      let url = null;
      for (let tries = 0; tries < 40 && !url; tries++) {
        url = await page.evaluate(([id, kind, n, S, last]) => {
          const s = __dp8.scene.ballShot(id, kind, n); if (!s.done && !last) return null;
          const c = document.createElement('canvas'); c.width = c.height = S;
          const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(s.c, 0, 0, S, S);
          return c.toDataURL('image/webp', 0.9);
        }, [k.id, kind, n, SIZE, tries === 39]);
        if (!url) await page.waitForTimeout(150);
      }
      if (!url || !url.startsWith('data:image/webp')) throw new Error(`${k.id} ${kind} ${n}: not drawn`);
      fs.writeFileSync(path.join(OUT, `${k.id}-${kind}-${n}.webp`), noIcc(Buffer.from(url.split(',')[1], 'base64')));
    }
    index[k.id] = stampOf(k);
    console.log(`ball pictures: ${k.id}`);
  }
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 1) + '\n');
  if (errors.length) console.log('page errors:', errors);
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
