/* ================= 당구드롭: a billiard ball to open, won with a game =================
   One comes with every ranked game won, and with a game won against the computer (a few a day): economy.js DROP. Opened,
   the server draws it - its rarity and what is in it - before anything shows (net.openDrop); the screen then plays the
   way there. The ball sits in a burst of light in its rarity's colour; each tap (DROP.TAPS of them) shakes it, and while
   it is below what was drawn the tap breaks it open a rarity higher - a flash, a new ball. Then one more tap and it gives
   up what is inside: coins, diamonds, or a thing of the rarity below.
   The balls: 일반 the white cue ball, 희귀 the blue 2, 에픽 the purple 4, 신화 the red 3, 전설 a golden 1, 시크릿 the 8 in a
   rainbow. A count on the desk's bar and on a won game's result says how many are waiting. */
const DROP_BALL = [['cue', ''], ['blue', '2'], ['violet', '4'], ['red', '3'], ['gold', '1'], ['eight', '8']];
const dropView = { on: null };
const dropsWaiting = () => (net.me && net.me.drops) || 0;
// the counts: on the desk's bar, and a button on the result of a won game
function dropPaint() {
  const n = dropsWaiting(), b = $('#dkDrop');
  if (b) { b.hidden = !n; b.querySelector('b').textContent = n; }
  const btns = $('#result .r-btns');
  if (btns) {
    let r = $('#rDrop');
    if (n && !r) { r = el('button', { class: 'r-drop', id: 'rDrop', onclick: onTap(dropOpen) }, [el('i', { class: 'dk-dball' }), el('span', null, [el('b', { text: '당구드롭 열기' }), el('small')])]); btns.insertBefore(r, btns.firstChild); }
    if (r) { r.hidden = !n; r.querySelector('small').textContent = `${n}개 기다리는 중`; }
  }
}
/* The burst of light behind the ball: soft wedges fading out from the middle, drawn once on a small canvas and scaled up
   to cover the screen, turning. A canvas is handed to the graphics card as it is (384 pixels square) however large it is
   shown, where a screen-sized drawn layer would be drawn again at the phone's full density. */
