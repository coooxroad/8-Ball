/* ================= flow: puzzle - 퍼즐 레이팅 (owner 11-23/24, as Chess.com's puzzles are) =================
   No stages and no topics: a rating for each game (4구, 포켓), and the puzzle served is one near it, not seen before,
   hidden until it is started. Its score (below) moves the rating by as much as the puzzle was harder or easier than
   expected. Once it is over it can be tried again (no points), its answer shown, or passed for the next. Each 4구 puzzle fills a quarter of
   a ball in the case (white, yellow, red, red - 16 to a case), each 포켓 one a ball of the rack (15); a full one is closed
   and kept in the record, whose puzzles can be played again only without points. The case's material goes up with the
   stars won (PZ_MATS).
   (11-24 밤, owner: "a rating on it, I was too scared to play" - and billiards is not chess: the way known, a little off
   the angle still misses, and the same stroke does the same again, so putting it right is the skill.) The rating is kept
   out of sight - it only chooses the next puzzle; the player sees the puzzles solved and the stars won. A puzzle gives
   three tries: solved at the first ★★★ (score 1), the second ★★ (0.75), the third ★ (0.5), a hint seen first at most ★,
   missed three times nothing (0) - and then it stays: its answer or the next, the player's choice. A miss says how near
   it came (pzMiss: the same shot played again).
   The puzzles (puzzles.js: made and rated by the puzzle AI, tools/puzzles) may have a table of another shape, barricades,
   a cushion the cue ball must meet (marked on the table), or two turns - the second from where the first leaves the
   balls, a miss setting it all out again. Which comes next (pzr.next) follows what adaptive practice learnt (Pelánek:
   success about two times in three keeps people going best): a little below the rating most of the time, and the last
   quarter of each ball (each fifth of the rack) a little above it - a harder one to finish on. Up to 800 only plain
   positions (owner 11-23); above it everything, plain ones too when they are hard (owner 11-24: 난구 for the 2,000s). */
const PZ_CASE = 16, PZ_RACK = 15, PZ_BALL_KO = ['흰 공', '노란 공', '빨간 공', '빨간 공'];
const pzSize = k => k === 'pocket' ? PZ_RACK : PZ_CASE;
// a puzzle's provisional rating: its kind's band, spread over its place in the kind, a little shaken by its id
const PZ_BAND = [[420, 800], [950, 1300], [1000, 1380], [850, 1180], [620, 980], [1250, 1680], [1400, 1820], [1050, 1480]];
// the puzzles of a game the rated puzzles serve (those the puzzle AI rated); plain: nothing asked but the plain thing - a
// point (4구), one ball to pot (포켓)
const pzPool = (k = 'four') => puzzles.list.filter(q => puzzles.gameOf(q) === k && q.sol && q.rating != null && !(pzLive.off && pzLive.off.has(q.id)));
const pzPlain = q => puzzles.gameOf(q) === 'four' ? puzzles.plain(q) : (q.pot || []).length === 1 && !q.keep && !q.need && !q.walls && !q.table && !q.turns;
const pzRating = q => (pzLive.map && pzLive.map.get(q.id)) || q.rating || (b => Math.round(b[0] + (b[1] - b[0]) * ((q.n - 1) / 19) + ((q.id * 37) % 61) - 30))(PZ_BAND[q.stage] || [1000, 1400]);
// a puzzle's score by its stars (none, ★, ★★, ★★★ - the knob's, pzKnob), and the stars a place holds (the first set's
// results: o 3, h 1, x 0)
const PZ_STAR_S = [0, 0.5, 0.75, 1], PZ_TRIES = 3;
/* The knobs the admin turns (owner 11-24 밤 - the server's puzzles' book, puzzlebook-core.js CFG, handed with the players'
   ratings: pzLive.cfg): the rating a player starts from, where the next puzzle is aimed against the rating (most of the
   time; at the harder place), the score of each star count, the rating up to which only plain positions are served.
   Offline, or never heard: these. */
const PZ_KNOB = { start: 600, aim: -100, hard: 100, stars: PZ_STAR_S, plainMax: 800 };
function pzKnob() {
  const c = pzLive.cfg || {}, n = (v, lo, hi, d) => Number.isFinite(v) && v >= lo && v <= hi ? v : d;
  const st = Array.isArray(c.stars) && c.stars.length === 4 && c.stars.every((x, i) => Number.isFinite(x) && x >= 0 && x <= 1 && (!i || x >= c.stars[i - 1])) ? c.stars : PZ_KNOB.stars;
  return { start: n(c.start, 100, 3000, PZ_KNOB.start), aim: n(c.aim, -600, 600, PZ_KNOB.aim), hard: n(c.hard, -600, 600, PZ_KNOB.hard), stars: st, plainMax: n(c.plainMax, 0, 3000, PZ_KNOB.plainMax) };
}
const pzStars = v => typeof v === 'number' ? v : v === 'o' ? 3 : v === 'h' ? 1 : v === 'x' ? 0 : null;
const pzStarTxt = n => n > 0 ? '★'.repeat(n) : '놓침';
const PZ_MEDAL = ['#7d8794', '#cd8a4a', '#cfd8e3', '#f4c430'];          // a place's rim: none grey, ★ bronze, ★★ silver, ★★★ gold
// the case's material, finer as the stars add up (owner 11-23: 원목 → 메이플 → 황동 → 크롬 → 금 - by stars since 11-24 밤, so
// only ever up)
const PZ_MATS = [{ n: '원목', at: 0, a: '#7a4426', b: '#4a2a15', e: '#2f1a0c', t: 'rgba(230,200,140,.35)' }, { n: '메이플', at: 60, a: '#d9a86a', b: '#a8743c', e: '#6f4a22', t: 'rgba(255,240,210,.5)' },
  { n: '황동', at: 180, a: '#e6c46a', b: '#a8822c', e: '#6f5416', t: 'rgba(255,245,200,.6)' }, { n: '크롬', at: 400, a: '#eef1f5', b: '#8f98a4', e: '#4d5560', t: 'rgba(255,255,255,.7)' },
  { n: '금', at: 800, a: '#ffe38a', b: '#d99a00', e: '#7a5200', t: 'rgba(255,250,220,.75)' }];
