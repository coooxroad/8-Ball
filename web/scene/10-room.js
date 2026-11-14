  /* Pictures of real materials (web/tex, carried inside the page as data, so WebGL may read them): each takes the place
     of its drawn stand-in once it has loaded; without them the drawn ones stay. */
  const TEXS = typeof TEXTURES !== 'undefined' ? TEXTURES : {}, loader = new THREE.TextureLoader(), made = {};
  // (a picture is decoded once: asked again - a cue built again, say - a copy of it is handed over at once; a picture
  // changes only colours, so the shadows are left as they are)
  let texPending = 0;
  function loadTex(name, rep, done) {
    if (!TEXS[name]) return;
    const had = made[name];
    if (had) {
      const t = had.clone(); t.needsUpdate = true; t.offset.set(0, 0); t.center.set(0, 0); t.rotation = 0;   // (a copy of its own, as a fresh load gave: callers may change it)
      if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); } else { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.repeat.set(1, 1); }
      if (done) done(t); staticDirty = true; dirty = 3; return;
    }
    texPending++;
    loader.load(TEXS[name], t => {
      texPending--;
      t.encoding = THREE.sRGBEncoding; t.anisotropy = aniso;
      if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); }
      made[name] = t; if (done) done(t);
      staticDirty = true; dirty = 3;
    }, undefined, () => { texPending--; });
  }

  /* Light that can be tuned (the app's 디버그 settings, owner 11-11: app/20-sheets.js sheetDebug; only on an account the admin
     console has put in debug mode). Each is a multiplier on the constants below (1: those), but exposure (the tone
     mapping's, as set), blur (how soft the reflections are: the room's blur), gloss (the balls' lacquer roughness) and glint
     (how bright the lamp shows on lacquer - below).
     LIGHT0 is the game's own light: the owner's pick (11-11), tuned by eye on the tablet - but the lacquer (gloss), 0.24
     there to run a row of glints into a line, is 0.06 under the one rectangular lamp: a crisp glint of its shape. */
  const LIGHT0 = { exposure: 1.1, panel: 0.85, blur: 0.06, ballEnv: 0.8, gloss: 0.06, lamp: 1.3, fill: 0.8, rail: 0.45, metal: 1.9, size: 1, glint: 5 };
  let light = Object.assign({}, LIGHT0), envTex = null;
  /* The lamp over the table is one rectangle in the table's proportions, a little smaller than the table, just above it
     (owner 11-11/12: "the lamp square, its sides in the table's proportion", "a little smaller than the table, over it").
     Everything is lit by it - the table, its rails and the balls (RectAreaLights of its size: below); the reflections' room
     has a box of the same shape. */
  const LAMP_LEN = 0.9;                        // (its length and width, as a part of the table's)
  /* reflections for the balls: a dim room with the table's light overhead - the lamp, a long box over the table, its
     underside lit and its sides glowing a little (as the light box over the table, hallLight), as long and as wide as the
     table (owner 11-11; three panels gave every ball three glints in a row). Its lit area is the three panels' old one, so
     the light the room gives is as it was. Built again when the panel's brightness or the blur is tuned (setLight). */
  function buildEnv() {
    const es = new THREE.Scene(); es.background = new THREE.Color(0x0c0b0a);
    const lit = (hex, k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k) });
    const panel = (w, h, x, y, z, hex, k) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), lit(hex, k)); m.material.side = THREE.DoubleSide;
      m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m);
    };
    // (as wide, seen from the table, as the lamp: 0.9 of a 9ft table at 1.05m, here 2.3m away - its light spread over the larger
    // area, so the room gives the light it gave with the three panels' 1.344 m²)
    const L = 2 * 1.27 * LAMP_LEN * 2.3 / 1.05, Wd = L / 2, k = 1.344 / (L * Wd);
    const side = lit(0xfff4e2, 1.2 * k * light.panel), under = lit(0xfff4e2, 5 * k * light.panel);
    const box = new THREE.Mesh(new THREE.BoxGeometry(L, Wd, 0.14), [side, side, side, side, lit(0x16171a, 1), under]);   // (-z, the underside, faces the table)
    box.position.set(0, 0, 2.3); es.add(box);
    panel(6, 2.5, 0, 5, 1.2, 0x6a5a4a, 0.5); panel(6, 2.5, 0, -5, 1.2, 0x4a4038, 0.4);
    const pm = new THREE.PMREMGenerator(renderer), t = pm.fromScene(es, light.blur).texture; pm.dispose();
    es.traverse(o => { if (o.isMesh) { o.geometry.dispose(); [].concat(o.material).forEach(m => m.dispose()); } });
    scene.environment = sScene.environment = t; if (envTex) envTex.dispose(); envTex = t;
  }
  buildEnv();

  /* The lamp is a RectAreaLight - one over the table (the static layer: cloth, rails, wood, metal; tableLamp) and the same one
     over what moves (the balls, the cue: rectLamp), so the cloth's light, the rails' glints and the balls' are all the lamp's
     rectangle. A rectangular light casts no shadow in three, so three spots under it (lampObjs) give the table its shadows -
     wide and faint, a small part of the light (SPOT_K): soft shadows under the cushions, no round pools. The strengths are
     set so the cloth and the balls are as bright as before (11-12). A comic (toon) ball can't take a rectangular light
     (three r128), so it has a key light of its own from the lamp, in its shader (toonKey: 30-balls.js). */
  initAreaLight();
  /* three r128 shades a rectangular light on the base layer only: a lacquered ball (clearcoat) would show the lamp as a broad
     milky patch and never as the sharp glint on its lacquer. So the lacquer's reflection of the lamp is added to three's
     own rectangular-light shading, as three does it for the base (the same fit at the lacquer's roughness, on its normal,
     with the lacquer's fixed reflectance 0.04) - for every lacquered material, as three would do it itself. */
  /* glint: a lamp as big as this one, this close, spreads its light thin - its true reflection on lacquer would be a faint
     sheen, where a photo of a table shows the lamp as a bright rectangle on every ball (the camera's exposure is set for
     the cloth). So the lacquer's reflection of the lamp is made that much brighter (light.glint; 1: as it would be). It is
     written into three's shading (a constant: a change compiles the lacquered materials again - setLight). */
  const CHUNK = 'lights_physical_pars_fragment', CHUNK0 = THREE.ShaderChunk[CHUNK], CC_AT = 'reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate(';
  if (CHUNK0.indexOf(CC_AT) < 0) console.warn('scene: three changed - no lacquer for the rectangular light');
  let glintNow = null;
  function lacquerGlint(g) {
    if (g === glintNow || CHUNK0.indexOf(CC_AT) < 0) return false; glintNow = g;
    THREE.ShaderChunk[CHUNK] = CHUNK0.replace(CC_AT, `
      #ifdef CLEARCOAT
      { // ccRectArea: the lacquer's glint of the lamp (10-room.js)
        vec3 ccN = geometry.clearcoatNormal; vec2 ccUv = LTC_Uv( ccN, viewDir, material.clearcoatRoughness );
        vec4 c1 = texture2D( ltc_1, ccUv ), c2 = texture2D( ltc_2, ccUv );
        mat3 ccInv = mat3( vec3( c1.x, 0, c1.y ), vec3( 0, 1, 0 ), vec3( c1.z, 0, c1.w ) );
        float ccF = 0.04 * c2.x + 0.96 * c2.y;
        reflectedLight.directSpecular += lightColor * material.clearcoat * ccF * ${g.toFixed(3)} * LTC_Evaluate( ccN, viewDir, position, ccInv, rectCoords );
      }
      #endif
      ` + CC_AT);
    return true;
  }
  lacquerGlint(LIGHT0.glint);
  /* The three spots under the lamp are there for the table's shadows only: they light, but they show nowhere as a light -
     no glint of their own on the rails' lacquer, the balls or the metal (owner 11-12: three lights still on the rail). The
     lamp's reflection is the rectangle's alone. So in three's lighting the spots' specular is taken back out (they are the
     only spots in the game). */
  {
    const B = 'lights_fragment_begin', src = THREE.ShaderChunk[B], at = src.indexOf('SpotLight spotLight;'), RE = 'RE_Direct( directLight, geometry, material, reflectedLight );';
    const k = at < 0 ? -1 : src.indexOf(RE, at);
    if (k < 0) console.warn('scene: three changed - the shadow spots glint');
    else THREE.ShaderChunk[B] = src.slice(0, k) + `{ vec3 spotSpec = reflectedLight.directSpecular; ${RE} reflectedLight.directSpecular = spotSpec; }` + src.slice(k + RE.length);
  }
  const RECT_K = 1.2, TABLE_K = 3.6, SPOT_K = 0.17;   // (at lamp 1: on the balls, on the table, each shadow spot - checked 11-12)
  const toonKey = { value: 1.1 };              // (a comic ball's light from the lamp, as the lamps gave it)
  const lampObjs = [], fills = [];
  for (const sc of [sScene, scene]) {
    const hemi = new THREE.HemisphereLight(0xe8ecf2, 0x2a2622, 0.27); hemi.position.set(0, 0, 1); sc.add(hemi); fills.push(hemi);
  }
  for (const [x, y, z] of LAMPS) {
    const lamp = new THREE.SpotLight(0xfff1dc, SPOT_K, 0, 1.3, 1, 1);
    lamp.position.set(x, y, z); lamp.target.position.set(x, y, 0);
    lamp.castShadow = true; lamp.shadow.mapSize.set(2048, 2048);
    lamp.shadow.camera.near = 0.2; lamp.shadow.camera.far = 3; lamp.shadow.bias = -0.0006; lamp.shadow.normalBias = 0.003;
    sScene.add(lamp, lamp.target); lampObjs.push(lamp);
  }
  const rectLamp = new THREE.RectAreaLight(0xfff1dc, RECT_K, 1, 1); scene.add(rectLamp);
  const tableLamp = new THREE.RectAreaLight(0xfff1dc, TABLE_K, 1, 1); sScene.add(tableLamp);
  // where the lamp is and how big (the balls' own shadows are cast from it: 90-frame.js) - over the middle shade, as long as
  // the table says (cur.HL; 60-view.js placeLamps moves the shades with the desk's light, and calls this)
  const SHADE = { x: 0, y: 0, z: 1.25, len: 1, wid: 0.5 };   // (z: the light box's underside, HALL_Z below)
  function placeRectLamp() {
    const HL = cur ? cur.HL : 1.27, HW = cur ? cur.HW : 0.635, m = LAMPS[1], tg = lampObjs[1].target.position;
    SHADE.len = 2 * HL * LAMP_LEN * light.size; SHADE.wid = 2 * HW * LAMP_LEN * light.size; SHADE.x = m[0]; SHADE.y = m[1];
    for (const L of [rectLamp, tableLamp]) {
      L.width = SHADE.len; L.height = SHADE.wid; L.position.set(m[0], m[1], SHADE.z);
      L.lookAt(tg.x, tg.y, 0);                 // (facing down, aimed as the shades are; its width along the table's length)
    }
    const a = light.lamp / (light.size * light.size);   // (a bigger lamp, the same light: spread over more)
    rectLamp.intensity = RECT_K * a; tableLamp.intensity = TABLE_K * a; toonKey.value = 1.1 * light.lamp;
  }
  placeRectLamp();
  /* the tuned light put on (o: some of LIGHT0's keys; null or {}: the game's own). Called by the app, after everything is made. */
  function setLight(o) {
    const next = Object.assign({}, LIGHT0);
    for (const k in LIGHT0) if (o && Number.isFinite(+o[k])) next[k] = +o[k];
    const room = next.panel !== light.panel || next.blur !== light.blur; light = next;
    renderer.toneMappingExposure = light.exposure;
    for (const l of lampObjs) l.intensity = SPOT_K * light.lamp;
    placeRectLamp();
    for (const h of fills) h.intensity = 0.27 * light.fill;
    woodMat.envMapIntensity = 0.7 * light.rail; metalMat.envMapIntensity = 1.3 * light.metal; chromeMat.envMapIntensity = 1.4 * light.metal;
    for (const set of Object.values(sets)) if (set.skin) for (const m of set.mesh) finishOf(set.skin, m.material);
    sizeHall();
    // (the glint changed: every lacquered material is compiled again with it)
    if (lacquerGlint(light.glint)) for (const sc of [scene, sScene, shotScene]) if (sc) sc.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { if (m.clearcoat) m.needsUpdate = true; }); });
    if (room) { buildEnv(); if (shotScene) shotScene.environment = scene.environment; }
    staticDirty = true; dirty = 3;
  }
  // the static layer and the full-screen quad that shows it
  let rt = null, staticDirty = true;
  const quadMat = new THREE.MeshBasicMaterial({ toneMapped: false, depthTest: false, depthWrite: false });
  const quadScene = new THREE.Scene(), quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), quadMat); quadScene.add(quad);
  // While the table slides or zooms on screen the baked picture is only moved and scaled; it is redrawn once, when the motion ends.
  let stale = false; const bakeA = new THREE.Vector3(), bakeB = new THREE.Vector3(), nowA = new THREE.Vector3(), nowB = new THREE.Vector3();
  const clearCol = new THREE.Color(0x101216);
  function corners(a, b) {
    camera.updateMatrixWorld(); camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    a.set(-cur.HL, -cur.HW, 0).project(camera); b.set(cur.HL, cur.HW, 0).project(camera);
  }
  // every frame the table is also drawn into the depth buffer only, so a ball dropping into a pocket goes behind the rail
  // (the parts that can stand in front of a ball on the cloth - rails, cushions, pocket rims, barricades - are also on layer
  // OCCL: seen tilted with nothing falling, only they need to be in the depth buffer, not the whole table, legs and all)
  const OCCL = 2;
  const depthMat = new THREE.MeshBasicMaterial({ colorWrite: false });
  const unmask = () => { const b = renderer.state.buffers; b.color.setMask(true); b.depth.setMask(true); };

  /* The hall's floor under the table: carpet tiles, lit by the table's lamps (so it falls off into the dark of the room
     away from the table) and taking the table's shadow. Drawn once into the still layer, so it costs nothing a frame.
     Until a carpet texture is supplied, a quiet one is drawn here: dark navy pile with a faint pattern and tile seams. */
  const carpet = (() => {
    const c = mkCanvas(512, 512), g = c.getContext('2d'), id = g.createImageData(512, 512), d = id.data;
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
      const i = (y * 512 + x) * 4, n = rnd() * 0.16 - 0.08;
      // a faint lozenge pattern, and the seams between the four tiles
      const u = (x % 256) / 256, v = (y % 256) / 256, lz = Math.abs(u - 0.5) + Math.abs(v - 0.5), pat = Math.abs(lz - 0.32) < 0.012 || Math.abs(lz - 0.16) < 0.008 ? 0.035 : 0;
      const seam = x % 256 < 1 || y % 256 < 1 ? -0.06 : 0, k = 1 + n + seam;
      d[i] = (50 + pat * 420) * k; d[i + 1] = (56 + pat * 90) * k; d[i + 2] = (84 + pat * 110) * k; d[i + 3] = 255;
    }
    g.putImageData(id, 0, 0); return tex(c, 9);
  })();
  const floorMat = new THREE.MeshLambertMaterial({ map: carpet });
  // the made carpets: grey checks under a pool table, the big triangles under a carom one (each a 2m square of tiles)
  const floorOf = () => made[cur.POCKETED ? 'carpet-checker' : 'carpet-geo'] || carpet;
  const putFloor = () => { const m = floorOf(); if (floorMat.map !== m) { floorMat.map = m; floorMat.color.setScalar(m === carpet ? 1 : 1.05); floorMat.needsUpdate = true; } };
  loadTex('carpet-checker', 9, putFloor); loadTex('carpet-geo', 9, putFloor);
  let tableShadow = null, floorMesh = null, floorDark = null;
  (function backdrop() {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), floorMat); floorMesh = m; m.position.z = -0.8; m.receiveShadow = true; m.layers.set(1); sScene.add(m);
    const s = mkCanvas(512, 320), sg = s.getContext('2d');
    sg.shadowColor = 'rgba(0,0,0,0.8)'; sg.shadowBlur = 52; sg.fillStyle = 'rgba(0,0,0,0.8)';
    const rr = (x, y, w, h, r) => { sg.beginPath(); sg.moveTo(x + r, y); sg.arcTo(x + w, y, x + w, y + h, r); sg.arcTo(x + w, y + h, x, y + h, r); sg.arcTo(x, y + h, x, y, r); sg.arcTo(x, y, x + w, y, r); sg.fill(); };
    rr(70, 60, 372, 200, 26);
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(s), transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }));
    sm.position.set(0, -0.05, -0.79); sm.layers.set(1); sScene.add(sm); tableShadow = sm;
    // the room beyond the lamps' reach: the floor darkens away from the table into the dark of the hall (black well before the floor ends)
    const v = mkCanvas(256, 256), vg = v.getContext('2d'), gr = vg.createRadialGradient(128, 128, 18, 128, 128, 128);
    gr.addColorStop(0, 'rgba(4,4,6,0)'); gr.addColorStop(0.16, 'rgba(4,4,6,0)'); gr.addColorStop(0.36, 'rgba(4,4,6,0.55)'); gr.addColorStop(0.6, 'rgba(4,4,6,0.95)'); gr.addColorStop(0.75, 'rgba(4,4,6,1)');
    vg.fillStyle = gr; vg.fillRect(0, 0, 256, 256);
    const dk = new THREE.Mesh(new THREE.PlaneGeometry(24, 18), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(v), transparent: true, depthWrite: false, toneMapped: false }));
    dk.position.z = -0.795; dk.layers.set(1); sScene.add(dk); floorDark = dk;
  })();
  /* The menu's hall (owner 11-14): a picture of a billiard hall, drawn by the owner (GPT) over line drawings taken from this
     very camera, behind the live table - the floor, its darkening and the light box hidden, the table's shadow on the
     picture's floor and a dark smudge under each foot. HALL_VIEW is the frame the picture was drawn for: a 1536 x 1024
     screen with the table fitted right of the menu (ins, in its pixels), seen from cam. Any other screen shows the
     picture scaled to cover it, cut off at the left (the menu's side: ax 1) and a little more at the top than the bottom
     (ay), and the camera the same way (60-view.js hallFrame), so table and room stay one picture. Drawn behind the still
     layer only (drawBack), never toned: the picture is already as it should look. */
  const HALL_VIEW = { w: 1536, h: 1024, ins: { t: 69, l: 645, r: 0, b: 0 }, cam: { az: 0, el: 0.33, zoom: 0.98, tx: 0, ty: 0 }, ax: 1, ay: 0.6 };
  let hallBack = null;                                          // the picture's name while the menu's hall is shown
  const backMat = new THREE.MeshBasicMaterial({ toneMapped: false, depthTest: false, depthWrite: false });
  const backScene = new THREE.Scene(); backScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), backMat));
  const drawBack = () => { if (hallBack && backMat.map) renderer.render(backScene, quadCam); };
  // the table's shadow on the picture's floor: its outline straight down, softened (as the hall's light from all round
  // throws it), and under each foot standing on the floor (a mesh of the table reaching down to it, low and flat) a dark smudge
  const feetGrp = new THREE.Group(); feetGrp.visible = false; sScene.add(feetGrp);
  const hallShade = (() => {
    const c = mkCanvas(512, 320), g = c.getContext('2d');
    g.shadowColor = 'rgba(0,0,0,1)'; g.shadowBlur = 26; g.shadowOffsetX = 2000; g.fillStyle = '#000';
    g.fillRect(73 - 2000, 50, 366, 220);                       // (the rectangle itself drawn off the canvas: only its blurred shadow lands)
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, opacity: 0.82, depthWrite: false, toneMapped: false }));
    m.position.z = -0.798; m.layers.set(1); feetGrp.visible = false; sScene.add(m); m.visible = false; return m;
  })();
  const footMat = (() => {
    const c = mkCanvas(128, 64), g = c.getContext('2d'), gr = g.createRadialGradient(64, 32, 4, 64, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,0.92)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.setTransform(2, 0, 0, 1, -64, 0); g.fillStyle = gr; g.fillRect(0, 0, 128, 64);
    return new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, toneMapped: false });
  })();
  const footBox = new THREE.Box3(), footGeo = new THREE.PlaneGeometry(1, 1);
  function placeFeet() {
    while (feetGrp.children.length) feetGrp.remove(feetGrp.children[0]);
    hallShade.scale.set(2 * (cur.HL + CW + RW) * 1.4, 2 * (cur.HW + CW + RW) * 1.45, 1);   // (the canvas's rectangle: the rails' outline)
    const grp = tables.get(cur); if (!grp) return;
    grp.updateMatrixWorld(true);
    grp.traverse(o => {
      if (!o.isMesh || !o.geometry) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      footBox.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
      if (footBox.min.z > -0.785 || footBox.max.z - footBox.min.z > 0.1) return;
      const m = new THREE.Mesh(footGeo, footMat); m.layers.set(1);
      m.position.set((footBox.min.x + footBox.max.x) / 2, (footBox.min.y + footBox.max.y) / 2, -0.797);
      m.scale.set(footBox.max.x - footBox.min.x + 0.16, footBox.max.y - footBox.min.y + 0.12, 1); feetGrp.add(m);
    });
  }
  /* The table's own light, as in a billiard hall: a long box hung on two wires over the table, its underside a lit
     acrylic panel and its sides glowing through frosted panels, so it reads as a light from any side. It lights nothing
     itself (the lamps under it do that). Shown when the camera looks round, unless on screen it would hang over the
     table (tableClear in applyCamera). Scaled along the table in setTable. */
  const hall = new THREE.Group(), HALL_Z = 1.25;
  (function hallLight() {
    const top = new THREE.MeshStandardMaterial({ color: col(0x16171a), roughness: 0.5, metalness: 0.6, envMapIntensity: 0.6 });
    const side = new THREE.MeshBasicMaterial({ color: col(0xcfc6b4), toneMapped: false });
    const glow = new THREE.MeshBasicMaterial({ color: col(0xfff6e8), toneMapped: false });
    loadTex('diffuser', 0, t => { t.wrapS = THREE.RepeatWrapping; t.repeat.set(2, 1); glow.map = t; glow.needsUpdate = true; });
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.56, 0.12), [side, side, side, side, top, glow]); box.position.z = HALL_Z + 0.06; hall.add(box);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.58, 0.02), top); rim.position.z = HALL_Z + 0.125; hall.add(rim);
    const wire = new THREE.CylinderGeometry(0.003, 0.003, 3, 6).rotateX(Math.PI / 2);
    for (const x of [-0.42, 0.42]) { const w = new THREE.Mesh(wire, top); w.position.set(x, 0, HALL_Z + 1.6); hall.add(w); }
    hall.visible = false; sScene.add(hall);
  })();
  // the box is the lamp: as long and as wide (placeRectLamp's SHADE; setTable and setLight call this)
  function sizeHall() { hall.scale.set(SHADE.len / 1.04, SHADE.wid / 0.56, 1); }
  // whether the light box, seen from the camera, keeps clear of the table (screen rectangles of the two do not meet)
  const hv = new THREE.Vector3();
  function hallClear() {
    const box = (pts) => { let x0 = 9, x1 = -9, y0 = 9, y1 = -9; for (const p of pts) { hv.set(p[0], p[1], p[2]).project(camera); if (hv.z > 1) return null; x0 = Math.min(x0, hv.x); x1 = Math.max(x1, hv.x); y0 = Math.min(y0, hv.y); y1 = Math.max(y1, hv.y); } return [x0, x1, y0, y1]; };
    const ex = cur.HL + CW + RW, ey = cur.HW + CW + RW, hx = 0.53 * hall.scale.x, hy = 0.29 * hall.scale.y, c = [];
    const t = [], h = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) { t.push([sx * ex, sy * ey, RAIL_Z], [sx * ex, sy * ey, -0.8]); h.push([sx * hx, sy * hy, HALL_Z], [sx * hx, sy * hy, HALL_Z + 0.14]); }
    const a = box(t), b = box(h); if (!a || !b) return false;
    return a[1] < b[0] || b[1] < a[0] || a[3] < b[2] || b[3] < a[2];
  }
  function setBackdrop(hex) { bgCol.copy(col(hex)); clearCol.set(hex); staticDirty = true; dirty = 3; }   // (beyond the floor, and behind the desk's window)

