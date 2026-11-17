/* ================= the game review (owner 11-17 night: chess.com's game review, for billiards) =================
   Every shot of the game - both players', not a game watched - is judged off the screen's thread by its own Worker (so a
   bot's plan never waits behind it): ai/60-judge.js judgeShot, the reference hand, no allowance for anyone. What comes
   back is a grade of five - 예술 (light purple) · 좋음 · 무난 · 아쉬움 · 실수 -, a 요행 mark beside it when it went in by
   luck, and what a coach would say (50-review-words.js); the numbers behind it stay inside (owner: never shown).
     the result's slate - each player's count of each grade, their share of shots made (샷 성공률) and the game's rating
                     (경기력: the rating whose players lose as much per shot - REVIEW_PERF), then 게임 리뷰 over 한 판 더
     게임 리뷰       - the tray turns into a table, the slate into the review: the counts again with 리뷰 시작, then the
                     shots - each one played again on the table when chosen, the coach's words over the list, and the
                     better shot played as a ghost (더 좋은 샷 보기) when there was one
   Split so that a later 당구 에듀케이션 membership can hold the review itself (open) and leave the counts (paint) to all. */
const REVIEW_GRADES = [
  { id: 'art', name: '예술', say: '아름답습니다' },
  { id: 'good', name: '좋음', say: '좋습니다' },
  { id: 'ok', name: '무난', say: '무난합니다' },
  { id: 'meh', name: '아쉬움', say: '아쉽습니다' },
  { id: 'miss', name: '실수', say: '실수입니다' },
];
/* The marks, drawn for billiards (owner: not chess.com's): a ring of the grade's colour with a white sign in it -
   예술 a cue ball's curve ending in a spark, 좋음 a ball over the pocket, 무난 a plain straight line, 아쉬움 a line passing
   by the pocket, 실수 a line broken; 요행 a four-leaf clover. */
