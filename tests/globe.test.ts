// G1 acceptance: the 3D globe's geometry is the engine's, and the view choice follows its rules.
// (a) lat/lon -> 3D -> lat/lon at 200 points within 1e-9 degree; (b) (0, 0) on +X and (0, 90 E) on -Z;
// (c) the station's 3D point turns back into stateAt's latitude and longitude within 1e-6 degree;
// (d) every point of nightLine(date) is at right angles to sunVector(date) within 0.02; (e) on Nov 15 the
// Sun is over the southern half (about -18 degrees); (f) the view circle's angle is footprintRadiusKm /
// 6371.0088 within 1e-6; (g) orbitPoints gives more than 300 points, each equal to stateAt at its time;
// (h) raySphere through the middle of the view returns the view centre within 1e-6 degree, and a miss is
// null; (i) the chooseView table; (j) the speed decision needs a finished array of 30 gaps.
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { angleBetween, cameraFor, circleOnSphere, latLonToVec3, orbitPoints, raySphere, sunVector, vec3ToLatLon, type Vec3 } from '../src/globe/geo';
import { chooseView, DEFAULT_VIEW, speedDecision, type ProbeResult } from '../src/globe/view';
import { EARTH_RADIUS_KM, satrecFromTle, stateAt } from '../src/orbit/orbit';
import { nightLine, subsolarPoint } from '../src/orbit/daynight';
import { periodMinutes } from '../src/orbit/track';
import { footprintRadiusKm } from '../src/nasa/footprint';

const satrec = satrecFromTle(readFileSync(new URL('../src/data/iss.tle', import.meta.url), 'utf8'));
const epochMs = (satrec.jdsatepoch - 2440587.5) * 86_400_000 + (satrec.jdsatepochF ?? 0) * 86_400_000;
const lonGap = (a: number, b: number) => Math.abs(((((a - b + 180) % 360) + 360) % 360) - 180);
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

