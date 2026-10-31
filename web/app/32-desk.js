/* ================= the desk (prefs.ui 'desk', the 4.0 first screen) =================
   Four places along the top - 플레이, 훈련, 내 장비, 상점 - and every one laid out the same way: what to choose on the
   ivory rail, what it looks like in the felt tray (the live table, a cue, the swatches), and on the slate what it needs
   and the one button that does it. It is the same home underneath (prefs.mode, homePreview, the flows); only the way
   it is laid out is new. 상점 is a placeholder until there is something to sell. */
const deskOn = () => true;                                           // (the desk is the only first screen; the lobby and the classic home are gone)
app.classList.add('desk');
const GAME4 = ['three', 'four', 'eight', 'nine'];
const GAME_SUB = { three: '쓰리쿠션', four: '사구 · 수지 대결', eight: '에잇볼', nine: '나인볼' };
let deskTab = null, gearSel = 'cue', shopSel = 'cue';
const LESSONS = () => COURSES.flatMap(c => c[1]).filter(id => drills.byId(id).make);
const trainOf = () => prefs.mode === 'puzzle' ? 'puzzle' : prefs.mode === 'practice' ? (prefs.drill === 'free' ? 'free' : 'lesson') : null;
const svgArrow = d => { const s = el('span'); s.innerHTML = `<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="${d ? 'M8 4.5v15L19 12z' : 'M16 4.5v15L5 12z'}"/></svg>`; return s.firstChild; };
// Nearly every key on the desk is an onTap (the steppers and arrows only click: by the time they can be pressed
// something else has woken the audio). Most choices then save and lay the desk out again, and the ones that change
// the table also set up the live table again.
const repaint = () => { savePrefs(); paintHome(); };
const repaintLive = () => { savePrefs(); paintHome(); homePreview(); };
const dkPut = (node, kids) => { for (const k of [].concat(kids)) if (k) node.appendChild(k); };

// the parts the slate is made of
const dkH1 = (t, sub) => [el('h1', { text: t }), sub ? el('div', { class: 'sub', text: sub }) : null];
const dkHr = () => el('div', { class: 'dk-hr' });
const dkLab = t => el('div', { class: 'dk-lab', text: t });
const dkTxt = (t, hi) => { const p = el('div', { class: 'dk-txt' }); p.textContent = t; if (hi) p.appendChild(el('b', { text: hi })); return p; };
const dkSeg = (opts, cur, fn) => el('div', { class: 'dk-seg' }, opts.map(([v, t, off]) => el('button', { 'aria-pressed': String(v === cur), text: t, disabled: off ? '' : null, onclick: onTap(() => fn(v)) })));
function dkStep(vals, cur, fmt, fn, mini) {
  const i = Math.max(0, vals.indexOf(cur));
  return el('div', { class: 'dk-step' + (mini ? ' mini' : '') }, [
    el('button', { 'aria-label': '줄이기', text: '−', disabled: i <= 0 ? '' : null, onclick: () => { SND.tap(); fn(vals[i - 1]); } }),
    el('b', { text: fmt(vals[i]) }),
    el('button', { 'aria-label': '늘리기', text: '+', disabled: i >= vals.length - 1 ? '' : null, onclick: () => { SND.tap(); fn(vals[i + 1]); } })]);
}
const dkLabelled = (t, sub) => [document.createTextNode(t), sub ? el('small', { text: sub }) : null];
const dkMain = (t, sub, fn, off) => el('button', { class: 'dk-main', disabled: off ? '' : null, onclick: onTap(fn) }, dkLabelled(t, sub));
const dkSec = (t, fn, sub) => el('button', { class: 'dk-sec', onclick: onTap(fn) }, dkLabelled(t, sub));
const dkActs = (...btns) => el('div', { class: 'dk-acts' }, btns);
// the things laid on it: a cue as its photograph, the little cream tab on what is in use
const cueImg = (c, cls) => el('img', { class: cls || null, src: `ui/cue-${c.id}.webp`, alt: c.name, draggable: 'false' });
const eqTag = () => el('span', { class: 'eq', text: '장착' });
const dkRow = (lab, val, fn) => el('div', { class: 'dk-row' }, [el('span', { class: 'dk-lab', text: lab }), el('button', { class: 'dk-chip', text: val, onclick: onTap(fn) })]);
function guideRow() {
  const a = guideName(prefs.guides[0]), b = guideName(prefs.guides[1]);
  return dkRow('조준선', a === b || prefs.vsAI ? a : a + ' · ' + b, sheetGuide);
}
// the tray's head: a title over a small line, with arrows either side when there is a list to step through
const dkTitle = (t, sub) => el('div', { class: 'tt' }, [el('h2', { text: t }), el('small', { text: sub })]);
function dkNavHead(head, what, t, sub, go) {
  head.className = 'dk-head nav';
  const arrow = dir => el('button', { class: 'dk-arrow', 'aria-label': `${dir < 0 ? '이전' : '다음'} ${what}`, onclick: () => { SND.tap(); go(dir)(); } }, svgArrow(dir > 0 ? 1 : 0));
  dkPut(head, [arrow(-1), dkTitle(t, sub), arrow(1)]);
}
// a swatch in the tray's foot (a cue or a cloth), tagged if it is the one in use
const dkSwatch = (on, worn, pic, name, fn) => el('button', { class: 'dk-sw', 'aria-pressed': String(on), onclick: onTap(fn) }, [worn ? eqTag() : null, pic, document.createTextNode(name)]);