function dropRays(cv, rainbow) {
  const N = cv.width, g = cv.getContext('2d'), h = N / 2, n = 22;
  g.clearRect(0, 0, N, N);
  for (let i = 0; i < n; i++) {
    const a = i / n * Math.PI * 2, w = 0.07, gr = g.createRadialGradient(h, h, 0, h, h, h);
    const col = rainbow ? `hsla(${(i * 360 / n) | 0},95%,72%,` : 'rgba(255,255,255,';
    gr.addColorStop(0, col + '0.9)'); gr.addColorStop(0.45, col + '0.45)'); gr.addColorStop(1, col + '0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(h, h); g.arc(h, h, h, a - w, a + w); g.closePath(); g.fill();
  }
  cv.style.setProperty('--k', (1.5 * Math.max(innerWidth, innerHeight) / N).toFixed(2));
}
function dropBall(rar) {
  const [k, n] = DROP_BALL[rar];
  return el('span', { class: 'dball b-' + k }, [el('i', { class: 'shade' }), n ? el('span', { class: 'disc' }, el('b', { text: n })) : el('i', { class: 'dot' }), el('i', { class: 'shine' })]);
}
async function dropOpen() {
  if (dropView.on) return;
  if (!dropsWaiting()) return toast('열 당구드롭이 없습니다.', '', 1800);
  SND.init(); SND.tap();
  const d = dropView.on = { busy: true };
  const r = await net.openDrop();
  if (!r || !r.ok) { dropView.on = null; return toast(r && r.why === 'no drop' ? '열 당구드롭이 없습니다.' : '서버에 연결할 수 없습니다.', 'foul', 2200); }
  const TAPS = ECONOMY.DROP.TAPS;
  Object.assign(d, { busy: false, cur: 0, final: r.rarity, prize: r.prize, taps: TAPS, phase: 'tap' });
  const box = el('div', { id: 'dropView', class: 'r0', role: 'dialog', 'aria-label': '당구드롭' }, [
    el('canvas', { class: 'rays', width: '384', height: '384' }), el('i', { class: 'glow' }),
    el('div', { class: 'dv-top' }, [el('small', { text: '당구드롭' }), el('b', { class: 'rname', text: RARITY[0][0] })]),
    el('button', { class: 'dv-ball', 'aria-label': '두드리기', onclick: () => dropTap() }, dropBall(0)),
    el('div', { class: 'dv-taps' }, Array.from({ length: TAPS }, () => el('i'))),
    el('p', { class: 'dv-hint', text: '공을 두드리세요' }),
    el('div', { class: 'dv-prize', hidden: '' }),
    el('i', { class: 'flash' })]);
  d.box = box; app.appendChild(box); dropRays(box.querySelector('.rays'), false);
  requestAnimationFrame(() => box.classList.add('in'));
}
function dropSet(rar) {
  const d = dropView.on, box = d.box;
  box.className = box.className.replace(/\br\d\b/, 'r' + rar);
  if (rar === 5) dropRays(box.querySelector('.rays'), true);
  box.querySelector('.rname').textContent = RARITY[rar][0];
  const b = box.querySelector('.dv-ball'); b.textContent = ''; b.appendChild(dropBall(rar));
}
function dropFlash(big) { const f = dropView.on.box.querySelector('.flash'); f.classList.remove('go', 'big'); void f.offsetWidth; f.classList.add('go'); if (big) f.classList.add('big'); }
function dropTap() {
  const d = dropView.on; if (!d || d.busy) return;
  const box = d.box, ball = box.querySelector('.dv-ball');
  if (d.phase === 'tap') {
    // up by as many rarities as are left over the taps left (so the last tap reaches what was drawn); else a shake only
    const left = d.final - d.cur, up = left > 0 ? Math.ceil(left / d.taps) : 0;
    d.taps--; box.querySelectorAll('.dv-taps i')[ECONOMY.DROP.TAPS - 1 - d.taps].classList.add('used');
    ball.classList.remove('shake', 'pop'); void ball.offsetWidth; ball.classList.add('shake'); d.busy = true;
    setTimeout(() => {
      if (dropView.on !== d) return;
      if (up) { d.cur += up; dropFlash(d.cur >= 4); dropSet(d.cur); const b2 = box.querySelector('.dv-ball'); b2.classList.add('pop'); SND.good(); }
      else SND.tap();
      box.querySelector('.dv-hint').textContent = d.taps ? (up ? `${RARITY[d.cur][0]}!` : '그대로…') : '한 번 더 두드려 여세요';
      if (!d.taps) d.phase = 'open';
      d.busy = false;
    }, 420);
    return;
  }
  if (d.phase === 'open') { d.phase = 'done'; dropFlash(true); SND.win(); setTimeout(() => dropReveal(), 260); }
}
function dropReveal() {
  const d = dropView.on, box = d.box, p = d.prize, pz = box.querySelector('.dv-prize');
  box.classList.add('opened'); box.querySelector('.dv-hint').textContent = '';
  let pic, big, sub;
  if (p.item) {
    const q = itemOf(p.item) || {}, k = p.item.kind;
    pic = k === 'cue' ? el('img', { class: 'pz-cue', src: `ui/cue-${q.id}.webp`, alt: '' }) : k === 'ball' ? el('img', { class: 'pz-ball', src: scene.ballPortrait(q.id, 'pool', 8), alt: '' })
      : k === 'table' ? el('i', { class: 'pz-cloth', style: `background:#${(q.felt || 0).toString(16).padStart(6, '0')} url(ui/cloth-${q.id}.webp) center/cover` }) : k === 'glove' ? el('img', { class: 'pz-glove', src: `ui/glove-${q.id}.webp`, alt: '' }) : el('i', { class: 'pz-trail' });
    big = q.name || p.item.id; sub = `${KIND_KO[k] || ''} · ${RARITY[q.rarity || 0][0]} · 내 장비에 들어갔습니다`;
  } else if (p.dia) { pic = el('i', { class: 'pz-dia' }); big = `+${p.dia.toLocaleString('ko-KR')}`; sub = '다이아'; }
  else { pic = el('i', { class: 'pz-coin' }); big = `+${(p.coin || 0).toLocaleString('ko-KR')}`; sub = '코인'; }
  const more = dropsWaiting();
  pz.textContent = '';
  pz.append(pic, el('b', { text: big }), el('small', { text: sub }),
    el('div', { class: 'pz-btns' }, [more ? el('button', { class: 'btn cta', text: `다음 드롭 (${more})`, onclick: () => { SND.tap(); dropClose(); setTimeout(dropOpen, 120); } }) : null,
      el('button', { class: 'btn', text: '확인', onclick: () => { SND.tap(); dropClose(); } })]));
  pz.hidden = false;
}
function dropClose() { const d = dropView.on; if (!d) return; d.box.remove(); dropView.on = null; dropPaint(); if (st.screen === 'home') paintHome(); }
press('#dkDrop', dropOpen);
