/* ================= fast play: the sides of the screen turn to lightning while a shot runs at double speed ================= */
/* The lightning IS the border: down the left and the right edge of the screen runs a strand of current fastened to the edge,
   zigzagging out from it and back. Mostly it lies close and low; here and there a stretch flares - jumps further out, thicker
   and brighter - and those flares drift along the edge. The shape is struck afresh about fifteen times a second, so it
   crackles rather than flows, and every so often the whole thing flashes. White-hot core, pale-blue arc, blue haze.
   Cheap on purpose: two narrow canvases down the sides only, no shadow blur (the haze is a wide faint stroke), and they are
   redrawn only when the shape changes. */
const bolts = (() => {
  const W = 46, sides = [0, 1].map(k => { const c = el('canvas', { class: 'zap ' + (k ? 'r' : 'l') }); app.appendChild(c); return { c, g: c.getContext('2d') }; });
  let on = false, timer = 0, flash = 0, phase = 0;
  // where along the edge the flares are now: a few bumps that wander
  const flares = [{ at: 0.2, v: 0.11 }, { at: 0.65, v: -0.08 }, { at: 0.9, v: 0.06 }];
  function strand(H, amp, step, jit) {
    const pts = [];
    for (let y = -10; y <= H + 10; y += step * (0.6 + Math.random() * 0.8)) {
      let f = 0; for (const fl of flares) { const d = (y / H - fl.at) * 7; f = Math.max(f, Math.exp(-d * d)); }
      const reach = amp * (0.22 + 0.78 * f) * (1 + flash * 0.6);
      pts.push([2 + Math.random() * reach + (Math.random() < 0.08 ? reach * 0.6 : 0), y + (Math.random() - 0.5) * jit]);
    }
    return pts;
  }
  function line(g, pts, w, col) { g.lineWidth = w; g.strokeStyle = col; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); }
  function draw() {
    timer = 0; if (!on) return;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1), H = app.clientHeight;
    for (const fl of flares) { fl.at += fl.v * 0.07; if (fl.at < -0.1 || fl.at > 1.1) { fl.at = fl.v > 0 ? -0.1 : 1.1; } }
    if (flash > 0) flash -= 0.34; else if (Math.random() < 0.06) flash = 1;
    phase++;
    for (const [k, s] of sides.entries()) {
      const { c, g } = s;
      if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
      if (k) { g.translate(W, 0); g.scale(-1, 1); }                    // the right side is the left one mirrored (and struck separately)
      g.lineJoin = 'miter'; g.lineCap = 'round';
      const a = 0.75 + 0.25 * Math.random() + flash * 0.25;
      // the strand fastened to the edge: haze, arc, core
      const main = strand(H, 15, 13, 5);
      g.globalAlpha = Math.min(1, a);
      line(g, main, 11, 'rgba(60,130,255,.22)'); line(g, main, 4.2, 'rgba(130,200,255,.75)'); line(g, main, 1.7, '#fdfdff');
      // a second, finer strand crossing it, so it reads as current and not a line
      const fine = strand(H, 10, 19, 8);
      g.globalAlpha = 0.6 * a; line(g, fine, 2.4, 'rgba(150,215,255,.8)'); line(g, fine, 0.9, '#ffffff');
      // the edge itself glows where the current runs
      g.globalAlpha = 0.5 + flash * 0.4; const gr = g.createLinearGradient(0, 0, 14, 0); gr.addColorStop(0, 'rgba(120,190,255,.9)'); gr.addColorStop(1, 'rgba(120,190,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 14, H);
      g.globalAlpha = 1;
    }
    timer = setTimeout(() => requestAnimationFrame(draw), 66);
  }
  return {
    set(v) {
      if (v === on) return; on = v;
      for (const s of sides) s.c.classList.toggle('on', v);
      if (v) { flash = 1; if (!timer) draw(); } else { clearTimeout(timer); timer = 0; for (const s of sides) { s.g.setTransform(1, 0, 0, 1, 0, 0); s.g.clearRect(0, 0, s.c.width, s.c.height); } }
    },
  };
})();
