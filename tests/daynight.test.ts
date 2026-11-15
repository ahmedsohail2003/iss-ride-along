// C2 acceptance: the day/night line and the station's "in sunlight / in Earth's shadow" label.
// (a) the Sun's height on the line, computed independently with astronomy-engine, is 0 within 0.5 deg;
// (b) over one orbit, every 10 s, sunlitNow() equals the pass predictor's (M5) shadow test;
// (c) the countdown equals a 1-second brute-force scan for the next change, within 2 s, at 5 times.
import { readFileSync } from 'node:fs';
import * as Astronomy from 'astronomy-engine';
import { describe, expect, test } from 'vitest';
import { nextSunlightChange, nightLine, subsolarPoint, sunlightLabel, sunlitNow } from '../src/orbit/daynight';
import { observer, satrecFromTle } from '../src/orbit/orbit';
import { lookAt } from '../src/orbit/passes';
import { periodMinutes } from '../src/orbit/track';

// The orbit numbers built into the page.
const satrec = satrecFromTle(readFileSync(new URL('../src/data/iss.tle', import.meta.url), 'utf8'));
const epochMs = (satrec.jdsatepoch - 2440587.5) * 86_400_000 + (satrec.jdsatepochF ?? 0) * 86_400_000;

/** Independent Sun height (deg) at a place: astronomy-engine, topocentric, no refraction. */
function sunHeightDeg(date: Date, latDeg: number, lonDeg: number): number {
  const time = Astronomy.MakeTime(date);
  const obs = new Astronomy.Observer(latDeg, lonDeg, 0);
  const eq = Astronomy.Equator(Astronomy.Body.Sun, time, obs, true, true);
  return Astronomy.Horizon(time, obs, eq.ra, eq.dec).altitude;
}

/** Ray-casting point-in-polygon in the plain latitude/longitude plane. */
function inside(poly: [number, number][], lat: number, lon: number): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i];
    const [yj, xj] = poly[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

describe('C2 (a): the day/night line', () => {
  const at = new Date('2026-11-15T02:00:00Z'); // 9:00 PM EST Sat Nov 14
  const n = nightLine(at);

  test('one latitude per degree of longitude, -180 to 180, closed over the dark pole', () => {
    expect(n.line).toHaveLength(361);
    expect(n.line[0][1]).toBe(-180);
    expect(n.line[360][1]).toBe(180);
    expect(n.line.every(([lat, lon], i) => lon === i - 180 && lat >= -90 && lat <= 90)).toBe(true);
    // November: the Sun is south of the equator, so the North Pole is in the dark.
    expect(n.darkPole).toBe(1);
    expect(n.polygon.slice(-2)).toEqual([
      [90, 180],
      [90, -180],
    ]);
  });

  test("the Sun's height computed independently at 24 points on the line is 0 within 0.5 deg", () => {
    const heights = Array.from({ length: 24 }, (_, k) => {
      const [lat, lon] = n.line[k * 15];
      return { lat, lon, h: sunHeightDeg(at, lat, lon) };
    });
    const worst = Math.max(...heights.map((p) => Math.abs(p.h)));
    console.log(`C2 (a) Sun height on the line at 24 points: worst ${worst.toFixed(3)} deg`);
    for (const p of heights) expect(Math.abs(p.h), `lat ${p.lat.toFixed(2)} lon ${p.lon}`).toBeLessThan(0.5);
  });

  test('the shaded ring holds the point opposite the Sun and not the point under it', () => {
    const s = subsolarPoint(at);
    expect(Math.abs(sunHeightDeg(at, s.latDeg, s.lonDeg) - 90)).toBeLessThan(0.5);
    const anti = { lat: -s.latDeg, lon: s.lonDeg > 0 ? s.lonDeg - 180 : s.lonDeg + 180 };
    expect(inside(n.polygon, s.latDeg, s.lonDeg)).toBe(false);
    expect(inside(n.polygon, anti.lat, anti.lon)).toBe(true);
    // Ypsilanti at 9 PM EST is in the dark: inside the ring, and the Sun is below its horizon.
    expect(inside(n.polygon, 42.2411, -83.613)).toBe(true);
    expect(sunHeightDeg(at, 42.2411, -83.613)).toBeLessThan(0);
  });
});

describe('C2 (b): sunlitNow() equals the pass predictor (M5) shadow test', () => {
  test('one orbit from the built-in orbit numbers, every 10 s', () => {
    const steps = Math.ceil((periodMinutes(satrec) * 60) / 10);
    const obs = observer(42.2411, -83.613); // the shadow test does not depend on the place
    let sunlit = 0;
    let shadow = 0;
    for (let i = 0; i <= steps; i++) {
      const ms = epochMs + i * 10_000;
      const l = lookAt(satrec, obs, ms);
      expect(l).not.toBeNull();
      const m5 = l!.shadow < 1; // the third rule of isVisibleAt()
      expect(sunlitNow(satrec, new Date(ms)), new Date(ms).toISOString()).toBe(m5);
      if (m5) sunlit++;
      else shadow++;
    }
    console.log(`C2 (b) ${steps + 1} samples over ${periodMinutes(satrec).toFixed(2)} min: ${sunlit} in sunlight, ${shadow} in shadow, 0 disagreements`);
    expect(sunlit).toBeGreaterThan(0);
    expect(shadow).toBeGreaterThan(0);
  });
});

describe('C2 (c): the countdown against a 1-second brute-force scan', () => {
  /** The first whole second after `from` at which the station's sunlight differs (up to 100 min). */
  function bruteForce(from: number): number | null {
    const now = sunlitNow(satrec, new Date(from));
    for (let s = 1; s <= 6000; s++) if (sunlitNow(satrec, new Date(from + s * 1000)) !== now) return s;
    return null;
  }

  test('5 sample times, within 2 s', () => {
    const rows = [];
    for (let k = 0; k < 5; k++) {
      const from = epochMs + 1234_000 + k * 19 * 60_000; // spread over about one orbit, off whole minutes
      const c = nextSunlightChange(satrec, new Date(from));
      const b = bruteForce(from);
      rows.push({ at: new Date(from).toISOString().slice(11, 19), countdown: c?.seconds ?? null, brute: b });
      expect(b).not.toBeNull();
      if (b! <= 3600) {
        expect(c).not.toBeNull();
        expect(Math.abs(c!.seconds - b!)).toBeLessThanOrEqual(2);
        expect(c!.sunlitAfter).toBe(!sunlitNow(satrec, new Date(from)));
      } else expect(c).toBeNull(); // beyond the 60-minute look-ahead
    }
    console.log(`C2 (c) countdown vs brute force (s): ${rows.map((r) => `${r.at} ${r.countdown}/${r.brute}`).join('; ')}`);
    expect(rows.filter((r) => r.countdown !== null).length).toBeGreaterThanOrEqual(4);
  });

  test('the label is one of the two allowed strings, and agrees with the countdown', () => {
    for (let k = 0; k < 60; k++) {
      const at = new Date(epochMs + k * 97_000);
      const l = sunlightLabel(satrec, at)!;
      expect(l.text).toMatch(/^(in sunlight|in Earth's shadow, sunrise in \d+ min)$/);
      expect(l.sunlit).toBe(sunlitNow(satrec, at));
      if (!l.sunlit) {
        const c = nextSunlightChange(satrec, at)!;
        expect(l.text).toBe(`in Earth's shadow, sunrise in ${Math.max(1, Math.ceil(c.seconds / 60))} min`);
      }
    }
  });
});
