/* Four-ball puzzles, in stages. Made by tools/gen-puzzles.js from positions that came up in games between two computer
   players, and kept only with an answer that was seen to work (sol: [direction, speed, side, follow/draw, cue raised, jump]).
   balls: cue, yellow, red, red. A stage's goal says what the shot has to do (see the puzzle rules in game.js). */
function createPuzzles() {
  const STAGES = [{"name":"첫 득점","goal":"score","desc":"가까운 두 공을 한 번에","trick":false},{"name":"모아치기","goal":"gather","desc":"치고 나서 세 공이 한데 모이게","trick":false},{"name":"빈쿠션","goal":"bank","desc":"쿠션을 먼저 맞히고 들어가기","trick":false},{"name":"밀어치기 · 끌어치기","goal":"direct","desc":"쿠션 없이, 위아래 회전으로","trick":false},{"name":"상대 공 피해 가기","goal":"score","desc":"노란 공을 건드리지 않고","trick":false},{"name":"돌려치기","goal":"three","desc":"쿠션 세 번을 돌아서","trick":false},{"name":"맛세이 · 점프","goal":"direct","desc":"막은 공을 넘거나 휘어서","trick":true}];
  // (emptied: the puzzles are being made again on the game's physics; tools/gen-puzzles.js makes them)
  const list = [];
  return { list, STAGES, byId: id => list.find(p => p.id === id), of: s => list.filter(p => p.stage === s) };
}
if (typeof module !== 'undefined') module.exports = createPuzzles;
