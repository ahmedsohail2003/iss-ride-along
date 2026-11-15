// X5: the "Sky from the station" tab. A round star chart of everything above the station's own horizon
// right now (centre = straight up, away from Earth), the constellation lines and names, the brightest
// stars named, and the station's "in sunlight" / "in Earth's shadow" label (the same function as the map
// marker, src/orbit/daynight.ts). Redrawn every second while the tab is open: the station's sky turns
// about 4 degrees a minute, one full turn per orbit. The math is in ./sky.ts; this file only draws.
import type { SatRec } from 'satellite.js';
import starsData from '../data/sky/stars.json';
import linesData from '../data/sky/lines.json';
import namesData from '../data/sky/names.json';
import { stateAt, sunEciKm } from '../orbit/orbit';
import { sunlightLabel } from '../orbit/daynight';
import { apply, temeToJ2000Matrix } from '../orbit/frames';
import { compass8 } from '../ui/sentence';
import { CREDIT_SKY } from '../nasa/credits';
import { chartXY, earthEdgeDipDeg, horizontal, horizontalOfVec, starRadius, stationSky, type StarRow } from './sky';

const STARS = starsData as unknown as StarRow[];
const LINES = linesData as unknown as Record<string, [number, number][][]>;
const NAMES = namesData as unknown as [string, string, number, number, number][];
/** Stars named on the chart: brighter than magnitude 1.5, plus Polaris (the pole star). */
const LABEL_MAG = 1.5;

