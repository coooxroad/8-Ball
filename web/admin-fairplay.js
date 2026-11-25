/* The admin console's 페어플레이 tab (owner 11-25: chess.com's way - numbers and evidence, an admin decides; plan
   claude/cue-ai-upgrade-plan.md 4절, 8절; the server's side: server/src/core.js fpSummary, adminSanction - /v1/admin/fairplay).
   Every account with ranked games or puzzles: its numbers over 90 days (the server keeps them as each game ends) - games,
   shots, won, the rating it gained; how it aims (the median time a turn took, how alike those times are, the share of
   turns aimed in one go with no big swing, the share with the app sent to the background mid-aim); its puzzles (first
   tries solved, solves with the stored answer itself). A number past the config's threshold is marked - the config is
   the server's alone (the code is public: what would be flagged is not written here).
   One account opened: its games, and the deep look at the ones picked, on the game's own code in this page (the site's
   core, as the puzzle tab loads it: pzEngineLoad) and the seeing AI (ai/64-see-mind.js): for each of the player's shots,
   the way a player of their rating meant (seeInverse) and how the aim sat - about where such a player pictures the way's
   middle (a person) or on the real middle to a hair (an engine): the log of how much likelier the one than the other,
   summed (a person: positive; an aim engine: well below zero - Regan's and Irwin's idea, the aim's fingerprint); and the
   ways made that a player of that rating seldom sees. Then the sanction ①~⑤. Uses admin.js's api, toast, esc, num, when. */
let fpRows = null, fpSort = 'games', fpSel = null, fpGames = null, fpBusy = false;
const FP_COLS = [['nick', '닉네임'], ['dama', '레이팅'], ['games', '판'], ['week', '7일'], ['shots', '샷'], ['won', '승'], ['dd', '레이팅 변화'], ['think', '생각(중앙, s)'], ['thinkCv', '시간 고름'], ['settle', '마무리(s)'], ['oneAim', '한 번에 조준'], ['hid', '백그라운드'], ['pzN', '퍼즐'], ['pzFirst', '첫 시도 성공'], ['pzExact', '정답 그대로'], ['ban', '제재']];
const fpVal = (r, k) => k === 'think' || k === 'settle' ? (r[k] == null ? '-' : (r[k] / 1000).toFixed(1)) : k === 'oneAim' || k === 'hid' || k === 'pzFirst' ? (r[k] == null ? '-' : Math.round(r[k] * 100) + '%')
  : k === 'thinkCv' ? (r[k] == null ? '-' : r[k].toFixed(2)) : k === 'ban' ? [r.ban ? '매칭 ' + when(r.ban) : '', r.pzBlock ? '퍼즐 ' + when(r.pzBlock) : ''].filter(Boolean).join(' · ') || '' : k === 'nick' ? esc(r.nick || r.acct.slice(0, 8)) : r[k] == null ? '-' : num(r[k]);

function fpOpen() { if (!fpRows) fpLoad(); }
async function fpLoad() {
  const r = await api('fairplay', { op: 'list', min: +$('#fpMin').value || 0 }); if (!r.ok) return toast(r.why || '불러오지 못했습니다', 'bad');
  fpRows = r.rows; $('#fpCfg').value = JSON.stringify(r.cfg || {}, null, 1); $('#fpNote').textContent = `${fpRows.length}개 계정 · 표시 ${fpRows.filter(x => x.flags.length).length}`;
  fpPaint();
}
function fpPaint() {
  const t = $('#fpList'), rows = fpRows.slice().sort((a, b) => fpSort === 'nick' ? String(a.nick || '').localeCompare(String(b.nick || '')) : (b.flags.length - a.flags.length) || ((b[fpSort] == null ? -1e9 : b[fpSort]) - (a[fpSort] == null ? -1e9 : a[fpSort])));
  t.innerHTML = '<tr>' + FP_COLS.map(([k, n]) => `<th data-k="${k}">${n}${fpSort === k ? ' ▾' : ''}</th>`).join('') + '</tr>' +
    rows.map(r => `<tr data-a="${r.acct}" class="${fpSel === r.acct ? 'on' : ''}">` + FP_COLS.map(([k]) => `<td class="${r.flags.includes(k) ? 'flag' : ''}">${fpVal(r, k)}</td>`).join('') + '</tr>').join('');
  t.querySelectorAll('th').forEach(h => { h.onclick = () => { fpSort = h.dataset.k; fpPaint(); }; });
  t.querySelectorAll('tr[data-a]').forEach(tr => { tr.onclick = () => fpShow(tr.dataset.a); });
}
$('#fpLoad').onclick = fpLoad;
$('#fpCfgSave').onclick = async () => {
  let set; try { set = JSON.parse($('#fpCfg').value || '{}'); } catch (e) { return toast('설정이 JSON이 아닙니다', 'bad'); }
  const r = await api('fairplay', { op: 'cfg', set }); if (!r.ok) return toast(r.why || '저장 실패', 'bad'); toast('저장했습니다', 'good'); fpLoad();
};

