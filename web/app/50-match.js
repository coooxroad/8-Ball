/* ================= flow: a match between two players (or one and the computer) ================= */
const match = {
  quiet: false, save: true,
  ctx: null,                                              // who is playing what, and under which rules
  pending: null, best: null, worst: null, shots: [], count: 0,                              // the shot in progress, and the best one of the match so far
  start(first, ctx) {
    emote.reset(); review.reset();
    usePhysics(ctx && ctx.online ? ctx.online.table || 'bar' : undefined); scene.clearFalls();
    const c = match.ctx = ctx || { names: [prefs.names[0], oppName()], mode: prefs.mode, ai: prefs.vsAI, target: prefs.target,
      targets: prefs.mode === 'four' ? [sujiOf(0), sujiOf(1)] : null, finish: prefs.mode === 'four' && finishPref(), ice: iceOn(), real: prefs.vsAI ? null : realPref(),   // (add-ons: with a friend only)
      minus: prefs.vsAI || prefs.fourMinus !== false, hugu: prefs.mode === 'four', fast: !!prefs.fast,   // (4구: 마이너스 점수 with a friend, 후구 - game.js)
      bot: prefs.vsAI ? botPersona(botNow()) : null };   // (the computer as the bot picked: 34-desk-bots.js)
    const key = c.names.join('\u0001') + c.mode;
    if (series.key !== key) { series.key = key; series.s = [0, 0]; }
    // a ranked game (54-ranked.js): the rack from the room's seed, so both devices start from the same table; a stand-in in
    // the other seat plays at its level
    const o = c.online, standIn = o && o.standIn;
    game.start(c.mode, c.names, c.ai, { level: prefs.level, target: c.target, first: first || 0, cushions: o ? c.cushions : prefs.rule3, targets: c.targets, tens: !!c.targets, finish: c.finish, potTray: true, ice: !!c.ice, real: c.real || null, minus: c.minus !== false, hugu: !!c.hugu, ot: !!c.ot,
      rnd: o ? seededRandom(o.seed) : undefined, team: !!c.team, levels: standIn ? [standIn.level, standIn.level] : c.bot ? [c.bot.level, c.bot.level] : undefined, personas: standIn ? (o.seat ? [standIn, null] : [null, standIn]) : c.bot ? [null, c.bot] : undefined });
    if (o && (o.watch || o.team)) game.players.forEach(p => { p.ai = true; });   // (2:2: set shot by shot - ranked.auto)
    else if (o) { game.players[o.seat].ai = false; game.players[1 - o.seat].ai = true; }
    // a stand-in's chances come from the room's seed (the same table and seed give the same shot: one day the server can check them)
    game.aiRnd = standIn ? seededRandom((o.seed ^ 0x2545f491) >>> 0) : null;
    game.humanStates = [null, null]; game.humanCanResign = !!standIn;
    match.best = null; match.worst = null; match.shots = []; match.count = 0; match.before = null; match.ult = [0, 0];
    st.aim = 0; match.innings = [0, 0]; match.innings[game.turn] = 1; match.t0 = Date.now(); paintUlt();
    // the log the server plays again before it pays (server/src/check.js): the rules it was played under and every shot
    match.log = o ? null : { v: 1, mode: c.mode, table: prefs.table, opts: { first: first || 0, target: c.target, cushions: prefs.rule3, targets: c.targets, tens: !!c.targets, finish: c.finish, ice: !!c.ice, ...(c.real ? { real: c.real } : {}), ...(c.minus === false ? { minus: false } : {}), ...(c.hugu ? { hugu: true } : {}) }, shots: [], points: [0, 0],
      // (the bot played, for the shot dataset: its rating then - server/src/dataset.js)
      ...(match.ctx.bot ? { bot: { id: match.ctx.bot.bot, rating: match.ctx.bot.dama } } : {}) };
    match.enter();
    // 4구: the balls are rolled out first, then the yellow ball's player begins
    // (watching: at once, as the room's replay does it - the shots after it are played in a moment, catchUp)
    if (c.mode === 'four' && o && o.watch) { game.rollOut(seededRandom((o.seed ^ 0x5bd1e995) >>> 0)); game.P.run(game.world, 40); game.world.ev = game.P.newEv(); st.rev++; beginTurn(true); }
    else if (c.mode === 'four' && (!ctx || o)) { st.phase = 'idle'; flow.hud(); return hold(0.5, () => { if (flow === match) rollOut(o ? seededRandom((o.seed ^ 0x5bd1e995) >>> 0) : undefined); }); }
    { const t = game.mode.intro(game); if (t) toast(t, '', 2600); }
    match.helloLate = false; if (c.bot) { botTalk.clear(); match.hello(1.4); }
    if (!prefs.how && !game.players[game.turn].ai && !o) sheetHow();
  },
  enter() { flow = match; $('#pracBar').hidden = true; $('#p1').hidden = false; scene.setMarks(null); dress(game.ice); scene.setTable(game.P); st.rev++; match.cue(); show('play'); beginTurn(true); },
  cue() { const L = lookNow(); useCue(L ? L.cues[game.shooter()] : prefs.cues[game.players[1].ai ? 0 : game.turn]); },
  restart() { match.start(game.turn, match.ctx); },
  rolled() { game.world.ev = game.P.newEv(); const t = game.mode.intro(game); if (t) toast(t, '', 2600); if (match.ctx.bot && !match.ctx.online) match.hello(0.8); beginTurn(true); },
  /* the bot's first word. Since the opening of 11-21 a game starts under its cover, and the word said then was gone before
     the cover lifted - heard only when a pause brought it back (owner 11-22); so under the cover it waits for it to lift. */
  hello(delay) { if (vsIntro.on) { match.helloLate = true; return; } match.helloLate = false; botTalk.at = 0; botTalk.say('hello', 1, delay); },
  // the shot clock ran out: the turn goes over, as game.timeout() says
  timeout() { if (match.log) match.log.shots.push({ timeout: true }); if (match.ctx.online) ranked.timedOut(); const out = game.timeout(); if (game.over) { toast(out.msg, out.kind, out.dur); return match.finish(); } if (match.innings) match.innings[game.turn]++; SND.bad(); toast(out.msg, out.kind, out.dur); flashOut(out.dur); match.cue(); beginTurn(false); snapshot(); },
  guide: () => GUIDE_STD,
  auto: () => match.ctx.online ? ranked.auto(match.ctx.online) : game.players[game.turn].ai ? (botTalk.say('think', 0.22, 0.3), { think: 0.5, showSpin: true, ai: true, plan(a) { const p = aiAsk(a); if (!p) return null; botTalk.plan = p.decision || null; if ((p.el || 0) > 0.3) botTalk.say('trick', 0.85, 0.1); return { angle: p.angle, V: p.V, a: p.a || 0, b: p.b || 0, el: p.el || 0, pos: p.pos }; } }) : null,
  beforeShot(V, a, b, el) {
    if (match.log) match.log.shots.push({ s: JSON.parse(JSON.stringify(highlights.snapshot(game.world))), aim: st.aim, V, a, b, el: el || 0, inHand: !!game.placing, t: game.turn });
    if (match.ctx.online) ranked.struck(JSON.parse(JSON.stringify(highlights.snapshot(game.world))), V, a, b, el);
    match.pending = { snap: highlights.snapshot(game.world), aim: st.aim, V, a, b, el, turn: game.turn, isBreak: game.isBreak, who: game.players[game.turn].name, inn: match.innings ? Math.max(match.innings[0], match.innings[1]) : 0 };
    review.shot(match.pending); },
  afterShot() {
    const shot = match.pending, ev = game.world.ev, potted = ev.pocketed.filter(q => q.id !== 0).length, out = game.resolve();
    if (shot && ultOn()) { ultShot(match.ult, shot.turn); paintUlt(); }   // (the ultimate's gauge: 아케이드, tried in any game in debug)
    // points as the server counts them (a carom score, or a ball potted on a legal pool shot): what the match pays by
    // (points: a carom table's score, a pool table's legal pots - 스누커's own score, the fouls' points to the other)
    if (match.log && shot) { const r = out.r; if (game.mode.table === 'carom' || game.mode.scored) { if (r.pts > 0) match.log.points[shot.turn] += r.pts; if (r.give) match.log.points[1 - shot.turn] += r.give; } else if (!r.foul) match.log.points[shot.turn] += potted; }
    if (shot) {
      const r = highlights.rate(game.P, game.mode, shot, ev, out.r), bad = highlights.rateWorst(game.P, game.mode, shot, ev, out.r);
      const n = ++match.count;
      if (r.score > (match.best ? match.best.score : 0)) match.best = Object.assign({}, shot, r, { n, good: true });
      if (bad.score > (match.worst ? match.worst.score : 0)) match.worst = Object.assign({}, shot, bad, { n, good: false });
      // shots worth a second look are kept for the highlights at the end (a few of each, the strongest)
      const keep = (x, good) => { match.shots.push(Object.assign({}, shot, x, { n, good })); const same = match.shots.filter(q => q.good === good).sort((p, q) => q.score - p.score); if (same.length > 3) match.shots.splice(match.shots.indexOf(same[3]), 1); };
      if (r.score >= 20) keep(r, true);
      if (bad.score >= 20) keep(bad, false);
    }
    if (match.ctx.online && shot) { ranked.settled(shot.turn); emote.shot(shot.turn, out.r); }
    if (shot && match.ctx.bot) botTalk.shot(shot.turn, out.r, shot && match.shots.length && match.shots[match.shots.length - 1].n === match.count ? match.shots[match.shots.length - 1].score : 0);
    if (game.over) return match.finish();
    if (game.turn !== shot.turn && match.innings) match.innings[game.turn]++;   // (a new visit to the table)
    if (out.msg) toast(out.msg, out.kind, out.dur); match.cue(); beginTurn(false);
  },
  // a player's rating for the score bar: online, the room's for both seats; otherwise the device owner's own on the
  // first plate (the computer, and a friend at the same device, have none)
  rating(i) {
    const o = match.ctx && match.ctx.online;
    if (o && o.team) return null;
    if (o && o.watch) { const r = o.seats && o.seats[i] && o.seats[i].dama; return typeof r === 'number' ? r : null; }
    if (o) { const r = i === o.seat ? o.dama : o.opp && o.opp.dama; return typeof r === 'number' ? r : null; }
    return i === 0 && !game.players[0].ai ? (net.me && typeof net.me.dama === 'number' ? net.me.dama : ECONOMY.DAMA_START) : null;
  },
  hud() {
    emote.sync();
    const m = game.mode, pop = st.phase === 'aim' || st.phase === 'auto' ? game.world.ev.pocketed.map(q => q.id) : null;
    for (let i = 0; i < 2; i++) {
      // under the name the player's rating, then what the game says (the group in 8볼, the next ball in 9볼)
      const s = m.status(game, i), r = match.rating(i); s.sub = [r == null ? '' : `레이팅 ${r}`, s.sub].filter(Boolean).join(' · ');
      // (2:2: under the side's name, whose shot it is)
      const tm = match.ctx && match.ctx.online && match.ctx.online.team; if (tm && game.turn === i) s.sub = [`▶ ${(tm[game.shooter()] || {}).name || ''}`, s.sub].filter(Boolean).join(' · ');
      paintPill(i, Object.assign({ name: game.players[i].name, on: game.turn === i, pop, think: st.phase === 'auto' && game.turn === i && !(st.auto && st.auto.plan) }, s));
    }
    paintBadge(m.name, m.badge(game)); setBusy();
  },
  // the game is over: the records kept, what it paid sent, the result painted, then brought in (finish's helpers below).
  // (an online game's result here is the device's own reading; the room's word may differ - 54-ranked.js result puts the
  // records back as they were before and finishes again with the room's winner, so it is never counted twice)
  finish() {
    if (match.ctx.online && match.ctx.online.watch) return ranked.watchEnd(null);   // (watching: nobody's records)
    const r = matchResult();
    arcade.close();
    keepRecords(r);
    const coins = payMatch(r);
    if (r.on) ranked.ended();
    const pics = paintResult(r, coins);
    review.close(true); review.finishing = true; review.paint(); review.finishing = false;
    SND.win(); MUSIC.play(r.mine ? 'win' : 'lose');          // between friends it is always the winner's song
    revealResult(r, pics);
  },
};

