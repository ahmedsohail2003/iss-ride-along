// X6 Forecast lab data. Downloads the free satellite and harvest data the card uses and writes
// src/data/altdata.json plus two NASA images; with --check it only reads what is bundled and prints one line.
//
//   node scripts/fetch-altdata.mjs           download (Node fetch, no browser user agent), compute, write
//   node scripts/fetch-altdata.mjs --check   ALTDATA OK years=.. missing=.. vhi2012=.. vhi2026=.. price_skill=.. n_price=..
//
// Sources (each falls back to the copy downloaded for the research at 3:29 PM Sat Nov 14, in
// ../.autopilot/research/altdata-free-data/raw/, when its request fails; the JSON records which was used):
//   NOAA STAR Vegetation Health (VHI), weekly by state, cropland only: Iowa 16, Illinois 14, Nebraska 28,
//     Minnesota 24, Indiana 15. The signal for a year = mean VHI over weeks 27-32 across the five states.
//   USDA ERS feed grains yearbook (CSV, 18.9 MB): "Yield per harvested acre", Corn, United States, Annual.
//   NASA GIBS: MODIS Terra NDVI 16-day images of 40.3-43.6 N, 96.7-90.1 W for 2012-07-27 and 2026-07-28,
//     and the MODIS_L3_NDVI colour key (to turn the colours back into greenness values).
//   FRED PMAIZMTUSDM (IMF world corn price, monthly). Copyrighted by the IMF: it is downloaded to the
//     git-ignored .altdata-cache/ folder, used for the September-to-December test, and ONLY the result
//     (skill, years, errors, date, citation) goes into altdata.json. The series is never bundled.
//
// If a fresh download moves a harvest or price number outside the tolerance PLAN.md X6 gives for it, the
// research copy is used for everything and the differences are printed (the tolerance is not loosened).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, meanGreenness, parseColourKey } from './ndvi-decode.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const at = (p) => resolve(root, p);
const OUT = at('src/data/altdata.json');
const IMG = { '2012-07-27': 'src/data/ndvi-cornbelt-2012.png', '2026-07-28': 'src/data/ndvi-cornbelt-2026.png' };
const KEY_FILE = 'src/data/gibs-ndvi-colormap.xml';

// ---------------------------------------------------------------- --check: read the bundled files only
if (process.argv.includes('--check')) {
  const problems = [];
  let d;
  try {
    d = JSON.parse(readFileSync(OUT, 'utf8'));
  } catch (e) {
    console.log(`ALTDATA FAIL cannot read src/data/altdata.json (${e.message})`);
    process.exit(1);
  }
  const years = Object.keys(d.signal).map(Number);
  const first = Math.min(...years), last = Math.max(...years);
  const missing = [];
  for (let y = first; y <= last; y++) if (!Number.isFinite(d.signal[y])) missing.push(y);
  for (const [day, f] of Object.entries(IMG)) {
    const b = existsSync(at(f)) ? readFileSync(at(f)) : null;
    if (!b || b.readUInt32BE(0) !== 0x89504e47) problems.push(`image ${f} missing or not a PNG`);
    else if (!d.ndvi?.[day]) problems.push(`no greenness value for ${day}`);
  }
  if (!existsSync(at(KEY_FILE))) problems.push(`${KEY_FILE} missing`);
  if (!d.price || !Number.isFinite(d.price.skill) || !Number.isInteger(d.price.n)) problems.push('no stored price result');
  if (JSON.stringify(d).match(/"(19|20)\d\d-(0[1-9]|1[0-2])"\s*:\s*\d/)) problems.push('a monthly price series is in altdata.json');
  if (problems.length) {
    console.log(`ALTDATA FAIL ${problems.join('; ')}`);
    process.exit(1);
  }
  console.log(
    `ALTDATA OK years=${years.length} missing=${missing.join(',') || 'none'} vhi2012=${d.signal[2012].toFixed(1)} ` +
      `vhi2026=${d.signal[2026].toFixed(1)} price_skill=${d.price.skill.toFixed(2)} n_price=${d.price.n}`,
  );
  process.exit(0);
}

