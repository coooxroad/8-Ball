/* ---- the desk as a leaning plane: layout() in 10-ui.js calls these two on the desk's home ---- */
// How far the desk leans, and how much bigger than the screen the plane must be: a point h up the plane from its bottom
// edge shows Y = h cos(t) P / (P + h sin(t)) up the screen, so the plane is made tall enough that its far edge reaches the
// top bar, its sides wide enough that the far corners still reach the screen's edges, and the desk on it starts just
// under the bar.
function deskLean(W, H, portrait) {
  const t = (wide ? 15 : portrait ? 12 : 10) * Math.PI / 180, P = 2.8 * Math.max(H, 600), c = Math.cos(t), sn = Math.sin(t);
  const bar = wide ? 62 : portrait ? 56 : 48, up = Y => Y * P / (c * P - Y * sn), hb = up(H - bar), k = P / (P + hb * sn);
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
  let x = dk.offsetLeft, y = dk.offsetTop; for (let n = sg; n && n !== dk; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
  const dx = pl.offsetLeft, dy = pl.offsetTop, sw = sg.offsetWidth, sh0 = sg.offsetHeight;   // (x, y: the stage in the plane; dx, dy: the plane in the app)
  const ins = { t: dy + y + 4, l: dx + x + 4, r: W - (dx + x + sw) + 4, b: H - (dy + y + sh0) + 4 };
  ins.lie = portrait && sw > sh0; scene.setInsets(ins);              // a phone held upright: the tray is wider than tall, so the table lies down in it
  // (cut to the rails' own outline at their height, rounded corners and all, so nothing of the table is cut off and no gap shows)
  const tr = scene.tableOutline(ins), pts = tr.pts.map(([px, py]) => `${(px - dx).toFixed(1)}px ${(py - dy).toFixed(1)}px`);
  pl.style.clipPath = win ? `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${pts.join(', ')}, ${pts[0]})` : 'none';
  let sh = $('#dkShade'); if (!sh) { sh = el('div', { id: 'dkShade' }, el('i')); sg.appendChild(sh); } else if (sh.parentNode !== sg) sg.appendChild(sh);
  sh.hidden = !win; Object.assign(sh.style, { left: (tr.x - dx - x) + 'px', top: (tr.y - dy - y) + 'px', width: tr.w + 'px', height: tr.h + 'px' }); sh.style.setProperty('--tl', Math.max(5, Math.round(tr.h * 0.045)) + 'px'); sh.style.setProperty('--tr', tr.r.toFixed(1) + 'px');
}
const DESK_PLACES = { play: deskPlay, train: deskTrain, gear: deskGear, shop: deskShop };
// is the live table showing through the desk now? (when it is not, the table behind plays nothing - 90-loop.js)
const deskTableShown = () => $('#dkStage').dataset.win === '1';
function deskPaint() {
  if (!deskTab) deskTab = trainOf() ? 'train' : 'play';
  for (const b of document.querySelectorAll('#dkTabs .dk-tab')) b.setAttribute('aria-selected', String(st.screen === 'home' && b.dataset.t === deskTab));
  $('#dkRec').setAttribute('aria-pressed', String(st.screen === 'records'));
  { const w = prefs.wallet || {}, n = v => (v || 0).toLocaleString('ko-KR'); $('#dkWallet .coin b').textContent = n(w.coin); $('#dkWallet .dia b').textContent = n(w.dia); }
  $('#dkMe .nm').textContent = prefs.names[0]; $('#dkMe .rc').textContent = recText(prefs.names[0]);
  const d = { rail: $('#dkRail'), head: $('#dkHead'), stage: $('#dkStage'), foot: $('#dkFoot'), slate: $('#dkSlate') };
  const top = (d.slate.querySelector('.dk-body') || d.slate).scrollTop;
  for (const n of [d.rail, d.head, d.foot, d.slate]) n.textContent = '';
  for (const k of [...d.stage.children]) if (k.id !== 'dkShade') k.remove();
  d.stage.dataset.win = '1';                                         // the live table shows through, unless something else is laid in the tray
  d.head.className = 'dk-head';
  $('#desk').classList.remove('boards'); { const b = $('#dkBoards'); if (b) b.remove(); }
  DESK_PLACES[deskTab](d);
  // the slate: its options scroll if they must, its buttons stay put at the foot
  const acts = d.slate.querySelector('.dk-acts'), body = el('div', { class: 'dk-body' });
  while (d.slate.firstChild && d.slate.firstChild !== acts) body.appendChild(d.slate.firstChild);
  d.slate.insertBefore(body, acts); body.scrollTop = top;
  if (st.screen === 'home') requestAnimationFrame(layout);          // the table sits in the tray, whose size the content just set
}
$('#dkTabs').addEventListener('click', e => { const b = e.target.closest('.dk-tab'); if (!b) return; SND.init(); SND.tap(); deskGo(b.dataset.t); });
press('#dkSet', sheetSettings);
press('#dkRec', () => { if (st.screen === 'records') goHome(true); else { showRecords(); deskPaint(); } });
press('#dkMe', () => sheetName(0));
