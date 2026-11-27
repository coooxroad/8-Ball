/* ================= 친구 (owner 11-27): 닉네임#태그, requests both ways, a game started from the list =================
   The server keeps it all (server/src/friends-core.js; plan: project doc claude/cue-friends-plan.md). Here:
   - friends.tick: every few seconds, the list asked for while the desk shows (more often on 친구 itself), and while a game
     is played a small 'still here, playing this' now and then - the friends' lists show who is on and what they play;
   - the 친구 button on the top bar (a badge: requests and invitations come in) opens the place 'friends' on the desk
     (deskFriends, 36-desk-paint.js DESK_PLACES): the rail 친구 · 요청 · 친구 추가, the tray the list (a friend opened: their
     선수증, playerCard), the slate what can be done;
   - 같이 치기: 친구와 플레이 · 방 만들기 is opened for the game (its own screen chooses the game and the rules), and the
     room's code is sent to the friend as an invitation as soon as it is open - again if the code changes (invite.want);
   - an invitation come in shows over the desk (#frCall: 참가 · 거절) until it is two minutes old;
   - the result of an online game of two: 친구 추가 for the opponent (the room says who sat there - a stand-in's request is
     kept 7 days and goes, as one never taken: owner 11-27 (다));
   - a link ?friend=닉네임%231234 (shared from 친구 추가) opens the place with the request ready to send. */
