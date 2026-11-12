/* CUE's server (Cloudflare Worker). Every account is a vault (a Durable Object, src/vault.js); this front door makes new
   accounts and passes each request to the vault it belongs to.

   POST /v1/account                 -> { id, key }   a new account; the app keeps both (key is shown once, kept only hashed)
   GET  /v1/me                      -> { coin, dia, dama, owned, solved }
   POST /v1/buy     { req, kind, id }                 buy an item from content/ at its rarity's price
   POST /v1/puzzle  { req, id, shot }                 a puzzle solved: checked, paid once
   POST /v1/match   { req, kind: friend | cpu, log }  a match played on the device: paid by economy.js
   POST /v1/queue   { mode, name, icon, gear }        waiting for a ranked game (ask every 2 s): { waiting } or the room
   POST /v1/queue/leave { mode }                      stop waiting
   POST /v1/invite/open { mode, rules, name, icon, gear } a game with a friend: a code ({ code }); then
   POST /v1/invite/ask  { code }                      (every 2 s) { waiting } or the room, as /v1/queue
   POST /v1/invite/peek { code }                      what a code is: { mode, rules, host }
   POST /v1/invite/join { code, name, icon, gear }    a friend takes a seat: { waiting, seat, seats } (then ask, ready)
   POST /v1/invite/leave { code }                     the host gives up waiting
   POST /v1/invite/list  {}                           the listed rooms ({ rooms: [{ id, mode, rules, lock, host, playing?, guest? }] })
   POST /v1/invite/watch { id, pw }                   a listed game being played, to watch: { room, watch }
   (open takes size: 4 for 2:2 - friends join into seats and ask as the host does, { waiting, seats })
   POST /v1/invite/bot  { code, seat, level }         2:2: the host puts the computer in a seat (level -1: takes it out)
   POST /v1/invite/start { code }                     the host starts, every seat filled and every friend ready: the room
   POST /v1/invite/ready { code, on }                 a friend seated: ready or not
   POST /v1/invite/kick  { code, seat }               the host sends a friend away (they cannot come back to this room)
   (open takes listed and pw too: the room shown in that list, with a password; join takes { id, pw } from the list)
   POST /v1/lessons { req, vol, proofs }              a volume of lessons all done: its prize
   POST /v1/nick    { nick }                          a member's name (2-10 characters)
   POST /v1/tutorial { req }                          the tutorial done: its prize, once
   POST /v1/save    { data }                          the app's progress, for the account's other devices
   GET  /v1/room/<id>?token=<seat's token>            (WebSocket) playing a ranked game: room.js
   GET  /v1/room/<id>?watch=<watch key>               (WebSocket) watching one
   Every request but the first carries  Authorization: Bearer <id>.<key>. `req` is the app's own number for the request:
   sending the same one again changes nothing. */
import { googleWhoAny as googleWho } from './google.js';
import * as E from './gen/engine.js';
import { PHYS_V } from './version.js';
// (a device on other physics - version.js - is told to update rather than matched: queue and invites)
const samePhysics = body => (body && Number.isInteger(body.phys) ? body.phys : 1) === PHYS_V;
export { Vault } from './vault.js';
export { Lobby } from './lobby.js';
export { Room } from './room.js';

const MODES = ['eight', 'nine', 'four', 'three'];
// (the lobbies: those, and 아케이드's 증강 당구 - not for friends' rooms)
const QUEUE_MODES = MODES.concat('arcade');
/* Where the player asking is (Cloudflare's own word for the continent), as a Durable Object location hint: a game's room
   is made where its hint says - near the players - instead of near the lobby that opens it, which can be anywhere (made
   by whoever asked first; a test from the US put it there). Every aim and shot goes through the room, both ways. */
const nearOf = request => {
  const cf = request.cf || {}, c = cf.continent;
  return c === 'AS' ? 'apac' : c === 'OC' ? 'oc' : c === 'EU' ? 'weur' : c === 'SA' ? 'sam' : c === 'AF' ? 'afr' : c === 'NA' ? (+cf.longitude < -100 ? 'wnam' : 'enam') : null;
};

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Admin, X-Admin-Pass', 'Access-Control-Max-Age': '86400' };
const json = (body, status) => new Response(JSON.stringify(body), { status: status || 200, headers: Object.assign({ 'Content-Type': 'application/json' }, CORS) });
const hex = bytes => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
const hashOf = async key => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))));

