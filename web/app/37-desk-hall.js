/* ================= 플레이's menu: a billiard hall (owner 11-14) =================
   플레이's first step (boards) is no longer the desk: the screen is a billiard hall - a picture the owner drew (GPT) over
   line drawings taken from the game's own camera (tex/hall-kr.webp) - with the live table standing in it, in the equipped
   table's look, the balls racked and still (scene setHall: the camera held at the picture's, the floor hidden, the
   table's shadows on the picture's floor). The menu is a sheet of smoked glass at the left, turned a little towards the
   table, just under the bar: 랭킹전 large, its 시작 the one button that stands out (its games are chosen after it, as
   before), then 친구와 플레이, 훈련 (훈련 has no tab now - this opens it) and 아케이드 (준비 중; open in debug). The bar's
   tabs: 플레이, 내 장비, 상점. Between the hall and the desk (내 장비, 상점, 훈련, a card's next step) the two cross-fade:
   the old picture laid over the new and faded out (hallCross).
   디버그 · 메인 메뉴 예전: the desk's boards as they were (33-desk-play.js boards), with the 훈련 tab back. */
const HALL_PIC = 'hall-kr';
// (a screen held upright keeps the desk's boards for now: the hall is drawn for a wide screen - its own layout to come)
function hallMenuOn() { let d = false; try { d = net.debug; } catch (e) {} return !(d && prefs.oldMenu) && !(app.clientHeight > app.clientWidth); }
// is the hall what the home screen shows now? and is it showing?
function hallNow() { return st.screen === 'home' && deskTab === 'play' && playStep === 'boards' && hallMenuOn(); }
function hallShown() { return app.classList.contains('hallmenu'); }
// the cards' signs: line drawings, as the bar's tabs are drawn
const HALL_ICO = {
  rank: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5A3.5 3.5 0 0 1 16.5 11M12 14v3M8.5 20h7l-.7-3h-5.6z"/>',
  friend: '<circle cx="9" cy="8" r="3.2"/><circle cx="17" cy="9" r="2.6"/><path d="M3 19c.6-3.6 3-5.6 6-5.6s5.4 2 6 5.6M15 14.3c.7-.4 1.4-.6 2-.6 2.4 0 4 1.7 4.5 4.8"/>',
  train: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  arcade: '<rect x="3.5" y="5" width="10" height="14" rx="1.6" transform="rotate(-10 8.5 12)"/><rect x="10.5" y="4.5" width="10" height="14" rx="1.6" transform="rotate(8 15.5 11.5)"/>' };
const hallIco = k => { const s = el('i', { class: 'hm-ico', 'aria-hidden': 'true' }); s.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${HALL_ICO[k]}</svg>`; return s; };
let hallBusy = false;                                                 // (a card tapped: the menu is on its way out, taps wait)
function hallPaint() {
  let root = $('#hallMenu');
  if (!root) { root = el('div', { id: 'hallMenu' }); $('#deskPlane').after(root); }
  root.textContent = '';
  const dama = net.me ? net.me.dama : ECONOMY.DAMA_START;
  const T = ECONOMY.TIER_AT, ti = Math.max(0, T.filter(x => dama >= x).length - 1), tier = TIERS[Math.min(TIERS.length - 1, ti)];
  const lo = T[ti], hi = T[ti + 1], part = hi == null ? 1 : Math.max(0, Math.min(1, (dama - lo) / (hi - lo)));
  const go = fn => () => { if (hallBusy) return; SND.init(); SND.tap(); fn(); };
  const card = (id, fn, kids, cls) => el('button', { class: 'hm-card hm-' + id + (cls ? ' ' + cls : ''), onclick: go(fn) }, [el('i', { class: 'hm-sk', 'aria-hidden': 'true' }), el('span', { class: 'hm-in' }, kids)]);
  // (a tag above the name on 랭킹전, after it on a row - a row has room for two lines only)
  const title = (ico, t, sub, tag, after) => el('span', { class: 'hm-tt' }, [tag && !after ? el('em', { text: tag }) : null,
    el('b', null, [hallIco(ico), el('span', { text: t }), tag && after ? el('em', { text: tag }) : null]), sub ? el('small', { text: sub }) : null]);
  const arrow = () => el('i', { class: 'hm-go', 'aria-hidden': 'true' });
  const soon = what => () => toast(`${what} 준비 중입니다.`, '', 2200);
  root.appendChild(el('div', { class: 'hm-glass' }, [
    // (랭킹전's games are chosen after this, on the desk: 54-ranked.js pick - offline it says so and stays here)
    card('rank', () => ranked.pick(), [title('rank', '랭킹전', null, '온라인 1:1'),
      el('span', { class: 'hm-tier' }, [el('b', { text: tier[1] }), el('i', { style: `--p:${part.toFixed(3)}` }), el('small', { text: hi == null ? '최고 등급' : `${TIERS[ti + 1][1]}까지 ${hi - dama}` })]),
      el('span', { class: 'hm-start' }, [el('span', { text: '시작' }), arrow()])]),
    card('friend', () => { playFor = 'friend'; playStep = 'friend'; playFx = 'fan'; paintHome(); }, [title('friend', '친구와 플레이', '한 기기에서 · 친구 초대'), arrow()]),
    card('train', () => deskGo('train'), [title('train', '훈련', '레슨 · 퍼즐 · 자유 연습'), arrow()]),
    // (아케이드: 준비 중 - open with the debug setting only, owner 11-12)
    net.debug ? card('arcade', () => { playStep = 'arcade'; playFx = 'fan'; paintHome(); }, [title('arcade', '아케이드', '증강 당구', '디버그', true), arrow()])
      : card('arcade', soon('아케이드는'), [title('arcade', '아케이드', '준비 중'), arrow()], 'soon')]));
}
/* Between the hall and the desk: what the canvas shows is copied as it is (scene.snap) onto a canvas laid just over it,
   leaning as it leaned, the change is made under it, and the copy fades out - while the desk's plane fades in or out
   over it (the 'hallmenu' class: style/84-hall.css). */
function hallCross(on) {
  const x = $('#xfade') || (() => { const c = el('canvas', { id: 'xfade', 'aria-hidden': 'true' }); $('#gl').after(c); return c; })();
  let ok = false;
  if (st.screen === 'home' && (hallShown() || deskTableShown())) scene.snap(c => {
    x.width = c.width; x.height = c.height; const g = x.getContext('2d'); g.clearRect(0, 0, x.width, x.height);
    try { g.drawImage(c, 0, 0); ok = true; } catch (e) {}
  });
  x.classList.toggle('lean', app.classList.contains('tilt'));
  x.classList.remove('go'); x.hidden = !ok;
  app.classList.toggle('hallmenu', on);
  if (ok) { void x.offsetWidth; x.classList.add('go'); clearTimeout(x._t); x._t = setTimeout(() => { x.hidden = true; x.classList.remove('go'); }, 420); }
  hallBusy = true; setTimeout(() => { hallBusy = false; }, 380);
}
