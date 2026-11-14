// Pure orbit helpers: no I/O, no DOM. Ported from the 12:35 PM spike (.autopilot/spike/orbit.mjs).
// satellite.js 7.x (via ./satellite-lite) returns null from propagate() when SGP4 fails.
import * as sat from './satellite-lite';
import type { EciVec3, GeodeticLocation, Kilometer, OMMJsonObject, SatRec } from 'satellite.js';

/** Mean Earth radius (km), used for great-circle distance. */
export const EARTH_RADIUS_KM = 6371.0088;
/** WGS-84 equatorial radius (km), used for the Earth-shadow cylinder. */
export const RE_EQ_KM = 6378.137;
const AU_KM = 149597870.7;

export interface StationState {
  date: Date;
  latDeg: number;
  lonDeg: number;
  altKm: number;
  /** Inertial (TEME) speed in km/s: orbital speed, not speed over the ground. */
  speedKmS: number;
  eci: EciVec3<Kilometer>;
  gmst: number;
}

export function satrecFromTle(tleText: string): SatRec {
  const lines = tleText.trim().split(/\r?\n/).map((l) => l.trim());
  const [l1, l2] = lines.length >= 3 ? [lines[1], lines[2]] : [lines[0], lines[1]];
  return sat.twoline2satrec(l1, l2);
}

export function satrecFromOmm(omm: OMMJsonObject | OMMJsonObject[]): SatRec {
  return sat.json2satrec(Array.isArray(omm) ? omm[0] : omm);
}

/** Sub-satellite point, altitude and orbital speed at `date`; null if SGP4 fails. */
export function stateAt(satrec: SatRec, date: Date): StationState | null {
  const pv = sat.propagate(satrec, date);
  if (!pv || !pv.position || !pv.velocity) return null;
  const gmst = sat.gstime(date);
  const geo = sat.eciToGeodetic(pv.position, gmst);
  const v = pv.velocity;
  return {
    date,
    latDeg: sat.degreesLat(geo.latitude),
    lonDeg: sat.degreesLong(geo.longitude),
    altKm: geo.height,
    speedKmS: Math.hypot(v.x, v.y, v.z),
    eci: pv.position,
    gmst,
  };
}

/** Haversine distance (km) between two latitude/longitude points in degrees, mean-radius sphere. */
export function greatCircleKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r;
  const dLon = (lon2 - lon1) * r;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function observer(latDeg: number, lonDeg: number, heightKm = 0.25): GeodeticLocation {
  return { latitude: sat.degreesToRadians(latDeg), longitude: sat.degreesToRadians(lonDeg), height: heightKm };
}

/** Sun position in ECI (km), from satellite.js sunPos (Vallado low-precision algorithm). */
export function sunEciKm(date: Date): EciVec3<Kilometer> {
  const { rsun } = sat.sunPos(sat.jday(date));
  return { x: rsun.x * AU_KM, y: rsun.y * AU_KM, z: rsun.z * AU_KM } as EciVec3<Kilometer>;
}

/**
 * Cylindrical Earth-shadow test: the station is in shadow when it is on the night side
 * (r . s_hat < 0) and its distance from the Earth-Sun line is less than Earth's radius.
 */
export function isSunlitCylinder(rSatKm: { x: number; y: number; z: number }, rSunKm: { x: number; y: number; z: number }): boolean {
  const sn = Math.hypot(rSunKm.x, rSunKm.y, rSunKm.z);
  const s = { x: rSunKm.x / sn, y: rSunKm.y / sn, z: rSunKm.z / sn };
  const proj = rSatKm.x * s.x + rSatKm.y * s.y + rSatKm.z * s.z;
  if (proj >= 0) return true;
  const px = rSatKm.x - proj * s.x;
  const py = rSatKm.y - proj * s.y;
  const pz = rSatKm.z - proj * s.z;
  return Math.hypot(px, py, pz) > RE_EQ_KM;
}
