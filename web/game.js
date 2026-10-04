/* Rules, turn flow, statistics and the computer player for 8-ball, 9-ball and four-ball carom. No DOM in here. */
function createGame(PH) {
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
        return { sub: p.group ? GROUP_KO[p.group] + ' 공' : '공 미정', tray: !rem ? ['slot', 'slot', 'slot', 'slot', 'slot', 'slot', 'slot'] : rem.length ? rem : ['eight'], pts: null };
      },
      badge: g => ({ text: g.isBreak ? '브레이크' : g.players.every(p => !p.group) ? '아직 공 미정' : '8번은 마지막에', balls: [] }),
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
          else { r.win = me; r.why = '자기 공을 모두 넣고 8번 공까지 넣었습니다.'; }
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
        if (nine) { if (foul) r.respot.push(9); else { r.win = me; r.why = '9번 공을 넣었습니다.'; return r; } }
        r.keep = !foul && obj.length > 0;
        return r;
      },
    },

    four: {
      id: 'four', name: '4구', blurb: '빨간 공 두 개를 다 맞히면 1점', table: 'carom', n: 4, ballInHand: false, target: true,
      setup(g, rnd) {
        const P = g.P, { HL } = P, w = g.world;
        P.place(w, 2, HL / 2, 0, rnd); P.place(w, 3, -HL / 2, 0, rnd);
        P.place(w, 1, -HL * 0.78, 0, rnd); P.place(w, 0, -HL * 0.78, -0.17, rnd);
        g.placing = null; g.isBreak = false;
      },
      intro: g => `${g.players[g.turn].name}부터. 빨간 공 두 개를 모두 맞히세요.`,
      status: (g, pi) => ({ sub: `목표 ${g.target}점`, tray: [], pts: g.players[pi].score }),
      badge: () => ({ text: '빨간 공 두 개 맞히면 1점', balls: [] }),
      legal() { return [2, 3]; },
      ctx(g) { return { turn: g.turn }; },
      evaluate(ev, c) {
        const me = c.turn, hitOpp = ev.hits.includes(1 - me);
        const reds = (ev.hits.includes(2) ? 1 : 0) + (ev.hits.includes(3) ? 1 : 0);
        const foul = hitOpp ? '상대 공을 맞혔습니다' : reds === 0 ? '빨간 공을 맞히지 못했습니다' : null;
        const pts = foul ? -1 : reds === 2 ? 1 : 0;
        return { foul, scratch: false, respot: [], win: null, why: '', assign: null, keep: pts > 0, pts };
      },
    },
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
    players: [mkP('플레이어 1'), mkP('플레이어 2')], isBreak: true, placing: null, over: null, target: 10, level: 1, _ctx: null,
  };

  g.start = function (modeId, names, ai, opts) {
    opts = opts || {};
    g.modeId = modeId; g.mode = MODES[modeId]; g.P = PH[g.mode.table];
    g.world = g.P.makeWorld(g.mode.n); g.world.track = true; g.world.snd = [];
    g.players = [mkP(names[0], false), mkP(names[1], ai)];
    g.turn = opts.first || 0; g.over = null; g.target = opts.target || 10; g.level = opts.level == null ? 1 : opts.level;
    g.mode.setup(g, opts.rnd || Math.random);
    g.world.cue = g.mode.table === 'carom' ? g.turn : 0;
  };
  g.cueBall = () => g.world.balls[g.world.cue];
  g.legal = () => g.mode.legal(g, g.turn);
  g.vOf = power => (0.35 + 7.4 * Math.pow(power, 1.35)) * (g.isBreak && g.mode.table === 'pool' ? 1.42 : 1);
  g.powerOf = V => Math.pow(Math.max(0.0001, (V / (g.isBreak && g.mode.table === 'pool' ? 1.42 : 1) - 0.35) / 7.4), 1 / 1.35);
  g.beginShot = () => { g._ctx = g.mode.ctx(g); g.placing = null; };

  // Called once every ball has stopped. Applies the result and says what happened.
  g.resolve = function () {
    const m = g.mode, P = g.P, w = g.world, me = g.turn, p = g.players[me];
    const r = m.evaluate(w.ev, g._ctx, g), out = { r, msg: '', kind: '', dur: 1600 };
    for (const b of w.balls) b.wz = 0;
    for (const id of r.respot) { const [x, y] = P.findFree(w, P.HL / 2, 0, id); P.place(w, id, x, y); }
    if (r.scratch) { const [x, y] = P.findFree(w, -P.HL / 2, 0, 0); P.place(w, 0, x, y); }
    g.isBreak = false;
    p.shots++;
    if (r.foul) p.fouls++;
    if (r.keep || r.win === me) { p.made++; p.run++; p.best = Math.max(p.best, p.run); } else p.run = 0;
    if (r.pts) p.score = Math.max(0, p.score + r.pts);
    if (m.target && p.score >= g.target) { r.win = me; r.why = `먼저 ${g.target}점을 냈습니다.`; }
    if (r.win != null) { g.over = { winner: r.win, why: r.why }; return out; }
    if (r.assign) {
      p.group = r.assign; g.players[1 - me].group = r.assign === 'solid' ? 'stripe' : 'solid';
      out.msg = `${p.name}: ${GROUP_KO[r.assign]} 공`; out.kind = 'good'; out.dur = 2400;
    }
    if (r.foul) {
      g.turn = 1 - me; const nx = g.players[g.turn].name;
      if (m.ballInHand) { g.placing = 'any'; out.msg = `파울 · ${r.foul}. ${nx} 차례, 큐볼을 원하는 곳에 놓습니다.`; }
      else out.msg = `파울 · ${r.foul}. 1점 감점, ${nx} 차례.`;
      out.kind = 'foul'; out.dur = 3400;
    } else if (!r.keep) {
      g.turn = 1 - me; if (!out.msg) out.msg = `${g.players[g.turn].name} 차례`;
    } else if (r.pts > 0) {
      out.msg = `${p.name} 1점!`; out.kind = 'good';
    } else if (m.id === 'eight' && !r.assign) {
      const rem = m.remaining(g, me);
      if (rem && !rem.length) { out.msg = '이제 8번 공을 넣으면 이깁니다.'; out.kind = 'good'; out.dur = 2400; }
    }
    if (m.table === 'carom') w.cue = g.turn;
    return out;
  };

  /* ---------- computer player ---------- */
  function gauss() { let u = 0; for (let i = 0; i < 6; i++) u += Math.random(); return (u - 3) / Math.sqrt(0.5); }
  function simShot(angle, V, pos) {
    const w2 = g.P.clone(g.world);
    if (pos) { const c = w2.balls[w2.cue]; c.x = pos[0]; c.y = pos[1]; }
    g.P.strike(w2, angle, V, 0, 0);
    return g.P.run(w2, 20);
  }

  /* The top level does not miss. Every shot it thinks of is played out in full first, on a copy of the table, and only one
     that was seen to work is taken - struck exactly as it was tried. Given the choice it shows off: off a cushion into the
     ball, the ball off a cushion into the pocket, one ball into another. It still prefers a shot that leaves it another. */
  function aiShow(cands, targets, speed, good, ctx) {
    const P = g.P, { R, HL, HW, POCKETS } = P, w = g.world, c = w.balls[w.cue], me = g.turn, found = [];
    let sims = 0;
    // is there a plain pot on for the same player, at a ball it will be allowed to hit, once the balls have stopped?
    const leaveOf = w2 => {
      const c2 = w2.balls[w2.cue]; if (!c2.on) return 0;
      let next = targets.filter(t => w2.balls[t].on);
      if (g.modeId === 'nine') { const low = w2.balls.find(b => b.on && b.id !== w2.cue); next = low ? [low.id] : []; }
      else if (!next.length && g.modeId === 'eight') next = [8];
      for (const t of next) { const T = w2.balls[t]; if (!T.on) continue;
        for (const p of POCKETS) {
          let dx = p.ax - T.x, dy = p.ay - T.y; const dl = Math.hypot(dx, dy); dx /= dl; dy /= dl;
          const gx = T.x - dx * 2 * R, gy = T.y - dy * 2 * R, cx = gx - c2.x, cy = gy - c2.y, cl = Math.hypot(cx, cy);
          if (cl < 1e-4 || (cx * dx + cy * dy) / cl < 0.5) continue;
          if (P.pathClear(w2, T.x, T.y, p.ax, p.ay, [0, T.id]) && P.pathClear(w2, c2.x, c2.y, gx, gy, [0, T.id])) return 1;
        } }
      return 0;
    };
    const tryShot = (angle, V, pos, flair) => {
      sims++; const w2 = P.clone(w);
      if (pos) { const c2 = w2.balls[w2.cue]; c2.x = c2.px = pos[0]; c2.y = c2.py = pos[1]; }
      P.strike(w2, angle, V, 0, 0);
      const r = g.mode.evaluate(P.run(w2, 20), ctx, g); if (!good(r)) return false;
      const pots = w2.ev.pocketed.length;
      found.push({ pos: pos || null, angle, V, flair, score: (r.win === me ? 100 : 0) + flair + 1.5 * (pots - 1) + 6 * leaveOf(w2) + Math.random() * 0.8 });
      return true;
    };
    // plain pots, easiest first
    let plain = 0;
    for (const k of cands.slice(0, 14)) {
      let ok = false;
      for (const m of [1, 0.78, 1.3, 0.62]) { for (const da of [0, 0.002, -0.002, 0.005, -0.005]) if (tryShot(k.angle + da, Math.min(6.6, speed(k) * m), k.pos, 0)) { ok = true; break; } if (ok) break; }
      if (ok && ++plain >= (targets.length <= 2 ? 9 : 4)) break;
    }
    if (!g.placing) {
      // the showy ones, worked out with mirrors and then tried a little to either side, because a real cushion is not a mirror
      const rails = [['y', HW - R], ['y', -(HW - R)], ['x', HL - R], ['x', -(HL - R)]], tricks = [];
      const mirror = (x, y, rl) => rl[0] === 'y' ? [x, 2 * rl[1] - y] : [2 * rl[1] - x, y];
      const bounce = (x0, y0, mx, my, rl) => {
        if (rl[0] === 'y') { const t = (rl[1] - y0) / (my - y0); if (!(t > 0.02 && t < 0.98)) return null; const x = x0 + (mx - x0) * t; return Math.abs(x) > HL - 0.17 || Math.abs(x) < 0.14 ? null : [x, rl[1]]; }
        const t = (rl[1] - x0) / (mx - x0); if (!(t > 0.02 && t < 0.98)) return null; const y = y0 + (my - y0) * t; return Math.abs(y) > HW - 0.17 ? null : [rl[1], y];
      };
      const inside = (x, y) => Math.abs(x) < HL - R && Math.abs(y) < HW - R;
      const others = w.balls.filter(b => b.on && b.id !== w.cue).map(b => b.id);
      for (const t of targets) { const T = w.balls[t];
        for (const p of POCKETS) {
          // the ball off a cushion and in
          for (const rl of rails) {
            const m = mirror(p.ax, p.ay, rl), B = bounce(T.x, T.y, m[0], m[1], rl); if (!B) continue;
            let dx = m[0] - T.x, dy = m[1] - T.y; const dl = Math.hypot(dx, dy); dx /= dl; dy /= dl;
            const ix = p.ax - B[0], iy = p.ay - B[1], il = Math.hypot(ix, iy); if ((ix * p.nx + iy * p.ny) / il < 0.45) continue;
            const gx = T.x - dx * 2 * R, gy = T.y - dy * 2 * R; if (!inside(gx, gy)) continue;
            let cx = gx - c.x, cy = gy - c.y; const cl = Math.hypot(cx, cy); if (cl < 1e-4) continue; cx /= cl; cy /= cl;
            if (cx * dx + cy * dy < 0.45) continue;
            if (!P.pathClear(w, T.x, T.y, B[0], B[1], [0, t]) || !P.pathClear(w, B[0], B[1], p.ax, p.ay, [0, t]) || !P.pathClear(w, c.x, c.y, gx, gy, [0, t])) continue;
            tricks.push({ angle: Math.atan2(cy, cx), len: cl + dl, flair: 3, Vs: [3.2, 4.4], step: 0.005 });
          }
          let dx = p.ax - T.x, dy = p.ay - T.y; const dTP = Math.hypot(dx, dy); dx /= dTP; dy /= dTP;
          if (dx * p.nx + dy * p.ny < (p.corner ? 0.3 : 0.55) || !P.pathClear(w, T.x, T.y, p.ax, p.ay, [0, t])) continue;
          const gx = T.x - dx * 2 * R, gy = T.y - dy * 2 * R; if (!inside(gx, gy)) continue;
          // the cue ball off a cushion first
          for (const rl of rails) {
            const m = mirror(gx, gy, rl), B = bounce(c.x, c.y, m[0], m[1], rl); if (!B) continue;
            const ix = gx - B[0], iy = gy - B[1], il = Math.hypot(ix, iy); if (il < 0.05 || (ix * dx + iy * dy) / il < 0.5) continue;
            if (!P.pathClear(w, c.x, c.y, B[0], B[1], [0]) || !P.pathClear(w, B[0], B[1], gx, gy, [0, t])) continue;
            tricks.push({ angle: Math.atan2(m[1] - c.y, m[0] - c.x), len: Math.hypot(m[0] - c.x, m[1] - c.y) + dTP, flair: 3, Vs: [3.0, 4.2], step: 0.005 });
          }
        }
        // through another ball: the cue ball sends this one into that one, and that one goes in
        for (const o of others) { if (o === t) continue; const O = w.balls[o];
          for (const p of POCKETS) {
            let dx = p.ax - O.x, dy = p.ay - O.y; const dOP = Math.hypot(dx, dy); dx /= dOP; dy /= dOP;
            if (dx * p.nx + dy * p.ny < (p.corner ? 0.3 : 0.55) || !P.pathClear(w, O.x, O.y, p.ax, p.ay, [0, o])) continue;
            const hx = O.x - dx * 2 * R, hy = O.y - dy * 2 * R; let ex = hx - T.x, ey = hy - T.y; const el = Math.hypot(ex, ey); if (el < 1e-4) continue; ex /= el; ey /= el;
            if (ex * dx + ey * dy < 0.7 || !P.pathClear(w, T.x, T.y, hx, hy, [0, t, o])) continue;
            const gx = T.x - ex * 2 * R, gy = T.y - ey * 2 * R; if (!inside(gx, gy)) continue;
            let cx = gx - c.x, cy = gy - c.y; const cl = Math.hypot(cx, cy); if (cl < 1e-4) continue; cx /= cl; cy /= cl;
            if (cx * ex + cy * ey < 0.7 || !P.pathClear(w, c.x, c.y, gx, gy, [0, t])) continue;
            tricks.push({ angle: Math.atan2(cy, cx), len: cl + el + dOP, flair: 2.5, Vs: [3.4, 4.8], step: 0.002 });
          } }
      }
      tricks.sort((a, b) => a.len - b.len);
      let shown = 0;
      for (const k of tricks) {
        if (sims > 620 || shown >= 3) break;
        let ok = false;
        for (let i = 0; i <= 14 && !ok; i++) { const da = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * k.step; for (const V of k.Vs) if (tryShot(k.angle + da, V, null, k.flair)) { ok = true; break; } }
        if (ok) shown++;
      }
    }
    if (!found.length) {
      // nothing obvious: sweep finely across every ball it may hit (from a few places, with the ball in hand), then round the whole clock
      const spots = g.placing ? [[-HL / 2, 0], [0, 0], [HL / 2, 0], [0, HW / 2], [0, -HW / 2]].map(q => P.isFree(w, q[0], q[1], 0) ? q : P.findFree(w, q[0], q[1], 0)) : [null];
      const order = targets.map(t => w.balls[t]);
      sweep: for (const pos of spots) {
        const fx = pos ? pos[0] : c.x, fy = pos ? pos[1] : c.y;
        order.sort((p, q) => Math.hypot(p.x - fx, p.y - fy) - Math.hypot(q.x - fx, q.y - fy));
        for (const T of order) {
          const dd = Math.hypot(T.x - fx, T.y - fy), base = Math.atan2(T.y - fy, T.x - fx), half = Math.asin(Math.min(1, 2 * R / Math.max(dd, 2 * R))) * 0.98;
          for (let i = 0; i <= 44; i++) { const f = (i % 2 ? 1 : -1) * Math.ceil(i / 2) / 22; for (const V of [2.6, 4.2]) if (tryShot(base + f * half, V, pos, 1)) break sweep; }
        }
      }
      if (!found.length && !g.placing) {
        // still nothing: come at each ball off every cushion, sweeping wide because the cushion will not send it quite where a mirror says
        kick: for (const T of order) for (const [ax, v] of [['y', HW - R], ['y', -(HW - R)], ['x', HL - R], ['x', -(HL - R)]]) {
          const mx = ax === 'y' ? T.x : 2 * v - T.x, my = ax === 'y' ? 2 * v - T.y : T.y, base = Math.atan2(my - c.y, mx - c.x);
          for (let i = 0; i <= 40; i++) { const da = (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.004; for (const V of [2.6, 3.8, 5]) if (tryShot(base + da, V, null, 3)) break kick; }
        }
      }
      if (!found.length) { const pos = spots[0], ph = Math.random() * 6.283; clock: for (let i = 0; i < 480; i++) for (const V of [3, 4.6]) if (tryShot(ph + i * Math.PI / 240, V, pos, 1)) break clock; }
    }
    if (!found.length) return null;
    found.sort((a, b) => b.score - a.score);
    return { pos: found[0].pos, angle: found[0].angle, V: found[0].V, flair: found[0].flair };
  }

  function aiPool() {
    const P = g.P, { R, HL, HW, POCKETS } = P, w = g.world, c = w.balls[w.cue], lvl = g.level, me = g.turn;
    const ctx = g.mode.ctx(g), noise = [0.014, 0.0055, 0.0016, 0][lvl];
    if (g.isBreak) {
      const y = (Math.random() - 0.5) * 0.3, pos = [-HL / 2 - 0.1, y];
      return { pos, angle: Math.atan2(-y * 0.92, HL / 2 - pos[0]) + gauss() * 0.003, V: g.vOf(0.94 + Math.random() * 0.06) };
    }
    const verdict = (a, V, pos) => g.mode.evaluate(simShot(a, V, pos), ctx, g);
    const good = r => !r.foul && (r.win == null ? r.keep : r.win === me);
    const safe = r => !r.foul && (r.win == null || r.win === me);
    const targets = g.mode.legal(g, me), cands = [];
    for (const t of targets) for (const p of POCKETS) {
      const T = w.balls[t]; let dx = p.ax - T.x, dy = p.ay - T.y; const dTP = Math.hypot(dx, dy); dx /= dTP; dy /= dTP;
      if (dx * p.nx + dy * p.ny < (p.corner ? 0.3 : 0.55)) continue;
      if (!P.pathClear(w, T.x, T.y, p.ax, p.ay, [0, t])) continue;
      const gx = T.x - dx * 2 * R, gy = T.y - dy * 2 * R;
      if (Math.abs(gx) > HL - R || Math.abs(gy) > HW - R) continue;
      const spots = [];
      if (g.placing) {
        for (const dist of [0.32, 0.5, 0.75]) for (const da of [0, 0.3, -0.3, 0.55, -0.55]) {
          const ca = Math.cos(da), sa = Math.sin(da), px = gx - (dx * ca - dy * sa) * dist, py = gy - (dx * sa + dy * ca) * dist;
          if (P.isFree(w, px, py, 0)) spots.push([px, py]);
        }
      } else spots.push([c.x, c.y]);
      for (const s of spots) {
        let cx = gx - s[0], cy = gy - s[1]; const dCG = Math.hypot(cx, cy); if (dCG < 1e-4) continue; cx /= dCG; cy /= dCG;
        const cosc = cx * dx + cy * dy; if (cosc < 0.3) continue;
        if (!P.pathClear(w, s[0], s[1], gx, gy, [0, t])) continue;
        cands.push({ pos: g.placing ? s : null, angle: Math.atan2(cy, cx), cosc, dCG, dTP, score: (dCG * 0.6 + 0.3) * (dTP + 0.25) / (cosc * cosc) * (p.corner ? 1 : 1.15) });
      }
    }
    cands.sort((a, b) => a.score - b.score);
    const speed = k => Math.min(6.4, Math.max(1.3, (1.0 + 1.5 * Math.sqrt(k.dTP)) / Math.max(0.4, k.cosc) + 0.9 * Math.sqrt(k.dCG)));
    if (lvl >= 3) { const show = aiShow(cands, targets, speed, good, ctx); if (show) return show; }
    if (cands.length) {
      let pick = null;
      if (lvl === 0) { const k = cands[Math.min(cands.length - 1, Math.floor(Math.random() * 2))]; pick = { pos: k.pos, angle: k.angle, V: speed(k) }; }
      else {
        const top = cands.slice(0, lvl === 2 ? 10 : 5);
        outer: for (const k of top) for (const m of [1, 0.78, 1.3]) for (const da of [0, 0.003, -0.003]) {
          const V = Math.min(6.6, speed(k) * m);
          if (good(verdict(k.angle + da, V, k.pos))) { pick = { pos: k.pos, angle: k.angle + da, V }; break outer; }
        }
      }
      if (pick) return { pos: pick.pos, angle: pick.angle + gauss() * noise, V: pick.V };
    }
    // No clean pot: play any legal contact, taking a winning or turn-keeping one when it turns up.
    const order = targets.map(t => w.balls[t]).sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y)).slice(0, 4);
    let firstSafe = null;
    for (const T of order) {
      const spots = [];
      if (g.placing) {
        for (const [ox, oy] of [[-0.3, 0], [0.3, 0], [0, -0.3], [0, 0.3]]) if (P.isFree(w, T.x + ox, T.y + oy, 0)) { spots.push([T.x + ox, T.y + oy]); if (spots.length === 2) break; }
        if (!spots.length) spots.push(P.findFree(w, T.x - 0.3, T.y, 0));
      } else spots.push(null);
      for (const pos of spots) {
        const fx = pos ? pos[0] : c.x, fy = pos ? pos[1] : c.y, d = Math.hypot(T.x - fx, T.y - fy);
        const base = Math.atan2(T.y - fy, T.x - fx), half = Math.asin(Math.min(1, 2 * R / Math.max(d, 2 * R))) * 0.9;
        for (const f of [0, 0.35, -0.35, 0.7, -0.7]) for (const V of [2.4, 3.6]) {
          const tr = { pos, angle: base + f * half, V }, r = verdict(tr.angle, V, pos);
          if (good(r)) return { pos, angle: tr.angle + gauss() * noise * 0.5, V };
          if (!firstSafe && safe(r)) firstSafe = tr;
        }
      }
    }
    if (firstSafe) return { pos: firstSafe.pos, angle: firstSafe.angle + gauss() * noise * 0.5, V: firstSafe.V };
    const pos = g.placing ? P.findFree(w, -HL / 2, 0, 0) : null;
    for (let i = 0; i < 120; i++) { const a = i * Math.PI / 60; if (safe(verdict(a, 3, pos))) return { pos, angle: a, V: 3 }; }
    const T = order[0], fx = pos ? pos[0] : c.x, fy = pos ? pos[1] : c.y;
    return { pos, angle: Math.atan2(T.y - fy, T.x - fx), V: 2.6 };
  }

  function aiCarom() {
    const w = g.world, c = w.balls[w.cue], lvl = g.level, ctx = g.mode.ctx(g);
    const nA = [72, 96, 144, 360][lvl], Vs = [[3], [2.4, 3.8], [2.6, 4.0], [2.2, 3.0, 4.0]][lvl], noise = [0.02, 0.009, 0.003, 0][lvl];
    const phase = Math.random() * Math.PI * 2, hit = Vs.map(() => new Array(nA).fill(false)), okay = [];
    const flair = [];                                         // top level: scoring shots it saw, and whether the cue ball went round the cushions to do it
    if (lvl >= 3) {
      const all = []; for (let vi = 0; vi < Vs.length; vi++) for (let i = 0; i < nA; i++) all.push([phase + i * 2 * Math.PI / nA, Vs[vi]]);
      for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)), x = all[i]; all[i] = all[j]; all[j] = x; }
      let fancy = 0;
      for (let i = 0; i < all.length && fancy < 2 && !(i > 400 && flair.length); i++) {
        const w2 = g.P.clone(w); g.P.strike(w2, all[i][0], all[i][1], 0, 0);
        const r = g.mode.evaluate(g.P.run(w2, 20), ctx, g), railed = w2.ev.railed.includes(w2.cue);
        if (r.pts > 0) { flair.push({ angle: all[i][0], V: all[i][1], s: (railed ? 3 : 0) + Math.random() }); if (railed) fancy++; }
      }
      // nothing yet: look again between the angles already tried, at other speeds
      if (!flair.length) again: for (const V of [2.6, 3.5, 4.6]) for (let i = 0; i < 720; i++) {
        const a = phase + (i + 0.5) * Math.PI / 360;
        if (g.mode.evaluate(simShot(a, V), ctx, g).pts > 0) { flair.push({ angle: a, V, s: 0 }); break again; }
      }
    } else for (let vi = 0; vi < Vs.length; vi++) for (let i = 0; i < nA; i++) {
      const a = phase + i * 2 * Math.PI / nA, r = g.mode.evaluate(simShot(a, Vs[vi]), ctx, g);
      if (r.pts > 0) hit[vi][i] = true; else if (!r.foul) okay.push({ angle: a, V: Vs[vi] });
    }
    // the top level takes a shot it has seen score, exactly as it saw it - by way of the cushions when it can
    if (flair.length) { flair.sort((p, q) => q.s - p.s); return { pos: null, angle: flair[0].angle, V: flair[0].V }; }
    let best = null, bs = -1;
    for (let vi = 0; vi < Vs.length; vi++) for (let i = 0; i < nA; i++) if (hit[vi][i]) {
      let run = 1; for (let k = 1; k < 6 && hit[vi][(i + k) % nA] && hit[vi][(i - k + nA) % nA]; k++) run += 2;
      const s = run + Math.random() * (lvl === 0 ? 3 : 0.5);
      if (s > bs) { bs = s; best = { angle: phase + i * 2 * Math.PI / nA, V: Vs[vi] }; }
    }
    if (!best) {
      // nothing scores: at least hit a red squarely rather than give a point away
      const reds = [w.balls[2], w.balls[3]].sort((p, q) => Math.hypot(p.x - c.x, p.y - c.y) - Math.hypot(q.x - c.x, q.y - c.y));
      for (const T of reds) {
        const a = Math.atan2(T.y - c.y, T.x - c.x), h = g.P.cast(w, c.x, c.y, Math.cos(a), Math.sin(a), w.cue);
        if (h.type === 'ball' && h.ball === T.id) { best = { angle: a, V: 2.2 }; break; }
      }
    }
    if (!best && okay.length) best = okay[Math.floor(Math.random() * okay.length)];
    if (!best) { const T = w.balls[2]; best = { angle: Math.atan2(T.y - c.y, T.x - c.x), V: 2.8 }; }
    return { pos: null, angle: best.angle + gauss() * noise, V: best.V };
  }
  g.aiPlan = () => g.mode.table === 'carom' ? aiCarom() : aiPool();

  g.serialize = () => ({
    v: 2, modeId: g.modeId, balls: g.world.balls.map(b => [b.x, b.y, b.on ? 1 : 0, b.q.slice()]), cue: g.world.cue,
    turn: g.turn, players: g.players, isBreak: g.isBreak, placing: g.placing, target: g.target, level: g.level,
  });
  g.restore = function (d) {
    if (!d || d.v !== 2 || !MODES[d.modeId] || !Array.isArray(d.balls) || d.balls.length !== MODES[d.modeId].n) return false;
    g.modeId = d.modeId; g.mode = MODES[d.modeId]; g.P = PH[g.mode.table];
    g.world = g.P.makeWorld(g.mode.n); g.world.track = true; g.world.snd = [];
    d.balls.forEach((s, i) => { const b = g.world.balls[i]; b.x = b.px = s[0]; b.y = b.py = s[1]; b.on = !!s[2]; b.q = s[3]; });
    g.world.cue = d.cue || 0; g.turn = d.turn; g.players = d.players; g.isBreak = d.isBreak; g.placing = d.placing;
    g.target = d.target || 10; g.level = d.level == null ? 1 : d.level; g.over = null;
    return true;
  };
  return g;
}
if (typeof module !== 'undefined') module.exports = createGame;
