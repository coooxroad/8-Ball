/* Deployment identity: a working URL alone can still be serving an older APK's page. No secrets go in this file. */
const fs = require('node:fs');
const [mode, file] = process.argv.slice(2);
const commit = process.env.SOURCE_SHA, apkBuild = process.env.APK_BUILD ? Number(process.env.APK_BUILD) : null;
if (!/^[0-9a-f]{40}$/.test(commit || '') ||
    (apkBuild !== null && (!Number.isSafeInteger(apkBuild) || apkBuild < 1))) throw new Error('Invalid deployment identity');
const expected = { commit, apkBuild };
if (mode === 'write' && file) fs.writeFileSync(file, JSON.stringify(expected) + '\n');
else if (mode === 'check' && file) {
  const actual = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (actual?.commit !== commit || actual?.apkBuild !== apkBuild) throw new Error('The web is not serving the requested APK version yet');
  console.log(`Verified commit ${commit}, APK build ${apkBuild ?? 'manual web deployment'}`);
} else throw new Error('Usage: node version.cjs write|check <file>');
