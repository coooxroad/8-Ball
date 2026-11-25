/* ================= 랭킹전: finding an opponent, and playing them through the server =================
   The 랭킹전 panel picks a game; the lobby (server/src/ranked.js) pairs this player with someone close in rating, or after a
   while seats a stand-in (a person-like computer player, ai/), which looks like anyone else. Then it is a match like any
   other (50-match.js), with match.ctx.online = the game below:
     each device plays its own shots and sends them to the room; the other's shots come in and are played here the same
     way (the table first put exactly where the shot was struck from), as the computer's shots are (flow.auto);
     a stand-in's shots come from the room, which plays it (owner 11-25 - server/src/ranked.js standInPlan), and are
     lined up here as the computer's are (their preShot); an older server's room (no standInServer) still has them
     worked out here, and sent as its seat's;
     the room plays the whole game again when it ends, and its result - who won, the coins, the rating - is the one shown.
   The seats are the room's: seat 0 on the left. */
// this player's rating in a game's family (economy.js familyOf - each family its own, 11-16), and a rating's tier name
const famDama = mode => net.me ? (net.me.damas ? net.me.damas[familyOf(mode)] : net.me.dama) : ECONOMY.DAMA_START;
const tierName = v => TIERS[Math.min(TIERS.length - 1, tierOf(v))][1];
const RANKED_CLOCK = 60;                      // seconds to shoot in a ranked game
const AIM_LAG = 150, AIM_GAP = 66;            // ms the other player's cue is shown behind; ms between the aims sent while it moves
/* ranked.on, the game being played (or watched), and how it goes:
     playing   - set by play(r) (or watch(r)): the room's { seat, room, token, seed, first, mode, table, opp, standIn, kind,
                 rules, team / side (2:2) } and its look; r kept to open it again (rules, next)
                 inbox: the other seats' shots (and timeouts) heard, played in turn by auto(); n: shots played so far;
                 sent: this device's shots and timeouts, sent again after a reconnect; closing: 'end' or 'resign', until
                 the result; res / mine: the striker's table after a shot and this device's, compared (settled); aimBuf:
                 the other player's cue as heard (aimFrom), aimKey / aimAt: the last aim sent (tick)
     done      - the room's result has come (result): o.result; vaultSeen once the vault's own word has come after it
     after     - a friend's game over, its room kept for 다시 하기: againMine / againTheirs / againLeft, then nexted
     let go    - leave(), or next() for the next room: ranked.on null
   ws is the room's socket while open (connect, retry with tries). */
