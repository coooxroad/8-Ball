/* A ball set's stamp (tools/ball-pics.js): its entry in content/30-balls.js and the surface pictures it names - if either
   changes, its pictures in ui/balls are out of date and the app draws that set on the device again until they are made.
   `node web/tools/ball-stamp.js` prints the ids of the sets whose pictures are up to date (build.sh → BALL_PICS). */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const WEB = path.join(__dirname, '..');
const { BALLSKINS: SETS } = require(path.join(WEB, 'content', '30-balls.js'));
const texOf = name => { const f = path.join(WEB, 'tex', `ball-${name}.webp`); return fs.existsSync(f) ? fs.readFileSync(f) : Buffer.alloc(0); };
function stampOf(k) {
  const h = crypto.createHash('sha1').update(JSON.stringify(k));
  const pics = [k.mat, typeof k.skin === 'string' ? k.skin : null, k.finish && k.finish.bump, ...(k.caromSkins || []).map(c => c.pic)].filter(Boolean);
  for (const p of pics) h.update(texOf(p));
  return h.digest('hex').slice(0, 12);
}
const current = () => {
  const f = path.join(WEB, 'ui', 'balls', 'index.json'), index = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
  return SETS.filter(k => index[k.id] && index[k.id] === stampOf(k)).map(k => k.id);
};
module.exports = { stampOf, SETS, current };
if (require.main === module) process.stdout.write(JSON.stringify(current()));
