// Saves the data the page embeds for offline use into src/data/, each with its source URL and
// retrieval time (src/data/snapshot-meta.json). Run: node scripts/snapshot.mjs
// Courtesy rules: one request per source per run, no retries (CelesTrak blocks repeated
// downloads and says a 403/404 "is not going to change by repeating the request").
// Option: --orbit-from <dir>  if CelesTrak cannot be reached, use iss.tle and iss.omm.json saved
// in <dir> by an earlier CelesTrak fetch (their file times are recorded as the retrieval time).
// Option: --only nasa  refresh only the NASA layers (step 5: Blue Marble zoom 1-2 tiles, the EONET
// snapshot, the curated photos and thumbnails) and keep every other file and its entry in
// snapshot-meta.json as it is (so the orbit test fixtures do not change).
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
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

const argv = process.argv.slice(2);
const orbitFrom = argv.includes('--orbit-from') ? resolve(argv[argv.indexOf('--orbit-from') + 1]) : null;
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1] : null;
if (only && only !== 'nasa') throw new Error(`--only accepts "nasa", got ${only}`);

const metaPath = join(dataDir, 'snapshot-meta.json');
const meta =
  only && existsSync(metaPath)
    ? JSON.parse(readFileSync(metaPath, 'utf8'))
    : { generatedBy: 'scripts/snapshot.mjs', files: {} };

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
  mkdirSync(dirname(join(dataDir, name)), { recursive: true });
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

if (!only) await orbitAndReference();
await nasaLayers();
writeFileSync(metaPath, JSON.stringify(meta, null, 2) + '\n');
console.log('saved src/data/snapshot-meta.json');

async function orbitAndReference() {
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
}

// 5. NASA layers (M4): Blue Marble zoom 1-2 tiles for the offline map, the open EONET events, and the
//    curated astronaut photos with their NASA metadata and thumbnails.
async function nasaLayers() {
  // 5a. Blue Marble Shaded Relief and Bathymetry (NASA GIBS), zoom 1 (4 tiles) and zoom 2 (16 tiles)
  for (const z of [1, 2]) {
    for (let y = 0; y < 2 ** z; y++) {
      for (let x = 0; x < 2 ** z; x++) {
        const url = `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/${z}/${y}/${x}.jpeg`;
        const buf = Buffer.from(await (await get(url)).arrayBuffer());
        if (buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error(`${url} is not a JPEG`);
        save(`bluemarble/${z}-${y}-${x}.jpg`, buf, url, {
          credit: 'Imagery: NASA EOSDIS GIBS, Blue Marble Shaded Relief and Bathymetry',
        });
      }
    }
  }

  // 5b. NASA EONET v3 open natural events (the page fetches the same URL live and falls back to this)
  const eonetUrl = 'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=50';
  const eonet = await (await get(eonetUrl)).json(); // served as application/rss+xml, body is JSON
  if (!Array.isArray(eonet.events)) throw new Error('unexpected EONET payload');
  save('eonet-open.json', JSON.stringify(eonet) + '\n', eonetUrl, {
    eventCount: eonet.events.length,
    credit: 'Natural events: NASA Earth Observatory Natural Event Tracker (EONET)',
  });

  // 5c. Curated astronaut photos from the NASA Image and Video Library. Chosen by hand (Sat Nov 14,
  //     M4) from images-api.nasa.gov searches: Earth views from the station whose description has an
  //     explicit NASA credit (photos credited to ESA, JAXA or CSA were left out). The library gives no
  //     coordinates, so lat/lon is the place named in the title, set by hand and approximate.
  const CURATED = [
    { nasa_id: 'iss074e0334264', place: 'Detroit, Michigan', lat: 42.33, lon: -83.05 },
    { nasa_id: 'iss074e0642367', place: 'Lake Huron and Georgian Bay', lat: 44.8, lon: -82.4 },
    { nasa_id: 'iss074e0603570', place: 'Himalayas, Nepal and China', lat: 28.0, lon: 86.9 },
    { nasa_id: 'iss074e0491784', place: 'Melbourne, Australia', lat: -37.81, lon: 144.96 },
    { nasa_id: 'iss074e0573516', place: 'Lake Argentino, Andes', lat: -50.3, lon: -72.8 },
    { nasa_id: 'iss074e0790404', place: 'Cairo, Egypt', lat: 30.04, lon: 31.24 },
    { nasa_id: 'iss074e0543247', place: 'Chennai, India', lat: 13.08, lon: 80.27 },
    { nasa_id: 'iss074e0319896', place: 'La Malinche volcano, Mexico', lat: 19.23, lon: -98.03 },
    { nasa_id: 'iss075e0225788', place: 'Iberian Peninsula', lat: 40.0, lon: -4.0 },
    { nasa_id: 'iss074e0825656', place: 'Dubai, United Arab Emirates', lat: 25.11, lon: 55.14 },
    { nasa_id: 'iss075e0085243', place: 'Southwestern Madagascar', lat: -23.0, lon: 43.6 },
    { nasa_id: 'iss074e0459458', place: 'Vitoria, Brazil', lat: -20.32, lon: -40.34 },
  ];
  const photos = [];
  for (const c of CURATED) {
    const searchUrl = `https://images-api.nasa.gov/search?nasa_id=${c.nasa_id}`;
    const item = (await (await get(searchUrl)).json()).collection?.items?.[0];
    const d = item?.data?.[0];
    if (!d || d.nasa_id !== c.nasa_id) throw new Error(`images-api has no item ${c.nasa_id}`);
    const description = d.description ?? '';
    const credit = /Credit:\s*([^\n]+?)\s*$/m.exec(description)?.[1]?.replace(/\.$/, '') ?? null;
    const thumbUrl = `https://images-assets.nasa.gov/image/${c.nasa_id}/${c.nasa_id}~thumb.jpg`;
    const thumb = Buffer.from(await (await get(thumbUrl)).arrayBuffer());
    if (thumb[0] !== 0xff || thumb[1] !== 0xd8) throw new Error(`${thumbUrl} is not a JPEG`);
    save(`photos/${c.nasa_id}.jpg`, thumb, thumbUrl);
    photos.push({
      ...c,
      title: d.title,
      date_created: d.date_created,
      center: d.center ?? null,
      photographer: d.photographer ?? null,
      secondary_creator: d.secondary_creator ?? null,
      keywords: d.keywords ?? [],
      credit,
      description,
      page: `https://images.nasa.gov/details/${c.nasa_id}`,
      metadataUrl: searchUrl,
    });
  }
  save('photos.json', JSON.stringify(photos, null, 1) + '\n', 'https://images-api.nasa.gov/search?nasa_id={nasa_id}', {
    count: photos.length,
    rule: 'curated by hand; NASA-credited Earth views from the ISS; place and lat/lon set from the title (approximate)',
  });
}
