/* A ranked game's Durable Object: one for each game being played. The rules are RoomCore (ranked.js). */
import { DurableObject } from 'cloudflare:workers';
import { toDataset } from './dataset-core.js';
import { RoomCore, RETURN_WITHIN, JOIN_WITHIN, WATCH_MAX } from './ranked.js';

const SLICE = 150;

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // (seat 'w': everyone watching)
    const send = (seat, msg) => { for (const ws of ctx.getWebSockets(seat === 'w' ? 'w' : 's' + seat)) try { ws.send(JSON.stringify(msg)); } catch (e) {} };
    this.core = new RoomCore(ctx.storage.sql, send, fn => ctx.storage.transactionSync(fn));
  }
  async soon(ms) { const a = await this.ctx.storage.getAlarm(); if (!a || a > Date.now() + ms) await this.ctx.storage.setAlarm(Date.now() + ms); }
  async fetch(request) {
    const url = new URL(request.url);
    // (opened: the room looks again once a seat has had its time to come in - RoomCore.timers)
    if (url.pathname === '/init') { if (!this.core.init(await request.json())) return Response.json({ ok: false }, { status: 409 }); await this.soon(JOIN_WITHIN + 500); return Response.json({ ok: true }); }
    // /v1/room/<id>?token=...: a seat's device, by WebSocket
    if (request.headers.get('Upgrade') !== 'websocket') return Response.json({ ok: false, why: 'websocket only' }, { status: 426 });
    if (!this.core.get('room')) return Response.json({ ok: false, why: 'no such room' }, { status: 404 });
    // ?watch=<key>: someone watching a friend's game from the list (InviteCore.watch) - hears everything, says nothing
    const wkey = url.searchParams.get('watch');
    if (wkey) {
      if (!this.core.watches(wkey)) return Response.json({ ok: false, why: 'who are you' }, { status: 401 });
      if (this.ctx.getWebSockets('w').length >= WATCH_MAX) return Response.json({ ok: false, why: 'full' }, { status: 429 });
      const [client, server] = Object.values(new WebSocketPair());
      this.ctx.acceptWebSocket(server, ['w']);
      server.send(JSON.stringify(this.core.watchState()));
      return new Response(null, { status: 101, webSocket: client });
    }
    const seat = this.core.seatOf(url.searchParams.get('token') || '');
    if (seat < 0) return Response.json({ ok: false, why: 'who are you' }, { status: 401 });
    for (const old of this.ctx.getWebSockets('s' + seat)) try { old.close(4000, 'replaced'); } catch (e) {}
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server, ['s' + seat]);
    this.core.connected(seat);
    { const r = this.core.get('room'); if (r && r.siServer) await this.soon(30); }   // (the stand-in may be the first to play)
    { const a = this.core.arcIn(); if (a != null) await this.soon(a + 50); }   // (증강 당구's vote: its clock started)
    return new Response(null, { status: 101, webSocket: client });
  }
  seatOfSocket(ws) { const t = this.ctx.getTags(ws).find(x => /^s[0-3]$/.test(x)); return t ? +t[1] : -1; }
  async webSocketMessage(ws, data) {
    const seat = this.seatOfSocket(ws); if (seat < 0 || typeof data !== 'string' || data.length > 64000) return;
    let m; try { m = JSON.parse(data); } catch (e) { return; }
    const said = this.core.message(seat, m);
    // (the end: the first slice of the check at once - what is left after the replay kept up with play is usually less -
    // and the result's payouts on the alarm straight after)
    if (said === 'check') return this.soon(this.core.work(SLICE) ? 20 : 0);
    // (a shot: played soon, while the game goes on - RoomCore.ahead)
    if ((m.t === 'shot' || m.t === 'timeout') && this.core.get('status') === 'playing') await this.soon(30);
    // 다시 하기: everyone agreed - the next room opened, then every seat told where
    if (said === 'again') {
      const x = this.core.nextInit();
      const res = await this.env.ROOM.get(this.env.ROOM.idFromName(x.room)).fetch('https://room/init', { method: 'POST', body: JSON.stringify(x) }).catch(() => null);
      if (res && res.ok) this.core.nextGo(x); else this.core.nextFailed();
      return;
    }
    { const a = this.core.arcIn(); if (a != null) await this.soon(a + 50); }   // (증강 당구: a round opened)
  }
  async webSocketClose(ws) {
    const seat = this.seatOfSocket(ws); if (seat < 0) return;
    if (this.ctx.getWebSockets('s' + seat).some(x => x !== ws && x.readyState === 1)) return;     // (a newer connection is there)
    if (this.core.disconnected(seat)) await this.soon(RETURN_WITHIN + 500);
  }
  async webSocketError(ws) { return this.webSocketClose(ws); }
  async alarm() {
    if (this.core.timers() === 'check') return this.soon(20);
    const st = this.core.get('status');
    if (st === 'checking') { if (this.core.work(SLICE)) return this.soon(20); }
    if (st === 'playing') {
      if (this.core.ahead(SLICE)) return this.soon(20);        // (the timers are looked at again on that alarm)
      // (a stand-in the room plays: its turn, once the replay has caught up - a shot played, or its resignation checked)
      if (this.core.standInPlan()) return this.soon(20);
      const gone = this.core.get('gone'), wj = this.core.waitingJoin(), idle = this.core.idleIn();
      if (gone.some(Boolean)) return this.soon(5000);
      if (wj != null) return this.soon(wj + 500);
      const arc = this.core.arcIn(); if (arc != null) return this.soon(Math.min(arc + 50, idle != null ? idle + 500 : Infinity));   // (증강 당구's clocks)
      if (idle != null) return this.soon(idle + 500);          // (the room's shot clock: RoomCore.timers, IDLE_AFTER)
    }
    // paid out: each vault told, again a little later if one did not answer
    let left = false;
    for (const p of this.core.payouts()) {
      const r = await this.env.VAULT.get(this.env.VAULT.idFromName(p.acct)).fetch('https://vault/room/result', { method: 'POST', body: JSON.stringify(p.body) }).catch(() => null);
      if (r && r.ok) this.core.paid(p.seat); else left = true;
    }
    // the game's shots to the dataset (dataset.js), again later if it did not answer
    const ds = this.core.get('dataset', null);
    if (ds) { const r = await toDataset(this.env, ds); if (r && r.ok) this.core.set('dataset', null); else left = true; }
    // a friend's game ended: it leaves the list of games to watch (once; again later if the lobby did not answer)
    const room = this.core.get('room');
    if (this.core.get('result') && room && room.watch && !this.core.get('unlisted')) {
      const r = await this.env.LOBBY.get(this.env.LOBBY.idFromName('invites')).fetch('https://lobby/invite/ended', { method: 'POST', body: JSON.stringify({ room: room.room }) }).catch(() => null);
      if (r && r.ok) this.core.set('unlisted', true); else left = true;
    }
    if (left) return this.soon(30000);
  }
}
