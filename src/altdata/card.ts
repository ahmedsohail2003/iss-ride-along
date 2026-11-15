// X6 Forecast lab card, in the "What it is flying over" panel. A "Forecast lab" button opens it (the page
// never navigates); when the station's horizon footprint contains central Iowa (42.0 N, 93.5 W) a line
// next to the button says so. When it opens, the card runs the backtest (backtest.ts) on the bundled
// data and shows: two NASA greenness images (2012 drought, 2026), the 2026 harvest forecast with its
// range beside the trend line's and USDA's current estimate, the two baselines' errors, the fixed label,
// and a chart of every test year. The price appears only as the stored test result inside the label:
// the card never shows a price forecast. Every figure is filled in by code, never typed.
import data from '../data/altdata.json';
import img2012 from '../data/ndvi-cornbelt-2012.png';
import img2026 from '../data/ndvi-cornbelt-2026.png';
import { harvestBacktest, type ByYear, type HarvestResult } from './backtest';
import { greatCircleKm } from '../orbit/orbit';
import { footprintRadiusKm } from '../nasa/footprint';

export const CORN_BELT = { lat: 42.0, lon: -93.5 };
export const LABEL_START = 'Research demo, not investment advice.';
/** The price skill counts as "no measurable skill" inside this band (PLAN.md X6). */
export const NO_SKILL_BAND = 0.1;

export interface AltData {
  signal: ByYear;
  yields: ByYear;
  estimateYear: number;
  price: { skill: number; n: number; first: number; last: number; citation: string; retrieved: string; from: string };
  ndvi: Record<string, { mean: number; low: number; high: number; visible: number; matched: number }>;
  sources: { name: string; url: string; retrieved: string; from: string }[];
}

export const ALTDATA = data as unknown as AltData;