// finish(): the ended game read once - who won, the seat this device played (its title: 승리 or 패배; between friends the
// winner's name), the numbers the result shows. (a draw - 4구's 후구 caught up, game.js: w is null; nobody's win or loss)
function matchResult() {
  const w = game.over.winner, draw = w == null, on = match.ctx.online;
  // (on a ranked game, this device's seat is the room's: 0 or 1; on 2:2 its side)
  const me = on ? (on.team ? on.seat % 2 : on.seat) : 0, solo = match.ctx.ai || !!on, mine = !solo || draw || w === me;
  const carom = game.mode.table === 'carom', inn = match.innings || [1, 1];
  return { w, l: draw ? null : 1 - w, draw, on, me, solo, mine, carom, inn, innings: Math.max(inn[0], inn[1]),
    kind: draw ? 'draw' : mine ? 'win' : 'lose', secs: Math.round((Date.now() - (match.t0 || Date.now())) / 1000),
    word: draw ? '무승부' : solo ? (w === me ? '승리' : '패배') : `${game.players[w].name} 승리`,
    onKo: on && (on.kind === 'invite' ? '친구 초대' : on.kind === 'arcade' ? '아케이드' : '랭킹전'),
    // the score: points on carom (as the hall counts them) and in 스누커 (the frame's), games won in the series on pool
    // (read when painted - after keepRecords, so the series has this game)
    pts: i => carom ? game.players[i].score * (game.tens ? 10 : 1) : game.mode.scored ? game.players[i].score : series.s[i] };
}

