// Our orbit math against NASA's own trajectory, compared only at the file's own row times. Pure.
// At each row time we run SGP4 at exactly that instant, turn its TEME position into J2000 (frames.ts)
// and measure the straight-line distance to NASA's J2000 position for that row. No interpolation:
// the station moves about 1,840 km in 4 minutes, so interpolating between rows would add an error
// as large as the gap being measured. Both sides are predictions; the gap says how far apart they are.
import type { SatRec } from 'satellite.js';
import * as sat from './satellite-lite';
import { distance, temeToJ2000, type Vec3 } from './frames';
import { elementEpoch } from './track';

/** A NASA row reduced to what the comparison needs: time (ms UTC) and J2000 position (km). */
export interface OemPoint {
  t: number;
  x: number;
  y: number;
  z: number;
}

export interface Gap {
  /** The row time (ms UTC). */
  t: number;
  /** Hours from the orbit numbers' epoch to the row time (negative = before the epoch). */
  hoursFromEpoch: number;
  /** Distance between our J2000 position and NASA's, km. */
  gapKm: number;
}

/** The orbit numbers' epoch, ms UTC (the same helper the age line uses). */
export function epochMs(satrec: SatRec): number {
  return elementEpoch(satrec).getTime();
}

/** SGP4 position (TEME, km) at `t` ms, or null when SGP4 fails. */
export function temeAt(satrec: SatRec, t: number): Vec3 | null {
  const pv = sat.propagate(satrec, new Date(t));
  return pv && pv.position ? { x: pv.position.x, y: pv.position.y, z: pv.position.z } : null;
}

/**
 * The gap at one NASA row. `convert: false` skips the TEME -> J2000 conversion (the control that
 * shows the conversion matters).
 */
export function gapAt(satrec: SatRec, row: OemPoint, convert = true, epoch = epochMs(satrec)): Gap | null {
  const teme = temeAt(satrec, row.t);
  if (!teme) return null;
  const ours = convert ? temeToJ2000(teme, new Date(row.t)) : teme;
  return { t: row.t, hoursFromEpoch: (row.t - epoch) / 3_600_000, gapKm: distance(ours, row) };
}

/** Gaps at every row whose time is within [fromH, toH] hours of the epoch. */
export function gapsBetween(satrec: SatRec, rows: OemPoint[], fromH: number, toH: number, convert = true): Gap[] {
  const epoch = epochMs(satrec);
  const out: Gap[] = [];
  for (const r of rows) {
    const h = (r.t - epoch) / 3_600_000;
    if (h < fromH || h > toH) continue;
    const g = gapAt(satrec, r, convert, epoch);
    if (g) out.push(g);
  }
  return out;
}

/** The latest row at or before `now` (ms), or null if `now` is outside the rows. */
export function latestRowAtOrBefore<T extends { t: number }>(rows: T[], now: number): T | null {
  if (rows.length === 0 || now < rows[0].t || now > rows[rows.length - 1].t + 4 * 60_000) return null;
  let lo = 0;
  let hi = rows.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (rows[mid].t <= now) lo = mid;
    else hi = mid - 1;
  }
  return rows[lo];
}

/** The row whose time is nearest to `t` ms. */
export function nearestRow<T extends { t: number }>(rows: T[], t: number): T {
  let best = rows[0];
  for (const r of rows) if (Math.abs(r.t - t) < Math.abs(best.t - t)) best = r;
  return best;
}

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  if (n === 0) return NaN;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}
