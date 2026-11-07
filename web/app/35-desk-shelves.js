/* 내 장비 and 상점: shelves of cards. The rail picks the kind (큐 · 공 · 테이블 · 트레일 · 장갑); the felt tray shows its
   cards, each with the thing in it; tapping a card opens it in the tray - large, or tried on the live table - with an X
   at the top left back to the cards, and the slate says what it is and wears it (상점: buys it, once the shop opens).
   Opening a card only tries it on (the scene shows it); X or another place puts back what is worn. */
let shelfOpen = null;                                                 // the card opened in the tray, or null for all the cards
const hx6 = h => '#' + h.toString(16).padStart(6, '0');
// a set of balls in its case, a ball in each cup (cup centres 23.6, 50 and 76.4% down): carom white, yellow, red; else
// the cue ball, the 1 and the 3
function ballCase(k) {
  const c = isCarom(), ids = c ? [0, 1, 2] : [0, 1, 11], kind = c ? 'carom' : 'pool';
  return el('i', { class: 'bcase' }, [el('img', { class: 'box', src: 'ui/ball-case.webp', alt: '' }),
    ...ids.map((n, j) => ballPic(k.id, kind, n, { class: 'b', style: `top:${[23.6, 50, 76.4][j]}%` }))]);
}
/* A trail's card: the way a ball went up the card, drawn as that trail draws it (a trail with a kind; scene/55-chalk.js,
   56-fx.js) - or, for a plain one, a streak of its colour. Each drawn once. */
