/* The app: screens, input and the frame loop. The build joins every file in this folder, in name order, inside one
   function, so they share one scope - a name declared in one file is visible in all the others. To keep that honest:
     - what several files share is declared HERE (settings, the game, what is on screen, the current flow) and nowhere else;
     - everything else a file declares is its own;
     - tools/check.js fails the build if two files declare the same name.
   00-state    what is shared, and what is worn      40-shot        the shot pipeline and the scoreboard
   05-music    the lobby's tune, win and lose songs   50-match       a game between two players (or one and the computer)
   07-net      the server: wallet, rewards, ranked    54-ranked      랭킹전: finding an opponent, playing them online
                                                      55-invite      친구 초대: a code, and a game on two devices
                                                      56-drop        당구드롭: a ball to open, won with a game
   10-ui       small DOM helpers, screens, layout     51-practice    lessons and free practice
   20-sheets   every sheet that slides up             52-puzzle      puzzles
   30-home     what the desk and the flows share      53-demo        one given shot, played by the app
   32-desk     the desk's parts, moving between places 60-records    wins and losses, and the burning cards
   33-desk-play     플레이: the panels, the games    62-bolts       the lightning border while play runs fast
   34-desk-train    훈련: lessons, puzzles, practice  70-buttons     what each button does
   35-desk-shelves  내 장비 and 상점                    80-input       aiming, power, spin, cue angle
   36-desk-paint    laying the desk out and leaning it 90-loop       the frame loop, saving, start
   Around a shot, what happens depends on what is being played; that part lives in "flows" (match, practice, puzzle, demo)
   with the same handful of methods, and the shot pipeline never asks which one is active.
   The rest of the game is outside this folder and knows nothing of the page: content/ (what can be owned), physics.js,
   game.js, ai/ (the computer player), drills.js, puzzles.js, highlights.js (no DOM), scene/ (drawing), audio.js, reel/ (replays). */
const $ = s => document.querySelector(s);
const app = $('#app'), canvas = $('#gl');
const TICK = 1 / 120;
// the aiming guide's length, 0 (none) to 1 (every ball's whole way): what each stretch of the slider is called
// the aim line's length in play, for everyone ('보통'); the cue in hand stretches or shortens it by its stat (90-loop.js)
const GUIDE_STD = 0.5;

