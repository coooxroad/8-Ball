/* ================= flow: puzzle - 퍼즐 레이팅 (owner 11-23, as Chess.com's puzzles are) =================
   No stages and no topics: a rating for each game (4구 now, 포켓 to come), and the puzzle served is one near it, not
   seen before, hidden until it is started. Only its first shot counts - solved, the rating goes up by as much as the
   puzzle was harder than expected; missed, down. A hint seen first makes it count for nothing either way. After the
   counted shot it can be tried again (no points), its answer shown, or passed for the next. Each counted puzzle fills a
   quarter of a ball in the case (white, yellow, red, red - 16 to a case); a full case is closed and kept in the record,
   whose puzzles can be played again only without points. The case's material goes up with the rating (PZ_MATS).
   The puzzles' own ratings are provisional (PZ_BAND, by what each asks) until the puzzle AI rates them (task: puzzle
   AI - plan in the project's cue-puzzle-overhaul-plan.md). Up to 800 only plain 4구 positions; harder kinds above. */
const PZ_CASE = 16, PZ_BALL_KO = ['흰 공', '노란 공', '빨간 공', '빨간 공'];
// a puzzle's provisional rating: its kind's band, spread over its place in the kind, a little shaken by its id
const PZ_BAND = [[420, 800], [950, 1300], [1000, 1380], [850, 1180], [620, 980], [1250, 1680], [1400, 1820], [1050, 1480]];
const pzRating = q => q.rating || (b => Math.round(b[0] + (b[1] - b[0]) * ((q.n - 1) / 19) + ((q.id * 37) % 61) - 30))(PZ_BAND[q.stage] || [1000, 1400]);
// the case's material, finer as the rating climbs (owner 11-23: 원목 → 메이플 → 황동 → 크롬 → 금)
const PZ_MATS = [{ n: '원목', at: 0, a: '#7a4426', b: '#4a2a15', e: '#2f1a0c', t: 'rgba(230,200,140,.35)' }, { n: '메이플', at: 1000, a: '#d9a86a', b: '#a8743c', e: '#6f4a22', t: 'rgba(255,240,210,.5)' },
  { n: '황동', at: 1400, a: '#e6c46a', b: '#a8822c', e: '#6f5416', t: 'rgba(255,245,200,.6)' }, { n: '크롬', at: 1800, a: '#eef1f5', b: '#8f98a4', e: '#4d5560', t: 'rgba(255,255,255,.7)' },
  { n: '금', at: 2200, a: '#ffe38a', b: '#d99a00', e: '#7a5200', t: 'rgba(255,250,220,.75)' }];
const pzMatOf = r => PZ_MATS.reduce((m, x, i) => r >= x.at ? i : m, 0);
const pzr = {
  of: (k = 'four') => prefs.pzr[k],
  exp: (R, Rp) => 1 / (1 + Math.pow(10, (Rp - R) / 400)),
  K: s => s.n < 20 ? 48 : 32,                                         // (moving faster while it is still finding its level)
  // what the puzzle would give, solved or missed
  gain(s, q) { const E = pzr.exp(s.r, pzRating(q)), K = pzr.K(s); return { win: Math.max(1, Math.round(K * (1 - E))), lose: Math.max(1, Math.round(K * E)) }; },
  // the puzzle served next: kept once chosen (leaving and coming back gives the same one), else one of the five nearest
  // the rating among those not met yet (all met: the oldest are let back in)
  next(k = 'four') {
    const s = pzr.of(k), L = puzzles.list.filter(q => !q.shape && q.sol);
    if (!L.length) return null;
    const cur = puzzles.byId(s.cur); if (cur && !s.seen.includes(cur.id)) return cur;
    let pool = L.filter(q => !s.seen.includes(q.id)); if (!pool.length) { s.seen = s.seen.slice(-Math.floor(L.length / 4)); pool = L.filter(q => !s.seen.includes(q.id)); }
    pool.sort((a, b) => Math.abs(pzRating(a) - s.r) - Math.abs(pzRating(b) - s.r));
    const q = pool[Math.floor(Math.random() * Math.min(5, pool.length))];
    s.cur = q.id; savePrefs(); return q;
  },
  // the counted shot: o solved, x missed, h a hint seen first (no points). Returns the change and the case if it closed
  record(k, q, res) {
    const s = pzr.of(k), t = attend.today(), g = pzr.gain(s, q);
    if (!s.now.length) { s.r0 = s.r; s.mat = pzMatOf(s.r); }
    if (s.dayT !== t) { s.dayT = t; s.day0 = s.r; }
    const d = res === 'o' ? g.win : res === 'x' ? -g.lose : 0;
    s.r = Math.max(100, s.r + d); if (res !== 'h') s.n++;
    s.seen.push(q.id); s.cur = null; s.now.push([q.id, res, d]); s.hist = s.hist.concat(s.r).slice(-30);
    let closed = null;
    if (s.now.length >= PZ_CASE) { closed = { t, res: s.now, r0: s.r0 != null ? s.r0 : s.r - d, r1: s.r, m: s.mat || 0 }; s.cases.unshift(closed); s.cases = s.cases.slice(0, 40); s.now = []; }
    savePrefs(); return { d, closed };
  },
  today: (k = 'four') => { const s = pzr.of(k); return s.dayT === attend.today() ? s.r - s.day0 : null; },
};
/* The pictures: a ball whose four quarters fill clockwise from 12 o'clock - solved, the ball's own picture; missed, the
   picture greyed under a red veil; a hint seen, faint; the one to play now, ringed blue - and the case holding four. */
