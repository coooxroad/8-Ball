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
  // (owner 11-17: the same moment now and then shows another face of the same mood - two or three to a mood, the first
  // most of the time; still six to pick from)
  grin2: ['환하게 웃는 얼굴'], grin3: ['눈 감고 웃는 얼굴'], joy2: ['데굴데굴 웃음'], wow3: ['머리가 터지는 얼굴'], cool2: ['씩 웃는 얼굴'],
  think2: ['외알 안경'], sad2: ['펑펑 우는 얼굴'], sad3: ['시무룩한 얼굴'], angry3: ['욕하는 얼굴'], love2: ['하트에 둘러싸인 얼굴'],
  sweat2: ['이를 드러낸 얼굴'], sweat3: ['식은땀'], wink2: ['메롱 윙크'], sleepy2: ['하품'], thumbs2: ['박수'], fire2: ['100점'],
  fire3: ['쾅'], poop2: ['광대'], party2: ['색종이 공'], party3: ['파티 얼굴'], skull2: ['유령'], heart2: ['반짝이는 하트'], heart3: ['불타는 하트'],
};
const EMOTE_ALT = { grin: ['grin2', 'grin3'], joy: ['joy2'], wow: ['wow3'], cool: ['cool2'], think: ['think2'], sad: ['sad2', 'sad3'], angry: ['angry3'],
  love: ['love2'], sweat: ['sweat2', 'sweat3'], wink: ['wink2'], sleepy: ['sleepy2'], thumbs: ['thumbs2'], fire: ['fire2', 'fire3'], poop: ['poop2'],
  party: ['party2', 'party3'], skull: ['skull2'], heart: ['heart2', 'heart3'] };
// a mood's face: its first, or now and then (about one in six) one of the others
const emoteOf = id => EMOTE_ALT[id] && Math.random() < 0.17 ? EMOTE_ALT[id][Math.floor(Math.random() * EMOTE_ALT[id].length)] : id;
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
    const box = el('div', { id: 'emoteBox', role: 'menu', 'aria-label': '이모티콘' }, emote.pick().map(emoteOf).map(id => {
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
    emote.answer(id);
  },
  /* A stand-in (a ranked game's computer player in a person's name) has a face too: now and then it sends one of its own
     after a shot - its good one, its miss, the other player's - and sometimes answers one sent to it, a moment later, as
     a person would. How often by its personality (51-people.js taunt: the playful and the brash more, the calm rarely).
     Only looks: Math.random, never the room's numbers that its shots are drawn from; nothing goes to the server. */
  standIn() { const o = ranked.on; return o && o.standIn && !o.watch && !o.team && !o.done ? o.standIn : null; },
  /* (owner 11-17: people spam them - the same one three times running - and send one out of nowhere; a stand-in does too,
     not often: about one in eight of its emotes is a run of two to four, and now and then one comes with no reason at all) */
  react(pool, chance) {
    const s = emote.standIn(); if (!s || Math.random() > chance || Date.now() - (emote.botAt || 0) < 7000) return;
    emote.botAt = Date.now(); const id = emoteOf(pool[Math.floor(Math.random() * pool.length)]), side = 1 - ranked.on.seat;
    const run = Math.random() < 0.13 ? 2 + Math.floor(Math.random() * 3) : 1, t0 = 700 + Math.random() * 1600;
    for (let k = 0; k < run; k++) setTimeout(() => { if (emote.standIn()) emote.show(side, k && Math.random() < 0.3 ? emoteOf(id.replace(/\d$/, '')) : id); }, t0 + k * (380 + Math.random() * 260));
  },
  random() { if (emote.standIn() && Math.random() < 0.035) emote.react(['grin', 'cool', 'sleepy', 'think', 'wink', 'poop', 'heart', 'party'], 1); },
  chatty() { const s = emote.standIn(), p = s && s.personality || {}; return 0.05 + (p.taunt || 0) * 0.22 + (p.id === 'impatient' || p.id === 'fidgety' ? 0.04 : 0); },
  answer(id) {
    id = id.replace(/\d$/, '');
    const p = (emote.standIn() || {}).personality || {}, brash = (p.taunt || 0) > 0.3;
    const back = { angry: brash ? ['joy', 'cool', 'wink'] : ['sweat', 'sad'], poop: brash ? ['poop', 'joy'] : ['sweat', 'think'], skull: brash ? ['joy', 'skull'] : ['sweat'],
      thumbs: ['thumbs', 'heart', 'cool'], heart: ['heart', 'love'], love: ['heart', 'wink'], joy: brash ? ['joy', 'poop'] : ['sweat', 'grin'] }[id] || ['grin', 'wink', 'thumbs'];
    emote.react(back, 0.25 + emote.chatty());
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
  shot(by, r) {
    emote.last = { by, good: !!(r && !r.foul && (r.keep || r.pts > 0)), foul: !!(r && r.foul) };
    const o = ranked.on; if (!emote.standIn()) return;
    if (game.over) return;                                    // (the result is on screen by then)
    const bot = by !== o.seat, l = emote.last, p = emote.standIn().personality || {}, brash = (p.taunt || 0) > 0.3;
    emote.random();
    if (bot) emote.react(l.good ? (brash ? ['cool', 'fire', 'wink', 'party'] : ['grin', 'cool']) : l.foul ? ['sweat', 'skull', 'angry'] : ['sweat', 'sad', 'think'], emote.chatty() * (l.good ? 0.8 : 1.1));
    else emote.react(l.good ? (brash ? ['wow', 'sweat', 'skull'] : ['thumbs', 'wow']) : l.foul ? (brash ? ['joy', 'wink'] : ['think']) : ['think', 'grin'], emote.chatty() * 0.7);
  },
  reset() { emote.last = null; emote.close(); },
};
// a carom player's points to reach (the scoreboard's goal), or nothing for pool
function g8Target(i) { return game.targets ? game.targets[i] : Infinity; }
$('#emoteBtn').addEventListener('click', e => { e.stopPropagation(); SND.tap(); emote.open(); });
