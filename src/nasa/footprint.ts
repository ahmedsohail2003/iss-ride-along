// The station's horizon footprint: every point on the ground that has a straight line of sight to
// the station (the station is above that point's horizon). Pure geometry, no I/O.
//
// On a sphere of radius R, a station at altitude h sees out to the angle theta where the line of
// sight just grazes the surface: cos(theta) = R / (R + h). The footprint is the circle of
// ground distance R * theta around the point under the station.
import { EARTH_RADIUS_KM, greatCircleKm } from '../orbit/orbit';

/** Ground distance (km) from the point under the station to the edge of its horizon footprint. */
export function footprintRadiusKm(altKm: number, radiusKm = EARTH_RADIUS_KM): number {
  if (!(altKm > 0)) return 0;
  return radiusKm * Math.acos(radiusKm / (radiusKm + altKm));
}

/** Diameter (km) of the horizon footprint, measured along the ground. */
export function footprintDiameterKm(altKm: number, radiusKm = EARTH_RADIUS_KM): number {
  return 2 * footprintRadiusKm(altKm, radiusKm);
}

export interface Located {
  lat: number;
  lon: number;
}

export interface WithDistance<T> {
  item: T;
  /** Ground distance (km) from the point under the station. */
  km: number;
}

/**
 * Sort `items` by ground distance from the point under the station and split them into those
 * inside the footprint (in view) and the nearest one overall.
 */
export function splitByFootprint<T extends Located>(
  items: T[],
  stationLat: number,
  stationLon: number,
  altKm: number,
): { inView: WithDistance<T>[]; nearest: WithDistance<T> | null; radiusKm: number } {
  const radiusKm = footprintRadiusKm(altKm);
  const all = items
    .map((item) => ({ item, km: greatCircleKm(stationLat, stationLon, item.lat, item.lon) }))
    .sort((a, b) => a.km - b.km);
  return { inView: all.filter((d) => d.km <= radiusKm), nearest: all[0] ?? null, radiusKm };
}
