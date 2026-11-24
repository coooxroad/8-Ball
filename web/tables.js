/* The tables everything is played on, shared by the app and the server (which plays a match again to check it).
   TABLES: the pool table sizes to choose from - real regulation numbers: playing surface, ball diameter, pocket openings.
   CAROM: four-ball's medium table (254x127cm, 65.5mm balls) and three-cushion's match table (284x142cm, 61.5mm).
   physicsFor(createPhysics, tableId): the tables a game needs, as game.js wants them ({ pool, carom, carom3 }). */
const TABLES = [
  { id: 'bar', name: '당구장 7피트', short: '7피트', d: '198×99cm · 공 57mm. 공이 크게 보이고 가장 쉽습니다.', cfg: { R: 0.028575, HL: 0.99, HW: 0.495, cornerMouth: 0.114, sideMouth: 0.127 } },
  { id: 'club', name: '클럽 8피트', short: '8피트', d: '224×112cm · 공 57mm. 동호인이 많이 쓰는 중간 크기.', cfg: { R: 0.028575, HL: 1.12, HW: 0.56, cornerMouth: 0.12, sideMouth: 0.133 } },
  { id: 'pro', name: '대회 9피트', short: '9피트', d: '254×127cm · 공 57mm. 프로 대회 규격, 가장 넓고 어렵습니다.', cfg: { R: 0.028575, HL: 1.27, HW: 0.635, cornerMouth: 0.127, sideMouth: 0.14 } },
  { id: 'pub', name: '영국식 6피트', short: '6피트', d: '183×91cm · 공 51mm. 작은 공에 좁은 포켓.', cfg: { R: 0.0254, HL: 0.915, HW: 0.4575, cornerMouth: 0.089, sideMouth: 0.095 } },
];
const CAROM = { carom: { R: 0.03275, pockets: false }, carom3: { R: 0.03075, HL: 1.42, HW: 0.71, pockets: false } };
/* 스누커 (owner 11-11): the full-size table - 3569x1778mm inside the cushions, 52.5mm balls, its pockets rounded and
   tighter than a pool table's (corner ~3.5in, middle a little wider; game.js MODES.snooker). The balls are numbered
   0 the cue ball, 1-15 the reds, 16-21 the colours from yellow (2) to black (7). The markings and spots, in metres from
   the baulk cushion (the -x end) as the rules set them: the baulk line 737mm, the D's radius 292mm, the pink midway
   between the middle and the top cushion, the black 324mm from it. */
const SNOOKER = {
  cfg: { R: 0.02625, HL: 1.7845, HW: 0.889, cornerMouth: 0.09, sideMouth: 0.105, pockets: true, kind: 'snooker' },
  BAULK: 0.737, D: 0.292, BLACK: 0.324,
  hex: [0xf6f1e4, 0xc4161c, 0xf2c500, 0x0b7a3b, 0x6a3a1c, 0x1747b8, 0xef8fb0, 0x111111],   // (cue, red, then yellow .. black)
  name: ['큐볼', '빨간 공', '노란 공', '초록 공', '갈색 공', '파란 공', '분홍 공', '검은 공'],
  css: id => '#' + SNOOKER.hex[SNOOKER.kind(id)].toString(16).padStart(6, '0'),   // (a ball's colour, for the screen)
  value: id => id <= 15 ? 1 : id - 14,                       // (a red 1, yellow 2 .. black 7; the cue ball, 0, is never asked)
  kind: id => id === 0 ? 0 : id <= 15 ? 1 : id - 14,         // (the index into hex and name)
  // where a colour's spot is on table P (x along the length, the baulk end -HL; yellow on the D's right seen from baulk)
  spot(P, id) {
    const k = P.HL / 1.7845, xb = -P.HL + SNOOKER.BAULK * k, d = SNOOKER.D * k;
    return { 16: [xb, -d], 17: [xb, d], 18: [xb, 0], 19: [0, 0], 20: [P.HL / 2, 0], 21: [P.HL - SNOOKER.BLACK * k, 0] }[id];
  },
};
const physicsFor = (createPhysics, tableId) => ({ pool: createPhysics(Object.assign({ pockets: true }, (TABLES.find(t => t.id === tableId) || TABLES[0]).cfg)),
  carom: createPhysics(CAROM.carom), carom3: createPhysics(CAROM.carom3), snooker: createPhysics(SNOOKER.cfg) });
