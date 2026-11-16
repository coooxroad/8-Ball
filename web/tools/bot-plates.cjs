/* 컴퓨터 대전's bot cards (owner 11-16: lines drawn on a colour are not metal - make them really of the tier's metal): one
   plate per tier, rendered once with the game's own three.js in a headless browser - a rounded plate with a bevel, brushed,
   reflecting a soft room of bright panels as the tier balls do (tier-balls.cjs) - and kept as web/ui/bot-plate-<tier>.webp
   (300 × 420, the card's shape). Run again after changing a metal:   node web/tools/bot-plates.cjs   (needs playwright) */
const fs = require('fs'), path = require('path');
const pw = (() => { try { return require('playwright'); } catch (e) { return require('playwright-core'); } })();
const W = path.join(__dirname, '..'), OUT = path.join(W, 'ui');
// [tier, metal colour, roughness, brushing]
const METALS = [
  ['bronze', '#b8794a', 0.34, 0.5], ['silver', '#d4d9e0', 0.26, 0.6], ['gold', '#e8b94e', 0.24, 0.45],
  ['platinum', '#b4e4de', 0.27, 0.4], ['diamond', '#c2e2ff', 0.25, 0.3], ['pro', '#3a332c', 0.24, 0.35],
];
const page = `<!doctype html><html><body style="margin:0;background:transparent"><canvas id="c" width="300" height="420"></canvas>
<script>${fs.readFileSync(path.join(W, 'three.min.js'), 'utf8')}</script>
<script>
window.render = (color, rough, brush, tier) => {
  const c = document.getElementById('c'), r = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1); r.setSize(300, 420, false); r.outputEncoding = THREE.sRGBEncoding; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0;
  const room = new THREE.Scene(); room.add(new THREE.Mesh(new THREE.BoxGeometry(10, 10, 10), new THREE.MeshBasicMaterial({ color: 0x0c0b0a, side: THREE.BackSide })));
  const panel = (w, h, x, y, z, k) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(k, k * 0.97, k * 0.92), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); room.add(m); };
  // (a flat plate mirrors what is in front of it: a bright band high up and to the right fading down to a dark floor - the
  // gradient that reads as polished metal - and a thin second band low down for the bevel to catch)
  panel(5, 2.4, 2.4, 2.8, 4.2, 5); panel(4, 1.1, -2.6, 1.2, 4.6, 1.2); panel(12, 0.3, 0, -1.9, 4.8, 2.2); panel(1.6, 6, 4.9, 0.5, 1.5, 1.6);
  const pm = new THREE.PMREMGenerator(r), env = pm.fromScene(room, 0.02).texture;
  // brushed: fine streaks across, in the roughness (green) - metal everywhere (blue)
  const t = document.createElement('canvas'); t.width = 2048; t.height = 2048; const g = t.getContext('2d');
  g.fillStyle = 'rgb(0,' + Math.round(rough * 255) + ',255)'; g.fillRect(0, 0, 2048, 2048); g.globalAlpha = 0.5;
  for (let i = 0; i < 14000; i++) { const y = Math.random() * 2048, v = Math.round(Math.max(0, Math.min(1, rough + (Math.random() - 0.5) * brush * 0.22)) * 255); g.fillStyle = 'rgb(0,' + v + ',255)'; g.fillRect(Math.random() * 2048 - 400, y, 400 + Math.random() * 1600, 1); }
  const mr = new THREE.CanvasTexture(t);
  // (a flat plate mirrors one direction all over - one flat colour: a gentle pillow in the normals, so the light sweeps across
  // it as across a pressed metal plate, and the brushing in them too)
  const nt = document.createElement('canvas'); nt.width = nt.height = 512; const ng = nt.getContext('2d'), img = ng.createImageData(512, 512);
  for (let j = 0; j < 512; j++) { const streak = (Math.random() - 0.5) * 0.06 * brush; for (let i = 0; i < 512; i++) {
    const u = i / 255.5 - 1, v = 1 - j / 255.5, nx = -0.42 * u * Math.abs(u) ** 0.6, ny = -0.3 * v * Math.abs(v) ** 0.6 + streak, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)), o = (j * 512 + i) * 4;
    img.data[o] = (nx + 1) * 127.5; img.data[o + 1] = (ny + 1) * 127.5; img.data[o + 2] = (nz + 1) * 127.5; img.data[o + 3] = 255; } }
  ng.putImageData(img, 0, 0); const nm = new THREE.CanvasTexture(nt);
  const w = 1.5, h = 2.1, rad = 0.16, s = new THREE.Shape();
  s.moveTo(-w / 2 + rad, -h / 2); s.lineTo(w / 2 - rad, -h / 2); s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + rad); s.lineTo(w / 2, h / 2 - rad); s.quadraticCurveTo(w / 2, h / 2, w / 2 - rad, h / 2);
  s.lineTo(-w / 2 + rad, h / 2); s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - rad); s.lineTo(-w / 2, -h / 2 + rad); s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + rad, -h / 2);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 8, curveSegments: 24 });
  // the face's UVs over the plate (ExtrudeGeometry gives the shape's own x, y)
  const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + w / 2) / w, (uv.getY(i) + h / 2) / h);
  const mat = new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: 1, metalnessMap: mr, roughnessMap: mr, normalMap: nm, normalScale: new THREE.Vector2(1, 1), envMap: env, envMapIntensity: 1.5 });
  const plate = new THREE.Mesh(geo, mat); plate.rotation.set(-0.12, 0.16, 0); const sc = new THREE.Scene(); sc.add(plate);
  // pro: a gold line inside the edge
  // (pro: its gold line is drawn over it by the card - 85-train.css)
  const key = new THREE.DirectionalLight(0xfff2e0, 1.2); key.position.set(3, 4, 3); sc.add(key); sc.add(new THREE.AmbientLight(0xffffff, 0.15));
  const cam = new THREE.PerspectiveCamera(30, 300 / 420, 0.1, 20); cam.position.set(0, 0, 4.55); cam.lookAt(0, 0, 0);
  r.setClearColor(0x000000, 0); r.render(sc, cam); return c.toDataURL('image/png');
};
</script></body></html>`;
(async () => {
  const b = await pw.chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage(); await p.setContent(page);
  for (const [id, color, rough, brush] of METALS) {
    const url = await p.evaluate(([c, r, br, t]) => window.render(c, r, br, t), [color, rough, brush, id]);
    fs.writeFileSync(path.join(OUT, `bot-plate-${id}.png`), Buffer.from(url.split(',')[1], 'base64')); console.log('plate', id, '(then: webp q86 as web/ui/bot-plate-' + id + '.webp)');
  }
  await b.close();
})();
