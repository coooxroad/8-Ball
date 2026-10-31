/* 플레이: four panels side by side on the desk, over the same ground as the rail, tray and slate, so the desk's lean makes
   them one trapezoid as it does those: a narrow shop window, 투어 over 친구와 플레이, and 랭킹전 with the player's tier.
   The online ones (투어, 랭킹전) are arcade panels - clean colour, a field of dots fading from the light; 친구와 플레이 is
   billiard cloth. 친구와 플레이 opens the four games as four panels (4구 and 8볼 above, 3구 and 9볼 below), each its cloth
   with its balls on it (the balls as the table draws them); a game opens the match to set up, with an X back. */
let playStep = 'boards';                                              // 'boards' | 'games' | 'setup'
const TIERS = [['bronze', '브론즈'], ['silver', '실버'], ['gold', '골드'], ['platinum', '플래티넘'], ['diamond', '다이아몬드'], ['master', '마스터'], ['legend', '레전드']];
// a game's balls, as the table draws them, in its usual layout ([n, x, y] in ball widths)
const RACK = {
  four: ['carom', [[0, 0, .55], [1, 1.25, -.2], [2, 2.3, .3], [3, 1.35, 1.1]]],
  three: ['carom', [[0, 0, .4], [1, 1.15, -.15], [2, 2.15, .35]]],
  eight: ['pool', [[1], [11, 5], [2, 8, 10], [9, 7, 14, 4], [6, 15, 13, 3, 12]]],
  nine: ['pool', [[1], [2, 3], [4, 9, 5], [6, 7], [8]]] };
function rackOf(id) {
  const [kind, L] = RACK[id], at = kind === 'carom' ? L : L.flatMap((row, r) => row.map((n, i) => [n, (i - (row.length - 1) / 2) * 1.02, r * .885]));
  const xs = at.map(b => b[1]), ys = at.map(b => b[2]), mx = Math.min(...xs), my = Math.min(...ys);
  const box = el('span', { class: 'rack ' + kind, style: `--cw:${Math.max(...xs) - mx + 1};--ch:${Math.max(...ys) - my + 1}` });
  for (const [n, x, y] of at) box.appendChild(el('img', { src: scene.ballPortrait(prefs.ballSkin, kind, n), alt: '', style: `left:calc(${(x - mx).toFixed(3)} * var(--d));top:calc(${(y - my).toFixed(3)} * var(--d))` }));
  return box;
}
function deskPlay(d) {
  if (playStep === 'setup') return deskMatch(d, false, () => { playStep = 'games'; paintHome(); });
  d.stage.dataset.win = '0';
  $('#desk').classList.add('boards');
  const fit = el('div', { class: 'bd-fit' }), wrap = el('div', { id: 'dkBoards', class: playStep });
  const panel = (id, label, fn, kids, cls) => el('button', { class: 'bd bd-' + id + (cls ? ' ' + cls : ''), 'data-b': id, 'aria-label': label, onclick: onTap(fn) }, [el('i', { class: 'sk' }), el('span', { class: 'in' }, kids)]);
  const tt = (t, sub, tag) => el('span', { class: 'bd-tt' }, [tag ? el('em', { text: tag }) : null, el('b', { text: t }), sub ? el('small', { text: sub }) : null]);
  if (playStep === 'games') {
    dkPut(wrap, el('div', { class: 'bd-head' }, [el('button', { class: 'dk-x', 'aria-label': '플레이로', onclick: () => { SND.tap(); playStep = 'boards'; paintHome(); } }, el('i')), dkTitle('친구와 플레이', '종목을 고르세요')]));
    dkPut(fit, ['four', 'eight', 'three', 'nine'].map(id => panel(id, MODE_KO[id], () => { prefs.mode = id; playStep = 'setup'; repaintLive(); }, [rackOf(id), tt(MODE_KO[id], GAME_SUB[id])], 'game')));
  } else {
    const later = what => () => toast(`${what} 서버가 열리면 시작합니다.`, '', 2200);
    const best = CUES.reduce((a, c) => (c.rarity || 0) > (a.rarity || 0) ? c : a, CUES[0]), r = best.rarity || 0, tier = TIERS[Math.min(TIERS.length - 1, prefs.tier || 0)];
    dkPut(fit, [
      panel('shop', '상점', () => deskGo('shop'), [tt('상점', '오늘의 진열', 'SHOP'), el('span', { class: 'bd-show' }, cueImg(best)), el('span', { class: 'bd-foot' }, [el('b', { text: best.name }), el('small', { class: 'rar r' + r, text: RARITY[r][0] })])]),
      panel('tour', '투어', later('투어는'), [tt('투어', '판돈을 걸고 겨루는 대회', 'ONLINE'), el('span', { class: 'bd-tag', text: '준비 중' })], 'online'),
      panel('friend', '친구와 플레이', () => { playStep = 'games'; paintHome(); }, [tt('친구와 플레이', '한 기기로 번갈아 칩니다'),
        el('span', { class: 'bd-modes' }, GAME4.map(id => el('i', { style: `background-image:url(ui/mode-${id}.webp)` })))]),
      panel('rank', '랭킹전', later('랭킹전은'), [tt('랭킹전', '시즌 준비 중', 'ONLINE'), el('img', { class: 'bd-tier', src: `ui/tier-${tier[0]}.webp`, alt: tier[1] }), el('span', { class: 'bd-foot' }, el('b', { text: tier[1] }))], 'online')]);
  }
  wrap.appendChild(fit); $('#desk').appendChild(wrap);
}
// a match to set up: against a friend (플레이, the game picked on its card or on the rail) or the computer (훈련 · 컴퓨터
// 대전, picked on the slate); back, if given, puts an X on the tray's head
function deskMatch({ rail, head, foot, slate }, cpu, back) {
  const m = GAME4.includes(prefs.mode) ? prefs.mode : 'eight', mm = game.MODES[m];
  const pick = id => () => { if (prefs.mode === id) return; prefs.mode = id; if (cpu) prefs.cpuMode = id; repaintLive(); };
  if (!cpu) dkPut(rail, GAME4.map(id => railBtn(m === id, MODE_KO[id], null, pick(id), false, 'mode-' + id)));   // each with the balls it is played with
  if (back) { head.className = 'dk-head open'; dkPut(head, el('button', { class: 'dk-x', 'aria-label': '종목 카드로', onclick: () => { SND.tap(); back(); } }, el('i'))); }
  dkPut(head, dkTitle(cpu ? '컴퓨터 대전' : '친구와 플레이', mm.blurb));
  const plate = i => {
    const nm = i ? oppName() : prefs.names[0], sub = m === 'four' ? `수지 ${sujiOf(i) * 10}` : i && prefs.vsAI ? LEVELS[prefs.level] : recText(nm);
    return el('button', { class: 'dk-plate' + (i ? ' two' : ''), onclick: onTap(() => sheetName(i)) }, [el('i', { class: 'av', text: String(i + 1) }), el('span', null, [el('b', { text: nm }), el('small', { text: sub })])]);
  };
  dkPut(foot, [plate(0), el('span', { class: 'dk-vs', text: 'VS' }), plate(1)]);

  dkPut(slate, dkH1(MODE_KO[m], GAME_SUB[m]));
  if (cpu) dkPut(slate, [dkHr(), dkLab('종목'), dkSeg(GAME4.map(id => [id, MODE_KO[id]]), m, v => pick(v)())]);
  else dkPut(slate, [dkHr(), dkLab('상대'), dkSeg([['net', '온라인', true], ['friend', '친구']], 'friend', () => {})]);
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
