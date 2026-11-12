/* The app: screens, input and the frame loop. The build joins every file in this folder, in name order, inside one
   function, so they share one scope - a name declared in one file is visible in all the others. To keep that honest:
     - what several files share is declared HERE (settings, the game, what is on screen, the current flow) and nowhere else;
     - everything else a file declares is its own;
     - tools/check.js fails the build if two files declare the same name.
   00-state    what is shared, and what is worn      40-shot        the shot pipeline and the scoreboard
   05-music    the lobby's tune, win and lose songs   50-match       a game between two players (or one and the computer)
   07-net      the server: wallet, rewards, ranked    54-ranked      랭킹전: finding an opponent, playing them online
                                                      55-invite      친구 초대: a code, and a game on two devices
   10-ui       small DOM helpers, screens, layout     51-practice    lessons and free practice
   20-sheets   every sheet that slides up             52-puzzle      puzzles
   30-home     what the desk and the flows share      53-demo        one given shot, played by the app
   32-desk     the desk's parts, moving between places 56-league     the CUELEAGUE opening; 57-account, 58-tutorial
                                                      59-emote       quick emotes in an online game
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
/* '끝까지' (조준선 sheet, for trying the physics out): every ball's whole way, from the stroke to rest, at any cue - but never
   in an online game (the other player sees the usual line), nor while the computer or the other player is at the table. */

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
    shotClock: 60,
    ballSkin: 'classic', trail: 'none', glove: null, lessons: false,
    friendWay: 'local', fourTarget: 10, lessonProof: {},
    fourMinus: true,                   // 4구 with a friend: a foul costs a point (마이너스 점수 있음) or nothing
    // add-ons for games with a friend (33-desk-play.js): 현실 당구 on or off, and which of its parts
    addons: { real: false, throw: true, squirt: true, cue: true },
    shapeTry: null,                    // 디버그: free practice on a table of another shape (tables.js TABLE_SHAPES)
    deskWood: 'oak', deskTray: 'blue', // 디버그: the desk's wood and the tray to try (DESK_LOOK; out of debug mode the game's own)
    ultTry: false,                     // 디버그: 아케이드's ultimate gauge shown in any game (50-match.js paintUlt)
    wallet: { coin: 0, dia: 0 } }, saved);
  if (!Array.isArray(p.guides) || p.guides.length !== 2) { const g = typeof saved.guide === 'number' ? saved.guide : 2; p.guides = [g, g]; }   // older saves had one guide for both
  delete p.guide;
  delete p.ui; delete p.uiv; delete p.theme; delete p.news;           // the lobby, the old home, the light theme and the 2.0 news: gone
  if (!p.trainCpu) p.vsAI = false;                                      // (the computer is played from 훈련 only)
  if (!TABLES.some(t => t.id === p.table)) p.table = 'bar';
  delete p.puz; delete p.arcade;                                        // from before the puzzles were stages, and the arcade row
  /* Cues are kept by id (cueIds, cueId), worn by their place in CUES: a cue taken out (5.0: 황금, 거대 연필, 드래곤, 기사의 검,
     크리스탈) moves the others up, and the id still finds them. A save from before kept only the places, in the order of
     CUES then (OLD_CUE_ORDER); a cue no longer there goes back to the first. */
  const OLD_CUE_ORDER = ['maple', 'carbon', 'rose', 'house', 'sport', 'saber', 'gold', 'pencil', 'dragon', 'sword', 'guitar', 'flute', 'crystal', 'breaker'];
  const cueAt = id => Math.max(0, CUES.findIndex(c => c.id === id));
  if (!Array.isArray(p.cueIds)) { p.cueIds = (Array.isArray(p.cues) ? p.cues : [p.cue, p.cue]).map(i => OLD_CUE_ORDER[i] || null); p.cueId = OLD_CUE_ORDER[p.cue] || null; }
  p.cues = p.cueIds.length === 2 ? p.cueIds.map(cueAt) : null; p.cue = cueAt(p.cueId);
  /* Tables likewise by id (clothId) since 11-10, when 학교 책상 was taken out; a save from before kept the place in this order. */
  const OLD_CLOTH_ORDER = ['teal', 'green', 'blue', 'wine', 'charcoal', 'pool', 'desk', 'soccer', 'court', 'night', 'ice'];
  { const id = typeof p.clothId === 'string' ? p.clothId : OLD_CLOTH_ORDER[p.cloth]; p.cloth = Math.max(0, CLOTHS.findIndex(c => c.id === id)); }
  if (!CLOTHS[p.cloth]) p.cloth = 0; if (!CUES[p.cue]) p.cue = 0;      // a look that has since been taken out
  if (!TRAILS.some(t => t.id === p.trail)) p.trail = 'none';           // (먹, 분필: taken out 11-10)
  // add-ons start switched off (owner 11-10) - once, for saves that had kept one on
  if (p.adv !== 1) { p.addons = Object.assign({}, p.addons, { real: false }); p.adv = 1; }
  if (!p.drillLv || typeof p.drillLv !== 'object') p.drillLv = {};
  p.aim = 'line';                                                            // (the rail look is folded into the line: scene/90-frame.js - owner, 11-08)
  if (p.gv !== 2) { p.guides = p.guides.map(k => [0, 0.25, 0.5, 0.75][k] ?? 0.5); p.gv = 2; }   // guide lengths were four steps, now a slider
  if (!Array.isArray(p.cues) || p.cues.length !== 2) p.cues = [p.cue, p.cue];             // a cue each
  p.cues = p.cues.map(i => CUES[i] ? i : 0);
  if (!p.suji || typeof p.suji !== 'object') p.suji = {};
  if (!p.pz || typeof p.pz !== 'object' || !p.pz.stars) p.pz = { cur: 1, stars: {}, open: 0 };
  if (p.clk !== 2) { if (p.shotClock === 40) p.shotClock = 60; p.clk = 2; }   // 4.0: the shot clock's default went from 40 to 60 s
  delete p.lab; delete p.masse;                                         // the 2.0 laboratory switches and the raised-cue permission: gone
  delete p.light;                                                       // (the 디버그 light sliders: gone - LIGHT0 is the light, 11-13)
  if (p.v < 2) { p.how = Object.keys(saved).length > 0; p.v = 2; p.fast = false; if (![3, 5, 10].includes(p.target)) p.target = 5; }   // 2.0: fast play starts switched off
  return p;
})();
const savePrefs = () => { prefs.clothId = (CLOTHS[prefs.cloth] || CLOTHS[0]).id; prefs.cueIds = (prefs.cues || []).map(i => (CUES[i] || CUES[0]).id); prefs.cueId = (CUES[prefs.cue] || CUES[0]).id; store.set('prefs', prefs); };   // (cues by id: above)

