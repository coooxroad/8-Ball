/* ================= the desk (prefs.ui 'desk', the 4.0 first screen) =================
   Four places along the top - 플레이, 훈련, 내 장비, 상점 - and every one laid out the same way: what to choose on the
   ivory rail, what it looks like in the felt tray (the live table, a cue, the swatches), and on the slate what it needs
   and the one button that does it. It is the same home underneath (prefs.mode, homePreview, the flows); only the way
   it is laid out is new. 상점 is a placeholder until there is something to sell. */
const deskOn = () => prefs.ui === 'desk';
const GAME4 = ['three', 'four', 'eight', 'nine'];
const GAME_SUB = { three: '쓰리쿠션', four: '사구 · 수지 대결', eight: '에잇볼', nine: '나인볼' };
let deskTab = null, gearSel = 'cue', gearCue = null, gearCloth = null, shopSel = 'cue';
const LESSONS = () => COURSES.flatMap(c => c[1]).filter(id => drills.byId(id).make);
const trainOf = () => prefs.mode === 'puzzle' ? 'puzzle' : prefs.mode === 'practice' ? (prefs.drill === 'free' ? 'free' : 'lesson') : null;
const svgArrow = d => { const s = el('span'); s.innerHTML = `<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="${d ? 'M8 4.5v15L19 12z' : 'M16 4.5v15L5 12z'}"/></svg>`; return s.firstChild; };

// the parts the slate is made of
const dkH1 = (t, sub) => [el('h1', { text: t }), sub ? el('div', { class: 'sub', text: sub }) : null];
const dkHr = () => el('div', { class: 'dk-hr' });
const dkLab = t => el('div', { class: 'dk-lab', text: t });
const dkTxt = (t, hi) => { const p = el('div', { class: 'dk-txt' }); p.textContent = t; if (hi) p.appendChild(el('b', { text: hi })); return p; };
const dkSeg = (opts, cur, fn) => el('div', { class: 'dk-seg' }, opts.map(([v, t, off]) => el('button', { 'aria-pressed': String(v === cur), text: t, disabled: off ? '' : null,
  onclick: () => { SND.init(); SND.tap(); fn(v); } })));
const dkStep = (vals, cur, fmt, fn, mini) => { const i = Math.max(0, vals.indexOf(cur));
  return el('div', { class: 'dk-step' + (mini ? ' mini' : '') }, [el('button', { 'aria-label': '줄이기', text: '−', disabled: i <= 0 ? '' : null, onclick: () => { SND.tap(); fn(vals[i - 1]); } }), el('b', { text: fmt(vals[i]) }),
    el('button', { 'aria-label': '늘리기', text: '+', disabled: i >= vals.length - 1 ? '' : null, onclick: () => { SND.tap(); fn(vals[i + 1]); } })]); };
const dkMain = (t, sub, fn, off) => el('button', { class: 'dk-main', disabled: off ? '' : null, onclick: () => { SND.init(); SND.tap(); fn(); } }, [document.createTextNode(t), sub ? el('small', { text: sub }) : null]);
const dkSec = (t, fn, sub) => el('button', { class: 'dk-sec', onclick: () => { SND.init(); SND.tap(); fn(); } }, [document.createTextNode(t), sub ? el('small', { text: sub }) : null]);
// the things laid on it: a cue as its photograph, the little cream tab on what is in use
const cueImg = (c, cls) => el('img', { class: cls || null, src: `ui/cue-${c.id}.webp`, alt: c.name, draggable: 'false' });
const eqTag = () => el('span', { class: 'eq', text: '장착' });
const dkRow = (lab, val, fn) => el('div', { class: 'dk-row' }, [el('span', { class: 'dk-lab', text: lab }), el('button', { class: 'dk-chip', text: val, onclick: () => { SND.init(); SND.tap(); fn(); } })]);
const guideRow = () => dkRow('조준선', guideName(prefs.guides[0]) === guideName(prefs.guides[1]) || prefs.vsAI ? guideName(prefs.guides[0]) : guideName(prefs.guides[0]) + ' · ' + guideName(prefs.guides[1]), sheetGuide);

