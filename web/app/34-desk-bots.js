/* 컴퓨터 대전's bots (owner 11-16, after chess.com's 봇과 플레이): the computer as people to pick, each a name, a rating, a
   way of playing and a line it says when picked - a person-like player (ai/51-people.js: personality for its manners and
   pace, style for the shots it likes, the rating for how well it plays). Grouped by how strong; the first two open, each
   one after opens when the one before it is beaten (prefs.botBeat), or when the player's own rating has reached it.

   A bot's picture: ui/bot-<id>.webp once it is drawn (HANDOFF.md 이미지 에셋) and pic: true on its line; until then its
   initial on its tier's metal.
   To add one: a line here (an id is never used again - prefs.botBeat keeps it). */
const BOT_GROUPS = [['first', '입문'], ['club', '동호회'], ['master', '고수'], ['pro', '프로']];
const BOTS = [
  { id: 'haneul', name: '하늘', rating: 300, group: 'first', personality: 'playful', style: 'natural', line: '맞히기만 하면 되는 거죠?' },
  { id: 'doyun', name: '도윤', rating: 450, group: 'first', personality: 'nervous', style: 'balanced', line: '살살 칠게요.' },
  { id: 'miso', name: '미소', rating: 600, group: 'first', personality: 'calm', style: 'follow', line: '밀어치기 하나는 자신 있어요.' },
  { id: 'gangcheol', name: '강철', rating: 750, group: 'first', personality: 'impatient', style: 'power', line: '세게 치면 어떻게든 들어가!' },
  { id: 'eunbi', name: '은비', rating: 850, group: 'club', personality: 'fidgety', style: 'spinner', line: '회전 좀 걸어 볼까요.' },
  { id: 'taeo', name: '태오', rating: 1000, group: 'club', personality: 'meticulous', style: 'defensive', line: '쉬운 공은 안 남겨요.' },
  { id: 'narae', name: '나래', rating: 1150, group: 'club', personality: 'calm', style: 'gather', line: '공은 모아 두는 게 편하죠.' },
  { id: 'beomsu', name: '범수', rating: 1300, group: 'club', personality: 'impatient', style: 'banker', line: '쿠션이면 다 돌아 들어와.' },
  { id: 'jian', name: '지안', rating: 1450, group: 'master', personality: 'meticulous', style: 'position', line: '다음 공까지 보고 칩니다.' },
  { id: 'woojin', name: '우진', rating: 1600, group: 'master', personality: 'playful', style: 'masse', line: '큐 세우는 거 구경하실래요?' },
  { id: 'soyul', name: '소율', rating: 1750, group: 'master', personality: 'calm', style: 'draw', line: '끌어서 자리 잡을게요.' },
  { id: 'hangyeol', name: '한결', rating: 1900, group: 'master', personality: 'meticulous', style: 'defensive', line: '서두를 것 없습니다.' },
  { id: 'baekho', name: '백호', rating: 2000, group: 'pro', personality: 'impatient', style: 'showman', line: '보는 재미가 있어야지.' },
  { id: 'eunha', name: '은하', rating: 2100, group: 'pro', personality: 'calm', style: 'banker', line: '길은 늘 하나 더 있어요.' },
  { id: 'seoha', name: '서하', rating: 2200, group: 'pro', personality: 'meticulous', style: 'position', line: '한 번 잡으면 끝까지 칩니다.' },
];
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
  return p ? Object.assign(p, { name: b.name, bot: b.id }) : null;
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
/* The slate's picker: the bot picked, big - its picture, name and rating, the line it says - then each group's pictures in a
   grid (a locked one dimmed with a lock, saying when it opens). */
function botPicker() {
  const cur = botNow(), [, tierName] = botTier(cur);
  const pick = b => () => {
    if (!botOpen(b)) { const i = BOTS.indexOf(b); return toast(`${BOTS[i - 1].name} 이기면 열림`, '', 2000); }
    if (prefs.bot === b.id) return; prefs.bot = b.id; savePrefs(); repaint();
  };
  const head = el('div', { class: 'bot-cur' }, [botPic(cur, true), el('div', { class: 'bot-id' }, [el('b', { text: cur.name }),
    el('span', { class: 'bot-rt' }, [el('em', { text: tierName }), document.createTextNode(String(cur.rating))]),
    el('small', { text: cur.line })])]);
  const groups = BOT_GROUPS.map(([g, name]) => {
    const L = BOTS.filter(b => b.group === g);
    return el('div', { class: 'bot-group' }, [el('div', { class: 'dk-lab', text: `${name} · ${L.length}명` }),
      el('div', { class: 'bot-grid' }, L.map(b => el('button', { class: 'bot-cell' + (botOpen(b) ? '' : ' lock') + (prefs.botBeat && prefs.botBeat[b.id] ? ' beat' : ''), 'aria-pressed': String(b === cur),
        'aria-label': `${b.name} ${b.rating}${botOpen(b) ? '' : ', 잠김'}`, onclick: onTap(pick(b)) }, [botPic(b), el('span', { text: b.name })])))]);
  });
  return [head, ...groups];
}
