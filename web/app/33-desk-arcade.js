/* 아케이드 (owner 11-11/12): one mode, 증강 당구 - played with 36 balls ("36볼") - the screens only for now, the rules to come.
     1. 테이블 투표: at the start, three green cards - the table's shape (round, bumpy, a regular pentagon). Both players vote
        for 10 seconds; the same card, that one; different, one of the two at random (no vote: any of the three).
     2. 증강: each time both players have had their second turn, each picks an augment - the second pick is a debuff for the
        other (the table turned to ice, balls added ...).
     3. 궁극기: a gauge filling with every shot - the other's shots more than one's own (ULT) - at the bottom middle of the
        game screen (ultGauge: also in 50-match.js, shown in any game while the debug setting is on, to try it).
   In the menu's language: printed cards on the desk (the 4 boards' face, edge and dots), dealt out of the card tapped
   (playEnter 'fan'), a taken card to the middle and the others off (playLeave). What is on a card is a line of ARCADE.
   The vote's other player is played by the screen here (its card at a random moment) until there is a room to vote in. */
const ARCADE = {
  BALLS: 36, VOTE_S: 10,
  ULT: { mine: 6, theirs: 10 },      // (the gauge, out of 100: one's own shot, the other's)
  shapes: [
    { id: 'circle', name: '원형', sub: '둥근 쿠션 하나', ico: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3.2"><circle cx="24" cy="24" r="17"/><circle cx="24" cy="24" r="2.6" fill="currentColor" stroke="none"/></svg>' },
    { id: 'bumpy', name: '울퉁불퉁', sub: '들쭉날쭉한 쿠션', ico: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round"><path d="M9 14l7 3 5-6 6 5 7-4 4 8-3 6 5 7-6 5-6-3-5 6-6-5-7 3-3-8 4-6z"/><circle cx="24" cy="24" r="2.6" fill="currentColor" stroke="none"/></svg>' },
    { id: 'penta', name: '정오각형', sub: '다섯 면의 쿠션', ico: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round"><path d="M24 6.5l17 12.4-6.5 20H13.5L7 18.9z"/><circle cx="24" cy="24" r="2.6" fill="currentColor" stroke="none"/></svg>' },
  ],
  debuffs: [
    { id: 'ice', name: '빙판', d: '상대가 칠 때 테이블이 빙판이 됩니다', ico: '❄' },
    { id: 'more', name: '공 추가', d: '상대 테이블에 공이 3개 늘어납니다', ico: '+3' },
    { id: 'fog', name: '안개', d: '상대의 조준선이 짧아집니다', ico: '◌' },
    { id: 'heavy', name: '무거운 큐', d: '상대의 최대 세기가 줄어듭니다', ico: '▼' },
    { id: 'narrow', name: '좁은 포켓', d: '상대가 칠 때 포켓이 좁아집니다', ico: '◖◗' },
    { id: 'flip', name: '거꾸로 당점', d: '상대의 회전이 반대로 걸립니다', ico: '⇄' },
  ],
};
// the screens' state: the vote (my card, the other's, when it ends, the outcome), the augments dealt and the one taken, the
// gauge's try-out
const arc = { vote: null, deal: null, took: null, gauge: [0, 0], timer: 0 };
const arcPick = a => a[Math.floor(Math.random() * a.length)];
const arcIco = svg => { const i = el('span', { class: 'way-ico' }); i.innerHTML = svg; return i; };
function arcVoteNew() { const now = Date.now(); arc.vote = { me: null, them: null, themAt: now + 1800 + Math.random() * 6200, end: now + ARCADE.VOTE_S * 1000, rolling: null, won: null }; }
// the vote's clock: the other's card when its moment comes, the end when both have voted or the time is up (the desk is
// painted again whenever anything changes; the clock only writes the seconds into it)
function arcTick() {
  const v = arc.vote, now = Date.now();
  if (playStep !== 'arc-vote' || !v || v.rolling) { clearInterval(arc.timer); arc.timer = 0; return; }
  const c = $('#arcClock'); if (c) c.textContent = Math.max(0, Math.ceil((v.end - now) / 1000));
  if (!v.them && now >= v.themAt) v.them = arcPick(ARCADE.shapes).id;
  if ((v.me && v.them) || now >= v.end) arcResolve();
}
function arcResolve() {
  const v = arc.vote; if (!v.me) v.me = arcPick(ARCADE.shapes).id; if (!v.them) v.them = arcPick(ARCADE.shapes).id;
  const cands = v.me === v.them ? [v.me] : [v.me, v.them], won = arcPick(cands);
  v.rolling = cands; paintHome();
  // different votes: the light runs between the two and stops on one (as a draw does); then on to the augments
  let n = cands.length > 1 ? 9 + cands.indexOf(won) : 1, i = 0;
  const step = () => {
    if (playStep !== 'arc-vote' || arc.vote !== v) return;
    for (const c of document.querySelectorAll('#dkBoards .bd.shape')) c.classList.toggle('lit', c.dataset.b === 'arc-sh-' + cands[i % cands.length]);
    if (--n > 0) { i++; setTimeout(step, 110 + (9 - n) * 16); return; }
    v.won = won; SND.init(); SND.tap(); paintHome();
    setTimeout(() => { if (playStep === 'arc-vote' && arc.vote === v) { playStep = 'arc-aug'; playFx = 'fan'; arc.deal = null; arc.took = null; paintHome(); } }, 1600);
  };
  setTimeout(step, 300);
}
const ARCADE_STEPS = {
  // the mode, and what it is in three cards
  arcade({ wrap, fit, panel, tt, head, toBoards }) {
    dkPut(wrap, head('아케이드', `${ARCADE.BALLS}볼`, toBoards));
    const info = (n, t, sub, cls) => el('div', { class: 'bd card info unf ' + cls, 'aria-hidden': 'true' }, [el('i', { class: 'sk' }), el('span', { class: 'in' }, [el('span', { class: 'arc-n', text: n }), tt(t, sub)])]);
    dkPut(fit, [
      panel('arc-mode', '증강 당구', b => playLeave(b, () => { arcVoteNew(); playStep = 'arc-vote'; playFx = 'fan'; paintHome(); }),
        [arcIco('<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"><rect x="6" y="13" width="15" height="22" rx="3" transform="rotate(-14 13 24)"/><rect x="17" y="10" width="15" height="24" rx="3"/><rect x="28" y="13" width="15" height="22" rx="3" transform="rotate(14 35 24)"/><path d="M24.5 17l1.6 3.4 3.6.4-2.7 2.4.8 3.6-3.3-1.9-3.3 1.9.8-3.6-2.7-2.4 3.6-.4z" fill="currentColor" stroke="none"/></svg>'),
          tt('증강 당구', '테이블 투표 · 증강 · 궁극기', `${ARCADE.BALLS}볼`)], 'card way arc unf'),
      info('1', '테이블 투표', `${ARCADE.VOTE_S}초 · 다르면 둘 중 무작위`, 'i1'),
      info('2', '증강', '두 번째 차례마다 · 상대에게 디버프', 'i2'),
      info('3', '궁극기', '상대가 칠 때 더 많이 차오름', 'i3'),
    ]);
  },
  // 1. the vote: three green cards; mine and the other's marked on them (the other's once I have voted or the time is up:
  // each votes not knowing the other's); the clock in the corner
  'arc-vote'({ wrap, fit, panel, tt, head }) {
    if (!arc.vote) arcVoteNew();
    const v = arc.vote, back = () => { arc.vote = null; playStep = 'arcade'; playFx = 'fan'; paintHome(); };
    const left = Math.max(0, Math.ceil((v.end - Date.now()) / 1000)), name = id => ARCADE.shapes.find(s => s.id === id).name;
    dkPut(wrap, head('테이블 고르기', v.won ? `${name(v.won)} 테이블로 정해졌습니다` : v.rolling ? (v.rolling.length > 1 ? '서로 달라서 둘 중 하나를 뽑습니다' : '같은 테이블을 골랐습니다') : v.me ? '상대를 기다리는 중' : '마음에 드는 테이블에 투표하세요', back,
      [el('span', { class: 'arc-clock' + (v.rolling ? ' done' : ''), 'aria-label': '남은 시간' }, [el('b', { id: 'arcClock', text: v.rolling ? '0' : String(left) }), el('small', { text: '초' })])]));
    dkPut(fit, ARCADE.shapes.map(S => {
      const marks = [v.me === S.id ? el('span', { class: 'vote me', text: '나' }) : null, v.them === S.id && v.rolling ? el('span', { class: 'vote them', text: '상대' }) : null];
      return panel('arc-sh-' + S.id, S.name + ' 테이블', () => { if (v.rolling || v.me) return; SND.init(); SND.tap(); v.me = S.id; paintHome(); },
        [arcIco(S.ico), tt(S.name, S.sub), el('span', { class: 'votes' }, marks)],
        'card way shape unf' + (v.won ? (v.won === S.id ? ' won' : ' lost') : v.rolling && !v.rolling.includes(S.id) ? ' lost' : v.me === S.id ? ' mine' : ''));
    }));
    if (!arc.timer && !v.rolling) arc.timer = setInterval(arcTick, 200);
  },
  // 2. an augment: three cards to put on the other (the second pick of a game - the debuffs); the one taken stays in the middle
  'arc-aug'({ wrap, fit, panel, tt, head }) {
    const back = () => { playStep = 'arcade'; playFx = 'fan'; paintHome(); };
    if (!arc.deal) { const a = ARCADE.debuffs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } arc.deal = a.slice(0, 3).map(d => d.id); }
    const took = arc.took;
    dkPut(wrap, head('증강', took ? '상대에게 걸었습니다' : '두 번째 차례마다 · 상대에게 걸 카드를 고르세요', back, [
      took ? null : el('button', { class: 'dk-chip', text: '다시 뽑기', onclick: onTap(() => { arc.deal = null; playFx = 'fan'; paintHome(); }) }),
      took ? el('button', { class: 'dk-chip', text: '궁극기 보기', onclick: onTap(() => { playStep = 'arc-ult'; playFx = 'fan'; paintHome(); }) }) : null]));
    dkPut(fit, arc.deal.filter(id => !took || id === took).map(id => {
      const D = ARCADE.debuffs.find(d => d.id === id);
      return panel('arc-db-' + id, D.name, b => { if (arc.took) return; playLeave(b, () => { arc.took = id; paintHome(); }); },
        [el('span', { class: 'arc-big', text: D.ico, 'aria-hidden': 'true' }), tt(D.name, D.d, '상대에게')], 'card way debuff unf' + (took ? ' took' : ''));
    }));
  },
  // 3. the ultimate: the game screen's gauge as it will be, filled here by the two kinds of shot
  'arc-ult'({ wrap, fit, panel, tt, head }) {
    const back = () => { playStep = 'arc-aug'; playFx = 'fan'; paintHome(); };
    dkPut(wrap, head('궁극기', `내가 치면 +${ARCADE.ULT.mine} · 상대가 치면 +${ARCADE.ULT.theirs}`, back,
      [el('button', { class: 'dk-chip', text: '비우기', onclick: onTap(() => { arc.gauge = [0, 0]; paintHome(); }) })]));
    const screen = el('div', { class: 'bd card arc-screen unf', 'aria-hidden': 'true' }, [el('i', { class: 'sk' }), el('span', { class: 'in' }, [el('span', { class: 'arc-felt' }), ultGauge(arc.gauge[0], '나')])]);
    const shot = (who, label) => panel('arc-shot-' + who, label, () => { ultShot(arc.gauge, who); paintHome(); },
      [tt(label, `내 게이지 +${who ? ARCADE.ULT.theirs : ARCADE.ULT.mine}`)], 'card way shot unf');
    dkPut(fit, [screen, shot(0, '내가 침'), shot(1, '상대가 침')]);
  },
};
/* The ultimate's gauge (owner 11-12): at the bottom middle of the game screen, filling as both players shoot - the other's
   shots more (ARCADE.ULT); full, it glows. g: the two players' gauges; who: the one who just shot. */
function ultShot(g, who) { g[who] = Math.min(100, g[who] + ARCADE.ULT.mine); g[1 - who] = Math.min(100, g[1 - who] + ARCADE.ULT.theirs); }
function ultGauge(v, name) {
  const full = v >= 100;
  return el('div', { class: 'ultg' + (full ? ' full' : ''), role: 'meter', 'aria-label': `${name} 궁극기`, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(v)) }, [
    el('span', { class: 'ultg-n', text: name }),
    el('span', { class: 'ultg-bar' }, [el('i', { style: `--v:${(v / 100).toFixed(3)}` }), ...[1, 2, 3, 4].map(k => el('b', { style: `left:${k * 20}%` }))]),
    el('span', { class: 'ultg-l', text: full ? '궁극기 준비' : '궁극기' })]);
}