function deskGo(tab) {
  if (tab === deskTab && st.screen === 'home') return;
  gearOff(); const was = deskTab; deskTab = tab;
  const game4 = m => GAME4.includes(m);
  if (tab === 'play' && !game4(prefs.mode)) prefs.mode = game4(prefs.lastMode) ? prefs.lastMode : 'eight';
  if (tab === 'train' && !trainOf()) { if (game4(prefs.mode)) prefs.lastMode = prefs.mode; prefs.mode = prefs.lastTrain === 'practice' ? 'practice' : 'puzzle'; }
  savePrefs();
  if (st.screen !== 'home') return goHome(true);
  paintHome(); if (was === 'gear' || tab === 'play' || tab === 'train') homePreview();
}
// the rail: a slot for each choice with its key down in it, the chosen key inlaid with felt and its red dot
function railBtn(on, label, sub, fn, soon, icon) {
  const kids = dkLabelled(label, sub);
  return el('div', { class: 'dk-slot' }, el('button', { class: 'dk-rb' + (soon ? ' soon' : '') + (icon ? ' iconed' : ''), 'aria-pressed': String(on), onclick: onTap(fn) },
    icon ? [el('i', { class: 'mi', style: `background-image:url(ui/${icon}.webp)` }), el('span', { class: 'lb' }, kids)] : kids));
}

/* Each place fills the same five parts of the desk, d = { rail, head, stage, foot, slate }, which deskPaint has emptied:
   the rail's keys, the tray's head, what lies in the tray (the live table unless stage.dataset.win is set to '0'), the
   tray's foot, and the slate - its options, then a .dk-acts row of buttons. */

