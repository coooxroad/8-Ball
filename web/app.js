(() => {
'use strict';
const { R, HL, HW, CW, POCKETS, CUSHIONS } = PHYS;
const $ = s => document.querySelector(s);
const app = $('#app'), canvas = $('#gl');
const RW = 0.095, RAIL_Z = 0.04, TICK = 1 / 120;
const BALL_HEX = [0xf4efe2, 0xf2b705, 0x1747b8, 0xd3241c, 0x5a2a93, 0xee7410, 0x0c7a44, 0x7c1a20, 0x111111];
const hexOf = n => BALL_HEX[n === 0 ? 0 : n <= 8 ? n : n - 8];
const css = n => '#' + hexOf(n).toString(16).padStart(6, '0');
const typeOf = id => id === 8 ? 'eight' : id < 8 ? 'solid' : 'stripe';
const GROUP_KO = { solid: '단색 1–7', stripe: '줄무늬 9–15' };

const store = {
  get(k, d) { try { const v = localStorage.getItem('dp8.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('dp8.' + k, JSON.stringify(v)); } catch (e) {} },
};

const game = {
  mode: store.get('mode', 'ai'), level: store.get('level', 1), sound: store.get('sound', true),
  world: PHYS.makeWorld(), turn: 0, players: [{ name: '나', group: null, ai: false }, { name: '컴퓨터', group: null, ai: true }],
  phase: 'menu', isBreak: true, placing: null, aim: 0, power: 0, spin: { x: 0, y: 0 }, started: false, ctx: null, ai: null, cueAnim: null,
};
game.world.track = true; game.world.snd = [];
PHYS.rack(game.world);

/* ================= sound ================= */
const SND = (() => {
  let ac = null, noise = null, last = 0;
  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      const n = Math.floor(ac.sampleRate * 0.3); noise = ac.createBuffer(1, n, ac.sampleRate);
      const d = noise.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ac = null; }
  }
  function burst(freq, q, dur, gain, type) {
    if (!ac || !game.sound) return;
    const t = ac.currentTime, s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noise; f.type = type || 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(ac.destination); s.start(t); s.stop(t + dur + 0.02);
  }
  function tone(freq, dur, gain) {
    if (!ac || !game.sound) return;
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(freq, t); o.frequency.exponentialRampToValueAtTime(freq * 0.6, t + dur);
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  return {
    init,
    ball(v) { const n = performance.now(); if (n - last < 12) return; last = n; const g = Math.min(0.8, 0.06 + v * 0.2); burst(3400, 1.4, 0.03, g); tone(2100, 0.018, g * 0.5); },
    rail(v) { burst(240, 0.7, 0.09, Math.min(0.7, 0.08 + v * 0.14), 'lowpass'); },
    pocket() { tone(120, 0.24, 0.5); burst(600, 0.8, 0.2, 0.22); },
    cue(v) { burst(1500, 1.1, 0.03, Math.min(0.9, 0.25 + v * 0.09)); tone(260, 0.05, 0.3); },
  };
})();

/* ================= three.js scene ================= */
if (!window.THREE) { fail(); return; }
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); }
catch (e) { fail(); return; }
function fail() {
  const d = document.createElement('div'); d.id = 'nogl';
  d.textContent = '이 기기에서 3D 그래픽을 켤 수 없어 게임을 띄우지 못했습니다. 인터넷 연결을 확인한 뒤 다시 열어 주세요.';
  app.appendChild(d); $('#menu').hidden = true;
}
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x030405);
const FOV = 24;
const camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 30);
const col = h => new THREE.Color(h).convertSRGBToLinear();
const aniso = renderer.capabilities.getMaxAnisotropy();
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, rep) {
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = aniso;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); }
  return t;
}

// reflections: a dark room with three lamp panels overhead
(function env() {
  const es = new THREE.Scene(); es.background = new THREE.Color(0x05070a);
  const panel = (w, h, x, y, z, hex, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m);
  };
  panel(0.9, 0.5, -1.0, 0.25, 2.2, 0xfff0d8, 5); panel(0.9, 0.5, 0, 0.25, 2.3, 0xfff0d8, 5); panel(0.9, 0.5, 1.0, 0.25, 2.2, 0xfff0d8, 5);
  panel(6, 2.5, 0, 5, 1.2, 0x30455a, 0.5); panel(6, 2.5, 0, -5, 1.2, 0x4a3524, 0.4);
  panel(2.5, 2.5, 5, 0, 1.2, 0x2a3644, 0.4); panel(2.5, 2.5, -5, 0, 1.2, 0x2a3644, 0.4);
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(es, 0.03).texture; pm.dispose();
})();

// lights
(function lights() {
  const hemi = new THREE.HemisphereLight(0xc4d6e6, 0x1c120a, 0.22); hemi.position.set(0, 0, 1); scene.add(hemi);
  const key = new THREE.SpotLight(0xfff0dc, 1.25, 0, 0.82, 0.55, 1);
  key.position.set(-0.75, 0.85, 2.5); key.target.position.set(0, 0, 0);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.camera.near = 1; key.shadow.camera.far = 5;
  key.shadow.bias = -0.0003; key.shadow.normalBias = 0.004;
  scene.add(key, key.target);
  const fill = new THREE.SpotLight(0xdfe9ff, 0.4, 0, 0.9, 0.7, 1); fill.position.set(1.1, -0.7, 2.3); scene.add(fill, fill.target);
})();

