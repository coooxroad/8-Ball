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
   POST /v1/invite/join { code, name, icon, gear }    the friend takes the other seat: the room
   POST /v1/invite/leave { code }                     the host gives up waiting
   POST /v1/lessons { req, vol, proofs }              a volume of lessons all done: its prize
   GET  /v1/room/<id>?token=<seat's token>            (WebSocket) playing a ranked game: room.js
   Every request but the first carries  Authorization: Bearer <id>.<key>. `req` is the app's own number for the request:
   sending the same one again changes nothing. */
import { googleWho } from './google.js';
export { Vault } from './vault.js';
export { Lobby } from './lobby.js';
export { Room } from './room.js';

const MODES = ['eight', 'nine', 'four', 'three'];

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '86400' };
const json = (body, status) => new Response(JSON.stringify(body), { status: status || 200, headers: Object.assign({ 'Content-Type': 'application/json' }, CORS) });
const hex = bytes => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
const hashOf = async key => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))));

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
    if (r.acct === acct) return json({ ok: true, id: acct, tied: r.tied, same: true });
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
    const link = /^\/v1\/link\/(make|use|google|google-config)$/.exec(url.pathname);
    if (link) return linkRoute(link[1], request, env, m);
    if (!m) return json({ ok: false, why: 'who are you' }, 401);
    const vault = env.VAULT.get(env.VAULT.idFromName(m[1]));
    const inv = /^\/v1\/invite\/(open|ask|peek|join|leave)$/.exec(url.pathname);
    if (inv) {
      const body = await request.json().catch(() => ({})), code = String(body.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      if (inv[1] === 'open' && !MODES.includes(body.mode)) return json({ ok: false, why: 'no such game' }, 400);
      const t = await (await vault.fetch('https://vault/v1/ticket', { headers: { 'X-Key': m[2], 'X-Gear': JSON.stringify(body.gear || {}).slice(0, 400) } })).json();
      if (!t.ok) return json(t, 401);
      const name = String(body.name || '').trim().slice(0, 12) || '플레이어', icon = Math.max(0, Math.min(63, body.icon | 0));
      const r = await env.LOBBY.get(env.LOBBY.idFromName('invites')).fetch('https://lobby/invite/' + inv[1], { method: 'POST',
        body: JSON.stringify({ acct: m[1], dama: t.dama, name, icon, gear: t.gear || null, mode: body.mode, rules: body.rules || null, code }) });
      return new Response(r.body, { status: r.status, headers: Object.assign({ 'Content-Type': 'application/json' }, CORS) });
    }
    if (url.pathname === '/v1/queue' || url.pathname === '/v1/queue/leave') {
      const body = await request.json().catch(() => ({}));
      if (!MODES.includes(body.mode)) return json({ ok: false, why: 'no such game' }, 400);
      const t = await (await vault.fetch('https://vault/v1/ticket', { headers: { 'X-Key': m[2], 'X-Gear': JSON.stringify(body.gear || {}).slice(0, 400) } })).json();
      if (!t.ok) return json(t, 401);
      const name = String(body.name || '').trim().slice(0, 12) || '플레이어', icon = Math.max(0, Math.min(63, body.icon | 0));
      const lobby = env.LOBBY.get(env.LOBBY.idFromName(body.mode));
      const r = await lobby.fetch('https://lobby' + (url.pathname.endsWith('leave') ? '/leave' : '/ask'), { method: 'POST', body: JSON.stringify({ acct: m[1], dama: t.dama, name, icon, gear: t.gear || null, mode: body.mode, seek: typeof body.seek === 'string' ? body.seek.slice(0, 32) : undefined }) });
      return new Response(r.body, { status: r.status, headers: Object.assign({ 'Content-Type': 'application/json' }, CORS) });
    }
    const r = await vault.fetch('https://vault' + url.pathname, {
      method: request.method, headers: { 'X-Key': m[2], 'Content-Type': 'application/json' }, body: request.method === 'POST' ? await request.text() : undefined });
    return new Response(r.body, { status: r.status, headers: Object.assign({ 'Content-Type': 'application/json' }, CORS) });
  }
}
