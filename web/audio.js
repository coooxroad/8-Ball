/* Sound. Ball and cue hits are short recordings (sounds.js); cushion, pocket and interface sounds are built from
   a few damped resonances. Table sounds go through one small "room"; interface sounds stay dry.
   The game only reports what happened, how hard, and where on the table (pan, -1 left .. 1 right):
   nothing here runs on a timer, so what is heard is what is seen. */
function createAudio(isOn) {
  let ac = null, out = null, ui = null, buf = null, roll = null, sink = null, white = null, music = null;
  const voices = new Set(), previous = {};
  const bursts = { ball: { time: -1, count: 0 }, rail: { time: -1, count: 0 } };

  // parts: [frequency Hz, decay time s, level]; push: how long the contact lasts
  function make(dur, push, parts, noise) {
    const sr = ac.sampleRate, n = Math.floor(dur * sr), b = ac.createBuffer(1, n, sr), d = b.getChannelData(0), pn = Math.max(2, Math.floor(push * sr));
    for (let i = 0; i < pn; i++) d[i] += 0.35 * Math.sin(Math.PI * i / pn) ** 2;
    for (const [f, tau, amp] of parts) {
      const w = 2 * Math.PI * f / sr, k = 1 / (tau * sr);
      for (let i = 0; i < n; i++) d[i] += amp * Math.exp(-i * k) * Math.sin(w * i) * Math.min(1, i / pn);
    }
    if (noise) {
      let lp = 0;
      for (let i = 0; i < n; i++) { lp += (Math.random() * 2 - 1 - lp) * noise[1]; d[i] += lp * noise[0] * Math.exp(-i / (noise[2] * sr)) * Math.min(1, i / pn); }
    }
    let mx = 0; for (let i = 0; i < n; i++) mx = Math.max(mx, Math.abs(d[i]));
    const fade = Math.floor(0.012 * sr);
    for (let i = 0; i < n; i++) d[i] = d[i] / Math.max(mx, 0.001) * 0.75 * Math.min(1, (n - 1 - i) / fade);
    return b;
  }

  /* The room: a pool hall is a wide, low, soft room (cloth, carpet, people), so the echo is short and dull.
     First the sound comes back off the table bed and the lamp above within a few milliseconds, then off the
     walls, then a quiet tail that loses its treble quickly. Left and right differ a little so it has width. */
  function room() {
    const sr = ac.sampleRate, len = Math.floor(0.55 * sr), ir = ac.createBuffer(2, len, sr), pre = 0.006;
    const early = [[2.1, 0.5], [3.7, -0.34], [6.3, 0.3], [9.8, -0.24], [14.2, 0.21], [19.5, 0.17], [26.4, -0.14], [34.0, 0.11], [43.5, 0.08]];
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch); let lo = 0;
      for (let i = Math.floor((pre + 0.03) * sr); i < len; i++) {
        const t = i / sr - pre, cut = 0.05 + 0.5 * Math.exp(-t / 0.09);                 // treble dies first
        lo += (Math.random() * 2 - 1 - lo) * cut;
        d[i] = lo * Math.exp(-t / 0.085) * Math.min(1, (t - 0.03) / 0.02) * 0.42;        // about 0.6 s to silence
      }
      for (const [ms, a] of early) { const i = Math.floor((pre + (ms * (ch ? 1.07 : 1)) / 1000) * sr); d[i] += a; d[i + 1] += a * 0.5; }
    }
    const send = ac.createGain(), hp = ac.createBiquadFilter(), lp = ac.createBiquadFilter(), conv = ac.createConvolver(), wet = ac.createGain();
    send.gain.value = 1; hp.type = 'highpass'; hp.frequency.value = 260; lp.type = 'lowpass'; lp.frequency.value = 5200;
    conv.normalize = false; conv.buffer = ir; wet.gain.value = 0.13;
    send.connect(hp); hp.connect(lp); lp.connect(conv); conv.connect(wet);
    return { input: send, output: wet };
  }

  function resume() { if (ac && ac.state === 'suspended') ac.resume().catch(() => {}); }
  function init() {
    if (ac) { resume(); return; }
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
      const lim = ac.createDynamicsCompressor();
      lim.threshold.value = -6; lim.knee.value = 6; lim.ratio.value = 4; lim.attack.value = 0.003; lim.release.value = 0.16;
      const master = ac.createGain(); master.gain.value = 0.85;
      out = ac.createGain(); out.connect(lim); lim.connect(master); master.connect(ac.destination);
      const rm = room(); out.connect(rm.input); rm.output.connect(lim); sink = lim;
      white = ac.createBuffer(1, ac.sampleRate, ac.sampleRate); { const d = white.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      ui = ac.createGain(); ui.gain.value = 0.9; ui.connect(master);
      const recorded = createBilliardsSamples(ac);
      const rail = [[240, 0.018, 0.45], [430, 0.012, 0.5], [760, 0.006, 0.18]];
      const pock = [[310, 0.026, 0.5], [490, 0.017, 0.4], [830, 0.008, 0.22]];
      buf = {
        ball: recorded.ball, cue: recorded.cue,
        rail: [make(0.12, 0.003, rail, [0.15, 0.1, 0.014])],
        pock: [make(0.18, 0.002, pock, [0.2, 0.12, 0.035])],
        roll: [make(0.24, 0.015, [[180, 0.06, 0.18]], [0.65, 0.05, 0.07])],                                 // the ball settling at the bottom of the pocket
        tick: [make(0.05, 0.0005, [[1250, 0.005, 0.5], [2600, 0.0025, 0.25], [620, 0.009, 0.2]])],           // a fingernail on wood
        note: [make(0.6, 0.001, [[523.25, 0.16, 0.6], [1046.5, 0.07, 0.22], [2093, 0.03, 0.08]])],           // one soft mallet note (C5)
      };
      // balls rolling on cloth: a low murmur that follows how much is moving
      const rn = Math.floor(ac.sampleRate * 1.5), rb = ac.createBuffer(1, rn, ac.sampleRate), rd = rb.getChannelData(0);
      let lp = 0; for (let i = 0; i < rn; i++) { lp += (Math.random() * 2 - 1 - lp) * 0.06; rd[i] = lp * 3; }
      for (let i = 0; i < 2000; i++) { const k = i / 2000; rd[i] = rd[i] * k + rd[rn - 2000 + i] * (1 - k); }   // the loop point is cross-faded
      const src = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain();
      src.buffer = rb; src.loop = true; src.loopEnd = (rn - 2000) / ac.sampleRate; bp.type = 'bandpass'; bp.frequency.value = 260; bp.Q.value = 0.6; g.gain.value = 0;
      src.connect(bp); bp.connect(g); g.connect(out); src.start();
      roll = { bp, g, k: 0 };
      resume();
    } catch (e) {
      if (ac) ac.close().catch(() => {});
      ac = null; out = null; ui = null; buf = null; roll = null; sink = null; white = null;
    }
  }
  const ready = () => ac && buf && isOn();

  function hit(name, gain, bright, at = 0, rate = 1, layer = -1, pan = 0, bus = out) {
    if (!ready() || gain <= 0 || voices.size >= 48) return;
    const list = buf[name];
    // do not play the identical recording twice in a row
    let index = layer >= 0 ? layer : Math.floor(Math.random() * list.length);
    if (layer < 0 && list.length > 1 && index === previous[name]) index = (index + 1) % list.length;
    previous[name] = index;
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(), t = ac.currentTime + at;
    s.buffer = list[index]; s.playbackRate.value = rate;
    f.type = 'lowpass'; f.frequency.value = Math.min(bright, ac.sampleRate * 0.45); f.Q.value = 0.5; g.gain.value = gain;
    s.connect(f); f.connect(g);
    const p = pan && ac.createStereoPanner ? ac.createStereoPanner() : null;
    if (p) { p.pan.value = Math.max(-1, Math.min(1, pan)); g.connect(p); p.connect(bus); } else g.connect(bus);
    voices.add(s);
    s.onended = () => { s.disconnect(); f.disconnect(); g.disconnect(); if (p) p.disconnect(); voices.delete(s); };
    s.start(t);
  }
  // Several contacts in the same instant (a break) are all kept, slightly staggered and capped, so they neither
  // collapse into one click nor overload the device.
  function impact(name, v, scale, level, low, high, max, pan) {
    if (!ready() || !Number.isFinite(v) || v <= 0) return;
    const burst = bursts[name], now = ac.currentTime;
    if (now - burst.time >= 0.012) { burst.time = now; burst.count = 0; }
    if (burst.count >= max) return;
    const slot = burst.count++, k = Math.min(1, v / scale);
    const gain = level * Math.pow(k, 0.65) / Math.sqrt(1 + slot * 0.3);
    const bright = low + high * Math.sqrt(k), at = slot * 0.0018, rate = 0.995 + Math.random() * 0.01;
    if (name === 'ball') {
      // blend the soft / medium / hard recordings so the tone changes smoothly with speed
      if (voices.size > 46) return;
      const position = v < 1.8 ? Math.max(0, (v - 0.35) / 1.45) : 1 + Math.min(1, (v - 1.8) / 3.2);
      const a = Math.min(1, Math.floor(position)), u = position - a, mix = u * u * (3 - 2 * u);
      hit(name, gain * (1 - mix), bright, at, rate, a, pan);
      hit(name, gain * mix, bright, at, rate, a + 1, pan);
    } else hit(name, gain, bright, at, rate, -1, pan);
  }
  // interface sounds: dry, quiet, and made of the same wood-and-mallet material as the table sounds
  const uiHit = (name, gain, bright, at, rate) => hit(name, gain, bright, at, rate, -1, 0, ui);
  /* ---------- highlight-reel music: a short phonk-style beat, written for this game and played by small synths ----------
     Cowbell melody, distorted 808 bass, kick, clap and fast hats at 142 BPM. It idles on a build-up until drop() is
     called, then plays the full pattern from that instant, so the drop lands exactly on the moment being shown. */
  const BEAT = 60 / 142, STEP = BEAT / 4;
  const G4 = 392, Bb4 = 466.16, C5 = 523.25, D5 = 587.33, Eb5 = 622.25;
  const MELODY = [[0, G4], [2, G4], [3, Bb4], [6, G4], [8, D5], [10, C5], [12, Bb4], [14, G4], [16, G4], [18, G4], [19, Bb4], [22, G4], [24, Eb5], [26, D5], [28, C5], [30, Bb4]];
  const BASS = [[0, 49], [6, 49], [10, 58.27], [16, 49], [22, 49], [26, 43.65], [29, 46.25]];
  function phonk() {
    const bus = ac.createGain(), drive = ac.createWaveShaper(), n = 512, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) curve[i] = Math.tanh((i / (n - 1) * 2 - 1) * 2.4);
    drive.curve = curve; bus.gain.value = 0.0001; bus.connect(drive); drive.connect(sink);
    const live = [];                                            // sources scheduled but not finished, so a drop can cut the build-up off
    const keep = (src, t, stop) => { live.push({ src, t }); src.start(t); src.stop(stop); src.onended = () => { const i = live.findIndex(x => x.src === src); if (i >= 0) live.splice(i, 1); }; };
    const env = (t, peak, dur) => { const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); g.connect(bus); return g; };
    const kick = t => { const o = ac.createOscillator(); o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.11); o.connect(env(t, 1, 0.24)); keep(o, t, t + 0.26); };
    const bass = (t, f, dur) => { const o = ac.createOscillator(); o.frequency.setValueAtTime(f * 2.2, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.05); o.connect(env(t, 0.9, dur)); keep(o, t, t + dur + 0.02); };
    const cow = (t, f, vol) => {
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 1.3; bp.Q.value = 2.2; bp.connect(env(t, vol, 0.26));
      for (const k of [1, 1.504]) { const o = ac.createOscillator(); o.type = 'square'; o.frequency.value = f * k; o.connect(bp); keep(o, t, t + 0.28); }
    };
    const noise = (t, type, freq, q, vol, dur) => { const s = ac.createBufferSource(), f = ac.createBiquadFilter(); s.buffer = white; s.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q; s.connect(f); f.connect(env(t, vol, dur)); keep(s, t, t + dur + 0.02); return f; };
    const hat = (t, vol) => noise(t, 'highpass', 7200, 0.7, vol, 0.035);
    const clap = t => noise(t, 'bandpass', 1500, 0.8, 0.55, 0.15);
    let mode = 'build', next = ac.currentTime + 0.05, step = 0, timer = 0;
    bus.gain.exponentialRampToValueAtTime(0.42, ac.currentTime + 0.3);
    function schedule() {
      while (next < ac.currentTime + 0.25) {
        const t = next, s = step % 32;
        if (mode === 'build') {                                 // tension: ticking hats, a pulse, a cowbell that keeps asking
          if (s % 2 === 0) hat(t, 0.12 + 0.012 * Math.min(16, step));
          if (s % 8 === 0) cow(t, G4, 0.22);
          if (s % 4 === 0) kick(t);
          if (step > 8 && s % 2 === 1) hat(t, 0.1);
        } else {
          if (s % 16 === 0 || s % 16 === 6 || s % 16 === 10) kick(t);
          if (s % 16 === 4 || s % 16 === 12) clap(t);
          hat(t, s % 2 ? 0.1 : 0.2); if (s % 16 >= 14) hat(t + STEP / 2, 0.14);
          for (const [k, f] of MELODY) if (k === s) cow(t, f, 0.5);
          for (const [k, f] of BASS) if (k === s) bass(t, f, STEP * 3.4);
        }
        next += STEP; step++;
      }
    }
    timer = setInterval(schedule, 60); schedule();
    return {
      drop() {
        if (mode === 'drop') return; mode = 'drop';
        const now = ac.currentTime;
        for (const x of live.slice()) if (x.t > now) { try { x.src.stop(); } catch (e) {} }
        next = now + 0.01; step = 0; schedule();
      },
      stop() { clearInterval(timer); const t = ac.currentTime; bus.gain.cancelScheduledValues(t); bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), t); bus.gain.exponentialRampToValueAtTime(0.0001, t + 0.5); setTimeout(() => { for (const x of live.slice()) { try { x.src.stop(); } catch (e) {} } try { drive.disconnect(); } catch (e) {} }, 650); },
    };
  }

  return {
    init,
    music: {
      start() { if (!ready()) return; if (music) music.stop(); music = phonk(); },
      drop() { if (music) music.drop(); },
      stop() { if (music) { music.stop(); music = null; } },
    },
    // a deep thump for the big moment, and a tiny rising blip for a cushion in the reel
    boom() {
      if (!ready()) return; const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
      o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(34, t + 0.5);
      g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.75);
    },
    blip() {
      if (!ready()) return; const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(620, t); o.frequency.exponentialRampToValueAtTime(1240, t + 0.07);
      g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09); o.connect(g); g.connect(ui); o.start(t); o.stop(t + 0.1);
    },
    ball(v, pan) { impact('ball', v, 5, 0.95, 2200, 6300, 6, pan); },
    rail(v, pan) { impact('rail', v, 4, 0.48, 750, 1700, 3, pan); },
    cue(v, pan) {
      if (!Number.isFinite(v) || v <= 0) return;
      const k = Math.min(1, v / 9);
      hit('cue', 0.95 * Math.pow(k, 0.55), 1500 + 4500 * Math.sqrt(k), 0, 0.97 + 0.04 * k, -1, pan);
    },
    // A ball going down, reported stage by stage by the animation itself:
    //   lip  - it tips over the edge (speed it arrived with)      wall - it knocks the inside of the pocket
    //   land - it reaches the bottom
    drop(stage, v, pan) {
      if (!ready() || !Number.isFinite(v)) return;
      if (stage === 'lip') { const k = Math.min(1, v / 3); hit('rail', 0.1 + 0.22 * k, 900 + 1400 * k, 0, 1.25, -1, pan); }
      else if (stage === 'wall') { const k = Math.min(1, v / 1.5); hit('pock', 0.12 + 0.34 * k, 1400 + 1800 * k, 0, 1.12 + Math.random() * 0.06, -1, pan); }
      else { const k = Math.min(1, v / 2.6); hit('pock', 0.3 + 0.3 * k, 1700 + 900 * k, 0, 0.92, -1, pan); hit('roll', 0.1 + 0.08 * k, 1000, 0.01, 1, -1, pan); }
    },
    // how much is rolling right now (sum of ball speeds, m/s); 0 when the table is still
    rolling(amount) {
      if (!ac || !roll) return;
      const k = isOn() ? Math.min(1, amount / 6) : 0, t = ac.currentTime;
      if (Math.abs(k - roll.k) < 0.04 && !(k === 0 && roll.k !== 0)) return;                 // only re-aim the volume when it has really changed
      roll.k = k;
      roll.g.gain.setTargetAtTime(0.0375 * Math.sqrt(k), t, 0.08); roll.bp.frequency.setTargetAtTime(200 + 260 * k, t, 0.12);
    },
    tap() { uiHit('tick', 0.22, 5000, 0, 1); },
    good() { uiHit('note', 0.2, 6000, 0, 1.5); uiHit('note', 0.2, 6000, 0.09, 2); },
    bad() { uiHit('note', 0.2, 1600, 0, 0.6); },
    win() { [1, 1.26, 1.5, 2].forEach((r, i) => uiHit('note', 0.24, 7000, i * 0.11, r)); uiHit('note', 0.18, 7000, 0.5, 1.5); },
  };
}