async function fpShow(acct) {
  fpSel = acct; fpPaint(); $('#fpOne').hidden = false; $('#fpDeepOut').textContent = ''; $('#fpDeepNote').textContent = '';
  const row = fpRows.find(r => r.acct === acct) || { acct };
  $('#fpOneTitle').textContent = `${row.nick || acct.slice(0, 8)} · ${acct.slice(0, 4).toUpperCase()}·${acct.slice(4, 8).toUpperCase()}`;
  const v = await api('fairplay', { op: 'view', acct }), f = v.ok ? v.fp : row;
  $('#fpOneStats').innerHTML = [['판', num(f.games)], ['샷', num(f.shots)], ['승률', f.games ? Math.round(f.won / f.games * 100) + '%' : '-'], ['레이팅 변화', (f.dd > 0 ? '+' : '') + num(f.dd)],
    ['생각 시간', fpVal(f, 'think') + 's'], ['한 번에 조준', fpVal(f, 'oneAim')], ['퍼즐 첫 시도', fpVal(f, 'pzFirst')], ['정답 그대로', num(f.pzExact)]].map(([n, b]) => `<div class="stat"><b>${b}</b><span>${n}</span></div>`).join('');
  const g = await api('games', { acct, limit: 200 }); fpGames = g.ok ? g.games : [];
  $('#fpGames').innerHTML = '<tr><th></th><th>언제</th><th>종목</th><th>결과</th><th>코인</th><th>나 · 상대</th><th>샷</th></tr>' + fpGames.map((x, i) =>
    `<tr><td><input type="checkbox" data-i="${i}"></td><td>${when(x.at)}</td><td>${esc(x.mode)}</td><td>${x.won ? '승' : '패'}</td><td>${num(x.coins)}</td><td>${num(x.me)} · ${x.opp == null ? '-' : num(x.opp)}${x.oppPerson ? '' : ' (봇)'}</td><td>${num(x.shots)}</td></tr>`).join('');
}
const fpPicked = () => [...document.querySelectorAll('#fpGames input:checked')].map(c => fpGames[+c.dataset.i]).filter(Boolean);

/* the deep look: each picked game's record whole (/v1/admin/games { room }), each of the player's shots set out on the
   table as it stood (the record keeps every ball) and read by the seeing AI at the player's rating then */
