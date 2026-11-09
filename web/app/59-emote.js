/* ================= quick emotes in an online game =================
   As Ping Pong Fury has them (owner, 11-09): a key by the view keys opens six, chosen for the moment - the game just
   begun, the other player's good shot or miss, my own - and the one picked shows in a bubble under its sender's plate on
   both screens. Only between people online (ranked or a friend's room); the server passes on only the ids it knows
   (server/src/ranked.js EMOTES, the same list) and one a second and a half. */
const EMOTES = {
  hi: ['👋', '안녕하세요'], gl: ['🤝', '잘 부탁해요'], nice: ['👏', '나이스 샷!'], wow: ['😮', '와!'], lucky: ['🍀', '운 좋네요'],
  close: ['😬', '아깝다!'], oops: ['😅', '실수!'], think: ['🤔', '음…'], fire: ['🔥', '불붙었다'], cool: ['😎', '봤죠?'],
  thx: ['🙏', '고마워요'], gg: ['🤝', 'GG'], gj: ['👍', '잘 쳤어요'], lol: ['😂', 'ㅋㅋㅋ'], sad: ['😢', '아…'], sorry: ['🙇', '미안해요'],
};
const emote = {
  last: null,      // the last shot: { by: seat, good, foul }
  at: 0,           // when this device last sent one
  // the six for now: what fits the moment first, then a few that always do
  pick() {
    const o = ranked.on, me = o ? o.seat : 0, l = emote.last, near = game.players.some((p, i) => game.mode.target && p.score >= g8Target(i) - 1);
    if (!l) return ['hi', 'gl', 'cool', 'think', 'lol', 'sad'];
    const mine = l.by === me;
    if (near && !mine && l.good) return ['nice', 'gg', 'wow', 'lucky', 'think', 'sad'];
    if (mine) return l.good ? ['cool', 'fire', 'lol', 'think', 'wow', 'thx'] : l.foul ? ['sorry', 'oops', 'sad', 'lol', 'think', 'close'] : ['oops', 'sad', 'close', 'think', 'lol', 'wow'];
    return l.good ? ['nice', 'wow', 'lucky', 'gj', 'think', 'lol'] : l.foul ? ['thx', 'close', 'cool', 'think', 'lol', 'sad'] : ['close', 'cool', 'think', 'lol', 'wow', 'sad'];
  },
  // the key: there only in an online game being played
  sync() {
    const b = $('#emoteBtn'); if (!b) return;
    const on = !!(ranked.on && !ranked.on.done && flow === match && st.screen === 'play');
    b.hidden = !on; if (!on) emote.close();
  },
  open() {
    if (emote.box) return emote.close();
    const box = el('div', { id: 'emoteBox', role: 'menu', 'aria-label': '이모티콘' }, emote.pick().map(id => el('button', { class: 'emo', role: 'menuitem', 'aria-label': EMOTES[id][1], onclick: e => { e.stopPropagation(); emote.send(id); } },
      [el('i', { text: EMOTES[id][0] }), el('span', { text: EMOTES[id][1] })])));
    $('#app').appendChild(box); emote.box = box;
    const r = $('#emoteBtn').getBoundingClientRect(), W = innerWidth, bw = box.offsetWidth;
    box.style.left = Math.max(8, Math.min(W - bw - 8, r.left + r.width / 2 - bw / 2)) + 'px'; box.style.top = (r.bottom + 10) + 'px';
    setTimeout(() => document.addEventListener('pointerdown', emote.outside, true), 0);
  },
  outside(e) { if (emote.box && !emote.box.contains(e.target) && e.target.closest('#emoteBtn') == null) emote.close(); },
  close() { if (emote.box) { emote.box.remove(); emote.box = null; } document.removeEventListener('pointerdown', emote.outside, true); },
  send(id) {
    emote.close();
    const now = Date.now(); if (now - emote.at < 1600) return; emote.at = now;
    SND.tap(); ranked.send({ t: 'emote', id }); emote.show(ranked.on ? ranked.on.seat : 0, id);
  },
  // from the other device
  got(m) { if (EMOTES[m.id] && ranked.on) emote.show(1 - ranked.on.seat, m.id); },
  // the bubble under that seat's plate, a few seconds
  show(seat, id) {
    // (on the page, not in the plate: a plate clips what is in it)
    const pill = $('#p' + seat); if (!pill) return;
    const old = $('#emoBub' + seat); if (old) old.remove();
    const b = el('div', { id: 'emoBub' + seat, class: 'emo-bub' + (seat ? ' r' : ''), 'aria-live': 'polite' }, [el('i', { text: EMOTES[id][0] }), el('span', { text: EMOTES[id][1] })]);
    $('#app').appendChild(b);
    const r = pill.getBoundingClientRect(), bw = b.offsetWidth, x = seat ? r.right - bw - 6 : r.left + 6;
    b.style.left = Math.max(8, Math.min(innerWidth - bw - 8, x)) + 'px'; b.style.top = (r.bottom + 12) + 'px';
    setTimeout(() => b.classList.add('out'), 2600); setTimeout(() => b.remove(), 3000);
  },
  // (from the match: how the shot just played came out, for the next six)
  shot(by, r) { emote.last = { by, good: !!(r && !r.foul && (r.keep || r.pts > 0)), foul: !!(r && r.foul) }; },
  reset() { emote.last = null; emote.close(); },
};
// a carom player's points to reach (the scoreboard's goal), or nothing for pool
function g8Target(i) { return game.targets ? game.targets[i] : Infinity; }
$('#emoteBtn').addEventListener('click', e => { e.stopPropagation(); SND.tap(); emote.open(); });
