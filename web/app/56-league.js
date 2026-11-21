/* ================= CUELEAGUE: the moment a ranked opponent is found =================
   As a league's broadcast opens (owner 11-09: "분데스리가처럼"): a wall of the league's mark - columns of it, blue and pale
   in turn - comes over the screen, each column from above or below, and runs on. (Ranked and invited games, and - owner
   11-21 - 컴퓨터 대전 and 친구와 플레이 here: local().) Owner 11-21: it no longer draws in to one
   mark - the columns go on and off the screen as they came, uncovering the game behind them, set up while the screen was
   covered: the table alone (no score bar, no keys - 50-outro.js tableAlone), softly blurred. Over it the two players' cards
   (선수증, 37-desk-menu.js playerCard - their faces and titles, what they have on) slide in from the sides face to face, VS
   between them; the blur lifts, slowly at first and then faster, the cards slide away, and the controls come up. Until
   then nobody plays and no clock runs (hold - 90-loop.js). About four seconds; taps wait under it. */
const vsIntro = {
  on: false, hold: false, box: null, raf: 0, timers: [],
  // r: the room the lobby found (ranked.found); play(): the game set up and shown (ranked.play)
  start(r, play) { vsIntro.run(() => vsIntro.cards(ranked.on), r.mode, play); },
  // a game here (owner 11-21: 컴퓨터 대전 and 친구와 플레이 open the same way - and so it can be tried without the lobby):
  // this player and the computer as picked, or the friend at the same device
  local(play) {
    const mode = prefs.mode, mine = vsIntro.me(famDama(mode));
    let theirs;
    if (prefs.vsAI) {
      const b = botNow(), pick = (list, plain, k) => { let h = 2166136261; for (const ch of b.id + k) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; const q = list.filter(x => x.id !== plain && !x.need); return q[h % q.length].id; };
      theirs = { name: b.name, dama: b.rating, bg: pick(CARD_BGS, 'tier', 'bg'), title: pick(TITLES, 'none', 't'), ...vsIntro.gearOf(null) };
    } else theirs = { name: oppName(), dama: ECONOMY.DAMA_START, rate: '-', bg: 'tier', title: 'none', ...vsIntro.gearOf(null) };
    vsIntro.run(() => vsIntro.layer([mine, theirs], mode), mode, play);
  },
  run(cards, mode, play) {
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
      const layer = cards(); if (layer) { box.appendChild(layer); if (layer.classList.contains('glass')) glass3d.opening(layer, box); }
      // (it opens only after the game's first frames have been drawn under the wall - the table's pictures and shaders made
      // then, the slowest frames of all (owner 11-21: the cards stuttered as they came in) - so nothing in the open waits)
      let k = 0; const open = () => {
        if (!vsIntro.on) return; if (++k < 3) { vsIntro.raf = requestAnimationFrame(open); return; }
        SND.good(); box.classList.add('open');
        // the blur: lifting over 2.6 s, slowly and then faster (1 - p²). Laid on as a blurred picture of the table over it,
        // faded out by the compositor (owner 11-21, the opening stuttered: the full-screen blur filter, its radius changed
        // every frame, was blurred again every frame); where the table can't be read, the filter as before
        const T = 2600, hz = vsIntro.haze();
        if (hz) { vsIntro.blur(0); hz.animate(Array.from({ length: 11 }, (_, i) => ({ opacity: 1 - (i / 10) ** 2 })), { duration: T, fill: 'forwards' }); }
        else { const t0 = performance.now(), tick = () => { const p = Math.min(1, (performance.now() - t0) / T); vsIntro.blur(1 - p * p); if (p < 1 && vsIntro.on) vsIntro.raf = requestAnimationFrame(tick); };
          vsIntro.raf = requestAnimationFrame(tick); }
        later(2350, () => box.classList.add('away'));
        later(2750, () => vsIntro.stop(true));
      };
      vsIntro.raf = requestAnimationFrame(open);
    });
  },
  // the table under the opening, blurred and dimmed as the filter makes it, as a small picture over the live one (null: the
  // 3D's picture could not be read - it is read in the frame it was drawn in, after the game's own frame)
  haze() {
    const gl = $('#gl'), r = gl.getBoundingClientRect(); if (!r.width || !gl.width) return null;
    const c = el('canvas', { id: 'vsHaze', 'aria-hidden': 'true' }); c.width = Math.max(2, Math.round(r.width / 8)); c.height = Math.max(2, Math.round(r.height / 8));
    const x = c.getContext('2d', { willReadFrequently: false }); x.filter = 'blur(1.75px) brightness(0.82)'; x.drawImage(gl, 0, 0, c.width, c.height);
    const d = x.getImageData(c.width >> 1, c.height >> 1, 1, 1).data; if (d[0] + d[1] + d[2] === 0) return null;
    Object.assign(c.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    gl.after(c); return c;
  },
  blur(k) { $('#gl').style.filter = k > 0.01 ? `blur(${(14 * k).toFixed(2)}px) brightness(${(1 - 0.18 * k).toFixed(3)})` : ''; },
  // what a card shows of the gear: the cue's and the ball set's names (none: the plain ones)
  gearOf(g) { return { cue: (CUES.find(c => c.id === (g && g.cue)) || CUES[0]).name, ball: (BALLSKINS.find(b => b.id === (g && g.ball)) || BALLSKINS[0]).name }; },
  me(dama) { return { name: prefs.names[0], dama, bg: prefs.card.bg, title: prefs.card.title, ...vsIntro.gearOf(ranked.gear()) }; },
  // a ranked (or invited) game's two cards: this player's on the left, the other's on the right, as their places at the score bar
  cards(o) {
    if (!o) return null;
    const g = o.opp.gear || {}, theirs = { name: o.opp.name, dama: typeof o.opp.dama === 'number' ? o.opp.dama : ECONOMY.DAMA_START, bg: g.card, title: g.title, ...vsIntro.gearOf(g) };
    return vsIntro.layer(o.seat === 1 ? [theirs, vsIntro.me(o.dama)] : [vsIntro.me(o.dama), theirs], o.mode);
  },
  // the cards face to face, VS and the game between them; p: { name, dama, rate? (shown for the rating), bg, title, cue, ball }
  layer(seats, mode) {
    // (디버그 모드: each card in its glass case, swinging in about its slot - 37-desk-menu.js glassCase, 79-league.css)
    const glass = glassOn();
    const card = (p, side) => { const c = playerCard({ dama: p.dama, name: p.name, sub: '', bg: p.bg, title: p.title, bar: false, stats: [['레이팅', p.rate || p.dama], ['큐', p.cue], ['공', p.ball]] });
      c.classList.add('mn-live'); return el('div', { class: 'vs-card ' + side }, glass ? glassCase(c, 266, side === 'r' ? 'l' : 'r') : c); };
    const k = Math.max(0.42, Math.min(1, innerHeight * 0.78 / 560, innerWidth * 0.3 / 244));
    const layer = el('div', { class: 'vs' + (glass ? ' glass' : ''), style: `--u:${(glass ? k * 0.86 : k).toFixed(3)}` }, [card(seats[0], 'l'), el('div', { class: 'vs-mid' }, [el('b', { text: 'VS' }), el('small', { text: MODE_KO[mode] || '' })]), card(seats[1], 'r')]);
    requestAnimationFrame(() => fxBake(layer));
    return layer;
  },
  // done (or left for home): the blur, the hold and the cover gone, the controls back; the game's own first word
  stop(done) {
    for (const t of vsIntro.timers) clearTimeout(t); vsIntro.timers = []; cancelAnimationFrame(vsIntro.raf);
    const was = vsIntro.on; vsIntro.on = false; vsIntro.hold = false;
    if (vsIntro.box) { const b = vsIntro.box; vsIntro.box = null; b.classList.add('out'); setTimeout(() => b.remove(), 400); }
    app.classList.remove('vsblur'); vsIntro.blur(0); const hz = $('#vsHaze'); if (hz) hz.remove();
    if (was) tableAlone(false);
    // (the rule's reminder the game said at its start was under the cover: said again - 4구 says its own after rolling out)
    if (done && flow === match && st.screen === 'play' && game.modeId !== 'four' && !game.over) { const t = game.mode.intro(game); if (t) toast(t, '', 2600); }
  },
};
