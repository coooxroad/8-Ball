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
  { id: 'haneul', name: '하늘', from: 'kr', lang: 'ko', rating: 300, personality: 'playful', style: 'natural', pic: true,
    line: '공이 어디로 갈지 모르니까 재밌는 거잖아요!', bio: '당구장 아르바이트 3주째. 손님 없을 때 몰래 친다.' },
  { id: 'marco', name: '마르코', from: 'it', lang: 'it', rating: 450, personality: 'nervous', style: 'balanced', pic: true,
    line: 'Piano piano si va lontano.', ko: '천천히 가야 멀리 가요.', bio: '나폴리에서 온 요리 유학생. 큐를 잡으면 손이 떨린다.' },
  { id: 'yuki', name: '유키', from: 'jp', lang: 'ja', rating: 600, personality: 'calm', style: 'follow', pic: true,
    line: '一球一球、心を込めて。', ko: '한 공 한 공, 마음을 담아서.', bio: '도쿄 동네 당구장 사장님 딸. 매일 밀어치기만 연습한다.' },
  { id: 'camila', name: '카밀라', from: 'co', lang: 'es', rating: 700, personality: 'impatient', style: 'power', pic: true, was: 'carlos',
    line: '¡Si no entra, que por lo menos suene!', ko: '안 들어가면 소리라도 크게 나야지!', bio: '메데인의 오토바이 정비공. 힘 조절은 아직 공부 중.' },
  { id: 'luiza', name: '루이자', from: 'br', lang: 'pt', rating: 780, personality: 'playful', style: 'showman', pic: true,
    line: 'Quem joga com alegria nunca perde de verdade.', ko: '즐겁게 치는 사람은 진짜로 지는 법이 없어.', bio: '리우데자네이루의 삼바 강사. 샷마다 스텝을 밟는다.' },
  { id: 'linh', name: '린', from: 'vn', lang: 'vi', rating: 850, personality: 'fidgety', style: 'spinner', pic: true,
    line: 'Đường thẳng thì ai cũng đi được.', ko: '곧은 길은 누구나 갈 수 있죠.', bio: '하노이의 대학생. 회전 거는 게 제일 신난다.' },
  { id: 'sofia', name: '소피아', from: 'gr', lang: 'el', rating: 950, personality: 'calm', style: 'balanced', pic: true,
    line: 'Η θάλασσα δεν βιάζεται ποτέ.', ko: '바다는 절대 서두르지 않아.', bio: '아테네의 해양생물학자. 파도 소리를 들으며 연습한다.' },
  { id: 'sean', name: '숀', from: 'ie', lang: 'en', rating: 1050, personality: 'calm', style: 'defensive', pic: true,
    line: 'The man who leaves nothing wins the night.', ko: '아무것도 안 남기는 사람이 그날 밤을 이기지.', bio: '더블린 펍의 단골. 상대에게 쉬운 공을 남긴 적이 없다.' },
  { id: 'emre', name: '엠레', from: 'tr', lang: 'tr', rating: 1150, personality: 'calm', style: 'gather', pic: true,
    line: 'Toplar bir araya gelirse oyun kendiliğinden akar.', ko: '공이 모이면 경기는 저절로 흘러가요.', bio: '이스탄불 찻집 겸 당구장 주인. 차 한 잔 마시고 친다.' },
  { id: 'nour', name: '누르', from: 'eg', lang: 'ar', rating: 1250, personality: 'meticulous', style: 'banker', pic: true,
    line: 'الكوشة الصح بتوصلك لأي مكان.', ko: '맞는 쿠션 하나면 어디든 갈 수 있어.', bio: '카이로의 쓰리쿠션 선수. 할아버지에게 배운 시스템을 외운다.' },
  { id: 'femke', name: '펨케', from: 'nl', lang: 'nl', rating: 1350, personality: 'impatient', style: 'power', pic: true, was: 'willem',
    line: 'Via de band is altijd korter.', ko: '쿠션을 돌아가는 게 언제나 더 빨라.', bio: '로테르담 항구의 크레인 기사. 기다리는 걸 제일 싫어한다.' },
  { id: 'ana', name: '아나', from: 'es', lang: 'es', rating: 1450, personality: 'meticulous', style: 'position', pic: true,
    line: 'La bola de hoy prepara la de mañana.', ko: '지금 치는 공이 다음 공을 준비해요.', bio: '발렌시아의 건축가. 당구대를 도면처럼 본다.' },
  { id: 'priya', name: '프리야', from: 'in', lang: 'hi', rating: 1550, personality: 'meticulous', style: 'defensive', pic: true,
    line: 'हर गेंद एक सवाल है, और हर शॉट उसका जवाब।', ko: '모든 공은 질문이고, 모든 샷은 그 대답이에요.', bio: '벵갈루루의 소프트웨어 엔지니어. 샷 전에 머릿속으로 시뮬레이션을 돌린다.' },
  { id: 'lea', name: '레아', from: 'fr', lang: 'fr', rating: 1650, personality: 'playful', style: 'masse', pic: true,
    line: 'Le billard, c’est de la géométrie qui danse.', ko: '당구는 춤추는 기하학이에요.', bio: '파리의 문학도. 공이 휘어 가는 걸 시처럼 좋아한다.' },
  { id: 'jose', name: '호세', from: 'ph', lang: 'tl', rating: 1750, personality: 'calm', style: 'draw',
    line: 'Huwag magmadali. Marunong maghintay ang bola.', ko: '서두르지 마요. 공은 기다릴 줄 알아요.', bio: '마닐라 거리 당구에서 자랐다. 끌어치기 하나로 이름을 알렸다.' },
  { id: 'ingrid', name: '잉그리드', from: 'se', lang: 'sv', rating: 1850, personality: 'playful', style: 'spinner', pic: true,
    line: 'Det enkla är det svåra.', ko: '쉬운 게 제일 어려운 거야.', bio: '스톡홀름의 엔지니어. 껌을 씹으며 표정 하나 안 바꾸고 회전을 건다.' },
  { id: 'hangyeol', name: '한결', from: 'kr', lang: 'ko', rating: 1950, personality: 'meticulous', style: 'defensive', pic: true,
    line: '급할수록 돌아가라. 당구대 위에서는 더 그렇습니다.', bio: '35년째 동네 당구장 관장. 말이 적다.' },
  { id: 'frederic', name: '프레데릭', from: 'be', lang: 'fr', rating: 2000, personality: 'calm', style: 'position',
    line: 'Trois bandes, une seule pensée : la suivante.', ko: '쓰리쿠션, 생각은 하나뿐. 다음 공.', bio: '벨기에 쓰리쿠션 리그 출신. 표정이 변하지 않는다.' },
  { id: 'jack', name: '잭', from: 'gb', lang: 'en', rating: 2100, personality: 'impatient', style: 'showman', pic: true,
    line: 'If you’re going to miss, miss beautifully.', ko: '놓칠 거면 멋지게 놓쳐.', bio: '런던 펍의 스누커 스타. 보는 사람이 있어야 잘 친다.' },
  { id: 'lena', name: '레나', from: 'de', lang: 'de', rating: 2200, personality: 'meticulous', style: 'banker', pic: true, was: 'max',
    line: 'Präzision ist keine Kunst, sondern Gewohnheit.', ko: '정확함은 재능이 아니라 습관이에요.', bio: '뮌헨의 시계 기술자. 빗나간 각도를 0.1도까지 기억한다.' },
  { id: 'lukas', name: '루카스', from: 'at', lang: 'de', rating: 2300, personality: 'calm', style: 'power', pic: true,
    line: 'Wer zögert, hat schon verloren.', ko: '망설이는 사람은 이미 진 거야.', bio: '빈의 프로 포켓볼 선수. 브레이크 한 번에 경기를 끝낸 적이 있다.' },
];
/* Each bot's face on its card (owner 11-17: like chess.com's bot icons, simpler still - drawn here, not the painting): a
   square of its colour, its shoulders in its clothes, a round face, its hair as one shape, two dots for eyes; a few have a
   thing of their own (glasses, a beard, a cap...). [background, skin, hair colour, hair, clothes, extra] */
