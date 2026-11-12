/* ================= 아케이드 · 증강 당구 on the game screen (owner 11-12) =================
   The game begins as any online game does - the table on the screen, the balls racked (36볼: game.js MODES.arcade) - and
   then, before the first shot, the cards come over it: the table behind goes soft (a zoom blur of the frame, darker at
   the edges: the eye goes to the middle) and three printed cards are dealt into the middle, face down, and turn over.
     the table's vote: three green cards, ARCADE.VOTE_MS; the other's card shown once both have voted (the room's word:
       { t: 'shape', id, votes }); two different, the light runs between them and stops on the room's choice;
     each augments' round (ARCADE.due: each time both have had ARCADE.EVERY more visits): three of the seat's own deal
       (ARCADE.deal - the first round red, the other's debuffs; later ones one's own, in their tier's metal), ARCADE.PICK_MS;
       once both have picked (the room's { t: 'picks' }), the two cards side by side, then back to the table.
   A card not given in time is given at random here (the room does the same for a seat that never sends one). While the
   cards are up nobody plays: the turn waits (40-shot.js beginTurn asks hold), and begins again once they are done.
   What the cards do is to come (game.js ARCADE): for now they are picked, shown and kept (arcade.on.done).
   The cards are the shop's printed cards in metal (silver, gold, the prism - and here green and red for the vote and the
   debuffs) made as the menu's are, solid - a face with its edge showing towards the lower left (the light from the upper
   right, as on the desk) and a back - held up in perspective as they come in and turn over (style/76-play-arcade.css). */
