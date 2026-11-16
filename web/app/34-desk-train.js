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
  if (t === 'lesson') return FRIEND_GAMES.includes(G.lesson) && TRAIN_HAS.lesson(G.lesson) ? G.lesson : 'eight';
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
  dkPut(d.rail, FRIEND_GAMES.map(id => railBtn(id === on, MODE_KO[id], TRAIN_HAS[t](id) ? null : '준비 중', pick(id), !TRAIN_HAS[t](id), 'mode-' + id)));
  if (t === 'puzzle') deskPuzzle(d); else if (t === 'lesson') deskLesson(d, on); else if (t === 'cpu') deskMatch(d, true, trainBack()); else deskFree(d, on);
  // (with the old menu - a screen held upright, or 디버그 - 훈련 is one tab: its four places picked at the slate's top)
  if (!menuOn()) d.slate.insertBefore(dkSeg(Object.entries(TRAIN_KO).map(([k, n]) => [k, k === 'cpu' ? '컴퓨터' : n]), t, k => { if (k !== t) { trainGo(k); repaintLive(); } }), d.slate.firstChild);
}
// the way back to the menu: an X at the tray's head, as 친구와 플레이's (none with the old menu, whose tabs are the way)
const trainBack = () => menuOn() ? () => deskGo('play') : null;
function trainHead(head, title, sub) {
  const back = trainBack();
  if (back) { head.className = 'dk-head open'; dkPut(head, el('button', { class: 'dk-x', 'aria-label': '메뉴로', onclick: () => { SND.tap(); back(); } }, el('i'))); }
  dkPut(head, dkTitle(title, sub));
}
/* 퍼즐 (owner 11-16): the tray a map of every topic's road (puzzles.js STAGES) - one winding line from the first topic at the
   bottom up through the rest, each topic PZ_SLOTS stages, its 10th and 20th a 챌린지 (a shot a real player made; diamonds
   the first time: puzzles.js challenge), and past them a stage of puzzles made for practice (no reward; to come). A stage
   opens when the one before it is solved; a topic when PZ_NEED of the one before it are. Stages not made yet stand on the
   road, faint. The slate: the topic of the stage picked, by its name, and its own small road. */
const PZ_SLOTS = 20;
const pzSlots = si => Array.from({ length: PZ_SLOTS }, (_, k) => ({ si, n: k + 1, q: puzzles.of(si).find(x => x.n === k + 1) || null, ch: (k + 1) % 10 === 0 }));
const pzBothCh = si => pzSlots(si).filter(x => x.ch).every(x => x.q && prefs.pz.stars[x.q.id]);
const pzMapTop = {};                                                   // where the map was scrolled to, kept between paints
function deskPuzzle(d) {
  const { head, stage, slate } = d;
  // (the puzzles are being made again on the game's physics: until then the place is kept, empty)
  if (!puzzles.list.length) {
    trainHead(head, '퍼즐');
    dkPut(slate, [...dkH1('퍼즐'), dkHr(), dkTxt('등록된 퍼즐이 없습니다')]);   // (copy audit 03-09: said once)
    return;
  }
  const z = prefs.pz, L = puzzles.list.filter(pzOpenQ), cur0 = puzzles.byId(z.cur) || puzzles.list[0], cur = pzOpenQ(cur0) ? cur0 : L.find(q => q.stage === cur0.stage) || L[0], S = puzzles.STAGES[cur.stage];
  const slots = pzSlots(cur.stage), done = slots.filter(x => x.q && z.stars[x.q.id]).length;
  trainHead(head, '퍼즐', `${puzzles.list.filter(q => z.stars[q.id]).length} / ${puzzles.STAGES.length * PZ_SLOTS}`);
  pzMap(stage, cur);
  // (copy audit 03-07: the goal once)
  dkPut(slate, [el('div', { class: 'pz-topic' }, [el('small', { text: `주제 ${cur.stage + 1}` }), el('b', { text: S.name })]), dkTxt(S.desc), dkHr(),
    ...pzRoad(slots, cur, done), dkLab('목표'), dkTxt(game.MODES.puzzle4.GOALS[S.goal].text + ' · 노란 공 접촉 금지')]);
  dkPut(slate, dkActs(dkMain(puzzles.challenge(cur) ? '챌린지 시작' : `스테이지 ${cur.n} 시작`, null, () => puzzle.start(cur.id))));
}
// a stage on either road picked: the one in hand, or why it cannot be (closed, or not made yet)
function pzPick(x) {
  const z = prefs.pz;
  if (!x.q) return toast(x.more ? (pzBothCh(x.si) ? '준비 중입니다' : '챌린지 둘을 깨면 열립니다') : '준비 중인 스테이지입니다', '', 1800);
  if (!pzOpenQ(x.q)) return toast(!pzOpen(x.si) ? `'${puzzles.STAGES[x.si - 1].name}'에서 ${PZ_NEED}문제를 풀면 열립니다` : x.ch ? '앞 스테이지를 모두 풀면 챌린지가 열립니다' : '앞 스테이지를 풀면 열립니다', '', 1900);
  if (z.cur === x.q.id) return; z.cur = x.q.id; z.open = x.si; repaintLive();
}
// a stage as a node: its number (or the challenge's stone), its stars once solved; open, closed, or not made yet
function pzNode(x, cur, cls) {
  const z = prefs.pz, q = x.q, open = q && pzOpenQ(q), stars = q ? z.stars[q.id] || 0 : 0;
  return el('button', { class: cls + (x.ch ? ' ch' : '') + (x.more ? ' more' : '') + (q || x.more ? '' : ' soon') + (open ? '' : ' lock') + (stars ? ' done' : ''), 'aria-pressed': String(!!q && q === cur),
    'aria-label': `${x.more ? '연습 퍼즐' : x.ch ? '챌린지' : x.n + '번'}${stars ? `, 별 ${stars}개` : !q ? ', 준비 중' : open ? '' : ', 잠김'}`, onclick: onTap(() => pzPick(x)) }, [
    x.ch ? el('i', { class: 'gem' }) : el('b', { text: x.more ? '∞' : String(x.n) }),
    stars ? el('span', { class: 'st' }, [0, 1, 2].map(i => el('i', { class: i < stars ? 'on' : '' }))) : null]);
}
/* The tray's map: each topic a stretch of the road going up, its name at its foot; the road lit as far as it is open; the
   stage in hand ringed and brought into view (or the map where it was left). */
