// G3: the real stars behind the globe, pure (no three.js, no DOM), so the tests check it in Node.
//
// The catalogue is the Sky tab's own (src/data/sky/stars.json, 1,627 stars to magnitude 5, J2000). A star
// is placed as if it were a point on a far sphere round the globe: declination is its "latitude" and right
// ascension its "longitude" (latLonToVec3), and then the whole set is turned about the north axis by minus
// the Greenwich sidereal time (satellite.js gstime, the angle SGP4 itself uses). After that turn the star
// whose right ascension is sidereal time + a longitude and whose declination is a latitude sits straight
// above that place, which is how the Sky tab finds "straight up" (src/sky/sky.ts). Left out on purpose:
// precession since J2000 (about 0.37 degree in 2026; the Sky tab corrects for it, the globe's backdrop does not).
import starsData from '../data/sky/stars.json';
import * as sat from '../orbit/satellite-lite';
import { starRadius, type StarRow } from '../sky/sky';
import { latLonToVec3, type Vec3 } from './geo';

/** Fallback switch (PLAN.md G3): false draws no stars. */
export const STARS_ON = true;
export const STARS = starsData as unknown as StarRow[];
/** How far out the stars are drawn, in Earth radii (well past the camera's farthest point, 8). */
export const STAR_SPHERE = 50;
const DEG = 180 / Math.PI;

/** A star's place before the sidereal turn: declination as latitude, right ascension as longitude. */
export function starLocal(raDeg: number, decDeg: number, r = 1): Vec3 {
  return latLonToVec3(decDeg, raDeg).map((k) => k * r) as Vec3;
}

/** The turn about the north (+Y) axis that puts the stars in the globe's Earth-fixed frame: minus sidereal time. */
export function starsTurnRad(date: Date): number {
  return -sat.gstime(date);
}

/** Turn a point about +Y by `a` radians, the same matrix as three.js's rotation.y (adds `a` to the longitude). */
export function rotateY(v: Vec3, a: number): Vec3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [c * v[0] + s * v[2], v[1], -s * v[0] + c * v[2]];
}

/** Where a star is drawn on the globe's frame at `date` (unit length times r). */
export function starOnGlobe(raDeg: number, decDeg: number, date: Date, r = 1): Vec3 {
  return rotateY(starLocal(raDeg, decDeg, r), starsTurnRad(date));
}

/** Greenwich sidereal time at `date`, degrees 0-360. */
export function siderealDeg(date: Date): number {
  return (((sat.gstime(date) * DEG) % 360) + 360) % 360;
}

/** Point size in px (the Sky tab's dot diameter) and a colour from the B-V index (blue-white to orange). */
export function starLook(mag: number, bv: number | null): { sizePx: number; rgb: Vec3 } {
  const k = Math.max(0.35, Math.min(1, 1.15 - 0.15 * mag)); // fainter stars are dimmer
  const base: Vec3 = bv === null ? [1, 1, 1] : bv < 0 ? [0.75, 0.82, 1] : bv < 0.5 ? [0.95, 0.96, 1] : bv < 1 ? [1, 0.93, 0.8] : [1, 0.8, 0.62];
  return { sizePx: 2 * starRadius(mag), rgb: base.map((c) => c * k) as Vec3 };
}

/** Every catalogue star as flat arrays for one Points object: positions (before the turn), colours, sizes. */
export function starBuffers(rows: StarRow[] = STARS, r = STAR_SPHERE): { positions: number[]; colors: number[]; sizes: number[]; count: number } {
  const positions: number[] = [];
  const colors: number[] = [];
  const sizes: number[] = [];
  for (const [ra, dec, mag, , bv] of rows) {
    positions.push(...starLocal(ra, dec, r));
    const l = starLook(mag, bv);
    colors.push(...l.rgb);
    sizes.push(l.sizePx);
  }
  return { positions, colors, sizes, count: rows.length };
}
