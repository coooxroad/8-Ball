/* Rules, turn flow and statistics for 8-ball, 9-ball, three-ball and four-ball carom, and snooker. No DOM in here.
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

  // 4구's finish (MODES.four): none, a cushion, or three; true (saves and logs from before 11-10) was the one-cushion rule
  const FINISH = { cushion: '쿠션', three: '쓰리쿠션' };
  // 현실 당구 (add-on): which of its parts are on - throw, squirt, the cue's angle - or null; physics.js reads it from the world
  const realOf = r => r && (r.throw || r.squirt || r.cue) ? { throw: !!r.throw, squirt: !!r.squirt, cue: !!r.cue } : null;
  const finishOf = f => f === 'three' ? 'three' : f === 'cushion' || f === true ? 'cushion' : false;
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
      intro: () => '브레이크',
      // what the scoreboard shows for one player: a line of text and the balls still to pot
      status(g, pi) {
        const p = g.players[pi], rem = this.remaining(g, pi);
        if (g.potTray) {
          // the balls this player has put away, then a ring for each still to go; the 8 shows once only it is left
          const mine = !p.group ? [] : (p.group === 'solid' ? [1, 2, 3, 4, 5, 6, 7] : [9, 10, 11, 12, 13, 14, 15]).filter(i => !g.world.balls[i].on), tray = mine.slice();
          while (tray.length < 7) tray.push('slot');
          if (rem && !rem.length) tray.push('eight');
          return { sub: p.group ? GROUP_KO[p.group] + ' 공' : '', tray, pts: null };
        }
        return { sub: p.group ? GROUP_KO[p.group] + ' 공' : '', tray: !rem ? ['slot', 'slot', 'slot', 'slot', 'slot', 'slot', 'slot'] : rem.length ? rem : ['eight'], pts: null };
      },
      badge: g => { const open = g.players.every(p => !p.group); return { text: g.isBreak ? '브레이크' : open ? '그룹 미정' : '8번은 마지막에', balls: g.potTray && open ? g.world.balls.filter(b => !b.on && b.id > 0 && b.id !== 8).map(b => b.id) : [], plain: true }; },
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
        // (WPA) a break stands only if a ball is potted or four object balls reach a cushion: else the other player breaks
        // again, from a new rack (owner 11-09: the rules as they are)
        if (c.isBreak && !potted.some(i => i !== 0) && ev.railed.filter(i => i !== 0).length < 4)
          return { foul: '브레이크 불성립', scratch: false, respot: [], win: null, why: '', assign: null, keep: false, pts: 0, rerack: true };
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
      intro: () => '브레이크',
      status(g, pi) { return { sub: g.turn === pi ? `다음 ${this.lowest(g)}번 공` : '', tray: [], pts: null }; },
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
        // (WPA) a break stands only if a ball is potted or four object balls reach a cushion: else a foul
        if (!foul && c.isBreak && !obj.length && ev.railed.filter(i => i !== 0).length < 4) foul = '브레이크 불성립';
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
      /* The finish (마무리, chosen with the game - owner 11-10: the points and the cushion are two things): with one, a
         player who has made all their points is not done - they must then finish, the two reds again, the cue ball
         round at least one cushion ('cushion') or three ('three') before the second red. A miss or a foul there passes
         the turn and costs nothing (owner 11-10: no points lost while finishing). */
      FINISH,
      intro: g => g.finish ? FINISH[g.finish] + ' 마무리' : '',
      // (goal: the points to reach, written faint behind the score; the line under the name is the player's rating - app)
      status: (g, pi) => ({ sub: '', goal: g.targets[pi] * (g.tens ? 10 : 1), tray: [], pts: Math.min(g.players[pi].score, g.targets[pi]) * (g.tens ? 10 : 1) }),
      badge: g => ({ text: g.finish && g.players[g.turn].score >= g.targets[g.turn] ? `마무리 · ${FINISH[g.finish]}` : `빨간 공 두 개 맞히면 ${g.tens ? 10 : 1}점`, balls: [] }),
      legal() { return [2, 3]; },
      // last: this player has all their points and the game is played with a finish; need: the cushions it asks for
      // minus: a foul costs a point (a game with a friend may play without - owner 11-10)
      ctx(g) { const last = !!g.finish && g.players[g.turn].score >= g.targets[g.turn]; return { turn: g.turn, last, need: last ? (g.finish === 'three' ? 3 : 1) : 0, minus: g.minus }; },
      evaluate(ev, c) {
        const me = c.turn, hitOpp = ev.hits.includes(1 - me);
        const reds = (ev.hits.includes(2) ? 1 : 0) + (ev.hits.includes(3) ? 1 : 0);
        // the other player's ball is a foul (-1) even when both reds were hit too (owner, 2026-11-06)
        const foul = hitOpp ? '상대 공을 맞혔습니다' : reds === 0 ? '빨간 공을 맞히지 못했습니다' : null;
        if (c.last && foul) return { foul, scratch: false, respot: [], win: null, why: '', assign: null, keep: false, pts: 0 };
        if (c.last) {
          const done = reds === 2 && ev.cushions >= c.need;
          return { foul: null, scratch: false, respot: [], win: done ? me : null, why: done ? `${c.need >= 3 ? '쓰리쿠션' : '쿠션'} 마무리` : '', assign: null, keep: done, pts: done ? 1 : 0,
            note: !done && reds === 2 ? `쿠션 ${ev.cushions}번 · 마무리는 ${c.need}번 이상` : null };
        }
        const pts = foul ? (c.minus === false ? 0 : -1) : reds === 2 ? 1 : 0;
        return { foul, scratch: false, respot: [], win: null, why: '', assign: null, keep: pts > 0, pts };
      },
    },
  };

  // Three balls, no pockets: each player has a cue ball (white, yellow) and there is one red. A point for making your cue
  // ball hit both of the others - after it has met as many cushions as the chosen rule asks for (0, 1, or the full three).
  const RULE3 = { 0: '쿠션 없이도 인정', 1: '쿠션 1번 이상', 3: '쿠션 3번 이상' };
  // bed: three-ball is played on the match table - larger, with smaller balls - while four-ball keeps the medium one
  /* 스누커 (owner 11-11; friends on one device only, for now). The balls: 0 the cue ball, 1-15 reds, 16-21 yellow .. black
     (tables.js SNOOKER). A visit: a red, then a colour, then a red ... while reds are left (a colour potted then goes back
     on its spot); then the colours in order, yellow to black, each staying down. Points: a red 1, the colours 2-7.
     A foul gives the other player its value - at least 4, else the most of the ball on and the balls wrongly hit or potted -
     and the other player plays from where the cue ball lies (from the D, if it went in). The colour to play needs no
     nominating here: it is whichever colour the cue ball meets first (as friends play it), and potting another is a foul.
     Not here (yet): free ball, the miss rule, putting the other back in, re-racks; a frame level after the black: the black
     is spotted again and played from the D by the one who did not pot it, as the rules say (with no toss).
     State: g.snk = { on: 'red' | 'colour' | 'clear', next: the colour to play in the clearance (16..21) }. */
  const SN = () => typeof SNOOKER !== 'undefined' ? SNOOKER : require('./tables').SNOOKER;
  const SNK_ON = { red: '빨간 공', colour: '색 공' };
  MODES.snooker = {
    id: 'snooker', name: '스누커', blurb: '빨간 공 다음 색 공, 점수가 더 많으면 승리', table: 'snooker', n: 22, ballInHand: false, scored: true,
    setup(g, rnd) {
      const S = SN(), P = g.P, { R } = P, w = g.world;
      for (let id = 16; id <= 21; id++) { const [x, y] = S.spot(P, id); P.place(w, id, x, y, rnd); }
      // the reds: a triangle of fifteen, its point just behind the pink, its base towards the black
      const px = S.spot(P, 20)[0] + 2 * R + 0.002; let id = 1;
      for (let r = 0; r < 5; r++) for (let k = 0; k <= r; k++) P.place(w, id++, px + r * SQ3 * R * 1.0006 + jit(rnd), (k - r / 2) * 2 * R * 1.0006 + jit(rnd), rnd);
      const [bx] = S.spot(P, 18), d = S.D * P.HL / 1.7845;
      P.place(w, 0, bx - d * 0.35, d * 0.45, rnd);
      g.placing = 'd'; g.isBreak = true; g.snk = { on: 'red', next: 16 };
    },
    intro: () => '브레이크오프',
    // in the D: behind the baulk line, inside its half circle (the cue ball in hand: setup, and after it went in)
    zone(P) { const S = SN(), [xb] = S.spot(P, 18), d = S.D * P.HL / 1.7845; return { xb, d }; },
    inZone(P, x, y) { const { xb, d } = this.zone(P); return x <= xb && Math.hypot(x - xb, y) <= d; },
    toZone(P, x, y) { const { xb, d } = this.zone(P); x = Math.min(x, xb); const l = Math.hypot(x - xb, y); if (l > d - P.R * 0.2) { const k = (d - P.R * 0.2) / l; x = xb + (x - xb) * k; y *= k; } return [x, y]; },
    redsLeft: g => g.world.balls.filter(b => b.on && b.id >= 1 && b.id <= 15).length,
    // the points still on the table: what is left to win (the reds with a black each, then the colours)
    left(g) { const s = g.snk || { on: 'red', next: 16 }, reds = this.redsLeft(g); let t = reds * 8 + (s.on === 'colour' ? 7 : 0); for (let id = s.on === 'clear' ? s.next : 16; id <= 21; id++) t += id - 14; return t; },
    onIds(g) { const s = g.snk, w = g.world; return s.on === 'red' ? w.balls.filter(b => b.on && b.id >= 1 && b.id <= 15).map(b => b.id) : s.on === 'colour' ? [16, 17, 18, 19, 20, 21].filter(i => w.balls[i].on) : [s.next]; },
    status(g, pi) { const s = g.snk; return { sub: g.turn === pi ? (s.on === 'clear' ? SN().name[s.next - 14] : SNK_ON[s.on]) : '', tray: [], pts: g.players[pi].score }; },
    badge(g) { const s = g.snk; return { text: s.on === 'clear' ? '다음' : SNK_ON[s.on], balls: s.on === 'red' ? [1] : s.on === 'colour' ? [16, 17, 18, 19, 20, 21].filter(i => g.world.balls[i].on) : [s.next], plain: true, sub: `남은 점수 ${this.left(g)}` }; },
    legal(g) { return this.onIds(g); },
    ctx(g) { return { turn: g.turn, isBreak: g.isBreak, on: g.snk.on, next: g.snk.next }; },
    evaluate(ev, c, g) {
      const S = SN(), V = S.value, potted = ev.pocketed.map(p => p.id), scratch = potted.includes(0), fh = ev.firstHit;
      const reds = potted.filter(i => i >= 1 && i <= 15), cols = potted.filter(i => i >= 16);
      let foul = null, worst = 0, onV = 1, pts = 0;
      const bad = (why, ...ids) => { if (!foul) foul = why; for (const i of ids) worst = Math.max(worst, V(i)); };
      if (fh == null) bad('공을 하나도 맞히지 못했습니다');
      if (c.on === 'red') {
        if (fh != null && fh > 15) bad('빨간 공을 먼저 맞혀야 합니다', fh);
        if (cols.length) bad('색 공이 들어갔습니다', ...cols);
        pts = reds.length;
      } else if (c.on === 'colour') {
        if (fh != null && fh <= 15) bad('색 공을 먼저 맞혀야 합니다'); else if (fh != null) onV = V(fh);
        if (reds.length) bad('빨간 공이 들어갔습니다');
        const wrong = cols.filter(i => i !== fh); if (wrong.length) bad('맞힌 색 공이 아닌 공이 들어갔습니다', ...wrong);
        if (fh != null && fh > 15) worst = Math.max(worst, V(fh));
        pts = fh != null && fh > 15 && cols.includes(fh) ? V(fh) : 0;
      } else {
        onV = V(c.next);
        if (fh != null && fh !== c.next) bad(`${S.name[c.next - 14]}을 먼저 맞혀야 합니다`, fh);
        const wrong = potted.filter(i => i !== 0 && i !== c.next); if (wrong.length) bad('차례가 아닌 공이 들어갔습니다', ...wrong);
        pts = potted.includes(c.next) ? V(c.next) : 0;
      }
      if (scratch) bad('큐볼이 포켓에 빠졌습니다');
      const r = { foul, scratch, respot: [], win: null, why: '', assign: null, keep: false, pts: 0, give: 0 };
      if (foul) r.give = Math.max(4, onV, worst); else { r.pts = pts; r.keep = pts > 0; }
      // the colours that go back on their spots: every colour potted while reds were on the table or with a red owed its
      // colour; in the clearance, only one potted on a foul (the one played for, potted fairly, stays down)
      // (with only the black left, the first score or foul ends the frame: a black potted on a foul stays down)
      r.last = c.on === 'clear' && c.next === 21;
      r.respot = cols.filter(i => (c.on !== 'clear' || foul) && !(r.last && i === 21));
      // what is on next, if the same player goes on (else after the turn passes: snookerNext)
      r.snk = { on: c.on, next: c.next };
      if (!foul && c.on === 'red' && pts) r.snk.on = 'colour';
      else if (c.on === 'colour') r.snk.on = 'after';            // (a red if any are left, else the clearance: decided once the balls are put back)
      else if (!foul && c.on === 'clear' && pts) r.snk.next = c.next + 1;
      return r;
    },
    // after the points are counted: what is on, and whether the frame is over (resolve calls it)
    after(g, r, me) {
      // the break: the points of one visit (a foul or a miss ends it); the highest kept for the result
      const p = g.players[me]; p.brk = r.keep ? (p.brk || 0) + r.pts : 0; p.topBrk = Math.max(p.topBrk || 0, p.brk);
      const s = r.snk || g.snk, reds = this.redsLeft(g);
      if (!r.keep && s.on === 'colour') s.on = 'after';            // (the turn passes after a red: the next player is on a red)
      if (s.on === 'after' || (s.on === 'red' && !reds)) { s.on = reds ? 'red' : 'clear'; s.next = 16; }
      if (s.on === 'red' && !reds) { s.on = 'clear'; s.next = 16; }
      g.snk = s;
      // the black down (or off the table) in the clearance: the frame is over - the higher score wins; level, the black again
      if (s.on === 'clear' && (s.next > 21 || !g.world.balls[21].on || (r.last && (r.foul || r.pts)))) {
        const a = g.players[0].score, b = g.players[1].score;
        if (a !== b) { r.win = a > b ? 0 : 1; r.why = `${a} : ${b}`; r.plain = true; return; }
        const P = g.P, w = g.world, [x, y] = this.respotAt(g, 21);
        P.place(w, 21, x, y);
        { const [cx, cy] = this.toZone(P, -P.HL, 0.05); const [fx, fy] = P.findFree(w, cx, cy, 0); P.place(w, 0, fx, fy); }
        s.next = 21; r.again = true; r.keep = false; r.foul = r.foul || null;
      }
    },
    // a colour back on its spot - or, taken, the highest free one; none free, as near its own as it can be towards the top cushion
    respotAt(g, id) {
      const S = SN(), P = g.P, w = g.world, free = ([x, y]) => P.isFree(w, x, y, id);
      const own = S.spot(P, id); if (free(own)) return own;
      for (let k = 21; k >= 16; k--) { const p = S.spot(P, k); if (free(p)) return p; }
      for (let x = own[0]; x < P.HL - P.R; x += P.R * 0.5) if (free([x, own[1]])) return [x, own[1]];
      return P.findFree(w, own[0], own[1], id);
    },
    cueHome(g) { const P = g.P, [x, y] = this.toZone(P, -P.HL, 0.05); return P.findFree(g.world, x, y, 0); },
  };

  MODES.three = {
    id: 'three', name: '3구', blurb: '내 공으로 나머지 두 공을 다 맞히면 1점', table: 'carom', bed: 'carom3', n: 3, ballInHand: false, target: true, RULE3,
    setup(g, rnd) {
      const P = g.P, { HL } = P, w = g.world;
      P.place(w, 2, HL / 2, 0, rnd); P.place(w, 1 - g.turn, -HL / 2, 0, rnd); P.place(w, g.turn, -HL / 2, -0.18, rnd);
      g.placing = null; g.isBreak = true;            // (the opening shot: the red first - evaluate)
    },
    intro: g => g.cushions ? `쿠션 ${g.cushions}회 이상` : '',
    status: (g, pi) => ({ sub: '', goal: g.targets[pi], tray: [], pts: g.players[pi].score }),
    badge: g => ({ text: g.isBreak ? '초구 · 빨간 공 먼저' : g.cushions ? `쿠션 ${g.cushions}번 + 두 공 = 1점` : '두 공을 다 맞히면 1점', balls: [] }),
    legal(g, me) { return g.isBreak ? [2] : [0, 1, 2].filter(i => i !== me); },
    ctx(g) { return { turn: g.turn, need: g.cushions || 0, opening: !!g.isBreak }; },
    evaluate(ev, c) {
      // (the opening shot must meet the red first - a foul otherwise, the turn passes)
      if (c.opening && ev.firstHit != null && ev.firstHit !== 2) return { foul: '초구는 빨간 공을 먼저 맞혀야 합니다', scratch: false, respot: [], win: null, why: '', assign: null, keep: false, pts: 0 };
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

  const mkP = (name, ai) => ({ name, ai: !!ai, group: null, score: 0, shots: 0, made: 0, run: 0, best: 0, fouls: 0, foulRun: 0 });
  const g = {
    MODES, GROUP_KO, modeId: 'eight', mode: MODES.eight, P: PH.pool, world: null, turn: 0,
    players: [mkP('플레이어 1'), mkP('플레이어 2')], isBreak: true, placing: null, over: null, target: 10, targets: [10, 10], level: 1, _ctx: null,
    tens: false, finish: false, potTray: false, ice: false, masse: true, goal: 'score', team: false, member: [0, 0],
  };

  g.start = function (modeId, names, ai, opts) {
    opts = opts || {};
    g.modeId = modeId; g.mode = MODES[modeId]; g.P = PH[g.mode.bed] || PH[g.mode.table];
    g.world = g.P.makeWorld(g.mode.n); g.world.track = true; g.world.snd = [];
    g.players = [mkP(names[0], false), mkP(names[1], ai)];
    g.turn = opts.first || 0; g.over = null;
    // 2:2 (opts.team): each side two players - seats A1 0, B1 1, A2 2, B2 3 - taking the side's visits in turn: a side's
    // shooter is g.turn + 2 * g.member[g.turn], and when its visit ends the next of the two has the next one
    g.team = !!opts.team; g.member = [0, 0]; g.target = opts.target || 10; g.level = opts.level == null ? 1 : opts.level; g.cushions = opts.cushions || 0;
    // targets: each player's own number of points to reach (four-ball handicaps); tens: scores are shown the way a hall counts them
    g.targets = opts.targets ? opts.targets.slice() : [g.target, g.target]; g.tens = !!opts.tens; g.finish = finishOf(opts.finish); g.potTray = !!opts.potTray;
    g.ice = !!opts.ice; g.real = realOf(opts.real); g.masse = opts.masse !== false; g.levels = opts.levels || null;
    // 4구 with a friend or the computer: minus false - a foul costs nothing; hugu - 후구 (resolve, below)
    g.minus = !(modeId === 'four' && opts.minus === false); g.hugu = modeId === 'four' && !!opts.hugu; g.first = g.turn; g.chance = null;
    // personas: a person-like computer opponent for a player (ai/), in place of a level; null for the rest
    g.personas = opts.personas || null;
    // carom: in 4구 the first to play has the white ball and the other the yellow (owner, 11-08: it was the other way).
    // g.yellow is the yellow ball's player; the scene and the HUD paint ball 0 or 1 yellow by it
    g.yellow = g.mode.table === 'carom' && modeId === 'four' ? 1 - g.turn : 1;
    g.rnd = opts.rnd || Math.random;             // (the rack's chances - again for a new rack after a break that did not stand)
    g.mode.setup(g, g.rnd);
    g.world.ice = g.ice; g.world.real = g.real;
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
    // (the two reds paired in one corner would roll out side by side and too often stay together - an easy first shot,
    // 12% of red pairs ended within 30 cm: so one red of a red pair is rolled straight into the other, which is knocked
    // away as on a break - 1% end that close, as few as any other pairing; owner 11-09)
    const redPair = k => ids[2 * k] > 1 && ids[2 * k + 1] > 1;
    ids.forEach((id, i) => {
      const b = w.balls[id], k = i >> 1;
      let ux, uy;
      if (redPair(k) && !(i & 1)) { const o = w.balls[ids[i ^ 1]], dx = o.x - b.x, dy = o.y - b.y, n = Math.sqrt(dx * dx + dy * dy); ux = dx / n; uy = dy / n; }
      else if (redPair(k)) { ux = 0; uy = 0; }
      else { const n = Math.sqrt(b.x * b.x + b.y * b.y); ux = -b.x / n; uy = -b.y / n; }
      const off = (rnd() * 2 - 1) * (redPair(k) ? 0.12 : 0.32), c = M.cos(off), s = M.sin(off), v = (redPair(k) ? 1.3 : 1.05) + rnd() * 0.75;
      b.vx = (ux * c - uy * s) * v; b.vy = (ux * s + uy * c) * v;
    });
  };
  g.legal = () => g.mode.legal(g, g.turn);
  /* where the cue ball in hand may go: anywhere, behind the head string (kitchen) or in the D (스누커): placeOk says
     whether a spot is allowed, toPlace brings one into it */
  g.placeOk = (x, y) => g.placing === 'kitchen' ? x <= -g.P.HL / 2 : g.placing === 'd' && g.mode.inZone ? g.mode.inZone(g.P, x, y) : true;
  g.toPlace = (x, y) => g.placing === 'kitchen' ? [Math.min(x, -g.P.HL / 2), y] : g.placing === 'd' && g.mode.toZone ? g.mode.toZone(g.P, x, y) : [x, y];
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
     power runs about two and a half lengths of the match table, full power five (PHYS_V 8); the same curve on every table. */
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
    p.run = 0; g.turn = nx; if (g.team) g.member[me] ^= 1;
    let msg = '시간 초과';
    if (m.ballInHand && !g.isBreak) {
      p.fouls++; p.foulRun = (p.foulRun || 0) + 1; g.placing = 'any'; msg = '시간 초과 · 큐볼 놓기';
      if (m.id === 'nine' && p.foulRun >= 3) { g.over = { winner: nx, why: '연속 파울 3번', plain: false }; return { msg: '연속 파울 3번', kind: 'foul', dur: 2600 }; }
    }
    if (m.table === 'carom') g.world.cue = g.turn;
    if (g.chance != null && g.turn === g.chance) g.over = { winner: g.chance, why: '', plain: true };   // (후구: the visit ran out)
    return { msg, kind: 'foul', dur: 2600 };
  };

  // Called once every ball has stopped. Applies the result and says what happened.
  g.resolve = function () {
    const m = g.mode, P = g.P, w = g.world, me = g.turn, p = g.players[me];
    const r = m.evaluate(w.ev, g._ctx, g), out = { r, msg: '', kind: '', dur: 1600 }, wasBreak = g.isBreak;
    for (const b of w.balls) b.wz = 0;
    // a break that did not stand (8볼): a new rack, and the other player breaks
    if (r.rerack) {
      p.shots++; p.fouls++; p.run = 0; g.turn = 1 - me; if (g.team) g.member[me] ^= 1; m.setup(g, g.rnd || Math.random);
      out.msg = '브레이크 불성립 · 상대가 다시 브레이크'; out.kind = 'foul'; out.dur = 3200; return out;
    }
    if (w.ev.off.length) {
      // a ball over the rail is a foul; it comes back on its spot (the cue ball: wherever the other player likes, on a pool table)
      const cueOff = w.ev.off.includes(w.cue);
      r.foul = cueOff ? '큐볼이 테이블 밖으로 나갔습니다' : '공이 테이블 밖으로 나갔습니다'; r.keep = false; r.solved = false;
      if (m.table === 'carom') { r.pts = m.solo || !g.minus || (g._ctx && g._ctx.last) ? 0 : -1; for (const id of w.ev.off) { const [x, y] = P.findFree(w, id === 2 ? P.HL / 2 : id === 3 ? -P.HL / 2 : -P.HL * 0.78, id === 0 ? -0.17 : 0, id); P.place(w, id, x, y); } }
      else {
        if (cueOff) r.scratch = true;
        // (WPA) the 8 off the table, but on the break, loses the game
        if (m.id === 'eight' && w.ev.off.includes(8) && !wasBreak) { r.win = 1 - me; r.why = '8번 공이 테이블 밖으로 나갔습니다.'; }
        else if (r.win === me) { r.win = m.id === 'eight' ? 1 - me : null; r.why = '8번 공을 넣으면서 파울이 났습니다.'; if (m.id === 'nine') r.respot.push(9); }
        for (const id of w.ev.off) if (id !== w.cue && !r.respot.includes(id)) r.respot.push(id);
      }
    }
    // (a mode with spots of its own puts its balls back there - 스누커's colours; the rest at the foot spot)
    for (const id of r.respot) { const [x, y] = m.respotAt ? m.respotAt(g, id) : P.findFree(w, P.HL / 2, 0, id); P.place(w, id, x, y); }
    if (r.scratch) { const [x, y] = m.cueHome ? m.cueHome(g) : P.findFree(w, -P.HL / 2, 0, 0); P.place(w, 0, x, y); }
    g.isBreak = false;
    p.shots++;
    if (r.foul) p.fouls++;
    // (WPA 9볼) three fouls in a row by one player lose the game; the second is said
    p.foulRun = r.foul ? (p.foulRun || 0) + 1 : 0;
    if (m.id === 'nine' && p.foulRun >= 3 && r.win == null) { r.win = 1 - me; r.why = '연속 파울 3번'; }
    if (r.keep || r.win === me) { p.made++; p.run++; p.best = Math.max(p.best, p.run); } else p.run = 0;
    if (r.pts) p.score = Math.max(0, p.score + r.pts);
    if (r.give) g.players[1 - me].score += r.give;                    // (스누커: a foul's points go to the other player)
    if (m.after) m.after(g, r, me);                                   // (스누커: what is on next, and the frame's end)
    // (a game with a finish: the points alone do not end it - the finish does, through the mode's own win; they stop at the target)
    if (m.target && g.finish && m.FINISH) p.score = Math.min(p.score, g.targets[me]);
    else if (m.target && p.score >= g.targets[me]) { r.win = me; r.why = g.tens ? `수지 ${g.targets[me] * 10}점을 먼저 다 쳤습니다.` : `먼저 ${g.targets[me]}점을 냈습니다.`; r.plain = true; }
    /* 후구 (owner 11-10): the player who began, done first, has not won yet - the other gets their visit, as many shots as
       they keep scoring. Done in it too: a draw. Their visit over without it: the one who began wins. */
    if (g.hugu && r.win === me && g.chance == null && me === g.first) {
      g.chance = me; g.turn = 1 - me; if (g.team) g.member[me] ^= 1; if (m.table === 'carom') w.cue = g.turn;
      out.msg = `후구 · ${g.players[g.turn].name}`; out.kind = 'good'; out.dur = 2600; return out;
    }
    if (g.chance != null && r.win === me && me !== g.chance) { g.over = { winner: null, draw: true, why: '후구 · 무승부', plain: false }; return out; }
    if (r.win != null) { g.over = { winner: r.win, why: r.why, plain: !!r.plain }; return out; }   // (plain: an ordinary end the score says already)
    if (r.again) { g.turn = 1 - me; g.placing = 'd'; p.run = 0; out.msg = '동점 · 검은 공 재경기'; out.kind = 'good'; out.dur = 3000; return out; }
    if (r.assign) {
      p.group = r.assign; g.players[1 - me].group = r.assign === 'solid' ? 'stripe' : 'solid';
      out.msg = `${p.name}: ${GROUP_KO[r.assign]} 공`; out.kind = 'good'; out.dur = 2400;
    }
    if (r.foul) {
      g.turn = 1 - me; const nx = g.players[g.turn].name;
      // (copy audit 05-07: the reason, then 큐볼 놓기 or the points really lost; whose turn the score bar shows)
      // (a scratch on the 8볼 break: behind the head string - WPA)
      if (m.ballInHand) { g.placing = wasBreak && m.id === 'eight' ? 'kitchen' : 'any'; out.msg = `파울 · ${r.foul} · 큐볼 놓기` + (m.id === 'nine' && p.foulRun === 2 ? ' · 한 번 더 파울이면 패배' : ''); }
      // (스누커: the points to the other player; the cue ball from the D if it went in, else from where it lies)
      else if (r.give) { g.placing = r.scratch && m.zone ? 'd' : null; out.msg = `파울 · ${r.foul} · ${g.players[g.turn].name} +${r.give}점` + (g.placing ? ' · D에 큐볼 놓기' : ''); }
      else out.msg = `파울 · ${r.foul}` + (r.pts < 0 ? ` · −${-r.pts * (g.tens ? 10 : 1)}점` : '');
      out.kind = 'foul'; out.dur = 3400;
    } else if (!r.keep) {
      // (copy audit 05-06: the turn going over and a point scored are seen on the score bar - only a note that changes what
      // is to be done is said)
      g.turn = 1 - me; if (!out.msg && r.note) { out.msg = r.note; out.dur = 2600; }
    } else if (r.pts > 0) {
      out.kind = 'good';
    } else if (m.id === 'eight' && !r.assign) {
      const rem = m.remaining(g, me);
      if (rem && !rem.length) { out.msg = '이제 8번 공을 넣으면 이깁니다.'; out.kind = 'good'; out.dur = 2400; }
    }
    if (m.table === 'carom') w.cue = g.turn;
    if (g.team && g.turn !== me) g.member[me] ^= 1;          // (that side's visit over: its other player has the next)
    if (g.chance != null && g.turn === g.chance) g.over = { winner: g.chance, why: '', plain: true };   // (후구 over, not caught up)
    return out;
  };
  // the seat whose shot it is: the side's (0, 1), or in 2:2 which of its two (0-3)
  g.shooter = () => g.team ? g.turn + 2 * g.member[g.turn] : g.turn;

  // the computer player is ai/ (createAI): given, it answers g.aiPlan()
  if (makeAI) { const ai = makeAI(g); g.aiPlan = ai.plan; }

  g.serialize = () => ({
    v: 2, modeId: g.modeId, balls: g.world.balls.map(b => [b.x, b.y, b.on ? 1 : 0, b.q.slice()]), cue: g.world.cue,
    turn: g.turn, players: g.players, isBreak: g.isBreak, placing: g.placing, target: g.target, level: g.level, cushions: g.cushions,
    targets: g.targets, tens: g.tens, finish: g.finish, potTray: g.potTray, ice: g.ice, real: g.real, masse: g.masse, yellow: g.yellow,
    team: g.team, member: g.member.slice(), minus: g.minus, hugu: g.hugu, first: g.first, chance: g.chance,
    snk: g.snk ? Object.assign({}, g.snk) : null,
  });
  g.restore = function (d) {
    if (!d || d.v !== 2 || !MODES[d.modeId] || !Array.isArray(d.balls) || d.balls.length !== MODES[d.modeId].n) return false;
    g.modeId = d.modeId; g.mode = MODES[d.modeId]; g.P = PH[g.mode.bed] || PH[g.mode.table]; g.yellow = d.yellow == null ? 1 : d.yellow;
    g.world = g.P.makeWorld(g.mode.n); g.world.track = true; g.world.snd = [];
    d.balls.forEach((s, i) => { const b = g.world.balls[i]; b.x = b.px = s[0]; b.y = b.py = s[1]; b.on = !!s[2]; b.q = s[3]; });
    g.world.cue = d.cue || 0; g.turn = d.turn; g.players = d.players; g.isBreak = d.isBreak; g.placing = d.placing;
    g.target = d.target || 10; g.level = d.level == null ? 1 : d.level; g.cushions = d.cushions || 0; g.over = null; g.levels = null;
    g.targets = Array.isArray(d.targets) ? d.targets : [g.target, g.target]; g.tens = !!d.tens; g.finish = finishOf(d.finish); g.potTray = !!d.potTray;
    g.ice = !!d.ice; g.world.ice = g.ice; g.real = realOf(d.real); g.world.real = g.real; g.masse = d.masse !== false;
    g.team = !!d.team; g.member = Array.isArray(d.member) ? d.member.slice(0, 2).map(x => x ? 1 : 0) : [0, 0];
    g.minus = d.minus !== false; g.hugu = !!d.hugu; g.first = d.first ? 1 : 0; g.chance = d.chance === 0 || d.chance === 1 ? d.chance : null;
    g.snk = d.snk && typeof d.snk === 'object' ? { on: ['red', 'colour', 'clear'].includes(d.snk.on) ? d.snk.on : 'red', next: Math.max(16, Math.min(21, +d.snk.next || 16)) } : null;
    if (d.modeId === 'snooker' && !g.snk) g.snk = { on: 'red', next: 16 };
    return true;
  };
  return g;
}
if (typeof module !== 'undefined') { module.exports = createGame; module.exports.seededRandom = seededRandom; }
