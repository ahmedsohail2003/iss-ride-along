// Visible-pass predictor (M5): when can someone at a given place see the station with their own eyes?
// Pure functions, no DOM, so the tests run them in Node against the Heavens-Above fixture.
//
// A moment counts as "visible" when all three hold (the rule measured to match Heavens-Above in the
// research spike, .autopilot/research/track-orbit-math-passes-prior-art.md section 3):
//   1. the station is at least 10 degrees above the observer's horizon,
//   2. the Sun is at least 6 degrees below the observer's horizon (the sky is dark enough),
//   3. the station itself is in sunlight (satellite.js shadowFraction < 1: not fully in Earth's shadow).
// Search: 20 s coarse steps, every boundary narrowed by bisection to 0.5 s, the highest point by a
// golden-section search over the visible part.
import type { EcfVec3, EciVec3, GeodeticLocation, Kilometer, SatRec } from 'satellite.js';
import * as sat from './satellite-lite';
import { observer } from './orbit';

export const PASS_RULES = {
  minElDeg: 10,
  maxSunElDeg: -6,
  coarseStepS: 20,
  refineS: 0.5,
} as const;

const AU_KM = 149597870.7;
const DEG = 180 / Math.PI;

export interface Place {
  name: string;
  latDeg: number;
  lonDeg: number;
  /** Height above sea level in metres (0 when unknown; it changes pass times by well under a second). */
  heightM?: number;
}

export type StartReason = 'rises' | 'leaves-shadow' | 'sky-darkens' | 'window';
export type EndReason = 'sets' | 'enters-shadow' | 'sky-brightens' | 'window';

export interface VisiblePass {
  start: Date;
  peak: Date;
  end: Date;
  startElDeg: number;
  peakElDeg: number;
  endElDeg: number;
  startAzDeg: number;
  peakAzDeg: number;
  endAzDeg: number;
  startsBy: StartReason;
  endsBy: EndReason;
}

export interface PassSearch {
  passes: VisiblePass[];
  /** Times the station climbed 10 degrees or more above the horizon, seen or not. */
  highPasses: number;
  /** Plain sentence for an empty list; null when there is at least one visible pass. */
  message: string | null;
  searchMs: number;
}

/** Where the station and the Sun are, seen from the observer, at `ms` (Unix ms); null if SGP4 fails. */
export function lookAt(satrec: SatRec, obs: GeodeticLocation, ms: number) {
  const t = new Date(ms);
  const pv = sat.propagate(satrec, t);
  if (!pv || !pv.position) return null;
  const gmst = sat.gstime(t);
  const look = sat.ecfToLookAngles(obs, sat.eciToEcf(pv.position, gmst) as EcfVec3<Kilometer>);
  const { rsun } = sat.sunPos(sat.jday(t));
  const sunKm = { x: rsun.x * AU_KM, y: rsun.y * AU_KM, z: rsun.z * AU_KM };
  const sunLook = sat.ecfToLookAngles(obs, sat.eciToEcf(sunKm, gmst) as EcfVec3<Kilometer>);
  const shadow = sat.shadowFraction(rsun, pv.position as EciVec3<Kilometer>);
  return {
    elDeg: look.elevation * DEG,
    azDeg: look.azimuth * DEG,
    sunElDeg: sunLook.elevation * DEG,
    shadow,
  };
}

function elevationDeg(satrec: SatRec, obs: GeodeticLocation, ms: number): number {
  const t = new Date(ms);
  const pv = sat.propagate(satrec, t);
  if (!pv || !pv.position) return -90;
  return sat.ecfToLookAngles(obs, sat.eciToEcf(pv.position, sat.gstime(t)) as EcfVec3<Kilometer>).elevation * DEG;
}

/** The three-part visibility rule at one instant. */
export function isVisibleAt(satrec: SatRec, obs: GeodeticLocation, ms: number): boolean {
  const l = lookAt(satrec, obs, ms);
  return !!l && l.elDeg >= PASS_RULES.minElDeg && l.sunElDeg <= PASS_RULES.maxSunElDeg && l.shadow < 1;
}

/**
 * `pred(a)` and `pred(b)` differ. Narrow the switch to under `PASS_RULES.refineS` seconds and return
 * the final bracket [lo, hi]: `pred(lo) === pred(a)` and `pred(hi) === pred(b)`.
 */
function crossing(pred: (ms: number) => boolean, a: number, b: number): [number, number] {
  const atA = pred(a);
  let lo = a;
  let hi = b;
  while (hi - lo > PASS_RULES.refineS * 1000) {
    const mid = (lo + hi) / 2;
    if (pred(mid) === atA) lo = mid;
    else hi = mid;
  }
  return [lo, hi];
}

