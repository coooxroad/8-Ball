/* ================= flow: a match between two players (or one and the computer) ================= */
const match = {
  quiet: false, save: true,
  ctx: null,                                              // who is playing what, and under which rules
  pending: null, best: null, worst: null, shots: [], count: 0,                              // the shot in progress, and the best one of the match so far
  start(first, ctx) {
    emote.reset();
    usePhysics(ctx && ctx.online ? ctx.online.table || 'bar' : undefined); scene.clearFalls();
    const c = match.ctx = ctx || { names: [prefs.names[0], oppName()], mode: prefs.mode, ai: prefs.vsAI, target: prefs.target,
      targets: prefs.mode === 'four' ? [sujiOf(0), sujiOf(1)] : null, finish: prefs.mode === 'four' && finishPref(), ice: iceOn(), real: prefs.vsAI ? null : realPref(),   // (add-ons: with a friend only)
      minus: prefs.vsAI || prefs.fourMinus !== false, hugu: prefs.mode === 'four', fast: !!prefs.fast };   // (4구: 마이너스 점수 with a friend, 후구 - game.js)
    const key = c.names.join('\u0001') + c.mode;
    if (series.key !== key) { series.key = key; series.s = [0, 0]; }
    // a ranked game (54-ranked.js): the rack from the room's seed, so both devices start from the same table; a stand-in in
    // the other seat plays at its level
    const o = c.online, standIn = o && o.standIn;
    game.start(c.mode, c.names, c.ai, { level: prefs.level, target: c.target, first: first || 0, cushions: o ? c.cushions : prefs.rule3, targets: c.targets, tens: !!c.targets, finish: c.finish, potTray: true, ice: !!c.ice, real: c.real || null, minus: c.minus !== false, hugu: !!c.hugu,
      rnd: o ? seededRandom(o.seed) : undefined, team: !!c.team, levels: standIn ? [standIn.level, standIn.level] : undefined, personas: standIn ? (o.seat ? [standIn, null] : [null, standIn]) : undefined });
    if (o && (o.watch || o.team)) game.players.forEach(p => { p.ai = true; });   // (2:2: set shot by shot - ranked.auto)
    else if (o) { game.players[o.seat].ai = false; game.players[1 - o.seat].ai = true; }
    // a stand-in's chances come from the room's seed (the same table and seed give the same shot: one day the server can check them)
    game.aiRnd = standIn ? seededRandom((o.seed ^ 0x2545f491) >>> 0) : null;
    game.humanStates = [null, null]; game.humanCanResign = !!standIn;
    match.best = null; match.worst = null; match.shots = []; match.count = 0; match.before = null;
    st.aim = 0; match.innings = [0, 0]; match.innings[game.turn] = 1; match.t0 = Date.now();
    // the log the server plays again before it pays (server/src/check.js): the rules it was played under and every shot
    match.log = o ? null : { v: 1, mode: c.mode, table: prefs.table, opts: { first: first || 0, target: c.target, cushions: prefs.rule3, targets: c.targets, tens: !!c.targets, finish: c.finish, ice: !!c.ice, ...(c.real ? { real: c.real } : {}), ...(c.minus === false ? { minus: false } : {}), ...(c.hugu ? { hugu: true } : {}) }, shots: [], points: [0, 0] };
    match.enter();
    // 4구: the balls are rolled out first, then the yellow ball's player begins
    // (watching: at once, as the room's replay does it - the shots after it are played in a moment, catchUp)
    if (c.mode === 'four' && o && o.watch) { game.rollOut(seededRandom((o.seed ^ 0x5bd1e995) >>> 0)); game.P.run(game.world, 40); game.world.ev = game.P.newEv(); st.rev++; beginTurn(true); }
    else if (c.mode === 'four' && (!ctx || o)) { st.phase = 'idle'; flow.hud(); return hold(0.5, () => { if (flow === match) rollOut(o ? seededRandom((o.seed ^ 0x5bd1e995) >>> 0) : undefined); }); }
    { const t = game.mode.intro(game); if (t) toast(t, '', 2600); }
    if (!prefs.how && !game.players[game.turn].ai && !o) sheetHow();
  },
  enter() { flow = match; $('#pracBar').hidden = true; $('#p1').hidden = false; scene.setMarks(null); dress(game.ice); scene.setTable(game.P); st.rev++; match.cue(); show('play'); beginTurn(true); },
  cue() { const L = lookNow(); useCue(L ? L.cues[game.shooter()] : prefs.cues[game.players[1].ai ? 0 : game.turn]); },
  restart() { match.start(game.turn, match.ctx); },
  rolled() { game.world.ev = game.P.newEv(); const t = game.mode.intro(game); if (t) toast(t, '', 2600); beginTurn(true); },
  // the shot clock ran out: the turn goes over, as game.timeout() says
  timeout() { if (match.log) match.log.shots.push({ timeout: true }); if (match.ctx.online) ranked.timedOut(); const out = game.timeout(); if (game.over) { toast(out.msg, out.kind, out.dur); return match.finish(); } if (match.innings) match.innings[game.turn]++; SND.bad(); toast(out.msg, out.kind, out.dur); flashOut(out.dur); match.cue(); beginTurn(false); snapshot(); },
  guide: () => GUIDE_STD,
  auto: () => match.ctx.online ? ranked.auto(match.ctx.online) : game.players[game.turn].ai ? { think: 0.5, showSpin: true, ai: true, plan(a) { const p = aiAsk(a); if (!p) return null; return { angle: p.angle, V: p.V, a: p.a || 0, b: p.b || 0, el: p.el || 0, pos: p.pos }; } } : null,
  beforeShot(V, a, b, el) {
    if (match.log) match.log.shots.push({ s: JSON.parse(JSON.stringify(highlights.snapshot(game.world))), aim: st.aim, V, a, b, el: el || 0, inHand: !!game.placing });
    if (match.ctx.online) ranked.struck(JSON.parse(JSON.stringify(highlights.snapshot(game.world))), V, a, b, el);
    match.pending = { snap: highlights.snapshot(game.world), aim: st.aim, V, a, b, el, turn: game.turn, isBreak: game.isBreak, who: game.players[game.turn].name, inn: match.innings ? Math.max(match.innings[0], match.innings[1]) : 0 }; },
  afterShot() {
    const shot = match.pending, ev = game.world.ev, potted = ev.pocketed.filter(q => q.id !== 0).length, out = game.resolve();
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
  finish() {
    if (match.ctx.online && match.ctx.online.watch) return ranked.watchEnd(null);   // (watching: nobody's records)
    // (a draw - 4구's 후구 caught up, game.js: w is null; nobody's win or loss on the records)
    const w = game.over.winner, draw = w == null, l = draw ? null : 1 - w, pw = game.players[w];
    // (an online game's result here is the device's own reading; the room's word may differ - 54-ranked.js result puts the
    // records back as they were before and finishes again with the room's winner, so it is never counted twice)
    if (match.ctx.online && !match.before) match.before = { rec: JSON.parse(JSON.stringify([recOf(game.players[0].name), recOf(game.players[1].name)])), series: series.s.slice() };
    if (!draw) countResult(w, l);
    store.set('save', null); st.phase = 'idle';
    // Everything stays on the side it was on during the game: player 1 on the left, player 2 on the right, whoever won.
    // The title is the one at the table's view: 승리 for whoever played on this device (or the winner between friends).
    // (on a ranked game, this device's seat is the room's: 0 or 1)
    const on = match.ctx.online, me = on ? (on.team ? on.seat % 2 : on.seat) : 0, solo = match.ctx.ai || !!on;
    const mine = !solo || draw || w === me, carom = game.mode.table === 'carom', inn = match.innings || [1, 1];
    $('#rTitle').textContent = draw ? '무승부' : solo ? (w === me ? '승리' : '패배') : `${pw.name} 승리`;
    $('#rTitle').parentNode.classList.toggle('lost', !mine);
    resultPlayers(w, me, solo, carom);
    // the score: points on carom (as the hall counts them) and in 스누커 (the frame's), games won in the series on pool
    const pts = i => carom ? game.players[i].score * (game.tens ? 10 : 1) : game.mode.scored ? game.players[i].score : series.s[i];
    const sc = $('#rScore'); sc.textContent = ''; sc.append(el(w === 0 ? 'b' : 'span', { class: w === 0 ? '' : 'ot', text: pts(0) }), el('span', { class: 'sep', text: ':' }), el(w === 1 ? 'b' : 'span', { class: w === 1 ? '' : 'ot', text: pts(1) }));
    const secs = Math.round((Date.now() - (match.t0 || Date.now())) / 1000), dur = `${Math.floor(secs / 60)}분 ${String(secs % 60).padStart(2, '0')}초`;
    const innings = Math.max(inn[0], inn[1]);
    const onKo = on && (on.kind === 'invite' ? '친구 초대' : '랭킹전');
    // (copy audit 07-01, 07-02: the game and the way it was played once, at the top; the innings and the time once, here)
    $('#rMeta').textContent = `${innings}이닝 · ${dur}`;
    $('#rSub').textContent = `${MODE_KO[game.modeId] || game.mode.name} · ${on ? onKo : match.ctx.ai ? '컴퓨터 ' + LEVELS[prefs.level] : '친구와 플레이'}`;
    resultStats(carom, inn);
    // the slate: what the match paid (coins; a ranked game's rating: 54-ranked.js paint) - it no longer repeats the result,
    // the innings, the time or the best run (copy audit 07-02, 07-03)
    const side = $('#rSide'); side.textContent = '';
    const line = (k, v) => side.appendChild(el('div', { class: 'dk-spec' }, [el('span', { text: k }), el('b', { text: v })]));
    const pics = resultHighlights();
    // the coins it pays, sent to the server (which checks it and may hold back what is over the day's allowance)
    if (match.log && !match.ctx.online) {
      const kind = match.ctx.ai ? 'cpu' : 'friend', log = Object.assign({}, match.log, { winner: w }), coins = matchCoins(kind, game.modeId, log.points, w === 0);
      if (coins > 0) line('코인', `+${coins.toLocaleString('ko-KR')}`);
      // (a game with no price yet - 스누커 - is not sent: the server does not know it)
      if (ECONOMY.PER_POINT[game.modeId]) net.claim('match', { kind, log }); match.log = null;
    }
    // a ranked game: the room plays it again; its word (coins, DAMA) fills in the slate when it comes
    if (on) { ranked.ended(); ranked.paint(); }
    // (copy audit 07-07: online, the key looks for a new opponent)
    $('#againBtn').textContent = on ? '다시 매칭' : '한 판 더';
    $('#rWhy').textContent = game.over.plain ? '' : game.over.why;   // (copy audit 07-08: only an end the score does not explain)
    show('result'); SND.win();
    MUSIC.play(mine ? 'win' : 'lose');          // between friends it is always the winner's song
    for (const [cv, q] of pics) drawShot(cv, q);
  },
};

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
}

