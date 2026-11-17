/* What the review's coach says of one shot (50-review.js coach): read from what the judge found (ai/60-judge.js
   judgeShot) - the grade, whether it went in, the line meant and why it missed (thick, thin, soft, hard, the tip), how
   hard that line was, what it left, the better shot and why it was better, a foul and which. Never a number (owner
   11-17: the scores stay inside). Each thing has a few ways of saying it, picked by the shot's number, so two shots
   alike do not read the same. A carom table speaks of points (득점), a pocket table of balls going in. */
function reviewWords(q) {
  const r = q.res, carom = r.game === 'four' || r.game === 'three', pick = L => L[(q.n * 7 + L.length) % L.length];
  const easy = r.p != null && r.p >= 0.8, hard = r.p != null && r.p < 0.4, poorLeave = r.made && r.leave < Math.max(0.25, r.bestLeave * 0.55);
  const b = r.better, goal = carom ? '득점' : '공';
  const title = pick({
    0: ['아름답습니다', '예술입니다', '아름다운 샷입니다'],
    1: ['좋습니다', '좋은 샷입니다', '잘 쳤습니다'],
    2: ['무난합니다', '나쁘지 않습니다', '무난한 샷입니다'],
    3: ['아쉽습니다', '조금 아쉽습니다', '아쉬운 샷입니다'],
    4: ['실수입니다', '아까운 실수입니다', '실수가 나왔습니다'],
  }[r.grade]);
  const say = []; review.saidBetter = false;
  // a foul first: what went wrong is the whole story
  if (r.foul) say.push(pick({
    scratch: ['수구가 포켓에 빠졌어요.', '수구까지 따라 들어갔어요.'],
    wrong: carom ? ['상대 공을 맞혔어요.'] : ['먼저 맞혀야 할 공을 놓쳤어요.', '다른 공을 먼저 맞혔어요.'],
    nohit: ['공을 하나도 맞히지 못했어요.'],
    norail: ['맞힌 뒤 쿠션에 닿은 공이 없었어요.'],
    off: ['공이 테이블 밖으로 나갔어요.'],
    foul: ['파울이 났어요.'],
  }[r.cause] || ['파울이 났어요.']));
  else if (r.won) say.push(pick(['마무리까지 해냈어요.', '경기를 끝내는 한 방이었어요.']));
  else if (r.grade === 0) say.push(pick(hard ? [`어려운 길을 골라 ${carom ? '득점하고' : '넣고'}, 다음 공까지 세워 뒀어요.`, `쉽지 않은 ${carom ? '길' : '공'}이었는데 깔끔하게 ${carom ? '돌렸고' : '넣었고'}, 다음 자리도 좋아요.`] : ['길도, 다음 자리도 완벽했어요.']));
  else if (r.made && r.fluke) say.push(pick([`노린 길이 아니라 ${carom ? '키스' : '다른 공'} 덕분에 ${carom ? '득점됐어요' : '들어갔어요'}.`, '들어가긴 했는데, 다시 치면 안 들어갈 샷이에요.']));
  else if (r.made) {
    if (poorLeave) say.push(pick([`${carom ? '득점은 했지만' : '넣긴 했지만'} 다음 공이 어려워졌어요.`, '다음 자리를 생각했다면 더 좋았을 거예요.']));
    else if (hard) say.push(pick([`어려운 ${carom ? '길' : '공'}이었는데 잘 해냈어요.`, '쉽지 않은 샷을 성공했어요.']));
    else say.push(pick([`깔끔하게 ${carom ? '득점했고' : '넣었고'} 다음 자리도 괜찮아요.`, '정석대로 잘 쳤어요.']));
  } else if (r.meant) {
    const why = {
      thin: ['조준이 조금 얇았어요.', '두께가 얇게 맞았어요.'], thick: ['조준이 조금 두꺼웠어요.', '두께가 두껍게 맞았어요.'],
      soft: ['세기가 약했어요.', '힘이 조금 모자랐어요.'], hard: ['세기가 셌어요.', '힘이 조금 넘쳤어요.'],
      tip: ['당점(회전)이 길을 틀었어요.', '회전이 공을 비껴가게 했어요.'], aim: ['조준이 조금 빗나갔어요.'],
    }[r.cause] || ['조금 빗나갔어요.'];
    say.push('길은 맞았는데 ' + pick(why));
    const chose = hard && b && b.easier && !b.same && !b.safety;
    say.push(easy ? pick(['넣어야 하는 공이었어요.', '쉬운 공이라 더 아까워요.']) : chose ? pick([`더 쉬운 ${goal}을 두고 어려운 길을 골랐어요.`, `굳이 어려운 길로 갔어요. 더 확실한 ${goal}이 있었어요.`]) : hard ? pick(['어려운 공이라 놓칠 수도 있어요.', '쉽지 않은 샷이었어요.']) : '');
    if (chose) review.saidBetter = true;
    if (r.grade <= 2 && r.leave < 0.3) say.push(pick(['그래도 상대에게 쉬운 공을 남기지 않았어요.', '다행히 상대에게 남긴 게 없어요.']));
  } else if (r.grade <= 1) say.push(pick(['상대에게 칠 공을 남기지 않았어요. 좋은 수비예요.', '수비로 충분했어요.']));
  else say.push(pick(['어떤 길을 노렸는지 알기 어려운 샷이에요.', `${carom ? '득점' : '넣을'} 길과는 거리가 있었어요.`]));
  // the better shot, and why it was better
  if (b && !r.won && !review.saidBetter) {
    if (b.safety) say.push(pick(['이 자리에선 수비가 나았어요.', '무리하기보다 상대에게 어려운 공을 남기는 게 좋았어요.']));
    else if (b.same) say.push(pick([`같은 ${carom ? '길' : '공'}이라도 세기와 회전을 바꾸면 다음 자리가 훨씬 좋아요.`, '같은 길, 다른 세기로 다음 공을 세울 수 있었어요.']));
    else if (b.easier) say.push(pick(['더 쉬운 길이 있었어요.', `더 확실한 ${goal}이 있었어요.`]));
    else say.push(pick(['더 좋은 길이 있었어요.', '다음 자리까지 생각한 길이 있었어요.']));
  }
  return { title, text: say.filter(Boolean).join(' ') };
}
