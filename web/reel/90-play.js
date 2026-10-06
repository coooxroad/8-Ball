const BEST = Object.keys(STYLES).filter(id => !STYLES[id].worst && !STYLES[id].hidden), WORST = Object.keys(STYLES).filter(id => STYLES[id].worst);
// every edit comes up once before any comes up again
function pick(kind) {
  const bag = bags[kind];
  if (!bag.length) { bag.push(...(kind === 'worst' ? WORST : BEST)); for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)), x = bag[i]; bag[i] = bag[j]; bag[j] = x; } if (last[kind] === bag[bag.length - 1] && bag.length > 1) bag.unshift(bag.pop()); }
  return bag.pop();
}

// `shot`: a best shot, or (with shot.kind set) a worst one. `style`: one of the edits by name, or nothing for the next in the shuffle.
function play(shot, style) {
  const w = game.world, carom = game.mode && game.mode.table === 'carom', kind = shot.kind ? 'worst' : 'best';
  tp = HL.record(game.P, w.balls.length, shot);
  const id = style === 'plain' ? style : STYLES[style] && !!STYLES[style].worst === (kind === 'worst') ? style : pick(kind); if (id !== 'plain') last[kind] = id;
  cam = { az: shot.aim - Math.PI / 2 + 1.0, el: 1.15, zoom: 1, tx: 0, ty: 0 };
  r = { best: shot, id, style: STYLES[id], t: 0, T: 0, rate: 0, rush: 0, bn: null, key: kind === 'worst' ? shot.ball : shot.key >= 0 ? shot.key : tp.cue, struck: false, dropped: false, cue: true, pull: 0.03,
    from: Object.assign({}, cam), paths: [], parts: [], rings: [], cols: {} };
  scene.clearFalls(); HL.restore(w, shot.snap); w.snd.length = 0;
  for (let i = 0; i < tp.nb; i++) {
    r.cols[i] = carom ? ['#ffffff', '#ffd23c', '#ff4d43', '#ff4d43'][i] || '#fff' : i === tp.cue ? '#ffffff' : i === 8 ? '#aab1bd' : ballCss(i);
    const pts = HL.path(tp, i); if (pts) r.paths.push({ id: i, pts, col: r.cols[i] });
  }
  const c = w.balls[w.cue]; r.cue0 = [c.x, c.y];
  st.aim = shot.aim; st.power = Math.min(1, game.powerOf(shot.V)); st.spin = { x: shot.a / 0.5, y: shot.b / 0.5 }; st.el = shot.el || 0;
  const info = kind === 'best' ? SND.song.info : null; r.beat = 60 / (info ? info.bpm : 140);
  $('#reelFx').textContent = ''; big.className = ''; big.textContent = ''; tag(''); $('#reel').hidden = false; $('#reelFade').classList.remove('go');
  $('#reel').style.setProperty('--kc', r.cols[r.key] === '#aab1bd' ? '#ffffff' : r.cols[r.key] || '#ffffff');
  app.classList.remove(...CLS); app.classList.add('reeling'); skin(id); hideCard();
  r.lead = r.style.init();                                   // real seconds from now to the key moment
  r.song = kind === 'best' && id !== 'plain' ? SND.song.play(r.lead) : false;
  scene.setCam(cam); drawOverlay(0);
}
function stop() {
  if (!r) return; r = null;
  SND.song.stop(); SND.rolling(0); scene.clearFalls();
  $('#reel').hidden = true; app.classList.remove(...CLS); skin(null); hideCard(); big.className = ''; tag(''); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height);
  scene.setOrbit(false); d.onEnd();
}

// one frame; returns what the scene should show, or null once the reel is over
function tick(dt) {
  r.t += dt;
  const song = r.song ? SND.song.time() : null, rel = song != null ? song : r.t - r.lead;   // seconds since the key moment (negative before)
  if (r.style.step(dt, rel + r.lead, rel) === false) { stop(); return null; }
  const bn = Math.floor(rel / r.beat);
  if (bn !== r.bn) { r.bn = bn; if (r.style.beat) r.style.beat(bn); if (r.dropped && !r.style.worst && !r.style.bare && r.outAt == null) again(app, 'pulse'); }
  scene.setCam(cam); drawOverlay(dt);
  return { alpha: 1, pull: r.pull, cue: r.cue };
}
return { play, tick, skip: stop, STYLES: BEST.map(id => [id, STYLES[id].name]), WORST, get playing() { return !!r; }, get style() { return r && r.id; } };
