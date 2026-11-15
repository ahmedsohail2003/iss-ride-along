// Where the page gets the station's orbit elements: a live CelesTrak fetch (at most one per page
// load, skipped when this device saved a copy under 2 hours ago), the copy saved on this device,
// or the copy built into the page. The newest element set wins.
import type { SatRec } from 'satellite.js';
import { satrecFromTle, stateAt } from './orbit/orbit';
import { elementEpoch } from './orbit/track';

export const CELESTRAK_TLE_URL = 'https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE';
const STORAGE_KEY = 'iss-ride-along.tle.v1';
const SKIP_FETCH_IF_SAVED_WITHIN_MS = 2 * 3600_000;
const FETCH_TIMEOUT_MS = 8000;

export type ElementSource = 'live' | 'saved' | 'embedded';

export interface Elements {
  satrec: SatRec;
  epoch: Date;
  tleText: string;
  source: ElementSource;
  /** When this copy was downloaded from CelesTrak. */
  retrievedAt: Date;
}

/** Parse and sanity-check a TLE for NORAD 25544; null if it is not a usable ISS element set. */
export function parseIssTle(text: string, source: ElementSource, retrievedAt: Date): Elements | null {
  const lines = text.trim().split(/\r?\n/).map((l) => l.trim());
  if (lines.length < 2) return null;
  const l1 = lines.at(-2)!;
  const l2 = lines.at(-1)!;
  if (!l1.startsWith('1 25544') || !l2.startsWith('2 25544')) return null;
  try {
    const satrec = satrecFromTle(`${l1}\n${l2}`);
    if (satrec.error !== 0) return null;
    const epoch = elementEpoch(satrec);
    if (!stateAt(satrec, epoch)) return null;
    return { satrec, epoch, tleText: `${l1}\n${l2}`, source, retrievedAt };
  } catch {
    return null;
  }
}

function readSaved(): Elements | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as { tle: string; retrievedAt: string };
    return parseIssTle(saved.tle, 'saved', new Date(saved.retrievedAt));
  } catch {
    return null;
  }
}

function save(el: Elements): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tle: el.tleText, retrievedAt: el.retrievedAt.toISOString() }));
  } catch {
    // Storage can be off (private mode, some file:// setups): the page still works without it.
  }
}

async function fetchLive(): Promise<Elements | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(CELESTRAK_TLE_URL, { signal: ctrl.signal, cache: 'no-store' });
    if (!res.ok) return null;
    return parseIssTle(await res.text(), 'live', new Date());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function newest(...candidates: (Elements | null)[]): Elements {
  const ok = candidates.filter((c): c is Elements => c !== null);
  ok.sort((a, b) => b.epoch.getTime() - a.epoch.getTime());
  return ok[0];
}

/** The best element set available without waiting for the network. */
export function initialElements(embeddedTle: string, embeddedRetrievedAt: Date): Elements {
  const embedded = parseIssTle(embeddedTle, 'embedded', embeddedRetrievedAt);
  if (!embedded) throw new Error('embedded orbit data is not a valid ISS element set');
  return newest(embedded, readSaved());
}

/**
 * Try one live fetch (unless this device saved a copy recently) and return the newest element set,
 * or null if nothing newer than `current` was found. `onUnreachable` runs when the live fetch fails.
 */
export async function refreshElements(current: Elements, onUnreachable?: () => void): Promise<Elements | null> {
  const saved = readSaved();
  if (saved && Date.now() - saved.retrievedAt.getTime() < SKIP_FETCH_IF_SAVED_WITHIN_MS) return null;
  const live = await fetchLive();
  if (!live) {
    // M7: CelesTrak gave no usable element set (no answer, an error status or a bad reply).
    onUnreachable?.();
    return null;
  }
  save(live);
  return live.epoch.getTime() >= current.epoch.getTime() ? live : null;
}
