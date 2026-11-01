  /* cue stick */
  const cue = new THREE.Group(); cue.rotation.order = 'ZYX'; scene.add(cue);
  const cueShadow = new THREE.Mesh(unitPlane, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
  cueShadow.renderOrder = 1; scene.add(cueShadow);
  function setCue(i) {
    const d = CUES[i] || CUES[0];
    while (cue.children.length) { const m = cue.children.pop(); m.geometry.dispose(); if (m.material.map) m.material.map.dispose(); m.material.dispose(); }
    const part = (x0, x1, r0, r1, mat, sides) => {
      const g = new THREE.CylinderGeometry(r1, r0, x1 - x0, sides || 20); g.rotateZ(-Math.PI / 2); g.translate((x0 + x1) / 2, 0, 0);
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
        part(x0, x1, r0, r1, m, q.sides);
      }
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