// finish(): the records - both players' (an online game's kept as they were first: the room's word may change the winner),
// a bot beaten (the next one opens), the saved game gone
function keepRecords(r) {
  if (r.on && !match.before) match.before = { rec: JSON.parse(JSON.stringify([recOf(game.players[0].name), recOf(game.players[1].name)])), series: series.s.slice() };
  if (!r.draw) countResult(r.w, r.l);
  if (match.ctx.bot && !r.on && r.w === 0) botBeaten(match.ctx.bot.bot);
  store.set('save', null); st.phase = 'idle';
}

// finish(): the coins a game on this device pays, sent to the server (which checks it and may hold back what is over the
// day's allowance); the coins to show. (an online game is paid by the room: its word fills in the slate - 54-ranked.js)
function payMatch(r) {
  if (!match.log || r.on) return 0;
  const kind = match.ctx.ai ? 'cpu' : 'friend', log = Object.assign({}, match.log, { winner: r.w }), coins = matchCoins(kind, game.modeId, log.points, r.w === 0);
  if (ECONOMY.PER_POINT[game.modeId]) net.claim('match', { kind, log });   // (a game with no price yet - 스누커 - is not sent: the server does not know it)
  match.log = null;
  return coins;
}

// finish(): the result painted - the score sheet (title, players, score, the game, stats, highlights), the slate (what the
// game paid - coins; a ranked game's rating, 54-ranked.js paint -, the keys, why it ended, the bot's last word) and,
// sideways, the receipt (50-receipt.js). Returns the highlights' canvases with their shots, drawn once it is showing.
function paintResult(r, coins) {
  const { on, w } = r, bot = match.ctx.bot;
  $('#rTitle').textContent = r.word;
  $('#rTitle').parentNode.classList.toggle('lost', !r.mine);
  resultPlayers(w, r.me, r.solo, r.carom);
  const sc = $('#rScore'); sc.textContent = ''; sc.append(el(w === 0 ? 'b' : 'span', { class: w === 0 ? '' : 'ot', text: r.pts(0) }), el('span', { class: 'sep', text: ':' }), el(w === 1 ? 'b' : 'span', { class: w === 1 ? '' : 'ot', text: r.pts(1) }));
  // (copy audit 07-01, 07-02: the game and the way it was played once, at the top; the innings and the time once, here)
  $('#rMeta').textContent = `${r.innings}이닝 · ${Math.floor(r.secs / 60)}분 ${two(r.secs % 60)}초`;
  $('#rSub').textContent = `${MODE_KO[game.modeId] || game.mode.name} · ${on ? r.onKo : match.ctx.ai ? (bot ? `${bot.name} ${bot.dama}` : '컴퓨터 ' + LEVELS[prefs.level]) : '친구와 플레이'}`;
  const stats = resultStats(r.carom, r.inn);
  // the slate: what the match paid (coins; a ranked game's rating: 54-ranked.js paint) - it no longer repeats the result,
  // the innings, the time or the best run (copy audit 07-02, 07-03)
  const side = $('#rSide'); side.textContent = '';
  const pics = resultHighlights();
  if (coins > 0) side.appendChild(el('div', { class: 'dk-spec' }, [el('span', { text: '코인' }), el('b', { text: `+${coins.toLocaleString('ko-KR')}` })]));
  if (on) ranked.paint();   // (a ranked game: the room plays it again; its word - coins, DAMA - fills in the slate when it comes)
  // (copy audit 07-07: online, the key looks for a new opponent)
  $('#againBtn').textContent = on ? (on.kind === 'invite' ? '다시 하기' : '다시 매칭') : '한 판 더'; $('#againBtn').disabled = false;
  if (on && on.kind === 'invite') ranked.againPaint();
  $('#rWhy').textContent = game.over.plain ? '' : game.over.why;
  // (컴퓨터 대전: the bot's last word, in its language with the Korean under it - copy audit 07-08: only an end the score
  // does not explain)
  { const said = bot && !on && !r.draw ? botTalk.last(w !== 0) : null, b = said && botTalk.bot();
    if (b) side.appendChild(el('div', { class: 'bot-said' }, [el('span', { class: 'who', text: b.name }), el('p', { lang: b.lang, dir: 'auto', text: said[0] }), said[1] && b.lang !== 'ko' ? el('small', { text: said[1] }) : null])); }
  paintReceipt(r, stats);
  return pics;
}