// floor far below the table: gives the top-down view real depth
(function floor() {
  const c = mkCanvas(256, 256), g = c.getContext('2d');
  g.fillStyle = '#6c6258'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? 0 : 255},${Math.random() < 0.5 ? 0 : 255},${Math.random() * 255 | 0},0.06)`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshStandardMaterial({ color: col(0x23262d), map: tex(c, 18), roughness: 1, metalness: 0, envMapIntensity: 0 }));
  m.position.z = -0.8; m.receiveShadow = true; scene.add(m);
})();

const feltCol = col(0x0a5f73);
(function table() {
  // cloth
  const c = mkCanvas(256, 256), g = c.getContext('2d');
  g.fillStyle = '#e4e4e4'; g.fillRect(0, 0, 256, 256);
  const id = g.getImageData(0, 0, 256, 256);
  for (let i = 0; i < id.data.length; i += 4) { const v = 222 + (Math.random() * 34 - 17); id.data[i] = id.data[i + 1] = id.data[i + 2] = v; }
  g.putImageData(id, 0, 0);
  const feltMat = new THREE.MeshStandardMaterial({ color: feltCol, map: tex(c, 9), roughness: 0.96, metalness: 0, envMapIntensity: 0.12 });
  const bx = HL + 0.105, by = HW + 0.118;
  const bed = new THREE.Shape(); bed.moveTo(-bx, -by); bed.lineTo(bx, -by); bed.lineTo(bx, by); bed.lineTo(-bx, by); bed.closePath();
  for (const p of POCKETS) { const h = new THREE.Path(); h.absarc(p.x, p.y, p.r, 0, Math.PI * 2, false); bed.holes.push(h); }
  const bedMesh = new THREE.Mesh(new THREE.ShapeGeometry(bed, 40), feltMat); bedMesh.receiveShadow = true; scene.add(bedMesh);

  // markings
  const mark = new THREE.MeshBasicMaterial({ color: col(0x9fd7e6), transparent: true, opacity: 0.22, depthWrite: false });
  const line = new THREE.Mesh(new THREE.PlaneGeometry(0.003, HW * 2), mark); line.position.set(-HL / 2, 0, 0.0004); scene.add(line);
  for (const sx of [-1, 1]) { const d = new THREE.Mesh(new THREE.CircleGeometry(0.007, 20), mark); d.position.set(sx * HL / 2, 0, 0.0005); scene.add(d); }

  // pocket pits
  const pit = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1, metalness: 0, side: THREE.BackSide, envMapIntensity: 0 });
  const pitB = new THREE.MeshBasicMaterial({ color: 0x000000 });
  for (const p of POCKETS) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r * 0.86, 0.16, 40, 1, true), pit);
    w.rotation.x = Math.PI / 2; w.position.set(p.x, p.y, -0.08); scene.add(w);
    const b = new THREE.Mesh(new THREE.CircleGeometry(p.r, 32), pitB); b.position.set(p.x, p.y, -0.16); scene.add(b);
  }

  // wooden rails with the pocket cut-outs
  const wc = mkCanvas(512, 512), wg = wc.getContext('2d');
  wg.fillStyle = '#b98a62'; wg.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 420; i++) {
    const y = Math.random() * 512, a = 0.04 + Math.random() * 0.14;
    wg.strokeStyle = Math.random() < 0.6 ? `rgba(30,14,6,${a})` : `rgba(190,130,80,${a * 0.7})`;
    wg.lineWidth = 0.6 + Math.random() * 2.2; wg.beginPath(); wg.moveTo(0, y);
    wg.bezierCurveTo(170, y + (Math.random() - 0.5) * 16, 340, y + (Math.random() - 0.5) * 16, 512, y); wg.stroke();
  }
  const wood = new THREE.MeshStandardMaterial({ color: col(0x5a2f1a), map: tex(wc, 1.4), roughness: 0.62, metalness: 0, envMapIntensity: 0.22 });
  const Xb = HL + CW, Yb = HW + CW, ox = Xb + RW, oy = Yb + RW, rr = 0.1;
  const rail = new THREE.Shape();
  rail.moveTo(-ox + rr, -oy); rail.lineTo(ox - rr, -oy); rail.absarc(ox - rr, -oy + rr, rr, -Math.PI / 2, 0, false);
  rail.lineTo(ox, oy - rr); rail.absarc(ox - rr, oy - rr, rr, 0, Math.PI / 2, false);
  rail.lineTo(-ox + rr, oy); rail.absarc(-ox + rr, oy - rr, rr, Math.PI / 2, Math.PI, false);
  rail.lineTo(-ox, -oy + rr); rail.absarc(-ox + rr, -oy + rr, rr, Math.PI, Math.PI * 1.5, false);
  const arcs = POCKETS.map(p => {
    if (!p.corner) { const sy = Math.sign(p.y); return { p, e: [-sy * p.r, sy * Yb], x: [sy * p.r, sy * Yb] }; }
    const sx = Math.sign(p.x), sy = Math.sign(p.y), s = Math.sqrt(p.r * p.r - (CW - PHYS.PO) ** 2);
    const pv = [sx * Xb, p.y - sy * s], ph = [p.x - sx * s, sy * Yb];
    return sx * sy < 0 ? { p, e: pv, x: ph } : { p, e: ph, x: pv };
  });
  for (const a of arcs) { a.a0 = Math.atan2(a.e[1] - a.p.y, a.e[0] - a.p.x); a.a1 = Math.atan2(a.x[1] - a.p.y, a.x[0] - a.p.x); }
  const hole = new THREE.Path();
  hole.moveTo(arcs[0].x[0], arcs[0].x[1]);
  for (const i of [1, 2, 3, 4, 5, 0]) { const a = arcs[i]; hole.lineTo(a.e[0], a.e[1]); hole.absarc(a.p.x, a.p.y, a.p.r, a.a0, a.a1, true); }
  rail.holes.push(hole);
  const bev = 0.004;
  const rg = new THREE.ExtrudeGeometry(rail, { depth: 0.12, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: 28 });
  rg.translate(0, 0, RAIL_Z - 0.12 - bev);
  const railMesh = new THREE.Mesh(rg, wood); railMesh.castShadow = true; railMesh.receiveShadow = true; scene.add(railMesh);

  // pocket liners + sights
  const liner = new THREE.MeshStandardMaterial({ color: col(0x0d0b0a), roughness: 0.8, metalness: 0, envMapIntensity: 0.3 });
  for (const a of arcs) {
    let len = a.a0 - a.a1; while (len < 0) len += Math.PI * 2;
    const m = new THREE.Mesh(new THREE.RingGeometry(a.p.r + bev, a.p.r + 0.017, 40, 1, a.a1, len), liner);
    m.position.set(a.p.x, a.p.y, RAIL_Z + 0.0006); m.receiveShadow = true; scene.add(m);
  }
  const pearl = new THREE.MeshStandardMaterial({ color: col(0xf1e7cf), roughness: 0.25, metalness: 0.1, envMapIntensity: 1.2 });
  const dg = new THREE.CircleGeometry(0.0095, 4);
  const sight = (x, y) => { const m = new THREE.Mesh(dg, pearl); m.position.set(x, y, RAIL_Z + 0.0006); scene.add(m); };
  for (const k of [-3, -2, -1, 1, 2, 3]) for (const sy of [-1, 1]) sight(k * HL / 4, sy * (Yb + RW * 0.52));
  for (const k of [-1, 0, 1]) for (const sx of [-1, 1]) { const m = new THREE.Mesh(dg, pearl); m.rotation.z = Math.PI / 2; m.position.set(sx * (Xb + RW * 0.52), k * HW / 2, RAIL_Z + 0.0006); scene.add(m); }

  // cushions
  const cushMat = new THREE.MeshStandardMaterial({ color: col(0x095467), map: feltMat.map, roughness: 0.96, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.12 });
  for (const cu of CUSHIONS) {
    const back = pt => cu.o[0] !== 0 ? [cu.o[0] * Xb, pt[1]] : [pt[0], cu.o[1] * Yb];
    const top = [[...cu.ja, 0.038], [...cu.a, 0.0355], [...cu.b, 0.0355], [...cu.jb, 0.038], [...back(cu.jb), RAIL_Z], [...back(cu.ja), RAIL_Z]];
    const v = [], uv = [];
    const tri = (a, b, c) => { for (const p of [a, b, c]) { v.push(p[0], p[1], p[2]); uv.push(p[0], p[1]); } };
    for (let i = 1; i < 5; i++) tri(top[0], top[i], top[i + 1]);
    for (let i = 0; i < 3; i++) { const a = top[i], b = top[i + 1], a0 = [a[0], a[1], 0], b0 = [b[0], b[1], 0]; tri(a, a0, b); tri(b, a0, b0); }
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g2.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g2.computeVertexNormals();
    const m = new THREE.Mesh(g2, cushMat); m.castShadow = true; m.receiveShadow = true; scene.add(m);
  }
})();

// balls
const ballMesh = [], blobMesh = [];
(function balls() {
  const geo = new THREE.SphereGeometry(R, 56, 40);
  const bc = mkCanvas(128, 128), bg = bc.getContext('2d');
  const gr = bg.createRadialGradient(64, 64, 14, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,.62)'); gr.addColorStop(0.55, 'rgba(0,0,0,.34)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  bg.fillStyle = gr; bg.fillRect(0, 0, 128, 128);
  const blobMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bc), transparent: true, depthWrite: false });
  const blobGeo = new THREE.PlaneGeometry(R * 3.3, R * 3.3);
  for (let n = 0; n < 16; n++) {
    const W = 1024, H = 512, c = mkCanvas(W, H), g = c.getContext('2d'), ivory = '#f4efe2';
    if (n === 0) {
      g.fillStyle = ivory; g.fillRect(0, 0, W, H); g.fillStyle = '#c8201b';
      const rad = 0.13 / Math.PI * H;
      for (const u of [0, 0.25, 0.5, 0.75, 1]) { g.beginPath(); g.arc(u * W, H / 2, rad, 0, 7); g.fill(); }
      g.fillRect(0, 0, W, rad); g.fillRect(0, H - rad, W, rad);
    } else {
      const stripe = n > 8;
      g.fillStyle = stripe ? ivory : css(n); g.fillRect(0, 0, W, H);
      if (stripe) { g.fillStyle = css(n); g.fillRect(0, H * 0.25, W, H * 0.5); }
      const rad = 0.5 / Math.PI * H;
      for (const u of [0.25, 0.75]) {
        g.fillStyle = ivory; g.beginPath(); g.arc(u * W, H / 2, rad, 0, 7); g.fill();
        g.fillStyle = '#111'; g.font = `bold ${n > 9 ? 84 : 104}px "Helvetica Neue",Arial,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(String(n), u * W, H / 2 + 6);
        if (n === 6 || n === 9) g.fillRect(u * W - 22, H / 2 + 46, 44, 7);
      }
    }
    const mat = new THREE.MeshPhysicalMaterial({ map: tex(c), roughness: 0.14, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 0.55 });
    const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; scene.add(m); ballMesh.push(m);
    const s = new THREE.Mesh(blobGeo, blobMat); s.position.z = 0.0009; s.renderOrder = 1; scene.add(s); blobMesh.push(s);
  }
})();

