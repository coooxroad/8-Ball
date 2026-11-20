/* ================= the desk: the first screen =================
   Four places along the top - 플레이, 훈련, 내 장비, 상점 - each laid out in the same parts: the ivory rail on the left
   (what to choose), the felt tray in the middle (the live table, or what is chosen), the slate on the right (what it
   needs and the one button that does it). 플레이 lays its own panels over all three. The places are in the files after
   this one: 33-desk-play, 34-desk-train, 35-desk-shelves (내 장비 and 상점); 36-desk-paint lays the desk out and leans it.
   Here: the parts every place is built from, and moving between places. */
app.classList.add('desk');
const GAME4 = ['three', 'four', 'eight', 'nine'];
// with a friend on one device, also 스누커 (owner 11-11: only there, for now - no computer player, no room, no price)
const FRIEND_GAMES = GAME4.concat('snooker');
/* a game not open yet (economy.js SOON_MODES - 스누커, owner 11-20): open only on an account in debug mode, a lock and '곧 출시'
   on its keys and cards for the rest (the server refuses its queue and rooms as well) */
const soonGame = id => { let d = false; try { d = net.debug; } catch (e) {} return soonFor(id, d); };
const soonTap = id => () => toast(`${MODE_KO[id]}는 곧 출시됩니다.`, '', 2200);
const LOCK_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 10V7.5a5 5 0 0 1 10 0V10h.5A1.5 1.5 0 0 1 19 11.5v8a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5v-8A1.5 1.5 0 0 1 6.5 10zm2.5 0h5V7.5a2.5 2.5 0 0 0-5 0z"/></svg>';
const lockIco = () => { const i = el('i', { class: 'bd-lock', 'aria-hidden': 'true' }); i.innerHTML = LOCK_SVG; return i; };
// (copy audit 01-08: only what this game is played to - 랭킹전's rules - 8볼 and 9볼 by name alone)
// a ranked game's line under its name: the rules at this player's tier (economy.js rankedRules - an opponent of a higher
// tier plays theirs)
// (a game's rules go by its family's rating - economy.js familyOf; 캐롬's for these two)
// (in a 승급전, the tier played for: economy.js PROMO_*)
const caromDama = () => { const m = net.me; if (!m) return ECONOMY.DAMA_START; const d = m.damas ? m.damas.carom : m.dama, p = m.promo && m.promo.carom; return p ? Math.max(d, ECONOMY.TIER_AT[p.to]) : d; };
const GAME_SUB = {
  get three() { const r = rankedRules('three', [caromDama()]); return `쓰리쿠션 · ${r.target}점`; },
  get four() { const r = rankedRules('four', [caromDama()]); return `${r.target}점` + (r.finish ? ' · 쓰리쿠션 마무리' : ''); },
  eight: null, nine: null, snooker: null,
};
let deskTab = null, gearSel = 'cue', shopSel = 'cue';
const LESSONS = () => drills.list.filter(d => d.make).map(d => d.id);       // (drills.js: every lesson names its game volume and course)
const trainOf = () => prefs.mode === 'puzzle' ? 'puzzle' : prefs.mode === 'practice' ? (prefs.lessons ? 'lesson' : 'free') : prefs.trainCpu && GAME4.includes(prefs.mode) ? 'cpu' : null;
const svgArrow = d => { const s = el('span'); s.innerHTML = `<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="${d ? 'M8 4.5v15L19 12z' : 'M16 4.5v15L5 12z'}"/></svg>`; return s.firstChild; };
// Nearly every key on the desk is an onTap (the steppers and arrows only click: by the time they can be pressed
// something else has woken the audio). Most choices then save and lay the desk out again, and the ones that change
// the table also set up the live table again.
const repaint = () => { savePrefs(); paintHome(); };
const repaintLive = () => { savePrefs(); paintHome(); homePreview(); };
const dkPut = (node, kids) => { for (const k of [].concat(kids)) if (k) node.appendChild(k); };

