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
/* 퍼즐 (owner 11-23/24; shown as stages since 11-24 저녁 - 52-puzzle.js pzr): on the menu's charcoal cloth, as 랭킹전's games
   lie (#desk.felt). Its head: 캐롬 · 포켓, how hard (쉽게 · 보통 · 어렵게) and 오늘의 퍼즐. Left, the stage the player is at,
   the stars won and how many more to the next case's material; the cases (racks) closed. The middle, the case being filled
   (a quarter of a ball a puzzle) or the rack (a ball a puzzle), each place rimmed in its stars' colour. Right, the next
   stage, hidden until it is started - the stars it can give, and a mark when it is the hard one. A case just closed shows
   its result over it all (pzDone); the record (pzBook) lists the closed ones, each one's puzzles to play again. No rating
   anywhere: it chooses, unseen. */
let pzView = 'four', pzBook = null, pzDone = null;
/* 시안 (owner 11-24 밤: several looks for the desk, to choose from): 'case' the case in the middle (above); 'map' the
   case's stages as a path; 'shelf' the cases as a collection on shelves; 'card' the next stage as one card. */
let pzLook = 'case';
// the stages of the case being filled: each one's number, stars (null: not yet), whether hard, whether the one to play
function pzStagesOf(k, s) {
  const size = pzSize(k), n = s.now.length, st0 = n ? (s.st0 || s.stage - n + 1) : s.stage + 1;
  return Array.from({ length: size }, (_, i) => ({ i, st: st0 + i, stars: i < n ? pzStars(s.now[i][1]) : null, cur: i === n, hard: k === 'pocket' ? i % 5 === 4 : i % 4 === 3 }));
}
const pzMedal = v => v == null ? '' : ['m0', 'm1', 'm2', 'm3'][v];
// the stars and the way to the next material, small (a line)
const pzTotal = (s, holder) => { const m = pzMatOf(s.stars), up = PZ_MATS[m + 1]; return el('div', { class: 'pz-tot' }, [el('i', { class: 'star' }), el('b', { text: String(s.stars) }),
  up ? el('span', { text: `${up.n} ${holder}까지 ${up.at - s.stars}` }) : el('span', { text: `금 ${holder}` }), up ? el('i', { class: 'bar' }, el('b', { style: `width:${Math.round(100 * (s.stars - PZ_MATS[m].at) / (up.at - PZ_MATS[m].at))}%` })) : null]); };
