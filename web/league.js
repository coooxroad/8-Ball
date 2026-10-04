/* League: everyone plays everyone, results make a table. Plain data in, plain data out; no DOM in here.
   league = { mode, target, names: [...], fx: [{ r: round, a, b, w: null | 0 | 1, sa, sb }] }   (a, b: indexes into names; w: which of the two won) */
function createLeague() {
  const WIN_PTS = 3;
  // Round-robin by the circle method: one player stays put, the rest rotate. An odd count gets a rest slot.
  function fixtures(n, legs) {
    const ids = []; for (let i = 0; i < n; i++) ids.push(i);
    if (n % 2) ids.push(-1);
    const m = ids.length, out = [];
    for (let leg = 0; leg < (legs || 1); leg++) for (let r = 0; r < m - 1; r++) {
      for (let k = 0; k < m / 2; k++) {
        const x = ids[k], y = ids[m - 1 - k]; if (x < 0 || y < 0) continue;
        const swap = (r + k + leg) % 2 === 1;                    // alternate who breaks
        out.push({ r: leg * (m - 1) + r + 1, a: swap ? y : x, b: swap ? x : y, w: null, sa: 0, sb: 0 });
      }
      ids.splice(1, 0, ids.pop());
    }
    return out;
  }
  function create(names, mode, target, legs) { return { mode, target: target || 10, names: names.slice(), fx: fixtures(names.length, legs) }; }
  // rows of the table, best first: points, then wins, then the result between the two, then fewer games played
  function standings(lg) {
    const rows = lg.names.map((name, i) => ({ i, name, p: 0, w: 0, l: 0, pts: 0, form: [] }));
    for (const f of lg.fx) {
      if (f.w == null) continue;
      const win = rows[f.w === 0 ? f.a : f.b], lose = rows[f.w === 0 ? f.b : f.a];
      win.p++; win.w++; win.pts += WIN_PTS; win.form.push('W'); lose.p++; lose.l++; lose.form.push('L');
    }
    const beat = (x, y) => lg.fx.some(f => f.w != null && ((f.a === x && f.b === y && f.w === 0) || (f.a === y && f.b === x && f.w === 1)));
    rows.sort((x, y) => y.pts - x.pts || y.w - x.w || (beat(x.i, y.i) ? -1 : beat(y.i, x.i) ? 1 : 0) || x.l - y.l || x.i - y.i);
    rows.forEach((r, k) => { r.pos = k + 1; r.form = r.form.slice(-5); });
    return rows;
  }
  const next = lg => lg.fx.findIndex(f => f.w == null);            // -1 when every game has been played
  const done = lg => lg.fx.every(f => f.w != null);
  function record(lg, i, winner, sa, sb) { const f = lg.fx[i]; f.w = winner; f.sa = sa || 0; f.sb = sb || 0; }
  return { create, fixtures, standings, next, done, record, WIN_PTS };
}
if (typeof module !== 'undefined') module.exports = createLeague;