// 플레이: the four games on the rail; the two players on plates at the foot of the tray; who against, how far, the guide
function deskPlay({ rail, head, foot, slate }) {
  const m = GAME4.includes(prefs.mode) ? prefs.mode : 'eight', mm = game.MODES[m];
  const pick = id => () => { if (prefs.mode === id) return; prefs.mode = id; repaintLive(); };
  dkPut(rail, GAME4.map(id => railBtn(m === id, MODE_KO[id], null, pick(id), false, 'mode-' + id)));   // each with the balls it is played with
  dkPut(head, dkTitle(prefs.vsAI ? '컴퓨터와 플레이' : '친구와 플레이', mm.blurb));
  const plate = i => {
    const nm = i ? oppName() : prefs.names[0], sub = m === 'four' ? `수지 ${sujiOf(i) * 10}` : i && prefs.vsAI ? LEVELS[prefs.level] : recText(nm);
    return el('button', { class: 'dk-plate' + (i ? ' two' : ''), onclick: onTap(() => sheetName(i)) }, [el('i', { class: 'av', text: String(i + 1) }), el('span', null, [el('b', { text: nm }), el('small', { text: sub })])]);
  };
  dkPut(foot, [plate(0), el('span', { class: 'dk-vs', text: 'VS' }), plate(1)]);

  dkPut(slate, dkH1(MODE_KO[m], GAME_SUB[m]));
  dkPut(slate, [dkHr(), dkLab('상대'), dkSeg([['net', '온라인', true], ['friend', '친구'], ['ai', '컴퓨터']], prefs.vsAI ? 'ai' : 'friend', v => { prefs.vsAI = v === 'ai'; repaint(); })]);
  if (prefs.vsAI) dkPut(slate, [dkLab('난이도'), dkSeg(LEVELS.map((t, i) => [i, t]), Math.min(3, prefs.level), v => { prefs.level = v; repaint(); })]);
  if (m === 'four') {
    const suji = (name, i, set) => el('div', { class: 'dk-row' }, [el('span', { class: 'dk-txt', text: name }), dkStep(SUJI, sujiOf(i), v => String(v * 10), v => { set(v); repaint(); }, true)]);
    dkPut(slate, [dkLab('수지 (각자 정하기)'),
      suji(prefs.names[0], 0, v => { prefs.suji[prefs.names[0]] = v; }),
      suji(oppName(), 1, v => { if (prefs.vsAI) prefs.sujiAI = v; else prefs.suji[prefs.names[1]] = v; }),
      dkSeg([[0, '마무리 자유'], [1, '쿠션 마무리']], prefs.finish ? 1 : 0, v => { prefs.finish = v === 1; repaint(); })]);
  }
  if (m === 'three') {
    const T = [3, 5, 10];
    dkPut(slate, [dkLab('목표 점수'), dkStep(T, T.includes(prefs.target) ? prefs.target : 5, String, v => { prefs.target = v; repaint(); }),
      dkSeg([[0, '쿠션 자유'], [1, '원쿠션'], [3, '쓰리쿠션']], prefs.rule3, v => { prefs.rule3 = v; repaint(); })]);
  }
  dkPut(slate, [dkHr(), guideRow()]);
  const d = store.get('save', null), gm = d && d.v === 2 && d.game && MODE_KO[d.game.modeId] ? d.game : null;
  const vs = prefs.vsAI ? '컴퓨터 ' + LEVELS[prefs.level] : '친구와';
  dkPut(slate, dkActs(dkMain('시작', `${MODE_KO[m]} · ${vs}`, () => match.start(m === 'four' ? (Math.random() < 0.5 ? 0 : 1) : 0)),   // (4구: the yellow ball, and so who breaks, drawn by lot)
    gm ? dkSec('이어서 하기', () => resume(d), `${MODE_KO[gm.modeId]} · ${gm.players[0].name} vs ${gm.players[1].name}`) : null));
}

