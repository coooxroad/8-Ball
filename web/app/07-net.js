/* ================= the server: the account, the wallet, what is owned, and the rewards waiting to be paid =================
   The server (server/, Cloudflare) keeps the coins, the diamonds and what is owned; this side only shows the last it heard
   and says what happened. A reward - a puzzle solved, a match played on the device - is kept in a queue (saved on the
   device) and sent when there is a connection, now or days later; the server checks it and pays it, once. Nothing here
   ever sets a balance. With no SERVER set the game plays offline as it always has, with everything to hand.
   All talking to the server is in this file: the screens call net.*, never fetch. */
const SERVER = 'https://cue-server.co-oxroad.workers.dev';          // ('' plays offline with everything to hand)
const net = (() => {
  let me = store.get('me', null), busy = false, account = store.get('acct', null);
  const hex = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => b.toString(16).padStart(2, '0')).join('');
  const queue = () => store.get('claims', []);
  // one request; null when there is no answer (offline, or the server is down: try again later)
  async function call(path, body) {
    try {
      const r = await fetch(SERVER + path, { method: body ? 'POST' : 'GET', body: body ? JSON.stringify(body) : undefined,
        headers: Object.assign({ 'Content-Type': 'application/json' }, account ? { Authorization: `Bearer ${account.id}.${account.key}` } : {}) });
      if (r.status >= 500) return null;
      return await r.json();
    } catch (e) { return null; }
  }
  async function ensure() {
    if (!SERVER) return false;
    if (account) return true;
    const r = await call('/v1/account', {}); if (!r || !r.ok) return false;
    account = { id: r.id, key: r.key }; store.set('acct', account); return true;
  }
  // what the server says now; announce: say so when coins came in that were not answered for at once (a match checked later)
  function setMe(m, announce) {
    const was = me; me = m; store.set('me', m); prefs.wallet = { coin: m.coin, dia: m.dia };
    if (announce && was && m.coin > was.coin) toast(`+${(m.coin - was.coin).toLocaleString('ko-KR')} 코인 (경기 확인 완료)`, 'good', 2600);
    // what is worn but no longer (or not yet) owned goes back to the first of its kind
    const k = KIND_OF;
    if (!owns('ball', prefs.ballSkin)) { prefs.ballSkin = BALLSKINS[0].id; useBalls(prefs.ballSkin); }
    if (!owns('trail', prefs.trail)) prefs.trail = TRAILS[0].id;
    if (prefs.glove && !owns('glove', prefs.glove)) prefs.glove = null;
    if (!owns('table', (CLOTHS[prefs.cloth] || {}).id)) prefs.cloth = 0;
    prefs.cues = prefs.cues.map(i => owns('cue', (CUES[i] || {}).id) ? i : k.cue.firstOwned());
    savePrefs(); if (st.screen === 'home') paintHome();
  }
  // send what is waiting, oldest first; a reward the server turns down is dropped, one it did not answer stays for later
  async function flush() {
    if (busy || !SERVER) return; busy = true;
    try {
      if (!(await ensure())) return;
      for (let q = queue(); q.length; q = queue()) {
        const c = q[0], r = await call('/v1/' + c.kind, c.body); if (!r) return;
        if (r.ok && r.paid) toast(`+${r.paid.toLocaleString('ko-KR')} 코인`, 'good', 2200);
        if (r.me) setMe(r.me);
        if (r.pending) laterN = 0;
        store.set('claims', queue().filter(x => x.body.req !== c.body.req));
      }
      const m = await call('/v1/me'); if (m && m.ok) { setMe(m.me, true); if (m.me.checking) later(); }
    } finally { busy = false; }
  }
  // a match being checked (a slice at a time on the server): look again in a while, less often the longer it takes
  let laterT = 0, laterN = 0;
  function later() { clearTimeout(laterT); laterT = setTimeout(() => { laterN++; flush(); }, Math.min(60000, 4000 * Math.pow(1.6, laterN))); }
  // the 일반 things are everyone's; the rest are owned once bought (all of them, while there is no server)
  const owns = (kind, id) => { const it = (KIND_OF[kind] ? KIND_OF[kind].list() : []).find(q => q.id === id); return !!it && (!SERVER || !(it.rarity > 0) || !!(me && me.owned[kind] && me.owned[kind].includes(id))); };
  window.addEventListener('online', () => flush());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) flush(); });
  return {
    get on() { return !!SERVER; }, get me() { return me; }, owns, flush,
    // a reward to be paid: kind 'puzzle' ({ id, shot }) or 'match' ({ kind: friend | cpu, log })
    claim(kind, body) { const q = queue(); q.push({ kind, body: Object.assign({ req: hex(12) }, body) }); store.set('claims', q); flush(); },
    // buying needs the server there and then: true when bought
    async buy(kind, id) {
      if (!(await ensure())) return { ok: false, why: '서버에 연결할 수 없습니다.' };
      const r = await call('/v1/buy', { req: hex(12), kind, id });
      if (!r) return { ok: false, why: '서버에 연결할 수 없습니다.' };
      if (r.me) setMe(r.me);
      return r.ok ? { ok: true } : { ok: false, why: r.why === 'not enough' ? '코인이 모자랍니다.' : r.why === 'already owned' ? '이미 가지고 있습니다.' : '살 수 없습니다.' };
    },
  };
})();
// each kind of thing that can be owned: its list, and the first of it owned (for putting back what is no longer owned)
const KIND_OF = {
  cue: { list: () => CUES, firstOwned: () => Math.max(0, CUES.findIndex(c => !(c.rarity > 0))) },
  ball: { list: () => BALLSKINS }, table: { list: () => CLOTHS }, trail: { list: () => TRAILS }, glove: { list: () => GLOVES },
};
