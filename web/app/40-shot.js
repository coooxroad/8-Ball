/* ================= shot pipeline (the same for every flow) ================= */
function beginTurn(first) {
  powerHold.clear();   // (오발 방지's held power is the last turn's: 80-input.js)
  // (증강 당구: the table's vote or an augments' round comes first - the turn begins once it is done: 55-arcade.js)
  if (arcade.hold(first)) return;
  // (a turn begins clean: a 4구 roll-out left mid-roll by another flow is not this flow's - Codex B19)
  st.rolling = false; st.phase = 'aim'; st.clock = clockLimit(); st.power = 0; st.spin = { x: 0, y: 0 }; st.el = st.elWant = 0; setPowerUI(0); setSpinUI(); setKindUI(); $('#spinPop').hidden = true;
  const auto = flow.auto();
  if (auto) { st.phase = 'auto'; st.auto = { t: 0, plan: null, from: st.aim, src: auto }; }
  else if (!first || game.mode.table === 'carom') {
    const c = game.cueBall(); let best = null, bd = 1e9;
    for (const id of game.legal()) { const b = game.world.balls[id], d = Math.hypot(b.x - c.x, b.y - c.y); if (d < bd) { bd = d; best = b; } }
    if (best) st.aim = Math.atan2(best.y - c.y, best.x - c.x);
  }
  // a player's own turn in a match begins with their cue chalked (90-loop.js chalkTick): never the other player's - the
  // computer's or the one at the other end of a game online - and gone at the first touch
  st.chalk = !auto && flow === match && !flow.quiet && !game.players[game.turn].ai ? { t: 0, n: -1 } : null;
  flow.hud(); scene.invalidate(); snapshot();
}
function shoot(V, a, b, el) {
  el = el || 0;
  // (the aim back within a turn before it is struck, sent or written down - the dial turned round and round piles it up,
  // and past ±20 a room took it for a forged shot and gave the game away: QA 11-20 R03. Within a turn it stays as it is.)
  if (Math.abs(st.aim) > Math.PI) st.aim = Math.atan2(Math.sin(st.aim), Math.cos(st.aim));
  { const L = lookNow(); if (L) scene.setTrail(L.trails[game.shooter()]); }      // (a ranked game: the trail of the player shooting)
  const seen = Math.max(el, shownEl());   // (the cue drawn as high as 현실 당구 raises it: the shot is struck with el, raised in physics.js)
  flow.beforeShot(V, a, b, el); game.beginShot();
  st.phase = 'strike'; $('#spinPop').hidden = true;
  st.cueAnim = { t: 0, from: 0.03 + st.power * 0.2, V, a, b, el, show: seen };
  flow.hud();
}
function endShot() { st.rev++; flow.afterShot(); }
// (what comes after is the flow's that asked for it: another flow begun meanwhile does not get it - Codex B19)
function hold(seconds, then) { st.phase = 'hold'; st.holdT = seconds; st.afterHold = then; st.holdFlow = flow; flow.hud(); }

/* The computer's plan is worked out in a Worker (ai-worker.js: the same game code, the same plan) so that the screen never
   waits for a search - a few hundred milliseconds at 8볼's top level. The question goes as the turn begins and the answer is
   taken once it is there and the thinking time is up (autoTick). The Worker is made from the page's own game code (its
   first script, id "core"; on the web, the core file). If there is no Worker, it fails, or it has not answered in 8 s, the
   plan is worked out here as it always was. A stand-in's seeded chances come back from the Worker and go on from there. */
/* (slow: how long the Worker is waited for before the plan is worked out here instead. A test raises it: on CI's software
   renderer the page's own frames take the runner's cores and the Worker's first answer came after the 8 s now and then -
   the game fell back as it should, and the test that checks the Worker's answer arrives failed, 11-22) */
const aiw = { w: null, n: 0, wait: new Map(), dead: false, slow: 8000 };
/* The address a Worker of the core is made from: the page's own core script made a file once (a Blob, about 600 KB) and
   shared by the computer's Worker and the review's (50-review.js) - each used to make its own copy; on the web, the core
   file. null: none. */
