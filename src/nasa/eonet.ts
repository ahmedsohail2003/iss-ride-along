// NASA EONET v3 (Earth Observatory Natural Event Tracker): open natural events such as wildfires,
// storms and sea ice. One live request per page load when online; otherwise the copy saved by
// scripts/snapshot.mjs. GeoJSON order is [longitude, latitude]; the parser turns it into named
// lat / lon fields so nothing downstream can swap them.

export const EONET_URL = 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=50';
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

/** One live EONET request; null on any failure (the page then keeps the saved copy). */
export async function fetchEonet(): Promise<EonetEvent[] | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(EONET_URL, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) return null;
    // EONET labels the reply application/rss+xml although the body is JSON.
    const json = JSON.parse(await res.text());
    return Array.isArray(json?.events) ? parseEonet(json) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
