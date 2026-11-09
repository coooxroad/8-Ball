/* ---- the desk as a leaning plane: layout() in 10-ui.js calls these two on the desk's home ---- */
// How far the desk leans, and how much bigger than the screen the plane must be: a point h up the plane from its bottom
// edge shows Y = h cos(t) P / (P + h sin(t)) up the screen, so the plane is made tall enough that its far edge reaches the
// top bar, its sides wide enough that the far corners still reach the screen's edges, and the desk on it starts just
// under the bar.
function deskLean(W, H, portrait) {
  const t = (wide ? 15 : portrait ? 12 : 10) * Math.PI / 180, P = 2.8 * Math.max(H, 600), c = Math.cos(t), sn = Math.sin(t);
  const bar = wide ? 62 : portrait ? 56 : 48, up = Y => Y * P / (c * P - Y * sn), hb = up(H - bar), k = P / (P + hb * sn);
  // Low-DPI text needs more samples before the desk is tilted. Only the HTML contents are enlarged, then scaled back;
  // the wood and WebGL stay at their own resolution. Native HiDPI needs no extra layer; cap the extra work at 8M pixels.
  const dpr = window.devicePixelRatio || 1;
  const density = wide && CSS.supports('zoom', '2') ? Math.max(1, Math.min(2 / dpr, Math.sqrt(8e6 / (W * hb)) / dpr)) : 1;
  app.style.setProperty('--desk-density', (Math.floor(density * 1000) / 1000).toFixed(3));
  app.style.setProperty('--tilt', t + 'rad');
  app.style.setProperty('--pp', P + 'px');
  app.style.setProperty('--ovh', (hb - (H - bar)).toFixed(1) + 'px');
  app.style.setProperty('--ovw', Math.ceil(W / 2 * (1 / k - 1) + 2) + 'px');
}
// The desk is a plane seen from above and a little behind: it is laid out flat and then leans away from the eye (CSS
// 3D, about its bottom edge), and the canvas with the live table under it leans exactly the same way, so the table
// sits in the tray as one picture. A window is cut in the desk where the table is, worked out in the desk's own flat
// coordinates (the transform carries it along); a shade under the window edge lays the table's shadow on the felt,
// and a strip below it is the near rail's front.
function deskWindow(W, H, portrait) {
  const pl = $('#deskPlane'), dk = $('#desk'), sg = $('#dkStage'), win = sg.dataset.win === '1';
  // CSS zoom changes the desk's own offset units; its children still use the original desk coordinates.
  const density = parseFloat(app.style.getPropertyValue('--desk-density')) || 1;
  let x = dk.offsetLeft * density, y = dk.offsetTop * density; for (let n = sg; n && n !== dk; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
  const dx = pl.offsetLeft, dy = pl.offsetTop, sw = sg.offsetWidth, sh0 = sg.offsetHeight;   // (x, y: the stage in the plane; dx, dy: the plane in the app)
  const ins = { t: dy + y + 4, l: dx + x + 4, r: W - (dx + x + sw) + 4, b: H - (dy + y + sh0) + 4 };
  ins.lie = portrait && sw > sh0; scene.setInsets(ins);              // a phone held upright: the tray is wider than tall, so the table lies down in it
  // (cut to the rails' own outline at their height, rounded corners and all, so nothing of the table is cut off and no gap shows)
  const tr = scene.tableOutline(ins), pts = tr.pts.map(([px, py]) => `${(px - dx).toFixed(1)}px ${(py - dy).toFixed(1)}px`);
  pl.style.clipPath = win ? `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${pts.join(', ')}, ${pts[0]})` : 'none';
  let sh = $('#dkShade'); if (!sh) { sh = el('div', { id: 'dkShade' }, el('i')); sg.appendChild(sh); } else if (sh.parentNode !== sg) sg.appendChild(sh);
  boardSides();
  sh.hidden = !win; Object.assign(sh.style, { left: (tr.x - dx - x) + 'px', top: (tr.y - dy - y) + 'px', width: tr.w + 'px', height: tr.h + 'px' }); sh.style.setProperty('--tl', Math.max(5, Math.round(tr.h * 0.045)) + 'px'); sh.style.setProperty('--tr', tr.r.toFixed(1) + 'px');
}
/* The 플레이 boards stand on the desk as blocks, seen as from the eye above it: every upright edge of a block runs towards
   the point on the desk right below the eye (the nadir), as the walls of buildings do in a picture taken looking down.
   The desk leans by CSS (deskLean: perspective P about the middle of its bottom edge, tilted t), so in the desk's own flat
   coordinates that point is P·sin t below the middle of the bottom edge, and the eye P·cos t above the desk. A block's
   foot, h below its face, is then its face drawn smaller about that point (by H / (H + h)); the side between them is
   drawn as SIDE_STEPS such outlines, the face's edge lightest, down to the darkest at the desk. So a board left of the
   middle shows its right side, one right of it its left, and all their near sides - and their far corners, joined, make
   the desk's trapezoid. Pressed, the face goes down part of the way (--kp). */
const SIDE_STEPS = 9;
function boardSides() {
  const pl = $('#deskPlane'), bs = document.querySelectorAll('#dkBoards .bd'); if (!bs.length || !pl.offsetWidth) return;
  const dk = $('#desk'), density = parseFloat(app.style.getPropertyValue('--desk-density')) || 1;
  const t = parseFloat(app.style.getPropertyValue('--tilt')) || 0.26, P = parseFloat(app.style.getPropertyValue('--pp')) || 2300;
  const H = P * Math.cos(t), fx = pl.offsetWidth / 2, fy = pl.offsetHeight + P * Math.sin(t);
  const h = wide ? 36 : 24, k = H / (H + h), kp = H / (H + h * 0.6);
  for (const b of bs) {
    let x = 0, y = 0; for (let n = b; n && n !== pl; n = n.offsetParent) { const scale = n === dk ? density : 1; x += n.offsetLeft * scale; y += n.offsetTop * scale; }
    b.style.setProperty('--fx', (fx - x).toFixed(1) + 'px'); b.style.setProperty('--fy', (fy - y).toFixed(1) + 'px'); b.style.setProperty('--kp', kp.toFixed(5));
    let ly = b.querySelectorAll(':scope > .ly');
    if (ly.length !== SIDE_STEPS) {
      for (const o of ly) o.remove();
      for (let i = SIDE_STEPS; i >= 1; i--) b.insertBefore(el('i', { class: 'ly' + (i === SIDE_STEPS ? ' foot' : i === 1 ? ' rim' : ''),
        style: `--m:${Math.round(100 * (i - 1) / (SIDE_STEPS - 1))}%` }), b.firstChild);
      ly = b.querySelectorAll(':scope > .ly');
    }
    ly.forEach((o, j) => o.style.setProperty('--k', (1 - (1 - k) * (SIDE_STEPS - j) / SIDE_STEPS).toFixed(5)));   // (j 0: the foot)
  }
}
const DESK_PLACES = { play: deskPlay, train: deskTrain, gear: deskGear, shop: deskShop };
// is the live table showing through the desk now? (when it is not, the table behind plays nothing - 90-loop.js)
const deskTableShown = () => $('#dkStage').dataset.win === '1';
/* The wallet: a number that changes rolls to its new value (a clink when it grows), and its chip lights a moment - green
   up, red down. The first paint just shows it. */
const walletShown = { coin: null, dia: null };
function walletPaint() {
  const w = prefs.wallet || {}, n = v => Math.round(v || 0).toLocaleString('ko-KR'), still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  for (const k of ['coin', 'dia']) {
    const chip = $('#dkWallet .' + k), b = chip.querySelector('b'), to = w[k] || 0, from = walletShown[k]; walletShown[k] = to;
    if (from == null || from === to || still) { if (!b._roll) b.textContent = n(to); continue; }
    if (to > from) SND.clink();
    chip.classList.remove('up', 'down'); void chip.offsetWidth; chip.classList.add(to > from ? 'up' : 'down'); setTimeout(() => chip.classList.remove('up', 'down'), 900);
    const t0 = performance.now(), dur = 700, roll = b._roll = {};
    const step = () => { if (b._roll !== roll) return; const p = Math.min(1, (performance.now() - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      b.textContent = n(from + (to - from) * e); if (p < 1) requestAnimationFrame(step); else { b._roll = null; if (to > from) SND.clink(); } };
    requestAnimationFrame(step);
  }
}
// not enough to buy it: the wallet's chip flashes red and shakes
function walletShort(k) { const chip = $('#dkWallet .' + k); if (!chip) return; chip.classList.remove('short'); void chip.offsetWidth; chip.classList.add('short'); setTimeout(() => chip.classList.remove('short'), 700); }
function deskPaint() {
  if (!deskTab) deskTab = trainOf() ? 'train' : 'play';
  for (const b of document.querySelectorAll('#dkTabs .dk-tab')) b.setAttribute('aria-selected', String(st.screen === 'home' && b.dataset.t === deskTab));
  walletPaint();
  // (the name, and under it whether this is a member or a guest - a guest is asked to sign up: 57-account.js)
  $('#dkMe .nm').textContent = prefs.names[0]; $('#dkMe .rc').textContent = debugOn() ? '디버그 모드' : net.on ? (net.me && net.me.joined ? '회원' : '게스트 · 가입하기') : recText(prefs.names[0]);
  const d = { rail: $('#dkRail'), head: $('#dkHead'), stage: $('#dkStage'), foot: $('#dkFoot'), slate: $('#dkSlate') };
  const top = (d.slate.querySelector('.dk-body') || d.slate).scrollTop;
  for (const n of [d.rail, d.head, d.foot, d.slate]) n.textContent = '';
  for (const k of [...d.stage.children]) if (k.id !== 'dkShade') k.remove();
  d.stage.dataset.win = '1';                                         // the live table shows through, unless something else is laid in the tray
  d.head.className = 'dk-head';
  $('#desk').classList.remove('boards'); { const b = $('#dkBoards'); if (b) b.remove(); } app.classList.remove('rkcard', 'hall');
  invite.shown = false;
  DESK_PLACES[deskTab](d);
  if (!invite.shown) invite.leave();                                  // (the invite's code is open only while it shows)
  // the slate: its options scroll if they must, its buttons stay put at the foot
  const acts = d.slate.querySelector('.dk-acts'), body = el('div', { class: 'dk-body' });
  while (d.slate.firstChild && d.slate.firstChild !== acts) body.appendChild(d.slate.firstChild);
  d.slate.insertBefore(body, acts); body.scrollTop = top;
  // (more below than shows: the options fade out at the foot, so it is seen that they scroll - owner 11-10, keys seemed gone)
  const more = () => body.classList.toggle('more', body.scrollHeight - body.clientHeight - body.scrollTop > 4);
  body.addEventListener('scroll', more, { passive: true }); requestAnimationFrame(more); setTimeout(more, 400);
  if (st.screen === 'home') requestAnimationFrame(layout);          // the table sits in the tray, whose size the content just set
}
$('#dkTabs').addEventListener('click', e => { const b = e.target.closest('.dk-tab'); if (!b) return; SND.init(); SND.tap(); deskGo(b.dataset.t); });
press('#dkSet', sheetSettings);
press('#dkMe', () => account.sheet());
press('#dkFull', fullToggle); paintFull();
