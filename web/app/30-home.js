/* ================= home: what the desk (32-desk.js) and the flows share ================= */
const isCarom = () => prefs.mode === 'puzzle' || (game.MODES[prefs.mode] || {}).table === 'carom';
function recText(n) { const r = rec[n]; if (!r || (!r.w && !r.l)) return '첫 판'; return `${r.w}승 ${r.l}패` + (r.streak >= 2 ? ` · ${r.streak}연승 중` : ''); }
// a run of wins burns: red at two, yellow at three, mint at four, purple from five on
const fireOf = n => n >= 2 ? ' fire f' + Math.min(5, n) : '';
const MODE_KO = { eight: '8볼', nine: '9볼', four: '4구', three: '3구' };
// the puzzles on offer, and which stages are open
const pzList = () => puzzles.list, PZ_NEED = 5;
const pzOpen = si => si === 0 || puzzles.of(si - 1).filter(q => prefs.pz.stars[q.id]).length >= PZ_NEED;
const levelOf = id => Math.max(1, Math.min(drills.LEVELS, prefs.drillLv[id] || 1));
function paintHome() { deskPaint(); }
// The table behind the home screen: the chosen game racked up, or the chosen drill being played over and over
// (a new layout each time, which is also what the drill itself does).
function homePreview() {
  usePhysics(); scene.clearFalls(); scene.setZone(null);
  st.phase = 'idle'; st.auto = null; st.cueAnim = null; st.power = 0; st.spin = { x: 0, y: 0 }; st.aim = 0;
  const d = drills.byId(prefs.drill);
  if (prefs.mode === 'puzzle' && puzzles.list.length) { flow = null; game.start('puzzle4', [prefs.names[0], ''], false, {}); dress(false); useCue(prefs.cues[0]); scene.setTable(game.P); puzzle.put(puzzles.byId(prefs.pz.cur) || puzzles.list[0]); return; }
  if (prefs.mode === 'practice' && d.make) {
    game.start('practice', [prefs.names[0], ''], false, {}); dress(false); scene.setTable(game.P);
    const L = drills.make(d.id, game.P, levelOf(d.id), Math.random, game.vOf);
    if (L) { flow = null; putLayout(L); scene.setZone(L.zone); playDemo(L.demo, { quiet: true, after: homePreview }); return; }
  }
  flow = null; scene.setMarks(null); useCue(prefs.cues[0]);
  const mode = prefs.mode === 'puzzle' ? 'four' : game.MODES[prefs.mode] && prefs.mode !== 'practice' ? prefs.mode : 'eight', ice = iceOn();
  game.start(mode, [prefs.names[0], oppName()], false, { ice, levels: [2, 2], target: 99 });
  dress(ice); scene.setTable(game.P); st.rev++; scene.invalidate();
  { game.players[0].ai = game.players[1].ai = true; flow = homeDemo; st.el = 0; hold(1.2, () => { if (flow === homeDemo && st.screen === 'home') beginTurn(true); }); }
}
// The table on the first screen plays itself: two computers at the hard level, one game after another, without a sound
// (and resting while the desk covers it: 90-loop.js).
const homeDemo = {
  quiet: true, save: false, guide: () => 0.5, restart() {}, beforeShot() {}, hud() {},
  auto: () => ({ think: 0.9, showSpin: false, plan() { const p = game.aiPlan(); return { angle: p.angle, V: p.V, a: p.a || 0, b: p.b || 0, el: p.el || 0, pos: p.pos }; } }),
  afterShot() { game.resolve(); if (st.screen !== 'home') return; if (game.over) return hold(2.2, () => { if (flow === homeDemo && st.screen === 'home') homePreview(); }); useCue(prefs.cues[prefs.vsAI ? 0 : game.turn]); beginTurn(false); },
};
// leaving a game: `keep` leaves it saved so that it can be picked up again from the first screen
function goHome(keep) {
  if (keep !== true) store.set('save', null);
  show('home'); paintHome(); homePreview();
}
function resume(d) {
  if (TABLES.some(t => t.id === d.tbl)) prefs.table = d.tbl;
  usePhysics();
  st.phase = 'idle'; st.auto = null; st.afterHold = null; scene.clearFalls();
  if (!game.restore(d.game)) { store.set('save', null); return paintHome(); }
  if (d.series) { series.key = d.series.key; series.s = d.series.s; }
  match.ctx = { names: game.players.map(p => p.name), mode: game.modeId, ai: game.players[1].ai, target: game.target,
    targets: game.tens ? game.targets.slice() : null, finish: game.finish, ice: game.ice };
  const h = d.hl || {}; match.shots = h.shots || []; match.best = h.best || null; match.worst = h.worst || null; match.count = h.count || 0;
  prefs.mode = game.modeId; st.aim = d.aim || 0; match.enter();
}
