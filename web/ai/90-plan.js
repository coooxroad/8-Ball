  // the shot for the player whose turn it is (00-kit.js says what a plan is)
  function plan() {
    const persona = g.personas && g.personas[g.turn];
    // (스누커 has no person-like player yet: a stand-in plays it at its level - 11-16, 스누커 in 랭킹전)
    if (persona && g.mode.table === 'snooker') { const keep = g.levels; g.levels = [persona.level || 0, persona.level || 0]; try { return aiPool(); } finally { g.levels = keep; } }
    if (persona && typeof humanPlan === 'function') return humanPlan(persona);
    return g.mode.table === 'carom' ? aiCarom() : aiPool();
  }
  // the game review: one shot judged (60-judge.js) - the reference hand, the same for everyone
  const review = played => judgeShot(played);
  // The lobby opts into v3 using the rating it will display and settle the match against.
  // (judgeKit: the judge's parts, for the tests and the tuning tools - web/test/judge.js)
  return { plan, review, judgeKit: { JUDGE, kissStory, kissSeen, seeSkill, potLines, potExtras, caromLines, cushionFirst, judgeAim, leaveOf, leaveTeach, judgeView, judgeSim, winChance, winOf, winRace, routeOf, shapeOf, whyBetter, raisedShots, STROKE_SET, PACE, strokeFeatures, strokeGuess,
    // (the seeing AI, 64-see-mind.js: the puzzle AI, the fair-play tools and the tests use it as it is)
    see: { MIND, SEE, seeComp, seeHand, seeFaces, seeCast, seeRecord, seeView, seeMindEv, seeMindOk, seeJudge, seeAims, seeSig, seeSweep, seeRefine, seeRuns, seeFeats, seeFindD, seeIdea, seeRoutes, seeChoose, seeInverse, seeKiss, kissStory, kissSeen } }, personaFor, rankedPersonaFor: (rating, random, overrides) => personaFor(rating, random, overrides, true) };
