/* How many players the server takes (owner 11-20): N made-up players open accounts, read their wallets and wait for a
   ranked game together, asking every two seconds as the app does - they pair up with each other (or a stand-in sits in),
   and each answer's time is kept. Then: how many answered, how fast (median, 95th, slowest), how many failed, and how
   long the pairing took. What it costs the account shows in Cloudflare's dashboard afterwards (Workers & Durable
   Objects: requests, CPU, duration).

   It makes real accounts on the server it is pointed at, so it asks for the address in full and a count:
     node tools/load.mjs https://api.danguuu.com 200 [mode=nine] [seconds=90]
   (the accounts it makes are guests with nothing on them; the dataset only keeps played games, and these play none) */
import { PHYS_V } from '../src/version.js';
const [U, N0, mode = 'nine', secs = '90'] = process.argv.slice(2), N = +N0;
if (!/^https?:\/\//.test(U || '') || !(N > 0)) { console.log('node tools/load.mjs <address> <players> [mode] [seconds]'); process.exit(2); }
const times = [], fails = {}, paired = [];
const timed = async (p, o) => { const t = performance.now(); try { const r = await fetch(U + p, o); const b = await r.json().catch(() => null); times.push(performance.now() - t); if (!r.ok || !b || b.ok === false) fails[`${p} ${r.status} ${b && b.why || ''}`] = (fails[`${p} ${r.status} ${b && b.why || ''}`] || 0) + 1; return b; }
  catch (e) { fails[`${p} ${e.message}`] = (fails[`${p} ${e.message}`] || 0) + 1; return null; } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function player(i) {
  await sleep(Math.random() * 5000);   // (they arrive over five seconds, not all in one instant)
  const a = await timed('/v1/account', { method: 'POST' }); if (!a || !a.id) return;
  const H = { Authorization: `Bearer ${a.id}.${a.key}`, 'Content-Type': 'application/json' };
  await timed('/v1/me', { headers: H });
  const t0 = Date.now();
  while (Date.now() - t0 < secs * 1000) {
    const q = await timed('/v1/queue', { method: 'POST', headers: H, body: JSON.stringify({ mode, phys: PHYS_V, name: 'load-' + i, icon: 0, gear: {} }) });
    if (q && q.room) { paired.push({ s: (Date.now() - t0) / 1000, standIn: !!q.standIn }); break; }
    if (!q) break;
    await sleep(2000);
  }
  await timed('/v1/queue/leave', { method: 'POST', headers: H, body: JSON.stringify({ mode }) });
}
const t0 = Date.now();
await Promise.all([...Array(N)].map((_, i) => player(i)));
const s = times.slice().sort((a, b) => a - b), q = f => s[Math.min(s.length - 1, Math.floor(f * s.length))] || 0;
console.log(`${N} players, ${mode}, ${((Date.now() - t0) / 1000).toFixed(0)} s: ${times.length} answers, ${(times.length / ((Date.now() - t0) / 1000)).toFixed(1)} a second`);
console.log(`answer time ms: median ${q(0.5).toFixed(0)}, 95th ${q(0.95).toFixed(0)}, slowest ${(s[s.length - 1] || 0).toFixed(0)}`);
console.log(`paired ${paired.length}/${N} (${paired.filter(p => p.standIn).length} with a stand-in), waited median ${(paired.map(p => p.s).sort((a, b) => a - b)[paired.length >> 1] || 0).toFixed(1)} s`);
console.log('failed:', Object.keys(fails).length ? fails : 'none');
