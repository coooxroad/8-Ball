/* Makes scene/02-ltc.js: the tables three.js's rectangular light (RectAreaLight) needs to shade - the "linearly transformed
   cosines" fit of Heitz, Dupuy, Hill and Neubelt (https://github.com/selfshadow/ltc_code), as three r128 ships it in
   examples/js/lights/RectAreaLightUniformsLib.js (MIT). Two 64x64 RGBA tables; kept here as half floats in base64 (88 KB
   instead of the example's 314 KB of numbers), which is what three itself uses where float textures can't be filtered.
   Run once, with the example file at hand:
     npm pack three@0.128.0 && tar xzf three-0.128.0.tgz package/examples/js/lights/RectAreaLightUniformsLib.js
     node tools/ltc.js package/examples/js/lights/RectAreaLightUniformsLib.js */
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(process.argv[2], 'utf8');
// (numbers there are written "- 4.5e-07", a space after the sign: read as numbers, not as JSON)
const table = name => src.match(new RegExp('const ' + name + ' = \\[([^\\]]*)\\]'))[1].split(',').map(t => +t.replace(/\s+/g, ''));
// float -> half float, as three's DataUtils.toHalfFloat (r128)
const f32 = new Float32Array(1), u32 = new Int32Array(f32.buffer);
function half(v) {
  f32[0] = v; const x = u32[0];
  let bits = (x >> 16) & 0x8000, m = (x >> 12) & 0x07ff; const e = (x >> 23) & 0xff;
  if (e < 103) return bits;
  if (e > 142) { bits |= 0x7c00; bits |= ((e == 255) ? 0 : 1) && (x & 0x007fffff); return bits; }
  if (e < 113) { m |= 0x0800; bits |= (m >> (114 - e)) + ((m >> (113 - e)) & 1); return bits; }
  bits |= ((e - 112) << 10) | (m >> 1); bits += m & 1; return bits;
}
const b64 = a => Buffer.from(new Uint16Array(a.map(half)).buffer).toString('base64');
const [t1, t2] = [table('LTC_MAT_1'), table('LTC_MAT_2')];
if (t1.length !== 16384 || t2.length !== 16384) throw new Error('unexpected table size');
const out = `  /* The rectangular light's tables (made by tools/ltc.js from three r128's RectAreaLightUniformsLib, MIT; the fit of
     Heitz, Dupuy, Hill and Neubelt): two 64x64 RGBA tables as half floats, base64. Put into three's uniform library once,
     before anything lit by a RectAreaLight is drawn (10-room.js). */
  function initAreaLight() {
    const U = THREE.UniformsLib; if (U.LTC_HALF_1) return;
    const dec = s => { const b = atob(s), u = new Uint16Array(b.length / 2); for (let i = 0; i < u.length; i++) u[i] = b.charCodeAt(2 * i) | (b.charCodeAt(2 * i + 1) << 8); return u; };
    const toFloat = h => { const s = (h & 0x8000) ? -1 : 1, e = (h >> 10) & 0x1f, m = h & 0x3ff; return e === 0 ? s * m * Math.pow(2, -24) : e === 31 ? (m ? NaN : s * Infinity) : s * (1 + m / 1024) * Math.pow(2, e - 15); };
    const tex = (data, type) => new THREE.DataTexture(data, 64, 64, THREE.RGBAFormat, type, THREE.UVMapping, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping, THREE.LinearFilter, THREE.NearestFilter, 1);
    [LTC_1, LTC_2].forEach((s, i) => { const h = dec(s), f = Float32Array.from(h, toFloat);
      U['LTC_HALF_' + (i + 1)] = tex(h, THREE.HalfFloatType); U['LTC_FLOAT_' + (i + 1)] = tex(f, THREE.FloatType); });
  }
  const LTC_1 = '${b64(t1)}';
  const LTC_2 = '${b64(t2)}';
`;
fs.writeFileSync(path.join(__dirname, '../scene/02-ltc.js'), out);
console.log('scene/02-ltc.js', out.length, 'bytes');
