/*
  Small interactive 3D models of the projects (three.js).

  This file is the SOURCE. The browser loads the bundled copy, js/models.bundle.js,
  which is made with:   npm install   then   npm run build

  Every model is built from the device drawings in the paper it belongs to
  (layer stacks, exploded views, coil layouts). Dimensions are stylised so the parts
  stay readable; the layout and the order of the layers follow the figures.

  window.Models.mount(container, kind, { interactive }) puts a model into a box.
  It only runs while the box is on screen.
*/
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/* ------------------------------------------------------------------ helpers */
const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const fract = (x) => x - Math.floor(x);
const hash = (n) => { let x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const COL = {
  pi: 0xd8a23f, cu: 0xc4713a, gold: 0xe3c15c, silver: 0xc9d0da, black: 0x15181e, chip: 0x232830,
  pdms: 0xe3edf9, pet: 0x9ccaff, tape: 0xe9e0c9, tapeGrey: 0x7c828c, skin: 0xe6b69b, dermis: 0xd98d85,
  red: 0xdc4a42, teal: 0x2fb6a8, rose: 0xe0526f, blue: 0x4f7cff, mint: 0x45c08e, amber: 0xf0a640,
  panel: 0x10151d, fr4: 0xc3b57f, green: 0x3c9362, white: 0xeef1f5, ceramic: 0x9b7c58, sweat: 0x5cd2ff
};
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.05, ...o });
const glass = (color, opacity = 0.22, o = {}) => new THREE.MeshStandardMaterial({
  color, transparent: true, opacity, roughness: 0.12, metalness: 0, depthWrite: false, side: THREE.DoubleSide, ...o
});
const basic = (color, o = {}) => new THREE.MeshBasicMaterial({ color, toneMapped: false, ...o });
const toColor = (c) => (c.isColor ? c : new THREE.Color(c));

/* rounded polygon outline, points are [x, z] on the ground plane */
function roundPoly(pts, r) {
  const n = pts.length, sh = new THREE.Shape();
  const P = pts.map(([x, z]) => [x, -z]);
  const corner = (i) => {
    const p0 = P[(i + n - 1) % n], p1 = P[i], p2 = P[(i + 1) % n];
    const a = [p0[0] - p1[0], p0[1] - p1[1]], b = [p2[0] - p1[0], p2[1] - p1[1]];
    const la = Math.hypot(a[0], a[1]), lb = Math.hypot(b[0], b[1]);
    const d = Math.min(r, la / 2, lb / 2);
    return [[p1[0] + (a[0] / la) * d, p1[1] + (a[1] / la) * d], p1, [p1[0] + (b[0] / lb) * d, p1[1] + (b[1] / lb) * d]];
  };
  for (let i = 0; i < n; i++) {
    const [s, c, e] = corner(i);
    if (i === 0) sh.moveTo(s[0], s[1]); else sh.lineTo(s[0], s[1]);
    sh.quadraticCurveTo(c[0], c[1], e[0], e[1]);
  }
  sh.closePath();
  return sh;
}
const rectPts = (cx, cz, w, d) => [[cx - w / 2, cz - d / 2], [cx + w / 2, cz - d / 2], [cx + w / 2, cz + d / 2], [cx - w / 2, cz + d / 2]];
function circleShape(r, holes = []) {
  const sh = new THREE.Shape(); sh.absarc(0, 0, r, 0, TAU, false);
  holes.forEach((h) => sh.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z)))));
  return sh;
}
/* flat plate lying on the ground plane, bottom at y = 0 */
function plate(shape, thick, mat, bevel = 0.012) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 14 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bevel, 0);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = !mat.transparent; m.receiveShadow = true;
  return m;
}
/* plate standing up, facing +z (used for screens) */
function plateUp(shape, thick, mat) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false, curveSegments: 10 });
  const m = new THREE.Mesh(g, mat); m.castShadow = true; return m;
}
function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y + h / 2, z); m.castShadow = !mat.transparent; m.receiveShadow = true; return m;
}
function cyl(rt, rb, h, mat, x = 0, y = 0, z = 0, seg = 24) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
  m.position.set(x, y + h / 2, z); m.castShadow = !mat.transparent; m.receiveShadow = true; return m;
}
/* trace along a polyline: merged boxes, so corners stay sharp. points: Vector3[] */
function traceGeo(points, w, h, normals = null) {
  const parts = [];
  const m4 = new THREE.Matrix4(), dir = new THREE.Vector3(), n = new THREE.Vector3(), side = new THREE.Vector3(), n2 = new THREE.Vector3(), mid = new THREE.Vector3();
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    dir.subVectors(b, a); const len = dir.length(); if (len < 1e-6) continue; dir.divideScalar(len);
    if (normals) n.copy(normals[i]).normalize(); else n.set(0, 1, 0);
    side.crossVectors(dir, n).normalize(); n2.crossVectors(side, dir).normalize();
    mid.addVectors(a, b).multiplyScalar(0.5);
    m4.makeBasis(dir.clone().multiplyScalar(len + w), n2.clone().multiplyScalar(h), side.clone().multiplyScalar(w));
    m4.setPosition(mid);
    parts.push(new THREE.BoxGeometry(1, 1, 1).applyMatrix4(m4));
  }
  const g = mergeGeometries(parts); parts.forEach((p) => p.dispose()); return g;
}
function trace(pts2, y, w, h, mat) {
  const m = new THREE.Mesh(traceGeo(pts2.map(([x, z]) => V(x, 0, z)), w, h), mat);
  m.position.y = y + h / 2; m.castShadow = true; m.receiveShadow = true; return m;
}
function rectSpiral(cx, cz, w, h, turns, pitch) {
  const pts = []; let x0 = -w / 2, x1 = w / 2, z0 = -h / 2, z1 = h / 2;
  for (let i = 0; i < turns; i++) {
    pts.push([cx + x0, cz + z0], [cx + x1, cz + z0], [cx + x1, cz + z1], [cx + x0, cz + z1], [cx + x0, cz + z0 + pitch]);
    x0 += pitch; z0 += pitch; x1 -= pitch; z1 -= pitch;
  }
  return pts;
}
function roundSpiral(cx, cz, r0, r1, turns, steps = 36) {
  const pts = [], N = turns * steps;
  for (let i = 0; i <= N; i++) { const u = i / N, a = u * turns * TAU, r = lerp(r0, r1, u); pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); }
  return pts;
}
/* chip with a pin ring */
function ic(mats, w, d, h, x, y, z) {
  const g = new THREE.Group();
  g.add(box(w, h, d, mats.chip, 0, 0, 0));
  g.add(box(w + 0.07, h * 0.28, d + 0.07, mats.silver, 0, 0, 0));
  g.position.set(x, y, z); return g;
}
/* ring with a hole, used for coils on a disc */
function ringShape(ro, ri) {
  const sh = new THREE.Shape(); sh.absarc(0, 0, ro, 0, TAU, false);
  const p = new THREE.Path(); p.absarc(0, 0, ri, 0, TAU, true); sh.holes.push(p); return sh;
}
/* one hole shaped like a hub with radial channels, so a layer can show a fluid network */
function starHole(rc, len, hw, angles) {
  const pts = [], d = Math.asin(Math.min(0.99, hw / rc));
  angles.forEach((a, k) => {
    const ca = Math.cos(a), sa = Math.sin(a);
    pts.push([Math.cos(a - d) * rc, Math.sin(a - d) * rc]);
    pts.push([ca * len + sa * hw, sa * len - ca * hw]);
    pts.push([ca * len - sa * hw, sa * len + ca * hw]);
    pts.push([Math.cos(a + d) * rc, Math.sin(a + d) * rc]);
    const nx = angles[(k + 1) % angles.length]; let a1 = a + d, a2 = nx - d; if (a2 < a1) a2 += TAU;
    for (let s = 1; s < 8; s++) { const t = a1 + ((a2 - a1) * s) / 8; pts.push([Math.cos(t) * rc, Math.sin(t) * rc]); }
  });
  return pts;
}

/* dots that follow a path, drawn as one instanced mesh */
const SPHERE = new THREE.SphereGeometry(1, 12, 9);
function makeDots(parent, n, mat) {
  const mesh = new THREE.InstancedMesh(SPHERE, mat || basic(0xffffff), n);
  mesh.frustumCulled = false; mesh.castShadow = false; parent.add(mesh);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i < n; i++) { m4.compose(V(0, -50, 0), q, s.setScalar(0.0001)); mesh.setMatrixAt(i, m4); mesh.setColorAt(i, c.setRGB(1, 1, 1)); }
  return {
    mesh,
    set(i, p, size, color) { m4.compose(p, q, s.setScalar(Math.max(size, 0.0001))); mesh.setMatrixAt(i, m4); if (color !== undefined) mesh.setColorAt(i, c.set(color)); },
    hide(i) { m4.compose(V(0, -50, 0), q, s.setScalar(0.0001)); mesh.setMatrixAt(i, m4); },
    commit() { mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; }
  };
}
/* expanding rings, for radio waves. The group is aimed with lookAt; rings face +z. */
function makeWaves(parent, color, n, r0, r1, thick = 0.05) {
  const g = new THREE.Group(); parent.add(g);
  const geo = new THREE.RingGeometry(1 - thick, 1, 72), rings = [];
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(geo, basic(color, { transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }));
    m.frustumCulled = false; g.add(m); rings.push(m);
  }
  g.update = (t, speed = 0.35, alpha = 0.7, dist = 0) => {
    rings.forEach((m, i) => {
      const p = fract(t * speed + i / n);
      m.scale.setScalar(lerp(r0, r1, p));
      m.position.z = p * dist;
      m.material.opacity = alpha * Math.sin(Math.PI * Math.pow(p, 0.7)) * (1 - p * 0.35);
    });
  };
  return g;
}
const place = (o, x, y, z) => { o.position.set(x, y, z); return o; };
function beam(mesh, a, b) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  mesh.position.copy(a).addScaledVector(d, 0.5); mesh.scale.set(1, len, 1);
  mesh.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize());
}
function linePlot(parent, n, color, y0 = 0) {
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color, toneMapped: false }));
  line.frustumCulled = false; parent.add(line); return line;
}
const setLine = (line, fn) => {
  const pos = line.geometry.attributes.position, n = pos.count;
  for (let i = 0; i < n; i++) { const [x, y] = fn(i / (n - 1)); pos.setXYZ(i, x, y, 0); }
  pos.needsUpdate = true;
};

