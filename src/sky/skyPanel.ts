// X5: the "Sky from the station" tab. A round star chart of everything above the station's own horizon
// right now (centre = straight up, away from Earth), the constellation lines and names, the brightest
// stars named, and the station's "in sunlight" / "in Earth's shadow" label (the same function as the map
// marker, src/orbit/daynight.ts). Redrawn every second while the tab is open: the station's sky turns
// about 4 degrees a minute, one full turn per orbit. The math is in ./sky.ts; this file only draws.
// X5b: the chart can be dragged, zoomed (30 to 180 degrees across) and tapped; the projection and the drag
// math are in ./projection.ts. "Back to the station's view" brings back the fixed X5 chart, which follows
// the station again.
import type { SatRec } from 'satellite.js';
import starsData from '../data/sky/stars.json';
import linesData from '../data/sky/lines.json';
import namesData from '../data/sky/names.json';
import { stateAt, sunEciKm } from '../orbit/orbit';
import { sunlightLabel } from '../orbit/daynight';
import { apply, temeToJ2000Matrix } from '../orbit/frames';
import { compass8 } from '../ui/sentence';
import { CREDIT_SKY } from '../nasa/credits';
import { earthEdgeDipDeg, horizontal, horizontalOfVec, raDecToVec, starRadius, stationSky, vecToRaDec, type StarRow } from './sky';
import { angleDeg, dragView, FOV_MAX, norm, project, stationView, zoomFov, type View } from './projection';
import type { Vec3 } from '../orbit/frames';

const STARS = starsData as unknown as StarRow[];
const LINES = linesData as unknown as Record<string, [number, number][][]>;
const NAMES = namesData as unknown as [string, string, number, number, number][];
/** Stars named on the chart: brighter than magnitude 1.5, plus Polaris (the pole star). */
const LABEL_MAG = 1.5;

export const skyPanelHtml = `
  <section class="card sky-card" aria-labelledby="sky-h">
    <h2 id="sky-h">The sky from the station, right now</h2>
    <p class="small">The stars above the station at this moment, looking straight away from Earth. This is computed, not a photo:
      nobody outside NASA controls the station's cameras. In the station's view (the one shown first) the centre is straight up from the station and the edge is the station's
      own horizon; the Earth's edge is about <span id="sky-dip">20</span>° below that, so everything in the circle is open sky.
      North is at the top and east on the left, as on a star chart held over your head.</p>
    <p class="sky-sun">Station: <strong id="sky-sunlit">-</strong>. <span class="small">Stars show to a camera only when the station is in
      Earth's shadow; in sunlight the glare hides them.</span></p>
    <p class="small" id="sky-how">Drag to look around the whole sky, scroll or pinch to zoom, tap or click a star or a constellation line for its name.
      Keyboard: Tab to the chart, then the arrow keys turn it and + and − zoom.</p>
    <div class="sky-wrap"><canvas id="sky-canvas" width="480" height="480" tabindex="0" role="application" aria-describedby="sky-how" aria-label="Star chart of the sky above the station"></canvas></div>
    <p class="sky-controls"><button type="button" id="sky-reset">Back to the station's view</button> <span id="sky-view" class="small">-</span></p>
    <p id="sky-picked" class="sky-picked" aria-live="polite"></p>
    <p id="sky-zenith" class="small">-</p>
    <p id="sky-bright" class="small">-</p>
    <p class="small sky-credit" id="sky-credit"></p>
  </section>`;

export interface SkyPanel {
  /** Draw now (call when the tab opens). */
  draw(): void;
}

const fmt1 = (x: number) => x.toFixed(1);
function raHours(raDeg: number): string {
  const totalMin = Math.round((raDeg / 15) * 60) % (24 * 60);
  return `${Math.floor(totalMin / 60)} h ${String(totalMin % 60).padStart(2, '0')} min`;
}

