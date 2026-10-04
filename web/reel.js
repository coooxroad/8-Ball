/* The best-shot reel: the chosen shot, cut like a short edit.

   Build-up   drained of colour; the camera sinks from a wide view to behind the cue, the shot is played slowly, and
              just before the ball drops everything nearly stops while the camera pushes in on the pocket.
   Drop       on the song's drop (or, with no song, after that held breath) colour snaps back, the picture kicks, and
              the ball goes in at full speed.
   Cuts       the same moment again from three more cameras, one cut every two beats, each landing on the beat.
   Out        a slow turn round the whole table, then black.

   Nothing is recorded: the balls are put back where they were and the same shot is struck again, as often as a new
   camera needs it. d: { game, scene, SND, highlights, st, $, el, app, panOf, onEnd } */
function createReel(d) {
  const { game, scene, SND, highlights, st, $, el, app } = d, TICK = 1 / 120;
  const ease = x => x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x), lerp = (a, b, k) => a + (b - a) * k;
  const INTRO = 2.2, HOLD = 0.1, PRE = 0.32, POST = 0.14;     // seconds: camera move-in; sim time held back before the drop; sim window of a cut
  let r = null;

  /* ---- picture effects (all on the page, none in the 3D scene) ---- */
  const kick = cls => { app.classList.remove('hit', 'beat'); void app.offsetWidth; app.classList.add(cls); };
  function impact() {                                          // two frames of negative, then a white flash
    app.classList.add('impact'); setTimeout(() => app.classList.remove('impact'), 70);
    const f = $('#reelFlash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
  }
  function emoji(ch, x, y) {
    const n = el('i', { class: 'rfx', text: ch, style: `left:${x}px;top:${y}px;--dx:${(Math.random() - 0.5) * 140}px;--rot:${(Math.random() - 0.5) * 50}deg` });
    $('#reelFx').appendChild(n); setTimeout(() => n.remove(), 1500);
  }

  /* ---- the shot, from the start up to a given moment ---- */
  function rewind(t) {
    const P = game.P, w = game.world, b = r.best;
    highlights.restore(w, b.snap); scene.clearFalls();
    r.simT = 0; r.acc = 0; r.struck = t > 0;
    if (t > 0) { P.strike(w, b.aim, b.V, b.a, b.b); const n = Math.floor(t / TICK); for (let i = 0; i < n; i++) P.step(w, TICK); r.simT = n * TICK; }
    w.snd.length = 0;
  }
  // advance the physics by `sim` seconds, with the sounds and pocket drops that come with it
  function advance(sim) {
    const P = game.P, w = game.world;
    r.acc += sim; let n = 0;
    while (r.acc >= TICK && n < 24) { P.step(w, TICK); r.acc -= TICK; r.simT += TICK; n++; }
    let vmax = 0; for (const x of w.balls) if (x.on) vmax = Math.max(vmax, Math.abs(x.vx) + Math.abs(x.vy));
    SND.rolling(Math.min(8, vmax));
    for (const e of w.snd) {
      if (e.t === 'pocket') { scene.fall(P, e); SND.drop('lip', Math.hypot(e.vx, e.vy), d.panOf(e.x, e.y)); }
      else if (e.t === 'ball') { SND.ball(e.v, d.panOf(e.x, e.y)); if (e.v > 0.8) kick('beat'); }
      else SND.rail(e.v, d.panOf(e.x, e.y));
    }
    w.snd.length = 0;
    return r.acc / TICK;
  }

  /* ---- cameras for the cuts: [name, how it is set up for this shot] ---- */
  function cutCam(k) {
    const p = r.plan, away = Math.atan2(p.ux, -p.uy);          // the compass direction that puts the camera beyond the pocket, looking back
    if (k === 0) return { az: away, el: 0.3, zoom: 0.25, tx: p.kx - p.ux * 0.16, ty: p.ky - p.uy * 0.16, spin: 0.1 };       // from behind the pocket, low
    if (k === 1) return { az: away + Math.PI, el: 1.42, zoom: 0.2, tx: p.kx - p.ux * 0.1, ty: p.ky - p.uy * 0.1, spin: 0.35 }; // straight down, tight
    return { az: away + Math.PI / 2, el: 0.22, zoom: 0.3, tx: p.kx - p.ux * 0.2, ty: p.ky - p.uy * 0.2, spin: -0.25 };        // from the side, at cloth level
  }

  function play(best) {
    const w = game.world;
    r = { best, t: 0, stage: 'build', simT: 0, acc: 0, struck: false, cut: -1, cutAt: 0, plan: null, cam: null, fired: false };
    rewind(0);
    const p = r.plan = highlights.plan(game.P, w.balls.length, best), c = w.balls[w.cue];
    st.aim = best.aim; st.power = Math.min(1, game.powerOf(best.V)); st.spin = { x: best.a / 0.5, y: best.b / 0.5 };
    // build-up pace: slow, but never longer than about four seconds of rolling
    const roll = Math.max(0, p.tKey - HOLD); r.slow = Math.max(0.42, roll / 4.2);
    r.lead = INTRO + roll / r.slow + 0.7;                      // real seconds from now to the drop
    const info = SND.song.info; r.beat = 60 / (info ? info.bpm : 140); r.song = SND.song.play(r.lead);
    r.cam = { az: best.aim - Math.PI / 2 + 1.0, el: 1.15, zoom: 1, tx: 0, ty: 0 }; r.from = Object.assign({}, r.cam); r.cue0 = [c.x, c.y];
    $('#reelFx').textContent = ''; $('#reel').hidden = false; $('#reelFade').classList.remove('go');
    app.classList.remove('colour'); app.classList.add('reeling');
    scene.setCam(r.cam);
  }
  function stop() {
    if (!r) return; r = null;
    SND.song.stop(); SND.rolling(0); scene.clearFalls();
    $('#reel').hidden = true; app.classList.remove('reeling', 'colour', 'hit', 'beat', 'impact', 'hold');
    scene.setOrbit(false); d.onEnd();
  }

  // one frame; returns what the scene should show, or null once the reel is over
  function tick(dt) {
    const w = game.world, b = r.best, p = r.plan, cam = r.cam;
    r.t += dt;
    const song = r.song ? SND.song.time() : null, rel = song != null ? song : r.t - r.lead;   // seconds since the drop (negative before)
    let pull = 0.03, alpha = 1, showCue = false;
    const key = b.key >= 0 ? w.balls[b.key] : w.balls[w.cue], cue = w.balls[w.cue];
    const follow = (o, k) => { const x = o.px != null ? o.px + (o.x - o.px) * alpha : o.x, y = o.py != null ? o.py + (o.y - o.py) * alpha : o.y; cam.tx += (x - cam.tx) * k; cam.ty += (y - cam.ty) * k; };

    if (r.stage === 'build') {
      const since = rel + r.lead;                              // seconds into the reel
      if (!r.struck) {
        // the camera comes down from a wide view to just behind the cue while the cue is drawn back
        const k = ease(since / INTRO); showCue = true; pull = 0.03 + 0.24 * st.power * ease((since - 0.5) / (INTRO - 0.7));
        cam.az = lerp(r.from.az, b.aim - Math.PI / 2 + 0.16, k); cam.el = lerp(r.from.el, 0.46, k); cam.zoom = lerp(1, 0.44, k);
        cam.tx = lerp(0, r.cue0[0], k); cam.ty = lerp(0, r.cue0[1], k);
        if (since >= INTRO) { game.P.strike(w, b.aim, b.V, b.a, b.b); r.struck = true; SND.cue(b.V, 0); kick('beat'); }
      } else {
        const held = r.simT >= p.tKey - HOLD;                  // the breath before the drop: almost frozen, pushing in on the pocket
        app.classList.toggle('hold', held);
        alpha = advance(dt * (held ? 0.025 : r.slow));
        if (held) { cam.tx += (p.kx - p.ux * 0.12 - cam.tx) * Math.min(1, dt * 3); cam.ty += (p.ky - p.uy * 0.12 - cam.ty) * Math.min(1, dt * 3); cam.zoom += (0.24 - cam.zoom) * Math.min(1, dt * 1.6); cam.el += (0.5 - cam.el) * Math.min(1, dt * 2); }
        else { follow(w.ev.firstHit != null && key.on ? key : cue, Math.min(1, dt * 5)); cam.az += dt * 0.16; cam.zoom += (0.46 - cam.zoom) * Math.min(1, dt * 2); }
        if ((held && rel >= 0) || (!held && rel >= 1.5)) {     // the drop
          r.stage = 'drop'; r.cutAt = Math.max(rel, 0) + 2 * r.beat; app.classList.remove('hold'); app.classList.add('colour');
          impact(); kick('hit'); SND.boom();
          const W = app.clientWidth, H = app.clientHeight; ['🔥', '💀', '🔥', '🗿', '🔥'].forEach((ch, i) => setTimeout(() => { if (r) emoji(ch, W * (0.2 + 0.6 * Math.random()), H * (0.6 + 0.2 * Math.random())); }, i * 90));
        }
      }
    } else if (r.stage === 'drop' || r.stage === 'cuts') {
      if (rel >= r.cutAt) {                                    // next camera, on the beat
        r.cut++; r.cutAt += 2 * r.beat; kick('hit');
        if (r.cut >= 3) { r.stage = 'out'; r.outAt = rel; }
        else { r.stage = 'cuts'; rewind(Math.max(0, p.tKey - PRE)); Object.assign(cam, cutCam(r.cut)); r.cutT = 0; }
      }
      if (r.stage === 'drop') { alpha = advance(dt); cam.zoom += (0.3 - cam.zoom) * Math.min(1, dt * 4); cam.az += dt * 0.5; }
      else if (r.stage === 'cuts') {
        // each cut runs the last third of a second again: quick up to the pocket so the ball drops on the next beat's off-beat, then slower
        r.cutT += dt; const L = 2 * r.beat, u = r.cutT / L;
        alpha = advance(dt * (u < 0.55 ? PRE / (0.55 * L) : POST / (0.45 * L)));
        cam.az += dt * (cam.spin || 0); cam.zoom *= 1 - dt * 0.12;                     // every camera creeps in
        if (!r.fired && u >= 0.55) { r.fired = true; kick('beat'); }
        if (u < 0.55) r.fired = false;
      }
    }
    if (r.stage === 'out') {
      const u = rel - r.outAt; alpha = advance(dt * 0.8);
      cam.az += dt * 0.55; cam.el += (0.8 - cam.el) * Math.min(1, dt * 1.5); cam.zoom += (1.02 - cam.zoom) * Math.min(1, dt * 1.6); cam.tx += (0 - cam.tx) * Math.min(1, dt * 2); cam.ty += (0 - cam.ty) * Math.min(1, dt * 2);
      if (u > 4 * r.beat) $('#reelFade').classList.add('go');
      if (u > 4 * r.beat + 0.55) { stop(); return null; }
    }
    scene.setCam(cam);
    return { alpha, pull, cue: showCue };
  }
  return { play, tick, skip: stop, get playing() { return !!r; } };
}
