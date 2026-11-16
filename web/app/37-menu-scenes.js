/* The menu's cards alive by what they are (owner 11-17: the cards other than 선수증 and 랭킹전 looked stopped; taken: A-E).
   A  each card a small table with its own shot on it, played on the game's physics and kept (highlights.record):
      친구와 플레이 two players a shot each (4구), 레슨 the next lesson's ball potted with a draw, 퍼즐 the next puzzle's answer -
      its line dotted first, the ball after it -, 자유 연습 a break, 아케이드 a 9볼 combination.
   B  one card at a time plays (the spotlight, .mn-on, walking along the cards in sight); the others hold their table still.
   C  a ball meeting a cushion in the card that plays: its edge flashes and the card gives a little (.mn-hit).
   D  컴퓨터 대전: the bot picked stands in the card - its painting, the head over the top - and now and then says hello.
   E  a card's strip (its count or word) shines once when it has changed since it was last seen (prefs.menuSeen).
   Everything here is looks: Math.random and the physics on copies, never the game; nothing runs while the menu is away. */
const menuMv = p => 0.35 + 6.4 * Math.pow(p, 1.6);                   // (a power's cue-ball speed, as game.js vOf - not its break boost)
const MENU_COL = { carom: ['#f4f1ea', '#ffd23c', '#ff4d43', '#ff4d43'] };
const menuFx = { scenes: {}, cards: [], live: new Set(), cur: null, raf: 0, last: 0, next: 0, hit: 0, bubT: 0 };
// a world of n balls from [x, y] for the first ones (the rest off the table), as a highlights snapshot
function menuSnap(P, n, pos, cue = 0) {
  const w = P.makeWorld(n);
  w.balls.forEach((b, i) => { const p = pos[i]; b.on = !!p; if (p) { b.x = b.px = p[0]; b.y = b.py = p[1]; } });
  w.cue = cue; return highlights.snapshot(w);
}
// where every ball stood when the shot was over: the next shot's table
function menuAfter(P, n, snap, tape) {
  const out = [0, 0], pos = [];
  for (let i = 0; i < n; i++) pos.push(highlights.at(tape, i, tape.dur + 1, out) ? [out[0], out[1]] : null);
  return pos;
}
// play a shot on a copy and say what it did
function menuTry(P, n, snap, aim, V, a = 0, b = 0, el = 0) {
  const w = P.makeWorld(n); highlights.restore(w, snap); w.ev = P.newEv();
  P.strike(w, aim, V, a, b, el); return P.run(w, 20);
}
// pool: the shot that pots ball o (cue 0) into the pocket that suits it best, with a little draw - or straight at it
function menuPot(P, n, snap, o, b = -0.35) {
  const c = snap.balls[0], t = snap.balls[o]; let best = null;
  for (const k of P.POCKETS) {
    const dx = k.ax - t[0], dy = k.ay - t[1], d = Math.hypot(dx, dy), gx = t[0] - dx / d * 2 * P.R, gy = t[1] - dy / d * 2 * P.R;
    const aim = Math.atan2(gy - c[1], gx - c[0]), cos = ((gx - c[0]) * dx + (gy - c[1]) * dy) / d / Math.max(1e-6, Math.hypot(gx - c[0], gy - c[1]));
    if (cos < 0.45) continue;
    for (const p of [0.42, 0.55, 0.68]) {
      const ev = menuTry(P, n, snap, aim, menuMv(p), 0, b);
      if (ev.pocketed.some(q => q.id === o) && !ev.pocketed.some(q => q.id === 0)) { const s = cos - p * 0.2; if (!best || s > best.s) best = { s, aim, V: menuMv(p) }; break; }
    }
  }
  return best ? { aim: best.aim, V: best.V, a: 0, b, el: 0 } : { aim: Math.atan2(t[1] - c[1], t[0] - c[0]), V: menuMv(0.5), a: 0, b, el: 0 };
}
// carom (4구): from ball `cue`, the stroke that meets both reds and not the other player's ball
function menuCarom(P, snap, cue) {
  const c = snap.balls[cue];
  for (const r of [2, 3]) {
    const t = snap.balls[r], base = Math.atan2(t[1] - c[1], t[0] - c[0]), d = Math.hypot(t[0] - c[0], t[1] - c[1]), half = Math.asin(Math.min(0.99, 2 * P.R / d));
    for (let i = 0; i <= 24; i++) {
      const f = Math.ceil(i / 2) / 12 * (i % 2 ? 1 : -1), aim = base + half * f * 0.97;
      for (const p of [0.45, 0.6]) for (const [a, b] of [[0, 0.2], [0.4, 0], [-0.4, 0]]) {
        const ev = menuTry(P, 4, snap, aim, menuMv(p), a, b);
        if (ev.hits.includes(2) && ev.hits.includes(3) && !ev.hits.includes(1 - cue)) return { aim, V: menuMv(p), a, b, el: 0 };
      }
    }
  }
  const t = snap.balls[2]; return { aim: Math.atan2(t[1] - c[1], t[0] - c[0]), V: menuMv(0.5), a: 0, b: 0, el: 0 };
}
// each card's scene: { P, n, carom, cols, shots: [{ snap, aim, V, a, b, el, tape }], dotted }
const MENU_SCENES = {
  friend() {
    const P = PH.carom, s1 = menuSnap(P, 4, [[-0.62, -0.18], [0.55, 0.32], [0.12, -0.05], [0.72, -0.28]], 0), k1 = menuCarom(P, s1, 0);
    const t1 = highlights.record(P, 4, Object.assign({ snap: s1, key: -1 }, k1, { aim: k1.aim }));
    const s2 = menuSnap(P, 4, menuAfter(P, 4, s1, t1), 1), k2 = menuCarom(P, s2, 1);
    return { P, n: 4, carom: true, shots: [Object.assign({ snap: s1, key: -1, tape: t1 }, k1), Object.assign({ snap: s2, key: -1 }, k2)] };
  },
  lesson() {
    const P = PH.pool, ids = drills.list.filter(d => d.make).map(d => d.id), id = ids.find(x => !(prefs.lessonProof || {})[x]) || ids[0];
    let L = null; try { L = drills.make(id, P, 1, seededRandom(7), game.vOf); } catch (e) { L = null; }
    if (!L || !L.balls.length) return null;
    const pos = [L.cue]; for (const [num, x, y] of L.balls) pos[num] = [x, y];
    const n = Math.max(2, pos.length), snap = menuSnap(P, n, pos), o = L.balls[0][0];
    return { P, n, shots: [Object.assign({ snap, key: o }, menuPot(P, n, snap, o, -0.42))] };
  },
  puzzle() {
    const P = PH.carom, L = puzzles.list.filter(q => !q.walls && !q.shape && q.sol), q = L.find(x => !prefs.pz.stars[x.id] && pzOpenQ(x)) || L[0];
    if (!q) return null;
    const snap = menuSnap(P, 4, q.balls, 0), [aim, V, a, b, el] = q.sol;
    return { P, n: 4, carom: true, dotted: true, shots: [{ snap, key: -1, aim, V, a, b, el }] };
  },
  free() {
    const P = PH.pool, pos = [[-P.HL / 2, 0.04]], foot = P.HL / 2, R = P.R * 1.005, order = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15]; let k = 0;
    for (let row = 0; row < 5; row++) for (let j = 0; j <= row; j++) pos[order[k++]] = [foot + row * Math.sqrt(3) * R, (j - row / 2) * 2 * R];
    const snap = menuSnap(P, 16, pos);
    return { P, n: 16, shots: [{ snap, key: -1, aim: Math.atan2(-0.04, foot + P.HL / 2), V: menuMv(0.92) * 1.42, a: 0, b: 0.1, el: 0 }] };
  },
  arcade() {
    const P = PH.pool, pos = [[-0.55, -0.2]]; pos[1] = [0.05, 0.02]; pos[9] = [0.62, 0.28]; pos[4] = [0.3, -0.35]; pos[6] = [-0.2, 0.42];
    const snap = menuSnap(P, 10, pos);
    return { P, n: 10, shots: [Object.assign({ snap, key: 9 }, menuPot(P, 10, snap, 1, 0.2))] };
  },
};
function menuScene(id) {
  if (id in menuFx.scenes) return menuFx.scenes[id];
  let s = null; try { s = MENU_SCENES[id] && MENU_SCENES[id](); } catch (e) { s = null; }
  if (s) for (const sh of s.shots) if (!sh.tape) sh.tape = highlights.record(s.P, s.n, sh);
  return (menuFx.scenes[id] = s);
}
const menuColOf = (s, i, sh) => s.carom ? MENU_COL.carom[i] : i === 0 ? '#f4f1ea' : ballCss(i);
// draw a card's table: the shot k at time t (t < 0: still, before it; dotted: the line drawn up to the fraction `line`)
function menuDraw(cv, s, k, t, line) {
  const dpr = Math.min(2, window.devicePixelRatio || 1), cw = cv.clientWidth, ch = cv.clientHeight; if (!cw || !ch) return;
  if (cv.width !== Math.round(cw * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); }
  const g = cv.getContext('2d'), P = s.P, W = cv.width, H = cv.height, rail = Math.max(3, W * 0.045), k2 = Math.min((W - 2 * rail) / (2 * P.HL), (H - 2 * rail) / (2 * P.HW));
  const X = x => W / 2 + x * k2, Y = y => H / 2 - y * k2, sh = s.shots[Math.max(0, k)];
  g.fillStyle = '#4a2f1c'; g.fillRect(0, 0, W, H);
  g.fillStyle = s.carom ? '#2b62a6' : '#1f7a4d'; g.fillRect(X(-P.HL), Y(P.HW), 2 * P.HL * k2, 2 * P.HW * k2);
  if (!s.carom) { g.fillStyle = '#0b0b0d'; for (const p of P.POCKETS) { g.beginPath(); g.arc(X(p.x), Y(p.y), p.r * k2 * 0.85, 0, 6.3); g.fill(); } }
  const r = Math.max(2 * dpr, P.R * k2 * 1.35), cue = sh.snap.cue, path = highlights.path(sh.tape, cue);
  // the line: dotted ahead of the ball (퍼즐), or the cue ball's own trail behind it
  if (path && (s.dotted || t > 0)) {
    g.save(); g.lineWidth = Math.max(1, 1.3 * dpr); g.lineCap = 'round';
    if (s.dotted) { g.setLineDash([2.2 * dpr, 3.2 * dpr]); g.strokeStyle = 'rgba(255,240,190,.85)'; }
    else g.strokeStyle = 'rgba(255,255,255,.35)';
    const upto = s.dotted ? (t > 0 ? sh.tape.dur : sh.tape.dur * (line || 0)) : t;
    g.beginPath(); g.moveTo(X(path[0]), Y(path[1]));
    for (let i = 3; i < path.length; i += 3) {
      if (path[i + 2] > upto) { const t0 = path[i - 1], u = (upto - t0) / Math.max(1e-6, path[i + 2] - t0); g.lineTo(X(path[i - 3] + (path[i] - path[i - 3]) * u), Y(path[i - 2] + (path[i + 1] - path[i - 2]) * u)); break; }
      g.lineTo(X(path[i]), Y(path[i + 1]));
    }
    g.stroke(); g.restore();
  }
  const at = [0, 0];
  for (let i = 0; i < s.n; i++) {
    const b = sh.snap.balls[i]; let on = !!b[2], x = b[0], y = b[1];
    if (t > 0) { on = highlights.at(sh.tape, i, t, at); x = at[0]; y = at[1]; }
    if (!on) continue;
    g.beginPath(); g.arc(X(x), Y(y), r, 0, 6.3); g.fillStyle = menuColOf(s, i, sh); g.fill();
    if (!s.carom && i > 8) { g.beginPath(); g.arc(X(x), Y(y), r * 0.55, 0, 6.3); g.fillStyle = '#f4f1ea'; g.fill(); }
    g.lineWidth = Math.max(0.8, 0.8 * dpr); g.strokeStyle = 'rgba(0,0,0,.45)'; g.stroke();
    if (i === cue && k >= 0 && s.shots.length > 1) { g.beginPath(); g.arc(X(x), Y(y), r * 1.7, 0, 6.3); g.strokeStyle = 'rgba(255,255,255,.55)'; g.stroke(); }
  }
}
/* menuPaint's cards, handed over: their tables drawn still, the spotlight started. Called after every paint (the nodes may
   be new); the walk goes on from where it was. */
