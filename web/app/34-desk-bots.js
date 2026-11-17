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
// (owner 11-17: one more for each tier - 21; more women than men but not a dating game: the men in 다이아 and 프로; two
// Koreans only. Each group is a tier of the ranked ladder: TIERS, 33-desk-play.js)
const BOTS = [
  { id: 'daeun', name: '다은', from: 'kr', lang: 'ko', rating: 300, personality: 'nervous', style: 'natural', was: 'haneul',
    line: '못 넣어도 괜찮아요. 오늘은 큐 잡는 법부터!', bio: '대학 당구 동아리 신입. 파란 속머리는 동아리 들어간 기념으로 했다.' },
  { id: 'marco', name: '마르코', from: 'it', lang: 'it', rating: 450, personality: 'nervous', style: 'balanced', pic: true,
    line: 'Piano piano si va lontano.', ko: '천천히 가야 멀리 가요.', bio: '나폴리에서 온 요리 유학생. 큐를 잡으면 손이 떨린다.' },
  { id: 'yuki', name: '유키', from: 'jp', lang: 'ja', rating: 600, personality: 'calm', style: 'follow', pic: true,
    line: '一球一球、心を込めて。', ko: '한 공 한 공, 마음을 담아서.', bio: '도쿄 동네 당구장 사장님 딸. 매일 밀어치기만 연습한다.' },
  { id: 'luiza', name: '루이자', from: 'br', lang: 'pt', rating: 780, personality: 'playful', style: 'follow',
    line: 'Devagar, no ritmo da bossa nova.', ko: '천천히, 보사노바 리듬으로.', bio: '리우 해변 바에서 보사노바를 부른다. 공연 쉬는 시간마다 당구대 앞에 와 있다.' },
  { id: 'ploy', name: '플로이', from: 'th', lang: 'th', rating: 820, personality: 'playful', style: 'follow', pic: true,
    line: 'สนุกไว้ก่อน แล้วลูกจะลงเอง', ko: '일단 즐기면, 공은 알아서 들어가.', bio: '방콕의 디저트 카페 사장. 분홍 머리는 가게 마카롱 색.' },
  { id: 'sofia', name: '소피아', from: 'gr', lang: 'el', rating: 980, personality: 'calm', style: 'balanced', pic: true,
    line: 'Η θάλασσα δεν βιάζεται ποτέ.', ko: '바다는 절대 서두르지 않아.', bio: '아테네의 해양생물학자. 파도 소리를 들으며 연습한다.' },
  { id: 'sean', name: '숀', from: 'ie', lang: 'en', rating: 1050, personality: 'calm', style: 'defensive', pic: true,
    line: 'The man who leaves nothing wins the night.', ko: '아무것도 안 남기는 사람이 그날 밤을 이기지.', bio: '더블린 펍의 단골. 상대에게 쉬운 공을 남긴 적이 없다.' },
  { id: 'meilin', name: '메이린', from: 'cn', lang: 'zh', rating: 1120, personality: 'calm', style: 'position', pic: true,
    line: '心静，球自然就稳了。', ko: '마음이 고요하면, 공도 저절로 안정돼요.', bio: '상하이의 고전무용 강사. 큐를 들면 춤추듯 움직인다.' },
  { id: 'emre', name: '엠레', from: 'tr', lang: 'tr', rating: 1180, personality: 'calm', style: 'gather', pic: true,
    line: 'Toplar bir araya gelirse oyun kendiliğinden akar.', ko: '공이 모이면 경기는 저절로 흘러가요.', bio: '이스탄불 찻집 겸 당구장 주인. 차 한 잔 마시고 친다.' },
  { id: 'darya', name: '다리야', from: 'ru', lang: 'ru', rating: 1250, personality: 'meticulous', style: 'banker', was: 'nour',
    line: 'Сила без точности - ничто.', ko: '정확하지 않은 힘은 아무것도 아니에요.', bio: '모스크바의 러시안 피라미드 챔피언. 공만 한 포켓에 넣던 손이라 쿠션 경로가 한 치도 안 틀린다.' },
  { id: 'femke', name: '펨케', from: 'nl', lang: 'nl', rating: 1350, personality: 'impatient', style: 'power', pic: true, was: 'willem',
    line: 'Via de band is altijd korter.', ko: '쿠션을 돌아가는 게 언제나 더 빨라.', bio: '로테르담 항구의 크레인 기사. 기다리는 걸 제일 싫어한다.' },
  { id: 'ana', name: '아나', from: 'es', lang: 'es', rating: 1450, personality: 'meticulous', style: 'position',
    line: 'El billar es como el flamenco: todo es compás.', ko: '당구는 플라멩코 같아요. 전부 박자예요.', bio: '세비야의 플라멩코 무용수. 다음 공까지 박자를 세며 자리를 만든다.' },
  { id: 'priya', name: '프리야', from: 'in', lang: 'hi', rating: 1550, personality: 'meticulous', style: 'defensive', pic: true,
    line: 'हर गेंद एक सवाल है, और हर शॉट उसका जवाब।', ko: '모든 공은 질문이고, 모든 샷은 그 대답이에요.', bio: '벵갈루루의 소프트웨어 엔지니어. 샷 전에 머릿속으로 시뮬레이션을 돌린다.' },
  { id: 'lea', name: '레아', from: 'fr', lang: 'fr', rating: 1650, personality: 'playful', style: 'masse', pic: true,
    line: 'Le billard, c’est de la géométrie qui danse.', ko: '당구는 춤추는 기하학이에요.', bio: '파리의 문학도. 공이 휘어 가는 걸 시처럼 좋아한다.' },
  { id: 'migo', name: '미고', from: 'ph', lang: 'tl', rating: 1750, personality: 'playful', style: 'draw', was: 'jose',
    line: 'Mas matangkad pa sa akin ang tako ko. Pero ako ang panalo!', ko: '큐가 나보다 커요. 그래도 이기는 건 나예요!', bio: '세부의 열두 살 신동. 아빠 당구장에서 큐가 자기 키보다 클 때부터 쳤다.' },
  { id: 'ingrid', name: '잉그리드', from: 'se', lang: 'sv', rating: 1850, personality: 'playful', style: 'spinner', pic: true,
    line: 'Det enkla är det svåra.', ko: '쉬운 게 제일 어려운 거야.', bio: '스톡홀름의 엔지니어. 껌을 씹으며 표정 하나 안 바꾸고 회전을 건다.' },
  { id: 'ole', name: '올레', from: 'no', lang: 'no', rating: 1950, personality: 'calm', style: 'defensive', was: 'hangyeol',
    line: 'Havet lærer deg tålmodighet.', ko: '바다가 인내를 가르쳐 줘요.', bio: '베르겐의 어부. 폭풍이 오는 날엔 배 대신 당구대 앞에 선다.' },
  { id: 'frederic', name: '프레데릭', from: 'be', lang: 'fr', rating: 2000, personality: 'calm', style: 'position',
    line: 'Trois bandes, une seule pensée : la suivante.', ko: '쓰리쿠션, 생각은 하나뿐. 다음 공.', bio: '벨기에 쓰리쿠션 리그 출신. 표정이 변하지 않는다.' },
  { id: 'jack', name: '잭', from: 'gb', lang: 'en', rating: 2100, personality: 'impatient', style: 'showman', pic: true,
    line: 'If you’re going to miss, miss beautifully.', ko: '놓칠 거면 멋지게 놓쳐.', bio: '런던 펍의 스누커 스타. 보는 사람이 있어야 잘 친다.' },
  { id: 'lena', name: '레나', from: 'de', lang: 'de', rating: 2200, personality: 'meticulous', style: 'banker', pic: true, was: 'max',
    line: 'Präzision ist keine Kunst, sondern Gewohnheit.', ko: '정확함은 재능이 아니라 습관이에요.', bio: '뮌헨의 시계 기술자. 빗나간 각도를 0.1도까지 기억한다.' },
  { id: 'elijah', name: '일라이자', from: 'us', lang: 'en', rating: 2300, personality: 'playful', style: 'power', was: 'lukas',
    line: 'Relax. I already saw the whole rack.', ko: '긴장 풀어. 난 벌써 판 전체를 다 봤거든.', bio: '켄터키 출신의 떠돌이 천재. 카우보이모자를 쓰고, 상대가 생각하는 동안 벌써 다음 세 수를 친다.' },
];
/* Each bot's face on its card (owner 11-17: like chess.com's bot icons, simpler still - drawn here, not the painting): a
   square of its colour, its shoulders in its clothes, a round face, its hair as one shape, two dots for eyes; a few have a
   thing of their own (glasses, a beard, a cap...). [background, skin, hair colour, hair, clothes, extra] */
