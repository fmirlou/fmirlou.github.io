/*
  3D version of the scroll-driven build sequence (three.js).

  This file is the SOURCE. The browser loads the bundled copy, js/scene3d.bundle.js,
  which is made with:   npm install   then   npm run build
  You only need to do that if you want to change the 3D scene itself.

  The scene is a pure function of one number, s (0 .. 4), that js/build.js derives from
  the scroll position. Nothing plays by itself.

    s 0.0 - 1.0  blurry signal waveforms come into focus
    s 0.8 - 1.6  flexible circuit drops in and spins to rest
    s 1.3 - 2.0  sensor electrodes and traces are drawn on
    s 1.8 - 2.6  antenna coil is drawn in the air, then lowers onto the board
    s 2.5 - 3.4  passive components fly in onto their pads
    s 3.0 - 3.5  the microcontroller lands
    s 3.4 - 4.0  signals flow and the coil radiates
    s 3.5 - 4.4  the finished device sends its readings as a stream of coloured dots to a cloud,
                 which hands them on to a phone, a dashboard and other IoT nodes (this part
                 also keeps moving by itself while it is on screen)

  All materials are opaque. World units match the old 2D scene (the board is 360 x 220).
*/
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/* ---------------------------------------------------------------- helpers */
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeOutBack = (t, c1 = 1.70158) => { t = clamp(t); const c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const easeOutCubic = (t) => 1 - Math.pow(1 - clamp(t), 3);

/* --------------------------------------------------------------- geometry */
// Design coordinates: x right, y up on the board, z up. Mapped to three.js as (x - CX0, z, -y).
const X0 = -180, X1 = 180, Y0 = -110, Y1 = 110, RAD = 28;
const TAIL_L = 130, TAIL_H = 64;
const CX0 = -65;
const LANES = [-16, 0, 16];
const ELX = X0 - TAIL_L + 22;
const BOARD_T = 5;
const FLOOR_Y = -22;

const arc = (cx, cy, a0, a1, n) => {
  const out = [];
  for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); out.push([cx + RAD * Math.cos(a), cy + RAD * Math.sin(a)]); }
  return out;
};
const OUTLINE = [
  ...arc(X1 - RAD, Y0 + RAD, -Math.PI / 2, 0, 8),
  ...arc(X1 - RAD, Y1 - RAD, 0, Math.PI / 2, 8),
  ...arc(X0 + RAD, Y1 - RAD, Math.PI / 2, Math.PI, 8),
  [X0, TAIL_H / 2], [X0 - TAIL_L, TAIL_H / 2], [X0 - TAIL_L, -TAIL_H / 2], [X0, -TAIL_H / 2],
  ...arc(X0 + RAD, Y0 + RAD, Math.PI, Math.PI * 1.5, 8)
];

const CHIP = { x: -72, y: 0, w: 64, h: 64, hgt: 9 };
const PIN_GRID = [-24, -16, -8, 0, 8, 16, 24];
const PASSIVES = [
  { x: -132, y: 70, w: 20, h: 10, kind: "cap" },
  { x: -132, y: -70, w: 20, h: 10, kind: "cap" },
  { x: -72, y: 80, w: 20, h: 10, kind: "res" },
  { x: -72, y: -80, w: 20, h: 10, kind: "res" }
];
const LANE_TRACES = LANES.map((y) => [[ELX, y], [CHIP.x - CHIP.w / 2, y]]);
const SIDE_TRACES = [
  [[-96, 32], [-96, 70], [-122, 70]],
  [[-96, -32], [-96, -70], [-122, -70]],
  [[-72, 32], [-72, 75]],
  [[-72, -32], [-72, -75]]
];
const COIL_LEAD = [[-48, -32], [-48, -94], [10, -94]];
const spiral = (x0, y0, x1, y1, turns, pitch) => {
  let l = x0, b = y0, r = x1, t = y1;
  const pts = [[l, b]];
  for (let k = 0; k < turns; k++) { pts.push([r, b], [r, t], [l, t], [l, b + pitch]); l += pitch; r -= pitch; b += pitch; t -= pitch; }
  return pts;
};
const COIL = spiral(10, -94, 166, 94, 6, 9);
const COIL_END = COIL[COIL.length - 1];
const COIL_CENTER = [88, 0];

function pointAlong(pts, u) {
  let total = 0; const segs = [];
  for (let i = 0; i < pts.length - 1; i++) { const L = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); segs.push(L); total += L; }
  let d = total * (u - Math.floor(u));
  for (let i = 0; i < segs.length; i++) {
    if (d <= segs[i]) { const t = d / segs[i]; return [lerp(pts[i][0], pts[i + 1][0], t), lerp(pts[i][1], pts[i + 1][1], t)]; }
    d -= segs[i];
  }
  return pts[pts.length - 1];
}

function stages(s) {
  return {
    focus: smooth(0, 1, s),
    board: smooth(0.75, 1.55, s),
    traces: smooth(1.3, 2.0, s),
    coil: smooth(1.8, 2.6, s),
    pass: [0, 1, 2, 3].map((k) => smooth(2.5 + 0.14 * k, 2.95 + 0.14 * k, s)),
    chip: smooth(3.0, 3.5, s),
    flow: smooth(1.7, 2.2, s),
    live: smooth(3.4, 4.0, s),
    bits: smooth(3.5, 3.95, s),
    cloud: smooth(3.6, 4.05, s),
    link: smooth(3.8, 4.4, s),
    end: [0, 1, 2, 3, 4].map((k) => smooth(3.9 + 0.12 * k, 4.4 + 0.12 * k, s))
  };
}

/* ----------------------------------------------------------------- camera */
// az, el (radians), span (world width visible at the target), target x y z (three.js coords)
const KEYS = [
  [-0.04, 0.10, 760, -170, 40, 0],      // 0 intro: side-on, looking along the signal lines
  [0.46, 0.34, 920, -40, 8, 0],         // 1 about: swing round as the board drops in
  [0.88, 0.80, 920, 30, 2, -6],         // 2 education: high, looking down on traces and coil
  [-0.46, 0.50, 780, -10, 6, 0],        // 3 experience: low and close on the chip and parts
  [0.20, 0.30, 900, 108, 112, -40],      // 4 data: pull back and up, device and cloud in one frame
  [0.40, 0.34, 960, 100, 112, -40]       // 5 projects: slow drift round the whole system
];
const cr = (p0, p1, p2, p3, t) => {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
};
function cameraKey(s, out) {
  s = clamp(s, 0, KEYS.length - 1);
  const i = Math.min(Math.floor(s), KEYS.length - 2), t = s - i;
  const a = KEYS[Math.max(i - 1, 0)], b = KEYS[i], c = KEYS[i + 1], d = KEYS[Math.min(i + 2, KEYS.length - 1)];
  for (let k = 0; k < 6; k++) out[k] = cr(a[k], b[k], c[k], d[k], t);
  return out;
}

