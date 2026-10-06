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
// a run of wins burns: red at two, yellow at three, mint at four, purple from five on
const fireOf = n => LAB.fire && n >= 2 ? ' fire f' + Math.min(5, n) : '';
const MODE_KO = { eight: '8볼', nine: '9볼', four: '4구', three: '3구' };
function paintResume() {
  const box = $('#resumeBox'), d = LAB.resume ? store.get('save', null) : null, ok = !!(d && d.v === 2 && d.game && MODE_KO[d.game.modeId] && prefs.mode !== 'practice' && prefs.mode !== 'puzzle');
  box.hidden = !ok; box.textContent = ''; if (!ok) return;
  const gm = d.game, ps = gm.players, tens = gm.tens ? 10 : 1, sc = gm.modeId === 'four' || gm.modeId === 'three' ? ` · ${ps[0].score * tens} : ${ps[1].score * tens}` : '';
  box.appendChild(el('button', { class: 'resume', onclick: () => { SND.init(); SND.tap(); resume(d); } }, [el('span', { class: 'k', text: '이어하기' }), el('b', { text: `${ps[0].name} vs ${ps[1].name}` }), el('span', { class: 'd', text: `${MODE_KO[gm.modeId]}${sc} · ${ps[gm.turn].name} 차례` })]));
  box.appendChild(el('button', { class: 'resume-x', 'aria-label': '하던 판 지우기', text: '×', onclick: () => { SND.tap(); store.set('save', null); paintResume(); } }));
}
// the puzzles on offer (the masse and jump stage goes when those shots are switched off), and which stages are open
const pzList = () => puzzles.list.filter(q => LAB.masse || !puzzles.STAGES[q.stage].trick), PZ_NEED = 5;
const pzOpen = si => si === 0 || !LAB.stage || puzzles.of(si - 1).filter(q => prefs.pz.stars[q.id]).length >= PZ_NEED;
const levelOf = id => Math.max(1, Math.min(drills.LEVELS, prefs.drillLv[id] || 1));
// lessons, grouped the way a course list is: what you learn first at the top
const COURSES = [['기본기', ['straight', 'cut', 'thin', 'side']], ['큐볼 다루기', ['stop', 'follow', 'draw', 'spin', 'position']], ['응용', ['bank', 'break']], ['자유롭게', ['free']]];
function paintHome() {
  const prac = prefs.mode === 'practice', puz = prefs.mode === 'puzzle';
  $('#vsBox').hidden = prac || puz; $('#pracList').hidden = !prac; $('#puzBox').hidden = !puz; $('#modeBox').hidden = prac || puz;
  $('#rightLab').textContent = prac ? '레슨' : puz ? '퍼즐' : '대결'; $('#startBtn').textContent = prac ? '레슨 시작' : puz ? '퍼즐 풀기' : '시작';
  paintNav(); paintResume();
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
    const box = $('#puzBox'), top = box.scrollTop, z = prefs.pz, L = pzList(), solved = L.filter(q => z.stars[q.id]).length, stars = L.reduce((a, q) => a + (z.stars[q.id] || 0), 0); box.textContent = '';
    if (!L.some(q => q.id === z.cur)) z.cur = L[0].id;
    box.appendChild(el('div', { class: 'pzsum' }, [el('div', null, [el('b', { text: `${solved}` }), el('span', { text: ` / ${L.length}` }), el('small', { text: '푼 퍼즐' })]), el('div', null, [el('b', { class: 'st', text: '★ ' + stars }), el('span', { text: ` / ${L.length * 3}` }), el('small', { text: '모은 별' })])]));
    const pickPz = q => { SND.init(); SND.tap(); z.cur = q.id; savePrefs(); paintHome(); homePreview(); };
    puzzles.STAGES.forEach((S, si) => {
      if (S.trick && !LAB.masse) return;
      const qs = puzzles.of(si), done = qs.filter(q => z.stars[q.id]).length, open = pzOpen(si);
      if (!LAB.stage) {   // the plain numbered board
        box.appendChild(el('div', { class: 'lab', text: S.name }));
        box.appendChild(el('div', { class: 'pzgrid' }, qs.map(q => el('button', { class: 'pz' + (z.stars[q.id] ? ' done' : ''), 'aria-pressed': String(z.cur === q.id), text: z.stars[q.id] ? '✓' : String(q.n), onclick: () => pickPz(q) }))));
        return;
      }
      // a stage: its number, what it is about, how far along; opened, its puzzles as stops along a winding road
      const shown = z.open === si;
      box.appendChild(el('button', { class: 'stg' + (shown ? ' open' : '') + (open ? '' : ' locked') + (done === qs.length ? ' clear' : ''), style: `--h:${[212, 156, 28, 268, 348, 190, 42][si % 7]}`, onclick: () => {
        SND.init(); SND.tap(); if (!open) return toast(`앞 스테이지에서 ${PZ_NEED}문제를 풀면 열립니다.`, '', 2200);
        z.open = shown ? -1 : si; if (!shown && !qs.some(q => q.id === z.cur)) { z.cur = (qs.find(q => !z.stars[q.id]) || qs[0]).id; homePreview(); } savePrefs(); paintHome();
      } }, [el('span', { class: 'no', text: open ? String(si + 1) : '🔒' }), el('span', { class: 'tx' }, [el('b', { text: S.name }), el('small', { text: open ? S.desc : `앞 스테이지 ${PZ_NEED}문제를 풀면 열립니다` })]),
        el('span', { class: 'pg' }, [el('em', { text: `${done}/${qs.length}` }), el('i', null, el('u', { style: `width:${Math.round(done / qs.length * 100)}%` }))])]));
      if (!shown || !open) return;
      const road = el('div', { class: 'road', style: `--h:${[212, 156, 28, 268, 348, 190, 42][si % 7]}` }), next = qs.find(q => !z.stars[q.id]);
      for (let r = 0; r * 5 < qs.length; r++) road.appendChild(el('div', { class: 'rw' + (r % 2 ? ' rev' : '') + ((r + 1) * 5 < qs.length ? ' more' : '') }, qs.slice(r * 5, r * 5 + 5).map(q => { const n = z.stars[q.id] || 0;
        return el('button', { class: 'nd' + (n ? ' done' : '') + (next && next.id === q.id ? ' next' : ''), 'aria-pressed': String(z.cur === q.id), onclick: () => pickPz(q) }, [el('b', { text: String(q.n) }), el('span', { class: 'sr', text: '★'.repeat(n) + '☆'.repeat(3 - n) })]); })));
      box.appendChild(road);
    });
    box.scrollTop = top;
    const cur = puzzles.byId(z.cur); if (cur) $('#startBtn').textContent = `${cur.stage + 1}-${cur.n} 풀기`;
  }
  const sujiOn = prefs.mode === 'four' && LAB.suji, sj = i => sujiOn ? `수지 ${sujiOf(i) * 10} · ` : '';
  $('#pc0 .nm').textContent = prefs.names[0]; $('#pc0 .rc').textContent = sj(0) + recText(prefs.names[0]);
  $('#pc1 .nm').textContent = oppName(); $('#pc1 .rc').textContent = sj(1) + (prefs.vsAI ? LEVELS[prefs.level] + ' 난이도' : recText(prefs.names[1]));
  for (let i = 0; i < 2; i++) { const r = rec[i === 1 && prefs.vsAI ? '컴퓨터' : prefs.names[i]]; $('#pc' + i).className = 'prow' + (i ? ' two' : '') + fireOf(r ? r.streak : 0); }
  $('#segLvl').hidden = !prefs.vsAI; $('#segTarget').hidden = !isCarom() || sujiOn; $('#segRule3').hidden = prefs.mode !== 'three';
  $('#segFinish').hidden = prefs.mode !== 'four'; $('#segMasse').hidden = !LAB.masse;
  for (const f of segPaint) f();
  $('#clothSw').style.setProperty('--c', hex(CLOTHS[prefs.cloth].felt));
  $('#tableVal').textContent = (isCarom() ? '중대' : TABLES.find(t => t.id === prefs.table).short) + ' · ' + CLOTHS[prefs.cloth].name;
  $('#cueVal').textContent = prefs.cues[0] === prefs.cues[1] || prefs.vsAI || prac || puz ? CUES[prefs.cues[0]].name : '각자';
  const gs = prefs.guides; $('#guideVal').textContent = gs[0] === gs[1] || prefs.vsAI || prac ? GUIDE[gs[0]][0] : GUIDE[gs[0]][0] + ' · ' + GUIDE[gs[1]][0];
}
// The table behind the home screen: the chosen game racked up, or the chosen drill being played over and over
// (a new layout each time, which is also what the drill itself does).
function homePreview() {
  PH.pool = poolOf(prefs.table); scene.clearFalls(); scene.setZone(null);
  st.phase = 'idle'; st.auto = null; st.cueAnim = null; st.power = 0; st.spin = { x: 0, y: 0 }; st.aim = 0;
  const d = drills.byId(prefs.drill);
  if (prefs.mode === 'puzzle') { flow = null; game.start('puzzle4', [prefs.names[0], ''], false, {}); dress(false); useCue(prefs.cues[0]); scene.setTable(game.P); puzzle.put(puzzles.byId(prefs.pz.cur) || puzzles.list[0]); return; }
  if (prefs.mode === 'practice' && d.make) {
    game.start('practice', [prefs.names[0], ''], false, {}); dress(false); scene.setTable(game.P);
    const L = drills.make(d.id, game.P, levelOf(d.id), Math.random, game.vOf);
    if (L) { flow = null; putLayout(L); scene.setZone(L.zone); playDemo(L.demo, { quiet: true, after: homePreview }); return; }
  }
  flow = null; scene.setMarks(null); useCue(prefs.cues[0]);
  const mode = game.MODES[prefs.mode] && prefs.mode !== 'practice' ? prefs.mode : 'eight', ice = iceOn();
  game.start(mode, [prefs.names[0], oppName()], false, { ice, levels: [2, 2], target: 99 });
  dress(ice); scene.setTable(game.P); st.rev++; scene.invalidate();
  if (LAB.demo) { game.players[0].ai = game.players[1].ai = true; flow = homeDemo; st.el = 0; hold(1.2, () => { if (flow === homeDemo && st.screen === 'home') beginTurn(true); }); }
}
// The table on the first screen plays itself: two computers at the hard level, one game after another, without a sound.
const homeDemo = {
  quiet: true, save: false, guide: () => 2, restart() {}, beforeShot() {}, hud() {},
  auto: () => ({ think: 0.9, showSpin: false, plan() { const p = game.aiPlan(); return { angle: p.angle, V: p.V, a: p.a || 0, b: p.b || 0, el: p.el || 0, pos: p.pos }; } }),
  afterShot() { game.resolve(); if (st.screen !== 'home') return; if (game.over) return hold(2.2, () => { if (flow === homeDemo && st.screen === 'home') homePreview(); }); useCue(prefs.cues[prefs.vsAI ? 0 : game.turn]); beginTurn(false); },
};
// leaving a game: `keep` leaves it saved so that it can be picked up again from the first screen
function goHome(keep) {
  if (!(keep === true && LAB.resume)) store.set('save', null);
  show('home'); buildModes(); paintHome(); homePreview();
}
function resume(d) {
  if (TABLES.some(t => t.id === d.tbl)) { prefs.table = d.tbl; PH.pool = poolOf(d.tbl); }
  st.phase = 'idle'; st.auto = null; st.afterHold = null; scene.clearFalls();
  if (!game.restore(d.game)) { store.set('save', null); return paintResume(); }
  if (d.series) { series.key = d.series.key; series.s = d.series.s; }
  match.ctx = { names: game.players.map(p => p.name), mode: game.modeId, ai: game.players[1].ai, target: game.target,
    targets: game.tens ? game.targets.slice() : null, finish: game.finish, ice: game.ice, masse: game.masse };
  const h = d.hl || {}; match.shots = h.shots || []; match.best = h.best || null; match.worst = h.worst || null; match.count = h.count || 0;
  prefs.mode = game.modeId; st.aim = d.aim || 0; match.enter();
}
