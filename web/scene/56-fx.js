  /* The trails drawn in code (content/40-trails.js, kind): sparks and puffs that live a moment (particles: points the
     graphics card shapes itself - a soft dot, a four-point star, a cloud, a flame, a drop), rings that spread flat on the
     cloth, and marks left on the cloth until the next shot (the chalk trail's picture, scene/55-chalk.js). Every kind
     reads the physics' trace of the cue ball, so it follows the ball's real way and knows each cushion and ball it met.
       stars   sparkles along the way and a star at every turn; when the ball stops the stars are joined, a constellation
       puff    a comic puff of wind as it sets off, and little clouds behind it
       ink     a brush stroke: thick and wet where the ball went slowly, dry and split where it flew; a blot at each turn
       fire    flames behind it and a scorch on the cloth; sparks off the cushions
       splash  drops thrown up either side, rings spreading on the cloth, a burst at every cushion */
  const FX_SHAPES = { dot: 0, star: 1, puff: 2, flame: 3, drop: 4 };
  const FX_VS = `
    attribute vec4 aCol; attribute float aSize; attribute float aShape;
    uniform float uScale; varying vec4 vC; varying float vS;
    void main() { vC = aCol; vS = aShape; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * uScale / -mv.z; }`;
  const FX_FS = `
    varying vec4 vC; varying float vS;
    void main() {
      vec2 p = gl_PointCoord * 2.0 - 1.0; p.y = -p.y; float r = length(p), k = floor(vS + 0.01), seed = fract(vS) * 40.0;
      vec3 c = vC.rgb; float a = 0.0;
      if (k < 0.5) { a = pow(max(0.0, 1.0 - r), 2.0); }
      else if (k < 1.5) {                                       // a star: a hot middle and four rays
        float ray = max(exp(-abs(p.x) * 26.0) * (1.0 - abs(p.y)), exp(-abs(p.y) * 26.0) * (1.0 - abs(p.x)));
        a = clamp(exp(-r * r * 22.0) + ray, 0.0, 1.0); c = mix(c, vec3(1.0), exp(-r * r * 30.0));
      } else if (k < 2.5) {                                     // a cloud: four round lumps, lit from the top left, a darker rim
        float an = seed, cs = cos(an), sn = sin(an); vec2 q = vec2(cs * p.x - sn * p.y, sn * p.x + cs * p.y);
        float d = min(min(length(q - vec2(-0.32, -0.12)) - 0.42, length(q - vec2(0.3, -0.16)) - 0.4), min(length(q - vec2(0.0, 0.24)) - 0.46, length(q - vec2(0.04, -0.34)) - 0.36));
        a = smoothstep(0.03, -0.03, d); c *= 1.06 + 0.14 * (p.y - p.x) * 0.5;
        c = mix(c, c * 0.68, smoothstep(-0.13, -0.02, d));
      } else if (k < 3.5) {                                     // a flame: narrow at the top, white-hot low in the middle
        float w = 0.12 + 0.5 * (1.0 - p.y) * (1.0 - p.y) * 0.25; float x = p.x + 0.08 * sin(p.y * 5.0 + seed);
        a = exp(-x * x / (w * w)) * smoothstep(1.0, 0.1, p.y) * smoothstep(-1.0, -0.55, p.y);
        c = mix(c, vec3(1.0, 0.95, 0.75), exp(-(x * x * 30.0 + (p.y + 0.45) * (p.y + 0.45) * 6.0)));
      } else {                                                  // a drop: round, with a glint
        a = smoothstep(1.0, 0.82, r); c = mix(c, vec3(1.0), smoothstep(0.35, 0.0, length(p - vec2(-0.35, 0.35))) * 0.9);
      }
      a *= vC.a; if (a < 0.01) discard; gl_FragColor = vec4(c, a);
    }`;
  function fxSystem(blending, N) {
    const geo = new THREE.BufferGeometry(), pos = new Float32Array(N * 3), colA = new Float32Array(N * 4), size = new Float32Array(N), shape = new Float32Array(N);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aCol', new THREE.BufferAttribute(colA, 4));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1)); geo.setAttribute('aShape', new THREE.BufferAttribute(shape, 1));
    const mat = new THREE.ShaderMaterial({ uniforms: { uScale: { value: 1 } }, vertexShader: FX_VS, fragmentShader: FX_FS, transparent: true, depthWrite: false, blending });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 4; pts.visible = false; scene.add(pts);
    return { N, geo, pos, colA, size, shape, mat, pts, list: [] };
  }
  const fxAdd = fxSystem(THREE.AdditiveBlending, 500), fxMix = fxSystem(THREE.NormalBlending, 400);
  // rings flat on the cloth (the splash): a few meshes used over and over
  const fxRings = [];
  for (let i = 0; i < 18; i++) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 40), new THREE.MeshBasicMaterial({ color: 0xe8fbff, transparent: true, opacity: 0, depthWrite: false }));
    m.visible = false; m.renderOrder = 3; scene.add(m); fxRings.push({ m, age: 0, life: 0, r0: 0, r1: 0, op: 0 });
  }
  const fxSounds = [];                                           // sounds for the app to play: { file, v (0..1), x, y }
  const fx = { kind: null, item: null, moving: false, gap: 0, last: null, nodes: [], seed: 3, fade: 0, t: 0, spd: 0 };
  const fxRand = () => { fx.seed = (fx.seed * 1664525 + 1013904223) >>> 0; return fx.seed / 4294967296; };
  const fxCol = new THREE.Color();
  function fxSpawn(sys, o) {
    if (sys.list.length >= sys.N) sys.list.shift();
    o.age = 0; o.vx = o.vx || 0; o.vy = o.vy || 0; o.vz = o.vz || 0; o.g = o.g || 0; o.s1 = o.s1 == null ? o.s0 : o.s1; o.a0 = o.a0 == null ? 1 : o.a0; o.tw = o.tw || 0;
    fxCol.setHex(o.hex); o.r = fxCol.r; o.gr = fxCol.g; o.b = fxCol.b; o.sh = FX_SHAPES[o.shape] + (o.seedK != null ? o.seedK : fxRand()) * 0.9;
    sys.list.push(o); return o;
  }
  function fxRing(x, y, z, r0, r1, life, op) {
    let best = fxRings[0]; for (const q of fxRings) if (!q.m.visible) { best = q; break; } else if (q.age / q.life > best.age / best.life) best = q;
    Object.assign(best, { age: 0, life, r0, r1, op }); best.m.position.set(x, y, z); best.m.visible = true; best.m.scale.setScalar(r0); best.m.material.opacity = op;
  }
  function fxStep(sys, dt, R) {
    const L = sys.list; let n = 0;
    for (let i = 0; i < L.length; i++) {
      const o = L[i]; o.age += dt;
      if (o.life !== Infinity && o.age >= o.life) continue;
      o.vz += o.g * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.z += o.vz * dt;
      if (o.g && o.z < 0.002) {                               // a drop come down on the cloth: a little ring where it fell
        if (o.ring) fxRing(o.x, o.y, 0.0018, 0.005, 0.03, 0.6, 0.6);
        continue;
      }
      const u = o.life === Infinity ? 0 : o.age / o.life, s = o.s0 + (o.s1 - o.s0) * u;
      let a = o.a0 * (o.fadeIn ? Math.min(1, o.age / o.fadeIn) : 1) * (o.life === Infinity ? 1 : 1 - u * u);
      if (o.tw) a *= 0.65 + 0.35 * Math.sin(o.age * o.tw + o.sh * 7);
      L[n++] = o;
      const j = n - 1;
      sys.pos[j * 3] = o.x; sys.pos[j * 3 + 1] = o.y; sys.pos[j * 3 + 2] = o.z;
      // flames go from yellow through orange to a dark red as they die
      let r = o.r, g = o.gr, b = o.b;
      if (o.burn) { r = 1; g = Math.max(0.12, 0.85 - u * 0.95); b = Math.max(0.02, 0.35 - u * 0.6); }
      sys.colA[j * 4] = r; sys.colA[j * 4 + 1] = g; sys.colA[j * 4 + 2] = b; sys.colA[j * 4 + 3] = Math.max(0, a);
      sys.size[j] = s; sys.shape[j] = o.sh;
    }
    L.length = n;
    const G = sys.geo; G.setDrawRange(0, n);
    for (const k of ['position', 'aCol', 'aSize', 'aShape']) G.attributes[k].needsUpdate = true;
    sys.pts.visible = n > 0;
    return n > 0;
  }
  const fxScaleV = new THREE.Vector2();
  function setFx(t) {
    fx.kind = t ? t.kind : null; fx.item = t; fx.last = null; fx.nodes.length = 0; fx.moving = false;
    for (const s of [fxAdd, fxMix]) { s.list.length = 0; s.pts.visible = false; }
    for (const q of fxRings) q.m.visible = false;
  }
  // the marks on the cloth go on the chalk trail's picture
  function fxMark(draw) { draw(chalkG, chS()); chalk.dirty = true; chalkMesh.visible = true; }
  const fxPal = { stars: [0xffffff, 0xbfe3ff, 0xffe7a3, 0xd9c7ff], puff: [0xd9d39c, 0xc9d79a, 0xe6dcb9, 0xbccf8c] };
  function fxTurn(k, R) {
    const sp = Math.hypot(k.dout[0], k.dout[1]) * fx.spd, x = k.x, y = k.y, z = 0.004;
    const fromRail = !!k.n;
    if (fx.kind === 'stars') {
      fx.nodes.push(fxSpawn(fxAdd, { shape: 'star', hex: 0xffffff, x, y, z: z + 0.01, s0: 0.11, life: Infinity, tw: 5, a0: 1, fadeIn: 0.15 }));
    } else if (fx.kind === 'ink') {
      fxMark((g, s) => {                                                // a blot, its splashes thrown the way the ball went on
        g.fillStyle = 'rgba(12,12,16,.9)'; const cx = chX(x), cy = chY(y);
        g.beginPath(); for (let i = 0; i <= 14; i++) { const a = i / 14 * Math.PI * 2, rr = (0.016 + fxRand() * 0.01) * s; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.fill();
        for (let i = 0; i < 9; i++) { const a = Math.atan2(-k.dout[1], k.dout[0]) + (fxRand() - 0.5) * 1.6, d = (0.02 + fxRand() * 0.07) * s; g.beginPath(); g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, (0.0015 + fxRand() * 0.004) * s, 0, 7); g.fill(); }
      });
    } else if (fx.kind === 'fire' && fromRail) {
      for (let i = 0; i < 14; i++) { const a = fxRand() * Math.PI * 2, v = 0.4 + fxRand() * 1.2; fxSpawn(fxAdd, { shape: 'dot', hex: 0xffc35a, x, y, z, vx: Math.cos(a) * v + k.n[0] * 0.5, vy: Math.sin(a) * v + k.n[1] * 0.5, vz: 0.3 + fxRand() * 0.8, g: -3, s0: 0.012, s1: 0.004, life: 0.35 + fxRand() * 0.3 }); }
    } else if (fx.kind === 'splash') {
      const n = fromRail ? 16 : 9;
      for (let i = 0; i < n; i++) { const a = fxRand() * Math.PI * 2, v = 0.3 + fxRand() * 0.9; fxSpawn(fxMix, { shape: 'drop', hex: 0xe6f8ff, x, y, z, vx: Math.cos(a) * v + (k.n ? k.n[0] * 0.6 : 0), vy: Math.sin(a) * v + (k.n ? k.n[1] * 0.6 : 0), vz: 0.8 + fxRand() * 1.3, g: -9.8, s0: 0.011 + fxRand() * 0.008, life: 2, a0: 0.9, ring: i % 3 === 0 }); }
      fxRing(x, y, 0.0018, R, R * 5, 1.1, 0.7); fxRing(x, y, 0.0018, R * 0.6, R * 3, 0.8, 0.5);
      if (sp > 0.25) fxSounds.push({ file: 'fx-splash', v: Math.min(1, sp / 2.5) * 0.8, x, y });
    } else if (fx.kind === 'puff' && fromRail && sp > 0.6) {
      fxSpawn(fxMix, { shape: 'puff', hex: fxPal.puff[(fxRand() * 4) | 0], x: x + k.n[0] * 0.02, y: y + k.n[1] * 0.02, z: z + 0.01, s0: 0.07, s1: 0.16, life: 1.1, a0: 0.85 });
    }
  }
  // along the way: what each kind leaves every few millimetres, from a to b (metres), at speed v
  function fxAlong(a, b, v, R, dt) {
    const d = Math.hypot(b.x - a.x, b.y - a.y), z = 0.004; if (d < 1e-6) return;
    const ux = (b.x - a.x) / d, uy = (b.y - a.y) / d;
    if (fx.kind === 'ink') {
      // slow: a full wet stroke; fast: thinner, and the brush runs dry - the edges split into hairs with gaps between
      const wid = Math.max(0.011, Math.min(0.034, 0.034 - v * 0.004)), dry = Math.min(1, Math.max(0, (v - 1.5) / 3));
      fxMark((g, s) => {
        const px = -uy, py = ux; g.lineCap = 'round';
        g.strokeStyle = 'rgba(14,14,18,.9)'; g.lineWidth = wid * (1 - dry * 0.45) * s;
        g.beginPath(); g.moveTo(chX(a.x), chY(a.y)); g.lineTo(chX(b.x), chY(b.y)); g.stroke();
        for (let h = 0; h < 4; h++) {
          if (fxRand() < 0.35 + dry * 0.3) continue;
          const o = (h < 2 ? -1 : 1) * wid * (0.42 + 0.12 * (h % 2)) * (1 - dry * 0.2);
          g.strokeStyle = `rgba(14,14,18,${(0.35 + fxRand() * 0.4).toFixed(2)})`; g.lineWidth = Math.max(1, wid * 0.12 * s);
          g.beginPath(); g.moveTo(chX(a.x + px * o), chY(a.y + py * o)); g.lineTo(chX(b.x + px * o), chY(b.y + py * o)); g.stroke();
        }
      });
      return;
    }
    fx.gap += d;
    const step = { stars: 0.016, puff: 0.06, fire: 0.012, splash: 0.02 }[fx.kind] || 0.02;
    while (fx.gap >= step) {
      fx.gap -= step; const t = 1 - fx.gap / d, x = a.x + (b.x - a.x) * Math.max(0, Math.min(1, t)), y = a.y + (b.y - a.y) * Math.max(0, Math.min(1, t));
      if (fx.kind === 'stars') {
        const side = (fxRand() - 0.5) * 0.03;
        fxSpawn(fxAdd, { shape: fxRand() < 0.7 ? 'star' : 'dot', hex: fxPal.stars[(fxRand() * 4) | 0], x: x - uy * side, y: y + ux * side, z: z + 0.006, vz: 0.02, s0: 0.022 + fxRand() * 0.03, s1: 0.006, life: 0.9 + fxRand() * 0.9, tw: 9 + fxRand() * 8 });
      } else if (fx.kind === 'puff') {
        if (v < 0.25) continue;
        fxSpawn(fxMix, { shape: 'puff', hex: fxPal.puff[(fxRand() * 4) | 0], x: x - ux * 0.03, y: y - uy * 0.03, z: z + 0.01, vx: -ux * 0.05 + (fxRand() - 0.5) * 0.06, vy: -uy * 0.05 + (fxRand() - 0.5) * 0.06, vz: 0.03, s0: 0.1, s1: 0.19 + Math.min(0.07, v * 0.018), life: 1 + fxRand() * 0.6, a0: 0.8 });
      } else if (fx.kind === 'fire') {
        const side = (fxRand() - 0.5) * R * 1.1;
        fxSpawn(fxAdd, { shape: 'flame', hex: 0xffa040, burn: true, x: x - uy * side - ux * 0.01, y: y + ux * side - uy * 0.01, z: z + 0.012, vz: 0.12 + fxRand() * 0.1, s0: 0.05 + Math.min(0.03, v * 0.008), s1: 0.018, life: 0.32 + fxRand() * 0.25, a0: 0.6 });
        if (fxRand() < 0.18) fxSpawn(fxAdd, { shape: 'dot', hex: 0xffd27a, x, y, z: z + 0.01, vx: (fxRand() - 0.5) * 0.5, vy: (fxRand() - 0.5) * 0.5, vz: 0.3 + fxRand() * 0.4, g: -1.5, s0: 0.009, s1: 0.003, life: 0.5 });
        fxMark((g, s) => { g.strokeStyle = 'rgba(34,18,8,.055)'; g.lineWidth = R * 1.1 * s; g.lineCap = 'round'; g.beginPath(); g.moveTo(chX(x - ux * step), chY(y - uy * step)); g.lineTo(chX(x), chY(y)); g.stroke(); });
      } else if (fx.kind === 'splash') {
        if (v < 0.15) continue;
        for (const sd of [-1, 1]) { const q = 0.25 + fxRand() * 0.5 * Math.min(1.6, v * 0.5); fxSpawn(fxMix, { shape: 'drop', hex: fxRand() < 0.5 ? 0xffffff : 0xcfefff, x: x + -uy * sd * R * 0.8, y: y + ux * sd * R * 0.8, z, vx: -uy * sd * q - ux * 0.1, vy: ux * sd * q - uy * 0.1, vz: 0.5 + fxRand() * 0.6 * Math.min(1.6, v * 0.5), g: -9.8, s0: 0.015 + fxRand() * 0.013, life: 2, a0: 0.9, ring: fxRand() < 0.3 }); }
        if (fxRand() < 0.6) fxRing(x, y, 0.0018, R * 0.9, R * 3, 1, 0.6);
      }
    }
  }
  function fxTick(w, c, R, dt) {
    if (!chalk.P || chalk.P !== cur) chalkFit(cur, R);
    fx.t += dt;
    const T = traceFor(w), moving = !!c && c.on && (c.vx !== 0 || c.vy !== 0);
    fx.spd = c ? Math.hypot(c.vx, c.vy) : 0;
    // a new shot: last shot's marks go, and the way it sets off
    if (moving && !fx.moving) {
      chalkClear(); chalkMat.opacity = 1; fx.nodes.length = 0; fx.gap = 0; fx.seed = 3; fx.fade = 0;
      for (const s of [fxAdd, fxMix]) s.list = s.list.filter(o => o.life !== Infinity);
      const from = fx.last || { x: c.x, y: c.y }, ux = c.vx / (fx.spd || 1), uy = c.vy / (fx.spd || 1), v = Math.min(1, fx.spd / 6), z = 0.004;
      if (fx.kind === 'stars') fx.nodes.push(fxSpawn(fxAdd, { shape: 'star', hex: 0xffffff, x: from.x, y: from.y, z: z + 0.01, s0: 0.11, life: Infinity, tw: 5 }));
      if (fx.kind === 'puff') {
        for (let i = 0; i < 6; i++) fxSpawn(fxMix, { shape: 'puff', hex: fxPal.puff[i % 4], x: from.x - ux * (0.04 + i * 0.02) + (fxRand() - 0.5) * 0.04, y: from.y - uy * (0.04 + i * 0.02) + (fxRand() - 0.5) * 0.04, z: z + 0.012, vx: -ux * (0.15 + 0.2 * v), vy: -uy * (0.15 + 0.2 * v), vz: 0.04, s0: 0.14, s1: 0.32 + v * 0.12, life: 1.8 + fxRand() * 0.6, a0: 0.9 });
        fxSounds.push({ file: 'fx-fart', v: 0.45 + v * 0.55, rate: 1.15 - v * 0.3, x: from.x, y: from.y });
      }
      if (fx.kind === 'fire') fxSounds.push({ file: 'fx-fire', v: 0.4 + v * 0.6, x: from.x, y: from.y });
      if (fx.kind === 'splash') { fxRing(from.x, from.y, 0.0018, R, R * 4.5, 1, 0.65); fxSounds.push({ file: 'fx-splash', v: 0.35 + v * 0.5, x: from.x, y: from.y }); }
      fx.last = from;
    }
    // the ball has stopped: the stars are joined
    if (!moving && fx.moving && fx.kind === 'stars' && c && c.on) {
      fx.nodes.push(fxSpawn(fxAdd, { shape: 'star', hex: 0xffffff, x: c.x, y: c.y, z: 0.014, s0: 0.11, life: Infinity, tw: 5 }));
      fxMark((g, s) => {
        g.save(); g.lineCap = 'round';
        for (const [wd, col] of [[0.006, 'rgba(150,200,255,.22)'], [0.0018, 'rgba(235,245,255,.85)']]) {
          g.strokeStyle = col; g.lineWidth = wd * s; g.beginPath();
          fx.nodes.forEach((o, i) => (i ? g.lineTo : g.moveTo).call(g, chX(o.x), chY(o.y))); g.stroke();
        }
        g.restore();
      });
      chalkMat.opacity = 0; fx.fade = 0.001;
    }
    if (fx.fade > 0 && fx.fade < 1) { fx.fade = Math.min(1, fx.fade + dt / 0.8); chalkMat.opacity = fx.fade; }
    fx.moving = moving;
    // the way since last frame, step by step as the physics took it
    let prev = fx.last;
    for (let i = 0; i < T.p.length; i += 2) {
      const p = { x: T.p[i], y: T.p[i + 1] };
      if (prev && moving) fxAlong(prev, p, fx.spd, R, dt);
      prev = p;
    }
    if (c && c.on) prev = { x: c.x, y: c.y };
    fx.last = prev; T.p.length = 0;
    // the turns, a close pair as one
    let lastK = null;
    for (const k of T.k) { if (lastK && Math.hypot(k.x - lastK.x, k.y - lastK.y) < 0.03) continue; lastK = k; if (k.din[0] * k.dout[0] + k.din[1] * k.dout[1] < Math.cos(0.12)) fxTurn(k, R); }
    T.k.length = 0;
    let live = fxStep(fxAdd, dt, R) | fxStep(fxMix, dt, R);
    for (const q of fxRings) {
      if (!q.m.visible) continue;
      q.age += dt; const u = q.age / q.life;
      if (u >= 1) { q.m.visible = false; continue; }
      q.m.scale.setScalar(q.r0 + (q.r1 - q.r0) * (1 - (1 - u) * (1 - u))); q.m.material.opacity = q.op * (1 - u); live = 1;
    }
    renderer.getDrawingBufferSize(fxScaleV); const sc = camera.projectionMatrix.elements[5] * fxScaleV.y / 2;
    fxAdd.mat.uniforms.uScale.value = fxMix.mat.uniforms.uScale.value = sc;
    if (chalk.dirty) { chalkTex.needsUpdate = true; chalk.dirty = false; }
    return moving || !!live || (fx.fade > 0 && fx.fade < 1);
  }
  function fxOff() { setFx(null); }