export const skyPanelHtml = `
  <section class="card sky-card" aria-labelledby="sky-h">
    <h2 id="sky-h">The sky from the station, right now</h2>
    <p class="small">The stars above the station at this moment, looking straight away from Earth. This is computed, not a photo:
      nobody outside NASA controls the station's cameras. The centre is straight up from the station and the edge is the station's
      own horizon; the Earth's edge is about <span id="sky-dip">20</span>° below that, so everything in the circle is open sky.
      North is at the top and east on the left, as on a star chart held over your head.</p>
    <p class="sky-sun">Station: <strong id="sky-sunlit">-</strong>. <span class="small">Stars show to a camera only when the station is in
      Earth's shadow; in sunlight the glare hides them.</span></p>
    <div class="sky-wrap"><canvas id="sky-canvas" width="480" height="480" role="img" aria-label="Star chart of the sky above the station"></canvas></div>
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

export function initSkyPanel(opts: { getSatrec: () => SatRec; isOpen: () => boolean }): SkyPanel {
  const canvas = document.getElementById('sky-canvas') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');
  document.getElementById('sky-credit')!.textContent = CREDIT_SKY;

  function draw() {
    if (!ctx) return;
    const now = new Date();
    const s = stateAt(opts.getSatrec(), now);
    if (!s) return;
    const sky = stationSky(now, s.latDeg, s.lonDeg);

    // Size the canvas to its box (sharp on high-density screens).
    const css = Math.max(200, Math.round(canvas.getBoundingClientRect().width || 480));
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(css * dpr)) {
      canvas.width = Math.round(css * dpr);
      canvas.height = Math.round(css * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const c = css / 2;
    const R = c - 18; // room for the compass letters
    ctx.clearRect(0, 0, css, css);

    // The sky disc, with rings at 30 and 60 degrees up.
    ctx.fillStyle = '#050b1f';
    ctx.beginPath();
    ctx.arc(c, c, R, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = 'rgba(127, 219, 255, 0.18)';
    ctx.lineWidth = 1;
    for (const alt of [30, 60]) {
      const p = chartXY(alt, 0, R)!;
      ctx.beginPath();
      ctx.arc(c, c, Math.abs(p.y), 0, 2 * Math.PI);
      ctx.stroke();
    }
    ctx.save();
    ctx.beginPath();
    ctx.arc(c, c, R, 0, 2 * Math.PI);
    ctx.clip();

    // Constellation lines: a piece is drawn when both its ends are above the station's horizon.
    ctx.strokeStyle = 'rgba(127, 219, 255, 0.45)';
    ctx.lineWidth = 1;
    let segments = 0;
    const figuresUp = new Set<string>();
    for (const [id, polylines] of Object.entries(LINES)) {
      for (const pl of polylines) {
        let prev: { x: number; y: number } | null = null;
        for (const [ra, dec] of pl) {
          const h = horizontal(sky, ra, dec);
          const p = chartXY(h.altDeg, h.azDeg, R);
          if (p && prev) {
            ctx.beginPath();
            ctx.moveTo(c + prev.x, c + prev.y);
            ctx.lineTo(c + p.x, c + p.y);
            ctx.stroke();
            segments++;
            figuresUp.add(id);
          }
          prev = p;
        }
      }
    }

    // Constellation names (the better-known ones, rank 1 and 2).
    ctx.fillStyle = 'rgba(160, 200, 230, 0.75)';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const [id, name, ra, dec, rank] of NAMES) {
      if (rank > 2 || !figuresUp.has(id)) continue;
      const h = horizontal(sky, ra, dec);
      const p = chartXY(h.altDeg, h.azDeg, R);
      if (p) ctx.fillText(name, c + p.x, c + p.y);
    }

    // Stars: size by magnitude, colour by B-V; the brightest named.
    let drawn = 0;
    const labelBoxes: { x: number; y: number; w: number; h: number }[] = [];
    const above: { name: string; mag: number; alt: number; az: number }[] = [];
    ctx.textAlign = 'left';
    for (const [ra, dec, mag, , bv, name] of STARS) {
      const h = horizontal(sky, ra, dec);
      const p = chartXY(h.altDeg, h.azDeg, R);
      if (!p) continue;
      drawn++;
      ctx.fillStyle = starColour(bv);
      ctx.beginPath();
      ctx.arc(c + p.x, c + p.y, starRadius(mag), 0, 2 * Math.PI);
      ctx.fill();
      if (name && (mag <= LABEL_MAG || name === 'Polaris')) {
        // Skip a name that would overlap one already written (stars are drawn brightest first).
        const box = { x: c + p.x + 5, y: c + p.y - 14, w: ctx.measureText(name).width, h: 12 };
        if (!labelBoxes.some((b) => box.x < b.x + b.w && b.x < box.x + box.w && box.y < b.y + b.h && b.y < box.y + box.h)) {
          labelBoxes.push(box);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(name, c + p.x + 5, c + p.y - 4);
        }
      }
      if (name) above.push({ name, mag, alt: h.altDeg, az: h.azDeg });
    }

    // The Sun, when it is above the station's horizon (only ever while the station is in sunlight).
    const sunV = apply(temeToJ2000Matrix(now), sunEciKm(now));
    const sunH = horizontalOfVec(sky, sunV);
    const sp = chartXY(sunH.altDeg, sunH.azDeg, R);
    if (sp) {
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(c + sp.x, c + sp.y, 7, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillText('Sun', c + sp.x + 9, c + sp.y + 4);
    }
    ctx.restore();

    // The station's horizon and the compass letters (north up, east left: the sky seen from below).
    ctx.strokeStyle = 'rgba(127, 219, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(c, c, R, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.fillStyle = '#cfe0ff';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const [t, az] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]] as const) {
      const p = chartXY(0, az, R + 10)!;
      ctx.fillText(t, c + p.x, c + p.y);
    }
    ctx.textBaseline = 'alphabetic';

    // Words for everyone (and for screen readers): the label, straight up, the brightest stars up now.
    const sun = sunlightLabel(opts.getSatrec(), now);
    const sunText = sun ? sun.text : '-';
    document.getElementById('sky-sunlit')!.textContent = sunText;
    document.getElementById('sky-dip')!.textContent = String(Math.round(earthEdgeDipDeg(s.altKm)));
    document.getElementById('sky-zenith')!.textContent =
      `Straight up from the station (over ${fmt1(Math.abs(s.latDeg))}° ${s.latDeg >= 0 ? 'N' : 'S'}, ${fmt1(Math.abs(s.lonDeg))}° ${s.lonDeg >= 0 ? 'E' : 'W'}): ` +
      `right ascension ${raHours(sky.zenithOfDate.raDeg)} (the local star time) and declination ${fmt1(sky.zenithOfDate.decDeg)}° (the station's latitude). ` +
      `${drawn} stars of magnitude 5 or brighter and ${figuresUp.size} constellations are above its horizon.`;
    const top = above.sort((a, b) => a.mag - b.mag).slice(0, 5);
    document.getElementById('sky-bright')!.textContent = top.length
      ? `Brightest above the station now: ${top.map((t) => `${t.name} (${Math.round(t.alt)}° up, ${compass8(t.az)})`).join(', ')}.`
      : 'No named bright star is above the station now.';
    canvas.setAttribute(
      'aria-label',
      `Star chart of the sky above the station: ${drawn} stars and ${figuresUp.size} constellations; ${sunText}.` +
        (top.length ? ` Brightest: ${top.map((t) => t.name).join(', ')}.` : ''),
    );
    canvas.dataset.stars = String(drawn);
    canvas.dataset.segments = String(segments);
    canvas.dataset.constellations = String(figuresUp.size);
    canvas.dataset.zenithRa = sky.zenithOfDate.raDeg.toFixed(4);
    canvas.dataset.zenithDec = sky.zenithOfDate.decDeg.toFixed(4);
    canvas.dataset.stationLat = s.latDeg.toFixed(4);
    canvas.dataset.stationLon = s.lonDeg.toFixed(4);
    canvas.dataset.drawnAt = now.toISOString();
    canvas.dataset.sun = sp ? 'up' : 'down';
  }

  setInterval(() => {
    if (opts.isOpen()) draw();
  }, 1000);
  return { draw };
}
