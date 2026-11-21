/* ================= the result held sideways: the hall's receipt (owner 11-21, 시안 2 계산서) =================
   On a sideways desk the result is a receipt from the billiard hall's counter beside a panel: the receipt printed up out of
   its slot line by line - the game, the opponent, the innings and the time; this player's numbers; what the game paid
   (coins, the rating - as the room's word comes in: 54-ranked.js writes those lines into #rSide, mirrored here); the total
   - then stamped, the stamp coming down hard (승리 red, 패배 slate blue, 무승부 grey), the paper jolting under it. The panel:
   this player and the score, the review's grades for this player (counted as the verdicts come in - 50-review.js paint),
   the other player's last word, and the keys. Upright (the web held upright) the old score sheet stays (50-result.css).
   The highlights (베스트 · 하이라이트 · 워스트) are not shown here (owner 11-21: placeholders for now). #result.rc. */
const receipt = {
  me: 0, kind: 'win', obs: null,
  // d: { kind: 'win'|'lose'|'draw', stamp, sub, mode, opp, innings, time, stats: [[k, v]], score, name }
  paint(d) {
    receipt.me = d.me; receipt.kind = d.kind;
    const res = $('#result'); res.classList.add('rc'); receipt.fit();
    let box = $('#rcpt');
    if (!box) { box = el('div', { id: 'rcpt' }); $('.r-plane').prepend(box); }
    const now = new Date();
    const when = `${now.getFullYear()}.${two(now.getMonth() + 1)}.${two(now.getDate())} ${two(now.getHours())}:${two(now.getMinutes())}`;
    const row = (k, v, cls) => el('div', { class: 'r' + (cls ? ' ' + cls : '') }, [el('span', { text: k }), el('b', { text: v })]);
    let n = 0; const line = node => { node.style.setProperty('--i', n++); return node; };
    box.className = d.kind; box.textContent = '';
    box.append(el('div', { class: 'paper' }, [
      line(el('h3', { text: 'CUE 당구장' })), line(el('div', { class: 'c', text: `${when} · ${d.table}번 테이블` })), line(el('hr')),
      line(row('종목', d.mode)), line(row('상대', d.opp)), line(row('이닝 / 시간', `${d.innings} / ${d.time}`)), line(el('hr')),
      ...d.stats.map(([k, v]) => line(row(k, String(v)))),
      line(el('div', { id: 'rcMoney' })),
      line(el('hr')), line(row('합계', d.score, 'tot')),
      el('div', { class: 'stamp', 'aria-label': d.stamp }, [el('b', { text: d.stamp }), el('small', { text: d.sub })]),
    ]), el('i', { class: 'slot', 'aria-hidden': 'true' }));
    // the panel's head and the grades, at the top of the slate's side
    const side = $('.r-side');
    let head = $('#rcHead'); if (!head) { head = el('div', { id: 'rcHead' }); side.prepend(head); }
    head.textContent = ''; head.append(el('span', { class: 'av', text: (d.name || '?').slice(0, 1) }), el('b', { class: 'nm', text: d.name }), el('span', { class: 'sc', text: d.score }));
    let g = $('#rcG'); if (!g) { g = el('div', { id: 'rcG' }); head.after(g); }
    receipt.grades(); receipt.money();
    if (!receipt.obs) { receipt.obs = new MutationObserver(() => receipt.money()); receipt.obs.observe($('#rSide'), { childList: true, subtree: true, characterData: true }); }
    // the stamp's knock as it lands (the printing takes about 1.8 s - 50-result.css rcPrint, the stamp lands at 2.1 s)
    clearTimeout(receipt.t); receipt.t = setTimeout(() => { if (st.screen === 'result' && res.classList.contains('rc')) SND.stamp(); }, 2130);
  },
  // what the game paid, as the slate has it (#rSide's lines: coins, the rating, 승급전 - 54-ranked.js paint)
  money() {
    const m = $('#rcMoney'); if (!m) return;
    const lines = [...$('#rSide').querySelectorAll('.dk-spec')].map(s => [s.querySelector('span'), s.querySelector('b')]).filter(([a, b]) => a && b);
    m.textContent = '';
    if (lines.length) m.append(el('hr'), ...lines.map(([a, b]) => el('div', { class: 'r' }, [el('span', { text: a.textContent }), el('b', { text: b.textContent })])));
  },
  // this player's grades, counted so far (50-review.js paint calls this as verdicts come in)
  grades() {
    const g = $('#rcG'); if (!g || typeof review === 'undefined') return;
    const all = review.list.filter(q => q.turn === receipt.me), s = review.stats(receipt.me), wait = all.filter(q => !q.res).length;
    g.textContent = ''; g.hidden = !all.length; if (!all.length) return;
    REVIEW_GRADES.forEach((G, i) => g.append(el('span', { class: 'g-' + G.id }, [reviewIcon(G.id), el('b', { text: String(s.n[i]) }), el('small', { text: G.name })])));
    if (wait) g.append(el('em', { text: `분석 중 ${all.length - wait}/${all.length}` }));
  },
  // its size to the screen: --k (1 on a tablet held sideways, about .64 on a phone)
  scale: () => Math.max(0.6, Math.min(1, innerHeight / 640, innerWidth / 1060)),   // (the rating's ring too - 50-rise.js)
  fit() { const r = $('#result'); if (r) r.style.setProperty('--k', receipt.scale().toFixed(3)); },
  // a result that is not one: the receipt put away (the upright sheet, a watched game)
  clear() { const r = $('#result'); if (r) r.classList.remove('rc'); clearTimeout(receipt.t); },
};
addEventListener('resize', () => receipt.fit());