/* ====================================================================== */
/*  1. WiRe: wireless reader for passive frequency-shift sensors            */
/*     Paper figure 1c: PDMS / polyimide board / PDMS, NFC antenna, BLE SoC, */
/*     analogue front end, reader coil; plus a passive LC strain sensor.     */
/* ====================================================================== */
function buildReader() {
  const g = new THREE.Group(), M = { chip: std(COL.chip, { roughness: 0.4 }), silver: std(COL.silver, { metalness: 0.7, roughness: 0.3 }) };
  const pi = std(COL.pi, { roughness: 0.45 }), cu = std(COL.cu, { metalness: 0.5, roughness: 0.35 });
  // outline from the photo (figure 1d): reader-coil lobe, neck, main board, neck, NFC-antenna lobe
  const Lpts = [[-1.2, -4.2], [1.2, -4.2], [1.2, -1.8], [0.4, -1.8], [0.4, -1.3], [1.6, -1.3], [1.6, 1.3], [0.4, 1.3], [0.4, 1.8], [1.15, 1.8], [1.15, 4.0], [-1.15, 4.0], [-1.15, 1.8], [-0.4, 1.8], [-0.4, 1.3], [-1.6, 1.3], [-1.6, -1.3], [-0.4, -1.3], [-0.4, -1.8], [-1.2, -1.8]];
  const Lbig = Lpts.map(([x, z]) => [x * 1.06, z * 1.03]);
  const board = new THREE.Group(); g.add(board);
  board.add(plate(roundPoly(Lpts, 0.22), 0.06, pi));
  const Y = 0.07;
  board.add(trace(rectSpiral(0, -3.0, 2.0, 2.0, 11, 0.075), Y, 0.04, 0.025, cu));      // reader coil
  board.add(trace(rectSpiral(0, 2.9, 1.75, 1.75, 8, 0.08), Y, 0.04, 0.025, cu));       // NFC antenna
  board.add(ic(M, 0.75, 0.75, 0.1, 0.1, Y, -0.15));                                     // BLE SoC
  board.add(ic(M, 0.42, 0.42, 0.09, -0.95, Y, -0.55));                                  // analogue front end
  board.add(ic(M, 0.34, 0.34, 0.08, 0.95, Y, 0.85));                                    // NFC IC
  board.add(ic(M, 0.26, 0.26, 0.07, -1.1, Y, 0.75)); board.add(ic(M, 0.26, 0.26, 0.07, 0.45, Y, 0.95));
  board.add(box(0.62, 0.06, 0.16, std(COL.white), 0.95, Y, -0.9));                      // BLE chip antenna
  board.add(box(0.34, 0.12, 0.95, std(0xe8e8e0), -1.38, Y, 0.1));                       // connector
  [[-0.7, 0.2], [0.5, -0.95], [-0.25, 0.75], [1.2, 0.15], [-0.5, -1.0], [0.75, 0.4]].forEach(([x, z], i) =>
    board.add(box(i % 2 ? 0.16 : 0.2, 0.06, 0.1, std(i % 2 ? COL.ceramic : 0x2c2f36), x, Y, z)));
  board.add(trace([[0.1, -0.15], [0.1, 0.5], [0.95, 0.5], [0.95, 0.85]], Y, 0.03, 0.02, cu));
  board.add(trace([[-0.95, -0.55], [-0.2, -0.55]], Y, 0.03, 0.02, cu));
  board.add(trace([[0.0, -0.5], [0.0, -1.3], [0.0, -2.3]], Y, 0.03, 0.02, cu));
  board.add(trace([[0.0, 1.3], [0.0, 2.0]], Y, 0.03, 0.02, cu));
  const pdmsBot = plate(roundPoly(Lbig, 0.3), 0.1, glass(COL.pdms, 0.3)); g.add(pdmsBot);
  const pdmsTop = plate(roundPoly(Lbig, 0.3), 0.1, glass(COL.pdms, 0.2)); g.add(pdmsTop);

  // passive LC sensor hovering over the reader coil: 2 cm coil on FR-4 with a chip capacitor, wired to a stretchable strain sensor
  const hy = 2.1, hz = -3.0;
  const sens = new THREE.Group(); sens.position.set(0, hy, hz); g.add(sens);
  sens.add(plate(circleShape(1.15), 0.1, std(COL.fr4, { roughness: 0.7 }), 0.01));
  sens.add(trace(roundSpiral(0, 0, 1.02, 0.42, 6), 0.11, 0.045, 0.025, cu));
  sens.add(box(0.2, 0.08, 0.12, std(COL.ceramic), 0.38, 0.11, -0.02));
  const strip = new THREE.Group(); strip.position.set(1.9, hy, hz); g.add(strip);
  const sw = 2.9;
  strip.add(plate(roundPoly(rectPts(sw / 2, 0, sw, 1.05), 0.2), 0.12, std(0x8fcdb6, { roughness: 0.35 }), 0.02));
  const serp = (z0, ph) => { const p = []; const K = 9; for (let i = 0; i <= K * 2; i++) p.push([0.25 + (i / (K * 2)) * (sw - 0.5), z0 + (i % 2 ? 0.2 : -0.2) * ph]); return p; };
  strip.add(trace(serp(-0.12, 1), 0.13, 0.05, 0.025, cu));
  strip.add(trace(serp(0.12, -1), 0.13, 0.05, 0.025, cu));
  g.add(trace([[1.0, hz + 0.2], [1.9, hz + 0.2]], hy + 0.1, 0.035, 0.02, cu));
  g.add(trace([[0.9, hz - 0.3], [1.9, hz - 0.3]], hy + 0.1, 0.035, 0.02, cu));

  // coupling pulses between the reader coil and the sensor coil
  const fwd = [], back = [];
  const ringGeo = new THREE.TorusGeometry(1, 0.025, 8, 48);
  for (let i = 0; i < 5; i++) {
    [[fwd, COL.blue], [back, COL.amber]].forEach(([arr, c]) => {
      const m = new THREE.Mesh(ringGeo, basic(c, { transparent: true, opacity: 0, depthWrite: false })); m.rotation.x = Math.PI / 2; m.frustumCulled = false; g.add(m); arr.push(m);
    });
  }
  // resonance plot (reflection dips shifting with strain), as in figure 1b
  const scr = new THREE.Group(); scr.position.set(4.7, 1.9, 1.3); scr.rotation.y = -0.55; g.add(scr);
  const panel = plateUp(roundPoly(rectPts(0, 0, 4.2, 2.4), 0.15), 0.06, std(COL.panel, { roughness: 0.6 })); panel.position.z = -0.03; scr.add(panel);
  const ghost = [0.28, 0.5, 0.72].map((f0, i) => { const l = linePlot(scr, 90, [COL.rose, COL.blue, 0xcfd6e2][i]); l.position.z = 0.04; l.material.transparent = true; l.material.opacity = 0.4; return { l, f0 }; });
  const live = linePlot(scr, 90, COL.mint); live.position.z = 0.05;
  const axis = linePlot(scr, 2, 0x5a6475); axis.position.z = 0.04; setLine(axis, (u) => [lerp(-1.8, 1.8, u), -0.9]);
  const dip = (u, f0, w, depth) => { const x = (u - f0) / w; return 1 - depth / (1 + x * x); };
  const mark = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), basic(0xffffff)); mark.position.z = 0.06; scr.add(mark);

  return {
    group: g, cam: { az: -0.5, el: 0.55, r: 7.4, target: [1.7, 0.9, -0.2] }, floor: -0.8, still: 0.9,
    update(t) {
      const e = sstep(0.05, 0.95, 0.5 - 0.5 * Math.cos(t * 0.5));
      pdmsBot.position.y = -0.16 - e * 0.6; pdmsTop.position.y = 0.24 + e * 1.0;
      const s = 0.5 + 0.5 * Math.sin(t * 0.9);          // strain 0..1
      strip.scale.x = 1 + 0.25 * s;
      for (let i = 0; i < 5; i++) {
        const p = fract(t * 0.45 + i / 5), q = fract(t * 0.45 + i / 5 + 0.5);
        fwd[i].position.set(0, 0.45 + p * (hy - 0.55), hz); fwd[i].scale.setScalar(lerp(0.5, 1.05, p)); fwd[i].material.opacity = 0.75 * Math.sin(Math.PI * p);
        back[i].position.set(0, hy - 0.1 - q * (hy - 0.55), hz); back[i].scale.setScalar(lerp(1.0, 0.5, q)); back[i].material.opacity = 0.5 * Math.sin(Math.PI * q);
      }
      const f0 = 0.55 + 0.09 * Math.sin(t * 0.9 - 0.4);
      ghost.forEach(({ l, f0: f }) => setLine(l, (u) => [lerp(-1.8, 1.8, u), -0.9 + dip(u, f, 0.045, 0.6) * 1.6]));
      setLine(live, (u) => [lerp(-1.8, 1.8, u), -0.9 + dip(u, f0, 0.045, 0.7) * 1.6]);
      mark.position.set(lerp(-1.8, 1.8, f0), -0.9 + 0.3 * 1.6, 0.06);
    }
  };
}

