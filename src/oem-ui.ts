// C1 panel: "Our math vs NASA's own trajectory". Live in the browser: SGP4 on the orbit numbers the
// page is using, converted TEME -> J2000, against NASA's predicted position at the latest row time of
// the built-in trajectory file (src/data/iss-oem.json, saved by `node scripts/snapshot.mjs --only oem`;
// NASA's file sends no CORS header, so the page cannot fetch it live). Under it: the measured gap for
// the same age from scripts/check-oem.mjs (src/data/oem-agreement.json) and a small chart of the gap
// over the next 3 days. We say "apart", never "accurate to": NASA's file is also a prediction.
import type { SatRec } from 'satellite.js';
import oemData from './data/iss-oem.json';
import { agreement, measuredAtAge, measuredLine } from './orbit/oemAgreement';
import { epochMs, gapAt, latestRowAtOrBefore, nearestRow, type OemPoint } from './orbit/oemCompare';

const ROWS: OemPoint[] = (oemData.rows as number[][]).map(([t, x, y, z]) => ({ t, x, y, z }));

// M7: the gap and its measured value sit in the first screen's "How accurate is this?" card
// (oemPanelHtml); the chart, the growth and height lines go in the accuracy tab (oemDetailsHtml).
export const oemPanelHtml = `
  <section id="oem-panel" class="oem" aria-labelledby="oem-h">
    <h3 id="oem-h">Our math vs NASA's own trajectory</h3>
    <p id="oem-gap" class="oem-gap" aria-live="polite">-</p>
    <p id="oem-measured" class="small"></p>
  </section>`;

export const oemDetailsHtml = `
  <section class="oem-details" aria-label="How the gap to NASA's trajectory grows">
    <h3>Our math vs NASA's own trajectory, over the next 3 days</h3>
    <svg id="oem-chart" class="oem-chart" viewBox="0 0 300 90" role="img" aria-label="Gap between our position and NASA's over the next 3 days"></svg>
    <p id="oem-growth" class="small"></p>
    <p id="oem-height" class="small"></p>
    <p class="small">NASA's file is a prediction from mission control's own orbit model, not a measurement,
      so this shows how far apart two predictions are. The other check, "Check against reference", compares with an
      independent tracker that uses the same kind of public orbit numbers (the button on the first screen).</p>
  </section>`;

const $ = (id: string) => document.getElementById(id)!;
const utc = (t: number) => `${new Date(t).toISOString().slice(11, 16)} UTC`;
const utcDay = (t: number) => `${new Date(t).toISOString().slice(0, 10)} ${utc(t)}`;

function growthLine(): string {
  const pick = [12, 36, 72, 120].map((h) => measuredAtAge(h)).filter((m): m is { hours: number; km: number } => !!m);
  const parts = pick.map((m) => `${m.km.toFixed(1)} km at ${Math.round(m.hours)} h`);
  return `How the gap grows as orbit numbers age (measured on one set of orbit numbers, ${agreement.measuredOn}): ${parts.join(', ')}. ` +
    `Without the frame conversion it would be ${agreement.noConversionWithin12h.minKm.toFixed(0)} to ${agreement.noConversionWithin12h.maxKm.toFixed(0)} km even within 12 h.`;
}

/** Step 6: NASA's predicted lowest height per day, first and last whole day in its file. */
function heightLine(): string {
  const d = (agreement.nasaLowestHeightByDay ?? []) as [string, number][];
  if (d.length < 2) return '';
  const [a, b] = [d[0], d[d.length - 1]];
  const lo = Math.min(...d.map((x) => x[1]));
  const hi = Math.max(...d.map((x) => x[1]));
  return `NASA's own prediction of the station's lowest height each day, ${a[0]} to ${b[0]}: between ${lo.toFixed(1)} and ${hi.toFixed(1)} km ` +
    `(${a[1].toFixed(1)} km on the first day, ${b[1].toFixed(1)} km on the last; above the WGS-84 ellipsoid, lowest of NASA's 4-minute rows).`;
}

