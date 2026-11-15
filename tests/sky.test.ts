// X5 acceptance: the sky from the station.
// (a) for a fixed time and station position, "straight up" on the sky = (local sidereal time, latitude),
//     with the sidereal time computed here independently, within 0.1 degree;
// (b) with the station over latitude 45 N, Polaris sits within 1.5 degrees of 45 degrees above the
//     northern horizon;
// (c) bright stars' directions match astronomy-engine (an independent astronomy library, used only in
//     tests), within 0.5 degree.
import { readFileSync } from 'node:fs';
import * as Astronomy from 'astronomy-engine';
import { describe, expect, test } from 'vitest';
import { chartXY, earthEdgeDipDeg, horizontal, stationSky, type StarRow } from '../src/sky/sky';
import { satrecFromTle, stateAt } from '../src/orbit/orbit';

const stars = JSON.parse(readFileSync(new URL('../src/data/sky/stars.json', import.meta.url), 'utf8')) as StarRow[];
const byName = (n: string) => {
  const s = stars.find((r) => r[5] === n);
  if (!s) throw new Error(`${n} not in the catalogue`);
  return s;
};
const satrec = satrecFromTle(readFileSync(new URL('../src/data/iss.tle', import.meta.url), 'utf8'));

/** Greenwich mean sidereal time in degrees, IAU 1982 (Aoki et al. 1982, as printed in the Explanatory
 *  Supplement and in Vallado eq. 3-45), written here from the formula, with UT1 taken as UTC. */
function gmstDegIndependent(date: Date): number {
  const jd = date.getTime() / 86_400_000 + 2440587.5;
  const t = (jd - 2451545.0) / 36525;
  const sec = 67310.54841 + (876600 * 3600 + 8640184.812866) * t + 0.093104 * t * t - 6.2e-6 * t * t * t;
  return ((((sec % 86400) + 86400) % 86400) / 240) % 360;
}
const angDiff = (a: number, b: number) => Math.abs(((a - b + 540) % 360) - 180);

/** Angle in degrees between two (height, compass) directions. */
function separationDeg(a: { altDeg: number; azDeg: number }, b: { altDeg: number; azDeg: number }): number {
  const r = Math.PI / 180;
  const c =
    Math.sin(a.altDeg * r) * Math.sin(b.altDeg * r) + Math.cos(a.altDeg * r) * Math.cos(b.altDeg * r) * Math.cos((a.azDeg - b.azDeg) * r);
  return Math.acos(Math.max(-1, Math.min(1, c))) / r;
}

/** astronomy-engine's own answer: J2000 vector -> its EQJ-to-horizon rotation -> height and compass, no refraction. */
function astronomyEngine(date: Date, latDeg: number, lonDeg: number, raDeg: number, decDeg: number) {
  const time = Astronomy.MakeTime(date);
  const obs = new Astronomy.Observer(latDeg, lonDeg, 0);
  const v = Astronomy.VectorFromSphere(new Astronomy.Spherical(decDeg, raDeg, 1), time);
  const h = Astronomy.HorizonFromVector(Astronomy.RotateVector(Astronomy.Rotation_EQJ_HOR(time, obs), v), '');
  return { altDeg: h.lat, azDeg: ((h.lon % 360) + 360) % 360 };
}

describe('X5 (a): straight up from the station', () => {
  // 10:00 PM EST Sat Nov 14 2026, and the station where the built-in orbit numbers put it then.
  const at = new Date('2026-11-15T03:00:00Z');
  const s = stateAt(satrec, at)!;
  const cases: [string, number, number][] = [
    ['the station at 03:00 UTC (built-in orbit numbers)', s.latDeg, s.lonDeg],
    ['over Ypsilanti', 42.2411, -83.613],
    ['over the date line, south', -51.0, 179.9],
  ];
  for (const [label, lat, lon] of cases) {
    test(`${label}: right ascension = local sidereal time, declination = latitude, within 0.1 deg`, () => {
      const sky = stationSky(at, lat, lon);
      const lst = (gmstDegIndependent(at) + lon + 360) % 360;
      const dRa = angDiff(sky.zenithOfDate.raDeg, lst);
      const dDec = Math.abs(sky.zenithOfDate.decDeg - lat);
      console.log(`X5 (a) ${label} (${lat.toFixed(2)}, ${lon.toFixed(2)}): zenith RA ${sky.zenithOfDate.raDeg.toFixed(4)} vs LST ${lst.toFixed(4)} (diff ${dRa.toFixed(5)}; astronomy-engine apparent sidereal time diff ${angDiff(sky.zenithOfDate.raDeg, (Astronomy.SiderealTime(at) * 15 + lon + 360) % 360).toFixed(5)}), Dec ${sky.zenithOfDate.decDeg.toFixed(4)} vs lat (diff ${dDec.toFixed(5)})`);
      expect(dRa).toBeLessThan(0.1);
      expect(dDec).toBeLessThan(0.1);
      // A second, library sidereal time (astronomy-engine's apparent sidereal time, hours) agrees too.
      const lstAE = (Astronomy.SiderealTime(at) * 15 + lon + 360) % 360;
      expect(angDiff(sky.zenithOfDate.raDeg, lstAE)).toBeLessThan(0.1);
      // And the J2000 zenith is the same direction moved by precession only (about 0.3-0.4 deg in 2026).
      const up = { altDeg: 90, azDeg: 0 };
      const z = astronomyEngine(at, lat, lon, sky.zenithJ2000.raDeg, sky.zenithJ2000.decDeg);
      expect(separationDeg(up, z)).toBeLessThan(0.1);
    });
  }
});

