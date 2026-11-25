  /* shared table materials */
  /* Smooth value noise on an N x N lattice of random heights that wraps round, so a picture made from it in whole
     periods tiles without a seam. (The lattice takes its N*N random numbers when it is made.) */
  function latticeNoise(N) {
    const lat = new Float32Array(N * N); for (let i = 0; i < N * N; i++) lat[i] = Math.random();
    const sm = t => t * t * (3 - 2 * t);
    return (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), fx = sm(x - xi), fy = sm(y - yi), a = ((xi % N) + N) % N, b = ((yi % N) + N) % N, a1 = (a + 1) % N, b1 = (b + 1) % N;
      return (lat[b * N + a] * (1 - fx) + lat[b * N + a1] * fx) * (1 - fy) + (lat[b1 * N + a] * (1 - fx) + lat[b1 * N + a1] * fx) * fy;
    };
  }
  // Cloth: worsted wool - fine fibre speckle, a slight brushed streak along the nap (the table's length), and a faint
  // uneven mottle, all on a light grey the cloth colour multiplies; repeating, so the 9 repeats over the bed do not show.
  const fc = mkCanvas(512, 512), fg = fc.getContext('2d');
  const fid = fg.createImageData(512, 512);
  (function cloth() {
    const N = 32, noise = latticeNoise(N);
    const streak = new Float32Array(512); for (let y = 0; y < 512; y++) streak[y] = noise(3.7, y / 512 * N * 2) - 0.5;
    for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
      const u = x / 512 * N, v = y / 512 * N, mott = noise(u * 0.25, v * 0.25) + 0.5 * noise(u * 0.5, v * 0.5) - 0.75;
      const val = 224 + (Math.random() * 24 - 12) + 5 * streak[y] * (0.6 + 0.8 * noise(u * 0.125, v)) + 4 * mott;
      const i = (y * 512 + x) * 4; fid.data[i] = fid.data[i + 1] = fid.data[i + 2] = val; fid.data[i + 3] = 255;
    }
  })();
  fg.putImageData(fid, 0, 0);
  const feltTex = tex(fc, 6);

  const feltMat = new THREE.MeshStandardMaterial({ map: feltTex, bumpMap: feltTex, bumpScale: 0.0005, roughness: 1, metalness: 0, envMapIntensity: 0.1 });
  /* The made cloth (batch 8): a worsted weave with its nap's soft mottling, light grey so the cloth colour tints it, one
     picture to 30 cm of cloth (the bed's texture coordinates are metres), and its normal map for the weave's relief.
     The cushions keep the drawn grain (their slopes are seen edge-on). */
  let clothMade = null, clothNormal = null;
  loadTex('cloth', 1 / 0.3, t => { clothMade = t; if (!iced) { feltMat.map = t; feltMat.bumpMap = null; feltMat.normalMap = clothNormal; feltMat.needsUpdate = true; } });
  if (TEXS['cloth-n']) loader.load(TEXS['cloth-n'], t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1 / 0.3, 1 / 0.3); t.anisotropy = aniso; clothNormal = t;
    if (!iced && clothMade) { feltMat.normalMap = t; feltMat.normalScale.set(0.6, 0.6); feltMat.needsUpdate = true; } staticDirty = true; dirty = 3; });
  const cushMat = new THREE.MeshStandardMaterial({ map: feltTex, bumpMap: feltTex, bumpScale: 0.0005, roughness: 1, metalness: 0, envMapIntensity: 0.1, side: THREE.DoubleSide });
  /* Wood. The picture is a plank seen along the grain: growth rings stretched into long wavy bands, fine pores,
     a few darker streaks. The material then lays it along each rail and joins the rails at 45 degrees. */
  const wc = mkCanvas(1024, 512), wg = wc.getContext('2d');
  (function wood() {
    const W = 1024, H = 512, id = wg.createImageData(W, H), d = id.data;
    const N = 64, noise = latticeNoise(N);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = x / W * N, v = y / H * N;                                    // lattice coordinates; whole periods keep it seamless
      const band = noise(u * 0.125, v * 0.25);                                       // broad lighter and darker planks
      const warp = band * 1.5 + noise(u * 0.375, v * 0.75) * 0.35;                   // the rings wander slowly along the plank (with the bands)
      const ring = v * 0.42 + warp, f = ring - Math.floor(ring);
      const late = Math.pow(f, 5);                                                   // each ring ends in a thin dark line
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
  const woodU = { uOuter: { value: new THREE.Vector2(1, 1) }, uWs: { value: new THREE.Vector2(0.62, 2.3) } };   // outer half-size of the table shown; uWs: the picture's scale, per metre
  const woodMat = new THREE.MeshPhysicalMaterial({ map: woodTex, roughness: 0.36, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.7 });
  // the cabinet under the rails: the same wood, matt and a shade darker (it stands in the rail's shadow and has no lacquer)
  const bodyMat = new THREE.MeshStandardMaterial({ map: woodTex, color: 0x8c6c58, roughness: 0.7, metalness: 0, envMapIntensity: 0.3 });
  // a carom table's two pedestals: the wood quarter-cut, its grain running up and down
  const pedMat = new THREE.MeshStandardMaterial({ map: woodTex, color: 0x8c6c58, roughness: 0.55, metalness: 0, envMapIntensity: 0.35 });
  // a pool table's cabinet and legs: black lacquer; chrome on the feet and round a carom table's rails
  const lacMat = new THREE.MeshStandardMaterial({ color: col(0x050506), roughness: 0.38, metalness: 0, envMapIntensity: 0.22 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: col(0xd9dcdf), roughness: 0.16, metalness: 1, envMapIntensity: 1.4 });
  // the made woods: mahogany or walnut along the rails (cloth by cloth, look.js), and the mahogany cut across for the pedestals
  loadTex('wood-mahogany', 1, () => setCloth(clothI)); loadTex('wood-walnut', 1, () => setCloth(clothI));
  loadTex('wood-end', 1.7, () => setCloth(clothI));
  loadTex('pool-tiles', 1, () => { if (watery) setCloth(clothI); });
  woodMat.onBeforeCompile = sh => {
    sh.uniforms.uOuter = woodU.uOuter; sh.uniforms.uWs = woodU.uWs;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLocal;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLocal = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vLocal;\nuniform vec2 uOuter;\nuniform vec2 uWs;').replace('#include <map_fragment>', `
      float dxe = uOuter.x - abs(vLocal.x), dye = uOuter.y - abs(vLocal.y);
      bool endRail = dxe < dye;                                                      // nearer a short end than a long side
      vec2 wuv = endRail ? vec2(vLocal.y + 0.31, vLocal.x * sign(vLocal.x) + 0.17) : vec2(vLocal.x, vLocal.y * sign(vLocal.y));
      wuv.y += vLocal.z * 0.9;                                                       // the grain carries on down the side faces
      vec4 texelColor = mapTexelToLinear(texture2D(map, wuv * uWs));
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
  // the made sight: a long mother-of-pearl diamond, pointing along its rail (hidden until the picture is in)
  const sightMat = new THREE.MeshStandardMaterial({ color: col(0xffffff), roughness: 0.3, metalness: 0, envMapIntensity: 0.8, alphaTest: 0.4, visible: false });
  loadTex('sight', 0, t => { sightMat.map = t; sightMat.visible = true; sightMat.needsUpdate = true; pearl.visible = false; });
  const SIGHT = new THREE.PlaneGeometry(0.03, 0.03);
  const badgeMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.55, envMapIntensity: 1.1, alphaTest: 0.4, visible: false });
  loadTex('badge', 0, t => { badgeMat.map = t; badgeMat.visible = true; badgeMat.needsUpdate = true; });
  const BADGE = new THREE.PlaneGeometry(0.15, 0.075);
  // a rounded rectangle, as a shape or a hole
  const rrect = (sh, x, y, r) => {
    sh.moveTo(-x + r, -y); sh.lineTo(x - r, -y); sh.absarc(x - r, -y + r, r, -Math.PI / 2, 0, false);
    sh.lineTo(x, y - r); sh.absarc(x - r, y - r, r, 0, Math.PI / 2, false);
    sh.lineTo(-x + r, y); sh.absarc(-x + r, y - r, r, Math.PI / 2, Math.PI, false);
    sh.lineTo(-x, -y + r); sh.absarc(-x + r, -y + r, r, Math.PI, Math.PI * 1.5, false); return sh;
  };

  const LEVELER = new THREE.CylinderGeometry(0.035, 0.045, 0.05, 20).rotateX(Math.PI / 2);   // a pool table's chrome levelling foot
  /* The table's pieces that share a material (and shadows, layers, draw order) become one mesh, their places baked into
     the vertices: one draw call instead of one each. The 3D view draws the whole table every frame while it turns, and
     with the depth pass for what can hide a ball, every frame while anything moves - 18 sights alone were 36 calls, the
     pockets' pits, plates, lips and liners 36 more. The table never moves, so nothing is lost. (Transparent pieces are
     left alone: their order is decided per mesh.) */
  function mergeStatic(grp) {
    const same = new Map();
    for (const m of grp.children) {
      if (!m.isMesh || m.material.transparent || Array.isArray(m.material)) continue;
      const g = m.geometry, attrs = Object.keys(g.attributes).sort().join();
      const key = [m.material.uuid, m.castShadow, m.receiveShadow, m.layers.mask, m.renderOrder, m.visible, attrs].join('|');
      if (!same.has(key)) same.set(key, []); same.get(key).push(m);
    }
    for (const list of same.values()) {
      if (list.length < 2) continue;
      const parts = list.map(m => { m.updateMatrix(); const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); return g.applyMatrix4(m.matrix); });
      const out = new THREE.BufferGeometry();
      for (const name of Object.keys(parts[0].attributes)) {
        const arr = new Float32Array(parts.reduce((n, g) => n + g.attributes[name].array.length, 0));
        let at = 0; for (const g of parts) { arr.set(g.attributes[name].array, at); at += g.attributes[name].array.length; }
        out.setAttribute(name, new THREE.BufferAttribute(arr, parts[0].attributes[name].itemSize));
      }
      out.computeBoundingSphere();
      const m0 = list[0], m = new THREE.Mesh(out, m0.material);
      m.castShadow = m0.castShadow; m.receiveShadow = m0.receiveShadow; m.layers.mask = m0.layers.mask; m.renderOrder = m0.renderOrder;
      for (const q of list) grp.remove(q);
      grp.add(m);
    }
  }
  /* The table, piece by piece, each adding its meshes to grp in the order they always had: mergeStatic joins pieces in
     that order and three draws equal-depth pieces in it, so a reordering would change the picture. */
  // the cloth bed with the pockets cut out, the shade along the cushions, and the spots (and a pool table's head string)
  function tableBed(grp, P) {
    const { POCKETS, HL, HW } = P;
    const bx = HL + 0.105, by = HW + 0.118;
    const bed = new THREE.Shape(); bed.moveTo(-bx, -by); bed.lineTo(bx, -by); bed.lineTo(bx, by); bed.lineTo(-bx, by); bed.closePath();
    for (const p of POCKETS) { const h = new THREE.Path(); h.absarc(p.x, p.y, p.r, 0, Math.PI * 2, false); bed.holes.push(h); }
    const bedMesh = new THREE.Mesh(new THREE.ShapeGeometry(bed, 40), feltMat); bedMesh.receiveShadow = true; grp.add(bedMesh);
    const shade = cushionShade(P), ao = new THREE.Mesh(new THREE.PlaneGeometry(shade.w, shade.h), shade.mat); ao.position.z = 0.0007; grp.add(ao);
    // markings
    const dot = (x, y) => { const d = new THREE.Mesh(new THREE.CircleGeometry(0.007, 20), markMat); d.position.set(x, y, 0.0005); grp.add(d); };
    if (P.KIND === 'snooker') { snookerMarks(grp, P, dot); return; }
    dot(HL / 2, 0); dot(-HL / 2, 0);
    if (P.POCKETED) { const line = new THREE.Mesh(new THREE.PlaneGeometry(0.003, HW * 2), markMat); line.position.set(-HL / 2, 0, 0.0004); grp.add(line); } else dot(0, 0);
  }
  // 스누커's markings (tables.js SNOOKER): the baulk line across, the D behind it, and the six colours' spots
  function snookerMarks(grp, P, dot) {
    const k = P.HL / 1.7845, xb = -P.HL + SNOOKER.BAULK * k, d = SNOOKER.D * k, t = 0.0025;
    const line = new THREE.Mesh(new THREE.PlaneGeometry(t, P.HW * 2), markMat); line.position.set(xb, 0, 0.0004); grp.add(line);
    const arc = new THREE.Mesh(new THREE.RingGeometry(d - t / 2, d + t / 2, 64, 1, Math.PI / 2, Math.PI), markMat); arc.position.set(xb, 0, 0.0004); grp.add(arc);
    for (let id = 16; id <= 21; id++) { const [x, y] = SNOOKER.spot(P, id); dot(x, y); }
  }
  // the pockets' dark pits going down through the bed
  function pocketPits(grp, P) {
    const pit = new THREE.MeshStandardMaterial({ color: col(0x1a1613), roughness: 0.75, metalness: 0, envMapIntensity: 0.25, side: THREE.BackSide }), pitB = new THREE.MeshBasicMaterial({ color: 0x000000 });
    for (const p of P.POCKETS) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r * 0.86, 0.16, 36, 1, true), pit);
      w.rotation.x = Math.PI / 2; w.position.set(p.x, p.y, -0.08); grp.add(w);
      const b = new THREE.Mesh(new THREE.CircleGeometry(p.r, 28), pitB); b.position.set(p.x, p.y, -0.16); grp.add(b);
    }
  }
  /* The inner edge of the rails, as a hole in their outline: straight round a carom table; on a pool table it runs from
     pocket to pocket round each mouth, and each mouth gets its brass plate, rubber lip and leather liner. */
  function railCut(grp, P, hole, Xb, Yb, bev) {
    const { POCKETS } = P;
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
        m.position.set(a.p.x, a.p.y, RAIL_Z + 0.0006); m.layers.enable(OCCL); grp.add(m);
        const lip = new THREE.Mesh(new THREE.TorusGeometry(a.p.r + 0.0035, 0.006, 10, 48, len), lipMat);
        lip.rotation.z = a.a1; lip.position.set(a.p.x, a.p.y, RAIL_Z - 0.001); lip.castShadow = true; lip.layers.enable(OCCL); grp.add(lip);
        const lv = [], ln = [], seg = 32;
        for (let k = 0; k < seg; k++) {
          const t0 = a.a1 + len * k / seg, t1 = a.a1 + len * (k + 1) / seg, r = a.p.r - 0.0012;
          const q = (t, z) => { lv.push(a.p.x + Math.cos(t) * r, a.p.y + Math.sin(t) * r, z); ln.push(-Math.cos(t), -Math.sin(t), 0); };
          q(t0, RAIL_Z); q(t0, -0.02); q(t1, RAIL_Z); q(t1, RAIL_Z); q(t0, -0.02); q(t1, -0.02);
        }
        const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lv, 3)); lg.setAttribute('normal', new THREE.Float32BufferAttribute(ln, 3));
        const liner = new THREE.Mesh(lg, linerMat); liner.receiveShadow = true; liner.layers.enable(OCCL); grp.add(liner);
      }
    } else { hole.moveTo(-Xb, -Yb); hole.lineTo(-Xb, Yb); hole.lineTo(Xb, Yb); hole.lineTo(Xb, -Yb); hole.closePath(); }
  }
  /* Under the rails, as on a real table: a skirt (apron) all round under the rail, then the cabinet down to the floor,
     of the same wood: its long sides lean in towards the floor and its ends slope, and it stands on its feet through
     thick arches cut in the long sides -
       carom: two arches, so it stands on three broad feet (the ends and the middle), each on a dark plinth, with a chrome
              line round the top of the cabinet and a chrome band round the rails;
       pool:  one wide arch between flared corner feet on chrome levelling feet, a chrome line round the top.
     Seen from the side, in the 3D view and the highlights; from overhead the rails hide them. */
  function tableCabinet(grp, P, ox, oy, rr, holes) {
    const POCKETS = holes || P.POCKETS;                                            // (an outline's table: its own pockets - setShape)
    const bxo = ox - 0.035, byo = oy - 0.035, br = 0.07, carom = !P.POCKETED;
    const body = rrect(new THREE.Shape(), bxo, byo, br);
    for (const p of POCKETS) { const h = new THREE.Path(); h.absarc(p.x, p.y, p.r + 0.002, 0, Math.PI * 2, true); body.holes.push(h); }   // the pockets go down through it
    const bg = new THREE.ExtrudeGeometry(body, { depth: 0.17, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelOffset: -0.012, bevelSegments: 3, curveSegments: 12 });
    bg.translate(0, 0, -0.27);
    const bodyMesh = new THREE.Mesh(bg, bodyMat); bodyMesh.castShadow = true; grp.add(bodyMesh);
    // the maker's plate on the middle of each long side of the apron
    for (const sy of [-1, 1]) { const m = new THREE.Mesh(BADGE, badgeMat); m.rotation.set(Math.PI / 2, 0, sy > 0 ? Math.PI : 0); m.position.set(0, sy * (byo + 0.0015), -0.19); grp.add(m); }
    {
      // the cabinet's side outline (x along the table, z up), drawn once and pushed through the table's width (y)
      const T = -0.27, F = carom ? -0.77 : -0.75, X0 = bxo - 0.01, X1 = X0 - (carom ? 0.16 : 0.1);
      const sh = new THREE.Shape(); sh.moveTo(-X1, F); sh.lineTo(-X0, T); sh.lineTo(X0, T); sh.lineTo(X1, F);
      const arch = (x0, x1, top) => {                                     // an arch from the floor, rounded over the top
        const w = (x1 - x0) / 2, r = Math.min(w, (top - F) * 0.8), xm = (x0 + x1) / 2;
        sh.lineTo(x1, F); sh.lineTo(x1, top - r);
        sh.absellipse(xm, top - r, w, r, 0, Math.PI, false); sh.lineTo(x0, F);
      };
      if (carom) { const e = X1 - 0.34; arch(0.17, e, F + 0.36); arch(-e, -0.17, F + 0.36); }   // (right to left, as the outline runs)
      else { const e = X1 - 0.26; arch(-e, e, F + 0.4); }
      sh.lineTo(-X1, F);
      const Y0 = byo - 0.01, D = 2 * Y0;
      const cg = new THREE.ExtrudeGeometry(sh, { depth: D, bevelEnabled: false, curveSegments: 20 });
      cg.applyMatrix4(new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, -1, Y0, 0, 1, 0, 0, 0, 0, 0, 1));   // shape (x, z), pushed through y
      // lean the long sides in: the width narrows towards the floor
      const pos = cg.attributes.position, k = (Y0 - (carom ? 0.13 : 0.08)) / Y0;
      for (let i = 0; i < pos.count; i++) { const t = (T - pos.getZ(i)) / (T - F); pos.setY(i, pos.getY(i) * (1 - t * (1 - k))); }
      cg.computeVertexNormals();
      const cab = new THREE.Mesh(cg, bodyMat); cab.castShadow = true; cab.receiveShadow = true; grp.add(cab);
      // a chrome line round the top of the cabinet, just under the apron
      const line = rrect(new THREE.Shape(), X0 + 0.004, Y0 + 0.004, 0.02); line.holes.push(rrect(new THREE.Path(), X0 - 0.01, Y0 - 0.01, 0.01));
      const lg = new THREE.ExtrudeGeometry(line, { depth: 0.008, bevelEnabled: false, curveSegments: 6 }); lg.translate(0, 0, T - 0.016);
      grp.add(new THREE.Mesh(lg, chromeMat));
      const Y1 = Y0 * k;
      if (carom) {
        // each foot on a dark plinth, edged in chrome
        const e = X1 - 0.34;
        for (const [x0, x1] of [[-X1, -e], [-0.17, 0.17], [e, X1]]) {
          const w = x1 - x0 + 0.04, pl = new THREE.Mesh(new THREE.BoxGeometry(w, 2 * Y1 + 0.04, 0.03), lacMat); pl.position.set((x0 + x1) / 2, 0, F - 0.015); grp.add(pl);
          const cl = new THREE.Mesh(new THREE.BoxGeometry(w + 0.004, 2 * Y1 + 0.044, 0.006), chromeMat); cl.position.set((x0 + x1) / 2, 0, F - 0.003); grp.add(cl);
        }
      } else {
        // chrome levelling feet under the four corners
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) { const f = new THREE.Mesh(LEVELER, chromeMat); f.position.set(sx * (X1 - 0.12), sy * (Y1 - 0.09), F - 0.025); grp.add(f); }
      }
    }
    if (carom) {
      const band = rrect(new THREE.Shape(), ox + 0.0012, oy + 0.0012, rr + 0.0012); band.holes.push(rrect(new THREE.Path(), ox - 0.004, oy - 0.004, rr - 0.004));
      const bandG = new THREE.ExtrudeGeometry(band, { depth: 0.014, bevelEnabled: false, curveSegments: 28 }); bandG.translate(0, 0, RAIL_Z - 0.078);
      grp.add(new THREE.Mesh(bandG, chromeMat));
    }
  }
  // the mother-of-pearl sights along the rails: a drawn diamond, and the made one over it once its picture is in
  function tableSights(grp, P, Xb, Yb) {
    const { HL, HW } = P;
    const dg = new THREE.CircleGeometry(0.0095, 4);
    const sight = (x, y, turn) => {
      const m = new THREE.Mesh(dg, pearl); if (turn) m.rotation.z = Math.PI / 2; m.position.set(x, y, RAIL_Z + 0.0006); grp.add(m);
      const n = new THREE.Mesh(SIGHT, sightMat); if (!turn) n.rotation.z = Math.PI / 2; n.position.set(x, y, RAIL_Z + 0.0007); grp.add(n);
    };
    for (const k of P.POCKETED ? [-3, -2, -1, 1, 2, 3] : [-3, -2, -1, 0, 1, 2, 3]) for (const sy of [-1, 1]) sight(k * HL / 4, sy * (Yb + RW * 0.52));
    for (const k of [-1, 0, 1]) for (const sx of [-1, 1]) sight(sx * (Xb + RW * 0.52), k * HW / 2, true);
  }
  // the cushions: a sloped top down to the nose, and plain walls down to the cloth
  function tableCushions(grp, P, Xb, Yb) {
    for (const cu of P.CUSHIONS) {
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
      const m = new THREE.Mesh(g2, cushMat); m.castShadow = true; m.layers.enable(OCCL); grp.add(m);   // no shadows on it: at these slopes they only band
    }
  }
  function buildTable(P) {
    const grp = new THREE.Group(), { HL, HW } = P, Xb = HL + CW, Yb = HW + CW, ox = Xb + RW, oy = Yb + RW, rr = 0.1, bev = 0.011;
    tableBed(grp, P);
    pocketPits(grp, P);
    // rails: the outline with its inner edge cut out, bevelled, standing up from the cloth
    const rail = rrect(new THREE.Shape(), ox, oy, rr);
    const hole = new THREE.Path();
    railCut(grp, P, hole, Xb, Yb, bev);
    rail.holes.push(hole);
    const rg = new THREE.ExtrudeGeometry(rail, { depth: 0.12, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelOffset: -bev, bevelSegments: 7, curveSegments: 28 });
    rg.translate(0, 0, RAIL_Z - 0.12 - bev);
    const railMesh = new THREE.Mesh(rg, woodMat); railMesh.castShadow = true; railMesh.receiveShadow = true; railMesh.layers.enable(OCCL); grp.add(railMesh);
    tableCabinet(grp, P, ox, oy, rr);
    tableSights(grp, P, Xb, Yb);
    tableCushions(grp, P, Xb, Yb);
    mergeStatic(grp);
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
    for (const set of Object.values(sets)) { for (const m of set.mesh) m.visible = false; for (const m of set.blob) m.visible = false; }
    // (a pool table's size changes its balls': the contact shadows are sized again; the lamp's is sized every frame - 90-frame.js)
    for (const set of Object.values(sets)) if (set.kind === P.KIND) for (const s of set.blob) s.children[0].scale.set(P.R * 2.7, P.R * 2.7, 1);
    // the lamps hang over this table's long axis
    placeLamps(); putFloor(); sizeHall();
    woodU.uOuter.value.set(P.HL + CW + RW, P.HW + CW + RW);
    const ow = 2 * (P.HL + CW + RW), oh = 2 * (P.HW + CW + RW);
    tableShadow.scale.set(ow * 1.59, oh * 1.8, 1);
    falls.length = 0; guideKey = ''; pvKey = ''; railKey = ''; renderer.shadowMap.needsUpdate = true; staticDirty = true; dirty = 3; applyCamera();
    if (iced || watery || (CLOTHS[clothI] && CLOTHS[clothI].look)) setCloth(clothI);
  }
  // barricades (puzzles; physics walls()): dark rubber blocks with a maple top, standing on the cloth
  const wallGrp = new THREE.Group(); sScene.add(wallGrp);
  const wallMats = (() => { const side = new THREE.MeshStandardMaterial({ color: 0x24201d, roughness: 0.75, metalness: 0 }), top = new THREE.MeshStandardMaterial({ color: 0xc9a46a, roughness: 0.55, metalness: 0 }); return [side, side, side, side, top, side]; })();
  function setWalls(list) {
    while (wallGrp.children.length) wallGrp.children.pop().geometry.dispose();
    for (const q of list || []) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(q.len, q.thick, q.h), wallMats);
      m.position.set(q.x, q.y, q.h / 2); m.rotation.z = q.ang || 0; m.castShadow = m.receiveShadow = true; m.layers.enable(OCCL); wallGrp.add(m);
    }
    renderer.shadowMap.needsUpdate = true; staticDirty = true; dirty = 3;
  }
  /* A table of another shape (physics.js shape; the puzzles' tables: tables.js TABLE_OUTLINES; 증강 당구's votes) drawn
     whole from its outline, as a real table is built round its cushions (owner 11-23: not walls filling an ordinary
     table) - the ordinary table is put away while it shows. 11-24 밤 (owner: 당구대 마감이 안 됐다) it is finished as the
     ordinary table is, its pieces generalised from a rectangle to an outline, so the plain outline ('rect') comes out
     all but the ordinary table:
       a cross-section (SH_PROF) swept round the outline (shapeWalk: small steps, finer by a pocket), out from the
       cushion's nose - the rubber (a wall up from the cloth, its top rising back to the rail), the rail's lacquered wood
       with the ordinary rail's rounded edge (SH_BEV), its side, the apron set in under it - its grain laid along the
       rail (texture coordinates: along the outline, out from it and on down the side), each straight run its own board
       meeting the next at a mitre (a joint line), the outer corners rounded as the ordinary rails' (SH_RR);
       the shade the cushions cast on the cloth (as cushionShade);
       a pocket cut in the outline (hole.cut): the cloth's hole, the ordinary pocket's pit, the brass plate let into
       the rail round it, the rubber lip and the leather liner down its back - the rubber and rail cut round its circle
       in fine steps, so the jaws follow it; a hole in the cloth: a cup with a rim;
       under it: a rectangle's own cabinet (tableCabinet) when the outline is its rectangle; else the apron all round, a
       leg at each outer corner (and along long sides), a chrome line under the apron; an island: the rubber round it,
       its top the rail's wood, lacquered;
       the sights along each long straight rail.
     In the static layer, as the barricades. The pockets' drop (60-view.js fall) finds a hole by its number (6 + its
     index: shapeHole). */
  const shapeGrp = new THREE.Group(); sScene.add(shapeGrp);
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
  const needMat = new THREE.MeshBasicMaterial({ color: 0xffd34d, toneMapped: false, side: THREE.DoubleSide });   // (a cushion that must be met)
  const seamMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false });   // (a mitre's joint)
  const SH_CW = CW, SH_JAW = 0.4 * CW, SH_STEP = 0.01, SH_FINE = 0.0025, NOSE = 0.0355, SH_BEV = 0.011, SH_RR = 0.1, SH_APRON = 0.035;
  const SH_RT = SH_CW + RW;                                                          // (the rail's outer edge, out from the nose)
  /* The cross-section, from the nose out: [out, height, piece] - the rubber; the rail's top to its rounded outer edge
     (a quarter round of SH_BEV, as the ordinary rail's bevel), its side down to its rounded foot; the apron, set in */
  const SH_PROF = (() => {
    const p = [[0, 0, 'cush'], [0, NOSE, 'cush'], [SH_CW, RAIL_Z, 'cush'], [SH_RT - SH_BEV, RAIL_Z, 'wood']];
    for (let k = 1; k <= 6; k++) { const a = k / 6 * Math.PI / 2; p.push([SH_RT - SH_BEV + Math.sin(a) * SH_BEV, RAIL_Z - SH_BEV + Math.cos(a) * SH_BEV, 'wood']); }
    const zb = RAIL_Z - 0.12 - SH_BEV;
    p.push([SH_RT, zb, 'wood']);
    for (let k = 1; k <= 3; k++) { const a = k / 3 * Math.PI / 2; p.push([SH_RT - SH_BEV + Math.cos(a) * SH_BEV, zb - Math.sin(a) * SH_BEV, 'wood']); }
    return p;
  })();
  const SH_APRON_PROF = (() => { const zb = RAIL_Z - 0.12 - 2 * SH_BEV, d = SH_RT - SH_APRON; return [[SH_RT - SH_BEV, zb, 'body'], [d + 0.012, zb, 'body'], [d, zb - 0.012, 'body'], [d, -0.27, 'body'], [d - 0.012, -0.282, 'body']]; })();
  /* the rails' wood: the ordinary rails' lacquer, its grain by texture coordinates. One finish for the whole table (owner
     11-25: the matte patch where a rail reached in under the lamps showed as a dark block at the cross's joints) - the
     rectangle's the ordinary rails' own; any other outline, whose rails run in under the lamp, oiled wood without a coat
     (SH_COAT): any coat there mirrors the lamp over the table - a sharp one as white blocks at the inner corners, a soft
     one as a white wash along the rails (tried 11-25) */
  const shapeWoodMat = new THREE.MeshPhysicalMaterial({ map: woodTex, roughness: 0.36, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.7 });
  const SH_COAT = { roughness: 0.7, clearcoatRoughness: 0.3, clearcoat: 0, reflectivity: 0.15 };
  const shapePitMat = new THREE.MeshStandardMaterial({ color: col(0x1a1613), roughness: 0.75, metalness: 0, envMapIntensity: 0.25, side: THREE.BackSide });
  let shapeNow = null;
  /* A ring of the outline (or an island) walked in small steps, each { x, y on the nose line, mx, my the way out (an
     edge's normal; a corner's mitre - every offset ring closes on itself), e its edge, s how far along its board }. A
     corner the offsets open round (an outer corner of the rail) is rounded from d0 out (a quarter of points turning from
     one edge's normal to the next: ux, uy), as the ordinary rail's outline is; its middle point is twice in the walk, the
     second starting the next board (s back to 0) and marked a joint (seam). (A curve drawn as short edges - a round
     or bumpy table, a wave - is offset along its smoothed normal, as a parallel curve.) near(x, y): finer steps there. */
  function shapeWalk(pts, island, near) {
    const n = pts.length; let A = 0; for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; A += a[0] * b[1] - b[0] * a[1]; }
    const sg = (A > 0 ? 1 : -1) * (island ? -1 : 1);
    const N = i => { const a = pts[i], b = pts[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [sg * dy / l, -sg * dx / l]; };
    const T = i => { const a = pts[i], b = pts[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
    const L = i => { const a = pts[i], b = pts[(i + 1) % n]; return Math.hypot(b[0] - a[0], b[1] - a[1]); }, short = i => L(i) < 0.12;
    const corner = pts.map((_, i) => {
      const i0 = (i - 1 + n) % n, n0 = N(i0), n1 = N(i);
      if (short(i0) && short(i)) { let sx = 0, sy = 0; for (let k = -3; k <= 3; k++) { const q = N((i + k + n) % n), wt = 4 - Math.abs(k); sx += q[0] * wt; sy += q[1] * wt; } const l = Math.hypot(sx, sy) || 1; return { m: [sx / l, sy / l], curve: true }; }
      const dot = n0[0] * n1[0] + n0[1] * n1[1]; let mx = (n0[0] + n1[0]) / (1 + dot), my = (n0[1] + n1[1]) / (1 + dot); if (!(Math.hypot(mx, my) < 3)) { mx = n1[0]; my = n1[1]; }
      const t0 = T(i0), turn = Math.acos(Math.max(-1, Math.min(1, dot)));
      // (opening: the next edge's offset starts ahead of where this one's ends - an outer corner of the rail)
      const open = (n1[0] - n0[0]) * t0[0] + (n1[1] - n0[1]) * t0[1] > 1e-6;
      // (closing: an inner corner of the rail - the boards meet on the mitre, and every point of either board d out must
      // stop at it: k, how far back along the edge the mitre is for each unit out)
      return { m: [mx, my], curve: false, open: open && turn > 0.3, sharp: turn > 0.3, n0, n1, turn, k: !open && turn > 1e-3 ? Math.tan(turn / 2) : null };
    });
    const out = []; let s = 0;
    /* (a straight edge's points carry the edge - its start, way along, way out, length - and the mitres closing its ends
       (k0, k1), so a point u along it, taken d out, slides back along the edge to stay on its own side of a mitre: an
       inner corner's boards meet on the mitre at every depth, instead of each running on over the other's cushion) */
    const along = (i, u) => { const a = pts[i], t = T(i), nn = N(i), c0 = corner[i], c1 = corner[(i + 1) % n];
      if (c0.curve || c1.curve) return {};
      return { ax: a[0], ay: a[1], tx: t[0], ty: t[1], nx: nn[0], ny: nn[1], u, L: L(i), k0: c0.k, k1: c1.k }; };
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n], n1 = N(i), c0 = corner[i], c1 = corner[(i + 1) % n], curve = short(i) && c0.curve && c1.curve, len = L(i);
      // the corner: rounded from d0 (its middle the board's joint), or a single mitred point
      if (c0.open) {
        const K = Math.max(2, Math.ceil(c0.turn / (Math.PI / 24))), a0 = Math.atan2(c0.n0[1], c0.n0[0]); let da = Math.atan2(c0.n1[1], c0.n1[0]) - a0;
        while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
        const d0 = Math.max(0, SH_RT - SH_RR), ds = (SH_RT - d0) * Math.abs(da) / K;   // (ds: a step round the rail's outer edge)
        for (let k = 0; k <= K; k++) {
          const t = a0 + da * k / K, q = { x: a[0], y: a[1], mx: c0.m[0], my: c0.m[1], d0, ux: Math.cos(t), uy: Math.sin(t), e: i, s };
          if (k === Math.floor(K / 2)) { out.push(q); s = 0; out.push(Object.assign({}, q, { s: 0, seam: true })); } else out.push(q);
          s += ds;
        }
      } else {
        const ip = (i - 1 + n) % n;
        if (c0.sharp) { out.push(Object.assign({ x: a[0], y: a[1], mx: c0.m[0], my: c0.m[1], e: ip, s }, along(ip, L(ip)))); s = 0; out.push(Object.assign({ x: a[0], y: a[1], mx: c0.m[0], my: c0.m[1], e: i, s: 0, seam: true }, along(i, 0))); }
        else out.push(Object.assign({ x: a[0], y: a[1], mx: c0.m[0], my: c0.m[1], e: i, s }, along(i, 0)));
      }
      // the edge, in steps (finer by a pocket)
      let t = 0;
      for (;;) {
        const px = a[0] + (b[0] - a[0]) * t / len, py = a[1] + (b[1] - a[1]) * t / len;
        t += near && near(px, py) ? SH_FINE : SH_STEP; if (t >= len - 1e-6) break;
        const f = t / len; let mx = n1[0], my = n1[1];
        if (curve) { mx = c0.m[0] + (c1.m[0] - c0.m[0]) * f; my = c0.m[1] + (c1.m[1] - c0.m[1]) * f; const l = Math.hypot(mx, my) || 1; mx /= l; my /= l; }
        out.push(Object.assign({ x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, mx, my, e: i, s: s + t }, curve ? {} : along(i, t)));
      }
      s += len;
    }
    return out;
  }
  // (a ring of the walk d out, as a shape's points - a point the same as the last left out)
  const shapeRing = (walk, d) => { const out = []; for (const q of walk) { const p = shapeAt(q, d), l = out[out.length - 1]; if (!l || Math.hypot(l.x - p[0], l.y - p[1]) > 1e-6) out.push(new THREE.Vector2(p[0], p[1])); } return out; };
  // (a point of the walk d out from the nose: along its mitre, or past d0 round its corner)
  const shapeAt = (q, d) => {
    if (q.d0 != null && d > q.d0) return [q.x + q.mx * q.d0 + q.ux * (d - q.d0), q.y + q.my * q.d0 + q.uy * (d - q.d0)];
    if (q.L != null && (q.k0 != null || q.k1 != null)) {
      // (kept between the mitres d out; where they cross - an edge shorter than the rail is deep - at their crossing)
      const lo = q.k0 != null ? d * q.k0 : -Infinity, hi = q.k1 != null ? q.L - d * q.k1 : Infinity;
      const u = lo > hi ? q.L * q.k0 / (q.k0 + q.k1) : Math.min(hi, Math.max(lo, q.u));
      return [q.ax + q.tx * u + q.nx * d, q.ay + q.ty * u + q.ny * d];
    }
    return [q.x + q.mx * d, q.y + q.my * d];
  };
  function setShape(sh) {
    shapeNow = sh || null;
    while (shapeGrp.children.length) { const m = shapeGrp.children.pop(); m.geometry.dispose(); if (m.material && m.material.map && m.material.map.isCanvasTexture) { m.material.map.dispose(); m.material.dispose(); } }
    const std = cur && tables.get(cur); if (std) std.visible = !sh;
    if (sh && cur) {
      shapeWoodMat.map = woodMat.map; shapeWoodMat.color.copy(woodMat.color); shapeWoodMat.needsUpdate = true;
      const P = cur, cuts = sh.holes.filter(h => h.cut), V = { cush: [], wood: [], body: [], chrome: [] }, UV = { cush: [], wood: [], body: [], chrome: [] };
      const cutAt = (x, y, pad) => cuts.some(h => (x - h.x) ** 2 + (y - h.y) ** 2 < (h.r + pad) ** 2);
      const near = (x, y) => cuts.some(h => (x - h.x) ** 2 + (y - h.y) ** 2 < (h.r + 0.06) ** 2);
      // (a piece against the pockets: null when one circle covers it, else the circles that run across it)
      const CUT_R = 0.0004, cutsOn = poly => {
        const on = [];
        for (const h of cuts) {
          const R = h.r + CUT_R; let n = 0, near = false, inside = false;
          for (let i = 0; i < poly.length; i++) {
            const p = poly[i], q = poly[(i + 1) % poly.length], dx = q[0] - p[0], dy = q[1] - p[1], l2 = dx * dx + dy * dy || 1e-12;
            if ((p[0] - h.x) ** 2 + (p[1] - h.y) ** 2 < R * R) n++;
            const t = Math.max(0, Math.min(1, ((h.x - p[0]) * dx + (h.y - p[1]) * dy) / l2)); if ((p[0] + dx * t - h.x) ** 2 + (p[1] + dy * t - h.y) ** 2 < R * R) near = true;
            if ((p[1] > h.y) !== (q[1] > h.y) && h.x < p[0] + (h.y - p[1]) / (q[1] - p[1]) * dx) inside = !inside;
          }
          if (n === poly.length) return null; if (n || near || inside) on.push(h);
        }
        return on;
      };
      // (what of a small piece is outside a circle - its corners inside put on the circle where its sides cross it)
      const clipOut = (poly, h) => {
        const R = h.r + CUT_R, out = v => (v[0] - h.x) ** 2 + (v[1] - h.y) ** 2 >= R * R, res = [];
        for (let i = 0; i < poly.length; i++) {
          const p = poly[i], q = poly[(i + 1) % poly.length], po = out(p), qo = out(q); if (po) res.push(p);
          if (po !== qo) {
            const dx = q[0] - p[0], dy = q[1] - p[1], fx = p[0] - h.x, fy = p[1] - h.y, A = dx * dx + dy * dy, B = 2 * (fx * dx + fy * dy), Cq = fx * fx + fy * fy - R * R, D = Math.sqrt(Math.max(0, B * B - 4 * A * Cq));
            let t = (-B - D) / (2 * A); if (t < 0 || t > 1) t = (-B + D) / (2 * A); t = Math.max(0, Math.min(1, t));
            res.push(p.map((c, k) => c + (q[k] - c) * t));
          }
        }
        return res;
      };
      // round one ring: the cross-section swept from step to step; a piece of a step inside a pocket's circle left out.
      // Its texture coordinates: along the board (s), out from the nose and on down the side (as woodMat's rule)
      const sweep = (walk, prof) => {
        // (faces turned to face out of the wood and up: which way round depends on which way the ring runs - read off
        // the first step that moves, a corner's points being all in one place)
        let i1 = 1; while (i1 < walk.length - 1 && Math.hypot(walk[i1].x - walk[0].x, walk[i1].y - walk[0].y) < 1e-6) i1++;
        const t0 = walk[i1], f0 = walk[i1 - 1], flip = (t0.x - f0.x) * t0.my - (t0.y - f0.y) * t0.mx < 0;
        const uvAt = (q, d, z) => [q.s * 0.62, (d + (RAIL_Z - z) * 0.9) * 2.3];
        // (a corner: where the step's piece of a band is (s along the step, t across the band) - with its texture place)
        const at = (q0, q1, d0, z0, d1, z1, m, s, t) => {
          const d = d0 + (d1 - d0) * t, z = z0 + (z1 - z0) * t, a = shapeAt(q0, d), b = shapeAt(q1, d), x = a[0] + (b[0] - a[0]) * s, y = a[1] + (b[1] - a[1]) * s;
          if (m === 'cush') return [x, y, z, x, y];
          const ua = uvAt(q0, d, z), ub = uvAt(q1, d, z); return [x, y, z, ua[0] + (ub[0] - ua[0]) * s, ua[1] + (ub[1] - ua[1]) * s];
        };
        const emit = (m, poly) => {
          if (flip) poly = poly.slice().reverse();
          for (let i = 1; i + 1 < poly.length; i++) for (const v of [poly[0], poly[i], poly[i + 1]]) { V[m].push(v[0], v[1], v[2]); UV[m].push(v[3], v[4]); }
        };
        for (let k = 0; k < walk.length; k++) {
          const q0 = walk[k], q1 = walk[(k + 1) % walk.length]; if (q1.seam && q1.x === q0.x && q1.y === q0.y) continue;   // (a joint: the next board starts)
          for (let j = 0; j + 1 < prof.length; j++) {
            const [d0, z0] = prof[j], [d1, z1, m] = prof[j + 1], C = (s, t) => at(q0, q1, d0, z0, d1, z1, m, s, t);
            const quad = [C(0, 0), C(1, 0), C(1, 1), C(0, 1)], cut = cutsOn(quad);
            if (cut === null) continue; if (!cut.length) { emit(m, quad); continue; }
            // a piece a pocket's circle runs across: in pieces of 3 mm, each one crossed cut along the circle
            const len = Math.max(Math.hypot(quad[1][0] - quad[0][0], quad[1][1] - quad[0][1]), Math.hypot(quad[2][0] - quad[3][0], quad[2][1] - quad[3][1]));
            const K = Math.max(1, Math.ceil(len / 0.003)), M = Math.max(1, Math.ceil(Math.abs(d1 - d0) / 0.003));
            for (let i = 0; i < K; i++) for (let l = 0; l < M; l++) {
              let cell = [C(i / K, l / M), C((i + 1) / K, l / M), C((i + 1) / K, (l + 1) / M), C(i / K, (l + 1) / M)]; const cc = cutsOn(cell);
              if (cc === null) continue; for (const h of cc) cell = clipOut(cell, h); if (cell.length > 2) emit(m, cell);
            }
          }
        }
      };
      const mesh = (arr, mat, uv) => {
        if (!arr.length) return null;
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
        if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.computeVertexNormals();
        const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; m.layers.enable(OCCL); shapeGrp.add(m); return m;
      };
      const outer = shapeWalk(sh.poly, false, near);
      // a rectangle's outline (every corner of its box there): the ordinary table's cabinet under it; else the apron swept
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const p of sh.poly) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
      const boxy = sh.poly.length === 4 && [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].every(c => sh.poly.some(p => Math.hypot(p[0] - c[0], p[1] - c[1]) < 1e-3));
      const fin = boxy && !(sh.islands || []).length ? { roughness: 0.36, clearcoatRoughness: 0.08, clearcoat: 1, reflectivity: 0.5 } : SH_COAT;
      shapeWoodMat.roughness = fin.roughness; shapeWoodMat.clearcoatRoughness = fin.clearcoatRoughness; shapeWoodMat.clearcoat = fin.clearcoat; shapeWoodMat.reflectivity = fin.reflectivity;
      sweep(outer, boxy ? SH_PROF : SH_PROF.concat(SH_APRON_PROF));
      // the joints: a dark line across the rail's top where two boards meet
      const seams = [];
      for (const q of outer) if (q.seam) { const a = shapeAt(q, SH_CW + 0.002), b = shapeAt(q, SH_RT - 0.002), dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, w = 0.0008, nx = -dy / l * w, ny = dx / l * w, z = RAIL_Z + 0.0003;
        if (cutAt(a[0], a[1], 0.004) || cutAt(b[0], b[1], 0.004)) continue; seams.push(a[0] - nx, a[1] - ny, z, b[0] - nx, b[1] - ny, z, b[0] + nx, b[1] + ny, z, a[0] - nx, a[1] - ny, z, b[0] + nx, b[1] + ny, z, a[0] + nx, a[1] + ny, z); }
      if (seams.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(seams, 3)); const m = new THREE.Mesh(g, seamMat); m.renderOrder = 1; shapeGrp.add(m); }
      // islands: the rubber round, the top the rail's wood (lacquered, its grain along the table)
      for (const q of sh.islands || []) {
        const w = shapeWalk(q, true, near); sweep(w, SH_PROF.slice(0, 3));
        const top = new THREE.Shape(shapeRing(w, SH_CW));
        const tg = new THREE.ShapeGeometry(top); tg.translate(0, 0, RAIL_Z);
        const uv = tg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, tg.attributes.position.getX(i) * 0.62, tg.attributes.position.getY(i) * 2.3);
        const tm = new THREE.Mesh(tg, shapeWoodMat); tm.castShadow = tm.receiveShadow = true; tm.layers.enable(OCCL); shapeGrp.add(tm);
      }
      /* the pockets in the outline, finished as the ordinary pockets: the circle (the physics' own) cut down through the
         rubber and the rail. Its jaws - from the nose back to SH_JAW - the rubber's cloth; behind them, round the back of
         the circle, the leather liner down the cut, the black rubber lip along its top and the brass plate round it, on
         the rubber's top or the rail's, whichever the back runs through. */
      const rings = [sh.poly, ...(sh.islands || [])];
      // (how far a point is out past the cushion's nose: below 0 on the cloth, 0 to SH_CW the rubber, past that the rail)
      const depth = (x, y) => { let best = Infinity; for (const ring of rings) for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)); best = Math.min(best, Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t)); } return physIn(sh, x, y) ? -best : best; };
      const topAt = e => e <= 0 ? 0 : e < SH_CW ? NOSE + e / SH_CW * (RAIL_Z - NOSE) : RAIL_Z;       // (the top there)
      const cv = [], cn = [], cu = [], lv = [], ln = [];
      for (const h of cuts) {
        const n = 240, R = h.r + CUT_R, E = [];
        for (let i = 0; i <= n; i++) { const t = Math.PI * 2 * i / n; E.push(depth(h.x + Math.cos(t) * R, h.y + Math.sin(t) * R)); }
        const back = i => (E[i] + E[i + 1]) / 2 >= SH_JAW;
        // the cut's face, round the circle: the cloth on the jaws (from the bed up), the liner behind them (down into the pit)
        for (let i = 0; i < n; i++) {
          const e0 = E[i], e1 = E[i + 1]; if (e0 <= 0 && e1 <= 0) continue;
          const t0 = Math.PI * 2 * i / n, t1 = Math.PI * 2 * (i + 1) / n, P0 = [h.x + Math.cos(t0) * R, h.y + Math.sin(t0) * R], P1 = [h.x + Math.cos(t1) * R, h.y + Math.sin(t1) * R];
          const lin = back(i), zb = lin ? -0.02 : 0, z0 = topAt(e0), z1 = topAt(e1), A = [P0[0], P0[1], zb], B = [P1[0], P1[1], zb], C = [P1[0], P1[1], z1], D = [P0[0], P0[1], z0];
          const vs = lin ? lv : cv, ns = lin ? ln : cn; vs.push(...A, ...C, ...B, ...A, ...D, ...C);
          for (const t of [t0, t1, t1, t0, t0, t1]) ns.push(-Math.cos(t), -Math.sin(t), 0);
          if (!lin) cu.push(A[0], A[1], C[0], C[1] + z1, B[0], B[1], A[0], A[1], D[0], D[1] + z0, C[0], C[1] + z1);
        }
        // the back's runs (the steps behind the jaws, joined round past the start)
        const runs = []; let run = null;
        for (let i = 0; i < n; i++) if (back(i)) { if (!run) runs.push(run = [i, i]); else run[1] = i; } else run = null;
        if (runs.length > 1 && runs[0][0] === 0 && runs[runs.length - 1][1] === n - 1) { runs[0][0] = runs[runs.length - 1][0] - n; runs.pop(); }
        for (const [i0, i1] of runs) {
          const a1 = Math.PI * 2 * i0 / n, len = Math.PI * 2 * (i1 - i0 + 1) / n, seg = i1 - i0 + 1, eAt = t => depth(h.x + Math.cos(t) * R, h.y + Math.sin(t) * R);
          // the lip: a round rubber bead along the cut's top edge, rising and falling with it, drawn thin at its two ends
          const pos = [], nor = [], idx = [], S = 10;
          for (let k = 0; k <= seg; k++) {
            const t = a1 + len * k / seg, c = Math.cos(t), sn = Math.sin(t), cz = topAt(eAt(t)) - 0.001, end = Math.min(k, seg - k), w = 0.006 * Math.min(1, 0.35 + end * 0.22), rr = h.r + 0.0035;
            for (let j = 0; j <= S; j++) { const f = Math.PI * 2 * j / S, nx = Math.cos(f) * c, ny = Math.cos(f) * sn, nz = Math.sin(f); pos.push(h.x + c * rr + nx * w, h.y + sn * rr + ny * w, cz + nz * w); nor.push(nx, ny, nz); }
          }
          for (let k = 0; k < seg; k++) for (let j = 0; j < S; j++) { const a = k * (S + 1) + j, b = a + S + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
          const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); lg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); lg.setIndex(idx);
          const lip = new THREE.Mesh(lg, lipMat); lip.castShadow = true; lip.layers.enable(OCCL); shapeGrp.add(lip);
          // the plate: a band round the hole behind the lip, on the top (as far as the rail's flat top goes)
          const out = t => { const c = Math.cos(t), s = Math.sin(t); let lo = h.r, hi = h.r + 0.06; for (let j = 0; j < 22; j++) { const m = (lo + hi) / 2; if (depth(h.x + c * m, h.y + s * m) < SH_RT - SH_BEV - 0.002) lo = m; else hi = m; }
            return [h.r + SH_BEV - 0.002, Math.min(h.r + SH_BEV + 0.012, lo), c, s]; };
          const pv = [], ps = seg * 2, RS = 4;
          for (let k = 0; k < ps; k++) {
            const [p0, p1, c0, s0] = out(a1 + len * k / ps), [q0, q1, c1, s1] = out(a1 + len * (k + 1) / ps); if (p1 <= p0 || q1 <= q0) continue;
            const V = (c, s, r) => { const x = h.x + c * r, y = h.y + s * r; return [x, y, topAt(depth(x, y)) + 0.0006]; };
            for (let j = 0; j < RS; j++) {
              const A = V(c0, s0, p0 + (p1 - p0) * j / RS), B = V(c0, s0, p0 + (p1 - p0) * (j + 1) / RS), C = V(c1, s1, q0 + (q1 - q0) * (j + 1) / RS), D = V(c1, s1, q0 + (q1 - q0) * j / RS);
              pv.push(...A, ...B, ...C, ...A, ...C, ...D);
            }
          }
          if (pv.length) { const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(pv, 3)); pg.computeVertexNormals(); const plate = new THREE.Mesh(pg, metalMat); plate.receiveShadow = true; plate.layers.enable(OCCL); shapeGrp.add(plate); }
        }
      }
      if (cv.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(cv, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(cn, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(cu, 2)); const m = new THREE.Mesh(g, cushMat); m.receiveShadow = true; m.layers.enable(OCCL); shapeGrp.add(m); }
      if (lv.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(lv, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(ln, 3)); const m = new THREE.Mesh(g, linerMat); m.receiveShadow = true; m.layers.enable(OCCL); shapeGrp.add(m); }
      // the need's yellow bands (puzzles.js need): along the rubber's top, the whole rail the edge asked for is on (tables.js
      // rails: a curve's pieces are one cushion), numbered on the rail when there is more than one
      const need = (sh.spec && sh.spec.need) || [], railOf = sh.spec && sh.spec.rails ? sh.spec.rails.of : null;
      need.forEach((e, ni) => {
        const on = q => q.e === e || railOf && q.e != null && q.e < 1000 && railOf[q.e] != null && railOf[q.e] === railOf[e];
        const idx = []; outer.forEach((q, i) => { if (on(q) && !q.seam) idx.push(i); });
        const seg = idx.map(i => outer[i]), band = [];
        const zAt = d => NOSE + d / SH_CW * (RAIL_Z - NOSE) + 0.0009;
        for (let k = 0; k + 1 < seg.length; k++) {
          // (only neighbours on the way round: a rail that runs past the outline's first edge is listed in two pieces)
          if (idx[k + 1] - idx[k] > 2) continue;
          const q0 = seg[k], q1 = seg[k + 1];
          const a = shapeAt(q0, 0.008), b = shapeAt(q1, 0.008), c = shapeAt(q1, 0.04), d = shapeAt(q0, 0.04);
          if (cutAt((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, SH_BEV + 0.014)) continue;
          band.push(a[0], a[1], zAt(0.008), b[0], b[1], zAt(0.008), c[0], c[1], zAt(0.04), a[0], a[1], zAt(0.008), c[0], c[1], zAt(0.04), d[0], d[1], zAt(0.04));
        }
        if (band.length) { const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.Float32BufferAttribute(band, 3)); shapeGrp.add(new THREE.Mesh(bg, needMat)); }
        if (need.length > 1 && seg.length) {
          const mid = seg[Math.floor(seg.length / 2)], p = shapeAt(mid, SH_CW + RW * 0.5), cv = document.createElement('canvas'); cv.width = cv.height = 64;
          const c2 = cv.getContext('2d'); c2.fillStyle = '#ffd34d'; c2.beginPath(); c2.arc(32, 32, 30, 0, Math.PI * 2); c2.fill(); c2.fillStyle = '#3f200f'; c2.font = 'bold 40px sans-serif'; c2.textAlign = 'center'; c2.textBaseline = 'middle'; c2.fillText(String(ni + 1), 32, 34);
          const tx = new THREE.CanvasTexture(cv), m = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.05), new THREE.MeshBasicMaterial({ map: tx, transparent: true }));
          m.position.set(p[0], p[1], RAIL_Z + 0.001); shapeGrp.add(m);
        }
      });
      // under it: the rectangle's cabinet, or legs at the outer corners (and along a long side), a chrome line under the apron
      if (boxy) tableCabinet(shapeGrp, P, (x1 - x0) / 2 + SH_RT, (y1 - y0) / 2 + SH_RT, SH_RR, cuts);
      else {
        const T = -0.27, F = P.POCKETED ? -0.75 : -0.77, ins = SH_APRON + 0.07, feet = [];
        // the feet: under the outline's outermost corners (its convex hull's, none nearer than 60 cm to the last), one more
        // halfway along a hull's side over 1.6 m; a round table (too many corners): six spread round it
        const hull = (() => { const p = sh.poly.map((q, i) => [q[0], q[1], i]).sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
          for (const q of p) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
          for (const q of p.slice().reverse()) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
          return lo.slice(0, -1).concat(up.slice(0, -1)); })();
        const footAt = (x, y) => { let best = null, bd = Infinity; for (const q of outer) { const d = (q.x - x) ** 2 + (q.y - y) ** 2 - (q.seam ? 1e-9 : 0); if (d < bd) { bd = d; best = q; } } return shapeAt(best, SH_RT - ins); };
        const picked = []; for (const h of hull) if (!picked.length || Math.hypot(h[0] - picked[picked.length - 1][0], h[1] - picked[picked.length - 1][1]) > 0.6) picked.push(h);
        if (picked.length > 2 && Math.hypot(picked[0][0] - picked[picked.length - 1][0], picked[0][1] - picked[picked.length - 1][1]) < 0.6) picked.pop();
        if (picked.length > 8) for (let k = 0; k < 6; k++) feet.push(shapeAt(outer[Math.floor(outer.length * (k + 0.5) / 6)], SH_RT - ins));
        else picked.forEach((h, i) => { feet.push(footAt(h[0], h[1])); const g = picked[(i + 1) % picked.length]; if (Math.hypot(g[0] - h[0], g[1] - h[1]) > 1.6) feet.push(footAt((h[0] + g[0]) / 2, (h[1] + g[1]) / 2)); });
        for (const [x, y] of feet) {
          const lg = new THREE.CylinderGeometry(0.055, 0.04, T - F, 8).rotateX(Math.PI / 2); lg.translate(x, y, (T + F) / 2);
          const leg = new THREE.Mesh(lg, bodyMat); leg.castShadow = true; leg.receiveShadow = true; shapeGrp.add(leg);
          if (P.POCKETED) { const f = new THREE.Mesh(LEVELER, chromeMat); f.position.set(x, y, F - 0.025); shapeGrp.add(f); }
          else { const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.03, 16).rotateX(Math.PI / 2), lacMat); pl.position.set(x, y, F - 0.015); shapeGrp.add(pl); }
        }
        sweep(outer, [[SH_RT - SH_APRON + 0.004, T - 0.016, 'chrome'], [SH_RT - SH_APRON + 0.004, T - 0.008, 'chrome']]);
      }
      // a carom table's chrome band round the rails
      if (!P.POCKETED && !boxy) sweep(outer, [[SH_RT + 0.0012, RAIL_Z - 0.078, 'chrome'], [SH_RT + 0.0012, RAIL_Z - 0.064, 'chrome']]);
      mesh(V.cush, cushMat, UV.cush); mesh(V.wood, shapeWoodMat, UV.wood); mesh(V.body, bodyMat, UV.body); mesh(V.chrome, chromeMat, UV.chrome);
      // the cloth: out under the rails, the holes cut through it
      const bed = new THREE.Shape(shapeRing(outer, SH_RT - 0.01));
      for (const h of sh.holes) { const hp = new THREE.Path(); hp.absarc(h.x, h.y, h.r, 0, Math.PI * 2, true); bed.holes.push(hp); }
      const bm = new THREE.Mesh(new THREE.ShapeGeometry(bed, 40), feltMat); bm.receiveShadow = true; shapeGrp.add(bm);
      // the shade along the cushions (as cushionShade: one faint line traced along every cushion, blurred; none across a pocket)
      {
        const mx = P.HL + 0.1, my = P.HW + 0.1, W = 1024, k = W / (2 * mx), H = Math.round(2 * my * k), c = mkCanvas(W, H), g = c.getContext('2d');
        g.filter = `blur(${Math.max(2, Math.round(0.02 * k))}px)`; g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 0.06 * k; g.lineCap = 'round'; g.lineJoin = 'round';
        const X = x => (x + mx) * k, Y = y => (my - y) * k;
        for (const ring of [sh.poly, ...(sh.islands || [])]) {
          let on = false; g.beginPath();
          for (let i = 0; i <= ring.length; i++) {
            const a = ring[i % ring.length], b = ring[(i + 1) % ring.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]), m = i < ring.length ? Math.max(1, Math.ceil(L / 0.01)) : 1;
            for (let j = 0; j < m; j++) { const x = a[0] + (b[0] - a[0]) * j / m, y = a[1] + (b[1] - a[1]) * j / m; if (cutAt(x, y, 0.01)) { on = false; continue; } if (on) g.lineTo(X(x), Y(y)); else { g.moveTo(X(x), Y(y)); on = true; } if (i === ring.length) break; }
          }
          g.stroke();
        }
        const ao = new THREE.Mesh(new THREE.PlaneGeometry(2 * mx, 2 * my), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false })); ao.position.z = 0.0007; shapeGrp.add(ao);
      }
      // each hole's pit, down through the cloth, dark at the bottom (a pocket's as the ordinary pockets'); a hole in the
      // cloth gets its rim on the cloth
      for (const h of sh.holes) {
        const pit = new THREE.Mesh(new THREE.CylinderGeometry(h.r, h.r * 0.86, 0.16, 36, 1, true).rotateX(Math.PI / 2), h.cut ? shapePitMat : linerMat); pit.position.set(h.x, h.y, -0.08); shapeGrp.add(pit);
        const bot = new THREE.Mesh(new THREE.CircleGeometry(h.r, 40), holeMat); bot.position.set(h.x, h.y, -0.16); shapeGrp.add(bot);
        if (!h.cut) { const rim = new THREE.Mesh(new THREE.RingGeometry(h.r, h.r + 0.006, 40), metalMat); rim.position.set(h.x, h.y, 0.0008); shapeGrp.add(rim); }
      }
      // the sights: along each straight stretch of the outer rail 40 cm or longer, a quarter of the table's length apart
      const pts = sh.poly, dg = new THREE.CircleGeometry(0.0095, 4), gap = P.HL / 4;
      let A = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; A += a[0] * b[1] - b[0] * a[1]; }
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy); if (len < 0.4) continue;
        const tx = dx / len, ty = dy / len, nx = (A > 0 ? ty : -ty), ny = (A > 0 ? -tx : tx), ang = Math.atan2(ty, tx), cnt = Math.floor(len / gap - 0.5);
        for (let k = -Math.floor(cnt / 2); k <= Math.floor(cnt / 2); k++) {
          const u = len / 2 + k * gap; if (cnt % 2 === 0 && k === 0 && cnt > 0) continue;
          const x = a[0] + tx * u + nx * (SH_CW + RW * 0.52), y = a[1] + ty * u + ny * (SH_CW + RW * 0.52); if (cutAt(x, y, 0.02)) continue;
          const m = new THREE.Mesh(dg, pearl); m.rotation.z = ang; m.position.set(x, y, RAIL_Z + 0.0006); shapeGrp.add(m);
          const sm = new THREE.Mesh(SIGHT, sightMat); sm.rotation.z = ang + Math.PI / 2; sm.position.set(x, y, RAIL_Z + 0.0007); shapeGrp.add(sm);
        }
      }
      mergeStatic(shapeGrp);
    }
    renderer.shadowMap.needsUpdate = true; staticDirty = true; dirty = 3;
  }
  // (inside the shape's play: the outline less its islands - physics.js inShape, which the scene does not have)
  function physIn(sh, x, y) {
    const inP = p => { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const a = p[i], b = p[j]; if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
    return inP(sh.poly) && !(sh.islands || []).some(inP);
  }
  // a hole as the pocket drop wants it (x, y, r): 6 and on are the shape's holes
  const shapeHole = k => shapeNow && shapeNow.holes[k - 6] || null;
  /* The swimming pool's water and the night sky's motion, drawn over a painted cloth (the paintings: 15-looks.js). */
  let iceTex = null, poolTex = null;                                                 // (painted once, kept for the next time)
  const waterU = { uT: { value: 0 }, uK: { value: 1.7 } };
  const waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    uniforms: waterU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vP; void main() { vP = (modelMatrix * vec4(position, 1.0)).xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    // the bright net of light under moving water: waves crossing one another, their crests drawn thin
    fragmentShader: `varying vec2 vP; uniform float uT, uK;
      void main() {
        vec2 p = vP * uK * 6.2831 - 250.0, i = p; float c = 1.0;
        for (int n = 0; n < 4; n++) {
          float t = uT * 0.32 * (1.0 - 3.5 / float(n + 1));
          i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
          c += 1.0 / length(vec2(p.x / (sin(i.x + t) / 0.006), p.y / (cos(i.y + t) / 0.006)));
        }
        c /= 4.0; c = 1.17 - pow(c, 1.4); float v = pow(abs(c), 9.0);
        gl_FragColor = vec4(vec3(0.7, 0.95, 1.0) * clamp(v, 0.0, 1.0) * 0.3, 1.0);
      }`
  }));
  const waterMat = waterMesh.material;
  /* The night sky (look 'sky'): over its painted dark - nebulae and still stars - this draws what moves: stars twinkling,
     the Milky Way's glow drifting, curtains of aurora swaying, and now and then a shooting star. Added light only. */
  const skyMat = new THREE.ShaderMaterial({
    uniforms: waterU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vP; void main() { vP = (modelMatrix * vec4(position, 1.0)).xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `varying vec2 vP; uniform float uT;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int k = 0; k < 4; k++) { s += a * n(p); p *= 2.03; a *= 0.5; } return s; }
      void main() {
        vec2 p = vP; vec3 c = vec3(0.0);
        // twinkling stars: one in some cells of a fine grid, each with its own beat
        vec2 g = p * 46.0, cell = floor(g), f = fract(g) - 0.5; float r = h(cell);
        if (r > 0.86) { vec2 o = vec2(h(cell + 3.1), h(cell + 7.7)) - 0.5; float d = length(f - o * 0.6);
          float tw = 0.55 + 0.45 * sin(uT * (1.5 + r * 4.0) + r * 40.0); c += vec3(0.85, 0.9, 1.0) * smoothstep(0.09, 0.0, d) * tw * (r - 0.86) * 9.0; }
        // the Milky Way: a soft band across, its clouds drifting along it
        float band = exp(-pow((p.y - 0.25 * sin(p.x * 0.9 + 0.6)) * 2.4, 2.0));
        float neb = fbm(vec2(p.x * 1.6 - uT * 0.02, p.y * 2.2) + fbm(p * 2.5 + uT * 0.015));
        c += vec3(0.36, 0.38, 0.7) * band * smoothstep(0.3, 0.8, neb) * 0.8;
        // aurora: curtains swaying, green fading to violet at their ends
        float wave = sin(p.x * 2.2 + uT * 0.35 + sin(p.y * 3.0 + uT * 0.22) * 1.2);
        float cur = exp(-pow((p.y + 0.38 + 0.12 * wave) * 7.0, 2.0)) * (0.5 + 0.5 * sin(p.x * 9.0 + uT * 0.8 + fbm(p * 3.0) * 4.0));
        c += mix(vec3(0.1, 0.75, 0.5), vec3(0.55, 0.25, 0.85), smoothstep(-0.5, 0.9, sin(p.x * 0.8 + uT * 0.1))) * cur * 0.32;
        // a shooting star every few seconds, somewhere new each time
        float k = floor(uT / 5.5), tt = fract(uT / 5.5) * 5.5;
        if (tt < 0.7) { vec2 a = vec2(h(vec2(k, 1.0)) * 2.4 - 1.2, h(vec2(k, 2.0)) * 1.0 - 0.3), dir = normalize(vec2(1.0, -0.45));
          vec2 head = a + dir * tt * 1.3, q = p - head; float along = dot(q, dir), across = length(q - dir * along);
          c += vec3(1.0, 0.95, 0.85) * smoothstep(0.004, 0.0, across) * smoothstep(-0.3, 0.0, along) * step(along, 0.0) * (1.0 - tt / 0.7) * 1.6; }
        gl_FragColor = vec4(c, 1.0);
      }`
  });
  waterMesh.visible = false; waterMesh.renderOrder = 0; waterMesh.position.z = 0.0006; scene.add(waterMesh);
  waterMesh.material.polygonOffset = true; waterMesh.material.polygonOffsetFactor = -2; waterMesh.material.polygonOffsetUnits = -4;   // (seen low, it stays over the floor)
  const wakes = [];                                                                  // where each ball last left a ring
  let waterAcc = 0;
  // each frame (before anything decides whether to draw): the water moves on; a ball going through it leaves rings
  function waterTick(w, dt) {
    if (!waterMesh.visible) return false;
    waterU.uT.value += dt; waterAcc += dt;
    if (w && watery) for (let i = 0; i < w.balls.length; i++) {
      const b = w.balls[i], q = wakes[i];
      if (!b.on) { wakes[i] = null; continue; }
      if (!q) { wakes[i] = { x: b.x, y: b.y }; continue; }
      if (Math.hypot(b.x - q.x, b.y - q.y) > 0.07) { q.x = b.x; q.y = b.y; fxRing(b.x, b.y, 0.0016, cur.R * 1.1, cur.R * 2.8, 1.1, 0.32); waterAcc = 1; }
    }
    if (waterAcc < 1 / 30) return false;
    waterAcc = 0; return true;
  }
  // the soccer pitch's goals: white posts and a crossbar across each pocket's mouth, a net behind over the hole
  const goalGrp = new THREE.Group(); sScene.add(goalGrp);
  const postMat = new THREE.MeshStandardMaterial({ color: col(0xf4f6f2), roughness: 0.35, metalness: 0.1, envMapIntensity: 0.6 });
  const netMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });
  // the court's hoops: a backboard behind each pocket, an orange rim over it, a net hanging into it
  const rimMat = new THREE.MeshStandardMaterial({ color: col(0xf0641e), roughness: 0.4, metalness: 0.4, envMapIntensity: 0.8 });
  const boardMat = new THREE.MeshPhysicalMaterial({ color: col(0xffffff), roughness: 0.05, transparent: true, opacity: 0.35, clearcoat: 1, envMapIntensity: 1.2, depthWrite: false });
  function setHoops() {
    const R = cur.R, hgt = R * 2.6;
    for (const p of cur.POCKETS) {
      const a = Math.atan2(-p.y, -p.x), ux = Math.cos(a), uy = Math.sin(a), tx = -uy, ty = ux, rr = p.r * 0.8;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.0028, 8, 32), rimMat); rim.position.set(p.x, p.y, hgt); rim.castShadow = true; rim.layers.enable(OCCL); goalGrp.add(rim);
      const bx = p.x - ux * (rr + 0.012), by = p.y - uy * (rr + 0.012), board = new THREE.Mesh(new THREE.BoxGeometry(0.004, rr * 3.2, rr * 2.2), boardMat);
      board.position.set(bx, by, hgt + rr * 0.6); board.rotation.z = a; goalGrp.add(board);
      const sq = new THREE.Mesh(new THREE.BoxGeometry(0.0045, rr * 1.3, rr * 0.9), new THREE.MeshBasicMaterial({ color: 0xf0641e, wireframe: true })); sq.position.set(bx, by, hgt + rr * 0.55); sq.rotation.z = a; goalGrp.add(sq);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.004, 0.004), rimMat); arm.position.set(p.x - ux * (rr + 0.006), p.y - uy * (rr + 0.006), hgt); arm.rotation.z = a; goalGrp.add(arm);
      const v = [], N = 12;
      for (let i = 0; i < N; i++) { const t0 = i / N * 2 * Math.PI, t1 = (i + 0.5) / N * 2 * Math.PI;      // the net: crossing strands, narrowing down
        v.push(p.x + Math.cos(t0) * rr, p.y + Math.sin(t0) * rr, hgt, p.x + Math.cos(t1) * rr * 0.6, p.y + Math.sin(t1) * rr * 0.6, hgt - R * 1.6);
        v.push(p.x + Math.cos(t1) * rr * 0.6, p.y + Math.sin(t1) * rr * 0.6, hgt - R * 1.6, p.x + Math.cos(t0 + 2 * Math.PI / N) * rr, p.y + Math.sin(t0 + 2 * Math.PI / N) * rr, hgt); }
      const ng = new THREE.BufferGeometry(); ng.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); goalGrp.add(new THREE.LineSegments(ng, netMat));
    }
  }
  function setGoals(on) {
    const gs = new Set(); while (goalGrp.children.length) gs.add(goalGrp.children.pop().geometry); gs.forEach(q => q.dispose());
    if (!on || !cur || !cur.POCKETED) return;
    if (on === 'court') return setHoops();
    const R = cur.R, hgt = R * 2.2, post = new THREE.CylinderGeometry(0.0035, 0.0035, hgt, 10);
    for (const p of cur.POCKETS) {
      // facing the middle of the table; the frame stands on the mouth, the net goes back over the hole
      const a = Math.atan2(-p.y, -p.x), ux = Math.cos(a), uy = Math.sin(a), tx = -uy, ty = ux, half = p.r * 0.95, back = p.r * 1.1;
      const cx = p.x + ux * p.r * 0.55, cy = p.y + uy * p.r * 0.55;
      for (const sd of [-1, 1]) { const m = new THREE.Mesh(post, postMat); m.rotation.x = Math.PI / 2; m.position.set(cx + tx * half * sd, cy + ty * half * sd, hgt / 2); m.castShadow = true; m.layers.enable(OCCL); goalGrp.add(m); }
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 2 * half, 10), postMat);
      bar.rotation.z = Math.atan2(ty, tx) - Math.PI / 2; bar.position.set(cx, cy, hgt); bar.castShadow = true; bar.layers.enable(OCCL); goalGrp.add(bar);
      const v = [], N = 6, at = (s, d, z) => [cx + tx * half * s - ux * back * d, cy + ty * half * s - uy * back * d, z];
      const seg = (A, B) => v.push(...A, ...B);
      for (let i = 0; i <= N; i++) { const s = -1 + 2 * i / N;                     // the net: lines across its top, back and sides
        seg(at(s, 0, hgt), at(s, 1, hgt * 0.6)); seg(at(s, 1, hgt * 0.6), at(s, 1, 0)); }
      for (let j = 0; j <= 4; j++) { const d = j / 4; seg(at(-1, d, hgt * (1 - 0.4 * d)), at(1, d, hgt * (1 - 0.4 * d))); }
      for (let j = 1; j <= 3; j++) { const z = hgt * 0.6 * j / 4; seg(at(-1, 1, z), at(1, 1, z)); }
      for (const sd of [-1, 1]) for (let j = 0; j <= 3; j++) { const d = j / 3; seg(at(sd, d, hgt * (1 - 0.4 * d)), at(sd, d, 0)); }
      const ng = new THREE.BufferGeometry(); ng.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      goalGrp.add(new THREE.LineSegments(ng, netMat));
    }
  }
  let clothI = 0, iced = false, watery = false;
  function setCloth(i) {
    const c = CLOTHS[i] || CLOTHS[0]; clothI = i; iced = !!c.ice; watery = !!c.water;
    // (the moving layer over the floor: the pool's water or the night sky's - chosen before anything returns, so the one
    // shown last does not stay)
    waterMesh.visible = watery; waterMesh.material = c.look === 'sky' ? skyMat : waterMat; setGoals(false); woodU.uWs.value.set(0.62, 2.3); woodMat.clearcoat = 1; woodMat.roughness = 0.36;
    if (watery) {
      if (!poolTex || poolTex.P !== cur) { if (poolTex) poolTex.dispose(); poolTex = makePoolFloor(); poolTex.P = cur; }
      poolTex.repeat.set(1 / (2 * cur.HL), 1 / (2 * cur.HW)); poolTex.offset.set(0.5, 0.5);
      feltMat.map = poolTex; feltMat.bumpMap = null; feltMat.normalMap = null; feltMat.color.setScalar(0.92); feltMat.roughness = 0.75; feltMat.envMapIntensity = 0.25;
      cushMat.map = cushMat.bumpMap = null; cushMat.color.copy(col(c.felt)); cushMat.roughness = 0.35;    // the pool's edge, wet
      waterMesh.scale.set(2 * cur.HL, 2 * cur.HW, 1);
      const tiles = made['pool-tiles'];
      if (tiles) { woodMat.map = tiles; woodMat.color.setScalar(1); woodU.uWs.value.set(4, 4); } else { woodMat.map = woodTex; woodMat.color.copy(col(c.wood)); }
      bodyMat.map = tiles || woodTex; bodyMat.color.copy(col(0xbfd8e2)); pedMat.map = tiles || woodTex; pedMat.color.copy(col(0x9fbfcc));
      feltMat.needsUpdate = cushMat.needsUpdate = woodMat.needsUpdate = true;
      renderer.shadowMap.needsUpdate = true; blobMat.opacity = 0.55; staticDirty = true; dirty = 3; return;
    }
    setGoals(c.look === 'soccer' || (c.look === 'court' && 'court'));
    if (c.look) {
      feltMat.map = lookFloor(c.look); feltMat.bumpMap = null; feltMat.normalMap = null; feltMat.color.setScalar(1);
      feltMat.roughness = c.look === 'court' ? 0.6 : 1; feltMat.envMapIntensity = c.look === 'court' ? 0.3 : 0.08;
      cushMat.map = cushMat.bumpMap = null; cushMat.color.copy(col(c.felt)); cushMat.roughness = 0.9;
      woodMat.map = woodTex; woodMat.color.copy(col(c.wood)).multiplyScalar(1.1); woodU.uWs.value.set(0.62, 2.3);
      woodMat.clearcoat = 0.6; woodMat.roughness = 0.45;
      bodyMat.map = woodTex; bodyMat.color.copy(woodMat.color).multiplyScalar(0.6); pedMat.map = woodTex; pedMat.color.copy(woodMat.color).multiplyScalar(0.5);
      waterMesh.visible = c.look === 'sky'; if (waterMesh.visible) waterMesh.scale.set(2 * cur.HL, 2 * cur.HW, 1);
      feltMat.needsUpdate = cushMat.needsUpdate = woodMat.needsUpdate = true;
      renderer.shadowMap.needsUpdate = true; blobMat.opacity = c.look === 'sky' ? 0.6 : 0.75; staticDirty = true; dirty = 3; return;
    }
    if (iced) {
      if (!iceTex) iceTex = makeIce();
      // the picture is stretched once over the whole bed (the bed's texture coordinates are metres from the middle)
      iceTex.repeat.set(1 / (2 * cur.HL), 1 / (2 * cur.HW)); iceTex.offset.set(0.5, 0.5);
      feltMat.map = iceTex; feltMat.bumpMap = null; feltMat.normalMap = null; feltMat.color.copy(col(0xd8ecf8)); feltMat.roughness = 0.34; feltMat.envMapIntensity = 0.55;
      cushMat.color.copy(col(0xcfeaf8)); cushMat.roughness = 0.5;                            // packed snow along the rails
    } else {
      cushMat.map = cushMat.bumpMap = feltTex; feltMat.map = clothMade || feltTex; feltMat.bumpMap = clothMade ? null : feltTex; feltMat.normalMap = clothMade ? clothNormal : null; feltMat.color.copy(col(c.felt)); feltMat.roughness = 1; feltMat.envMapIntensity = 0.1;
      cushMat.color.copy(col(c.felt)).multiplyScalar(0.8); cushMat.roughness = 1;
    }
    feltMat.needsUpdate = true;
    // a cloth with a real wood (look.js grain) shows the made planks as they are; the others tint the drawn plank
    const plank = c.grain && made['wood-' + c.grain], end = plank && made['wood-end'];
    if (plank) { woodMat.map = plank; woodMat.color.setScalar(1.05); } else { woodMat.map = woodTex; woodMat.color.copy(col(c.wood)).multiplyScalar(2.1); }
    bodyMat.map = plank || woodTex; bodyMat.color.copy(woodMat.color).multiplyScalar(plank ? 0.62 : 0.55);
    pedMat.map = end || plank || woodTex; pedMat.color.copy(woodMat.color).multiplyScalar(c.grain === 'walnut' ? 0.42 : 0.7);
    renderer.shadowMap.needsUpdate = true;
    blobMat.opacity = iced ? 0.5 : 0.75;
    staticDirty = true; dirty = 3;
  }