// finish(): the highlights - the shots of the match worth watching again, in the order they were played, each a card with
// its name; exactly one is the best shot and one the worst. Returns the cards' canvases with their shots, drawn once the
// result is showing.
function resultHighlights() {
  const list = match.shots.slice(), has = x => x && list.some(q => q.n === x.n && q.good === x.good);
  const isBest = q => match.best && q.good && q.n === match.best.n, isWorst = q => match.worst && !q.good && q.n === match.worst.n;
  if (match.best && !has(match.best)) list.push(match.best);
  if (match.worst && !has(match.worst)) list.push(match.worst);
  // at most three (the tray holds three): the best and the worst always, then the strongest of the rest
  const rank = q => (isBest(q) || isWorst(q) ? 1000 : 0) + q.score; list.sort((p, q) => rank(q) - rank(p)); list.length = Math.min(3, list.length);
  list.sort((p, q) => p.n - q.n || (p.good ? -1 : 1));
  const hl = $('#rHl'); hl.textContent = ''; $('#rHlBox').hidden = !list.length; let b1 = false, w1 = false; const pics = [];
  for (const q of list) {
    const best = !b1 && isBest(q), worst = !w1 && isWorst(q); if (best) b1 = true; if (worst) w1 = true;
    const cv = el('canvas', { class: 'pic' }); pics.push([cv, q]);
    hl.appendChild(el('button', { class: 'hcard' + (best ? ' best' : worst ? ' worst' : q.good ? '' : ' bad') + (q.turn === 1 ? ' two' : ''), onclick: onTap(() => playShot(q, best || worst ? undefined : 'plain')) }, [
      // (copy audit 07-06: what the shot was and who played it; 베스트 / 워스트 as a badge with its word)
      el('span', { class: 'tx' }, [el('span', { class: 'tag', text: q.tag }), el('span', { class: 'who' }, [el('i', { class: 'av', text: q.turn + 1 }), el('b', { text: q.who })])]),
      cv, best ? el('span', { class: 'rib', text: '베스트' }) : worst ? el('span', { class: 'rib', text: '워스트' }) : null, el('span', { class: 'go', 'aria-hidden': 'true', text: '▶' })]));
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