/** Time of the highest value of `f` on [a, b] (golden-section; the end points are checked too). */
function argMax(f: (ms: number) => number, a: number, b: number): number {
  const g = (Math.sqrt(5) - 1) / 2;
  let lo = a;
  let hi = b;
  let x1 = hi - g * (hi - lo);
  let x2 = lo + g * (hi - lo);
  let f1 = f(x1);
  let f2 = f(x2);
  while (hi - lo > PASS_RULES.refineS * 1000) {
    if (f1 < f2) {
      lo = x1;
      x1 = x2;
      f1 = f2;
      x2 = lo + g * (hi - lo);
      f2 = f(x2);
    } else {
      hi = x2;
      x2 = x1;
      f2 = f1;
      x1 = hi - g * (hi - lo);
      f1 = f(x1);
    }
  }
  const mid = (lo + hi) / 2;
  return [a, mid, b].reduce((best, t) => (f(t) > f(best) ? t : best), mid);
}

/** Intervals [rise, set] (Unix ms) when the station is 10 degrees or more above the horizon. */
function highIntervals(satrec: SatRec, obs: GeodeticLocation, t0: number, t1: number): [number, number][] {
  const step = PASS_RULES.coarseStepS * 1000;
  const min = PASS_RULES.minElDeg;
  const el = (ms: number) => elevationDeg(satrec, obs, ms);
  const above = (ms: number) => el(ms) >= min;
  const out: [number, number][] = [];
  let t = t0;
  let e = el(t);
  let rise: number | null = e >= min ? t0 : null;
  let prevT = t0 - step;
  let prevE = -90;
  while (t < t1) {
    const nt = Math.min(t + step, t1);
    const ne = el(nt);
    if (rise === null && ne >= min) {
      rise = crossing(above, t, nt)[1]; // first moment above
    } else if (rise !== null && ne < min) {
      out.push([rise, crossing(above, t, nt)[0]]); // last moment above
      rise = null;
    } else if (rise === null && e > prevE && e > ne && e > min - 5 && prevT >= t0) {
      // A low pass whose time above 10 degrees falls between two samples: look for its top.
      const top = argMax(el, prevT, nt);
      if (el(top) >= min) out.push([crossing(above, prevT, top)[1], crossing(above, top, nt)[0]]);
    }
    prevT = t;
    prevE = e;
    t = nt;
    e = ne;
  }
  if (rise !== null) out.push([rise, t1]);
  return out;
}

/** Every visible pass between `start` and `end` for the observer `obs`. */
export function findVisiblePasses(satrec: SatRec, obs: GeodeticLocation, start: Date, end: Date): { passes: VisiblePass[]; highPasses: number } {
  const t0 = start.getTime();
  const t1 = end.getTime();
  const step = PASS_RULES.coarseStepS * 1000;
  const vis = (ms: number) => isVisibleAt(satrec, obs, ms);
  const high = highIntervals(satrec, obs, t0, t1);
  const passes: VisiblePass[] = [];

  for (const [gs, ge] of high) {
    // Sample the high interval (its two ends included) and find where visibility switches on and off.
    const times: number[] = [];
    for (let t = gs; t < ge; t += step) times.push(t);
    times.push(ge);
    let vs: number | null = vis(times[0]) ? times[0] : null;
    for (let i = 1; i < times.length; i++) {
      const now = vis(times[i]);
      if (vs === null && now) vs = crossing(vis, times[i - 1], times[i])[1]; // first visible moment
      else if (vs !== null && !now) {
        const ve = crossing(vis, times[i - 1], times[i])[0]; // last visible moment
        passes.push(describe(satrec, obs, vs, ve, gs, ge, t0, t1));
        vs = null;
      }
    }
    if (vs !== null) passes.push(describe(satrec, obs, vs, ge, gs, ge, t0, t1));
  }
  return { passes, highPasses: high.length };
}

function describe(satrec: SatRec, obs: GeodeticLocation, vs: number, ve: number, gs: number, ge: number, t0: number, t1: number): VisiblePass {
  const peak = argMax((ms) => elevationDeg(satrec, obs, ms), vs, ve);
  const a = lookAt(satrec, obs, vs)!;
  const p = lookAt(satrec, obs, peak)!;
  const b = lookAt(satrec, obs, ve)!;
  const why = (l: NonNullable<ReturnType<typeof lookAt>>) =>
    l.shadow >= 1 ? 'shadow' : l.sunElDeg > PASS_RULES.maxSunElDeg ? 'sky' : 'low';
  // What stops the pass being visible just outside its two ends.
  const before = lookAt(satrec, obs, vs - 1000);
  const after = lookAt(satrec, obs, ve + 1000);
  const startsBy: StartReason =
    vs <= t0 ? 'window' : vs === gs || !before ? 'rises' : why(before) === 'shadow' ? 'leaves-shadow' : why(before) === 'sky' ? 'sky-darkens' : 'rises';
  const endsBy: EndReason =
    ve >= t1 ? 'window' : ve === ge || !after ? 'sets' : why(after) === 'shadow' ? 'enters-shadow' : why(after) === 'sky' ? 'sky-brightens' : 'sets';
  return {
    start: new Date(vs),
    peak: new Date(peak),
    end: new Date(ve),
    startElDeg: a.elDeg,
    peakElDeg: p.elDeg,
    endElDeg: b.elDeg,
    startAzDeg: a.azDeg,
    peakAzDeg: p.azDeg,
    endAzDeg: b.azDeg,
    startsBy,
    endsBy,
  };
}

