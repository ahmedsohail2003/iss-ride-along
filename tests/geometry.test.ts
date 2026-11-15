// Horizon footprint geometry (M4). Reference: wheretheiss.at reports a footprint of 4,596 km
// across at 437.66 km altitude (PLAN.md M4), and a footprint value with each saved sample.
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { footprintDiameterKm, footprintRadiusKm, splitByFootprint } from '../src/nasa/footprint';
import { circularSpeed, orbitLabLine, period } from '../src/orbit/lab';

const wti = JSON.parse(readFileSync(new URL('../src/data/wheretheiss-samples.json', import.meta.url), 'utf8'));

describe('horizon footprint', () => {
  test('diameter at 437.66 km altitude is within 1% of 4,596 km', () => {
    const d = footprintDiameterKm(437.66);
    console.log(`footprint diameter at 437.66 km: ${d.toFixed(1)} km (reference 4,596 km, off by ${((100 * Math.abs(d - 4596)) / 4596).toFixed(3)}%)`);
    expect(Math.abs(d - 4596) / 4596).toBeLessThan(0.01);
  });

  test('matches the footprint wheretheiss.at gives with each of the 10 saved samples within 1%', () => {
    const worst = Math.max(
      ...wti.samples.map((s: { altitude: number; footprint: number }) => Math.abs(footprintDiameterKm(s.altitude) - s.footprint) / s.footprint),
    );
    console.log(`worst footprint difference over ${wti.samples.length} samples: ${(100 * worst).toFixed(3)}%`);
    expect(wti.samples).toHaveLength(10);
    expect(worst).toBeLessThan(0.01);
  });

  test('zero or negative altitude sees nothing; higher sees farther', () => {
    expect(footprintRadiusKm(0)).toBe(0);
    expect(footprintRadiusKm(-5)).toBe(0);
    expect(footprintRadiusKm(800)).toBeGreaterThan(footprintRadiusKm(400));
  });

  test('splitByFootprint keeps places inside the radius, sorted, and still names the nearest', () => {
    const places = [
      { name: 'far', lat: -40, lon: 100 },
      { name: 'near', lat: 1, lon: 1 },
      { name: 'under', lat: 0, lon: 0 },
    ];
    const r = splitByFootprint(places, 0, 0, 420);
    expect(r.inView.map((d) => d.item.name)).toEqual(['under', 'near']);
    expect(r.nearest?.item.name).toBe('under');
    const none = splitByFootprint([places[0]], 0, 0, 420);
    expect(none.inView).toHaveLength(0);
    expect(none.nearest?.item.name).toBe('far');
  });
});

// M6 orbit lab: v = sqrt(mu / r), T = 2 pi sqrt(r^3 / mu), r = 6,378.137 km + height, mu = 398,600.4418 km^3/s^2.
// Reference values are PLAN.md M6's acceptance (7.669 km/s and 92.56 min at 400 km).
describe('orbit lab (circular orbit)', () => {
  test('circularSpeed(400) = 7.669 +/- 0.001 km/s and period(400) = 92.56 +/- 0.01 min', () => {
    const v = circularSpeed(400);
    const t = period(400);
    console.log(`orbit lab at 400 km: ${v.toFixed(4)} km/s, ${t.toFixed(3)} min`);
    expect(Math.abs(v - 7.669)).toBeLessThanOrEqual(0.001);
    expect(Math.abs(t - 92.56)).toBeLessThanOrEqual(0.01);
  });

  test('speed times period is the circle (2 pi r), and higher is slower and longer', () => {
    for (const h of [200, 420, 2000]) {
      expect(circularSpeed(h) * period(h) * 60).toBeCloseTo(2 * Math.PI * (6378.137 + h), 6);
    }
    expect(circularSpeed(2000)).toBeLessThan(circularSpeed(200));
    expect(period(2000)).toBeGreaterThan(period(200));
  });

  test('the readout sentence uses the same two functions', () => {
    expect(orbitLabLine(400)).toBe(`At this height a circular orbit takes ${period(400).toFixed(1)} min at ${circularSpeed(400).toFixed(2)} km/s.`);
    expect(orbitLabLine(400)).toBe('At this height a circular orbit takes 92.6 min at 7.67 km/s.');
  });
});
