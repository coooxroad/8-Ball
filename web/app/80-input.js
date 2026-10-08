/* ================= input ================= */
let drag = null;
/* Touches meant for a control and landing on the table beside it used to swing the cue off a line already set. So the
   table does not listen: while a finger is on the power bar, the fine-aim strip, the spin ball or the cue-angle picture,
   and for a moment after it lifts; within a finger's width of any of those; and the first touch while the spin window is
   open only closes the window. A tap on the table (aim straight at this point) also has to be a deliberate one. */
const ctl = { n: 0, t: 0 }, GUARD = 22, SETTLE = 280;
const ctlDown = () => { ctl.n++; }, ctlUp = () => { ctl.n = Math.max(0, ctl.n - 1); ctl.t = performance.now(); };
function guarded(e) {
  if (ctl.n > 0 || performance.now() - ctl.t < SETTLE) return true;
  for (const id of ['#power', '#fine', '#spinBtn']) { const r = $(id).getBoundingClientRect(); if (r.width && e.clientX > r.left - GUARD && e.clientX < r.right + GUARD && e.clientY > r.top - GUARD && e.clientY < r.bottom + GUARD) return true; }
  if (!$('#spinPop').hidden) { $('#spinPop').hidden = true; ctl.t = performance.now(); return true; }
  return false;
}
const humanAiming = () => st.screen === 'play' && st.phase === 'aim' && $('#sheet').hidden;
// move a ball to where the finger is, sliding it round anything in the way
function tryPlace(p, ball) {
  const P = game.P, { R, HL, HW } = P, w = game.world, c = ball || game.cueBall(), kitchen = !ball && game.placing === 'kitchen';
  let x = Math.max(-HL + R, Math.min(HL - R, p.x)), y = Math.max(-HW + R, Math.min(HW - R, p.y));
  if (kitchen) x = Math.min(x, -HL / 2);
  if (P.isFree(w, x, y, c.id)) { c.x = c.px = x; c.y = c.py = y; return; }
  for (const b of w.balls) {
    if (!b.on || b.id === c.id) continue;
    const d = Math.hypot(x - b.x, y - b.y);
    if (d < 2 * R + 0.001 && d > 1e-6) { const k = (2 * R + 0.0012) / d, nx = b.x + (x - b.x) * k, ny = b.y + (y - b.y) * k; if (P.isFree(w, nx, ny, c.id) && (!kitchen || nx <= -HL / 2)) { c.x = c.px = nx; c.y = c.py = ny; } return; }
  }
}
// is this table position on the cue (or the cue ball it points at)?
function onCue(p) {
  const c = game.cueBall(), dx = p.x - c.x, dy = p.y - c.y, ca = Math.cos(st.aim), sa = Math.sin(st.aim);
  const back = -(dx * ca + dy * sa), side = Math.abs(dy * ca - dx * sa);
  return back > -0.05 && back < 1.6 && side < Math.max(0.07, 34 / scene.ppm);
}
const orbitPts = new Map();                                // fingers currently turning or zooming the 3D view
function ballUnder(p, reach) { let best = null, bd = reach; for (const b of game.world.balls) if (b.on) { const d = Math.hypot(p.x - b.x, p.y - b.y); if (d < bd) { bd = d; best = b; } } return best; }
canvas.addEventListener('pointerdown', e => {
  SND.init();
  if (scene.orbiting && st.screen === 'play') {
    // in the 3D view: taking hold of the cue aims, one finger anywhere else turns the view, two fingers zoom
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {} e.preventDefault();
    if (!orbitPts.size && humanAiming()) {
      const p = scene.toTable(e, game.P.R), c = game.cueBall();
      if (onCue(p)) { drag = { kind: 'aim', id: e.pointerId, last: Math.atan2(p.y - c.y, p.x - c.x), sx: e.clientX, sy: e.clientY, moved: 99, noTap: true }; return; }
    }
    orbitPts.set(e.pointerId, { x: e.clientX, y: e.clientY }); return;
  }
  if (!humanAiming() || guarded(e)) return;
  const R = game.P.R, p = scene.toTable(e, R), c = game.cueBall(), d = Math.hypot(p.x - c.x, p.y - c.y), reach = Math.max(0.075, 26 / scene.ppm);
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  const moving = flow === practice && practice.edit ? ballUnder(p, reach) : null;
  if (moving) drag = { kind: 'ball', id: e.pointerId, ball: moving };
  else if (game.placing && d < reach) drag = { kind: 'cue', id: e.pointerId };
  else drag = { kind: 'aim', id: e.pointerId, last: Math.atan2(p.y - c.y, p.x - c.x), sx: e.clientX, sy: e.clientY, moved: 0, t0: performance.now() };
  e.preventDefault();
});
canvas.addEventListener('pointermove', e => {
  const op = orbitPts.get(e.pointerId);
  if (op) {
    if (orbitPts.size === 1) scene.orbitBy(e.clientX - op.x, e.clientY - op.y);
    else if (orbitPts.size === 2) {
      let other = null; for (const [id, q] of orbitPts) if (id !== e.pointerId) other = q;
      const before = Math.hypot(op.x - other.x, op.y - other.y), after = Math.hypot(e.clientX - other.x, e.clientY - other.y);
      if (before > 10 && after > 10) scene.zoomBy(Math.pow(before / after, 0.6));        // gentler than the fingers
    }
    op.x = e.clientX; op.y = e.clientY; return;
  }
  if (!drag || drag.id !== e.pointerId || !humanAiming()) return;
  const P = game.P, p = scene.toTable(e, P.R), c = game.cueBall();
  if (drag.kind === 'cue') tryPlace(p);
  else if (drag.kind === 'ball') {
    const b = drag.ball, out = Math.abs(p.x) > P.HL + 4 * P.R || Math.abs(p.y) > P.HW + 4 * P.R;
    if (out && b.id !== 0) { b.on = false; b.x = b.px = 9 + b.id; drag = null; } else tryPlace(p, b);
    st.rev++; flow.hud();
  } else {
    drag.moved = Math.max(drag.moved, Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy));
    const a = Math.atan2(p.y - c.y, p.x - c.x);
    if (Math.hypot(p.x - c.x, p.y - c.y) > 0.07 && drag.moved > 9) {
      let da = a - drag.last; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      st.aim += da;
    }
    drag.last = a;
  }
  scene.invalidate();
});
const endDrag = e => {
  if (orbitPts.delete(e.pointerId)) return;
  if (!drag || drag.id !== e.pointerId) return;
  if (drag.kind === 'aim' && drag.moved <= 9 && !drag.noTap && performance.now() - (drag.t0 || 0) > 45 && performance.now() - drag.t0 < 600 && humanAiming()) { const R = game.P.R, p = scene.toTable(e, R), c = game.cueBall(); if (Math.hypot(p.x - c.x, p.y - c.y) > R) st.aim = Math.atan2(p.y - c.y, p.x - c.x); }
  drag = null; scene.invalidate(); snapshot();
};
canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);

