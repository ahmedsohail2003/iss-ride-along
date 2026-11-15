// X5b acceptance: the drag-and-zoom star chart's projection.
// (a) projecting a direction and un-projecting it returns the same direction within 0.01 degree, at 200
//     directions spread over the whole sky, for several views and zooms;
// (b) the angle between two named stars measured on screen near the centre (pixels x the chart's scale at
//     its centre) matches their true separation (from the catalogue, by the haversine formula written here)
//     within 1%;
// (c) zoom stays inside its limits whatever the wheel, pinch or keys ask for;
// plus: the station's view is exactly the fixed X5 chart, and a drag keeps the grabbed star under the pointer.
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { chartXY, horizontal, raDecToVec, stationSky, type StarRow } from '../src/sky/sky';
import { angleDeg, clampFov, dragView, FOV_MAX, FOV_MIN, isOrthonormal, norm, project, pxScale, stationView, unproject, zoomFov, type View } from '../src/sky/projection';

const stars = JSON.parse(readFileSync(new URL('../src/data/sky/stars.json', import.meta.url), 'utf8')) as StarRow[];
const star = (n: string) => {
  const s = stars.find((r) => r[5] === n);
  if (!s) throw new Error(`${n} not in the catalogue`);
  return s;
};
const R = 222; // the chart radius on a 480 px canvas

/** 200 directions spread evenly over the sphere (Fibonacci lattice). */
function fibonacci(n: number) {
  const out = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const z = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - z * z);
    out.push({ x: r * Math.cos(golden * i), y: r * Math.sin(golden * i), z });
  }
  return out;
}

/** Haversine separation of two (RA, Dec) in degrees: an independent formula, not the vectors the module uses. */
function haversineDeg(ra1: number, dec1: number, ra2: number, dec2: number): number {
  const r = Math.PI / 180;
  const h = Math.sin(((dec2 - dec1) * r) / 2) ** 2 + Math.cos(dec1 * r) * Math.cos(dec2 * r) * Math.sin(((ra2 - ra1) * r) / 2) ** 2;
  return (2 * Math.asin(Math.sqrt(h))) / r;
}

const at = new Date('2026-11-15T03:00:00Z');
const sky = stationSky(at, 42.2411, -83.613);
const home = stationView(sky.up, sky.north, sky.east);
// A second view far from the first: dragged most of the way across the chart.
const turned = dragView(home, 150, 40, -60, -120, 180, R);

describe('X5b (a): project then un-project gives the same direction', () => {
  const dirs = fibonacci(200);
  for (const [label, view, fov] of [
    ['station view, 180 deg across', home, 180],
    ['turned view, 90 deg across', turned, 90],
    ['station view, 30 deg across', home, 30],
  ] as [string, View, number][]) {
    test(`${label}: 200 directions, worst error under 0.01 deg`, () => {
      let worst = 0;
      let n = 0;
      for (const d of dirs) {
        const p = project(d, view, fov, R);
        expect(p).not.toBeNull(); // no lattice point is within 0.003 deg of straight behind the view
        const back = unproject(p!.x, p!.y, view, fov, R);
        worst = Math.max(worst, angleDeg(d, back));
        n++;
      }
      expect(n).toBe(200);
      console.log(`${label}: worst round-trip error ${worst.toExponential(2)} deg over ${n} directions`);
      expect(worst).toBeLessThan(0.01);
    });
  }
});