// finish(), sideways: the hall's receipt and its panel (50-receipt.js) - it reads the slate's lines and the review as they come
function paintReceipt(r, stats) {
  const { on, me } = r, other = 1 - me, way = on ? r.onKo : match.ctx.ai ? '컴퓨터 대전' : '친구와 플레이';
  const oppDama = match.ctx.bot ? match.ctx.bot.dama : on && on.opp && typeof on.opp.dama === 'number' ? on.opp.dama : null;
  receipt.paint({ me, kind: r.kind, stamp: r.draw ? '무승부' : r.solo ? (r.w === me ? '승리' : '패배') : '승리', sub: r.solo || r.draw ? 'CUE · PAID' : game.players[r.w].name,
    mode: `${MODE_KO[game.modeId] || game.mode.name} · ${way}`, opp: game.players[other].name + (oppDama != null ? ` (${tierAt(oppDama).name})` : ''),
    innings: r.innings, time: minSec(r.secs), table: 1 + Math.floor((match.t0 || 0) / 1000) % 12,
    stats: stats.map(([k, a, b]) => [k, me === 0 ? a : b]), score: `${r.pts(me)} : ${r.pts(other)}`, name: game.players[me].name });
}

// finish(): the result brought in - not at once (owner 11-21): 승리 / 패배 over the table first (50-outro.js), the word then
// settling into the score sheet as the slate comes in beside it; a ranked game's rating risen or fallen on its ring before
// the receipt (50-rise.js). Already on the result (the room's word changing the winner): at once.
function revealResult(r, pics) {
  const reveal = () => { show('result'); for (const [cv, q] of pics) if (q) drawShot(cv, q); review.paint(); };
  if (st.screen === 'result') return reveal();
  const rated = r.on && r.on.kind !== 'invite' && r.on.kind !== 'arcade' && !app.classList.contains('portrait');
  outro.start({ word: r.word, kind: r.kind, score: `${r.pts(0)} : ${r.pts(1)}` }, rated ? () => rise.wait(reveal) : reveal);
}

