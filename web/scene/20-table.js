  /* shared table materials */
  // Cloth: worsted wool - fine fibre speckle, a slight brushed streak along the nap (the table's length), and a faint
  // uneven mottle, all on a light grey the cloth colour multiplies; repeating, so the 9 repeats over the bed do not show.
  const fc = mkCanvas(512, 512), fg = fc.getContext('2d');
  const fid = fg.createImageData(512, 512);
  (function cloth() {
    const N = 32, lat = new Float32Array(N * N); for (let i = 0; i < N * N; i++) lat[i] = Math.random();
    const sm = t => t * t * (3 - 2 * t);
    const noise = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = sm(x - xi), fy = sm(y - yi), a = ((xi % N) + N) % N, b = ((yi % N) + N) % N, a1 = (a + 1) % N, b1 = (b + 1) % N;
      return (lat[b * N + a] * (1 - fx) + lat[b * N + a1] * fx) * (1 - fy) + (lat[b1 * N + a] * (1 - fx) + lat[b1 * N + a1] * fx) * fy; };
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
    const rail = rrect(new THREE.Shape(), ox, oy, rr);
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
    rail.holes.push(hole);
    const rg = new THREE.ExtrudeGeometry(rail, { depth: 0.12, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelOffset: -bev, bevelSegments: 7, curveSegments: 28 });
    rg.translate(0, 0, RAIL_Z - 0.12 - bev);
    const railMesh = new THREE.Mesh(rg, woodMat); railMesh.castShadow = true; railMesh.receiveShadow = true; railMesh.layers.enable(OCCL); grp.add(railMesh);
    // Under the rails, as on a real table: a skirt (apron) all round under the rail, then the cabinet down to the floor,
    // of the same wood: its long sides lean in towards the floor and its ends slope, and it stands on its feet through
    // thick arches cut in the long sides -
    //   carom: two arches, so it stands on three broad feet (the ends and the middle), each on a dark plinth, with a chrome
    //          line round the top of the cabinet and a chrome band round the rails;
    //   pool:  one wide arch between flared corner feet on chrome levelling feet, a chrome line round the top.
    // Seen from the side, in the 3D view and the highlights; from overhead the rails hide them.
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
      const T = -0.27, F = carom ? -0.77 : -0.75, X0 = bxo - 0.01, X1 = X0 - (carom ? 0.16 : 0.1), slope = x => X0 + (X1 - X0) * 0;   // (slope: kept straight below)
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
    // sights
    const dg = new THREE.CircleGeometry(0.0095, 4);
    const sight = (x, y, turn) => {
      const m = new THREE.Mesh(dg, pearl); if (turn) m.rotation.z = Math.PI / 2; m.position.set(x, y, RAIL_Z + 0.0006); grp.add(m);
      const n = new THREE.Mesh(SIGHT, sightMat); if (!turn) n.rotation.z = Math.PI / 2; n.position.set(x, y, RAIL_Z + 0.0007); grp.add(n);
    };
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
      const m = new THREE.Mesh(g2, cushMat); m.castShadow = true; m.layers.enable(OCCL); grp.add(m);   // no shadows on it: at these slopes they only band
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
    placeLamps(); putFloor(); hall.scale.set(2 * P.HL * 0.92, 1, 1);
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
      feltMat.roughness = c.look === 'desk' ? 0.55 : c.look === 'court' ? 0.6 : 1; feltMat.envMapIntensity = c.look === 'desk' ? 0.3 : c.look === 'court' ? 0.3 : 0.08;
      cushMat.map = cushMat.bumpMap = null; cushMat.color.copy(col(c.felt)); cushMat.roughness = c.look === 'desk' ? 0.5 : 0.9;
      woodMat.map = woodTex; woodMat.color.copy(col(c.wood)).multiplyScalar(c.look === 'desk' ? 1.4 : 1.1); woodU.uWs.value.set(0.62, 2.3);
      if (c.look !== 'desk') { woodMat.clearcoat = 0.6; woodMat.roughness = 0.45; }
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

