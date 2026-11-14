// Horizon footprint geometry (M4). Reference: wheretheiss.at reports a footprint of 4,596 km
// across at 437.66 km altitude (PLAN.md M4), and a footprint value with each saved sample.
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { footprintDiameterKm, footprintRadiusKm, splitByFootprint } from '../src/nasa/footprint';

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
