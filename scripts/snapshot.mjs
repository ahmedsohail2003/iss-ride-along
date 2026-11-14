// Saves the data the page embeds for offline use into src/data/, each with its source URL and
// retrieval time (src/data/snapshot-meta.json). Run: node scripts/snapshot.mjs
// Courtesy rules: one request per source per run, no retries (CelesTrak blocks repeated
// downloads and says a 403/404 "is not going to change by repeating the request").
// Option: --orbit-from <dir>  if CelesTrak cannot be reached, use iss.tle and iss.omm.json saved
// in <dir> by an earlier CelesTrak fetch (their file times are recorded as the retrieval time).
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'src', 'data');
mkdirSync(dataDir, { recursive: true });

const NORAD_ID = 25544;
const SOURCES = {
  celestrakTle: `https://celestrak.org/NORAD/elements/gp.php?CATNR=${NORAD_ID}&FORMAT=TLE`,
  celestrakOmm: `https://celestrak.org/NORAD/elements/gp.php?CATNR=${NORAD_ID}&FORMAT=JSON`,
  wheretheissTle: `https://api.wheretheiss.at/v1/satellites/${NORAD_ID}/tles`,
  wheretheissPositions: `https://api.wheretheiss.at/v1/satellites/${NORAD_ID}/positions`,
  blueMarbleZ0:
    'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/0/0/0.jpeg',
  naturalEarthPlaces:
    'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_populated_places_simple.geojson',
};
const CITY_COUNT = 150;
const SAMPLE_COUNT = 10; // wheretheiss.at allows up to 10 timestamps per /positions call
const SAMPLE_SPACING_S = 600; // 10 samples, 10 minutes apart, span 90 minutes (about one orbit)

const meta = { generatedBy: 'scripts/snapshot.mjs', files: {} };

const argv = process.argv.slice(2);
const orbitFrom = argv.includes('--orbit-from') ? resolve(argv[argv.indexOf('--orbit-from') + 1]) : null;

