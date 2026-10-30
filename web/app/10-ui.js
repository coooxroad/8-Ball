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
  const home = screen === 'home', away = home || screen === 'records', lob = prefs.ui === 'lobby', dk = prefs.ui === 'desk';
  $('#home').hidden = !home; $('#nav').hidden = !away; $('#hud').hidden = screen !== 'play'; $('#result').hidden = screen !== 'result'; $('#records').hidden = screen !== 'records';
  for (const id of CONTROLS) $(id).hidden = screen !== 'play';
  // the desk and the lobby each bring their own bar along the top (kept over the records), and the desk its leaning plane
  $('#deskBar').hidden = !dk || !away; $('#deskPlane').hidden = $('#dkBeams').hidden = !dk || !home;
  $('#topbar').hidden = !lob || !away; $('#dock').hidden = !lob || !home; $('#room').hidden = !away;
  $('#spinPop').hidden = true; closeSheet(); SND.rolling(0);
  if (screen !== 'play') setView3D(false);
  if (screen !== 'play') { app.classList.add('busy'); scene.setZone(null); }
  paintNav(); applyTheme(); layout();
}
// which place on the rail is lit
function paintNav() { const v = st.screen === 'records' ? 'all' : prefs.mode === 'practice' || prefs.mode === 'puzzle' ? prefs.mode : 'play'; for (const b of document.querySelectorAll('#nav .nv')) b.setAttribute('aria-pressed', String(b.dataset.v === v)); }
let wide = true;
function layout() {
  const W = app.clientWidth, H = app.clientHeight; if (!W || !H) return;
  const portrait = H > W; wide = W >= 900 && H >= 560;
  app.classList.toggle('portrait', portrait); app.classList.toggle('compact', !wide);
  const tallp = portrait && !wide && H >= 900 && prefs.ui === 'lobby'; app.classList.toggle('tallp', tallp);   // a tablet held upright: the lobby keeps the table in view
  scene.resize();
  scene.setFront(st.screen === 'home' && prefs.ui === 'desk');      // on the desk the lamps move up and right, so shadows fall as the desk's do
  const tilt = st.screen === 'home' && prefs.ui === 'desk'; app.classList.toggle('tilt', tilt);
  if (tilt) { deskLean(W, H, portrait); deskWindow(W, H, portrait); }
  else if (st.screen === 'reel') scene.setInsets({ t: H * 0.09, l: 0, r: 0, b: H * 0.09 }, true);
  else scene.setInsets(homeInsets(tallp) || playInsets(H, portrait));
  if (st.screen === 'play') paintPowerCue();
  setPowerUI(st.power);
}
// How far the desk leans, and how much bigger than the screen the plane must be: a point h up the plane from its bottom
// edge shows Y = h cos(t) P / (P + h sin(t)) up the screen, so the plane is made tall enough that its far edge reaches the
// top bar, its sides wide enough that the far corners still reach the screen's edges, and the desk on it starts just
// under the bar.
function deskLean(W, H, portrait) {
  const t = (wide ? 15 : portrait ? 12 : 10) * Math.PI / 180, P = 2.8 * Math.max(H, 600), c = Math.cos(t), sn = Math.sin(t);
  const bar = wide ? 62 : portrait ? 56 : 48, up = Y => Y * P / (c * P - Y * sn), hb = up(H - bar), k = P / (P + hb * sn);
  app.style.setProperty('--tilt', t + 'rad');
  app.style.setProperty('--pp', P + 'px');
  app.style.setProperty('--ovh', (hb - (H - bar)).toFixed(1) + 'px');
  app.style.setProperty('--ovw', Math.ceil(W / 2 * (1 / k - 1) + 2) + 'px');
}
// The desk is a plane seen from above and a little behind: it is laid out flat and then leans away from the eye (CSS
// 3D, about its bottom edge), and the canvas with the live table under it leans exactly the same way, so the table
// sits in the tray as one picture. A window is cut in the desk where the table is, worked out in the desk's own flat
// coordinates (the transform carries it along); a shade under the window edge lays the table's shadow on the felt,
// and a strip below it is the near rail's front.
function deskWindow(W, H, portrait) {
  const pl = $('#deskPlane'), dk = $('#desk'), sg = $('#dkStage'), win = sg.dataset.win === '1';
  let x = dk.offsetLeft, y = dk.offsetTop; for (let n = sg; n && n !== dk; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
  const dx = pl.offsetLeft, dy = pl.offsetTop, sw = sg.offsetWidth, sh0 = sg.offsetHeight;   // (x, y: the stage in the plane; dx, dy: the plane in the app)
  const ins = { t: dy + y + 4, l: dx + x + 4, r: W - (dx + x + sw) + 4, b: H - (dy + y + sh0) + 4 };
  ins.lie = portrait && sw > sh0; scene.setInsets(ins);              // a phone held upright: the tray is wider than tall, so the table lies down in it
  const tr = scene.tableRect(ins), x1 = tr.x - dx - 1, y1 = tr.y - dy - 1, x2 = tr.x + tr.w - dx + 1, y2 = tr.y + tr.h - dy + 1;
  pl.style.clipPath = win ? `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${x1}px ${y1}px, ${x2}px ${y1}px, ${x2}px ${y2}px, ${x1}px ${y2}px, ${x1}px ${y1}px)` : 'none';
  let sh = $('#dkShade'); if (!sh) { sh = el('div', { id: 'dkShade' }, el('i')); sg.appendChild(sh); } else if (sh.parentNode !== sg) sg.appendChild(sh);
  sh.hidden = !win; Object.assign(sh.style, { left: (tr.x - dx - x) + 'px', top: (tr.y - dy - y) + 'px', width: tr.w + 'px', height: tr.h + 'px' }); sh.style.setProperty('--tl', Math.max(5, Math.round(tr.h * 0.045)) + 'px');
}
// The other homes keep the table clear of their panels (the room left round it, in pixels from each edge); null when the
// home is narrow enough that the table simply takes the screen as in play.
function homeInsets(tallp) {
  if (st.screen !== 'home') return null;
  if (wide && prefs.ui === 'lobby') return { t: 92, l: 40, r: 432, b: 168 };
  if (tallp) return { t: 196, l: 24, r: 24, b: ($('.h-right').offsetHeight || 480) + 28 };
  if (wide) return { t: 40, l: 126, r: 412, b: 104 };                // the classic home: rail on the left, panel on the right
  return null;
}
// in play: clear of the HUD above and the controls at the sides (landscape) or below (upright)
function playInsets(H, portrait) {
  const hud = H <= 520 ? 50 : 60;
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
}
function setSpinUI() {
  const s = st.spin, k = 0.36;
  $('#spinDot').style.transform = `translate(${s.x * k * 60}px,${-s.y * k * 60}px)`;
  $('#spinPadDot').style.transform = `translate(${s.x * k * 150}px,${-s.y * k * 150}px)`;
}
