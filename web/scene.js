/* three.js scene: tables, balls, cue, aiming guide. Built for a steady frame rate on tablets:
   everything that never moves (backdrop, table, its shadows) is drawn once into a texture and reused as the
   background of every frame, so a frame only draws the balls, the cue and the guide. Ball shadows are sprites,
   and the canvas resolution is fixed up front. */
const CLOTHS = [
  { id: 'teal', name: '딥 틸', felt: 0x0e8ba3, wood: 0x6a3a20 },
  { id: 'green', name: '클래식 그린', felt: 0x17894e, wood: 0x5a2f1a },
  { id: 'blue', name: '토너먼트 블루', felt: 0x2a78d2, wood: 0x15171c },
  { id: 'wine', name: '버건디', felt: 0x9a2536, wood: 0xa9743f },
  { id: 'charcoal', name: '차콜', felt: 0x4b5562, wood: 0x15171c },
];
const CUES = [
  { id: 'maple', name: '메이플 클래식', note: '단풍나무 상대에 흑단 하대, 네 갈래 포인트', shaft: 0xe2c592, ferrule: 0xf4efe2, tip: 0x4aa3c7, joint: 0xd9ab52, fore: 0x2a1710, points: 0xf1e7cf, wrap: 0x14110f, sleeve: 0x2a1710 },
  { id: 'carbon', name: '블랙 카본', note: '검은 카본 상대, 무광 하대에 붉은 링', shaft: 0x1c1e22, ferrule: 0x1c1e22, tip: 0x3c6fd0, joint: 0xe2392b, fore: 0x121316, points: null, wrap: 0x2b2e34, sleeve: 0x121316 },
  { id: 'rose', name: '로즈우드 인레이', note: '붉은 장미목 하대, 금색 포인트와 흰 리넨 그립', shaft: 0xe6cfa0, ferrule: 0xf4efe2, tip: 0x4aa3c7, joint: 0xf1e7cf, fore: 0x7a2c1c, points: 0xd9ab52, wrap: 0xece4d2, sleeve: 0x7a2c1c },
  { id: 'house', name: '하우스 큐', note: '당구장 벽에 걸린 통짜 나무 큐', shaft: 0xdcb87c, ferrule: 0xf4efe2, tip: 0x4aa3c7, joint: 0xc79556, fore: 0xc79556, points: null, wrap: 0xb5793f, sleeve: 0x8a5a2c },
  { id: 'sport', name: '스포츠 그립', note: '흰 상대, 남색 하대에 노란 고무 그립', shaft: 0xf2f2ee, ferrule: 0xf2f2ee, tip: 0x2037c9, joint: 0xff5a3c, fore: 0x1a1f4d, points: null, wrap: 0xffd21f, sleeve: 0x1a1f4d },
];
const BALL_HEX = [0xf4efe2, 0xf2b705, 0x1747b8, 0xd3241c, 0x5a2a93, 0xee7410, 0x0c7a44, 0x7c1a20, 0x111111];
const ballHex = n => BALL_HEX[n === 0 ? 0 : n <= 8 ? n : n - 8];
const ballCss = n => '#' + ballHex(n).toString(16).padStart(6, '0');

