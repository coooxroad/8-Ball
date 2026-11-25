/* The admin console's 퍼즐 tab (owner 11-24 밤: 어드민 콘솔로 퍼즐 레이팅 조정 - web/admin.html; the server's side is the
   puzzles' book, server/src/puzzlebook-core.js admin, reached as /v1/admin/puzzles { op }).
   Every puzzle in a list - filtered by game, kind, element, rating and state, sorted by rating, tries, success, stars, fun
   or how far the players moved it from the puzzle AI's guess - each with its position drawn small. One opened: drawn large
   with its answer's path, played on the game's own code (the site's core: physics.js, game.js, puzzles.js - loaded from
   the page, as the app runs it), its numbers, and the hand on it: a rating set (held, or let the players move it on),
   back to the AI's, off, a note, its tries and changes. Then a group moved at once, the knobs the app follows, the log.
   Uses admin.js's api, toast, esc, num, when. */
let pzRows = null, pzSel = null, pzEngine = null, pzEngineBusy = null, pzMinTries = 5, pzAnim = 0;
const PZ_GOAL_KO = { score: '득점', gather: '모으기', bank: '빈쿠션', three: '3쿠션', direct: '쿠션 없이', pot: '넣기' };
const PZ_EL_KO = { table: '테이블', walls: '바리케이드', need: '쿠션 지정', turns: '2턴', keep: '금지 공' };
const PZ_POOL_HUE = ['#f4f1ea', '#f2c21b', '#1d4fb8', '#d62b2b', '#6a2c91', '#f07a1c', '#1f8a3a', '#7a1f1f', '#111111', '#f2c21b', '#1d4fb8', '#d62b2b', '#6a2c91', '#f07a1c', '#1f8a3a', '#7a1f1f'];
const PZ_CAROM_HUE = ['#f4f1ea', '#f2c21b', '#d62b2b', '#d62b2b'];
const pzPct = (a, b) => b ? Math.round(a / b * 100) + '%' : '-';
const pzStarsOf = v => v == null ? '-' : v.toFixed(2);

function pzOpen() { if (!pzRows) pzLoad(); pzEngineLoad(); }
async function pzLoad() {
  const r = await api('puzzles', { op: 'list' }); if (!r.ok) return toast(r.why || '퍼즐을 불러오지 못했습니다', 'bad');
  pzRows = r.rows; pzMinTries = r.min || 5; pzCfgShow(r.cfg); pzPaint(); pzLogLoad();
  if (pzSel) pzShow(pzSel);
}
$('#pzLoad').onclick = pzLoad;
for (const id of ['pzGame', 'pzKind', 'pzEl', 'pzState', 'pzSort']) $('#' + id).onchange = () => pzPaint();
for (const id of ['pzLo', 'pzHi']) $('#' + id).oninput = () => pzPaint();

/* The game's own code, to draw and play the puzzles as the app does: on the site the page carries it as a file of its own
   (site/split.cjs - h/core.<hash>.js, named in the page); a page not split (a local build) has it written in - taken from
   there as a file of its own (no CSP on a local build). Its top-level names (createPhysics, createGame, createPuzzles,
   physicsFor, createAI) are then seen here. */
function pzEngineLoad() {
  if (pzEngine || pzEngineBusy) return pzEngineBusy;
  const add = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  pzEngineBusy = (async () => {
    if (typeof createPuzzles !== 'function') {
      const html = await fetch('index.html', { cache: 'no-cache' }).then(r => r.text());
      const tag = '<' + 'script id="core"', at = html.indexOf(tag); if (at < 0) throw new Error('no core');
      const src = /^\s*src="([^"]+)"/.exec(html.slice(at + tag.length));
      if (src) await add(src[1]);
      else { const body = html.slice(html.indexOf('>', at) + 1, html.indexOf('</' + 'script>', at)); await add(URL.createObjectURL(new Blob([body], { type: 'text/javascript' }))); }
    }
    const PH = physicsFor(createPhysics, 'bar');
    pzEngine = { g: createGame(PH, typeof createAI === 'function' ? createAI : null), Z: createPuzzles() };
    pzThumbs(); if (pzSel) pzShow(pzSel);
  })().catch(() => { pzEngineBusy = null; toast('게임 코드를 불러오지 못했습니다 (그림·재생 없이)', 'bad'); });
  return pzEngineBusy;
}
// a puzzle set out on the game, as the app sets it (puzzles.js setup) - its table P and world w
function pzSet(z) { const { g, Z } = pzEngine, rnd = () => 0.5; g.start(Z.modeOf(z), ['A', ''], false, { rnd }); Z.setup(g, z, rnd); return { P: g.P, w: g.world }; }
/* Its answer played, turn after turn (a two-turn one from where the first leaves the balls), every ball's place kept each
   step (as physics.js run steps: 1/120 s) - the path drawn, the replay played; ok: whether it does what is asked
   (puzzles.js judge, as the app and the server judge it) */
