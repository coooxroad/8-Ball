/* ================= CUELEAGUE: the moment a ranked opponent is found =================
   As a league's broadcast opens (owner 11-09: "분데스리가처럼"): a wall of the league's mark - columns of it, blue and pale
   in turn - comes over the screen, each column from above or below, and runs on. Owner 11-21: it no longer draws in to one
   mark - the columns go on and off the screen as they came, uncovering the game behind them, set up while the screen was
   covered: the table alone (no score bar, no keys - 50-outro.js tableAlone), softly blurred. Over it the two players' cards
   (선수증, 37-desk-menu.js playerCard - their faces and titles, what they have on) slide in from the sides face to face, VS
   between them; the blur lifts, slowly at first and then faster, the cards slide away, and the controls come up. Until
   then nobody plays and no clock runs (hold - 90-loop.js). About four seconds; taps wait under it. */
const vsIntro = {
  on: false, hold: false, box: null, raf: 0, timers: [],
  // r: the room the lobby found (ranked.found); play(): the game set up and shown (ranked.play)
  start(r, play) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return play();
    vsIntro.stop(); vsIntro.on = true;
    const W = innerWidth, H = innerHeight, n = W > H ? 5 : 3, cw = W / n;
    const wall = el('div', { class: 'wall' }, Array.from({ length: n }, (_, i) => el('div', { class: 'col ' + (i % 2 ? 'pale' : 'blue'), style: `left:${(i * cw).toFixed(1)}px;width:${Math.ceil(cw) + 1}px;--d:${i * 45}ms;--from:${i % 2 ? '100%' : '-100%'};--to:${i % 2 ? '-100%' : '100%'}` },
      el('i', { class: 'strip', style: `--w:${(cw * 0.66).toFixed(1)}px` }))));
    const box = vsIntro.box = el('div', { id: 'league', 'aria-hidden': 'true' }, [wall]);
    document.body.appendChild(box);
    const later = (ms, fn) => vsIntro.timers.push(setTimeout(fn, ms));
    // covered (the last column in): the game set up underneath, the table alone and blurred
    later(560 + n * 45, () => {
      vsIntro.hold = true; tableAlone(true); app.classList.add('vsblur'); vsIntro.blur(1);
      play();
      const o = ranked.on; if (o) box.appendChild(vsIntro.cards(o));
      SND.good(); box.classList.add('open');
      // the blur: lifting over 2.6 s, slowly and then faster (1 - p²)
      const t0 = performance.now(), T = 2600, tick = now => { const p = Math.min(1, (now - t0) / T); vsIntro.blur(1 - p * p); if (p < 1 && vsIntro.on) vsIntro.raf = requestAnimationFrame(tick); };
      vsIntro.raf = requestAnimationFrame(tick);
      later(2350, () => box.classList.add('away'));
      later(2750, () => vsIntro.stop(true));
    });
  },
  blur(k) { $('#gl').style.filter = k > 0.01 ? `blur(${(14 * k).toFixed(2)}px) brightness(${(1 - 0.18 * k).toFixed(3)})` : ''; },
  // the two cards: this player's on the left, the other's on the right, as their places at the score bar
  cards(o) {
    const gearOf = g => ({ cue: (CUES.find(c => c.id === (g && g.cue)) || CUES[0]).name, ball: (BALLSKINS.find(b => b.id === (g && g.ball)) || BALLSKINS[0]).name });
    const mine = { name: prefs.names[0], dama: o.dama, bg: prefs.card.bg, title: prefs.card.title, ...gearOf(ranked.gear()) };
    const g = o.opp.gear || {}, theirs = { name: o.opp.name, dama: typeof o.opp.dama === 'number' ? o.opp.dama : ECONOMY.DAMA_START, bg: g.card, title: g.title, ...gearOf(g) };
    const card = (p, side) => { const c = playerCard({ dama: p.dama, name: p.name, sub: side === 'l' ? '나' : '상대', bg: p.bg, title: p.title, bar: false, stats: [['레이팅', p.dama], ['큐', p.cue], ['공', p.ball]] });
      c.classList.add('mn-live'); return el('div', { class: 'vs-card ' + side }, c); };
    const seats = o.seat === 1 ? [theirs, mine] : [mine, theirs];
    const k = Math.max(0.42, Math.min(1, innerHeight * 0.78 / 560, innerWidth * 0.3 / 228));
    const layer = el('div', { class: 'vs', style: `--u:${k.toFixed(3)}` }, [card(seats[0], 'l'), el('div', { class: 'vs-mid' }, [el('b', { text: 'VS' }), el('small', { text: MODE_KO[o.mode] || '' })]), card(seats[1], 'r')]);
    requestAnimationFrame(() => fxBake(layer));
    return layer;
  },
  // done (or left for home): the blur, the hold and the cover gone, the controls back; the game's own first word
  stop(done) {
    for (const t of vsIntro.timers) clearTimeout(t); vsIntro.timers = []; cancelAnimationFrame(vsIntro.raf);
    const was = vsIntro.on; vsIntro.on = false; vsIntro.hold = false;
    if (vsIntro.box) { const b = vsIntro.box; vsIntro.box = null; b.classList.add('out'); setTimeout(() => b.remove(), 400); }
    app.classList.remove('vsblur'); vsIntro.blur(0);
    if (was) tableAlone(false);
    // (the rule's reminder the game said at its start was under the cover: said again - 4구 says its own after rolling out)
    if (done && flow === match && st.screen === 'play' && game.modeId !== 'four' && !game.over) { const t = game.mode.intro(game); if (t) toast(t, '', 2600); }
  },
};
