// A2: what the station flies over on its way to you. For the 10 minutes before a pass starts, the
// station's position every minute, and the NASA EONET events and curated NASA photos that fall inside
// its horizon footprint at any of those minutes (M4's footprint code). Pure, no I/O.
import type { SatRec } from 'satellite.js';
import { stateAt } from '../orbit/orbit';
import { splitByFootprint, type Located } from './footprint';

export const BEFORE_MINUTES = 10;
export const MAX_EVENTS = 5;

export interface Sighting<T> {
  item: T;
  /** Closest ground distance (km) from the point under the station during the minutes searched. */
  km: number;
  /** The minute that distance was reached. */
  at: Date;
}

/** Items inside the footprint at any minute in the `minutes` before `start`, nearest first. */
export function inViewBefore<T extends Located>(satrec: SatRec, start: Date, items: T[], minutes = BEFORE_MINUTES): Sighting<T>[] {
  const best = new Map<T, Sighting<T>>();
  for (let m = minutes; m >= 0; m--) {
    const at = new Date(start.getTime() - m * 60_000);
    const s = stateAt(satrec, at);
    if (!s) continue;
    for (const d of splitByFootprint(items, s.latDeg, s.lonDeg, s.altKm).inView) {
      const prev = best.get(d.item);
      if (!prev || d.km < prev.km) best.set(d.item, { item: d.item, km: d.km, at });
    }
  }
  return [...best.values()].sort((a, b) => a.km - b.km);
}