/** The harvest backtest on the bundled data: test years through the year before USDA's estimate. */
export function runHarvest(d: AltData = ALTDATA): HarvestResult {
  return harvestBacktest(d.signal, d.yields, { lastYear: d.estimateYear - 1, forecastYear: d.estimateYear });
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
/** Two decimals, and never "-0.00". */
export const fmtSkill = (x: number) => {
  const s = x.toFixed(2);
  return s === '-0.00' ? '0.00' : s;
};
const f1 = (x: number) => x.toFixed(1);
const f2 = (x: number) => x.toFixed(2);
const listYears = (ys: number[]) => (ys.length <= 1 ? ys.join('') : `${ys.slice(0, -1).join(', ')} and ${ys[ys.length - 1]}`);

/** The fixed label (PLAN.md X6 "On-screen label"), as HTML; the two skill figures sit in data-* spans. */
export function labelHtml(h: HarvestResult, price: AltData['price']): string {
  const skipped = h.missing.length ? `; ${listYears(h.missing)} skipped for a gap in the satellite record` : '';
  const yieldSkill = fmtSkill(h.skill);
  const noBetter = h.skill <= 0 ? ', no better than the trend line' : '';
  const priceSkill = fmtSkill(price.skill);
  const verdict = Math.abs(price.skill) < NO_SKILL_BAND ? ': no measurable skill' : '';
  return (
    `${LABEL_START} A retrospective test with today's data: each year's forecast used only earlier years ` +
    `(${h.n} test years, ${h.first}-${h.last}${skipped}). Harvest forecast skill against the trend line: ` +
    `<strong data-skill-yield>${yieldSkill}</strong>${noBetter} (0 = no better than the trend line, 1 = perfect). ` +
    `The same satellite signal tested on the corn price from September to December: skill ` +
    `<strong data-skill-price>${priceSkill}</strong> against &quot;no change&quot; over ${price.n} years${verdict}. ` +
    `This page shows no price forecast.`
  );
}

export const imageCaption = (day: string) =>
  `NASA MODIS on the Terra satellite, greenness index (NDVI), 250 m, 16-day composite starting ${day}. Not from the ISS, not a live camera.`;
export const SIGNAL_CAPTION =
  'NOAA STAR Vegetation Health Index: weekly, 4 km, cropland only, from the AVHRR and VIIRS satellite instruments. NOAA marks this data experimental.';
export const rangeCaption = (h: HarvestResult) =>
  `In the test, ${h.hits} of ${h.n} actual yields fell inside this range, so it is wider than it needs to be.`;

/** Step 5: actual yield, trend-only forecast and satellite forecast for every test year (inline SVG). */
export function chartSvg(h: HarvestResult): string {
  const W = 640, H = 230, L = 44, R = 20, T = 12, B = 34;
  const ys = h.rows.flatMap((r) => [r.actual, r.trend, r.satellite]);
  const lo = Math.floor(Math.min(...ys) / 20) * 20;
  const hi = Math.ceil(Math.max(...ys) / 20) * 20;
  const x = (yr: number) => L + ((yr - h.first) / (h.last - h.first)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  // A missing year breaks the line (no line is drawn across the gap).
  const path = (key: 'actual' | 'trend' | 'satellite') =>
    h.rows
      .map((r, i) => `${i === 0 || r.year - h.rows[i - 1].year > 1 ? 'M' : 'L'}${x(r.year).toFixed(1)},${y(r[key]).toFixed(1)}`)
      .join(' ');
  const yTicks: string[] = [];
  for (let v = lo; v <= hi; v += 20)
    yTicks.push(`<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="fc-gl"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`);
  const xTicks: string[] = [];
  for (let yr = Math.ceil(h.first / 5) * 5; yr <= h.last; yr += 5) xTicks.push(`<text x="${x(yr)}" y="${H - B + 16}" text-anchor="middle">${yr}</text>`);
  const r12 = h.rows.find((r) => r.year === 2012);
  const desc =
    `US corn yield, bushels per acre, ${h.first} to ${h.last}: what happened, the trend-line forecast and the satellite forecast, each made with earlier years only.` +
    (r12 ? ` In 2012 the trend line said ${f1(r12.trend)}, the satellite forecast ${f1(r12.satellite)}, and the harvest was ${f1(r12.actual)}.` : '');
  return (
    `<svg class="fc-chart" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="fc-chart-t" data-chart-years="${h.n}">` +
    `<title id="fc-chart-t">${esc(desc)}</title>` +
    yTicks.join('') +
    xTicks.join('') +
    `<text x="${L}" y="${H - 4}" class="fc-axis">bushels per acre; each point forecast with earlier years only</text>` +
    `<path d="${path('trend')}" class="fc-trend"/>` +
    `<path d="${path('satellite')}" class="fc-sat"/>` +
    `<path d="${path('actual')}" class="fc-actual"/>` +
    `</svg>` +
    `<p class="small fc-legend"><span class="fc-key fc-key-actual"></span> what happened (USDA) ` +
    `<span class="fc-key fc-key-sat"></span> satellite forecast <span class="fc-key fc-key-trend"></span> trend line</p>`
  );
}

/** The card's inside, from the bundled data and the backtest result. */
export function cardHtml(h: HarvestResult, d: AltData = ALTDATA): string {
  const fc = h.forecast;
  const est = d.yields[d.estimateYear];
  const r12 = h.rows.find((r) => r.year === 2012);
  const img = (day: string, src: string, title: string) => {
    const g = d.ndvi[day];
    const green = g
      ? `<span class="fc-green" data-ndvi="${day}">Mean greenness of its ${g.matched.toLocaleString('en-US')} pixels, read back with NASA's colour key: ${f2(g.low)} to ${f2(g.high)} (NDVI, 0 to 1).</span>`
      : '';
    return (
      `<figure class="fc-img"><img src="${src}" alt="${esc(`NASA greenness image of the corn belt (Iowa and its neighbours), ${title}`)}" width="256" height="128" data-ndvi-img="${day}"/>` +
      `<figcaption class="small"><strong>${esc(title)}</strong> ${esc(imageCaption(day))} ${green}</figcaption></figure>`
    );
  };
  const showForecast = h.skill > 0 && fc;
  const forecast = showForecast
    ? `<p class="fc-forecast" data-forecast="${f1(fc.value)}">${fc.year} harvest forecast from the satellite signal: <strong>${f1(fc.value)}</strong> bushels per acre ` +
      `(80% range ${f1(fc.low)} to ${f1(fc.high)}). Trend line alone: ${f1(fc.trend)}.` +
      (Number.isFinite(est) ? ` USDA's current estimate: ${f1(est)} (final in January).` : '') +
      `</p><p class="small">${esc(rangeCaption(h))}</p>`
    : '';
  const baselines =
    `<p class="small fc-baselines">Typical error over the ${h.n} test years (root-mean-square): trend line <strong data-err-trend>${f2(h.rmseTrend)}</strong>, ` +
    `satellite forecast <strong data-err-sat>${f2(h.rmseSatellite)}</strong> bushels per acre.` +
    (r12 ? ` In the 2012 drought the trend line said ${f1(r12.trend)}, the satellite forecast ${f1(r12.satellite)}, and the harvest was ${f1(r12.actual)}.` : '') +
    `</p>`;
  const sig = (yr: number) => (Number.isFinite(d.signal[yr]) ? f1(d.signal[yr]) : 'n/a');
  return (
    `<h3 class="fc-title">The US corn harvest, forecast from satellites and scored like a weather forecast</h3>` +
    `<div class="fc-grid">` +
    `<div class="fc-imgs">${img('2012-07-27', img2012, 'Late July 2012, a drought year')}${img('2026-07-28', img2026, 'Late July 2026')}</div>` +
    `<div class="fc-text">${forecast}${baselines}` +
    `<p class="fc-label" data-fc-label>${labelHtml(h, d.price)}</p>` +
    `<p class="small">${esc(SIGNAL_CAPTION)} The signal is its average over early July to mid-August (weeks 27-32) in Iowa, Illinois, Nebraska, Minnesota and Indiana: ` +
    `${sig(2012)} in 2012 and ${sig(d.estimateYear)} in ${d.estimateYear} (0 to 100, low = stressed crops).</p>` +
    `</div></div>` +
    chartSvg(h)
  );
}

export const forecastLabHtml = `
    <div class="card fc-card-wrap" id="forecast-lab">
      <h2>Forecast lab <span class="small">(research demo)</span></h2>
      <p class="small" id="forecast-belt">Can free satellite data forecast a harvest? Can it forecast a price?</p>
      <button type="button" id="forecast-open" aria-expanded="false" aria-controls="forecast-card">Forecast lab</button>
      <section id="forecast-card" class="fc-card" hidden aria-label="Forecast lab"></section>
    </div>`;

/** True when the station's horizon footprint contains central Iowa. */
export function cornBeltInView(lat: number, lon: number, altKm: number): boolean {
  return greatCircleKm(lat, lon, CORN_BELT.lat, CORN_BELT.lon) <= footprintRadiusKm(altKm);
}

export interface ForecastLab {
  /** Called with the station's position; updates the "in view" line. */
  update(lat: number, lon: number, altKm: number): void;
}

export function initForecastLab(): ForecastLab {
  const btn = document.getElementById('forecast-open') as HTMLButtonElement;
  const card = document.getElementById('forecast-card')!;
  const belt = document.getElementById('forecast-belt')!;
  let drawn = false;
  btn.addEventListener('click', () => {
    if (!drawn) {
      card.innerHTML = cardHtml(runHarvest());
      drawn = true;
    }
    card.hidden = !card.hidden;
    btn.setAttribute('aria-expanded', String(!card.hidden));
    btn.textContent = card.hidden ? 'Forecast lab' : 'Close the Forecast lab';
  });
  let last: boolean | null = null;
  return {
    update(lat, lon, altKm) {
      const inView = cornBeltInView(lat, lon, altKm);
      if (inView === last) return;
      last = inView;
      document.body.dataset.cornBelt = String(inView);
      belt.textContent = inView
        ? 'The station can see central Iowa, the middle of the US corn belt, right now. Can free satellite data forecast its harvest? Can it forecast a price?'
        : 'Can free satellite data forecast a harvest? Can it forecast a price? (This line lights up when the station can see central Iowa.)';
      belt.classList.toggle('fc-belt-on', inView);
    },
  };
}
