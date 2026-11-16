/* 컴퓨터 대전's bots (owner 11-16, after chess.com's 봇과 플레이): the computer as people to pick - from many countries, each
   a name, a flag, a rating, a way of playing, a line it lives by (in its own language, with the Korean under it) and a line
   about who it is. Each plays as a person-like player (ai/51-people.js: personality for its manners and pace, style for the
   shots it likes, the rating for how well it plays).
   On the desk (owner 11-16): the bots are cards in the tray, each of its tier's metal; the one picked is told of on the
   slate - its picture, its name with its flag, its tier and rating, what it says, how it plays.
   Grouped by how strong; the first two open, each one after opens when the one before it is beaten (prefs.botBeat), or when
   the player's own rating has reached it.

   A bot's picture: ui/bot-<id>.webp once it is drawn (HANDOFF.md 이미지 에셋) and pic: true on its line; until then its
   initial on its tier's metal. Its country: a code of BOT_FLAGS. lang: the language of its line (lang= on the text, and
   the language it will speak at the table); ko: the line in Korean, when the line is not.
   To add one: a line here (an id is never used again - prefs.botBeat keeps it). */
const BOT_GROUPS = [['first', '입문'], ['club', '동호회'], ['master', '고수'], ['pro', '프로']];
const BOTS = [
  { id: 'haneul', name: '하늘', from: 'kr', lang: 'ko', rating: 300, group: 'first', personality: 'playful', style: 'natural',
    line: '공이 어디로 갈지 모르니까 재밌는 거잖아요!', bio: '당구장 아르바이트 3주째. 손님 없을 때 몰래 친다.' },
  { id: 'marco', name: '마르코', from: 'it', lang: 'it', rating: 450, group: 'first', personality: 'nervous', style: 'balanced',
    line: 'Piano piano si va lontano.', ko: '천천히 가야 멀리 가요.', bio: '나폴리에서 온 요리 유학생. 큐를 잡으면 손이 떨린다.' },
  { id: 'yuki', name: '유키', from: 'jp', lang: 'ja', rating: 600, group: 'first', personality: 'calm', style: 'follow',
    line: '一球一球、心を込めて。', ko: '한 공 한 공, 마음을 담아서.', bio: '도쿄 동네 당구장 사장님 딸. 매일 밀어치기만 연습한다.' },
  { id: 'carlos', name: '카를로스', from: 'co', lang: 'es', rating: 750, group: 'first', personality: 'impatient', style: 'power',
    line: '¡Si no entra, que por lo menos suene!', ko: '안 들어가면 소리라도 크게 나야지!', bio: '메데인의 오토바이 정비공. 힘 조절은 아직 공부 중.' },
  { id: 'linh', name: '린', from: 'vn', lang: 'vi', rating: 850, group: 'club', personality: 'fidgety', style: 'spinner',
    line: 'Đường thẳng thì ai cũng đi được.', ko: '곧은 길은 누구나 갈 수 있죠.', bio: '하노이의 대학생. 회전 거는 게 제일 신난다.' },
  { id: 'taeo', name: '태오', from: 'kr', lang: 'ko', rating: 1000, group: 'club', personality: 'meticulous', style: 'defensive',
    line: '쉬운 공은 남기지 않습니다. 그게 예의니까요.', bio: '회계사. 경기 기록을 수첩에 전부 적어 둔다.' },
  { id: 'emre', name: '엠레', from: 'tr', lang: 'tr', rating: 1150, group: 'club', personality: 'calm', style: 'gather',
    line: 'Toplar bir araya gelirse oyun kendiliğinden akar.', ko: '공이 모이면 경기는 저절로 흘러가요.', bio: '이스탄불 찻집 겸 당구장 주인. 차 한 잔 마시고 친다.' },
  { id: 'willem', name: '빌럼', from: 'nl', lang: 'nl', rating: 1300, group: 'club', personality: 'impatient', style: 'banker',
    line: 'Via de band is altijd korter.', ko: '쿠션을 돌아가는 게 언제나 더 빨라.', bio: '로테르담 항구의 크레인 기사. 쿠션 계산은 머릿속에서 끝낸다.' },
  { id: 'ana', name: '아나', from: 'es', lang: 'es', rating: 1450, group: 'master', personality: 'meticulous', style: 'position',
    line: 'La bola de hoy prepara la de mañana.', ko: '지금 치는 공이 다음 공을 준비해요.', bio: '발렌시아의 건축가. 당구대를 도면처럼 본다.' },
  { id: 'lea', name: '레아', from: 'fr', lang: 'fr', rating: 1600, group: 'master', personality: 'playful', style: 'masse',
    line: 'Le billard, c’est de la géométrie qui danse.', ko: '당구는 춤추는 기하학이에요.', bio: '파리 서커스 곡예사 출신. 큐를 세우는 걸 좋아한다.' },
  { id: 'jose', name: '호세', from: 'ph', lang: 'tl', rating: 1750, group: 'master', personality: 'calm', style: 'draw',
    line: 'Huwag magmadali. Marunong maghintay ang bola.', ko: '서두르지 마요. 공은 기다릴 줄 알아요.', bio: '마닐라 거리 당구에서 자랐다. 끌어치기 하나로 이름을 알렸다.' },
  { id: 'hangyeol', name: '한결', from: 'kr', lang: 'ko', rating: 1900, group: 'master', personality: 'meticulous', style: 'defensive',
    line: '급할수록 돌아가라. 당구대 위에서는 더 그렇습니다.', bio: '35년째 동네 당구장 관장. 말이 적다.' },
  { id: 'frederic', name: '프레데릭', from: 'be', lang: 'fr', rating: 2000, group: 'pro', personality: 'calm', style: 'position',
    line: 'Trois bandes, une seule pensée : la suivante.', ko: '쓰리쿠션, 생각은 하나뿐. 다음 공.', bio: '벨기에 쓰리쿠션 리그 출신. 표정이 변하지 않는다.' },
  { id: 'jack', name: '잭', from: 'gb', lang: 'en', rating: 2100, group: 'pro', personality: 'impatient', style: 'showman',
    line: 'If you’re going to miss, miss beautifully.', ko: '놓칠 거면 멋지게 놓쳐.', bio: '런던 펍의 스누커 스타. 보는 사람이 있어야 잘 친다.' },
  { id: 'max', name: '막스', from: 'de', lang: 'de', rating: 2200, group: 'pro', personality: 'meticulous', style: 'banker',
    line: 'Präzision ist keine Kunst, sondern Gewohnheit.', ko: '정확함은 재능이 아니라 습관이에요.', bio: '뮌헨의 시계 기술자. 빗나간 각도를 0.1도까지 기억한다.' },
];
/* The flags, drawn here (60 × 40) so they look the same on every device - a phone's emoji flags are letters on some. */
const BOT_FLAGS = (() => {
  const bars = (dir, cols, w) => cols.map((c, i) => dir === 'v' ? `<rect x="${i * 60 / cols.length}" width="${60 / cols.length + 0.2}" height="40" fill="${c}"/>`
    : `<rect y="${(w ? w.slice(0, i).reduce((a, b) => a + b, 0) : i * 40 / cols.length)}" width="60" height="${(w ? w[i] : 40 / cols.length) + 0.2}" fill="${c}"/>`).join('');
  const star = (cx, cy, R, fill, rot = 0) => `<polygon fill="${fill}" points="${Array.from({ length: 10 }, (_, k) => { const r = k % 2 ? R * 0.382 : R, a = (rot - 90 + k * 36) * Math.PI / 180; return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`; }).join(' ')}"/>`;
  // 태극기: the taegeuk tilted along the diagonal, and the four trigrams at the corners (건 곤 감 리)
  const tri = (ang, pat) => `<g transform="translate(30 20) rotate(${ang}) translate(0 -14.5)">${pat.map((solid, i) => solid ? `<rect x="-4.5" y="${i * 2.6 - 3.3}" width="9" height="1.6"/>`
    : `<rect x="-4.5" y="${i * 2.6 - 3.3}" width="4" height="1.6"/><rect x="0.5" y="${i * 2.6 - 3.3}" width="4" height="1.6"/>`).join('')}</g>`;
  const F = {
    kr: `<rect width="60" height="40" fill="#fff"/><g transform="rotate(33.7 30 20)"><circle cx="30" cy="20" r="9" fill="#0047a0"/><path d="M21 20a9 9 0 0 1 18 0a4.5 4.5 0 0 1-9 0a4.5 4.5 0 0 0-9 0z" fill="#cd2e3a"/></g><g fill="#000">${tri(-56.3, [1, 1, 1])}${tri(123.7, [0, 0, 0])}${tri(56.3, [0, 1, 0])}${tri(-123.7, [1, 0, 1])}</g>`,
    it: bars('v', ['#009246', '#fff', '#ce2b37']),
    fr: bars('v', ['#002395', '#fff', '#ed2939']),
    be: bars('v', ['#000', '#fdda24', '#ef3340']),
    de: bars('h', ['#000', '#dd0000', '#ffce00']),
    nl: bars('h', ['#ae1c28', '#fff', '#21468b']),
    co: bars('h', ['#fcd116', '#003893', '#ce1126'], [20, 10, 10]),
    es: bars('h', ['#aa151b', '#f1bf00', '#aa151b'], [10, 20, 10]),
    jp: `<rect width="60" height="40" fill="#fff"/><circle cx="30" cy="20" r="12" fill="#bc002d"/>`,
    vn: `<rect width="60" height="40" fill="#da251d"/>${star(30, 20, 11, '#ffff00')}`,
    tr: `<rect width="60" height="40" fill="#e30a17"/><circle cx="22" cy="20" r="10" fill="#fff"/><circle cx="24.5" cy="20" r="8" fill="#e30a17"/>${star(34.5, 20, 4.2, '#fff', -90)}`,
    ph: `<rect width="60" height="20" fill="#0038a8"/><rect y="20" width="60" height="20" fill="#ce1126"/><polygon points="0,0 34.6,20 0,40" fill="#fff"/><circle cx="11.5" cy="20" r="4.5" fill="#fcd116"/>`,
    gb: `<rect width="60" height="40" fill="#012169"/><path d="M0 0L60 40M60 0L0 40" stroke="#fff" stroke-width="8"/><path d="M0 0L60 40M60 0L0 40" stroke="#c8102e" stroke-width="2.6"/><path d="M30 0v40M0 20h60" stroke="#fff" stroke-width="12"/><path d="M30 0v40M0 20h60" stroke="#c8102e" stroke-width="7"/>`,
  };
  const out = {}; for (const k in F) out[k] = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40">${F[k]}</svg>`);
  return out;
})();
const BOT_COUNTRY = { kr: '대한민국', it: '이탈리아', jp: '일본', co: '콜롬비아', vn: '베트남', tr: '튀르키예', nl: '네덜란드', es: '스페인', fr: '프랑스', ph: '필리핀', be: '벨기에', gb: '영국', de: '독일' };
const botFlag = b => el('img', { class: 'flag', src: BOT_FLAGS[b.from], alt: BOT_COUNTRY[b.from] || '', title: BOT_COUNTRY[b.from] || '' });
const botById = id => BOTS.find(b => b.id === id);
const botTier = b => TIERS[Math.min(TIERS.length - 1, tierOf(b.rating))];
// open: the first two, one whose bot before it is beaten, or one at or under the player's own rating
function botOpen(b) {
  const i = BOTS.indexOf(b), mine = net.me && net.me.dama != null ? net.me.dama : 0;
  return i < 2 || !!(prefs.botBeat || {})[BOTS[i - 1].id] || b.rating <= mine;
}
const botNow = () => { const b = botById(prefs.bot); return b && botOpen(b) ? b : BOTS[0]; };
// the bot as the AI plays it: a person at its rating, of its personality and style (the same every game: drawn from its id)
function botPersona(b) {
  let h = 2166136261; for (const ch of b.id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const p = game.aiPersona ? game.aiPersona(b.rating, seededRandom(h), { personality: b.personality, style: b.style }) : null;
  return p ? Object.assign(p, { name: b.name, bot: b.id, lang: b.lang }) : null;
}
// its picture: drawn, or its initial on its tier's metal
function botPic(b, big) {
  const [tier] = botTier(b);
  return el('i', { class: `bot-pic t-${tier}${big ? ' big' : ''}`, 'aria-hidden': 'true', style: b.pic ? `background-image:url(ui/bot-${b.id}.webp)` : null }, b.pic ? null : el('b', { text: b.name[0] }));
}
// a game against a bot won: beaten, and the next opens (50-match.js finish)
function botBeaten(id) {
  if (!id || (prefs.botBeat || {})[id]) return;
  prefs.botBeat = Object.assign({}, prefs.botBeat, { [id]: true }); savePrefs();
  const next = BOTS[BOTS.findIndex(b => b.id === id) + 1];
  if (next) setTimeout(() => toast(`${next.name}에게 도전할 수 있습니다`, 'good', 2600), 1200);
}
/* The tray: each group a row of cards, a card of its tier's metal - its picture, name, flag and rating; the one picked
   lifted and ringed, a locked one veiled, a beaten one marked. The metal catches the light now and then (85-train.css). */
function botTray(stage) {
  stage.dataset.win = '0';
  const cur = botNow();
  const pick = b => () => {
    if (!botOpen(b)) { const i = BOTS.indexOf(b); return toast(`${BOTS[i - 1].name} 이기면 열림`, '', 2000); }
    if (prefs.bot === b.id) return; prefs.bot = b.id; savePrefs(); repaint();
  };
  let n = 0;
  dkPut(stage, el('div', { class: 'bot-tray' }, BOT_GROUPS.map(([g, name]) => {
    const L = BOTS.filter(b => b.group === g);
    return el('section', { class: 'bot-row' }, [el('h3', { text: name }),
      el('div', { class: 'bot-cards' }, L.map(b => {
        const [tier] = botTier(b), open = botOpen(b), beat = !!(prefs.botBeat || {})[b.id];
        return el('button', { class: `bot-card t-${tier}` + (open ? '' : ' lock') + (beat ? ' beat' : ''), style: `--i:${n++}`, 'aria-pressed': String(b === cur),
          'aria-label': `${b.name}, ${BOT_COUNTRY[b.from]}, ${b.rating}${open ? '' : ', 잠김'}`, onclick: onTap(pick(b)) }, [
          el('i', { class: 'sheen', 'aria-hidden': 'true' }), botPic(b),
          el('b', { class: 'nm', text: b.name }), el('span', { class: 'rt' }, [botFlag(b), document.createTextNode(String(b.rating))])]);
      }))]);
  })));
}
/* The slate: the bot picked - its picture, its name with its flag, its tier and rating; what it says (in its language, the
   Korean under it in grey); how it plays and who it is. */
function botInfo() {
  const b = botNow(), [, tierName] = botTier(b), me = botPersona(b), foreign = b.lang !== 'ko';
  return [el('div', { class: 'bot-cur' }, [botPic(b, true), el('div', { class: 'bot-id' }, [
      el('div', { class: 'bot-nm' }, [el('b', { text: b.name }), botFlag(b)]),
      el('span', { class: 'bot-rt' }, [el('em', { text: tierName }), document.createTextNode(String(b.rating))])])]),
    el('div', { class: 'bot-say' }, [el('p', { lang: b.lang, text: b.line }), foreign && b.ko ? el('small', { text: b.ko }) : null]),
    el('div', { class: 'bot-tags' }, [me ? el('span', { text: me.style.name }) : null, me ? el('span', { text: me.personality.name }) : null,
      (prefs.botBeat || {})[b.id] ? el('span', { class: 'won', text: '이긴 상대' }) : null]),
    el('p', { class: 'bot-bio', text: b.bio })];
}
