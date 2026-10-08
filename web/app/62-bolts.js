/* ================= fast play: lightning round the edge of the screen while a shot runs at double speed ================= */
/* A few short bolts at a time, each a jagged run hugging a stretch of the screen's edge, struck afresh every few frames, over
   a faint glow along the border. Thin and at the very edge, so the table stays clear. */
const bolts = (() => {
  const cv = el('canvas', { class: 'bolts' }), g = cv.getContext('2d'); app.appendChild(cv);
  let on = false, raf = 0, segs = [], next = 0;
  // a point `u` pixels round the edge (clockwise from the top-left), with the way into the screen there
  const edgeAt = (u, W, H) => u < W ? [u, 0, 0, 1] : u < W + H ? [W, u - W, -1, 0] : u < 2 * W + H ? [2 * W + H - u, H, 0, -1] : [0, 2 * (W + H) - u, 1, 0];
  function strike(W, H) {
    segs = []; const per = 2 * (W + H), n = 3 + Math.floor(Math.random() * 3);
    for (let k = 0; k < n; k++) {
      const start = Math.random() * per, len = 90 + Math.random() * 240, pts = [];
      for (let d = 0; d <= len; d += 10) { const p = edgeAt((start + d) % per, W, H), j = 3 + Math.random() * 9; pts.push([p[0] + p[2] * j + (Math.random() - 0.5) * 4 * Math.abs(p[3]), p[1] + p[3] * j + (Math.random() - 0.5) * 4 * Math.abs(p[2])]); }
      segs.push(pts);
    }
  }
  function draw(now) {
    raf = 0; if (!on) { g.clearRect(0, 0, cv.width, cv.height); return; }
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = app.clientWidth, H = app.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    if (now > next) { strike(W, H); next = now + 60 + Math.random() * 70; }
    g.strokeStyle = 'rgba(70,160,255,.3)'; g.lineWidth = 5; g.shadowColor = '#2f8cff'; g.shadowBlur = 14; g.strokeRect(2.5, 2.5, W - 5, H - 5);
    for (const pts of segs) for (const [w, c] of [[2.6, 'rgba(60,150,255,.85)'], [1, 'rgba(255,255,255,.95)']]) {
      g.lineWidth = w; g.strokeStyle = c; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
    }
    g.shadowBlur = 0;
    raf = requestAnimationFrame(draw);
  }
  return { set(v) { if (v === on) return; on = v; cv.classList.toggle('on', v); if (v && !raf) raf = requestAnimationFrame(draw); } };
})();