/* Everything plays on the one physics (physics.js: what you picture is what happens). usePhysics() puts the tables of the
   chosen size where the game looks for them; it is called before a game is started. */
const tableCache = {};
const tableOf = (key, cfg) => tableCache[key] || (tableCache[key] = createPhysics(cfg));
const poolOf = id => tableOf(id, Object.assign({ pockets: true }, (TABLES.find(t => t.id === id) || TABLES[0]).cfg));
const PH = {};
// (tbl: a table the game was given - an online game's is the room's, never this device's choice: 54-ranked.js)
function usePhysics(tbl) { PH.pool = poolOf(tbl || prefs.table); PH.carom = tableOf('carom', CAROM.carom); PH.carom3 = tableOf('carom3', CAROM.carom3); PH.snooker = tableOf('snooker', SNOOKER.cfg); }
usePhysics();
const game = createGame(PH, createAI);
const drills = createDrills(), puzzles = createPuzzles();
const SND = createAudio(() => prefs.sound);
const highlights = createHighlights();
if (!game.MODES[prefs.mode]) prefs.mode = 'eight';
if (drills.byId(prefs.drill).id !== prefs.drill) prefs.drill = 'free';
// (a player's name is a key: kept in an object with no prototype, so a name like __proto__ or constructor is a name like any
// other - Codex B21)
const recBook = o => Object.assign(Object.create(null), o && typeof o === 'object' ? o : {});
let rec = recBook(store.get('rec', {}));
const recOf = n => { const r = rec[n] || (rec[n] = { w: 0, l: 0, streak: 0, best: 0 }); if (!r.form) r.form = []; return r; };
const series = { key: '', s: [0, 0] };
const oppName = () => prefs.vsAI ? '컴퓨터' : prefs.names[1];
// four-ball handicaps, the way a hall counts: 50 means five scores to go out. Kept per name.
const SUJI = [3, 5, 8, 10, 15, 20];
const sujiOf = i => i === 1 && prefs.vsAI ? prefs.sujiAI || 5 : prefs.suji[prefs.names[i]] || 5;

