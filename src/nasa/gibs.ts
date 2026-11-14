// NASA GIBS (Global Imagery Browse Services) daily true-colour image from the MODIS camera on the
// Terra satellite. It is a daily mosaic, not a live camera: the page picks a recent day that GIBS
// confirms it has, and prints that date on screen.

export const GIBS_LAYER = 'MODIS_Terra_CorrectedReflectance_TrueColor';
/** True-colour layers are served up to zoom 9 (GoogleMapsCompatible_Level9). */
export const GIBS_MAX_NATIVE_ZOOM = 9;
const BASE = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best';
const TIMEOUT_MS = 10_000;

/** Leaflet URL template (`{z}/{y}/{x}`, row before column) for one day of the layer. */
export function gibsTemplate(day: string): string {
  return `${BASE}/${GIBS_LAYER}/default/${day}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;
}

/** The one zoom-0 tile used to ask GIBS which day it really serves. */
export function gibsProbeUrl(day: string): string {
  return gibsTemplate(day).replace('{z}/{y}/{x}', '0/0/0');
}

/** UTC calendar day `daysBack` days before `now`, as YYYY-MM-DD. */
export function utcDay(now: Date, daysBack: number): string {
  return new Date(now.getTime() - daysBack * 86_400_000).toISOString().slice(0, 10);
}

/**
 * What a probe of one day returned: `unreachable` (no answer at all), or the tile's
 * Layer-Time-Actual header (null when the reply has no readable header).
 */
export type ProbeResult = { reachable: false } | { reachable: true; ok: boolean; layerTimeActual: string | null };

export interface GibsChoice {
  /** null: GIBS could not be reached, so the page keeps the built-in Blue Marble map. */
  day: string | null;
  /** confirmed: the header matched this day. assumed: no header could be read, so two days ago. */
  how: 'confirmed' | 'assumed' | 'unreachable';
}

/**
 * Pick the day to show: yesterday (UTC) if GIBS confirms it, else two days ago if GIBS confirms it.
 * Today's mosaic is still being filled in, so it is never used. If the header cannot be read,
 * fall back to two days ago, which is the safest complete day.
 */
export async function pickGibsDay(now: Date, probe: (day: string) => Promise<ProbeResult>): Promise<GibsChoice> {
  const twoDaysAgo = utcDay(now, 2);
  for (const day of [utcDay(now, 1), twoDaysAgo]) {
    const r = await probe(day);
    if (!r.reachable) return { day: null, how: 'unreachable' };
    if (r.ok && r.layerTimeActual === null) return { day: twoDaysAgo, how: 'assumed' };
    if (r.ok && r.layerTimeActual!.startsWith(day)) return { day, how: 'confirmed' };
  }
  return { day: twoDaysAgo, how: 'assumed' };
}

/** Browser probe: one zoom-0 tile request; GIBS exposes Layer-Time-Actual to scripts (CORS). */
export async function probeGibs(day: string): Promise<ProbeResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(gibsProbeUrl(day), { signal: ctrl.signal });
    return { reachable: true, ok: res.ok, layerTimeActual: res.headers.get('Layer-Time-Actual') };
  } catch {
    return { reachable: false };
  } finally {
    clearTimeout(timer);
  }
}
