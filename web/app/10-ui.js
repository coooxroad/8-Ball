/* ================= small DOM helpers ================= */
function el(tag, attrs, kids) {
  const n = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    if (attrs[k] == null) continue;                                  // an attribute given as null is left off (disabled: null = enabled)
    if (k === 'class') n.className = attrs[k]; else if (k === 'text') n.textContent = attrs[k];
    else if (k === 'style') n.style.cssText = attrs[k]; else if (k.slice(0, 2) === 'on') { n.addEventListener(k.slice(2), attrs[k]); (n._on || (n._on = [])).push([k.slice(2), attrs[k]]); }   // (_on: kept, so the desk can hand them to the same node painted before - 36-desk-paint.js deskReuse)
    else n.setAttribute(k, attrs[k]);
  }
  if (kids) for (const c of [].concat(kids)) if (c) n.appendChild(c);
  return n;
}
const hex = n => '#' + n.toString(16).padStart(6, '0');
/* A line icon's soft shadow drawn into the icon itself - the same strokes again, a little lower and wider, faint - instead
   of a CSS drop-shadow: a filter on an icon inside the menu's leaning, scrolling layer was drawn again on every resize and
   scroll, and on the tablet some icons went missing (owner 11-19). inner: the strokes; sw: their width; s: viewBox units per 24. */
const icoLift = (inner, sw, s = 1) => [[1.3, 3, .07], [1.2, 1.8, .09], [1.05, .7, .12]].map(([y, w, a]) =>
  `<g transform="translate(0 ${(y * s).toFixed(2)})" stroke="rgba(0,0,0,${a})" stroke-width="${(sw + w * s).toFixed(2)}">${inner}</g>`).join('') + `<g>${inner}</g>`;
// every button press: wake the audio (browsers only allow that inside a tap), click, then act
const onTap = fn => () => { SND.init(); SND.tap(); fn(); };
const press = (id, fn) => $(id).addEventListener('click', onTap(fn));
const LEVELS = ['쉬움', '보통', '어려움', '프로'];   // (the last was '미친' until 5.0)
// a seg whose choice can also be dragged along: the bar follows the finger and settles on the nearest choice
function slider(id, get, set) {
  const box = $(id), n = box.children.length; let cur = -1, down = false;
  const paint = v => { cur = v; box.style.setProperty('--i', v); box.style.setProperty('--n', n); box.dataset.lv = v; for (const b of box.children) b.setAttribute('aria-pressed', String(+b.dataset.v === v)); };
  const at = e => { const r = box.getBoundingClientRect(); return Math.max(0, Math.min(n - 1, Math.floor((e.clientX - r.left) / r.width * n))); };
  const move = e => { const v = at(e); if (v !== cur) { SND.tap(); paint(v); set(v); } };
  box.addEventListener('pointerdown', e => { SND.init(); down = true; box.classList.add('drag'); try { box.setPointerCapture(e.pointerId); } catch (err) {} const was = cur; move(e); if (cur === was) SND.tap(); });
  box.addEventListener('pointermove', e => { if (down) move(e); });
  const up = () => { down = false; box.classList.remove('drag'); };
  box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
  paint(+get()); return () => paint(+get());
}
function seg(id, get, set) {
  const box = $(id), paint = () => { for (const b of box.children) b.setAttribute('aria-pressed', String(b.dataset.v === String(get()))); };
  box.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; SND.init(); SND.tap(); set(b.dataset.v); paint(); });
  paint(); return paint;
}
let toastTimer = 0;
function toast(msg, kind, ms) {
  const t = $('#toast'); if (!msg) return;
  t.textContent = msg; t.dataset.t = msg; t.className = 'show ' + (kind || '');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = kind || ''; }, ms || 1800);
}
// where on the screen a table position is, left (-1) to right (1), kept gentle
const panOf = (x, y) => 0.45 * Math.max(-1, Math.min(1, scene.portrait ? -y / game.P.HW : x / game.P.HL));
// (스누커's balls are plain colours: tables.js SNOOKER)
const ballChip = (id, style) => game.mode.table === 'snooker' ? el('i', { class: 'mb', style: `--c:${SNOOKER.css(id)};` + (style || '') })
  : el('i', { class: 'mb' + (id > 8 ? ' st' : ''), style: `--c:${ballCss(id)};` + (style || '') });

