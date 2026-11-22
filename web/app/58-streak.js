/* ================= 연속 출석: the days in a row, the fire round the account's badge, the day's first game ================= */
/* (owner 11-22) A day counts with one game played to its end - a match finished, a puzzle solved, a lesson's shot made
   good. No rewards: while the run lasts the account's badge burns (the bar's and the 선수증's), its fire's colour by how
   long - 1일 주황, 7일 빨강, 30일 리그 블루, 100일 보라, 365일 금빛. No number on it.
   얼음: a missed day is saved by one, by itself, if there is one (at most 2 kept, one more for every 3 days played) -
   nothing says how many there are. A saved day is not counted in the run: it only keeps it from breaking. The badge's
   fire is ice-blue while a missed day is held that way and today is not yet played.
   The day is this device's calendar day, by the server's clock where it has been heard (clock, 00-state.js).
   After the day's first game, back on the desk: the celebration (S4, after Duolingo's) - the fire leaping up, the count
   rolling on, the week with today filling in (a saved day in ice), how far to the next colour. */
const STREAK_TIERS = [[365, 't365', '금빛'], [100, 't100', '보라'], [30, 't30', '파란'], [7, 't7', '빨간'], [1, 't1', '주황']];
const streakTier = n => (STREAK_TIERS.find(t => n >= t[0]) || STREAK_TIERS[4])[1];
const dayKey = ms => { const d = new Date(ms); return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`; };
const dayNo = k => { const [y, m, d] = k.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); };
const dayOf = n => { const d = new Date(n * 864e5); return `${d.getUTCFullYear()}-${two(d.getUTCMonth() + 1)}-${two(d.getUTCDate())}`; };
const attend = {
  cel: null,                                                     // the celebration waiting for the desk
  data() { const s = store.get('streak', null); return s && typeof s === 'object' ? Object.assign({ last: null, n: 0, best: 0, ice: 0, charge: 0, log: {} }, s) : { last: null, n: 0, best: 0, ice: 0, charge: 0, log: {} }; },
  today: () => dayKey(clock.now()),
  // where the run stands now: its count, and 'on' (played today or yesterday), 'ice' (days missed since, all saved) or 'off'
  now() {
    const s = attend.data(), t = attend.today(); if (!s.last || !s.n) return { n: 0, state: 'off' };
    const missed = dayNo(t) - dayNo(s.last) - 1;
    return missed <= 0 ? { n: s.n, state: 'on' } : missed <= s.ice ? { n: s.n, state: 'ice' } : { n: 0, state: 'off' };
  },
  // a game played to its end: the day counted (once a day), the missed days before it saved or the run begun again
  played() {
    const s = attend.data(), t = attend.today(); if (s.last === t) return;
    const was = attend.now(), missed = s.last ? dayNo(t) - dayNo(s.last) - 1 : 0, kept = !!s.last && s.n > 0 && missed <= s.ice;
    const froze = [];
    if (kept) { s.ice -= missed; for (let i = 1; i <= missed; i++) { const k = dayOf(dayNo(s.last) + i); s.log[k] = 'f'; froze.push(k); } s.n += 1; }
    else s.n = 1;
    s.log[t] = 'p'; s.last = t; s.best = Math.max(s.best || 0, s.n);
    if (++s.charge >= 3) { s.charge = 0; s.ice = Math.min(2, s.ice + 1); }         // (3 days played: one more, 2 at most)
    for (const k of Object.keys(s.log)) if (dayNo(t) - dayNo(k) > 21) delete s.log[k];
    store.set('streak', s);
    attend.cel = { from: kept ? was.n : 0, n: s.n, froze };
    streakPaint();
  },
  // back on the desk: the day's celebration, once
  show() {
    const c = attend.cel; if (!c || st.screen !== 'home' || $('#cel')) return; attend.cel = null;
    setTimeout(() => { if (st.screen === 'home') celebrate(c); }, 500);
  },
};

/* ---- the fire round a badge (owner 11-22: as the old 연승 cards' fire - 60-records.js before 11-09): one flame round the
   badge's edge, drawn afresh each frame. The edge is walked point by point; at each the fire stands as tall as a slowly
   drifting noise says, leaning upwards as fire does - tall over the top, licking up the sides, low under the bottom. Three
   layers, outer colour to white heat, the badge itself left clear. */
const FIRE_COL = { t1: ['#ff7a12', '#ffb43a', '#fff1bf'], t7: ['#ff2d1a', '#ff8a3c', '#ffe9a8'], t30: ['#1a66d6', '#4fc3ff', '#e6f7ff'],
  t100: ['#7a3dff', '#d46bff', '#ffe3ff'], t365: ['#e9a100', '#ffd84d', '#fffbe0'], ice: ['#3f9fd8', '#9fdcff', '#f2fbff'] };
const fnoise = (() => { const T = new Float32Array(512); let sd = 99; for (let i = 0; i < 512; i++) { sd = (sd * 1664525 + 1013904223) >>> 0; T[i] = sd / 4294967296; }
  const at = (x, y) => T[((x & 31) + (y & 15) * 32) & 511];
  return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1); return a + (b - a) * sx + (c - a + (a - b + d - c) * sx) * sy; }; })();
const FIRE_PAD = 2.2, FIRE_N = 96;                               // the canvas: the badge and 2.2 radii round it; points round the edge
function fireDraw(cv, t) {
  const m = cv._m, r = m.r, R0 = r * m.k, W = m.W, dpr = m.dpr, g = cv.getContext('2d'), cols = FIRE_COL[cv.dataset.t] || FIRE_COL.t1, c = W / 2;
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, W);
  const lumps = 13, seed = m.seed;
  for (let L = 0; L < 3; L++) {
    const reach = [1, 0.62, 0.32][L], sp = [1.5, 2.1, 2.9][L];
    g.beginPath();
    for (let i = 0; i <= FIRE_N; i++) {
      const a = (i % FIRE_N) / FIRE_N * Math.PI * 2, nx = Math.cos(a), ny = Math.sin(a), u = (i % FIRE_N) / FIRE_N * lumps + seed;
      const upw = Math.max(0, -ny), side = Math.abs(nx), tall = r * (0.08 + 1.25 * upw * upw * upw + 0.3 * side * (1 - upw));   // how tall fire may stand here
      const n1 = fnoise(u, t * sp + L * 5), n2 = fnoise(u * 3 + 9, t * sp * 1.7 + L * 3), tongue = Math.pow(n1, 2.4) * 1.5 + Math.pow(n2, 2) * 0.4;
      const hgt = Math.min(r * 1.75, tall * reach * (0.18 + 1.15 * tongue)), lean = 0.55 + 0.45 * upw;   // off the sides it bends upwards
      const dx = nx * lean, dy = ny * lean - (1 - upw) * 0.75 * (ny > 0.5 ? 0 : 1), dl = Math.hypot(dx, dy) || 1, sway = (fnoise(u + 3, t * 0.9) - 0.5) * r * 0.25 * upw;
      const x = c + nx * R0 + dx / dl * hgt + sway, y = c + ny * R0 + dy / dl * hgt;
      if (i) g.lineTo(x, y); else g.moveTo(x, y);
    }
    g.closePath(); g.moveTo(c + R0, c); g.arc(c, c, R0, 0, Math.PI * 2, true);
    g.shadowColor = cols[0]; g.shadowBlur = L ? 0 : r * 0.5; g.globalAlpha = [0.78, 0.92, 0.95][L]; g.fillStyle = cols[L]; g.fill('evenodd');
  }
  g.globalAlpha = 1; g.shadowBlur = 0;
}
let fireRaf = 0, fireLast = 0;
function fireTick(now) {
  fireRaf = 0; if (st.screen !== 'home' || document.hidden) return;
  const list = document.querySelectorAll('canvas.fire'); if (!list.length) return;
  fireRaf = requestAnimationFrame(fireTick);
  if (now - fireLast < 33) return; fireLast = now;               // (about 30 a second: it is a small thing)
  const t = now / 1000;
  for (const cv of list) {
    // (its size is measured once, and again only when the page was laid out again - never each frame)
    if (!cv._m || cv._m.lay !== layoutN) {
      const av = cv.parentElement, r = av ? av.offsetWidth / 2 : 0; if (!r) { cv._m = null; continue; }
      const W = Math.ceil(r * 2 * (1 + FIRE_PAD)), dpr = Math.min(2, window.devicePixelRatio || 1);
      cv._m = { lay: layoutN, r, W, dpr, k: +cv.dataset.k || 1, seed: (cv._m && cv._m.seed) || Math.random() * 20 };
      cv.width = Math.round(W * dpr); cv.height = Math.round(W * dpr); cv.style.width = cv.style.height = W + 'px';
    }
    fireDraw(cv, t);
  }
}
const fireLight = () => { if (!fireRaf) fireRaf = requestAnimationFrame(fireTick); };
document.addEventListener('visibilitychange', () => { if (!document.hidden) fireLight(); });
// the fire on a badge (an element drawn round, positioned), as the run stands; k: where the badge's own edge is, in radii
function fireOn(av, k) {
  const s = attend.now(), old = av.querySelector('canvas.fire');
  av.classList.toggle('lit', s.state !== 'off');
  if (s.state === 'off') { if (old) old.remove(); return; }
  const cv = old || av.appendChild(el('canvas', { class: 'fire', 'aria-hidden': 'true' }));
  cv.dataset.t = s.state === 'ice' ? 'ice' : streakTier(s.n); cv.dataset.k = k || 1;
  av.setAttribute('aria-label', `${s.n}일 연속 출석` + (s.state === 'ice' ? ' (얼린 날)' : ''));
  fireLight();
}
// the bar's badge (the 선수증's is put on as the card is made - 37-desk-menu.js)
function streakPaint() { const av = $('#dkMe .av'); if (av) fireOn(av, 1.2); for (const a of document.querySelectorAll('.mn-pc.me .av')) fireOn(a, 1); }

/* ---- the celebration (S4): drawn flames (no emoji - owner 11-22), the plain one (F1) and, for a saved day, the faceted ice
   one (F3) */
const FLAME_TONE = { t1: ['#ff8a1f', '#ffc23d', '#fff3c4', '#e56a00'], t7: ['#ff4d1f', '#ff9f1f', '#ffe68a', '#d8340d'], t30: ['#1a66d6', '#4fc3ff', '#e6f7ff', '#0d4aa8'],
  t100: ['#7a3dff', '#d46bff', '#ffe3ff', '#5a22d0'], t365: ['#e9a100', '#ffd84d', '#ffffff', '#b97c00'], ice: ['#6cc4f2', '#bfe8ff', '#ffffff', '#3f9fd8'], white: ['#ffffff', '#ffffff', '#ffffff', '#ffffff'] };
function flameSvg(t) {
  const [o, m, i, s] = FLAME_TONE[t] || FLAME_TONE.t1;
  if (t === 'ice') return `<svg viewBox="0 0 100 110" class="cf" aria-hidden="true"><path d="M54 4 L84 52 L80 86 L50 106 L20 88 L16 58 L32 36 L40 54 Z" fill="${o}"/>
    <path d="M54 4 L40 54 L50 106 L20 88 L16 58 L32 36 L40 54" fill="${s}" opacity=".5"/><path d="M54 40 L72 68 L68 92 L50 102 L32 92 L30 72 L40 60 L46 72 Z" fill="${m}"/>
    <path d="M54 40 L46 72 L50 102 L32 92 L30 72 L40 60 L46 72" fill="${o}" opacity=".25"/><path d="M51 70 L60 84 L58 96 L50 101 L42 96 L41 86 Z" fill="${i}"/>
    <path d="M54 4 L50 106" stroke="#fff" stroke-width="2" opacity=".7"/></svg>`;
  if (t === 'white') return `<svg viewBox="0 0 100 110" class="cf" aria-hidden="true"><path d="M52 4 C60 24 86 36 86 66 C86 90 70 106 50 106 C30 106 14 90 14 68 C14 52 23 41 33 34 C32 46 36 54 43 57 C38 37 43 19 52 4 Z" fill="#fff"/></svg>`;
  return `<svg viewBox="0 0 100 110" class="cf" aria-hidden="true">
    <path d="M52 4 C60 24 86 36 86 66 C86 90 70 106 50 106 C30 106 14 90 14 68 C14 52 23 41 33 34 C32 46 36 54 43 57 C38 37 43 19 52 4 Z" fill="${o}"/>
    <path d="M33 34 C23 41 14 52 14 68 C14 90 30 106 50 106 C38 100 28 88 28 70 C28 56 32 44 33 34 Z" fill="${s}" opacity=".55"/>
    <path d="M53 42 C60 55 73 62 73 79 C73 93 63 101 50 101 C37 101 28 93 28 81 C28 70 34 63 41 59 C41 67 45 72 50 73 C46 61 48 50 53 42 Z" fill="${m}"/>
    <path d="M50 70 C56 77 62 81 62 89 C62 96 57 100 50 100 C43 100 38 96 38 90 C38 84 42 80 46 77 C46 82 48 84 50 84 C49 79 49 74 50 70 Z" fill="${i}"/>
    <ellipse cx="64" cy="60" rx="4.5" ry="8" transform="rotate(-25 64 60)" fill="#fff" opacity=".45"/>
    ${t === 't365' ? '<path d="M84 20 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z M14 26 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z" fill="#fff6c8"/>' : ''}</svg>`;
}
function celebrate(c) {
  const s = attend.data(), t = attend.today(), tn = dayNo(t), tier = streakTier(c.n), ice = c.froze.length > 0;
  // the week, Monday first: played, saved (just now: filling in ice), missed, today filling in, days to come
  const mon = tn - (new Date(tn * 864e5).getUTCDay() + 6) % 7, DAYS = ['월', '화', '수', '목', '금', '토', '일'];
  const wk = DAYS.map((d, i) => {
    const k = dayOf(mon + i), n = mon + i, now = c.froze.includes(k);
    const cls = n > tn ? 'fut' : n === tn ? 'td' : s.log[k] === 'p' ? 'on' : s.log[k] === 'f' ? (now ? 'frz' : 'icy') : 'miss';
    const ic = cls === 'frz' || cls === 'icy' ? flameSvg('ice') : cls === 'fut' || cls === 'miss' ? '' : flameSvg('white');
    return `<span class="${cls}" style="animation-delay:${(1.9 + i * 0.07).toFixed(2)}s"><i>${ic}</i>${n === tn ? '오늘' : d}</span>`;
  }).join('');
  const next = STREAK_TIERS.slice().reverse().find(q => q[0] > c.n), up = STREAK_TIERS.find(q => q[0] === c.n && q[0] > 1);
  const sparks = Array.from({ length: 12 }, (_, i) => { const a = i / 12 * Math.PI * 2, r = 120 + (i % 3) * 30; return `<i class="sp" style="--dx:calc(${(Math.cos(a) * r).toFixed(1)}*var(--u));--dy:calc(${(Math.sin(a) * r - 40).toFixed(1)}*var(--u))${i % 2 ? ';background:#fff3c4' : ''}"></i>`; }).join('');
  const say = up ? `불꽃이 ${up[2]}색으로 바뀌었어요` : ice ? (c.froze.length > 1 ? `${c.froze.length}일 빠졌지만 얼음이 지켜 줬어요` : '어제 빠졌지만 얼음이 지켜 줬어요') : `내일도 한 판이면 ${c.n + 1}일`;
  const box = el('div', { id: 'cel', class: (ice ? 'ice ' : '') + 'c-' + tier, role: 'dialog', 'aria-label': `${c.n}일 연속 출석` });
  box.innerHTML = `<div class="bg"></div><div class="wrap"><div class="glow"></div>${sparks}<div class="fl">${flameSvg(tier)}</div>
    <div class="num"><div class="npop"><div class="roll"><b>${c.from}</b><b>${c.n}</b></div></div></div>
    <div class="t1">일 연속 출석!</div><div class="t2">${say}</div>
    <div class="wk">${wk}</div>
    ${next ? `<div class="nx">${flameSvg(next[1])}<span>${next[0]}일이면 ${next[2]} 불꽃</span><span class="bar"><i style="--to:${(c.n / next[0] * 100).toFixed(1)}%"></i></span><span>${c.n} / ${next[0]}</span></div>` : ''}
    </div>`;
  const ok = el('button', { class: 'ok', text: '계속', onclick: () => { SND.tap(); box.classList.add('out'); setTimeout(() => box.remove(), 300); } });
  box.querySelector('.wrap').appendChild(ok);
  app.appendChild(box); SND.good();
}
