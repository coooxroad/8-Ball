/* ================= flow: demo (plays one given shot, then hands back) ================= */
// shot: { angle, power, a, b, el, ft }.  opts.after: what to do once the balls have stopped and been looked at.
function playDemo(shot, opts) {
  const back = flow;
  flow = {
    quiet: !!opts.quiet, save: false,
    restart() { (back || practice).restart(); },
    guide: () => 0.75,
    auto: () => ({ think: 0.7, showSpin: true, plan: () => ({ angle: shot.angle, V: game.vOf(shot.power), a: shot.a, b: shot.b, el: shot.el || 0, ft: shot.ft == null ? null : shot.ft }) }),
    beforeShot() {},
    afterShot() { hold(1.3, opts.after); },
    hud() { if (back) back.hud(); setBusy(); },
  };
  beginTurn(true);
}
