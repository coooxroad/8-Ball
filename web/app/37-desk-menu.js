/* ================= 플레이's menu: a row of cards on a cloth across the desk (owner 11-15) =================
   After 8 Ball Pool's row of game cards, on our desk (its wood and slope, its towel and chalk; no rail, tray or slate): a
   charcoal cloth runs across the desk past both sides of the screen, and on it, in one row that scrolls on sideways as far
   as it goes (no pages), my 선수증 - its look, sheen and the glint going round its rim by my tier - then the cards: 랭킹전
   (the largest, its rim alight: the tap opens its games), 친구와 플레이, 레슨, 퍼즐, 아케이드 (준비 중; open in
   debug), 컴퓨터 대전, 자유 연습 (관전 and 투어 were cards for a day: out, owner 11-15). 훈련 has no tab or card of its own now: its four parts are cards. Each card is a
   printed card (a colour, a faint dot print, a white line inside the edge) with a black strip on top saying where I am in it.
   The cards are MENU_CARDS: one entry each - add one there. Everything is sized from the row's height (--u: the 랭킹전 card
   is 560u tall), so the row is the same on any screen that holds it.
   디버그 · 메인 메뉴 예전: the desk's boards as they were (33-desk-play.js boards), with the 훈련 tab. A screen held upright
   keeps the boards for now (its own layout to come). */
// (the card menu, unless the debug setting asks for the old boards, or the screen is held upright)
function menuOn() { let d = false; try { d = net.debug; } catch (e) {} return !(d && prefs.oldMenu) && !(app.clientHeight > app.clientWidth); }
// is the card menu what the home screen shows now? and is it showing?
function menuNow() { return st.screen === 'home' && deskTab === 'play' && playStep === 'boards' && menuOn(); }
function menuShown() { return $('#desk').classList.contains('menu'); }
// the cards' signs: line drawings, as the bar's tabs are drawn
const MENU_ICO = {
  rank: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5A3.5 3.5 0 0 1 16.5 11M12 14v3M8.5 20h7l-.7-3h-5.6z"/>',
  friend: '<circle cx="9" cy="8" r="3.2"/><circle cx="17" cy="9" r="2.6"/><path d="M3 19c.6-3.6 3-5.6 6-5.6s5.4 2 6 5.6M15 14.3c.7-.4 1.4-.6 2-.6 2.4 0 4 1.7 4.5 4.8"/>',
  lesson: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M8 7.5h8M8 11h6"/>',
  puzzle: '<path d="M9 4h3a2 2 0 1 1 4 0h3v5a2 2 0 1 1 0 4v6h-5a2 2 0 1 0-4 0H5v-6a2 2 0 1 0 0-4V4z"/>',
  arcade: '<rect x="3.5" y="5" width="10" height="14" rx="1.6" transform="rotate(-10 8.5 12)"/><rect x="10.5" y="4.5" width="10" height="14" rx="1.6" transform="rotate(8 15.5 11.5)"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><path d="M9 2.5V6M15 2.5V6M9 18v3.5M15 18v3.5M2.5 9H6M2.5 15H6M18 9h3.5M18 15h3.5"/>',
  solo: '<circle cx="15.5" cy="15.5" r="4.5"/><path d="M3 3l9 9"/>' };
