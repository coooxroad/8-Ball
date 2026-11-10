/* The ranked lobby's Durable Object: one for each game. The rules are LobbyCore (ranked.js). */
import { DurableObject } from 'cloudflare:workers';
import { LobbyCore, InviteCore } from './ranked.js';
import { LinkCore } from './link.js';
import { Directory } from './directory.js';
// a new room is made near the player whose ask made the pair (index.js nearOf); a hint Cloudflare does not know is left out
const NEAR = ['wnam', 'enam', 'sam', 'weur', 'eeur', 'apac', 'oc', 'afr', 'me'];
const roomNear = body => (body && NEAR.includes(body.near) ? { locationHint: body.near } : undefined);

export class Lobby extends DurableObject {
  constructor(ctx, env) { super(ctx, env); this.core = null; }
  async fetch(request) {
    const body = await request.json().catch(() => ({})), path = new URL(request.url).pathname;
    // the lobby named 'links': codes and Google accounts that link devices to an account (link.js; kept in its SQLite)
    if (path.startsWith('/link/')) {
      const K = this.links || (this.links = new LinkCore(this.ctx.storage.sql)), what = path.slice(6);
      if (what === 'make') return Response.json(Object.assign({ ok: true }, K.make(body.acct)));
      if (what === 'use') { const r = K.use(body.code); return Response.json(r.acct ? { ok: true, acct: r.acct } : { ok: false, why: r.why }); }
      if (what === 'google') { const r = K.google(body.sub, body.acct || null); return Response.json(r.acct ? Object.assign({ ok: true }, r) : { ok: false, why: r.why }); }
      return Response.json({ ok: false, why: 'no such thing' }, { status: 404 });
    }
    // the lobby named 'directory': every account's name and rating, for the admin console (vault.js listed; its SQLite)
    if (path.startsWith('/dir/')) {
      const D = this.dir || (this.dir = new Directory(this.ctx.storage.sql)), what = path.slice(5);
      if (what === 'put') return Response.json(D.put(body));
      if (what === 'find') return Response.json(D.find(body.q));
      if (what === 'fails') return Response.json(D.fails(!!body.add));
      return Response.json({ ok: false, why: 'no such thing' }, { status: 404 });
    }
    // the lobby named 'invites': codes for games with a friend (ranked.js InviteCore)
    if (path.startsWith('/invite/')) {
      const I = this.inv || (this.inv = Object.assign(new InviteCore(), { deferReady: true })), what = path.slice(8);
      if (what === 'open') return Response.json(I.open(body));
      if (what === 'ask') return Response.json(I.ask(body.acct, body.code));
      if (what === 'peek') return Response.json(I.peek(body.code));
      if (what === 'list') return Response.json(I.list());
      if (what === 'watch') return Response.json(I.watch(body.id, body.pw));
      if (what === 'ended') return Response.json(I.ended(body.room));
      // (taken from the list: its id, and the password if it has one, stand for the code)
      if (what === 'join' && body.id) { const c = I.byId(body.id, body.pw); if (!c.ok) return Response.json(c); body.code = c.code; }
      if (what === 'leave') return Response.json(I.leave(body.acct, body.code));
      if (what === 'bot') return Response.json(I.bot(body.acct, body.code, body.seat, body.level));
      if (what === 'join' || what === 'start') {
        const r = what === 'start' ? I.start(body.acct, body.code) : I.join(body, body.code);
        if (r.ok && r.init) {
          // (the room opened before anyone hears of it; if it could not be, the join is undone and may be tried again)
          const res = await this.env.ROOM.get(this.env.ROOM.idFromName(r.init.room), roomNear(body)).fetch('https://room/init', { method: 'POST', body: JSON.stringify(r.init) }).catch(() => null);
          if (!res || !(res.ok || res.status === 409)) { I.unjoin(body.code); return Response.json({ ok: false, why: 'could not open a room' }, { status: 500 }); }
          I.ready(body.code); delete r.init;
        }
        return Response.json(r);
      }
      return Response.json({ ok: false, why: 'no such thing' }, { status: 404 });
    }
    if (!this.core) this.core = Object.assign(new LobbyCore(body.mode), { deferReady: true });
    if (new URL(request.url).pathname === '/leave') { this.core.leave(body.acct); return Response.json({ ok: true }); }
    const before = this.core.lastInit, r = this.core.ask(body);
    // a new pair: its room is opened before either player hears of it
    if (this.core.lastInit !== before) {
      // (the room is opened before either player hears of it - the other asking meanwhile hears 'waiting'; if it could not
      // be opened, the pair is undone and both wait on as they were. A room already there (409) is this one, opened.)
      const init = this.core.lastInit;
      const res = await this.env.ROOM.get(this.env.ROOM.idFromName(init.room), roomNear(body)).fetch('https://room/init', { method: 'POST', body: JSON.stringify(init) }).catch(() => null);
      if (!res || !(res.ok || res.status === 409)) { this.core.unpair(init.room); return Response.json({ ok: false, why: 'could not open a room' }, { status: 500 }); }
      this.core.ready(init.room);
    }
    return Response.json(Object.assign({ ok: true }, r));
  }
}