const FP_ENGINE = 0.0004;   // (an aim engine's own spread, radians: the app's finest aim step - it aims at the real middle)
$('#fpDeep').onclick = async () => {
  if (fpBusy) return; const games = fpPicked(); if (!games.length) return toast('게임을 고르세요', 'bad');
  fpBusy = true; $('#fpDeepOut').textContent = '';
  try {
    await pzEngineLoad(); if (!pzEngine) throw new Error('no engine');
    const g = createGame(physicsFor(createPhysics, 'bar'), createAI), S = g.aiJudge && g.aiJudge.see; if (!S) throw new Error('no seeing AI');
    const out = [], totals = { n: 0, llr: 0, hard: 0 };
    for (const x of games) {
      const one = await api('games', { acct: fpSel, room: x.room }), rec = one.ok && one.game.rec; if (!rec) continue;
      g.start(rec.mode, ['A', 'B'], false, Object.assign({ rnd: () => 0.5 }, rec.rules || {})); g.isBreak = false; g.placing = null;
      const per = { room: x.room, mode: rec.mode, n: 0, llr: 0, hard: 0, rows: [] }, R = rec.me;
      for (const s of rec.shots) {
        const [n, aim, V, a, b, el, inHand, cue] = s, w = g.world;
        if (inHand) continue;   // (a ball in hand: where it was put is part of the plan - not read here)
        for (let i = 0; i < w.balls.length; i++) { const k = 8 + 3 * i; if (k + 2 >= s.length) break; g.P.place(w, i, s[k], s[k + 1]); w.balls[i].on = !!s[k + 2]; }
        w.cue = g.P.POCKETED ? 0 : cue; g.turn = g.P.POCKETED ? (rec.seat || 0) : cue;
        if (g.isBreak) continue;
        $('#fpDeepNote').textContent = `${rec.mode} 샷 ${n} 읽는 중…`; await new Promise(r => setTimeout(r, 0));
        let inv; try { inv = S.seeInverse(w, g.P.POCKETED ? g.turn : cue, { angle: aim, V, a, b, el }, R, { win: 0.08 }); } catch (e) { continue; }
        const top = inv.post[0], sig = S.seeHand(R, { V, a, b, el }).aim;
        if (!top || top.p < 0.5 || !top.route.truth) { per.rows.push({ n, note: inv.other > 0.5 ? '다른 것(설명 안 됨)' : '길 여럿', other: inv.other }); continue; }
        const rt = top.route, lh = -0.5 * ((aim - rt.c) / sig) ** 2 - Math.log(sig), le = -0.5 * ((aim - rt.truth.c) / FP_ENGINE) ** 2 - Math.log(FP_ENGINE);
        const llr = Math.max(-5, Math.min(5, lh - le)), hard = inv.rec.ok && rt.seen < 0.3;
        per.n++; per.llr += llr; per.hard += hard ? 1 : 0;
        per.rows.push({ n, key: rt.key, p: top.p, seen: rt.seen, made: inv.rec.ok, off: (aim - rt.truth.c) * 180 / Math.PI, mind: (rt.c - rt.truth.c) * 180 / Math.PI, llr, hard });
      }
      totals.n += per.n; totals.llr += per.llr; totals.hard += per.hard; out.push(per);
    }
    const f2 = v => (v > 0 ? '+' : '') + v.toFixed(2);
    $('#fpDeepOut').innerHTML = `<p style="font-size:13px">샷 ${totals.n}개 · 조준 지문(사람 대 엔진, 로그 가능도비 합) <b>${f2(totals.llr)}</b> (샷당 ${totals.n ? f2(totals.llr / totals.n) : '-'} — 사람이면 양수, 조준 엔진이면 크게 음수) · 그 레이팅이 잘 못 보는 길로 득점 <b>${totals.hard}</b></p>` +
      out.map(p => `<h2 style="margin-top:10px">${esc(p.mode)} · ${p.room.slice(0, 8)} — 샷 ${p.n} · 지문 ${f2(p.llr)} · 어려운 길 득점 ${p.hard}</h2><div class="scroll" style="max-height:220px"><table id="fpShots"><tr><th>샷</th><th>노린 길</th><th>확률</th><th>볼 확률</th><th>득점</th><th>실제 가운데에서</th><th>그림이 어긋난 각</th><th>지문</th></tr>` +
        p.rows.map(r => r.key ? `<tr><td>${r.n}</td><td>${esc(r.key)}</td><td>${Math.round(r.p * 100)}%</td><td class="${r.hard ? 'flag' : ''}">${Math.round(r.seen * 100)}%</td><td>${r.made ? '○' : '×'}</td><td>${r.off.toFixed(3)}°</td><td>${r.mind.toFixed(3)}°</td><td class="${r.llr < -2 ? 'flag' : ''}">${f2(r.llr)}</td></tr>`
          : `<tr><td>${r.n}</td><td colspan="7" class="muted">${r.note}</td></tr>`).join('') + '</table></div>').join('');
    $('#fpDeepNote').textContent = '끝';
  } catch (e) { toast('깊은 분석을 할 수 없습니다: ' + e.message, 'bad'); }
  fpBusy = false;
};

$('#fpSanction').onsubmit = async e => {
  e.preventDefault(); if (!fpSel) return;
  const rooms = fpPicked().map(x => x.room), body = { op: 'sanction', acct: fpSel, why: $('#fsWhy').value, days: +$('#fsDays').value || 0, ban: $('#fsBan').checked, pzBlock: $('#fsPz').checked, reset: $('#fsReset').checked, confiscate: $('#fsTake').checked, refund: $('#fsRefund').checked, rooms };
  if ((body.confiscate || body.refund) && !rooms.length) return toast('④·⑤는 게임을 골라야 합니다', 'bad');
  if (!confirm(`이 계정에 제재를 적용할까요?\n${[body.ban && `① 매칭 금지 ${body.days}일`, body.pzBlock && `② 퍼즐 재화 없음 ${body.days}일`, body.reset && '③ 레이팅 초기화', body.confiscate && `④ 코인 압수 (${rooms.length}판)`, body.refund && `⑤ 상대에게 레이팅 돌려주기 (${rooms.length}판)`].filter(Boolean).join('\n')}`)) return;
  const r = await api('fairplay', body); if (!r.ok) return toast(r.why === 'days' ? '기간(일)을 넣으세요' : r.why || '실패', 'bad');
  toast(`적용: ${r.did.join(', ')}${r.refunded ? ` · 돌려줌 ${r.refunded.filter(q => q.ok).length}/${r.refunded.length}` : ''}`, 'good'); fpLoad(); fpShow(fpSel);
};
$('#fsLift').onclick = async () => {
  if (!fpSel || !confirm('매칭 금지·퍼즐 재화 제한을 지금 풀까요?')) return;
  const r = await api('fairplay', { op: 'sanction', acct: fpSel, lift: true, why: $('#fsWhy').value }); if (!r.ok) return toast(r.why || '실패', 'bad'); toast('풀었습니다', 'good'); fpLoad(); fpShow(fpSel);
};
