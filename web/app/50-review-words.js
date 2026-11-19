/* What the review's coach says of one shot (50-review.js), as a chess engine's commentary does (owner 11-18, Komodo:
   "정확합니다, 좋은 끌어치기였어요" - say what the shot meant and what it did, never a line that would fit any shot).
   Read from what the judge found (ai/60-judge.js judgeShot): the shot's own story (d - the ball met first and how thick or
   at what cut, the balls potted and where, the cushions, the tip, the pace, the cue raised), what it left (next - the ball
   the next shot would go for), the line meant when it missed (md) and why it missed, a foul and which, a fluke; and the
   other ways (alts), each told the same way. Degrees, thickness, tip and pace are told; the judge's scores never are
   (owner 11-17). A pocket is named by its kind only (코너 / 사이드): the board shows which, turned as the screen is. */
const RV_WAY = { masse: '맛세이', jump: '점프샷', stun: '스톱', follow: '밀어치기', draw: '끌어치기', side: '회전 이용', kick: '원쿠션', bank: '뱅크샷', combo: '콤비', safety: '수비' };
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
  // (the raised cue's own names first, as the aim line gives them: 점프샷, 맛세이, 커브샷 - 11-19)
  if (d.raised === 'masse' || d.raised === 'curve') return d.raised === 'masse' ? '맛세이' : '커브샷';
  const parts = d.raised === 'jump' ? ['점프샷'] : [];
  if (d.el >= 15 && !d.raised) parts.push('찍어치기');
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
  const pot = d.potted.find(([id]) => id !== 0), scratch = d.potted.some(([id]) => id === 0), met = rvMet(d), hit = met === '정면으로' ? '정면으로 맞혀' : met || '맞혀';
  const went = pot ? (pot[0] === d.first ? `${hit} ${rvPocket(pot[1])}에 넣었어요` : `${hit} ${rvJ(rvBall(pot[0]), '이', '가')} ${rvPocket(pot[1])}에 들어갔어요`)
    : missed ? `${met === '정면으로' ? '정면으로 맞혔지만' : met ? met + ' 쳤지만' : '맞혔지만'} 포켓을 벗어났어요` : `${met ? met + ' ' : ''}맞혔어요`;
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
/* The coach's card (owner 11-19 noon: '가독성' - not 의도 · 결과 · 원인 in rows): the grade and what the shot was, in one
   line ("아쉽습니다. 길은 맞았는데 두껍게 맞았어요."), one or two sentences under it on how it went, and a button to the
   shot worth seeing - the shot as it should have been played (교정한 샷), an easier way (쉬운 샷), the best one (추천 샷).
   Read as a commentator reads a game - the rules too (owner): a shot that ends the game has no next ball to set; a miss
   leaves the table to the other player, so what it left them is part of it. And not the same words twice over a game
   (as Valve's dialogue - Left 4 Dead's: the most particular situation that fits speaks first, each with several ways of
   saying it, and what has been said is remembered): each situation has a few lines, taken in turn through the game. */
