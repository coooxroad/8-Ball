  /* cue stick */
  const cue = new THREE.Group(); cue.rotation.order = 'ZYX'; scene.add(cue);
  const cueShadow = new THREE.Mesh(unitPlane, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
  cueShadow.renderOrder = 1; scene.add(cueShadow);
  /* A cue's other parts (content/20-cues.js parts): things that are not turned on a lathe, x along the cue from the tip,
     z up. box [from, to, width, height] (a crossguard); ball [at, radius] (a pommel); prongs [from, to, spread, radius] (a
     trident's two outer prongs, pointed at the tip end, and the bar that holds them); frets [from, to, count, width, z] (a
     guitar's, closer together towards the body); pegs [from, to, count, size] (tuning pegs out of both sides); guitar
     [from, to, width, thickness] (the body: two bouts and a waist, lying flat, a sound hole and a bridge, and six strings
     from the head to the bridge). */
  function cuePart(q, mat) {
    const add = (g, m) => { const o = new THREE.Mesh(g, m || mat); cue.add(o); return o; };
    if (q.box) { const [a, b, w, h] = q.box; add(new THREE.BoxGeometry(b - a, w, h)).position.set((a + b) / 2, 0, q.z || 0); }
    else if (q.ball) { const [at, r] = q.ball; add(new THREE.SphereGeometry(r, 18, 12)).position.set(at, 0, 0); }
    else if (q.prongs) {
      const [a, b, sp, r] = q.prongs;
      for (const sd of [-1, 1]) {
        const g = new THREE.CylinderGeometry(r, r, b - a, 10); g.rotateZ(-Math.PI / 2); add(g).position.set((a + b) / 2, sd * sp, 0);
        const c = new THREE.ConeGeometry(r * 1.6, r * 6, 10); c.rotateZ(Math.PI / 2); add(c).position.set(a - r * 3, sd * sp, 0);
      }
      add(new THREE.BoxGeometry(r * 3, 2 * sp + 2 * r, r * 2.2)).position.set(b, 0, 0);
    } else if (q.frets) {
      const [a, b, n, w, z] = q.frets, at = k => a + (b - a) * (1 - Math.pow(2, -k / 12)) / (1 - Math.pow(2, -n / 12));
      for (let k = 1; k <= n; k++) add(new THREE.BoxGeometry(0.0016, w, 0.0012)).position.set(at(k), 0, z);
    } else if (q.pegs) {
      const [a, b, n, sz] = q.pegs;
      for (let k = 0; k < n; k++) for (const sd of [-1, 1]) { const g = new THREE.CylinderGeometry(sz * 0.35, sz * 0.35, sz * 2.2, 8); add(g).position.set(a + (b - a) * (k + 0.5) / n, sd * (q.out || 0.015), 0); }
    } else if (q.guitar) {
      const [a, b, w, th] = q.guitar, L = b - a, N = 40, top = [];
      // the outline's half-width along the body: the upper bout, the waist, the lower bout (bigger, towards the butt)
      const half = u => Math.max(0.78 * w / 2 * Math.sqrt(Math.max(0, 1 - ((u - 0.3) / 0.3) ** 2)), w / 2 * Math.sqrt(Math.max(0, 1 - ((u - 0.68) / 0.33) ** 2)), u > 0.08 && u < 0.92 ? w * 0.3 : 0);
      for (let i = 0; i <= N; i++) { const u = i / N; top.push([a + u * L, Math.max(0.004, half(u))]); }
      const sh = new THREE.Shape(); sh.moveTo(top[0][0], -top[0][1]); for (const [x, y] of top) sh.lineTo(x, y); for (let i = N; i >= 0; i--) sh.lineTo(top[i][0], -top[i][1]);
      const g = new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 2, curveSegments: 4 }); g.translate(0, 0, -th / 2);
      // the top: a sunburst, dark at the edge
      const cv = mkCanvas(256, 128), cg = cv.getContext('2d'), gr = cg.createRadialGradient(150, 64, 4, 150, 64, 130);
      gr.addColorStop(0, '#f4b34a'); gr.addColorStop(0.55, '#d9772a'); gr.addColorStop(0.85, '#7a2e12'); gr.addColorStop(1, '#2a120a'); cg.fillStyle = gr; cg.fillRect(0, 0, 256, 128);
      const t = tex(cv); t.repeat.set(1 / L, 1 / w); t.offset.set(-a / L, 0.5);
      add(g, new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.6 }));
      add(new THREE.CircleGeometry(w * 0.16, 28), new THREE.MeshBasicMaterial({ color: 0x0a0604 })).position.set(a + L * 0.36, 0, th / 2 + 0.0032);
      add(new THREE.BoxGeometry(0.012, w * 0.42, 0.004), new THREE.MeshStandardMaterial({ color: col(0x1a100a), roughness: 0.5 })).position.set(a + L * 0.72, 0, th / 2 + 0.004);
      const v = [], zt = th / 2 + 0.0065, zh = q.zHead || 0.006;
      for (let k = 0; k < 6; k++) { const y0 = (k - 2.5) * 0.0028, y1 = (k - 2.5) * w * 0.06; v.push(q.head || 0.04, y0, zh, a + L * 0.72, y1, zt); }
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
    /* A cue with its own make (content/20-cues.js: profile, glow): its sections as given, tip first - and a lit blade, a
       bright core with its colour round it (two soft sheaths drawn added to the light, the way a glow looks) */
    if (d.profile) {
      /* a section's own options: rough, metal; sides (6: a pencil's flats); pic (a picture from web/tex wrapped round it,
         its width along the cue, rep: [round, along]); lit (it gives off its own light, that colour) */
      for (const [x0, x1, r0, r1, h, o] of d.profile) {
        const q = o || {}, m = std(h, q.rough != null ? q.rough : 0.4, q.metal || 0);
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
      for (const q of d.parts || []) cuePart(q, std(q.color, q.rough != null ? q.rough : 0.4, q.metal || 0));
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