/* ====================================================================== */
/*  2. Wi-Fi energy-harvesting patch: glucose, temperature, HRV            */
/*     Paper figure 1: round FPCB, PPG module, temperature sensor, glucose */
/*     sensor stack (adhesive / microfluidic / insulation / PET), separate */
/*     RF harvester board with antenna, Wi-Fi router.                       */
/* ====================================================================== */
function buildWifi() {
  const g = new THREE.Group(), M = { chip: std(COL.chip, { roughness: 0.4 }), silver: std(COL.silver, { metalness: 0.7, roughness: 0.3 }) };
  const pi = std(COL.pi, { roughness: 0.45 }), cu = std(COL.cu, { metalness: 0.5, roughness: 0.35 });
  // skin
  const skin = plate(roundPoly(rectPts(-1.8, 0.2, 8.6, 4.8), 0.5), 0.3, std(0xd99b80, { roughness: 0.85 }), 0.04); skin.position.y = -0.3; g.add(skin);
  // round board
  const board = new THREE.Group(); g.add(board);
  board.add(plate(circleShape(2.0), 0.06, pi));
  board.add(plate(roundPoly(rectPts(0.55, 2.45, 0.55, 1.0), 0.15), 0.06, pi));
  const Y = 0.07;
  board.add(ic(M, 0.78, 0.78, 0.1, -0.55, Y, 0.1));
  board.add(ic(M, 0.5, 0.5, 0.09, 0.55, Y, 0.55));
  board.add(ic(M, 0.42, 0.42, 0.08, 0.7, Y, -0.35));
  board.add(ic(M, 0.26, 0.26, 0.07, -0.6, Y, 1.05));
  board.add(ic(M, 0.26, 0.26, 0.07, 0.15, Y, 1.1));
  board.add(box(0.7, 0.06, 0.15, std(COL.white), 0.0, Y, -1.5));
  for (let i = 0; i < 12; i++) { const a = hash(i) * TAU, r = 0.5 + hash(i + 9) * 1.2; board.add(box(0.17, 0.06, 0.1, std(i % 3 ? 0x2c2f36 : COL.ceramic), Math.cos(a) * r, Y, Math.sin(a) * r)); }
  [[[-0.55, 0.1], [-0.55, -0.9], [0.0, -1.3]], [[0.55, 0.55], [0.55, -0.35]], [[-0.55, 0.1], [0.0, 0.55], [0.55, 0.55]], [[0.7, -0.35], [1.2, -0.9]], [[-0.6, 1.05], [-1.3, 0.6], [-1.7, 0.2]], [[0.15, 1.1], [0.55, 1.6], [0.55, 2.2]]]
    .forEach((p) => board.add(trace(p, Y, 0.032, 0.02, cu)));
  // coin cell battery
  const bat = new THREE.Group(); bat.position.set(-0.85, Y, -0.85); board.add(bat);
  bat.add(cyl(0.5, 0.5, 0.16, std(COL.silver, { metalness: 0.8, roughness: 0.28 }), 0, 0, 0, 40));
  bat.add(cyl(0.34, 0.34, 0.02, std(0x8c93a0, { metalness: 0.8, roughness: 0.4 }), 0, 0.16, 0, 32));
  // PPG module with red and NIR LEDs
  const ppg = new THREE.Group(); ppg.position.set(1.0, Y, -1.0); board.add(ppg);
  ppg.add(box(0.62, 0.15, 0.4, std(0xb62f2a, { roughness: 0.5 }), 0, 0, 0));
  const ledR = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), std(0xff3b30, { emissive: 0xff2a1f, emissiveIntensity: 1 })); ledR.position.set(-0.12, 0.17, 0); ppg.add(ledR);
  const ledN = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), std(0xb07bff, { emissive: 0x8a4dff, emissiveIntensity: 1 })); ledN.position.set(0.12, 0.17, 0); ppg.add(ledN);
  // temperature sensor on the tail
  board.add(box(0.3, 0.12, 0.2, std(0x2f58c8, { roughness: 0.4 }), 0.55, Y, 2.55));
  // flat cable to the glucose sensor
  const cable = plate(roundPoly(rectPts(-3.0, 0.2, 2.3, 0.55), 0.04), 0.03, glass(COL.pet, 0.5)); g.add(cable);
  [-0.14, 0, 0.14].forEach((dz) => g.add(trace([[-2.0, 0.2 + dz], [-4.0, 0.2 + dz]], 0.04, 0.04, 0.015, cu)));

  // glucose sensor stack, exploded view from figure 1b
  const sx = -4.7, sz = 0.2, stack = new THREE.Group(); stack.position.set(sx, 0, sz); g.add(stack);
  const layers = [];
  const addLayer = (mesh, base) => { stack.add(mesh); layers.push({ mesh, base }); return mesh; };
  const sqShape = (holes = []) => { const sh = roundPoly(rectPts(0, 0, 2.0, 2.0), 0.14); holes.forEach((h) => sh.holes.push(new THREE.Path(h.map(([x, z]) => new THREE.Vector2(x, -z))))); return sh; };
  const inlets = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6];
  const inletPos = inlets.map((a) => [Math.cos(a) * 0.72, Math.sin(a) * 0.72]);
  const hole = (x, z, r) => { const p = []; for (let i = 0; i < 14; i++) p.push([x + Math.cos((i / 14) * TAU) * r, z + Math.sin((i / 14) * TAU) * r]); return p; };
  addLayer(plate(sqShape(inletPos.map(([x, z]) => hole(x, z, 0.09))), 0.05, std(0xd34b44, { roughness: 0.5 })), 0);
  addLayer(plate(sqShape([starHole(0.3, 0.74, 0.07, inlets)]), 0.05, std(0xe6c35a, { roughness: 0.45 })), 1);
  addLayer(plate(sqShape([hole(0, 0, 0.26)]), 0.04, glass(0x8fd0ff, 0.5)), 2);
  const pet = addLayer(plate(sqShape(), 0.035, glass(COL.pet, 0.28)), 3);
  const elecMat = std(0x222a33, { roughness: 0.4 });
  pet.add(place(cyl(0.22, 0.22, 0.02, elecMat, 0, 0.03, 0, 28), 0, 0, 0));
  pet.add(cyl(0.1, 0.1, 0.02, std(COL.silver, { metalness: 0.8 }), 0.45, 0.03, 0.25, 20));
  const arc = []; for (let i = 0; i <= 20; i++) { const a = 0.7 + (i / 20) * 1.6; arc.push([-Math.cos(a) * 0.42, Math.sin(a) * 0.42]); }
  pet.add(trace(arc, 0.03, 0.07, 0.02, std(COL.gold, { metalness: 0.6 })));
  pet.add(trace([[0.22, 0], [1.0, 0]], 0.03, 0.04, 0.02, cu)); pet.add(trace([[0.45, 0.25], [1.0, 0.25]], 0.03, 0.04, 0.02, cu));
  // sweat pores in the skin and droplets
  const pores = inletPos.map(([x, z]) => { const m = cyl(0.12, 0.12, 0.02, std(0x9c5f50), sx + x, 0.0, sz + z, 16); g.add(m); return m; });
  const sweat = makeDots(g, 18, basic(COL.sweat));

  // RF harvester board with an F-shaped antenna and the router
  const rf = new THREE.Group(); rf.position.set(3.9, 0, 1.1); g.add(rf);
  rf.add(plate(roundPoly(rectPts(0, 0, 2.0, 1.7), 0.12), 0.05, std(COL.green, { roughness: 0.5 })));
  rf.add(trace([[-0.75, 0.6], [-0.75, -0.6]], 0.06, 0.1, 0.025, cu)); rf.add(trace([[-0.75, -0.6], [-0.2, -0.6]], 0.06, 0.1, 0.025, cu)); rf.add(trace([[-0.75, -0.05], [-0.3, -0.05]], 0.06, 0.1, 0.025, cu));
  rf.add(ic(M, 0.32, 0.32, 0.08, 0.45, 0.06, 0.15)); rf.add(ic(M, 0.22, 0.22, 0.07, 0.15, 0.06, 0.5)); rf.add(box(0.16, 0.06, 0.1, std(COL.ceramic), 0.7, 0.06, -0.4));
  const harvestPath = new THREE.CatmullRomCurve3([V(3.3, 0.2, 1.0), V(2.6, 0.4, 0.3), V(1.4, 0.3, -0.1), V(0.3, 0.25, -0.2), V(-0.6, 0.25, -0.6), V(-0.85, 0.3, -0.85)]);
  g.add(new THREE.Mesh(new THREE.TubeGeometry(harvestPath, 40, 0.025, 6), std(0x20242b)));
  const sparks = makeDots(g, 9, basic(0xffd25a));
  const router = new THREE.Group(); router.position.set(6.0, 0, -2.2); router.rotation.y = -0.6; g.add(router);
  router.add(box(1.5, 0.28, 0.9, std(0x20242c, { roughness: 0.4 }), 0, 0, 0));
  router.add(box(1.3, 0.02, 0.7, std(0x2f3541), 0, 0.28, 0));
  [-0.5, 0.5].forEach((x) => { router.add(cyl(0.05, 0.05, 1.1, std(0x20242c), x, 0.28, -0.3, 10)); });
  [0, 1, 2].forEach((i) => router.add(cyl(0.035, 0.035, 0.015, basic(i === 1 ? 0x45c08e : 0x4f7cff), -0.4 + i * 0.1, 0.285, 0.3, 10)));
  const wifi = makeWaves(g, COL.blue, 5, 0.25, 1.1, 0.06);
  wifi.position.set(5.3, 1.1, -1.7);
  const aim = V(3.5, 0.3, 1.1); wifi.lookAt(aim);
  const waveLen = wifi.position.distanceTo(aim);
  const ble = makeWaves(g, COL.mint, 3, 0.2, 1.3, 0.06); ble.rotation.x = -Math.PI / 2; ble.position.set(0, 0.15, -1.5);

  return {
    group: g, cam: { az: -0.4, el: 0.55, r: 8.6, target: [-0.2, 0.2, 0.1] }, floor: -0.33, still: 3.2,
    update(t) {
      const e = sstep(0.05, 0.95, 0.5 - 0.5 * Math.cos(t * 0.45));
      const gap = 0.07 + 0.4 * e;
      layers.forEach((l) => { l.mesh.position.y = 0.04 + l.base * gap; });
      const pulse = Math.pow(Math.max(0, Math.sin(t * 6.5)), 6);
      ledR.material.emissiveIntensity = 0.35 + 1.4 * pulse; ledN.material.emissiveIntensity = 0.3 + 1.2 * pulse;
      wifi.update(t, 0.3, 0.75, waveLen * 0.85);
      ble.update(t + 0.3, 0.28, 0.55, 2.2);
      // sweat rises through the inlets and along the channels into the sensing chamber
      const yCh = 0.04 + gap * 1.0 + 0.05, yIn = -0.1;
      for (let i = 0; i < 18; i++) {
        const k = i % 3, p = fract(t * 0.16 + i / 18 * 1.0 + k * 0.11);
        const [ix, iz] = inletPos[k];
        let x, y, z;
        if (p < 0.4) { const q = p / 0.4; x = ix; z = iz; y = lerp(yIn, yCh, q); }
        else { const q = (p - 0.4) / 0.6; x = lerp(ix, 0, q); z = lerp(iz, 0, q); y = yCh; }
        sweat.set(i, V(sx + x, y, sz + z), 0.055 * (p > 0.96 ? 0.2 : 1), COL.sweat);
      }
      sweat.commit();
      for (let i = 0; i < 9; i++) { const p = fract(t * 0.3 + i / 9); sparks.set(i, harvestPath.getPoint(p), 0.06 * Math.sin(Math.PI * p) + 0.02, 0xffd25a); }
      sparks.commit();
    }
  };
}

/* ====================================================================== */
/*  3. Touch-activated hollow-microneedle patch for dermal ISF             */
/*     Paper figure 1: finger-pressed PDMS vacuum chamber with check valves, */
/*     ISF extraction chamber over a 5 x 5 laser-drilled HMN patch,          */
/*     screen-printed electrodes, flat cable.                                */
/* ====================================================================== */
function buildNeedle() {
  const g = new THREE.Group();
  const cx = 1.3;
  // skin: epidermis and dermis, translucent so the needles show
  const skinG = new THREE.Group(); g.add(skinG);
  const epi = plate(roundPoly(rectPts(cx, 0, 4.8, 4.2), 0.3), 0.4, glass(0xe9bfa4, 0.6, { roughness: 0.6 })); epi.position.y = -0.4; skinG.add(epi);
  const derm = plate(roundPoly(rectPts(cx, 0, 4.8, 4.2), 0.3), 1.6, glass(0xd98a82, 0.42, { roughness: 0.6 })); derm.position.y = -2.0; skinG.add(derm);
  const vessel = (pts, r) => { const c = new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => V(x, y, z))); const m = new THREE.Mesh(new THREE.TubeGeometry(c, 40, r, 8), std(0xb9302c, { transparent: true, opacity: 0.75 })); skinG.add(m); return c; };
  vessel([[cx - 2.3, -1.6, -1.2], [cx - 1, -1.45, -0.7], [cx + 0.4, -1.6, -1.0], [cx + 1.8, -1.45, -0.6], [cx + 2.4, -1.6, -0.9]], 0.07);
  vessel([[cx - 2.3, -1.4, 1.2], [cx - 0.8, -1.2, 0.9], [cx + 0.5, -1.4, 1.2], [cx + 2.4, -1.2, 0.9]], 0.06);
  // HMN patch: adhesive frame and 25 hollow needles (5 x 5)
  g.add(place(plate(roundPoly(rectPts(cx, 0, 3.2, 3.2), 0.2), 0.05, std(0xeedc9c, { roughness: 0.6 })), 0, 0, 0));
  const needleGeo = new THREE.CylinderGeometry(0.075, 0.016, 0.95, 14, 1, true);
  const needles = new THREE.InstancedMesh(needleGeo, new THREE.MeshStandardMaterial({ color: 0xb7c0cc, metalness: 0.4, roughness: 0.35, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }), 25);
  const mm = new THREE.Matrix4(), needleXZ = [];
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) { const x = cx + (i - 2) * 0.42, z = (j - 2) * 0.42; needleXZ.push([x, z]); mm.setPosition(x, -0.43, z); needles.setMatrixAt(i * 5 + j, mm); }
  g.add(needles);
  // electrode layer, microfluidic layer, chamber, PET cap
  g.add(place(plate(roundPoly(rectPts(cx, 0, 2.2, 2.2), 0.15), 0.04, std(0xdfe3e8, { roughness: 0.5 })), 0, 0.07, 0));
  [[-0.25, -0.2], [0.25, 0.2], [0, 0]].forEach(([dx, dz], i) => g.add(cyl(0.14, 0.14, 0.02, std(i === 2 ? COL.silver : 0x1e2328, { metalness: i === 2 ? 0.7 : 0 }), cx + dx, 0.11, dz, 20)));
  [-0.45, -0.15, 0.15, 0.45].forEach((dz) => g.add(trace([[cx + 0.1, dz * 0.5], [cx + 1.1, dz], [cx + 2.6, dz]], 0.11, 0.045, 0.015, std(0x1b1f25))));
  const micro = plate(roundPoly(rectPts(cx, 0, 2.2, 2.2), 0.15), 0.12, glass(0x7ab8ff, 0.38)); micro.position.y = 0.15; g.add(micro);
  const fill = plate(roundPoly(rectPts(cx, 0, 1.7, 1.7), 0.1), 0.1, basic(COL.sweat, { transparent: true, opacity: 0 })); fill.position.y = 0.16; g.add(fill);
  const cap = plate(roundPoly(rectPts(cx, 0, 2.4, 2.4), 0.2), 0.4, glass(COL.pet, 0.2)); cap.position.y = 0.28; g.add(cap);
  const cable = plate(roundPoly(rectPts(cx + 2.5, 0, 1.6, 0.7), 0.05), 0.03, glass(COL.pet, 0.55)); cable.position.y = 0.11; g.add(cable);
  // channel to the vacuum chamber with two passive check valves
  const chan = box(2.4, 0.2, 0.3, glass(0x7ab8ff, 0.45), -1.15, 0.15, 0); g.add(chan);
  const cv1 = cyl(0.12, 0.12, 0.14, std(0xf0a640, { emissive: 0xf0a640, emissiveIntensity: 0 }), -1.85, 0.34, 0, 18);
  const cv2 = cyl(0.12, 0.12, 0.14, std(COL.mint, { emissive: COL.mint, emissiveIntensity: 0 }), -0.7, 0.34, 0, 18);
  g.add(cv1, cv2);
  // PDMS vacuum chamber (dome) and the finger that presses it
  const dome = new THREE.Group(); dome.position.set(-3.4, 0.1, 0); g.add(dome);
  dome.add(place(plate(roundPoly(rectPts(0, 0, 3.0, 2.3), 0.35), 0.1, glass(0x6fa8ff, 0.45)), 0, 0, 0));
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 20, 0, TAU, 0, Math.PI / 2), glass(0x5f9bff, 0.38)); shell.scale.set(1.3, 0.7, 0.95); shell.position.y = 0.1; dome.add(shell);
  const inner = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 14, 0, TAU, 0, Math.PI / 2), basic(0x57d6a8, { transparent: true, opacity: 0.22 })); inner.scale.set(1.15, 0.6, 0.8); inner.position.y = 0.12; dome.add(inner);
  const finger = new THREE.Group(); g.add(finger);
  const fm = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 2.0, 8, 20), std(0xe9b9a0, { roughness: 0.7 })); fm.castShadow = true; fm.position.y = 1.4; finger.add(fm);
  const nail = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), std(0xf1d5c6, { roughness: 0.4 })); nail.scale.set(1, 0.4, 1.2); nail.position.set(0, 0.5, -0.28); finger.add(nail);
  finger.rotation.x = -0.45; finger.position.x = -3.4;
  // particles: glucose (red), H+ (yellow) drifting in the tissue, and ISF (blue) pulled up the needles
  const tissue = makeDots(g, 46, basic(0xffffff));
  const isf = makeDots(g, 25, basic(COL.sweat));
  const seed = [...Array(46)].map((_, i) => [hash(i) * 4.4 - 2.2 + cx, -0.5 - hash(i + 7) * 1.4, (hash(i + 3) - 0.5) * 3.6, hash(i + 11) * TAU]);

  return {
    group: g, cam: { az: -0.5, el: 0.5, r: 6.9, target: [-0.9, 0.2, 0] }, floor: -2.1, still: 4.2,
    update(t) {
      const T = 8, k = t % T;
      const press = sstep(0.4, 1.4, k) * (1 - sstep(1.9, 2.9, k));
      const vac = sstep(1.9, 3.1, k) * (1 - 0.5 * sstep(3.5, 7.2, k));
      finger.position.y = lerp(1.9, 0.5, press);
      shell.scale.y = lerp(0.7, 0.22, press); inner.scale.y = shell.scale.y * 0.86;
      shell.scale.x = 1.3 + 0.12 * press; shell.scale.z = 0.95 + 0.08 * press;
      cv1.material.emissiveIntensity = 1.4 * press; cv2.material.emissiveIntensity = 1.4 * vac;
      const fade = 1 - sstep(7.0, 7.9, k);
      const arrived = clamp((k - 3.0) / 3.0);
      fill.material.opacity = 0.5 * arrived * fade;
      for (let i = 0; i < 46; i++) {
        const [x, y, z, ph] = seed[i];
        tissue.set(i, V(x + Math.sin(t * 0.7 + ph) * 0.12, y + Math.cos(t * 0.6 + ph * 2) * 0.1, z + Math.sin(t * 0.5 + ph * 3) * 0.12), 0.05, i % 2 ? 0xdc4a42 : 0xf3c64a);
      }
      tissue.commit();
      for (let i = 0; i < 25; i++) {
        const [nx, nz] = needleXZ[i];
        const q = clamp((k - 2.4 - hash(i) * 1.6) / 1.8) * (k < 7 ? 1 : 0);
        const y = lerp(-1.1, 0.18, sstep(0, 1, q));
        const sc = q <= 0 || fade <= 0.01 ? 0 : 0.06;
        const spread = sstep(0.85, 1, q);
        isf.set(i, V(nx + (hash(i + 20) - 0.5) * 0.35 * spread, y + Math.sin(t * 2 + i) * 0.015 * spread, nz + (hash(i + 40) - 0.5) * 0.35 * spread), sc * fade, COL.sweat);
      }
      isf.commit();
    }
  };
}

