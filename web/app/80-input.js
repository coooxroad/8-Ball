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
    box.style.backgroundPosition = scene.portrait ? `${off}px 0` : `0 ${off}px`; dialPh += d; drawDial(); scene.invalidate();
    // a click for every ridge that rolls past the pointer, softer and quicker the faster it turns (at most one a frame)
    const step = (box.querySelector('canvas.dial') || box).clientHeight * Math.PI / 56 || 8, n = Math.floor(dialPh / step);
    if (n !== dialN) { dialN = n; SND.dial(Math.abs(d) / 20); }
  });
  const up = e => { if (id === e.pointerId) { id = null; ctlUp(); } };
  box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
})();
/* The fine-aim dial (on the desk): a knurled rubber drum turning in its walnut slot, drawn as a real cylinder - its ridges
   crowd together towards its edges and it darkens away from the light (upper right), with brass flanges at both ends.
   dialPh is how far it has been rolled, in pixels at its face. */
let dialPh = 0, dialN = 0;
function drawDial() {
  const box = $('#fine');
  let cv = box.querySelector('canvas.dial'); if (!cv) { cv = el('canvas', { class: 'dial' }); box.appendChild(cv); }
  const w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) return;
  const dpr = Math.min(3, window.devicePixelRatio || 1); if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const along = !scene.portrait, L = along ? h : w, T = along ? w : h, R = L / 2, lit = along ? -0.35 : 0.3;   // (the light's side of the drum)
  const shade = (th, base, span) => Math.round(base + span * Math.pow(Math.max(0, Math.cos(th - lit)), 1.6));
  const body = along ? g.createLinearGradient(0, 0, 0, h) : g.createLinearGradient(0, 0, w, 0);
  for (let i = 0; i <= 16; i++) { const th = (i / 16 - 0.5) * Math.PI, v = shade(th, 10, 78); body.addColorStop(i / 16, `rgb(${v},${v},${v + 3})`); }
  g.fillStyle = body; g.fillRect(0, 0, w, h);
  const N = 56, step = 2 * Math.PI / N, ph = (((dialPh / R) % step) + step) % step, fl = Math.max(4, T * 0.12);
  for (let th = -Math.PI / 2 + ph; th < Math.PI / 2; th += step) {
    const c = Math.cos(th); if (c < 0.04) continue;
    const at = R + R * Math.sin(th), t = Math.max(0.5, 2.4 * c), hi = 0.05 + 0.25 * Math.max(0, Math.cos(th - lit));
    g.fillStyle = 'rgba(0,0,0,.6)'; if (along) g.fillRect(fl, at - t / 2, T - 2 * fl, t); else g.fillRect(at - t / 2, fl, t, T - 2 * fl);
    g.fillStyle = `rgba(255,255,255,${hi.toFixed(3)})`; if (along) g.fillRect(fl, at + t / 2, T - 2 * fl, Math.max(0.5, c)); else g.fillRect(at + t / 2, fl, Math.max(0.5, c), T - 2 * fl);
  }
  // the brass flanges at the drum's two ends, shaded round the same way
  const brass = along ? g.createLinearGradient(0, 0, 0, h) : g.createLinearGradient(0, 0, w, 0);
  for (let i = 0; i <= 16; i++) { const th = (i / 16 - 0.5) * Math.PI, k = Math.pow(Math.max(0, Math.cos(th - lit)), 1.3); brass.addColorStop(i / 16, `rgb(${Math.round(70 + 170 * k)},${Math.round(50 + 140 * k)},${Math.round(18 + 70 * k)})`); }
  g.fillStyle = brass; if (along) { g.fillRect(0, 0, fl, h); g.fillRect(w - fl, 0, fl, h); } else { g.fillRect(0, 0, w, fl); g.fillRect(0, h - fl, w, fl); }
}
(function spinCtl() {
  const pop = $('#spinPop'), pad = $('#spinPad');
  $('#spinBtn').addEventListener('click', () => {
    if (!humanAiming()) return; SND.tap(); pop.hidden = !pop.hidden; ctl.t = performance.now(); setSpinUI(); setKindUI();
    $('#spinHint').textContent = '위는 밀어치기, 아래는 끌어치기, 좌우는 쿠션에서 꺾임. ' + (flow.guide() >= 0.63 ? '조준선이 큐볼이 갈 길입니다.' : '조준선을 길게로 하면 회전이 반영된 길이 보입니다.');
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
  $('#spinReset').addEventListener('click', () => { SND.tap(); st.spin = { x: 0, y: 0 }; st.el = st.elWant = 0; syncEl(); setSpinUI(); setKindUI(); scene.invalidate(); });
  // The cue raised: one angle, set on a picture of the shot seen from the side - the ball on the cloth and the cue leaning
  // over it. Dragging anywhere in the picture swings the cue to point at the finger.
  const padEl = $('#elPad'); let eid = null;
  // the cue angle is folded away until asked for: most shots only need the spin
  const setEl = e => {
    const r = padEl.getBoundingClientRect(), bx = r.left + EL_BX, by = r.bottom - EL_BY; let a = Math.atan2(by - e.clientY, e.clientX - bx);
    // from level to straight down, kept to a tenth of a degree; under half a degree counts as level, so that a flat cue is
    // easy to come back to
    a = Math.max(0, Math.min(Math.PI / 2, a)); if (a < 0.0087) a = 0;
    a = Math.round(a * 1800 / Math.PI) * Math.PI / 1800;
    st.elWant = a; syncEl(); setKindUI(); scene.invalidate();
  };
  padEl.addEventListener('pointerdown', e => { if (!humanAiming()) return; eid = e.pointerId; ctlDown(); try { padEl.setPointerCapture(eid); } catch (err) {} setEl(e); e.preventDefault(); });
  padEl.addEventListener('pointermove', e => { if (eid === e.pointerId) setEl(e); });
  const elUp = () => { if (eid != null) { eid = null; ctlUp(); } };
  padEl.addEventListener('pointerup', elUp); padEl.addEventListener('pointercancel', elUp);
})();
const trickOK = () => !!flow && flow !== homeDemo;
/* What the player asked for (st.elWant) is what is played - only, where raising the cue is not allowed, nothing above the
   ordinary level stroke. */
function syncEl() {
  const P = game.P; if (!game.world) return;
  const el = trickOK() ? Math.max(0, st.elWant || 0) : 0;
  if (Math.abs(el - st.el) > 1e-6) { st.el = el; setKindUI(); }
}
// what the raised cue will do at the power now drawn: said in a word next to the angle, and on the spin button
// (a raised cue that will not jump at this power but would at full says so, which is how the jump angles are found)
function elSay() {
  const P = game.P; if (st.el < 0.009) return '';
  const h = P.hop(game.vOf(st.power > 0 ? st.power : 0.45), st.el), side = Math.abs(st.spin.x) > 0.15, steep = st.el > 58 * Math.PI / 180;
  if (h > P.R * 2) return '공을 넘는 점프';
  if (h > 0.012) return P.hop(game.vOf(1), st.el) > P.R * 2 ? '낮게 뜸 · 세게 치면 점프' : '낮게 뜸';
  if (P.hop(game.vOf(1), st.el) > P.R * 2) return side && steep ? '맛세이 · 세게 치면 점프' : '세게 치면 점프';
  return side ? (steep ? '맛세이 · 휘어 감' : '휘어 감') : '안 뜸';
}
function setKindUI() {
  const d10 = Math.round(st.el * 1800 / Math.PI) / 10, deg = d10 < 10 && d10 % 1 ? d10.toFixed(1) : Math.round(d10), ok = trickOK(), say = elSay();
  $('#kindBox').hidden = !ok; $('#elVal').textContent = deg + '°'; $('#elSay').textContent = say;
  // the ordinary stroke says nothing; a cue set any other way is shown on the spin button
  const plain = st.el < 0.009;
  const tag = $('#spinTag'); tag.hidden = plain; tag.textContent = '큐 ' + deg + '°' + (say ? ' · ' + say : '');
  // The side view: the cloth, the cue ball at the pivot of a brass protractor, and the player's own cue leaning at its angle
  // with its tip on the ball (on the desk the made pictures, elsewhere drawn).
  const cv = $('#elPad'), cw = cv.clientWidth, ch = cv.clientHeight; if (!cw || !ch || $('#spinPop').hidden) return;
  const dpr = Math.min(3, window.devicePixelRatio || 1); cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const bx = EL_BX, by = ch - EL_BY, R = 15, a = st.el, c = CUES[cueNow] || CUES[0];
  const arc = elImg('angle-arc'); if (arc.naturalWidth) { const sc = Math.min(cw - bx - 4, by - 4) / 480; g.drawImage(arc, bx - 16 * sc, by - 496 * sc, 512 * sc, 512 * sc); }
  g.fillStyle = hex(CLOTHS[iceOn() && flow === match ? ICE : iceOn() ? 0 : prefs.cloth].felt); g.fillRect(0, by + R, cw, ch - by - R);
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, by + R, cw, 2);
  const ball = elImg('spin-ball'); if (ball.naturalWidth) g.drawImage(ball, bx - R * 1.07, by - R * 1.07, R * 2.14, R * 2.14); else { g.fillStyle = '#f4efe2'; g.beginPath(); g.arc(bx, by, R, 0, 6.3); g.fill(); }
  const tx = bx + Math.cos(a) * (R + 1.5), ty = by - Math.sin(a) * (R + 1.5), cue = elImg('cue-' + c.id), Lc = Math.max(cw, ch) * 1.25, hc = Math.max(7, Lc * 110 / 2400 * 1.3);
  g.save(); g.translate(tx, ty); g.rotate(Math.PI - a);
  if (cue.naturalWidth) { g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 6; g.shadowOffsetX = -3; g.shadowOffsetY = 4; g.drawImage(cue, -Lc, -hc / 2, Lc, hc); }
  else { g.fillStyle = hex(c.shaft); g.fillRect(-Lc, -2.5, Lc, 5); }
  g.restore();
  if (!a) { g.fillStyle = '#f1e4c4'; g.font = '700 12px Gothic A1, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('위로 끌어 큐를 세웁니다', bx + 40, by - 46); }
}
const EL_BX = 26, EL_BY = 24, elImgs = {};
const elImg = n => elImgs[n] || (elImgs[n] = Object.assign(new Image(), { onload: () => setKindUI(), src: `ui/${n}.webp` }));

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
