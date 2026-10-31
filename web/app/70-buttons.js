/* ================= buttons ================= */
press('#menuBtn', sheetPause);
// look round in 3D and back: while it is on, dragging the table turns the view instead of aiming
function setView3D(on) {
  if (scene.orbiting === on) return;
  scene.setOrbit(on); $('#viewBtn').setAttribute('aria-pressed', String(on)); drag = null; orbitPts.clear();
  if (on) toast('큐를 잡고 끌면 조준, 빈 곳을 끌면 시점 회전, 두 손가락으로 확대·축소. 버튼을 다시 누르면 위에서 보는 화면으로 돌아옵니다.', '', 4800);
}
press('#viewBtn', () => setView3D(!scene.orbiting));
press('#againBtn', () => match.start(st.lastLoser == null ? 0 : st.lastLoser));
press('#homeBtn', () => goHome());
// the best shot of the match, played again as an edited clip
const reel = createReel({ game, scene, SND, highlights, st, $, el, app, panOf, onEnd() { st.phase = 'idle'; flow = null; show('result'); } });
const reelFlow = { quiet: false, save: false, guide: () => 0, auto: () => null, hud() {}, beforeShot() {}, afterShot() {}, restart() {} };
// one of the match's highlights, played as an edit: a good shot to the player's song, a bad one for laughs with no music
async function playShot(shot, style) {
  if (!shot || st.screen !== 'result') return;
  // the best shot gets an edit and a song, the worst its own joke edit; every other highlight is simply shown again with one camera move
  if (!shot.kind && style !== 'plain') { await SND.song.prepare(); if (st.screen !== 'result') return; }
  show('reel'); flow = reelFlow; st.phase = 'reel'; reel.play(shot, typeof style === 'string' ? style : shot.kind ? undefined : prefs.edit);
}
const playBest = style => playShot(match.best, style), playWorst = style => playShot(match.worst, style);
press('#reelSkip', () => reel.skip());