const pzMatOf = stars => PZ_MATS.reduce((m, x, i) => stars >= x.at ? i : m, 0);
const pzr = {
  of: (k = 'four') => prefs.pzr[k],
  // the puzzle served next: kept once chosen (leaving and coming back gives the same one), else one of the five nearest
  // the rating it aims at (a hundred below; a hundred above for a ball's last quarter, a rack's every fifth) among those
  // not met yet (all met: the oldest are let back in), the more fun the likelier (tools/puzzles/ai.js fun)
  aim(k) { const s = pzr.of(k), i = s.now.length, K = pzKnob(); return s.r + ((k === 'pocket' ? i % 5 === 4 : i % 4 === 3) ? K.hard : K.aim); },
  // (no counted attempt yet: the rating is the knob's starting one - as the server starts it, vault.js)
  fresh(k) { const s = pzr.of(k), K = pzKnob(); if (!s.n && s.r !== K.start) { s.r = K.start; savePrefs(); } return s; },
  next(k = 'four') {
    const s = pzr.fresh(k), L = pzPool(k);
    if (!L.length) return null;
    const cur = puzzles.byId(s.cur); if (cur && puzzles.gameOf(cur) === k && !s.seen.includes(cur.id) && L.includes(cur)) return cur;
    const kind = s.r <= pzKnob().plainMax && L.some(pzPlain) ? L.filter(pzPlain) : L, inKind = id => kind.some(q => q.id === id);
    let pool = kind.filter(q => !s.seen.includes(q.id));
    if (!pool.length) { s.seen = s.seen.filter(id => !inKind(id)).concat(s.seen.filter(inKind).slice(-Math.floor(kind.length / 4))); pool = kind.filter(q => !s.seen.includes(q.id)); }
    const to = pzr.aim(k); pool.sort((a, b) => Math.abs(pzRating(a) - to) - Math.abs(pzRating(b) - to));
    const near = pool.slice(0, 5), wt = near.map(q => 0.5 + (q.fun || 0.5)), sum = wt.reduce((a, b) => a + b, 0);
    let x = Math.random() * sum, q = near[near.length - 1]; for (let i = 0; i < near.length; i++) { x -= wt[i]; if (x <= 0) { q = near[i]; break; } }
    s.cur = q.id; savePrefs(); return q;
  },
  // a puzzle over: its stars (0 .. 3). The hidden rating moves by their score; returns the case (rack) if this filled it
  record(k, q, stars) {
    const s = pzr.fresh(k), t = attend.today(), sc = pzKnob().stars[stars], after = puzzles.tryAfter(s, { rating: pzRating(q) }, sc);
    if (!s.now.length) { s.r0 = s.r; s.mat = pzMatOf(s.stars); }
    if (s.dayT !== t) { s.dayT = t; s.dayN = 0; }
    const d = after.r - s.r; s.r = after.r; s.rd = after.rd; s.n = after.n; s.stars += stars; if (stars) { s.solved++; s.dayN++; }
    // (told to the server, which keeps the rating for the account's every device and rates the puzzle back - 07-net.js)
    net.claim('pztry', { id: q.id, res: sc, st: stars, shots: stars ? puzzle.shots.slice() : null, k });
    s.seen.push(q.id); s.cur = null; s.tried = null; s.now.push([q.id, stars, d]); s.hist = s.hist.concat(s.r).slice(-30);
    let closed = null;
    if (s.now.length >= pzSize(k)) { closed = { t, k, res: s.now, r0: s.r0 != null ? s.r0 : s.r - d, r1: s.r, m: s.mat || 0 }; s.cases.unshift(closed); s.cases = s.cases.slice(0, 40); s.now = []; }
    savePrefs(); return { d, closed };
  },
  // the puzzles solved today (null: none tried today)
  today: (k = 'four') => { const s = pzr.of(k); return s.dayT === attend.today() ? s.dayN || 0 : null; },
  // the stars a case (rack) holds
  starsIn: res => res.reduce((a, r) => a + (pzStars(r[1]) || 0), 0),
};
/* The server's word on the puzzle ratings (core.js puzzleTry, /v1/me pzr): it keeps them for the account's every device.
   Taken when it has seen as many counted attempts as this device or more (one still waiting to be sent leaves this
   device's own in place until it is). */