function drawChart(satrec: SatRec, fromT: number) {
  const epoch = epochMs(satrec);
  const pts: { h: number; km: number }[] = [];
  const end = fromT + 72 * 3_600_000;
  for (let t = fromT; t <= end; t += 3_600_000) {
    const row = nearestRow(ROWS, t);
    if (Math.abs(row.t - t) > 10 * 60_000) continue; // past the end of the built-in rows
    const g = gapAt(satrec, row, true, epoch);
    if (g) pts.push({ h: (row.t - fromT) / 3_600_000, km: g.gapKm });
  }
  const svg = $('oem-chart');
  if (pts.length < 2) {
    svg.innerHTML = '';
    return;
  }
  const maxKm = Math.max(1, ...pts.map((p) => p.km));
  const W = 300, H = 90, L = 34, B = 18, T = 8;
  const x = (h: number) => L + (h / 72) * (W - L - 6);
  const y = (km: number) => T + (1 - km / maxKm) * (H - T - B);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.h).toFixed(1)},${y(p.km).toFixed(1)}`).join(' ');
  svg.innerHTML = `
    <line x1="${L}" y1="${y(0)}" x2="${W - 6}" y2="${y(0)}" class="axis"/>
    <line x1="${L}" y1="${T}" x2="${L}" y2="${y(0)}" class="axis"/>
    <text x="${L - 4}" y="${T + 8}" text-anchor="end">${maxKm.toFixed(1)} km</text>
    <text x="${L - 4}" y="${y(0)}" text-anchor="end">0</text>
    <text x="${L}" y="${H - 4}">now</text>
    <text x="${x(36)}" y="${H - 4}" text-anchor="middle">+36 h</text>
    <text x="${W - 6}" y="${H - 4}" text-anchor="end">+72 h</text>
    <path d="${path}" class="line"/>`;
  svg.dataset.points = String(pts.length);
}

export function initOemPanel(getSatrec: () => SatRec) {
  let chartFor: { satrec: SatRec; row: number } | null = null;
  const render = () => {
    const satrec = getSatrec();
    const now = Date.now();
    const row = latestRowAtOrBefore(ROWS, now);
    const el = $('oem-gap');
    if (!row) {
      el.textContent = `NASA's trajectory built into this page covers ${utcDay(ROWS[0].t)} to ${utcDay(ROWS[ROWS.length - 1].t)}; it does not cover now, so there is no comparison. (Refresh it with npm run snapshot -- --only oem.)`;
      delete el.dataset.gapKm;
      return;
    }
    const epoch = epochMs(satrec);
    const g = gapAt(satrec, row, true, epoch);
    if (!g) return;
    const ageH = (row.t - epoch) / 3_600_000;
    el.dataset.gapKm = g.gapKm.toFixed(3);
    el.dataset.rowTime = new Date(row.t).toISOString();
    el.dataset.epoch = new Date(epoch).toISOString();
    el.dataset.ageH = ageH.toFixed(2);
    el.innerHTML =
      `At ${utc(row.t)}, our position and NASA's are <strong id="oem-km">${g.gapKm.toFixed(1)} km</strong> apart ` +
      `<span class="small">(orbit numbers ${ageH.toFixed(1)} h old at that time; NASA's rows are 4 minutes apart, so this is the latest row, not interpolated)</span>`;
    const m = measuredLine(ageH);
    $('oem-measured').textContent = m ? `${m[0].toUpperCase()}${m.slice(1)}.` : 'No measured value for this age in the saved table.';
    if (!chartFor || chartFor.satrec !== satrec || chartFor.row !== row.t) {
      drawChart(satrec, row.t);
      chartFor = { satrec, row: row.t };
    }
  };
  $('oem-growth').textContent = growthLine();
  $('oem-height').textContent = heightLine();
  render();
  setInterval(render, 30_000);
  return { refresh: render };
}