/* Tables of other shapes (physics.js shape(): a cushion along a polygon inside the table, holes in the cloth). Each maker
   takes the table (P: HL, HW, R, POCKETED) and options, and gives the spec - { poly, holes } - so the same name makes
   the same shape on every device and the server. A table with pockets gets holes on the shape's own corners (or round its
   edge); a carom table none. Puzzles name one ({ kind, ... }: TABLE_SHAPES.spec); 증강 당구's vote will too.
     circle: a round table as wide as the table is (opts.r: its radius); oval: the largest ellipse; penta and hexa: regular
     polygons as wide as the table, a corner forward; bumpy: an oval whose edge goes in and out (opts.n bumps, opts.k
     how deep); poly: any polygon given (opts.poly, opts.holes). */
const TABLE_SHAPES = (() => {
  const TAU = 6.283185307179586;
  // n points round an ellipse (rx, ry), from angle a0, radius times f(i) - with the same arithmetic everywhere: cos and
  // sin through physics' own (P.DMath is not there: the polygon is made once and handed to the world, which needs no
  // agreement beyond its numbers - every device makes them from the same spec on its own, so they are rounded to 0.1 mm)
  const r4 = v => Math.round(v * 1e4) / 1e4;
  const ring = (n, rx, ry, a0, f) => { const out = []; for (let i = 0; i < n; i++) { const a = a0 + TAU * i / n, k = f ? f(i) : 1; out.push([r4(Math.cos(a) * rx * k), r4(Math.sin(a) * ry * k)]); } return out; };
  const holesAt = (P, pts, inset) => P.POCKETED ? pts.map(([x, y]) => { const d = Math.hypot(x, y) || 1, r = P.R * 2.05; return { x: r4(x - x / d * (inset || r * 0.55)), y: r4(y - y / d * (inset || r * 0.55)), r: r4(r) }; }) : [];
  const fit = P => Math.min(P.HL, P.HW) - 0.004;
  const make = {
    circle: (P, o) => { const r = o.r || fit(P), poly = ring(64, r, r, 0); return { poly, holes: holesAt(P, ring(6, r, r, Math.PI / 6)) }; },
    oval: (P, o) => { const rx = P.HL - 0.004, ry = P.HW - 0.004, poly = ring(72, rx, ry, 0); return { poly, holes: holesAt(P, [[-rx, 0], [rx, 0], ...ring(4, rx * 0.72, ry * 0.92, Math.PI / 4)]) }; },
    penta: (P, o) => { const r = fit(P) / Math.cos(Math.PI / 5) * 0.98, poly = ring(5, r, r, Math.PI, null); const k = fit(P) / Math.max(...poly.map(p => Math.abs(p[1]))); const q = poly.map(([x, y]) => [r4(x * Math.min(1, k)), r4(y * Math.min(1, k))]); return { poly: q, holes: holesAt(P, q) }; },
    hexa: (P, o) => { const r = fit(P) / Math.cos(Math.PI / 6), poly = ring(6, r, r, 0); const q = poly.map(([x, y]) => [x, Math.max(-fit(P), Math.min(fit(P), y))]); return { poly: q, holes: holesAt(P, q) }; },
    bumpy: (P, o) => { const n = o.n || 14, k = o.k || 0.07, rx = P.HL - 0.01, ry = P.HW - 0.01, poly = ring(n * 6, rx / (1 + k), ry / (1 + k), 0, i => 1 + k * Math.cos(TAU * i / 6)); return { poly, holes: holesAt(P, ring(6, rx * 0.86 / (1 + k), ry * 0.86 / (1 + k), Math.PI / 6)) }; },
    poly: (P, o) => ({ poly: (o.poly || []).map(p => [r4(p[0]), r4(p[1])]), holes: (o.holes || []).map(h => ({ x: r4(h.x), y: r4(h.y), r: r4(h.r || P.R * 2.05) })) }),
    // a table of the puzzles' (owner 11-23): one of TABLE_OUTLINES, fitted to this table, its pockets cut in its outline
    outline: (P, o) => TABLE_OUTLINES.spec(P, o.id),
  };
  return { kinds: Object.keys(make), spec: (P, o) => o && make[o.kind] ? make[o.kind](P, o) : null };
})();
/* The puzzles' tables (owner 11-23: "Pooking has many; we need the structure for it - not walls filling an ordinary
   table"). A table is its outline: the line of the cushion's nose, where a ball's edge meets the rubber - and, inside
   it, islands (cushions round a block), and for a pocket game the pockets, set by hand on the outline (where they are
   is part of the puzzle) or else at its sharp outer corners and halfway along its long sides. Everything else follows
   from it: the physics' cushions (physics.js shape: the outline's edges, the islands', cut where a pocket is), and the
   whole table drawn round it (scene/20-table.js buildShaped: the cloth, the cushion's rubber, the rail and its wood,
   the apron, the cabinet, each pocket cut through cushion and rail) - the ordinary table is not drawn under it.
   The outlines are drawn on a 2.4 x 1.2 box (x: -1.2 .. 1.2, y: -0.6 .. 0.6) and stretched to the table's own cloth,
   so the same outline serves 4구's table and a pool table. A new table is one line here. */