/* ================= screens and layout ================= */
const CONTROLS = ['#power', '#fine', '#spinBtn'];
function show(screen) {
  st.screen = screen;
  const home = screen === 'home', away = home;
  $('#hud').hidden = screen !== 'play'; $('#result').hidden = screen !== 'result';
  for (const id of CONTROLS) $(id).hidden = screen !== 'play';
  // the desk's bar along the top, and on the home screen its leaning plane
  $('#deskBar').hidden = !away; $('#deskPlane').hidden = $('#dkBeams').hidden = !home;
  $('#spinPop').hidden = true; closeSheet(); SND.rolling(0);
  if (screen !== 'result' && typeof review !== 'undefined') review.close(true);
  // (leaving for home while a match's end or opening is on screen: it goes - 50-outro.js, 56-league.js)
  if (screen === 'home') { if (outro.on) outro.stop(); if (vsIntro.on) vsIntro.stop(); confetti.stop(); }
  if (screen !== 'play') setView3D(false);
  if (screen !== 'play') { app.classList.add('busy'); scene.setZone(null); }
  // a match is shown as on television (style/80-broadcast.css); kept on its result, which is a slate over the same table
  // (owner 11-21 - the table must not move under it)
  app.classList.toggle('bcast', (screen === 'play' || screen === 'result') && flow === match);
  applyBackdrop(); layout(); MUSIC.screen(screen);
}
let wide = true, layoutN = 0, layoutW = 0, layoutH = 0, layoutDpr = 0, winW = 0, winH = 0;
function layout() {
  layoutN++;
  const W = app.clientWidth, H = app.clientHeight; if (!W || !H) return;
  layoutW = W; layoutH = H; layoutDpr = window.devicePixelRatio || 1; winW = innerWidth; winH = innerHeight;
  const portrait = H > W; wide = W >= 900 && H >= 560;
  if (st.screen === 'home' && deskTab && menuNow() !== menuShown()) return deskPaint();   // (turned upright or back: the card menu or the desk's boards - 37-desk-menu.js; deskPaint lays out again)
  app.classList.toggle('portrait', portrait); app.classList.toggle('compact', !wide);
  const tilt = st.screen === 'home';                                 // the desk's home: its plane leans away (36-desk-paint.js)
  app.classList.toggle('tilt', tilt);                                // (before the scene sizes itself: it draws finer while leaning)
  if (tilt) deskBeams();                                             // (the window's light, drawn again only if the size changed)
  /* (the live table hidden under the desk - the card menu, the boards - is neither shown nor sized again: entering full
     screen on the tablet went black for seconds while everything was redone at once, owner 11-15. It is sized when it
     shows again: every place that shows it lays out again) */
  const glHid = st.screen === 'home' && !deskTableShown();
  app.classList.toggle('glhide', glHid);
  if (!glHid) scene.resize();
  scene.setDeskLight(tilt);                                          // the lamps move up and right, so shadows fall as the desk's do
  if (tilt) { deskLean(W, H, portrait); deskWindow(W, H, portrait); menuFit(); }
  else if (st.screen === 'reel') scene.setInsets({ t: H * 0.09, l: 0, r: 0, b: H * 0.09 }, true);
  else if (st.screen === 'result' && review.on) scene.setInsets(review.insets(W, H), true);   // (the game review: the table alone, copied onto the tray)
  else scene.setInsets(playInsets(H, portrait));
  if (st.screen === 'play') { paintPowerCue(); requestAnimationFrame(drawDial); if (!$('#spinPop').hidden) { fitSpinPop(); setSpinUI(); setKindUI(); } }
  setPowerUI(st.power);
}
// in play: clear of the HUD above and the controls at the sides (landscape) or below (upright)
function playInsets(H, portrait) {
  const hud = H <= 520 ? 50 : 60;
  // A match is shown as on television (style/80-broadcast.css, #app.bcast): lying, its score bar runs along the top
  // middle, so the table keeps clear of it; carom shows each player's ball on their plate.
  const tv = app.classList.contains('bcast');
  app.classList.toggle('carom', tv && game.mode.table === 'carom');
  app.classList.toggle('ysw', tv && game.mode.table === 'carom' && game.yellow === 0);   // (player 1 has the yellow: the plates' balls swap)
  // held upright: every control in one column at the right (style/10-play.css), the table beside it
  if (portrait) return { t: hud + 26, l: 6, r: 72, b: 10 };
  // Lying, the controls stand in a frame (style/82-ingame.css: the margin, the two columns, the row of keys along the top)
  // and the table keeps clear of those same lengths - read from there, not written again here (until 11-22 these were
  // numbers of their own, and the table and the controls drifted apart as either changed).
  const cs = getComputedStyle(app), f = k => parseFloat(cs.getPropertyValue(k));
  const g = f('--g'), gap = f('--gap'), cl = f('--cl'), cr = f('--cr'), tb = f('--tb');
  if (g >= 0 && cl > 0 && cr > 0 && tb > 0) return { t: g + tb + gap / 2, l: g + cl + gap, r: g + cr + gap, b: g };
  return { t: hud + 6, l: 66, r: 74, b: 10 };
}
// Resizes arrive in bursts (keyboard sliding, rotation): lay out once when they stop, and not at all while typing a name.
let layoutT = 0, layoutPending = false;
/* While the window changes size on the home screen the desk is put away (#app.resizing, 60-desk.css) and comes back in
   the frame it is laid out at the new size. The leaning desk and the row of cards over it are large layers: a full screen
   grows the window step by step, and each step had them laid out and drawn again at its size - the menu stalled or went
   black for seconds, where a game (no desk up) took a full screen at once (owner 11-15). Away means not laid out at all
   (display:none), the row of cards only unseen (it keeps where it was scrolled to). Not while typing: the keyboard coming
   up changes the size too, and the desk stays under the sheet then. */
