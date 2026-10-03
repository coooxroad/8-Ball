/* 8-ball physics: 2D table plane, full 3D spin. Units are metres and seconds. */
const PHYS = (() => {
  const R = 0.028575, HL = 1.27, HW = 0.635, G = 9.8;
  const MU_S = 0.2, MU_R = 0.016, MU_SP = 0.04, E_BALL = 0.95, MU_CUSH = 0.16;
  const GC = 0.088, GS = 0.07, CW = 0.05, PO = 0.03, SO = 0.05;
  const D = Math.SQRT1_2;

  const POCKETS = [
    { x: -HL - PO, y: HW + PO, r: 0.068, sink: 0.062, ax: -HL + 0.03, ay: HW - 0.03, nx: -D, ny: D, corner: true },
    { x: 0, y: HW + SO, r: 0.062, sink: 0.05, ax: 0, ay: HW, nx: 0, ny: 1, corner: false },
    { x: HL + PO, y: HW + PO, r: 0.068, sink: 0.062, ax: HL - 0.03, ay: HW - 0.03, nx: D, ny: D, corner: true },
    { x: HL + PO, y: -HW - PO, r: 0.068, sink: 0.062, ax: HL - 0.03, ay: -HW + 0.03, nx: D, ny: -D, corner: true },
    { x: 0, y: -HW - SO, r: 0.062, sink: 0.05, ax: 0, ay: -HW, nx: 0, ny: -1, corner: false },
    { x: -HL - PO, y: -HW - PO, r: 0.068, sink: 0.062, ax: -HL + 0.03, ay: -HW + 0.03, nx: -D, ny: -D, corner: true },
  ];

  // Cushions: a nose line plus an angled jaw facing at each end.
  const CUSHIONS = [], SEGS = [];
  (function build() {
    const C38 = Math.cos(38 * Math.PI / 180), S38 = Math.sin(38 * Math.PI / 180);
    const C75 = Math.cos(75 * Math.PI / 180), S75 = Math.sin(75 * Math.PI / 180);
    function add(ax, ay, bx, by, ox, oy, aCorner, bCorner) {
      const len = Math.hypot(bx - ax, by - ay), tx = (bx - ax) / len, ty = (by - ay) / len;
      const ja = aCorner ? [C38, S38, 0.065] : [C75, S75, 0.05];
      const jb = bCorner ? [C38, S38, 0.065] : [C75, S75, 0.05];
      const c = {
        a: [ax, ay], b: [bx, by], o: [ox, oy],
        ja: [ax + (-tx * ja[0] + ox * ja[1]) * ja[2], ay + (-ty * ja[0] + oy * ja[1]) * ja[2]],
        jb: [bx + (tx * jb[0] + ox * jb[1]) * jb[2], by + (ty * jb[0] + oy * jb[1]) * jb[2]],
      };
      CUSHIONS.push(c);
      for (const [p, q] of [[c.ja, c.a], [c.a, c.b], [c.b, c.jb]]) {
        const l = Math.hypot(q[0] - p[0], q[1] - p[1]);
        SEGS.push({ ax: p[0], ay: p[1], bx: q[0], by: q[1], len: l, tx: (q[0] - p[0]) / l, ty: (q[1] - p[1]) / l });
      }
    }
    add(-HL + GC, HW, -GS, HW, 0, 1, true, false);
    add(GS, HW, HL - GC, HW, 0, 1, false, true);
    add(-HL + GC, -HW, -GS, -HW, 0, -1, true, false);
    add(GS, -HW, HL - GC, -HW, 0, -1, false, true);
    add(-HL, -HW + GC, -HL, HW - GC, -1, 0, true, true);
    add(HL, -HW + GC, HL, HW - GC, 1, 0, true, true);
  })();

  function newEv() { return { firstHit: null, rail: false, pocketed: [] }; }

  function makeWorld() {
    const balls = [];
    for (let i = 0; i < 16; i++) balls.push({ id: i, x: 0, y: 0, vx: 0, vy: 0, wx: 0, wy: 0, wz: 0, on: true, q: [0, 0, 0, 1] });
    return { balls, ev: newEv(), snd: null, track: false };
  }

  function clone(w) {
    return { balls: w.balls.map(b => ({ id: b.id, x: b.x, y: b.y, vx: b.vx, vy: b.vy, wx: b.wx, wy: b.wy, wz: b.wz, on: b.on, q: b.q })), ev: newEv(), snd: null, track: false };
  }

  function rack(w, rnd) {
    rnd = rnd || Math.random;
    const order = [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15];
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    // back corners: one solid, one stripe
    const si = order.findIndex(n => n < 8), ti = order.findIndex(n => n > 8);
    const solid = order[si], stripe = order[ti];
    const rest = order.filter(n => n !== solid && n !== stripe);
    const slots = [];
    for (let r = 0; r < 5; r++) for (let k = 0; k <= r; k++) slots.push([r, k]);
    let ri = 0;
    for (const [r, k] of slots) {
      let id;
      if (r === 2 && k === 1) id = 8;
      else if (r === 4 && k === 0) id = solid;
      else if (r === 4 && k === 4) id = stripe;
      else id = rest[ri++];
      const b = w.balls[id];
      b.x = HL / 2 + r * Math.sqrt(3) * R * 1.003 + (rnd() - 0.5) * 1e-4;
      b.y = (k - r / 2) * 2 * R * 1.003 + (rnd() - 0.5) * 1e-4;
    }
    for (const b of w.balls) {
      b.vx = b.vy = b.wx = b.wy = b.wz = 0; b.on = true;
      const a = rnd() * Math.PI * 2, tl = (rnd() - 0.5) * 0.9;
      // number faces up, turned at random and tipped a little
      const cz = Math.cos(a / 2), sz = Math.sin(a / 2), cx = Math.cos(tl / 2), sx = Math.sin(tl / 2);
      b.q = [cz * sx, sz * sx, sz * cx, cz * cx];
    }
    w.balls[0].x = -HL / 2; w.balls[0].y = 0;
    w.ev = newEv();
  }

  function strike(w, ang, V, a, bb) {
    const c = w.balls[0], dx = Math.cos(ang), dy = Math.sin(ang);
    c.vx = V * dx; c.vy = V * dy;
    const k = 2.5 * V * bb / R;
    c.wx = -dy * k; c.wy = dx * k; c.wz = 2.5 * V * a / R;
    w.ev = newEv();
  }

  function motion(w, b, h) {
    const ux = b.vx - R * b.wy, uy = b.vy + R * b.wx, us = Math.hypot(ux, uy);
    if (us > 1e-4) {
      const dec = MU_S * G * h;
      if (us <= 3.5 * dec) {
        b.vx -= (2 / 7) * ux; b.vy -= (2 / 7) * uy;
        b.wy = b.vx / R; b.wx = -b.vy / R;
      } else {
        const nx = ux / us, ny = uy / us;
        b.vx -= dec * nx; b.vy -= dec * ny;
        b.wx -= (2.5 / R) * dec * ny; b.wy += (2.5 / R) * dec * nx;
      }
    } else {
      const sp = Math.hypot(b.vx, b.vy), dec = MU_R * G * h;
      if (sp <= dec || sp < 0.004) { b.vx = b.vy = 0; b.wx = b.wy = 0; }
      else { const s = (sp - dec) / sp; b.vx *= s; b.vy *= s; b.wy = b.vx / R; b.wx = -b.vy / R; }
    }
    const dz = (2.5 * MU_SP * G / R) * h;
    if (Math.abs(b.wz) <= dz) b.wz = 0; else b.wz -= Math.sign(b.wz) * dz;
    b.x += b.vx * h; b.y += b.vy * h;
    if (w.track) {
      const wm = Math.hypot(b.wx, b.wy, b.wz);
      if (wm > 1e-6) {
        const ang = wm * h, s = Math.sin(ang / 2) / wm, c = Math.cos(ang / 2);
        const dx = b.wx * s, dy = b.wy * s, dzq = b.wz * s, q = b.q, qx = q[0], qy = q[1], qz = q[2], qw = q[3];
        q[0] = c * qx + dx * qw + dy * qz - dzq * qy;
        q[1] = c * qy + dy * qw + dzq * qx - dx * qz;
        q[2] = c * qz + dzq * qw + dx * qy - dy * qx;
        q[3] = c * qw - dx * qx - dy * qy - dzq * qz;
      }
    }
  }

  function hitSeg(w, b, s) {
    let u = (b.x - s.ax) * s.tx + (b.y - s.ay) * s.ty;
    u = u < 0 ? 0 : u > s.len ? s.len : u;
    const cx = s.ax + s.tx * u, cy = s.ay + s.ty * u;
    let nx = b.x - cx, ny = b.y - cy;
    const d2 = nx * nx + ny * ny;
    if (d2 >= R * R || d2 < 1e-14) return;
    const d = Math.sqrt(d2); nx /= d; ny /= d;
    b.x = cx + nx * R; b.y = cy + ny * R;
    const vn = b.vx * nx + b.vy * ny;
    if (vn >= 0) return;
    const e = Math.max(0.62, 0.86 - 0.035 * -vn);
    const tx = -ny, ty = nx;
    const slip = b.vx * tx + b.vy * ty - R * b.wz;
    const lim = MU_CUSH * (1 + e) * -vn;
    let dvt = -(2 / 7) * slip;
    if (dvt > lim) dvt = lim; else if (dvt < -lim) dvt = -lim;
    b.vx += -(1 + e) * vn * nx + dvt * tx;
    b.vy += -(1 + e) * vn * ny + dvt * ty;
    b.wz -= (2.5 / R) * dvt;
    b.wx *= 0.7; b.wy *= 0.7;
    if (w.ev.firstHit != null) w.ev.rail = true;
    if (w.snd && -vn > 0.08) w.snd.push({ t: 'rail', v: -vn });
  }

  function sub(w, h) {
    const bs = w.balls, n = bs.length;
    for (let i = 0; i < n; i++) if (bs[i].on) motion(w, bs[i], h);
    for (let i = 0; i < n; i++) {
      const a = bs[i]; if (!a.on) continue;
      for (let j = i + 1; j < n; j++) {
        const b = bs[j]; if (!b.on) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
        if (d2 >= 4 * R * R || d2 < 1e-14) continue;
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, ov = (2 * R - d) / 2;
        a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov;
        const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rel >= 0) continue;
        const jn = -(1 + E_BALL) / 2 * rel;
        a.vx -= jn * nx; a.vy -= jn * ny; b.vx += jn * nx; b.vy += jn * ny;
        if (i === 0 && w.ev.firstHit == null) w.ev.firstHit = j;
        if (w.snd && -rel > 0.03) w.snd.push({ t: 'ball', v: -rel });
      }
    }
    for (let i = 0; i < n; i++) {
      const b = bs[i]; if (!b.on) continue;
      if (Math.abs(b.x) > HL - R - 0.002 || Math.abs(b.y) > HW - R - 0.002) {
        if (b.vx !== 0 || b.vy !== 0) for (let k = 0; k < SEGS.length; k++) hitSeg(w, b, SEGS[k]);
        let pk = -1;
        for (let k = 0; k < 6; k++) {
          const p = POCKETS[k], dx = b.x - p.x, dy = b.y - p.y;
          if (dx * dx + dy * dy < p.sink * p.sink) { pk = k; break; }
        }
        if (pk < 0 && (Math.abs(b.x) > HL + 0.012 || Math.abs(b.y) > HW + 0.012)) {
          let best = 1e9;
          for (let k = 0; k < 6; k++) { const p = POCKETS[k], dd = (b.x - p.x) ** 2 + (b.y - p.y) ** 2; if (dd < best) { best = dd; pk = k; } }
        }
        if (pk >= 0) {
          b.on = false;
          w.ev.pocketed.push({ id: b.id, pocket: pk });
          if (w.snd) w.snd.push({ t: 'pocket', id: b.id, pocket: pk, v: Math.hypot(b.vx, b.vy) });
          b.vx = b.vy = b.wx = b.wy = b.wz = 0;
        }
      }
    }
  }

  function step(w, dt) {
    let vmax = 0;
    for (const b of w.balls) if (b.on) { const s = Math.hypot(b.vx, b.vy); if (s > vmax) vmax = s; }
    const n = Math.max(1, Math.ceil(vmax * dt / (R * 0.3)));
    const h = dt / n;
    for (let i = 0; i < n; i++) sub(w, h);
  }

  function rest(w) {
    for (const b of w.balls) if (b.on && (b.vx !== 0 || b.vy !== 0 || b.wx !== 0 || b.wy !== 0)) return false;
    return true;
  }

  function run(w, maxT) {
    let t = 0;
    while (!rest(w) && t < (maxT || 25)) { step(w, 1 / 120); t += 1 / 120; }
    for (const b of w.balls) b.wz = 0;
    return w.ev;
  }

  function rayCircle(ox, oy, dx, dy, cx, cy, rad) {
    const fx = cx - ox, fy = cy - oy, proj = fx * dx + fy * dy;
    const perp2 = fx * fx + fy * fy - proj * proj;
    if (perp2 >= rad * rad) return Infinity;
    const t = proj - Math.sqrt(rad * rad - perp2);
    return t > 1e-6 ? t : Infinity;
  }

  // First thing the cue ball meets along a direction: a ball, a cushion or a pocket.
  function predict(w, ang) {
    const c = w.balls[0], dx = Math.cos(ang), dy = Math.sin(ang);
    let best = { t: 6, type: 'none' };
    for (const b of w.balls) {
      if (!b.on || b.id === 0) continue;
      const t = rayCircle(c.x, c.y, dx, dy, b.x, b.y, 2 * R);
      if (t < best.t) best = { t, type: 'ball', ball: b.id };
    }
    for (const s of SEGS) {
      for (const sg of [1, -1]) {
        const px = s.ax - s.ty * R * sg, py = s.ay + s.tx * R * sg;
        const den = dx * s.ty - dy * s.tx;
        if (Math.abs(den) < 1e-9) continue;
        const t = ((px - c.x) * s.ty - (py - c.y) * s.tx) / den;
        if (t <= 1e-6 || t >= best.t) continue;
        const u = (c.x + dx * t - px) * s.tx + (c.y + dy * t - py) * s.ty;
        if (u < 0 || u > s.len) continue;
        best = { t, type: 'rail', nx: -s.ty * sg, ny: s.tx * sg };
      }
      for (const [ex, ey] of [[s.ax, s.ay], [s.bx, s.by]]) {
        const t = rayCircle(c.x, c.y, dx, dy, ex, ey, R);
        if (t < best.t) { const gx = c.x + dx * t, gy = c.y + dy * t; best = { t, type: 'rail', nx: (gx - ex) / R, ny: (gy - ey) / R }; }
      }
    }
    for (const p of POCKETS) {
      const t = rayCircle(c.x, c.y, dx, dy, p.x, p.y, p.sink);
      if (t < best.t) best = { t, type: 'pocket' };
    }
    best.gx = c.x + dx * best.t; best.gy = c.y + dy * best.t;
    if (best.type === 'ball') {
      const b = w.balls[best.ball];
      best.nx = (b.x - best.gx) / (2 * R); best.ny = (b.y - best.gy) / (2 * R);
      best.cut = Math.acos(Math.max(-1, Math.min(1, dx * best.nx + dy * best.ny)));
    }
    return best;
  }

  function pathClear(w, x0, y0, x1, y1, skip, rad) {
    const len = Math.hypot(x1 - x0, y1 - y0); if (len < 1e-9) return true;
    const tx = (x1 - x0) / len, ty = (y1 - y0) / len, lim = (rad || 2 * R) - 0.0015;
    for (const b of w.balls) {
      if (!b.on || skip.indexOf(b.id) >= 0) continue;
      let u = (b.x - x0) * tx + (b.y - y0) * ty; u = u < 0 ? 0 : u > len ? len : u;
      const ex = b.x - (x0 + tx * u), ey = b.y - (y0 + ty * u);
      if (ex * ex + ey * ey < lim * lim) return false;
    }
    return true;
  }

  function isFree(w, x, y, skipId) {
    if (Math.abs(x) > HL - R || Math.abs(y) > HW - R) return false;
    for (const b of w.balls) {
      if (!b.on || b.id === skipId) continue;
      if ((b.x - x) ** 2 + (b.y - y) ** 2 < (2 * R + 0.0008) ** 2) return false;
    }
    return true;
  }

  function findFree(w, x, y, skipId) {
    if (isFree(w, x, y, skipId)) return [x, y];
    for (let r = 0.01; r < 1.5; r += 0.01) for (let k = 0; k < 24; k++) {
      const a = k * Math.PI / 12, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (isFree(w, px, py, skipId)) return [px, py];
    }
    return [x, y];
  }

  return { R, HL, HW, CW, PO, SO, POCKETS, CUSHIONS, SEGS, makeWorld, clone, rack, strike, step, rest, run, predict, pathClear, isFree, findFree, newEv };
})();
if (typeof module !== 'undefined') module.exports = PHYS;
