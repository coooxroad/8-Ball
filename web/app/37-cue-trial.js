/* ================= 시타: a cue tried on the live table (상점 · 내 장비, a cue's card opened) =================
   Three strokes, always the same: the same balls in the same places on the same table (7피트), the same aim, the gauge
   pulled the same way, struck the same place - played in the same order, over and over. Only the cue changes: its power
   stat makes the same pull a faster ball, its spin stat makes the same strike point turn the ball more (the same sums as a
   real stroke: 80-input.js, game.vOf(p) × power, strike point × 0.5 × spin). So two cues side by side show their OVR as
   a cue ball that stops further on.
     ① 파워     the cue ball alone, rolled soft down the table: where it stops
     ② 밀어치기  struck at the top, full into a ball that drops in the corner: how far the cue ball follows it
     ③ 옆회전    struck at the side into the long cushion: how far it runs off it
   The gauge is low on purpose: every cue's ball stops before the next cushion, so further is always more (checked for
   every cue, breaker cue too, by web/test/run.js). A yellow ring is where a cue with no stats stops (worked
   out before the stroke, the same physics), and the label says how far from it this cue's ball stopped. */
// TRIAL_TABLE, TRIAL_SCENES: content/20-cues.js (data, so web/test/run.js can check them)
// a cue's stats as a stroke uses them (00-state.js cueK, for any cue, not only the one in hand); i null: no stats at all
const cueKOf = i => { const s = (i == null ? null : (CUES[i] || {}).stat) || {}; return { power: 1 + (s.power || 0) / 100, spin: 1 + (s.spin || 0) / 100 }; };
const trialStroke = (S, k) => ({ angle: S.angle, V: game.vOf(S.p) * k.power, a: S.a * 0.5 * k.spin, b: S.b * 0.5 * k.spin, el: 0 });
const cueTrial = {
  on: null,                                   // { cue, n (the scene), tag (the label), ref (where no stats stops), from, done }
  start(i, tag) {
    if (cueTrial.on && cueTrial.on.cue === i) { cueTrial.on.tag = tag; cueTrial.label(); return; }   // (the desk painted again: carry on)
    cueTrial.on = { cue: i, n: 0, tag }; cueTrial.scene();
  },
  stop() { if (!cueTrial.on) return; cueTrial.on = null; scene.setZone(null); if (flow === cueTrial.flow) { flow = null; st.phase = 'idle'; st.auto = null; } },
  label() {
    const o = cueTrial.on; if (!o || !o.tag) return; const S = TRIAL_SCENES[o.n], k = cueKOf(o.cue);
    let how = `게이지 ${Math.round(S.p * 100)}% → ${(game.vOf(S.p) * k.power * 3.6).toFixed(1)} km/h`;
    if (o.done) how = o.done.in ? '큐볼이 포켓에 들어갔습니다' : `노란 원(능력치 0)보다 ${Math.abs(o.done.d) < 0.005 ? '±0' : (o.done.d > 0 ? '+' : '−') + Math.round(Math.abs(o.done.d) * 100)}cm`;
    o.tag.textContent = ''; o.tag.append(el('b', { text: S.name }), el('span', { text: `${S.note} · ${how}` }));
  },
  scene() {
    const o = cueTrial.on; if (!o || st.screen !== 'home') return;
    const S = TRIAL_SCENES[o.n];
    usePhysics(TRIAL_TABLE); scene.clearFalls(); scene.setMarks(null);
    game.start('practice', [prefs.names[0], ''], false, {}); dress(false); scene.setTable(game.P);
    const P = game.P, w = game.world; game.MODES.practice.setup(game, seededRandom(1)); scene.clearFalls();
    for (let id = 1; id < w.balls.length; id++) w.balls[id].on = false;
    P.place(w, 0, S.cue[0], S.cue[1]); for (const [id, x, y] of S.balls) P.place(w, id, x, y);
    // where a cue with no stats stops: the same stroke on a copy of the table
    const t = P.clone(w), z = trialStroke(S, cueKOf(null)); t.snd = []; P.strike(t, z.angle, z.V, z.a, z.b, z.el); P.run(t, 20);
    const r = t.balls[0]; o.from = { x: S.cue[0], y: S.cue[1] }; o.ref = r.on ? { x: r.x, y: r.y } : null; o.done = null;
    scene.setZone(o.ref ? { x: o.ref.x, y: o.ref.y, r: P.R * 1.7 } : null);
    useCue(o.cue); st.aim = S.angle; st.power = 0; st.spin = { x: 0, y: 0 }; st.el = 0; st.rev++;
    cueTrial.label();
    flow = cueTrial.flow; beginTurn(true);
  },
  flow: {
    quiet: false, save: false, guide: () => 0, restart() {}, beforeShot() {}, hud() { setBusy(); },
    auto: () => {
      const o = cueTrial.on; if (!o) return null; const S = TRIAL_SCENES[o.n];
      return { think: 0.8, showSpin: true, plan: () => trialStroke(S, cueKOf(o.cue)) };
    },
    afterShot() {
      const o = cueTrial.on;
      if (o && o.ref) {   // how much further on than no stats: the distance from where it started, this cue's less the ring's
        const c = game.world.balls[0], f = o.from, d = (x, y) => Math.hypot(x - f.x, y - f.y);
        o.done = c.on ? { d: d(c.x, c.y) - d(o.ref.x, o.ref.y) } : { in: true }; cueTrial.label();
      }
      hold(1.6, () => { const o = cueTrial.on; if (!o || flow !== cueTrial.flow) return; o.n = (o.n + 1) % TRIAL_SCENES.length; cueTrial.scene(); });
    },
  },
};
