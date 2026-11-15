// C1: how far apart our orbit math and NASA's own ISS trajectory are, by the age of the orbit numbers.
//
//   node scripts/check-oem.mjs
//
// Uses the saved fixture pair (tests/fixtures/ISS.OEM_J2K_EPH.txt + oem-tle.txt) and the page's own
// code (src/orbit/*.ts, loaded through Vite; no second copy of the math). Prints to stdout:
//   five lines "hours, gap_km" at 0, 12, 24, 36 and 72 h from the orbit numbers' epoch (the NASA row
//   nearest each; its own hours are printed), then one line with the minimum, median and maximum gap
//   with the TEME -> J2000 conversion switched off, over every row within 12 h of the epoch.
// Writes src/data/oem-agreement.json (the page's "measured at this age" line and chart). Exit 0 when
// every number was computed; 1 otherwise.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTs } from './load-ts.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fx = (n) => readFileSync(join(root, 'tests', 'fixtures', n), 'utf8');

const { mods, close } = await loadTs(['/src/orbit/oem.ts', '/src/orbit/oemCompare.ts', '/src/orbit/orbit.ts', '/src/orbit/satellite-lite.ts']);
const [{ parseOem }, cmp, { satrecFromTle }, sat] = mods;
let ok = true;
try {
  const oem = parseOem(fx('ISS.OEM_J2K_EPH.txt'));
  const satrec = satrecFromTle(fx('oem-tle.txt'));
  const epoch = cmp.epochMs(satrec);
  const fixtureMeta = JSON.parse(fx('oem-fixture-meta.json'));

  const out = [];
  for (const h of [0, 12, 24, 36, 72]) {
    const row = cmp.nearestRow(oem.rows, epoch + h * 3_600_000);
    const g = cmp.gapAt(satrec, row, true, epoch);
    if (!g || !Number.isFinite(g.gapKm)) ok = false;
    else out.push(`${g.hoursFromEpoch.toFixed(2)}, ${g.gapKm.toFixed(3)}`);
  }
  const raw = cmp.gapsBetween(satrec, oem.rows, -12, 12, false).map((g) => g.gapKm);
  if (raw.length === 0) ok = false;
  const noConv = { rows: raw.length, minKm: Math.min(...raw), medianKm: cmp.median(raw), maxKm: Math.max(...raw) };
  out.push(`no conversion, ${noConv.rows} rows within 12 h: min ${noConv.minKm.toFixed(2)} km, median ${noConv.medianKm.toFixed(2)} km, max ${noConv.maxKm.toFixed(2)} km`);
  console.log(out.join('\n'));

  // The measured gap by age: every row from 12 h before the epoch to the end of the file, kept once per
  // hour (the row nearest each whole hour), for the page's "measured at this age" line and chart.
  const all = cmp.gapsBetween(satrec, oem.rows, -12, 1e6, true);
  const byHour = new Map();
  for (const g of all) {
    const k = Math.round(g.hoursFromEpoch);
    const prev = byHour.get(k);
    if (!prev || Math.abs(g.hoursFromEpoch - k) < Math.abs(prev.hoursFromEpoch - k)) byHour.set(k, g);
  }
  const byAge = [...byHour.values()].sort((a, b) => a.t - b.t).map((g) => [Number(g.hoursFromEpoch.toFixed(2)), Number(g.gapKm.toFixed(3))]);
  const within12 = cmp.gapsBetween(satrec, oem.rows, -12, 12, true).map((g) => g.gapKm);
  const agreement = {
    about:
      "Distance (km) between our SGP4 position converted to J2000 and NASA's predicted position, at NASA's own row times, by hours from the orbit numbers' epoch. Measured on one set of orbit numbers. Both are predictions.",
    generatedBy: 'scripts/check-oem.mjs',
    measuredOn: fixtureMeta.oem.retrievedAt.slice(0, 10),
    orbitNumbersEpoch: new Date(epoch).toISOString(),
    oem: { CREATION_DATE: oem.CREATION_DATE, ORIGINATOR: oem.ORIGINATOR, REF_FRAME: oem.REF_FRAME, rows: oem.rowCount, source: fixtureMeta.oem.source },
    within12h: { rows: within12.length, maxKm: Number(Math.max(...within12).toFixed(3)), medianKm: Number(cmp.median(within12).toFixed(3)) },
    noConversionWithin12h: { rows: noConv.rows, minKm: Number(noConv.minKm.toFixed(2)), medianKm: Number(noConv.medianKm.toFixed(2)), maxKm: Number(noConv.maxKm.toFixed(2)) },
    byAge,
  };
  if (byAge.some(([, km]) => !Number.isFinite(km))) ok = false;
  // Step 6: NASA's own predicted height, the lowest of its 4-minute rows on each whole UTC day in the file.
  // Geodetic height (WGS-84 ellipsoid, satellite.js eciToGeodetic); the height does not depend on the
  // longitude, so the Earth-rotation angle is set to 0, and the J2000 vs true-of-date pole (0.37 degree)
  // changes it by metres at most.
  const byDay = new Map();
  for (const r of oem.rows) {
    const day = new Date(r.t).toISOString().slice(0, 10);
    const hKm = sat.eciToGeodetic({ x: r.x, y: r.y, z: r.z }, 0).height;
    const d = byDay.get(day) ?? { day, minKm: Infinity, first: r.t, last: r.t };
    d.minKm = Math.min(d.minKm, hKm);
    d.last = r.t;
    byDay.set(day, d);
  }
  const fullDays = [...byDay.values()].filter((d) => d.last - d.first >= 23.9 * 3_600_000);
  agreement.nasaLowestHeightByDay = fullDays.map((d) => [d.day, Number(d.minKm.toFixed(1))]);
  if (fullDays.length === 0 || fullDays.some((d) => !Number.isFinite(d.minKm))) ok = false;
  writeFileSync(join(root, 'src', 'data', 'oem-agreement.json'), JSON.stringify(agreement) + '\n');
  console.error(`wrote src/data/oem-agreement.json (${byAge.length} hourly points, ${byAge[0][0]} to ${byAge[byAge.length - 1][0]} h)`);
} catch (e) {
  ok = false;
  console.error(`check-oem: ${e.message}`);
} finally {
  await close();
}
process.exit(ok ? 0 : 1);
