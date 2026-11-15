// G7: the dotted space scene's pure parts (src/bg/scene.ts): the point builders, the parallax offset and the ease.
import { describe, expect, it } from 'vitest';
import { cloudPoints, DEPTH, ease, fibSphere, moonPoints, parallaxOffset, ringPoints, seeded, starPoints } from '../src/bg/scene';

const len = (p: { x: number; y: number; z: number }) => Math.hypot(p.x, p.y, p.z);

describe('G7 point builders', () => {
  it('return the counts asked for, and unit-sphere points where a sphere is meant', () => {
    for (const n of [1, 50, 700, 9000]) {
      const s = fibSphere(n);
      expect(s).toHaveLength(n);
      for (const p of s) expect(Math.abs(len(p) - 1)).toBeLessThan(1e-12);
    }
    const m = moonPoints(2000);
    expect(m).toHaveLength(2000);
    for (const { p, shade } of m) {
      expect(Math.abs(len(p) - 1)).toBeLessThan(1e-12);
      expect(shade).toBeGreaterThan(0);
      expect(shade).toBeLessThanOrEqual(1);
    }
    // the Moon has darker patches, but most of it is bright ground
    const dark = m.filter((x) => x.shade < 1).length;
    expect(dark).toBeGreaterThan(0);
    expect(dark).toBeLessThan(m.length / 2);
    const r = ringPoints(900, 1.45, 2.3, seeded(5));
    expect(r).toHaveLength(900);
    for (const p of r) {
      expect(p.y).toBe(0);
      expect(len(p)).toBeGreaterThanOrEqual(1.45 - 1e-9);
      expect(len(p)).toBeLessThanOrEqual(2.3 + 1e-9);
    }
    expect(cloudPoints(380, 1.8, seeded(37))).toHaveLength(380);
    const st = starPoints(260, seeded(101));
    expect(st).toHaveLength(260);
    for (const s of st) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThan(1);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThan(1);
    }
    // seeded: the same scene on every load
    expect(starPoints(5, seeded(9))).toEqual(starPoints(5, seeded(9)));
  });
});

describe('G7 parallax', () => {
  const W = 1366;
  const H = 768;
  it('is 0 at the centre of the window', () => {
    for (const d of Object.values(DEPTH)) expect(parallaxOffset(W / 2, H / 2, W, H, d, false)).toEqual({ x: 0, y: 0 });
  });
  it("grows with the pointer's distance from the centre", () => {
    const m = (px: number, py: number) => Math.hypot(...Object.values(parallaxOffset(px, py, W, H, DEPTH.nearStars, false)));
    expect(m(W / 2 + 100, H / 2)).toBeGreaterThan(0);
    expect(m(W / 2 + 300, H / 2)).toBeGreaterThan(m(W / 2 + 100, H / 2));
    expect(m(W, H / 2)).toBeGreaterThan(m(W / 2 + 300, H / 2));
    expect(m(W / 2, H)).toBeGreaterThan(m(W / 2, H / 2 + 100));
    expect(m(0, 0)).toBeGreaterThan(m(W / 4, H / 4));
  });
  it('is larger for a near layer than for a far one', () => {
    for (const [px, py] of [[0, 0], [W, H], [W * 0.8, H * 0.3]]) {
      const near = parallaxOffset(px, py, W, H, DEPTH.nearStars, false);
      const far = parallaxOffset(px, py, W, H, DEPTH.farStars, false);
      expect(Math.hypot(near.x, near.y)).toBeGreaterThan(Math.hypot(far.x, far.y));
    }
  });
  it('is 0 for every layer when reduced motion is on', () => {
    for (const d of Object.values(DEPTH)) for (const [px, py] of [[0, 0], [W, H], [10, 700]]) expect(parallaxOffset(px, py, W, H, d, true)).toEqual({ x: 0, y: 0 });
  });
});

describe('G7 ease', () => {
  it('moves a value toward its target without overshooting', () => {
    for (const [from, to] of [[0, 100], [100, -40], [-3, -2]]) {
      let v = from;
      let prevGap = Math.abs(to - from);
      for (let i = 0; i < 200; i++) {
        v = ease(v, to, 1 / 60);
        const gap = Math.abs(to - v);
        expect(gap).toBeLessThan(prevGap); // closer every frame
        expect(Math.sign(to - v)).not.toBe(-Math.sign(to - from)); // never past the target
        prevGap = gap;
      }
      expect(Math.abs(to - v)).toBeLessThan(Math.abs(to - from) * 0.01);
      // a long pause (a hidden tab) lands on the target at most, never past it
      const big = ease(from, to, 1000);
      expect(Math.abs(big - to)).toBeLessThanOrEqual(Math.abs(to - from));
      expect((big - from) * (to - from)).toBeGreaterThanOrEqual(0);
      expect(Math.abs(big - from)).toBeLessThanOrEqual(Math.abs(to - from));
    }
    expect(ease(5, 9, 0)).toBe(5);
  });
});
