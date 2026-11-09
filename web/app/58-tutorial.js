/* ================= 튜토리얼: the first shot, step by step =================
   Optional, and its prize once per account (economy.js TUTORIAL_PRIZE, paid by the server: /v1/tutorial). One easy
   straight-in pot on the pool table, three steps, each shown on a card at the top and ticked off as it is done:
   aim (drag the table until the line runs to the 1 ball), the strike point (open it from the cue ball key), and the
   shot (pull the power bar and let go). The shot is played as a lesson is (51-practice.js) - missed, the same balls
   come back. Potted: done, the prize asked for, and back to the lobby.
   Offered once to a new player (prefs.how not yet set - the how-to sheet would have come next), and always there from
   훈련 · 레슨. */
const TUT_DRILL = {
  id: 'tutorial', name: '튜토리얼', d: '1번 공을 포켓에 넣으세요', tip: '테이블을 끌어 조준 · 세기 막대를 당겼다 놓아 치기', vol: null, course: '',
  // the cue ball, the 1 ball and the bottom right corner pocket in a line, near and easy
  make(P) { const pk = P.POCKETS[5] || P.POCKETS[0], m = Math.hypot(pk.nx, pk.ny), ux = -pk.nx / m, uy = -pk.ny / m;
    const ob = [pk.ax + ux * 0.32, pk.ay + uy * 0.32], cb = [ob[0] + ux * 0.42, ob[1] + uy * 0.42];
    return { cue: cb, balls: [[1, ob[0], ob[1]]], need: { pot: 1 }, aim: Math.atan2(uy, ux) + Math.PI + 0.5, demo: { angle: Math.atan2(-uy, -ux), power: 0.32, a: 0, b: 0 } }; },
};
const tutorial = {
  on: false, step: 0, timer: 0, aim0: 0,
  STEPS: [['조준', '테이블을 끌어 조준선을 1번 공에 맞추세요'], ['당점', '흰 공 버튼을 눌러 당점을 보세요'], ['치기', '세기 막대를 당겼다 놓아 치세요']],
  offer() {
    if (tutorial.asked || prefs.how || prefs.tutDone || prefs.tutAsked) return; tutorial.asked = true; prefs.tutAsked = true; savePrefs();
    const P = ECONOMY.TUTORIAL_PRIZE;
    openSheet('처음이신가요?', [note(`튜토리얼 · 완료 보상 코인 ${P.coin} + ${itemName({ kind: P.kind, id: P.id })}`),
      el('button', { class: 'btn cta', text: '튜토리얼 시작', onclick: () => { SND.tap(); closeSheet(); tutorial.start(); } }),
      flatBtn('건너뛰기', () => { closeSheet(); prefs.how = true; savePrefs(); })]);
  },
  start() {
    const p = practice; usePhysics(); prefs.how = true; savePrefs();
    p.drill = TUT_DRILL; p.level = 1; p.streak = 0; p.tries = 0; p.ok = 0; p.edit = false; p.before = null;
    game.start('practice', [prefs.names[0], ''], false, {});
    flow = practice; scene.setMarks(null); dress(false); useCue(prefs.cues[0]); scene.setTable(game.P); show('play');
    tutorial.on = true; tutorial.step = 0;
    p.layout = TUT_DRILL.make(game.P); tutorial.ideal = p.layout.demo.angle; p.again();
    tutorial.aim0 = st.aim; tutorial.bar(); tutorial.paint();
    clearInterval(tutorial.timer); tutorial.timer = setInterval(tutorial.tick, 150);
  },
  // (the strike point's key pressed counts at once - it may be shut again before the next look)
  spun() { if (tutorial.on && tutorial.step === 1) tutorial.next(); },
  // the practice row turned to the tutorial's own: only leaving it
  bar() { const box = $('#pracBar'); box.textContent = ''; box.hidden = false; $('#p1').hidden = true;
    box.appendChild(el('button', { class: 'btn', text: '그만하기', onclick: () => { SND.tap(); tutorial.stop(); goHome(); } })); },
  // the steps done as they are done (looked at a few times a second: the aim, the strike point opened)
  tick() {
    if (!tutorial.on || flow !== practice) return tutorial.stop();
    const s = tutorial.step, d = Math.abs(((st.aim - tutorial.ideal) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
    if (s === 0 && st.phase === 'aim' && d < 0.05) tutorial.next();
    else if (s === 1 && !$('#spinPop').hidden) tutorial.next();
  },
  next() { tutorial.step++; SND.good(); tutorial.paint(); },
  paint() {
    let c = $('#coach'); if (!c) { c = el('div', { id: 'coach', role: 'status' }); $('#app').appendChild(c); }
    if (!tutorial.on) { c.hidden = true; return; }
    const s = Math.min(tutorial.step, tutorial.STEPS.length - 1), [t, say] = tutorial.STEPS[s];
    c.hidden = false; c.textContent = '';
    c.append(el('span', { class: 'dots' }, tutorial.STEPS.map((x, i) => el('i', { class: i < tutorial.step ? 'done' : i === s ? 'now' : '' }))), el('b', { text: `${s + 1}. ${t}` }), el('small', { text: say }));
    c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
  },
  // the shot's result (from practice.afterShot): potted - done; else the same balls again, the steps kept
  shot(ok) {
    if (!ok) { toast('다시 · 조준선을 1번 공 가운데로', 'foul', 2000); return; }
    tutorial.stop(); prefs.tutDone = true; savePrefs();
    if (net.on) net.claim('tutorial', {});
    SND.win(); const P = ECONOMY.TUTORIAL_PRIZE;
    openSheet('튜토리얼 완료', [note(`보상 · 코인 ${P.coin} + ${itemName({ kind: P.kind, id: P.id })}`),
      el('button', { class: 'btn cta', text: '로비로', onclick: () => { SND.tap(); closeSheet(); goHome(); } })]);
  },
  stop() { tutorial.on = false; clearInterval(tutorial.timer); const c = $('#coach'); if (c) c.hidden = true; },
};
$('#spinBtn').addEventListener('click', () => tutorial.spun());
