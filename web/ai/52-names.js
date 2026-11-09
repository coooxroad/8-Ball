  /* Several naming habits, not one adjective/noun generator. Mild profanity is a small authored slice;
     no player text, real account names, or external service is used to generate these identities. */
  function humanName(random) {
    const pick = a => a[Math.min(a.length - 1, Math.floor(random() * a.length))];
    const families = [
      ['민수', '진우', '현이', '준이', '성훈', '지수', '도윤', '수빈', '승호', '정우', '건우', '재영', '상민', '서연', '영수', '동현'],
      ['김과장', '박대리', '막내', '큰형', '동네형', '김사장', '왕초보', '아저씨', '백수', '주인장', '할배', '감독님', '옆집아재', '장선생', '아무개', '행님'],
      ['감자전', '계란말이', '참치김밥', '물냉', '보리차', '고등어', '자전거', '선풍기', '도토리', '빨간양말', '낡은운동화', '고양이', '순대국', '아메리카노', '식빵', '라면국물'],
      ['jhpark', 'minsu', 'seong', 'jinho', 'david', 'hoya', 'kjs', 'yoon', 'june', 'tae', 'woong', 'sskim', 'hoon', 'dong', 'billiard', 'gogogo'],
      ['퇴근하고', '밥먹고', '자기전에', '오늘도', '딱', '마지막으로', '심심해서', '잠깐', '몰래', '퇴근전', '한가해서', '오랜만에'],
      ['두께미스', '키스났네', '한점만', '큐대잡음', '빈쿠션', '쿠션쟁이', '백점도전', '공좀맞자', '다마올리자', '쫑났네', '안돌아', '뽀록입니다', '초크어딨냐', '큐미스', '당구조아', '또짧네'],
      ['ㅅㅂ', '존나', '개같은', '빡친', '망할', '아씨', '젠장', 'ㅗ'],
    ];
    const roll = random();
    let kind = roll < 0.15 ? 0 : roll < 0.28 ? 1 : roll < 0.46 ? 2 : roll < 0.66 ? 3 : roll < 0.80 ? 4 : roll < 0.94 ? 5 : 6;
    let name = pick(families[kind]);
    if (kind === 4) name += pick(['한판', '한큐', '들어옴', '치는중', '연습중', '당구', '두판', '접속']);
    if (kind === 6 && name !== 'ㅗ') name += pick(['또키스', '안맞네', '두께', '큐미스', '또졌네', '당구', '한점만', '쫑']);
    const suffix = kind === 3 ? 0.72 : kind === 0 ? 0.45 : 0.23;
    if (random() < suffix) {
      const num = random() < 0.35 ? pick(['77', '88', '99', '123', '007', '82', '91', '04', '1004']) : String(Math.floor(random() * 1000));
      name += (kind === 3 && random() < 0.25 ? '_' : '') + num;
    } else if (kind === 3 && random() < 0.2) name = 'x' + name + 'x';
    return name.slice(0, 16);
  }

  /* A ranked stand-in's name (owner 11-09: too many alike). The habits Korean players name themselves by, each built from
     parts so the same name comes round rarely - tens of thousands of them - and a few in each habit kept plain, as most
     names are: a given name with an ending (민준이, 준호형), two words (졸린고양이), a billiard boast or confession
     (빈쿠션장인), a romanized handle with a year or a number (minjun_92), a place (부산당구), a line someone typed in a
     hurry (퇴근하고한판), and rarely something rough. The lobby keeps the recent ones and asks again on a repeat
     (server/src/ranked.js standIn). */
  function rankedName(random) {
    const pick = a => a[Math.min(a.length - 1, Math.floor(random() * a.length))];
    const GIVEN = ['민준', '서준', '도윤', '예준', '시우', '하준', '주원', '지호', '지후', '준서', '준우', '현우', '도현', '지훈', '건우', '우진', '선우', '서진', '민재', '현준',
      '연우', '유준', '정우', '승우', '승현', '시윤', '준혁', '은우', '지환', '승민', '지우', '유찬', '민성', '준영', '시후', '진우', '지원', '수호', '재윤', '태윤',
      '성민', '동현', '상우', '영훈', '재민', '태현', '병철', '상훈', '경수', '용준', '창민', '대호', '준기', '동욱', '석진', '형준', '철수', '영철', '광수', '성호'];
    const GIVEN_F = ['서연', '지민', '수아', '하은', '지유', '민서', '윤서', '채원', '다은', '예린', '소율', '지아', '수빈', '은서', '혜진', '유나', '미진', '은영', '현정', '보람'];
    const ADJ = ['졸린', '배고픈', '느린', '말랑한', '바쁜', '심심한', '조용한', '수상한', '귀찮은', '행복한', '착한', '엉뚱한', '용감한', '부지런한', '게으른', '차가운',
      '따뜻한', '작은', '커다란', '동그란', '반짝이는', '시끄러운', '어설픈', '진지한', '멍한', '촉촉한', '바삭한', '매운', '달달한', '짭짤한', '고요한', '외로운',
      '신난', '취한', '깐깐한', '푸른', '빨간', '노란', '하얀', '까만'];
    const NOUN = ['고양이', '판다', '거북이', '두부', '감자', '고등어', '오리', '펭귄', '너구리', '다람쥐', '햄스터', '수달', '곰돌이', '토끼', '여우', '부엉이', '참새',
      '붕어빵', '호떡', '만두', '떡볶이', '김밥', '라면', '식빵', '찐빵', '군고구마', '옥수수', '호빵', '수박', '귤', '복숭아', '자두', '냉면', '칼국수', '순대',
      '양말', '우산', '선풍기', '자전거', '구름', '바람', '소나기', '월요일', '금요일', '새벽', '저녁', '산책', '커피', '보리차', '사이다', '콜라', '아저씨', '삼촌',
      '막내', '사장님', '대리', '과장', '선배', '후배', '형님'];
    const SHOT = ['빈쿠션', '쓰리쿠션', '끌어치기', '밀어치기', '옆돌리기', '뒤돌리기', '앞돌리기', '대회전', '가락', '빗겨치기', '세워치기', '맛세이', '원뱅크', '투뱅크',
      '더블쿠션', '제각돌리기', '횡단샷', '키스샷', '얇게치기', '두껍게', '하이런', '대대', '중대', '사구', '포켓볼', '나인볼', '에이트볼', '큐대', '초크', '당점'];
    const ROLE = ['장인', '왕', '러', '중독', '초보', '고수', '연습생', '빌런', '마스터', '매니아', '꿈나무', '지망생', '전문', '귀신', '바보', '요정', '맨', '킹', '천재', '수집가'];
    const ROMAN = ['minjun', 'seojun', 'doyun', 'jiho', 'junseo', 'hyunwoo', 'jihoon', 'gunwoo', 'woojin', 'minjae', 'jungwoo', 'seungmin', 'jinwoo', 'sungmin', 'donghyun',
      'jaemin', 'taehyun', 'sangwoo', 'seoyeon', 'jimin', 'suah', 'haeun', 'minseo', 'yuna', 'hyejin', 'kim', 'park', 'lee', 'choi', 'jung', 'kang', 'cho', 'yoon',
      'jang', 'lim', 'han', 'shin', 'seo', 'kwon', 'hwang', 'ahn', 'song', 'ryu', 'hong'];
    const ENG = ['lazy', 'blue', 'red', 'slow', 'happy', 'sleepy', 'lucky', 'silent', 'crazy', 'tiny', 'big', 'cool', 'hungry', 'night', 'sunday', 'monday', 'rainy', 'mint',
      'soft', 'wild'];
    const ENGN = ['cat', 'cue', 'shot', 'ball', 'panda', 'tiger', 'fox', 'bear', 'owl', 'duck', 'rabbit', 'bank', 'break', 'spin', 'chalk', 'cushion', 'rail', 'pocket',
      'player', 'hunter', 'walker', 'runner', 'dream', 'moon', 'star', 'coffee', 'toast', 'noodle'];
    const PLACE = ['부산', '대구', '인천', '광주', '대전', '울산', '수원', '성남', '고양', '용인', '부천', '안산', '전주', '청주', '천안', '창원', '포항', '제주', '강릉', '춘천',
      '신림', '강남', '홍대', '건대', '노원', '잠실', '목동', '일산', '분당', '마포', '종로', '동탄', '영등포', '서면', '해운대', '동성로'];
    const PLACE_END = ['당구', '사나이', '큐대', '당구장', '고수', '불주먹', '빈쿠션', '토박이', '총각', '아재', '왕', '파', '짱'];
    const WHEN = ['퇴근하고', '점심먹고', '자기전에', '출근전', '주말에', '월급날', '비오는날', '야근끝', '새벽에', '오늘도', '심심해서', '오랜만에', '몰래', '딱', '마지막'];
    const ACT = ['한판', '한큐', '당구', '두판', '연습중', '치는중', '한게임', '한점만', '복수전', '접속', '쓰리쿠션', '한잔'];
    const ROUGH_A = ['아씨', '아오', '아놔', '젠장', '에이', '헐', '하', '으악'], ROUGH_B = ['또키스', '두께뭐냐', '짧다', '빈쿠션', '쫑', '한점만', '또졌네', '왜안맞아', '큐미스', '길다'];
    const num = () => { const r = random(); return r < 0.3 ? String(80 + Math.floor(random() * 26)).slice(-2).padStart(2, '0') : r < 0.5 ? pick(['7', '77', '88', '99', '123', '1004', '486', '1', '2', '3']) : String(Math.floor(random() * (r < 0.8 ? 100 : 10000))); };
    const f = random();
    let name;
    if (f < 0.02) name = pick(ROUGH_A) + pick(ROUGH_B);
    else if (f < 0.20) {
      const fem = random() < 0.25, g = pick(fem ? GIVEN_F : GIVEN);
      // ('이' only after a closed syllable: 민준이, not 준우이)
      const end = pick(fem ? ['', '이', '짱', '언니', '누나', '님', '맘', '쓰'] : ['', '이', '형', '쓰', '짱', '님', '아빠', '삼촌', '오빠', '킹', '군']), last = g.charCodeAt(g.length - 1) - 0xac00;
      name = g + (end === '이' && last % 28 === 0 ? '' : end);
      if (random() < 0.45) name += num();
    }
    else if (f < 0.40) { name = pick(ADJ) + pick(NOUN); if (random() < 0.15) name += num(); }
    else if (f < 0.54) { name = pick(SHOT) + pick(ROLE); if (random() < 0.2) name += num(); }
    else if (f < 0.74) {
      const a = random() < 0.55 ? pick(ROMAN) : pick(ENG) + (random() < 0.4 ? '_' : '') + pick(ENGN), sep = random() < 0.25 ? '_' : random() < 0.1 ? '.' : '';
      name = random() < 0.85 ? a + sep + num() : a; if (random() < 0.12) name = name[0].toUpperCase() + name.slice(1);
    }
    else if (f < 0.86) { name = pick(PLACE) + pick(PLACE_END); if (random() < 0.25) name += num(); }
    else { name = pick(WHEN) + pick(ACT); if (random() < 0.1) name += num(); }
    return name.slice(0, 16);
  }
