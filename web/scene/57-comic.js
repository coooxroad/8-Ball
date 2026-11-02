  /* Comic hits and mirror-ball lights (content/30-balls.js finish.toon / finish.facets).
     A comic set: a hard hit pops a sound-word bubble out of the page where it happened (tex/fx-pow: 쾅! 딱! 팍!
     퉁!) - it jumps up, holds, fades. A mirror-ball set: each ball throws a ring of small lights onto the cloth round it,
     turning as the ball rolls (finish.spots 'rainbow': in the colours a crystal splits light into). */
  const pops = [];
  let popTex = null, popWait = 0;
  loadTex('fx-pow', 0, t => { popTex = t; });
  for (let i = 0; i < 6; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false, depthTest: false, toneMapped: false }));
    sp.visible = false; sp.renderOrder = 6; scene.add(sp); pops.push({ sp, age: 0, life: 0, size: 0 });
  }
  const comicOn = () => !!(skin && skin.finish && skin.finish.toon);
  // a contact the physics reported (the app passes on its sound events): { t: 'ball' | 'rail', v, x, y }
  function hit(e) {
    if (!popTex || !comicOn() || popWait > 0) return;
    const hard = e.t === 'ball' ? e.v > 1.1 : e.v > 1.8; if (!hard) return;
    const cell = e.t === 'rail' ? 3 : e.v > 3.2 ? 2 : (Math.random() < 0.5 ? 0 : 1);
    let q = pops[0]; for (const p of pops) if (!p.sp.visible) { q = p; break; } else if (p.age > q.age) q = p;
    const m = q.sp.material;
    if (!m.map || m.userData.cell !== cell) { if (m.map) m.map.dispose(); const t = popTex.clone(); t.needsUpdate = true; t.repeat.set(0.25, 1); t.offset.set(cell * 0.25, 0); m.userData.cell = cell; m.map = t; m.needsUpdate = true; }
    q.age = 0; q.life = 0.85; q.size = Math.min(0.26, 0.13 + e.v * 0.025);
    m.rotation = (Math.random() - 0.5) * 0.5; q.sp.position.set(e.x + (Math.random() - 0.5) * 0.03, e.y + 0.05, 0.09); q.sp.visible = true;
    popWait = 0.16; dirty = 3;
  }
  function popsTick(dt) {
    popWait -= dt; let live = false;
    for (const q of pops) {
      if (!q.sp.visible) continue;
      q.age += dt; const u = q.age / q.life;
      if (u >= 1) { q.sp.visible = false; continue; }
      // jumps up past its size and settles, holds, then fades away
      const k = q.age < 0.12 ? 1.18 * q.age / 0.12 : q.age < 0.2 ? 1.18 - 0.18 * (q.age - 0.12) / 0.08 : 1;
      q.sp.scale.set(q.size * k, q.size * k, 1); q.sp.material.opacity = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3; live = true;
    }
    return live;
  }
  // the mirror ball's lights: a ring of dots on the cloth for every ball of the set, their angle from how the ball has turned
  let disco = null;
  function discoTick(w, R) {
    const on = !!(skin && skin.finish && skin.finish.facets) && !!w;
    if (!on) { if (disco) disco.pts.visible = false; return; }
    if (!disco) disco = fxSystem(THREE.AdditiveBlending, 220);
    const L = disco.list; L.length = 0;
    for (const b of w.balls) {
      if (!b.on || b.z) continue;
      const q = b.q, turn = Math.atan2(2 * (q[3] * q[2] + q[0] * q[1]), 1 - 2 * (q[1] * q[1] + q[2] * q[2])) + q[0] * 3;
      for (let k = 0; k < 9; k++) {
        const a = turn + k * 2.399, r = R * (1.7 + 1.6 * ((k * 0.618) % 1));
        const rb = skin.finish.spots === 'rainbow' ? fxCol.setHSL(((k * 0.137 + turn * 0.05) % 1 + 1) % 1, 0.9, 0.62) : null;   // (a crystal splits the light into colours)
        L.push({ x: b.x + Math.cos(a) * r, y: b.y + Math.sin(a) * r, z: 0.002, s0: R * (0.28 + 0.2 * ((k * 0.382) % 1)), s1: null, a0: rb ? 0.7 : 0.55, life: Infinity, age: 0, vx: 0, vy: 0, vz: 0, g: 0, tw: 0, r: rb ? rb.r : 1, gr: rb ? rb.g : 0.97, b: rb ? rb.b : 0.9, sh: 0.5 });
      }
    }
    for (const o of L) o.s1 = o.s0;
    fxStep(disco, 0, R);
    renderer.getDrawingBufferSize(fxScaleV); disco.mat.uniforms.uScale.value = camera.projectionMatrix.elements[5] * fxScaleV.y / 2;
  }
