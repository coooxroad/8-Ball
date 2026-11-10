/* 플레이: four panels side by side on the desk, over the same ground as the rail, tray and slate, so the desk's lean makes
   them one trapezoid as it does those: 랭킹전 with the player's tier, 아케이드 and 챌린지 over 친구와 플레이 - blocks of
   the shop's ivory and charcoal, and a pale sky for 아케이드 (owner, 5.0). 친구와 플레이 opens the four games as four panels (4구 and 8볼 above, 3구 and 9볼 below), each its cloth
   with its balls on it (the balls as the table draws them); a game opens the match to set up, with an X back. */
let playStep = 'boards';                                              // 'boards' | 'rank' | 'friend' | 'halls' | 'setup' | 'addons'
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
/* Opening a card (owner, 11-08): the card tapped comes forward to the middle of the desk and its choices fan out of it -
   랭킹전 its four games, 친구와 플레이 its three ways (한 기기에서, 방 생성하기, 방 참가하기). A game picked for 랭킹전:
   the others fly off, it comes to the middle and turns over - on its back, the search for an opponent. 방 참가하기 turns
   the desk into a hall's floor, the open rooms standing on it as tables.
   playFx: the entrance the step just opened is to make, once (the desk paints again often - a wallet, a tap - and must not
   play it again); playBusy: a card on its way out, taps wait. */
