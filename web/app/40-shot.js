/* ================= shot pipeline (the same for every flow) ================= */
function beginTurn(first) {
  st.phase = 'aim'; st.power = 0; st.spin = { x: 0, y: 0 }; st.el = 0; st.elWant = game.P.BASE_EL; setPowerUI(0); setSpinUI(); setKindUI(); $('#spinPop').hidden = true;
  const auto = flow.auto();
  if (auto) { st.phase = 'auto'; st.auto = { t: 0, plan: null, from: st.aim, src: auto }; }
  else if (!first || game.mode.table === 'carom') {
    const c = game.cueBall(); let best = null, bd = 1e9;
    for (const id of game.legal()) { const b = game.world.balls[id], d = Math.hypot(b.x - c.x, b.y - c.y); if (d < bd) { bd = d; best = b; } }
    if (best) st.aim = Math.atan2(best.y - c.y, best.x - c.x);
  }
  flow.hud(); scene.invalidate(); snapshot();
}
function shoot(V, a, b, el) {
  el = el || 0;
  flow.beforeShot(V, a, b, el); game.beginShot();
  st.phase = 'strike'; $('#spinPop').hidden = true;
  st.cueAnim = { t: 0, from: 0.03 + st.power * 0.2, V, a, b, el };
  flow.hud();
}
function endShot() { st.rev++; flow.afterShot(); }
function hold(seconds, then) { st.phase = 'hold'; st.holdT = seconds; st.afterHold = then; flow.hud(); }

// The computer and the demo line up a shot the same way: wait, decide, swing the cue round, pull back, shoot.
// plan: { angle, V, a, b, pos? }
function autoTick(dt) {
  const a = st.auto; a.t += dt;
  if (!a.plan) {
    if (a.t < a.src.think) return;
    a.plan = a.src.plan(); a.t0 = a.t; a.pw = Math.min(1, game.powerOf(a.plan.V));
    if (a.plan.pos) { const c = game.cueBall(); c.x = c.px = a.plan.pos[0]; c.y = c.py = a.plan.pos[1]; game.placing = null; }
    let d = a.plan.angle - a.from; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; a.delta = d;
    if (a.src.showSpin) { st.spin = { x: a.plan.a / 0.5, y: a.plan.b / 0.5 }; setSpinUI(); }
    st.el = a.plan.el || game.P.restEl(); setKindUI(); flow.hud();
    return;
  }
  const t = a.t - a.t0, e = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
  st.aim = a.from + a.delta * e(t / 0.75);
  st.power = a.pw * e((t - 0.85) / 0.45); setPowerUI(st.power);
  if (t > 1.45) { st.aim = a.plan.angle; st.auto = null; shoot(a.plan.V, a.plan.a, a.plan.b, st.el); }
}

/* ================= scoreboard ================= */
function paintPill(i, s) {
  const box = $('#p' + i), tray = box.querySelector('.tray');
  box.classList.toggle('on', !!s.on);
  box.querySelector('.nm').textContent = s.name;
  box.querySelector('.sub').textContent = s.think ? '생각 중' : s.sub; box.classList.toggle('think', !!s.think);
  box.querySelector('.pts').textContent = s.pts == null ? '' : s.pts;
  tray.textContent = '';
  for (const t of s.tray || []) { const c = tray.appendChild(t === 'slot' ? el('i', { class: 'mb slot' }) : t === 'eight' ? el('i', { class: 'mb e8' }) : ballChip(t)); if (s.pop && s.pop.includes(t)) c.classList.add('pop'); }
}
function paintBadge(name, b) {
  const badge = $('#badge'); badge.textContent = '';
  badge.appendChild(el('b', { text: name })); badge.appendChild(document.createTextNode(b.text));
  for (const id of b.balls || []) badge.appendChild(ballChip(id, b.plain ? '' : id === b.mark ? 'box-shadow:0 0 0 2px #ffd21f' : 'opacity:.55'));
}
const setBusy = () => app.classList.toggle('busy', !(st.screen === 'play' && st.phase === 'aim'));

// A small top view of one shot: the table, where the balls stood, and the lines the cue ball and the ball that mattered drew.
function drawShot(cv, shot) {
  const dpr = Math.min(3, window.devicePixelRatio || 1), cw = cv.clientWidth, ch = cv.clientHeight; if (!cw || !ch) return;
  cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
  const g = cv.getContext('2d'), P = game.P, pad = 5 * dpr, k = Math.min((cv.width - 2 * pad) / (2 * P.HL), (cv.height - 2 * pad) / (2 * P.HW));
  const X = x => cv.width / 2 + x * k, Y = y => cv.height / 2 - y * k, carom = game.mode.table === 'carom';
  const colOf = i => carom ? ['#ffffff', '#ffd23c', '#ff4d43', '#ff4d43'][i] : i === shot.snap.cue ? '#ffffff' : ballCss(i);
  g.fillStyle = hex(CLOTHS[prefs.cloth].felt); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2 * dpr;
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