// the parts the slate is made of
const dkH1 = (t, sub) => [el('h1', { text: t }), sub ? el('div', { class: 'sub', text: sub }) : null];
const dkHr = () => el('div', { class: 'dk-hr' });
const dkLab = t => el('div', { class: 'dk-lab', text: t });
const dkTxt = (t, hi) => { const p = el('div', { class: 'dk-txt' }); p.textContent = t; if (hi) p.appendChild(el('b', { text: hi })); return p; };
const dkSeg = (opts, cur, fn) => el('div', { class: 'dk-seg' }, opts.map(([v, t, off]) => el('button', { 'aria-pressed': String(v === cur), text: t, disabled: off ? '' : null, onclick: onTap(() => fn(v)) })));
function dkStep(vals, cur, fmt, fn, mini) {
  const i = Math.max(0, vals.indexOf(cur));
  return el('div', { class: 'dk-step' + (mini ? ' mini' : '') }, [
    el('button', { 'aria-label': '줄이기', text: '−', disabled: i <= 0 ? '' : null, onclick: () => { SND.tap(); fn(vals[i - 1]); } }),
    el('b', { text: fmt(vals[i]) }),
    el('button', { 'aria-label': '늘리기', text: '+', disabled: i >= vals.length - 1 ? '' : null, onclick: () => { SND.tap(); fn(vals[i + 1]); } })]);
}
const dkLabelled = (t, sub) => [document.createTextNode(t), sub ? el('small', { text: sub }) : null];
const dkMain = (t, sub, fn, off) => el('button', { class: 'dk-main', disabled: off ? '' : null, onclick: onTap(fn) }, dkLabelled(t, sub));
const dkSec = (t, fn, sub) => el('button', { class: 'dk-sec', onclick: onTap(fn) }, dkLabelled(t, sub));
const dkActs = (...btns) => el('div', { class: 'dk-acts' }, btns);
// the things laid on it: a cue as its photograph, the little cream tab on what is in use
/* Pictures the 3D takes for the cards - a ball in its case, a cue whole and close - are made one at a time, the ones on
   screen first, never all at once as a list opens (each is a render, a read back from the GPU and an encoding). Each is
   kept on the device (IndexedDB 'cue-pics', under this build's BUILD_ID: an update that changes how a thing looks takes
   them again), so from the second time a list opens they are simply there. lazyPic(img, key, make): img shows the picture
   as soon as it is had; make() returns { c: canvas, done } (done: false while the thing's surface pictures were still
   loading - such a picture is shown but not kept, and taken again next time). */