function createScene(canvas, app, PH) {
  if (!window.THREE) return null;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); } catch (e) { return null; }
  const RW = 0.095, RAIL_Z = 0.04, FOV = 34;
  const LAMPS = [[-0.78, 0, 1.05], [0, 0, 1.05], [0.78, 0, 1.05]];   // three shades hanging over the long axis
  const { HL, HW, CW } = PH.pool;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.autoClear = false;
  const sScene = new THREE.Scene(), scene = new THREE.Scene();   // static layer, moving layer
  sScene.background = new THREE.Color(0x101216).convertSRGBToLinear();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 30);
  const col = h => new THREE.Color(h).convertSRGBToLinear();
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const tex = (c, rep) => {
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = aniso;
    if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); }
    return t;
  };

  /* reflections for the balls: a dim room with three lamp panels overhead */
  (function env() {
    const es = new THREE.Scene(); es.background = new THREE.Color(0x0c0b0a);
    const panel = (w, h, x, y, z, hex, k) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), side: THREE.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m);
    };
    panel(0.9, 0.5, -1.0, 0.25, 2.2, 0xfff4e2, 5); panel(0.9, 0.5, 0, 0.25, 2.3, 0xfff4e2, 5); panel(0.9, 0.5, 1.0, 0.25, 2.2, 0xfff4e2, 5);
    panel(6, 2.5, 0, 5, 1.2, 0x6a5a4a, 0.5); panel(6, 2.5, 0, -5, 1.2, 0x4a4038, 0.4);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = sScene.environment = pm.fromScene(es, 0.03).texture; pm.dispose();
  })();

  for (const sc of [sScene, scene]) {
    const hemi = new THREE.HemisphereLight(0xe8ecf2, 0x2a2622, 0.27); hemi.position.set(0, 0, 1); sc.add(hemi);
    for (const [x, y, z] of LAMPS) {
      const lamp = new THREE.SpotLight(0xfff1dc, 0.58, 0, 1.05, 0.9, 1);
      lamp.position.set(x, y, z); lamp.target.position.set(x, y, 0);
      if (sc === sScene) {
        lamp.castShadow = true; lamp.shadow.mapSize.set(2048, 2048);
        lamp.shadow.camera.near = 0.2; lamp.shadow.camera.far = 3; lamp.shadow.bias = -0.0006; lamp.shadow.normalBias = 0.003;
      }
      sc.add(lamp, lamp.target);
    }
  }
  // the static layer and the full-screen quad that shows it
  let rt = null, staticDirty = true;
  const quadMat = new THREE.MeshBasicMaterial({ toneMapped: false, depthTest: false, depthWrite: false });
  const quadScene = new THREE.Scene(), quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  quadScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), quadMat));

  /* floor under the table: one flat colour chosen by the UI theme, plus the table's own soft shadow */
  const floorMat = new THREE.MeshBasicMaterial({ color: col(0x101216), toneMapped: false });
  (function backdrop() {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), floorMat); m.position.z = -0.8; sScene.add(m);
    const s = mkCanvas(512, 320), sg = s.getContext('2d');
    sg.shadowColor = 'rgba(0,0,0,0.8)'; sg.shadowBlur = 52; sg.fillStyle = 'rgba(0,0,0,0.8)';
    const rr = (x, y, w, h, r) => { sg.beginPath(); sg.moveTo(x + r, y); sg.arcTo(x + w, y, x + w, y + h, r); sg.arcTo(x + w, y + h, x, y + h, r); sg.arcTo(x, y + h, x, y, r); sg.arcTo(x, y, x + w, y, r); sg.fill(); };
    rr(70, 60, 372, 200, 26);
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 2.81), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(s), transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }));
    sm.position.set(0, -0.05, -0.79); sScene.add(sm);
  })();
  function setBackdrop(hex) { floorMat.color.copy(col(hex)); sScene.background.copy(col(hex)); staticDirty = true; dirty = 3; }

  /* shared table materials */
  const fc = mkCanvas(256, 256), fg = fc.getContext('2d');
  const fid = fg.createImageData(256, 256);
  for (let i = 0; i < fid.data.length; i += 4) { const v = 226 + (Math.random() * 30 - 15); fid.data[i] = fid.data[i + 1] = fid.data[i + 2] = v; fid.data[i + 3] = 255; }
  fg.putImageData(fid, 0, 0);
  const feltTex = tex(fc, 9);
  const feltMat = new THREE.MeshStandardMaterial({ map: feltTex, bumpMap: feltTex, bumpScale: 0.0005, roughness: 1, metalness: 0, envMapIntensity: 0.1 });
  const cushMat = new THREE.MeshStandardMaterial({ map: feltTex, bumpMap: feltTex, bumpScale: 0.0005, roughness: 1, metalness: 0, envMapIntensity: 0.1, side: THREE.DoubleSide });
  const wc = mkCanvas(512, 512), wg = wc.getContext('2d');
  wg.fillStyle = '#c9a27c'; wg.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 420; i++) {
    const y = Math.random() * 512, a = 0.05 + Math.random() * 0.16;
    wg.strokeStyle = Math.random() < 0.6 ? `rgba(40,20,8,${a})` : `rgba(255,220,170,${a * 0.6})`;
    wg.lineWidth = 0.6 + Math.random() * 2.2; wg.beginPath(); wg.moveTo(0, y);
    wg.bezierCurveTo(170, y + (Math.random() - 0.5) * 16, 340, y + (Math.random() - 0.5) * 16, 512, y); wg.stroke();
  }
  const woodMat = new THREE.MeshPhysicalMaterial({ map: tex(wc, 1.4), roughness: 0.42, metalness: 0, clearcoat: 0.9, clearcoatRoughness: 0.12, envMapIntensity: 0.45 });
  const metalMat = new THREE.MeshStandardMaterial({ color: col(0xb08d4a), roughness: 0.34, metalness: 1, envMapIntensity: 0.9 });
  // soft darkening where the cloth meets the cushions: one continuous inner shadow, no seams at the pockets
  const aoC = mkCanvas(1024, 512), aoG = aoC.getContext('2d');
  aoG.fillStyle = 'rgba(0,0,0,0.42)'; aoG.fillRect(0, 0, 1024, 512);
  aoG.globalCompositeOperation = 'destination-out'; aoG.filter = 'blur(22px)'; aoG.fillStyle = '#000'; aoG.fillRect(30, 30, 964, 452);
  aoG.filter = 'none'; aoG.globalCompositeOperation = 'source-over';
  const aoMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(aoC), transparent: true, depthWrite: false });

  const pearl = new THREE.MeshStandardMaterial({ color: col(0xf6efdc), roughness: 0.3, metalness: 0, envMapIntensity: 0.8 });
  const markMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, depthWrite: false });

  function buildTable(P) {
    const grp = new THREE.Group(), { POCKETS, CUSHIONS } = P, Xb = HL + CW, Yb = HW + CW, ox = Xb + RW, oy = Yb + RW, rr = 0.1, bev = 0.007;
    // cloth bed
    const bx = HL + 0.105, by = HW + 0.118;
    const bed = new THREE.Shape(); bed.moveTo(-bx, -by); bed.lineTo(bx, -by); bed.lineTo(bx, by); bed.lineTo(-bx, by); bed.closePath();
    for (const p of POCKETS) { const h = new THREE.Path(); h.absarc(p.x, p.y, p.r, 0, Math.PI * 2, false); bed.holes.push(h); }
    const bedMesh = new THREE.Mesh(new THREE.ShapeGeometry(bed, 40), feltMat); bedMesh.receiveShadow = true; grp.add(bedMesh);
    const ao = new THREE.Mesh(new THREE.PlaneGeometry(HL * 2, HW * 2), aoMat); ao.position.z = 0.0007; grp.add(ao);
    // markings
    const dot = (x, y) => { const d = new THREE.Mesh(new THREE.CircleGeometry(0.007, 20), markMat); d.position.set(x, y, 0.0005); grp.add(d); };
    dot(HL / 2, 0); dot(-HL / 2, 0);
    if (P.POCKETED) { const line = new THREE.Mesh(new THREE.PlaneGeometry(0.003, HW * 2), markMat); line.position.set(-HL / 2, 0, 0.0004); grp.add(line); } else dot(0, 0);
    // pocket pits
    const pit = new THREE.MeshBasicMaterial({ color: 0x0b0908, side: THREE.BackSide }), pitB = new THREE.MeshBasicMaterial({ color: 0x000000 });
    for (const p of POCKETS) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r * 0.86, 0.16, 36, 1, true), pit);
      w.rotation.x = Math.PI / 2; w.position.set(p.x, p.y, -0.08); grp.add(w);
      const b = new THREE.Mesh(new THREE.CircleGeometry(p.r, 28), pitB); b.position.set(p.x, p.y, -0.16); grp.add(b);
    }
    // rails
    const rail = new THREE.Shape();
    rail.moveTo(-ox + rr, -oy); rail.lineTo(ox - rr, -oy); rail.absarc(ox - rr, -oy + rr, rr, -Math.PI / 2, 0, false);
    rail.lineTo(ox, oy - rr); rail.absarc(ox - rr, oy - rr, rr, 0, Math.PI / 2, false);
    rail.lineTo(-ox + rr, oy); rail.absarc(-ox + rr, oy - rr, rr, Math.PI / 2, Math.PI, false);
    rail.lineTo(-ox, -oy + rr); rail.absarc(-ox + rr, -oy + rr, rr, Math.PI, Math.PI * 1.5, false);
    const hole = new THREE.Path();
    if (P.POCKETED) {
      const arcs = POCKETS.map(p => {
        if (!p.corner) { const sy = Math.sign(p.y); return { p, e: [-sy * p.r, sy * Yb], x: [sy * p.r, sy * Yb] }; }
        const sx = Math.sign(p.x), sy = Math.sign(p.y), s = Math.sqrt(p.r * p.r - (CW - P.PO) ** 2);
        const pv = [sx * Xb, p.y - sy * s], ph = [p.x - sx * s, sy * Yb];
        return sx * sy < 0 ? { p, e: pv, x: ph } : { p, e: ph, x: pv };
      });
      for (const a of arcs) { a.a0 = Math.atan2(a.e[1] - a.p.y, a.e[0] - a.p.x); a.a1 = Math.atan2(a.x[1] - a.p.y, a.x[0] - a.p.x); }
      hole.moveTo(arcs[0].x[0], arcs[0].x[1]);
      for (const i of [1, 2, 3, 4, 5, 0]) { const a = arcs[i]; hole.lineTo(a.e[0], a.e[1]); hole.absarc(a.p.x, a.p.y, a.p.r, a.a0, a.a1, true); }
            for (const a of arcs) {
        let len = a.a0 - a.a1; while (len < 0) len += Math.PI * 2;
        const m = new THREE.Mesh(new THREE.RingGeometry(a.p.r + bev, a.p.r + 0.019, 40, 1, a.a1, len), metalMat);
        m.position.set(a.p.x, a.p.y, RAIL_Z + 0.0006); grp.add(m);
      }
    } else { hole.moveTo(-Xb, -Yb); hole.lineTo(-Xb, Yb); hole.lineTo(Xb, Yb); hole.lineTo(Xb, -Yb); hole.closePath(); }
    rail.holes.push(hole);
    const rg = new THREE.ExtrudeGeometry(rail, { depth: 0.12, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 4, curveSegments: 24 });
    rg.translate(0, 0, RAIL_Z - 0.12 - bev);
    const railMesh = new THREE.Mesh(rg, woodMat); railMesh.castShadow = true; railMesh.receiveShadow = true; grp.add(railMesh);
    // sights
    const dg = new THREE.CircleGeometry(0.0095, 4);
    const sight = (x, y, turn) => { const m = new THREE.Mesh(dg, pearl); if (turn) m.rotation.z = Math.PI / 2; m.position.set(x, y, RAIL_Z + 0.0006); grp.add(m); };
    for (const k of P.POCKETED ? [-3, -2, -1, 1, 2, 3] : [-3, -2, -1, 0, 1, 2, 3]) for (const sy of [-1, 1]) sight(k * HL / 4, sy * (Yb + RW * 0.52));
    for (const k of [-1, 0, 1]) for (const sx of [-1, 1]) sight(sx * (Xb + RW * 0.52), k * HW / 2, true);
    // cushions
    for (const cu of CUSHIONS) {
      const back = pt => cu.o[0] !== 0 ? [cu.o[0] * Xb, pt[1]] : [pt[0], cu.o[1] * Yb];
      const top = [[...cu.ja, 0.038], [...cu.a, 0.0355], [...cu.b, 0.0355], [...cu.jb, 0.038], [...back(cu.jb), RAIL_Z], [...back(cu.ja), RAIL_Z]];
      const v = [], uv = [];
      const tri = (a, b, c) => { for (const p of [a, b, c]) { v.push(p[0], p[1], p[2]); uv.push(p[0], p[1]); } };
      for (let i = 1; i < 5; i++) tri(top[0], top[i], top[i + 1]);
      for (let i = 0; i < 3; i++) { const a = top[i], b = top[i + 1], a0 = [a[0], a[1], 0], b0 = [b[0], b[1], 0]; tri(a, a0, b); tri(b, a0, b0); }
      const g2 = new THREE.BufferGeometry();
      g2.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g2.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g2.computeVertexNormals();
      const m = new THREE.Mesh(g2, cushMat); m.castShadow = true; m.receiveShadow = true; grp.add(m);
    }
    grp.visible = false; sScene.add(grp);
    return grp;
  }
  const tables = { pool: buildTable(PH.pool), carom: buildTable(PH.carom) };
  let tableKind = null;
  function setTable(kind) {
    if (tableKind === kind) return;
    tableKind = kind; tables.pool.visible = kind === 'pool'; tables.carom.visible = kind === 'carom';
    for (const m of sets.pool.mesh) m.visible = false; for (const m of sets.pool.blob) m.visible = false;
    for (const m of sets.carom.mesh) m.visible = false; for (const m of sets.carom.blob) m.visible = false;
    falls.length = 0; guideKey = ''; renderer.shadowMap.needsUpdate = true; staticDirty = true; dirty = 3;
  }
  function setCloth(i) {
    const c = CLOTHS[i] || CLOTHS[0];
    feltMat.color.copy(col(c.felt)); cushMat.color.copy(col(c.felt)).multiplyScalar(0.8); woodMat.color.copy(col(c.wood)).multiplyScalar(1.5);
    staticDirty = true; dirty = 3;
  }

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
  function ballTexture(kind, n) {
    const W = 1024, H = 512, c = mkCanvas(W, H), g = c.getContext('2d'), ivory = '#f4efe2';
    const dots = (bgc, dc, rad) => {
      g.fillStyle = bgc; g.fillRect(0, 0, W, H); g.fillStyle = dc;
      for (const u of [0, 0.25, 0.5, 0.75, 1]) { g.beginPath(); g.arc(u * W, H / 2, rad, 0, 7); g.fill(); }
      g.fillRect(0, 0, W, rad); g.fillRect(0, H - rad, W, rad);
    };
    if (kind === 'carom') {
      if (n === 0) dots(ivory, '#c8201b', 0.11 / Math.PI * H);
      else if (n === 1) dots('#f4c20d', '#b3261e', 0.11 / Math.PI * H);
      else dots('#d3241c', '#9c1712', 0.2 / Math.PI * H);
    } else if (n === 0) dots(ivory, '#c8201b', 0.13 / Math.PI * H);
    else {
      const stripe = n > 8;
      g.fillStyle = stripe ? ivory : ballCss(n); g.fillRect(0, 0, W, H);
      if (stripe) { g.fillStyle = ballCss(n); g.fillRect(0, H * 0.25, W, H * 0.5); }
      const rad = 0.5 / Math.PI * H;
      for (const u of [0.25, 0.75]) {
        g.fillStyle = ivory; g.beginPath(); g.arc(u * W, H / 2, rad, 0, 7); g.fill();
        g.fillStyle = '#111'; g.font = `bold ${n > 9 ? 84 : 104}px "Helvetica Neue",Arial,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(String(n), u * W, H / 2 + 6);
        if (n === 6 || n === 9) g.fillRect(u * W - 22, H / 2 + 46, 44, 7);
      }
    }
    return tex(c);
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

  /* cue stick */
  const cue = new THREE.Group(); cue.rotation.order = 'ZYX'; scene.add(cue);
  const cueShadow = new THREE.Mesh(unitPlane, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
  cueShadow.renderOrder = 1; scene.add(cueShadow);
  function setCue(i) {
    const d = CUES[i] || CUES[0];
    while (cue.children.length) { const m = cue.children.pop(); m.geometry.dispose(); if (m.material.map) m.material.map.dispose(); m.material.dispose(); }
    const part = (x0, x1, r0, r1, mat) => {
      const g = new THREE.CylinderGeometry(r1, r0, x1 - x0, 20); g.rotateZ(-Math.PI / 2); g.translate((x0 + x1) / 2, 0, 0);
      cue.add(new THREE.Mesh(g, mat));
    };
    const std = (h, ro, me) => new THREE.MeshStandardMaterial({ color: col(h), roughness: ro, metalness: me || 0, envMapIntensity: 0.5 });
    part(0, 0.012, 0.006, 0.0062, std(d.tip, 0.9));
    part(0.012, 0.04, 0.0062, 0.0064, std(d.ferrule, 0.4));
    part(0.04, 0.74, 0.0064, 0.0104, std(d.shaft, 0.42));
    part(0.74, 0.756, 0.0107, 0.0108, std(d.joint, 0.3, 0.6));
    let fore = std(d.fore, 0.36);
    if (d.points != null) {
      const c = mkCanvas(128, 256), g = c.getContext('2d');
      g.fillStyle = '#' + d.fore.toString(16).padStart(6, '0'); g.fillRect(0, 0, 128, 256);
      g.fillStyle = '#' + d.points.toString(16).padStart(6, '0');
      for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(k * 32 + 4, 256); g.lineTo(k * 32 + 28, 256); g.lineTo(k * 32 + 16, 36); g.fill(); }
      fore = new THREE.MeshStandardMaterial({ map: tex(c), roughness: 0.36, metalness: 0, envMapIntensity: 0.5 });
    }
    part(0.756, 1.03, 0.0106, 0.0122, fore);
    part(1.03, 1.3, 0.0122, 0.0136, std(d.wrap, 0.85));
    part(1.3, 1.45, 0.0136, 0.0146, std(d.sleeve, 0.36));
    part(1.45, 1.47, 0.0146, 0.0142, std(0x0d0d0d, 0.9));
    dirty = 3;
  }

  /* aiming guide, drawn at ball-centre height so it lines up under perspective */
  const guide = new THREE.Group(); scene.add(guide);
  const gMat = o => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: o, depthTest: false, depthWrite: false, toneMapped: false });
  const gLine = new THREE.Mesh(unitPlane, gMat(0.95)), gObj = new THREE.Mesh(unitPlane, gMat(0.9)), gCue = new THREE.Mesh(unitPlane, gMat(0.55)), gBank = new THREE.Mesh(unitPlane, gMat(0.6));
  const gRing = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 40), gMat(0.95));
  const gHand = new THREE.Mesh(new THREE.RingGeometry(1.55, 1.78, 40), new THREE.MeshBasicMaterial({ color: col(0xffd21f), transparent: true, opacity: 0.95, depthTest: false, depthWrite: false, toneMapped: false }));
  const dotGeo = new THREE.CircleGeometry(1, 14), dotMat = gMat(0.95), gDots = [];
  dotMat.color.copy(col(0xffd21f));
  for (let i = 0; i < 44; i++) { const d = new THREE.Mesh(dotGeo, dotMat); d.renderOrder = 10; d.visible = false; guide.add(d); gDots.push(d); }
  for (const m of [gLine, gObj, gCue, gBank, gRing, gHand]) { m.renderOrder = 10; guide.add(m); }
  let ppm = 200, guideKey = '', pathPts = [];
  function setLine(m, x0, y0, x1, y1, px, z) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 1e-4) { m.visible = false; return; }
    m.visible = true; m.position.set((x0 + x1) / 2, (y0 + y1) / 2, z); m.rotation.z = Math.atan2(y1 - y0, x1 - x0); m.scale.set(len, px / ppm, 1);
  }

  /* layout: the table is fitted inside the insets; the insets ease when the screen changes */
  let portrait = false, dirty = 3, quality = 'auto', W = 0, H = 0;
  const ins = { t: 60, l: 62, r: 70, b: 6 }, insTo = { t: 60, l: 62, r: 70, b: 6 };
  function applyCamera() {
    if (!W || !H) return;
    const sw = Math.max(40, W - ins.l - ins.r), sh = Math.max(40, H - ins.t - ins.b), cx = ins.l + sw / 2, cy = ins.t + sh / 2;
    const TW = 2 * (HL + CW + RW) + 0.03, TH = 2 * (HW + CW + RW) + 0.03;
    ppm = portrait ? Math.min(sw / TH, sh / TW) : Math.min(sw / TW, sh / TH);
    const fw = 2 * Math.max(cx, W - cx), fh = 2 * Math.max(cy, H - cy);
    camera.aspect = fw / fh; camera.position.set(0, 0, fh / (2 * ppm * Math.tan(FOV * Math.PI / 360)));
    camera.up.set(portrait ? 1 : 0, portrait ? 0 : 1, 0); camera.lookAt(0, 0, 0);
    camera.setViewOffset(fw, fh, fw / 2 - cx, fh / 2 - cy, W, H);
    guideKey = ''; staticDirty = true; dirty = 3;
  }
  function resize() {
    W = app.clientWidth; H = app.clientHeight; if (!W || !H) return;
    portrait = H > W;
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
  function setInsets(t, instant) {
    Object.assign(insTo, t);
    if (instant) { Object.assign(ins, t); applyCamera(); }
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

  const falls = [];
  function fall(P, id, x, y, pocket) { const p = P.POCKETS[pocket]; falls.push({ id, t: 0, x0: x, y0: y, x1: p.x, y1: p.y }); }

  /* one frame. v: { game, alpha, aim, power, pull, showCue, showGuide, level, spin, legalIds } */
  function frame(v, dt) {
    let moved = false;
    for (const k of ['t', 'l', 'r', 'b']) { const d = insTo[k] - ins[k]; if (Math.abs(d) > 0.5) { ins[k] += d * Math.min(1, dt * 9); moved = true; } else ins[k] = insTo[k]; }
    if (moved) applyCamera();
    if (falls.length || v.animating) dirty = 3;
    if (dirty <= 0) return false; dirty--;
    const g = v.game, P = g.P, w = g.world, R = P.R, set = sets[g.mode.table], a = v.alpha;
    for (let i = 0; i < set.mesh.length; i++) {
      const b = w.balls[i], m = set.mesh[i], s = set.blob[i];
      const on = !!b && b.on; s.visible = on;
      if (on) {
        const x = b.px + (b.x - b.px) * a, y = b.py + (b.y - b.py) * a;
        m.visible = true; m.scale.setScalar(R); m.position.set(x, y, R);
        const q = b.q, l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; q[0] /= l; q[1] /= l; q[2] /= l; q[3] /= l;
        m.quaternion.set(q[0], q[1], q[2], q[3]);
        s.children[0].position.x = x; s.children[0].position.y = y;
        for (let k = 0; k < LAMPS.length; k++) { const L = LAMPS[k], f = R / (L[2] - R), c2 = s.children[k + 1]; c2.position.x = x + (x - L[0]) * f; c2.position.y = y + (y - L[1]) * f; }
      } else if (!falls.some(f => f.id === i)) m.visible = false;
    }
    for (let i = falls.length - 1; i >= 0; i--) {
      const f = falls[i], m = set.mesh[f.id]; f.t += dt; const k = Math.min(1, f.t / 0.22);
      // no depth against the baked table, so a dropping ball shrinks into the pocket instead of sinking behind the rail
      if (m) { m.visible = k < 1; m.position.set(f.x0 + (f.x1 - f.x0) * k, f.y0 + (f.y1 - f.y0) * k, R); m.scale.setScalar(R * (1 - 0.5 * k * k)); }
      if (k >= 1) falls.splice(i, 1);
    }
    const c = w.balls[w.cue];
    cue.visible = cueShadow.visible = v.showCue && c.on; guide.visible = v.showGuide && c.on;
    if (cue.visible) {
      const dx = Math.cos(v.aim), dy = Math.sin(v.aim);
      const tx = c.x - dx * (R + v.pull), ty = c.y - dy * (R + v.pull);
      cue.position.set(tx, ty, R + 0.002); cue.rotation.set(0, -0.085, v.aim + Math.PI);
      const sx = tx - dx * 0.735 + 0.012, sy = ty - dy * 0.735 - 0.014;
      cueShadow.position.set(sx, sy, 0.0012); cueShadow.rotation.z = v.aim; cueShadow.scale.set(1.47, 0.022, 1);
    }
    if (guide.visible) {
      const dx = Math.cos(v.aim), dy = Math.sin(v.aim), lv = v.level;
      const key = [v.aim.toFixed(5), c.x.toFixed(4), c.y.toFixed(4), lv, v.power.toFixed(2), v.spin.x.toFixed(2), v.spin.y.toFixed(2), ppm.toFixed(1), g.turn, v.rev].join('|');
      if (key !== guideKey) {
        guideKey = key;
        const pr = P.cast(w, c.x, c.y, dx, dy, w.cue);
        gLine.visible = gRing.visible = gObj.visible = gCue.visible = gBank.visible = false;
        for (const d of gDots) d.visible = false;
        if (lv >= 1) {
          setLine(gLine, c.x + dx * R, c.y + dy * R, pr.gx - dx * R * 0.9, pr.gy - dy * R * 0.9, 1.7, R);
          gRing.visible = pr.type !== 'none' && pr.type !== 'pocket'; gRing.position.set(pr.gx, pr.gy, R); gRing.scale.setScalar(R);
          const legal = pr.type !== 'ball' || v.legalIds.indexOf(pr.ball) >= 0, tint = legal ? 0xffffff : 0xff6a58;
          gRing.material.color.set(tint); gObj.material.color.set(tint);
        }
        if (lv >= 2 && pr.type === 'ball') {
          const b = w.balls[pr.ball], co = Math.cos(pr.cut);
          let l1 = 0.06 + 0.26 * co;
          if (lv >= 3) { const h = P.cast(w, b.x, b.y, pr.nx, pr.ny, pr.ball); l1 = Math.max(0.02, h.t - R * 0.2); }
          setLine(gObj, b.x + pr.nx * R, b.y + pr.ny * R, b.x + pr.nx * (R + l1), b.y + pr.ny * (R + l1), 2.1, R);
          if (lv === 2) {
            let tx = dx - co * pr.nx, ty = dy - co * pr.ny; const tl = Math.hypot(tx, ty);
            if (tl > 0.02) { tx /= tl; ty /= tl; const l2 = 0.3 * tl; setLine(gCue, pr.gx + tx * R, pr.gy + ty * R, pr.gx + tx * (R + l2), pr.gy + ty * (R + l2), 1.5, R); }
          }
        }
        if (lv >= 2 && pr.type === 'rail') {
          const dn = dx * pr.nx + dy * pr.ny, rx = dx - 2 * dn * pr.nx, ry = dy - 2 * dn * pr.ny;
          let l = 0.22;
          if (lv >= 3) { const h = P.cast(w, pr.gx + rx * 0.001, pr.gy + ry * 0.001, rx, ry, w.cue); l = Math.min(h.t, 2.6); }
          setLine(gBank, pr.gx, pr.gy, pr.gx + rx * l, pr.gy + ry * l, 1.5, R);
        }
        if (lv >= 3 && pr.type === 'ball') {
          // where the cue ball goes afterwards, with the chosen spin
          pathPts = P.cuePath(w, v.aim, g.vOf(v.power > 0.03 ? v.power : 0.45), v.spin.x * 0.5, v.spin.y * 0.5, 2.4);
          let acc = 0, n = 0, lx = pathPts[0], ly = pathPts[1];
          for (let i = 2; i < pathPts.length && n < gDots.length; i += 2) {
            const x = pathPts[i], y = pathPts[i + 1]; acc += Math.hypot(x - lx, y - ly); lx = x; ly = y;
            if (acc >= 0.042) { acc = 0; const d = gDots[n++]; d.visible = true; d.position.set(x, y, R); d.scale.setScalar(Math.max(0.004, 3.1 / ppm)); }
          }
        }
      }
      gHand.visible = !!v.hand; gHand.position.set(c.x, c.y, R); gHand.scale.setScalar(R);
    }
    if (staticDirty && rt) { staticDirty = false; renderer.setRenderTarget(rt); renderer.clear(); renderer.render(sScene, camera); renderer.setRenderTarget(null); }
    renderer.clear(); renderer.render(quadScene, quadCam); renderer.clearDepth(); renderer.render(scene, camera);
    return true;
  }

  return {
    setTable, setCloth, setCue, setBackdrop, setInsets, setQuality, resize, toTable, frame, fall,
    invalidate() { dirty = 3; }, get ppm() { return ppm; }, get portrait() { return portrait; },
    get pixelRatio() { return renderer.getPixelRatio(); },
  };
}
