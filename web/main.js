/* App shell: screens, input, turn flow on screen, saving. */
(() => {
'use strict';
const $ = s => document.querySelector(s);
const app = $('#app'), canvas = $('#gl');
const TICK = 1 / 120;
const GUIDE = [['끔', '조준선 없이 감으로 칩니다'], ['짧게', '큐볼이 처음 닿는 곳까지만'], ['보통', '맞은 공과 큐볼이 꺾이는 방향까지'], ['길게', '쿠션에 튕긴 뒤와 큐볼이 굴러갈 길까지']];

const store = {
  get(k, d) { try { const v = localStorage.getItem('dp8.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('dp8.' + k, JSON.stringify(v)); } catch (e) {} },
};
const prefs = Object.assign({ mode: 'eight', names: ['플레이어 1', '플레이어 2'], vsAI: false, level: 1, target: 10, table: 'bar', theme: 'dark', cloth: 0, cue: 0, guide: 2, sound: true, quality: 'auto', fps: false }, store.get('prefs', {}));

// Pool table sizes. Real regulation numbers: playing surface, ball diameter, pocket openings.
const TABLES = [
  { id: 'bar', name: '당구장 7피트', short: '7피트', d: '198×99cm · 공 57mm. 공이 크게 보이고 가장 쉽습니다.', cfg: { R: 0.028575, HL: 0.99, HW: 0.495, cornerMouth: 0.114, sideMouth: 0.127 } },
  { id: 'club', name: '클럽 8피트', short: '8피트', d: '224×112cm · 공 57mm. 동호인이 많이 쓰는 중간 크기.', cfg: { R: 0.028575, HL: 1.12, HW: 0.56, cornerMouth: 0.12, sideMouth: 0.133 } },
  { id: 'pro', name: '대회 9피트', short: '9피트', d: '254×127cm · 공 57mm. 프로 대회 규격, 가장 넓고 어렵습니다.', cfg: { R: 0.028575, HL: 1.27, HW: 0.635, cornerMouth: 0.127, sideMouth: 0.14 } },
  { id: 'pub', name: '영국식 6피트', short: '6피트', d: '183×91cm · 공 51mm. 작은 공에 좁은 포켓.', cfg: { R: 0.0254, HL: 0.915, HW: 0.4575, cornerMouth: 0.089, sideMouth: 0.095 } },
];
if (!TABLES.some(t => t.id === prefs.table)) prefs.table = 'bar';
const poolCache = {};
const poolOf = id => poolCache[id] || (poolCache[id] = createPhysics(Object.assign({ pockets: true }, (TABLES.find(t => t.id === id) || TABLES[0]).cfg)));
const PH = { pool: poolOf(prefs.table), carom: createPhysics({ R: 0.03275, pockets: false }) };
const game = createGame(PH);
if (!game.MODES[prefs.mode]) prefs.mode = 'eight';
const savePrefs = () => store.set('prefs', prefs);
let rec = store.get('rec', {});
const recOf = n => rec[n] || (rec[n] = { w: 0, l: 0, streak: 0, best: 0 });
const series = { key: '', s: [0, 0] };
const oppName = () => prefs.vsAI ? '컴퓨터' : prefs.names[1];

const st = { phase: 'home', aim: 0, power: 0, spin: { x: 0, y: 0 }, cueAnim: null, ai: null, rev: 0, lastLoser: null, settle: 0 };

/* ================= sound ================= */
const SND = (() => {
  let ac = null, noise = null, out = null, lastBall = 0, lastRail = 0;
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      const n = Math.floor(ac.sampleRate * 0.3); noise = ac.createBuffer(1, n, ac.sampleRate);
      const d = noise.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      // one limiter for everything, so a break with fifteen clicks at once does not crackle
      const lim = ac.createDynamicsCompressor(); lim.threshold.value = -10; lim.knee.value = 6; lim.ratio.value = 12; lim.attack.value = 0.001; lim.release.value = 0.08;
      lim.connect(ac.destination); out = lim;
    } catch (e) { ac = null; }
  }
  // filtered noise: the "crack" part of a hit
  function burst(freq, q, dur, gain, type, at) {
    if (!ac || !prefs.sound) return;
    const t = ac.currentTime + (at || 0), s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noise; f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 0.2); s.stop(t + dur + 0.02);
  }
  // falling sine: the "body" of a hit
  function tone(freq, dur, gain, to, at, type) {
    if (!ac || !prefs.sound) return;
    const t = ac.currentTime + (at || 0), o = ac.createOscillator(), g = ac.createGain();
    if (type) o.type = type;
    o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * (to || 0.6), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.0015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.02);
  }
  return {
    init,
    // ball on ball: a hard, short clack with a woody knock under it
    ball(v) {
      const n = performance.now(); if (n - lastBall < 14) return; lastBall = n;
      const g = Math.min(1, 0.05 + v * 0.26);
      burst(2500, 0.9, 0.014, g * 0.9); tone(1320, 0.03, g * 0.5, 0.72); tone(460, 0.05, g * 0.42, 0.66, 0, 'triangle');
    },
    // cushion: a soft rubber thud, pitched where a tablet speaker can still play it
    rail(v) {
      const n = performance.now(); if (n - lastRail < 30) return; lastRail = n;
      const g = Math.min(0.75, 0.1 + v * 0.2);
      tone(340, 0.085, g, 0.55, 0, 'triangle'); burst(560, 0.8, 0.06, g * 0.7);
    },
    // pocket: the drop, then the ball landing in the cup
    pocket() {
      tone(300, 0.14, 0.5, 0.5, 0, 'triangle'); burst(850, 0.8, 0.09, 0.3);
      tone(230, 0.1, 0.3, 0.6, 0.11, 'triangle'); burst(1400, 1.2, 0.03, 0.16, 'bandpass', 0.11);
    },
    // cue tip on the cue ball: a dull leather tock with a short click on top
    cue(v) {
      const g = Math.min(1, 0.3 + v * 0.07);
      tone(520, 0.06, g * 0.6, 0.6, 0, 'triangle'); burst(950, 0.8, 0.022, g * 0.7); burst(2600, 1.2, 0.008, g * 0.3);
    },
    tap() { tone(520, 0.05, 0.12, 1.5); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, 0.22, 1, i * 0.11)); },
  };
})();

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

