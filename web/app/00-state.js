/* The app: screens, input and the frame loop. The build joins every file in this folder, in name order, inside one
   function, so they share one scope - a name declared in one file is visible in all the others. To keep that honest:
     - what several files share is declared HERE (settings, the game, what is on screen, the current flow) and nowhere else;
     - everything else a file declares is its own;
     - tools/check.js fails the build if two files declare the same name.
   00-state    what is shared                         50-match     a game between two players (or one and the computer)
   10-ui       small DOM helpers, screens, layout     51-practice  lessons
   20-sheets   every sheet that slides up             52-puzzle    puzzles
   30-home     the first screen                       53-demo      one given shot, played by the app
   40-shot     the shot pipeline and the scoreboard   60-records   wins and losses, and the burning cards
   70-buttons  what each button does                  80-input     aiming, power, spin, cue angle
   90-loop     the frame loop, saving, start
   Around a shot, what happens depends on what is being played; that part lives in "flows" (match, practice, puzzle, demo)
   with the same handful of methods, and the shot pipeline never asks which one is active.
   The rest of the game is outside this folder and knows nothing of the page: physics.js, game.js, drills.js, puzzles.js,
   highlights.js (no DOM), scene.js (drawing), audio.js, look.js (colours and designs), reel/ (replays). */
const $ = s => document.querySelector(s);
const app = $('#app'), canvas = $('#gl');
const TICK = 1 / 120;
// the aiming guide's length, 0 (none) to 1 (every ball's whole way): what each stretch of the slider is called
const guideName = g => g <= 0.02 ? '끔' : g < 0.37 ? '짧게' : g < 0.63 ? '보통' : g < 0.9 ? '길게' : '전부';

