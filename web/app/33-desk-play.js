/* 플레이: four panels side by side on the desk, over the same ground as the rail, tray and slate, so the desk's lean makes
   them one trapezoid as it does those: 랭킹전 with the player's tier, 아케이드 and 챌린지 over 친구와 플레이 - blocks of
   the shop's ivory and charcoal, and a pale sky for 아케이드 (owner, 5.0). 친구와 플레이 opens the four games as four panels (4구 and 8볼 above, 3구 and 9볼 below), each its cloth
   with its balls on it (the balls as the table draws them); a game opens the match to set up, with an X back. */
let playStep = 'boards';                                              // 'boards' | 'games' | 'setup'
let rankBarShown = null;                                              // the rating the 랭킹전 card's bar last filled to
let playFor = 'friend';                                               // whose the four game panels are: 'friend' | 'rank' (54-ranked.js)
const TIERS = [['bronze', '브론즈'], ['silver', '실버'], ['gold', '골드'], ['platinum', '플래티넘'], ['diamond', '다이아몬드'], ['pro', '프로']];   // (owner, 11-08: 마스터 and 레전드 are one, 프로; economy.js TIER_AT)
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
  for (const [n, x, y] of at) box.appendChild(ballPic(prefs.ballSkin, kind, n, { style: `left:calc(${(x - mx).toFixed(3)} * var(--d));top:calc(${(y - my).toFixed(3)} * var(--d))` }));
  return box;
}
// the cue named on the shop's board: one of the shop's cues at random, kept a minute (the desk paints again often: a wallet
// update, a tap) so it does not change under the eye. A stand-in for what the board will show later.
let shopShown = null;
function shopPick() {
  if (shopShown && Date.now() - shopShown.t < 60000 && CUES.includes(shopShown.c)) return shopShown.c;
  const pool = CUES.filter(c => !c.reward), c = pool[Math.floor(Math.random() * pool.length)] || CUES[0];
  shopShown = { c, t: Date.now() }; return c;
}
function deskPlay(d) {
  if (playStep === 'setup') return deskMatch(d, false, () => { playStep = 'boards'; paintHome(); });   // (친구와 플레이 opens straight to its setup, the game on the rail - owner, 11-08)
  d.stage.dataset.win = '0';
  $('#desk').classList.add('boards');
  const fit = el('div', { class: 'bd-fit' }), wrap = el('div', { id: 'dkBoards', class: playStep });
  const panel = (id, label, fn, kids, cls) => el('button', { class: 'bd bd-' + id + (cls ? ' ' + cls : ''), 'data-b': id, 'aria-label': label, onclick: onTap(fn) }, [el('i', { class: 'sk' }), el('span', { class: 'in' }, kids)]);
  const tt = (t, sub, tag) => el('span', { class: 'bd-tt' }, [tag ? el('em', { text: tag }) : null, el('b', { text: t }), sub ? el('small', { text: sub }) : null]);
  if (playStep === 'games') {
    const rank = playFor === 'rank';
    dkPut(wrap, el('div', { class: 'bd-head' }, [el('button', { class: 'dk-x', 'aria-label': '플레이로', onclick: () => { SND.tap(); playStep = 'boards'; paintHome(); } }, el('i')),
      dkTitle(rank ? '랭킹전' : '친구와 플레이', rank ? `종목을 고르면 레이팅이 비슷한 상대를 찾습니다 · 레이팅 ${net.me ? net.me.dama : ECONOMY.DAMA_START}` : '종목을 고르세요')]));
    const go = id => rank ? () => { playStep = 'boards'; paintHome(); ranked.find(id); } : () => { prefs.mode = id; playStep = 'setup'; repaintLive(); };
    dkPut(fit, ['four', 'eight', 'three', 'nine'].map(id => panel(id, MODE_KO[id], go(id), [rackOf(id), tt(MODE_KO[id], GAME_SUB[id])], 'game')));
  } else {
    // (5.0: plain blocks of the shop's two colours - ivory and charcoal - with only words on them for now; pictures come
    // back one by one, drawn to match. 투어 and the shop's window are gone: 챌린지 and 아케이드 in their places.)
    const soon = what => () => toast(`${what} 준비 중입니다.`, '', 2200), dama = net.me ? net.me.dama : ECONOMY.DAMA_START;
    const T = ECONOMY.TIER_AT, ti = Math.max(0, T.filter(x => dama >= x).length - 1), tier = TIERS[Math.min(TIERS.length - 1, ti)];
    // the way to the next tier, filling like a level bar: it fills from empty when the number has changed since it was
    // last shown, and sits still otherwise (the desk paints again often)
    const lo = T[ti], hi = T[ti + 1], part = hi == null ? 1 : Math.max(0, Math.min(1, (dama - lo) / (hi - lo))), grow = rankBarShown !== dama; rankBarShown = dama;
    const bar = el('span', { class: 'bd-bar' + (grow ? ' grow' : ''), style: `--p:${part.toFixed(3)}` }, [el('i'), el('small', { text: hi == null ? '최고 티어' : `${TIERS[ti + 1][1]}까지 ${hi - dama}` })]);
    dkPut(fit, [
      panel('friend', '친구와 플레이', () => { playFor = 'friend'; playStep = 'setup'; if (net.on) prefs.friendWay = 'invite'; repaintLive(); }, [tt('친구와 플레이', '한 기기에서 · 코드로 초대'),
        el('span', { class: 'bd-foot' }, el('small', { text: '3구 · 4구 · 8볼 · 9볼' }))], 'card'),
      panel('challenge', '챌린지', soon('챌린지는'), [tt('챌린지', '실제 경기 장면 재현', '준비 중')], 'card soon'),
      panel('arcade', '아케이드', soon('아케이드는'), [tt('아케이드', '빙판 · 오각형 테이블', '준비 중')], 'card soon'),
      panel('rank', '랭킹전', () => ranked.pick(), [tt('랭킹전', '레이팅이 비슷한 상대와', 'ONLINE'),
        el('span', { class: 'bd-foot' }, [el('b', { text: tier[1] }), el('small', { text: `레이팅 ${dama}` }), bar])], 'card')]);
  }
  wrap.appendChild(fit); $('#desk').appendChild(wrap);
}
// inviting a friend: the code open on the server while this shows; the tray shows the two places and the code
function deskInvite(slate, _, m) {
  const h = invite.want(m); invite.shown = true;
  invite.tray($('#dkStage'), m);
  if (m === 'three') { const T = [3, 5, 10];
    dkPut(slate, [dkLab('목표 점수'), dkStep(T, T.includes(prefs.target) ? prefs.target : 5, String, v => { prefs.target = v; repaint(); }),
      dkSeg([[0, '쿠션 자유'], [1, '원쿠션'], [3, '쓰리쿠션']], prefs.rule3, v => { prefs.rule3 = v; repaint(); })]); }
  if (m === 'four') { const T = [5, 10, 15, 20, 30]; dkPut(slate, [dkLab('목표 점수'), dkStep(T, T.includes(prefs.fourTarget) ? prefs.fourTarget : 10, String, v => { prefs.fourTarget = v; repaint(); })]); }
  dkPut(slate, [dkHr(), dkTxt(h ? '친구가 코드를 넣거나 링크를 열면 바로 시작합니다.' : invite.err && !invite.opening ? `초대 코드를 만들 수 없습니다 (${invite.err}).` : '초대 코드를 만드는 중…'), dkRow('친구 코드가 있으면', '코드로 참가', invite.sheetJoin)]);
  dkPut(slate, dkActs(!h && invite.err ? dkMain('다시 시도', '초대 코드 만들기', () => { invite.err = null; repaint(); }) : dkMain('초대 링크 보내기', h ? h.code : '잠시만요', () => h && invite.share(h.code), !h),
    dkSec('방 나가기', () => { invite.leave(); prefs.friendWay = 'local'; repaint(); })));
}
// a match to set up: against a friend (플레이, the game picked on its card or on the rail) or the computer (훈련 · 컴퓨터
// 대전, picked on the slate); back, if given, puts an X on the tray's head
function deskMatch({ rail, head, foot, slate }, cpu, back) {
  const m = GAME4.includes(prefs.mode) ? prefs.mode : 'eight', mm = game.MODES[m], inv = !cpu && prefs.friendWay === 'invite' && net.on;
  const pick = id => () => { if (prefs.mode === id) return; prefs.mode = id; if (cpu) prefs.cpuMode = id; repaintLive(); };
  if (!cpu) dkPut(rail, GAME4.map(id => railBtn(m === id, MODE_KO[id], null, pick(id), false, 'mode-' + id)));   // each with the balls it is played with
  if (back) { head.className = 'dk-head open'; dkPut(head, el('button', { class: 'dk-x', 'aria-label': '종목 카드로', onclick: () => { SND.tap(); back(); } }, el('i'))); }
  dkPut(head, dkTitle(cpu ? '컴퓨터 대전' : '친구와 플레이', mm.blurb));
  const plate = i => {
    const nm = i ? oppName() : prefs.names[0], sub = m === 'four' ? `수지 ${sujiOf(i) * 10}` : i && prefs.vsAI ? LEVELS[prefs.level] : recText(nm);
    return el('button', { class: 'dk-plate' + (i ? ' two' : ''), onclick: onTap(() => sheetName(i)) }, [el('i', { class: 'av', text: String(i + 1) }), el('span', null, [el('b', { text: nm }), el('small', { text: sub })])]);
  };
  if (!inv) dkPut(foot, [plate(0), el('span', { class: 'dk-vs', text: 'VS' }), plate(1)]);

  dkPut(slate, dkH1(MODE_KO[m], GAME_SUB[m]));
  if (cpu) dkPut(slate, [dkHr(), dkLab('종목'), dkSeg(GAME4.map(id => [id, MODE_KO[id]]), m, v => pick(v)())]);
  // (with a friend: here on one device, taking turns - or invited to play from theirs, by a code: 55-invite.js)
  else dkPut(slate, [dkHr(), dkSeg([['local', '한 기기에서'], ['invite', '초대하기', !net.on]], inv ? 'invite' : 'local', v => { prefs.friendWay = v; if (v === 'local') invite.leave(); repaint(); })]);
  if (inv) return deskInvite(slate, d => d, m);
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
