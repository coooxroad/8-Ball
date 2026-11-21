/* The menu cards' moving ground, drawn (owner 11-20: the menu stuttered, blinked and lost parts on the tablet; the look to
   stay as it is). Each card in sight had three moving layers over its face - the drifting signs, the soft light and the
   soft shade (84-menu.css, 11-17 to 11-19) - each its own layer, blended over the card every frame: with six cards in
   sight the graphics chip laid some three times the cards' area again each frame, and a tablet could not keep up. Here
   the three are one picture per card, drawn by this loop on the card's own small canvas (at the screen's CSS pixels -
   soft as they are, and the signs at .09, they look the same) to the same motions, 30 times a second (they move a few
   pixels a second): one layer per card, a third of the blending. The crossing light stays as it was (84-menu.css .x: unseen
   three quarters of the time). Only a card in sight moves (.mn-live, 37-desk-menu.js), nothing while a sheet is up or the
   menu is away, and with reduced motion each is drawn once, still.

   The motions are 84-menu.css's, kept there for 랭킹전's and 친구와 플레이's cards (#dkBoards), which still move by CSS:
     the signs  mn-drift 9s linear, delay -1.9s x --si: up and right by one tile (a quarter of its layer across, a seventh down)
     the light  mn-flow 16s ease-in-out alternate, delay -2.7s x --i      the shade  mn-flow 19s alternate-reverse, -3.1s x --i
     mn-flow    0% (-9%, -7%)  50% (6%, 5%)  100% (10%, -6%) of its own box */
const menuFx = (() => {
  const FLOW = [[-0.09, -0.07], [0.06, 0.05], [0.10, -0.06]];
  const RES = 0.5;   // (the canvas at half the CSS pixels: what it draws is soft or faint - the checks compare it with the CSS it replaced)
  // CSS ease-in-out: cubic-bezier(.42, 0, .58, 1), solved for x
  const ease = u => { let lo = 0, hi = 1, t = u; for (let k = 0; k < 18; k++) { t = (lo + hi) / 2; const x = 3 * 0.42 * t * (1 - t) * (1 - t) + 3 * 0.58 * t * t * (1 - t) + t * t * t; if (x < u) lo = t; else hi = t; } return 3 * t * t * (1 - t) + t * t * t; };
  // where a flowing box is at time t (seconds from its start), as a share of its own size
  function flow(t, dur, delay, reverse) {
    const p = Math.max(0, (t - delay) / dur), n = Math.floor(p); let f = p - n;
    if ((n % 2 === 1) !== reverse) f = 1 - f;
    const s = f < 0.5 ? 0 : 1, u = ease(s ? (f - 0.5) / 0.5 : f / 0.5), a = FLOW[s], b = FLOW[s + 1];
    return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
  }
  const motion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null, still = () => !!(motion && motion.matches);
  /* Each canvas's size is read when it changes (a ResizeObserver forgets it), not every frame: a size read each frame made
     the browser work the page's styles and layout out again first - the cards' CSS animations dirty them every frame - and
     that was most of what an idle menu cost on a phone (11-22, R1 O1-a: clientWidth 85 ms in 5 s, styles 155 ms). */
  const sized = typeof ResizeObserver === 'function' ? new ResizeObserver(es => { for (const e of es) e.target.box = null; }) : null, watched = new Set();
  const boxOf = cv => {
    if (!cv.box || !sized) { cv.box = [cv.clientWidth, cv.clientHeight]; if (sized && !watched.has(cv)) { watched.add(cv); sized.observe(cv); } }
    return cv.box;
  };
  let raf = 0, lastT = 0;
  const pics = {};   // the soft light, the shade (32-desk.js fxSoft) as images to draw
  const img = url => { if (!pics[url]) { const im = new Image(); im.src = url; pics[url] = im; } return pics[url]; };
  function draw(cv, t) {
    const [cw, ch] = boxOf(cv), W = Math.round(cw * RES), H = Math.round(ch * RES); if (!W || !H) return;
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const g = cv.getContext('2d'), w = cv.width, h = cv.height, si = +cv.dataset.si || 0, i = +cv.dataset.i || 0;
    if (cv.started == null) cv.started = t;
    const s = still() ? 0 : t - cv.started;
    g.clearRect(0, 0, w, h);
    // the signs: their layer 1⅓ the face across and 1⅙ down, its right and top edges on the face's (84-menu.css .mn-sym)
    const lw = w * 4 / 3, lh = h * 7 / 6, asp = Math.round(lw / lh * 40) / 40;
    if (!cv.symAsked) { cv.symAsked = true; Promise.resolve(fxSym(cv.dataset.sym, asp)).then(u => { if (u) cv.symImg = img(u); }); }
    if (cv.symImg && cv.symImg.complete) {
      const p = ((s + 1.9 * si) / 9) % 1;
      g.globalAlpha = 0.09; g.drawImage(cv.symImg, w - lw + lw * 0.25 * p, -lh * (1 / 7) * p, lw, lh); g.globalAlpha = 1;
    }
    // the light and the shade, each a soft round patch on its box (84-menu.css .lt, .dk)
    for (const [k, bx, by, bw, bh, dur, delay, rev] of [['lt', -0.24, -0.20, 0.92, 0.78, 16, -2.7 * i, false], ['dk', 0.28, 0.34, 0.96, 0.82, 19, -3.1 * i, true]]) {
      const im = img(fxSoft(k)); if (!im.complete) continue;
      const [fx, fy] = flow(s, dur, delay, rev), W2 = bw * w, H2 = bh * h;
      g.drawImage(im, bx * w + fx * W2, by * h + fy * H2, W2, H2);
    }
  }
  function frame(t) {
    raf = 0; t /= 1000;
    const list = document.querySelectorAll('#dkCards .mn-live canvas.mn-fxc');
    if (!list.length) return;
    raf = requestAnimationFrame(frame);
    // (30 a second, nothing under a sheet or with the page hidden)
    if (t - lastT < 1 / 31 || !$('#sheet').hidden || document.hidden) return;
    lastT = t;
    for (const cv of list) draw(cv, t);
    if (still()) { cancelAnimationFrame(raf); raf = 0; }
  }
  // (started by the menu whenever it is laid out; it stops by itself when no card of it is in sight. The canvases of
  // cards laid out again are let go here.)
  const run = () => { for (const cv of watched) if (!cv.isConnected) { sized.unobserve(cv); watched.delete(cv); } if (!raf) raf = requestAnimationFrame(frame); };
  const canvas = (id, i, si) => el('canvas', { class: 'mn-fxc', 'data-sym': PANEL_SYM[id] ? id : 'four', 'data-i': String(i), 'data-si': String(si), 'aria-hidden': 'true' });
  // (the checks: every card drawn as at s seconds into its motions - 84-menu.css's animations paused there look the same)
  const at = s => { for (const cv of document.querySelectorAll('#dkCards canvas.mn-fxc')) { cv.started = 0; draw(cv, s); } };
  return { run, canvas, at };
})();