// cue stick
const cue = new THREE.Group(); cue.rotation.order = 'ZYX';
(function stick() {
  const part = (x0, x1, r0, r1, mat) => {
    const g = new THREE.CylinderGeometry(r1, r0, x1 - x0, 20); g.rotateZ(-Math.PI / 2); g.translate((x0 + x1) / 2, 0, 0);
    const m = new THREE.Mesh(g, mat); m.castShadow = true; cue.add(m);
  };
  const std = (h, ro) => new THREE.MeshStandardMaterial({ color: col(h), roughness: ro, metalness: 0 });
  part(0, 0.012, 0.006, 0.0062, std(0x3f9ac0, 0.9));
  part(0.012, 0.04, 0.0062, 0.0064, std(0xf2ecdd, 0.4));
  part(0.04, 0.76, 0.0064, 0.0105, std(0xd9b782, 0.45));
  part(0.76, 0.775, 0.0108, 0.0109, new THREE.MeshStandardMaterial({ color: col(0xd9ab52), roughness: 0.25, metalness: 0.9 }));
  part(0.775, 1.47, 0.0106, 0.0146, std(0x2a1710, 0.35));
  scene.add(cue);
})();

// aim guide (drawn at ball-centre height so it lines up under perspective)
const guide = new THREE.Group(); scene.add(guide);
const gMat = (o) => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: o, depthTest: false, depthWrite: false });
const unit = new THREE.PlaneGeometry(1, 1);
const gLine = new THREE.Mesh(unit, gMat(0.9)), gObj = new THREE.Mesh(unit, gMat(0.85)), gCue = new THREE.Mesh(unit, gMat(0.5));
const gRing = new THREE.Mesh(new THREE.RingGeometry(R * 0.86, R, 48), gMat(0.9));
const gHand = new THREE.Mesh(new THREE.RingGeometry(R * 1.55, R * 1.75, 48), new THREE.MeshBasicMaterial({ color: col(0xd9ab52), transparent: true, opacity: 0.9, depthTest: false, depthWrite: false }));
for (const m of [gLine, gObj, gCue, gRing, gHand]) { m.renderOrder = 10; guide.add(m); }
let ppm = 200;
function setLine(m, x0, y0, x1, y1, px) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  if (len < 1e-4) { m.visible = false; return; }
  m.visible = true; m.position.set((x0 + x1) / 2, (y0 + y1) / 2, R); m.rotation.z = Math.atan2(y1 - y0, x1 - x0); m.scale.set(len, px / ppm, 1);
}

