/* Every key answers the hand (owner, 11-08: "the buttons are all static"). One set of rules for all of them, here and in
   style/15-press.css, rather than each key its own:
   - pressed: it sinks (scale .97, at once) and a ripple of its own colour spreads from the finger (--press, set per kind of
     key in the CSS); let go, it springs back a little past where it was and settles (a firm spring, low bounce);
   - a key that will not go (disabled, locked, coming later) shakes its head and knocks instead;
   - the one chosen (a tab, a rail key) lights a ring round itself as it becomes chosen;
   - when a place opens, its cards and keys are laid down one after another from a little below;
   - the main key of a screen (a big blue one, 랭킹전's card) has a light passing over it now and then;
   - the big moments (a purchase) burst: a flash and sparks of the key's colour (fxBurst).
   No vibration (owner). Timings from current practice: press in under 100 ms, back in 160-260 ms, a spring that settles
   without wobbling. (`scale` is its own property, so none of this fights the keys' own transforms.) */
const PRESS = 'button, .bd';
const pressFx = { last: null, enter: false, n: 0 };
const fxOf = el => (getComputedStyle(el).getPropertyValue('--press') || '').trim() || 'rgba(255,255,255,.55)';
// (what the ripple and the light are laid in must hold them: a key left in the flow is made the place they are measured from)
const fxHold = el => { if (getComputedStyle(el).position === 'static') el.style.position = 'relative'; return el; };
const fxBlocked = el => el.disabled || el.classList.contains('soon') || el.classList.contains('lock') || el.getAttribute('aria-disabled') === 'true';
function fxRipple(el, x, y) {
  const host = fxHold(el.querySelector(':scope > .sk') || el), r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
  let clip = host.querySelector(':scope > .fx-clip'); if (!clip) { clip = document.createElement('i'); clip.className = 'fx-clip'; host.appendChild(clip); }
  const w = host.offsetWidth, h = host.offsetHeight, px = (x - r.left) / r.width * w, py = (y - r.top) / r.height * h;
  const d = 2 * Math.hypot(Math.max(px, w - px), Math.max(py, h - py)), dot = document.createElement('i');
  dot.className = 'fx-rip'; Object.assign(dot.style, { left: px - d / 2 + 'px', top: py - d / 2 + 'px', width: d + 'px', height: d + 'px', background: fxOf(el) });
  clip.appendChild(dot); setTimeout(() => dot.remove(), 700);
}
document.addEventListener('pointerdown', e => {
  const el = e.target.closest && e.target.closest(PRESS); if (!el || el.closest('[data-nofx]')) return;
  if (fxBlocked(el)) { el.classList.remove('fx-no'); void el.offsetWidth; el.classList.add('fx-no'); SND.init(); SND.nope(); setTimeout(() => el.classList.remove('fx-no'), 400); return; }
  el.classList.remove('fx-up'); el.classList.add('fx-down'); fxRipple(el, e.clientX, e.clientY);
  pressFx.last = { text: el.textContent.trim(), at: performance.now() };
  const up = () => { el.classList.remove('fx-down'); el.classList.add('fx-up'); setTimeout(() => el.classList.remove('fx-up'), 320);
    removeEventListener('pointerup', up, true); removeEventListener('pointercancel', up, true); };
  addEventListener('pointerup', up, true); addEventListener('pointercancel', up, true);
}, true);
// what a repaint brings in: the key just chosen lights its ring; on a place just opened, the cards and keys come down in turn
new MutationObserver(ms => {
  const fresh = []; for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) fresh.push(n);
  if (!fresh.length) return;
  const L = pressFx.last, recent = L && performance.now() - L.at < 900;
  for (const n of fresh) for (const k of [n, ...n.querySelectorAll('[aria-selected="true"], [aria-pressed="true"]')]) {
    if (!(k.matches && k.matches('[aria-selected="true"], [aria-pressed="true"]'))) continue;
    if (recent && k.textContent.trim() === L.text) { k.classList.add('fx-sel'); setTimeout(() => k.classList.remove('fx-sel'), 700); }
  }
  if (pressFx.enter) {
    pressFx.enter = false; let i = 0;
    for (const n of fresh) for (const k of [n, ...n.querySelectorAll('.bd, .dk-card, .dk-rb, .dk-main, .dk-sec')]) {
      if (!(k.matches && k.matches('.bd, .dk-card, .dk-rb, .dk-main, .dk-sec'))) continue;
      k.style.setProperty('--fx-i', Math.min(i++, 14)); k.classList.add('fx-in'); setTimeout(() => k.classList.remove('fx-in'), 900);
    }
  }
  for (const n of fresh) for (const k of [n, ...n.querySelectorAll('.dk-main:not([disabled]), .bd-rank')]) {
    if (!(k.matches && k.matches('.dk-main:not([disabled]), .bd-rank')) || k.querySelector(':scope .fx-shine')) continue;
    const host = fxHold(k.querySelector(':scope > .sk') || k), s = document.createElement('i'); s.className = 'fx-shine'; host.appendChild(s);
  }
}).observe(document.body, { childList: true, subtree: true });
// a big moment on a key (or at a point): a flash and sparks of its colour
function fxBurst(el) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, c = fxOf(el), box = document.createElement('div');
  box.className = 'fx-burst'; box.style.left = x + 'px'; box.style.top = y + 'px';
  const ring = document.createElement('i'); ring.className = 'ring'; ring.style.borderColor = c; box.appendChild(ring);
  for (let i = 0; i < 16; i++) { const s = document.createElement('i'), a = i / 16 * 2 * Math.PI + Math.random() * 0.3, d = 60 + Math.random() * 70;
    s.className = 'spark'; s.style.background = i % 3 ? c : '#fff'; s.style.setProperty('--dx', Math.cos(a) * d + 'px'); s.style.setProperty('--dy', Math.sin(a) * d + 'px'); box.appendChild(s); }
  document.body.appendChild(box); SND.burst(); setTimeout(() => box.remove(), 900);
}
