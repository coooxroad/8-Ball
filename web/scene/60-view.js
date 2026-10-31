  /* layout: the table is fitted inside the insets; the insets ease when the screen changes */
  // The desk's home screen: the lamps move up and to the right of the screen, so the balls' shadows fall to the lower
  // left like everything else on the desk (the desk tilts the picture itself; the camera stays straight overhead).
  let lampShift = [0, 0];
  function placeLamps() {
    if (!cur) return;
    [-0.615, 0, 0.615].forEach((f, i) => { LAMPS[i][0] = f * cur.HL + lampShift[0]; LAMPS[i][1] = lampShift[1]; });
    lampObjs.forEach((l, i) => { const L = LAMPS[i % 3]; l.position.x = L[0]; l.position.y = L[1]; l.target.position.set(L[0] - lampShift[0] * 0.5, -lampShift[1] * 0.5, 0); l.target.updateMatrixWorld(); });
  }
  let lampsOn = false;
  function setDeskLight(lamps) {
    const l = !!lamps; if (l === lampsOn) return;
    lampsOn = l; applyLook(); applyCamera(); renderer.shadowMap.needsUpdate = true; staticDirty = true; dirty = 3;
  }
  // the lamps' shift is in screen terms (right, up), so it follows the table's turn on an upright screen
  function applyLook() { const r = lampsOn ? 0.8 : 0, u = lampsOn ? 0.6 : 0; lampShift = portrait ? [u, -r] : [r, u]; placeLamps(); }
  let portrait = false, lying = false, dirty = 3, quality = 'auto', W = 0, H = 0;
  const ins = { t: 60, l: 62, r: 70, b: 6 }, insTo = { t: 60, l: 62, r: 70, b: 6 };
  /* Looking round in 3D. While the view is turning, the table is drawn directly every frame (nothing stored would fit a
     moving camera); as soon as it stops, the still picture is made again and frames are cheap as before. */
  const orbit = { on: false, az: 0, el: 1.4, elTo: 1.4, zoom: 1, live: 0, cam: null }, fitV = new THREE.Vector3(), fitP = new THREE.Vector3();
  function setOrbit(on) {
    orbit.on = on; orbit.cam = null;
    if (on) { orbit.az = 0; orbit.el = 1.4; orbit.elTo = 0.82; orbit.zoom = 1; orbit.live = 4; }
    applyCamera();
  }
  function orbitBy(dx, dy) {
    if (!orbit.on) return;
    if (orbit.cam && orbit.cam.eye) { orbit.az = orbit.cam.az - (portrait ? -Math.PI / 2 : 0); orbit.zoom = 0.8; orbit.cam = null; if (onFree) onFree(); }   // (dragging the view leaves the player's eye for a free look)
    orbit.az -= dx * 0.0034; orbit.elTo = orbit.el = Math.max(0.3, Math.min(1.42, orbit.el + dy * 0.0028)); orbit.live = 4; applyCamera();
  }
  // A camera placed by a script (the highlight reel): az is the compass direction the camera sits in, el its height angle,
  // zoom < 1 is closer than "whole table in view", and it looks at the table point (tx, ty).
  let onFree = null;
  function setCam(c) { orbit.on = true; orbit.cam = c; orbit.el = orbit.elTo = c.el; orbit.live = 4; applyCamera(); }
  // where table points are on the screen, in pixels from the top-left of the game area (for overlays drawn on top of the
  // 3D picture): call begin() once, then at() for each point, which says whether the point is in front of the camera
  const scr = new THREE.Vector3();
  const proj = { begin() { camera.updateMatrixWorld(); camera.matrixWorldInverse.copy(camera.matrixWorld).invert(); }, at(x, y, z, out) { scr.set(x, y, z || 0).project(camera); out[0] = (scr.x + 1) / 2 * W; out[1] = (1 - scr.y) / 2 * H; return scr.z < 1 && scr.z > -1; } };
  // f > 1 moves the camera away, f < 1 brings it in
  function zoomBy(f) { if (!orbit.on) return; orbit.zoom = Math.max(0.4, Math.min(1.35, orbit.zoom * f)); orbit.live = 4; applyCamera(); }
  function applyCamera(soft) {
    if (!W || !H) return;
    const sw = Math.max(40, W - ins.l - ins.r), sh = Math.max(40, H - ins.t - ins.b), cx = ins.l + sw / 2, cy = ins.t + sh / 2;
    const TW = 2 * (cur.HL + CW + RW) + 0.03, TH = 2 * (cur.HW + CW + RW) + 0.03;
    ppm = portrait ? Math.min(sw / TH, sh / TW) : Math.min(sw / TW, sh / TH);
    const fw = 2 * Math.max(cx, W - cx), fh = 2 * Math.max(cy, H - cy);
    const dist = fh / (2 * ppm * Math.tan(FOV * Math.PI / 360));
    camera.far = Math.max(30, dist * 1.6 + 4);                          // (a small table on a phone is a long way off down that lens)
    camera.aspect = fw / fh;
    if (orbit.on) {
      // looking round: the camera circles the middle of the table at the same distance, anywhere from nearly overhead to low
      const cam = orbit.cam, az = cam ? cam.az : orbit.az + (portrait ? -Math.PI / 2 : 0), ce = Math.cos(orbit.el);
      const dir = fitV.set(ce * Math.sin(az), -ce * Math.cos(az), Math.sin(orbit.el));
      // step back until the whole table is inside the free part of the screen, whichever way it is turned
      const tan = Math.tan(FOV * Math.PI / 360), limX = tan * (fw / fh) * (sw / fw), limY = tan * (sh / fh), ex = cur.HL + CW + RW, ey = cur.HW + CW + RW;
      let d = dist; camera.up.set(0, 0, 1);
      for (let it = 0; it < 4; it++) {
        camera.position.copy(dir).multiplyScalar(d); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(); camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
        let k = 0;
        for (let c = 0; c < 8; c++) {
          fitP.set(c & 1 ? ex : -ex, c & 2 ? ey : -ey, c & 4 ? RAIL_Z : -0.25).applyMatrix4(camera.matrixWorldInverse);
          k = Math.max(k, Math.abs(fitP.x / -fitP.z) / limX, Math.abs(fitP.y / -fitP.z) / limY);
        }
        d *= 1 + (k * 1.03 - 1) * 0.9;
      }
      // a scripted camera may come in very close, so what it can see starts nearer to it
      if (cam) { camera.position.copy(dir).multiplyScalar(d * cam.zoom); camera.position.x += cam.tx; camera.position.y += cam.ty; fitP.set(cam.tx, cam.ty, 0); camera.near = Math.max(0.05, Math.min(0.5, d * cam.zoom * 0.3)); }
      else { camera.position.copy(dir).multiplyScalar(d * orbit.zoom); fitP.set(0, 0, 0); camera.near = 0.5; }
    } else { hall.visible = false; camera.near = 0.5; fitP.set(0, 0, 0); camera.position.set(0, 0, dist); camera.up.set(portrait ? 1 : 0, portrait ? 0 : 1, 0); }
    camera.lookAt(fitP);
    camera.setViewOffset(fw, fh, fw / 2 - cx, fh / 2 - cy, W, H);
    hall.visible = false; if (orbit.on) { camera.updateMatrixWorld(); camera.matrixWorldInverse.copy(camera.matrixWorld).invert(); hall.visible = hallClear(); }
    guideKey = ''; dirty = 3;
    if (soft && rt && !staticDirty && !orbit.on) stale = true; else staticDirty = true;
  }
  function resize() {
    W = app.clientWidth; H = app.clientHeight; if (!W || !H) return;
    portrait = H > W && !lying; if (lampsOn) applyLook();                                       // (a screen held upright stands the table on end, unless it is told to lie it down)
    const dpr = Math.min(window.devicePixelRatio || 1, 3), cap = quality === 'high' ? 9e6 : quality === 'low' ? 1.6e6 : 4.2e6;
    renderer.setPixelRatio(Math.max(1, Math.min(dpr, Math.sqrt(cap / (W * H)))));
    renderer.setSize(W, H, false);
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    if (!rt || rt.width !== size.x || rt.height !== size.y) {
      if (rt) rt.dispose();
      rt = renderer.capabilities.isWebGL2 ? new THREE.WebGLMultisampleRenderTarget(size.x, size.y) : new THREE.WebGLRenderTarget(size.x, size.y);
      rt.texture.encoding = THREE.sRGBEncoding; rt.texture.minFilter = rt.texture.magFilter = THREE.LinearFilter; rt.texture.generateMipmaps = false;
      quadMat.map = rt.texture; quadMat.needsUpdate = true; staticDirty = true;
    }
    applyCamera();
  }
  // where the table will sit for these insets once they have eased in: its outer edge (rails included), in pixels
  function tableRect(t) {
    const sw = Math.max(40, W - t.l - t.r), sh = Math.max(40, H - t.t - t.b), cx = t.l + sw / 2, cy = t.t + sh / 2;
    const TW = 2 * (cur.HL + CW + RW), TH = 2 * (cur.HW + CW + RW), TWf = TW + 0.03, THf = TH + 0.03;
    const p = portrait ? Math.min(sw / THf, sh / TWf) : Math.min(sw / TWf, sh / THf), w = (portrait ? TH : TW) * p, h = (portrait ? TW : TH) * p;
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  }
  // The table's outline on the screen once the insets t are reached: the outer edge of its rails, rounded corners and all,
  // taken at the rails' height (nearer the eye than the cloth, so a little bigger than the cloth-level box tableRect gives)
  // and projected with the camera those insets will give. A polygon, its box, and the corner radius in pixels.
  function tableOutline(t) {
    const keep = { t: ins.t, l: ins.l, r: ins.r, b: ins.b }; Object.assign(ins, { t: t.t, l: t.l, r: t.r, b: t.b }); applyCamera(); proj.begin();
    const ex = cur.HL + CW + RW, ey = cur.HW + CW + RW, rr = 0.1, z = RAIL_Z - 0.011, pts = [], o = [0, 0];
    for (const [cx, cy, a0] of [[ex - rr, ey - rr, 0], [-ex + rr, ey - rr, 90], [-ex + rr, -ey + rr, 180], [ex - rr, -ey + rr, 270]])
      for (let k = 0; k <= 6; k++) { const a = (a0 + 15 * k) * Math.PI / 180; proj.at(cx + rr * Math.cos(a), cy + rr * Math.sin(a), z, o); pts.push([o[0], o[1]]); }
    proj.at(0, 0, z, o); const c = [o[0], o[1]]; proj.at(rr, 0, z, o); const rpx = Math.abs(o[0] - c[0]) + Math.abs(o[1] - c[1]);
    Object.assign(ins, keep); applyCamera();
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), x = Math.min(...xs), y = Math.min(...ys);
    return { pts, x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y, r: rpx };
  }
  function setInsets(t, instant) {
    const ly = !!t.lie; if (ly !== lying) { lying = ly; if (W && H) { portrait = H > W && !lying; if (lampsOn) applyLook(); staticDirty = true; } instant = true; }
    insTo.t = t.t; insTo.l = t.l; insTo.r = t.r; insTo.b = t.b;
    if (instant) { Object.assign(ins, insTo); applyCamera(); }
    dirty = 3;
  }
  function setQuality(q) { quality = q; resize(); }

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function toTable(e, R) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const o = ray.ray.origin, d = ray.ray.direction, t = (R - o.z) / d.z;
    return { x: o.x + d.x * t, y: o.y + d.y * t };
  }

  const falls = [], fallEvents = [];   // fallEvents: what a dropping ball just did (hit the pocket wall, landed), for the sound
  // A pocketed ball keeps rolling over the lip, drops under gravity and rattles down inside the pocket.
  const fallAxis = new THREE.Vector3();
  function fall(P, e) {
    const p = P.POCKETS[e.pocket];
    let vx = e.vx || 0, vy = e.vy || 0; const sp = Math.hypot(vx, vy), cap = 1.5;
    if (sp > cap) { vx *= cap / sp; vy *= cap / sp; }
    falls.push({ id: e.id, x: e.x, y: e.y, z: P.R, vx, vy, vz: 0, p });
  }
  // a ball that has jumped the rail carries on through the air and out of sight
  function fly(P, e) { falls.push({ id: e.id, x: e.x, y: e.y, z: P.R + (e.z || 0), vx: e.vx, vy: e.vy, vz: e.vz || 0, p: null }); }