/* ====================================================================== */
/*  4. Battery-free sweat glucose tag                                      */
/*     Paper scheme 1b: antenna, PCB layer, tape, PET (electrodes), tape    */
/*     (channels), PET, tape (inlets): seven layers.                         */
/* ====================================================================== */
function buildTag() {
  const g = new THREE.Group(), M = { chip: std(COL.chip, { roughness: 0.4 }), silver: std(COL.silver, { metalness: 0.7, roughness: 0.3 }) };
  const cu = std(COL.cu, { metalness: 0.5, roughness: 0.35 }), pi = std(COL.pi, { roughness: 0.45 });
  const R = 1.35;
  const angs = [Math.PI / 2, (7 * Math.PI) / 6, (11 * Math.PI) / 6];
  const inl = angs.map((a) => [Math.cos(a) * 0.8, -Math.sin(a) * 0.8]);   // x, z of the inlets
  const hole = (x, z, r) => { const p = []; for (let i = 0; i < 14; i++) p.push([x + Math.cos((i / 14) * TAU) * r, z + Math.sin((i / 14) * TAU) * r]); return p; };
  const layers = [];
  const add = (mesh) => { g.add(mesh); layers.push(mesh); return mesh; };
  const tapeMat = () => std(COL.tapeGrey, { roughness: 0.7 });
  // bottom (skin side) to top
  add(plate(circleShape(R, inl.map(([x, z]) => hole(x, z, 0.1))), 0.04, tapeMat()));              // 7 tape with inlets
  add(plate(circleShape(R), 0.03, glass(COL.pet, 0.3)));                                           // 6 PET
  const chanAngles = angs.map((a) => a);
  const star = starHole(0.34, 0.82, 0.075, chanAngles).map(([x, z]) => [x, -z]);
  add(plate(circleShape(R, [star]), 0.04, std(0xbfc3ca, { roughness: 0.7 })));                      // 5 tape with channels
  const petE = add(plate(circleShape(R), 0.03, glass(COL.pet, 0.3)));                              // 4 PET with electrodes
  petE.add(cyl(0.2, 0.2, 0.012, std(0x20262e), 0, 0.04, 0, 28));
  petE.add(cyl(0.1, 0.1, 0.012, std(COL.silver, { metalness: 0.8 }), 0.42, 0.04, -0.2, 20));
  const arc = []; for (let i = 0; i <= 18; i++) { const a = 2.2 + (i / 18) * 1.7; arc.push([Math.cos(a) * 0.4, Math.sin(a) * 0.4]); }
  petE.add(trace(arc, 0.04, 0.06, 0.012, std(COL.gold, { metalness: 0.6 })));
  petE.add(trace([[0.2, 0], [1.2, 0.0]], 0.04, 0.04, 0.012, cu)); petE.add(trace([[0.42, -0.2], [1.2, -0.2]], 0.04, 0.04, 0.012, cu)); petE.add(trace([[-0.4, 0.05], [-0.9, 0.5], [1.2, 0.5]], 0.04, 0.04, 0.012, cu));
  add(plate(circleShape(R, [hole(0, 0, 0.42)]), 0.04, std(COL.tape, { roughness: 0.7 })));          // 3 tape
  const pcb = add(plate(circleShape(R - 0.02), 0.05, pi));                                          // 2 PCB layer
  pcb.add(ic(M, 0.4, 0.4, 0.09, 0.45, 0.06, 0.38));
  [[-0.5, 0.5], [-0.2, 0.7], [0.1, -0.6], [-0.6, -0.4]].forEach(([x, z], i) => pcb.add(box(0.16, 0.05, 0.1, std(i % 2 ? COL.ceramic : 0x2c2f36), x, 0.06, z)));
  pcb.add(trace([[0.45, 0.38], [0.0, 0.0], [-0.5, -0.4]], 0.06, 0.03, 0.02, cu));
  const ant = add(plate(ringShape(R, 0.62), 0.04, pi));                                             // 1 antenna
  ant.add(trace(roundSpiral(0, 0, 1.28, 0.7, 8, 40), 0.05, 0.04, 0.025, cu));
  const waves = makeWaves(g, COL.blue, 4, 0.5, 2.2, 0.04); waves.rotation.x = -Math.PI / 2;
  const sweat = makeDots(g, 21, basic(COL.sweat));
  const chamberGlow = new THREE.Mesh(new THREE.CircleGeometry(0.3, 28), basic(COL.sweat, { transparent: true, opacity: 0, side: THREE.DoubleSide })); chamberGlow.rotation.x = -Math.PI / 2; g.add(chamberGlow);

  return {
    group: g, cam: { az: -0.5, el: 0.62, r: 4.5, target: [0, 1.1, 0] }, floor: -0.3, still: 4.2,
    update(t) {
      const e = sstep(0.05, 0.95, 0.5 - 0.5 * Math.cos(t * 0.5));
      const step = 0.09 + 0.5 * e;
      layers.forEach((m, i) => { m.position.y = i * step; });
      const yCh = 2 * step + 0.02, yIn = -0.35;
      let arrived = 0;
      for (let i = 0; i < 21; i++) {
        const k = i % 3, p = fract(t * 0.2 + (i / 21) * 1.0 + k * 0.07);
        const [ix, iz] = inl[k];
        let x, y, z;
        if (p < 0.4) { const q = p / 0.4; x = ix; z = iz; y = lerp(yIn, yCh, q); }
        else { const q = (p - 0.4) / 0.6; x = lerp(ix, 0, q); z = lerp(iz, 0, q); y = yCh; if (q > 0.9) arrived++; }
        sweat.set(i, V(x, y, z), 0.06 * (p > 0.97 ? 0.2 : 1), COL.sweat);
      }
      sweat.commit();
      chamberGlow.position.y = yCh + 0.02; chamberGlow.material.opacity = Math.min(0.7, 0.1 + arrived * 0.12);
      waves.position.y = 4 * step + 0.12; waves.update(t, 0.3, 0.6, 1.6);
    }
  };
}

/* ====================================================================== */
/*  5. Femtosecond-laser NFC antenna for smart contact lenses              */
/*     Paper figure 1: laser engraves the spiral antenna in the copper      */
/*     layer; the lens is PDMS / antenna film with NFC chip and glucose      */
/*     sensor / PDMS.                                                        */
/* ====================================================================== */
function buildLens() {
  const g = new THREE.Group();
  const cu = std(COL.cu, { metalness: 0.5, roughness: 0.3 });
  const R = 2.3, TH = 0.95;
  const cap = (rad, op, color = COL.pdms) => { const m = new THREE.Mesh(new THREE.SphereGeometry(rad, 72, 28, 0, TAU, 0, TH), glass(color, op)); return m; };
  const topShell = new THREE.Group(); topShell.add(cap(R, 0.3), cap(R - 0.12, 0.2)); g.add(topShell);
  const botShell = new THREE.Group(); botShell.add(cap(R - 0.3, 0.28), cap(R - 0.42, 0.18)); g.add(botShell);
  const rho = R - 0.2;
  const sph = (th, ph, r = rho) => V(r * Math.sin(th) * Math.cos(ph), r * Math.cos(th), r * Math.sin(th) * Math.sin(ph));
  // film under the antenna
  const filmGeo = new THREE.SphereGeometry(rho - 0.01, 72, 20, 0, TAU, 0.44, 0.45);
  const film = new THREE.Mesh(filmGeo, glass(COL.pi, 0.4)); g.add(film);
  // spiral antenna on the sphere
  const K = 420, pts = [], nrm = [];
  for (let i = 0; i <= K; i++) { const u = i / K, th = lerp(0.47, 0.75, u), ph = u * TAU * 5; const p = sph(th, ph, rho + 0.015); pts.push(p); nrm.push(p.clone()); }
  const antGeo = traceGeo(pts, 0.032, 0.03, nrm);
  const antenna = new THREE.Mesh(antGeo, cu); antenna.castShadow = true; g.add(antenna);
  const idxCount = antGeo.index ? antGeo.index.count : antGeo.attributes.position.count;
  // NFC chip and glucose sensor
  const chip = box(0.4, 0.1, 0.3, std(COL.chip, { roughness: 0.4 }), 0, 0, 0);
  { const p = sph(0.84, 0.6, rho + 0.02); chip.position.copy(p); chip.quaternion.setFromUnitVectors(V(0, 1, 0), p.clone().normalize()); chip.castShadow = true; g.add(chip); }
  const sens = []; for (let i = 0; i <= 40; i++) sens.push(sph(lerp(0.74, 0.14, i / 40), 4.3, rho + 0.02));
  g.add(new THREE.Mesh(traceGeo(sens, 0.07, 0.03, sens.map((p) => p.clone())), std(COL.gold, { metalness: 0.6, roughness: 0.3 })));
  [[0.14, 4.3, COL.red, 0.13], [0.3, 4.3, COL.silver, 0.08]].forEach(([th, ph, c, r]) => {
    const p = sph(th, ph, rho + 0.03); const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.03, 24), std(c, { metalness: 0.4 }));
    m.position.copy(p); m.quaternion.setFromUnitVectors(V(0, 1, 0), p.clone().normalize()); g.add(m);
  });
  // laser: objective, beam and spot
  const obj = new THREE.Group(); obj.position.set(0, 3.9, 0); g.add(obj);
  obj.add(cyl(0.3, 0.3, 0.7, std(0x39414d, { metalness: 0.5, roughness: 0.4 }), 0, 0, 0));
  obj.add(cyl(0.12, 0.3, 0.3, std(0x20252d, { metalness: 0.5 }), 0, -0.3, 0));
  const beamM = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 8), basic(0xff4d5e, { transparent: true, opacity: 0.8 })); beamM.frustumCulled = false; g.add(beamM);
  const spot = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), basic(0xffeab0)); g.add(spot);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), basic(0xff6b7a, { transparent: true, opacity: 0.35, depthWrite: false })); g.add(halo);
  const waves = makeWaves(g, COL.blue, 4, 0.5, 2.3, 0.04); waves.rotation.x = -Math.PI / 2;
  const dst = V(0, 0, 0), srcTop = V(0, 3.6, 0);

  return {
    group: g, cam: { az: -0.55, el: 0.45, r: 3.7, target: [0, 1.8, 0] }, floor: 0.5, still: 9.5,
    update(t) {
      const T = 14, k = t % T;
      const draw = sstep(1.0, 6.2, k) * (1 - sstep(12.6, 13.4, k));
      const e = Math.max(1 - sstep(6.4, 8.8, k), sstep(12.6, 13.6, k));
      topShell.position.y = 0.85 * e; botShell.position.y = -0.55 * e;
      antenna.geometry.setDrawRange(0, Math.floor(draw * (idxCount / 36)) * 36);
      const head = clamp(draw);
      const lasing = k > 0.6 && k < 6.6;
      const i = Math.min(K, Math.floor(head * K));
      dst.copy(pts[i]);
      beamM.visible = spot.visible = halo.visible = lasing;
      obj.visible = k < 7.2;
      beam(beamM, srcTop, dst); spot.position.copy(dst); halo.position.copy(dst);
      halo.scale.setScalar(0.8 + 0.3 * Math.sin(t * 20));
      const on = sstep(8.6, 9.6, k) * (1 - sstep(12.4, 13.0, k));
      waves.position.y = R + 0.2; waves.visible = on > 0.01; waves.update(t, 0.3, 0.6 * on, 1.5);
    }
  };
}