/* (11-20, owner: on the web, full screen stayed black a long while.) While the window changes size the home screen is
   also held at the size it was laid out at (pinned): the window grows step by step, and at each step every layer of the
   leaning desk and the cards changed size and was drawn again by the graphics chip - the screen black until it caught up.
   Held, the last picture stays up (the window's new strip is the room's dark) and the desk is drawn once, at the end. */
let sizedAt = 0;
const pin = on => {
  if (on) { app.style.width = layoutW + 'px'; app.style.height = layoutH + 'px'; document.documentElement.style.background = getComputedStyle(app).backgroundColor; }
  else { app.style.width = app.style.height = ''; document.documentElement.style.background = ''; }
};
function sizing() { if (st.screen === 'home') { if (!app.classList.contains('resizing') && layoutW) pin(true); app.classList.add('resizing'); sizedAt = performance.now(); } }
function layoutSoon() {
  clearTimeout(layoutT);
  const a = document.activeElement, typing = a && a.tagName === 'INPUT';
  if (!typing && (innerWidth !== winW || innerHeight !== winH || app.clientWidth !== layoutW || app.clientHeight !== layoutH)) sizing();
  layoutT = setTimeout(() => {
    const a = document.activeElement;
    if (!a || a.tagName !== 'INPUT' || app.classList.contains('resizing')) layoutPending = true;
  }, 120);
}
window.addEventListener('resize', layoutSoon);
if (window.ResizeObserver) new ResizeObserver(layoutSoon).observe(app);
// Resizing clears the canvas. Apply it only in a frame that can draw, and skip duplicate browser resize notifications.
function checkLayout() {
  const dprChanged = (window.devicePixelRatio || 1) !== layoutDpr;
  if (!layoutPending && !dprChanged) return;
  layoutPending = false;
  // (the desk away: laid out once the size has stopped changing for a moment - asked again until it has)
  let back = false;
  if (app.classList.contains('resizing')) {
    if (performance.now() - sizedAt < 100) { clearTimeout(layoutT); layoutT = setTimeout(() => { layoutPending = true; }, 120); return; }
    app.classList.remove('resizing'); pin(false); back = true;
    /* (and the cards' moving layers come back a moment after the desk: the frame the desk returns in has all of it to draw
       again at its new size, and on the tablet parts of it came up missing - owner 11-19; 84-menu.css #app.settle) */
    app.classList.add('settle'); clearTimeout(checkLayout.settle); checkLayout.settle = setTimeout(() => app.classList.remove('settle'), 600);
  }
  if (back || dprChanged || app.clientWidth !== layoutW || app.clientHeight !== layoutH) {
    const start = performance.now();
    layout();
    prof.add('ui', performance.now() - start);
  }
}

