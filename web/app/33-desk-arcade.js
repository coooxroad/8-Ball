/* 아케이드 (owner 11-11/12): one mode, 증강 당구 - 준비 중 (its board opens with the debug setting only: 33-desk-play.js) -
   played online only, with someone found as 랭킹전 finds them (54-ranked.js
   find, the server's lobby 'arcade'). Its rules and cards are game.js ARCADE; on the game screen it is 55-arcade.js (the
   table's vote, the augments, over the table) and 50-match.js (the ultimate's gauge).
   Here, in the menu's language: its card, and what it is in three cards beside it; the card tapped turns over to the search
   for an opponent (seekPaint, as 랭킹전's games do). */
const ARCADE_STEPS = {
  arcade({ wrap, fit, panel, tt, head, toBoards }) {
    const f = ranked.finding;
    if (f && f.mode === 'arcade') return seekPaint({ wrap, fit, head }, f, '아케이드');
    dkPut(wrap, head('아케이드', `${ARCADE.BALLS}볼`, toBoards));
    const info = (n, t, sub, cls) => el('div', { class: 'bd card info unf ' + cls, 'aria-hidden': 'true' }, [el('i', { class: 'sk' }), el('span', { class: 'in' }, [el('span', { class: 'arc-n', text: n }), tt(t, sub)])]);
    const go = b => { if (!net.on) return toast('아케이드는 서버에 연결되면 할 수 있습니다.', '', 2200); playLeave(b, () => { ranked.find('arcade'); playFx = 'flip'; paintHome(); }); };
    dkPut(fit, [
      panel('arc-mode', '증강 당구', go, [arcIco(ARC_ICO.mode), tt('증강 당구', `온라인 매칭 · 한 차례 ${ARCADE.SHOTS}번`, `${ARCADE.BALLS}볼`)], 'card way arc unf'),
      info('1', '테이블 투표', `${ARCADE.VOTE_MS / 1000}초 · 다르면 둘 중 무작위`, 'i1'),
      info('2', '증강 · 어려움', `${ARCADE.EVERY}차례마다 번갈아`, 'i2'),
      info('3', '궁극기', '상대가 칠 때 더 차오름', 'i3'),
    ]);
  },
};
const arcIco = svg => { const i = el('span', { class: 'way-ico' }); i.innerHTML = svg; return i; };