/* ================= settings and saved data ================= */
const store = {
  get(k, d) { try { const v = localStorage.getItem('dp8.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('dp8.' + k, JSON.stringify(v)); } catch (e) {} },
};
// Pool table sizes. Real regulation numbers: playing surface, ball diameter, pocket openings.
const TABLES = [
  { id: 'bar', name: '당구장 7피트', short: '7피트', d: '198×99cm · 공 57mm. 공이 크게 보이고 가장 쉽습니다.', cfg: { R: 0.028575, HL: 0.99, HW: 0.495, cornerMouth: 0.114, sideMouth: 0.127 } },
  { id: 'club', name: '클럽 8피트', short: '8피트', d: '224×112cm · 공 57mm. 동호인이 많이 쓰는 중간 크기.', cfg: { R: 0.028575, HL: 1.12, HW: 0.56, cornerMouth: 0.12, sideMouth: 0.133 } },
  { id: 'pro', name: '대회 9피트', short: '9피트', d: '254×127cm · 공 57mm. 프로 대회 규격, 가장 넓고 어렵습니다.', cfg: { R: 0.028575, HL: 1.27, HW: 0.635, cornerMouth: 0.127, sideMouth: 0.14 } },
  { id: 'pub', name: '영국식 6피트', short: '6피트', d: '183×91cm · 공 51mm. 작은 공에 좁은 포켓.', cfg: { R: 0.0254, HL: 0.915, HW: 0.4575, cornerMouth: 0.089, sideMouth: 0.095 } },
];
const prefs = (() => {
  const saved = store.get('prefs', {});
  const p = Object.assign({ mode: 'eight', names: ['플레이어 1', '플레이어 2'], vsAI: false, level: 1, target: 10, table: 'bar', theme: 'light', cloth: 0, cue: 0,
    guides: null, drill: 'free', drillLv: {}, sound: true, fast: false, quality: 'auto', fps: false, edit: 'random', rule3: 3,
    pz: null, suji: {}, sujiAI: 5, finish: false, cues: null, v: 0,
    aim: 'line', gv: 0 }, saved);
  if (!Array.isArray(p.guides) || p.guides.length !== 2) { const g = typeof saved.guide === 'number' ? saved.guide : 2; p.guides = [g, g]; }   // older saves had one guide for both
  delete p.guide;
  if (!TABLES.some(t => t.id === p.table)) p.table = 'bar';
  delete p.puz; delete p.arcade;                                        // from before the puzzles were stages, and the arcade row
  if (!CLOTHS[p.cloth]) p.cloth = 0; if (!CUES[p.cue]) p.cue = 0;      // a look that has since been taken out
  if (!p.drillLv || typeof p.drillLv !== 'object') p.drillLv = {};
  if (!['line', 'rail'].includes(p.aim)) p.aim = 'line';                    // looks tried and dropped
  if (p.gv !== 2) { p.guides = p.guides.map(k => [0, 0.25, 0.5, 0.75][k] ?? 0.5); p.gv = 2; }   // guide lengths were four steps, now a slider
  if (!Array.isArray(p.cues) || p.cues.length !== 2) p.cues = [p.cue, p.cue];             // a cue each
  p.cues = p.cues.map(i => CUES[i] ? i : 0);
  if (!p.suji || typeof p.suji !== 'object') p.suji = {};
  if (!p.pz || typeof p.pz !== 'object' || !p.pz.stars) p.pz = { cur: 1, stars: {}, open: 0 };
  delete p.lab; delete p.masse;                                         // the 2.0 laboratory switches and the raised-cue permission: gone
  if (p.v < 2) { p.news = Object.keys(saved).length > 0; p.how = !!p.news; p.v = 2; p.fast = false; if (![3, 5, 10].includes(p.target)) p.target = 5; }   // 2.0: fast play starts switched off
  return p;
})();
const savePrefs = () => store.set('prefs', prefs);

/* The game plays on the realistic physics (physics.js, cfg.real) everywhere: matches, lessons and puzzles. The physics the
   game had before (cfg.real false) is still in physics.js but nothing here uses it.
   usePhysics() puts the tables of the chosen size where the game looks for them; it is called before a game is started. */
const tableCache = {};
const tableOf = (key, cfg) => tableCache[key] || (tableCache[key] = createPhysics(Object.assign({ real: true }, cfg)));
const poolOf = id => tableOf(id, Object.assign({ pockets: true }, (TABLES.find(t => t.id === id) || TABLES[0]).cfg));
// carom: the medium table four-ball is played on (254x127cm, 65.5mm balls); carom3: the match table of three-cushion (284x142cm, 61.5mm)
const PH = {};
function usePhysics() { PH.pool = poolOf(prefs.table); PH.carom = tableOf('carom', { R: 0.03275, pockets: false }); PH.carom3 = tableOf('carom3', { R: 0.03075, HL: 1.42, HW: 0.71, pockets: false }); }
usePhysics();
const game = createGame(PH);
const drills = createDrills(), puzzles = createPuzzles();
const SND = createAudio(() => prefs.sound);
const highlights = createHighlights();
if (!game.MODES[prefs.mode]) prefs.mode = 'eight';
if (drills.byId(prefs.drill).id !== prefs.drill) prefs.drill = 'free';
let rec = store.get('rec', {});
const recOf = n => { const r = rec[n] || (rec[n] = { w: 0, l: 0, streak: 0, best: 0 }); if (!r.form) r.form = []; return r; };
const series = { key: '', s: [0, 0] };
const oppName = () => prefs.vsAI ? '컴퓨터' : prefs.names[1];
// four-ball handicaps, the way a hall counts: 50 means five scores to go out. Kept per name.
const SUJI = [3, 5, 8, 10, 15, 20];
const sujiOf = i => i === 1 && prefs.vsAI ? prefs.sujiAI || 5 : prefs.suji[prefs.names[i]] || 5;

/* What is on screen and where the current shot is.
   screen: home | play | result | records | reel
   phase:  idle (nothing to do) | aim (a person is aiming) | auto (computer or demo is lining up) | strike | sim | hold */
const st = { screen: 'home', phase: 'idle', aim: 0, power: 0, spin: { x: 0, y: 0 }, el: 0, cueAnim: null, auto: null, rev: 0, lastLoser: null, settle: 0, holdT: 0, afterHold: null };
let flow = null;

const scene = createScene(canvas, app, PH);
if (!scene) {
  const d = document.createElement('div'); d.id = 'nogl';
  d.textContent = '이 기기에서 3D 그래픽을 켤 수 없어 게임을 띄우지 못했습니다. 인터넷 연결을 확인한 뒤 다시 열어 주세요.';
  app.textContent = ''; app.appendChild(d); return;
}
scene.setCloth(prefs.cloth); scene.setCue(prefs.cues[0]); scene.setQuality(prefs.quality);
// The ice table is a cloth like the others to choose, but it plays differently (everything slides), so lessons and puzzles -
// whose shots were worked out on cloth - are always shown and played on the ordinary one.
const ICE = CLOTHS.findIndex(c => c.ice), iceOn = () => !!CLOTHS[prefs.cloth].ice;
function dress(ice) { scene.setCloth(ice ? ICE : iceOn() ? 0 : prefs.cloth); }
function applyTheme() {
  const light = prefs.theme === 'light';
  app.dataset.theme = light ? 'light' : 'dark';
  document.body.style.background = light ? '#eef0f3' : '#101216';
  scene.setBackdrop(light ? 0xeef0f3 : 0x101216);
}
applyTheme();
// One drawing of the chosen cue, with the same sections and proportions as the 3D one (tip, ferrule, shaft, joint,
// forearm with its points, wrap, sleeve, bumper). Used by the power control and by the cue chooser.
// Drawn tip-first along the canvas's long side; `vertical` puts the tip at the top.
function drawCue(cv, d, vertical) {
  const dpr = Math.min(3, window.devicePixelRatio || 1), cw = cv.clientWidth, ch = cv.clientHeight; if (!cw || !ch) return;
  cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
  const g = cv.getContext('2d'), L = vertical ? cv.height : cv.width, T = vertical ? cv.width : cv.height;
  if (vertical) g.setTransform(0, 1, 1, 0, 0, 0);                                    // swap the axes: x runs down the cue
  const LEN = 1.47, x = m => m / LEN * L, rad = m => (0.006 + (0.0146 - 0.006) * Math.min(1, m / 1.45)) / 0.0146 * T / 2;
  const css = n => '#' + n.toString(16).padStart(6, '0');
  const seg = (m0, m1, fill) => { g.fillStyle = fill; g.beginPath(); g.moveTo(x(m0), T / 2 - rad(m0)); g.lineTo(x(m1), T / 2 - rad(m1)); g.lineTo(x(m1), T / 2 + rad(m1)); g.lineTo(x(m0), T / 2 + rad(m0)); g.fill(); };
  seg(0, 0.012, css(d.tip)); seg(0.012, 0.04, css(d.ferrule)); seg(0.04, 0.74, css(d.shaft)); seg(0.74, 0.756, css(d.joint));
  seg(0.756, 1.03, css(d.fore)); seg(1.03, 1.3, css(d.wrap)); seg(1.3, 1.45, css(d.sleeve)); seg(1.45, 1.47, '#0d0d0d');
  if (d.points != null) {                                                            // the points: long spear shapes running up the forearm
    g.save(); g.beginPath(); g.moveTo(x(0.756), T / 2 - rad(0.756)); g.lineTo(x(1.03), T / 2 - rad(1.03)); g.lineTo(x(1.03), T / 2 + rad(1.03)); g.lineTo(x(0.756), T / 2 + rad(0.756)); g.clip();
    g.fillStyle = css(d.points);
    for (const o of [-1, 0, 1]) { const w = rad(1.03) * 0.42; g.beginPath(); g.moveTo(x(1.03), T / 2 + o * rad(1.03) * 0.95 - w); g.lineTo(x(1.03), T / 2 + o * rad(1.03) * 0.95 + w); g.lineTo(x(0.79), T / 2 + o * rad(0.79) * 0.95); g.fill(); }
    g.restore();
  }
  // round it: dark edges, a soft highlight off-centre
  const sh = g.createLinearGradient(0, 0, 0, T);
  sh.addColorStop(0, 'rgba(0,0,0,.42)'); sh.addColorStop(0.3, 'rgba(255,255,255,.26)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,.46)');
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = sh; g.fillRect(0, 0, L, T); g.globalCompositeOperation = 'source-over';
}
// whose cue is out: each player has their own
let cueNow = prefs.cues[0];
function useCue(i) { if (!CUES[i]) i = 0; if (i === cueNow) return; cueNow = i; scene.setCue(i); if (st.screen === 'play') paintPowerCue(); }
function paintPowerCue() { drawCue($('#powerCue'), CUES[cueNow] || CUES[0], !scene.portrait); }
