/* ================= flow: a match between two players (or one and the computer) ================= */
const match = {
  quiet: false, save: true,
  ctx: null,                                              // who is playing what, and under which rules
  pending: null, best: null, worst: null, shots: [], count: 0,                              // the shot in progress, and the best one of the match so far
  start(first, ctx) {
    usePhysics(); scene.clearFalls();
    const c = match.ctx = ctx || { names: [prefs.names[0], oppName()], mode: prefs.mode, ai: prefs.vsAI, target: prefs.target,
      targets: prefs.mode === 'four' ? [sujiOf(0), sujiOf(1)] : null, finish: prefs.mode === 'four' && prefs.finish, ice: iceOn() };
    const key = c.names.join('\u0001') + c.mode;
    if (series.key !== key) { series.key = key; series.s = [0, 0]; }
    game.start(c.mode, c.names, c.ai, { level: prefs.level, target: c.target, first: first || 0, cushions: prefs.rule3, targets: c.targets, tens: !!c.targets, finish: c.finish, potTray: true, ice: !!c.ice }); match.best = null; match.worst = null; match.shots = []; match.count = 0;
    st.aim = 0; match.enter(); toast(game.mode.intro(game), '', 3600);
    if (!prefs.how && !game.players[game.turn].ai) sheetHow();
  },
  enter() { flow = match; $('#pracBar').hidden = true; $('#p1').hidden = false; scene.setMarks(null); dress(game.ice); scene.setTable(game.P); st.rev++; match.cue(); show('play'); beginTurn(true); },
  cue() { useCue(prefs.cues[game.players[1].ai ? 0 : game.turn]); },
  restart() { match.start(game.turn, match.ctx); },
  // the shot clock ran out: the turn goes over, as game.timeout() says
  timeout() { const out = game.timeout(); SND.bad(); toast(out.msg, out.kind, out.dur); flashOut(out.dur); match.cue(); beginTurn(false); snapshot(); },
  guide: () => prefs.guides[game.turn],
  auto: () => game.players[game.turn].ai ? { think: 0.5, showSpin: true, plan() { const p = game.aiPlan(); return { angle: p.angle, V: p.V, a: p.a || 0, b: p.b || 0, el: p.el || 0, pos: p.pos }; } } : null,
  beforeShot(V, a, b, el) { match.pending = { snap: highlights.snapshot(game.world), aim: st.aim, V, a, b, el, turn: game.turn, isBreak: game.isBreak, who: game.players[game.turn].name }; },
  afterShot() {
    const shot = match.pending, ev = game.world.ev, out = game.resolve();
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
    if (game.over) return match.finish();
    toast(out.msg, out.kind, out.dur); match.cue(); beginTurn(false);
  },
  hud() {
    const m = game.mode, pop = st.phase === 'aim' || st.phase === 'auto' ? game.world.ev.pocketed.map(q => q.id) : null;
    for (let i = 0; i < 2; i++) paintPill(i, Object.assign({ name: game.players[i].name, on: game.turn === i, pop, think: st.phase === 'auto' && game.turn === i && !(st.auto && st.auto.plan) }, m.status(game, i)));
    paintBadge(m.name, m.badge(game)); setBusy();
  },
  finish() {
    const w = game.over.winner, l = 1 - w, pw = game.players[w], pl = game.players[l];
    const rw = recOf(pw.name), rl = recOf(pl.name);
    rw.w++; rw.streak++; rw.best = Math.max(rw.best, rw.streak); rl.l++; rl.streak = 0;
    rw.form = rw.form.concat('W').slice(-5); rl.form = rl.form.concat('L').slice(-5); store.set('rec', rec);
    series.s[w]++; st.lastLoser = l; store.set('save', null); st.phase = 'idle';
    // Everything stays on the side it was on during the game: player 1 on the left, player 2 on the right, whoever won.
    $('#rTitle').textContent = deskOn() ? 'FINAL · ' + pw.name + ' 승리' : pw.name + ' 승리';
    for (let i = 0; i < 2; i++) {
      const p = game.players[i], r = recOf(p.name), box = $('#rP' + i), won = i === w;
      box.className = 'r-p' + (i ? ' two' : '') + (won ? ' won' + fireOf(r.streak) : '');
      box.querySelector('.nm').textContent = p.name;
      box.querySelector('.rc').textContent = `${r.w}승 ${r.l}패` + (won && r.streak >= 2 ? ` · ${r.streak}연승 중` : '');
    }
    const sc = $('#rScore'); sc.textContent = ''; sc.append(el(w === 0 ? 'b' : 'span', { text: series.s[0] }), ' : ', el(w === 1 ? 'b' : 'span', { text: series.s[1] }));
    const P0 = game.players[0], P1 = game.players[1], pct = p => p.shots ? Math.round(p.made / p.shots * 100) + '%' : '0%';
    const rows = [['샷 성공률', pct(P0), pct(P1)], ['연속 성공', P0.best, P1.best], [game.mode.target ? '점수' : '친 횟수', game.mode.target ? P0.score : P0.shots, game.mode.target ? P1.score : P1.shots], ['파울', P0.fouls, P1.fouls]];
    const box = $('#rStats'); box.textContent = '';
    for (const [k, a, b] of rows) {
      const na = parseFloat(a) || 0, nb = parseFloat(b) || 0, sum = na + nb || 1;
      box.appendChild(el('div', { class: 'srow' }, [el('b', { text: a }), el('span', { class: 'bar l' }, el('i', { style: `--w:${Math.round(na / sum * 100)}%` })), el('span', { class: 'k', text: k }),
        el('span', { class: 'bar r' }, el('i', { style: `--w:${Math.round(nb / sum * 100)}%` })), el('span', { class: 'n', text: b })]));
    }
    // Highlights: the shots of the match worth watching again, in the order they were played, each a card with its name.
    // Exactly one is the best shot and one the worst.
    const list = match.shots.slice(), has = x => x && list.some(q => q.n === x.n && q.good === x.good);
    const isBest = q => match.best && q.good && q.n === match.best.n, isWorst = q => match.worst && !q.good && q.n === match.worst.n;
    if (match.best && !has(match.best)) list.push(match.best);
    if (match.worst && !has(match.worst)) list.push(match.worst);
    // at most six: the best and the worst always, then the strongest of the rest
    const rank = q => (isBest(q) || isWorst(q) ? 1000 : 0) + q.score; list.sort((p, q) => rank(q) - rank(p)); list.length = Math.min(6, list.length);
    list.sort((p, q) => p.n - q.n || (p.good ? -1 : 1));
    const hl = $('#rHl'); hl.textContent = ''; $('#rHlBox').hidden = !list.length; let b1 = false, w1 = false; const pics = [];
    for (const q of list) {
      const best = !b1 && isBest(q), worst = !w1 && isWorst(q); if (best) b1 = true; if (worst) w1 = true;
      const cv = el('canvas', { class: 'pic' }); pics.push([cv, q]);
      hl.appendChild(el('button', { class: 'hcard' + (best ? ' best' : worst ? ' worst' : q.good ? '' : ' bad') + (q.turn === 1 ? ' two' : ''), onclick: onTap(() => playShot(q, best || worst ? undefined : 'plain')) }, [
        el('span', { class: 'tx' }, [el('span', { class: 'tag', text: q.tag }), el('span', { class: 'when', text: q.n ? q.n + '번째 샷' : '' }), el('span', { class: 'who' }, [el('i', { class: 'av', text: q.turn + 1 }), el('b', { text: q.who })])]),
        cv, best ? el('span', { class: 'rib', text: 'BEST' }) : worst ? el('span', { class: 'rib', text: 'WORST' }) : null, el('span', { class: 'go', text: '▶' })]));
    }
    $('#rWhy').textContent = game.over.why;
    show('result'); SND.win();
    MUSIC.play(!match.ctx.ai || w === 0 ? 'win' : 'lose');          // between friends it is always the winner's song
    for (const [cv, q] of pics) drawShot(cv, q);
  },
};

