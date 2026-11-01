/* CUE's server (Cloudflare Worker). Every account is a vault (a Durable Object, src/vault.js); this front door makes new
   accounts and passes each request to the vault it belongs to.

   POST /v1/account                 -> { id, key }   a new account; the app keeps both (key is shown once, kept only hashed)
   GET  /v1/me                      -> { coin, dia, dama, owned, solved }
   POST /v1/buy     { req, kind, id }                 buy an item from content/ at its rarity's price
   POST /v1/puzzle  { req, id, shot }                 a puzzle solved: checked, paid once
   POST /v1/match   { req, kind: friend | cpu, log }  a match played on the device: paid by economy.js
   Every request but the first carries  Authorization: Bearer <id>.<key>. `req` is the app's own number for the request:
   sending the same one again changes nothing. */
export { Vault } from './vault.js';

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
    const m = /^Bearer ([0-9a-f]{32})\.([0-9a-f]{64})$/.exec(request.headers.get('Authorization') || '');
    if (!m) return json({ ok: false, why: 'who are you' }, 401);
    const r = await env.VAULT.get(env.VAULT.idFromName(m[1])).fetch('https://vault' + url.pathname, {
      method: request.method, headers: { 'X-Key': m[2], 'Content-Type': 'application/json' }, body: request.method === 'POST' ? await request.text() : undefined });
    return new Response(r.body, { status: r.status, headers: Object.assign({ 'Content-Type': 'application/json' }, CORS) });
  },
};
