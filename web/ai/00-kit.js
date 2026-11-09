  /* ================= the computer player =================
     This folder is the body of one function, createAI(g): files share one scope and are read in file-name order (like
     scene/). g is the game (game.js): its table (g.world, g.P - the physics), its rules (g.mode), whose turn (g.turn).
     The rest of the app asks for one thing: plan() (90-plan.js), the shot for the player whose turn it is:
       { pos: [x, y] or null   where the cue ball is put first, when it is in hand
         angle                 direction of the stroke, radians
         V                     speed of the cue ball, m/s (g.vOf(power) turns a 0..1 power into it)
         a, b                  where the cue ball is struck: side, and above (+) or below (-) centre, -1..1
         el                    the cue raised (a jump or masse), radians; 0 flat
         think                 (optional) seconds to wait before striking, so it looks like someone thinking }
     How strong: g.levels[g.turn] (or g.level), 0 easy .. 3 the top, which does not miss. A player may instead have a
     persona (g.personas[g.turn], a person-like opponent - see 50-human.js if it exists).
     Everything here only reads the game and plays copies of the table (g.P.clone); it never changes the real one.
     Checked by node web/test/run.js: the top level keeps the table, each level beats the one below. */
  // rand(): the chance a person-like player uses. From g.aiRnd when the game is given one (a seeded match, so the same table
  // and the same seed give the same plan), else Math.random
  const rand = () => (g.aiRnd || Math.random)();
  // the stroke speeds written below were found on the old, slower cloth; on PHYS_V 8's a ball runs as far at about these
  // fractions of them (pool 0.7, carom 0.55 - measured: the speed that runs as far as the old one did)
  const PACE = { pool: 0.7, carom: 0.55 };
  // a cue ball in hand behind the head string (after a scratch on the break, game.js): where it may go, and a free spot there
  const inHand = x => g.placing !== 'kitchen' || x <= -g.P.HL / 2;
  function handSpot(x, y) {
    const P = g.P, w = g.world; if (g.placing === 'kitchen') x = Math.min(x, -P.HL / 2 - P.R);
    const q = P.isFree(w, x, y, w.cue) ? [x, y] : P.findFree(w, x, y, w.cue);
    return inHand(q[0]) ? q : P.findFree(w, -P.HL / 2 - 0.12, 0, w.cue);
  }
  function gauss() { let u = 0; for (let i = 0; i < 6; i++) u += Math.random(); return (u - 3) / Math.sqrt(0.5); }
  // a copy of the table with the stroke played out: what happened (world.ev)
  function simShot(angle, V, pos) {
    const w2 = g.P.clone(g.world);
    if (pos) { const c = w2.balls[w2.cue]; c.x = pos[0]; c.y = pos[1]; }
    g.P.strike(w2, angle, V, 0, 0);
    return g.P.run(w2, 20);
  }
  const levelOf = who => g.levels ? g.levels[who] : g.level;