/* ====================================================================== */
/*  6. Microfluidic testbed for molecular communication                     */
/*     Paper figure 1: PMMA with PTFE ports / double-sided tape with a       */
/*     hydrodynamic-gating cross, zigzag mixer and propagation channel /     */
/*     PET with screen-printed pH sensor (PANI working electrode); BLE board */
/*     and a live plot.                                                      */
/* ====================================================================== */
function buildTestbed() {
  const g = new THREE.Group(), M = { chip: std(COL.chip, { roughness: 0.4 }), silver: std(COL.silver, { metalness: 0.7, roughness: 0.3 }) };
  const cu = std(COL.cu, { metalness: 0.5, roughness: 0.35 });
  const L = 9.6, W = 2.7;
  const layers = [];
  const add = (m) => { g.add(m); layers.push(m); return m; };
  const J = [-3.3, 0];
  const mixer = [[-3.3, 0], [-2.95, 0.3], [-2.55, -0.3], [-2.15, 0.3], [-1.75, -0.3], [-1.4, 0]];
  const chPath = [...mixer, [4.0, 0]];
  const cw = 0.26;
  const pet = add(plate(roundPoly(rectPts(0, 0, L, W), 0.12), 0.04, glass(COL.pet, 0.35)));
  // screen-printed pH sensor: reference (silver), working (PANI) and counter (carbon) electrodes
  const exs = [[2.55, COL.silver, 0.17, true], [3.0, 0x1f3b2c, 0.17, false], [3.45, 0x181a1e, 0.17, false]];
  exs.forEach(([x, c, r, metal]) => pet.add(cyl(r, r, 0.012, std(c, { metalness: metal ? 0.8 : 0.1, roughness: 0.4 }), x, 0.05, 0, 24)));
  [[2.55, 0.0], [3.0, 0.0], [3.45, 0.0]].forEach(([x], i) => pet.add(trace([[x, 0.0], [x, 0.55 + i * 0.12], [4.3 + i * 0.12, 0.55 + i * 0.12]], 0.05, 0.05, 0.012, std(COL.gold, { metalness: 0.6 }))));
  const tape = add(plate(roundPoly(rectPts(0, 0, L, W), 0.12), 0.05, std(COL.tape, { roughness: 0.7 })));
  const dark = std(0x0e1a24, { roughness: 0.3 });
  const strip = (pts) => tape.add(trace(pts, 0.055, cw, 0.012, dark));
  strip([[-4.2, 0], [J[0], 0]]); strip(chPath); strip([[J[0], -1.0], [J[0], 1.0]]);
  const pmma = add(plate(roundPoly(rectPts(0, 0, L, W), 0.12), 0.35, glass(0xdff0ff, 0.2, { roughness: 0.05 }), 0.02));
  // PTFE tubes in the four ports
  const ports = [[J[0], -1.0, COL.teal], [J[0], 1.0, COL.rose], [-4.2, 0, 0xcfd6e2], [4.0, 0, 0xcfd6e2]];
  ports.forEach(([x, z, c]) => { pmma.add(cyl(0.16, 0.16, 0.9, glass(0xf2f5f8, 0.75), x, 0.05, z, 16)); pmma.add(cyl(0.09, 0.09, 0.91, basic(c, { transparent: true, opacity: 0.8 }), x, 0.05, z, 12)); });
  // BLE board and its link to the screen
  const board = new THREE.Group(); board.position.set(6.3, 0, 0.3); g.add(board);
  board.add(plate(roundPoly(rectPts(0, 0, 1.7, 1.2), 0.1), 0.05, std(COL.green, { roughness: 0.5 })));
  board.add(ic(M, 0.5, 0.5, 0.09, -0.3, 0.06, 0)); board.add(ic(M, 0.28, 0.28, 0.07, 0.35, 0.06, 0.25)); board.add(box(0.6, 0.05, 0.14, std(COL.white), 0.2, 0.06, -0.4));
  board.add(trace([[-0.3, 0], [-0.75, 0.3]], 0.06, 0.03, 0.015, cu));
  g.add(trace([[4.3, 0.6], [5.2, 0.6], [5.5, 0.4]], 0.09, 0.03, 0.02, cu));
  const ble = makeWaves(g, COL.blue, 3, 0.15, 0.9, 0.06); ble.position.set(6.3, 0.2, 0.3); ble.rotation.x = -Math.PI / 2;
  // laptop-style screen with the receiver output
  const scr = new THREE.Group(); scr.position.set(1.6, 1.9, -3.1); g.add(scr);
  const panel = plateUp(roundPoly(rectPts(0, 0, 4.8, 2.6), 0.15), 0.07, std(COL.panel, { roughness: 0.6 })); panel.position.z = -0.04; scr.add(panel);
  const base = box(5.0, 0.07, 1.0, std(0x1a1f27, { roughness: 0.5 }), 0, -1.9, 0.3); scr.add(base);
  const axisL = linePlot(scr, 2, 0x5a6475); axisL.position.z = 0.05; setLine(axisL, (u) => [lerp(-2.1, 2.1, u), -0.95]);
  const step = linePlot(scr, 160, COL.mint); step.position.z = 0.06;
  const mark = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), basic(0xffffff)); mark.position.z = 0.07; scr.add(mark);
  for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.07), basic(mixColor(i / 3))); m.position.set(-1.05 + i * 0.7, 1.05, 0.05); scr.add(m); }
  // fluid
  const gat = makeDots(g, 14, basic(COL.teal)), sup = makeDots(g, 14, basic(COL.rose)), prop = makeDots(g, 70, basic(0xffffff));
  const SEQ = [0, 2, 1, 3, 3, 1, 0, 2];
  const level = (te) => SEQ[((Math.floor(te / 1.6) % SEQ.length) + SEQ.length) % SEQ.length];
  const col = new THREE.Color(), cA = new THREE.Color(COL.teal), cB = new THREE.Color(COL.rose);
  function mixColor(f) { return new THREE.Color(COL.teal).lerp(new THREE.Color(COL.rose), f); }
  // propagation path length
  const segLen = []; let total = 0; for (let i = 1; i < chPath.length; i++) { const d = Math.hypot(chPath[i][0] - chPath[i - 1][0], chPath[i][1] - chPath[i - 1][1]); segLen.push(d); total += d; }
  const at = (s) => { s = clamp(s, 0, total); let i = 0; while (i < segLen.length - 1 && s > segLen[i]) { s -= segLen[i]; i++; } const f = s / segLen[i]; return [lerp(chPath[i][0], chPath[i + 1][0], f), lerp(chPath[i][1], chPath[i + 1][1], f)]; };
  const VP = 0.9;

  return {
    group: g, cam: { az: -0.38, el: 0.58, r: 6.9, target: [1.1, 0.7, -0.4] }, floor: -0.12, still: 7.5,
    update(t) {
      const e = sstep(0.05, 0.95, 0.5 - 0.5 * Math.cos(t * 0.4));
      pet.position.y = 0; tape.position.y = 0.06 + 0.05 + e * 0.35; pmma.position.y = 0.2 + 0.1 + e * 0.9;
      const yC = tape.position.y + 0.07;
      const lv = level(t), f = lv / 3;
      // gating flow comes in from the top, supply from the bottom; the supply either joins the
      // propagation channel (gating OFF) or leaves through outlet I on the left (gating ON)
      for (let i = 0; i < 14; i++) { const p = fract(t * 0.18 + i / 14); gat.set(i, V(J[0], yC, lerp(-1.0, 0, p)), p > 0.97 ? 0.0001 : 0.07, COL.teal); }
      for (let i = 0; i < 14; i++) {
        const cyc = t * 0.18 + i / 14, p = fract(cyc), n = Math.floor(cyc);
        const join = hash(n * 7 + i) < f;
        if (p < 0.5) sup.set(i, V(J[0], yC, lerp(1.0, 0, p / 0.5)), 0.07, COL.rose);
        else if (join) sup.set(i, V(J[0], yC, 0), 0.0001, COL.rose);
        else sup.set(i, V(lerp(J[0], -4.2, (p - 0.5) / 0.5), yC, 0), 0.07, COL.rose);
      }
      gat.commit(); sup.commit();
      // propagation: colour set by the pulse that was sent when the dot left the junction
      for (let i = 0; i < 70; i++) {
        const p = fract(t * VP / total + i / 70), s = p * total;
        const te = t - s / VP;
        const [x, z] = at(s);
        col.copy(cA).lerp(cB, level(te) / 3);
        prop.set(i, V(x, yC, z), 0.075, col);
      }
      prop.commit();
      // receiver output: stepped potential following the pulse train, delayed by the channel
      const delay = (3.0 - -3.3) / VP;
      setLine(step, (u) => { const tt = t - (1 - u) * 9; return [lerp(-2.1, 2.1, u), -0.85 + (level(tt - delay) / 3) * 1.5]; });
      mark.position.set(2.1, -0.85 + (level(t - delay) / 3) * 1.5, 0.07);
      ble.update(t, 0.35, 0.7, 1.0);
    }
  };
}