const trailPics = {};
function trailPic(kind, wide) {
  const key = kind + (wide ? ':w' : ''); if (trailPics[key]) return trailPics[key];
  // drawn upright, the ball coming down to the bottom; wide: the same turned so it comes in from the left to the right
  const W = 160, H = 260, c = document.createElement('canvas'); c.width = wide ? H : W; c.height = wide ? W : H; const g = c.getContext('2d');
  if (wide) g.setTransform(0, -1, 1, 0, 0, W);
  const text = (t, x, y) => { g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#f6f8f0'; g.font = '20px Jua, sans-serif'; g.textAlign = 'center'; g.fillText(t, wide ? y : x, wide ? W - x : y); g.restore(); };
  let sd = 5; const r = () => { sd = (sd * 1664525 + 1013904223) >>> 0; return sd / 4294967296; };
  const P = [[60, 4], [128, 96], [34, 186], [80, 256]];                         // down the card, off a cushion and back
  const along = (f, step) => { for (let i = 0; i < P.length - 1; i++) { const [x0, y0] = P[i], [x1, y1] = P[i + 1], L = Math.hypot(x1 - x0, y1 - y0); for (let d = 0; d < L; d += step) f(x0 + (x1 - x0) * d / L, y0 + (y1 - y0) * d / L, d / L, i); } };
  const path = () => { g.beginPath(); P.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); };
  g.lineCap = g.lineJoin = 'round';
  if (kind === 'chalk') {
    for (let k = 0; k < 3; k++) { g.strokeStyle = `rgba(246,248,240,${0.5 + r() * 0.3})`; g.lineWidth = 2 + r() * 1.5; g.save(); g.translate(r() * 2 - 1, r() * 2 - 1); path(); g.stroke(); g.restore(); }
    g.strokeStyle = 'rgba(246,248,240,.8)'; g.lineWidth = 1.6; g.beginPath(); g.arc(34, 186, 18, -0.95, 0.95); g.stroke();
    text('44°', 74, 192);
  } else if (kind === 'stars') {
    g.strokeStyle = 'rgba(200,225,255,.7)'; g.lineWidth = 1.2; path(); g.stroke();
    along((x, y) => { if (r() < 0.5) return; g.fillStyle = ['#fff', '#bfe3ff', '#ffe7a3'][(r() * 3) | 0]; g.globalAlpha = 0.5 + r() * 0.5; g.beginPath(); g.arc(x + r() * 10 - 5, y + r() * 10 - 5, 1 + r() * 1.6, 0, 7); g.fill(); g.globalAlpha = 1; }, 6);
    for (const [x, y] of P) { const s = 13; g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x, y - s); g.quadraticCurveTo(x, y, x + s, y); g.quadraticCurveTo(x, y, x, y + s); g.quadraticCurveTo(x, y, x - s, y); g.quadraticCurveTo(x, y, x, y - s); g.fill(); }
  } else if (kind === 'puff') {
    along((x, y, t, i) => { const k = 9 + ((i + t) / 3) * 14; g.fillStyle = ['#d9d39c', '#c9d79a', '#e6dcb9'][(r() * 3) | 0]; g.strokeStyle = 'rgba(90,100,50,.45)'; g.lineWidth = 2;
      for (let j = 0; j < 3; j++) { g.beginPath(); g.arc(x + (r() - 0.5) * k, y + (r() - 0.5) * k * 0.6, k * (0.5 + r() * 0.3), 0, 7); g.fill(); g.stroke(); } }, 34);
  } else if (kind === 'ink') {
    along((x, y, t, i) => { const w = 4 + (i + t) * 3.5; g.fillStyle = 'rgba(14,14,18,.92)'; g.beginPath(); g.arc(x, y, Math.max(2, w / 2), 0, 7); g.fill(); if (i === 2 && r() < 0.4) { g.fillStyle = 'rgba(14,14,18,.5)'; g.fillRect(x + 6, y, 2, 2); } }, 1.5);
    for (let k = 0; k < 10; k++) { g.fillStyle = 'rgba(14,14,18,.85)'; g.beginPath(); g.arc(34 + (r() - 0.3) * 24, 186 + (r() - 0.5) * 28, 1 + r() * 3, 0, 7); g.fill(); }
  } else if (kind === 'fire') {
    along((x, y, t, i) => { const k = 10 + r() * 8; const gr = g.createRadialGradient(x, y, 0, x, y - k * 0.4, k);
      gr.addColorStop(0, 'rgba(255,245,200,.95)'); gr.addColorStop(0.35, 'rgba(255,170,40,.8)'); gr.addColorStop(1, 'rgba(220,40,10,0)');
      g.fillStyle = gr; g.beginPath(); g.ellipse(x, y - k * 0.3, k * 0.45, k, 0, 0, 7); g.fill(); }, 9);
  } else if (kind === 'ghost') {
    let k = 0; along((x, y) => { const a = 0.15 + 0.6 * (k / 14); g.fillStyle = `hsla(${(k * 40) % 360},100%,60%,${Math.min(0.75, a)})`; g.beginPath(); g.arc(x, y, 13, 0, 7); g.fill(); k++; }, 18);
  } else if (kind === 'grass') {
    g.strokeStyle = 'rgba(150,215,120,.5)'; g.lineWidth = 16; path(); g.stroke();
    along((x, y) => { g.fillStyle = r() < 0.55 ? '#6b4a2a' : '#4f9a3a'; for (const sd2 of [-1, 1]) { g.beginPath(); g.ellipse(x + sd2 * (10 + r() * 12), y + (r() - 0.5) * 8, 2 + r() * 2, 1.5 + r(), r() * 3, 0, 7); g.fill(); } }, 14);
  } else if (kind === 'splash') {
    along((x, y) => { g.fillStyle = r() < 0.5 ? '#fff' : '#cfefff'; for (const sd2 of [-1, 1]) { g.beginPath(); g.arc(x + sd2 * (8 + r() * 14), y + (r() - 0.5) * 8, 1.6 + r() * 2.4, 0, 7); g.fill(); } }, 12);
    g.strokeStyle = 'rgba(230,250,255,.85)'; g.lineWidth = 2; for (const [x, y] of P.slice(1, 3)) for (const k of [10, 20]) { g.beginPath(); g.ellipse(x, y, k * 1.3, k * 0.8, 0, 0, 7); g.stroke(); }
  }
  return (trailPics[key] = c.toDataURL());
}
const streak = (q, big) => q.kind ? el('i', { class: 'trl pic' + (big ? ' big' : ''), style: `--pic:url(${trailPic(q.kind, big)})` })
  : el('i', { class: 'trl' + (big ? ' big' : '') + (q.color === 'rainbow' ? ' rb' : q.color ? '' : ' none'), style: q.color && q.color !== 'rainbow' ? `--c:${hx6(q.color)}` : '' });
/* A cue opened in the tray lies on the tray itself (no table under it, so nothing but the cue to look at): photographed
   whole once (and kept: 32-desk.js lazyPic), laid along the tray's diagonal from the lower left up to the right, the tip
   at the top, as large as fits. The angle and size follow the tray's shape (a phone's or a tablet's), worked out again
   when it changes. In the picture the tip is at the left (scene cueShot), so it is turned half round and up. */
