/* Sound. Ball and cue hits are short recordings (sounds.js); cushion, pocket and interface sounds are built from
   a few damped resonances. Table sounds go through one small "room"; interface sounds stay dry.
   The game only reports what happened, how hard, and where on the table (pan, -1 left .. 1 right):
   nothing here runs on a timer, so what is heard is what is seen. */
function createAudio(isOn) {
  let ac = null, out = null, ui = null, buf = null, roll = null, sink = null, white = null;
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
  /* ---------- the player's own song for the highlight reel ----------
     The song never leaves the device: it is picked from the device's files, the half minute around its drop is kept
     in the browser's own storage, and the reel starts it so that the drop lands on the moment being shown. */
  const DB = 'cue-song';
  const idb = (mode, fn) => new Promise((res, rej) => {
    let rq; try { rq = indexedDB.open(DB, 1); } catch (e) { return rej(e); }
    rq.onupgradeneeded = () => rq.result.createObjectStore('kv');
    rq.onerror = () => rej(rq.error);
    rq.onsuccess = () => { const tx = rq.result.transaction('kv', mode), out = fn(tx.objectStore('kv')); tx.oncomplete = () => res(out && out.result); tx.onerror = () => rej(tx.error); };
  });
  let song = null, playing = null;                              // song: { name, sr, data: [Int16Array per channel], drop, bpm, buffer? }
  // where the drop is: the moment the bass comes in hardest and stays (most low-end energy in the 4 s after, least in the 2 s before)
  function findDrop(mono, sr) {
    const hop = Math.floor(sr * 0.05), n = Math.floor(mono.length / hop), low = new Float32Array(n);
    let lp = 0; const k = 2 * Math.PI * 140 / sr;
    for (let i = 0; i < n; i++) { let e = 0; for (let j = i * hop, end = j + hop; j < end; j++) { lp += (mono[j] - lp) * k; e += lp * lp; } low[i] = Math.sqrt(e / hop); }
    const cum = new Float64Array(n + 1); for (let i = 0; i < n; i++) cum[i + 1] = cum[i] + low[i];
    const mean = (a, b) => (cum[Math.min(n, b)] - cum[Math.max(0, a)]) / Math.max(1, Math.min(n, b) - Math.max(0, a));
    let best = 0, at = Math.min(n - 1, Math.floor(8 / 0.05));
    for (let i = Math.floor(6 / 0.05); i < n - Math.floor(6 / 0.05); i++) { const v = mean(i, i + 80) - mean(i - 40, i); if (v > best) { best = v; at = i; } }
    // step to the exact hit: the loudest low-end rise within a quarter second either side
    let fine = at, rise = 0; for (let i = Math.max(1, at - 5); i < Math.min(n, at + 6); i++) { const d = low[i] - low[i - 1]; if (d > rise) { rise = d; fine = i; } }
    return fine * 0.05;
  }
  // tempo: how often the loudness jumps, measured over the part after the drop
  function findBpm(mono, sr, from) {
    const hop = 512, start = Math.floor(from * sr), n = Math.min(Math.floor((mono.length - start) / hop), Math.floor(16 * sr / hop)); if (n < 200) return 140;
    const env = new Float32Array(n); let prev = 0;
    for (let i = 0; i < n; i++) { let e = 0; for (let j = start + i * hop, end = j + hop; j < end; j++) e += mono[j] * mono[j]; e = Math.sqrt(e / hop); env[i] = Math.max(0, e - prev); prev = e; }
    let best = 0, bpm = 140;
    for (let b = 80; b <= 180; b += 0.5) { const lag = 60 / b * sr / hop; let s = 0; for (let i = 0; i + lag * 2 < n; i++) { const j = Math.round(i + lag), j2 = Math.round(i + lag * 2); s += env[i] * (env[j] + 0.5 * env[j2]); } if (s > best) { best = s; bpm = b; } }
    return bpm < 100 ? bpm * 2 : bpm;
  }
  const toBuffer = sg => { const b = ac.createBuffer(sg.data.length, sg.data[0].length, sg.sr); sg.data.forEach((d, c) => { const out = b.getChannelData(c); for (let i = 0; i < d.length; i++) out[i] = d[i] / 32768; }); return b; };
  // Several songs can be kept. `list` holds what is known about each ({ id, name, drop, bpm, on }); the sound itself stays in
  // storage under 'song:<id>' and only the one about to be played is held in memory.
  const MAX_SONGS = 12;
  let list = [], lastId = null;
  const saveList = () => idb('readwrite', st => st.put(list, 'list')).catch(() => {});
  const fetchSong = async id => { if (song && song.id === id) return song; const rec = await idb('readonly', st => st.get('song:' + id)); if (!rec) return null; const m = list.find(x => x.id === id); song = { id, name: m.name, sr: rec.sr, data: rec.data, drop: m.drop, bpm: m.bpm }; return song; };
  const songApi = {
    MAX: MAX_SONGS,
    get list() { return list; },
    // the song that is loaded and ready to play
    get info() { return song && { id: song.id, name: song.name, drop: song.drop, bpm: song.bpm }; },
    async load() {
      try {
        list = await idb('readonly', st => st.get('list')) || [];
        const old = await idb('readonly', st => st.get('song'));        // from the version that kept a single song
        if (old && old.data) { const id = Date.now(); list.push({ id, name: old.name, drop: old.drop, bpm: old.bpm, on: true }); await idb('readwrite', st => { st.put({ sr: old.sr, data: old.data }, 'song:' + id); st.put(list, 'list'); st.delete('song'); }); }
      } catch (e) { list = []; }
      return list;
    },
    // take a file the player picked: find its drop and tempo, keep 14 s before and 18 s after
    async take(file) {
      init(); if (!ac) throw new Error('audio');
      if (list.length >= MAX_SONGS) throw new Error('full');
      const full = await ac.decodeAudioData(await file.arrayBuffer()), sr = full.sampleRate, len = full.length;
      const mono = new Float32Array(len); for (let c = 0; c < full.numberOfChannels; c++) { const d = full.getChannelData(c); for (let i = 0; i < len; i++) mono[i] += d[i] / full.numberOfChannels; }
      const drop = findDrop(mono, sr), bpm = findBpm(mono, sr, drop);
      const a = Math.max(0, Math.floor((drop - 14) * sr)), b = Math.min(len, Math.floor((drop + 18) * sr));
      const data = []; for (let c = 0; c < Math.min(2, full.numberOfChannels); c++) { const src = full.getChannelData(c), out = new Int16Array(b - a); for (let i = a; i < b; i++) out[i - a] = Math.max(-32768, Math.min(32767, Math.round(src[i] * 32767))); data.push(out); }
      const m = { id: Date.now(), name: file.name.replace(/\.[^.]+$/, '').slice(0, 40), drop: drop - a / sr, bpm, on: true };
      await idb('readwrite', st => { st.put({ sr, data }, 'song:' + m.id); });
      list.push(m); await saveList();
      song = { id: m.id, name: m.name, sr, data, drop: m.drop, bpm };
      return m;
    },
    async nudge(id, sec) { const m = list.find(x => x.id === id); if (!m) return; m.drop = Math.max(0.5, Math.min(31, m.drop + sec)); if (song && song.id === id) song.drop = m.drop; await saveList(); },
    async toggle(id) { const m = list.find(x => x.id === id); if (!m) return; m.on = !m.on; await saveList(); },
    async remove(id) { songApi.stop(); if (song && song.id === id) song = null; list = list.filter(x => x.id !== id); try { await idb('readwrite', st => { st.delete('song:' + id); st.put(list, 'list'); }); } catch (e) {} },
    // get a song ready: the one asked for, or one of the songs switched on, picked at random (not the one just played)
    async prepare(id) {
      if (id == null) {
        let pool = list.filter(x => x.on); if (pool.length > 1) pool = pool.filter(x => x.id !== lastId);
        if (!pool.length) { song = null; return null; }
        id = pool[Math.floor(Math.random() * pool.length)].id; lastId = id;
      }
      try { await fetchSong(id); } catch (e) { song = null; }
      return songApi.info;
    },
    // start so that the drop arrives `lead` seconds from now; returns false when there is no song (or sound is off)
    play(lead) {
      if (!song || !ready()) return false; songApi.stop();
      if (!song.buffer) song.buffer = toBuffer(song);
      const src = ac.createBufferSource(), g = ac.createGain(), now = ac.currentTime, off = song.drop - lead;
      src.buffer = song.buffer; src.connect(g); g.connect(sink);
      g.gain.setValueAtTime(0.0001, now + Math.max(0, -off)); g.gain.exponentialRampToValueAtTime(0.85, now + Math.max(0, -off) + 0.5);
      src.start(now + Math.max(0, -off), Math.max(0, off));
      playing = { src, g, dropAt: now + lead };
      return true;
    },
    // seconds since the drop (negative before it); null when nothing is playing
    time() { return playing ? ac.currentTime - playing.dropAt : null; },
    stop() { if (!playing) return; const p = playing, t = ac.currentTime; playing = null; p.g.gain.cancelScheduledValues(t); p.g.gain.setValueAtTime(Math.max(0.0001, p.g.gain.value), t); p.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5); try { p.src.stop(t + 0.55); } catch (e) {} },
  };

  return {
    init,
    song: songApi,
    // a deep thump for the big moment, and a tiny rising blip for a cushion in the reel
    boom() {
      if (!ready()) return; const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
      o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(34, t + 0.5);
      g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.75);
    },
    // a short rising blip; `step` raises it a semitone at a time (the combo counter in the reel)
    blip(step) {
      if (!ready()) return; const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(), f = 520 * Math.pow(2, Math.min(24, step || 0) / 12);
      o.type = 'triangle'; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.9, t + 0.07);
      g.gain.setValueAtTime(0.16, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11); o.connect(g); g.connect(ui); o.start(t); o.stop(t + 0.12);
    },
    // a soft low knock: a heartbeat while time is stopped
    thump() {
      if (!ready()) return; const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
      o.frequency.setValueAtTime(78, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.16);
      g.gain.setValueAtTime(0.55, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.25);
    },
    // The sound for a bad shot. A buzzing low note whose pitch wanders and sags, chopped into flutters, through a mouth-shaped
    // filter. kind: 0 plain, 1 short and squeaky, 2 long and low, 3 the big one that sputters out.
    fart(kind) {
      if (!ready()) return;
      const v = [[0.55, 96, 0.72, 30], [0.32, 165, 1.35, 44], [0.9, 76, 0.66, 24], [1.7, 68, 0.55, 19]][Math.max(0, Math.min(3, kind | 0))], dur = v[0], f0 = v[1], t = ac.currentTime;
      const o = ac.createOscillator(), o2 = ac.createOscillator(), lp = ac.createBiquadFilter(), bp = ac.createBiquadFilter(), am = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain(), env = ac.createGain(), n = ac.createBufferSource(), ng = ac.createGain();
      o.type = 'sawtooth'; o2.type = 'square'; o.frequency.setValueAtTime(f0 * 1.3, t); o.frequency.linearRampToValueAtTime(f0, t + 0.06);
      for (let x = 0.1; x < dur - 0.05; x += 0.045) o.frequency.linearRampToValueAtTime(f0 * (0.86 + Math.random() * 0.28) * (1 - 0.3 * x / dur), t + x);
      o.frequency.linearRampToValueAtTime(f0 * v[2], t + dur);
      o2.frequency.setValueAtTime(f0 * 0.5, t); o2.frequency.linearRampToValueAtTime(f0 * 0.5 * v[2], t + dur);
      // the flutter slows down as it runs out of breath
      lfo.type = 'square'; lfo.frequency.setValueAtTime(v[3] * 1.3, t); lfo.frequency.linearRampToValueAtTime(v[3] * 0.6, t + dur); lg.gain.value = 0.42; am.gain.value = 0.58; lfo.connect(lg); lg.connect(am.gain);
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(900, t); lp.frequency.linearRampToValueAtTime(380, t + dur); lp.Q.value = 4;
      bp.type = 'peaking'; bp.frequency.value = 260; bp.Q.value = 1.4; bp.gain.value = 9;
      n.buffer = white; n.loop = true; ng.gain.value = 0.05;
      env.gain.setValueAtTime(0.0001, t); env.gain.exponentialRampToValueAtTime(0.62, t + 0.025); env.gain.setValueAtTime(0.62, t + dur * 0.7); env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(am); o2.connect(am); n.connect(ng); ng.connect(am); am.connect(lp); lp.connect(bp); bp.connect(env); env.connect(out);
      for (const x of [o, o2, lfo, n]) { x.start(t); x.stop(t + dur + 0.05); }
    },
    // tape running backwards: a wobbling whine that climbs for as long as the rewind lasts
    rewind(dur) {
      if (!ready()) return; const t = ac.currentTime, o = ac.createOscillator(), l = ac.createOscillator(), lg = ac.createGain(), g = ac.createGain(), f = ac.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(240, t); o.frequency.exponentialRampToValueAtTime(1500, t + dur);
      l.frequency.value = 27; lg.gain.value = 90; l.connect(lg); lg.connect(o.frequency);
      f.type = 'bandpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(3200, t + dur); f.Q.value = 1.2;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.13, t + 0.06); g.gain.setValueAtTime(0.13, t + Math.max(0.07, dur - 0.08)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(f); f.connect(g); g.connect(ui); o.start(t); l.start(t); o.stop(t + dur + 0.02); l.stop(t + dur + 0.02);
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
