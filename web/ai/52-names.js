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

  function rankedName(random) {
    const pick = a => a[Math.floor(random() * a.length)];
    const family = random();
    if (family < 0.05) return pick(['아씨또키스', '개똥두께', '젠장짧다', '아놔', 'ㅅㅂ한점만', '또졌네진짜']);
    if (family < 0.24) return pick(['정면만봄', '중대단골', '얇게한번', '백점언저리', '키스전문', '오늘도쫑', '초크주세요', '큐찾는중', '대대연습중', '한큐만더', '장쿠션옆자리', '당구치는삼촌', '빈쿠션빌런', '노랑먼저', '좀만길게', '후루꾸']);
    if (family < 0.43) return pick(['동네오리', '찬물', '미지근', '연두부', '회색고양이', '대충감자', '낮잠중', '춘식', '먼지', '바삭한빵', '오후반차', '비오는수요일', '퇴근십분전', '저녁먹고옴', '삼분카레', '물많이']);
    const account = family < 0.69;
    const stem = account
      ? pick(['juno', 'hyunw', 'mink', 'oneroom', 'doodoo', 'slowcue', 'dskim', 'west9', 'rimshot', 'yoons', 'turnleft', 'softbreak', 'mintcho', 'sundayb'])
      : pick(['박대리', '창수', '지훈이', '강프로', '호야', '권형', '한부장', '민재', '김씨', '유진', '동팔이', '정우', '남코치', '이선생', '해원이', '최사장']);
    if (random() >= (account ? 0.68 : 0.47)) return stem;
    const suffix = random() < 0.4 ? pick(['07', '12', '23', '86', '92', '03', '77', '88', '1004']) : Math.floor(random() * 1000);
    return stem + (account && random() < 0.2 ? '_' : '') + suffix;
  }
