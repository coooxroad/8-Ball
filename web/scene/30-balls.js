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
  let skin = BALLSKINS[0];
  function ballTexture(kind, n) {
    const hex = h => '#' + h.toString(16).padStart(6, '0'), sk = skin, colOf = k => sk.pal ? hex(sk.pal[(k - 1) % 8]) : ballCss(k);
    const W = 1024, H = 512, c = mkCanvas(W, H), g = c.getContext('2d'), ivory = hex(sk.cue);
    if (sk.paint) { paintBall(g, W, H, sk, kind, n, hex, colOf); return tex(c); }   // (painted in code: scene/35-paint.js)
    if (sk.skin != null) { skinTexture(g, W, H, sk, kind, n, hex, colOf); holesOn(g, W, H, sk); seamsOn(g, W, H, sk); return tex(c); }
    const dots = (bgc, dc, rad) => {
      g.fillStyle = bgc; g.fillRect(0, 0, W, H); g.fillStyle = dc;
      for (const u of [0, 0.25, 0.5, 0.75, 1]) { g.beginPath(); g.arc(u * W, H / 2, rad, 0, 7); g.fill(); }
      g.fillRect(0, 0, W, rad); g.fillRect(0, H - rad, W, rad);
    };
    const plain = bgc => { g.fillStyle = bgc; g.fillRect(0, 0, W, H); };
    if (kind === 'carom') {
      if (n === 0) sk.dots ? dots(ivory, '#c8201b', 0.11 / Math.PI * H) : plain(ivory);
      else if (n === 1) sk.dots ? dots(hex(sk.yel), '#b3261e', 0.11 / Math.PI * H) : plain(hex(sk.yel));
      else sk.dots ? dots(hex(sk.red), '#00000033', 0.2 / Math.PI * H) : plain(hex(sk.red));
    } else if (n === 0) sk.dots ? dots(ivory, '#c8201b', 0.13 / Math.PI * H) : plain(ivory);
    else {
      const stripe = n > 8, base = sk.noir ? '#141416' : ivory;
      g.fillStyle = stripe ? base : sk.noir ? '#141416' : colOf(n); g.fillRect(0, 0, W, H);
      if (stripe) { g.fillStyle = colOf(n); g.fillRect(0, H * 0.25, W, H * 0.5); }
      if (sk.noir && !stripe) { g.fillStyle = colOf(n); g.fillRect(0, H * 0.44, W, H * 0.12); }   // (a thin coloured belt round a solid)
      const rad = 0.5 / Math.PI * H;
      for (const u of sk.numbers === false ? [] : [0.25, 0.75]) {
        g.fillStyle = sk.noir ? '#141416' : ivory; g.beginPath(); g.arc(u * W, H / 2, rad, 0, 7); g.fill();
        if (sk.noir) { g.strokeStyle = colOf(n); g.lineWidth = 6; g.stroke(); }
        g.fillStyle = sk.noir ? colOf(n) : '#111'; g.font = `bold ${n > 9 ? 84 : 104}px "Helvetica Neue",Arial,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(String(n), u * W, H / 2 + 6);
        if (n === 6 || n === 9) g.fillRect(u * W - 22, H / 2 + 46, 44, 7);
      }
    }
    // a set with a surface (marble, pearl...): its grey picture brightens and darkens the colours (overlay), once loaded
    const im = sk.mat && matOf(sk.mat); if (im) { g.globalCompositeOperation = 'overlay'; g.drawImage(im, 0, 0, W, H); g.globalCompositeOperation = 'source-over'; }
    holesOn(g, W, H, sk);
    return tex(c);
  }
  /* A set with its own surface (content/30-balls.js: skin - a colour picture tex/ball-<name>.webp, or a colour): every ball
     is that surface, and what ball it is shows by its mark -
       'tint':  the surface takes the ball's colour (all over on a solid and the carom balls, a band round a stripe), the
                number on an ivory disc as usual; the cue ball (and the carom white) keep the surface as it is;
       'label': the surface stays as it is, and the ball wears its colour as discs: a pool ball a disc of its colour with
                the number on ivory (a stripe a ring of it), a carom ball two discs of its colour (the white none). */
  // a mirror ball's seams: a thin dark line round every facet (finish.facets: [round, up], as the sphere is cut)
  function seamsOn(g, W, H, sk) {
    const f = sk.finish && sk.finish.facets; if (!f) return;
    g.fillStyle = 'rgba(20,22,28,.75)';
    for (let i = 0; i <= f[0]; i++) g.fillRect(i * W / f[0] - 2, 0, 4, H);
    for (let j = 0; j <= f[1]; j++) g.fillRect(0, j * H / f[1] - 2, W, 4);
  }
  function skinTexture(g, W, H, sk, kind, n, hex, colOf) {
    // caromSkins: the three carom balls each a surface of their own ({ pic, color }: a picture, the colour until it has come)
    // - a peeled potato, a golden one, a red one - so they tell themselves apart with nothing laid on them
    const own = kind === 'carom' && sk.caromSkins ? sk.caromSkins[Math.min(2, n)] : null;
    const surf = own ? own.pic : sk.skin, im = typeof surf === 'string' ? matOf(surf) : null;
    if (im) g.drawImage(im, 0, 0, W, H);
    else { g.fillStyle = own ? hex(own.color) : typeof sk.skin === 'number' ? hex(sk.skin) : '#9a7048'; g.fillRect(0, 0, W, H); }
    if (own) return;
    const col = kind === 'carom' ? (n === 0 ? null : n === 1 ? hex(sk.yel) : hex(sk.red)) : n === 0 ? null : colOf(n), stripe = kind === 'pool' && n > 8;
    const disc = (u, r, fill, ring) => { g.fillStyle = fill; g.beginPath(); g.arc(u * W, H / 2, r, 0, 7); g.fill(); if (ring) { g.lineWidth = r * 0.34; g.strokeStyle = ring; g.stroke(); } };
    // the number on its sticker (sticker: how big, 1 the usual)
    const number = u => { const k = sk.sticker || 1, r = 0.42 / Math.PI * H * k; disc(u, r, '#f7f3ea'); g.lineWidth = 3 * k; g.strokeStyle = 'rgba(0,0,0,.18)'; g.stroke();
      g.fillStyle = '#111'; g.font = `bold ${Math.round((n > 9 ? 74 : 92) * k)}px "Helvetica Neue",Arial,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), u * W, H / 2 + 5 * k);
      if (n === 6 || n === 9) g.fillRect(u * W - 19 * k, H / 2 + 40 * k, 38 * k, 6 * k); };
    const tint = (y0, h) => {
      // the surface's light and dark kept, its colour the ball's (then a little of the colour laid over, so a dark ball is dark)
      g.globalCompositeOperation = 'color'; g.fillStyle = col; g.fillRect(0, y0, W, h);
      g.globalCompositeOperation = 'multiply'; g.globalAlpha = 0.55; g.fillRect(0, y0, W, h); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    };
    if ((sk.mark || 'tint') === 'tint') {
      if (col) {
        // stripes: 'bands' - the surface as it is, two rubber bands of the colour round it; else a broad band dyed
        if (stripe && sk.stripes === 'bands') for (const y of [0.37, 0.63]) {
          const y0 = H * y - H * 0.04, gr = g.createLinearGradient(0, y0, 0, y0 + H * 0.08);
          g.fillStyle = col; g.fillRect(0, y0, W, H * 0.08);
          gr.addColorStop(0, 'rgba(0,0,0,.35)'); gr.addColorStop(0.35, 'rgba(255,255,255,.25)'); gr.addColorStop(1, 'rgba(0,0,0,.4)'); g.fillStyle = gr; g.fillRect(0, y0, W, H * 0.08);
        }
        else tint(stripe ? H * 0.25 : 0, stripe ? H * 0.5 : H);
      }
      if (kind === 'pool' && n > 0 && sk.numbers !== false) for (const u of [0.25, 0.75]) number(u);
    } else if (col) {
      if (kind === 'carom') for (const u of [0.25, 0.75]) disc(u, 0.3 / Math.PI * H, col);
      else for (const u of [0.25, 0.75]) { disc(u, 0.62 / Math.PI * H, stripe ? '#f4efe2' : col, stripe ? col : null); if (sk.numbers !== false) number(u); }
    }
  }
  // finger holes (holes): dark inside, deepest at the middle, so the hollow the shape has (geomOf) reads as deep
  function holesOn(g, W, H, sk) {
    for (const [lat, lon, r] of sk.holes || []) {
      const th = (90 - lat) * Math.PI / 180, cx = lon / 360 * W, cy = th / Math.PI * H, ry = Math.asin(Math.min(1, r)) / Math.PI * H, rx = ry / Math.max(0.2, Math.sin(th));
      for (const dx of [-W, 0, W]) {
        g.save(); g.translate(cx + dx, cy); g.scale(rx / ry, 1);
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, ry); gr.addColorStop(0, 'rgba(0,0,0,.92)'); gr.addColorStop(0.7, 'rgba(0,0,0,.8)'); gr.addColorStop(0.86, 'rgba(0,0,0,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(0, 0, ry, 0, 7); g.fill(); g.restore();
      }
    }
  }
  /* A set's own shape (shape: a lumpy, squashed thing like a potato; holes: finger holes), built once and shared by every
     ball of it, on the table and on the shelf. The physics always plays a sphere of the table's radius, so a shape only
     ever goes inside that sphere - its farthest point is the radius - and balls never look to sink into each other (at
     worst a lumpy one stands a hair off the cloth or off another ball). Normals come from the shape itself, not the
     triangles, so the sphere's seam does not show. */
  const geoms = {};
  // lod 1: half the rows and columns, for a ball small on the screen (화질 '자동' with the table seen whole, or '낮음': ballLod)
  function geomOf(k, lod) {
    if (!k.shape && !k.holes) return sphere;
    const key = JSON.stringify([k.shape || null, k.holes || null, lod ? 1 : 0]); if (geoms[key]) return geoms[key];
    const sh = k.shape || {}, rnd = seededRandom((sh.seed || 1) >>> 0), lumps = Math.min(0.15, sh.lumps || 0), sq = sh.squash || [1, 1, 1];
    const unit = () => { const z = rnd() * 2 - 1, a = rnd() * 2 * Math.PI, r = Math.sqrt(1 - z * z); return [r * Math.cos(a), z, r * Math.sin(a)]; };
    const bumps = [];
    for (let i = 0; i < (sh.n || 12); i++) bumps.push([unit(), (rnd() * 2 - 1) * lumps, 0.3 + rnd() * 0.45]);
    for (let i = 0; i < (sh.eyes || 0); i++) bumps.push([unit(), -lumps * 0.5, 0.07 + rnd() * 0.04]);                // (a potato's eyes: small dents)
    const holes = (k.holes || []).map(([lat, lon, r, depth]) => { const th = (90 - lat) * Math.PI / 180, ph = lon * Math.PI / 180;
      return [[-Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th)], Math.asin(Math.min(1, r)), depth || 0.3]; });
    // (sphere directions as SphereGeometry lays them, so a hole lands where the picture's dark spot is: lat/lon of its uv)
    const f = (x, y, z) => {
      let r = 1 / Math.sqrt((x / sq[0]) ** 2 + (y / sq[1]) ** 2 + (z / sq[2]) ** 2), b = 0;
      for (const [c, a, wd] of bumps) b += a * Math.exp(-(1 - (x * c[0] + y * c[1] + z * c[2])) / (wd * wd));
      r *= 1 + b;
      for (const [c, rho, depth] of holes) {
        const th = Math.acos(Math.max(-1, Math.min(1, x * c[0] + y * c[1] + z * c[2]))); if (th >= rho) continue;
        // in the shape only a shallow dish (a wall straight down would want far more triangles than a phone should draw): the
        // depth itself is in the light - the hole's bump picture (holeBump) and its dark inside (holesOn), per pixel
        const t = th / rho; r -= depth * 0.3 * (0.5 + 0.5 * Math.cos(Math.PI * t));
      }
      return r;
    };
    const dv = lod ? 2 : 1, g = new THREE.SphereGeometry(1, (holes.length ? 128 : 64) / dv, (holes.length ? 96 : 48) / dv), P = g.attributes.position, N = g.attributes.normal, n = P.count;
    let top = 0; const rs = new Float32Array(n);
    for (let i = 0; i < n; i++) { rs[i] = f(P.getX(i), P.getY(i), P.getZ(i)); top = Math.max(top, rs[i]); }
    const at = (x, y, z) => { const l = Math.hypot(x, y, z), r = f(x / l, y / l, z / l) / top; return [x / l * r, y / l * r, z / l * r]; };
    for (let i = 0; i < n; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i), p = at(x, y, z);
      // the normal: across two small steps along the surface either side of this point
      const t1 = Math.abs(y) < 0.9 ? [-z, 0, x] : [0, z, -y], l1 = Math.hypot(...t1) || 1, u = t1.map(v => v / l1), v2 = [y * u[2] - z * u[1], z * u[0] - x * u[2], x * u[1] - y * u[0]], e = 0.004;
      const a = at(x + u[0] * e, y + u[1] * e, z + u[2] * e), b2 = at(x + v2[0] * e, y + v2[1] * e, z + v2[2] * e), a0 = at(x - u[0] * e, y - u[1] * e, z - u[2] * e), b0 = at(x - v2[0] * e, y - v2[1] * e, z - v2[2] * e);
      const d1 = [a[0] - a0[0], a[1] - a0[1], a[2] - a0[2]], d2 = [b2[0] - b0[0], b2[1] - b0[1], b2[2] - b0[2]];
      let nx = d1[1] * d2[2] - d1[2] * d2[1], ny = d1[2] * d2[0] - d1[0] * d2[2], nz = d1[0] * d2[1] - d1[1] * d2[0]; if (nx * x + ny * y + nz * z < 0) { nx = -nx; ny = -ny; nz = -nz; }
      const nl = Math.hypot(nx, ny, nz) || 1;
      P.setXYZ(i, p[0], p[1], p[2]); N.setXYZ(i, nx / nl, ny / nl, nz / nl);
    }
    g.computeBoundingSphere();
    return (geoms[key] = g);
  }
  // a set's finish (finish: { rough, coat, metal, bump }): how its surface takes the light; left out, the glossy resin balls are
  const bumpTex = {};
  function finishOf(k, mat) {
    const f = k.finish || {};
    if (mat.userData.env0 == null) mat.userData.env0 = mat.envMapIntensity;
    mat.envMapIntensity = mat.userData.env0 * (f.env || 1) * light.ballEnv;        // (env: how strongly it mirrors the room - a gem, more; light: tuned, 10-room.js)
    mat.roughness = f.rough != null ? f.rough : 0.2; mat.metalness = f.metal || 0; mat.clearcoat = f.coat != null ? f.coat : 1; mat.clearcoatRoughness = f.coat != null && f.coat < 0.5 ? 0.4 : light.gloss;
    let b = null;
    if (k.holes) b = holeBump(k);
    else if (f.bump && TEXS['ball-' + f.bump]) { b = bumpTex[f.bump]; if (!b) { b = bumpTex[f.bump] = loader.load(TEXS['ball-' + f.bump], () => { dirty = 3; staticDirty = true; }); } }
    mat.bumpMap = b; mat.bumpScale = b ? (k.holes ? 0.05 : f.bumpScale || 0.015) : 1; mat.needsUpdate = true;
  }
  // a holed set's bump picture: the surface level, each hole a pit with a rounded lip, so its rim catches the light and its far
  // wall is lit while its near wall is in shade, as a real hole's are (the set's own bump picture, if any, is not used with it)
  function holeBump(k) {
    const key = 'holes:' + JSON.stringify(k.holes); if (bumpTex[key]) return bumpTex[key];
    const W = 1024, H = 512, c = mkCanvas(W, H), g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    for (const [lat, lon, r] of k.holes) {
      const th = (90 - lat) * Math.PI / 180, cx = lon / 360 * W, cy = th / Math.PI * H, ry = Math.asin(Math.min(1, r)) / Math.PI * H, rx = ry / Math.max(0.2, Math.sin(th));
      for (const dx of [-W, 0, W]) {
        g.save(); g.translate(cx + dx, cy); g.scale(rx / ry, 1);
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, ry * 1.08); gr.addColorStop(0, '#000'); gr.addColorStop(0.78, '#000'); gr.addColorStop(0.93, '#fff'); gr.addColorStop(1, '#fff');
        g.fillStyle = gr; g.beginPath(); g.arc(0, 0, ry * 1.08, 0, 7); g.fill(); g.restore();
      }
    }
    const t = new THREE.CanvasTexture(c); t.anisotropy = aniso; return (bumpTex[key] = t);
  }
  /* A comic set (finish.toon): lit in three flat steps, dotted like print where it is in shade, a black outline (the inside
     of a slightly bigger ball, drawn behind it). A mirror set (finish.facets: [round, up]): small flat facets. */
  let toonGrad = null;
  // where a material's light goes out (three r128 writes it in place: there is no output_fragment chunk to hook)
  const FRAG_OUT = 'gl_FragColor = vec4( outgoingLight, diffuseColor.a );';
  function toonMat() {
    if (!toonGrad) { toonGrad = new THREE.DataTexture(new Uint8Array([70, 150, 255]), 3, 1, THREE.LuminanceFormat); toonGrad.minFilter = toonGrad.magFilter = THREE.NearestFilter; toonGrad.needsUpdate = true; }
    const m = new THREE.MeshToonMaterial({ gradientMap: toonGrad });
    m.onBeforeCompile = sh => {
      sh.fragmentShader = sh.fragmentShader.replace(FRAG_OUT, `
        { float L = dot(reflectedLight.directDiffuse + reflectedLight.indirectDiffuse, vec3(0.299, 0.587, 0.114)) / max(0.05, dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)));
          vec2 q = fract(gl_FragCoord.xy / 5.0) - 0.5; float rr = clamp(0.62 - L * 0.55, 0.0, 0.46);
          outgoingLight *= mix(1.0, 0.5, step(length(q), rr)); }
        ` + FRAG_OUT);
    };
    return m;
  }
  const outlineMat = new THREE.MeshBasicMaterial({ color: 0x0b0b10, side: THREE.BackSide });
  /* Cut crystal (a ball set's finish.crystal, a cue section's glass): a material that keeps its colour and lighting and adds
     what crystal does - a rim that splits into the rainbow, the middle a shade deeper, light gathered on the side away from
     the lamps, and sparkles: the surface is treated as cut into small facets (in the object's own directions, so they turn
     as it rolls) and the few facing the light just so flash white. Nothing is see-through, so nothing needs sorting. */
  /* Cut crystal on any material (a ball, a cue's glass): seen through it, the inside breaks into facets of light and shadow
     that shift as it turns and as the eye moves (cells of where the refracted look lands), darker towards the rim and bright
     in the middle as a glass sphere is; a rainbow round the edge; white glints with a little fire. o: { rim, sparkle, cut,
     deep, inner (how many facets inside, across), fire (colours in the bright facets), pos (cells along the object, for a long cue), sticker (a ball: where the picture is opaque - the number's sticker -
     it stays paint; the body is painted a shade see-through, scene/35-paint.js) }. */
  function crystallize(m, o) {
    const k = o || {}, f = v => v.toFixed(3);
    m.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vObjN; varying vec3 vObjP;').replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvObjN = objectNormal; vObjP = position;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vObjN; varying vec3 vObjP;').replace(FRAG_OUT, `
        { vec3 Nv = normalize(normal), Vv = normalize(vViewPosition), On = normalize(vObjN); float ndv = clamp(dot(Nv, Vv), 0.0, 1.0), fr = pow(1.0 - ndv, 2.0);
          vec3 rb = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + fr * 2.4 + On.y * 0.7 + On.x * 0.4));
          float gem = ${k.sticker ? '1.0 - step(0.985, diffuseColor.a)' : '1.0'};
          vec3 dif = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
          float lit = clamp(dot(dif, vec3(0.333)) / max(0.04, dot(diffuseColor.rgb, vec3(0.333))), 0.55, 1.5);
          vec3 ip = normalize(On + refract(-Vv, Nv, 0.67) * 0.6);   // (cut as a brilliant: rings, each of wedges set half a wedge round)
          float ring = floor((ip.z * 0.5 + 0.5) * ${f(k.inner || 3)}), wedge = floor(atan(ip.y, ip.x) * ${f((2 * (k.inner || 3) + 2) / (2 * Math.PI))} + ring * 0.5);
          float h2 = fract(sin(ring * 7.13 + wedge * 157.1 + floor((vObjP.x + vObjP.y + vObjP.z) * ${f((k.pos || 0) * (k.inner || 3))}) * 113.7) * 43758.5453);
          vec3 inside = diffuseColor.rgb * lit * (0.22 + 1.25 * h2) * (0.25 + 0.95 * smoothstep(0.2, 0.85, ndv)) + rb * pow(h2, 5.0) * ${f(k.fire || 0.6)} * lit;
          outgoingLight += (inside - dif) * gem;
          outgoingLight = outgoingLight * mix(1.0, ${f(k.deep || 0.62)} + 0.55 * fr, gem) + rb * fr * ${f(k.rim || 0.6)} * gem;
          float back = pow(max(0.0, dot(Nv, normalize(vec3(-0.35, -0.55, 0.6)))), 6.0); outgoingLight += diffuseColor.rgb * back * 0.45 * gem;
          vec3 rr = reflect(-Vv, Nv), q = floor((On * 0.8 + rr * 0.35 + vObjP * ${f(k.pos || 0)}) * ${f(k.cut || 10)});
          float h = fract(sin(dot(q, vec3(12.9898, 78.233, 37.719))) * 43758.5453), a = pow(max(0.0, dot(rr, normalize(vec3(0.25, 0.45, 0.86)))), 5.0);
          outgoingLight += mix(vec3(1.0), rb, 0.35) * step(${f(1 - (k.sparkle || 0.08))}, h) * a * 3.2 * gem;
          diffuseColor.a = 1.0; }
        ` + FRAG_OUT);
    };
    m.customProgramCacheKey = () => 'crystal:' + JSON.stringify(k);
    return m;
  }
  const facetGeoms = {};
  function dressBall(m, k, lod) {
    const f = k.finish || {}, want = f.toon ? 'toon' : f.crystal ? 'crystal' : 'std';
    if ((m.material.userData.kind || 'std') !== want) {
      const old = m.material;
      m.material = want === 'toon' ? toonMat() : new THREE.MeshPhysicalMaterial({ roughness: 0.2, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: m === shotBall ? 0.9 : 0.7 });
      if (want === 'crystal') crystallize(m.material, f.crystal);
      m.material.userData.kind = want; m.material.map = old.map; old.dispose();
    }
    const toon = want === 'toon';
    if (f.facets) { const key = f.facets.join('x'); m.geometry = facetGeoms[key] || (facetGeoms[key] = new THREE.SphereGeometry(1, f.facets[0], f.facets[1])); }
    else m.geometry = geomOf(k, lod);
    m.material.flatShading = !!f.facets;
    finishOf(k, m.material);
    let ol = m.userData.outline;
    if (toon && !ol) { ol = m.userData.outline = new THREE.Mesh(m.geometry, outlineMat); ol.scale.setScalar(1.075); m.add(ol); }
    if (ol) { ol.visible = toon; ol.geometry = m.geometry; }
  }
  const mats = {};
  // every picture a set's balls are painted from (once all have come, the shelf's photographs are kept)
  const picsOf = k => [k.mat, typeof k.skin === 'string' ? k.skin : null, ...(k.caromSkins || []).map(c => c.pic)].filter(Boolean);
  function matOf(m) {
    if (m in mats) return mats[m]; mats[m] = null; const u = TEXS['ball-' + m]; if (!u) return null;
    const im = new Image(); im.onload = () => { mats[m] = im; if (skin && picsOf(skin).includes(m)) { const k = skin.id; skin = null; setBalls(k); } }; im.src = u; return null;
  }
  /* A photograph of one ball of a set, for the shelf cards: the ball drawn by this renderer into a small target, lit by
     the same room (so it looks as it will on the table), its number turned to the camera; kept once made. */
  const shots = {}; let shotRT = null, shotScene = null, shotBall = null, shotCam = null;
  // ballShot: the same picture as a canvas, and whether its surface pictures had all loaded (the app keeps it on the device then:
  // app/32-desk.js lazyPic); ballPortrait: as a data URL, kept for the session
  function ballPortrait(id, kind, n) {
    const key = id + '/' + kind + '/' + n; if (shots[key]) return shots[key];
    const s = ballShot(id, kind, n), url = s.c.toDataURL('image/png'); if (s.done) shots[key] = url; return url;
  }
  function ballShot(id, kind, n) {
    const k = BALLSKINS.find(b => b.id === id) || BALLSKINS[0];
    if (!shotRT) {
      shotRT = new THREE.WebGLRenderTarget(160, 160); shotRT.texture.encoding = THREE.sRGBEncoding;
      shotScene = new THREE.Scene(); shotScene.environment = scene.environment;
      shotScene.add(new THREE.HemisphereLight(0xffffff, 0x303030, 0.35));
      const key = new THREE.DirectionalLight(0xfff4e6, 0.85); key.position.set(2.2, 2.4, 3); shotScene.add(key);
      shotBall = new THREE.Mesh(sphere, new THREE.MeshPhysicalMaterial({ roughness: 0.2, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 0.9 }));
      shotScene.add(shotBall); shotCam = new THREE.PerspectiveCamera(17, 1, 0.5, 20); shotCam.position.set(0, 0, 7); shotCam.lookAt(0, 0, 0);
    }
    const keep = skin; skin = k; const t = ballTexture(kind, n); skin = keep;
    const done = picsOf(k).every(m => !TEXS['ball-' + m] || !!mats[m]);
    dressBall(shotBall, k, 0); shotBall.material.map = t; shotBall.material.color.setScalar(0.72); shotBall.material.needsUpdate = true;   // (no tone mapping off screen: a shade darker to match the table) shotBall.rotation.set(0.25, -0.18, 0);
    const prev = renderer.getRenderTarget(), cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha();
    renderer.setRenderTarget(shotRT); renderer.setClearColor(0x000000, 0); unmask(); renderer.clear(); renderer.render(shotScene, shotCam);
    const px = new Uint8Array(160 * 160 * 4); renderer.readRenderTargetPixels(shotRT, 0, 0, 160, 160, px);
    renderer.setRenderTarget(prev); renderer.setClearColor(cc, ca); t.dispose();
    const c = mkCanvas(160, 160), g = c.getContext('2d'), im = g.createImageData(160, 160);
    for (let y = 0; y < 160; y++) im.data.set(px.subarray((159 - y) * 640, (160 - y) * 640), y * 640);   // (the target is upside down)
    g.putImageData(im, 0, 0); dirty = 3; staticDirty = true;
    return { c, done };
  }
  // the shadows' markers into the two drawings: each one on show, in the order the balls are
  const blobM = new THREE.Matrix4();
  function blobSync(set, on) {
    const [ci, li] = set.ims; let nc = 0, nl = 0;
    if (on) for (const s of set.blob) {
      if (!s.visible) continue;
      s.children.forEach((o, k) => { blobM.compose(o.position, o.quaternion, o.scale); if (k) li.setMatrixAt(nl++, blobM); else ci.setMatrixAt(nc++, blobM); });
    }
    ci.count = nc; li.count = nl; ci.visible = nc > 0; li.visible = nl > 0;
    ci.instanceMatrix.needsUpdate = li.instanceMatrix.needsUpdate = true;
  }
  function ballSet(kind, n, R) {
    const mesh = [], blob = [];
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(sphere, new THREE.MeshPhysicalMaterial({ map: null, roughness: 0.2, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 0.7 }));
      m.scale.setScalar(R); m.visible = false; scene.add(m); mesh.push(m);
      // (a ball's shadows: where each one lies is kept here, in plain markers; they are drawn all together - blobSync)
      const s = new THREE.Group(); s.visible = false; scene.add(s); blob.push(s);
      const c = new THREE.Object3D(); c.scale.set(R * 2.7, R * 2.7, 1); c.position.z = 0.0009; s.add(c);
      for (let k = 0; k < LAMPS.length; k++) { const l = new THREE.Object3D(); l.scale.set(R * 3.3, R * 3.3, 1); l.position.z = 0.0008; s.add(l); }
    }
    // every ball's contact shadow in one draw, and every lamp shadow in another (rather than four draws a ball: 64 for 8볼)
    const ims = [new THREE.InstancedMesh(unitPlane, blobMat, n), new THREE.InstancedMesh(unitPlane, lampShadowMat, n * LAMPS.length)];
    for (const im of ims) { im.renderOrder = 1; im.frustumCulled = false; im.count = 0; scene.add(im); }
    return { mesh, blob, R, ims, kind, skin: null, lod: 0, small: false };
  }
  const sets = { pool: ballSet('pool', 16, PH.pool.R), carom: ballSet('carom', 4, PH.carom.R) };
  // another ball set: each ball's picture drawn again (the meshes stay)
  let caromY = 1;                                                     // which carom ball wears the yellow (frame)
  // (each set is dressed - its pictures drawn, its shape made - when it is next drawn: a set not on the table waits, and
  // trying skins on in the shop draws one set each time, not both)
  function setBalls(id) {
    const k = BALLSKINS.find(b => b.id === id) || BALLSKINS[0]; if (k === skin) return; skin = k;
    dirty = 3;
  }
  // 화질 '낮음': each ball's picture at half the size each way (a quarter of the memory); '자동' and '높음' as drawn
  function ballMap(kind, i) {
    const t = ballTexture(kind, i); if (quality !== 'low') return t;
    const c = t.image, s = mkCanvas(c.width / 2, c.height / 2); s.getContext('2d').drawImage(c, 0, 0, s.width, s.height); t.dispose(); return tex(s);
  }
  function dressSet(set, lod) {
    if (set.skin === skin && set.lod === lod && set.q === quality) return;
    if (set.skin !== skin || set.q !== quality) {
      set.mesh.forEach((m, i) => { const old = m.material.map; dressBall(m, skin, lod); m.material.map = ballMap(set.kind, i); m.material.needsUpdate = true; if (old) old.dispose(); });
      set.skin = skin; set.q = quality; if (set === sets.carom) caromY = 1;
    } else for (const m of set.mesh) {
      if ((skin.finish || {}).facets) continue;
      m.geometry = geomOf(skin, lod); const ol = m.userData.outline; if (ol) ol.geometry = m.geometry;
    }
    set.lod = lod; dirty = 3;
  }