const menuIco = k => { const s = el('i', { class: 'mn-ico', 'aria-hidden': 'true' }); s.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${MENU_ICO[k]}</svg>`; return s; };
// my rating and tier (economy.js TIER_AT; 33-desk-play.js TIERS)
function myTier() {
  const dama = net.me && net.me.dama != null ? net.me.dama : ECONOMY.DAMA_START, T = ECONOMY.TIER_AT;
  const i = Math.min(TIERS.length - 1, Math.max(0, T.filter(x => dama >= x).length - 1)), hi = T[i + 1];
  return { dama, id: TIERS[i][0], name: TIERS[i][1], next: hi == null ? null : TIERS[i + 1][1], need: hi == null ? 0 : hi - dama,
    part: hi == null ? 1 : Math.max(0, Math.min(1, (dama - T[i]) / (hi - T[i]))) };
}
// 훈련's four parts, each its own card: the same choices its rail makes (34-desk-train.js), then 훈련's place
function trainGo(t) {
  const off = () => { prefs.trainCpu = false; prefs.vsAI = false; };
  if (t === 'lesson') { off(); prefs.lessons = true; prefs.lastTrain = prefs.mode = 'practice'; }
  else if (t === 'free') { off(); prefs.lessons = false; prefs.lastTrain = prefs.mode = 'practice'; }
  else if (t === 'puzzle') { off(); prefs.lastTrain = prefs.mode = 'puzzle'; }
  else { prefs.lastTrain = 'cpu'; prefs.trainCpu = true; prefs.vsAI = true; prefs.mode = GAME4.includes(prefs.cpuMode) ? prefs.cpuMode : 'eight'; }
  deskGo('train');
}
const soonToast = what => () => toast(`${what} 준비 중입니다.`, '', 2200);
/* The cards, in their order. id (its colour and sign: style/84-menu.css), title, sub (a line under it), strip (the black
   strip on top: where I am in it), go (the tap), soon (준비 중: dimmed, the tap only says so), hero (랭킹전: larger, lit). */
const MENU_CARDS = [
  { id: 'rank', title: '랭킹전', sub: '4구 · 3구 · 8볼 · 9볼', hero: true, strip: () => `레이팅 ${myTier().dama.toLocaleString('ko-KR')} · 온라인 1:1`, go: () => ranked.pick() },
  { id: 'friend', title: '친구와 플레이', sub: '한 기기 · 방 만들기', strip: () => '친구와 번갈아', go: () => { playFor = 'friend'; playStep = 'friend'; playFx = 'fan'; paintHome(); } },
  { id: 'lesson', title: '레슨', sub: '샷을 하나씩 배우기', strip: () => { const ids = drills.list.filter(q => q.make && q.vol).map(q => q.id); return `${ids.filter(id => prefs.lessonProof[id]).length} / ${ids.length} 깼음`; }, go: () => trainGo('lesson') },
  { id: 'puzzle', title: '퍼즐', sub: '정해진 공을 한 번에', strip: () => { const L = puzzles.list; return L.length ? `${L.filter(q => prefs.pz.stars[q.id]).length} / ${L.length} 풀었음` : '준비 중'; }, go: () => trainGo('puzzle') },
  { id: 'arcade', title: '아케이드', sub: '증강 당구', soon: () => !net.debug, strip: () => net.debug ? '디버그' : '준비 중', go: () => net.debug ? (playStep = 'arcade', playFx = 'fan', paintHome()) : soonToast('아케이드는')() },
  { id: 'cpu', title: '컴퓨터 대전', sub: '사람 같은 상대와 한 판', strip: () => '4종목 · 난이도 4단계', go: () => trainGo('cpu') },
  { id: 'free', title: '자유 연습', sub: '공을 놓고 마음대로', strip: () => '혼자 · 시간 제한 없음', go: () => trainGo('free') }];
let menuScroll = 0;                                                   // (where the row was scrolled to, kept while the desk is away)
function menuPaint() {
  let root = $('#dkMenu');
  if (!root) {
    root = el('div', { class: 'dk-menu', id: 'dkMenu' }); $('#desk').appendChild(root);
    // the row's unit: the 랭킹전 card (560u) takes 88% of the cloth's height, whatever the screen - every size in the cards
    // is in u, so they grow and shrink whole (owner 11-15); a wheel turns the row sideways on a computer
    const fit = () => { const r = root.firstChild; if (r && r.clientHeight) root.style.setProperty('--u', Math.max(0.3, r.clientHeight * 0.88 / 560).toFixed(4)); };
    if (window.ResizeObserver) new ResizeObserver(fit).observe(root); root._fit = fit;
    root.addEventListener('wheel', e => { const r = root.firstChild; if (r && Math.abs(e.deltaY) > Math.abs(e.deltaX)) { r.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
  }
  const t = myTier(), r = rec[prefs.names[0]] || {}, games = (r.w || 0) + (r.l || 0);
  const go = fn => () => { SND.init(); SND.tap(); fn(); };
  // my 선수증: the tier's look, its sheen and rim (84-menu.css .t-<tier>), a few sparkles from 골드 up
  const pc = el('div', { class: `mn-pc t-${t.id}`, role: 'group', 'aria-label': `선수증, ${t.name}, 레이팅 ${t.dama}` }, [
    el('span', { class: 'mn-rim', 'aria-hidden': 'true' }, el('i')), el('span', { class: 'mn-face', 'aria-hidden': 'true' }), el('span', { class: 'mn-sheen', 'aria-hidden': 'true' }, el('i')),
    ...[0, 1, 2, 3].map(k => el('i', { class: 'mn-sp s' + k, 'aria-hidden': 'true' })),
    el('div', { class: 'hd' }, [el('span', { text: `선수증 · ${t.name}` })]),
    el('small', { class: 'rt', text: `레이팅 ${t.dama.toLocaleString('ko-KR')}` }),
    el('span', { class: 'av', text: $('#dkMe .av').textContent || '1' }),
    el('b', { class: 'nm', text: prefs.names[0] }), el('small', { class: 'who', text: net.on ? (net.me && net.me.joined ? '회원' : '게스트 · 가입하기') : '오프라인' }),
    el('span', { class: 'em' }, el('b', { text: t.name })),
    el('span', { class: 'bar' }, [el('small', { text: t.next ? `${t.next}까지 ${t.need}` : '최고 등급' }), el('i', { style: `--p:${(t.part * 100).toFixed(1)}%` })]),
    el('span', { class: 'st' }, [['판', games], ['승률', games ? `${Math.round(100 * (r.w || 0) / games)}%` : '-'], ['연승', r.streak || 0]].map(([k, v]) => el('span', null, [el('b', { text: String(v) }), document.createTextNode(k)])))]);
  const cards = MENU_CARDS.map(c => {
    const soon = typeof c.soon === 'function' ? c.soon() : !!c.soon;
    return el('button', { class: `mn-card k-${c.id}${c.hero ? ' hero' : ''}${soon ? ' soon' : ''}`, 'data-k': c.id, onclick: go(c.go) }, [
      ...(c.hero ? [el('span', { class: 'mn-rim', 'aria-hidden': 'true' }, el('i')), el('span', { class: 'mn-face', 'aria-hidden': 'true' })] : []),
      el('span', { class: 'strip', text: c.strip() }), menuIco(c.id), el('b', { text: c.title }), el('small', { text: c.sub })]);
  });
  const row = el('div', { class: 'mn-row' }, [pc, ...cards]);
  const old = root.firstChild; if (old) menuScroll = old.scrollLeft;
  root.textContent = ''; root.appendChild(row);
  row.addEventListener('scroll', () => { menuScroll = row.scrollLeft; }, { passive: true });
  requestAnimationFrame(() => { if (root._fit) root._fit(); row.scrollLeft = menuScroll; });
}