describe('G1 geometry (src/globe/geo.ts)', () => {
  test('(a) latitude/longitude to 3D and back at 200 points within 1e-9 degree', () => {
    let worst = 0;
    for (let i = 0; i < 200; i++) {
      // a fixed spread over the globe (golden-angle spiral), heights 0 to 500 km, poles left out
      const lat = Math.asin(-0.995 + (1.99 * (i + 0.5)) / 200) * (180 / Math.PI);
      const lon = ((((i * 137.50776405) % 360) + 360) % 360) - 180;
      const alt = (i % 6) * 100;
      const back = vec3ToLatLon(latLonToVec3(lat, lon, alt));
      worst = Math.max(worst, Math.abs(back.latDeg - lat), lonGap(back.lonDeg, lon));
      expect(Math.abs(back.altKm - alt)).toBeLessThan(1e-6);
    }
    console.log(`G1 (a): 200 points, worst round-trip error ${worst.toExponential(2)} degree`);
    expect(worst).toBeLessThan(1e-9);
  });

  test('(b) (0, 0) lands on +X and (0, 90 E) on -Z', () => {
    const a = latLonToVec3(0, 0);
    const b = latLonToVec3(0, 90);
    expect(a[0]).toBeCloseTo(1, 12);
    expect(Math.abs(a[1]) + Math.abs(a[2])).toBeLessThan(1e-12);
    expect(b[2]).toBeCloseTo(-1, 12);
    expect(Math.abs(b[0]) + Math.abs(b[1])).toBeLessThan(1e-12);
    // and the North Pole is +Y, the height adds to the radius
    expect(latLonToVec3(90, 0)[1]).toBeCloseTo(1, 12);
    expect(Math.hypot(...latLonToVec3(10, 20, EARTH_RADIUS_KM))).toBeCloseTo(2, 12);
  });

  test("(c) the station's 3D point turns back into stateAt's latitude and longitude within 1e-6 degree", () => {
    let worst = 0;
    for (let k = 0; k < 50; k++) {
      const s = stateAt(satrec, new Date(epochMs + k * 7 * 60_000))!;
      const back = vec3ToLatLon(latLonToVec3(s.latDeg, s.lonDeg, s.altKm));
      worst = Math.max(worst, Math.abs(back.latDeg - s.latDeg), lonGap(back.lonDeg, s.lonDeg));
      expect(Math.abs(back.altKm - s.altKm)).toBeLessThan(1e-6);
    }
    expect(worst).toBeLessThan(1e-6);
  });

  test('(d) every point of nightLine(date) is at right angles to sunVector(date) within 0.02', () => {
    for (const iso of ['2026-11-15T06:00:00Z', '2026-11-15T18:30:00Z', '2026-06-21T12:00:00Z', '2026-03-20T15:00:00Z']) {
      const d = new Date(iso);
      const sun = sunVector(d);
      const worst = Math.max(...nightLine(d).line.map(([lat, lon]) => Math.abs(dot(latLonToVec3(lat, lon), sun))));
      console.log(`G1 (d): ${iso}: 361 points, worst |dot| ${worst.toExponential(2)}`);
      expect(worst).toBeLessThan(0.02);
    }
  });

  test('(e) on Nov 15 the Sun is over the southern half (about -18 degrees)', () => {
    const d = new Date('2026-11-15T12:00:00Z');
    const s = subsolarPoint(d);
    const v = sunVector(d);
    console.log(`G1 (e): subsolar latitude ${s.latDeg.toFixed(3)}, sunVector y ${v[1].toFixed(4)}`);
    expect(v[1]).toBeLessThan(0);
    expect(s.latDeg).toBeGreaterThan(-19.5);
    expect(s.latDeg).toBeLessThan(-17.5);
    expect(Math.hypot(...v)).toBeCloseTo(1, 12);
  });

  test("(f) the view circle's angle equals footprintRadiusKm / 6371.0088 within 1e-6", () => {
    const s = stateAt(satrec, new Date(epochMs + 3_600_000))!;
    const angle = footprintRadiusKm(s.altKm) / 6371.0088;
    const centre = latLonToVec3(s.latDeg, s.lonDeg);
    const ring = circleOnSphere(s.latDeg, s.lonDeg, angle, 96);
    expect(ring.length).toBe(97);
    const worst = Math.max(...ring.map((p) => Math.abs(angleBetween(p, centre) - angle)));
    console.log(`G1 (f): ${s.altKm.toFixed(1)} km up, view angle ${angle.toFixed(6)} rad (${footprintRadiusKm(s.altKm).toFixed(1)} km), worst ${worst.toExponential(2)}`);
    expect(worst).toBeLessThan(1e-6);
    // every point is on the ground (radius 1)
    for (const p of ring) expect(Math.abs(Math.hypot(...p) - 1)).toBeLessThan(1e-12);
  });

  test('(g) orbitPoints returns more than 300 points and each equals stateAt at its time', () => {
    const now = new Date(epochMs + 2 * 3_600_000);
    const { past, next } = orbitPoints(satrec, now, periodMinutes(satrec));
    const all = [...past, ...next];
    console.log(`G1 (g): period ${periodMinutes(satrec).toFixed(2)} min, ${past.length} past + ${next.length} next = ${all.length} points`);
    expect(all.length).toBeGreaterThan(300);
    expect(past.at(-1)!.t.getTime()).toBe(now.getTime());
    expect(next[0].t.getTime()).toBe(now.getTime());
    for (const p of all) {
      const s = stateAt(satrec, p.t)!;
      expect(p.latDeg).toBe(s.latDeg);
      expect(p.lonDeg).toBe(s.lonDeg);
      expect(p.altKm).toBe(s.altKm);
    }
    // 30 s apart, one period each way
    expect(next[1].t.getTime() - next[0].t.getTime()).toBe(30_000);
    expect((next.at(-1)!.t.getTime() - now.getTime()) / 60_000).toBeGreaterThan(periodMinutes(satrec) - 0.5);
  });

  test('(h) raySphere through the middle of the view returns the view centre; a miss returns nothing', () => {
    for (const [lat, lon, dist] of [[20, -40, 3.2], [-33.9, 151.2, 1.6], [51.6, 179.9, 8], [0, 0, 2]]) {
      const cam = cameraFor(lat, lon, dist);
      const hit = raySphere(cam, [-cam[0], -cam[1], -cam[2]])!;
      const ll = vec3ToLatLon(hit);
      expect(Math.abs(ll.latDeg - lat)).toBeLessThan(1e-6);
      expect(lonGap(ll.lonDeg, lon)).toBeLessThan(1e-6);
      expect(Math.abs(Math.hypot(...hit) - 1)).toBeLessThan(1e-12);
    }
    // a ray that passes 1.5 radii from the centre, and one pointing away from the Earth
    expect(raySphere([0, 1.5, 5], [0, 0, -1])).toBeNull();
    expect(raySphere([0, 0, 5], [0, 0, 1])).toBeNull();
  });
});