/* ====================================================================== */
/*  7. Wireless food-spoilage sensor (Nature Food, 2023)                    */
/*     Paper figure 1a,b: 2 x 2 cm sensor taped inside a petri dish with     */
/*     chicken and beef; layers PSMA / gold interdigitated electrodes /      */
/*     substrate / 9-turn NFC antenna with NFC chip; a phone reads the       */
/*     capacitance, which rises as the meat releases volatile amines.        */
/* ====================================================================== */
function buildFood() {
  const g = new THREE.Group(), M = { chip: std(COL.chip, { roughness: 0.4 }), silver: std(COL.silver, { metalness: 0.7, roughness: 0.3 }) };
  const cu = std(COL.cu, { metalness: 0.5, roughness: 0.35 }), goldM = std(COL.gold, { metalness: 0.65, roughness: 0.3 });
  const RD = 2.4, HD = 1.9;
  // petri dish: base, wall, lid
  g.add(cyl(RD, RD, 0.06, glass(0xcfe6ff, 0.16), 0, 0, 0, 64));
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(RD, RD, HD, 64, 1, true), glass(0xcfe6ff, 0.12)); wall.position.y = HD / 2; g.add(wall);
  const lid = cyl(RD + 0.1, RD + 0.1, 0.07, glass(0xcfe6ff, 0.22), 0, HD, 0, 64); g.add(lid);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(RD + 0.1, RD + 0.1, 0.24, 64, 1, true), glass(0xcfe6ff, 0.14)); rim.position.y = HD - 0.1; g.add(rim);
  // chicken and beef
  const chickM = std(0xefb3a6, { roughness: 0.7 }), beefM = std(0xa83a3a, { roughness: 0.7 });
  const chick = plate(roundPoly([[-0.9, -0.6], [0.1, -0.8], [0.9, -0.3], [0.8, 0.5], [-0.2, 0.8], [-0.95, 0.4]], 0.3), 0.26, chickM, 0.05);
  chick.position.set(-0.95, 0.06, 0.35); g.add(chick);
  const beef = plate(roundPoly([[-0.8, -0.5], [0.7, -0.6], [0.9, 0.1], [0.6, 0.6], [-0.7, 0.55]], 0.25), 0.3, beefM, 0.05);
  beef.position.set(1.05, 0.06, -0.35); g.add(beef);
  const bone = cyl(0.07, 0.07, 0.32, std(0xf1e8d6, { roughness: 0.6 }), 1.55, 0.1, -0.35, 14); bone.rotation.z = Math.PI / 2; bone.position.y = 0.4; g.add(bone);
  const cFresh = new THREE.Color(0xefb3a6), cOld = new THREE.Color(0xa99d86), bFresh = new THREE.Color(0xa83a3a), bOld = new THREE.Color(0x6b4a3d);
  // the sensor, taped under the lid: layers hang down from the antenna layer
  const sens = new THREE.Group(); sens.scale.set(1.3, 1, 1.3); g.add(sens);
  const yTop = HD - 0.02;
  const psma = plate(roundPoly(rectPts(0, 0, 1.6, 1.6), 0.05), 0.025, glass(0xf4efe4, 0.6, { roughness: 0.4, emissive: 0xf0a640, emissiveIntensity: 0 }), 0.004); sens.add(psma);
  const ide = new THREE.Group(); sens.add(ide);
  ide.add(box(0.09, 0.03, 1.45, goldM, -0.7, 0, 0)); ide.add(box(0.09, 0.03, 1.45, goldM, 0.7, 0, 0));
  for (let i = 0; i < 14; i++) {
    const z = -0.66 + i * 0.1015, left = i % 2 === 0;
    ide.add(box(1.25, 0.03, 0.05, goldM, left ? -0.07 : 0.07, 0, z));
  }
  const sub = plate(roundPoly(rectPts(0, 0, 1.6, 1.6), 0.05), 0.06, std(0x24402f, { roughness: 0.55 }), 0.005); sens.add(sub);
  const ant = new THREE.Group(); sens.add(ant);
  ant.add(plate(roundPoly(rectPts(0, 0, 1.6, 1.6), 0.05), 0.02, glass(COL.pi, 0.3), 0.004));
  ant.add(trace(rectSpiral(0, 0, 1.5, 1.5, 9, 0.075), 0.02, 0.04, 0.02, cu));
  ant.add(ic(M, 0.2, 0.2, 0.07, 0, 0.04, 0));
  // amine vapour rising from the meat to the sensor
  const NV = 56;
  const vap = makeDots(g, NV, basic(COL.amber));
  const vs = [];
  for (let i = 0; i < NV; i++) {
    const onChick = i % 2 === 0, a = hash(i * 3 + 1) * TAU, r = Math.sqrt(hash(i * 3 + 2)) * 0.7;
    vs.push({ x0: (onChick ? -0.95 : 1.05) + Math.cos(a) * r, z0: (onChick ? 0.35 : -0.35) + Math.sin(a) * r * 0.8, xT: (hash(i * 5 + 3) - 0.5) * 1.5, zT: (hash(i * 5 + 4) - 0.5) * 1.5, ph: hash(i * 7 + 5), sp: 0.16 + hash(i * 11 + 1) * 0.12, th: hash(i * 13 + 2) });
  }
  // phone with the reading: capacitance curve, threshold, traffic-light bar
  const phone = new THREE.Group(); phone.position.set(5.0, 0.0, -0.5); phone.rotation.y = -0.5; g.add(phone);
  const body = plateUp(roundPoly(rectPts(0, 0, 1.55, 3.0), 0.22), 0.14, std(0x1d222b, { roughness: 0.35, metalness: 0.3 })); body.position.set(0, 1.55, 0); phone.add(body);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 2.78), basic(0x0c1118)); screen.position.set(0, 1.55, 0.145); phone.add(screen);
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.34), basic(COL.mint)); bar.position.set(0, 2.55, 0.155); phone.add(bar);
  const axisP = linePlot(phone, 3, 0x5a6475); axisP.position.set(0, 1.55, 0.155);
  { const a = axisP.geometry.attributes.position; a.setXYZ(0, -0.5, 0.6, 0); a.setXYZ(1, -0.5, -0.7, 0); a.setXYZ(2, 0.52, -0.7, 0); a.needsUpdate = true; }
  const thrL = linePlot(phone, 2, 0xffffff); thrL.position.set(0, 1.55, 0.155); thrL.material.transparent = true; thrL.material.opacity = 0.35;
  const curve = linePlot(phone, 60, 0xff5a4f); curve.position.set(0, 1.55, 0.16);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), basic(0xffffff)); head.position.z = 0.17; phone.add(head);
  const dC = (u) => 1 - Math.exp(-3.2 * u);
  const yOf = (v) => 1.55 - 0.7 + v * 1.25, xOf = (u) => -0.5 + u * 1.0;
  { const a = thrL.geometry.attributes.position, yThr = yOf(dC(0.42)); a.setXYZ(0, -0.5, yThr - 1.55, 0); a.setXYZ(1, 0.5, yThr - 1.55, 0); a.needsUpdate = true; }
  const nfc = makeWaves(g, COL.blue, 4, 0.18, 0.95, 0.05);
  const from = V(4.5, 2.0, -0.35), to = V(0.4, HD - 0.3, 0);
  nfc.position.copy(from); nfc.lookAt(to);
  const nfcDist = from.distanceTo(to);
  const cG = new THREE.Color(COL.mint), cA = new THREE.Color(COL.amber), cR = new THREE.Color(COL.red), tmp = new THREE.Color();

  return {
    group: g, cam: { az: -0.5, el: 0.5, r: 6.3, target: [1.8, 1.25, 0] }, floor: -0.02, still: 9,
    update(t) {
      const T = 14, k = t % T;
      const s = sstep(0.4, 11.5, k) * (1 - sstep(12.4, 13.8, k));
      const e = sstep(0.05, 0.95, 0.5 - 0.5 * Math.cos(t * 0.45));
      const step = 0.07 + 0.2 * e;
      ant.position.y = yTop; sub.position.y = yTop - step; ide.position.y = yTop - 2 * step; psma.position.y = yTop - 3 * step;
      psma.material.emissiveIntensity = 0.5 * s;
      chickM.color.copy(cFresh).lerp(cOld, s); beefM.color.copy(bFresh).lerp(bOld, s);
      const yP = yTop - 3 * step - 0.03;
      for (let i = 0; i < NV; i++) {
        const v = vs[i];
        const on = v.th < 0.06 + 0.94 * s;
        const p = fract(t * v.sp + v.ph);
        if (!on) { vap.hide(i); continue; }
        const q = sstep(0, 1, p);
        const y = lerp(0.42, yP, p);
        vap.set(i, V(lerp(v.x0, v.xT, q) + Math.sin(t * 1.3 + v.ph * 9) * 0.06, y, lerp(v.z0, v.zT, q) + Math.cos(t * 1.1 + v.ph * 7) * 0.06), 0.055 * (1 - sstep(0.88, 1, p)), COL.amber);
      }
      vap.commit();
      // reading on the phone
      const N = 60, pos = curve.geometry.attributes.position;
      for (let i = 0; i < N; i++) { const u = (i / (N - 1)) * s; pos.setXYZ(i, xOf(u) , yOf(dC(u)) - 1.55, 0); }
      pos.needsUpdate = true;
      head.position.set(xOf(s), yOf(dC(s)), 0.17);
      const f = s < 0.42 ? 0 : s < 0.62 ? (s - 0.42) / 0.2 : 1;
      if (s < 0.62) tmp.copy(cG).lerp(cA, f); else tmp.copy(cA).lerp(cR, clamp((s - 0.62) / 0.25));
      bar.material.color.copy(tmp);
      nfc.update(t, 0.3, 0.55, nfcDist);
    }
  };
}

