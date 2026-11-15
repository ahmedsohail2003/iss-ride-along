// findCity(name): the built-in list first (Ypsilanti plus the 150 Natural Earth cities), then
// Open-Meteo's free place search for any other town. Only the typed place name leaves the page.
// The card always prints the state or country beside the name, so a wrong match is visible.
import citiesData from '../data/cities.json';
import { YPSILANTI } from '../passes-ui';
import { greatCircleKm } from '../orbit/orbit';

export const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';

export interface AgentPlace {
  id: string;
  name: string;
  /** State or country, printed beside the name. */
  region: string;
  latDeg: number;
  lonDeg: number;
  heightM: number;
  /** IANA zone when known (Ypsilanti, place search); otherwise learnt from the cloud forecast. */
  timeZone: string | null;
  source: 'built-in list' | 'Open-Meteo place search';
}

interface City {
  name: string;
  country: string;
  lat: number;
  lon: number;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const BUILT_IN: AgentPlace[] = [
  {
    id: 'ypsilanti',
    name: 'Ypsilanti',
    region: 'Michigan',
    latDeg: YPSILANTI.latDeg,
    lonDeg: YPSILANTI.lonDeg,
    heightM: YPSILANTI.heightM ?? 0,
    timeZone: YPSILANTI.timeZone ?? null,
    source: 'built-in list',
  },
  ...(citiesData as City[]).map<AgentPlace>((c) => ({
    id: slug(c.name),
    name: c.name,
    region: c.country,
    latDeg: c.lat,
    lonDeg: c.lon,
    heightM: 0,
    timeZone: null,
    source: 'built-in list',
  })),
];

/** Built-in places whose name equals the first part of the query ("Chicago", "chicago, il"). */
export function builtInMatches(query: string): AgentPlace[] {
  const head = slug(query.split(',')[0] ?? '');
  if (!head) return [];
  return BUILT_IN.filter((p) => slug(p.name) === head).slice(0, 3);
}

/** A2: built-in places within `km` of `p` (straight line), nearest first, `p` itself left out. */
export function nearbyPlaces(p: AgentPlace, km: number): { place: AgentPlace; km: number; bearingDeg: number }[] {
  const r = Math.PI / 180;
  return BUILT_IN.filter((q) => q.id !== p.id)
    .map((q) => {
      const dLon = (q.lonDeg - p.lonDeg) * r;
      const y = Math.sin(dLon) * Math.cos(q.latDeg * r);
      const x = Math.cos(p.latDeg * r) * Math.sin(q.latDeg * r) - Math.sin(p.latDeg * r) * Math.cos(q.latDeg * r) * Math.cos(dLon);
      return { place: q, km: greatCircleKm(p.latDeg, p.lonDeg, q.latDeg, q.lonDeg), bearingDeg: ((Math.atan2(y, x) / r) + 360) % 360 };
    })
    .filter((d) => d.km > 0.5 && d.km <= km)
    .sort((a, b) => a.km - b.km);
}

export function builtInPlace(id: string): AgentPlace | undefined {
  return BUILT_IN.find((p) => p.id === id);
}

interface GeoResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  elevation?: number;
  timezone?: string;
  country?: string;
  admin1?: string;
}

/** Parse Open-Meteo's place-search reply into up to 3 candidates. */
export function parseGeocode(json: unknown): AgentPlace[] {
  const results = ((json as { results?: GeoResult[] })?.results ?? []).slice(0, 3);
  return results
    .filter((r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude))
    .map((r) => ({
      id: `${slug(r.name)}-${r.id}`,
      name: r.name,
      region: [r.admin1, r.country].filter(Boolean).join(', '),
      latDeg: r.latitude,
      lonDeg: r.longitude,
      heightM: r.elevation ?? 0,
      timeZone: r.timezone ?? null,
      source: 'Open-Meteo place search',
    }));
}

export async function findCityCandidates(name: string, fetchFn: typeof fetch, signal?: AbortSignal): Promise<AgentPlace[]> {
  const local = builtInMatches(name);
  if (local.length) return local;
  const q = (name.split(',')[0] ?? '').trim();
  if (!q) return [];
  const res = await fetchFn(`${GEOCODE_URL}?name=${encodeURIComponent(q)}&count=3&language=en&format=json`, { signal });
  if (!res.ok) throw new Error(`place search HTTP ${res.status}`);
  return parseGeocode(await res.json());
}
