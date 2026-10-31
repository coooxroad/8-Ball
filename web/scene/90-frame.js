  /* one frame. v: { game, alpha, aim, power, pull, showCue, showGuide, level, spin, legalIds } */
  function frame(v, dt) {
    let moved = false;
    for (const k of ['t', 'l', 'r', 'b']) { const d = insTo[k] - ins[k]; if (Math.abs(d) > 0.5) { ins[k] += d * Math.min(1, dt * 9); moved = true; } else ins[k] = insTo[k]; }
    if (moved) applyCamera(true); else if (stale) { stale = false; staticDirty = true; dirty = 3; }
    if (orbit.on && Math.abs(orbit.elTo - orbit.el) > 0.002) { orbit.el += (orbit.elTo - orbit.el) * Math.min(1, dt * 7); orbit.live = 4; applyCamera(); }   // easing down from overhead
    if (orbit.live > 0) dirty = 3;
    if (falls.length || v.animating) dirty = 3;
    if (dirty <= 0) return false; dirty--;
    const g = v.game, P = g.P, w = g.world, R = P.R, set = sets[g.mode.table], a = v.alpha;
    // carom: ball 1 is drawn yellow unless the game says player 0 has the yellow (4구 draws the colours by lot)
    if (set === sets.carom) { const y = g.yellow == null ? 1 : g.yellow; if (y !== caromY) { const m0 = set.mesh[0].material, m1 = set.mesh[1].material, t = m0.map; m0.map = m1.map; m1.map = t; m0.needsUpdate = m1.needsUpdate = true; caromY = y; } }
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
    if (trailTick(c, R, dt)) dirty = Math.max(dirty, 2);
    cue.visible = cueShadow.visible = v.showCue && c.on; guide.visible = v.showGuide && c.on;
    // the follow-through after a hit: the cue is drawn from where the ball was struck, carrying on past it (v.follow)
    const fo = v.follow; if (fo) { cue.visible = cueShadow.visible = !!v.showCue; guide.visible = false; }
    if (cue.visible) {
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
      if (orbit.on || e >= 0.03) { cue.scale.set(kl, 1, 1); cue.position.set(px, py, R + lift + 0.002 + se * (R + pullV)); cue.rotation.set(0, -Math.min(Math.PI / 2, (e < 0.03 ? 0.085 : 0) + e), v.aim + Math.PI); }
      else { cue.scale.set(1, 1, 1); cue.position.set(px, py, R + lift + 0.002); cue.rotation.set(0, -0.085, v.aim + Math.PI); }
      const half = 0.735 * kl * ce, sx = px - dx * half + 0.012 + 0.025 * se, sy = py - dy * half - 0.014 - 0.025 * se;
      cueShadow.position.set(sx, sy, 0.0012); cueShadow.rotation.z = v.aim; cueShadow.scale.set(1.47 * kl * Math.max(0.12, ce), 0.022 * (1 + 0.5 * se), 1); cueShadow.material.opacity = 0.22 * (1 - 0.55 * se);   // (a raised cue's shadow is fainter)
    }
    if (guide.visible) {
      const gl = v.level, chosen = v.power > 0;
      const key = [v.aim.toFixed(6), c.x.toFixed(4), c.y.toFixed(4), gl.toFixed(3), v.power.toFixed(4), v.spin.x.toFixed(3), v.spin.y.toFixed(3), ppm.toFixed(1), g.turn, v.rev, (v.el || 0).toFixed(4), v.aimStyle].join('|');
      if (key !== guideKey) {
        guideKey = key;
        gRing.visible = gDisc.visible = false; for (const m of RIBS) m.visible = false;
        if (gl > 0.001) {
          /* Nothing here is worked out by geometry: the shot is played out on a copy with the very inputs the stroke will use,
             and the guide is drawn from what happened. The length setting only decides how much of it is shown. */
          const after = gl < SIM ? 0.05 : gl <= 0.75 ? 2.4 : 2.4 + (gl - 0.75) / 0.25 * 12.6;
          const pv = P.preview(w, v.aim, g.vOf(chosen ? v.power : 0.45), v.spin.x * 0.5, v.spin.y * 0.5, v.el || 0, after);
          const at = pv.at, pre = pv.pre, post = pv.post, rail = v.aimStyle === 'rail', kind = g.mode.table;
          // each path in its ball's colour; the cue ball's turns red when the first ball it would reach is not one it may hit
          const legal = pv.hit == null || v.legalIds.indexOf(pv.hit) >= 0, cCol = legal ? pathCol(kind, w.cue) : 0xff5a4a, oCol = pv.hit != null ? pathCol(kind, pv.hit) : cCol;
          // Until the cue is drawn back there is no power yet, and the guide plays a middling one. Whatever depends on the
          // power is drawn faint till then, so a stand-in is not taken for the shot.
          const dim = chosen ? 1 : 0.5, ex = at ? at[0] : pre[pre.length - 3], ey = at ? at[1] : pre[pre.length - 2];
          let bent = false;
          if (v.el > 0) { const qx = ex - pre[0], qy = ey - pre[1], ql = Math.hypot(qx, qy) || 1; for (let i = 3; i < pre.length && !bent; i += 3) if (pre[i + 2] > 0.003 || Math.abs((pre[i] - pre[0]) * qy - (pre[i + 1] - pre[1]) * qx) / ql > 0.0015) bent = true; }
          const band = rail ? { m: 2 * R, mode: 3, ch: 0.35 } : null, look = o => Object.assign(o, band || { px: 2.6 });
          // the cue ball's way in: from the cue ball to the middle of the ghost ball, so the two paths meet there
          const path = pre.slice(); if (at) path.push(at[0], at[1], at[2]);
          ribbon(rPre, trimPath(path, rail ? 0 : R, 0), look({ color: cCol, op: 0.92 * (bent ? dim : 1), alpha: t => 1 - 0.3 * t }), R);
          if (at) {
            gRing.visible = gDisc.visible = true; gRing.position.set(at[0], at[1], R + at[2]); gRing.scale.setScalar(R); gRing.material.color.set(cCol);
            gDisc.position.set(at[0], at[1], R + at[2]); gDisc.scale.setScalar(R); gDisc.material.color.set(cCol);
          }
          if (at && gl >= 0.25) {
            // the cue ball's heading as it arrives
            let ux = ex - pre[Math.max(0, pre.length - 9)], uy = ey - pre[Math.max(0, pre.length - 9) + 1]; const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
            let tl = 0, nx = 0, ny = 0;
            if (pv.hit != null) { const b0 = w.balls[pv.hit]; nx = b0.x - at[0]; ny = b0.y - at[1]; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl; tl = Math.sqrt(Math.max(0, 1 - Math.pow(ux * nx + uy * ny, 2))); }
            if (gl < SIM) {
              const k = grow(gl);
              if (pv.hit != null) {
                // the object ball: along the line of centres, longer the fuller the hit
                const b0 = w.balls[pv.hit], co = Math.max(0, ux * nx + uy * ny);
                if (pv.obj) ribbon(rObj, trimPath(line(b0.x, b0.y, 0, nx, ny, R + k * (0.04 + 0.12 * co)), rail ? 0 : R, 0), look({ color: oCol, op: 0.92, alpha: t => 1 - t }), R);
                // the cue ball: along the tangent, longer the thinner the hit (a full hit leaves it where it is)
                let sx = ux - (ux * nx + uy * ny) * nx, sy = uy - (ux * nx + uy * ny) * ny; const sl = Math.hypot(sx, sy);
                if (sl > 0.05) { sx /= sl; sy /= sl; ribbon(rPost, line(at[0], at[1], 0, sx, sy, k * 0.16 * tl), look({ color: cCol, op: 0.85, alpha: t => 1 - t }), R); }
              } else {
                // a cushion first: straight back off it, angle in = angle out
                const fx = Math.abs(Math.abs(at[0]) - (P.HL - R)) < 0.012, fy = Math.abs(Math.abs(at[1]) - (P.HW - R)) < 0.012;
                let rx = ux, ry = uy;
                if (fx) rx = -ux; if (fy) ry = -uy;
                if (!fx && !fy) { const q = post.length >= 6 ? Math.hypot(post[3] - post[0], post[4] - post[1]) : 0; if (q > 1e-6) { rx = (post[3] - post[0]) / q; ry = (post[4] - post[1]) / q; } }
                ribbon(rPost, line(at[0], at[1], 0, rx, ry, k * 0.14), look({ color: cCol, op: 0.85, alpha: t => 1 - t }), R);
              }
            } else {
              if (pv.obj) {
                const o = pv.obj, run = Math.hypot(o.x1 - o.x0, o.y1 - o.y0), co = Math.sqrt(1 - tl * tl);
                const op = pv.objPath, len = reach(gl, Math.min(0.04 + 0.12 * co, run), run, pathLen(op));
                ribbon(rObj, trimPath(cutPath(op, len + R), rail ? 0 : R, 0), look({ color: oCol, op: 0.92 * dim, alpha: t => 1 - t }), R);
              }
              // the cue ball afterwards, from the middle of the ghost ball
              const stub = pv.hit != null ? 0.16 * tl : Math.min(0.14, pathLen(post.slice(0, pv.turn + 3)));
              const len = reach(gl, stub, pathLen(post.slice(0, 288 * 3 + 6)), pathLen(post));
              ribbon(rPost, cutPath(post, len), look({ color: cCol, op: 0.85 * dim, alpha: t => 1 - t }), R);
            }
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
    set onFreeLook(f) { onFree = f; }, get eyeView() { return !!(orbit.cam && orbit.cam.eye); },
    setTable, setCloth, setCue, setBalls, setTrail, ballPortrait, setBackdrop, setZone, setMarks, fly, setOrbit, setCam, proj, orbitBy, zoomBy, get orbiting() { return orbit.on; }, setInsets, tableRect, tableOutline, setDeskLight, setQuality, resize, toTable, frame, fall,
    invalidate() { dirty = 3; }, clearFalls() { falls.length = 0; fallEvents.length = 0; dirty = 3; }, fallEvents, get ppm() { return ppm; }, get portrait() { return portrait; }, get falling() { return falls.length > 0; },
    get pixelRatio() { return renderer.getPixelRatio(); },
  };
