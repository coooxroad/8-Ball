/* ================= CUELEAGUE: the moment a ranked opponent is found =================
   As a league's broadcast opens (owner 11-09: "분데스리가처럼"): a wall of the league's mark - columns of it, blue and pale
   in turn - comes over the screen, each column from above or below, and runs on; then the wall draws in to one mark in
   the middle, CUELEAGUE under it with the game and the two players, and it all lifts off the table the game has set up
   underneath. About two seconds; taps wait under it. Only movement and opacity, each column on a layer of its own. */
function leagueIntro(mode, me, opp) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const old = $('#league'); if (old) old.remove();
  const W = innerWidth, H = innerHeight, n = W > H ? 5 : 3, cw = W / n;
  const wall = el('div', { class: 'wall' }, Array.from({ length: n }, (_, i) => el('div', { class: 'col ' + (i % 2 ? 'pale' : 'blue'), style: `left:${(i * cw).toFixed(1)}px;width:${Math.ceil(cw) + 1}px;--d:${i * 45}ms;--from:${i % 2 ? '100%' : '-100%'}` },
    el('i', { class: 'strip', style: `--w:${(cw * 0.66).toFixed(1)}px` }))));
  const crest = el('div', { class: 'crest' }, [el('i', { class: 'box' }, el('i', { class: 'mk' })), el('b', { text: 'CUELEAGUE' }), el('small', { text: `${MODE_KO[mode] || ''} · ${me} vs ${opp}` })]);
  const fx = el('div', { id: 'league', 'aria-hidden': 'true' }, [wall, crest]);
  document.body.appendChild(fx);
  // the wall draws in to the size of the one mark in the middle
  const k = Math.min(0.34, (W > H ? 0.22 : 0.42) * Math.min(W, H) / W * 1.6); fx.style.setProperty('--k', k.toFixed(3));
  setTimeout(() => { fx.classList.add('in'); SND.good(); }, 1050);
  setTimeout(() => fx.classList.add('out'), 2050);
  setTimeout(() => fx.remove(), 2500);
}
