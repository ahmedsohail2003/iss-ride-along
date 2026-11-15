// X5: the sky from the station. Pure functions, no DOM, so the tests run them in Node.
//
// We cannot make the real station take a photo, so the page computes the view. "Straight up" from the
// station is the direction away from Earth along the station's own vertical (the geodetic normal at its
// latitude and longitude). On the sky that point has declination = the station's latitude and right
// ascension = the local sidereal time (Greenwich sidereal time + the station's east longitude), measured
// in the frame of the date. The star catalogue is in J2000, so the station's up, north and east
// directions are turned into J2000 with the same TEME -> J2000 matrix that checks our orbit against
// NASA's trajectory (src/orbit/frames.ts: precession and all 106 nutation terms). Then each star's
// height above the station's horizon and its compass direction are two dot products.
//
// Left out, on purpose: proper motion (the stars drawn here move under 1 arcsecond a year, so under
// 30 arcseconds since 2000), aberration (the Earth's and the station's motion shift a star's apparent
// place by up to about 20 arcseconds and 5 arcminutes) and parallax (none for stars at this scale).
// All of these are far below the 0.5 degree the tests allow and below what the chart can show.
import * as sat from '../orbit/satellite-lite';
import { apply, temeToJ2000Matrix, type Vec3 } from '../orbit/frames';

const DEG = 180 / Math.PI;

/** One catalogue star: [right ascension deg (J2000), declination deg (J2000), magnitude, HIP number, B-V colour or null, name?]. */
export type StarRow = [number, number, number, number, number | null, string?];

/** Unit vector of a sky direction given as right ascension and declination in degrees. */
export function raDecToVec(raDeg: number, decDeg: number): Vec3 {
  const a = raDeg / DEG;
  const d = decDeg / DEG;
  return { x: Math.cos(d) * Math.cos(a), y: Math.cos(d) * Math.sin(a), z: Math.sin(d) };
}

/** Right ascension (0-360) and declination of a vector, in degrees. */
export function vecToRaDec(v: Vec3): { raDeg: number; decDeg: number } {
  const ra = Math.atan2(v.y, v.x) * DEG;
  return { raDeg: (ra + 360) % 360, decDeg: Math.atan2(v.z, Math.hypot(v.x, v.y)) * DEG };
}

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;

export interface StationSky {
  date: Date;
  /** Local sidereal time at the station, degrees 0-360 (Greenwich mean sidereal time + east longitude). */
  lstDeg: number;
  /** "Straight up" in the frame of the date: right ascension = local sidereal time, declination = latitude. */
  zenithOfDate: { raDeg: number; decDeg: number };
  /** "Straight up" in J2000, the catalogue's frame (differs from the frame of date by precession, about 0.37 deg in 2026). */
  zenithJ2000: { raDeg: number; decDeg: number };
  /** The station's up, north and east unit vectors in J2000. */
  up: Vec3;
  north: Vec3;
  east: Vec3;
}

/**
 * The station's own sky directions at `date`, from its geodetic latitude and east longitude (degrees).
 * Greenwich sidereal time is satellite.js `gstime()` (the IAU 1982 mean sidereal time SGP4 itself uses),
 * so this frame is TEME, the frame the orbit is computed in; one matrix turns it into J2000.
 */
export function stationSky(date: Date, latDeg: number, lonDeg: number): StationSky {
  const lst = sat.gstime(date) + lonDeg / DEG;
  const lat = latDeg / DEG;
  const [cl, sl, ct, st] = [Math.cos(lat), Math.sin(lat), Math.cos(lst), Math.sin(lst)];
  const upT = { x: cl * ct, y: cl * st, z: sl };
  const northT = { x: -sl * ct, y: -sl * st, z: cl };
  const eastT = { x: -st, y: ct, z: 0 };
  const m = temeToJ2000Matrix(date);
  const up = apply(m, upT);
  const lstDeg = (((lst * DEG) % 360) + 360) % 360;
  return {
    date,
    lstDeg,
    zenithOfDate: vecToRaDec(upT),
    zenithJ2000: vecToRaDec(up),
    up,
    north: apply(m, northT),
    east: apply(m, eastT),
  };
}

/** Height above the station's horizon and compass direction (0 = north, 90 = east), degrees, of a J2000 direction. */
export function horizontal(sky: StationSky, raDeg: number, decDeg: number): { altDeg: number; azDeg: number } {
  const v = raDecToVec(raDeg, decDeg);
  const alt = Math.asin(Math.max(-1, Math.min(1, dot(v, sky.up)))) * DEG;
  const az = Math.atan2(dot(v, sky.east), dot(v, sky.north)) * DEG;
  return { altDeg: alt, azDeg: (az + 360) % 360 };
}

/** Same as `horizontal()` for a direction already given as a J2000 vector (any length). */
export function horizontalOfVec(sky: StationSky, v: Vec3): { altDeg: number; azDeg: number } {
  const n = Math.hypot(v.x, v.y, v.z);
  const u = { x: v.x / n, y: v.y / n, z: v.z / n };
  const alt = Math.asin(Math.max(-1, Math.min(1, dot(u, sky.up)))) * DEG;
  const az = Math.atan2(dot(u, sky.east), dot(u, sky.north)) * DEG;
  return { altDeg: alt, azDeg: (az + 360) % 360 };
}

/**
 * Where a direction lands on the round chart of the sky above the station: the centre is straight up,
 * the edge is the station's horizon, north at the top and east on the LEFT (the chart is the sky seen
 * from below, as on a printed star chart held overhead). Stereographic (the usual star-chart mapping:
 * shapes of small groups of stars stay true): distance from the centre = R tan(z / 2) / tan(45 deg),
 * z = 90 - height. Returns null below the horizon.
 */
export function chartXY(altDeg: number, azDeg: number, radius: number): { x: number; y: number } | null {
  if (altDeg < 0) return null;
  const z = (90 - altDeg) / DEG;
  const r = radius * Math.tan(z / 2); // tan(45 deg) = 1
  const a = azDeg / DEG;
  return { x: -r * Math.sin(a), y: -r * Math.cos(a) };
}

/**
 * How far below the station's horizon the Earth's edge sits, degrees: from height h above a sphere of
 * radius R the edge is acos(R / (R + h)) below the horizontal. About 20 degrees at 420 km, so everything
 * on the chart (all of it above the horizon) is open sky, none of it hidden by Earth.
 */
export function earthEdgeDipDeg(altKm: number, earthRadiusKm = 6371.0088): number {
  return Math.acos(earthRadiusKm / (earthRadiusKm + altKm)) * DEG;
}

/** Dot size on the chart from magnitude (brighter = bigger), in px; magnitude 5 is the faintest kept. */
export function starRadius(mag: number): number {
  return Math.max(0.6, 3.2 - 0.5 * mag);
}
