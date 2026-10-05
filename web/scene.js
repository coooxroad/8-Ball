/* three.js scene: tables, balls, cue, aiming guide. Built for a steady frame rate on tablets:
   everything that never moves (backdrop, table, its shadows) is drawn once into a texture and reused as the
   background of every frame, so a frame only draws the balls, the cue and the guide. Ball shadows are sprites,
   and the canvas resolution is fixed up front. */
function createScene(canvas, app, PH) {
  if (!window.THREE) return null;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); } catch (e) { return null; }
  const RW = 0.095, RAIL_Z = 0.04, FOV = 40;
  const LAMPS = [[-0.78, 0, 1.05], [0, 0, 1.05], [0.78, 0, 1.05]];   // three shades hanging over the long axis
  const CW = PH.pool.CW;
  let cur = PH.pool;                                                  // the table being shown
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

  const lampObjs = [];
  for (const sc of [sScene, scene]) {
    const hemi = new THREE.HemisphereLight(0xe8ecf2, 0x2a2622, 0.27); hemi.position.set(0, 0, 1); sc.add(hemi);
    for (const [x, y, z] of LAMPS) {
      const lamp = new THREE.SpotLight(0xfff1dc, 0.58, 0, 1.05, 0.9, 1);
      lamp.position.set(x, y, z); lamp.target.position.set(x, y, 0);
      if (sc === sScene) {
        lamp.castShadow = true; lamp.shadow.mapSize.set(2048, 2048);
        lamp.shadow.camera.near = 0.2; lamp.shadow.camera.far = 3; lamp.shadow.bias = -0.0006; lamp.shadow.normalBias = 0.003;
      }
      sc.add(lamp, lamp.target); lampObjs.push(lamp);
    }
  }
  // the static layer and the full-screen quad that shows it
  let rt = null, staticDirty = true;
  const quadMat = new THREE.MeshBasicMaterial({ toneMapped: false, depthTest: false, depthWrite: false });
  const quadScene = new THREE.Scene(), quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), quadMat); quadScene.add(quad);
  // While the table slides or zooms on screen the baked picture is only moved and scaled; it is redrawn once, when the motion ends.
  let stale = false; const bakeA = new THREE.Vector3(), bakeB = new THREE.Vector3(), nowA = new THREE.Vector3(), nowB = new THREE.Vector3();
  const clearCol = new THREE.Color(0x101216);
  function corners(a, b) {
    camera.updateMatrixWorld(); camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    a.set(-cur.HL, -cur.HW, 0).project(camera); b.set(cur.HL, cur.HW, 0).project(camera);
  }
  // every frame the table is also drawn into the depth buffer only, so a ball dropping into a pocket goes behind the rail
  const depthMat = new THREE.MeshBasicMaterial({ colorWrite: false });
  const unmask = () => { const b = renderer.state.buffers; b.color.setMask(true); b.depth.setMask(true); };

  /* floor under the table: one flat colour chosen by the UI theme, plus the table's own soft shadow */
  const floorMat = new THREE.MeshBasicMaterial({ color: col(0x101216), toneMapped: false });
  let tableShadow = null;
  (function backdrop() {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), floorMat); m.position.z = -0.8; m.layers.set(1); sScene.add(m);
    const s = mkCanvas(512, 320), sg = s.getContext('2d');
    sg.shadowColor = 'rgba(0,0,0,0.8)'; sg.shadowBlur = 52; sg.fillStyle = 'rgba(0,0,0,0.8)';
    const rr = (x, y, w, h, r) => { sg.beginPath(); sg.moveTo(x + r, y); sg.arcTo(x + w, y, x + w, y + h, r); sg.arcTo(x + w, y + h, x, y + h, r); sg.arcTo(x, y + h, x, y, r); sg.arcTo(x, y, x + w, y, r); sg.fill(); };
    rr(70, 60, 372, 200, 26);
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(s), transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }));
    sm.position.set(0, -0.05, -0.79); sm.layers.set(1); sScene.add(sm); tableShadow = sm;
  })();
  function setBackdrop(hex) { floorMat.color.copy(col(hex)); sScene.background.copy(col(hex)); clearCol.set(hex); staticDirty = true; dirty = 3; }

  /* shared table materials */
  const fc = mkCanvas(256, 256), fg = fc.getContext('2d');
  const fid = fg.createImageData(256, 256);
  for (let i = 0; i < fid.data.length; i += 4) { const v = 226 + (Math.random() * 30 - 15); fid.data[i] = fid.data[i + 1] = fid.data[i + 2] = v; fid.data[i + 3] = 255; }
  fg.putImageData(fid, 0, 0);
  const feltTex = tex(fc, 9);
  const feltMat = new THREE.MeshStandardMaterial({ map: feltTex, bumpMap: feltTex, bumpScale: 0.0005, roughness: 1, metalness: 0, envMapIntensity: 0.1 });
  const cushMat = new THREE.MeshStandardMaterial({ map: feltTex, bumpMap: feltTex, bumpScale: 0.0005, roughness: 1, metalness: 0, envMapIntensity: 0.1, side: THREE.DoubleSide });
  /* Wood. The picture is a plank seen along the grain: growth rings stretched into long wavy bands, fine pores,
     a few darker streaks. The material then lays it along each rail and joins the rails at 45 degrees. */
  const wc = mkCanvas(1024, 512), wg = wc.getContext('2d');
  (function wood() {
    const W = 1024, H = 512, id = wg.createImageData(W, H), d = id.data;
    // smooth repeatable noise (value noise on a lattice that wraps, so the texture tiles)
    const N = 64, lat = new Float32Array(N * N); for (let i = 0; i < N * N; i++) lat[i] = Math.random();
    const sm = t => t * t * (3 - 2 * t);
    const noise = (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), fx = sm(x - xi), fy = sm(y - yi), a = ((xi % N) + N) % N, b = ((yi % N) + N) % N, a1 = (a + 1) % N, b1 = (b + 1) % N;
      return (lat[b * N + a] * (1 - fx) + lat[b * N + a1] * fx) * (1 - fy) + (lat[b1 * N + a] * (1 - fx) + lat[b1 * N + a1] * fx) * fy;
    };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = x / W * N, v = y / H * N;                                    // lattice coordinates; whole periods keep it seamless
      const warp = noise(u * 0.125, v * 0.25) * 1.5 + noise(u * 0.375, v * 0.75) * 0.35;        // the rings wander slowly along the plank
      const ring = v * 0.42 + warp, f = ring - Math.floor(ring);
      const late = Math.pow(f, 5);                                                   // each ring ends in a thin dark line
      const band = noise(u * 0.125, v * 0.25);                                       // broad lighter and darker planks
      const pore = noise(u * 2, v * 16) * noise(u * 4, v * 24);                      // short dark flecks along the grain
      const fibre = noise(u * 1.5, v * 32);
      let t = 0.82 - 0.26 * late - 0.18 * band - 0.34 * pore * pore + 0.06 * (fibre - 0.5);
      t = Math.max(0.25, Math.min(1, t));
      const k = (y * W + x) * 4;
      d[k] = 255 * t; d[k + 1] = 255 * (0.8 * t + 0.01); d[k + 2] = 255 * (0.62 * t * t + 0.04); d[k + 3] = 255;   // warm: red stays, blue falls away in the dark parts
    }
    wg.putImageData(id, 0, 0);
  })();
  const woodTex = tex(wc, 1);
  const woodU = { uOuter: { value: new THREE.Vector2(1, 1) } };                      // outer half-size of the table currently shown
  const woodMat = new THREE.MeshPhysicalMaterial({ map: woodTex, roughness: 0.36, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.7 });
  woodMat.onBeforeCompile = sh => {
    sh.uniforms.uOuter = woodU.uOuter;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLocal;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vLocal;\nuniform vec2 uOuter;').replace('#include <map_fragment>', `
      float dxe = uOuter.x - abs(vLocal.x), dye = uOuter.y - abs(vLocal.y);
      bool endRail = dxe < dye;                                                      // nearer a short end than a long side
      vec2 wuv = endRail ? vec2(vLocal.y + 0.31, vLocal.x * sign(vLocal.x) + 0.17) : vec2(vLocal.x, vLocal.y * sign(vLocal.y));
      wuv.y += vLocal.z * 0.9;                                                       // the grain carries on down the side faces
      vec4 texelColor = mapTexelToLinear(texture2D(map, wuv * vec2(0.62, 2.3)));
      texelColor.rgb *= 1.0 - 0.5 * (1.0 - smoothstep(0.0, 0.0016, abs(dxe - dye)));  // the joint where two rails meet
      diffuseColor *= texelColor;`);
  };
  const metalMat = new THREE.MeshStandardMaterial({ color: col(0x9c8a66), roughness: 0.3, metalness: 1, envMapIntensity: 1.3 });   // brushed brass, not paint-yellow
  // Soft darkening of the cloth next to the cushions: light from above is partly blocked there.
  // It is one faint line traced along every cushion, round its angled ends and on into the pocket throat, then blurred;
  // nothing is drawn across a pocket opening, so the shade thins out towards a pocket instead of stopping in a block.
  // Returns the material and the size of the cloth it covers (the play area plus the throats).
  function cushionShade(P) {
    const mx = P.HL + 0.1, my = P.HW + 0.1, W = 1024, k = W / (2 * mx), H = Math.round(2 * my * k), c = mkCanvas(W, H), g = c.getContext('2d');
    g.filter = `blur(${Math.max(2, Math.round(0.02 * k))}px)`; g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 0.06 * k; g.lineCap = 'round'; g.lineJoin = 'round';
    const X = x => (x + mx) * k, Y = y => (my - y) * k;
    for (const cu of P.CUSHIONS) { g.beginPath(); g.moveTo(X(cu.ja[0]), Y(cu.ja[1])); g.lineTo(X(cu.a[0]), Y(cu.a[1])); g.lineTo(X(cu.b[0]), Y(cu.b[1])); g.lineTo(X(cu.jb[0]), Y(cu.jb[1])); g.stroke(); }
    return { mat: new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }), w: 2 * mx, h: 2 * my };
  }

  const lipMat = new THREE.MeshStandardMaterial({ color: col(0x131211), roughness: 0.45, metalness: 0, envMapIntensity: 0.5 });
  const linerMat = new THREE.MeshStandardMaterial({ color: col(0x1d1815), roughness: 0.7, metalness: 0, envMapIntensity: 0.3, side: THREE.DoubleSide });
  const pearl = new THREE.MeshStandardMaterial({ color: col(0xf6efdc), roughness: 0.3, metalness: 0, envMapIntensity: 0.8 });
  const markMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, depthWrite: false });

  function buildTable(P) {
    const grp = new THREE.Group(), { POCKETS, CUSHIONS, HL, HW } = P, Xb = HL + CW, Yb = HW + CW, ox = Xb + RW, oy = Yb + RW, rr = 0.1, bev = 0.011;
    // cloth bed
    const bx = HL + 0.105, by = HW + 0.118;
    const bed = new THREE.Shape(); bed.moveTo(-bx, -by); bed.lineTo(bx, -by); bed.lineTo(bx, by); bed.lineTo(-bx, by); bed.closePath();
    for (const p of POCKETS) { const h = new THREE.Path(); h.absarc(p.x, p.y, p.r, 0, Math.PI * 2, false); bed.holes.push(h); }
    const bedMesh = new THREE.Mesh(new THREE.ShapeGeometry(bed, 40), feltMat); bedMesh.receiveShadow = true; grp.add(bedMesh);
    const shade = cushionShade(P), ao = new THREE.Mesh(new THREE.PlaneGeometry(shade.w, shade.h), shade.mat); ao.position.z = 0.0007; grp.add(ao);
    // markings
    const dot = (x, y) => { const d = new THREE.Mesh(new THREE.CircleGeometry(0.007, 20), markMat); d.position.set(x, y, 0.0005); grp.add(d); };
    dot(HL / 2, 0); dot(-HL / 2, 0);
    if (P.POCKETED) { const line = new THREE.Mesh(new THREE.PlaneGeometry(0.003, HW * 2), markMat); line.position.set(-HL / 2, 0, 0.0004); grp.add(line); } else dot(0, 0);
    // pocket pits
    const pit = new THREE.MeshStandardMaterial({ color: col(0x1a1613), roughness: 0.75, metalness: 0, envMapIntensity: 0.25, side: THREE.BackSide }), pitB = new THREE.MeshBasicMaterial({ color: 0x000000 });
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
        if (!p.corner) { const sy = Math.sign(p.y), s2 = Math.sqrt(p.r * p.r - (CW - P.SO) ** 2); return { p, e: [-sy * s2, sy * Yb], x: [sy * s2, sy * Yb] }; }
        const sx = Math.sign(p.x), sy = Math.sign(p.y), s = Math.sqrt(p.r * p.r - (CW - P.PO) ** 2);
        const pv = [sx * Xb, p.y - sy * s], ph = [p.x - sx * s, sy * Yb];
        return sx * sy < 0 ? { p, e: pv, x: ph } : { p, e: ph, x: pv };
      });
      for (const a of arcs) { a.a0 = Math.atan2(a.e[1] - a.p.y, a.e[0] - a.p.x); a.a1 = Math.atan2(a.x[1] - a.p.y, a.x[0] - a.p.x); }
      hole.moveTo(arcs[0].x[0], arcs[0].x[1]);
      for (const i of [1, 2, 3, 4, 5, 0]) { const a = arcs[i]; hole.lineTo(a.e[0], a.e[1]); hole.absarc(a.p.x, a.p.y, a.p.r, a.a0, a.a1, true); }
            for (const a of arcs) {
        let len = a.a0 - a.a1; while (len < 0) len += Math.PI * 2;
        // a brass plate let into the rail, a black rubber lip standing on its inner edge, and a leather liner down the cut
        const m = new THREE.Mesh(new THREE.RingGeometry(a.p.r + bev - 0.002, a.p.r + bev + 0.012, 48, 1, a.a1, len), metalMat);
        m.position.set(a.p.x, a.p.y, RAIL_Z + 0.0006); grp.add(m);
        const lip = new THREE.Mesh(new THREE.TorusGeometry(a.p.r + 0.0035, 0.006, 10, 48, len), lipMat);
        lip.rotation.z = a.a1; lip.position.set(a.p.x, a.p.y, RAIL_Z - 0.001); lip.castShadow = true; grp.add(lip);
        const lv = [], ln = [], seg = 32;
        for (let k = 0; k < seg; k++) {
          const t0 = a.a1 + len * k / seg, t1 = a.a1 + len * (k + 1) / seg, r = a.p.r - 0.0012;
          const q = (t, z) => { lv.push(a.p.x + Math.cos(t) * r, a.p.y + Math.sin(t) * r, z); ln.push(-Math.cos(t), -Math.sin(t), 0); };
          q(t0, RAIL_Z); q(t0, -0.02); q(t1, RAIL_Z); q(t1, RAIL_Z); q(t0, -0.02); q(t1, -0.02);
        }
        const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lv, 3)); lg.setAttribute('normal', new THREE.Float32BufferAttribute(ln, 3));
        const liner = new THREE.Mesh(lg, linerMat); liner.receiveShadow = true; grp.add(liner);
      }
    } else { hole.moveTo(-Xb, -Yb); hole.lineTo(-Xb, Yb); hole.lineTo(Xb, Yb); hole.lineTo(Xb, -Yb); hole.closePath(); }
    rail.holes.push(hole);
    const rg = new THREE.ExtrudeGeometry(rail, { depth: 0.12, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelOffset: -bev, bevelSegments: 7, curveSegments: 28 });
    rg.translate(0, 0, RAIL_Z - 0.12 - bev);
    const railMesh = new THREE.Mesh(rg, woodMat); railMesh.castShadow = true; railMesh.receiveShadow = true; grp.add(railMesh);
    // the cabinet under the playing surface (only seen when looking from the side)
    const body = new THREE.Shape(), bxo = ox - 0.035, byo = oy - 0.035, br = 0.07;
    body.moveTo(-bxo + br, -byo); body.lineTo(bxo - br, -byo); body.absarc(bxo - br, -byo + br, br, -Math.PI / 2, 0, false);
    body.lineTo(bxo, byo - br); body.absarc(bxo - br, byo - br, br, 0, Math.PI / 2, false);
    body.lineTo(-bxo + br, byo); body.absarc(-bxo + br, byo - br, br, Math.PI / 2, Math.PI, false);
    body.lineTo(-bxo, -byo + br); body.absarc(-bxo + br, -byo + br, br, Math.PI, Math.PI * 1.5, false);
    for (const p of POCKETS) { const h = new THREE.Path(); h.absarc(p.x, p.y, p.r + 0.002, 0, Math.PI * 2, true); body.holes.push(h); }   // the pockets go down through it
    const bg = new THREE.ExtrudeGeometry(body, { depth: 0.72, bevelEnabled: false, curveSegments: 12 }); bg.translate(0, 0, -0.8);
    const bodyMesh = new THREE.Mesh(bg, woodMat); bodyMesh.castShadow = true; grp.add(bodyMesh);
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
      // wall: the steep faces get plain cloth colour, because a texture seen that edge-on only shimmers
      const tri = (a, b, c, wall) => { for (const p of [a, b, c]) { v.push(p[0], p[1], p[2]); if (wall) uv.push(0.5, 0.5); else uv.push(p[0], p[1]); } };
      for (let i = 1; i < 5; i++) tri(top[0], top[i], top[i + 1]);
      for (let i = 0; i < 3; i++) { const a = top[i], b = top[i + 1], a0 = [a[0], a[1], 0], b0 = [b[0], b[1], 0]; tri(a, a0, b, true); tri(b, a0, b0, true); }
      const g2 = new THREE.BufferGeometry();
      g2.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g2.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g2.computeVertexNormals();
      const m = new THREE.Mesh(g2, cushMat); m.castShadow = true; grp.add(m);   // no shadows on it: at these slopes they only band
    }
    grp.visible = false; sScene.add(grp);
    return grp;
  }
  // one table mesh per physics table (each size is built the first time it is shown)
  const tables = new Map();
  function setTable(P) {
    if (cur === P && tables.has(P) && tables.get(P).visible) return;
    cur = P;
    if (!tables.has(P)) tables.set(P, buildTable(P));
    for (const [k, grp] of tables) grp.visible = k === P;
    for (const set of [sets.pool, sets.carom]) { for (const m of set.mesh) m.visible = false; for (const m of set.blob) m.visible = false; }
    const set = sets[P.POCKETED ? 'pool' : 'carom'];
    for (const s of set.blob) s.children.forEach((c, i) => c.scale.set(P.R * (i ? 3.3 : 2.7), P.R * (i ? 3.3 : 2.7), 1));
    // the lamps hang over this table's long axis
    [-0.615, 0, 0.615].forEach((f, i) => { LAMPS[i][0] = f * P.HL; });
    woodU.uOuter.value.set(P.HL + CW + RW, P.HW + CW + RW);
    lampObjs.forEach((l, i) => { const x = LAMPS[i % 3][0]; l.position.x = x; l.target.position.x = x; l.target.updateMatrixWorld(); });
    const ow = 2 * (P.HL + CW + RW), oh = 2 * (P.HW + CW + RW);
    tableShadow.scale.set(ow * 1.59, oh * 1.8, 1);
    falls.length = 0; guideKey = ''; renderer.shadowMap.needsUpdate = true; staticDirty = true; dirty = 3; applyCamera();
  }
  let clothI = 0, iced = false;
  function setCloth(i) {
    const c = CLOTHS[i] || CLOTHS[0]; clothI = i;
    feltMat.color.copy(col(iced ? 0xb4e1f7 : c.felt)); cushMat.color.copy(col(c.felt)).multiplyScalar(0.8); woodMat.color.copy(col(c.wood)).multiplyScalar(2.1);
    // ice: pale, smooth and shining where the cloth is matt
    feltMat.roughness = iced ? 0.22 : 1; feltMat.envMapIntensity = iced ? 0.75 : 0.1; feltMat.bumpScale = iced ? 0.00012 : 0.0005; feltMat.needsUpdate = true;
    staticDirty = true; dirty = 3;
  }
  function setIce(on) { if (iced === !!on) return; iced = !!on; setCloth(clothI); }

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
      // points start wide at the wrap and run to a sharp end near the joint (the top of this picture is the butt end)
      for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(k * 32 + 4, 0); g.lineTo(k * 32 + 28, 0); g.lineTo(k * 32 + 16, 220); g.fill(); }
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
  for (let i = 0; i < 90; i++) { const d = new THREE.Mesh(dotGeo, dotMat); d.renderOrder = 10; d.visible = false; guide.add(d); gDots.push(d); }
  for (const m of [gLine, gObj, gCue, gBank, gRing, gHand]) { m.renderOrder = 10; guide.add(m); }
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
  let ppm = 200, guideKey = '', pathPts = [];
  function setLine(m, x0, y0, x1, y1, px, z) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len < 1e-4) { m.visible = false; return; }
    m.visible = true; m.position.set((x0 + x1) / 2, (y0 + y1) / 2, z); m.rotation.z = Math.atan2(y1 - y0, x1 - x0); m.scale.set(len, px / ppm, 1);
  }

  /* layout: the table is fitted inside the insets; the insets ease when the screen changes */
  let portrait = false, dirty = 3, quality = 'auto', W = 0, H = 0;
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
    orbit.az -= dx * 0.0034; orbit.elTo = orbit.el = Math.max(0.3, Math.min(1.42, orbit.el + dy * 0.0028)); orbit.live = 4; applyCamera();
  }
  // A camera placed by a script (the highlight reel): az is the compass direction the camera sits in, el its height angle,
  // zoom < 1 is closer than "whole table in view", and it looks at the table point (tx, ty).
  function setCam(c) { orbit.on = true; orbit.cam = c; orbit.el = orbit.elTo = c.el; orbit.live = 4; applyCamera(); }
  // where a table point is on the screen, in pixels from the top-left of the game area (for overlays drawn on top of the 3D picture)
  const scr = new THREE.Vector3();
  function toScreen(x, y, z) {
    camera.updateMatrixWorld(); camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    scr.set(x, y, z || 0).project(camera);
    return { x: (scr.x + 1) / 2 * W, y: (1 - scr.y) / 2 * H, front: scr.z < 1 };
  }
  // the same, for many points in a row: call begin() once, then at(), which says whether the point is in front of the camera
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
    } else { camera.near = 0.5; fitP.set(0, 0, 0); camera.position.set(0, 0, dist); camera.up.set(portrait ? 1 : 0, portrait ? 0 : 1, 0); }
    camera.lookAt(fitP);
    camera.setViewOffset(fw, fh, fw / 2 - cx, fh / 2 - cy, W, H);
    guideKey = ''; dirty = 3;
    if (soft && rt && !staticDirty && !orbit.on) stale = true; else staticDirty = true;
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

  /* one frame. v: { game, alpha, aim, power, pull, showCue, showGuide, level, spin, legalIds } */
  /* barricades (puzzles): striped bars standing on the cloth, kept in step with the world's list of walls */
  const wallGrp = new THREE.Group(); scene.add(wallGrp); let wallRef = null;
  const wallMat = (() => {
    const c = mkCanvas(64, 64), g = c.getContext('2d'); g.fillStyle = '#f4efe2'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#e03a2f';
    g.beginPath(); g.moveTo(0, 64); g.lineTo(32, 64); g.lineTo(64, 32); g.lineTo(64, 0); g.lineTo(0, 64); g.fill(); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 32); g.lineTo(32, 0); g.fill();
    const t = tex(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, metalness: 0, envMapIntensity: 0.4 });
  })();
  const wallShade = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.26, depthWrite: false });
  function syncWalls(list) {
    wallRef = list;
    while (wallGrp.children.length) { const m = wallGrp.children.pop(); m.geometry.dispose(); }
    for (const s of list || []) {
      const L = s.len + 2 * s.r, H = 0.046, geo = new THREE.BoxGeometry(L, 2 * s.r, H), uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * L / 0.09);          // stripes the same size on every bar
      const m = new THREE.Mesh(geo, wallMat); m.position.set((s.ax + s.bx) / 2, (s.ay + s.by) / 2, H / 2); m.rotation.z = Math.atan2(s.ty, s.tx); wallGrp.add(m);
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(L + 0.03, 2 * s.r + 0.04), wallShade); sh.position.set((s.ax + s.bx) / 2 + 0.006, (s.ay + s.by) / 2 - 0.008, 0.0012); sh.rotation.z = m.rotation.z; sh.renderOrder = 1; wallGrp.add(sh);
    }
    dirty = 3;
  }

  function frame(v, dt) {
    if (v.game.world.walls !== wallRef) syncWalls(v.game.world.walls);
    let moved = false;
    for (const k of ['t', 'l', 'r', 'b']) { const d = insTo[k] - ins[k]; if (Math.abs(d) > 0.5) { ins[k] += d * Math.min(1, dt * 9); moved = true; } else ins[k] = insTo[k]; }
    if (moved) applyCamera(true); else if (stale) { stale = false; staticDirty = true; dirty = 3; }
    if (orbit.on && Math.abs(orbit.elTo - orbit.el) > 0.002) { orbit.el += (orbit.elTo - orbit.el) * Math.min(1, dt * 7); orbit.live = 4; applyCamera(); }   // easing down from overhead
    if (orbit.live > 0) dirty = 3;
    if (falls.length || v.animating) dirty = 3;
    if (dirty <= 0) return false; dirty--;
    const g = v.game, P = g.P, w = g.world, R = P.R, set = sets[g.mode.table], a = v.alpha;
    if (P !== cur || !tables.has(P)) setTable(P);
    for (let i = 0; i < set.mesh.length; i++) {
      const b = w.balls[i], m = set.mesh[i], s = set.blob[i];
      const on = !!b && b.on; s.visible = on;
      if (on) {
        const x = b.px + (b.x - b.px) * a, y = b.py + (b.y - b.py) * a, z = (b.pz || 0) + ((b.z || 0) - (b.pz || 0)) * a;
        m.visible = true; m.scale.setScalar(R * (1 + z * 2.4)); m.position.set(x, y, R + z); m.material.color.setScalar(1);   // off the cloth it comes towards the eye
        const so = z * 0.55;
        const q = b.q, l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; q[0] /= l; q[1] /= l; q[2] /= l; q[3] /= l;
        m.quaternion.set(q[0], q[1], q[2], q[3]);
        s.children[0].position.x = x + so; s.children[0].position.y = y - so;
        for (let k = 0; k < LAMPS.length; k++) { const L = LAMPS[k], f = R / (L[2] - R), c2 = s.children[k + 1]; c2.position.x = x + (x - L[0]) * f; c2.position.y = y + (y - L[1]) * f; }
      } else if (!falls.some(f => f.id === i)) m.visible = false;
    }
    for (let i = falls.length - 1; i >= 0; i--) {
      const f = falls[i], m = set.mesh[f.id], p = f.p;
      if (!p) {
        const h = Math.min(dt, 0.05); f.vz -= 9.8 * h; f.x += f.vx * h; f.y += f.vy * h; f.z += f.vz * h;
        if (m) { m.visible = f.z > -0.7; m.scale.setScalar(R); m.position.set(f.x, f.y, f.z); m.material.color.setScalar(Math.max(0.2, Math.min(1, 1 + f.z * 1.6))); }
        if (f.z <= -0.7) { fallEvents.push({ t: 'land', v: 2.5, x: Math.max(-1, Math.min(1, f.x)), y: f.y }); falls.splice(i, 1); }
        continue;
      }
      let left = Math.min(dt, 0.05);
      while (left > 1e-5) {
        const h = Math.min(left, 0.004); left -= h;
        f.vx += (p.x - f.x) * 60 * h; f.vy += (p.y - f.y) * 60 * h;      // the cup funnels it towards the middle
        f.vz -= 9.8 * h; f.x += f.vx * h; f.y += f.vy * h; f.z += f.vz * h;
        const dx = f.x - p.x, dy = f.y - p.y, d = Math.hypot(dx, dy), lim = p.r - R * 0.8;
        if (f.z < R * 0.5 && d > lim) {                                    // knocks against the pocket wall
          const nx = dx / d, ny = dy / d, vn = f.vx * nx + f.vy * ny;
          f.x = p.x + nx * lim; f.y = p.y + ny * lim;
          if (vn > 0) { f.vx -= 1.35 * vn * nx; f.vy -= 1.35 * vn * ny; if (vn > 0.12) fallEvents.push({ t: 'wall', v: vn, x: f.x, y: f.y }); }
        }
        const sp = Math.hypot(f.vx, f.vy);
        if (m && sp > 1e-3) { fallAxis.set(-f.vy / sp, f.vx / sp, 0); m.rotateOnWorldAxis(fallAxis, sp * h / R); }
      }
      if (m) { m.visible = f.z > -0.11; m.scale.setScalar(R); m.position.set(f.x, f.y, f.z); m.material.color.setScalar(Math.max(0.12, Math.min(1, 1 + f.z * 9))); }
      if (f.z <= -0.11) { fallEvents.push({ t: 'land', v: Math.hypot(f.vx, f.vy, f.vz), x: f.x, y: f.y }); falls.splice(i, 1); }
    }
    const c = w.balls[w.cue];
    cue.visible = cueShadow.visible = v.showCue && c.on; guide.visible = v.showGuide && c.on;
    if (cue.visible) {
      const dx = Math.cos(v.aim), dy = Math.sin(v.aim);
      // raised for a masse or a jump: the butt comes up and the tip comes down onto the top of the ball
      const e = v.jump ? 0.7 : v.el || 0, ce = Math.cos(e), se = Math.sin(e);
      const tx = c.x - dx * ce * (R + v.pull), ty = c.y - dy * ce * (R + v.pull);
      // Seen from straight above, a cue that is really tilted leans away across the picture (the butt is much nearer the eye),
      // so there it is drawn lying flat and shortened, the way it would look with no perspective; in the 3D views it is truly raised.
      if (orbit.on) { cue.scale.set(1, 1, 1); cue.position.set(tx, ty, R + 0.002 + se * (R + v.pull)); cue.rotation.set(0, -(0.085 + e), v.aim + Math.PI); }
      else { cue.scale.set(Math.max(0.16, ce), 1, 1); cue.position.set(tx, ty, R + 0.002 + (e ? R * 0.9 : 0)); cue.rotation.set(0, -0.085, v.aim + Math.PI); }
      const sx = tx - dx * 0.735 * ce + 0.012, sy = ty - dy * 0.735 * ce - 0.014;
      cueShadow.position.set(sx, sy, 0.0012); cueShadow.rotation.z = v.aim; cueShadow.scale.set(1.47 * Math.max(0.12, ce), 0.022, 1);
    }
    if (guide.visible) {
      const dx = Math.cos(v.aim), dy = Math.sin(v.aim), lv = v.level;
      const raised = v.jump || v.el > 0.02;
      const key = [v.aim.toFixed(5), c.x.toFixed(4), c.y.toFixed(4), lv, v.power.toFixed(2), v.spin.x.toFixed(2), v.spin.y.toFixed(2), ppm.toFixed(1), g.turn, v.rev, v.jump ? 'j' : (v.el || 0).toFixed(2)].join('|');
      if (key !== guideKey && raised) {
        // no straight line for a ball that curves or flies: the shot is played out and its path dotted, as far as the guide length allows
        guideKey = key;
        gLine.visible = gRing.visible = gObj.visible = gCue.visible = gBank.visible = false;
        for (const d of gDots) d.visible = false;
        if (lv >= 1) {
          const pts = P.cuePath(w, v.aim, g.vOf(v.power > 0.03 ? v.power : 0.45), v.spin.x * 0.5, v.spin.y * 0.5, lv >= 3 ? 2.6 : 1.8, v.el || 0, !!v.jump, lv >= 3 ? 2 : 1);
          let acc = 0, n = 0, lx = c.x, ly = c.y;
          for (let i = 0; i < pts.length && n < gDots.length; i += 3) {
            const x = pts[i], y = pts[i + 1]; acc += Math.hypot(x - lx, y - ly); lx = x; ly = y;
            if (acc >= 0.036) { acc = 0; const d = gDots[n++]; d.visible = true; d.position.set(x, y, R + pts[i + 2]); d.scale.setScalar(Math.max(0.004, (pts.first >= 0 && i > pts.first ? 2.6 : 3.4) / ppm)); }
          }
          if (pts.first >= 0 && pts.first < pts.length) {
            gRing.visible = true; gRing.position.set(pts[pts.first], pts[pts.first + 1], R + pts[pts.first + 2]); gRing.scale.setScalar(R);
            gRing.material.color.set(pts.hit == null || v.legalIds.indexOf(pts.hit) >= 0 ? 0xffffff : 0xff6a58);
          }
        }
      }
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
    if (orbit.on && orbit.live > 0) {
      orbit.live--; staticDirty = true;
      renderer.setClearColor(clearCol, 1); unmask(); renderer.clear();
      const bg = sScene.background; sScene.background = null; camera.layers.enable(1);
      renderer.render(sScene, camera); camera.layers.disable(1); sScene.background = bg;
      renderer.render(scene, camera);
      return true;
    }
    if (staticDirty && rt) {
      staticDirty = false; camera.layers.enable(1);
      renderer.setRenderTarget(rt); unmask(); renderer.clear(); renderer.render(sScene, camera); renderer.setRenderTarget(null);
      camera.layers.disable(1);
      corners(bakeA, bakeB); stale = false;
    }
    if (stale) {
      corners(nowA, nowB);
      const sx = (nowB.x - nowA.x) / (bakeB.x - bakeA.x), sy = (nowB.y - nowA.y) / (bakeB.y - bakeA.y);
      quad.scale.set(sx, sy, 1); quad.position.set(nowA.x - bakeA.x * sx, nowA.y - bakeA.y * sy, 0);
    } else { quad.scale.set(1, 1, 1); quad.position.set(0, 0, 0); }
    renderer.setClearColor(clearCol, 1);
    unmask(); renderer.clear(); renderer.render(quadScene, quadCam);
    // The table is drawn into the depth buffer only when something can go behind part of it: a ball dropping into a
    // pocket, or any ball once the view is tilted. Seen from straight above with every ball on the cloth, nothing can.
    if (falls.length || orbit.on) {
      const bgc = sScene.background; sScene.background = null; sScene.overrideMaterial = depthMat;   // (a colour background would wipe the picture)
      renderer.render(sScene, camera); sScene.overrideMaterial = null; sScene.background = bgc;
    }
    renderer.render(scene, camera);
    return true;
  }

  return {
    setTable, setCloth, setIce, setCue, setBackdrop, setZone, setMarks, fly, setOrbit, setCam, toScreen, proj, orbitBy, zoomBy, get orbiting() { return orbit.on; }, setInsets, setQuality, resize, toTable, frame, fall,
    invalidate() { dirty = 3; }, clearFalls() { falls.length = 0; fallEvents.length = 0; dirty = 3; }, fallEvents, get ppm() { return ppm; }, get portrait() { return portrait; }, get falling() { return falls.length > 0; },
    get pixelRatio() { return renderer.getPixelRatio(); },
  };
}