const ranked = {
  on: null,
  finding: null,                              // waiting in the lobby: { mode, t0, timer }
  // the 랭킹전 panel: the four game panels open (33-desk-play.js), as for 친구와 플레이; picking one starts looking
  pick() {
    if (!net.on) return toast('랭킹전은 온라인에서만 할 수 있습니다.', '', 2200);
    playFor = 'rank'; playStep = 'rank'; playFx = 'fan'; paintHome();
  },
  /* Waiting: the lobby is asked again every two seconds, and a strip at the top says so (#rkBar) with the time waited and
     a way out - meanwhile the rest of the app is free (훈련, 상점, anything). An opponent found: whatever was open is left
     and the game begins. */
  find(mode) {
    ranked.cancel(true);
    const f = ranked.finding = { mode, t0: Date.now(), timer: 0, seek: Math.random().toString(36).slice(2, 12) }, bar = $('#rkBar');
    bar.querySelector('.t').textContent = `${ranked.label(mode)} · 상대 찾는 중`; ranked.strip(true);
    // the clock goes on every second (owner 11-09: it went by two, with the asking), on the strip and on the turned-over
    // card (33-desk-play.js)
    const tick = () => { if (ranked.finding !== f) return clearInterval(f.tick); const s = Math.floor((Date.now() - f.t0) / 1000), tm = minSec(s);
      bar.querySelector('.tm').textContent = tm; for (const t of document.querySelectorAll('.rk-tm')) t.textContent = tm; };
    tick(); f.tick = setInterval(tick, 1000);
    const ask = async () => {
      if (ranked.finding !== f) return;
      const r = await net.queue(mode, f.seek);
      if (ranked.finding !== f) return;
      if (r && r.ok && r.room) { clearInterval(f.tick); ranked.finding = null; ranked.strip(false); ranked.found(r); return; }
      if (r && r.why === 'update') { ranked.cancel(true); toast(`${mode === 'arcade' ? '아케이드' : '랭킹전'}은 업데이트 후 이용할 수 있습니다.`, 'foul', 3200); return; }   // (server/src/version.js)
      // (an answer that is not "waiting" - no connection, the account not known, the server failing - is said on the strip
      // once it has happened twice running, instead of the clock just going on)
      const why = r && r.ok ? null : net.troubleText() || '서버 응답 없음';
      f.fails = why ? (f.fails || 0) + 1 : 0;
      bar.querySelector('.t').textContent = `${ranked.label(mode)} · ` + (f.fails >= 2 ? why : '상대 찾는 중');
      if (why) console.warn('[ranked] queue:', why, r);
      f.timer = setTimeout(ask, 2000);
    };
    ask();
  },
  // an opponent: whatever is going on here is left (a practice, a sheet, the shop) and the game begins
  found(r) {
    closeSheet(); if (flow && flow !== match && st.screen === 'play') { st.phase = 'idle'; st.auto = null; }
    // (a ranked or invited game opens under the league's wall and the two players' cards - 56-league.js; 아케이드 goes to its vote)
    SND.tap(); if ((r.kind || 'ranked') !== 'arcade') vsIntro.start(r, () => ranked.play(r)); else ranked.play(r);
  },
  // (quiet: no sound or strip change asked for - the server's queue is left either way: a search for another game must not
  // leave this one waiting there, to be paired in a game nobody is looking for)
  cancel(quiet) { const f = ranked.finding; if (!f) return; clearTimeout(f.timer); clearInterval(f.tick); ranked.finding = null; ranked.strip(false); net.leaveQueue(f.mode); if (!quiet && st.screen === 'home' && deskTab === 'play' && (playStep === 'rank' || playStep === 'arcade')) paintHome(); },
  // the strip at the top while looking (#rkBar), shown or put away
  strip(on) { $('#rkBar').hidden = !on; app.classList.toggle('rk', on); },
  // what is being looked for, on the strip: a ranked game, or 아케이드's
  label: mode => mode === 'arcade' ? '아케이드 증강 당구' : `랭킹전 ${MODE_KO[mode]}`,

  play(r) {
    // (kind 'invite': a game with a friend who came by a code - 55-invite.js - played the same way, its rules the host's)
    const o = ranked.on = { seat: r.seat, room: r.room, token: r.token, seed: r.seed >>> 0, first: r.first, mode: r.mode, table: r.table || 'bar', opp: r.opp, standIn: r.standIn || null, standInServer: !!r.standInServer, kind: r.kind || 'ranked',
      inbox: [], n: 0, sent: [], ws: null, done: false, aimAt: 0, tries: 0, res: {}, mine: {}, dama: famDama(r.mode), t0: Date.now(), r };
    ranked.connect();
    // (2:2: r.team - the four seats; each side's name is its two players', and whose shot it is goes round - game.js)
    if (r.team) { o.team = r.team; o.side = o.seat % 2; }
    const names = []; if (o.team) { names[0] = `${o.team[0].name}·${o.team[2].name}`; names[1] = `${o.team[1].name}·${o.team[3].name}`; } else { names[o.seat] = prefs.names[0]; names[1 - o.seat] = o.opp.name; }
    const rules = o.rules = r.rules || RANKED_RULES[o.mode];
    o.look = ranked.lookOf(o); useBalls(o.look.ball);
    if (o.kind === 'arcade') arcade.begin(o);                       // (55-arcade.js: the vote and the augments over the table)
    match.start(o.first, ranked.opts(o, rules, names, !!o.team));
    // (copy audit 02-02: no toast - the score bar shows the opponent's name and rating, and the first turn's words are not covered)
  },
  // the match as the room's rules have it (50-match.js start): played or watched, the same game
  opts: (o, rules, names, team) => ({ names, mode: o.mode, ai: false, target: rules.target || 10, cushions: rules.cushions || 0, targets: null, finish: rules.finish || false, ice: false,
    real: rules.real || null, minus: rules.minus !== false, hugu: !!rules.hugu, ot: !!rules.ot, fast: !!rules.fast, online: o, team }),
  /* Watching a friend's game from the list (55-invite.js watch): seat -1, nobody's - every shot is the room's, played
     here as it comes; what was played before coming in is played at once (catchUp), so the table is where it is now.
     Nothing is sent; leaving gives nothing up. The game starts once the room's state has come (seats, seed, rules). */
  watch(r) {
    ranked.leave();
    ranked.on = { watch: true, seat: -1, room: r.room, key: r.watch, mode: r.mode, title: r.title || '', inbox: [], n: 0, sent: [], ws: null, done: false, tries: 0, res: {}, mine: {},
      opp: { name: '' }, kind: 'invite', table: 'bar', standIn: null, started: false };
    ranked.connect();
  },
  watchStart(m) {
    const o = ranked.on; o.started = true; app.classList.add('watching'); o.seed = m.seed >>> 0; o.first = m.first; o.seats = m.seats; o.rules = m.rules;
    if (m.team) o.team = m.seats;
    o.look = ranked.lookOf(o); useBalls(o.look.ball);
    const rules = m.rules || RANKED_RULES[o.mode];
    match.start(o.first, ranked.opts(o, rules, m.team ? [`${m.seats[0].name}·${m.seats[2].name}`, `${m.seats[1].name}·${m.seats[3].name}`] : m.seats.map(s => s.name), !!m.team));
    toast(`관전 중 · ${game.players[0].name} vs ${game.players[1].name}`, '', 2400);
  },
  /* the shots played before a watcher came in, played at once - the table, the score and whose turn it is as they are now -
     all but the last, which is played as it comes (so the watcher sees a shot, not a jump) */
  catchUp() {
    const o = ranked.on; if (!o || !o.watch) return;
    let moved = false;
    while (o.inbox.length > 1 && !game.over) {
      const m = o.inbox.shift(); moved = true;
      if (m.timeout) { game.timeout(); o.n++; continue; }
      const sh = m.shot; highlights.restore(game.world, sh.s); game.placing = null; game.beginShot();
      game.P.strike(game.world, sh.aim, sh.V, sh.a, sh.b, sh.el || 0); game.P.run(game.world, 40); for (const b of game.world.balls) b.wz = 0;
      game.resolve(); o.n++;
    }
    if (moved) { st.rev++; scene.invalidate(); match.cue(); flow.hud(); beginTurn(false); }
  },
  // the room, kept open: a dropped connection is opened again, and what it missed is sent again
  connect() {
    const o = ranked.on; if (!o || (o.done && !o.after)) return;
    let ws; try { ws = new WebSocket(o.watch ? net.watchUrl(o.room, o.key) : net.roomUrl(o.room, o.token)); } catch (e) { return ranked.retry(); }
    o.ws = ws;
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } if (ranked.on === o) ranked.hear(m); };
    ws.onclose = () => { if (ranked.on === o && o.ws === ws) { o.ws = null; ranked.retry(); } };
  },
  // the room's socket let go - at once, or after a moment (later: the last words sent still go out); a socket let go is not
  // opened again (connect's onclose only retries the socket in use)
  unplug(o, later) { const ws = o.ws; if (!ws) return; o.ws = null; if (later) setTimeout(() => ws.close(), later); else try { ws.close(); } catch (e) {} },
  retry() { const o = ranked.on; if (!o || (o.done && !o.after)) return; o.tries++; setTimeout(ranked.connect, Math.min(8000, 600 * o.tries)); },
  // (shots and timeouts are kept to send again after a reconnect; so is the game's end - 'end' or 'resign' - until the
  // room's result comes: sent while the connection was down, it used to be lost, and the room waited on it)
  send(m) { const o = ranked.on; if (!o || o.watch) return; if (m.t === 'shot' || m.t === 'timeout') o.sent.push(m); if (m.t === 'end' || m.t === 'resign') o.closing = m; if (o.ws && o.ws.readyState === 1) o.ws.send(JSON.stringify(m)); },
  hear(m) {
    const o = ranked.on;
    if (m.t === 'state') {
      o.tries = 0;
      if (o.watch && !o.started) {
        if (m.result || m.status !== 'playing') { ranked.on = null; o.done = true; ranked.unplug(o); return toast('경기가 끝났습니다.', 'foul', 2200); }
        ranked.watchStart(m);
      }
      // everything the room has: the other seat's shots not played here yet go in line; ours it missed go again
      const have = m.shots.length;
      const byOf = s => s.by != null ? s.by : s.seat;
      if (m.team && !o.team) o.team = m.team;
      if (m.standInServer) o.standInServer = true;
      for (let i = o.n + o.inbox.length; i < have; i++) if (byOf(m.shots[i]) !== o.seat && (!o.standIn || o.standInServer)) o.inbox.push(Object.assign({ n: i }, m.shots[i].timeout ? { timeout: true } : { shot: m.shots[i] }));
      if (o.watch) return ranked.catchUp();
      // (the room's rules are the rules: a device that began the game on others, before any shot, begins it again on the
      // room's - the 무효 games of 11-16 were a device playing the base rules while the room replayed the tier's)
      if (!o.after && !o.done && m.rules && !have && !o.n && !o.sent.length && !ranked.sameRules(m.rules, o.rules)) {
        o.r = Object.assign({}, o.r, { rules: m.rules }); const r = o.r; ranked.on = null; ranked.unplug(o); return ranked.play(r);
      }
      if (o.after) { if (m.next) return ranked.next(m.next); if (o.againMine && !(m.again || [])[o.seat]) o.ws.send(JSON.stringify({ t: 'again' })); if (m.again) ranked.againHeard({ want: m.again }); return; }
      for (const s of o.sent) if (s.n >= have) o.ws.send(JSON.stringify(s));
      if (m.result) ranked.result(m.result); else if (o.closing) o.ws.send(JSON.stringify(o.closing));
      if (m.arc) arcade.sync(m.arc);                                 // (증강 당구: its steps as the room has them)
      return;
    }
    // (a shot already in line - heard again after a reconnect - is not played twice)
    if ((m.t === 'shot' || m.t === 'timeout') && m.n < o.n + o.inbox.length) return;
    if (m.t === 'shot') { o.inbox.push({ n: m.n, shot: m.shot, plan: m.plan || null }); o.aimBuf = null; }   // (their next turn starts from their next aim, not this one)
    else if (m.t === 'timeout') { o.inbox.push({ n: m.n, timeout: true }); o.aimBuf = null; }
    else if (m.t === 'aim') ranked.aimFrom(m);
    else if (m.t === 'emote') emote.got(m);
    else if (m.t === 'carded' || m.t === 'step') arcade.hear(m);
    else if (m.t === 'res') { o.res[m.n] = m.st; if (o.mine[m.n]) ranked.compare(m.n); }
    else if (m.t === 'away') toast(`${ranked.who(o, m.seat)}의 연결이 끊겼습니다. 30초 안에 돌아오지 않으면 ${o.team ? '그 팀이 집니다' : '승리합니다'}.`, 'foul', 3600);
    else if (m.t === 'back') toast(`${ranked.who(o, m.seat)}이(가) 돌아왔습니다.`, '', 2000);
    else if (m.t === 'result') ranked.result(m);
    else if (m.t === 'again') ranked.againHeard(m);
    else if (m.t === 'next') ranked.next(m);
  },
  // another player by seat, for the words on the screen (1:1 - the opponent)
  who: (o, seat) => o.team ? (o.team[seat] || {}).name || '한 명' : o.opp.name,
  // the rules that decide a game, the same on both sides (target, cushions, finish, 후구 and 연장, minus, add-on)
  sameRules(a, b) { const k = x => JSON.stringify(['target', 'cushions', 'finish', 'hugu', 'ot', 'minus', 'real', 'tens', 'targets'].map(n => x && x[n] != null && x[n] !== false ? x[n] : null)); return k(a) === k(b); },
  /* 다시 하기 (owner 11-15): after a friend's game the room stays open; each asks for another on the result screen's key,
     and once all have the room opens the next (server RoomCore.againHear) - the same seats and rules, the loser first. */
  again() {
    const o = ranked.on; if (!o || o.kind !== 'invite' || o.watch || o.againLeft) return;
    // (pressed before the room's result came: sent as soon as it has - result)
    o.againMine = true; if (o.after && o.ws && o.ws.readyState === 1) o.ws.send(JSON.stringify({ t: 'again' })); ranked.againPaint();
  },
  againHeard(m) {
    const o = ranked.on; if (!o || !o.after) return;
    if (m.left != null) { o.againLeft = true; toast(`${ranked.who(o, m.left)}이(가) 나갔습니다.`, '', 2200); return ranked.againPaint(); }
    if (m.failed) { o.againMine = false; toast('방을 다시 열지 못했습니다. 한 번 더 눌러 주세요.', 'foul', 2400); }
    const was = o.againTheirs; o.againTheirs = (m.want || []).some((x, i) => x && i !== o.seat);
    if (o.againTheirs && !was && !o.againMine) toast(o.team ? '다른 플레이어가 한 판 더 하자고 합니다.' : `${o.opp.name}이(가) 한 판 더 하자고 합니다.`, 'good', 2400);
    ranked.againPaint();
  },
  againPaint() {
    const o = ranked.on, b = $('#againBtn'); if (!b || !o || o.kind !== 'invite' || o.watch) return;
    b.textContent = o.againLeft ? '상대가 나갔습니다' : o.againMine ? '상대를 기다리는 중…' : o.againTheirs ? '다시 하기 · 상대 수락' : '다시 하기';
    b.disabled = !!(o.againLeft || o.againMine);
  },
  // everyone agreed: the next room - this one let go, the new one played as the first was
  next(m) {
    const o = ranked.on; if (!o || !o.after || o.nexted) return; o.nexted = true;
    const r = Object.assign({}, o.r, { room: m.room, seed: m.seed, first: m.first, rules: m.rules || o.r.rules });
    o.after = false; ranked.unplug(o); ranked.on = null;
    closeSheet(); SND.tap(); ranked.play(r);
  },
  // the other player lining up: their cue moves here as it does there
  /* (each heard with the time it came; the picture runs a little behind - AIM_LAG - and moves smoothly between them, so the
     other player's cue swings, stops, pulls back as their hand did, not in jumps. After a still spell the last place is
     put in again just before the new one, so the move starts from where it was then.) */
  aimFrom(m) {
    const o = ranked.on; if (!o || game.turn === o.seat) return;
    const now = performance.now(), b = o.aimBuf || (o.aimBuf = []), last = b[b.length - 1];
    if (last && now - last.t > 220) b.push(Object.assign({}, last, { t: now - AIM_GAP }));
    b.push({ t: now, aim: +m.aim || 0, power: Math.max(0, Math.min(1, +m.power || 0)), sx: m.spin ? +m.spin.x || 0 : 0, sy: m.spin ? +m.spin.y || 0 : 0, el: +m.el || 0,
      pos: Array.isArray(m.pos) && m.pos.length === 2 && m.pos.every(Number.isFinite) ? m.pos : null });
    while (b.length > 2 && b[1].t < now - AIM_LAG - 400) b.shift();
  },
  // the other player online is lining up a shot, and something of it has been heard here
  aiming() { const o = ranked.on; return !!(o && o.aimBuf && o.aimBuf.length && game.shooter() !== o.seat && st.phase === 'auto' && st.auto && !st.auto.plan && (!game.placing || !!o.aimBuf[o.aimBuf.length - 1].pos)); },
  // each frame, the other player's turn: where their cue is now, between the two places heard either side of a moment ago
  aimShow() {
    const o = ranked.on, a = st.auto, b = o && o.aimBuf;
    if (!b || !b.length || game.turn === o.seat || st.phase !== 'auto' || !a || a.plan) return;
    const at = performance.now() - AIM_LAG; let i = 0; while (i < b.length - 1 && b[i + 1].t <= at) i++;
    const p = b[i], q = b[Math.min(b.length - 1, i + 1)], u = q === p || q.t <= p.t ? 1 : Math.max(0, Math.min(1, (at - p.t) / (q.t - p.t)));
    let d = q.aim - p.aim; d -= Math.round(d / (2 * Math.PI)) * 2 * Math.PI;                 // (the short way round)
    const aim = p.aim + d * u, power = p.power + (q.power - p.power) * u, sx = p.sx + (q.sx - p.sx) * u, sy = p.sy + (q.sy - p.sy) * u, el = p.el + (q.el - p.el) * u;
    // the cue ball in their hand: shown where they are putting it (only a picture - their shot brings the place it was put)
    if (game.placing && q.pos) { const c = game.cueBall(), x = p.pos ? p.pos[0] + (q.pos[0] - p.pos[0]) * u : q.pos[0], y = p.pos ? p.pos[1] + (q.pos[1] - p.pos[1]) * u : q.pos[1];
      if (c.x !== x || c.y !== y) { c.x = c.px = x; c.y = c.py = y; st.rev++; scene.invalidate(); } }
    // (all of it compared: a strike point or a raised cue moved alone shows too - Codex B18)
    if (aim === st.aim && power === st.power && sx === st.spin.x && sy === st.spin.y && el === st.el) return;
    st.aim = a.from = aim; st.power = power; setPowerUI(power);
    st.spin = { x: sx, y: sy }; setSpinUI();
    st.el = el; setKindUI(); scene.invalidate();
  },
  /* What each seat has on (gear ids, null the usual; ours from here, theirs from the room) and so what this game looks like:
     each player's own cue and trail, and the ball set and table of whichever player has the rarer (seat 0's if equal). An ice
     table is not a look - it plays differently - so it is never chosen here. */
  lookOf(o) {
    // (2:2: every seat's own cue and trail; the ball set and table the rarest of the four)
    const g = []; if (o.team) o.team.forEach((q, i) => { g[i] = i === o.seat ? ranked.gear() : (q && q.gear) || {}; });
    else if (o.watch) { g[0] = o.seats[0].gear || {}; g[1] = o.seats[1].gear || {}; } else { g[o.seat] = ranked.gear(); g[1 - o.seat] = o.opp.gear || {}; }
    const rar = (L, id) => { const q = L.find(x => x.id === id); return q ? q.rarity || 0 : -1; };
    const rarer = (L, k, usual) => { let w = g[0][k]; for (const x of g) if (rar(L, x[k]) > rar(L, w)) w = x[k]; return L.some(x => x.id === w) ? w : usual; };
    const tbl = rarer(CLOTHS.filter(c => !c.ice), 'table', CLOTHS[0].id), usualCue = Math.max(0, CUES.findIndex(c => !(c.rarity > 0)));
    return { ball: rarer(BALLSKINS, 'ball', BALLSKINS[0].id), cloth: Math.max(0, CLOTHS.findIndex(c => c.id === tbl)),
      cues: g.map(x => { const i = CUES.findIndex(c => c.id === x.cue); return i >= 0 ? i : usualCue; }),
      trails: g.map(x => TRAILS.some(t => t.id === x.trail) ? x.trail : 'none') };
  },
  // (what this player has on, sent when looking for a game - the vault checks each is known: the other player is shown it;
  // card, title: the player card's face and title, seen on the match's opening - 56-league.js)
  gear() { return { cue: (CUES[prefs.cues[0]] || {}).id || null, ball: prefs.ballSkin, table: (CLOTHS[prefs.cloth] || {}).id || null, trail: prefs.trail, card: prefs.card.bg, title: prefs.card.title }; },
  // a turn that is not this device's: the stand-in, worked out here; or the other player's next shot, when it comes
  auto(o) {
    if (o.team && !o.watch) {
      // 2:2: this player's own shot; a computer seat's (the host plays them - its level, from the room); or the room's
      const who = game.shooter(), q = o.team[who], mine = who === o.seat, bot = q && q.bot != null && o.seat === 0;
      game.players[game.turn].ai = !mine;
      if (mine) return null;
      if (bot) { game.levels = [q.bot, q.bot]; return { think: 0.6, showSpin: true, ai: true, plan: a => ranked.planOf(aiAsk(a), false) }; }
    } else if (game.turn === o.seat) return null;
    // (a person-like stand-in lines up its own way - its preShot, played by autoTick - so it needs no fixed wait)
    if (o.standIn && !o.standInServer) return { think: 0.4, showSpin: true, ai: true, resign() { ranked.resign(1 - o.seat); }, plan: a => ranked.planOf(aiAsk(a), true) };
    return { think: o.standIn ? 0.4 : 0, showSpin: true, plan() {
      const m = o.inbox[0]; if (!m) return null;
      o.inbox.shift();
      if (m.timeout) { setTimeout(() => { if (ranked.on === o && flow === match) match.timeout(); }, 0); return null; }
      // the table exactly as it was when they struck (the same physics has brought it there anyway; this keeps it so)
      const sh = m.shot; highlights.restore(game.world, sh.s); game.placing = null;
      // (the room's stand-in: lined up as the computer lines up its own - its preShot - then struck exactly as the room has
      // it, from exactly where the room has the balls: snap, exact)
      if (m.plan && m.plan.preShot) return { angle: sh.aim, V: sh.V, a: sh.a, b: sh.b, el: sh.el || 0, pos: m.plan.pos || null, preShot: m.plan.preShot, snap: sh.s, exact: true };
      return { angle: sh.aim, V: sh.V, a: sh.a, b: sh.b, el: sh.el || 0, pos: null, quick: true };
    } };
  },
  // the computer's plan (aiAsk) as a turn plays it (40-shot.js autoTick); a stand-in's may be an action (resigning)
  planOf: (p, action) => !p ? null : Object.assign({ angle: p.angle, V: p.V, a: p.a || 0, b: p.b || 0, el: p.el || 0, pos: p.pos, preShot: p.preShot }, action ? { action: p.action } : {}),
  // this turn is this device's to send: its player's, its stand-in's, or (2:2, the host) a computer seat's
  ours(o) { const who = game.shooter(); return o.team ? who === o.seat || (o.seat === 0 && !!o.team[who] && o.team[who].bot != null) : game.turn === o.seat || (!!o.standIn && !o.standInServer); },
  // every shot struck here (by this device's player or its stand-in) goes to the room; every shot counts toward the next n
  struck(snap, V, a, b, el) {
    const o = ranked.on; if (!o) return;
    const who = game.shooter();
    o.lastMine = ranked.ours(o);
    // (bh: how long this player's turn took here and how often the app went to the background in it - the room keeps a
    // summary of how a turn was aimed for fair play: server ranked.js aimTook; a stand-in's or a computer seat's: none)
    const own = o.team ? who === o.seat : game.turn === o.seat, bh = own ? { think: Date.now() - (st.turnAt || Date.now()), hid: st.hid || 0 } : undefined;
    if (o.lastMine) ranked.send({ t: 'shot', n: o.n, shot: { s: snap, aim: st.aim, V, a, b, el: el || 0, inHand: !!game.placing }, as: o.team ? who : game.turn, bh });
    o.n++;
  },
  timedOut() {
    const o = ranked.on; if (!o) return;
    const who = game.shooter();
    if (ranked.ours(o)) ranked.send({ t: 'timeout', n: o.n, as: o.team ? who : game.turn });
    o.n++;
  },
  /* After each shot has settled: the device that struck it says how the table and the game stand ('res'); the other compares
     its own and, should they differ, takes the striker's - so the two can never go on playing different games (the physics
     is meant to give the same numbers everywhere, physics.js DMath; this is the guard if it ever does not). */
  settled(turn) {
    const o = ranked.on; if (!o || o.done || o.standIn) return;            // (a stand-in's game is all on this device)
    const n = o.n - 1, st2 = game.serialize();
    if (o.team ? o.lastMine : turn === o.seat) ranked.send({ t: 'res', n, st: st2 });
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
    if (st.phase !== 'aim' || game.shooter() !== o.seat) return;
    const now = Date.now(); if (now - o.aimAt < 66) return;
    // (the cue ball too while it is in hand: where it is being put)
    const c = game.placing ? game.cueBall() : null, pos = c ? [c.x, c.y] : null;
    const k = [st.aim, st.power, st.spin.x, st.spin.y, st.el].concat(pos || []).map(v => Math.round(v * 1e4)).join();
    if (k === o.aimKey) return; o.aimKey = k; o.aimAt = now;
    ranked.send({ t: 'aim', aim: st.aim, power: st.power, spin: st.spin, el: st.el, pos });
  },
  // the game ended here: the room plays it again and says how it ended
  ended() { const o = ranked.on; if (!o) return; ranked.send({ t: 'end' }); },
  resign(as) { const o = ranked.on; if (!o || o.done) return; ranked.send(o.standIn && as === 1 - o.seat ? { t: 'resign', as } : { t: 'resign' }); },
  /* The room's result is the result. Still playing here (the other player resigned or left): it ends now. Already ended
     here with another winner (a shot that did not play out the same, a resignation not taken): the records go back to
     before and the game is finished again with the room's winner - the title, the records, the coins and rating all agree.
     No winner (the room found nobody to blame - neither came, or the game stopped): it ends as 무효, nobody's win or loss. */
  result(m) {
    const o = ranked.on; if (!o || o.done) return;
    if (o.watch) {
      o.done = true; ranked.unplug(o, 500);
      if (flow === match && st.screen === 'play' && !game.over && m.winner != null) game.over = { winner: m.winner, why: '', plain: true };
      return ranked.watchEnd(m);
    }
    o.done = true; o.result = m; o.closing = null;
    const mine = m.winner === (o.team ? o.side : o.seat);
    const why = m.why === 'left' ? (mine ? `${o.opp.name}이(가) 나갔습니다.` : '연결이 끊겨 돌아오지 못했습니다.') : m.why === 'resigned' ? '기권했습니다.'
      : m.why === 'idle' ? (mine ? `${o.opp.name}이(가) 너무 오래 치지 않았습니다.` : '너무 오래 치지 않아 경기가 끝났습니다.')
      : m.why === 'a shot that does not fit' ? '맞지 않는 샷이 있었습니다.' : '경기가 끝났습니다.';
    const undo = () => { const b = match.before; if (!b) return; [0, 1].forEach(i => { rec[game.players[i].name] = b.rec[i]; }); series.s = b.series.slice(); store.set('rec', rec); match.before = null; };
    // (a draw the room's replay ended in - 4구's 후구, game.js - is a result, not 무효)
    const draw = m.winner == null && m.why === 'draw';
    if (flow === match && m.winner == null && !draw && (st.screen === 'play' || st.screen === 'result')) {
      undo(); ranked.voided(m);
    } else if (flow === match && st.screen === 'play' && !game.over) {
      game.over = draw ? { winner: null, draw: true, why: '후구 · 무승부', plain: false } : { winner: m.winner, why, plain: !['left', 'resigned', 'idle', 'a shot that does not fit'].includes(m.why) }; match.finish();
    } else if (flow === match && (st.screen === 'result' || outro.on) && game.over && game.over.winner !== m.winner) {
      undo(); game.over = { winner: m.winner, why: '서버 판정: ' + why }; match.finish(); toast('결과가 다시 확인되어 바뀌었습니다.', 'foul', 3200);
    } else if (st.screen === 'result' || outro.on) ranked.paint();
    // (a friend's game: the room is kept for 다시 하기; anything else is let go)
    if (o.kind === 'invite') { o.after = true; if (o.againMine && o.ws && o.ws.readyState === 1) o.ws.send(JSON.stringify({ t: 'again' })); ranked.againPaint(); }
    else ranked.unplug(o, 500);
    ranked.vault(o);
  },
  /* The vault's word after the room's (owner 11-22: the rating on the 선수증 and the panels came late): the room pays the
     vaults right after it sends the result, so the account is asked soon and again until its rating for the game's family
     has moved (or a few tries) - then the slate's line shows the vault's number (a 승급전 holds it under the next tier) and
     the desk has it. (A flush already under way answers at once without asking: it is tried again.) */
  vault(o, k = 0) {
    setTimeout(() => net.flush().then(() => {
      const r = o.result, fam = familyOf(o.mode), now = net.me && net.me.damas ? net.me.damas[fam] : null;
      const moved = !r || !r.dama || r.dama[o.seat] === o.dama || o.kind === 'invite' || o.kind === 'arcade' || (now != null && now !== o.dama);
      if (moved || k >= 4) { o.vaultSeen = true; if (ranked.on === o && st.screen === 'result') ranked.paint(); }
      else ranked.vault(o, k + 1);
    }), [500, 1200, 2500, 5000, 9000][k]);
  },
  // a watched game over: who won, and back to the hall
  watchEnd(m) {
    const o = ranked.on; if (!o || flow !== match) return;
    st.phase = 'idle'; st.auto = null;
    const w = m && m.winner != null ? m.winner : game.over ? game.over.winner : null, names = o.seats ? o.seats.map(s => s.name) : game.players.map(p => p.name);
    const draw = m ? m.why === 'draw' : !!(game.over && game.over.draw);
    openSheet('관전 종료', [note(draw ? '무승부' : w == null ? '경기가 무효가 되었습니다.' : `${names[w]} 승리`),
      el('button', { class: 'btn cta', text: '방 목록으로', onclick: () => { SND.tap(); closeSheet(); ranked.leave(); goHome(); playStep = 'halls'; playFx = 'hall'; invite.listRooms(); paintHome(); } })]);
  },
  // a game the room could not give to anyone: said so, and back home (no win, no loss on the records)
  voided(m) {
    st.phase = 'idle'; st.auto = null; game.over = { winner: null, why: '무효' }; store.set('save', null);
    openSheet('무효 경기', [note(m.why === 'left' ? '두 사람 모두 들어오지 않아 경기가 성립하지 않았습니다.' : '서버가 승자를 정할 수 없어 무효가 되었습니다. 전적·레이팅은 그대로입니다.'),
      el('button', { class: 'btn cta', text: '처음으로', onclick: () => { SND.tap(); closeSheet(); goHome(); } })]);
  },
  // the result screen's lines for a ranked game: checking, then what it paid
  paint() {
    // (on the charcoal slate beside the result - owner 11-09, after trying them in the sheet)
    const o = ranked.on, side = $('#rSide'); if (!o || !side) return;
    for (const x of side.querySelectorAll('.rk')) x.remove();
    const line = (k, v) => side.appendChild(el('div', { class: 'dk-spec rk' }, [el('span', { text: k }), el('b', { text: v })]));
    if (!o.result) return line(o.kind === 'invite' ? '친구 대결' : o.kind === 'arcade' ? '증강 당구' : '랭킹전', '결과 확인 중…');
    const r = o.result, me = o.seat, d = r.dama[me] - o.dama;
    // (증강 당구 pays nothing yet and moves no rating: only that the room has agreed)
    if (o.kind === 'arcade') return line('증강 당구', '결과 확인됨');
    line('코인', `+${(r.coins[me] || 0).toLocaleString('ko-KR')}`);
    if (o.kind === 'invite') return;
    /* (승급전: the vault keeps the rating under the next tier while a series is on, so its own word is asked for a moment
       after the room's - economy.js PROMO_* - and what came of the game for the series said under the rating) */
    const fam = familyOf(o.mode), now = net.me && net.me.damas && o.vaultSeen ? net.me.damas[fam] : r.dama[me], dv = now - o.dama;
    line('레이팅', `${o.dama} → ${now} (${dv >= 0 ? '+' : ''}${dv})`);
    const pl = net.me && net.me.promoLast, p = net.me && net.me.promo && net.me.promo[fam], tn = t => (TIERS[t] || [])[1] || '';
    if (o.vaultSeen && pl && pl.f === fam && pl.at >= o.t0) line('승급전', pl.what === 'promo' ? `${tn(p ? p.to : 0)} 승급전 시작 · 3판 2선승` : pl.what === 'up' ? `${tierName(now)} 승급!` : pl.what === 'failed' ? '승급전 실패 · 다시 도전' : `강등 방어 · 남은 ${(net.me.shield || {})[fam] || 0}번`);
    else if (o.vaultSeen && p) line('승급전', `${tn(p.to)} · ${p.w}승 ${p.l}패`);
  },
  // leaving the game (home, or the app goes away): it is given up
  leave() { app.classList.remove('watching'); arcade.close(); const o = ranked.on; if (!o) return; if (!o.done && !o.watch) ranked.resign(); o.done = true; o.after = false; ranked.unplug(o); ranked.on = null; },
};
press('#rkCancel', () => ranked.cancel());
// (a turn's times in the background, for the room's summary of how it was aimed - ranked.struck)
document.addEventListener('visibilitychange', () => { if (document.hidden && ranked.on && st.phase === 'aim') st.hid = (st.hid || 0) + 1; });
