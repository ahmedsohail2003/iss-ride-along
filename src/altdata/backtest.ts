// X6 Forecast lab: the harvest from orbit, scored the way a weather forecast is scored. Pure functions,
// no I/O. The page runs them on the bundled src/data/altdata.json when the card opens; the tests run
// them on the same file; scripts/fetch-altdata.mjs runs priceTest() on the corn price it downloads.
//
// The test is "out of sample": for each year, both lines are fitted on EARLIER years only (at least 12),
// then that year is forecast and compared with what happened.
//   trend line:         yield = a + b * year                         (the naive baseline)
//   satellite forecast: yield = a + b * year + c * signal            (signal = NOAA VHI, weeks 27-32)
// Skill = 1 - (satellite's mean squared error) / (trend line's mean squared error): 0 = no better than
// the trend line, 1 = perfect, below 0 = worse. The 80% range is the forecast plus or minus 1.2816
// residual standard deviations of the fit (sum of squared residuals divided by years minus fitted terms).

/** Year (as text, e.g. "2012") -> value. */
export type ByYear = Record<string, number>;

export const MIN_TRAIN_YEARS = 12;
export const MIN_TRAIN_YEARS_PRICE = 10;
export const Z80 = 1.2816;
/** Years are centred here before fitting, so the normal equations stay well conditioned. */
const CENTRE = 2000;

export interface Fit {
  /** Intercept first, then one coefficient per column. */
  coef: number[];
  /** Residual standard deviation: sqrt(sum of squared residuals / (rows - fitted terms)). */
  sd: number;
}

/** Ordinary least squares with an intercept: y = coef[0] + sum(coef[j+1] * row[j]). */
export function fitOls(rows: number[][], y: number[]): Fit {
  const X = rows.map((r) => [1, ...r]);
  const k = X[0].length;
  const A = Array.from({ length: k }, (_, i) => Array.from({ length: k }, (_, j) => X.reduce((s, r) => s + r[i] * r[j], 0)));
  const b = Array.from({ length: k }, (_, i) => X.reduce((s, r, n) => s + r[i] * y[n], 0));
  const coef = solve(A, b);
  const ssr = X.reduce((s, r, n) => s + (y[n] - predict(coef, r.slice(1))) ** 2, 0);
  return { coef, sd: Math.sqrt(ssr / (y.length - k)) };
}

export function predict(coef: number[], row: number[]): number {
  return coef[0] + row.reduce((s, x, j) => s + coef[j + 1] * x, 0);
}

/** Gaussian elimination with partial pivoting (k is 2 or 3 here). */
function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(M[r][i]) > Math.abs(M[p][i])) p = r;
    [M[i], M[p]] = [M[p], M[i]];
    for (let r = i + 1; r < n; r++) {
      const f = M[r][i] / M[i][i];
      for (let c = i; c <= n; c++) M[r][c] -= f * M[i][c];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let c = i + 1; c < n; c++) s -= M[i][c] * x[c];
    x[i] = s / M[i][i];
  }
  return x;
}

const meanSq = (e: number[]) => e.reduce((s, x) => s + x * x, 0) / e.length;
const rms = (e: number[]) => Math.sqrt(meanSq(e));
/** 1 - MSE(forecast errors) / MSE(baseline errors). */
export const skillScore = (forecastErr: number[], baselineErr: number[]) => 1 - meanSq(forecastErr) / meanSq(baselineErr);

export interface YearRow {
  year: number;
  signal: number;
  actual: number;
  trend: number;
  satellite: number;
  /** The satellite forecast's 80% range. */
  low: number;
  high: number;
  inRange: boolean;
}

export interface HarvestResult {
  rows: YearRow[];
  n: number;
  first: number;
  last: number;
  /** Years inside the record that have a yield but no complete signal (skipped). */
  missing: number[];
  rmseTrend: number;
  rmseSatellite: number;
  /** "Same as last year" baseline, for HOW_IT_WORKS.md. */
  rmseLastYear: number;
  skill: number;
  hits: number;
  /** The live forecast: fitted on every year through `last`, using the forecast year's signal. */
  forecast: { year: number; signal: number; value: number; low: number; high: number; trend: number } | null;
}

/** Earlier years only: the training set for test year `t`. Exported so the no-peeking test can swap it. */
export type TrainPicker = (years: number[], t: number) => number[];
export const earlierYears: TrainPicker = (years, t) => years.filter((y) => y < t);

function fitBoth(train: number[], signal: ByYear, yields: ByYear) {
  const y = train.map((yr) => yields[yr]);
  const trend = fitOls(train.map((yr) => [yr - CENTRE]), y);
  const sat = fitOls(train.map((yr) => [yr - CENTRE, signal[yr]]), y);
  return { trend, sat };
}