/* ================= settings and saved data ================= */
const store = {
  get(k, d) { try { const v = localStorage.getItem('dp8.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('dp8.' + k, JSON.stringify(v)); } catch (e) {} },
};
const prefs = (() => {
  const saved = store.get('prefs', {});
  const p = Object.assign({ mode: 'eight', names: ['플레이어 1', '플레이어 2'], vsAI: false, level: 1, target: 10, table: 'bar', cloth: 0, cue: 0,
    guides: null, drill: 'free', drillLv: {}, sound: true, fast: false, quality: 'auto', fps: false, edit: 'random', rule3: 3,
    pz: null, suji: {}, sujiAI: 5, finish: false, cues: null, v: 0,
    aim: 'line', gv: 0,
    music: true,
    shotClock: 40,
    ballSkin: 'classic', trail: 'none', glove: null, lessons: false,
    friendWay: 'local', fourTarget: 10, lessonProof: {},
    wallet: { coin: 0, dia: 0 } }, saved);
  if (!Array.isArray(p.guides) || p.guides.length !== 2) { const g = typeof saved.guide === 'number' ? saved.guide : 2; p.guides = [g, g]; }   // older saves had one guide for both
  delete p.guide;
  delete p.ui; delete p.uiv; delete p.theme; delete p.news;           // the lobby, the old home, the light theme and the 2.0 news: gone
  if (!p.trainCpu) p.vsAI = false;                                      // (the computer is played from 훈련 only)
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
  if (p.v < 2) { p.how = Object.keys(saved).length > 0; p.v = 2; p.fast = false; if (![3, 5, 10].includes(p.target)) p.target = 5; }   // 2.0: fast play starts switched off
  return p;
})();
const savePrefs = () => store.set('prefs', prefs);

/* Everything plays on the one physics (physics.js: what you picture is what happens). usePhysics() puts the tables of the
   chosen size where the game looks for them; it is called before a game is started. */
const tableCache = {};
const tableOf = (key, cfg) => tableCache[key] || (tableCache[key] = createPhysics(cfg));
const poolOf = id => tableOf(id, Object.assign({ pockets: true }, (TABLES.find(t => t.id === id) || TABLES[0]).cfg));
const PH = {};
function usePhysics() { PH.pool = poolOf(prefs.table); PH.carom = tableOf('carom', CAROM.carom); PH.carom3 = tableOf('carom3', CAROM.carom3); }
usePhysics();
const game = createGame(PH, createAI);
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
const st = { screen: 'home', phase: 'idle', aim: 0, power: 0, spin: { x: 0, y: 0 }, el: 0, cueAnim: null, auto: null, rev: 0, lastLoser: null, settle: 0, holdT: 0, afterHold: null, clock: 0 };
let flow = null;

const scene = createScene(canvas, app, PH);
if (!scene) {
  const d = document.createElement('div'); d.id = 'nogl';
  const message = document.createElement('p');
  message.textContent = window.THREE ? '3D 그래픽(WebGL)을 시작하지 못했습니다. 브라우저의 그래픽 가속을 켜거나 다른 브라우저에서 열어 주세요.' : '게임의 그래픽 파일을 불러오지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.';
  const retry = document.createElement('button'); retry.className = 'btn'; retry.textContent = '다시 시도'; retry.onclick = () => location.reload();
  const content = document.createElement('div'); content.append(message, retry); d.appendChild(content);
  app.textContent = ''; app.appendChild(d); app.classList.remove('boot'); return;
}
scene.setCloth(prefs.cloth); scene.setCue(prefs.cues[0]); scene.setQuality(prefs.quality);
useBalls(prefs.ballSkin); scene.setTrail(prefs.trail);
// The ice table is a cloth like the others to choose, but it plays differently (everything slides), so lessons and puzzles -
// whose shots were worked out on cloth - are always shown and played on the ordinary one.
const ICE = CLOTHS.findIndex(c => c.ice), iceOn = () => !!CLOTHS[prefs.cloth].ice;
// (a ranked game wears the look the two players' gear makes: 54-ranked.js lookOf)
const lookNow = () => typeof flow !== 'undefined' && flow === match && match.ctx && match.ctx.online && match.ctx.online.look;
function dress(ice) { const L = lookNow(); scene.setCloth(ice ? ICE : iceOn() ? 0 : L ? L.cloth : prefs.cloth); }
// back to this player's own things (leaving a ranked game)
function ownLook() { useBalls(prefs.ballSkin); scene.setTrail(prefs.trail); dress(false); }
// behind everything: the desk's wood on the home screen, the dark room in play
function applyBackdrop() {
  const desk = st.screen === 'home';                                  // on the desk's home the table sits on felt
  document.body.style.background = desk ? '#6b4527' : '#101216';
  scene.setBackdrop(desk ? 0x034db0 : 0x101216);
}
applyBackdrop();
// One drawing of the chosen cue, with the same sections and proportions as the 3D one (tip, ferrule, shaft, joint,
// forearm with its points, wrap, sleeve, bumper). Used by the power control and by the cue chooser.
// Drawn tip-first along the canvas's long side; `vertical` puts the tip at the top.
function drawCue(cv, d, vertical) {
  const dpr = Math.min(3, window.devicePixelRatio || 1), cw = cv.clientWidth, ch = cv.clientHeight; if (!cw || !ch) return;
  cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
  const g = cv.getContext('2d'), L = vertical ? cv.height : cv.width, T = vertical ? cv.width : cv.height;
  if (vertical) g.setTransform(0, 1, 1, 0, 0, 0);                                    // swap the axes: x runs down the cue
  // (a lit blade's glow needs room past its tip, or the picture's edge cuts it square)
  const LEN = 1.47, pad = d.glow ? T * 0.9 : 0, x = m => pad + m / LEN * (L - pad), rad = m => (0.006 + (0.0146 - 0.006) * Math.min(1, m / 1.45)) / 0.0146 * T / 2;
  const css = n => '#' + n.toString(16).padStart(6, '0');
  const seg = (m0, m1, fill) => { g.fillStyle = fill; g.beginPath(); g.moveTo(x(m0), T / 2 - rad(m0)); g.lineTo(x(m1), T / 2 - rad(m1)); g.lineTo(x(m1), T / 2 + rad(m1)); g.lineTo(x(m0), T / 2 + rad(m0)); g.fill(); };
  // (a cue with its own make: its sections, and a lit blade - a white core in a glow of its colour - over them)
  if (d.profile) {
    const rr = r => r / 0.0146 * T / 2;
    for (const [x0, x1, r0, r1, h, o] of d.profile) { if (o && o.hide) continue; g.fillStyle = css(h); g.beginPath(); g.moveTo(x(x0), T / 2 - rr(r0)); g.lineTo(x(x1), T / 2 - rr(r1)); g.lineTo(x(x1), T / 2 + rr(r1)); g.lineTo(x(x0), T / 2 + rr(r0)); g.fill(); }
    if (d.glow) {
      const G = d.glow, r = rr(G.r || 0.0062);
      // round-ended bars: the coloured glow, then the white-hot core
      const bar = (h, fill, blur) => { g.shadowBlur = blur; g.fillStyle = fill; g.beginPath(); g.moveTo(x(G.to), T / 2 - h); g.lineTo(x(G.from), T / 2 - h); g.arc(x(G.from), T / 2, h, -Math.PI / 2, Math.PI / 2, true); g.lineTo(x(G.to), T / 2 + h); g.fill(); };
      g.save(); g.shadowColor = css(G.color); bar(r * 1.6, css(G.color), r * 5); bar(r, css(G.core != null ? G.core : 0xffffff), r * 2); g.restore();
      return;
    }
  } else {
  seg(0, 0.012, css(d.tip)); seg(0.012, 0.04, css(d.ferrule)); seg(0.04, 0.74, css(d.shaft)); seg(0.74, 0.756, css(d.joint));
  seg(0.756, 1.03, css(d.fore)); seg(1.03, 1.3, css(d.wrap)); seg(1.3, 1.45, css(d.sleeve)); seg(1.45, 1.47, '#0d0d0d');
  }
  if (d.points != null && !d.profile) {                                              // the points: long spear shapes running up the forearm
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
SND.voice('cue', (CUES[cueNow] || CUES[0]).sound);
// the ball set on the table, and how it sounds (content/30-balls.js: sound)
function useBalls(id) { scene.setBalls(id); SND.voice('ball', (BALLSKINS.find(b => b.id === id) || BALLSKINS[0]).sound); }
function useCue(i) { if (!CUES[i]) i = 0; if (i === cueNow) return; cueNow = i; scene.setCue(i); SND.voice('cue', CUES[i].sound); if (st.screen === 'play') paintPowerCue(); }
// what the gear in hand does (content/00-rarity.js): the cue now in hand - its hardest stroke, how much the strike point
// turns the ball, how long the guide - and the glove's steps for the power and the fine-aim dial
const cueK = () => { const s = (CUES[cueNow] || {}).stat || {}; return { power: 1 + (s.power || 0) / 100, spin: 1 + (s.spin || 0) / 100, guide: 1 + (s.guide || 0) / 100 }; };
const gloveStep = () => (GLOVES.find(g => g.id === prefs.glove) || {}).stat || BARE_HAND;
function paintPowerCue() { drawCue($('#powerCue'), CUES[cueNow] || CUES[0], true); }   // (the power gauge always stands upright)
