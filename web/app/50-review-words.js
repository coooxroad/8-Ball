/* What the review's coach says of one shot (50-review.js), as a chess engine's commentary does (owner 11-18, Komodo:
   "정확합니다, 좋은 끌어치기였어요" - say what the shot meant and what it did, never a line that would fit any shot).
   Read from what the judge found (ai/60-judge.js judgeShot): the shot's own story (d - the ball met first and how thick or
   at what cut, the balls potted and where, the cushions, the tip, the pace, the cue raised), what it left (next - the ball
   the next shot would go for), the line meant when it missed (md) and why it missed, a foul and which, a fluke; and the
   other ways (alts), each told the same way. Degrees, thickness, tip and pace are told; the judge's scores never are
   (owner 11-17). A pocket is named by its kind only (코너 / 사이드): the board shows which, turned as the screen is. */
const RV_WAY = { stun: '스톱', follow: '밀어치기', draw: '끌어치기', side: '회전 이용', kick: '원쿠션', bank: '뱅크샷', combo: '콤비', safety: '수비' };
// a ball's name as the table shows it (four-ball's two reds told apart by which was nearer the cue ball before the shot -
// rvAt, the shot's table, set by reviewWords)
let rvAt = null;
function rvBall(id) {
  if (id == null) return '공';
  if (game.mode.table === 'carom') {
    if (id < 2) return (id === 0) === (game.yellow === 0) ? '노란 공' : '흰 공';
    const B = rvAt && rvAt.balls, c = B && B[rvAt.cue], o = B && B[id === 2 ? 3 : 2];
    if (!c || !o || !o[2]) return '빨간 공';
    const near = Math.hypot(B[id][0] - c[0], B[id][1] - c[1]) <= Math.hypot(o[0] - c[0], o[1] - c[1]);
    return near ? '가까운 빨간 공' : '먼 빨간 공';
  }
  if (game.mode.table === 'snooker') return SNOOKER.name[SNOOKER.kind(id)];
  return id === 0 ? '수구' : `${game.faceOf(id)}번 공`;
}
// a word with its particle (을/를, 이/가, 은/는, 으로/로) as its last sound wants
const rvJ = (w, a, b) => { const c = w.charCodeAt(w.length - 1), hangul = c >= 0xac00 && c <= 0xd7a3, end = hangul ? (c - 0xac00) % 28 : /[136780]$/.test(w) ? 1 : 0;
  return w + (a === '으로' ? (end && end !== 8 ? '으로' : '로') : end ? a : b); };