/* ================= layout ================= */
let portrait = false, dirty = 3, quality = 1, slow = 0;
const invalidate = () => { dirty = 3; };
function layout() {
  const W = app.clientWidth, H = app.clientHeight; if (!W || !H) return;
  portrait = H > W; app.classList.toggle('portrait', portrait);
  const hud = H < 430 ? 44 : 52; app.style.setProperty('--hud-h', hud + 'px');
  const ins = portrait ? { t: hud + 6, l: 6, r: 6, b: 102 } : { t: hud + 4, l: 62, r: 70, b: 6 };
  const sw = W - ins.l - ins.r, sh = H - ins.t - ins.b, cx = ins.l + sw / 2, cy = ins.t + sh / 2;
  const TW = 2 * (HL + CW + RW) + 0.03, TH = 2 * (HW + CW + RW) + 0.03;
  ppm = portrait ? Math.min(sw / TH, sh / TW) : Math.min(sw / TW, sh / TH);
  const fw = 2 * Math.max(cx, W - cx), fh = 2 * Math.max(cy, H - cy);
  const dist = fh / (2 * ppm * Math.tan(FOV * Math.PI / 360));
  camera.aspect = fw / fh; camera.position.set(0, 0, dist);
  camera.up.set(portrait ? 1 : 0, portrait ? 0 : 1, 0); camera.lookAt(0, 0, 0);
  camera.setViewOffset(fw, fh, fw / 2 - cx, fh / 2 - cy, W, H);
  renderer.setPixelRatio(Math.max(1, Math.min(window.devicePixelRatio || 1, 3) * quality));
  renderer.setSize(W, H, false);
  setPowerUI(game.power); invalidate();
}
window.addEventListener('resize', layout);
if (window.ResizeObserver) new ResizeObserver(layout).observe(app);

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function toTable(e) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const o = ray.ray.origin, d = ray.ray.direction, t = (R - o.z) / d.z;
  return { x: o.x + d.x * t, y: o.y + d.y * t };
}

/* ================= HUD ================= */
let toastTimer = 0;
function toast(msg, kind, ms) {
  const t = $('#toast'); t.textContent = msg; t.className = 'show ' + (kind || '');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = kind || ''; }, ms || 2600);
}
function remaining(pi) {
  const g = game.players[pi].group; if (!g) return null;
  const ids = g === 'solid' ? [1, 2, 3, 4, 5, 6, 7] : [9, 10, 11, 12, 13, 14, 15];
  return ids.filter(i => game.world.balls[i].on);
}
function hud() {
  for (let i = 0; i < 2; i++) {
    const el = $('#p' + i), p = game.players[i], rem = remaining(i);
    el.classList.toggle('on', game.turn === i && game.phase !== 'menu' && game.phase !== 'over');
    el.querySelector('.nm').textContent = p.name;
    el.querySelector('.grp').textContent = p.group ? GROUP_KO[p.group] : '공 미정';
    const tray = el.querySelector('.tray'); tray.textContent = '';
    if (!rem) for (let k = 0; k < 7; k++) { const s = document.createElement('i'); s.className = 'mb slot'; tray.appendChild(s); }
    else if (!rem.length) { const s = document.createElement('i'); s.className = 'mb e8'; tray.appendChild(s); }
    else for (const id of rem) { const s = document.createElement('i'); s.className = 'mb' + (id > 8 ? ' st' : ''); s.style.setProperty('--c', css(id)); tray.appendChild(s); }
  }
  const st = $('#status');
  st.textContent = game.phase === 'over' ? 'GAME OVER' : game.isBreak ? 'BREAK' : game.players.every(p => !p.group) ? 'OPEN TABLE' : '8-BALL';
  app.classList.toggle('busy', !(game.phase === 'aim' && !game.players[game.turn].ai));
}
function setPowerUI(p) {
  const tr = $('#power'), fill = $('#powerFill'), c = $('#powerCue');
  $('#powerNum').textContent = Math.round(p * 100);
  if (portrait) {
    fill.style.height = ''; fill.style.width = (p * 100) + '%';
    c.style.transform = `translate(calc(-100% + 34px + ${p * (tr.clientWidth - 34)}px),-50%)`;
  } else {
    fill.style.width = ''; fill.style.height = (p * 100) + '%';
    c.style.transform = `translate(-50%,calc(-100% + 30px + ${p * (tr.clientHeight - 30)}px))`;
  }
}
function setSpinUI() {
  const s = game.spin, k = 0.36;
  $('#spinDot').style.transform = `translate(${s.x * k * 58}px,${-s.y * k * 58}px)`;
  const pad = $('#spinPad'), w = pad.clientWidth || 200;
  $('#spinPadDot').style.transform = `translate(${s.x * k * w}px,${-s.y * k * w}px)`;
}

/* ================= rules ================= */
function evaluate(ev, ctx) {
  const me = ctx.turn, grp = ctx.groups[me], open = !grp;
  const potted = ev.pocketed.map(p => p.id), scratch = potted.includes(0), eight = potted.includes(8);
  const obj = potted.filter(i => i !== 0 && i !== 8);
  let foul = null;
  if (ev.firstHit == null) foul = '공을 하나도 맞히지 못했습니다';
  else if (open) { if (ev.firstHit === 8 && !ctx.isBreak) foul = '8번 공을 먼저 맞혔습니다'; }
  else {
    const need = ctx.remBefore[me] > 0 ? grp : 'eight', ft = typeOf(ev.firstHit);
    if (ft !== need) foul = need === 'eight' ? '8번 공을 먼저 맞혀야 합니다' : ft === 'eight' ? '8번 공을 먼저 맞혔습니다' : '상대 공을 먼저 맞혔습니다';
  }
  if (scratch) foul = '큐볼이 포켓에 빠졌습니다';
  if (!foul && potted.length === 0 && !ev.rail) foul = '맞힌 뒤 쿠션에 닿은 공이 없습니다';
  const r = { foul, scratch, eight, respot8: false, win: null, why: '', assign: null, keep: false, obj };
  if (eight) {
    if (ctx.isBreak) r.respot8 = true;
    else if (foul) { r.win = 1 - me; r.why = '8번 공을 넣으면서 파울이 났습니다.'; }
    else if (open || ctx.remBefore[me] > 0) { r.win = 1 - me; r.why = '자기 공이 남았는데 8번 공이 들어갔습니다.'; }
    else { r.win = me; r.why = '자기 공을 모두 넣고 8번 공까지 넣었습니다.'; }
  }
  if (r.win != null) return r;
  if (open && !ctx.isBreak && !foul && obj.length) r.assign = typeOf(obj[0]);
  const g = grp || r.assign;
  if (!foul) { if (ctx.isBreak) r.keep = obj.length > 0; else if (g) r.keep = obj.some(i => typeOf(i) === g); }
  return r;
}
function ctxNow() {
  return { turn: game.turn, groups: game.players.map(p => p.group), isBreak: game.isBreak, remBefore: [0, 1].map(i => { const r = remaining(i); return r ? r.length : 7; }) };
}
function legalTargets(pi) {
  const b = game.world.balls, p = game.players[pi];
  if (!p.group) return b.filter(x => x.on && x.id !== 0 && x.id !== 8).map(x => x.id);
  const rem = remaining(pi); return rem.length ? rem : [8];
}

