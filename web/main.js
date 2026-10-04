/* App shell. It owns the screens, the input and the frame loop, and nothing else:
     physics.js  how balls move            game.js    rules, turns, computer player
     drills.js   practice layouts          scene.js   drawing
     audio.js    sound                     look.js    colours and designs (data)
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
  const p = Object.assign({ mode: 'eight', names: ['플레이어 1', '플레이어 2'], vsAI: false, level: 1, target: 10, table: 'bar', theme: 'dark', cloth: 0, cue: 0,
    guides: null, drill: 'free', drillLv: {}, sound: true, quality: 'auto', fps: false }, saved);
  if (!Array.isArray(p.guides) || p.guides.length !== 2) { const g = typeof saved.guide === 'number' ? saved.guide : 2; p.guides = [g, g]; }   // older saves had one guide for both
  delete p.guide;
  if (!TABLES.some(t => t.id === p.table)) p.table = 'bar';
  if (!p.drillLv || typeof p.drillLv !== 'object') p.drillLv = {};
  return p;
})();
const savePrefs = () => store.set('prefs', prefs);

const poolCache = {};
const poolOf = id => poolCache[id] || (poolCache[id] = createPhysics(Object.assign({ pockets: true }, (TABLES.find(t => t.id === id) || TABLES[0]).cfg)));
const PH = { pool: poolOf(prefs.table), carom: createPhysics({ R: 0.03275, pockets: false }) };
const game = createGame(PH);
const drills = createDrills();
const SND = createAudio(() => prefs.sound);
if (!game.MODES[prefs.mode]) prefs.mode = 'eight';
if (drills.byId(prefs.drill).id !== prefs.drill) prefs.drill = 'free';
let rec = store.get('rec', {});
const recOf = n => rec[n] || (rec[n] = { w: 0, l: 0, streak: 0, best: 0 });
const series = { key: '', s: [0, 0] };
const oppName = () => prefs.vsAI ? '컴퓨터' : prefs.names[1];

/* What is on screen and where the current shot is.
   screen: home | play | result
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
function seg(id, get, set) {
  const box = $(id), paint = () => { for (const b of box.children) b.setAttribute('aria-pressed', String(b.dataset.v === String(get()))); };
  box.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; SND.init(); SND.tap(); set(b.dataset.v); paint(); });
  paint(); return paint;
}
let toastTimer = 0;
function toast(msg, kind, ms) {
  const t = $('#toast'); if (!msg) return;
  t.textContent = msg; t.className = 'show ' + (kind || '');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = kind || ''; }, ms || 1800);
}
const ballChip = (id, style) => el('i', { class: 'mb' + (id > 8 ? ' st' : ''), style: `--c:${ballCss(id)};` + (style || '') });

/* ================= screens and layout ================= */
const CONTROLS = ['#power', '#fine', '#spinBtn'];
function show(screen) {
  st.screen = screen;
  $('#home').hidden = screen !== 'home'; $('#hud').hidden = screen !== 'play'; $('#result').hidden = screen !== 'result';
  for (const id of CONTROLS) $(id).hidden = screen !== 'play';
  $('#spinPop').hidden = true; closeSheet();
  if (screen !== 'play') { app.classList.add('busy'); scene.setZone(null); }
  layout();
}
let wide = true;
function layout() {
  const W = app.clientWidth, H = app.clientHeight; if (!W || !H) return;
  const portrait = H > W; wide = W >= 900 && H >= 560;
  app.classList.toggle('portrait', portrait); app.classList.toggle('compact', !wide);
  const hud = H <= 520 ? 50 : 60;
  scene.resize();
  if (st.screen === 'home' && wide) scene.setInsets({ t: 92, l: 350, r: 350, b: 100 });
  else scene.setInsets(portrait ? { t: hud + 8, l: 6, r: 6, b: 112 } : { t: hud + 6, l: 66, r: 74, b: 10 });
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
  const tr = $('#power'), fill = $('#powerFill'), c = $('#powerCue');
  $('#powerNum').textContent = Math.round(p * 100);
  if (scene.portrait) { fill.style.height = ''; fill.style.width = (p * 100) + '%'; c.style.transform = `translate(calc(-100% + 30px + ${p * (tr.clientWidth - 30)}px),-50%)`; }
  else { fill.style.width = ''; fill.style.height = (p * 100) + '%'; c.style.transform = `translate(-50%,calc(-100% + 26px + ${p * (tr.clientHeight - 26)}px))`; }
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
  const sizes = prefs.mode === 'four' ? [note('4구는 포켓 없는 중대(254×127cm, 공 65.5mm)로 고정입니다.')]
    : TABLES.map(t => optBtn(prefs.table === t.id, optText(t.name, t.d), () => { prefs.table = t.id; savePrefs(); PH.pool = poolOf(t.id); paintHome(); homePreview(); sheetTable(); }));
  openSheet('테이블', [el('div', { class: 'lab', text: '크기' }), ...sizes, el('div', { class: 'lab', text: '천 색' }),
    el('div', { class: 'grid2' }, CLOTHS.map((c, i) => optBtn(prefs.cloth === i,
      [el('i', { class: 'sw', style: `--c:${hex(c.felt)};--w:${hex(c.wood)}` }), optText(c.name)], () => { prefs.cloth = i; savePrefs(); scene.setCloth(i); paintHome(); sheetTable(); })))]);
}
const cueCss = d => `linear-gradient(90deg,${hex(d.tip)} 0 4%,${hex(d.ferrule)} 4% 8%,${hex(d.shaft)} 8% 50%,${hex(d.joint)} 50% 53%,${hex(d.fore)} 53% 70%,${hex(d.wrap)} 70% 90%,${hex(d.sleeve)} 90%)`;
function sheetCue() {
  openSheet('큐 고르기', CUES.map((c, i) => optBtn(prefs.cue === i,
    [el('i', { class: 'cuepic', style: '--c:' + cueCss(c) }), optText(c.name, c.note)], () => { prefs.cue = i; savePrefs(); scene.setCue(i); paintHome(); sheetCue(); })));
}
// one guide length per player (a handicap); a single row when only one person is aiming
function sheetGuide() {
  const solo = prefs.vsAI || (st.screen === 'home' ? prefs.mode === 'practice' : flow !== match);
  const row = i => segRow(solo ? '조준선' : prefs.names[i], GUIDE.map((gd, k) => [k, gd[0]]), prefs.guides[i], v => { prefs.guides[i] = v; if (solo) prefs.guides[1] = v; savePrefs(); paintHome(); scene.invalidate(); sheetGuide(); });
  openSheet('조준선 길이', [row(0), solo ? null : row(1), note(GUIDE.map(gd => gd[0] + ': ' + gd[1]).join(' · ')),
    solo ? null : note('실력 차이가 나면 잘하는 쪽을 짧게, 처음 하는 쪽을 길게 두세요.')]);
}
function sheetSettings() {
  openSheet('설정', [
    segRow('화면', [['dark', '다크'], ['light', '라이트']], prefs.theme, v => { prefs.theme = v; savePrefs(); applyTheme(); sheetSettings(); }),
    segRow('소리', [[true, '켬'], [false, '끔']], prefs.sound, v => { prefs.sound = v; savePrefs(); if (v) SND.init(); sheetSettings(); }),
    segRow('화질', [['auto', '자동'], ['high', '높음'], ['low', '낮음']], prefs.quality, v => { prefs.quality = v; savePrefs(); scene.setQuality(v); sheetSettings(); }),
    segRow('초당 프레임 표시', [[false, '끔'], [true, '켬']], prefs.fps, v => { prefs.fps = v; savePrefs(); $('#fps').hidden = !v; sheetSettings(); }),
    note('화질을 낮추면 움직임이 더 부드러워집니다. 자동은 기기 화면 크기에 맞춰 정합니다.'),
  ]);
}
function sheetRecords() {
  const names = Object.keys(rec).filter(n => rec[n].w || rec[n].l).sort((a, b) => rec[b].w - rec[a].w);
  const grid = el('div', { class: 'rec' }, [el('span', { class: 'hd', text: '이름' }), el('span', { class: 'hd n', text: '승' }), el('span', { class: 'hd n', text: '패' }), el('span', { class: 'hd n', text: '최다 연승' })]);
  for (const n of names) { const r = rec[n]; grid.append(el('span', { text: n }), el('span', { class: 'n', text: r.w }), el('span', { class: 'n', text: r.l }), el('span', { class: 'n', text: r.best })); }
  openSheet('전적', [names.length ? grid : note('아직 끝난 판이 없습니다. 한 판 끝나면 이름별로 승패가 쌓입니다.'),
    names.length ? flatBtn('전적 모두 지우기', () => { rec = {}; store.set('rec', rec); series.key = ''; paintHome(); sheetRecords(); }) : null]);
}
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
const MODE_ICON = {
  eight: () => el('span', { class: 'ball', style: '--c:#111' }, el('i', { text: '8' })),
  nine: () => el('span', { class: 'ball', style: '--c:#f2b705' }, el('i', { text: '9' })),
  four: () => el('span', { class: 'four' }, ['#d3241c', '#d3241c', '#f4c20d', '#f4efe2'].map(c => el('i', { style: '--c:' + c }))),
  practice: () => el('span', { class: 'target' }, el('i')),
};
function check() {
  const s = el('span', { class: 'ck' });
  s.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  return s;
}
function buildModes() {
  const box = $('#modeList'); box.textContent = '';
  for (const id of ['eight', 'nine', 'four', 'practice']) {
    const m = game.MODES[id];
    box.appendChild(el('button', { class: 'gcard', 'aria-pressed': String(prefs.mode === id), onclick: () => { SND.init(); SND.tap(); prefs.mode = id; savePrefs(); buildModes(); paintHome(); homePreview(); } },
      [el('span', { class: 'ic' }, MODE_ICON[id]()), el('span', null, [el('span', { class: 'nm', text: m.name }), el('span', { class: 'bl', text: m.blurb })]), check()]));
  }
}
function recText(n) { const r = rec[n]; if (!r || (!r.w && !r.l)) return '첫 판'; return `${r.w}승 ${r.l}패` + (r.streak >= 2 ? ` · ${r.streak}연승 중` : ''); }
const levelOf = id => Math.max(1, Math.min(drills.LEVELS, prefs.drillLv[id] || 1));
function paintHome() {
  const prac = prefs.mode === 'practice';
  $('#vsBox').hidden = prac; $('#pracList').hidden = !prac; $('#rightLab').textContent = prac ? '연습 고르기' : '대결';
  if (prac) {
    const box = $('#pracList'), top = box.scrollTop; box.textContent = '';
    for (const d of drills.list) box.appendChild(optBtn(prefs.drill === d.id,
      [optText(d.name, d.d), d.make ? el('span', { class: 'lv', text: levelOf(d.id) + '단계' }) : null], () => { prefs.drill = d.id; savePrefs(); paintHome(); homePreview(); }));
    box.scrollTop = top;
  }
  $('#pc0 .nm').textContent = prefs.names[0]; $('#pc0 .rc').textContent = recText(prefs.names[0]);
  $('#pc1 .nm').textContent = oppName(); $('#pc1 .rc').textContent = prefs.vsAI ? ['쉬움', '보통', '어려움'][prefs.level] + ' 난이도' : recText(prefs.names[1]);
  $('#segLvl').hidden = !prefs.vsAI; $('#segTarget').hidden = prefs.mode !== 'four';
  $('#clothSw').style.setProperty('--c', hex(CLOTHS[prefs.cloth].felt));
  $('#tableVal').textContent = (prefs.mode === 'four' ? '중대' : TABLES.find(t => t.id === prefs.table).short) + ' · ' + CLOTHS[prefs.cloth].name;
  $('#cueVal').textContent = CUES[prefs.cue].name;
  const gs = prefs.guides; $('#guideVal').textContent = gs[0] === gs[1] || prefs.vsAI || prac ? GUIDE[gs[0]][0] : GUIDE[gs[0]][0] + ' · ' + GUIDE[gs[1]][0];
}
// The table behind the home screen: the chosen game racked up, or the chosen drill being played over and over
// (a new layout each time, which is also what the drill itself does).
function homePreview() {
  PH.pool = poolOf(prefs.table); scene.clearFalls(); scene.setZone(null);
  st.phase = 'idle'; st.auto = null; st.cueAnim = null; st.power = 0; st.spin = { x: 0, y: 0 }; st.aim = 0;
  const d = drills.byId(prefs.drill);
  if (prefs.mode === 'practice' && d.make) {
    game.start('practice', [prefs.names[0], ''], false, {}); scene.setTable(game.P);
    const L = drills.make(d.id, game.P, levelOf(d.id), Math.random, game.vOf);
    if (L) { flow = null; putLayout(L); scene.setZone(L.zone); playDemo(L.demo, { quiet: true, after: homePreview }); return; }
  }
  flow = null;
  game.start(prefs.mode === 'practice' ? 'eight' : prefs.mode, [prefs.names[0], oppName()], false, {});
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
  flow.beforeShot(); game.beginShot();
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
  box.querySelector('.nm').textContent = s.name; box.querySelector('.sub').textContent = s.sub;
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

/* ================= flow: a match between two players (or one and the computer) ================= */
const match = {
  quiet: false, save: true,
  start(first) {
    PH.pool = poolOf(prefs.table); scene.clearFalls();
    const names = [prefs.names[0], oppName()], key = names.join('\u0001') + prefs.mode;
    if (series.key !== key) { series.key = key; series.s = [0, 0]; }
    game.start(prefs.mode, names, prefs.vsAI, { level: prefs.level, target: prefs.target, first: first || 0 });
    st.aim = 0; match.enter(); toast(game.mode.intro(game), '', 3600);
  },
  enter() { flow = match; $('#pracBar').hidden = true; $('#p1').hidden = false; scene.setTable(game.P); st.rev++; show('play'); beginTurn(true); },
  restart() { match.start(game.turn); },
  guide: () => prefs.guides[game.turn],
  auto: () => game.players[game.turn].ai ? { think: 0.5, plan() { const p = game.aiPlan(); return { angle: p.angle, V: p.V, a: 0, b: 0, pos: p.pos }; } } : null,
  beforeShot() {},
  afterShot() {
    const out = game.resolve();
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
    rw.w++; rw.streak++; rw.best = Math.max(rw.best, rw.streak); rl.l++; rl.streak = 0; store.set('rec', rec);
    series.s[w]++; st.lastLoser = l; store.set('save', null); st.phase = 'idle';
    const win = $('#rWin'); win.className = 'r-win' + (w === 1 ? ' two' : '');
    win.querySelector('.av').textContent = w + 1; win.querySelector('.nm').textContent = pw.name;
    win.querySelector('.rc').textContent = `${rw.w}승 ${rw.l}패` + (rw.streak >= 2 ? ` · ${rw.streak}연승 중` : '');
    $('#rLose .av').textContent = l + 1; $('#rLose .nm').textContent = pl.name;
    const sc = $('#rScore'); sc.textContent = ''; sc.append(el('b', { text: series.s[w] }), ' : ' + series.s[l]);
    const pct = p => p.shots ? Math.round(p.made / p.shots * 100) + '%' : '0%';
    const rows = [['샷 성공률', pct(pw), pct(pl)], ['연속 성공', pw.best, pl.best], ['친 횟수', pw.shots, pl.shots], ['파울', pw.fouls, pl.fouls]];
    if (game.mode.target) rows[2] = ['점수', pw.score, pl.score];
    const box = $('#rStats'); box.textContent = '';
    for (const [k, a, b] of rows) box.appendChild(el('div', { class: 'stat panel' }, [el('div', { class: 'k', text: k }), el('div', { class: 'v' }, [el('b', { text: a }), el('span', { text: b })])]));
    $('#rWhy').textContent = game.over.why;
    show('result'); SND.win();
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
    paintBadge('연습', { text: p.drill.make ? p.drill.d : '자유롭게' }); setBusy();
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

/* ================= buttons ================= */
press('#tableBtn', sheetTable); press('#cueBtn', sheetCue); press('#guideBtn', sheetGuide);
press('#setBtn', sheetSettings); press('#recBtn', sheetRecords);
press('#pc0', () => sheetName(0)); press('#pc1', () => sheetName(1));
press('#menuBtn', sheetPause);
press('#startBtn', () => { if (prefs.mode === 'practice') practice.start(); else match.start(0); });
press('#againBtn', () => match.start(st.lastLoser == null ? 0 : st.lastLoser));
press('#homeBtn', goHome);
seg('#segOpp', () => prefs.vsAI ? 1 : 0, v => { prefs.vsAI = v === '1'; savePrefs(); paintHome(); });
seg('#segLvl', () => prefs.level, v => { prefs.level = +v; savePrefs(); paintHome(); });
seg('#segTarget', () => prefs.target, v => { prefs.target = +v; savePrefs(); });

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
function ballUnder(p, reach) { let best = null, bd = reach; for (const b of game.world.balls) if (b.on) { const d = Math.hypot(p.x - b.x, p.y - b.y); if (d < bd) { bd = d; best = b; } } return best; }
canvas.addEventListener('pointerdown', e => {
  SND.init(); if (!humanAiming()) return;
  const R = game.P.R, p = scene.toTable(e, R), c = game.cueBall(), d = Math.hypot(p.x - c.x, p.y - c.y), reach = Math.max(0.075, 26 / scene.ppm);
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  const moving = flow === practice && practice.edit ? ballUnder(p, reach) : null;
  if (moving) drag = { kind: 'ball', id: e.pointerId, ball: moving };
  else if (game.placing && d < reach) drag = { kind: 'cue', id: e.pointerId };
  else drag = { kind: 'aim', id: e.pointerId, last: Math.atan2(p.y - c.y, p.x - c.x), sx: e.clientX, sy: e.clientY, moved: 0 };
  e.preventDefault();
});
canvas.addEventListener('pointermove', e => {
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
  if (!drag || drag.id !== e.pointerId) return;
  if (drag.kind === 'aim' && drag.moved <= 6 && humanAiming()) { const R = game.P.R, p = scene.toTable(e, R), c = game.cueBall(); if (Math.hypot(p.x - c.x, p.y - c.y) > R) st.aim = Math.atan2(p.y - c.y, p.x - c.x); }
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
  if (st.screen === 'result') { goHome(); return true; }
  if (st.screen === 'play') { sheetPause(); return true; }
  return false;
};

/* ================= frame loop ================= */
let lastT = 0, acc = 0, fpsN = 0, fpsT = 0;
// what the physics reported since the last frame: sounds to play, balls to drop into pockets
function drain() {
  const s = game.world.snd; if (!s.length) return;
  const quiet = flow.quiet;
  for (const e of s) {
    if (e.t === 'pocket') { scene.fall(game.P, e); if (!quiet) SND.pocket(); }
    else if (!quiet) { if (e.t === 'ball') SND.ball(e.v); else if (e.t === 'rail') SND.rail(e.v); }
  }
  s.length = 0;
}
function stepSim(dt) {
  const w = game.world, P = game.P;
  // once everything is crawling, run the clock faster so nobody waits on the last roll
  let vmax = 0; for (const b of w.balls) if (b.on) { const s = Math.abs(b.vx) + Math.abs(b.vy); if (s > vmax) vmax = s; }
  acc += dt * (vmax < 0.4 ? 2.1 : 1.12);
  let n = 0; while (acc >= TICK && n < 30) { P.step(w, TICK); acc -= TICK; n++; }
  if (n === 30) acc = 0;
  const alpha = acc / TICK;
  drain();
  if (P.rest(w) && !scene.falling) { st.settle += dt; if (st.settle > 0.12) endShot(); }
  return alpha;
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - lastT) / 1000 || 0); lastT = now;
  const paused = !$('#sheet').hidden;
  let animating = false, alpha = 1, pull = 0.03 + st.power * 0.2;
  if (!paused) {
    if (st.phase === 'auto') { autoTick(dt); animating = true; }
    if (st.phase === 'strike') {
      const ca = st.cueAnim; ca.t += dt; animating = true;
      const k = Math.min(1, ca.t / 0.1); pull = ca.from * (1 - k * k) - 0.004 * k;
      if (ca.t >= 0.1) { game.P.strike(game.world, st.aim, ca.V, ca.a, ca.b); if (!flow.quiet) SND.cue(ca.V); st.phase = 'sim'; acc = 0; st.settle = 0; st.power = 0; setPowerUI(0); }
    }
    if (st.phase === 'sim') { alpha = stepSim(dt); animating = true; }
    else if (st.phase === 'hold') { st.holdT -= dt; animating = true; if (st.holdT <= 0) { const f = st.afterHold; st.afterHold = null; f(); } }
  }
  const lined = st.phase === 'aim' || (st.phase === 'auto' && !!st.auto && !!st.auto.plan);
  const drew = scene.frame({
    game, alpha, aim: st.aim, power: st.power, pull, spin: st.spin, rev: st.rev, animating,
    showCue: lined || st.phase === 'strike' || st.phase === 'idle', showGuide: lined, level: flow ? flow.guide() : 0,
    legalIds: st.screen === 'play' ? game.legal() : [], hand: !!game.placing && st.phase === 'aim',
  }, dt);
  if (prefs.fps) {
    fpsN++; fpsT += dt;
    if (fpsT >= 0.5) { $('#fps').textContent = `${Math.round(fpsN / fpsT)} FPS · ${scene.pixelRatio.toFixed(2)}x` + (drew ? '' : ' · 대기'); fpsN = 0; fpsT = 0; }
  }
}

/* ================= saving ================= */
function snapshot() {
  if (st.screen !== 'play' || !flow || !flow.save) return;
  const d = { v: 2, game: game.serialize(), aim: st.aim, series, tbl: prefs.table };
  store.set('save', d);
  try { const h = window.claude && window.claude.hot; if (h && h.snapshot) h.snapshot(d); } catch (e) {}
}
function start(data) {
  if (!(data && data.v === 2)) data = store.get('save', null);
  $('#fps').hidden = !prefs.fps;
  if (data && data.v === 2 && TABLES.some(t => t.id === data.tbl)) { prefs.table = data.tbl; PH.pool = poolOf(data.tbl); }
  if (data && data.v === 2 && data.game && data.game.modeId !== 'practice' && game.restore(data.game)) {
    if (data.series) { series.key = data.series.key; series.s = data.series.s; }
    prefs.mode = game.modeId; st.aim = data.aim || 0; match.enter();
  } else goHome();
  requestAnimationFrame(frame);
}
window.__dp8 = { game, st, prefs, scene, drills, practice, match, startMatch: match.start, startPractice: practice.start, goHome, shoot, endShot };
const hot = window.claude && window.claude.hot;
if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
})();