/* ---- the shot clock (prefs.shotClock seconds, 0 for none): in a match only, for a player at the table (not the computer),
   while aiming or placing the cue ball, stopped while a sheet or the pause menu is up. It runs down under the scoreboard,
   turns amber in the last ten seconds and red in the last five, ticking each of those. ---- */
let clockShown = -1;
function shotClock(dt) {
  const box = $('#clock'), on = flow === match && st.screen === 'play' && st.phase === 'aim' && prefs.shotClock > 0 && !game.over && !game.players[game.turn].ai;
  if (!on) { if (!box.hidden) box.hidden = true; clockShown = -1; return; }
  const was = Math.ceil(st.clock); st.clock = Math.max(0, st.clock - dt); const s = Math.ceil(st.clock);
  if (box.hidden) box.hidden = false;
  box.style.setProperty('--k', (st.clock / prefs.shotClock).toFixed(4));
  if (s !== clockShown) { clockShown = s; box.querySelector('b').textContent = s; box.dataset.lv = s <= 5 ? '2' : s <= 10 ? '1' : '0'; box.classList.toggle('two', game.turn === 1); }
  if (s < was && s <= 5 && s > 0) SND.tap();
  if (st.clock <= 0) { box.hidden = true; clockShown = -1; match.timeout(); }
}
// time ran out: the scorebug's lower edge burns red for as long as the message stays up
let outT = 0;
function flashOut(ms) { const h = $('#hud'); h.classList.add('out'); clearTimeout(outT); outT = setTimeout(() => h.classList.remove('out'), ms || 2600); }