const rvPocket = k => { const p = game.P.POCKETS[k]; return !p ? '포켓' : p.corner ? '코너 포켓' : '사이드 포켓'; };
// how the first ball was met: pool by its cut in degrees, carom by thickness as a player says it
function rvMet(d) {
  if (d.thick == null) return '';
  if (game.mode.table !== 'carom') return Math.abs(d.cut) < 4 ? '정면으로' : `${Math.abs(d.cut)}° 깎아`;
  const t = d.thick; return t >= 0.9 ? '정면으로' : t >= 0.65 ? '두껍게(3/4)' : t >= 0.4 ? '반 두께(1/2)로' : t >= 0.18 ? '얇게(1/4)' : '아주 얇게(1/8)';
}
// the stroke: the tip (up for follow, down for draw, left or right), the cue raised
function rvStroke(d) {
  const parts = [];
  if (d.el >= 15) parts.push('찍어치기');
  if (d.b >= 0.25) parts.push('밀어치기'); else if (d.b <= -0.25) parts.push('끌어치기');
  if (d.a >= 0.2) parts.push('오른쪽 회전'); else if (d.a <= -0.2) parts.push('왼쪽 회전');
  return parts.join(' + ') || (game.mode.table === 'carom' ? '무회전' : '스톱');
}
const rvPace = p => p < 0.3 ? '부드럽게' : p < 0.6 ? '보통 세기로' : p < 0.8 ? '세게' : '아주 세게';
// one stroke told: how it was struck when that is worth saying (a tip off the centre, the cue raised), what it met and how,
// where it went (the pace and tip in full are on the card's stroke row)
function rvStory(d, missed) {
  if (!d || d.first == null) return '아무 공도 맞히지 못했어요.';
  const s = rvStroke(d), lead = s === '스톱' || s === '무회전' ? '' : rvJ(s, '으로', '로') + ' ', first = rvBall(d.first);
  if (game.mode.table === 'carom') {
    const rt = d.route || {}, pre = d.pre ? `${rt.name ? rt.name + '로 ' : ''}쿠션 ${rt.preRails || d.pre + '번'}을 먼저 돌아 ` : '';
    const second = d.second != null ? `${d.cushions ? `${rt.rails ? rt.rails : d.cushions + '번'} 쿠션을 돌아${rt.name && !d.pre ? `(${rt.name})` : ''}` : '곧바로'} ${rvJ(rvBall(d.second), '을', '를')} 맞혔어요` : '둘째 공에는 닿지 못했어요';
    const short = game.modeId === 'three' && d.second != null && d.cushions < 3 ? ` 쿠션이 ${d.cushions ? d.cushions + '번뿐이라' : '하나도 없어'} 득점이 되지 않았어요.` : '';
    return `${lead}${pre}${rvJ(first, '을', '를')} ${rvMet(d)} 맞히고 ${second}.${short}`;
  }
  const pot = d.potted.find(([id]) => id !== 0), scratch = d.potted.some(([id]) => id === 0), met = rvMet(d), hit = met === '정면으로' ? '정면으로 맞혀' : met;
  const went = pot ? (pot[0] === d.first ? `${hit} ${rvPocket(pot[1])}에 넣었어요` : `${hit} ${rvJ(rvBall(pot[0]), '이', '가')} ${rvPocket(pot[1])}에 들어갔어요`)
    : missed ? `${met === '정면으로' ? '정면으로 맞혔지만' : met + ' 쳤지만'} 포켓을 벗어났어요` : `${met === '정면으로' ? '정면으로' : met} 맞혔어요`;
  return `${lead}${rvJ(first, '을', '를')} ${went}${scratch ? ' — 수구도 빠졌어요' : ''}.`;
}
// (the card's short form of the same: 8°, 정면, 3/4)
const rvMetShort = d => d.thick == null ? '' : game.mode.table !== 'carom' ? (Math.abs(d.cut) < 4 ? '정면' : `${Math.abs(d.cut)}°`)
  : d.thick >= 0.9 ? '정면' : d.thick >= 0.65 ? '3/4' : d.thick >= 0.4 ? '1/2' : d.thick >= 0.18 ? '1/4' : '1/8';
// where the cue ball was left, told by the ball the next shot would go for
function rvNext(next, good) {
  if (!next) return good ? '' : '다음에 칠 공이 마땅치 않은 자리예요.';
  return good ? `수구가 다음 ${rvJ(rvBall(next.id), '을', '를')} 넣기 좋은 자리에 섰어요.` : `다음 ${rvJ(rvBall(next.id), '이', '가')} 어려운 자리에 섰어요.`;
}
// the shot's title: the grade said with what made it so (a made shot named by its stroke, as "좋은 끌어치기였어요")
function rvTitle(r) {
  const d = r.d || {}, carom = r.game === 'four' || r.game === 'three';
  if (r.foul) return '실수입니다';
  if (r.made) {
    const s = rvStroke(d).split(' + ')[0], plain = s === '스톱' || s === '무회전';
    if (r.fluke) return '운이 따랐습니다';
    if (r.won) return '마무리했습니다';
    if (r.grade === 0) return plain ? '아름답습니다' : `아름답습니다. 멋진 ${s}였어요`;
    if (r.grade === 1) return plain ? '정확합니다' : `정확합니다. 좋은 ${s}였어요`;
    return carom ? '무난합니다. 다음 배치가 아쉬워요' : '무난합니다. 다음 공이 어려워요';
  }
  if (r.intent && r.intent.kind === 'safety' && r.grade <= 2) return r.grade <= 1 ? '좋은 수비입니다' : '무난한 수비입니다';
  return r.grade <= 1 ? '좋습니다' : r.grade === 2 ? '무난합니다' : r.grade === 3 ? '아쉽습니다' : '실수입니다';
}
/* The coach on the shot played (owner 11-18: '의도를 구체적으로'): three lines, as a commentator calls a shot -
     의도 - what it was for: the ball and pocket (or the first ball, its thickness, the route), and where its stroke was
            sending the cue ball - the next ball it set up (the judge's shape: the stroke at paces round its own)
     결과 - what came of each part: in or not, and the cue ball where (short or long of the spot, by how much)
     원인 - why, in measures: the cut or thickness met against the one meant, the pace against the pace needed, the tip;
            how hard the line was, by its facts (the cut, the distance, a ball in the way)
   and, when another way was better, 추천 with its strongest reason. */
