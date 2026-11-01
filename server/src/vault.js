/* The vault as a Durable Object: one per account, its own SQLite, one request at a time. The rules are in core.js. */
import { DurableObject } from 'cloudflare:workers';
import { VaultCore } from './core.js';

const hashOf = async key => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key)))].map(b => b.toString(16).padStart(2, '0')).join('');
const json = (body, status) => new Response(JSON.stringify(body), { status: status || 200, headers: { 'Content-Type': 'application/json' } });

// A small verification batch keeps wallet requests responsive. Durable Objects have their own CPU limit (30s default),
// distinct from the front-door Worker's free 10ms limit; batch sizing is a latency/usage choice.
const SLICE = 150;

export class Vault extends DurableObject {
  constructor(ctx, env) { super(ctx, env); this.core = new VaultCore(ctx.storage.sql, env, fn => ctx.storage.transactionSync(fn)); }
  // checking queued matches, a slice per alarm, until none is left
  async wake() { if (!(await this.ctx.storage.getAlarm())) await this.ctx.storage.setAlarm(Date.now() + 20); }
  async alarm() { if (this.core.work(+(this.env.SLICE_STEPS || SLICE))) await this.ctx.storage.setAlarm(Date.now() + 20); }
  async fetch(request) {
    const path = new URL(request.url).pathname, body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
    if (path === '/init') return this.core.init(await hashOf(body.key)) ? json({ ok: true }) : json({ ok: false }, 409);
    if (!this.core.authed(await hashOf(request.headers.get('X-Key') || ''))) return json({ ok: false, why: 'who are you' }, 401);
    // (from here on nothing waits, so each request runs whole before the next one starts)
    if (path === '/v1/me') { const me = this.core.me(); if (me.checking) await this.wake(); return json({ ok: true, me }); }
    if (path === '/v1/buy') return json(this.core.buy(body));
    if (path === '/v1/puzzle') return json(this.core.puzzle(body));
    if (path === '/v1/match') { const r = this.core.match(body); if (r.pending) await this.wake(); return json(r); }
    return json({ ok: false, why: 'no such thing' }, 404);
  }
}