function pzrSync(srv) {
  let moved = false;
  for (const k of ['four', 'pocket']) {
    const v = srv && srv[k], s = pzr.of(k); if (!v || !Number.isFinite(v.r) || (v.n || 0) < (s.n || 0)) continue;
    if (v.r !== s.r || v.n !== s.n) { s.r = v.r; s.rd = v.rd; s.n = v.n; moved = true; }
    // (the puzzles solved and the stars, counted by the server only since 11-24 밤: the larger of the two kept)
    if (Number.isFinite(v.w) && v.w > s.solved) { s.solved = v.w; moved = true; }
    if (Number.isFinite(v.st) && v.st > s.stars) { s.stars = v.st; moved = true; }
  }
  if (moved) { savePrefs(); if (typeof repaintLive === 'function' && $('#dkBoards.pzr')) repaintLive(); }
}
/* The players' word on the puzzles (the server's puzzles' book, /v1/puzzles/live): a puzzle tried enough is served by the
   rating the players gave it, not the one the puzzle AI guessed - and the admin's (11-24 밤): a rating set by hand (in
   live), the puzzles turned off (ov: not served), the knobs (cfg, pzKnob). Asked at most once an hour, kept. */
const pzLive = { at: 0, map: null, off: null, cfg: null };
function pzLiveLoad() {
  if (!pzLive.map) try { const o = JSON.parse(localStorage.getItem('dp8.pzlive') || 'null'); if (o && o.map) { pzLive.map = new Map(o.map); pzLive.at = o.at || 0; pzLive.off = new Set(o.off || []); pzLive.cfg = o.cfg || null; } } catch (e) {}
  if (Date.now() - pzLive.at < 3600000 || !SERVER) return;
  pzLive.at = Date.now();
  fetch(SERVER + '/v1/puzzles/live').then(r => r.json()).then(j => {
    if (!j || !Array.isArray(j.live)) return; pzLive.map = new Map(j.live.map(q => [q[0], q[1]]));
    pzLive.off = new Set((j.ov || []).filter(o => o[3]).map(o => o[0])); pzLive.cfg = j.cfg && typeof j.cfg === 'object' ? j.cfg : null;
    try { localStorage.setItem('dp8.pzlive', JSON.stringify({ at: pzLive.at, map: [...pzLive.map], off: [...pzLive.off], cfg: pzLive.cfg })); } catch (e) {}
    if (typeof repaintLive === 'function' && $('#dkBoards.pzr')) repaintLive();
  }).catch(() => {});
}
/* The pictures: a ball whose four quarters fill clockwise from 12 o'clock - each the ball's own picture with a rim the
   colour of its stars (gold ★★★, silver ★★, bronze ★); none, the picture grey and faint, its rim grey; the one to play
   now, ringed blue - and the case holding four. */
