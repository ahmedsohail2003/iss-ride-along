// G7: the dotted space scene behind the page, in the 3D view only (written new at this event, modelled on the look of
// Ahmed's RoBuff screenshots; nothing opened or copied from it). Background art, not data: a large dotted Moon cut
// off by the right edge (dots on a sphere, darker round patches), a small dotted ringed planet, a few dust clouds and
// star specks in three depth layers. One plain 2D canvas (#bg-scene, no second WebGL context), fixed behind the
// page, aria-hidden, pointer-events none. The layers ease toward an offset set by the mouse (near layers move more:
// parallax); the Moon and the planet turn slowly. Touch: the slow turn only. prefers-reduced-motion: one still frame.
// Hidden tab, flat page, story on: nothing is drawn. The scene is cleared behind every line of text on the page, so
// no text is ever drawn over a dot (its contrast stays the one tests/globe.test.ts checks).
import { isSoftwareRenderer } from '../globe/view';

export const BG_ON = true;

export interface P3 {
  x: number;
  y: number;
  z: number;
}

/** A small seeded random number generator (mulberry32), so the scene is the same on every load. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** n points spread evenly on the unit sphere (a Fibonacci lattice). */
export function fibSphere(n: number): P3[] {
  const out: P3[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    out.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r });
  }
  return out;
}

/** The Moon's darker round patches (the maria, roughly placed): [latitude deg, longitude deg, radius deg]. */
export const MOON_PATCHES: [number, number, number][] = [
  [20, -15, 16],
  [8, 22, 13],
  [-12, -35, 14],
  [32, 15, 9],
  [-20, 40, 10],
  [45, -55, 8],
  [-38, 5, 7],
];

/** Dotted Moon: unit-sphere points, each with a shade (1 for bright ground, lower inside a dark patch). */
export function moonPoints(n: number): { p: P3; shade: number }[] {
  const centres = MOON_PATCHES.map(([lat, lon, r]) => {
    const la = (lat * Math.PI) / 180;
    const lo = (lon * Math.PI) / 180;
    return { c: { x: Math.cos(la) * Math.sin(lo), y: Math.sin(la), z: Math.cos(la) * Math.cos(lo) }, cosR: Math.cos((r * Math.PI) / 180) };
  });
  return fibSphere(n).map((p) => {
    const inPatch = centres.some(({ c, cosR }) => p.x * c.x + p.y * c.y + p.z * c.z > cosR);
    return { p, shade: inPatch ? 0.35 : 1 };
  });
}

/** n points on a flat ring (in the x-z plane) between the radii inner and outer (planet radius = 1). */
export function ringPoints(n: number, inner: number, outer: number, rand: () => number): P3[] {
  const out: P3[] = [];
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2;
    const r = inner + (outer - inner) * Math.sqrt(rand());
    out.push({ x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r });
  }
  return out;
}

/** n points of a loose dust cloud: a stretched Gaussian blob, x and y in units of its own size. */
export function cloudPoints(n: number, stretch: number, rand: () => number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const u = Math.max(rand(), 1e-9);
    const g = Math.sqrt(-2 * Math.log(u));
    const a = rand() * Math.PI * 2;
    out.push({ x: g * Math.cos(a) * stretch * 0.35, y: g * Math.sin(a) * 0.35 });
  }
  return out;
}

/** n star specks with x and y in [0, 1) and a brightness in [0.25, 1). */
export function starPoints(n: number, rand: () => number): { x: number; y: number; b: number }[] {
  const out: { x: number; y: number; b: number }[] = [];
  for (let i = 0; i < n; i++) out.push({ x: rand(), y: rand(), b: 0.25 + 0.75 * rand() * rand() });
  return out;
}

/** How far each layer moves for the pointer at the window's edge, in CSS pixels times its depth. */
export const MAX_SHIFT = 34;
/** Depth of each layer: 0 never moves, 1 moves the most (the nearest). */
export const DEPTH = { farStars: 0.12, midStars: 0.3, dust: 0.45, moon: 0.55, planet: 0.7, nearStars: 1 } as const;

/**
 * The parallax offset of one layer for the pointer at (px, py) in a w x h window: 0 at the centre, growing with
 * the pointer's distance from it, larger for a nearer layer (bigger depth), and 0 for every layer when reduced
 * motion is on. The layer moves against the pointer, as near things do when the eye moves.
 */
