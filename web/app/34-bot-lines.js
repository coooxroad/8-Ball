/* What the bots say at the table (owner 11-16: in 컴퓨터 대전 the bot talks in a speech bubble on its turns, in its own
   language, the Korean under it in a near-black grey). Written here beforehand - never made up at the table, so the
   foreign words are right - each line [its own words, the Korean] (a Korean bot's lines have no second).
   BOT_LINES[id][stage][moment]: stage 0 is how a bot talks to someone it has just met; later stages (how it talks once it
   knows the player better) go beside it as 1, 2, … and fall back to 0 where they have no line (botLines, 34-desk-bots.js).
   The moments: hello (the game begins), think (before its own shot, now and then), score (it scored), miss (it missed),
   nice (the player's good shot), oops (the player missed or fouled), win, lose (the game is over); and by the review's
   grade of the player's shot (BOT_REACT, below): wow, lucky, gift. A line is said at most once a game (botTalk.line). */
const BOT_LINES = {
  sua: { 0: {
    hello: [['안녕하세요! 동아리 선배들 말고 다른 사람이랑은 처음이에요.']],
    think: [['브리지 단단히… 어깨 힘 빼고…'], ['이거 선배가 알려 준 건데…']],
    score: [['어, 들어갔다! 방금 거 봤어요?'], ['오늘 연습한 보람이 있네요!']],
    miss: [['으앗, 큐가 미끄러졌어요.'], ['초크를 안 칠했나 봐요…']],
    nice: [['와, 그거 어떻게 쳤어요?'], ['방금 거 동아리 단톡에 자랑해도 돼요?']],
    oops: [['괜찮아요, 저도 맨날 그래요!'], ['어, 제 차례인가요?']],
    win: [['이겼다! 동아리 가서 자랑해야지!']],
    lose: [['다음엔 꼭 이길 거예요. 연습하고 올게요!']] } },
  marco: { 0: {
    hello: [['Ciao! Scusa, sono un po’ agitato…', '안녕하세요! 미안해요, 좀 떨려서…']],
    think: [['Calma, Marco. Respira.', '진정해, 마르코. 숨 쉬어.'], ['Piano piano…', '천천히, 천천히…']],
    score: [['È entrata? Davvero?', '들어갔어요? 진짜로?'], ['Mamma mia, ce l’ho fatta!', '맘마미아, 해냈어요!']],
    miss: [['Scusa, scusa!', '미안해요, 미안해요!'], ['Troppo forte… come il sale nella pasta.', '너무 셌어요… 파스타에 소금 넣듯이.']],
    nice: [['Bellissimo colpo!', '정말 멋진 샷이에요!'], ['Come hai fatto?', '어떻게 한 거예요?']],
    oops: [['Capita a tutti, tranquillo.', '누구나 그래요, 괜찮아요.'], ['Oh, tocca a me…', '아, 제 차례네요…']],
    win: [['Ho vinto io? Non ci credo!', '제가 이긴 거예요? 믿을 수가 없어요!']],
    lose: [['Bravo! Ti preparo un piatto di pasta.', '잘했어요! 파스타 한 접시 만들어 줄게요.']] } },
  yuki: { 0: {
    hello: [['よろしくお願いします。', '잘 부탁드립니다.']],
    think: [['一球一球、丁寧に。', '한 공 한 공, 정성껏.'], ['押し球で、まっすぐ…', '밀어치기로, 똑바로…']],
    score: [['よし。', '좋아.'], ['練習どおりです。', '연습한 대로예요.']],
    miss: [['あ…すみません、力みました。', '아… 죄송해요, 힘이 들어갔어요.'], ['まだまだですね。', '아직 멀었네요.']],
    nice: [['今の、きれいでした。', '방금 거, 예뻤어요.'], ['すごい…勉強になります。', '대단해요… 공부가 돼요.']],
    oops: [['ドンマイです。', '괜찮아요, 신경 쓰지 마세요.'], ['チャンス、いただきます。', '기회, 받을게요.']],
    win: [['ありがとうございました。いい試合でした。', '감사합니다. 좋은 경기였어요.']],
    lose: [['参りました。また教えてください。', '졌습니다. 또 가르쳐 주세요.']] } },
  luiza: { 0: {
    hello: [['Oi! Vamos jogar devagarinho?', '안녕! 천천히 쳐 볼까?']],
    think: [['No ritmo… um, dois…', '리듬 타고… 하나, 둘…'], ['Essa bola tá pedindo carinho.', '이 공은 살살 쳐 달라네.']],
    score: [['Que gostoso!', '기분 좋다!'], ['Viu? Bossa nova.', '봤지? 보사노바야.']],
    miss: [['Ai, desafinei.', '앗, 음이 틀렸네.'], ['Tudo bem, a música continua.', '괜찮아, 음악은 계속되니까.']],
    nice: [['Que lindo!', '예쁘다!'], ['Você tem suingue!', '너 리듬감 있다!']],
    oops: [['Relaxa, respira.', '긴장 풀고, 숨 쉬어.'], ['Minha vez, então.', '그럼 내 차례.']],
    win: [['Ganhei! Fica pro próximo show?', '이겼다! 다음 공연도 보고 갈래?']],
    lose: [['Você joga bonito. Gostei.', '너 예쁘게 치더라. 좋았어.']] } },
  ploy: { 0: {
    hello: [['สวัสดีค่ะ! เล่นสนุก ๆ นะคะ', '안녕하세요! 재밌게 쳐요!']],
    think: [['ลูกนี้หวานเหมือนมาการอง…', '이 공은 마카롱처럼 달콤할 거야…'], ['ตามไปเบา ๆ นะ…', '살살 밀어서…']],
    score: [['เย้! ลงแล้ว!', '야호! 들어갔다!'], ['น่ารักไหมล่ะ?', '귀엽지?']],
    miss: [['อุ๊ย! พลาดซะแล้ว', '앗! 놓쳤다'], ['ไม่เป็นไร ลองใหม่', '괜찮아, 다시 해 보자']],
    nice: [['ว้าว เก่งมากเลย!', '와, 정말 잘한다!'], ['สอนหน่อยสิคะ', '나도 좀 가르쳐 줘요']],
    oops: [['ไม่เป็นไรนะคะ กินขนมก่อนไหม', '괜찮아요, 디저트 먼저 드실래요?'], ['ตาฉันแล้ว!', '이제 내 차례!']],
    win: [['ชนะแล้ว! เลี้ยงขนมเลย!', '이겼다! 디저트 쏠게요!']],
    lose: [['เก่งจัง ครั้งหน้าเอาคืนนะ', '잘하네요. 다음엔 돌려받을 거예요']] } },
  sofia: { 0: {
    hello: [['Γεια σου! Ας παίξουμε ήρεμα.', '안녕! 차분하게 쳐 보자.']],
    think: [['Σαν το κύμα: ήρεμα, σταθερά.', '파도처럼, 차분하게, 꾸준하게.'], ['Ας δούμε πού θέλει να πάει.', '공이 어디로 가고 싶어 하는지 보자.']],
    score: [['Ωραία. Σαν ήσυχο λιμάνι.', '좋아. 고요한 항구처럼.'], ['Όπως το περίμενα.', '예상한 대로야.']],
    miss: [['Η θάλασσα δεν είναι πάντα ήρεμη.', '바다가 늘 잔잔한 건 아니니까.'], ['Δεν πειράζει.', '괜찮아.']],
    nice: [['Πολύ όμορφο χτύπημα.', '아주 아름다운 샷이야.'], ['Μπράβο σου.', '잘했어.']],
    oops: [['Πάρε μια ανάσα.', '숨 한번 쉬어.'], ['Συμβαίνει και στους καλύτερους.', '최고들한테도 일어나는 일이야.']],
    win: [['Καλό παιχνίδι. Ευχαριστώ.', '좋은 경기였어. 고마워.']],
    lose: [['Συγχαρητήρια, το άξιζες.', '축하해, 이길 만했어.']] } },
  sean: { 0: {
    hello: [['Grand so. Let’s see what you’ve got.', '좋아. 실력 좀 볼까.']],
    think: [['No rush. The pint’s not going anywhere.', '서두를 거 없지. 맥주는 어디 안 가.'], ['Leave him nothing, Seán.', '아무것도 남기지 마, 숀.']],
    score: [['Sure look, that’ll do.', '뭐, 그 정도면 됐지.'], ['Steady as she goes.', '이대로 꾸준히.']],
    miss: [['Ah, feck it.', '아, 젠장.'], ['That’s what I get for showing off.', '잘난 척하다 이렇게 되지.']],
    nice: [['Fair play to you.', '인정할게.'], ['Now that was a cracker.', '방금 건 끝내줬다.']],
    oops: [['Unlucky, that.', '운이 없었네.'], ['I’ll take that, thanks.', '고맙게 받을게.']],
    win: [['Good game. Next round’s on you.', '좋은 경기였어. 다음 잔은 네가 사.']],
    lose: [['You earned that one, fair and square.', '정정당당하게 이겼네.']] } },
  meilin: { 0: {
    hello: [['你好，请多指教。', '안녕하세요, 잘 부탁드려요.']],
    think: [['先看全局，再出杆。', '먼저 전체를 보고, 그다음에 쳐요.'], ['轻一点，再轻一点。', '살살, 조금 더 살살.']],
    score: [['好。', '좋아요.'], ['如行云流水。', '흐르는 구름과 물처럼.']],
    miss: [['可惜。', '아깝네요.'], ['心乱了。', '마음이 흐트러졌어요.']],
    nice: [['漂亮！', '멋져요!'], ['这一杆很优雅。', '이번 샷 정말 우아해요.']],
    oops: [['别着急。', '서두르지 마요.'], ['谢谢，轮到我了。', '고마워요, 제 차례네요.']],
    win: [['承让了。', '양보해 주셔서 고마워요.']],
    lose: [['你赢了，佩服。', '당신이 이겼어요, 존경해요.']] } },
  emre: { 0: {
    hello: [['Hoş geldin. Önce bir çay?', '어서 와요. 먼저 차 한잔할래요?']],
    think: [['Acele işe şeytan karışır.', '서두르면 일을 그르쳐요.'], ['Toplar birbirine yaklaşsın…', '공들이 서로 가까워지도록…']],
    score: [['Maşallah.', '좋네요.'], ['İşte böyle, yavaş yavaş.', '이렇게, 천천히.']],
    miss: [['Olsun, çay soğumadı daha.', '괜찮아요, 차는 아직 안 식었어요.'], ['Hmm… biraz kalın geldi.', '흠… 조금 두꺼웠네요.']],
    nice: [['Eline sağlık!', '솜씨 좋네요!'], ['Güzel vuruş, evlat.', '좋은 샷이에요, 젊은이.']],
    oops: [['Sabır, her şeyin anahtarı.', '인내가 모든 것의 열쇠예요.'], ['Bir yudum çay iç, geçer.', '차 한 모금 마셔요, 괜찮아질 거예요.']],
    win: [['Güzel oyundu. Bir çay daha?', '좋은 경기였어요. 차 한 잔 더?']],
    lose: [['Helal olsun sana.', '당신 정말 잘했어요.']] } },
  darya: { 0: {
    hello: [['Добрый вечер. Начнём?', '안녕하세요. 시작할까요?']],
    think: [['Раз, два, три борта…', '하나, 둘, 세 쿠션…'], ['Сильно и точно.', '세게, 그리고 정확하게.']],
    score: [['Чисто.', '깔끔해요.'], ['Как по нотам.', '악보대로예요.']],
    miss: [['Неточно.', '정확하지 않았어요.'], ['Ещё раз, с начала.', '처음부터 다시.']],
    nice: [['Красиво.', '아름다워요.'], ['Браво.', '브라보.']],
    oops: [['Не спешите.', '서두르지 마세요.'], ['Спасибо. Ошибки не прощаю.', '고마워요. 실수는 봐주지 않아요.']],
    win: [['Спасибо за игру.', '경기 고마웠어요.']],
    lose: [['Вы были сильнее. Поздравляю.', '당신이 더 강했어요. 축하해요.']] } },
  femke: { 0: {
    hello: [['Kom op, niet treuzelen.', '자, 꾸물대지 말고.']],
    think: [['Via de band. Altijd via de band.', '쿠션으로. 언제나 쿠션으로.'], ['Dit duurt te lang.', '이거 너무 오래 걸리네.']],
    score: [['Zo. Volgende.', '됐어. 다음.'], ['Recht in de roos.', '정확히 명중.']],
    miss: [['Verdorie!', '젠장!'], ['Te hard. Weer te hard.', '너무 셌어. 또 너무 셌어.']],
    nice: [['Niet slecht, hoor.', '나쁘지 않네.'], ['Oké, die was goed.', '좋아, 그건 잘 쳤어.']],
    oops: [['Jammer. Mijn beurt.', '아깝네. 내 차례.'], ['Opschieten maar.', '얼른 해.']],
    win: [['Gewonnen. Tijd voor koffie.', '이겼다. 커피 마실 시간.']],
    lose: [['Goed gespeeld. Volgende keer ik.', '잘 쳤어. 다음엔 내가 이긴다.']] } },
  ana: { 0: {
    hello: [['Hola. Que empiece el compás.', '안녕하세요. 박자를 시작해요.']],
    think: [['Un, dos, tres… y la siguiente.', '하나, 둘, 셋… 그리고 다음 공.'], ['Con elegancia.', '우아하게.']],
    score: [['¡Olé!', '올레!'], ['Justo a tiempo.', '박자에 딱 맞았어요.']],
    miss: [['Perdí el compás.', '박자를 놓쳤네요.'], ['Otra vez, con más calma.', '다시, 더 차분하게.']],
    nice: [['¡Qué arte!', '정말 예술이네요!'], ['Muy elegante.', '아주 우아해요.']],
    oops: [['Tranquila, respira.', '진정해요, 숨 쉬어요.'], ['Gracias, la aprovecho.', '고마워요, 잘 쓸게요.']],
    win: [['Buen partido. Ha sido un placer.', '좋은 경기였어요. 즐거웠어요.']],
    lose: [['Enhorabuena. Bailaste mejor.', '축하해요. 당신이 더 잘 췄어요.']] } },
  lea: { 0: {
    hello: [['Bonjour ! On joue un chapitre ensemble ?', '안녕! 우리 같이 한 장(章) 쳐 볼까?']],
    think: [['Une courbe, comme une phrase bien tournée…', '곡선, 잘 다듬은 문장처럼…'], ['Et si je la faisais tourner ?', '이걸 휘게 쳐 볼까?']],
    score: [['Voilà, c’est de la poésie.', '봐, 이게 시야.'], ['Joli, non ?', '예쁘지, 그치?']],
    miss: [['Oups, une faute de frappe.', '앗, 오타 났다.'], ['Bon, on réécrit.', '좋아, 다시 쓰자.']],
    nice: [['Magnifique !', '멋져!'], ['Ça, c’était élégant.', '그건 우아했어.']],
    oops: [['Pas grave, ça arrive.', '괜찮아, 그럴 수 있어.'], ['Merci pour la page blanche.', '빈 페이지 고마워.']],
    win: [['Fin du chapitre. Merci !', '이번 장은 여기까지. 고마워!']],
    lose: [['Bravo, tu as écrit la meilleure fin.', '잘했어, 네가 더 좋은 결말을 썼네.']] } },
  migo: { 0: {
    hello: [['Kuya! Ate! Laro tayo!', '형! 누나! 같이 치자!']],
    think: [['Madali lang ’to.', '이거 쉬운데.'], ['Teka, teka… ayan!', '잠깐, 잠깐… 됐다!']],
    score: [['Yes! Galing ko ’no?', '예스! 나 잘하지?'], ['Pasok!', '들어갔다!']],
    miss: [['Ay! Hindi ko ’yon sinadya!', '앗! 일부러 그런 거 아니야!'], ['Sabi ni Papa, focus daw.', '아빠가 집중하랬는데.']],
    nice: [['Wow, ang galing mo!', '와, 진짜 잘한다!'], ['Turuan mo ako niyan!', '그거 나도 알려 줘!']],
    oops: [['Okay lang ’yan!', '괜찮아요!'], ['Ako na! Ako na!', '내 차례! 내 차례!']],
    win: [['Panalo ako! Isa pa?', '내가 이겼다! 한 판 더?']],
    lose: [['Ang galing mo talaga. Isa pa, please!', '진짜 잘하네요. 한 판만 더요!']] } },
  ingrid: { 0: {
    hello: [['Hej. Kör vi?', '안녕. 시작할까?']],
    think: [['Lite skruv… och tryck.', '회전 조금… 그리고 밀고.'], ['Den här blir snygg.', '이건 멋지게 들어갈 거야.']],
    score: [['Lätt som en plätt.', '팬케이크처럼 가볍지.'], ['Snyggt, eller hur?', '멋지지, 그치?']],
    miss: [['Typiskt.', '역시 그렇지.'], ['Äsch, tuggummit tog slut.', '에이, 껌이 다 떨어졌잖아.']],
    nice: [['Okej, den var snygg.', '좋아, 그건 멋졌어.'], ['Inte illa alls.', '전혀 나쁘지 않네.']],
    oops: [['Synd för dig.', '아쉽게 됐네.'], ['Synd. Tuggummit smakar bättre nu.', '아쉽네. 이제 껌 맛이 더 좋아졌어.']],
    win: [['GG. Fika?', '잘 쳤어. 커피 한잔?']],
    lose: [['Bra spelat. Nästa gång blir det jag.', '잘 쳤어. 다음엔 내가 이겨.']] } },
  ole: { 0: {
    hello: [['Hei. Vi tar det med ro.', '안녕. 천천히 하자고.']],
    think: [['Som å vente på riktig bølge.', '맞는 파도를 기다리듯이.'], ['…', '…']],
    score: [['Fint. Rett i garnet.', '좋아. 그물에 쏙.'], ['Rolig og stødig.', '차분하고 꾸준하게.']],
    miss: [['Uff. Garnet røk.', '이런. 그물이 찢어졌네.'], ['Vinden snudde.', '바람이 바뀌었군.']],
    nice: [['Godt slag.', '좋은 샷이야.'], ['Det likte jeg.', '그거 마음에 드네.']],
    oops: [['Ikke stress.', '서두르지 마.'], ['Takk skal du ha.', '고맙네.']],
    win: [['Takk for kampen.', '경기 고마웠어.']],
    lose: [['Du var sterkere i dag.', '오늘은 자네가 더 강했어.']] } },
  frederic: { 0: {
    hello: [['Bonsoir. Commençons.', '안녕하십니까. 시작하죠.']],
    think: [['La suivante.', '다음 공.'], ['Le jeu de position, d’abord.', '포지션이 먼저.']],
    score: [['Bien.', '좋습니다.'], ['Comme prévu.', '예정대로.']],
    miss: [['Hm.', '흠.'], ['Une erreur de deux millimètres.', '2밀리미터 오차.']],
    nice: [['Joli coup.', '좋은 샷입니다.'], ['Correct.', '정확하군요.']],
    oops: [['Concentrez-vous.', '집중하세요.'], ['Merci.', '감사합니다.']],
    win: [['Merci pour la partie.', '경기 감사했습니다.']],
    lose: [['Bien joué. Vraiment.', '잘 치셨습니다. 진심으로.']] } },
  jack: { 0: {
    hello: [['Right then, let’s give ’em a show!', '좋아, 관객들한테 쇼 좀 보여 주자고!']],
    think: [['Watch this one.', '이거 잘 봐.'], ['The crowd wants something special.', '관객들은 특별한 걸 원하지.']],
    score: [['Lovely jubbly!', '끝내주는군!'], ['Did you see that? Did everyone see that?', '봤어? 다들 봤어?']],
    miss: [['Well, it looked good.', '뭐, 폼은 좋았잖아.'], ['Missed beautifully, mind.', '그래도 멋지게 놓쳤다고.']],
    nice: [['Oh, cheeky!', '오, 제법인데!'], ['Proper shot, that.', '그거 제대로 된 샷이네.']],
    oops: [['Unlucky, mate.', '운이 없었네, 친구.'], ['Cheers for that!', '그거 고마워!']],
    win: [['And the crowd goes wild!', '관중이 열광한다!']],
    lose: [['Fair play. You stole the show.', '인정. 오늘 쇼의 주인공은 너야.']] } },
  lena: { 0: {
    hello: [['Guten Tag. Ich hoffe, Sie sind pünktlich im Kopf.', '안녕하세요. 머릿속 시계도 정확하길 바라요.']],
    think: [['Winkel prüfen. Noch einmal.', '각도 확인. 한 번 더.'], ['Präzision ist Gewohnheit.', '정확함은 습관이에요.']],
    score: [['Exakt.', '정확해요.'], ['Wie ein Uhrwerk.', '시계 장치처럼.']],
    miss: [['Null Komma zwei Grad zu viel.', '0.2도 더 갔네요.'], ['Ärgerlich.', '짜증 나네요.']],
    nice: [['Sehr sauber gespielt.', '아주 깔끔하게 쳤네요.'], ['Respekt.', '존경해요.']],
    oops: [['Unpräzise.', '부정확하네요.'], ['Danke. Notiert.', '고마워요. 기록해 뒀어요.']],
    win: [['Ein gutes Spiel. Danke.', '좋은 경기였어요. 고마워요.']],
    lose: [['Gut gemacht. Ich werde es analysieren.', '잘했어요. 분석해 볼게요.']] } },
  elijah: { 0: {
    hello: [['Howdy. Take your time - I’ve got all night.', '안녕. 천천히 해 - 난 밤새 시간 있으니까.']],
    think: [['Already saw this one coming.', '이건 벌써 보였지.'], ['Easy. Too easy.', '쉽네. 너무 쉬워.']],
    score: [['Told ya.', '말했잖아.'], ['Next.', '다음.']],
    miss: [['Huh. Didn’t see that one.', '흠. 그건 못 봤네.'], ['Just keeping it interesting.', '재미있으라고 봐준 거야.']],
    nice: [['Well, look at you.', '이것 봐라.'], ['Now that’s a real shot.', '이제야 진짜 샷이네.']],
    oops: [['Happens to the best of us. Mostly to you.', '누구나 그래. 주로 너지만.'], ['Thanks, partner.', '고마워, 친구.']],
    win: [['Good game. Want a rematch? Speed round?', '좋은 경기였어. 한 판 더? 속기로?']],
    lose: [['Well, I’ll be. You’re the real deal.', '이거 참. 너 진짜구나.']] } },
};
/* (owner 11-17 night) The bot answers the player's shot by the review's grade (botTalk.graded): wow - the player's 예술,
   lucky - a 요행, gift - a 실수. Kept apart and laid into each bot's first stage. */
