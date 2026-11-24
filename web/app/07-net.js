/* ================= the server: the account, the wallet, what is owned, and the rewards waiting to be paid =================
   The server (server/, Cloudflare) keeps the coins, the diamonds and what is owned; this side only shows the last it heard
   and says what happened. A reward - a puzzle solved, a match played on the device - is kept in a queue (saved on the
   device) and sent when there is a connection, now or days later; the server checks it and pays it, once. Nothing here
   ever sets a balance. With no SERVER set the game plays offline as it always has, with everything to hand.
   All talking to the server is in this file: the screens call net.*, never fetch. */
const SERVER = 'https://api.danguuu.com';          // ('' plays offline with everything to hand)
const net = (() => {
  /* The closure's parts, each with its own state:
       the line       - call(): one request, its time limit and the last trouble (trouble, troubleText)
       the account    - account (the key, saved as 'acct'), ensure() opening one, doubt() on a 401, putAside() into 'acctOld'
       the wallet     - me (what the server last said, saved as 'me'), setMe(), owns()
       the rewards    - the claims waiting (saved as 'claims'), flush() sending them, later() asking again
     and below them what the screens call: the account, the rewards, the lobby and rooms, the shop. */
  // ---- the line
  /* One request; null when there is no answer (offline, the server down or too slow: try again later). Every request has
     a time limit (ms; AbortController) - a fetch that never ends would hold whatever waits on it (the ranked queue's
     polling) for good. The answer carries its HTTP status (r.status, not enumerable). The last trouble is kept
     (net.trouble) so a screen waiting on the server can say what it is.
     The account's key is the only way into its vault, so it is never thrown away. A 401 is only believed when it is about
     the account in use now (an old request's late 401 changes nothing) and when /v1/me, asked at once with that same
     account, says 401 too: then this account is not the server's (another server, a wiped one) - it is put aside in
     'acctOld' (kept, with what it was), and a new one is opened. */
  let trouble = null;
  async function call(path, body, ms) {
    const who = account, ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), ms || 15000) : 0;
    try {
      const r = await fetch(SERVER + path, { method: body ? 'POST' : 'GET', body: body ? JSON.stringify(body) : undefined, signal: ctl ? ctl.signal : undefined,
        headers: Object.assign({ 'Content-Type': 'application/json' }, who ? { Authorization: `Bearer ${who.id}.${who.key}` } : {}) });
      if (r.status >= 500) { const e = await r.json().catch(() => null); trouble = { path, status: r.status, why: 'server', error: e && e.error || '' }; console.warn('[net]', path, r.status, trouble.error); return null; }
      const j = await r.json().catch(() => ({ ok: false, why: 'not json' }));
      Object.defineProperty(j, 'status', { value: r.status, enumerable: false });
      if (j && typeof j.now === 'number' && r.ok) clock.heard(j.now);   // (the server's time: 00-state.js clock)
      if (r.status === 401 && who && who === account && path !== '/v1/me') { trouble = { path, status: 401, why: 'account' }; doubt(who); }
      else if (r.status === 401 && who && path === '/v1/me') trouble = { path, status: 401, why: 'account' };
      else trouble = j && j.ok === false ? { path, status: r.status, why: j.why || 'refused' } : null;
      return j;
    } catch (e) {
      trouble = { path, status: 0, why: ctl && ctl.signal.aborted ? 'slow' : 'offline' }; console.warn('[net]', path, String(e && e.message || e)); return null;
    } finally { clearTimeout(timer); }
  }
  // what the last trouble was, in a few words for a screen (null: none)
  const troubleText = () => { const T = trouble; if (!T) return null;
    return T.why === 'offline' ? '서버에 연결할 수 없음' : T.why === 'slow' ? '서버 응답이 늦음' : T.why === 'account' ? '계정 확인 중' : T.why === 'update' ? '새 버전으로 업데이트해야 합니다'
      : T.why === 'server' ? `서버 오류 ${T.status}${T.error ? ' · ' + T.error.slice(0, 60) : ''}` : `서버: ${T.why}`; };
  // a request that needs an account: one is opened first if there is none (null: none could be)
  const signed = async (path, body, ms) => (await ensure()) ? call(path, body, ms) : null;
  const hex = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => b.toString(16).padStart(2, '0')).join('');

  // ---- the account
  let account = store.get('acct', null);
  // an account this device lets go of is kept in 'acctOld' with what it last showed - never deleted, so it can be found again
  function putAside(who) {
    const old = store.get('acctOld', []); if (!old.some(a => a.id === who.id)) old.push(Object.assign({ at: Date.now(), me: me || null }, who)); store.set('acctOld', old);
  }
  // this device has no account now (signed out, deleted): nothing is shown of the last one until a new one is opened
  function forget() { account = null; store.set('acct', null); me = null; store.set('me', null); }
  // this device goes over to another account (a device code, or a Google account already tied to one): the one it had, if
  // different, is put aside; what was shown is forgotten until the wallet is asked again
  function takeAccount(id, key) {
    if (account && account.id !== id) putAside(account);
    account = { id, key }; store.set('acct', account); me = null; store.set('me', null);
  }
  // a 401 about the account in use: asked once more, plainly; only a second 401 for the same account lets it go (put aside)
  let doubting = null, lostAccount = false;
  function doubt(who) {
    if (doubting) return doubting;
    return doubting = (async () => {
      const m = await call('/v1/me');
      if (m && m.status === 401 && account === who) {
        console.warn('[net] the server does not know this account - it is kept aside and a new one opened');
        putAside(who);
        account = null; store.set('acct', null); lostAccount = true;
      }
    })().finally(() => { doubting = null; });
  }
  // (one account at a time: requests that find none wait for the one being opened, rather than each opening its own)
  let opening = null;
  async function ensure() {
    if (!SERVER) return false;
    if (doubting) await doubting;
    if (account) return true;
    if (!opening) opening = (async () => {
      const r = await call('/v1/account', {}, 20000); if (!r || !r.ok || !r.id || !r.key) return false;
      account = { id: r.id, key: r.key }; store.set('acct', account);
      if (lostAccount) { lostAccount = false; toast('새 계정으로 시작합니다. 이전 계정은 이 기기에 보관돼 있습니다.', 'foul', 4000); }
      return true;
    })().finally(() => { opening = null; });
    return opening;
  }

  // ---- the wallet
  let me = store.get('me', null), googleCfg;
  // what the server says now; announce: say so when coins came in that were not answered for at once (a match checked later)
  function setMe(m, announce) {
    const was = me; me = m; store.set('me', m); prefs.wallet = { coin: m.coin, dia: m.dia };
    if (!!(was && was.debug) !== !!m.debug) applyBackdrop();   // (debug mode came or went in the admin console: the desk's look to try with it)
    // (only the coins or diamonds moved and the shop is not open: the two numbers change, the desk is not built again)
    const bare = x => JSON.stringify(Object.assign({}, x, { coin: 0, dia: 0 }));
    if (was && bare(was) === bare(m) && !(st.screen === 'home' && deskTab === 'shop')) { savePrefs(); walletPaint(); return; }
    if (announce && was && m.coin > was.coin) toast(`+${(m.coin - was.coin).toLocaleString('ko-KR')} 코인 (경기 확인 완료)`, 'good', 2600);
    // what is worn but no longer (or not yet) owned goes back to the first of its kind
    const k = KIND_OF;
    if (!owns('ball', prefs.ballSkin)) { prefs.ballSkin = BALLSKINS[0].id; useBalls(prefs.ballSkin); }
    if (!owns('trail', prefs.trail)) prefs.trail = TRAILS[0].id;
    if (!owns('table', (CLOTHS[prefs.cloth] || {}).id)) prefs.cloth = 0;
    prefs.cues = prefs.cues.map(i => owns('cue', (CUES[i] || {}).id) ? i : k.cue.firstOwned());
    savePrefs(); if (st.screen === 'home') paintHome();
  }
  // the 일반 things are everyone's; the rest are owned once bought (all of them, while there is no server)
  // (a debug item - content's debug: true - is had by an account in debug mode, and by no one else)
  const owns = (kind, id) => { const it = (KIND_OF[kind] ? KIND_OF[kind].list() : []).find(q => q.id === id); if (it && it.debug) return !!(me && me.debug); return !!it && (!SERVER || !(it.rarity > 0) || !!(me && me.owned[kind] && me.owned[kind].includes(id))); };

  // ---- the rewards waiting
  let busy = false;
  const claims = () => store.get('claims', []);
  // send what is waiting, oldest first; a reward the server turns down is dropped, one it did not answer stays for later
  async function flush() {
    if (busy || !SERVER) return; busy = true;
    try {
      if (!(await ensure())) return;
      /* (each reward goes to the account it was won on - claim() writes it on; one won on another account waits for that
         one to be signed in again, and nothing is sent once the account has changed under way: QA 11-20 E01 - a guest's
         rewards went to the account signed in after it, and an answer for the old one could fill in the new one's wallet) */
      const who = account && account.id, mine = () => claims().filter(c => !c.acct || c.acct === who);
      for (let q = mine(); q.length; q = mine()) {
        // (kept for later unless the server has decided: paid, or turned down for good. No answer, a 401 (the account
        // in doubt), 403, 408 or 429 (try later) leave it waiting - a reward is never lost to a passing fault)
        const c = q[0], r = await call('/v1/' + c.kind, c.body); if (!r || [401, 403, 408, 429].includes(r.status)) return;
        if (!account || account.id !== who) return;
        if (r.ok && r.paid) toast(`+${r.paid.toLocaleString('ko-KR')} 코인` + (r.dia ? ` · 다이아 ${r.dia}` : '') + (r.item ? ` · ${itemName(r.item)} 획득!` : ''), 'good', 3200);   // (다이아: a puzzle stage's 챌린지)
        if (r.me) setMe(r.me);
        if (r.pzr) pzrSync(r.pzr);                                     // (a puzzle attempt: the server's rating - 52-puzzle.js)
        if (r.pending) laterN = 0;
        store.set('claims', claims().filter(x => x.body.req !== c.body.req));
      }
      const m = await call('/v1/me'); if (!account || account.id !== who) return; if (m && m.ok) { setMe(m.me, true); if (m.me.checking) later(); if (m.me.pzr) pzrSync(m.me.pzr); }
      // a member's progress (lessons, puzzles, the tutorial seen), kept on the server for their other devices: taken in
      // (the further of the two, each thing), and sent back when this device's has moved on (57-account.js)
      if (m && m.ok && m.me.joined) { const pulled = progressMerge(m.me.save); const mine = progressOf();
        if (pulled || JSON.stringify(mine) !== JSON.stringify(m.me.save)) { const s = await call('/v1/save', { data: mine }); if (s && s.ok && me) { me.save = mine; store.set('me', me); } } }
    } finally { busy = false; }
  }
  // a match being checked (a slice at a time on the server): look again in a while, less often the longer it takes
  let laterT = 0, laterN = 0;
  function later() { clearTimeout(laterT); laterT = setTimeout(() => { laterN++; flush(); }, Math.min(60000, 4000 * Math.pow(1.6, laterN))); }
  window.addEventListener('online', () => flush());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) flush(); });

  // who sits down in a game with others: the physics this app plays by, the name and what is worn (read at the time of asking)
  const seatOf = () => ({ phys: PHYS_V, name: prefs.names[0], icon: 0, gear: ranked.gear() });
  return {
    // ---- the line and the account
    get on() { return !!SERVER; }, get trouble() { return trouble; }, troubleText,
    get accountId() { return account ? account.id : null; },
    // this account is in debug mode (turned on in the admin console, web/admin.html): the 디버그 settings are shown
    get debug() { return !!(me && me.debug); },
    /* The account deleted (owner 11-16): the server empties it (vault.js erase) - nothing to put aside, it is gone - and
       this device goes on as a new guest. true when done. */
    async erase() {
      if (!account) return false;
      const r = await call('/v1/erase', { sure: '삭제' }); if (!r || !r.ok) return false;
      const gone = account.id; store.set('claims', claims().filter(c => c.acct !== gone));   // (its rewards waiting go with it)
      forget();
      await ensure(); flush(); return true;
    },
    // signing out (owner 11-10): this device lets go of the account - it stays on the server, tied to its Google account,
    // to sign in to again - and goes on as a new guest (the old one is kept aside on the device, as when one is lost)
    signOut() {
      if (account) putAside(account);
      forget();
      return ensure().then(() => flush());
    },
    /* Signing up and in with Google (server/src/link.js, google.js; 57-account.js asks Google): the server's client ID (null:
       not set up), and a Google ID token given to the server. Tied to this device's account the first time (signed up:
       its prize, r.joined); or, when that Google account is already another CUE account, this device goes over to it -
       the one it had is put aside in acctOld. */
    async googleConfig() { if (googleCfg !== undefined) return googleCfg; const r = await call('/v1/link/google-config'); if (r && r.ok) googleCfg = r.clientId || null; return r && r.ok ? googleCfg : undefined; },
    async google(token) {
      await ensure();
      const r = await call('/v1/link/google', { token }, 20000); if (!r || !r.ok) return r;
      if (r.key && r.id) takeAccount(r.id, r.key);
      await flush(); return r;
    },
    // a member's nickname (2-10 characters): the name the others see
    async nick(n) { const r = await signed('/v1/nick', { nick: n }); if (r && r.ok && r.me) setMe(r.me); return r; },

    // ---- the wallet and the rewards
    get me() { return me; }, owns, flush,
    // the name changed: what is worn is looked at again
    renamed() { if (me) setMe(me); },
    // a reward to be paid: kind 'puzzle' ({ id, shot, shots }) or 'match' ({ kind: friend | cpu, log }); or a counted puzzle
    // attempt to be kept: 'pztry' ({ id, res, shots, k } - server core.js puzzleTry)
    claim(kind, body) { const q = claims(); q.push({ kind, acct: account ? account.id : null, body: Object.assign({ req: hex(12) }, body) }); store.set('claims', q); flush(); },

    // ---- the lobby and the rooms
    // waiting for a ranked game (asked again every couple of seconds): { waiting } or the room it is in (server/src/ranked.js)
    // (seek: this one search's id - the lobby answers a room found only to it, so a new search never lands in an old room)
    queue: (mode, seek) => signed('/v1/queue', Object.assign({ mode, seek }, seatOf()), 10000),
    leaveQueue(mode) { if (account) call('/v1/queue/leave', { mode }); },
    // a ranked game's room, by WebSocket: its address for the seat's token
    roomUrl: (room, token) => SERVER.replace(/^http/, 'ws') + `/v1/room/${room}?token=${token}`,
    watchUrl: (room, key) => SERVER.replace(/^http/, 'ws') + `/v1/room/${room}?watch=${key}`,
    // a game with a friend on another device (server/src/ranked.js InviteCore): a code to give them, asked after until they
    // come; or a friend's code, to join
    // (o: { listed, pw } - a room shown in the list of open rooms, with a password if given: 방 생성하기)
    inviteOpen: (mode, rules, o) => signed('/v1/invite/open', Object.assign({ mode, rules }, seatOf(), o || {})),
    inviteList: () => signed('/v1/invite/list', {}),
    inviteWatch: (id, pw) => signed('/v1/invite/watch', { id, pw: pw || '', phys: PHYS_V }),
    inviteJoinId: (id, pw) => signed('/v1/invite/join', Object.assign({ id, pw: pw || '' }, seatOf())),
    inviteAsk: code => call('/v1/invite/ask', { code }),
    invitePeek: code => signed('/v1/invite/peek', { code }),
    inviteJoin: code => signed('/v1/invite/join', Object.assign({ code }, seatOf())),
    inviteLeave(code) { if (account) call('/v1/invite/leave', { code }); },
    inviteBot: (code, seat, level) => call('/v1/invite/bot', { code, seat, level }),
    inviteStart: code => call('/v1/invite/start', { code }),
    inviteReady: (code, on) => call('/v1/invite/ready', { code, on: !!on }),
    inviteKick: (code, seat) => call('/v1/invite/kick', { code, seat }),

    // ---- the shop: buying needs the server there and then
    async buy(kind, id) {
      if (!(await ensure())) return { ok: false, why: '서버에 연결할 수 없습니다.' };
      const r = await call('/v1/buy', { req: hex(12), kind, id });
      if (!r) return { ok: false, why: '서버에 연결할 수 없습니다.' };
      if (r.me) setMe(r.me);
      return r.ok ? { ok: true } : { ok: false, why: r.why === 'not enough' ? '코인 부족' : r.why === 'already owned' ? '이미 보유' : '살 수 없습니다' };
    },
  };
})();
// each kind of thing that can be owned: its list, and the first of it owned (for putting back what is no longer owned)
const KIND_OF = {
  cue: { list: () => CUES, firstOwned: () => Math.max(0, CUES.findIndex(c => !(c.rarity > 0))) },
  ball: { list: () => BALLSKINS }, table: { list: () => CLOTHS }, trail: { list: () => TRAILS },
};
const itemOf = it => (KIND_OF[it.kind] ? KIND_OF[it.kind].list() : []).find(x => x.id === it.id) || null;
const itemName = it => { const q = itemOf(it); return q ? q.name : it.id; };
