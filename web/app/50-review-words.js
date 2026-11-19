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
  const r = q.res, played = r.d || {}, d = !r.made && !r.foul && r.md ? { ...r.md, raised: played.raised } : played, carom = r.game === 'four' || r.game === 'three', pool = !carom, t3 = r.game === 'three' && (game.cushions || 0) >= 3;
  if (d.raised === 'masse') return '맛세이'; if (d.raised === 'jump') return '점프샷'; if (d.raised === 'curve') return '커브샷';
  if (r.intent && r.intent.kind === 'safety') return '수비 샷';
  if (q.last || (r.won || r.lost) && pool) return t3 ? '쓰리쿠션 마무리' : '마무리 샷';
  if (r.game === 'three' && q.n === 1) return '초구';
  const draw = d.b <= -0.25, follow = d.b >= 0.25, side = Math.abs(d.a || 0) >= 0.2;
  if (carom) {
    const rt = d.route || {};
    if (d.pre) return t3 ? '빈쿠션 쓰리쿠션' : '빈쿠션';
    if (rt.name === '대회전') return '대회전';
    if (r.won && t3) return '쓰리쿠션 마무리';
    const c = d.cushions || 0, t = d.thick;
    if (t3) return c >= 3 ? (t != null && t < 0.3 ? '빗겨치기' : side && t != null && t >= 0.4 ? '옆돌리기' : '쓰리쿠션') : '쓰리쿠션';
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
// the game's story up to a shot: what the other's shot before left, the score
function rvContext(q) {
  const L = typeof review !== 'undefined' ? review.list : [q], i = L.indexOf(q), me = q.turn;
  const prev = i > 0 ? L[i - 1] : null, pr = prev && prev.turn !== me ? prev.res : null;
  const given = !!(pr && pr.grade != null && pr.grade >= 3 && !pr.made && pr.leave >= 0.9);
  return { L, i: i < 0 ? 0 : i, given, last: !!q.last };
}
/* Which situation a shot is, most particular first - the kind decides the button and the tip; the words come from the bank
   (50-review-lines.js) by the facts under it */
function rvKey(q) {
  const r = q.res || {}, d = r.d || {}, carom = r.game === 'four' || r.game === 'three', c = rvContext(q), raised = d.raised, R = r.rule || {};
  if (r.foul) return r.lost ? 'lostGame' : r.cause === 'wrong' && carom ? (R.opening ? 'opening' : 'wrongCarom') : r.cause || 'foul';
  if (r.lost && R.eightIn) return 'lostGame';
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
  if (!r.lost && (r.intent && r.intent.kind === 'safety' || !r.meant && r.grade <= 1)) return r.grade <= 1 ? 'safetyGood' : r.grade === 2 ? 'safetyOk' : 'safetyBad';
  if (R.short) return 'short';
  const b = r.better, choiceBad = b && !b.same && b.easier && r.grade >= 3;
  if (choiceBad || !r.meant && b && r.grade >= 3) return r.meant || b ? 'choice' : 'none';
  if (!r.meant) return 'none';
  if (r.cause === 'kiss') return 'kiss';
  if (c.given && r.p != null && r.p >= 0.6) return 'chanceMiss';
  if (raised === 'masse' || raised === 'curve') return r.offDeg == null ? 'hardMiss' : (r.offDeg > 0) === ((d.a || 0) > 0) ? 'masseLess' : 'masseMore';
  if (raised === 'jump') return 'jumpMiss';
  if (r.p != null && r.p >= 0.8 && r.grade >= 3) return 'easyMiss';
  if (r.cause && /^(thick|thin|soft|hard|tip|aim)$/.test(r.cause)) return r.cause;
  return 'hardMiss';
}
// (something said for an earlier shot of this game)
const rvSaidBefore = (q, f) => { const c = rvContext(q); for (let k = 0; k < c.i; k++) if (f(c.L[k])) return true; return false; };
/* The line taken in turn: the n-th time a game reaches a key (or a family of them), its n-th way of saying it. The shots
   before are put into words first, so a card reads the same however often it is drawn. */
function rvSeq(q, key) {
  const c = rvContext(q); let n = 0;
  for (let k = 0; k < c.i; k++) { const o = c.L[k]; if (!o.res || o.res.grade == null) continue; if (!o._used) reviewWords(o); if (o._used && o._used.includes(key)) n++; }
  return rvHash(key) + n;
}
const rvUse = (q, key) => { (q._using || (q._using = [])).push(key); };
// (kept for the old callers: the n-th of a list by a key)
function rvTurn(q, key, list) { const i = rvSeq(q, key) % list.length; rvUse(q, key); return list[i]; }
// a line from the bank with what it names filled in; null when it names what is not known
const RV_P = { 을: ['을', '를'], 를: ['을', '를'], 이: ['이', '가'], 가: ['이', '가'], 은: ['은', '는'], 는: ['은', '는'], 과: ['과', '와'], 와: ['과', '와'] };
function rvFill(t, v) {
  let ok = true;
  const out = t.replace(/\{([A-Za-z]+)(을|를|이|가|은|는|과|와|으로|로|에)?\}/g, (m, k, j) => {
    const w = v[k]; if (w == null || w === '') { ok = false; return ''; }
    if (!j) return w; if (j === '에') return w + '에'; if (j === '으로' || j === '로') return rvJ(String(w), '으로');
    return rvJ(String(w), RV_P[j][0], RV_P[j][1]);
  });
  return ok ? out : null;
}
const rvHas = (key, v) => (RV_LINES[key] || []).some(t => rvFill(t, v) != null);
function rvLine(q, key, v) {
  const L = (RV_LINES[key] || []).map(t => rvFill(t, v)).filter(Boolean); if (!L.length) return null;
  const line = L[rvSeq(q, key) % L.length]; rvUse(q, key); return line;
}
// one of several keys that fit, taken in turn under a family name (the most particular kept, the plainest dropped when
// there are more particular ones)
function rvPick(q, family, keys, v) {
  let ks = keys.filter(k => rvHas(k, v)); if (!ks.length) return null;
  if (ks.length > 2) ks = ks.slice(0, -1);
  const k = ks[rvSeq(q, family) % ks.length]; rvUse(q, family); return rvLine(q, k, v);
}

/* What is true of the shot, for the bank: its names (the ball, the next, the pocket, the cushions), the stroke, how near a
   miss came, the rules where it was played */
const rvShort = id => id == null ? null : game.mode.table === 'pool' ? `${game.faceOf(id)}번` : rvBall(id);
function rvFacts(q) {
  const r = q.res, d = r.d || {}, md = r.md, carom = r.game === 'four' || r.game === 'three', R = r.rule || {}, F = r.facts || {};
  const sh = r.intent && r.intent.shape, nx = sh && sh.own && sh.own.next ? sh.own.next.id : r.next ? r.next.id : null;
  const pot = (d.potted || []).find(([id]) => id !== 0), tgt = r.intent && r.intent.target;
  const ballId = pot ? pot[0] : tgt && tgt.id != null ? tgt.id : md && (md.potted || []).find(([id]) => id !== 0) ? md.potted.find(([id]) => id !== 0)[0] : null;
  const pocketK = pot ? pot[1] : tgt && tgt.pocket != null ? tgt.pocket : null;
  const s = !r.made && !r.foul && md ? md : d, c = s.cushions || 0, rails = s.route && s.route.rails ? `${s.route.rails} 쿠션` : c ? `${['', '한', '두', '세', '네', '다섯'][c] || c} 쿠션` : null;
  const need = md ? (carom ? rvMetShort(md) : Math.abs(md.cut || 0) < 3 ? '정면' : `${Math.abs(md.cut)}°`) : null, got = carom ? rvMetShort(d) : Math.abs(d.cut || 0) < 3 ? '정면' : `${Math.abs(d.cut || 0)}°`;
  const deg = r.offDeg == null ? null : Math.abs(r.offDeg);
  const near = r.near, close = near != null && near <= (carom ? 0.2 : 0.25), nearMiss = near != null && near <= (carom ? 1 : 0.8);
  const gap = near == null ? null : near <= 0.12 ? '종이 한 장' : near <= 0.6 ? '공 반 개' : near <= 1.2 ? '공 한 개' : null;
  const fin = R.finish || game.finish ? (game.finish === 'three' ? '쓰리쿠션' : '쿠션') : null;
  const v = {
    ball: rvShort(ballId), first: rvShort(d.first), second: rvShort(d.second), next: rvShort(nx), pocket: pocketK != null ? rvPocket(pocketK) : null,
    rails, cush: String(d.cushions || 0), need: need !== got ? need : null, got: need !== got ? got : null,
    nudge: deg == null ? null : deg < 0.2 ? '아주 조금' : `${deg.toFixed(1)}°`, dir: r.offDeg == null ? null : r.offDeg > 0 ? '왼쪽' : '오른쪽',
    pa: md && md.pace != null ? String(Math.round(md.pace * 100)) : null, pb: d.pace != null ? String(Math.round(d.pace * 100)) : null,
    reach: carom ? '둘째 공에 닿았습니다' : '들어갔습니다', gap,
    alt: null, grp: R.group ? (R.group === 'solid' ? '단색' : '줄무늬') : null, lowest: R.lowest != null ? String(R.lowest) : null,
    left: R.mine != null ? `${R.mine}개` : null, needC: R.need ? String(R.need) : null, needTh: R.need ? `${['', '첫', '두', '세'][R.need] || R.need} 번째` : null, finish: fin,
  };
  // (the stroke as the ACK names it)
  const draw = s.b <= -0.25, follow = s.b >= 0.25, side = Math.abs(s.a || 0) >= 0.2, plain = !side && !s.raised && Math.abs(s.b || 0) < 0.25;
  return { r, d, md, carom, pool: !carom, R, F, sh, v, draw, follow, side, plain, c, near, close, nearMiss,
    thin: d.thick != null && d.thick < 0.3, gather: F.spread != null && F.spread < 0.6, far: F.spread != null && F.spread > 1.3,
    easyLine: r.p != null && r.p >= 0.7, hardLine: r.p != null && r.p < 0.35, choiceOk: !r.better || r.better.same, bank: !!F.bank, combo: !!(tgt && tgt.via != null),
    cut: Math.abs(F.cut || d.cut || 0) };
}

// ---- made ----
function rvMade(q, kind, f) {
  const { r, d, R, F, v, carom } = f, three = r.game === 'three' && (game.cushions || 0) >= 3, ks = [];
  switch (kind) {
    case 'won': case 'wonArt': {
      const spec = R.mode === 'eight' ? 'won.eight' : R.mode === 'nine' ? (R.early9 ? 'won.nine.early' : 'won.nine') : carom ? (game.ot ? 'won.ot' : R.finish ? 'won.finish' : 'won.carom') : null;
      if (kind === 'wonArt') return rvLine(q, d.raised === 'jump' ? 'won.art.jump' : d.raised ? 'won.art.masse' : 'won.art', v);
      return rvPick(q, 'won', spec ? ['won', spec, 'won'] : ['won'], v);
    }
    case 'passGood': return rvLine(q, r.theirs != null && r.theirs > 0.65 ? 'pass.open' : r.forced ? (rvSeq(q, 'pass') % 2 ? 'pass.good' : 'pass.forced') : 'pass.good', v);
    case 'passBad': return rvLine(q, 'pass.bad', v);
    case 'tie': return rvLine(q, game.otOn ? 'tie.ot' : 'tie', v);
    case 'jump': return rvLine(q, 'art.jump', v);
    case 'masse': return rvLine(q, d.raised === 'curve' ? 'art.curve' : r.practical ? 'art.masse' : 'art.masse.only', v);
    case 'art':
      if (R.cleared) ks.push('art.eight.cleared');
      if (carom) {
        if (d.pre) ks.push(three ? 'art.three.pre' : 'art.carom.pre');
        if (f.thin) ks.push('art.carom.thin');
        if (f.c >= 2 && !d.pre) ks.push(three ? 'art.three.rails' : 'art.carom.rails');
        if (f.draw) ks.push('art.carom.draw');
        if (f.gather) ks.push('art.carom.gather');
        ks.push('art.carom');
      } else {
        if (f.bank) ks.push('art.pool.bank');
        if (f.combo) ks.push('art.pool.combo');
        if (F.breaks && F.breaks.length) ks.push('art.pool.breaks');
        if (f.cut >= 55) ks.push('art.pool.cut');
        if (f.draw) ks.push('art.pool.draw');
        if (F.tight) ks.push('art.pool.tight');
        if (f.cut >= 25 && (F.dist || 0) + (F.run || 0) > 1.6) ks.push('art.pool.long');
        ks.push('art.pool');
      }
      return rvPick(q, 'art', ks, v);
    case 'good': {
      // (the rules first where they decide what the ball meant: the group done and the 8 set, the group taken, the points
      // all in and the finish to come, the opening shot)
      const strong = R.cleared ? 'good.eight.cleared' : R.assign && R.mode === 'eight' ? 'good.eight.assign' : carom && game.finish && R.left != null && !R.finish && R.left <= 1 && r.made ? 'good.carom.reach' : R.opening && q.n <= 2 ? 'good.opening' : null;
      if (strong && rvHas(strong, v)) return rvLine(q, strong, v);
      if (R.opp8) ks.push('good.eight.opp8');
      if (R.chase) ks.push('chase.made');
      if (carom && R.left === 2) ks.push('good.carom.oneLeft');
      if (carom) {
        if (d.raised === 'masse' || d.raised === 'curve') ks.push('good.carom.masse');
        if (d.raised === 'jump') ks.push('good.carom.jump');
        if (f.gather) ks.push(r.game === 'four' ? 'good.four.gather' : 'good.carom.gather');
        if (f.easyLine && f.side) ks.push('good.carom.margin');
        if (f.plain) ks.push(f.c ? 'good.carom.plainRail' : 'good.carom.plain');
        if (f.draw) ks.push('good.carom.draw');
        if (f.follow && f.c === 0) ks.push('good.carom.follow');
        if (f.c >= 1 && !d.pre) ks.push('good.carom.rails');
        if (f.c >= 2 && !d.pre && !three) ks.push('good.carom.extra');
        if (d.pre) ks.push('good.carom.pre');
        if (three) ks.push('good.three');
        ks.push('good.carom');
      } else {
        if (R.mode === 'nine' && v.next) ks.push('good.nine.next');
        if (F.breaks && F.breaks.length) ks.push('good.pool.breaks');
        if (f.bank) ks.push('good.pool.bank');
        if (f.combo) ks.push('good.pool.combo');
        if (f.draw) ks.push('good.pool.draw');
        if (f.follow) ks.push('good.pool.follow');
        if (!f.draw && !f.follow && !f.side && !d.raised && d.pace != null && d.pace < 0.45 && r.next && r.next.p >= 0.75) ks.push('good.pool.stop');
        if (f.cut >= 55) ks.push('good.pool.cut');
        if ((F.scratch || 0) >= 0.25) ks.push('good.pool.scratch');
        if (f.side && !f.draw && !f.follow && (d.cushions || 0) >= 1) ks.push('good.pool.side');
        const rl = r.rail || {};
        if (rl.before != null && rl.before < 0.1 && rl.after > 0.2) ks.push('good.pool.rail'); else if (rl.after > 0.35) ks.push('good.pool.open');
        ks.push('good.pool');
      }
      return rvPick(q, 'good', ks, v);
    }
    case 'okMade': {
      if (R.chase) return rvLine(q, 'okMade.chase', v);
      // what came off first - the curve, the hard line, the cushions - then what it left (owner 11-19: '궤적은 아름답지만 다음
      // 배치가 아쉽습니다')
      const acks = [];
      if (d.raised === 'jump') acks.push('okAck.jump'); else if (d.raised) acks.push('okAck.raised');
      if (f.hardLine) acks.push('okAck.hard');
      if (carom && f.c >= 2) acks.push('okAck.rails');
      if (f.bank) acks.push('okAck.bank');
      if (f.combo) acks.push('okAck.combo');
      if (!carom && f.cut >= 55) acks.push('okAck.cut');
      const plainAck = carom ? 'okAck.plain' : 'okAck.plain.pool';
      const ack = acks.length ? rvPick(q, 'okAck', acks.concat([plainAck]), v) : rvLine(q, plainAck, v);
      const issue = rvLine(q, R.cleared ? 'okIssue.eight.cleared' : R.opp8 ? 'okIssue.eight.opp8' : carom ? (f.far ? 'okIssue.carom.far' : 'okIssue.carom') : r.rail && r.rail.after != null && r.rail.after < 0.04 ? 'okIssue.pool.rail' : v.next && rvSeq(q, 'okIssue') % 2 ? 'okIssue.pool.next' : 'okIssue.pool', v);
      rvUse(q, 'okIssue');
      const fix = !carom && f.sh && f.sh.dir ? rvLine(q, f.sh.dir === 'short' ? 'okFix.pool.short' : 'okFix.pool.long', v) : null;
      return [`${ack} ${issue}`, fix].filter(Boolean).join(' ');
    }
    case 'fluke':
      if (carom) return rvLine(q, r.practical ? 'fluke.carom.set' : 'fluke.carom', v);
      return rvLine(q, d.first != null && v.ball && (d.potted || []).some(([id]) => id !== 0 && id !== d.first) ? 'fluke.pool' : 'fluke.pool.kiss', v);
  }
  return null;
}

// ---- missed ----
function rvAck(q, f, kind) {
  const { r, carom, v, d } = f;
  // (how near it came, first: the ball all but in is what a player wants noticed)
  if (f.nearMiss && !/^(easyMiss|chanceMiss)$/.test(kind)) { const k = `ack.near.${carom ? 'carom' : 'pool'}${f.close ? '.close' : ''}`; if (rvHas(k, v)) return rvLine(q, k, v); }
  const ks = [];
  if (f.choiceOk) {
    const s = r.md || d;
    if (carom && s.pre) ks.push('ack.choice.kick'); else if (f.bank) ks.push('ack.choice.bank');
    if (carom && f.c >= 2 && !s.pre) ks.push('ack.choice.rails');
    if (f.draw) ks.push('ack.choice.draw'); else if (f.follow) ks.push('ack.choice.follow'); else if (f.side && kind !== 'tip') ks.push('ack.choice.side');
  }
  if (carom && /^(soft|hard|tip)$/.test(kind) && d.first != null && r.md && d.first === r.md.first) ks.push('ack.first');
  if (f.hardLine) ks.push('ack.hard');
  if (f.choiceOk) ks.push('ack.choice');
  return ks.length ? rvPick(q, 'ack', ks.concat(['ack.choice']), v) : null;
}
function rvFix(q, f, kind) {
  const { carom, v, r, d } = f, three = r.game === 'three' && (game.cushions || 0) >= 3;
  const key = /^(thick|thin)$/.test(kind) ? `fix.${kind}.${carom ? 'carom' : 'pool'}` : kind === 'soft' && three ? (rvSeq(q, 'fixSoft') % 2 ? 'fix.soft' : 'fix.soft.three')
    : kind === 'tip' && carom && f.c ? 'fix.tip.rails' : kind === 'jumpMiss' ? 'fix.jump' : `fix.${kind}`;
  if (kind === 'soft') rvUse(q, 'fixSoft');
  return rvLine(q, key, v) || rvLine(q, `fix.${kind}`, v);
}
function rvMiss(q, kind, f) {
  const { r, d, carom, v, R } = f;
  switch (kind) {
    case 'kiss': return rvLine(q, 'miss.kiss', v);
    case 'short': return rvLine(q, R.finish ? 'miss.short.finish' : (d.cushions || 0) === 0 ? 'miss.short.none' : 'miss.short', v);
    case 'choice': case 'none': {
      const e = (r.alts || []).find(a => a.easiest) || (r.alts || []).find(a => a.best);
      if (!e) return rvLine(q, 'miss.none', v);
      const v2 = { ...v, alt: rvAltProse(e) };
      return rvLine(q, r.blocked && /kick|bank/.test(e.way) ? 'miss.choice.blocked' : 'miss.choice', v2);
    }
    case 'hardMiss': return rvLine(q, f.nearMiss && v.gap ? 'miss.hard.near' : 'miss.hard', v);
    case 'easyMiss': case 'chanceMiss': {
      const head = rvLine(q, kind === 'chanceMiss' ? 'miss.chance' : carom ? 'miss.easy.carom' : 'miss.easy', v);
      const fixKind = /^(thick|thin|soft|hard|tip|aim)$/.test(r.cause) ? r.cause : 'aim';
      return [head, rvFix(q, f, fixKind)].filter(Boolean).join(' ');
    }
    default: {
      const ack = rvAck(q, f, kind), fix = rvFix(q, f, kind);
      if (!fix) return ack ? ack.replace(/[,，]$/, '') + '.' : rvLine(q, 'miss.hard', v);
      return ack ? `${ack} ${fix}` : fix;
    }
  }
}
// ---- fouls, and the game lost ----
function rvFoul(q, kind, f) {
  const { r, d, carom, v, R } = f;
  switch (kind) {
    case 'lostGame':
      if (R.eightIn) return rvLine(q, r.foul && (d.potted || []).some(([id]) => id === 0) ? 'lost.eight.scratch' : r.foul ? 'lost.eight.foul' : 'lost.eight.early', v) || rvLine(q, 'lost.eight.early', { ...v, left: '' });
      if (R.mode === 'nine' && R.fouls >= 2) return rvLine(q, 'lost.nine.three', v);
      return rvLine(q, 'lost.foul', v);
    case 'scratch': return rvLine(q, R.mode === 'nine' && (d.potted || []).some(([id]) => id === 9) ? 'foul.scratch.nine9' : (d.potted || []).some(([id]) => id !== 0) && v.ball ? 'foul.scratch.pot' : 'foul.scratch', v);
    case 'wrong': {
      const kick = (r.alts || []).some(a => a.way === 'kick' || a.way === 'bank');
      return rvLine(q, R.mode === 'nine' ? 'foul.wrong.nine' : R.mode === 'eight' ? (R.on8 ? 'foul.wrong.eight8' : 'foul.wrong.eight') : kick ? 'foul.wrong.kick' : 'foul.wrong', v) || rvLine(q, 'foul.wrong', v) || '맞혀야 할 공에 먼저 닿지 못했습니다.';
    }
    case 'opening': return rvLine(q, 'foul.opening', v);
    case 'wrongCarom': return rvLine(q, d.first != null && d.first < 2 ? 'foul.wrongCarom' : 'foul.wrongCarom.after', v);
    case 'nohit': return rvLine(q, 'foul.nohit', v);
    case 'norail': return rvLine(q, 'foul.norail', v);
    case 'off': return rvLine(q, d.raised === 'jump' ? 'foul.off.jump' : 'foul.off', v);
  }
  return rvLine(q, 'foul', v);
}
// ---- the table handed over: what the rules make of it (owner 11-19: '후구라서 득점 못하면 지는데') ----
function rvAfter(q, kind, f) {
  const { r, carom, v, R } = f;
  if (kind === 'lostGame') return null;
  if (r.lost && R.chase) return rvLine(q, 'after.chase', v);
  if (r.foul && R.mode === 'nine' && R.fouls === 1) return rvLine(q, 'after.nine.two', v);
  if (r.foul && R.bih) return rvLine(q, 'after.bih', v);
  if (r.foul && r.game === 'four' && game.minus) return rvLine(q, 'after.minus', v);
  if (r.leave == null || r.lost || r.foul && r.grade > 2 || kind === 'none' || /^safety/.test(kind)) return null;
  const safeAt = r.game === 'three' ? 0.3 : 0.5, good = r.leave <= safeAt, bad = r.leave >= 0.9;
  if (R.opp8 && (good || bad)) return rvLine(q, good ? 'after.opp8.good' : 'after.opp8.bad', v);
  if (carom && R.oppLeft === 1 && bad) return rvLine(q, 'after.oppLast.bad', v);
  if (good) return rvLine(q, carom ? 'after.good' : 'after.good.pool', v);
  if (bad) return rvLine(q, carom ? 'after.bad' : 'after.bad.pool', v);
  return null;
}
// ---- a safety ----
function rvSafety(q, kind, f) {
  const { r, carom, v, R } = f, three = r.game === 'three' && (game.cushions || 0) >= 3;
  if (kind === 'safetyGood') {
    const ks = [];
    if (R.opp8) ks.push('safe.good.eight.opp8'); else if (R.mode === 'eight' && R.theirs != null && R.theirs >= 5) ks.push('safe.good.eight.many');
    if (R.mode === 'nine') ks.push('safe.good.nine');
    if (three) ks.push('safe.good.three'); else if (r.game === 'four') ks.push('safe.good.four');
    ks.push(carom ? 'safe.good.carom' : 'safe.good.pool');
    return rvPick(q, 'safe', ks.concat(ks.length > 1 ? [] : []), v);
  }
  const k = kind === 'safetyOk' ? 'safe.ok' : 'safe.bad';
  return rvPick(q, k, [`${k}.${carom ? 'carom' : 'pool'}`, k], v);
}
function rvBody(q, key) {
  const f = rvFacts(q);
  if (/^(won|wonArt|passGood|passBad|tie|jump|masse|art|good|okMade|fluke)$/.test(key)) return rvMade(q, key, f) || '';
  if (/^safety/.test(key)) return rvSafety(q, key, f) || '';
  const head = f.r.foul || key === 'lostGame' ? rvFoul(q, key, f) : rvMiss(q, key, f);
  const after = rvAfter(q, key, f);
  return [head, after].filter(Boolean).join(' ');
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
function rvTip(q, key) {
  const r = q.res, carom = r.game === 'four' || r.game === 'three';
  const k0 = key === 'easyMiss' || key === 'hardMiss' || key === 'chanceMiss' ? r.cause : key === 'none' ? 'choice' : key === 'passBad' ? 'pass'
    : key === 'okMade' ? (r.rule && r.rule.cleared ? 'eight8' : carom ? 'okMadeCarom' : 'okMade') : r.foul && r.rule && r.rule.bih && key !== 'scratch' ? 'bih' : key;
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
  if (a.way === 'combo') return `${rvJ(rvShort(a.via), '으로', '로')} ${rvJ(rvShort(a.id), '을', '를')} 넣는 콤비`;
  return `${rvJ(rvShort(a.id), '을', '를')} ${rvPocket(a.pocket)}에 넣는 ${a.way === 'stun' || a.way === 'follow' || a.way === 'draw' ? way : '길'}`;
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
  const r = q.res;
  if (q._words && q._words.res === r) return q._words.out;
  const at = rvAt; rvAt = q.snap || null;
  q._using = [];
  const key = rvKey(q), name = rvShotName(q), word = RV_WORD[r.grade] || '';
  const title = key === 'fluke' ? `${name}${/[가-힣]$/.test(name) && (name.charCodeAt(name.length - 1) - 0xac00) % 28 ? '에는' : '에'} 행운이 따랐습니다.` : `${rvJ(name, '은', '는')} ${word}.`;
  const main = rvBody(q, key);
  // (the house style: one sentence, now and then one more - the why, only when the first said it in one)
  const tip = (main.match(/[.!]( |$)/g) || []).length <= 1 ? rvTip(q, key) : '';
  q._used = q._using.slice(); q._using = null;
  const out = { word, name, head: title, title, body: [main, tip].filter(Boolean), act: rvAction(q, key), key };
  rvAt = q.snap || at;
  q._words = { res: r, out };
  return out;
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
