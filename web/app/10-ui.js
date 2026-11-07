/* ================= small DOM helpers ================= */
function el(tag, attrs, kids) {
  const n = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    if (attrs[k] == null) continue;                                  // an attribute given as null is left off (disabled: null = enabled)
    if (k === 'class') n.className = attrs[k]; else if (k === 'text') n.textContent = attrs[k];
    else if (k === 'style') n.style.cssText = attrs[k]; else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]); else n.setAttribute(k, attrs[k]);
  }
  if (kids) for (const c of [].concat(kids)) if (c) n.appendChild(c);
  return n;
}
const hex = n => '#' + n.toString(16).padStart(6, '0');
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
const ballChip = (id, style) => el('i', { class: 'mb' + (id > 8 ? ' st' : ''), style: `--c:${ballCss(id)};` + (style || '') });

/* ================= screens and layout ================= */
const CONTROLS = ['#power', '#fine', '#spinBtn'];
function show(screen) {
  st.screen = screen;
  const home = screen === 'home', away = home || screen === 'records';
  $('#hud').hidden = screen !== 'play'; $('#result').hidden = screen !== 'result'; $('#records').hidden = screen !== 'records';
  for (const id of CONTROLS) $(id).hidden = screen !== 'play';
  // the desk's bar along the top (kept over the records), and on the home screen its leaning plane
  $('#deskBar').hidden = !away; $('#deskPlane').hidden = $('#dkBeams').hidden = !home;
  $('#spinPop').hidden = true; closeSheet(); SND.rolling(0);
  if (screen !== 'play') setView3D(false);
  if (screen !== 'play') { app.classList.add('busy'); scene.setZone(null); }
  app.classList.toggle('bcast', screen === 'play' && flow === match);   // a match is shown as on television (style/80-broadcast.css)
  applyBackdrop(); layout(); MUSIC.screen(screen);
}
let wide = true, layoutN = 0;
function layout() {
  layoutN++;
  const W = app.clientWidth, H = app.clientHeight; if (!W || !H) return;
  const portrait = H > W; wide = W >= 900 && H >= 560;
  app.classList.toggle('portrait', portrait); app.classList.toggle('compact', !wide);
  const tilt = st.screen === 'home';                                 // the desk's home: its plane leans away (36-desk-paint.js)
  app.classList.toggle('tilt', tilt);                                // (before the scene sizes itself: it draws finer while leaning)
  scene.resize();
  scene.setDeskLight(tilt);                                          // the lamps move up and right, so shadows fall as the desk's do
  if (tilt) { deskLean(W, H, portrait); deskWindow(W, H, portrait); }
  else if (st.screen === 'reel') scene.setInsets({ t: H * 0.09, l: 0, r: 0, b: H * 0.09 }, true);
  else scene.setInsets(playInsets(H, portrait));
  if (st.screen === 'play') { paintPowerCue(); requestAnimationFrame(drawDial); }
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
  if (tv && !portrait) return { t: wide ? 86 : 62, l: wide ? 118 : 116, r: wide ? 92 : 80, b: 10 };   // (the bar along the top, the wider controls at the sides)
  // held upright: every control in one column at the right (style/10-play.css), the table beside it
  if (portrait) return { t: hud + 26, l: 6, r: 72, b: 10 };
  return { t: hud + 6, l: 66, r: 74, b: 10 };
}
// Resizes arrive in bursts (keyboard sliding, rotation): lay out once when they stop, and not at all while typing a name.
let layoutT = 0;
function layoutSoon() {
  clearTimeout(layoutT);
  layoutT = setTimeout(() => { const a = document.activeElement; if (a && a.tagName === 'INPUT') return; layout(); }, 120);
}
window.addEventListener('resize', layoutSoon);
if (window.ResizeObserver) new ResizeObserver(layoutSoon).observe(app);
// Some browsers change DPR without delivering resize or resolution-media events. The existing frame loop checks one
// number; a full layout only happens when that number changes, including the first frame after a backgrounded tab wakes.
let layoutDpr = window.devicePixelRatio || 1;
function checkPixelRatio() {
  const current = window.devicePixelRatio || 1;
  if (current !== layoutDpr) { layoutDpr = current; layout(); }
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
}
/* Where on the pad the cue in hand's furthest strike is, as a share of its width - the ring drawn there (style/10-play.css
   #spinPad::before). On the desk the ball is the inner 79% of the pad (its bezel round it) and the ring is at 60%; the
   plain pad is all ball, the ring at 72%. A cue with no strike limit (content/20-cues.js TRAITS reach) has its furthest
   further out (72%, plain 90%) and the ordinary furthest drawn inside it (.sring). */
const padRing = () => { const desk = $('#app').classList.contains('desk'), far = typeof spinMax === 'function' && spinMax() > 1; return far ? (desk ? 0.72 : 0.9) : (desk ? 0.6 : 0.72); };
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
const fullCan = () => location.protocol !== 'file:' && !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen) && !matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
const fullOn = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
function fullToggle() {
  const d = document.documentElement;
  if (fullOn()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  else { const p = (d.requestFullscreen || d.webkitRequestFullscreen).call(d, { navigationUI: 'hide' }); if (p && p.catch) p.catch(() => toast('이 브라우저에서는 전체 화면을 쓸 수 없습니다.', '', 2200)); }
}
function paintFull() { const b = $('#dkFull'); if (!b) return; b.hidden = !fullCan(); b.querySelector('span').textContent = fullOn() ? '창 모드' : '전체 화면'; }
document.addEventListener('fullscreenchange', () => { paintFull(); layoutSoon(); });
document.addEventListener('webkitfullscreenchange', () => { paintFull(); layoutSoon(); });

