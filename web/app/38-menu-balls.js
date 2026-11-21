/* The menu's balls (owner 11-20: '공은 3D로 두세 개만 넣고 손가락으로 터치하면 굴러다니게, 소리 넣고' - after the cards were
   made bolder, the cloth under them to read as a billiard table's). Three balls of the player's own set lie on the cloth,
   in the bare strips above and below the row of cards; a touch on one sends it rolling away from the finger, it slows on
   the cloth, knocks the others and comes back off the cards' edge and the cloth's - with the game's own sounds.

   Each ball is a small canvas on the cloth (#dkFelt, so it leans with the desk and lies under the cards), its sphere drawn
   here pixel by pixel from the set's own surface picture (scene.ballSurface) turned as it rolls - so its number rolls over
   and away, each ball lying its own way up. Nothing runs while all three lie still. */
const menuBalls = (() => {
  const SET = [[0, 'lo', 0.5], [8, 'lo', 0.73], [3, 'hi', 0.6]];   // (number, strip, where across the cloth)
  const D_U = 40;                                                    // a ball across, in the menu's u (the cards are 204u wide)
  const DECEL = 430, KICK = 1050, REST = 6;                          // u/s^2 on the cloth, u/s from a touch, u/s it stops below
  const L = (() => { const l = [0.42, -0.58, 0.7], k = Math.hypot(...l); return l.map(v => v / k); })();   // the light: upper right, high
  const H = (() => { const h = [L[0], L[1], L[2] + 1], k = Math.hypot(...h); return h.map(v => v / k); })();
  let balls = [], felt = null, U = 1, zones = null, raf = 0, last = 0, skin = null, rollV = 0;

  // a ball's surface picture, small enough to read quickly (256 x 128)
  const mapOf = n => {
    const src = scene.ballSurface(prefs.ballSkin, 'pool', n), c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const g = c.getContext('2d'); g.drawImage(src, 0, 0, 256, 128); return g.getImageData(0, 0, 256, 128).data;
  };
  // a random way up (a rotation matrix, rows), and turning one by an angle about an axis lying on the cloth
  const randomM = () => {
    const a = Math.random() * 6.283, b = Math.acos(2 * Math.random() - 1), c = Math.random() * 6.283;
    let M = [1, 0, 0, 0, 1, 0, 0, 0, 1]; M = turn(M, [0, 0, 1], a); M = turn(M, [1, 0, 0], b); return turn(M, [0, 0, 1], c);
  };
  function turn(M, [x, y, z], t) {
    const c = Math.cos(t), s = Math.sin(t), C = 1 - c;
    const R = [c + x * x * C, x * y * C - z * s, x * z * C + y * s, y * x * C + z * s, c + y * y * C, y * z * C - x * s, z * x * C - y * s, z * y * C + x * s, c + z * z * C];
    const o = new Array(9);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = R[i * 3] * M[j] + R[i * 3 + 1] * M[3 + j] + R[i * 3 + 2] * M[6 + j];
    return o;
  }
  /* the sphere, seen from above: each pixel of the disc is a point of the ball facing up (n); turned back into the ball's
     own frame it finds its place on the picture (three.js's sphere: u from atan2(z, -x), v from y); lit from the upper
     right with one soft highlight, its edge a little darker */
  // (what does not turn with the ball - each pixel's point on the sphere facing up, its light, its highlight, its edge -
  // worked out once for a size: the frame only turns the points and looks up the picture; QA 11-20, the light's power
  // of 70 was taken for every pixel of three balls every frame)
  const grids = {};
  function gridOf(S) {
    if (grids[S]) return grids[S];
    const r = S / 2 - 0.5, n = S * S, N = new Float32Array(n * 3), K = new Float32Array(n), SP = new Float32Array(n), A = new Uint8ClampedArray(n), IN = new Uint8Array(n);
    for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
      const j = py * S + px, dx = (px + 0.5 - S / 2) / r, dy = (py + 0.5 - S / 2) / r, q = dx * dx + dy * dy;
      if (q > 1.06) continue;
      IN[j] = 1;
      const nz = Math.sqrt(Math.max(0, 1 - q));
      N[j * 3] = dx; N[j * 3 + 1] = dy; N[j * 3 + 2] = nz;
      K[j] = (0.56 + 0.7 * Math.max(0, dx * L[0] + dy * L[1] + nz * L[2])) * (0.84 + 0.16 * nz);   // (brighter, owner 11-20: the cloth is dark)
      SP[j] = Math.pow(Math.max(0, dx * H[0] + dy * H[1] + nz * H[2]), 70) * 235;
      A[j] = Math.max(0, Math.min(255, (1.03 - Math.sqrt(q)) * r * 255));
    }
    return (grids[S] = { N, K, SP, A, IN });
  }
  function draw(b) {
    const g = b.g, S = b.cv.width, im = b.im || (b.im = g.createImageData(S, S)), d = im.data, T = b.map, M = b.M, { N, K, SP, A, IN } = gridOf(S);
    for (let j = 0, n = S * S; j < n; j++) {
      const i = j * 4;
      if (!IN[j]) { d[i + 3] = 0; continue; }
      const nx = N[j * 3], ny = N[j * 3 + 1], nz = N[j * 3 + 2];
      const lx = M[0] * nx + M[3] * ny + M[6] * nz, ly = M[1] * nx + M[4] * ny + M[7] * nz, lz = M[2] * nx + M[5] * ny + M[8] * nz;
      let u = Math.atan2(lz, -lx) / 6.2832; if (u < 0) u += 1;
      const v = Math.acos(Math.max(-1, Math.min(1, ly))) / 3.1416;
      const t = ((Math.min(127, v * 128 | 0)) * 256 + (Math.min(255, u * 256 | 0))) * 4, k = K[j], sp = SP[j];
      d[i] = Math.min(255, T[t] * k + sp); d[i + 1] = Math.min(255, T[t + 1] * k + sp); d[i + 2] = Math.min(255, T[t + 2] * k + sp);
      d[i + 3] = A[j];
    }
    g.putImageData(im, 0, 0);
  }
  const place = b => { b.el.style.transform = `translate3d(${(b.x - b.R).toFixed(1)}px,${(b.y - b.R).toFixed(1)}px,0)`; };

  /* where they may roll: the strips of cloth above and below the cards (the cards are a wall to them, as is the cloth's
     edge), across the part of the cloth that shows (menuFit: the row's --edge) */
  function fit(u, fh, fi, edge) {
    if (!felt) return;
    const was = U; U = u;
    // (the box where the cloth lies in the plane: #dkBalls is laid as the plane is)
    if (box) { let x = 0, y = 0, n = felt; while (n && n.id !== 'deskPlane') { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
      Object.assign(box.style, { left: x + 'px', top: y + 'px', width: felt.offsetWidth + 'px', height: felt.offsetHeight + 'px' }); }
    const R = D_U * U / 2, fw = felt.offsetWidth, card = 492 * U, cTop = (fh - card) / 2, cBot = (fh + card) / 2;
    zones = { hi: { x0: edge + R + 4, x1: fw - edge - R - 4, y0: fi + 16 + R, y1: cTop - R - 2 }, lo: { x0: edge + R + 4, x1: fw - edge - R - 4, y0: cBot + R + 2, y1: fh - fi - 16 - R } };
    const px = Math.max(48, Math.round(D_U * U * Math.min(2, window.devicePixelRatio || 1) * 1.15));
    for (const b of balls) {
      const z = zones[b.zone];
      if (b.cv.width !== px) { b.cv.width = b.cv.height = px; b.im = null; }
      b.el.style.width = b.el.style.height = (2 * R).toFixed(1) + 'px';
      if (b.x == null) { b.x = z.x0 + (z.x1 - z.x0) * b.at; b.y = (z.y0 + z.y1) / 2; }
      else { b.x *= U / was; b.y *= U / was; b.vx *= U / was; b.vy *= U / was; }
      // (a strip too low for a ball - a short landscape screen: that ball is put away, not squeezed; QA 11-20 U01)
      b.el.hidden = z.y1 < z.y0 || z.x1 < z.x0; if (b.el.hidden) { b.vx = b.vy = 0; continue; }
      b.R = R; b.x = Math.max(z.x0, Math.min(z.x1, b.x)); b.y = Math.max(z.y0, Math.min(z.y1, b.y));
      // (drawn again only when its size changed - every fit drew all three, QA 11-20 U02)
      if (b.drawn !== b.cv.width) { draw(b); b.drawn = b.cv.width; }
      place(b);
    }
  }
  /* on the cloth (once it is made; again when the player's set of balls has changed). Not in the cloth itself, though: the
     balls lie in a layer of their own over the desk's leaning plane, leaning as it does (#dkBalls, as the cards' #dkCards
     - 84-menu.css), a box in it laid exactly where the cloth is (fit). Inside the plane, a ball - a moving layer - made the
     browser lift the cloth's whole width onto a layer of its own (some 5 million pixels at a tablet's sharpness) and draw
     the plane again around it as it rolled: the screen blinked when a ball was touched (owner 11-20). */
  let box = null;
  function mount(f) {
    felt = f;
    if (!box || !box.isConnected) {
      let lay = $('#dkBalls');
      if (!lay) { lay = el('div', { id: 'dkBalls', 'aria-hidden': 'true' }); { const c = $('#dkCards'); if (c) c.before(lay); else ($('#dkProps') || $('#deskPlane')).after(lay); }
        lay.addEventListener('pointerdown', e => { if (touch(e)) e.stopPropagation(); }, true); }
      box = el('div', { class: 'mn-balls' }); lay.textContent = ''; lay.appendChild(box);
      for (const b of balls) b.el.remove(); balls = [];
    }
    if (skin !== prefs.ballSkin) { for (const b of balls) b.el.remove(); balls = []; skin = prefs.ballSkin; }
    if (balls.length && balls[0].el.parentNode === box) return;
    for (const b of balls) b.el.remove(); balls = [];
    for (const [n, zone, at] of SET) {
      const cv = document.createElement('canvas'), e = el('i', { class: 'mn-ball', 'aria-hidden': 'true' }, cv);
      box.appendChild(e);
      let map = null; try { map = mapOf(n); } catch (er) { e.remove(); continue; }
      balls.push({ n, zone, at, el: e, cv, g: cv.getContext('2d'), map, M: randomM(), x: null, y: null, vx: 0, vy: 0, R: D_U / 2 });
    }
  }
  const pan = b => { const r = b.el.getBoundingClientRect(); return Math.max(-1, Math.min(1, ((r.left + r.right) / 2 / innerWidth) * 2 - 1)); };
  const mps = v => v / U * 0.0014;   // (u/s to m/s: a ball is 57mm across, 40u here)

  function step(dt) {
    let moving = false, vmax = 0;
    for (const b of balls) {
      const s = Math.hypot(b.vx, b.vy); if (!s) continue;
      const ns = Math.max(0, s - DECEL * U * dt);
      if (ns < REST * U) { b.vx = b.vy = 0; continue; }
      b.vx *= ns / s; b.vy *= ns / s; moving = true; vmax = Math.max(vmax, ns);
      const dx = b.vx * dt, dy = b.vy * dt; b.x += dx; b.y += dy;
      // rolling, not sliding: turned about the line on the cloth square to its way, by the distance over its radius
      const m = Math.hypot(dx, dy); if (m > 1e-4) b.M = turn(b.M, [-dy / m, dx / m, 0], m / b.R);
      // the walls: the cloth's edges and the cards' edge
      const z = zones[b.zone];
      if (b.x < z.x0 || b.x > z.x1) { const v = Math.abs(b.vx); b.x = b.x < z.x0 ? z.x0 : z.x1; b.vx *= -0.78; if (v > 40 * U) SND.rail(Math.min(1.5, mps(v)), pan(b)); }
      if (b.y < z.y0 || b.y > z.y1) { const v = Math.abs(b.vy); b.y = b.y < z.y0 ? z.y0 : z.y1; b.vy *= -0.78; if (v > 40 * U) SND.rail(Math.min(1.5, mps(v)), pan(b)); }
    }
    // the balls knocking each other (one strip's)
    for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i], b = balls[j]; if (a.zone !== b.zone || a.el.hidden || b.el.hidden) continue;
      const dx = b.x - a.x, dy = b.y - a.y, dd = Math.hypot(dx, dy), min = a.R + b.R;
      if (dd >= min || dd < 1e-6) continue;
      const nx = dx / dd, ny = dy / dd, rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      const push = (min - dd) / 2; a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
      if (rel <= 0) continue;
      const k = rel * 0.96; a.vx -= k * nx; a.vy -= k * ny; b.vx += k * nx; b.vy += k * ny;
      SND.ball(Math.min(2, mps(rel)), (pan(a) + pan(b)) / 2); moving = true;
    }
    rollV = vmax; return moving;
  }
  function loop(t) {
    raf = 0;
    if (!felt || !felt.isConnected || !felt.offsetWidth || !box || !box.offsetWidth) { SND.rolling(0); return; }
    const dt = Math.min(1 / 30, last ? (t - last) / 1000 : 1 / 60); last = t;
    const moving = step(dt / 2) | step(dt / 2);
    for (const b of balls) { if (b.vx || b.vy || b.dirty) { draw(b); place(b); b.dirty = false; } }
    SND.rolling(moving ? Math.min(2.5, mps(rollV) * 2) : 0);
    if (moving) raf = requestAnimationFrame(loop); else last = 0;
  }
  // a touch on a ball (the row of cards lies over the cloth: 37-desk-menu.js hands its touches here first)
  function touch(e) {
    if (!balls.length || !zones) return false;
    const hit = document.elementsFromPoint(e.clientX, e.clientY);
    if (hit.length && hit[0].closest('.mn-card, .mn-pc')) return false;   // (a card over it: the card's touch)
    const be = hit.find(h => h.classList && h.classList.contains('mn-ball')), b = be && balls.find(q => q.el === be && !q.el.hidden);
    if (!b) return false;
    const r = b.el.getBoundingClientRect(), cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
    let dx = cx - e.clientX, dy = cy - e.clientY; const m = Math.hypot(dx, dy);
    if (m < r.width * 0.12) { const a = Math.random() * 6.283; dx = Math.cos(a); dy = Math.sin(a) * 0.4; }
    const k = Math.hypot(dx, dy), sp = KICK * U * (1.2 - 0.5 * Math.min(1, m / (r.width / 2)));   // (fuller the nearer its middle)
    b.vx = dx / k * sp; b.vy = dy / k * sp;
    SND.init(); SND.ball(0.25, pan(b));
    if (!raf) raf = requestAnimationFrame(loop);
    return true;
  }
  return { mount, fit, touch };
})();