// finish(), a decided game: both players' records (wins, losses, streak, form) and the series
function countResult(w, l) {
  const rw = recOf(game.players[w].name), rl = recOf(game.players[l].name);
  rw.w++; rw.streak++; rw.best = Math.max(rw.best, rw.streak); rl.l++; rl.streak = 0;
  rw.form = rw.form.concat('W').slice(-5); rl.form = rl.form.concat('L').slice(-5); store.set('rec', rec);
  series.s[w]++; st.lastLoser = l;
}

// finish(): each player's box on the result - name, record, the side's colour
function resultPlayers(w, me, solo, carom) {
  for (let i = 0; i < 2; i++) {
    const p = game.players[i], r = recOf(p.name), box = $('#rP' + i), won = i === w;
    box.className = 'r-p' + (i ? ' two' : '') + (won ? ' won' : '') + (carom ? (i === (game.yellow == null ? 1 : game.yellow) ? ' yel' : '') : ' pool');
    box.querySelector('.nm').textContent = p.name;
    const rc = box.querySelector('.rc'); rc.textContent = '';
    if (solo && i === me) rc.appendChild(el('span', { class: 'me', text: '나' }));
    rc.appendChild(document.createTextNode(`${r.w}승 ${r.l}패` + (won && r.streak >= 2 ? ` · ${r.streak}연승` : '')));
  }
}