describe('X5b (b): an angle measured on screen near the centre is the true angle', () => {
  for (const [a, b] of [
    ['Dubhe', 'Merak'],
    ['Betelgeuse', 'Rigel'],
    ['Castor', 'Pollux'],
  ]) {
    test(`${a} to ${b}`, () => {
      const [ra1, dec1] = star(a);
      const [ra2, dec2] = star(b);
      const truth = haversineDeg(ra1, dec1, ra2, dec2);
      // Centre the view on the pair (the midpoint direction), any roll, zoomed in to 60 deg across.
      const va = raDecToVec(ra1, dec1);
      const vb = raDecToVec(ra2, dec2);
      const mid = norm({ x: va.x + vb.x, y: va.y + vb.y, z: va.z + vb.z }); // project() takes unit vectors
      const pm = project(mid, home, 180, R)!;
      const view = dragView(home, pm.x, pm.y, 0, 0, 180, R);
      const pa = project(va, view, 60, R)!;
      const pb = project(vb, view, 60, R)!;
      const px = Math.hypot(pa.x - pb.x, pa.y - pb.y);
      // At the centre a stereographic chart has pxScale px per radian.
      const measured = (px / pxScale(60, R)) * (180 / Math.PI);
      const relErr = Math.abs(measured - truth) / truth;
      console.log(`${a}-${b}: true ${truth.toFixed(3)} deg, on screen ${measured.toFixed(3)} deg (${(relErr * 100).toFixed(3)}%)`);
      expect(Math.hypot(pa.x + pb.x, pa.y + pb.y) / 2).toBeLessThan(1e-6); // the pair is centred
      expect(relErr).toBeLessThan(0.01);
    });
  }
});

describe('X5b (c): zoom stays inside its limits', () => {
  test(`limits are ${FOV_MIN} and ${FOV_MAX} degrees across`, () => {
    let fov = FOV_MAX;
    for (let i = 0; i < 100; i++) fov = zoomFov(fov, 1 / 1.25); // 100 presses of +
    expect(fov).toBe(FOV_MIN);
    for (let i = 0; i < 100; i++) fov = zoomFov(fov, Math.exp(500 * 0.0015)); // 100 big wheel turns outwards
    expect(fov).toBe(FOV_MAX);
    for (const f of [0, -1, NaN, Infinity, -Infinity, 1e-300, 1e300]) {
      const z = zoomFov(90, f);
      expect(z).toBeGreaterThanOrEqual(FOV_MIN);
      expect(z).toBeLessThanOrEqual(FOV_MAX);
    }
    for (const f of [-50, 0, 29.9, 30, 100, 180, 181, 1e9, NaN]) {
      const z = clampFov(f);
      expect(z).toBeGreaterThanOrEqual(FOV_MIN);
      expect(z).toBeLessThanOrEqual(FOV_MAX);
    }
    // A pinch: fingers twice as far apart halves the field, and again, and again: it stops at the limit.
    let p = 120;
    for (let i = 0; i < 5; i++) p = zoomFov(p, 0.5);
    expect(p).toBe(FOV_MIN);
  });
});

describe('X5b: the station view is the X5 chart, and a drag follows the pointer', () => {
  test('station view at 180 deg across = chartXY() for 50 stars above the horizon, within 0.001 px', () => {
    let checked = 0;
    for (const s of stars.slice(0, 400)) {
      const h = horizontal(sky, s[0], s[1]);
      if (h.altDeg < 0) continue;
      const a = chartXY(h.altDeg, h.azDeg, R)!;
      const b = project(raDecToVec(s[0], s[1]), home, 180, R)!;
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(0.001);
      if (++checked === 50) break;
    }
    expect(checked).toBe(50);
  });
  test('the grabbed star ends under the pointer; the camera stays orthonormal', () => {
    let v = home;
    const sirius = raDecToVec(star('Sirius')[0], star('Sirius')[1]);
    let p = project(sirius, v, 120, R)!;
    for (const [dx, dy] of [[30, -10], [-80, 45], [12, 200], [-150, -150]]) {
      v = dragView(v, p.x, p.y, p.x + dx, p.y + dy, 120, R);
      const q = project(sirius, v, 120, R)!;
      expect(Math.hypot(q.x - (p.x + dx), q.y - (p.y + dy))).toBeLessThan(1e-6);
      expect(isOrthonormal(v)).toBe(true);
      p = q;
    }
    // A drag moves the view centre; the station's view is straight up.
    expect(angleDeg(v.f, sky.up)).toBeGreaterThan(5);
    expect(angleDeg(home.f, sky.up)).toBeLessThan(1e-9);
  });
});