async function get(url) {
  const t0 = Date.now();
  const res = await fetch(url, {
    headers: { 'User-Agent': 'iss-ride-along-snapshot (hackathon project)' },
    signal: AbortSignal.timeout(30000),
  });
  const ms = Date.now() - t0;
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status} (not retried)`);
  console.log(`200 ${ms} ms ${url}`);
  return res;
}

function save(name, content, url, extra = {}) {
  writeFileSync(join(dataDir, name), content);
  meta.files[name] = { source: url, retrievedAt: new Date().toISOString(), ...extra };
  const bytes = typeof content === 'string' ? Buffer.byteLength(content) : content.length;
  console.log(`  saved src/data/${name} (${bytes} bytes)`);
}

function tleEpochIso(line1) {
  const yy = Number(line1.slice(18, 20));
  const doy = Number(line1.slice(20, 32));
  const year = yy < 57 ? 2000 + yy : 1900 + yy;
  return new Date(Date.UTC(year, 0, 1) + (doy - 1) * 86400000).toISOString();
}

// 1. CelesTrak TLE and OMM (US Space Force data, distributed by CelesTrak; not NASA)
function checkTle(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2 || !lines.at(-2).startsWith('1 ')) throw new Error('unexpected TLE format');
  return lines.at(-2);
}
function checkOmm(omm) {
  if (!Array.isArray(omm) || omm[0]?.NORAD_CAT_ID !== NORAD_ID) throw new Error('unexpected OMM payload');
  return omm;
}
try {
  const tleText = (await (await get(SOURCES.celestrakTle)).text()).trim() + '\n';
  save('iss.tle', tleText, SOURCES.celestrakTle, { tleEpoch: tleEpochIso(checkTle(tleText)) });
  const omm = checkOmm(await (await get(SOURCES.celestrakOmm)).json());
  save('iss.omm.json', JSON.stringify(omm, null, 2) + '\n', SOURCES.celestrakOmm, { epoch: omm[0].EPOCH });
} catch (err) {
  const reason = err.cause?.code ?? err.message;
  console.log(`CelesTrak not reachable (${reason}); not retried`);
  if (!orbitFrom) throw err;
  const tlePath = join(orbitFrom, 'iss.tle');
  const ommPath = join(orbitFrom, 'iss.omm.json');
  const tleText = readFileSync(tlePath, 'utf8').trim() + '\n';
  const omm = checkOmm(JSON.parse(readFileSync(ommPath, 'utf8')));
  const via = (p) => ({
    retrievedAt: statSync(p).mtime.toISOString(),
    via: `earlier CelesTrak fetch saved as ${basename(dirname(p))}/${basename(p)}; live fetch at snapshot time failed (${reason})`,
  });
  save('iss.tle', tleText, SOURCES.celestrakTle, { tleEpoch: tleEpochIso(checkTle(tleText)), ...via(tlePath) });
  save('iss.omm.json', JSON.stringify(omm, null, 2) + '\n', SOURCES.celestrakOmm, { epoch: omm[0].EPOCH, ...via(ommPath) });
}

// 2. wheretheiss.at reference samples plus the TLE it used (an independent implementation of the
//    same public orbit data; a check of our math, not a measurement of the station)
const wtiTle = await (await get(SOURCES.wheretheissTle)).json();
const now = Math.floor(Date.now() / 1000);
const timestamps = Array.from({ length: SAMPLE_COUNT }, (_, i) => now + (i - SAMPLE_COUNT / 2) * SAMPLE_SPACING_S);
const posUrl = `${SOURCES.wheretheissPositions}?timestamps=${timestamps.join(',')}&units=kilometers`;
const samples = await (await get(posUrl)).json();
if (!Array.isArray(samples) || samples.length !== SAMPLE_COUNT) throw new Error(`expected ${SAMPLE_COUNT} samples`);
const wti = {
  note: 'Reference positions from wheretheiss.at (not NASA). altitude km, velocity km/h, timestamp unix s.',
  tle: { header: wtiTle.header, line1: wtiTle.line1, line2: wtiTle.line2, tle_timestamp: wtiTle.tle_timestamp },
  samples: samples.map((s) => ({
    timestamp: s.timestamp,
    latitude: s.latitude,
    longitude: s.longitude,
    altitude: s.altitude,
    velocity: s.velocity,
    visibility: s.visibility,
    footprint: s.footprint,
  })),
};
save('wheretheiss-samples.json', JSON.stringify(wti, null, 2) + '\n', posUrl, {
  sampleCount: samples.length,
  tleEpoch: tleEpochIso(wtiTle.line1),
});

// 3. One zoom-0 Blue Marble tile (NASA GIBS) as the offline base map
const tile = Buffer.from(await (await get(SOURCES.blueMarbleZ0)).arrayBuffer());
if (tile[0] !== 0xff || tile[1] !== 0xd8) throw new Error('Blue Marble tile is not a JPEG');
save('bluemarble-z0.jpg', tile, SOURCES.blueMarbleZ0, {
  credit: 'Imagery: NASA EOSDIS GIBS, Blue Marble Shaded Relief and Bathymetry',
});

// 4. Natural Earth populated places (public domain): the largest cities by pop_max
const ne = await (await get(SOURCES.naturalEarthPlaces)).json();
const cities = ne.features
  .map((f) => ({
    name: f.properties.name,
    country: f.properties.adm0name,
    lat: Number(f.properties.latitude.toFixed(4)),
    lon: Number(f.properties.longitude.toFixed(4)),
    pop: f.properties.pop_max,
  }))
  .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lon) && c.pop > 0)
  .sort((a, b) => b.pop - a.pop)
  .slice(0, CITY_COUNT);
save('cities.json', JSON.stringify(cities, null, 1) + '\n', SOURCES.naturalEarthPlaces, {
  count: cities.length,
  of: ne.features.length,
  rule: `largest ${CITY_COUNT} by pop_max`,
  license: 'Natural Earth, public domain',
});

writeFileSync(join(dataDir, 'snapshot-meta.json'), JSON.stringify(meta, null, 2) + '\n');
console.log('saved src/data/snapshot-meta.json');
