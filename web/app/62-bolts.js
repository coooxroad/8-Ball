/* ================= fast play: the screen's edge turns electric while a shot runs at double speed ================= */
/* Made the way the win-streak flame is: one effect the shape of the whole edge, drawn afresh every frame. Two crackling
   strands of current run all the way round, never still - each point of them sits as far in from the edge as a fast-moving
   noise says, roughened every frame so it crackles rather than flows. Now and then the current forks: a short branch jabs in
   from the edge and dies within a fifth of a second. Three layers - a blue haze, a cyan arc, a white-hot core - and the whole
   thing flickers. It keeps to a band a couple of centimetres wide at the very edge, so the table stays clear. */
const bolts = (() => {
  const cv = el('canvas', { class: 'bolts' }), g = cv.getContext('2d'); app.appendChild(cv);
  let on = false, raf = 0, forks = [], last = 0;
  const STEP = 5, BAND = 16;
  // the edge, clockwise from the top-left corner, as [x, y, inward x, inward y] every STEP pixels
  function edge(W, H) {
    const P = [], add = (x, y, nx, ny) => P.push([x, y, nx, ny]);
    for (let x = 0; x < W; x += STEP) add(x, 0, 0, 1);
    for (let y = 0; y < H; y += STEP) add(W, y, -1, 0);
    for (let x = W; x > 0; x -= STEP) add(x, H, 0, -1);
    for (let y = H; y > 0; y -= STEP) add(0, y, 1, 0);
    return P;
  }
  // a branch: a zigzag from a point on the edge, inwards and a little sideways
  function fork(P) {
    const p = P[Math.floor(Math.random() * P.length)], len = 18 + Math.random() * 46, side = (Math.random() - 0.5) * 1.2, pts = [[p[0], p[1]]];
    let x = p[0], y = p[1];
    for (let d = 0; d < len; d += 6) { x += p[2] * 6 + p[3] * side * 6 + (Math.random() - 0.5) * 7 * (p[3] ? 1 : 0.4); y += p[3] * 6 + p[2] * side * 6 + (Math.random() - 0.5) * 7 * (p[2] ? 1 : 0.4); pts.push([x, y]); }
    return { pts, born: performance.now(), life: 110 + Math.random() * 120 };
  }
  function stroke(pts, layers, alpha) {
    for (const [w, col, blur] of layers) {
      g.lineWidth = w; g.strokeStyle = col; g.shadowBlur = blur; g.globalAlpha = alpha;
      g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
    }
  }
  const LAYERS = [[7, 'rgba(70,120,255,.28)', 18], [2.4, 'rgba(110,205,255,.9)', 8], [1, '#ffffff', 0]];
  function draw(now) {
    raf = 0; if (!on) { g.clearRect(0, 0, cv.width, cv.height); forks = []; return; }
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = app.clientWidth, H = app.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H); g.lineJoin = 'round'; g.shadowColor = '#4f9dff';
    const t = now / 1000, P = edge(W, H), n = P.length, flick = 0.62 + 0.38 * fnoise(t * 9, 3.7);
    // a faint glow along the whole edge, breathing with the flicker
    g.globalAlpha = 0.5 * flick; g.lineWidth = 4; g.strokeStyle = 'rgba(80,150,255,.35)'; g.shadowBlur = 16; g.strokeRect(1, 1, W - 2, H - 2);
    // the two strands of current, all the way round
    for (let s = 0; s < 2; s++) {
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const p = P[i % n], u = (i % n) * STEP / 40;
        const wave = fnoise(u + s * 17, t * (7 + s * 3)) * 0.65 + fnoise(u * 3.1 + s * 5, t * 13) * 0.35;      // where it runs, and how fast that changes
        const d = 2 + BAND * wave * (0.55 + 0.45 * fnoise(u * 0.3 + 40, t * 1.5)) + (Math.random() - 0.5) * 3;   // + the crackle
        pts.push([p[0] + p[2] * d, p[1] + p[3] * d]);
      }
      stroke(pts, LAYERS, (s ? 0.55 : 0.85) * flick);
    }
    // forks: a few a second, each gone in a moment
    if (now - last > 90 && Math.random() < 0.55) { forks.push(fork(P)); last = now; }
    forks = forks.filter(f => now - f.born < f.life);
    for (const f of forks) stroke(f.pts, LAYERS, (1 - (now - f.born) / f.life) * flick);
    g.globalAlpha = 1; g.shadowBlur = 0;
    raf = requestAnimationFrame(draw);
  }
  return { set(v) { if (v === on) return; on = v; cv.classList.toggle('on', v); if (v && !raf) raf = requestAnimationFrame(draw); } };
})();