(function powerCtl() {
  const box = $('#power'); let id = null;
  // The first little stretch of the track is for changing your mind: let go there and nothing is played. Power starts from
  // nothing just past it, so the gentlest touch is as easy to find as any other (it used to start at a fair tap).
  const CANCEL = 0.04;
  const read = e => { const r = box.getBoundingClientRect(), q = Math.max(0, Math.min(1, scene.portrait ? (e.clientX - r.left - 30) / (r.width - 60) : (e.clientY - r.top - 26) / (r.height - 52))); return q < CANCEL ? 0 : Math.max(0.002, (q - CANCEL) / (1 - CANCEL)); };
  box.addEventListener('pointerdown', e => { SND.init(); if (!humanAiming()) return; id = e.pointerId; ctlDown(); try { box.setPointerCapture(id); } catch (err) {} st.power = read(e); setPowerUI(st.power); scene.invalidate(); e.preventDefault(); });
  box.addEventListener('pointermove', e => { if (id !== e.pointerId) return; st.power = read(e); setPowerUI(st.power); if (st.el) setKindUI(); scene.invalidate(); });
  const up = (e, cancel) => {
    if (id !== e.pointerId) return; id = null; ctlUp();
    const p = st.power;
    if (!cancel && p > 0 && humanAiming()) shoot(game.vOf(p), st.spin.x * 0.5, st.spin.y * 0.5, st.el); else { st.power = 0; setPowerUI(0); }
    scene.invalidate();
  };
  box.addEventListener('pointerup', e => up(e, false)); box.addEventListener('pointercancel', e => up(e, true));
})();
(function fineCtl() {
  const box = $('#fine'); let id = null, last = 0, off = 0;
  const pos = e => scene.portrait ? e.clientX : e.clientY;
  box.addEventListener('pointerdown', e => { SND.init(); if (!humanAiming()) return; id = e.pointerId; ctlDown(); last = pos(e); try { box.setPointerCapture(id); } catch (err) {} e.preventDefault(); });
  box.addEventListener('pointermove', e => {
    if (id !== e.pointerId) return; const d = pos(e) - last; last = pos(e);
    st.aim += d * 0.0009 * (scene.portrait ? -1 : 1); off += d;
    box.style.backgroundPosition = scene.portrait ? `${off}px 0` : `0 ${off}px`; scene.invalidate();
  });
  const up = e => { if (id === e.pointerId) { id = null; ctlUp(); } };
  box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
})();
(function spinCtl() {
  const pop = $('#spinPop'), pad = $('#spinPad');
  $('#spinBtn').addEventListener('click', () => {
    if (!humanAiming()) return; SND.tap(); pop.hidden = !pop.hidden; ctl.t = performance.now(); setSpinUI(); setKindUI();
    $('#spinHint').textContent = '위는 밀어치기, 아래는 끌어치기, 좌우는 쿠션에서 꺾임. ' + (flow.guide() >= 0.5 ? '조준선이 큐볼이 갈 길입니다.' : '조준선을 길게로 하면 큐볼이 갈 길이 보입니다.');
  });
  const set = e => {
    const r = pad.getBoundingClientRect(); let x = (e.clientX - r.left) / r.width * 2 - 1, y = -((e.clientY - r.top) / r.height * 2 - 1);
    x /= 0.72; y /= 0.72; const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    st.spin = { x, y }; setSpinUI(); if (st.el) setKindUI(); scene.invalidate();
  };
  let id = null;
  pad.addEventListener('pointerdown', e => { id = e.pointerId; ctlDown(); try { pad.setPointerCapture(id); } catch (err) {} set(e); e.preventDefault(); });
  pad.addEventListener('pointermove', e => { if (id === e.pointerId) set(e); });
  const padUp = () => { if (id != null) { id = null; ctlUp(); } };
  pad.addEventListener('pointerup', padUp); pad.addEventListener('pointercancel', padUp);
  $('#spinReset').addEventListener('click', () => { SND.tap(); st.spin = { x: 0, y: 0 }; st.el = 0; st.elWant = game.P.BASE_EL; syncEl(); setSpinUI(); setKindUI(); scene.invalidate(); });
  // The cue raised: one angle, set on a picture of the shot seen from the side - the ball on the cloth and the cue leaning
  // over it. Dragging anywhere in the picture swings the cue to point at the finger.
  const padEl = $('#elPad'); let eid = null;
  const setEl = e => {
    const r = padEl.getBoundingClientRect(), bx = r.left + 34, by = r.bottom - 26; let a = Math.atan2(by - e.clientY, e.clientX - bx);
    // kept to a tenth of a degree; under one degree counts as level, so that a flat cue is easy to come back to.
    // On the realistic tables this is the cue's real angle, from level to straight down.
    const real = game.P.REAL;
    a = Math.max(0, Math.min((real ? 90 : 85) * Math.PI / 180, a)); if (a < (real ? 0.0087 : 0.0175)) a = 0;
    a = Math.round(a * 1800 / Math.PI) * Math.PI / 1800;
    const was = st.el; if (real) { st.elWant = a; syncEl(); } else st.el = a; setKindUI(); scene.invalidate();
    if (!was && st.el && !game.P.REAL && !prefs.elTip) { prefs.elTip = true; savePrefs(); toast('큐를 세우면: 세게 치면 공이 뜨고, 좌우 회전을 주면 휩니다. 점선이 갈 길, 고리는 떠 있는 구간.', '', 5200); }
  };
  padEl.addEventListener('pointerdown', e => { if (!humanAiming()) return; eid = e.pointerId; ctlDown(); try { padEl.setPointerCapture(eid); } catch (err) {} setEl(e); e.preventDefault(); });
  padEl.addEventListener('pointermove', e => { if (eid === e.pointerId) setEl(e); });
  const elUp = () => { if (eid != null) { eid = null; ctlUp(); } };
  padEl.addEventListener('pointerup', elUp); padEl.addEventListener('pointercancel', elUp);
})();
const trickOK = () => !!flow && flow !== homeDemo;
/* Realistic tables: the cue angle is the real one. What the player asked for (st.elWant: 5 degrees to begin with) is what
   is played - only, where raising the cue is not allowed, nothing above the ordinary 5. */