export function harvestBacktest(
  signal: ByYear,
  yields: ByYear,
  opts: { lastYear?: number; forecastYear?: number; minTrain?: number; train?: TrainPicker } = {},
): HarvestResult {
  const lastYear = opts.lastYear ?? 2025;
  const forecastYear = opts.forecastYear ?? lastYear + 1;
  const minTrain = opts.minTrain ?? MIN_TRAIN_YEARS;
  const pick = opts.train ?? earlierYears;
  const has = (o: ByYear, y: number) => Number.isFinite(o[y]);
  const yieldYears = Object.keys(yields).map(Number).filter((y) => has(yields, y) && y <= lastYear);
  const firstSignal = Math.min(...Object.keys(signal).map(Number));
  const years = yieldYears.filter((y) => has(signal, y)).sort((a, b) => a - b);
  const missing = yieldYears.filter((y) => y >= firstSignal && !has(signal, y)).sort((a, b) => a - b);

  const rows: YearRow[] = [];
  const lastYearErr: number[] = [];
  for (const t of years) {
    if (years.filter((y) => y < t).length < minTrain) continue;
    const { trend, sat } = fitBoth(pick(years, t), signal, yields);
    const pt = predict(trend.coef, [t - CENTRE]);
    const ps = predict(sat.coef, [t - CENTRE, signal[t]]);
    const actual = yields[t];
    rows.push({
      year: t,
      signal: signal[t],
      actual,
      trend: pt,
      satellite: ps,
      low: ps - Z80 * sat.sd,
      high: ps + Z80 * sat.sd,
      inRange: Math.abs(actual - ps) <= Z80 * sat.sd,
    });
    const prev = Math.max(...years.filter((y) => y < t));
    lastYearErr.push(actual - yields[prev]);
  }
  const eT = rows.map((r) => r.actual - r.trend);
  const eS = rows.map((r) => r.actual - r.satellite);

  let forecast: HarvestResult['forecast'] = null;
  if (has(signal, forecastYear)) {
    const { trend, sat } = fitBoth(years, signal, yields);
    const value = predict(sat.coef, [forecastYear - CENTRE, signal[forecastYear]]);
    forecast = {
      year: forecastYear,
      signal: signal[forecastYear],
      value,
      low: value - Z80 * sat.sd,
      high: value + Z80 * sat.sd,
      trend: predict(trend.coef, [forecastYear - CENTRE]),
    };
  }
  return {
    rows,
    n: rows.length,
    first: rows[0]?.year ?? NaN,
    last: rows[rows.length - 1]?.year ?? NaN,
    missing,
    rmseTrend: rms(eT),
    rmseSatellite: rms(eS),
    rmseLastYear: rms(lastYearErr),
    skill: skillScore(eS, eT),
    hits: rows.filter((r) => r.inRange).length,
    forecast,
  };
}

export interface PriceResult {
  skill: number;
  n: number;
  first: number;
  last: number;
  /** Root-mean-square error of the log change, "no change" baseline and signal model. */
  rmseNoChange: number;
  rmseModel: number;
}

/**
 * The same signal on the corn price: the log change from the September average to the December average
 * of the same year (the signal is known by mid-August), fitted on earlier years only (at least 10),
 * against the "no change from September" baseline. Only this result is stored; the price series is not.
 * `prices` maps "YYYY-MM" to the monthly price.
 */
export function priceTest(signal: ByYear, prices: Record<string, number>, minTrain = MIN_TRAIN_YEARS_PRICE): PriceResult {
  const years = Object.keys(signal)
    .map(Number)
    .filter((y) => Number.isFinite(prices[`${y}-09`]) && Number.isFinite(prices[`${y}-12`]))
    .sort((a, b) => a - b);
  const ret: Record<number, number> = {};
  for (const y of years) ret[y] = Math.log(prices[`${y}-12`] / prices[`${y}-09`]);
  const e0: number[] = [];
  const e1: number[] = [];
  const tested: number[] = [];
  for (const t of years) {
    const train = years.filter((y) => y < t);
    if (train.length < minTrain) continue;
    const f = fitOls(train.map((y) => [signal[y]]), train.map((y) => ret[y]));
    e0.push(ret[t]);
    e1.push(ret[t] - predict(f.coef, [signal[t]]));
    tested.push(t);
  }
  return { skill: skillScore(e1, e0), n: tested.length, first: tested[0], last: tested[tested.length - 1], rmseNoChange: rms(e0), rmseModel: rms(e1) };
}

/** The per-year signal: mean VHI over every state and week, only for years where all of them exist. */
export function yearSignal(weekly: Record<string, Record<string, number>>[], weeks: [number, number], years: [number, number]): ByYear {
  const out: ByYear = {};
  for (let y = years[0]; y <= years[1]; y++) {
    const vals: number[] = [];
    for (const st of weekly) for (let w = weeks[0]; w <= weeks[1]; w++) if (Number.isFinite(st[y]?.[w])) vals.push(st[y][w]);
    if (vals.length === weekly.length * (weeks[1] - weeks[0] + 1)) out[y] = vals.reduce((s, v) => s + v, 0) / vals.length;
  }
  return out;
}
