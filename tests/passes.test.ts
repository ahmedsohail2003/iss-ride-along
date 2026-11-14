// M5 acceptance: the visible-pass predictor against the hand-made Heavens-Above fixture for Ypsilanti,
// a polar city, and the 5-day search time. Tolerances from PLAN.md M5: same count, start ±5 s,
// end ±15 s, peak ±3 deg; the 5-day search fails only above 10 s.
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { observer, satrecFromTle } from '../src/orbit/orbit';
import {
  agreementWith,
  compass,
  findVisiblePasses,
  isVisibleAt,
  predictForPlace,
  type PassFixture,
} from '../src/orbit/passes';

const fx: PassFixture = JSON.parse(
  readFileSync(new URL('./fixtures/passes-ypsilanti-2026-11-14.json', import.meta.url), 'utf8'),
);
const satrec = satrecFromTle(`${fx.tle.line1}\n${fx.tle.line2}`);
const obs = observer(fx.observer.latDeg, fx.observer.lonDeg, fx.observer.heightM / 1000);
// Fixture times are EST (UTC-5).
const est = (date: string, hms: string) => new Date(`${date}T${hms}-05:00`).getTime();
const hms = (d: Date) =>
  d.toLocaleTimeString('en-US', { timeZone: 'America/Detroit', hour12: false });

describe('visible passes: Ypsilanti vs Heavens-Above (fixture)', () => {
  const { passes } = findVisiblePasses(satrec, obs, new Date(fx.window.startUtc), new Date(fx.window.endUtc));

  test('fixture is the 8-row research table with its orbit data', () => {
    expect(fx.passes).toHaveLength(8);
    expect(fx.tle.line1.startsWith('1 25544')).toBe(true);
    // Same orbit data as the page's built-in copy.
    const builtIn = readFileSync(new URL('../src/data/iss.tle', import.meta.url), 'utf8');
    expect(builtIn).toContain(fx.tle.line1);
    expect(builtIn).toContain(fx.tle.line2);
  });

  test('same number of visible passes (8)', () => {
    expect(passes.length).toBe(fx.passes.length);
  });

  test('each pass: start within 5 s, end within 15 s, highest point within 3 deg', () => {
    const rows = fx.passes.map((r, i) => {
      const p = passes[i];
      return {
        ref: `${r.date} ${r.start}-${r.end} ${r.peakElDeg}°`,
        ours: `${hms(p.start)}-${hms(p.end)} ${p.peakElDeg.toFixed(1)}°`,
        dStartS: +((p.start.getTime() - est(r.date, r.start)) / 1000).toFixed(1),
        dEndS: +((p.end.getTime() - est(r.date, r.end)) / 1000).toFixed(1),
        dPeakDeg: +(p.peakElDeg - r.peakElDeg).toFixed(2),
      };
    });
    console.table(rows);
    for (const r of rows) {
      expect(Math.abs(r.dStartS), `start ${r.ref}`).toBeLessThanOrEqual(5);
      expect(Math.abs(r.dEndS), `end ${r.ref}`).toBeLessThanOrEqual(15);
      expect(Math.abs(r.dPeakDeg), `peak ${r.ref}`).toBeLessThanOrEqual(3);
    }
  });

  test('every reported pass obeys the rule: visible at its start, peak and end, not just outside', () => {
    for (const p of passes) {
      for (const t of [p.start, p.peak, p.end]) expect(isVisibleAt(satrec, obs, t.getTime())).toBe(true);
      expect(isVisibleAt(satrec, obs, p.start.getTime() - 1000)).toBe(false);
      expect(isVisibleAt(satrec, obs, p.end.getTime() + 1000)).toBe(false);
      expect(p.peakElDeg).toBeGreaterThanOrEqual(p.startElDeg - 1e-9);
      expect(p.peakElDeg).toBeGreaterThanOrEqual(p.endElDeg - 1e-9);
    }
  });

  test('tonight 5:56 PM pass: rises in the south-west, ends while still high (fades into the shadow)', () => {
    const p = passes[0];
    expect(compass(p.startAzDeg)).toMatch(/^(SW|WSW|SSW)$/);
    expect(p.startsBy).toBe('rises');
    expect(p.endsBy).toBe('enters-shadow');
  });

  test('the agreement line the page prints equals this test’s own comparison', () => {
    const a = agreementWith(fx);
    expect(a.refCount).toBe(8);
    expect(a.ourCount).toBe(8);
    expect(a.matched).toBe(8);
    const own = fx.passes.map((r, i) => ({
      s: Math.abs(passes[i].start.getTime() - est(r.date, r.start)) / 1000,
      e: Math.abs(passes[i].end.getTime() - est(r.date, r.end)) / 1000,
      p: Math.abs(passes[i].peakElDeg - r.peakElDeg),
    }));
    expect(a.maxStartS).toBeCloseTo(Math.max(...own.map((o) => o.s)), 6);
    expect(a.maxEndS).toBeCloseTo(Math.max(...own.map((o) => o.e)), 6);
    expect(a.maxPeakDeg).toBeCloseTo(Math.max(...own.map((o) => o.p)), 6);
    console.log(
      `agreement: ${a.matched} of ${a.refCount} matched, start within ${a.maxStartS.toFixed(1)} s, ` +
        `end within ${a.maxEndS.toFixed(1)} s, peak within ${a.maxPeakDeg.toFixed(2)} deg`,
    );
  });
});

