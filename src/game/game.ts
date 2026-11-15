// The game (M6): "tap where the station will be in 10 minutes", 3 rounds, score = km off.
// Pure rules, no DOM: the page (src/ui/game.ts) draws them. Each round fast-forwards the game clock
// by 10 minutes, so round 2 starts where round 1's answer was: the player rides along one stretch
// of the orbit. The answer is our own SGP4 position (stateAt) at the round's target time, and the
// score is the great-circle distance between the tap and that point.
import type { SatRec } from 'satellite.js';
import { greatCircleKm, stateAt } from '../orbit/orbit';

export const ROUNDS = 3;
export const AHEAD_MIN = 10;
/** How many results the device leaderboard keeps. */
export const BOARD_SIZE = 5;
export const BOARD_STORAGE_KEY = 'iss-ride-along-game-board';

export interface LatLon {
  latDeg: number;
  lonDeg: number;
}

/** Round `n` (1-based) of a game that began at `t0`: it starts n-1 steps of 10 min later and asks about 10 min after that. */
export function roundTimes(t0: Date, n: number): { start: Date; target: Date } {
  const step = AHEAD_MIN * 60_000;
  return { start: new Date(t0.getTime() + (n - 1) * step), target: new Date(t0.getTime() + n * step) };
}

/** Where the station is at `at` (the point under it), or null if SGP4 fails. */
export function positionAt(satrec: SatRec, at: Date): LatLon | null {
  const s = stateAt(satrec, at);
  return s ? { latDeg: s.latDeg, lonDeg: s.lonDeg } : null;
}

/** Score for one tap: km along the Earth's surface between the guess and the answer (0 is perfect). */
export function scoreGuess(guess: LatLon, answer: LatLon): number {
  return greatCircleKm(guess.latDeg, guess.lonDeg, answer.latDeg, answer.lonDeg);
}

/** Points along the station's path from `start` to `target`, for the fast-forward animation. */
export function revealPath(satrec: SatRec, start: Date, target: Date, steps = 30): LatLon[] {
  const out: LatLon[] = [];
  const span = target.getTime() - start.getTime();
  for (let i = 0; i <= steps; i++) {
    const p = positionAt(satrec, new Date(start.getTime() + (span * i) / steps));
    if (p) out.push(p);
  }
  return out;
}

export interface BoardEntry {
  /** Sum of the three rounds, km. */
  totalKm: number;
  roundsKm: number[];
  /** When the game ended (ISO time). */
  at: string;
}

/** Add a finished game; keep the best BOARD_SIZE totals, lowest first. Returns the new board and the entry's place (1-based, 0 if it did not make the board). */
export function addToBoard(board: BoardEntry[], entry: BoardEntry, keep = BOARD_SIZE): { board: BoardEntry[]; place: number } {
  const all = [...board, entry].sort((a, b) => a.totalKm - b.totalKm || a.at.localeCompare(b.at));
  const kept = all.slice(0, keep);
  return { board: kept, place: kept.indexOf(entry) + 1 };
}

/** Read a saved board; anything malformed reads as an empty board (never throws). */
export function parseBoard(raw: string | null): BoardEntry[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v
      .filter(
        (e) =>
          e && Number.isFinite(e.totalKm) && e.totalKm >= 0 && Array.isArray(e.roundsKm) &&
          e.roundsKm.every((k: unknown) => Number.isFinite(k)) && typeof e.at === 'string',
      )
      .map((e) => ({ totalKm: e.totalKm, roundsKm: e.roundsKm, at: e.at }))
      .sort((a, b) => a.totalKm - b.totalKm)
      .slice(0, BOARD_SIZE);
  } catch {
    return [];
  }
}

/** "1,234 km" */
export function fmtKm(km: number): string {
  return `${Math.round(km).toLocaleString('en-US')} km`;
}
