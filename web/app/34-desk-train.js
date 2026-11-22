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
  // 오늘의 퍼즐 (owner 11-22): one puzzle a day, the same for everyone (by the date), open or not
  const day = pzDaily(), dayDone = z.day === attend.today();
  if (day) head.appendChild(el('button', { class: 'pz-day' + (dayDone ? ' done' : ''), onclick: onTap(() => puzzle.start(day.id)) }, [el('i'), document.createTextNode(dayDone ? '오늘의 퍼즐 완료' : '오늘의 퍼즐')]));
  pzMap(stage, cur);
  // (copy audit 03-07: the goal once)
  dkPut(slate, [el('div', { class: 'pz-topic' }, [el('small', { text: `주제 ${cur.stage + 1}` }), el('b', { text: S.name })]), dkTxt(S.desc), dkHr(),
    ...pzGrid(slots, cur, done), dkLab('목표'), dkTxt(game.MODES.puzzle4.GOALS[S.goal].text + ' · 노란 공 접촉 금지')]);
  dkPut(slate, dkActs(dkMain(puzzles.challenge(cur) ? '챌린지 시작' : `스테이지 ${cur.n} 시작`, null, () => puzzle.start(cur.id))));
}
// a stage on either road picked: the one in hand, or why it cannot be (closed, or not made yet)
function pzPick(x) {
  const z = prefs.pz;
  if (x.more && pzBothCh(x.si)) return puzzle.practice(x.si);   // (∞: 연습 퍼즐 - 52-puzzle.js practiceOf)
  if (!x.q) return toast(x.more ? '챌린지 둘을 깨면 열립니다' : '준비 중인 스테이지입니다', '', 1800);
  if (!pzOpenQ(x.q)) return toast(!pzOpen(x.si) ? `'${puzzles.STAGES[x.si - 1].name}'에서 ${PZ_NEED}문제를 풀면 열립니다` : x.ch ? '앞 스테이지를 모두 풀면 챌린지가 열립니다' : '앞 스테이지를 풀면 열립니다', '', 1900);
  if (z.cur === x.q.id) return; z.cur = x.q.id; z.open = x.si; repaintLive();
}
/* The tray's map (owner 11-22: a metro line, after R2): every topic a station, its twenty stages two rows of ten - out to
   the right from the station, round a turn and back - and a curve up to the next topic's station, on which stands its
   ∞ (연습 퍼즐: made without end once both 챌린지 are beaten). Read from the bottom up, scrolled as before. A stage solved
   is a ball as the 랭킹전 card draws its game's balls (the worn set's own picture, 32-desk.js ballPic) - 4구's red with its
   number, a 챌린지 its yellow; the stage in hand the white, ringed. The line lit as far as it is solved, gold once the
   whole topic is; a topic not yet open, dotted. Down the right an 8-step bar, a topic to a step, each filled as far as
   it is solved, the part in view framed: tap one to go to it. 지금 brings the stage in hand back into view. */