/* ================= flow ================= */
function newGame() {
  const pvp = game.mode === 'pvp';
  game.players = [{ name: pvp ? '플레이어 1' : '나', group: null, ai: false }, { name: pvp ? '플레이어 2' : '컴퓨터', group: null, ai: !pvp }];
  PHYS.rack(game.world); game.world.snd = [];
  game.turn = 0; game.isBreak = true; game.placing = 'kitchen'; game.aim = 0; game.power = 0; game.spin = { x: 0, y: 0 };
  game.started = true; game.ai = null; game.cueAnim = null; falls.length = 0;
  for (let i = 0; i < 16; i++) { ballMesh[i].visible = true; ballMesh[i].scale.setScalar(1); }
  $('#menu').hidden = true; $('#over').hidden = true;
  beginTurn(true);
  toast('브레이크. 테이블을 끌어 조준하고, 큐 막대를 당겼다 놓으세요.', '', 4200);
}
function beginTurn(first) {
  game.phase = 'aim'; game.power = 0; game.spin = { x: 0, y: 0 }; setPowerUI(0); setSpinUI();
  const p = game.players[game.turn], c = game.world.balls[0];
  if (p.ai) { game.phase = 'ai'; game.ai = { t: 0, plan: null, from: game.aim }; }
  else if (!first) {
    // point the cue at the nearest legal ball
    let best = null, bd = 1e9;
    for (const id of legalTargets(game.turn)) { const b = game.world.balls[id], d = Math.hypot(b.x - c.x, b.y - c.y); if (d < bd) { bd = d; best = b; } }
    if (best) game.aim = Math.atan2(best.y - c.y, best.x - c.x);
  }
  hud(); invalidate(); snapshot();
}
function shoot(power, opt) {
  const V = 0.35 + 7.4 * Math.pow(power, 1.35);
  game.ctx = ctxNow(); game.phase = 'strike'; game.placing = null;
  game.cueAnim = { t: 0, from: 0.03 + power * 0.2, V, a: (opt ? opt.a : game.spin.x * 0.5), b: (opt ? opt.b : game.spin.y * 0.5) };
  hud();
}
function endShot() {
  const w = game.world, ev = w.ev, r = evaluate(ev, game.ctx), me = game.turn;
  for (const b of w.balls) b.wz = 0;
  const cueB = w.balls[0];
  if (r.respot8) { const b = w.balls[8]; const [x, y] = PHYS.findFree(w, HL / 2, 0, 8); b.x = x; b.y = y; b.on = true; revive(8); }
  if (r.scratch) { const [x, y] = PHYS.findFree(w, -HL / 2, 0, 0); cueB.x = x; cueB.y = y; cueB.on = true; revive(0); }
  game.isBreak = false;
  if (r.win != null) return gameOver(r.win, r.why);
  if (r.assign) {
    game.players[me].group = r.assign; game.players[1 - me].group = r.assign === 'solid' ? 'stripe' : 'solid';
    toast(`${game.players[me].name}: ${GROUP_KO[r.assign]}`, 'good');
  }
  if (r.foul) {
    game.turn = 1 - me; game.placing = 'any';
    toast(`파울 · ${r.foul}. ${game.players[game.turn].name} 차례, 큐볼을 원하는 곳에 놓습니다.`, 'foul', 3600);
  } else if (!r.keep) {
    game.turn = 1 - me;
    if (!r.assign) toast(`${game.players[game.turn].name} 차례`, '', 1500);
  } else if (!r.assign) {
    const rem = remaining(me);
    if (rem && !rem.length) toast('이제 8번 공을 넣으면 이깁니다.', 'good');
  }
  beginTurn(false);
}
function gameOver(winner, why) {
  game.phase = 'over'; game.started = false;
  const p = game.players[winner];
  $('#overTitle').textContent = game.mode === 'ai' ? (winner === 0 ? '이겼습니다' : '졌습니다') : `${p.name} 승리`;
  $('#overWhy').textContent = why;
  $('#over').hidden = false; hud(); snapshot();
}
function revive(id) { const m = ballMesh[id]; m.visible = true; m.scale.setScalar(1); for (let i = falls.length - 1; i >= 0; i--) if (falls[i].id === id) falls.splice(i, 1); }