let pzUid = 0;
const PZ_BALL_HUE = ['#f4f1ea', '#f2c21b', '#d62b2b', '#d62b2b'];
// (a pool ball's colour where its picture is not there: 1-7 solid, 8 black, 9-15 striped - drawn plain here)
const PZ_POOL_HUE = ['#f4f1ea', '#f2c21b', '#1d4fb8', '#d62b2b', '#6a2c91', '#f07a1c', '#1f8a3a', '#7a1f1f', '#111111', '#f2c21b', '#1d4fb8', '#d62b2b', '#6a2c91', '#f07a1c', '#1f8a3a', '#7a1f1f'];
const pzBallUrl = (n, kind) => typeof BALL_PICS !== 'undefined' && BALL_PICS.includes(prefs.ballSkin) ? `ui/balls/${prefs.ballSkin}-${kind || 'carom'}-${n}.webp` : null;
// (kind 'pool': a ball of the rack, n its number; whole: one state for all of it, no quarters drawn)
function pzBall(cx, cy, r, n, q, u, kind, whole) {
  const id = `pz${u}b${n}`, url = pzBallUrl(n, kind), P = (a) => [cx + Math.cos(a) * r * 1.5, cy + Math.sin(a) * r * 1.5];
  const wedge = i => { const a0 = -Math.PI / 2 + i * Math.PI / 2, [x0, y0] = P(a0), [x1, y1] = P(a0 + Math.PI / 4), [x2, y2] = P(a0 + Math.PI / 2); return `M${cx} ${cy}L${x0} ${y0}L${x1} ${y1}L${x2} ${y2}Z`; };
  const arc = (i, rr) => { const a0 = -Math.PI / 2 + i * Math.PI / 2, a1 = a0 + Math.PI / 2; return `M${cx + Math.cos(a0) * rr} ${cy + Math.sin(a0) * rr}A${rr} ${rr} 0 0 1 ${cx + Math.cos(a1) * rr} ${cy + Math.sin(a1) * rr}`; };
  const face = (extra) => url ? `<image href="${url}" x="${cx - r}" y="${cy - r}" width="${2 * r}" height="${2 * r}" ${extra}/>` : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${(kind === 'pool' ? PZ_POOL_HUE : PZ_BALL_HUE)[n]}" ${extra}/>`;
  let s = `<clipPath id="${id}c"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath><circle cx="${cx}" cy="${cy}" r="${r + r * .08}" fill="#0b1a12"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#pz${u}h)"/>`;
  const sv = q.map(v => v === 'n' ? 'n' : pzStars(v)), held = v => v != null && v !== 'n';
  sv.forEach((v, i) => {
    if (!held(v)) return;
    s += `<clipPath id="${id}q${i}"><path d="${wedge(i)}"/></clipPath><g clip-path="url(#${id}c)"><g clip-path="url(#${id}q${i})">${face(v ? '' : `filter="url(#pz${u}g)" opacity=".5"`)}</g></g>`;
  });
  if (!url && sv.some(held)) s += `<circle cx="${cx - r * .3}" cy="${cy - r * .35}" r="${r * .3}" fill="rgba(255,255,255,.28)" clip-path="url(#${id}c)"/>`;
  if (!whole) s += `<g clip-path="url(#${id}c)" stroke="rgba(0,0,0,.35)" stroke-width="${Math.max(1, r * .04)}"><line x1="${cx}" y1="${cy - r}" x2="${cx}" y2="${cy + r}"/><line x1="${cx - r}" y1="${cy}" x2="${cx + r}" y2="${cy}"/></g>`;
  // (the medal's rim round each quarter held - or round the whole ball, a rack's)
  const sw = Math.max(1.5, r * .14);
  sv.forEach((v, i) => { if (held(v) && (!whole || i === 0)) s += whole ? `<circle cx="${cx}" cy="${cy}" r="${r * 1.04}" fill="none" stroke="${PZ_MEDAL[v]}" stroke-width="${sw}"/>` : `<path d="${arc(i, r * 1.04)}" fill="none" stroke="${PZ_MEDAL[v]}" stroke-width="${sw}" stroke-linecap="round"/>`; });
  const ni = q.indexOf('n');
  if (ni >= 0) s += whole ? `<circle cx="${cx}" cy="${cy}" r="${r * .94}" fill="rgba(94,200,255,.25)" stroke="#5ec8ff" stroke-width="${Math.max(2, r * .1)}"/>` : `<path d="${wedge(ni)}" clip-path="url(#${id}c)" fill="rgba(94,200,255,.28)" stroke="#5ec8ff" stroke-width="${Math.max(2, r * .09)}"/>`;
  return s;
}
// the defs the balls of one picture share: the empty place's green, the grey of a miss
const pzDefs = u => `<defs><radialGradient id="pz${u}h" cx="50%" cy="60%" r="55%"><stop offset="0" stop-color="#0c1d13"/><stop offset="1" stop-color="#1d4130"/></radialGradient><filter id="pz${u}g"><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="linear" slope=".6"/><feFuncG type="linear" slope=".6"/><feFuncB type="linear" slope=".6"/></feComponentTransfer></filter></defs>`;
// the four balls' quarters from a case's results (now: the next one ringed)
const pzQuarters = (res, now) => [0, 1, 2, 3].map(b => [0, 1, 2, 3].map(i => { const k = b * 4 + i; return res[k] ? res[k][1] : now && k === res.length ? 'n' : ''; }));
// the case: four round places in a row, the lid's lip behind, of its material (w: its width; the picture scales)
function pzCase(res, mat, now) {
  const u = ++pzUid, w = 400, r = w / 4 * .42, h = r * 2 + w / 4 * .16 + w * .05, M = PZ_MATS[mat] || PZ_MATS[0], H = h + w * .05 + 6, Q = pzQuarters(res, now);
  let s = `<svg class="pz-case" viewBox="-3 -3 ${w + 6} ${H}" aria-hidden="true">${pzDefs(u)}<linearGradient id="pz${u}m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${M.a}"/><stop offset="1" stop-color="${M.b}"/></linearGradient>`;
  s += `<rect x="${w * .05}" y="0" width="${w * .9}" height="${w * .1}" rx="${w * .04}" fill="${M.e}"/><rect x="0" y="${w * .05}" width="${w}" height="${h}" rx="${h * .3}" fill="url(#pz${u}m)" stroke="${M.e}" stroke-width="3"/>`;
  s += `<rect x="${w * .02}" y="${w * .07}" width="${w * .96}" height="${h - w * .04}" rx="${h * .26}" fill="none" stroke="${M.t}" stroke-width="2" stroke-dasharray="5 4"/>`;
  for (let i = 0; i < 4; i++) s += pzBall(w / 8 + i * w / 4, w * .05 + h / 2, r, i, Q[i], u);
  return s + '</svg>';
}
// the four balls alone, small, in a row (the bar in the game, a line of the record)
function pzMini(res, now) {
  const u = ++pzUid, r = 12, Q = pzQuarters(res, now);
  return `<svg class="pz-mini" viewBox="0 0 ${8 * r + 3 * r * .4 + 4} ${2 * r + 4}" aria-hidden="true">${pzDefs(u)}${Q.map((q, i) => pzBall(2 + r + i * r * 2.4, r + 2, r, i, q, u)).join('')}</svg>`;
}
/* 포켓's rack: fifteen places in a triangle, the apex first, one ball a puzzle (numbered by its place) - the rack's
   wood behind (mini: the balls alone, small, for the bar in the game) */
