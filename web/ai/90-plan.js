  // the shot for the player whose turn it is (00-kit.js says what a plan is)
  function plan() {
    const persona = g.personas && g.personas[g.turn];
    if (persona && typeof humanPlan === 'function') return humanPlan(persona);
    return g.mode.table === 'carom' ? aiCarom() : aiPool();
  }
  // the game review's strong player (50-human.js humanReview): the same one every time
  let reviewer = null;
  function review(played) {
    if (!reviewer) { let h = 20261117; reviewer = personaFor(2300, () => ((h = (Math.imul(h, 1664525) + 1013904223) >>> 0) / 4294967296), { style: 'position', personality: 'calm' }, true); reviewer.name = '리뷰'; }
    return typeof humanPlan === 'function' ? humanPlan(reviewer, played) : null;
  }
  // The lobby opts into v3 using the rating it will display and settle the match against.
  return { plan, review, personaFor, rankedPersonaFor: (rating, random, overrides) => personaFor(rating, random, overrides, true) };
