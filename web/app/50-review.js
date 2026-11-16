/* ================= the game review (owner 11-16: as chess.com reviews a game) =================
   Every shot this device's player plays is set, off the screen's thread, against what a strong player finds on the same
   table (ai/50-human.js humanReview, through the Worker - 40-shot.js aiWorker): a grade of six, from 예술입니다 down to
   실수입니다, a 예술 점수 (how fine a made shot looked) and 실용성 (what it left). The result's slate shows the count of each
   grade and the averages; 샷별 리뷰 lists the shots, each one played again on a tap (70-buttons.js playShot).
   Only for a person at this device - not the computer's shots, nor a game watched. */
const REVIEW_GRADES = [['예술입니다', 'art', '예술'], ['환상적입니다', 'great', '환상적'], ['좋습니다', 'good', '좋음'], ['무난합니다', 'ok', '무난'], ['아쉽습니다', 'meh', '아쉬움'], ['실수입니다', 'miss', '실수']];
const review = {
  list: [],
  reset() { review.list = []; },
  // the seat that is this device's player (between friends at one device, the first)
  me() { const o = match.ctx && match.ctx.online; return o ? (o.team ? -1 : o.seat) : 0; },
  // (match.beforeShot: the shot about to be played, and the game as it is before it)
  shot(p) {
    const o = match.ctx && match.ctx.online;
    if (!p || o && o.watch || p.turn !== review.me() || game.players[p.turn].ai || p.isBreak && game.mode.table === 'pool') return;
    const w = aiWorker(); if (!w) return;
    const item = Object.assign({}, p, { n: match.count + 1, res: null, tag: '' }), id = ++aiw.n;
    review.list.push(item);
    aiw.wait.set(id, { t: performance.now(), res: null, cb: r => { item.res = r.review || { none: true }; if (item.res.grade != null) item.tag = REVIEW_GRADES[item.res.grade][0]; review.paint(); } });
    w.postMessage({ id, tbl: tableNow(), d: game.serialize(), review: { pos: null, angle: p.aim, V: p.V, a: p.a || 0, b: p.b || 0, el: p.el || 0 } });
  },
  done: () => review.list.filter(q => q.res && q.res.grade != null),
  // the slate's part (match.finish): the six grades counted, the averages, and the list
  paint() {
    const box = $('#rRev'); if (!box || st.screen !== 'result' && !review.finishing) return;
    const all = review.list, got = review.done(); box.textContent = '';
    box.hidden = !all.length; if (!all.length) return;
    const wait = all.filter(q => !q.res).length, avg = k => got.length ? Math.round(got.reduce((s, q) => s + q.res[k], 0) / got.length) : 0;
    const made = got.filter(q => q.res.made), artAvg = made.length ? Math.round(made.reduce((s, q) => s + q.res.art, 0) / made.length) : 0;
    box.append(
      el('div', { class: 'rv-h' }, [el('b', { text: '게임 리뷰' }), el('span', { text: wait ? `리뷰하는 중 ${got.length}/${all.length}` : `내 샷 ${got.length}개` })]),
      el('div', { class: 'rv-grades' }, REVIEW_GRADES.map(([, k, short], i) => {
        const n = got.filter(q => q.res.grade === i).length;
        return el('span', { class: `rv-g g-${k}` + (n ? '' : ' zero') }, [el('i', { text: n }), el('small', { text: short })]);
      })),
      el('div', { class: 'rv-avg' }, [el('span', { text: '예술 점수' }), el('b', { text: made.length ? artAvg : '-' }), el('span', { text: '실용성' }), el('b', { text: got.length ? avg('practical') : '-' })]),
      got.length ? el('button', { class: 'btn flat rv-open', text: '샷별 리뷰', onclick: onTap(review.sheet) }) : null);
  },
  sheet() {
    const rows = review.done().map(q => {
      const [t, k] = REVIEW_GRADES[q.res.grade];
      return el('button', { class: `rv-row g-${k}`, onclick: onTap(() => { closeSheet(); playShot(q, 'plain'); }) }, [
        el('span', { class: 'rv-n', text: `${q.n}번째` }), el('b', { class: 'rv-t', text: t }),
        el('span', { class: 'rv-s', text: q.res.made ? `예술 ${q.res.art} · 실용성 ${q.res.practical}` : q.res.foul ? '파울 · 실용성 0' : `득점 못 함 · 실용성 ${q.res.practical}` }),
        el('i', { class: 'rv-play', 'aria-hidden': 'true' })]);
    });
    openSheet('게임 리뷰', [note('강한 상대가 같은 배치에서 찾은 최선의 샷과 비교한 평가예요. 누르면 그 샷을 다시 봅니다.'), el('div', { class: 'rv-list' }, rows)]);
  },
};