/** Star colour from its B-V colour index (blue-white for hot stars, orange for cool ones). */
function starColour(bv: number | null): string {
  if (bv === null) return '#ffffff';
  if (bv < 0) return '#cfe0ff';
  if (bv < 0.4) return '#f4f7ff';
  if (bv < 0.8) return '#fff6dd';
  if (bv < 1.3) return '#ffe2b0';
  return '#ffc58a';
}

// X5b: the catalogue as unit vectors, once (the chart projects them on every drag step).
const DEG = 180 / Math.PI;
const STAR_VECS: Vec3[] = STARS.map(([ra, dec]) => raDecToVec(ra, dec));
const LINE_VECS: [string, Vec3[][]][] = Object.entries(LINES).map(([id, pls]) => [id, pls.map((pl) => pl.map(([ra, dec]) => raDecToVec(ra, dec)))]);
const NAME_OF = new Map(NAMES.map(([id, name]) => [id, name]));
const vdot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
/** A point on the circle of the station's sky at height `altDeg`, compass `azDeg` (0 = north, 90 = east). */
function skyPoint(up: Vec3, north: Vec3, east: Vec3, altDeg: number, azDeg: number): Vec3 {
  const [sa, ca, sz, cz] = [Math.sin(altDeg / DEG), Math.cos(altDeg / DEG), Math.sin(azDeg / DEG), Math.cos(azDeg / DEG)];
  return { x: up.x * sa + ca * (north.x * cz + east.x * sz), y: up.y * sa + ca * (north.y * cz + east.y * sz), z: up.z * sa + ca * (north.z * cz + east.z * sz) };
}

type Picked = { kind: 'star'; i: number } | { kind: 'figure'; id: string } | null;

