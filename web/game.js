/* Rules, turn flow and statistics for 8-ball, 9-ball, three-ball and four-ball carom. No DOM in here.
   createGame(PH, makeAI): PH the physics of each table; makeAI (createAI, web/ai/) the computer player, left out where
   nobody plays against it (the server's replays). */
// a chance from a seed: the same numbers on every device and on the server (a ranked game's rack and roll-out)
// (state() and seek(): where it has got to, so the computer player can go on from there in a Worker - ai-worker.js)
const seededRandom = s => { s = s >>> 0; const f = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; f.state = () => s; f.seek = v => { s = v >>> 0; }; return f; };
function createGame(PH, makeAI) {
  const typeOf = id => id === 8 ? 'eight' : id < 8 ? 'solid' : 'stripe';
  const GROUP_KO = { solid: '단색', stripe: '줄무늬' };
  const SQ3 = Math.sqrt(3);

  function shuffle(a, rnd) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const jit = rnd => (rnd() - 0.5) * 6e-5;

  const MODES = {
    eight: {
      id: 'eight', name: '8볼', blurb: '내 공 7개 넣고 8번', table: 'pool', n: 16, ballInHand: true,
      setup(g, rnd) {
        const P = g.P, { R, HL } = P, w = g.world;
        const order = shuffle([1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15], rnd);
        const solid = order.find(n => n < 8), stripe = order.find(n => n > 8);
        const rest = order.filter(n => n !== solid && n !== stripe);
        let ri = 0;
        for (let r = 0; r < 5; r++) for (let k = 0; k <= r; k++) {
          const id = r === 2 && k === 1 ? 8 : r === 4 && k === 0 ? solid : r === 4 && k === 4 ? stripe : rest[ri++];
          P.place(w, id, HL / 2 + r * SQ3 * R * 1.0006 + jit(rnd), (k - r / 2) * 2 * R * 1.0006 + jit(rnd), rnd);
        }
        P.place(w, 0, -HL / 2, 0, rnd);
        g.placing = 'kitchen'; g.isBreak = true;
      },
      intro: g => `${g.players[g.turn].name}의 브레이크. 테이블을 끌어 조준하고 큐 막대를 당겼다 놓으세요.`,
      // what the scoreboard shows for one player: a line of text and the balls still to pot
      status(g, pi) {
        const p = g.players[pi], rem = this.remaining(g, pi);
        if (g.potTray) {
          // the balls this player has put away, then a ring for each still to go; the 8 shows once only it is left
          const mine = !p.group ? [] : (p.group === 'solid' ? [1, 2, 3, 4, 5, 6, 7] : [9, 10, 11, 12, 13, 14, 15]).filter(i => !g.world.balls[i].on), tray = mine.slice();
          while (tray.length < 7) tray.push('slot');
          if (rem && !rem.length) tray.push('eight');
          return { sub: p.group ? GROUP_KO[p.group] + ' 공' : '공 미정', tray, pts: null };
        }
        return { sub: p.group ? GROUP_KO[p.group] + ' 공' : '공 미정', tray: !rem ? ['slot', 'slot', 'slot', 'slot', 'slot', 'slot', 'slot'] : rem.length ? rem : ['eight'], pts: null };
      },
      badge: g => { const open = g.players.every(p => !p.group); return { text: g.isBreak ? '브레이크' : open ? '아직 공 미정' : '8번은 마지막에', balls: g.potTray && open ? g.world.balls.filter(b => !b.on && b.id > 0 && b.id !== 8).map(b => b.id) : [], plain: true }; },
      remaining(g, pi) {
        const grp = g.players[pi].group; if (!grp) return null;
        return (grp === 'solid' ? [1, 2, 3, 4, 5, 6, 7] : [9, 10, 11, 12, 13, 14, 15]).filter(i => g.world.balls[i].on);
      },
      legal(g, pi) {
        const rem = this.remaining(g, pi);
        if (!rem) return g.world.balls.filter(b => b.on && b.id !== 0 && b.id !== 8).map(b => b.id);
        return rem.length ? rem : [8];
      },
      ctx(g) { return { turn: g.turn, groups: g.players.map(p => p.group), isBreak: g.isBreak, rem: [0, 1].map(i => { const r = this.remaining(g, i); return r ? r.length : 7; }) }; },
      evaluate(ev, c) {
        const me = c.turn, grp = c.groups[me], open = !grp;
        const potted = ev.pocketed.map(p => p.id), scratch = potted.includes(0), eight = potted.includes(8);
        const obj = potted.filter(i => i !== 0 && i !== 8);
        let foul = null;
        if (ev.firstHit == null) foul = '공을 하나도 맞히지 못했습니다';
        else if (open) { if (ev.firstHit === 8 && !c.isBreak) foul = '8번 공을 먼저 맞혔습니다'; }
        else {
          const need = c.rem[me] > 0 ? grp : 'eight', ft = typeOf(ev.firstHit);
          if (ft !== need) foul = need === 'eight' ? '8번 공을 먼저 맞혀야 합니다' : ft === 'eight' ? '8번 공을 먼저 맞혔습니다' : '상대 공을 먼저 맞혔습니다';
        }
        if (scratch) foul = '큐볼이 포켓에 빠졌습니다';
        if (!foul && potted.length === 0 && !ev.rail) foul = '맞힌 뒤 쿠션에 닿은 공이 없습니다';
        const r = { foul, scratch, respot: [], win: null, why: '', assign: null, keep: false, pts: 0 };
        if (eight) {
          if (c.isBreak) r.respot.push(8);
          else if (foul) { r.win = 1 - me; r.why = '8번 공을 넣으면서 파울이 났습니다.'; }
          else if (open || c.rem[me] > 0) { r.win = 1 - me; r.why = '자기 공이 남았는데 8번 공이 들어갔습니다.'; }
          else { r.win = me; r.why = '자기 공을 모두 넣고 8번 공까지 넣었습니다.'; r.plain = true; }
        }
        if (r.win != null) return r;
        if (open && !c.isBreak && !foul && obj.length) r.assign = typeOf(obj[0]);
        const gr = grp || r.assign;
        if (!foul) { if (c.isBreak) r.keep = obj.length > 0; else if (gr) r.keep = obj.some(i => typeOf(i) === gr); }
        return r;
      },
    },

    nine: {
      id: 'nine', name: '9볼', blurb: '번호 낮은 공부터, 9번 넣으면 승리', table: 'pool', n: 10, ballInHand: true,
      setup(g, rnd) {
        const P = g.P, { R, HL } = P, w = g.world;
        const rest = shuffle([2, 3, 4, 5, 6, 7, 8], rnd);
        const rows = [[0], [-1, 1], [-2, 0, 2], [-1, 1], [0]];
        let ri = 0;
        rows.forEach((row, r) => row.forEach(k => {
          const id = r === 0 ? 1 : r === 2 && k === 0 ? 9 : rest[ri++];
          P.place(w, id, HL / 2 + r * SQ3 * R * 1.0006 + jit(rnd), k * R * 1.0006 + jit(rnd), rnd);
        }));
        P.place(w, 0, -HL / 2, 0, rnd);
        g.placing = 'kitchen'; g.isBreak = true;
      },
      intro: g => `${g.players[g.turn].name}의 브레이크. 테이블을 끌어 조준하고 큐 막대를 당겼다 놓으세요.`,
      status(g, pi) { return { sub: g.turn === pi ? `다음 ${this.lowest(g)}번 공` : `성공 ${g.players[pi].made}`, tray: [], pts: null }; },
      badge(g) { return { text: '다음', balls: g.world.balls.filter(b => b.on && b.id > 0).map(b => b.id), mark: this.lowest(g) }; },
      lowest(g) { for (let i = 1; i <= 9; i++) if (g.world.balls[i].on) return i; return 9; },
      legal(g) { return [this.lowest(g)]; },
      ctx(g) { return { turn: g.turn, isBreak: g.isBreak, lowest: this.lowest(g) }; },
      evaluate(ev, c) {
        const me = c.turn, potted = ev.pocketed.map(p => p.id), scratch = potted.includes(0), nine = potted.includes(9);
        const obj = potted.filter(i => i !== 0);
        let foul = null;
        if (ev.firstHit == null) foul = '공을 하나도 맞히지 못했습니다';
        else if (ev.firstHit !== c.lowest) foul = `${c.lowest}번 공을 먼저 맞혀야 합니다`;
        if (scratch) foul = '큐볼이 포켓에 빠졌습니다';
        if (!foul && potted.length === 0 && !ev.rail) foul = '맞힌 뒤 쿠션에 닿은 공이 없습니다';
        const r = { foul, scratch, respot: [], win: null, why: '', assign: null, keep: false, pts: 0 };
        if (nine) { if (foul) r.respot.push(9); else { r.win = me; r.why = '9번 공을 넣었습니다.'; r.plain = true; return r; } }
        r.keep = !foul && obj.length > 0;
        return r;
      },
    },

    four: {
      id: 'four', name: '4구', blurb: '빨간 공 두 개를 다 맞히면 1점', table: 'carom', n: 4, ballInHand: false, target: true,
      setup(g, rnd) {
        const P = g.P, { HL } = P, w = g.world;
        // the four balls rolled out by hand, as a hall starts a game: each one somewhere new every time - clear of the
        // cushions and of each other, the two reds not touching, the first player's ball not frozen to anything
        const { HW, R } = P, m = 0.12, gap = R * 5;
        for (let tries = 0; tries < 400; tries++) {
          const pts = [0, 1, 2, 3].map(() => [(rnd() * 2 - 1) * (HL - m), (rnd() * 2 - 1) * (HW - m)]);
          let ok = true; for (let i = 0; i < 4 && ok; i++) for (let j = i + 1; j < 4; j++) if (Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]) < gap) { ok = false; break; }
          if (!ok && tries < 399) continue;
          pts.forEach((p, i) => P.place(w, i, p[0], p[1], rnd)); break;
        }
        g.placing = null; g.isBreak = false;
      },
      intro: g => `${g.players[g.turn].name} 선수, 흰 공으로 먼저 칩니다. 빨간 공 두 개를 모두 맞히세요.`,
      // (goal: the points to reach, written faint behind the score; the line under the name is the player's rating - app)
      status: (g, pi) => ({ sub: '', goal: g.targets[pi] * (g.tens ? 10 : 1), tray: [], pts: g.players[pi].score * (g.tens ? 10 : 1) }),
      badge: g => ({ text: g.finish && g.players[g.turn].score === g.targets[g.turn] - 1 ? '마지막 점수 · 쿠션을 거쳐야 인정' : `빨간 공 두 개 맞히면 ${g.tens ? 10 : 1}점`, balls: [] }),
      legal() { return [2, 3]; },
      // last: this player is one point from home and the house rule says that point has to come off a cushion
      ctx(g) { return { turn: g.turn, last: !!g.finish && g.players[g.turn].score === g.targets[g.turn] - 1 }; },
      evaluate(ev, c) {
        const me = c.turn, hitOpp = ev.hits.includes(1 - me);
        const reds = (ev.hits.includes(2) ? 1 : 0) + (ev.hits.includes(3) ? 1 : 0);
        // the other player's ball is a foul (-1) even when both reds were hit too (owner, 2026-11-06)
        const foul = hitOpp ? '상대 공을 맞혔습니다' : reds === 0 ? '빨간 공을 맞히지 못했습니다' : null;
        const short = !foul && reds === 2 && c.last && ev.cushions < 1;
        const pts = foul ? -1 : reds === 2 && !short ? 1 : 0;
        return { foul, scratch: false, respot: [], win: null, why: '', assign: null, keep: pts > 0, pts, note: short ? '마지막 점수는 쿠션을 거쳐야 합니다' : null };
      },
    },
  };

  // Three balls, no pockets: each player has a cue ball (white, yellow) and there is one red. A point for making your cue
  // ball hit both of the others - after it has met as many cushions as the chosen rule asks for (0, 1, or the full three).
  const RULE3 = { 0: '쿠션 없이도 인정', 1: '쿠션 1번 이상', 3: '쿠션 3번 이상' };
  // bed: three-ball is played on the match table - larger, with smaller balls - while four-ball keeps the medium one
  MODES.three = {
    id: 'three', name: '3구', blurb: '내 공으로 나머지 두 공을 다 맞히면 1점', table: 'carom', bed: 'carom3', n: 3, ballInHand: false, target: true, RULE3,
    setup(g, rnd) {
      const P = g.P, { HL } = P, w = g.world;
      P.place(w, 2, HL / 2, 0, rnd); P.place(w, 1 - g.turn, -HL / 2, 0, rnd); P.place(w, g.turn, -HL / 2, -0.18, rnd);
      g.placing = null; g.isBreak = false;
    },
    intro: g => `${g.players[g.turn].name}부터. ${g.cushions ? `쿠션을 ${g.cushions}번 이상 거쳐 ` : ''}두 공을 모두 맞히세요.`,
    status: (g, pi) => ({ sub: '', goal: g.targets[pi], tray: [], pts: g.players[pi].score }),
    badge: g => ({ text: g.cushions ? `쿠션 ${g.cushions}번 + 두 공 = 1점` : '두 공을 다 맞히면 1점', balls: [] }),
    legal(g, me) { return [0, 1, 2].filter(i => i !== me); },
    ctx(g) { return { turn: g.turn, need: g.cushions || 0 }; },
    evaluate(ev, c) {
      const both = ev.hits.length >= 2, ok = both && ev.cushions >= c.need;
      const note = both && !ok ? `쿠션 ${ev.cushions}번 · ${c.need}번이 필요합니다` : ev.firstHit == null ? '아무 공도 맞히지 못했습니다' : null;
      return { foul: null, scratch: false, respot: [], win: null, why: '', assign: null, keep: ok, pts: ok ? 1 : 0, note };
    },
  };

  // A four-ball puzzle: one player, one position, one shot. The app puts the balls down and says what the shot has to do
  // (g.goal): score - both reds, never the yellow;  gather - score and leave the three balls close together;
  // bank - a cushion before any ball;  three - three cushions before the second red;  direct - no cushion at all on the way.
  const GOALS = {
    score: { text: '한 번에 빨간 공 두 개를 맞히세요', miss: '빨간 공 하나만 맞혔습니다' },
    gather: { text: '득점하고, 세 공을 한데 모으세요', miss: '득점했지만 공이 흩어졌습니다' },
    bank: { text: '쿠션부터 맞히고 득점하세요', miss: '쿠션보다 공을 먼저 맞혔습니다' },
    three: { text: '쿠션 3번 이상 돌려서 득점하세요', miss: '쿠션이 3번에 못 미쳤습니다' },
    direct: { text: '쿠션 없이 바로 득점하세요', miss: '쿠션을 거쳤습니다' },
  };
  const GATHER = 0.42;                                              // "together": no two of the three further apart than this
  MODES.puzzle4 = {
    id: 'puzzle4', name: '4구 퍼즐', blurb: '한 번에 빨간 공 두 개를 맞히세요', table: 'carom', n: 4, ballInHand: false, solo: true, GOALS, GATHER,
    setup(g, rnd) { const P = g.P, w = g.world; P.place(w, 2, P.HL / 2, 0, rnd); P.place(w, 3, -P.HL / 2, 0, rnd); P.place(w, 1, -P.HL * 0.78, 0, rnd); P.place(w, 0, -P.HL * 0.78, -0.17, rnd); g.placing = null; g.isBreak = false; },
    legal() { return [2, 3]; },
    ctx(g) { return { turn: g.turn, goal: g.goal || 'score' }; },
    // did the shot do what was asked? w: the table once everything has stopped
    judge(goal, ev, w) {
      const both = ev.hits.includes(2) && ev.hits.includes(3), clean = !ev.hits.includes(1) && !ev.off.length;
      if (!both || !clean) return { ok: false, note: ev.off.length ? '공이 테이블 밖으로 나갔습니다' : ev.hits.includes(1) ? '노란 공을 맞혔습니다' : ev.hits.length ? '빨간 공 하나만 맞혔습니다' : '아무 공도 맞히지 못했습니다' };
      let ok = true;
      if (goal === 'gather') { const b = w.balls, d = (i, j) => Math.hypot(b[i].x - b[j].x, b[i].y - b[j].y); ok = Math.max(d(0, 2), d(0, 3), d(2, 3)) <= GATHER; }
      else if (goal === 'bank') ok = ev.pre >= 1;
      else if (goal === 'three') ok = ev.cushions >= 3;
      else if (goal === 'direct') ok = ev.cushions === 0;
      return { ok, note: ok ? null : GOALS[goal].miss };
    },
    evaluate(ev, c, g) { const j = this.judge(c ? c.goal : 'score', ev, g ? g.world : null); return { foul: null, scratch: false, respot: [], win: null, why: '', assign: null, keep: true, pts: 0, solved: j.ok, note: j.note }; },
  };

  // Practice: one player, no rules, no turns. The app decides what is on the table and what counts as success.
  MODES.practice = {
    id: 'practice', name: '연습', blurb: '자유 연습과 기술 훈련', table: 'pool', n: 16, ballInHand: false, solo: true,
    setup(g, rnd) {
      const P = g.P, w = g.world;
      for (let i = 1; i < 16; i++) { const b = w.balls[i]; P.place(w, i, 9 + i, 9, rnd); b.on = false; }
      P.place(w, 0, -P.HL / 2, 0, rnd); g.placing = null; g.isBreak = false;
    },
    legal(g) { return g.world.balls.filter(b => b.on && b.id !== 0).map(b => b.id); },
    ctx(g) { return { turn: g.turn }; },
    evaluate(ev) { return { foul: null, scratch: ev.pocketed.some(p => p.id === 0), respot: [], win: null, why: '', assign: null, keep: true, pts: 0 }; },
  };

  const mkP = (name, ai) => ({ name, ai: !!ai, group: null, score: 0, shots: 0, made: 0, run: 0, best: 0, fouls: 0 });
  const g = {
    MODES, GROUP_KO, modeId: 'eight', mode: MODES.eight, P: PH.pool, world: null, turn: 0,
    players: [mkP('플레이어 1'), mkP('플레이어 2')], isBreak: true, placing: null, over: null, target: 10, targets: [10, 10], level: 1, _ctx: null,
    tens: false, finish: false, potTray: false, ice: false, masse: true, goal: 'score',
  };

  g.start = function (modeId, names, ai, opts) {
    opts = opts || {};
    g.modeId = modeId; g.mode = MODES[modeId]; g.P = PH[g.mode.bed] || PH[g.mode.table];
    g.world = g.P.makeWorld(g.mode.n); g.world.track = true; g.world.snd = [];
    g.players = [mkP(names[0], false), mkP(names[1], ai)];
    g.turn = opts.first || 0; g.over = null; g.target = opts.target || 10; g.level = opts.level == null ? 1 : opts.level; g.cushions = opts.cushions || 0;
    // targets: each player's own number of points to reach (four-ball handicaps); tens: scores are shown the way a hall counts them
    g.targets = opts.targets ? opts.targets.slice() : [g.target, g.target]; g.tens = !!opts.tens; g.finish = !!opts.finish; g.potTray = !!opts.potTray;
    g.ice = !!opts.ice; g.masse = opts.masse !== false; g.levels = opts.levels || null;
    // personas: a person-like computer opponent for a player (ai/), in place of a level; null for the rest
    g.personas = opts.personas || null;
    // carom: in 4구 the first to play has the white ball and the other the yellow (owner, 11-08: it was the other way).
    // g.yellow is the yellow ball's player; the scene and the HUD paint ball 0 or 1 yellow by it
    g.yellow = g.mode.table === 'carom' && modeId === 'four' ? 1 - g.turn : 1;
    g.mode.setup(g, opts.rnd || Math.random);
    g.world.ice = g.ice;
    g.world.cue = g.mode.table === 'carom' ? g.turn : 0;
  };
  g.cueBall = () => g.world.balls[g.world.cue];
  /* 4구 starts with the balls rolled out across the table, as a hall does it: the four paired off at random, each pair
     gathered in a corner (the two corners of one diagonal, which one by chance) and rolled towards the middle - each ball
     a little off the line and at its own speed - so they meet, scatter and stop somewhere new every time (owner, 11-08).
     The physics then runs until they stop (the app, frame by frame; the server, at once - the same steps, so the same
     places), the same on every device and the server: DMath where physics.js is loaded alongside, and no atan2. */
  g.rollOut = rnd => {
    const M = typeof DMath !== 'undefined' ? DMath : Math, P = g.P, w = g.world, { HL, HW } = P;
    const ids = [0, 1, 2, 3]; for (let i = 3; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = ids[i]; ids[i] = ids[j]; ids[j] = t; }
    const d = rnd() < 0.5 ? 1 : -1, corners = [[1, d], [-1, -d]], NEAR = 0.065, FAR = 0.15;
    corners.forEach(([sx, sy], k) => {
      // the two of a pair side by side in the corner, clear of both cushions and of each other
      P.place(w, ids[2 * k], sx * (HL - NEAR), sy * (HW - FAR), rnd);
      P.place(w, ids[2 * k + 1], sx * (HL - FAR), sy * (HW - NEAR), rnd);
    });
    for (const id of ids) {
      const b = w.balls[id], n = Math.sqrt(b.x * b.x + b.y * b.y), ux = -b.x / n, uy = -b.y / n;
      const off = (rnd() * 2 - 1) * 0.32, c = M.cos(off), s = M.sin(off), v = 1.05 + rnd() * 0.75;
      b.vx = (ux * c - uy * s) * v; b.vy = (ux * s + uy * c) * v;
    }
  };
  g.legal = () => g.mode.legal(g, g.turn);
  /* How far behind a player is, 0 (not, or too early to say) .. 1 (hopeless): what lets a person-like stand-in give up
     or play loosely (ai/53-temper.js), and what the server checks a stand-in's resignation against (server/src/ranked.js) -
     the one rule in one place, so the two can never disagree. Not before six shots in all and three of the player's own. */
  g.farBehind = who => {
    const me = g.players[who], opp = g.players[1 - who]; if (!me || !opp) return 0;
    if (me.shots + opp.shots < 6 || me.shots < 3 || g.isBreak || g.over) return 0;
    if (g.mode.table === 'carom') {
      const a = me.score / g.targets[who], b = opp.score / g.targets[1 - who];
      return b >= 0.7 && opp.score - me.score >= 3 ? Math.max(0, Math.min(1, (b - a - 0.25) / 0.65)) : 0;
    }
    if (g.modeId === 'eight' && me.group && opp.group) {
      const a = g.mode.remaining(g, who).length, b = g.mode.remaining(g, 1 - who).length;
      return b <= 2 && a >= b + 3 ? Math.min(1, (a - b - 2) / 4) : 0;
    }
    if (g.modeId === 'nine' && opp.made >= me.made + 4 && g.mode.lowest(g) >= 7) return 0.6;
    return 0;
  };
  /* How hard the cue ball is struck (m/s) for a power from 0 to 1: 0.35 + B * power^E above LOW. That curve bottoms out at
     0.35 m/s, which already rolls a ball most of half a metre - so below LOW it bends down, smoothly (same value and slope
     where they join), to a touch that moves the ball millimetres.
     The realistic physics (puzzles) keeps the curve the game has always had. The game's physics has a calmer one: half
     power is about two and a half table lengths on a carom table, full power still six; the same curve on every table. */
  const curve = (B, E) => {
    const LOW = 0.15, V_LOW = 0.35 + B * Math.pow(LOW, E), S_LOW = B * E * Math.pow(LOW, E - 1), V_MIN = 0.03,
          C_LOW = (S_LOW - (V_LOW - V_MIN) / LOW) / LOW, B_LOW = (V_LOW - V_MIN) / LOW - C_LOW * LOW;
    return {
      v: power => power >= LOW ? 0.35 + B * Math.pow(power, E) : V_MIN + (B_LOW + C_LOW * power) * Math.max(0, power),
      p: v => v >= V_LOW ? Math.pow((v - 0.35) / B, 1 / E) : v <= V_MIN ? 0 : (-B_LOW + Math.sqrt(B_LOW * B_LOW + 4 * C_LOW * (v - V_MIN))) / (2 * C_LOW)
    };
  };
  const CALM = curve(6.4, 1.6), cv = () => CALM;
  const brk = () => g.isBreak && g.mode.table === 'pool' ? 1.42 : 1;
  g.vOf = power => cv().v(power) * brk();
  g.powerOf = V => cv().p(V / brk());
  g.beginShot = () => { g._ctx = g.mode.ctx(g); g.placing = null; };

  // The shot clock ran out before the player shot: the turn goes to the other player. On a pool table that is a foul and
  // the cue ball is theirs to place anywhere (unless it was the break, which simply passes); on a carom table nothing
  // more happens - no point is lost.
  g.timeout = function () {
    const m = g.mode, me = g.turn, p = g.players[me], nx = 1 - me, name = g.players[nx].name;
    p.run = 0; g.turn = nx;
    let msg = `시간 초과 · ${name} 차례`;
    if (m.ballInHand && !g.isBreak) { p.fouls++; g.placing = 'any'; msg = `시간 초과 · ${name} 차례, 큐볼을 원하는 곳에 놓습니다.`; }
    if (m.table === 'carom') g.world.cue = g.turn;
    return { msg, kind: 'foul', dur: 2600 };
  };

  // Called once every ball has stopped. Applies the result and says what happened.
  g.resolve = function () {
    const m = g.mode, P = g.P, w = g.world, me = g.turn, p = g.players[me];
    const r = m.evaluate(w.ev, g._ctx, g), out = { r, msg: '', kind: '', dur: 1600 };
    for (const b of w.balls) b.wz = 0;
    if (w.ev.off.length) {
      // a ball over the rail is a foul; it comes back on its spot (the cue ball: wherever the other player likes, on a pool table)
      const cueOff = w.ev.off.includes(w.cue);
      r.foul = cueOff ? '큐볼이 테이블 밖으로 나갔습니다' : '공이 테이블 밖으로 나갔습니다'; r.keep = false; r.solved = false;
      if (m.table === 'carom') { r.pts = m.solo ? 0 : -1; for (const id of w.ev.off) { const [x, y] = P.findFree(w, id === 2 ? P.HL / 2 : id === 3 ? -P.HL / 2 : -P.HL * 0.78, id === 0 ? -0.17 : 0, id); P.place(w, id, x, y); } }
      else {
        if (cueOff) r.scratch = true;
        if (r.win === me) { r.win = m.id === 'eight' ? 1 - me : null; r.why = '8번 공을 넣으면서 파울이 났습니다.'; if (m.id === 'nine') r.respot.push(9); }
        for (const id of w.ev.off) if (id !== w.cue && !r.respot.includes(id)) r.respot.push(id);
      }
    }
    for (const id of r.respot) { const [x, y] = P.findFree(w, P.HL / 2, 0, id); P.place(w, id, x, y); }
    if (r.scratch) { const [x, y] = P.findFree(w, -P.HL / 2, 0, 0); P.place(w, 0, x, y); }
    g.isBreak = false;
    p.shots++;
    if (r.foul) p.fouls++;
    if (r.keep || r.win === me) { p.made++; p.run++; p.best = Math.max(p.best, p.run); } else p.run = 0;
    if (r.pts) p.score = Math.max(0, p.score + r.pts);
    if (m.target && p.score >= g.targets[me]) { r.win = me; r.why = g.tens ? `수지 ${g.targets[me] * 10}점을 먼저 다 쳤습니다.` : `먼저 ${g.targets[me]}점을 냈습니다.`; r.plain = true; }
    if (r.win != null) { g.over = { winner: r.win, why: r.why, plain: !!r.plain }; return out; }   // (plain: an ordinary end the score says already)
    if (r.assign) {
      p.group = r.assign; g.players[1 - me].group = r.assign === 'solid' ? 'stripe' : 'solid';
      out.msg = `${p.name}: ${GROUP_KO[r.assign]} 공`; out.kind = 'good'; out.dur = 2400;
    }
    if (r.foul) {
      g.turn = 1 - me; const nx = g.players[g.turn].name;
      if (m.ballInHand) { g.placing = 'any'; out.msg = `파울 · ${r.foul}. ${nx} 차례, 큐볼을 원하는 곳에 놓습니다.`; }
      else out.msg = `파울 · ${r.foul}. ${g.tens ? 10 : 1}점 감점, ${nx} 차례.`;
      out.kind = 'foul'; out.dur = 3400;
    } else if (!r.keep) {
      g.turn = 1 - me; if (!out.msg) out.msg = (r.note ? r.note + '. ' : '') + `${g.players[g.turn].name} 차례`; if (r.note) out.dur = 2600;
    } else if (r.pts > 0) {
      out.msg = `${p.name} ${g.tens ? 10 : 1}점!`; out.kind = 'good';
    } else if (m.id === 'eight' && !r.assign) {
      const rem = m.remaining(g, me);
      if (rem && !rem.length) { out.msg = '이제 8번 공을 넣으면 이깁니다.'; out.kind = 'good'; out.dur = 2400; }
    }
    if (m.table === 'carom') w.cue = g.turn;
    return out;
  };

  // the computer player is ai/ (createAI): given, it answers g.aiPlan()
  if (makeAI) { const ai = makeAI(g); g.aiPlan = ai.plan; }

  g.serialize = () => ({
    v: 2, modeId: g.modeId, balls: g.world.balls.map(b => [b.x, b.y, b.on ? 1 : 0, b.q.slice()]), cue: g.world.cue,
    turn: g.turn, players: g.players, isBreak: g.isBreak, placing: g.placing, target: g.target, level: g.level, cushions: g.cushions,
    targets: g.targets, tens: g.tens, finish: g.finish, potTray: g.potTray, ice: g.ice, masse: g.masse, yellow: g.yellow,
  });
  g.restore = function (d) {
    if (!d || d.v !== 2 || !MODES[d.modeId] || !Array.isArray(d.balls) || d.balls.length !== MODES[d.modeId].n) return false;
    g.modeId = d.modeId; g.mode = MODES[d.modeId]; g.P = PH[g.mode.bed] || PH[g.mode.table]; g.yellow = d.yellow == null ? 1 : d.yellow;
    g.world = g.P.makeWorld(g.mode.n); g.world.track = true; g.world.snd = [];
    d.balls.forEach((s, i) => { const b = g.world.balls[i]; b.x = b.px = s[0]; b.y = b.py = s[1]; b.on = !!s[2]; b.q = s[3]; });
    g.world.cue = d.cue || 0; g.turn = d.turn; g.players = d.players; g.isBreak = d.isBreak; g.placing = d.placing;
    g.target = d.target || 10; g.level = d.level == null ? 1 : d.level; g.cushions = d.cushions || 0; g.over = null; g.levels = null;
    g.targets = Array.isArray(d.targets) ? d.targets : [g.target, g.target]; g.tens = !!d.tens; g.finish = !!d.finish; g.potTray = !!d.potTray;
    g.ice = !!d.ice; g.world.ice = g.ice; g.masse = d.masse !== false;
    return true;
  };
  return g;
}
if (typeof module !== 'undefined') { module.exports = createGame; module.exports.seededRandom = seededRandom; }
