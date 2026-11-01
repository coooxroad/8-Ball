/* Boundary checks and a stable identity for a recorded match. Transport request numbers are not match identities:
   the same play must not pay twice when retried with a new request number or with presentation-only fields changed. */
import { createHash } from 'node:crypto';
import { TABLES } from './gen/engine.js';

const BALLS = { eight: 16, nine: 10, four: 4, three: 3 };
const num = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const integer = (v, lo, hi) => Number.isInteger(v) && num(v, lo, hi);
export const shotOk = s => object(s) && num(s.aim, -20, 20) && num(s.V, 0, 12) && num(s.a, -1, 1) && num(s.b, -1, 1) && num(s.el ?? 0, 0, Math.PI / 2);

// These checks also run before sampling: malformed data must never enter the account's verification queue.
export function logError(log) {
  if (!object(log) || !Object.hasOwn(BALLS, log.mode) || !integer(log.winner, 0, 1) ||
      !Array.isArray(log.shots) || !log.shots.length || log.shots.length > 600) return 'bad log';
  if (log.table != null && !TABLES.some(t => t.id === log.table)) return 'bad table';
  const o = log.opts ?? {};
  if (!object(o) || (o.first != null && !integer(o.first, 0, 1)) ||
      (o.target != null && !integer(o.target, 1, 60)) || (o.cushions != null && ![0, 1, 3].includes(o.cushions)) ||
      (o.targets != null && (!Array.isArray(o.targets) || o.targets.length !== 2 || !o.targets.every(v => integer(v, 1, 60))))) return 'bad rules';
  for (const key of ['tens', 'finish', 'ice']) if (o[key] != null && typeof o[key] !== 'boolean') return 'bad rules';
  if (!Array.isArray(log.points) || log.points.length !== 2 || !log.points.every(v => integer(v, 0, 10000))) return 'bad points';
  for (const s of log.shots) {
    if (!object(s)) return 'bad shot';
    if (s.timeout === true) continue;
    if (!shotOk(s) || !object(s.s) || !integer(s.s.cue, 0, BALLS[log.mode] - 1) ||
        !Array.isArray(s.s.balls) || s.s.balls.length !== BALLS[log.mode]) return 'bad shot';
    for (const b of s.s.balls) {
      if (!Array.isArray(b) || b.length !== 6 || !b.slice(0, 2).every(Number.isFinite) ||
          ![0, 1, false, true].includes(b[2]) || !b.slice(3, 5).every(Number.isFinite) ||
          !Array.isArray(b[5]) || b[5].length !== 4 || !b[5].every(Number.isFinite)) return 'bad snapshot';
    }
  }
  return null;
}

export function matchKey(log) {
  const o = log.opts || {}, target = o.target || 10;
  const rules = [o.first || 0, target, o.cushions || 0, o.targets || [target, target], !!o.tens, !!o.finish, !!o.ice];
  const shots = log.shots.map(s => s.timeout === true ? ['timeout'] :
    [s.aim, s.V, s.a, s.b, s.el || 0, s.s.cue, s.s.balls.map(b => [b[0], b[1], b[2] ? 1 : 0])]);
  // Claimed points, winner, quaternions, client ids and arbitrary extra fields cannot turn one play into a new claim.
  return createHash('sha256').update(JSON.stringify([log.mode, log.table || 'bar', rules, shots])).digest('hex');
}