export function initSkyPanel(opts: { getSatrec: () => SatRec; isOpen: () => boolean }): SkyPanel {
  const canvas = document.getElementById('sky-canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');
  const resetBtn = document.getElementById('sky-reset') as HTMLButtonElement;
  const pickedEl = document.getElementById('sky-picked')!;
  const viewEl = document.getElementById('sky-view')!;
  document.getElementById('sky-credit')!.textContent = CREDIT_SKY;

  // X5b: the view. While `follow` is on, the camera is the station's own view (straight up, north up), rebuilt
  // on every draw, so it keeps moving with the station; the first drag or arrow key turns `follow` off and the
  // camera then stays fixed on the stars until "Back to the station's view".
  let follow = true;
  let fov = FOV_MAX;
  let view: View | null = null;
  let R = 222; // chart radius in CSS px, set on each draw
  let picked: Picked = null;
  /** What the last draw put on the chart, in CSS px from its middle: the stars and the line pieces (for tap to name). */
  let shownStars: { i: number; x: number; y: number }[] = [];
  let shownSegs: { id: string; x0: number; y0: number; x1: number; y1: number }[] = [];
  let lastAlt: Map<number, number> = new Map();

  function draw() {
    if (!ctx) return;
    const now = new Date();
    const s = stateAt(opts.getSatrec(), now);
    if (!s) return;
    const sky = stationSky(now, s.latDeg, s.lonDeg);
    if (follow || !view) view = stationView(sky.up, sky.north, sky.east);
    const v = view;

    // Size the canvas to its box (sharp on high-density screens).
    const css = Math.max(200, Math.round(canvas.getBoundingClientRect().width || 480));
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(css * dpr)) {
      canvas.width = Math.round(css * dpr);
      canvas.height = Math.round(css * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const c = css / 2;
    R = c - 18; // room for the compass letters
    ctx.clearRect(0, 0, css, css);
    const P = (d: Vec3) => project(d, v, fov, R);
    const inDisc = (p: { x: number; y: number } | null): p is { x: number; y: number } => !!p && p.x * p.x + p.y * p.y <= R * R;
    // The Earth's edge is `dip` degrees below the station's horizon; stars beyond it are hidden by Earth.
    const dip = earthEdgeDipDeg(s.altKm);
    const minUp = -Math.sin(dip / DEG);

    // The sky disc.
    ctx.fillStyle = '#050b1f';
    ctx.beginPath();
    ctx.arc(c, c, R, 0, 2 * Math.PI);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(c, c, R, 0, 2 * Math.PI);
    ctx.clip();

    // A circle of the station's sky at one height, sampled (every sky circle is a circle on this chart).
    const ring = (altDeg: number): ({ x: number; y: number } | null)[] => {
      const pts = [];
      for (let k = 0; k <= 120; k++) pts.push(P(skyPoint(sky.up, sky.north, sky.east, altDeg, k * 3)));
      return pts;
    };
    const strokeRing = (pts: ({ x: number; y: number } | null)[]) => {
      ctx.beginPath();
      let prev: { x: number; y: number } | null = null;
      for (const p of pts) {
        if (p && prev && Math.hypot(p.x - prev.x, p.y - prev.y) < 4 * R) ctx.lineTo(c + p.x, c + p.y);
        else if (p) ctx.moveTo(c + p.x, c + p.y);
        prev = p;
      }
      ctx.stroke();
    };

    // The Earth (only on the chart once the view is turned towards the station's horizon): the cap more than
    // `dip` below the horizon. On screen it is inside its edge circle, or outside it when the point straight
    // behind the view is under the Earth (then the edge circle is drawn around the open sky).
    const edge = ring(-dip);
    if (edge.every((p) => p)) {
      ctx.fillStyle = '#16263a';
      ctx.beginPath();
      if (vdot(v.f, sky.up) > Math.sin(dip / DEG)) ctx.rect(0, 0, css, css);
      edge.forEach((p, k) => (k ? ctx.lineTo(c + p!.x, c + p!.y) : ctx.moveTo(c + p!.x, c + p!.y)));
      ctx.closePath();
      ctx.fill('evenodd');
      const nadir = P({ x: -sky.up.x, y: -sky.up.y, z: -sky.up.z });
      if (inDisc(nadir)) {
        ctx.fillStyle = 'rgba(160, 200, 230, 0.8)';
        ctx.font = '12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Earth (hides the stars behind it)', c + nadir.x, c + nadir.y);
      }
    }
    // Rings at 30 and 60 degrees up, and the station's horizon.
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(127, 219, 255, 0.18)';
    strokeRing(ring(30));
    strokeRing(ring(60));
    ctx.strokeStyle = 'rgba(127, 219, 255, 0.6)';
    strokeRing(ring(0));

    // Constellation lines: a piece is drawn when both its ends are open sky (not behind the Earth). The counts in
    // the words below are of pieces above the station's horizon, whatever the view.
    let segments = 0;
    const figuresUp = new Set<string>();
    const figuresInView = new Set<string>();
    shownSegs = [];
    for (const [id, polylines] of LINE_VECS) {
      const hi = picked?.kind === 'figure' && picked.id === id;
      ctx.strokeStyle = hi ? 'rgba(255, 209, 102, 0.95)' : 'rgba(127, 219, 255, 0.45)';
      ctx.lineWidth = hi ? 2 : 1;
      for (const pl of polylines) {
        let prevV: Vec3 | null = null;
        let prevP: { x: number; y: number } | null = null;
        for (const d of pl) {
          const p = vdot(d, sky.up) >= minUp ? P(d) : null;
          if (prevV && vdot(prevV, sky.up) >= 0 && vdot(d, sky.up) >= 0) {
            segments++;
            figuresUp.add(id);
          }
          if (p && prevP && (inDisc(p) || inDisc(prevP))) {
            ctx.beginPath();
            ctx.moveTo(c + prevP.x, c + prevP.y);
            ctx.lineTo(c + p.x, c + p.y);
            ctx.stroke();
            figuresInView.add(id);
            shownSegs.push({ id, x0: prevP.x, y0: prevP.y, x1: p.x, y1: p.y });
          }
          prevV = d;
          prevP = p;
        }
      }
    }
    ctx.lineWidth = 1;

    // Constellation names (the better-known ones, rank 1 and 2, and the one tapped).
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const [id, name, ra, dec, rank] of NAMES) {
      const hi = picked?.kind === 'figure' && picked.id === id;
      if ((rank > 2 && !hi) || !figuresInView.has(id)) continue;
      const p = P(raDecToVec(ra, dec));
      if (!inDisc(p)) continue;
      ctx.fillStyle = hi ? '#ffd166' : 'rgba(160, 200, 230, 0.75)';
      ctx.fillText(name, c + p.x, c + p.y);
    }

    // Stars: size by magnitude, colour by B-V; the brightest named.
    let drawn = 0;
    const labelBoxes: { x: number; y: number; w: number; h: number }[] = [];
    const above: { name: string; mag: number; alt: number; az: number }[] = [];
    const brightInView: { name: string; mag: number; x: number; y: number }[] = [];
    shownStars = [];
    lastAlt = new Map();
    ctx.textAlign = 'left';
    for (let i = 0; i < STARS.length; i++) {
      const [ra, dec, mag, , bv, name] = STARS[i];
      const upDot = vdot(STAR_VECS[i], sky.up);
      if (upDot >= 0) {
        drawn++;
        if (name) {
          const h = horizontal(sky, ra, dec);
          above.push({ name, mag, alt: h.altDeg, az: h.azDeg });
        }
      }
      if (upDot < minUp) continue;
      const p = P(STAR_VECS[i]);
      if (!inDisc(p)) continue;
      shownStars.push({ i, x: p.x, y: p.y });
      lastAlt.set(i, Math.asin(Math.max(-1, Math.min(1, upDot))) * DEG);
      ctx.fillStyle = starColour(bv);
      ctx.beginPath();
      ctx.arc(c + p.x, c + p.y, starRadius(mag), 0, 2 * Math.PI);
      ctx.fill();
      if (name && (mag <= LABEL_MAG || name === 'Polaris')) {
        brightInView.push({ name, mag, x: Math.round((c + p.x) * 10) / 10, y: Math.round((c + p.y) * 10) / 10 });
        // Skip a name that would overlap one already written (stars are drawn brightest first).
        const box = { x: c + p.x + 5, y: c + p.y - 14, w: ctx.measureText(name).width, h: 12 };
        if (!labelBoxes.some((b) => box.x < b.x + b.w && b.x < box.x + box.w && box.y < b.y + b.h && b.y < box.y + box.h)) {
          labelBoxes.push(box);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(name, c + p.x + 5, c + p.y - 4);
        }
      }
      if (picked?.kind === 'star' && picked.i === i) {
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(c + p.x, c + p.y, starRadius(mag) + 5, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.lineWidth = 1;
      }
    }

    // The Sun, when it is open sky from the station (only ever while the station is in sunlight).
    const sunV = apply(temeToJ2000Matrix(now), sunEciKm(now));
    const sunH = horizontalOfVec(sky, sunV);
    const sp = sunH.altDeg >= -dip ? P(norm(sunV)) : null;
    if (inDisc(sp)) {
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(c + sp.x, c + sp.y, 7, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillText('Sun', c + sp.x + 9, c + sp.y + 4);
    }
    ctx.restore();

    // The chart's edge and the compass letters where the station's horizon meets it (north up, east left in the
    // station's view: the sky seen from below).
    ctx.strokeStyle = 'rgba(127, 219, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(c, c, R, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = '#cfe0ff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const [t, az] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]] as const) {
      const p = P(skyPoint(sky.up, sky.north, sky.east, 0, az));
      const r = p ? Math.hypot(p.x, p.y) : Infinity;
      if (!p || r > R + 0.5) continue;
      const out = r > 1e-6 ? (r + 10) / r : 0;
      ctx.fillText(t, c + p.x * out, c + p.y * out);
    }
    ctx.textBaseline = 'alphabetic';

    // Words for everyone (and for screen readers): the label, straight up, the brightest stars up now.
    const sun = sunlightLabel(opts.getSatrec(), now);
    const sunText = sun ? sun.text : '-';
    document.getElementById('sky-sunlit')!.textContent = sunText;
    document.getElementById('sky-dip')!.textContent = String(Math.round(dip));
    document.getElementById('sky-zenith')!.textContent =
      `Straight up from the station (over ${fmt1(Math.abs(s.latDeg))}° ${s.latDeg >= 0 ? 'N' : 'S'}, ${fmt1(Math.abs(s.lonDeg))}° ${s.lonDeg >= 0 ? 'E' : 'W'}): ` +
      `right ascension ${raHours(sky.zenithOfDate.raDeg)} (the local star time) and declination ${fmt1(sky.zenithOfDate.decDeg)}° (the station's latitude). ` +
      `${drawn} stars of magnitude 5 or brighter and ${figuresUp.size} constellations are above its horizon.`;
    const top = above.sort((a, b) => a.mag - b.mag).slice(0, 5);
    document.getElementById('sky-bright')!.textContent = top.length
      ? `Brightest above the station now: ${top.map((t) => `${t.name} (${Math.round(t.alt)}° up, ${compass8(t.az)})`).join(', ')}.`
      : 'No named bright star is above the station now.';
    const centre = vecToRaDec(v.f);
    const offUp = angleDeg(v.f, sky.up);
    viewEl.textContent = follow
      ? `View: ${Math.round(fov)}° across, centred straight up from the station (it follows the station).`
      : `View: ${Math.round(fov)}° across, centred on right ascension ${raHours(centre.raDeg)}, declination ${fmt1(centre.decDeg)}°, ` +
        `${Math.round(offUp)}° from straight up. It stays on these stars until you press "Back to the station's view".`;
    canvas.setAttribute(
      'aria-label',
      `Star chart of the sky above the station: ${drawn} stars and ${figuresUp.size} constellations; ${sunText}.` +
        (top.length ? ` Brightest: ${top.map((t) => t.name).join(', ')}.` : '') +
        ' Arrow keys turn the view, plus and minus zoom.',
    );
    canvas.dataset.stars = String(drawn);
    canvas.dataset.segments = String(segments);
    canvas.dataset.constellations = String(figuresUp.size);
    canvas.dataset.zenithRa = sky.zenithOfDate.raDeg.toFixed(4);
    canvas.dataset.zenithDec = sky.zenithOfDate.decDeg.toFixed(4);
    canvas.dataset.stationLat = s.latDeg.toFixed(4);
    canvas.dataset.stationLon = s.lonDeg.toFixed(4);
    canvas.dataset.drawnAt = now.toISOString();
    canvas.dataset.sun = sunH.altDeg >= 0 ? 'up' : 'down';
    // X5b: the view, for the smoke test (J2000 centre and straight up from the same draw, field of view).
    canvas.dataset.follow = follow ? '1' : '0';
    canvas.dataset.fov = fov.toFixed(3);
    canvas.dataset.viewRa = centre.raDeg.toFixed(6);
    canvas.dataset.viewDec = centre.decDeg.toFixed(6);
    canvas.dataset.upRa = sky.zenithJ2000.raDeg.toFixed(6);
    canvas.dataset.upDec = sky.zenithJ2000.decDeg.toFixed(6);
    canvas.dataset.brightInView = JSON.stringify(brightInView);
    canvas.dataset.inView = String(shownStars.length);
  }

  // ---- X5b: tap or click to name a star or a constellation.
  function pick(x: number, y: number, touch: boolean) {
    const reach = touch ? 16 : 8;
    let best: { i: number; d: number } | null = null;
    for (const st of shownStars) {
      const d = Math.hypot(st.x - x, st.y - y) - starRadius(STARS[st.i][2]);
      if (d <= reach && (!best || d < best.d)) best = { i: st.i, d };
    }
    if (best) {
      picked = { kind: 'star', i: best.i };
      const [, , mag, hip, , name] = STARS[best.i];
      const alt = lastAlt.get(best.i) ?? 0;
      let figure: string | null = null;
      for (const [id, pls] of LINE_VECS) {
        if (pls.some((pl) => pl.some((d) => angleDeg(d, STAR_VECS[best!.i]) < 0.02))) {
          figure = NAME_OF.get(id) ?? id;
          break;
        }
      }
      pickedEl.textContent =
        `${name ?? `A star without a common name (Hipparcos ${hip})`}: magnitude ${mag.toFixed(1)}, ` +
        `${Math.abs(Math.round(alt))}° ${alt >= 0 ? 'above' : 'below'} the station's horizon` +
        (figure ? `, one of the stars of ${figure}.` : '.');
    } else {
      let seg: { id: string; d: number } | null = null;
      for (const g of shownSegs) {
        const dx = g.x1 - g.x0;
        const dy = g.y1 - g.y0;
        const t = Math.max(0, Math.min(1, ((x - g.x0) * dx + (y - g.y0) * dy) / (dx * dx + dy * dy || 1)));
        const d = Math.hypot(g.x0 + t * dx - x, g.y0 + t * dy - y);
        if (d <= reach / 2 + 2 && (!seg || d < seg.d)) seg = { id: g.id, d };
      }
      if (seg) {
        picked = { kind: 'figure', id: seg.id };
        pickedEl.textContent = `${NAME_OF.get(seg.id) ?? seg.id}, a constellation (its lines are now gold).`;
      } else {
        picked = null;
        pickedEl.textContent = 'No star or constellation line there: tap closer to a dot or a line.';
      }
    }
    draw();
  }

  // ---- X5b: drag, pinch, wheel and keys.
  let raf = 0;
  const redraw = () => {
    if (!raf) raf = requestAnimationFrame(() => ((raf = 0), draw()));
  };
  const pointers = new Map<number, { x: number; y: number }>();
  let downAt: { x: number; y: number } | null = null;
  let moved = false;
  let pinchDist = 0;
  const local = (e: { clientX: number; clientY: number }) => {
    const b = canvas.getBoundingClientRect();
    return { x: e.clientX - b.left - b.width / 2, y: e.clientY - b.top - b.height / 2 };
  };
  const twoDist = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, local(e));
    if (pointers.size === 1) {
      downAt = local(e);
      moved = false;
    } else {
      moved = true; // a second finger: a pinch, never a tap
      pinchDist = pointers.size === 2 ? twoDist() : 0;
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const p = local(e);
    pointers.set(e.pointerId, p);
    if (pointers.size === 1 && view) {
      let from = prev;
      if (!moved && downAt && Math.hypot(p.x - downAt.x, p.y - downAt.y) > 4) {
        moved = true;
        from = downAt;
      }
      if (moved) {
        view = dragView(view, from.x, from.y, p.x, p.y, fov, R);
        follow = false;
        redraw();
      }
    } else if (pointers.size === 2) {
      const d = twoDist();
      if (pinchDist > 0 && d > 0) {
        fov = zoomFov(fov, pinchDist / d);
        redraw();
      }
      pinchDist = d;
    }
  });
  const release = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return;
    if (e.type === 'pointerup' && pointers.size === 1 && !moved) {
      const p = local(e);
      pick(p.x, p.y, e.pointerType === 'touch' || e.pointerType === 'pen');
    }
    pointers.delete(e.pointerId);
    pinchDist = 0;
    if (pointers.size === 1) downAt = [...pointers.values()][0];
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const dy = e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1);
      fov = zoomFov(fov, Math.exp(dy * 0.0015));
      redraw();
    },
    { passive: false },
  );
  canvas.addEventListener('keydown', (e) => {
    const step = R / 6;
    const turns: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (turns[e.key] && view) {
      view = dragView(view, 0, 0, turns[e.key][0], turns[e.key][1], fov, R);
      follow = false;
    } else if (e.key === '+' || e.key === '=') fov = zoomFov(fov, 1 / 1.25);
    else if (e.key === '-' || e.key === '_') fov = zoomFov(fov, 1.25);
    else return;
    e.preventDefault();
    draw();
  });
  resetBtn.addEventListener('click', () => {
    follow = true;
    fov = FOV_MAX;
    draw();
  });

  setInterval(() => {
    if (opts.isOpen()) draw();
  }, 1000);
  return { draw };
}

