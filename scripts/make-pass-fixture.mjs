// Generate a pass fixture once with M5's engine from the orbit numbers in the Ypsilanti fixture.
//   node scripts/make-pass-fixture.mjs chicago   -> tests/fixtures/passes-chicago-2026-11-14.json
// Used by the trip test (A1 test i). Run once and committed; the test re-runs the engine and checks
// it still gives exactly these passes.
import { writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTs } from './load-ts.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const which = process.argv[2] ?? 'chicago';
if (which !== 'chicago') throw new Error('only "chicago" is defined');

const ypsi = JSON.parse(readFileSync(join(root, 'tests/fixtures/passes-ypsilanti-2026-11-14.json'), 'utf8'));
const { mods, close } = await loadTs(['/src/orbit/passes.ts', '/src/orbit/satellite-lite.ts', '/src/orbit/orbit.ts']);
const [passes, sat, orbit] = mods;
const cities = JSON.parse(readFileSync(join(root, 'src/data/cities.json'), 'utf8'));
const c = cities.find((x) => x.name === 'Chicago');
const satrec = sat.twoline2satrec(ypsi.tle.line1, ypsi.tle.line2);
// Same start as the Ypsilanti fixture; to the end of Thu Nov 19 in Chicago (CST, UTC-6).
const window = { startUtc: ypsi.window.startUtc, endUtc: '2026-11-20T06:00:00Z' };
const obs = orbit.observer(c.lat, c.lon, 0);
const { passes: list } = passes.findVisiblePasses(satrec, obs, new Date(window.startUtc), new Date(window.endUtc));
const out = {
  about:
    'Visible ISS passes over Chicago generated once by our own pass engine (src/orbit/passes.ts, M5) from the same orbit numbers as passes-ypsilanti-2026-11-14.json. Not a reference list: the trip test uses it to pin the engine output for the second city.',
  generatedBy: 'node scripts/make-pass-fixture.mjs chicago',
  generatedAt: new Date().toISOString(),
  observer: { name: 'Chicago, United States of America', latDeg: c.lat, lonDeg: c.lon, heightM: 0, timeZone: 'America/Chicago' },
  window,
  tle: ypsi.tle,
  passes: list.map((p) => ({
    startUtc: p.start.toISOString(),
    peakUtc: p.peak.toISOString(),
    endUtc: p.end.toISOString(),
    peakElDeg: Number(p.peakElDeg.toFixed(2)),
    startAz: passes.compass(p.startAzDeg),
  })),
};
writeFileSync(join(root, 'tests/fixtures/passes-chicago-2026-11-14.json'), `${JSON.stringify(out, null, 1)}\n`);
console.log(`saved tests/fixtures/passes-chicago-2026-11-14.json: ${out.passes.length} passes`);
for (const p of out.passes) console.log(p.startUtc, p.peakElDeg, p.startAz);
await close();
