/* ================= quick emotes in an online game =================
   As Ping Pong Fury has them (owner, 11-09): a key by the view keys opens six, chosen for the moment - the game just
   begun, the other player's good shot or miss, my own - and the one picked pops up under its sender's plate on both
   screens. No words: emoji - Microsoft's Fluent Emoji, 3D (MIT license: ui/emoji/LICENSE-fluentui-emoji.txt, credited in
   설정 · 크레딧; owner 11-09), as pictures so they are the same on every device. Only between people online (ranked or a friend's
   room); the server passes on only the ids it knows (server/src/ranked.js EMOTES, the same list) and one a second and a
   half. */


// id: what it is (for the screen reader); its picture is ui/emoji/<id>.webp (128 px, from the Fluent Emoji 3D set)
const EMOTES = {
  grin: ['활짝 웃는 얼굴'], joy: ['기쁨의 눈물'], wow: ['놀란 얼굴'], cool: ['선글라스'], think: ['생각하는 얼굴'], sad: ['우는 얼굴'],
  angry: ['화난 얼굴'], love: ['하트 눈'], sweat: ['진땀'], wink: ['윙크'], sleepy: ['조는 얼굴'], thumbs: ['최고'], fire: ['불꽃'],
  poop: ['똥'], party: ['축하'], skull: ['해골'], heart: ['하트'],
};
const emSvg = id => `<img src="ui/emoji/${id}.webp" alt="" draggable="false" decoding="async">`;
// (loaded once at the start, so the first one shown is not waited for)
setTimeout(() => { for (const id of Object.keys(EMOTES)) { const i = new Image(); i.src = `ui/emoji/${id}.webp`; } }, 4000);

const emote = {
  last: null,      // the last shot: { by: seat, good, foul }
  at: 0,           // when this device last sent one
  // the six for now: what fits the moment first, then a couple that always do
  pick() {
    const o = ranked.on, me = o ? (o.team ? o.seat % 2 : o.seat) : 0, l = emote.last, near = game.players.some((p, i) => game.mode.target && p.score >= g8Target(i) - 1);
    if (!l) return ['grin', 'wink', 'cool', 'heart', 'think', 'party'];
    const mine = l.by === me;
    if (near && !mine && l.good) return ['thumbs', 'wow', 'heart', 'sad', 'skull', 'party'];
    if (mine) return l.good ? ['cool', 'fire', 'party', 'wink', 'joy', 'love'] : ['sweat', 'sad', 'angry', 'skull', 'poop', 'joy'];
    if (l.good) return ['thumbs', 'wow', 'fire', 'love', 'think', 'skull'];
    return l.foul ? ['joy', 'heart', 'wink', 'cool', 'poop', 'sleepy'] : ['joy', 'cool', 'sweat', 'wink', 'poop', 'sleepy'];
  },
  // the key: there only in an online game being played
  sync() {
    const b = $('#emoteBtn'); if (!b) return;
    const on = !!(ranked.on && !ranked.on.done && !ranked.on.watch && flow === match && st.screen === 'play');
    b.hidden = !on; if (!on) emote.close();
  },
  open() {
    if (emote.box) return emote.close();
    const box = el('div', { id: 'emoteBox', role: 'menu', 'aria-label': '이모티콘' }, emote.pick().map(id => {
      const b = el('button', { class: 'emo', role: 'menuitem', 'aria-label': EMOTES[id][0], onclick: e => { e.stopPropagation(); emote.send(id); } });
      b.innerHTML = emSvg(id); return b;
    }));
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
    SND.tap(); ranked.send({ t: 'emote', id }); emote.show(ranked.on ? Math.max(0, ranked.on.seat) % 2 : 0, id);
  },
  // from the other device
  got(m) { if (EMOTES[m.id] && ranked.on) emote.show(ranked.on.watch || ranked.on.team ? (m.seat | 0) % 2 : 1 - ranked.on.seat, m.id); },
  // the emoji under that seat's plate, a few seconds (on the page, not in the plate: a plate clips what is in it)
  show(seat, id) {
    const pill = $('#p' + seat); if (!pill) return;
    const old = $('#emoBub' + seat); if (old) old.remove();
    const b = el('div', { id: 'emoBub' + seat, class: 'emo-bub' + (seat ? ' r' : ''), role: 'img', 'aria-label': EMOTES[id][0] });
    b.innerHTML = emSvg(id);
    $('#app').appendChild(b);
    const r = pill.getBoundingClientRect(), bw = b.offsetWidth, x = seat ? r.right - bw - 10 : r.left + 10;
    b.style.left = Math.max(8, Math.min(innerWidth - bw - 8, x)) + 'px'; b.style.top = (r.bottom + 10) + 'px';
    setTimeout(() => b.classList.add('out'), 2600); setTimeout(() => b.remove(), 3000);
  },
  // (from the match: how the shot just played came out, for the next six)
  shot(by, r) { emote.last = { by, good: !!(r && !r.foul && (r.keep || r.pts > 0)), foul: !!(r && r.foul) }; },
  reset() { emote.last = null; emote.close(); },
};
// a carom player's points to reach (the scoreboard's goal), or nothing for pool
function g8Target(i) { return game.targets ? game.targets[i] : Infinity; }
$('#emoteBtn').addEventListener('click', e => { e.stopPropagation(); SND.tap(); emote.open(); });
