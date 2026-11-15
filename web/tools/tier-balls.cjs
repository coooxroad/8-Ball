/* The 선수증's tier ball (owner 11-16: no laurel - a 3D 8 ball made of the tier's metal): one picture per tier, rendered
   once with the game's own three.js in a headless browser and kept as web/ui/tier-ball-<tier>.webp (512², transparent).
   Run again after changing a metal below:   node web/tools/tier-balls.cjs   (needs playwright; CHROME=<path> optional)
   Each ball: the tier's metal (metalness 1, its own roughness), a white enamel disc with a black 8 on it (not metal),
   lit as the game is - the light from the upper right - and reflecting a soft room of bright panels. */
const fs = require('fs'), path = require('path');
const pw = (() => { try { return require('playwright'); } catch (e) { return require('playwright-core'); } })();
const W = path.join(__dirname, '..'), OUT = path.join(W, 'ui');
// [tier, metal colour, roughness, rim colour of the disc]
const METALS = [
  ['bronze', '#b8794a', 0.32, '#5a3418'],
  ['silver', '#d4d9e0', 0.22, '#5b6470'],
  ['gold', '#e8b94e', 0.22, '#6b4a10'],
  ['platinum', '#a9ddd7', 0.18, '#2f6f69'],
  ['diamond', '#9fcaff', 0.12, '#1d4f9a'],
  ['pro', '#3a332c', 0.16, '#c39a45'],
];
const page = `<!doctype html><html><body style="margin:0;background:transparent"><canvas id="c" width="512" height="512"></canvas>
<script>${fs.readFileSync(path.join(W, 'three.min.js'), 'utf8')}</script>
<script>
window.render = (color, rough, rim) => {
  const c = document.getElementById('c'), r = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1); r.setSize(512, 512, false); r.outputEncoding = THREE.sRGBEncoding; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.3;
  // the room it reflects: a dim box with bright panels - the big one up and to the right, as the game's light
  const room = new THREE.Scene(), box = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial({ color: 0x221e1a, side: THREE.BackSide })); room.add(box);
  const panel = (w, h, x, y, z, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k * 0.97, k * 0.92), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); room.add(m); };
  panel(4.5, 2.6, 3.2, 3.6, 2.6, 9); panel(3, 1.6, -3.6, 2.4, 1.8, 2.2); panel(10, 0.7, 0, -1.2, 4.6, 2.4); panel(1.6, 4, 4.6, 0, -1.5, 3); panel(5, 1.2, 0, 4.7, -1, 2.4); panel(10, 2.5, 0, -4.6, 0, 0.9);
  const pm = new THREE.PMREMGenerator(r), env = pm.fromScene(room, 0.02).texture;
  // the disc and the 8 on an equirectangular map (a circle in pixels is one on the ball near its middle), facing the camera
  const tex = (draw) => { const t = document.createElement('canvas'); t.width = 2048; t.height = 1024; const g = t.getContext('2d'); draw(g); const x = new THREE.CanvasTexture(t); x.anisotropy = 8; return x; };
  const cx = 0.25 * 2048, cy = 512, R = 112;
  const map = tex(g => { g.fillStyle = color; g.fillRect(0, 0, 2048, 1024); g.fillStyle = rim; g.beginPath(); g.arc(cx, cy, R + 10, 0, 7); g.fill(); g.fillStyle = '#f6f3ea'; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fill();
    g.fillStyle = '#16130f'; g.font = '900 164px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('8', cx, cy + 8); });
  map.encoding = THREE.sRGBEncoding;
  // metal everywhere but the disc (three r128 reads metalness from blue, roughness from green)
  const mr = tex(g => { g.fillStyle = 'rgb(0,255,255)'; g.fillRect(0, 0, 2048, 1024); g.fillStyle = 'rgb(0,110,0)'; g.beginPath(); g.arc(cx, cy, R + 4, 0, 7); g.fill(); });
  const mat = new THREE.MeshStandardMaterial({ map, metalness: 1, roughness: rough, metalnessMap: mr, roughnessMap: mr, envMap: env, envMapIntensity: 2.1 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 96), mat); ball.rotation.set(-0.3, -0.22, 0.06);
  const sc = new THREE.Scene(); sc.add(ball);
  const key = new THREE.DirectionalLight(0xfff2e0, 1.4); key.position.set(3, 4, 3); sc.add(key); sc.add(new THREE.AmbientLight(0xffffff, 0.12));
  const cam = new THREE.PerspectiveCamera(24, 1, 0.1, 50); cam.position.set(0, 0, 5.1); cam.lookAt(0, 0, 0);
  r.setClearColor(0x000000, 0); r.render(sc, cam);
  return c.toDataURL('image/png');
};
</script></body></html>`;
(async () => {
  const b = await pw.chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage(); await p.setContent(page);
  for (const [id, color, rough, rim] of METALS) {
    const url = await p.evaluate(([c, r, m]) => window.render(c, r, m), [color, rough, rim]);
    const png = Buffer.from(url.split(',')[1], 'base64'), f = path.join(OUT, `tier-ball-${id}.png`);
    fs.writeFileSync(f, png); console.log('tier ball', id, '(then: 384² webp q88 as web/ui/tier-ball-' + id + '.webp)');
  }
  await b.close();
})();
