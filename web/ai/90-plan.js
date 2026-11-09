  // the shot for the player whose turn it is (00-kit.js says what a plan is)
  function plan() {
    const persona = g.personas && g.personas[g.turn];
    if (persona && typeof humanPlan === 'function') return humanPlan(persona);
    return g.mode.table === 'carom' ? aiCarom() : aiPool();
  }
  // The lobby opts into v3 using the rating it will display and settle the match against.
  return { plan, personaFor, rankedPersonaFor: (rating, random, overrides) => personaFor(rating, random, overrides, true) };
