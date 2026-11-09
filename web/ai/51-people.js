  /* Three independent axes: personality controls table manners, rating controls ability, style controls shot preferences.
     Saved personas are plain JSON. Only the ranked lobby creates version 3 personas.
     Ranked room icons use the same 0..7 range as server/src/ranked.js. */
  const humanPersonalities = [
    { id: 'calm', name: '차분함', tempo: 0.5, aggression: 0.45, nerves: 0.12, taunt: 0, hesitation: 0.15 },
    { id: 'playful', name: '장난기', tempo: 0.6, aggression: 0.65, nerves: 0.2, taunt: 0.8, hesitation: 0.25 },
    { id: 'impatient', name: '성급함', tempo: 0.95, aggression: 0.8, nerves: 0.3, taunt: 0.22, hesitation: 0.05 },
    { id: 'meticulous', name: '신중함', tempo: 0.15, aggression: 0.25, nerves: 0.15, taunt: 0, hesitation: 0.7 },
    { id: 'fidgety', name: '산만함', tempo: 0.65, aggression: 0.55, nerves: 0.35, taunt: 0.35, hesitation: 0.6 },
    { id: 'nervous', name: '소심함', tempo: 0.3, aggression: 0.3, nerves: 0.7, taunt: 0, hesitation: 0.8 },
  ];
  const humanStyles = [
    { id: 'balanced', name: '정석', power: 0.35, spin: 0.25, bank: 0.2, masse: 0.05, safety: 0.5, desperation: 0.2 },
    { id: 'power', name: '강타', power: 0.95, spin: 0.4, bank: 0.25, masse: 0.1, safety: 0.1, desperation: 0.95 },
    { id: 'spinner', name: '회전파', power: 0.45, spin: 0.95, bank: 0.4, masse: 0.35, safety: 0.3, desperation: 0.55 },
    { id: 'banker', name: '쿠션파', power: 0.5, spin: 0.5, bank: 0.95, masse: 0.1, safety: 0.35, desperation: 0.4 },
    { id: 'masse', name: '맛세이파', power: 0.45, spin: 0.75, bank: 0.3, masse: 0.95, safety: 0.15, desperation: 0.65 },
    { id: 'defensive', name: '수비파', power: 0.12, spin: 0.3, bank: 0.2, masse: 0.02, safety: 0.95, desperation: 0.05 },
    { id: 'gather', name: '모아치기파', power: 0.18, spin: 0.65, bank: 0.15, masse: 0.02, safety: 0.6, desperation: 0.1, gather: 1 },
    { id: 'draw', name: '끌어치기파', power: 0.5, spin: 0.75, bank: 0.3, masse: 0.15, safety: 0.35, desperation: 0.35, draw: 1 },
    { id: 'follow', name: '밀어치기파', power: 0.4, spin: 0.65, bank: 0.35, masse: 0.03, safety: 0.45, desperation: 0.25, follow: 1 },
    { id: 'natural', name: '무회전파', power: 0.25, spin: 0.1, bank: 0.3, masse: 0.01, safety: 0.6, desperation: 0.15, natural: 1 },
    { id: 'position', name: '포지션파', power: 0.35, spin: 0.6, bank: 0.4, masse: 0.05, safety: 0.65, desperation: 0.1, position: 1 },
    { id: 'showman', name: '묘기파', power: 0.7, spin: 0.9, bank: 0.8, masse: 0.8, safety: 0.1, desperation: 0.7 },
  ];
  function humanSkill(dama) {
    const x = Math.max(10, Math.min(80, Number.isFinite(dama) ? dama : 30));
    const knots = [[10, 0.05], [30, 0.4], [60, 0.8], [80, 0.95]];
    for (let i = 1; i < knots.length; i++) if (x <= knots[i][0]) {
      const [a, b] = knots[i - 1], [c, d] = knots[i], t = (x - a) / (c - a);
      return b + (d - b) * t * t * (3 - 2 * t);
    }
    return 0.95;
  }
  const rankedSkills = [[500, 0.19], [800, 0.36], [1100, 0.52], [1400, 0.68], [1700, 0.83], [2000, 0.95]];
  function rankedSkill(rating) {
    if (!Number.isFinite(rating)) rating = rankedSkills[0][0];
    let [lo, lowSkill] = rankedSkills[0];
    if (rating <= lo) return lowSkill;
    for (const [hi, highSkill] of rankedSkills.slice(1)) {
      if (rating <= hi) return lowSkill + (highSkill - lowSkill) * (rating - lo) / (hi - lo);
      lo = hi; lowSkill = highSkill;
    }
    return lowSkill;
  }
  function personaFor(dama, random = rand, overrides = {}, ranked = false) {
    const pick = a => a[Math.min(a.length - 1, Math.max(0, Math.floor(random() * a.length)))];
    const name = ranked ? rankedName(random) : humanName(random);
    const personality = humanPersonalities.find(p => p.id === overrides.personality) || pick(humanPersonalities);
    const style = humanStyles.find(p => p.id === overrides.style) || pick(humanStyles);
    const rating = ranked ? dama : Math.round(Math.max(10, Math.min(120, Number.isFinite(dama) ? dama : 30)));
    const skill = ranked ? rankedSkill(rating) : humanSkill(rating);
    const level = ranked ? (rating < 800 ? 0 : rating < 1400 ? 1 : 2) : (rating < 22 ? 0 : rating < 40 ? 1 : 2);
    const person = { version: ranked ? 3 : 2, name, icon: Math.min(7, Math.max(0, Math.floor(random() * 8))), dama: rating, skill, level, personality: { ...personality }, style: { ...style } };
    return { ...person, practice: humanPractice(person) };
  }
  function humanPerson(persona) {
    // Existing ranked rooms may carry only name/icon/DAMA/level. Identity selects stable axes across reloads and turns;
    // no extra gameplay random draws or mutation of the room's saved persona are needed for this compatibility path.
    const identity = `${persona.name || ''}|${persona.icon || 0}|${persona.dama || 30}`;
    let hash = 2166136261; for (let i = 0; i < identity.length; i++) hash = Math.imul(hash ^ identity.charCodeAt(i), 16777619) >>> 0;
    const skill = persona.version === 3 ? rankedSkill(persona.dama) :
      Number.isFinite(persona.skill) ? Math.max(0, Math.min(1, persona.skill)) : humanSkill(persona.dama);
    const person = { ...persona, skill,
      personality: persona.personality || { ...humanPersonalities[hash % humanPersonalities.length] },
      style: persona.style || { ...humanStyles[(hash >>> 8) % humanStyles.length] } };
    return { ...person, practice: humanPractice(person) };
  }
  function humanPresentation(shot, person, difficulty, context = {}) {
    const p = person.personality, jitter = () => rand() * 2 - 1;
    const think = Math.max(1.5, Math.min(12, 1.5 + (1 - p.tempo) * 3 + difficulty * (1.5 + p.hesitation * 3) + rand() * 1.2));
    const ranked = person.version === 3, skill = person.skill;
    const event = rand(), mistap = 0.008 + (1 - person.practice.dexterity) * (ranked ? 0.08 : 0.035) + (p.id === 'fidgety' ? 0.015 : 0);
    const cancel = p.hesitation * 0.16 + (difficulty > 1.3 ? 0.035 : 0) + (ranked ? (1 - skill) * difficulty * 0.035 : 0), taunt = p.taunt * 0.18;
    const kind = event < mistap ? 'mistap' : event < mistap + cancel ? 'cancel' : event < mistap + cancel + taunt ? 'taunt' : rand() < p.hesitation * 0.3 ? 'reconsider' : 'settle';
    const frames = [], power = Math.max(0, Math.min(1, g.powerOf(shot.V)));
    const guide = context.guide || [], opening = guide[0] ?? shot.angle;
    const setTip = ranked ? 0.57 - skill * 0.22 + person.practice.earlyTip * 0.22 + jitter() * 0.13 : 0.5;
    const frame = (t, angle, pull = 0, aimPower = 0, pos = shot.pos || null) => {
      const ready = t >= think * setTip;
      return { t, angle, a: ready ? shot.a : 0, b: ready ? shot.b : 0, el: ready || !ranked ? shot.el : 0, power: aimPower, pull, pos };
    };
    frames.push(frame(0, guide.length ? opening : shot.angle + jitter() * (ranked ? 0.08 + (1 - skill) * 0.22 : 0.18)));
    if (kind === 'mistap') {
      const c = g.world.balls[g.world.cue], x = (rand() * 2 - 1) * g.P.HL, y = (rand() * 2 - 1) * g.P.HW;
      const wrong = Math.atan2(y - c.y, x - c.x);
      frames.push(frame(think * 0.16, wrong), frame(think * 0.27, wrong), frame(think * 0.42, opening));
    } else if (kind === 'cancel') {
      const other = context.alternative, angle = other ? other.angle : shot.angle + jitter() * 0.35, pos = other && other.pos || shot.pos || null;
      frames[0] = frame(0, angle, 0, 0, pos);
      frames.push(frame(think * 0.23, angle, 0.6, power * 0.65, pos), frame(think * 0.32, angle, 0, 0, pos), frame(think * 0.55, opening));
    } else if (kind === 'taunt') {
      const n = 6 + Math.floor(rand() * 7), amplitude = 0.22 + rand() * 0.65;
      for (let i = 1; i <= n; i++) frames.push(frame(think * 0.67 * i / n, shot.angle + (i % 2 ? -1 : 1) * amplitude * (0.7 + rand() * 0.3), i % 2 ? 0.25 : 0));
    } else if (kind === 'reconsider') {
      frames.push(frame(think * 0.28, opening + jitter() * 0.12), frame(think * 0.5, opening + jitter() * 0.04), frame(think * 0.65, opening + jitter() * 0.09));
    } else if (ranked && !guide.length) {
      const overshoot = jitter() * (1 - skill) * (0.04 + difficulty * 0.025);
      frames.push(frame(think * 0.33, shot.angle + overshoot), frame(think * 0.55, shot.angle - overshoot * 0.3));
    } else if (!ranked) frames.push(frame(think * 0.55, shot.angle + jitter() * 0.015));
    const settle = ranked ? 0.75 + rand() * 0.09 : 0.76;
    if (guide.length) {
      const last = frames[frames.length - 1].t / think;
      const start = Math.max(last + 0.035, 0.15 + rand() * 0.12);
      const steps = kind === 'settle' ? guide.slice(1) : guide;
      steps.forEach((angle, i) => frames.push(frame(think * (start + (settle - start) * (i + 0.35 + rand() * 0.3) / steps.length), angle)));
    }
    const pullAt = ranked ? settle + (1 - settle) * (0.38 + rand() * 0.34) : 0.88;
    const pull = ranked ? 0.15 + rand() * 0.25 : 0.25;
    frames.push(frame(think * settle, shot.angle), frame(think * pullAt, shot.angle, pull, power * pull), frame(think, shot.angle, 1, power));
    return { think, preShot: { version: ranked ? 3 : 2, kind, duration: think, keyframes: frames } };
  }
  function humanCueAt(shot, seconds) {
    // Presentation never consumes random numbers or changes the shot. Any frame rate reaches the same final pose.
    const keys = shot.preShot.keyframes, t = Math.max(0, Math.min(shot.preShot.duration, seconds));
    let i = 1; while (i < keys.length - 1 && keys[i].t < t) i++;
    const a = keys[i - 1], b = keys[i], u = Math.max(0, Math.min(1, (t - a.t) / Math.max(1e-9, b.t - a.t))), v = u * u * (3 - 2 * u);
    const out = { t }; for (const k of ['a', 'b', 'el', 'power', 'pull']) out[k] = a[k] + (b[k] - a[k]) * v;
    const da = Math.atan2(Math.sin(b.angle - a.angle), Math.cos(b.angle - a.angle)); out.angle = a.angle + da * v;
    out.pos = t >= b.t ? b.pos || null : a.pos || null;
    return out;
  }
  // 90-plan.js returns only { plan }; function properties expose matching/presentation without changing that entry point.
  plan.personaFor = personaFor;
  plan.cueAt = humanCueAt;
  plan.profiles = { personalities: humanPersonalities.map(p => ({ ...p })), styles: humanStyles.map(p => ({ ...p })) };
