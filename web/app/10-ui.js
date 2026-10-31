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
const LEVELS = ['쉬움', '보통', '어려움', '미친'];
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
  const home = screen === 'home', away = home || screen === 'records', dk = true;
  $('#hud').hidden = screen !== 'play'; $('#result').hidden = screen !== 'result'; $('#records').hidden = screen !== 'records';
  for (const id of CONTROLS) $(id).hidden = screen !== 'play';
  // the desk and the lobby each bring their own bar along the top (kept over the records), and the desk its leaning plane
  $('#deskBar').hidden = !dk || !away; $('#deskPlane').hidden = $('#dkBeams').hidden = !dk || !home;
  $('#spinPop').hidden = true; closeSheet(); SND.rolling(0);
  if (screen !== 'play') setView3D(false);
  if (screen !== 'play') { app.classList.add('busy'); scene.setZone(null); }
  app.classList.toggle('bcast', dk && screen === 'play' && flow === match);   // a match on the desk is shown as on television (head.html)
  applyTheme(); layout(); MUSIC.screen(screen);
}
let wide = true;
function layout() {
  const W = app.clientWidth, H = app.clientHeight; if (!W || !H) return;
  const portrait = H > W; wide = W >= 900 && H >= 560;
  app.classList.toggle('portrait', portrait); app.classList.toggle('compact', !wide);
  scene.resize();
  const tilt = st.screen === 'home';                                 // the desk's home: its plane leans away (32-desk.js)
  scene.setDeskLight(tilt);                                          // the lamps move up and right, so shadows fall as the desk's do
  app.classList.toggle('tilt', tilt);
  if (tilt) { deskLean(W, H, portrait); deskWindow(W, H, portrait); }
  else if (st.screen === 'reel') scene.setInsets({ t: H * 0.09, l: 0, r: 0, b: H * 0.09 }, true);
  else scene.setInsets(playInsets(H, portrait));
  if (st.screen === 'play') { paintPowerCue(); requestAnimationFrame(drawDial); }
  setPowerUI(st.power);
}
// in play: clear of the HUD above and the controls at the sides (landscape) or below (upright)
function playInsets(H, portrait) {
  const hud = H <= 520 ? 50 : 60;
  // A match on the desk is shown as on television (head.html #app.bcast): lying, its score bar runs along the top
  // middle, so the table keeps clear of it; carom shows each player's ball on their plate.
  const tv = app.classList.contains('bcast');
  app.classList.toggle('carom', tv && game.mode.table === 'carom');
  app.classList.toggle('ysw', tv && game.mode.table === 'carom' && game.yellow === 0);   // (player 1 has the yellow: the plates' balls swap)
  if (tv && !portrait) return { t: wide ? 86 : 62, l: wide ? 118 : 116, r: wide ? 92 : 80, b: 10 };   // (the bar along the top, the wider controls at the sides)
  if (portrait) return { t: hud + 26, l: 6, r: 6, b: 146 };
  return portrait ? { t: hud + 8, l: 6, r: 6, b: 112 } : { t: hud + 6, l: 66, r: 74, b: 10 };
}
// Resizes arrive in bursts (keyboard sliding, rotation): lay out once when they stop, and not at all while typing a name.
let layoutT = 0;
function layoutSoon() {
  clearTimeout(layoutT);
  layoutT = setTimeout(() => { const a = document.activeElement; if (a && a.tagName === 'INPUT') return; layout(); }, 120);
}
window.addEventListener('resize', layoutSoon);
if (window.ResizeObserver) new ResizeObserver(layoutSoon).observe(app);

function setPowerUI(p) {
  // the cue sits against the ball at 0 and is drawn back along the track as the power rises
  const tr = $('#power'), c = $('#powerCue'), REST = 10, END = 70;
  $('#powerNum').textContent = p > 0 ? Math.max(1, Math.round(p * 100)) : 0;
  if (scene.portrait) c.style.transform = `translate(${REST + p * Math.max(0, tr.clientWidth - REST - END)}px,-50%)`;
  else c.style.transform = `translate(-50%,${REST + p * Math.max(0, tr.clientHeight - REST - END)}px)`;
  // The track itself shows the power: colour wells up from the end the cue is pulled towards, reaching further
  // and burning hotter (blue-green, yellow, orange, red) the harder the pull.
  const q = Math.min(1, p), hue = 185 - 185 * Math.pow(q, 0.85);
  tr.style.setProperty('--heat', `hsl(${hue.toFixed(0)} ${Math.round(70 + 30 * q)}% ${Math.round(52 - 4 * q)}% / ${(q < 0.02 ? 0 : 0.35 + 0.6 * q).toFixed(2)})`);
  tr.style.setProperty('--reach', (12 + 88 * q).toFixed(0) + '%');
  tr.style.setProperty('--pw', (q * 100).toFixed(1) + '%');                 // (the desk's lit meter: exactly the power)
}
function setSpinUI() {
  const s = st.spin, k = 0.36;
  $('#spinDot').style.transform = `translate(${s.x * k * 60}px,${-s.y * k * 60}px)`;
  $('#spinPadDot').style.transform = `translate(${s.x * k * 150}px,${-s.y * k * 150}px)`;
}
