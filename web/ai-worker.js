/* The computer player off the screen's thread. A search can take a few hundred milliseconds (8볼's top level most of all);
   run where the screen runs, every frame waits for it. The page starts a Worker from the same game code (content, tables,
   physics, game, the computer player - the page's first script, or the web's core file) with this file in it, and asks it
   for a plan; the screen keeps moving meanwhile (app/40-shot.js aiAsk).
   aiServe(job) is the whole of it, plain and testable in node:
     job:   { id, tbl, d: game.serialize(), levels, personas, rnd: the seeded chance's state or null }
     reply: { id, plan, rnd: its state after } or { id, err }
   The game is rebuilt from the saved table - exactly, the numbers go across as they are - and the same code makes the same
   plan: a stand-in's seeded chances come back so the page's own go on from where the plan left them. */
const aiServe = (() => {
  let G = null, PHW = null, tblNow = null;
  return function aiServe(job) {
    try {
      if (!G) { PHW = {}; G = createGame(PHW, createAI); }
      if (tblNow !== job.tbl) { Object.assign(PHW, physicsFor(createPhysics, job.tbl)); tblNow = job.tbl; }
      if (!G.restore(job.d)) return { id: job.id, err: 'bad table' };
      G.levels = job.levels || null; G.personas = job.personas || null;
      G.humanStates = job.humanStates || null; G.humanCanResign = !!job.humanCanResign;
      G.aiRnd = job.rnd == null ? null : seededRandom(job.rnd);
      const plan = G.aiPlan();
      return { id: job.id, plan, rnd: G.aiRnd ? G.aiRnd.state() : null };
    } catch (e) { return { id: job.id, err: String(e && e.message || e) }; }
  };
})();
if (typeof document === 'undefined' && typeof self !== 'undefined' && typeof postMessage === 'function') self.onmessage = e => postMessage(aiServe(e.data));
if (typeof module !== 'undefined') module.exports = aiServe;
