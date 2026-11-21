/* ================= The 선수증's glass case, drawn in 3D (owner 11-21: "three.js로 그리게") =================
   The case (37-desk-menu.js glassCase) is a block of clear acrylic round the card, with the tier's metal frame in it
   (owner 11-21: the tier's border belongs to the case, not the card). The card stays the page's own (HTML); the glass is
   drawn by a small WebGL renderer of its own (alpha, made the first time a case is shown) onto a canvas laid over the
   card: an unseen plane where the card is fills the depth first, so what of the glass is behind the card is hidden by it.
   The glass reflects a made-up room (soft boxes upper right and a window strip left - the light the menu's shadows say),
   its outer faces only (the far edges are not seen through - the case read as jumping out, owner 11-21), the edges
   thick and cyan-green; brightness gives the glass its alpha, so a reflection shows over the card as on real glass.
   Its projection is the page's own: the same perspective (1500u from the case's top middle, or the desk's eye - gz-view)
   so the card and its case meet. On the menu the case stands still: drawn once (again when its size changes). On a
   match's opening (56-league.js) the swing in and the fling away are played here, frame by frame, for the case and
   (through its CSS transform) the card alike. No WebGL: the CSS case (84-menu.css .g3) is left as it was. */
const glass3d = (() => {
  let R = null, env = null, tried = false;
  const METAL = { bronze: 0xa8653a, silver: 0xc8ced8, gold: 0xd9ae4f, platinum: 0x8ed3cc, diamond: 0x7fb4ff, pro: 0xd6ad58 };
  const GLOW = { diamond: 0x6fb4ff, pro: 0xf0c060 };
  const col = h => new THREE.Color(h).convertSRGBToLinear();
  function init() {
    if (tried) return R; tried = true;
    if (typeof THREE === 'undefined') return null;
    try { R = new THREE.WebGLRenderer({ canvas: document.createElement('canvas'), alpha: true, antialias: true, premultipliedAlpha: false }); } catch (e) { return R = null; }
    R.outputEncoding = THREE.sRGBEncoding; R.toneMapping = THREE.NoToneMapping;
    R.setClearColor(0x000000, 0); R.autoClear = false;
    // the room the glass reflects: dark, a big soft box up and to the right in front, a long window strip on the left, a
    // floor's warm glow below - seen from the case, toward the eye
    const room = new THREE.Scene(), box = (w, h, x, y, z, c, k = 1) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col(c).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); room.add(m); };
    room.background = col(0x262c33);
    box(6, 4, 5, 5, 6, 0xffffff, 6); box(1.2, 9, -7, 1, 4, 0xbfd6e6); box(14, 3, 0, -7, 3, 0x8a6a4e); box(5, 2, -2, 6, -6, 0xa0b0c0); box(3, 8, 8, 0, -1, 0xd8e4ee);
    // two bars across the front, slanting (what the front pane shows straight on: its glare)
    const bar = (w, x, y, c, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 30), new THREE.MeshBasicMaterial({ color: col(c).multiplyScalar(k), side: THREE.DoubleSide })); m.position.set(x, y, 9); m.rotation.z = -0.62; room.add(m); };
    bar(0.7, 0.9, 0.5, 0xffffff, 6); bar(0.2, -0.9, -0.6, 0xffffff, 4);
    const pm = new THREE.PMREMGenerator(R); env = pm.fromScene(room, 0.03).texture; pm.dispose();
    return R;
  }
  // brightness as alpha: the glass is near clear where it is dark and shows where it reflects (r128's transparent
  // materials scale their light by the opacity - this keeps the reflection whole)
  const lit = (mat, k) => { mat.onBeforeCompile = s => { s.fragmentShader = s.fragmentShader.replace('gl_FragColor = vec4( outgoingLight, diffuseColor.a );',   // (r128's last line)
    `float L_ = dot(outgoingLight, vec3(0.3, 0.55, 0.15));
     gl_FragColor = vec4( min(outgoingLight / max(L_, 1e-4), vec3(4.0)) * min(L_ * 4.0 + 0.6, 1.0), clamp(diffuseColor.a + L_ * ${k.toFixed(2)}, 0.0, 1.0) );`); }; return mat; };
  const rr = (w, h, r, x = 0, y = 0) => { const s = new THREE.Shape(), a = x - w / 2, b = y - h / 2; r = Math.min(r, w / 2, h / 2);
    s.moveTo(a + r, b); s.lineTo(a + w - r, b); s.quadraticCurveTo(a + w, b, a + w, b + r); s.lineTo(a + w, b + h - r); s.quadraticCurveTo(a + w, b + h, a + w - r, b + h);
    s.lineTo(a + r, b + h); s.quadraticCurveTo(a, b + h, a, b + h - r); s.lineTo(a, b + r); s.quadraticCurveTo(a, b, a + r, b); return s; };
  const text = (no, w, h) => { const c = document.createElement('canvas'); c.width = 512; c.height = Math.max(16, Math.round(512 * h / w)); const g = c.getContext('2d');
    g.fillStyle = 'rgba(255,255,255,.62)'; g.textBaseline = 'middle'; g.font = `900 ${Math.round(c.height * 0.42)}px ${getComputedStyle(document.body).fontFamily}`;
    g.letterSpacing = '0.3em'; g.fillText('C U E', c.height * 0.6, c.height / 2); g.font = `700 ${Math.round(c.height * 0.34)}px ui-monospace,monospace`; g.textAlign = 'right'; g.fillText('No.' + no, c.width - c.height * 0.6, c.height / 2);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t; };
  /* The case as the page has laid it out: g - its .g3; returns { W, H, u, card: {x, y, w, h} } in CSS px (y down). */
  function measure(g) {
    const u = parseFloat(getComputedStyle(g).getPropertyValue('--u')) || 1, c = g.querySelector('.mn-pc');
    return { W: g.offsetWidth, H: g.offsetHeight, u, card: { x: c.offsetLeft, y: c.offsetTop, w: c.offsetWidth, h: c.offsetHeight } };
  }
  /* The case, its middle at (0, 0), the card's plane z = 0, y up: a group the caller places. o: measure() and the
     case's classes (its tier and dressings). */
  function model(g, o) {
    const { W, H, u, card } = o, cls = g.classList, tier = (/\bt-(\w+)/.exec(g.className) || [])[1] || 'bronze';
    const D = 34 * u, bev = 8 * u, grp = new THREE.Group();
    const cx = card.x + card.w / 2 - W / 2, cy = H / 2 - (card.y + card.h / 2);   // the card's middle, from the case's
    // the card: depth only, first
    const occ = new THREE.Mesh(new THREE.ShapeGeometry(rr(card.w, card.h, 20 * u, cx, cy), 6), new THREE.MeshBasicMaterial({ colorWrite: false }));
    occ.renderOrder = -10; grp.add(occ);
    // the block: front and back faces (caps) nearly clear, its edges thick cyan-green; only their outer sides drawn
    const slab = new THREE.ExtrudeGeometry(rr(W - 2 * bev, H - 2 * bev, 4 * u), { depth: D - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: 6 });
    slab.translate(0, 0, -(D - 2 * bev) / 2);
    const glow = cls.contains('gz-glow') && GLOW[tier] != null ? GLOW[tier] : 0x000000;
    const cap = lit(new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.04, metalness: 0, envMap: env, envMapIntensity: 1.2, transparent: true, opacity: 0.02, depthWrite: false }), 1.0);
    const edge = lit(new THREE.MeshStandardMaterial({ color: col(0x3f9e90), roughness: 0.1, metalness: 0, envMap: env, envMapIntensity: 1.0, transparent: true, opacity: 0.4, emissive: col(glow || 0x2a8a7c), emissiveIntensity: glow ? 0.7 : 0.35 }), 0.6);
    const m = new THREE.Mesh(slab, [cap, edge]); m.renderOrder = 2; grp.add(m);
    // the tier's metal frame round the card, inside the glass
    const fw = 7 * u, outer = rr(card.w + 2 * fw, card.h + 2 * fw, 25 * u, cx, cy);
    outer.holes.push(rr(card.w, card.h, 20 * u, cx, cy));
    const metal = new THREE.MeshStandardMaterial({ color: col(METAL[tier] || METAL.bronze), metalness: 1, roughness: tier === 'pro' ? 0.22 : 0.3, envMap: env, envMapIntensity: 1.3 });
    const fr = new THREE.ExtrudeGeometry(outer, { depth: 8 * u, bevelEnabled: true, bevelThickness: 1.2 * u, bevelSize: 1.2 * u, bevelSegments: 2, curveSegments: 8 });
    fr.translate(0, 0, -4 * u); const f = new THREE.Mesh(fr, metal); f.renderOrder = 1; grp.add(f);
    // the dressings, each on its switch (37-desk-menu.js GZ)
    const top = new THREE.Group(); top.position.z = D / 2; top.renderOrder = 3; grp.add(top);
    const m2 = card.y, bot = H - card.y - card.h;
    if (cls.contains('gz-screw')) for (const [sx, sy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(5.5 * u, 5.5 * u, 2.4 * u, 20), metal); s.rotation.x = Math.PI / 2;
      s.position.set(sx * (W / 2 - m2 / 2), sy > 0 ? H / 2 - m2 / 2 : -H / 2 + bot / 2, 1.2 * u); top.add(s);
      const slot = new THREE.Mesh(new THREE.BoxGeometry(8 * u, 1.3 * u, 1 * u), new THREE.MeshBasicMaterial({ color: col(0x1a1410) }));
      slot.position.copy(s.position); slot.position.z += 1.3 * u; slot.rotation.z = -0.6; top.add(slot);
    }
    if (cls.contains('gz-mark')) {
      const no = String([...(g.querySelector('.nm') || {}).textContent || ''].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9973, 7)).padStart(4, '0');
      const mw = W - 2 * m2 - 8 * u, mh = Math.min(bot * 0.7, 20 * u);
      const k = new THREE.Mesh(new THREE.PlaneGeometry(mw, mh), new THREE.MeshBasicMaterial({ map: text(no, mw, mh), transparent: true, depthWrite: false }));
      k.position.set(0, -H / 2 + bot / 2, 0.3 * u); top.add(k);
    }
    if (cls.contains('gz-glow') && (GLOW[tier] != null || cls.contains('gz-holo-all'))) {
      const hm = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { t: { value: 0 } },
        vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vN = normalize(normalMatrix * normal); vec4 p = modelViewMatrix * vec4(position, 1.0); vV = normalize(-p.xyz); gl_Position = projectionMatrix * p; }',
        fragmentShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; uniform float t;
          vec3 hue(float h){ return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
          void main(){ vec2 d = vUv - 0.5; float r = length(d); if (r > 0.5) discard;
            float ring = smoothstep(0.5, 0.47, r) * (1.0 - smoothstep(0.30, 0.28, r) * smoothstep(0.24, 0.26, r));
            float a = atan(d.y, d.x) / 6.2832 + dot(vN, vV) * 1.5 + t * 0.25 + r;
            gl_FragColor = vec4(mix(hue(fract(a)), vec3(1.0), 0.25), 0.82 * ring); }` });
      const h = new THREE.Mesh(new THREE.CircleGeometry(20 * u, 40), hm);
      h.position.set(W / 2 - m2 - 3 * u, cy + card.h / 2 - 70 * u, 0.4 * u); top.add(h); grp.userData.holo = hm;
    }
    return grp;
  }
  /* A camera that sees as the page's perspective does: the eye P before the vanishing point vp (canvas px, y down), one
     unit one CSS px at z = 0, the canvas (cw × ch) its view. */
  function camera(vp, P, cw, ch) {
    const fw = 2 * Math.max(vp.x, cw - vp.x) + 2, fh = 2 * Math.max(vp.y, ch - vp.y) + 2;
    const c = new THREE.PerspectiveCamera(2 * Math.atan(fh / 2 / P) * 180 / Math.PI, fw / fh, 1, P * 4);
    c.position.set(vp.x, -vp.y, P); c.setViewOffset(fw, fh, fw / 2 - vp.x, fh / 2 - vp.y, cw, ch); c.updateProjectionMatrix();
    return c;
  }
  // the vanishing point, from the case's top middle (as 84-menu.css --persp): the desk's eye right of and below it
  // (left of it: eye 'l', the opening's right-hand card)
  const eye = (g, o) => g.classList.contains('gz-view') ? { x: (g.classList.contains('vl') ? -1.1 : 1.1) * o.W, y: 1.08 * o.H } : { x: 0, y: 0 };
  // the canvas drawn on: the renderer's own picture copied in (one renderer for every case)
  function draw(cv, cw, ch, jobs) {
    const dpr = Math.min(2, devicePixelRatio || 1), pw = Math.round(cw * dpr), ph = Math.round(ch * dpr);
    if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
    R.setPixelRatio(dpr); R.setSize(cw, ch, false); R.clear(true, true, true);
    for (const [scene, cam] of jobs) { R.clearDepth(); R.render(scene, cam); }
    const x = cv.getContext('2d'); x.clearRect(0, 0, pw, ph); x.drawImage(R.domElement, 0, 0, pw, ph);
  }
  const free = scene => scene.traverse(m => { if (m.geometry) m.geometry.dispose(); for (const x of [].concat(m.material || [])) { if (x.map) x.map.dispose(); x.dispose(); } });
  const sun = () => { const g = new THREE.Group(), l = new THREE.DirectionalLight(0xffffff, 0.9); l.position.set(1, 1.2, 1.5); g.add(l, new THREE.HemisphereLight(0xffffff, 0x404040, 0.5)); return g; };
  const PAD = 60;
  return {
    ok: () => !!init(),
    /* A case on the menu, still: its canvas laid over it, drawn now and when its size changes. */
    still(g) {
      if (!init() || !g.isConnected) return false;
      g.classList.add('gl');
      let cv = g.querySelector(':scope>canvas.gl3'); if (!cv) { cv = el('canvas', { class: 'gl3', 'aria-hidden': 'true' }); g.appendChild(cv); }
      const paint = () => {
        const o = measure(g); if (!o.W) return;
        const pad = Math.round(PAD * o.u), cw = o.W + 2 * pad, ch = o.H + 2 * pad, e = eye(g, o);
        Object.assign(cv.style, { left: -pad + 'px', top: -pad + 'px', width: cw + 'px', height: ch + 'px' });
        const scene = new THREE.Scene(), grp = model(g, o); grp.position.set(pad + o.W / 2, -(pad + o.H / 2), 0); scene.add(grp);
        scene.add(sun());
        draw(cv, cw, ch, [[scene, camera({ x: pad + o.W / 2 + e.x, y: pad + e.y }, 1500 * o.u, cw, ch)]]);
        free(scene);
      };
      paint();
      if (!g._ro) { let last = ''; g._ro = new ResizeObserver(() => { const k = g.offsetWidth + 'x' + g.offsetHeight; if (k !== last) { last = k; paint(); } }); g._ro.observe(g); }
      return true;
    },
    /* A match's opening, its cases swinging in and flung away (as 79-league.css's g3In/g3Out, now played here): layer -
       the .vs, box - the #league (its 'away' class says when). */
    opening(layer, box) {
      if (!init()) return false;
      const cases = [...layer.querySelectorAll('.g3')]; if (!cases.length) return false;
      layer.classList.add('js'); for (const g of cases) g.classList.add('gl');
      const cv = el('canvas', { class: 'gl3 vs-gl', 'aria-hidden': 'true' }); layer.appendChild(cv);
      let set = null, t0 = performance.now(), t1 = 0;
      const ease = x => 1 - Math.pow(1 - x, 2.2), easeIn = x => Math.pow(x, 2.4);
      // the swing in, keyframes [p, rotateY, rotateZ, translateX (of 45vw)] - the left case's; the right one's mirrored
      const K = [[0, 80, 6, -1], [0.34, -26, -3, 0], [0.52, 13, 1.5, 0], [0.68, -6, -0.6, 0], [0.84, 2.5, 0, 0], [1, 0, 0, 0]];
      const pose = (now, side) => {
        const s = side === 'r' ? -1 : 1;
        if (t1) { const p = easeIn(Math.min(1, (now - t1) / 450)); return { tx: -s * 0.55 * innerWidth * p, ty: 0.1 * innerHeight * p, ry: s * 110 * p, rz: s * 14 * p, op: 1 - p }; }
        const p = Math.max(0, Math.min(1, (now - t0 - 100) / 1150)); let i = 0; while (i < K.length - 2 && p > K[i + 1][0]) i++;
        const [a, b] = [K[i], K[i + 1]], q = ease((p - a[0]) / (b[0] - a[0])), L = (j) => a[j] + (b[j] - a[j]) * q;
        return { tx: s * L(3) * 0.45 * innerWidth, ty: 0, ry: s * L(1), rz: s * L(2), op: Math.min(1, p / 0.12) };
      };
      const frame = () => {
        if (!layer.isConnected) return;
        const now = performance.now();   // (the clock the opening's timers keep - not the frame's own stamp)
        if (!t1 && box.classList.contains('away')) t1 = now;
        if (!set) {   // (the cases where the layout put them, before any turn)
          for (const g of cases) g.style.transform = 'none';
          const lr = layer.getBoundingClientRect();
          set = cases.map(g => { const r = g.getBoundingClientRect(), o = measure(g), side = g.closest('.vs-card.r') ? 'r' : 'l', grp = model(g, o), piv = new THREE.Group();
            grp.position.y = -o.H / 2; piv.add(grp); const scene = new THREE.Scene(); scene.add(piv);
            scene.add(sun());
            return { g, o, side, piv, scene, holo: grp.userData.holo, x: r.left - lr.left + o.W / 2, y: r.top - lr.top, e: eye(g, o) }; });
          Object.assign(cv.style, { left: 0, top: 0, width: lr.width + 'px', height: lr.height + 'px' }); set.w = lr.width; set.h = lr.height;
        }
        const jobs = []; let op = 1;
        for (const c of set) {
          const k = pose(now, c.side), P = 1500 * c.o.u, ex = c.e.x, ey = c.e.y;
          c.g.style.transform = `translate(${ex}px,${ey}px) perspective(${P}px) translate(${-ex}px,${-ey}px) translate(${k.tx.toFixed(1)}px,${k.ty.toFixed(1)}px) rotateY(${k.ry.toFixed(2)}deg) rotateZ(${k.rz.toFixed(2)}deg)`;
          c.g.style.opacity = k.op.toFixed(3);
          c.piv.position.set(c.x + k.tx, -(c.y + k.ty), 0); c.piv.rotation.set(0, k.ry * Math.PI / 180, -k.rz * Math.PI / 180, 'XYZ');
          if (c.holo) c.holo.uniforms.t.value = now / 1000;
          op = k.op; if (k.op > 0.01) jobs.push([c.scene, camera({ x: c.x + ex, y: c.y + ey }, P, set.w, set.h)]);
        }
        cv.style.opacity = op.toFixed(3);   // (both cases fade alike)
        draw(cv, set.w, set.h, jobs);
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
      return true;
    },
  };
})();
