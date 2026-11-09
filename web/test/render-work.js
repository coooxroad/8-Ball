/* Exercise the production helpers with Three's real buffers, without needing a GPU. The browser graphics check
   also covers drawing and context restoration. No physics, path sampling, texture size or quality setting changes. */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const THREE = require('../three.min.js');
const source = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
{
  const src = source('scene/30-balls.js');
  const { ballSet, blobSync } = new Function('THREE', 'scene', 'sphere', 'unitPlane', 'blobMat', 'lampShadowMat', 'LAMPS',
    src.slice(src.indexOf('  const blobM ='), src.indexOf('  const sets =')) + '\nreturn { ballSet, blobSync };')(
    THREE, new THREE.Scene(), new THREE.SphereGeometry(), new THREE.PlaneGeometry(), new THREE.MeshBasicMaterial(), new THREE.MeshBasicMaterial(), [0, 1, 2]);
  for (const n of [16, 4]) {
    const set = ballSet('pool', n, 0.028575);
    for (let i = 0; i < n; i++) { const s = set.blob[i]; s.visible = true;
      for (const o of s.children) { o.position.x = 0.123456789 + i * 0.1; o.position.y = -i * 0.037; } }
    const verify = on => {
      blobSync(set, on);
      const expected = [[], []], m = new THREE.Matrix4();
      if (on) for (const s of set.blob) if (s.visible) for (let k = 0; k < s.children.length; k++) {
        const o = s.children[k]; m.compose(o.position, o.quaternion, o.scale); expected[k ? 1 : 0].push(...m.elements);
      }
      set.ims.forEach((im, k) => {
        assert.equal(im.count, expected[k].length / 16);
        assert.equal(im.visible, im.count > 0);
        assert.deepEqual(im.instanceMatrix.array.slice(0, im.count * 16), new Float32Array(expected[k]), 'exact shadow matrices, including compacted slots');
      });
    };
    const versions = () => set.ims.map(im => im.instanceMatrix.version);
    verify(true); const still = versions();
    for (let i = 0; i < 120; i++) verify(true);
    assert.deepEqual(versions(), still, 'stationary balls do not upload during cue/camera animations');
    set.blob[2].children[0].position.x += 0.02; verify(true);
    assert.equal(versions()[0], still[0] + 1); assert.equal(versions()[1], still[1]);
    set.blob[1].visible = false; verify(true); // pocketing changes every subsequent instance's slot
    set.blob[1].visible = true; verify(true);
    for (const s of set.blob) for (const o of s.children) o.scale.multiplyScalar(1.2);
    set.blob[0].children[1].rotation.z = 0.15; verify(true); // table size and transforms
    const changed = versions(); verify(false); verify(false); verify(true);
    assert.deepEqual(versions(), changed, 'hiding/switching table sets preserves already uploaded matrices');
    for (const s of set.blob) s.visible = false;
    verify(true); set.blob[n - 1].visible = true; verify(true);
  }
}
{
  const src = source('scene/50-guide.js');
  const { ribbon, m } = new Function('THREE', 'scene', 'col', 'ppm',
    src.slice(0, src.indexOf('  // a copy of the path')) + '\nreturn { ribbon, m: rPre };')(THREE, new THREE.Scene(), x => x, 300);
  // Grow, shrink, then grow again before a draw: all visible vertices must be in the next upload.
  for (const n of [3, 450, 2, 1199, 7]) {
    const pts = []; for (let i = 0; i < n; i++) pts.push(i * 0.01, 0, 0);
    ribbon(m, pts, { m: 0.02, color: 0xffffff }, 0.03);
    assert(m.visible); assert.equal(m.geometry.drawRange.count, (n - 1) * 6);
    for (const key of ['position', 'a', 's']) {
      const attr = m.geometry.attributes[key];
      assert.deepEqual(attr.updateRange, { offset: 0, count: n * 2 * attr.itemSize });
    }
    const p = m.geometry.attributes.position.array;
    for (let i = 0; i < n; i++) assert.deepEqual(p.slice(i * 6, i * 6 + 6),
      new Float32Array([i * 0.01, -0.01, 0.03, i * 0.01, 0.01, 0.03]));
  }
}
{
  const src = source('app/32-desk.js');
  // The callbacks stay queued until the test releases them, including a deliberately slow PNG encoding.
  for (const idleSupported of [true, false]) {
    const raf = [], idle = [], timers = [], enc = [], events = {};
    const st = { screen: 'home' }, document = { hidden: false, addEventListener: (k, fn) => { events[k] = fn; } };
    let made = 0;
    const window = idleSupported ? { requestIdleCallback: fn => idle.push(fn) } : {};
    const { lazyPic, picsPump } = new Function('st', 'document', 'window', 'requestAnimationFrame', 'setTimeout', 'indexedDB', 'URL', 'BUILD_ID', 'prof', 'performance', 'innerWidth', 'innerHeight',
      src.slice(src.indexOf('const PICS ='), src.indexOf('const ballPic =')) + '\nreturn { lazyPic, picsPump };')(
      st, document, window, fn => raf.push(fn), fn => timers.push(fn), { open() { throw Error('unavailable'); } },
      { createObjectURL: () => 'blob:picture' }, 'test', { add() {} }, { now: () => 0 }, 1000, 800);
    const img = () => ({ isConnected: true, src: '', getBoundingClientRect: () => ({ width: 100, left: 0, top: 0, right: 100, bottom: 100 }) });
    const make = () => { made++; return { done: true, c: { toBlob: fn => enc.push(fn), toDataURL: () => 'data:picture' } }; };
    const run = () => { while (raf.length) raf.shift()(); const queue = idleSupported ? idle : timers; while (queue.length) queue.shift()(); };
    const a = img(), b = img(); lazyPic(a, 'same', make); lazyPic(b, 'same', make);
    assert.equal(made, 0, 'opening the list must paint before GPU readback');
    // Enter play after scheduling but before the readback callback runs.
    st.screen = 'play'; run(); assert.equal(made, 0);
    st.screen = 'home'; picsPump(); run(); assert.equal(made, 1);
    picsPump(); run(); assert.equal(made, 1, 'only one readback while encoding the same image');
    enc.shift()({}); assert.equal(a.src, 'blob:picture'); assert.equal(a.src, b.src);
    const cached = img(); lazyPic(cached, 'same', make); assert.equal(cached.src, a.src);
    const gone = img(); lazyPic(gone, 'gone', make); gone.isConnected = false; run(); assert.equal(made, 1);
    const hidden = img(); lazyPic(hidden, 'hidden', make); document.hidden = true; run(); assert.equal(made, 1);
    document.hidden = false; events.visibilitychange(); run(); assert.equal(made, 2);
    const later = img(); lazyPic(later, 'later', make); st.screen = 'play'; enc.shift()({}); run(); assert.equal(made, 2);
    st.screen = 'home'; picsPump(); run(); assert.equal(made, 3, 'returning to the desk resumes pending pictures'); enc.shift()({});
  }
}
console.log('render work: exact shadow buffers, bounded ribbon uploads, idle/deduplicated pictures and fallback passed');