const RV_WORD = ['예술적입니다', '좋습니다', '무난합니다', '아쉽습니다', '실수입니다'];
// the lines, by situation - {n} a count, {s} the stroke's name, {b} a ball
const RV_HEAD = {
  wonArt: ['어려운 공으로 판을 끝냈어요.', '마지막 한 점을 이렇게 가져가네요.', '끝내기에 이보다 멋진 샷은 없어요.'],
  won: ['깔끔하게 마무리했어요.', '흔들림 없이 판을 끝냈어요.', '마지막 공을 놓치지 않았어요.', '끝내야 할 때 끝냈어요.'],
  wonRaised: ['{s} 판을 끝냈어요.', '마지막 공을 {s} 가져갔어요.'],
  masseArt: ['맛세이로 막힌 길을 열었어요.', '휘어 들어가는 그림 같은 샷이었어요.', '휘는 길을 끝까지 읽었어요.'],
  masse: ['맛세이로 길을 만들었어요.', '휘는 공을 정확히 읽었어요.', '맛세이가 제대로 먹혔어요.'],
  jump: ['점프샷으로 없는 길을 만들어냈어요.', '가로막은 공을 훌쩍 넘었어요.', '넘어가는 길을 봤어요.'],
  curve: ['살짝 휘는 공으로 길을 열었어요.', '커브로 가로막은 공을 비켜 갔어요.'],
  art: ['쉽지 않은 길을 뚫고 다음 공까지 세웠어요.', '어려운 공을 넣고 자리까지 잡았어요.', '이 배치에서 나올 수 있는 최고의 샷이에요.', '보는 사람이 감탄할 샷이에요.'],
  artCarom: ['어려운 길로 득점하고 공까지 모았어요.', '쉽지 않은 길을 끝까지 그려 냈어요.', '이 배치에서 나올 수 있는 최고의 샷이에요.'],
  streak: ['{n}연속 득점, 흐름을 탔어요.', '리듬이 좋아요. 벌써 {n}번째예요.', '멈추지 않네요. {n}연속이에요.', '손이 풀렸어요. {n}번 연속이에요.'],
  chance: ['상대가 준 기회를 놓치지 않았어요.', '상대의 실수를 바로 점수로 바꿨어요.', '찾아온 기회를 단번에 잡았어요.', '틈을 놓치지 않았어요.'],
  close: ['이제 한 점 남았어요.', '끝이 보여요. 한 점만 더.'],
  comeback: ['따라붙었어요.', '추격의 한 점이에요.'],
  good: ['넣고 다음 공까지 챙겼어요.', '득점도 자리도 모두 잡았어요.', '교과서 같은 샷이에요.', '다음 샷이 편해졌어요.', '군더더기 없는 샷이에요.'],
  goodCarom: ['득점하고 다음 배치도 좋아요.', '점수도 내고 공도 모아 뒀어요.', '다음 공이 잘 보이는 자리예요.', '깔끔한 득점이에요.'],
  okMade: ['넣었지만 수구가 원하는 곳에 서지 못했어요.', '넣긴 했는데 다음 공이 어려워졌어요.', '공은 들어갔는데 자리가 아쉬워요.'],
  okMadeCarom: ['득점은 했지만 다음 배치가 꼬였어요.', '점수는 났는데 공이 흩어졌어요.', '득점했지만 다음이 어려워요.'],
  fluke: ['운이 따랐어요.', '들어가긴 했는데, 노린 길은 아니었어요.'],
  safetyGood: ['상대에게 칠 공을 남기지 않았어요.', '영리한 수비예요.', '공을 떼어 놓아 상대를 묶었어요.'],
  safetyOk: ['수비는 됐지만 틈이 남았어요.', '막긴 했는데 상대에게 길이 하나 남았어요.'],
  thick: ['길은 맞았는데 두껍게 맞았어요.', '조준이 살짝 두꺼웠어요.', '한 끗 두꺼웠어요.'],
  thin: ['길은 맞았는데 얇게 맞았어요.', '조준이 살짝 얇았어요.', '한 끗 얇았어요.'],
  soft: ['길은 맞았는데 세기가 모자랐어요.', '한 뼘이 모자랐어요.', '공이 끝까지 가지 못했어요.'],
  hard: ['길은 맞았는데 세기가 넘쳤어요.', '조금만 살살 쳤으면 됐어요.'],
  tip: ['회전이 공의 길을 틀었어요.', '당점이 길을 비틀었어요.'],
  masseMore: ['맛세이가 덜 휘었어요.', '조금 더 휘었어야 했어요.'],
  masseLess: ['맛세이가 너무 휘었어요.', '휘는 양이 넘쳤어요.'],
  jumpMiss: ['점프는 좋았는데 길이 어긋났어요.', '넘기는 됐는데 맞는 자리가 빗나갔어요.'],
  hardMiss: ['원래 어려운 공이었어요.', '쉽지 않은 공이었어요.', '누구에게나 어려운 공이에요.'],
  easyMiss: ['넣어야 하는 공을 놓쳤어요.', '쉬운 공이었어요.', '놓치면 안 되는 공이었어요.'],
  easyMissCarom: ['쳐야 하는 공을 놓쳤어요.', '쉬운 배치였어요.', '놓치면 안 되는 배치였어요.'],
  chanceMiss: ['상대가 준 기회를 살리지 못했어요.', '모처럼 온 기회를 놓쳤어요.'],
  choice: ['더 쉬운 길이 있었어요.', '길 선택이 어려웠어요.', '굳이 어려운 길을 골랐어요.'],
  none: ['노린 길이 잘 보이지 않는 샷이었어요.', '득점과는 거리가 먼 샷이었어요.'],
  scratch: ['수구가 포켓에 빠졌어요.'], wrong: ['먼저 맞혀야 할 공을 놓쳤어요.'], wrongCarom: ['상대 공에 닿았어요.', '수구가 상대 공을 건드렸어요.'], nohit: ['공을 하나도 맞히지 못했어요.'],
  norail: ['맞힌 뒤 쿠션에 닿은 공이 없었어요.'], off: ['공이 테이블 밖으로 나갔어요.'], foul: ['파울이 났어요.'],
  lostGame: ['이 샷으로 판이 끝났어요.'],
};
// (a line's variants, taken in turn through the game: the n-th time a situation comes up, its n-th line)
const rvHash = k => { let h = 7; for (const c of k) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
// the game's story up to a shot: this player's run of points before it, what the other's shot before left, the score
function rvContext(q) {
  const L = typeof review !== 'undefined' ? review.list : [q], i = L.indexOf(q), me = q.turn;
  let streak = 0; for (let k = i - 1; k >= 0 && L[k].turn === me; k--) { const r = L[k].res; if (r && r.made && !r.foul) streak++; else break; }
  const prev = i > 0 ? L[i - 1] : null, pr = prev && prev.turn !== me ? prev.res : null;
  // (the other's shot before: a miss that left this one an easy table - a chance given)
  const given = !!(pr && pr.grade != null && pr.grade >= 3 && !pr.made && pr.leave >= 0.9);
  const sc = q.sc || null, tg = q.tg || null, left = sc && tg ? tg[me] - sc[me] : null, behind = sc ? sc[me] < sc[1 - me] : false;
  return { L, i, streak, given, left, behind, last: !!q.last };
}
// which situation a shot is, most particular first (also how far the turn of its lines has gone: rvSay)
function rvKey(q) {
  const r = q.res || {}, d = r.d || {}, carom = r.game === 'four' || r.game === 'three', c = rvContext(q), raised = d.raised;
  if (r.foul) return r.lost ? 'lostGame' : r.cause === 'wrong' && carom ? 'wrongCarom' : r.cause || 'foul';
  if (r.made) {
    if (r.fluke) return 'fluke';
    if (r.won) return raised ? 'wonRaised' : r.grade === 0 ? 'wonArt' : 'won';
    if (raised === 'jump') return 'jump';
    if (raised === 'masse') return r.grade === 0 ? 'masseArt' : r.grade === 1 ? 'masse' : carom ? 'okMadeCarom' : 'okMade';
    if (raised === 'curve' && r.grade <= 1) return 'curve';
    if (r.grade === 0) return carom ? 'artCarom' : 'art';
    if (r.grade === 1) return c.given ? 'chance' : c.streak >= 2 ? 'streak' : c.left === 1 && !c.last ? 'close' : c.behind && c.left != null && c.left <= 3 ? 'comeback' : carom ? 'goodCarom' : 'good';
    return carom ? 'okMadeCarom' : 'okMade';
  }
  if (r.intent && r.intent.kind === 'safety' || !r.meant && r.grade <= 1) return r.grade <= 1 ? 'safetyGood' : 'safetyOk';
  if (r.lost) return 'lostGame';
  const b = r.better, choiceBad = b && !b.same && b.easier && r.grade >= 3;
  if (choiceBad || !r.meant && b && r.grade >= 3) return r.meant || b ? 'choice' : 'none';
  if (!r.meant) return 'none';
  if (c.given && r.p != null && r.p >= 0.6) return 'chanceMiss';
  if (r.p != null && r.p >= 0.8 && r.grade >= 3) return carom ? 'easyMissCarom' : 'easyMiss';
  if (raised === 'masse' || raised === 'curve') return r.offDeg == null ? 'hardMiss' : (r.offDeg > 0) === ((d.a || 0) > 0) ? 'masseLess' : 'masseMore';
  if (raised === 'jump') return 'jumpMiss';
  if (r.p != null && r.p < 0.35 && r.grade <= 2) return 'hardMiss';
  return r.cause && RV_HEAD[r.cause] ? r.cause : 'hardMiss';
}
function rvSay(q, key, vars) {
  const c = rvContext(q); let n = 0;
  for (let k = 0; k < c.i; k++) { const o = c.L[k]; if (o.res && o.res.grade != null && rvKey(o) === key) n++; }
  const list = RV_HEAD[key] || RV_HEAD.none, t = list[(rvHash(key) + n) % list.length];
  return t.replace(/\{(\w)\}/g, (m, k) => vars[k] != null ? vars[k] : '');
}
// a stroke's name with its particle (맛세이로 · 점프샷으로)
const rvWith = s => rvJ(s, '으로', '로');
/* How it went, short: the way the ball went (carom: the first ball, how thick, the cushions, the second; pool: the ball,
   the cut, the pocket) - one sentence */
function rvLine(d, carom) {
  if (!d || d.first == null) return '';
  const s = rvStroke(d), lead = s === '스톱' || s === '무회전' ? '' : rvWith(s) + ' ', met = rvMet(d), first = rvBall(d.first);
  if (carom) {
    const rt = d.route || {}, rails = rt.rails || (d.cushions ? `쿠션 ${['', '하나', '둘', '셋', '넷', '다섯'][d.cushions] || d.cushions + '개'}` : '');
    if (d.second == null) return `${lead}${rvJ(first, '을', '를')}${met ? ' ' + met : ''} 맞혔지만 둘째 공에 닿지 못했어요.`;
    return `${lead}${rvJ(first, '을', '를')}${met ? ' ' + met : ''} 맞히고 ${rails ? rails + '을 돌아' : '곧바로'} ${rvBall(d.second)}까지.`.replace(/\s+/g, ' ');
  }
  const pot = (d.potted || []).find(([id]) => id !== 0);
  return pot ? `${lead}${rvJ(rvBall(pot[0]), '을', '를')}${met && met !== '정면으로' ? ' ' + met : ''} ${rvPocket(pot[1])}에.`.replace(/\s+/g, ' ')
    : `${lead}${rvJ(first, '을', '를')}${met ? ' ' + met : ''} 맞혔어요.`.replace(/\s+/g, ' ');
}
// the sentences under the line: what went right, or what was off and by how much; then - the table being the other's
// after a miss - what it left them
function rvBody(q, key) {
  const r = q.res, d = r.d || {}, md = r.md, carom = r.game === 'four' || r.game === 'three', sh = r.intent && r.intent.shape, out = [];
  const nb = x => x && x.next ? rvBall(x.next.id) : null;
  if (key === 'lostGame') {
    const eight = !carom && (d.potted || []).some(([id]) => id === 8);
    out.push(eight ? '8번 공이 들어가면서 판을 내줬어요.' : r.cause === 'scratch' ? '수구가 빠지면서 판을 내줬어요.' : '이 샷의 파울로 판을 내줬어요.');
    return out;
  }
  if (r.foul) {
    const pot = (d.potted || []).find(([id]) => id !== 0);
    if (r.cause === 'scratch') out.push(pot ? `${rvJ(rvBall(pot[0]), '은', '는')} 들어갔지만 수구도 따라 빠졌어요.` : '수구만 포켓으로 들어갔어요.', r.facts && r.facts.scratch >= 0.25 ? '이 세기와 당점이면 수구가 포켓으로 가기 쉬운 길이었어요.' : '');
    else if (r.cause === 'wrong' && !carom) { if (d.first != null) out.push(`${rvJ(rvBall(d.first), '이', '가')} 먼저 맞았어요.`); }
    else if (r.cause === 'wrong' && carom) out.push(d.first != null && d.first < 2 ? `${rvJ(rvBall(d.first), '을', '를')} 먼저 맞혔어요.` : '빨간 공 다음에 상대 공이 맞았어요.');
    else if (d.first != null) out.push(rvLine(d, carom));
    if (r.leave >= 0.9) out.push(game.mode.ballInHand ? '상대는 수구를 원하는 곳에 놓고 쳐요.' : '상대에게 좋은 배치가 넘어갔어요.');
    return out;
  }
  if (r.made) {
    if (key === 'fluke') { out.push(`${carom ? '키스' : '다른 공'} 덕분이에요. 다시 치면 나오기 어려워요.`); return out; }
    out.push(rvLine(d, carom));
    // (the game won: nothing after it to set up)
    if (r.won) return out;
    if (!r.practical && sh) {
      if (sh.dir && sh.best) out.push(`세기를 ${sh.dir === 'short' ? '조금 더' : '조금 덜'} 줬으면 ${nb(sh.best) ? rvJ(nb(sh.best), '을', '를') + ' 치기 좋은 자리' : '좋은 자리'}였어요.`);
      else if (!carom) out.push('이 스트로크로는 세기를 바꿔도 좋은 자리가 나오지 않아요 — 당점이나 길을 바꿔야 했어요.');
    } else if (!r.practical && carom) out.push('공들이 흩어져 다음 배치가 어려워요.');
    else if (!carom && sh && sh.own && sh.own.next && r.grade <= 1) out.push(`수구는 ${rvJ(rvBall(sh.own.next.id), '을', '를')} 치기 좋은 자리에 섰어요.`);
    return out;
  }
  // a miss
  if (key === 'safetyGood' || key === 'safetyOk') { if (d.first != null) out.push(rvLine(d, carom)); return out; }
  if (key === 'choice' || key === 'none') {
    const e = (r.alts || []).find(a => a.easiest) || (r.alts || []).find(a => a.best);
    if (r.meant) out.push(r.p != null && r.p < 0.35 ? '선택한 길은 성공 확률이 낮았어요.' : '선택한 길보다 확실한 길이 있었어요.');
    if (e) out.push(`${rvJ(rvAltProse(e), '이', '가')} 훨씬 쉬웠어요.`);
  } else if (md) {
    const need = carom ? rvMetShort(md) : Math.abs(md.cut || 0) < 3 ? '정면' : `${Math.abs(md.cut)}°`, got = carom ? rvMetShort(d) : Math.abs(d.cut || 0) < 3 ? '정면' : `${Math.abs(d.cut || 0)}°`;
    if (key === 'masseMore' || key === 'masseLess' || key === 'jumpMiss') {
      const deg = r.offDeg == null ? null : Math.abs(r.offDeg);
      out.push(key === 'masseMore' ? `큐를 조금 더 세우거나 당점을 바깥으로${deg != null ? `, 아니면 조준을 ${deg < 0.2 ? '아주 조금' : deg.toFixed(1) + '°'} ${r.offDeg > 0 ? '왼쪽' : '오른쪽'}으로` : ''}.`
        : key === 'masseLess' ? `큐를 조금 눕히거나 당점을 안쪽으로${deg != null ? `, 아니면 조준을 ${deg < 0.2 ? '아주 조금' : deg.toFixed(1) + '°'} ${r.offDeg > 0 ? '왼쪽' : '오른쪽'}으로` : ''}.`
        : `조준을 ${deg == null || deg < 0.2 ? '아주 조금' : deg.toFixed(1) + '°'} ${r.offDeg > 0 ? '왼쪽' : '오른쪽'}으로 옮기면 맞는 길이었어요.`);
    } else if (r.cause === 'soft' || r.cause === 'hard') { const a = Math.round((md.pace || 0) * 100), b = Math.round((d.pace || 0) * 100);
      out.push(pick2(q, [`세기 ${a}%쯤이 맞았어요 — 이번엔 ${b}%.`, `${b}%로 쳤는데 ${a}%는 필요했어요.`, `세기를 ${b}%에서 ${a}%로 ${a > b ? '올리면' : '내리면'} 들어가요.`])); }
    else if (r.cause === 'tip') out.push('당점을 가운데로 두면 들어가는 공이었어요.');
    else if (need && got && need !== got) out.push(need === '정면' ? `정면으로 맞혀야 했는데 ${rvJ(got, '으로', '로')} 맞았어요.` : `${carom ? '두께' : '각'} ${rvJ(need, '이', '가')} 필요했는데 ${got === '정면' ? '정면으로' : rvJ(got, '으로', '로')} 맞았어요.`);
    else if (r.cause === 'thick' || r.cause === 'thin') out.push(`${carom ? '두께' : '각'}가 ${r.grade >= 4 ? '조금' : '아주 조금'} ${r.cause === 'thick' ? '두꺼웠어요' : '얇았어요'}.`);
    else out.push(rvLine(d, carom));
    // (the why of it - a thin hit turns the cue ball less - said the first time in a game, not every time)
    if (carom && (r.cause === 'thick' || r.cause === 'thin') && !/masse|jump/.test(key) && !rvSaidBefore(q, o => o.res && o.res.cause === r.cause && !o.res.made)) out.push(r.cause === 'thin' ? '얇으면 수구가 덜 꺾여요.' : '두꺼우면 수구가 더 꺾여요.');
  } else if (d.first != null) out.push(rvLine(d, carom));
  // (the table is the other's now: what it was left - said when it matters)
  // (an ordinary leave is high for the reference hand - what counts is one well below or near the top, by the game's own run)
  const safeAt = r.game === 'three' ? 0.3 : 0.5;
  if (r.leave != null && !r.lost) {
    if (r.leave <= safeAt && key !== 'none') out.push(pick2(q, ['다행히 상대에게 남긴 공은 어려워요.', '그래도 상대에게 쉬운 공은 주지 않았어요.']));
    else if (r.leave >= 0.9) out.push(pick2(q, ['게다가 상대에게 쉬운 공을 남겼어요.', '상대에게 좋은 배치를 넘겨줬어요.']));
  }
  return out;
}
const pick2 = (q, a) => a[(q.n || 0) % a.length];
// (something said for an earlier shot of this game)
const rvSaidBefore = (q, f) => { const c = rvContext(q); for (let k = 0; k < c.i; k++) if (f(c.L[k])) return true; return false; };
// an other way in a sentence: '노란 공을 먼저 맞히는 밀어치기', '빈쿠션으로 빨간 공부터 치는 길', '3번 공을 코너 포켓에 넣는 길'
function rvAltProse(a) {
  const carom = game.mode.table === 'carom', way = RV_WAY[a.way] || '길';
  if (a.way === 'safety') return `${rvJ(rvBall(carom ? a.d && a.d.first : a.id), '을', '를')} 얇게 맞히는 수비`;
  if (carom) return a.way === 'kick' ? `빈쿠션으로 ${rvBall(a.d && a.d.first)}부터 치는 길` : `${rvJ(rvBall(a.d && a.d.first), '을', '를')} 먼저 맞히는 ${way}`;
  if (a.way === 'combo') return `${rvJ(rvBall(a.via), '으로', '로')} ${rvJ(rvBall(a.id), '을', '를')} 넣는 콤비`;
  return `${rvJ(rvBall(a.id), '을', '를')} ${rvPocket(a.pocket)}에 넣는 ${a.way === 'stun' || a.way === 'follow' || a.way === 'draw' ? way : '길'}`;
}
// the button under the words: the one shot most worth seeing next
function rvAction(q, key) {
  const r = q.res, alts = r.alts || [], idx = f => alts.findIndex(f), best = idx(a => a.best), easy = idx(a => a.easiest);
  if (!r.made && !r.foul && r.fix && /thick|thin|soft|hard|tip|aim|masse|jump|easyMiss|chanceMiss|hardMiss/.test(key)) return { label: '교정한 샷 보기', alt: 'fix' };
  if ((key === 'choice' || key === 'none') && easy >= 0) return { label: '쉬운 샷 보기', alt: easy };
  if ((key === 'safetyOk' || r.foul || r.grade >= 2) && best >= 0) return { label: alts[best].kind === 'safety' ? '수비 보기' : '추천 샷 보기', alt: best };
  return null;
}
/* The card's words for one shot: the grade's word and the line (title), the sentences under it, the button */
function reviewWords(q) {
  const r = q.res, d = r.d || {}; rvAt = q.snap || null;
  const key = rvKey(q), c = rvContext(q), s = d.raised === 'masse' ? '맛세이' : d.raised === 'jump' ? '점프샷' : d.raised === 'curve' ? '커브샷' : '';
  const head = rvSay(q, key, { n: c.streak + 1, s: s ? rvWith(s) : '' });
  const word = RV_WORD[r.grade] || '';
  return { word, head, title: `${word}. ${head}`, body: rvBody(q, key).filter(Boolean), act: rvAction(q, key), key };
}
const rvCm = cm => cm >= 100 ? `${(cm / 100).toFixed(1)}m` : `${Math.max(5, Math.round(cm / 5) * 5)}cm`;
// how hard a line was, by its facts: '70° 컷, 1.7m' (pool) / '1/8 두께' (carom)
function rvHard(F) {
  if (F.raised === 'masse' || F.raised === 'jump') return F.raised === 'masse' ? '맛세이' : '점프샷';
  if (F.cut != null) { const parts = []; if (F.cut >= 25) parts.push(`${F.cut}° 컷`); if ((F.dist || 0) + (F.run || 0) >= 1.6) parts.push(`${((F.dist || 0) + (F.run || 0)).toFixed(1)}m 거리`); if (F.bank) parts.push('뱅크'); if (F.tight) parts.push('붙어 있는 공'); return parts.length ? parts.join(', ') : '그 공'; }
  return F.route && F.route.rails ? `${F.route.rails} 길` : '그 길';
}
// a reason another way was better, in words (62-intent.js whyBetter)
function rvWhy(w, a) {
  const carom = game.mode.table === 'carom';
  return { safety: '상대에게 칠 공을 남기지 않아요', cut: `깎는 각이 ${w.by}° 작아요`, near: '공 사이 거리가 짧아요', clear: '길을 가로막는 공이 없어요', scratch: '스크래치 위험이 없어요',
    breaks: `뭉친 ${(w.ids || []).map(id => rvBall(id).replace(/ 공$/, '')).join('·')} 공을 함께 풀어요`,
    pos: carom ? '다음 배치가 좋아요' : w.next ? `수구가 ${rvJ(rvBall(w.next.id), '을', '를')} 넣기 좋은 자리로 와요` : '다음 자리가 좋아요',
    room: '세기 여유가 넓어요 — 조금 세거나 약해도 자리가 나와요', likelier: '성공 확률이 더 높아요',
    over: '가로막는 공을 넘어가요', around: carom ? '휘어 들어가 두 공을 이어요' : '가로막는 공을 돌아 들어가요' }[w.k] || '';
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