const powerUI = { p: -1, k: 0, th: -1, num: '', h: null, lay: -1 };
function setPowerUI(p) {
  // the cue sits against the ball at 0 and is drawn back along the track as the power rises
  // (the gauge stands upright in either orientation: the cue is drawn down it, as it is drawn back from the ball)
  const tr = $('#power'), c = $('#powerCue'), REST = 48, END = 52;   // (clear of the gauge's end caps, so the chalked tip shows)
  /* The number is the stroke itself, not a share of the gauge: how fast the cue ball leaves, in km/h - so the same pull says
     more with a strong cue than with a weak one. And the meter's colours are laid out on that same scale (--gh): a cue at
     the top of the usual range (STAT_MAX) pulled all the way reaches violet; only the break cue (POWER_MAX, a lesson reward)
     goes on past it to blue and mint at the very top; a weaker one stops short. */
  const k = typeof cueK === 'function' ? cueK().power : 1, top = 1 + POWER_MAX / 100, v = p > 0 && game && game.vOf ? game.vOf(p) * k * 3.6 : 0;
  // (called on every move of a finger and every frame the computer lines up: nothing is written that has not changed, and
  // the track's height is measured once per layout - reading it straight after writing styles made the page lay out again)
  if (powerUI.lay !== layoutN || !powerUI.h) { powerUI.h = tr.clientHeight; powerUI.lay = layoutN; }   // (not kept while hidden: 0)
  const th = powerUI.h;
  if (powerUI.p === p && powerUI.k === k && powerUI.th === th) return;
  powerUI.p = p; powerUI.k = k; powerUI.th = th;
  const num = p > 0 ? v.toFixed(1) : '0';
  if (powerUI.num !== num) { powerUI.num = num; $('#powerNum').innerHTML = p > 0 ? `${num}<small>km/h</small>` : '0'; }
  tr.style.setProperty('--gh', (top / k * 100).toFixed(1) + '%');
  c.style.transform = `translate(-50%,${REST + p * Math.max(0, th - REST - END)}px)`;
  // The track itself shows the power: colour wells up from the end the cue is pulled towards, reaching further
  // and burning hotter (blue-green, yellow, orange, red) the harder the pull.
  const vio = (1 + STAT_MAX / 100) / top, q = Math.min(1, p), qa = Math.min(1, p * k / top) / vio;           // (qa 1: violet)
  const hue = qa <= 1 ? 185 - 185 * Math.pow(Math.min(1, qa * 1.12), 0.85) - (qa > 0.9 ? (qa - 0.9) * 600 : 0)   // (past red, on to violet)
    : 300 - 140 * (qa - 1) / (1 / vio - 1);                                                                       // (the break cue: blue, then mint)
  tr.style.setProperty('--heat', `hsl(${hue.toFixed(0)} ${Math.round(70 + 30 * q)}% ${Math.round(52 - 4 * q)}% / ${(q < 0.02 ? 0 : 0.35 + 0.6 * q).toFixed(2)})`);
  tr.style.setProperty('--reach', (12 + 88 * q).toFixed(0) + '%');
  tr.style.setProperty('--pw', (q * 100).toFixed(1) + '%');                 // (the desk's lit meter: exactly the power)
  // (owner 11-22, K2: marks at 25 / 50 / 75 of the pull and a line at the cue's tip - 82-ingame.css; made once)
  if (!tr.querySelector('.pw-lip')) tr.append(...[25, 50, 75].map(v => el('i', { class: 'pw-tk', 'data-v': v, style: `--v:${v / 100}` })), el('i', { class: 'pw-lip' }));
  const run = Math.max(0, th - REST - END);
  tr.style.setProperty('--r0', REST + 'px'); tr.style.setProperty('--run', run + 'px'); tr.style.setProperty('--py', (REST + p * run).toFixed(1) + 'px');
  tr.classList.toggle('drawn', p > 0.01);
  // the same colour, whole, for the power shown beside the cue on the table (scene/40-cue.js, 90-loop.js v.pwCol)
  powerUI.col = `hsl(${hue.toFixed(0)} ${Math.round(70 + 30 * q)}% ${Math.round(56 - 4 * q)}%)`; powerUI.col0 = powerUI.col.replace(')', ' / .12)');
}

/* Where on the pad the cue in hand's furthest strike is, as a share of its width - the ring drawn there (style/10-play.css
   #spinPad::before). On the desk the ball is the inner 79% of the pad (its bezel round it) and the ring is at 60%; the
   plain pad is all ball, the ring at 72%. A cue with no strike limit (content/20-cues.js TRAITS reach) has its furthest
   further out (72%, plain 90%) and the ordinary furthest drawn inside it (.sring). */
