/* ================= sheets ================= */
function openSheet(title, kids) { $('#sheet').classList.remove('see'); $('#sheetTitle').textContent = title; const b = $('#sheetBody'); b.textContent = ''; for (const k of [].concat(kids)) if (k) b.appendChild(k); $('#sheet').hidden = false; }
function closeSheet() { $('#sheet').hidden = true; }
$('#sheetX').addEventListener('click', () => { SND.tap(); closeSheet(); });
$('#sheet').addEventListener('click', e => { if (e.target === $('#sheet')) closeSheet(); });
const optText = (t, d) => el('span', null, [el('span', { class: 't', text: t }), d ? el('span', { class: 'd', text: d }) : null]);
const flatBtn = (text, fn) => el('button', { class: 'btn flat', text, onclick: () => { SND.tap(); fn(); } });
// a row of choices; when the choices are just on and off, a switch
const segRow = (label, opts, cur, fn) => {
  if (opts.length === 2 && opts.every(([v]) => typeof v === 'boolean')) return el('div', { class: 'field tglrow' }, [el('div', { class: 'lab', text: label }),
    el('button', { class: 'tgl', role: 'switch', 'aria-checked': String(!!cur), 'aria-label': label, onclick: () => { SND.tap(); fn(!cur); } }, el('i'))]);
  return el('div', { class: 'field' }, [el('div', { class: 'lab', text: label }),
    el('div', { class: 'seg' }, opts.map(([v, t]) => el('button', { 'aria-pressed': String(v === cur), text: t, onclick: () => { SND.tap(); fn(v); } })))]);
};
const note = text => el('p', { class: 'note', text });

function sheetSettings() {
  openSheet('설정', [
    segRow('소리', [[true, '켬'], [false, '끔']], prefs.sound, v => { prefs.sound = v; savePrefs(); if (v) SND.init(); sheetSettings(); }),
    segRow('음악', [[true, '켬'], [false, '끔']], prefs.music !== false, v => { prefs.music = v; savePrefs(); MUSIC.setOn(v); sheetSettings(); }),
    flatBtn('하이라이트 · ' + (reel.STYLES.find(x => x[0] === prefs.edit) || [0, '편집 랜덤'])[1] + ' · 노래 ' + SND.song.list.length + '곡', sheetSong),
    segRow('샷 시간', [[0, '끔'], [30, '30초'], [40, '40초'], [60, '60초']], prefs.shotClock || 0, v => { prefs.shotClock = v; savePrefs(); sheetSettings(); }),
    segRow('화질', [['auto', '자동'], ['high', '높음'], ['low', '낮음']], prefs.quality, v => { prefs.quality = v; savePrefs(); scene.setQuality(v); sheetSettings(); }),
    segRow('초당 프레임 표시', [[false, '끔'], [true, '켬']], prefs.fps, v => { prefs.fps = v; savePrefs(); $('#fps').hidden = !v; sheetSettings(); }),
    net.on ? el('div', { class: 'field' }, [el('div', { class: 'lab', text: '계정' }), el('div', { class: 'acct-id', text: acctLine() })]) : null,
    // (signing up or in with Google: 57-account.js - also from the name on the top bar, where it is shown)
    net.on ? flatBtn(net.me && net.me.joined ? `회원 · ${net.me.nick || prefs.names[0]}` : '게스트 · 구글로 가입하기', () => account.sheet()) : null,
    net.on ? el('div', { class: 'row' }, [flatBtn('다른 기기 연결', sheetLinkMake), flatBtn('코드로 연결', sheetLinkUse)]) : null,
    net.debug ? flatBtn('디버그', sheetDebug) : null,
    el('div', { class: 'row' }, [flatBtn('크레딧', sheetCredits), flatBtn('약관 · 개인정보', () => window.open('https://danguuu.com/privacy', '_blank', 'noopener'))]),
    note('CUE 4.0'),
  ]);
}
/* 디버그 (owner 11-11): shown only on an account the admin console has put in debug mode (net.debug). The desk's wood and
   the tray to try (owner 11-13: DESK_LOOK, 00-state.js - kept on this device, used only in debug mode), and 아케이드's
   ultimate gauge in any game. (The light's sliders are gone: the owner fixed its values as the game's own - LIGHT0.) */
