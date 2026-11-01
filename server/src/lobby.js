/* The ranked lobby's Durable Object: one for each game. The rules are LobbyCore (ranked.js). */
import { DurableObject } from 'cloudflare:workers';
import { LobbyCore } from './ranked.js';

export class Lobby extends DurableObject {
  constructor(ctx, env) { super(ctx, env); this.core = null; }
  async fetch(request) {
    const body = await request.json().catch(() => ({}));
    if (!this.core) this.core = new LobbyCore(body.mode);
    if (new URL(request.url).pathname === '/leave') { this.core.leave(body.acct); return Response.json({ ok: true }); }
    const before = this.core.lastInit, r = this.core.ask(body);
    // a new pair: its room is opened before either player hears of it
    if (this.core.lastInit !== before) {
      const init = this.core.lastInit;
      const res = await this.env.ROOM.get(this.env.ROOM.idFromName(init.room)).fetch('https://room/init', { method: 'POST', body: JSON.stringify(init) });
      if (!res.ok) return Response.json({ ok: false, why: 'could not open a room' }, { status: 500 });
    }
    return Response.json(Object.assign({ ok: true }, r));
  }
}
