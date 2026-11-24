/* ================= flow: puzzle - 퍼즐 레이팅 (owner 11-23/24, as Chess.com's puzzles are) =================
   No stages and no topics: a rating for each game (4구, 포켓), and the puzzle served is one near it, not seen before,
   hidden until it is started. Only its first attempt counts - solved, the rating goes up by as much as the puzzle was
   harder than expected; missed, down. A hint seen first makes it count for nothing either way. After the counted attempt
   it can be tried again (no points), its answer shown, or passed for the next. Each counted 4구 puzzle fills a quarter of
   a ball in the case (white, yellow, red, red - 16 to a case), each 포켓 one a ball of the rack (15); a full one is closed
   and kept in the record, whose puzzles can be played again only without points. The case's material goes up with the
   rating (PZ_MATS).
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
const pzPool = (k = 'four') => puzzles.list.filter(q => puzzles.gameOf(q) === k && q.sol && q.rating != null);
const pzPlain = q => puzzles.gameOf(q) === 'four' ? puzzles.plain(q) : (q.pot || []).length === 1 && !q.keep && !q.need && !q.walls && !q.table && !q.turns;
const pzRating = q => (pzLive.map && pzLive.map.get(q.id)) || q.rating || (b => Math.round(b[0] + (b[1] - b[0]) * ((q.n - 1) / 19) + ((q.id * 37) % 61) - 30))(PZ_BAND[q.stage] || [1000, 1400]);
// the case's material, finer as the rating climbs (owner 11-23: 원목 → 메이플 → 황동 → 크롬 → 금)
const PZ_MATS = [{ n: '원목', at: 0, a: '#7a4426', b: '#4a2a15', e: '#2f1a0c', t: 'rgba(230,200,140,.35)' }, { n: '메이플', at: 1000, a: '#d9a86a', b: '#a8743c', e: '#6f4a22', t: 'rgba(255,240,210,.5)' },
  { n: '황동', at: 1400, a: '#e6c46a', b: '#a8822c', e: '#6f5416', t: 'rgba(255,245,200,.6)' }, { n: '크롬', at: 1800, a: '#eef1f5', b: '#8f98a4', e: '#4d5560', t: 'rgba(255,255,255,.7)' },
  { n: '금', at: 2200, a: '#ffe38a', b: '#d99a00', e: '#7a5200', t: 'rgba(255,250,220,.75)' }];
const pzMatOf = r => PZ_MATS.reduce((m, x, i) => r >= x.at ? i : m, 0);
const pzr = {
  of: (k = 'four') => prefs.pzr[k],
  // what the puzzle would give, solved or missed (puzzles.js tryAfter: Glicko, as the server keeps it)
  gain(s, q) { const z = { rating: pzRating(q) }; return { win: Math.max(1, puzzles.tryAfter(s, z, 'o').r - s.r), lose: Math.max(1, s.r - puzzles.tryAfter(s, z, 'x').r) }; },
  // the puzzle served next: kept once chosen (leaving and coming back gives the same one), else one of the five nearest
  // the rating it aims at (a hundred below; a hundred above for a ball's last quarter, a rack's every fifth) among those
  // not met yet (all met: the oldest are let back in), the more fun the likelier (tools/puzzles/ai.js fun)
  aim(k) { const s = pzr.of(k), i = s.now.length; return s.r + ((k === 'pocket' ? i % 5 === 4 : i % 4 === 3) ? 100 : -100); },
  next(k = 'four') {
    const s = pzr.of(k), L = pzPool(k);
    if (!L.length) return null;
    const cur = puzzles.byId(s.cur); if (cur && puzzles.gameOf(cur) === k && !s.seen.includes(cur.id)) return cur;
    const kind = s.r <= 800 && L.some(pzPlain) ? L.filter(pzPlain) : L, inKind = id => kind.some(q => q.id === id);
    let pool = kind.filter(q => !s.seen.includes(q.id));
    if (!pool.length) { s.seen = s.seen.filter(id => !inKind(id)).concat(s.seen.filter(inKind).slice(-Math.floor(kind.length / 4))); pool = kind.filter(q => !s.seen.includes(q.id)); }
    const to = pzr.aim(k); pool.sort((a, b) => Math.abs(pzRating(a) - to) - Math.abs(pzRating(b) - to));
    const near = pool.slice(0, 5), wt = near.map(q => 0.5 + (q.fun || 0.5)), sum = wt.reduce((a, b) => a + b, 0);
    let x = Math.random() * sum, q = near[near.length - 1]; for (let i = 0; i < near.length; i++) { x -= wt[i]; if (x <= 0) { q = near[i]; break; } }
    s.cur = q.id; savePrefs(); return q;
  },
  // the counted shot: o solved, x missed, h a hint seen first (no points). Returns the change and the case if it closed
  record(k, q, res) {
    const s = pzr.of(k), t = attend.today(), after = puzzles.tryAfter(s, { rating: pzRating(q) }, res);
    if (!s.now.length) { s.r0 = s.r; s.mat = pzMatOf(s.r); }
    if (s.dayT !== t) { s.dayT = t; s.day0 = s.r; }
    const d = after.r - s.r; s.r = after.r; s.rd = after.rd; s.n = after.n;
    // (told to the server, which keeps the rating for the account's every device and rates the puzzle back - 07-net.js)
    net.claim('pztry', { id: q.id, res, shots: res === 'o' ? puzzle.shots.slice() : null, k });
    s.seen.push(q.id); s.cur = null; s.now.push([q.id, res, d]); s.hist = s.hist.concat(s.r).slice(-30);
    let closed = null;
    if (s.now.length >= pzSize(k)) { closed = { t, k, res: s.now, r0: s.r0 != null ? s.r0 : s.r - d, r1: s.r, m: s.mat || 0 }; s.cases.unshift(closed); s.cases = s.cases.slice(0, 40); s.now = []; }
    savePrefs(); return { d, closed };
  },
  today: (k = 'four') => { const s = pzr.of(k); return s.dayT === attend.today() ? s.r - s.day0 : null; },
};
/* The server's word on the puzzle ratings (core.js puzzleTry, /v1/me pzr): it keeps them for the account's every device.
   Taken when it has seen as many counted attempts as this device or more (one still waiting to be sent leaves this
   device's own in place until it is). */
