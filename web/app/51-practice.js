/* ================= flow: practice (free table, or a drill that checks each shot) ================= */
// put a drill layout on the table
function putLayout(L) {
  const P = game.P, w = game.world;
  game.MODES.practice.setup(game, Math.random); scene.clearFalls();
  if (L.rack) { game.MODES.eight.setup(game, Math.random); game.placing = null; st.aim = 0; }
  else {
    P.place(w, 0, L.cue[0], L.cue[1], Math.random);
    for (const [id, x, y] of L.balls) P.place(w, id, x, y, Math.random);
    st.aim = L.aim;
  }
  st.rev++; scene.invalidate();
}
const practice = {
  quiet: false, save: false,
  drill: null, level: 1, streak: 0, tries: 0, ok: 0, layout: null, before: null, beforeAim: 0, edit: false,
  start(id) {
    usePhysics(false);
    if (id) { prefs.drill = id; savePrefs(); }
    const p = practice; p.drill = drills.byId(prefs.drill); p.level = levelOf(p.drill.id); p.streak = 0; p.tries = 0; p.ok = 0; p.edit = false; p.before = null;
    game.start('practice', [prefs.names[0], ''], false, {});
    flow = practice; scene.setMarks(null); dress(false); useCue(prefs.cues[0]); scene.setTable(game.P); show('play'); p.bar();
    if (p.drill.make) p.fresh();
    else { game.MODES.eight.setup(game, Math.random); game.placing = null; game.isBreak = false; scene.clearFalls(); st.aim = 0; st.rev++; beginTurn(true); }
    toast(p.drill.tip || '규칙 없이 자유롭게 칩니다. "옮기기"를 켜면 공을 끌어 옮길 수 있습니다.', '', 5200);
  },
  restart() { practice.start(); },
  fresh() { const p = practice; p.layout = drills.make(p.drill.id, game.P, p.level, Math.random, game.vOf) || p.layout; p.again(); },   // a new layout
  again() { const p = practice; flow = practice; putLayout(p.layout); scene.setZone(p.layout.zone); beginTurn(true); },       // the same layout once more
  guide: () => prefs.guides[0],
  auto: () => null,
  beforeShot() { practice.before = game.world.balls.map(b => [b.x, b.y, b.on]); practice.beforeAim = st.aim; },
  afterShot() {
    const p = practice;
    if (!p.drill.make) { game.resolve(); return beginTurn(false); }
    const why = drills.judge(p.layout, game.world.ev, game.world.balls[0]);
    game.resolve(); p.tries++;
    if (why) { p.streak = 0; toast('실패 · ' + why, 'foul', 1900); SND.bad(); return hold(1.7, p.again); }           // same layout until it goes in
    p.ok++; p.streak++;
    let msg = '성공!';
    if (p.streak >= 3 && p.level < drills.LEVELS) { p.level++; p.streak = 0; prefs.drillLv[p.drill.id] = p.level; savePrefs(); p.bar(); msg = `성공! 이제 ${p.level}단계`; }
    else if (p.level < drills.LEVELS) msg = `성공! 다음 단계까지 ${3 - p.streak}번`;
    toast(msg, 'good', 1700); SND.good(); hold(1.4, p.fresh);
  },
  hud() {
    const p = practice;
    paintPill(0, { name: p.drill.name, on: true, sub: p.drill.make ? `${p.level}단계 · 성공 ${p.ok}/${p.tries}` : '규칙 없음', tray: [], pts: null });
    paintBadge('레슨', { text: p.drill.make ? p.drill.d : '자유롭게' }); setBusy();
  },
  // the row of buttons where the second player's panel would be
  bar() {
    const p = practice, box = $('#pracBar'); box.textContent = ''; box.hidden = false; $('#p1').hidden = true;
    const btn = (text, fn, on) => box.appendChild(el('button', { class: 'btn', text, 'aria-pressed': String(!!on), onclick: () => { SND.tap(); fn(); } }));
    const aiming = fn => () => { if (flow === practice && st.phase === 'aim') fn(); };
    if (!p.drill.make) {
      btn('되돌리기', p.undo);
      btn('옮기기', () => { p.edit = !p.edit; p.bar(); if (p.edit) toast('공을 끌어 옮깁니다. 테이블 밖으로 끌면 빠집니다.', '', 2600); }, p.edit);
      btn('공 놓기', p.sheetRack);
    } else {
      btn('시범', aiming(() => { toast('시범: 이렇게 치면 됩니다.', '', 2200); playDemo(p.layout.demo, { quiet: false, after: p.again }); }));
      btn('힌트', () => toast(p.drill.tip + ' (' + drills.hint(p.layout.demo) + ')', '', 5200));
      btn('새 배치', aiming(p.fresh));
      btn(p.level + '단계', p.sheetLevel);
    }
  },
  undo() {
    const p = practice;
    if (st.phase !== 'aim' || !p.before) return toast('되돌릴 샷이 없습니다.', '', 1400);
    p.before.forEach((s, i) => { const b = game.world.balls[i]; b.x = b.px = s[0]; b.y = b.py = s[1]; b.on = s[2]; b.vx = b.vy = b.wx = b.wy = b.wz = 0; });
    st.aim = p.beforeAim; st.rev++; flow.hud(); scene.invalidate();
  },
  sheetLevel() {
    const p = practice, i = drills.list.indexOf(p.drill), next = drills.list[i + 1 < drills.list.length ? i + 1 : 1];
    const levels = []; for (let k = 1; k <= drills.LEVELS; k++) levels.push([k, k + '단계']);
    openSheet(p.drill.name, [
      segRow('단계', levels, p.level, v => { p.level = v; p.streak = 0; prefs.drillLv[p.drill.id] = v; savePrefs(); closeSheet(); p.bar(); if (flow === practice && st.phase === 'aim') p.fresh(); }),
      note('세 번 잇따라 성공하면 다음 단계로 올라갑니다. 단계가 오르면 거리가 멀어지고 각도가 커지고 원이 작아집니다. 배치는 성공할 때마다 바뀝니다.'),
      flatBtn(`다음 훈련: ${next.name}`, () => practice.start(next.id)),
    ]);
  },
  sheetRack() {
    const P = game.P, w = game.world, done = () => { closeSheet(); st.rev++; flow.hud(); scene.invalidate(); };
    const clear = () => { for (let i = 1; i < 16; i++) { w.balls[i].on = false; w.balls[i].x = w.balls[i].px = 9 + i; } };
    openSheet('공 놓기', [
      flatBtn('8볼 모양으로 15개', () => { game.MODES.eight.setup(game, Math.random); game.placing = null; game.isBreak = false; done(); }),
      flatBtn('9볼 모양으로 9개', () => { clear(); game.MODES.nine.setup({ P, world: w }, Math.random); done(); }),
      flatBtn('공 하나 더 놓기', () => {
        const b = w.balls.find(x => x.id > 0 && !x.on); if (!b) return toast('공 15개가 모두 올라와 있습니다.', '', 1600);
        const [x, y] = P.findFree(w, P.HL * 0.3, 0, b.id); P.place(w, b.id, x, y, Math.random); done();
      }),
      flatBtn('큐볼만 남기고 치우기', () => { clear(); done(); }),
      note('놓은 뒤 "옮기기"를 켜고 원하는 자리로 끌어 옮기세요.'),
    ]);
  },
};
