/* ================= the desk: the first screen =================
   Four places along the top - 플레이, 훈련, 내 장비, 상점 - each laid out in the same parts: the ivory rail on the left
   (what to choose), the felt tray in the middle (the live table, or what is chosen), the slate on the right (what it
   needs and the one button that does it). 플레이 lays its own panels over all three. The places are in the files after
   this one: 33-desk-play, 34-desk-train, 35-desk-shelves (내 장비 and 상점); 36-desk-paint lays the desk out and leans it.
   Here: the parts every place is built from, and moving between places. */
app.classList.add('desk');
const GAME4 = ['three', 'four', 'eight', 'nine'];
const GAME_SUB = { three: '쓰리쿠션', four: '사구 · 수지 대결', eight: '에잇볼', nine: '나인볼' };
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
const cueImg = (c, cls) => el('img', { class: cls || null, src: `ui/cue-${c.id}.webp`, alt: c.name, draggable: 'false' });
const dkRow = (lab, val, fn) => el('div', { class: 'dk-row' }, [el('span', { class: 'dk-lab', text: lab }), el('button', { class: 'dk-chip', text: val, onclick: onTap(fn) })]);
function guideRow() {
  const a = guideName(prefs.guides[0]), b = guideName(prefs.guides[1]);
  return dkRow('조준선', a === b || prefs.vsAI ? a : a + ' · ' + b, sheetGuide);
}
// the tray's head: a title over a small line, with arrows either side when there is a list to step through
const dkTitle = (t, sub) => el('div', { class: 'tt' }, [el('h2', { text: t }), el('small', { text: sub })]);
function dkNavHead(head, what, t, sub, go) {
  head.className = 'dk-head nav';
  const arrow = dir => el('button', { class: 'dk-arrow', 'aria-label': `${dir < 0 ? '이전' : '다음'} ${what}`, onclick: () => { SND.tap(); go(dir)(); } }, svgArrow(dir > 0 ? 1 : 0));
  dkPut(head, [arrow(-1), dkTitle(t, sub), arrow(1)]);
}

function deskGo(tab) {
  if (tab === deskTab && st.screen === 'home') { if (tab === 'play' && playStep !== 'boards') { playStep = 'boards'; paintHome(); } return; }   // (플레이 again: back to its boards)
  gearOff(); const was = deskTab; deskTab = tab;
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

/* Each place fills the same five parts of the desk, d = { rail, head, stage, foot, slate }, which deskPaint has emptied:
   the rail's keys, the tray's head, what lies in the tray (the live table unless stage.dataset.win is set to '0'), the
   tray's foot, and the slate - its options, then a .dk-acts row of buttons. */