export function parallaxOffset(px: number, py: number, w: number, h: number, depth: number, reduced: boolean): { x: number; y: number } {
  if (reduced || w <= 0 || h <= 0) return { x: 0, y: 0 };
  const nx = Math.max(-1, Math.min(1, (px - w / 2) / (w / 2)));
  const ny = Math.max(-1, Math.min(1, (py - h / 2) / (h / 2)));
  // + 0 turns a -0 into 0
  return { x: -nx * MAX_SHIFT * depth + 0, y: -ny * MAX_SHIFT * 0.6 * depth + 0 };
}

/** Move cur toward target by the share of the way an exponential ease covers in dt seconds (never past it). */
export function ease(cur: number, target: number, dt: number, tau = 0.25): number {
  if (!(dt > 0)) return cur;
  const k = 1 - Math.exp(-dt / Math.max(tau, 1e-6));
  return cur + (target - cur) * k;
}

/** The light on the Moon and the planet comes from the upper left, a little toward the viewer. */
const LIGHT = (() => {
  const v = { x: -0.62, y: -0.42, z: 0.66 };
  const m = Math.hypot(v.x, v.y, v.z);
  return { x: v.x / m, y: v.y / m, z: v.z / m };
})();

interface Layout {
  w: number;
  h: number;
  moon: { cx: number; cy: number; r: number };
  planet: { cx: number; cy: number; r: number };
  clouds: { cx: number; cy: number; size: number; stretch: number; tilt: number; n: number; seed: number }[];
}

/**
 * Where everything sits. The Moon is cut off by the right edge, behind the planner column; on a wide screen it is
 * made big enough to reach about 220 px past that column's left side, so its limb shows in the open space beside the
 * headline (sideLeft: the planner column's left edge, or the window's right edge when it is not known).
 */
function layoutFor(w: number, h: number, sideLeft = w): Layout {
  const narrow = w < 700;
  const r = narrow ? Math.max(w * 0.62, 200) : Math.min(Math.max((w - sideLeft + 220) / 0.9, h * 0.62, 220), h * 0.95);
  return {
    w,
    h,
    moon: { cx: w + r * (narrow ? 0.35 : 0.1), cy: h * (narrow ? 0.62 : 0.27), r },
    planet: narrow ? { cx: w * 0.78, cy: h * 0.16, r: 13 } : { cx: Math.min(w * 0.44, w + r * 0.1 - r - 90), cy: h * 0.31, r: Math.max(14, Math.min(20, w * 0.015)) },
    clouds: [
      { cx: w * 0.36, cy: h * 0.86, size: Math.min(w, h) * 0.28, stretch: 2.6, tilt: -0.35, n: 900, seed: 11 },
      { cx: w * 0.63, cy: h * 0.18, size: Math.min(w, h) * 0.18, stretch: 2.2, tilt: 0.25, n: 500, seed: 23 },
      { cx: w * 0.12, cy: h * 0.42, size: Math.min(w, h) * 0.16, stretch: 1.8, tilt: 0.8, n: 380, seed: 37 },
    ],
  };
}

export interface SceneApi {
  canvas: HTMLCanvasElement;
  stop: () => void;
}