/* The admin console (web/admin.html, on the site at /admin): each request carries a Google sign-in (X-Admin: an access
   token from Google's account chooser, or an ID token), checked as a sign-up's is (google.js), and the address it names must be one of
   ADMIN_EMAILS_SHA256 (wrangler.toml: SHA-256 of each address, lower case - the address itself is not in the code).
   POST /v1/admin/find  { q }                          accounts by name or id (the directory lobby: vault.js listed)
   POST /v1/admin/view  { acct }                       one account: balances, rating, items, ledger, recent games
   POST /v1/admin/grant { acct, coin, dia, kind, id, take, dama, debug, why }   give or take; set the rating; debug mode on or off (core.js adminGrant)
   GET  /v1/admin/catalog                              every item there is, to give */
export const isAdmin = async (email, allowed) => allowed.includes(await hashOf(String(email).trim().toLowerCase()));
/* Or a password (owner 11-10: on a phone or tablet the Google window would not let another account be chosen without
   adding it to the device, 2-step check and all): X-Admin-Pass, compared with the ADMIN_PASSWORD secret, set in the
   Cloudflare dashboard (cue-server · Settings · Variables and Secrets) - never in the code. At least 10 characters; after
   8 wrong ones in 15 minutes it is refused for everyone until they have passed (the directory lobby counts them). */
async function adminPass(pass, env) {
  const want = String(env.ADMIN_PASSWORD || '');
  if (want.length < 10 || !pass) return { why: want.length < 10 ? 'no password set' : 'no password' };
  const D = env.LOBBY.get(env.LOBBY.idFromName('directory'));
  const lock = await (await D.fetch('https://lobby/dir/fails', { method: 'POST', body: '{}' })).json();
  if (lock.n >= 8) return { why: 'locked' };
  const [a, b] = await Promise.all([hashOf('cue-admin:' + pass), hashOf('cue-admin:' + want)]);
  let same = 0; for (let i = 0; i < a.length; i++) same |= a.charCodeAt(i) ^ b.charCodeAt(i);
  if (same) { await D.fetch('https://lobby/dir/fails', { method: 'POST', body: '{"add":1}' }); return { why: 'wrong password' }; }
  return { email: 'password' };
}
async function adminRoute(what, request, env) {
  const allowed = String(env.ADMIN_EMAILS_SHA256 || '').split(',').map(s => s.trim()).filter(Boolean);
  const pass = request.headers.get('X-Admin-Pass');
  let who, by;
  if (pass != null) {
    who = await adminPass(pass, env).catch(() => ({ why: 'no password' }));
    if (!who.email) return json({ ok: false, why: who.why }, 403);
    by = 'admin pw';
  } else {
    if (!allowed.length || !env.GOOGLE_CLIENT_ID) return json({ ok: false, why: 'no admin' }, 403);
    who = await googleWho(request.headers.get('X-Admin') || '', env.GOOGLE_CLIENT_ID).catch(() => null);
    // (the address Google gave is said back - it is the person's own, just signed in with - so a wrong account is seen at once)
    if (!who || !who.email || !(await isAdmin(who.email, allowed))) return json({ ok: false, why: 'not an admin', seen: who && who.email || null, google: who && who.why || null }, 403);
    // (who did it, as the ledger keeps it: not the address - a player may see their own ledger - but the start of its hash)
    by = 'admin ' + (await hashOf(who.email.trim().toLowerCase())).slice(0, 8);
  }
  const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
  if (what === 'catalog') { const it = L => L.map(q => ({ id: q.id, name: q.name, rarity: q.rarity || 0 }));
    return json({ ok: true, me: who.email === 'password' ? '비밀번호' : who.email, items: { cue: it(E.CUES), ball: it(E.BALLSKINS), table: it(E.CLOTHS), trail: it(E.TRAILS), glove: it(E.GLOVES) } }); }
  if (what === 'find') {
    const r = await env.LOBBY.get(env.LOBBY.idFromName('directory')).fetch('https://lobby/dir/find', { method: 'POST', body: JSON.stringify({ q: String(body.q || '').slice(0, 40) }) });
    return json(await r.json());
  }
  const acct = String(body.acct || ''); if (!/^[0-9a-f]{32}$/.test(acct)) return json({ ok: false, why: 'no such account' }, 400);
  const vault = env.VAULT.get(env.VAULT.idFromName(acct));
  const r = await vault.fetch('https://vault/admin/' + what, { method: 'POST', headers: { 'X-Acct': acct }, body: JSON.stringify(Object.assign({}, body, { by })) });
  return json(await r.json());
}