/* ---------------------------------------------------------- shader pieces */
const WAVE_VERT = `
  uniform float uPh, uKind, uX0, uX1, uBase, uEnd, uAmp, uZ, uHW;
  attribute float aT;
  attribute float aSide;
  varying float vSide;
  varying float vT;
  float wave(float x) {
    if (uKind < 0.5) return sin(x * 0.055 + uPh * 2.0) * (0.65 + 0.35 * sin(x * 0.007 + uPh * 0.4));
    if (uKind < 1.5) {
      float p = fract(x * 0.0065 + uPh * 0.12);
      float a = (p - 0.22) / 0.045, b = (p - 0.5) / 0.1;
      return -(exp(-a * a) + 0.4 * exp(-b * b) - 0.12);
    }
    return sin(x * 0.012 + uPh * 0.8) + 0.35 * sin(x * 0.031 + uPh * 1.7);
  }
  vec3 at(float t) {
    float x = mix(uX0, uX1, t);
    float env = (1.0 - smoothstep(0.55, 1.0, t)) * (0.35 + 0.65 * smoothstep(0.0, 0.2, t));
    float y = mix(uBase, uEnd, smoothstep(0.3, 1.0, t)) + uAmp * env * wave(x);
    return vec3(x, y, uZ);
  }
  void main() {
    vSide = aSide; vT = aT;
    vec4 m  = modelViewMatrix * vec4(at(aT), 1.0);
    vec4 m0 = modelViewMatrix * vec4(at(max(aT - 0.0015, 0.0)), 1.0);
    vec4 m1 = modelViewMatrix * vec4(at(min(aT + 0.0015, 1.0)), 1.0);
    // widen vertically (never sideways) so steep spikes cannot fold the strip
    float slope = (m1.y - m0.y) / max(abs(m1.x - m0.x), 1e-3);
    m.y += aSide * uHW * mix(0.6, 1.0, aT) * min(sqrt(1.0 + slope * slope), 2.6);
    gl_Position = projectionMatrix * m;
  }
`;
const WAVE_FRAG = `
  uniform vec3 uColor, uColor2;
  uniform float uAlpha, uK, uFocus, uMode, uTime, uCount, uSpeed;
  varying float vSide;
  varying float vT;
  void main() {
    float q = abs(vSide);
    float g = exp(-q * q * uK);
    float crisp = 1.0 - smoothstep(0.55, 1.0, q);
    float edge = smoothstep(0.0, 0.16, vT) * mix(1.0 - smoothstep(0.82, 1.0, vT), 1.0, uFocus);
    vec3 col = mix(uColor * 0.62, uColor, smoothstep(0.05, 0.9, vT));
    float a;
    if (uMode > 0.5) {
      // bright packets that travel along the line toward the device
      float f = fract(vT * uCount - uTime * uSpeed);
      float head = smoothstep(0.0, 0.05, f);
      float tail = pow(1.0 - smoothstep(0.012, 0.26, f), 1.6);
      float gate = smoothstep(0.35, 0.55, vT) * (1.0 - smoothstep(0.93, 1.0, vT));
      a = head * tail * gate * g * uAlpha;
      col = mix(col, uColor2, head * tail);
    } else {
      a = mix(g, crisp, uFocus) * uAlpha * edge;
    }
    gl_FragColor = vec4(col, a);
    #include <colorspace_fragment>
  }
`;

/* ------------------------------------------------------------ small makers */
function radialTexture(stops) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  stops.forEach(([o, a]) => gr.addColorStop(o, `rgba(255,255,255,${a})`));
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// a clean filled dot with a thin lighter rim; tinted per bit with the sprite colour
function dotTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#fff"; g.beginPath(); g.arc(64, 64, 40, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 5; g.beginPath(); g.arc(64, 64, 49, 0, Math.PI * 2); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function gridTexture() {
  const S = 1024, c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d");
  const cells = 22, step = S / cells;
  g.strokeStyle = "#fff"; g.lineWidth = 2;
  for (let i = 0; i <= cells; i++) {
    g.beginPath(); g.moveTo(i * step, 0); g.lineTo(i * step, S); g.stroke();
    g.beginPath(); g.moveTo(0, i * step); g.lineTo(S, i * step); g.stroke();
  }
  g.globalCompositeOperation = "destination-in";
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.55, "rgba(255,255,255,.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.anisotropy = 8; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Flat copper "wire" with thickness, as triangles with a running length attribute (aLen).
function ribbonGeometry(pts, width, z0, thick) {
  const n = pts.length, hw = width / 2;
  const dirs = [], lens = [0];
  for (let i = 0; i < n - 1; i++) {
    const dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1], L = Math.hypot(dx, dy);
    dirs.push([dx / L, dy / L]); lens.push(lens[i] + L);
  }
  const M = [];
  for (let i = 0; i < n; i++) {
    const a = dirs[Math.max(i - 1, 0)], b = dirs[Math.min(i, n - 2)];
    let nx = -(a[1] + b[1]), ny = a[0] + b[0];
    const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    const dd = nx * -b[1] + ny * b[0];
    const sc = hw / Math.max(dd, 0.5);
    M.push([nx * sc, ny * sc]);
  }
  const pos = [], nor = [], len = [];
  const V = (x, y, h) => new THREE.Vector3(x - CX0, h, -y);
  const quad = (p0, p1, p2, p3, nrm, l0, l1) => {
    const e1 = p1.clone().sub(p0), e2 = p2.clone().sub(p0);
    const flip = e1.cross(e2).dot(nrm) < 0;
    const tri = flip ? [[p0, l0], [p2, l1], [p1, l0], [p0, l0], [p3, l1], [p2, l1]] : [[p0, l0], [p1, l0], [p2, l1], [p0, l0], [p2, l1], [p3, l1]];
    for (const [p, l] of tri) { pos.push(p.x, p.y, p.z); nor.push(nrm.x, nrm.y, nrm.z); len.push(l); }
  };
  const zb = z0, zt = z0 + thick;
  for (let i = 0; i < n - 1; i++) {
    const [px, py] = pts[i], [qx, qy] = pts[i + 1];
    const Lp = [px + M[i][0], py + M[i][1]], Rp = [px - M[i][0], py - M[i][1]];
    const Lq = [qx + M[i + 1][0], qy + M[i + 1][1]], Rq = [qx - M[i + 1][0], qy - M[i + 1][1]];
    const nl = new THREE.Vector3(-dirs[i][1], 0, -dirs[i][0]);   // plane normal (-dy, dx) -> three (x, -y)
    nl.set(-dirs[i][1], 0, -dirs[i][0]);
    const up = new THREE.Vector3(0, 1, 0);
    quad(V(...Lp, zt), V(...Rp, zt), V(...Rq, zt), V(...Lq, zt), up, lens[i], lens[i + 1]);
    quad(V(...Lp, zb), V(...Lq, zb), V(...Lq, zt), V(...Lp, zt), nl, lens[i], lens[i + 1]);
    quad(V(...Rp, zb), V(...Rq, zb), V(...Rq, zt), V(...Rp, zt), nl.clone().negate(), lens[i], lens[i + 1]);
  }
  const cap = (i, sign) => {
    const [px, py] = pts[i];
    const d = dirs[Math.min(i, n - 2)];
    const nrm = new THREE.Vector3(d[0] * sign, 0, -d[1] * sign);
    quad(V(px + M[i][0], py + M[i][1], zb), V(px - M[i][0], py - M[i][1], zb), V(px - M[i][0], py - M[i][1], zt), V(px + M[i][0], py + M[i][1], zt), nrm, lens[i], lens[i]);
  };
  cap(0, -1); cap(n - 1, 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("aLen", new THREE.Float32BufferAttribute(len, 1));
  g.computeBoundingSphere();
  g.userData.length = lens[n - 1];
  return g;
}

function patchClip(material, uni) {
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uDraw = uni;
    sh.vertexShader = "attribute float aLen;\nvarying float vLen;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvLen = aLen;");
    sh.fragmentShader = "varying float vLen;\nuniform float uDraw;\n" + sh.fragmentShader.replace("void main() {", "void main() {\n  if (vLen > uDraw) discard;");
  };
  material.customProgramCacheKey = () => "clip-" + material.type;
  return material;
}

