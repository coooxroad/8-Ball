  /* aiming guide, drawn at ball-centre height so it lines up under perspective */
  const guide = new THREE.Group(); scene.add(guide);
  const gMat = o => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: o, depthTest: false, depthWrite: false, toneMapped: false });
  const gRing = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 40), gMat(0.95));
  const gHand = new THREE.Mesh(new THREE.RingGeometry(1.55, 1.78, 40), new THREE.MeshBasicMaterial({ color: col(0xffd21f), transparent: true, opacity: 0.95, depthTest: false, depthWrite: false, toneMapped: false }));
  for (const m of [gRing, gHand]) { m.renderOrder = 10; guide.add(m); }
  /* The guide draws each path as a ribbon that follows it - bending where the ball bends, wider where it flies, fading
     towards its end: a line, or (rails) a band as wide as the ball with bright edges and faint arrowheads along it. */
  const RIB_MAX = 1200;
  const ribVS = 'attribute float a; attribute float s; attribute float e; varying float va; varying float vs; varying float ve;' +
    'void main() { va = a; vs = s; ve = e; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  const ribFS = 'uniform vec3 col; uniform float op; uniform float mode; uniform float per; uniform float on; uniform float hw; uniform float ch;' +
    'varying float va; varying float vs; varying float ve;' +
    'void main() { float k = 1.0 - smoothstep(0.55, 1.0, abs(ve));' +
    ' if (mode > 2.5) { float q = abs(ve); k = max(0.13, smoothstep(1.0 - 2.0 * on, 1.0 - on, q)) * (1.0 - smoothstep(1.0 - 0.35 * on, 1.0, q));' +
    '   float u = abs(mod(vs + q * hw * 0.9, per) - 0.5 * per); k = max(k, ch * (1.0 - smoothstep(0.0025, 0.004, u)) * (1.0 - smoothstep(0.7, 0.85, q))); }' +
    ' gl_FragColor = vec4(col, va * op * k); }';
  function makeRibbon() {
    const g = new THREE.BufferGeometry(), e = new Float32Array(RIB_MAX * 2), idx = [];
    for (let i = 0; i < RIB_MAX - 1; i++) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    for (let i = 0; i < RIB_MAX; i++) { e[2 * i] = -1; e[2 * i + 1] = 1; }
    g.setIndex(idx); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RIB_MAX * 6), 3));
    g.setAttribute('a', new THREE.BufferAttribute(new Float32Array(RIB_MAX * 2), 1)); g.setAttribute('s', new THREE.BufferAttribute(new Float32Array(RIB_MAX * 2), 1)); g.setAttribute('e', new THREE.BufferAttribute(e, 1));
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: { col: { value: new THREE.Color(1, 1, 1) }, op: { value: 1 }, mode: { value: 0 }, per: { value: 0.05 }, on: { value: 0.02 }, hw: { value: 0.002 }, ch: { value: 0 } },
      vertexShader: ribVS, fragmentShader: ribFS, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
    m.frustumCulled = false; m.renderOrder = 10; m.visible = false; guide.add(m); return m;
  }
  const rPre = makeRibbon(), rObj = makeRibbon(), rPost = makeRibbon(), RIBS = [rPre, rObj, rPost];
  // The cue ball's trail (내 장비 · 트레일): where it has been in the last moment, as a ribbon fading behind it.
  const rTrail = makeRibbon(); scene.add(rTrail); rTrail.renderOrder = 2; rTrail.material.depthTest = true;
  let trail = null, trailT = 0; const trailPts = [];
  function setTrail(id) { const t = TRAILS.find(x => x.id === id); trail = t && t.color ? t : null; trailPts.length = 0; rTrail.visible = false; }
  function trailTick(c, R, dt) {
    trailT += dt;
    if (trail && c && c.on && !c.z) {
      const l = trailPts.length;
      if (!l || Math.hypot(c.x - trailPts[l - 1].x, c.y - trailPts[l - 1].y) > 0.006) trailPts.push({ x: c.x, y: c.y, t: trailT });
    }
    while (trailPts.length && trailT - trailPts[0].t > 0.9) trailPts.shift();
    if (!trail || trailPts.length < 2) { rTrail.visible = false; return false; }
    const pts = []; for (const p of trailPts) pts.push(p.x, p.y, -R + 0.0015);
    pts.push(c.x, c.y, -R + 0.0015);
    const color = trail.color === 'rainbow' ? new THREE.Color().setHSL((trailT * 0.35) % 1, 0.9, 0.58).getHex() : trail.color;
    ribbon(rTrail, pts, { m: R * 1.6, color, op: trail.id === 'chalk' ? 0.5 : 0.9, alpha: t => t * t }, R);
    return true;
  }
  const gDisc = new THREE.Mesh(new THREE.CircleGeometry(1, 40), gMat(0.3)); gDisc.renderOrder = 10; gDisc.visible = false; guide.add(gDisc);
  // pts: [x, y, height above the cloth, ...]. o: px (width on screen) or m (width in metres), color, op, alpha(t along 0..1,
  // height), mode (0 a line, 3 a band with bright edges), ch (how strongly the band's arrowheads show)
  function ribbon(m, pts, o, R) {
    const xs = [], ys = [], zs = [];
    for (let i = 0; i < pts.length; i += 3) {
      const n = xs.length;
      if (n && i < pts.length - 3 && Math.hypot(pts[i] - xs[n - 1], pts[i + 1] - ys[n - 1]) < 0.004) continue;
      if (n >= RIB_MAX) break; xs.push(pts[i]); ys.push(pts[i + 1]); zs.push(pts[i + 2]);
    }
    const n = xs.length; if (n < 2) { m.visible = false; return; }
    let L = 0; for (let i = 1; i < n; i++) L += Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
    if (L < 0.004) { m.visible = false; return; }
    const g = m.geometry, P = g.attributes.position.array, A = g.attributes.a.array, S = g.attributes.s.array, hw = o.m ? o.m / 2 : o.px / ppm / 2;
    let s = 0;
    for (let i = 0; i < n; i++) {
      if (i) s += Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
      const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1); let tx = xs[i1] - xs[i0], ty = ys[i1] - ys[i0]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
      // seen from above, height does not show: so a path in the air is drawn wider the higher it is
      const h = zs[i], z = R + h, al = o.alpha ? Math.max(0, o.alpha(s / L, h)) : 1, w = hw * (1 + h * (o.m ? 8 : 30));
      P.set([xs[i] + ty * w, ys[i] - tx * w, z, xs[i] - ty * w, ys[i] + tx * w, z], i * 6);
      A[2 * i] = A[2 * i + 1] = al; S[2 * i] = S[2 * i + 1] = s;
    }
    g.attributes.position.needsUpdate = g.attributes.a.needsUpdate = g.attributes.s.needsUpdate = true;
    g.setDrawRange(0, (n - 1) * 6);
    const u = m.material.uniforms; u.col.value.setHex(o.color); u.op.value = o.op == null ? 1 : o.op; u.mode.value = o.mode || 0; u.per.value = o.per || 0.05; u.on.value = Math.min(0.5, 1.4 / ppm / hw); u.hw.value = hw; u.ch.value = o.ch || 0;
    m.visible = true;
  }
  // a copy of the path with `a` metres taken off its start and `b` off its end
  function trimPath(pts, a, b) {
    let L = 0; for (let i = 3; i < pts.length; i += 3) L += Math.hypot(pts[i] - pts[i - 3], pts[i + 1] - pts[i - 2]);
    const from = a, to = L - b, out = []; if (to <= from) return out;
    let s = 0;
    for (let i = 0; i < pts.length; i += 3) {
      const d = i ? Math.hypot(pts[i] - pts[i - 3], pts[i + 1] - pts[i - 2]) : 0, s0 = s; s += d;
      const at = (q) => { const f = d ? (q - s0) / d : 0; out.push(pts[i - 3] + (pts[i] - pts[i - 3]) * f, pts[i - 2] + (pts[i + 1] - pts[i - 2]) * f, pts[i - 1] + (pts[i + 2] - pts[i - 1]) * f); };
      if (i && s0 < from && s >= from) at(from);
      if ((s > from || (!i && from <= 0)) && s < to) out.push(pts[i], pts[i + 1], pts[i + 2]);   // (nothing taken off the start: the start itself)
      if (i && s0 < to && s >= to) { at(to); break; }
    }
    return out;
  }
  // length of a path, and the path cut off at `len` metres along it
  const pathLen = pts => { let L = 0; for (let i = 3; i < pts.length; i += 3) L += Math.hypot(pts[i] - pts[i - 3], pts[i + 1] - pts[i - 2]); return L; };
  const cutPath = (pts, len) => trimPath(pts, 0, Math.max(0, pathLen(pts) - len));
  /* How much is shown for a guide length g (0 off .. 1 everything). Up to the first thing the cue ball touches, the way is
     always the one it will really take. After that:
     - up to "보통" (g below SIM), only what one would expect, the old way: a short straight line each, the object ball along
       the line of centres and the cue ball along the tangent (or, off a cushion, straight back off it as from a mirror) -
       growing from nothing at a quarter to full at a half. What spin and the cloth will make of it is the player's to judge.
     - from "길게" on, the paths as they will really go: from the stub, through the first stretch (at three quarters) to the
       whole way (at 1). */
  const SIM = 0.63;
  const grow = g => g < 0.25 ? 0 : Math.min(1, (g - 0.25) / 0.25);
  const reach = (g, stub, first, whole) => g <= 0.75 ? stub + (first - stub) * (g - SIM) / (0.75 - SIM) : first + (whole - first) * (g - 0.75) / 0.25;
  const line = (x, y, z, dx, dy, len) => [x, y, z, x + dx * len, y + dy * len, z];
  // the colour a ball's path is drawn in: the ball's own, lifted a little towards white so that a dark ball still shows
  const lift = (h, k) => { const r = h >> 16 & 255, g = h >> 8 & 255, b = h & 255; return Math.round(r + (255 - r) * k) << 16 | Math.round(g + (255 - g) * k) << 8 | Math.round(b + (255 - b) * k); };
  const pathCol = (table, id) => lift(table === 'carom' ? [0xf4efe2, 0xf4c20d, 0xd3241c, 0xd3241c][id] : id === 0 ? 0xf4efe2 : ballHex(id), 0.22);
  // practice target: where the cue ball should come to rest
  const zone = new THREE.Group(); zone.visible = false; scene.add(zone);
  zone.add(new THREE.Mesh(new THREE.CircleGeometry(1, 56), new THREE.MeshBasicMaterial({ color: col(0xffd21f), transparent: true, opacity: 0.16, depthWrite: false, toneMapped: false })));
  zone.add(new THREE.Mesh(new THREE.RingGeometry(0.955, 1, 56), new THREE.MeshBasicMaterial({ color: col(0xffd21f), transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false })));
  zone.children.forEach(m => { m.renderOrder = 2; });
  function setZone(z) { zone.visible = !!z; if (z) { zone.position.set(z.x, z.y, 0.0012); zone.scale.set(z.r, z.r, 1); } dirty = 3; }
  // hint marks: numbered spots where the cue ball will touch something, in order
  const marks = new THREE.Group(); scene.add(marks);
  const markTex = n => { const c = mkCanvas(96, 96), g = c.getContext('2d'); g.beginPath(); g.arc(48, 48, 42, 0, 6.3); g.fillStyle = '#ffd21f'; g.fill(); g.lineWidth = 7; g.strokeStyle = '#15171c'; g.stroke();
    g.fillStyle = '#15171c'; g.font = '800 54px Outfit, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 48, 52); return tex(c); };
  function setMarks(list) {
    while (marks.children.length) { const m = marks.children.pop(); m.material.map.dispose(); m.material.dispose(); }
    (list || []).forEach((q, i) => { const m = new THREE.Mesh(unitPlane, new THREE.MeshBasicMaterial({ map: markTex(i + 1), transparent: true, depthTest: false, depthWrite: false, toneMapped: false })); m.renderOrder = 11; m.position.set(q.x, q.y, cur.R * 1.1); m.scale.set(cur.R * 1.7, cur.R * 1.7, 1); marks.add(m); });
    dirty = 3;
  }
  let ppm = 200, guideKey = '';

