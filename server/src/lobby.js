/* The ranked lobby's Durable Object: one for each game. The rules are LobbyCore (ranked.js). */
import { DurableObject } from 'cloudflare:workers';
import { LobbyCore, InviteCore } from './ranked.js';

export class Lobby extends DurableObject {
  constructor(ctx, env) { super(ctx, env); this.core = null; }
  async fetch(request) {
    const body = await request.json().catch(() => ({})), path = new URL(request.url).pathname;
    // the lobby named 'invites': codes for games with a friend (ranked.js InviteCore)
    if (path.startsWith('/invite/')) {
      const I = this.inv || (this.inv = new InviteCore()), what = path.slice(8);
      if (what === 'open') return Response.json(I.open(body));
      if (what === 'ask') return Response.json(I.ask(body.acct, body.code));
      if (what === 'peek') return Response.json(I.peek(body.code));
      if (what === 'leave') return Response.json(I.leave(body.acct, body.code));
      if (what === 'join') {
        const r = I.join(body, body.code);
        if (r.ok && r.init) {
          const res = await this.env.ROOM.get(this.env.ROOM.idFromName(r.init.room)).fetch('https://room/init', { method: 'POST', body: JSON.stringify(r.init) });
          if (!res.ok) return Response.json({ ok: false, why: 'could not open a room' }, { status: 500 });
          delete r.init;
        }
        return Response.json(r);
      }
      return Response.json({ ok: false, why: 'no such thing' }, { status: 404 });
    }
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
