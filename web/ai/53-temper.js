  /* Stable strengths and biases belong to a person. The room's seeded RNG is reserved for events at the table.
     A plan only returns its next state; the app accepts it once, together with the Worker answer. */
  function humanPractice(person) {
    let h = 2166136261;
    for (const ch of `${person.name}|${person.icon}|${person.dama}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
    const unit = () => ((h = (Math.imul(h, 1664525) + 1013904223) >>> 0) / 4294967296);
    const limit = x => Math.max(0.03, Math.min(0.98, x)), s = person.skill;
    const ability = () => limit(s + (unit() - 0.5) * 0.25);
    const result = { aim: ability(), touch: ability(), spin: ability(), bank: ability(), position: ability(),
      thicknessBias: (unit() - 0.5) * 2, paceBias: (unit() - 0.5) * 2, bankBias: (unit() - 0.5) * 2,
      grit: 0.45 + unit() * 0.55, dexterity: limit(s * 0.6 + 0.3 + unit() * 0.1) };
    if (person.version === 3) Object.assign(result, { sideBias: unit() * 2 - 1, checking: unit(), earlyTip: unit() });
    return { ...result, ...person.practice };
  }
  function humanTurn(person) {
    const me = g.players[g.turn], opp = g.players[1 - g.turn], total = me.shots + opp.shots;
    const previous = g.humanStates && g.humanStates[g.turn], old = previous || {};
    let misses = old.misses || 0;
    if (me.shots > (old.shots || 0)) misses = me.made > (old.made || 0) ? 0 : misses + 1;
    // (the rule is the game's - g.farBehind - so the server can check a resignation against it; 9볼 here also wants two misses running)
    let loss = g.farBehind(g.turn);
    if (g.modeId === 'nine' && misses < 2) loss = 0;
    const p = person.personality, grit = person.practice.grit;
    const tilt = Math.max(0, Math.min(1, (old.tilt || 0) * 0.65 + Math.min(3, misses) * p.nerves * 0.08 + loss * (1 - grit) * 0.35));
    const freshVisit = old.shots !== me.shots, eligible = freshVisit && loss > 0 && total - (old.eventAt == null ? -20 : old.eventAt) >= 4;
    // These are tuning bounds per eligible own turn, not claimed population statistics. Close games cannot trigger them.
    const resignChance = eligible && g.humanCanResign ? loss * (1 - grit) * (0.006 + tilt * 0.025) : 0;
    const throwChance = eligible ? loss * (1 - grit) * (0.025 + p.aggression * 0.045) : 0;
    let throwing = loss > 0 ? Math.max(0, (old.throwing || 0) - (freshVisit ? 1 : 0)) : 0, action = 'play';
    if (eligible) {
      const event = rand();
      if (event < resignChance) action = 'resign';
      else if (event < resignChance + throwChance) throwing = 2;
    }
    const state = { shots: me.shots, made: me.made, misses, tilt, throwing,
      eventAt: action === 'resign' || throwing > (old.throwing || 0) ? total : old.eventAt == null ? -20 : old.eventAt };
    return { state, action, throwing: throwing > 0, loss, tilt, resignChance, throwChance };
  }
  plan.turnContext = persona => humanTurn(humanPerson(persona));
