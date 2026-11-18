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
    const pre = d.pre ? `쿠션 ${d.pre}번을 먼저 돌아 ` : '';
    const second = d.second != null ? `${d.cushions ? `쿠션 ${d.cushions}번을 돌아` : '곧바로'} ${rvJ(rvBall(d.second), '을', '를')} 맞혔어요` : '둘째 공에는 닿지 못했어요';
    const short = game.modeId === 'three' && d.second != null && d.cushions < 3 ? ` 쿠션이 ${d.cushions ? d.cushions + '번뿐' : '하나도 없어'} 득점이 되지 않았어요.` : '';
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
  return r.grade <= 1 ? '좋은 수비입니다' : r.grade === 2 ? '무난합니다' : r.grade === 3 ? '아쉽습니다' : '실수입니다';
}
function reviewWords(q) {
  const r = q.res, d = r.d || {}, carom = r.game === 'four' || r.game === 'three', say = []; rvAt = q.snap || null;
  if (r.foul) {
    say.push({ scratch: '수구가 포켓에 빠졌어요.', wrong: carom ? '상대 공을 맞혔어요.' : `먼저 맞혀야 할 공이 아닌 ${rvJ(rvBall(d.first), '을', '를')} 맞혔어요.`, nohit: '공을 하나도 맞히지 못했어요.',
      norail: '맞힌 뒤 쿠션에 닿은 공이 없었어요.', off: '공이 테이블 밖으로 나갔어요.' }[r.cause] || '파울이 났어요.');
    if (r.cause === 'scratch' || r.cause === 'norail' || r.cause === 'off') say.push(rvStory(d));
  } else if (r.made) {
    say.push(rvStory(d));
    if (r.fluke) say.push(`노린 길이 아니라 ${carom ? '키스' : '다른 공'} 덕분이에요. 다시 치면 나오기 어려운 결과예요.`);
    else if (r.won) say.push('경기를 끝내는 샷이에요.');
    else if (carom) say.push(r.practical ? '다음 득점도 노리기 좋은 배치를 남겼어요.' : '득점은 했지만 공들이 흩어져 다음 배치가 어려워요.');
    else say.push(rvNext(r.next, r.practical));
    if (r.grade === 0) say.push(r.p != null && r.p < 0.2 ? '열에 두 번도 나오기 힘든 샷을 해냈어요.' : '어려운 샷을 성공하고 다음까지 세웠어요.');
  } else {
    say.push(rvStory(d, r.meant));
    const md = r.md;
    if (r.meant && md && md.first != null && md.first !== d.first) {
      // (the nearest way in was another ball: say so, not a thickness on a ball not met)
      say.push(`조준을 조금만 옮겼으면 ${rvJ(rvBall(md.first), '을', '를')} ${carom ? rvMet(md) + ' 맞혀 득점할' : rvMet(md) + ' 넣을'} 수 있었어요.`);
    } else if (r.meant && md && md.first != null) {
      const ball = rvJ(rvBall(md.first), '을', '를'), mc = Math.abs(md.cut || 0), pc = Math.abs(d.cut || 0);
      const want = carom ? `${ball} ${rvMet(md)} 맞혀야 했는데` : mc < 3 ? `${ball} 정면으로 맞혀야 했는데` : `${ball} ${mc}° 깎아야 했는데`;
      const got = w => carom ? (rvMet(d) === rvMet(md) ? `아주 조금 ${w === '얇았' ? '얇게' : '두껍게'} 맞았어요` : `${rvMet(d)} 맞아 ${w}어요`) : Math.abs(pc - mc) < 2 ? `아주 조금 ${w === '얇았' ? '얇게' : '두껍게'} 맞았어요 — 1°도 안 되는 차이예요` : `${pc}°로 ${w === '얇았' ? '얇게' : '두껍게'} 맞았어요`;
      say.push({ thin: `${want} ${got('얇았')}.`, thick: `${want} ${got('두꺼웠')}.`, soft: '길은 맞았는데 세기가 모자랐어요.', hard: '길은 맞았는데 세기가 넘쳤어요.',
        tip: '회전이 수구의 길을 틀었어요. 당점을 가운데로 두면 들어가는 공이었어요.' }[r.cause] || `${want} 조금 빗나갔어요.`);
      if (r.p != null) say.push(r.p >= 0.8 ? (carom ? '쳐야 하는 공이었어요.' : '넣어야 하는 공이었어요.') : r.p < 0.35 ? '원래 어려운 샷이었어요.' : '');
    } else if (r.grade <= 1) say.push('상대에게 칠 공을 남기지 않았어요.');
    else say.push(`${carom ? '득점' : '넣을'} 길과는 거리가 있는 샷이었어요.`);
  }
  // the best other way, in a word, when it was not this one (the chips below show them all)
  const best = (r.alts || []).find(a => a.best);
  if (best && r.grade >= 2) say.push(`추천: ${rvAltName(best)}.`);
  return { title: rvTitle(r), text: say.filter(Boolean).join(' ') };
}
// an other way's name: how it is played, on which ball (short: a chip's - 가까운 빨강 · 스톱)
function rvAltName(a, short) {
  if (short && game.mode.table === 'carom') { const n = rvBall(a.d && a.d.first).replace(/ 공$/, '').replace('빨간', '빨강').replace('노란', '노랑').replace(/^흰$/, '흰 공');
    return a.way === 'kick' ? `빈쿠션 → ${n}` : a.way === 'safety' ? `${n} 수비` : `${n} · ${RV_WAY[a.way]}`; }
  if (a.way === 'safety') return `${rvJ(rvBall(a.id), '을', '를')} 얇게 맞히는 수비`;
  if (game.mode.table === 'carom') return a.way === 'kick' ? `빈쿠션 → ${rvBall(a.d && a.d.first)}` : `${rvBall(a.d && a.d.first)}부터 · ${RV_WAY[a.way]}`;
  return a.way === 'combo' ? `${rvJ(rvBall(a.via), '으로', '로')} ${rvBall(a.id)} 콤비` : `${rvBall(a.id)} · ${RV_WAY[a.way]}`;
}
// an other way told: what it does and what it leaves
function rvAltStory(a) {
  const d = a.d || {};
  return [rvStory(d), a.way === 'safety' ? '상대에게 칠 공을 남기지 않아요.' : game.mode.table === 'carom' ? '' : rvNext(a.next, true)].filter(Boolean).join(' ');
}
