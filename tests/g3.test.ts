// G3 acceptance: the stars behind the globe are the Sky tab's catalogue turned by sidereal time, and the story's
// camera goes where its words say. (1) Polaris lies within 1 degree of the globe's north axis; (2) the star whose
// right ascension is sidereal time + the station's longitude and whose declination is the station's latitude lies
// straight above the station within 0.01 degree; (3) sceneAt gives a defined camera for all six ids and 'now'
// targets the station; (4) the star count is 1,627.
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { angleBetween, latLonToVec3, orbitPoints, type Vec3 } from '../src/globe/geo';
import { siderealDeg, starBuffers, starLocal, starOnGlobe, STARS, starsTurnRad, rotateY } from '../src/globe/stars';
import { SCENE_IDS, sceneAt, terminatorPoint } from '../src/globe/story';
import { satrecFromTle, stateAt } from '../src/orbit/orbit';
import { subsolarPoint } from '../src/orbit/daynight';
import { periodMinutes } from '../src/orbit/track';
import meta from '../src/data/sky/meta.json';

const satrec = satrecFromTle(readFileSync(new URL('../src/data/iss.tle', import.meta.url), 'utf8'));
const epochMs = (satrec.jdsatepoch - 2440587.5) * 86_400_000 + (satrec.jdsatepochF ?? 0) * 86_400_000;
const DEG = 180 / Math.PI;
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// 24 times over a day from the element set's epoch, so the check covers every sidereal angle
const times = Array.from({ length: 24 }, (_, i) => new Date(epochMs + i * 3_600_000 + 17_000));

describe('G3 stars and story (src/globe/stars.ts, src/globe/story.ts)', () => {
  test('(1) Polaris lies within 1 degree of the globe\'s north axis', () => {
    const polaris = STARS.find((r) => r[5] === 'Polaris');
    expect(polaris).toBeDefined();
    let worst = 0;
    for (const t of times) worst = Math.max(worst, angleBetween(starOnGlobe(polaris![0], polaris![1], t), [0, 1, 0]) * DEG);
    console.log(`G3 (1): Polaris (dec ${polaris![1]}) is at most ${worst.toFixed(3)} degree from +Y over 24 times`);
    expect(worst).toBeLessThan(1);
  });

  test('(2) the star at RA = sidereal time + longitude, dec = latitude is straight above the station within 0.01 degree', () => {
    let worst = 0;
    for (const t of times) {
      const s = stateAt(satrec, t)!;
      const ra = siderealDeg(t) + s.lonDeg;
      const star = starOnGlobe(ra, s.latDeg, t);
      // the same turn as the drawn group: rotation.y = starsTurnRad on the position before the turn
      const drawn = rotateY(starLocal(ra, s.latDeg), starsTurnRad(t));
      worst = Math.max(worst, angleBetween(star, latLonToVec3(s.latDeg, s.lonDeg)) * DEG, angleBetween(drawn, latLonToVec3(s.latDeg, s.lonDeg)) * DEG);
    }
    console.log(`G3 (2): 24 station positions, worst angle from straight above ${worst.toExponential(2)} degree`);
    expect(worst).toBeLessThan(0.01);
  });

  test("(3) sceneAt gives a defined camera for all six ids, 'now' targets the station", () => {
    const t = times[5];
    const s = stateAt(satrec, t)!;
    const sun = subsolarPoint(t);
    const o = orbitPoints(satrec, t, periodMinutes(satrec));
    const ctx = { station: { lat: s.latDeg, lon: s.lonDeg, alt: s.altKm }, sun: { lat: sun.latDeg, lon: sun.lonDeg }, ahead: { lat: o.next[20].latDeg, lon: o.next[20].lonDeg } };
    expect(SCENE_IDS).toEqual(['now', 'orbit', 'daynight', 'view', 'sky', 'real']);
    for (const id of SCENE_IDS) {
      const c = sceneAt(id, ctx);
      expect(c.id).toBe(id);
      for (const v of [c.lat, c.lon, c.dist]) expect(Number.isFinite(v)).toBe(true);
      expect(Math.abs(c.lat)).toBeLessThanOrEqual(85);
      expect(c.dist).toBeGreaterThan(1.25);
      expect(c.dist).toBeLessThanOrEqual(8);
      expect(c.layers).toBeDefined();
    }
    const now = sceneAt('now', ctx);
    expect(now.lat).toBe(s.latDeg);
    expect(now.lon).toBe(s.lonDeg);
    // the day/night scene looks at a point at right angles to the Sun; the orbit scene down the orbit's pole
    const sunV = latLonToVec3(sun.latDeg, sun.lonDeg);
    const dn = sceneAt('daynight', ctx);
    expect(Math.abs(dot(latLonToVec3(dn.lat, dn.lon), sunV))).toBeLessThan(1e-9);
    const pole = sceneAt('orbit', ctx);
    expect(Math.abs(dot(latLonToVec3(pole.lat, pole.lon), latLonToVec3(s.latDeg, s.lonDeg)))).toBeLessThan(1e-9);
    expect(Math.abs(90 - Math.abs(pole.lat) - satrec.inclo * DEG)).toBeLessThan(0.5);
    // under or opposite the Sun the day/night point falls back to the equator, still at right angles to the Sun
    for (const st of [{ lat: sun.latDeg, lon: sun.lonDeg }, { lat: -sun.latDeg, lon: sun.lonDeg + 180 }]) {
      const p = terminatorPoint(st, { lat: sun.latDeg, lon: sun.lonDeg });
      expect(Math.abs(dot(latLonToVec3(p.lat, p.lon), sunV))).toBeLessThan(1e-9);
    }
  });

  test('(4) the star count is 1,627', () => {
    const b = starBuffers();
    expect(STARS.length).toBe(1627);
    expect(b.count).toBe(1627);
    expect(b.positions.length).toBe(3 * 1627);
    expect(b.sizes.length).toBe(1627);
    expect(meta.counts.stars).toBe(1627);
  });
});
