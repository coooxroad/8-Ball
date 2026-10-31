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
const SHELVES = {
  cue: { name: '큐', list: () => CUES, worn: () => prefs.cues[0], pic: c => el('i', { class: 'cuecard' }, cueImg(c)),
    show: (c, stage) => { stage.dataset.win = '0'; dkPut(stage, [cueImg(c, 'cuebig'), el('div', { class: 'cuezoom' }, cueImg(c))]); },
    about: c => [c.note, ...(c.spec || [])], wear: (c, i) => { prefs.cues[0] = i; prefs.cue = i; if (!prefs.vsAI && prefs.cues[1] === undefined) prefs.cues[1] = i; useCue(i); return `${c.name}를 들었습니다.`; } },
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
    about: () => ['브리지 손에 끼는 세 손가락 장갑. 큐가 손가락 사이로 매끄럽게 미끄러집니다.', ...GLOVE_SPEC],
    wear: g => { prefs.glove = g.id; return `${g.name} 장갑을 꼈습니다.`; } },
};
const SHELF_KEYS = ['cue', 'ball', 'table', 'trail', 'glove'];
function shelfClose() { const k = SHELVES[deskTab === 'shop' ? shopSel : gearSel]; if (shelfOpen != null && k && k.undo) k.undo(); shelfOpen = null; }
function gearOff() { shelfClose(); }                                  // (also called on leaving the place)
function shelfPage(d, shop) {
  const kind = shop ? shopSel : gearSel, K = SHELVES[kind], list = K.list(), worn = K.worn();
  dkPut(d.rail, SHELF_KEYS.map(k => railBtn(kind === k, SHELVES[k].name, null, () => { shelfClose(); if (shop) shopSel = k; else gearSel = k; paintHome(); })));
  const close = () => { SND.tap(); shelfClose(); paintHome(); };
  if (shelfOpen == null || !list[shelfOpen]) {
    // the cards
    shelfOpen = null; d.stage.dataset.win = '0';
    dkPut(d.head, dkTitle(shop ? `${K.name} 진열대` : `내 ${K.name}`, `${list.length}개${worn >= 0 ? ' · 장착: ' + list[worn].name : ''}`));
    // the cards from the commonest to the rarest, an ivory rule where the rarity changes saying what it is and how many
    // of it are owned (everything is owned until the shop opens)
    const order = list.map((q, i) => [q, i]).sort((p, q) => (p[0].rarity || 0) - (q[0].rarity || 0) || p[1] - q[1]), cards = [];
    for (let n = 0; n < order.length; n++) {
      const [q, i] = order[n], r = q.rarity || 0;
      if (!n || (order[n - 1][0].rarity || 0) !== r) { const all = order.filter(x => (x[0].rarity || 0) === r).length;
        cards.push(el('div', { class: 'dk-tier r' + r }, [el('span', { text: `${RARITY[r][0]} (${all}/${all})` })])); }
      cards.push(el('button', { class: 'dk-card r' + r + (i === worn ? ' worn' : ''), 'aria-label': q.name, onclick: onTap(() => { shelfOpen = i; paintHome(); }) },
        [i === worn ? el('span', { class: 'wtag', text: '장착' }) : null, K.pic(q), el('span', { class: 'nm', text: q.name }), shop ? el('span', { class: 'price', text: '곧 판매' }) : null]));
    }
    dkPut(d.stage, el('div', { class: 'dk-cards k-' + kind }, cards));
    dkPut(d.slate, dkH1(shop ? '상점' : '내 장비', `${K.name} · ${list.length}개`));
    dkPut(d.slate, [dkHr(), dkTxt(shop ? '큐, 공, 테이블, 트레일, 장갑을 코인과 다이아로 살 수 있게 됩니다. 지금은 구경만 할 수 있습니다.' : '카드를 누르면 크게 보고 미리 볼 수 있습니다.'),
      dkHr(), dkTxt('현재 장착: ', worn >= 0 ? list[worn].name : '없음'), dkHr(), dkTxt('플레이 성능은 모두 같습니다.')]);
    dkPut(d.slate, dkActs(shop ? dkMain('준비 중', null, () => {}, true) : null, shop ? dkSec('내 장비로', () => deskGo('gear')) : null));
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
  for (const a of about) dkPut(d.slate, typeof a === 'string' ? [dkTxt(a), dkHr()] : el('div', { class: 'dk-spec' }, [el('span', { text: a[0] }), el('b', { text: a[1] })]));
  if (kind === 'table' && !isCarom()) dkPut(d.slate, [dkHr(), dkLab('포켓볼 테이블 크기'), dkSeg(TABLES.map(t => [t.id, t.short]), prefs.table, v => { prefs.table = v; repaintLive(); })]);
  if (shop) dkPut(d.slate, dkActs(dkMain('구매', '상점이 열리면', () => {}, true), dkSec('카드 목록으로', close)));
  else dkPut(d.slate, dkActs(dkMain(own ? '장착 중' : '장착', null, () => { const msg = K.wear(q, i); savePrefs(); shelfOpen = null; paintHome(); toast(msg); }, own), dkSec('카드 목록으로', close)));
}
const deskGear = d => shelfPage(d, false);
const deskShop = d => shelfPage(d, true);