const BOT_FACE = {
  daeun: ['#9fd3e6', '#f5d3b8', '#16161c', 'blunt', '#8ec1ea', 'inner'], marco: ['#f0a37c', '#e8b48f', '#1e1a18', 'curly', '#f4f1ea', ''],
  yuki: ['#b9b4f0', '#f6d2b8', '#15131a', 'blunt', '#2b3a66', ''],
  ploy: ['#f6b3cf', '#f1c9a5', '#f08cb8', 'long', '#fbf3f6', 'bow2'], meilin: ['#e7a0a0', '#f4d3bd', '#1d2a4a', 'bun', '#b8242c', ''],
  luiza: ['#7fd0a0', '#d9a074', '#a8703c', 'wavy', '#f4f1ea', ''],
  sofia: ['#8ec5e8', '#e2b38e', '#2a1d16', 'crown', '#2c3e5c', ''], sean: ['#8fbf6a', '#f2c6a5', '#b5562a', 'short', '#7a5a3a', 'cap beard'],
  emre: ['#f0c38a', '#d9a27a', '#8f8a86', 'short', '#7a2430', 'tache'], darya: ['#e7b26a', '#f6e2d6', '#5a2e1c', 'crown', '#141414', ''],
  femke: ['#7fb2d8', '#f4cdb0', '#d0784a', 'pixie', '#e86a1c', ''], ana: ['#e28a7a', '#e8b896', '#2a1a14', 'bun', '#141414', 'flower'],
  priya: ['#c9a0e8', '#b9805a', '#121014', 'bun', '#222222', ''], lea: ['#e6c38a', '#f0c8aa', '#6b3e26', 'wavy', '#8a3a2a', 'beret'],
  migo: ['#f2b65e', '#b07a52', '#151214', 'messy', '#1f4fb0', 'phones'], ingrid: ['#9ab0c8', '#f5d6c2', '#dcdde2', 'pony', '#9e2a2a', ''],
  ole: ['#c9b28a', '#f0c8aa', '#c2522a', 'messy', '#2e4a6b', 'beard'], frederic: ['#b8c4d6', '#e8bc98', '#2a2624', 'slick', '#1f2a44', 'tie'],
  jack: ['#e0a65a', '#f0c7a6', '#c9a35a', 'messy', '#222222', 'bow'], lena: ['#a8d0c0', '#f3cfb6', '#e2c47a', 'bun', '#1e1e1e', 'glasses'],
  elijah: ['#8a9bb8', '#5a3622', '#1a1412', 'fade', '#4a2e1c', 'hat tache'],
};
const BOT_HAIR = {
  short: 'M14.6 22.5Q14 12 24 11.6Q34 12 33.4 22.5Q31 16.5 24 16.8Q17 16.5 14.6 22.5Z',
  combed: 'M14.6 22Q14.5 11.5 24 11.5Q33.5 11.5 33.4 22Q32 15 26 15.4Q19 15.6 14.6 22Z',
  slick: 'M14.8 21Q15 11 25 11.4Q34 12 33.2 21Q31 14.6 24.5 15Q18.5 14.6 14.8 21Z',
  messy: 'M13.8 22Q13 13 17 12Q18 9 22 10.5Q25 8.4 28 10.6Q33 10 34 15Q35.4 18 33.6 22Q31 16 24 16.6Q17 16 13.8 22Z',
  curly: 'M13 24Q11 19 14 16Q13 11 18 11Q20 8 24 9.4Q28 8 30.5 11Q35.5 11 34.5 16Q37 20 35 24Q32 17 24 17Q16 17 13 24Z',
  wavy: 'M12.6 30Q11 20 14 15Q17 10 24 10.2Q31 10 34 15Q37 21 35.4 30Q33 31 32.4 27Q32.6 19 24 17.4Q15.4 19 15.6 27Q15 31 12.6 30Z',
  long: 'M12 37Q10.6 22 13.6 15Q17 9.6 24 9.8Q31 9.6 34.4 15Q37.4 22 36 37L31.6 37Q32.6 21 24 17.2Q15.4 21 16.4 37Z',
  blunt: 'M13 31Q12 16 16 12.4Q19.4 10 24 10Q28.6 10 32 12.4Q36 16 35 31L31.4 31L31.4 19.4L16.6 19.4L16.6 31Z',
  low: 'M13.8 26Q12.4 14 18 11.6Q21 10.2 24 10.2Q33 10.2 34.6 18Q35.4 23 33.6 27Q32.6 19 24 16.8Q16 18 15.8 27Z',
  pony: 'M14 24Q13 12 24 11Q35 12 34 24Q32.4 17 24 16.8Q15.6 17 14 24ZM31 12Q37 9 38.6 14Q40 20 36.4 27Q35.4 20 33 15Z',
  bun: 'M14.4 23Q14 12 24 11.4Q34 12 33.6 23Q31.4 16.6 24 16.8Q16.6 16.6 14.4 23ZM24 4.6A4.6 4.6 0 1 1 23.99 4.6Z',
  pixie: 'M14 23Q12.8 12.4 21 11.2Q27 10 31.6 12.8Q35 16 34 23Q32.6 18 27 16.2Q22 17.6 18 16.6Q15.6 19 14 23Z',
  knot: 'M15 21Q15 13 24 12.6Q33 13 33 21Q30.6 16.8 24 17Q17.4 16.8 15 21ZM24 5A4.4 4.4 0 1 1 23.99 5Z',
  braids: 'M12.4 38Q10.8 22 13.8 15Q17 10 24 10Q31 10 34.2 15Q37.2 22 35.6 38L31.8 38Q32.6 21 24 17.4Q15.4 21 16.2 38ZM12.4 38h3.8v3h-3.8zM31.8 38h3.8v3h-3.8z',
  fade: 'M15.4 19Q15.6 12.6 24 12.4Q32.4 12.6 32.6 19Q30 15.6 24 15.8Q18 15.6 15.4 19Z',
  crown: 'M14.2 22Q14 12 24 11.4Q34 12 33.8 22Q31.6 16.4 24 16.6Q16.4 16.4 14.2 22ZM13.6 15.4Q16 9.4 24 9Q32 9.4 34.4 15.4Q31 11.4 24 11.6Q17 11.4 13.6 15.4Z',
};
function botAvatar(b) {
  const f = BOT_FACE[b.id] || ['#9aa7b4', '#eac3a2', '#2a2420', 'short', '#445', ''], [bg, skin, hair, style, wear, extra] = f, x = extra.split(' ');
  const has = k => x.includes(k);
  return `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><rect width="48" height="48" fill="${bg}"/>`
    + `<path d="M8.5 48Q9 35.4 24 34.4Q39 35.4 39.5 48Z" fill="${wear}"/>`
    + (has('tie') ? '<path d="M22.6 35.2h2.8l.9 2-1.6 8.4h-1.4l-1.6-8.4z" fill="#7a1f2a"/>' : has('bow') ? '<path d="M19.6 35.4l4.4 1.8 4.4-1.8v4l-4.4-1.8-4.4 1.8z" fill="#111"/>' : '')
    + `<rect x="21.2" y="29.6" width="5.6" height="6" rx="2.4" fill="${skin}"/><circle cx="24" cy="23" r="9.2" fill="${skin}"/>`
    + (has('beard') ? `<path d="M15.6 24.6Q16.6 33.4 24 33.4Q31.4 33.4 32.4 24.6Q30 29.6 24 29.4Q18 29.6 15.6 24.6Z" fill="${hair}"/>` : '')
    + (has('tache') ? `<path d="M19.6 27.4Q24 25 28.4 27.4Q24 26.6 19.6 27.4Z" fill="${hair}" stroke="${hair}" stroke-width="1.4" stroke-linejoin="round"/>` : '')
    + `<path d="${BOT_HAIR[style] || BOT_HAIR.short}" fill="${hair}"/>`
    + (has('bandana') ? '<path d="M14.4 17.4Q24 9.6 33.6 17.4L33 14.4Q24 7.4 15 14.4Z" fill="#c8202a"/>' : '')
    + (has('cap') ? `<path d="M13.6 18.6Q14 10.4 24 10.2Q34 10.4 34.4 18.6Q24 15.8 13.6 18.6Z" fill="#5a4a38"/><path d="M13 18.8Q24 15.6 35 18.8L34.6 20Q24 17.6 13.4 20Z" fill="#3e3226"/>` : '')
    + (has('beret') ? '<ellipse cx="22.4" cy="12.6" rx="11" ry="4.6" fill="#2a2430" transform="rotate(-10 22.4 12.6)"/><circle cx="21" cy="8" r="1.2" fill="#2a2430"/>' : '')
    + (has('bow2') ? '<path d="M28.4 12.2l3.4-2.6.4 4.4zm3.8 1.8l3.8 1.8-3.8 1.8z" fill="#ff6aa2"/>' : '')
    + (has('beanie') ? '<path d="M13.6 17Q14 8 24 8Q34 8 34.4 17Z" fill="#6b8f5a"/><rect x="13" y="15.6" width="22" height="3" rx="1.4" fill="#557548"/><circle cx="24" cy="7.4" r="2" fill="#6b8f5a"/>' : '')
    + (has('hoops') ? '<g fill="none" stroke="#e2b23a" stroke-width="1.1"><circle cx="14.8" cy="27" r="1.9"/><circle cx="33.2" cy="27" r="1.9"/></g>' : '')
    + (has('inner') ? '<path d="M15.4 27q.6-6 2.8-8.6M32.6 27q-.6-6-2.8-8.6" stroke="#2f6fd6" stroke-width="2" fill="none"/>' : '')
    + (has('band') ? '<path d="M14.6 17.4Q24 11 33.4 17.4" stroke="#111" stroke-width="2.2" fill="none"/>' : '')
    + (has('hat') ? '<path d="M8.6 15.6Q24 11 39.4 15.6Q38 17.6 24 16.4Q10 17.6 8.6 15.6Z" fill="#111"/><path d="M15.4 15Q15 6.6 24 6.4Q33 6.6 32.6 15Q24 13.2 15.4 15Z" fill="#1b1b1b"/><path d="M15.6 13.6Q24 11.8 32.4 13.6" stroke="#6b4a2a" stroke-width="1.2" fill="none"/>' : '')
    + (has('flower') ? '<circle cx="31.6" cy="12.6" r="2.6" fill="#d7263d"/><circle cx="31.6" cy="12.6" r="1" fill="#8a1020"/>' : '')
    + (has('phones') ? '<path d="M14 35q-1-7 4-8M34 35q1-7-4-8" stroke="#222" stroke-width="2.2" fill="none"/><rect x="11.6" y="33" width="4.4" height="5" rx="1.6" fill="#ff4d6d"/><rect x="32" y="33" width="4.4" height="5" rx="1.6" fill="#ff4d6d"/>' : '')
    + (has('clip') ? '<rect x="27.4" y="13.4" width="5" height="1.8" rx=".9" fill="#ffd166" transform="rotate(-24 29.9 14.3)"/>' : '')
    + '<circle cx="20.4" cy="23.6" r="1.35" fill="#231d19"/><circle cx="27.6" cy="23.6" r="1.35" fill="#231d19"/>'
    + (has('glasses') ? '<g fill="none" stroke="#2a2420" stroke-width="1"><circle cx="20.4" cy="23.6" r="2.9"/><circle cx="27.6" cy="23.6" r="2.9"/><path d="M23.3 23.4h1.4"/></g>' : '')
    + '</svg>';
}
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
    br: `<rect width="60" height="40" fill="#009c3b"/><polygon points="30,5 55,20 30,35 5,20" fill="#ffdf00"/><circle cx="30" cy="20" r="8.5" fill="#002776"/><path d="M21.7 18.2q8.5-2.6 16.6 2.4" stroke="#fff" stroke-width="1.6" fill="none"/>`,
    gr: `${bars('h', ['#0d5eaf', '#fff', '#0d5eaf', '#fff', '#0d5eaf', '#fff', '#0d5eaf', '#fff', '#0d5eaf'])}<rect width="22.2" height="22.2" fill="#0d5eaf"/><rect x="8.9" width="4.4" height="22.2" fill="#fff"/><rect y="8.9" width="22.2" height="4.4" fill="#fff"/>`,
    ie: bars('v', ['#169b62', '#fff', '#ff883e']),
    eg: `${bars('h', ['#ce1126', '#fff', '#000'])}<path d="M30 15l3 3-1 4h-4l-1-4z" fill="#c09300"/>`,
    in: `${bars('h', ['#ff9933', '#fff', '#138808'])}<circle cx="30" cy="20" r="5" fill="none" stroke="#000080" stroke-width="1.2"/><circle cx="30" cy="20" r="1" fill="#000080"/>`,
    se: `<rect width="60" height="40" fill="#006aa7"/><rect x="17" width="7" height="40" fill="#fecc00"/><rect y="16.5" width="60" height="7" fill="#fecc00"/>`,
    at: bars('h', ['#c8102e', '#fff', '#c8102e']),
    cn: `<rect width="60" height="40" fill="#de2910"/><path d="M10 6l1.8 5.5h5.8l-4.7 3.4 1.8 5.5-4.7-3.4-4.7 3.4 1.8-5.5-4.7-3.4h5.8z" fill="#ffde00"/>${[[20, 4], [24, 8], [24, 14], [20, 18]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.4" fill="#ffde00"/>`).join('')}`,
    th: bars('h', ['#a51931', '#f4f5f8', '#2d2a4a', '#2d2a4a', '#f4f5f8', '#a51931']),
    ru: bars('h', ['#fff', '#0039a6', '#d52b1e']),
    fi: `<rect width="60" height="40" fill="#fff"/><rect x="16" width="10" height="40" fill="#003580"/><rect y="15" width="60" height="10" fill="#003580"/>`,
    nz: `<rect width="60" height="40" fill="#012169"/><path d="M0 0l30 20M30 0L0 20" stroke="#fff" stroke-width="4"/><path d="M15 0v20M0 10h30" stroke="#fff" stroke-width="6"/><path d="M15 0v20M0 10h30" stroke="#c8102e" stroke-width="3"/>${[[45, 10], [40, 20], [50, 18], [45, 31]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2" fill="#c8102e" stroke="#fff" stroke-width=".7"/>`).join('')}`,
    ng: bars('v', ['#008751', '#fff', '#008751']),
    mx: `${bars('v', ['#006847', '#fff', '#ce1126'])}<circle cx="30" cy="20" r="3.4" fill="#8c5a2b"/>`,
    no: `<rect width="60" height="40" fill="#ba0c2f"/><rect x="16" width="10" height="40" fill="#fff"/><rect y="15" width="60" height="10" fill="#fff"/><rect x="18.5" width="5" height="40" fill="#00205b"/><rect y="17.5" width="60" height="5" fill="#00205b"/>`,
    us: `${bars('h', ['#b22234', '#fff', '#b22234', '#fff', '#b22234', '#fff', '#b22234', '#fff', '#b22234', '#fff', '#b22234', '#fff', '#b22234'])}<rect width="26" height="21.5" fill="#3c3b6e"/>`,
    gb: `<rect width="60" height="40" fill="#012169"/><path d="M0 0L60 40M60 0L0 40" stroke="#fff" stroke-width="8"/><path d="M0 0L60 40M60 0L0 40" stroke="#c8102e" stroke-width="2.6"/><path d="M30 0v40M0 20h60" stroke="#fff" stroke-width="12"/><path d="M30 0v40M0 20h60" stroke="#c8102e" stroke-width="7"/>`,
  };
  const out = {}; for (const k in F) out[k] = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40">${F[k]}</svg>`);
  return out;
})();
const BOT_COUNTRY = { ru: '러시아', fi: '핀란드', nz: '뉴질랜드', ng: '나이지리아', mx: '멕시코', no: '노르웨이', us: '미국', cn: '중국', th: '태국', br: '브라질', gr: '그리스', ie: '아일랜드', eg: '이집트', in: '인도', se: '스웨덴', at: '오스트리아', kr: '대한민국', it: '이탈리아', jp: '일본', co: '콜롬비아', vn: '베트남', tr: '튀르키예', nl: '네덜란드', es: '스페인', fr: '프랑스', ph: '필리핀', be: '벨기에', gb: '영국', de: '독일' };
const botFlag = b => el('img', { class: 'flag', src: BOT_FLAGS[b.from], alt: BOT_COUNTRY[b.from] || '', title: BOT_COUNTRY[b.from] || '' });
const botById = id => BOTS.find(b => b.id === id);
const botTier = b => TIERS[Math.min(TIERS.length - 1, tierOf(b.rating))];
// open: the first two, one whose bot before it is beaten, or one at or under the player's own rating
/* (owner 11-17: a beginner should meet a pretty opponent from the start) 브론즈 and 실버 all open; from 골드 to 프로 the
   lowest-rated of each tier open; the rest when the one before is beaten or the player's rating has reached it */
