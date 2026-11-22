/* ================= 플레이's menu: a row of cards on a cloth across the desk (owner 11-15) =================
   After 8 Ball Pool's row of game cards, on our desk (its wood and slope, its towel and chalk; no rail, tray or slate): a
   charcoal cloth runs across the desk past both sides of the screen, and on it, in one row that scrolls on sideways as far
   as it goes (no pages), my 선수증 - its look, sheen and the glint going round its rim by my tier - then the cards: 랭킹전
   (the largest, its rim alight: the tap opens its games), 친구와 플레이, 레슨, 퍼즐, 아케이드 (준비 중; open in debug),
   컴퓨터 대전, 자유 연습. 훈련 has no tab or card of its own: its four parts are cards. Each card is a printed card (a
   colour, a faint dot print, a white line inside the edge) with a black strip on top saying where I am in it.
   The cards are MENU_CARDS (one entry each - add one there, its sign in MENU_ICO under the same id). Sizes are in u, set by
   menuFit from the cloth's height and the screen's width; the row itself lies in a layer of its own over the desk (see
   menuFit). The screens each card opens are the desk's (33-desk-play.js, 34-desk-train.js) until they are made anew.
   디버그 · 메인 메뉴 예전: the desk's boards as they were (33-desk-play.js boards), with the 훈련 tab. A screen held upright
   keeps the boards for now (its own layout to come). */
// (the card menu, unless the debug setting asks for the old boards, or the screen is held upright)
function menuOn() { return !(app.clientHeight > app.clientWidth); }   // (the old menu to compare in debug mode: gone, owner 11-21)
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
  free: '<circle cx="15.5" cy="15.5" r="4.5"/><path d="M3 3l9 9"/>' };   // (each sign under its card's id)