const pzMapTop = {};                                                   // where the map was scrolled to, kept between paints
function pzMap(stage, cur) {
  stage.dataset.win = '0';
  const box = el('div', { class: 'pz-map' }), bar = el('div', { class: 'pz-bar', role: 'navigation', 'aria-label': '주제로 가기' }), now = el('button', { class: 'pz-now', hidden: '' });
  dkPut(stage, [box, bar, now]);
  requestAnimationFrame(() => { if (box.isConnected) pzMetro(box, bar, now, cur); });
}
function pzMetro(box, bar, now, cur) {
  const z = prefs.pz, S = puzzles.STAGES, nT = S.length, small = app.classList.contains('compact');
  const W = box.clientWidth - (small ? 24 : 32);                       // (once, as it is built: the bar takes the right edge)
  const rowH = small ? 50 : 64, band = small ? 36 : 44, R = small ? 13 : 17, r = small ? 11 : 14, turn = rowH / 2;
  const mL = turn + r + 10, mR = turn + 8, per = 2 * rowH + band, top = band + r + 30, foot = band + 46, Htot = nT * per + top + foot;
  const yA = t => Htot - foot - t * per - rowH / 2, yB = t => yA(t) - rowH;
  const sx = mL + R - turn * 0.2, xs0 = sx + R + r + 10, xs1 = W - mR;
  const stopXY = (t, k) => { const f = ((k - 1) % 10) / 9; return k <= 10 ? [xs0 + (xs1 - xs0) * f, yA(t)] : [xs1 - (xs1 - xs0) * f, yB(t)]; };
  // the curve from a topic's last stage up to the next station, and where its ∞ stands (half way along it)
  const cx = Math.max(6, mL - turn * 1.15), up = t => t < nT - 1 ? yA(t + 1) : yB(t) - rowH * 0.9;
  const bez = (t, u) => { const p0 = [xs0, yB(t)], p1 = [cx, yB(t)], p2 = [cx, up(t)], p3 = [t < nT - 1 ? sx : xs0 * 0.6 + cx * 0.4, up(t)], v = 1 - u;
    return [0, 1].map(i => v * v * v * p0[i] + 3 * v * v * u * p1[i] + 3 * v * u * u * p2[i] + u * u * u * p3[i]); };
  const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'), wrap = el('div', { class: 'pz-mt', style: `height:${Htot}px` });
  svg.setAttribute('viewBox', `0 0 ${W} ${Htot}`); svg.setAttribute('width', W); svg.setAttribute('height', Htot); svg.setAttribute('aria-hidden', 'true');
  let lines = '', curY = null; const nodes = [];
  for (let t = 0; t < nT; t++) {
    const open = pzOpen(t), slots = pzSlots(t), solved = slots.filter(x => x.q && z.stars[x.q.id]).length, all = solved === PZ_SLOTS, a = yA(t), b = yB(t);
    const [c1x, c1y] = bez(t, 1), seg = `M${sx} ${a} L${xs1} ${a} A${turn} ${turn} 0 0 0 ${xs1} ${b} L${xs0} ${b} C${cx} ${b} ${cx} ${up(t)} ${c1x} ${c1y}`;
    lines += `<path class="mt-ln${open ? '' : ' shut'}" d="${seg}"/>`;
    // (lit: from the station to the last stage solved in a row from the first - the road as far as it goes on)
    let reach = 0; while (reach < PZ_SLOTS && slots[reach].q && z.stars[slots[reach].q.id]) reach++;
    if (reach) { const [ex, ey] = stopXY(t, reach); lines += `<path class="mt-on${all ? ' gold' : ''}" d="${all ? seg : reach <= 10 ? `M${sx} ${a} L${ex} ${a}` : `M${sx} ${a} L${xs1} ${a} A${turn} ${turn} 0 0 0 ${xs1} ${b} L${ex} ${b}`}"/>`; }
    // the station: its number (a tick when all of it is solved), its name in the band under it, how far along at the right
    nodes.push(el('span', { class: 'mt-st' + (all ? ' all' : open ? '' : ' shut'), style: `left:${sx}px;top:${a}px;--R:${R}px`, text: all ? '✓' : String(t + 1), 'aria-hidden': 'true' }));
    nodes.push(el('span', { class: 'mt-nm' + (open ? '' : ' shut'), style: `left:${sx + R + 8}px;top:${a + R + 4}px`, text: S[t].name }));
    nodes.push(el('span', { class: 'mt-ct' + (all ? ' all' : open ? '' : ' shut'), style: `right:${W - xs1 - turn}px;top:${a + R + 4}px`,
      text: open ? (all ? '완료' : `${solved} / ${PZ_SLOTS}`) : t > 0 ? `'${S[t - 1].name}' ${PZ_NEED}문제면 열림` : '' }));
    slots.forEach((x, k) => { const [px, py] = stopXY(t, k + 1); const n = pzStop(x, cur, r); n.style.left = px + 'px'; n.style.top = py + 'px'; nodes.push(n); if (x.q && x.q === cur) curY = py; });
    // its ∞, half way up the curve
    const [ix, iy] = bez(t, 0.5), inf = pzStop({ si: t, n: PZ_SLOTS + 1, q: null, more: true }, cur, r); inf.style.left = ix + 'px'; inf.style.top = iy + 'px'; nodes.push(inf);
  }
  svg.innerHTML = lines; wrap.append(svg, ...nodes); box.appendChild(wrap);
  // the bar: a step a topic, the first at the bottom; filled as far as it is solved; tapped, its topic brought into view
  const H = box.clientHeight, steps = S.map((q, t) => {
    const n = pzSlots(t).filter(x => x.q && z.stars[x.q.id]).length;
    return el('button', { class: 'pz-step' + (pzOpen(t) ? '' : ' shut') + (n === PZ_SLOTS ? ' all' : ''), style: `--f:${(n / PZ_SLOTS * 100).toFixed(1)}%`, 'aria-label': `주제 ${t + 1} ${q.name}`,
      onclick: () => { SND.tap(); box.scrollTo({ top: Math.max(0, yA(t) - H * 0.62), behavior: 'smooth' }); } }, el('b', { text: String(t + 1) }));
  });
  const win = el('i', { class: 'pz-win', 'aria-hidden': 'true' });
  dkPut(bar, [...steps.reverse(), win]);
  // the frame on the bar and 지금 follow the scroll (only the scroll's own number is read)
  const show = () => {
    const y = box.scrollTop, lo = (Htot - foot - y - H) / (nT * per), hi = (Htot - foot - y) / (nT * per);
    win.style.bottom = (Math.max(0, lo) * 100).toFixed(2) + '%'; win.style.height = ((Math.min(1, hi) - Math.max(0, lo)) * 100).toFixed(2) + '%';
    now.hidden = curY == null || (curY > y + 30 && curY < y + H - 30);
    pzMapTop.v = y;
  };
  now.textContent = ''; now.append(el('i'), document.createTextNode(cur ? `지금 · ${puzzles.challenge(cur) ? '챌린지' : '스테이지 ' + cur.n}` : '지금'));
  now.onclick = () => { SND.tap(); if (curY != null) box.scrollTo({ top: curY - H * 0.55, behavior: 'smooth' }); };
  box.addEventListener('scroll', show, { passive: true });
  // (where it was left; else the stage in hand brought to the middle)
  box.scrollTop = pzMapTop.v != null ? pzMapTop.v : curY != null ? curY - H * 0.55 : Htot;
  if (pzMapTop.v != null && curY != null && (curY < box.scrollTop + 20 || curY > box.scrollTop + H - 20)) box.scrollTop = curY - H * 0.55;
  show();
}
/* a stage on the map: solved, a ball - 4구's red with its number, a 챌린지 the yellow with a star; the one in hand the white,
   ringed; open, a small ring with its number; a 챌린지 still to beat its diamond; closed or not made yet, a faint dot; the ∞ */