let playFx = null, playBusy = false;
// a board's middle in the desk's own flat coordinates (the leaning plane makes screen coordinates the wrong measure)
function flatMid(n, root) { let x = n.offsetWidth / 2, y = n.offsetHeight / 2; for (let q = n; q && q !== root; q = q.offsetParent) { x += q.offsetLeft; y += q.offsetTop; } return [x, y]; }
function playLeave(card, then) {
  if (playBusy) return; playBusy = true;
  const wrap = $('#dkBoards'), fit = wrap && wrap.querySelector('.bd-fit');
  if (fit && card) {
    const [x, y] = flatMid(card, fit), [cx, cy] = [fit.offsetWidth / 2, fit.offsetHeight / 2];
    card.style.setProperty('--gx', (cx - x).toFixed(1) + 'px'); card.style.setProperty('--gy', (cy - y).toFixed(1) + 'px'); card.classList.add('go');
    let k = 0; for (const b of fit.querySelectorAll('.bd')) if (b !== card) { b.style.setProperty('--d', (k++ * 45) + 'ms'); b.style.setProperty('--ax', ((Math.random() < 0.5 ? -1 : 1) * (40 + Math.random() * 30)).toFixed(0) + 'px'); b.classList.add('away'); }
    if (wrap.querySelector('.bd-head')) wrap.querySelector('.bd-head').classList.add('away');
  }
  setTimeout(() => { playBusy = false; then(); }, fit ? 330 : 0);
}
// the entrance: each card from the middle (where the card it came out of stood), turned a little, out to its place
function playEnter(wrap) {
  const fx = playFx; playFx = null; if (!fx) return;
  // (worked out at once, the wrap just laid out: no frame drawn with the cards in their places first)
  const fit = wrap.querySelector('.bd-fit'), cards = [...wrap.querySelectorAll('.unf')], [cx, cy] = [fit.offsetWidth / 2, fit.offsetHeight / 2];
  cards.forEach((b, i) => {
    const [x, y] = flatMid(b, fit);
    b.style.setProperty('--dx', (cx - x).toFixed(1) + 'px'); b.style.setProperty('--dy', (cy - y).toFixed(1) + 'px');
    b.style.setProperty('--r', ((i - (cards.length - 1) / 2) * 6).toFixed(1) + 'deg'); b.style.setProperty('--d', (i * 55) + 'ms');
    b.classList.add(fx);
  });
}
const WAY_ICO = {
  local: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="5" width="30" height="38" rx="5"/><path d="M20 37h8"/><circle cx="19" cy="20" r="4"/><circle cx="29" cy="20" r="4"/></svg>',
  make: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="12" width="38" height="24" rx="4"/><path d="M24 18v12M18 24h12"/></svg>',
  join: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="12" width="38" height="24" rx="4"/><path d="M17 24h14M25 18l6 6-6 6"/></svg>' };
/* Add-ons for a game with a friend (owner 11-10): each a long card on its own, on or off, with its parts below it.
   The first: 현실 당구 - throw, squirt, and the cue only at angles it could take (physics.js). Kept in prefs.addons;
   a room carries them in its rules (55-invite.js rulesOf), a game on one device in its own (50-match.js). */
const ADDONS = [{ id: 'real', name: '현실 당구', parts: [['throw', '스로우'], ['squirt', '스쿼트'], ['cue', '가능한 큐 각도만']],
  ico: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="17" cy="27" r="9"/><circle cx="33" cy="17" r="7"/><path d="M4 41l9-9M24 22l3-2"/></svg>' }];
const addonPrefs = () => (prefs.addons = Object.assign({ real: false, throw: true, squirt: true, cue: true }, prefs.addons));
/* The add-ons are changed on a copy and kept with 저장 (the X leaves them as they were): with changes taking hold at once
   and only an X, it was not clear whether they had been kept (owner 11-10). */
let addonDraft = null;
const addonEdit = () => addonDraft || (addonDraft = Object.assign({}, addonPrefs()));
function addonPanel(A, i) {
  const P = addonEdit(), on = !!P[A.id];
  const flip = () => { P[A.id] = !P[A.id]; repaintLive(); };
  const ico = el('span', { class: 'ad-ico' }); ico.innerHTML = A.ico;
  return el('div', { class: 'bd card addon unf' + (on ? ' on' : ''), style: `--d:${i * 60}ms` }, [el('i', { class: 'sk' }), el('div', { class: 'in' }, [
    el('button', { class: 'ad-top', 'aria-pressed': String(on), onclick: onTap(flip) }, [ico, el('b', { text: A.name }), el('span', { class: 'ad-sw', 'aria-hidden': 'true' }, el('i'))]),
    el('div', { class: 'ad-parts' }, A.parts.map(([k, t]) => el('button', { class: 'ad-part', 'aria-pressed': String(!!P[k]), disabled: on ? null : '',
      onclick: onTap(() => { P[k] = !P[k]; if (!P.throw && !P.squirt && !P.cue) P[A.id] = false; repaintLive(); }) }, [el('i'), el('span', { text: t })])))])]);
}
// on the slate: the add-ons' card - the lobby's card in small - and what is on
function addonCard() {
  const on = addonNames(realPref()), ico = el('span', { class: 'ad-ico' }); ico.innerHTML = ADDONS[0].ico;
  return el('button', { class: 'dk-addon' + (on.length ? ' on' : ''), onclick: onTap(() => { addonDraft = null; playStep = 'addons'; playFx = 'fan'; repaintLive(); }) },
    [el('i', { class: 'sk' }), ico, el('b', { text: '애드온' }), el('small', { text: on.length ? on.join(' · ') : '없음' })]);
}
const RULE_KO = (m, r) => m === 'four' ? `${(r && r.target) || 10}점${r && r.finish ? ` · ${r.finish === 'three' ? '쓰리쿠션' : '쿠션'} 마무리` : ''}${r && r.minus === false ? ' · 마이너스 없음' : ''}` : m === 'three' ? `${{ 0: '쿠션 자유', 1: '원쿠션', 3: '쓰리쿠션' }[(r && r.cushions) || 0] || ''} · ${(r && r.target) || 5}점` : '';
function deskPlay(d) {
  if (playStep === 'games') playStep = 'rank';
  if (playStep === 'setup') return deskMatch(d, false, () => { playStep = 'friend'; playFx = 'fan'; paintHome(); });   // (its X: back to the three ways)
  d.stage.dataset.win = '0';
  $('#desk').classList.add('boards');
  const fit = el('div', { class: 'bd-fit' }), wrap = el('div', { id: 'dkBoards', class: playStep });
  const panel = (id, label, fn, kids, cls) => { const b = el('button', { class: 'bd bd-' + id + (cls ? ' ' + cls : ''), 'data-b': id, 'aria-label': label }, [el('i', { class: 'sk' }), el('span', { class: 'in' }, kids)]); b.onclick = () => { if (!playBusy) { SND.init(); SND.tap(); fn(b); } }; return b; };
  const tt = (t, sub, tag) => el('span', { class: 'bd-tt' }, [tag ? el('em', { text: tag }) : null, el('b', { text: t }), sub ? el('small', { text: sub }) : null]);
  const head = (title, sub, back, kids) => el('div', { class: 'bd-head' }, [el('button', { class: 'dk-x', 'aria-label': '뒤로', onclick: () => { if (playBusy) return; SND.tap(); back(); } }, el('i')), dkTitle(title, sub), kids ? el('span', { class: 'bd-tools' }, kids) : null]);
  const toBoards = () => { playStep = 'boards'; playFx = 'fan'; invite.stopRooms(); paintHome(); };
  const dama = net.me ? net.me.dama : ECONOMY.DAMA_START;
  if (playStep === 'rank') {
    const f = ranked.finding;
    if (f) {
      // the game picked, turned over: the search for an opponent on its back
      wrap.classList.add('seek'); app.classList.add('rkcard');
      const s = Math.floor((Date.now() - f.t0) / 1000);
      dkPut(wrap, head('랭킹전', '', () => { playStep = 'boards'; paintHome(); }));
      dkPut(fit, el('div', { class: 'seek-card unf' + (playFx === 'flip' ? '' : ' flat') }, el('div', { class: 'fc' }, [
        el('div', { class: 'face front bd-g-' + f.mode }, [rackOf(f.mode), el('b', { text: MODE_KO[f.mode] })]),
        el('div', { class: 'face back' }, [el('em', { text: MODE_KO[f.mode] }), el('b', { text: '상대 찾는 중' }), el('span', { class: 'rk-dots', 'aria-hidden': 'true' }, [el('i'), el('i'), el('i')]),
          el('span', { class: 'rk-tm', text: `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }),
          el('button', { class: 'seek-x', text: '취소', onclick: onTap(() => { ranked.cancel(); playFx = 'fan'; paintHome(); }) })])])));
    } else {
      dkPut(wrap, head('랭킹전', `레이팅 ${dama}`, toBoards));
      const go = id => b => playLeave(b, () => { ranked.find(id); playFx = 'flip'; paintHome(); });
      // (printed cards, as the menu's four are: owner 11-09 - they were cloth)
      dkPut(fit, ['four', 'three', 'eight', 'nine'].map(id => panel(id, MODE_KO[id], go(id), [rackOf(id), tt(MODE_KO[id], GAME_SUB[id])], 'card game unf')));
    }
  } else if (playStep === 'friend') {
    dkPut(wrap, head('친구와 플레이', '', toBoards));
    const way = (id, t, sub, fn, off) => panel('way-' + id, t, off ? () => toast('서버에 연결되면 할 수 있습니다.', '', 2000) : fn,
      [(() => { const i = el('span', { class: 'way-ico' }); i.innerHTML = WAY_ICO[id]; return i; })(), tt(t, sub)], 'card way unf' + (off ? ' soon' : ''));
    dkPut(fit, [
      way('local', '한 기기에서', null, b => playLeave(b, () => { prefs.friendWay = 'local'; invite.leave(); playStep = 'setup'; repaintLive(); })),
      way('make', '방 만들기', null, b => playLeave(b, () => { prefs.friendWay = 'invite'; invite.pw = ''; playStep = 'setup'; repaintLive(); }), !net.on),
      way('join', '방 참가', null, b => playLeave(b, () => { playStep = 'halls'; playFx = 'hall'; invite.listRooms(); paintHome(); }), !net.on)]);
  } else if (playStep === 'addons') {
    // the add-ons: long cards, one under another, out of the middle as the others' are (owner 11-10: more will come)
    const done = keep => { if (keep && addonDraft) { prefs.addons = addonDraft; savePrefs(); } addonDraft = null; playStep = 'setup'; repaintLive(); };
    dkPut(wrap, head('애드온', '', () => done(false), [el('button', { class: 'dk-chip', text: '저장', onclick: onTap(() => done(true)) })]));
    dkPut(fit, ADDONS.map(addonPanel));
  } else if (playStep === 'halls') {
    // the hall: the desk's wood gone to the hall's floor, each open room a table on it
    app.classList.add('hall');
    const R = invite.rooms; if (!R) invite.listRooms();
    const list = R && R.list, n = list ? list.length : 0;
    dkPut(wrap, head('방 참가', list && n ? (list.some(r => r.playing) ? `방 ${n}개` : `열린 방 ${n}개`) : '',
      () => { invite.stopRooms(); playStep = 'friend'; playFx = 'fan'; paintHome(); },
      [el('button', { class: 'dk-chip', text: '코드로 참가', onclick: onTap(invite.sheetJoin) })]));
    // (the rooms waiting for someone, then - divided off as the shop divides its rarities - the games being played, to
    // watch: owner 11-09)
    const table = (r, i) => {
      const kind = r.mode === 'three' || r.mode === 'four' ? 'carom' : 'pool', rule = [r.size === 4 ? `2:2${r.playing ? '' : ` ${r.filled}/4`}` : '', RULE_KO(r.mode, r.rules)].filter(Boolean).join(' · '),
        who = r.playing ? (r.names ? `${r.names[0]}·${r.names[2]} vs ${r.names[1]}·${r.names[3]}` : `${r.host.name} vs ${r.guest.name}`) : r.host.name;
      return el('button', { class: 'tb unf ' + kind + (r.lock ? ' lock' : '') + (r.playing ? ' live' : ''), style: `--d:${i * 40}ms`,
        'aria-label': `${r.title || `${r.host.name}의 방`}, ${MODE_KO[r.mode]}${r.playing ? ', 경기 중, 관전' : ''}${r.lock ? ', 비밀번호' : ''}`,
        onclick: onTap(() => r.playing ? (r.lock ? invite.sheetPw(r, false, true) : invite.watch(r)) : r.lock ? invite.sheetPw(r) : invite.take(r)) }, [
        el('span', { class: 'tb-table' }, [el('span', { class: 'tb-cloth' }, rackOf(r.mode)), kind === 'pool' ? el('span', { class: 'tb-pk' }) : null, r.playing ? el('em', { class: 'tb-live', text: '관전' }) : null,
          // (the room's game, rules and add-ons as capsules at the table's top left - 78-addons.css; the plate keeps the people)
          el('span', { class: 'tb-caps' }, [MODE_KO[r.mode], ...rule.split(' · ').filter(Boolean), r.rules && r.rules.fast ? '빠른 진행' : null].filter(Boolean).map(t => el('em', { text: t })).concat(addonNames(r.rules && r.rules.real).map(t => el('em', { class: 'ad', text: t }))))]),
        el('span', { class: 'tb-plate' }, [el('b', { text: r.title || `${r.host.name}의 방` }),
          el('small', { text: r.playing ? who : `${who} · 레이팅 ${r.host.dama}` }),
          r.lock ? el('i', { class: 'tb-lock', 'aria-hidden': 'true' }) : null])]);
    };
    if (list && n) {
      const wait = list.filter(r => !r.playing), live = list.filter(r => r.playing), kids = [];
      const tier = (t, k) => el('div', { class: 'dk-tier tb-tier' + (k ? ' ' + k : '') }, [el('span', { text: t })]);
      if (wait.length) { if (live.length) kids.push(tier(`대기 중 ${wait.length}`)); wait.forEach((r, i) => kids.push(table(r, i))); }
      if (live.length) { kids.push(tier(`경기 중 ${live.length}`, 'live')); live.forEach((r, i) => kids.push(table(r, wait.length + i))); }
      dkPut(fit, kids);
    }
    // (copy audit 02-04, 02-05: reading, failing and empty each say so once, differently)
    else if (!list && R && R.err) dkPut(fit, el('div', { class: 'tb-none' }, [el('b', { text: '방 목록을 불러오지 못했습니다' }), el('button', { class: 'dk-chip', text: '다시 시도', onclick: onTap(() => invite.listRooms()) })]));
    else if (!list) dkPut(fit, el('div', { class: 'tb-none wait' }, [el('i', { class: 'sp', 'aria-hidden': 'true' }), el('b', { text: '방 찾는 중…' })]));
    else dkPut(fit, el('div', { class: 'tb-none' }, [el('b', { text: '열린 방 없음' }),
      el('button', { class: 'dk-chip', text: '방 만들기', onclick: onTap(() => { invite.stopRooms(); prefs.friendWay = 'invite'; invite.pw = ''; playStep = 'setup'; repaintLive(); }) })]));
  } else {
    // (5.0: plain blocks of the shop's two colours - ivory and charcoal - with only words on them for now; pictures come
    // back one by one, drawn to match. 투어 and the shop's window are gone: 챌린지 and 아케이드 in their places.)
    const soon = what => () => toast(`${what} 준비 중입니다.`, '', 2200);
    const T = ECONOMY.TIER_AT, ti = Math.max(0, T.filter(x => dama >= x).length - 1), tier = TIERS[Math.min(TIERS.length - 1, ti)];
    // the way to the next tier, filling like a level bar: it fills from empty when the number has changed since it was
    // last shown, and sits still otherwise (the desk paints again often)
    const lo = T[ti], hi = T[ti + 1], part = hi == null ? 1 : Math.max(0, Math.min(1, (dama - lo) / (hi - lo))), grow = rankBarShown !== dama; rankBarShown = dama;
    const bar = el('span', { class: 'bd-bar' + (grow ? ' grow' : ''), style: `--p:${part.toFixed(3)}` }, [el('i', null, el('b', null, el('em'))), el('small', { text: hi == null ? '최고 티어' : `${TIERS[ti + 1][1]}까지 ${hi - dama}` })]);
    dkPut(fit, [
      panel('friend', '친구와 플레이', b => playLeave(b, () => { playFor = 'friend'; playStep = 'friend'; playFx = 'fan'; paintHome(); }), [tt('친구와 플레이')], 'card unf'),
      panel('challenge', '챌린지', soon('챌린지는'), [tt('챌린지', '실제 경기 장면 재현', '준비 중')], 'card soon unf'),
      panel('arcade', '아케이드', soon('아케이드는'), [tt('아케이드', '빙판 · 오각형 테이블', '준비 중')], 'card soon unf'),
      panel('rank', '랭킹전', b => { if (!net.on) return ranked.pick(); playLeave(b, () => ranked.pick()); }, [tt('랭킹전', null, 'ONLINE'),
        el('span', { class: 'bd-foot' }, [el('b', { text: tier[1] }), el('small', { text: `레이팅 ${dama}` }), bar])], 'card unf')]);   // (copy audit 01-04, 01-05: titles only)
  }
  wrap.appendChild(fit); $('#desk').appendChild(wrap);
  playEnter(wrap);
}
// inviting a friend: the code open on the server while this shows; the tray shows the two places and the code
// 4구's finish, chosen with the game (here and for a friend's room): none, a cushion, or three (game.js MODES.four)
const finishPref = () => prefs.finish === 'three' ? 'three' : prefs.finish ? 'cushion' : false;
const finishSeg = () => dkSeg([[false, '없음'], ['cushion', '쿠션'], ['three', '쓰리쿠션']], finishPref(), v => { prefs.finish = v; repaint(); });
// 빠른 진행, chosen with the game against the computer or a friend (owner 11-10: no longer a setting)
const fastSeg = () => [dkLab('빠른 진행'), dkSeg([[true, '켬'], [false, '끔']], !!prefs.fast, v => { prefs.fast = v; repaint(); })];
// 4구 with a friend: whether a foul costs a point (owner 11-10)
const minusSeg = () => [dkLab('마이너스 점수'), dkSeg([[true, '있음'], [false, '없음']], prefs.fourMinus !== false, v => { prefs.fourMinus = v; repaint(); })];
function deskInvite(slate, _, m) {
  const h = invite.want(m); invite.shown = true;
  invite.tray($('#dkStage'), m);
  if (m === 'three') { const T = [3, 5, 10];
    dkPut(slate, [dkLab('목표 점수'), dkStep(T, T.includes(prefs.target) ? prefs.target : 5, String, v => { prefs.target = v; repaint(); }),
      dkSeg([[0, '쿠션 자유'], [1, '원쿠션'], [3, '쓰리쿠션']], prefs.rule3, v => { prefs.rule3 = v; repaint(); })]); }
  if (m === 'four') { const T = [5, 10, 15, 20, 30]; dkPut(slate, [dkLab('목표 점수'), dkStep(T, T.includes(prefs.fourTarget) ? prefs.fourTarget : 10, String, v => { prefs.fourTarget = v; repaint(); }), dkLab('마무리'), finishSeg(), ...minusSeg()]); }
  // 1:1 or 2:2 (owner 11-09: four, the empty seats the computer's if the host likes)
  dkPut(slate, [dkLab('인원'), dkSeg([[2, '1:1'], [4, '2:2']], invite.size, v => { invite.size = v; repaint(); }), ...fastSeg()]);
  const four = invite.size === 4, full = !!(h && h.seats && h.seats.every(Boolean)), ready = full && h.seats.every((q, i) => !i || q.bot != null || q.ready);
  if (h && h.seats) dkPut(slate, el('div', { class: 'seats' }, invite.seatRows(h.seats, 0, true)));
  // (copy audit 02-06, 02-07: one line for the state - open (the badge on the code says it is listed), opening, or why not)
  dkPut(slate, [dkHr(), dkTxt(h ? (ready ? '모두 준비했습니다' : full ? '준비를 기다리는 중' : four ? '빈자리에 친구가 오거나 컴퓨터를 넣으세요' : '친구를 기다리는 중') : invite.err && !invite.opening ? `방을 열지 못했습니다 (${invite.err})` : '방 여는 중…'),
    // (the password is asked only of those who take the room from the list: the code is the invitation - 55-invite.js)
    dkRow(`방 이름 · ${invite.title || (h && h.title) || prefs.names[0] + '의 방'}`, '바꾸기', invite.sheetTitle),
    dkRow(invite.pw ? `비밀번호 ${'•'.repeat(invite.pw.length)}` : '비밀번호 없음', invite.pw ? '없애기' : '정하기', () => { if (invite.pw) { invite.pw = ''; repaint(); } else invite.sheetPw(null); }),
    addonCard()]);
  dkPut(slate, dkActs(!h && invite.err ? dkMain('다시 시도', null, () => { invite.err = null; repaint(); }) : full ? dkMain('경기 시작', null, () => invite.start(), !ready) : dkMain('초대 링크 보내기', null, () => h && invite.share(h.code), !h),
    dkSec('방 나가기', () => { invite.leave(); prefs.friendWay = 'local'; repaint(); })));
}
// a match to set up: against a friend (플레이, the game picked on its card or on the rail) or the computer (훈련 · 컴퓨터
// 대전, picked on the slate); back, if given, puts an X on the tray's head
function deskMatch({ rail, head, foot, slate }, cpu, back) {
  const m = GAME4.includes(prefs.mode) ? prefs.mode : 'eight', mm = game.MODES[m], inv = !cpu && prefs.friendWay === 'invite' && net.on;
  const pick = id => () => { if (prefs.mode === id) return; prefs.mode = id; if (cpu) prefs.cpuMode = id; repaintLive(); };
  if (!cpu) dkPut(rail, GAME4.map(id => railBtn(m === id, MODE_KO[id], null, pick(id), false, 'mode-' + id)));   // each with the balls it is played with
  if (back) { head.className = 'dk-head open'; dkPut(head, el('button', { class: 'dk-x', 'aria-label': '종목 카드로', onclick: () => { SND.tap(); back(); } }, el('i'))); }
  dkPut(head, dkTitle(cpu ? '컴퓨터 대전' : '친구와 플레이'));   // (copy audit 01-10: the rules are told when the game begins)
  const plate = i => {
    const nm = i ? oppName() : prefs.names[0], sub = m === 'four' ? `수지 ${sujiOf(i) * 10}` : i && prefs.vsAI ? LEVELS[prefs.level] : recText(nm);
    return el('button', { class: 'dk-plate' + (i ? ' two' : ''), onclick: onTap(() => sheetName(i)) }, [el('i', { class: 'av', text: String(i + 1) }), el('span', null, [el('b', { text: nm }), el('small', { text: sub })])]);
  };
  if (!inv) dkPut(foot, [plate(0), el('span', { class: 'dk-vs', text: 'VS' }), plate(1)]);

  dkPut(slate, dkH1(MODE_KO[m]));
  if (cpu) dkPut(slate, [dkHr(), dkLab('종목'), dkSeg(GAME4.map(id => [id, MODE_KO[id]]), m, v => pick(v)())]);
  // (with a friend: here on one device, taking turns - or invited to play from theirs, by a code: 55-invite.js)
  else dkPut(slate, [dkHr(), dkSeg([['local', '한 기기에서'], ['invite', '초대하기', !net.on]], inv ? 'invite' : 'local', v => { prefs.friendWay = v; if (v === 'local') invite.leave(); repaint(); })]);
  if (inv) return deskInvite(slate, d => d, m);
  if (prefs.vsAI) dkPut(slate, [dkLab('난이도'), dkSeg(LEVELS.map((t, i) => [i, t]), Math.min(3, prefs.level), v => { prefs.level = v; repaint(); })]);
  if (m === 'four') {
    const suji = (name, i, set) => el('div', { class: 'dk-row' }, [el('span', { class: 'dk-txt', text: name }), dkStep(SUJI, sujiOf(i), v => String(v * 10), v => { set(v); repaint(); }, true)]);
    dkPut(slate, [dkLab('수지'),
      suji(prefs.names[0], 0, v => { prefs.suji[prefs.names[0]] = v; }),
      suji(oppName(), 1, v => { if (prefs.vsAI) prefs.sujiAI = v; else prefs.suji[prefs.names[1]] = v; }),
      dkLab('마무리'), finishSeg(), ...(cpu ? [] : minusSeg())]);
  }
  if (m === 'three') {
    const T = [3, 5, 10];
    dkPut(slate, [dkLab('목표 점수'), dkStep(T, T.includes(prefs.target) ? prefs.target : 5, String, v => { prefs.target = v; repaint(); }),
      dkSeg([[0, '쿠션 자유'], [1, '원쿠션'], [3, '쓰리쿠션']], prefs.rule3, v => { prefs.rule3 = v; repaint(); })]);
  }
  dkPut(slate, fastSeg());
  if (!cpu) dkPut(slate, [dkHr(), addonCard()]);
  const d = store.get('save', null), gm = d && d.v === 2 && d.game && MODE_KO[d.game.modeId] ? d.game : null;
  dkPut(slate, dkActs(dkMain('시작', null, () => match.start(m === 'four' ? (Math.random() < 0.5 ? 0 : 1) : 0)),   // (4구: the yellow ball, and so who breaks, drawn by lot)
    gm ? dkSec('이어서 하기', () => resume(d), `${MODE_KO[gm.modeId]} · ${gm.players[0].name} vs ${gm.players[1].name}`) : null));
}