function pzrSync(srv) {
  let moved = false;
  for (const k of ['four', 'pocket']) { const v = srv && srv[k], s = pzr.of(k); if (!v || !Number.isFinite(v.r) || (v.n || 0) < (s.n || 0)) continue; if (v.r !== s.r || v.n !== s.n) { s.r = v.r; s.rd = v.rd; s.n = v.n; moved = true; } }
  if (moved) { savePrefs(); if (typeof repaintLive === 'function' && $('#dkBoards.pzr')) repaintLive(); }
}
/* The players' word on the puzzles (the server's puzzles' book, /v1/puzzles/live): a puzzle tried enough is served by the
   rating the players gave it, not the one the puzzle AI guessed - asked at most twice a day, kept */
const pzLive = { at: 0, map: null };
function pzLiveLoad() {
  try { const o = JSON.parse(localStorage.getItem('dp8.pzlive') || 'null'); if (o && o.map) { pzLive.map = new Map(o.map); pzLive.at = o.at || 0; } } catch (e) {}
  if (Date.now() - pzLive.at < 12 * 3600000 || !SERVER) return;
  pzLive.at = Date.now();
  fetch(SERVER + '/v1/puzzles/live').then(r => r.json()).then(j => {
    if (!j || !Array.isArray(j.live)) return; pzLive.map = new Map(j.live.map(q => [q[0], q[1]]));
    try { localStorage.setItem('dp8.pzlive', JSON.stringify({ at: pzLive.at, map: [...pzLive.map] })); } catch (e) {}
  }).catch(() => {});
}
/* The pictures: a ball whose four quarters fill clockwise from 12 o'clock - solved, the ball's own picture; missed, the
   picture greyed under a red veil; a hint seen, faint; the one to play now, ringed blue - and the case holding four. */
