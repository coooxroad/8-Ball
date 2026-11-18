/* ================= the game review (owner 11-17 night: chess.com's game review, for billiards) =================
   Every shot of the game - both players', not a game watched - is judged off the screen's thread by its own Worker (so a
   bot's plan never waits behind it): ai/60-judge.js judgeShot, the reference hand, no allowance for anyone. What comes
   back is a grade of five - 예술 (light purple) · 좋음 · 무난 · 아쉬움 · 실수 -, a 요행 mark beside it when it went in by
   luck, and what a coach would say (50-review-words.js); the numbers behind it stay inside (owner: never shown).
     the result's slate - each player's count of each grade, their share of shots made (샷 성공률) and the game's rating
                     (경기력: the rating whose players lose as much per shot - REVIEW_PERF), then 게임 리뷰 over 한 판 더
                     and where each lost it (잃은 곳), then 게임 리뷰 over 한 판 더
     게임 리뷰       - the tray turns into a table, the slate into the shots straight away (owner 11-18: the counts are on
                     the slate already) - each one played again on the table when chosen, the coach's words over the list,
                     how it was struck (당점 · 세기 · 큐 각도), and the other good ways to play it, each to see played as a
                     ghost, the easiest and the best marked (owner 11-18: 원쿠션, 회전 이용 - 여러 개 골라서)
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
   did (bots of each rating played and judged: web/tools/judge-games.js, 11-18; the loss in chances to win, smoothed - the
   bots below 700 play much alike). [average loss, rating], loss falling. */
