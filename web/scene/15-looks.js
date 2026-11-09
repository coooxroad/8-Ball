  /* The cloths that are pictures rather than a material: ice, the swimming pool's floor and the looks (sky, pitch, court,
     desk), each painted once on a canvas for the table shown. Only painting here - which one is used, and the water,
     sky and goals over it, are setCloth's (20-table.js). A file of its own so the table's file stays about the table;
     before 20-table.js so nothing it runs at load can reach these before they exist. */
  // a fixed sequence of numbers in [0, 1): each picture comes out the same every time it is painted
  const lcg = sd => () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
  /* Ice, for the table that is a sheet of it: one even blue, a few cracks that fork, trapped bubbles, a little frost at the edges. */
  const makeIce = () => {
    const W2 = 1024, H2 = 512, c = mkCanvas(W2, H2), g = c.getContext('2d');
    const rnd = lcg(7);
    // one even colour all over, only just lighter towards the middle
    g.fillStyle = '#6fbde8'; g.fillRect(0, 0, W2, H2);
    const mid = g.createRadialGradient(W2 / 2, H2 / 2, 0, W2 / 2, H2 / 2, W2 * 0.6); mid.addColorStop(0, 'rgba(255,255,255,.16)'); mid.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = mid; g.fillRect(0, 0, W2, H2);
    // cracks: a jagged line that forks, bright with a dark edge beside it
    const crack = (x, y, a, len, wd, depth) => {
      g.beginPath(); g.moveTo(x, y); const pts = [[x, y]];
      for (let d = 0; d < len; d += 14) { a += (rnd() - 0.5) * 0.7; x += Math.cos(a) * 14; y += Math.sin(a) * 14; g.lineTo(x, y); pts.push([x, y, a]); }
      g.strokeStyle = 'rgba(20,80,130,.3)'; g.lineWidth = wd + 1.4; g.stroke(); g.strokeStyle = 'rgba(255,255,255,.8)'; g.lineWidth = wd; g.stroke();
      if (depth > 0) for (const p of pts) if (p[2] != null && rnd() < 0.16) crack(p[0], p[1], p[2] + (rnd() < 0.5 ? 1 : -1) * (0.5 + rnd() * 0.6), len * (0.25 + rnd() * 0.3), wd * 0.6, depth - 1);
    };
    g.lineCap = g.lineJoin = 'round';
    for (let k = 0; k < 5; k++) crack(W2 * (0.1 + 0.2 * k + rnd() * 0.1), rnd() * H2, rnd() * 6.28, 160 + rnd() * 260, 1.2 + rnd() * 0.8, 2);
    // bubbles caught in it, spread evenly
    for (let k = 0; k < 320; k++) { const x = rnd() * W2, y = rnd() * H2, r = 0.8 + rnd() * 2.4; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fillStyle = `rgba(255,255,255,${0.22 + rnd() * 0.35})`; g.fill(); }
    // frost round the edge
    for (const [x0, y0, x1, y1] of [[0, 0, 0, 40], [0, H2, 0, H2 - 40], [0, 0, 50, 0], [W2, 0, W2 - 50, 0]]) { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, W2, H2); }
    const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
  };
  /* The swimming pool (a table with water: true): its floor small tiles with the lanes' dark lines, its rails and cabinet
     tiled (tex/pool-tiles), and over the floor the light the water throws, moving (waterMesh in 20-table.js, drawn every
     frame - 30 a second - while this table is out; nothing else on the table changes). */
  const makePoolFloor = () => {
    const W2 = 2048, H2 = 1024, c = mkCanvas(W2, H2), g = c.getContext('2d'), P = cur, kx = W2 / (2 * P.HL), ky = H2 / (2 * P.HW);
    const rnd = lcg(11);
    const ts = 0.035;                                                                // a tile, 3.5 cm
    for (let y = 0; y < 2 * P.HW; y += ts) for (let x = 0; x < 2 * P.HL; x += ts) {
      const l = 50 + rnd() * 6; g.fillStyle = `hsl(${192 + rnd() * 6},${68 + rnd() * 10}%,${l}%)`; g.fillRect(x * kx, y * ky, ts * kx + 1, ts * ky + 1);
    }
    // grout
    g.strokeStyle = 'rgba(225,245,255,.45)'; g.lineWidth = 1.4;
    for (let x = 0; x <= 2 * P.HL + 1e-6; x += ts) { g.beginPath(); g.moveTo(x * kx, 0); g.lineTo(x * kx, H2); g.stroke(); }
    for (let y = 0; y <= 2 * P.HW + 1e-6; y += ts) { g.beginPath(); g.moveTo(0, y * ky); g.lineTo(W2, y * ky); g.stroke(); }
    // the lane lines: dark blue down the length, a T at each end
    g.fillStyle = 'rgba(18,52,120,.82)';
    for (const ly of [-0.5, 0.5]) {
      const cy = (P.HW + ly * P.HW) * ky, hw = ts * 0.75 * ky, x0 = 0.32 * kx, x1 = W2 - 0.32 * kx;
      g.fillRect(x0, cy - hw, x1 - x0, 2 * hw);
      for (const xe of [x0, x1]) g.fillRect(xe - hw, cy - 0.12 * ky, 2 * hw, 0.24 * ky);
    }
    // deeper in the middle, shallower at the edges
    const mid = g.createRadialGradient(W2 / 2, H2 / 2, 0, W2 / 2, H2 / 2, W2 * 0.6); mid.addColorStop(0, 'rgba(0,40,90,.18)'); mid.addColorStop(1, 'rgba(255,255,255,.06)'); g.fillStyle = mid; g.fillRect(0, 0, W2, H2);
    const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; return t;
  };

  /* Tables that are something else (look: 'sky' | 'soccer' | 'desk'): their cloth a picture drawn here for the table shown,
     their rails a plain colour; the sky also moves (skyMat in 20-table.js, drawn like the pool's water), and on a pool
     table the soccer pitch has a goal over every pocket, the basketball court ('court') a hoop (setGoals, 20-table.js). Looks only: they play as cloth. */
  const lookTex = {};
  function lookFloor(kind) {
    const key = kind + ':' + cur.HL + 'x' + cur.HW; if (lookTex[key]) return lookTex[key];
    const W2 = 2048, H2 = 1024, c = mkCanvas(W2, H2), g = c.getContext('2d'), P = cur, kx = W2 / (2 * P.HL), ky = H2 / (2 * P.HW);
    const rnd = lcg(23);
    const X = x => (x + P.HL) * kx, Y = y => (P.HW - y) * ky;
    if (kind === 'sky') {
      const bg = g.createLinearGradient(0, 0, W2, H2); bg.addColorStop(0, '#0a0f2c'); bg.addColorStop(0.55, '#14123a'); bg.addColorStop(1, '#251645');
      g.fillStyle = bg; g.fillRect(0, 0, W2, H2);
      for (let k = 0; k < 14; k++) {                                              // nebulae: soft clouds of colour
        const x = rnd() * W2, y = rnd() * H2, r = 120 + rnd() * 320, hue = [220, 265, 290, 195][k % 4], gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, `hsla(${hue},70%,45%,.16)`); gr.addColorStop(1, `hsla(${hue},70%,40%,0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
      }
      for (let k = 0; k < 2600; k++) { const a = rnd(); g.fillStyle = `rgba(${220 + a * 35},${225 + a * 30},255,${0.15 + a * 0.5})`; g.fillRect(rnd() * W2, rnd() * H2, a > 0.93 ? 2.2 : 1.2, a > 0.93 ? 2.2 : 1.2); }
    } else if (kind === 'soccer') {
      const bands = 12;                                                             // mown stripes across the pitch
      for (let b = 0; b < bands; b++) { g.fillStyle = b % 2 ? '#2f8a3a' : '#3a9a45'; g.fillRect(b * W2 / bands, 0, W2 / bands + 1, H2); }
      for (let k = 0; k < 26000; k++) { const x = rnd() * W2, y = rnd() * H2, l = 3 + rnd() * 5; g.strokeStyle = rnd() < 0.5 ? 'rgba(20,70,25,.35)' : 'rgba(120,200,110,.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 2, y - l); g.stroke(); }
      g.strokeStyle = 'rgba(250,252,248,.92)'; g.lineWidth = 0.008 * kx; g.lineCap = 'butt';
      const m = 0.035, L = P.HL - m, Wd = P.HW - m, line = (pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo : g.moveTo).call(g, X(x), Y(y))); g.stroke(); };
      line([[-L, -Wd], [L, -Wd], [L, Wd], [-L, Wd], [-L, -Wd]]); line([[0, -Wd], [0, Wd]]);
      const cr = Wd * 0.32; g.beginPath(); g.ellipse(X(0), Y(0), cr * kx, cr * ky, 0, 0, 7); g.stroke();
      g.fillStyle = 'rgba(250,252,248,.92)'; const spot = (x, y) => { g.beginPath(); g.arc(X(x), Y(y), 0.008 * kx, 0, 7); g.fill(); }; spot(0, 0);
      for (const sx of [-1, 1]) {
        const pd = L * 0.3, pw = Wd * 0.62, gd = L * 0.11, gw = Wd * 0.3;
        line([[sx * L, -pw], [sx * (L - pd), -pw], [sx * (L - pd), pw], [sx * L, pw]]); line([[sx * L, -gw], [sx * (L - gd), -gw], [sx * (L - gd), gw], [sx * L, gw]]);
        spot(sx * (L - pd * 0.72), 0);
        g.beginPath(); const a = Math.acos(Math.min(1, (pd - pd * 0.72) / (cr * 0.85))); g.ellipse(X(sx * (L - pd * 0.72)), Y(0), cr * 0.85 * kx, cr * 0.85 * ky, 0, sx > 0 ? Math.PI - a : -a, sx > 0 ? Math.PI + a : a); g.stroke();
        for (const sy of [-1, 1]) { g.beginPath(); g.ellipse(X(sx * L), Y(sy * Wd), 0.04 * kx, 0.04 * ky, 0, 0, 7); g.stroke(); }
      }
    } else if (kind === 'court') {
      // maple boards along the length, their joints staggered, then the court's lines and the painted keys
      const bw = 0.04 * ky;
      for (let y = 0, row = 0; y < H2; y += bw, row++) {
        let x = -((row * 137) % 300);
        while (x < W2) { const len = 260 + rnd() * 420, l = 58 + rnd() * 9; g.fillStyle = `hsl(${30 + rnd() * 6},${52 + rnd() * 10}%,${l}%)`; g.fillRect(x, y, len, bw); g.fillStyle = 'rgba(90,55,25,.35)'; g.fillRect(x, y, 1.5, bw); x += len; }
        g.fillStyle = 'rgba(90,55,25,.25)'; g.fillRect(0, y, W2, 1.2);
      }
      for (let k = 0; k < 9000; k++) { g.fillStyle = `rgba(120,75,35,${0.03 + rnd() * 0.05})`; g.fillRect(rnd() * W2, rnd() * H2, 6 + rnd() * 30, 1); }
      const m = 0.035, L = P.HL - m, Wd = P.HW - m;
      const key = (sx, fill) => { g.fillStyle = fill; g.fillRect(Math.min(X(sx * L), X(sx * (L - L * 0.27))), Y(Wd * 0.28), Math.abs(X(sx * L) - X(sx * (L - L * 0.27))), Y(-Wd * 0.28) - Y(Wd * 0.28)); };
      key(-1, 'rgba(30,70,170,.55)'); key(1, 'rgba(30,70,170,.55)');
      g.fillStyle = 'rgba(30,70,170,.3)'; g.beginPath(); g.ellipse(X(0), Y(0), Wd * 0.26 * kx, Wd * 0.26 * ky, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.92)'; g.lineWidth = 0.007 * kx;
      const line = pts => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo : g.moveTo).call(g, X(x), Y(y))); g.stroke(); };
      line([[-L, -Wd], [L, -Wd], [L, Wd], [-L, Wd], [-L, -Wd]]); line([[0, -Wd], [0, Wd]]);
      for (const r of [Wd * 0.26, Wd * 0.1]) { g.beginPath(); g.ellipse(X(0), Y(0), r * kx, r * ky, 0, 0, 7); g.stroke(); }
      for (const sx of [-1, 1]) {
        const kx2 = sx * (L - L * 0.27);
        line([[sx * L, -Wd * 0.28], [kx2, -Wd * 0.28], [kx2, Wd * 0.28], [sx * L, Wd * 0.28]]);
        g.beginPath(); g.ellipse(X(kx2), Y(0), Wd * 0.28 * kx, Wd * 0.28 * ky, 0, 0, 7); g.stroke();
        // the three-point line: straight from the baseline, then the arc round the basket
        const r3 = Wd * 0.94, yc = Wd * 0.86, cx = sx * (L - L * 0.06), A = Math.asin(yc / r3), arc = [];
        for (let k = 0; k <= 40; k++) { const t = -A + 2 * A * k / 40; arc.push([cx - sx * r3 * Math.cos(t), r3 * Math.sin(t)]); }
        line([[sx * L, -yc], arc[0]]); line(arc); line([arc[arc.length - 1], [sx * L, yc]]);
      }
    } else if (kind === 'desk') {
      g.fillStyle = '#c9a274'; g.fillRect(0, 0, W2, H2);                          // birch ply, its grain along the length
      for (let k = 0; k < 520; k++) { const y = rnd() * H2, a = 0.04 + rnd() * 0.08; g.strokeStyle = rnd() < 0.6 ? `rgba(120,78,40,${a})` : `rgba(255,236,200,${a})`; g.lineWidth = 1 + rnd() * 3;
        g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= W2; x += 64) g.lineTo(x, y + Math.sin(x * 0.004 + k) * 6 + (rnd() - 0.5) * 2); g.stroke(); }
      for (let k = 0; k < 3; k++) { const x = 200 + rnd() * (W2 - 400), y = 120 + rnd() * (H2 - 240), r = 50 + rnd() * 30; g.strokeStyle = 'rgba(110,70,40,.12)'; g.lineWidth = 7; g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke(); }  // cup rings
      // pencil: doodles, a sum, a heart - grey graphite, faint
      g.strokeStyle = 'rgba(52,52,60,.62)'; g.fillStyle = 'rgba(52,52,60,.62)'; g.lineWidth = 4; g.lineJoin = g.lineCap = 'round';
      g.font = `${Math.round(0.075 * kx)}px "Gaegu", "Jua", sans-serif`; g.textAlign = 'center';
      const doodles = [['x² + y² = r²', 0.22, 0.25], ['시험 화이팅!', 0.72, 0.78], ['3 × 7 = 21', 0.8, 0.22], ['♡', 0.36, 0.72]];
      for (const [t, u, v] of doodles) { g.save(); g.translate(u * W2, v * H2); g.rotate((rnd() - 0.5) * 0.3); g.fillText(t, 0, 0); g.restore(); }
      g.save(); g.translate(0.58 * W2, 0.4 * H2); g.rotate(0.2); for (let k = 0; k < 2; k++) { g.beginPath(); g.moveTo(-60, -20 + k * 40); g.lineTo(60, -20 + k * 40); g.moveTo(-20 + k * 40, -60); g.lineTo(-20 + k * 40, 60); g.stroke(); }
      g.beginPath(); g.arc(-40, -40, 12, 0, 7); g.stroke(); g.beginPath(); g.moveTo(-10, -10); g.lineTo(10, 10); g.moveTo(10, -10); g.lineTo(-10, 10); g.stroke(); g.restore();   // tic-tac-toe
      g.save(); g.translate(0.12 * W2, 0.66 * H2); for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + k * 4 * Math.PI / 5; (k ? g.lineTo : g.moveTo).call(g, Math.cos(a) * 34, Math.sin(a) * 34); } g.closePath(); g.stroke(); g.restore();   // a star
      for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(${200 + rnd() * 30},${190 + rnd() * 20},${190 + rnd() * 20},.9)`; g.beginPath(); g.ellipse(rnd() * W2, rnd() * H2, 3 + rnd() * 6, 2 + rnd() * 2, rnd() * 3, 0, 7); g.fill(); }   // eraser crumbs
    }
    const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.repeat.set(1 / (2 * P.HL), 1 / (2 * P.HW)); t.offset.set(0.5, 0.5); return (lookTex[key] = t);
  }