/* ================= computer player ================= */
function gauss() { let u = 0; for (let i = 0; i < 6; i++) u += Math.random(); return (u - 3) / Math.sqrt(0.5); }
function simShot(angle, V, cpos) {
  const w2 = PHYS.clone(game.world);
  if (cpos) { w2.balls[0].x = cpos[0]; w2.balls[0].y = cpos[1]; }
  PHYS.strike(w2, angle, V, 0, 0);
  return PHYS.run(w2, 20);
}
function aiPlan() {
  const w = game.world, c = w.balls[0], lvl = game.level, ctx = ctxNow();
  if (game.isBreak) {
    const y = (Math.random() - 0.5) * 0.36, pos = [-HL / 2 - 0.1, y];
    return { pos, angle: Math.atan2(-y * 0.9, HL / 2 - pos[0]) + gauss() * 0.004, power: 0.93 + Math.random() * 0.07 };
  }
  const targets = legalTargets(game.turn), cands = [];
  for (const t of targets) for (const p of POCKETS) {
    const T = w.balls[t]; let dx = p.ax - T.x, dy = p.ay - T.y; const dTP = Math.hypot(dx, dy); dx /= dTP; dy /= dTP;
    if (dx * p.nx + dy * p.ny < (p.corner ? 0.3 : 0.55)) continue;
    if (!PHYS.pathClear(w, T.x, T.y, p.ax, p.ay, [0, t])) continue;
    const gx = T.x - dx * 2 * R, gy = T.y - dy * 2 * R;
    if (Math.abs(gx) > HL - R || Math.abs(gy) > HW - R) continue;
    const spots = [];
    if (game.placing) {
      for (const dist of [0.32, 0.5, 0.75]) for (const da of [0, 0.3, -0.3, 0.55, -0.55]) {
        const ca = Math.cos(da), sa = Math.sin(da), px = gx - (dx * ca - dy * sa) * dist, py = gy - (dx * sa + dy * ca) * dist;
        if (PHYS.isFree(w, px, py, 0)) spots.push([px, py]);
      }
    } else spots.push([c.x, c.y]);
    for (const s of spots) {
      let cx = gx - s[0], cy = gy - s[1]; const dCG = Math.hypot(cx, cy); if (dCG < 1e-4) continue; cx /= dCG; cy /= dCG;
      const cosc = cx * dx + cy * dy; if (cosc < 0.3) continue;
      if (!PHYS.pathClear(w, s[0], s[1], gx, gy, [0, t])) continue;
      cands.push({ t, pos: game.placing ? s : null, angle: Math.atan2(cy, cx), cosc, dCG, dTP, score: (dCG * 0.6 + 0.3) * (dTP + 0.25) / (cosc * cosc) * (p.corner ? 1 : 1.15) });
    }
  }
  cands.sort((a, b) => a.score - b.score);
  const noise = [0.014, 0.0055, 0.0016][lvl];
  const speed = k => Math.min(6.4, Math.max(1.3, (1.0 + 1.5 * Math.sqrt(k.dTP)) / Math.max(0.4, k.cosc) + 0.9 * Math.sqrt(k.dCG)));
  const toPower = V => Math.pow(Math.max(0.01, (V - 0.35) / 7.4), 1 / 1.35);
  const good = ev => { const r = evaluate(ev, ctx); return !r.foul && (r.win == null || r.win === game.turn) && (r.keep || r.win === game.turn); };
  let pick = null;
  if (cands.length) {
    if (lvl === 0) { const k = cands[Math.min(cands.length - 1, Math.floor(Math.random() * 2))]; pick = { k, angle: k.angle, V: speed(k) }; }
    else {
      const top = cands.slice(0, lvl === 2 ? 10 : 5);
      outer: for (const k of top) for (const m of [1, 0.78, 1.3]) for (const da of [0, 0.003, -0.003]) {
        const V = Math.min(6.6, speed(k) * m);
        if (good(simShot(k.angle + da, V, k.pos))) { pick = { k, angle: k.angle + da, V }; break outer; }
      }
      if (!pick) { const k = cands[0]; pick = { k, angle: k.angle, V: speed(k) }; }
    }
    return { pos: pick.k.pos, angle: pick.angle + gauss() * noise, power: toPower(pick.V) };
  }
  // no clear pot: find any legal contact, preferring one that leaves no foul
  let pos = null;
  if (game.placing) { const T = w.balls[targets[0]]; pos = PHYS.findFree(w, T.x - 0.3 * Math.sign(T.x || 1), T.y, 0); }
  let fallback = null;
  for (let i = 0; i < 90; i++) {
    const a = i * Math.PI / 45, r = evaluate(simShot(a, 2.6, pos), ctx);
    if (!r.foul && r.win == null) return { pos, angle: a + gauss() * noise, power: toPower(2.6) };
    if (!fallback && !r.scratch && r.win == null) fallback = a;
  }
  return { pos, angle: fallback != null ? fallback : Math.random() * 6.28, power: toPower(2.4) };
}
function aiTick(dt) {
  const a = game.ai; a.t += dt;
  if (!a.plan) {
    if (a.t < 0.55) return;
    a.plan = aiPlan(); a.t0 = a.t;
    if (a.plan.pos) { const c = game.world.balls[0]; c.x = a.plan.pos[0]; c.y = a.plan.pos[1]; game.placing = null; }
    let d = a.plan.angle - a.from; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; a.delta = d;
    return;
  }
  const t = a.t - a.t0, e = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
  game.aim = a.from + a.delta * e(t / 0.8);
  game.power = a.plan.power * e((t - 0.95) / 0.5); setPowerUI(game.power);
  if (t > 1.6) { game.aim = a.plan.angle; game.ai = null; shoot(a.plan.power, { a: 0, b: 0 }); }
}

/* ================= input ================= */
let drag = null;
function humanAiming() { return game.phase === 'aim' && !game.players[game.turn].ai; }
function tryPlace(p) {
  const w = game.world, c = w.balls[0];
  let x = Math.max(-HL + R, Math.min(HL - R, p.x)), y = Math.max(-HW + R, Math.min(HW - R, p.y));
  if (game.placing === 'kitchen') x = Math.min(x, -HL / 2);
  if (PHYS.isFree(w, x, y, 0)) { c.x = x; c.y = y; return; }
  for (const b of w.balls) {
    if (!b.on || b.id === 0) continue;
    const d = Math.hypot(x - b.x, y - b.y);
    if (d < 2 * R + 0.001 && d > 1e-6) { const k = (2 * R + 0.0012) / d, nx = b.x + (x - b.x) * k, ny = b.y + (y - b.y) * k; if (PHYS.isFree(w, nx, ny, 0) && (game.placing !== 'kitchen' || nx <= -HL / 2)) { c.x = nx; c.y = ny; } return; }
  }
}
canvas.addEventListener('pointerdown', e => {
  SND.init(); if (!humanAiming()) return;
  const p = toTable(e), c = game.world.balls[0], d = Math.hypot(p.x - c.x, p.y - c.y);
  try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  if (game.placing && d < Math.max(0.075, 26 / ppm)) drag = { kind: 'cue', id: e.pointerId };
  else drag = { kind: 'aim', id: e.pointerId, last: Math.atan2(p.y - c.y, p.x - c.x), sx: e.clientX, sy: e.clientY, moved: 0 };
  e.preventDefault();
});
canvas.addEventListener('pointermove', e => {
  if (!drag || drag.id !== e.pointerId || !humanAiming()) return;
  const p = toTable(e), c = game.world.balls[0];
  if (drag.kind === 'cue') tryPlace(p);
  else {
    drag.moved = Math.max(drag.moved, Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy));
    const a = Math.atan2(p.y - c.y, p.x - c.x);
    if (Math.hypot(p.x - c.x, p.y - c.y) > 0.07 && drag.moved > 6) {
      let da = a - drag.last; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      game.aim += da;
    }
    drag.last = a;
  }
  invalidate();
});
const endDrag = e => {
  if (!drag || drag.id !== e.pointerId) return;
  if (drag.kind === 'aim' && drag.moved <= 6 && humanAiming()) { const p = toTable(e), c = game.world.balls[0]; if (Math.hypot(p.x - c.x, p.y - c.y) > R) game.aim = Math.atan2(p.y - c.y, p.x - c.x); }
  drag = null; invalidate(); snapshot();
};
canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);