function sheetDebug() {
  const L = deskLook(), seg = (what, key, cur) => el('div', { class: 'seg' }, Object.entries(DESK_LOOK[what]).map(([id, o]) =>
    el('button', { 'aria-pressed': String(o === cur), text: o.name, onclick: () => { prefs[key] = id; savePrefs(); applyBackdrop(); sheetDebug(); } })));
  openSheet('디버그', [
    el('div', { class: 'lab', text: '책상 목재' }), seg('wood', 'deskWood', L.wood),
    el('div', { class: 'lab', text: '트레이' }), seg('tray', 'deskTray', L.tray),
    el('div', { class: 'lab', text: '색 조합' }), seg('theme', 'deskTheme', DESK_LOOK.theme[L.theme]),
    // (a table of another shape, to see: free practice is played on it - physics.js shape, tables.js TABLE_SHAPES)
    el('div', { class: 'lab', text: '테이블 모양 (자유 연습)' }),
    el('div', { class: 'seg' }, [['', '기본'], ['circle', '원'], ['oval', '타원'], ['penta', '오각'], ['hexa', '육각'], ['bumpy', '울퉁불퉁']].map(([k, t]) =>
      el('button', { 'aria-pressed': String((prefs.shapeTry || '') === k), text: t, onclick: () => { prefs.shapeTry = k || null; savePrefs(); sheetDebug(); } }))),
    // (아케이드's ultimate gauge on the game screen, in any game: 50-match.js paintUlt)
    flatBtn(`궁극기 게이지 미리보기: ${prefs.ultTry ? '켜짐' : '꺼짐'}`, () => { prefs.ultTry = !prefs.ultTry; savePrefs(); paintUlt(); sheetDebug(); }),
    flatBtn('뒤로', sheetSettings),
  ]);
  $('#sheet').classList.add('see');                                   // (docked to one side: the desk shows through)
}
/* 크레딧: what the game uses that others made, with their licenses (owner 11-09) */
function sheetCredits() {
  const item = (what, who, lic, href) => el('div', { class: 'credit' }, [el('b', { text: what }), el('small', { text: `${who} · ${lic}` }),
    href ? el('a', { href, target: '_blank', rel: 'noopener', text: href.replace(/^https:\/\//, '') }) : null]);
  openSheet('크레딧', [
    item('이모티콘 · Fluent Emoji', 'Microsoft Corporation', 'MIT License', 'https://github.com/microsoft/fluentui-emoji'),
    item('3D · three.js', 'three.js authors', 'MIT License', 'https://threejs.org'),
    item('글꼴 · Gothic A1, Jua, Black Han Sans', 'HanYang I&C, Woowahan Brothers, Zess Type', 'SIL Open Font License 1.1', 'https://fonts.google.com'),
    item('글꼴 · Outfit', 'Outfit Project Authors', 'SIL Open Font License 1.1', 'https://fonts.google.com/specimen/Outfit'),
    flatBtn('뒤로', sheetSettings),
  ]);
}
/* The account (07-net.js): which it is, in short, and on how many devices; a code to link another device to it, or another
   device's code to take this one to that account. */
const acctLine = () => { const id = net.accountId, n = net.me && net.me.devices; return id ? `${id.slice(0, 4).toUpperCase()}·${id.slice(4, 8).toUpperCase()}${n ? ` · 기기 ${n}대` : ''}` : '아직 없음 (처음 서버에 연결할 때 만들어집니다)'; };
const codeShown = c => c.slice(0, 4) + '-' + c.slice(4);
let linkTick = 0;
async function sheetLinkMake() {
  clearInterval(linkTick);
  openSheet('다른 기기 연결', [note('코드를 만드는 중…')]);
  const r = await net.linkMake();
  if (!r || !r.ok) return openSheet('다른 기기 연결', [note('코드를 만들 수 없습니다' + (net.troubleText() ? ` (${net.troubleText()})` : '') + '.'), flatBtn('다시 시도', sheetLinkMake)]);
  const left = el('p', { class: 'note' });
  const tick = () => { const s = Math.max(0, Math.round((r.until - Date.now()) / 1000)); left.textContent = s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} 동안 한 번 쓸 수 있습니다.` : '시간이 지났습니다. 새 코드를 만드세요.'; if (!s || $('#sheet').hidden) clearInterval(linkTick); };
  openSheet('다른 기기 연결', [el('div', { class: 'linkcode', text: codeShown(r.code) }), left,
    note('다른 기기에서 설정 → 계정 → 코드로 연결에 이 코드를 넣으면, 그 기기도 이 계정(코인·다이아·가진 아이템·레이팅)을 씁니다.'),
    flatBtn('새 코드', sheetLinkMake)]);
  tick(); linkTick = setInterval(tick, 1000);
}
function sheetLinkUse() {
  const input = el('input', { class: 'txt', maxlength: '9', placeholder: 'XXXX-XXXX', 'aria-label': '연결 코드', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false' });
  const msg = el('p', { class: 'note', text: '다른 기기의 설정 → 계정 → 다른 기기 연결에서 받은 코드입니다. 연결하면 이 기기의 지금 계정은 이 기기에 보관되고, 그 계정을 쓰게 됩니다.' });
  const go = async () => {
    const code = input.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); if (code.length !== 8) { msg.textContent = '코드는 여덟 글자입니다.'; return; }
    msg.textContent = '연결하는 중…';
    const r = await net.linkUse(code);
    if (r && r.ok) { closeSheet(); toast('연결했습니다. 이제 이 기기도 같은 계정입니다.', 'good', 3000); if (st.screen === 'home') paintHome(); return; }
    msg.textContent = !r ? `연결할 수 없습니다 (${net.troubleText() || '서버 응답 없음'}).` : r.why === 'slow down' ? '잘못 넣은 코드가 많습니다. 1분 뒤에 다시 해 보세요.' : '맞는 코드가 없습니다. 시간이 지났거나 이미 쓴 코드일 수 있습니다.';
  };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  openSheet('코드로 연결', [input, msg, el('button', { class: 'btn cta', text: '연결', onclick: () => { SND.tap(); go(); } })]);
  setTimeout(() => { try { input.focus(); } catch (e) {} }, 60);
}
// shown once, to someone new: how to play a shot
function sheetHow() {
  prefs.how = true; savePrefs();
  openSheet('치는 법', [
    // (copy audit 05-02: what to do, not where it is - that differs upright and sideways)
    optText('조준', '테이블을 끌어 조준'),
    optText('치기', '세기 막대를 당겼다 놓아 치기'),
    optText('당점', '흰 공을 눌러 당점 조절'),
    el('button', { class: 'btn cta', text: '시작', onclick: () => { SND.tap(); closeSheet(); } }),
  ].map(k => k.tagName === 'BUTTON' ? k : el('div', { class: 'opt' }, k)));
}
// the best-shot reel: which edit it gets, and the songs it may use (picked from this device and kept on it)
const mmss = s => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
function sheetSong(busy) {
  const songs = SND.song.list, again = () => sheetSong();
  const listen = async m => { SND.init(); await SND.song.prepare(m.id); SND.song.play(2); setTimeout(() => SND.boom(), 2000); setTimeout(() => SND.song.stop(), 6000); };
  const act = (text, fn) => el('button', { text, onclick: async e => { e.stopPropagation(); SND.tap(); await fn(); } });
  openSheet('하이라이트', [
    el('div', { class: 'lab', text: '편집' }),
    el('div', { class: 'pickrow' }, [['random', '랜덤']].concat(reel.STYLES).map(([id, name]) => el('button', { text: name, 'aria-pressed': String(prefs.edit === id), onclick: () => { SND.tap(); prefs.edit = id; savePrefs(); again(); } }))),
    el('div', { class: 'lab', text: `노래 ${songs.length}/${SND.song.MAX}` }),
    songs.length ? el('div', null, songs.map(m => el('div', { class: 'song' + (m.on ? ' on' : ''), onclick: async () => { SND.tap(); await SND.song.toggle(m.id); again(); } }, [
      el('span', { class: 'chk', text: '✓' }),
      el('div', { style: 'min-width:0' }, [el('div', { class: 'nm', text: m.name }), el('div', { class: 'meta', text: `드롭 ${mmss(m.drop)} · ${Math.round(m.bpm)} BPM` })]),
      el('div', { class: 'acts' }, [act('듣기', () => listen(m)), act('−0.1', async () => { await SND.song.nudge(m.id, -0.1); again(); }), act('+0.1', async () => { await SND.song.nudge(m.id, 0.1); again(); }), act('삭제', async () => { await SND.song.remove(m.id); again(); })]),
    ]))) : note('하이라이트에 깔 노래를 고르세요. 노래는 이 기기에만 저장됩니다.'),
    busy ? note('노래를 읽는 중입니다…') : songs.length < SND.song.MAX ? flatBtn('노래 추가', () => $('#songFile').click()) : null,
    songs.length ? note('체크한 노래 중 하나가 무작위로 나옵니다. 박자가 어긋나면 −0.1 / +0.1초로 맞추세요.') : null,
  ]);
}
$('#songFile').addEventListener('change', async e => {
  const files = Array.from(e.target.files || []); e.target.value = ''; if (!files.length) return;
  sheetSong(true);
  for (const f of files) { try { await SND.song.take(f); } catch (err) { toast(err && err.message === 'full' ? `노래는 ${SND.song.MAX}곡까지 넣을 수 있습니다.` : '이 파일은 읽을 수 없습니다. mp3나 m4a, wav 파일로 해 보세요.', 'foul', 3200); } }
  sheetSong();
});
function sheetName(i, keep) {
  const ai = i === 1 && prefs.vsAI, four = prefs.mode === 'four';
  if (ai && !four) return;
  const input = ai ? null : el('input', { class: 'txt', id: 'nameInput', maxlength: '10', value: keep == null ? prefs.names[i] : keep, 'aria-label': '이름', autocomplete: 'off' });
  let suji = sujiOf(i);
  const save = () => {
    if (input) { const v = input.value.trim().slice(0, 10); if (v && v !== prefs.names[1 - i]) prefs.names[i] = v; }
    if (four) { if (ai) prefs.sujiAI = suji; else prefs.suji[prefs.names[i]] = suji; }
    savePrefs(); closeSheet(); net.renamed(); paintHome();
  };
  if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
  const sj = four ? el('div', { class: 'field' }, [el('div', { class: 'lab', text: '수지 (몇 쳐?)' }), el('div', { class: 'seg' }, SUJI.map(v => el('button', { 'aria-pressed': String(v === suji), text: String(v * 10), onclick: e => { SND.tap(); suji = v; for (const b of e.target.parentNode.children) b.setAttribute('aria-pressed', String(b === e.target)); } }))),
    note('한 번 득점이 10점, 자기 수지만큼 먼저 치면 이깁니다.')]) : null;
  openSheet(ai ? '컴퓨터 수지' : `${i + 1}번 선수`, [input, input ? note('열 글자까지') : null, sj, el('button', { class: 'btn cta', text: '저장', onclick: save })]);
  if (input && !four) setTimeout(() => { try { input.focus(); input.select(); } catch (e) {} }, 60);
}
function sheetPause() {
  openSheet('잠깐 멈춤', [
    el('button', { class: 'btn cta', text: '이어서 하기', onclick: closeSheet }),
    el('div', { class: 'row' }, [flatBtn('설정', sheetSettings)]),
    fullCan() ? el('div', { class: 'row' }, [flatBtn(fullOn() ? '창 모드' : '전체 화면', () => { fullToggle(); closeSheet(); })]) : null,
    // (a ranked game cannot be started again: leaving it gives it up)
    flow === match && match.ctx && match.ctx.online && match.ctx.online.watch ? el('div', { class: 'row' }, [flatBtn('관전 그만', () => { closeSheet(); goHome(true); })])
      : flow === match && match.ctx && match.ctx.online ? el('div', { class: 'row' }, [flatBtn('기권', () => { closeSheet(); ranked.resign(); })])
      : el('div', { class: 'row' }, [flatBtn('다시 시작', () => { closeSheet(); flow.restart(); }), flatBtn('처음으로', () => goHome(true))]),
  ]);
}
