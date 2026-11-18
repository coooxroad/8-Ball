  /* ================= what a table is worth: the chance to win the frame (owner 11-18: '승률 단위') =================
     As chess.com grades a move by the expected points it lost (the engine's eval turned into a chance to win, 0..1, then
     the drop; cuts at 0.02 / 0.05 / 0.10 / 0.20) and lichess the same with its win%, the judge counts a shot's worth as
     the shooter's chance to win the frame after it. So a ball missed with one ball left to win costs more than the same
     ball missed at the start, and a safety when the other needs one ball is worth more than at 10 - 0.
     The chance is a race: each needs some units (pool: their balls and the 8 - or, 9볼, the balls left between them;
     carom: the points left to the goal); whoever is at the table runs - the first shot at the leave's chance (the judge's
     leave, 0..1), the rest at the reference hand's usual chance (WIN_Q) - until they miss, and the other comes in with an
     ordinary table (WIN_Q too). Worked out exactly for that race, the units up to 60 (tables made once). */
  const WIN_Q = { pool: 0.66, snooker: 0.6, four: 0.5, three: 0.24 };
  const winTables = new Map();
  // the race with each needing their own units: V[a][b] - the one to shoot, needing a, the other b, an ordinary table
  function winRace(q) {
    const key = 'r' + q; if (winTables.has(key)) return winTables.get(key);
    const N = 61, V = Array.from({ length: N }, () => new Float64Array(N)), u = 1 - q;
    // the part of W(a, b, l) that does not come back to the same a, b: a run of k (1..a-1) and the other in at (b, a-k)
    const part = (a, b, l) => { let s = l * q ** (a - 1); for (let k = 1; k < a; k++) s += l * q ** (k - 1) * (1 - q) * (1 - V[b][a - k]); return s; };
    for (let s = 2; s < 2 * N - 1; s++) for (let a = 1; a < N; a++) {
      const b = s - a; if (b < 1 || b >= N || b < a) continue;
      // V(a,b) = c1 + u (1 - V(b,a)), V(b,a) = c2 + u (1 - V(a,b)) - both at once
      const c1 = part(a, b, q), c2 = part(b, a, q);
      V[a][b] = (c1 + u - u * c2 - u * u) / (1 - u * u); V[b][a] = c2 + u * (1 - V[a][b]);
    }
    const out = { V, W: (a, b, l) => { a = Math.max(1, Math.min(N - 1, a)); b = Math.max(1, Math.min(N - 1, b)); return part(a, b, l) + (1 - l) * (1 - V[b][a]); } };
    winTables.set(key, out); return out;
  }
  // the race over shared balls (9볼, 증강, 스누커 near enough): S[n] - the one to shoot with n left, an ordinary table
  function winShared(q) {
    const key = 's' + q; if (winTables.has(key)) return winTables.get(key);
    const N = 61, S = new Float64Array(N), u = 1 - q;
    const part = (n, l) => { let s = l * q ** (n - 1); for (let k = 1; k < n; k++) s += l * q ** (k - 1) * (1 - q) * (1 - S[n - k]); return s; };
    for (let n = 1; n < N; n++) S[n] = (part(n, q) + u) / (1 + u);
    const out = { S, W: (n, l) => { n = Math.max(1, Math.min(N - 1, n)); return part(n, l) + (1 - l) * (1 - S[n]); } };
    winTables.set(key, out); return out;
  }
  // what each still needs after a result: { me, them } (race), or { left } (shared)
  function winUnits(world, who, r) {
    const P = g.P, on = id => world.balls[id] && world.balls[id].on;
    if (!P.POCKETED) {
      const goal = i => g.targets ? g.targets[i] : g.target || 10, have = i => (g.players[i].score || 0) + (i === g.turn && r ? (r.pts || 0) : 0);   // (r: the shot's word - its points are the shooter's, g.turn)
      return { me: Math.max(1, goal(who) - have(who)), them: Math.max(1, goal(1 - who) - have(1 - who)) };
    }
    if (g.modeId === 'eight') {
      const assign = r && r.assign, mine = g.players[who].group || (assign && (g.turn === who ? assign : assign === 'solid' ? 'stripe' : 'solid'));
      const left = grp => { let n = 0; for (let id = 1; id <= 15; id++) if (id !== 8 && on(id) && (grp === 'solid' ? id < 8 : id > 8)) n++; return n; };
      if (!mine) { const m = Math.min(left('solid'), left('stripe')) + 1; return { me: m, them: m }; }
      const theirs = mine === 'solid' ? 'stripe' : 'solid';
      return { me: left(mine) + 1, them: left(theirs) + 1 };
    }
    let n = 0; for (const b of world.balls) if (b.on && b.id !== 0) n++;
    return { left: Math.max(1, n) };
  }
  // the chance that `who` wins, `who` at the table with a leave of `l` (0..1)
  function winOf(world, who, r, l) {
    const game = !g.P.POCKETED ? g.modeId : g.mode.table === 'snooker' ? 'snooker' : 'pool', q = WIN_Q[game] || 0.5, u = winUnits(world, who, r);
    return u.left != null ? winShared(q).W(u.left, l) : winRace(q).W(u.me, u.them, l);
  }