function pzRackSvg(res, now, mini) {
  const u = ++pzUid, r = mini ? 8 : 20, g = r * 2.1, rows = 5, pad = mini ? 2 : 12, W = (rows - 1) * g + 2 * r + 2 * pad, H = (rows - 1) * g * .87 + 2 * r + 2 * pad + (mini ? 0 : 8);
  let s = `<svg class="${mini ? 'pz-mini' : 'pz-rack'}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${pzDefs(u)}`;
  if (!mini) s += `<path d="M${W / 2} 2L${W - 2} ${H - 4}L2 ${H - 4}Z" fill="#5a3218" stroke="#2f1a0c" stroke-width="3" stroke-linejoin="round"/>`;
  let i = 0;
  for (let row = 0; row < rows; row++) for (let c = 0; c <= row; c++, i++) {
    const cx = W / 2 + (c - row / 2) * g, cy = pad + r + row * g * .87 + (mini ? 0 : 6), v = res[i] ? res[i][1] : now && i === res.length ? 'n' : '';
    s += pzBall(cx, cy, r, i + 1, [v, v, v, v], u, 'pool', true);
  }
  return s + '</svg>';
}
const pzRackMini = (res, now) => pzRackSvg(res, now, true);
// one ball with one quarter filled - a puzzle of a case in the record
function pzOne(j, res, k) { const u = ++pzUid, r = 12, q = ['', '', '', '']; if (k === 'pocket') q.fill(res); else q[j & 3] = res; return `<svg class="pz-mini" viewBox="0 0 ${2 * r + 4} ${2 * r + 4}" aria-hidden="true">${pzDefs(u)}${k === 'pocket' ? pzBall(r + 2, r + 2, r, j + 1, q, u, 'pool', true) : pzBall(r + 2, r + 2, r, j >> 2, q, u)}</svg>`; }
// what a puzzle has besides the plain thing: [key, the words the first time it is met, the chip's word]
function pzNews(z) {
  const out = [], T = z.table && z.table !== 'rect' && typeof TABLE_OUTLINES !== 'undefined' ? TABLE_OUTLINES.byId(z.table) : null;
  if (T) out.push(['table', `처음 보는 테이블: ${T.name} - 쿠션이 윤곽을 따라 둘러 있습니다`, T.name]);
  if (z.walls) out.push(['walls', '바리케이드: 막대에 공이 쿠션처럼 튕깁니다', '바리케이드']);
  if (z.need) out.push(['need', '노란 띠를 두른 쿠션을 꼭 맞혀야 합니다', z.need.length > 1 ? `쿠션 ${z.need.length}개 순서대로` : '표시된 쿠션']);
  if (puzzles.turnsOf(z) > 1) out.push(['turns', '두 턴: 첫 샷이 멈춘 자리에서 한 번 더 칩니다. 실패하면 처음부터', '2턴']);
  if (z.keep && z.keep.length) out.push(['keep', '넣으면 안 되는 공이 있습니다', `${z.keep.join(', ')}번 금지`]);
  return out;
}
const pzSvg = (html, cls) => { const s = el('span', { class: cls }); s.innerHTML = html; return s; };

