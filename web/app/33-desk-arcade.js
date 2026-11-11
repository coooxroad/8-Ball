/* 아케이드 (owner 11-11): two modes, the screens only for now - played with 36 balls ("36볼로 만들거임"), the rules to come.
     증강 당구: every few shots three cards are dealt, the player takes one, and its effect stays for the rest of the game.
     궁극기 당구: a gauge fills as the player scores; full, the chosen ultimate can be fired on a shot (TianTian billiards).
   The same language as the menu's: printed cards (the 4 boards' face and edge), dealt out of the card that was tapped
   (playEnter 'fan'), the others flying off when one is taken (playLeave). Its steps join 플레이's (33-desk-play.js
   PLAY_STEPS); what is on a card is here, so a new augment or ultimate is one line. */
const ARCADE = {
  BALLS: 36,
  modes: [
    { id: 'aug', name: '증강 당구', sub: '카드를 뽑아 강해지기',
      ico: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"><rect x="6" y="13" width="15" height="22" rx="3" transform="rotate(-14 13 24)"/><rect x="17" y="10" width="15" height="24" rx="3"/><rect x="28" y="13" width="15" height="22" rx="3" transform="rotate(14 35 24)"/><path d="M24.5 18l1.6 3.4 3.6.4-2.7 2.4.8 3.6-3.3-1.9-3.3 1.9.8-3.6-2.7-2.4 3.6-.4z" fill="currentColor" stroke="none"/></svg>' },
    { id: 'ult', name: '궁극기 당구', sub: '게이지를 모아 한 방',
      ico: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="24" r="17" stroke-dasharray="80 27"/><path d="M26 10l-9 16h8l-3 12 10-17h-8z" fill="currentColor" stroke="none"/></svg>' },
  ],
  // the augments (tier 0 실버, 1 골드, 2 프리즘, as the cards are dealt in other games); three of them dealt at a time
  TIERS: ['실버', '골드', '프리즘'],
  augs: [
    { t: 0, name: '거대 큐볼', d: '큐볼이 1.3배 커집니다', ico: '◯' },
    { t: 0, name: '긴 조준선', d: '조준선이 한 번 더 꺾여 보입니다', ico: '⟋' },
    { t: 0, name: '쿠션 탄성', d: '쿠션에서 공이 더 빠르게 튑니다', ico: '⇆' },
    { t: 1, name: '자석 포켓', d: '포켓 가까이 온 공을 끌어당깁니다', ico: '⊙' },
    { t: 1, name: '두 번 치기', d: '넣지 못해도 한 번 더 칩니다', ico: '↻' },
    { t: 1, name: '무거운 공', d: '상대 공이 덜 굴러갑니다', ico: '▣' },
    { t: 2, name: '분신술', d: '다음 샷에 큐볼이 둘이 됩니다', ico: '◎' },
    { t: 2, name: '연쇄 폭발', d: '공이 들어가면 주변 공을 밀어냅니다', ico: '✦' },
    { t: 2, name: '시간 되감기', d: '한 샷을 없던 일로 합니다', ico: '⟲' },
  ],
  ults: [
    { id: 'bolt', name: '번개 샷', d: '세기 두 배, 공이 곧게 뻗습니다', c: '#ffd34d' },
    { id: 'hole', name: '블랙홀', d: '가장 가까운 포켓이 공을 빨아들입니다', c: '#b072ff' },
    { id: 'seek', name: '유도탄', d: '맞힐 공으로 휘어 들어갑니다', c: '#4fd8ff' },
    { id: 'stop', name: '타임 스톱', d: '상대의 다음 샷 시간이 절반', c: '#ff5d6c' },
  ],
};
let arcadeDeal = null, arcadePick = null, arcadeTook = false, arcadeUlt = 'bolt';   // (arcadeTook: the card just taken - its glow once)
const arcadeDraw = () => { const a = ARCADE.augs.map((q, i) => i); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, 3).sort((x, y) => ARCADE.augs[x].t - ARCADE.augs[y].t); };
const arcadeIco = svg => { const i = el('span', { class: 'way-ico' }); i.innerHTML = svg; return i; };
const ARCADE_STEPS = {
  // the two modes, dealt out of the 아케이드 card
  arcade({ wrap, fit, panel, tt, head, toBoards }) {
    dkPut(wrap, head('아케이드', `${ARCADE.BALLS}볼`, toBoards));
    dkPut(fit, ARCADE.modes.map(M => panel('arc-' + M.id, M.name, b => playLeave(b, () => { if (M.id === 'aug') { arcadeDeal = arcadeDraw(); arcadePick = null; } playStep = 'arc-' + M.id; playFx = M.id === 'aug' ? 'deal' : 'fan'; paintHome(); }),
      [arcadeIco(M.ico), tt(M.name, M.sub, `${ARCADE.BALLS}볼`)], 'card way arc unf')));
  },
  // 증강 당구: three cards dealt face down, turned over one after another; tapping one takes it, the other two fly off
  'arc-aug'({ wrap, fit, head }) {
    const back = () => { playStep = 'arcade'; playFx = 'fan'; paintHome(); };
    dkPut(wrap, head('증강 당구', arcadePick == null ? '카드 한 장을 고르세요' : '이 효과가 끝까지 남습니다', back,
      [el('button', { class: 'dk-chip', text: '다시 뽑기', onclick: onTap(() => { arcadeDeal = arcadeDraw(); arcadePick = null; playFx = 'deal'; paintHome(); }) })]));
    const deal = arcadeDeal || (arcadeDeal = arcadeDraw());
    dkPut(fit, deal.map((k, i) => {
      const A = ARCADE.augs[k], took = arcadePick === k;
      const card = el('button', { class: `aug t${A.t} unf` + (took ? ' took' : arcadePick != null ? ' gone' : ''), style: `--d:${i * 140}ms`, 'aria-label': `${A.name}, ${ARCADE.TIERS[A.t]}`, 'aria-pressed': String(took) },
        el('span', { class: 'aug-fc' }, [
          el('span', { class: 'aug-face' }, [el('i', { class: 'aug-sh', 'aria-hidden': 'true' }), el('em', { text: ARCADE.TIERS[A.t] }), el('span', { class: 'aug-ico', text: A.ico, 'aria-hidden': 'true' }), el('b', { text: A.name }), el('small', { text: A.d })]),
          el('span', { class: 'aug-back', 'aria-hidden': 'true' }, el('i'))]));
      // taken: it comes to the middle while the other two fly off (as playLeave does it with the menu's cards), then stays there
      card.onclick = () => {
        if (playBusy || arcadePick != null) return; SND.init(); SND.tap(); playBusy = true;
        const [x, y] = flatMid(card, fit); card.style.setProperty('--gx', (fit.offsetWidth / 2 - x).toFixed(1) + 'px'); card.style.setProperty('--gy', (fit.offsetHeight / 2 - y).toFixed(1) + 'px'); card.classList.add('go');
        let n = 0; for (const o of fit.querySelectorAll('.aug')) if (o !== card) { o.style.setProperty('--d', (n++ * 45) + 'ms'); o.style.setProperty('--ax', (o.offsetLeft < card.offsetLeft ? -60 : 60) + 'px'); o.classList.add('away'); }
        setTimeout(() => { playBusy = false; arcadePick = k; arcadeTook = true; paintHome(); }, 340);
      };
      return card;
    }));
    if (playFx === 'deal') { playFx = null; for (const c of fit.querySelectorAll('.aug')) c.classList.add('deal'); }
    if (arcadeTook) { arcadeTook = false; const t = fit.querySelector('.aug.took'); if (t) t.classList.add('pop'); }
  },
  // 궁극기 당구: the ultimates, each with its gauge; the one taken has its gauge running
  'arc-ult'({ wrap, fit, head }) {
    const back = () => { playStep = 'arcade'; playFx = 'fan'; paintHome(); };
    dkPut(wrap, head('궁극기 당구', '득점할수록 게이지가 찹니다', back));
    dkPut(fit, ARCADE.ults.map((U, i) => {
      const on = arcadeUlt === U.id;
      const card = el('button', { class: 'bd card ult unf' + (on ? ' on' : ''), style: `--uc:${U.c};--d:${i * 60}ms`, 'aria-label': U.name, 'aria-pressed': String(on) }, [el('i', { class: 'sk' }),
        el('span', { class: 'in' }, [el('span', { class: 'ult-g', 'aria-hidden': 'true' }, [el('i'), el('b', { text: on ? 'MAX' : '' })]), el('span', { class: 'bd-tt' }, [on ? el('em', { text: '장착' }) : null, el('b', { text: U.name }), el('small', { text: U.d })])])]);
      card.onclick = () => { if (playBusy) return; SND.init(); SND.tap(); arcadeUlt = U.id; paintHome(); };
      return card;
    }));
  },
};