const BOT_FACE = {
  haneul: ['#7cc6a8', '#f3c9a8', '#8a6a52', 'wavy', '#3b5d40', 'clip'], marco: ['#f0a37c', '#e8b48f', '#1e1a18', 'curly', '#f4f1ea', ''],
  yuki: ['#b9b4f0', '#f6d2b8', '#15131a', 'blunt', '#2b3a66', ''], camila: ['#f2c14e', '#b97d55', '#1e1612', 'curly', '#3f5f8c', 'bandana'],
  luiza: ['#7fd0a0', '#c98d62', '#9a6a3a', 'long', '#e3b320', ''], linh: ['#f2a6b8', '#f1c8a6', '#141216', 'pony', '#efe4cc', ''],
  sofia: ['#8ec5e8', '#e2b38e', '#2a1d16', 'crown', '#2c3e5c', ''], sean: ['#8fbf6a', '#f2c6a5', '#b5562a', 'short', '#7a5a3a', 'cap beard'],
  emre: ['#f0c38a', '#d9a27a', '#8f8a86', 'short', '#7a2430', 'tache'], nour: ['#e7b26a', '#c88f68', '#1e1612', 'long', '#5b6234', ''],
  femke: ['#7fb2d8', '#f4cdb0', '#d0784a', 'pixie', '#e86a1c', ''], ana: ['#e28a7a', '#ecc09c', '#3a2418', 'low', '#3a3a40', ''],
  priya: ['#c9a0e8', '#b9805a', '#121014', 'bun', '#222222', ''], lea: ['#e6c38a', '#f0c8aa', '#6b3e26', 'wavy', '#8a3a2a', 'beret'],
  jose: ['#f2b65e', '#b07a52', '#151214', 'short', '#2f8f8a', ''], ingrid: ['#9ab0c8', '#f5d6c2', '#dcdde2', 'pony', '#9e2a2a', ''],
  hangyeol: ['#c9b28a', '#dcae8a', '#a9a7a2', 'combed', '#6b4a32', 'glasses'], frederic: ['#b8c4d6', '#e8bc98', '#2a2624', 'slick', '#1f2a44', 'tie'],
  jack: ['#e0a65a', '#f0c7a6', '#c9a35a', 'messy', '#222222', 'bow'], lena: ['#a8d0c0', '#f3cfb6', '#e2c47a', 'bun', '#1e1e1e', 'glasses'],
  lukas: ['#8a9bb8', '#edc4a3', '#3a2a1e', 'slick', '#1a1a1a', ''],
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
    gb: `<rect width="60" height="40" fill="#012169"/><path d="M0 0L60 40M60 0L0 40" stroke="#fff" stroke-width="8"/><path d="M0 0L60 40M60 0L0 40" stroke="#c8102e" stroke-width="2.6"/><path d="M30 0v40M0 20h60" stroke="#fff" stroke-width="12"/><path d="M30 0v40M0 20h60" stroke="#c8102e" stroke-width="7"/>`,
  };
  const out = {}; for (const k in F) out[k] = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 40">${F[k]}</svg>`);
  return out;
})();
const BOT_COUNTRY = { br: '브라질', gr: '그리스', ie: '아일랜드', eg: '이집트', in: '인도', se: '스웨덴', at: '오스트리아', kr: '대한민국', it: '이탈리아', jp: '일본', co: '콜롬비아', vn: '베트남', tr: '튀르키예', nl: '네덜란드', es: '스페인', fr: '프랑스', ph: '필리핀', be: '벨기에', gb: '영국', de: '독일' };
const botFlag = b => el('img', { class: 'flag', src: BOT_FLAGS[b.from], alt: BOT_COUNTRY[b.from] || '', title: BOT_COUNTRY[b.from] || '' });
const botById = id => BOTS.find(b => b.id === id);
const botTier = b => TIERS[Math.min(TIERS.length - 1, tierOf(b.rating))];
// open: the first two, one whose bot before it is beaten, or one at or under the player's own rating
function botOpen(b) {
  const i = BOTS.indexOf(b), mine = net.me && net.me.dama != null ? net.me.dama : 0;
  return i < 2 || botWon(BOTS[i - 1]) || b.rating <= mine;
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
      el('div', { class: 'bot-nm' }, [el('b', { text: b.name }), botFlag(b)]),
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
      // (the figure a little wider than the place, its face high up; under it the backdrop - its own lower edge is brush strokes)
      const s = Math.min(W * 1.18 / fig.width, H * 0.9 / fig.height), fw = fig.width * s, fh = fig.height * s; g2.drawImage(fig, (W - fw) / 2 - W * 0.04, Math.max(H * 0.03, H - fh - H * 0.2), fw, fh);
    };
    const full = document.createElement('canvas'); full.width = W; full.height = H; paint(full.getContext('2d'));
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
