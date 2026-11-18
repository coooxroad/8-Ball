/* The vault as a Durable Object: one per account, its own SQLite, one request at a time. The rules are in core.js. */
import { DurableObject } from 'cloudflare:workers';
import { VaultCore } from './core.js';
import { E } from './check.js';
import { datasetRow, toDataset } from './dataset-core.js';
import { matchKey } from './match-log.js';

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
  /* the account in the directory the admin console searches (lobby 'directory'): its name and rating, now and then (every
     six hours at most, or at once when they change) - not waited for */
  listed(now) {
    const t = Date.now(); if (!now && t - (this.dirAt || 0) < 6 * 3600000) return; this.dirAt = t;
    const acct = this.acct; if (!acct) return;
    const me = this.core.me(), body = { acct, nick: me.nick || null, joined: !!me.joined, dama: me.dama, coin: me.coin, dia: me.dia };
    this.ctx.waitUntil(this.env.LOBBY.get(this.env.LOBBY.idFromName('directory')).fetch('https://lobby/dir/put', { method: 'POST', body: JSON.stringify(body) }).catch(() => null));
  }
  async fetch(request) {
    const path = new URL(request.url).pathname, body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
    if (!this.acct && /^[0-9a-f]{32}$/.test(request.headers.get('X-Acct') || '')) this.acct = request.headers.get('X-Acct');   // (the front door says which)
    if (path === '/init') return this.core.init(await hashOf(body.key)) ? json({ ok: true }) : json({ ok: false }, 409);
    // from a ranked game's room (never from outside: the front door passes on only /v1/ paths)
    if (path === '/room/result') return json(this.core.ranked(body));
    // from the front door only (it passes on only /v1/ paths): a device linked to this account (link.js)
    if (path === '/link/add') return json(this.core.addDevice(body.hash));
    if (path === '/link/joined') return json(this.core.joinPrize());
    // from the front door's admin console only (index.js checks who the admin is first)
    if (path === '/admin/view') { if (!this.core.get('secret')) return json({ ok: false, why: 'no such account' }); return json(this.core.adminView()); }
    if (path === '/admin/grant') { if (!this.core.get('secret')) return json({ ok: false, why: 'no such account' }); const r = this.core.adminGrant(body); if (r.ok) this.listed(true); return json(r); }
    if (!this.core.authed(await hashOf(request.headers.get('X-Key') || ''))) return json({ ok: false, why: 'who are you' }, 401);
    // (from here on nothing waits, so each request runs whole before the next one starts)
    if (path === '/v1/me') { const me = this.core.me(); if (me.checking) await this.wake(); this.listed(); return json({ ok: true, me }); }
    if (path === '/v1/buy') return json(this.core.buy(body));
    // waiting for a ranked game: the front door asks who this is, then goes to the lobby
    if (path === '/v1/ticket') {
      /* (and what they have on - only a look: the other player sees it. Any real item is passed on, bought or not, so a
         device showing what it does not own looks the same to the other side; a cue's stat only ever plays on
         its owner's own device.) */
      let want = {}; try { want = JSON.parse(request.headers.get('X-Gear') || '{}') || {}; } catch (e) {}
      const gear = {}; for (const k of ['cue', 'ball', 'table', 'trail']) gear[k] = typeof want[k] === 'string' && this.core.known(k, want[k]) ? want[k] : null;
      // (the rating of the family of the game asked for - X-Mode, economy.js familyOf - else the highest)
      const me = this.core.me(), mode = request.headers.get('X-Mode'), f = mode ? E.familyOf(mode) : null;
      // (in a 승급전, the tier played for: its rules, and opponents from it - economy.js PROMO_*)
      const p = f && me.promo[f], dama = f ? (p ? Math.max(me.damas[f], E.ECONOMY.TIER_AT[p.to]) : me.damas[f]) : me.dama;
      return json({ ok: true, dama, rd: f ? me.rds[f] : me.rd, gear, nick: me.joined ? me.nick : null });
    }
    if (path === '/v1/puzzle') return json(this.core.puzzle(body));
    if (path === '/v1/lessons') return json(this.core.lessons(body));
    if (path === '/v1/nick') { const r = this.core.nick(body); if (r.ok) this.listed(true); return json(r); }
    if (path === '/v1/tutorial') return json(this.core.tutorial(body));
    if (path === '/v1/save') return json(this.core.save(body));
    if (path === '/v1/match') {
      const fresh = !this.core.seen(body.req), r = this.core.match(body); if (r.pending) await this.wake();
      // (a match taken, the first time it is sent: its shots to the dataset, with the seats' ratings and nothing of the account)
      if (r.ok && fresh) {
        const log = body.log, me = this.core.me(), f = E.familyOf(log.mode), bot = log.bot && typeof log.bot === 'object' ? log.bot : null;
        const row = datasetRow(body.kind, log, [{ rating: me.damas ? me.damas[f] : me.dama, human: true }, body.kind === 'cpu' ? { rating: bot && +bot.rating, human: false, bot: bot && String(bot.id || '') } : { rating: null, human: true }]);
        if (row) { row.key = matchKey(log); this.ctx.waitUntil(toDataset(this.env, row)); }
      }
      return json(r);
    }
    // the account deleted (core.js erase): the vault emptied, then its Google account and its directory line let go
    if (path === '/v1/erase') {
      const r = this.core.erase(body); if (!r.ok) return json(r);
      await this.ctx.storage.deleteAlarm();
      const acct = this.acct, lob = n => this.env.LOBBY.get(this.env.LOBBY.idFromName(n));
      if (acct) await Promise.all([lob('links').fetch('https://lobby/link/forget', { method: 'POST', body: JSON.stringify({ acct }) }), lob('directory').fetch('https://lobby/dir/forget', { method: 'POST', body: JSON.stringify({ acct }) })].map(p => p.catch(() => null)));
      return json({ ok: true });
    }
    return json({ ok: false, why: 'no such thing' }, 404);
  }
}