const FR_LINK = 'https://danguuu.com/?friend=';
const friends = {
  data: null,        // the server's last list: { me: { nick, tag }, friends, recv, sent, blocked, inbox, now }
  key: '',           // what was painted from it (painted again only when it changes)
  skew: 0,           // the server's clock less this one's
  tab: 'list',       // the rail: 'list' | 'reqs' | 'add'
  open: null,        // the friend opened in the tray (acct)
  asked: 0, said: 0, // when the list was last asked for, and the last 'still here' from a game
  busy: false,
  pending: null,     // 같이 치기: { acct, nick, tag, sent: the code's key the invitation went with }
  gone: new Set(),   // invitations put away here (acct|code)
  seen: new Set(),   // invitations already sounded
  look() { const c = prefs.card || {}; let n = 0; try { n = attend.now().n; } catch (e) {} return { card: c.bg || null, title: c.title || null, streak: n }; },
  doing() { return st.screen === 'play' && typeof game !== 'undefined' && game && game.modeId ? String(game.modeId) : null; },
  async tick() {
    if (!net.on || document.hidden || friends.busy) return;
    const t = Date.now();
    if (st.screen === 'play') {
      friends.pending = null;                                         // (the game with them begun - or another: no more sending)
      if (t - friends.said < 60000) return;
      friends.said = t; friends.busy = true;
      try { await net.friendHi(friends.doing(), friends.look()); } finally { friends.busy = false; }
      return;
    }
    if (st.screen !== 'home') return;
    if (t - friends.asked < (deskTab === 'friends' ? 8000 : 20000)) return;
    await friends.ask();
  },
  async ask() {
    friends.asked = Date.now(); friends.busy = true;
    let r; try { r = await net.friends(null, friends.look()); } finally { friends.busy = false; }
    if (!r || !r.ok) return;
    friends.skew = (r.now || Date.now()) - Date.now();
    friends.data = r;
    const key = JSON.stringify(Object.assign({}, r, { now: 0, friends: r.friends.map(f => Object.assign({}, f, { seen: frState(f)[0] })) }));
    friendsBadge(); friendsCall();
    if (key !== friends.key) { friends.key = key; if (st.screen === 'home' && deskTab === 'friends') paintHome(); }
  },
  // each thing done: sent, the list asked for again, the desk painted
  async act(what, body, said) {
    if (!net.on) return toast('온라인에서만 할 수 있습니다.', '', 2000);
    const r = await net.friend(what, body);
    if (!r || !r.ok) { toast(frWhy(r), 'foul', 2200); return r; }
    if (said) toast(typeof said === 'function' ? said(r) : said, 'good', 1800);
    await friends.ask(); if (st.screen === 'home' && deskTab === 'friends') paintHome();
    return r;
  },
  // 같이 치기: 친구와 플레이 · 방 만들기 for them (the room's own screen picks the game); the code goes to them when open
  play(f) {
    if (!net.on) return toast('온라인에서만 할 수 있습니다.', '', 2000);
    // (the menu painted on the way leaves any open room first - invite.leave: the friend set after it)
    deskGo('play'); playFor = 'friend'; prefs.friendWay = 'invite'; invite.pw = ''; playStep = 'setup';
    friends.pending = { acct: f.acct, nick: f.nick, tag: f.tag, sent: null }; paintHome();
  },
  // the room's code open (55-invite.js, invite.want): the invitation sent with it, once for each code and rules
  hosted(h) {
    const p = friends.pending; if (!p || !h || !h.code || p.sent === h.key + h.code) return;
    p.sent = h.key + h.code;
    net.friend('invite', { acct: p.acct, code: h.code, mode: h.mode, rules: invite.rulesOf(h.mode) }).then(r => {
      if (r && r.ok) toast(`${p.nick}에게 초대를 보냈습니다`, 'good', 2000); else { p.sent = null; toast(frWhy(r), 'foul', 2000); }
    });
  },
  // the room given up (invite.leave): the invitation taken back
  unhosted() { const p = friends.pending; if (p && p.sent) net.friend('uninvite', { acct: p.acct }); friends.pending = null; },
};
// what the server's refusal means here
function frWhy(r) {
  if (!r) return '서버 응답 없음';
  return { 'no one': '그런 이름이 없습니다', 'bad name': '닉네임#태그로 입력하세요', self: '내 이름입니다', blocked: '차단한 사람입니다', full: '친구가 너무 많습니다 (100명)',
    'too many waiting': '기다리는 요청이 너무 많습니다', 'too many today': '오늘은 요청을 더 보낼 수 없습니다', 'not a friend': '친구가 아닙니다', 'no room': '상대를 찾지 못했습니다',
    'no name': '이름을 2~10자로 정해 주세요', 'try again': '잠시 뒤에 다시 해 주세요', 'no request': '요청이 사라졌습니다' }[r.why] || '하지 못했습니다';
}
const frHandle = f => (f && f.nick ? f.nick : '') + (f && f.tag ? '#' + f.tag : '');
// where a friend is: on, playing (what), or how long ago they were seen
function frState(f) {
  const ago = Date.now() + friends.skew - (f.seen || 0);
  if (!f.seen) return ['off', '접속 기록 없음'];
  if (f.doing && ago < 150000) return ['play', MODE_KO[f.doing] ? `경기 중 · ${MODE_KO[f.doing]}` : '연습 중'];
  if (ago < 90000) return ['on', '접속 중'];
  const m = Math.floor(ago / 60000);
  return ['off', m < 60 ? `${Math.max(1, m)}분 전` : m < 1440 ? `${Math.floor(m / 60)}시간 전` : m < 43200 ? `${Math.floor(m / 1440)}일 전` : '오래 전'];
}
const frRank = s => ({ on: 0, play: 1, off: 2 })[s];
// the top bar's badge: requests and invitations come in
function friendsBadge() {
  const b = $('#dkFriends .nb'); if (!b) return;
  const d = friends.data, n = d ? d.recv.length + d.inbox.filter(i => !friends.gone.has(i.acct + '|' + i.code)).length : 0;
  b.hidden = !n; b.textContent = n > 9 ? '9+' : String(n);
}
// a friend's row in the list: their tier's ball, name and tag, where they are - and whatever goes at its end
function frRow(f, end, tap) {
  const s = f.seen != null ? frState(f) : null, t = f.face && f.face.dama != null ? tierAt(f.face.dama) : null;
  // (one asked, not yet a friend: no face to show - a plain white ball)
  const kids = [t ? el('img', { class: 'fr-ball', src: `ui/tier-ball-${t.id}.webp`, alt: t.name }) : el('img', { class: 'fr-ball', src: 'ui/spin-ball.webp', alt: '' }),
    el('span', { class: 'fr-who' }, [el('b', null, [document.createTextNode(f.nick || '?'), el('i', { text: f.tag ? '#' + f.tag : '' })]),
      el('small', null, s ? [el('i', { class: 'dot ' + s[0] }), document.createTextNode(s[1])] : [document.createTextNode(t ? t.name : '')])]),
    ...[].concat(end || [])];
  return tap ? el('button', { class: 'fr-row' + (s ? ' ' + s[0] : ''), onclick: onTap(tap) }, kids) : el('div', { class: 'fr-row' + (s ? ' ' + s[0] : '') }, kids);
}
/* a friend in the list as their own 선수증, laid on its side (owner 11-27: the card to stand out): the tier's rim, paper and
   head band, the face they chose (bg-), their ball, name#tag, their title, where they are, the games between the two - and,
   cut in the rim's foot as on the glass case, CUE and their tag. The tier's look is 84-menu.css .mn-pc.t-*; the shape here. */
