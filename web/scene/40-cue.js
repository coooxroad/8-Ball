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
  /* a flute, its tip at the crown: the three joints (head, body, foot) each meeting the next in a sleeve with a raised rim,
     the crown and its finial, the lip plate on its riser with the dark embouchure hole, open-hole keys down the body (rim,
     pad, the hole through it) on arms from the two rods that run along its side on little posts, and the foot's keys and
     rollers. [from, to]; all of it bright silver. */
  function fluteParts([a, b], mat, add) {
    const L = b - a, R = 0.0095, at = u => a + L * u, dark = new THREE.MeshBasicMaterial({ color: 0x050505 }), pad = new THREE.MeshStandardMaterial({ color: col(0xe9e0cc), roughness: 0.8 });
    const shade = new THREE.MeshStandardMaterial({ color: col(0x23262b), roughness: 0.6, metalness: 0.4 });
    // the keys polished brighter than the body; the mechanism's tubes a shade warmer
    const key = mat.clone(); key.color = col(0xf4f5f7); key.roughness = 0.06;
    const steel = mat.clone(); steel.color = col(0xd9dbde); steel.roughness = 0.1;
    const ring = (x, r, w, m) => { const g = new THREE.CylinderGeometry(r, r, w, 28); g.rotateZ(-Math.PI / 2); add(g, m).position.set(x, 0, 0); };
    const tube = (x0, x1, r, y, z, m) => { const g = new THREE.CylinderGeometry(r, r, x1 - x0, 10); g.rotateZ(-Math.PI / 2); add(g, m).position.set((x0 + x1) / 2, y, z); };
    // three joints - head, body, foot: each joint's sleeve with a rim either side and a dark seam where the tubes meet
    for (const u of [0.22, 0.79]) {
      ring(at(u), R * 1.12, 0.03, key); ring(at(u) - 0.016, R * 1.2, 0.003, key); ring(at(u) + 0.016, R * 1.2, 0.003, key);
      ring(at(u) - 0.0185, R * 1.02, 0.0012, shade); ring(at(u) + 0.0185, R * 1.02, 0.0012, shade);
    }
    // the crown and its finial
    ring(a + 0.006, R * 1.08, 0.012, key); ring(a + 0.0125, R * 1.0, 0.001, shade); add(new THREE.SphereGeometry(R * 0.75, 18, 10), key).position.set(a - 0.002, 0, 0);
    // the lip plate: a curved plate (a squashed sphere's cap) on its riser, the hole in it
    const lx = at(0.09), lip = add(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.32), key); lip.rotation.x = Math.PI / 2; lip.scale.set(0.017, 0.006, 0.012); lip.position.set(lx, 0, R - 0.002);
    const riser = add(new THREE.CylinderGeometry(0.0045, 0.005, 0.004, 18), key); riser.rotation.x = Math.PI / 2; riser.position.set(lx, 0, R + 0.004);
    const hole = add(new THREE.CircleGeometry(1, 20), dark); hole.scale.set(0.0045, 0.0032, 1); hole.position.set(lx, 0, R + 0.0063);
    // the mechanism along the side: two tubes (a rod in its hinge tube, and the one the foot keys turn on), on posts
    const rodY = -R * 1.12, rodZ = R * 0.5;
    for (const [u0, u1] of [[0.25, 0.77], [0.81, 0.98]]) {
      tube(at(u0), at(u1), 0.0019, rodY, rodZ, steel); tube(at(u0) + 0.004, at(u1) - 0.004, 0.0013, rodY * 0.74, rodZ * 1.75, steel);
      for (let k = 0; k <= 6; k++) { const p = add(new THREE.CylinderGeometry(0.0013, 0.0017, R * 0.55, 8), steel); p.position.set(at(u0 + (u1 - u0) * k / 6), rodY * 0.84, rodZ * 0.45); p.rotation.x = 0.9; }
    }
    // the keys: open-hole cups on top of the body, closed ones on the foot; each in a dark ring of shadow, on an arm from the rod
    const cup = (u, r, open) => {
      const x = at(u);
      add(new THREE.TorusGeometry(r * 1.05, 0.0012, 6, 26), shade).position.set(x, 0, R + 0.0008);
      add(new THREE.TorusGeometry(r, 0.0012, 8, 26), key).position.set(x, 0, R + 0.0024);
      const c = new THREE.CylinderGeometry(r, r * 0.96, 0.0022, 26); c.rotateX(Math.PI / 2); add(c, key).position.set(x, 0, R + 0.0016);
      add(new THREE.CircleGeometry(r * 0.86, 22), pad).position.set(x, 0, R + 0.0028);
      if (open) { add(new THREE.CircleGeometry(r * 0.32, 16), dark).position.set(x, 0, R + 0.0029); add(new THREE.TorusGeometry(r * 0.36, 0.0008, 6, 18), key).position.set(x, 0, R + 0.003); }
      const arm = new THREE.BoxGeometry(0.0026, R * 1.25, 0.0014); const m = add(arm, key); m.position.set(x, -R * 0.66, R * 0.95); m.rotation.x = -0.75;
    };
    [0.29, 0.34, 0.39, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75].forEach((u, i) => cup(u, i % 3 === 2 ? 0.0058 : 0.0068, i < 8 && i % 2 === 0));
    [0.84, 0.89, 0.94].forEach(u => cup(u, 0.0064, false));
    // the foot's rollers
    for (const u of [0.86, 0.9]) { const g = new THREE.CylinderGeometry(0.0022, 0.0022, 0.009, 12); g.rotateZ(-Math.PI / 2); add(g, key).position.set(at(u), R * 0.7, R * 0.75); }
  }
  function cuePart(q, mat) {
    const add = (g, m) => { const o = new THREE.Mesh(g, m || mat); cue.add(o); return o; };
    if (q.box) { const [a, b, w, h] = q.box; add(new THREE.BoxGeometry(b - a, w, h)).position.set((a + b) / 2, 0, q.z || 0); }
    else if (q.neck) {
      // a guitar's neck: round at the back, flat under the fretboard, tapering [x0, x1, width at x0, width at x1, thickness]
      const [a, b, w0, w1, th] = q.neck, g = new THREE.CylinderGeometry(w1 / 2, w0 / 2, b - a, 20, 1, false, 0, Math.PI);
      g.rotateZ(-Math.PI / 2); g.rotateX(Math.PI / 2); g.scale(1, 1, 2 * th / ((w0 + w1) / 2));   // (the round half below, the flat face up)
      add(g).position.set((a + b) / 2, 0, q.z || 0);
    }
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
    } else if (q.stones) {
      // a ring of small cut stones round the cue (crystal)
      const [at, r, n, sz] = q.stones, g = new THREE.SphereGeometry(sz, 8, 5);
      for (let k = 0; k < n; k++) { const a = k / n * 2 * Math.PI; add(g).position.set(at, Math.cos(a) * r, Math.sin(a) * r); }
    } else if (q.flute) {
      fluteParts(q.flute, mat, add);
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
      const bu = q.bridge || 0.2, hx = X(a + L * (q.hole || 0.62)), hr = (q.holeR || 0.065) * 512;   // (the sound hole: in picture pixels across the body)
      for (const [r, cl, lw] of [[hr * 1.55, '#2a1608', 6], [hr * 1.42, '#f0e4c8', 3], [hr * 1.3, '#2a1608', 4]]) { g.strokeStyle = cl; g.lineWidth = lw; g.beginPath(); g.ellipse(hx, 256, r * 2 * w / L, r, 0, 0, 7); g.stroke(); }
      g.fillStyle = '#0b0603'; g.beginPath(); g.ellipse(hx, 256, hr * 2 * w / L, hr, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(30,14,8,.85)'; g.beginPath(); g.ellipse(hx - hr * 1.6 * w / L, 256 + hr * 1.5, hr * 1.8 * w / L, hr * 0.75, 0.4, 0, 7); g.fill();                       // pickguard
      g.fillStyle = '#24130a'; g.fillRect(X(a + L * bu) - 12, Y(w * 0.2), 24, Y(-w * 0.2) - Y(w * 0.2)); g.fillStyle = '#efe6d2'; g.fillRect(X(a + L * bu) + 4, Y(w * 0.12), 4, Y(-w * 0.12) - Y(w * 0.12));   // bridge, saddle
      const t = tex(c); t.repeat.set(1 / L, 1 / w); t.offset.set(-a / L, 0.5);
      const capG = new THREE.ShapeGeometry(sh, 6);
      add(capG, new THREE.MeshPhysicalMaterial({ map: t, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.5 })).position.z = dp / 2 + 0.0021;
      const back = add(new THREE.ShapeGeometry(sh, 6), new THREE.MeshStandardMaterial({ color: col(0x3e1c0c), roughness: 0.4 })); back.position.z = -dp / 2 - 0.0021; back.rotation.x = Math.PI;
      // strings: from the saddle to the head
      const [hx2, hz, nut] = q.strings || [1.25, 0.012, 0.0042], v = [], zt = dp / 2 + 0.006, sp = q.spread || w * 0.035;
      for (let k = 0; k < 6; k++) { const y0 = (k - 2.5) * sp, y1 = (k - 2.5) * nut; v.push(a + L * bu + 0.002, y0, zt, hx2, y1, hz); }
      const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
      cue.add(new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0xe8e4da })));
    }
  }
  let cueNow3d = 0;
  function setCue(i) {
    cueNow3d = i; const d = CUES[i] || CUES[0];
    while (cue.children.length) { const m = cue.children.pop(); m.geometry.dispose(); if (m.material.map) m.material.map.dispose(); m.material.dispose(); }
    const part = (x0, x1, r0, r1, mat, sides, flat, turn) => {
      const g = new THREE.CylinderGeometry(r1, r0, x1 - x0, sides || 20); g.rotateZ(-Math.PI / 2); if (turn) g.rotateX(turn); if (flat) g.scale(1, 1, flat); g.translate((x0 + x1) / 2, 0, 0);
      cue.add(new THREE.Mesh(g, mat));
    };
    const std = (h, ro, me) => new THREE.MeshStandardMaterial({ color: col(h), roughness: ro, metalness: me || 0, envMapIntensity: 0.5 });
    // (cut crystal: clear, faceted, catching the room's lamps; opacity k)
    const glass = (h, k) => crystallize(new THREE.MeshPhysicalMaterial({ color: col(h), roughness: 0.05, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 0.8, flatShading: true }), { rim: 1.1, sparkle: 0.14 * (k || 1), cut: 16, deep: 0.62, inner: 2.2, pos: 1.6, fire: 1.1 });
    /* A cue with its own make (content/20-cues.js: profile, glow): its sections as given, tip first - and a lit blade, a
       bright core with its colour round it (two soft sheaths drawn added to the light, the way a glow looks) */
    if (d.profile) {
      /* a section's own options: rough, metal; sides (6: a pencil's flats); pic (a picture from web/tex wrapped round it,
         its width along the cue, rep: [round, along]); lit (it gives off its own light, that colour); hide (not drawn: the
         line only carries on under raised parts, as a guitar's neck) */
      for (const [x0, x1, r0, r1, h, o] of d.profile) {
        if (o && o.hide) continue;
        // (glass: cut crystal - clear, faceted, catching the room's lights)
        const q = o || {}, m = q.glass ? glass(h, q.glass) : std(h, q.rough != null ? q.rough : 0.4, q.metal || 0);
        if (q.env) m.envMapIntensity = q.env;
        if (q.lit != null) { m.emissive = col(q.lit); m.emissiveIntensity = 1.6; }
        // (check: [dark, light, round, along] - chequers wrapped round the section, as a finish flag)
        if (q.check) {
          const [c0, c1, nr, na] = q.check, cv = mkCanvas(nr * 16, na * 16), cg = cv.getContext('2d');
          for (let y = 0; y < na; y++) for (let x = 0; x < nr; x++) { cg.fillStyle = '#' + ((x + y) % 2 ? c1 : c0).toString(16).padStart(6, '0'); cg.fillRect(x * 16, y * 16, 16, 16); }
          const t = tex(cv); t.magFilter = THREE.NearestFilter; m.map = t; m.color.set(0xffffff);
        }
        if (q.pic) {
          const at = cue.children.length, rep = q.rep || [1, Math.max(1, Math.round((x1 - x0) / 0.12))];
          loadTex(q.pic, 0, t => {
            const k = t.clone(); k.needsUpdate = true; k.wrapS = k.wrapT = THREE.RepeatWrapping; k.center.set(0.5, 0.5); k.rotation = Math.PI / 2; k.repeat.set(rep[1], rep[0]);
            const me = cue.children[at]; if (me && me.material === m) { m.map = k; m.needsUpdate = true; dirty = 3; }
          });
        }
        // (cut: the section in that many short lengths, each turned half a facet from the last - a cut-glass twist)
        if (q.cut) { for (let j = 0; j < q.cut; j++) { const t0 = j / q.cut, t1 = (j + 1) / q.cut; part(x0 + (x1 - x0) * t0, x0 + (x1 - x0) * t1, r0 + (r1 - r0) * t0, r0 + (r1 - r0) * t1, m, q.sides || 8, q.flat, j % 2 ? Math.PI / (q.sides || 8) : 0); } }
        else part(x0, x1, r0, r1, m, q.sides, q.flat);
      }
      for (const q of d.parts || []) { const pm = q.glass ? glass(q.color, q.glass) : std(q.color != null ? q.color : 0xffffff, q.rough != null ? q.rough : 0.4, q.metal || 0); if (q.env) pm.envMapIntensity = q.env; if (q.facets && q.glass) pm.flatShading = true; cuePart(q, pm); }
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
     1.5 m and spanY metres across). The cue in play is borrowed for it and put back as it was. A part of it only: from x0
     to x1 along it (metres); spanY 'auto': as wide as the cue is (a guitar's body), and H null: as tall as that makes it. */
  let portraitSpan = 0;                                              // (how wide the last picture was, in metres)
  function cuePortrait(i, W, H, spanY, x0 = -0.015, x1 = 1.5) {
    const was = cueNow3d; setCue(i);
    const sc = new THREE.Scene(); sc.environment = scene.environment;
    sc.add(new THREE.HemisphereLight(0xffffff, 0x404040, 0.6)); const key = new THREE.DirectionalLight(0xfff4e6, 0.9); key.position.set(0.4, 0.6, 2); sc.add(key);
    const keep = { p: cue.position.clone(), r: cue.rotation.clone(), v: cue.visible }, parent = cue.parent;
    parent.remove(cue); sc.add(cue); cue.position.set(0, 0, 0); cue.rotation.set(0, 0, 0); cue.visible = true; cue.updateMatrixWorld(true);
    if (spanY === 'auto') { const bx = new THREE.Box3().setFromObject(cue); spanY = Math.max(0.026, 2.3 * Math.max(Math.abs(bx.min.y), Math.abs(bx.max.y))); }
    if (H == null) H = Math.max(8, Math.round(W * spanY / (x1 - x0)));
    portraitSpan = spanY;
    const cam = new THREE.OrthographicCamera(x0, x1, spanY / 2, -spanY / 2, 0.01, 10); cam.position.set(0, 0, 3); cam.lookAt(0, 0, 0);
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
