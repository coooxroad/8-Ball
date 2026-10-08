/* ================= records: wins and losses by name ================= */
const formChips = form => el('span', { class: 'form fc' }, (form || []).map(f => el('i', { class: f === 'W' ? 'w' : 'l', text: f === 'W' ? '승' : '패' })));
/* A card on a run of wins burns: one flame the shape of the card, round its whole edge, drawn afresh every frame.
   The edge is walked point by point; at each point the fire stands as tall as a slowly drifting noise says, leaning upwards
   as fire does - long over the top, licking up the sides, low under the bottom. Three layers of it, outer colour to white heat. */
const FLAME = { 2: ['#ff2d1a', '#ff8a3c', '#ffe9a8'], 3: ['#ffb300', '#ffe14a', '#fffbe0'], 4: ['#00c896', '#5ff2c9', '#eafff8'], 5: ['#8a3dff', '#c79bff', '#f6ecff'] };
const fnoise = (() => { const T = new Float32Array(512); let sd = 99; for (let i = 0; i < 512; i++) { sd = (sd * 1664525 + 1013904223) >>> 0; T[i] = sd / 4294967296; }
  const at = (x, y) => T[((x & 31) + (y & 15) * 32) & 511];
  return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1); return a + (b - a) * sx + (c - a + (a - b + d - c) * sx) * sy; }; })();
let flameRaf = 0;
function flames(now) {
  flameRaf = 0; const list = document.querySelectorAll('#records canvas.flame'); if (!list.length || st.screen !== 'records') return;
  const t = now / 1000, dpr = Math.min(2, window.devicePixelRatio || 1), PAD = 34;
  for (const cv of list) {
    const card = cv.nextElementSibling, w = card.offsetWidth, h = card.offsetHeight, W = w + 2 * PAD, H = h + 2 * PAD; if (!w) continue;
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
    const g = cv.getContext('2d'), cols = FLAME[cv.dataset.n] || FLAME[2], r = 18;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    // the edge of the card, clockwise from the top-left corner, as points with the way out at each
    const P = [], step = 3, add = (x, y, nx, ny) => P.push([x + PAD, y + PAD, nx, ny]);
    const arc = (cx, cy, a0) => { for (let a = 0; a < Math.PI / 2; a += step / r) add(cx + Math.cos(a0 + a) * r, cy + Math.sin(a0 + a) * r, Math.cos(a0 + a), Math.sin(a0 + a)); };
    for (let x = r; x < w - r; x += step) add(x, 0, 0, -1); arc(w - r, r, -Math.PI / 2);
    for (let y = r; y < h - r; y += step) add(w, y, 1, 0); arc(w - r, h - r, 0);
    for (let x = w - r; x > r; x -= step) add(x, h, 0, 1); arc(r, h - r, Math.PI / 2);
    for (let y = h - r; y > r; y -= step) add(0, y, -1, 0); arc(r, r, Math.PI);
    const n = P.length, ring = () => { g.moveTo(PAD + r, PAD); g.arcTo(PAD, PAD, PAD, PAD + r, r); g.lineTo(PAD, PAD + h - r); g.arcTo(PAD, PAD + h, PAD + r, PAD + h, r); g.lineTo(PAD + w - r, PAD + h); g.arcTo(PAD + w, PAD + h, PAD + w, PAD + h - r, r); g.lineTo(PAD + w, PAD + r); g.arcTo(PAD + w, PAD, PAD + w - r, PAD, r); g.closePath(); };
    for (let L = 0; L < 3; L++) {
      const reach = [1, 0.6, 0.3][L], sp = [1.5, 2.1, 2.9][L];
      g.beginPath();
      for (let i = 0; i <= n; i++) {
        const p = P[i % n], u = (i % n) / n * 32;                                    // 32 lumps round the edge, wrapping without a seam
        const upw = Math.max(0, -p[3]), side = Math.abs(p[2]), tall = 2.5 + 30 * upw * upw + 9 * side * (1 - upw);   // how tall fire may stand here
        const a = fnoise(u, t * sp + L * 5), b = fnoise(u * 3 + 9, t * sp * 1.7 + L * 3), tongue = Math.pow(a, 2.4) * 1.5 + Math.pow(b, 2) * 0.4;
        const hgt = tall * reach * (0.22 + 1.2 * tongue), lean = 0.55 + 0.45 * upw;      // off the sides it bends upwards
        const dx = p[2] * lean, dy = p[3] * lean - (1 - upw) * 0.75 * (p[3] > 0.5 ? 0 : 1), dl = Math.hypot(dx, dy) || 1, sway = (fnoise(u + 3, t * 0.9) - 0.5) * 5 * upw;
        const x = p[0] + dx / dl * hgt + sway, y = p[1] + dy / dl * hgt;
        if (i) g.lineTo(x, y); else g.moveTo(x, y);
      }
      g.closePath(); ring();
      g.shadowColor = cols[0]; g.shadowBlur = L ? 0 : 18; g.globalAlpha = [0.7, 0.9, 0.95][L]; g.fillStyle = cols[L]; g.filter = L ? 'none' : 'blur(1.2px)'; g.fill('evenodd'); g.filter = 'none';
    }
    g.globalAlpha = 1; g.shadowBlur = 0;
  }
  flameRaf = requestAnimationFrame(flames);
}
const lightFlames = () => { if (!flameRaf) flameRaf = requestAnimationFrame(flames); };
function showRecords() { show('records'); st.phase = 'idle'; flow = null; paintRecords(); $('#records').scrollTop = 0; }
function paintRecords() {
  paintNav(); const body = $('#recBody'); body.textContent = '';
  const names = Object.keys(rec).filter(n => rec[n].w || rec[n].l).sort((a, b) => rec[b].w - rec[a].w || rec[a].l - rec[b].l);
  if (!names.length) { body.appendChild(note('아직 끝난 판이 없습니다. 한 판 끝나면 이름별로 기록이 쌓입니다.')); return; }
  // one card a player; whoever is on a run of wins has a card on fire
  body.appendChild(el('div', { class: 'rcards' }, names.map((n, k) => { const r = recOf(n);
    const card = el('div', { class: 'rcard' + fireOf(r.streak) }, [el('span', { class: 'pos', text: k + 1 }),
      el('div', { class: 'who' }, [el('b', { text: n }), el('span', { text: `${r.w}승 ${r.l}패 · 승률 ${Math.round(r.w / (r.w + r.l) * 100)}% · 최다 ${r.best}연승` })]),
      formChips(r.form), r.streak >= 2 ? el('span', { class: 'run', text: r.streak + '연승' }) : null]);
    return el('div', { class: 'rwrap' }, [fireOf(r.streak) ? el('canvas', { class: 'flame', 'data-n': Math.min(5, r.streak) }) : null, card]); })));
  body.appendChild(flatBtn('전적 모두 지우기', () => { rec = {}; store.set('rec', rec); series.key = ''; paintRecords(); }));
  lightFlames();
}