function menuScenes(cards) {
  menuFx.cards = cards.filter(c => c.querySelector('canvas.mn-scene'));
  for (const c of menuFx.cards) { const s = menuScene(c.dataset.k); if (s) menuDraw(c.querySelector('canvas.mn-scene'), s, 0, -1, 0); }
  if (!menuFx.raf) menuFx.raf = requestAnimationFrame(menuTick);
}
function menuLive(card, on) { if (on) menuFx.live.add(card); else menuFx.live.delete(card); }
function menuTick(now) {
  menuFx.raf = 0;
  if (!menuShown() || st.screen !== 'home') { menuFx.cur = null; return; }
  menuFx.raf = requestAnimationFrame(menuTick);
  const dt = Math.min(0.05, (now - (menuFx.last || now)) / 1000); menuFx.last = now;
  menuBot(dt);
  let c = menuFx.cur;
  if (c && !c.card.isConnected) c = menuFx.cur = null;
  if (!c) {
    if (now < menuFx.next) return;
    const seen = menuFx.cards.filter(x => x.isConnected && menuFx.live.has(x) && menuScene(x.dataset.k));
    if (!seen.length) return;
    const i = (seen.indexOf(menuFx.prev) + 1) % seen.length, card = seen[i], s = menuScene(card.dataset.k);
    c = menuFx.cur = { card, s, k: 0, t: s.dotted ? -1.1 : -0.45, cv: card.querySelector('canvas.mn-scene'), ev: 0 };
    menuFx.prev = card; card.classList.add('mn-on');
  }
  c.t += dt * 1.15;
  const sh = c.s.shots[c.k], tape = sh.tape, end = Math.min(tape.dur, 4.2);
  // C: the cushions met in this card's shot
  while (c.ev < tape.events.length && tape.events[c.ev].time <= c.t) {
    const e = tape.events[c.ev++];
    if (e.t === 'rail' && e.v > 0.25 && now - menuFx.hit > 140) { menuFx.hit = now; c.card.classList.remove('mn-hit'); void c.card.offsetWidth; c.card.classList.add('mn-hit'); }
  }
  menuDraw(c.cv, c.s, c.k, c.t > 0 ? Math.min(c.t, end) : -1, c.s.dotted && c.t < 0 ? 1 + c.t / 1.1 : 0);
  if (c.t > end + 0.9) {
    if (c.k + 1 < c.s.shots.length) { c.k++; c.t = -0.5; c.ev = 0; return; }
    c.card.classList.remove('mn-on', 'mn-hit'); menuDraw(c.cv, c.s, 0, -1, 0);
    menuFx.cur = null; menuFx.next = now + 600;
  }
}
/* D: 컴퓨터 대전 - the bot picked, painted, standing in the card with its head over the top; now and then its hello. */
function menuBotArt() {
  const b = typeof botNow === 'function' ? botNow() : null;
  if (!b || !b.pic) return null;
  return el('span', { class: 'mn-bot', 'aria-hidden': 'true' }, [el('i', { class: 'art', style: `background-image:url(ui/bot-${b.id}.webp)` }),
    el('span', { class: 'mn-bub' }, [el('p', { lang: b.lang, dir: 'auto', text: (botLines(b, 'hello')[0] || [b.line])[0] })])]);
}
function menuBot(dt) {
  const card = menuFx.cards.length && document.querySelector('.mn-card.k-cpu'); if (!card || !menuFx.live.has(card)) return;
  menuFx.bubT += dt;
  const bub = card.querySelector('.mn-bub'); if (!bub) return;
  if (menuFx.bubT > 13) { menuFx.bubT = 0; bub.classList.add('on'); setTimeout(() => bub.classList.remove('on'), 3600); }
}
// E: has a card's strip changed since it was last seen? (the first time, nothing is new)
function menuStripNew(id, text) {
  const seen = prefs.menuSeen || (prefs.menuSeen = {}), was = seen[id];
  if (was === text) return false;
  seen[id] = text; savePrefs(); return was != null;
}
