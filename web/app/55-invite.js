/* ================= 친구와 플레이 · 초대하기: a game with a friend on another device =================
   On the match's setup (33-desk-play.js) the way is picked: 한 기기에서 (one device, taking turns) or 초대하기. Inviting
   opens a code on the server (server/src/ranked.js InviteCore) - six letters and digits, with a link that carries it -
   and asks after it every two seconds; the friend enters the code (or opens the link) and both are in a room, played as
   a ranked game is (54-ranked.js, kind 'invite': the host's rules, coins as against the computer, no DAMA).
   The code stays open only while its screen is up. */
const INVITE_LINK = 'https://cue.oxcorp.workers.dev/?join=';
const invite = {
  host: null,                 // the open code: { code, mode, key (the rules it was opened with), timer, guest }
  shown: false,               // whether the setup screen showed it this paint (else it is closed: 36-desk-paint.js)
  opening: null,
  pw: '',                     // the room's password (방 생성하기: '' none) - asked of whoever takes it from the list
  title: '',                  // the room's name ('' - the server's '닉네임의 방')
  size: 2,                    // 1:1 (2) or 2:2 (4) - the room's seats
  seated: null,               // 2:2, a friend's room this player sits in, waiting for its host to start: { code, seat, seats, timer }
  rooms: null,                // the list of open rooms (방 참가하기): { at, list, err, timer }
  rulesOf(mode) { return mode === 'three' ? { target: prefs.target, cushions: prefs.rule3 } : mode === 'four' ? Object.assign({ target: prefs.fourTarget }, prefs.finish ? { finish: finishPref() } : {}) : {}; },
  // the code for this game and these rules: kept, or (another game, other rules) a new one
  want(mode) {
    const key = mode + JSON.stringify(invite.rulesOf(mode)) + '|' + invite.pw + '|' + invite.title + '|' + invite.size, h = invite.host;
    if (h && h.key === key) return h;
    if (invite.opening === key) return null;
    if (invite.err && invite.errKey === key) return null;           // (it failed: not again on its own - the slate has 다시 시도)
    // (not left first: opened again, the server keeps the host's code and changes its rules - the code a friend was
    // given still works)
    if (h) { clearTimeout(h.timer); invite.host = null; }
    invite.opening = key;
    net.inviteOpen(mode, invite.rulesOf(mode), { listed: true, pw: invite.pw, title: invite.title, size: invite.size }).then(r => {
      if (invite.opening !== key) { if (r && r.ok) net.inviteLeave(r.code); return; }
      invite.opening = null;
      // (the slate says why, and offers to try again - it used to stay on '만드는 중' for good)
      if (!r || !r.ok) { invite.err = net.troubleText() || '서버 응답 없음'; invite.errKey = key; toast('방을 열지 못했습니다.', 'foul', 2200); if (st.screen === 'home') paintHome(); return; }
      invite.err = null;
      invite.host = { code: r.code, mode, key, timer: 0, guest: null, title: r.title || '', size: r.size || 2, seats: r.seats || null };
      invite.poll(); if (st.screen === 'home') paintHome();
    });
    return null;
  },
  poll(soon) {
    const h = invite.host; if (!h) return;
    clearTimeout(h.timer);
    h.timer = setTimeout(async () => {
      if (invite.host !== h) return;
      const r = await net.inviteAsk(h.code);
      if (invite.host !== h) return;
      if (r && r.ok && r.room) { h.guest = r.opp; if (st.screen === 'home') paintHome(); SND.good(); invite.host = null; setTimeout(() => ranked.found(r), 900); return; }
      if (r && !r.ok && r.why === 'gone') { invite.host = null; if (st.screen === 'home') paintHome(); return; }
      if (r && r.ok && r.seats && JSON.stringify(r.seats) !== JSON.stringify(h.seats)) { h.seats = r.seats; if (st.screen === 'home') paintHome(); }
      invite.poll();
    }, soon ? 0 : 2000);
  },
  leave() { invite.stand(); const h = invite.host; invite.opening = null; if (!h) return; clearTimeout(h.timer); invite.host = null; net.inviteLeave(h.code); },
  // a friend's code: into their game
  async join(code) {
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 6) return toast('코드는 여섯 글자입니다.', 'foul', 1800);
    if (invite.host && invite.host.code === code) return toast('내가 만든 코드입니다. 친구에게 보내 주세요.', '', 2200);
    toast('입장 중…', '', 1400);
    const r = await net.inviteJoin(code);
    if (r && r.ok && r.room) { invite.leave(); closeSheet(); return ranked.found(r); }
    if (r && r.ok && r.waiting && r.size === 4) { invite.leave(); return invite.sit(r); }
    toast(invite.why(r, '그런 코드의 방이 없습니다.'), 'foul', 2400);
  },
  why: (r, none) => !r ? '서버 응답 없음' : r.why === 'update' ? '업데이트 후 참가할 수 있습니다.' : r.why === 'taken' || r.why === 'playing' ? '이미 시작한 방입니다.' : r.why === 'not playing' ? '아직 시작하지 않은 방입니다.' : r.why === 'full' ? '관전 자리가 다 찼습니다.'
    : r.why === 'your own code' ? '내가 만든 방입니다.' : r.why === 'away' ? '방장이 잠시 자리를 비웠습니다.' : r.why === 'wrong password' ? '비밀번호가 맞지 않습니다.' : r.why === 'locked' ? '비밀번호를 너무 많이 틀렸습니다 · 코드로 참가하세요' : none,
  /* 방 참가하기 (33-desk-play.js, the hall): the open rooms, asked again every four seconds while the hall is shown - each
     drawn as a table; one is taken by its id, with the password if it has one */
  listRooms() {
    const R = invite.rooms || (invite.rooms = { at: 0, list: null, err: null, timer: 0 });
    clearTimeout(R.timer);
    net.inviteList().then(r => {
      if (invite.rooms !== R) return;
      R.at = Date.now(); R.err = r && r.ok ? null : net.troubleText() || '서버 응답 없음'; if (r && r.ok) R.list = r.rooms || [];
      if (st.screen === 'home' && playStep === 'halls') paintHome();
      R.timer = setTimeout(() => { if (invite.rooms === R && playStep === 'halls' && st.screen === 'home') invite.listRooms(); else invite.rooms = null; }, 4000);
    });
  },
  stopRooms() { if (invite.rooms) clearTimeout(invite.rooms.timer); invite.rooms = null; },
  async take(room, pw) {
    if (invite.host) invite.leave();
    toast('입장 중…', '', 1400);
    const r = await net.inviteJoinId(room.id, pw);
    if (r && r.ok && r.room) { invite.stopRooms(); closeSheet(); return ranked.found(r); }
    if (r && r.ok && r.waiting && r.size === 4) { invite.stopRooms(); return invite.sit(r); }
    if (r && r.why === 'wrong password' && room.lock) return invite.sheetPw(room, true);
    toast(invite.why(r, '방이 닫혔습니다.'), 'foul', 2400); if (invite.rooms) invite.listRooms();
  },
  /* 2:2: the host's seats - the computer put in an empty one, or taken out - and the start, once all four are filled */
  async bot(seat, on) {
    const h = invite.host; if (!h) return;
    const r = await net.inviteBot(h.code, seat, on ? Math.min(3, prefs.level || 2) : -1);
    if (r && r.ok) { h.seats = r.seats; repaint(); } else toast(invite.why(r, '자리를 바꾸지 못했습니다.'), 'foul', 2000);
  },
  async start() {
    const h = invite.host; if (!h || h.starting) return; h.starting = true;
    const r = await net.inviteStart(h.code); h.starting = false;
    if (r && r.ok && r.room) { clearTimeout(h.timer); invite.host = null; SND.good(); return ranked.found(r); }
    toast(r && r.why === 'not full' ? '빈자리가 있습니다' : invite.why(r, '시작하지 못했습니다.'), 'foul', 2000);
  },
  /* 2:2, seated in a friend's room: the four seats, until its host starts - asked every two seconds; getting up leaves */
  sit(r) {
    const S = invite.seated = { code: r.code, seat: r.seat, seats: r.seats, timer: 0 };
    invite.sheetSeats();
    const ask = () => { S.timer = setTimeout(async () => {
      if (invite.seated !== S) return;
      const q = await net.inviteAsk(S.code);
      if (invite.seated !== S) return;
      if (q && q.ok && q.room) { invite.seated = null; closeSheet(); SND.good(); return ranked.found(q); }
      if (!q || !q.ok) { invite.seated = null; closeSheet(); return toast('방이 닫혔습니다.', 'foul', 2200); }
      if (JSON.stringify(q.seats) !== JSON.stringify(S.seats)) { S.seats = q.seats; S.seat = q.seat; invite.sheetSeats(); }
      ask();
    }, 2000); };
    ask();
  },
  stand() { const S = invite.seated; if (!S) return; clearTimeout(S.timer); invite.seated = null; net.inviteLeave(S.code); },
  // the seats as rows: the side, who sits there (or empty), and for the host a key to put the computer in or take it out
  seatRows(seats, me, host) {
    return seats.map((q, i) => el('div', { class: 'dk-row seat' + (i % 2 ? ' b' : ' a') + (i === me ? ' me' : '') }, [
      el('span', { class: 'dk-txt' }, [el('i', { class: 'side', text: i % 2 ? 'B' : 'A' }), document.createTextNode(q ? (q.bot != null ? `컴퓨터 · ${LEVELS[q.bot] || ''}` : q.name + (i === me ? ' (나)' : '')) : '빈자리')]),
      host && i > 0 && (!q || q.bot != null) ? el('button', { class: 'dk-chip', text: q ? '빼기' : '컴퓨터', onclick: onTap(() => invite.bot(i, !q)) }) : null]));
  },
  sheetSeats() {
    const S = invite.seated; if (!S) return;
    openSheet('2:2 · 대기', [el('div', { class: 'seats' }, invite.seatRows(S.seats, S.seat, false)),
      flatBtn('나가기', () => { invite.stand(); closeSheet(); })]);
  },
  // a game being played, from the list: watched (with the password if the room has one)
  async watch(room, pw) {
    if (invite.host) invite.leave();
    toast('관전 입장 중…', '', 1400);
    const r = await net.inviteWatch(room.id, pw);
    if (r && r.ok && r.watch) { invite.stopRooms(); closeSheet(); return ranked.watch(Object.assign({}, room, r)); }
    if (r && r.why === 'wrong password' && room.lock) return invite.sheetPw(room, true, true);
    toast(invite.why(r, '경기가 끝났습니다.'), 'foul', 2400); if (invite.rooms) invite.listRooms();
  },
  // the room's name: the host's own words, or '' for the server's '닉네임의 방'
  sheetTitle() {
    const input = el('input', { class: 'txt', maxlength: '16', placeholder: `${prefs.names[0]}의 방`, 'aria-label': '방 이름', autocomplete: 'off', spellcheck: 'false' }); input.value = invite.title;
    const go = () => { invite.title = input.value.replace(/\s+/g, ' ').trim().slice(0, 16); closeSheet(); repaint(); };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    openSheet('방 이름', [input, el('button', { class: 'btn cta', text: '정하기', onclick: () => { SND.tap(); go(); } })]);
    setTimeout(() => { try { input.focus(); input.select(); } catch (e) {} }, 60);
  },
  // a room with a password: asked before taking it; and the host's own, to set one
  sheetPw(room, wrong, watching) {
    const input = el('input', { class: 'txt code', maxlength: '8', inputmode: 'numeric', placeholder: '····', 'aria-label': '비밀번호', autocomplete: 'off', spellcheck: 'false' });
    const go = () => { const v = input.value.replace(/\D/g, ''); if (v.length < 4) return toast('비밀번호는 숫자 네 자리 이상입니다.', 'foul', 1800); if (room) (watching ? invite.watch : invite.take)(room, v); else { invite.pw = v; closeSheet(); repaint(); } };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    // (copy audit 02-11: the one who sets it - what it is for, short; the one who enters it - only the error)
    openSheet('방 비밀번호', [input, room ? (wrong ? note('비밀번호가 맞지 않습니다') : null) : note('숫자 4~8자리'),
      el('button', { class: 'btn cta', text: room ? (watching ? '관전하기' : '들어가기') : '정하기', onclick: () => { SND.tap(); go(); } })]);
    setTimeout(() => { try { input.focus(); } catch (e) {} }, 60);
  },
  copy(text, what) {
    const done = () => toast('복사 완료', 'good', 1400);
    try { if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(done, () => invite.copyOld(text, done)); } catch (e) {}
    invite.copyOld(text, done);
  },
  copyOld(text, done) {
    const t = el('textarea', { style: 'position:fixed;left:-999px;top:0;opacity:0' }); t.value = text; document.body.appendChild(t); t.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e) {} t.remove();
    if (ok) done(); else toast(text, '', 4000);
  },
  // the link: shared the phone's own way where it can (the share sheet), else copied
  share(code) {
    const url = INVITE_LINK + code, text = `CUE에서 한 판 할래? 참가 코드 ${code}`;
    if (navigator.share) { navigator.share({ title: 'CUE 초대', text, url }).catch(() => {}); return; }
    invite.copy(url, '초대 링크');
  },
  sheetJoin() {
    const input = el('input', { class: 'txt code', maxlength: '6', placeholder: '참가 코드 6자리', 'aria-label': '참가 코드', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false' });
    const go = () => invite.join(input.value);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    openSheet('코드로 참가', [input, note('영문·숫자 6자리'), el('button', { class: 'btn cta', text: '참가', onclick: () => { SND.tap(); go(); } })]);
    setTimeout(() => { try { input.focus(); } catch (e) {} }, 60);
  },
  // the tray while inviting: me ready with my cue, the friend's place waiting (or them, come), the code to give
  tray(stage, m) {
    const h = invite.host, cue = CUES[prefs.cues[0]] || CUES[0], g = h && h.guest;
    stage.dataset.win = '0';
    const slot = (who, sub, kids, cls) => el('div', { class: 'inv-slot' + (cls ? ' ' + cls : '') }, [el('div', { class: 'well' }, kids), el('b', { text: who }), el('small', { text: sub })]);
    dkPut(stage, el('div', { class: 'inv' }, [
      el('div', { class: 'inv-slots' }, [
        slot(prefs.names[0], '', [el('i', { class: 'ok', role: 'img', 'aria-label': '준비 완료' }), el('img', { class: 'cue', src: `ui/cue-${cue.id}.webp`, alt: '' }), ballPic(prefs.ballSkin, m === 'three' || m === 'four' ? 'carom' : 'pool', 0, { class: 'ball' })]),
        slot(g ? g.name : '친구', g ? '입장 완료' : '친구 기다리는 중', [el('i', { class: 'ghost-cue' }), el('i', { class: 'ghost-ball' })], g ? 'come' : 'wait')]),
      // (copy audit 02-06, 02-08: the code once, with a badge saying the room is in the list and a copy icon)
      el('div', { class: 'inv-code' }, [el('span', { text: '참가 코드' }), el('b', { text: h ? h.code : '······' }), h ? el('em', { class: 'pub', text: invite.pw ? '공개 · 비밀번호' : '공개' }) : null,
        (() => { const b = el('button', { class: 'cp', disabled: h ? null : '', 'aria-label': '참가 코드 복사', onclick: onTap(() => h && invite.copy(h.code, '참가 코드')) }); b.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>'; return b; })()])]));
  },
};
// opened by an invite link (?join=CODE): into that game, and the link taken off the address
(() => {
  let code = null; try { code = new URLSearchParams(location.search).get('join'); } catch (e) {}
  if (!code) return;
  try { history.replaceState(null, '', location.pathname); } catch (e) {}
  setTimeout(() => invite.join(code), 1200);
})();
// back to the page (another tab, the app in the background): ask after the open code at once - a hidden page cannot ask,
// and the server keeps the code only while the host is seen (server/src/ranked.js INVITE_IDLE, INVITE_KEEP)
document.addEventListener('visibilitychange', () => { if (!document.hidden && invite.host) invite.poll(true); if (!document.hidden && invite.rooms) invite.listRooms(); });