// ---------------------------------------------------------------- download
const RAW = resolve(root, '../.autopilot/research/altdata-free-data/raw');
const RESEARCH_AT = '2026-11-14T15:29:00-05:00';
const CACHE = at('.altdata-cache');
const STATES = { 16: 'Iowa', 14: 'Illinois', 28: 'Nebraska', 24: 'Minnesota', 15: 'Indiana' };
const WEEKS = [27, 32];
const vhiUrl = (id) => `https://www.star.nesdis.noaa.gov/smcd/emb/vci/VH/get_TS_admin.php?country=USA&provinceID=${id}&year1=1982&year2=2026&type=Mean`;
const ERS_URL = 'https://www.ers.usda.gov/media/5766/feed-grains-yearbook-tables-all-years.csv?v=77954';
const gibsUrl = (day) =>
  `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=MODIS_Terra_L3_NDVI_16Day&CRS=EPSG:4326&BBOX=40.3,-96.7,43.6,-90.1&WIDTH=256&HEIGHT=128&FORMAT=image/png&TIME=${day}`;
const KEY_URL = 'https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_L3_NDVI.xml';
const PRICE_SERIES = 'PMAIZMTUSDM';
const PRICE_URL = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${PRICE_SERIES}`;
const RAW_FILE = {
  ers: 'ers_csv.b',
  key: 'gibs_cmap.b',
  price: 'fred_corn.b',
  '2012-07-27': 'gibs_ndvi_wms.b',
  '2026-07-28': 'gibs_ndvi_wms2026.b',
};

/** One GET with a time limit; returns the body as a Buffer, or null (with the reason) on any failure. */
async function get(url, ms) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  const t0 = Date.now();
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) return { buf: null, why: `HTTP ${r.status}` };
    const buf = Buffer.from(await r.arrayBuffer());
    return { buf, why: null, ms: Date.now() - t0 };
  } catch (e) {
    return { buf: null, why: e.name === 'AbortError' ? `no answer in ${ms / 1000} s` : e.message };
  } finally {
    clearTimeout(timer);
  }
}

const sources = [];
async function source(name, url, rawName, ms, validate) {
  const live = await get(url, ms);
  const ok = live.buf && (!validate || validate(live.buf));
  if (ok) {
    sources.push({ name, url, retrieved: new Date().toISOString(), from: 'live' });
    console.log(`  live   ${name}: ${live.buf.length} bytes in ${live.ms} ms`);
    return { live: live.buf, research: readFileSync(join(RAW, rawName)) };
  }
  const buf = readFileSync(join(RAW, rawName));
  sources.push({ name, url, retrieved: RESEARCH_AT, from: 'research copy (live request failed)' });
  console.log(`  copy   ${name}: live request failed (${live.why ?? 'bad content'}); research copy from 3:29 PM Sat used`);
  return { live: null, research: buf };
}

function parseVhi(text) {
  const d = {};
  for (const line of text.split('\n')) {
    const p = line.replace('<tt><pre>', '').split(',').map((s) => s.trim());
    if (p.length < 7 || !/^\d{4}$/.test(p[0])) continue;
    const v = Number(p[6]);
    if (!Number.isFinite(v) || v < 0) continue; // NOAA writes -1 for weeks not yet observed
    (d[p[0]] ??= {})[Number(p[1])] = v;
  }
  return d;
}

function csvLine(line) {
  const out = [];
  let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') (cur += '"'), i++;
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') out.push(cur), (cur = '');
    else cur += c;
  }
  out.push(cur.replace(/\r$/, ''));
  return out;
}

function parseErs(text) {
  const lines = text.replace(/^﻿/, '').split('\n');
  const head = csvLine(lines[0]);
  const ix = (n) => head.indexOf(n);
  const [c, a, g, y, f, v] = ['commodity', 'attribute', 'geography', 'year', 'frequency', 'amount'].map(ix);
  const out = {};
  for (const l of lines.slice(1)) {
    if (!l.includes('Yield per harvested acre')) continue;
    const r = csvLine(l);
    if (r[c] === 'Corn' && r[a] === 'Yield per harvested acre' && r[g] === 'United States' && r[f] === 'Annual') out[r[y]] = Number(r[v]);
  }
  return out;
}

function parsePrice(text) {
  const out = {};
  for (const l of text.split('\n')) {
    const [d, v] = l.split(',');
    if (/^\d{4}-\d{2}/.test(d) && Number.isFinite(Number(v)) && v.trim() !== '') out[d.slice(0, 7)] = Number(v);
  }
  return out;
}

const isPng = (b) => b.length > 8 && b.readUInt32BE(0) === 0x89504e47;

console.log('X6 fetch-altdata: downloading');
const vhi = {};
for (const id of Object.keys(STATES)) vhi[id] = await source(`NOAA STAR VHI, ${STATES[id]} (provinceID ${id})`, vhiUrl(id), `vhp_${id}.b`, 60_000, (b) => /Province= ?\d+/.test(b.toString('latin1', 0, 400)));
const ers = await source('USDA ERS feed grains yearbook, US corn yield', ERS_URL, RAW_FILE.ers, 90_000, (b) => b.toString('latin1', 0, 300).includes('commodity'));
const imgs = {};
for (const day of Object.keys(IMG)) imgs[day] = await source(`NASA GIBS MODIS Terra NDVI 16-day, corn belt, ${day}`, gibsUrl(day), RAW_FILE[day], 30_000, isPng);
const key = await source('NASA GIBS colour key MODIS_L3_NDVI', KEY_URL, RAW_FILE.key, 30_000, (b) => b.toString('latin1').includes('<ColorMapEntry'));
const price = await source(`FRED ${PRICE_SERIES} (IMF world corn price; result only)`, PRICE_URL, RAW_FILE.price, 30_000, (b) => b.toString('latin1', 0, 100).includes(PRICE_SERIES));
if (price.live) {
  mkdirSync(CACHE, { recursive: true });
  writeFileSync(join(CACHE, `${PRICE_SERIES}.csv`), price.live); // git-ignored; never bundled
}

// ---------------------------------------------------------------- compute (the page's own code)
const { loadTs } = await import('./load-ts.mjs');
const ts = await loadTs(['/src/altdata/backtest.ts']);
const B = ts.mods[0];
const build = (pick) => {
  const weekly = Object.keys(STATES).map((id) => parseVhi(pick(vhi[id]).toString('utf8')));
  const signal = B.yearSignal(weekly, WEEKS, [1982, 2026]);
  const allYields = parseErs(pick(ers).toString('utf8'));
  const yields = Object.fromEntries(Object.entries(allYields).filter(([y]) => Number(y) >= 1982));
  const harvest = B.harvestBacktest(signal, yields, { lastYear: 2025, forecastYear: 2026 });
  const prices = parsePrice(pick(price).toString('utf8'));
  return { signal, yields, harvest, price: B.priceTest(signal, prices) };
};
const research = build((s) => s.research);
const fresh = build((s) => s.live ?? s.research);
await ts.close();

// Tolerances from PLAN.md X6 acceptance (measured twice on the research copy).
const row2012 = (r) => r.harvest.rows.find((x) => x.year === 2012);
const TOL = [
  ['harvest skill', (r) => r.harvest.skill, 0.005],
  ['test years', (r) => r.harvest.n, 0],
  ['first test year', (r) => r.harvest.first, 0],
  ['trend-line error', (r) => r.harvest.rmseTrend, 0.05],
  ['satellite error', (r) => r.harvest.rmseSatellite, 0.05],
  ['2012 trend', (r) => row2012(r).trend, 0.2],
  ['2012 satellite', (r) => row2012(r).satellite, 0.2],
  ['2012 actual', (r) => row2012(r).actual, 0.05],
  ['inside the 80% range', (r) => r.harvest.hits, 0],
  ['2026 forecast', (r) => r.harvest.forecast.value, 0.3],
  ['price skill', (r) => r.price.skill, 0.06],
  ['price test years', (r) => r.price.n, 0],
];
const diffs = TOL.filter(([, f, tol]) => !(Math.abs(f(fresh) - f(research)) <= tol + 1e-9)).map(
  ([name, f, tol]) => `${name}: fresh ${f(fresh).toFixed(3)}, research copy ${f(research).toFixed(3)} (tolerance ${tol})`,
);
let use = fresh;
if (diffs.length) {
  use = research;
  for (const s of sources) if (s.from === 'live') (s.from = 'research copy (fresh download moved a number outside its tolerance)'), (s.retrieved = RESEARCH_AT);
  console.log(`  FRESH DATA OUTSIDE TOLERANCE: the 3:29 PM research copy is used.\n    ${diffs.join('\n    ')}`);
} else console.log('  fresh numbers within tolerance of the research copy');
const pickUsed = (s) => (use === fresh ? s.live ?? s.research : s.research);

// ---------------------------------------------------------------- images and greenness (step 6)
const keyXml = pickUsed(key).toString('utf8');
writeFileSync(at(KEY_FILE), keyXml);
const colourKey = parseColourKey(keyXml);
const ndvi = {};
for (const [day, f] of Object.entries(IMG)) {
  const b = pickUsed(imgs[day]);
  writeFileSync(at(f), b);
  const g = meanGreenness(decodePng(b), colourKey);
  ndvi[day] = { file: f, ...g };
}

const priceSource = sources.find((s) => s.name.startsWith('FRED'));
const retrievedDay = new Date(priceSource.retrieved).toLocaleDateString('en-CA', { timeZone: 'America/Detroit' });
const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d;
const json = {
  about:
    'X6 Forecast lab data, written by scripts/fetch-altdata.mjs. signal = mean NOAA STAR Vegetation Health Index (0-100) over weeks 27-32 across Iowa, Illinois, Nebraska, Minnesota and Indiana, cropland only (a year is left out when any of those 30 weekly values is missing). yields = US corn, bushels per harvested acre, USDA ERS (the newest year is USDA\'s current estimate, final in January). price = the result of the September-to-December corn price test only; the IMF price series is not included.',
  weeks: WEEKS,
  states: STATES,
  signal: Object.fromEntries(Object.entries(use.signal).map(([y, v]) => [y, round(v, 4)])),
  yields: use.yields,
  estimateYear: 2026,
  price: {
    skill: round(use.price.skill, 4),
    n: use.price.n,
    first: use.price.first,
    last: use.price.last,
    rmseNoChange: round(use.price.rmseNoChange, 4),
    rmseModel: round(use.price.rmseModel, 4),
    test: 'log change from the September average to the December average of the same year, fitted on at least 10 earlier years, against "no change from September"',
    series: PRICE_SERIES,
    retrieved: priceSource.retrieved,
    from: priceSource.from,
    citation: `International Monetary Fund, Global price of Corn [${PRICE_SERIES}], retrieved from FRED, Federal Reserve Bank of St. Louis; https://fred.stlouisfed.org/series/${PRICE_SERIES}, ${retrievedDay}. Copyright International Monetary Fund, reprinted with permission; only this computed result is included, not the series.`,
  },
  ndvi: Object.fromEntries(Object.entries(ndvi).map(([d, v]) => [d, { ...v, low: round(v.low, 4), high: round(v.high, 4), mean: round(v.mean, 4) }])),
  sources,
  generatedAt: new Date().toISOString(),
};
writeFileSync(OUT, `${JSON.stringify(json, null, 2)}\n`);
const h = use.harvest;
console.log(
  `wrote src/data/altdata.json: ${Object.keys(json.signal).length} signal years, skill ${h.skill.toFixed(3)} over ${h.n} test years (${h.first}-${h.last}), ` +
    `errors ${h.rmseTrend.toFixed(2)} / ${h.rmseSatellite.toFixed(2)}, 2026 forecast ${h.forecast.value.toFixed(1)}, price skill ${use.price.skill.toFixed(3)} over ${use.price.n} years; ` +
    `greenness 2012 ${ndvi['2012-07-27'].mean.toFixed(3)}, 2026 ${ndvi['2026-07-28'].mean.toFixed(3)}`,
);
