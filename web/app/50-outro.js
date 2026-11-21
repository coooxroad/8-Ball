/* ================= the end of a match: 승리 / 패배 over the table, then the result =================
   Owner 11-21: the result does not come up the moment a match ends. The controls go, the table darkens, and the word comes
   - 승리 in gold between its laurels with rays turning behind it and a burst of sparks, 패배 dropping in, cold, 무승부 plain -
   with the score under it. A moment later the result comes up beneath it: the word glides down into the score sheet's title
   (the very place it takes there: the sheet's own title, measured), the dark lifts and the slate pops in beside the sheet
   (50-result.css #result.from-outro). A tap anywhere goes straight on. Without motion (prefers-reduced-motion): at once.

   tableAlone(on): the table alone - the score bar, the keys at the sides, the gauges, the toasts faded out, the cue and its line
   not drawn (90-loop.js); used here and by the match's opening (56-league.js). */
function tableAlone(on) {
  app.classList.toggle('bare', !!on);
  if (!on) { app.classList.add('unbare'); clearTimeout(tableAlone.t); tableAlone.t = setTimeout(() => app.classList.remove('unbare'), 500); }
}
const outro = {
  on: false, box: null, reveal: null, t: 0, opts: null,
  // o: { word, kind: 'win' | 'lose' | 'draw', score }; reveal(): the result screen shown (match.finish). Called again while
  // it is up (the room's word on the winner coming in): the word and what comes after are the new ones.
  start(o, reveal) {
    outro.reveal = reveal; outro.opts = o;
    if (outro.on) { outro.paint(); return; }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return reveal();
    outro.on = true; tableAlone(true);
    const box = outro.box = el('div', { id: 'outro', 'aria-hidden': 'true' }, [el('i', { class: 'shade' }), el('i', { class: 'rays' }), el('div', { class: 'burst' }, Array.from({ length: 14 }, (_, i) => {
      const a = (i / 14) * Math.PI * 2 + (i % 2) * 0.2, d = 120 + (i * 37) % 90;
      return el('i', { style: `--dx:${(Math.cos(a) * d).toFixed(0)}px;--dy:${(Math.sin(a) * d * 0.7).toFixed(0)}px;--d:${(i % 4) * 40}ms` });
    })), el('div', { class: 'word' }, [el('i', { class: 'lf l' }), el('span'), el('i', { class: 'lf r' })]), el('small', { class: 'sub' })]);
    box.addEventListener('pointerdown', e => { e.preventDefault(); outro.hand(); });
    document.body.appendChild(box); outro.paint();
    requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add('go')));
    outro.t = setTimeout(() => outro.hand(), o.kind === 'win' ? 2000 : 1750);
  },
  // the word, its look and size: as large as the screen allows - the laurels at most 38% of its height, the whole at most
  // 64% of its width (--S: the sheet's own title is 28px, the laurels 48 × 64: all of it at --S times that)
  paint() {
    const o = outro.opts, box = outro.box; if (!box) return;
    box.className = (box.classList.contains('go') ? 'go ' : '') + o.kind;
    box.querySelector('.word span').textContent = o.word; box.querySelector('.sub').textContent = o.score || '';
    box.style.setProperty('--S', '1');
    const w = box.querySelector('.word').offsetWidth || 200, S = Math.max(1.2, Math.min(3.4, innerHeight * 0.38 / 64, innerWidth * 0.64 / w));
    box.style.setProperty('--S', S.toFixed(3));
  },
  // into the result: shown under the word, the word moved onto the sheet's title, the dark lifted
  hand() {
    if (!outro.on || outro.handing) return; outro.handing = true; clearTimeout(outro.t);
    const box = outro.box, word = box.querySelector('.word');
    $('#result').classList.add('from-outro'); const title = $('#rTitle').parentNode; title.classList.add('held');
    outro.reveal();
    tableAlone(false); app.classList.remove('unbare');
    const to = title.getBoundingClientRect(), fr = word.getBoundingClientRect();
    if (to.width && fr.width) {
      const k = to.height / fr.height, dx = (to.left + to.width / 2) - (fr.left + fr.width / 2), dy = (to.top + to.height / 2) - (fr.top + fr.height / 2);
      word.style.transform = `translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px) scale(${k.toFixed(4)})`;
    }
    box.classList.add('hand');
    setTimeout(() => outro.stop(), 640);
  },
  // gone: the sheet's own title shown again (also when the screen is left some other way - show())
  stop() {
    clearTimeout(outro.t); outro.on = false; outro.handing = false;
    if (outro.box) { outro.box.remove(); outro.box = null; }
    const t = $('#rTitle'); if (t) t.parentNode.classList.remove('held');
    setTimeout(() => { const r = $('#result'); if (r) r.classList.remove('from-outro'); }, 900);
    if (app.classList.contains('bare') && !(typeof vsIntro !== 'undefined' && vsIntro.on)) tableAlone(false);
  },
};
