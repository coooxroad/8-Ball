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
  rulesOf(mode) { return mode === 'three' ? { target: prefs.target, cushions: prefs.rule3 } : mode === 'four' ? { target: prefs.fourTarget } : {}; },
  // the code for this game and these rules: kept, or (another game, other rules) a new one
  want(mode) {
    const key = mode + JSON.stringify(invite.rulesOf(mode)), h = invite.host;
    if (h && h.key === key) return h;
    if (invite.opening === key) return null;
    if (invite.err && invite.errKey === key) return null;           // (it failed: not again on its own - the slate has 다시 시도)
    if (h) invite.leave();
    invite.opening = key;
    net.inviteOpen(mode, invite.rulesOf(mode)).then(r => {
      if (invite.opening !== key) { if (r && r.ok) net.inviteLeave(r.code); return; }
      invite.opening = null;
      // (the slate says why, and offers to try again - it used to stay on '만드는 중' for good)
      if (!r || !r.ok) { invite.err = net.troubleText() || '서버 응답 없음'; invite.errKey = key; toast('초대 코드를 만들 수 없습니다.', 'foul', 2200); if (st.screen === 'home') paintHome(); return; }
      invite.err = null;
      invite.host = { code: r.code, mode, key, timer: 0, guest: null };
      invite.poll(); if (st.screen === 'home') paintHome();
    });
    return null;
  },
  poll() {
    const h = invite.host; if (!h) return;
    clearTimeout(h.timer);
    h.timer = setTimeout(async () => {
      if (invite.host !== h) return;
      const r = await net.inviteAsk(h.code);
      if (invite.host !== h) return;
      if (r && r.ok && r.room) { h.guest = r.opp; if (st.screen === 'home') paintHome(); SND.good(); invite.host = null; setTimeout(() => ranked.found(r), 900); return; }
      if (r && !r.ok && r.why === 'gone') { invite.host = null; if (st.screen === 'home') paintHome(); return; }
      invite.poll();
    }, 2000);
  },
  leave() { const h = invite.host; invite.opening = null; if (!h) return; clearTimeout(h.timer); invite.host = null; net.inviteLeave(h.code); },
  // a friend's code: into their game
  async join(code) {
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 6) return toast('코드는 여섯 글자입니다.', 'foul', 1800);
    if (invite.host && invite.host.code === code) return toast('내가 만든 코드입니다. 친구에게 보내 주세요.', '', 2200);
    toast('친구의 방을 찾는 중…', '', 1400);
    const r = await net.inviteJoin(code);
    if (r && r.ok && r.room) { invite.leave(); closeSheet(); return ranked.found(r); }
    toast(!r ? '서버에 연결할 수 없습니다.' : r.why === 'taken' ? '이미 시작한 방입니다.' : r.why === 'your own code' ? '내가 만든 코드입니다.' : '그런 코드의 방이 없습니다.', 'foul', 2400);
  },
  copy(text, what) {
    const done = () => toast(`${what}를 복사했습니다.`, 'good', 1600);
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
    const input = el('input', { class: 'txt code', maxlength: '6', placeholder: 'K7M2Q9', 'aria-label': '참가 코드', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false' });
    const go = () => invite.join(input.value);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    openSheet('코드로 참가', [input, note('친구가 보낸 여섯 글자 코드를 넣으면 친구의 방으로 들어가 바로 시작합니다.'), el('button', { class: 'btn cta', text: '참가', onclick: () => { SND.tap(); go(); } })]);
    setTimeout(() => { try { input.focus(); } catch (e) {} }, 60);
  },
  // the tray while inviting: me ready with my cue, the friend's place waiting (or them, come), the code to give
  tray(stage, m) {
    const h = invite.host, cue = CUES[prefs.cues[0]] || CUES[0], g = h && h.guest;
    stage.dataset.win = '0';
    const slot = (who, sub, kids, cls) => el('div', { class: 'inv-slot' + (cls ? ' ' + cls : '') }, [el('div', { class: 'well' }, kids), el('b', { text: who }), el('small', { text: sub })]);
    dkPut(stage, el('div', { class: 'inv' }, [
      el('div', { class: 'inv-slots' }, [
        slot(prefs.names[0], '준비 완료', [el('img', { class: 'cue', src: `ui/cue-${cue.id}.webp`, alt: '' }), ballPic(prefs.ballSkin, m === 'three' || m === 'four' ? 'carom' : 'pool', 0, { class: 'ball' })]),
        slot(g ? g.name : '친구', g ? '입장! 곧 시작합니다' : '기다리는 중', [el('i', { class: 'ghost-cue' }), el('i', { class: 'ghost-ball' })], g ? 'come' : 'wait')]),
      el('div', { class: 'inv-code' }, [el('span', { text: '참가 코드' }), el('b', { text: h ? h.code : '······' }),
        el('button', { disabled: h ? null : '', text: '복사', onclick: onTap(() => h && invite.copy(h.code, '참가 코드')) })])]));
  },
};
// opened by an invite link (?join=CODE): into that game, and the link taken off the address
(() => {
  let code = null; try { code = new URLSearchParams(location.search).get('join'); } catch (e) {}
  if (!code) return;
  try { history.replaceState(null, '', location.pathname); } catch (e) {}
  setTimeout(() => invite.join(code), 1200);
})();
