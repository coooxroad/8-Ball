/* ================= quick emotes in an online game =================
   As Ping Pong Fury has them (owner, 11-09): a key by the view keys opens six, chosen for the moment - the game just
   begun, the other player's good shot or miss, my own - and the one picked pops up under its sender's plate on both
   screens. No words: emoji, drawn here (the owner: "문구가 아니라 이모지 심볼, 정교하게 그려서" - the device's own emoji
   font differs from phone to phone, these are the same everywhere). Only between people online (ranked or a friend's
   room); the server passes on only the ids it knows (server/src/ranked.js EMOTES, the same list) and one a second and a
   half. */

// the shared paints, once in the page (each emoji names them)
(() => {
  const d = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  d.setAttribute('width', '0'); d.setAttribute('height', '0'); d.setAttribute('aria-hidden', 'true'); d.style.position = 'absolute';
  d.innerHTML = `<defs>
    <radialGradient id="emF" cx=".4" cy=".32" r=".78"><stop offset="0" stop-color="#fff3a6"/><stop offset=".38" stop-color="#ffd43b"/><stop offset=".82" stop-color="#f7a81c"/><stop offset="1" stop-color="#e48709"/></radialGradient>
    <radialGradient id="emR" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#ffb59a"/><stop offset=".4" stop-color="#ff6a45"/><stop offset=".85" stop-color="#e02c1a"/><stop offset="1" stop-color="#b3170e"/></radialGradient>
    <linearGradient id="emT" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d4f1ff"/><stop offset="1" stop-color="#2f97ff"/></linearGradient>
    <radialGradient id="emB" cx=".38" cy=".3" r=".85"><stop offset="0" stop-color="#c08a56"/><stop offset=".55" stop-color="#8a5429"/><stop offset="1" stop-color="#5a3013"/></radialGradient>
    <radialGradient id="emH" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#ff9aa8"/><stop offset=".45" stop-color="#ff2f4f"/><stop offset="1" stop-color="#b80c2a"/></radialGradient>
    <radialGradient id="emK" cx=".4" cy=".3" r=".8"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#e9e4d9"/><stop offset="1" stop-color="#b7ae9d"/></radialGradient>
    <linearGradient id="emO" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#e8261a"/><stop offset=".55" stop-color="#ff6a1f"/><stop offset="1" stop-color="#ffa62b"/></linearGradient>
    <linearGradient id="emY" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff6b8"/><stop offset=".6" stop-color="#ffd42e"/><stop offset="1" stop-color="#ffb21f"/></linearGradient>
    <linearGradient id="emG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a3d45"/><stop offset="1" stop-color="#0d0e12"/></linearGradient>
    <linearGradient id="emC" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe066"/><stop offset="1" stop-color="#f08a00"/></linearGradient>
  </defs>`;
  document.body.appendChild(d);
})();
// the pieces faces are made of
const EM_FACE = (paint = 'emF', rim = '#d98200') => `<circle cx="32" cy="32" r="29" fill="url(#${paint})"/><circle cx="32" cy="32" r="28.6" fill="none" stroke="${rim}" stroke-opacity=".45" stroke-width="1.2"/><ellipse cx="22" cy="14.5" rx="11" ry="5.5" fill="#fff" opacity=".4" transform="rotate(-24 22 14.5)"/>`;
const EM_INK = '#4f2a0c', EM_MOUTH = '#5b230b';
const emEyes = (y = 26, ry = 5.2) => `<ellipse cx="23" cy="${y}" rx="3.3" ry="${ry}" fill="${EM_INK}"/><ellipse cx="41" cy="${y}" rx="3.3" ry="${ry}" fill="${EM_INK}"/><circle cx="24.2" cy="${y - ry * .45}" r="1.1" fill="#fff" opacity=".8"/><circle cx="42.2" cy="${y - ry * .45}" r="1.1" fill="#fff" opacity=".8"/>`;
const emLaugh = `<path d="M15.5 26.5Q22 19 28.5 26.5M35.5 26.5Q42 19 48.5 26.5" fill="none" stroke="${EM_INK}" stroke-width="3.4" stroke-linecap="round"/>`;
const emGrin = (y = 36) => `<path d="M15 ${y}Q32 ${y + 23} 49 ${y}Q32 ${y + 5} 15 ${y}Z" fill="${EM_MOUTH}"/><path d="M17.2 ${y + 1.1}Q32 ${y + 5.6} 46.8 ${y + 1.1}L45.6 ${y + 4.6}Q32 ${y + 8.6} 18.4 ${y + 4.6}Z" fill="#fff"/><path d="M24.5 ${y + 14.2}Q32 ${y + 9} 39.5 ${y + 14.2}Q32 ${y + 19} 24.5 ${y + 14.2}Z" fill="#ff6f7a"/>`;
const emDrop = (x, y, s = 1, flip = 1) => `<path transform="translate(${x} ${y}) scale(${s * flip} ${s})" d="M0 -9C-3 -3 -6 1 -6 4.5A6 6 0 0 0 6 4.5C6 1 3 -3 0 -9Z" fill="url(#emT)" stroke="#1f7ad6" stroke-opacity=".5" stroke-width=".8"/><ellipse transform="translate(${x} ${y})" cx="${-2.2 * flip * s}" cy="${3 * s}" rx="${1.3 * s}" ry="${2 * s}" fill="#fff" opacity=".75"/>`;
const emHeart = (x, y, s) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 9C-9 3 -12.5 -2 -12.5 -6.5C-12.5 -10.5 -9.5 -13 -6 -13C-3.5 -13 -1.5 -11.5 0 -9.5C1.5 -11.5 3.5 -13 6 -13C9.5 -13 12.5 -10.5 12.5 -6.5C12.5 -2 9 3 0 9Z" fill="url(#emH)"/><ellipse transform="translate(${x} ${y})" cx="${-5 * s}" cy="${-8 * s}" rx="${2.6 * s}" ry="${1.6 * s}" fill="#fff" opacity=".7"/>`;

// id: [what it is, for the screen reader; the drawing on 64 x 64]
const EMOTES = {
  grin: ['활짝 웃는 얼굴', EM_FACE() + emEyes(25) + emGrin(35)],
  joy: ['기쁨의 눈물', EM_FACE() + emLaugh + emGrin(33) + emDrop(10.5, 33, 1.05, -1) + emDrop(53.5, 33, 1.05)],
  wow: ['놀란 얼굴', EM_FACE() + `<path d="M16 16.5Q22 12 28 15.5M36 15.5Q42 12 48 16.5" fill="none" stroke="${EM_INK}" stroke-width="2.6" stroke-linecap="round"/>`
    + `<circle cx="23" cy="26" r="4.6" fill="${EM_INK}"/><circle cx="41" cy="26" r="4.6" fill="${EM_INK}"/><circle cx="24.5" cy="24.4" r="1.5" fill="#fff"/><circle cx="42.5" cy="24.4" r="1.5" fill="#fff"/>`
    + `<ellipse cx="32" cy="45" rx="6.4" ry="8.2" fill="${EM_MOUTH}"/><ellipse cx="32" cy="49.5" rx="4" ry="2.6" fill="#ff6f7a" opacity=".8"/>`],
  cool: ['선글라스', EM_FACE() + `<path d="M9 22.5H55L54 26.5H49.5Q49 36 40.5 36Q33.5 36 33 27.5H31Q30.5 36 23.5 36Q15 36 14.5 26.5H10Z" fill="url(#emG)"/>`
    + `<path d="M18 26.5L23 32M37 26.5L42 32" stroke="#fff" stroke-opacity=".35" stroke-width="2.2" stroke-linecap="round"/>`
    + `<path d="M21 45Q32.5 51.5 44.5 41" fill="none" stroke="${EM_MOUTH}" stroke-width="3.4" stroke-linecap="round"/>`],
  think: ['생각하는 얼굴', EM_FACE() + `<path d="M15.5 17.5Q21 12.5 27.5 15.5" fill="none" stroke="${EM_INK}" stroke-width="2.6" stroke-linecap="round"/><path d="M36.5 18.5H47" stroke="${EM_INK}" stroke-width="2.6" stroke-linecap="round"/>`
    + emEyes(26) + `<path d="M27 44.5L40 41.5" stroke="${EM_MOUTH}" stroke-width="3.2" stroke-linecap="round"/>`
    + `<rect x="25.5" y="33" width="7.4" height="18" rx="3.7" transform="rotate(38 29.2 42)" fill="url(#emC)" stroke="#c96f00" stroke-width="1.2"/>`
    + `<rect x="9.5" y="45" width="22" height="14" rx="6.5" transform="rotate(-10 20.5 52)" fill="url(#emC)" stroke="#c96f00" stroke-width="1.2"/>`
    + `<path d="M14.5 50.6L28 48.2M15.2 54.6L28.6 52.2" stroke="#c96f00" stroke-width="1.2" stroke-linecap="round" opacity=".7"/>`
    + `<rect x="13" y="42.4" width="15" height="6.2" rx="3.1" transform="rotate(-10 20.5 45.5)" fill="url(#emC)" stroke="#c96f00" stroke-width="1.2"/>`],
  sad: ['우는 얼굴', EM_FACE() + `<path d="M15 21Q20 20.5 26.5 16.5M37.5 16.5Q44 20.5 49 21" fill="none" stroke="${EM_INK}" stroke-width="2.6" stroke-linecap="round"/>`
    + emEyes(28, 4.6) + `<path d="M22 48.5Q32 39.5 42 48.5" fill="none" stroke="${EM_MOUTH}" stroke-width="3.4" stroke-linecap="round"/>` + emDrop(42.5, 40, 0.95)],
  angry: ['화난 얼굴', EM_FACE('emR', '#9c1208') + `<path d="M14.5 17.5L27.5 23.5M49.5 17.5L36.5 23.5" stroke="#5a0c06" stroke-width="3.6" stroke-linecap="round"/>`
    + `<ellipse cx="23" cy="29" rx="3.4" ry="4.4" fill="#5a0c06"/><ellipse cx="41" cy="29" rx="3.4" ry="4.4" fill="#5a0c06"/>`
    + `<path d="M21.5 48.5Q32 40 42.5 48.5" fill="none" stroke="#5a0c06" stroke-width="3.6" stroke-linecap="round"/>`],
  love: ['하트 눈', EM_FACE() + emHeart(22.5, 27, 0.78) + emHeart(41.5, 27, 0.78) + emGrin(37)],
  sweat: ['진땀', EM_FACE() + emLaugh + emGrin(35) + emDrop(49, 13, 1.1)],
  wink: ['윙크', EM_FACE() + `<ellipse cx="23" cy="26" rx="3.3" ry="5.2" fill="${EM_INK}"/><circle cx="24.2" cy="23.7" r="1.1" fill="#fff" opacity=".8"/>`
    + `<path d="M35.5 26.5Q41.5 22.5 47.5 26.5" fill="none" stroke="${EM_INK}" stroke-width="3.2" stroke-linecap="round"/>`
    + `<path d="M19.5 40Q32 53 44.5 40" fill="none" stroke="${EM_MOUTH}" stroke-width="3.4" stroke-linecap="round"/><path d="M33.5 46.5Q38 52.5 42 44.5Q38.5 47.5 33.5 46.5Z" fill="#ff6f7a"/>`],
  sleepy: ['조는 얼굴', EM_FACE() + `<path d="M16.5 27Q22.5 31.5 28.5 27M35.5 27Q41.5 31.5 47.5 27" fill="none" stroke="${EM_INK}" stroke-width="3" stroke-linecap="round"/>`
    + `<ellipse cx="32" cy="45" rx="4.2" ry="5" fill="${EM_MOUTH}"/>`
    + `<path d="M43 4.5H52L43 14H52M53 15H58.5L53 21H58.5" fill="none" stroke="#3b8cff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`],
  thumbs: ['최고', `<path d="M21.5 30.5C24.5 26.5 28 20 29 12.5C29.5 8.8 33.8 7.6 36 10.4C38.4 13.5 37.4 20.5 35.6 26.5H48.5C52.5 26.5 54.4 30.6 52.2 33.4C54.6 35.6 54 39.6 50.8 40.8C52.6 43.2 51.6 46.8 48.4 47.6C49.6 50.2 47.6 53.6 44.2 53.6H30C26.5 53.6 23.6 52.5 21.5 50.5Z" fill="url(#emC)" stroke="#c96f00" stroke-width="1.4" stroke-linejoin="round"/>`
    + `<path d="M36.8 33.4H51.6M37.4 40.7H50.2M36.8 47.6H47.8" fill="none" stroke="#c96f00" stroke-width="1.4" stroke-linecap="round" opacity=".7"/>`
    + `<rect x="9" y="28.5" width="12.5" height="27" rx="2.6" fill="#3b78e7"/><rect x="9" y="28.5" width="12.5" height="27" rx="2.6" fill="none" stroke="#1f4fae" stroke-width="1.2"/><path d="M12 31.5V52" stroke="#fff" stroke-opacity=".35" stroke-width="2" stroke-linecap="round"/>`
    + `<path d="M30 14.5Q31.5 12 33.6 12.4" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1.6" stroke-linecap="round"/>`],
  fire: ['불꽃', `<path d="M32 4.5C36.5 15 49 20 49 36.5C49 49 41.5 58.5 32 58.5C22.5 58.5 15 49.5 15 38C15 29.5 19.5 25 23 20.5C23.2 26.5 25.2 30 28.4 31C27 22 28.2 12.5 32 4.5Z" fill="url(#emO)"/>`
    + `<path d="M32.5 25C35 32.5 41.5 36 41.5 44.5C41.5 51 37.5 55.5 32 55.5C26.5 55.5 22.8 51.2 22.8 45.6C22.8 41.2 25 38.2 27.4 35.8C28.2 38.8 29.6 40.4 31.2 40.6C30 35 30.4 29.6 32.5 25Z" fill="url(#emY)"/>`
    + `<path d="M20.5 33Q19 38.5 21.5 44" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="2" stroke-linecap="round"/>`],
  poop: ['똥', `<path d="M19.5 27.6C19.6 22.2 24.4 19.4 29.4 19.6C30.4 14.2 33.8 10 39.2 8C37.4 12 38.2 15.2 41.2 17C45 19.2 46.4 23.2 44.4 27.4C43.4 29.6 40.6 30.8 37.4 30.8H26.4C22 30.8 19.4 30 19.5 27.6Z" fill="url(#emB)"/>`
    + `<path d="M13.4 38.2C13.4 31.6 18.6 28.4 23.8 28.4H40.4C45.6 28.4 50.6 31.6 50.6 38C50.6 43 46.4 45.4 41.2 45.4H22.8C17.6 45.4 13.4 43 13.4 38.2Z" fill="url(#emB)"/>`
    + `<path d="M7.6 50.2C7.6 42.4 14.6 39.6 20 39.6H44C49.4 39.6 56.4 42.4 56.4 50.2C56.4 56 50.6 58.6 44.4 58.6H19.6C13.4 58.6 7.6 56 7.6 50.2Z" fill="url(#emB)"/>`
    + `<path d="M24 22.4Q30 20.4 36 21.6M18.2 32.4Q30 29.4 45.4 31.8M12.6 44Q30 40.6 51.4 43.6" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="2" stroke-linecap="round"/>`
    + `<ellipse cx="25" cy="34.6" rx="4.6" ry="5.4" fill="#fff"/><ellipse cx="39" cy="34.6" rx="4.6" ry="5.4" fill="#fff"/><circle cx="25.8" cy="35.6" r="2.5" fill="#2a1406"/><circle cx="39.8" cy="35.6" r="2.5" fill="#2a1406"/>`
    + `<path d="M21.5 47.5Q32 57 42.5 47.5Q32 50.5 21.5 47.5Z" fill="#3a1606"/><path d="M27.5 51.6Q32 49.8 36.5 51.6Q32 54.4 27.5 51.6Z" fill="#ff6f7a"/>`],
  party: ['축하', `<path d="M8.5 57L21.5 24.5L41 44Z" fill="url(#emC)" stroke="#c96f00" stroke-width="1.3" stroke-linejoin="round"/>`
    + `<path d="M13.6 44.4L27.4 51M17.4 35L35.2 47.4M10.8 51.6L18 54.8" stroke="#ff4d6d" stroke-width="3" stroke-linecap="round"/>`
    + `<path d="M24 22Q30 10 26 4M30 27Q42 18 47 22M36 34Q48 30 56 37" fill="none" stroke-width="2.6" stroke-linecap="round" stroke="#3b8cff"/>`
    + `<path d="M40 8l2.2 4.6 5 .6-3.7 3.4 1 5-4.5-2.5-4.5 2.5 1-5-3.7-3.4 5-.6z" fill="#ffd23a"/>`
    + `<rect x="49" y="12" width="5" height="3.2" rx="1" fill="#2ecc71" transform="rotate(30 51.5 13.6)"/><rect x="52" y="26" width="5" height="3.2" rx="1" fill="#ff4d6d" transform="rotate(-25 54.5 27.6)"/><circle cx="34" cy="6" r="2.2" fill="#a463ff"/><circle cx="56" cy="46" r="2.2" fill="#ffd23a"/><circle cx="17" cy="14" r="2" fill="#2ecc71"/>`],
  skull: ['해골', `<path d="M32 7C46.5 7 54.5 17.4 54.5 29.6C54.5 37.6 50.6 42 46.4 44V51.8C46.4 55 44.2 57.2 41 57.2H23C19.8 57.2 17.6 55 17.6 51.8V44C13.4 42 9.5 37.6 9.5 29.6C9.5 17.4 17.5 7 32 7Z" fill="url(#emK)" stroke="#8f8676" stroke-width="1.2"/>`
    + `<path d="M17 31.6C17 26.4 21 24 25 24.4C29 24.8 31 28.4 30 32.4C29 36.4 25.6 38.4 22 37.6C19 37 17 34.6 17 31.6ZM47 31.6C47 26.4 43 24 39 24.4C35 24.8 33 28.4 34 32.4C35 36.4 38.4 38.4 42 37.6C45 37 47 34.6 47 31.6Z" fill="#26201a"/>`
    + `<path d="M32 38.6L35 44.4H29Z" fill="#26201a"/><path d="M26 48V56.6M32 48V57M38 48V56.6M21.5 48H42.5" stroke="#8f8676" stroke-width="1.6" stroke-linecap="round"/>`
    + `<ellipse cx="22" cy="14" rx="8.5" ry="4" fill="#fff" opacity=".7" transform="rotate(-22 22 14)"/>`],
  heart: ['하트', `<path d="M32 55.5C13.5 43 6.5 33 6.5 22.5C6.5 14.4 12.6 8.5 20 8.5C25.2 8.5 29.2 11.4 32 15.6C34.8 11.4 38.8 8.5 44 8.5C51.4 8.5 57.5 14.4 57.5 22.5C57.5 33 50.5 43 32 55.5Z" fill="url(#emH)"/>`
    + `<ellipse cx="18.5" cy="18.5" rx="6" ry="3.6" fill="#fff" opacity=".6" transform="rotate(-35 18.5 18.5)"/>`],
};
const emSvg = id => `<svg viewBox="0 0 64 64" aria-hidden="true">${EMOTES[id][1]}</svg>`;

const emote = {
  last: null,      // the last shot: { by: seat, good, foul }
  at: 0,           // when this device last sent one
  // the six for now: what fits the moment first, then a couple that always do
  pick() {
    const o = ranked.on, me = o ? o.seat : 0, l = emote.last, near = game.players.some((p, i) => game.mode.target && p.score >= g8Target(i) - 1);
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
    const on = !!(ranked.on && !ranked.on.done && flow === match && st.screen === 'play');
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
    SND.tap(); ranked.send({ t: 'emote', id }); emote.show(ranked.on ? ranked.on.seat : 0, id);
  },
  // from the other device
  got(m) { if (EMOTES[m.id] && ranked.on) emote.show(1 - ranked.on.seat, m.id); },
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