// 훈련: lessons, puzzles and free practice on the rail, each with its own tray and slate
function deskTrain(d) {
  const t = trainOf() || 'puzzle';
  const to = (mode, drill) => () => { prefs.lastTrain = mode; if (drill) drill(); prefs.mode = mode; repaintLive(); };
  dkPut(d.rail, [railBtn(t === 'lesson', '레슨', null, to('practice', () => { if (prefs.drill === 'free') prefs.drill = LESSONS()[0]; })),
    railBtn(t === 'puzzle', '퍼즐', null, to('puzzle')),
    railBtn(t === 'free', '자유 연습', null, to('practice', () => { prefs.drill = 'free'; }))]);
  if (t === 'puzzle') deskPuzzle(d); else if (t === 'lesson') deskLesson(d); else deskFree(d);
}
// the puzzle in hand: the head steps through the open puzzles, the foot's pills jump to a stage
function deskPuzzle(d) {
  const { head, foot, slate } = d;
  // (the puzzles are being made again on the game's physics: until then the place is kept, empty)
  if (!puzzles.list.length) {
    dkPut(head, dkTitle('퍼즐', '새로 만드는 중'));
    dkPut(slate, dkH1('퍼즐', '새로 만드는 중'));
    dkPut(slate, [dkHr(), dkTxt('지금 물리에 맞춰 퍼즐을 새로 만들고 있습니다. 단계는 그대로 ' + puzzles.STAGES.length + '단계입니다.')]);
    dkPut(slate, dkActs(dkMain('준비 중', null, () => {}, true)));
    return;
  }
  const z = prefs.pz, L = puzzles.list.filter(q => pzOpen(q.stage)), cur = puzzles.byId(z.cur) || puzzles.list[0], S = puzzles.STAGES[cur.stage];
  const go = dir => () => { const i = Math.max(0, L.indexOf(cur)), q = L[(i + dir + L.length) % L.length]; z.cur = q.id; z.open = q.stage; repaintLive(); };
  const solved = qs => qs.filter(q => z.stars[q.id]).length, here = puzzles.of(cur.stage);
  dkNavHead(head, '문제', `${cur.stage + 1}-${cur.n}  ${S.name}`, `${solved(here)} / ${here.length} 풀이`, go);
  dkPut(foot, puzzles.STAGES.map((s, si) => {
    const qs = puzzles.of(si), open = pzOpen(si);
    const enter = () => {
      if (!open) return toast(`앞 스테이지에서 ${PZ_NEED}문제를 풀면 열립니다.`, '', 2200);
      const q = qs.find(x => !z.stars[x.id]) || qs[0]; z.cur = q.id; z.open = si; repaintLive();
    };
    return el('button', { class: 'dk-pill' + (open ? '' : ' lock'), 'aria-pressed': String(si === cur.stage), onclick: onTap(enter) },
      [document.createTextNode(`${si + 1}단계`), open ? el('small', { text: `${solved(qs)}/${qs.length}` }) : el('img', { class: 'lock', src: 'ui/lock.webp', alt: '잠김' })]);
  }));
  const stars = z.stars[cur.id] || 0, said = stars ? '받음' : '아직 안 풂';
  const starRow = el('div', { class: 'dk-stars', 'aria-label': stars ? `별 ${stars}개 받음` : said },
    [0, 1, 2].map(k => el('img', { src: k < stars ? 'ui/star.webp' : 'ui/star-off.webp', alt: '' })).concat(el('span', { text: said })));
  dkPut(slate, dkH1(S.name, `${cur.stage + 1}-${cur.n}번 문제`));
  dkPut(slate, [dkHr(), dkLab('목표'), dkTxt(game.MODES.puzzle4.GOALS[S.goal].text + '. 노란 공은 건드리면 안 됩니다.'), dkHr(), dkLab('이 문제'), starRow, dkHr(), guideRow()]);
  dkPut(slate, dkActs(dkMain('퍼즐 풀기', `${cur.stage + 1}-${cur.n} ${S.name}`, () => puzzle.start())));
}
// The lessons as volumes and books: four game volumes on the shelf (3구, 4구, 8볼, 9볼); opening one shows its textbooks,
// one a lesson, coloured by its course, with an X back to the volumes; tapping a book starts that lesson.
// (The lessons there are now are all on the pool table, so they sit in 8볼; the others wait for theirs.)
let lessonVol = null;
const VOLUMES = [['three', '3구'], ['four', '4구'], ['eight', '8볼'], ['nine', '9볼']];
const BOOK_LEATHER = ['navy', 'burgundy', 'green', 'brown'];          // a lesson book's leather by its course (ui/book-*.webp)
const volLessons = v => v === 'eight' ? LESSONS() : [];
function deskLesson({ head, stage, slate }) {
  const top = drills.LEVELS; stage.dataset.win = '0';
  const doneOf = ids => ids.filter(id => levelOf(id) >= top).length;
  if (lessonVol == null) {
    dkPut(head, dkTitle('교본', '종목을 고르세요'));
    dkPut(stage, el('div', { class: 'dk-cards vols' }, VOLUMES.map(([v, name], i) => { const ids = volLessons(v);
      return el('button', { class: 'dk-card vol' + (ids.length ? '' : ' empty'), 'aria-label': name + ' 교본', onclick: onTap(() => { lessonVol = v; paintHome(); }) }, [
        el('i', { class: 'tome', style: `background-image:url(ui/vol-${v}.webp)` }, el('span', { class: 'tt' }, [el('b', { text: name }), el('small', { text: '교본' })])),
        el('span', { class: 'nm', text: ids.length ? `${ids.length}권 · 다 뗀 ${doneOf(ids)}권` : '준비 중' })]); })));
    dkPut(slate, dkH1('교본', '레슨'));
    dkPut(slate, [dkHr(), dkTxt('종목 교본을 펼치면 그 안에 레슨 교본이 있습니다. 교본을 누르면 그 레슨이 바로 시작됩니다.'), dkHr()]);
    for (const [v, name] of VOLUMES) { const ids = volLessons(v); dkPut(slate, el('div', { class: 'dk-spec' }, [el('span', { text: name }), el('b', { text: ids.length ? `${doneOf(ids)} / ${ids.length}권` : '준비 중' })])); }
    const cur = LESSONS().includes(prefs.drill) ? prefs.drill : LESSONS()[0];
    dkPut(slate, dkActs(dkMain('이어서 하기', `${drills.byId(cur).name} · ${levelOf(cur)}단계`, () => practice.start(cur))));
    return;
  }
  const vol = VOLUMES.find(x => x[0] === lessonVol), ids = volLessons(lessonVol), cur = ids.includes(prefs.drill) ? prefs.drill : ids[0];
  head.className = 'dk-head open';
  dkPut(head, [el('button', { class: 'dk-x', 'aria-label': '종목 교본으로', onclick: () => { SND.tap(); lessonVol = null; paintHome(); } }, el('i')), dkTitle(`${vol[1]} 교본`, ids.length ? `${ids.length}권 · 다 뗀 교본 ${doneOf(ids)}권` : '준비 중')]);
  if (!ids.length) {
    dkPut(stage, el('div', { class: 'msg' }, [el('b', { text: `${vol[1]} 교본 준비 중` }), el('span', { text: '이 종목의 레슨을 만들고 있습니다.' })]));
    dkPut(slate, dkH1(`${vol[1]} 교본`, '준비 중')); dkPut(slate, [dkHr(), dkTxt('이 종목의 레슨을 만들고 있습니다.')]);
    dkPut(slate, dkActs(dkMain('준비 중', null, () => {}, true), dkSec('종목 교본으로', () => { lessonVol = null; paintHome(); })));
    return;
  }
  const books = COURSES.flatMap(([course, list], ci) => list.filter(id => ids.includes(id)).map(id => [course, ci, id]));
  dkPut(stage, el('div', { class: 'dk-cards books' }, books.map(([course, ci, id], i) => {
    const dr = drills.byId(id), lv = levelOf(id);
    return el('button', { class: 'dk-card book' + (id === cur ? ' last' : '') + (lv >= top ? ' done' : ''), 'aria-label': dr.name, onclick: onTap(() => { prefs.lastTrain = 'practice'; prefs.mode = 'practice'; practice.start(id); }) }, [
      el('i', { class: 'cover', style: `background-image:${lv >= top ? 'url(ui/book-gilt.webp),' : ''}url(ui/book-${BOOK_LEATHER[ci] || 'brown'}.webp)` }, el('span', { class: 'tt' }, [el('small', { text: course }), el('b', { text: dr.name }), el('em', { text: String(i + 1) })])),
      el('span', { class: 'lvl' }, Array.from({ length: top }, (_, k) => el('i', { class: k < lv ? 'on' : '' })))]);
  })));
  const dr = drills.byId(cur);
  dkPut(slate, dkH1(`${vol[1]} 교본`, '레슨'));
  dkPut(slate, [dkHr(), dkTxt('교본을 누르면 그 레슨이 바로 시작됩니다. 단계를 다 떼면 표지에 금박이 들어갑니다.'), dkHr()]);
  for (const [course, list] of COURSES) { const l = list.filter(id => ids.includes(id)); if (!l.length) continue;
    dkPut(slate, el('div', { class: 'dk-spec' }, [el('span', { text: course }), el('b', { text: `${doneOf(l)} / ${l.length}권` })])); }
  dkPut(slate, [dkHr(), guideRow()]);
  dkPut(slate, dkActs(dkMain('이어서 하기', `${dr.name} · ${levelOf(cur)}단계`, () => practice.start(cur))));
}
function deskFree({ head, slate }) {
  const dr = drills.byId('free');
  dkPut(head, dkTitle('자유 연습', '혼자서 마음대로'));
  dkPut(slate, dkH1('자유 연습', '규칙 없음'));
  dkPut(slate, [dkHr(), dkTxt(dr.d), dkHr(), guideRow()]);
  dkPut(slate, dkActs(dkMain('연습 시작', null, () => practice.start())));
}

