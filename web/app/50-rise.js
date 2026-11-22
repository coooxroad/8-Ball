/* ================= a ranked game's rating, before the receipt (owner 11-22, 시안 A1 원형 게이지) =================
   After 승리 / 패배 and before the receipt (50-receipt.js): the tier's ball in the middle of a ring that is the way through
   the tier, the rating counted from what it was to what it is, then the coins the game paid flying up into the purse.
   The ring as a game's health bar shows a change (owner 11-22: "체력바 증감 직관적으로"): a gain is shown first as a pale
   segment of the ring from the old place to the new, then the gold fill runs up into it; a loss drops the fill at once
   to the new place and leaves the lost part in red, which drains away after a moment - so the size of the change is
   seen before anything moves. Near the next tier (from 70% of the way) the ring runs from this tier's colour into the
   next one's, and the ball is being painted over in the next tier's ball from below - the edge between them rippling,
   all but the next tier's ball at the very top (on this screen only: the 선수증 keeps its ball). A tap skips to the end
   and goes on. rise.run(o, done): o = { from, to, coins }; done() shows the receipt. */
const rise = {
  box: null, raf: 0, t: 0, done: null,
  run(o, done) {
    rise.stop(); rise.done = done;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || o.from == null || o.to == null) return done();
    const tier = tierAt(o.from), ti = tier.i, last = tier.hi == null, gain = o.to >= o.from, name = tier.name;
    const u = receipt.scale();
    const ring = el('canvas', { class: 'rs-ring' }), num = el('b', { class: 'rs-num' }), dv = el('span', { class: 'rs-dv' + (gain ? ' up' : ' down'), text: `${gain ? '▲' : '▼'}${Math.abs(o.to - o.from)}` });
    const left = el('div', { class: 'rs-next' }), purse = el('div', { class: 'rs-purse' }, [el('i'), el('b', { text: '+0' })]);
    const box = rise.box = el('div', { id: 'rise', style: `--u:${u.toFixed(3)}` }, [el('i', { class: 'shade' }),
      el('div', { class: 'rs-mid' }, [el('div', { class: 'rs-tier', text: name }), ring, el('div', { class: 'rs-val' }, [num, dv]), left]),
      o.coins ? purse : null, el('small', { class: 'rs-tap', text: '탭하면 넘어가요' })]);
    box.addEventListener('pointerdown', e => { e.preventDefault(); rise.t = Math.max(rise.t, 9); });
    document.body.appendChild(box);
    const S = Math.round(250 * u), dpr = Math.min(2, devicePixelRatio || 1); ring.width = ring.height = Math.round(S * dpr); ring.style.width = ring.style.height = S + 'px';
    const g = ring.getContext('2d'); g.scale(dpr, dpr);
    const ball = new Image(), nextBall = new Image(); ball.src = `ui/tier-ball-${TIERS[ti][0]}.webp`; if (!last) nextBall.src = `ui/tier-ball-${TIERS[ti + 1][0]}.webp`;
    const c0 = TIER_TONE[TIERS[ti][0]].flat, c1 = last ? c0 : TIER_TONE[TIERS[ti + 1][0]].flat;
    // the timeline (seconds): the ghost shown at .3; a gain's fill runs .55-1.55; a loss's red drains .95-1.75; the coins
    // fly from 1.9; on to the receipt at 3.4 (the coins' last at about 3.1)
    let t0 = performance.now(), coinsAt = 0;
    rise.t = 0;
    const frame = () => {
      if (!rise.box) return;
      const now = performance.now(); rise.t += (now - t0) / 1000; t0 = now; const t = rise.t;
      const { p0, p1, ghost, fill, trail, shown, near, paint, left: say } = rise.at(o, t);
      num.textContent = shown.toLocaleString('ko-KR');
      left.textContent = say;
      // the ring
      const R = S / 2, w = Math.max(8, S * 0.055), r = R - w / 2 - 2, a0 = -Math.PI / 2, arc = (f0, f1, style) => { if (f1 - f0 < 1e-4) return; g.strokeStyle = style; g.beginPath(); g.arc(R, R, r, a0 + f0 * Math.PI * 2, a0 + f1 * Math.PI * 2); g.stroke(); };
      g.clearRect(0, 0, S, S); g.lineWidth = w; g.lineCap = 'round';
      arc(0, 1, 'rgba(255,255,255,.13)');
      let fillStyle = c0;
      if (near) { const gr = g.createConicGradient ? g.createConicGradient(a0, R, R) : null; if (gr) { gr.addColorStop(0, c0); gr.addColorStop(0.6, c0); gr.addColorStop(1, c1); fillStyle = gr; } }
      if (ghost && gain) arc(p0, trail, `rgba(255,248,220,${0.55 + 0.25 * Math.sin(t * 9)})`);   // (the gain to come, pale and pulsing)
      if (ghost && !gain) arc(p1, trail, '#e5584f');                                             // (the loss, red, draining)
      arc(0, fill, fillStyle);
      if (fill > 0.01) { const a = a0 + fill * Math.PI * 2; g.fillStyle = '#fff'; g.shadowColor = c1; g.shadowBlur = 14; g.beginPath(); g.arc(R + r * Math.cos(a), R + r * Math.sin(a), w * 0.42, 0, 7); g.fill(); g.shadowBlur = 0; }
      // the ball, and near the next tier its next ball rising over it from below, the edge rippling
      const B = S * 0.66, bx = R - B / 2, by = R - B / 2;
      if (ball.complete && ball.naturalWidth) g.drawImage(ball, bx, by, B, B);
      if (paint > 0 && nextBall.complete && nextBall.naturalWidth) {
        const level = by + B * (1 - (0.06 + 0.9 * paint)), amp = B * 0.035 * (1 - paint * 0.5);
        g.save(); g.beginPath(); g.moveTo(bx, by + B + 2);
        for (let x = 0; x <= B; x += 3) g.lineTo(bx + x, level + Math.sin(x / B * 9 + t * 3.1) * amp + Math.sin(x / B * 4 - t * 1.7) * amp * 0.6);
        g.lineTo(bx + B, by + B + 2); g.closePath(); g.clip(); g.drawImage(nextBall, bx, by, B, B); g.restore();
      }
      // the coins: up from the ball into the purse, each adding to it
      if (o.coins && t > 1.9) {
        if (!coinsAt) { coinsAt = 1; purse.classList.add('on'); rise.coins(box, ring, purse, o.coins); }
      }
      if (t > 3.4) return rise.finish();
      rise.raf = requestAnimationFrame(frame);
    };
    rise.raf = requestAnimationFrame(frame);
    setTimeout(() => { if (rise.box === box) (gain ? SND.good : SND.bad)(); }, gain ? 1500 : 900);
  },
  /* Where the gauge is at t seconds in, for o = { from, to } (numbers only - checked in test/browser/result.js):
     p0, p1 - the old and new rating as parts of the ring (the way through the tier the game began in: a rating that left it
     shows as an empty or a full ring; the top tier's is always full); ghost - the change shown (from .3 s); fill - the
     gold, trail - the far end of the pale gain to come or of the red loss draining; shown - the number counted so far;
     near - within 30% of the next tier, paint - how far its ball has risen over this one (0..1); left - the words under it. */
  at(o, t) {
    const tier = tierAt(o.from), { lo, hi } = tier, last = hi == null;
    const part = v => last ? 1 : clamp01((v - lo) / (hi - lo));
    const p0 = part(o.from), p1 = part(o.to), gain = o.to >= o.from;
    const ghost = t > 0.3, run = gain ? easeOut((t - 0.55) / 1.0) : easeOut((t - 0.95) / 0.8);
    const fill = gain ? p0 + (p1 - p0) * run : p1, trail = gain ? p1 : p0 + (p1 - p0) * run;   // (a loss: the fill is already down; the red trails)
    const shown = Math.round(o.from + (o.to - o.from) * (gain ? run : Math.max(run, t > 0.3 ? 1 : 0)));
    const near = !last && Math.max(fill, p0) >= 0.7, paint = near ? clamp01((fill - 0.7) / 0.3) : 0;
    return { p0, p1, gain, ghost, fill, trail, shown, near, paint, left: last ? '최고 등급' : `${tier.next}까지 ${Math.max(0, hi - shown)}` };
  },
  // the coins flying (B, owner 11-21): a few coin pictures from the ball up to the purse, its number counting up
  coins(box, from, purse, n) {
    const a = from.getBoundingClientRect(), b = purse.getBoundingClientRect(), k = Math.min(10, Math.max(4, Math.round(n / 10))), out = purse.querySelector('b');
    for (let i = 0; i < k; i++) {
      const c = el('i', { class: 'rs-coin' }); box.appendChild(c);
      const sx = a.left + a.width / 2 + (Math.random() - 0.5) * a.width * 0.4, sy = a.top + a.height / 2 + (Math.random() - 0.5) * a.height * 0.3;
      const ex = b.left + 14, ey = b.top + b.height / 2, mx = (sx + ex) / 2 + (Math.random() - 0.5) * 160, my = Math.min(sy, ey) - 80 - Math.random() * 80;
      const kf = Array.from({ length: 9 }, (_, j) => { const q = j / 8, x = (1 - q) * (1 - q) * sx + 2 * (1 - q) * q * mx + q * q * ex, y = (1 - q) * (1 - q) * sy + 2 * (1 - q) * q * my + q * q * ey;
        return { transform: `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${(1.1 - 0.4 * q).toFixed(2)})`, opacity: q > 0.92 ? 0 : 1 }; });
      c.animate(kf, { duration: 700, delay: i * 70, easing: 'cubic-bezier(.45,0,.55,1)', fill: 'both' }).finished.then(() => {
        c.remove(); out.textContent = '+' + Math.round(n * (i + 1) / k).toLocaleString('ko-KR'); purse.animate([{ transform: 'scale(1.12)' }, { transform: 'none' }], { duration: 160 }); SND.tap(); });
    }
  },
  // a ranked game (50-match.js): its rating comes from the room a moment after the end - waited for a little, or the
  // receipt straight away
  wait(done) {
    const t0 = performance.now(), go = () => {
      const o = ranked.on, r = o && o.result;
      if (r && r.dama) { const me = o.seat; return rise.run({ from: o.dama, to: r.dama[me], coins: (r.coins && r.coins[me]) || 0 }, done); }
      if (!o || performance.now() - t0 > 2500 || st.screen !== 'play') return done();
      setTimeout(go, 120);
    };
    go();
  },
  finish() { const d = rise.done; rise.done = null; rise.stop(); if (d) d(); },
  stop() { cancelAnimationFrame(rise.raf); if (rise.box) { const b = rise.box; rise.box = null; b.classList.add('out'); setTimeout(() => b.remove(), 300); } },
};