const REVIEW_PERF = {
  pool: [[0.22, 100], [0.2, 300], [0.16, 700], [0.11, 1100], [0.06, 1500], [0.04, 1900], [0.03, 2300], [0.02, 2600]],
  four: [[0.17, 100], [0.16, 300], [0.14, 700], [0.08, 1100], [0.04, 1500], [0.015, 1900], [0.005, 2300], [-0.01, 2600]],
  three: [[0.17, 100], [0.165, 300], [0.16, 700], [0.14, 1100], [0.1, 1500], [0.03, 1900], [0, 2300], [-0.04, 2600]],
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
  list: [], on: false, pick: -1, alt: -1,
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
    // (a phone's short slate: one strip - each grade's mark, mine over the other's - in place of the table)
    const [a, b] = [review.stats(0), review.stats(1)];
    const strip = el('div', { class: 'rv-strip' }, REVIEW_GRADES.map((G, i) => el('span', { class: `g-${G.id}` + (a.n[i] || b.n[i] ? '' : ' zero') }, [reviewIcon(G.id), el('b', { text: String(a.n[i]) }), el('small', { text: String(b.n[i]) })])));
    // (more below than the slate shows - the bars of 잃은 곳 on a short screen -: the box fades out at its foot until scrolled)
    const fade = () => box.classList.toggle('more', box.scrollHeight - box.scrollTop - box.clientHeight > 4);
    box.onscroll = fade; requestAnimationFrame(fade);
    box.append(...[el('div', { class: 'rv-h' }, [el('b', { text: '게임 리뷰' }), el('span', { text: wait ? `분석 중 ${got.length}/${all.length}` : `샷 ${got.length}개` })]), review.table(false), strip, review.lost()].filter(Boolean));
  },

  /* ---- 게임 리뷰: the tray a table, the slate the review ---- */
  open() {
    if (!review.list.length) return;
    review.on = true; review.pick = -1; review.alt = -1;
    $('#result').classList.add('rv'); $('#rvBoard').hidden = false; $('#rvPanel').hidden = false;
    // (the game's table as the game ended is kept, to be put back when the review closes)
    review.keep = highlights.snapshot(game.world); st.phase = 'rvplay';
    review.select(review.firstPick()); layout();
  },
  close(quiet) {
    if (!review.on && quiet) return;
    review.on = false; review.stop();
    if (review.keep) { highlights.restore(game.world, review.keep); review.keep = null; scene.clearFalls(); }
    if (st.phase === 'rvplay') st.phase = 'idle';
    if (st.screen === 'result') layout();
    const r = $('#result'); if (r) r.classList.remove('rv');
    if ($('#rvBoard')) $('#rvBoard').hidden = true; if ($('#rvPanel')) $('#rvPanel').hidden = true;
  },
  panel() {
    const box = $('#rvPanel'); if (!box) return;
    const keepY = box.dataset.pick === String(review.pick) ? box.scrollTop : null; box.dataset.pick = review.pick; box.textContent = '';
    const head = el('div', { class: 'rv-top' }, [el('button', { class: 'rv-back', 'aria-label': '돌아가기', onclick: onTap(() => review.close()) }), el('b', { text: '게임 리뷰' })]);
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
    // (the chosen shot brought into view in the list; a phone's panel scrolls as one, so it goes back to the coach instead)
    // (the same shot drawn again - an other way picked, the analysis come in - stays where it was scrolled)
    if (keepY != null) box.scrollTop = keepY;
    else if (app.classList.contains('compact')) box.scrollTop = 0;
    else { const on = box.querySelector('.rv-shot.on'); if (on) on.scrollIntoView({ block: 'nearest' }); }
  },
  /* where each player lost (as golf's Strokes Gained is split): the way chosen, the striking, the next shot, fouls - two
     bars a row, the longest the longest of all, no numbers (owner 11-17: the scores stay inside) */
  lost() {
    const K = [['choice', '길 선택'], ['strike', '조준 · 세기'], ['next', '다음 자리'], ['foul', '파울']];
    const sum = turn => { const t = { choice: 0, strike: 0, next: 0, foul: 0 }; for (const q of review.judged()) if (q.turn === turn && q.res.parts) for (const k in t) t[k] += q.res.parts[k] || 0; return t; };
    const [a, b] = [sum(0), sum(1)], top = Math.max(0.001, ...K.map(([k]) => Math.max(a[k], b[k])));
    if (top <= 0.001) return null;
    const bar = (v, side) => el('i', { class: 'rv-bar ' + side }, [el('b', { style: `width:${Math.round(100 * v / top)}%` })]);
    // (a kind where neither lost anything left out: the slate is short)
    return el('div', { class: 'rv-lost' }, [el('div', { class: 'rv-lh', text: '잃은 곳' }), ...K.filter(([k]) => a[k] > 0.001 || b[k] > 0.001).map(([k, name]) => el('div', { class: 'rv-lr' }, [bar(a[k], 'l'), el('span', { text: name }), bar(b[k], 'r')]))]);
  },
  firstPick() { const i = review.list.findIndex(q => q.turn === review.seat()); return i < 0 ? 0 : i; },
  /* the coach's card for one shot: its mark and word, what it did and why, how it was struck - then the ways to see it:
     the shot played (내 샷) and the other good ways (judge's alts), each a chip naming how it is played, the easiest and
     the judge's best marked; a chip chosen plays that way on the table, its own story and stroke shown */
  coach(q) {
    const r = q.res, G = r && r.grade != null ? REVIEW_GRADES[r.grade] : null;
    if (!G) return el('div', { class: 'rv-coach' }, [el('p', { class: 'rv-why', text: r ? '이 샷은 평가하지 못했어요.' : '분석하는 중이에요…' })]);
    const w = reviewWords(q), alts = r.alts || [], A = alts[review.alt] || null;
    const pick = i => onTap(() => { review.alt = i; review.board(q); review.panel(); });
    const chips = alts.length ? el('div', { class: 'rv-alts' }, [
      el('button', { class: 'rv-chip mine' + (A ? '' : ' on'), onclick: pick(-1) }, [el('b', { text: '내 샷' })]),
      ...alts.map((a, i) => el('button', { class: 'rv-chip' + (i === review.alt ? ' on' : ''), onclick: pick(i) }, [el('b', { text: rvAltName(a, true) }),
        a.easiest || a.best ? el('span', { class: 'rv-tags' }, [a.best ? el('em', { class: 'best', text: '추천' }) : null, a.easiest ? el('em', { class: 'easy', text: '가장 쉬움' }) : null]) : null]))]) : null;
    return el('div', { class: `rv-coach g-${G.id}` + (A ? ' alt' : '') }, [
      el('div', { class: 'rv-say' }, [reviewIcon(G.id), el('b', { text: w.title }), r.fluke ? el('span', { class: 'rv-fluke' }, [reviewIcon('fluke'), document.createTextNode('요행')]) : null]),
      // (의도 · 결과 · 원인 · 한마디 · 추천, each a labelled line - a commentator's call, not one paragraph)
      el('div', { class: 'rv-lines' }, w.lines.map(l => el('p', { class: 'rv-line' + (l.k === '추천' ? ' rec' : '') }, [el('b', { text: l.k }), el('span', { text: l.t })]))),
      chips,
      A ? (() => { const st = rvAltStory(A); return el('div', { class: 'rv-why alt' }, [el('p', { text: st.how }), st.why.length ? el('ul', { class: 'rv-whys' }, st.why.map(t => el('li', { text: t }))) : null]); })() : null,
      review.stroke(A ? A.d : r.d),
      el('button', { class: 'rv-act', text: '다시 보기', onclick: onTap(() => { review.board(q); }) })]);
  },
  /* how a stroke was struck (owner 11-18: 큐 각도, 당점): the cue ball with the tip's mark on it, the pace as a bar, the cue
     raised in degrees, and how the first ball was met */
  stroke(d) {
    if (!d) return null;
    const x = 50 + Math.max(-1, Math.min(1, d.a / 0.5)) * 34, y = 50 - Math.max(-1, Math.min(1, d.b / 0.5)) * 34;
    const tip = el('i', { class: 'rv-tip', 'aria-hidden': 'true' }); tip.innerHTML = `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="46" fill="#f4f1ea" stroke="rgba(0,0,0,.35)" stroke-width="3"/><path d="M50 12v76M12 50h76" stroke="rgba(0,0,0,.14)" stroke-width="2"/><circle cx="${x}" cy="${y}" r="10" fill="#e5584f" stroke="#fff" stroke-width="3"/></svg>`;
    const met = rvMet(d);
    return el('div', { class: 'rv-stroke' }, [
      el('div', { class: 'rv-si' }, [tip, el('span', { text: '당점' }), el('b', { text: rvStroke(d) })]),
      el('div', { class: 'rv-si' }, [el('i', { class: 'rv-pace' }, [el('b', { style: `width:${Math.round(100 * Math.max(0.04, d.pace || 0))}%` })]), el('span', { text: '세기' }), el('b', { text: `${Math.round(100 * (d.pace || 0))}%` })]),
      el('div', { class: 'rv-si' }, [el('i', { class: 'rv-cue', style: `--el:${-Math.min(60, d.el || 0)}deg` }), el('span', { text: '큐 각도' }), el('b', { text: `${d.el || 0}°` })]),
      met ? el('div', { class: 'rv-si' }, [el('i', { class: 'rv-thick', style: `--t:${d.thick == null ? 0 : d.thick}` }), el('span', { text: game.mode.table === 'carom' ? '두께' : '깎기' }), el('b', { text: rvMetShort(d) })]) : null]);
  },
  select(i) {
    if (i < 0 || i >= review.list.length) return;
    review.pick = i; review.alt = -1; review.panel(); review.board(review.list[i]);
  },

  /* ---- the table on the tray: the game's own table (owner 11-18: '인게임 당구대로') ----
     The live 3D table, the one the game is played on, is under the result screen all along. While the review is open it
     is framed alone in the screen from straight above (layout: review.insets), its balls put where the chosen shot found
     them and run along the shot's tape (highlights.record; st.phase 'rvplay', review.tick from the frame loop), and every
     frame it draws is copied into the tray's canvas (review.copy, right after the scene has drawn - a WebGL canvas can be
     read only before the frame is shown). Over it, on the tray's canvas, the lines the balls have run so far - the better
     shot's in the review's purple, dashed. Sound as in play. */
  tp: null, T: 0, playing: false, run: null, keep: null,
  insets(W, H) { const m = Math.round(Math.min(W, H) * 0.02); return { t: m, l: m, r: m, b: m, lie: H > W }; },
  stop() { review.playing = false; review.tp = null; review.run = null; SND.rolling(0); },
  board(q) {
    review.stop(); scene.clearFalls();
    const base = q || review.list[0]; if (!base) return;
    let shot;
    const alt = q && q.res && q.res.alts && q.res.alts[review.alt];
    if (alt) {
      const b = alt.shot, snap = JSON.parse(JSON.stringify(q.snap));
      if (b.pos) { snap.balls[snap.cue][0] = b.pos[0]; snap.balls[snap.cue][1] = b.pos[1]; }
      shot = { snap, aim: b.angle, V: b.V, a: b.a || 0, b: b.b || 0, el: b.el || 0, key: -1 };
    } else shot = Object.assign({}, base, { key: -1 });
    highlights.restore(game.world, shot.snap); game.world.snd.length = 0;
    // (no shot chosen yet: the table as the first shot found it, standing still)
    if (!q) { scene.invalidate(); return; }
    try { review.tp = highlights.record(game.P, shot.snap.balls.length, shot); } catch (e) { review.tp = null; }
    if (!review.tp) return;
    review.run = shot; review.ghostOn = !!alt; review.T = -0.45; review.playing = true;
    const ids = [shot.snap.cue, ...shot.snap.balls.map((_, i) => i).filter(i => i !== shot.snap.cue)];
    review.paths = ids.map(id => [id, highlights.path(review.tp, id)]).filter(x => x[1]).slice(0, 4);
    scene.invalidate();
  },
  // (the frame loop, phase 'rvplay') the tape run on at its own speed, its knocks and drops sounded as they come
  tick(dt) {
    if (!review.playing || !review.tp) return false;
    const tp = review.tp, from = review.T; review.T += dt; if (review.T < 0) return true;
    const T = Math.min(tp.dur, review.T);
    for (const e of tp.events) if (e.time > from && e.time <= T) {
      const pan = panOf(e.x, e.y);
      if (e.t === 'pocket') { scene.fall(game.P, e); SND.drop('lip', Math.hypot(e.vx, e.vy), pan); }
      else if (e.t === 'ball') SND.ball(e.v, pan);
      else if (e.t === 'off') scene.fly(game.P, e);
      else if (e.t === 'land') SND.ball(Math.min(1.2, e.v * 0.4), pan);
      else SND.rail(e.v, pan);
    }
    const v = highlights.seek(game.world, tp, T); SND.rolling(Math.min(8, v));
    if (review.T >= tp.dur) { review.playing = false; SND.rolling(0); }
    return true;
  },
  // (the frame loop, after the scene drew) the table's part of the live canvas onto the tray, and the lines over it
  copy() {
    const cv = $('#rvBoard canvas'), box = $('#rvBoard'), gl = $('#gl'); if (!cv || !box || !gl || !review.on) return;
    const W = app.clientWidth, H = app.clientHeight, rc = scene.tableRect(review.insets(W, H)); if (!rc.w || !rc.h) return;
    const bw = box.clientWidth - 12, bh = box.clientHeight - 12; if (bw < 50 || bh < 50) return;
    const sc = Math.min(bw / rc.w, bh / rc.h), cw = Math.round(rc.w * sc), ch = Math.round(rc.h * sc);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); cv.style.width = cw + 'px'; cv.style.height = ch + 'px'; }
    const g = cv.getContext('2d'), kx = gl.width / W, ky = gl.height / H;
    g.clearRect(0, 0, cv.width, cv.height);
    // (cut to the rails' rounded corners, so the room behind them stays out - its radius from the scene once per size)
    const key = W + 'x' + H; if (review.rrKey !== key) { review.rrKey = key; review.rr = scene.tableOutline(review.insets(W, H)).r; }
    const r = review.rr / rc.w * cv.width, w = cv.width, h = cv.height;
    g.save(); g.beginPath(); g.moveTo(r, 0); g.arcTo(w, 0, w, h, r); g.arcTo(w, h, 0, h, r); g.arcTo(0, h, 0, 0, r); g.arcTo(0, 0, w, 0, r); g.closePath(); g.clip();
    g.drawImage(gl, rc.x * kx, rc.y * ky, rc.w * kx, rc.h * ky, 0, 0, cv.width, cv.height);
    g.restore();
    // the lines run so far, from where the balls were struck to where they are now
    if (!review.tp || !review.paths) return;
    const t = Math.max(0, Math.min(review.tp.dur, review.T)), o = [0, 0], a = [0, 0], X = () => (o[0] - rc.x) / rc.w * cv.width, Y = () => (o[1] - rc.y) / rc.h * cv.height;
    scene.proj.begin(); g.lineJoin = g.lineCap = 'round';
    const ghost = review.ghostOn, z = game.P.R;
    for (const [id, pts] of review.paths) {
      g.beginPath(); let started = false;
      for (let i = 0; i < pts.length; i += 3) { if (pts[i + 2] > t) break; scene.proj.at(pts[i], pts[i + 1], z, o); if (started) g.lineTo(X(), Y()); else { g.moveTo(X(), Y()); started = true; } }
      if (started && highlights.at(review.tp, id, t, a)) { scene.proj.at(a[0], a[1], z, o); g.lineTo(X(), Y()); }
      if (!started) continue;
      g.setLineDash(ghost ? [6 * dpr, 6 * dpr] : []);
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 4 * dpr; g.stroke();
      g.strokeStyle = ghost ? '#c9b2ff' : id === review.run.snap.cue ? 'rgba(255,255,255,.85)' : shotColour(id, review.run.snap.cue); g.lineWidth = 2 * dpr; g.stroke();
    }
    g.setLineDash([]);
  },
};
