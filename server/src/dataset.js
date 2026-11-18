/* The shot dataset's Durable Object - one a month; what it keeps and why: dataset-core.js. */
import { DurableObject } from 'cloudflare:workers';
import { DatasetCore } from './dataset-core.js';

export class Dataset extends DurableObject {
  constructor(ctx, env) { super(ctx, env); this.core = new DatasetCore(ctx.storage.sql); }
  async fetch(request) {
    const path = new URL(request.url).pathname, body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};
    const json = b => new Response(JSON.stringify(b), { headers: { 'Content-Type': 'application/json' } });
    if (path === '/put') return json(this.core.put(body));
    if (path === '/stats') return json(this.core.stats());
    if (path === '/export') return json(this.core.export(body.after, body.limit));
    return json({ ok: false, why: 'no such thing' });
  }
}
