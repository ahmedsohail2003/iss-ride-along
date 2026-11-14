// NASA EONET v3 (Earth Observatory Natural Event Tracker): open natural events such as wildfires,
// storms and sea ice. One live request per page load when online; otherwise the copy saved by
// scripts/snapshot.mjs. GeoJSON order is [longitude, latitude]; the parser turns it into named
// lat / lon fields so nothing downstream can swap them.

// Which events: every open event with a report in the last EONET_DAYS days, with no count limit, so
// the count the page prints is the whole of that set. Not "all open events": EONET leaves some
// events open for years without a new report (Nov 14, 2026, 4:14 PM EST: 7,244 open, 7,175 of them
// wildfires, the oldest last reported 9,081 days earlier; a 5.0 MB reply). The old `limit=50` cut
// that list to 50 in EONET's own order, so the page's total and its "none in view" were only true of
// those 50. scripts/snapshot.mjs saves this same URL (tests/nasa.test.ts checks they match).
export const EONET_DAYS = 30;
export const EONET_URL = `https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=${EONET_DAYS}`;
/** The set the page counts, in words, for every on-screen line about events. */
export const EONET_SET = `open natural events reported in the last ${EONET_DAYS} days`;
const TIMEOUT_MS = 10_000;

export interface EonetEvent {
  id: string;
  title: string;
  category: string;
  /** UTC ISO time of the newest position EONET gives for this event. */
  date: string;
  lat: number;
  lon: number;
  /** e.g. "519 acres" or "35 kts", when EONET gives one. */
  magnitude: string | null;
  /** Who reported it (IRWIN, JTWC, NATICE, ...), as EONET names them. */
  sources: string[];
  link: string;
}

interface RawGeometry {
  date?: string;
  type?: string;
  coordinates?: unknown;
  magnitudeValue?: number | null;
  magnitudeUnit?: string | null;
}

interface RawEvent {
  id?: string;
  title?: string;
  link?: string;
  categories?: { id?: string; title?: string }[];
  sources?: { id?: string; url?: string }[];
  geometry?: RawGeometry[];
}

const isLon = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= -180 && x <= 180;
const isLat = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x >= -90 && x <= 90;

/** [lat, lon] of a GeoJSON Point ([lon, lat]) or the vertex average of a Polygon's outer ring. */
export function geometryLatLon(g: RawGeometry): [number, number] | null {
  const c = g.coordinates;
  if (g.type === 'Point' && Array.isArray(c) && isLon(c[0]) && isLat(c[1])) return [c[1], c[0]];
  if (g.type === 'Polygon' && Array.isArray(c) && Array.isArray(c[0])) {
    const ring = (c[0] as unknown[]).filter(
      (p): p is [number, number] => Array.isArray(p) && isLon(p[0]) && isLat(p[1]),
    );
    if (!ring.length) return null;
    const lat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    const lon = ring.reduce((s, p) => s + p[0], 0) / ring.length;
    return [lat, lon];
  }
  return null;
}

/** Turn an EONET v3 /events reply into events at their newest position. Bad entries are skipped. */
export function parseEonet(json: unknown): EonetEvent[] {
  const events = (json as { events?: RawEvent[] } | null)?.events;
  if (!Array.isArray(events)) return [];
  const out: EonetEvent[] = [];
  for (const e of events) {
    if (!e?.id || !Array.isArray(e.geometry)) continue;
    const newest = [...e.geometry]
      .filter((g) => typeof g?.date === 'string' && geometryLatLon(g))
      .sort((a, b) => Date.parse(b.date!) - Date.parse(a.date!))[0];
    if (!newest) continue;
    const [lat, lon] = geometryLatLon(newest)!;
    const mag =
      typeof newest.magnitudeValue === 'number' && newest.magnitudeUnit
        ? `${newest.magnitudeValue.toLocaleString('en-US')} ${newest.magnitudeUnit}`
        : null;
    out.push({
      id: e.id,
      title: e.title ?? e.id,
      category: e.categories?.[0]?.title ?? 'Unknown category',
      date: newest.date!,
      lat,
      lon,
      magnitude: mag,
      sources: (e.sources ?? []).map((s) => s.id ?? '').filter(Boolean),
      link: e.link ?? `https://eonet.gsfc.nasa.gov/api/v3/events/${e.id}`,
    });
  }
  return out;
}

/** How many events the reply lists before parsing (parseEonet skips entries with no usable position). */
export function eonetRawCount(json: unknown): number {
  const events = (json as { events?: unknown[] } | null)?.events;
  return Array.isArray(events) ? events.length : 0;
}

export interface EonetList {
  events: EonetEvent[];
  /** Events in the reply, including any the parser skipped. */
  rawCount: number;
}

/** One live EONET request; null on any failure (the page then keeps the saved copy). */
export async function fetchEonet(): Promise<EonetList | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(EONET_URL, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) return null;
    // EONET labels the reply application/rss+xml although the body is JSON.
    const json = JSON.parse(await res.text());
    return Array.isArray(json?.events) ? { events: parseEonet(json), rawCount: eonetRawCount(json) } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
