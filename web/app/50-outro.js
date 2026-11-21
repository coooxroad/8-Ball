/* ================= the end of a match: 승리 / 패배 over the table, then the result =================
   Owner 11-21: the result does not come up the moment a match ends. The controls go, the table darkens, and the word comes
   - 승리 in heavy white over the table, confetti bursting and raining and the camera drawing back round the table as a
   film's would (owner 11-21, from a table-tennis game's win: no laurels or rays - confetti, winCam), 패배 dropping in,
   cold, 무승부 plain -
   with the score under it. A moment later the result comes up beneath it: the word glides down into the score sheet's title
   (the very place it takes there: the sheet's own title, measured), the dark lifts and the slate pops in beside the sheet
   (50-result.css #result.from-outro). A tap anywhere goes straight on. Without motion (prefers-reduced-motion): at once.

   tableAlone(on): the table alone - the score bar, the keys at the sides, the gauges, the toasts faded out, the cue and its line
   not drawn (90-loop.js); used here and by the match's opening (56-league.js). */
function tableAlone(on) {
  app.classList.toggle('bare', !!on);
  if (!on) { app.classList.add('unbare'); clearTimeout(tableAlone.t); tableAlone.t = setTimeout(() => app.classList.remove('unbare'), 500); }
}
const outro = {
  on: false, box: null, reveal: null, t: 0, opts: null,
  // o: { word, kind: 'win' | 'lose' | 'draw', score }; reveal(): the result screen shown (match.finish). Called again while
  // it is up (the room's word on the winner coming in): the word and what comes after are the new ones.
  start(o, reveal) {
    outro.reveal = reveal; outro.opts = o;
    if (outro.on) { outro.paint(); return; }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return reveal();
    outro.on = true; tableAlone(true);
    const box = outro.box = el('div', { id: 'outro', 'aria-hidden': 'true' }, [el('i', { class: 'shade' }),
      el('div', { class: 'word' }, [el('i', { class: 'lf l' }), el('span'), el('i', { class: 'lf r' })]), el('small', { class: 'sub' })]);
    box.addEventListener('pointerdown', e => { e.preventDefault(); outro.hand(); });
    document.body.appendChild(box); outro.paint();
    requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add('go')));
    if (o.kind === 'win') { winCam.start(); setTimeout(() => { if (outro.on) confetti.start(); }, 180); }
    outro.t = setTimeout(() => outro.hand(), o.kind === 'win' ? 2600 : 1750);
  },
  // the word, its look and size: as large as the screen allows - the laurels at most 38% of its height, the whole at most
  // 64% of its width (--S: the sheet's own title is 28px, the laurels 48 × 64: all of it at --S times that)
  paint() {
    const o = outro.opts, box = outro.box; if (!box) return;
    box.className = (box.classList.contains('go') ? 'go ' : '') + o.kind;
    box.querySelector('.word span').textContent = o.word; box.querySelector('.sub').textContent = o.score || '';
    box.style.setProperty('--S', '1');
    const w = box.querySelector('.word').offsetWidth || 200, S = Math.max(1.2, Math.min(3.4, innerHeight * 0.38 / 64, innerWidth * 0.64 / w));
    box.style.setProperty('--S', S.toFixed(3));
  },
  // into the result: shown under the word, the word moved onto the sheet's title, the dark lifted
  hand() {
    if (!outro.on || outro.handing) return; outro.handing = true; clearTimeout(outro.t);
    const box = outro.box, word = box.querySelector('.word');
    $('#result').classList.add('from-outro'); const title = $('#rTitle').parentNode; title.classList.add('held');
    outro.reveal();
    tableAlone(false); app.classList.remove('unbare');
    // (sideways, the result is the receipt - 50-receipt.js: the word lifts away, the receipt's stamp says it again)
    const rc = $('#result').classList.contains('rc') && !app.classList.contains('portrait') && app.classList.contains('desk');
    if (rc) box.classList.add('away');
    const to = title.getBoundingClientRect(), fr = word.getBoundingClientRect();
    if (!rc && to.width && fr.width) {
      const k = to.height / fr.height, dx = (to.left + to.width / 2) - (fr.left + fr.width / 2), dy = (to.top + to.height / 2) - (fr.top + fr.height / 2);
      word.style.transform = `translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px) scale(${k.toFixed(4)})`;
    }
    box.classList.add('hand');
    setTimeout(() => outro.stop(), 640);
  },
  // gone: the sheet's own title shown again (also when the screen is left some other way - show())
  stop() {
    clearTimeout(outro.t); outro.on = false; outro.handing = false;
    if (outro.box) { outro.box.remove(); outro.box = null; }
    const t = $('#rTitle'); if (t) t.parentNode.classList.remove('held');
    setTimeout(() => { const r = $('#result'); if (r) r.classList.remove('from-outro'); }, 900);
    if (app.classList.contains('bare') && !(typeof vsIntro !== 'undefined' && vsIntro.on)) tableAlone(false);
  },
};

/* Confetti (a win - owner 11-21, as a table-tennis game's): paper squares of every colour bursting up from behind the word,
   then raining from the top for a while, each tumbling (its face turning to the light and away), swaying as it falls and
   slowed by the air. Drawn on a canvas over the table and under everything else (after #gl); gone when the last has fallen. */
