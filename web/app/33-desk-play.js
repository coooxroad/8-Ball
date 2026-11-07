/* 플레이: see deskPlay below. */
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
/* 플레이 (5.0): laid out as every other place is - the rail's keys (랭킹전, 친구와 플레이, 챌린지, 아케이드), the felt tray
   (the live table of the game picked, or what the place is about) and the slate (what it needs and its one button). The
   game is picked on the slate. (Until 5.0: four picture panels over the whole desk - 상점, 투어, 친구와 플레이, 랭킹전.) */
const PLAY_SEL = ['rank', 'friend', 'challenge', 'arcade'];
function deskPlay(d) {
  const sel = PLAY_SEL.includes(prefs.playSel) ? prefs.playSel : 'rank';
  const to = id => () => { if (sel === id) return; prefs.playSel = id; repaintLive(); };
  dkPut(d.rail, [railBtn(sel === 'rank', '랭킹전', null, to('rank')), railBtn(sel === 'friend', '친구와 플레이', null, to('friend')),
    railBtn(sel === 'challenge', '챌린지', null, to('challenge'), true), railBtn(sel === 'arcade', '아케이드', null, to('arcade'), true)]);
  if (sel === 'friend') return deskMatch(d, false);
  if (sel === 'rank') return deskRank(d);
  deskSoon(d, sel);
}
// 랭킹전: the player's tier and 다마 on the slate, the game to play, and looking for someone
function deskRank({ head, slate }) {
  const m = GAME4.includes(prefs.mode) ? prefs.mode : 'eight', dama = net.me ? net.me.dama : ECONOMY.DAMA_START;
  const tier = TIERS[Math.min(TIERS.length - 1, prefs.tier || 0)], f = ranked.finding;
  dkPut(head, dkTitle('랭킹전', '다마가 비슷한 상대와 온라인 대결'));
  dkPut(slate, [el('div', { class: 'dk-rank' }, [el('img', { src: `ui/tier-${tier[0]}.webp`, alt: '' }), el('span', null, [el('b', { text: tier[1] }), el('small', { text: `${dama} 다마` })])]), dkHr(),
    dkLab('종목'), dkSeg(GAME4.map(id => [id, MODE_KO[id]]), m, v => { if (prefs.mode === v) return; prefs.mode = v; repaintLive(); }), dkHr(), guideRow()]);
  dkPut(slate, dkActs(f ? dkMain('상대 찾는 중', `${MODE_KO[f.mode]} · 위쪽 띠에서 그만둘 수 있습니다`, () => {}, true)
    : net.on ? dkMain('상대 찾기', `${MODE_KO[m]} · ${dama} 다마`, () => { ranked.find(m); paintHome(); }) : dkMain('상대 찾기', '서버가 열리면', () => {}, true)));
}
// 챌린지 and 아케이드: what they will be, until they are
function deskSoon({ head, stage, slate }, sel) {
  const [t, sub, what, more] = sel === 'challenge'
    ? ['챌린지', '실제 경기 장면 재현', '실제 경기의 한 장면을 그대로 옮겨, 그 선수가 친 샷을 다시 쳐 봅니다.', '성공하면 다이아']
    : ['아케이드', '특별한 규칙', '빙판 테이블, 오각형 테이블처럼 평소와 다른 규칙으로 칩니다.', '빙판 · 오각형 테이블'];
  stage.dataset.win = '0';
  dkPut(head, dkTitle(t, sub));
  dkPut(stage, el('div', { class: 'msg' }, [el('b', { text: '준비 중' }), el('span', { text: what })]));
  dkPut(slate, dkH1(t, sub));
  dkPut(slate, [dkHr(), dkTxt(what), dkHr(), dkTxt(more)]);
  dkPut(slate, dkActs(dkMain('준비 중', null, () => {}, true)));
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
// a match to set up: against a friend (플레이) or the computer (훈련 · 컴퓨터 대전), the game picked on the slate; back, if given, puts an X on the tray's head
function deskMatch({ rail, head, foot, slate }, cpu, back) {
  const m = GAME4.includes(prefs.mode) ? prefs.mode : 'eight', mm = game.MODES[m], inv = !cpu && prefs.friendWay === 'invite' && net.on;
  const pick = id => () => { if (prefs.mode === id) return; prefs.mode = id; if (cpu) prefs.cpuMode = id; repaintLive(); };
  if (back) { head.className = 'dk-head open'; dkPut(head, el('button', { class: 'dk-x', 'aria-label': '종목 카드로', onclick: () => { SND.tap(); back(); } }, el('i'))); }
  dkPut(head, dkTitle(cpu ? '컴퓨터 대전' : '친구와 플레이', mm.blurb));
  const plate = i => {
    const nm = i ? oppName() : prefs.names[0], sub = m === 'four' ? `수지 ${sujiOf(i) * 10}` : i && prefs.vsAI ? LEVELS[prefs.level] : recText(nm);
    return el('button', { class: 'dk-plate' + (i ? ' two' : ''), onclick: onTap(() => sheetName(i)) }, [el('i', { class: 'av', text: String(i + 1) }), el('span', null, [el('b', { text: nm }), el('small', { text: sub })])]);
  };
  if (!inv) dkPut(foot, [plate(0), el('span', { class: 'dk-vs', text: 'VS' }), plate(1)]);

  dkPut(slate, dkH1(MODE_KO[m], GAME_SUB[m]));
  dkPut(slate, [dkHr(), dkLab('종목'), dkSeg(GAME4.map(id => [id, MODE_KO[id]]), m, v => pick(v)())]);
  // (with a friend: here on one device, taking turns - or invited to play from theirs, by a code: 55-invite.js)
  if (!cpu) dkPut(slate, [dkHr(), dkSeg([['local', '한 기기에서'], ['invite', '초대하기', !net.on]], inv ? 'invite' : 'local', v => { prefs.friendWay = v; if (v === 'local') invite.leave(); repaint(); })]);
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
