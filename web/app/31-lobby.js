/* ================= the lobby (prefs.ui 'lobby'; 'classic' is the home screen before it) =================
   The same home underneath - the panel, its choices, the live table - laid out as a game's lobby: every game in sight as
   the ball it is played with, the player at the top left, records and settings at the top right where anyone looks for
   them, and one big lit button. Switching back to 'classic' in the settings puts the old screen back exactly. */
const lobbyOn = () => prefs.ui === 'lobby';
const DOCK = [
  ['eight', '8볼', '포켓볼', () => sph('#141418', '8', 54)],
  ['nine', '9볼', '포켓볼', () => sph('#f2b705', '9', 54, true)],
  ['four', '4구', '캐롬', () => pair(['#d3241c', '#f4c20d'])],
  ['three', '3구', '캐롬 대대', () => pair(['#d3241c', '#f4c20d', '#f4efe2'])],
  null,
  ['puzzle', '퍼즐', '', () => icoPath('<circle cx="7" cy="17" r="3.2" fill="currentColor" stroke="none"/><path d="M9.6 15.2 C 13 11, 15 9.5, 18.5 6.5" stroke-dasharray="1.5 3.2"/><path d="M18.5 6.5 l-3.4 .4 M18.5 6.5 l-.4 3.4"/>')],
  ['practice', '레슨', '', () => icoPath('<circle cx="12" cy="12" r="8.2"/><circle cx="12" cy="12" r="4.6"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/>')],
];
function sph(c, n, size, stripe) {
  const b = el('span', { class: 'bl3' }), s = el('i', { class: 'sph' + (stripe ? ' st' : ''), style: `--c:${c};inset:0` });
  if (n) s.appendChild(el('em', { text: n })); b.appendChild(s); return b;
}
function pair(cs) {
  const b = el('span', { class: 'bl3' }), n = cs.length, d = n === 2 ? 63 : 52;                // in hundredths of the icon, so it scales
  const at = n === 2 ? [[4, 26], [37, 7]] : [[24, 0], [0, 44], [48, 44]];
  cs.forEach((c, i) => b.appendChild(el('i', { class: 'sph', style: `--c:${c};width:${d}%;height:${d}%;left:${at[i][0]}%;top:${at[i][1]}%` })));
  return b;
}
function icoPath(d) {
  const b = el('span', { class: 'bl3' }), i = el('span', { class: 'ico' });
  i.innerHTML = `<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  b.appendChild(i); return b;
}
// which game the lobby is on: the panel's own notion (practice and puzzle are places, the rest are prefs.mode)
const lobbyMode = () => prefs.mode === 'practice' || prefs.mode === 'puzzle' ? prefs.mode : game.MODES[prefs.mode] && prefs.mode !== 'puzzle4' ? prefs.mode : 'eight';
function buildDock() {
  const dock = $('#dock'); dock.textContent = ''; let grp = el('div', { class: 'grp' }), k = 0;
  for (const d of DOCK) {
    if (!d) { dock.appendChild(grp); grp = el('div', { class: 'grp' }); continue; }
    const [id, name, sub, ic] = d;
    grp.appendChild(el('button', { class: 'gt', 'data-id': id, style: `--k:${k++}`, 'aria-pressed': 'false', onclick: () => pickGame(id) }, [ic(), el('b', { text: name }), el('small', { text: sub })]));
  }
  dock.appendChild(grp);
}
function pickGame(id) {
  SND.init(); SND.tap();
  if (lobbyMode() === id) return;
  const game4 = m => game.MODES[m] && m !== 'practice' && m !== 'puzzle4';
  if (game4(prefs.mode)) prefs.lastMode = prefs.mode;
  prefs.mode = id; savePrefs();
  paintHome(); homePreview();
}
// called at the end of paintHome: the parts only the lobby has
function lobbyPaint() {
  if (!lobbyOn()) return;
  const m = lobbyMode(); app.dataset.mode = m;
  for (const b of document.querySelectorAll('#dock .gt')) {
    b.setAttribute('aria-pressed', String(b.dataset.id === m));
    const sm = b.querySelector('small');
    if (b.dataset.id === 'puzzle') { const L = puzzles.list, n = L.filter(q => prefs.pz.stars[q.id]).length; sm.textContent = `${n}/${L.length} 풀이`; }
    if (b.dataset.id === 'practice') { const all = COURSES.flatMap(c => c[1]).filter(id => drills.byId(id).make), done = all.filter(id => levelOf(id) >= drills.LEVELS).length; sm.textContent = `${done}/${all.length} 완료`; }
  }
  // the panel's title: the game, the ball it is played with, what it is in a line
  { const d = DOCK.find(x => x && x[0] === m), lab = $('#rightLab'), mm = game.MODES[m];
    const line = m === 'practice' ? '기본기부터 차근차근, 단계별 연습' : m === 'puzzle' ? '정해진 배치를 한 번에 풀기 · 4구 기술 7가지' : mm ? mm.blurb : '';
    lab.textContent = ''; lab.appendChild(d[3]()); lab.appendChild(el('span', null, [document.createTextNode(d[1]), el('small', { text: line })])); }
  // the player at the top: name, record, a run of wins on fire
  const me = prefs.names[0], r = rec[me];
  $('#meBtn .nm').textContent = me; $('#meBtn .rc').textContent = recText(me);
  $('#meBtn').className = 'me' + (r && r.streak >= 2 ? ' fire' : '');
  $('#tbRec').setAttribute('aria-pressed', String(st.screen === 'records'));
  $('#tbRec span').textContent = st.screen === 'records' ? '로비로' : '전적';
  // the button says what it starts
  const btn = $('#startBtn'), main = btn.textContent, prac = m === 'practice', puz = m === 'puzzle';
  const sub = prac ? (drills.byId(prefs.drill) || {}).name || '' : puz ? '퍼즐' : `${MODE_KO[m]} · ${prefs.vsAI ? '컴퓨터 ' + LEVELS[prefs.level] : '친구와'}`;
  btn.textContent = ''; btn.appendChild(el('b', { text: prac || puz ? main : `${MODE_KO[m]} 시작` })); btn.appendChild(el('small', { text: prac || puz ? sub : sub.replace(MODE_KO[m] + ' · ', '') }));
  // the lamp hangs over the table, wherever the layout has put it
  $('#room').style.setProperty('--lx', wide ? `calc((100% - 400px) / 2 + 10px)` : '50%');
  if (app.classList.contains('tallp')) layoutSoon();                 // upright, the table sits above the panel, whose height just changed
}
// put on the home screen chosen in the settings: the .lobby or .desk class (neither is the classic one), and for the
// lobby the pieces it adds and the equipment buttons moved into its panel and back
function applyUI() {
  const on = lobbyOn(); app.classList.toggle('lobby', on); app.classList.toggle('desk', prefs.ui === 'desk');
  const chips = $('.h-chips');
  if (on) { if (!$('#dock').children.length) buildDock(); $('.h-right').insertBefore(chips, $('#startBtn')); }
  else { $('.h-mid').appendChild(chips); delete app.dataset.mode; $('#startBtn').textContent = '시작'; }
}
press('#meBtn', () => sheetName(0));
press('#tbSet', sheetSettings);
press('#tbRec', () => { if (st.screen === 'records') goHome(true); else showRecords(); });
applyUI();