// finish(): the stats, each a row of two bars
function resultStats(carom, inn) {
  const P0 = game.players[0], P1 = game.players[1], pct = p => p.shots ? Math.round(p.made / p.shots * 100) + '%' : '0%';
  const avg = i => (game.players[i].score / Math.max(1, inn[i])).toFixed(2);
  // (스누커: the highest break - the most points in one visit - in place of the longest run of shots)
  const rows = [carom ? ['애버리지', avg(0), avg(1)] : ['넣은 공', P0.made, P1.made], game.mode.scored ? ['최고 브레이크', P0.topBrk || 0, P1.topBrk || 0] : ['최고 연속 득점', P0.best, P1.best], ['득점 성공률', pct(P0), pct(P1)], ['파울', P0.fouls, P1.fouls]];
  const box = $('#rStats'); box.textContent = '';
  for (const [k, a, b] of rows) {
    const na = parseFloat(a) || 0, nb = parseFloat(b) || 0, sum = na + nb || 1;
    box.appendChild(el('div', { class: 'srow' }, [el('b', { text: a }), el('span', { class: 'bar l' }, el('i', { style: `--w:${Math.round(na / sum * 100)}%` })), el('span', { class: 'k', text: k }),
      el('span', { class: 'bar r' }, el('i', { style: `--w:${Math.round(nb / sum * 100)}%` })), el('span', { class: 'n', text: b })]));
  }
  return rows;   // (the receipt prints this player's column: 50-receipt.js)
}

