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
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' }); } catch (e) { return null; }
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

