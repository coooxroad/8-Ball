  /* Three independent axes: personality controls table manners, DAMA controls ability, style controls shot preferences.
     Saved personas are plain JSON. Matching/UI can use g.aiPlan.personaFor(dama, seededRand, optionalOverrides).
     The current app has no avatar registry; icon 0 is the conservative default until matching supplies its own icon. */
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
  function personaFor(dama, random = rand, overrides = {}) {
    const pick = a => a[Math.min(a.length - 1, Math.max(0, Math.floor(random() * a.length)))];
    const koA = ['느긋한', '동네', '오후의', '파란', '작은', '조용한', '빠른', '새벽', '월요일', '은빛', '주말', '느린', '달빛', '초록', '반듯한', '오늘도'];
    const koB = ['초크', '한큐', '쿠션', '장갑', '펠트', '레일', '호두', '산책', '별빛', '그림자', '바람', '마루', '연습', '나무', '돌담', '구름'];
    const enA = ['chalk', 'walnut', 'felt', 'rail', 'cloud', 'mint', 'quiet', 'cocoa', 'slow', 'olive', 'monday', 'dawn', 'linen', 'soda', 'amber', 'oak'];
    const enB = ['day', 'room', 'walk', 'cue', 'note', 'table', 'side', 'shot', 'line', 'break', 'spin', 'blue', 'time', 'run', 'lane', 'club'];
    const name = random() < 0.5 ? pick(koA) + pick(koB) + Math.floor(random() * 100) : pick(enA) + '_' + pick(enB) + String(Math.floor(random() * 100)).padStart(2, '0');
    const personality = humanPersonalities.find(p => p.id === overrides.personality) || pick(humanPersonalities);
    const style = humanStyles.find(p => p.id === overrides.style) || pick(humanStyles);
    const rating = Math.round(Math.max(10, Math.min(120, Number.isFinite(dama) ? dama : 30)));
    return { version: 1, name, icon: 0, dama: rating, skill: humanSkill(rating), personality: { ...personality }, style: { ...style } };
  }
  function humanPresentation(shot, person, difficulty) {
    const p = person.personality, jitter = () => rand() * 2 - 1;
    const think = Math.max(1.5, Math.min(12, 1.5 + (1 - p.tempo) * 3 + difficulty * (1.5 + p.hesitation * 3) + rand() * 1.2));
    const kind = rand() < p.taunt ? 'taunt' : rand() < p.hesitation ? 'reconsider' : 'settle';
    const frames = [], power = Math.max(0, Math.min(1, g.powerOf(shot.V)));
    const frame = (t, angle, pull = 0, aimPower = 0) => ({ t, angle, a: shot.a, b: shot.b, el: shot.el, power: aimPower, pull });
    frames.push(frame(0, shot.angle + jitter() * 0.18));
    if (kind === 'taunt') {
      const n = 6 + Math.floor(rand() * 7), amplitude = 0.22 + rand() * 0.65;
      for (let i = 1; i <= n; i++) frames.push(frame(think * 0.67 * i / n, shot.angle + (i % 2 ? -1 : 1) * amplitude * (0.7 + rand() * 0.3), i % 2 ? 0.25 : 0));
    } else if (kind === 'reconsider') {
      frames.push(frame(think * 0.28, shot.angle + jitter() * 0.12), frame(think * 0.5, shot.angle + jitter() * 0.04), frame(think * 0.65, shot.angle + jitter() * 0.09));
    } else frames.push(frame(think * 0.55, shot.angle + jitter() * 0.015));
    frames.push(frame(think * 0.76, shot.angle), frame(think * 0.88, shot.angle, 0.25, power * 0.25), frame(think, shot.angle, 1, power));
    return { think, preShot: { version: 1, kind, duration: think, keyframes: frames } };
  }
  function humanCueAt(shot, seconds) {
    // Presentation never consumes random numbers or changes the shot. Any frame rate reaches the same final pose.
    const keys = shot.preShot.keyframes, t = Math.max(0, Math.min(shot.preShot.duration, seconds));
    let i = 1; while (i < keys.length - 1 && keys[i].t < t) i++;
    const a = keys[i - 1], b = keys[i], u = Math.max(0, Math.min(1, (t - a.t) / Math.max(1e-9, b.t - a.t))), v = u * u * (3 - 2 * u);
    const out = { t }; for (const k of ['a', 'b', 'el', 'power', 'pull']) out[k] = a[k] + (b[k] - a[k]) * v;
    const da = Math.atan2(Math.sin(b.angle - a.angle), Math.cos(b.angle - a.angle)); out.angle = a.angle + da * v;
    return out;
  }
  // 90-plan.js returns only { plan }; function properties expose matching/presentation without changing that entry point.
  plan.personaFor = personaFor;
  plan.cueAt = humanCueAt;
  plan.profiles = { personalities: humanPersonalities.map(p => ({ ...p })), styles: humanStyles.map(p => ({ ...p })) };