describe('G1 view choice (src/globe/view.ts)', () => {
  const good: ProbeResult = { webgl2: true, caveat: false, renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)', gaps: Array(30).fill(16.7), timedOut: false };
  const base = { def: 'flat' as const, reducedMotion: false };

  test('(i) the chooseView table', () => {
    // at load: the flag beats the saved choice beats the default
    expect(chooseView({ ...base, flag: '3d', saved: 'flat' })).toEqual({ view: '3d', why: 'flag' });
    expect(chooseView({ ...base, flag: 'flat', saved: '3d', def: 'auto' })).toEqual({ view: 'flat', why: 'flag' });
    expect(chooseView({ ...base, flag: null, saved: '3d' })).toEqual({ view: '3d', why: 'saved' });
    expect(chooseView({ ...base, flag: 'nonsense', saved: 'flat', def: 'auto' })).toEqual({ view: 'flat', why: 'saved' });
    expect(chooseView({ ...base, flag: null, saved: null })).toEqual({ view: 'flat', why: 'default' });
    expect(DEFAULT_VIEW).toBe('flat');
    // a press beats the flag (and the saved choice, and reduced motion)
    expect(chooseView({ ...base, press: 'flat', flag: '3d', saved: '3d' })).toEqual({ view: 'flat', why: 'press' });
    expect(chooseView({ ...base, press: '3d', flag: 'flat', reducedMotion: true })).toEqual({ view: '3d', why: 'press' });
    // a 3D choice where WebGL2 is missing stays flat
    expect(chooseView({ ...base, press: '3d', probe: { ...good, webgl2: false } })).toEqual({ view: 'flat', why: 'no-webgl' });
    // 'auto': each reason gives flat with that reason; all good gives 3d
    const auto = { ...base, flag: 'auto' };
    expect(chooseView(auto)).toEqual({ view: 'probe', why: 'auto' });
    expect(chooseView({ ...auto, probe: { ...good, webgl2: false, renderer: '' } })).toEqual({ view: 'flat', why: 'no-webgl' });
    expect(chooseView({ ...auto, probe: { ...good, caveat: true } })).toEqual({ view: 'flat', why: 'caveat' });
    for (const r of ['ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)', 'llvmpipe (LLVM 15.0.7, 256 bits)', 'softpipe', 'ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11 vs_5_0 ps_5_0)'])
      expect(chooseView({ ...auto, probe: { ...good, renderer: r } })).toEqual({ view: 'flat', why: 'software' });
    expect(chooseView({ ...auto, probe: { ...good, gaps: Array(30).fill(50) } })).toEqual({ view: 'flat', why: 'slow' });
    expect(chooseView({ ...auto, probe: { ...good, gaps: Array(12).fill(16), timedOut: true } })).toEqual({ view: 'flat', why: 'slow' });
    expect(chooseView({ ...auto, reducedMotion: true, probe: good })).toEqual({ view: 'flat', why: 'reduced-motion' });
    expect(chooseView({ ...auto, probe: good })).toEqual({ view: '3d', why: 'auto' });
    // the default 'auto' behaves the same with no flag
    expect(chooseView({ ...base, def: 'auto', probe: good })).toEqual({ view: '3d', why: 'auto' });
  });

  test('(j) the speed decision needs a finished array of 30 gaps', () => {
    const gaps = (median: number) => [...Array(15).fill(median - 5), ...Array(15).fill(median + 5)].map((g, i) => (i === 14 || i === 15 ? median : g));
    expect(speedDecision(gaps(34))).toBe('slow');
    expect(speedDecision(gaps(33))).toBe('fast');
    expect(speedDecision(gaps(33).slice(0, 29))).toBeNull();
    expect(speedDecision(null)).toBeNull();
    const auto = { def: 'flat' as const, reducedMotion: false, flag: 'auto' };
    const probe = (g: number[]): ProbeResult => ({ webgl2: true, caveat: false, renderer: 'ANGLE (Intel, Intel(R) UHD Graphics)', gaps: g, timedOut: false });
    expect(chooseView({ ...auto, probe: probe(gaps(34)) })).toEqual({ view: 'flat', why: 'slow' });
    expect(chooseView({ ...auto, probe: probe(gaps(33)) })).toEqual({ view: '3d', why: 'auto' });
    expect(chooseView({ ...auto, probe: probe(gaps(33).slice(0, 29)) })).toEqual({ view: 'probe', why: 'auto' });
  });
});