function botOpen(b) {
  const i = BOTS.indexOf(b), mine = net.me && net.me.dama != null ? net.me.dama : 0, t = tierOf(b.rating);
  if (t <= 1 || BOTS.filter(x => tierOf(x.rating) === t).every(x => x.rating >= b.rating)) return true;
  return botWon(BOTS[i - 1]) || b.rating <= mine;
}
// beaten (a bot that took over an old one's place - was - counts the old one's win: prefs.botBeat keeps ids)
const botWon = b => { const w = prefs.botBeat || {}; return !!(w[b.id] || b.was && w[b.was]); };
const botNow = () => { const b = botById(prefs.bot); return b && botOpen(b) ? b : BOTS[0]; };
// the bot as the AI plays it: a person at its rating, of its personality and style (the same every game: drawn from its id)
function botPersona(b) {
  let h = 2166136261; for (const ch of b.id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const p = game.aiPersona ? game.aiPersona(b.rating, seededRandom(h), { personality: b.personality, style: b.style }) : null;
  return p ? Object.assign(p, { name: b.name, bot: b.id, lang: b.lang }) : null;
}
// its face: the flat drawing (BOT_FACE), on its card and on the slate
function botPic(b, big) {
  const [tier] = botTier(b), i = el('i', { class: `bot-pic t-${tier}${big ? ' big' : ''}`, 'aria-hidden': 'true' });
  i.innerHTML = botAvatar(b); return i;
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
  // (owner 11-17: the bot picked, painted, on the tray's left behind the cards - painting itself in: botArt)
  if (cur.pic) dkPut(stage, botArt(cur));
  dkPut(stage, el('div', { class: 'bot-tray' + (cur.pic ? ' with-art' : '') }, TIERS.map(([, name], t) => {
    const L = BOTS.filter(b => Math.min(TIERS.length - 1, tierOf(b.rating)) === t);
    return el('section', { class: 'bot-row' }, [el('h3', { text: name }),
      el('div', { class: 'bot-cards' }, L.map(b => {
        const [tier] = botTier(b), open = botOpen(b), beat = botWon(b);
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
      el('div', { class: 'bot-nm' }, [el('b', { class: b.name.length >= 4 ? 'long' : null, text: b.name }), botFlag(b)]),
      el('span', { class: 'bot-rt' }, [el('em', { text: tierName }), document.createTextNode(String(b.rating))])])]),
    el('div', { class: 'bot-say' }, [el('p', { lang: b.lang, text: b.line }), foreign && b.ko ? el('small', { text: b.ko }) : null]),
    el('div', { class: 'bot-tags' }, [me ? el('span', { text: me.style.name.replace(/파$/, '') }) : null, me ? el('span', { text: me.personality.name }) : null,
      botWon(b) ? el('span', { class: 'won', text: '이긴 상대' }) : null]),
    el('p', { class: 'bot-bio', text: b.bio })];
}
/* The bot talks at the table (owner 11-16): a speech bubble under its plate, in its own language with the Korean under it
   in a near-black grey - in place of the emoji a person online sends. Its words are BOT_LINES (34-bot-lines.js), by moment;
   how often it speaks by its personality (the playful and brash a lot, the calm and careful seldom), never two on top of
   each other. Only the bot of 컴퓨터 대전; looks only (Math.random, never the game's numbers). */
function botLines(b, moment, stage = 0) {
  const L = BOT_LINES[b.id] || {};
  for (let s = stage; s >= 0; s--) if (L[s] && L[s][moment] && L[s][moment].length) return L[s][moment];
  return [];
}
const botTalk = {
  at: 0, said: '',
  bot() { const c = match.ctx; return flow === match && c && c.bot && !c.online ? botById(c.bot.bot) : null; },
  chat() { const c = match.ctx, p = c && c.bot && c.bot.personality || {}; return 0.3 + (p.taunt || 0) * 0.45 + (p.tempo || 0) * 0.15 - (p.hesitation || 0) * 0.1; },
  line(b, moment) {
    const L = botLines(b, moment).filter(x => x[0] !== botTalk.said), pick = L[Math.floor(Math.random() * L.length)];
    if (pick) botTalk.said = pick[0]; return pick || null;
  },
  // moment: as BOT_LINES; chance: of speaking at all, before its personality; delay: after the moment, seconds
  say(moment, chance = 1, delay = 0.5) {
    const b = botTalk.bot(); if (!b || Math.random() > chance * (chance >= 1 ? 1 : botTalk.chat())) return;
    const now = Date.now(); if (now - botTalk.at < 3200) return;
    const ln = botTalk.line(b, moment); if (!ln) return;
    botTalk.at = now + delay * 1000;
    setTimeout(() => { if (botTalk.bot() === b) botTalk.show(b, ln); }, delay * 1000);
  },
  show(b, [text, ko]) {
    const pill = $('#p1'); if (!pill || st.screen !== 'play') return;
    const old = $('#botBub'); if (old) old.remove();
    const bub = el('div', { id: 'botBub', class: 'bot-bub', role: 'status' }, [el('p', { lang: b.lang, dir: 'auto', text }), ko && b.lang !== 'ko' ? el('small', { text: ko }) : null]);
    $('#app').appendChild(bub);
    const r = pill.getBoundingClientRect(), bw = bub.offsetWidth;
    bub.style.left = Math.max(8, Math.min(innerWidth - bw - 8, r.right - bw - 6)) + 'px'; bub.style.top = (r.bottom + 12) + 'px';
    const stay = 2600 + Math.min(2600, (text.length + (ko || '').length) * 45);
    setTimeout(() => bub.classList.add('out'), stay); setTimeout(() => bub.remove(), stay + 400);
  },
  // (match.afterShot) a shot played: the bot's own, or the player's
  shot(by, r, score) {
    if (!botTalk.bot() || game.over) return;
    const good = !!(r && !r.foul && (r.keep || r.pts > 0));
    if (by === 1) botTalk.say(good ? 'score' : 'miss', good ? 0.5 : 0.6);
    else if (good) botTalk.say('nice', score >= 20 ? 0.95 : 0.3);
    else botTalk.say('oops', r && r.foul ? 0.75 : 0.4);
  },
  // the end of the game: what it says, for the result's slate
  last(won) { const b = botTalk.bot(); return b ? botTalk.line(b, won ? 'win' : 'lose') : null; },
  clear() { const old = $('#botBub'); if (old) old.remove(); },
};
/* Where each painting's face is, so all are shown alike (botArt): [centre x, centre y, height from hairline to chin], as
   parts of the picture's width and height - read off the pictures (owner 11-17: Priya looked far smaller than Ingrid). A new
   picture without a line here is taken as the prompts ask for it (tasks/CUE-prompts-bots-art.md): [0.5, 0.15, 0.14]. */
const BOT_FRAME = {
  emre: [0.47, 0.11, 0.15], femke: [0.53, 0.12, 0.13],
  ingrid: [0.36, 0.15, 0.15], jack: [0.43, 0.12, 0.14], lea: [0.48, 0.17, 0.14], lena: [0.4, 0.14, 0.13],
  marco: [0.42, 0.1, 0.12], meilin: [0.47, 0.16, 0.14],
  ploy: [0.33, 0.16, 0.14], priya: [0.5, 0.12, 0.11], sean: [0.42, 0.15, 0.14], sofia: [0.42, 0.15, 0.13], yuki: [0.38, 0.15, 0.14],
};
/* (owner 11-17: shown on the desk as it leans back - 'like the old painters') The desk plane is tilted away from the eye
   (#deskPlane: perspective --pp, rotateX --tilt, about its bottom edge), so a picture lying on it is squashed and its top
   narrowed. As a painter does for a picture seen at an angle, the painting is drawn stretched against that - each row
   moved and widened by what the tilt will take from it - so that from where the player looks it stands as painted.
   (No tilt - a flat desk -: drawn as it is.) */
function botAnamorph(cv, flat, dpr) {
  const app = $('#app'), plane = $('#deskPlane');
  const th = parseFloat(app.style.getPropertyValue('--tilt')) || 0, P = parseFloat(app.style.getPropertyValue('--pp')) || 2300;
  if (!app.classList.contains('tilt') || !plane || !th) return flat;
  let top = 0; for (let e = cv; e && e !== plane; e = e.offsetParent) top += e.offsetTop;
  const W = flat.width, H = flat.height, Hc = H / dpr, hB = plane.offsetHeight - (top + Hc), sin = Math.sin(th), cos = Math.cos(th);
  const f = h => P / (P + h * sin), Y = h => h * cos * f(h);            // (a point h above the plane's foot: its scale, its height on the screen)
  const YB = Y(hB), YT = Y(hB + Hc), fRef = f(hB + Hc * 0.35);         // (kept true at the face's height)
  const out = document.createElement('canvas'); out.width = W; out.height = H; const g = out.getContext('2d');
  for (let i = 0; i < H; i += 2) {
    const r = h => H * (YT - Y(h)) / (YT - YB), h0 = hB + Hc - i / dpr, h1 = hB + Hc - (i + 2) / dpr, r0 = r(h0), r1 = r(h1), sw = W * f(h0) / fRef;
    g.drawImage(flat, (W - sw) / 2, r0, sw, Math.max(0.5, r1 - r0), 0, i, W, 2);
  }
  return out;
}
/* The bot picked, painted (style g), standing on the tray's left behind the cards on its backdrop (the dark desk's green
   painting, the light one's blue), painting itself in: brush strokes laid one after another, each showing the picture
   under it, from the bottom up - as if being painted. Drawn on a canvas; the same bot again is not painted twice. */
const BOT_ART_IMG = {};
const botImg = src => BOT_ART_IMG[src] || (BOT_ART_IMG[src] = Object.assign(new Image(), { src, decoding: 'async' }));
let botArtLast = null;
function botArt(b) {
  const cv = el('canvas', { class: 'bot-art', 'aria-hidden': 'true', 'data-bot': b.id + '|' + themeNow() });
  const fig = botImg(`ui/bot-${b.id}.webp`), back = botImg(`ui/bot-bg-${themeNow() === 'light' ? 'light' : 'dark'}.webp`), again = botArtLast === b.id + themeNow();
  botArtLast = b.id + themeNow();
  const go = () => {
    if (!cv.isConnected) return requestAnimationFrame(go);
    const dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.round(cv.clientWidth * dpr), H = Math.round(cv.clientHeight * dpr); if (!W || !H) return;
    cv.width = W; cv.height = H; const g = cv.getContext('2d');
    const paint = g2 => {
      const bs = Math.max(W, H); g2.drawImage(back, (W - bs) / 2, (H - bs) / 2, bs, bs);
      /* (owner 11-17: everyone the same size, placed as a portrait painter would) each picture's face - BOT_FRAME: where its
         centre is and how tall it is, as parts of the picture - drawn at one height, its centre on the upper third, a little
         in the middle of the part the cards leave free; the rest of the figure falls where it falls */
      const [fx, fy, fh0] = BOT_FRAME[b.id] || [0.5, 0.15, 0.14], ih = H * 0.105 / fh0, iw = ih * fig.width / fig.height;
      g2.drawImage(fig, W * 0.36 - fx * iw, H * 0.25 - fy * ih, iw, ih);
    };
    const flat = document.createElement('canvas'); flat.width = W; flat.height = H; paint(flat.getContext('2d'));
    const full = botAnamorph(cv, flat, dpr);
    if (again || matchMedia('(prefers-reduced-motion: reduce)').matches) { g.drawImage(full, 0, 0); return; }
    // the strokes: rows from the bottom up, each a few broad dabs across, a little askew
    const strokes = [], rows = 22, R = H / rows;
    for (let r = 0; r < rows; r++) for (let k = 0; k < 5; k++) strokes.push({ y: H - (r + Math.random() * 0.8) * R, x: (k / 5 + Math.random() * 0.2) * W, len: W * (0.35 + Math.random() * 0.4), w: R * (1.6 + Math.random() * 1.2), a: (Math.random() - 0.5) * 0.5 });
    const mask = document.createElement('canvas'); mask.width = W; mask.height = H; const m = mask.getContext('2d'); m.lineCap = 'round'; m.strokeStyle = '#000';
    let i = 0; const t0 = performance.now(), dur = 1100;
    const step = now => {
      if (!cv.isConnected) return;
      const upto = Math.min(strokes.length, Math.round(strokes.length * Math.min(1, (now - t0) / dur)));
      for (; i < upto; i++) { const q = strokes[i]; m.lineWidth = q.w; m.beginPath(); m.moveTo(q.x - q.len / 2, q.y + Math.sin(q.a) * q.len / 2); m.quadraticCurveTo(q.x, q.y - q.w * 0.3, q.x + q.len / 2, q.y - Math.sin(q.a) * q.len / 2); m.stroke(); }
      g.clearRect(0, 0, W, H); g.drawImage(full, 0, 0); g.globalCompositeOperation = 'destination-in'; g.drawImage(mask, 0, 0); g.globalCompositeOperation = 'source-over';
      if (i < strokes.length) requestAnimationFrame(step); else { g.clearRect(0, 0, W, H); g.drawImage(full, 0, 0); }
    };
    requestAnimationFrame(step);
  };
  Promise.all([fig, back].map(im => im.complete && im.naturalWidth ? 1 : new Promise(r => { im.onload = im.onerror = r; }))).then(() => requestAnimationFrame(go));
  return cv;
}
