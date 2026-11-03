/* ================= 랭킹전: finding an opponent, and playing them through the server =================
   The 랭킹전 panel picks a game; the lobby (server/src/ranked.js) pairs this player with someone close in DAMA, or after a
   while seats a stand-in (a person-like computer player, ai/), which looks like anyone else. Then it is a match like any
   other (50-match.js), with match.ctx.online = the game below:
     each device plays its own shots and sends them to the room; the other's shots come in and are played here the same
     way (the table first put exactly where the shot was struck from), as the computer's shots are (flow.auto);
     a stand-in's shots are worked out here, and sent as its seat's;
     the room plays the whole game again when it ends, and its result - who won, the coins, the DAMA - is the one shown.
   The seats are the room's: seat 0 on the left. */
const RANKED_CLOCK = 60;                      // seconds to shoot in a ranked game
const AIM_LAG = 150, AIM_GAP = 66;            // ms the other player's cue is shown behind; ms between the aims sent while it moves
const ranked = {
  on: null,                                   // the game being played: { seat, room, token, seed, first, mode, opp, standIn, inbox, n, sent, ws, done }
  finding: null,                              // waiting in the lobby: { mode, t0, timer }
  // the 랭킹전 panel: the four game panels open (33-desk-play.js), as for 친구와 플레이; picking one starts looking
  pick() {
    if (!net.on) return toast('랭킹전은 서버가 열리면 시작합니다.', '', 2200);
    playFor = 'rank'; playStep = 'games'; paintHome();
  },
  /* Waiting: the lobby is asked again every two seconds, and a strip at the top says so (#rkBar) with the time waited and
     a way out - meanwhile the rest of the app is free (훈련, 상점, anything). An opponent found: whatever was open is left
     and the game begins. */
  find(mode) {
    ranked.cancel(true);
    const f = ranked.finding = { mode, t0: Date.now(), timer: 0 }, bar = $('#rkBar');
    bar.querySelector('.t').textContent = `랭킹전 ${MODE_KO[mode]} · 상대 찾는 중`; bar.hidden = false; app.classList.add('rk');
    const ask = async () => {
      if (ranked.finding !== f) return;
      const s = Math.floor((Date.now() - f.t0) / 1000); bar.querySelector('.tm').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      const r = await net.queue(mode);
      if (ranked.finding !== f) return;
      if (r && r.ok && r.room) { ranked.finding = null; bar.hidden = true; app.classList.remove('rk'); ranked.found(r); return; }
      f.timer = setTimeout(ask, 2000);
    };
    ask();
  },
  // an opponent: whatever is going on here is left (a practice, a sheet, the shop) and the game begins
  found(r) {
    closeSheet(); if (flow && flow !== match && st.screen === 'play') { st.phase = 'idle'; st.auto = null; }
    SND.tap(); ranked.play(r);
  },
  cancel(quiet) { const f = ranked.finding; if (!f) return; clearTimeout(f.timer); ranked.finding = null; $('#rkBar').hidden = true; app.classList.remove('rk'); if (!quiet) net.leaveQueue(f.mode); },

  play(r) {
    // (kind 'invite': a game with a friend who came by a code - 55-invite.js - played the same way, its rules the host's)
    const o = ranked.on = { seat: r.seat, room: r.room, token: r.token, seed: r.seed >>> 0, first: r.first, mode: r.mode, opp: r.opp, standIn: r.standIn || null, kind: r.kind || 'ranked',
      inbox: [], n: 0, sent: [], ws: null, done: false, aimAt: 0, tries: 0, res: {}, mine: {}, dama: net.me ? net.me.dama : ECONOMY.DAMA_START };
    ranked.connect();
    const names = []; names[o.seat] = prefs.names[0]; names[1 - o.seat] = o.opp.name;
    const rules = r.rules || RANKED_RULES[o.mode];
    o.look = ranked.lookOf(o); useBalls(o.look.ball);
    match.start(o.first, { names, mode: o.mode, ai: false, target: rules.target || 10, cushions: rules.cushions || 0, targets: null, finish: false, ice: false, online: o });
    toast(o.kind === 'invite' ? `${o.opp.name}와(과) 한 판` : `${o.opp.name} · ${o.opp.dama} 다마`, '', 2600);
  },
  // the room, kept open: a dropped connection is opened again, and what it missed is sent again
  connect() {
    const o = ranked.on; if (!o || o.done) return;
    let ws; try { ws = new WebSocket(net.roomUrl(o.room, o.token)); } catch (e) { return ranked.retry(); }
    o.ws = ws;
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } if (ranked.on === o) ranked.hear(m); };
    ws.onclose = () => { if (ranked.on === o && o.ws === ws) { o.ws = null; ranked.retry(); } };
  },
  retry() { const o = ranked.on; if (!o || o.done) return; o.tries++; setTimeout(ranked.connect, Math.min(8000, 600 * o.tries)); },
  send(m) { const o = ranked.on; if (!o) return; if (m.t === 'shot' || m.t === 'timeout') o.sent.push(m); if (o.ws && o.ws.readyState === 1) o.ws.send(JSON.stringify(m)); },
  hear(m) {
    const o = ranked.on;
    if (m.t === 'state') {
      o.tries = 0;
      // everything the room has: the other seat's shots not played here yet go in line; ours it missed go again
      const have = m.shots.length;
      for (let i = o.n + o.inbox.length; i < have; i++) if (m.shots[i].seat !== o.seat && !o.standIn) o.inbox.push(Object.assign({ n: i }, m.shots[i].timeout ? { timeout: true } : { shot: m.shots[i] }));
      for (const s of o.sent) if (s.n >= have) o.ws.send(JSON.stringify(s));
      if (m.result) ranked.result(m.result);
      return;
    }
    // (a shot already in line - heard again after a reconnect - is not played twice)
    if ((m.t === 'shot' || m.t === 'timeout') && m.n < o.n + o.inbox.length) return;
    if (m.t === 'shot') o.inbox.push({ n: m.n, shot: m.shot });
    else if (m.t === 'timeout') o.inbox.push({ n: m.n, timeout: true });
    else if (m.t === 'aim') ranked.aimFrom(m);
    else if (m.t === 'res') { o.res[m.n] = m.st; if (o.mine[m.n]) ranked.compare(m.n); }
    else if (m.t === 'away') toast(`${o.opp.name}의 연결이 끊겼습니다. 30초 안에 돌아오지 않으면 승리합니다.`, 'foul', 3600);
    else if (m.t === 'back') toast(`${o.opp.name}이(가) 돌아왔습니다.`, '', 2000);
    else if (m.t === 'result') ranked.result(m);
  },
  // the other player lining up: their cue moves here as it does there
  /* (each heard with the time it came; the picture runs a little behind - AIM_LAG - and moves smoothly between them, so the
     other player's cue swings, stops, pulls back as their hand did, not in jumps. After a still spell the last place is
     put in again just before the new one, so the move starts from where it was then.) */
  aimFrom(m) {
    const o = ranked.on; if (!o || game.turn === o.seat) return;
    const now = performance.now(), b = o.aimBuf || (o.aimBuf = []), last = b[b.length - 1];
    if (last && now - last.t > 220) b.push(Object.assign({}, last, { t: now - AIM_GAP }));
    b.push({ t: now, aim: +m.aim || 0, power: Math.max(0, Math.min(1, +m.power || 0)), sx: m.spin ? +m.spin.x || 0 : 0, sy: m.spin ? +m.spin.y || 0 : 0, el: +m.el || 0 });
    while (b.length > 2 && b[1].t < now - AIM_LAG - 400) b.shift();
  },
  // each frame, the other player's turn: where their cue is now, between the two places heard either side of a moment ago
  aimShow() {
    const o = ranked.on, a = st.auto, b = o && o.aimBuf;
    if (!b || !b.length || game.turn === o.seat || st.phase !== 'auto' || !a || a.plan) return;
    const at = performance.now() - AIM_LAG; let i = 0; while (i < b.length - 1 && b[i + 1].t <= at) i++;
    const p = b[i], q = b[Math.min(b.length - 1, i + 1)], u = q === p || q.t <= p.t ? 1 : Math.max(0, Math.min(1, (at - p.t) / (q.t - p.t)));
    let d = q.aim - p.aim; d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI;                 // (the short way round)
    const aim = p.aim + d * u, power = p.power + (q.power - p.power) * u;
    if (aim === st.aim && power === st.power) return;
    st.aim = a.from = aim; st.power = power; setPowerUI(power);
    st.spin = { x: p.sx + (q.sx - p.sx) * u, y: p.sy + (q.sy - p.sy) * u }; setSpinUI();
    st.el = p.el + (q.el - p.el) * u; setKindUI(); scene.invalidate();
  },
  /* What each seat has on (gear ids, null the usual; ours from here, theirs from the room) and so what this game looks like:
     each player's own cue and trail, and the ball set and table of whichever player has the rarer (seat 0's if equal). An ice
     table is not a look - it plays differently - so it is never chosen here. */
  lookOf(o) {
    const g = []; g[o.seat] = ranked.gear(); g[1 - o.seat] = o.opp.gear || {};
    const rar = (L, id) => { const q = L.find(x => x.id === id); return q ? q.rarity || 0 : -1; };
    const rarer = (L, k, usual) => { const a = g[0][k], b = g[1][k], w = rar(L, b) > rar(L, a) ? b : a; return L.some(x => x.id === w) ? w : usual; };
    const tbl = rarer(CLOTHS.filter(c => !c.ice), 'table', CLOTHS[0].id), usualCue = Math.max(0, CUES.findIndex(c => !(c.rarity > 0)));
    return { ball: rarer(BALLSKINS, 'ball', BALLSKINS[0].id), cloth: Math.max(0, CLOTHS.findIndex(c => c.id === tbl)),
      cues: g.map(x => { const i = CUES.findIndex(c => c.id === x.cue); return i >= 0 ? i : usualCue; }),
      trails: g.map(x => TRAILS.some(t => t.id === x.trail) ? x.trail : 'none') };
  },
  gear() { return { cue: (CUES[prefs.cues[0]] || {}).id || null, ball: prefs.ballSkin, table: (CLOTHS[prefs.cloth] || {}).id || null, trail: prefs.trail }; },
  // a turn that is not this device's: the stand-in, worked out here; or the other player's next shot, when it comes
  auto(o) {
    if (game.turn === o.seat) return null;
    // (a person-like stand-in lines up its own way - its preShot, played by autoTick - so it needs no fixed wait)
    if (o.standIn) return { think: 0.4, showSpin: true, ai: true, plan(a) { const p = aiAsk(a); if (!p) return null; return { angle: p.angle, V: p.V, a: p.a || 0, b: p.b || 0, el: p.el || 0, pos: p.pos, preShot: p.preShot }; } };
    return { think: 0, showSpin: true, plan() {
      const m = o.inbox[0]; if (!m) return null;
      o.inbox.shift();
      if (m.timeout) { setTimeout(() => { if (ranked.on === o && flow === match) match.timeout(); }, 0); return null; }
      // the table exactly as it was when they struck (the same physics has brought it there anyway; this keeps it so)
      const sh = m.shot; highlights.restore(game.world, sh.s); game.placing = null;
      return { angle: sh.aim, V: sh.V, a: sh.a, b: sh.b, el: sh.el || 0, pos: null };
    } };
  },
  // every shot struck here (by this device's player or its stand-in) goes to the room; every shot counts toward the next n
  struck(snap, V, a, b, el) {
    const o = ranked.on; if (!o) return;
    if (game.turn === o.seat || o.standIn) ranked.send({ t: 'shot', n: o.n, shot: { s: snap, aim: st.aim, V, a, b, el: el || 0, inHand: !!game.placing }, as: game.turn });
    o.n++;
  },
  timedOut() {
    const o = ranked.on; if (!o) return;
    if (game.turn === o.seat || o.standIn) ranked.send({ t: 'timeout', n: o.n, as: game.turn });
    o.n++;
  },
  /* After each shot has settled: the device that struck it says how the table and the game stand ('res'); the other compares
     its own and, should they differ, takes the striker's - so the two can never go on playing different games (the physics
     is meant to give the same numbers everywhere, physics.js DMath; this is the guard if it ever does not). */
  settled(turn) {
    const o = ranked.on; if (!o || o.done || o.standIn) return;            // (a stand-in's game is all on this device)
    const n = o.n - 1, st2 = game.serialize();
    if (turn === o.seat) ranked.send({ t: 'res', n, st: st2 });
    else { o.mine[n] = st2; if (o.res[n]) ranked.compare(n); }
  },
  compare(n) {
    const o = ranked.on, a = o.res[n], b = o.mine[n]; if (!a || !b) return;
    delete o.res[n]; delete o.mine[n];
    const same = a.turn === b.turn && JSON.stringify(a.placing) === JSON.stringify(b.placing) && a.balls.every((q, i) => q[2] === b.balls[i][2] && (!q[2] || (q[0] === b.balls[i][0] && q[1] === b.balls[i][1])));
    if (same || game.over || o.n !== n + 1) return;
    o.desync = (o.desync || 0) + 1; console.warn('ranked: shot', n, 'came out differently here; the striker\'s table is taken');
    game.restore(a); st.rev++; scene.invalidate(); match.cue(); flow.hud(); beginTurn(false);
  },
  // each frame: this player's aiming, a few times a second, for the other screen
  // (15 a second while it moves, nothing while it is still; and the other player's, shown)
  tick() {
    const o = ranked.on; if (!o || o.done) return;
    ranked.aimShow();
    if (st.phase !== 'aim' || game.turn !== o.seat) return;
    const now = Date.now(); if (now - o.aimAt < 66) return;
    const k = [st.aim, st.power, st.spin.x, st.spin.y, st.el].map(v => Math.round(v * 1e4)).join();
    if (k === o.aimKey) return; o.aimKey = k; o.aimAt = now;
    ranked.send({ t: 'aim', aim: st.aim, power: st.power, spin: st.spin, el: st.el });
  },
  // the game ended here: the room plays it again and says how it ended
  ended() { const o = ranked.on; if (!o) return; ranked.send({ t: 'end' }); },
  resign() { const o = ranked.on; if (!o || o.done) return; ranked.send({ t: 'resign' }); },
  // the room's word: who won, the coins, the DAMA. Ended here already: the result screen gets the numbers; not ended here
  // (the other player resigned or left): it ends now
  result(m) {
    const o = ranked.on; if (!o || o.done) return;
    o.done = true; o.result = m;
    if (flow === match && st.screen === 'play' && !game.over && m.winner != null) {
      game.over = { winner: m.winner, why: m.why === 'left' ? `${o.opp.name}이(가) 나갔습니다.` : m.why === 'resigned' ? '기권했습니다.' : '경기가 끝났습니다.' };
      match.finish();
    } else if (st.screen === 'result') ranked.paint();
    if (o.ws) { const ws = o.ws; o.ws = null; setTimeout(() => ws.close(), 500); }
    net.flush(); setTimeout(() => net.flush(), 3000);              // (the room tells the vaults a moment after)
  },
  // the result screen's lines for a ranked game: checking, then what it paid
  paint() {
    const o = ranked.on, side = $('#rSide'); if (!o || !side) return;
    for (const x of side.querySelectorAll('.rk')) x.remove();
    const line = (k, v) => side.appendChild(el('div', { class: 'dk-spec rk' }, [el('span', { text: k }), el('b', { text: v })]));
    if (!o.result) return line(o.kind === 'invite' ? '친구 대결' : '랭킹전', '결과 확인 중…');
    const r = o.result, me = o.seat, d = r.dama[me] - o.dama;
    line('코인', `+${(r.coins[me] || 0).toLocaleString('ko-KR')}`);
    if (o.kind !== 'invite') line('다마', `${o.dama} → ${r.dama[me]} (${d >= 0 ? '+' : ''}${d})`);
  },
  // leaving the game (home, or the app goes away): it is given up
  leave() { const o = ranked.on; if (!o) return; if (!o.done) ranked.resign(); o.done = true; if (o.ws) o.ws.close(); ranked.on = null; },
};
press('#rkCancel', () => ranked.cancel());