/* 내 장비 and 상점: shelves of cards. The rail picks the kind (큐 · 공 · 테이블 · 트레일 · 장갑); the felt tray shows its
   cards, each with the thing in it; tapping a card opens it in the tray - large, or tried on the live table - with an X
   at the top left back to the cards, and the slate says what it is and wears it (상점: buys it, once the shop opens).
   Opening a card only tries it on (the scene shows it); X or another place puts back what is worn. */
let shelfOpen = null;                                                 // the card opened in the tray, or null for all the cards
const hx6 = h => '#' + h.toString(16).padStart(6, '0');
// a set of balls as three balls (carom: white, yellow, red; else the cue ball, the 1 and the 3)
function ballTrio(k, v) {
  const c = isCarom(), ids = c ? [0, 1, 2] : [0, 1, 11], kind = c ? 'carom' : 'pool', shot = n => scene.ballPortrait(k.id, kind, n);
  // on a card: the set in its case, a ball in each cup (cup centres 23.6, 50 and 76.4% down)
  if (v) return el('i', { class: 'bcase' }, [el('img', { class: 'box', src: 'ui/ball-case.webp', alt: '' }),
    ...ids.map((n, j) => el('img', { class: 'b', src: shot(n), alt: '', style: `top:${[23.6, 50, 76.4][j]}%` }))]);
  return el('i', { class: 'btrio' }, ids.map(n => el('img', { src: shot(n), alt: '', draggable: 'false' })));
}
const streak = (q, big) => el('i', { class: 'trl' + (big ? ' big' : '') + (q.color === 'rainbow' ? ' rb' : q.color ? '' : ' none'), style: q.color && q.color !== 'rainbow' ? `--c:${hx6(q.color)}` : '' });
const gloveImg = g => el('img', { class: 'glove', src: `ui/glove-${g.id}.webp`, alt: g.name, draggable: 'false' });
const clothPic = q => el('i', { class: 'clothcard', style: `--w:${hx6(q.wood)};background-color:${hx6(q.felt)};background-image:url(ui/cloth-${q.id}.webp)` });
const SHELVES = {
  cue: { name: '큐', list: () => CUES, worn: () => prefs.cues[0], pic: c => el('i', { class: 'cuecard' }, cueImg(c)),
    show: (c, stage) => { stage.dataset.win = '0'; dkPut(stage, [cueImg(c, 'cuebig'), el('div', { class: 'cuezoom' }, cueImg(c))]); },
    about: c => [c.note, ...(CUE_SPEC[c.id] || [])], wear: (c, i) => { prefs.cues[0] = i; prefs.cue = i; if (!prefs.vsAI && prefs.cues[1] === undefined) prefs.cues[1] = i; useCue(i); return `${c.name}를 들었습니다.`; } },
  ball: { name: '공', list: () => BALLSKINS, worn: () => Math.max(0, BALLSKINS.findIndex(b => b.id === prefs.ballSkin)), pic: k => ballTrio(k, true),
    show: k => scene.setBalls(k.id), about: k => [k.note, ['소재', '페놀 수지'], ['지름', isCarom() ? (prefs.mode === 'three' ? '61.5mm' : '65.5mm') : '57.2mm']],
    wear: k => { prefs.ballSkin = k.id; return `${k.name} 공을 꺼냈습니다.`; }, undo: () => scene.setBalls(prefs.ballSkin) },
  table: { name: '테이블', list: () => CLOTHS, worn: () => prefs.cloth, pic: clothPic, show: (c, stage, i) => scene.setCloth(i),
    about: c => [c.ice ? '빙판: 공이 미끄러져 오래 구르고 회전이 잘 먹지 않습니다. 대결에만 적용됩니다.' : '천 색은 보기만 다르고 공은 똑같이 구릅니다.', ['천', c.ice ? '얼음' : '워스티드 울'], ['나무', c.grain === 'walnut' ? '월넛' : c.grain === 'mahogany' ? '마호가니' : '도장 마감']],
    wear: (c, i) => { prefs.cloth = i; homePreview(); return `${c.name} 테이블로 바꿨습니다.`; }, undo: () => dress(iceOn()) },
  trail: { name: '트레일', list: () => TRAILS, worn: () => Math.max(0, TRAILS.findIndex(t => t.id === prefs.trail)), pic: q => streak(q),
    show: (q, stage) => { scene.setTrail(q.id); stage.dataset.win = '0'; dkPut(stage, el('div', { class: 'bigpic' }, streak(q, true))); },
    about: q => [q.note, '큐볼이 구르는 동안 뒤로 짧게 남고 곧 사라집니다. 경기에는 영향이 없습니다.'],
    wear: q => { prefs.trail = q.id; return `트레일: ${q.name}`; }, undo: () => scene.setTrail(prefs.trail) },
  glove: { name: '장갑', list: () => GLOVES, worn: () => GLOVES.findIndex(g => g.id === prefs.glove), pic: gloveImg,
    show: (g, stage) => { stage.dataset.win = '0'; dkPut(stage, el('div', { class: 'bigpic' }, gloveImg(g))); },
    about: () => ['브리지 손에 끼는 세 손가락 장갑. 큐가 손가락 사이로 매끄럽게 미끄러집니다.', ...GLOVE_SPEC],
    wear: g => { prefs.glove = g.id; return `${g.name} 장갑을 꼈습니다.`; } },
};
const SHELF_KEYS = ['cue', 'ball', 'table', 'trail', 'glove'];
function shelfClose() { const k = SHELVES[deskTab === 'shop' ? shopSel : gearSel]; if (shelfOpen != null && k && k.undo) k.undo(); shelfOpen = null; }
function gearOff() { shelfClose(); }                                  // (also called on leaving the place)
function shelfPage(d, shop) {
  const kind = shop ? shopSel : gearSel, K = SHELVES[kind], list = K.list(), worn = K.worn();
  dkPut(d.rail, SHELF_KEYS.map(k => railBtn(kind === k, SHELVES[k].name, null, () => { shelfClose(); if (shop) shopSel = k; else gearSel = k; paintHome(); })));
  const close = () => { SND.tap(); shelfClose(); paintHome(); };
  if (shelfOpen == null || !list[shelfOpen]) {
    // the cards
    shelfOpen = null; d.stage.dataset.win = '0';
    dkPut(d.head, dkTitle(shop ? `${K.name} 진열대` : `내 ${K.name}`, `${list.length}개${worn >= 0 ? ' · 장착: ' + list[worn].name : ''}`));
    dkPut(d.stage, el('div', { class: 'dk-cards k-' + kind }, list.map((q, i) => el('button', { class: 'dk-card' + (i === worn ? ' worn' : ''), 'aria-label': q.name, onclick: onTap(() => { shelfOpen = i; paintHome(); }) },
      [i === worn ? el('span', { class: 'wtag', text: '장착' }) : null, K.pic(q), el('span', { class: 'nm', text: q.name }), shop ? el('span', { class: 'price', text: '곧 판매' }) : null]))));
    dkPut(d.slate, dkH1(shop ? '상점' : '내 장비', `${K.name} · ${list.length}개`));
    dkPut(d.slate, [dkHr(), dkTxt(shop ? '큐, 공, 테이블, 트레일, 장갑을 코인과 다이아로 살 수 있게 됩니다. 지금은 구경만 할 수 있습니다.' : '카드를 누르면 크게 보고 미리 볼 수 있습니다.'),
      dkHr(), dkTxt('현재 장착: ', worn >= 0 ? list[worn].name : '없음'), dkHr(), dkTxt('플레이 성능은 모두 같습니다.')]);
    dkPut(d.slate, dkActs(shop ? dkMain('준비 중', null, () => {}, true) : null, shop ? dkSec('내 장비로', () => deskGo('gear')) : null));
    return;
  }
  // one card, opened
  const i = shelfOpen, q = list[i], own = i === worn;
  d.head.className = 'dk-head open';
  dkPut(d.head, [el('button', { class: 'dk-x', 'aria-label': '카드 목록으로', onclick: close }, el('i')), dkTitle(q.name, `${i + 1} / ${list.length}`)]);
  K.show(q, d.stage, i);
  dkPut(d.slate, dkH1(q.name, K.name));
  const about = K.about(q);
  dkPut(d.slate, dkHr());
  for (const a of about) dkPut(d.slate, typeof a === 'string' ? [dkTxt(a), dkHr()] : el('div', { class: 'dk-spec' }, [el('span', { text: a[0] }), el('b', { text: a[1] })]));
  if (kind === 'table' && !isCarom()) dkPut(d.slate, [dkHr(), dkLab('포켓볼 테이블 크기'), dkSeg(TABLES.map(t => [t.id, t.short]), prefs.table, v => { prefs.table = v; repaintLive(); })]);
  if (shop) dkPut(d.slate, dkActs(dkMain('구매', '상점이 열리면', () => {}, true), dkSec('카드 목록으로', close)));
  else dkPut(d.slate, dkActs(dkMain(own ? '장착 중' : '장착', null, () => { const msg = K.wear(q, i); savePrefs(); shelfOpen = null; paintHome(); toast(msg); }, own), dkSec('카드 목록으로', close)));
}
const deskGear = d => shelfPage(d, false);
const deskShop = d => shelfPage(d, true);

