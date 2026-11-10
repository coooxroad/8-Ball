/* ================= the account: playing as a guest, signing up with Google =================
   Everyone starts as a guest - an account the server opened for this device (07-net.js), no sign-up asked. Signing up is
   tying a Google account to it: once, with a prize (economy.js SIGNUP_PRIZE) and a nickname of the player's own (2-10
   characters, others may have the same); the same Google account on another device then opens this same account, and
   the progress kept only on a device (lessons, puzzles, the tutorial seen) goes with it (progressOf, progressMerge).
   Google: on the web its account chooser, every time (googleButton; Google Identity Services, loaded when wanted); in the Android app the
   system's account picker (MainActivity: Credential Manager - Google does not sign in inside an app's web view), its
   token handed to the page (window.__googleToken). Either way the token goes to the server, which checks it
   (server/src/google.js). Not set up on the server (no client ID): the sign-up is said to be coming. */

// the progress that lives on the device, for the server to keep for a member's other devices (small: no shots)
function progressOf() {
  return { v: 1, drillLv: prefs.drillLv || {}, stars: (prefs.pz && prefs.pz.stars) || {}, tut: !!prefs.tutDone, how: !!prefs.how };
}
// the server's copy taken in: the further of the two, thing by thing; true when anything here moved on
function progressMerge(s) {
  if (!s || s.v !== 1) return false;
  let moved = false;
  for (const [id, lv] of Object.entries(s.drillLv || {})) if ((prefs.drillLv[id] || 0) < lv) { prefs.drillLv[id] = lv; moved = true; }
  for (const [id, n] of Object.entries(s.stars || {})) if ((prefs.pz.stars[id] || 0) < n) { prefs.pz.stars[id] = n; moved = true; }
  if (s.tut && !prefs.tutDone) { prefs.tutDone = true; moved = true; }
  if (s.how && !prefs.how) { prefs.how = true; moved = true; }
  if (moved) { savePrefs(); if (st.screen === 'home') paintHome(); }
  return moved;
}