/* ====================================================================== */
/* ====================================================================== */
/*  MEMS temperature sensor: a simple, generic thin-film process           */
/*  Schematic only: oxide, metal film, photoresist, mask exposure, develop,  */
/*  etch, strip. The pattern is drawn after the microscope photo.            */
/* ====================================================================== */
function buildMems() {
  const g = new THREE.Group();
  const DW = 1.78, S = 1.6 / 260;
  const X = (px) => (px - 331) * S, Z = (py) => (py - 343) * S;
  const P2 = (arr) => arr.map(([px, py]) => [X(px), Z(py)]);
  /* the sensor layout, in microscope-photo pixels */
  const LINES = [];
  [298, 312, 326, 340].forEach((y) => LINES.push([[152, y], [540, y]]));
  LINES.push([[540, 298], [540, 312]], [[152, 312], [152, 326]], [[540, 326], [540, 340]]);
  [355, 392, 428, 463].forEach((y) => LINES.push([[152, y], [538, y]]));
  [152, 190, 224, 258, 292, 326, 360, 395].forEach((x) => LINES.push([[x, 355], [x, 463]]));
  [408, 430, 455, 480, 503].forEach((x) => [355, 392, 428, 463].forEach((y) => LINES.push([[x, y - 8], [x, y + 8]])));
  LINES.push([[152, 340], [152, 478]], [[185, 478], [535, 478]], [[215, 490], [495, 490]], [[235, 502], [460, 502]], [[152, 478], [275, 540]]);
  const PADS = [
    [[115, 70], [285, 70], [285, 272], [260, 298], [150, 298], [115, 270]],
    [[400, 70], [585, 70], [585, 270], [552, 298], [425, 298], [400, 272]],
    [[235, 505], [440, 516], [425, 535], [385, 542], [275, 540], [250, 520]]
  ];
  const mkPattern = (mat, h) => {
    const grp = new THREE.Group();
    LINES.forEach((l) => grp.add(trace(P2(l), 0, 0.03, h, mat)));
    PADS.forEach((pts) => grp.add(plate(roundPoly(P2(pts), 0.02), h, mat, 0)));
    return grp;
  };
  /* the same layout painted on a canvas, for the mask and the light beams */
  const paint = (ctx, N, lw, fill) => {
    const cx = (px) => ((X(px) + DW) / (2 * DW)) * N, cz = (py) => ((Z(py) + DW) / (2 * DW)) * N;
    ctx.lineWidth = lw; ctx.lineCap = "square"; ctx.fillStyle = fill; ctx.strokeStyle = fill;
    LINES.forEach(([a, b]) => { ctx.beginPath(); ctx.moveTo(cx(a[0]), cz(a[1])); ctx.lineTo(cx(b[0]), cz(b[1])); ctx.stroke(); });
    PADS.forEach((pts) => { ctx.beginPath(); pts.forEach(([px, py], i) => (i ? ctx.lineTo(cx(px), cz(py)) : ctx.moveTo(cx(px), cz(py)))); ctx.closePath(); ctx.fill(); });
  };
  const N = 1024, lwPx = (0.03 / (2 * DW)) * N * 1.15;
  const mkTex = (draw) => { const c = document.createElement("canvas"); c.width = c.height = N; const x = c.getContext("2d"); draw(x); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  const maskTex = mkTex((x) => { x.fillStyle = "#181b22"; x.fillRect(0, 0, N, N); x.globalCompositeOperation = "destination-out"; paint(x, N, lwPx, "#000"); });
  const beamTex = mkTex((x) => { paint(x, N, lwPx, "#ffffff"); });

  const siM = std(0x56657c, { metalness: 0.35, roughness: 0.32 });
  const oxM = std(0x9ec9ff, { transparent: true, opacity: 0.62, roughness: 0.15 });
  const metM = std(COL.gold, { metalness: 0.8, roughness: 0.28, transparent: true });
  const patM = std(COL.gold, { metalness: 0.8, roughness: 0.28, emissive: 0xffd36b, emissiveIntensity: 0 });
  const resM = std(0xc9486f, { transparent: true, opacity: 0.9, roughness: 0.5 });
  const resP = std(0xc9486f, { roughness: 0.5, emissive: 0x8a4bff, emissiveIntensity: 0 });
  const dark = std(0x2a303b, { roughness: 0.45, metalness: 0.4 });
  const layer = (mat, w = 2 * DW) => { const geo = new THREE.BoxGeometry(w, 1, w); geo.translate(0, 0.5, 0); const m = new THREE.Mesh(geo, mat); m.receiveShadow = true; return m; };

  const die = new THREE.Group(); g.add(die);
  die.add(box(2 * DW, 0.2, 2 * DW, siM));
  const ox = layer(oxM); ox.position.y = 0.2; die.add(ox);
  const met = layer(metM); met.position.y = 0.26; die.add(met);
  const res = layer(resM); res.position.y = 0.31; die.add(res);
  const patMetal = mkPattern(patM, 0.052); patMetal.position.y = 0.26; die.add(patMetal);
  const patRes = mkPattern(resP, 0.102); patRes.position.y = 0.31; die.add(patRes);

  /* tools */
  const shower = new THREE.Group(); shower.position.set(0, 1.75, 0); g.add(shower);
  shower.add(cyl(1.75, 1.75, 0.1, dark, 0, 0, 0, 48)); shower.add(cyl(0.18, 0.18, 0.9, dark, 0, 0.1, 0, 20));
  const target = new THREE.Group(); target.position.set(2.0, 1.45, -0.5); g.add(target);
  { const d = cyl(0.55, 0.55, 0.09, std(COL.gold, { metalness: 0.9, roughness: 0.25 }), 0, 0, 0, 40); d.rotation.x = Math.PI / 2; target.add(d);
    const h = cyl(0.62, 0.62, 0.07, dark, 0, 0.09, 0, 40); h.rotation.x = Math.PI / 2; h.position.z = -0.08; target.add(h); target.lookAt(0, 0.3, 0); }
  const pip = new THREE.Group(); pip.position.set(0, 1.5, 0); g.add(pip);
  { const cone = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.5, 20), dark); cone.rotation.x = Math.PI; cone.position.y = 0.25; pip.add(cone);
    pip.add(cyl(0.07, 0.07, 1.0, dark, 0, 0.5, 0, 14)); }
  const drop = new THREE.Mesh(SPHERE, basic(0xc9486f)); drop.frustumCulled = false; g.add(drop);
  const mask = new THREE.Group(); g.add(mask);
  mask.add(box(3.9, 0.05, 3.9, glass(0xa9bde0, 0.22), 0, -0.025, 0));
  { const mm = new THREE.Mesh(new THREE.PlaneGeometry(2 * DW, 2 * DW), new THREE.MeshStandardMaterial({ map: maskTex, transparent: true, roughness: 0.4, metalness: 0.3, depthWrite: false, side: THREE.DoubleSide })); mm.rotation.x = -Math.PI / 2; mm.position.y = 0.002; mask.add(mm); }
  const lamp = new THREE.Group(); g.add(lamp);
  lamp.add(box(3.4, 0.3, 3.4, dark, 0, 0, 0));
  { const gl = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 3.0), basic(0xb48cff)); gl.rotation.x = Math.PI / 2; gl.position.y = -0.002; lamp.add(gl); }
  const beams = new THREE.Group(); g.add(beams);
  const beamMats = [];
  for (let i = 0; i < 7; i++) {
    const m = new THREE.MeshBasicMaterial({ map: beamTex, color: 0xa987ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(2 * DW, 2 * DW), m); pl.rotation.x = -Math.PI / 2; pl.position.y = i / 6; pl.frustumCulled = false; beams.add(pl); beamMats.push(m);
  }
  const liqGeo = new THREE.BoxGeometry(3.95, 1, 3.95); liqGeo.translate(0, 0.5, 0);
  const liqM = glass(0x5fd6c8, 0.22); const liq = new THREE.Mesh(liqGeo, liqM); liq.position.y = 0.02; liq.frustumCulled = false; g.add(liq);
  const cTeal = new THREE.Color(0x5fd6c8), cAmb = new THREE.Color(0xf2a65a);

  /* particles: gas for the oxide, sputtered metal, bubbles in the baths */
  const NR = 64, NS = 56, NB = 48;
  const rain = makeDots(g, NR, basic(0xbfe0ff)), sput = makeDots(g, NS, basic(COL.gold)), bub = makeDots(g, NB, basic(0x9ff2ee));
  const rv = [], sv = [], bv = [];
  for (let i = 0; i < NR; i++) { const a = hash(i * 3 + 1) * TAU, r = Math.sqrt(hash(i * 3 + 2)) * 1.6; rv.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, ph: hash(i * 7 + 5), sp: 0.5 + hash(i * 5 + 1) * 0.35 }); }
  for (let i = 0; i < NS; i++) sv.push({ x: (hash(i * 3 + 11) - 0.5) * 3.0, z: (hash(i * 3 + 12) - 0.5) * 3.0, ph: hash(i * 7 + 15), sp: 0.7 + hash(i * 5 + 3) * 0.4 });
  for (let i = 0; i < NB; i++) bv.push({ x: (hash(i * 3 + 21) - 0.5) * 3.3, z: (hash(i * 3 + 22) - 0.5) * 3.3, ph: hash(i * 7 + 25), sp: 0.35 + hash(i * 5 + 4) * 0.3 });
  const show = (o, a) => { o.visible = a > 0.01; o.scale.setScalar(Math.max(a, 0.001)); };
  const win = (k, a, b, f = 0.5) => sstep(a, a + f, k) * (1 - sstep(b - f, b, k));
  const LABELS = [
    [0, "1  Clean silicon wafer"], [2, "2  Deposit an insulating oxide layer"], [5, "3  Deposit the metal film"], [8, "4  Spin-coat photoresist"],
    [11, "5  Expose the pattern through a mask"], [14, "6  Develop the resist"], [16.5, "7  Etch away the unprotected metal"], [19.5, "8  Strip the resist"], [22.4, "Finished sensor pattern"]
  ];
  const TT = 26;

  return {
    group: g, cam: { az: -0.35, el: 0.85, r: 3.9, target: [0, 0.75, 0] }, floor: -0.001, still: 24,
    label(t) { const k = t % TT; let s = LABELS[0][1]; for (const [a, l] of LABELS) if (k >= a) s = l; return s; },
    update(t) {
      const k = t % TT;
      const appear = sstep(0, 0.9, k) * (1 - sstep(25.1, 26, k));
      die.scale.setScalar(Math.max(appear, 0.001));
      die.rotation.y = -0.12 + Math.PI * 6 * sstep(8.3, 10.9, k);
      // layers
      const g1 = sstep(2.6, 4.8, k), g2 = sstep(5.6, 7.8, k);
      ox.scale.y = Math.max(0.06 * g1, 0.0001); ox.visible = g1 > 0.001;
      const mo = 1 - sstep(17.4, 19.2, k);
      met.scale.y = Math.max(0.05 * g2, 0.0001); met.visible = g2 > 0.001 && mo > 0.01; metM.opacity = mo;
      const rs = sstep(8.5, 10.0, k), rOn = k > 8.45 && k < 15.9;
      res.visible = rOn; res.scale.set(lerp(0.12, 1, rs), 0.1, lerp(0.12, 1, rs)); resM.opacity = 0.9 * (1 - sstep(14.3, 15.8, k));
      patRes.visible = k >= 11.9 && k < 21.9; patRes.scale.y = Math.max(1 - sstep(20.4, 21.8, k), 0.001);
      resP.emissiveIntensity = 0.12 + 1.3 * win(k, 12.0, 14.2, 0.7);
      patMetal.visible = k >= 16.4;
      patM.emissiveIntensity = 0.25 * win(k, 22.8, 25.0, 0.8);
      // tools
      show(shower, win(k, 1.8, 5.2, 0.5)); show(target, win(k, 5.2, 8.2, 0.5));
      const pa = win(k, 7.6, 10.2, 0.5); show(pip, pa);
      const dp = clamp((k - 8.0) / 0.5);
      drop.visible = k > 8.0 && k < 8.52; drop.position.set(0, lerp(1.5, 0.42, dp * dp), 0); drop.scale.setScalar(0.09);
      const mA = win(k, 11.0, 14.0, 0.7);
      const maskY = lerp(1.7, 0.85, sstep(11.0, 11.8, k)) + 0.85 * sstep(13.2, 14.0, k);
      mask.position.y = maskY; mask.visible = mA > 0.01 && k < 14.05; lamp.position.y = maskY + 0.7; lamp.visible = mask.visible;
      const bA = win(k, 11.8, 13.6, 0.4);
      beams.position.y = 0.44; beams.scale.y = Math.max(maskY - 0.05 - 0.44, 0.01); beams.visible = bA > 0.01;
      beamMats.forEach((m) => (m.opacity = 0.2 * bA));
      // baths
      const lvl = Math.min(1, win(k, 16.6, 19.6, 0.55) + win(k, 19.9, 22.4, 0.5));
      liq.scale.y = Math.max(0.6 * lvl, 0.0001); liq.visible = lvl > 0.01;
      liqM.color.copy(k < 19.7 ? cTeal : cAmb);
      // particles
      const wr = win(k, 2.4, 4.9, 0.5), ws = win(k, 5.4, 7.8, 0.5), wb1 = win(k, 17.4, 19.2, 0.4), wb2 = win(k, 20.3, 21.9, 0.4);
      for (let i = 0; i < NR; i++) {
        const v = rv[i], p = fract(t * v.sp + v.ph);
        if (wr < 0.02) { rain.hide(i); continue; }
        rain.set(i, V(v.x, lerp(1.65, 0.3 + 0.06 * g1, p), v.z), 0.05 * wr * (1 - sstep(0.9, 1, p)));
      }
      rain.commit();
      const T0 = V(2.0, 1.45, -0.5);
      for (let i = 0; i < NS; i++) {
        const v = sv[i], p = fract(t * v.sp + v.ph);
        if (ws < 0.02) { sput.hide(i); continue; }
        sput.set(i, V(lerp(T0.x, v.x, p), lerp(T0.y, 0.28 + 0.05 * g2, p), lerp(T0.z, v.z, p)), 0.05 * ws * (1 - sstep(0.9, 1, p)));
      }
      sput.commit();
      const wb = Math.max(wb1, wb2);
      for (let i = 0; i < NB; i++) {
        const v = bv[i], p = fract(t * v.sp + v.ph);
        if (wb < 0.02) { bub.hide(i); continue; }
        bub.set(i, V(v.x + Math.sin(t * 2 + v.ph * 9) * 0.04, lerp(0.3, 0.62, p), v.z), 0.045 * wb * (1 - sstep(0.85, 1, p)), wb1 >= wb2 ? 0x9ff2ee : 0xffd3a1);
      }
      bub.commit();
    }
  };
}