function pzMap(stage, cur) {
  stage.dataset.win = '0';
  const ROW = app.classList.contains('compact') ? 54 : 66, xOf = k => 50 + 30 * Math.sin(k * 0.62);
  const box = el('div', { class: 'pz-map' });
  const regions = puzzles.STAGES.map((S, si) => {
    const slots = [...pzSlots(si), { si, n: PZ_SLOTS + 1, q: null, more: true }], H = (slots.length + 0.6) * ROW, at = k => [xOf(k + si * 3), H - (k + 0.8) * ROW];
    const open = slots.filter(x => x.q && pzOpenQ(x.q)).length, P = slots.map((_, k) => at(k));
    const line = A => A.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(2) + ' ' + y.toFixed(1)).join(' ');
    const reg = el('section', { class: 'pz-reg' + (si % 2 ? ' alt' : '') + (pzOpen(si) ? '' : ' shut'), style: `height:${H}px` }, [
      el('div', { class: 'pz-reg-h' }, [el('small', { text: `주제 ${si + 1}` }), el('b', { text: S.name }),
        el('span', { text: pzOpen(si) ? `${slots.filter(x => x.q && prefs.pz.stars[x.q.id]).length} / ${PZ_SLOTS}` : '잠김' })])]);
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 100 ${H}`); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = `<path class="rd-all" d="${line(P)}"/>${open ? `<path class="rd-on" d="${line(P.slice(0, Math.max(1, open)))}"/>` : ''}`;
    reg.appendChild(svg);
    slots.forEach((x, k) => { const n = pzNode(x, cur, 'pz-node'); n.style.left = P[k][0].toFixed(2) + '%'; n.style.top = P[k][1].toFixed(1) + 'px'; reg.appendChild(n); });
    return reg;
  });
  dkPut(box, regions); dkPut(stage, box);
  box.addEventListener('scroll', () => { pzMapTop.v = box.scrollTop; }, { passive: true });
  requestAnimationFrame(() => {
    if (!box.isConnected) return;
    // (where it was left; the stage in hand brought to the middle only when it is out of sight there)
    if (pzMapTop.v != null) box.scrollTop = pzMapTop.v;
    const n = box.querySelector('.pz-node[aria-pressed="true"]');
    if (n) { const r = n.getBoundingClientRect(), b = box.getBoundingClientRect(); if (r.top < b.top + 20 || r.bottom > b.bottom - 20) box.scrollTop += (r.top + r.height / 2) - (b.top + b.height / 2); }
    pzMapTop.v = box.scrollTop;
  });
}
/* A topic's small road on the slate: its stages five to a row, winding back and forth, the line lit as far as they are open,
   the 챌린지 cut stones at the ends of their rows. */
function pzRoad(slots, cur, done) {
  const W = 300, per = 5, row = app.classList.contains('compact') && !app.classList.contains('portrait') ? 50 : 58, gap = (W - 40) / (per - 1), n = slots.length, rows = Math.ceil(n / per);
  const at = k => { const r = Math.floor(k / per), c = k % per; return [20 + (r % 2 ? per - 1 - c : c) * gap, 26 + r * row]; };
  const pts = slots.map((_, k) => at(k)), H = 26 + (rows - 1) * row + 34, reached = slots.filter(x => x.q && pzOpenQ(x.q)).length;
  const line = P => P.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ');
  const box = el('div', { class: 'pz-road', style: `aspect-ratio:${W}/${H}` });
  box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path class="rd-all" d="${line(pts)}"/>${reached ? `<path class="rd-on" d="${line(pts.slice(0, Math.max(1, reached)))}"/>` : ''}</svg>`;
  slots.forEach((x, k) => { const nd = pzNode(x, cur, 'rd-node'); nd.style.left = (pts[k][0] / W * 100).toFixed(2) + '%'; nd.style.top = (pts[k][1] / H * 100).toFixed(2) + '%'; box.appendChild(nd); });
  return [el('div', { class: 'pz-road-h' }, [el('b', { text: `스테이지 ${cur.n}` }), el('small', { text: `${done} / ${n}` })]), box];
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
