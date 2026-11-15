// G5: the dotted Earth, a second style of the same globe (written new at this event; the idea of an object
// drawn as a cloud of small dots is from the look of Ahmed's earlier RoBuff page, nothing copied). Pure
// functions (no three.js, no DOM), so tests/g5.test.ts checks them in Node:
//   fibonacciLatLon  n points spread evenly over the sphere (the golden-angle spiral)
//   dotPosition      a point's place in the globe's own frame: geo.ts latLonToVec3, so the dots and the photo
//                    share one frame and the dot Earth cannot be mirrored or shifted against the station
//   pixelFor         which pixel of the equirectangular Blue Marble picture lies under a latitude/longitude
//   isLand           the land test on one pixel: the sea in that picture is blue, land is not (ice is bright)
//   buildDots        every land point kept (bright), every second sea point kept (dim): positions and colours
import { latLonToVec3, type Vec3 } from './geo';

/** One constant switches the whole dotted style off (the Photo / Dots switch is then not shown). */
export const DOTS_ON = true;
/** G6: the style the globe opens in when the tab has no saved choice ('photo' or 'dots'); one line to change. */
export const DEFAULT_STYLE: 'photo' | 'dots' = 'photo';
/** About 40,000 points on the sphere; after the sea is thinned about 26,000 are drawn. */
export const DOTS_N = 40_000;
/** Dots sit just above the dark sphere that hides the far side. */
export const DOTS_RADIUS = 1.003;
export const LAND_RGB: Vec3 = [0.86, 0.95, 1.0];
export const SEA_RGB: Vec3 = [0.12, 0.24, 0.42];

const GOLDEN = Math.PI * (3 - Math.sqrt(5));
const D = 180 / Math.PI;

/** `n` points on the sphere, as latitude and longitude in degrees (longitude -180..180). */
export function fibonacciLatLon(n: number): { lat: number; lon: number }[] {
  const out: { lat: number; lon: number }[] = [];
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n; // -1..1, never exactly a pole
    const lon = ((((i * GOLDEN * D + 180) % 360) + 360) % 360) - 180;
    out.push({ lat: Math.asin(y) * D, lon });
  }
  return out;
}

/** A dot's place in globe units: the same vector geo.ts gives for that latitude and longitude, times `r`. */
export function dotPosition(lat: number, lon: number, r = 1): Vec3 {
  return latLonToVec3(lat, lon).map((k) => k * r) as Vec3;
}

/** The pixel under (lat, lon) in a `w` x `h` equirectangular picture (column 0 at -180, row 0 at the North Pole). */
export function pixelFor(lat: number, lon: number, w: number, h: number): { x: number; y: number } {
  const x = Math.min(w - 1, Math.max(0, Math.floor(((lon + 180) / 360) * w)));
  const y = Math.min(h - 1, Math.max(0, Math.floor(((90 - lat) / 180) * h)));
  return { x, y };
}

/** Land or sea for one pixel of the Blue Marble picture: sea is clearly bluer than it is red or green. */
export function isLand(r: number, g: number, b: number): boolean {
  if ((r + g + b) / 3 > 200) return true; // ice and snow
  return b < Math.max(r, g) + 12;
}

export interface Picture {
  width: number;
  height: number;
  /** RGBA, row by row (an ImageData's data) */
  data: ArrayLike<number>;
}

/** The dots for `n` sphere points over `pic`: every land point, every second sea point. */
export function buildDots(pic: Picture, n = DOTS_N, r = DOTS_RADIUS): { positions: Float32Array; colors: Float32Array; count: number; land: number } {
  const pts = fibonacciLatLon(n);
  const pos: number[] = [];
  const col: number[] = [];
  let land = 0;
  let sea = 0;
  for (const p of pts) {
    const { x, y } = pixelFor(p.lat, p.lon, pic.width, pic.height);
    const o = (y * pic.width + x) * 4;
    const isL = isLand(pic.data[o], pic.data[o + 1], pic.data[o + 2]);
    if (!isL && sea++ % 2 === 1) continue;
    if (isL) land++;
    pos.push(...dotPosition(p.lat, p.lon, r));
    col.push(...(isL ? LAND_RGB : SEA_RGB));
  }
  return { positions: new Float32Array(pos), colors: new Float32Array(col), count: pos.length / 3, land };
}
