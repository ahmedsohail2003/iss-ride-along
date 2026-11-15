// The orbit lab readout (M6): how long one circular orbit takes, and how fast, at a given height.
// Textbook two-body physics, no I/O and no DOM. A circular orbit of radius r = Earth radius + height
// needs speed v = sqrt(mu / r) and takes T = 2 pi r / v. The station's real orbit is slightly
// elliptical and SGP4 adds drag and Earth's bulge, so the page labels this "a circular orbit".
import { RE_EQ_KM } from './orbit';

/** Earth's gravitational parameter GM in km^3/s^2 (WGS-84 value). */
export const MU_EARTH_KM3_S2 = 398600.4418;

/** Speed in km/s of a circular orbit `altKm` above the WGS-84 equatorial radius (6,378.137 km). */
export function circularSpeed(altKm: number): number {
  return Math.sqrt(MU_EARTH_KM3_S2 / (RE_EQ_KM + altKm));
}

/** Time in minutes for one circular orbit `altKm` above the WGS-84 equatorial radius. */
export function period(altKm: number): number {
  const r = RE_EQ_KM + altKm;
  return (2 * Math.PI * Math.sqrt(r ** 3 / MU_EARTH_KM3_S2)) / 60;
}

/** The sentence under the numbers panel. */
export function orbitLabLine(altKm: number): string {
  return `At this height a circular orbit takes ${period(altKm).toFixed(1)} min at ${circularSpeed(altKm).toFixed(2)} km/s.`;
}