function cueShow(i) {
  const c = CUES[i], img = lazyPic(el('img', { class: 'all', alt: c.name, draggable: 'false' }), `c/${c.id}/all`, () => { const k = scene.cueShot(i, 2000, null, 'auto'); return { c: k, done: k.done }; });   // (lazyPic wants { c, done })
  const box = el('div', { class: 'cuelay' }, img);
  const fit = () => {
    const W = box.clientWidth, H = box.clientHeight, nw = img.naturalWidth, nh = img.naturalHeight; if (!W || !H || nw < 8) return;
    const a = Math.atan2(H, W), r = nh / nw, ca = Math.cos(a), sa = Math.sin(a);
    const w = Math.min(W / (ca + r * sa), H / (sa + r * ca));                 // (the turned picture's box within the tray's)
    img.style.width = w + 'px'; img.style.transform = `translate(-50%,-50%) rotate(${180 - a * 180 / Math.PI}deg)`;
  };
  img.addEventListener('load', fit);
  if (typeof ResizeObserver === 'function') new ResizeObserver(fit).observe(box); else requestAnimationFrame(fit);
  return box;
}
const gloveImg = g => el('img', { class: 'glove', src: `ui/glove-${g.id}.webp`, alt: g.name, draggable: 'false' });
// (a table with a look has the whole of it on its card, not a swatch tiled)
const clothPic = q => el('i', { class: 'clothcard', style: `--w:${hx6(q.wood)};background-color:${hx6(q.felt)};background-image:url(ui/cloth-${q.id}.webp)` + (q.look ? ';background-size:cover;background-position:center' : '') });
/* How a cue or glove plays, as numbers and bars (content/00-rarity.js), set against what is worn now: the bar is blue up to
   what the worn one gives, green where this one gives more, red where it gives less, and the change beside the number.
   OVR is the one number for the whole: a cue's from its three (70 with nothing either way, up to 95), a glove's from how
   fine its two steps are (60 bare-handed, up to 95). Each row: { k: label, v, w (worn), lo, hi (the bar's ends), t: text,
   d: the change as text, up: whether more is better }. */