function reviewWords(q) {
  const r = q.res, d = r.d || {}, carom = r.game === 'four' || r.game === 'three', it = r.intent || {}, sh = it.shape, F = r.facts || {}; rvAt = q.snap || null;
  const lines = [], add = (k, t) => { if (t) lines.push({ k, t }); };
  const md = r.made ? d : r.md || null, ms = md ? rvStroke(md) : '', lead = ms && ms !== '스톱' && ms !== '무회전' ? rvJ(ms, '으로', '로') + ' ' : '';
  const nb = x => x && x.next ? rvBall(x.next.id) : null;
  // 의도
  if (it.kind === 'score' && it.target) {
    if (carom) {
      const rt = it.route || {}, way = rt.pre ? `${rt.name || '빈쿠션'}(${rt.preRails})으로 ` : '', rails = rt.rails ? `${rt.rails} 쿠션을 돌아 ` : '곧바로 ';
      add('의도', `${way}${rvJ(rvBall(it.target.first), '을', '를')} ${md ? rvMet(md) : ''} 맞히고 ${rails}${rvBall(it.target.second)}까지${rt.name && !rt.pre ? ` — ${rt.name}` : ''}.`.replace(/\s+/g, ' '));
    } else {
      // (the next ball the stroke was for: its own when it came near the best its paces give, else the best)
      const go = sh ? (sh.dir && !r.practical ? nb(sh.best) : nb(sh.own) || nb(sh.best)) : null, t = it.target;
      const what = t.via != null ? `${rvJ(rvBall(t.via), '으로', '로')} ${rvJ(rvBall(t.id), '을', '를')} ${rvPocket(t.pocket)}에 보내는 콤비` : `${rvJ(rvBall(t.id), '을', '를')} ${rvPocket(t.pocket)}에`;
      add('의도', `${what}${go ? `, ${lead}수구는 ${go} 칠 자리로.` : lead ? `, ${lead.trim()}.` : '.'}`);
    }
  } else if (it.kind === 'safety') add('의도', '수비 — 상대에게 칠 공을 남기지 않기.');
  else if (!r.foul) add('의도', `${carom ? '득점' : '넣을'} 길과 거리가 먼 샷이라 노린 길을 읽기 어려워요.`);
  // 결과, 원인
  if (r.foul) {
    add('결과', { scratch: '수구가 포켓에 빠졌어요.', wrong: carom ? '상대 공을 맞혔어요.' : `먼저 맞혀야 할 공이 아닌 ${rvJ(rvBall(d.first), '을', '를')} 맞혔어요.`, nohit: '공을 하나도 맞히지 못했어요.',
      norail: '맞힌 뒤 쿠션에 닿은 공이 없었어요.', off: '공이 테이블 밖으로 나갔어요.' }[r.cause] || '파울이 났어요.');
    if (r.cause === 'scratch' && F.scratch >= 0.25) add('원인', '이 세기와 당점이면 수구가 포켓으로 가기 쉬운 길이었어요.');
  } else if (r.made) {
    if (r.fluke) add('결과', `넣긴 했지만 노린 길이 아니라 ${carom ? '키스' : '다른 공'} 덕분이에요. 다시 치면 나오기 어려워요.`);
    else if (r.won) add('결과', '경기를 끝냈어요.');
    else if (carom) add('결과', r.practical ? '득점했고, 다음 배치도 좋아요.' : '득점했지만 공들이 흩어져 다음 배치가 어려워요.');
    else if (r.practical) add('결과', `넣었고, ${sh && sh.own && sh.own.next ? `수구가 ${rvJ(rvBall(sh.own.next.id), '을', '를')} 넣기 좋은 자리에 섰어요` : '다음 공도 칠 자리에 섰어요'}.`);
    else add('결과', `넣었지만 ${sh && sh.dir ? `수구가 ${rvCm(sh.gap)} ${sh.dir === 'short' ? '짧게' : '길게'} 섰어요` : '수구가 서기 좋지 않은 자리에 섰어요'} — ${sh && sh.own && sh.own.next ? `${rvJ(rvBall(sh.own.next.id), '이', '가')} 어려워요` : '다음 공이 마땅치 않아요'}.`);
    if (!r.fluke && !r.won && !r.practical && sh) {
      if (sh.dir) add('원인', `세기를 ${sh.dir === 'short' ? '더' : '덜'} 줬으면(지금의 ${Math.round(sh.best.k * 100)}%) ${nb(sh.best) ? rvJ(nb(sh.best), '을', '를') + ' 넣기 좋은 자리' : '좋은 자리'}였어요.`);
      else if (!carom) add('원인', '이 스트로크로는 세기를 바꿔도 좋은 자리가 나오지 않아요 — 당점이나 길을 바꿔야 했어요.');
    }
    if (r.grade === 0) add('한마디', `${rvJ(rvHard(F), '을', '를')} 넣고 다음까지 세웠어요.`);
  } else {
    // (the stroke as played - what it met, and how)
    if (r.meant && md && md.first != null && md.first !== d.first) {
      add('결과', rvStory(d, true));
      add('원인', `조준을 조금만 옮겼으면 ${rvJ(rvBall(md.first), '을', '를')} ${rvMet(md)} ${carom ? '맞혀 득점할' : '넣을'} 수 있었어요.`);
    } else if (r.meant && md && md.first != null) {
      const mc = Math.abs(md.cut || 0), pc = Math.abs(d.cut || 0), w = r.cause === 'thin' ? '얇게' : '두껍게';
      add('결과', carom ? `${rvJ(rvBall(d.first), '을', '를')} ${rvMet(d)} 맞혀 ${d.second != null ? `${rvJ(rvBall(d.second), '을', '를')} 맞혔지만 득점이 되지 않았어요` : '둘째 공을 비켜 갔어요'}.`
        : `${rvJ(rvBall(d.first), '을', '를')} ${rvMet(d)} 맞혔지만 포켓을 벗어났어요.`);
      const need = carom ? `${rvMet(md)} 맞혀야 했는데` : mc < 3 ? '정면으로 맞혀야 했는데' : `${mc}° 깎아야 했는데`;
      const bend = carom ? (r.cause === 'thin' ? ' — 얇으면 수구가 덜 꺾여요' : ' — 두꺼우면 수구가 더 꺾여요') : '';
      add('원인', { thin: carom ? `${need} ${rvMet(d) === rvMet(md) ? '아주 조금' : ''} 얇게 맞았어요${bend}.` : `${need} ${Math.abs(pc - mc) < 2 ? '아주 조금(1°도 안 되게)' : pc + '°로'} 얇게 맞았어요.`,
        thick: carom ? `${need} ${rvMet(d) === rvMet(md) ? '아주 조금' : ''} 두껍게 맞았어요${bend}.` : `${need} ${Math.abs(pc - mc) < 2 ? '아주 조금(1°도 안 되게)' : pc + '°로'} 두껍게 맞았어요.`,
        soft: `길은 맞았는데 세기가 모자랐어요 — ${Math.round(d.pace * 100)}%로 쳤고 ${Math.round(md.pace * 100)}%쯤은 필요했어요.`,
        hard: `길은 맞았는데 세기가 넘쳤어요 — ${Math.round(d.pace * 100)}%로 쳤고 ${Math.round(md.pace * 100)}%쯤이면 됐어요.`,
        tip: '회전이 수구의 길을 틀었어요 — 당점을 가운데로 두면 들어가는 공이었어요.' }[r.cause] || `${need} 조금 빗나갔어요.`);
      // (the pace found wanting, and the aim off as well: both said)
      if ((r.cause === 'soft' || r.cause === 'hard') && md.thick != null && d.thick != null && rvMetShort(d) !== rvMetShort(md)) add('원인', carom ? `두께도 빗나갔어요 — 필요한 두께 ${rvMetShort(md)}, 맞은 두께 ${rvMetShort(d)}.` : `조준도 빗나갔어요 — 필요한 각 ${Math.abs(md.cut || 0)}°, 맞은 각 ${Math.abs(d.cut || 0)}°.`);
      if (r.p != null) add('한마디', r.p >= 0.8 ? (carom ? '쳐야 하는 공이었어요.' : '넣어야 하는 공이었어요.') : r.p < 0.35 ? `${rvJ(rvHard(F), '이라', '라')} 원래 어려운 샷이었어요.` : '');
    } else add('결과', it.kind === 'safety' ? (r.grade <= 1 ? '상대에게 칠 공이 거의 없어요.' : '수비는 됐지만 상대에게 칠 공이 남았어요.') : rvStory(d));
  }
  // the best other way, when this was not it: its name and its strongest reason
  const best = (r.alts || []).find(a => a.best);
  if (best && r.grade >= 2) add('추천', `${rvAltName(best)}${best.why && best.why.length ? ` — ${rvWhy(best.why[0], best)}` : ''}.`);
  return { title: rvTitle(r), lines, text: lines.map(l => l.t).join(' ') };
}
const rvCm = cm => cm >= 100 ? `${(cm / 100).toFixed(1)}m` : `${Math.max(5, Math.round(cm / 5) * 5)}cm`;
// how hard a line was, by its facts: '70° 컷, 1.7m' (pool) / '1/8 두께' (carom)
function rvHard(F) {
  if (F.cut != null) { const parts = []; if (F.cut >= 25) parts.push(`${F.cut}° 컷`); if ((F.dist || 0) + (F.run || 0) >= 1.6) parts.push(`${((F.dist || 0) + (F.run || 0)).toFixed(1)}m 거리`); if (F.bank) parts.push('뱅크'); if (F.tight) parts.push('붙어 있는 공'); return parts.length ? parts.join(', ') : '그 공'; }
  return F.route && F.route.rails ? `${F.route.rails} 길` : '그 길';
}
// a reason another way was better, in words (62-intent.js whyBetter)
function rvWhy(w, a) {
  const carom = game.mode.table === 'carom';
  return { safety: '상대에게 칠 공을 남기지 않아요', cut: `깎는 각이 ${w.by}° 작아요`, near: '공 사이 거리가 짧아요', clear: '길을 가로막는 공이 없어요', scratch: '스크래치 위험이 없어요',
    breaks: `뭉친 ${(w.ids || []).map(id => rvBall(id).replace(/ 공$/, '')).join('·')} 공을 함께 풀어요`,
    pos: carom ? '다음 배치가 좋아요' : w.next ? `수구가 ${rvJ(rvBall(w.next.id), '을', '를')} 넣기 좋은 자리로 와요` : '다음 자리가 좋아요',
    room: '세기 여유가 넓어요 — 조금 세거나 약해도 자리가 나와요', likelier: '성공 확률이 더 높아요' }[w.k] || '';
}
// an other way's name: how it is played, on which ball (short: a chip's - 가까운 빨강 · 스톱)
function rvAltName(a, short) {
  if (short && game.mode.table === 'carom') { const n = rvBall(a.d && a.d.first).replace(/ 공$/, '').replace('빨간', '빨강').replace('노란', '노랑').replace(/^흰$/, '흰 공');
    return a.way === 'kick' ? `빈쿠션 → ${n}` : a.way === 'safety' ? `${n} 수비` : `${n} · ${RV_WAY[a.way]}`; }
  if (a.way === 'safety') return `${rvJ(rvBall(a.id), '을', '를')} 얇게 맞히는 수비`;
  if (game.mode.table === 'carom') return a.way === 'kick' ? `빈쿠션 → ${rvBall(a.d && a.d.first)}` : `${rvBall(a.d && a.d.first)}부터 · ${RV_WAY[a.way]}`;
  return a.way === 'combo' ? `${rvJ(rvBall(a.via), '으로', '로')} ${rvBall(a.id)} 콤비` : `${rvBall(a.id)} · ${RV_WAY[a.way]}`;
}
// an other way told (owner 11-18: the words of how it is played go here): what it does, what it leaves, and why it beats
// the shot played
function rvAltStory(a) {
  const d = a.d || {}, why = (a.why || []).map(w => rvWhy(w, a)).filter(Boolean);
  return { how: [rvStory(d), a.way === 'safety' ? '상대에게 칠 공을 남기지 않아요.' : game.mode.table === 'carom' ? '' : rvNext(a.next, true)].filter(Boolean).join(' '), why };
}
