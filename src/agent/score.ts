// The fixed scoring rule both modes share (with and without AI). Written out in HOW_IT_WORKS.md.
//   allowed: the pass starts inside the window (on one of the chosen nights, not before the earliest
//            and not after the latest local time; a "night" is the local date the pass starts on);
//   score:   (peak height in degrees / 90) x (1 - cloud / 100); unknown cloud counts as 50%;
//   pick:    the highest-scoring allowed pass, ties to the earlier one; if every allowed pass scores
//            under 0.05 the answer is "no pass worth going out for in your window".
import { localDate, localHM } from './format';

export const MIN_SCORE = 0.05;
export const UNKNOWN_CLOUD = 50;
export const LOW_PEAK_DEG = 20;
export const NO_PASS_TEXT = 'no pass worth going out for in your window';

export interface Window {
  /** Local dates "YYYY-MM-DD"; null = every night. */
  nights: string[] | null;
  /** Local "HH:MM" (24 h); null = no limit. */
  earliest: string | null;
  latest: string | null;
}

export interface ScoreInput {
  id: string;
  start: Date;
  peakElDeg: number;
  /** null when the forecast does not cover the pass hour. */
  cloud: number | null;
}

export interface Scored extends ScoreInput {
  allowed: boolean;
  score: number;
  cloudUsed: number;
  reasons: string[];
}

const HM = /^([01]?\d|2[0-3]):([0-5]\d)$/;
/** "8:30", "20:30" or "8:30 PM" -> "20:30"; null if it is not a time. */
export function normaliseHM(s: string | null | undefined): string | null {
  if (!s) return null;
  const m = /^\s*(\d{1,2}):(\d{2})\s*([AaPp])?\.?\s*[Mm]?\.?\s*$/.exec(s);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2];
  const ap = m[3]?.toLowerCase();
  if (ap === 'p' && h < 12) h += 12;
  if (ap === 'a' && h === 12) h = 0;
  const out = `${String(h).padStart(2, '0')}:${min}`;
  return HM.test(out) ? out : null;
}

export function scorePass(p: ScoreInput, w: Window, timeZone: string): Scored {
  const reasons: string[] = [];
  const night = localDate(p.start, timeZone);
  const hm = localHM(p.start, timeZone);
  let allowed = true;
  if (w.nights && !w.nights.includes(night)) {
    allowed = false;
    reasons.push('not on your nights');
  }
  const earliest = normaliseHM(w.earliest);
  const latest = normaliseHM(w.latest);
  if (earliest && hm < earliest) {
    allowed = false;
    reasons.push('before your earliest time');
  }
  if (latest && hm > latest) {
    allowed = false;
    reasons.push('after your latest time');
  }
  const cloudUsed = p.cloud ?? UNKNOWN_CLOUD;
  if (p.cloud === null) reasons.push('cloud unknown, counted as 50%');
  else if (p.cloud >= 50) reasons.push(`cloud ${Math.round(p.cloud)}%`);
  if (p.peakElDeg < LOW_PEAK_DEG) reasons.push(`low: ${Math.round(p.peakElDeg)}° at peak`);
  const score = (p.peakElDeg / 90) * (1 - cloudUsed / 100);
  return { ...p, allowed, score, cloudUsed, reasons };
}

export interface Pick {
  best: Scored | null;
  /** When best is null: the highest-scoring pass outside the window (named, never shown automatically). */
  bestOutside: Scored | null;
}

export function pickBest(scored: Scored[]): Pick {
  const byScore = (a: Scored, b: Scored) => b.score - a.score || a.start.getTime() - b.start.getTime();
  const allowed = scored.filter((s) => s.allowed).sort(byScore);
  const best = allowed.length && allowed[0].score >= MIN_SCORE ? allowed[0] : null;
  const outside = scored.filter((s) => !s.allowed && s.score >= MIN_SCORE).sort(byScore);
  return { best, bestOutside: best ? null : (outside[0] ?? null) };
}