const account = {
  // the Android app: a Google ID token from the system's picker (a promise; null when not given: closed, failed)
  googleToken(clientId) {
    if (window.CueAndroid && window.CueAndroid.googleSignIn) return new Promise(res => {
      window.__googleToken = (t, why) => { window.__googleToken = null; if (!t && why) console.warn('[google]', why); res(t || null); };
      window.CueAndroid.googleSignIn(clientId);
    });
    return Promise.resolve(null);
  },
  /* The web: our key, and on it Google's account chooser every time (OAuth prompt=select_account - '다른 계정 사용' is
     always on it). Google's own sign-in button kept offering the account it last used, and once one was signed in there
     was no getting to another (owner 11-10). What comes back is an access token ('openid email'); the server asks Google
     whose it is (server/src/google.js googleWhoAccess). Closing the chooser leaves the key there to press again. */
  googleButton(clientId, host, label) {
    const draw = () => {
      let client;
      try { client = google.accounts.oauth2.initTokenClient({ client_id: clientId, scope: 'openid email', prompt: 'select_account', callback: r => { if (r && r.access_token) account.signIn(r.access_token); else if (r && r.error) console.warn('[google]', r.error); }, error_callback: e => { if (e && e.type !== 'popup_closed') console.warn('[google]', e.type); } }); }
      catch (e) { console.warn('[google]', e); host.textContent = '구글 로그인을 열 수 없습니다'; host.classList.add('off'); return; }
      host.textContent = '';
      host.appendChild(el('button', { class: 'btn cta google', text: label, onclick: () => { SND.tap(); client.requestAccessToken(); } }));
    };
    if (window.google && google.accounts && google.accounts.oauth2) return draw();
    host.textContent = '…';
    const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = draw; s.onerror = () => { host.textContent = '구글에 연결할 수 없습니다'; host.classList.add('off'); };
    document.head.appendChild(s);
  },
  // the token to the server, and what that turned out to be: signed up here (the prize, then a nickname), or this device
  // gone over to the account that Google account already had
  async signIn(token) {
    if (!token) return;
    toast('확인 중…', '', 1400);
    const r = await net.google(token);
    if (!r || !r.ok) return toast(r && r.why === 'google not set up' ? '구글 로그인 준비 중' : '로그인하지 못했습니다', 'foul', 2400);
    closeSheet();
    if (r.joined) { SND.win(); fxBurst($('#dkWallet')); toast(`가입 완료 · 코인 +${r.joined.coin.toLocaleString('ko-KR')} · 다이아 +${r.joined.dia}`, 'good', 3200); return account.sheetNick(true); }
    if (r.key) { const m = net.me; if (m && m.nick) { prefs.names[0] = m.nick; savePrefs(); } toast('로그인 완료', 'good', 1800); }
    else toast('이미 연결된 계정입니다', '', 1800);
    if (st.screen === 'home') paintHome();
  },
  // the nickname: the name the others see (first: asked right after signing up, with the device's name to start from)
  sheetNick(first) {
    const input = el('input', { class: 'txt', maxlength: '10', 'aria-label': '닉네임', autocomplete: 'off', spellcheck: 'false' });
    input.value = (net.me && net.me.nick) || (prefs.names[0] === '플레이어1' ? '' : prefs.names[0]);
    const msg = note('2~10자');
    const go = async () => {
      const v = input.value.replace(/\s+/g, ' ').trim();
      if ([...v].length < 2) { msg.textContent = '2자 이상 넣어 주세요'; return; }
      const r = await net.nick(v);
      if (!r || !r.ok) { msg.textContent = r && r.why === 'nick length' ? '2~10자로 넣어 주세요' : '저장하지 못했습니다 · 다시 시도'; return; }
      prefs.names[0] = r.me.nick; savePrefs(); closeSheet(); net.renamed(); paintHome(); toast('닉네임 저장', 'good', 1400);
    };
    input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
    openSheet(first ? '닉네임 정하기' : '닉네임', [input, msg, el('button', { class: 'btn cta', text: '저장', onclick: () => { SND.tap(); go(); } })]);
    setTimeout(() => { try { input.focus(); input.select(); } catch (e) {} }, 60);
  },
  // the account sheet (the name at the top bar): who this is, and signing up or in
  async sheet() {
    if (!net.on) return sheetName(0);
    const m = net.me, member = !!(m && m.joined), P = ECONOMY.SIGNUP_PRIZE;
    const host = el('div', { class: 'g-btn' });
    const kids = [
      el('div', { class: 'acct-card' + (member ? ' member' : '') }, [el('b', { text: member ? (m.nick || prefs.names[0]) : prefs.names[0] }), el('small', { text: member ? '회원' : '게스트' })]),
      member ? flatBtn('닉네임 바꾸기', () => account.sheetNick(false)) : flatBtn('이름 바꾸기', () => sheetName(0)),
    ];
    if (!member) kids.push(el('div', { class: 'acct-join' }, [el('b', { text: '구글로 가입하기' }), el('small', { text: `가입 보상 · 코인 ${P.coin.toLocaleString('ko-KR')} · 다이아 ${P.dia}` }), host]));
    // (signed in: the key is to sign out - owner 11-10; signing in again is with the Google key once out)
    else kids.push(el('div', { class: 'acct-join' }, [el('button', { class: 'btn flat', text: '로그아웃', onclick: () => { SND.tap(); account.sheetOut(); } })]));
    if (!member) kids.push(el('p', { class: 'note legal' }, [document.createTextNode('가입하면 '), el('a', { href: 'https://cue.oxcorp.workers.dev/terms', target: '_blank', rel: 'noopener', text: '서비스 약관' }),
      document.createTextNode('과 '), el('a', { href: 'https://cue.oxcorp.workers.dev/privacy', target: '_blank', rel: 'noopener', text: '개인정보처리방침' }), document.createTextNode('에 동의합니다.')]));
    openSheet(member ? '계정' : '계정 · 게스트', kids);
    if (member) return;
    const id = await net.googleConfig();
    if (!id) { host.textContent = id === null ? '구글 로그인 준비 중' : '서버에 연결할 수 없습니다'; host.classList.add('off'); return; }
    if (window.CueAndroid && window.CueAndroid.googleSignIn) {
      // (the app: our own key - the system's picker comes up)
      host.appendChild(el('button', { class: 'btn cta google', text: '구글로 계속하기', onclick: async () => { SND.tap(); account.signIn(await account.googleToken(id)); } }));
    } else account.googleButton(id, host, '구글로 계속하기');
  },
  sheetOut() {
    openSheet('로그아웃', [
      el('div', { class: 'row' }, [flatBtn('취소', () => account.sheet()),
        el('button', { class: 'btn cta', text: '로그아웃', onclick: async () => { SND.tap(); closeSheet(); await net.signOut(); toast('로그아웃했습니다', 'good', 1800); if (st.screen === 'home') paintHome(); } })]),
    ]);
  },
};
