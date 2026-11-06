/*
  Scroll-driven build sequence.

  A canvas is pinned behind the story chapters. Scroll position is turned into a
  single number "s" (0 = intro chapter centred, 5 = last chapter centred). Every
  part of the scene is a function of s, so nothing plays by itself:

    s 0.0 - 1.0  blurry signal waveforms come into focus
    s 0.8 - 1.6  flexible circuit (polyimide) settles in
    s 1.3 - 2.0  sensor electrodes and traces are drawn
    s 1.8 - 2.6  antenna coil draws and snaps on
    s 2.5 - 3.4  passive components drop onto their footprints
    s 3.0 - 3.5  the microcontroller lands
    s 3.4 - 4.0  signals flow, the coil radiates

  This file is the 2D version and the page controller. When the browser supports WebGL,
  the controller hands drawing to js/scene3d.bundle.js (three.js) instead. The 2D drawing below
  is the fallback. It is drawn with plain 2D canvas: a small
  projection function lifts flat shapes into a tilted, rotating view, with
  shadows and side faces as depth cues. No WebGL, no libraries.
*/
(() => {
  "use strict";

  /* ---------------------------------------------------------------- helpers */
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const easeOutBack = (t) => { t = clamp(t); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const hexRGB = (h) => {
    h = String(h).trim().replace("#", "");
    if (h.length === 3) h = [...h].map((c) => c + c).join("");
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
  const shade = (c, f) => [clamp(c[0] * f, 0, 255), clamp(c[1] * f, 0, 255), clamp(c[2] * f, 0, 255)];

  /* --------------------------------------------------------------- geometry */
  // World units, y up, z up. The board lies in the xy plane.
  const X0 = -180, X1 = 180, Y0 = -110, Y1 = 110, RAD = 28;
  const TAIL_L = 130, TAIL_H = 64;
  const CX0 = -65;                       // centre of the whole device, for framing
  const LANES = [-16, 0, 16];            // three sensor lanes
  const ELX = X0 - TAIL_L + 22;          // x of the electrodes at the tail tip
  const BOARD_T = 5;                     // substrate thickness
  const FLOOR_Z = -18;

  const arc = (cx, cy, a0, a1, n) => {
    const out = [];
    for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); out.push([cx + RAD * Math.cos(a), cy + RAD * Math.sin(a)]); }
    return out;
  };
  const OUTLINE = [
    ...arc(X1 - RAD, Y0 + RAD, -Math.PI / 2, 0, 6),
    ...arc(X1 - RAD, Y1 - RAD, 0, Math.PI / 2, 6),
    ...arc(X0 + RAD, Y1 - RAD, Math.PI / 2, Math.PI, 6),
    [X0, TAIL_H / 2], [X0 - TAIL_L, TAIL_H / 2], [X0 - TAIL_L, -TAIL_H / 2], [X0, -TAIL_H / 2],
    ...arc(X0 + RAD, Y0 + RAD, Math.PI, Math.PI * 1.5, 6)
  ];

  const rectPoly = (cx, cy, w, h) => [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]];
  const circlePoly = (cx, cy, r, n = 18) => Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });

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
    for (let k = 0; k < turns; k++) {
      pts.push([r, b], [r, t], [l, t], [l, b + pitch]);
      l += pitch; r -= pitch; b += pitch; t -= pitch;
    }
    return pts;
  };
  const COIL = spiral(10, -94, 166, 94, 6, 9);
  const COIL_END = COIL[COIL.length - 1];
  const COIL_CENTER = [88, 0];

  /* ------------------------------------------------------------------- view */
  const view = { cx: 0, cy: 0, scale: 1, yaw: 0, sinE: Math.sin(0.96), cosE: Math.cos(0.96) };

  // world (x, y, z) -> [screen x, screen y, depth]
  function P(x, y, z) {
    x -= CX0;
    const c = Math.cos(view.yaw), sn = Math.sin(view.yaw);
    const X = x * c - y * sn, Y = x * sn + y * c;
    const depth = Y * view.cosE - z * view.sinE;
    const k = 1 / (1 + depth * 0.0011);
    return [view.cx + X * view.scale * k, view.cy - (Y * view.sinE + z * view.cosE) * view.scale * k, depth];
  }

  /* ----------------------------------------------------------- drawing bits */
  function fillPoly(ctx, pts3, fill, stroke, lw) {
    ctx.beginPath();
    pts3.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    if (stroke) { ctx.lineWidth = lw || 1; ctx.strokeStyle = stroke; ctx.stroke(); }
  }

  // A vertical extrusion of a counter-clockwise polygon between z0 and z1.
  function prism(ctx, poly, z0, z1, topRGB, sideRGB, alpha, edge) {
    const n = poly.length, c = Math.cos(view.yaw), sn = Math.sin(view.yaw);
    const quads = [];
    for (let i = 0; i < n; i++) {
      const a = poly[i], b = poly[(i + 1) % n];
      const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
      const nx = dy / len, ny = -dx / len;                       // outward normal
      const rx = nx * c - ny * sn, ry = nx * sn + ny * c;        // after yaw
      const lit = 0.62 + 0.38 * clamp((rx * -0.55 + ry * 0.8) * 0.5 + 0.5);
      const pa0 = P(a[0], a[1], z0), pb0 = P(b[0], b[1], z0), pb1 = P(b[0], b[1], z1), pa1 = P(a[0], a[1], z1);
      quads.push({ pts: [pa0, pb0, pb1, pa1], d: (pa0[2] + pb0[2]) / 2, lit });
    }
    quads.sort((p, q) => q.d - p.d);
    ctx.globalAlpha = alpha;
    for (const q of quads) fillPoly(ctx, q.pts, rgba(shade(sideRGB, q.lit), 1));
    fillPoly(ctx, poly.map((p) => P(p[0], p[1], z1)), rgba(topRGB, 1), edge || "rgba(255,255,255,.14)", 1);
    ctx.globalAlpha = 1;
  }

  function strokePartial(ctx, pts, z, frac, widthUnits, col, alpha) {
    if (frac <= 0.0005) return;
    const segs = []; let total = 0;
    for (let i = 0; i < pts.length - 1; i++) { const L = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); segs.push(L); total += L; }
    let left = total * clamp(frac);
    ctx.beginPath();
    const p0 = P(pts[0][0], pts[0][1], z);
    ctx.moveTo(p0[0], p0[1]);
    for (let i = 0; i < segs.length && left > 0; i++) {
      const t = Math.min(1, left / segs[i]);
      const a = pts[i], b = pts[i + 1];
      const q = P(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, z);
      ctx.lineTo(q[0], q[1]);
      left -= segs[i];
    }
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.lineWidth = Math.max(1, widthUnits * view.scale);
    ctx.strokeStyle = rgba(col, alpha);
    ctx.stroke();
  }

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

  function glow(ctx, x, y, r, col, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  function pulse(ctx, x, y, r, col, a, core) {
    glow(ctx, x, y, r * 3.2, col, 0.18 * a);
    ctx.fillStyle = rgba(core, 0.9 * a);
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 1.4; ctx.strokeStyle = rgba(col, 0.95 * a);
    ctx.stroke();
  }

  /* ------------------------------------------------------------------ stages */
  function stages(s) {
    return {
      focus: smooth(0, 1, s),
      board: smooth(0.75, 1.55, s),
      traces: smooth(1.3, 2.0, s),
      coil: smooth(1.8, 2.6, s),
      pass: [0, 1, 2, 3].map((k) => smooth(2.5 + 0.14 * k, 2.95 + 0.14 * k, s)),
      chip: smooth(3.0, 3.5, s),
      flow: smooth(1.7, 2.2, s),
      live: smooth(3.4, 4.0, s)
    };
  }

  /* ------------------------------------------------------------- background */
  function drawGlows(ctx, w, h, s, C) {
    const a = C.dark ? 1.1 : 1;
    const blobs = [
      [0.12, 0.25, 0.36, C.accent, 0.11], [0.88, 0.18, 0.30, C.copper, 0.10],
      [0.72, 0.88, 0.40, C.accent, 0.09], [0.28, 0.92, 0.28, C.copper, 0.08]
    ];
    blobs.forEach(([bx, by, br, col, al], i) => {
      const x = w * bx + Math.sin(s * 0.9 + i * 1.7) * 36;
      const y = h * by + (i % 2 ? -1 : 1) * s * 16;
      glow(ctx, x, y, Math.min(w, h) * br * 1.4, col, al * a);
    });
  }

  function drawFloor(ctx, st, C) {
    const A = 0.1 * smooth(0, 0.6, st.board);
    if (A < 0.004) return;
    const R = 380, step = 38;
    ctx.lineWidth = 1;
    for (let i = -10; i <= 10; i++) {
      for (let dir = 0; dir < 2; dir++) {
        const fixed = CX0 * (dir ? 0 : 1) + i * step;
        for (let j = -R; j < R; j += 40) {
          const m = j + 20, r = Math.hypot(i * step, m) / R;
          if (r >= 1) continue;
          const a = dir ? [m + CX0, fixed, FLOOR_Z] : [fixed, m, FLOOR_Z];
          const b = dir ? [m + 40 + CX0, fixed, FLOOR_Z] : [fixed, m + 40, FLOOR_Z];
          const pa = P(a[0], a[1], FLOOR_Z), pb = P(b[0], b[1], FLOOR_Z);
          ctx.strokeStyle = rgba(C.ink, A * Math.pow(1 - r, 1.4));
          ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); ctx.stroke();
        }
      }
    }
  }

  /* ------------------------------------------------------------------ waves */
  function drawWaves(ctx, w, h, s, C, st) {
    const blur = (1 - st.focus) * 16;
    const ph = s * 1.6;
    const waves = [
      { lane: 0, col: C.accent, base: 0.30, amp: 0.05,
        f: (x) => Math.sin(x * 0.055 + ph * 2.0) * (0.65 + 0.35 * Math.sin(x * 0.007 + ph * 0.4)) },
      { lane: 1, col: C.ink, base: 0.50, amp: 0.075, a: 0.7,
        f: (x) => { const p = (((x * 0.0065 + ph * 0.12) % 1) + 1) % 1; return -(Math.exp(-Math.pow((p - 0.22) / 0.045, 2)) + 0.4 * Math.exp(-Math.pow((p - 0.5) / 0.1, 2)) - 0.12); } },
      { lane: 2, col: C.copper, base: 0.68, amp: 0.045,
        f: (x) => Math.sin(x * 0.012 + ph * 0.8) + 0.35 * Math.sin(x * 0.031 + ph * 1.7) }
    ];
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    for (const wv of waves) {
      const e = P(ELX, LANES[wv.lane], BOARD_T);
      const ex = e[0], ey = e[1];
      if (ex < 20) continue;
      const y0 = w < 900 ? lerp(ey, h * wv.base, 0.3) : h * wv.base;   // on phones keep the lines close to the board
      ctx.beginPath();
      for (let x = 0; x < ex; x += 5) {
        const u = x / ex;
        const A = wv.amp * h * (w < 900 ? 0.55 : 1) * (1 - smooth(0.55, 1, u)) * (0.35 + 0.65 * smooth(0, 0.2, u));
        const y = lerp(y0, ey, smooth(0.3, 1, u)) + A * wv.f(x);
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.lineTo(ex, ey);
      if (blur > 0.4) {
        for (let j = 4; j >= 1; j--) {
          ctx.lineWidth = 2 + blur * j * 0.9;
          ctx.strokeStyle = rgba(wv.col, 0.018 + 0.05 * (1 - st.focus));
          ctx.stroke();
        }
      }
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = rgba(wv.col, (wv.a || 0.95) * Math.pow(st.focus, 2.2));
      ctx.stroke();
    }
  }

  /* ----------------------------------------------------------------- device */
  function drawSMD(ctx, p, f, Z, C) {
    const lift = Math.max(-1, (1 - easeOutBack(f)) * 46);
    const alpha = smooth(0, 0.3, f);
    const zb = BOARD_T + Z + lift;
    const landed = smooth(0.7, 1, f);
    fillPoly(ctx, rectPoly(p.x + 3, p.y - 3, p.w, p.h).map((q) => P(q[0], q[1], BOARD_T + Z + 0.2)), `rgba(10,14,26,${0.22 * alpha * landed})`);
    const body = p.kind === "cap" ? C.ceramic : C.chip;
    const cap = 4.2, hh = p.kind === "cap" ? 5 : 4.4;
    prism(ctx, rectPoly(p.x, p.y, p.w - 2 * cap, p.h - 1), zb, zb + hh - 0.4, shade(body, 1.08), body, alpha);
    prism(ctx, rectPoly(p.x - p.w / 2 + cap / 2, p.y, cap, p.h), zb, zb + hh, C.metal, shade(C.metal, 0.8), alpha);
    prism(ctx, rectPoly(p.x + p.w / 2 - cap / 2, p.y, cap, p.h), zb, zb + hh, C.metal, shade(C.metal, 0.8), alpha);
  }

  function drawChip(ctx, f, Z, C) {
    const lift = Math.max(-1, (1 - easeOutBack(f)) * 70);
    const alpha = smooth(0, 0.25, f);
    const zb = BOARD_T + Z + lift;
    const landed = smooth(0.7, 1, f);
    fillPoly(ctx, rectPoly(CHIP.x + 5, CHIP.y - 5, CHIP.w + 6, CHIP.h + 6).map((q) => P(q[0], q[1], BOARD_T + Z + 0.2)), `rgba(10,14,26,${0.3 * alpha * landed})`);
    ctx.globalAlpha = alpha;
    const pinCol = rgba(C.metal, 1);
    for (const g of PIN_GRID) {
      const sides = [[CHIP.x + g, CHIP.y + CHIP.h / 2 + 3, 3.2, 8], [CHIP.x + g, CHIP.y - CHIP.h / 2 - 3, 3.2, 8],
        [CHIP.x + CHIP.w / 2 + 3, CHIP.y + g, 8, 3.2], [CHIP.x - CHIP.w / 2 - 3, CHIP.y + g, 8, 3.2]];
      for (const [x, y, pw, ph] of sides) fillPoly(ctx, rectPoly(x, y, pw, ph).map((q) => P(q[0], q[1], zb + 1.4)), pinCol);
    }
    ctx.globalAlpha = 1;
    prism(ctx, rectPoly(CHIP.x, CHIP.y, CHIP.w, CHIP.h), zb, zb + CHIP.hgt, shade(C.chip, 1.25), C.chip, alpha);
    ctx.globalAlpha = alpha;
    const zt = zb + CHIP.hgt + 0.05;
    fillPoly(ctx, circlePoly(CHIP.x - 22, CHIP.y + 22, 3, 12).map((q) => P(q[0], q[1], zt)), rgba(C.metal, 0.75));
    fillPoly(ctx, rectPoly(CHIP.x + 4, CHIP.y - 4, 34, 34).map((q) => P(q[0], q[1], zt)), "rgba(255,255,255,0.05)", "rgba(255,255,255,0.18)", 1);
    ctx.globalAlpha = 1;
  }

  function drawDevice(ctx, w, h, dpr, s, C, st) {
    if (st.board <= 0.001) return;
    const sc = view.scale;
    const Z = (1 - easeOutBack(st.board)) * 34;
    const boardA = smooth(0, 0.06, st.board);   // solid almost at once

    // ground shadow
    ctx.save();
    ctx.shadowColor = "rgba(8,12,24,0.38)";
    ctx.shadowBlur = 34 * dpr;
    ctx.shadowOffsetY = 10 * dpr;
    fillPoly(ctx, OUTLINE.map((q) => P(q[0], q[1], FLOOR_Z)), `rgba(10,14,28,${0.3 * boardA * (1 - 0.5 * clamp(Z / 60))})`);
    ctx.restore();

    // substrate
    prism(ctx, OUTLINE, Z, Z + BOARD_T, C.pcb, shade(C.pcb, 0.62), boardA, "rgba(255,255,255,.28)");
    const zt = Z + BOARD_T;

    // sensor electrodes
    const tr = st.traces;
    if (tr > 0.01) {
      const ea = smooth(0, 0.4, tr);
      ctx.globalAlpha = ea;
      LANES.forEach((y) => {
        fillPoly(ctx, circlePoly(ELX, y, 8.5, 20).map((q) => P(q[0], q[1], zt + 0.15)), rgba(C.metal, 1), "rgba(0,0,0,.25)", 1);
        fillPoly(ctx, circlePoly(ELX, y, 5, 18).map((q) => P(q[0], q[1], zt + 0.3)), rgba(C.copper, 1));
      });
      ctx.globalAlpha = 1;

      // component footprints
      const fp = smooth(0.2, 0.9, tr) * 0.6;
      const outlineRect = (cx, cy, rw, rh) => fillPoly(ctx, rectPoly(cx, cy, rw, rh).map((q) => P(q[0], q[1], zt + 0.2)), "rgba(255,255,255,0.0)", rgba(C.metal, fp), 1.2);
      outlineRect(CHIP.x, CHIP.y, CHIP.w + 8, CHIP.h + 8);
      PASSIVES.forEach((p) => outlineRect(p.x, p.y, p.w + 2, p.h + 4));

      // traces
      const traceCol = C.copper;
      const draw = (pts, frac, wd) => {
        strokePartial(ctx, pts, zt + 0.25, frac, wd + 1.4, shade(traceCol, 0.55), 0.55);
        strokePartial(ctx, pts, zt + 0.35, frac, wd, traceCol, 1);
      };
      LANE_TRACES.forEach((pts, i) => draw(pts, smooth(0, 0.6, tr - i * 0.08), 2.6));
      SIDE_TRACES.forEach((pts) => draw(pts, smooth(0.35, 1, tr), 2.2));
      draw(COIL_LEAD, smooth(0.35, 1, tr), 2.6);
    }

    // antenna coil: draws, then settles onto the board
    if (st.coil > 0.001) {
      const lift = Math.max(0, (1 - easeOutBack(clamp((st.coil - 0.35) / 0.65))) * 36);
      const cz = zt + 0.6 + lift;
      const frac = clamp(st.coil / 0.72);
      if (lift > 2) {
        strokePartial(ctx, COIL, zt + 0.3, frac, 3.2, C.ink, 0.1 * (lift / 36));
      }
      strokePartial(ctx, COIL, cz, frac, 4.6, shade(C.copper, 0.55), 0.7);
      strokePartial(ctx, COIL, cz + 0.1, frac, 3.2, C.copper, 1);
      if (frac > 0.98) {
        fillPoly(ctx, circlePoly(COIL_END[0], COIL_END[1], 5, 14).map((q) => P(q[0], q[1], cz + 0.2)), rgba(C.metal, 1), "rgba(0,0,0,.25)", 1);
      }
    }

    // components, far to near
    const parts = [];
    PASSIVES.forEach((p, k) => { if (st.pass[k] > 0.001) parts.push({ f: st.pass[k], p, d: P(p.x, p.y, 5)[2] }); });
    if (st.chip > 0.001) parts.push({ f: st.chip, chip: true, d: P(CHIP.x, CHIP.y, 5)[2] });
    parts.sort((a, b) => b.d - a.d);
    parts.forEach((q) => (q.chip ? drawChip(ctx, q.f, Z, C) : drawSMD(ctx, q.p, q.f, Z, C)));

    // signals
    const phase = s * 1.3;
    if (st.flow > 0.01) {
      LANE_TRACES.forEach((pts, i) => {
        for (let k = 0; k < 2; k++) {
          const u = phase * 0.9 + k * 0.5 + i * 0.23;
          const q = pointAlong(pts, u);
          const p = P(q[0], q[1], zt + 1.2);
          pulse(ctx, p[0], p[1], 3.4 * Math.max(0.8, sc * 0.7), C.accent, st.flow, C.ink);
        }
      });
    }
    if (st.live > 0.01) {
      const path = [...COIL_LEAD, ...COIL];
      for (let k = 0; k < 3; k++) {
        const q = pointAlong(path, phase * 0.5 + k / 3);
        const p = P(q[0], q[1], zt + 1.6);
        pulse(ctx, p[0], p[1], 3.4 * Math.max(0.8, sc * 0.7), C.accent, st.live, C.ink);
      }
      for (let k = 0; k < 3; k++) {
        const u = (phase * 0.6 + k / 3) % 1;
        const r = 12 + u * 150;
        const pts = Array.from({ length: 56 }, (_, i) => { const a = (i / 55) * Math.PI * 2; return P(COIL_CENTER[0] + r * Math.cos(a), COIL_CENTER[1] + r * Math.sin(a), zt + 0.5); });
        ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = rgba(C.accent, 0.5 * st.live * Math.pow(1 - u, 1.5));
        ctx.stroke();
      }
    }
  }

  /* ----------------------------------------------------------------- render */
  function render(ctx, w, h, dpr, s, C, reduce) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const mobile = w < 900;
    view.cx = mobile ? w * 0.5 : w * 0.7;
    view.cy = mobile ? h * 0.31 : h * 0.52;
    view.scale = mobile ? Math.min((w * 0.9) / 520, (h * 0.34) / 300) : Math.min((w * 0.46) / 520, (h * 0.64) / 300);
    view.yaw = reduce ? -0.35 : lerp(-0.62, 0.62, clamp(s / 4));
    const st = stages(s);
    drawGlows(ctx, w, h, s, C);
    drawFloor(ctx, st, C);
    drawWaves(ctx, w, h, s, C, st);
    drawDevice(ctx, w, h, dpr, s, C, st);
  }

  window.BuildScene = { render, stages };

  /* ------------------------------------------------------------- controller */
  const story = document.getElementById("story");
  const cv = document.getElementById("stage-canvas");
  if (!story || !cv) return;

  const stage = story.querySelector(".stage");
  const chapters = [...story.querySelectorAll(".chapter")];
  const rail = story.querySelector(".rail");
  let ctx = null;                       // 2D fallback context (made only if 3D is not used)
  let three = null;                     // 3D scene, when WebGL works
  const reduceMQ = matchMedia("(prefers-reduced-motion: reduce)");

  let reduce = reduceMQ.matches;
  let w = 0, h = 0, dpr = 1, colors = null, anchors = [];
  let sTarget = 0, sCur = 0, raf = 0, activeIdx = -1;

  const readColors = () => {
    const s = getComputedStyle(document.documentElement);
    const v = (n) => hexRGB(s.getPropertyValue(n));
    colors = {
      accent: v("--accent"), ink: v("--ink"), bg: v("--bg"), muted: v("--muted"),
      pcb: v("--pcb"), copper: v("--copper"), chip: v("--chip"), metal: v("--metal"), ceramic: v("--ceramic"),
      dark: document.documentElement.dataset.theme !== "light"
    };
  };

  function startThree() {
    if (!window.Scene3D || /[?&]2d\b/.test(location.search)) return;
    const c3 = document.createElement("canvas");
    c3.setAttribute("aria-hidden", "true");
    try {
      three = window.Scene3D.create(c3);
    } catch (e) { three = null; return; }
    cv.parentNode.insertBefore(c3, cv);
    cv.hidden = true;
    c3.addEventListener("webglcontextlost", (ev) => {
      ev.preventDefault();
      three = null; c3.remove(); cv.hidden = false;
      ctx = cv.getContext("2d"); measure(); request();
    });
  }

  function measure() {
    const r = stage.getBoundingClientRect();
    w = Math.round(r.width); h = Math.round(r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    /* keep the pixel count in check on big or very dense screens */
    const budget = 2300000;
    if (w * h * dpr * dpr > budget) dpr = Math.max(1, Math.sqrt(budget / (w * h)));
    if (three) three.resize(w, h, dpr);
    else {
      cv.width = Math.max(1, Math.round(w * dpr));
      cv.height = Math.max(1, Math.round(h * dpr));
    }

    const header = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 64;
    const sy = window.scrollY;
    anchors = chapters.map((c) => {
      const b = c.getBoundingClientRect();
      return b.top + sy + b.height / 2 - (header + h / 2);
    });
  }

  function target() {
    const y = window.scrollY, n = anchors.length;
    if (!n) return 0;
    if (y <= anchors[0]) return 0;
    if (y >= anchors[n - 1]) return n - 1;
    for (let i = 0; i < n - 1; i++) {
      if (y < anchors[i + 1]) return i + (y - anchors[i]) / Math.max(1, anchors[i + 1] - anchors[i]);
    }
    return n - 1;
  }

  function updateRail() {
    const idx = Math.round(sTarget);
    if (idx === activeIdx || !rail) return;
    activeIdx = idx;
    rail.querySelectorAll("a").forEach((a, i) => a.setAttribute("aria-current", String(i === idx)));
  }

  function paint(s) {
    if (!colors) readColors();
    const b = story.getBoundingClientRect();
    if (b.bottom < -50 || b.top > window.innerHeight + 50) return false;   // off screen
    if (three) three.render(s, colors, reduce, performance.now() / 1000);
    else render(ctx, w, h, dpr, s, colors, reduce);
    return true;
  }

  function frame() {
    raf = 0;
    sTarget = target();
    sCur += (sTarget - sCur) * 0.18;
    if (Math.abs(sTarget - sCur) < 0.0008) sCur = sTarget;
    const shown = paint(reduce ? chapters.length - 1 : sCur);
    updateRail();
    // keep going while the scroll is catching up, or while the data stream is on screen
    const live = shown && three && three.isLive(sCur);
    if (!reduce && (sCur !== sTarget || live)) raf = requestAnimationFrame(frame);
  }
  const request = () => { if (!raf) raf = requestAnimationFrame(frame); };

  function buildRail() {
    if (!rail) return;
    chapters.forEach((c, i) => {
      const a = document.createElement("a");
      a.href = "#" + c.id;
      const label = document.createElement("span");
      label.textContent = c.dataset.label || c.id;
      a.append(label);
      rail.append(a);
    });
  }

  function init() {
    startThree();
    if (!three) ctx = cv.getContext("2d");
    readColors();
    buildRail();
    measure();
    sTarget = target();
    sCur = sTarget;
    request();
  }

  window.addEventListener("scroll", request, { passive: true });
  window.addEventListener("pointermove", (e) => {
    if (!three || reduce || e.pointerType === "touch") return;
    three.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    request();
  }, { passive: true });
  window.addEventListener("load", () => { measure(); request(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); request(); });
  if (window.ResizeObserver) new ResizeObserver(() => { measure(); request(); }).observe(story);
  else window.addEventListener("resize", () => { measure(); request(); });
  document.addEventListener("themechange", () => { readColors(); request(); });
  reduceMQ.addEventListener && reduceMQ.addEventListener("change", () => { reduce = reduceMQ.matches; request(); });

  init();
})();