const REVIEW_ICON = {
  art: '<path d="M5.5 18.5C7 12 10.5 8.6 16.6 7.4" fill="none"/><circle cx="5.5" cy="18.5" r="2.1" stroke="none" fill="#fff"/><path d="M17.6 3.2l1 2.4 2.4 1-2.4 1-1 2.4-1-2.4-2.4-1 2.4-1z" stroke="none" fill="#fff"/>',
  good: '<path d="M5.5 13.5a6.5 6.5 0 0 0 13 0" fill="none"/><circle cx="12" cy="8.6" r="3" stroke="none" fill="#fff"/>',
  ok: '<path d="M4.5 12h10.5" fill="none"/><circle cx="18" cy="12" r="2.6" stroke="none" fill="#fff"/>',
  meh: '<circle cx="16.8" cy="7.2" r="3.1" fill="none"/><path d="M4.6 19.4l7.6-6.2" fill="none"/><circle cx="13.6" cy="12.1" r="2.1" stroke="none" fill="#fff"/>',
  miss: '<path d="M4 19l5.6-5.6M12.6 11.4L20 4" fill="none"/><path d="M9.6 9.2l1.4 1.4M13.4 15.2l1.6.6" fill="none" stroke-width="1.8"/>',
  fluke: '<g stroke="none" fill="#fff"><circle cx="9.3" cy="9.3" r="3.2"/><circle cx="14.7" cy="9.3" r="3.2"/><circle cx="9.3" cy="14.7" r="3.2"/><circle cx="14.7" cy="14.7" r="3.2"/></g><path d="M14 14.4c1.6 2.1 2.6 3.8 3 6" fill="none" stroke="#fff" stroke-width="1.6"/>',
};
const reviewIcon = (id, cls = '') => { const i = el('i', { class: `rv-ico i-${id} ${cls}`, 'aria-hidden': 'true' }); i.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${REVIEW_ICON[id]}</svg>`; return i; };
/* 경기력: a game's rating from its shots - the rating whose bots lose as much per shot, against the judge, as this player
   did (bots of each rating played and judged: web/tools/judge-games.js, 11-18). [average loss, rating], loss falling. */
const REVIEW_PERF = {
  pool: [[1.45, 100], [1.3, 300], [1.05, 700], [0.8, 1100], [0.55, 1500], [0.35, 1900], [0.15, 2300], [0, 2600]],
  four: [[1.45, 100], [1.3, 300], [1.2, 700], [0.95, 1100], [0.5, 1500], [0.25, 1900], [0.12, 2300], [0, 2600]],
  three: [[1.2, 100], [0.95, 300], [0.75, 700], [0.55, 1100], [0.4, 1500], [0.25, 1900], [0.1, 2300], [-0.05, 2600]],
}
function reviewPerf(mode, losses) {
  if (losses.length < 3) return null;
  const t = REVIEW_PERF[mode === 'four' || mode === 'three' ? mode : 'pool'], x = losses.reduce((s, v) => s + v, 0) / losses.length;
  if (x >= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) if (x >= t[i][0]) { const [x0, r0] = t[i - 1], [x1, r1] = t[i]; return Math.round((r0 + (r1 - r0) * (x0 - x) / (x0 - x1)) / 10) * 10; }
  return t[t.length - 1][1];
}
// the review's own Worker (as aiWorker: the same core, a second one - a judging takes up to a second or two)
const rvw = { w: null, n: 0, wait: new Map(), dead: false };
function reviewWorker() {
  if (rvw.w || rvw.dead) return rvw.w;
  try {
    const core = document.getElementById('core'), src = core && core.textContent;
    const url = src && src.length > 1000 ? URL.createObjectURL(new Blob([src], { type: 'text/javascript' })) : core && core.src ? core.src : null;
    if (!url) { rvw.dead = true; return null; }
    const w = new Worker(url);
    w.onmessage = e => { const r = e.data, cb = rvw.wait.get(r.id); rvw.wait.delete(r.id); if (cb) cb(r); };
    w.onerror = () => { rvw.dead = true; rvw.w = null; for (const cb of rvw.wait.values()) cb({ err: 'worker' }); rvw.wait.clear(); };
    rvw.w = w;
  } catch (e) { rvw.dead = true; }
  return rvw.w;
}
const review = {
  list: [], on: false, stage: 'stats', pick: -1, ghost: false,
  reset() { review.list = []; review.close(true); },
  // (match.beforeShot: the shot about to be played, and the game as it is before it) - every shot but a pool break
  shot(p) {
    const o = match.ctx && match.ctx.online;
    if (!p || o && o.watch || p.isBreak && game.P.POCKETED) return;
    const w = reviewWorker(); if (!w) return;
    const item = Object.assign({}, p, { n: match.count + 1, res: null, t: Date.now(), mode: game.modeId });
    review.list.push(item);
    const id = ++rvw.n;
    rvw.wait.set(id, r => { item.res = r && r.review || { none: true }; review.heard(item); });
    w.postMessage({ id, tbl: tableNow(), d: game.serialize(), review: { pos: null, angle: p.aim, V: p.V, a: p.a || 0, b: p.b || 0, el: p.el || 0 } });
  },
  // a verdict in: the bot answers the player's shot by its grade (while the moment is still fresh), the slate catches up
  heard(item) {
    const r = item.res;
    if (r && r.grade != null && flow === match && !game.over && item.turn === 0 && Date.now() - item.t < 9000) botTalk.graded(r);
    if (st.screen === 'result') { review.paint(); if (review.on) review.panel(); }
  },
  judged: () => review.list.filter(q => q.res && q.res.grade != null),
  // each player's numbers: the grades counted, shots made of those judged, the game's rating
  stats(turn) {
    const L = review.judged().filter(q => q.turn === turn), n = REVIEW_GRADES.map((_, i) => L.filter(q => q.res.grade === i).length);
    return { n, all: L.length, made: L.length ? Math.round(100 * L.filter(q => q.res.made).length / L.length) : null, perf: reviewPerf(game.modeId, L.map(q => q.res.loss)), fluke: L.filter(q => q.res.fluke).length };
  },
  // (against a bot or online: this device's seat is 나)
  seat() { const o = match.ctx && match.ctx.online; return o ? (o.team ? o.seat % 2 : o.seat) : 0; },
  names() { const c = match.ctx || {}, solo = c.ai || c.online, me = review.seat(); return [0, 1].map(i => solo && i === me ? '나' : game.players[i].name); },
  // the counts side by side: a grade a row - the mark between the two numbers (as chess.com's), then 샷 성공률 and 경기력
  table(big) {
    const [a, b] = [review.stats(0), review.stats(1)], [na, nb] = review.names();
    const row = (label, x, y, ico, cls = '') => el('div', { class: 'rv-tr ' + cls }, [el('span', { class: 'rv-k', text: label }), el('b', { class: 'rv-a', text: x }), ico || el('i', { class: 'rv-ico none' }), el('b', { class: 'rv-b', text: y })]);
    return el('div', { class: 'rv-table' + (big ? ' big' : '') }, [
      el('div', { class: 'rv-tr hd' }, [el('span'), el('b', { class: 'rv-a', text: na }), el('i', { class: 'rv-ico none' }), el('b', { class: 'rv-b', text: nb })]),
      ...REVIEW_GRADES.map((G, i) => row(G.name, String(a.n[i]), String(b.n[i]), reviewIcon(G.id), `g-${G.id}` + (a.n[i] || b.n[i] ? '' : ' zero'))),
      a.fluke || b.fluke ? row('요행', String(a.fluke), String(b.fluke), reviewIcon('fluke'), 'g-fluke') : null,
      row('샷 성공률', a.made == null ? '-' : a.made + '%', b.made == null ? '-' : b.made + '%', null, 'sum'),
      row('경기력', a.perf == null ? '-' : String(a.perf), b.perf == null ? '-' : String(b.perf), null, 'sum perf')]);
  },
  // the result's slate (match.finish, and as verdicts come in)
  paint() {
    const box = $('#rRev'); if (!box || st.screen !== 'result' && !review.finishing) return;
    const all = review.list, got = review.judged(); box.textContent = '';
    box.hidden = !all.length; $('#reviewBtn').hidden = !all.length; if (!all.length) return;
    const wait = all.filter(q => !q.res).length;
    box.append(el('div', { class: 'rv-h' }, [el('b', { text: '게임 리뷰' }), el('span', { text: wait ? `분석 중 ${got.length}/${all.length}` : `샷 ${got.length}개` })]), review.table(false));
  },

  /* ---- 게임 리뷰: the tray a table, the slate the review ---- */
  open() {
    if (!review.list.length) return;
    review.on = true; review.stage = 'stats'; review.pick = -1; review.ghost = false;
    $('#result').classList.add('rv'); $('#rvBoard').hidden = false; $('#rvPanel').hidden = false;
    review.panel(); requestAnimationFrame(() => review.board(null));
  },
  close(quiet) {
    if (!review.on && quiet) return;
    review.on = false; review.stop();
    const r = $('#result'); if (r) r.classList.remove('rv');
    if ($('#rvBoard')) $('#rvBoard').hidden = true; if ($('#rvPanel')) $('#rvPanel').hidden = true;
  },
  panel() {
    const box = $('#rvPanel'); if (!box) return; box.textContent = '';
    const head = el('div', { class: 'rv-top' }, [el('button', { class: 'rv-back', 'aria-label': '돌아가기', onclick: onTap(() => review.close()) }), el('b', { text: '게임 리뷰' })]);
    if (review.stage === 'stats') {
      const wait = review.list.filter(q => !q.res).length;
      box.append(...[head, review.table(true), wait ? el('p', { class: 'rv-wait', text: `샷을 분석하는 중이에요 · ${review.list.length - wait}/${review.list.length}` }) : null,
        el('button', { class: 'btn rv-start', text: '리뷰 시작', onclick: onTap(() => { review.stage = 'shots'; review.select(review.firstPick()); }) })].filter(Boolean));
      return;
    }
    const L = review.list, q = L[review.pick];
    box.append(head, q ? review.coach(q) : el('div', { class: 'rv-coach' }),
      el('div', { class: 'rv-nav' }, [
        el('button', { class: 'rv-step prev', 'aria-label': '이전 샷', disabled: review.pick <= 0 ? '' : null, onclick: onTap(() => review.select(review.pick - 1)) }),
        el('span', { text: q ? `${review.pick + 1} / ${L.length}` : '' }),
        el('button', { class: 'rv-step next', 'aria-label': '다음 샷', disabled: review.pick >= L.length - 1 ? '' : null, onclick: onTap(() => review.select(review.pick + 1)) })]),
      el('div', { class: 'rv-shots' }, L.map((s, i) => {
        const r = s.res, G = r && r.grade != null ? REVIEW_GRADES[r.grade] : null;
        return el('button', { class: 'rv-shot' + (i === review.pick ? ' on' : '') + (s.turn ? ' two' : ''), onclick: onTap(() => review.select(i)) }, [
          el('span', { class: 'rv-n', text: String(i + 1) }), el('span', { class: 'rv-who', text: review.names()[s.turn] }),
          G ? reviewIcon(G.id) : el('i', { class: 'rv-ico wait' }), el('b', { text: G ? G.name : r ? '-' : '분석 중' }), r && r.fluke ? reviewIcon('fluke', 'tag') : null]);
      })));
    const on = box.querySelector('.rv-shot.on'); if (on) on.scrollIntoView({ block: 'nearest' });
  },
  firstPick() { const i = review.list.findIndex(q => q.turn === review.seat()); return i < 0 ? 0 : i; },
  // the coach's card for one shot: its mark, its word, why - and the better shot to see, when there was one
  coach(q) {
    const r = q.res, G = r && r.grade != null ? REVIEW_GRADES[r.grade] : null;
    if (!G) return el('div', { class: 'rv-coach' }, [el('p', { class: 'rv-why', text: r ? '이 샷은 평가하지 못했어요.' : '분석하는 중이에요…' })]);
    const w = reviewWords(q);
    return el('div', { class: `rv-coach g-${G.id}` }, [
      el('div', { class: 'rv-say' }, [reviewIcon(G.id), el('b', { text: w.title }), r.fluke ? el('span', { class: 'rv-fluke' }, [reviewIcon('fluke'), document.createTextNode('요행')]) : null]),
      el('p', { class: 'rv-why', text: w.text }),
      el('div', { class: 'rv-acts' }, [
        el('button', { class: 'rv-act' + (review.ghost ? '' : ' on'), text: '다시 보기', onclick: onTap(() => { review.ghost = false; review.board(q); review.panel(); }) }),
        r.better ? el('button', { class: 'rv-act better' + (review.ghost ? ' on' : ''), text: '더 좋은 샷 보기', onclick: onTap(() => { review.ghost = true; review.board(q); review.panel(); }) }) : null])]);
  },
  select(i) {
    if (i < 0 || i >= review.list.length) return;
    review.pick = i; review.ghost = false; review.panel(); review.board(review.list[i]);
  },

  /* ---- the table on the tray: the shot played again from where the balls stood (its tape: highlights.record), the cue
     ball's and the struck ball's lines drawn as they go; the better shot the same way, in the review's purple ---- */
  raf: 0,
  stop() { if (review.raf) cancelAnimationFrame(review.raf); review.raf = 0; },
  board(q) {
    review.stop();
    const cv = $('#rvBoard canvas'), box = $('#rvBoard'); if (!cv || !box) return;
    // (the little table's frame is the highlights' - ui/mini-table.webp round the canvas, 50-result.css -; the canvas is the
    // cloth, sized to the table's own proportions in the room the tray gives it)
    const P = game.P, fr = 26, bw = box.clientWidth - 12, bh = box.clientHeight - 12; if (bw < 50 || bh < 50) return;
    const sc = Math.min((bw - 2 * fr) / (2 * P.HL), (bh - 2 * fr) / (2 * P.HW));
    cv.style.width = Math.round(2 * P.HL * sc + 2 * fr) + 'px'; cv.style.height = Math.round(2 * P.HW * sc + 2 * fr) + 'px';
    const dpr = Math.min(2, window.devicePixelRatio || 1), cw = Math.round(2 * P.HL * sc), ch = Math.round(2 * P.HW * sc);
    cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
    const g = cv.getContext('2d'), k = cv.width / (2 * P.HL);
    const X = x => cv.width / 2 + x * k, Y = y => cv.height / 2 - y * k;
    // (no shot chosen yet: the table as the first shot found it, standing still)
    const base = q || review.list[0];
    if (!base) return;
    let shot = base;
    if (q && review.ghost && q.res && q.res.better) {
      const b = q.res.better.shot, snap = JSON.parse(JSON.stringify(q.snap));
      if (b.pos) { snap.balls[snap.cue][0] = b.pos[0]; snap.balls[snap.cue][1] = b.pos[1]; }
      shot = { snap, aim: b.angle, V: b.V, a: b.a || 0, b: b.b || 0, el: b.el || 0, key: -1 };
    } else shot = Object.assign({}, base, { key: -1 });
    let tape = null; try { tape = highlights.record(P, shot.snap.balls.length, shot); } catch (e) { tape = null; }
    const colOf = i => shotColour(i, shot.snap.cue), ghost = !!(q && review.ghost && q.res && q.res.better);
    // (the lines: the cue ball's first, then up to three of the balls it set moving)
    const ids = [shot.snap.cue, ...shot.snap.balls.map((_, i) => i).filter(i => i !== shot.snap.cue)];
    const paths = tape && q ? ids.map(id => [id, highlights.path(tape, id)]).filter(x => x[1]).slice(0, 4) : [];
    const a = [0, 0], dur = tape ? tape.dur : 0, t0 = performance.now() + 350;
    const frame = now => {
      const t = !q ? 0 : Math.max(0, Math.min(dur, (now - t0) / 1000));
      // the cloth and its pockets (the wood is the frame round the canvas)
      g.fillStyle = hex(CLOTHS[prefs.cloth].felt); g.fillRect(0, 0, cv.width, cv.height);
      g.fillStyle = '#0b0b0d'; for (const p of P.POCKETS) { g.beginPath(); g.arc(X(p.x), Y(p.y), p.r * k * 0.8, 0, 6.3); g.fill(); }
      // the lines so far
      for (const [id, pts] of paths) {
        g.beginPath(); let started = false;
        for (let i = 0; i < pts.length; i += 3) { if (pts[i + 2] > t) break; if (started) g.lineTo(X(pts[i]), Y(pts[i + 1])); else { g.moveTo(X(pts[i]), Y(pts[i + 1])); started = true; } }
        if (tape && q && highlights.at(tape, id, t, a) && started) g.lineTo(X(a[0]), Y(a[1]));
        g.lineJoin = g.lineCap = 'round';
        if (ghost) g.setLineDash([6 * dpr, 6 * dpr]); else g.setLineDash([]);
        g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 4 * dpr; g.stroke();
        g.strokeStyle = ghost ? '#c9b2ff' : id === shot.snap.cue ? 'rgba(255,255,255,.9)' : colOf(id); g.lineWidth = 2.2 * dpr; g.stroke();
      }
      g.setLineDash([]);
      // the balls where they are now
      shot.snap.balls.forEach((b, i) => {
        let x = b[0], y = b[1], on = !!b[2];
        if (tape && q) { on = highlights.at(tape, i, t, a); x = a[0]; y = a[1]; }
        if (!on) return;
        const r = Math.max(3 * dpr, P.R * k);
        g.beginPath(); g.arc(X(x) - r * 0.25, Y(y) + r * 0.35, r, 0, 6.3); g.fillStyle = 'rgba(0,0,0,.35)'; g.fill();
        g.beginPath(); g.arc(X(x), Y(y), r, 0, 6.3); g.fillStyle = colOf(i); g.fill();
        g.beginPath(); g.arc(X(x) + r * 0.3, Y(y) - r * 0.35, r * 0.35, 0, 6.3); g.fillStyle = 'rgba(255,255,255,.45)'; g.fill();
      });
      if (q && t < dur) review.raf = requestAnimationFrame(frame); else review.raf = 0;
    };
    review.raf = requestAnimationFrame(frame);
  },
};