let pzUid = 0;
const PZ_BALL_HUE = ['#f4f1ea', '#f2c21b', '#d62b2b', '#d62b2b'];
const pzBallUrl = n => typeof BALL_PICS !== 'undefined' && BALL_PICS.includes(prefs.ballSkin) ? `ui/balls/${prefs.ballSkin}-carom-${n}.webp` : null;
function pzBall(cx, cy, r, n, q, u) {
  const id = `pz${u}b${n}`, url = pzBallUrl(n), P = (a) => [cx + Math.cos(a) * r * 1.5, cy + Math.sin(a) * r * 1.5];
  const wedge = i => { const a0 = -Math.PI / 2 + i * Math.PI / 2, [x0, y0] = P(a0), [x1, y1] = P(a0 + Math.PI / 4), [x2, y2] = P(a0 + Math.PI / 2); return `M${cx} ${cy}L${x0} ${y0}L${x1} ${y1}L${x2} ${y2}Z`; };
  const face = (extra) => url ? `<image href="${url}" x="${cx - r}" y="${cy - r}" width="${2 * r}" height="${2 * r}" ${extra}/>` : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${PZ_BALL_HUE[n]}" ${extra}/>`;
  let s = `<clipPath id="${id}c"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath><circle cx="${cx}" cy="${cy}" r="${r + r * .08}" fill="#0b1a12"/><circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#pz${u}h)"/>`;
  q.forEach((v, i) => {
    if (!v || v === 'n') return;
    s += `<clipPath id="${id}q${i}"><path d="${wedge(i)}"/></clipPath><g clip-path="url(#${id}c)"><g clip-path="url(#${id}q${i})">${face(v === 'x' ? `filter="url(#pz${u}g)"` : v === 'h' ? 'opacity=".4"' : '')}</g></g>`;
    if (v === 'x') s += `<path d="${wedge(i)}" clip-path="url(#${id}c)" fill="rgba(216,64,47,.3)"/>`;
  });
  if (!url && q.some(v => v && v !== 'n')) s += `<circle cx="${cx - r * .3}" cy="${cy - r * .35}" r="${r * .3}" fill="rgba(255,255,255,.28)" clip-path="url(#${id}c)"/>`;
  s += `<g clip-path="url(#${id}c)" stroke="rgba(0,0,0,.35)" stroke-width="${Math.max(1, r * .04)}"><line x1="${cx}" y1="${cy - r}" x2="${cx}" y2="${cy + r}"/><line x1="${cx - r}" y1="${cy}" x2="${cx + r}" y2="${cy}"/></g>`;
  const ni = q.indexOf('n'); if (ni >= 0) s += `<path d="${wedge(ni)}" clip-path="url(#${id}c)" fill="rgba(94,200,255,.28)" stroke="#5ec8ff" stroke-width="${Math.max(2, r * .09)}"/>`;
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
// one ball with one quarter filled - a puzzle of a case in the record
function pzOne(j, res) { const u = ++pzUid, r = 12, q = ['', '', '', '']; q[j & 3] = res; return `<svg class="pz-mini" viewBox="0 0 ${2 * r + 4} ${2 * r + 4}" aria-hidden="true">${pzDefs(u)}${pzBall(r + 2, r + 2, r, j >> 2, q, u)}</svg>`; }
const pzSvg = (html, cls) => { const s = el('span', { class: cls }); s.innerHTML = html; return s; };

const puzzle = {
  quiet: false, save: false, cur: null, helped: 0, tries: 0,     // helped: 1 a hint seen, 2 the answer
  free: null,               // null: counted (the rated puzzle); 'day' 오늘의 퍼즐, 'book' one from the record - no points
  done: false,              // the counted shot made (what it gave: puzzle.got)
  stage: z => puzzles.STAGES[z.stage],
  // the balls of a puzzle, onto the table
  put(z) {
    const P = game.P, w = game.world, n = Math.hypot(z.balls[2][0] - z.balls[0][0], z.balls[2][1] - z.balls[0][1]) <= Math.hypot(z.balls[3][0] - z.balls[0][0], z.balls[3][1] - z.balls[0][1]) ? 2 : 3;
    w.walls = P.walls(z.walls);                                       // (its barricades, if it has any)
    // (its table's shape, if it has one: { kind, ... } as tables.js TABLE_SHAPES makes, or { poly, holes } given whole)
    w.shape = z.shape ? P.shape(z.shape.poly ? z.shape : TABLE_SHAPES.spec(P, z.shape)) : null;
    z.balls.forEach((b, i) => P.place(w, i, b[0], b[1], Math.random));
    w.cue = 0; game.goal = puzzle.stage(z).goal;
    scene.clearFalls(); scene.setZone(null); scene.setMarks(null); st.aim = Math.atan2(z.balls[n][1] - z.balls[0][1], z.balls[n][0] - z.balls[0][0]); st.rev++; scene.invalidate();
  },
  // the rated puzzle (no id), or one to play without points (opt.free: 'day' or 'book')
  start(id, opt) {
    if (!puzzles.list.length) return toast('새 퍼즐을 만드는 중입니다.', '', 2200);
    const p = puzzle, free = (opt && opt.free) || null, z = free ? puzzles.byId(id) : pzr.next('four');
    if (!z) return;
    if (!p.cur || p.cur.id !== z.id || p.free !== free) { p.helped = 0; p.tries = 0; p.done = false; p.got = null; }
    if (!free && pzr.of('four').hinted === z.id) p.helped = Math.max(p.helped, 1);   // (a hint seen, then left: still seen)
    p.cur = z; p.free = free; p.closed = null; prefs.pz.cur = z.id; savePrefs();
    usePhysics(); game.start('puzzle4', [prefs.names[0], ''], false, {});
    flow = puzzle; dress(false); useCue(prefs.cues[0]); scene.setTable(game.P); show('play'); p.bar(); p.again();
    if (!free && !p.done) toast(app.classList.contains('portrait') ? `${p.goal(z)} · 첫 시도만 점수` : '첫 시도만 점수에 들어갑니다', '', 2600);
  },
  goal: z => game.MODES.puzzle4.GOALS[puzzle.stage(z).goal].text,
  restart() { const p = puzzle; if (p.done && !p.free) return p.again(); p.start(p.free ? p.cur.id : null, { free: p.free }); },
  again() { flow = puzzle; puzzle.put(puzzle.cur); beginTurn(true); },
  // on: the next rated puzzle - or, a case just closed, its result on the desk; a free one, back where it came from
  next() {
    const p = puzzle;
    if (p.free || p.closed) { if (p.closed) pzDone = p.closed; if (p.free === 'book') pzBook = pzBook || 0; p.closed = null; trainGo('puzzle'); return goHome(); }
    p.start();
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
    const p = puzzle, z = p.cur, r = game.resolve().r;
    let said = null;
    // the counted shot: the rating moved, a quarter of the case filled
    if (!p.free && !p.done) {
      p.done = true; const res = p.helped ? 'h' : r.solved ? 'o' : 'x', out = pzr.record('four', z, res); p.got = { res, d: out.d }; p.closed = out.closed;
      said = res === 'h' ? '힌트를 봐서 점수 없음' : res === 'o' ? `성공 +${out.d}` : `실패 −${-out.d}`;
    }
    if (!r.solved) {
      p.tries++; toast((said ? said + ' · ' : '다시 · ') + r.note, 'foul', 2100); SND.bad();
      if (!prefs.pzFast && !p.askedFast) setTimeout(p.askFast, 1900);
      return hold(1.6, p.again);
    }
    attend.played();                                                   // (a puzzle solved: the day counted - 58-streak.js)
    if (p.free === 'day') { prefs.pz.day = attend.today(); savePrefs(); }   // (오늘의 퍼즐 done)
    if (!prefs.pz.stars[z.id]) { prefs.pz.stars[z.id] = 1; savePrefs(); net.claim('puzzle', { id: z.id, shot: puzzle.shot }); }   // (paid once, by the server, after it plays the shot again)
    toast(said || (p.free === 'day' ? '오늘의 퍼즐 완료!' : '정답!'), 'good', 2000); SND.good();
    hold(1.9, p.next);
  },
  hud() {
    const p = puzzle, z = p.cur, s = pzr.of('four'), goal = p.goal(z);
    const name = p.free === 'day' ? '오늘의 퍼즐' : p.free ? '다시 풀기' : `${s.r}`;
    paintPill(0, { name, on: true, sub: p.free ? '점수 없음' : p.done ? '점수 없음 · 연습' : '퍼즐 레이팅', tray: [], pts: null });
    paintBadge('4구 퍼즐', { text: goal });
    // lying: the bar of its own (40-shot.js fbar) - the case at its left (the quarter now ringed), the rating, the goal and
    // what this puzzle has (a barricade); 힌트, and once the counted shot is made 정답 and 다음
    const res = p.closed ? p.closed.res : s.now.slice(), mini = pzSvg(pzMini(res, !p.free && !p.done), 'fcase');   // (the case just closed: still shown full)
    const chips = [z.walls ? el('span', { class: 'fchip', text: '바리케이드' }) : null];
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
  // where the cue ball of the stored answer touches a cushion or a ball, in order, up to the second red
  marks(z) {
    const P = game.P, t = P.clone(game.world), out = []; t.snd = []; P.strike(t, z.sol[0], z.sol[1], z.sol[2], z.sol[3], z.sol[4]);
    for (let i = 0; i < 120 * 25 && !P.rest(t) && out.length < 9; i++) {
      P.step(t, TICK);
      for (const e of t.snd) { if (e.t === 'rail' && e.id === 0) out.push({ x: e.x, y: e.y }); else if (e.t === 'ball' && (e.ia === 0 || e.ib === 0)) out.push({ x: e.x, y: e.y }); }
      t.snd.length = 0; if (t.ev.hits.includes(2) && t.ev.hits.includes(3)) break;
    }
    return out;
  },
  aiming: fn => () => { if (flow === puzzle && st.phase === 'aim') fn(); },
  // a hint marks every place the cue ball touches on the way, numbered (seen before the counted shot: it counts for nothing);
  // the answer (once the counted shot is made) is played out in full
  hint() { const p = puzzle, z = p.cur; p.helped = Math.max(+p.helped, 1); if (!p.free && !p.done) { pzr.of('four').hinted = z.id; savePrefs(); } scene.setMarks(p.marks(z)); p.hud(); const k = z.sol[4] ? ` 큐를 ${Math.round(z.sol[4] * 180 / Math.PI)}° 세워 칩니다.` : z.sol[3] > 0 ? ' 밀어치기입니다.' : z.sol[3] < 0 ? ' 끌어치기입니다.' : ''; toast('힌트: 흰 공이 번호 순서대로 닿습니다.' + k, '', 3600); },
  answer() { const p = puzzle, z = p.cur; p.helped = 2; scene.setMarks(null); p.hud(); toast('정답: 이렇게 치면 됩니다.', '', 2200); playDemo({ angle: z.sol[0], power: game.powerOf(z.sol[1]), a: z.sol[2], b: z.sol[3], el: z.sol[4] }, { quiet: false, after: p.again }); },
  // (upright: the row of keys where the second player's plate would be)
  bar() {
    const p = puzzle, box = $('#pracBar'); box.textContent = ''; box.hidden = false; $('#p1').hidden = true;
    const btn = (text, fn) => box.appendChild(el('button', { class: 'btn', text, onclick: () => { SND.tap(); fn(); } }));
    btn('힌트', p.aiming(p.hint)); btn('정답', p.aiming(() => { if (p.free || p.done) p.answer(); else toast('첫 시도를 한 뒤에 볼 수 있습니다', '', 1800); }));
    btn('다음', p.aiming(() => { if (p.free || p.done) p.next(); else toast('첫 시도를 한 뒤에 넘어갈 수 있습니다', '', 1800); }));
  },
};
