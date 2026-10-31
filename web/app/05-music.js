/* ================= music: the lobby's tune, and a song when a match ends =================
   Three tracks bundled with the app (music/*.mp3, see web/music): the lobby's, on a loop while on the home screens and the
   records; the winner's when a match ends with the player winning - and always between friends, whoever won; the
   loser's when the computer wins. They are plain audio elements (streamed from the file, not decoded into memory), faded
   in and out, kept quiet under the game's own sounds, and only played with 음악 on in the settings. */
const MUSIC = (() => {
  const TRACKS = { lobby: { src: 'music/lobby.mp3', loop: true, vol: 0.42 }, win: { src: 'music/win.mp3', vol: 0.62 }, lose: { src: 'music/lose.mp3', vol: 0.55 } };
  const els = {}, fades = new Map();
  let cur = null;                                                    // the track that should be heard now (null: none)
  const get = k => els[k] || (els[k] = Object.assign(new Audio(TRACKS[k].src), { loop: !!TRACKS[k].loop, preload: 'auto', volume: 0 }));
  // ease an element's volume to `to` over ms, then call done
  function fade(a, to, ms, done) {
    clearInterval(fades.get(a)); const from = a.volume, t0 = performance.now();
    const id = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / ms); a.volume = Math.max(0, Math.min(1, from + (to - from) * k));
      if (k >= 1) { clearInterval(id); fades.delete(a); if (done) done(); } }, 40);
    fades.set(a, id);
  }
  const on = () => prefs.music !== false;
  function start(k, fromTop) {
    const a = get(k); if (fromTop) { try { a.currentTime = 0; } catch (e) {} }
    const p = a.play(); if (p && p.catch) p.catch(() => { want = k; });   // (a browser that wants a tap first: try again on the next one)
    fade(a, TRACKS[k].vol, 900);
  }
  let want = null;
  // play track k (the others fade out); a song for the end of a match starts from the top, the lobby's carries on
  function play(k) {
    if (cur === k) return; cur = k;
    for (const [n, a] of Object.entries(els)) if (n !== k && !a.paused) fade(a, 0, 700, () => a.pause());
    if (k && on() && !document.hidden) start(k, k !== 'lobby');
  }
  function stop() { play(null); }
  // what each screen sounds like: the home screens and the records have the lobby's tune; the game and the highlight reel
  // have none; the result keeps whatever the end of the match started
  function screen(s) { if (s === 'home' || s === 'records') play('lobby'); else if (s !== 'result') stop(); }
  // the switch in the settings
  function setOn(v) { if (!v) { for (const a of Object.values(els)) fade(a, 0, 400, () => a.pause()); } else if (cur) { const k = cur; cur = null; play(k); } }
  // the app in the background is silent; back in front, the music picks up where it was
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { for (const a of Object.values(els)) a.pause(); }
    else if (cur && on()) start(cur, false);
  });
  window.addEventListener('pointerdown', () => { if (want && want === cur && on()) { want = null; start(cur, false); } }, true);
  return { play, stop, screen, setOn, get current() { return cur; } };
})();