// B: the stages of this case as a path, two rows snaking; the stars over each done one, the next one large with 풀기
function pzDeskMap(fit, k, s) {
  const L = pzStagesOf(k, s), holder = k === 'pocket' ? '랙' : '케이스', mat = s.now.length ? (s.mat || 0) : pzMatOf(s.stars), per = 8, step = 88 / (per - 1);
  const pos = i => i < per ? [6 + i * step, 30] : [94 - (i - per) * step, 72];
  const path = el('div', { class: 'pzm-path' });
  path.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M6 30H94C100 30 100 72 94 72H${pos(L.length - 1)[0]}" class="bg"/><path d="M6 30H94C100 30 100 72 94 72H${pos(L.length - 1)[0]}" class="dash"/></svg>`;
  for (const q of L) {
    const [x, y] = pos(q.i), cls = 'nd' + (q.stars != null ? ' done ' + pzMedal(q.stars) : '') + (q.cur ? ' cur' : '') + (q.hard ? ' hard' : '') + (x > 80 ? ' gl' : '');
    path.appendChild(el('div', { class: cls, style: `left:${x}%;top:${y}%` }, [
      q.stars != null ? pzStarRow(q.stars, 3, 'up') : null,
      q.cur ? el('button', { class: 'dot', 'aria-label': `스테이지 ${q.st} 풀기`, onclick: onTap(() => puzzle.start(null, { game: k })) }, el('b', { text: String(q.st) })) : el('span', { class: 'dot' }, el('b', { text: String(q.st) })),
      q.cur ? el('button', { class: 'go', onclick: onTap(() => puzzle.start(null, { game: k })) }, [fbIco('play'), el('span', { text: '풀기' }), q.hard ? el('em', { text: '어려운 스테이지' }) : null]) : null]));
  }
  const L0 = L[0].st, L1 = L[L.length - 1].st;
  fit.append(el('div', { class: 'pzm-top' }, [el('div', { class: 'pzm-ch' }, [pzSvg(k === 'pocket' ? pzRackMini(s.now, true) : pzMini(s.now, true), 'mi'),
    el('div', {}, [el('b', { text: `${PZ_MATS[mat].n} ${holder}` }), el('small', { text: `스테이지 ${L0}–${L1} · ${k === 'pocket' ? '한 스테이지에 공 하나' : '한 스테이지에 공 4분의 1'}` })])]), pzTotal(s, holder)]),
    path,
    el('div', { class: 'pzm-foot' }, [el('span', { class: 'lg' }, [el('i', { class: 'm3' }), document.createTextNode('★★★'), el('i', { class: 'm2' }), document.createTextNode('★★'), el('i', { class: 'm1' }), document.createTextNode('★'), el('i', { class: 'hard' }), document.createTextNode('어려운 스테이지')]),
      el('button', { class: 'lnk', text: `지난 ${holder} ${s.cases.length}개 · 기록`, onclick: onTap(() => { if (s.cases.length) { pzBook = 0; repaintLive(); } }) })]));
}
// C: the case being filled large on a plank, the ones closed on a shelf under it, the materials still to come; the next
// stage on a tile at the side
function pzDeskShelf(fit, k, s) {
  const holder = k === 'pocket' ? '랙' : '케이스', n = s.now.length, mat = n ? (s.mat || 0) : pzMatOf(s.stars), L = pzStagesOf(k, s), cur = L[n] || L[0], m = pzMatOf(s.stars);
  const shelf = el('div', { class: 'pzs-shelf' }, [...s.cases.slice(0, 4).map((c, j) => el('button', { class: 'it', onclick: onTap(() => { pzBook = j; repaintLive(); }) }, [pzSvg(pzHolder(k, c.res, c.m, false), 'pc'), el('em', {}, [el('i', { class: 'star' }), document.createTextNode(`${pzr.starsIn(c.res)}`)])])),
    el('div', { class: 'it next' }, el('span', { text: '다음 자리' }))]);
  fit.append(el('div', { class: 'pzs-main' }, [
    el('div', { class: 'pzs-now' }, [el('div', { class: 'hd' }, [el('small', { text: `지금 채우는 ${holder} · ${PZ_MATS[mat].n}` }), el('b', {}, [document.createTextNode(`스테이지 ${L[0].st}–${L[L.length - 1].st}`), el('span', {}, [el('i', { class: 'star' }), document.createTextNode(`${pzr.starsIn(s.now)} / ${pzSize(k) * 3}`)])]), el('em', { text: `${n} / ${pzSize(k)}` })]),
      pzSvg(pzHolder(k, s.now, mat, true), k === 'pocket' ? 'pzr-rk' : 'pzr-cs'), el('i', { class: 'plank' })]),
    el('div', { class: 'pzs-done' }, [el('small', { text: `완성한 ${holder} ${s.cases.length}개` }), shelf, el('i', { class: 'plank' })]),
    el('div', { class: 'pzs-mats' }, PZ_MATS.map((x, i) => el('div', { class: 'mt' + (i <= m ? ' on' : '') }, [el('i', { style: `background:linear-gradient(${x.a},${x.b})` }), el('b', { text: x.n }), el('span', { text: `★ ${x.at}` })])))]),
  el('div', { class: 'pzs-side' }, [el('div', { class: 'pzs-st' }, [el('small', { text: '모은 별' }), el('div', { class: 'big' }, [el('i', { class: 'star' }), el('b', { text: String(s.stars) })]), pzTotal(s, holder)]),
    el('div', { class: 'pzs-go' + (cur.hard ? ' hard' : '') }, [el('small', { text: cur.hard ? '다음 · 어려운 스테이지' : '다음' }), el('b', { class: 'num', text: String(cur.st) }), el('span', { text: `스테이지 · ${pzPlace(k, n)}` }),
      el('div', { class: 'mys', 'aria-hidden': 'true' }, [el('i'), el('span', { text: '?' })]), el('div', { class: 'st3' }, [0, 1, 2].map(() => el('i', { class: 'star' }))), el('small', { text: '한 번에 풀면 칸이 금색으로' }),
      el('button', { class: 'pzr-go', onclick: onTap(() => puzzle.start(null, { game: k })) }, [fbIco('play'), el('span', { text: '풀기' })])])]));
}
// D: the next stage as one card (a table under frosted glass, its number), a stack behind it; the stages just played at
// the left, how hard and 오늘의 퍼즐 at the right
function pzDeskCard(fit, k, s) {
  const holder = k === 'pocket' ? '랙' : '케이스', n = s.now.length, L = pzStagesOf(k, s), cur = L[n] || L[0];
  const past = [...s.now.map((r, i) => [L[i].st, pzStars(r[1])]).reverse(), ...(s.cases[0] ? s.cases[0].res.map((r, i) => [(s.cases[0].st0 || 0) + i, pzStars(r[1])]).reverse() : [])].slice(0, 8);
  const dots = k === 'pocket' ? [['#f2c21b', 30, 36], ['#1d4fb8', 62, 28], ['#d62b2b', 74, 62], ['#f4f1ea', 22, 66], ['#111', 48, 52]] : [['#f4f1ea', 26, 34], ['#f2c21b', 64, 60], ['#d62b2b', 80, 24], ['#d62b2b', 44, 72]];
  const prev = el('div', { class: 'pv' + (k === 'pocket' ? ' pool' : '') }, [el('div', { class: 'cl' }, dots.map(([c, x, y]) => el('i', { style: `background:${c};left:${x}%;top:${y}%` }))), el('span', { class: 'q', text: '?' }), cur.hard ? el('em', { text: '어려운 스테이지' }) : null]);
  fit.append(el('div', { class: 'pzd-recent' }, [el('small', { text: '최근 스테이지' }), ...past.map(([st, v], i) => el('div', { class: 'ln' + (i === 0 ? ' on' : '') }, [el('b', { text: String(st) }), pzStarRow(v), el('span', { text: v === 0 ? '못 풂' : v === 3 ? '한 번에' : v === 2 ? '두 번째' : '세 번째' })])),
    el('button', { class: 'lnk', text: `기록 · ${holder} ${s.cases.length}개`, onclick: onTap(() => { if (s.cases.length) { pzBook = 0; repaintLive(); } }) })]),
  el('div', { class: 'pzd-mid' }, [el('div', { class: 'stack' }, [el('i', { class: 'b1' }), el('i', { class: 'b2' }), el('article', { class: 'cd' }, [prev,
    el('div', { class: 'tx' }, [el('small', { text: '스테이지' }), el('b', { class: 'num', text: String(cur.st) }), el('span', { text: `${pzPlace(k, n)} · ${PZ_MATS[s.now.length ? (s.mat || 0) : pzMatOf(s.stars)].n} ${holder} ${n} / ${pzSize(k)}` }),
      el('div', { class: 'lg' }, [['한 번에', 3], ['두 번째', 2], ['세 번째', 1]].map(([t, m]) => el('span', {}, [pzStarRow(m, m), document.createTextNode(t)])))])])]),
    el('button', { class: 'pzr-go', onclick: onTap(() => puzzle.start(null, { game: k })) }, [fbIco('play'), el('span', { text: '풀기' })])]),
  el('div', { class: 'pzd-side' }, [el('div', { class: 'tot' }, [el('i', { class: 'star' }), el('b', { text: String(s.stars) }), el('span', { text: '모은 별' })]),
    el('small', { text: '난이도' }), ...Object.entries(PZ_DIFF).map(([kk, v]) => el('button', { class: 'df' + (prefs.pzr.diff === kk ? ' on' : ''), onclick: onTap(() => { prefs.pzr.diff = kk; for (const g of ['four', 'pocket']) pzr.of(g).cur = null; savePrefs(); repaintLive(); }) }, [el('b', { text: v.n }), el('span', { text: kk === 'easy' ? '거의 다 풀리는' : kk === 'normal' ? '셋 중 둘' : '반반' })])),
    el('div', { class: 'day' }, [el('b', { text: '오늘의 퍼즐' }), el('span', { text: '모두 같은 문제 · 하루 한 번' }), el('button', { text: '풀어보기', onclick: onTap(() => { const d = pzDaily(); if (d) puzzle.start(d.id, { free: 'day' }); }) })])]));
}
const pzDate = t => { const m = /^\d+-(\d+)-(\d+)/.exec(t || ''); return m ? `${+m[1]}월 ${+m[2]}일` : ''; };
// stars drawn: n won of three (or out of `of`)
const pzStarRow = (n, of = 3, cls = '') => el('span', { class: 'pz-stars ' + cls, 'aria-label': `별 ${n}개` }, Array.from({ length: of }, (_, i) => el('i', { class: i < n ? 'on' : '' })));
// a case's (rack's) picture: k the game, res its results, mat the case's material, now whether the next place is ringed
const pzHolder = (k, res, mat, now) => k === 'pocket' ? pzRackSvg(res, now, false, mat) : pzCase(res, mat, now);
// the place a puzzle fills, in words: a ball's quarter, or a ball of the rack
const pzPlace = (k, j) => k === 'pocket' ? `${j + 1}번 공` : `${PZ_BALL_KO[j >> 2]} ${(j & 3) + 1}/4`;
function deskPuzzle(d) {
  d.stage.dataset.win = '0'; pzLiveLoad();
  $('#desk').classList.add('boards');
  if (menuOn()) { $('#desk').classList.add('felt'); if (!$('#dkFelt')) $('#desk').appendChild(el('div', { class: 'dk-felt', id: 'dkFelt', 'aria-hidden': 'true' })); }
  const wrap = el('div', { id: 'dkBoards', class: 'pzr' }), fit = el('div', { class: 'bd-fit' }), back = trainBack();
  const x = fn => el('button', { class: 'dk-x', 'aria-label': '뒤로', onclick: () => { SND.tap(); fn(); } }, el('i'));
  const repaint = () => repaintLive();
  if (pzDone) {
    const c = pzDone, k = c.k || 'four', size = pzSize(k), got = pzr.starsIn(c.res), holder = k === 'pocket' ? '랙' : '케이스';
    wrap.classList.add('done');
    wrap.appendChild(el('div', { class: 'bd-head' }, [x(() => { pzDone = null; repaint(); }), dkTitle('퍼즐', `${holder} 완성`)]));
    const gold = c.res.filter(r => pzStars(r[1]) === 3).length;
    fit.appendChild(el('div', { class: 'pzr-res' + (k === 'pocket' ? ' rack' : '') }, [
      el('div', { class: 'hd', text: `${holder} 완성 · 스테이지 ${c.st0 || '?'}–${c.st1 || '?'}` }),
      el('div', { class: 'big' }, [el('i', { class: 'star' }), document.createTextNode(String(got)), el('s', { text: `/ ${size * 3}` })]),
      pzSvg(pzHolder(k, c.res, c.m, false), k === 'pocket' ? 'pzr-rk' : 'pzr-cs'),
      el('small', { text: `한 번에 푼 것 ${gold}개 · 기록에 남았습니다. 기록에서 언제든 다시 풀 수 있어요.` }),
      el('div', { class: 'btns' }, [el('button', { class: 'pzr-b2', text: '기록 보기', onclick: onTap(() => { pzDone = null; pzView = k; pzBook = 0; repaint(); }) }),
        el('button', { class: 'pzr-go', text: `다음 ${holder}`, onclick: onTap(() => { pzDone = null; puzzle.start(null, { game: k }); }) })])]));
    wrap.appendChild(fit); $('#desk').appendChild(wrap); return;
  }
  const k = pzView, s = pzr.of(k), size = pzSize(k), holder = k === 'pocket' ? '랙' : '케이스';
  if (pzBook != null && s.cases.length) {
    const i = Math.min(pzBook, s.cases.length - 1), c = s.cases[i];
    wrap.classList.add('book');
    wrap.appendChild(el('div', { class: 'bd-head' }, [x(() => { pzBook = null; repaint(); }), dkTitle(`기록 · ${k === 'pocket' ? '포켓' : '4구'}`, `닫힌 ${holder} ${s.cases.length}개`)]));
    const list = el('div', { class: 'pzr-list' }, s.cases.map((q, j) => el('button', { class: 'ln' + (j === i ? ' on' : ''), onclick: onTap(() => { pzBook = j; repaint(); }) }, [
      el('span', { class: 'dt', text: q.st0 ? `${q.st0}–${q.st1}` : pzDate(q.t) }), pzSvg(k === 'pocket' ? pzRackMini(q.res, false) : pzMini(q.res, false), 'mi'), el('b', { class: 'stn' }, [el('i', { class: 'star' }), document.createTextNode(String(pzr.starsIn(q.res)))])])));
    const grid = el('div', { class: 'pzr-16' + (k === 'pocket' ? ' p15' : '') }, c.res.map(([id, r], j) => {
      const q = puzzles.byId(id), n = pzStars(r), lab = c.st0 ? `스테이지 ${c.st0 + j}` : pzPlace(k, j);
      return el('button', { class: 'pz1 s' + n, disabled: q ? null : '', 'aria-label': `${lab}, 별 ${n}개, 다시 풀기`, onclick: onTap(() => q && puzzle.start(q.id, { free: 'book' })) }, [
        pzSvg(pzOne(j, n, k), 'q1'), el('b', { text: lab }), pzStarRow(n)]);
    }));
    fit.append(list, el('div', { class: 'pzr-pk' }, [el('h4', { text: `${pzDate(c.t)} · ${PZ_MATS[c.m].n} ${holder}` }), grid, el('small', { text: '눌러서 다시 풀기 · 기록은 바뀌지 않아요' })]));
    wrap.appendChild(fit); $('#desk').appendChild(wrap); return;
  }
  // 캐롬 · 포켓; how hard (the player's own choice); 오늘의 퍼즐 (owner 11-22: one a day, the same for everyone)
  const seg = el('div', { class: 'pzr-seg', role: 'tablist' }, [['four', '캐롬', 'carom', 2], ['pocket', '포켓', 'pool', 8]].map(([kk, t, kind, n]) =>
    el('button', { role: 'tab', 'aria-selected': String(pzView === kk), class: pzView === kk ? 'on' : '', onclick: onTap(() => { if (pzView !== kk) { pzView = kk; repaint(); } }) }, [ballPic(prefs.ballSkin, kind, n, { class: 'bp' }), el('span', { text: t })])));
  const diff = el('div', { class: 'pzr-diff', role: 'radiogroup', 'aria-label': '난이도' }, Object.entries(PZ_DIFF).map(([kk, v]) =>
    el('button', { role: 'radio', 'aria-checked': String(prefs.pzr.diff === kk), class: prefs.pzr.diff === kk ? 'on' : '', onclick: onTap(() => { if (prefs.pzr.diff !== kk) { prefs.pzr.diff = kk; for (const g of ['four', 'pocket']) pzr.of(g).cur = null; savePrefs(); repaint(); } }) }, el('span', { text: v.n }))));
  const day = pzDaily(), dayDone = prefs.pz.day === attend.today();
  const tools = el('span', { class: 'bd-tools' }, [seg, pzLook === 'card' ? null : diff, day && k === 'four' && pzLook !== 'card' ? el('button', { class: 'pz-day' + (dayDone ? ' done' : ''), onclick: onTap(() => puzzle.start(day.id, { free: 'day' })) }, [el('i'), document.createTextNode(dayDone ? '오늘의 퍼즐 완료' : '오늘의 퍼즐')]) : null]);
  wrap.appendChild(el('div', { class: 'bd-head' }, [back ? x(back) : null, dkTitle('퍼즐', '세 번 안에 풀면 별'), tools]));
  if (k === 'pocket') wrap.classList.add('pocket');
  if (!pzPool(k).length) {
    fit.append(el('div', { class: 'pzr-me' }, [el('small', { text: '스테이지' }), el('b', { class: 'num', text: '1' })]),
      el('div', { class: 'pzr-mid' }, [pzSvg(pzHolder(k, [], 0, false), k === 'pocket' ? 'pzr-rk' : 'pzr-cs')]),
      el('div', { class: 'pzr-go-p soon' }, [el('h3', { text: k === 'pocket' ? '포켓 퍼즐' : '4구 퍼즐' }), el('p', { text: '새 퍼즐을 만드는 중입니다.' }), el('button', { class: 'pzr-go', disabled: '', text: '준비 중' })]));
    wrap.appendChild(fit); $('#desk').appendChild(wrap); return;
  }
  pzr.next(k);
  if (pzLook !== 'case') { const f = { map: pzDeskMap, shelf: pzDeskShelf, card: pzDeskCard }[pzLook]; if (f) { f(fit, k, s); wrap.classList.add('lk-' + pzLook); wrap.appendChild(fit); $('#desk').appendChild(wrap); return; } }
  const n = s.now.length, mat = s.now.length ? (s.mat || 0) : pzMatOf(s.stars), hard = pzr.hard(k), up = PZ_MATS[pzMatOf(s.stars) + 1];
  const past = s.cases.slice(0, 3), inCase = pzr.starsIn(s.now);
  // the stage, the stars, the way to the next material; the cases closed (tapped: the record)
  fit.append(el('div', { class: 'pzr-me' }, [el('small', { text: '스테이지' }), el('b', { class: 'num', text: String(s.stage + 1) }),
    el('span', { class: 'tot' }, [el('i', { class: 'star' }), el('b', { text: String(s.stars) }), el('span', { text: '모은 별' })]),
    up ? el('div', { class: 'mat' }, [el('span', { text: `${up.n} ${holder}까지 별 ${up.at - s.stars}개` }), el('i', {}, el('b', { style: `width:${Math.round(100 * (s.stars - PZ_MATS[pzMatOf(s.stars)].at) / (up.at - PZ_MATS[pzMatOf(s.stars)].at))}%` }))]) : el('div', { class: 'mat' }, el('span', { text: '금 ' + holder })),
    past.length ? el('div', { class: 'pzr-past' }, [el('small', { text: `지난 ${holder}` }), ...past.map((c, j) => el('button', { class: 'ln', onclick: onTap(() => { pzBook = j; repaint(); }) }, [pzSvg(k === 'pocket' ? pzRackMini(c.res, false) : pzMini(c.res, false), 'mi'), el('em', {}, [el('i', { class: 'star' }), document.createTextNode(String(pzr.starsIn(c.res)))])])),
      el('button', { class: 'all', text: '기록 전체', onclick: onTap(() => { pzBook = 0; repaint(); }) })]) : null]),
    el('div', { class: 'pzr-mid' }, [pzSvg(pzHolder(k, s.now, mat, true), k === 'pocket' ? 'pzr-rk' : 'pzr-cs'), el('div', { class: 'cap' }, [el('b', {}, [document.createTextNode(`이번 ${holder} ${n} / ${size}`), el('span', { class: 'cst' }, [el('i', { class: 'star' }), document.createTextNode(`${inCase} / ${n * 3}`)])]),
      el('small', { text: k === 'pocket' ? `${PZ_MATS[mat].n} 랙 · 한 문제에 공 하나 · 1번부터 15번까지` : `${PZ_MATS[mat].n} 케이스 · 한 문제에 공 4분의 1 · 흰 공 → 노란 공 → 빨간 공 → 빨간 공` })])]),
    el('div', { class: 'pzr-go-p' + (hard ? ' hard' : '') }, [el('h3', {}, [document.createTextNode(`스테이지 ${s.stage + 1}`), hard ? el('em', { class: 'hb', text: '어려운 스테이지' }) : null, el('small', { text: `${pzPlace(k, n)} · 시작하기 전엔 보이지 않습니다.` })]),
      el('div', { class: 'mys', 'aria-hidden': 'true' }, [el('i'), el('span', { text: '?' })]),
      el('div', { class: 'rows' }, [['한 번에', 3], ['두 번째에', 2], ['세 번째에', 1]].map(([t, m]) => el('div', { class: 'row' }, [el('span', { text: t }), pzStarRow(m)]))),
      el('button', { class: 'pzr-go', onclick: onTap(() => puzzle.start(null, { game: k })) }, [fbIco('play'), el('span', { text: '풀기' })])]));
  wrap.appendChild(fit); $('#desk').appendChild(wrap);
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