describe('X5 (b): Polaris from latitude 45 N', () => {
  const polaris = byName('Polaris');
  test('within 1.5 deg of 45 deg above the northern horizon at 8 times over a day', () => {
    const t0 = Date.parse('2026-11-15T00:00:00Z');
    const rows: string[] = [];
    for (let k = 0; k < 8; k++) {
      const at = new Date(t0 + k * 3 * 3600_000);
      const sky = stationSky(at, 45, -83.6 + k * 40);
      const h = horizontal(sky, polaris[0], polaris[1]);
      rows.push(`${h.altDeg.toFixed(2)}/${h.azDeg.toFixed(2)}`);
      expect(Math.abs(h.altDeg - 45)).toBeLessThan(1.5);
      expect(angDiff(h.azDeg, 0)).toBeLessThan(1.5); // the northern horizon
    }
    console.log(`X5 (b) Polaris height/compass at 45 N, 8 times: ${rows.join(', ')}`);
  });
});

describe('X5 (c): bright stars against astronomy-engine', () => {
  const at = new Date('2026-11-15T03:00:00Z');
  const s = stateAt(satrec, at)!;
  test('Sirius, Vega, Capella and Canopus within 0.5 deg at 4 places', () => {
    const places: [number, number][] = [
      [s.latDeg, s.lonDeg],
      [42.2411, -83.613],
      [-51.0, 179.9],
      [10.0, 30.0],
    ];
    let worst = 0;
    for (const [lat, lon] of places) {
      const sky = stationSky(at, lat, lon);
      for (const name of ['Sirius', 'Vega', 'Capella', 'Canopus']) {
        const st = byName(name);
        const ours = horizontal(sky, st[0], st[1]);
        const theirs = astronomyEngine(at, lat, lon, st[0], st[1]);
        const d = separationDeg(ours, theirs);
        worst = Math.max(worst, d);
        expect(d).toBeLessThan(0.5);
      }
    }
    console.log(`X5 (c) worst separation from astronomy-engine over 16 star-place pairs: ${worst.toFixed(4)} deg (${(worst * 3600).toFixed(3)} arcsec)`);
  });
});

describe('X5 chart helpers', () => {
  test('the chart puts straight up in the centre, the horizon on the edge, north at the top and east on the left', () => {
    expect(chartXY(90, 0, 100)).toEqual({ x: -0, y: -0 });
    const n = chartXY(0, 0, 100)!;
    const e = chartXY(0, 90, 100)!;
    expect(Math.hypot(n.x, n.y)).toBeCloseTo(100, 6);
    expect(n.y).toBeCloseTo(-100, 6);
    expect(e.x).toBeCloseTo(-100, 6);
    expect(chartXY(-1, 0, 100)).toBeNull();
  });
  test("the Earth's edge is about 20 deg below the station's horizon at 420 km", () => {
    const d = earthEdgeDipDeg(420);
    expect(d).toBeGreaterThan(19);
    expect(d).toBeLessThan(21);
  });
  test('the catalogue: stars of magnitude 5.0 or brighter, J2000 degrees, Polaris and Sirius named', () => {
    expect(stars.length).toBeGreaterThan(1500);
    expect(stars.every((r) => r[2] <= 5.0 && r[0] >= 0 && r[0] < 360 && Math.abs(r[1]) <= 90)).toBe(true);
    expect(byName('Polaris')[1]).toBeGreaterThan(89);
    expect(byName('Sirius')[2]).toBeLessThan(-1);
  });
});
