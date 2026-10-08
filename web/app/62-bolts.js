/* ================= fast play: an electric frame round the screen while a shot runs at double speed ================= */
/* Clean, like the win-streak card: a thin blue-white line round the edge of the screen with a soft glow, standing still.
   Every second or so the current jumps: a short jagged bolt cracks along a stretch of the edge with a branch or two
   stabbing inwards and a spark where it struck, flickers off and on once, and is gone in a fifth of a second.
   Cheap on purpose: the frame is CSS, and the canvas is only drawn on while a bolt is alive. */
const bolts = (() => {
  const frame = el('div', { class: 'zap' }), cv = el('canvas', { class: 'zapcv' }), g = cv.getContext('2d');
  app.appendChild(frame); app.appendChild(cv);
  let on = false, timer = 0, raf = 0, bolt = null;
  const jag = (x, y, dx, dy, nx, ny, len, amp, step) => {        // a zigzag from (x, y) along (dx, dy), kicked sideways along (nx, ny)
    const pts = [[x, y]];
    for (let d = step; d <= len; d += step) { const k = (Math.random() - 0.5) * 2 * amp; pts.push([x + dx * d + nx * k, y + dy * d + ny * k]); }
    return pts;
  };
  function strike() {
    timer = 0; if (!on) return;
    const W = app.clientWidth, H = app.clientHeight, side = Math.floor(Math.random() * 4), across = side % 2 ? H : W;
    const at = 40 + Math.random() * (across - 80), len = 70 + Math.random() * 120, dir = Math.random() < 0.5 ? 1 : -1;
    // where on the edge, which way along it, and which way is in
    const [x0, y0, ax, ay, ix, iy] = [[at, 3, dir, 0, 0, 1], [W - 3, at, 0, dir, -1, 0], [at, H - 3, dir, 0, 0, -1], [3, at, 0, dir, 1, 0]][side];
    const main = jag(x0, y0, ax, ay, ix, iy, len, 6, 8).map(p => [p[0] + ix * 5, p[1] + iy * 5]);
    const branches = [];
    for (let k = 0; k < 1 + Math.floor(Math.random() * 3); k++) {
      const p = main[1 + Math.floor(Math.random() * (main.length - 2))], l = 16 + Math.random() * 34, s = (Math.random() - 0.5) * 0.9;
      branches.push(jag(p[0], p[1], ix + ax * s, iy + ay * s, ax, ay, l, 4, 6));
    }
    bolt = { main, branches, spark: main[Math.floor(Math.random() * main.length)], born: performance.now(), life: 210 };
    frame.classList.remove('kick'); void frame.offsetWidth; frame.classList.add('kick');
    if (!raf) raf = requestAnimationFrame(draw);
  }
  function line(pts, w, col) { g.lineWidth = w; g.strokeStyle = col; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); }
  function draw(now) {
    raf = 0;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1), W = app.clientWidth, H = app.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    if (!bolt || !on) { bolt = null; if (on && !timer) timer = setTimeout(strike, 500 + Math.random() * 1100); return; }
    const k = (now - bolt.born) / bolt.life;
    if (k >= 1) { bolt = null; if (on) timer = setTimeout(strike, 500 + Math.random() * 1100); return; }
    // lightning flickers: bright, almost out, bright again, then fading
    const a = k < 0.22 ? 1 : k < 0.36 ? 0.15 : k < 0.55 ? 0.95 : (1 - k) / 0.45 * 0.95;
    g.globalAlpha = a; g.lineJoin = 'round'; g.lineCap = 'round';
    for (const pts of [bolt.main].concat(bolt.branches)) { const main = pts === bolt.main; line(pts, main ? 8 : 5, 'rgba(80,150,255,.28)'); line(pts, main ? 2.6 : 1.6, 'rgba(160,220,255,.95)'); line(pts, main ? 1.1 : 0.7, '#fff'); }
    // the spark where it struck: a white-hot point with a blue halo
    const [sx, sy] = bolt.spark, r = 14 * (1 - k * 0.5), gr = g.createRadialGradient(sx, sy, 0, sx, sy, r);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(170,220,255,.8)'); gr.addColorStop(1, 'rgba(80,150,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(sx, sy, r, 0, 6.3); g.fill();
    g.globalAlpha = 1;
    raf = requestAnimationFrame(draw);
  }
  return {
    set(v) {
      if (v === on) return; on = v; frame.classList.toggle('on', v); cv.classList.toggle('on', v);
      clearTimeout(timer); timer = 0;
      if (v) timer = setTimeout(strike, 120); else { bolt = null; if (!raf) raf = requestAnimationFrame(draw); }
    },
  };
})();