(function powerCtl() {
  const el = $('#power'); let id = null;
  const read = e => { const r = el.getBoundingClientRect(); return Math.max(0, Math.min(1, portrait ? (e.clientX - r.left - 30) / (r.width - 60) : (e.clientY - r.top - 26) / (r.height - 52))); };
  el.addEventListener('pointerdown', e => { SND.init(); if (!humanAiming()) return; id = e.pointerId; try { el.setPointerCapture(id); } catch (err) {} game.power = read(e); setPowerUI(game.power); invalidate(); e.preventDefault(); });
  el.addEventListener('pointermove', e => { if (id !== e.pointerId) return; game.power = read(e); setPowerUI(game.power); invalidate(); });
  const up = (e, cancel) => {
    if (id !== e.pointerId) return; id = null;
    const p = game.power;
    if (!cancel && p > 0.03 && humanAiming()) shoot(p); else { game.power = 0; setPowerUI(0); }
    invalidate();
  };
  el.addEventListener('pointerup', e => up(e, false)); el.addEventListener('pointercancel', e => up(e, true));
})();
(function fineCtl() {
  const el = $('#fine'); let id = null, last = 0, off = 0;
  const pos = e => portrait ? e.clientX : e.clientY;
  el.addEventListener('pointerdown', e => { SND.init(); if (!humanAiming()) return; id = e.pointerId; last = pos(e); try { el.setPointerCapture(id); } catch (err) {} e.preventDefault(); });
  el.addEventListener('pointermove', e => {
    if (id !== e.pointerId) return; const d = pos(e) - last; last = pos(e);
    game.aim += d * 0.0009 * (portrait ? -1 : 1); off += d;
    el.style.backgroundPosition = portrait ? `${off}px 0` : `0 ${off}px`; invalidate();
  });
  const up = e => { if (id === e.pointerId) id = null; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
})();
(function spinCtl() {
  const sheet = $('#spinSheet'), pad = $('#spinPad');
  $('#spinBtn').addEventListener('click', () => { if (!humanAiming()) return; sheet.hidden = false; setSpinUI(); });
  const set = e => {
    const r = pad.getBoundingClientRect(); let x = (e.clientX - r.left) / r.width * 2 - 1, y = -((e.clientY - r.top) / r.height * 2 - 1);
    x /= 0.72; y /= 0.72; const m = Math.hypot(x, y); if (m > 1) { x /= m; y /= m; }
    game.spin = { x, y }; setSpinUI();
  };
  let id = null;
  pad.addEventListener('pointerdown', e => { id = e.pointerId; try { pad.setPointerCapture(id); } catch (err) {} set(e); e.preventDefault(); });
  pad.addEventListener('pointermove', e => { if (id === e.pointerId) set(e); });
  pad.addEventListener('pointerup', () => { id = null; }); pad.addEventListener('pointercancel', () => { id = null; });
  $('#spinReset').addEventListener('click', () => { game.spin = { x: 0, y: 0 }; setSpinUI(); });
  $('#spinOk').addEventListener('click', () => { sheet.hidden = true; });
  sheet.addEventListener('click', e => { if (e.target === sheet) sheet.hidden = true; });
})();
(function menuCtl() {
  const seg = (id, get, set) => {
    const el = $(id), paint = () => { for (const b of el.children) b.setAttribute('aria-pressed', String(b.dataset.v === String(get()))); };
    el.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; set(b.dataset.v); paint(); }); paint();
  };
  const lvl = () => { $('#lvlField').hidden = game.mode !== 'ai'; };
  seg('#segMode', () => game.mode, v => { game.mode = v; store.set('mode', v); lvl(); });
  seg('#segLvl', () => game.level, v => { game.level = +v; store.set('level', +v); });
  seg('#segSnd', () => game.sound ? 1 : 0, v => { game.sound = v === '1'; store.set('sound', game.sound); if (game.sound) SND.init(); });
  lvl();
  let prev = 'aim';
  const open = () => { prev = game.phase; $('#resumeBtn').hidden = !game.started; $('#startBtn').textContent = game.started ? '새 게임' : '게임 시작'; $('#menu').hidden = false; };
  $('#menuBtn').addEventListener('click', open);
  $('#resumeBtn').addEventListener('click', () => { $('#menu').hidden = true; });
  $('#startBtn').addEventListener('click', () => { SND.init(); newGame(); });
  $('#againBtn').addEventListener('click', () => { SND.init(); newGame(); });
  $('#overMenu').addEventListener('click', () => { $('#over').hidden = true; open(); });
})();
document.addEventListener('contextmenu', e => e.preventDefault());