const padRing = () => { const desk = $('#app').classList.contains('desk'), far = typeof spinMax === 'function' && spinMax() > 1; return far ? (desk ? 0.72 : 0.9) : (desk ? 0.6 : 0.72); };
/* The spin pop always on the screen: a browser's own bars make the page shorter than the screen (a phone upright, not
   full screen, had the pad off the top). Smaller first (no hint, a smaller pad and side view), then, if still too tall,
   from the top of the screen down over the controls under it. */
function fitSpinPop() {
  const pop = $('#spinPop'); pop.classList.remove('tight', 'top', 'wide'); if (pop.hidden) return;
  const off = () => pop.getBoundingClientRect().top < 6;
  if (off()) { pop.classList.add('tight'); if (off()) pop.classList.add('top'); }
  if (pop.getBoundingClientRect().left < 6) pop.classList.add('wide');   // (a narrow phone: over the column of controls too)
}
function setSpinUI() {
  // the dot sits where the finger set it: the cue's furthest (spinMax) on the ring (padRing) - the pad measured, since
  // it is 150, 160 or 200 px by the look (and the button 60 or 78)
  const s = st.spin, M = typeof spinMax === 'function' ? spinMax() : 1, k = padRing() / M / 2, btn = $('#spinBtn'), pad = $('#spinPad');
  $('#spinDot').style.transform = `translate(${s.x * k * (btn.clientWidth || 60)}px,${-s.y * k * (btn.clientWidth || 60)}px)`;
  $('#spinPadDot').style.transform = `translate(${s.x * k * (pad.clientWidth || 150)}px,${-s.y * k * (pad.clientWidth || 150)}px)`;
  pad.classList.toggle('reach', M > 1);
}

/* Full screen, on the web (the app is full screen already, and a web page installed to the home screen opens that way
   by its manifest): a button on the desk's top and in the pause sheet. A browser allows it only from a tap. */
const fullOn = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
// A regular tab can match fullscreen display mode after entering through the API, so keep its exit button available.
function fullCan() {
  const root = document.documentElement, supported = !!(root.requestFullscreen || root.webkitRequestFullscreen);
  return location.protocol !== 'file:' && (fullOn() || (supported && !matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches));
}
// (debug: how long full screen takes - from the tap to frames coming steadily again - shown as a note; owner 11-15)
let fullT0 = 0;
function fullTime() {
  const t0 = fullT0; fullT0 = 0; if (!t0 || !net.debug) return;
  let last = performance.now(), worst = 0, calm = 0;
  const step = now => {
    worst = Math.max(worst, now - last); calm = now - last < 40 ? calm + 1 : 0; last = now;
    if (calm >= 5 || now - t0 > 20000) return toast(`전체 화면 전환 ${Math.round(now - t0)}ms · 가장 긴 멈춤 ${Math.round(worst)}ms`, '', 5000);
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function fullToggle() {
  const d = document.documentElement; fullT0 = performance.now();
  sizing();   // (put away before the window starts to grow)
  if (fullOn()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  else { const p = (d.requestFullscreen || d.webkitRequestFullscreen).call(d, { navigationUI: 'hide' }); if (p && p.catch) p.catch(() => { layoutPending = true; toast('이 브라우저에서는 전체 화면을 쓸 수 없습니다.', '', 2200); }); }
}
function paintFull() { const b = $('#dkFull'); if (!b) return; b.hidden = !fullCan(); b.querySelector('span').textContent = fullOn() ? '창 모드' : '전체 화면'; }
function fullChanged() {
  paintFull(); fullTime();
  clearTimeout(layoutT);
  sizing();
  layoutPending = true;
  scene.invalidate();
}
document.addEventListener('fullscreenchange', fullChanged);
document.addEventListener('webkitfullscreenchange', fullChanged);

/* No zooming the page with the fingers (owner 11-22): the viewport says so (build.sh) and the styles let a touch only pan
   (00-base.css), but iOS Safari zooms anyway on a pinch - its gesture events are turned down here, and a touch of two
   fingers moving is not let zoom either. A trackpad's pinch on a computer comes as a wheel with ctrl: not the page's
   zoom either. (The game's own controls never use two fingers; they still get every event.) */
for (const k of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(k, e => e.preventDefault(), { passive: false });
document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
document.addEventListener('wheel', e => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
