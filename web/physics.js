/* Cue-sports physics: 2D table plane, full 3D spin. Units are metres and seconds.
   createPhysics({ R, pockets, HL, HW, cornerMouth, sideMouth }) builds one table: a pool table with six pockets
   in any regulation size, or a carom table with none. */
function createPhysics(cfg) {
  const R = cfg.R, RB = R, POCKETED = !!cfg.pockets;
  const HL = cfg.HL || 1.27, HW = cfg.HW || 0.635, G = 9.8;
  /* cfg.real: the same table with the physics taken as far towards a real one as this engine goes (see the notes where each
     is used): cushions worked out from where the rubber meets the ball, friction between balls, the cue ball pushed off
     line by side, spin lost into the slate under a raised cue, cloth and cushions as fast as each kind of table really is,
     and no easing of the last roll. Without it everything is as it has always been, which is what the lessons and puzzles
     were made on. */
  const REAL = !!cfg.real;
  /* MU_SP: friction against turning on the spot. Side dies at 2.5 * MU_SP * g / R radians per second, every second. The
     original 0.04 makes that 34; measured tables give 5 to 15 (Dr. Dave Alciatore's table of equipment properties). The
     realistic physics takes the contact patch to grow with the ball, MU_SP = 4R/9, which is 10.9 for any ball - the same
     assumption and value as the pooltool simulator. For a carom ball on carom cloth that is a guess, not a measurement. */
  const MU_S0 = 0.2, MU_R0 = !REAL ? 0.016 : POCKETED ? 0.0105 : 0.0065, MU_SP0 = REAL ? (4 / 9) * R : 0.04, E_BALL = 0.96, MU_CUSH = REAL ? 0.2 : 0.16;
  // the nose of a cushion stands at 0.635 of a ball's height, so it meets the ball above the middle and pushes it down as well as back
  const NOSE_S = 0.27, NOSE_C = Math.sqrt(1 - NOSE_S * NOSE_S);
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

  function newEv() { return { firstHit: null, hits: [], rail: false, railed: [], pocketed: [], cushions: 0, pre: 0, air: 0, off: [], at: null }; }   // at: [x, y, z, ball or -1 for a cushion] - where the cue ball was the first time it touched anything
    // pre: cushions the cue ball met before any ball;   // off: balls that flew off the table   // cushions: how many the cue ball met before it had hit two balls

  function makeWorld(n) {
    const balls = [];
    for (let i = 0; i < n; i++) balls.push({ id: i, x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, wx: 0, wy: 0, wz: 0, z: 0, pz: 0, vz: 0, hot: 0, spit: 0, on: true, q: [0, 0, 0, 1] });
    return { balls, ev: newEv(), snd: null, track: false, cue: 0, ice: false };   // ice: the cloth is a sheet of ice (arcade)   // walls: barricades standing on the cloth (puzzles), made with wall()
  }

  function clone(w) {
    return { balls: w.balls.map(b => ({ id: b.id, x: b.x, y: b.y, px: b.x, py: b.y, vx: 0, vy: 0, wx: 0, wy: 0, wz: 0, z: 0, pz: 0, vz: 0, hot: b.hot || 0, spit: b.spit || 0, on: b.on, q: b.q })), ev: newEv(), snd: null, track: false, cue: w.cue, ice: w.ice };
  }

  function place(w, id, x, y, rnd) {
    const b = w.balls[id];
    b.x = b.px = x; b.y = b.py = y; b.vx = b.vy = b.wx = b.wy = b.wz = 0; b.z = b.pz = b.vz = 0; b.hot = 0; b.spit = 0; b.on = true;
    if (rnd) {
      const a = rnd() * Math.PI * 2, tl = (rnd() - 0.5) * 0.9;
      const cz = Math.cos(a / 2), sz = Math.sin(a / 2), cx = Math.cos(tl / 2), sx = Math.sin(tl / 2);
      b.q = [cz * sx, sz * sx, sz * cx, cz * cx];
    }
  }

  /* a: side, bb: above or below centre. el: how far the cue is raised (radians). One angle does everything a raised cue does:
       the ball leaves with only the level part of the blow (V cos el);
       the downward part drives it into the slate, which throws it back up - hard enough and it jumps;
       side on a raised cue sets the ball spinning about the line it travels along, and the cloth pushes back sideways, so it
       curves (masse) - once it is on the cloth: in the air nothing turns it. */
  function strike(w, ang, V, a, bb, el) {
    const c = w.balls[w.cue], dx = Math.cos(ang), dy = Math.sin(ang);
    if (el == null) el = restEl(w, ang, bb);           // not said: the ordinary stroke (level, or on a real table a few degrees up)
    const ce = Math.cos(el), se = Math.sin(el);
    // side on the cue ball sends it a little the other way from the side it was struck on (real tables only)
    const sq = squirt(a) * ce, gx = Math.cos(ang + sq), gy = Math.sin(ang + sq);
    c.vx = V * ce * gx; c.vy = V * ce * gy;
    const k = 2.5 * V * bb / R, ka = 2.5 * V * a / R;
    c.wx = -dy * k + dx * ka * se; c.wy = dx * k + dy * ka * se; c.wz = ka * ce;
    const up = JUMP * V * se; c.z = 0; c.vz = up > HOP ? up : 0;       // (original physics only) a hop too small to see is swallowed by the cloth
    if (REAL && se > 0) {
      // driven down into the slate, the ball is gripped by the cloth for that instant, and gives up some of its spin to it
      const ux = c.vx - R * c.wy, uy = c.vy + R * c.wx, us = Math.hypot(ux, uy);
      if (us > 1e-4) { const dec = Math.min(MU_S0 * V * se * (1 + (c.vz > 0 ? JUMP : 0)), (2 / 7) * us), nx = ux / us, ny = uy / us; c.vx -= dec * nx; c.vy -= dec * ny; c.wx -= (2.5 / R) * dec * ny; c.wy += (2.5 / R) * dec * nx; }
    }
    w.ev = newEv();
  }
  /* A real cue is never level: the hand behind it is up on the rail, so it leans down onto the ball by a few degrees. On the
     realistic tables the cue angle is that real angle, BASE_EL when nobody raises it - and anything from level to straight
     down when somebody does (the rail is not allowed to get in the way: that was no fun). */
  const BASE_EL = REAL ? 5 * Math.PI / 180 : 0;
  // the angle of an ordinary stroke here (0 in the original physics)
  const restEl = () => BASE_EL;
  // how far off the line of the cue the ball starts, in radians, for side a (about two degrees at the most side there is)
  const squirt = a => REAL ? 0.07 * a : 0;
  const CREEP = REAL ? 0 : 0.18, JUMP = REAL && !POCKETED ? 0.3 : 0.36,   // a carom ball is heavier and leaves the cloth less readily
        CLEAR = 0.034, MU_LAND = 0.25,                    // CLEAR: a ball this far off the cloth passes over a cushion
        /* The original physics drops a hop below HOP and a bounce below LAND outright, so a little more cue speed can turn
           "stays down" into a centimetre of air. The realistic one has no such step: every raised cue lifts the ball by what
           it lifts it, and it goes on bouncing until the bounce is too small to matter (a twentieth of a millimetre). */
        HOP = REAL ? 0 : 0.45, LAND = REAL ? 0.03 : 0.7, E_LAND = REAL ? 0.5 : 0.42;

  function motion(w, b, h) {
    if (REAL && (b.z > 0 || b.vz > 0)) {
      /* In the air: nothing but gravity - worked out exactly, landing at the instant it lands and bouncing on from there
         within the same step. (Stepping it, a ball one hair off the cloth was handed a whole step of falling, and came
         back up from that with more than it went down with: the smallest bounces never died.) */
      let rem = h;
      for (let k = 0; k < 12 && rem > 0; k++) {
        const top = b.z + (b.vz > 0 ? b.vz * b.vz / (2 * G) : 0), tl = (b.vz + Math.sqrt(b.vz * b.vz + 2 * G * b.z)) / G;
        if (b.id === w.cue && top > w.ev.air) w.ev.air = top;
        if (tl > rem) { b.z += b.vz * rem - 0.5 * G * rem * rem; b.vz -= G * rem; b.x += b.vx * rem; b.y += b.vy * rem; break; }
        const down = Math.sqrt(b.vz * b.vz + 2 * G * b.z), bounce = down > LAND;
        b.x += b.vx * tl; b.y += b.vy * tl; b.z = 0; rem -= tl;
        // coming down, the cloth grips the spinning ball for an instant: the harder the landing, the more of its spin turns into travel
        const ux = b.vx - R * b.wy, uy = b.vy + R * b.wx, us = Math.hypot(ux, uy);
        if (us > 1e-4) { const dec = Math.min(MU_LAND * (bounce ? 1 + E_LAND : 1) * down, (2 / 7) * us), nx = ux / us, ny = uy / us; b.vx -= dec * nx; b.vy -= dec * ny; b.wx -= (2.5 / R) * dec * ny; b.wy += (2.5 / R) * dec * nx; }
        if (bounce) { if (w.snd && down > 0.7) w.snd.push({ t: 'land', v: down, x: b.x, y: b.y, id: b.id }); b.vz = down * E_LAND; }
        else { b.vz = 0; b.x += b.vx * rem; b.y += b.vy * rem; break; }
      }
      if (w.track) turn(b, h);
      return;
    }
    if (b.z > 0 || b.vz > 0) {
      // in the air: nothing but gravity, until it comes down (and bounces once or twice if it came down hard)
      b.vz -= G * h; b.z += b.vz * h; b.x += b.vx * h; b.y += b.vy * h;
      if (b.id === w.cue && b.z > w.ev.air) w.ev.air = b.z;
      if (b.z <= 0) {
        b.z = 0;
        // coming down, the cloth grips the spinning ball for an instant: the harder the landing, the more of its spin turns into travel
        const down = -b.vz, ux = b.vx - R * b.wy, uy = b.vy + R * b.wx, us = Math.hypot(ux, uy);
        if (us > 1e-4 && down > 0) { const dec = Math.min(MU_LAND * (1 + E_LAND) * down, (2 / 7) * us), nx = ux / us, ny = uy / us; b.vx -= dec * nx; b.vy -= dec * ny; b.wx -= (2.5 / R) * dec * ny; b.wy += (2.5 / R) * dec * nx; }
        if (down > LAND) { if (w.snd && down > 0.7) w.snd.push({ t: 'land', v: down, x: b.x, y: b.y, id: b.id }); b.vz = down * E_LAND; } else b.vz = 0;
      }
      if (w.track) turn(b, h);
      return;
    }
    const MU_S = w.ice ? 0.022 : MU_S0, MU_R = w.ice ? 0.0085 : MU_R0, MU_SP = w.ice ? 0.012 : MU_SP0;
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
      // The cloth holds a rolling ball back by the same amount at any speed - except over the last stretch, where it lets go a
      // little, so the ball trickles to rest instead of stopping as if it had been switched off.
      const sp = Math.hypot(b.vx, b.vy), dec = MU_R * G * h * (sp < CREEP ? 0.35 + 0.65 * sp / CREEP : 1);
      if (sp <= dec || sp < 0.005) { b.vx = b.vy = 0; b.wx = b.wy = 0; }
      else { const s = (sp - dec) / sp; b.vx *= s; b.vy *= s; b.wy = b.vx / R; b.wx = -b.vy / R; }
    }
    const dz = (2.5 * MU_SP * G / R) * h;
    if (Math.abs(b.wz) <= dz) b.wz = 0; else b.wz -= Math.sign(b.wz) * dz;
    b.x += b.vx * h; b.y += b.vy * h;
    const spd = Math.hypot(b.vx, b.vy), cool = b.hot - 7 * h; b.hot = spd > cool ? spd : cool;
    if (b.spit > 0) b.spit -= h;
    if (w.track) turn(b, h);
  }
  function turn(b, h) {
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

  // how long ago the ball met this face (0: resting against or leaving it); -1 when it is not touching
  function segTime(b, s) {
    let u = (b.x - s.ax) * s.tx + (b.y - s.ay) * s.ty; u = u < 0 ? 0 : u > s.len ? s.len : u;
    const nx = b.x - (s.ax + s.tx * u), ny = b.y - (s.ay + s.ty * u), d2 = nx * nx + ny * ny;
    if (d2 >= RB * RB - 1e-12 || d2 < 1e-14) return -1;
    const d = Math.sqrt(d2), vn = (b.vx * nx + b.vy * ny) / d;
    return vn < 0 ? Math.min(SUBH, (RB - d) / -vn) : 0;
  }
  function hitSeg(w, b, s) {
    const R = RB;
    let u = (b.x - s.ax) * s.tx + (b.y - s.ay) * s.ty;
    u = u < 0 ? 0 : u > s.len ? s.len : u;
    const cx = s.ax + s.tx * u, cy = s.ay + s.ty * u;
    let nx = b.x - cx, ny = b.y - cy;
    const d2 = nx * nx + ny * ny;
    if (d2 >= R * R || d2 < 1e-14) return;
    let d = Math.sqrt(d2); nx /= d; ny /= d;
    let vn = b.vx * nx + b.vy * ny, tau = 0;
    if (vn < 0) {
      // back to the instant it touched, so that the cushion is met where and how it really was met - then on from there
      tau = Math.min(SUBH, (R - d) / -vn); b.x -= b.vx * tau; b.y -= b.vy * tau;
      u = (b.x - s.ax) * s.tx + (b.y - s.ay) * s.ty; u = u < 0 ? 0 : u > s.len ? s.len : u;
      const qx = s.ax + s.tx * u, qy = s.ay + s.ty * u, ex = b.x - qx, ey = b.y - qy, el = Math.hypot(ex, ey);
      if (el > 1e-9) { nx = ex / el; ny = ey / el; if (el < R) { b.x = qx + nx * R; b.y = qy + ny * R; } }
      vn = b.vx * nx + b.vy * ny;
      if (vn >= 0) { b.x += b.vx * tau; b.y += b.vy * tau; return; }
      hitRail(w, b, nx, ny, vn); b.x += b.vx * tau; b.y += b.vy * tau; return;
    }
    b.x = cx + nx * R; b.y = cy + ny * R;
  }
  let SUBH = 1 / 360;                                             // the length of the step being taken (for the rewinds above and below)
  function hitRail(w, b, nx, ny, vn) {
    const tx = -ny, ty = nx;
    if (REAL) {
      /* The cushion touches the ball above its middle, so it pushes along a line that slopes down into the table. The push
         straight back is what it always was. What is new is the grip at that raised point: it sees the ball's side spin,
         its roll along the rail AND its roll into the rail, and answers each (up to what friction allows) - which is why a
         rolling ball comes off a real cushion with its roll partly turned round, and why side lengthens or shortens the
         angle. And being pushed down, the ball is gripped by the cloth for that instant too. */
      const c = -vn, e = POCKETED ? Math.max(0.6, 0.85 - 0.035 * c) : Math.max(0.7, 0.9 - 0.03 * c), Jn = (1 + e) * c / NOSE_C;
      let wn = b.wx * nx + b.wy * ny, wt = b.wx * tx + b.wy * ty;
      const st = b.vx * tx + b.vy * ty - RB * (b.wz * NOSE_C + wn * NOSE_S), sp = vn * NOSE_S + wt * RB;   // slip of the touching point: along the rail, and up the face
      let Jt = -st / 3.5, Jp = -sp / (2.5 + NOSE_S * NOSE_S); const jl = Math.hypot(Jt, Jp), lim = MU_CUSH * Jn;
      if (jl > lim) { Jt *= lim / jl; Jp *= lim / jl; }
      const dn = (1 + e) * c + Jp * NOSE_S;
      b.vx += dn * nx + Jt * tx; b.vy += dn * ny + Jt * ty;
      b.wz -= 2.5 * Jt * NOSE_C / RB; wn -= 2.5 * Jt * NOSE_S / RB; wt += 2.5 * Jp / RB;
      b.wx = wn * nx + wt * tx; b.wy = wn * ny + wt * ty;
      const down = Jn * NOSE_S - Jp * NOSE_C;                     // how hard it was pressed into the cloth
      if (down > 0 && b.z === 0) { const ux = b.vx - RB * b.wy, uy = b.vy + RB * b.wx, us = Math.hypot(ux, uy); if (us > 1e-4) { const dec = Math.min(MU_S0 * down, (2 / 7) * us), ex = ux / us, ey = uy / us; b.vx -= dec * ex; b.vy -= dec * ey; b.wx -= (2.5 / RB) * dec * ey; b.wy += (2.5 / RB) * dec * ex; } }
      noteRail(w, b, vn); return;
    }
    const e = Math.max(0.62, 0.87 - 0.035 * -vn);
    // side spin grips the cushion and bends the rebound
    const slip = b.vx * tx + b.vy * ty - RB * b.wz;
    const lim = MU_CUSH * (1 + e) * -vn;
    let dvt = -(2 / 7) * slip;
    if (dvt > lim) dvt = lim; else if (dvt < -lim) dvt = -lim;
    b.vx += -(1 + e) * vn * nx + dvt * tx;
    b.vy += -(1 + e) * vn * ny + dvt * ty;
    b.wz -= (2.5 / RB) * dvt;
    // the nose sits above centre: roll into the rail is mostly killed and slightly reversed,
    // roll along the rail survives
    const wn = b.wx * nx + b.wy * ny, wt = b.wx * tx + b.wy * ty;
    const wn2 = wn * 0.9, wt2 = wt * -0.15;
    b.wx = wn2 * nx + wt2 * tx; b.wy = wn2 * ny + wt2 * ty;
    noteRail(w, b, vn);
  }
  function noteRail(w, b, vn) {
    if (w.ev.firstHit != null) w.ev.rail = true;
    if (w.ev.railed.indexOf(b.id) < 0) w.ev.railed.push(b.id);
    if (b.id === w.cue && w.ev.hits.length < 2 && -vn > 0.05) w.ev.cushions++;
    if (b.id === w.cue && w.ev.firstHit == null && -vn > 0.05) w.ev.pre++;
    if (b.id === w.cue && !w.ev.at) w.ev.at = [b.x, b.y, b.z, -1];
    if (w.snd && -vn > 0.08) w.snd.push({ t: 'rail', v: -vn, x: b.x, y: b.y, id: b.id });
  }

  /* Two balls of which at least one is off the cloth. Everything in three dimensions: where they touched, how fast they were
     closing, and the blow - so a ball coming down on another is thrown back up by it and knocks it on, and the meeting is
     counted as a hit. A ball that is on the cloth cannot be driven down into it: the slate takes that. */
  function hitAir(w, a, b, i, j, h) {
    let dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d2 = dx * dx + dy * dy + dz * dz;
    if (d2 >= 4 * R * R || d2 < 1e-14) return;
    const rx = b.vx - a.vx, ry = b.vy - a.vy, rz = b.vz - a.vz, vv = rx * rx + ry * ry + rz * rz, dv = dx * rx + dy * ry + dz * rz;
    if (dv >= 0 || vv < 1e-12) return;                             // already parting
    const tau = Math.min(h, (dv + Math.sqrt(dv * dv + vv * (4 * R * R - d2))) / vv);
    for (const q of [a, b]) { q.x -= q.vx * tau; q.y -= q.vy * tau; q.z = Math.max(0, q.z - q.vz * tau); }
    dx = b.x - a.x; dy = b.y - a.y; dz = b.z - a.z; const d = Math.hypot(dx, dy, dz) || 1, nx = dx / d, ny = dy / d, nz = dz / d;
    const rel = rx * nx + ry * ny + rz * nz;
    if (rel < 0) {
      const jn = -(1 + E_BALL) / 2 * rel;
      a.vx -= jn * nx; a.vy -= jn * ny; a.vz -= jn * nz; b.vx += jn * nx; b.vy += jn * ny; b.vz += jn * nz;
      if (REAL) {
        // the same friction between the two surfaces as on the cloth (see below), in three dimensions
        const wx = a.wx + b.wx, wy = a.wy + b.wy, wz = a.wz + b.wz;
        let sx = b.vx - a.vx - R * (wy * nz - wz * ny), sy = b.vy - a.vy - R * (wz * nx - wx * nz), sz = b.vz - a.vz - R * (wx * ny - wy * nx);
        const sn = sx * nx + sy * ny + sz * nz; sx -= sn * nx; sy -= sn * ny; sz -= sn * nz;
        const us = Math.hypot(sx, sy, sz);
        if (us > 1e-5) {
          const J = Math.min((0.00995 + 0.108 * Math.exp(-1.088 * us)) * jn, us / 7), fx = -J * sx / us, fy = -J * sy / us, fz = -J * sz / us, k = 2.5 / R;
          b.vx += fx; b.vy += fy; b.vz += fz; a.vx -= fx; a.vy -= fy; a.vz -= fz;
          const tx = -(ny * fz - nz * fy) * k, ty = -(nz * fx - nx * fz) * k, tz = -(nx * fy - ny * fx) * k;   // the same turn for both: (-R n) x f on one, (R n) x (-f) on the other
          a.wx += tx; a.wy += ty; a.wz += tz; b.wx += tx; b.wy += ty; b.wz += tz;
        }
      }
      for (const q of [a, b]) if (q.z <= 0 && q.vz < 0) q.vz = 0;
      if (i === w.cue || j === w.cue) { const o = i === w.cue ? j : i, c = w.balls[w.cue]; if (!w.ev.at) w.ev.at = [c.x, c.y, c.z, o]; if (w.ev.firstHit == null) w.ev.firstHit = o; if (w.ev.hits.indexOf(o) < 0) w.ev.hits.push(o); }
      if (w.snd && -rel > 0.03) w.snd.push({ t: 'ball', v: -rel, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, ia: a.id, ib: b.id });
    }
    for (const q of [a, b]) { q.x += q.vx * tau; q.y += q.vy * tau; q.z = Math.max(0, q.z + q.vz * tau); }
  }
  function sub(w, h) {
    SUBH = h;
    const bs = w.balls, n = bs.length, cue = w.cue;
    for (let i = 0; i < n; i++) if (bs[i].on) motion(w, bs[i], h);
    for (let i = 0; i < n; i++) {
      const a = bs[i]; if (!a.on) continue;
      for (let j = i + 1; j < n; j++) {
        const b = bs[j]; if (!b.on) continue;
        let dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
        if (d2 >= 4 * R * R || d2 < 1e-14) continue;
        if (a.z !== 0 || b.z !== 0 || a.vz !== 0 || b.vz !== 0) { hitAir(w, a, b, i, j, h); continue; }
        /* They are found already overlapping, a little way into each other. The blow goes along the line of centres at the
           instant they TOUCHED, so both are taken back to that instant first (and carried on from it afterwards). Without
           this a thin cut came out degrees wrong, and differently at every step length. */
        const rvx = b.vx - a.vx, rvy = b.vy - a.vy, vv = rvx * rvx + rvy * rvy, dv = dx * rvx + dy * rvy;
        let tau = 0;
        if (dv < 0 && vv > 1e-12) {
          tau = Math.min(h, (dv + Math.sqrt(dv * dv + vv * (4 * R * R - d2))) / vv);
          a.x -= a.vx * tau; a.y -= a.vy * tau; b.x -= b.vx * tau; b.y -= b.vy * tau;
          dx = b.x - a.x; dy = b.y - a.y; d2 = dx * dx + dy * dy;
        }
        const d = Math.sqrt(d2), nx = dx / d, ny = dy / d, ov = (2 * R - d) / 2;
        if (ov > 0) { a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov; }
        const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (rel >= 0) { if (tau) { a.x += a.vx * tau; a.y += a.vy * tau; b.x += b.vx * tau; b.y += b.vy * tau; } continue; }
        const jn = -(1 + E_BALL) / 2 * rel;
        a.vx -= jn * nx; a.vy -= jn * ny; b.vx += jn * nx; b.vy += jn * ny;
        if (REAL && a.z === 0 && b.z === 0) {
          /* Balls are not perfectly slippery. Where they touch, one surface is sliding across the other - from the angle of
             the cut and from whatever spin they carry - and friction there throws the struck ball a degree or so off the
             line through the centres and hands a little spin across. Slower, stickier: the faster the sliding, the less grip. */
          const uh = (b.vx - a.vx) * -ny + (b.vy - a.vy) * nx - R * (b.wz + a.wz), uz = -R * ((b.wx + a.wx) * ny - (b.wy + a.wy) * nx), us = Math.hypot(uh, uz);
          if (us > 1e-5) {
            const J = Math.min((0.00995 + 0.108 * Math.exp(-1.088 * us)) * jn, us / 7), dh = -uh / us, dz = -uz / us;
            b.vx += J * dh * -ny; b.vy += J * dh * nx; a.vx -= J * dh * -ny; a.vy -= J * dh * nx;
            const k = 2.5 * J / R; a.wz -= k * dh; b.wz -= k * dh; a.wx += k * dz * -ny; a.wy += k * dz * nx; b.wx += k * dz * -ny; b.wy += k * dz * nx;
          }
        }
        if ((i === cue || j === cue) && !w.ev.at) { const c = i === cue ? a : b; w.ev.at = [c.x, c.y, 0, i === cue ? j : i]; }
        if (tau) { a.x += a.vx * tau; a.y += a.vy * tau; b.x += b.vx * tau; b.y += b.vy * tau; }
        if (i === cue || j === cue) {
          const o = i === cue ? j : i;
          if (w.ev.firstHit == null) w.ev.firstHit = o;
          if (w.ev.hits.indexOf(o) < 0) w.ev.hits.push(o);
        }
        if (w.snd && -rel > 0.03) w.snd.push({ t: 'ball', v: -rel, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, ia: a.id, ib: b.id });
      }
    }
    for (let i = 0; i < n; i++) {
      const b = bs[i]; if (!b.on) continue;
      if (Math.abs(b.x) > HL - R - 0.002 || Math.abs(b.y) > HW - R - 0.002) {
        if (b.z > CLEAR) {
          // over the cushion: once it is past the rail it is gone
          if (Math.abs(b.x) > HL + 0.05 || Math.abs(b.y) > HW + 0.05) {
            b.on = false; w.ev.off.push(b.id);
            if (w.snd) w.snd.push({ t: 'off', id: b.id, x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz });
            b.vx = b.vy = b.wx = b.wy = b.wz = 0; b.z = b.vz = 0;
          }
          continue;
        }
        // Where two faces are within reach at once (a pocket jaw, a corner), the one that was met first is dealt with first -
        // not whichever comes first in the list, which made the left of the table play differently from the right.
        if (b.vx !== 0 || b.vy !== 0) for (let pass = 0; pass < 4; pass++) {
          let best = -1, bt = -1;
          for (let k = 0; k < SEGS.length; k++) { const t = segTime(b, SEGS[k]); if (t > bt) { bt = t; best = k; } }
          if (best < 0) break;
          hitSeg(w, b, SEGS[best]);
        }
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
                const s0 = Math.hypot(b.vx, b.vy) || 1, ox = -p.nx + 0.5 * b.vx / s0, oy = -p.ny + 0.5 * b.vy / s0, ol = Math.hypot(ox, oy) || 1, out = REAL ? Math.min(0.4 * b.hot, s0) : 0.4 * b.hot;   // realistic: never faster than it came off the back
                b.vx = ox / ol * out; b.vy = oy / ol * out;
              }
              if (w.snd && vn > 0.3) w.snd.push({ t: 'rail', v: vn * 0.6, x: b.x, y: b.y, id: b.id });
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
    for (const b of w.balls) if (b.on) { b.px = b.x; b.py = b.y; b.pz = b.z; const s = Math.hypot(b.vx, b.vy); if (s > vmax) vmax = s; }
    const n = Math.max(1, Math.ceil(vmax * dt / (R * 0.3)));
    const h = dt / n;
    for (let i = 0; i < n; i++) sub(w, h);
  }

  /* A shot is over when nothing is travelling. A ball can still be turning on the spot then (side dies last), but on a level
     cloth that turning cannot move it, so nobody is kept waiting for it: it is dropped when the shot ends - here, in the
     game (resolve) and in replays alike, so all three always agree. */
  function rest(w) {
    for (const b of w.balls) if (b.on && (b.vx !== 0 || b.vy !== 0 || b.wx !== 0 || b.wy !== 0 || b.z !== 0 || b.vz !== 0)) return false;
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
      const R = RB;
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

  /* The shot played out on a copy, for the aiming guide: the guide draws what this returns and nothing else, so what is shown
     is what the same inputs will do. pre: the cue ball's path up to its first contact; at: where it was then ([x, y, z, ball
     or -1]); post: its path afterwards, for `after` seconds; turn: where in post it next changed course; obj: the struck
     ball's line - from (x0, y0) along (dx, dy), running straight as far as (x1, y1). */
  function preview(w, ang, V, a, bb, el, after) {
    const w2 = clone(w); strike(w2, ang, V, a, bb, el);
    const c = w2.balls[w2.cue], out = { pre: [c.x, c.y, 0], at: null, hit: null, post: [], turn: -1, obj: null };
    let t = 0, tc = 0, o = null, oGo = false, ldx = 0, ldy = 0, cdx = 0, cdy = 0;
    while (t < 9 && c.on) {
      const lx = c.x, ly = c.y;
      step(w2, 1 / 120); t += 1 / 120;
      if (!out.at) {
        if (!w2.ev.at) { out.pre.push(c.x, c.y, c.z); if (c.vx === 0 && c.vy === 0 && c.z === 0 && c.vz === 0) break; continue; }
        out.at = w2.ev.at; tc = t;
        if (out.at[3] >= 0) {
          out.hit = out.at[3]; o = w2.balls[out.hit]; const s = Math.hypot(o.vx, o.vy), b0 = w.balls[out.hit];
          if (s > 1e-6) { out.obj = { x0: b0.x, y0: b0.y, dx: o.vx / s, dy: o.vy / s, x1: o.x, y1: o.y }; ldx = o.vx / s; ldy = o.vy / s; oGo = true; }
        }
        out.post.push(out.at[0], out.at[1], out.at[2], c.x, c.y, c.z);
      } else {
        out.post.push(c.x, c.y, c.z);
        if (out.turn < 0) {
          const mx = c.x - lx, my = c.y - ly, ml = Math.hypot(mx, my);
          if (ml < 1e-7) out.turn = out.post.length - 3;
          else { if ((cdx || cdy) && (mx * cdx + my * cdy) / ml < 0.9994) out.turn = out.post.length - 6; cdx = mx / ml; cdy = my / ml; }
        }
        if (oGo) {
          const s = Math.hypot(o.vx, o.vy);
          if (!o.on || s < 1e-6 || (o.vx * ldx + o.vy * ldy) / s < 0.9994) oGo = false;   // potted, stopped, or knocked off its line
          else { out.obj.x1 = o.x; out.obj.y1 = o.y; ldx = o.vx / s; ldy = o.vy / s; }
        }
      }
      const still = c.vx === 0 && c.vy === 0 && c.z === 0 && c.vz === 0;
      if (t - tc > (after || 0.6) || (still && !oGo)) break;
    }
    if (out.turn < 0) out.turn = Math.max(0, out.post.length - 3);
    return out;
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

  // how high (metres) a ball struck at speed V with the cue raised by el leaves the cloth; 0 when it stays down
  const hop = (V, el) => { const up = JUMP * V * Math.sin(el || 0); return up > HOP ? up * up / (2 * G) : 0; };
  return { hop, squirt, REAL, BASE_EL, restEl, R, HL, HW, CW, PO, SO, CM, SM, POCKETED, POCKETS, CUSHIONS, SEGS, makeWorld, clone, place, strike, step, rest, run, cast, predict, preview, pathClear, isFree, findFree, newEv };
}
if (typeof module !== 'undefined') module.exports = createPhysics;