/* ================= frame loop ================= */
const falls = [];
let lastT = 0, acc = 0;
function drain() {
  const s = game.world.snd; if (!s.length) return;
  for (const e of s) {
    if (e.t === 'ball') SND.ball(e.v); else if (e.t === 'rail') SND.rail(e.v);
    else if (e.t === 'pocket') { SND.pocket(); const b = game.world.balls[e.id], p = POCKETS[e.pocket]; falls.push({ id: e.id, t: 0, x0: b.x, y0: b.y, x1: p.x, y1: p.y }); }
  }
  s.length = 0;
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - lastT) / 1000 || 0); lastT = now;
  const w = game.world, menuUp = !$('#menu').hidden;
  if (game.phase === 'ai' && !menuUp) { aiTick(dt); dirty = 3; }
  if (game.phase === 'strike') {
    const ca = game.cueAnim; ca.t += dt; dirty = 3;
    if (ca.t >= 0.1) { PHYS.strike(w, game.aim, ca.V, ca.a, ca.b); SND.cue(ca.V); game.phase = 'sim'; acc = 0; game.power = 0; setPowerUI(0); }
  }
  if (game.phase === 'sim') {
    acc += dt; let n = 0;
    while (acc >= TICK && n < 14) { PHYS.step(w, TICK); acc -= TICK; n++; }
    drain(); dirty = 3;
    if (PHYS.rest(w) && !falls.length) endShot();
  }
  if (falls.length) dirty = 3;
  if (dirty <= 0) return; dirty--;

  for (let i = 0; i < 16; i++) {
    const b = w.balls[i], m = ballMesh[i], s = blobMesh[i];
    s.visible = b.on;
    if (b.on) {
      m.visible = true; m.position.set(b.x, b.y, R);
      const q = b.q, l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; q[0] /= l; q[1] /= l; q[2] /= l; q[3] /= l;
      m.quaternion.set(q[0], q[1], q[2], q[3]); s.position.x = b.x; s.position.y = b.y;
    }
  }
  for (let i = falls.length - 1; i >= 0; i--) {
    const f = falls[i], m = ballMesh[f.id]; f.t += dt; const k = Math.min(1, f.t / 0.22);
    m.position.set(f.x0 + (f.x1 - f.x0) * k, f.y0 + (f.y1 - f.y0) * k, R - k * k * 0.13);
    if (k >= 1) { m.visible = false; falls.splice(i, 1); if (game.phase !== 'sim') hud(); }
  }
  // cue + guide
  const c = w.balls[0], showAim = (game.phase === 'aim' || (game.phase === 'ai' && game.ai && game.ai.plan) || game.phase === 'strike') && c.on;
  cue.visible = showAim; guide.visible = showAim && game.phase !== 'strike';
  if (showAim) {
    const dx = Math.cos(game.aim), dy = Math.sin(game.aim);
    let pull = 0.03 + game.power * 0.2;
    if (game.phase === 'strike') { const k = Math.min(1, game.cueAnim.t / 0.1); pull = game.cueAnim.from * (1 - k * k) - 0.004 * k; }
    cue.position.set(c.x - dx * (R + pull), c.y - dy * (R + pull), R + 0.002);
    cue.rotation.set(0, -0.085, game.aim + Math.PI);
    const pr = PHYS.predict(w, game.aim);
    setLine(gLine, c.x + dx * R, c.y + dy * R, pr.gx - dx * R * 0.9, pr.gy - dy * R * 0.9, 1.6);
    gRing.visible = pr.type !== 'none' && pr.type !== 'pocket'; gRing.position.set(pr.gx, pr.gy, R);
    if (pr.type === 'ball') {
      const b = w.balls[pr.ball], co = Math.cos(pr.cut), l1 = 0.06 + 0.26 * co;
      setLine(gObj, b.x + pr.nx * R, b.y + pr.ny * R, b.x + pr.nx * (R + l1), b.y + pr.ny * (R + l1), 2);
      let tx = dx - co * pr.nx, ty = dy - co * pr.ny; const tl = Math.hypot(tx, ty);
      if (tl > 0.02) { tx /= tl; ty /= tl; const l2 = 0.3 * tl; setLine(gCue, pr.gx + tx * R, pr.gy + ty * R, pr.gx + tx * (R + l2), pr.gy + ty * (R + l2), 1.4); } else gCue.visible = false;
      const legal = legalTargets(game.turn).includes(pr.ball);
      gRing.material.color.set(legal ? 0xffffff : 0xff6a58); gObj.material.color.set(legal ? 0xffffff : 0xff6a58);
    } else if (pr.type === 'rail') {
      const dn = dx * pr.nx + dy * pr.ny, rx = dx - 2 * dn * pr.nx, ry = dy - 2 * dn * pr.ny;
      setLine(gObj, pr.gx, pr.gy, pr.gx + rx * 0.22, pr.gy + ry * 0.22, 1.4); gObj.material.color.set(0xffffff); gRing.material.color.set(0xffffff); gCue.visible = false;
    } else { gObj.visible = false; gCue.visible = false; }
    gHand.visible = !!game.placing && game.phase === 'aim'; gHand.position.set(c.x, c.y, R);
  }
  renderer.render(scene, camera);
  // drop resolution a notch if this device can't keep up
  if (dt > 0.034 && dt < 0.1) { if (++slow > 45 && quality > 0.4) { quality *= 0.8; slow = 0; layout(); } } else if (slow > 0) slow--;
}

/* ================= keep the game across a live update ================= */
function serialize() {
  const w = game.world;
  return { v: 1, balls: w.balls.map(b => [b.x, b.y, b.on ? 1 : 0, b.q.slice()]), turn: game.turn, players: game.players, isBreak: game.isBreak, placing: game.placing, aim: game.aim, started: game.started, mode: game.mode, level: game.level };
}
function snapshot() { const d = serialize(); store.set('save', d); try { const h = window.claude && window.claude.hot; if (h && h.snapshot) h.snapshot(d); } catch (e) {} }
function start(data) {
  layout(); setSpinUI();
  if (!(data && data.v === 1)) data = store.get('save', null);
  if (data && data.v === 1 && data.started && Array.isArray(data.balls) && data.balls.length === 16) {
    data.balls.forEach((s, i) => { const b = game.world.balls[i]; b.x = s[0]; b.y = s[1]; b.on = !!s[2]; b.q = s[3]; ballMesh[i].visible = b.on; });
    game.players = data.players; game.turn = data.turn; game.isBreak = data.isBreak; game.placing = data.placing; game.aim = data.aim; game.mode = data.mode; game.level = data.level;
    game.started = true; $('#menu').hidden = true; beginTurn(true);
  } else hud();
  requestAnimationFrame(frame);
}
window.__dp8 = { game, newGame, evaluate, aiPlan, shoot, endShot, ctxNow, remaining };
const hot = window.claude && window.claude.hot;
if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
})();
