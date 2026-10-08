/* ================= buttons ================= */
press('#tableBtn', sheetTable); press('#cueBtn', sheetCue); press('#guideBtn', sheetGuide);
// the rail: play, puzzles and lessons change what the panel offers; records is a place of its own; settings is a sheet
$('#nav').addEventListener('click', e => {
  const b = e.target.closest('.nv'); if (!b) return; SND.init(); SND.tap();
  const v = b.dataset.v;
  if (v === 'set') return sheetSettings();
  if (v === 'all') return showRecords();
  const game4 = m => game.MODES[m] && m !== 'practice' && m !== 'puzzle4';
  if ((v === 'practice' || v === 'puzzle') && prefs.mode !== v) { if (game4(prefs.mode)) prefs.lastMode = prefs.mode; prefs.mode = v; }
  else if (v === 'play' && !game4(prefs.mode)) prefs.mode = game4(prefs.lastMode) ? prefs.lastMode : 'eight';
  else if (st.screen === 'home') return;
  modeOpen = false; savePrefs(); goHome(true);
});
press('#pc0', () => sheetName(0)); press('#pc1', () => sheetName(1));
const segPaint = [];
press('#menuBtn', sheetPause);
// look round in 3D and back: while it is on, dragging the table turns the view instead of aiming
function setView3D(on) {
  if (scene.orbiting === on) return;
  scene.setOrbit(on); $('#viewBtn').setAttribute('aria-pressed', String(on)); drag = null; orbitPts.clear();
  if (on) toast('큐를 잡고 끌면 조준, 빈 곳을 끌면 시점 회전, 두 손가락으로 확대·축소. 버튼을 다시 누르면 위에서 보는 화면으로 돌아옵니다.', '', 4800);
}
press('#viewBtn', () => setView3D(!scene.orbiting));
press('#startBtn', () => { if (prefs.mode === 'practice') practice.start(); else if (prefs.mode === 'puzzle') puzzle.start(); else match.start(0); });
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
seg('#segOpp', () => prefs.vsAI ? 1 : 0, v => { prefs.vsAI = v === '1'; savePrefs(); paintHome(); });
slider('#segLvl', () => Math.min(3, prefs.level), v => { prefs.level = v; savePrefs(); paintHome(); });
segPaint.push(seg('#segTarget', () => prefs.target, v => { prefs.target = +v; savePrefs(); }));
seg('#segRule3', () => prefs.rule3, v => { prefs.rule3 = +v; savePrefs(); });
segPaint.push(seg('#segFinish', () => prefs.finish ? 1 : 0, v => { prefs.finish = v === '1'; savePrefs(); }));