const TABLE_OUTLINES = (() => {
  const H = 1.2, W = 0.6, TAU = 6.283185307179586, r4 = v => Math.round(v * 1e4) / 1e4;
  const ell = (n, rx, ry, cx, cy, a0) => Array.from({ length: n }, (_, i) => { const a = (a0 || 0) + TAU * i / n; return [(cx || 0) + Math.cos(a) * rx, (cy || 0) + Math.sin(a) * ry]; });
  const zig = (x0, x1, y, n, d) => Array.from({ length: n * 2 + 1 }, (_, i) => [x0 + (x1 - x0) * i / (n * 2), y + (i % 2 ? d : 0)]);
  const wave = (x0, x1, y, n, a, m) => Array.from({ length: m + 1 }, (_, i) => [x0 + (x1 - x0) * i / m, y + a * Math.sin(i / m * Math.PI * 2 * n)]);
  const L = [
    { id: 'rect', name: '기본', out: [[-H, -W], [H, -W], [H, W], [-H, W]] },
    { id: 'steps', name: '계단 모서리', out: [[-H, -0.05], [-1.0, -0.05], [-1.0, -0.25], [-0.8, -0.25], [-0.8, -0.45], [-0.6, -0.45], [-0.6, -W], [H, -W], [H, 0.05], [1.0, 0.05], [1.0, 0.25], [0.8, 0.25], [0.8, 0.45], [0.6, 0.45], [0.6, W], [-H, W]],
      pk: [[-H, W], [0, W], [-H, -0.05], [-0.6, -W], [0.3, -W], [H, -W], [H, 0.05], [0.6, W]] },
    { id: 'L', name: 'ㄱ자', out: [[-H, -W], [H, -W], [H, 0.02], [0.05, 0.02], [0.05, W], [-H, W]] },
    { id: 'cross', name: '십자', out: [[-0.45, -W], [0.45, -W], [0.45, -0.22], [H, -0.22], [H, 0.22], [0.45, 0.22], [0.45, W], [-0.45, W], [-0.45, 0.22], [-H, 0.22], [-H, -0.22], [-0.45, -0.22]],
      pk: [[-0.45, -W], [0.45, -W], [0.45, W], [-0.45, W], [-H, 0], [H, 0]] },
    { id: 'hour', name: '모래시계', out: [[-H, -W], [0, -0.22], [H, -W], [H, W], [0, 0.22], [-H, W]] },
    { id: 'hexa', name: '육각', out: [[-H, 0], [-0.62, -W], [0.62, -W], [H, 0], [0.62, W], [-0.62, W]] },
    { id: 'island', name: '가운데 섬', out: ell(72, H, W), islands: [ell(40, 0.26, 0.17)], pk: ell(6, H, W, 0, 0, Math.PI / 6) },
    { id: 'zig', name: '톱니', out: [...zig(-H, H, -W, 6, 0.1), [H, W], ...zig(H, -H, W, 6, -0.1).slice(1)], pk: [[-H, -W], [H, -W], [H, W], [-H, W], [0, -W + 0.1], [0, W - 0.1]] },
    { id: 'U', name: '말굽', out: [[-H, -W], [H, -W], [H, W], [0.42, W], [0.42, -0.02], [-0.42, -0.02], [-0.42, W], [-H, W]], pk: [[-H, -W], [H, -W], [H, W], [-H, W], [0.42, W], [-0.42, W], [0, -0.02]] },
    { id: 'oct', name: '팔각', out: [[-H, -0.25], [-0.85, -W], [0.85, -W], [H, -0.25], [H, 0.25], [0.85, W], [-0.85, W], [-H, 0.25]], pk: [[-H, -0.25], [-H, 0.25], [H, -0.25], [H, 0.25], [0, -W], [0, W]] },
    { id: 'wave', name: '물결', out: [...wave(-H, H, -W + 0.04, 4, 0.04, 48), ...wave(H, -H, W - 0.04, 4, 0.04, 48)], pk: [[-H, -W + 0.04], [H, -W + 0.04], [H, W - 0.04], [-H, W - 0.04]] },
    { id: 'bowtie', name: '나비', out: [[-H, -W], [-0.25, -0.18], [0.25, -0.18], [H, -W], [H, W], [0.25, 0.18], [-0.25, 0.18], [-H, W]] },
    { id: 'pillars', name: '기둥 둘', out: [[-H, -W], [H, -W], [H, W], [-H, W]], islands: [ell(24, 0.09, 0.09, -0.45, 0), ell(24, 0.09, 0.09, 0.45, 0)] },
  ];
  const area = q => { let a = 0; for (let i = 0; i < q.length; i++) { const p = q[i], n = q[(i + 1) % q.length]; a += p[0] * n[1] - n[0] * p[1]; } return a / 2; };
  // pockets by default: at the outline's sharp outer corners, and halfway along its long straight sides
  function auto(out) {
    const n = out.length, ccw = area(out) > 0, P = [];
    for (let i = 0; i < n; i++) {
      const p = out[(i - 1 + n) % n], c = out[i], q = out[(i + 1) % n], ax = c[0] - p[0], ay = c[1] - p[1], bx = q[0] - c[0], by = q[1] - c[1];
      const cr = ax * by - ay * bx, la = Math.hypot(ax, ay), lb = Math.hypot(bx, by), turn = Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb))));
      if ((ccw ? cr > 0 : cr < 0) && turn > 0.6 && la > 0.12 && lb > 0.12) P.push(c);
      if (lb > 1.3) P.push([(c[0] + q[0]) / 2, (c[1] + q[1]) / 2]);
    }
    return P;
  }
  /* a pocket at its spot: the hole's circle placed so the cushion is cut back to jaws as far apart as the table's own
     pockets' mouths - at a sharp corner (two edges meeting at the spot) the middle goes in along the corner's bisector
     until each edge is cut x from the corner, the jaws then CM apart (P.CM, the table's corner mouth); on a side, or on
     a smooth curve, the middle sits a little outside the line, the mouth SM wide (P.SM) */
  function hole(out, at, P) {
    const ccw = area(out) > 0, n = out.length, r = Math.max(P.R * 2.1, P.SM * 0.5);
    let vi = -1; for (let i = 0; i < n; i++) if (Math.hypot(out[i][0] - at[0], out[i][1] - at[1]) < 1e-6) vi = i;
    const nrm = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; return ccw ? [dy / l, -dx / l] : [-dy / l, dx / l]; };   // (out of the table)
    if (vi >= 0) {
      const p = out[(vi - 1 + n) % n], c = out[vi], q = out[(vi + 1) % n], n0 = nrm(p, c), n1 = nrm(c, q);
      const ax = c[0] - p[0], ay = c[1] - p[1], bx = q[0] - c[0], by = q[1] - c[1], la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
      const turn = Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb))));
      if (turn > 0.6) {
        // the bisector, into the table; half the corner's inside angle phi
        let ix = -(n0[0] + n1[0]), iy = -(n0[1] + n1[1]); const il = Math.hypot(ix, iy) || 1; ix /= il; iy /= il;
        const phi = (Math.PI - turn) / 2, x = P.CM / (2 * Math.sin(phi)), sn = Math.sin(phi), cs = Math.cos(phi);
        // a: how far in along the bisector puts each jaw x from the corner (the cut on an edge reaches a cos + root(r^2 - (a sin)^2))
        // (the reach grows with a up to a = r cos / sin, where it is r / sin: a circle too small for the mouth is made larger)
        const rc = Math.max(r, x * sn * 1.02);
        let lo = -rc, hi = rc * cs / Math.max(sn, 1e-3);
        for (let k = 0; k < 60; k++) { const a = (lo + hi) / 2, reach = a * cs + Math.sqrt(Math.max(0, rc * rc - a * a * sn * sn)); if (reach < x) lo = a; else hi = a; }
        const a = (lo + hi) / 2;
        return { x: r4(c[0] + ix * a), y: r4(c[1] + iy * a), r: r4(rc), cut: true };
      }
    }
    // on a side (the edge the spot is on, or the two it joins on a curve, their normals averaged)
    let nx = 0, ny = 0, best = Infinity;
    for (let i = 0; i < n; i++) {
      const a = out[i], b = out[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); if (l < 1e-9) continue;
      const u = Math.max(0, Math.min(l, ((at[0] - a[0]) * dx + (at[1] - a[1]) * dy) / l)), d = Math.hypot(at[0] - a[0] - dx / l * u, at[1] - a[1] - dy / l * u), m = nrm(a, b);
      if (d < best - 1e-9) { best = d; nx = m[0]; ny = m[1]; } else if (Math.abs(d - best) < 1e-9) { nx += m[0]; ny += m[1]; }
    }
    const k = Math.hypot(nx, ny) || 1, h = r * r - (P.SM / 2) ** 2, push = h > 0 ? Math.sqrt(h) : 0;
    return { x: r4(at[0] + nx / k * push), y: r4(at[1] + ny / k * push), r: r4(r), cut: true };
  }
  const byId = id => L.find(t => t.id === id) || null;
  // the spec physics.js shape() takes, for table P: the outline stretched to P's cloth, its pockets if P has pockets
  function spec(P, id) {
    const t = byId(id); if (!t) return null;
    const sx = (P.HL - 0.003) / H, sy = (P.HW - 0.003) / W, fit = q => q.map(p => [r4(p[0] * sx), r4(p[1] * sy)]);
    const out = fit(t.out);
    return { poly: out, islands: (t.islands || []).map(fit), holes: P.POCKETED ? fit(t.pk || auto(t.out)).map(at => hole(out, at, P)) : [], table: t.id };
  }
  return { list: L, byId, spec, ids: L.map(t => t.id) };
})();
if (typeof module !== 'undefined') module.exports = { TABLES, CAROM, SNOOKER, physicsFor, TABLE_SHAPES, TABLE_OUTLINES };
