// Compare our computed position with a reference tracker's answer for the same instant. Pure.
import type { SatRec } from 'satellite.js';
import { greatCircleKm, stateAt } from './orbit';

/** One position from wheretheiss.at (units=kilometers): degrees, km, km/h, Unix seconds. */
export interface ReferenceSample {
  timestamp: number;
  latitude: number;
  longitude: number;
  altitude: number;
  velocity: number;
}

export interface Comparison {
  at: Date;
  /** Ground distance between the two sub-satellite points, km. */
  errorKm: number;
  /** Our altitude minus theirs, km. */
  dAltKm: number;
  /** Our orbital speed minus theirs, km/h. */
  dSpeedKmH: number;
  ours: { latDeg: number; lonDeg: number; altKm: number; speedKmH: number };
}

/** Propagate to the reference's own timestamp, so both numbers describe the same instant. */
export function compareWithReference(satrec: SatRec, ref: ReferenceSample): Comparison | null {
  const at = new Date(ref.timestamp * 1000);
  const s = stateAt(satrec, at);
  if (!s) return null;
  const speedKmH = s.speedKmS * 3600;
  return {
    at,
    errorKm: greatCircleKm(s.latDeg, s.lonDeg, ref.latitude, ref.longitude),
    dAltKm: s.altKm - ref.altitude,
    dSpeedKmH: speedKmH - ref.velocity,
    ours: { latDeg: s.latDeg, lonDeg: s.lonDeg, altKm: s.altKm, speedKmH },
  };
}
