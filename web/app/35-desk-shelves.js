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
    ...ids.map((n, j) => el('img', { class: 'b', src: scene.ballPortrait(k.id, kind, n), alt: '', style: `top:${[23.6, 50, 76.4][j]}%` }))]);
}
const streak = (q, big) => el('i', { class: 'trl' + (big ? ' big' : '') + (q.color === 'rainbow' ? ' rb' : q.color ? '' : ' none'), style: q.color && q.color !== 'rainbow' ? `--c:${hx6(q.color)}` : '' });
const gloveImg = g => el('img', { class: 'glove', src: `ui/glove-${g.id}.webp`, alt: g.name, draggable: 'false' });
const clothPic = q => el('i', { class: 'clothcard', style: `--w:${hx6(q.wood)};background-color:${hx6(q.felt)};background-image:url(ui/cloth-${q.id}.webp)` });
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
    show: (c, stage) => { stage.dataset.win = '0'; dkPut(stage, [cueImg(c, 'cuebig'), el('div', { class: 'cuezoom' }, cueImg(c))]); },
    about: c => [c.note, ...(c.spec || [])], stats: c => cueStats(c, CUES[prefs.cues[0]]), wear: (c, i) => { prefs.cues[0] = i; prefs.cue = i; if (!prefs.vsAI && prefs.cues[1] === undefined) prefs.cues[1] = i; useCue(i); return `${c.name}를 들었습니다.`; } },
  ball: { name: '공', list: () => BALLSKINS, worn: () => Math.max(0, BALLSKINS.findIndex(b => b.id === prefs.ballSkin)), pic: ballCase,
    show: k => useBalls(k.id), about: k => [k.note, ['소재', '페놀 수지'], ['지름', isCarom() ? (prefs.mode === 'three' ? '61.5mm' : '65.5mm') : '57.2mm']],
    wear: k => { prefs.ballSkin = k.id; return `${k.name} 공을 꺼냈습니다.`; }, undo: () => useBalls(prefs.ballSkin) },
  table: { name: '테이블', list: () => CLOTHS, worn: () => prefs.cloth, pic: clothPic, show: (c, stage, i) => scene.setCloth(i),
    about: c => [c.ice ? '빙판: 공이 미끄러져 오래 구르고 회전이 잘 먹지 않습니다. 대결에만 적용됩니다.' : '천 색은 보기만 다르고 공은 똑같이 구릅니다.', ['천', c.ice ? '얼음' : '워스티드 울'], ['나무', c.grain === 'walnut' ? '월넛' : c.grain === 'mahogany' ? '마호가니' : '도장 마감']],
    wear: (c, i) => { prefs.cloth = i; homePreview(); return `${c.name} 테이블로 바꿨습니다.`; }, undo: () => dress(iceOn()) },
  trail: { name: '트레일', list: () => TRAILS, worn: () => Math.max(0, TRAILS.findIndex(t => t.id === prefs.trail)), pic: q => streak(q),
    show: (q, stage) => { scene.setTrail(q.id); stage.dataset.win = '0'; dkPut(stage, el('div', { class: 'bigpic' }, streak(q, true))); },
    about: q => [q.note, '큐볼이 구르는 동안 뒤로 짧게 남고 곧 사라집니다. 경기에는 영향이 없습니다.'],
    wear: q => { prefs.trail = q.id; return `트레일: ${q.name}`; }, undo: () => scene.setTrail(prefs.trail) },
  glove: { name: '장갑', list: () => GLOVES, worn: () => GLOVES.findIndex(g => g.id === prefs.glove), pic: gloveImg,
    show: (g, stage) => { stage.dataset.win = '0'; dkPut(stage, el('div', { class: 'bigpic' }, gloveImg(g))); },
    about: () => ['브리지 손에 끼는 세 손가락 장갑. 큐가 손가락 사이로 매끄럽게 미끄러집니다. 좋은 장갑일수록 세기와 미세 조준 다이얼이 더 잘게 움직입니다(손가락 움직임은 같습니다).', ...GLOVE_SPEC],
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
        [i === worn ? el('span', { class: 'wtag', text: '장착' }) : null, K.stats ? el('span', { class: 'ovr', text: K.stats(q).ovr }) : null, K.pic(q), el('span', { class: 'nm', text: q.name }), shop ? el('span', { class: 'price', text: has(i) ? '보유' : priceText(q) }) : null]));
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
  dkPut(d.slate, [dkHr(), el('div', { class: 'dk-spec' }, [el('span', { text: '희귀도' }), el('b', { class: 'rar r' + (q.rarity || 0), text: RARITY[q.rarity || 0][0] })]), dkHr()]);
  // how it plays, first (it is what is looked for): OVR, then each number as a bar set against what is worn now
  if (K.stats) {
    const S = K.stats(q);
    dkPut(d.slate, [el('div', { class: 'dk-ovr' }, [el('span', { text: 'OVR' }), el('b', { text: S.ovr }), el('em', { class: S.ovrD ? (S.ovrD[0] === '+' ? 'up' : 'down') : '', text: S.ovrD }),
      el('small', { text: i === worn ? '장착 중' : '장착한 것과 비교' })])]);
    for (const r of S.rows) dkPut(d.slate, statRow(r));
    dkPut(d.slate, dkHr());
  }
  for (const a of about) dkPut(d.slate, typeof a === 'string' ? [dkTxt(a), dkHr()] : el('div', { class: 'dk-spec' }, [el('span', { text: a[0] }), el('b', { text: a[1] })]));
  if (kind === 'table' && !isCarom()) dkPut(d.slate, [dkHr(), dkLab('포켓볼 테이블 크기'), dkSeg(TABLES.map(t => [t.id, t.short]), prefs.table, v => { prefs.table = v; repaintLive(); })]);
  if (shop) {
    const buy = async () => { const r = await net.buy(kind, q.id); toast(r.ok ? `${q.name} 샀습니다. 내 장비에서 장착하세요.` : r.why, r.ok ? 'good' : 'foul', 2400); paintHome(); };
    dkPut(d.slate, dkActs(has(i) ? dkMain('보유 중', null, () => {}, true) : net.on ? dkMain('구매', priceText(q), buy) : dkMain('구매', '서버가 열리면', () => {}, true), dkSec('카드 목록으로', close)));
  }
  else dkPut(d.slate, dkActs(dkMain(own ? '장착 중' : '장착', null, () => { const msg = K.wear(q, i); savePrefs(); shelfOpen = null; paintHome(); toast(msg); }, own), dkSec('카드 목록으로', close)));
}
// what a thing costs (economy.js: by its rarity)
const priceText = q => { const p = priceOf(q); return p.dia ? `${p.dia.toLocaleString('ko-KR')} 다이아` : p.coin ? `${p.coin.toLocaleString('ko-KR')} 코인` : '기본'; };
const deskGear = d => shelfPage(d, false);
const deskShop = d => shelfPage(d, true);
