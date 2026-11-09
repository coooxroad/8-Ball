/* The 3D scene (createScene): tables, balls, cue, aiming guide. The build wraps the files of this folder, in name order,
   in one function - function createScene(canvas, app, PH) { ... } - so they share one scope, like app/ and reel/.
   00-setup the renderer and the measures  10-room the room, its light and floor  20-table cloth, wood, rails, pockets, ice
   30-balls the balls and their sets        40-cue the cue                         50-guide the aiming guide
   60-view fitting the table, looking round 90-frame drawing a frame, and what the rest of the app may call
   Built for a steady frame rate on tablets: everything that never moves (backdrop, table, its shadows) is drawn once into a texture and reused as the
   background of every frame, so a frame only draws the balls, the cue and the guide. Ball shadows are sprites,
   and the canvas resolution is fixed up front. */
  if (!window.THREE) return null;
  let renderer;
  let railKey = '', railW = null, railP = null, railPv = null;   // the rail's own played-out way (90-frame.js)
  // the rail's table: the same cloth and balls with its cushions far away, so the cue ball's curve runs on through them
  const openTables = new Map();
  const openTable = P => { let o = openTables.get(P); if (!o) { o = createPhysics({ R: P.R, HL: 40, HW: 40, pockets: P.POCKETS.length > 0 }); openTables.set(P, o); } return o; };
  let pvKey = '', pvW = null, pvP = null, pvNow = null;   // the aim line's played-out shot and the inputs it was played with (90-frame.js)
  let coveredNow = false;   // the table was out of sight last frame (90-frame.js)
  const sProf = { guide: 0 };   // ms spent this frame playing out the aim line (the FPS display reads it: 90-loop.js perfTick)
  // Some integrated GPUs reject the preferred context; retry without MSAA or a dedicated-GPU preference.
  let gl = null;
  for (const options of [{ antialias: true, powerPreference: 'high-performance' }, { antialias: false, powerPreference: 'default' }]) {
    for (const kind of ['webgl2', 'webgl', 'experimental-webgl']) {
      try { gl = canvas.getContext(kind, { ...options, alpha: false, depth: true, stencil: true }); } catch (e) {}
      if (gl) break;
    }
    if (gl) break;
  }
  if (!gl) return null;
  // A fast PC may still give the browser a CPU renderer. Read this once; do not probe the driver in the frame loop.
  let rendererName = '', softwareGL = false;
  try {
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    rendererName = String(gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || '');
    softwareGL = /swiftshader|llvmpipe|softpipe|software rasterizer|microsoft basic render/i.test(rendererName);
  } catch (e) {}   // privacy settings may hide the renderer; the frame-time guard still works
  try { renderer = new THREE.WebGLRenderer({ canvas, context: gl }); } catch (e) { return null; }
  renderer.info.autoReset = false;                   // (counted a whole frame - every pass - for the frame-rate display; reset in frame())
  const RW = 0.095, RAIL_Z = 0.04, FOV = 40;
  const LAMPS = [[-0.78, 0, 1.05], [0, 0, 1.05], [0.78, 0, 1.05]];   // three shades hanging over the long axis
  const CW = PH.pool.CW;
  let cur = PH.pool;                                                  // the table being shown
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.autoClear = false;
  const sScene = new THREE.Scene(), scene = new THREE.Scene();   // static layer, moving layer
  sScene.background = new THREE.Color(0x101216).convertSRGBToLinear();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 30);
  const col = h => new THREE.Color(h).convertSRGBToLinear();
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const tex = (c, rep) => {
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = aniso;
    if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep); }
    return t;
  };

