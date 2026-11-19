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
  if (!next) return good ? '' : '다음에 칠 공이 마땅치 않은 자리입니다.';
  return good ? `수구가 다음 ${rvJ(rvBall(next.id), '을', '를')} 넣기 좋은 자리에 섭니다.` : `다음 ${rvJ(rvBall(next.id), '이', '가')} 어려운 자리에 섰습니다.`;
}
/* The coach's card (owner 11-19: '가독성', and the house style - docs: CUE 샷 리뷰 문장 예시): the shot named and graded in
   one line ("끌어치기는 예술적입니다.", "빗겨치기에 행운이 따랐습니다."), a sentence under it on what it did - what it met,
   what it left, what was off and what would have done it, joined as a person speaks (-고, -는데, -지만, -면서, -니) - and
   now and then one more on why, the kind a player keeps (a thin hit turns the cue ball less). Then a button to the shot
   worth seeing - the shot as it should have been played (교정한 샷), an easier way (쉬운 샷), the best one (추천 샷).
   Read as a commentator reads a game - the rules too: a shot that ends the game has no next ball to set; a miss leaves the
   table to the other player, so what it left them is part of it. And not the same words twice over a game (as Valve's
   dialogue: the most particular situation that fits speaks first, each with several ways of saying it, taken in turn). */
