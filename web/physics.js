/* Cue-sports physics: 2D table plane, full 3D spin. Units are metres and seconds.
   createPhysics({ R, pockets, HL, HW, cornerMouth, sideMouth }) builds one table: a pool table with six pockets
   in any regulation size, or a carom table with none. */
/* The same numbers on every device. Math.sin, cos, exp, tanh and hypot are left by the language to each engine's own library,
   and two phones (or a phone and the server) can differ in the last bit - which a break turns into a different game: in a
   ranked game each device plays the other's shots itself, so they must come out exactly alike. These use only + - * / and
   sqrt, which every engine must round the same way. (Accurate to about one part in 10^16.) */
const DMath = (() => {
  const LN2_HI = 6.93147180369123816490e-01, LN2_LO = 1.90821492927058770002e-10, INV_LN2 = 1.44269504088896338700e+00;
  const PIO2_1 = 1.57079632673412561417e+00, PIO2_1T = 6.07710050650619224932e-11, INV_PIO2 = 6.36619772367581382433e-01;
  function exp(x) {
    if (x !== x) return x; if (x > 709) return Infinity; if (x < -745) return 0;
    const k = Math.round(x * INV_LN2), r = (x - k * LN2_HI) - k * LN2_LO;
    let t = 1, s = 1; for (let i = 1; i <= 14; i++) { t = t * r / i; s += t; }
    if (k > 0) for (let i = 0; i < k; i++) s *= 2; else for (let i = 0; i < -k; i++) s *= 0.5;
    return s;
  }
  // sin and cos of r in [-pi/4, pi/4]
  const ks = r => { const r2 = r * r; let t = r, s = r; for (let i = 1; i <= 9; i++) { t = -t * r2 / ((2 * i) * (2 * i + 1)); s += t; } return s; };
  const kc = r => { const r2 = r * r; let t = 1, s = 1; for (let i = 1; i <= 9; i++) { t = -t * r2 / ((2 * i - 1) * (2 * i)); s += t; } return s; };
  function sin(x) { const k = Math.round(x * INV_PIO2), r = (x - k * PIO2_1) - k * PIO2_1T, q = ((k % 4) + 4) % 4; return q === 0 ? ks(r) : q === 1 ? kc(r) : q === 2 ? -ks(r) : -kc(r); }
  function cos(x) { const k = Math.round(x * INV_PIO2), r = (x - k * PIO2_1) - k * PIO2_1T, q = ((k % 4) + 4) % 4; return q === 0 ? kc(r) : q === 1 ? -ks(r) : q === 2 ? -kc(r) : ks(r); }
  function tanh(x) { const a = x < 0 ? -x : x; if (a > 22) return x < 0 ? -1 : 1; const e = exp(2 * a), t = (e - 1) / (e + 1); return x < 0 ? -t : t; }
  const hypot = (x, y, z) => Math.sqrt(x * x + y * y + (z ? z * z : 0));
  return { exp, sin, cos, tanh, hypot };
})();
/* PHYS_V: which physics this is. Raised whenever a change here makes a shot go otherwise, so devices on different
   physics are not matched together, nor checked by a server on another (server/src/version.js, the same number). */
