/* The puzzles' book as a Durable Object - one, 'book'; what it keeps and why: puzzlebook-core.js. */
import { DurableObject } from 'cloudflare:workers';
import { PuzzleBookCore } from './puzzlebook-core.js';
import * as E from './gen/engine.js';

export class PuzzleBook extends DurableObject {
  constructor(ctx, env) { super(ctx, env); this.core = new PuzzleBookCore(ctx.storage.sql, E); }
  async fetch(request) {
    const path = new URL(request.url).pathname, body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
    const json = b => new Response(JSON.stringify(b), { headers: { 'Content-Type': 'application/json' } });
    if (path === '/try') return json(this.core.try(body));
    if (path === '/live') return json(this.core.live());
    if (path === '/stats') return json(this.core.stats());
    if (path === '/export') return json(this.core.export(body.after, body.limit));
    if (path === '/admin') return json(this.core.admin(body));
    return json({ ok: false, why: 'no such thing' });
  }
}