function frPc(f, tap) {
  const s = frState(f), t = tierAt(f.face && f.face.dama != null ? f.face.dama : ECONOMY.DAMA_START), bg = f.face && f.face.card && f.face.card !== 'tier' && CARD_BGS.some(q => q.id === f.face.card) ? f.face.card : null;
  const ttl = f.face && f.face.title && f.face.title !== 'none' ? TITLES.find(q => q.id === f.face.title) : null, n = (f.w || 0) + (f.l || 0) + (f.d || 0);
  return el('button', { class: `fr-pc mn-pc t-${t.id}` + (bg ? ` bg-${bg}` : '') + ' ' + s[0], 'aria-label': `${f.nick}#${f.tag}, ${t.name}, ${s[1]}`, onclick: onTap(tap) }, [
    el('span', { class: 'mn-face', 'aria-hidden': 'true' }),
    el('span', { class: 'hd' }, [el('span', { text: `선수증 · ${t.name}` }), el('i', { class: 'dot ' + s[0] })]),
    el('span', { class: 'fr-pb' }, [el('span', { class: 'em' }, el('b', { text: t.name })),
      el('span', { class: 'fr-pw' }, [el('b', { class: 'nm', text: f.nick }), el('small', { class: 'ttl', text: ttl ? ttl.name : `${t.name} · ${t.dama}` }),
        el('small', { class: 'fr-ps ' + s[0], text: s[1] })]),
      el('span', { class: 'fr-pr' }, [el('b', { text: n ? `${f.w || 0} : ${f.l || 0}` : '-' }), document.createTextNode('나와의 전적')])]),
    el('span', { class: 'fr-pf', 'aria-hidden': 'true' }, [el('b', { text: 'C U E' }), el('small', { text: '#' + f.tag })])]);
}
const frBtn = (t, fn, cls) => el('button', { class: 'dk-chip fr-b' + (cls ? ' ' + cls : ''), text: t, onclick: onTap(fn) });
const frSec = t => el('div', { class: 'dk-tier fr-sec' }, el('span', { text: t }));

