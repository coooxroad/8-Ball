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
function createPhysics(cfg) {
  const R = cfg.R, RB = R, POCKETED = !!cfg.pockets;
  const HL = cfg.HL || 1.27, HW = cfg.HW || 0.635, G = 9.8;
  /* One deterministic contact model for play, preview and server verification. Resolve impulses and their torques
     together before tuning optional cue deflection or ball/ball throw. Never compensate for a missing contact by
     drawing a different path or assigning a jump from the cue angle. Side decay is a cloth torque, not distance loss. */
  const MU_S0 = 0.2, MU_R0 = 0.016, MU_SP0 = 0.01, E_BALL = 0.96;
  // The contact model is solved with friction first. These two policy controls are applied only at their source:
  // cue deflection at launch, and tangential ball/ball impulses. They never change cushion or cloth friction.
  const effects = Object.freeze({ squirt: cfg.squirt == null ? 1 : Math.max(0, Math.min(1, cfg.squirt)),
    throw: cfg.throw == null ? 1 : Math.max(0, Math.min(1, cfg.throw)) });
  const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len3 = a => Math.sqrt(dot3(a, a));
  const invI = 2.5 / (R * R);
  function pointVelocity(b, r) {
    return [b.vx + b.wy * r[2] - b.wz * r[1], b.vy + b.wz * r[0] - b.wx * r[2], b.vz + b.wx * r[1] - b.wy * r[0]];
  }
  // Every rigid sphere contact uses this solver: ball/ball, rubber nose and supporting bed. Normal reaction and
  // Coulomb friction are solved together, so a support impulse cannot be added after a rebound was already chosen.
  // Jacobi passes read one state and apply all changes together, preserving simultaneous-contact symmetry.
  function solveContacts(bs, contacts) {
    const degree = new Uint8Array(bs.length), changes = new Float64Array(bs.length * 6);
    for (const c of contacts) { degree[c.i]++; if (c.j >= 0) degree[c.j]++; }
    for (const c of contacts) {
      const a = pointVelocity(bs[c.i], c.r), b = c.j >= 0 ? pointVelocity(bs[c.j], c.rb) : [0, 0, 0];
      const vn = (a[0] - b[0]) * c.n[0] + (a[1] - b[1]) * c.n[1] + (a[2] - b[2]) * c.n[2];
      c.target = -c.e * Math.min(0, vn); c.lam = c.tx = c.ty = c.tz = 0;
      c.k = c.j >= 0 ? 2 : 1; c.weight = 0.9 / Math.max(degree[c.i], c.j >= 0 ? degree[c.j] : 1);
    }
    for (let it = 0; it < 240; it++) {
      changes.fill(0); let largest = 0;
      for (const c of contacts) {
        const a = bs[c.i], r = c.r, n = c.n;
        let ux = a.vx + a.wy * r[2] - a.wz * r[1], uy = a.vy + a.wz * r[0] - a.wx * r[2], uz = a.vz + a.wx * r[1] - a.wy * r[0];
        if (c.j >= 0) { const b = bs[c.j], q = c.rb; ux -= b.vx + b.wy * q[2] - b.wz * q[1]; uy -= b.vy + b.wz * q[0] - b.wx * q[2]; uz -= b.vz + b.wx * q[1] - b.wy * q[0]; }
        const vn = ux * n[0] + uy * n[1] + uz * n[2], next = Math.max(0, c.lam + c.weight * (c.target - vn) / c.k), dn = next - c.lam; c.lam = next;
        let tx = c.tx - c.weight * (ux - vn * n[0]) / (3.5 * c.k),
          ty = c.ty - c.weight * (uy - vn * n[1]) / (3.5 * c.k), tz = c.tz - c.weight * (uz - vn * n[2]) / (3.5 * c.k);
        const size = Math.sqrt(tx * tx + ty * ty + tz * tz), limit = c.mu * next;
        if (size > limit) { const scale = limit / size; tx *= scale; ty *= scale; tz *= scale; }
        const jx = dn * n[0] + tx - c.tx, jy = dn * n[1] + ty - c.ty, jz = dn * n[2] + tz - c.tz;
        largest = Math.max(largest, Math.abs(dn), Math.abs(tx - c.tx), Math.abs(ty - c.ty), Math.abs(tz - c.tz)); c.tx = tx; c.ty = ty; c.tz = tz;
        let k = c.i * 6; changes[k] += jx; changes[k + 1] += jy; changes[k + 2] += jz;
        changes[k + 3] += invI * (r[1] * jz - r[2] * jy); changes[k + 4] += invI * (r[2] * jx - r[0] * jz); changes[k + 5] += invI * (r[0] * jy - r[1] * jx);
        if (c.j >= 0) { const q = c.rb; k = c.j * 6; changes[k] -= jx; changes[k + 1] -= jy; changes[k + 2] -= jz;
          changes[k + 3] -= invI * (q[1] * jz - q[2] * jy); changes[k + 4] -= invI * (q[2] * jx - q[0] * jz); changes[k + 5] -= invI * (q[0] * jy - q[1] * jx); }
      }
      for (let i = 0; i < bs.length; i++) if (degree[i]) { const b = bs[i], k = i * 6;
        b.vx += changes[k]; b.vy += changes[k + 1]; b.vz += changes[k + 2]; b.wx += changes[k + 3]; b.wy += changes[k + 4]; b.wz += changes[k + 5]; }
      if (largest < 1e-10) break;
    }
    // Remove the remaining solver tolerance at a supporting plane, so -1e-20 m/s cannot keep a grounded ball moving.
    for (const c of contacts) if (c.j < 0 && c.e === 0 && c.n[2] === 1 && bs[c.i].z === 0 && bs[c.i].vz < 0) bs[c.i].vz = 0;
  }
  const bedContact = (i, mu) => ({ i, j: -1, n: [0, 0, 1], r: [0, 0, -R], e: 0, mu });
  function surfaceImpulse(b, r, n, restitution, friction) {
    if (dot3(pointVelocity(b, r), n) >= 0) return 0;
    const c = { i: 0, j: -1, r, n, e: restitution, mu: friction }; solveContacts([b], [c]); return c.lam;
  }
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

  // Contact coordinates are in the plane perpendicular to the cue. The same surface point is used by the impulse
  // calculation and by the drawn cue, including at 90 degrees (where a vertical screen offset becomes horizontal).
  function cueContact(ang, a, bb, el) {
    const ca = DMath.cos(ang), sa = DMath.sin(ang), ce = DMath.cos(el), se = DMath.sin(el);
    const m = DMath.hypot(a, bb), scale = m > 0.6 ? 0.6 / m : 1; a *= scale; bb *= scale;
    const along = Math.sqrt(Math.max(0, 1 - a * a - bb * bb));
    const axis = [ca * ce, sa * ce, -se];
    const point = [R * (sa * a + ca * se * bb - ca * ce * along),
      R * (-ca * a + sa * se * bb - sa * ce * along), R * (ce * bb + se * along)];
    return { point, axis, a, b: bb };
  }
  const restEl = () => 0;
  const launchCache = new Map();
  // Resolve the short tip/ball/bed contact before free flight. Unlike an assigned jump velocity, the compliant bed
  // cannot launch the ball through a tip which is still above it: the tip has finite mass and receives the reaction.
  // This is a lumped contact approximation, not a flexible shaft or cloth simulation. Millisecond displacements are
  // collapsed to the impact point; other balls are resolved by the world's continuous collision solver afterwards.
  function contactLaunch(V, a, bb, el, withBed) {
    const geo = cueContact(0, a, bb, el), d = geo.axis, tipR = 0.006;
    if (V === 0) return { velocity: [0, 0, 0], spin: [0, 0, 0], height: 0, tip: geo.point.slice(), tipVelocity: [0, 0, 0], duration: 0, contacts: 0, contact: geo };
    const mass = 1700 * (4 / 3) * Math.PI * R * R * R, cueMass = 0.55 / mass, endMass = 0.01 / mass;
    const p = [0, 0, 0], v = [0, 0, 0], omega = [0, 0, 0], tip = geo.point.map(x => x * (R + tipR) / R);
    const u = d.map(x => x * V * (1 + 1 / cueMass) / 1.773);
    const h = 1 / 192000, stiffness = 1360000 / mass, bed = 1360000 / mass;
    const invEnd = 1 / endMass, axisInv = 1 / cueMass - invEnd;
    let touched = false, contacts = 0, touching = false, elapsed = 0;
    for (let step = 0; step < 2400; step++) {
      elapsed = (step + 1) * h;
      let fx = 0, fy = 0, fz = 0, tx = 0, ty = 0, tz = 0;
      const dx = p[0] - tip[0], dy = p[1] - tip[1], dz = p[2] - tip[2], distance = Math.sqrt(dx * dx + dy * dy + dz * dz), penetration = R + tipR - distance;
      if (penetration > 0 && distance > 1e-12) {
        if (!touching) contacts++; touching = touched = true;
        const nx = dx / distance, ny = dy / distance, nz = dz / distance, rx = -R * nx, ry = -R * ny, rz = -R * nz;
        const ux = v[0] + omega[1] * rz - omega[2] * ry - u[0],
          uy = v[1] + omega[2] * rx - omega[0] * rz - u[1], uz = v[2] + omega[0] * ry - omega[1] * rx - u[2];
        const vn = ux * nx + uy * ny + uz * nz, nd = nx * d[0] + ny * d[1] + nz * d[2];
        const eff = 1 + invEnd + nd * nd * axisInv;
        const fn = Math.max(0, stiffness * penetration - 0.18 * Math.sqrt(stiffness / eff) * vn);
        fx = nx * fn; fy = ny * fn; fz = nz * fn;
        const sx = ux - vn * nx, sy = uy - vn * ny, sz = uz - vn * nz, speed = Math.sqrt(sx * sx + sy * sy + sz * sz);
        if (speed > 1e-12) {
          const td = (sx * d[0] + sy * d[1] + sz * d[2]) / speed, kt = 3.5 + invEnd + td * td * axisInv;
          const ft = Math.min(0.7 * fn, speed / (h * kt)) / speed;
          fx -= ft * sx; fy -= ft * sy; fz -= ft * sz;
        }
        tx = ry * fz - rz * fy; ty = rz * fx - rx * fz; tz = rx * fy - ry * fx;
      } else touching = false;
      let floorX = 0, floorY = 0, floorZ = 0;
      if (withBed && p[2] < 0) {
        floorZ = Math.max(0, -bed * p[2] - 1.2 * Math.sqrt(bed) * v[2]);
        const sx = v[0] - R * omega[1], sy = v[1] + R * omega[0], speed = Math.sqrt(sx * sx + sy * sy);
        if (speed > 1e-12) { const ft = Math.min(MU_S0 * floorZ, speed / (3.5 * h)) / speed; floorX = -ft * sx; floorY = -ft * sy; }
        tx += R * floorY; ty -= R * floorX;
      }
      const axial = fx * d[0] + fy * d[1] + fz * d[2];
      v[0] += (fx + floorX) * h; v[1] += (fy + floorY) * h; v[2] += (fz + floorZ) * h;
      omega[0] += tx * invI * h; omega[1] += ty * invI * h; omega[2] += tz * invI * h;
      u[0] -= (fx * invEnd + d[0] * axial * axisInv) * h;
      u[1] -= (fy * invEnd + d[1] * axial * axisInv) * h;
      u[2] -= (fz * invEnd + d[2] * axial * axisInv) * h;
      for (let i = 0; i < 3; i++) { p[i] += v[i] * h; tip[i] += u[i] * h; }
      if (touched && penetration < -0.00001 && (!withBed || p[2] >= 0) && step > 30) break;
    }
    // Launch policy is isolated here, after the physical contact. Rotating velocity preserves kinetic energy; it
    // removes only lateral cue deflection, not the massé spin or the subsequent cloth/cushion response.
    return { velocity: v, spin: omega, height: withBed ? Math.max(0, p[2]) : 0, tip, tipVelocity: u, duration: elapsed, contacts, contact: geo };
  }
  function launch(V, a, bb, el) {
    const key = [V, a, bb, el].join(','); if (launchCache.has(key)) return launchCache.get(key);
    const result = contactLaunch(V, a, bb, el, true);
    if (effects.squirt < 1) {
      // Measure deflection with the bed absent, so the correction cannot erase the sideways impulse of a massé.
      const free = contactLaunch(V, a, bb, el, false), speed = len3(free.velocity);
      if (speed > 1e-12) {
        let from = free.velocity.map(x => x / speed), to = free.contact.axis;
        if (el !== 0) { const m = DMath.hypot(from[0], from[1]), k = DMath.hypot(to[0], to[1]);
          if (m > 1e-8 && k > 1e-8) { from = [from[0] / m, from[1] / m, 0]; to = [to[0] / k, to[1] / k, 0]; } else to = from; }
        const target = from.map((x, i) => effects.squirt * x + (1 - effects.squirt) * to[i]), length = len3(target);
        if (length > 1e-12) {
          const unit = target.map(x => x / length), axis = cross3(from, unit), qw = 1 + dot3(from, unit), qlen = Math.sqrt(dot3(axis, axis) + qw * qw);
          if (qlen > 1e-12) { const q = axis.map(x => x / qlen), w = qw / qlen;
            for (const v of [result.velocity, result.spin]) { const c = cross3(q, v), cc = cross3(q, c); for (let i = 0; i < 3; i++) v[i] += 2 * (w * c[i] + cc[i]); }
          }
        }
      }
    }
    for (const v of [result.velocity, result.spin, result.tip, result.tipVelocity, result.contact.point, result.contact.axis]) Object.freeze(v);
    Object.freeze(result.contact); Object.freeze(result);
    if (launchCache.size >= 256) launchCache.delete(launchCache.keys().next().value); launchCache.set(key, result); return result;
  }
  function strike(w, ang, V, a, bb, el) {
    if (el == null) el = restEl(w, ang, bb);
    const shot = launch(Math.max(0, V), a || 0, bb || 0, el), c = w.balls[w.cue], ca = DMath.cos(ang), sa = DMath.sin(ang);
    c.vx = ca * shot.velocity[0] - sa * shot.velocity[1]; c.vy = sa * shot.velocity[0] + ca * shot.velocity[1]; c.vz = Math.max(0, shot.velocity[2]);
    c.wx = ca * shot.spin[0] - sa * shot.spin[1]; c.wy = sa * shot.spin[0] + ca * shot.spin[1]; c.wz = shot.spin[2]; c.z = shot.height;
    w.ev = newEv();
  }
  // A damping ratio of 0.6 in the unilateral bed contact gives about 0.25 restitution. Use the same cloth friction
  // and restitution on subsequent landings; changing from cue contact to flight must not change the material.
  const CREEP = 0.18, CLEAR = 0.034, MU_LAND = MU_S0, LAND = 0.03, E_LAND = 0.25;

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
    const dz = (2.5 * MU_SP * G / R) * h;
    if (Math.abs(b.wz) <= dz) b.wz = 0; else b.wz -= Math.sign(b.wz) * dz;
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
    // The rubber nose is above the centre of a grounded ball. Its impulse can change roll and sidespin; the bed then
    // absorbs downward travel with its own Coulomb impulse. Barricades have a vertical face, not a cushion nose.
    const height = ON_WALL ? 0 : Math.max(-0.8, Math.min(0.8, 0.4 - b.z / R));
    const horizontal = Math.sqrt(1 - height * height), n = [nx * horizontal, ny * horizontal, -height], r = n.map(x => -R * x);
    const e = POCKETED ? 0.8 : 0.84;
    const contacts = [{ i: 0, j: -1, r, n, e, mu: 0.14 }];
    if (b.z === 0) contacts.push(bedContact(0, w.ice ? 0.022 : MU_S0));
    solveContacts([b], contacts);
    if (b.z === 0 && b.vz < 0) b.vz = 0;
    if (w.trace && b.id === w.cue) TR_N = [nx, ny];
    if (ON_WALL) noteWall(w, b, vn); else noteRail(w, b, vn);
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

  /* All ball contacts, including airborne ones. The meetings are taken in the order they happened (each pair, found a
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
      const a = bs[i]; if (!a.on) continue;
      for (let j = i + 1; j < n; j++) {
        const b = bs[j]; if (!b.on) continue;
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= 4 * R * R + 1e-12 || d2 < 1e-14) continue;
        if (d2 < 4 * R * R - 1e-12) overlapSeen = true;
        const rvx = b.vx - a.vx, rvy = b.vy - a.vy, rvz = b.vz - a.vz, vv = rvx * rvx + rvy * rvy + rvz * rvz, dv = dx * rvx + dy * rvy + dz * rvz;
        if (dv >= -1e-12 || vv < 1e-12) continue;                  // not closing
        const tau = d2 < 4 * R * R ? Math.max(0, Math.min(h, (dv + Math.sqrt(dv * dv + vv * (4 * R * R - d2))) / vv)) : 0;
        out.push({ i, j, tau });
      }
    }
    return out;
  }
  function collideBalls(w, bs, n, h) {
    const cue = w.cue;
    for (let round = 0; round < 64; round++) {
      const all = contacts(w, bs, n, h); if (!all.length) break;
      let T = 0; for (const c of all) if (c.tau > T) T = c.tau;
      const group = all.filter(c => c.tau >= T - SIM_EPS);
      const inv = new Set(); for (const c of group) { inv.add(c.i); inv.add(c.j); }
      // back to the instant they touched
      for (const k of inv) { const q = bs[k]; q.x -= q.vx * T; q.y -= q.vy * T; q.z = Math.max(0, q.z - q.vz * T); }
      const groupContacts = [];
      for (const c of group) {
        const a = bs[c.i], b = bs[c.j], dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d = DMath.hypot(dx, dy, dz) || 1;
        c.nx = dx / d; c.ny = dy / d; c.nz = dz / d; c.rel0 = (b.vx - a.vx) * c.nx + (b.vy - a.vy) * c.ny + (b.vz - a.vz) * c.nz;
        c.n = [-c.nx, -c.ny, -c.nz]; c.r = [R * c.nx, R * c.ny, R * c.nz]; c.rb = c.r.map(x => -x);
        c.e = E_BALL; c.mu = 0.04 * effects.throw; groupContacts.push(c);
      }
      for (const k of inv) if (bs[k].z === 0) groupContacts.push(bedContact(k, w.ice ? 0.022 : MU_S0));
      solveContacts(bs, groupContacts);
      // the record of the shot: what the cue ball met (two met at once: the lower number counts as the first, for the rules)
      const met = group.filter(c => (c.i === cue || c.j === cue) && c.lam > 0).map(c => c.i === cue ? c.j : c.i).sort((x, y) => x - y);
      if (met.length) {
        const c = bs[cue]; if (!w.ev.at) w.ev.at = [c.x, c.y, c.z, met[0]];
        if (w.ev.firstHit == null) w.ev.firstHit = met[0];
        for (const o of met) if (w.ev.hits.indexOf(o) < 0) w.ev.hits.push(o);
      }
      if (w.snd) for (const c of group) if (-c.rel0 > 0.03 && c.lam > 0) { const a = bs[c.i], b = bs[c.j]; w.snd.push({ t: 'ball', v: -c.rel0, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, ia: a.id, ib: b.id }); }
      // and on from that instant with the new speeds
      for (const k of inv) { const q = bs[k]; if (q.z === 0 && q.vz < 0) surfaceImpulse(q, [0, 0, -R], [0, 0, 1], 0, MU_S0); q.x += q.vx * T; q.y += q.vy * T; q.z = Math.max(0, q.z + q.vz * T);
        if (q.z === 0 && q.vz < 0) surfaceImpulse(q, [0, 0, -R], [0, 0, 1], 0, MU_S0); }
    }
    // Overlaps left over (balls pressed together, a ball placed in contact): pushed apart the same way, all pairs at once.
    if (!overlapSeen) return;
    for (let it = 0; it < 8; it++) {
      const push = new Map(); let any = false;
      for (let i = 0; i < n; i++) {
        const a = bs[i]; if (!a.on) continue;
        for (let j = i + 1; j < n; j++) {
          const b = bs[j]; if (!b.on) continue;
          const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= 4 * R * R - 1e-12 || d2 < 1e-14) continue;
          const d = Math.sqrt(d2), ov = (2 * R - d) / 2, nx = dx / d, ny = dy / d, nz = dz / d; any = true;
          const pa = push.get(i) || [0, 0, 0], pb = push.get(j) || [0, 0, 0]; pa[0] -= nx * ov; pa[1] -= ny * ov; pa[2] -= nz * ov; pb[0] += nx * ov; pb[1] += ny * ov; pb[2] += nz * ov; push.set(i, pa); push.set(j, pb);
        }
      }
      if (!any) break;
      for (const [k, p] of push) { bs[k].x += p[0]; bs[k].y += p[1]; bs[k].z = Math.max(0, bs[k].z + p[2]); }
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
    collideBalls(w, bs, n, h);
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
    for (const b of w.balls) if (b.on) { b.px = b.x; b.py = b.y; b.pz = b.z; const s = DMath.hypot(b.vx, b.vy, b.vz); if (s > vmax) vmax = s; }
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
  const hop = (V, el, a, bb) => { const s = launch(V, a || 0, bb || 0, el || 0), up = Math.max(0, s.velocity[2]); return s.height + up * up / (2 * G); };
  return { hop, launch, cueContact, effects, restEl, R, HL, HW, CW, PO, SO, CM, SM, POCKETED, POCKETS, CUSHIONS, SEGS, makeWorld, walls, clone, place, strike, step, rest, run, cast, preview, pathClear, isFree, findFree, newEv };
}
if (typeof module !== 'undefined') { module.exports = createPhysics; module.exports.DMath = DMath; }