// finish(): the highlights - three places, always (owner 11-21: kept as placeholders for now, to be worked on later):
// 베스트, a highlight, 워스트 - each the shot of the match if there was one (played again when tapped), otherwise an empty
// table saying so. Returns the cards' canvases with their shots (null for an empty one), drawn once the result is showing.
function resultHighlights() {
  const best = match.best, worst = match.worst, same = (p, q) => p && q && p.n === q.n && p.good === q.good;
  const mid = match.shots.filter(q => !same(q, best) && !same(q, worst)).sort((p, q) => q.score - p.score)[0] || null;
  const hl = $('#rHl'); hl.textContent = ''; $('#rHlBox').hidden = false; const pics = [];
  for (const [kind, q, rib] of [['best', best, '베스트 샷'], ['', mid, '하이라이트'], ['worst', worst, '워스트 샷']]) {
    const cv = el('canvas', { class: 'pic' }); pics.push([cv, q]);
    hl.appendChild(el('button', { class: 'hcard' + (kind ? ' ' + kind : '') + (q ? (q.turn === 1 ? ' two' : '') : ' none'), disabled: q ? null : '', onclick: q ? onTap(() => playShot(q, kind ? undefined : 'plain')) : null }, [
      // (copy audit 07-06: what the shot was and who played it; the place's name as a badge)
      el('span', { class: 'tx' }, [el('span', { class: 'tag', text: q ? q.tag : '아직 없음' }), el('span', { class: 'who' }, q ? [el('i', { class: 'av', text: q.turn + 1 }), el('b', { text: q.who })] : [])]),
      cv, el('span', { class: 'rib', text: rib }), q ? el('span', { class: 'go', 'aria-hidden': 'true', text: '▶' }) : null]));
  }
  return pics;
}

/* ---- the shot clock (prefs.shotClock seconds, 0 for none): in a match only, for a player at the table (not the computer),
   while aiming or placing the cue ball, stopped while a sheet or the pause menu is up. It runs down under the scoreboard,
   turns amber in the last ten seconds and red in the last five, ticking each of those. ---- */
let clockShown = -1;
// a ranked game always has one, the same for both (54-ranked.js)
const clockLimit = () => flow === match && match.ctx && match.ctx.online ? RANKED_CLOCK : prefs.shotClock || 0;
function shotClock(dt) {
  const limit = clockLimit(), box = $('#clock'), on = flow === match && st.screen === 'play' && st.phase === 'aim' && limit > 0 && !game.over && !game.players[game.turn].ai;
  if (!on) { if (!box.hidden) box.hidden = true; clockShown = -1; return; }
  const was = Math.ceil(st.clock); st.clock = Math.max(0, st.clock - dt); const s = Math.ceil(st.clock);
  if (box.hidden) box.hidden = false;
  box.style.setProperty('--k', (st.clock / limit).toFixed(4));
  if (s !== clockShown) { clockShown = s; box.querySelector('b').textContent = s; box.dataset.lv = s <= 5 ? '2' : s <= 10 ? '1' : '0'; box.classList.toggle('two', game.turn === 1); }
  if (s < was && s <= 5 && s > 0) SND.tap();
  if (st.clock <= 0) { box.hidden = true; clockShown = -1; match.timeout(); }
}
// time ran out: the scorebug's lower edge burns red for as long as the message stays up
let outT = 0;
function flashOut(ms) { const h = $('#hud'); h.classList.add('out'); clearTimeout(outT); outT = setTimeout(() => h.classList.remove('out'), ms || 2600); }

/* The ultimate's gauge on the game screen (아케이드 증강 당구 - 55-arcade.js ultGauge, game.js ARCADE.ULT): at the bottom
   middle, this device's player's own (online: its seat's). Also shown in any game with the debug setting on (20-sheets.js
   sheetDebug), the gauge of the player whose turn it is. */
const ultOn = () => !!(match.ctx && match.ctx.online && match.ctx.online.kind === 'arcade' && game.modeId === 'arcade') || (net.debug && !!prefs.ultTry);
function paintUlt() {
  let h = $('#ultHud');
  if (!ultOn() || !match.ult) { if (h) h.remove(); return; }
  if (!h) { h = el('div', { id: 'ultHud' }); $('#hud').after(h); }     // (beside the score bar: shown while it is - 10-play.css)
  const o = match.ctx.online, me = o && o.kind === 'arcade' ? o.seat : game.turn;
  h.replaceChildren(ultGauge(match.ult[me], o && o.kind === 'arcade' ? '나' : game.players[me].name));
}