/* ---- the desk as a leaning plane: layout() in 10-ui.js calls these two on the desk's home ---- */
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
  // (cut to the rails' own outline at their height, rounded corners and all, so nothing of the table is cut off and no gap shows)
  const tr = scene.tableOutline(ins), pts = tr.pts.map(([px, py]) => `${(px - dx).toFixed(1)}px ${(py - dy).toFixed(1)}px`);
  pl.style.clipPath = win ? `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${pts.join(', ')}, ${pts[0]})` : 'none';
  let sh = $('#dkShade'); if (!sh) { sh = el('div', { id: 'dkShade' }, el('i')); sg.appendChild(sh); } else if (sh.parentNode !== sg) sg.appendChild(sh);
  sh.hidden = !win; Object.assign(sh.style, { left: (tr.x - dx - x) + 'px', top: (tr.y - dy - y) + 'px', width: tr.w + 'px', height: tr.h + 'px' }); sh.style.setProperty('--tl', Math.max(5, Math.round(tr.h * 0.045)) + 'px'); sh.style.setProperty('--tr', tr.r.toFixed(1) + 'px');
}
const DESK_PLACES = { play: deskPlay, train: deskTrain, gear: deskGear, shop: deskShop };
function deskPaint() {
  if (!deskOn()) return;
  if (!deskTab) deskTab = trainOf() ? 'train' : 'play';
  for (const b of document.querySelectorAll('#dkTabs .dk-tab')) b.setAttribute('aria-selected', String(st.screen === 'home' && b.dataset.t === deskTab));
  $('#dkRec').setAttribute('aria-pressed', String(st.screen === 'records'));
  { const w = prefs.wallet || {}, n = v => (v || 0).toLocaleString('ko-KR'); $('#dkWallet .coin b').textContent = n(w.coin); $('#dkWallet .dia b').textContent = n(w.dia); }
  $('#dkMe .nm').textContent = prefs.names[0]; $('#dkMe .rc').textContent = recText(prefs.names[0]);
  const d = { rail: $('#dkRail'), head: $('#dkHead'), stage: $('#dkStage'), foot: $('#dkFoot'), slate: $('#dkSlate') };
  const top = (d.slate.querySelector('.dk-body') || d.slate).scrollTop;
  for (const n of [d.rail, d.head, d.foot, d.slate]) n.textContent = '';
  for (const k of [...d.stage.children]) if (k.id !== 'dkShade') k.remove();
  d.stage.dataset.win = '1';                                         // the live table shows through, unless something else is laid in the tray
  d.head.className = 'dk-head';
  DESK_PLACES[deskTab](d);
  // the slate: its options scroll if they must, its buttons stay put at the foot
  const acts = d.slate.querySelector('.dk-acts'), body = el('div', { class: 'dk-body' });
  while (d.slate.firstChild && d.slate.firstChild !== acts) body.appendChild(d.slate.firstChild);
  d.slate.insertBefore(body, acts); body.scrollTop = top;
  if (st.screen === 'home') requestAnimationFrame(layout);          // the table sits in the tray, whose size the content just set
}
$('#dkTabs').addEventListener('click', e => { const b = e.target.closest('.dk-tab'); if (!b) return; SND.init(); SND.tap(); deskGo(b.dataset.t); });
press('#dkSet', sheetSettings);
press('#dkRec', () => { if (st.screen === 'records') goHome(true); else { showRecords(); deskPaint(); } });
press('#dkMe', () => sheetName(0));
