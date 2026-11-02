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
   POST /v1/drop    { req }                           a 당구드롭 opened: { rarity, prize }
   POST /v1/lessons { req, vol, proofs }              a volume of lessons all done: its prize
   GET  /v1/room/<id>?token=<seat's token>            (WebSocket) playing a ranked game: room.js
   Every request but the first carries  Authorization: Bearer <id>.<key>. `req` is the app's own number for the request:
   sending the same one again changes nothing. */
export { Vault } from './vault.js';
export { Lobby } from './lobby.js';
export { Room } from './room.js';

const MODES = ['eight', 'nine', 'four', 'three'];

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '86400' };
const json = (body, status) => new Response(JSON.stringify(body), { status: status || 200, headers: Object.assign({ 'Content-Type': 'application/json' }, CORS) });
const hex = bytes => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');

export default {
  async fetch(request, env) {
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
      const r = await lobby.fetch('https://lobby' + (url.pathname.endsWith('leave') ? '/leave' : '/ask'), { method: 'POST', body: JSON.stringify({ acct: m[1], dama: t.dama, name, icon, gear: t.gear || null, mode: body.mode }) });
      return new Response(r.body, { status: r.status, headers: Object.assign({ 'Content-Type': 'application/json' }, CORS) });
    }
    const r = await vault.fetch('https://vault' + url.pathname, {
      method: request.method, headers: { 'X-Key': m[2], 'Content-Type': 'application/json' }, body: request.method === 'POST' ? await request.text() : undefined });
    return new Response(r.body, { status: r.status, headers: Object.assign({ 'Content-Type': 'application/json' }, CORS) });
  },
};