describe('places with no visible pass', () => {
  const from = new Date(fx.window.startUtc);

  test('a polar city (Alert, Nunavut, 82.5 N) returns an empty list and a plain message', () => {
    const r = predictForPlace(satrec, { name: 'Alert, Nunavut', latDeg: 82.5, lonDeg: -62.35 }, from, 5);
    expect(r.passes).toEqual([]);
    expect(r.highPasses).toBe(0);
    expect(r.message).toMatch(/^From Alert, Nunavut the station never climbs 10 degrees above the horizon/);
    expect(r.message).toContain('51.6 degrees of the equator, so this far north it never rises high enough to see');
    console.log(`polar message: ${r.message}`);
  });

  test('McMurdo Station (77.85 S) also returns an empty list with the message', () => {
    const r = predictForPlace(satrec, { name: 'McMurdo Station', latDeg: -77.85, lonDeg: 166.67 }, from, 5);
    expect(r.passes).toEqual([]);
    expect(r.message).not.toBeNull();
  });

  test('daytime only: passes overhead but none visible gives the other plain message', () => {
    // Ypsilanti, Nov 16 2:00-5:00 PM EST: the 4:21 PM pass climbs above 10 degrees with the Sun still up.
    const day = new Date('2026-11-16T19:00:00Z');
    const r = predictForPlace(satrec, { name: 'Ypsilanti', latDeg: 42.24, lonDeg: -83.61 }, day, 3 / 24);
    expect(r.passes).toEqual([]);
    expect(r.highPasses).toBeGreaterThan(0);
    expect(r.message).toMatch(/1 time in the next 3 hours, but never while the sky there is dark/);
  });

  test('a city with passes has no message', () => {
    const r = predictForPlace(satrec, { name: 'Ypsilanti', latDeg: 42.24, lonDeg: -83.61, heightM: 220 }, from, 5);
    expect(r.passes.length).toBeGreaterThan(0);
    expect(r.message).toBeNull();
  });
});

describe('search time', () => {
  test('a 5-day search is logged and fails only above 10 s', () => {
    const r = predictForPlace(satrec, { name: 'Ypsilanti', latDeg: 42.24, lonDeg: -83.61, heightM: 220 }, new Date(fx.window.startUtc), 5);
    console.log(`5-day pass search (Ypsilanti): ${r.searchMs.toFixed(0)} ms, ${r.passes.length} visible passes, ${r.highPasses} above 10 deg`);
    expect(r.searchMs).toBeLessThanOrEqual(10_000);
  });
});

describe('compass', () => {
  test('16 points, wraps at 360', () => {
    expect([0, 22.5, 90, 180, 225, 247.5, 359, 360, -90].map(compass)).toEqual(['N', 'NNE', 'E', 'S', 'SW', 'WSW', 'N', 'N', 'W']);
  });
});