/* ====================================================================== */
/*  9. Haptic feedback for a supernumerary robotic limb (in progress)       */
/*     Schematic of the feedback only (the limb itself is not drawn): two    */
/*     vibrotactile actuators (LRAs) on a forearm. The vibration shifts from */
/*     one to the other, so it feels like a point moving along the skin.     */
/* ====================================================================== */
function buildLimb() {
  const g = new THREE.Group();
  const skin = std(COL.skin, { roughness: 0.75 });
  const R = 0.95, X0 = -3.2, X1 = 3.6;
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.8, X1 - X0, 48), skin);
  arm.rotation.z = Math.PI / 2; arm.position.set((X0 + X1) / 2, 0, 0); g.add(arm);
  const LX = [-1.0, 1.7], Z = 0;
  // flat cables from the two actuators towards the elbow end
  const cable = std(COL.cu, { metalness: 0.4, roughness: 0.4 });
  g.add(box(LX[0] - X0 - 0.4, 0.02, 0.1, cable, (LX[0] + X0 + 0.4) / 2, R + 0.005, -0.12));
  g.add(box(LX[1] - X0 - 0.4, 0.02, 0.1, cable, (LX[1] + X0 + 0.4) / 2, R + 0.005, 0.12));
  const pads = LX.map((x, i) => {
    const pad = new THREE.Group(); pad.position.set(x, R + 0.05, i ? 0.12 : -0.12); g.add(pad);
    pad.add(cyl(0.4, 0.4, 0.12, std(COL.silver, { metalness: 0.75, roughness: 0.3 }), 0, 0, 0, 36));
    pad.add(cyl(0.24, 0.24, 0.03, std(0x2a2f38, { roughness: 0.4 }), 0, 0.07, 0, 28));
    const w = makeWaves(g, COL.amber, 3, 0.3, 1.35, 0.09); w.position.set(x, R + 0.18, i ? 0.12 : -0.12); w.rotation.x = -Math.PI / 2;
    return { pad, w };
  });
  // the felt position: a soft glow on the skin that slides between the two actuators
  const glowMat = basic(COL.amber, { transparent: true, opacity: 0.5, depthWrite: false });
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.34, 40), glowMat); glow.rotation.x = -Math.PI / 2; g.add(glow);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 16), basic(0xfff1c9)); g.add(core);
  const trail = makeDots(g, 10, basic(COL.amber, { transparent: true, opacity: 0.6 }));

  // position of the felt point, 0 = first actuator, 1 = second: hold, move, hold, move back
  const T = 9;
  const pos = (t) => { const k = ((t % T) + T) % T; return sstep(1.2, 3.6, k) - sstep(5.4, 7.8, k); };
  return {
    group: g, cam: { az: -0.42, el: 0.5, r: 5.0, target: [0.2, 0.1, 0] }, floor: -R - 0.12, still: 2.4,
    label(t) { const k = ((t % T) + T) % T; return k < 1.2 ? "Vibration at the first actuator" : k < 3.6 ? "Vibration moves along the arm" : k < 5.4 ? "Vibration at the second actuator" : k < 7.8 ? "Vibration moves back" : "Vibration at the first actuator"; },
    update(t) {
      const s = pos(t);
      const amp = [1 - s, s].map((a) => 0.12 + 0.88 * Math.pow(a, 0.8));
      pads.forEach(({ pad, w }, i) => {
        pad.position.y = R + 0.05 + Math.sin(t * 90 + i * 2) * 0.014 * amp[i];
        w.update(t, 0.9 + amp[i] * 0.5, 1.0 * amp[i]);
      });
      const x = lerp(LX[0], LX[1], s), z = lerp(-0.12, 0.12, s);
      glow.position.set(x, R + 0.025, z); core.position.set(x, R + 0.1, z);
      glowMat.opacity = 0.35 + 0.2 * Math.sin(t * 6);
      for (let i = 0; i < 10; i++) {
        const sp = pos(t - (i + 1) * 0.09);
        trail.set(i, V(lerp(LX[0], LX[1], sp), R + 0.1, lerp(-0.12, 0.12, sp)), 0.07 * (1 - i / 11), COL.amber);
      }
      trail.commit();
    }
  };
}

const BUILDERS = { reader: buildReader, wifi: buildWifi, needle: buildNeedle, tag: buildTag, lens: buildLens, testbed: buildTestbed, food: buildFood, mems: buildMems, limb: buildLimb };

/* ------------------------------------------------------------- viewer ---- */
const instances = new Set();
let rafId = 0;
const reduceMotion = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
const fixedTime = (() => { const m = /[?&]t=([\d.]+)/.exec(location.search); return m ? parseFloat(m[1]) : null; })();

function loop(now) {
  rafId = requestAnimationFrame(loop);
  let any = false;
  instances.forEach((it) => { if (it.visible) { any = true; it.frame(now / 1000); } });
  if (!any) { cancelAnimationFrame(rafId); rafId = 0; }
}
const kick = () => { if (!rafId) rafId = requestAnimationFrame(loop); };

function mount(container, kind, opts = {}) {
  const build = BUILDERS[kind];
  if (!build) return null;
  // quick capability test, so callers can keep their static image when WebGL is missing
  try { const c = document.createElement("canvas"); if (!(c.getContext("webgl2") || c.getContext("webgl"))) return null; } catch (e) { return null; }

  const interactive = !!opts.interactive;
  const model = build();
  const scene = new THREE.Scene();
  scene.add(model.group);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);
  const hemi = new THREE.HemisphereLight(0xb6c4e8, 0x2a2f3a, 0.5); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff1e0, 2.4);
  key.position.set(-6, 12, 8); key.castShadow = true;
  const small = Math.min(screen.width, screen.height) < 820;
  key.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11, near: 1, far: 40 });
  key.shadow.bias = -0.0006; key.shadow.normalBias = 0.03; key.shadow.radius = 4;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9db0ff, 0.9); rim.position.set(7, 5, -8); scene.add(rim);
  const floorMat = new THREE.ShadowMaterial({ opacity: 0.35 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.y = model.floor; floor.receiveShadow = true; scene.add(floor);
  model.group.traverse((o) => { if (o.isMesh && !o.material.transparent && o.castShadow === false && o.geometry !== SPHERE) o.castShadow = true; });

  const host = document.createElement("div");
  host.className = "model-view";
  container.append(host);
  let cap = null;
  if (model.label) { cap = document.createElement("div"); cap.className = "model-caption"; cap.setAttribute("aria-hidden", "true"); host.append(cap); }

  const st = { renderer: null, canvas: null, w: 1, h: 1, dirty: true, visible: false, az: 0, el: 0, vaz: 0, vel: 0, drag: false, lx: 0, ly: 0, px: 0, py: 0, ptx: 0, pty: 0, hover: false, releaseTimer: 0, start: performance.now() / 1000, lastDpr: 1 };
  const still = reduceMotion();

  function ensureRenderer() {
    if (st.renderer) return true;
    try {
      const canvas = document.createElement("canvas");
      canvas.setAttribute("aria-hidden", "true");
      if (interactive) canvas.style.touchAction = "pan-y";
      const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
      r.setClearColor(0x000000, 0);
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
      try { const pm = new THREE.PMREMGenerator(r); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); } catch (e) { hemi.intensity = 1.2; }
      scene.traverse((o) => { if (o.material && o.material.isMeshStandardMaterial) o.material.envMapIntensity = 0.42; });
      st.renderer = r; st.canvas = canvas; host.append(canvas);
      canvas.addEventListener("webglcontextlost", (ev) => { ev.preventDefault(); release(); if (st.visible) { ensureRenderer(); size(); } });
      size();
      return true;
    } catch (e) { console.warn('3D model: renderer failed', e); return false; }
  }
  function release() {
    if (!st.renderer) return;
    try { st.renderer.dispose(); st.renderer.forceContextLoss(); } catch (e) { /* ignore */ }
    st.canvas.remove(); st.renderer = null; st.canvas = null;
    if (scene.environment) { scene.environment.dispose(); scene.environment = null; }
  }
  function size() {
    const r = host.getBoundingClientRect();
    st.w = Math.max(1, Math.round(r.width)); st.h = Math.max(1, Math.round(r.height));
    if (!st.renderer) return;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    const budget = 1800000;
    if (st.w * st.h * dpr * dpr > budget) dpr = Math.max(1, Math.sqrt(budget / (st.w * st.h)));
    st.renderer.setPixelRatio(dpr); st.renderer.setSize(st.w, st.h, false);
    st.canvas.style.width = "100%"; st.canvas.style.height = "100%";
    camera.aspect = st.w / st.h; camera.updateProjectionMatrix(); st.dirty = true;
  }

  const target = new THREE.Vector3(...model.cam.target);
  function frame(now) {
    if (!ensureRenderer()) return;
    const t = fixedTime != null ? fixedTime : still ? model.still : now - st.start;
    const dark = (document.documentElement.dataset.theme || "dark") !== "light";
    floorMat.opacity = dark ? 0.5 : 0.26;
    // inertia after a drag
    if (!st.drag && (Math.abs(st.vaz) > 1e-4 || Math.abs(st.vel) > 1e-4)) { st.az += st.vaz; st.el = clamp(st.el + st.vel, -0.45, 0.5); st.vaz *= 0.93; st.vel *= 0.9; st.dirty = true; }
    if (still && !st.dirty && !st.drag) return;
    st.px += (st.ptx - st.px) * 0.08; st.py += (st.pty - st.py) * 0.08;
    model.update(t);
    if (cap) { const lab = model.label(t); if (lab !== cap._s) { cap._s = lab; cap.textContent = lab; } }
    const sway = still || fixedTime != null ? 0 : Math.sin(t * 0.22) * 0.38;
    const az = model.cam.az + sway + st.az + st.px * 0.18;
    const el = clamp(model.cam.el + st.el - st.py * 0.1, 0.12, 1.2);
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
    const dist = model.cam.r / Math.sin(Math.min(vfov, hfov) / 2) * 0.66;
    camera.position.set(target.x + dist * Math.sin(az) * Math.cos(el), target.y + dist * Math.sin(el), target.z + dist * Math.cos(az) * Math.cos(el));
    camera.lookAt(target);
    st.renderer.render(scene, camera);
    st.dirty = false;
  }

  const it = {
    get visible() { return st.visible; },
    frame,
  };
  instances.add(it);
  const io = new IntersectionObserver((ents) => {
    const vis = ents[0].isIntersecting;
    st.visible = vis;
    clearTimeout(st.releaseTimer);
    if (vis) { st.dirty = true; kick(); }
    else st.releaseTimer = setTimeout(() => { if (!st.visible) release(); }, 1500);
  }, { rootMargin: "80px", threshold: 0 });
  // the caller may still be assembling the page: start observing once the container is in the document
  let tries = 0;
  const watch = () => { if (container.isConnected) io.observe(container); else if (tries++ < 120) requestAnimationFrame(watch); };
  watch();
  const ro = new ResizeObserver(() => size());
  ro.observe(host);
  document.addEventListener("themechange", () => { st.dirty = true; });

  if (interactive) {
    host.classList.add("is-interactive");
    host.addEventListener("pointerdown", (e) => { st.drag = true; st.lx = e.clientX; st.ly = e.clientY; st.vaz = st.vel = 0; try { host.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ } host.classList.add("dragging"); });
    host.addEventListener("pointermove", (e) => {
      if (st.drag) {
        const dx = e.clientX - st.lx, dy = e.clientY - st.ly; st.lx = e.clientX; st.ly = e.clientY;
        st.az -= dx * 0.008; st.el = clamp(st.el + dy * 0.006, -0.45, 0.5); st.vaz = -dx * 0.004; st.vel = dy * 0.002; st.dirty = true;
      } else if (e.pointerType === "mouse") {
        const r = host.getBoundingClientRect(); st.ptx = ((e.clientX - r.left) / r.width - 0.5) * 2; st.pty = ((e.clientY - r.top) / r.height - 0.5) * 2; st.dirty = true;
      }
    });
    const end = () => { st.drag = false; host.classList.remove("dragging"); };
    host.addEventListener("pointerup", end); host.addEventListener("pointercancel", end);
    host.addEventListener("pointerleave", () => { st.ptx = st.pty = 0; });
  } else {
    // cards: a gentle parallax that follows the pointer
    container.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse") return;
      const r = host.getBoundingClientRect(); st.ptx = ((e.clientX - r.left) / r.width - 0.5) * 2; st.pty = ((e.clientY - r.top) / r.height - 0.5) * 2; st.dirty = true;
    });
    container.addEventListener("pointerleave", () => { st.ptx = st.pty = 0; st.dirty = true; });
  }
  return { dispose() { instances.delete(it); io.disconnect(); ro.disconnect(); release(); host.remove(); } };
}

window.Models = { mount, kinds: Object.keys(BUILDERS) };