const confetti = {
  cv: null, raf: 0,
  start() {
    confetti.stop();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cv = confetti.cv = el('canvas', { id: 'confetti', 'aria-hidden': 'true' }); $('#gl').after(cv);
    const dpr = Math.min(2, devicePixelRatio || 1), W = innerWidth, H = innerHeight; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const g = cv.getContext('2d'); g.scale(dpr, dpr);
    const C = ['#ff3b5c', '#ffd23f', '#35d06d', '#2fb6ff', '#9b5cff', '#ff8a1f', '#ff5fd2', '#ffffff', '#3bf0e0'];
    const s = Math.max(0.75, Math.min(1.5, Math.min(W, H) / 560)), P = [], R = Math.random;
    const add = (x, y, vx, vy) => P.push({ x, y, vx, vy, r: R() * 6.28, vr: (R() - 0.5) * 10, f: R() * 6.28, vf: 5 + R() * 9, w: (5 + R() * 4) * s, h: (8 + R() * 7) * s, c: C[R() * C.length | 0], sw: (0.5 + R()) * 36 * s, sp: R() * 6.28 });
    for (let i = 0; i < 120; i++) { const a = -Math.PI / 2 + (R() - 0.5) * 2.6, v = (420 + R() * 720) * s; add(W / 2 + (R() - 0.5) * W * 0.24, H * 0.47 + (R() - 0.5) * 30, Math.cos(a) * v, Math.sin(a) * v); }
    const t0 = performance.now(); let last = t0, rain = 0;
    const step = () => {
      if (!confetti.cv) return;
      const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000), t = (now - t0) / 1000; last = now;
      if (t < 2.4) { rain += dt * 75; while (rain >= 1) { rain--; add(R() * W, -20, (R() - 0.5) * 90 * s, (60 + R() * 140) * s); } }
      g.clearRect(0, 0, W, H);
      for (let i = P.length - 1; i >= 0; i--) {
        const q = P[i];
        q.vy += 760 * s * dt; q.vx *= Math.exp(-2.4 * dt); q.vy *= Math.exp(-1.7 * dt);
        q.f += q.vf * dt; q.r += q.vr * dt; q.sp += dt * 2.2;
        q.x += (q.vx + Math.sin(q.sp) * q.sw) * dt; q.y += q.vy * dt;
        if (q.y > H + 40 || q.x < -60 || q.x > W + 60) { P.splice(i, 1); continue; }
        const k = Math.cos(q.f);
        g.setTransform(dpr, 0, 0, dpr, 0, 0); g.translate(q.x, q.y); g.rotate(q.r); g.scale(1, k);
        g.fillStyle = q.c; g.fillRect(-q.w / 2, -q.h / 2, q.w, q.h);
        if (Math.abs(k) < 0.6) { g.fillStyle = `rgba(0,0,0,${(0.6 - Math.abs(k)) * 0.5})`; g.fillRect(-q.w / 2, -q.h / 2, q.w, q.h); }   // (turned away from the light)
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (P.length || t < 2.4) confetti.raf = requestAnimationFrame(step); else confetti.stop();
    };
    confetti.raf = requestAnimationFrame(step);
  },
  stop() { cancelAnimationFrame(confetti.raf); if (confetti.cv) { confetti.cv.remove(); confetti.cv = null; } },
};
/* The camera at a win (owner 11-21: "뒤로 빠지게, 마인크래프트 시네마틱 카메라처럼" - and then: smooth, not in steps nor at an
   even speed). Where it wants to be glides out from overhead - down, back and round the table, quickly at first and
   settling, then drifting on round slowly - and the camera follows that on a critically damped spring, so it gathers
   speed and loses it as a hand-held glide would, never starting, stopping or turning at once. Moved once a frame from
   the game's own loop, before the frame is drawn (90-loop.js), so each frame shows the camera where that frame put it.
   Leaving the result (a new game, home, the review) puts the player's own view back (70-buttons.js viewBack). */
const winCam = {
  on: false, t: 0, watch: 0, pose: null, vel: null,
  start() {
    winCam.stop(true); if (!scene.setCam || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    winCam.on = true; winCam.t0 = performance.now(); winCam.last = winCam.t0; winCam.turn = app.classList.contains('portrait') ? -Math.PI / 2 : 0;
    winCam.pose = { az: 0, el: 1.42, zoom: 1 }; winCam.vel = { az: 0, el: 0, zoom: 0 };
    winCam.watch = setInterval(() => { if (!(st.screen === 'play' || st.screen === 'result') || review.on || (st.screen === 'play' && !outro.on)) winCam.stop(); }, 250);
  },
  // a frame (90-loop.js, before the scene is drawn): dt in seconds
  tick() {
    if (!winCam.on) return;
    // (the clock's own time, not the frame's capped step: a slow frame does not slow the glide - the spring is stepped
    // in small steps up to now, so it stays smooth whatever the frame rate)
    const now = performance.now(), w = 2.4, p = winCam.pose, v = winCam.vel;
    let left = Math.min(0.25, (now - winCam.last) / 1000); winCam.last = now;
    while (left > 1e-4) {
      const h = Math.min(1 / 120, left), t = (now - winCam.t0) / 1000 - (left - h), drift = Math.min(t, 24);   // (the slow drift round stops after a while)
      const to = { az: 0.55 * (1 - Math.exp(-t / 1.7)) + 0.022 * drift, el: 1.42 - 0.68 * (1 - Math.exp(-t / 1.5)), zoom: 1 + 0.17 * (1 - Math.exp(-t / 1.9)) };
      for (const k in p) { const a = w * w * (to[k] - p[k]) - 2 * w * v[k]; v[k] += a * h; p[k] += v[k] * h; }   // (critically damped: no overshoot)
      left -= h;
    }
    scene.setCam({ az: winCam.turn + p.az, el: p.el, zoom: p.zoom, tx: 0, ty: 0 });
  },
  stop(quiet) {
    clearInterval(winCam.watch);
    if (!winCam.on) return; winCam.on = false;
    if (!quiet) viewBack();
  },
};