/** Mount the scene: a canvas appended to body, drawn only while body[data-view="3d"] and the story is off. */
export function mountScene(doc: Document = document): SceneApi | null {
  if (!BG_ON) return null;
  const win = doc.defaultView!;
  const canvas = doc.createElement('canvas');
  canvas.id = 'bg-scene';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.className = 'no-print';
  doc.body.append(canvas);
  doc.body.classList.add('bg-on');
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const reducedQuery = win.matchMedia?.('(prefers-reduced-motion: reduce)');
  const reduced = () => !!reducedQuery?.matches;

  // ---- the point sets (made once)
  const moon = moonPoints(18000);
  const planetPts = fibSphere(700);
  const ring = ringPoints(900, 1.45, 2.3, seeded(5));
  const stars = {
    far: starPoints(260, seeded(101)),
    mid: starPoints(130, seeded(202)),
    near: starPoints(45, seeded(303)),
  };

  let L = layoutFor(1, 1);
  let dpr = 1;
  // offscreen layers, drawn once per resize (stars and dust) or a few times a second (Moon and planet)
  const mk = () => doc.createElement('canvas');
  const layers = { far: mk(), mid: mk(), near: mk(), dust: mk(), moon: mk(), planet: mk() };
  const PAD = MAX_SHIFT + 8;

  function sized(c: HTMLCanvasElement, w: number, h: number) {
    c.width = Math.ceil(w * dpr);
    c.height = Math.ceil(h * dpr);
    const g = c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    return g;
  }

  function drawStars(c: HTMLCanvasElement, pts: { x: number; y: number; b: number }[], size: number, alpha: number) {
    const w = L.w + 2 * PAD;
    const h = L.h + 2 * PAD;
    const g = sized(c, w, h);
    for (const s of pts) {
      g.fillStyle = `rgba(255,255,255,${(alpha * s.b).toFixed(3)})`;
      const d = size * (0.6 + 0.6 * s.b);
      g.fillRect(s.x * w, s.y * h, d, d);
    }
  }

  function drawDust() {
    const w = L.w + 2 * PAD;
    const h = L.h + 2 * PAD;
    const g = sized(layers.dust, w, h);
    for (const cl of L.clouds) {
      const pts = cloudPoints(cl.n, cl.stretch, seeded(cl.seed));
      const cs = Math.cos(cl.tilt);
      const sn = Math.sin(cl.tilt);
      const rand = seeded(cl.seed + 1);
      for (const p of pts) {
        const x = (p.x * cs - p.y * sn) * cl.size + cl.cx + PAD;
        const y = (p.x * sn + p.y * cs) * cl.size + cl.cy + PAD;
        g.fillStyle = `rgba(255,255,255,${(0.12 + 0.3 * rand()).toFixed(3)})`;
        g.fillRect(x, y, 1, 1);
      }
    }
  }

  let moonImg: ImageData | null = null;
  /** Halftone sphere: the visible half of a turning point set, each dot sized by its light. */
  function drawMoon(turn: number) {
    const { r } = L.moon;
    const size = 2 * r + 8;
    const g = sized(layers.moon, size, size);
    // written as pixels (one putImageData), not thousands of fillRect calls: cheap on any renderer
    const W = layers.moon.width;
    const H = layers.moon.height;
    if (!moonImg || moonImg.width !== W || moonImg.height !== H) moonImg = g.createImageData(W, H);
    const img = moonImg;
    const px = img.data;
    px.fill(0);
    const c = Math.cos(turn);
    const s = Math.sin(turn);
    const tilt = 0.32;
    const ct = Math.cos(tilt);
    const st = Math.sin(tilt);
    for (const { p, shade } of moon) {
      // turn about y, then tilt about x
      const x1 = p.x * c + p.z * s;
      const z1 = -p.x * s + p.z * c;
      const y2 = p.y * ct - z1 * st;
      const z2 = p.y * st + z1 * ct;
      if (z2 <= 0.02) continue;
      const lit = Math.max(0, x1 * LIGHT.x + y2 * LIGHT.y + z2 * LIGHT.z);
      const b = (0.18 + 0.82 * lit) * shade;
      if (b < 0.08) continue;
      const d = Math.max(1, Math.round((0.6 + 1.9 * b) * dpr));
      const a = Math.round(255 * Math.min(0.85, 0.2 + 0.7 * b));
      const x0 = Math.round((size / 2 + x1 * r) * dpr - d / 2);
      const y0 = Math.round((size / 2 + y2 * r) * dpr - d / 2);
      for (let yy = y0; yy < y0 + d; yy++) {
        if (yy < 0 || yy >= H) continue;
        for (let xx = x0; xx < x0 + d; xx++) {
          if (xx < 0 || xx >= W) continue;
          const i = (yy * W + xx) * 4;
          if (px[i + 3] < a) {
            px[i] = 255;
            px[i + 1] = 255;
            px[i + 2] = 255;
            px[i + 3] = a;
          }
        }
      }
    }
    g.putImageData(img, 0, 0);
  }

  function drawPlanet(turn: number) {
    const { r } = L.planet;
    const size = Math.ceil(r * 5.4);
    const g = sized(layers.planet, size, size);
    const tilt = 0.42;
    const ct = Math.cos(tilt);
    const st = Math.sin(tilt);
    const c = Math.cos(turn);
    const s = Math.sin(turn);
    const proj = (p: P3) => {
      const x1 = p.x * c + p.z * s;
      const z1 = -p.x * s + p.z * c;
      return { x: x1, y: p.y * ct - z1 * st, z: p.y * st + z1 * ct };
    };
    const ox = size / 2;
    const oy = size / 2;
    g.fillStyle = '#ffffff';
    // the ring's far half, then the planet, then the ring's near half
    const ringP = ring.map(proj);
    for (const q of ringP) {
      if (q.z >= 0) continue;
      const hidden = q.x * q.x + q.y * q.y < 1;
      if (hidden) continue;
      g.globalAlpha = 0.45;
      g.fillRect(ox + q.x * r, oy + q.y * r, 1, 1);
    }
    for (const p of planetPts) {
      const q = proj(p);
      if (q.z <= 0) continue;
      const lit = Math.max(0, q.x * LIGHT.x + q.y * LIGHT.y + q.z * LIGHT.z);
      const b = 0.2 + 0.8 * lit;
      g.globalAlpha = Math.min(0.9, 0.25 + 0.65 * b);
      g.fillRect(ox + q.x * r, oy + q.y * r, 1.2, 1.2);
    }
    for (const q of ringP) {
      if (q.z < 0) continue;
      g.globalAlpha = 0.6;
      g.fillRect(ox + q.x * r, oy + q.y * r, 1.1, 1.1);
    }
    g.globalAlpha = 1;
  }

  // ---- where the text is: the scene is cleared behind every line of text on screen
  let textRects: DOMRect[] = [];
  const range = doc.createRange();
  const app = doc.getElementById('app') ?? doc.body;
  // the scroll position when the text was measured: between measurements the boxes move with the page
  let measuredScroll = { x: 0, y: 0 };
  function measureText() {
    const out: DOMRect[] = [];
    const vh = L.h;
    // look one window above and below, so text scrolled in before the next measurement is covered too
    const near = (r: DOMRect) => r.bottom > -vh && r.top < 2 * vh;
    // skip hidden subtrees and whole blocks far off screen (most of a long page), so a measurement stays cheap
    const walker = doc.createTreeWalker(app, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (n.nodeType === 3) return NodeFilter.FILTER_ACCEPT;
        const el = n as HTMLElement;
        if (el.hidden || el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'svg') return NodeFilter.FILTER_REJECT;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return el.getClientRects().length ? NodeFilter.FILTER_SKIP : NodeFilter.FILTER_REJECT;
        if (!near(r)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_SKIP;
      },
    });
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.nodeType !== 3 || !n.nodeValue || !n.nodeValue.trim()) continue;
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0 && near(r)) out.push(r);
    }
    // form fields show text that is not a text node (values, placeholders)
    for (const el of app.querySelectorAll('input, select, textarea')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && near(r)) out.push(r);
    }
    textRects = out;
    measuredScroll = { x: win.scrollX, y: win.scrollY };
    textDirty = false;
  }
  let textDirty = true;

  function resize() {
    const w = win.innerWidth;
    const h = win.innerHeight;
    dpr = Math.min(win.devicePixelRatio || 1, 1.5);
    canvas.width = Math.ceil(w * dpr);
    canvas.height = Math.ceil(h * dpr);
    const side = doc.querySelector('aside.side')?.getBoundingClientRect();
    L = layoutFor(w, h, side && side.width > 0 && side.left > w * 0.4 ? side.left : w);
    drawStars(layers.far, stars.far, 1, 0.55);
    drawStars(layers.mid, stars.mid, 1.4, 0.7);
    drawStars(layers.near, stars.near, 2, 0.85);
    drawDust();
    moonTurnDrawn = NaN;
    textDirty = true;
    still = false;
  }

  // ---- the pointer (mouse and pen only; touch screens get the slow turn alone)
  let target = { x: win.innerWidth / 2, y: win.innerHeight / 2 };
  let eased = { ...target };
  win.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    target = { x: e.clientX, y: e.clientY };
  }, { passive: true });
  doc.documentElement.addEventListener('pointerleave', () => {
    target = { x: win.innerWidth / 2, y: win.innerHeight / 2 };
  });
  win.addEventListener('resize', resize);
  win.addEventListener('scroll', () => { scrolled = true; still = false; }, { passive: true });
  let scrolled = false;

  let moonTurnDrawn = NaN;
  let still = false;
  let last = performance.now();
  let lastMeasure = 0;
  let frame = 0;
  let raf = 0;
  let lastParallax = '';
  let lastRm = false;

  function active() {
    const b = doc.body;
    return b.dataset.view === '3d' && !b.classList.contains('story-on') && !doc.hidden;
  }

  function draw(now: number) {
    raf = win.requestAnimationFrame(draw);
    if (!canvas.isConnected) {
      win.cancelAnimationFrame(raf);
      return;
    }
    // at most 30 frames a second (the scene moves slowly, so half the frames leave the globe more room), and 8 a second
    // on a software renderer (the globe and the scene share one CPU there; the auto view keeps such devices flat)
    const software = isSoftwareRenderer(doc.getElementById('globe')?.dataset.renderer ?? '');
    if (now - last < (software ? 125 : 30) && !reduced()) return;
    const dt = Math.min(0.2, (now - last) / 1000);
    last = now;
    if (!active()) {
      still = false;
      return;
    }
    const rm = reduced();
    if (rm !== lastRm) {
      lastRm = rm;
      still = false;
    }
    if (now - lastMeasure > 500 || (scrolled && now - lastMeasure > 200)) {
      lastMeasure = now;
      scrolled = false;
      textDirty = true;
    }
    if (rm && still && !textDirty) return;
    if (textDirty) {
      const before = textRects.map((r) => `${r.x},${r.y},${r.width},${r.height}`).join(';');
      measureText();
      const after = textRects.map((r) => `${r.x},${r.y},${r.width},${r.height}`).join(';');
      if (rm && still && before === after) return;
    }
    frame++;
    const t = rm ? 0 : now / 1000;
    if (!rm) {
      eased = { x: ease(eased.x, target.x, dt), y: ease(eased.y, target.y, dt) };
    } else {
      eased = { x: L.w / 2, y: L.h / 2 };
    }
    const off = (depth: number) => parallaxOffset(eased.x, eased.y, L.w, L.h, depth, rm);
    const near = off(DEPTH.nearStars);
    const p = `${near.x.toFixed(1)},${near.y.toFixed(1)}`;
    if (p !== lastParallax) {
      canvas.dataset.parallax = p;
      lastParallax = p;
    }
    // the slow drift: the Moon and the planet turn; the stars sway a few pixels
    const moonTurn = rm ? 0.6 : 0.6 + t * 0.035;
    if (!(Math.abs(moonTurn - moonTurnDrawn) < 0.004) && (rm || frame % 4 === 1 || isNaN(moonTurnDrawn))) {
      drawMoon(moonTurn);
      drawPlanet(rm ? 0.3 : 0.3 + t * 0.12);
      moonTurnDrawn = moonTurn;
    }
    const sway = rm ? 0 : Math.sin(t / 7) * 3;

    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx!.clearRect(0, 0, L.w, L.h);
    const put = (c: HTMLCanvasElement, x: number, y: number, w: number, h: number) => ctx!.drawImage(c, x, y, w, h);
    const fw = L.w + 2 * PAD;
    const fh = L.h + 2 * PAD;
    let o = off(DEPTH.farStars);
    put(layers.far, -PAD + o.x + sway * 0.3, -PAD + o.y, fw, fh);
    o = off(DEPTH.midStars);
    put(layers.mid, -PAD + o.x + sway * 0.6, -PAD + o.y, fw, fh);
    o = off(DEPTH.dust);
    put(layers.dust, -PAD + o.x + sway, -PAD + o.y, fw, fh);
    o = off(DEPTH.moon);
    const ms = 2 * L.moon.r + 8;
    put(layers.moon, L.moon.cx - ms / 2 + o.x, L.moon.cy - ms / 2 + o.y, ms, ms);
    o = off(DEPTH.planet);
    const ps = Math.ceil(L.planet.r * 5.4);
    put(layers.planet, L.planet.cx - ps / 2 + o.x, L.planet.cy - ps / 2 + o.y, ps, ps);
    o = off(DEPTH.nearStars);
    put(layers.near, -PAD + o.x + sway * 1.4, -PAD + o.y, fw, fh);
    // clear the scene behind every line of text (6 px around it)
    const sx = measuredScroll.x - win.scrollX;
    const sy = measuredScroll.y - win.scrollY;
    for (const r of textRects) ctx!.clearRect(r.x + sx - 6, r.y + sy - 6, r.width + 12, r.height + 12);
    still = true;
  }

  resize();
  raf = win.requestAnimationFrame(draw);
  return {
    canvas,
    stop: () => {
      win.cancelAnimationFrame(raf);
      canvas.remove();
    },
  };
}
