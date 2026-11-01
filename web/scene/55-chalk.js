  /* The chalk trail (content/40-trails.js: kind 'chalk'): where the cue ball went this shot, chalked onto the cloth as on a
     blackboard - a rough line, and wherever it turned (a cushion, a ball) a small arc and the angle written beside it in a
     hand: off a cushion the angle in and the angle out, measured from the cushion; off a ball how far it turned. It stays
     until the next shot sets off, which wipes it. Drawn into one picture laid on the cloth, redrawn only when it grows. */
  const CH_W = 1024, CH_H = 512;
  const chalkCv = mkCanvas(CH_W, CH_H), chalkG = chalkCv.getContext('2d'), chalkTex = new THREE.CanvasTexture(chalkCv);
  chalkTex.anisotropy = aniso;
  const chalkMat = new THREE.MeshBasicMaterial({ map: chalkTex, transparent: true, depthWrite: false, toneMapped: false });
  const chalkMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), chalkMat); chalkMesh.renderOrder = 2; chalkMesh.visible = false; scene.add(chalkMesh);
  const chalk = { pts: [], last: null, moving: false, dirty: false, corners: [], open: null, w: null, seed: 1, P: null };
  const chRand = () => { chalk.seed = (chalk.seed * 1664525 + 1013904223) >>> 0; return chalk.seed / 4294967296; };
  // table metres to the picture's pixels (the picture covers the cloth inside the cushions)
  const chX = x => (x / chalk.P.HL * 0.5 + 0.5) * CH_W, chY = y => (0.5 - y / chalk.P.HW * 0.5) * CH_H, chS = () => CH_W / (2 * chalk.P.HL);
  function chalkFit(P, R) {
    chalk.P = P; chalkMesh.scale.set(2 * P.HL, 2 * P.HW, 1); chalkMesh.position.set(0, 0, -R + 0.0012);
  }
  function chalkClear() { chalkG.clearRect(0, 0, CH_W, CH_H); chalk.pts.length = 0; chalk.corners.length = 0; chalk.last = null; chalk.open = null; chalkTex.needsUpdate = true; }
  // one stretch of chalk: a few thin passes slightly off one another, each broken here and there, as a stick drags on cloth
  function chalkLine(a, b) {
    const g = chalkG, s = chS(), w = Math.max(1.6, 0.0032 * s);
    for (let k = 0; k < 3; k++) {
      g.strokeStyle = `rgba(246,248,240,${(0.42 + chRand() * 0.3).toFixed(2)})`; g.lineWidth = w * (0.55 + chRand() * 0.5); g.lineCap = 'round';
      const o = () => (chRand() - 0.5) * w * 0.9;
      if (chRand() < 0.12) continue;                                                     // (a skip where the stick lifted)
      g.beginPath(); g.moveTo(chX(a.x) + o(), chY(a.y) + o()); g.lineTo(chX(b.x) + o(), chY(b.y) + o()); g.stroke();
    }
    // dust: specks either side
    g.fillStyle = 'rgba(246,248,240,.35)';
    for (let k = 0; k < 2; k++) { const t = chRand(); g.fillRect(chX(a.x + (b.x - a.x) * t) + (chRand() - 0.5) * w * 4, chY(a.y + (b.y - a.y) * t) + (chRand() - 0.5) * w * 4, 1.2, 1.2); }
  }
  // the angle at a turn, written in chalk as in a geometry lesson: off a cushion two small arcs, each between the cushion's
  // line and the way in or out, with its angle in the wedge; off a ball one arc for how far the way turned.
  function chalkWedge(at, u, v, text) {
    const g = chalkG, s = chS(), x = chX(at.x), y = chY(at.y);
    // (picture y runs down: the angles flip)
    const a0 = -Math.atan2(u[1], u[0]); let a1 = -Math.atan2(v[1], v[0]);
    while (a1 - a0 > Math.PI) a1 -= 2 * Math.PI; while (a0 - a1 > Math.PI) a1 += 2 * Math.PI;
    g.strokeStyle = 'rgba(246,248,240,.75)'; g.lineWidth = Math.max(1.4, 0.0022 * s); g.beginPath(); g.arc(x, y, 0.05 * s, Math.min(a0, a1), Math.max(a0, a1)); g.stroke();
    const mid = (a0 + a1) / 2, r = 0.1 * s, fx = x + Math.cos(mid) * r, fy = y + Math.sin(mid) * r;
    g.save(); g.translate(Math.max(30, Math.min(CH_W - 30, fx)), Math.max(16, Math.min(CH_H - 16, fy))); g.rotate((chRand() - 0.5) * 0.25);
    g.font = `${Math.round(0.042 * s)}px Jua, "Gothic A1", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(246,248,240,.94)'; g.fillText(text, 0, 0); g.globalAlpha = 0.35; g.fillText(text, 0.8, 0.6); g.restore();
  }
  function chalkAngle(at, din, dout, n) {
    const deg = v => Math.round(v * 180 / Math.PI) + '°', back = [-din[0], -din[1]], dot = (a, b) => a[0] * b[0] + a[1] * b[1];
    if (!n) return chalkWedge(at, back, dout, deg(Math.acos(Math.max(-1, Math.min(1, dot(din, dout))))));
    const t = [-n[1], n[0]], side = v => dot(v, t) >= 0 ? t : [-t[0], -t[1]], fromLine = v => Math.asin(Math.min(1, Math.abs(dot(v, n))));
    chalkWedge(at, side(back), back, deg(fromLine(din)));
    chalkWedge(at, side(dout), dout, deg(fromLine(dout)));
  }
  /* each frame: the physics' own trace of the cue ball (physics.js, w.trace - every step it took, and every turn exactly where
     it happened) drawn on. A turn is written once the ball is a little way clear of it; turns close together (a kiss, a
     cushion and a ball at once) are one corner, in from the first and out of the last. */
  function chalkTick(w, c, R, dt) {
    if (!chalk.P || chalk.P !== cur) chalkFit(cur, R);
    if (chalk.w !== w) { if (chalk.w) chalk.w.trace = null; chalk.w = w; }
    if (!w.trace) w.trace = { p: [], k: [] };
    // a new shot setting off: last shot's chalk is wiped away and this one begins
    const moving = !!c && c.on && (c.vx !== 0 || c.vy !== 0);
    if (moving && !chalk.moving) { chalkClear(); chalk.seed = 7; if (chalk.rest) chalk.pts.push(chalk.rest); }
    chalk.moving = moving;
    if (!moving && c && c.on) chalk.rest = { x: c.x, y: c.y };
    const T = w.trace;
    for (let i = 0; i < T.p.length; i += 2) {
      const L = chalk.pts.length, p = { x: T.p[i], y: T.p[i + 1] }, q = chalk.pts[L - 1];
      if (!q) { chalk.pts.push(p); continue; }
      if (Math.hypot(p.x - q.x, p.y - q.y) < 0.004) continue;
      chalkLine(q, p); chalk.pts.push(p); chalk.dirty = true;
    }
    T.p.length = 0;
    for (const k of T.k) {
      const o = chalk.open;
      if (o && Math.hypot(k.x - o.x, k.y - o.y) < 0.03) { o.dout = k.dout; o.n = o.n || k.n; }
      else { if (o) chalk.corners.push(o); chalk.open = { x: k.x, y: k.y, din: k.din, dout: k.dout, n: k.n }; }
    }
    T.k.length = 0;
    // the corner left open is written once the ball is clear of it (or has stopped)
    const o = chalk.open;
    if (o && (!moving || !c || !c.on || Math.hypot(c.x - o.x, c.y - o.y) > 0.04)) {
      chalk.open = null;
      const t = o.din[0] * o.dout[0] + o.din[1] * o.dout[1];
      if (t < Math.cos(0.12)) { chalkAngle(o, o.din, o.dout, o.n); chalk.dirty = true; }
    }
    if (chalk.dirty) { chalkTex.needsUpdate = true; chalk.dirty = false; }
    chalkMesh.visible = chalk.pts.length > 1;
    return moving;
  }
  function chalkOff() { chalkClear(); chalkMesh.visible = false; if (chalk.w) chalk.w.trace = null; chalk.w = null; chalk.open = null; }