const puzzle = {
  quiet: false, save: false, cur: null, helped: 0, tries: 0,     // helped: 1 a hint seen, 2 the answer; tries: the misses
  free: null,               // null: counted (the rated puzzle); 'day' 오늘의 퍼즐, 'book' one from the record - no points
  done: false,              // the puzzle over - solved, or missed three times (its stars: puzzle.got)
  k: 'four',                // the game: 'four' or 'pocket'
  turn: 0, down: [], at: null, shots: [],   // two turns: which, the balls potted so far, the table it started from, the shots
  // the balls of a puzzle, onto its table (puzzles.js setup: its outline, barricades, the cushions it asks for)
  put(z) {
    const P = game.P, w = game.world; puzzles.setup(game, z, Math.random);
    const c = w.balls[0], on = w.balls.filter(b => b.on && b.id && b.id !== 1 || (puzzles.gameOf(z) === 'pocket' && b.on && b.id)), tgt = puzzles.gameOf(z) === 'pocket' ? on.filter(b => (z.pot || []).includes(b.id)) : on.filter(b => b.id >= 2);
    const near = (tgt.length ? tgt : on).sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0];
    scene.clearFalls(); scene.setZone(null); scene.setMarks(null); if (near) st.aim = Math.atan2(near.y - c.y, near.x - c.x); st.rev++; scene.invalidate();
  },
  // the rated puzzle of game k (no id), or one to play without points (opt.free: 'day' or 'book')
  start(id, opt) {
    const p = puzzle, free = (opt && opt.free) || null, k = (opt && opt.game) || (free ? null : p.k) || 'four';
    const z = free ? puzzles.byId(id) : pzr.next(k);
    if (!z) return toast('새 퍼즐을 만드는 중입니다.', '', 2200);
    const kk = puzzles.gameOf(z);
    if (!p.cur || p.cur.id !== z.id || p.free !== free) { p.helped = 0; p.tries = 0; p.done = false; p.got = null; }
    if (!free && pzr.of(kk).hinted === z.id) p.helped = Math.max(p.helped, 1);   // (a hint seen, then left: still seen)
    if (!free && !p.done) { const t = pzr.of(kk).tried; if (t && t[0] === z.id) p.tries = Math.max(p.tries, t[1]); }   // (and the misses)
    p.hintAsk = 0; p.cur = z; p.k = kk; p.free = free; p.closed = null; prefs.pz.cur = z.id; savePrefs();
    usePhysics(); game.start(puzzles.modeOf(z), [prefs.names[0], ''], false, {});
    flow = puzzle; dress(false); useCue(prefs.cues[0]); scene.setTable(game.P); show('play'); p.bar(); p.again();
    // (what it has that is new to this player: said once, the first time - as the plan's 처음 만날 때 안내)
    const news = pzNews(z).filter(([key]) => !(prefs.pzr.met || []).includes(key));
    if (news.length) { prefs.pzr.met = (prefs.pzr.met || []).concat(news.map(n => n[0])); savePrefs(); toast(news.map(n => n[1]).join(' · '), '', 3600); }
    else if (!free && !p.done && p.tries) toast(`남은 기회 ${PZ_TRIES - p.tries}번`, '', 2000);
    else if (app.classList.contains('portrait')) toast(p.goal(z), '', 2600);
  },
  // what the puzzle asks, in words
  goal(z) {
    if (puzzles.gameOf(z) === 'pocket') { const pot = z.pot || []; return `${pot.join(', ')}번 공을 넣으세요` + (z.keep && z.keep.length ? ` · ${z.keep.join(', ')}번은 넣지 마세요` : ''); }
    return game.MODES.puzzle4.GOALS[puzzles.goalOf(z)].text;
  },
  restart() { const p = puzzle; if (p.done && !p.free) return p.again(); p.start(p.free ? p.cur.id : null, { free: p.free, game: p.k }); },
  // the puzzle set out from the start (the first turn)
  again() { const p = puzzle; flow = puzzle; p.turn = 0; p.down = []; p.shots = []; p.put(p.cur); p.at = game.P.clone(game.world); beginTurn(true); },
  // back to where this turn started (after its answer was played out)
  retake() { const p = puzzle, P = game.P, w = game.world; flow = puzzle; for (const b of p.at.balls) { if (b.on) P.place(w, b.id, b.x, b.y); else w.balls[b.id].on = false; } scene.clearFalls(); scene.setMarks(null); st.rev++; scene.invalidate(); beginTurn(true); },
  // on: the next rated puzzle - or, a case just closed, its result on the desk; a free one, back where it came from
  next() {
    const p = puzzle;
    if (p.free || p.closed) { if (p.closed) pzDone = p.closed; if (p.free === 'book') pzBook = pzBook || 0; p.closed = null; trainGo('puzzle'); return goHome(); }
    p.start(null, { game: p.k });
  },
  guide: () => GUIDE_STD,
  auto: () => null,
  beforeShot(V, a, b, el) { scene.setMarks(null); puzzle.shot = { aim: st.aim, V, a, b, el: el || 0 }; puzzle.pre = game.P.clone(game.world); },
  /* after a miss, once a session while it is off: a small capsule in the middle - 빠른 진행을 켤까요? and a tick. Its edge fills
     blue as the moments pass; full, it drops away and fades (owner 11-10). The tick turns it on for puzzles. */
  askFast() {
    const p = puzzle; if (p.askedFast || prefs.pzFast || flow !== puzzle) return; p.askedFast = true;
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'), edge = document.createElementNS(ns, 'rect');
    svg.setAttribute('class', 'fa-edge'); svg.setAttribute('aria-hidden', 'true'); edge.setAttribute('pathLength', '1'); svg.appendChild(edge);
    const go = () => { cap.classList.add('away'); setTimeout(() => cap.remove(), 450); };
    const tick = el('button', { class: 'fa-ok', 'aria-label': '빠른 진행 켜기', onclick: () => { SND.tap(); prefs.pzFast = true; savePrefs(); cap.classList.add('on'); setTimeout(go, 380); } });
    const cap = el('div', { class: 'fast-ask', role: 'status' }, [svg, el('span', { text: '빠른 진행을 켤까요?' }), tick]);
    edge.addEventListener('animationend', go, { once: true });
    $('#app').appendChild(cap);
    const fit = () => { const r = cap.getBoundingClientRect(); svg.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`); edge.setAttribute('x', 1.5); edge.setAttribute('y', 1.5); edge.setAttribute('width', r.width - 3); edge.setAttribute('height', r.height - 3); edge.setAttribute('rx', (r.height - 3) / 2); };
    requestAnimationFrame(fit);
  },
  afterShot() {
    const p = puzzle, z = p.cur, w = game.world, ev = w.ev, j = puzzles.judge(game, z, ev, w, p.turn, p.down);
    game.resolve();
    p.shots.push(puzzle.shot);
    const T = puzzles.turnsOf(z), solved = j.ok && j.done;
    // one turn of two made: on from where the balls are
    if (j.ok && !j.done) {
      for (const q of ev.pocketed) p.down.push(q.id);
      p.turn++; p.at = game.P.clone(w); toast(`${p.turn} / ${T} 성공 · 이어서 치세요`, 'good', 1800); SND.good(); p.hud();
      return hold(1.2, () => { flow = puzzle; beginTurn(true); });
    }
    // a miss: told how near it came; counted, it is one of three tries - the third missed ends it with no star, and the
    // puzzle stays (its answer and the next on the bar: the player's choice)
    if (!solved) {
      const near = pzMiss(z, p.pre, p.shot), why = near || j.note || '실패', over = T > 1 && p.turn ? ' · 처음부터' : '';
      SND.bad(); p.tries++;
      if (!p.free && !p.done) {
        const s = pzr.of(p.k); s.tried = [z.id, p.tries]; savePrefs();
        if (p.tries >= PZ_TRIES) { p.finish(0); toast(`${why} · 기회를 다 썼습니다`, 'foul', 2600); return hold(1.6, p.again); }
        toast(`${why} · 남은 기회 ${PZ_TRIES - p.tries}번${over}`, 'foul', 2300); p.hud();
      } else toast(`${why}${over}`, 'foul', 2100);
      if (!prefs.pzFast && !p.askedFast) setTimeout(p.askFast, 1900);
      return hold(1.6, p.again);
    }
    attend.played();                                                   // (a puzzle solved: the day counted - 58-streak.js)
    if (p.free === 'day') { prefs.pz.day = attend.today(); savePrefs(); }   // (오늘의 퍼즐 done)
    // (paid once, by the server, after it plays the shots again - server/src/check.js)
    if (!prefs.pz.stars[z.id]) { prefs.pz.stars[z.id] = 1; savePrefs(); net.claim('puzzle', { id: z.id, shot: p.shots[0], shots: p.shots }); }
    let said = p.free === 'day' ? '오늘의 퍼즐 완료!' : '정답!';
    if (!p.free && !p.done) {
      const n = p.helped ? 1 : PZ_TRIES - p.tries; p.finish(n);
      said = n === 3 ? '★★★ 한 번에 성공' : p.helped ? '★ 힌트를 보고 성공' : `${pzStarTxt(n)} ${p.tries === 1 ? '두' : '세'} 번째에 성공`;
    }
    toast(said, 'good', 2000); SND.good();
    hold(1.9, p.next);
  },
  // the puzzle over: its stars (0 .. 3) recorded - the hidden rating moved, a place of the case filled
  finish(stars) {
    const p = puzzle, out = pzr.record(p.k, p.cur, stars);
    p.done = true; p.got = { stars, d: out.d }; p.closed = out.closed; p.hud();
  },
  hud() {
    const p = puzzle, z = p.cur, k = p.k, s = pzr.of(k), goal = p.goal(z), T = puzzles.turnsOf(z);
    // (where the rating was: the tries left - once it is over, the stars it gave)
    const left = String(PZ_TRIES - p.tries), won = p.got ? pzStarTxt(p.got.stars) : '';
    const name = p.free === 'day' ? '오늘의 퍼즐' : p.free ? '다시 풀기' : p.done ? won : left;
    paintPill(0, { name, on: true, sub: p.free ? '점수 없음' : p.done ? '연습' : '남은 기회', tray: [], pts: null });
    paintBadge(k === 'pocket' ? '포켓 퍼즐' : '4구 퍼즐', { text: goal });
    // lying: the bar of its own (40-shot.js fbar) - the case (or rack) at its left (the place now ringed), the tries left,
    // the goal and what this puzzle has; 힌트, and once the puzzle is over 정답 and 다음
    const res = p.closed ? p.closed.res : s.now.slice(), mini = pzSvg(k === 'pocket' ? pzRackMini(res, !p.free && !p.done) : pzMini(res, !p.free && !p.done), 'fcase');   // (the case just closed: still shown full)
    const chips = pzNews(z).map(([key, , chip]) => el('span', { class: 'fchip' + (key === 'need' ? ' need' : ''), text: key === 'turns' ? `${p.turn + 1} / ${T}턴` : chip }));
    const after = p.free || p.done;
    fbar({ bar: [p.free ? null : mini,
      el('div', { class: 'fpl on' }, p.free ? [el('span', { class: 'fnm', text: name }), el('span', { class: 'fsb', text: '점수 없음' })]
        : p.done ? [el('span', { class: 'fnm fst' + (p.got && p.got.stars ? '' : ' none'), text: won }), el('span', { class: 'fsb', text: '연습' })]
        : [el('span', { class: 'fnm num', text: left }), el('span', { class: 'fsb', text: '남은 기회' })]),
      el('div', { class: 'fhead' }, [el('b', { text: '목표' }), el('span', { text: goal }), ...chips]),
      fbKey('fib' + (p.helped >= 1 ? ' on' : ''), 'bulb', '힌트', p.aiming(p.hint)),
      after ? fbKey('fib' + (p.helped >= 2 ? ' on' : ''), 'play', '정답', p.aiming(p.answer)) : null,
      after ? fbKey('fib', 'next', p.free ? '나가기' : '다음', p.aiming(p.next)) : null] });
    setBusy();
  },
  // where the cue ball of this turn's answer touches a cushion or a ball, in order, up to the second red (4구) or till
  // the balls stop (포켓)
  marks(z) {
    const P = game.P, t = P.clone(game.world), out = [], sol = puzzles.shotOf(z, puzzle.turn), four = puzzles.gameOf(z) === 'four'; t.snd = []; P.strike(t, sol[0], sol[1], sol[2], sol[3], sol[4]);
    for (let i = 0; i < 120 * 25 && !P.rest(t) && out.length < 9; i++) {
      P.step(t, TICK);
      for (const e of t.snd) { if (e.t === 'rail' && e.id === 0) out.push({ x: e.x, y: e.y }); else if (e.t === 'ball' && (e.ia === 0 || e.ib === 0)) out.push({ x: e.x, y: e.y }); }
      t.snd.length = 0; if (four && t.ev.hits.includes(2) && t.ev.hits.includes(3)) break;
    }
    return out;
  },
  aiming: fn => () => { if (flow === puzzle && st.phase === 'aim') fn(); },
  // a hint marks every place the cue ball touches on the way, numbered (seen while the puzzle counts: ★ at most - asked
  // twice when it would cost a star); the answer (once the puzzle is over) is played out in full
  hint() {
    const p = puzzle, z = p.cur, sol = puzzles.shotOf(z, p.turn);
    if (!p.free && !p.done && !p.helped && PZ_TRIES - p.tries > 1 && !(Date.now() - (p.hintAsk || 0) < 5000)) { p.hintAsk = Date.now(); return toast('힌트를 보면 최대 ★ · 한 번 더 누르면 봅니다', '', 2400); }
    p.helped = Math.max(+p.helped, 1); if (!p.free && !p.done) { pzr.of(p.k).hinted = z.id; savePrefs(); } scene.setMarks(p.marks(z)); p.hud(); const k = sol[4] ? ` 큐를 ${Math.round(sol[4] * 180 / Math.PI)}° 세워 칩니다.` : sol[3] > 0 ? ' 밀어치기입니다.' : sol[3] < 0 ? ' 끌어치기입니다.' : ''; toast('힌트: 흰 공이 번호 순서대로 닿습니다.' + k, '', 3600); },
  answer() { const p = puzzle, z = p.cur, sol = puzzles.shotOf(z, p.turn); p.helped = 2; scene.setMarks(null); p.hud(); toast(puzzles.turnsOf(z) > 1 ? `정답: ${p.turn + 1}턴은 이렇게 칩니다.` : '정답: 이렇게 치면 됩니다.', '', 2200); playDemo({ angle: sol[0], power: game.powerOf(sol[1]), a: sol[2], b: sol[3], el: sol[4] }, { quiet: false, after: p.retake }); },
  // (upright: the row of keys where the second player's plate would be)
  bar() {
    const p = puzzle, box = $('#pracBar'); box.textContent = ''; box.hidden = false; $('#p1').hidden = true;
    const btn = (text, fn) => box.appendChild(el('button', { class: 'btn', text, onclick: () => { SND.tap(); fn(); } }));
    btn('힌트', p.aiming(p.hint)); btn('정답', p.aiming(() => { if (p.free || p.done) p.answer(); else toast(`남은 기회 ${PZ_TRIES - p.tries}번`, '', 1800); }));
    btn('다음', p.aiming(() => { if (p.free || p.done) p.next(); else toast(`남은 기회 ${PZ_TRIES - p.tries}번`, '', 1800); }));
  },
};
/* How near a miss came (owner 11-24: 당구는 길을 알아도 각이 조금만 틀려도 안 된다 - so say by how much): the shot played
   again from where it started (the same shot gives the same run), watching - 4구, how close the cue ball came to the red
   it did not meet (with neither met, the nearer); 포켓, each ball to be potted, how close to a pocket. In words, or null
   when it was not near (over 15 cm) or the miss was of another kind (the yellow met, the reds both met). */
function pzMiss(z, pre, shot) {
  if (!pre || !shot) return null;
  const P = game.P, t = P.clone(pre), four = puzzles.gameOf(z) === 'four', R = P.R;
  P.strike(t, shot.aim, shot.V, shot.a, shot.b, shot.el);
  const holes = four ? [] : (t.shape && t.shape.holes && t.shape.holes.length ? t.shape.holes : P.POCKETS);
  const pot = four ? [] : (z.pot || []), best = {};
  let first = null;
  for (let i = 0; i < 120 * 25 && !P.rest(t); i++) {
    P.step(t, TICK); const c = t.balls[0];
    if (four) {
      if (first == null) first = t.ev.hits.find(id => id === 2 || id === 3) || null;
      for (const id of [2, 3]) { if (t.ev.hits.includes(id)) continue; const b = t.balls[id], g = Math.hypot(b.x - c.x, b.y - c.y) - 2 * R; if (best[id] == null || g < best[id]) best[id] = g; }
    } else for (const id of pot) {
      const b = t.balls[id]; if (!b || !b.on) { best[id] = -1; continue; }
      for (const h of holes) { const g = Math.hypot(b.x - h.x, b.y - h.y) - (h.r || 0.06); if (best[id] == null || g < best[id]) best[id] = g; }
    }
  }
  const cm = g => g < 0.01 ? `${Math.max(1, Math.round(g * 1000))}mm` : `${(g * 100).toFixed(g < 0.1 ? 1 : 0)}cm`;
  if (four) {
    if (t.ev.hits.includes(1)) return null;
    const left = [2, 3].filter(id => !t.ev.hits.includes(id) && best[id] != null);
    if (!left.length) return null;
    const g = Math.min(...left.map(id => best[id])); if (g > 0.15) return null;
    return first ? `두 번째 빨간 공을 ${cm(Math.max(0, g))} 차이로 비켜감` : `빨간 공을 ${cm(Math.max(0, g))} 차이로 비켜감`;
  }
  const miss = pot.filter(id => best[id] != null && best[id] >= 0); if (!miss.length) return null;
  const id = miss.sort((a, b) => best[a] - best[b])[0], g = best[id]; if (g > 0.15) return null;
  return `${id}번 공이 포켓 입구까지 ${cm(g)}`;
}