function pzRun(z) {
  const { g, Z } = pzEngine, { P, w } = pzSet(z), frames = [], turns = Z.turnsOf(z), down = [];
  const snap = () => frames.push(w.balls.map(b => b.on ? [b.x, b.y] : null));
  snap(); let ok = false, note = null;
  for (let t = 0; t < turns; t++) {
    const s = Z.shotOf(z, t); P.strike(w, s[0], s[1], s[2], s[3], s[4] || 0);
    for (let i = 0; i < 120 * 40 && !P.rest(w); i++) { P.step(w, 1 / 120); if (i % 2) snap(); }
    snap(); frames.push('turn');
    const j = Z.judge(g, z, w.ev, w, t, down); for (const q of w.ev.pocketed) down.push(q.id);
    if (!j.ok) { note = j.note; break; } if (j.done) { ok = true; break; }
  }
  return { P, w, frames, ok, note };
}

/* ---- drawing: the cloth (the table's, or the outline's with its islands), the pockets or the outline's holes, the
   cushions asked for (yellow), the barricades, the balls; and, given, the paths (the cue ball's white, the rest their own) */
function pzDraw(cv, z, run, upto) {
  if (!pzEngine) return;
  const { P, w } = run || pzSet(z), ctx = cv.getContext('2d'), Wd = cv.width, Ht = cv.height, m = P.R * 3;
  const k = Math.min(Wd / (2 * P.HL + 2 * m), Ht / (2 * P.HW + 2 * m)), ox = Wd / 2, oy = Ht / 2;
  const X = x => ox + x * k, Y = y => oy - y * k;
  ctx.clearRect(0, 0, Wd, Ht);
  ctx.fillStyle = '#5a3218'; ctx.fillRect(X(-P.HL - m), Y(P.HW + m), (2 * P.HL + 2 * m) * k, (2 * P.HW + 2 * m) * k);
  const cloth = '#1f7a4d', sh = w.shape, ring = q => { ctx.beginPath(); q.forEach((p, i) => i ? ctx.lineTo(X(p[0]), Y(p[1])) : ctx.moveTo(X(p[0]), Y(p[1]))); ctx.closePath(); };
  if (sh) {
    ctx.fillStyle = '#3d2412'; ctx.fillRect(X(-P.HL), Y(P.HW), 2 * P.HL * k, 2 * P.HW * k);
    ring(sh.poly); ctx.fillStyle = cloth; ctx.fill();
    for (const q of sh.islands || []) { ring(q); ctx.fillStyle = '#5a3218'; ctx.fill(); }
    ctx.fillStyle = '#050505'; for (const h of sh.holes || []) { ctx.beginPath(); ctx.arc(X(h.x), Y(h.y), h.r * k, 0, 7); ctx.fill(); }
    const need = (sh.spec && sh.spec.need) || z.need || [];
    ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = Math.max(2, P.R * k * 0.5);
    need.forEach((e, i) => { const a = sh.poly[e], b = sh.poly[(e + 1) % sh.poly.length]; if (!a || !b) return; ctx.beginPath(); ctx.moveTo(X(a[0]), Y(a[1])); ctx.lineTo(X(b[0]), Y(b[1])); ctx.stroke();
      if (cv.width > 300) { ctx.fillStyle = '#ffd34d'; ctx.font = `bold ${Math.round(P.R * k * 2.2)}px system-ui`; ctx.fillText(String(i + 1), X((a[0] + b[0]) / 2) + 4, Y((a[1] + b[1]) / 2) - 4); } });
  } else {
    ctx.fillStyle = cloth; ctx.fillRect(X(-P.HL), Y(P.HW), 2 * P.HL * k, 2 * P.HW * k);
    ctx.fillStyle = '#050505'; for (const p of P.POCKETS || []) { ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), p.r * k, 0, 7); ctx.fill(); }
  }
  ctx.fillStyle = '#c9a36a';
  for (const b of z.walls || []) { ctx.save(); ctx.translate(X(b.x), Y(b.y)); ctx.rotate(-(b.ang || 0)); ctx.fillRect(-b.len / 2 * k, -(b.thick || 0.03) / 2 * k, b.len * k, (b.thick || 0.03) * k); ctx.restore(); }
  const four = pzEngine.Z.gameOf(z) === 'four', hue = i => four ? PZ_CAROM_HUE[i] : PZ_POOL_HUE[i] || '#ccc';
  // (upto: the frame the balls are drawn at, the paths up to it; Infinity: the whole paths, the balls where they start)
  const F = run ? run.frames.filter(f => f !== 'turn') : null, last = F ? F[upto === Infinity || upto == null ? 0 : Math.min(F.length - 1, upto)] : null;
  if (F && upto != null) {
    // the paths so far: each ball that moved, from its first place to where it is now
    for (let i = 0; i < w.balls.length; i++) {
      ctx.beginPath(); let moved = false, p0 = null;
      for (let f = 0; f <= Math.min(upto, F.length - 1); f++) { const p = F[f][i]; if (!p) continue; if (!p0) { ctx.moveTo(X(p[0]), Y(p[1])); p0 = p; } else { ctx.lineTo(X(p[0]), Y(p[1])); if (Math.abs(p[0] - p0[0]) + Math.abs(p[1] - p0[1]) > 1e-4) moved = true; } }
      if (!moved) continue;
      ctx.strokeStyle = i === 0 ? 'rgba(255,255,255,.9)' : hue(i); ctx.globalAlpha = i === 0 ? 1 : 0.7; ctx.lineWidth = i === 0 ? 2 : 1.4; ctx.setLineDash(i === 0 ? [] : [5, 4]); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.setLineDash([]);
  }
  const at = last || w.balls.map(b => b.on ? [b.x, b.y] : null);
  at.forEach((p, i) => { if (!p) return; ctx.beginPath(); ctx.arc(X(p[0]), Y(p[1]), Math.max(2, P.R * k), 0, 7); ctx.fillStyle = hue(i); ctx.fill();
    if (!four && i > 8) { ctx.fillStyle = '#f4f1ea'; ctx.beginPath(); ctx.arc(X(p[0]), Y(p[1]), Math.max(1, P.R * k * 0.45), 0, 7); ctx.fill(); }
    ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1; ctx.stroke(); });
  // (where the answer is aimed, before it is played: a short line from the cue ball)
  if (upto == null && w.balls[0].on && z.sol) { const s = pzEngine.Z.shotOf(z, 0), c = w.balls[0], L = P.R * 8; ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(X(c.x), Y(c.y)); ctx.lineTo(X(c.x + Math.cos(s[0]) * L), Y(c.y + Math.sin(s[0]) * L)); ctx.stroke(); }
}

