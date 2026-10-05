/* App shell. It owns the screens, the input and the frame loop, and nothing else:
     physics.js  how balls move            game.js    rules, turns, computer player
     drills.js   practice layouts          scene.js   drawing
     audio.js    sound                     look.js    colours and designs (data)
     league.js   fixtures and tables        highlights.js, reel.js   best shot of a match and its replay
   What happens around a shot depends on what is being played, so that part lives in three small "flows"
   (match, practice, demo) with the same handful of methods. The shot pipeline below never asks which one is active. */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const app = $('#app'), canvas = $('#gl');
const TICK = 1 / 120;
const GUIDE = [['끔', '조준선 없이 감으로 칩니다'], ['짧게', '큐볼이 처음 닿는 곳까지만'], ['보통', '맞은 공과 큐볼이 꺾이는 방향까지'], ['길게', '쿠션에 튕긴 뒤와 큐볼이 굴러갈 길까지']];

/* ================= settings and saved data ================= */
const store = {
  get(k, d) { try { const v = localStorage.getItem('dp8.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('dp8.' + k, JSON.stringify(v)); } catch (e) {} },
};
// Pool table sizes. Real regulation numbers: playing surface, ball diameter, pocket openings.
const TABLES = [
  { id: 'bar', name: '당구장 7피트', short: '7피트', d: '198×99cm · 공 57mm. 공이 크게 보이고 가장 쉽습니다.', cfg: { R: 0.028575, HL: 0.99, HW: 0.495, cornerMouth: 0.114, sideMouth: 0.127 } },
  { id: 'club', name: '클럽 8피트', short: '8피트', d: '224×112cm · 공 57mm. 동호인이 많이 쓰는 중간 크기.', cfg: { R: 0.028575, HL: 1.12, HW: 0.56, cornerMouth: 0.12, sideMouth: 0.133 } },
  { id: 'pro', name: '대회 9피트', short: '9피트', d: '254×127cm · 공 57mm. 프로 대회 규격, 가장 넓고 어렵습니다.', cfg: { R: 0.028575, HL: 1.27, HW: 0.635, cornerMouth: 0.127, sideMouth: 0.14 } },
  { id: 'pub', name: '영국식 6피트', short: '6피트', d: '183×91cm · 공 51mm. 작은 공에 좁은 포켓.', cfg: { R: 0.0254, HL: 0.915, HW: 0.4575, cornerMouth: 0.089, sideMouth: 0.095 } },
];
const prefs = (() => {
  const saved = store.get('prefs', {});
  const p = Object.assign({ mode: 'eight', names: ['플레이어 1', '플레이어 2'], vsAI: false, level: 1, target: 10, table: 'bar', theme: 'light', cloth: 0, cue: 0,
    guides: null, drill: 'free', drillLv: {}, sound: true, fast: true, quality: 'auto', fps: false, edit: 'random', rule3: 3, puz: null }, saved);
  if (!Array.isArray(p.guides) || p.guides.length !== 2) { const g = typeof saved.guide === 'number' ? saved.guide : 2; p.guides = [g, g]; }   // older saves had one guide for both
  delete p.guide;
  if (!TABLES.some(t => t.id === p.table)) p.table = 'bar';
  if (!p.puz || typeof p.puz !== 'object') p.puz = { cur: 1, done: {}, best: 0 };
  if (!CLOTHS[p.cloth]) p.cloth = 0; if (!CUES[p.cue]) p.cue = 0;      // a look that has since been taken out
  if (!p.drillLv || typeof p.drillLv !== 'object') p.drillLv = {};
  return p;
})();
const savePrefs = () => store.set('prefs', prefs);

const poolCache = {};
const poolOf = id => poolCache[id] || (poolCache[id] = createPhysics(Object.assign({ pockets: true }, (TABLES.find(t => t.id === id) || TABLES[0]).cfg)));
const PH = { pool: poolOf(prefs.table), carom: createPhysics({ R: 0.03275, pockets: false }) };
const game = createGame(PH);
const drills = createDrills(), puzzles = createPuzzles();
const SND = createAudio(() => prefs.sound);
const league = createLeague();
const highlights = createHighlights();
let lg = store.get('league', null);                       // the league in progress, if any
const saveLeague = () => store.set('league', lg);
if (!game.MODES[prefs.mode]) prefs.mode = 'eight';
if (drills.byId(prefs.drill).id !== prefs.drill) prefs.drill = 'free';
let rec = store.get('rec', {});
const recOf = n => { const r = rec[n] || (rec[n] = { w: 0, l: 0, streak: 0, best: 0 }); if (!r.form) r.form = []; return r; };
const series = { key: '', s: [0, 0] };
const oppName = () => prefs.vsAI ? '컴퓨터' : prefs.names[1];

/* What is on screen and where the current shot is.
   screen: home | play | result | league | reel
   phase:  idle (nothing to do) | aim (a person is aiming) | auto (computer or demo is lining up) | strike | sim | hold */
const st = { screen: 'home', phase: 'idle', aim: 0, power: 0, spin: { x: 0, y: 0 }, cueAnim: null, auto: null, rev: 0, lastLoser: null, settle: 0, holdT: 0, afterHold: null };
let flow = null;

const scene = createScene(canvas, app, PH);
if (!scene) {
  const d = document.createElement('div'); d.id = 'nogl';
  d.textContent = '이 기기에서 3D 그래픽을 켤 수 없어 게임을 띄우지 못했습니다. 인터넷 연결을 확인한 뒤 다시 열어 주세요.';
  app.textContent = ''; app.appendChild(d); return;
}
scene.setCloth(prefs.cloth); scene.setCue(prefs.cue); scene.setQuality(prefs.quality);
function applyTheme() {
  const light = prefs.theme === 'light';
  app.dataset.theme = light ? 'light' : 'dark';
  document.body.style.background = light ? '#eef0f3' : '#101216';
  scene.setBackdrop(light ? 0xeef0f3 : 0x101216);
}
applyTheme();
// One drawing of the chosen cue, with the same sections and proportions as the 3D one (tip, ferrule, shaft, joint,
// forearm with its points, wrap, sleeve, bumper). Used by the power control and by the cue chooser.
// Drawn tip-first along the canvas's long side; `vertical` puts the tip at the top.
function drawCue(cv, d, vertical) {
  const dpr = Math.min(3, window.devicePixelRatio || 1), cw = cv.clientWidth, ch = cv.clientHeight; if (!cw || !ch) return;
  cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
  const g = cv.getContext('2d'), L = vertical ? cv.height : cv.width, T = vertical ? cv.width : cv.height;
  if (vertical) g.setTransform(0, 1, 1, 0, 0, 0);                                    // swap the axes: x runs down the cue
  const LEN = 1.47, x = m => m / LEN * L, rad = m => (0.006 + (0.0146 - 0.006) * Math.min(1, m / 1.45)) / 0.0146 * T / 2;
  const css = n => '#' + n.toString(16).padStart(6, '0');
  const seg = (m0, m1, fill) => { g.fillStyle = fill; g.beginPath(); g.moveTo(x(m0), T / 2 - rad(m0)); g.lineTo(x(m1), T / 2 - rad(m1)); g.lineTo(x(m1), T / 2 + rad(m1)); g.lineTo(x(m0), T / 2 + rad(m0)); g.fill(); };
  seg(0, 0.012, css(d.tip)); seg(0.012, 0.04, css(d.ferrule)); seg(0.04, 0.74, css(d.shaft)); seg(0.74, 0.756, css(d.joint));
  seg(0.756, 1.03, css(d.fore)); seg(1.03, 1.3, css(d.wrap)); seg(1.3, 1.45, css(d.sleeve)); seg(1.45, 1.47, '#0d0d0d');
  if (d.points != null) {                                                            // the points: long spear shapes running up the forearm
    g.save(); g.beginPath(); g.moveTo(x(0.756), T / 2 - rad(0.756)); g.lineTo(x(1.03), T / 2 - rad(1.03)); g.lineTo(x(1.03), T / 2 + rad(1.03)); g.lineTo(x(0.756), T / 2 + rad(0.756)); g.clip();
    g.fillStyle = css(d.points);
    for (const o of [-1, 0, 1]) { const w = rad(1.03) * 0.42; g.beginPath(); g.moveTo(x(1.03), T / 2 + o * rad(1.03) * 0.95 - w); g.lineTo(x(1.03), T / 2 + o * rad(1.03) * 0.95 + w); g.lineTo(x(0.79), T / 2 + o * rad(0.79) * 0.95); g.fill(); }
    g.restore();
  }
  // round it: dark edges, a soft highlight off-centre
  const sh = g.createLinearGradient(0, 0, 0, T);
  sh.addColorStop(0, 'rgba(0,0,0,.42)'); sh.addColorStop(0.3, 'rgba(255,255,255,.26)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,.46)');
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = sh; g.fillRect(0, 0, L, T); g.globalCompositeOperation = 'source-over';
}
function paintPowerCue() { drawCue($('#powerCue'), CUES[prefs.cue] || CUES[0], !scene.portrait); }

/* ================= small DOM helpers ================= */
function el(tag, attrs, kids) {
  const n = document.createElement(tag);
  if (attrs) for (const k in attrs) {
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
  $('#home').hidden = screen !== 'home'; $('#nav').hidden = screen !== 'home' && screen !== 'league'; $('#hud').hidden = screen !== 'play'; $('#result').hidden = screen !== 'result'; $('#league').hidden = screen !== 'league';
  for (const id of CONTROLS) $(id).hidden = screen !== 'play';
  $('#spinPop').hidden = true; closeSheet(); SND.rolling(0);
  if (screen !== 'play') setView3D(false);
  if (screen !== 'play') { app.classList.add('busy'); scene.setZone(null); }
  paintNav(); layout();
}
// which place on the rail is lit: the league and the records have their own, otherwise play or practice
function paintNav() { const v = st.screen === 'league' ? lgTab : prefs.mode === 'practice' || prefs.mode === 'puzzle' ? prefs.mode : 'play'; for (const b of document.querySelectorAll('#nav .nv')) b.setAttribute('aria-pressed', String(b.dataset.v === v)); }
let wide = true;
function layout() {
  const W = app.clientWidth, H = app.clientHeight; if (!W || !H) return;
  const portrait = H > W; wide = W >= 900 && H >= 560;
  app.classList.toggle('portrait', portrait); app.classList.toggle('compact', !wide);
  const hud = H <= 520 ? 50 : 60;
  scene.resize();
  if (st.screen === 'home' && wide) scene.setInsets({ t: 40, l: 126, r: 412, b: 104 });
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
  $('#powerNum').textContent = Math.round(p * 100);
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

/* ================= sheets ================= */
function openSheet(title, kids) { $('#sheetTitle').textContent = title; const b = $('#sheetBody'); b.textContent = ''; for (const k of [].concat(kids)) if (k) b.appendChild(k); $('#sheet').hidden = false; }
function closeSheet() { $('#sheet').hidden = true; }
$('#sheetX').addEventListener('click', () => { SND.tap(); closeSheet(); });
$('#sheet').addEventListener('click', e => { if (e.target === $('#sheet')) closeSheet(); });
const optBtn = (on, kids, fn) => el('button', { class: 'opt', 'aria-pressed': String(on), onclick: () => { SND.init(); SND.tap(); fn(); } }, kids);
const optText = (t, d) => el('span', null, [el('span', { class: 't', text: t }), d ? el('span', { class: 'd', text: d }) : null]);
const flatBtn = (text, fn) => el('button', { class: 'btn flat', text, onclick: () => { SND.tap(); fn(); } });
const segRow = (label, opts, cur, fn) => el('div', { class: 'field' }, [el('div', { class: 'lab', text: label }),
  el('div', { class: 'seg' }, opts.map(([v, t]) => el('button', { 'aria-pressed': String(v === cur), text: t, onclick: () => { SND.tap(); fn(v); } })))]);
const note = text => el('p', { class: 'note', text });

function sheetTable() {
  const sizes = isCarom() ? [note('3구와 4구는 포켓 없는 중대(254×127cm, 공 65.5mm)로 고정입니다.')]
    : TABLES.map(t => optBtn(prefs.table === t.id, optText(t.name, t.d), () => { prefs.table = t.id; savePrefs(); PH.pool = poolOf(t.id); paintHome(); homePreview(); sheetTable(); }));
  openSheet('테이블', [el('div', { class: 'lab', text: '크기' }), ...sizes, el('div', { class: 'lab', text: '천 색' }),
    el('div', { class: 'grid2' }, CLOTHS.map((c, i) => optBtn(prefs.cloth === i,
      [el('i', { class: 'sw', style: `--c:${hex(c.felt)};--w:${hex(c.wood)}` }), optText(c.name)], () => { prefs.cloth = i; savePrefs(); scene.setCloth(i); paintHome(); sheetTable(); })))]);
}
function sheetCue() {
  openSheet('큐 고르기', CUES.map((c, i) => optBtn(prefs.cue === i,
    [el('canvas', { class: 'cuepic' }), optText(c.name, c.note)], () => { prefs.cue = i; savePrefs(); scene.setCue(i); paintHome(); sheetCue(); })));
  document.querySelectorAll('#sheetBody .cuepic').forEach((cv, i) => drawCue(cv, CUES[i], false));
}
// one guide length per player (a handicap); a single row when only one person is aiming
function sheetGuide() {
  const solo = prefs.vsAI || (st.screen === 'home' ? prefs.mode === 'practice' || prefs.mode === 'puzzle' : flow !== match);
  const row = i => segRow(solo ? '조준선' : st.screen === 'play' ? game.players[i].name : prefs.names[i], GUIDE.map((gd, k) => [k, gd[0]]), prefs.guides[i], v => { prefs.guides[i] = v; if (solo) prefs.guides[1] = v; savePrefs(); paintHome(); scene.invalidate(); sheetGuide(); });
  openSheet('조준선 길이', [row(0), solo ? null : row(1), note(GUIDE.map(gd => gd[0] + ': ' + gd[1]).join(' · ')),
    solo ? null : note('실력 차이가 나면 잘하는 쪽을 짧게, 처음 하는 쪽을 길게 두세요.')]);
}
function sheetSettings() {
  openSheet('설정', [
    segRow('화면', [['dark', '다크'], ['light', '라이트']], prefs.theme, v => { prefs.theme = v; savePrefs(); applyTheme(); sheetSettings(); }),
    segRow('소리', [[true, '켬'], [false, '끔']], prefs.sound, v => { prefs.sound = v; savePrefs(); if (v) SND.init(); sheetSettings(); }),
    flatBtn('하이라이트 · ' + (reel.STYLES.find(x => x[0] === prefs.edit) || [0, '편집 랜덤'])[1] + ' · 노래 ' + SND.song.list.length + '곡', sheetSong),
    segRow('빠른 진행', [[true, '켬'], [false, '끔']], prefs.fast, v => { prefs.fast = v; savePrefs(); sheetSettings(); }),
    segRow('화질', [['auto', '자동'], ['high', '높음'], ['low', '낮음']], prefs.quality, v => { prefs.quality = v; savePrefs(); scene.setQuality(v); sheetSettings(); }),
    segRow('초당 프레임 표시', [[false, '끔'], [true, '켬']], prefs.fps, v => { prefs.fps = v; savePrefs(); $('#fps').hidden = !v; sheetSettings(); }),
    note('빠른 진행: 공이 느려지면 시간을 두 배로 돌려 마지막 구르기를 기다리지 않게 합니다. 화질을 낮추면 움직임이 더 부드러워집니다.'),
  ]);
}
// the best-shot reel: which edit it gets, and the songs it may use (picked from this device and kept on it)
const mmss = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
function sheetSong(busy) {
  const songs = SND.song.list, again = () => sheetSong();
  const listen = async m => { SND.init(); await SND.song.prepare(m.id); SND.song.play(2); setTimeout(() => SND.boom(), 2000); setTimeout(() => SND.song.stop(), 6000); };
  const act = (text, fn) => el('button', { text, onclick: async e => { e.stopPropagation(); SND.tap(); await fn(); } });
  openSheet('하이라이트', [
    el('div', { class: 'lab', text: '편집' }),
    el('div', { class: 'pickrow' }, [['random', '랜덤']].concat(reel.STYLES).map(([id, name]) => el('button', { text: name, 'aria-pressed': String(prefs.edit === id), onclick: () => { SND.tap(); prefs.edit = id; savePrefs(); again(); } }))),
    note(`랜덤은 ${reel.STYLES.length}가지 편집이 한 번씩 돌아가며 나옵니다. 워스트 샷은 노래 없이 ${reel.WORST.length}가지 편집이 돌아가며 나옵니다.`),
    el('div', { class: 'lab', text: `노래 ${songs.length}/${SND.song.MAX}` }),
    songs.length ? el('div', null, songs.map(m => el('div', { class: 'song' + (m.on ? ' on' : ''), onclick: async () => { SND.tap(); await SND.song.toggle(m.id); again(); } }, [
      el('span', { class: 'chk', text: '✓' }),
      el('div', { style: 'min-width:0' }, [el('div', { class: 'nm', text: m.name }), el('div', { class: 'meta', text: `드롭 ${mmss(m.drop)} · ${Math.round(m.bpm)} BPM` })]),
      el('div', { class: 'acts' }, [act('듣기', () => listen(m)), act('−0.1', async () => { await SND.song.nudge(m.id, -0.1); again(); }), act('+0.1', async () => { await SND.song.nudge(m.id, 0.1); again(); }), act('삭제', async () => { await SND.song.remove(m.id); again(); })]),
    ]))) : note('최고의 샷 다시 보기에 깔 노래를 이 기기에서 고릅니다. 노래는 기기 안에만 저장되고, 드롭 앞뒤 30초만 씁니다.'),
    busy ? note('노래를 읽는 중입니다…') : songs.length < SND.song.MAX ? flatBtn('노래 추가', () => $('#songFile').click()) : null,
    songs.length ? note('체크한 노래 중 하나가 매번 무작위로 깔립니다. "듣기"를 누르면 2초 뒤 쿵 소리와 드롭이 겹쳐야 맞는 것이고, 어긋나면 −0.1 / +0.1초로 옮기세요.') : null,
  ]);
}
$('#songFile').addEventListener('change', async e => {
  const files = Array.from(e.target.files || []); e.target.value = ''; if (!files.length) return;
  sheetSong(true);
  for (const f of files) { try { await SND.song.take(f); } catch (err) { toast(err && err.message === 'full' ? `노래는 ${SND.song.MAX}곡까지 넣을 수 있습니다.` : '이 파일은 읽을 수 없습니다. mp3나 m4a, wav 파일로 해 보세요.', 'foul', 3200); } }
  sheetSong();
});
function sheetName(i) {
  if (i === 1 && prefs.vsAI) return;
  const input = el('input', { class: 'txt', id: 'nameInput', maxlength: '10', value: prefs.names[i], 'aria-label': '이름', autocomplete: 'off' });
  const save = () => { const v = input.value.trim().slice(0, 10); if (v && v !== prefs.names[1 - i]) { prefs.names[i] = v; savePrefs(); } closeSheet(); paintHome(); };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
  openSheet(`${i + 1}번 선수 이름`, [input, note('전적은 이름별로 따로 쌓입니다. 열 글자까지.'), el('button', { class: 'btn cta', text: '저장', onclick: save })]);
  setTimeout(() => { try { input.focus(); input.select(); } catch (e) {} }, 60);
}
function sheetPause() {
  openSheet('잠깐 멈춤', [
    el('button', { class: 'btn cta', text: '이어서 하기', onclick: closeSheet }),
    el('div', { class: 'row' }, [flatBtn('조준선', sheetGuide), flatBtn('설정', sheetSettings)]),
    el('div', { class: 'row' }, [flatBtn('다시 시작', () => { closeSheet(); flow.restart(); }), flatBtn('처음으로', goHome)]),
  ]);
}

/* ================= home ================= */
const isCarom = () => prefs.mode === 'puzzle' || (game.MODES[prefs.mode] || {}).table === 'carom';
const MODE_ICON = {
  eight: () => el('span', { class: 'ball', style: '--c:#111' }, el('i', { text: '8' })),
  nine: () => el('span', { class: 'ball', style: '--c:#f2b705' }, el('i', { text: '9' })),
  four: () => el('span', { class: 'four' }, ['#d3241c', '#d3241c', '#f4c20d', '#f4efe2'].map(c => el('i', { style: '--c:' + c }))),
  three: () => el('span', { class: 'three' }, ['#d3241c', '#f4c20d', '#f4efe2'].map(c => el('i', { style: '--c:' + c }))),
  practice: () => { const s = el('span', { class: 'dart' }); s.innerHTML = '<svg width="46" height="46" viewBox="0 3 40 40"><circle cx="19" cy="23" r="17" fill="#1f2a37"/><circle cx="19" cy="23" r="14" fill="#f4efe2"/><circle cx="19" cy="23" r="10.2" fill="#e5484d"/><circle cx="19" cy="23" r="6.4" fill="#f4efe2"/><circle cx="19" cy="23" r="2.8" fill="#e5484d"/><path d="M19.6 22.4 31 11" stroke="#1f2a37" stroke-width="2.4" stroke-linecap="round"/><path d="M29.2 9.2l5.6-4.4 1.4 4-4 1.4 1.4 1.4-4 1.4z" fill="#2f6bff" stroke="#1f2a37" stroke-width="1.2" stroke-linejoin="round"/></svg>'; return s; },
};
function check() {
  const s = el('span', { class: 'ck' });
  s.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  return s;
}
// The kind of game is one card filling the panel's width. Tapping it opens the choices; choosing one closes them again.
let modeOpen = false;
function buildModes() {
  const box = $('#modeList'); box.textContent = ''; box.classList.toggle('open', modeOpen);
  const cur = game.MODES[prefs.mode] && prefs.mode !== 'practice' ? prefs.mode : 'eight';
  for (const id of modeOpen ? ['eight', 'nine', 'three', 'four'] : [cur]) {
    const m = game.MODES[id], chev = el('span', { class: 'chev' });
    chev.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>';
    box.appendChild(el('button', { class: 'gcard', 'aria-pressed': String(cur === id), onclick: () => {
      SND.init(); SND.tap();
      if (!modeOpen) modeOpen = true;
      else { modeOpen = false; if (prefs.mode !== id) { prefs.mode = id; savePrefs(); homePreview(); } }
      buildModes(); paintHome();
    } }, [el('span', { class: 'ic' }, MODE_ICON[id]()), el('span', null, [el('span', { class: 'nm', text: m.name }), el('span', { class: 'bl', text: m.blurb })]), check(), chev]));
  }
}
function recText(n) { const r = rec[n]; if (!r || (!r.w && !r.l)) return '첫 판'; return `${r.w}승 ${r.l}패` + (r.streak >= 2 ? ` · ${r.streak}연승 중` : ''); }
const levelOf = id => Math.max(1, Math.min(drills.LEVELS, prefs.drillLv[id] || 1));
// lessons, grouped the way a course list is: what you learn first at the top
const COURSES = [['기본기', ['straight', 'cut', 'thin', 'side']], ['큐볼 다루기', ['stop', 'follow', 'draw', 'spin', 'position']], ['응용', ['bank', 'break']], ['자유롭게', ['free']]];
function paintHome() {
  const prac = prefs.mode === 'practice', puz = prefs.mode === 'puzzle';
  $('#vsBox').hidden = prac || puz; $('#pracList').hidden = !prac; $('#puzBox').hidden = !puz; $('#modeBox').hidden = prac || puz;
  $('#rightLab').textContent = prac ? '레슨' : puz ? '퍼즐' : '대결'; $('#startBtn').textContent = prac ? '레슨 시작' : puz ? '퍼즐 풀기' : '시작';
  paintNav();
  if (prac) {
    // each lesson a row with how far it has been taken; a lesson is finished at its top level
    const box = $('#pracList'), top = box.scrollTop; box.textContent = '';
    for (const [title, ids] of COURSES) {
      box.appendChild(el('div', { class: 'lab', text: title }));
      for (const id of ids) {
        const d = drills.byId(id), lv = levelOf(id), frac = d.make ? (lv - 1) / (drills.LEVELS - 1) : 0;
        box.appendChild(optBtn(prefs.drill === id, [el('span', { class: 'ls' }, [el('span', { class: 't', text: d.name }), el('span', { class: 'd', text: d.d }),
          d.make ? el('span', { class: 'prog' }, el('i', { style: `--w:${Math.round(frac * 100)}%` })) : null]), d.make ? el('span', { class: 'lv', text: `${lv}/${drills.LEVELS}` }) : null],
          () => { prefs.drill = id; savePrefs(); paintHome(); homePreview(); }));
      }
    }
    box.scrollTop = top;
  }
  if (puz) {
    // how many are solved, then every puzzle as a numbered tile under the name of its kind
    const box = $('#puzBox'), top = box.scrollTop, z = prefs.puz, n = puzzles.list.filter(q => z.done[q.id]).length; box.textContent = '';
    box.appendChild(el('div', { class: 'pzsum' }, [el('div', null, [el('b', { text: `${n}` }), el('span', { text: ` / ${puzzles.list.length}` }), el('small', { text: '푼 퍼즐' })]), el('div', null, [el('b', { text: `${z.best || 0}` }), el('small', { text: '최고 연속' })])]));
    box.appendChild(el('div', { class: 'pzkind' }, [el('span', { class: 'on', text: '4구' }), el('span', { text: '3구 · 준비 중' }), el('span', { text: '8볼 · 준비 중' })]));
    puzzles.TIERS.forEach((name, t) => {
      box.appendChild(el('div', { class: 'lab', text: name }));
      box.appendChild(el('div', { class: 'pzgrid' }, puzzles.list.filter(q => q.tier === t).map(q => el('button', { class: 'pz' + (z.done[q.id] ? ' done' : ''), 'aria-pressed': String(z.cur === q.id), text: z.done[q.id] ? '✓' : String(q.id),
        onclick: () => { SND.init(); SND.tap(); z.cur = q.id; savePrefs(); paintHome(); homePreview(); } }))));
    });
    box.scrollTop = top;
  }
  $('#pc0 .nm').textContent = prefs.names[0]; $('#pc0 .rc').textContent = recText(prefs.names[0]);
  $('#pc1 .nm').textContent = oppName(); $('#pc1 .rc').textContent = prefs.vsAI ? LEVELS[prefs.level] + ' 난이도' : recText(prefs.names[1]);
  $('#segLvl').hidden = !prefs.vsAI; $('#segTarget').hidden = !isCarom(); $('#segRule3').hidden = prefs.mode !== 'three';
  $('#clothSw').style.setProperty('--c', hex(CLOTHS[prefs.cloth].felt));
  $('#tableVal').textContent = (isCarom() ? '중대' : TABLES.find(t => t.id === prefs.table).short) + ' · ' + CLOTHS[prefs.cloth].name;
  $('#cueVal').textContent = CUES[prefs.cue].name;
  const gs = prefs.guides; $('#guideVal').textContent = gs[0] === gs[1] || prefs.vsAI || prac ? GUIDE[gs[0]][0] : GUIDE[gs[0]][0] + ' · ' + GUIDE[gs[1]][0];
}
// The table behind the home screen: the chosen game racked up, or the chosen drill being played over and over
// (a new layout each time, which is also what the drill itself does).
function homePreview() {
  PH.pool = poolOf(prefs.table); scene.clearFalls(); scene.setZone(null);
  st.phase = 'idle'; st.auto = null; st.cueAnim = null; st.power = 0; st.spin = { x: 0, y: 0 }; st.aim = 0;
  const d = drills.byId(prefs.drill);
  if (prefs.mode === 'puzzle') { flow = null; game.start('puzzle4', [prefs.names[0], ''], false, {}); scene.setTable(game.P); puzzle.put(puzzles.byId(prefs.puz.cur) || puzzles.list[0]); return; }
  if (prefs.mode === 'practice' && d.make) {
    game.start('practice', [prefs.names[0], ''], false, {}); scene.setTable(game.P);
    const L = drills.make(d.id, game.P, levelOf(d.id), Math.random, game.vOf);
    if (L) { flow = null; putLayout(L); scene.setZone(L.zone); playDemo(L.demo, { quiet: true, after: homePreview }); return; }
  }
  flow = null;
  game.start(game.MODES[prefs.mode] && prefs.mode !== 'practice' ? prefs.mode : 'eight', [prefs.names[0], oppName()], false, {});
  scene.setTable(game.P); st.rev++; scene.invalidate();
}
function goHome() {
  store.set('save', null);
  show('home'); buildModes(); paintHome(); homePreview();
}

/* ================= shot pipeline (the same for every flow) ================= */
function beginTurn(first) {
  st.phase = 'aim'; st.power = 0; st.spin = { x: 0, y: 0 }; setPowerUI(0); setSpinUI(); $('#spinPop').hidden = true;
  const auto = flow.auto();
  if (auto) { st.phase = 'auto'; st.auto = { t: 0, plan: null, from: st.aim, src: auto }; }
  else if (!first || game.mode.table === 'carom') {
    const c = game.cueBall(); let best = null, bd = 1e9;
    for (const id of game.legal()) { const b = game.world.balls[id], d = Math.hypot(b.x - c.x, b.y - c.y); if (d < bd) { bd = d; best = b; } }
    if (best) st.aim = Math.atan2(best.y - c.y, best.x - c.x);
  }
  flow.hud(); scene.invalidate(); snapshot();
}
function shoot(V, a, b) {
  flow.beforeShot(V, a, b); game.beginShot();
  st.phase = 'strike'; $('#spinPop').hidden = true;
  st.cueAnim = { t: 0, from: 0.03 + st.power * 0.2, V, a, b };
  flow.hud();
}
function endShot() { st.rev++; flow.afterShot(); }
function hold(seconds, then) { st.phase = 'hold'; st.holdT = seconds; st.afterHold = then; flow.hud(); }

// The computer and the demo line up a shot the same way: wait, decide, swing the cue round, pull back, shoot.
// plan: { angle, V, a, b, pos? }
function autoTick(dt) {
  const a = st.auto; a.t += dt;
  if (!a.plan) {
    if (a.t < a.src.think) return;
    a.plan = a.src.plan(); a.t0 = a.t; a.pw = Math.min(1, game.powerOf(a.plan.V));
    if (a.plan.pos) { const c = game.cueBall(); c.x = c.px = a.plan.pos[0]; c.y = c.py = a.plan.pos[1]; game.placing = null; }
    let d = a.plan.angle - a.from; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; a.delta = d;
    if (a.src.showSpin) { st.spin = { x: a.plan.a / 0.5, y: a.plan.b / 0.5 }; setSpinUI(); }
    return;
  }
  const t = a.t - a.t0, e = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
  st.aim = a.from + a.delta * e(t / 0.75);
  st.power = a.pw * e((t - 0.85) / 0.45); setPowerUI(st.power);
  if (t > 1.45) { st.aim = a.plan.angle; st.auto = null; shoot(a.plan.V, a.plan.a, a.plan.b); }
}

/* ================= scoreboard ================= */
function paintPill(i, s) {
  const box = $('#p' + i), tray = box.querySelector('.tray');
  box.classList.toggle('on', !!s.on);
  box.querySelector('.nm').textContent = s.name;
  box.querySelector('.sub').textContent = s.sub;
  box.querySelector('.pts').textContent = s.pts == null ? '' : s.pts;
  tray.textContent = '';
  for (const t of s.tray || []) tray.appendChild(t === 'slot' ? el('i', { class: 'mb slot' }) : t === 'eight' ? el('i', { class: 'mb e8' }) : ballChip(t));
}
function paintBadge(name, b) {
  const badge = $('#badge'); badge.textContent = '';
  badge.appendChild(el('b', { text: name })); badge.appendChild(document.createTextNode(b.text));
  for (const id of b.balls || []) badge.appendChild(ballChip(id, id === b.mark ? 'box-shadow:0 0 0 2px #ffd21f' : 'opacity:.55'));
}
const setBusy = () => app.classList.toggle('busy', !(st.screen === 'play' && st.phase === 'aim'));

// A small top view of one shot: the table, where the balls stood, and the lines the cue ball and the ball that mattered drew.
function drawShot(cv, shot) {
  const dpr = Math.min(3, window.devicePixelRatio || 1), cw = cv.clientWidth, ch = cv.clientHeight; if (!cw || !ch) return;
  cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
  const g = cv.getContext('2d'), P = game.P, pad = 5 * dpr, k = Math.min((cv.width - 2 * pad) / (2 * P.HL), (cv.height - 2 * pad) / (2 * P.HW));
  const X = x => cv.width / 2 + x * k, Y = y => cv.height / 2 - y * k, carom = game.mode.table === 'carom';
  const colOf = i => carom ? ['#ffffff', '#ffd23c', '#ff4d43', '#ff4d43'][i] : i === shot.snap.cue ? '#ffffff' : ballCss(i);
  g.fillStyle = hex(CLOTHS[prefs.cloth].felt); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2 * dpr;
  g.beginPath(); g.rect(X(-P.HL), Y(P.HW), 2 * P.HL * k, 2 * P.HW * k); g.fill(); g.stroke();
  g.fillStyle = '#0b0b0d'; for (const p of P.POCKETS) { g.beginPath(); g.arc(X(p.x), Y(p.y), p.r * k * 0.8, 0, 6.3); g.fill(); }
  let tape = null; try { tape = highlights.record(P, shot.snap.balls.length, shot); } catch (e) {}
  const key = shot.kind ? shot.ball : shot.key >= 0 ? shot.key : shot.snap.cue;
  if (tape) for (const id of [shot.snap.cue, key]) {
    const pts = highlights.path(tape, id); if (!pts) continue;
    g.beginPath(); for (let i = 0; i < pts.length; i += 3) { if (i) g.lineTo(X(pts[i]), Y(pts[i + 1])); else g.moveTo(X(pts[i]), Y(pts[i + 1])); }
    g.lineJoin = g.lineCap = 'round'; g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 3.4 * dpr; g.stroke(); g.strokeStyle = colOf(id); g.lineWidth = 1.8 * dpr; g.stroke();
    if (id === shot.snap.cue && id === key) break;
  }
  shot.snap.balls.forEach((b, i) => { if (!b[2]) return; g.beginPath(); g.arc(X(b[0]), Y(b[1]), Math.max(2.2 * dpr, P.R * k), 0, 6.3); g.fillStyle = colOf(i); g.fill(); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = dpr; g.stroke(); });
}

/* ================= flow: a match between two players (or one and the computer) ================= */
const match = {
  quiet: false, save: true,
  ctx: null,                                              // who is playing what; fix: the league game this is, if any
  pending: null, best: null, worst: null, shots: [], count: 0,                              // the shot in progress, and the best one of the match so far
  start(first, ctx) {
    PH.pool = poolOf(prefs.table); scene.clearFalls();
    const c = match.ctx = ctx || { names: [prefs.names[0], oppName()], mode: prefs.mode, ai: prefs.vsAI, target: prefs.target, fix: null };
    const key = c.names.join('\u0001') + c.mode;
    if (series.key !== key) { series.key = key; series.s = [0, 0]; }
    game.start(c.mode, c.names, c.ai, { level: prefs.level, target: c.target, first: first || 0, cushions: prefs.rule3 }); match.best = null; match.worst = null; match.shots = []; match.count = 0;
    st.aim = 0; match.enter(); toast(game.mode.intro(game), '', 3600);
  },
  enter() { flow = match; $('#pracBar').hidden = true; $('#p1').hidden = false; scene.setTable(game.P); st.rev++; show('play'); beginTurn(true); },
  restart() { match.start(game.turn, match.ctx); },
  guide: () => prefs.guides[game.turn],
  auto: () => game.players[game.turn].ai ? { think: 0.5, showSpin: true, plan() { const p = game.aiPlan(); return { angle: p.angle, V: p.V, a: p.a || 0, b: p.b || 0, pos: p.pos }; } } : null,
  beforeShot(V, a, b) { match.pending = { snap: highlights.snapshot(game.world), aim: st.aim, V, a, b, turn: game.turn, isBreak: game.isBreak, who: game.players[game.turn].name }; },
  afterShot() {
    const shot = match.pending, ev = game.world.ev, out = game.resolve();
    if (shot) {
      const r = highlights.rate(game.P, game.mode, shot, ev, out.r), bad = highlights.rateWorst(game.P, game.mode, shot, ev, out.r);
      const n = ++match.count;
      if (r.score > (match.best ? match.best.score : 0)) match.best = Object.assign({}, shot, r, { n, good: true });
      if (bad.score > (match.worst ? match.worst.score : 0)) match.worst = Object.assign({}, shot, bad, { n, good: false });
      // shots worth a second look are kept for the highlights at the end (a few of each, the strongest)
      const keep = (x, good) => { match.shots.push(Object.assign({}, shot, x, { n, good })); const same = match.shots.filter(q => q.good === good).sort((p, q) => q.score - p.score); if (same.length > 3) match.shots.splice(match.shots.indexOf(same[3]), 1); };
      if (r.score >= 20) keep(r, true);
      if (bad.score >= 20) keep(bad, false);
    }
    if (game.over) return match.finish();
    toast(out.msg, out.kind, out.dur); beginTurn(false);
  },
  hud() {
    const m = game.mode;
    for (let i = 0; i < 2; i++) paintPill(i, Object.assign({ name: game.players[i].name, on: game.turn === i }, m.status(game, i)));
    paintBadge(m.name, m.badge(game)); setBusy();
  },
  finish() {
    const w = game.over.winner, l = 1 - w, pw = game.players[w], pl = game.players[l];
    const rw = recOf(pw.name), rl = recOf(pl.name);
    rw.w++; rw.streak++; rw.best = Math.max(rw.best, rw.streak); rl.l++; rl.streak = 0;
    rw.form = rw.form.concat('W').slice(-5); rl.form = rl.form.concat('L').slice(-5); store.set('rec', rec);
    const fix = match.ctx ? match.ctx.fix : null, target = !!game.mode.target;
    if (fix != null && lg && lg.fx[fix]) { league.record(lg, fix, w, target ? game.players[0].score : w === 0 ? 1 : 0, target ? game.players[1].score : w === 1 ? 1 : 0); saveLeague(); }
    $('#againBtn').textContent = fix != null ? '리그로' : '한 판 더';
    series.s[w]++; st.lastLoser = l; store.set('save', null); st.phase = 'idle';
    // Everything stays on the side it was on during the game: player 1 on the left, player 2 on the right, whoever won.
    $('#rTitle').textContent = pw.name + ' 승리';
    for (let i = 0; i < 2; i++) {
      const p = game.players[i], r = recOf(p.name), box = $('#rP' + i), won = i === w;
      box.classList.toggle('won', won);
      box.querySelector('.nm').textContent = p.name;
      box.querySelector('.rc').textContent = `${r.w}승 ${r.l}패` + (won && r.streak >= 2 ? ` · ${r.streak}연승 중` : '');
    }
    const sc = $('#rScore'); sc.textContent = ''; sc.append(el(w === 0 ? 'b' : 'span', { text: series.s[0] }), ' : ', el(w === 1 ? 'b' : 'span', { text: series.s[1] }));
    const P0 = game.players[0], P1 = game.players[1], pct = p => p.shots ? Math.round(p.made / p.shots * 100) + '%' : '0%';
    const rows = [['샷 성공률', pct(P0), pct(P1)], ['연속 성공', P0.best, P1.best], [game.mode.target ? '점수' : '친 횟수', game.mode.target ? P0.score : P0.shots, game.mode.target ? P1.score : P1.shots], ['파울', P0.fouls, P1.fouls]];
    const box = $('#rStats'); box.textContent = '';
    for (const [k, a, b] of rows) {
      const na = parseFloat(a) || 0, nb = parseFloat(b) || 0, sum = na + nb || 1;
      box.appendChild(el('div', { class: 'srow' }, [el('b', { text: a }), el('span', { class: 'bar l' }, el('i', { style: `--w:${Math.round(na / sum * 100)}%` })), el('span', { class: 'k', text: k }),
        el('span', { class: 'bar r' }, el('i', { style: `--w:${Math.round(nb / sum * 100)}%` })), el('span', { class: 'n', text: b })]));
    }
    // Highlights: the shots of the match worth watching again, in the order they were played, each a card with its name.
    // Exactly one is the best shot and one the worst.
    const list = match.shots.slice(), has = x => x && list.some(q => q.n === x.n && q.good === x.good);
    const isBest = q => match.best && q.good && q.n === match.best.n, isWorst = q => match.worst && !q.good && q.n === match.worst.n;
    if (match.best && !has(match.best)) list.push(match.best);
    if (match.worst && !has(match.worst)) list.push(match.worst);
    // at most six: the best and the worst always, then the strongest of the rest
    const rank = q => (isBest(q) || isWorst(q) ? 1000 : 0) + q.score; list.sort((p, q) => rank(q) - rank(p)); list.length = Math.min(6, list.length);
    list.sort((p, q) => p.n - q.n || (p.good ? -1 : 1));
    const hl = $('#rHl'); hl.textContent = ''; $('#rHlBox').hidden = !list.length; let b1 = false, w1 = false; const pics = [];
    for (const q of list) {
      const best = !b1 && isBest(q), worst = !w1 && isWorst(q); if (best) b1 = true; if (worst) w1 = true;
      const cv = el('canvas', { class: 'pic' }); pics.push([cv, q]);
      hl.appendChild(el('button', { class: 'hcard' + (best ? ' best' : worst ? ' worst' : q.good ? '' : ' bad') + (q.turn === 1 ? ' two' : ''), onclick: () => { SND.init(); SND.tap(); playShot(q, best || worst ? undefined : 'plain'); } }, [
        el('span', { class: 'tx' }, [el('span', { class: 'tag', text: q.tag }), el('span', { class: 'when', text: q.n ? q.n + '번째 샷' : '' }), el('span', { class: 'who' }, [el('i', { class: 'av', text: q.turn + 1 }), el('b', { text: q.who })])]),
        cv, best ? el('span', { class: 'rib', text: 'BEST' }) : worst ? el('span', { class: 'rib', text: 'WORST' }) : null, el('span', { class: 'go', text: '▶' })]));
    }
    $('#rWhy').textContent = game.over.why;
    show('result'); SND.win();
    for (const [cv, q] of pics) drawShot(cv, q);
  },
};

/* ================= flow: practice (free table, or a drill that checks each shot) ================= */
// put a drill layout on the table
function putLayout(L) {
  const P = game.P, w = game.world;
  game.MODES.practice.setup(game, Math.random); scene.clearFalls();
  if (L.rack) { game.MODES.eight.setup(game, Math.random); game.placing = null; st.aim = 0; }
  else {
    P.place(w, 0, L.cue[0], L.cue[1], Math.random);
    for (const [id, x, y] of L.balls) P.place(w, id, x, y, Math.random);
    st.aim = L.aim;
  }
  st.rev++; scene.invalidate();
}
const practice = {
  quiet: false, save: false,
  drill: null, level: 1, streak: 0, tries: 0, ok: 0, layout: null, before: null, beforeAim: 0, edit: false,
  start(id) {
    PH.pool = poolOf(prefs.table);
    if (id) { prefs.drill = id; savePrefs(); }
    const p = practice; p.drill = drills.byId(prefs.drill); p.level = levelOf(p.drill.id); p.streak = 0; p.tries = 0; p.ok = 0; p.edit = false; p.before = null;
    game.start('practice', [prefs.names[0], ''], false, {});
    flow = practice; scene.setTable(game.P); show('play'); p.bar();
    if (p.drill.make) p.fresh();
    else { game.MODES.eight.setup(game, Math.random); game.placing = null; game.isBreak = false; scene.clearFalls(); st.aim = 0; st.rev++; beginTurn(true); }
    toast(p.drill.tip || '규칙 없이 자유롭게 칩니다. "옮기기"를 켜면 공을 끌어 옮길 수 있습니다.', '', 5200);
  },
  restart() { practice.start(); },
  fresh() { const p = practice; p.layout = drills.make(p.drill.id, game.P, p.level, Math.random, game.vOf) || p.layout; p.again(); },   // a new layout
  again() { const p = practice; flow = practice; putLayout(p.layout); scene.setZone(p.layout.zone); beginTurn(true); },       // the same layout once more
  guide: () => prefs.guides[0],
  auto: () => null,
  beforeShot() { practice.before = game.world.balls.map(b => [b.x, b.y, b.on]); practice.beforeAim = st.aim; },
  afterShot() {
    const p = practice;
    if (!p.drill.make) { game.resolve(); return beginTurn(false); }
    const why = drills.judge(p.layout, game.world.ev, game.world.balls[0]);
    game.resolve(); p.tries++;
    if (why) { p.streak = 0; toast('실패 · ' + why, 'foul', 1900); SND.bad(); return hold(1.7, p.again); }           // same layout until it goes in
    p.ok++; p.streak++;
    let msg = '성공!';
    if (p.streak >= 3 && p.level < drills.LEVELS) { p.level++; p.streak = 0; prefs.drillLv[p.drill.id] = p.level; savePrefs(); p.bar(); msg = `성공! 이제 ${p.level}단계`; }
    else if (p.level < drills.LEVELS) msg = `성공! 다음 단계까지 ${3 - p.streak}번`;
    toast(msg, 'good', 1700); SND.good(); hold(1.4, p.fresh);
  },
  hud() {
    const p = practice;
    paintPill(0, { name: p.drill.name, on: true, sub: p.drill.make ? `${p.level}단계 · 성공 ${p.ok}/${p.tries}` : '규칙 없음', tray: [], pts: null });
    paintBadge('레슨', { text: p.drill.make ? p.drill.d : '자유롭게' }); setBusy();
  },
  // the row of buttons where the second player's panel would be
  bar() {
    const p = practice, box = $('#pracBar'); box.textContent = ''; box.hidden = false; $('#p1').hidden = true;
    const btn = (text, fn, on) => box.appendChild(el('button', { class: 'btn', text, 'aria-pressed': String(!!on), onclick: () => { SND.tap(); fn(); } }));
    const aiming = fn => () => { if (flow === practice && st.phase === 'aim') fn(); };
    if (!p.drill.make) {
      btn('되돌리기', p.undo);
      btn('옮기기', () => { p.edit = !p.edit; p.bar(); if (p.edit) toast('공을 끌어 옮깁니다. 테이블 밖으로 끌면 빠집니다.', '', 2600); }, p.edit);
      btn('공 놓기', p.sheetRack);
    } else {
      btn('시범', aiming(() => { toast('시범: 이렇게 치면 됩니다.', '', 2200); playDemo(p.layout.demo, { quiet: false, after: p.again }); }));
      btn('힌트', () => toast(p.drill.tip + ' (' + drills.hint(p.layout.demo) + ')', '', 5200));
      btn('새 배치', aiming(p.fresh));
      btn(p.level + '단계', p.sheetLevel);
    }
  },
  undo() {
    const p = practice;
    if (st.phase !== 'aim' || !p.before) return toast('되돌릴 샷이 없습니다.', '', 1400);
    p.before.forEach((s, i) => { const b = game.world.balls[i]; b.x = b.px = s[0]; b.y = b.py = s[1]; b.on = s[2]; b.vx = b.vy = b.wx = b.wy = b.wz = 0; });
    st.aim = p.beforeAim; st.rev++; flow.hud(); scene.invalidate();
  },
  sheetLevel() {
    const p = practice, i = drills.list.indexOf(p.drill), next = drills.list[i + 1 < drills.list.length ? i + 1 : 1];
    const levels = []; for (let k = 1; k <= drills.LEVELS; k++) levels.push([k, k + '단계']);
    openSheet(p.drill.name, [
      segRow('단계', levels, p.level, v => { p.level = v; p.streak = 0; prefs.drillLv[p.drill.id] = v; savePrefs(); closeSheet(); p.bar(); if (flow === practice && st.phase === 'aim') p.fresh(); }),
      note('세 번 잇따라 성공하면 다음 단계로 올라갑니다. 단계가 오르면 거리가 멀어지고 각도가 커지고 원이 작아집니다. 배치는 성공할 때마다 바뀝니다.'),
      flatBtn(`다음 훈련: ${next.name}`, () => practice.start(next.id)),
    ]);
  },
  sheetRack() {
    const P = game.P, w = game.world, done = () => { closeSheet(); st.rev++; flow.hud(); scene.invalidate(); };
    const clear = () => { for (let i = 1; i < 16; i++) { w.balls[i].on = false; w.balls[i].x = w.balls[i].px = 9 + i; } };
    openSheet('공 놓기', [
      flatBtn('8볼 모양으로 15개', () => { game.MODES.eight.setup(game, Math.random); game.placing = null; game.isBreak = false; done(); }),
      flatBtn('9볼 모양으로 9개', () => { clear(); game.MODES.nine.setup({ P, world: w }, Math.random); done(); }),
      flatBtn('공 하나 더 놓기', () => {
        const b = w.balls.find(x => x.id > 0 && !x.on); if (!b) return toast('공 15개가 모두 올라와 있습니다.', '', 1600);
        const [x, y] = P.findFree(w, P.HL * 0.3, 0, b.id); P.place(w, b.id, x, y, Math.random); done();
      }),
      flatBtn('큐볼만 남기고 치우기', () => { clear(); done(); }),
      note('놓은 뒤 "옮기기"를 켜고 원하는 자리로 끌어 옮기세요.'),
    ]);
  },
};

/* ================= flow: puzzle (one position, one shot to score with; solve it and the next one comes) ================= */
const puzzle = {
  quiet: false, save: false, cur: null, helped: false, streak: 0,
  // the balls and barricades of a puzzle, onto the table
  put(z) {
    const P = game.P, w = game.world;
    z.balls.forEach((b, i) => P.place(w, i, b[0], b[1], Math.random));
    w.walls = z.walls.length ? z.walls.map(q => P.wall(q[0], q[1], q[2], q[3])) : null; w.cue = 0;
    scene.clearFalls(); scene.setZone(null); st.aim = Math.atan2(z.balls[2][1] - z.balls[0][1], z.balls[2][0] - z.balls[0][0]); st.rev++; scene.invalidate();
  },
  start(id) {
    const z = puzzles.byId(id || prefs.puz.cur) || puzzles.list[0], p = puzzle;
    if (!p.cur || p.cur.id !== z.id) p.helped = false;
    p.cur = z; prefs.puz.cur = z.id; savePrefs();
    game.start('puzzle4', [prefs.names[0], ''], false, {});
    flow = puzzle; scene.setTable(game.P); show('play'); p.bar(); p.again();
    toast(`퍼즐 ${z.id} · ${puzzles.TIERS[z.tier]}. 한 번에 빨간 공 두 개를 맞히세요. 노란 공은 건드리면 안 됩니다.`, '', 4200);
  },
  restart() { puzzle.start(); },
  again() { flow = puzzle; puzzle.put(puzzle.cur); beginTurn(true); },
  // the next one not yet solved after this (or simply the next, when all are)
  step(dir) {
    const L = puzzles.list, i = L.indexOf(puzzle.cur); let k = i;
    for (let n = 0; n < L.length; n++) { k = (k + dir + L.length) % L.length; if (!prefs.puz.done[L[k].id]) break; }
    if (k === i) k = (i + dir + L.length) % L.length;
    puzzle.start(L[k].id);
  },
  guide: () => prefs.guides[0],
  auto: () => null,
  beforeShot() {},
  afterShot() {
    const p = puzzle, z = p.cur, r = game.resolve().r;
    if (!r.solved) { p.streak = 0; toast('다시 · ' + r.note, 'foul', 1900); SND.bad(); return hold(1.6, p.again); }
    const first = !prefs.puz.done[z.id]; prefs.puz.done[z.id] = 1;
    if (!p.helped && first) { p.streak++; prefs.puz.best = Math.max(prefs.puz.best || 0, p.streak); }
    savePrefs();
    const all = puzzles.list.every(q => prefs.puz.done[q.id]);
    toast(all && first ? '정답! 퍼즐을 모두 풀었습니다.' : p.helped ? '정답!' : `정답! 연속 ${p.streak}`, 'good', 1900); SND.good();
    hold(1.8, () => p.step(1));
  },
  hud() {
    const p = puzzle, z = p.cur, n = puzzles.list.filter(q => prefs.puz.done[q.id]).length;
    paintPill(0, { name: `퍼즐 ${z.id}`, on: true, sub: `${puzzles.TIERS[z.tier]} · 연속 ${p.streak}`, tray: [], pts: null });
    paintBadge('4구 퍼즐', { text: `푼 퍼즐 ${n}/${puzzles.list.length}` }); setBusy();
  },
  bar() {
    const p = puzzle, box = $('#pracBar'); box.textContent = ''; box.hidden = false; $('#p1').hidden = true;
    const btn = (text, fn) => box.appendChild(el('button', { class: 'btn', text, onclick: () => { SND.tap(); fn(); } }));
    const aiming = fn => () => { if (flow === puzzle && st.phase === 'aim') fn(); };
    // a hint rings the red to go for first and says how many cushions the answer uses; the answer is played out in full
    btn('힌트', aiming(() => { const z = p.cur, b = z.balls[z.first]; p.helped = true; scene.setZone({ x: b[0], y: b[1], r: game.P.R * 2.1 }); toast(`힌트: 동그라미 친 공부터${z.cush ? `, 쿠션을 ${z.cush}번 거쳐 다음 공으로` : ' 맞히고 다음 공으로'}.`, '', 4200); }));
    btn('정답', aiming(() => { const z = p.cur; p.helped = true; toast('정답: 이렇게 치면 됩니다.', '', 2200); playDemo({ angle: z.sol[0], power: game.powerOf(z.sol[1]), a: 0, b: 0 }, { quiet: false, after: p.again }); }));
    btn('이전', aiming(() => p.step(-1)));
    btn('다음', aiming(() => p.step(1)));
  },
};

/* ================= flow: demo (plays one given shot, then hands back) ================= */
// shot: { angle, power, a, b }.  opts.after: what to do once the balls have stopped and been looked at.
function playDemo(shot, opts) {
  const back = flow;
  flow = {
    quiet: !!opts.quiet, save: false,
    restart() { (back || practice).restart(); },
    guide: () => 3,
    auto: () => ({ think: 0.7, showSpin: true, plan: () => ({ angle: shot.angle, V: game.vOf(shot.power), a: shot.a, b: shot.b }) }),
    beforeShot() {},
    afterShot() { hold(1.3, opts.after); },
    hud() { if (back) back.hud(); setBusy(); },
  };
  beginTurn(true);
}

/* ================= league and records (laid out like a football league table) ================= */
let lgTab = 'league', lgDraft = null;
const cell = (cls, text) => el('span', { class: cls, text: String(text) });
const formChips = form => el('span', { class: 'form fc' }, (form || []).map(f => el('i', { class: f === 'W' ? 'w' : 'l', text: f === 'W' ? '승' : '패' })));
// head: [[label, class]], rows: arrays of cells (text, or a ready element)
function leagueTable(cols, head, rows, topCount) {
  const mk = (cells, cls) => el('div', { class: 'ltr ' + cls, style: '--cols:' + cols }, cells.map((c, k) => c instanceof Node ? c : cell(head[k][1], c)));
  return el('div', { class: 'lt' }, [mk(head.map(h => h[0]), 'hd')].concat(rows.map((r, k) => mk(r, k < (topCount || 0) ? 'top' : ''))));
}
function showLeague() { show('league'); st.phase = 'idle'; flow = null; paintLeague(); $('#league').scrollTop = 0; }
function paintLeague() {
  $('#lgTitle').textContent = lgTab === 'all' ? '전적' : '리그'; paintNav();
  const body = $('#lgBody'); body.textContent = '';
  const add = (...kids) => { for (const k of kids) if (k) body.appendChild(k); };
  if (lgTab === 'all') {
    const names = Object.keys(rec).filter(n => rec[n].w || rec[n].l).sort((a, b) => rec[b].w - rec[a].w || rec[a].l - rec[b].l);
    if (!names.length) return add(note('아직 끝난 판이 없습니다. 한 판 끝나면 이름별로 기록이 쌓입니다.'));
    add(leagueTable('30px minmax(0,1fr) 44px 44px 44px 56px 124px 52px',
      [['', 'pos'], ['이름', 'nm'], ['경기', 'n'], ['승', 'n'], ['패', 'n'], ['승률', 'n'], ['최근 5경기', 'fc'], ['연승', 'n xs']],
      names.map((n, k) => { const r = recOf(n); return [k + 1, n, r.w + r.l, r.w, r.l, Math.round(r.w / (r.w + r.l) * 100) + '%', formChips(r.form), r.best]; }), 1),
      flatBtn('전적 모두 지우기', () => { rec = {}; store.set('rec', rec); series.key = ''; paintLeague(); }));
    return;
  }
  // The league is not built yet: this shows what it will look like, with made-up names and numbers.
  add(el('div', { class: 'champ panel' }, [el('span', { class: 'k', text: '예시 화면' }), el('b', { text: '브론즈 리그 · 1주차' }), el('span', { class: 'k', text: '준비 중' })]));
  const demo = [['한결', 9, 8, 1], ['서윤', 9, 7, 2], [prefs.names[0], 8, 6, 2], ['도현', 9, 5, 4], ['지안', 8, 4, 4], ['민재', 9, 3, 6], ['하린', 8, 2, 6], ['태오', 8, 1, 7]];
  add(leagueTable('30px minmax(0,1fr) 44px 44px 44px 52px',
    [['', 'pos'], ['이름', 'nm'], ['경기', 'n'], ['승', 'n'], ['패', 'n'], ['승점', 'n pts']],
    demo.map((r, k) => [k + 1, r[0], r[1], r[2], r[3], r[2] * league.WIN_PTS]), 3));
  add(note('위 표는 실제 기록이 아닌 예시입니다. 위에서 세 명은 다음 리그로 올라가는 자리입니다. 진짜 리그는 나중에 열립니다. 지금까지의 실제 승패는 "전적"에 있습니다.'));
}

/* ================= buttons ================= */
press('#tableBtn', sheetTable); press('#cueBtn', sheetCue); press('#guideBtn', sheetGuide);
// the rail: play and practice change what the panel offers; league and records are places of their own; settings is a sheet
$('#nav').addEventListener('click', e => {
  const b = e.target.closest('.nv'); if (!b) return; SND.init(); SND.tap();
  const v = b.dataset.v;
  if (v === 'set') return sheetSettings();
  if (v === 'league' || v === 'all') { lgTab = v; return showLeague(); }
  const game4 = m => game.MODES[m] && m !== 'practice' && m !== 'puzzle4';
  if ((v === 'practice' || v === 'puzzle') && prefs.mode !== v) { if (game4(prefs.mode)) prefs.lastMode = prefs.mode; prefs.mode = v; }
  else if (v === 'play' && !game4(prefs.mode)) prefs.mode = game4(prefs.lastMode) ? prefs.lastMode : 'eight';
  else if (st.screen === 'home') return;
  modeOpen = false; savePrefs(); goHome();
});
press('#pc0', () => sheetName(0)); press('#pc1', () => sheetName(1));
press('#menuBtn', sheetPause);
// look round in 3D and back: while it is on, dragging the table turns the view instead of aiming
function setView3D(on) {
  if (scene.orbiting === on) return;
  scene.setOrbit(on); $('#viewBtn').setAttribute('aria-pressed', String(on)); drag = null; orbitPts.clear();
  if (on) toast('큐를 잡고 끌면 조준, 빈 곳을 끌면 시점 회전, 두 손가락으로 확대·축소. 버튼을 다시 누르면 위에서 보는 화면으로 돌아옵니다.', '', 4800);
}
press('#viewBtn', () => setView3D(!scene.orbiting));
press('#startBtn', () => { if (prefs.mode === 'practice') practice.start(); else if (prefs.mode === 'puzzle') puzzle.start(); else match.start(0); });
press('#againBtn', () => { if (match.ctx && match.ctx.fix != null) showLeague(); else match.start(st.lastLoser == null ? 0 : st.lastLoser); });
press('#homeBtn', goHome);
// the best shot of the match, played again as an edited clip
const reel = createReel({ game, scene, SND, highlights, st, $, el, app, panOf, onEnd() { st.phase = 'idle'; flow = null; show('result'); } });
const reelFlow = { quiet: false, save: false, guide: () => 0, auto: () => null, hud() {}, beforeShot() {}, afterShot() {}, restart() {} };
// one of the match's highlights, played as an edit: a good shot to the player's song, a bad one for laughs with no music
async function playShot(shot, style) {
  if (!shot || st.screen !== 'result') return;
  // the best shot gets an edit and a song, the worst its own joke edit; every other highlight is simply shown again with one camera move
  if (!shot.kind && style !== 'plain') { await SND.song.prepare(); if (st.screen !== 'result') return; }
  show('reel'); flow = reelFlow; st.phase = 'reel'; reel.play(shot, typeof style === 'string' ? style : shot.kind ? undefined : prefs.edit);
}
const playBest = style => playShot(match.best, style), playWorst = style => playShot(match.worst, style);
press('#reelSkip', () => reel.skip());
seg('#segOpp', () => prefs.vsAI ? 1 : 0, v => { prefs.vsAI = v === '1'; savePrefs(); paintHome(); });
slider('#segLvl', () => Math.min(3, prefs.level), v => { prefs.level = v; savePrefs(); paintHome(); });
seg('#segTarget', () => prefs.target, v => { prefs.target = +v; savePrefs(); });
seg('#segRule3', () => prefs.rule3, v => { prefs.rule3 = +v; savePrefs(); });

/* ================= input ================= */
let drag = null;
const humanAiming = () => st.screen === 'play' && st.phase === 'aim' && $('#sheet').hidden;
// move a ball to where the finger is, sliding it round anything in the way
function tryPlace(p, ball) {
  const P = game.P, { R, HL, HW } = P, w = game.world, c = ball || game.cueBall(), kitchen = !ball && game.placing === 'kitchen';
  let x = Math.max(-HL + R, Math.min(HL - R, p.x)), y = Math.max(-HW + R, Math.min(HW - R, p.y));
  if (kitchen) x = Math.min(x, -HL / 2);
  if (P.isFree(w, x, y, c.id)) { c.x = c.px = x; c.y = c.py = y; return; }
  for (const b of w.balls) {
    if (!b.on || b.id === c.id) continue;
    const d = Math.hypot(x - b.x, y - b.y);
    if (d < 2 * R + 0.001 && d > 1e-6) { const k = (2 * R + 0.0012) / d, nx = b.x + (x - b.x) * k, ny = b.y + (y - b.y) * k; if (P.isFree(w, nx, ny, c.id) && (!kitchen || nx <= -HL / 2)) { c.x = c.px = nx; c.y = c.py = ny; } return; }
  }
}
// is this table position on the cue (or the cue ball it points at)?
function onCue(p) {
  const c = game.cueBall(), dx = p.x - c.x, dy = p.y - c.y, ca = Math.cos(st.aim), sa = Math.sin(st.aim);
  const back = -(dx * ca + dy * sa), side = Math.abs(dy * ca - dx * sa);
  return back > -0.05 && back < 1.6 && side < Math.max(0.07, 34 / scene.ppm);
}
const orbitPts = new Map();                                // fingers currently turning or zooming the 3D view
function ballUnder(p, reach) { let best = null, bd = reach; for (const b of game.world.balls) if (b.on) { const d = Math.hypot(p.x - b.x, p.y - b.y); if (d < bd) { bd = d; best = b; } } return best; }
canvas.addEventListener('pointerdown', e => {
  SND.init();
  if (scene.orbiting && st.screen === 'play') {
    // in the 3D view: taking hold of the cue aims, one finger anywhere else turns the view, two fingers zoom
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {} e.preventDefault();
    if (!orbitPts.size && humanAiming()) {
      const p = scene.toTable(e, game.P.R), c = game.cueBall();
      if (onCue(p)) { drag = { kind: 'aim', id: e.pointerId, last: Math.atan2(p.y - c.y, p.x - c.x), sx: e.clientX, sy: e.clientY, moved: 99, noTap: true }; return; }
    }
    orbitPts.set(e.pointerId, { x: e.clientX, y: e.clientY }); return;
  }
  if (!humanAiming()) return;
  const R = game.P.R, p = scene.toTable(e, R), c = game.cueBall(), d = Math.hypot(p.x - c.x, p.y - c.y), reach = Math.max(0.075, 26 / scene.ppm);
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  const moving = flow === practice && practice.edit ? ballUnder(p, reach) : null;
  if (moving) drag = { kind: 'ball', id: e.pointerId, ball: moving };
  else if (game.placing && d < reach) drag = { kind: 'cue', id: e.pointerId };
  else drag = { kind: 'aim', id: e.pointerId, last: Math.atan2(p.y - c.y, p.x - c.x), sx: e.clientX, sy: e.clientY, moved: 0 };
  e.preventDefault();
});
canvas.addEventListener('pointermove', e => {
  const op = orbitPts.get(e.pointerId);
  if (op) {
    if (orbitPts.size === 1) scene.orbitBy(e.clientX - op.x, e.clientY - op.y);
    else if (orbitPts.size === 2) {
      let other = null; for (const [id, q] of orbitPts) if (id !== e.pointerId) other = q;
      const before = Math.hypot(op.x - other.x, op.y - other.y), after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      if (before > 10 && after > 10) scene.zoomBy(Math.pow(before / after, 0.6));        // gentler than the fingers
    }
    op.x = e.clientX; op.y = e.clientY; return;
  }
  if (!drag || drag.id !== e.pointerId || !humanAiming()) return;
  const P = game.P, p = scene.toTable(e, P.R), c = game.cueBall();
  if (drag.kind === 'cue') tryPlace(p);
  else if (drag.kind === 'ball') {
    const b = drag.ball, out = Math.abs(p.x) > P.HL + 4 * P.R || Math.abs(p.y) > P.HW + 4 * P.R;
    if (out && b.id !== 0) { b.on = false; b.x = b.px = 9 + b.id; drag = null; } else tryPlace(p, b);
    st.rev++; flow.hud();
  } else {
    drag.moved = Math.max(drag.moved, Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy));
    const a = Math.atan2(p.y - c.y, p.x - c.x);
    if (Math.hypot(p.x - c.x, p.y - c.y) > 0.07 && drag.moved > 6) {
      let da = a - drag.last; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      st.aim += da;
    }
    drag.last = a;
  }
  scene.invalidate();
});
const endDrag = e => {
  if (orbitPts.delete(e.pointerId)) return;
  if (!drag || drag.id !== e.pointerId) return;
  if (drag.kind === 'aim' && drag.moved <= 6 && !drag.noTap && humanAiming()) { const R = game.P.R, p = scene.toTable(e, R), c = game.cueBall(); if (Math.hypot(p.x - c.x, p.y - c.y) > R) st.aim = Math.atan2(p.y - c.y, p.x - c.x); }
  drag = null; scene.invalidate(); snapshot();
};
canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);

(function powerCtl() {
  const box = $('#power'); let id = null;
  const read = e => { const r = box.getBoundingClientRect(); return Math.max(0, Math.min(1, scene.portrait ? (e.clientX - r.left - 30) / (r.width - 60) : (e.clientY - r.top - 26) / (r.height - 52))); };
  box.addEventListener('pointerdown', e => { SND.init(); if (!humanAiming()) return; id = e.pointerId; try { box.setPointerCapture(id); } catch (err) {} st.power = read(e); setPowerUI(st.power); scene.invalidate(); e.preventDefault(); });
  box.addEventListener('pointermove', e => { if (id !== e.pointerId) return; st.power = read(e); setPowerUI(st.power); scene.invalidate(); });
  const up = (e, cancel) => {
    if (id !== e.pointerId) return; id = null;
    const p = st.power;
    if (!cancel && p > 0.03 && humanAiming()) shoot(game.vOf(p), st.spin.x * 0.5, st.spin.y * 0.5); else { st.power = 0; setPowerUI(0); }
    scene.invalidate();
  };
  box.addEventListener('pointerup', e => up(e, false)); box.addEventListener('pointercancel', e => up(e, true));
})();
(function fineCtl() {
  const box = $('#fine'); let id = null, last = 0, off = 0;
  const pos = e => scene.portrait ? e.clientX : e.clientY;
  box.addEventListener('pointerdown', e => { SND.init(); if (!humanAiming()) return; id = e.pointerId; last = pos(e); try { box.setPointerCapture(id); } catch (err) {} e.preventDefault(); });
  box.addEventListener('pointermove', e => {
    if (id !== e.pointerId) return; const d = pos(e) - last; last = pos(e);
    st.aim += d * 0.0009 * (scene.portrait ? -1 : 1); off += d;
    box.style.backgroundPosition = scene.portrait ? `${off}px 0` : `0 ${off}px`; scene.invalidate();
  });
  const up = e => { if (id === e.pointerId) id = null; };
  box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
})();
(function spinCtl() {
  const pop = $('#spinPop'), pad = $('#spinPad');
  $('#spinBtn').addEventListener('click', () => {
    if (!humanAiming()) return; SND.tap(); pop.hidden = !pop.hidden; setSpinUI();
    $('#spinHint').textContent = '위는 밀어치기, 아래는 끌어치기, 좌우는 쿠션에서 꺾임. ' + (flow.guide() >= 3 ? '노란 점이 큐볼이 갈 길입니다.' : '조준선을 길게로 하면 큐볼이 갈 길이 보입니다.');
  });
  const set = e => {
    const r = pad.getBoundingClientRect(); let x = (e.clientX - r.left) / r.width * 2 - 1, y = -((e.clientY - r.top) / r.height * 2 - 1);
    x /= 0.72; y /= 0.72; const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    st.spin = { x, y }; setSpinUI(); scene.invalidate();
  };
  let id = null;
  pad.addEventListener('pointerdown', e => { id = e.pointerId; try { pad.setPointerCapture(id); } catch (err) {} set(e); e.preventDefault(); });
  pad.addEventListener('pointermove', e => { if (id === e.pointerId) set(e); });
  pad.addEventListener('pointerup', () => { id = null; }); pad.addEventListener('pointercancel', () => { id = null; });
  $('#spinReset').addEventListener('click', () => { SND.tap(); st.spin = { x: 0, y: 0 }; setSpinUI(); scene.invalidate(); });
})();
document.addEventListener('contextmenu', e => e.preventDefault());

// Android back button: close whatever is on top; false means "nothing left, leave the app".
window.__back = function () {
  if (!$('#sheet').hidden) { closeSheet(); return true; }
  if (!$('#spinPop').hidden) { $('#spinPop').hidden = true; return true; }
  if (st.screen === 'reel') { reel.skip(); return true; }
  if (st.screen === 'result' || st.screen === 'league') { goHome(); return true; }
  if (st.screen === 'play') { sheetPause(); return true; }
  return false;
};

/* ================= frame loop ================= */
let lastT = 0, acc = 0, fpsN = 0, fpsT = 0;
// which balls may be hit: recomputed when the table changes (st.rev), not on every frame
const NONE = [], legal = { rev: -1, turn: -1, ids: NONE };
function legalNow() { if (legal.rev !== st.rev || legal.turn !== game.turn) { legal.rev = st.rev; legal.turn = game.turn; legal.ids = game.legal(); } return legal.ids; }
// what the physics reported since the last frame: sounds to play, balls to drop into pockets
function drain() {
  const s = game.world.snd, quiet = flow.quiet;
  for (const e of s) {
    if (e.t === 'pocket') { scene.fall(game.P, e); if (!quiet) { SND.drop('lip', Math.hypot(e.vx, e.vy), panOf(e.x, e.y)); } }
    else if (!quiet) { if (e.t === 'ball') SND.ball(e.v, panOf(e.x, e.y)); else SND.rail(e.v, panOf(e.x, e.y)); }
  }
  s.length = 0;
}
// the pocket animation says when the ball knocks the inside wall and when it lands
function drainFalls() {
  const s = scene.fallEvents; if (!s.length) return;
  if (flow && !flow.quiet) for (const e of s) SND.drop(e.t, e.v, panOf(e.x, e.y));
  s.length = 0;
}
function stepSim(dt) {
  const w = game.world, P = game.P;
  // once everything is crawling, run the clock faster so nobody waits on the last roll
  let vmax = 0; for (const b of w.balls) if (b.on) { const s = Math.abs(b.vx) + Math.abs(b.vy); if (s > vmax) vmax = s; }
  acc += dt * (!prefs.fast ? 1 : vmax < 0.4 ? 2.1 : 1.12);
  let n = 0; while (acc >= TICK && n < 30) { P.step(w, TICK); acc -= TICK; n++; }
  if (n === 30) acc = 0;
  const alpha = acc / TICK;
  drain(); SND.rolling(flow.quiet ? 0 : Math.min(8, vmax));
  if (P.rest(w) && !scene.falling) { st.settle += dt; if (st.settle > 0.12) endShot(); }
  return alpha;
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - lastT) / 1000 || 0); lastT = now;
  const paused = !$('#sheet').hidden;
  let animating = false, alpha = 1, pull = 0.03 + st.power * 0.2, clip = null;
  if (!paused) {
    if (st.phase === 'auto') { autoTick(dt); animating = true; }
    if (st.phase === 'strike') {
      const ca = st.cueAnim; ca.t += dt; animating = true;
      const k = Math.min(1, ca.t / 0.1); pull = ca.from * (1 - k * k) - 0.004 * k;
      if (ca.t >= 0.1) { const c = game.cueBall(); game.P.strike(game.world, st.aim, ca.V, ca.a, ca.b); if (!flow.quiet) SND.cue(ca.V, panOf(c.x, c.y)); st.phase = 'sim'; acc = 0; st.settle = 0; st.power = 0; setPowerUI(0); }
    }
    if (st.phase === 'sim') { alpha = stepSim(dt); animating = true; if (st.phase !== 'sim') SND.rolling(0); }
    else if (st.phase === 'reel') { clip = reel.tick(dt); animating = true; if (clip) { alpha = clip.alpha; pull = clip.pull; } }
    else if (st.phase === 'hold') { st.holdT -= dt; animating = true; if (st.holdT <= 0) { const f = st.afterHold; st.afterHold = null; f(); } }
  }
  const lined = st.phase === 'aim' || (st.phase === 'auto' && !!st.auto && !!st.auto.plan);
  const drew = scene.frame({
    game, alpha, aim: st.aim, power: st.power, pull, spin: st.spin, rev: st.rev, animating,
    showCue: clip ? clip.cue : lined || st.phase === 'strike' || st.phase === 'idle', showGuide: lined, level: flow ? flow.guide() : 0,
    legalIds: st.screen === 'play' ? legalNow() : NONE, hand: !!game.placing && st.phase === 'aim',
  }, dt);
  drainFalls();
  if (paused && st.phase === 'sim') SND.rolling(0);
  if (prefs.fps) {
    fpsN++; fpsT += dt;
    if (fpsT >= 0.5) { $('#fps').textContent = `${Math.round(fpsN / fpsT)} FPS · ${scene.pixelRatio.toFixed(2)}x` + (drew ? '' : ' · 대기'); fpsN = 0; fpsT = 0; }
  }
}

/* ================= saving ================= */
function snapshot() {
  if (st.screen !== 'play' || !flow || !flow.save) return;
  const d = { v: 2, game: game.serialize(), aim: st.aim, series, tbl: prefs.table, fix: match.ctx ? match.ctx.fix : null };
  store.set('save', d);
  try { const h = window.claude && window.claude.hot; if (h && h.snapshot) h.snapshot(d); } catch (e) {}
}
function start(data) {
  SND.song.load();
  if (!(data && data.v === 2)) data = store.get('save', null);
  $('#fps').hidden = !prefs.fps;
  if (data && data.v === 2 && TABLES.some(t => t.id === data.tbl)) { prefs.table = data.tbl; PH.pool = poolOf(data.tbl); }
  if (data && data.v === 2 && data.game && data.game.modeId !== 'practice' && game.restore(data.game)) {
    if (data.series) { series.key = data.series.key; series.s = data.series.s; }
    match.ctx = { names: game.players.map(p => p.name), mode: game.modeId, ai: game.players[1].ai, target: game.target, fix: data.fix == null ? null : data.fix };
    if (match.ctx.fix == null) prefs.mode = game.modeId;
    st.aim = data.aim || 0; match.enter();
  } else goHome();
  requestAnimationFrame(frame);
}
window.__dp8 = { game, st, prefs, scene, drills, practice, puzzle, puzzles, match, reel, playBest, playWorst, SND, showLeague, league, get lg() { return lg; }, startMatch: match.start, startPractice: practice.start, goHome, shoot, endShot };
const hot = window.claude && window.claude.hot;
if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
})();