let coreUrlMade;
function coreUrl() {
  if (coreUrlMade !== undefined) return coreUrlMade;
  const core = document.getElementById('core'), src = core && core.textContent;
  return coreUrlMade = src && src.length > 1000 ? URL.createObjectURL(new Blob([src], { type: 'text/javascript' })) : core && core.src ? core.src : null;
}
function aiWorker() {
  if (aiw.w || aiw.dead) return aiw.w;
  try {
    const url = coreUrl();
    if (!url) { aiw.dead = true; return null; }
    const w = new Worker(url);
    w.onmessage = e => { const r = e.data, j = aiw.wait.get(r.id); aiw.wait.delete(r.id); if (j) { j.res = r; if (j.cb) j.cb(r); } };
    w.onerror = () => { aiw.dead = true; aiw.w = null; for (const j of aiw.wait.values()) j.res = { err: 'worker' }; aiw.wait.clear(); };
    aiw.w = w;
  } catch (e) { aiw.dead = true; }
  return aiw.w;
}
const tableNow = () => (TABLES.find(t => tableCache[t.id] === PH.pool) || {}).id || prefs.table;
function aiAsk(a) {
  if (a.aiPlan) return a.aiPlan;
  if (!a.aiJob) {
    const w = aiWorker(), j = a.aiJob = { t: performance.now(), res: null, rnd: game.aiRnd };
    if (w) { const id = ++aiw.n; aiw.wait.set(id, j); w.postMessage({ id, tbl: tableNow(), d: game.serialize(), levels: game.levels, personas: game.personas, humanStates: game.humanStates, humanCanResign: !!game.humanCanResign, rnd: game.aiRnd ? game.aiRnd.state() : null }); }
    else j.res = { err: 'none' };
  }
  const j = a.aiJob;
  if (!j.res && performance.now() - j.t > aiw.slow) j.res = { err: 'slow' };
  if (!j.res) return null;
  if (j.res.err) a.aiPlan = game.aiPlan();
  else { a.aiPlan = j.res.plan; if (j.rnd && j.res.rnd != null) j.rnd.seek(j.res.rnd); }
  if (a.aiPlan && a.aiPlan.humanState) {
    if (!game.humanStates) game.humanStates = [null, null];
    game.humanStates[game.turn] = a.aiPlan.humanState;
  }
  return a.aiPlan;
}
// The computer and the demo line up a shot the same way: wait, decide, swing the cue round, pull back, shoot.
// plan: { angle, V, a, b, pos? }
function autoTick(dt) {
  const a = st.auto; a.t += dt;
  if (!a.plan) {
    if (a.src.ai) aiAsk(a);                                          // (the computer starts thinking now, off the screen's thread)
    if (a.t < a.src.think) return;
    { const t0 = performance.now(); a.plan = a.src.plan(a); prof.add('ai', performance.now() - t0); }
    if (!a.plan) return;                                              // (the other player's shot has not come yet)
    a.t0 = a.t; a.pw = Math.min(1, game.powerOf(a.plan.V)); a.p0 = st.power;
    if (a.plan.pos) { const pos = a.plan.preShot && a.plan.preShot.keyframes[0].pos || a.plan.pos; const c = game.cueBall(); c.x = c.px = pos[0]; c.y = c.py = pos[1]; game.placing = null; }
    let d = a.plan.angle - a.from; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; a.delta = d;
    const pose = a.plan.preShot && a.plan.preShot.version === 3 ? a.plan.preShot.keyframes[0] : a.plan;
    if (a.src.showSpin) { st.spin = { x: pose.a / 0.5, y: pose.b / 0.5 }; setSpinUI(); }
    st.el = pose.el || game.P.restEl(); setKindUI(); flow.hud();
    return;
  }
  const t = a.t - a.t0, e = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
  // a person-like player (ai/50-human.js) lines up its own way - looking about, waggling, settling - then strikes
  if (a.plan.preShot && game.aiPlan.cueAt) {
    const q = game.aiPlan.cueAt(a.plan, t); st.aim = q.angle; st.power = Math.max(0, Math.min(1, q.power)); setPowerUI(st.power);
    const spin = { x: q.a / 0.5, y: q.b / 0.5 };
    if (spin.x !== st.spin.x || spin.y !== st.spin.y) { st.spin = spin; setSpinUI(); }
    if (q.el !== st.el) { st.el = q.el; setKindUI(); }
    if (a.plan.pos && q.pos) { const c = game.cueBall(); if (c.x !== q.pos[0] || c.y !== q.pos[1]) { c.x = c.px = q.pos[0]; c.y = c.py = q.pos[1]; st.rev++; } }
    if (t >= a.plan.preShot.duration) {
      st.aim = a.plan.angle; st.auto = null;
      if (a.plan.action === 'resign' && a.src.resign) { st.phase = 'idle'; a.src.resign(); return; }
      shoot(a.plan.V, a.plan.a, a.plan.b, st.el);
    }
    return;
  }
  /* the other player online (54-ranked.js): their cue has been shown live as they moved it (aimShow), so it is only
     brought the last of the way and struck - it used to be swung and drawn back again over 1.45 s after the shot came,
     the whole of that behind the other screen */
  if (a.plan.quick) {
    const u = e(t / 0.15); st.aim = a.from + a.delta * u; st.power = a.p0 + (a.pw - a.p0) * u; setPowerUI(st.power);
    if (t >= 0.18) { st.aim = a.plan.angle; st.auto = null; shoot(a.plan.V, a.plan.a, a.plan.b, st.el); }
    return;
  }
  st.aim = a.from + a.delta * e(t / 0.75);
  st.power = a.pw * e((t - 0.85) / 0.45); setPowerUI(st.power);
  if (t > 1.45) { st.aim = a.plan.angle; st.auto = null; shoot(a.plan.V, a.plan.a, a.plan.b, st.el); }
}