function syncEl() {
  const P = game.P; if (!P.REAL || !game.world) return;
  const el = Math.max(0, (trickOK() ? st.elWant : Math.min(st.elWant, P.BASE_EL)) || 0);
  if (Math.abs(el - st.el) > 1e-6) { st.el = el; setKindUI(); }
}
// what the raised cue will do at the power now drawn: said in a word next to the angle, and on the spin button
function elSay() { if (!st.el) return ''; const h = game.P.hop(game.vOf(st.power > 0 ? st.power : 0.45), st.el); return h > game.P.R * 2 ? '공을 넘는 점프' : h > 0.012 ? '낮게 뜸' : Math.abs(st.spin.x) > 0.15 ? '휘어 감' : '안 뜸'; }
function setKindUI() {
  const d10 = Math.round(st.el * 1800 / Math.PI) / 10, deg = d10 < 10 && d10 % 1 ? d10.toFixed(1) : Math.round(d10), ok = trickOK() || (game.P.REAL && !!flow && flow !== homeDemo), say = elSay();
  $('#kindBox').hidden = !ok; $('#elVal').textContent = deg + '°'; $('#elSay').textContent = say;
  const tag = $('#spinTag'); tag.hidden = !deg; tag.textContent = '큐 ' + deg + '°' + (say ? ' · ' + say : '');
  // the side view: cloth, ball, a quarter circle marked every 30 degrees, and the cue at its angle with the tip on the ball
  const cv = $('#elPad'), cw = cv.clientWidth, ch = cv.clientHeight; if (!cw || !ch || $('#spinPop').hidden) return;
  const dpr = Math.min(3, window.devicePixelRatio || 1); cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
  const g = cv.getContext('2d'), dark = prefs.theme !== 'light', ink = dark ? '#e8ebf0' : '#1f2630', dim = dark ? 'rgba(255,255,255,.28)' : 'rgba(25,31,40,.25)';
  g.setTransform(dpr, 0, 0, dpr, 0, 0); const bx = 34, by = ch - 26, R = 15, a = st.el;
  g.fillStyle = hex(CLOTHS[iceOn() && flow === match ? ICE : iceOn() ? 0 : prefs.cloth].felt); g.fillRect(0, by + R, cw, ch - by - R);
  g.strokeStyle = dim; g.lineWidth = 1.5; g.setLineDash([3, 4]); g.beginPath(); g.arc(bx, by, 96, -Math.PI / 2, 0); g.stroke(); g.setLineDash([]);
  g.fillStyle = dim; g.font = '600 10px Outfit, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const d of [0, 30, 60, 90]) { const t = d * Math.PI / 180; g.beginPath(); g.moveTo(bx + Math.cos(t) * 90, by - Math.sin(t) * 90); g.lineTo(bx + Math.cos(t) * 102, by - Math.sin(t) * 102); g.stroke(); g.fillText(d + '°', bx + Math.cos(t) * 116 - (d === 0 ? 6 : 0), by - Math.sin(t) * 112 + (d === 90 ? 4 : 0)); }
  const ball = g.createRadialGradient(bx - 5, by - 6, 2, bx, by, R); ball.addColorStop(0, '#ffffff'); ball.addColorStop(1, '#cfc8b6'); g.fillStyle = ball; g.beginPath(); g.arc(bx, by, R, 0, 6.3); g.fill();
  const ca = Math.cos(a), sa = Math.sin(a), tx = bx + ca * (R + 2), ty = by - sa * (R + 2), ex = bx + ca * 150, ey = by - sa * 150, nx = sa, ny = ca, c = CUES[cueNow] || CUES[0];
  const seg = (f0, f1, w0, w1, col) => { const x0 = tx + (ex - tx) * f0, y0 = ty + (ey - ty) * f0, x1 = tx + (ex - tx) * f1, y1 = ty + (ey - ty) * f1; g.fillStyle = col; g.beginPath(); g.moveTo(x0 + nx * w0, y0 + ny * w0); g.lineTo(x1 + nx * w1, y1 + ny * w1); g.lineTo(x1 - nx * w1, y1 - ny * w1); g.lineTo(x0 - nx * w0, y0 - ny * w0); g.fill(); };
  seg(0, 0.03, 2, 2, hex(c.tip)); seg(0.03, 0.08, 2, 2.2, hex(c.ferrule)); seg(0.08, 0.6, 2.2, 3.4, hex(c.shaft)); seg(0.6, 1, 3.4, 4.6, hex(c.fore));
  g.strokeStyle = '#8a4dff'; g.lineWidth = 2.5; g.beginPath(); g.arc(bx, by, 44, -a, 0); if (a) g.stroke();
  g.fillStyle = ink; g.font = '700 11px Outfit, sans-serif'; g.textAlign = 'left'; if (!a) g.fillText('끌어서 큐를 세웁니다', bx + 30, by - 34);
}

document.addEventListener('contextmenu', e => e.preventDefault());

// Android back button: close whatever is on top; false means "nothing left, leave the app".
window.__back = function () {
  if (!$('#sheet').hidden) { closeSheet(); return true; }
  if (!$('#spinPop').hidden) { $('#spinPop').hidden = true; return true; }
  if (st.screen === 'reel') { reel.skip(); return true; }
  if (st.screen === 'result' || st.screen === 'records') { goHome(st.screen === 'records'); return true; }
  if (st.screen === 'play') { sheetPause(); return true; }
  return false;
};
