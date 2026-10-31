  /* balls */
  const sphere = new THREE.SphereGeometry(1, 40, 28);
  const bc = mkCanvas(128, 128), bg = bc.getContext('2d');
  const gr = bg.createRadialGradient(64, 64, 10, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,.6)'); gr.addColorStop(0.5, 'rgba(0,0,0,.36)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  bg.fillStyle = gr; bg.fillRect(0, 0, 128, 128);
  const blobTex = new THREE.CanvasTexture(bc);
  const blobMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity: 0.75, depthWrite: false });
  const lampShadowMat = new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity: 0.42, depthWrite: false });
  const unitPlane = new THREE.PlaneGeometry(1, 1);
  let skin = BALLSKINS[0];
  function ballTexture(kind, n) {
    const hex = h => '#' + h.toString(16).padStart(6, '0'), sk = skin, colOf = k => sk.pal ? hex(sk.pal[(k - 1) % 8]) : ballCss(k);
    const W = 1024, H = 512, c = mkCanvas(W, H), g = c.getContext('2d'), ivory = hex(sk.cue);
    const dots = (bgc, dc, rad) => {
      g.fillStyle = bgc; g.fillRect(0, 0, W, H); g.fillStyle = dc;
      for (const u of [0, 0.25, 0.5, 0.75, 1]) { g.beginPath(); g.arc(u * W, H / 2, rad, 0, 7); g.fill(); }
      g.fillRect(0, 0, W, rad); g.fillRect(0, H - rad, W, rad);
    };
    const plain = bgc => { g.fillStyle = bgc; g.fillRect(0, 0, W, H); };
    if (kind === 'carom') {
      if (n === 0) sk.dots ? dots(ivory, '#c8201b', 0.11 / Math.PI * H) : plain(ivory);
      else if (n === 1) sk.dots ? dots(hex(sk.yel), '#b3261e', 0.11 / Math.PI * H) : plain(hex(sk.yel));
      else sk.dots ? dots(hex(sk.red), '#00000033', 0.2 / Math.PI * H) : plain(hex(sk.red));
    } else if (n === 0) sk.dots ? dots(ivory, '#c8201b', 0.13 / Math.PI * H) : plain(ivory);
    else {
      const stripe = n > 8, base = sk.noir ? '#141416' : ivory;
      g.fillStyle = stripe ? base : sk.noir ? '#141416' : colOf(n); g.fillRect(0, 0, W, H);
      if (stripe) { g.fillStyle = colOf(n); g.fillRect(0, H * 0.25, W, H * 0.5); }
      if (sk.noir && !stripe) { g.fillStyle = colOf(n); g.fillRect(0, H * 0.44, W, H * 0.12); }   // (a thin coloured belt round a solid)
      const rad = 0.5 / Math.PI * H;
      for (const u of [0.25, 0.75]) {
        g.fillStyle = sk.noir ? '#141416' : ivory; g.beginPath(); g.arc(u * W, H / 2, rad, 0, 7); g.fill();
        if (sk.noir) { g.strokeStyle = colOf(n); g.lineWidth = 6; g.stroke(); }
        g.fillStyle = sk.noir ? colOf(n) : '#111'; g.font = `bold ${n > 9 ? 84 : 104}px "Helvetica Neue",Arial,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(String(n), u * W, H / 2 + 6);
        if (n === 6 || n === 9) g.fillRect(u * W - 22, H / 2 + 46, 44, 7);
      }
    }
    // a set with a surface (marble, pearl...): its grey picture brightens and darkens the colours (overlay), once loaded
    const im = sk.mat && matOf(sk.mat); if (im) { g.globalCompositeOperation = 'overlay'; g.drawImage(im, 0, 0, W, H); g.globalCompositeOperation = 'source-over'; }
    return tex(c);
  }
  const mats = {};
  function matOf(m) {
    if (m in mats) return mats[m]; mats[m] = null; const u = TEXS['ball-' + m]; if (!u) return null;
    const im = new Image(); im.onload = () => { mats[m] = im; if (skin.mat === m) { const k = skin.id; skin = null; setBalls(k); } }; im.src = u; return null;
  }
  /* A photograph of one ball of a set, for the shelf cards: the ball drawn by this renderer into a small target, lit by
     the same room (so it looks as it will on the table), its number turned to the camera; kept once made. */
  const shots = {}; let shotRT = null, shotScene = null, shotBall = null, shotCam = null;
  function ballPortrait(id, kind, n) {
    const key = id + '/' + kind + '/' + n; if (shots[key]) return shots[key];
    const k = BALLSKINS.find(b => b.id === id) || BALLSKINS[0];
    if (!shotRT) {
      shotRT = new THREE.WebGLRenderTarget(160, 160); shotRT.texture.encoding = THREE.sRGBEncoding;
      shotScene = new THREE.Scene(); shotScene.environment = scene.environment;
      shotScene.add(new THREE.HemisphereLight(0xffffff, 0x303030, 0.35));
      const key = new THREE.DirectionalLight(0xfff4e6, 0.85); key.position.set(2.2, 2.4, 3); shotScene.add(key);
      shotBall = new THREE.Mesh(sphere, new THREE.MeshPhysicalMaterial({ roughness: 0.2, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 0.9 }));
      shotScene.add(shotBall); shotCam = new THREE.PerspectiveCamera(17, 1, 0.5, 20); shotCam.position.set(0, 0, 7); shotCam.lookAt(0, 0, 0);
    }
    const keep = skin; skin = k; const t = ballTexture(kind, n); skin = keep;
    const done = !k.mat || !!mats[k.mat];
    shotBall.material.map = t; shotBall.material.color.setScalar(0.72); shotBall.material.needsUpdate = true;   // (no tone mapping off screen: a shade darker to match the table) shotBall.rotation.set(0.25, -0.18, 0);
    const prev = renderer.getRenderTarget(), cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha();
    renderer.setRenderTarget(shotRT); renderer.setClearColor(0x000000, 0); unmask(); renderer.clear(); renderer.render(shotScene, shotCam);
    const px = new Uint8Array(160 * 160 * 4); renderer.readRenderTargetPixels(shotRT, 0, 0, 160, 160, px);
    renderer.setRenderTarget(prev); renderer.setClearColor(cc, ca); t.dispose();
    const c = mkCanvas(160, 160), g = c.getContext('2d'), im = g.createImageData(160, 160);
    for (let y = 0; y < 160; y++) im.data.set(px.subarray((159 - y) * 640, (160 - y) * 640), y * 640);   // (the target is upside down)
    g.putImageData(im, 0, 0); const url = c.toDataURL('image/png'); if (done) shots[key] = url; dirty = 3; staticDirty = true;
    return url;
  }
  function ballSet(kind, n, R) {
    const mesh = [], blob = [];
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(sphere, new THREE.MeshPhysicalMaterial({ map: ballTexture(kind, i), roughness: 0.2, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 0.7 }));
      m.scale.setScalar(R); m.visible = false; scene.add(m); mesh.push(m);
      const s = new THREE.Group(); s.visible = false; scene.add(s); blob.push(s);
      const c = new THREE.Mesh(unitPlane, blobMat); c.scale.set(R * 2.7, R * 2.7, 1); c.position.z = 0.0009; c.renderOrder = 1; s.add(c);
      for (let k = 0; k < LAMPS.length; k++) { const l = new THREE.Mesh(unitPlane, lampShadowMat); l.scale.set(R * 3.3, R * 3.3, 1); l.position.z = 0.0008; l.renderOrder = 1; s.add(l); }
    }
    return { mesh, blob, R };
  }
  const sets = { pool: ballSet('pool', 16, PH.pool.R), carom: ballSet('carom', 4, PH.carom.R) };
  // another ball set: each ball's picture drawn again (the meshes stay)
  let caromY = 1;                                                     // which carom ball wears the yellow (frame)
  function setBalls(id) {
    const k = BALLSKINS.find(b => b.id === id) || BALLSKINS[0]; if (k === skin) return; skin = k; caromY = 1;
    for (const [kind, set] of [['pool', sets.pool], ['carom', sets.carom]]) set.mesh.forEach((m, i) => { const old = m.material.map; m.material.map = ballTexture(kind, i); m.material.needsUpdate = true; old.dispose(); });
    dirty = 3;
  }

