/* ================= buttons ================= */
press('#menuBtn', sheetPause);
// look round in 3D and back: while it is on, dragging the table turns the view instead of aiming
// The views: straight down (2D), a free look round in 3D, and the player's eye - low behind the cue ball along the aim,
// following the aim and the cue ball. While a 3D view is on, dragging the table turns the view instead of aiming
// (dragging the eye view turns it into the free look).
let viewMode = 'top';
const eyeCam = () => { const c = game.cueBall(), a = st.aim; return { eye: true, az: Math.atan2(-Math.cos(a), Math.sin(a)), el: 0.3, zoom: 0.42, tx: c.x + Math.cos(a) * 0.3, ty: c.y + Math.sin(a) * 0.3 }; };
function paintViews() { $('#viewBtn').setAttribute('aria-pressed', String(viewMode === 'free')); $('#topBtn').setAttribute('aria-pressed', String(viewMode === 'top')); $('#eyeBtn').setAttribute('aria-pressed', String(viewMode === 'eye')); }
function setView(m) {
  if (m === viewMode && m !== 'eye') return;
  drag = null; orbitPts.clear(); viewMode = m;
  if (m === 'top') scene.setOrbit(false);
  else if (m === 'free') { scene.setOrbit(true); toast('큐를 잡고 끌면 조준, 빈 곳을 끌면 시점 회전, 두 손가락으로 확대·축소.', '', 3600); }
  else { if (!scene.orbiting) scene.setOrbit(true); scene.setCam(eyeCam()); eyeKey = ''; }
  paintViews();
}
const setView3D = on => setView(on ? 'free' : 'top');
let eyeKey = '';
// called every frame: the eye view keeps behind the cue ball as the aim turns (not while the balls run)
function eyeTick() {
  if (viewMode !== 'eye' || !scene.eyeView || (st.phase !== 'aim' && st.phase !== 'auto')) return;
  const c = game.cueBall(), k = st.aim.toFixed(4) + c.x.toFixed(3) + c.y.toFixed(3); if (k === eyeKey) return; eyeKey = k; scene.setCam(eyeCam());
}
scene.onFreeLook = () => { viewMode = 'free'; paintViews(); };
press('#viewBtn', () => setView(viewMode === 'free' ? 'top' : 'free'));
press('#topBtn', () => setView('top'));
press('#eyeBtn', () => setView('eye'));
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