/** Highest latitude the station flies over, in degrees (its orbit's inclination). */
export function inclinationDeg(satrec: SatRec): number {
  return satrec.inclo * DEG;
}

/** Visible passes for a place over the next `days` days, with a plain sentence when there are none. */
export function predictForPlace(satrec: SatRec, place: Place, from: Date, days = 5): PassSearch {
  const t = performance.now();
  const obs = observer(place.latDeg, place.lonDeg, (place.heightM ?? 0) / 1000);
  const end = new Date(from.getTime() + days * 86_400_000);
  const { passes, highPasses } = findVisiblePasses(satrec, obs, from, end);
  const searchMs = performance.now() - t;
  let message: string | null = null;
  if (passes.length === 0) {
    const hours = Math.round(days * 24);
    const span = days === 1 ? 'the next day' : days >= 1 ? `the next ${days} days` : `the next ${hours} hour${hours === 1 ? '' : 's'}`;
    message =
      highPasses === 0
        ? `From ${place.name} the station never climbs ${PASS_RULES.minElDeg} degrees above the horizon in ${span}.` +
          (Math.abs(place.latDeg) > inclinationDeg(satrec)
            ? ` Its orbit stays within ${inclinationDeg(satrec).toFixed(1)} degrees of the equator, so this far ${place.latDeg > 0 ? 'north' : 'south'} it never rises high enough to see.`
            : '')
        : `The station climbs above ${PASS_RULES.minElDeg} degrees over ${place.name} ${highPasses} time${highPasses === 1 ? '' : 's'} in ${span}, ` +
          `but never while the sky there is dark and the station is still in sunlight, so none of them can be seen.`;
  }
  return { passes, highPasses, message, searchMs };
}

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
/** 16-point compass direction for an azimuth in degrees (0 = north, 90 = east). */
export function compass(azDeg: number): string {
  return COMPASS[Math.round((((azDeg % 360) + 360) % 360) / 22.5) % 16];
}

// ---- Agreement with the committed Heavens-Above list (the page prints this; the tests check it).

export interface PassFixture {
  source: string;
  observer: { name: string; latDeg: number; lonDeg: number; heightM: number };
  window: { startUtc: string; endUtc: string };
  tle: { line1: string; line2: string };
  passes: { date: string; start: string; peakElDeg: number; end: string; mag: number }[];
}

export interface Agreement {
  refCount: number;
  ourCount: number;
  /** Reference passes with one of ours starting within 60 s. */
  matched: number;
  maxStartS: number;
  maxEndS: number;
  maxPeakDeg: number;
}

/** Fixture rows are Eastern Standard Time (UTC-5). */
export function fixtureTime(date: string, hms: string): Date {
  return new Date(`${date}T${hms}-05:00`);
}

/** Run our search over the fixture's window with the fixture's orbit data and compare row by row. */
export function agreementWith(fx: PassFixture): Agreement {
  const satrec = sat.twoline2satrec(fx.tle.line1, fx.tle.line2);
  const obs = observer(fx.observer.latDeg, fx.observer.lonDeg, fx.observer.heightM / 1000);
  const { passes } = findVisiblePasses(satrec, obs, new Date(fx.window.startUtc), new Date(fx.window.endUtc));
  const a: Agreement = { refCount: fx.passes.length, ourCount: passes.length, matched: 0, maxStartS: 0, maxEndS: 0, maxPeakDeg: 0 };
  for (const r of fx.passes) {
    const rs = fixtureTime(r.date, r.start).getTime();
    const ours = passes.find((p) => Math.abs(p.start.getTime() - rs) < 60_000);
    if (!ours) continue;
    a.matched++;
    a.maxStartS = Math.max(a.maxStartS, Math.abs(ours.start.getTime() - rs) / 1000);
    a.maxEndS = Math.max(a.maxEndS, Math.abs(ours.end.getTime() - fixtureTime(r.date, r.end).getTime()) / 1000);
    a.maxPeakDeg = Math.max(a.maxPeakDeg, Math.abs(ours.peakElDeg - r.peakElDeg));
  }
  return a;
}
