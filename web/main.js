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
const prefs = Object.assign({ drill: 'free', mode: 'eight', names: ['플레이어 1', '플레이어 2'], vsAI: false, level: 1, target: 10, table: 'bar', theme: 'dark', cloth: 0, cue: 0, guide: 2, sound: true, quality: 'auto', fps: false }, store.get('prefs', {}));

// Pool table sizes. Real regulation numbers: playing surface, ball diameter, pocket openings.
const TABLES = [
  { id: 'bar', name: '당구장 7피트', short: '7피트', d: '198×99cm · 공 57mm. 공이 크게 보이고 가장 쉽습니다.', cfg: { R: 0.028575, HL: 0.99, HW: 0.495, cornerMouth: 0.114, sideMouth: 0.127 } },
  { id: 'club', name: '클럽 8피트', short: '8피트', d: '224×112cm · 공 57mm. 동호인이 많이 쓰는 중간 크기.', cfg: { R: 0.028575, HL: 1.12, HW: 0.56, cornerMouth: 0.12, sideMouth: 0.133 } },
  { id: 'pro', name: '대회 9피트', short: '9피트', d: '254×127cm · 공 57mm. 프로 대회 규격, 가장 넓고 어렵습니다.', cfg: { R: 0.028575, HL: 1.27, HW: 0.635, cornerMouth: 0.127, sideMouth: 0.14 } },
  { id: 'pub', name: '영국식 6피트', short: '6피트', d: '183×91cm · 공 51mm. 작은 공에 좁은 포켓.', cfg: { R: 0.0254, HL: 0.915, HW: 0.4575, cornerMouth: 0.089, sideMouth: 0.095 } },
];
if (!TABLES.some(t => t.id === prefs.table)) prefs.table = 'bar';
// each player has their own guide length (a simple handicap)
if (!Array.isArray(prefs.guides) || prefs.guides.length !== 2) prefs.guides = [prefs.guide, prefs.guide];
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
const isPrac = () => game.modeId === 'practice';
const guideNow = () => { const p = game.players[game.turn]; return p && p.ai ? 2 : prefs.guides[isPrac() ? 0 : game.turn] ; };

const st = { phase: 'home', aim: 0, power: 0, spin: { x: 0, y: 0 }, cueAnim: null, ai: null, rev: 0, lastLoser: null, settle: 0 };