/* ---- the list ---- */
function pzFiltered() {
  const g = $('#pzGame').value, kd = $('#pzKind').value, el = $('#pzEl').value, st = $('#pzState').value, lo = $('#pzLo').value, hi = $('#pzHi').value;
  const L = (pzRows || []).filter(q => (!g || q.game === g) && (!kd || (kd === 'plain' ? q.plain : !q.plain)) && (!el || q.els.includes(el)) &&
    (lo === '' || q.r >= +lo) && (hi === '' || q.r <= +hi) &&
    (!st || (st === 'ok' ? !q.fix && !q.off : st === 'fix' ? q.fix : st === 'off' ? q.off : st === 'set' ? q.set != null : q.live)));
  const s = $('#pzSort').value, key = { r: q => q.r, n: q => -q.n, ok: q => q.n ? q.o / q.n : 2, stars: q => q.stars == null ? 9 : q.stars, fun: q => -(q.fun || 0), gap: q => -Math.abs(q.r - q.ai), id: q => q.id }[s];
  return L.sort((a, b) => key(a) - key(b) || a.id - b.id);
}
function pzPaint() {
  const L = pzFiltered(), t = $('#pzList');
  $('#pzCount').textContent = `${num(L.length)} / ${num((pzRows || []).length)}개`;
  t.innerHTML = '<tr><th></th><th>퍼즐</th><th>AI → 실제</th><th>시도 · 성공 · 별</th><th>재미</th></tr>' + L.map(q => `<tr data-id="${q.id}" class="${q.id === pzSel ? 'on' : ''}">
    <td><canvas width="208" height="112" data-id="${q.id}"></canvas></td>
    <td><b>#${q.id}</b> <span class="chip">${q.game === 'four' ? '4구' : '포켓'}</span><span class="chip">${q.plain ? '일반' : '조건'}</span>${q.els.map(e => `<span class="chip">${PZ_EL_KO[e] || e}</span>`).join('')}${q.fix ? '<span class="chip fix">고정</span>' : ''}${q.off ? '<span class="chip off">끔</span>' : ''}${q.set != null && !q.fix ? '<span class="chip set">손댐</span>' : ''}
      <div class="muted" style="font-size:12px">${PZ_GOAL_KO[q.goal] || q.goal}${q.note ? ' · ' + esc(q.note) : ''}</div></td>
    <td class="ar">${num(q.ai)} → <b>${num(q.r)}</b>${q.live ? '' : ' <span class="muted" style="font-size:11px">(AI)</span>'}</td>
    <td class="ar">${num(q.n)} · ${pzPct(q.o, q.n)} · ${pzStarsOf(q.stars)}</td>
    <td class="ar">${q.fun != null ? q.fun.toFixed(2) : '-'}</td></tr>`).join('');
  pzThumbs();
}
$('#pzList').onclick = e => { const tr = e.target.closest('tr[data-id]'); if (tr) pzShow(+tr.dataset.id); };
// the small pictures, a few a frame (the list can be every puzzle)
function pzThumbs() {
  if (!pzEngine) return;
  const cvs = [...document.querySelectorAll('#pzList canvas:not(.drawn)')];
  const go = () => { for (const cv of cvs.splice(0, 24)) { const z = pzEngine.Z.byId(+cv.dataset.id); if (z) pzDraw(cv, z); cv.classList.add('drawn'); } if (cvs.length) requestAnimationFrame(go); };
  requestAnimationFrame(go);
}