/* POST /v1/link/make                  (this device's key) a code to give another device: { code, until }
   POST /v1/link/use { code }          a code from another device: this device gets a key of its own for that account
                                       { id, key } - the device keeps its old account's key aside (07-net.js)
   POST /v1/link/google { token }      a Google sign-in (google.js): the account tied to it - tied now to this device's
                                       account (its key sent) if it had none - and a key for it when it is another account
                                       { id, key? , tied }
   GET  /v1/link/google-config         { clientId } (null: no Google sign-in set up) */
async function linkRoute(what, request, env, m) {
  const links = env.LOBBY.get(env.LOBBY.idFromName('links')), ask = (p, b) => links.fetch('https://lobby/link/' + p, { method: 'POST', body: JSON.stringify(b) }).then(r => r.json());
  // (the account this request's key opens, or null)
  const mine = async () => { if (!m) return null; const t = await (await env.VAULT.get(env.VAULT.idFromName(m[1])).fetch('https://vault/v1/ticket', { headers: { 'X-Key': m[2] } })).json(); return t.ok ? m[1] : null; };
  // a new key for this device on account `acct`
  const keyFor = async acct => { const key = hex(crypto.getRandomValues(new Uint8Array(32)));
    const r = await (await env.VAULT.get(env.VAULT.idFromName(acct)).fetch('https://vault/link/add', { method: 'POST', body: JSON.stringify({ hash: await hashOf(key) }) })).json();
    return r.ok ? { id: acct, key, devices: r.devices } : null; };
  if (what === 'google-config') return json({ ok: true, clientId: env.GOOGLE_CLIENT_ID || null });
  const body = await request.json().catch(() => ({}));
  if (what === 'make') { const acct = await mine(); if (!acct) return json({ ok: false, why: 'who are you' }, 401); return json(await ask('make', { acct })); }
  if (what === 'use') {
    const r = await ask('use', { code: String(body.code || '').slice(0, 20) }); if (!r.ok) return json(r, r.why === 'slow down' ? 429 : 200);
    const k = await keyFor(r.acct); return k ? json(Object.assign({ ok: true }, k)) : json({ ok: false, why: 'no such account' });
  }
  if (what === 'google') {
    const who = await googleWho(body.token, env.GOOGLE_CLIENT_ID); if (!who.sub) return json({ ok: false, why: who.why });
    const acct = await mine(), r = await ask('google', { sub: who.sub, acct }); if (!r.ok) return json(r);
    // tied just now to this device's account: it has signed up - its prize, once (core.js joinPrize)
    if (r.acct === acct) {
      const j = r.tied ? await (await env.VAULT.get(env.VAULT.idFromName(acct)).fetch('https://vault/link/joined', { method: 'POST', body: '{}' })).json() : null;
      return json({ ok: true, id: acct, tied: r.tied, same: true, joined: j && j.paid });
    }
    const k = await keyFor(r.acct); return k ? json(Object.assign({ ok: true, tied: false }, k)) : json({ ok: false, why: 'no such account' });
  }
  return json({ ok: false, why: 'no such thing' }, 404);
}

/* Anything that throws on the way - here or in a Durable Object behind - comes back as an answer the app can read: with
   its CORS headers and what went wrong. (Cloudflare's own error page has no CORS headers, so a page saw only a failed
   fetch, and could not say why: 54-ranked.js, 55-invite.js show it now.) */
