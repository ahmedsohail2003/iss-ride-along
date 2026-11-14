// Cloud forecast from Open-Meteo (free, no key; https://open-meteo.com). One request per place.
// The reply has no issue time, so the card says when it was *fetched*, never when it was issued.

export const CREDIT_OPEN_METEO = 'Weather data by Open-Meteo.com (CC BY 4.0)';
/** A design rule, not a measured limit: past this the card says the forecast is rough. */
export const ROUGH_AFTER_HOURS = 72;

export function forecastUrl(latDeg: number, lonDeg: number): string {
  // Rounded to 2 decimals (about 1 km) before the position leaves the page.
  const lat = latDeg.toFixed(2);
  const lon = lonDeg.toFixed(2);
  return (
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    '&hourly=cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high&timezone=auto&timeformat=unixtime&forecast_days=6'
  );
}

export interface CloudHour {
  /** Start of the hour, Unix seconds. */
  t: number;
  cloud: number;
  low: number | null;
  mid: number | null;
  high: number | null;
}

export interface CloudForecast {
  timeZone: string;
  utcOffsetSeconds: number;
  hours: CloudHour[];
  fetchedAt: Date;
}

interface OpenMeteoReply {
  timezone?: string;
  utc_offset_seconds?: number;
  hourly?: {
    time?: number[];
    cloud_cover?: (number | null)[];
    cloud_cover_low?: (number | null)[];
    cloud_cover_mid?: (number | null)[];
    cloud_cover_high?: (number | null)[];
  };
}

/** Parse a forecast reply. Hours with no total cloud value are left out. Throws on a malformed reply. */
export function parseForecast(json: unknown, fetchedAt: Date): CloudForecast {
  const r = json as OpenMeteoReply;
  const h = r?.hourly;
  if (!r || typeof r.timezone !== 'string' || !h || !Array.isArray(h.time) || !Array.isArray(h.cloud_cover)) {
    throw new Error('Open-Meteo reply has no hourly cloud cover');
  }
  const hours: CloudHour[] = [];
  h.time.forEach((t, i) => {
    const c = h.cloud_cover![i];
    if (typeof c !== 'number' || !Number.isFinite(c)) return;
    hours.push({ t, cloud: c, low: h.cloud_cover_low?.[i] ?? null, mid: h.cloud_cover_mid?.[i] ?? null, high: h.cloud_cover_high?.[i] ?? null });
  });
  return { timeZone: r.timezone, utcOffsetSeconds: r.utc_offset_seconds ?? 0, hours, fetchedAt };
}

/** Total cloud % for the hour that contains `ms` (Unix ms), or null when the forecast does not cover it. */
export function cloudAt(f: CloudForecast, ms: number): number | null {
  const s = Math.floor(ms / 1000);
  const hit = f.hours.find((h) => s >= h.t && s < h.t + 3600);
  return hit ? hit.cloud : null;
}

export async function fetchForecast(latDeg: number, lonDeg: number, fetchFn: typeof fetch, now: () => Date, signal?: AbortSignal): Promise<CloudForecast> {
  const res = await fetchFn(forecastUrl(latDeg, lonDeg), { signal });
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  return parseForecast(await res.json(), now());
}