const ARC_TIER = ['실버', '골드', '프리즘'];
const arcSvg = d => `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ARC_DOT = '<circle cx="24" cy="24" r="2.6" fill="currentColor" stroke="none"/>';
const ARC_ICO = {
  mode: arcSvg('<rect x="6" y="13" width="15" height="22" rx="3" transform="rotate(-14 13 24)"/><rect x="17" y="10" width="15" height="24" rx="3"/><rect x="28" y="13" width="15" height="22" rx="3" transform="rotate(14 35 24)"/><path d="M24.5 17l1.6 3.4 3.6.4-2.7 2.4.8 3.6-3.3-1.9-3.3 1.9.8-3.6-2.7-2.4 3.6-.4z" fill="currentColor" stroke="none"/>'),
  circle: arcSvg('<circle cx="24" cy="24" r="17"/>' + ARC_DOT),
  bumpy: arcSvg('<path d="M9 14l7 3 5-6 6 5 7-4 4 8-3 6 5 7-6 5-6-3-5 6-6-5-7 3-3-8 4-6z"/>' + ARC_DOT),
  penta: arcSvg('<path d="M24 6.5l17 12.4-6.5 20H13.5L7 18.9z"/>' + ARC_DOT),
  ice: arcSvg('<path d="M24 5v38M7.5 14.5l33 19M7.5 33.5l33-19M19 8l5 5 5-5M19 40l5-5 5 5"/>'),
  more: arcSvg('<circle cx="18" cy="28" r="10"/><path d="M36 8v14M29 15h14"/>'),
  fog: arcSvg('<path d="M6 16c4-4 8 4 12 0s8 4 12 0 8 4 12 0M6 26c4-4 8 4 12 0s8 4 12 0 8 4 12 0M6 36c4-4 8 4 12 0s8 4 12 0 8 4 12 0"/>'),
  heavy: arcSvg('<path d="M17 15a7 7 0 0 1 14 0"/><path d="M12 19h24l4 21H8z"/><path d="M24 25v8M20 29l4 4 4-4"/>'),
  narrow: arcSvg('<path d="M14 30a10 10 0 0 0 20 0"/><path d="M5 18l8 6M43 18l-8 6"/>'),
  flip: arcSvg('<path d="M8 17h28l-6-6M40 31H12l6 6"/>'),
  long: arcSvg('<circle cx="10" cy="38" r="5"/><path d="M15 33l4-4M23 25l4-4M31 17l4-4M39 9l2-2"/>'),
  wide: arcSvg('<path d="M12 28a12 12 0 0 0 24 0"/><path d="M12 16l-7-5M36 16l7-5"/>'),
  power: arcSvg('<path d="M27 4L11 27h12l-3 17 17-24H25z"/>'),
  steady: arcSvg('<circle cx="24" cy="24" r="15"/><path d="M24 4v10M24 34v10M4 24h10M34 24h10"/>' + ARC_DOT),
  again: arcSvg('<path d="M38 24a14 14 0 1 1-4.1-9.9"/><path d="M36 6v9h-9"/>'),
  magnet: arcSvg('<path d="M12 8v16a12 12 0 0 0 24 0V8"/><path d="M12 15h7M29 15h7M19 8v16a5 5 0 0 0 10 0V8"/>'),
  charge: arcSvg('<rect x="7" y="14" width="30" height="20" rx="4"/><path d="M41 21v6M24 17l-6 8h6l-2 6 7-9h-6z"/>'),
  double: arcSvg('<circle cx="18" cy="24" r="11"/><circle cx="30" cy="24" r="11"/>'),
  split: arcSvg('<circle cx="12" cy="33" r="7"/><circle cx="36" cy="33" r="7"/><path d="M24 6v10M24 16l-9 9M24 16l9 9"/>'),
};

// the game's state of these, with the online game it belongs to (null: not this mode)
const arcade = {
  on: null,
  begin(o) {
    arcade.close();
    arcade.on = { o, shape: null, votes: null, voted: [false, false], mine: null, voteIn: null, done: [], shown: 0, sent: {}, view: null, resume: false, tick: 0, later: [] };
  },
  close() { const a = arcade.on; if (a) { clearInterval(a.tick); a.later.forEach(clearTimeout); } arcade.on = null; arcFxClose(true); },
  live() { const a = arcade.on; return a && ranked.on === a.o && flow === match && st.screen === 'play' ? a : null; },
  // a turn about to begin: the vote, or a round due, first (true: the turn waits for them)
  hold(first) {
    const a = arcade.live(); if (!a || game.over) return false;
    if (!a.view && a.shape) { const k = ARCADE.due(match.innings, game.turn, a.shown); if (k) arcRound(a, k); }
    if (!a.view && !a.shape) arcVote(a);
    if (!a.view) return false;
    a.resume = a.resume || !!first; st.phase = 'idle'; st.auto = null; flow.hud(); scene.invalidate();
    return true;
  },
  // the room's word on coming in (54-ranked.js hear 'state'): what was missed, and a card sent here it never got, again
  sync(s) {
    const a = arcade.on; if (!a || !s) return;
    a.done = (s.done || []).map(x => x.slice());
    if (s.shape) { if (!a.shape) arcade.hear({ t: 'shape', id: s.shape, votes: s.votes }); }
    else {
      a.voted = (s.voted || [false, false]).slice(); if (s.voteIn != null && !a.view) a.voteIn = s.voteIn;
      if (a.mine && !s.mine) ranked.send({ t: 'vote', id: a.mine });
      arcFoot(a);
    }
    const v = a.view;
    if (v && v.kind === 'round') {
      if (a.done[v.k - 1]) arcade.hear({ t: 'picks', round: v.k, ids: a.done[v.k - 1] });
      else if (v.mine && s.open && s.open.k === v.k && !s.open.mine) ranked.send({ t: 'pick', round: v.k, id: v.mine });
    }
  },
  hear(m) {
    const a = arcade.on; if (!a) return;
    const me = a.o.seat, v = a.view;
    if (m.t === 'voted') { a.voted[m.seat] = true; arcFoot(a); }
    else if (m.t === 'picked') { if (v && v.kind === 'round' && m.round === v.k) { v.them = true; arcFoot(a); } }
    else if (m.t === 'shape') {
      if (a.shape) return;
      a.shape = m.id; a.votes = m.votes || [m.id, m.id];
      if (v && v.kind === 'vote' && v.ready) arcVoteReveal(a);       // (not yet dealt: the deal reveals it)
    } else if (m.t === 'picks') {
      a.done[m.round - 1] = m.ids.slice();
      if (v && v.kind === 'round' && v.k === m.round && v.ready && !v.revealed) arcRoundReveal(a, m.ids[me], m.ids[1 - me]);
    }
  },
};
const arcAfter = (a, ms, f) => { const t = setTimeout(() => { a.later = a.later.filter(x => x !== t); if (arcade.on === a) f(); }, ms); a.later.push(t); };

/* ---------- the focus behind the cards: the frame as it is, blurred out from the middle and darkened at the edges ---------- */
function arcFxOpen(then) {
  let fx = $('#arcFx');
  if (!fx) { fx = el('div', { id: 'arcFx', 'aria-live': 'polite' }, [el('canvas', { class: 'fx-blur', 'aria-hidden': 'true' }), el('i', { class: 'fx-vig', 'aria-hidden': 'true' }), el('div', { class: 'fx-stage' })]); app.appendChild(fx); }
  clearTimeout(fx._gone); fx.classList.remove('out');
  let done = false;
  const go = src => { if (done) return; done = true; arcBlur(fx.querySelector('.fx-blur'), src); void fx.offsetWidth; fx.classList.add('in'); then(fx.querySelector('.fx-stage')); };
  if (fx.classList.contains('in')) return go(null);              // (already up: keep the picture it has)
  scene.grab(go); setTimeout(() => go(null), 700);               // (the next frame drawn - or, none coming, the dark alone)
}
// (a third of the screen's size: the averaging of 14 slightly larger copies about the middle is the radial blur; drawn once)
function arcBlur(out, src) {
  if (!src) return;
  const W = Math.max(2, Math.round(innerWidth / 3)), H = Math.max(2, Math.round(innerHeight / 3)); out.width = W; out.height = H;
  const a = document.createElement('canvas'); a.width = W; a.height = H; a.getContext('2d').drawImage(src, 0, 0, W, H);
  const g = out.getContext('2d'), N = 14;
  for (let i = 0; i < N; i++) { const s = 1 + i * 0.018; g.globalAlpha = 1 / (i + 1); g.drawImage(a, (W - W * s) / 2, (H - H * s) / 2, W * s, H * s); }
  g.globalAlpha = 1;
}
function arcFxClose(now) {
  const fx = $('#arcFx'); if (!fx) return;
  if (now) return fx.remove();
  fx.classList.remove('in'); fx.classList.add('out'); fx._gone = setTimeout(() => fx.remove(), 520);
}

/* ---------- a card ---------- */
function arcCard(id, kind, i) {
  const c = ARCADE.card(id), tier = kind === 'buff' ? c.tier : null;
  const ico = el('span', { class: 'ac-ico', 'aria-hidden': 'true' }); ico.innerHTML = ARC_ICO[id] || '';
  return el('button', { class: `ac ${kind}` + (tier != null ? ' t' + tier : ''), 'data-id': id, 'aria-label': `${c.name}: ${c.d}`, style: `--i:${i || 0}` }, [
    el('i', { class: 'ac-shd', 'aria-hidden': 'true' }),
    el('span', { class: 'ac-body' }, [el('span', { class: 'ac-back', 'aria-hidden': 'true' }, el('i')),
      el('span', { class: 'ac-face' }, el('span', { class: 'ac-print' }, [el('em', { text: kind === 'shape' ? '테이블' : kind === 'debuff' ? '디버프' : ARC_TIER[tier] }), ico, el('b', { text: c.name }), el('small', { text: c.d }), el('span', { class: 'ac-sh' })]))]),
    el('span', { class: 'ac-pins' })]);
}
// the head over the cards: what this is, what to do, and the clock (a ring running down, the seconds in it)
function arcHead(stage, kind, title, ms) {
  const ring = ms ? el('span', { class: 'fx-clock', style: `--t:${ms}ms` }, [el('i'), el('b', { text: String(Math.ceil(ms / 1000)) })]) : null;
  stage.replaceChildren(el('div', { class: 'fx-head' }, [el('span', { class: 'fx-kind ' + kind, text: { shape: '테이블 투표', debuff: '증강 · 디버프', buff: '증강' }[kind] }), el('b', { class: 'fx-title', text: title }), ring]),
    el('div', { class: 'fx-row' }), el('div', { class: 'fx-foot' }));
}
const arcTitle = t => { const b = $('#arcFx .fx-title'); if (b) b.textContent = t; };
const arcClockDone = () => { const c = $('#arcFx .fx-clock'); if (c) c.classList.add('done'); };
function arcFoot(a) {
  const f = $('#arcFx .fx-foot'), v = a.view; if (!f || !v) return;
  const them = v.kind === 'vote' ? a.voted[1 - a.o.seat] : !!v.them, mine = v.kind === 'vote' ? !!a.mine : !!v.mine;
  f.replaceChildren(v.revealed ? '' : el('span', { class: 'fx-them' + (them ? ' on' : '') }, [el('i'), el('span', { text: them ? (v.kind === 'vote' ? '상대 투표 완료' : '상대 선택 완료') : mine ? '상대를 기다리는 중' : '상대가 고르는 중' })]));
}
// a card taken: to the middle of the row, raised; the others away
// (by its place in the row, not the screen: the cards are turned in perspective - every card as wide, the gap between equal)
const arcCenter = (row, card) => {
  const cs = [...row.children], i = cs.indexOf(card), gap = parseFloat(getComputedStyle(row).columnGap) || 0;
  card.style.setProperty('--gx', (-(i - (cs.length - 1) / 2) * (card.offsetWidth + gap)).toFixed(1) + 'px');
};
function arcTake(row, card) {
  arcCenter(row, card);
  card.classList.add('took');
  for (const o of row.querySelectorAll('.ac')) if (o !== card) o.classList.add('away');
}

/* ---------- the table's vote ---------- */
function arcVote(a) {
  const v = a.view = { kind: 'vote', revealed: false, end: 0 };
  // the table alone first (owner: "당구대 테이블 보여지게 갔다가 증강 카드뜨게")
  arcAfter(a, ARCADE.LEAD_MS, () => a.view === v && arcFxOpen(stage => {
    if (a.view !== v) return;
    v.ready = true;
    const ms = a.voteIn != null ? Math.max(1000, a.voteIn) : ARCADE.VOTE_MS; v.end = Date.now() + ms;
    arcHead(stage, 'shape', '마음에 드는 테이블에 투표하세요', ms);
    const row = stage.querySelector('.fx-row');
    ARCADE.shapes.forEach((S, i) => {
      const c = row.appendChild(arcCard(S.id, 'shape', i)); c.classList.add('deal');
      c.onclick = () => arcVoteFor(a, S.id);
    });
    arcFoot(a); SND.init(); SND.tap();
    a.tick = setInterval(() => {
      if (a.view !== v || v.revealed) return clearInterval(a.tick);
      const left = v.end - Date.now(), b = $('#arcFx .fx-clock b'); if (b) b.textContent = String(Math.max(0, Math.ceil(left / 1000)));
      if (left <= 0 && !a.mine) arcVoteFor(a, ARCADE.shapes[Math.floor(Math.random() * ARCADE.shapes.length)].id);
    }, 200);
    if (a.shape) arcVoteReveal(a);                                   // (decided while the table was shown alone)
  }));
}
function arcVoteFor(a, id) {
  if (a.mine || a.shape || !a.view || a.view.revealed) return;
  a.mine = id; SND.tap(); ranked.send({ t: 'vote', id });
  for (const c of document.querySelectorAll('#arcFx .ac')) { c.classList.toggle('mine', c.dataset.id === id); c.classList.toggle('dim', c.dataset.id !== id); }
  const p = $(`#arcFx .ac[data-id="${id}"] .ac-pins`); if (p) p.replaceChildren(el('span', { class: 'pin me', text: '나' }));
  arcTitle('투표했습니다'); arcFoot(a);
}
// both voted (or the time up): each one's card marked; two different, the light runs between them; then the table chosen
function arcVoteReveal(a) {
  const v = a.view; if (!v || v.revealed) return; v.revealed = true; clearInterval(a.tick); arcClockDone(); arcFoot(a);
  const me = a.o.seat, mine = a.votes[me], theirs = a.votes[1 - me], cands = mine === theirs ? [mine] : [mine, theirs];
  for (const c of document.querySelectorAll('#arcFx .ac')) {
    const id = c.dataset.id, pins = c.querySelector('.ac-pins');
    pins.replaceChildren(...[id === mine ? el('span', { class: 'pin me', text: '나' }) : null, id === theirs ? el('span', { class: 'pin them', text: '상대' }) : null].filter(Boolean));
    c.classList.remove('mine'); c.classList.toggle('dim', !cands.includes(id)); c.disabled = true;
  }
  arcTitle(cands.length > 1 ? '서로 달라서 둘 중 하나를 뽑습니다' : '같은 테이블을 골랐습니다');
  const won = a.shape, card = id => $(`#arcFx .ac[data-id="${id}"]`);
  let n = cands.length > 1 ? 9 + (cands.indexOf(won) === 1 ? 1 : 0) : 1, i = 0;
  const step = () => {
    if (a.view !== v) return;
    for (const id of cands) { const c = card(id); if (c) c.classList.toggle('lit', id === cands[i % cands.length]); }
    if (--n > 0) { i++; SND.tap(); arcAfter(a, 110 + (9 - n) * 18, step); return; }
    for (const c of document.querySelectorAll('#arcFx .ac')) { c.classList.remove('lit'); c.classList.toggle('out', c.dataset.id !== won); }
    { const row = $('#arcFx .fx-row'), c = card(won); if (row && c) { arcCenter(row, c); c.classList.add('won'); } }
    arcTitle(`${ARCADE.card(won).name} 테이블`); SND.good ? SND.good() : SND.tap();
    arcAfter(a, 1500, () => arcEnd(a));
  };
  arcAfter(a, 500, step);
}

