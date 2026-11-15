// Day and night (C2): where on Earth the Sun is down right now, and whether the station itself is in
// sunlight. Pure functions, no DOM, so the tests run them in Node.
//
// You can see the station only when you are in the dark and it is still in sunlight, which happens in
// the hours after sunset and before sunrise. This file gives the map both halves of that sentence: the
// night side of the Earth (shaded) and the station's own sunlight (the label on the marker).
import type { EciVec3, Kilometer, SatRec } from 'satellite.js';
import * as sat from './satellite-lite';
import { inSunlight } from './passes';

const DEG = 180 / Math.PI;

/** The point on Earth with the Sun straight overhead at `date` (degrees; longitude -180..180). */
export function subsolarPoint(date: Date): { latDeg: number; lonDeg: number } {
  const { rsun } = sat.sunPos(sat.jday(date));
  // Rotating the Sun's direction into the Earth-fixed frame only needs the sidereal angle (units cancel).
  const e = sat.eciToEcf(rsun as unknown as EciVec3<Kilometer>, sat.gstime(date));
  return { latDeg: Math.atan2(e.z, Math.hypot(e.x, e.y)) * DEG, lonDeg: Math.atan2(e.y, e.x) * DEG };
}

export interface NightLine {
  /** The day/night line: one [lat, lon] per degree of longitude from -180 to 180 (361 points). */
  line: [number, number][];
  /** +1 when the North Pole is in the dark (our winter), -1 when the South Pole is. */
  darkPole: 1 | -1;
  /** The night side as one closed ring: the line, then over the dark pole back to the start. */
  polygon: [number, number][];
}

/**
 * The day/night line at `date`. At latitude lat and longitude lon the Sun's height h obeys
 *   sin h = sin(lat) sin(dec) + cos(lat) cos(dec) cos(lon - subLon),
 * so the line (h = 0) is lat = atan(-cos(lon - subLon) cos(dec) / sin(dec)), one latitude for every
 * longitude: nothing wraps at the date line. The line is geometric: the centre of the Sun on the
 * horizon, with no bending of light by the air (refraction lifts the Sun about half a degree, so the
 * real sunset comes a few minutes later than this line) and no twilight.
 */
export function nightLine(date: Date): NightLine {
  const { latDeg: decDeg, lonDeg: subLon } = subsolarPoint(date);
  const dec = decDeg / DEG;
  // At an equinox sin(dec) is 0 and the line runs pole to pole; a tiny value keeps the formula finite.
  const sinDec = Math.abs(Math.sin(dec)) < 1e-9 ? (dec < 0 ? -1e-9 : 1e-9) : Math.sin(dec);
  const line: [number, number][] = [];
  for (let lon = -180; lon <= 180; lon++) {
    const lat = Math.atan((-Math.cos((lon - subLon) / DEG) * Math.cos(dec)) / sinDec) * DEG;
    line.push([lat, lon]);
  }
  // The pole whose own Sun height equals the declination is dark when the declination is below zero.
  const darkPole: 1 | -1 = decDeg < 0 ? 1 : -1;
  const pole = 90 * darkPole;
  return { line, darkPole, polygon: [...line, [pole, 180], [pole, -180]] };
}

/**
 * Is the station in sunlight at `date`? The same test as the pass predictor (M5, `isVisibleAt()` in
 * src/orbit/passes.ts): satellite.js `shadowFraction()` of the Sun's disc hidden by the Earth, through the
 * shared `inSunlight()`. Null if SGP4 fails.
 */
export function sunlitNow(satrec: SatRec, date: Date): boolean | null {
  const pv = sat.propagate(satrec, date);
  if (!pv || !pv.position) return null;
  const { rsun } = sat.sunPos(sat.jday(date));
  return inSunlight(sat.shadowFraction(rsun, pv.position as EciVec3<Kilometer>));
}

export interface SunlightChange {
  /** The first whole second after `from` at which the station's sunlight differs from now. */
  at: Date;
  seconds: number;
  /** What it changes to: true = it leaves Earth's shadow (its sunrise), false = it enters it. */
  sunlitAfter: boolean;
}

/**
 * When the station next enters or leaves Earth's shadow: steps forward 10 s at a time up to `maxMin`
 * minutes (60), then narrows the 10-s step where it changed to 1 s. Null if nothing changes in that time
 * (it can stay in sunlight for days near midsummer) or SGP4 fails.
 */
export function nextSunlightChange(satrec: SatRec, from: Date, maxMin = 60): SunlightChange | null {
  const t0 = from.getTime();
  const now = sunlitNow(satrec, from);
  if (now === null) return null;
  const end = t0 + maxMin * 60_000;
  for (let t = t0; t < end; t += 10_000) {
    const next = Math.min(t + 10_000, end);
    const s = sunlitNow(satrec, new Date(next));
    if (s === null) return null;
    if (s === now) continue;
    for (let u = t + 1000; u <= next; u += 1000) {
      const su = sunlitNow(satrec, new Date(u));
      if (su !== null && su !== now) return { at: new Date(u), seconds: (u - t0) / 1000, sunlitAfter: su };
    }
    return { at: new Date(next), seconds: (next - t0) / 1000, sunlitAfter: s };
  }
  return null;
}

/** The two label texts: "in sunlight", or "in Earth's shadow, sunrise in N min" (N rounded up). */
export function sunlightLabel(satrec: SatRec, date: Date): { sunlit: boolean; text: string } | null {
  const sunlit = sunlitNow(satrec, date);
  if (sunlit === null) return null;
  if (sunlit) return { sunlit, text: 'in sunlight' };
  const c = nextSunlightChange(satrec, date);
  return {
    sunlit,
    text: c ? `in Earth's shadow, sunrise in ${Math.max(1, Math.ceil(c.seconds / 60))} min` : "in Earth's shadow",
  };
}
