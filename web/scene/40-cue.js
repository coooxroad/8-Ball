  /* cue stick */
  const cue = new THREE.Group(); cue.rotation.order = 'ZYX'; scene.add(cue);
  const cueShadow = new THREE.Mesh(unitPlane, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
  cueShadow.renderOrder = 1; scene.add(cueShadow);
  /* A cue's other parts (content/20-cues.js parts): things that are not turned on a lathe, x along the cue from the tip,
     z up. box [from, to, width, height] (a crossguard, a headstock: z, color); ball [at, radius] (a pommel; facets: [round,
     up] cut like a gem); frets [from, to, count, width, z] (closer together towards the body; dots: the inlays); pegs [from, to,
     count, size] (tuning pegs out of both sides, out: how far); keys [from, to, count, radius] (a flute's keys along its top,
     and the rod that carries them); acoustic [from, to, width, depth] (a guitar's body lying flat, its bottom at the tip:
     spruce top with rosette, sound hole, pickguard and bridge, mahogany sides and back; strings [x, z] run from the bridge
     to the head). */
  const woodTop = (() => { let t = null; return () => t || (t = (() => {
    const c = mkCanvas(512, 512), g = c.getContext('2d');
    g.fillStyle = '#e8c88e'; g.fillRect(0, 0, 512, 512);
    for (let k = 0; k < 90; k++) { g.strokeStyle = `rgba(150,105,55,${0.05 + (k % 3) * 0.03})`; g.lineWidth = 1 + (k % 4); g.beginPath(); g.moveTo(0, k * 5.7 + (k % 2)); g.lineTo(512, k * 5.7 + ((k * 7) % 5)); g.stroke(); }
    return tex(c); })()); })();
  function cuePart(q, mat) {
    const add = (g, m) => { const o = new THREE.Mesh(g, m || mat); cue.add(o); return o; };
    if (q.box) { const [a, b, w, h] = q.box; add(new THREE.BoxGeometry(b - a, w, h)).position.set((a + b) / 2, 0, q.z || 0); }
    else if (q.ball) {
      const [at, r] = q.ball, g = q.facets ? new THREE.SphereGeometry(r, q.facets[0], q.facets[1]) : new THREE.SphereGeometry(r, 18, 12);
      if (q.facets) mat.flatShading = true; add(g).position.set(at, 0, 0);
    } else if (q.frets) {
      const [a, b, n, w, z] = q.frets, at = k => a + (b - a) * (1 - Math.pow(2, -k / 12)) / (1 - Math.pow(2, -n / 12));
      for (let k = 1; k <= n; k++) add(new THREE.BoxGeometry(0.0018, w, 0.0014)).position.set(at(k), 0, z);
      if (q.dots) { const dm = new THREE.MeshStandardMaterial({ color: col(0xf2eee4), roughness: 0.3 });
        for (const k of [3, 5, 7, 9, 12, 15]) for (const o of k === 12 ? [-w * 0.25, w * 0.25] : [0]) { const dot = add(new THREE.CylinderGeometry(w * 0.07, w * 0.07, 0.001, 12), dm); dot.position.set((at(k - 1) + at(k)) / 2, o, z - 0.0002); dot.rotation.x = Math.PI / 2; } }
    } else if (q.pegs) {
      const [a, b, n, sz] = q.pegs;
      for (let k = 0; k < n; k++) for (const sd of [-1, 1]) { const g = new THREE.CylinderGeometry(sz * 0.35, sz * 0.35, sz * 2.2, 8); add(g).position.set(a + (b - a) * (k + 0.5) / n, sd * (q.out || 0.015), q.z || 0); }
    } else if (q.keys) {
      const [a, b, n, r] = q.keys, top = q.z || 0.0105;
      for (let k = 0; k < n; k++) { const g = new THREE.CylinderGeometry(r, r, 0.003, 18); g.rotateX(Math.PI / 2); add(g).position.set(a + (b - a) * (k + 0.5) / n, (k % 3 === 2 ? 0.004 : 0), top); }
      const rod = new THREE.CylinderGeometry(0.0013, 0.0013, b - a, 8); rod.rotateZ(-Math.PI / 2); add(rod).position.set((a + b) / 2, -0.009, top - 0.003);
    } else if (q.acoustic) {
      const [a, b, w, dp] = q.acoustic, L = b - a, N = 48, edge = [];
      // the outline: the lower bout (the wider) nearest the tip, the waist, the upper bout towards the neck - one smooth line
      const half = u => { const lo = 0.5 * w * Math.sqrt(Math.max(0, 1 - ((u - 0.3) / 0.31) ** 2)), up = 0.38 * w * Math.sqrt(Math.max(0, 1 - ((u - 0.76) / 0.25) ** 2)), waist = 0.31 * w;
        return Math.max(lo, up, u > 0.25 && u < 0.85 ? waist : 0, 0.002); };
      for (let i = 0; i <= N; i++) { const u = i / N; edge.push([a + u * L, half(u)]); }
      for (let k = 0; k < 2; k++) for (let i = 1; i < N; i++) edge[i][1] = (edge[i - 1][1] + 2 * edge[i][1] + edge[i + 1][1]) / 4;   // (smoothed)
      const sh = new THREE.Shape(); sh.moveTo(edge[0][0], 0); for (const [x, y] of edge) sh.lineTo(x, y); for (let i = N; i >= 0; i--) sh.lineTo(edge[i][0], -edge[i][1]);
      const side = new THREE.ExtrudeGeometry(sh, { depth: dp, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 4 }); side.translate(0, 0, -dp / 2);
      add(side, new THREE.MeshPhysicalMaterial({ color: col(0x5a2a14), roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 0.5 }));
      // the top: spruce, its grain along the cue, a rosette round the sound hole, the pickguard, the bridge - drawn, then laid on
      const c = mkCanvas(1024, 512), g = c.getContext('2d'), X = x => (x - a) / L * 1024, Y = y => (0.5 - y / w) * 512;
      g.drawImage(woodTop().image, 0, 0, 1024, 512);
      const hx = X(a + L * 0.62), hr = 0.13 * 512 * 0.5;           // (the sound hole: in picture pixels across the body)
      for (const [r, cl, lw] of [[hr * 1.55, '#2a1608', 6], [hr * 1.42, '#f0e4c8', 3], [hr * 1.3, '#2a1608', 4]]) { g.strokeStyle = cl; g.lineWidth = lw; g.beginPath(); g.ellipse(hx, 256, r * 2 * w / L, r, 0, 0, 7); g.stroke(); }
      g.fillStyle = '#0b0603'; g.beginPath(); g.ellipse(hx, 256, hr * 2 * w / L, hr, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(30,14,8,.85)'; g.beginPath(); g.ellipse(hx - hr * 1.6 * w / L, 256 + hr * 1.5, hr * 1.8 * w / L, hr * 0.75, 0.4, 0, 7); g.fill();                       // pickguard
      g.fillStyle = '#24130a'; g.fillRect(X(a + L * 0.2) - 12, Y(w * 0.2), 24, Y(-w * 0.2) - Y(w * 0.2)); g.fillStyle = '#efe6d2'; g.fillRect(X(a + L * 0.2) + 4, Y(w * 0.12), 4, Y(-w * 0.12) - Y(w * 0.12));   // bridge, saddle
      const t = tex(c); t.repeat.set(1 / L, 1 / w); t.offset.set(-a / L, 0.5);
      const capG = new THREE.ShapeGeometry(sh, 6);
      add(capG, new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.5 })).position.z = dp / 2 + 0.0021;
      const back = add(new THREE.ShapeGeometry(sh, 6), new THREE.MeshStandardMaterial({ color: col(0x3e1c0c), roughness: 0.4 })); back.position.z = -dp / 2 - 0.0021; back.rotation.x = Math.PI;
      // strings: from the saddle to the head
      const [hx2, hz] = q.strings || [1.25, 0.012], v = [], zt = dp / 2 + 0.006;
      for (let k = 0; k < 6; k++) { const y0 = (k - 2.5) * w * 0.035, y1 = (k - 2.5) * 0.0042; v.push(a + L * 0.2 + 0.002, y0, zt, hx2, y1, hz); }
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      cue.add(new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0xe8e4da })));
    }
  }
  let cueNow3d = 0;
  function setCue(i) {
    cueNow3d = i; const d = CUES[i] || CUES[0];
    while (cue.children.length) { const m = cue.children.pop(); m.geometry.dispose(); if (m.material.map) m.material.map.dispose(); m.material.dispose(); }
    const part = (x0, x1, r0, r1, mat, sides, flat) => {
      const g = new THREE.CylinderGeometry(r1, r0, x1 - x0, sides || 20); g.rotateZ(-Math.PI / 2); if (flat) g.scale(1, 1, flat); g.translate((x0 + x1) / 2, 0, 0);
      cue.add(new THREE.Mesh(g, mat));
    };
    const std = (h, ro, me) => new THREE.MeshStandardMaterial({ color: col(h), roughness: ro, metalness: me || 0, envMapIntensity: 0.5 });
    // (cut crystal: clear, faceted, catching the room's lamps; opacity k)
    const glass = (h, k) => new THREE.MeshPhysicalMaterial({ color: col(h), roughness: 0.03, metalness: 0.1, transparent: true, opacity: k, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.4, flatShading: true, depthWrite: false });
    /* A cue with its own make (content/20-cues.js: profile, glow): its sections as given, tip first - and a lit blade, a
       bright core with its colour round it (two soft sheaths drawn added to the light, the way a glow looks) */
    if (d.profile) {
      /* a section's own options: rough, metal; sides (6: a pencil's flats); pic (a picture from web/tex wrapped round it,
         its width along the cue, rep: [round, along]); lit (it gives off its own light, that colour) */
      for (const [x0, x1, r0, r1, h, o] of d.profile) {
        // (glass: cut crystal - clear, faceted, catching the room's lights)
        const q = o || {}, m = q.glass ? glass(h, q.glass) : std(h, q.rough != null ? q.rough : 0.4, q.metal || 0);
        if (q.lit != null) { m.emissive = col(q.lit); m.emissiveIntensity = 1.6; }
        if (q.pic) {
          const at = cue.children.length, rep = q.rep || [1, Math.max(1, Math.round((x1 - x0) / 0.12))];
          loadTex(q.pic, 0, t => {
            const k = t.clone(); k.needsUpdate = true; k.wrapS = k.wrapT = THREE.RepeatWrapping; k.center.set(0.5, 0.5); k.rotation = Math.PI / 2; k.repeat.set(rep[1], rep[0]);
            const me = cue.children[at]; if (me && me.material === m) { m.map = k; m.needsUpdate = true; dirty = 3; }
          });
        }
        part(x0, x1, r0, r1, m, q.sides, q.flat);
      }
      for (const q of d.parts || []) cuePart(q, q.glass ? glass(q.color, q.glass) : std(q.color != null ? q.color : 0xffffff, q.rough != null ? q.rough : 0.4, q.metal || 0));
      if (d.glow) {
        const G = d.glow, core = new THREE.MeshBasicMaterial({ color: col(G.core != null ? G.core : 0xffffff), toneMapped: false });
        // (each layer ends round at the tip, not cut square: a cap of its own radius)
        const r = G.r || 0.0062, cap = (rad, mat) => { const m = new THREE.Mesh(new THREE.SphereGeometry(rad, 16, 10), mat); m.position.set(G.from, 0, 0); cue.add(m); return m; };
        part(G.from, G.to, r, r, core); cap(r, core);
        for (const [k, op] of [[1.7, 0.55], [3.2, 0.2]]) {
          const m = new THREE.MeshBasicMaterial({ color: col(G.color), transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
          part(G.from, G.to + 0.004, r * k, r * k, m); cue.children[cue.children.length - 1].renderOrder = 3; cap(r * k, m).renderOrder = 3;
        }
      }
      dirty = 3; return;
    }
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

  /* A picture of a cue from above, tip on the left, on a clear ground (for making its card: W x H pixels showing the cue's
     1.5 m and spanY metres across). The cue in play is borrowed for it and put back as it was. */
  function cuePortrait(i, W, H, spanY) {
    const was = cueNow3d; setCue(i);
    const sc = new THREE.Scene(); sc.environment = scene.environment;
    sc.add(new THREE.HemisphereLight(0xffffff, 0x404040, 0.6)); const key = new THREE.DirectionalLight(0xfff4e6, 0.9); key.position.set(0.4, 0.6, 2); sc.add(key);
    const cam = new THREE.OrthographicCamera(-0.015, 1.5, spanY / 2, -spanY / 2, 0.01, 10); cam.position.set(0, 0, 3); cam.lookAt(0, 0, 0);
    const keep = { p: cue.position.clone(), r: cue.rotation.clone(), v: cue.visible }, parent = cue.parent;
    parent.remove(cue); sc.add(cue); cue.position.set(0, 0, 0); cue.rotation.set(0, 0, 0); cue.visible = true; cue.updateMatrixWorld(true);
    const rt = new THREE.WebGLRenderTarget(W, H); rt.texture.encoding = THREE.sRGBEncoding;
    const prev = renderer.getRenderTarget(), cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha();
    renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); unmask(); renderer.clear(); renderer.render(sc, cam);
    const px = new Uint8Array(W * H * 4); renderer.readRenderTargetPixels(rt, 0, 0, W, H, px);
    renderer.setRenderTarget(prev); renderer.setClearColor(cc, ca); rt.dispose();
    sc.remove(cue); parent.add(cue); cue.position.copy(keep.p); cue.rotation.copy(keep.r); cue.visible = keep.v; setCue(was); dirty = 3;
    const c = mkCanvas(W, H), g = c.getContext('2d'), im = g.createImageData(W, H);
    for (let y = 0; y < H; y++) im.data.set(px.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    g.putImageData(im, 0, 0); return c.toDataURL('image/png');
  }
