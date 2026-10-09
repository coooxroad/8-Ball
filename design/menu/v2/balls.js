/* Real 3D balls for the menu mockups: the same kind of ball the game draws (ivory, numbers, stripes, carom balls), lit by
   soft boxes so they shine like the ones on the table. renderBalls(canvas, { balls: [{ id, x, y, r, spin }], floor, aim })
   x, y, r in CSS pixels of the canvas. */
(function () {
  const POOL = { 1: '#e8b100', 2: '#1b3a9c', 3: '#c62a1d', 4: '#5a2a86', 5: '#e06a12', 6: '#1f7a3a', 7: '#7a1f1f', 8: '#121212', 9: '#e8b100', 10: '#1b3a9c', 11: '#c62a1d', 12: '#5a2a86', 13: '#e06a12', 14: '#1f7a3a', 15: '#7a1f1f' };
  const ivory = '#f4efe2';
  function texture(id) {
    const W = 1024, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    const dots = (bg, dc, rad) => { g.fillStyle = bg; g.fillRect(0, 0, W, H); g.fillStyle = dc; for (const u of [0, 0.25, 0.5, 0.75, 1]) { g.beginPath(); g.arc(u * W, H / 2, rad, 0, 7); g.fill(); } };
    if (id === 'cue') dots(ivory, '#c8201b', 0.12 / Math.PI * H);
    else if (id === 'red') dots('#d3241c', '#9c1712', 0.2 / Math.PI * H);
    else if (id === 'yellow') dots('#f4c20d', '#b3261e', 0.11 / Math.PI * H);
    else if (id === 'white') dots(ivory, '#c8201b', 0.11 / Math.PI * H);
    else {
      const n = +id, stripe = n > 8; g.fillStyle = stripe ? ivory : POOL[n]; g.fillRect(0, 0, W, H);
      if (stripe) { g.fillStyle = POOL[n]; g.fillRect(0, H * 0.25, W, H * 0.5); }
      for (const u of [0.25, 0.75]) {
        g.fillStyle = ivory; g.beginPath(); g.arc(u * W, H / 2, 0.5 / Math.PI * H, 0, 7); g.fill();
        g.fillStyle = '#111'; g.font = `bold ${n > 9 ? 84 : 104}px Arial,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), u * W, H / 2 + 6);
      }
    }
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t;
  }
  function env(renderer, warm) {
    const s = new THREE.Scene(); s.background = new THREE.Color(0x06090f);
    const box = (w, h, x, y, z, col, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m); };
    box(3.2, 1.2, -1.5, 3, 6, 0xffffff, 6);     // the lamp over the table: one small bright box, for a crisp highlight
    box(1.6, 4, -6, 1, 1, warm ? 0xffd9a8 : 0x8fb8ff, 0.5);
    box(1.6, 4, 6, -1, 1, warm ? 0xfff0dc : 0xbcd6ff, 0.35);
    box(9, 2, 0, -6, 1, 0x2a7a80, 0.35);       // the cloth, bouncing a little colour back
    return new THREE.PMREMGenerator(renderer).fromScene(s, 0.03).texture;
  }
  window.renderBalls = function (canvas, o) {
    const dpr = 2, w = canvas.clientWidth, h = canvas.clientHeight;
    const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
    r.setPixelRatio(dpr); r.setSize(w, h, false); r.outputEncoding = THREE.sRGBEncoding; r.toneMapping = THREE.NoToneMapping;
    const scene = new THREE.Scene(), envMap = env(r, o.warm);
    // orthographic in pixels, looking down a little so the balls show their tops
    const cam = new THREE.OrthographicCamera(0, w, 0, -h, -2000, 2000); cam.position.set(0, 0, 1000);
    const key = new THREE.DirectionalLight(0xffffff, 2.0); key.position.set(-0.5, 0.8, 1); scene.add(key);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x203040, 0.35));
    const shadowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,.65)'); gr.addColorStop(0.55, 'rgba(0,0,0,.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); })();
    for (const b of o.balls) {
      if (o.floor !== false) { const s = new THREE.Mesh(new THREE.PlaneGeometry(b.r * 3.2, b.r * 2.2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })); s.position.set(b.x + b.r * 0.35, -(b.y + b.r * 0.62), -b.r * 2); scene.add(s); }
      const m = new THREE.Mesh(new THREE.SphereGeometry(b.r, 64, 48), new THREE.MeshPhysicalMaterial({ map: texture(b.id), roughness: 0.35, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, envMap, envMapIntensity: 0.8 }));
      m.position.set(b.x, -b.y, 0); m.rotation.set(b.tilt == null ? -0.3 : b.tilt, b.spin == null ? 0.35 : b.spin, b.roll || 0); scene.add(m);
    }
    r.render(scene, cam);
  };
})();
