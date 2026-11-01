/* Makes src/gen/engine.js from the game's own files, so the server plays shots on exactly the code the app plays them on.
   The files are plain scripts (their node-export lines are dropped, as web/build.sh does); this wraps them in a module. */
const fs = require('fs'), path = require('path');
const W = path.join(__dirname, '..', '..', 'web'), OUT = path.join(__dirname, '..', 'src', 'gen');
const files = [...fs.readdirSync(path.join(W, 'content')).sort().map(f => 'content/' + f), 'tables.js', 'economy.js', 'physics.js', 'game.js', 'puzzles.js', 'highlights.js'];
let src = '/* Made by server/tools/pack.js from web/ - do not edit. */\n';
for (const f of files) src += `// ---- web/${f}\n` + fs.readFileSync(path.join(W, f), 'utf8').split('\n').filter(l => !l.startsWith('if (typeof module')).join('\n') + '\n';
src += 'export { RARITY, CLOTHS, CUES, BALLSKINS, TRAILS, GLOVES, TABLES, CAROM, physicsFor, ECONOMY, matchCoins, tourPayout, priceOf, damaAfter, createPhysics, createGame, createPuzzles, createHighlights };\n';
fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, 'engine.js'), src);
console.log('engine packed:', files.length, 'files,', src.length, 'bytes');