let pzUid = 0;
const PZ_BALL_HUE = ['#f4f1ea', '#f2c21b', '#d62b2b', '#d62b2b'];
// (a pool ball's colour where its picture is not there: 1-7 solid, 8 black, 9-15 striped - drawn plain here)
const PZ_POOL_HUE = ['#f4f1ea', '#f2c21b', '#1d4fb8', '#d62b2b', '#6a2c91', '#f07a1c', '#1f8a3a', '#7a1f1f', '#111111', '#f2c21b', '#1d4fb8', '#d62b2b', '#6a2c91', '#f07a1c', '#1f8a3a', '#7a1f1f'];
const pzBallUrl = (n, kind) => typeof BALL_PICS !== 'undefined' && BALL_PICS.includes(prefs.ballSkin) ? `ui/balls/${prefs.ballSkin}-${kind || 'carom'}-${n}.webp` : null;
// (kind 'pool': a ball of the rack, n its number; whole: one state for all of it, no quarters drawn)
function pzBall(cx, cy, r, n, q, u, kind, whole) {
  const id = `pz${u}b${n}`, url = pzBallUrl(n, kind), P = (a) => [cx + Math.cos(a) * r * 1.5, cy + Math.sin(a) * r * 1.5];
  const wedge = i => { const a0 = -Math.PI / 2 + i * Math.PI / 2, [x0, y0] = P(a0), [x1, y1] = P(a0 + Math.PI / 4), [x2, y2] = P(a0 + Math.PI / 2); return `M${cx} ${cy}L${x0} ${y0}L${x1} ${y1}L${x2} ${y2}Z`; };
  const face = (extra) => url ? `<image href="${url}" x="${cx - r}" y="${cy - r}" width="${2 * r}" height="${2 * r}" ${extra}/>` : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${(kind === 'pool' ? PZ_POOL_HUE : PZ_BALL_HUE)[n]}" ${extra}/>`;
  let s = `<clipPath id="${id}c"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath><circle cx="${cx}" cy="${cy}" r="${r + r * .08}" fill="#0b1a12"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#pz${u}h)"/>`;
  q.forEach((v, i) => {
    if (!v || v === 'n') return;
    s += `<clipPath id="${id}q${i}"><path d="${wedge(i)}"/></clipPath><g clip-path="url(#${id}c)"><g clip-path="url(#${id}q${i})">${face(v === 'x' ? `filter="url(#pz${u}g)"` : v === 'h' ? 'opacity=".4"' : '')}</g></g>`;
    if (v === 'x') s += `<path d="${wedge(i)}" clip-path="url(#${id}c)" fill="rgba(216,64,47,.3)"/>`;
  });
  if (!url && q.some(v => v && v !== 'n')) s += `<circle cx="${cx - r * .3}" cy="${cy - r * .35}" r="${r * .3}" fill="rgba(255,255,255,.28)" clip-path="url(#${id}c)"/>`;
  if (!whole) s += `<g clip-path="url(#${id}c)" stroke="rgba(0,0,0,.35)" stroke-width="${Math.max(1, r * .04)}"><line x1="${cx}" y1="${cy - r}" x2="${cx}" y2="${cy + r}"/><line x1="${cx - r}" y1="${cy}" x2="${cx + r}" y2="${cy}"/></g>`;
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
  quiet: false, save: false, cur: null, helped: 0, tries: 0,     // helped: 1 a hint seen, 2 the answer
  free: null,               // null: counted (the rated puzzle); 'day' 오늘의 퍼즐, 'book' one from the record - no points
  done: false,              // the counted attempt made (what it gave: puzzle.got)
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
    p.cur = z; p.k = kk; p.free = free; p.closed = null; prefs.pz.cur = z.id; savePrefs();
    usePhysics(); game.start(puzzles.modeOf(z), [prefs.names[0], ''], false, {});
    flow = puzzle; dress(false); useCue(prefs.cues[0]); scene.setTable(game.P); show('play'); p.bar(); p.again();
    // (what it has that is new to this player: said once, the first time - as the plan's 처음 만날 때 안내)
    const news = pzNews(z).filter(([key]) => !(prefs.pzr.met || []).includes(key));
    if (news.length) { prefs.pzr.met = (prefs.pzr.met || []).concat(news.map(n => n[0])); savePrefs(); toast(news.map(n => n[1]).join(' · '), '', 3600); }
    else if (!free && !p.done) toast(app.classList.contains('portrait') ? `${p.goal(z)} · 첫 시도만 점수` : '첫 시도만 점수에 들어갑니다', '', 2600);
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
    let said = null;
    // the counted attempt: the rating moved, a quarter of the case (a ball of the rack) filled
    if (!p.free && !p.done) {
      p.done = true; const res = p.helped ? 'h' : solved ? 'o' : 'x', out = pzr.record(p.k, z, res); p.got = { res, d: out.d }; p.closed = out.closed;
      said = res === 'h' ? '힌트를 봐서 점수 없음' : res === 'o' ? `성공 +${out.d}` : `실패 −${-out.d}`;
    }
    if (!solved) {
      p.tries++; toast((said ? said + ' · ' : '다시 · ') + (j.note || '실패') + (T > 1 && p.turn ? ' · 처음부터' : ''), 'foul', 2100); SND.bad();
      if (!prefs.pzFast && !p.askedFast) setTimeout(p.askFast, 1900);
      return hold(1.6, p.again);
    }
    attend.played();                                                   // (a puzzle solved: the day counted - 58-streak.js)
    if (p.free === 'day') { prefs.pz.day = attend.today(); savePrefs(); }   // (오늘의 퍼즐 done)
    // (paid once, by the server, after it plays the shots again - server/src/check.js)
    if (!prefs.pz.stars[z.id]) { prefs.pz.stars[z.id] = 1; savePrefs(); net.claim('puzzle', { id: z.id, shot: p.shots[0], shots: p.shots }); }
    toast(said || (p.free === 'day' ? '오늘의 퍼즐 완료!' : '정답!'), 'good', 2000); SND.good();
    hold(1.9, p.next);
  },
  hud() {
    const p = puzzle, z = p.cur, k = p.k, s = pzr.of(k), goal = p.goal(z), T = puzzles.turnsOf(z);
    const name = p.free === 'day' ? '오늘의 퍼즐' : p.free ? '다시 풀기' : `${s.r}`;
    paintPill(0, { name, on: true, sub: p.free ? '점수 없음' : p.done ? '점수 없음 · 연습' : '퍼즐 레이팅', tray: [], pts: null });
    paintBadge(k === 'pocket' ? '포켓 퍼즐' : '4구 퍼즐', { text: goal });
    // lying: the bar of its own (40-shot.js fbar) - the case (or rack) at its left (the place now ringed), the rating, the
    // goal and what this puzzle has; 힌트, and once the counted attempt is made 정답 and 다음
    const res = p.closed ? p.closed.res : s.now.slice(), mini = pzSvg(k === 'pocket' ? pzRackMini(res, !p.free && !p.done) : pzMini(res, !p.free && !p.done), 'fcase');   // (the case just closed: still shown full)
    const chips = pzNews(z).map(([key, , chip]) => el('span', { class: 'fchip' + (key === 'need' ? ' need' : ''), text: key === 'turns' ? `${p.turn + 1} / ${T}턴` : chip }));
    const after = p.free || p.done;
    fbar({ bar: [p.free ? null : mini,
      el('div', { class: 'fpl on' }, p.free ? [el('span', { class: 'fnm', text: name }), el('span', { class: 'fsb', text: '점수 없음' })]
        : [el('span', { class: 'fnm num', text: String(s.r) }), el('span', { class: 'fsb', text: p.got ? (p.got.d > 0 ? `+${p.got.d}` : p.got.d < 0 ? `−${-p.got.d}` : '±0') : '레이팅' })]),
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
  // a hint marks every place the cue ball touches on the way, numbered (seen before the counted shot: it counts for nothing);
  // the answer (once the counted shot is made) is played out in full
  hint() { const p = puzzle, z = p.cur, sol = puzzles.shotOf(z, p.turn); p.helped = Math.max(+p.helped, 1); if (!p.free && !p.done) { pzr.of(p.k).hinted = z.id; savePrefs(); } scene.setMarks(p.marks(z)); p.hud(); const k = sol[4] ? ` 큐를 ${Math.round(sol[4] * 180 / Math.PI)}° 세워 칩니다.` : sol[3] > 0 ? ' 밀어치기입니다.' : sol[3] < 0 ? ' 끌어치기입니다.' : ''; toast('힌트: 흰 공이 번호 순서대로 닿습니다.' + k, '', 3600); },
  answer() { const p = puzzle, z = p.cur, sol = puzzles.shotOf(z, p.turn); p.helped = 2; scene.setMarks(null); p.hud(); toast(puzzles.turnsOf(z) > 1 ? `정답: ${p.turn + 1}턴은 이렇게 칩니다.` : '정답: 이렇게 치면 됩니다.', '', 2200); playDemo({ angle: sol[0], power: game.powerOf(sol[1]), a: sol[2], b: sol[3], el: sol[4] }, { quiet: false, after: p.retake }); },
  // (upright: the row of keys where the second player's plate would be)
  bar() {
    const p = puzzle, box = $('#pracBar'); box.textContent = ''; box.hidden = false; $('#p1').hidden = true;
    const btn = (text, fn) => box.appendChild(el('button', { class: 'btn', text, onclick: () => { SND.tap(); fn(); } }));
    btn('힌트', p.aiming(p.hint)); btn('정답', p.aiming(() => { if (p.free || p.done) p.answer(); else toast('첫 시도를 한 뒤에 볼 수 있습니다', '', 1800); }));
    btn('다음', p.aiming(() => { if (p.free || p.done) p.next(); else toast('첫 시도를 한 뒤에 넘어갈 수 있습니다', '', 1800); }));
  },
};
