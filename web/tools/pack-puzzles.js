/* Writes web/puzzles.js from what tools/gen-puzzles.js produced for each stage (tools/out/s<stage>.json). */
const path = require('path'), fs = require('fs'), W = path.join(__dirname, '..'), OUT = path.join(__dirname, 'out');
// the order they are met in, easiest idea first, and what each asks in a few words
const ORDER = [[0, '가까운 두 공을 한 번에'], [1, '치고 나서 세 공이 한데 모이게'], [3, '쿠션을 먼저 맞히고 들어가기'], [2, '쿠션 없이, 위아래 회전으로'], [4, '노란 공을 건드리지 않고'], [5, '쿠션 세 번을 돌아서'], [6, '막은 공을 넘거나 휘어서']];
const stages = [], list = [];
ORDER.forEach(([k, desc]) => {
  const f = path.join(OUT, `s${k}.json`); if (!fs.existsSync(f)) return;
  const d = JSON.parse(fs.readFileSync(f)); if (!d.list.length) return;
  const si = stages.length; stages.push({ name: d.name, goal: d.goal, desc, trick: k === 6 });
  d.list.slice().sort((a, b) => b.share - a.share).forEach((p, i) => list.push({ id: list.length + 1, stage: si, n: i + 1, balls: p.balls, sol: p.sol }));   // easiest first
});
const js = `/* Four-ball puzzles, in stages. Made by tools/gen-puzzles.js from positions that came up in games between two computer
   players, and kept only with an answer that was seen to work (sol: [direction, speed, side, follow/draw, cue raised, jump]).
   balls: cue, yellow, red, red. A stage's goal says what the shot has to do (see the puzzle rules in game.js). */
function createPuzzles() {
  const STAGES = ${JSON.stringify(stages)};
  const list = [
${list.map(p => '    ' + JSON.stringify(p)).join(',\n')},
  ];
  return { list, STAGES, byId: id => list.find(p => p.id === id), of: s => list.filter(p => p.stage === s) };
}
if (typeof module !== 'undefined') module.exports = createPuzzles;
`;
fs.writeFileSync(path.join(W, 'puzzles.js'), js);
console.log(`wrote ${list.length} puzzles in ${stages.length} stages: ` + stages.map((s, i) => `${s.name} ${list.filter(p => p.stage === i).length}`).join(', '));