/* What is on screen and where the current shot is.
   screen: home | play | result | reel
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
// 현실 당구 as a game's rules take it (game.js realOf): null when off, or none of its parts are on
const realPref = () => { const A = prefs.addons || {}; return A.real && (A.throw || A.squirt || A.cue) ? { throw: !!A.throw, squirt: !!A.squirt, cue: !!A.cue } : null; };
// the cue as drawn: with 현실 당구's cue angle on, raised over what is behind the cue ball as the shot will be (physics.js)
const shownEl = () => {
  const w = game.world; if (!w || !w.real || !w.real.cue || st.phase !== 'aim' || !game.P.cueRiseTan) return st.el;
  return Math.max(st.el, Math.atan(game.P.cueRiseTan(w, st.aim, st.spin.x * 0.5, st.spin.y * 0.5)));
};
// the add-ons as words, for a room's capsules and the slate's card
const addonNames = r => r && (r.throw || r.squirt || r.cue) ? ['현실 당구'] : [];
// (a ranked game wears the look the two players' gear makes: 54-ranked.js lookOf)
const lookNow = () => typeof flow !== 'undefined' && flow === match && match.ctx && match.ctx.online && match.ctx.online.look;
function dress(ice) { const L = lookNow(); scene.setCloth(ice ? ICE : iceOn() ? 0 : L ? L.cloth : prefs.cloth); }
// back to this player's own things (leaving a ranked game)
function ownLook() { useBalls(prefs.ballSkin); scene.setTrail(prefs.trail); dress(false); }
/* The desk's wood and the tray (its frame and its cloth) - owner 11-13: walnut and deep green to try (batch 11), chosen in
   the 디버그 sheet while the owner decides; out of debug mode the game's own (the first of each). Put on #app as CSS
   variables (style/60-desk.css, 50-result.css read them); base: the colour under the picture while it loads, back: the 3D
   room behind the table on the desk (it sits in the tray's cloth). */
