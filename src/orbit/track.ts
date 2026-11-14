// Pure helpers for the tracker page: orbit period, element-set epoch and age, ground track.
// No I/O and no DOM, so the tests can run them in Node.
import type { SatRec } from 'satellite.js';
import { stateAt } from './orbit';

const MS_PER_DAY = 86_400_000;
/** Julian date of the Unix epoch, 1970-01-01T00:00:00Z. */
const JD_UNIX_EPOCH = 2440587.5;

/** Orbital period in minutes from SGP4's mean motion (satrec.no is in radians per minute). */
export function periodMinutes(satrec: SatRec): number {
  return (2 * Math.PI) / satrec.no;
}

/** The moment the element set describes (its epoch), as a Date. */
export function elementEpoch(satrec: SatRec): Date {
  return new Date((satrec.jdsatepoch - JD_UNIX_EPOCH) * MS_PER_DAY);
}

export type AgeLevel = 'fresh' | 'aging' | 'stale';

/**
 * How much to trust the element set at `now`. SGP4 error grows with age (roughly 1-3 km per day
 * is the commonly quoted figure; no ISS-specific peer-reviewed number was found), so the label is
 * green under 1 day, amber from 1 to 3 days, red over 3 days.
 */
export function ageLevel(epoch: Date, now: Date): AgeLevel {
  const days = (now.getTime() - epoch.getTime()) / MS_PER_DAY;
  if (days < 1) return 'fresh';
  if (days <= 3) return 'aging';
  return 'stale';
}

/** "5 h 12 min", "2 d 3 h" or "40 min": a short age for the label. Negative ages read as 0 min. */
export function formatAge(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min`;
}

export type LatLon = [number, number];

/**
 * Split a path of [lat, lon] points wherever it crosses the antimeridian (longitude jumps by more
 * than 180 degrees between neighbours), so a 2D map does not draw a line across the whole world.
 */
export function splitAtAntimeridian(points: LatLon[]): LatLon[][] {
  const segments: LatLon[][] = [];
  let current: LatLon[] = [];
  for (const p of points) {
    const prev = current.at(-1);
    if (prev && Math.abs(p[1] - prev[1]) > 180) {
      segments.push(current);
      current = [];
    }
    current.push(p);
  }
  if (current.length) segments.push(current);
  return segments;
}

/**
 * Sub-satellite points from `fromMin` to `toMin` minutes around `center`, every `stepS` seconds,
 * split at the antimeridian. Points where SGP4 fails are skipped.
 */
export function groundTrack(satrec: SatRec, center: Date, fromMin: number, toMin: number, stepS = 30): LatLon[][] {
  const points: LatLon[] = [];
  const t0 = center.getTime();
  for (let s = fromMin * 60; s <= toMin * 60; s += stepS) {
    const st = stateAt(satrec, new Date(t0 + s * 1000));
    if (st) points.push([st.latDeg, st.lonDeg]);
  }
  return splitAtAntimeridian(points);
}
