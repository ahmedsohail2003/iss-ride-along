// C3: one plain sentence for where the station is, e.g.
//   "1,240 km east of Sydney, Australia, heading northeast, 418 km up."
// Built from the 150 cities in src/data/cities.json only (we have no data for ocean names, so a point
// over the sea is described from the nearest of those cities, however far). The direction word is the
// compass direction from the city to the point under the station (8 points); "heading" is the direction
// the point under the station is moving over the ground, from two SGP4 positions 10 s apart.
// No DOM here; main.ts puts the sentence in an aria-live="polite" region and refreshes it once a minute.
import type { SatRec } from 'satellite.js';
import citiesJson from '../data/cities.json';
import { greatCircleKm, stateAt } from '../orbit/orbit';

export interface City {
  name: string;
  country: string;
  lat: number;
  lon: number;
  pop?: number;
}

export const CITIES: City[] = citiesJson as City[];

const RAD = Math.PI / 180;

/** 8-point compass words, clockwise from north (0 deg = north, 90 deg = east). */
export const COMPASS8 = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'] as const;

/** The 8-point compass word for a bearing in degrees. */
export function compass8(bearingDeg: number): (typeof COMPASS8)[number] {
  const b = ((bearingDeg % 360) + 360) % 360;
  return COMPASS8[Math.round(b / 45) % 8];
}

/** Initial great-circle bearing (deg, 0 = north, clockwise) from point 1 towards point 2. */
export function bearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const p1 = lat1 * RAD;
  const p2 = lat2 * RAD;
  const dl = (lon2 - lon1) * RAD;
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return ((Math.atan2(y, x) / RAD) + 360) % 360;
}

/** The nearest city to a point, by great-circle distance (km), and the bearing from that city to the point. */
export function nearestCity(latDeg: number, lonDeg: number, cities: City[] = CITIES): { city: City; km: number; fromCityDeg: number } {
  let best = cities[0];
  let bestKm = Infinity;
  for (const c of cities) {
    const km = greatCircleKm(c.lat, c.lon, latDeg, lonDeg);
    if (km < bestKm) {
      bestKm = km;
      best = c;
    }
  }
  return { city: best, km: bestKm, fromCityDeg: bearingDeg(best.lat, best.lon, latDeg, lonDeg) };
}

/** Direction of travel over the ground (deg): the bearing from the point under the station now to the one 10 s later. */
export function groundHeadingDeg(satrec: SatRec, date: Date): number | null {
  const a = stateAt(satrec, date);
  const b = stateAt(satrec, new Date(date.getTime() + 10_000));
  if (!a || !b) return null;
  return bearingDeg(a.latDeg, a.lonDeg, b.latDeg, b.lonDeg);
}

/** "Washington,  D.C." in the data has a double space; one short name for the long country label. */
const tidy = (s: string) => s.replace(/\s+/g, ' ').trim();
const COUNTRY_SHORT: Record<string, string> = { 'United States of America': 'United States' };
export const cityLabel = (c: City) => `${tidy(c.name)}, ${COUNTRY_SHORT[c.country] ?? tidy(c.country)}`;

export interface WhereParts {
  city: City;
  /** Great-circle km from the city to the point under the station, rounded to 10 km. */
  km10: number;
  /** Unrounded km (for tests and the data- attributes). */
  km: number;
  /** 8-point word for the direction from the city to the station. */
  direction: (typeof COMPASS8)[number];
  fromCityDeg: number;
  /** 8-point word for the direction of travel, or null if it could not be computed. */
  heading: (typeof COMPASS8)[number] | null;
  altKm: number;
  text: string;
}

/** The sentence for a point under the station, its height and its direction of travel. */
export function whereSentence(latDeg: number, lonDeg: number, altKm: number, headingDeg: number | null, cities: City[] = CITIES): WhereParts {
  const n = nearestCity(latDeg, lonDeg, cities);
  const km10 = Math.round(n.km / 10) * 10;
  const direction = compass8(n.fromCityDeg);
  const heading = headingDeg === null ? null : compass8(headingDeg);
  const where = km10 === 0 ? `Right over ${cityLabel(n.city)}` : `${km10.toLocaleString('en-US')} km ${direction} of ${cityLabel(n.city)}`;
  const text = `${where}${heading ? `, heading ${heading}` : ''}, ${Math.round(altKm).toLocaleString('en-US')} km up.`;
  return { city: n.city, km10, km: n.km, direction, fromCityDeg: n.fromCityDeg, heading, altKm, text };
}

/** The sentence for the station at `date` (null if SGP4 fails). */
export function whereNow(satrec: SatRec, date: Date, cities: City[] = CITIES): WhereParts | null {
  const s = stateAt(satrec, date);
  if (!s) return null;
  return whereSentence(s.latDeg, s.lonDeg, s.altKm, groundHeadingDeg(satrec, date), cities);
}