let menuIO = null;                                                     // (the cards in sight: menuPaint)
const menuLine = (s, k) => { s.classList.remove('pic'); s.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${icoLift(MENU_ICO[k], 2.5)}</svg>`; };   // (heavier since 11-20: the cards to assert themselves)   // (its shadow drawn in: 10-ui.js icoLift)
/* 디버그 · 메인 카드 그림 (owner 11-20: the menu reads as a fine app, 8 Ball Pool's as a game): '3d' the card's sign as a
   rendered icon (ui/menu-<id>.webp, GPT - tasks/CUE-prompts-menu-icons.md: the same signs, made solid; a card whose picture
   is not in yet keeps its line icon). (Flat 2D props were tried the same night and dropped: they sat apart from the card.) */
const menuIco = k => {
  const s = el('i', { class: 'mn-ico', 'aria-hidden': 'true' });
  const how = false;   // (the pictured icons tried in debug mode: put away, owner 11-21 - kept for when they come back)
  if (how === true || how === '3d') { s.classList.add('pic'); s.appendChild(el('img', { src: `ui/menu-${k}.webp`, alt: '', draggable: 'false', onerror: () => menuLine(s, k) })); }
  else menuLine(s, k);
  return s;
};
// my rating and tier (economy.js TIER_AT; 33-desk-play.js TIERS)
function myTier() { return tierAt(net.me && net.me.dama != null ? net.me.dama : ECONOMY.DAMA_START); }
// a rating's tier, and the way to the next (anyone's: the other player's card on a match's opening too)
function tierAt(dama) {
  const T = ECONOMY.TIER_AT;
  const i = Math.min(TIERS.length - 1, Math.max(0, T.filter(x => dama >= x).length - 1)), hi = T[i + 1];
  return { dama, i, id: TIERS[i][0], name: TIERS[i][1], lo: T[i], hi, next: hi == null ? null : TIERS[i + 1][1], need: hi == null ? 0 : hi - dama,
    part: hi == null ? 1 : clamp01((dama - T[i]) / (hi - T[i])) };
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
  // (the strips: a number or a word, as a game's card shows it - not a sentence about it; owner 11-16: "레이팅 ****",
  // "온라인 1 : 1", "친구와 번갈아", "깼음" read as written by an AI)
  { id: 'rank', title: '랭킹전', sub: '4구 · 3구 · 8볼 · 9볼', hero: true, strip: () => { const t = myTier(); return `${t.name} ${t.dama.toLocaleString('ko-KR')}`; }, go: () => ranked.pick() },
  { id: 'friend', title: '친구와 플레이', sub: '한 기기 · 방 만들기', strip: () => '1 : 1 · 2 : 2', go: () => { playFor = 'friend'; playStep = 'friend'; playFx = 'fan'; paintHome(); } },
  { id: 'lesson', title: '레슨', sub: '기본기부터 차근차근', strip: () => { const ids = drills.list.filter(q => q.make && q.vol).map(q => q.id); return `${ids.filter(id => prefs.lessonProof[id]).length} / ${ids.length}`; }, go: () => trainGo('lesson') },
  { id: 'puzzle', title: '퍼즐', sub: '한 번에 끝내기', strip: () => { const L = puzzles.list; return L.length ? `${L.filter(q => prefs.pz.stars[q.id]).length} / ${puzzles.STAGES.length * PZ_SLOTS}` : '준비 중'; }, go: () => trainGo('puzzle') },
  { id: 'arcade', title: '아케이드', sub: '증강 당구', soon: () => !net.debug, strip: () => net.debug ? '디버그' : '준비 중', go: () => net.debug ? (playStep = 'arcade', playFx = 'fan', paintHome()) : soonToast('아케이드는')() },
  { id: 'cpu', title: '컴퓨터 대전', sub: '봇과 한 판', strip: () => `봇 ${typeof BOTS !== 'undefined' ? BOTS.length : 0}명`, go: () => trainGo('cpu') },
  { id: 'free', title: '자유 연습', sub: '마음대로 치기', strip: () => '4구 · 3구 · 8볼 · 9볼', go: () => trainGo('free') }];
/* Where the row lives. The cloth is part of the desk (#dkFelt, in the leaning plane), but the row of cards that scrolls
   on it is not: a scroller inside the plane's 3D lean was drawn again and again by the tablet as it scrolled - cards cut
   off at one height, whole frames gone, the bar's buttons too (owner 11-15, GPT's reading of the video). So the row is
   a layer of its own over the plane (#dkCards, laid exactly where the plane is, flat), the scroller in it flat too, and
   only the strip of cards inside it leans: the scroller's own 'perspective' (from the point the plane leans about, its
   bottom middle) and the strip's rotateX by the same angle about the same line make the plane's own projection - so the
   cards sit on the cloth as before, while the scrolling itself is plain. menuFit places it and sizes the cards. */
let menuScroll = 0;                                                   // (where the row was scrolled to, kept while the desk is away)
const MENU_W = { pad: 30, pc: 244, hero: 272, card: 204, gap: 14 };   // (the row's sizes in u: 84-menu.css uses the same)
function menuFit() {
  const felt = $('#dkFelt'), layer = $('#dkCards'), row = layer && layer.firstChild, pl = $('#deskPlane');
  if (!felt || !row || !menuShown() || !pl.offsetWidth) return;
  const dk = $('#desk'), density = parseFloat(app.style.getPropertyValue('--desk-density')) || 1;
  const t = parseFloat(app.style.getPropertyValue('--tilt')) || 0.26, P = parseFloat(app.style.getPropertyValue('--pp')) || 2300;
  const pw = pl.offsetWidth, ph = pl.offsetHeight;
  // the cloth in the plane's own flat coordinates (as deskWindow finds the tray)
  const fy = dk.offsetTop * density + felt.offsetTop, fh = felt.offsetHeight; if (!fh) return;
  /* the card size: the 랭킹전 card (560u) at 88% of the cloth's height - but no larger than lets the 선수증 and four cards
     show whole across the screen (the screen's width W shows W / k of the plane at a height h up it, k = P / (P + h sin t);
     taken low on the cards, where they show widest), and then the cloth comes in to the cards rather than leaving them
     small on it (owner 11-15: on a full screen only four showed) */
  const W = app.clientWidth, h = ph - (fy + fh * 0.8), k = P / (P + h * Math.sin(t)), seen = W / k;
  const need = MENU_W.pad + MENU_W.pc + MENU_W.hero + 3 * MENU_W.card + 4 * MENU_W.gap + 24;
  const u = Math.max(0.3, Math.min(fh * 0.88 / 560, seen / need));
  const clothH = Math.min(fh, 560 * u / 0.86);
  felt.style.setProperty('--fi', ((fh - clothH) / 2).toFixed(1) + 'px');
  // the row over the cloth, in the same coordinates (the layer is the plane's box, untransformed)
  Object.assign(row.style, { top: fy + 'px', height: fh + 'px' });
  row.style.setProperty('--u', u.toFixed(4)); app.style.setProperty('--mu', u.toFixed(4));   // (--mu: the screens after the menu size their cards by it)
  row.style.setProperty('--edge', Math.max(0, (pw - seen) / 2).toFixed(1) + 'px');   // (the plane's part off the screen's left edge, there)
  menuBalls.fit(u, fh, (fh - clothH) / 2, Math.max(0, (pw - seen) / 2));   // (the balls on the cloth: 38-menu-balls.js)
}
/* A player card (선수증): mine at the head of the menu, and both players' on a ranked match's opening (56-league.js).
   The tier's look - its paper, its header, its rim and the ring's tint, how much it shines, its ball (84-menu.css
   .t-<tier>) - with, over it, the player's own face for it and the title under the name (owner 11-21: 선수증 꾸미기,
   content/50-cards.js). o: { dama, name, sub (the line under the name when there is no title), av, bg, title, stats:
   [[label, value] ×3], tap?, bar? (false: no way to the next tier) }. */
function playerCard(o) {
  const t = tierAt(o.dama), bg = o.bg && o.bg !== 'tier' && CARD_BGS.some(q => q.id === o.bg) ? o.bg : null, ttl = o.title && o.title !== 'none' ? TITLES.find(q => q.id === o.title) : null;
  return el(o.tap ? 'button' : 'div', Object.assign({ class: `mn-pc t-${t.id}` + (bg ? ` bg-${bg}` : ''), 'aria-label': `선수증, ${o.name}, ${t.name}, 레이팅 ${t.dama}` + (ttl ? `, ${ttl.name}` : '') }, o.tap ? { onclick: o.tap } : { role: 'group' }), [
    el('span', { class: 'mn-rim', 'aria-hidden': 'true' }, el('img', { class: 'fxp', 'data-fx': 'glint:.95', alt: '' })), el('span', { class: 'mn-face', 'aria-hidden': 'true' }), el('span', { class: 'mn-sheen', 'aria-hidden': 'true' }, el('img', { class: 'fxp', 'data-fx': 'glint:.55', alt: '' })),
    ...[0, 1, 2, 3].map(k => el('i', { class: 'mn-sp s' + k, 'aria-hidden': 'true' })),
    el('div', { class: 'hd' }, [el('span', { text: `선수증 · ${t.name}` })]),
    el('span', { class: 'av', text: o.av || (o.name || '?').slice(0, 1) }),
    el('b', { class: 'nm', text: o.name }), ttl ? el('small', { class: 'who ttl', text: ttl.name }) : el('small', { class: 'who', text: o.sub || '' }),
    el('span', { class: 'em' }, el('b', { text: t.name })),
    o.bar === false ? null : el('span', { class: 'bar' }, [el('small', { text: t.next ? `${t.next}까지 ${t.need}` : '최고 등급' }), el('i', { style: `--p:${(t.part * 100).toFixed(1)}%` })]),
    el('span', { class: 'st' }, o.stats.map(([k, v]) => el('span', null, [el('b', { text: String(v) }), document.createTextNode(k)])))]);
}
/* The glass case (owner 11-21, everyone's): the card held in a thick, angular block of clear acrylic - a front and a back
   pane with the card between them, four edge faces (its thickness, cyan-green as thick glass edges are), the front's
   edges cut at 45° and lit as the light from the upper right lights them - no lid; the tier's frame round the card.
   Drawn in 3D where WebGL is (38-glass3d.js: still on the menu, swinging in and flung away on the match's opening -
   56-league.js), in CSS 3D where not (84-menu.css .g3, 79-league.css). cw: the card's width in u (the opening's cards
   are wider). Returns the case, the card inside it. */
// its dressings (owner 11-21, chosen after trying each): the desk's eye, the edges lit with the hologram seal (다이아·프로),
// CUE and the number cut in its foot - no screws
const GZ_ON = 'gz-view gz-glow gz-mark';
function glassCase(card, cw, eye) {
  const f = (cls, kids) => el('i', { class: 'f ' + cls, 'aria-hidden': 'true' }, kids);
  // (its dressings - GZ_ON; the tier for its frame and seal; eye: 'l' when the eye is to the case's left)
  const tier = (/\bt-(\w+)/.exec(card.className) || [])[1] || 'bronze', nm = (card.querySelector('.nm') || {}).textContent || '';
  const no = String([...nm].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9973, 7)).padStart(4, '0');
  const cls = ['g3', 't-' + tier, eye === 'l' ? 'vl' : '', GZ_ON].filter(Boolean).join(' ');
  const g = el('div', { class: cls, style: cw ? `--cw:${cw}px` : null }, [f('shade'), f('back'), f('side l'), f('side r'), f('side t'), f('side b'), f('tier', el('span', { class: 'mn-rim' }, el('img', { class: 'fxp', 'data-fx': 'glint:.95', alt: '' }))), card, f('front'),
    f('mark', [el('b', { text: 'CUE' }), el('small', { text: 'No.' + no })]), f('holo')]);
  // (drawn in 3D once it is on the page - 38-glass3d.js; the opening's cases are played there by 56-league.js)
  if (!eye) { let n = 0; const go = () => { if (g.isConnected) glass3d.still(g); else if (++n < 30) requestAnimationFrame(go); }; requestAnimationFrame(go); }
  return g;
}
// a title open to this device's player: one without a need, or with its record met (content/50-cards.js need)
function titleOpen(q) {
  const n = q.need; if (!n) return true;
  const r = rec[prefs.names[0]] || {}, games = (r.w || 0) + (r.l || 0);
  return (n.w == null || (r.w || 0) >= n.w) && (n.best == null || (r.best || 0) >= n.best) && (n.games == null || games >= n.games);
}
/* 선수증 꾸미기 (owner 11-21): the card as it looks now, then its face and its title to choose - each choice shows at once
   on the card above, and is worn from the next game (the other player sees it on the match's opening: ranked.gear) */
function sheetCard() {
  const t = myTier(), r = rec[prefs.names[0]] || {}, games = (r.w || 0) + (r.l || 0);
  const view = el('div', { class: 'pc-view' }), paint = () => {
    view.replaceChildren(playerCard({ dama: t.dama, name: prefs.names[0], sub: '칭호를 골라 보세요', av: $('#dkMe .av').textContent || '1', bg: prefs.card.bg, title: prefs.card.title,
      stats: [['판', games], ['승률', games ? `${Math.round(100 * (r.w || 0) / games)}%` : '-'], ['연승', r.streak || 0]] }));
    for (const b of document.querySelectorAll('#sheetBody .pc-bg')) b.setAttribute('aria-pressed', String(b.dataset.id === prefs.card.bg));
    for (const b of document.querySelectorAll('#sheetBody .pc-ttl')) b.setAttribute('aria-pressed', String(b.dataset.id === prefs.card.title));
  };
  const pick = (k, id) => { SND.tap(); prefs.card[k] = id; savePrefs(); paint(); if (st.screen === 'home') paintHome(); };
  const bgs = el('div', { class: 'pc-bgs' }, CARD_BGS.map(q => el('button', { class: `pc-bg mn-pc t-${t.id}` + (q.id === 'tier' ? '' : ` bg-${q.id}`), 'data-id': q.id, 'aria-pressed': 'false', onclick: () => pick('bg', q.id) }, [el('span', { class: 'mn-face' }), el('b', { text: q.name })])));
  const ttls = el('div', { class: 'pc-ttls' }, TITLES.map(q => { const open = titleOpen(q);
    return el('button', { class: 'pc-ttl' + (open ? '' : ' locked'), 'data-id': q.id, 'aria-pressed': 'false', disabled: open ? null : '', onclick: open ? () => pick('title', q.id) : null }, [el('b', { text: q.name }), open ? null : el('small', { text: q.need.w ? `${q.need.w}승` : q.need.best ? `${q.need.best}연승` : `${q.need.games}판` })]); }));
  openSheet('선수증 꾸미기', [el('div', { class: 'pc-edit' }, [view, el('div', { class: 'pc-opts' }, [el('h3', { text: '배경' }), bgs, el('h3', { text: '칭호' }), ttls, note('상대에게도 다음 경기부터 이렇게 보입니다. 도전과제로 여는 칭호와 배경은 곧 나옵니다.')])])]);
  paint();
}
function menuPaint() {
  // the cloth on the desk, and the layer for the row over the plane (made once)
  if (!$('#dkFelt')) $('#desk').appendChild(el('div', { class: 'dk-felt', id: 'dkFelt', 'aria-hidden': 'true' }));
  menuBalls.mount($('#dkFelt'));
  let layer = $('#dkCards');
  if (!layer) {
    layer = el('div', { id: 'dkCards' }); ($('#dkBalls') || $('#dkProps') || $('#deskPlane')).after(layer);   // (over the menu's towel and plant, and the balls' layer)
    // (fitted again when the cloth changes size - not step by step while the window does: layout() fits it after)
    if (window.ResizeObserver) new ResizeObserver(() => { if (!app.classList.contains('resizing')) menuFit(); }).observe($('#dkFelt'));
    // (a touch on a ball lying on the cloth between the cards sends it rolling - the row would take it otherwise)
    layer.addEventListener('pointerdown', e => { if (menuBalls.touch(e)) e.stopPropagation(); }, true);
    // (a wheel turns the row sideways on a computer)
    layer.addEventListener('wheel', e => { const r = layer.firstChild; if (r && Math.abs(e.deltaY) > Math.abs(e.deltaX)) { r.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
  }
  const r = rec[prefs.names[0]] || {}, games = (r.w || 0) + (r.l || 0);
  const go = fn => () => { SND.init(); SND.tap(); fn(); };
  /* The row is made again only when what it shows has changed (R2 S2-a): coming back to 플레이 from 내 장비 or 상점, or
     any repaint while on it (the server's answers, the wallet), made every card and the glass case anew - and the case
     is drawn in 3D, the most of what a return to the menu cost (CPU ×4: 350 ms, the plan of 11-20). What a card shows
     is its strip and whether it is 준비 중; the 선수증 its player's numbers - the key below. The cards' taps do the same
     whichever row holds them. */
  const pcO = { dama: myTier().dama, name: prefs.names[0], sub: net.on ? (net.me && net.me.joined ? '회원' : '게스트 · 가입하기') : '오프라인', av: $('#dkMe .av').textContent || '1',
    bg: prefs.card.bg, title: prefs.card.title, stats: [['판', games], ['승률', games ? `${Math.round(100 * (r.w || 0) / games)}%` : '-'], ['연승', r.streak || 0]] };
  const soonOf = c => typeof c.soon === 'function' ? c.soon() : !!c.soon;
  const key = JSON.stringify([pcO, MENU_CARDS.map(c => [soonOf(c), c.strip()])]);
  const old = layer.firstChild; if (old) menuScroll = old.scrollLeft;
  if (old && old._key === key) { streakPaint(); menuFit(); old.scrollLeft = menuScroll; requestAnimationFrame(() => { menuFit(); old.scrollLeft = menuScroll; menuFx.run(); }); return; }
  // my 선수증 (tapped: 선수증 꾸미기 - its face and title, sheetCard)
  const pc = playerCard(Object.assign({ tap: go(sheetCard) }, pcO)); pc.classList.add('me');   // (its badge burns while the days run on: 58-streak.js)
  // (each card alive, calmly - owner 11-16: the light crossing it now and then, each on its own beat (--i), (the icon
  // still since 11-18), (11-17 night) a soft light and shade flowing inside it, and (11-19) its small signs drifting on the
  // diagonal in place of the dots (32-desk.js symLayer); only a card in sight moves - 'mn-live' below -
  // 84-menu.css. 11-17: the small tables, the bot standing in
  // 컴퓨터 대전's card and the strip shining were tried and taken out again - owner: too busy)
  const cards = MENU_CARDS.map((c, i) => {
    const soon = soonOf(c);
    return el('button', { class: `mn-card k-${c.id}${c.hero ? ' hero' : ''}${soon ? ' soon' : ''}`, 'data-k': c.id, style: `--i:${i}`, onclick: go(c.go) }, [
      ...(c.hero ? [el('span', { class: 'mn-rim', 'aria-hidden': 'true' }, el('img', { class: 'fxp', 'data-fx': 'glint:1', alt: '' })), el('span', { class: 'mn-face', 'aria-hidden': 'true' })] : []),
      el('span', { class: 'mn-fx', 'aria-hidden': 'true' }, [menuFx.canvas(c.id, i, i), el('img', { class: 'x fxp', 'data-fx': 'x', alt: '' })]),
      el('span', { class: 'strip', text: c.strip() }), menuIco(c.id), el('b', { text: c.title }), el('small', { text: c.sub })]);
  });
  // (디버그 모드: the 선수증 in its glass case, seen from the front - glassCase)
  const row = el('div', { class: 'mn-row' }, el('div', { class: 'mn-track' }, [glassCase(pc), ...cards])); row._key = key;
  layer.textContent = ''; layer.appendChild(row); streakPaint();
  row.addEventListener('scroll', () => { menuScroll = row.scrollLeft; }, { passive: true });
  // (a card moves only while it is in sight, or nearly: the rest wait without their moving layers - 84-menu.css gives
  // those only to .mn-live, so the cards out of sight hold no memory on the graphics chip; owner 11-19, parts of the screen
  // and some icons went missing on the tablet as the menu scrolled or the screen changed size. The margin: a card coming in
  // gets its layers a little before it shows, not while the row is under the finger)
  if (menuIO) menuIO.disconnect();
  if (typeof IntersectionObserver === 'function') { menuIO = new IntersectionObserver(es => { for (const e of es) e.target.classList.toggle('mn-live', e.isIntersecting); menuFx.run(); }, { root: row, rootMargin: '0px 25%', threshold: 0 }); for (const c of [pc, ...cards]) menuIO.observe(c); }
  else for (const c of [pc, ...cards]) c.classList.add('mn-live');
  menuFit(); row.scrollLeft = menuScroll;
  requestAnimationFrame(() => { menuFit(); row.scrollLeft = menuScroll; menuFx.run(); });
}