const BOT_REACT = {
  sua: {
    wow: [['헐, 방금 거 뭐예요? 진짜 예술이다…'], ['선배들한테 영상으로 보여 주고 싶어요!']],
    lucky: [['어? 그게 들어가요? 운 좋다!'], ['그건 노린 거 아니죠? 그쵸?']],
    gift: [['어, 쉬운 공이었는데! 저 기회 받을게요.'], ['괜찮아요, 그럴 때 있어요. 저도 맨날 그래요.']] },
  marco: {
    wow: [['Che spettacolo! Sembra un’opera d’arte.', '이런 장관이! 예술 작품 같아요.'], ['Mamma mia… questo lo racconto a casa.', '맘마미아… 이건 집에 가서 얘기할래요.']],
    lucky: [['Fortunello! Ma conta lo stesso.', '운이 좋네요! 그래도 득점은 득점이죠.'], ['Ehi, la fortuna ti vuole bene oggi.', '어이, 오늘은 행운이 당신 편이네요.']],
    gift: [['Oh… questa era facile, no?', '어… 이건 쉬운 거였죠?'], ['Grazie, me la servi come un antipasto!', '고마워요, 전채 요리처럼 차려 주시네요!']] },
  yuki: {
    wow: [['…芸術ですね。言葉が出ません。', '…예술이네요. 말이 안 나와요.'], ['今の、録画しておけばよかった。', '방금 거, 녹화해 둘 걸 그랬어요.']],
    lucky: [['運も実力のうち、ですね。', '운도 실력이라고들 하죠.'], ['今のは…狙っていましたか？', '방금 건… 노린 거였나요?']],
    gift: [['あ、もったいない。', '아, 아깝다.'], ['今のは、入れたかったですよね。', '방금 건, 넣고 싶으셨죠.']] },
  luiza: {
    wow: [['Que tacada linda! Parece música.', '너무 예쁜 샷이야! 음악 같아.'], ['Uau… arrepiei.', '와… 소름 돋았어.']],
    lucky: [['Sortudo! Mas eu gostei.', '운 좋네! 그래도 마음에 들어.'], ['Essa foi sorte, hein?', '그건 운이었지, 그치?']],
    gift: [['Ih, desafinou feio.', '이런, 음이 크게 틀렸네.'], ['Obrigada pela chance!', '기회 줘서 고마워!']] },
  ploy: {
    wow: [['สวยมาก! อย่างกับงานศิลปะเลย', '너무 예뻐! 예술 작품 같아.'], ['ว้าว อย่างกับลายครีมบนเค้กเลย', '와, 케이크 위 크림 장식 같아.']],
    lucky: [['โชคดีจัง! ได้ไปฟรีๆ เลย', '운 좋다! 공짜로 들어갔네.'], ['อันนั้นฟลุคใช่มั้ย', '그거 플루크지?']],
    gift: [['อ้าว! ลูกง่ายๆ เองนะ', '어머! 쉬운 공이었는데.'], ['ขอบคุณนะ เดี๋ยวเลี้ยงขนมตอบแทน', '고마워요, 답례로 디저트 쏠게요.']] },
  sofia: {
    wow: [['Υπέροχο! Σαν ζωγραφιά.', '훌륭해요! 그림 같아요.'], ['Σαν δελφίνι που πηδάει πάνω από το κύμα.', '파도 위로 뛰어오르는 돌고래 같았어요.']],
    lucky: [['Τυχερός! Η θάλασσα σε βοήθησε.', '운이 좋네요! 바다가 도와줬나 봐요.'], ['Αυτό ήταν τύχη, ε;', '그건 운이었죠?']],
    gift: [['Ωχ, αυτή ήταν εύκολη.', '어머, 그건 쉬운 거였는데.'], ['Ευχαριστώ για την ευκαιρία.', '기회 고마워요.']] },
  sean: {
    wow: [['Ah, that’s pure art, so it is.', '아, 그거 진짜 예술이네.'], ['I’d buy you a pint for that one.', '그 샷이면 맥주 한 잔 사야겠는걸.']],
    lucky: [['The luck of the Irish, and you’re not even Irish.', '아일랜드 사람의 행운이네, 아일랜드 사람도 아니면서.'], ['Jammy. Fair play, though.', '운빨이네. 그래도 인정.']],
    gift: [['Ah, you left that one for me.', '아, 그건 나 먹으라고 남겨 줬구나.'], ['Easy one, that. Thanks a million.', '쉬운 공이었는데. 정말 고마워.']] },
  meilin: {
    wow: [['太美了，像一支舞。', '너무 아름다워요, 춤 같아요.'], ['这一杆，是艺术。', '이 한 샷은 예술이에요.']],
    lucky: [['运气不错嘛。', '운이 좋네요.'], ['这个是蒙的吧？', '이건 얻어걸린 거죠?']],
    gift: [['哎呀，可惜了。', '어머, 아깝네요.'], ['谢谢你送的机会。', '기회 줘서 고마워요.']] },
  emre: {
    wow: [['Maşallah! Sanat eseri gibi.', '마샬라! 예술 작품 같아요.'], ['Bu vuruşa bir çay ısmarlarım.', '이 샷엔 차 한 잔 대접해야겠네요.']],
    lucky: [['Şanslısın bugün!', '오늘 운이 좋네요!'], ['Bu biraz şanstı, değil mi?', '이건 좀 운이었죠?']],
    gift: [['Eyvah, kolay topu kaçırdın.', '이런, 쉬운 공을 놓쳤네요.'], ['Sağ ol evlat. Şimdi izle.', '고마워요, 젊은이. 이제 잘 봐요.']] },
  darya: {
    wow: [['Браво. Это было красиво.', '브라보. 아름다웠어요.'], ['Такое и в Москве не каждый день увидишь.', '이런 건 모스크바에서도 매일 못 봐요.']],
    lucky: [['Повезло. Но я запомню.', '운이 좋았네요. 하지만 기억해 둘게요.'], ['Это было везение, а не расчёт.', '그건 계산이 아니라 운이었어요.']],
    gift: [['Такой шар нельзя промахивать.', '그런 공은 놓치면 안 돼요.'], ['Спасибо. Я не упущу.', '고마워요. 놓치지 않을게요.']] },
  femke: {
    wow: [['Wauw, dat was kunst!', '와, 그건 예술이었어!'], ['Die moet ik onthouden.', '그건 기억해 둬야겠다.']],
    lucky: [['Geluksvogel!', '운 좋은 녀석!'], ['Die was mazzel, geef het maar toe.', '그건 운이었어, 인정해.']],
    gift: [['Hè, die lag er gewoon voor!', '어, 그건 그냥 앞에 놓여 있었잖아!'], ['Dank je, snel door.', '고마워, 빨리 칠게.']] },
  ana: {
    wow: [['¡Olé! Eso fue arte puro.', '올레! 그건 순수한 예술이었어요.'], ['Qué belleza… me has dejado sin compás.', '아름다워요… 박자를 잃어버렸어요.']],
    lucky: [['¡Qué suerte tienes hoy!', '오늘 운이 정말 좋네요!'], ['Esa entró de milagro.', '그건 기적처럼 들어갔네요.']],
    gift: [['Ay, esa era fácil.', '아, 그건 쉬운 거였는데.'], ['Gracias, esa me la llevo bailando.', '고마워요, 그건 춤추며 가져갈게요.']] },
  lea: {
    wow: [['Magnifique. C’est de la poésie.', '멋져요. 그건 시예요.'], ['Ça mériterait un sonnet.', '그건 소네트 한 편감이에요.']],
    lucky: [['Quelle chance !', '운도 좋네요!'], ['Celle-là, c’était un coup de pot.', '그건 순전히 운이었어요.']],
    gift: [['Oh… celle-là était facile.', '어… 그건 쉬운 거였는데.'], ['Merci pour le cadeau.', '선물 고마워요.']] },
  migo: {
    wow: [['Grabe! Ang galing mo!', '대박! 진짜 잘한다!'], ['Turuan mo ako niyan!', '그거 나도 가르쳐 줘요!']],
    lucky: [['Swerte! Tsamba lang ’yan!', '운 좋다! 그건 그냥 얻어걸린 거예요!'], ['Ay, pumasok pa!', '헐, 그게 들어가네!']],
    gift: [['Yes! Akin na ang mesa!', '앗싸! 이제 테이블은 내 거!'], ['Madali lang ’yon, ah!', '그거 쉬운 거였는데!']] },
  ingrid: {
    wow: [['Snyggt. Riktigt snyggt.', '멋지다. 진짜 멋지다.'], ['Det där var konst.', '그건 예술이었어.']],
    lucky: [['Tur. Ren tur.', '운. 순전히 운.'], ['Den var inte planerad, va?', '그거 계획한 거 아니지?']],
    gift: [['Den var enkel.', '그건 쉬운 거였어.'], ['Tack. Jag tar den.', '고마워. 내가 가져갈게.']] },
  ole: {
    wow: [['Det der var vakkert.', '그거 아름다웠어요.'], ['Sånt ser man sjelden, selv i Bergen.', '그런 건 베르겐에서도 보기 드물어요.']],
    lucky: [['Flaks. Men flaks teller også.', '운이네요. 하지만 운도 쳐주죠.'], ['Havet var snilt med deg der.', '바다가 그때 당신한테 친절했네요.']],
    gift: [['Den slapp du ut av garnet.', '그건 그물에서 놓쳤네요.'], ['Takk. Jeg tar over.', '고마워요. 제가 이어받을게요.']] },
  frederic: {
    wow: [['Superbe. Rien à redire.', '훌륭해요. 할 말이 없네요.'], ['Ça, c’est du grand billard.', '이게 바로 큰 당구죠.']],
    lucky: [['Chanceux.', '운이 좋군요.'], ['Le billard pardonne parfois.', '당구는 가끔 봐주기도 하죠.']],
    gift: [['Une faute de concentration.', '집중력 실수군요.'], ['Merci. À moi.', '고마워요. 제 차례.']] },
  jack: {
    wow: [['Now THAT is how you play to a crowd!', '바로 그거지, 관중 앞에서 그렇게 치는 거야!'], ['Shot of the night, mate.', '오늘 밤 최고의 샷이야, 친구.']],
    lucky: [['Cheeky! Didn’t mean that, did you?', '얌체네! 그거 노린 거 아니지?'], ['Fluke! Still counts, sadly.', '플루크! 아쉽게도 그래도 인정이야.']],
    gift: [['Oh dear. The crowd felt that one.', '이런. 관중도 그건 느꼈을 거야.'], ['Cheers for the open table!', '테이블 열어 줘서 고마워!']] },
  lena: {
    wow: [['Präzise. Und schön. Selten beides.', '정확하고, 아름다워요. 둘 다인 건 드물죠.'], ['Das war Kunst.', '그건 예술이었어요.']],
    lucky: [['Glück gehabt.', '운이 좋았네요.'], ['Das war kein Plan, das war Glück.', '그건 계획이 아니라 운이었어요.']],
    gift: [['Den hätten Sie treffen müssen.', '그건 넣었어야 했어요.'], ['Danke. Ich übernehme.', '고마워요. 제가 이어받죠.']] },
  elijah: {
    wow: [['Okay, okay. I’ll give you that one.', '그래, 그래. 그건 인정해 줄게.'], ['Huh. Didn’t see that coming. Nice.', '흠. 그건 예상 못 했네. 멋져.']],
    lucky: [['Lucky. Don’t get used to it.', '운이야. 익숙해지지 마.'], ['The table likes you today, partner.', '오늘은 테이블이 널 좋아하나 봐, 친구.']],
    gift: [['Thanks, partner. I’ll take it from here.', '고마워, 친구. 여기서부턴 내가 할게.'], ['That one was a gimme.', '그건 거저먹는 공이었는데.']] },
};
for (const id in BOT_REACT) if (BOT_LINES[id]) Object.assign(BOT_LINES[id][0], BOT_REACT[id]);
/* (11-18 night: one more line each for the moments a game hears most - its own shot coming, made, missed - so that game
   after game a bot is not heard saying the same two things) */
