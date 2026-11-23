/* 훈련: 레슨, 퍼즐, 자유 연습 and 컴퓨터 대전, each a card of the menu's (37-desk-menu.js trainGo) and each laid out as
   친구와 플레이's 한 기기에서 is (owner 11-16): the rail the games - 3구, 4구, 8볼, 9볼, 스누커 -, the way back an X on the
   tray's head; the tray what is played (레슨 its cards, 퍼즐 the map of its stages, 컴퓨터 대전 its bots, 자유 연습 the
   table); the slate the rest (퍼즐 the topic's own road, 컴퓨터 대전 the bot picked: 34-desk-bots.js).
   A game a place has nothing of yet is on the rail all the same, dimmed (준비 중). */
const TRAIN_KO = { lesson: '레슨', puzzle: '퍼즐', free: '자유 연습', cpu: '컴퓨터 대전' };
const volLessons = v => drills.list.filter(d => d.make && d.vol === v).map(d => d.id);
// what each place has for a game (the rest are 준비 중), and the game it is on
const TRAIN_HAS = { lesson: id => volLessons(id).length > 0, puzzle: id => id === 'four' && puzzles.list.length > 0, free: () => true, cpu: id => GAME4.includes(id) };
function trainGameOf(t) {
  const G = prefs.trainGame || {};
  if (t === 'lesson') return FRIEND_GAMES.includes(G.lesson) && !soonGame(G.lesson) && TRAIN_HAS.lesson(G.lesson) ? G.lesson : 'eight';
  if (t === 'puzzle') return 'four';
  if (t === 'free') return freeGame();
  return GAME4.includes(prefs.mode) ? prefs.mode : 'eight';
}
function deskTrain(d) {
  const t = trainOf() || 'puzzle', on = trainGameOf(t);
  const pick = id => () => {
    if (!TRAIN_HAS[t](id)) return toast(`${MODE_KO[id]} ${TRAIN_KO[t]}은 준비 중입니다.`, '', 2000);
    if (id === on) return;
    if (t === 'cpu') { prefs.mode = prefs.cpuMode = id; }
    else prefs.trainGame = Object.assign({}, prefs.trainGame, { [t]: id });
    savePrefs(); repaintLive();
  };
  dkPut(d.rail, FRIEND_GAMES.map(id => soonGame(id) ? railBtn(false, MODE_KO[id], '곧 출시', soonTap(id), true, 'mode-' + id) : railBtn(id === on, MODE_KO[id], TRAIN_HAS[t](id) ? null : '준비 중', pick(id), !TRAIN_HAS[t](id), 'mode-' + id)));
  if (t === 'puzzle') deskPuzzle(d); else if (t === 'lesson') deskLesson(d, on); else if (t === 'cpu') deskMatch(d, true, trainBack()); else deskFree(d, on);
  // (with the old menu - a screen held upright, or 디버그 - 훈련 is one tab: its four places picked at the slate's top)
  if (!menuOn()) {
    const seg = dkSeg(Object.entries(TRAIN_KO).map(([k, n]) => [k, k === 'cpu' ? '컴퓨터' : n]), t, k => { if (k !== t) { trainGo(k); repaintLive(); } });
    const pz = $('#dkBoards.pzr');                                   // (퍼즐 lies over the desk, its slate put away: the four over it)
    if (pz) pz.insertBefore(seg, pz.firstChild); else d.slate.insertBefore(seg, d.slate.firstChild);
  }
}
// the way back to the menu: an X at the tray's head, as 친구와 플레이's (none with the old menu, whose tabs are the way)
const trainBack = () => menuOn() ? () => deskGo('play') : null;
function trainHead(head, title, sub) {
  const back = trainBack();
  if (back) { head.className = 'dk-head open'; dkPut(head, el('button', { class: 'dk-x', 'aria-label': '메뉴로', onclick: () => { SND.tap(); back(); } }, el('i'))); }
  dkPut(head, dkTitle(title, sub));
}
/* 퍼즐 (owner 11-23: rated, as Chess.com's - 52-puzzle.js pzr - in place of the stages' map): on the menu's charcoal cloth,
   as 랭킹전's games lie (#desk.felt). Its head: 캐롬 · 포켓 and 오늘의 퍼즐 (no points). Left, the rating - large, today's
   change, its last moves - and the cases closed; the middle the case being filled (a quarter of a ball a puzzle); right,
   the next puzzle, hidden until it is started, with what it gives or takes. 포켓's rack (one ball a puzzle) waits until
   its puzzles are made. A case just closed shows its result over it all (pzDone); the record (pzBook) lists the cases,
   each one's sixteen to play again without points. */