/* ================= flow: the lag (뱅킹) that opens a four-ball match =================
   The two players each send their own ball (first the white, then the yellow) from beside the head string to the far
   cushion and back; whoever's ball comes to rest nearer the head cushion breaks. A ball that never reaches a cushion
   loses the lag. Against the computer it lags too, as well as its level allows. Then the match starts as usual. */
const lag = {
  quiet: false, save: false, d: [null, null],
  start() {
    usePhysics(); scene.clearFalls();
    const names = [prefs.names[0], oppName()];
    game.start('four', names, prefs.vsAI, { level: prefs.level, target: prefs.target, first: 0, targets: [sujiOf(0), sujiOf(1)], tens: true, finish: prefs.finish, ice: iceOn() });
    const P = game.P, w = game.world;
    w.balls[2].on = w.balls[3].on = false;                                // (the reds are not out for the lag)
    P.place(w, 0, -P.HL * 0.62, -P.HW * 0.36); P.place(w, 1, -P.HL * 0.62, P.HW * 0.36);
    lag.d = [null, null]; game.turn = 0; w.cue = 0;
    flow = lag; $('#pracBar').hidden = true; $('#p1').hidden = false; scene.setMarks(null); dress(game.ice); scene.setTable(game.P); st.rev++; useCue(prefs.cues[0]);
    show('play'); lag.turn();
    toast('뱅킹: 먼저 칠 사람을 정합니다. 반대편 쿠션을 맞고 돌아와 헤드 쿠션에 더 가까이 선 공이 이깁니다.', '', 4200);
  },
  turn() { beginTurn(true); st.aim = 0; scene.invalidate(); },             // (aimed straight at the far cushion)
  guide: () => Math.min(0.25, prefs.guides[game.turn]),
  cue() { useCue(prefs.cues[game.players[1].ai ? 0 : game.turn]); },
  // the computer: the speed that brings its ball back closest to the head cushion, as nearly as its level can judge it
  auto: () => game.players[game.turn].ai ? { think: 0.8, showSpin: false, plan() {
    const P = game.P; let best = null;
    for (let k = 0; k <= 40; k++) {
      const V = game.vOf(0.25 + 0.7 * k / 40), t = P.clone(game.world); P.strike(t, 0, V, 0, 0, 0); const ev = P.run(t, 30), d = lag.dist(t, ev);
      if (!best || d < best.d) best = { d, V };
    }
    const miss = [0.09, 0.05, 0.025, 0.01][Math.min(3, prefs.level)];
    return { angle: (Math.random() - 0.5) * miss * 0.4, V: best.V * (1 + (Math.random() * 2 - 1) * miss), a: 0, b: 0, el: 0 };
  } } : null,
  dist(w, ev) { const b = w.balls[w.cue], P = game.P; return ev.railed.includes(w.cue) ? Math.max(0, b.x + P.HL - P.R) : Infinity; },
  beforeShot() {}, restart() { lag.start(); },
  afterShot() {
    const i = game.turn, d = lag.dist(game.world, game.world.ev); lag.d[i] = d;
    const say = d === Infinity ? '쿠션에 닿지 않음' : `헤드 쿠션에서 ${Math.round(d * 100)}cm`;
    if (i === 0) { toast(`${game.players[0].name}: ${say}`, '', 2200); game.turn = 1; game.world.cue = 1; lag.cue(); return hold(1.4, () => { if (flow === lag) lag.turn(); }); }
    const win = lag.d[1] < lag.d[0] ? 1 : 0;
    toast(`${game.players[1].name}: ${say} · ${game.players[win].name}의 뱅킹 승리, 먼저 칩니다.`, 'good', 3000); lag.hud();
    hold(3, () => { if (flow === lag) match.start(win); });
  },
  hud() {
    for (let i = 0; i < 2; i++) {
      const d = lag.d[i], sub = d == null ? (game.turn === i ? '뱅킹 중' : '대기') : d === Infinity ? '쿠션 못 닿음' : `${Math.round(d * 100)}cm`;
      paintPill(i, { name: game.players[i].name, on: game.turn === i && st.phase !== 'hold', sub, pts: null, think: st.phase === 'auto' && game.turn === i && !(st.auto && st.auto.plan) });
    }
    paintBadge('뱅킹', { text: '헤드 쿠션에 가까운 쪽이 먼저' }); setBusy();
  },
};
