'use strict';
/* Every puzzle rated again by the seeing AI (see.js - owner 11-25 night), beside the puzzle AI's rating it has (ai.js):
   the gap between what the physics finds and what a person sees, puzzle by puzzle.

     node web/tools/puzzles/see-rate.js --part 0/2 --out a.json     # a share of the list (one worker each); kept as it goes
     node web/tools/puzzles/see-rate.js --merge a.json b.json --report ../../../docs/puzzle-see-gap.md [--write]
       --report   the gap report (markdown): how far the two ratings lie apart, by kind; the puzzles no person finds a way
                  in (fair: the surest real way a 2400 player sees comes to mind under half the time); the biggest moves
       --write    the seeing AI's ratings into web/puzzles.js - half way from the old, --weight 1 for all the way (a puzzle no person finds a way in keeps its rating - it is
                  listed in the report, for the owner to take out), and see-ratings.json (the Fit workflow reads it)
       --ratings  see-ratings.json only */
const fs = require('fs'), path = require('path'), L = require('./lab'), SEE = require('./see');
const args = process.argv.slice(2), opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : null; };
const kindOf = z => L.Z.gameOf(z) === 'pocket' ? 'pocket' : L.Z.plain(z) ? 'plain' : 'cond';
if (!args.includes('--merge')) {
  const [pi, pn] = (opt('part') || '0/1').split('/').map(Number), file = opt('out') || 'see-rate.json';
  const done = fs.existsSync(file) ? new Map(JSON.parse(fs.readFileSync(file, 'utf8'))) : new Map();
  const ids = opt('ids') ? new Set(opt('ids').split(',').map(Number)) : null;
  for (const z of L.Z.list.filter((q, i) => i % pn === pi && (!ids || ids.has(q.id)))) {
    if (done.has(z.id)) continue;
    const t = Date.now(); let r;
    try { r = SEE.rateSee(z, { explain: true }); } catch (e) { console.log(`${z.id}: ${e.message}`); continue; }
    done.set(z.id, { id: z.id, kind: kindOf(z), game: L.Z.gameOf(z), goal: L.Z.goalOf(z), table: z.table || 'rect', turns: L.Z.turnsOf(z), old: z.rating, see: r.rating, e: r.e, fair: r.fair, at: r.at });
    fs.writeFileSync(file, JSON.stringify([...done]));
    console.log(`${z.id} ${kindOf(z)}: ${z.rating} -> ${r.rating}  fair ${r.fair}  (${((Date.now() - t) / 1000).toFixed(1)} s)`);
  }
  process.exit(0);
}
// ---- merge: the report, and (--write) the ratings
const all = new Map(); for (const f of args.slice(args.indexOf('--merge') + 1).filter(a => !a.startsWith('--') && /\.json$/.test(a))) for (const [id, r] of JSON.parse(fs.readFileSync(f, 'utf8'))) all.set(+id, r);
const rows = [...all.values()], FAIR = 0.5;
const stat = list => {
  if (!list.length) return null;
  const d = list.map(r => r.see - r.old), mean = d.reduce((a, x) => a + x, 0) / d.length, abs = d.reduce((a, x) => a + Math.abs(x), 0) / d.length;
  const mo = list.reduce((a, r) => a + r.old, 0) / list.length, ms = list.reduce((a, r) => a + r.see, 0) / list.length;
  const cov = list.reduce((a, r) => a + (r.old - mo) * (r.see - ms), 0), so = Math.sqrt(list.reduce((a, r) => a + (r.old - mo) ** 2, 0)), ss = Math.sqrt(list.reduce((a, r) => a + (r.see - ms) ** 2, 0));
  return { n: list.length, mean: Math.round(mean), abs: Math.round(abs), corr: so && ss ? Math.round(cov / so / ss * 100) / 100 : null };
};
const way = q => q ? `${q.kiss ? '키스 ' : ''}쿠션 ${q.feats.cushions}${q.feats.kick ? `·먼저 쿠션 ${q.feats.kick}` : ''}${q.feats.bank ? '·뱅크' : ''}${q.feats.combo ? '·콤비' : ''}${q.feats.fb ? '·밀고/끌고' : ''}${q.feats.side ? '·회전' : ''}${q.feats.raised ? '·세운 큐' : ''}${q.feats.graze ? `·스침 ${q.feats.graze}` : ''}` : '-';
// (no way a person finds: even a 2900 player, three tries, solves it under half the time - e(2900) < 1/2)
const unfair = rows.filter(r => !(r.e && r.e[1] >= 0.5));
if (opt('report')) {
  const lines = [];
  lines.push('# 퍼즐 괴리 보고서 — 물리가 찾은 길 대 사람이 보는 길 (보는 AI v2, 11-26 밤)', '');
  lines.push(`퍼즐 ${rows.length}개를 보는 AI(\`web/tools/puzzles/see.js\`)로 다시 매겼다. 옛 레이팅 = 퍼즐 AI(ai.js — 물리가 찾은 길에 고정 표 FIND),`);
  lines.push('새 레이팅 = 그 레이팅의 사람이 테이블을 보는 그림(가이드 그대로 + 그 너머는 직선·거울 쿠션에 레이팅만큼의 보정)으로 떠올리고 고르고 치는 가상 플레이어.');
  lines.push('실제 시도로 움직인 레이팅은 서버(관리자 비밀번호 필요)에 있어 이번엔 못 넣었다 — Fit 워크플로가 들어가면 셋째 열로 붙는다.', '');
  lines.push('## 한눈에', '', '| 묶음 | 개수 | 평균 이동 | 평균 차이(절대) | 옛·새 상관 |', '|---|---|---|---|---|');
  for (const [name, list] of [['전체', rows], ['4구 일반', rows.filter(r => r.kind === 'plain')], ['4구 조건', rows.filter(r => r.kind === 'cond')], ['포켓', rows.filter(r => r.kind === 'pocket')], ['두 턴', rows.filter(r => r.turns > 1)]]) {
    const s = stat(list); if (s) lines.push(`| ${name} | ${s.n} | ${s.mean > 0 ? '+' : ''}${s.mean} | ${s.abs} | ${s.corr} |`);
  }
  lines.push('', `## 사람이 길을 못 찾는 퍼즐 (${unfair.length}개)`, '');
  lines.push('2900 플레이어도 세 번 안에 반을 못 푼다(보는 AI) — 물리만 아는 답. 지우지 않았고 레이팅도 그대로 뒀다(소유자 확인 후). 괄호: 옛 레이팅, 2900의 성공 기대, 2400 플레이어가 첫 시도에 되는 진짜 길을 떠올릴 확률. 목록:', '');
  lines.push(unfair.map(r => `${r.id}(${r.kind}${r.turns > 1 ? '·두 턴' : ''}, ${r.old}, ${r.e ? r.e[1] : '-'}, ${r.fair})`).join(', ') || '없음', '');
  lines.push('## 가장 크게 움직인 20개', '', '| id | 묶음 | 옛 | 새 | 그 레이팅의 사람이 먼저 치는 길 | 볼 확률 | 실제 성공 | 그림이 어긋난 각 |', '|---|---|---|---|---|---|---|---|');
  for (const r of rows.slice().sort((a, b) => Math.abs(b.see - b.old) - Math.abs(a.see - a.old)).slice(0, 20)) {
    const q = (r.at && r.at[r.see] || [])[0];
    lines.push(`| ${r.id} | ${r.kind}${r.turns > 1 ? '·두 턴' : ''} | ${r.old} | ${r.see} | ${way(q)} | ${q ? q.seen : '-'} | ${q ? q.p : '-'} | ${q && q.off != null ? q.off + '°' : '-'} |`);
  }
  lines.push('', '## 읽는 법', '');
  lines.push(`- \`web/puzzles.js\`에는 옛과 새의 가운데(가중치 0.5)를 넣었다 — 두 추정 모두 아직 실제 시도로 맞춰지지 않았으므로. 보는 AI만 쓰려면 \`--write --weight 1\`.`);
  lines.push('- 두 턴 퍼즐은 레이팅을 그대로 뒀다 — 둘째 턴을 첫 길 하나가 남긴 자리에서만 읽어 아직 거칠다(위 표의 두 턴 숫자도 그만큼 덜 믿을 것).');
  lines.push('- **새 > 옛**: 답이 사람 눈에 잘 안 보이거나(볼 확률 낮음) 그림이 실제와 어긋나(그림이 어긋난 각 큼) 사람이 노린 곳이 빗나간다 — 옛 AI가 쉽게 본 퍼즐.');
  lines.push('- **새 < 옛**: 넓은 길이 여럿이라 사람이 쉽게 찾는다 — 옛 AI가 길 하나의 어려움으로 매긴 퍼즐.');
  lines.push('- 숫자는 손으로 정한 값(`MIND`)이다. 실제 시도가 쌓이면 Fit 워크플로로 맞춘다(계획 8-3).');
  fs.writeFileSync(opt('report'), lines.join('\n') + '\n');
  console.log('wrote ' + opt('report'));
}
const s0 = stat(rows); console.log(`rated ${rows.length}: mean move ${s0 && s0.mean}, mean gap ${s0 && s0.abs}, corr ${s0 && s0.corr}; no human way: ${unfair.length}`);
// (for the Fit workflow - web/tools/see/fit.js: each puzzle's seeing-AI rating and what the way its rater plays first asks)
if (args.includes('--write') || args.includes('--ratings')) {
  const out = rows.map(r => { const q = (r.at && r.at[r.see] || [])[0]; return { id: r.id, game: r.game, see: r.see, fair: r.fair, feats: q ? q.feats : null }; }).sort((a, b) => a.id - b.id);
  fs.writeFileSync(path.join(__dirname, 'see-ratings.json'), '[\n' + out.map(o => JSON.stringify(o)).join(',\n') + '\n]\n'); console.log('wrote see-ratings.json');
}
if (args.includes('--write')) {
  /* (--weight w: the rating written is old + w (seeing AI - old). Two estimates whose errors are not yet known - the
     seeing AI's numbers are set by hand until the Fit has real attempts - are best taken half and half; 1: the seeing
     AI's alone) */
  const FILE = path.join(__dirname, '../../puzzles.js'), wt = Math.max(0, Math.min(1, +(opt('weight') || 0.5))); let n = 0;
  const src = fs.readFileSync(FILE, 'utf8').replace(/^(\s*)(\{"id":(\d+),.*\})(,?)\n/gm, (m, ind, json, id, comma) => {
    // (two turns: the second read from where one first way leaves the balls - too rough yet to move a rating by)
    const q = JSON.parse(json), r = all.get(+id); if (!r || unfair.includes(r) || r.turns > 1) return m;
    q.rating = Math.round((r.old + wt * (r.see - r.old)) / 5) * 5; n++; return ind + JSON.stringify(q) + comma + '\n';
  });
  fs.writeFileSync(FILE, src); console.log(`wrote ${n} ratings into web/puzzles.js (weight ${wt})`);
}