let pzView = 'four', pzBook = null, pzDone = null;
const pzDate = t => { const m = /^\d+-(\d+)-(\d+)/.exec(t || ''); return m ? `${+m[1]}월 ${+m[2]}일` : ''; };
const pzSigned = d => d > 0 ? `+${d}` : d < 0 ? `−${-d}` : '±0';
function deskPuzzle(d) {
  d.stage.dataset.win = '0';
  $('#desk').classList.add('boards');
  if (menuOn()) { $('#desk').classList.add('felt'); if (!$('#dkFelt')) $('#desk').appendChild(el('div', { class: 'dk-felt', id: 'dkFelt', 'aria-hidden': 'true' })); }
  const wrap = el('div', { id: 'dkBoards', class: 'pzr' }), fit = el('div', { class: 'bd-fit' }), back = trainBack();
  const x = fn => el('button', { class: 'dk-x', 'aria-label': '뒤로', onclick: () => { SND.tap(); fn(); } }, el('i'));
  const repaint = () => repaintLive();
  if (pzDone) {
    const c = pzDone;
    wrap.classList.add('done');
    wrap.appendChild(el('div', { class: 'bd-head' }, [x(() => { pzDone = null; repaint(); }), dkTitle('퍼즐', '케이스 완성')]));
    const ok = c.res.filter(r => r[1] === 'o').length, dl = c.r1 - c.r0;
    fit.appendChild(el('div', { class: 'pzr-res' }, [
      el('div', { class: 'hd', text: `케이스 완성 · ${ok} / ${PZ_CASE}` }),
      el('div', { class: 'big' }, [el('s', { text: String(c.r0) }), document.createTextNode(String(c.r1)), el('em', { class: dl < 0 ? 'm' : '', text: pzSigned(dl) })]),
      pzSvg(pzCase(c.res, c.m, false), 'pzr-cs'),
      el('small', { text: `${PZ_MATS[c.m].n} 케이스 · 기록에 남았습니다. 닫힌 케이스는 점수에 다시 들어가지 않습니다.` }),
      el('div', { class: 'btns' }, [el('button', { class: 'pzr-b2', text: '기록 보기', onclick: onTap(() => { pzDone = null; pzBook = 0; repaint(); }) }),
        el('button', { class: 'pzr-go', text: '다음 케이스', onclick: onTap(() => { pzDone = null; puzzle.start(); }) })])]));
    wrap.appendChild(fit); $('#desk').appendChild(wrap); return;
  }
  const s = pzr.of('four');
  if (pzBook != null && s.cases.length) {
    const i = Math.min(pzBook, s.cases.length - 1), c = s.cases[i];
    wrap.classList.add('book');
    wrap.appendChild(el('div', { class: 'bd-head' }, [x(() => { pzBook = null; repaint(); }), dkTitle('기록 · 4구', `닫힌 케이스 ${s.cases.length}개`)]));
    const list = el('div', { class: 'pzr-list' }, s.cases.map((k, j) => el('button', { class: 'ln' + (j === i ? ' on' : ''), onclick: onTap(() => { pzBook = j; repaint(); }) }, [
      el('span', { class: 'dt', text: pzDate(k.t) }), pzSvg(pzMini(k.res, false), 'mi'), el('b', { text: String(k.r1) }), el('em', { class: k.r1 < k.r0 ? 'm' : '', text: pzSigned(k.r1 - k.r0) })])));
    const grid = el('div', { class: 'pzr-16' }, c.res.map(([id, r, dd], j) => {
      const q = puzzles.byId(id), lab = `${PZ_BALL_KO[j >> 2]} ${(j & 3) + 1}/4`;
      return el('button', { class: 'pz1 ' + r, disabled: q ? null : '', 'aria-label': `${lab}, ${r === 'o' ? '성공' : r === 'x' ? '실패' : '힌트'}, 다시 풀기`, onclick: onTap(() => q && puzzle.start(q.id, { free: 'book' })) }, [
        pzSvg(pzOne(j, r), 'q1'), el('b', { text: lab }), el('span', { text: r === 'o' ? `성공 ${pzSigned(dd)}` : r === 'x' ? `실패 ${pzSigned(dd)}` : '힌트' })]);
    }));
    fit.append(list, el('div', { class: 'pzr-pk' }, [el('h4', { text: `${pzDate(c.t)} · ${PZ_MATS[c.m].n} 케이스` }), grid, el('small', { text: '눌러서 다시 풀기 · 점수 없음' })]));
    wrap.appendChild(fit); $('#desk').appendChild(wrap); return;
  }
  // 캐롬 · 포켓, and 오늘의 퍼즐 (owner 11-22: one a day, the same for everyone, by the date)
  const seg = el('div', { class: 'pzr-seg', role: 'tablist' }, [['four', '캐롬', 'carom', 2], ['pocket', '포켓', 'pool', 8]].map(([k, t, kind, n]) =>
    el('button', { role: 'tab', 'aria-selected': String(pzView === k), class: pzView === k ? 'on' : '', onclick: onTap(() => { if (pzView !== k) { pzView = k; repaint(); } }) }, [ballPic(prefs.ballSkin, kind, n, { class: 'bp' }), el('span', { text: t })])));
  const day = pzDaily(), dayDone = prefs.pz.day === attend.today();
  const tools = el('span', { class: 'bd-tools' }, [seg, day && pzView === 'four' ? el('button', { class: 'pz-day' + (dayDone ? ' done' : ''), onclick: onTap(() => puzzle.start(day.id, { free: 'day' })) }, [el('i'), document.createTextNode(dayDone ? '오늘의 퍼즐 완료' : '오늘의 퍼즐')]) : null]);
  wrap.appendChild(el('div', { class: 'bd-head' }, [back ? x(back) : null, dkTitle('퍼즐', '첫 시도만 점수'), tools]));
  if (pzView === 'pocket') {
    // 포켓: the rack of fifteen, one ball a puzzle - its puzzles not made yet
    wrap.classList.add('pocket');
    fit.append(el('div', { class: 'pzr-me' }, [el('small', { text: '퍼즐 레이팅 · 포켓' }), el('span', { class: 'd', text: '첫 퍼즐부터 레이팅이 정해집니다' })]),
      el('div', { class: 'pzr-mid' }, [pzSvg(pzRack(), 'pzr-rk'), el('div', { class: 'cap' }, [el('b', { text: '랙 0 / 15' }), el('small', { text: '한 문제에 공 하나 · 1번부터 15번까지' })])]),
      el('div', { class: 'pzr-go-p soon' }, [el('h3', { text: '포켓 퍼즐' }), el('p', { text: '포켓 퍼즐은 준비 중입니다.' }), el('button', { class: 'pzr-go', disabled: '', text: '준비 중' })]));
    wrap.appendChild(fit); $('#desk').appendChild(wrap); return;
  }
  if (!puzzles.list.length) { fit.appendChild(el('div', { class: 'pzr-none', text: '등록된 퍼즐이 없습니다' })); wrap.appendChild(fit); $('#desk').appendChild(wrap); return; }
  const q = pzr.next('four'), g = pzr.gain(s, q), td = pzr.today('four'), k = s.now.length, mat = s.now.length ? (s.mat || 0) : pzMatOf(s.r);
  // the rating, today's change, its last moves; under it the cases closed (tapped: the record)
  const spark = s.hist.length >= 2 ? (() => { const L = s.hist, lo = Math.min(...L), hi = Math.max(...L), W = 160, H = 36, sp = Math.max(1, hi - lo);
    return pzSvg(`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><polyline fill="none" stroke="#5fd38a" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" points="${L.map((v, i) => `${(i / (L.length - 1) * W).toFixed(1)},${(H - 3 - (v - lo) / sp * (H - 6)).toFixed(1)}`).join(' ')}"/></svg>`, 'sp'); })() : null;
  const past = s.cases.slice(0, 3);
  fit.append(el('div', { class: 'pzr-me' }, [el('small', { text: '퍼즐 레이팅 · 4구' }), el('b', { class: 'num', text: s.r.toLocaleString('en-US') }),
    el('span', { class: 'd' + (td < 0 ? ' m' : '') }, td == null ? [el('span', { text: s.n ? '오늘 아직 안 풂' : '첫 퍼즐부터 레이팅이 정해집니다' })] : [document.createTextNode(pzSigned(td)), el('span', { text: '오늘' })]), spark,
    past.length ? el('div', { class: 'pzr-past' }, [el('small', { text: '지난 케이스' }), ...past.map((c, j) => el('button', { class: 'ln', onclick: onTap(() => { pzBook = j; repaint(); }) }, [pzSvg(pzMini(c.res, false), 'mi'), el('em', { class: c.r1 < c.r0 ? 'm' : '', text: pzSigned(c.r1 - c.r0) })])),
      el('button', { class: 'all', text: '기록 전체', onclick: onTap(() => { pzBook = 0; repaint(); }) })]) : null]),
    el('div', { class: 'pzr-mid' }, [pzSvg(pzCase(s.now, mat, true), 'pzr-cs'), el('div', { class: 'cap' }, [el('b', { text: `이번 케이스 ${k} / ${PZ_CASE}` }), el('small', { text: `${PZ_MATS[mat].n} 케이스 · 한 문제에 공 4분의 1 · 흰 공 → 노란 공 → 빨간 공 → 빨간 공` })])]),
    el('div', { class: 'pzr-go-p' }, [el('h3', {}, [document.createTextNode(`${PZ_BALL_KO[k >> 2]} ${(k & 3) + 1}/4`), el('small', { text: '레이팅에 맞춰 고른 퍼즐. 시작하기 전엔 보이지 않습니다.' })]),
      el('div', { class: 'mys', 'aria-hidden': 'true' }, [el('i'), el('span', { text: '?' })]),
      el('div', { class: 'row' }, [el('span', { text: '맞히면' }), el('b', { text: `+${g.win}` })]), el('div', { class: 'row' }, [el('span', { text: '틀리면' }), el('b', { text: `−${g.lose}` })]),
      el('button', { class: 'pzr-go', onclick: onTap(() => puzzle.start()) }, [fbIco('play'), el('span', { text: '풀기' })])]));
  wrap.appendChild(fit); $('#desk').appendChild(wrap);
}
// 포켓's rack: fifteen places in a triangle, empty (its puzzles to come)
function pzRack() {
  const u = ++pzUid, r = 20, g = r * 2.1, rows = 5, W = rows * g + 24, H = rows * g * .87 + 30;
  let s = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">${pzDefs(u)}<path d="M${W / 2} 4L${W - 4} ${H - 6}L4 ${H - 6}Z" fill="#5a3218" stroke="#2f1a0c" stroke-width="3" stroke-linejoin="round"/>`;
  for (let row = 0; row < rows; row++) for (let i = 0; i <= row; i++) { const cx = W / 2 + (i - row / 2) * g, cy = 24 + r + row * g * .87; s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#pz${u}h)" stroke="#0b1a12" stroke-width="2"/>`; }
  return s + '</svg>';
}
/* 레슨 (owner 11-16: the books were of another look than the rest of the desk): the game's lessons in the tray as cards in
   the shop's printed-card language (74-shop-cards.css), a course to a row under the shop's ivory rule - 기본기 blue, 큐볼
   다루기 red, 응용 green; on each card a little drawing of its table as the lesson sets it, its name and its levels, a mark
   once done at its top level. Tapping one starts it. */
const LESSON_HUE = ['r1', 'r3', 'lc-green', 'r0'];                    // a card's colour by its course (drills.COURSES)
const lessonDone = id => levelOf(id) >= drills.LEVELS;
// a volume's prize for doing all of it (economy.js LESSON_PRIZE): what it is and how far along, or 받음 once it is had
function prizeLine(v) {
  const p = ECONOMY.LESSON_PRIZE[v]; if (!p) return null;
  const ids = volLessons(v), got = net.me && (net.me.prizes || []).includes(v), n = ids.filter(lessonDone).length, what = itemName({ kind: p.kind, id: p.id });
  // (copy audit 03-06: 완료 보상, what it is, how far along; 받음 once it is had - then nothing to count)
  return el('div', { class: 'dk-prize' + (got ? ' got' : '') }, [el('i', { class: 'pz' }), el('span', null, [el('b', { text: '완료 보상' }),
    el('small', { text: `${p.coin.toLocaleString('ko-KR')} 코인 + ${what}` })]), got ? el('em', { class: 'got-tag', text: '받음' }) : ids.length ? el('em', { class: 'got-tag n', text: `${n} / ${ids.length}` }) : null]);
}
/* A lesson's table as it sets it out at its first level, drawn small (standing up: the card is tall): the cloth, the
   pockets, the cue ball and the balls, the way to the first ball, the circle the cue ball must stop in. Made once each. */
const LESSON_PIC = {};
const POOL_HUE = ['#f4f1ea', '#f2c21b', '#1f4fd1', '#d62b2b', '#6b2fb5', '#f07b14', '#1d8a3c', '#8b1d1d', '#141414'];
function lessonPic(id) {
  if (LESSON_PIC[id] !== undefined) return LESSON_PIC[id];
  const P = PH.pool; let L = null;
  try { L = drills.make(id, P, 1, seededRandom(7), game.vOf); } catch (e) { L = null; }
  if (!L || !P) return (LESSON_PIC[id] = null);
  const W = 2 * P.HW, H = 2 * P.HL, at = (x, y) => [(P.HW - y).toFixed(3), (P.HL + x).toFixed(3)], r = P.R * 1.8;   // (the table's length up the card; the balls drawn larger than they are, to be seen)
  const ball = (n, x, y) => { const [cx, cy] = at(x, y), c = POOL_HUE[n > 8 ? n - 8 : n] || '#ccc';
    return n > 8 ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#f4f1ea"/><circle cx="${cx}" cy="${cy}" r="${r * 0.62}" fill="${c}"/>` : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}"/>`; };
  const o = L.balls[0], [cx, cy] = at(L.cue[0], L.cue[1]), [ox, oy] = o ? at(o[1], o[2]) : [cx, cy];
  const pad = P.R * 2.4, svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${W + 2 * pad} ${H + 2 * pad}">`
    + `<rect x="${-pad}" y="${-pad}" width="${W + 2 * pad}" height="${H + 2 * pad}" rx="${pad * 0.9}" fill="#4a2f1c"/><rect width="${W}" height="${H}" fill="#1f7a4d"/>`
    + P.POCKETS.map(k => { const [x, y] = at(k.ax + (k.x - k.ax) * 0.7, k.ay + (k.y - k.ay) * 0.7); return `<circle cx="${x}" cy="${y}" r="${P.R * 1.7}" fill="#0b0b0b"/>`; }).join('')
    + (L.zone ? `<circle cx="${at(L.zone.x, L.zone.y)[0]}" cy="${at(L.zone.x, L.zone.y)[1]}" r="${L.zone.r}" fill="rgba(255,255,255,.12)" stroke="#fff" stroke-width="${P.R * 0.25}" stroke-dasharray="${P.R * 0.6} ${P.R * 0.5}"/>` : '')
    + (o ? `<line x1="${cx}" y1="${cy}" x2="${ox}" y2="${oy}" stroke="rgba(255,255,255,.75)" stroke-width="${P.R * 0.3}" stroke-dasharray="${P.R * 0.7} ${P.R * 0.6}"/>` : '')
    + L.balls.map(q => ball(q[0], q[1], q[2])).join('') + ball(0, L.cue[0], L.cue[1]) + '</svg>';
  return (LESSON_PIC[id] = 'data:image/svg+xml,' + encodeURIComponent(svg));
}
function deskLesson({ head, stage, slate }, v) {
  const top = drills.LEVELS; stage.dataset.win = '0';
  const ids = volLessons(v), cur = ids.includes(prefs.drill) ? prefs.drill : ids[0], done = ids.filter(lessonDone).length;
  trainHead(head, `${MODE_KO[v]} 레슨`, ids.length ? `완료 ${done} / ${ids.length}` : '');
  const cards = [];
  drills.COURSES.forEach((course, ci) => {
    const of = ids.filter(id => drills.byId(id).course === course); if (!of.length) return;
    cards.push(el('div', { class: 'dk-tier' }, [el('span', { text: `${course} (${of.filter(lessonDone).length}/${of.length})` })]));
    for (const id of of) {
      const dr = drills.byId(id), lv = levelOf(id), pic = lessonPic(id);
      cards.push(el('button', { class: `dk-card lesson ${LESSON_HUE[ci] || 'r0'}` + (id === cur ? ' last' : '') + (lv >= top ? ' done' : ''), 'aria-label': dr.name,
        onclick: onTap(() => { prefs.lastTrain = 'practice'; prefs.mode = 'practice'; practice.start(id); }) }, [
        el('i', { class: 'face', 'aria-hidden': 'true' }), pic ? el('img', { class: 'lp', src: pic, alt: '' }) : null,
        lv >= top ? el('span', { class: 'ok', 'aria-hidden': 'true', text: '✓' }) : null,
        el('b', { class: 'nm', text: dr.name }),
        el('span', { class: 'lvl' }, Array.from({ length: top }, (_, k) => el('i', { class: k < lv ? 'on' : '' })))]));
    }
  });
  // (copy audit 03-03, 03-05: the cards and their marks say how to use them and what is done)
  dkPut(stage, ids.length ? el('div', { class: 'dk-cards pc lessons' }, cards) : el('div', { class: 'dk-empty', text: '준비 중입니다' }));
  dkPut(slate, dkH1(MODE_KO[v]));
  dkPut(slate, [dkHr(), prizeLine(v)]);
  dkPut(slate, dkActs(cur ? dkMain('이어서 하기', drills.byId(cur).name, () => practice.start(cur)) : null,
    // (58-tutorial.js: the first shot, step by step - its prize once per account)
    dkSec('튜토리얼', () => tutorial.start(), prefs.tutDone ? '완료' : `보상 코인 ${ECONOMY.TUTORIAL_PRIZE.coin} + ${itemName({ kind: 'cue', id: ECONOMY.TUTORIAL_PRIZE.id })}`)));
}
// 자유 연습: the game's table in the tray, racked as the game begins
function deskFree({ head, slate }, v) {
  // (copy audit 03-11: moving balls and undoing are told when they are used)
  trainHead(head, `${MODE_KO[v]} 자유 연습`);
  // (the slate otherwise empty: owner 11-16 took the bots off it - they are 컴퓨터 대전's)
  dkPut(slate, [...dkH1(MODE_KO[v])]);
  dkPut(slate, dkActs(dkMain('연습 시작', null, () => practice.start('free'))));
}