/* ================= layout ================= */
let wide = true;
function layout() {
  const W = app.clientWidth, H = app.clientHeight; if (!W || !H) return;
  const portrait = H > W; wide = W >= 900 && H >= 560;
  app.classList.toggle('portrait', portrait); app.classList.toggle('compact', !wide);
  const hud = H <= 520 ? 50 : 60;
  scene.resize();
  if (st.phase === 'home' && wide) scene.setInsets({ t: 92, l: 350, r: 350, b: 100 });
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

/* ================= home ================= */
const MODE_ICON = {
  eight: () => el('span', { class: 'ball', style: '--c:#111' }, el('i', { text: '8' })),
  nine: () => el('span', { class: 'ball', style: '--c:#f2b705' }, el('i', { text: '9' })),
  four: () => el('span', { class: 'four' }, ['#d3241c', '#d3241c', '#f4c20d', '#f4efe2'].map(c => el('i', { style: '--c:' + c }))),
};
function check() {
  const s = el('span', { class: 'ck' });
  s.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  return s;
}
function buildModes() {
  const box = $('#modeList'); box.textContent = '';
  for (const id of ['eight', 'nine', 'four']) {
    const m = game.MODES[id];
    box.appendChild(el('button', { class: 'gcard', 'aria-pressed': String(prefs.mode === id), onclick: () => { SND.init(); SND.tap(); prefs.mode = id; savePrefs(); buildModes(); paintHome(); preview(); } },
      [el('span', { class: 'ic' }, MODE_ICON[id]()), el('span', null, [el('span', { class: 'nm', text: m.name }), el('span', { class: 'bl', text: m.blurb })]), check()]));
  }
}
function recText(n) { const r = rec[n]; if (!r || (!r.w && !r.l)) return '첫 판'; return `${r.w}승 ${r.l}패` + (r.streak >= 2 ? ` · ${r.streak}연승 중` : ''); }
function paintHome() {
  $('#pc0 .nm').textContent = prefs.names[0]; $('#pc0 .rc').textContent = recText(prefs.names[0]);
  $('#pc1 .nm').textContent = oppName(); $('#pc1 .rc').textContent = prefs.vsAI ? ['쉬움', '보통', '어려움'][prefs.level] + ' 난이도' : recText(prefs.names[1]);
  $('#segLvl').hidden = !prefs.vsAI; $('#segTarget').hidden = prefs.mode !== 'four';
  $('#clothSw').style.setProperty('--c', hex(CLOTHS[prefs.cloth].felt));
  $('#tableVal').textContent = (prefs.mode === 'four' ? '중대' : TABLES.find(t => t.id === prefs.table).short) + ' · ' + CLOTHS[prefs.cloth].name;
  $('#cueVal').textContent = CUES[prefs.cue].name;
  $('#guideVal').textContent = GUIDE[prefs.guide][0];
}
function cueCss(d) { return `linear-gradient(90deg,${hex(d.tip)} 0 4%,${hex(d.ferrule)} 4% 8%,${hex(d.shaft)} 8% 50%,${hex(d.joint)} 50% 53%,${hex(d.fore)} 53% 70%,${hex(d.wrap)} 70% 90%,${hex(d.sleeve)} 90%)`; }
function preview() {
  game.start(prefs.mode, [prefs.names[0], oppName()], false, {});
  scene.setTable(game.P); st.aim = 0; st.power = 0; st.rev++; scene.invalidate();
}
function goHome() {
  st.phase = 'home'; st.ai = null; st.cueAnim = null; closeSheet(); $('#spinPop').hidden = true;
  $('#result').hidden = true; $('#home').hidden = false; $('#hud').hidden = true;
  for (const id of ['#power', '#fine', '#spinBtn']) $(id).hidden = true;
  app.classList.add('busy'); store.set('save', null);
  buildModes(); paintHome(); preview(); layout();
}

/* ================= sheets ================= */
function openSheet(title, kids) { $('#sheetTitle').textContent = title; const b = $('#sheetBody'); b.textContent = ''; for (const k of [].concat(kids)) if (k) b.appendChild(k); $('#sheet').hidden = false; }
function closeSheet() { $('#sheet').hidden = true; }
$('#sheetX').addEventListener('click', () => { SND.tap(); closeSheet(); });
$('#sheet').addEventListener('click', e => { if (e.target === $('#sheet')) closeSheet(); });
const optBtn = (on, kids, fn) => el('button', { class: 'opt', 'aria-pressed': String(on), onclick: () => { SND.tap(); fn(); } }, kids);
const optText = (t, d) => el('span', null, [el('span', { class: 't', text: t }), d ? el('span', { class: 'd', text: d }) : null]);
const segRow = (label, opts, cur, fn) => el('div', { class: 'field' }, [el('div', { class: 'lab', text: label }),
  el('div', { class: 'seg' }, opts.map(([v, t]) => el('button', { 'aria-pressed': String(v === cur), text: t, onclick: () => { SND.tap(); fn(v); } })))]);

function sheetTable() {
  const four = prefs.mode === 'four';
  const sizes = four ? [el('p', { class: 'note', text: '4구는 포켓 없는 중대(254×127cm, 공 65.5mm)로 고정입니다.' })]
    : TABLES.map(t => optBtn(prefs.table === t.id, optText(t.name, t.d), () => { prefs.table = t.id; savePrefs(); PH.pool = poolOf(t.id); paintHome(); preview(); sheetTable(); }));
  openSheet('테이블', [el('div', { class: 'lab', text: '크기' }), ...sizes, el('div', { class: 'lab', text: '천 색' }),
    el('div', { class: 'grid2' }, CLOTHS.map((c, i) => optBtn(prefs.cloth === i,
      [el('i', { class: 'sw', style: `--c:${hex(c.felt)};--w:${hex(c.wood)}` }), optText(c.name)], () => { prefs.cloth = i; savePrefs(); scene.setCloth(i); paintHome(); sheetTable(); })))]);
}
function sheetCue() {
  openSheet('큐 고르기', CUES.map((c, i) => optBtn(prefs.cue === i,
    [el('i', { class: 'cuepic', style: '--c:' + cueCss(c) }), optText(c.name, c.note)], () => { prefs.cue = i; savePrefs(); scene.setCue(i); paintHome(); sheetCue(); })));
}
function sheetGuide() {
  openSheet('조준선 길이', GUIDE.map((gd, i) => optBtn(prefs.guide === i, optText(gd[0], gd[1]), () => { prefs.guide = i; savePrefs(); paintHome(); scene.invalidate(); sheetGuide(); })));
}
function sheetSettings() {
  openSheet('설정', [
    segRow('화면', [['dark', '다크'], ['light', '라이트']], prefs.theme, v => { prefs.theme = v; savePrefs(); applyTheme(); sheetSettings(); }),
    segRow('소리', [[true, '켬'], [false, '끔']], prefs.sound, v => { prefs.sound = v; savePrefs(); if (v) SND.init(); sheetSettings(); }),
    segRow('화질', [['auto', '자동'], ['high', '높음'], ['low', '낮음']], prefs.quality, v => { prefs.quality = v; savePrefs(); scene.setQuality(v); sheetSettings(); }),
    segRow('초당 프레임 표시', [[false, '끔'], [true, '켬']], prefs.fps, v => { prefs.fps = v; savePrefs(); $('#fps').hidden = !v; sheetSettings(); }),
    el('p', { class: 'note', text: '화질을 낮추면 움직임이 더 부드러워집니다. 자동은 기기 화면 크기에 맞춰 정합니다.' }),
  ]);
}
function sheetRecords() {
  const names = Object.keys(rec).filter(n => rec[n].w || rec[n].l).sort((a, b) => rec[b].w - rec[a].w);
  const grid = el('div', { class: 'rec' }, [el('span', { class: 'hd', text: '이름' }), el('span', { class: 'hd n', text: '승' }), el('span', { class: 'hd n', text: '패' }), el('span', { class: 'hd n', text: '최다 연승' })]);
  for (const n of names) { const r = rec[n]; grid.append(el('span', { text: n }), el('span', { class: 'n', text: r.w }), el('span', { class: 'n', text: r.l }), el('span', { class: 'n', text: r.best })); }
  openSheet('전적', [names.length ? grid : el('p', { class: 'note', text: '아직 끝난 판이 없습니다. 한 판 끝나면 이름별로 승패가 쌓입니다.' }),
    names.length ? el('button', { class: 'btn flat', text: '전적 모두 지우기', onclick: () => { rec = {}; store.set('rec', rec); series.key = ''; paintHome(); sheetRecords(); } }) : null]);
}
function sheetName(i) {
  if (i === 1 && prefs.vsAI) return;
  const input = el('input', { class: 'txt', id: 'nameInput', maxlength: '10', value: prefs.names[i], 'aria-label': '이름', autocomplete: 'off' });
  const save = () => { const v = input.value.trim().slice(0, 10); if (v && v !== prefs.names[1 - i]) { prefs.names[i] = v; savePrefs(); } closeSheet(); paintHome(); };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
  openSheet(`${i + 1}번 선수 이름`, [input, el('p', { class: 'note', text: '전적은 이름별로 따로 쌓입니다. 열 글자까지.' }), el('button', { class: 'btn cta', text: '저장', onclick: save })]);
  setTimeout(() => { try { input.focus(); input.select(); } catch (e) {} }, 60);
}
function sheetPause() {
  openSheet('잠깐 멈춤', [
    el('button', { class: 'btn cta', text: '이어서 하기', onclick: closeSheet }),
    el('div', { class: 'row' }, [el('button', { class: 'btn flat', text: '조준선 ' + GUIDE[prefs.guide][0], onclick: sheetGuide }), el('button', { class: 'btn flat', text: '설정', onclick: sheetSettings })]),
    el('div', { class: 'row' }, [el('button', { class: 'btn flat', text: '다시 시작', onclick: () => { closeSheet(); startMatch(game.turn); } }),
      el('button', { class: 'btn flat', text: '처음으로', onclick: goHome })]),
  ]);
}
$('#tableBtn').addEventListener('click', () => { SND.init(); SND.tap(); sheetTable(); });
$('#cueBtn').addEventListener('click', () => { SND.init(); SND.tap(); sheetCue(); });
$('#guideBtn').addEventListener('click', () => { SND.init(); SND.tap(); sheetGuide(); });
$('#setBtn').addEventListener('click', () => { SND.init(); SND.tap(); sheetSettings(); });
$('#recBtn').addEventListener('click', () => { SND.init(); SND.tap(); sheetRecords(); });
$('#pc0').addEventListener('click', () => { SND.init(); SND.tap(); sheetName(0); });
$('#pc1').addEventListener('click', () => { SND.init(); SND.tap(); sheetName(1); });
$('#menuBtn').addEventListener('click', () => { SND.tap(); sheetPause(); });
seg('#segOpp', () => prefs.vsAI ? 1 : 0, v => { prefs.vsAI = v === '1'; savePrefs(); paintHome(); });
seg('#segLvl', () => prefs.level, v => { prefs.level = +v; savePrefs(); paintHome(); });
seg('#segTarget', () => prefs.target, v => { prefs.target = +v; savePrefs(); });
$('#startBtn').addEventListener('click', () => { SND.init(); SND.tap(); startMatch(0); });
$('#againBtn').addEventListener('click', () => { SND.init(); SND.tap(); startMatch(st.lastLoser == null ? 0 : st.lastLoser); });
$('#homeBtn').addEventListener('click', () => { SND.tap(); goHome(); });

/* ================= match flow ================= */
function startMatch(first) {
  PH.pool = poolOf(prefs.table);
  const names = [prefs.names[0], oppName()], key = names.join('\u0001') + prefs.mode;
  if (series.key !== key) { series.key = key; series.s = [0, 0]; }
  game.start(prefs.mode, names, prefs.vsAI, { level: prefs.level, target: prefs.target, first: first || 0 });
  enterGame();
  toast(game.mode.id === 'four' ? `${game.players[game.turn].name}부터. 빨간 공 두 개를 모두 맞히세요.` : `${game.players[game.turn].name}의 브레이크. 테이블을 끌어 조준하고 큐 막대를 당겼다 놓으세요.`, '', 3600);
}
function enterGame() {
  scene.setTable(game.P);
  $('#home').hidden = true; $('#result').hidden = true; $('#hud').hidden = false; closeSheet();
  for (const id of ['#power', '#fine', '#spinBtn']) $(id).hidden = false;
  st.aim = 0; st.ai = null; st.cueAnim = null; st.rev++;
  st.phase = 'aim'; layout(); beginTurn(true);
}
function beginTurn(first) {
  st.phase = 'aim'; st.power = 0; st.spin = { x: 0, y: 0 }; setPowerUI(0); setSpinUI(); $('#spinPop').hidden = true;
  const p = game.players[game.turn], c = game.cueBall();
  if (p.ai) { st.phase = 'ai'; st.ai = { t: 0, plan: null, from: st.aim }; }
  else if (!first || game.mode.table === 'carom') {
    let best = null, bd = 1e9;
    for (const id of game.legal()) { const b = game.world.balls[id], d = Math.hypot(b.x - c.x, b.y - c.y); if (d < bd) { bd = d; best = b; } }
    if (best) st.aim = Math.atan2(best.y - c.y, best.x - c.x);
  }
  hud(); scene.invalidate(); snapshot();
}
function shoot(V, a, b) {
  game.beginShot(); st.phase = 'strike'; $('#spinPop').hidden = true;
  st.cueAnim = { t: 0, from: 0.03 + st.power * 0.2, V, a, b };
  hud();
}
function endShot() {
  const out = game.resolve(); st.rev++;
  if (game.over) return finish();
  toast(out.msg, out.kind, out.dur);
  beginTurn(false);
}
function finish() {
  st.phase = 'over';
  const w = game.over.winner, l = 1 - w, pw = game.players[w], pl = game.players[l];
  const rw = recOf(pw.name), rl = recOf(pl.name);
  rw.w++; rw.streak++; rw.best = Math.max(rw.best, rw.streak); rl.l++; rl.streak = 0; store.set('rec', rec);
  series.s[w]++; st.lastLoser = l; store.set('save', null);
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
  $('#hud').hidden = true; for (const id of ['#power', '#fine', '#spinBtn']) $(id).hidden = true; $('#spinPop').hidden = true;
  $('#result').hidden = false; app.classList.add('busy'); SND.win();
}

/* ================= scoreboard ================= */
function hud() {
  const m = game.mode;
  for (let i = 0; i < 2; i++) {
    const box = $('#p' + i), p = game.players[i], tray = box.querySelector('.tray'), pts = box.querySelector('.pts');
    box.classList.toggle('on', game.turn === i && st.phase !== 'over');
    box.querySelector('.nm').textContent = p.name; tray.textContent = ''; pts.textContent = '';
    let sub = '';
    if (m.id === 'eight') {
      const rem = m.remaining(game, i); sub = p.group ? game.GROUP_KO[p.group] + ' 공' : '공 미정';
      if (!rem) for (let k = 0; k < 7; k++) tray.appendChild(el('i', { class: 'mb slot' }));
      else if (!rem.length) tray.appendChild(el('i', { class: 'mb e8' }));
      else for (const id of rem) tray.appendChild(el('i', { class: 'mb' + (id > 8 ? ' st' : ''), style: '--c:' + ballCss(id) }));
    } else if (m.id === 'nine') { sub = game.turn === i ? `다음 ${m.lowest(game)}번 공` : `성공 ${p.made}`; }
    else { sub = `목표 ${game.target}점`; pts.textContent = p.score; }
    box.querySelector('.sub').textContent = sub;
  }
  const badge = $('#badge'); badge.textContent = '';
  badge.appendChild(el('b', { text: m.name }));
  if (m.id === 'nine') {
    badge.appendChild(document.createTextNode('다음'));
    const low = m.lowest(game); for (let id = 1; id <= 9; id++) if (game.world.balls[id].on) badge.appendChild(el('i', { class: 'mb' + (id > 8 ? ' st' : ''), style: `--c:${ballCss(id)};` + (id === low ? 'box-shadow:0 0 0 2px #ffd21f' : 'opacity:.55') }));
  } else if (m.id === 'eight') badge.appendChild(document.createTextNode(game.isBreak ? '브레이크' : game.players.every(p => !p.group) ? '아직 공 미정' : '8번은 마지막에'));
  else badge.appendChild(document.createTextNode('빨간 공 두 개 맞히면 1점'));
  app.classList.toggle('busy', !(st.phase === 'aim' && !game.players[game.turn].ai));
}
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

/* ================= computer turn ================= */
function aiTick(dt) {
  const a = st.ai; a.t += dt;
  if (!a.plan) {
    if (a.t < 0.5) return;
    a.plan = game.aiPlan(); a.t0 = a.t; a.pw = Math.min(1, game.powerOf(a.plan.V));
    if (a.plan.pos) { const c = game.cueBall(); c.x = c.px = a.plan.pos[0]; c.y = c.py = a.plan.pos[1]; game.placing = null; }
    let d = a.plan.angle - a.from; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; a.delta = d;
    return;
  }
  const t = a.t - a.t0, e = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
  st.aim = a.from + a.delta * e(t / 0.75);
  st.power = a.pw * e((t - 0.85) / 0.45); setPowerUI(st.power);
  if (t > 1.45) { st.aim = a.plan.angle; st.ai = null; shoot(a.plan.V, 0, 0); }
}

/* ================= input ================= */
let drag = null;
const humanAiming = () => st.phase === 'aim' && !game.players[game.turn].ai && $('#sheet').hidden;
function tryPlace(p) {
  const P = game.P, { R, HL, HW } = P, w = game.world, c = game.cueBall();
  let x = Math.max(-HL + R, Math.min(HL - R, p.x)), y = Math.max(-HW + R, Math.min(HW - R, p.y));
  if (game.placing === 'kitchen') x = Math.min(x, -HL / 2);
  if (P.isFree(w, x, y, c.id)) { c.x = c.px = x; c.y = c.py = y; return; }
  for (const b of w.balls) {
    if (!b.on || b.id === c.id) continue;
    const d = Math.hypot(x - b.x, y - b.y);
    if (d < 2 * R + 0.001 && d > 1e-6) { const k = (2 * R + 0.0012) / d, nx = b.x + (x - b.x) * k, ny = b.y + (y - b.y) * k; if (P.isFree(w, nx, ny, c.id) && (game.placing !== 'kitchen' || nx <= -HL / 2)) { c.x = c.px = nx; c.y = c.py = ny; } return; }
  }
}
canvas.addEventListener('pointerdown', e => {
  SND.init(); if (!humanAiming()) return;
  const R = game.P.R, p = scene.toTable(e, R), c = game.cueBall(), d = Math.hypot(p.x - c.x, p.y - c.y);
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  if (game.placing && d < Math.max(0.075, 26 / scene.ppm)) drag = { kind: 'cue', id: e.pointerId };
  else drag = { kind: 'aim', id: e.pointerId, last: Math.atan2(p.y - c.y, p.x - c.x), sx: e.clientX, sy: e.clientY, moved: 0 };
  e.preventDefault();
});
canvas.addEventListener('pointermove', e => {
  if (!drag || drag.id !== e.pointerId || !humanAiming()) return;
  const p = scene.toTable(e, game.P.R), c = game.cueBall();
  if (drag.kind === 'cue') tryPlace(p);
  else {
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
    $('#spinHint').textContent = '위는 밀어치기, 아래는 끌어치기, 좌우는 쿠션에서 꺾임. ' + (prefs.guide >= 3 ? '노란 점이 큐볼이 갈 길입니다.' : '조준선을 길게로 하면 큐볼이 갈 길이 보입니다.');
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
  if (st.phase === 'over') { goHome(); return true; }
  if (st.phase !== 'home') { sheetPause(); return true; }
  return false;
};

/* ================= frame loop ================= */
let lastT = 0, acc = 0, fpsN = 0, fpsT = 0;
function drain() {
  const s = game.world.snd; if (!s.length) return;
  for (const e of s) {
    if (e.t === 'ball') SND.ball(e.v); else if (e.t === 'rail') SND.rail(e.v);
    else if (e.t === 'pocket') { SND.pocket(); scene.fall(game.P, e); }
  }
  s.length = 0;
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - lastT) / 1000 || 0); lastT = now;
  const w = game.world, P = game.P, paused = !$('#sheet').hidden;
  let animating = false, alpha = 1, pull = 0.03 + st.power * 0.2;
  if (st.phase === 'ai' && !paused) { aiTick(dt); animating = true; }
  if (st.phase === 'strike' && !paused) {
    const ca = st.cueAnim; ca.t += dt; animating = true;
    const k = Math.min(1, ca.t / 0.1); pull = ca.from * (1 - k * k) - 0.004 * k;
    if (ca.t >= 0.1) { P.strike(w, st.aim, ca.V, ca.a, ca.b); SND.cue(ca.V); st.phase = 'sim'; acc = 0; st.settle = 0; st.power = 0; setPowerUI(0); }
  }
  if (st.phase === 'sim' && !paused) {
    // once everything is crawling, run the clock faster so nobody waits on the last roll
    let vmax = 0; for (const b of w.balls) if (b.on) { const s = Math.abs(b.vx) + Math.abs(b.vy); if (s > vmax) vmax = s; }
    acc += dt * (vmax < 0.4 ? 2.1 : 1.12);
    let n = 0; while (acc >= TICK && n < 30) { P.step(w, TICK); acc -= TICK; n++; }
    if (n === 30) acc = 0;
    alpha = acc / TICK; drain(); animating = true;
    if (P.rest(w) && !scene.falling) { st.settle += dt; if (st.settle > 0.12) endShot(); }
  }
  const aiming = st.phase === 'aim' || (st.phase === 'ai' && st.ai && st.ai.plan) || st.phase === 'strike' || st.phase === 'home';
  const drew = scene.frame({
    game, alpha, aim: st.aim, power: st.power, pull, spin: st.spin, rev: st.rev, animating,
    showCue: aiming, showGuide: (st.phase === 'aim' || (st.phase === 'ai' && st.ai && st.ai.plan)), level: prefs.guide,
    legalIds: st.phase === 'home' ? [] : game.legal(), hand: !!game.placing && st.phase === 'aim',
  }, dt);
  if (prefs.fps) {
    fpsN++; fpsT += dt;
    if (fpsT >= 0.5) { $('#fps').textContent = `${Math.round(fpsN / fpsT)} FPS · ${scene.pixelRatio.toFixed(2)}x` + (drew ? '' : ' · 대기'); fpsN = 0; fpsT = 0; }
  }
}

/* ================= saving ================= */
function snapshot() {
  if (st.phase === 'home' || st.phase === 'over') return;
  const d = { v: 2, game: game.serialize(), aim: st.aim, series, tbl: prefs.table };
  store.set('save', d);
  try { const h = window.claude && window.claude.hot; if (h && h.snapshot) h.snapshot(d); } catch (e) {}
}
function start(data) {
  if (!(data && data.v === 2)) data = store.get('save', null);
  $('#fps').hidden = !prefs.fps;
  if (data && data.v === 2 && TABLES.some(t => t.id === data.tbl)) { prefs.table = data.tbl; PH.pool = poolOf(data.tbl); }
  if (data && data.v === 2 && game.restore(data.game)) {
    if (data.series) { series.key = data.series.key; series.s = data.series.s; }
    prefs.mode = game.modeId; st.aim = data.aim || 0;
    enterGame();
  } else goHome();
  requestAnimationFrame(frame);
}
window.__dp8 = { game, st, prefs, scene, startMatch, goHome, shoot, endShot };
const hot = window.claude && window.claude.hot;
if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
})();