/* ---- one puzzle ---- */
let pzRunNow = null;
async function pzShow(id) {
  pzSel = id; document.querySelectorAll('#pzList tr').forEach(tr => tr.classList.toggle('on', +tr.dataset.id === id));
  const q = (pzRows || []).find(r => r.id === id); if (!q) return;
  $('#pzOne').hidden = false; cancelAnimationFrame(pzAnim);
  $('#pzOneT').textContent = `#${q.id} · ${q.game === 'four' ? '4구' : '포켓'} · ${PZ_GOAL_KO[q.goal] || q.goal}`;
  $('#pzOneS').textContent = [q.plain ? '일반' : '조건', ...q.els.map(e => PZ_EL_KO[e] || e), q.fix ? '고정' : '', q.off ? '끔' : ''].filter(Boolean).join(' · ');
  $('#pzOneStats').innerHTML = [['AI', num(q.ai)], ['실제', num(q.r) + (q.live ? '' : '*')], ['RD', num(q.rd)], ['시도', num(q.n)], ['성공률', pzPct(q.o, q.n)], ['평균 점수', q.score == null ? '-' : q.score.toFixed(2)], ['평균 별', pzStarsOf(q.stars)], ['재미', q.fun != null ? q.fun.toFixed(2) : '-'], ['손댄 값', q.set != null ? num(q.set) : '-'], ['라이브 기준', `시도 ${pzMinTries}+`]]
    .map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
  $('#pzR').value = q.set != null ? q.set : ''; $('#pzR').placeholder = String(q.r); $('#pzFix').checked = q.fix; $('#pzNote').value = q.note || '';
  $('#pzOff').textContent = q.off ? '켜기' : '끄기'; $('#pzOff').className = q.off ? 'go' : 'warn';
  pzRunNow = null; $('#pzPlayNote').textContent = '';
  // (the answer comes from the server - not in the game's puzzles.js since 11-25)
  const r = await api('puzzles', { op: 'get', id }); if (!r.ok || pzSel !== id) return;
  if (pzEngine) { const z = pzEngine.Z.byId(id); if (r.sol) z.sol = r.sol; }
  if (pzEngine && pzEngine.Z.byId(id).sol) { const z = pzEngine.Z.byId(id); pzRunNow = pzRun(z); pzDraw($('#pzBig'), z, pzRunNow, Infinity); $('#pzPlayNote').textContent = pzRunNow.ok ? '정답 확인됨 (이 버전의 물리)' : `정답이 안 됨: ${pzRunNow.note || ''}`; }
  else $('#pzPlayNote').textContent = pzEngine ? '정답을 받지 못함' : '게임 코드를 불러오는 중…';
  const sc = s => { const v = s === 'o' ? 1 : s === 'x' ? 0 : +s; return v >= 1 ? '★★★' : v >= 0.75 ? '★★' : v > 0 ? '★' : '놓침'; };
  $('#pzOneTries').innerHTML = r.tries.length ? '<tr><th>때</th><th>결과</th><th>선수 레이팅</th></tr>' + r.tries.map(t => `<tr><td>${when(t.at)}</td><td>${sc(t.res)}</td><td>${num(t.pr)} ±${t.prd}</td></tr>`).join('') : '<tr><td class="muted">시도 없음</td></tr>';
  $('#pzOneLog').innerHTML = pzLogRows(r.log, true);
}
// the answer played out on the big picture, the balls moving along their paths
$('#pzPlay').onclick = () => {
  if (!pzEngine || !pzSel) return; const z = pzEngine.Z.byId(pzSel); if (!z.sol) return; pzRunNow = pzRunNow || pzRun(z);
  const run = pzRunNow, n = run.frames.filter(f => f !== 'turn').length, t0 = performance.now(); cancelAnimationFrame(pzAnim);
  const tick = now => { const f = Math.min(n - 1, Math.floor((now - t0) / 1000 * 60)); pzDraw($('#pzBig'), z, run, f); if (f < n - 1) pzAnim = requestAnimationFrame(tick); };
  pzAnim = requestAnimationFrame(tick);
};
async function pzDo(body, what) {
  if (what && !confirm(what + '\n적용할까요?')) return false;
  const r = await api('puzzles', body); if (!r.ok) { toast({ 'bad rating': '레이팅 범위(100~3500)를 벗어났습니다', 'bad change': '바꿀 값이 없거나 너무 큽니다', none: '해당하는 퍼즐이 없습니다' }[r.why] || r.why || '실패', 'bad'); return false; }
  toast('적용했습니다', 'good'); await pzLoad(); return true;
}
$('#pzSetForm').onsubmit = e => {
  e.preventDefault(); if (!pzSel) return; const v = $('#pzR').value, fix = $('#pzFix').checked;
  pzDo({ op: 'set', id: pzSel, r: v === '' ? null : Math.round(+v), fix }, `#${pzSel}: ${v === '' ? '' : `레이팅 ${v}`}${fix ? ' 고정' : v === '' ? ' 고정 풀기' : ' (시도로 계속 움직임)'}`);
};
$('#pzReset').onclick = () => pzSel && pzDo({ op: 'reset', id: pzSel }, `#${pzSel}: AI 레이팅으로 되돌리기 (고정도 풀림)`);
$('#pzOff').onclick = () => { const q = pzSel && pzRows.find(r => r.id === pzSel); if (q) pzDo({ op: 'off', id: q.id, off: !q.off }, `#${q.id}: ${q.off ? '다시 내주기' : '내주지 않기 (끄기)'}`); };
$('#pzNoteForm').onsubmit = e => { e.preventDefault(); if (pzSel) pzDo({ op: 'set', id: pzSel, note: $('#pzNote').value }); };
// a group: the filters' game, kind, element and rating range (the state filter is the list's alone)
$('#pzBatch').onsubmit = e => {
  e.preventDefault(); const d = Math.round(+$('#pzD').value); if (!d) return toast('바꿀 값을 입력하세요', 'bad');
  const f = { game: $('#pzGame').value || undefined, kind: $('#pzKind').value || undefined, el: $('#pzEl').value || undefined, lo: $('#pzLo').value === '' ? undefined : +$('#pzLo').value, hi: $('#pzHi').value === '' ? undefined : +$('#pzHi').value };
  const n = (pzRows || []).filter(q => (!f.game || q.game === f.game) && (!f.kind || (f.kind === 'plain' ? q.plain : !q.plain)) && (!f.el || q.els.includes(f.el)) && (f.lo == null || q.r >= f.lo) && (f.hi == null || q.r <= f.hi)).length;
  pzDo(Object.assign({ op: 'batch', d }, f), `퍼즐 ${num(n)}개의 레이팅을 ${d > 0 ? '+' : ''}${d} (손댄 값으로 남음)`).then(ok => { if (ok) $('#pzD').value = ''; });
};
/* ---- the knobs (puzzlebook-core.js CFG; the app's 52-puzzle.js follows them) ---- */
function pzCfgShow(c) {
  if (!c) return; $('#cStart').value = c.start; $('#cAim').value = c.aim; $('#cHard').value = c.hard; $('#cPlain').value = c.plainMax;
  ['cS0', 'cS1', 'cS2', 'cS3'].forEach((id, i) => { $('#' + id).value = c.stars[i]; });
}
$('#pzCfg').onsubmit = e => {
  e.preventDefault();
  const set = { start: +$('#cStart').value, aim: +$('#cAim').value, hard: +$('#cHard').value, plainMax: +$('#cPlain').value, stars: ['cS0', 'cS1', 'cS2', 'cS3'].map(id => +$('#' + id).value) };
  pzDo({ op: 'cfg', set }, `손잡이 저장: 시작 ${set.start}, 목표 ${set.aim}, 어려운 차례 +${set.hard}, 별 ${set.stars.join(' / ')}, 일반 배치 상한 ${set.plainMax}`).then(ok => { if (!ok) api('puzzles', { op: 'cfg' }).then(r => r.ok && pzCfgShow(r.cfg)); });
};
/* ---- the log ---- */
const PZ_WHAT_KO = { set: '정함', reset: 'AI 값으로', off: '끔', on: '켬', batch: '묶음', cfg: '손잡이' };
function pzLogRows(rows, one) {
  const short = o => o == null ? '' : esc(JSON.stringify(o).replace(/[{}"]/g, '').replace(/,/g, ', ')).slice(0, 140);
  return rows && rows.length ? `<tr><th>때</th>${one ? '' : '<th>퍼즐</th>'}<th>무엇</th><th>전 → 후</th><th>누가</th></tr>` + rows.map(l => `<tr><td>${when(l.at)}</td>${one ? '' : `<td>${l.id ? '#' + l.id : ''}</td>`}<td>${PZ_WHAT_KO[l.what] || esc(l.what)}</td><td style="font-size:12px">${short(l.was)} → ${short(l.now)}</td><td class="muted" style="font-size:11px">${esc(l.by)}</td></tr>`).join('') : '<tr><td class="muted">기록 없음</td></tr>';
}
async function pzLogLoad() { const r = await api('puzzles', { op: 'log', limit: 100 }); if (r.ok) $('#pzLog').innerHTML = pzLogRows(r.rows); }