/* ---- the place on the desk (36-desk-paint.js DESK_PLACES.friends) ---- */
function deskFriends(d) {
  d.stage.dataset.win = '0';
  const D = friends.data, has = !!D, n = k => (D ? D[k].length : 0);
  if (!has && net.on && !friends.busy) friends.ask();
  dkPut(d.rail, [railBtn(friends.tab === 'list', '친구', has ? String(n('friends')) : null, () => { friends.tab = 'list'; friends.open = null; paintHome(); }),
    railBtn(friends.tab === 'reqs', '요청', has && n('recv') ? `받은 요청 ${n('recv')}` : null, () => { friends.tab = 'reqs'; friends.open = null; paintHome(); }),
    railBtn(friends.tab === 'add', '친구 추가', null, () => { friends.tab = 'add'; friends.open = null; paintHome(); })]);
  if (!net.on) { dkPut(d.head, dkTitle('친구')); dkPut(d.slate, [...dkH1('친구'), dkHr(), dkTxt('온라인에서만 할 수 있습니다.')]); return; }
  if (!has) { dkPut(d.head, dkTitle('친구')); dkPut(d.stage, el('div', { class: 'fr-list' }, el('p', { class: 'fr-none', text: '불러오는 중…' }))); dkPut(d.slate, dkH1('친구')); return; }
  const f = friends.open && D.friends.find(x => x.acct === friends.open);
  if (friends.tab === 'list' && f) return frOpened(d, f);
  friends.open = null;
  ({ list: frList, reqs: frReqs, add: frAdd })[friends.tab](d, D);
}
function frList(d, D) {
  const list = D.friends.slice().sort((a, b) => frRank(frState(a)[0]) - frRank(frState(b)[0]) || (b.seen || 0) - (a.seen || 0));
  const on = list.filter(x => frState(x)[0] !== 'off').length;
  dkPut(d.head, dkTitle('친구', `${list.length}명${on ? ` · 접속 ${on}명` : ''}`));
  dkPut(d.stage, el('div', { class: 'fr-list' + (list.length ? ' fr-cards' : '') }, list.length ? list.map(x => frPc(x, () => { friends.open = x.acct; paintHome(); }))
    : [el('p', { class: 'fr-none', text: '아직 친구가 없습니다' }), frBtn('친구 추가', () => { friends.tab = 'add'; paintHome(); }, 'hi')]));
  dkPut(d.slate, [...dkH1(D.me.nick || '친구', D.me.tag ? `#${D.me.tag} · 내 이름` : null)]);
  if (!D.me.tag) dkPut(d.slate, [dkHr(), dkTxt('이름을 2~10자로 정하면 친구를 맺을 수 있습니다.')]);
  dkPut(d.slate, dkActs(dkSec('친구 추가', () => { friends.tab = 'add'; paintHome(); })));
}
// one friend opened: their 선수증 in the tray, the two's record and what can be done on the slate
function frOpened(d, f) {
  const s = frState(f), w = f.w || 0, l = f.l || 0, dr = f.d || 0, t = tierAt(f.face.dama != null ? f.face.dama : ECONOMY.DAMA_START);
  d.head.className = 'dk-head open';
  dkPut(d.head, [el('button', { class: 'dk-x', 'aria-label': '친구 목록으로', onclick: () => { SND.tap(); friends.open = null; paintHome(); } }, el('i')), dkTitle(f.nick)]);
  const card = playerCard({ dama: t.dama, name: f.nick, sub: '#' + f.tag, av: [...(f.nick || '?')][0], bg: f.face.card, title: f.face.title, bar: false,
    stats: [['함께 친 판', w + l + dr], ['내 승', w], ['내 패', l]] });
  const box = el('div', { class: 'fr-big' }, card); dkPut(d.stage, box); frFit(box);
  dkPut(d.slate, [...dkH1(f.nick, '#' + f.tag), el('div', { class: 'fr-st ' + s[0] }, [el('i', { class: 'dot ' + s[0] }), document.createTextNode(s[1])]), dkHr(),
    el('div', { class: 'dk-spec' }, [el('span', { text: '등급' }), el('b', { text: `${t.name} · ${t.dama}` })]),
    el('div', { class: 'dk-spec' }, [el('span', { text: '나와의 전적' }), el('b', { text: w + l + dr ? `${w}승 ${l}패${dr ? ` ${dr}무` : ''}` : '아직 없음' })]),
    f.face.streak ? el('div', { class: 'dk-spec' }, [el('span', { text: '연속 출석' }), el('b', { text: `${f.face.streak}일` })]) : null]);
  // (삭제 · 차단 small under the record; the slate's foot only 같이 치기 - three keys did not fit a phone's slate)
  dkPut(d.slate, el('div', { class: 'fr-more' }, [
    frBtn('친구 삭제', () => frSure(`${f.nick}을(를) 친구에서 삭제할까요?`, '삭제', () => { friends.open = null; friends.act('remove', { acct: f.acct }, '삭제했습니다'); })),
    frBtn('차단', () => frSure(`${f.nick}을(를) 차단할까요? 친구에서 삭제되고, 요청과 초대가 오지 않습니다.`, '차단', () => { friends.open = null; friends.act('block', { acct: f.acct }, '차단했습니다'); }))]));
  dkPut(d.slate, dkActs(dkMain('같이 치기', null, () => friends.play(f))));
}
// the card as large as the tray lets it be (its parts are sized by --u: 84-menu.css .mn-pc, 244 × 560)
function frFit(box) {
  const go = () => { if (!box.isConnected) return; const W = box.clientWidth, H = box.clientHeight; if (!W || !H) return requestAnimationFrame(go);
    box.style.setProperty('--u', Math.min(H * 0.9 / 560, W * 0.8 / 244).toFixed(3)); };
  requestAnimationFrame(go);
}
function frSure(q, yes, fn) {
  openSheet('확인', [el('p', { class: 'note', text: q }), el('button', { class: 'btn cta', text: yes, onclick: () => { SND.tap(); closeSheet(); fn(); } }),
    el('button', { class: 'btn', text: '취소', onclick: () => { SND.tap(); closeSheet(); } })]);
}
function frReqs(d, D) {
  dkPut(d.head, dkTitle('요청', `받은 요청 ${D.recv.length} · 보낸 요청 ${D.sent.length}`));
  const rows = [];
  if (D.recv.length) rows.push(frSec('받은 요청'), ...D.recv.map(x => frRow(x, [frBtn('수락', () => friends.act('accept', { acct: x.acct }, `${x.nick}와(과) 친구가 되었습니다`), 'hi'), frBtn('거절', () => friends.act('decline', { acct: x.acct }))])));
  if (D.sent.length) rows.push(frSec('보낸 요청'), ...D.sent.map(x => frRow(x, [el('span', { class: 'fr-wait', text: '대기 중' }), frBtn('취소', () => friends.act('remove', { acct: x.acct }))])));
  if (D.blocked.length) rows.push(frSec('차단'), ...D.blocked.map(x => frRow(x, frBtn('차단 풀기', () => friends.act('unblock', { acct: x.acct })))));
  dkPut(d.stage, el('div', { class: 'fr-list' }, rows.length ? rows : el('p', { class: 'fr-none', text: '요청이 없습니다' })));
  dkPut(d.slate, [...dkH1('요청'), dkHr(), dkTxt('받지 않은 요청은 7일 뒤 사라집니다.')]);
}
function frAdd(d, D) {
  dkPut(d.head, dkTitle('친구 추가'));
  const me = frHandle(D.me);
  const copyIco = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>';
  const cp = el('button', { class: 'cp', 'aria-label': '내 이름 복사', disabled: D.me.tag ? null : '', onclick: onTap(() => invite.copy(me, '내 이름')) }); cp.innerHTML = copyIco;
  dkPut(d.stage, el('div', { class: 'fr-list fr-add' }, [
    el('div', { class: 'fr-me' }, [el('span', { text: '내 이름' }), D.me.tag ? el('b', null, [document.createTextNode(D.me.nick), el('i', { text: '#' + D.me.tag })]) : el('b', { text: '이름 없음' }), cp]),
    D.me.tag ? frBtn('링크 보내기', () => frShare(D.me), 'hi') : el('p', { class: 'fr-none', text: '이름을 2~10자로 정하면 친구를 맺을 수 있습니다' })]));
  dkPut(d.slate, [...dkH1('친구 추가'), dkHr(), dkTxt('닉네임#태그로 찾거나, 경기가 끝난 뒤 결과 화면에서 상대를 추가합니다.')]);
  dkPut(d.slate, dkActs(dkMain('찾기', '닉네임#태그', () => frAsk(), !D.me.tag)));
}
// the share sheet with a link that opens 친구 추가 for this one (?friend=)
function frShare(me) {
  const url = FR_LINK + encodeURIComponent(frHandle(me)), text = `CUE에서 친구 해요: ${frHandle(me)}`;
  if (navigator.share) { navigator.share({ title: 'CUE 친구', text, url }).catch(() => {}); return; }
  invite.copy(url, '친구 링크');
}
// the sheet that sends a request to 닉네임#태그
function frAsk(pre) {
  const input = el('input', { class: 'txt', maxlength: '20', placeholder: '닉네임#1234', 'aria-label': '닉네임#태그', autocomplete: 'off', spellcheck: 'false' }); if (pre) input.value = pre;
  const go = async () => {
    const v = input.value.trim(); if (!/#\s*\d{1,4}\s*$/.test(v)) return toast('닉네임#태그로 입력하세요', 'foul', 1800);
    closeSheet();
    await friends.act('add', { handle: v }, r => r.st === 'friend' ? `${r.nick}와(과) 친구가 되었습니다` : `${r.nick || '친구'}에게 요청을 보냈습니다`);
  };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  openSheet('친구 추가', [input, el('button', { class: 'btn cta', text: '요청 보내기', onclick: () => { SND.tap(); go(); } })]);
  setTimeout(() => { try { input.focus(); input.select(); } catch (e) {} }, 60);
}

/* ---- an invitation come in: over the desk, 참가 · 거절 (until two minutes old) ---- */
function friendsCall() {
  let box = $('#frCall');
  const D = friends.data, t = Date.now() + friends.skew;
  const i = st.screen === 'home' && D && !invite.seated ? D.inbox.find(x => !friends.gone.has(x.acct + '|' + x.code) && t - x.at < 120000) : null;
  if (!i) { if (box) box.remove(); return; }
  const k = i.acct + '|' + i.code;
  if (box && box.dataset.k === k) return;
  if (!friends.seen.has(k)) { friends.seen.add(k); SND.good(); }
  const put = () => { friends.gone.add(k); net.friend('drop', { acct: i.acct }); friendsBadge(); friendsCall(); };
  const rules = i.rules || {}, what = (MODE_KO[i.mode] || '') + (i.mode === 'four' && rules.target ? ` ${rules.target}점` : '');
  const nb = el('div', { id: 'frCall', role: 'alertdialog', 'aria-label': '친구의 초대', 'data-k': k }, [
    el('div', { class: 'fr-c-t' }, [el('b', { text: i.nick || '친구' }), el('small', { text: `${what} · 같이 치자고 합니다` })]),
    el('button', { class: 'btn cta', text: '참가', onclick: () => { SND.tap(); put(); invite.join(i.code); } }),
    el('button', { class: 'btn', text: '거절', onclick: () => { SND.tap(); put(); } })]);
  if (box) box.replaceWith(nb); else app.appendChild(nb);
  setTimeout(friendsCall, Math.max(1000, 120000 - (t - i.at) + 500));
}

/* ---- the result of an online game of two: 친구 추가 for the opponent (50-match.js paintResult) ---- */
function friendsResult(on) {
  const b = $('#rFriend'); if (!b) return;
  const can = !!(net.on && on && !on.team && !on.watch && (on.kind === 'ranked' || on.kind === 'invite') && on.room);
  b.hidden = !can; b.disabled = false; b.textContent = '친구 추가';
  b.onclick = can ? async () => {
    SND.tap(); b.disabled = true;
    const r = await net.friend('add', { room: on.room });
    if (r && r.ok) { b.textContent = r.st === 'friend' ? '친구' : '요청 보냄'; friends.asked = 0; }
    else { b.disabled = false; toast(frWhy(r), 'foul', 2000); }
  } : null;
}

setInterval(() => { friends.tick(); }, 4000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { friends.asked = 0; friends.tick(); } });
press('#dkFriends', () => deskGo('friends'));
// opened by a friend's link (?friend=닉네임%231234): 친구 추가 with it filled in, and the link taken off the address
(() => {
  let h = null; try { h = new URLSearchParams(location.search).get('friend'); } catch (e) {}
  if (!h) return;
  try { history.replaceState(null, '', location.pathname); } catch (e) {}
  setTimeout(() => { if (!net.on) return; deskGo('friends'); friends.tab = 'add'; paintHome(); frAsk(h); }, 1400);
})();
