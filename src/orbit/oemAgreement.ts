// C1: the measured gap by age of the orbit numbers, from scripts/check-oem.mjs (src/data/oem-agreement.json).
// DOM-free, so the page panel (src/oem-ui.ts) and the planner (A1's orbitDataAge) quote the same numbers.
import agreementJson from '../data/oem-agreement.json';

export const agreement = agreementJson;
const BY_AGE = agreementJson.byAge as [number, number][];

/** The measured gap for an age (hours), from check-oem.mjs's table: the nearest hourly point. */
export function measuredAtAge(hours: number): { hours: number; km: number } | null {
  if (BY_AGE.length === 0 || hours < BY_AGE[0][0] - 1 || hours > BY_AGE[BY_AGE.length - 1][0] + 1) return null;
  let best = BY_AGE[0];
  for (const p of BY_AGE) if (Math.abs(p[0] - hours) < Math.abs(best[0] - hours)) best = p;
  return { hours: best[0], km: best[1] };
}

/** One sentence for the planner (A1's orbitDataAge): the measured gap at this age, or null. */
export function measuredLine(hours: number): string | null {
  const m = measuredAtAge(hours);
  return m ? `measured at this age: about ${m.km.toFixed(1)} km apart from NASA's own trajectory (measured on one set of orbit numbers, ${agreement.measuredOn})` : null;
}