/* ======================================================================== */
function create(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const dotTex = dotTexture();
  const camera = new THREE.PerspectiveCamera(30, 1, 20, 30000);
  scene.add(camera);

  let hasEnv = false;
  try {
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    hasEnv = true;
  } catch (e) { /* lights only */ }

  const hemi = new THREE.HemisphereLight(0xaab8e0, 0x151a24, hasEnv ? 0.35 : 1.1);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff0dc, hasEnv ? 2.6 : 3.2);
  key.position.set(-240, 460, 300);
  key.castShadow = true;
  const small = Math.min(screen.width, screen.height) < 820 || (window.matchMedia && matchMedia("(pointer: coarse)").matches);
  key.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -330, right: 330, top: 330, bottom: -330, near: 50, far: 1400 });
  key.shadow.bias = -0.0005; key.shadow.normalBias = 0.5; key.shadow.radius = 4;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x8fa4ff, 1.1);
  rim.position.set(320, 160, -360);
  scene.add(rim);

  /* ---- materials (colours are set in applyColors) */
  const mBoard = new THREE.MeshStandardMaterial({ roughness: 0.68, metalness: 0.0, envMapIntensity: 0.3 });
  const mCopper = new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.85, envMapIntensity: 1.0 });
  const mMetal = new THREE.MeshStandardMaterial({ roughness: 0.28, metalness: 1.0, envMapIntensity: 1.0 });
  const mChip = new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.15, envMapIntensity: 0.7 });
  const mChipTop = new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.2, envMapIntensity: 0.8 });
  const mCeramic = new THREE.MeshStandardMaterial({ roughness: 0.65, metalness: 0.0, envMapIntensity: 0.5 });
  const mRes = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.1, envMapIntensity: 0.6 });

  /* ---- background glow blobs (fixed in view, far behind) */
  const glowTex = radialTexture([[0, 1], [0.4, 0.35], [1, 0]]);
  const blobs = [[0.12, 0.25, 0.36, "accent", 0.11], [0.88, 0.18, 0.30, "copper", 0.10], [0.72, 0.88, 0.40, "accent", 0.09], [0.28, 0.92, 0.28, "copper", 0.08]]
    .map(([bx, by, br, col, al]) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, opacity: al }));
      sp.renderOrder = -10; sp.userData = { bx, by, br, col, al };
      camera.add(sp);
      return sp;
    });

  /* ---- floor: shadow catcher + faint grid */
  const gridMat = new THREE.MeshBasicMaterial({ map: gridTexture(), transparent: true, depthWrite: false, opacity: 0, toneMapped: false });
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000).rotateX(-Math.PI / 2), gridMat);
  grid.position.y = FLOOR_Y;
  grid.renderOrder = -5;
  scene.add(grid);
  const shadowMat = new THREE.ShadowMaterial({ opacity: 0.4 });
  const shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400).rotateX(-Math.PI / 2), shadowMat);
  shadowFloor.position.y = FLOOR_Y + 0.05;
  shadowFloor.receiveShadow = true;
  scene.add(shadowFloor);

  /* ---- the device (everything that sits on the board lives in boardG) */
  const dev = new THREE.Group();
  scene.add(dev);
  const boardG = new THREE.Group();
  dev.add(boardG);

  const shape = new THREE.Shape();
  OUTLINE.forEach(([x, y], i) => (i ? shape.lineTo(x - CX0, y) : shape.moveTo(x - CX0, y)));
  const bevel = 0.7;
  const boardGeo = new THREE.ExtrudeGeometry(shape, { depth: BOARD_T - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 1 });
  boardGeo.rotateX(-Math.PI / 2);
  boardGeo.translate(0, bevel, 0);
  const board = new THREE.Mesh(boardGeo, mBoard);
  board.castShadow = true; board.receiveShadow = true;
  boardG.add(board);

  const zt = BOARD_T;
  const ribbons = [];
  function addRibbon(pts, width, z, thick, cast) {
    const geo = ribbonGeometry(pts, width, z, thick);
    const uni = { value: 0 };
    const mat = patchClip(mCopper.clone(), uni);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    if (cast) {
      const dm = patchClip(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), uni);
      mesh.customDepthMaterial = dm;
      mesh.castShadow = true;
    }
    mesh.frustumCulled = false;
    const r = { mesh, uni, length: geo.userData.length, pts, z, mat };
    ribbons.push(r);
    return r;
  }
  const laneR = LANE_TRACES.map((p) => addRibbon(p, 2.8, zt, 0.8, false));
  const sideR = SIDE_TRACES.map((p) => addRibbon(p, 2.4, zt, 0.8, false));
  const leadR = addRibbon(COIL_LEAD, 2.8, zt, 0.8, false);
  laneR.concat(sideR, [leadR]).forEach((r) => boardG.add(r.mesh));

  // spark that rides the front of a growing line
  const sparkTex = radialTexture([[0, 1], [0.18, 0.95], [0.5, 0.25], [1, 0]]);
  const mkSprite = (size, depthTest = true) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkTex, transparent: true, depthWrite: false, depthTest }));
    sp.scale.setScalar(size); sp.visible = false;
    return sp;
  };
  const sparks = [];
  laneR.concat(sideR, [leadR]).forEach((r) => {
    const halo = mkSprite(16), core = mkSprite(5);
    boardG.add(halo, core);
    sparks.push({ r, halo, core });
  });

  // electrodes
  const electrodes = LANES.map((y) => {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(8.5, 8.5, 1.0, 40), mMetal);
    const dot = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 0.6, 32), mCopper);
    ring.position.y = 0.5; dot.position.y = 1.2;
    ring.castShadow = dot.castShadow = true; ring.receiveShadow = dot.receiveShadow = true;
    g.add(ring, dot);
    g.position.set(ELX - CX0, zt, -y);
    g.visible = false;
    boardG.add(g);
    return g;
  });

  // copper pads under the parts
  const pads = [];
  const addPad = (x, y, w, h) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, h), mCopper);
    m.position.set(x - CX0, zt + 0.25, -y); m.visible = false; m.receiveShadow = true;
    boardG.add(m); pads.push(m);
  };
  PASSIVES.forEach((p) => { addPad(p.x - p.w / 2 + 2.2, p.y, 4.4, p.h + 2); addPad(p.x + p.w / 2 - 2.2, p.y, 4.4, p.h + 2); });
  PIN_GRID.forEach((g) => {
    addPad(CHIP.x + g, CHIP.y + CHIP.h / 2 + 5, 3.4, 8); addPad(CHIP.x + g, CHIP.y - CHIP.h / 2 - 5, 3.4, 8);
    addPad(CHIP.x + CHIP.w / 2 + 5, CHIP.y + g, 8, 3.4); addPad(CHIP.x - CHIP.w / 2 - 5, CHIP.y + g, 8, 3.4);
  });

  // coil (drawn in the air, then lowered)
  const coilG = new THREE.Group();
  boardG.add(coilG);
  const coilR = addRibbon(COIL, 3.6, zt + 0.0, 1.1, true);
  boardG.remove(coilR.mesh);
  coilG.add(coilR.mesh);
  const coilEnd = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 1.0, 28), mMetal);
  coilEnd.position.set(COIL_END[0] - CX0, zt + 0.9, -COIL_END[1]);
  coilEnd.castShadow = true; coilEnd.visible = false;
  coilG.add(coilEnd);
  const coilHalo = mkSprite(18), coilCore = mkSprite(5.5);
  coilG.add(coilHalo, coilCore);

  // passives
  const parts = PASSIVES.map((p) => {
    const g = new THREE.Group();
    const cap = 4.2, hh = p.kind === "cap" ? 5 : 4.4;
    const body = new THREE.Mesh(new RoundedBoxGeometry(p.w - 2 * cap + 0.6, hh - 0.4, p.h - 1, 2, 0.8), p.kind === "cap" ? mCeramic : mRes);
    body.position.y = (hh - 0.4) / 2 + 0.2;
    const e1 = new THREE.Mesh(new RoundedBoxGeometry(cap, hh, p.h, 2, 0.7), mMetal);
    const e2 = e1.clone();
    e1.position.set(-(p.w / 2 - cap / 2), hh / 2, 0); e2.position.set(p.w / 2 - cap / 2, hh / 2, 0);
    [body, e1, e2].forEach((m) => { m.castShadow = true; m.receiveShadow = true; });
    g.add(body, e1, e2);
    g.position.set(p.x - CX0, zt, -p.y);
    g.visible = false;
    boardG.add(g);
    return { g, hh };
  });

  // microcontroller
  const chipG = new THREE.Group();
  {
    const body = new THREE.Mesh(new RoundedBoxGeometry(CHIP.w, CHIP.hgt, CHIP.h, 3, 2.4), mChip);
    body.position.y = CHIP.hgt / 2 + 1.0;
    const plate = new THREE.Mesh(new RoundedBoxGeometry(36, 0.7, 36, 2, 0.3), mChipTop);
    plate.position.set(4, CHIP.hgt + 1.0 + 0.2, 4);
    const dot = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.5, 20), mMetal);
    dot.position.set(-22, CHIP.hgt + 1.0 + 0.1, -22);
    [body, plate, dot].forEach((m) => { m.castShadow = true; m.receiveShadow = true; });
    const pinGeoA = new THREE.BoxGeometry(3.2, 1.2, 9), pinGeoB = new THREE.BoxGeometry(9, 1.2, 3.2);
    const mk = (geo, list) => {
      const im = new THREE.InstancedMesh(geo, mMetal, list.length);
      const m4 = new THREE.Matrix4();
      list.forEach((p, i) => { m4.makeTranslation(p[0], 1.1, p[1]); im.setMatrixAt(i, m4); });
      im.castShadow = true; im.receiveShadow = true;
      return im;
    };
    const A = [], B = [];
    for (const g of PIN_GRID) { A.push([g, CHIP.h / 2 + 2.6], [g, -CHIP.h / 2 - 2.6]); B.push([CHIP.w / 2 + 2.6, g], [-CHIP.w / 2 - 2.6, g]); }
    chipG.add(body, plate, dot, mk(pinGeoA, A), mk(pinGeoB, B));
    chipG.position.set(CHIP.x - CX0, zt, -CHIP.y);
    chipG.visible = false;
    boardG.add(chipG);
  }

  // 0s and 1s that run along the traces all the time (same language as the stream going up)
  const boardBits = [];
  {
    const bitTexB = dotTex;
    const add = (path, n, speed, size, kind, dir = 1) => {
      for (let i = 0; i < n; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, transparent: true, depthWrite: false }));
        sp.visible = false; boardG.add(sp);
        boardBits.push({ sp, path, off: i / n, speed, size, kind, dir, ch: -1, idx: boardBits.length });
      }
    };
    LANE_TRACES.forEach((p) => add(p, 4, 0.16, 10, "lane"));
    SIDE_TRACES.forEach((p) => add(p, 2, 0.12, 9, "lane"));
    add([...COIL_LEAD, ...COIL], 9, 0.045, 10, "coil");
  }

  // radiating rings
  const rings = [0, 1, 2].map(() => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.975, 1, 128).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    m.position.set(COIL_CENTER[0] - CX0, zt + 0.5, -COIL_CENTER[1]);
    m.visible = false;
    boardG.add(m);
    return m;
  });


  /* ---- cloud, IoT endpoints and the stream of bits ------------------------------ */
  const net = new THREE.Group();
  net.visible = false;
  scene.add(net);
  const mDark = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.2, envMapIntensity: 0.7 });
  const mSlab = new THREE.MeshStandardMaterial({ roughness: 0.38, metalness: 0.35, envMapIntensity: 0.8 });
  const mSlabBack = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.3, envMapIntensity: 0.6 });
  const mAccentSolid = new THREE.MeshBasicMaterial({ toneMapped: false });
  const mLink = new THREE.MeshBasicMaterial({ toneMapped: false });
  const mEdge = new THREE.LineBasicMaterial({ toneMapped: false });
  const hashI = (n) => { n = Math.imul(n ^ (n >>> 16), 2246822507); n = Math.imul(n ^ (n >>> 13), 3266489909); return (n ^ (n >>> 16)) >>> 0; };
  const rnd = (seed) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  const CLOUD = new THREE.Vector3(120, 232, -120);
  const CLOUD_SCALE = 1.28;
  // cloud outline: union of discs on a flat base, sampled around its centre
  const outline = (() => {
    const discs = [[-58, -4, 34], [-18, 20, 46], [36, 12, 40], [76, -8, 30], [-92, -26, 20], [108, -26, 19]];
    const inside = (x, y) => discs.some(([cx, cy, r]) => (x - cx) ** 2 + (y - cy) ** 2 < r * r) || (x >= -92 && x <= 108 && y >= -45 && y <= -6);
    const pts = [];
    for (let i = 0; i < 260; i++) {
      const a = (i / 260) * Math.PI * 2, c = Math.cos(a), sn = Math.sin(a);
      let r = 0;
      for (let k = 0; k < 400; k += 0.5) { if (inside(8 + c * k, -8 + sn * k)) r = k; }
      pts.push([8 + c * r, Math.max(-45, -8 + sn * r)]);
    }
    return pts;
  })();
  const cb = outline.reduce((b, p) => [Math.min(b[0], p[0]), Math.max(b[1], p[0]), Math.min(b[2], p[1]), Math.max(b[3], p[1])], [1e9, -1e9, 1e9, -1e9]);
  const ccx = (cb[0] + cb[1]) / 2, ccy = (cb[2] + cb[3]) / 2;
  const cloudPoly = outline.map(([x, y]) => [x - ccx, y - ccy]);
  const cloudShape = new THREE.Shape(cloudPoly.map(([x, y]) => new THREE.Vector2(x, y)));
  const slabGeo = (depth) => new THREE.ExtrudeGeometry(cloudShape, { depth, bevelEnabled: true, bevelThickness: 1.4, bevelSize: 1.4, bevelSegments: 3, curveSegments: 1 });
  const cloudAll = new THREE.Group();
  const cloudBody = new THREE.Group();     // wobbles slowly
  cloudAll.add(cloudBody);
  const rimTube = (poly, z, rad, mat) => {
    const curve = new THREE.CatmullRomCurve3(poly.filter((_, i) => i % 2 === 0).map(([x, y]) => new THREE.Vector3(x, y, z)), true, "catmullrom", 0.5);
    return new THREE.Mesh(new THREE.TubeGeometry(curve, 220, rad, 6, true), mat);
  };
  // three stacked slabs, front one carries the live network
  [[1, 0, mSlab, 0.0], [0.93, -15, mSlabBack, 0.0], [0.86, -30, mSlabBack, 0.0]].forEach(([sc, z, mat], i) => {
    const m = new THREE.Mesh(slabGeo(6), mat);
    m.scale.set(sc, sc, 1); m.position.z = z - 3;
    cloudBody.add(m);
    const rim = rimTube(cloudPoly, 0, i === 0 ? 0.95 : 0.6, i === 0 ? mAccentSolid : mLink);
    rim.scale.set(sc, sc, 1); rim.position.z = z + 3.9;
    cloudBody.add(rim);
  });
  // network on the front face
  const NZ = 4.4;
  const nodes = (() => {
    const R = rnd(11), out = [];
    const inPoly = (x, y) => { let c = false; for (let i = 0, j = cloudPoly.length - 1; i < cloudPoly.length; j = i++) { const [xi, yi] = cloudPoly[i], [xj, yj] = cloudPoly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
    const dEdge = (x, y) => cloudPoly.reduce((m, [px, py]) => Math.min(m, Math.hypot(px - x, py - y)), 1e9);
    let guard = 0;
    while (out.length < 38 && guard++ < 6000) {
      const x = (R() - 0.5) * (cb[1] - cb[0]), y = (R() - 0.5) * (cb[3] - cb[2]);
      if (!inPoly(x, y) || dEdge(x, y) < 11) continue;
      if (out.some((q) => Math.hypot(q[0] - x, q[1] - y) < 19)) continue;
      out.push([x, y]);
    }
    return out;
  })();
  const edges = (() => {
    const seen = new Set(), out = [];
    nodes.forEach((a, i) => {
      nodes.map((b, j) => [j, Math.hypot(a[0] - b[0], a[1] - b[1])]).filter(([j]) => j !== i).sort((p, q) => p[1] - q[1]).slice(0, 3)
        .forEach(([j, d]) => { const key = i < j ? i + "-" + j : j + "-" + i; if (d < 46 && !seen.has(key)) { seen.add(key); out.push([i, j]); } });
    });
    return out;
  })();
  {
    const pos = [];
    edges.forEach(([i, j]) => pos.push(nodes[i][0], nodes[i][1], NZ, nodes[j][0], nodes[j][1], NZ));
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    cloudBody.add(new THREE.LineSegments(g, mEdge));
  }
  const nodeMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(2.3, 16, 10), mAccentSolid, nodes.length);
  nodeMesh.position.z = NZ;
  cloudBody.add(nodeMesh);
  const hubMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(3.4, 16, 10), mHubMat(), 7);
  function mHubMat() { return new THREE.MeshBasicMaterial({ toneMapped: false }); }
  hubMesh.position.z = NZ;
  cloudBody.add(hubMesh);
  const hubIdx = nodes.map((n, i) => i).sort((a, b) => hashI(a * 7 + 3) - hashI(b * 7 + 3)).slice(0, 7);
  const edgeBeads = Array.from({ length: 14 }, (_, i) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1.7, 10, 8), new THREE.MeshBasicMaterial({ toneMapped: false }));
    m.position.z = NZ + 0.3; cloudBody.add(m);
    return { m, i, speed: 0.55 + (i % 5) * 0.12 };
  });
  cloudAll.position.copy(CLOUD);
  cloudAll.scale.setScalar(CLOUD_SCALE);
  net.add(cloudAll);
  const dummy = new THREE.Object3D();

  // live screens: redrawn a few times a second
  const SC = { bg: "#111826", card: "#1b2536", a: "#8C98E4", b: "#E0A867", c: "#8FD3B6", t: "#C9D1E0" };
  const polyline = (g, pts, color, lw) => { g.strokeStyle = color; g.lineWidth = lw; g.lineJoin = "round"; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); };
  const liveScreen = (w, h, draw) => {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d");
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    draw(g, w, h, 0);
    return { tex, g, w, h, draw, last: -1 };
  };
  const phoneScr = liveScreen(160, 330, (g, w, h, t) => {
    g.fillStyle = SC.bg; g.fillRect(0, 0, w, h);
    g.fillStyle = SC.card; g.fillRect(14, 18, w - 28, 120);
    polyline(g, Array.from({ length: 40 }, (_, i) => { const x = i * 0.5 - t * 3; const p = (((x / 6.3) % 1) + 1) % 1; return [22 + i * 3.1, 84 - 14 * Math.sin(x * 1.1) - 38 * Math.exp(-Math.pow((p - 0.5) / 0.04, 2))]; }), SC.a, 4);
    const v = 0.55 + 0.35 * Math.sin(t * 0.8);
    g.strokeStyle = SC.card; g.lineWidth = 14; g.beginPath(); g.arc(w / 2, 220, 42, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = SC.b; g.lineCap = "round"; g.beginPath(); g.arc(w / 2, 220, 42, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * v); g.stroke();
    [0, 1, 2].forEach((i) => { const q = 0.5 + 0.4 * Math.sin(t * (1.1 + i * 0.4) + i * 2); g.fillStyle = SC.card; g.fillRect(14, 276 + i * 18, w - 28, 10); g.fillStyle = [SC.a, SC.c, SC.b][i]; g.fillRect(14, 276 + i * 18, (w - 28) * q, 10); });
  });
  const monitorScr = liveScreen(420, 260, (g, w, h, t) => {
    g.fillStyle = SC.bg; g.fillRect(0, 0, w, h);
    g.fillStyle = SC.card; g.fillRect(16, 16, 250, 140); g.fillRect(278, 16, 126, 140); g.fillRect(16, 168, 388, 76);
    polyline(g, Array.from({ length: 60 }, (_, i) => [26 + i * 3.9, 100 - 34 * Math.sin(i * 0.28 - t * 2.2) - 12 * Math.sin(i * 0.9 - t * 3.1)]), SC.a, 4);
    polyline(g, Array.from({ length: 60 }, (_, i) => [26 + i * 3.9, 124 - 16 * Math.sin(i * 0.2 + 1 - t * 1.4)]), SC.b, 3);
    const v = 0.55 + 0.35 * Math.sin(t * 0.7);
    g.strokeStyle = "#26324a"; g.lineWidth = 14; g.beginPath(); g.arc(341, 90, 40, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = SC.c; g.lineCap = "round"; g.beginPath(); g.arc(341, 90, 40, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * v); g.stroke();
    for (let i = 0; i < 26; i++) { const q = 0.3 + 0.6 * Math.abs(Math.sin(i * 1.3 + t * 2.2)); g.fillStyle = i % 5 === 0 ? SC.b : SC.a; g.fillRect(28 + i * 14.4, 236 - 56 * q, 9, 56 * q); }
  });

  const phoneG = new THREE.Group();
  {
    const body = new THREE.Mesh(new RoundedBoxGeometry(26, 50, 3.6, 3, 2.8), mDark);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(22, 45.5), new THREE.MeshBasicMaterial({ map: phoneScr.tex, toneMapped: false }));
    scr.position.z = 1.85;
    phoneG.add(body, scr);
  }
  const monitorG = new THREE.Group();
  {
    const body = new THREE.Mesh(new RoundedBoxGeometry(80, 52, 3.6, 3, 2.4), mDark);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(74.5, 46), new THREE.MeshBasicMaterial({ map: monitorScr.tex, toneMapped: false }));
    scr.position.z = 1.85;
    const neck = new THREE.Mesh(new THREE.BoxGeometry(6, 14, 3), mDark); neck.position.y = -32;
    const foot = new THREE.Mesh(new RoundedBoxGeometry(30, 2.4, 14, 2, 1), mDark); foot.position.y = -39.5;
    monitorG.add(body, scr, neck, foot);
  }
  const nodeGs = [0, 1, 2].map(() => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new RoundedBoxGeometry(15, 15, 15, 3, 2.4), mMetal);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 14, 10), mMetal); ant.position.y = 14;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(2.6, 18, 12), mAccentSolid); tip.position.y = 21.5;
    const eye = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.8, 16), mAccentSolid); eye.rotation.x = Math.PI / 2; eye.position.z = 7.7;
    const waves = [0, 1].map(() => {
      const r = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 6, 48), new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false }));
      r.position.y = 21.5; r.rotation.x = Math.PI / 2; g.add(r);
      return r;
    });
    g.add(body, ant, tip, eye);
    g.userData = { tip, waves };
    return g;
  });
  const ENDPOINTS = [
    { g: phoneG, pos: new THREE.Vector3(318, 150, -50), ry: 0.28, lift: 70 },
    { g: monitorG, pos: new THREE.Vector3(-82, 140, -96), ry: 0.30, lift: 70 },
    { g: nodeGs[0], pos: new THREE.Vector3(286, 300, -190), ry: 0.4, lift: 70 },
    { g: nodeGs[1], pos: new THREE.Vector3(-6, 320, -80), ry: -0.3, lift: 70 },
    { g: nodeGs[2], pos: new THREE.Vector3(312, 40, -170), ry: 0.2, lift: 70 }
  ];
  ENDPOINTS.forEach((e) => { e.g.position.copy(e.pos); e.g.rotation.y = e.ry; e.g.visible = false; net.add(e.g); });

  // links (solid thin tubes that draw themselves on) and the bits that ride them
  const TUBE_SEG = 64, TUBE_RAD = 6;
  const streams = [];
  function addStream(points, count, speed, size, dir, radius, helix = 0) {
    const curve = new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.5);
    const geo = new THREE.TubeGeometry(curve, TUBE_SEG, radius, TUBE_RAD, false);
    const tube = new THREE.Mesh(geo, mLink);
    tube.frustumCulled = false; tube.visible = false;
    net.add(tube);
    curve.getLengths(200);
    const bits = [];
    for (let i = 0; i < count; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dotTex, transparent: true, depthWrite: false }));
      sp.visible = false; sp.center.set(0.5, 0.5);
      net.add(sp);
      bits.push({ sp, off: i / count + ((i * 0.37) % 1) * 0.02, ch: -1 });
    }
    const st = { curve, tube, bits, speed, size, dir, helix };
    streams.push(st);
    return st;
  }
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const mainStream = addStream([V3(COIL_CENTER[0] - CX0, 12, 0), V3(COIL_CENTER[0] - CX0 + 6, 70, -30), V3(140, 140, -66), V3(126, 176, -104)], 30, 0.13, 15, 1, 0.9, 14);
  const RIM = [[128, -36, 0], [-124, -34, 14], [96, 52, 0], [-34, 84, 0], [128, -48, -6]];   // where each link leaves the cloud
  const endStreams = ENDPOINTS.map((e, k) => {
    const a = CLOUD.clone(), b = e.pos.clone();
    const start = a.clone().add(V3(...RIM[k]));
    const dirv = b.clone().sub(start).normalize();
    const end = b.clone().sub(dirv.clone().multiplyScalar(k === 1 ? 52 : 28));
    const mid = start.clone().lerp(end, 0.5); mid.y += 22;
    const p1 = start.clone().lerp(end, 0.2); p1.y += 10;
    const p2 = start.clone().lerp(end, 0.8); p2.y += 12;
    return addStream([start, p1, mid, p2, end], k < 2 ? 10 : 6, 0.15 + 0.02 * k, 13, k % 2 ? -1 : 1, 0.55);
  });

  /* ---- signal waves (outside the board group; they are anchored to the electrodes) */
  const waveGeo = (() => {
    const N = 640, pos = new Float32Array((N + 1) * 2 * 3), t = new Float32Array((N + 1) * 2), sd = new Float32Array((N + 1) * 2), idx = [];
    for (let i = 0; i <= N; i++) {
      t[i * 2] = t[i * 2 + 1] = i / N; sd[i * 2] = -1; sd[i * 2 + 1] = 1;
      if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aT", new THREE.BufferAttribute(t, 1));
    g.setAttribute("aSide", new THREE.BufferAttribute(sd, 1));
    g.setIndex(idx);
    return g;
  })();
  const WAVES = [
    { kind: 0, lane: 0, col: "accent", base: 88, amp: 26, a: 0.95, speed: 0.34 },
    { kind: 1, lane: 1, col: "ink", base: 30, amp: 34, a: 0.8, speed: 0.42 },
    { kind: 2, lane: 2, col: "copper", base: -26, amp: 20, a: 0.95, speed: 0.30 }
  ];
  // per strand: broad blur, soft glow, crisp core, travelling packets, and two thin "echo" strands
  const LAYERS = [
    { id: "haze", ren: 1 }, { id: "glow", ren: 2 }, { id: "core", ren: 4 }, { id: "flow", ren: 5, mode: 1 },
    { id: "echoA", ren: 3, phOff: 0.55, zOff: 9, bOff: 7, aOff: 0.55 }, { id: "echoB", ren: 3, phOff: -0.7, zOff: -9, bOff: -8, aOff: 0.5 }
  ];
  const waveMeshes = [];
  WAVES.forEach((wv, wi) => {
    LAYERS.forEach((L) => {
      const mat = new THREE.ShaderMaterial({
        vertexShader: WAVE_VERT, fragmentShader: WAVE_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: {
          uPh: { value: 0 }, uKind: { value: wv.kind }, uX0: { value: ELX - CX0 - 1500 }, uX1: { value: ELX - CX0 },
          uBase: { value: wv.base + (L.bOff || 0) }, uEnd: { value: zt + 1.0 }, uAmp: { value: wv.amp * (L.aOff || 1) }, uZ: { value: -LANES[wv.lane] + (L.zOff || 0) },
          uHW: { value: 2 }, uColor: { value: new THREE.Color() }, uColor2: { value: new THREE.Color() }, uAlpha: { value: 1 }, uK: { value: 3 }, uFocus: { value: 0 },
          uMode: { value: L.mode || 0 }, uTime: { value: 0 }, uCount: { value: 5 + wi }, uSpeed: { value: wv.speed }
        }
      });
      const m = new THREE.Mesh(waveGeo, mat);
      m.frustumCulled = false; m.renderOrder = L.ren;
      scene.add(m);
      waveMeshes.push({ m, wv, L, layer: L.id, u: mat.uniforms });
    });
  });

  /* ---- colours */
  let lastC = null;
  const dotCols = [0, 1, 2, 3].map(() => new THREE.Color());
  const col = (c) => new THREE.Color().setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace);
  function applyColors(C) {
    mBoard.color.copy(col(C.pcb)).multiplyScalar(C.dark ? 0.8 : 0.9);
    mCopper.color.copy(col(C.copper));
    mMetal.color.copy(col(C.metal));
    mChip.color.copy(col(C.chip));
    mChipTop.color.copy(col(C.chip)).multiplyScalar(1.5);
    mCeramic.color.copy(col(C.ceramic));
    mRes.color.copy(col(C.chip)).multiplyScalar(0.7);
    ribbons.forEach((r) => r.mat.color.copy(col(C.copper)));
    waveMeshes.forEach((w) => { w.u.uColor.value.copy(col(C[w.wv.col])); w.u.uColor2.value.copy(C.dark ? new THREE.Color(0xffffff) : col(C.ink)); });
    sparks.forEach((s) => { s.halo.material.color.copy(col(C.accent)); s.core.material.color.copy(col(C.ink)); });
    coilHalo.material.color.copy(col(C.accent)); coilCore.material.color.copy(col(C.ink));
    mAccentSolid.color.copy(col(C.accent));
    mLink.color.copy(col(C.muted)).lerp(col(C.bg), 0.2);
    if (C.dark) mSlab.color.copy(col(C.chip)).multiplyScalar(1.15); else mSlab.color.setRGB(0.7, 0.74, 0.79, THREE.SRGBColorSpace);
    if (C.dark) mSlabBack.color.copy(col(C.chip)).multiplyScalar(0.8); else mSlabBack.color.setRGB(0.58, 0.62, 0.68, THREE.SRGBColorSpace);
    mEdge.color.copy(col(C.accent)).lerp(col(C.ink), C.dark ? 0.25 : 0.35);
    nodeMesh.material.color.copy(col(C.accent));
    hubMesh.material.color.copy(col(C.ink)); if (!C.dark) hubMesh.material.color.lerp(col(C.bg), 0.3);
    edgeBeads.forEach((b) => b.m.material.color.copy(col(C.ink)));
    nodeGs.forEach((g) => g.userData.waves.forEach((w) => w.material.color.copy(col(C.accent))));
    mDark.color.copy(col(C.chip)).multiplyScalar(0.8);
    dotCols[0].copy(col(C.accent)); dotCols[1].copy(col(C.copper));
    dotCols[2].copy(col(C.dark ? [143, 211, 182] : [34, 150, 112])); dotCols[3].copy(col(C.dark ? [236, 143, 170] : [196, 62, 104]));
    rings.forEach((r) => r.material.color.copy(col(C.accent)));
    gridMat.color.copy(col(C.ink));
    shadowMat.opacity = C.dark ? 0.5 : 0.28;
    key.intensity = (hasEnv ? 2.6 : 3.2) * (C.dark ? 1 : 1.1);
    blobs.forEach((b) => b.material.color.copy(col(C[b.userData.col])));
  }

  /* ---- size */
  const size = { w: 1, h: 1, dpr: 1 };
  function resize(w, h, dpr) {
    size.w = Math.max(1, w); size.h = Math.max(1, h); size.dpr = dpr;
    renderer.setPixelRatio(dpr);
    renderer.setSize(size.w, size.h, false);
    camera.aspect = size.w / size.h;
  }

  /* ---- per-frame */
  const ck = [0, 0, 0, 0, 0, 0];
  const v3 = new THREE.Vector3();
  let px = 0, py = 0, tx = 0, ty = 0;
  function render(s, C, reduce, time) {
    if (reduce) { tx = ty = px = py = 0; time = 1.4; }
    px += (tx - px) * 0.07; py += (ty - py) * 0.07;
    if (C !== lastC) { applyColors(C); lastC = C; }
    const { w, h } = size;
    const mobile = w < 900 && w < h * 1.15;
    const st = stages(s);
    const t = time || 0;

    /* camera */
    cameraKey(s, ck);
    camera.fov = mobile ? 44 : 30;
    camera.aspect = w / h;
    const halfTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const aspect = camera.aspect;
    const span = ck[2] * (mobile ? THREE.MathUtils.clamp(0.56 + (aspect - 0.5) * 0.6, 0.56, 0.8) : 1);
    /* very wide screens keep the same vertical framing instead of zooming in */
    const dist = span / (2 * halfTan * (mobile ? aspect : Math.min(aspect, 1.75)));
    const az = ck[0] + px * 0.07, el = ck[1] - py * 0.04;
    v3.set(ck[3] - (mobile ? 95 * clamp(1 - s) : 0), ck[4], ck[5]);
    camera.position.set(v3.x + dist * Math.sin(az) * Math.cos(el), v3.y + dist * Math.sin(el), v3.z + dist * Math.cos(az) * Math.cos(el));
    camera.lookAt(v3);
    const cx = mobile ? 0.5 : 0.7, cy = mobile ? 0.31 : 0.52;
    camera.setViewOffset(w, h, -(cx - 0.5) * w, -(cy - 0.5) * h, w, h);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    /* background blobs: fixed in view, far behind everything */
    const bz = dist * 1.9, halfH = bz * halfTan, halfW = halfH * camera.aspect;
    blobs.forEach((b, i) => {
      const { bx, by, br } = b.userData;
      const x = (bx - 0.5) * 2 * halfW + Math.sin(s * 0.9 + i * 1.7) * 36 * (bz / 900) - (cx - 0.5) * 2 * halfW;
      const y = -(by - 0.5) * 2 * halfH + (i % 2 ? 1 : -1) * s * 16 * (bz / 900) + (cy - 0.5) * 2 * halfH;
      b.position.set(x, y, -bz);
      b.scale.setScalar(Math.min(w, h) * br * 2.8 * (2 * halfH / h));
      b.material.opacity = b.userData.al * (C.dark ? 1.1 : 1);
    });

    /* floor */
    gridMat.opacity = 0.14 * smooth(0, 0.6, st.board);
    shadowFloor.visible = st.board > 0.001;

    /* waves: flow toward the board all the time, and a little faster as you scroll */
    waveMeshes.forEach(({ L, wv, u }) => {
      const f = st.focus, id = L.id;
      u.uPh.value = -(s * 1.6 + t * 0.75) + (L.phOff || 0);
      u.uFocus.value = f;
      u.uTime.value = t;
      if (id === "haze") { u.uHW.value = lerp(30, 12, f); u.uK.value = 1.7; u.uAlpha.value = (0.18 * (1 - f) + 0.07 * f) * wv.a; }
      else if (id === "glow") { u.uHW.value = lerp(9, 6.5, f); u.uK.value = 2.6; u.uAlpha.value = 0.36 * smooth(0.3, 1, f) * wv.a; }
      else if (id === "core") { u.uHW.value = lerp(7.5, 1.7, f); u.uK.value = lerp(2.4, 4.0, f); u.uAlpha.value = lerp(0.55, 1.0, Math.pow(f, 1.4)) * Math.min(1, wv.a + 0.2); }
      else if (id === "flow") { u.uHW.value = 4.2; u.uK.value = 3.4; u.uAlpha.value = 1.0 * smooth(0.55, 1, f); }
      else { u.uHW.value = 0.9; u.uK.value = 3.0; u.uAlpha.value = 0.4 * smooth(0.5, 1, f); u.uFocus.value = 1; }
    });

    /* board: drops in from above and spins to rest */
    const b = st.board;
    boardG.visible = b > 0.001;
    boardG.position.y = (1 - easeOutBack(b, 0.75)) * 260;
    boardG.rotation.y = (1 - easeOutCubic(b)) * 0.9;

    /* electrodes and pads */
    const tr = st.traces;
    electrodes.forEach((g, i) => {
      const f = smooth(0, 0.45, tr - i * 0.06);
      g.visible = f > 0.001;
      g.scale.setScalar(Math.max(0.001, easeOutBack(f, 1.2)));
    });
    const padS = smooth(0.15, 0.7, tr);
    pads.forEach((p) => { p.visible = padS > 0.001; p.scale.setScalar(Math.max(0.001, padS)); });

    /* traces draw on, with a spark at the leading edge */
    const traceFrac = (r) => {
      const li = laneR.indexOf(r);
      if (li >= 0) return smooth(0, 0.6, tr - li * 0.08);
      return smooth(0.35, 1, tr);
    };
    sparks.forEach((sp) => {
      const r = sp.r;
      const isCoil = false;
      const f = isCoil ? 0 : traceFrac(r);
      r.uni.value = r.length * f + (f >= 0.999 ? 1e4 : 0);
      r.mesh.visible = f > 0.001;
      const on = f > 0.002 && f < 0.995;
      sp.halo.visible = sp.core.visible = on;
      if (on) {
        const q = pointAlong(r.pts, f * 0.9999);
        sp.halo.position.set(q[0] - CX0, zt + 2.2, -q[1]); sp.core.position.copy(sp.halo.position);
        sp.halo.material.opacity = 0.9 * Math.sin(f * Math.PI) ** 0.5; sp.core.material.opacity = 1;
      }
    });

    /* coil */
    const cf = clamp(st.coil / 0.72);
    coilG.visible = st.coil > 0.001;
    const lift = Math.max(0, (1 - easeOutBack(clamp((st.coil - 0.35) / 0.65), 1.1)) * 44);
    coilG.position.y = lift;
    coilR.uni.value = coilR.length * cf + (cf >= 0.999 ? 1e4 : 0);
    coilEnd.visible = cf > 0.985;
    const coilOn = cf > 0.002 && cf < 0.995;
    coilHalo.visible = coilCore.visible = coilOn;
    if (coilOn) {
      const q = pointAlong(COIL, cf * 0.9999);
      coilHalo.position.set(q[0] - CX0, zt + 3, -q[1]); coilCore.position.copy(coilHalo.position);
      coilHalo.material.opacity = 0.9; coilCore.material.opacity = 1;
    }

    /* parts fly in */
    parts.forEach((p, k) => {
      const f = st.pass[k];
      p.g.visible = f > 0.001;
      const e = easeOutBack(f, 1.2);
      p.g.position.y = zt + Math.max(-0.3, (1 - e) * 120);
      p.g.rotation.y = (1 - easeOutCubic(f)) * (k % 2 ? -1 : 1) * 1.1;
      p.g.scale.setScalar(Math.max(0.001, smooth(0, 0.22, f)));
    });
    {
      const f = st.chip;
      chipG.visible = f > 0.001;
      const e = easeOutBack(f, 1.1);
      chipG.position.y = zt + Math.max(-0.3, (1 - e) * 170);
      chipG.rotation.y = (1 - easeOutCubic(f)) * 1.4;
      chipG.scale.setScalar(Math.max(0.001, smooth(0, 0.2, f)));
    }

    /* bits running on the board, driven by time */
    boardBits.forEach((b) => {
      const gate = b.kind === "lane" ? (st.flow > 0.01 && st.traces > 0.6 ? st.flow : 0) : st.live;
      const raw = t * b.speed * b.dir + b.off, lap = Math.floor(raw), u = raw - lap;
      const show = gate > 0.01;
      b.sp.visible = show;
      if (!show) return;
      let hh = lap * 131 + b.idx * 7919 + 29; hh = Math.imul(hh ^ (hh >>> 16), 2246822507); hh = Math.imul(hh ^ (hh >>> 13), 3266489909);
      const ch = ((hh ^ (hh >>> 16)) >>> 0) & 3;
      if (ch !== b.ch) { b.ch = ch; b.sp.material.color.copy(dotCols[ch]); }
      const q = pointAlong(b.path, u * 0.9999);
      b.sp.position.set(q[0] - CX0, zt + 4.2, -q[1]);
      b.sp.scale.setScalar(Math.max(0.001, b.size * smooth(0, 0.08, u) * (1 - smooth(0.9, 1, u)) * gate));
    });
    rings.forEach((r, k) => {
      const on = st.live > 0.01;
      r.visible = on;
      if (!on) return;
      const u = (t * 0.32 + k / 3) % 1;
      r.scale.setScalar(12 + u * 170);
      r.material.opacity = 0.95 * st.live * Math.pow(1 - u, 1.2);
    });

    /* cloud, endpoints, bits (these also move with time) */
    net.visible = st.cloud > 0.001 || st.bits > 0.001;
    if (net.visible) {
      const cs = easeOutBack(st.cloud, 1.1);
      cloudAll.visible = st.cloud > 0.001;
      cloudAll.scale.setScalar(Math.max(0.001, cs * CLOUD_SCALE));
      cloudAll.position.set(CLOUD.x, CLOUD.y + Math.sin(t * 0.8) * 3.5 - (1 - cs) * 60, CLOUD.z);
      cloudBody.rotation.y = Math.sin(t * 0.33) * 0.2 + (1 - cs) * 1.2;
      cloudBody.rotation.x = Math.sin(t * 0.27 + 1) * 0.03;
      // network: nodes twinkle, packets hop along the links
      nodes.forEach((n, i) => { const k = 0.8 + 0.35 * Math.sin(t * 2.1 + i * 1.7); dummy.position.set(n[0], n[1], 0); dummy.scale.setScalar(k); dummy.updateMatrix(); nodeMesh.setMatrixAt(i, dummy.matrix); });
      nodeMesh.instanceMatrix.needsUpdate = true;
      hubIdx.forEach((ni, i) => { const k = 0.85 + 0.3 * Math.sin(t * 1.6 + i * 2.3); dummy.position.set(nodes[ni][0], nodes[ni][1], 0); dummy.scale.setScalar(k); dummy.updateMatrix(); hubMesh.setMatrixAt(i, dummy.matrix); });
      hubMesh.instanceMatrix.needsUpdate = true;
      edgeBeads.forEach((b) => {
        const raw = t * b.speed + b.i * 0.37, lap = Math.floor(raw), u = raw - lap;
        const e = edges[hashI(lap * 53 + b.i * 977 + 5) % edges.length], a = nodes[e[0]], c = nodes[e[1]];
        b.m.position.set(lerp(a[0], c[0], u), lerp(a[1], c[1], u), NZ + 0.3);
        b.m.scale.setScalar(Math.max(0.001, smooth(0, 0.15, u) * (1 - smooth(0.85, 1, u))));
      });
      // screens redraw about 20 times a second while visible
      [[phoneScr, 0], [monitorScr, 1]].forEach(([sc, k]) => {
        if (st.end[k] > 0.4 && t - sc.last > 0.05) { sc.last = t; sc.draw(sc.g, sc.w, sc.h, t); sc.tex.needsUpdate = true; }
      });
      ENDPOINTS.forEach((e, k) => {
        const f = st.end[k], ee = easeOutBack(f, 1.3);
        e.g.visible = f > 0.001;
        e.g.scale.setScalar(Math.max(0.001, smooth(0, 0.3, f) * (0.6 + 0.4 * ee) * 1.45));
        e.g.position.set(e.pos.x, e.pos.y + Math.sin(t * 0.9 + k * 1.7) * 2.6 - (1 - ee) * e.lift, e.pos.z);
        e.g.rotation.y = e.ry + (1 - ee) * 0.8;
        if (e.g.userData.tip) {
          e.g.userData.tip.scale.setScalar(1 + 0.25 * Math.sin(t * 3.2 + k));
          e.g.userData.waves.forEach((w, wi) => { const u = (t * 0.6 + wi * 0.5 + k * 0.23) % 1; w.scale.setScalar(3 + u * 15); w.material.opacity = 0.9 * (1 - u) * f; });
        }
      });
      const placeStream = (S, frac, gate) => {
        const nTube = Math.floor(clamp(frac) * TUBE_SEG) * TUBE_RAD * 6;
        S.tube.visible = frac > 0.01;
        S.tube.geometry.setDrawRange(0, nTube);
        S.bits.forEach((b, i) => {
          const raw = t * S.speed * S.dir + b.off;
          const lap = Math.floor(raw);
          let u = raw - lap;
          let hh = lap * 131 + i * 7919 + 17; hh = Math.imul(hh ^ (hh >>> 16), 2246822507); hh = Math.imul(hh ^ (hh >>> 13), 3266489909); const ch = ((hh ^ (hh >>> 16)) >>> 0) & 3;
          const show = frac > 0.01 && gate > 0.01 && u < frac;
          b.sp.visible = show;
          if (!show) return;
          if (ch !== b.ch) { b.ch = ch; b.sp.material.color.copy(dotCols[ch]); }
          const pu = S.dir > 0 ? u : 1 - u;
          b.sp.position.copy(S.curve.getPointAt(clamp(pu)));
          if (S.helix) {
            const a = pu * 9 + (i % 2) * Math.PI + t * 1.4, r = S.helix * smooth(0.02, 0.18, u) * (1 - 0.6 * smooth(0.8, 1, u));
            b.sp.position.x += Math.cos(a) * r; b.sp.position.z += Math.sin(a) * r;
          }
          const sz = S.size * smooth(0, 0.1, u) * (1 - smooth(0.88, 1, u)) * gate;
          b.sp.scale.setScalar(Math.max(0.001, sz));
        });
      };
      placeStream(mainStream, st.bits, 1);
      endStreams.forEach((S, k) => placeStream(S, st.link * smooth(0, 1, st.end[k] * 3), smooth(0.2, 0.8, st.end[k])));
    }

    renderer.render(scene, camera);
  }

  function dispose() { renderer.dispose(); }

  // true while something on screen keeps moving by itself (the data stream, pointer easing)
  const isLive = () => true;   // signals, bits and screens keep moving while the scene is on screen
  const setPointer = (nx, ny) => { tx = clamp(nx, -1, 1); ty = clamp(ny, -1, 1); };

  return { resize, render, dispose, renderer, stages, isLive, setPointer };
}

window.Scene3D = { create, stages };
