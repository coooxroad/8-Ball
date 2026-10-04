/* Cue-sports physics: 2D table plane, full 3D spin. Units are metres and seconds.
   createPhysics({ R, pockets, HL, HW, cornerMouth, sideMouth }) builds one table: a pool table with six pockets
   in any regulation size, or a carom table with none. */
function createPhysics(cfg) {
  const R = cfg.R, POCKETED = !!cfg.pockets;
  const HL = cfg.HL || 1.27, HW = cfg.HW || 0.635, G = 9.8;
  const MU_S = 0.2, MU_R = 0.016, MU_SP = 0.04, E_BALL = 0.96, MU_CUSH = 0.16;
  const CM = cfg.cornerMouth || 0.125, SM = cfg.sideMouth || 0.14, kc = CM / 0.125, ks = SM / 0.14;
  const GC = CM * Math.SQRT1_2, GS = SM / 2, CW = 0.05, PO = 0.03 * kc, SO = 0.05 * ks;
  const RC = 0.068 * kc, RS = 0.062 * ks, SC = RC * 0.91, SS = RS * 0.87, AI = 0.03 * kc;
  const D = Math.SQRT1_2;

  const POCKETS = !POCKETED ? [] : [
    { x: -HL - PO, y: HW + PO, r: RC, sink: SC, ax: -HL + AI, ay: HW - AI, nx: -D, ny: D, corner: true },
    { x: 0, y: HW + SO, r: RS, sink: SS, ax: 0, ay: HW, nx: 0, ny: 1, corner: false },
    { x: HL + PO, y: HW + PO, r: RC, sink: SC, ax: HL - AI, ay: HW - AI, nx: D, ny: D, corner: true },
    { x: HL + PO, y: -HW - PO, r: RC, sink: SC, ax: HL - AI, ay: -HW + AI, nx: D, ny: -D, corner: true },
    { x: 0, y: -HW - SO, r: RS, sink: SS, ax: 0, ay: -HW, nx: 0, ny: -1, corner: false },
    { x: -HL - PO, y: -HW - PO, r: RC, sink: SC, ax: -HL + AI, ay: -HW + AI, nx: -D, ny: -D, corner: true },
  ];

  // Cushions: a nose line plus (on a pool table) an angled jaw facing at each end.
  const CUSHIONS = [], SEGS = [];
  (function build() {
    const C38 = Math.cos(38 * Math.PI / 180), S38 = Math.sin(38 * Math.PI / 180);
    const C75 = Math.cos(75 * Math.PI / 180), S75 = Math.sin(75 * Math.PI / 180);
    const seg = (p, q) => { const l = Math.hypot(q[0] - p[0], q[1] - p[1]); SEGS.push({ ax: p[0], ay: p[1], bx: q[0], by: q[1], len: l, tx: (q[0] - p[0]) / l, ty: (q[1] - p[1]) / l }); };
    function add(ax, ay, bx, by, ox, oy, aCorner, bCorner) {
      const len = Math.hypot(bx - ax, by - ay), tx = (bx - ax) / len, ty = (by - ay) / len;
      const ja = aCorner ? [C38, S38, 0.065 * kc] : [C75, S75, 0.05 * ks];
      const jb = bCorner ? [C38, S38, 0.065 * kc] : [C75, S75, 0.05 * ks];
      const c = {
        a: [ax, ay], b: [bx, by], o: [ox, oy],
        ja: [ax + (-tx * ja[0] + ox * ja[1]) * ja[2], ay + (-ty * ja[0] + oy * ja[1]) * ja[2]],
        jb: [bx + (tx * jb[0] + ox * jb[1]) * jb[2], by + (ty * jb[0] + oy * jb[1]) * jb[2]],
      };
      CUSHIONS.push(c); seg(c.ja, c.a); seg(c.a, c.b); seg(c.b, c.jb);
    }
    function plain(ax, ay, bx, by, ox, oy) {
      // mitred into the corner: the back edge reaches the corner of the rail
      const c = { a: [ax, ay], b: [bx, by], o: [ox, oy] };
      c.ja = [ax + (ox !== 0 ? ox * CW : -Math.sign(bx - ax) * CW), ay + (oy !== 0 ? oy * CW : -Math.sign(by - ay) * CW)];
      c.jb = [bx + (ox !== 0 ? ox * CW : Math.sign(bx - ax) * CW), by + (oy !== 0 ? oy * CW : Math.sign(by - ay) * CW)];
      CUSHIONS.push(c); seg(c.a, c.b);
    }
    if (POCKETED) {
      add(-HL + GC, HW, -GS, HW, 0, 1, true, false);
      add(GS, HW, HL - GC, HW, 0, 1, false, true);
      add(-HL + GC, -HW, -GS, -HW, 0, -1, true, false);
      add(GS, -HW, HL - GC, -HW, 0, -1, false, true);
      add(-HL, -HW + GC, -HL, HW - GC, -1, 0, true, true);
      add(HL, -HW + GC, HL, HW - GC, 1, 0, true, true);
    } else {
      plain(-HL, HW, HL, HW, 0, 1); plain(-HL, -HW, HL, -HW, 0, -1);
      plain(-HL, -HW, -HL, HW, -1, 0); plain(HL, -HW, HL, HW, 1, 0);
    }
  })();

  function newEv() { return { firstHit: null, hits: [], rail: false, railed: [], pocketed: [] }; }

  function makeWorld(n) {
    const balls = [];
    for (let i = 0; i < n; i++) balls.push({ id: i, x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, wx: 0, wy: 0, wz: 0, hot: 0, spit: 0, on: true, q: [0, 0, 0, 1] });
    return { balls, ev: newEv(), snd: null, track: false, cue: 0 };
  }

  function clone(w) {
    return { balls: w.balls.map(b => ({ id: b.id, x: b.x, y: b.y, px: b.x, py: b.y, vx: 0, vy: 0, wx: 0, wy: 0, wz: 0, hot: 0, spit: 0, on: b.on, q: b.q })), ev: newEv(), snd: null, track: false, cue: w.cue };
  }

  function place(w, id, x, y, rnd) {
    const b = w.balls[id];
    b.x = b.px = x; b.y = b.py = y; b.vx = b.vy = b.wx = b.wy = b.wz = 0; b.hot = 0; b.spit = 0; b.on = true;
    if (rnd) {
      const a = rnd() * Math.PI * 2, tl = (rnd() - 0.5) * 0.9;
      const cz = Math.cos(a / 2), sz = Math.sin(a / 2), cx = Math.cos(tl / 2), sx = Math.sin(tl / 2);
      b.q = [cz * sx, sz * sx, sz * cx, cz * cx];
    }
  }

  function strike(w, ang, V, a, bb) {
    const c = w.balls[w.cue], dx = Math.cos(ang), dy = Math.sin(ang);
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
    const spd = Math.hypot(b.vx, b.vy), cool = b.hot - 7 * h; b.hot = spd > cool ? spd : cool;
    if (b.spit > 0) b.spit -= h;
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
    const e = Math.max(0.62, 0.87 - 0.035 * -vn);
    const tx = -ny, ty = nx;
    // side spin grips the cushion and bends the rebound
    const slip = b.vx * tx + b.vy * ty - R * b.wz;
    const lim = MU_CUSH * (1 + e) * -vn;
    let dvt = -(2 / 7) * slip;
    if (dvt > lim) dvt = lim; else if (dvt < -lim) dvt = -lim;
    b.vx += -(1 + e) * vn * nx + dvt * tx;
    b.vy += -(1 + e) * vn * ny + dvt * ty;
    b.wz -= (2.5 / R) * dvt;
    // the nose sits above centre: roll into the rail is mostly killed and slightly reversed,
    // roll along the rail survives
    const wn = b.wx * nx + b.wy * ny, wt = b.wx * tx + b.wy * ty;
    const wn2 = wn * 0.9, wt2 = wt * -0.15;
    b.wx = wn2 * nx + wt2 * tx; b.wy = wn2 * ny + wt2 * ty;
    if (w.ev.firstHit != null) w.ev.rail = true;
    if (w.ev.railed.indexOf(b.id) < 0) w.ev.railed.push(b.id);
    if (w.snd && -vn > 0.08) w.snd.push({ t: 'rail', v: -vn, x: b.x, y: b.y });
  }

  function sub(w, h) {
    const bs = w.balls, n = bs.length, cue = w.cue;
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
        if (i === cue || j === cue) {
          const o = i === cue ? j : i;
          if (w.ev.firstHit == null) w.ev.firstHit = o;
          if (w.ev.hits.indexOf(o) < 0) w.ev.hits.push(o);
        }
        if (w.snd && -rel > 0.03) w.snd.push({ t: 'ball', v: -rel, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      }
    }
    for (let i = 0; i < n; i++) {
      const b = bs[i]; if (!b.on) continue;
      if (Math.abs(b.x) > HL - R - 0.002 || Math.abs(b.y) > HW - R - 0.002) {
        if (b.vx !== 0 || b.vy !== 0) for (let k = 0; k < SEGS.length; k++) hitSeg(w, b, SEGS[k]);
        if (!POCKETED) continue;
        // A ball drops once its centre is far enough over the hole. A fast ball has to get deeper before it drops,
        // so a hard shot that is not centred hits the back of the pocket and can rattle out again.
        // b.hot remembers how hard the ball was travelling a moment ago, so slowing down on a jaw does not rescue it
        const tight = 1 - 0.55 * Math.min(1, Math.max(0, (b.hot - 2.5) / 4.5));
        const outside = Math.abs(b.x) > HL || Math.abs(b.y) > HW;
        let pk = -1;
        for (let k = 0; k < 6; k++) {
          const p = POCKETS[k], dx = b.x - p.x, dy = b.y - p.y, d2 = dx * dx + dy * dy, se = p.sink * tight;
          if (d2 < se * se && b.spit <= 0) { pk = k; break; }
          const lim = p.r - R * 0.35;
          if (outside && d2 > lim * lim && d2 < (p.r + R) * (p.r + R)) {
            const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, vn = b.vx * nx + b.vy * ny;
            b.x = p.x + nx * lim; b.y = p.y + ny * lim;
            if (vn > 0) {
              // the pocket back is dead for a gentle ball and springy for a hard one
              const e = 0.35 + 0.5 * Math.min(1, Math.max(0, (b.hot - 2.5) / 4.5));
              if (b.hot > 3.8) b.spit = 0.22;   // too hard and off-centre: the pocket spits it back out
              b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; b.vx *= 0.88; b.vy *= 0.88; b.wx *= 0.5; b.wy *= 0.5;
              if (b.hot > 3.8) {
                // thrown back towards the table, keeping a little of the angle it bounced at
                const s0 = Math.hypot(b.vx, b.vy) || 1, ox = -p.nx + 0.5 * b.vx / s0, oy = -p.ny + 0.5 * b.vy / s0, ol = Math.hypot(ox, oy) || 1, out = 0.4 * b.hot;
                b.vx = ox / ol * out; b.vy = oy / ol * out;
              }
              if (w.snd && vn > 0.3) w.snd.push({ t: 'rail', v: vn * 0.6, x: b.x, y: b.y });
            }
          }
        }
        if (pk < 0 && (Math.abs(b.x) > HL + 0.09 || Math.abs(b.y) > HW + 0.11)) {
          let best = 1e9;
          for (let k = 0; k < 6; k++) { const p = POCKETS[k], dd = (b.x - p.x) ** 2 + (b.y - p.y) ** 2; if (dd < best) { best = dd; pk = k; } }
        }
        if (pk >= 0) {
          b.on = false;
          w.ev.pocketed.push({ id: b.id, pocket: pk });
          if (w.snd) w.snd.push({ t: 'pocket', id: b.id, pocket: pk, x: b.x, y: b.y, vx: b.vx, vy: b.vy });
          b.vx = b.vy = b.wx = b.wy = b.wz = 0;
        }
      }
    }
  }

  function step(w, dt) {
    let vmax = 0;
    for (const b of w.balls) if (b.on) { b.px = b.x; b.py = b.y; const s = Math.hypot(b.vx, b.vy); if (s > vmax) vmax = s; }
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

  // First thing a ball meets when rolled from (ox,oy) along (dx,dy): another ball, a cushion or a pocket.
  function cast(w, ox, oy, dx, dy, skip) {
    let best = { t: 6, type: 'none' };
    for (const b of w.balls) {
      if (!b.on || b.id === skip) continue;
      const t = rayCircle(ox, oy, dx, dy, b.x, b.y, 2 * R);
      if (t < best.t) best = { t, type: 'ball', ball: b.id };
    }
    for (const s of SEGS) {
      for (const sg of [1, -1]) {
        const px = s.ax - s.ty * R * sg, py = s.ay + s.tx * R * sg;
        const den = dx * s.ty - dy * s.tx;
        if (Math.abs(den) < 1e-9) continue;
        const t = ((px - ox) * s.ty - (py - oy) * s.tx) / den;
        if (t <= 1e-6 || t >= best.t) continue;
        const u = (ox + dx * t - px) * s.tx + (oy + dy * t - py) * s.ty;
        if (u < 0 || u > s.len) continue;
        best = { t, type: 'rail', nx: -s.ty * sg, ny: s.tx * sg };
      }
      for (const [ex, ey] of [[s.ax, s.ay], [s.bx, s.by]]) {
        const t = rayCircle(ox, oy, dx, dy, ex, ey, R);
        if (t < best.t) { const gx = ox + dx * t, gy = oy + dy * t; best = { t, type: 'rail', nx: (gx - ex) / R, ny: (gy - ey) / R }; }
      }
    }
    for (const p of POCKETS) {
      const t = rayCircle(ox, oy, dx, dy, p.x, p.y, p.sink * 0.8);
      if (t < best.t) best = { t, type: 'pocket' };
    }
    best.gx = ox + dx * best.t; best.gy = oy + dy * best.t;
    if (best.type === 'ball') {
      const b = w.balls[best.ball];
      best.nx = (b.x - best.gx) / (2 * R); best.ny = (b.y - best.gy) / (2 * R);
      best.cut = Math.acos(Math.max(-1, Math.min(1, dx * best.nx + dy * best.ny)));
    }
    return best;
  }

  function predict(w, ang) {
    const c = w.balls[w.cue];
    return cast(w, c.x, c.y, Math.cos(ang), Math.sin(ang), w.cue);
  }

  // Where the cue ball travels after its first contact, for the long aiming guide.
  function cuePath(w, ang, V, a, bb, maxT) {
    const w2 = clone(w); strike(w2, ang, V, a, bb);
    const c = w2.balls[w2.cue], pts = [];
    let t = 0, started = false;
    while (t < (maxT || 2.2) && c.on) {
      step(w2, 1 / 120); t += 1 / 120;
      if (!started && (w2.ev.firstHit != null)) started = true;
      if (started) { pts.push(c.x, c.y); if (c.vx === 0 && c.vy === 0 && c.wx === 0 && c.wy === 0) break; }
    }
    return pts;
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

  return { R, HL, HW, CW, PO, SO, CM, SM, POCKETED, POCKETS, CUSHIONS, SEGS, makeWorld, clone, place, strike, step, rest, run, cast, predict, cuePath, pathClear, isFree, findFree, newEv };
}
if (typeof module !== 'undefined') module.exports = createPhysics;
