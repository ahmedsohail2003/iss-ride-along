// X5b: the projection behind the drag-and-zoom star chart. Pure functions, no DOM, so the tests run them
// in Node.
//
// The chart is stereographic, the usual star-chart mapping: a direction at angle t from the view centre
// lands at distance 2 k tan(t / 2) from the middle of the chart. It keeps angles true (a small group of
// stars keeps its shape), and every circle on the sky (the station's horizon, the Earth's edge) stays a
// circle on screen.
//
// A view is a camera: three unit vectors in J2000 (the star catalogue's frame): `f` points at the view
// centre, `u` is "up" on screen and `r` is "right" on screen. The station's own view (the fixed chart X5
// shipped) is f = straight up, u = north, r = west, so east is on the left as on a star chart held overhead.
// The field of view is the angle across the round chart, edge to edge: 180 degrees shows the station's whole
// sky down to its horizon; 30 degrees is the closest zoom.
import type { Vec3 } from '../orbit/frames';

const DEG = 180 / Math.PI;

/** Closest zoom and widest view, degrees across the round chart. 180 = everything above the station's horizon. */
export const FOV_MIN = 30;
export const FOV_MAX = 180;

export interface View {
  f: Vec3;
  u: Vec3;
  r: Vec3;
}

const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const scale = (a: Vec3, s: number): Vec3 => ({ x: a.x * s, y: a.y * s, z: a.z * s });
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const norm = (a: Vec3): Vec3 => scale(a, 1 / Math.hypot(a.x, a.y, a.z));

/** Angle between two directions, degrees (atan2 form: accurate for tiny and for near-opposite angles). */
export function angleDeg(a: Vec3, b: Vec3): number {
  const c = cross(a, b);
  return Math.atan2(Math.hypot(c.x, c.y, c.z), dot(a, b)) * DEG;
}

/** Keep a field of view inside the limits (anything that is not a number goes back to the widest view). */
export function clampFov(fovDeg: number): number {
  if (!Number.isFinite(fovDeg)) return FOV_MAX;
  return Math.min(FOV_MAX, Math.max(FOV_MIN, fovDeg));
}

/** Zoom: `factor` > 1 widens the view (zoom out), < 1 narrows it (zoom in); the result is always inside the limits. */
export function zoomFov(fovDeg: number, factor: number): number {
  if (!Number.isFinite(factor) || factor <= 0) return clampFov(fovDeg);
  return clampFov(clampFov(fovDeg) * factor);
}

/** Pixels per unit of the stereographic plane, so that the chart's edge (radius `radiusPx`) is fov / 2 from the centre. */
export function pxScale(fovDeg: number, radiusPx: number): number {
  return radiusPx / (2 * Math.tan(fovDeg / 4 / DEG));
}

/** The station's own view: centre straight up, north up on screen, east on the left. */
export function stationView(up: Vec3, north: Vec3, east: Vec3): View {
  return { f: up, u: north, r: scale(east, -1) };
}

/**
 * Where a direction (unit vector, J2000) lands on the chart, in px from the chart's middle (x right, y DOWN,
 * as on a canvas). Null only for directions within about 0.003 degree of straight behind the view, which
 * the stereographic mapping sends to infinity. Points outside the round chart are returned too; the caller
 * clips.
 */
export function project(v: Vec3, view: View, fovDeg: number, radiusPx: number): { x: number; y: number } | null {
  const z = dot(v, view.f);
  if (1 + z < 1e-9) return null;
  const k = (2 * pxScale(fovDeg, radiusPx)) / (1 + z);
  return { x: k * dot(v, view.r), y: -k * dot(v, view.u) };
}

/** The direction (unit vector, J2000) under a chart point given in px from the chart's middle (y down). */
export function unproject(x: number, y: number, view: View, fovDeg: number, radiusPx: number): Vec3 {
  const k = pxScale(fovDeg, radiusPx);
  const px = x / k;
  const py = -y / k;
  // Inverse stereographic from the plane tangent at f (plane units: rho = 2 tan(t / 2)).
  const s = (px * px + py * py) / 4;
  const zc = (1 - s) / (1 + s);
  const w = 1 / (1 + s);
  return norm(add(add(scale(view.f, zc), scale(view.r, px * w)), scale(view.u, py * w)));
}

/** Rodrigues: v turned by `angleRad` about the unit axis `k`. */
function rotate(v: Vec3, k: Vec3, angleRad: number): Vec3 {
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);
  return add(add(scale(v, c), scale(cross(k, v), s)), scale(k, dot(k, v) * (1 - c)));
}

/** Gram-Schmidt, so rounding never lets the camera's three vectors drift apart. */
function orthonormal(view: View): View {
  const f = norm(view.f);
  const u = norm(add(view.u, scale(f, -dot(view.u, f))));
  return { f, u, r: cross(f, u) };
}

/**
 * Drag: turn the camera so that the sky point that was under chart point (x0, y0) is now under (x1, y1)
 * (the stars follow the pointer, like turning a globe by hand). Returns a new view.
 */
export function dragView(view: View, x0: number, y0: number, x1: number, y1: number, fovDeg: number, radiusPx: number): View {
  const grabbed = unproject(x0, y0, view, fovDeg, radiusPx);
  const target = unproject(x1, y1, view, fovDeg, radiusPx);
  // The camera turns by the rotation that takes `target` onto `grabbed`; then the grabbed star sits at (x1, y1).
  const axis = cross(target, grabbed);
  const len = Math.hypot(axis.x, axis.y, axis.z);
  if (len < 1e-12) return view;
  const k = scale(axis, 1 / len);
  const a = Math.atan2(len, dot(target, grabbed));
  return orthonormal({ f: rotate(view.f, k, a), u: rotate(view.u, k, a), r: rotate(view.r, k, a) });
}

/** The chart is right-handed: r = f x u holds for the station view (west = up x north). */
export function isOrthonormal(view: View, tol = 1e-9): boolean {
  const c = cross(view.f, view.u);
  return (
    Math.abs(dot(view.f, view.f) - 1) < tol &&
    Math.abs(dot(view.u, view.u) - 1) < tol &&
    Math.abs(dot(view.f, view.u)) < tol &&
    Math.hypot(c.x - view.r.x, c.y - view.r.y, c.z - view.r.z) < tol
  );
}
