  /* Every material and picture drawn once, one pixel big, before it is first needed (desktop stutter, owner 11-09): a
     shader is compiled, and a texture sent to the GPU, the first time something is drawn - and the first shot drew the
     cue's follow-through parts and a guide piece for the first time, a frame of 50-150 ms on a PC (a second in a software
     renderer). So right after the table, cloth, balls, cue or trail change, and at the start, while nothing is moving,
     everything there is - hidden or not, out of view or not, the static layer as it is baked and as the 3D view and a
     falling ball draw it - goes through the renderer once into a single pixel, and is then drawn as usual. */
  let warmDue = true;
  const warmVp = new THREE.Vector4();
  function prewarm() {
    const shown = [], culled = [], mask = camera.layers.mask;
    for (const S of [sScene, scene]) S.traverse(o => { if (!o.visible) { shown.push(o); o.visible = true; } if (o.frustumCulled) { culled.push(o); o.frustumCulled = false; } });
    renderer.getViewport(warmVp); const pr = renderer.getPixelRatio();
    // The lamps' shadows are drawn once and kept (autoUpdate off), by whichever render comes first after they are asked
    // for. That must not be this one: with everything forced visible, the hidden table (8-ball's pockets under a 4-ball
    // table) and every hidden piece would be baked into the shadows for good. They wait for the next real frame.
    const shadowDue = renderer.shadowMap.needsUpdate; renderer.shadowMap.needsUpdate = false;
    camera.layers.enableAll(); unmask();
    try {
      if (rt) { renderer.setRenderTarget(rt); renderer.setViewport(0, 0, 1.5 / pr, 1.5 / pr); renderer.render(sScene, camera); }
      renderer.setRenderTarget(null); renderer.setViewport(0, 0, 1.5 / pr, 1.5 / pr);
      const bg = sScene.background; sScene.background = null;
      renderer.render(sScene, camera);
      sScene.overrideMaterial = depthMat; renderer.render(sScene, camera); sScene.overrideMaterial = null;
      sScene.background = bg;
      renderer.render(scene, camera);
    } finally {
      for (const o of shown) o.visible = false; for (const o of culled) o.frustumCulled = true;
      renderer.shadowMap.needsUpdate = shadowDue;
      camera.layers.mask = mask; renderer.setRenderTarget(null); renderer.setViewport(warmVp.x, warmVp.y, warmVp.z, warmVp.w);
    }
    staticDirty = true; dirty = 3;
  }

  /* one frame. v: { game, alpha, aim, power, pull, showCue, showGuide, level, spin, legalIds } */
  function frame(v, dt) {
    if (gl.isContextLost()) return false;
    // (the table out of sight - the desk covers it: nothing is drawn, not even the water; drawn afresh once it shows again)
    if (v.covered) { coveredNow = true; return false; }
    if (coveredNow) { coveredNow = false; dirty = 3; }
    // (a new resolution only between shots: changed while the balls run, the redrawn table and the resized canvas were a
    // hitch in the middle of the motion it was meant to smooth)
    const still = !v.animating && !falls.length;
    if (still) takeScale();
    let moved = false;
    for (const k of ['t', 'l', 'r', 'b']) { const d = insTo[k] - ins[k]; if (Math.abs(d) > 0.5) { ins[k] += d * Math.min(1, dt * 9); moved = true; } else ins[k] = insTo[k]; }
    if (moved) applyCamera(true); else if (stale) { stale = false; staticDirty = true; dirty = 3; }
    if (orbit.on && Math.abs(orbit.elTo - orbit.el) > 0.002) { orbit.el += (orbit.elTo - orbit.el) * Math.min(1, dt * 7); orbit.live = 4; applyCamera(); }   // easing down from overhead
    if (orbit.live > 0) dirty = 3;
    if (falls.length || v.animating) dirty = 3;
    if (waterTick(v.game && v.game.world, dt)) dirty = Math.max(dirty, 1);
    if (dirty <= 0) return false; dirty--; renderer.info.reset();
    const g = v.game, P = g.P, w = g.world, R = P.R, set = sets[g.mode.table], a = v.alpha;
    if (warmDue && still && rt) { warmDue = false; const t0 = performance.now(); prewarm(); sProf.warm = performance.now() - t0; }
    // A shaped ball (a potato, a bowling ball) is made of many triangles; small on the screen half of them look the same.
    // '자동': half while the table is seen whole from above and a ball is under 70 screen pixels across; close up, in 3D and
    // the player's view, all of them. '낮음': always half. '높음': always all. (The plain sphere is never changed.)
    dressSet(set, quality === 'high' ? 0 : quality === 'low' ? 1 : !orbit.on && 2 * R * ppm * renderer.getPixelRatio() < 70 ? 1 : 0);
    // carom: ball 1 is drawn yellow unless the game says player 0 has the yellow (4구 draws the colours by lot)
    if (set === sets.carom) { const y = g.yellow == null ? 1 : g.yellow; if (y !== caromY) { const m0 = set.mesh[0].material, m1 = set.mesh[1].material, t = m0.map; m0.map = m1.map; m1.map = t; m0.needsUpdate = m1.needsUpdate = true; caromY = y; } }
    if (P !== cur || !tables.has(P)) { setTable(P); warmDue = true; }
    placeBalls(set, w, R, a);
    fallTick(set, R, dt);
    for (const s of Object.values(sets)) blobSync(s, s === set);
    const c = w.balls[w.cue];
    if (trailTick(w, c, R, dt)) dirty = Math.max(dirty, 2);
    if (ringsTick(dt)) dirty = Math.max(dirty, 2);
    if (popsTick(dt)) dirty = Math.max(dirty, 2);
    discoTick(w, R);
    cue.visible = cueShadow.visible = v.showCue && c.on; guide.visible = v.showGuide && c.on; if (!cue.visible) { chalkCube.visible = false; for (const d of chalkDust) d.m.visible = false; }
    // the follow-through after a hit: the cue is drawn from where the ball was struck, carrying on past it (v.follow)
    const fo = v.follow; if (fo) { cue.visible = cueShadow.visible = !!v.showCue; guide.visible = false; }
    if (cue.visible) placeCue(v, c, R, fo);
    if (guide.visible) drawGuide(v, g, P, w, R, c);
    drawLayers();
    return true;
  }

  // each ball where the physics has it (between its last two steps, by alpha), with its shadows on the cloth
  function placeBalls(set, w, R, a) {
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
        // under the lamp (a rectangle, 10-room.js SHADE): one soft shadow, thrown away from its middle and spread as the lamp
        // is long and wide - the half-shadow of a ball under a wide light reaches out by R times the lamp's size over its height
        { const f = R / (SHADE.z - R), c2 = s.children[1]; c2.position.x = x + (x - SHADE.x) * f; c2.position.y = y + (y - SHADE.y) * f;
          c2.scale.set(R * (2.4 + SHADE.len * f * 1.1 / R), R * (2.4 + SHADE.wid * f * 1.1 / R), 1); }
      } else if (!falls.some(f => f.id === i)) m.visible = false;
    }
  }

  // the balls dropping into a pocket (or flown off the table): a little physics of their own, for the look and the sound
  function fallTick(set, R, dt) {
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
  }

  // the cue at the cue ball (or following through after the hit: fo), its chalk cube and its shadow
  function placeCue(v, c, R, fo) {
    const dx = Math.cos(v.aim), dy = Math.sin(v.aim), cx0 = fo ? fo.x : c.x, cy0 = fo ? fo.y : c.y, pullV = fo ? fo.pull : v.pull, spinV = fo ? fo.spin : v.spin;
    // raised for a masse or a jump: the butt comes up and the tip comes down onto the top of the ball
    const e = fo ? fo.el : v.el || 0, ce = Math.cos(e), se = Math.sin(e);
    const tx = cx0 - dx * ce * (R + pullV), ty = cy0 - dy * ce * (R + pullV);
    // Seen from straight above, a cue that is really tilted leans away across the picture (the butt is much nearer the eye),
    // so there it is drawn lying flat and shortened, the way it would look with no perspective; in the 3D views it is truly raised.
    // The cue is drawn at its angle with a small lean for looks (the ordinary stroke is a level 0), and moved sideways and
    // up or down, staying parallel, to the point on the ball that the spin setting says it strikes.
    const off = spinV.x * 0.5 * R, lift = spinV.y * 0.5 * R * ce, px = tx + dy * off, py = ty - dx * off;
    // From above, a raised cue is raised too, in true perspective (the butt nearer the eye, so wider), only shortened so its
    // butt stays within a third of a metre of the cloth; its shadow lies on the cloth below and falls away from it.
    const kl = orbit.on || e < 0.03 ? 1 : Math.min(1, 0.32 / (1.47 * se));
    // (현실 당구 · 큐 각도 - v.honest: the cue at its true angle, no lean for looks, so that what it cannot clear is seen - owner 11-10)
    const lean = v.honest ? 0 : 0.085;
    if (orbit.on || e >= 0.03) { cue.scale.set(kl, 1, 1); cue.position.set(px, py, R + lift + 0.002 + se * (R + pullV)); cue.rotation.set(0, -Math.min(Math.PI / 2, (e < 0.03 ? lean : 0) + e), v.aim + Math.PI); }
    else { cue.scale.set(1, 1, 1); cue.position.set(px, py, R + lift + 0.002); cue.rotation.set(0, -(v.honest ? e : lean), v.aim + Math.PI); }
    const half = 0.735 * kl * ce, sx = px - dx * half + 0.012 + 0.025 * se, sy = py - dy * half - 0.014 - 0.025 * se;
    /* chalking (v.chalk: its time, 0 .. 1.3 s), as it is done (owner 11-09: not from above): the cube held end-on to the
       cue, its hollow face to the tip, slid back along the cue's line onto the tip, twisted to and fro about that line
       with the blue dust falling off it, and taken off to the side and away */
    const ct = v.chalk == null ? -1 : v.chalk, tz = R + lift + 0.002;
    chalkCube.visible = ct >= 0 && ct < 1.3 && !fo;
    if (chalkCube.visible) {
      const inn = Math.min(1, ct / 0.24), out = Math.max(0, (ct - 1.0) / 0.3), e1 = 1 - Math.pow(1 - inn, 3), tw = ct > 0.24 && ct < 1.0 ? Math.sin((ct - 0.24) * 24) : 0;
      const along = 0.0085 + (1 - e1) * 0.06 + out * 0.012, side = out * out * 0.05;   // (its middle from the tip along the cue's line; off to the side as it is taken away)
      chalkCube.position.set(px + dx * along + dy * side, py + dy * along - dx * side, tz + out * out * 0.05);
      chalkQ.base.setFromUnitVectors(chalkQ.z, chalkQ.ax.set(-dx, -dy, 0)); chalkQ.tw.setFromAxisAngle(chalkQ.ax, tw * 0.75 + ct * 1.4);
      chalkCube.quaternion.copy(chalkQ.tw).multiply(chalkQ.base);
      chalkCube.material.opacity = chalkCube.children[0].material.opacity = Math.min(e1 * 1.5, 1 - out, 1);
    }
    for (const d of chalkDust) {
      const age = ct - d.t0, on = chalkCube.visible && age >= 0 && age < d.life; d.m.visible = on; if (!on) continue;
      const k = age / d.life, ca = Math.cos(d.a), sa = Math.sin(d.a);
      d.m.position.set(px + dx * 0.004 + ca * d.v * age, py + dy * 0.004 + sa * d.v * age, Math.max(0.0006, tz + d.up * age - 0.5 * 0.9 * age * age));
      d.m.scale.setScalar(d.s * (1 - 0.4 * k)); d.m.material.opacity = 0.85 * (1 - k * k);
    }
    cueShadow.position.set(sx, sy, 0.0012); cueShadow.rotation.z = v.aim; cueShadow.scale.set(1.47 * kl * Math.max(0.12, ce), 0.022 * (1 + 0.5 * se), 1); cueShadow.material.opacity = 0.22 * (1 - 0.55 * se);   // (a raised cue's shadow is fainter)
  }

  // the aiming guide: played out on a copy of the table, and drawn again only when something it depends on changes (guideKey)
  function drawGuide(v, g, P, w, R, c) {
    const gl = v.level, chosen = v.power > 0;
    const key = [v.aim.toFixed(6), c.x.toFixed(4), c.y.toFixed(4), gl.toFixed(3), v.power.toFixed(4), v.spin.x.toFixed(3), v.spin.y.toFixed(3), ppm.toFixed(1), g.turn, v.rev, (v.el || 0).toFixed(4), v.aimStyle, v.gear ? v.gear.power + ',' + v.gear.spin : ''].join('|');
    if (key !== guideKey) {
      guideKey = key;
      gRing.visible = gDisc.visible = false; for (const m of RIBS) m.visible = false;
      if (gl > 0.001) {
        /* Nothing here is worked out by geometry: the shot is played out on a copy with the very inputs the stroke will use,
           and the guide is drawn from what happened. The length setting only decides how much of it is shown. */
        const after = gl < SIM ? 0.05 : gl <= 0.75 ? 2.4 : 2.4 + (gl - 0.75) / 0.25 * 12.6;
        const k = v.gear || { power: 1, spin: 1 };
        // Until the cue is drawn back there is no power yet, and the guide plays a middling one (0.45).
        const speed = g.vOf(chosen ? v.power : 0.45) * k.power, sx = v.spin.x * 0.5 * k.spin, sy = v.spin.y * 0.5 * k.spin;
        const pk = guidePreview(v, c, P, w, g.turn, after, k, chosen, speed, sx, sy), pv = pvNow;
        const at = pv.at, pre = pv.pre, kind = g.mode.table;
        // each path in its ball's colour; the cue ball's turns red when the first ball it would reach is not one it may hit
        const legal = pv.hit == null || v.legalIds.indexOf(pv.hit) >= 0, cCol = legal ? pathCol(kind, w.cue) : 0xff5a4a, oCol = pv.hit != null ? pathCol(kind, pv.hit) : cCol;
        // Whatever depends on the power is drawn faint till the cue is drawn back, so the stand-in is not taken for the shot.
        const dim = chosen ? 1 : 0.5, ex = at ? at[0] : pre[pre.length - 3], ey = at ? at[1] : pre[pre.length - 2];
        let bent = false;
        if (v.el > 0) { const qx = ex - pre[0], qy = ey - pre[1], ql = Math.hypot(qx, qy) || 1; for (let i = 3; i < pre.length && !bent; i += 3) if (pre[i + 2] > 0.003 || Math.abs((pre[i] - pre[0]) * qy - (pre[i + 1] - pre[1]) * qx) / ql > 0.0015) bent = true; }
        // the cue ball's way in: from the cue ball to the middle of the ghost ball, so the two paths meet there
        const path = pre.slice(); if (at) path.push(at[0], at[1], at[2]);
        ribbon(rPre, trimPath(path, R, 0), guideLook({ color: cCol, op: 0.92 * (bent ? dim : 1), alpha: t => 1 - 0.3 * t }), R);
        if (at) {
          gRing.visible = gDisc.visible = true; gRing.position.set(at[0], at[1], R + at[2]); gRing.scale.setScalar(R); gRing.material.color.set(cCol);
          gDisc.position.set(at[0], at[1], R + at[2]); gDisc.scale.setScalar(R); gDisc.material.color.set(cCol);
        }
        if (at && gl >= 0.25) guideAfter(v, P, w, R, pv, { gl, after, pk, chosen, speed, sx, sy, ex, ey, cCol, oCol, dim });
      }
    }
    gHand.visible = !!v.hand; gHand.position.set(c.x, c.y, R); gHand.scale.setScalar(R);
  }

  const guideLook = o => Object.assign(o, { px: 2.6 });   // the guide's ribbons: a fixed width on screen

  /* the shot played out on a copy (P.preview), kept apart from how it is drawn: a camera that turns, zooms or slides
     draws the same path again without playing the shot out again. Leaves it in pvNow; returns its key. */
  function guidePreview(v, c, P, w, turn, after, k, chosen, speed, sx, sy) {
    const pk = [v.aim.toFixed(6), c.x.toFixed(4), c.y.toFixed(4), after, chosen ? v.power.toFixed(4) : '-', v.spin.x.toFixed(3), v.spin.y.toFixed(3), turn, v.rev, (v.el || 0).toFixed(4), k.power + ',' + k.spin].join('|');
    if (pk !== pvKey || w !== pvW || P !== pvP) {
      const pt0 = performance.now(); pvNow = P.preview(w, v.aim, speed, sx, sy, v.el || 0, after); sProf.guide += performance.now() - pt0;
      pvKey = pk; pvW = w; pvP = P;
    }
    return pk;
  }

  // past the ghost ball: the cue ball's own width on the rail, then the two balls' ways after the hit (short or played out)
  function guideAfter(v, P, w, R, pv, o) {
    const at = pv.at, pre = pv.pre;
    // the cue ball's heading as it arrives
    let ux = o.ex - pre[Math.max(0, pre.length - 9)], uy = o.ey - pre[Math.max(0, pre.length - 9) + 1]; const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
    let tl = 0, nx = 0, ny = 0;
    if (pv.hit != null) { const b0 = w.balls[pv.hit]; nx = b0.x - at[0]; ny = b0.y - at[1]; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl; tl = Math.sqrt(Math.max(0, 1 - Math.pow(ux * nx + uy * ny, 2))); }
    if (pv.hit != null) guideRail(v, P, w, R, pv, o);
    if (o.gl < SIM) guideShort(P, w, R, pv, o, ux, uy, nx, ny, tl);
    else guideLong(R, pv, o, tl);
  }

  /* Past the ghost ball, under the line, the rail: the cue ball's own width on the way it really takes after the
     first contact - the same stroke, spin and all, off the cushions as it comes off them - with every ball
     after that one left out, the one it hits too, so the way shows how the spin takes it and nothing it would
     run into (owner, 11-09: "쿠션은 튕겨지는 거까지 그리고, 그 이후에 공만 무시"). As long as the cue ball's
     line after a hit can be at this guide length - the cue's stat. */
  function guideRail(v, P, w, R, pv, o) {
    const rk = o.pk + '|' + pv.hit;
    if (rk !== railKey || w !== railW || P !== railP) {
      const pt0 = performance.now();
      railPv = railWay(P, w, pv.hit, v.aim, o.speed, o.sx, o.sy, v.el || 0, Math.max(o.after, 2.5));
      sProf.guide += performance.now() - pt0;
      railKey = rk; railW = w; railP = P;
    }
    const way = railPv || [], gl = o.gl;
    // the same reach as the cue ball's line after a hit at its longest (a thin one): grow() below "길게", the real
    // way's first stretch (2.4 s) to all of it above
    const L = way.length < 6 ? 0 : gl < SIM ? grow(gl) * 0.16 : reach(gl, 0.16, pathLen(way.slice(0, 288 * 3 + 3)), pathLen(way));
    if (L > R * 0.5) ribbon(rRail, cutPath(way, L), { m: 2 * R, mode: 3, ch: 0, color: o.cCol, op: 0.32 * o.dim, alpha: t => 1 - 0.7 * t }, R);
  }

  // up to "보통": only what one would expect, short straight lines
  function guideShort(P, w, R, pv, o, ux, uy, nx, ny, tl) {
    const at = pv.at, post = pv.post, k = grow(o.gl);
    if (pv.hit != null) {
      // the object ball: along the line of centres, longer the fuller the hit
      const b0 = w.balls[pv.hit], co = Math.max(0, ux * nx + uy * ny);
      if (pv.obj) ribbon(rObj, trimPath(line(b0.x, b0.y, 0, nx, ny, R + k * (0.04 + 0.12 * co)), R, 0), guideLook({ color: o.oCol, op: 0.92, alpha: t => 1 - t }), R);
      // the cue ball: along the tangent, longer the thinner the hit (a full hit leaves it where it is)
      let sx = ux - (ux * nx + uy * ny) * nx, sy = uy - (ux * nx + uy * ny) * ny; const sl = Math.hypot(sx, sy);
      if (sl > 0.05) { sx /= sl; sy /= sl; ribbon(rPost, line(at[0], at[1], 0, sx, sy, k * 0.16 * tl), guideLook({ color: o.cCol, op: 0.85, alpha: t => 1 - t }), R); }
    } else {
      // a cushion first: straight back off it, angle in = angle out
      const fx = Math.abs(Math.abs(at[0]) - (P.HL - R)) < 0.012, fy = Math.abs(Math.abs(at[1]) - (P.HW - R)) < 0.012;
      let rx = ux, ry = uy;
      if (fx) rx = -ux; if (fy) ry = -uy;
      if (!fx && !fy) { const q = post.length >= 6 ? Math.hypot(post[3] - post[0], post[4] - post[1]) : 0; if (q > 1e-6) { rx = (post[3] - post[0]) / q; ry = (post[4] - post[1]) / q; } }
      ribbon(rPost, line(at[0], at[1], 0, rx, ry, k * 0.14), guideLook({ color: o.cCol, op: 0.85, alpha: t => 1 - t }), R);
    }
  }

  // above "보통": the ways the shot really takes, as far as the length setting reaches
  function guideLong(R, pv, o, tl) {
    const post = pv.post, gl = o.gl;
    if (pv.obj) {
      const ob = pv.obj, run = Math.hypot(ob.x1 - ob.x0, ob.y1 - ob.y0), co = Math.sqrt(1 - tl * tl);
      const op = pv.objPath, len = reach(gl, Math.min(0.04 + 0.12 * co, run), run, pathLen(op));
      ribbon(rObj, trimPath(cutPath(op, len + R), R, 0), guideLook({ color: o.oCol, op: 0.92 * o.dim, alpha: t => 1 - t }), R);
    }
    // the cue ball afterwards, from the middle of the ghost ball
    const stub = pv.hit != null ? 0.16 * tl : Math.min(0.14, pathLen(post.slice(0, pv.turn + 3)));
    const len = reach(gl, stub, pathLen(post.slice(0, 288 * 3 + 6)), pathLen(post));
    ribbon(rPost, cutPath(post, len), guideLook({ color: o.cCol, op: 0.85 * o.dim, alpha: t => 1 - t }), R);
  }

  /* the picture: the static layer (baked once into rt; drawn whole every frame while the view turns), then what moves
     on top of it */
  function drawLayers() {
    if (orbit.on && orbit.live > 0) {
      orbit.live--; staticDirty = true;
      renderer.setClearColor(clearCol, 1); unmask(); renderer.clear();
      const bg = sScene.background; sScene.background = null; camera.layers.enable(1);
      renderer.render(sScene, camera); camera.layers.disable(1); sScene.background = bg;
      renderer.render(scene, camera);
      return;
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
    // Tilted with nothing falling, only what can stand in front of a ball on the cloth (layer OCCL); a ball falling into a pocket
    // needs the whole table (it goes under the cloth).
    if (falls.length || orbit.on) {
      const bgc = sScene.background; sScene.background = null; sScene.overrideMaterial = depthMat;   // (a colour background would wipe the picture)
      if (!falls.length) camera.layers.set(OCCL);
      renderer.render(sScene, camera); sScene.overrideMaterial = null; sScene.background = bgc; camera.layers.set(0);
    }
    renderer.render(scene, camera);
  }

  return {
    set onFreeLook(f) { onFree = f; }, get eyeView() { return !!(orbit.cam && orbit.cam.eye); },
    setTable(P) { setTable(P); warmDue = true; }, setWalls, setLight, get light() { return Object.assign({}, light); }, LIGHT0, setCloth(i) { setCloth(i); warmDue = true; }, setCue(i) { setCue(i); warmDue = true; }, setBalls(id) { setBalls(id); warmDue = true; }, setTrail(id) { setTrail(id); warmDue = true; }, ballPortrait, cuePortrait, ballShot, cueShot, get portraitSpan() { return portraitSpan; }, setBackdrop, setZone, setMarks, fly, setOrbit, setCam, setScale, get scale() { return dynScale; }, info: renderer.info, proj, orbitBy, zoomBy, get orbiting() { return orbit.on; }, setInsets, tableRect, tableOutline, setDeskLight, setQuality, resize, toTable, frame, fall,
    fxSounds, hit, invalidate() { dirty = 3; }, clearFalls() { falls.length = 0; fallEvents.length = 0; dirty = 3; }, fallEvents, get ppm() { return ppm; }, get portrait() { return portrait; }, get falling() { return falls.length > 0; },
    get pixelRatio() { return renderer.getPixelRatio(); }, get softwareRendering() { return softwareGL; }, get rendererName() { return rendererName; }, prof: sProf,
  };