const DESK_LOOK = {
  wood: { oak: { name: '오크', img: 'ui/desk.webp', base: '#6b4527' }, walnut: { name: '월넛', img: 'ui/desk-walnut.webp', base: '#512a1a' },
    'walnut-dark': { name: '다크 월넛', img: 'ui/desk-walnut-dark.webp', base: '#2d190e' } },
  tray: { blue: { name: '블루', frame: 'ui/tray.webp', felt: 'ui/felt.webp', base: '#0e4c8e', back: 0x034db0 },
    green: { name: '그린', frame: 'ui/tray-green.webp', felt: 'ui/felt-green.webp', base: '#104d3a', back: 0x0d4634 },
    walnut: { name: '월넛 레일', frame: 'ui/tray-walnut.webp', felt: 'ui/felt-green.webp', base: '#104d3a', back: 0x0d4634 } },
};
const deskLook = () => {
  let d = false; try { d = net.debug; } catch (e) {}                 // (the first call is before net is made: 07-net.js)
  return { wood: DESK_LOOK.wood[d && prefs.deskWood] || DESK_LOOK.wood.oak, tray: DESK_LOOK.tray[d && prefs.deskTray] || DESK_LOOK.tray.blue };
};
// behind everything: the desk's wood on the home screen, the dark room in play
function applyBackdrop() {
  const desk = st.screen === 'home', L = deskLook(), a = document.getElementById('app').style;   // on the desk's home the table sits on felt
  /* (whole addresses: a url() in a CSS variable is read against the sheet that uses it, and on the web the styles are a
     file in h/ - site/split.cjs - so 'ui/...' there was h/ui/..., not found: the desk and the tray lost their pictures) */
  const at = f => `url("${new URL(f, document.baseURI).href}")`;
  a.setProperty('--desk-img', at(L.wood.img)); a.setProperty('--desk-base', L.wood.base);
  a.setProperty('--tray-img', at(L.tray.frame)); a.setProperty('--felt-img', at(L.tray.felt)); a.setProperty('--felt-base', L.tray.base);
  document.body.style.background = desk ? L.wood.base : '#101216';
  scene.setBackdrop(desk ? L.tray.back : 0x101216);
}
applyBackdrop();
// One drawing of the chosen cue, with the same sections and proportions as the 3D one (tip, ferrule, shaft, joint,
// forearm with its points, wrap, sleeve, bumper). Used by the power control and by the cue chooser.
// Drawn tip-first along the canvas's long side; `vertical` puts the tip at the top.
function drawCue(cv, d, vertical) {
  // (a width set exactly - paintPowerCue - is taken as set: clientWidth rounds it to a whole CSS pixel)
  const dpr = Math.min(3, window.devicePixelRatio || 1), cw = parseFloat(cv.style.width) || cv.clientWidth, ch = cv.clientHeight; if (!cw || !ch) return;
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
// how far from the centre the strike point may go with the cue in hand, in pad units (1: half the ball's radius; a
// trait's cue goes further - content/20-cues.js TRAITS); a point set with another cue is pulled in to it
const spinMax = () => spinMaxOf(CUES[cueNow]);
function useCue(i) { if (!CUES[i]) i = 0; if (i === cueNow) return; cueNow = i; scene.setCue(i);
  { const M = spinMax(), m = Math.hypot(st.spin.x, st.spin.y); if (m > M) { st.spin = { x: st.spin.x * M / m, y: st.spin.y * M / m }; setSpinUI(); } } SND.voice('cue', CUES[i].sound); if (st.screen === 'play') paintPowerCue(); }
// what the gear in hand does (content/00-rarity.js): the cue now in hand - its hardest stroke, how much the strike point
// turns the ball, how long the guide - and the glove's steps for the power and the fine-aim dial
const cueK = () => { const s = (CUES[cueNow] || {}).stat || {}; return { power: 1 + (s.power || 0) / 100, spin: 1 + (s.spin || 0) / 100, guide: 1 + (s.guide || 0) / 100 }; };
// (on one device with a friend, the glove of whoever is shooting: theirs is prefs.glove2 - 33-desk-play.js friendGear)
const gloveStep = () => (GLOVES.find(g => g.id === (flow === match && match.ctx && !match.ctx.online && !match.ctx.ai && game.turn === 1 ? prefs.glove2 : prefs.glove)) || {}).stat || BARE_HAND;
/* The cue in the power gauge, upright. As thick as a cue of its length (1.47 m to about 35 mm drawn, a little fuller than
   the real 29 mm) and never thicker than the look gives it - a gauge made short by a small or zoomed screen used to keep
   its full width and look fat. A whole, even count of device pixels wide, so that the canvas is never resampled and,
   centred, lands on pixel edges - a zoom of 125% had it blurred. */
function paintPowerCue() {
  const cv = $('#powerCue'); cv.style.width = '';
  const dpr = Math.min(3, window.devicePixelRatio || 1), w = cv.clientWidth, h = cv.clientHeight;
  if (w && h && h > w * 3) { let px = Math.max(6, Math.round(Math.min(w, h / 42) * dpr)); px -= px % 2; cv.style.width = px / dpr + 'px'; }
  drawCue(cv, CUES[cueNow] || CUES[0], true);
}

/* Where the time goes, for the FPS display (90-loop.js perfTick): the frame loop and the computer add what they spent. */
const PROF_KO = { ai: 'AI', guide: '조준', sim: '물리', draw: '그리기', ui: '화면', js: '계산' };
const prof = {
  cur: {}, win: {}, worst: 0, worstWhy: '', hid: false,
  add(k, ms) { this.cur[k] = (this.cur[k] || 0) + ms; if (ms > (this.win[k] || 0)) this.win[k] = ms; },
  // a new frame: what the last one spent, kept for naming the cause of a long gap
  frame() { this.last = this.cur; this.cur = {}; },
  why(gap) {   // the biggest piece of work behind a gap: this frame's own, or work the browser saw between frames
    const c = Object.assign({}, this.last || {}); delete c.js; if (this.uiGap) { c.ui = Math.max(c.ui || 0, this.uiGap); this.uiGap = 0; }
    let k = '', v = 0; for (const x in c) if (c[x] > v) { v = c[x]; k = x; }
    return v > gap * 0.3 ? PROF_KO[k] : '';
  },
};
document.addEventListener('visibilitychange', () => { if (document.hidden) prof.hid = true; });
try {   // work outside our frames (taps, building a screen): the browser says how long it held the page
  const seen = e => { const ms = e.duration; prof.add('ui', ms); prof.uiGap = Math.max(prof.uiGap || 0, ms); };
  const kinds = (PerformanceObserver.supportedEntryTypes || []);
  const type = kinds.includes('long-animation-frame') ? 'long-animation-frame' : kinds.includes('longtask') ? 'longtask' : null;
  if (type) new PerformanceObserver(l => { for (const e of l.getEntries()) seen(e); }).observe({ type, buffered: false });
} catch (e) {}