function deskGo(tab) {
  if (tab === deskTab && st.screen === 'home') return;
  const was = deskTab; deskTab = tab; gearCue = gearCloth = null;
  const game4 = m => GAME4.includes(m);
  if (tab === 'play' && !game4(prefs.mode)) prefs.mode = game4(prefs.lastMode) ? prefs.lastMode : 'eight';
  if (tab === 'train' && !trainOf()) { if (game4(prefs.mode)) prefs.lastMode = prefs.mode; prefs.mode = prefs.lastTrain === 'practice' ? 'practice' : 'puzzle'; }
  savePrefs();
  if (st.screen !== 'home') return goHome(true);
  paintHome(); if (was === 'gear' || tab === 'play' || tab === 'train') homePreview();
}
// the rail: one button per choice, the chosen one inlaid with felt and its red dot
function railBtn(on, label, sub, fn, soon) {
  return el('button', { class: 'dk-rb' + (soon ? ' soon' : ''), 'aria-pressed': String(on), onclick: () => { SND.init(); SND.tap(); fn(); } }, [document.createTextNode(label), sub ? el('small', { text: sub }) : null]);
}
function deskPaint() {
  if (!deskOn()) return;
  if (!deskTab) deskTab = trainOf() ? 'train' : 'play';
  for (const b of document.querySelectorAll('#dkTabs .dk-tab')) b.setAttribute('aria-selected', String(st.screen === 'home' && b.dataset.t === deskTab));
  $('#dkRec').setAttribute('aria-pressed', String(st.screen === 'records'));
  $('#dkMe .nm').textContent = prefs.names[0]; $('#dkMe .rc').textContent = recText(prefs.names[0]);
  const rail = $('#dkRail'), head = $('#dkHead'), stage = $('#dkStage'), foot = $('#dkFoot'), slate = $('#dkSlate'), top = (slate.querySelector('.dk-body') || slate).scrollTop;
  for (const n of [rail, head, foot, slate]) n.textContent = '';
  for (const k of [...stage.children]) if (k.id !== 'dkShade') k.remove();
  stage.dataset.win = '1';                                           // the live table shows through, unless something else is laid in the tray
  head.className = 'dk-head';
  const put = (node, kids) => { for (const k of [].concat(kids)) if (k) node.appendChild(k); };
  const pick = m => () => { if (prefs.mode === m) return; prefs.mode = m; savePrefs(); paintHome(); homePreview(); };

  if (deskTab === 'play') {
    const m = GAME4.includes(prefs.mode) ? prefs.mode : 'eight', mm = game.MODES[m];
    put(rail, GAME4.map(id => railBtn(m === id, MODE_KO[id], null, pick(id))));
    put(head, el('div', { class: 'tt' }, [el('h2', { text: prefs.vsAI ? '컴퓨터와 플레이' : '친구와 플레이' }), el('small', { text: mm.blurb })]));
    // the two players, on plates at the foot of the tray
    const plate = i => { const nm = i ? oppName() : prefs.names[0], sub = m === 'four' ? `수지 ${sujiOf(i) * 10}` : i && prefs.vsAI ? LEVELS[prefs.level] : recText(nm);
      return el('button', { class: 'dk-plate' + (i ? ' two' : ''), onclick: () => { SND.init(); SND.tap(); sheetName(i); } }, [el('i', { class: 'av', text: String(i + 1) }), el('span', null, [el('b', { text: nm }), el('small', { text: sub })])]); };
    put(foot, [plate(0), el('span', { class: 'dk-vs', text: 'VS' }), plate(1)]);
    // the slate: who against, how far, the guide; and the button
    const d = store.get('save', null), canResume = !!(d && d.v === 2 && d.game && MODE_KO[d.game.modeId]);
    put(slate, dkH1(MODE_KO[m], GAME_SUB[m]));
    put(slate, [dkHr(), dkLab('상대'), dkSeg([['net', '온라인', true], ['friend', '친구'], ['ai', '컴퓨터']], prefs.vsAI ? 'ai' : 'friend', v => { prefs.vsAI = v === 'ai'; savePrefs(); paintHome(); })]);
    if (prefs.vsAI) put(slate, [dkLab('난이도'), dkSeg(LEVELS.map((t, i) => [i, t]), Math.min(3, prefs.level), v => { prefs.level = v; savePrefs(); paintHome(); })]);
    if (m === 'four') put(slate, [dkLab('수지 (각자 정하기)'),
      el('div', { class: 'dk-row' }, [el('span', { class: 'dk-txt', text: prefs.names[0] }), dkStep(SUJI, sujiOf(0), v => String(v * 10), v => { prefs.suji[prefs.names[0]] = v; savePrefs(); paintHome(); }, true)]),
      el('div', { class: 'dk-row' }, [el('span', { class: 'dk-txt', text: oppName() }), dkStep(SUJI, sujiOf(1), v => String(v * 10), v => { if (prefs.vsAI) prefs.sujiAI = v; else prefs.suji[prefs.names[1]] = v; savePrefs(); paintHome(); }, true)]),
      dkSeg([[0, '마무리 자유'], [1, '쿠션 마무리']], prefs.finish ? 1 : 0, v => { prefs.finish = v === 1; savePrefs(); paintHome(); })]);
    if (m === 'three') put(slate, [dkLab('목표 점수'), dkStep([3, 5, 10], [3, 5, 10].includes(prefs.target) ? prefs.target : 5, String, v => { prefs.target = v; savePrefs(); paintHome(); }),
      dkSeg([[0, '쿠션 자유'], [1, '원쿠션'], [3, '쓰리쿠션']], prefs.rule3, v => { prefs.rule3 = v; savePrefs(); paintHome(); })]);
    put(slate, [dkHr(), guideRow()]);
    const gm = canResume && d.game, rs = gm ? `${MODE_KO[gm.modeId]} · ${gm.players[0].name} vs ${gm.players[1].name}` : '';
    put(slate, el('div', { class: 'dk-acts' }, [dkMain('시작', `${MODE_KO[m]} · ${prefs.vsAI ? '컴퓨터 ' + LEVELS[prefs.level] : '친구와'}`, () => match.start(0)), canResume ? dkSec('이어서 하기', () => resume(d), rs) : null]));
  }

  if (deskTab === 'train') {
    const t = trainOf() || 'puzzle';
    put(rail, [railBtn(t === 'lesson', '레슨', null, () => { prefs.lastTrain = 'practice'; if (prefs.drill === 'free') prefs.drill = LESSONS()[0]; prefs.mode = 'practice'; savePrefs(); paintHome(); homePreview(); }),
      railBtn(t === 'puzzle', '퍼즐', null, () => { prefs.lastTrain = 'puzzle'; prefs.mode = 'puzzle'; savePrefs(); paintHome(); homePreview(); }),
      railBtn(t === 'free', '자유 연습', null, () => { prefs.lastTrain = 'practice'; prefs.mode = 'practice'; prefs.drill = 'free'; savePrefs(); paintHome(); homePreview(); })]);
    if (t === 'puzzle') {
      const z = prefs.pz, L = puzzles.list.filter(q => pzOpen(q.stage)), cur = puzzles.byId(z.cur) || puzzles.list[0], S = puzzles.STAGES[cur.stage];
      const go = dir => () => { const i = Math.max(0, L.indexOf(cur)), q = L[(i + dir + L.length) % L.length]; z.cur = q.id; z.open = q.stage; savePrefs(); paintHome(); homePreview(); };
      head.className = 'dk-head nav';
      put(head, [el('button', { class: 'dk-arrow', 'aria-label': '이전 문제', onclick: () => { SND.tap(); go(-1)(); } }, svgArrow(0)),
        el('div', { class: 'tt' }, [el('h2', { text: `${cur.stage + 1}-${cur.n}  ${S.name}` }), el('small', { text: `${puzzles.of(cur.stage).filter(q => z.stars[q.id]).length} / ${puzzles.of(cur.stage).length} 풀이` })]),
        el('button', { class: 'dk-arrow', 'aria-label': '다음 문제', onclick: () => { SND.tap(); go(1)(); } }, svgArrow(1))]);
      put(foot, puzzles.STAGES.map((s, si) => { const qs = puzzles.of(si), done = qs.filter(q => z.stars[q.id]).length, open = pzOpen(si);
        return el('button', { class: 'dk-pill' + (open ? '' : ' lock'), 'aria-pressed': String(si === cur.stage), onclick: () => { SND.init(); SND.tap();
          if (!open) return toast(`앞 스테이지에서 ${PZ_NEED}문제를 풀면 열립니다.`, '', 2200);
          const q = qs.find(x => !z.stars[x.id]) || qs[0]; z.cur = q.id; z.open = si; savePrefs(); paintHome(); homePreview(); } }, [document.createTextNode(`${si + 1}단계`), open ? el('small', { text: `${done}/${qs.length}` }) : el('img', { class: 'lock', src: 'ui/lock.webp', alt: '잠김' })]); }));
      const stars = z.stars[cur.id] || 0;
      put(slate, dkH1(S.name, `${cur.stage + 1}-${cur.n}번 문제`));
      put(slate, [dkHr(), dkLab('목표'), dkTxt(game.MODES.puzzle4.GOALS[S.goal].text + '. 노란 공은 건드리면 안 됩니다.'), dkHr(), dkLab('이 문제'), el('div', { class: 'dk-stars', 'aria-label': stars ? `별 ${stars}개 받음` : '아직 안 풂' }, [0, 1, 2].map(k => el('img', { src: k < stars ? 'ui/star.webp' : 'ui/star-off.webp', alt: '' })).concat(el('span', { text: stars ? '받음' : '아직 안 풂' }))), dkHr(), guideRow()]);
      put(slate, el('div', { class: 'dk-acts' }, [dkMain('퍼즐 풀기', `${cur.stage + 1}-${cur.n} ${S.name}`, () => puzzle.start())]));
    } else if (t === 'lesson') {
      const ids = LESSONS(), id = ids.includes(prefs.drill) ? prefs.drill : ids[0], dr = drills.byId(id), lv = levelOf(id);
      const go = dir => () => { prefs.drill = ids[(ids.indexOf(id) + dir + ids.length) % ids.length]; savePrefs(); paintHome(); homePreview(); };
      head.className = 'dk-head nav';
      put(head, [el('button', { class: 'dk-arrow', 'aria-label': '이전 레슨', onclick: () => { SND.tap(); go(-1)(); } }, svgArrow(0)),
        el('div', { class: 'tt' }, [el('h2', { text: dr.name }), el('small', { text: `${ids.indexOf(id) + 1} / ${ids.length}` })]),
        el('button', { class: 'dk-arrow', 'aria-label': '다음 레슨', onclick: () => { SND.tap(); go(1)(); } }, svgArrow(1))]);
      put(foot, el('div', { class: 'dk-dots' }, [document.createTextNode('단계'), ...Array.from({ length: drills.LEVELS }, (_, i) => el('i', { class: i < lv ? 'on' : '' })), document.createTextNode(`${lv} / ${drills.LEVELS}`)]));
      put(slate, dkH1(dr.name, (COURSES.find(c => c[1].includes(id)) || ['레슨'])[0]));
      put(slate, [dkHr(), dkTxt(dr.d), dr.tip ? dkHr() : null, dr.tip ? dkLab('요령') : null, dr.tip ? dkTxt(dr.tip) : null, dkHr(), guideRow()]);
      put(slate, el('div', { class: 'dk-acts' }, [dkMain('레슨 시작', `${dr.name} · ${lv}단계`, () => practice.start())]));
    } else {
      const dr = drills.byId('free');
      put(head, el('div', { class: 'tt' }, [el('h2', { text: '자유 연습' }), el('small', { text: '혼자서 마음대로' })]));
      put(slate, dkH1('자유 연습', '규칙 없음'));
      put(slate, [dkHr(), dkTxt(dr.d), dkHr(), guideRow()]);
      put(slate, el('div', { class: 'dk-acts' }, [dkMain('연습 시작', null, () => practice.start())]));
    }
  }

  if (deskTab === 'gear') {
    put(rail, [railBtn(gearSel === 'cue', '큐', null, () => { gearSel = 'cue'; gearCloth = null; dress(iceOn()); paintHome(); }),
      railBtn(gearSel === 'table', '테이블', null, () => { gearSel = 'table'; gearCue = null; paintHome(); })]);
    if (gearSel === 'cue') {
      const i = gearCue == null ? prefs.cues[0] : gearCue, c = CUES[i];
      put(head, el('div', { class: 'tt' }, [el('h2', { text: '큐 살펴보기' }), el('small', { text: `${i + 1} / ${CUES.length}` })]));
      stage.dataset.win = '0'; put(stage, [cueImg(c, 'cuebig'), el('div', { class: 'cuezoom' }, cueImg(c))]);
      put(foot, CUES.map((q, k) => el('button', { class: 'dk-sw', 'aria-pressed': String(k === i), onclick: () => { SND.init(); SND.tap(); gearCue = k; paintHome(); } }, [k === prefs.cues[0] ? eqTag() : null, el('i', { class: 'cuebox' }, cueImg(q)), document.createTextNode(q.name)])));
      const own = i === prefs.cues[0];
      put(slate, dkH1(c.name, '큐 외형'));
      put(slate, [dkHr(), dkTxt(c.note), dkHr(), dkTxt('플레이 성능은 모두 같습니다.'), dkHr(), dkTxt('현재 장착: ', CUES[prefs.cues[0]].name)]);
      put(slate, el('div', { class: 'dk-acts' }, [dkMain(own ? '장착 중' : '이 큐 장착', null, () => { prefs.cues[0] = i; prefs.cue = i; if (!prefs.vsAI && prefs.cues[1] === undefined) prefs.cues[1] = i; savePrefs(); useCue(i); gearCue = null; paintHome(); toast(`${c.name}를 들었습니다.`); }, own),
        gearCue != null && !own ? dkSec('미리보기 취소', () => { gearCue = null; paintHome(); }) : null]));
    } else {
      const i = gearCloth == null ? prefs.cloth : gearCloth, c = CLOTHS[i], carom = isCarom();
      put(head, [el('div', { class: 'tt' }, [el('h2', { text: '내 테이블' }), el('small', { text: carom ? (prefs.mode === 'three' ? '대대 284×142cm' : '중대 254×127cm') : TABLES.find(t => t.id === prefs.table).name })])]);
      put(foot, CLOTHS.map((q, k) => el('button', { class: 'dk-sw', 'aria-pressed': String(k === i), onclick: () => { SND.init(); SND.tap(); gearCloth = k === prefs.cloth ? null : k; paintHome(); } },
        [k === prefs.cloth ? eqTag() : null, el('i', { class: 'cloth', style: `background:${hex(q.felt)} url(ui/cloth-${q.id}.webp) 0 0/128px;border:5px solid ${hex(q.wood)}` }), document.createTextNode(q.name)])));
      scene.setCloth(i);
      const own = i === prefs.cloth;
      put(slate, dkH1(c.name, '테이블 천'));
      put(slate, [dkHr(), dkTxt(c.ice ? '빙판: 공이 미끄러져 오래 구르고 회전이 잘 먹지 않습니다. 대결에만 적용됩니다.' : '천 색은 보기만 다르고 공은 똑같이 구릅니다.')]);
      if (!carom) put(slate, [dkHr(), dkLab('포켓볼 테이블 크기'), dkSeg(TABLES.map(t => [t.id, t.short]), prefs.table, v => { prefs.table = v; savePrefs(); paintHome(); homePreview(); })]);
      put(slate, [dkHr(), dkTxt('현재 장착: ', CLOTHS[prefs.cloth].name)]);
      put(slate, el('div', { class: 'dk-acts' }, [dkMain(own ? '장착 중' : '이 테이블 장착', null, () => { prefs.cloth = i; savePrefs(); gearCloth = null; paintHome(); homePreview(); }, own),
        gearCloth != null ? dkSec('미리보기 취소', () => { gearCloth = null; dress(iceOn()); paintHome(); }) : null]));
    }
  }

  if (deskTab === 'shop') {
    put(rail, [railBtn(shopSel === 'cue', '큐', '준비 중', () => { shopSel = 'cue'; paintHome(); }, true), railBtn(shopSel === 'table', '테이블', '준비 중', () => { shopSel = 'table'; paintHome(); }, true)]);
    put(head, el('div', { class: 'tt' }, [el('h2', { text: shopSel === 'cue' ? '큐 진열대' : '테이블 천 진열대' }), el('small', { text: '곧 열립니다' })]));
    stage.dataset.win = '0';
    put(stage, el('div', { class: 'msg' }, [el('b', { text: '상점 준비 중' }), document.createTextNode('큐와 테이블 외형을 코인으로 살 수 있게 됩니다.'), document.createTextNode('플레이 성능은 모두 같습니다.')]));
    put(slate, dkH1('상점', '곧 열립니다'));
    put(slate, [dkHr(), dkTxt('지금 가진 큐와 천은 내 장비에서 바꿀 수 있습니다.')]);
    put(slate, el('div', { class: 'dk-acts' }, [dkMain('준비 중', null, () => {}, true), dkSec('내 장비로', () => deskGo('gear'))]));
  }
  // the slate: its options scroll if they must, its buttons stay put at the foot
  { const acts = slate.querySelector('.dk-acts'), body = el('div', { class: 'dk-body' }); while (slate.firstChild && slate.firstChild !== acts) body.appendChild(slate.firstChild); slate.insertBefore(body, acts); body.scrollTop = top; }
  if (st.screen === 'home') requestAnimationFrame(layout);          // the table sits in the tray, whose size the content just set
}
$('#dkTabs').addEventListener('click', e => { const b = e.target.closest('.dk-tab'); if (!b) return; SND.init(); SND.tap(); deskGo(b.dataset.t); });
press('#dkSet', sheetSettings);
press('#dkRec', () => { if (st.screen === 'records') goHome(true); else { showRecords(); deskPaint(); } });
press('#dkMe', () => sheetName(0));
