/* The best-shot reel: the chosen shot is played again as a little edited clip.
   The camera drops in behind the cue, follows the ball, slows down just before it falls, and the beat drops on the
   moment itself. Everything is driven by the real physics running again from the saved position, so it is the shot
   that was played, not a recording.
   d: { game, scene, SND, highlights, st, $, el, app, panOf, onEnd } */
function createReel(d) {
  const { game, scene, SND, highlights, st, $, el, app } = d, TICK = 1 / 120;
  const CAPS = ['미쳤다', '이게 들어가네', 'ㄹㅇ 실화냐', '쉬는시간 MVP', '깔끔', '폼 미쳤다'];
  const ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x);
  let r = null;

  /* ---- overlay effects ---- */
  function emoji(ch, x, y, cls) {
    const n = el('i', { class: 'fx ' + (cls || ''), text: ch, style: `left:${x}px;top:${y}px;--dx:${(Math.random() - 0.5) * 120}px;--rot:${(Math.random() - 0.5) * 50}deg` });
    $('#reelFx').appendChild(n); setTimeout(() => n.remove(), 1400);
  }
  const at = (x, y) => { const p = scene.toScreen(x, y, game.P.R), b = app.getBoundingClientRect(); return [p.x - b.left, p.y - b.top]; };
  function punch() { app.classList.remove('punch'); void app.offsetWidth; app.classList.add('punch'); }
  function bigMoment() {
    r.done = true; r.endAt = r.t + 3.0;
    SND.music.drop(); SND.boom(); punch();
    const f = $('#reelFlash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
    const cap = $('#reelCap'); cap.textContent = CAPS[Math.floor(Math.random() * CAPS.length)]; cap.classList.remove('go'); void cap.offsetWidth; cap.classList.add('go');
    const w = app.clientWidth, h = app.clientHeight;
    ['🔥', '🔥', '💀', '🗿', '😭', '🔥'].forEach((ch, i) => setTimeout(() => { if (r) emoji(ch, w * (0.15 + 0.7 * Math.random()), h * (0.55 + 0.3 * Math.random()), 'rise'); }, i * 110));
  }

  function play(best) {
    const w = game.world;
    highlights.restore(w, best.snap); w.snd.length = 0; scene.clearFalls();
    st.aim = best.aim; st.power = Math.min(1, game.powerOf(best.V)); st.spin = { x: best.a / 0.5, y: best.b / 0.5 };
    const c = w.balls[w.cue];
    r = { best, t: 0, simT: 0, acc: 0, stage: 'intro', plan: highlights.plan(game.P, w.balls.length, best), done: false, endAt: 1e9, hits: 0,
      cam: { az: best.aim - Math.PI / 2 + 0.6, el: 0.62, zoom: 0.5, tx: c.x, ty: c.y } };
    $('#reelWho').textContent = `${best.who} · ${best.tag}`; $('#reelCap').className = ''; $('#reelFx').textContent = '';
    $('#reel').hidden = false; app.classList.add('reeling');
    SND.music.start(); scene.setCam(r.cam);
  }
  function stop() {
    if (!r) return; r = null;
    SND.music.stop(); SND.rolling(0); scene.clearFalls();
    $('#reel').hidden = true; app.classList.remove('reeling', 'punch', 'slow');
    scene.setOrbit(false); d.onEnd();
  }

  // one frame of the reel; returns what the scene should show
  function tick(dt) {
    const P = game.P, w = game.world, b = r.best, cam = r.cam, cue = w.balls[w.cue];
    r.t += dt;
    let pull = 0.03, alpha = 1, focus = cue;
    if (r.stage === 'intro') {
      const k = ease(r.t / 1.1); pull = 0.03 + 0.22 * st.power * k;
      cam.az = b.aim - Math.PI / 2 + 0.6 * (1 - ease(r.t / 1.4)) + 0.12;
      if (r.t >= 1.4) { P.strike(w, b.aim, b.V, b.a, b.b); SND.cue(b.V, 0); punch(); r.stage = 'roll'; }
    } else {
      // slow right down for the last moment before it drops, then let go
      const left = r.plan.tKey - r.simT, slow = !r.done && left > 0 && left < 0.3;
      app.classList.toggle('slow', slow);
      r.acc += dt * (slow ? 0.16 : r.done ? 0.9 : 0.6);
      let n = 0; while (r.acc >= TICK && n < 20) { P.step(w, TICK); r.acc -= TICK; r.simT += TICK; n++; }
      alpha = r.acc / TICK;
      let vmax = 0; for (const x of w.balls) if (x.on) vmax = Math.max(vmax, Math.abs(x.vx) + Math.abs(x.vy));
      SND.rolling(Math.min(8, vmax));
      for (const e of w.snd) {
        if (e.t === 'pocket') { scene.fall(P, e); SND.drop('lip', Math.hypot(e.vx, e.vy), d.panOf(e.x, e.y)); if (!r.done && e.id === b.key) bigMoment(); }
        else if (e.t === 'ball') { SND.ball(e.v, d.panOf(e.x, e.y)); if (e.v > 0.5 && r.hits < 5) { r.hits++; emoji('💥', ...at(e.x, e.y), 'pop'); punch(); } }
        else { SND.rail(e.v, d.panOf(e.x, e.y)); if (e.v > 0.6) { SND.blip(); emoji('‼️', ...at(e.x, e.y), 'pop small'); } }
      }
      w.snd.length = 0;
      if (!r.done && b.key < 0 && w.ev.hits.includes(2) && w.ev.hits.includes(3)) bigMoment();          // carom: the second red is the moment
      if (!r.done && P.rest(w)) { r.done = true; r.endAt = r.t + 0.8; }
      // what to look at: the cue ball until it hits something, then the ball this shot is about
      const key = b.key >= 0 ? w.balls[b.key] : null;
      if (w.ev.firstHit != null && key && key.on) focus = key; else if (w.ev.firstHit != null && key) focus = null;
      if (!r.done) { cam.az += dt * 0.2; cam.el += (0.58 - cam.el) * Math.min(1, dt * 2); cam.zoom += ((slow ? 0.36 : 0.52) - cam.zoom) * Math.min(1, dt * 3); }
      else { cam.az += dt * 0.85; cam.el += (0.78 - cam.el) * Math.min(1, dt * 1.6); cam.zoom += (1 - cam.zoom) * Math.min(1, dt * 1.4); focus = { x: 0, y: 0 }; }
    }
    if (focus) { const k = Math.min(1, dt * (r.done ? 1.5 : 5)), x = focus.px != null ? focus.px + (focus.x - focus.px) * alpha : focus.x, y = focus.py != null ? focus.py + (focus.y - focus.py) * alpha : focus.y; cam.tx += (x - cam.tx) * k; cam.ty += (y - cam.ty) * k; }
    scene.setCam(cam);
    if (r.t > r.endAt) { stop(); return null; }
    return { alpha, pull, cue: r.stage === 'intro' };
  }
  return { play, tick, skip: stop, get playing() { return !!r; } };
}