const PICS = { mem: new Map(), wait: [], db: null, loading: true, busy: false };
(function picsOpen() {
  const fin = () => { PICS.loading = false; picsPump(); };
  try {
    const rq = indexedDB.open('cue-pics', 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore('p');
    rq.onerror = fin;
    rq.onsuccess = () => {
      PICS.db = rq.result;
      try {
        const st = PICS.db.transaction('p', 'readwrite').objectStore('p'), cur = st.openCursor();
        cur.onsuccess = () => { const c = cur.result; if (!c) return fin();
          if (String(c.key).startsWith(BUILD_ID + '|')) PICS.mem.set(String(c.key).slice(BUILD_ID.length + 1), URL.createObjectURL(c.value)); else c.delete();
          c.continue(); };
        cur.onerror = fin;
      } catch (e) { fin(); }
    };
  } catch (e) { fin(); }
})();
function lazyPic(img, key, make) {
  const had = PICS.mem.get(key); if (had) { img.src = had; return img; }
  img.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';   // (a clear pixel till then)
  PICS.wait.push({ img, key, make }); picsPump(); return img;
}
const onScreen = n => { if (!n.isConnected) return false; const r = n.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth; };
function picsPump() {
  if (PICS.busy || PICS.loading || !PICS.wait.length) return;
  PICS.busy = true;
  requestAnimationFrame(() => {
    PICS.busy = false;
    PICS.wait = PICS.wait.filter(j => j.img.isConnected);
    // (one a frame: what shows on screen first, then the rest of the list; an image no longer on the page is dropped)
    const i = PICS.wait.findIndex(j => onScreen(j.img)), j = PICS.wait.splice(i >= 0 ? i : 0, 1)[0];
    if (j) {
      const had = PICS.mem.get(j.key);
      if (had) j.img.src = had;
      else {
        const t0 = performance.now(), r = j.make(); prof.add('ui', performance.now() - t0);
        const put = url => { for (const o of [j, ...PICS.wait.filter(o => o.key === j.key)]) o.img.src = url; PICS.wait = PICS.wait.filter(o => o.key !== j.key); };
        r.c.toBlob(b => {
          if (!b) return put(r.c.toDataURL('image/png'));
          const url = URL.createObjectURL(b); put(url);
          if (!r.done) return;
          PICS.mem.set(j.key, url);
          try { if (PICS.db) PICS.db.transaction('p', 'readwrite').objectStore('p').put(b, BUILD_ID + '|' + j.key); } catch (e) {}
        }, 'image/png');
      }
    }
    picsPump();
  });
}
/* a ball's picture: drawn ahead for every ball set (tools/ball-pics.js → ui/balls, owner 11-20: they came up one by one,
   slowly, after every update); a set changed since is drawn on the device as before (BALL_PICS: the sets up to date) */
const ballPic = (id, kind, n, attrs) => typeof BALL_PICS !== 'undefined' && BALL_PICS.includes(id) && (kind === 'pool' ? n < 16 : kind === 'carom' && n < 4)
  ? el('img', Object.assign({ alt: '', decoding: 'async', src: `ui/balls/${id}-${kind}-${n}.webp` }, attrs))
  : lazyPic(el('img', Object.assign({ alt: '' }, attrs)), `b/${id}/${kind}/${n}`, () => scene.ballShot(id, kind, n));
const cueImg = (c, cls) => el('img', { class: cls || null, src: `ui/cue-${c.id}.webp`, alt: c.name, draggable: 'false' });
const dkRow = (lab, val, fn) => el('div', { class: 'dk-row' }, [el('span', { class: 'dk-lab', text: lab }), el('button', { class: 'dk-chip', text: val, onclick: onTap(fn) })]);
// the tray's head: a title over a small line, with arrows either side when there is a list to step through
const dkTitle = (t, sub) => el('div', { class: 'tt' }, [el('h2', { text: t }), sub ? el('small', { text: sub }) : null]);
function dkNavHead(head, what, t, sub, go) {
  head.className = 'dk-head nav';
  const arrow = dir => el('button', { class: 'dk-arrow', 'aria-label': `${dir < 0 ? '이전' : '다음'} ${what}`, onclick: () => { SND.tap(); go(dir)(); } }, svgArrow(dir > 0 ? 1 : 0));
  dkPut(head, [arrow(-1), dkTitle(t, sub), arrow(1)]);
}

function deskGo(tab) {
  if (tab === deskTab && st.screen === 'home') { if (tab === 'play' && playStep !== 'boards') { playStep = 'boards'; paintHome(); } return; }   // (플레이 again: back to its boards)
  gearOff(); const was = deskTab; deskTab = tab; pressFx.enter = true;                     // (its cards come down in turn: 12-press.js)
  if (tab === 'play' && was !== 'play') playStep = 'boards';
  const game4 = m => GAME4.includes(m);
  if (tab === 'play') { prefs.trainCpu = false; prefs.vsAI = false; if (!game4(prefs.mode)) prefs.mode = game4(prefs.lastMode) ? prefs.lastMode : 'eight'; }   // (플레이 is against people; the computer is in 훈련)
  if (tab === 'train' && !trainOf()) { if (game4(prefs.mode)) prefs.lastMode = prefs.mode;
    if (prefs.lastTrain === 'cpu') { prefs.trainCpu = true; prefs.vsAI = true; prefs.mode = game4(prefs.cpuMode) ? prefs.cpuMode : 'eight'; } else prefs.mode = prefs.lastTrain === 'practice' ? 'practice' : 'puzzle'; }
  savePrefs();
  if (st.screen !== 'home') return goHome(true);
  paintHome(); if (was === 'gear' || tab === 'play' || tab === 'train') homePreview();
}
// the rail: a slot for each choice with its key down in it, the chosen key inlaid with felt and its red dot
function railBtn(on, label, sub, fn, soon, icon) {
  const kids = dkLabelled(label, sub);
  return el('div', { class: 'dk-slot' }, el('button', { class: 'dk-rb' + (soon ? ' soon' : '') + (icon ? ' iconed' : ''), 'aria-pressed': String(on), onclick: onTap(fn) },
    icon ? [el('i', { class: 'mi', style: `background-image:url(ui/${icon}.webp)` }), el('span', { class: 'lb' }, kids)] : kids));
}

/* The printed cards' ground (owner 11-19: the faint dot print gone for small signs drifting slowly on the diagonal, as quiet
   as the dots were - then, the same night: not cute, this is for players of every age, and closer together). So the signs
   are a billiard table's own plain geometry, thin lines: a ball's ring, a rail's sight diamond, a cross of the aim, a
   bank's angle, a rack's triangle - each card two of them, in a tile (one high left, one low right, turned a little),
   repeated over a layer a third wider and a sixth taller than the card (style/84-menu.css .mn-sym): the layer moves by
   exactly one tile, up and to the right, and starts again where it looks the same - so only transform moves, on a layer
   not much bigger than the card. Line drawings in 24 units, white; the CSS sets how faint. */
const SYM_D = {
  ring: '<circle cx="12" cy="12" r="6"/>',
  ball: '<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="1.6"/>',
  pair: '<circle cx="9.2" cy="12" r="4.6"/><circle cx="14.8" cy="12" r="4.6"/>',
  sight: '<path d="M12 6.5l3.6 5.5-3.6 5.5-3.6-5.5z"/>',
  aim: '<path d="M12 6v12M6 12h12"/>',
  cross: '<path d="M7.8 7.8l8.4 8.4M16.2 7.8l-8.4 8.4"/>',
  bank: '<path d="M5.5 16.5L12 8l6.5 8.5"/>',
  rank: '<path d="M6.5 13.5L12 9l5.5 4.5M6.5 17.5L12 13l5.5 4.5"/>',
  rack: '<path d="M12 7l6 10.4H6z"/>',
  frame: '<rect x="7" y="7" width="10" height="10" rx="1"/>',
  line: '<path d="M6 12h12"/>',
  half: '<path d="M10 6.5a5.5 5.5 0 0 1 0 11"/><path d="M10 5v14"/>',
  go: '<path d="M9.5 6.5L15 12l-5.5 5.5"/>' };
// each card's two (by its id; the 플레이 panels by theirs - 33-desk-play.js)
const PANEL_SYM = { rank: ['rank', 'sight'], friend: ['pair', 'sight'], lesson: ['bank', 'ball'], train: ['bank', 'ball'], puzzle: ['frame', 'aim'],
  arcade: ['cross', 'sight'], cpu: ['frame', 'line'], free: ['ball', 'aim'], four: ['ring', 'sight'], three: ['bank', 'sight'], eight: ['ball', 'rack'],
  nine: ['sight', 'ring'], snooker: ['ring', 'half'], 'way-local': ['pair', 'line'], 'way-make': ['aim', 'sight'], 'way-join': ['go', 'ring'], 'arc-mode': ['cross', 'sight'] };
// the tiles as one style, made once: .sym-<id> { --sym: the tile }
let symMade = false;
function symLayer(id, i) {
  if (!symMade) {
    symMade = true;
    const g = (k, x, y, r) => `<g transform="translate(${x} ${y}) rotate(${r}) scale(1.45) translate(-12 -12)">${SYM_D[k]}</g>`;
    const css = Object.entries(PANEL_SYM).map(([id, [a, b]]) => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 120" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${g(a, 25, 30, -12)}${g(b, 75, 90, 10)}</svg>`;
      return `.sym-${id}{--sym:url("data:image/svg+xml,${encodeURIComponent(svg)}")}`;
    }).join('\n');
    document.head.appendChild(el('style', { id: 'symStyle', text: css }));
  }
  return el('i', { class: 'mn-sym sym-' + (PANEL_SYM[id] ? id : 'four'), style: `--si:${i || 0}`, 'aria-hidden': 'true' });
}

/* Each place fills the same five parts of the desk, d = { rail, head, stage, foot, slate }, which deskPaint has emptied:
   the rail's keys, the tray's head, what lies in the tray (the live table unless stage.dataset.win is set to '0'), the
   tray's foot, and the slate - its options, then a .dk-acts row of buttons. */