/* ================= scoreboard ================= */
function paintPill(i, s) {
  const box = $('#p' + i), tray = box.querySelector('.tray');
  box.classList.toggle('on', !!s.on);
  box.querySelector('.nm').textContent = s.name;
  // (copy audit 05-13: thinking - the moving dots alone, said to a screen reader)
  const sub = box.querySelector('.sub'); sub.textContent = s.think ? '' : s.sub; sub.setAttribute('aria-label', s.think ? '생각 중' : ''); box.classList.toggle('think', !!s.think);
  const pts = box.querySelector('.pts'); pts.textContent = s.pts == null ? '' : s.pts; pts.dataset.goal = s.goal == null ? '' : s.goal;
  tray.textContent = '';
  for (const t of s.tray || []) { const c = tray.appendChild(t === 'slot' ? el('i', { class: 'mb slot' }) : t === 'eight' ? el('i', { class: 'mb e8' }) : ballChip(t)); if (s.pop && s.pop.includes(t)) c.classList.add('pop'); }
}
function paintBadge(name, b) {
  const badge = $('#badge'); badge.textContent = '';
  badge.appendChild(el('b', { text: name })); badge.appendChild(document.createTextNode(b.text));
  for (const id of b.balls || []) badge.appendChild(ballChip(id, b.plain ? '' : id === b.mark ? 'box-shadow:0 0 0 2px #ffd21f' : 'opacity:.55'));
  if (b.sub) badge.appendChild(el('small', { class: 'bsub', text: b.sub }));   // (스누커: the points still on the table)
}
const setBusy = () => app.classList.toggle('busy', !(st.screen === 'play' && st.phase === 'aim'));
/* Puzzles and lessons, lying (owner 11-22, Z3 + P2 and L6): one bar of their own in the match bar's place and colours
   (style/82-ingame.css #flowBar) - a puzzle's name and stars, its goal as the headline, 힌트 · 정답 in the bar and the
   arrows at its ends; a lesson's name, its five named levels and the rate, with its task on a strap under the bar and its
   keys in the row along the top. Upright, the plates and #pracBar of before. fbar(null) takes it away. */
const FB_ICO = { prev: 'M15 5l-7 7 7 7', next: 'M9 5l7 7-7 7', bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z',
  play: 'M7 5l12 7-12 7z', shuf: 'M4 7h3c5 0 5 10 10 10h3M4 17h3c2 0 3-1.5 4-3M17 7h3M14 10c1-2 2-3 3-3M18 4l3 3-3 3M18 14l3 3-3 3' };
