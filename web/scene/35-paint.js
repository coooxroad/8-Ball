  /* Ball sets painted in code (content/30-balls.js paint: 'planets' | 'soccer'): each ball's whole surface drawn here, as
     the sphere is wrapped (u round, v pole to pole: ballDir). Each ball keeps the colour it is known by, so 8볼 and the
     carom games read as ever: solids all over, stripes with white top and bottom, the number on a white sticker.
       planets  the cue ball the Moon; 1 Venus, 2 the Earth, 3 Mars, 4 Neptune (violet), 5 Jupiter, 6 Uranus, 7 Mercury
                (dark), 8 a black hole with its glowing ring; carom: the Moon, the Sun, Mars
       soccer   the five-and-six panel ball: the cue ball white with black pentagons; solids coloured all over the white
                panels, stripes coloured round the middle; carom yellow and red
       crystal  cut gems: facets in shades of the ball's colour with bright edges and glints (finish.facets cuts them)
       basketball  pebbled leather with black seams, coloured as the ball (the 8 black with light seams) */
  const ballDir = (u, v) => { const ph = u * 2 * Math.PI, th = v * Math.PI; return [-Math.cos(ph) * Math.sin(th), Math.cos(th), Math.sin(ph) * Math.sin(th)]; };
  // smooth noise on the sphere itself (no seam at the back, no pinch at the poles)
  const nh = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
  function noise3(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
    const f = t => t * t * (3 - 2 * t), u = f(xf), v = f(yf), w = f(zf), L = (a, b, t) => a + (b - a) * t;
    const c = (i, j, k) => nh(xi + i, yi + j, zi + k);
    return L(L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v), L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v), w);
  }
  const fbm3 = (x, y, z, o) => { let s = 0, a = 0.5, f = 1; for (let k = 0; k < (o || 4); k++) { s += a * noise3(x * f, y * f, z * f); f *= 2.1; a *= 0.5; } return s; };
  // a surface worked out a pixel at a time, small (the detail is in the noise, not the pixels), then laid over the whole ball
  function surface(g, W, H, fn) {
    const w = 256, h = 128, c = mkCanvas(w, h), cg = c.getContext('2d'), id = cg.createImageData(w, h), d = id.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = ballDir((x + 0.5) / w, (y + 0.5) / h), col = fn(p[0], p[1], p[2]), i = (y * w + x) * 4;
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
    cg.putImageData(id, 0, 0); g.imageSmoothingEnabled = true; g.drawImage(c, 0, 0, W, H);
  }
  const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const clamp01 = t => Math.max(0, Math.min(1, t));
  const PLANET = {
    moon: (x, y, z) => { const n = fbm3(x * 3, y * 3, z * 3), cr = fbm3(x * 9 + 5, y * 9, z * 9, 2); return mixc([226, 224, 216], [150, 148, 144], clamp01((n - 0.42) * 2.2 + (cr > 0.62 ? 0.35 : 0))); },
    venus: (x, y, z) => { const n = fbm3(x * 2 + y * 3, y * 6, z * 2); return mixc([246, 214, 120], [220, 170, 70], clamp01(n * 1.4 - 0.3)); },
    earth: (x, y, z) => { const n = fbm3(x * 2.2, y * 2.2, z * 2.2), cl = fbm3(x * 4 + 9, y * 4, z * 4); let c = n > 0.52 ? mixc([70, 140, 60], [150, 120, 70], clamp01((n - 0.52) * 5)) : [30, 80, 190];
      if (Math.abs(y) > 0.88) c = [240, 244, 248]; return cl > 0.6 ? mixc(c, [255, 255, 255], clamp01((cl - 0.6) * 4)) : c; },
    mars: (x, y, z) => { const n = fbm3(x * 3, y * 3, z * 3); let c = mixc([214, 92, 52], [130, 44, 26], clamp01((n - 0.4) * 2.4)); if (Math.abs(y) > 0.9) c = [238, 230, 224]; return c; },
    neptune: (x, y, z) => { const n = fbm3(x * 1.5, y * 9, z * 1.5, 3); return mixc([110, 70, 200], [60, 40, 140], clamp01(n * 1.6 - 0.35)); },
    jupiter: (x, y, z) => { const b = Math.sin(y * 18 + fbm3(x * 3, y * 3, z * 3) * 3); let c = mixc([236, 200, 150], [196, 110, 50], clamp01(b * 0.5 + 0.5));
      const sx = x - 0.55, sy = y + 0.35, sz = z - 0.55; if (sx * sx * 0.6 + sy * sy * 4 + sz * sz * 0.6 < 0.05) c = [190, 70, 40]; return c; },
    uranus: (x, y, z) => { const n = fbm3(x * 1.2, y * 5, z * 1.2, 2); return mixc([120, 214, 170], [70, 170, 140], clamp01(n * 1.5 - 0.3)); },
    mercury: (x, y, z) => { const n = fbm3(x * 4, y * 4, z * 4); return mixc([140, 70, 70], [70, 30, 34], clamp01((n - 0.35) * 2.2)); },
    hole: (x, y, z) => { const r = Math.abs(y); return r < 0.13 ? mixc([255, 214, 140], [230, 90, 20], clamp01(r / 0.13)) : r < 0.2 ? mixc([120, 40, 10], [8, 8, 10], clamp01((r - 0.13) / 0.07)) : [8, 8, 12]; },
    sun: (x, y, z) => { const n = fbm3(x * 6, y * 6, z * 6); return mixc([255, 236, 120], [250, 170, 30], clamp01(n * 1.8 - 0.4)); },
  };
  const POOL_PLANETS = ['moon', 'venus', 'earth', 'mars', 'neptune', 'jupiter', 'uranus', 'mercury', 'hole'];
  // the five-and-six panel pattern, worked out once: for each pixel, which panel (pentagon or hexagon) and whether on a seam
  let soccerMap = null;
  function soccerPattern(W, H) {
    if (soccerMap) return soccerMap;
    const t = (1 + Math.sqrt(5)) / 2, ico = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
    const norm = v => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }, pent = ico.map(norm);
    const faces = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    const hexc = faces.map(f => norm([0, 1, 2].map(k => pent[f[0]][k] + pent[f[1]][k] + pent[f[2]][k])));
    const cs = pent.concat(hexc), kind = new Uint8Array(W * H), panel = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const p = ballDir((x + 0.5) / W, (y + 0.5) / H); let b = -2, b2 = -2, bi = 0;
      // (a pentagon is a little smaller than its cell: its centre counts for less)
      for (let i = 0; i < 32; i++) { const d = p[0] * cs[i][0] + p[1] * cs[i][1] + p[2] * cs[i][2] - (i < 12 ? 0.012 : 0); if (d > b) { b2 = b; b = d; bi = i; } else if (d > b2) b2 = d; }
      const i = y * W + x; panel[i] = bi; kind[i] = b - b2 < 0.006 ? 2 : bi < 12 ? 1 : 0;   // 0 hexagon, 1 pentagon, 2 seam
    }
    return (soccerMap = { kind, panel, hexc });
  }
  // a basketball's seams, worked out once: two great circles through the poles and two rings round them
  let bballMask = null;
  function bballSeams(W, H) {
    if (bballMask) return bballMask;
    const m = new Uint8Array(W * H), e = 0.022;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const p = ballDir((x + 0.5) / W, (y + 0.5) / H); if (Math.abs(p[0]) < e || Math.abs(p[2]) < e || Math.abs(Math.abs(p[1]) - 0.7) < e * 0.8) m[y * W + x] = 1; }
    return (bballMask = m);
  }
  function paintBall(g, W, H, sk, kind, n, hex, colOf) {
    const pool = kind === 'pool', stripe = pool && n > 8, base = pool ? (n > 8 ? n - 8 : n) : 0;
    const colour = pool ? (n === 0 ? null : colOf(n)) : n === 0 ? null : n === 1 ? hex(sk.yel) : hex(sk.red);
    if (sk.paint === 'planets') {
      const name = pool ? POOL_PLANETS[base] : ['moon', 'sun', 'mars', 'mars'][n] || 'mars';
      surface(g, W, H, PLANET[name]);
      if (stripe) {                                                      // stripes: white ice caps over the top and the bottom
        g.fillStyle = '#f4f7fa'; g.fillRect(0, 0, W, H * 0.24); g.fillRect(0, H * 0.76, W, H * 0.24);
        for (const [a, b] of [[H * 0.24, H * 0.29], [H * 0.76, H * 0.71]]) { const gr = g.createLinearGradient(0, a, 0, b); gr.addColorStop(0, 'rgba(244,247,250,1)'); gr.addColorStop(1, 'rgba(244,247,250,0)'); g.fillStyle = gr; g.fillRect(0, Math.min(a, b), W, Math.abs(b - a)); }
      }
    } else if (sk.paint === 'crystal' || sk.paint === 'basketball') {
      // a gem cut in facets (each facet its own shade of the ball's colour, a bright edge round it, a glint here and there),
      // or a basketball (pebbled leather, black seams: two great circles and two rings); stripes clear/white with the colour round the middle
      const rgb = h => { const v = parseInt(h.slice(1), 16); return [v >> 16, (v >> 8) & 255, v & 255]; };
      const gem = sk.paint === 'crystal', eight = pool && n === 8, c = colour ? rgb(colour) : gem ? [214, 232, 250] : [244, 242, 236];
      const plain = gem ? [226, 238, 250] : [244, 242, 236], fu = (sk.finish && sk.finish.facets) || [22, 12];
      surface(g, W, H, (x, y, z) => {
        const band = stripe && Math.abs(y) > 0.42, base3 = band ? plain : c;
        if (gem) { const th = Math.acos(Math.max(-1, Math.min(1, y))) / Math.PI, ph = (Math.atan2(z, -x) / (2 * Math.PI) + 1) % 1, fi = Math.floor(ph * fu[0]) * 31 + Math.floor(th * fu[1]) * 17;
          const k = 0.72 + 0.5 * nh(fi, 3, 7); return mixc([0, 0, 0], base3, Math.min(1.25, k)).map(v => Math.min(255, v)); }
        const pebble = 0.9 + 0.12 * noise3(x * 40, y * 40, z * 40);
        return base3.map(v => v * pebble);
      });
      if (gem) {
        g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2;
        for (let i = 0; i <= fu[0]; i++) { g.beginPath(); g.moveTo(i * W / fu[0], 0); g.lineTo(i * W / fu[0], H); g.stroke(); }
        for (let j = 0; j <= fu[1]; j++) { g.beginPath(); g.moveTo(0, j * H / fu[1]); g.lineTo(W, j * H / fu[1]); g.stroke(); }
        let sd = n * 13 + 5; const r = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
        g.fillStyle = '#ffffff';
        for (let k = 0; k < 14; k++) { const x = r() * W, y = H * (0.15 + r() * 0.7), q = 3 + r() * 5; g.beginPath(); g.moveTo(x, y - q * 2); g.lineTo(x + q * 0.4, y); g.lineTo(x, y + q * 2); g.lineTo(x - q * 0.4, y); g.fill(); g.beginPath(); g.moveTo(x - q * 2, y); g.lineTo(x, y + q * 0.4); g.lineTo(x + q * 2, y); g.lineTo(x, y - q * 0.4); g.fill(); }
      } else {
        // the seams, drawn on the sphere: two great circles through the poles and two rings round them
        const id = g.getImageData(0, 0, W, H), d = id.data, sc = eight ? [230, 230, 230] : [26, 22, 20], m = bballSeams(W, H);
        for (let i = 0; i < W * H; i++) if (m[i]) { d[i * 4] = sc[0]; d[i * 4 + 1] = sc[1]; d[i * 4 + 2] = sc[2]; }
        g.putImageData(id, 0, 0);
      }
    } else {
      const S = soccerPattern(W, H), id = g.createImageData(W, H), d = id.data;
      const rgb = h => { const v = parseInt(h.slice(1), 16); return [v >> 16, (v >> 8) & 255, v & 255]; };
      const white = [246, 246, 242], black = [24, 24, 28], seam = [70, 70, 74], c = colour ? rgb(colour) : null, eight = pool && n === 8;
      for (let i = 0; i < W * H; i++) {
        const k = S.kind[i]; let o;
        if (k === 2) o = seam;
        else if (k === 1) o = eight ? white : black;
        else if (!c) o = white;
        else if (stripe) { const hc = S.hexc[S.panel[i] - 12]; o = Math.abs(hc[1]) < 0.45 ? c : white; }   // (round the middle)
        else o = c;
        d[i * 4] = o[0]; d[i * 4 + 1] = o[1]; d[i * 4 + 2] = o[2]; d[i * 4 + 3] = 255;
      }
      g.putImageData(id, 0, 0);
    }
    // the number on its sticker, front and back
    if (pool && n > 0) for (const u of [0.25, 0.75]) {
      const r = 0.34 / Math.PI * H; g.fillStyle = '#f7f3ea'; g.beginPath(); g.arc(u * W, H / 2, r, 0, 7); g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,.25)'; g.stroke();
      g.fillStyle = '#111'; g.font = `bold ${n > 9 ? 60 : 74}px "Helvetica Neue",Arial,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), u * W, H / 2 + 4);
      if (n === 6 || n === 9) g.fillRect(u * W - 15, H / 2 + 32, 30, 5);
    }
  }