export default {
  async fetch(request, env) {
    try { return await frontDoor(request, env); }
    catch (e) { console.error('front door', new URL(request.url).pathname, e && e.stack || e); return json({ ok: false, why: 'error', error: String(e && e.message || e).slice(0, 200) }, 500); }
  },
};
async function frontDoor(request, env) {
  {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(request.url);
    if (url.pathname === '/' || url.pathname === '/v1') return json({ ok: true, name: 'cue-server' });
    if (url.pathname === '/v1/account' && request.method === 'POST') {
      const id = hex(crypto.getRandomValues(new Uint8Array(16))), key = hex(crypto.getRandomValues(new Uint8Array(32)));
      const r = await env.VAULT.get(env.VAULT.idFromName(id)).fetch('https://vault/init', { method: 'POST', body: JSON.stringify({ key }) });
      return r.ok ? json({ ok: true, id, key }) : json({ ok: false, why: 'could not open an account' }, 500);
    }
    // a ranked game's room: the seat's token (from the lobby) is its key
    const room = /^\/v1\/room\/([0-9a-f]{32})$/.exec(url.pathname);
    if (room) return env.ROOM.get(env.ROOM.idFromName(room[1])).fetch(request);
    if (!url.pathname.startsWith('/v1/')) return json({ ok: false, why: 'no such thing' }, 404);
    const m = /^Bearer ([0-9a-f]{32})\.([0-9a-f]{64})$/.exec(request.headers.get('Authorization') || '');
    // linking devices to one account (link.js): before the key is required - the device being linked may have none
    const adm = /^\/v1\/admin\/(find|view|grant|catalog)$/.exec(url.pathname);
    if (adm) return adminRoute(adm[1], request, env);
    const link = /^\/v1\/link\/(make|use|google|google-config)$/.exec(url.pathname);
    if (link) return linkRoute(link[1], request, env, m);
    if (!m) return json({ ok: false, why: 'who are you' }, 401);
    const vault = env.VAULT.get(env.VAULT.idFromName(m[1]));
    const inv = /^\/v1\/invite\/(open|ask|peek|join|leave|list|watch|start|bot|ready|kick)$/.exec(url.pathname);
    if (inv) {
      const body = await request.json().catch(() => ({})), code = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      if (inv[1] === 'open' && !MODES.includes(body.mode)) return json({ ok: false, why: 'no such game' }, 400);
      if ((inv[1] === 'open' || inv[1] === 'join' || inv[1] === 'watch') && !samePhysics(body)) return json({ ok: false, why: 'update', phys: PHYS_V });
      const t = await (await vault.fetch('https://vault/v1/ticket', { headers: { 'X-Key': m[2], 'X-Gear': JSON.stringify(body.gear || {}).slice(0, 400) } })).json();
      if (!t.ok) return json(t, 401);
      // (a member plays under their own nickname, kept in their vault; a guest under the name the app gives)
      const name = t.nick || String(body.name || '').trim().slice(0, 12) || '플레이어', icon = Math.max(0, Math.min(63, body.icon | 0));
      const r = await env.LOBBY.get(env.LOBBY.idFromName('invites')).fetch('https://lobby/invite/' + inv[1], { method: 'POST',
        body: JSON.stringify({ acct: m[1], dama: t.dama, rd: t.rd, name, icon, gear: t.gear || null, mode: body.mode, rules: body.rules || null, code, near: nearOf(request),
          size: body.size === 4 ? 4 : 2, seat: body.seat | 0, on: !!body.on, level: body.level == null ? null : body.level | 0, listed: !!body.listed, pw: typeof body.pw === 'string' ? body.pw.slice(0, 12) : '', title: typeof body.title === 'string' ? body.title.slice(0, 32) : '', id: /^[0-9a-f]{12}$/.test(body.id || '') ? body.id : '' }) });
      return new Response(r.body, { status: r.status, headers: Object.assign({ 'Content-Type': 'application/json' }, CORS) });
    }
    if (url.pathname === '/v1/queue' || url.pathname === '/v1/queue/leave') {
      const body = await request.json().catch(() => ({}));
      if (!QUEUE_MODES.includes(body.mode)) return json({ ok: false, why: 'no such game' }, 400);
      if (!url.pathname.endsWith('leave') && !samePhysics(body)) return json({ ok: false, why: 'update', phys: PHYS_V });
      const t = await (await vault.fetch('https://vault/v1/ticket', { headers: { 'X-Key': m[2], 'X-Gear': JSON.stringify(body.gear || {}).slice(0, 400) } })).json();
      if (!t.ok) return json(t, 401);
      const name = t.nick || String(body.name || '').trim().slice(0, 12) || '플레이어', icon = Math.max(0, Math.min(63, body.icon | 0));
      const lobby = env.LOBBY.get(env.LOBBY.idFromName(body.mode));
      const r = await lobby.fetch('https://lobby' + (url.pathname.endsWith('leave') ? '/leave' : '/ask'), { method: 'POST', body: JSON.stringify({ near: nearOf(request), acct: m[1], dama: t.dama, rd: t.rd, name, icon, gear: t.gear || null, mode: body.mode, seek: typeof body.seek === 'string' ? body.seek.slice(0, 32) : undefined }) });
      return new Response(r.body, { status: r.status, headers: Object.assign({ 'Content-Type': 'application/json' }, CORS) });
    }
    const r = await vault.fetch('https://vault' + url.pathname, {
      method: request.method, headers: { 'X-Key': m[2], 'X-Acct': m[1], 'Content-Type': 'application/json' }, body: request.method === 'POST' ? await request.text() : undefined });
    return new Response(r.body, { status: r.status, headers: Object.assign({ 'Content-Type': 'application/json' }, CORS) });
  }
}