function pzStop(x, cur, r) {
  const z = prefs.pz, q = x.q, open = q && pzOpenQ(q), stars = q ? z.stars[q.id] || 0 : 0, me = !!q && q === cur, inf = !!x.more, infOn = inf && pzBothCh(x.si);
  const kind = inf ? 'inf' + (infOn ? '' : ' lock') : me ? 'cur' : stars ? 'done' + (x.ch ? ' ch' : '') : x.ch ? 'gem' + (open ? '' : ' lock') : open ? 'open' : q ? 'lock' : 'soon';
  const pic = me ? ballPic(prefs.ballSkin, 'carom', 0, { class: 'bp' }) : stars ? ballPic(prefs.ballSkin, 'carom', x.ch ? 1 : 2, { class: 'bp' }) : null;
  return el('button', { class: 'mt-stop ' + kind, style: r ? `--r:${r}px` : null, 'aria-pressed': String(me),
    'aria-label': `${inf ? '연습 퍼즐' : x.ch ? '챌린지' : x.n + '번'}${stars ? `, 별 ${stars}개` : inf ? (infOn ? '' : ', 잠김') : !q ? ', 준비 중' : open ? '' : ', 잠김'}`, onclick: onTap(() => pzPick(x)) },
    [pic, inf ? el('b', { text: '∞' }) : x.ch && !me ? el('b', { class: 'gm', text: stars ? '★' : '' }) : el('b', { text: String(x.n) })]);
}
/* The slate: the topic's twenty, five to a row, drawn as on the map */
function pzGrid(slots, cur, done) {
  const box = el('div', { class: 'pz-grid' }, slots.map(x => pzStop(x, cur, 0)));
  return [el('div', { class: 'pz-road-h' }, [el('b', { text: puzzles.challenge(cur) ? '챌린지' : `스테이지 ${cur.n}` }), el('small', { text: `${done} / ${slots.length}` })]), box];
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
