  /* Marks on the cloth (the trails drawn in code, scene/56-fx.js: a scorch, laid grass, a constellation): one picture laid
     over the cloth inside the cushions, drawn on as the ball goes and wiped when the next shot sets off. */
  const CL_W = 1024, CL_H = 512;
  const clothCv = mkCanvas(CL_W, CL_H), clothG = clothCv.getContext('2d'), clothTex = new THREE.CanvasTexture(clothCv);
  clothTex.anisotropy = aniso; clothTex.encoding = THREE.sRGBEncoding;
  const clothMat = new THREE.MeshBasicMaterial({ map: clothTex, transparent: true, depthWrite: false, toneMapped: false });
  const clothMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), clothMat); clothMesh.renderOrder = 2; clothMesh.visible = false; scene.add(clothMesh);
  const clothMarks = { dirty: false, P: null };
  // the physics' trace of the cue ball (physics.js, w.trace), asked of whichever table is being shown; one table at a time
  let traceW = null;
  function traceFor(w) { if (traceW !== w) { if (traceW) traceW.trace = null; traceW = w; } if (!w.trace) w.trace = { p: [], k: [] }; return w.trace; }
  function traceOff() { if (traceW) traceW.trace = null; traceW = null; }
  // table metres to the picture's pixels
  const clX = x => (x / clothMarks.P.HL * 0.5 + 0.5) * CL_W, clY = y => (0.5 - y / clothMarks.P.HW * 0.5) * CL_H, clS = () => CL_W / (2 * clothMarks.P.HL);
  function clothFit(P) { if (clothMarks.P === P) return; clothMarks.P = P; clothMesh.scale.set(2 * P.HL, 2 * P.HW, 1); clothMesh.position.set(0, 0, 0.0012); }
  // The picture goes to the graphics card a few times a second, not every frame (sending the whole of it each frame the ball
  // moved made it stutter on phones). force: send now (the ball has stopped).
  let upAt = 0;
  function clothFlush(force) {
    const now = performance.now();
    if (clothMarks.dirty && (force || now - upAt > 110)) { clothTex.needsUpdate = true; clothMarks.dirty = false; upAt = now; }
  }
  function clothClear() { clothG.clearRect(0, 0, CL_W, CL_H); clothTex.needsUpdate = true; }
  function clothOff() { clothClear(); clothMesh.visible = false; clothMat.opacity = 1; traceOff(); }
