// G3: the scroll story's camera, pure (no three.js, no DOM), so the tests check it in Node.
// Each scene of #story (src/globe/storyUi.ts) names where the globe's camera goes: the point at the middle of
// the view (latitude, longitude), how far away (in Earth radii from the centre) and which layers show. The
// places come from the engine's own values handed in: the station (stateAt), the Sun (subsolarPoint) and a
// point a little further along the next orbit (orbitPoints).
import { latLonToVec3, vec3ToLatLon, type Vec3 } from './geo';

/** Fallback switch (PLAN.md G3): false leaves the section out of the page. */
export const STORY_ON = true;
export const SCENE_IDS = ['now', 'orbit', 'daynight', 'view', 'sky', 'real'] as const;
export type SceneId = (typeof SCENE_IDS)[number];

export interface SceneContext {
  station: { lat: number; lon: number; alt: number };
  sun: { lat: number; lon: number };
  /** a point of the next orbit a few minutes ahead of the station (gives the orbit's plane) */
  ahead?: { lat: number; lon: number } | null;
}
export interface Layers {
  tracks: boolean;
  view: boolean;
  pass: boolean;
  stars: boolean;
  /** true forces the night shading on for the scene; null leaves the night-side box as the reader set it */
  night: boolean | null;
}
export interface SceneCamera {
  id: SceneId;
  lat: number;
  lon: number;
  dist: number;
  layers: Layers;
}

const D = Math.PI / 180;
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a: Vec3): Vec3 => {
  const n = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / n, a[1] / n, a[2] / n];
};
const ll = (v: Vec3) => {
  const p = vec3ToLatLon(v);
  return { lat: p.latDeg, lon: p.lonDeg };
};
const ALL: Layers = { tracks: true, view: true, pass: true, stars: true, night: null };

/**
 * The point on the day/night line nearest the station (the station's direction with its Sun part taken
 * away). Where that lands too near a pole for the camera (which stops at 85 degrees) or the station is
 * straight under or opposite the Sun, the point on the line at the equator nearest the station is used.
 * Either way its direction is at right angles to the Sun's.
 */
export function terminatorPoint(station: { lat: number; lon: number }, sun: { lat: number; lon: number }): { lat: number; lon: number } {
  const s = latLonToVec3(station.lat, station.lon);
  const u = latLonToVec3(sun.lat, sun.lon);
  const k = dot(s, u);
  const p: Vec3 = [s[0] - k * u[0], s[1] - k * u[1], s[2] - k * u[2]];
  if (Math.hypot(p[0], p[1], p[2]) > 0.05) {
    const q = ll(unit(p));
    if (Math.abs(q.lat) <= 80) return q;
  }
  // the line crosses the equator 90 degrees east and west of the Sun's longitude
  const wrap = (v: number) => ((((v + 180) % 360) + 360) % 360) - 180;
  const east = wrap(sun.lon + 90);
  const west = wrap(sun.lon - 90);
  const gap = (a: number) => Math.abs(wrap(a - station.lon));
  return { lat: 0, lon: gap(east) <= gap(west) ? east : west };
}

/** The pole of the station's orbit (the direction the whole lap is seen face on from). */
export function orbitPole(station: { lat: number; lon: number }, ahead: { lat: number; lon: number }): { lat: number; lon: number } {
  return ll(unit(cross(latLonToVec3(station.lat, station.lon), latLonToVec3(ahead.lat, ahead.lon))));
}

/** A point `deg` degrees west of the station along its own east-west line (puts the station near the edge). */
function westOf(station: { lat: number; lon: number }, deg: number): { lat: number; lon: number } {
  const s = latLonToVec3(station.lat, station.lon);
  const lo = station.lon * D;
  const east: Vec3 = [-Math.sin(lo), 0, -Math.cos(lo)];
  const c = Math.cos(deg * D);
  const n = Math.sin(deg * D);
  return ll(unit([c * s[0] - n * east[0], c * s[1] - n * east[1], c * s[2] - n * east[2]]));
}

/** Where the camera goes for scene `id`, from the engine's values in `ctx`. */
export function sceneAt(id: SceneId, ctx: SceneContext): SceneCamera {
  const st = { lat: ctx.station.lat, lon: ctx.station.lon };
  switch (id) {
    case 'now': // close over the station
      return { id, ...st, dist: 1.7, layers: { ...ALL, view: false, pass: false } };
    case 'orbit': {
      // pulled back to see one whole lap, face on to the orbit's plane
      const pole = ctx.ahead ? orbitPole(st, ctx.ahead) : st;
      return { id, ...pole, dist: 4.6, layers: { ...ALL, view: false, pass: false } };
    }
    case 'daynight': // turned to the day/night line, shading on
      return { id, ...terminatorPoint(st, ctx.sun), dist: 3.0, layers: { ...ALL, view: false, pass: false, night: true } };
    case 'view': // the area the crew can see
      return { id, ...st, dist: 2.3, layers: { ...ALL, tracks: false, pass: false } };
    case 'sky': // the station near the edge of the Earth, the stars behind it
      return { id, ...westOf(st, 55), dist: 3.4, layers: { ...ALL, view: false, pass: false } };
    case 'real': // back to the whole picture
      return { id, ...st, dist: 3.2, layers: ALL };
  }
}