const BOT_MORE = {
  sua: { think: [['오늘은 꼭 한 번은 두 개 연속 넣어 볼래요.']], score: [['저 방금 좀 멋있었죠?']], miss: [['아, 각도를 잘못 봤어요.']] },
  marco: { think: [['Come la nonna: con pazienza.', '할머니처럼, 인내심을 갖고.']], score: [['Perfetto, come un risotto al dente.', '완벽해요, 알덴테 리소토처럼.']], miss: [['Accidenti!', '이런!']] },
  yuki: { think: [['呼吸を整えて…', '숨을 고르고…']], score: [['ふう、入りました。', '휴, 들어갔어요.']], miss: [['集中、集中。', '집중, 집중.']] },
  luiza: { think: [['Devagar se vai ao longe.', '천천히 가면 멀리 가.']], score: [['Isso! Bateu no ritmo.', '바로 그거! 리듬이 맞았어.']], miss: [['Faltou swing.', '스윙이 모자랐네.']] },
  ploy: { think: [['ใจเย็น ๆ นะพลอย', '침착해, 플로이.']], score: [['หวานกว่าเค้กอีก', '케이크보다 달콤하다.']], miss: [['โอ๊ย แรงไปหน่อย', '아이고, 좀 셌네.']] },
  sofia: { think: [['Υπομονή, όπως στη θάλασσα.', '바다에서처럼, 인내.']], score: [['Σαν δελφίνι στο κύμα.', '파도 위 돌고래처럼.']], miss: [['Λίγο πιο λεπτά ήθελε.', '조금 더 얇게 쳤어야 했어요.']] },
  sean: { think: [['Nice and easy now.', '자, 살살.']], score: [['Grand job, so.', '잘했어, 그래.']], miss: [['Ah, that one got away from me.', '아, 그건 빠져나갔네.']] },
  meilin: { think: [['气要沉，手要稳。', '기운은 가라앉히고, 손은 안정되게.']], score: [['恰到好处。', '딱 알맞게.']], miss: [['力道差了一点。', '힘이 조금 모자랐어요.']] },
  emre: { think: [['Bir yudum çay, sonra vuruş.', '차 한 모금, 그다음 샷.']], score: [['Afiyet olsun!', '맛있게 드세요!']], miss: [['Bu sefer olmadı.', '이번엔 안 됐네요.']] },
  darya: { think: [['Траектория ясна.', '궤적은 분명해요.']], score: [['Ожидаемо.', '예상대로예요.']], miss: [['Досадно.', '분하네요.']] },
  femke: { think: [['Kom op, Femke.', '자, 펨케.']], score: [['Hup, erin!', '자, 들어가!']], miss: [['Pff, net niet.', '흠, 아깝게 안 됐네.']] },
  ana: { think: [['Respira… y baila.', '숨 쉬고… 춤추듯이.']], score: [['Como un zapateado.', '사파테아도처럼.']], miss: [['Me salió de compás.', '박자를 놓쳤어요.']] },
  lea: { think: [['Laisse-moi lire la table.', '테이블을 읽어 볼게요.']], score: [['Comme une rime parfaite.', '완벽한 운율처럼.']], miss: [['Un vers raté.', '빗나간 시구네요.']] },
  migo: { think: [['Kaya ko ’to!', '나 할 수 있어!']], score: [['Isa pa! Isa pa!', '하나 더! 하나 더!']], miss: [['Uy, muntik na!', '앗, 아깝다!']] },
  ingrid: { think: [['Skruv åt vänster. Kanske.', '왼쪽 회전. 아마도.']], score: [['Precis som planerat.', '계획대로야.']], miss: [['För mycket skruv.', '회전이 너무 많았어.']] },
  ole: { think: [['Rolig hånd.', '차분한 손.']], score: [['Godt fiske.', '어획 좋네요.']], miss: [['Neste gang.', '다음엔.']] },
  frederic: { think: [['Trois bandes. Pas une de plus.', '쿠션 셋. 하나도 더 말고.']], score: [['Propre.', '깔끔하군요.']], miss: [['Trop d’effet.', '회전이 너무 많았군요.']] },
  jack: { think: [['Drum roll, please.', '북 좀 쳐 줄래?']], score: [['And the crowd goes wild!', '관중이 열광합니다!']], miss: [['That was for the cameras.', '그건 카메라용이었어.']] },
  lena: { think: [['Erst denken, dann stoßen.', '먼저 생각하고, 그다음 친다.']], score: [['Wie berechnet.', '계산대로예요.']], miss: [['Unpräzise.', '부정확했어요.']] },
  elijah: { think: [['Let me show you how it’s done.', '어떻게 하는 건지 보여 줄게.']], score: [['Like taking candy from a baby.', '애한테서 사탕 뺏기네.']], miss: [['Table’s a little crooked, partner.', '테이블이 좀 삐뚤어졌나 봐, 친구.']] },
};
for (const id in BOT_MORE) if (BOT_LINES[id]) for (const m in BOT_MORE[id]) BOT_LINES[id][0][m] = (BOT_LINES[id][0][m] || []).concat(BOT_MORE[id][m]);
/* (owner 11-19 night: 'it's all too alike' - "식은 죽 먹기" and the rest) Two more ways each to begin, and seven lines that
   answer the game as it stands rather than the shot alone - as Valve's dynamic dialog picks the line that fits the most of
   the world's state over a plain one (Ruskin, GDC 2012), and Chessiverse's bots speak from how they think the game is
   going. The moments (botTalk.context, 34-desk-bots.js, picks them in place of a plainer one when they fit):
     streak - its third (or more) in a row        close - one ball or point from winning
     behind - well behind                          ahead - well ahead
     trick  - before its own massé or jump         safety - after its own safety
     banter - a word about its own life, now and then before a shot */