/* ---------- an augments' round ---------- */
function arcRound(a, k) {
  const kind = ARCADE.kindOf(k), deal = ARCADE.deal(a.o.seed, k, a.o.seat), v = a.view = { kind: 'round', k, card: kind, deal, mine: null, them: false, revealed: false, end: 0 };
  arcFxOpen(stage => {
    if (a.view !== v) return;
    v.ready = true;
    if (a.done[k - 1]) { arcHead(stage, kind, '', 0); return arcRoundReveal(a, a.done[k - 1][a.o.seat], a.done[k - 1][1 - a.o.seat]); }
    v.end = Date.now() + ARCADE.PICK_MS;
    arcHead(stage, kind, kind === 'debuff' ? '상대에게 걸 카드를 고르세요' : '내 증강을 고르세요', ARCADE.PICK_MS);
    const row = stage.querySelector('.fx-row');
    deal.forEach((id, i) => { const c = row.appendChild(arcCard(id, kind, i)); c.classList.add('deal'); c.onclick = () => arcPick(a, id); });
    arcFoot(a); SND.init(); SND.tap();
    a.tick = setInterval(() => {
      if (a.view !== v || v.revealed) return clearInterval(a.tick);
      const left = v.end - Date.now(), b = $('#arcFx .fx-clock b'); if (b) b.textContent = String(Math.max(0, Math.ceil(left / 1000)));
      if (left <= 0 && !v.mine) arcPick(a, deal[Math.floor(Math.random() * deal.length)]);
    }, 200);
    if (a.done[k - 1]) arcRoundReveal(a, a.done[k - 1][a.o.seat], a.done[k - 1][1 - a.o.seat]);
  });
}
function arcPick(a, id) {
  const v = a.view; if (!v || v.kind !== 'round' || v.mine || v.revealed) return;
  v.mine = id; SND.tap(); ranked.send({ t: 'pick', round: v.k, id });
  const row = $('#arcFx .fx-row'), card = $(`#arcFx .ac[data-id="${id}"]`);
  if (row && card) { for (const c of row.querySelectorAll('.ac')) c.disabled = true; arcTake(row, card); }
  arcTitle(v.card === 'debuff' ? '상대에게 걸었습니다' : '골랐습니다'); arcFoot(a);
}
// both picked: mine and the other's side by side - the other's dealt face down and turned over - then back to the table
function arcRoundReveal(a, mine, theirs) {
  const v = a.view; if (!v || v.revealed) return; v.revealed = true; clearInterval(a.tick); arcClockDone(); arcFoot(a);
  const row = $('#arcFx .fx-row'); if (!row) return arcAfter(a, 400, () => arcEnd(a));
  const deb = v.card === 'debuff', pair = (id, i, label, cls) => el('div', { class: 'fx-pair ' + cls }, [arcCard(id, v.card, i), el('span', { class: 'fx-who', text: label })]);
  row.classList.add('two');
  row.replaceChildren(pair(mine, 0, deb ? '상대에게 건 카드' : '내 증강', 'mine'), pair(theirs, 1, deb ? '나에게 걸린 카드' : '상대의 증강', 'theirs deal'));
  for (const c of row.querySelectorAll('.ac')) c.disabled = true;
  arcTitle(deb ? '서로 디버프를 걸었습니다' : '증강을 골랐습니다');
  arcAfter(a, 2600, () => arcEnd(a));
}

