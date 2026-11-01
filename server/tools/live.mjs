/* After a deploy: is the server up and behaving? A new account, its wallet, a wrong key turned away, a request without
   its number refused. node tools/live.mjs <address> */
const U = process.argv[2]; let bad = 0; const check = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) bad++; };
const j = async (p, o) => { const r = await fetch(U + p, o); return { status: r.status, body: await r.json().catch(() => null) }; };
const hello = await j('/'); check(hello.body && hello.body.ok, 'answers');
const acc = await j('/v1/account', { method: 'POST' }); check(acc.body && acc.body.ok && acc.body.id && acc.body.key, 'opens an account');
const auth = { Authorization: `Bearer ${acc.body.id}.${acc.body.key}`, 'Content-Type': 'application/json' };
const me = await j('/v1/me', { headers: auth }); check(me.body && me.body.ok && me.body.me.coin === 0 && me.body.me.dama === 1000, 'a new wallet: 0 coins, DAMA 1000');
const wrong = await j('/v1/me', { headers: { Authorization: `Bearer ${acc.body.id}.${'0'.repeat(64)}` } }); check(wrong.status === 401, 'a wrong key is turned away');
const buy = await j('/v1/buy', { method: 'POST', headers: auth, body: JSON.stringify({ req: 'live-check-1', kind: 'cue', id: 'rose' }) }); check(buy.body && !buy.body.ok, 'cannot buy without coins');
const noreq = await j('/v1/buy', { method: 'POST', headers: auth, body: JSON.stringify({ kind: 'cue', id: 'rose' }) }); check(noreq.body && !noreq.body.ok, 'a request without its number is refused');
process.exit(bad ? 1 : 0);