/* ================= sound ================= */
// Every hit is built once as a short waveform, the way the real thing is made: one very short push
// (balls touch for about 0.2 ms, a leather tip for about 1 ms, a rubber cushion for several ms) that sets a few
// quickly dying resonances ringing. A small "room" is added on the output so the hits do not sound dry.
const SND = (() => {
  let ac = null, out = null, buf = null, lastBall = 0, lastRail = 0;
  // parts: [frequency Hz, decay time s, level]; push: length of the contact in seconds
  function make(dur, push, parts, noise) {
    const sr = ac.sampleRate, n = Math.floor(dur * sr), b = ac.createBuffer(1, n, sr), d = b.getChannelData(0), pn = Math.max(2, Math.floor(push * sr));
    for (let i = 0; i < pn; i++) d[i] += Math.sin(Math.PI * i / pn) ** 2;                       // the push itself
    for (const [f, tau, amp] of parts) { const w = 2 * Math.PI * f / sr, k = 1 / (tau * sr), ph = Math.random() * 0.6; for (let i = 0; i < n; i++) d[i] += amp * Math.exp(-i * k) * Math.sin(w * i + ph) * Math.min(1, i / pn); }
    if (noise) { let lp = 0; for (let i = 0; i < n; i++) { lp += (Math.random() * 2 - 1 - lp) * noise[1]; d[i] += lp * noise[0] * Math.exp(-i / (noise[2] * sr)); } }
    let mx = 0; for (let i = 0; i < n; i++) mx = Math.max(mx, Math.abs(d[i]));
    const fade = Math.floor(0.004 * sr); for (let i = 0; i < n; i++) d[i] = d[i] / mx * (i > n - fade ? (n - i) / fade : 1);
    return b;
  }
  const jit = (parts, k) => parts.map(([f, t, a]) => [f * (1 + (Math.random() - 0.5) * k), t, a]);
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      const sr = ac.sampleRate;
      const lim = ac.createDynamicsCompressor(); lim.threshold.value = -9; lim.knee.value = 6; lim.ratio.value = 12; lim.attack.value = 0.001; lim.release.value = 0.08;
      lim.connect(ac.destination);
      out = ac.createGain(); out.connect(lim);
      // the room: a few early reflections off the table and walls, then a short dull tail
      const rn = Math.floor(0.32 * sr), ir = ac.createBuffer(2, rn, sr);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch); let lp = 0;
        for (let i = 0; i < rn; i++) { lp += (Math.random() * 2 - 1 - lp) * 0.35; d[i] = lp * Math.exp(-i / (0.055 * sr)) * 0.5; }
        for (const [ms, a] of [[3.1, 0.55], [7.4, 0.42], [12.6, 0.3], [19, 0.22], [27, 0.14]]) d[Math.floor((ms + ch * 0.7) * sr / 1000)] += a;
      }
      const conv = ac.createConvolver(); conv.buffer = ir; const wet = ac.createGain(); wet.gain.value = 0.2;
      out.connect(conv); conv.connect(wet); wet.connect(lim);
      // phenolic ball on ball: hard click, energy in the upper mids, almost no bass
      const ball = [[1480, 0.0042, 0.34], [2650, 0.0030, 0.6], [3900, 0.0021, 0.5], [5600, 0.0014, 0.34], [7900, 0.0009, 0.2], [760, 0.008, 0.16]];
      // leather tip on the cue ball: duller and lower, with the shaft knocking under it
      const cue = [[540, 0.011, 0.5], [980, 0.007, 0.42], [1750, 0.0038, 0.3], [2900, 0.002, 0.16], [300, 0.02, 0.2]];
      // rubber cushion: a soft thump
      const rail = [[290, 0.02, 0.5], [450, 0.014, 0.42], [720, 0.008, 0.22], [1150, 0.004, 0.1]];
      // pocket: the ball knocks the liner and drops
      const pock = [[330, 0.03, 0.5], [520, 0.02, 0.4], [860, 0.011, 0.25], [1500, 0.005, 0.12]];
      buf = {
        ball: [0, 1, 2, 3].map(() => make(0.06, 0.00022, jit(ball, 0.08))),
        cue: [0, 1].map(() => make(0.1, 0.0011, jit(cue, 0.06))),
        rail: [0, 1, 2].map(() => make(0.13, 0.004, jit(rail, 0.1), [0.25, 0.08, 0.02])),
        pock: [0, 1].map(() => make(0.2, 0.003, jit(pock, 0.08), [0.3, 0.12, 0.05])),
        roll: [make(0.28, 0.02, [[190, 0.09, 0.3]], [0.9, 0.05, 0.11])],
      };
    } catch (e) { ac = null; }
  }
  // play one prepared hit: softer hits are also duller, as the contact lasts longer
  function hit(name, gain, bright, at, rate) {
    if (!ac || !buf || !prefs.sound) return;
    const list = buf[name], s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), t = ac.currentTime + (at || 0);
    s.buffer = list[Math.floor(Math.random() * list.length)]; s.playbackRate.value = (rate || 1) * (0.97 + Math.random() * 0.06);
    f.type = 'lowpass'; f.frequency.value = bright; f.Q.value = 0.5; g.gain.value = gain;
    s.connect(f); f.connect(g); g.connect(out); s.start(t);
  }
  function tone(freq, dur, gain, to, at) {
    if (!ac || !prefs.sound) return;
    const t = ac.currentTime + (at || 0), o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * (to || 0.6), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.0015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  return {
    init,
    ball(v) { const n = performance.now(); if (n - lastBall < 9) return; lastBall = n; const k = Math.min(1, v / 5); hit('ball', 0.1 + 0.9 * Math.pow(k, 0.7), 2600 + 9000 * Math.pow(k, 0.6)); },
    rail(v) { const n = performance.now(); if (n - lastRail < 25) return; lastRail = n; const k = Math.min(1, v / 4); hit('rail', 0.14 + 0.7 * Math.pow(k, 0.8), 900 + 2200 * k); },
    pocket() { hit('pock', 0.75, 3200); hit('roll', 0.3, 1400, 0.03); hit('ball', 0.22, 3000, 0.16, 0.8); },
    cue(v) { const k = Math.min(1, v / 9); hit('cue', 0.4 + 0.6 * k, 1800 + 4200 * k); },
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
    box.appendChild(el('button', { class: 'gcard', 'aria-pressed': String(prefs.mode === id), onclick: () => { SND.init(); SND.tap(); prefs.mode = id; savePrefs(); buildModes(); paintHome(); preview(); } },
      [el('span', { class: 'ic' }, MODE_ICON[id]()), el('span', null, [el('span', { class: 'nm', text: m.name }), el('span', { class: 'bl', text: m.blurb })]), check()]));
  }
}
function recText(n) { const r = rec[n]; if (!r || (!r.w && !r.l)) return '첫 판'; return `${r.w}승 ${r.l}패` + (r.streak >= 2 ? ` · ${r.streak}연승 중` : ''); }
function paintHome() {
  $('#pc0 .nm').textContent = prefs.names[0]; $('#pc0 .rc').textContent = recText(prefs.names[0]);
  $('#pc1 .nm').textContent = oppName(); $('#pc1 .rc').textContent = prefs.vsAI ? ['쉬움', '보통', '어려움'][prefs.level] + ' 난이도' : recText(prefs.names[1]);
  const prac = prefs.mode === 'practice';
  $('#vsBox').hidden = prac; $('#pracList').hidden = !prac; $('#rightLab').textContent = prac ? '연습 고르기' : '대결';
  if (prac) {
    const box = $('#pracList'); box.textContent = '';
    for (const d of DRILLS) box.appendChild(optBtn(prefs.drill === d.id, optText(d.name, d.d), () => { prefs.drill = d.id; savePrefs(); paintHome(); }));
  }
  $('#segLvl').hidden = !prefs.vsAI; $('#segTarget').hidden = prefs.mode !== 'four';
  $('#clothSw').style.setProperty('--c', hex(CLOTHS[prefs.cloth].felt));
  $('#tableVal').textContent = (prefs.mode === 'four' ? '중대' : TABLES.find(t => t.id === prefs.table).short) + ' · ' + CLOTHS[prefs.cloth].name;
  $('#cueVal').textContent = CUES[prefs.cue].name;
  const gs = prefs.guides; $('#guideVal').textContent = gs[0] === gs[1] || prefs.vsAI || prac ? GUIDE[gs[0]][0] : GUIDE[gs[0]][0] + ' · ' + GUIDE[gs[1]][0];
}
function cueCss(d) { return `linear-gradient(90deg,${hex(d.tip)} 0 4%,${hex(d.ferrule)} 4% 8%,${hex(d.shaft)} 8% 50%,${hex(d.joint)} 50% 53%,${hex(d.fore)} 53% 70%,${hex(d.wrap)} 70% 90%,${hex(d.sleeve)} 90%)`; }
function preview() {
  game.start(prefs.mode === 'practice' ? 'eight' : prefs.mode, [prefs.names[0], oppName()], false, {});
  scene.setTable(game.P); st.aim = 0; st.power = 0; st.rev++; scene.invalidate();
}
function goHome() {
  st.phase = 'home'; prac.on = false; scene.setZone(null); $('#pracBar').hidden = true; $('#p1').hidden = false; st.ai = null; st.cueAnim = null; closeSheet(); $('#spinPop').hidden = true;
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
  const solo = prefs.vsAI || prefs.mode === 'practice' || isPrac();
  const row = i => segRow(solo ? '조준선' : prefs.names[i], GUIDE.map((gd, k) => [k, gd[0]]), prefs.guides[i], v => { prefs.guides[i] = v; if (solo) prefs.guides[1] = v; savePrefs(); paintHome(); scene.invalidate(); sheetGuide(); });
  openSheet('조준선 길이', [row(0), solo ? null : row(1),
    el('p', { class: 'note', text: GUIDE.map(gd => gd[0] + ': ' + gd[1]).join(' · ') }),
    solo ? null : el('p', { class: 'note', text: '실력 차이가 나면 잘하는 쪽을 짧게, 처음 하는 쪽을 길게 두세요.' })]);
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
    el('div', { class: 'row' }, [el('button', { class: 'btn flat', text: '조준선', onclick: sheetGuide }), el('button', { class: 'btn flat', text: '설정', onclick: sheetSettings })]),
    el('div', { class: 'row' }, [el('button', { class: 'btn flat', text: '다시 시작', onclick: () => { closeSheet(); if (isPrac()) startPractice(); else startMatch(game.turn); } }),
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
$('#startBtn').addEventListener('click', () => { SND.init(); SND.tap(); if (prefs.mode === 'practice') startPractice(); else startMatch(0); });
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
  if (isPrac()) { prac.before = game.world.balls.map(x => [x.x, x.y, x.on]); prac.beforeAim = st.aim; }
  game.beginShot(); st.phase = 'strike'; $('#spinPop').hidden = true;
  st.cueAnim = { t: 0, from: 0.03 + st.power * 0.2, V, a, b };
  hud();
}
function endShot() {
  if (isPrac()) {
    const j = pracJudge(); game.resolve(); st.rev++;
    if (!j) return beginTurn(false);
    toast(j.msg, j.kind, 1700); SND.tap(); st.phase = 'hold'; st.holdT = 1.5; hud(); return;   // leave the result on the table for a moment
  }
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

/* ================= practice ================= */
// A drill puts balls on the table and says what counts as success. Positions are fractions of the table, so every size works.
const prac = { on: false, drill: null, tries: 0, ok: 0, before: null, zone: null, need: null, edit: false, tip: '' };
const DRILLS = (() => {
  const corner = P => P.POCKETS.reduce((a, p) => (p.x + p.y > a.x + a.y ? p : a));
  const side = P => P.POCKETS.reduce((a, p) => (p.y - Math.abs(p.x) * 4 > a.y - Math.abs(a.x) * 4 ? p : a));
  const unit = (ax, ay, bx, by) => { const l = Math.hypot(bx - ax, by - ay); return [(bx - ax) / l, (by - ay) / l]; };
  const rot = (u, deg) => { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [u[0] * c - u[1] * s, u[0] * s + u[1] * c]; };
  // object ball O going to pocket K, cue ball `dist` behind the contact point and `cut` degrees off the straight line
  function shotTo(P, O, K, dist, cut) {
    const u = unit(O[0], O[1], K.x, K.y), G = [O[0] - u[0] * 2 * P.R, O[1] - u[1] * 2 * P.R], back = rot([-u[0], -u[1]], cut || 0);
    return { u, G, cue: [G[0] + back[0] * dist, G[1] + back[1] * dist] };
  }
  return [
    { id: 'free', name: '자유 연습', d: '규칙 없이 마음대로. 공을 옮기고 한 수 되돌릴 수 있습니다.' },
    { id: 'straight', name: '똑바로 넣기', d: '일직선으로 놓인 공을 넣습니다.', tip: '공 가운데를 겨누고 중간 세기로. 너무 세면 큐볼도 따라 들어갑니다.',
      build(P) { const K = corner(P), O = [P.HL * 0.42, P.HW * 0.2], s = shotTo(P, O, K, 0.5, 0); return { cue: s.cue, balls: [[1, O]], need: { pot: 1 } }; } },
    { id: 'stop', name: '스톱 샷', d: '공을 넣고 큐볼을 그 자리에 세웁니다.', tip: '큐볼 가운데보다 살짝 아래를 조금 세게. 큐볼이 원 안에 서야 합니다.',
      build(P) { const K = corner(P), O = [P.HL * 0.3, P.HW * 0.05], s = shotTo(P, O, K, 0.38, 0); return { cue: s.cue, balls: [[1, O]], need: { pot: 1 }, zone: { x: s.G[0], y: s.G[1], r: 0.1 } }; } },
    { id: 'follow', name: '밀어치기', d: '공을 넣고 큐볼을 앞으로 보냅니다.', tip: '큐볼 위쪽을 칩니다. 맞힌 뒤 큐볼이 따라가 원 안에 서야 합니다.',
      build(P) { const K = corner(P), O = [-P.HL * 0.1, -P.HW * 0.25], s = shotTo(P, O, K, 0.36, 0); return { cue: s.cue, balls: [[1, O]], need: { pot: 1 }, zone: { x: O[0] + s.u[0] * 0.34, y: O[1] + s.u[1] * 0.34, r: 0.15 } }; } },
    { id: 'draw', name: '끌어치기', d: '공을 넣고 큐볼을 뒤로 당겨 옵니다.', tip: '큐볼 맨 아래를 세게. 맞힌 뒤 큐볼이 되돌아와 원 안에 서야 합니다.',
      build(P) { const K = corner(P), O = [P.HL * 0.25, 0], s = shotTo(P, O, K, 0.3, 0); return { cue: s.cue, balls: [[1, O]], need: { pot: 1 }, zone: { x: O[0] - s.u[0] * 0.62, y: O[1] - s.u[1] * 0.62, r: 0.17 } }; } },
    { id: 'cut', name: '비껴 넣기', d: '비스듬히 놓인 공을 넣습니다.', tip: '공 가운데가 아니라, 포켓 반대쪽 옆구리를 겨눕니다.',
      build(P) { const K = corner(P), O = [P.HL * 0.5, P.HW * 0.3], s = shotTo(P, O, K, 0.45, 30); return { cue: s.cue, balls: [[1, O]], need: { pot: 1 } }; } },
    { id: 'thin', name: '얇게 치기', d: '많이 비껴 놓인 공을 살짝 스쳐 넣습니다.', tip: '공 가장자리만 스치게. 얇을수록 공은 느리게 가니 조금 세게 칩니다.',
      build(P) { const K = corner(P), O = [P.HL * 0.55, P.HW * 0.45], s = shotTo(P, O, K, 0.42, -55); return { cue: s.cue, balls: [[1, O]], need: { pot: 1 } }; } },
    { id: 'side', name: '사이드 포켓', d: '가운데 포켓은 입구가 각도에 따라 좁아집니다.', tip: '포켓 정면에 가까울수록 쉽습니다. 턱에 맞지 않게 가운데로.',
      build(P) { const K = side(P), O = [K.x - 0.2, K.y - 0.34], s = shotTo(P, O, K, 0.45, 22); return { cue: s.cue, balls: [[1, O]], need: { pot: 1 } }; } },
    { id: 'bank', name: '뱅크 샷', d: '공을 쿠션에 한 번 튕겨 넣습니다.', tip: '반대쪽 쿠션에 튕겨 가운데 포켓으로. 포켓을 쿠션 건너편에 비춘 자리를 겨눈다고 생각하세요.',
      build(P) {
        const K = side(P), O = [P.HL * 0.3, -P.HW * 0.35], my = -2 * (P.HW - P.R) - K.y, u = unit(O[0], O[1], K.x, my);
        return { cue: [O[0] - u[0] * 0.4, O[1] - u[1] * 0.4], balls: [[1, O]], need: { pot: 1, bank: 1 } };
      } },
    { id: 'spin', name: '옆 회전', d: '쿠션에 수직으로 쳐도 회전을 주면 옆으로 꺾입니다.', tip: '쿠션을 똑바로 겨눈 채 큐볼 오른쪽을 칩니다. 튕겨 나온 큐볼이 원 안에 서야 합니다.',
      build(P) { return { cue: [0, -P.HW * 0.2], balls: [], aim: Math.PI / 2, need: {}, nominal: { power: 0.42, a: 0.4, b: 0, r: 0.17 } }; } },
    { id: 'position', name: '다음 공 자리 잡기', d: '1번을 넣고, 2번을 치기 좋은 곳에 큐볼을 세웁니다.', tip: '세기만 맞추면 됩니다. 1번을 넣은 큐볼이 원 안에 서야 합니다.',
      build(P) { const K = corner(P), O = [P.HL * 0.55, P.HW * 0.35], s = shotTo(P, O, K, 0.45, 32); return { cue: s.cue, balls: [[1, O], [2, [-P.HL * 0.45, P.HW * 0.55]]], need: { pot: 1 }, nominal: { at: s.G, power: 0.4, a: 0, b: 0, r: 0.24 } }; } },
    { id: 'break', name: '브레이크', d: '공을 깨서 하나 이상 넣습니다.', tip: '맨 앞 공을 정면으로, 가장 세게. 큐볼이 빠지면 실패입니다.',
      build() { return { rack: true, need: { any: 1 } }; } },
  ];
})();
if (!DRILLS.some(d => d.id === prefs.drill)) prefs.drill = 'free';
function loadDrill() {
  const d = prac.drill, P = game.P, w = game.world;
  game.MODES.practice.setup(game, Math.random); prac.zone = null; prac.need = null; prac.before = null; st.aim = 0;
  if (d.id === 'free') { game.MODES.eight.setup(game, Math.random); game.placing = null; game.isBreak = false; }
  else {
    const b = d.build(P); prac.need = b.need;
    if (b.rack) { game.MODES.eight.setup(game, Math.random); game.placing = null; }
    else {
      P.place(w, 0, b.cue[0], b.cue[1], Math.random);
      for (const [id, o] of b.balls) P.place(w, id, o[0], o[1], Math.random);
      const first = b.balls[0]; st.aim = b.aim != null ? b.aim : Math.atan2(first[1][1] - b.cue[1], first[1][0] - b.cue[0]);
    }
    if (b.zone) prac.zone = b.zone;
    if (b.nominal) {                               // the target is where a sensible shot leaves the cue ball
      const n = b.nominal, w2 = P.clone(w), ang = n.at ? Math.atan2(n.at[1] - b.cue[1], n.at[0] - b.cue[0]) : st.aim;
      P.strike(w2, ang, game.vOf(n.power), n.a, n.b); P.run(w2, 20);
      prac.zone = { x: w2.balls[0].x, y: w2.balls[0].y, r: n.r };
    }
  }
  scene.setZone(prac.zone); st.rev++;
  beginTurn(true);
}
function startPractice(id) {
  PH.pool = poolOf(prefs.table);
  if (id) { prefs.drill = id; savePrefs(); }
  prac.on = true; prac.drill = DRILLS.find(d => d.id === prefs.drill) || DRILLS[0]; prac.tries = 0; prac.ok = 0; prac.edit = false;
  game.start('practice', [prefs.names[0], ''], false, {});
  enterGame(); loadDrill(); pracBar();
  toast(prac.drill.tip || '규칙 없이 자유롭게 칩니다. "옮기기"를 켜면 공을 끌어 옮길 수 있습니다.', '', 5200);
}
function pracBar() {
  const box = $('#pracBar'); box.textContent = ''; box.hidden = false; $('#p1').hidden = true;
  const btn = (text, fn, on) => box.appendChild(el('button', { class: 'btn', text, 'aria-pressed': String(!!on), onclick: () => { SND.tap(); fn(); } }));
  if (prac.drill.id === 'free') {
    btn('되돌리기', pracUndo);
    btn('옮기기', () => { prac.edit = !prac.edit; pracBar(); if (prac.edit) toast('공을 끌어 옮깁니다. 테이블 밖으로 끌면 빠집니다.', '', 2600); }, prac.edit);
    btn('공 놓기', sheetRack);
  } else {
    btn('다시', () => { if (st.phase === 'aim') loadDrill(); });
    btn('설명', () => toast(prac.drill.tip, '', 5200));
    btn('다음', () => { const i = DRILLS.indexOf(prac.drill); startPractice(DRILLS[i + 1 < DRILLS.length ? i + 1 : 1].id); });
  }
}
function pracUndo() {
  if (st.phase !== 'aim' || !prac.before) return toast('되돌릴 샷이 없습니다.', '', 1400);
  prac.before.forEach((s, i) => { const b = game.world.balls[i]; b.x = b.px = s[0]; b.y = b.py = s[1]; b.on = s[2]; b.vx = b.vy = b.wx = b.wy = b.wz = 0; });
  st.aim = prac.beforeAim; st.rev++; hud(); scene.invalidate();
}
function sheetRack() {
  const P = game.P, w = game.world, done = () => { closeSheet(); st.rev++; hud(); scene.invalidate(); };
  const clear = () => { for (let i = 1; i < 16; i++) { w.balls[i].on = false; w.balls[i].x = w.balls[i].px = 9 + i; } };
  openSheet('공 놓기', [
    el('button', { class: 'btn flat', text: '8볼 모양으로 15개', onclick: () => { game.MODES.eight.setup(game, Math.random); game.placing = null; game.isBreak = false; done(); } }),
    el('button', { class: 'btn flat', text: '9볼 모양으로 9개', onclick: () => { clear(); const g2 = { P, world: w }; game.MODES.nine.setup(g2, Math.random); done(); } }),
    el('button', { class: 'btn flat', text: '공 하나 더 놓기', onclick: () => {
      const b = w.balls.find(x => x.id > 0 && !x.on); if (!b) return toast('공 15개가 모두 올라와 있습니다.', '', 1600);
      const [x, y] = P.findFree(w, P.HL * 0.3, 0, b.id); P.place(w, b.id, x, y, Math.random); done();
    } }),
    el('button', { class: 'btn flat', text: '큐볼만 남기고 치우기', onclick: () => { clear(); done(); } }),
    el('p', { class: 'note', text: '놓은 뒤 "옮기기"를 켜고 원하는 자리로 끌어 옮기세요.' }),
  ]);
}
// called when the balls have stopped, before the rules tidy the table
function pracJudge() {
  const d = prac.drill, ev = game.world.ev, c = game.world.balls[0], need = prac.need;
  if (d.id === 'free') return null;
  const potted = ev.pocketed.map(p => p.id), scratch = potted.includes(0);
  let why = '';
  if (scratch) why = '큐볼이 포켓에 빠졌습니다';
  else if (need.pot && !potted.includes(need.pot)) why = `${need.pot}번 공이 들어가지 않았습니다`;
  else if (need.any && potted.length < need.any) why = '들어간 공이 없습니다';
  else if (need.bank && !ev.railed.includes(need.bank)) why = '쿠션에 튕기지 않고 들어갔습니다';
  else if (prac.zone && Math.hypot(c.x - prac.zone.x, c.y - prac.zone.y) > prac.zone.r) why = '큐볼이 원 밖에 섰습니다';
  prac.tries++; if (!why) prac.ok++;
  return why ? { msg: '실패 · ' + why, kind: 'foul' } : { msg: `성공! ${prac.ok}번째`, kind: 'good' };
}

/* ================= scoreboard ================= */
function hud() {
  const m = game.mode;
  if (m.id === 'practice') {
    const box = $('#p0'), free = prac.drill.id === 'free';
    box.classList.add('on'); box.querySelector('.nm').textContent = prac.drill.name; box.querySelector('.tray').textContent = ''; box.querySelector('.pts').textContent = '';
    box.querySelector('.sub').textContent = free ? '규칙 없음' : `성공 ${prac.ok} / ${prac.tries}`;
    const badge = $('#badge'); badge.textContent = ''; badge.appendChild(el('b', { text: '연습' })); badge.appendChild(document.createTextNode(free ? '자유롭게' : prac.drill.d));
    app.classList.toggle('busy', st.phase !== 'aim'); return;
  }
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
function tryPlace(p, ball) {
  const P = game.P, { R, HL, HW } = P, w = game.world, c = ball || game.cueBall();
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
  const near = Math.max(0.075, 26 / scene.ppm);
  let pick = null; if (isPrac() && prac.edit) { let bd = near; for (const b of game.world.balls) if (b.on) { const q = Math.hypot(p.x - b.x, p.y - b.y); if (q < bd) { bd = q; pick = b; } } }
  if (pick) drag = { kind: 'ball', id: e.pointerId, ball: pick };
  else if (game.placing && d < near) drag = { kind: 'cue', id: e.pointerId };
  else drag = { kind: 'aim', id: e.pointerId, last: Math.atan2(p.y - c.y, p.x - c.x), sx: e.clientX, sy: e.clientY, moved: 0 };
  e.preventDefault();
});
canvas.addEventListener('pointermove', e => {
  if (!drag || drag.id !== e.pointerId || !humanAiming()) return;
  const p = scene.toTable(e, game.P.R), c = game.cueBall();
  if (drag.kind === 'cue') tryPlace(p);
  else if (drag.kind === 'ball') {
    const b = drag.ball, P = game.P, out = Math.abs(p.x) > P.HL + 4 * P.R || Math.abs(p.y) > P.HW + 4 * P.R;
    if (out && b.id !== 0) { b.on = false; b.x = b.px = 9 + b.id; drag = null; st.rev++; hud(); scene.invalidate(); return; }
    tryPlace(p, b); st.rev++;
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
    $('#spinHint').textContent = '위는 밀어치기, 아래는 끌어치기, 좌우는 쿠션에서 꺾임. ' + (guideNow() >= 3 ? '노란 점이 큐볼이 갈 길입니다.' : '조준선을 길게로 하면 큐볼이 갈 길이 보입니다.');
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
  if (st.phase === 'hold' && !paused) { st.holdT -= dt; animating = true; if (st.holdT <= 0) loadDrill(); }
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
    showCue: aiming, showGuide: (st.phase === 'aim' || (st.phase === 'ai' && st.ai && st.ai.plan)), level: guideNow(),
    legalIds: st.phase === 'home' ? [] : game.legal(), hand: !!game.placing && st.phase === 'aim',
  }, dt);
  if (prefs.fps) {
    fpsN++; fpsT += dt;
    if (fpsT >= 0.5) { $('#fps').textContent = `${Math.round(fpsN / fpsT)} FPS · ${scene.pixelRatio.toFixed(2)}x` + (drew ? '' : ' · 대기'); fpsN = 0; fpsT = 0; }
  }
}

/* ================= saving ================= */
function snapshot() {
  if (st.phase === 'home' || st.phase === 'over' || isPrac()) return;
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
window.__dp8 = { game, st, prefs, scene, startMatch, startPractice, goHome, shoot, endShot, prac, DRILLS };
const hot = window.claude && window.claude.hot;
if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
})();