// done: the cards away, the table back in focus, and the turn that waited begins
function arcEnd(a) {
  const v = a.view; if (!v) return;
  if (v.kind === 'round') a.shown = Math.max(a.shown, v.k);
  a.view = null; clearInterval(a.tick); arcFxClose(false);
  const first = a.resume; a.resume = false;
  if (arcade.live() === a && !game.over) beginTurn(first);
}

/* ---------- the ultimate's gauge (owner 11-12): the other's shots fill it more than one's own (ARCADE.ULT) ---------- */
function ultShot(g, who) { g[who] = Math.min(100, g[who] + ARCADE.ULT.mine); g[1 - who] = Math.min(100, g[1 - who] + ARCADE.ULT.theirs); }
function ultGauge(v, name) {
  const full = v >= 100;
  return el('div', { class: 'ultg' + (full ? ' full' : ''), role: 'meter', 'aria-label': `${name} 궁극기`, 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(v)) }, [
    el('span', { class: 'ultg-n', text: name }),
    el('span', { class: 'ultg-bar' }, [el('i', { style: `--v:${(v / 100).toFixed(3)}` }), ...[1, 2, 3, 4].map(k => el('b', { style: `left:${k * 20}%` }))]),
    el('span', { class: 'ultg-l', text: full ? '궁극기 준비' : '궁극기' })]);
}
