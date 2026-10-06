/* ================= sheets ================= */
function openSheet(title, kids) { $('#sheetTitle').textContent = title; const b = $('#sheetBody'); b.textContent = ''; for (const k of [].concat(kids)) if (k) b.appendChild(k); $('#sheet').hidden = false; }
function closeSheet() { $('#sheet').hidden = true; }
$('#sheetX').addEventListener('click', () => { SND.tap(); closeSheet(); });
$('#sheet').addEventListener('click', e => { if (e.target === $('#sheet')) closeSheet(); });
const optBtn = (on, kids, fn) => el('button', { class: 'opt', 'aria-pressed': String(on), onclick: () => { SND.init(); SND.tap(); fn(); } }, kids);
const optText = (t, d) => el('span', null, [el('span', { class: 't', text: t }), d ? el('span', { class: 'd', text: d }) : null]);
const flatBtn = (text, fn) => el('button', { class: 'btn flat', text, onclick: () => { SND.tap(); fn(); } });
const segRow = (label, opts, cur, fn) => el('div', { class: 'field' }, [el('div', { class: 'lab', text: label }),
  el('div', { class: 'seg' }, opts.map(([v, t]) => el('button', { 'aria-pressed': String(v === cur), text: t, onclick: () => { SND.tap(); fn(v); } })))]);
const note = text => el('p', { class: 'note', text });

