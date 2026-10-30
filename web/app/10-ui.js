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
const press = (id, fn) => $(id).addEventListener('click', () => { SND.init(); SND.tap(); fn(); });
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
  $('#home').hidden = screen !== 'home'; $('#nav').hidden = screen !== 'home' && screen !== 'records'; $('#hud').hidden = screen !== 'play'; $('#result').hidden = screen !== 'result'; $('#records').hidden = screen !== 'records';
  for (const id of CONTROLS) $(id).hidden = screen !== 'play';
  const lob = prefs.ui === 'lobby', dk = prefs.ui === 'desk'; $('#deskBar').hidden = !dk || (screen !== 'home' && screen !== 'records'); $('#desk').hidden = !dk || screen !== 'home'; $('#topbar').hidden = !lob || (screen !== 'home' && screen !== 'records'); $('#dock').hidden = !lob || screen !== 'home'; $('#room').hidden = screen !== 'home' && screen !== 'records';
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
  const hud = H <= 520 ? 50 : 60;
  scene.resize();
  if (st.screen === 'home' && prefs.ui === 'desk') {
    // the table inside the felt tray: the desk has a window cut in it there, through which the live table shows
    // (cut to the table's own outline, rails and all, so the felt of the tray runs right up to it; a shade under the window
    // edge lays the table's shadow on the felt)
    const sg = $('#dkStage'), r = sg.getBoundingClientRect(), a = app.getBoundingClientRect(), d = $('#desk').getBoundingClientRect(), win = sg.dataset.win === '1';
    const ins = { t: r.top - a.top + 4, l: r.left - a.left + 4, r: a.right - r.right + 4, b: a.bottom - r.bottom + 4 };
    ins.lie = portrait && r.width > r.height; scene.setInsets(ins);       // a phone held upright: the tray is wider than tall, so the table lies down in it
    const tr = scene.tableRect(ins), ox = a.left - d.left, oy = a.top - d.top;
    const x1 = tr.x + ox - 1, y1 = tr.y + oy - 1, x2 = tr.x + tr.w + ox + 1, y2 = tr.y + tr.h + oy + 1;
    $('#desk').style.clipPath = win ? `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${x1}px ${y1}px, ${x2}px ${y1}px, ${x2}px ${y2}px, ${x1}px ${y2}px, ${x1}px ${y1}px)` : 'none';
    let sh = $('#dkShade'); if (!sh) { sh = el('div', { id: 'dkShade' }); sg.appendChild(sh); } else if (sh.parentNode !== sg) sg.appendChild(sh);
    // the vanishing point: the middle of the table's window, at the table camera's distance
    const vx = tr.x + tr.w / 2 + ox, vy = tr.y + tr.h / 2 + oy, dk = $('#desk');
    dk.style.setProperty('--vpx', vx + 'px'); dk.style.setProperty('--vpy', vy + 'px'); dk.style.setProperty('--pd', Math.round(0.5 * Math.max(a.height, 400) / Math.tan(20 * Math.PI / 180)) + 'px');
    deskWalls();
    sh.hidden = !win; Object.assign(sh.style, { left: (tr.x + a.left - r.left) + 'px', top: (tr.y + a.top - r.top) + 'px', width: tr.w + 'px', height: tr.h + 'px' });
  }
  else if (st.screen === 'home' && wide && prefs.ui === 'lobby') scene.setInsets({ t: 92, l: 40, r: 432, b: 168 });
  else if (st.screen === 'home' && tallp) scene.setInsets({ t: 196, l: 24, r: 24, b: ($('.h-right').offsetHeight || 480) + 28 });
  else if (st.screen === 'home' && wide) scene.setInsets({ t: 40, l: 126, r: 412, b: 104 });
  else if (st.screen === 'reel') scene.setInsets({ t: H * 0.09, l: 0, r: 0, b: H * 0.09 }, true);
  else scene.setInsets(portrait ? { t: hud + 8, l: 6, r: 6, b: 112 } : { t: hud + 6, l: 66, r: 74, b: 10 });
  if (st.screen === 'play') paintPowerCue();
  setPowerUI(st.power);
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

// the sides of the raised panels: four walls each, standing from the desk up to the panel's top (only those that face the
// middle of the view show past the panel; the light comes from the upper left, so the walls facing it are lighter)
function deskWalls() {
  const dk = $('#desk'), L = parseFloat(getComputedStyle(app).getPropertyValue('--lift')) || 36;
  for (const w of dk.querySelectorAll('.dk-wall')) w.remove();
  for (const [sel, lit, dim] of [['.dk-rail', '#d9ccb2', '#a8987b'], ['.dk-slate', '#2a3433', '#0b0f0f']]) {
    const p = $(sel), x = p.offsetLeft, y = p.offsetTop, w = p.offsetWidth, h = p.offsetHeight;
    const wall = (css, tf, col) => { const d = el('div', { class: 'dk-wall' }); d.style.cssText += css + `;transform:${tf};background:${col}`; dk.insertBefore(d, dk.firstChild); };
    // (each wall hinges on the panel's edge and swings back, away from the eye, down to the desk)
    const r = 14;                                                       // keep clear of the rounded corners
    wall(`left:${x + r}px;top:${y + h}px;width:${w - 2 * r}px;height:${L}px;transform-origin:50% 0`, 'rotateX(-90deg)', dim);
    wall(`left:${x + r}px;top:${y - L}px;width:${w - 2 * r}px;height:${L}px;transform-origin:50% 100%`, 'rotateX(90deg)', lit);
    wall(`left:${x + w}px;top:${y + r}px;width:${L}px;height:${h - 2 * r}px;transform-origin:0 50%`, 'rotateY(90deg)', dim);
    wall(`left:${x - L}px;top:${y + r}px;width:${L}px;height:${h - 2 * r}px;transform-origin:100% 50%`, 'rotateY(-90deg)', lit);
  }
}
