// Pure helpers behind the tracker page: period, epoch, data-age label, ground track splitting.
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { satrecFromTle } from '../src/orbit/orbit';
import { ageLevel, elementEpoch, formatAge, groundTrack, periodMinutes, splitAtAntimeridian } from '../src/orbit/track';
import { parseIssTle } from '../src/elements';

const tle = readFileSync(new URL('../src/data/iss.tle', import.meta.url), 'utf8');
const meta = JSON.parse(readFileSync(new URL('../src/data/snapshot-meta.json', import.meta.url), 'utf8'));
const satrec = satrecFromTle(tle);

describe('track helpers', () => {
  test('periodMinutes: about 92-93 min for the ISS', () => {
    const p = periodMinutes(satrec);
    expect(p).toBeGreaterThan(92);
    expect(p).toBeLessThan(93.5);
  });

  test('elementEpoch matches the epoch recorded in snapshot-meta.json (within 1 ms)', () => {
    const want = new Date(meta.files['iss.tle'].tleEpoch).getTime();
    expect(Math.abs(elementEpoch(satrec).getTime() - want)).toBeLessThanOrEqual(1);
  });

  test('ageLevel: fresh under 1 day, aging 1-3 days, stale over 3 days', () => {
    const e = new Date('2026-11-14T00:00:00Z');
    const h = (n: number) => new Date(e.getTime() + n * 3600e3);
    expect(ageLevel(e, h(23))).toBe('fresh');
    expect(ageLevel(e, h(30))).toBe('aging');
    expect(ageLevel(e, h(80))).toBe('stale');
  });

  test('formatAge', () => {
    expect(formatAge(40 * 60e3)).toBe('40 min');
    expect(formatAge((5 * 60 + 12) * 60e3)).toBe('5 h 12 min');
    expect(formatAge((51 * 60 + 5) * 60e3)).toBe('2 d 3 h');
    expect(formatAge(-5)).toBe('0 min');
  });

  test('splitAtAntimeridian cuts where longitude jumps across 180', () => {
    const segs = splitAtAntimeridian([
      [0, 170],
      [1, 179],
      [2, -178],
      [3, -170],
    ]);
    expect(segs).toEqual([
      [
        [0, 170],
        [1, 179],
      ],
      [
        [2, -178],
        [3, -170],
      ],
    ]);
  });

  test('groundTrack over one orbit: about 186 points at 30 s, no segment jumps more than 180 deg', () => {
    const p = periodMinutes(satrec);
    const segs = groundTrack(satrec, elementEpoch(satrec), 0, p);
    const n = segs.reduce((a, s) => a + s.length, 0);
    expect(n).toBe(Math.floor((p * 60) / 30) + 1);
    for (const s of segs) for (let i = 1; i < s.length; i++) expect(Math.abs(s[i][1] - s[i - 1][1])).toBeLessThan(180);
    expect(segs.length).toBeGreaterThanOrEqual(2);
  });

  test('parseIssTle accepts the embedded TLE and rejects other satellites and junk', () => {
    expect(parseIssTle(tle, 'embedded', new Date())).not.toBeNull();
    expect(parseIssTle('hello', 'live', new Date())).toBeNull();
    const other = tle.replace(/25544/g, '20580');
    expect(parseIssTle(other, 'live', new Date())).toBeNull();
  });
});