const PHYS_V = 8;                                   // 2-3: the contact model (PR #14); 4: the game physics; 5: the stroke (11-07); 6: the game physics with the cushion's roll; 7: 4구 roll-out, a red pair knocked apart; 8: balls run as far as on a real table
function createPhysics(cfg) {
  const R = cfg.R, RB = R, POCKETED = !!cfg.pockets;
  const HL = cfg.HL || 1.27, HW = cfg.HW || 0.635, G = 9.8;
  /* One physics, the one the game is played on. The rule for it: what a player pictures is what happens. Everything a
     player draws in their head stays and is made plain and steady - follow and draw, side opening or closing the angle off
     a cushion, a raised cue curving or jumping the ball. Everything real that nobody pictures is left out: the cue ball
     pushed off line by side (squirt), the struck ball dragged off the line of centres (throw), the ordinary stroke curving
     the ball, the angle off a cushion changing with the pace, side lingering for cushion after cushion. Balls run as far as
     on a real table (owner 11-09: they stopped dead too soon - mostly the cushions took too much). (There were two more before: the original one, and a realistic one the puzzles were made on. Both are gone.) */
  /* MU_SP: friction against turning on the spot. Side dies at 2.5 * MU_SP * g / R radians per second, every second: 34 with
     0.04 (measured tables give 5 to 15 - but on the move, side here fades with the distance run instead, see SIDE_RUN). */
  /* MU_R0: the cloth's hold on a rolling ball - a real pool cloth's about 0.010 (a lag, two lengths, at 1.3 m/s), the heated
     cloth of a carom table less (0.007). It was 0.016 on both. */
  const MU_S0 = 0.2, MU_R0 = POCKETED ? 0.010 : 0.007, MU_SP0 = 0.04, E_BALL = 0.96;
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
    const C38 = DMath.cos(38 * Math.PI / 180), S38 = DMath.sin(38 * Math.PI / 180);
    const C75 = DMath.cos(75 * Math.PI / 180), S75 = DMath.sin(75 * Math.PI / 180);
    const seg = (p, q) => { const l = DMath.hypot(q[0] - p[0], q[1] - p[1]); SEGS.push({ ax: p[0], ay: p[1], bx: q[0], by: q[1], len: l, tx: (q[0] - p[0]) / l, ty: (q[1] - p[1]) / l }); };
    function add(ax, ay, bx, by, ox, oy, aCorner, bCorner) {
      const len = DMath.hypot(bx - ax, by - ay), tx = (bx - ax) / len, ty = (by - ay) / len;
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

  function newEv() { return { firstHit: null, hits: [], rail: false, railed: [], pocketed: [], cushions: 0, pre: 0, air: 0, off: [], at: null, walls: 0 }; }   // at: [x, y, z, ball or -1 for a cushion] - where the cue ball was the first time it touched anything
    // pre: cushions the cue ball met before any ball;   // off: balls that flew off the table   // cushions: how many the cue ball met before it had hit two balls

  function makeWorld(n) {
    const balls = [];
    for (let i = 0; i < n; i++) balls.push({ id: i, x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, wx: 0, wy: 0, wz: 0, z: 0, pz: 0, vz: 0, hot: 0, spit: 0, on: true, q: [0, 0, 0, 1] });
    return { balls, ev: newEv(), snd: null, track: false, cue: 0, ice: false, walls: NO_WALLS };   // ice: the cloth is a sheet of ice (arcade)   // walls: barricades (puzzles), made with walls()
  }
  /* Barricades (puzzles): blocks standing on the cloth that force a way round. Each { x, y, len, thick, ang, h }: its middle,
     length and thickness (m), its turn (radians, 0 along the table's length) and height (m). A ball rolling into one comes
     off it as off a cushion - the same rubber, side bending it the same - but it does not count as a cushion (ev.walls
     counts them); a ball in the air higher than its top passes over. The faces are kept ready for the step. */
  const NO_WALLS = [];
  function walls(list) {
    return (list || []).map(q => {
      const c = DMath.cos(q.ang || 0), s = DMath.sin(q.ang || 0), hl = q.len / 2, ht = (q.thick || 0.03) / 2;
      const at = (u, v) => [q.x + c * u - s * v, q.y + s * u + c * v], P = [at(-hl, -ht), at(hl, -ht), at(hl, ht), at(-hl, ht)], faces = [];
      for (let i = 0; i < 4; i++) { const a = P[i], b = P[(i + 1) % 4], l = DMath.hypot(b[0] - a[0], b[1] - a[1]); faces.push({ ax: a[0], ay: a[1], bx: b[0], by: b[1], len: l, tx: (b[0] - a[0]) / l, ty: (b[1] - a[1]) / l }); }
      return { x: q.x, y: q.y, len: q.len, thick: ht * 2, ang: q.ang || 0, h: q.h || 0.04, faces, reach: hl + ht + R };
    });
  }

  function clone(w) {
    return { balls: w.balls.map(b => ({ id: b.id, x: b.x, y: b.y, px: b.x, py: b.y, vx: 0, vy: 0, wx: 0, wy: 0, wz: 0, z: 0, pz: 0, vz: 0, hot: b.hot || 0, spit: b.spit || 0, on: b.on, q: b.q })), ev: newEv(), snd: null, track: false, cue: w.cue, ice: w.ice, walls: w.walls || NO_WALLS };
  }

  function place(w, id, x, y, rnd) {
    const b = w.balls[id];
    b.x = b.px = x; b.y = b.py = y; b.vx = b.vy = b.wx = b.wy = b.wz = 0; b.z = b.pz = b.vz = 0; b.hot = 0; b.spit = 0; b.on = true;
    if (rnd) {
      const a = rnd() * Math.PI * 2, tl = (rnd() - 0.5) * 0.9;
      const cz = DMath.cos(a / 2), sz = DMath.sin(a / 2), cx = DMath.cos(tl / 2), sx = DMath.sin(tl / 2);
      b.q = [cz * sx, sz * sx, sz * cx, cz * cx];
    }
  }

  /* a: side, bb: above or below centre. el: how far the cue is raised (radians). One angle does everything a raised cue does:
       the ball leaves with only the level part of the blow (V cos el);
       the downward part drives it into the slate, which throws it back up - hard enough and it jumps;
       side on a raised cue sets the ball spinning about the line it travels along, and the cloth pushes back sideways, so it
       curves (masse) - once it is on the cloth: in the air nothing turns it. */
  function strike(w, ang, V, a, bb, el) {
    const c = w.balls[w.cue], dx = DMath.cos(ang), dy = DMath.sin(ang);
    if (el == null) el = restEl(w, ang, bb);           // not said: the ordinary stroke (level, or on a real table a few degrees up)
    const ce = DMath.cos(el), se = DMath.sin(el);
    c.vx = V * ce * dx; c.vy = V * ce * dy;
    const k = 2.5 * V * bb / R, ka = 2.5 * V * a / R;
    c.wx = -dy * k + dx * ka * se; c.wy = dx * k + dy * ka * se; c.wz = ka * ce;
    const up = lift(V, el); c.z = 0; c.vz = up > 0 ? up : 0;
    if (se > 0) {
      // driven down into the slate, the ball is gripped by the cloth for that instant, and gives up some of its spin to it
      const ux = c.vx - R * c.wy, uy = c.vy + R * c.wx, us = DMath.hypot(ux, uy);
      if (us > 1e-4) { const dec = Math.min(PINCH * MU_S0 * V * se * (1 + (c.vz > 0 ? JUMP : 0)), (2 / 7) * us), nx = ux / us, ny = uy / us; c.vx -= dec * nx; c.vy -= dec * ny; c.wx -= (2.5 / R) * dec * ny; c.wy += (2.5 / R) * dec * nx; }
    }
    w.ev = newEv();
  }
  /* The ordinary stroke is level, 0 degrees, shown as 0 and played as 0 - nobody pictures their everyday stroke curving the
     ball - and the angle set is the angle played. (The cue is still drawn leaning a little, as a real one does.) */
  const restEl = () => 0;
  /* The raised cue: how fast the ball leaves the cloth, upwards - the plainest picture: the steeper the cue, the higher the
     ball goes, as players expect and as a jump cue really does (a ball close in front is jumped at sixty degrees or more,
     one further off at forty). Three numbers, each a thing: ANG_K how much of the downward drive the slate gives back up;
     ANG_C what the cloth swallows (a soft stroke, a masse, stays down); ANG_Z the most a ball can be sent up at all - the
     cue is still on top of it - so that full power is a high jump, not a flight off the table. Fitted so that, on a pool
     table: a ball 6 cm in front is jumped at 60 degrees from about three-quarter power, 3 cm in front at 70; one a quarter
     of a metre off at 45; half a metre off at 40, or 30 at full power; full power goes 10-14 cm up; a 30% masse hops 3 mm.
     The pinch of a raised stroke (the ball driven into the cloth for an instant, giving it some of its spin) is a third
     of a full one: a masse goes out along the cue first and bends after, as it does in slow motion. */
  const ANG_K = 0.55, ANG_C = 0.45, ANG_Z = 1.7, PINCH = 0.35, RAIL_ROLL = 0.2;
  const lift = (V, el) => { const u = Math.max(0, ANG_K * V * DMath.sin(el) - ANG_C); return ANG_Z * DMath.tanh(u / ANG_Z); };
  const SIDE_RUN = 2.4;                                          // metres of run over which side falls to a third (play)
  const CREEP = 0.18, JUMP = POCKETED ? 0.36 : 0.3,              // a carom ball is heavier and leaves the cloth less readily
        CLEAR = 0.034, MU_LAND = 0.25,                    // CLEAR: a ball this far off the cloth passes over a cushion
        // every raised cue lifts the ball by what it lifts it, and it bounces on until a bounce is too small to matter
        LAND = 0.03, E_LAND = 0.5;

  function motion(w, b, h) {
    if (b.z > 0 || b.vz > 0) {
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
        const ux = b.vx - R * b.wy, uy = b.vy + R * b.wx, us = DMath.hypot(ux, uy);
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
        const down = -b.vz, ux = b.vx - R * b.wy, uy = b.vy + R * b.wx, us = DMath.hypot(ux, uy);
        if (us > 1e-4 && down > 0) { const dec = Math.min(MU_LAND * (1 + E_LAND) * down, (2 / 7) * us), nx = ux / us, ny = uy / us; b.vx -= dec * nx; b.vy -= dec * ny; b.wx -= (2.5 / R) * dec * ny; b.wy += (2.5 / R) * dec * nx; }
        if (down > LAND) { if (w.snd && down > 0.7) w.snd.push({ t: 'land', v: down, x: b.x, y: b.y, id: b.id }); b.vz = down * E_LAND; } else b.vz = 0;
      }
      if (w.track) turn(b, h);
      return;
    }
    // ice: much more slippery than the cloth it replaces
    const MU_S = w.ice ? 0.022 : MU_S0, MU_R = w.ice ? MU_R0 * 0.53 : MU_R0, MU_SP = w.ice ? MU_SP0 * 0.3 : MU_SP0;
    const ux = b.vx - R * b.wy, uy = b.vy + R * b.wx, us = DMath.hypot(ux, uy);
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
      const sp = DMath.hypot(b.vx, b.vy), dec = MU_R * G * h * (sp < CREEP ? 0.35 + 0.65 * sp / CREEP : 1);
      if (sp <= dec || sp < 0.005) { b.vx = b.vy = 0; b.wx = b.wy = 0; }
      else { const s = (sp - dec) / sp; b.vx *= s; b.vy *= s; b.wy = b.vx / R; b.wx = -b.vy / R; }
    }
    if (!w.ice) {
      /* The game's side fades with the distance the ball runs, not with time: the same share of it is left at the cushion
         however hard the ball was hit (and twice the pace put twice the side on), so a given side bends a given cushion by
         the same amount at any pace. A third of it is gone after a metre; after three cushions or so it is all but spent.
         A ball turning on the spot still winds down at the old rate. */
      const run = DMath.hypot(b.vx, b.vy) * h;
      b.wz *= DMath.exp(-run / SIDE_RUN);
      const dz = (2.5 * MU_SP * G / R) * h * 0.25;
      if (Math.abs(b.wz) <= dz) b.wz = 0; else b.wz -= Math.sign(b.wz) * dz;
    } else {
      const dz = (2.5 * MU_SP * G / R) * h;
      if (Math.abs(b.wz) <= dz) b.wz = 0; else b.wz -= Math.sign(b.wz) * dz;
    }
    b.x += b.vx * h; b.y += b.vy * h;
    const spd = DMath.hypot(b.vx, b.vy), cool = b.hot - 7 * h; b.hot = spd > cool ? spd : cool;
    if (b.spit > 0) b.spit -= h;
    if (w.track) turn(b, h);
  }
  function turn(b, h) {
    const wm = DMath.hypot(b.wx, b.wy, b.wz);
    if (wm > 1e-6) {
      const ang = wm * h, s = DMath.sin(ang / 2) / wm, c = DMath.cos(ang / 2);
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
      const qx = s.ax + s.tx * u, qy = s.ay + s.ty * u, ex = b.x - qx, ey = b.y - qy, el = DMath.hypot(ex, ey);
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
    {
      /* The game's cushion: a mirror, with side as the one thing that bends it off the rail - and with the ball's roll left
         as it was, as on a real table. Off the rail itself, angle in = angle out at an ordinary pace (a hard ball sinks into
         the rubber and comes off a touch wider, a slow one a touch narrower); side grips the rail and opens or closes that
         angle in proportion to how much there is.
         The roll: the cushion's nose, above the ball's middle, takes most of the roll the ball had INTO the rail - not all:
         RAIL_ROLL of it stays, still turning towards the rail as the ball leaves it - while the roll it had ALONG the rail
         stays whole. So afterwards the cloth bends it, in a curve you can see: a rolling ball is pulled round towards the
         rail's direction (the angle opens), follow more so, draw the other way (it closes), a stunned ball not at all - and
         a masse keeps curving. That bend is what a player learns to read; the guide shows it from "길게" on. */
      const c = -vn, eT = POCKETED ? 0.86 : 0.9, eN = Math.min(eT + 0.05, Math.max(eT - 0.08, eT + 0.02 * (2.5 - c)));
      const vt = b.vx * tx + b.vy * ty, lim = 0.35 * (1 + eT) * c;
      let ds = (2 / 7) * RB * b.wz; if (ds > lim) ds = lim; else if (ds < -lim) ds = -lim;
      // (the rubber's grip takes a little of the pace along it, not the fifth it took: kT)
      const kT = POCKETED ? 0.95 : 0.96, q = RB * b.wz - kT * vt;
      // and side turned into pace along the rail never makes more than there was: spin and pace along the rail together
      // only lose - ds that way at most q / 1.75 (the fifth the grip took had hidden this)
      if (ds * q <= 0) ds = 0; else if (Math.abs(ds) > Math.abs(q) / 1.75) ds = q / 1.75;
      const dvt = -(1 - kT) * vt + ds;
      b.vx += -(1 + eN) * vn * nx + dvt * tx; b.vy += -(1 + eN) * vn * ny + dvt * ty;
      b.wz -= (2.5 / RB) * ds;
      if (b.z === 0) { const wn = b.wx * nx + b.wy * ny, wt = (b.wx * tx + b.wy * ty) * RAIL_ROLL; b.wx = wn * nx + wt * tx; b.wy = wn * ny + wt * ty; }
      if (w.trace && b.id === w.cue) TR_N = [nx, ny];
      if (ON_WALL) noteWall(w, b, vn); else noteRail(w, b, vn);
      return;
    }
  }
  let ON_WALL = false;                                             // (the face being met is a barricade's, not a cushion's)
  function noteWall(w, b, vn) {
    w.ev.walls++;
    if (b.id === w.cue && !w.ev.at) w.ev.at = [b.x, b.y, b.z, -2];
    if (w.snd && -vn > 0.08) w.snd.push({ t: 'rail', v: -vn, x: b.x, y: b.y, id: b.id });
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
    dx = b.x - a.x; dy = b.y - a.y; dz = b.z - a.z; const d = DMath.hypot(dx, dy, dz) || 1, nx = dx / d, ny = dy / d, nz = dz / d;
    const rel = rx * nx + ry * ny + rz * nz;
    if (rel < 0) {
      const jn = -(1 + E_BALL) / 2 * rel;
      a.vx -= jn * nx; a.vy -= jn * ny; a.vz -= jn * nz; b.vx += jn * nx; b.vy += jn * ny; b.vz += jn * nz;
      for (const q of [a, b]) if (q.z <= 0 && q.vz < 0) q.vz = 0;
      if (i === w.cue || j === w.cue) { const o = i === w.cue ? j : i, c = w.balls[w.cue]; if (!w.ev.at) w.ev.at = [c.x, c.y, c.z, o]; if (w.ev.firstHit == null) w.ev.firstHit = o; if (w.ev.hits.indexOf(o) < 0) w.ev.hits.push(o); }
      if (w.snd && -rel > 0.03) w.snd.push({ t: 'ball', v: -rel, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, ia: a.id, ib: b.id });
    }
    for (const q of [a, b]) { q.x += q.vx * tau; q.y += q.vy * tau; q.z = Math.max(0, q.z + q.vz * tau); }
  }
  /* Balls on the cloth meeting balls on the cloth. The meetings are taken in the order they happened (each pair, found a
     little way into each other, is taken back to the instant it touched), and meetings that happened at the same instant
     - a ball struck square between two that touch, a rack - are settled TOGETHER: one set of blows, worked out at once
     (projected Jacobi on the contacts, each blow giving the pair back e of its closing speed and none pulling), so that no
     ball is served first because of its number. Then whatever those blows set closing next (the next row of a rack) is
     the next instant, and so on until nothing is closing. It used to go pair by pair in the balls' order, and two balls
     side by side came off at 2.36 and 1.19 m/s, and the other way round when their numbers were swapped. */
  const SIM_EPS = 1e-7;                                         // touches this close in time (s) count as one instant
  let overlapSeen = false;                                      // (set by contacts: some pair is pressed into another)
  function contacts(w, bs, n, h) {
    const out = []; overlapSeen = false;
    for (let i = 0; i < n; i++) {
      const a = bs[i]; if (!a.on || a.z !== 0 || a.vz !== 0) continue;
      for (let j = i + 1; j < n; j++) {
        const b = bs[j]; if (!b.on || b.z !== 0 || b.vz !== 0) continue;
        const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
        if (d2 >= 4 * R * R + 1e-12 || d2 < 1e-14) continue;
        if (d2 < 4 * R * R - 1e-12) overlapSeen = true;
        const rvx = b.vx - a.vx, rvy = b.vy - a.vy, vv = rvx * rvx + rvy * rvy, dv = dx * rvx + dy * rvy;
        if (dv >= -1e-12 || vv < 1e-12) continue;                  // not closing
        const tau = d2 < 4 * R * R ? Math.max(0, Math.min(h, (dv + Math.sqrt(dv * dv + vv * (4 * R * R - d2))) / vv)) : 0;
        out.push({ i, j, tau });
      }
    }
    return out;
  }
  function collideGround(w, bs, n, h) {
    const cue = w.cue;
    for (let round = 0; round < 64; round++) {
      const all = contacts(w, bs, n, h); if (!all.length) break;
      let T = 0; for (const c of all) if (c.tau > T) T = c.tau;
      const group = all.filter(c => c.tau >= T - SIM_EPS);
      const inv = new Set(); for (const c of group) { inv.add(c.i); inv.add(c.j); }
      // back to the instant they touched
      for (const k of inv) { const q = bs[k]; q.x -= q.vx * T; q.y -= q.vy * T; }
      const deg = new Map(); for (const k of inv) deg.set(k, 0); for (const c of group) { deg.set(c.i, deg.get(c.i) + 1); deg.set(c.j, deg.get(c.j) + 1); }
      for (const c of group) {
        const a = bs[c.i], b = bs[c.j], dx = b.x - a.x, dy = b.y - a.y, d = DMath.hypot(dx, dy) || 1;
        c.nx = dx / d; c.ny = dy / d; c.rel0 = (b.vx - a.vx) * c.nx + (b.vy - a.vy) * c.ny;
        c.target = c.rel0 < 0 ? -E_BALL * c.rel0 : 0; c.lam = 0; c.w = 1 / Math.max(deg.get(c.i), deg.get(c.j));
      }
      // the blows, all from the same state each pass, until they agree
      for (let it = 0; it < 200; it++) {
        let moved = 0; const dv = new Map(); for (const k of inv) dv.set(k, [0, 0]);
        for (const c of group) {
          const a = bs[c.i], b = bs[c.j], rel = (b.vx - a.vx) * c.nx + (b.vy - a.vy) * c.ny;
          const nl = Math.max(0, c.lam + c.w * (c.target - rel) / 2), d = nl - c.lam; c.lam = nl;
          if (d !== 0) { const ai = dv.get(c.i), bj = dv.get(c.j); ai[0] -= d * c.nx; ai[1] -= d * c.ny; bj[0] += d * c.nx; bj[1] += d * c.ny; if (Math.abs(d) > moved) moved = Math.abs(d); }
        }
        for (const [k, v] of dv) { bs[k].vx += v[0]; bs[k].vy += v[1]; }
        if (moved < 1e-10) break;
      }
      // the record of the shot: what the cue ball met (two met at once: the lower number counts as the first, for the rules)
      const met = group.filter(c => (c.i === cue || c.j === cue) && c.lam > 0).map(c => c.i === cue ? c.j : c.i).sort((x, y) => x - y);
      if (met.length) {
        const c = bs[cue]; if (!w.ev.at) w.ev.at = [c.x, c.y, 0, met[0]];
        if (w.ev.firstHit == null) w.ev.firstHit = met[0];
        for (const o of met) if (w.ev.hits.indexOf(o) < 0) w.ev.hits.push(o);
      }
      if (w.snd) for (const c of group) if (-c.rel0 > 0.03 && c.lam > 0) { const a = bs[c.i], b = bs[c.j]; w.snd.push({ t: 'ball', v: -c.rel0, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, ia: a.id, ib: b.id }); }
      // and on from that instant with the new speeds
      for (const k of inv) { const q = bs[k]; q.x += q.vx * T; q.y += q.vy * T; }
    }
    // Overlaps left over (balls pressed together, a ball placed in contact): pushed apart the same way, all pairs at once.
    if (!overlapSeen) return;
    for (let it = 0; it < 8; it++) {
      const push = new Map(); let any = false;
      for (let i = 0; i < n; i++) {
        const a = bs[i]; if (!a.on || a.z !== 0) continue;
        for (let j = i + 1; j < n; j++) {
          const b = bs[j]; if (!b.on || b.z !== 0) continue;
          const dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
          if (d2 >= 4 * R * R - 1e-12 || d2 < 1e-14) continue;
          const d = Math.sqrt(d2), ov = (2 * R - d) / 2, nx = dx / d, ny = dy / d; any = true;
          const pa = push.get(i) || [0, 0], pb = push.get(j) || [0, 0]; pa[0] -= nx * ov; pa[1] -= ny * ov; pb[0] += nx * ov; pb[1] += ny * ov; push.set(i, pa); push.set(j, pb);
        }
      }
      if (!any) break;
      for (const [k, p] of push) { bs[k].x += p[0]; bs[k].y += p[1]; }
    }
  }
  /* The trace (only when something has asked for one, as the chalk trail does: w.trace = { p: [], k: [] }): the cue ball's
     way at every step, p as x, y pairs, and k the turns it took - where, its way in and out, and the face's outward line
     when that was a cushion (n), none when it was a ball. It only watches: nothing here changes how a shot runs. */
  let TR_N = null;
  function traceSub(w, c, vx, vy) {
    const T = w.trace; T.p.push(c.x, c.y);
    const si = DMath.hypot(vx, vy), so = DMath.hypot(c.vx, c.vy);
    if (si > 0.02 && so > 0.005) {
      const ix = vx / si, iy = vy / si, ox = c.vx / so, oy = c.vy / so;
      if (ix * ox + iy * oy < 0.995) T.k.push({ x: c.x, y: c.y, din: [ix, iy], dout: [ox, oy], n: TR_N });
    }
    TR_N = null;
  }
  function sub(w, h) {
    SUBH = h;
    const bs = w.balls, n = bs.length;
    for (let i = 0; i < n; i++) if (bs[i].on) motion(w, bs[i], h);
    const tc = w.trace && bs[w.cue].on ? bs[w.cue] : null, tvx = tc ? tc.vx : 0, tvy = tc ? tc.vy : 0;
    // a ball off the cloth meeting another: the three-dimensional blow, pair by pair (rare, and never two at once)
    for (let i = 0; i < n; i++) {
      const a = bs[i]; if (!a.on) continue;
      for (let j = i + 1; j < n; j++) {
        const b = bs[j]; if (!b.on) continue;
        if (a.z === 0 && b.z === 0 && a.vz === 0 && b.vz === 0) continue;
        const dx = b.x - a.x, dy = b.y - a.y; if (dx * dx + dy * dy >= 4 * R * R) continue;
        hitAir(w, a, b, i, j, h);
      }
    }
    collideGround(w, bs, n, h);
    // the barricades: as the cushions below, the face met first first; a ball above a block's top goes over it
    if (w.walls.length) for (let i = 0; i < n; i++) {
      const b = bs[i]; if (!b.on || (b.vx === 0 && b.vy === 0)) continue;
      ON_WALL = true;
      for (let pass = 0; pass < 4; pass++) {
        let best = null, bt = -1;
        for (const q of w.walls) {
          if (b.z > q.h || Math.abs(b.x - q.x) > q.reach || Math.abs(b.y - q.y) > q.reach) continue;
          for (const f of q.faces) { const t = segTime(b, f); if (t > bt) { bt = t; best = f; } }
        }
        if (!best) break;
        hitSeg(w, b, best);
      }
      ON_WALL = false;
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
        // A ball drops once its centre is far enough over the hole. (A fast ball used to have to get deeper first, the
        // drop zone shrinking with pace; together with the spit below that turned hard but well-aimed balls coming in at
        // an angle away - the window of a corner pocket 30 degrees off the diagonal fell from 6.8 to 3.3 cm at full pace,
        // and the lost shots came back as scattered rattle-ins. Now the pocket's own shape decides: a hard ball that is
        // not centred still meets the jaws or the back of the pocket, and can still be spat out.)
        const tight = 1;
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
    if (tc) traceSub(w, tc, tvx, tvy);
  }

  function step(w, dt) {
    let vmax = 0;
    for (const b of w.balls) if (b.on) { b.px = b.x; b.py = b.y; b.pz = b.z; const s = DMath.hypot(b.vx, b.vy); if (s > vmax) vmax = s; }
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

  /* The shot played out on a copy, for the aiming guide: the guide draws what this returns and nothing else, so what is shown
     is what the same inputs will do. pre: the cue ball's path up to its first contact; at: where it was then ([x, y, z, ball
     or -1]); post: its path afterwards, for `after` seconds; turn: where in post it next changed course; obj: the struck
     ball's line - from (x0, y0) along (dx, dy), running straight as far as (x1, y1); objPath: the struck ball's whole way,
     for as long as the preview runs. */
  function preview(w, ang, V, a, bb, el, after) {
    const w2 = clone(w); strike(w2, ang, V, a, bb, el);
    const c = w2.balls[w2.cue], out = { pre: [c.x, c.y, 0], at: null, hit: null, post: [], turn: -1, obj: null, objPath: [] };
    let t = 0, tc = 0, o = null, oGo = false, ldx = 0, ldy = 0, cdx = 0, cdy = 0;
    while (t < 9 + (after || 0) && c.on) {
      const lx = c.x, ly = c.y;
      step(w2, 1 / 120); t += 1 / 120;
      if (!out.at) {
        if (!w2.ev.at) { out.pre.push(c.x, c.y, c.z); if (c.vx === 0 && c.vy === 0 && c.z === 0 && c.vz === 0) break; continue; }
        out.at = w2.ev.at; tc = t;
        if (out.at[3] >= 0) {
          out.hit = out.at[3]; o = w2.balls[out.hit]; const s = DMath.hypot(o.vx, o.vy), b0 = w.balls[out.hit];
          if (s > 1e-6) { out.obj = { x0: b0.x, y0: b0.y, dx: o.vx / s, dy: o.vy / s, x1: o.x, y1: o.y }; ldx = o.vx / s; ldy = o.vy / s; oGo = true; out.objPath.push(b0.x, b0.y, 0, o.x, o.y, o.z); }
        }
        out.post.push(out.at[0], out.at[1], out.at[2], c.x, c.y, c.z);
      } else {
        out.post.push(c.x, c.y, c.z);
        if (out.turn < 0) {
          const mx = c.x - lx, my = c.y - ly, ml = DMath.hypot(mx, my);
          if (ml < 1e-7) out.turn = out.post.length - 3;
          else { if ((cdx || cdy) && (mx * cdx + my * cdy) / ml < 0.9994) out.turn = out.post.length - 6; cdx = mx / ml; cdy = my / ml; }
        }
        if (o && o.on && (o.vx || o.vy || o.vz)) out.objPath.push(o.x, o.y, o.z);
        if (oGo) {
          const s = DMath.hypot(o.vx, o.vy);
          if (!o.on || s < 1e-6 || (o.vx * ldx + o.vy * ldy) / s < 0.9994) oGo = false;   // potted, stopped, or knocked off its line
          else { out.obj.x1 = o.x; out.obj.y1 = o.y; ldx = o.vx / s; ldy = o.vy / s; }
        }
      }
      const still = c.vx === 0 && c.vy === 0 && c.z === 0 && c.vz === 0;
      if (t - tc > (after || 0.6) || (still && !oGo && !(o && o.on && (o.vx || o.vy)))) break;
    }
    if (out.turn < 0) out.turn = Math.max(0, out.post.length - 3);
    return out;
  }

  function pathClear(w, x0, y0, x1, y1, skip, rad) {
    const len = DMath.hypot(x1 - x0, y1 - y0); if (len < 1e-9) return true;
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
      const a = k * Math.PI / 12, px = x + DMath.cos(a) * r, py = y + DMath.sin(a) * r;
      if (isFree(w, px, py, skipId)) return [px, py];
    }
    return [x, y];
  }

  // how high (metres) a ball struck at speed V with the cue raised by el leaves the cloth; 0 when it stays down
  const hop = (V, el) => { const up = lift(V, el || 0); return up > 0 ? up * up / (2 * G) : 0; };
  return { hop, restEl, R, HL, HW, CW, PO, SO, CM, SM, POCKETED, POCKETS, CUSHIONS, SEGS, makeWorld, walls, clone, place, strike, step, rest, run, cast, preview, pathClear, isFree, findFree, newEv };
}
if (typeof module !== 'undefined') { module.exports = createPhysics; module.exports.DMath = DMath; module.exports.PHYS_V = PHYS_V; }
