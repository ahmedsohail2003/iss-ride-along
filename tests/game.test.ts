// M6 game: "tap where the station will be in 10 minutes". A perfect guess scores 0 km; the answer is
// the SGP4 position 10 minutes after the round's start; the device leaderboard keeps the 5 lowest totals.
import { readFileSync } from 'node:fs';
import * as satjs from 'satellite.js';
import { describe, expect, test } from 'vitest';
import { addToBoard, AHEAD_MIN, parseBoard, positionAt, revealPath, roundTimes, scoreGuess, type BoardEntry } from '../src/game/game';
import { satrecFromTle } from '../src/orbit/orbit';

const satrec = satrecFromTle(readFileSync(new URL('../src/data/iss.tle', import.meta.url), 'utf8'));
const t0 = new Date('2026-11-14T22:00:00Z');

/** Independent distance: angle between the two unit vectors (not the haversine the game uses). */
function vectorKm(a: { latDeg: number; lonDeg: number }, b: { latDeg: number; lonDeg: number }): number {
  const r = Math.PI / 180;
  const u = (p: typeof a) => [Math.cos(p.latDeg * r) * Math.cos(p.lonDeg * r), Math.cos(p.latDeg * r) * Math.sin(p.lonDeg * r), Math.sin(p.latDeg * r)];
  const [x, y] = [u(a), u(b)];
  const cross = Math.hypot(x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]);
  const dot = x[0] * y[0] + x[1] * y[1] + x[2] * y[2];
  return 6371.0088 * Math.atan2(cross, dot);
}

describe('game rules', () => {
  test('a perfect guess scores 0 km', () => {
    const { target } = roundTimes(t0, 1);
    const answer = positionAt(satrec, target)!;
    expect(scoreGuess(answer, answer)).toBe(0);
  });

  test('rounds fast-forward 10 minutes each: round n asks about t0 + 10n min', () => {
    for (const n of [1, 2, 3]) {
      const { start, target } = roundTimes(t0, n);
      expect(start.getTime() - t0.getTime()).toBe((n - 1) * AHEAD_MIN * 60_000);
      expect(target.getTime() - start.getTime()).toBe(AHEAD_MIN * 60_000);
    }
  });

  test('the answer is satellite.js SGP4 at the target time, called directly', () => {
    const { target } = roundTimes(t0, 2);
    const pv = satjs.propagate(satrec, target)!;
    const geo = satjs.eciToGeodetic(pv.position as satjs.EciVec3<number>, satjs.gstime(target));
    const ours = positionAt(satrec, target)!;
    expect(Math.abs(ours.latDeg - satjs.degreesLat(geo.latitude))).toBeLessThan(1e-9);
    expect(Math.abs(ours.lonDeg - satjs.degreesLong(geo.longitude))).toBeLessThan(1e-9);
  });

  test('scores agree with an independent vector formula, and tapping the start point costs the 10-minute ground track', () => {
    const { start, target } = roundTimes(t0, 1);
    const a = positionAt(satrec, start)!;
    const b = positionAt(satrec, target)!;
    const km = scoreGuess(a, b);
    console.log(`tapping where the station is now scores ${km.toFixed(1)} km (it moves that far over the ground in ${AHEAD_MIN} min)`);
    expect(Math.abs(km - vectorKm(a, b))).toBeLessThan(0.001);
    expect(km).toBeGreaterThan(3800);
    expect(km).toBeLessThan(4800);
    for (const g of [{ latDeg: 10, lonDeg: -170 }, { latDeg: -45, lonDeg: 60 }, { latDeg: 51, lonDeg: 179.9 }]) {
      expect(Math.abs(scoreGuess(g, b) - vectorKm(g, b))).toBeLessThan(0.001);
    }
  });

  test('the fast-forward path runs from the start position to the answer', () => {
    const { start, target } = roundTimes(t0, 3);
    const path = revealPath(satrec, start, target, 20);
    expect(path).toHaveLength(21);
    expect(path[0]).toEqual(positionAt(satrec, start));
    expect(path[20]).toEqual(positionAt(satrec, target));
  });
});

describe('leaderboard on this device', () => {
  const e = (totalKm: number, at = '2026-11-14T22:00:00Z'): BoardEntry => ({ totalKm, roundsKm: [totalKm / 3, totalKm / 3, totalKm / 3], at });

  test('keeps the 5 lowest totals, lowest first, and reports the place', () => {
    let board: BoardEntry[] = [];
    for (const km of [900, 300, 1200, 600, 1500]) board = addToBoard(board, e(km)).board;
    expect(board.map((x) => x.totalKm)).toEqual([300, 600, 900, 1200, 1500]);
    const better = addToBoard(board, e(450));
    expect(better.place).toBe(2);
    expect(better.board.map((x) => x.totalKm)).toEqual([300, 450, 600, 900, 1200]);
    const worse = addToBoard(better.board, e(5000));
    expect(worse.place).toBe(0);
    expect(worse.board).toHaveLength(5);
  });

  test('a saved board that is missing or malformed reads as empty; bad rows are dropped', () => {
    expect(parseBoard(null)).toEqual([]);
    expect(parseBoard('not json')).toEqual([]);
    expect(parseBoard('{"a":1}')).toEqual([]);
    const ok = e(700);
    expect(parseBoard(JSON.stringify([ok, { totalKm: 'x' }, { totalKm: -1, roundsKm: [], at: 'y' }, null]))).toEqual([ok]);
  });
});
