/* After a deploy: is the server up and behaving? A new account, its wallet, a wrong key turned away, a request without
   its number refused, and a ranked wait that ends with an opponent. node tools/live.mjs <address> */
const U = process.argv[2]; let bad = 0; const check = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const j = async (p, o) => { const r = await fetch(U + p, o); return { status: r.status, body: await r.json().catch(() => null) }; };
const hello = await j('/'); check(hello.body && hello.body.ok, 'answers');
const acc = await j('/v1/account', { method: 'POST' }); check(acc.body && acc.body.ok && acc.body.id && acc.body.key, 'opens an account');
const auth = { Authorization: `Bearer ${acc.body.id}.${acc.body.key}`, 'Content-Type': 'application/json' };
const me = await j('/v1/me', { headers: auth }); check(me.body && me.body.ok && me.body.me.coin === 0 && me.body.me.dama === 30, 'a new wallet: 0 coins, 30 다마');
const wrong = await j('/v1/me', { headers: { Authorization: `Bearer ${acc.body.id}.${'0'.repeat(64)}` } }); check(wrong.status === 401, 'a wrong key is turned away');
const buy = await j('/v1/buy', { method: 'POST', headers: auth, body: JSON.stringify({ req: 'live-check-1', kind: 'cue', id: 'rose' }) }); check(buy.body && !buy.body.ok, 'cannot buy without coins');
const noreq = await j('/v1/buy', { method: 'POST', headers: auth, body: JSON.stringify({ kind: 'cue', id: 'rose' }) }); check(noreq.body && !noreq.body.ok, 'a request without its number is refused');
// 랭킹전: waiting alone, asked every two seconds as the app does, a stand-in sits down within the minute (ranked.js
// standInDelay: 10-60 s). (9볼, a new account at 30 다마; were a real player waiting close by, they would be paired - fine too.)
{
  const t0 = Date.now(); let last = null, got = null;
  while (Date.now() - t0 < 75000) {
    const q = await j('/v1/queue', { method: 'POST', headers: auth, body: JSON.stringify({ mode: 'nine', name: 'live-check', icon: 0, gear: {} }) });
    last = q; if (q.body && q.body.ok && q.body.room) { got = q.body; break; }
    if (!q.body || !q.body.ok) break;
    await new Promise(r => setTimeout(r, 2000));
  }
  const s = ((Date.now() - t0) / 1000).toFixed(1);
  check(!!got, got ? `랭킹전: an opponent after ${s} s (${got.standIn ? 'a stand-in, ' + got.opp.name : 'a player'})`
    : `랭킹전: nobody after ${s} s - last answer ${last && last.status} ${JSON.stringify(last && last.body).slice(0, 200)}`);
}
process.exit(bad ? 1 : 0);