function fbIco(k) {
  const ns = 'http://www.w3.org/2000/svg', s = document.createElementNS(ns, 'svg'), p = document.createElementNS(ns, 'path');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); p.setAttribute('d', FB_ICO[k]); s.appendChild(p); return s;
}
// a key in the bar or in the row along the top: an icon, a word under or beside it, pressed only while aiming
const fbKey = (cls, ico, text, fn, label) => el('button', { class: cls, 'aria-label': label || text, onclick: () => { SND.tap(); fn(); } }, [ico && fbIco(ico), text ? el('span', { text }) : null]);
function fbar(s) {
  const box = $('#flowBar'); box.textContent = ''; app.classList.toggle('fbar', !!s); app.classList.toggle('fstrap', !!(s && s.cap));
  if (!s) return;
  app.style.setProperty('--nt', s.keys ? s.keys.length : 0);
  box.appendChild(el('div', { class: 'fw' }, el('div', { class: 'fb' }, s.bar)));
  if (s.cap) box.appendChild(el('div', { class: 'fcap' }, s.cap));
  if (s.keys) box.appendChild(el('div', { class: 'fkeys' }, s.keys));
}
// (puzzles solved at the first shot, one after another: a small flame and how many - 52-puzzle.js)
const fbRun = n => { const s = el('span', { class: 'frun', 'aria-label': `한 번에 ${n}연속` }); s.innerHTML = flameSvg(n >= 10 ? 't30' : n >= 5 ? 't7' : 't1'); s.appendChild(el('b', { text: String(n) })); return s; };
const fbStars = n => el('span', { class: 'fstars', 'aria-label': `별 ${n}개` }, [0, 1, 2].map(i => el('i', { class: i < n ? 'f' : '' })));

// A small top view of one shot: the table, where the balls stood, and the lines the cue ball and the ball that mattered drew.
// a ball's colour on the little tables (the highlights, the review's table)
const shotColour = (i, cue) => game.mode.table === 'carom' ? ['#ffffff', '#ffd23c', '#ff4d43', '#ff4d43'][i < 2 && game.yellow === 0 ? 1 - i : i] : i === cue ? '#ffffff' : game.mode.table === 'snooker' ? SNOOKER.css(i) : ballCss(game.faceOf(i));
function drawShot(cv, shot) {
  const dpr = Math.min(3, window.devicePixelRatio || 1), cw = cv.clientWidth, ch = cv.clientHeight; if (!cw || !ch) return;
  cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
  const g = cv.getContext('2d'), P = game.P, pad = 5 * dpr, k = Math.min((cv.width - 2 * pad) / (2 * P.HL), (cv.height - 2 * pad) / (2 * P.HW));
  const X = x => cv.width / 2 + x * k, Y = y => cv.height / 2 - y * k, colOf = i => shotColour(i, shot.snap.cue);
  g.fillStyle = hex(CLOTHS[prefs.cloth].felt); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2 * dpr;
  g.fillRect(0, 0, cv.width, cv.height);                             // (the cloth right up to the little table's frame)
  g.beginPath(); g.rect(X(-P.HL), Y(P.HW), 2 * P.HL * k, 2 * P.HW * k); g.fill(); g.stroke();
  g.fillStyle = '#0b0b0d'; for (const p of P.POCKETS) { g.beginPath(); g.arc(X(p.x), Y(p.y), p.r * k * 0.8, 0, 6.3); g.fill(); }
  let tape = null; try { tape = highlights.record(P, shot.snap.balls.length, shot); } catch (e) {}
  const key = shot.kind ? shot.ball : shot.key >= 0 ? shot.key : shot.snap.cue;
  if (tape) for (const id of [shot.snap.cue, key]) {
    const pts = highlights.path(tape, id); if (!pts) continue;
    g.beginPath(); for (let i = 0; i < pts.length; i += 3) { if (i) g.lineTo(X(pts[i]), Y(pts[i + 1])); else g.moveTo(X(pts[i]), Y(pts[i + 1])); }
    g.lineJoin = g.lineCap = 'round'; g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 3.4 * dpr; g.stroke(); g.strokeStyle = colOf(id); g.lineWidth = 1.8 * dpr; g.stroke();
    if (id === shot.snap.cue && id === key) break;
  }
  shot.snap.balls.forEach((b, i) => { if (!b[2]) return; g.beginPath(); g.arc(X(b[0]), Y(b[1]), Math.max(2.2 * dpr, P.R * k), 0, 6.3); g.fillStyle = colOf(i); g.fill(); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = dpr; g.stroke(); });
}
