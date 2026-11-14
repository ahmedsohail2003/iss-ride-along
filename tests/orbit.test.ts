// Offline checks for src/orbit/orbit.ts, ported from the 12:35 PM spike (.autopilot/spike/orbit.test.mjs).
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { greatCircleKm, isSunlitCylinder, satrecFromOmm, satrecFromTle, stateAt } from '../src/orbit/orbit';

const dataUrl = (name: string) => new URL(`../src/data/${name}`, import.meta.url);
const tle = readFileSync(dataUrl('iss.tle'), 'utf8');
const omm = JSON.parse(readFileSync(dataUrl('iss.omm.json'), 'utf8'));
const epoch = new Date(omm[0].EPOCH + 'Z');

describe('orbit', () => {
  test('greatCircleKm: one degree of longitude on the equator is about 111.2 km, across the antimeridian too', () => {
    expect(Math.abs(greatCircleKm(0, 0, 0, 1) - 111.195)).toBeLessThan(0.01);
    expect(Math.abs(greatCircleKm(10, 179.5, 10, -179.5) - greatCircleKm(10, 0, 10, 1))).toBeLessThan(1e-6);
  });

  test('stateAt: altitude 380-460 km, speed 7.6-7.7 km/s and latitude within the inclination at the TLE epoch', () => {
    const s = stateAt(satrecFromTle(tle), epoch);
    expect(s).not.toBeNull();
    expect(s!.altKm).toBeGreaterThan(380);
    expect(s!.altKm).toBeLessThan(460);
    expect(s!.speedKmS).toBeGreaterThan(7.6);
    expect(s!.speedKmS).toBeLessThan(7.7);
    expect(Math.abs(s!.latDeg)).toBeLessThanOrEqual(51.7);
  });

  test('TLE and OMM JSON give the same position (under 10 m) one hour after epoch', () => {
    const t = new Date(epoch.getTime() + 3600e3);
    const a = stateAt(satrecFromTle(tle), t)!;
    const b = stateAt(satrecFromOmm(omm), t)!;
    expect(greatCircleKm(a.latDeg, a.lonDeg, b.latDeg, b.lonDeg)).toBeLessThan(0.01);
  });

  test('isSunlitCylinder: day side lit, directly behind Earth dark, far off-axis lit', () => {
    const sun = { x: 1.5e8, y: 0, z: 0 };
    expect(isSunlitCylinder({ x: 6800, y: 0, z: 0 }, sun)).toBe(true);
    expect(isSunlitCylinder({ x: -6800, y: 0, z: 0 }, sun)).toBe(false);
    expect(isSunlitCylinder({ x: -100, y: 6800, z: 0 }, sun)).toBe(true);
  });
});

describe('snapshot data', () => {
  test('src/data holds the TLE, the OMM, 10 reference samples with their TLE, and 150 cities', () => {
    expect(tle.trim().split(/\r?\n/).at(-2)!.startsWith('1 25544')).toBe(true);
    expect(omm[0].NORAD_CAT_ID).toBe(25544);
    const wti = JSON.parse(readFileSync(dataUrl('wheretheiss-samples.json'), 'utf8'));
    expect(wti.samples).toHaveLength(10);
    expect(wti.tle.line1.startsWith('1 25544')).toBe(true);
    const cities = JSON.parse(readFileSync(dataUrl('cities.json'), 'utf8'));
    expect(cities).toHaveLength(150);
    const jpg = readFileSync(dataUrl('bluemarble-z0.jpg'));
    expect([jpg[0], jpg[1]]).toEqual([0xff, 0xd8]);
  });
});