const BOT_CONTEXT = {
  sua: {
    hello: [['저 오늘 큐 케이스 처음 샀어요! 개시하는 날이에요.'], ['살살 해 주세요… 아, 아니다, 봐주지 마세요!']],
    streak: [['세 개 연속이라니, 이거 꿈 아니죠?']], close: [['한 개만 더… 손이 떨려요.']],
    behind: [['아직 안 끝났어요! 선배가 끝날 때까지 모르는 거랬어요.']], ahead: [['제가 이기고 있는 거 맞죠? 사진 찍어 둘래요.']],
    trick: [['유튜브에서 본 거 해 볼게요. 큐 세우고…']], safety: [['선배가 못 넣겠으면 숨기라고 했어요.']],
    banter: [['시험 기간인데 여기 와 있는 거 비밀이에요.']] },
  marco: {
    hello: [['Prima di cominciare… posso lavarmi le mani? Ho appena impastato.', '시작하기 전에… 손 좀 씻어도 돼요? 방금 반죽했거든요.'], ['Oggi niente tremarella, promesso.', '오늘은 안 떨게요, 약속해요.']],
    streak: [['Tre di fila! Devo chiamare la mamma.', '세 개 연속! 엄마한테 전화해야겠어요.']], close: [['Ultima palla… come l’ultimo minuto in forno.', '마지막 공… 오븐의 마지막 1분처럼.']],
    behind: [['La pasta si scuoce, ma io non mollo.', '파스타는 퍼져도, 저는 포기 안 해요.']], ahead: [['Sto vincendo? Non guardo il punteggio, porta sfortuna.', '제가 이기고 있어요? 점수는 안 볼래요, 부정 타요.']],
    trick: [['Proviamo il colpo a effetto… speriamo bene.', '휘는 샷 해 볼게요… 잘되길.']], safety: [['La nascondo dietro, come il tiramisù in frigo.', '뒤에 숨겨 둘게요, 냉장고 속 티라미수처럼.']],
    banter: [['Stasera provo a fare le orecchiette. Tu cucini?', '오늘 밤엔 오레키에테 만들어 볼 거예요. 요리해요?']] },
  yuki: {
    hello: [['父の店の常連さんみたいに、静かに打ちますね。', '아버지 가게 단골손님들처럼 조용히 칠게요.'], ['今日も押し球、練習してきました。', '오늘도 밀어치기 연습하고 왔어요.']],
    streak: [['三つ続けて…いい流れです。', '세 개 연속… 좋은 흐름이에요.']], close: [['あと一つ。いつも通りに。', '하나 남았어요. 평소처럼.']],
    behind: [['焦らない。一球ずつ取り返します。', '서두르지 않아요. 한 공씩 되찾을게요.']], ahead: [['油断はしません。', '방심하지 않을게요.']],
    trick: [['キューを立てます…父に見られたら叱られそう。', '큐를 세울게요… 아버지가 보시면 혼날 것 같아요.']], safety: [['ここは守ります。', '여기선 지킬게요.']],
    banter: [['店のラシャ、先週張り替えたんです。', '가게 라사, 지난주에 새로 갈았어요.']] },
  luiza: {
    hello: [['Trouxe meu violão, mas hoje só toco taco.', '기타 가져왔는데, 오늘은 큐만 연주할래.'], ['Entre um show e outro, uma partidinha.', '공연 사이에, 한 판만.']],
    streak: [['Três seguidas! Isso já é refrão.', '세 개 연속! 이건 벌써 후렴이야.']], close: [['Última nota da música…', '노래의 마지막 음…']],
    behind: [['Calma, o samba ainda não acabou.', '진정해, 삼바는 아직 안 끝났어.']], ahead: [['Hoje tá tocando a minha música.', '오늘은 내 노래가 흐르네.']],
    trick: [['Vou fazer essa bola dançar.', '이 공을 춤추게 해 볼게.']], safety: [['Uma pausa na melodia.', '멜로디에 잠깐 쉼표.']],
    banter: [['A melhor trilha pra sinuca? Qualquer uma do Tom Jobim.', '당구 칠 때 제일 좋은 음악? 톰 조빙이면 다 좋아.']] },
  ploy: {
    hello: [['วันนี้เอามาการองมาฝากด้วยนะคะ', '오늘 마카롱도 가져왔어요.'], ['วันนี้ร้านปิดเร็ว เล่นได้ทั้งคืนเลย', '오늘 가게 일찍 닫아서 밤새 칠 수 있어요.']],
    streak: [['สามลูกติด! หวานเจี๊ยบเลย', '세 개 연속! 완전 달콤해.']], close: [['อีกลูกเดียว ใจเต้นแรงเลย', '한 개만 더, 심장이 쿵쾅거려.']],
    behind: [['ยังไม่จบนะ ของหวานต้องมาตอนท้าย', '아직 안 끝났어요, 디저트는 마지막에 나오는 법이에요.']], ahead: [['นำอยู่นะ อย่าเพิ่งเผลอ', '앞서고 있어, 방심하지 말자.']],
    trick: [['ลองโค้งแบบครีมบนเค้กดูนะ', '케이크 위 크림처럼 휘게 쳐 볼게요.']], safety: [['ซ่อนไว้ก่อนนะคะ', '일단 숨겨 둘게요.']],
    banter: [['เมนูใหม่ที่ร้านคือชีสเค้กชาไทย มาชิมนะ', '가게 신메뉴는 타이티 치즈케이크예요. 맛보러 와요.']] },
  sofia: {
    hello: [['Μόλις γύρισα από κατάδυση. Ακόμα ακούω τα κύματα.', '방금 다이빙하고 왔어. 아직 파도 소리가 들려.'], ['Καλή αρχή. Χωρίς βιασύνη.', '좋은 출발이길. 서두르지 말고.']],
    streak: [['Τρεις στη σειρά, σαν κοπάδι ψάρια.', '세 개 연속, 물고기 떼처럼.']], close: [['Μία ακόμα. Ήρεμη ανάσα.', '하나만 더. 차분한 숨.']],
    behind: [['Η παλίρροια θα γυρίσει.', '물때는 바뀔 거야.']], ahead: [['Καλός άνεμος σήμερα.', '오늘은 바람이 좋네.']],
    trick: [['Θα τη στρίψω σαν πλοκάμι χταποδιού.', '문어 다리처럼 휘게 해 볼게.']], safety: [['Θα την κρύψω σαν κοχύλι στην άμμο.', '모래 속 조개처럼 숨겨 둘게.']],
    banter: [['Ήξερες ότι το χταπόδι έχει τρεις καρδιές;', '문어는 심장이 세 개라는 거 알았어?']] },
  sean: {
    hello: [['Pull up a stool. We’ll be here a while.', '의자 하나 끌어와. 꽤 오래 걸릴 테니까.'], ['Mind yourself now, I give nothing away.', '조심해, 난 아무것도 공짜로 안 줘.']],
    streak: [['Three in a row. Don’t tell the lads.', '세 개 연속. 친구들한텐 말하지 마.']], close: [['One more and the pints are on you.', '하나만 더 넣으면 맥주는 네가 사는 거다.']],
    behind: [['Sure, it’s a long night yet.', '뭐, 밤은 아직 길어.']], ahead: [['Steady now, Seán. Don’t get cocky.', '침착해, 숀. 우쭐대지 말고.']],
    trick: [['Right, a bit of fancy stuff for the regulars.', '좋아, 단골들 위해 화려한 거 한번.']], safety: [['Tucked up behind there. Grand.', '저 뒤에 딱 숨겼네. 좋아.']],
    banter: [['Rained four days straight in Dublin. Perfect weather for this.', '더블린에 나흘 내내 비가 왔어. 이거 하기 딱 좋은 날씨지.']] },
  meilin: {
    hello: [['今天的课刚结束，身体还热着呢。', '오늘 수업 막 끝나서 몸이 아직 따뜻해요.'], ['我们慢慢来，像跳一支长舞。', '천천히 해요, 긴 춤 한 곡 추듯이.']],
    streak: [['三杆连进，节奏对了。', '세 개 연속, 리듬이 맞았어요.']], close: [['最后一个动作。', '마지막 동작이에요.']],
    behind: [['不急，舞还没跳完。', '서두르지 않아요, 춤은 아직 안 끝났어요.']], ahead: [['保持呼吸，保持节奏。', '호흡 유지, 리듬 유지.']],
    trick: [['这一杆要转个身。', '이번 샷은 몸을 한 바퀴 돌려야 해요.']], safety: [['这一杆，先藏起来。', '이번엔 먼저 숨겨 둘게요.']],
    banter: [['学生们说我打球的样子像在跳舞。', '학생들이 제가 당구 치는 모습이 춤추는 것 같대요.']] },
  emre: {
    hello: [['Çaylar demlendi, toplar dizildi. Buyur.', '차도 우러났고, 공도 놓였어요. 어서 와요.'], ['Burada kimse acele etmez.', '여기선 아무도 서두르지 않아요.']],
    streak: [['Üst üste üç tane. Çaylar benden!', '세 개 연속. 차는 제가 살게요!']], close: [['Bir tane kaldı. Sakin ol, Emre.', '하나 남았어요. 침착해, 엠레.']],
    behind: [['Çay daha soğumadı, oyun da bitmedi.', '차도 아직 안 식었고, 경기도 안 끝났어요.']], ahead: [['Toplar bugün beni seviyor.', '오늘은 공들이 저를 좋아하네요.']],
    trick: [['Bunu gençler için yapıyorum, iyi izleyin.', '젊은이들 보라고 해 보는 거예요, 잘 봐요.']], safety: [['Topu biraz saklayalım.', '공을 좀 숨겨 둡시다.']],
    banter: [['Dedem bu masada otuz yıl oynadı.', '우리 할아버지가 이 테이블에서 30년을 치셨어요.']] },
  darya: {
    hello: [['Пирамида меня научила: шар должен войти чисто.', '피라미드가 가르쳐 줬어요. 공은 깔끔하게 들어가야 한다고.'], ['Без лишних слов. Играем.', '군말 없이. 칩시다.']],
    streak: [['Три подряд. По расчёту.', '세 개 연속. 계산대로예요.']], close: [['Последний. Точно.', '마지막. 정확하게.']],
    behind: [['Счёт - ещё не приговор.', '점수가 아직 판결은 아니에요.']], ahead: [['Не расслабляться.', '긴장 풀지 말자.']],
    trick: [['Поднимем кий. Это тоже геометрия.', '큐를 세워 볼게요. 이것도 기하학이에요.']], safety: [['Оставлю вам задачу.', '숙제를 남겨 드릴게요.']],
    banter: [['В Москве сейчас минус пятнадцать. Здесь теплее.', '모스크바는 지금 영하 15도예요. 여기가 더 따뜻하네요.']] },
  femke: {
    hello: [['Mijn pauze duurt twintig minuten. Opschieten.', '내 휴식 시간 20분이야. 서둘러.'], ['Ik wacht niet graag, dus jij ook niet.', '난 기다리는 거 싫어해, 그러니 너도 꾸물대지 마.']],
    streak: [['Drie op rij. Zo doe je dat.', '세 개 연속. 이렇게 하는 거야.']], close: [['Nog één. Dan koffie.', '하나만 더. 그다음 커피.']],
    behind: [['Hè. Nu ga ik pas echt.', '흥. 이제부터 진짜야.']], ahead: [['Lekker bezig, Femke.', '잘하고 있어, 펨케.']],
    trick: [['Kijk, zo zwaai ik ook met de kraan.', '봐, 크레인도 이렇게 휘두르거든.']], safety: [['Saai, maar slim.', '지루하지만, 똑똑하지.']],
    banter: [['Vanochtend drieduizend containers verzet. En jij?', '오늘 아침 컨테이너 3천 개 옮겼어. 넌?']] },
  ana: {
    hello: [['Traigo los tacones y el taco a punto. Empecemos.', '구두 굽도 큐도 준비됐어요. 시작해요.'], ['Cada bola tiene su compás.', '공마다 박자가 있어요.']],
    streak: [['Tres seguidas. Esto ya es una bulería.', '세 개 연속. 이건 벌써 불레리아예요.']], close: [['El último taconazo.', '마지막 발 구르기.']],
    behind: [['El baile no termina hasta el último compás.', '춤은 마지막 박자까지 끝나지 않아요.']], ahead: [['Sin prisa. Manda el compás.', '서두르지 않아요. 박자가 정해요.']],
    trick: [['Un giro de muñeca, como en el baile.', '춤에서처럼, 손목을 한 번 돌려서.']], safety: [['Ahora, una pausa dramática.', '이제, 극적인 쉼.']],
    banter: [['Esta noche bailo en Triana. Si quieres, ven.', '오늘 밤 트리아나에서 춤춰요. 원하면 와요.']] },
  lea: {
    hello: [['J’ai apporté Rimbaud et une craie bleue.', '랭보 시집이랑 파란 초크 가져왔어.'], ['Chaque partie est un petit roman.', '한 판 한 판이 짧은 소설이야.']],
    streak: [['Trois de suite : une strophe entière.', '세 개 연속, 한 연이 통째로 완성됐네.']], close: [['Dernière ligne. Il faut une belle chute.', '마지막 줄. 멋진 결말이 필요해.']],
    behind: [['Les meilleurs romans ont un rebondissement.', '좋은 소설엔 반전이 있지.']], ahead: [['L’intrigue me plaît, pour l’instant.', '지금까진 줄거리가 마음에 들어.']],
    trick: [['Un massé. Ma figure de style préférée.', '맛세이. 내가 제일 좋아하는 수사법이야.']], safety: [['Je la laisse entre les lignes.', '행간에 남겨 둘게.']],
    banter: [['Tu lis quoi en ce moment ? Moi, Camus.', '요즘 뭐 읽어? 난 카뮈.']] },
  migo: {
    hello: [['Hanggang alas-nuwebe lang daw ako sabi ni Papa!', '아빠가 9시까지만 치래요!'], ['Tatayo ako sa bangkito, ha. Huwag kang tatawa!', '나 의자 밟고 칠 거예요. 웃지 마요!']],
    streak: [['Tatlo na! Astig, ’di ba?', '벌써 세 개! 멋지죠?']], close: [['Isa na lang! Isa na lang!', '하나 남았다! 하나 남았다!']],
    behind: [['Hindi pa tapos! Babawi ako!', '아직 안 끝났어요! 다시 따라잡을 거예요!']], ahead: [['Lamang ako! Sasabihin ko kay Papa!', '내가 앞서요! 아빠한테 말해야지!']],
    trick: [['Panoorin mo ’to, natutunan ko sa YouTube!', '이거 봐요, 유튜브에서 배웠어요!']], safety: [['Itago muna, sabi ni Papa.', '일단 숨기래요, 아빠가.']],
    banter: [['May pasok pa ako bukas. Pero isa pang laro!', '내일 학교 가야 하는데. 그래도 한 판 더!']] },
  ingrid: {
    hello: [['Nytt tuggummi. Ny match.', '새 껌. 새 경기.'], ['Jag har räknat på det här bordet. Det lutar lite.', '이 테이블 계산해 봤는데. 살짝 기울었어.']],
    streak: [['Tre i rad. Systemet funkar.', '세 개 연속. 시스템이 돌아가네.']], close: [['Sista. Inga känslor.', '마지막. 감정 없이.']],
    behind: [['Okej. Felsökning pågår.', '좋아. 디버깅 중.']], ahead: [['Som väntat. Men vi får se.', '예상대로. 하지만 두고 보자.']],
    trick: [['Lite massé. Fysik är kul.', '맛세이 좀. 물리는 재밌어.']], safety: [['Den får du jobba med.', '그건 네가 해결해 봐.']],
    banter: [['På dagarna bygger jag broar. Här bygger jag vinklar.', '낮엔 다리를 짓고, 여기선 각도를 지어.']] },
  ole: {
    hello: [['Stormvarsel i dag. Så her er jeg.', '오늘 폭풍 경보야. 그래서 여기 왔지.'], ['Vi har god tid. Båten går ingen steder.', '시간은 넉넉해. 배는 어디 안 가.']],
    streak: [['Tre på rad. Godt fiske i dag.', '세 개 연속. 오늘 어획이 좋네.']], close: [['En til, så er vi i havn.', '하나만 더, 그럼 항구야.']],
    behind: [['Havet tar, og havet gir.', '바다는 가져가고, 또 주지.']], ahead: [['Rolig sjø. Hold kursen.', '잔잔한 바다. 항로 유지.']],
    trick: [['Et gammelt triks fra båten.', '배에서 배운 오래된 기술이지.']], safety: [['Vi legger den i le.', '바람 안 닿는 데 대 두자.']],
    banter: [['Fikk en torsk på tolv kilo forrige uke.', '지난주에 12킬로짜리 대구를 잡았어.']] },
  frederic: {
    hello: [['Je vous souhaite une bonne partie.', '좋은 경기 되시길.'], ['Prenez votre temps. Je prendrai le mien.', '천천히 하세요. 저도 제 시간을 쓰겠습니다.']],
    streak: [['Une série. Continuons.', '연속 득점. 계속하죠.']], close: [['Dernier point. Rien ne change.', '마지막 한 점. 달라지는 건 없습니다.']],
    behind: [['Une partie se joue jusqu’au dernier point.', '경기는 마지막 점까지 치는 겁니다.']], ahead: [['Restons concentrés.', '집중을 유지합시다.']],
    trick: [['Un massé. Rarement, mais proprement.', '맛세이. 드물게, 하지만 깔끔하게.']], safety: [['Une position défensive.', '수비 배치입니다.']],
    banter: [['À Gand, on joue le mardi soir. Toujours.', '겐트에선 화요일 밤에 칩니다. 언제나요.']] },
  jack: {
    hello: [['Ladies and gentlemen, the main event!', '신사 숙녀 여러분, 메인 이벤트입니다!'], ['Hope you brought popcorn.', '팝콘 가져왔길 바라.']],
    streak: [['Three on the bounce! Is anyone filming this?', '세 개 연속! 누가 이거 찍고 있어?']], close: [['One more for the crowd.', '관중을 위해 하나 더.']],
    behind: [['Every good show needs a comeback.', '좋은 쇼엔 역전이 필요하지.']], ahead: [['Don’t worry, I’ll make it look close.', '걱정 마, 접전처럼 보이게 해 줄게.']],
    trick: [['Right, this one’s for the highlight reel.', '좋아, 이건 하이라이트 영상감이야.']], safety: [['Bit of a snooker for you. Classic.', '스누커 좀 걸어 줄게. 클래식이지.']],
    banter: [['Played the Crucible once. Well, the car park.', '크루서블에서 쳐 본 적 있어. 뭐, 주차장에서지만.']] },
  lena: {
    hello: [['Meine Uhr ist gestellt. Die Partie beginnt jetzt.', '시계 맞춰 놨어요. 경기는 지금 시작이에요.'], ['Ich notiere jeden Fehler. Auch meine.', '실수는 다 적어 둬요. 제 것도요.']],
    streak: [['Drei in Folge. Das Werk läuft.', '세 개 연속. 시계가 잘 돌아가네요.']], close: [['Letzter Stoß. Ruhe.', '마지막 샷. 차분히.']],
    behind: [['Zeit für eine Korrektur.', '수정할 시간이에요.']], ahead: [['Nicht nachlassen. Toleranz null.', '느슨해지지 말자. 허용 오차 0.']],
    trick: [['Ein Massé. Das ist Feinmechanik.', '맛세이. 이건 정밀 기계예요.']], safety: [['Ich lasse Ihnen nichts.', '아무것도 안 남겨 드릴게요.']],
    banter: [['Eine Unruh schwingt 28.800 Mal pro Stunde. Das beruhigt mich.', '밸런스 휠은 시간당 28,800번 흔들려요. 그게 절 진정시키죠.']] },
  elijah: {
    hello: [['Howdy, partner. You grab a cue, I’ll grab the win.', '안녕, 친구. 넌 큐를 잡아, 난 승리를 잡을 테니.'], ['Kentucky rules: no crying, no excuses.', '켄터키 룰이야. 울기 없기, 핑계 없기.']],
    streak: [['Three in a row. Just warming up.', '세 개 연속. 이제 몸 좀 풀리네.']], close: [['One more and the next round’s on me.', '하나만 더 넣으면 다음 잔은 내가 쏜다.']],
    behind: [['Alright, now it’s getting interesting.', '좋아, 이제야 재밌어지네.']], ahead: [['Don’t look at the score, partner. It’ll only hurt.', '점수판 보지 마, 친구. 아프기만 할 거야.']],
    trick: [['Hold my hat. Watch this.', '모자 좀 들고 있어. 이거 봐.']], safety: [['Let’s see you get out of that one.', '거기서 빠져나오는지 보자.']],
    banter: [['Hustled my way across six states with this cue.', '이 큐 하나로 여섯 개 주를 돌며 내기 당구를 쳤지.']] },
};
for (const id in BOT_CONTEXT) if (BOT_LINES[id]) for (const m in BOT_CONTEXT[id]) BOT_LINES[id][0][m] = (BOT_LINES[id][0][m] || []).concat(BOT_CONTEXT[id][m]);