function sheetTable() {
  const sizes = isCarom() ? [note('3구와 4구는 포켓 없는 중대(254×127cm, 공 65.5mm)로 고정입니다.')]
    : TABLES.map(t => optBtn(prefs.table === t.id, optText(t.name, t.d), () => { prefs.table = t.id; savePrefs(); PH.pool = poolOf(t.id); paintHome(); homePreview(); sheetTable(); }));
  openSheet('테이블', [el('div', { class: 'lab', text: '크기' }), ...sizes, el('div', { class: 'lab', text: '천 색' }),
    el('div', { class: 'grid2' }, CLOTHS.map((c, i) => optBtn(prefs.cloth === i,
      [el('i', { class: 'sw', style: `--c:${hex(c.felt)};--w:${hex(c.wood)}` }), optText(c.name)], () => { prefs.cloth = i; savePrefs(); paintHome(); homePreview(); sheetTable(); }))),
    iceOn() ? note('빙판: 공이 미끄러져 오래 구르고 회전이 잘 먹지 않습니다. 대결에만 적용되고, 레슨과 퍼즐은 일반 천에서 합니다.') : null]);
}
let cueWho = 0;
function sheetCue() {
  const two = !prefs.vsAI && prefs.mode !== 'practice' && prefs.mode !== 'puzzle'; if (!two) cueWho = 0;
  openSheet('큐 고르기', [two ? segRow('누구 큐', [[0, prefs.names[0]], [1, prefs.names[1]]], cueWho, v => { cueWho = v; sheetCue(); }) : null].concat(CUES.map((c, i) => optBtn(prefs.cues[cueWho] === i,
    [el('canvas', { class: 'cuepic' }), optText(c.name, c.note)], () => { prefs.cues[cueWho] = i; if (!cueWho) prefs.cue = i; savePrefs(); if (cueWho === 0) useCue(i); paintHome(); sheetCue(); }))));
  document.querySelectorAll('#sheetBody .cuepic').forEach((cv, i) => drawCue(cv, CUES[i], false));
}
// one guide length per player (a handicap); a single row when only one person is aiming
function sheetGuide() {
  const solo = prefs.vsAI || (st.screen === 'home' ? prefs.mode === 'practice' || prefs.mode === 'puzzle' : flow !== match);
  const row = i => segRow(solo ? '조준선' : st.screen === 'play' ? game.players[i].name : prefs.names[i], GUIDE.map((gd, k) => [k, gd[0]]), prefs.guides[i], v => { prefs.guides[i] = v; if (solo) prefs.guides[1] = v; savePrefs(); paintHome(); scene.invalidate(); sheetGuide(); });
  openSheet('조준선 길이', [row(0), solo ? null : row(1), note(GUIDE.map(gd => gd[0] + ': ' + gd[1]).join(' · ')),
    solo ? null : note('실력 차이가 나면 잘하는 쪽을 짧게, 처음 하는 쪽을 길게 두세요.')]);
}
function sheetSettings() {
  openSheet('설정', [
    segRow('화면', [['dark', '다크'], ['light', '라이트']], prefs.theme, v => { prefs.theme = v; savePrefs(); applyTheme(); sheetSettings(); }),
    segRow('소리', [[true, '켬'], [false, '끔']], prefs.sound, v => { prefs.sound = v; savePrefs(); if (v) SND.init(); sheetSettings(); }),
    flatBtn('하이라이트 · ' + (reel.STYLES.find(x => x[0] === prefs.edit) || [0, '편집 랜덤'])[1] + ' · 노래 ' + SND.song.list.length + '곡', sheetSong),
    segRow('빠른 진행', [[true, '켬'], [false, '끔']], prefs.fast, v => { prefs.fast = v; savePrefs(); sheetSettings(); }),
    segRow('화질', [['auto', '자동'], ['high', '높음'], ['low', '낮음']], prefs.quality, v => { prefs.quality = v; savePrefs(); scene.setQuality(v); sheetSettings(); }),
    segRow('초당 프레임 표시', [[false, '끔'], [true, '켬']], prefs.fps, v => { prefs.fps = v; savePrefs(); $('#fps').hidden = !v; sheetSettings(); }),
    note('빠른 진행: 공이 느려지면 시간을 두 배로 돌려 마지막 구르기를 기다리지 않게 합니다. 화질을 낮추면 움직임이 더 부드러워집니다.'),
    flatBtn('실험실 · 2.0에서 바뀐 것 끄고 켜기', sheetLab),
    note('CUE 2.0'),
  ]);
}
// shown once: to someone new, how to play a shot; to someone coming from 1.x, what 2.0 added and where it is
function sheetHow() {
  prefs.how = true; savePrefs();
  openSheet('치는 법', [
    optText('조준', '테이블 위를 끌면 큐가 돌아갑니다. 오른쪽 띠는 미세 조준.'),
    optText('치기', '왼쪽 큐 막대를 아래로 당겼다 놓으면 나갑니다. 많이 당길수록 세게.'),
    optText('회전', '오른쪽 아래 흰 공을 누르면 칠 곳을 정합니다. 맛세이와 점프도 여기.'),
    el('button', { class: 'btn cta', text: '시작', onclick: () => { SND.tap(); closeSheet(); } }),
  ].map(k => k.tagName === 'BUTTON' ? k : el('div', { class: 'opt' }, k)));
}
function sheetNews() {
  prefs.news = false; savePrefs();
  openSheet('CUE 2.0', [
    ['큐 세우기', '회전 창의 큐 각도. 세워서 세게 치면 점프, 좌우 회전을 주면 휘고, 많이 세우면 맛세이. 시작 전에 허용/금지를 정합니다.'],
    ['수지', '4구에서 이름을 누르면 각자 수지를 정합니다. 50이면 다섯 번 득점.'],
    ['빙판 테이블', '테이블 고르는 곳에 새 스킨. 공이 미끄러집니다.'],
    ['퍼즐 스테이지', '4구 기술 일곱 가지, 105문제. 힌트는 흰 공이 닿는 곳을 번호로.'],
    ['이어하기 · 넣은 공 · 연승 불꽃 · 큐 각자', '하던 판은 첫 화면 카드로 남고, 이름표에 넣은 공이 쌓입니다.'],
    ['실험실', '설정 맨 아래. 새 기능을 하나씩 끌 수 있습니다.'],
  ].map(([t, d]) => el('div', { class: 'opt' }, optText(t, d))).concat(el('button', { class: 'btn cta', text: '확인', onclick: () => { SND.tap(); closeSheet(); } })));
}
// every large change of 2.0 behind its own switch, so that one that turns out badly can be taken back without reinstalling
function sheetLab() {
  const row = (k, name, d) => el('div', { class: 'field' }, [el('div', { class: 'lab', text: name }), el('div', { class: 'seg' }, [[true, '켬'], [false, '끔']].map(([v, t]) => el('button', { 'aria-pressed': String(LAB[k] === v), text: t, onclick: () => { SND.tap(); LAB[k] = v; savePrefs(); labChanged(); sheetLab(); } }))), d ? note(d) : null]);
  openSheet('실험실', [
    note('2.0에서 새로 들어간 것들입니다. 마음에 안 드는 것은 여기서 끄면 1.x 때처럼 돌아갑니다.'),
    row('masse', '큐 세우기 (맛세이 · 점프)', '끄면 회전 창에서 큐 각도가 사라집니다.'),
    row('suji', '수지 (4구)', '이름마다 자기 수지까지 칩니다. 끄면 둘 다 같은 점수까지.'),
    row('tray', '넣은 공 표시 (8볼)', '이름표에 넣은 공이 쌓입니다. 끄면 남은 공을 보여줍니다.'),
    row('demo', '첫 화면 자동 시연'),
    row('fire', '연승 불꽃'),
    row('stage', '퍼즐 스테이지 화면'),
    row('resume', '이어하기', '끄면 처음으로 나갈 때 하던 판을 지웁니다.'),
    flatBtn('설정으로', sheetSettings),
  ]);
}
function labChanged() { if (st.screen === 'home') { paintHome(); homePreview(); } }
// the best-shot reel: which edit it gets, and the songs it may use (picked from this device and kept on it)
const mmss = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
function sheetSong(busy) {
  const songs = SND.song.list, again = () => sheetSong();
  const listen = async m => { SND.init(); await SND.song.prepare(m.id); SND.song.play(2); setTimeout(() => SND.boom(), 2000); setTimeout(() => SND.song.stop(), 6000); };
  const act = (text, fn) => el('button', { text, onclick: async e => { e.stopPropagation(); SND.tap(); await fn(); } });
  openSheet('하이라이트', [
    el('div', { class: 'lab', text: '편집' }),
    el('div', { class: 'pickrow' }, [['random', '랜덤']].concat(reel.STYLES).map(([id, name]) => el('button', { text: name, 'aria-pressed': String(prefs.edit === id), onclick: () => { SND.tap(); prefs.edit = id; savePrefs(); again(); } }))),
    note(`랜덤은 ${reel.STYLES.length}가지 편집이 한 번씩 돌아가며 나옵니다. 워스트 샷은 노래 없이 ${reel.WORST.length}가지 편집이 돌아가며 나옵니다.`),
    el('div', { class: 'lab', text: `노래 ${songs.length}/${SND.song.MAX}` }),
    songs.length ? el('div', null, songs.map(m => el('div', { class: 'song' + (m.on ? ' on' : ''), onclick: async () => { SND.tap(); await SND.song.toggle(m.id); again(); } }, [
      el('span', { class: 'chk', text: '✓' }),
      el('div', { style: 'min-width:0' }, [el('div', { class: 'nm', text: m.name }), el('div', { class: 'meta', text: `드롭 ${mmss(m.drop)} · ${Math.round(m.bpm)} BPM` })]),
      el('div', { class: 'acts' }, [act('듣기', () => listen(m)), act('−0.1', async () => { await SND.song.nudge(m.id, -0.1); again(); }), act('+0.1', async () => { await SND.song.nudge(m.id, 0.1); again(); }), act('삭제', async () => { await SND.song.remove(m.id); again(); })]),
    ]))) : note('최고의 샷 다시 보기에 깔 노래를 이 기기에서 고릅니다. 노래는 기기 안에만 저장되고, 드롭 앞뒤 30초만 씁니다.'),
    busy ? note('노래를 읽는 중입니다…') : songs.length < SND.song.MAX ? flatBtn('노래 추가', () => $('#songFile').click()) : null,
    songs.length ? note('체크한 노래 중 하나가 매번 무작위로 깔립니다. "듣기"를 누르면 2초 뒤 쿵 소리와 드롭이 겹쳐야 맞는 것이고, 어긋나면 −0.1 / +0.1초로 옮기세요.') : null,
  ]);
}
$('#songFile').addEventListener('change', async e => {
  const files = Array.from(e.target.files || []); e.target.value = ''; if (!files.length) return;
  sheetSong(true);
  for (const f of files) { try { await SND.song.take(f); } catch (err) { toast(err && err.message === 'full' ? `노래는 ${SND.song.MAX}곡까지 넣을 수 있습니다.` : '이 파일은 읽을 수 없습니다. mp3나 m4a, wav 파일로 해 보세요.', 'foul', 3200); } }
  sheetSong();
});
function sheetName(i, keep) {
  const ai = i === 1 && prefs.vsAI, four = prefs.mode === 'four' && LAB.suji;
  if (ai && !four) return;
  const input = ai ? null : el('input', { class: 'txt', id: 'nameInput', maxlength: '10', value: keep == null ? prefs.names[i] : keep, 'aria-label': '이름', autocomplete: 'off' });
  let suji = sujiOf(i);
  const save = () => {
    if (input) { const v = input.value.trim().slice(0, 10); if (v && v !== prefs.names[1 - i]) prefs.names[i] = v; }
    if (four) { if (ai) prefs.sujiAI = suji; else prefs.suji[prefs.names[i]] = suji; }
    savePrefs(); closeSheet(); paintHome();
  };
  if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
  const sj = four ? el('div', { class: 'field' }, [el('div', { class: 'lab', text: '수지 (몇 쳐?)' }), el('div', { class: 'seg' }, SUJI.map(v => el('button', { 'aria-pressed': String(v === suji), text: String(v * 10), onclick: e => { SND.tap(); suji = v; for (const b of e.target.parentNode.children) b.setAttribute('aria-pressed', String(b === e.target)); } }))),
    note('한 번 득점이 10점, 자기 수지만큼 먼저 치면 이깁니다. 50이면 다섯 번. 실력이 달라도 각자 수지대로 치면 승부가 됩니다.')]) : null;
  openSheet(ai ? '컴퓨터 수지' : `${i + 1}번 선수`, [input, input ? note('전적은 이름별로 따로 쌓입니다. 열 글자까지.') : null, sj, el('button', { class: 'btn cta', text: '저장', onclick: save })]);
  if (input && !four) setTimeout(() => { try { input.focus(); input.select(); } catch (e) {} }, 60);
}
function sheetPause() {
  openSheet('잠깐 멈춤', [
    el('button', { class: 'btn cta', text: '이어서 하기', onclick: closeSheet }),
    el('div', { class: 'row' }, [flatBtn('조준선', sheetGuide), flatBtn('설정', sheetSettings)]),
    el('div', { class: 'row' }, [flatBtn('다시 시작', () => { closeSheet(); flow.restart(); }), flatBtn('처음으로', () => goHome(true))]),
  ]);
}
