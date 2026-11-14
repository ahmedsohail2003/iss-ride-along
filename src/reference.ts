// The "check against reference" button: one request to wheretheiss.at, an independent tracker
// that runs its own code on the same public orbit data. It checks our math, not the station's
// true position (neither side measures the station).
import type { ReferenceSample } from './orbit/compare';

export const WHERETHEISS_URL = 'https://api.wheretheiss.at/v1/satellites/25544?units=kilometers';
const TIMEOUT_MS = 8000;

export async function fetchReference(): Promise<ReferenceSample> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(WHERETHEISS_URL, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) throw new Error(`wheretheiss.at answered HTTP ${res.status}`);
    const j = (await res.json()) as ReferenceSample;
    for (const k of ['timestamp', 'latitude', 'longitude', 'altitude', 'velocity'] as const) {
      if (typeof j[k] !== 'number') throw new Error(`wheretheiss.at reply has no numeric ${k}`);
    }
    return j;
  } finally {
    clearTimeout(timer);
  }
}