const RV_WORD = ['예술적입니다', '좋습니다', '무난합니다', '아쉽습니다', '실수입니다'];
// the shot's name, as players say it (the guide's: 끌어치기, 빗겨치기, 투쿠션, 빈쿠션 쓰리쿠션, 얇은 커트, 콤비네이션 ...)
function rvShotName(q) {
  // (a miss is named by the line it meant - what the player was playing - when the judge found it)
  const r = q.res, played = r.d || {}, d = !r.made && !r.foul && r.md ? { ...r.md, raised: played.raised } : played, carom = r.game === 'four' || r.game === 'three', pool = !carom;
  if (d.raised === 'masse') return '맛세이'; if (d.raised === 'jump') return '점프샷'; if (d.raised === 'curve') return '커브샷';
  if (r.intent && r.intent.kind === 'safety') return '수비 샷';
  if (q.last || (r.won || r.lost) && pool) return carom && r.game === 'three' ? '쓰리쿠션 마무리' : '마무리 샷';
  if (r.game === 'three' && q.n === 1) return '초구';
  const draw = d.b <= -0.25, follow = d.b >= 0.25, side = Math.abs(d.a || 0) >= 0.2;
  if (carom) {
    const rt = d.route || {};
    if (d.pre) return r.game === 'three' ? '빈쿠션 쓰리쿠션' : '빈쿠션';
    if (rt.name === '대회전') return '대회전';
    if (r.won && r.game === 'three') return '쓰리쿠션 마무리';
    const c = d.cushions || 0, t = d.thick;
    if (r.game === 'three') return c >= 3 ? (t != null && t < 0.3 ? '빗겨치기' : side && t != null && t >= 0.4 ? '옆돌리기' : '쓰리쿠션') : '쓰리쿠션';
    if (c === 1) return '원쿠션'; if (c === 2) return '투쿠션'; if (c >= 3) return '쓰리쿠션';
    return draw ? '끌어치기' : follow ? '밀어치기' : t != null && t < 0.3 ? '빗겨치기' : side ? '옆돌리기' : '직접 샷';
  }
  const pot = (d.potted || []).find(([id]) => id !== 0), F = r.facts || {}, tgt = r.intent && r.intent.target;
  if (tgt && tgt.via != null || r.made && pot && d.first != null && pot[0] !== d.first) return '콤비네이션';
  if (F.bank) return '뱅크샷';
  const cut = Math.abs(d.cut || 0);
  if (cut >= 55) return '얇은 커트';
  if (cut >= 25 && (F.dist || 0) + (F.run || 0) > 1.6) return '긴 커트';
  return draw ? '끌어치기' : follow ? '밀어치기' : d.pace != null && d.pace < 0.45 && !side ? '스톱 샷' : side ? '회전 샷' : '직접 샷';
}
// (a line's variants, taken in turn through the game: the n-th time a situation comes up, its n-th line)
const rvHash = k => { let h = 7; for (const c of k) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
// the game's story up to a shot: this player's run of points before it, what the other's shot before left, the score
function rvContext(q) {
  const L = typeof review !== 'undefined' ? review.list : [q], i = L.indexOf(q), me = q.turn;
  let streak = 0; for (let k = i - 1; k >= 0 && L[k].turn === me; k--) { const r = L[k].res; if (r && r.made && !r.foul) streak++; else break; }
  const prev = i > 0 ? L[i - 1] : null, pr = prev && prev.turn !== me ? prev.res : null;
  const given = !!(pr && pr.grade != null && pr.grade >= 3 && !pr.made && pr.leave >= 0.9);
  const sc = q.sc || null, tg = q.tg || null, left = sc && tg ? tg[me] - sc[me] : null, behind = sc ? sc[me] < sc[1 - me] : false;
  return { L, i: i < 0 ? 0 : i, streak, given, left, behind, last: !!q.last };
}
// which situation a shot is, most particular first
function rvKey(q) {
  const r = q.res || {}, d = r.d || {}, carom = r.game === 'four' || r.game === 'three', c = rvContext(q), raised = d.raised;
  if (r.foul) return r.lost ? 'lostGame' : r.cause === 'wrong' && carom ? 'wrongCarom' : r.cause || 'foul';
  if (r.made) {
    if (r.fluke) return 'fluke';
    if (r.won) return r.grade === 0 ? 'wonArt' : 'won';
    // (4구 후구: the last point hands the other a visit - what it left them is the shot - owner 11-19)
    if (r.pass) return r.grade <= 1 ? 'passGood' : 'passBad';
    if (r.tie) return 'tie';
    if (raised === 'jump') return r.grade === 0 ? 'jump' : r.grade === 1 ? 'good' : 'okMade';
    if (raised === 'masse' || raised === 'curve') return r.grade === 0 ? 'masse' : r.grade === 1 ? 'good' : 'okMade';
    if (r.grade === 0) return 'art';
    if (r.grade === 1) return 'good';
    return 'okMade';
  }
  if (r.intent && r.intent.kind === 'safety' || !r.meant && r.grade <= 1) return r.grade <= 1 ? 'safetyGood' : r.grade === 2 ? 'safetyOk' : 'safetyBad';
  if (r.lost && r.foul) return 'lostGame';
  const b = r.better, choiceBad = b && !b.same && b.easier && r.grade >= 3;
  if (choiceBad || !r.meant && b && r.grade >= 3) return r.meant || b ? 'choice' : 'none';
  if (!r.meant) return 'none';
  if (c.given && r.p != null && r.p >= 0.6) return 'chanceMiss';
  if (raised === 'masse' || raised === 'curve') return r.offDeg == null ? 'hardMiss' : (r.offDeg > 0) === ((d.a || 0) > 0) ? 'masseLess' : 'masseMore';
  if (raised === 'jump') return 'jumpMiss';
  if (r.p != null && r.p >= 0.8 && r.grade >= 3) return 'easyMiss';
  if (r.cause && /^(thick|thin|soft|hard|tip|aim)$/.test(r.cause)) return r.cause;
  return 'hardMiss';
}
// (something said for an earlier shot of this game)
const rvSaidBefore = (q, f) => { const c = rvContext(q); for (let k = 0; k < c.i; k++) if (f(c.L[k])) return true; return false; };
function rvTurn(q, key, list) {
  const c = rvContext(q); let n = 0;
  for (let k = 0; k < c.i; k++) { const o = c.L[k]; if (o.res && o.res.grade != null && rvKey(o) === key) n++; }
  return list[(rvHash(key) + n) % list.length];
}
/* What the shot did, as a clause: the verb left for the sentence to bend (-고, -면서, -니, -지만, -는데, -습니다).
   carom: what it met first and how thick, the cushions, the second ball; pool: the ball, the cut, the pocket */
const RV_VERB = { 잡: ['잡고', '잡으면서', '잡으니', '잡았'], 넣: ['넣고', '넣으면서', '넣으니', '넣었'], 맞히: ['맞히고', '맞히면서', '맞히니', '맞혔'], 닿: ['닿고', '닿으면서', '닿으니', '닿았'] };
const rvV = (v, form) => { const f = RV_VERB[v]; return form === 'go' ? f[0] : form === 'ms' ? f[1] : form === 'ni' ? f[2] : form === 'jiman' ? f[3] + '지만' : form === 'nde' ? f[3] + '는데' : form === 'gu' ? f[3] + '고' : f[3] + '습니다.'; };
function rvDid(d, carom) {
  if (!d || d.first == null) return null;
  const met = rvMet(d), first = rvBall(d.first);
  if (carom) {
    const rt = d.route || {}, rails = rt.rails ? `${rt.rails} 쿠션을 돌아` : d.cushions ? `쿠션 ${['', '하나', '둘', '셋', '넷', '다섯'][d.cushions] || d.cushions + '개'}를 돌아` : '곧바로';
    // (a cushion first - 빈쿠션: said before the ball)
    const pre = d.pre ? `쿠션을 ${d.pre === 1 ? '먼저' : ['', '', '두 번', '세 번'][d.pre] || d.pre + '번'} 맞고 ` : '';
    if (d.second == null) return { text: `${pre}${rvJ(first, '을', '를')}${met ? ' ' + met : ''}`, v: '맞히', alone: true };
    return { text: `${pre}${rvJ(first, '을', '를')}${met ? ' ' + met : ''} 맞혀 ${d.pre && !d.cushions ? '곧바로' : rails} ${rvBall(d.second)}까지`.replace(/\s+/g, ' '), v: '잡' };
  }
  const pot = (d.potted || []).find(([id]) => id !== 0);
  if (!pot) return { text: `${rvJ(first, '을', '를')}${met && met !== '정면으로' ? ' ' + met.replace(/ 깎아$/, '로') : ''}`, v: '맞히', alone: true };
  return { text: `${rvJ(rvBall(pot[0]), '을', '를')}${met && met !== '정면으로' ? ' ' + met : ''} ${rvPocket(pot[1])}에`.replace(/\s+/g, ' '), v: '넣' };
}
const rvSay = (did, form) => did ? `${did.text} ${rvV(did.v, form)}` : '';
// the stroke's next ball, when the cue ball set it up
const rvNextBall = r => { const sh = r.intent && r.intent.shape; return sh && sh.own && sh.own.next ? rvBall(sh.own.next.id) : null; };
/* The sentence under the title (owner 11-19, the house style: what the shot meant - the next shot set, a way found where
   the ordinary one was shut, the other player made to go to a cushion - not the stroke told over again, and never a word
   that would fit any shot, as '리듬이 좋습니다'). The made shot's lines are picked by what is true of it, most particular
   first, and the ones that fit taken in turn through the game. */
function rvMadeLines(q, key) {
  const r = q.res, d = r.d || {}, F = r.facts || {}, carom = r.game === 'four' || r.game === 'three', nb = rvNextBall(r), sh = r.intent && r.intent.shape;
  const pot = (d.potted || []).find(([id]) => id !== 0), ball = pot ? rvBall(pot[0]) : null, pk = pot ? rvPocket(pot[1]) : null;
  const draw = d.b <= -0.25, follow = d.b >= 0.25, side = Math.abs(d.a || 0) >= 0.2, plain = !side && !d.raised && Math.abs(d.b || 0) < 0.25;
  const thin = d.thick != null && d.thick < 0.3, c = d.cushions || 0, rails = d.route && d.route.rails ? `${d.route.rails} 쿠션` : `${['', '한', '두', '세', '네', '다섯'][c] || c} 쿠션`;
  const near = F.spread != null && F.spread < 0.6, far = F.spread != null && F.spread > 1.3, easyLine = r.p != null && r.p >= 0.7;
  const L = [];
  const nbO = nb ? rvJ(nb, '을', '를') : null;
  switch (key) {
    case 'won': case 'wonArt':
      L.push('승리는 언제나 좋습니다.');
      if (key === 'wonArt') L.unshift(d.raised === 'jump' ? '없는 길을 만들어 경기를 끝냈습니다!' : d.raised ? '정확한 곡선으로 마지막 점수를 냈습니다.' : '막힌 배치에서 길을 찾아 경기를 끝냈습니다.');
      break;
    case 'passGood':
      // (good by the best there was - but a table that gives the other a shot whatever is done is not called a defence)
      if (r.theirs != null && r.theirs > 0.65) { L.push('어느 길로 끝내도 상대에게 공이 보이는 배치에서, 가장 덜 내주는 쪽으로 점수를 채웠습니다.', '후구를 막을 길이 마땅치 않은 배치에서 무리 없이 점수를 채웠습니다.'); break; }
      if (r.forced) L.push('득점한 뒤 수구로 길을 가로막아 상대에게 쿠션을 강제합니다.', '점수를 채우면서 공을 벌려 놓아, 상대는 후구를 빈쿠션부터 풀어야 합니다.');
      L.push('점수를 채우면서 상대의 후구에 쉬운 공을 남기지 않았습니다.', '마지막 점수와 함께 수비까지 해냈습니다. 상대는 어려운 공으로 후구를 시작합니다.');
      break;
    case 'tie': L.push(game.otOn ? '후구에서 끝까지 따라붙어 경기를 연장으로 끌고 갔습니다.' : '후구에서 끝까지 따라붙어 무승부를 만들었습니다.', '물러설 곳 없는 후구에서 마지막 점수까지 채웠습니다.'); break;
    case 'passBad':
      L.push('점수는 채웠지만 상대의 후구에 쉬운 공을 남겼습니다.', '마지막 한 점은 공을 벌려 놓으면서 내야 합니다. 이 배치는 상대가 후구로 따라오기 쉽습니다.');
      break;
    case 'jump': L.push('없는 길을 만들어냈습니다!', '점프로 가린 공을 넘겨 막혀 있던 득점 길을 열었습니다.'); break;
    case 'masse': L.push(r.practical ? '정확한 곡선으로 득점하고 다음 샷 자리까지 만들었습니다.' : '정확한 곡선으로 막혀 있던 공에 닿았습니다.', '좁은 틈으로 수구를 휘어 보내 득점했습니다.'); break;
    case 'art':
      if (carom) {
        if (d.pre) L.push(`빈쿠션으로 돌아 ${r.game === 'three' ? '두 공이 겹쳐 보이는 배치를' : '직접 가는 길이 막힌 배치를'} 풀었습니다.`);
        if (thin) L.push('첫 공을 얇게 스쳐, 두껍게 맞히면 키스가 나는 지점을 빠져나갔습니다.');
        if (c >= 2 && !d.pre) L.push(`${rails}을 돌아 첫 공 뒤에 숨어 있던 둘째 공까지 잡았습니다.`);
        if (draw) L.push('첫 공을 두껍게 쓰고도 수구를 끌어, 밀어서는 닿기 힘든 둘째 공을 잡았습니다.');
        if (near) L.push('막힌 배치를 풀면서 공 셋을 한쪽에 모아 다음 득점 자리까지 만들었습니다.');
        L.push('직접 가는 길이 막힌 배치에서 득점 길을 찾고 다음 자리까지 만들었습니다.');
      } else {
        if (F.bank) L.push(`뱅크로 ${rvJ(ball || '공', '을', '를')} 넣고 수구는 ${nb ? nb + ' 앞으로' : '다음 공 쪽으로'} 보냈습니다.`);
        if (r.intent && r.intent.target && r.intent.target.via != null) L.push('콤비로 막혀 있던 공을 넣고 다음 공까지 남겼습니다.');
        if (F.breaks && F.breaks.length) L.push(`${rvJ(ball || '공', '을', '를')} 넣으면서 뭉친 공을 풀고, 바로 칠 공도 남겼습니다.`);
        if (F.cut >= 55) L.push(`얇은 커트로 ${rvJ(ball || '공', '을', '를')} 넣고 수구를 ${nb ? nbO + ' 칠 자리에' : '다음 공이 보이는 자리에'} 세웠습니다.`);
        if (draw && nb) L.push(`코너로 떨어질 수구를 끌어 빼내고 ${nb} 각까지 남겼습니다.`);
        if (F.tight) L.push(`길을 가리던 공 사이로 ${rvJ(ball || '공', '을', '를')} 넣고 다음 자리까지 만들었습니다.`);
        L.push('직접 넣을 길이 마땅치 않은 배치에서 득점하고 다음 자리까지 만들었습니다.');
      }
      break;
    case 'good':
      if (carom) {
        if (d.raised === 'masse' || d.raised === 'curve') L.push('수구를 휘어 보내 두 공을 잇고 다음 공도 보이는 자리에 섰습니다.');
        if (d.raised === 'jump') L.push('점프로 가린 공을 넘겨 득점하고 다음 공도 남겼습니다.');
        if (near) L.push('무리 없이 득점하고 공 셋을 가까이 모았습니다.', r.game === 'four' ? '짧게 끊어 쳐 빨간 공 둘을 한쪽에 모으고 연속 득점 자리까지 만들었습니다.' : '득점하고 세 공을 가까이 남겨 다음 길을 고르기 쉬워졌습니다.');
        if (easyLine && side) L.push('두께에 여유가 있는 길이라 조금 빗나가도 득점할 수 있었습니다.');
        if (plain) L.push(c ? '회전 없이 가운데를 쳐, 수구가 입사각 그대로 쿠션을 타고 둘째 공에 닿았습니다.' : '회전 없이 가운데를 쳐 두께만으로 둘째 공을 잡은 깔끔한 득점입니다.');
        if (draw) L.push('힘을 빼고 끌어쳐 수구를 다음 공과 같은 쪽에 남겼습니다.');
        if (follow && c === 0) L.push('밀어 쳐 둘째 공을 두껍게 잡고, 수구가 공들 곁에 머물렀습니다.');
        if (c >= 1 && !d.pre) L.push(`${rails}을 써서 둘째 공을 잡고 다음 공도 바로 보이는 자리에 섰습니다.`);
        if (d.pre) L.push('빈쿠션으로 막힌 길을 풀고 다음 공까지 남겼습니다.');
        L.push('무리 없이 득점하고 다음 공도 바로 보이는 자리에 섰습니다.');
      } else {
        const where = nb ? `${nbO} 치기 좋은 자리` : '다음 공이 보이는 자리';
        if (F.breaks && F.breaks.length) L.push(`${rvJ(ball || '공', '을', '를')} 넣으면서 뭉친 공을 풀었습니다.`);
        if (draw) L.push(`${rvJ(ball || '공', '을', '를')} 넣고 끌어쳐 수구를 ${where}로 되돌렸습니다.`, '힘을 빼고 끌어쳐 수구를 다음 공과 같은 쪽에 남겼습니다.');
        if (follow) L.push(`${rvJ(ball || '공', '을', '를')} 넣고 수구를 밀어 ${where}에 세웠습니다.`, '포켓에 가까운 공을 천천히 넣어 수구가 다음 각을 지나치지 않았습니다.');
        if (!draw && !follow && !side && !d.raised && d.pace != null && d.pace < 0.45 && r.next && r.next.p >= 0.75) L.push(`${nb ? rvJ(nb, '과', '와') : '다음 공과'} 직선이 되는 지점에 수구를 멈췄습니다.`);
        if (F.cut >= 55) L.push(`얇게 깎아 넣으면서 수구는 ${where}로 보냈습니다.`);
        if ((F.scratch || 0) >= 0.25) L.push('스크래치 길을 피해 수구를 빼내면서 넣었습니다.');
        if (side) L.push(`회전으로 수구 길을 바꿔 ${where}에 세웠습니다.`);
        L.push(`${rvJ(ball || '공', '을', '를')} 넣고 수구를 ${where}에 세웠습니다.`, `${rvJ(ball || '공', '을', '를')} ${pk || '포켓'}에 넣고 수구를 쿠션에서 떼어 두었습니다.`);
      }
      break;
    case 'okMade': {
      const fix = sh && sh.dir ? `같은 포켓에 조금 ${sh.dir === 'short' ? '세게' : '약하게'} 넣으면 ${nb ? nbO + ' 치기 좋은 자리였습니다' : '다음 공이 보이는 자리였습니다'}.` : null;
      if (d.raised) L.push('화려하게 득점했지만 다음 공은 까다로운 각에 남았습니다.');
      if (carom) {
        if (far) L.push('득점 뒤 공이 흩어져 연속 득점은 어려워졌습니다.');
        if (c >= 2) L.push(`${rails}을 돌아 득점했지만 다음 샷도 각이 까다롭습니다.`);
        L.push('득점은 했고, 다음 공은 조금 얇게 쳐야 하는 자리에 섰습니다.', '안전하게 맞혔지만 다음 샷의 거리는 길어졌습니다.');
      } else {
        if (fix) L.push(fix);
        if (nb) L.push(`${rvJ(ball || '공', '을', '를')} 넣었지만 ${rvJ(nb, '이', '가')} 까다로운 각에 남았습니다.`);
        L.push('넣긴 했지만 다음 공까지 거리가 멀어졌습니다.', '공을 넣은 뒤 수구가 다음 각을 지나쳐 노릴 포켓이 줄었습니다.');
      }
      break;
    }
  }
  return L;
}
function rvBody(q, key) {
  const r = q.res, d = r.d || {}, md = r.md, carom = r.game === 'four' || r.game === 'three', did = rvDid(d, carom);
  const T = list => rvTurn(q, key, list);
  switch (key) {
    case 'fluke': return carom ? T(['키스로 방향이 바뀌어 둘째 공에 닿았습니다. 다시 치면 나오기 어려운 득점입니다.', '첫 공이 되돌아오며 수구를 건드려 둘째 공 쪽으로 틀어줬습니다.'])
      : T(['다른 공에 맞고 방향이 바뀌어 들어갔습니다. 노린 길은 아니었습니다.', '빗나간 공이 다른 공을 건드려 대신 들어갔습니다.']);
    case 'won': case 'wonArt': case 'passGood': case 'passBad': case 'tie': case 'jump': case 'masse': case 'art': case 'good': case 'okMade': {
      const L = rvMadeLines(q, key);
      // (the first - the most particular - most often; the others in turn, so a game does not hear one line twice running)
      return L.length <= 1 ? L[0] || '' : T(L.length > 2 ? [L[0], ...L.slice(0, -1)] : L);
    }
    case 'safetyGood': return T(carom ? ['얇게 맞혀 공들을 벌려 놓으니 상대에게 쉬운 첫 공이 남지 않았습니다.', '수구를 멀리 보내 상대가 긴 샷부터 풀어야 합니다.']
      : ['수구를 숨겨 상대가 맞힐 공에 곧장 닿기 어렵게 했습니다.', '목적구를 쿠션에 붙여 상대에게 넣을 각을 남기지 않았습니다.']);
    case 'safetyOk': return T(['한쪽 길을 가리는 데 성공했지만 상대에게 다른 길이 남았습니다.', carom ? '공을 벌려 놓았지만 상대에게도 칠 만한 길이 보입니다.' : '상대에게 공이 보이지만, 먼 포켓으로 치기엔 각이 까다롭습니다.']);
    case 'safetyBad': return T(['수비하려 했지만 상대에게 쉬운 공이 열렸습니다.', carom ? '공을 벌려 놓지 못해 상대가 바로 칠 수 있습니다.' : '수구를 멀리 보냈어도 상대에게는 공이 정면으로 열렸습니다.']);
  }
  // misses
  const need = md ? (carom ? rvMetShort(md) : Math.abs(md.cut || 0) < 3 ? '정면' : `${Math.abs(md.cut)}°`) : null, got = carom ? rvMetShort(d) : Math.abs(d.cut || 0) < 3 ? '정면' : `${Math.abs(d.cut || 0)}°`;
  const deg = r.offDeg == null ? null : Math.abs(r.offDeg), dir = r.offDeg > 0 ? '왼쪽' : '오른쪽', nudge = deg == null || deg < 0.2 ? '아주 조금' : `${deg.toFixed(1)}°`;
  const pa = md ? Math.round((md.pace || 0) * 100) : null, pb = Math.round((d.pace || 0) * 100);
  const thickness = carom ? '두께' : '각';
  let s = '';
  switch (key) {
    case 'thick': case 'thin': {
      const which = key === 'thick' ? '두껍게' : '얇게';
      s = T([
        carom && need && got && need !== got ? `길은 맞았는데 ${need === '정면' ? '정면이 필요한 공을' : `${rvJ(need, '이', '가')} 필요한 공을`} ${got === '정면' ? '정면으로' : rvJ(got, '으로', '로')} 맞혔습니다.` : `길은 맞았는데 ${carom ? '첫 공을' : '목적구를'} ${which} 맞혔습니다.`,
        `선택은 좋았고, ${carom ? '첫 공을' : '목적구를'} 조금 더 ${key === 'thick' ? '얇게' : '두껍게'} 맞히면 ${carom ? '둘째 공에 닿았습니다' : '들어갔습니다'}.`,
        `같은 세기와 당점에서 조준을 ${nudge} ${dir}으로 옮기면 ${carom ? '득점하는 길이었습니다' : '포켓으로 가는 길이었습니다'}.`]);
      break;
    }
    case 'soft': case 'hard': s = T([
      `같은 조준과 당점에서 세기만 ${key === 'soft' ? '조금 올리면' : '조금 줄이면'} ${carom ? '둘째 공에 닿았습니다' : '들어갔습니다'}.`,
      pa != null ? `${pb}%로 쳤는데 ${pa}%쯤이 맞는 세기였습니다.` : `세기가 ${key === 'soft' ? '모자랐습니다' : '넘쳤습니다'}.`,
      `길은 맞았는데 ${key === 'soft' ? '공이 끝까지 가지 못했습니다' : '공이 너무 멀리 갔습니다'}.`]); break;
    case 'tip': s = T(['당점이 길을 비틀었습니다. 같은 조준에 회전을 줄이면 들어가는 공이었습니다.', '회전 때문에 수구가 생각보다 덜 꺾였습니다. 당점을 가운데 가깝게 두면 맞는 길이었습니다.']); break;
    case 'aim': s = T([`조준이 ${nudge} 어긋났습니다. ${dir}으로 옮기면 맞는 길이었습니다.`]); break;
    case 'masseMore': s = T([`맞는 길을 골랐는데 덜 휘었습니다. 큐를 조금 더 세우거나 당점을 바깥으로 주면 닿았습니다.`, `곡선이 모자라 목적구 앞을 지나갔습니다. 조준을 ${nudge} ${dir}으로 옮겨도 됐습니다.`]); break;
    case 'masseLess': s = T([`맛세이로 장애물은 피했지만 수구가 너무 일찍 휘었습니다. 큐를 조금 눕히면 맞는 곡선이었습니다.`, `곡선이 넘쳤습니다. 당점을 안쪽으로 조금 옮기면 닿았습니다.`]); break;
    case 'jumpMiss': s = T(['점프는 좋았는데 착지 후 길이 어긋났습니다.', `넘기는 됐지만 조준이 ${nudge} 벗어났습니다.`]); break;
    case 'easyMiss': {
      const off = carom && need && got && need !== got ? `${thickness} ${rvJ(need, '이', '가')} 필요했는데 ${got === '정면' ? '정면으로' : rvJ(got, '으로', '로')} 맞았습니다.` : `조준이 ${nudge} ${dir}으로 어긋났습니다.`;
      s = T([`넣어야 하는 공을 놓쳤습니다. ${off}`, `쉬운 배치였는데 ${off.replace(/습니다\.$/, '서 빗나갔습니다.').replace(/맞았서/, '맞아').replace(/났서/, '나')}`]); break;
    }
    case 'chanceMiss': s = T(['상대가 준 기회를 살리지 못했습니다.', '모처럼 온 기회를 놓쳤습니다.']); break;
    case 'choice': case 'none': {
      const e = (r.alts || []).find(a => a.easiest) || (r.alts || []).find(a => a.best);
      s = e ? T([`쉬운 길을 두고 까다로운 길을 택했습니다. ${rvJ(rvAltProse(e), '이', '가')} 훨씬 쉬웠습니다.`, `${rvJ(rvAltProse(e), '이', '가')} 열려 있었는데 더 어려운 길을 골랐습니다.`, `선택한 길은 성공 확률이 낮았습니다. ${rvJ(rvAltProse(e), '을', '를')} 노렸다면 편했습니다.`])
        : T(['득점과는 거리가 먼 샷이었습니다.', '노린 길이 잘 보이지 않는 샷이었습니다.']);
      break;
    }
    case 'hardMiss': s = T(['원래 어려운 공이었습니다.', '누구에게나 쉽지 않은 길이었습니다.', did && !did.alone ? '길은 좋았지만 마지막에 조금 어긋났습니다.' : '쉽지 않은 공이었고, 첫 공을 맞힌 뒤 길이 어긋났습니다.']); break;
    case 'lostGame': s = !carom && (d.potted || []).some(([id]) => id === 8) ? T(['8번이 먼저 들어가 경기를 내줬습니다.', '8번과 함께 경기를 내줬습니다. 당점을 낮췄다면 피할 수 있었습니다.']) : '이 샷의 파울로 경기를 내줬습니다.'; break;
    case 'scratch': { const pot = (d.potted || []).find(([id]) => id !== 0); s = pot ? `${rvJ(rvBall(pot[0]), '과', '와')} 수구가 함께 빠졌습니다. 끌어치거나 세기를 줄이면 수구를 빼낼 수 있었습니다.` : '수구만 포켓에 빠졌습니다.'; break; }
    case 'wrong': s = d.first != null ? `${rvJ(rvBall(d.first), '에', '에')} 먼저 닿았습니다.` : '맞혀야 할 공에 먼저 닿지 못했습니다.'; break;
    case 'wrongCarom': s = d.first != null && d.first < 2 ? '상대 공에 먼저 닿아 파울이 났습니다.' : '첫 빨간 공을 맞힌 뒤 수구가 상대 공에 걸려 파울이 났습니다.'; break;
    case 'nohit': s = '어느 공에도 닿지 못했습니다.'; break;
    case 'norail': s = '공을 맞힌 뒤 어느 공도 쿠션에 닿거나 들어가지 않아 파울이 났습니다.'; break;
    case 'off': s = '세기가 너무 강해 공이 테이블 밖으로 나갔습니다.'; break;
    default: s = '파울이 났습니다.';
  }
  // (the table is the other's now: what it was left - said when it matters, joined to the sentence)
  const safeAt = r.game === 'three' ? 0.3 : 0.5;
  // (4구 후구: the visit to catch up ends with the miss, and the game with it)
  if (r.lost && !r.foul) s += ' ' + T(['후구에서 득점이 끊겨 경기가 끝났습니다.', '따라붙어야 하는 후구라 이 한 번이 컸습니다.']);
  // (a foul that costs nothing - 4구 played without the minus - is judged as any miss: what it left)
  else if (r.leave != null && !r.lost && (!r.foul || r.grade <= 2)) {
    if (r.leave <= safeAt && key !== 'none') s += ' ' + T(['다행히 상대에게 남긴 공은 까다롭습니다.', '그래도 상대에게 쉬운 공은 주지 않았습니다.', '수비는 괜찮았습니다.']);
    else if (r.leave >= 0.9) s += ' ' + T(['게다가 상대에게 쉬운 공을 남겼습니다.', '상대에게 좋은 배치를 넘겨줬습니다.']);
  }
  return s;
}
/* One more sentence, now and then: the why of it - a thing a player keeps (once a game a kind; none for a plain good shot) */
const RV_TIP = {
  thin: ['얇게 맞을수록 수구는 덜 꺾이고 멀리 빠집니다.', '두께는 첫 공의 가장자리가 아니라 중심에서 얼마나 비켜 맞힐지로 잡아 보세요.'],
  thick: ['두껍게 맞을수록 수구는 많이 꺾이고 힘을 잃습니다.', '두께가 두꺼우면 수구가 첫 공 쪽으로 덜 빠집니다. 조준점을 바깥으로 반 개만 옮겨 보세요.'],
  thinPool: ['얇게 맞으면 목적구가 포켓 바깥쪽으로 갑니다. 목적구 뒤에 수구가 닿을 자리(고스트 볼)를 먼저 그려 보세요.'],
  thickPool: ['두껍게 맞으면 목적구가 포켓 안쪽 턱으로 갑니다. 각이 클수록 조금 더 얇게 겨냥하세요.'],
  soft: ['쿠션을 많이 도는 길일수록 쿠션마다 힘을 잃습니다. 한 단계 세게 치세요.', '세기가 모자라면 쿠션에서 각이 짧아집니다.'],
  hard: ['세기가 넘치면 쿠션에서 덜 꺾여 길게 빠집니다.', '강하게 칠수록 회전이 늦게 먹힙니다.'],
  tip: ['회전을 많이 줄수록 수구가 조준선에서 살짝 밀립니다. 회전을 줄 때는 조준을 조금 보정하세요.'],
  masseMore: ['맛세이는 큐를 세울수록, 당점이 바깥일수록 더 크게 휩니다.'], masseLess: ['맛세이는 세기가 약할수록 일찍 휩니다. 휘는 지점은 세기로 조절합니다.'],
  jumpMiss: ['점프는 큐를 세운 만큼 높이 뜨고, 세기가 강할수록 멀리 날아갑니다.'],
  choice: ['쉬운 길이 있으면 먼저 그 길을 보세요. 화려한 길은 쉬운 길이 막혔을 때 꺼내는 카드입니다.', '어려운 길은 성공해도 다음 배치가 흔들리기 쉽습니다.'],
  scratch: ['목적구와 수구가 같은 포켓 쪽으로 가는 각이면 끌어치기나 스톱으로 수구 길을 바꾸세요.'],
  okMade: ['다음 공은 정면보다 살짝 각이 있는 자리가 이어 치기 좋습니다.', '넣는 것만큼 수구를 어디에 세울지가 중요합니다.'],
  art: ['어려운 공일수록 세기를 줄이면 다음 배치를 조절하기 쉽습니다.'],
  masse: ['맛세이는 큐를 세울수록, 당점이 바깥일수록 더 크게 휩니다.'],
  safetyGood: ['넣기 어려울 땐 상대에게 남길 공을 먼저 생각하는 것도 실력입니다.'],
};
function rvTip(q, key) {
  const r = q.res, carom = r.game === 'four' || r.game === 'three', k0 = key === 'easyMiss' || key === 'hardMiss' ? r.cause : key === 'none' ? 'choice' : key;
  const tipKey = !carom && (k0 === 'thin' || k0 === 'thick') ? k0 + 'Pool' : k0;
  const list = RV_TIP[tipKey]; if (!list) return '';
  // (once a game for each kind, and not for every shot: about one in two of those that have one)
  if (rvSaidBefore(q, o => o.res && o.res.grade != null && o !== q && (o._tip === tipKey))) return '';
  if (((q.n || 0) + rvHash(tipKey)) % 2) return '';
  q._tip = tipKey;
  return list[(q.n || 0) % list.length];
}
const pick2 = (q, a) => a[(q.n || 0) % a.length];
// an other way in a sentence: '노란 공을 먼저 맞히는 밀어치기', '빈쿠션으로 빨간 공부터 치는 길', '3번 공을 코너 포켓에 넣는 길'
function rvAltProse(a) {
  const carom = game.mode.table === 'carom', way = a.way === 'side' ? '회전 샷' : RV_WAY[a.way] || '길';
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
  if ((/^safety(Ok|Bad)$/.test(key) || r.foul || r.grade >= 2) && best >= 0) return { label: alts[best].kind === 'safety' ? '수비 보기' : '추천 샷 보기', alt: best };
  return null;
}
/* The card's words for one shot: the title (the shot named, graded), the sentence(s) under it, the button */
function reviewWords(q) {
  const r = q.res; rvAt = q.snap || null;
  const key = rvKey(q), name = rvShotName(q), word = RV_WORD[r.grade] || '';
  const title = key === 'fluke' ? `${name}${/[가-힣]$/.test(name) && (name.charCodeAt(name.length - 1) - 0xac00) % 28 ? '에는' : '에'} 행운이 따랐습니다.` : `${rvJ(name, '은', '는')} ${word}.`;
  const body = [rvBody(q, key), rvTip(q, key)].filter(Boolean);
  return { word, name, head: title, title, body, act: rvAction(q, key), key };
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
  return { safety: '상대에게 칠 공을 남기지 않습니다', cut: `깎는 각이 ${w.by}° 작습니다`, near: '공 사이 거리가 짧습니다', clear: '길을 가로막는 공이 없습니다', scratch: '스크래치 위험이 없습니다',
    breaks: `뭉친 ${(w.ids || []).map(id => rvBall(id).replace(/ 공$/, '')).join('·')} 공을 함께 풉니다`,
    deny: '상대의 후구에 쉬운 공을 남기지 않습니다', pos: carom ? '다음 배치가 좋습니다' : w.next ? `수구가 ${rvJ(rvBall(w.next.id), '을', '를')} 넣기 좋은 자리로 옵니다` : '다음 자리가 좋습니다',
    room: '세기 여유가 넓습니다 — 조금 세거나 약해도 자리가 나옵니다', likelier: '성공 확률이 더 높습니다',
    over: '가로막는 공을 넘어갑니다', around: carom ? '휘어 들어가 두 공을 잇습니다' : '가로막는 공을 돌아 들어갑니다' }[w.k] || '';
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
  const carom = game.mode.table === 'carom', did = rvDid(d, carom);
  return { how: [did ? rvSay(did, 'pre') : rvStory(d), a.way === 'safety' ? '상대에게 칠 공을 남기지 않습니다.' : carom ? '' : rvNext(a.next, true)].filter(Boolean).join(' '), why };
}
