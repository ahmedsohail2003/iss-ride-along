// C3: the plain sentence above the map ("1,240 km east of Sydney, Australia, heading northeast, 418 km up.").
// For 3 fixed positions the sentence must name the nearest city, give a distance within 10 km and a compass
// word that matches a bearing worked out here a different way: unit vectors on a sphere and the city's own
// east/north directions (not the haversine distance and forward-azimuth formula that src/ui/sentence.ts uses).
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { CITIES, compass8, groundHeadingDeg, whereNow, whereSentence } from '../src/ui/sentence';
import { satrecFromTle, stateAt } from '../src/orbit/orbit';

const R_KM = 6371.0088;
const r = Math.PI / 180;
type V = [number, number, number];
const unit = (lat: number, lon: number): V => [Math.cos(lat * r) * Math.cos(lon * r), Math.cos(lat * r) * Math.sin(lon * r), Math.sin(lat * r)];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Independent: angle between unit vectors (atan2 of |a x b| and a . b), times the mean radius. */
function vectorKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const a = unit(lat1, lon1);
  const b = unit(lat2, lon2);
  return R_KM * Math.atan2(Math.hypot(...cross(a, b)), dot(a, b));
}

/** Independent: project (station - city) onto the city's local east and north unit vectors. */
function vectorBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const c = unit(lat1, lon1);
  const s = unit(lat2, lon2);
  const east: V = [-Math.sin(lon1 * r), Math.cos(lon1 * r), 0];
  const north: V = [-Math.sin(lat1 * r) * Math.cos(lon1 * r), -Math.sin(lat1 * r) * Math.sin(lon1 * r), Math.cos(lat1 * r)];
  const d: V = [s[0] - c[0], s[1] - c[1], s[2] - c[2]];
  return ((Math.atan2(dot(d, east), dot(d, north)) / r) + 360) % 360;
}

/** Independent 8-word table: each word owns the 45-degree sector centred on its direction. */
const SECTORS: [string, number][] = [
  ['north', 0], ['northeast', 45], ['east', 90], ['southeast', 135], ['south', 180], ['southwest', 225], ['west', 270], ['northwest', 315],
];
function wordFor(b: number): string {
  for (const [w, c] of SECTORS) {
    const diff = Math.abs(((b - c + 540) % 360) - 180);
    if (diff < 22.5) return w;
  }
  throw new Error(`bearing ${b} on a sector edge`);
}

/** Independent nearest city: brute force over the same 150 cities with the vector distance. */
function nearestIndependent(lat: number, lon: number) {
  return CITIES.map((c) => ({ c, km: vectorKm(c.lat, c.lon, lat, lon) })).sort((a, b) => a.km - b.km)[0];
}

// Three fixed points under the station: one 109 km from a city, one over the Tasman Sea 2,023 km from the
// nearest listed city, one in the North Pacific just west of the 180-degree line (the bearing crosses it).
const CASES = [
  { lat: 42.9, lon: -82.0, city: 'Detroit', word: 'northeast' },
  { lat: -45.0, lon: 170.0, city: 'Sydney', word: 'southeast' },
  { lat: 35.0, lon: 179.5, city: 'Sapporo', word: 'east' },
];

describe('C3 the plain sentence', () => {
  for (const k of CASES) {
    test(`(${k.lat}, ${k.lon}): nearest city ${k.city}, distance within 10 km, compass word ${k.word}`, () => {
      const s = whereSentence(k.lat, k.lon, 418.4, 45);
      const ind = nearestIndependent(k.lat, k.lon);
      // the right nearest city, by name and by an independent brute force
      expect(s.city.name).toBe(k.city);
      expect(ind.c.name).toBe(k.city);
      // the distance in the sentence (rounded to 10 km) is within 10 km of the independent distance
      expect(Math.abs(s.km10 - ind.km)).toBeLessThanOrEqual(10);
      expect(s.text).toContain(`${s.km10.toLocaleString('en-US')} km ${s.direction} of ${k.city},`);
      // the compass word matches the independently computed bearing (kept away from a sector edge)
      const b = vectorBearing(ind.c.lat, ind.c.lon, k.lat, k.lon);
      const edgeGap = Math.min(...[22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5].map((e) => Math.abs(((b - e + 540) % 360) - 180)));
      expect(edgeGap).toBeGreaterThan(5);
      expect(Math.abs(((s.fromCityDeg - b + 540) % 360) - 180)).toBeLessThan(0.01);
      expect(s.direction).toBe(wordFor(b));
      expect(s.direction).toBe(k.word);
      expect(s.text).toMatch(/, heading northeast, 418 km up\.$/);
    });
  }

  test('the Detroit case reads as one plain sentence', () => {
    expect(whereSentence(42.9, -82.0, 418.4, 100).text).toBe('110 km northeast of Detroit, United States, heading east, 418 km up.');
  });

  test('closer than 5 km reads "Right over"; long distances get a thousands comma', () => {
    const tokyo = CITIES.find((c) => c.name === 'Tokyo')!;
    expect(whereSentence(tokyo.lat + 0.01, tokyo.lon, 420, 0).text).toBe('Right over Tokyo, Japan, heading north, 420 km up.');
    expect(whereSentence(-45.0, 170.0, 420, 200).text).toBe('2,020 km southeast of Sydney, Australia, heading south, 420 km up.');
  });

  test('compass8 sectors: 0 north, 44 northeast, 136 southeast, 359 north, -90 west', () => {
    expect([0, 44, 136, 359, -90].map(compass8)).toEqual(['north', 'northeast', 'southeast', 'north', 'west']);
  });

  test('heading follows the ground track: north while the latitude rises, south while it falls', () => {
    const satrec = satrecFromTle(readFileSync(new URL('../src/data/iss.tle', import.meta.url), 'utf8'));
    const t0 = new Date('2026-11-14T22:00:00Z');
    let seen = 0;
    for (let m = 0; m < 93; m += 7) {
      const t = new Date(t0.getTime() + m * 60_000);
      const a = stateAt(satrec, t)!;
      const b = stateAt(satrec, new Date(t.getTime() + 60_000))!;
      const h = groundHeadingDeg(satrec, t)!;
      // independent: the bearing of the 1-minute ground step, worked out with vectors
      expect(Math.abs(((h - vectorBearing(a.latDeg, a.lonDeg, b.latDeg, b.lonDeg) + 540) % 360) - 180)).toBeLessThan(3);
      if (Math.abs(b.latDeg - a.latDeg) > 1) {
        expect(compass8(h)).toMatch(b.latDeg > a.latDeg ? /^north/ : /^south/);
        seen++;
      }
    }
    expect(seen).toBeGreaterThan(5);
    const w = whereNow(satrec, t0)!;
    expect(w.text).toMatch(/^(Right over .+|[\d,]+ km (north|northeast|east|southeast|south|southwest|west|northwest) of .+), heading (north|northeast|east|southeast|south|southwest|west|northwest), \d+ km up\.$/);
  });
});
