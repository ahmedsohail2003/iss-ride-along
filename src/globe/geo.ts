// G1: the 3D globe's geometry, pure (no three.js, no DOM), so the tests check it in Node.
//
// One unit is the Earth's mean radius (EARTH_RADIUS_KM, 6371.0088 km). The axes are the ones three.js's
// SphereGeometry uses for an equirectangular picture (texture u = 0 at longitude -180, v = 1 at the
// North Pole): +Y is north, latitude 0 / longitude 0 is +X and longitude 90 E is -Z. So
//   x = r cos(lat) cos(lon),  y = r sin(lat),  z = -r cos(lat) sin(lon),  r = 1 + altitude / 6371.0088.
// Every shape on the globe comes from the tested engine: the station and its two orbits from stateAt
// (SGP4), the Sun from subsolarPoint, the crew's view from footprintRadiusKm.
import type { SatRec } from 'satellite.js';
import { EARTH_RADIUS_KM, stateAt } from '../orbit/orbit';
import { subsolarPoint } from '../orbit/daynight';

export type Vec3 = [number, number, number];
const D = Math.PI / 180;

/** Latitude/longitude (degrees) and height above the mean sphere (km) to globe units. */
export function latLonToVec3(latDeg: number, lonDeg: number, altKm = 0): Vec3 {
  const r = 1 + altKm / EARTH_RADIUS_KM;
  const la = latDeg * D;
  const lo = lonDeg * D;
  return [r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo)];
}

/** The inverse: a point in globe units to latitude, longitude (-180..180) and height (km). */
export function vec3ToLatLon(v: Vec3): { latDeg: number; lonDeg: number; altKm: number } {
  const r = Math.hypot(v[0], v[1], v[2]);
  return {
    latDeg: Math.asin(Math.max(-1, Math.min(1, v[1] / r))) / D,
    lonDeg: Math.atan2(-v[2], v[0]) / D,
    altKm: (r - 1) * EARTH_RADIUS_KM,
  };
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a: Vec3): Vec3 => {
  const n = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / n, a[1] / n, a[2] / n];
};

/**
 * `n` points (closed: the last equals the first) on the circle of angular radius `angleRad` around
 * (lat, lon), at height `altKm`. The crew's view is this circle with angleRad = footprintRadiusKm / 6371.0088
 * (an arc length on the mean sphere divided by its radius).
 */
export function circleOnSphere(latDeg: number, lonDeg: number, angleRad: number, n = 96, altKm = 0): Vec3[] {
  const c = latLonToVec3(latDeg, lonDeg);
  // Two unit vectors at right angles to the centre: east and north at that point.
  const lo = lonDeg * D;
  const la = latDeg * D;
  const east: Vec3 = [-Math.sin(lo), 0, -Math.cos(lo)];
  const north: Vec3 = [-Math.sin(la) * Math.cos(lo), Math.cos(la), Math.sin(la) * Math.sin(lo)];
  const r = 1 + altKm / EARTH_RADIUS_KM;
  const out: Vec3[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (2 * Math.PI * i) / n;
    const ca = Math.cos(angleRad);
    const sa = Math.sin(angleRad);
    const p: Vec3 = [0, 1, 2].map((k) => r * (ca * c[k] + sa * (Math.cos(t) * north[k] + Math.sin(t) * east[k]))) as Vec3;
    out.push(p);
  }
  return out;
}

export interface OrbitPoint {
  t: Date;
  latDeg: number;
  lonDeg: number;
  altKm: number;
}

/**
 * The station every `stepS` seconds (30) from one period before `now` to one period after: the same
 * data as the flat map's two lines (groundTrack), with the height kept so the 3D line flies at it.
 */
export function orbitPoints(satrec: SatRec, now: Date, periodMin: number, stepS = 30): { past: OrbitPoint[]; next: OrbitPoint[] } {
  const past: OrbitPoint[] = [];
  const next: OrbitPoint[] = [];
  const t0 = now.getTime();
  const span = periodMin * 60;
  const at = (s: number): OrbitPoint | null => {
    const t = new Date(t0 + s * 1000);
    const st = stateAt(satrec, t);
    return st ? { t, latDeg: st.latDeg, lonDeg: st.lonDeg, altKm: st.altKm } : null;
  };
  // Both lines start at `now` (where the station is) and step away from it.
  for (let s = 0; s <= span; s += stepS) {
    const b = at(-s);
    const f = at(s);
    if (b) past.unshift(b);
    if (f) next.push(f);
  }
  return { past, next };
}

/**
 * G2: the chosen pass, rise to set: the station every `stepS` seconds (5, the step of the flat map's pink
 * arc, groundTrack(satrec, start, 0, minutes, 5)) from `start`, plus `end` itself, with the height kept
 * so the 3D arc flies at the station's height.
 */
export function passPoints(satrec: SatRec, start: Date, end: Date, stepS = 5): OrbitPoint[] {
  const out: OrbitPoint[] = [];
  const t0 = start.getTime();
  const t1 = end.getTime();
  const push = (ms: number) => {
    const t = new Date(ms);
    const st = stateAt(satrec, t);
    if (st) out.push({ t, latDeg: st.latDeg, lonDeg: st.lonDeg, altKm: st.altKm });
  };
  for (let ms = t0; ms < t1; ms += stepS * 1000) push(ms);
  push(t1);
  return out;
}

/** Unit vector from the Earth's centre to the Sun in globe axes (from subsolarPoint, our own Sun math). */
export function sunVector(date: Date): Vec3 {
  const s = subsolarPoint(date);
  return latLonToVec3(s.latDeg, s.lonDeg);
}

/**
 * Where a ray first meets the sphere of radius `radius` round the origin, or null if it misses (or the
 * sphere is behind the ray's start). `dir` need not be unit length.
 */
export function raySphere(origin: Vec3, dir: Vec3, radius = 1): Vec3 | null {
  const d = unit(dir);
  const b = dot(origin, d);
  const c = dot(origin, origin) - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t = -b - s >= 0 ? -b - s : -b + s;
  if (t < 0) return null;
  return [origin[0] + t * d[0], origin[1] + t * d[1], origin[2] + t * d[2]];
}

/** Camera position looking at the Earth's centre from straight above (lat, lon), `dist` units away. */
export function cameraFor(latDeg: number, lonDeg: number, dist: number): Vec3 {
  return latLonToVec3(latDeg, lonDeg).map((k) => k * dist) as Vec3;
}

/** Angle (radians) between two directions. */
export function angleBetween(a: Vec3, b: Vec3): number {
  return Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b)))));
}