const cueOVR = c => { const s = (c && c.stat) || {}; return Math.round(70 + 1.25 * ((s.power || 0) + (s.spin || 0) + (s.guide || 0))); };
const gloveFine = s => [(BARE_HAND.power - s.power) / (BARE_HAND.power - 0.25), (BARE_HAND.dial - s.dial) / (BARE_HAND.dial - 0.03)];
const gloveOVR = g => { const f = gloveFine((g && g.stat) || BARE_HAND); return Math.round(60 + 35 * (f[0] + f[1]) / 2); };
const sgn = (n, unit) => n > 0 ? `+${n}${unit}` : n < 0 ? `${n}${unit}` : '';
function cueStats(c, worn) {
  const s = c.stat || {}, w = (worn && worn.stat) || {};
  const rows = [['최대 파워', 'power'], ['회전', 'spin'], ['조준선', 'guide']].map(([k, f]) => ({ k, v: 100 + (s[f] || 0), w: 100 + (w[f] || 0), lo: 100 - STAT_MAX, hi: 100 + STAT_MAX, up: true }));
  for (const r of rows) { r.t = r.v + '%'; r.d = sgn(r.v - r.w, ''); }
  const o = cueOVR(c), ow = cueOVR(worn);
  return { ovr: o, ovrD: sgn(o - ow, ''), rows };
}
function gloveStats(g, worn) {
  const s = g.stat || BARE_HAND, w = (worn && worn.stat) || BARE_HAND, round = x => Math.round(x * 1000) / 1000;
  // (a finer step is better: the bar runs from the bare hand's step at its left to the finest at its right)
  const rows = [{ k: '세기 단위', v: s.power, w: w.power, lo: BARE_HAND.power, hi: 0.25, t: String(s.power), d: sgn(round(s.power - w.power), '') },
    { k: '다이얼 단위', v: s.dial, w: w.dial, lo: BARE_HAND.dial, hi: 0.03, t: s.dial + '°', d: sgn(round(s.dial - w.dial), '°') }];
  for (const r of rows) r.up = false;
  const o = gloveOVR(g), ow = gloveOVR(worn);
  return { ovr: o, ovrD: sgn(o - ow, ''), rows };
}
// one row: the bar's blue (what the worn one gives), then green (more) or red (less), and the number with its change
function statRow(r) {
  const at = v => Math.max(0, Math.min(1, (v - r.lo) / (r.hi - r.lo))), a = at(r.v), b = at(r.w), better = a > b, pct = x => (x * 100).toFixed(1) + '%';
  const good = r.d && better, bad = r.d && !better && a !== b;
  return el('div', { class: 'dk-stat' }, [el('span', { class: 'k', text: r.k }),
    el('i', { class: 'bar' }, [el('i', { class: 'cur', style: `width:${pct(Math.min(a, b))}` }), a !== b ? el('i', { class: better ? 'up' : 'down', style: `left:${pct(Math.min(a, b))};width:${pct(Math.abs(a - b))}` }) : null]),
    el('b', { text: r.t }), el('em', { class: good ? 'up' : bad ? 'down' : '', text: r.d })]);
}
const SHELVES = {
  cue: { name: '큐', list: () => CUES, worn: () => prefs.cues[0], pic: c => el('i', { class: 'cuecard' }, cueImg(c)),
    show: (c, stage, i) => { stage.dataset.win = '0'; dkPut(stage, cueShow(i)); },
    about: c => [c.note, ...(c.spec || [])], stats: c => cueStats(c, CUES[prefs.cues[0]]), wear: (c, i) => { prefs.cues[0] = i; prefs.cue = i; if (!prefs.vsAI && prefs.cues[1] === undefined) prefs.cues[1] = i; useCue(i); return `${c.name}를 들었습니다.`; } },
  ball: { name: '공', list: () => BALLSKINS, worn: () => Math.max(0, BALLSKINS.findIndex(b => b.id === prefs.ballSkin)), pic: ballCase,
    show: k => useBalls(k.id), about: k => [k.note, ['소재', '페놀 수지'], ['지름', isCarom() ? (prefs.mode === 'three' ? '61.5mm' : '65.5mm') : '57.2mm']],
    wear: k => { prefs.ballSkin = k.id; return `${k.name} 공을 꺼냈습니다.`; }, undo: () => useBalls(prefs.ballSkin) },
  table: { name: '테이블', list: () => CLOTHS, worn: () => prefs.cloth, pic: clothPic, show: (c, stage, i) => scene.setCloth(i),
    about: c => [c.ice ? '빙판: 공이 미끄러져 오래 구르고 회전이 잘 먹지 않습니다. 대결에만 적용됩니다.' : '천 색은 보기만 다르고 공은 똑같이 구릅니다.', ['천', c.ice ? '얼음' : '워스티드 울'], ['나무', c.grain === 'walnut' ? '월넛' : c.grain === 'mahogany' ? '마호가니' : '도장 마감']],
    wear: (c, i) => { prefs.cloth = i; homePreview(); return `${c.name} 테이블로 바꿨습니다.`; }, undo: () => dress(iceOn()) },
  trail: { name: '트레일', list: () => TRAILS, worn: () => Math.max(0, TRAILS.findIndex(t => t.id === prefs.trail)), pic: q => streak(q),
    show: (q, stage) => { scene.setTrail(q.id); stage.dataset.win = '0'; dkPut(stage, el('div', { class: 'bigpic' }, streak(q, true))); },
    about: q => [q.note, '큐볼이 지나간 길에 남고, 다음 샷을 치면 지워집니다. 보기만 다를 뿐 경기에는 영향이 없습니다.'],
    wear: q => { prefs.trail = q.id; return `트레일: ${q.name}`; }, undo: () => scene.setTrail(prefs.trail) },
  glove: { name: '장갑', list: () => GLOVES, worn: () => GLOVES.findIndex(g => g.id === prefs.glove), pic: gloveImg,
    show: (g, stage) => { stage.dataset.win = '0'; dkPut(stage, el('div', { class: 'bigpic' }, gloveImg(g))); },
    about: () => ['브리지 손에 끼는 세 손가락 장갑. 큐가 손가락 사이로 매끄럽게 미끄러집니다. 장갑에 따라 샷 세기와 미세 조준을 더 작은 단위로 조절할 수 있습니다.', ...GLOVE_SPEC],
    // (the finest a glove may go, for the bars: a quarter of a power step, three hundredths of a degree)
    stats: g => gloveStats(g, GLOVES.find(x => x.id === prefs.glove)),
    wear: g => { prefs.glove = g.id; return `${g.name} 장갑을 꼈습니다.`; } },
};
const SHELF_KEYS = ['cue', 'ball', 'table', 'trail', 'glove'];
function shelfClose() { const k = SHELVES[deskTab === 'shop' ? shopSel : gearSel]; if (shelfOpen != null && k && k.undo) k.undo(); shelfOpen = null; }
function gearOff() { shelfClose(); }                                  // (also called on leaving the place)
function shelfPage(d, shop) {
  const kind = shop ? shopSel : gearSel, K = SHELVES[kind], list = K.list(), worn = K.worn();
  dkPut(d.rail, SHELF_KEYS.map(k => railBtn(kind === k, SHELVES[k].name, null, () => { shelfClose(); if (shop) shopSel = k; else gearSel = k; paintHome(); })));
  const close = () => { SND.tap(); shelfClose(); paintHome(); };
  const has = i => net.owns(kind, list[i].id);
  if (shelfOpen == null || !list[shelfOpen]) {
    // the cards
    shelfOpen = null; d.stage.dataset.win = '0';
    dkPut(d.head, dkTitle(shop ? `${K.name} 진열대` : `내 ${K.name}`, `${list.length}개${worn >= 0 ? ' · 장착: ' + list[worn].name : ''}`));
    // the cards from the commonest to the rarest, an ivory rule where the rarity changes saying what it is and how many
    // of it are owned; 내 장비 shows only what is owned, the shop everything with its price
    const order = list.map((q, i) => [q, i]).filter(([, i]) => shop || has(i)).sort((p, q) => (p[0].rarity || 0) - (q[0].rarity || 0) || p[1] - q[1]), cards = [];
    for (let n = 0; n < order.length; n++) {
      const [q, i] = order[n], r = q.rarity || 0;
      if (!n || (order[n - 1][0].rarity || 0) !== r) { const of = list.map((x, k) => k).filter(k => (list[k].rarity || 0) === r);
        cards.push(el('div', { class: 'dk-tier r' + r }, [el('span', { text: `${RARITY[r][0]} (${of.filter(has).length}/${of.length})` })])); }
      cards.push(el('button', { class: 'dk-card r' + r + (i === worn ? ' worn' : ''), 'aria-label': q.name, onclick: onTap(() => { shelfOpen = i; paintHome(); }) },
        [i === worn ? el('span', { class: 'wtag', text: '장착' }) : null, K.stats ? el('span', { class: 'ovr', text: K.stats(q).ovr }) : null, traitMarks(q, true), fxBadges(q, true), K.pic(q), el('span', { class: 'nm', text: q.name }), shop ? el('span', { class: 'price', text: has(i) ? '보유' : priceText(q) }) : null]));
    }
    dkPut(d.stage, el('div', { class: 'dk-cards k-' + kind }, cards));
    dkPut(d.slate, dkH1(shop ? '상점' : '내 장비', `${K.name} · ${list.length}개`));
    dkPut(d.slate, [dkHr(), dkTxt(shop ? (net.on ? '코인과 다이아로 삽니다. 산 것은 내 장비에 들어갑니다.' : '서버가 열리면 코인과 다이아로 살 수 있습니다.') : '카드를 누르면 크게 보고 미리 볼 수 있습니다.'),
      dkHr(), dkTxt('현재 장착: ', worn >= 0 ? list[worn].name : '없음'), dkHr(), dkTxt(kind === 'cue' ? '큐마다 최대 파워·회전·조준선이 조금씩 다릅니다(±12% 안).' : kind === 'glove' ? '장갑마다 세기와 다이얼이 움직이는 단위가 다릅니다.' : '플레이 성능은 모두 같습니다.')]);
    dkPut(d.slate, dkActs(shop ? dkSec('내 장비로', () => deskGo('gear')) : null));
    return;
  }
  // one card, opened
  const i = shelfOpen, q = list[i], own = i === worn;
  d.head.className = 'dk-head open';
  dkPut(d.head, [el('button', { class: 'dk-x', 'aria-label': '카드 목록으로', onclick: close }, el('i')), dkTitle(q.name, `${i + 1} / ${list.length}`)]);
  K.show(q, d.stage, i);
  dkPut(d.slate, dkH1(q.name, K.name));
  const about = K.about(q);
  dkPut(d.slate, [dkHr(), el('div', { class: 'dk-spec' }, [el('span', { text: '희귀도' }), el('b', { class: 'rar r' + (q.rarity || 0), text: RARITY[q.rarity || 0][0] })]), fxMarks(q).length ? el('div', { class: 'dk-spec fx' }, [el('span', { text: '효과' }), fxBadges(q)]) : null, dkHr()]);
  // how it plays, first (it is what is looked for): OVR, then each number as a bar set against what is worn now
  if (K.stats) {
    const S = K.stats(q);
    dkPut(d.slate, [el('div', { class: 'dk-ovr' }, [el('span', { text: 'OVR' }), el('b', { text: S.ovr }), el('em', { class: S.ovrD ? (S.ovrD[0] === '+' ? 'up' : 'down') : '', text: S.ovrD }),
      el('small', { text: i === worn ? '장착 중' : '장착한 것과 비교' })])]);
    dkPut(d.slate, traitMarks(q));
    for (const r of S.rows) dkPut(d.slate, statRow(r));
    dkPut(d.slate, dkHr());
  }
  for (const a of about) dkPut(d.slate, typeof a === 'string' ? [dkTxt(a), dkHr()] : el('div', { class: 'dk-spec' }, [el('span', { text: a[0] }), el('b', { text: a[1] })]));
  if (kind === 'table' && !isCarom()) dkPut(d.slate, [dkHr(), dkLab('포켓볼 테이블 크기'), dkSeg(TABLES.map(t => [t.id, t.short]), prefs.table, v => { prefs.table = v; repaintLive(); })]);
  if (shop) {
    const buy = async () => { const r = await net.buy(kind, q.id); toast(r.ok ? `${q.name} 샀습니다. 내 장비에서 장착하세요.` : r.why, r.ok ? 'good' : 'foul', 2400); paintHome(); };
    dkPut(d.slate, dkActs(has(i) ? dkMain('보유 중', null, () => {}, true) : q.reward ? dkMain('레슨 보상', `${MODE_KO[q.reward]} 레슨을 모두 끝내면`, () => {}, true) : net.on ? dkMain('구매', priceText(q), buy) : dkMain('구매', '서버가 열리면', () => {}, true), dkSec('카드 목록으로', close)));
  }
  else dkPut(d.slate, dkActs(dkMain(own ? '장착 중' : '장착', null, () => { const msg = K.wear(q, i); savePrefs(); shelfOpen = null; paintHome(); toast(msg); }, own), dkSec('카드 목록으로', close)));
}
// SFX (its own sound) and VFX (effects of light beyond its look) under the rarity (content/00-rarity.js)
const fxMarks = q => [q.sound ? ['sfx', 'SFX'] : null, q.vfx ? ['vfx', 'VFX'] : null].filter(Boolean);
// (the shimmer runs only while a badge is on screen: each moving frame repaints it, and a long list has many - fxSeen)
const fxSeen = typeof IntersectionObserver === 'function' ? new IntersectionObserver(es => { for (const e of es) { e.target.classList.toggle('live', e.isIntersecting); if (!e.target.isConnected) fxSeen.unobserve(e.target); } }) : null;
const fxBadge = (k, t) => { const b = el('span', { class: 'fxb ' + k + (fxSeen ? '' : ' live') }, [el('i'), el('b', { text: t })]); if (fxSeen) fxSeen.observe(b); return b; };
const fxBadges = (q, small) => { const m = fxMarks(q); return m.length ? el('span', { class: 'fxbs' + (small ? ' sm' : '') }, m.map(([k, t]) => fxBadge(k, t))) : null; };
// a cue's traits (content/20-cues.js TRAITS) under its OVR: on the card the mark alone, opened the mark, its name and
// what it does
const traitMarks = (q, small) => {
  const ts = (q.traits || []).filter(t => TRAITS[t]);
  if (!ts.length) return null;
  if (small) return el('span', { class: 'trts' }, ts.map(t => el('i', { class: 'trt t-' + t, title: TRAITS[t].name })));
  return el('div', { class: 'dk-traits' }, ts.map(t => el('div', { class: 'dk-trait' }, [el('i', { class: 'trt t-' + t }), el('b', { text: TRAITS[t].name }), el('small', { text: TRAITS[t].say })])));
};
// what a thing costs (economy.js: by its rarity)
const priceText = q => { if (q.reward) return '레슨 보상'; const p = priceOf(q); return p.dia ? `${p.dia.toLocaleString('ko-KR')} 다이아` : p.coin ? `${p.coin.toLocaleString('ko-KR')} 코인` : '기본'; };
const deskGear = d => shelfPage(d, false);
const deskShop = d => shelfPage(d, true);
