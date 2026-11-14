// Smoke test: open the built page in headless Chrome, check the tracker runs, save a screenshot.
//
//   node scripts/smoke.mjs                      dist/index.html from file://, network mocked
//   node scripts/smoke.mjs --net                real network; also presses "Check against reference"
//   node scripts/smoke.mjs --offline            network off (browser offline, every request refused);
//                                               defaults to docs/iss-ride-along-offline.html
//   node scripts/smoke.mjs --url <url> --out evidence/x.png --size 390x844
//
// Default (mocked) mode: the CelesTrak request is answered with the TLE saved in src/data/, the NASA
// EONET request with src/data/eonet-open.json, every NASA GIBS tile with the built-in Blue Marble
// tile (status 200, Layer-Time-Actual set to the requested day); every other non-file request is
// blocked and counted, so the run is the same on any network.
// NASA layers (M4), every mode: the map's date label (#gibs-date) must be filled in. With --net it
// must name a day ("daily satellite image, YYYY-MM-DD, not a live camera") and at least one real
// GIBS map tile (zoom/row/column URL, not the probe) must answer HTTP 200.
// Offline mode: the browser context is offline and every non-file request is aborted as
// "internet disconnected" (CelesTrak included), so the page must run on the orbit data built into it;
// it also requires the age label to say so.
// Stale-build guard: a file:// page whose <meta name="iss-source-hash"> does not match the current
// source (scripts/source-hash.mjs) fails at once; rebuild first.
// RAM rule (PLAN.md section 3): runs at 0.8 GB free or more; below that it waits 60 s, retries once,
// then prints DEFERRED and exits 0 (not a failure).
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync } from 'node:fs';
import { freemem } from 'node:os';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { builtHash, sourceHash } from './source-hash.mjs';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const NET = args.includes('--net');
const OFFLINE = args.includes('--offline');
if (NET && OFFLINE) {
  console.log('SMOKE FAIL: --net and --offline cannot be used together');
  process.exit(1);
}
const defaultFile = OFFLINE ? 'docs/iss-ride-along-offline.html' : 'dist/index.html';
const url = opt('--url', pathToFileURL(resolve(defaultFile)).href);
const out = resolve(opt('--out', OFFLINE ? 'evidence/m3-offline.png' : 'evidence/m1.png'));
const [w, h] = opt('--size', '1366x768').split('x').map(Number);

// Stale-build guard (M4 fix r2): a file:// page must carry the fingerprint of the current source
// (scripts/source-hash.mjs). Checked before Chrome starts, so a stale page costs no browser run.
if (url.startsWith('file:')) {
  const page = new URL(url);
  const built = builtHash(readFileSync(page, 'utf8'));
  const now = sourceHash();
  if (built !== now) {
    console.log(
      `SMOKE FAIL: ${page.pathname.split('/').pop()} was built from different source ` +
        `(page ${built ?? 'has no source hash'}, source now ${now}); run npm run build` +
        (OFFLINE ? ' and npm run offline' : '') + ' first',
    );
    process.exit(1);
  }
}

const MIN_FREE_GB = 0.8;
const gb = () => freemem() / 1024 ** 3;
if (gb() < MIN_FREE_GB) {
  console.log(`free RAM ${gb().toFixed(2)} GB < ${MIN_FREE_GB} GB; waiting 60 s and retrying once`);
  await new Promise((r) => setTimeout(r, 60_000));
  if (gb() < MIN_FREE_GB) {
    console.log(`DEFERRED low RAM (${gb().toFixed(2)} GB free); run it again later`);
    process.exit(0);
  }
}

const tle = readFileSync(resolve('src/data/iss.tle'), 'utf8');
const eonetSnapshot = readFileSync(resolve('src/data/eonet-open.json'), 'utf8');
const blueMarbleTile = readFileSync(resolve('src/data/bluemarble-z0.jpg'));
const GIBS_TILE = /^https:\/\/gibs\.earthdata\.nasa\.gov\/wmts\/epsg3857\/best\/MODIS_Terra_CorrectedReflectance_TrueColor\/default\/(\d{4}-\d{2}-\d{2})\/GoogleMapsCompatible_Level9\/(\d+)\/(\d+)\/(\d+)\.jpg$/;
const gibsResponses = [];
const consoleErrors = [];
const pageErrors = [];
const requests = { file: 0, mockedCelestrak: 0, mockedEonet: 0, mockedGibs: 0, blocked: [], network: [], refusedOffline: [] };

const browser = await chromium.launch({ channel: 'chrome', headless: true });
let failed = false;
try {
  const context = await browser.newContext({ viewport: { width: w, height: h }, offline: OFFLINE });
  const page = await context.newPage();
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('response', (r) => {
    const m = GIBS_TILE.exec(r.url());
    if (m) gibsResponses.push({ day: m[1], zyx: `${m[2]}/${m[3]}/${m[4]}`, status: r.status(), kind: r.request().resourceType() });
  });
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith('file:') || u.startsWith('data:') || u.startsWith('blob:')) {
      requests.file++;
      return route.continue();
    }
    if (OFFLINE) {
      requests.refusedOffline.push(u);
      return route.abort('internetdisconnected');
    }
    if (NET) {
      requests.network.push(u);
      return route.continue();
    }
    if (u.startsWith('https://celestrak.org/')) {
      requests.mockedCelestrak++;
      return route.fulfill({ status: 200, contentType: 'text/plain', headers: { 'access-control-allow-origin': '*' }, body: tle });
    }
    if (u.startsWith('https://eonet.gsfc.nasa.gov/api/v3/events')) {
      requests.mockedEonet++;
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: eonetSnapshot });
    }
    const g = GIBS_TILE.exec(u);
    if (g) {
      requests.mockedGibs++;
      return route.fulfill({
        status: 200,
        contentType: 'image/jpeg',
        headers: {
          'access-control-allow-origin': '*',
          'access-control-expose-headers': 'layer-time-actual',
          'layer-time-actual': `${g[1]}T00:00:00Z`,
        },
        body: blueMarbleTile,
      });
    }
    requests.blocked.push(u);
    return route.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' }, body: '' });
  });

  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => /^-?\d+(\.\d+)?$/.test(document.getElementById('lat')?.textContent ?? ''), null, { timeout: 15_000 });
  const read = () =>
    page.evaluate(() => ({
      lat: document.getElementById('lat')?.textContent,
      lon: document.getElementById('lon')?.textContent,
      alt: document.getElementById('alt')?.textContent,
      speed: document.getElementById('speed')?.textContent,
      clock: document.getElementById('clock')?.textContent,
      marker: document.querySelector('.iss-icon')?.getAttribute('style'),
    }));
  // NASA layers: wait for the map label to settle (GIBS tiles loaded, or a final fallback text).
  if (!OFFLINE) {
    await page
      .waitForFunction(() => ['loaded', 'failed', 'unreachable'].includes(document.body.dataset.gibs ?? ''), null, { timeout: 25_000 })
      .catch(() => {});
    await page.waitForTimeout(NET ? 3000 : 500); // let the visible tiles paint before the screenshot
  }
  const first = await read();
  await page.waitForTimeout(2500);
  const second = await read();
  const info = await page.evaluate(() => ({
    // only the two orbit lines (the footprint circle and event markers are paths too)
    trackPaths: document.querySelectorAll('.leaflet-overlay-pane path.track-line').length,
    dataAge: document.getElementById('data-age')?.textContent,
    ageClass: document.getElementById('data-age')?.className,
    elements: document.body.dataset.elements,
    hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    gibsState: document.body.dataset.gibs ?? null,
    gibsDay: document.body.dataset.gibsDay ?? null,
    gibsLabel: document.getElementById('gibs-date')?.textContent ?? '',
    eventsStatus: document.getElementById('events-status')?.textContent ?? '',
    eventsListed: document.querySelectorAll('#events-list li').length,
    eventsSource: document.getElementById('events-source')?.textContent ?? '',
    photo: document.getElementById('photo-card')?.dataset.nasaId ?? null,
    photoCaption: document.getElementById('photo-caption')?.textContent ?? '',
    photoLoaded: document.getElementById('photo-img')?.naturalWidth ?? 0,
    creditsHasGibs: /Global Imagery Browse Services/.test(document.getElementById('credits')?.textContent ?? ''),
  }));

  let ref = null;
  if (NET) {
    await page.click('#check-ref');
    await page.waitForFunction(() => !/Asking/.test(document.getElementById('ref-result')?.textContent ?? 'Asking'), null, { timeout: 15_000 });
    ref = await page.evaluate(() => ({
      errorKm: document.getElementById('ref-result')?.dataset.errorKm ?? null,
      text: document.getElementById('ref-result')?.textContent,
    }));
  }

  mkdirSync(dirname(out), { recursive: true });
  await page.screenshot({ path: out });

  const latNumeric = /^-?\d+(\.\d+)?$/.test(second.lat ?? '');
  const moved = first.marker !== second.marker || first.lat !== second.lat || first.lon !== second.lon;
  // Offline the page must say it runs on its built-in orbit data (a fresh profile has no saved copy).
  const offlineLabelOk = !OFFLINE || /built into this page/.test(info.dataAge ?? '');
  // NASA layers (M4). Mocked and --net: the label names the day; --net also needs a real 200 map tile.
  const tiles200 = gibsResponses.filter((r) => r.status === 200 && r.kind === 'image');
  const dayLabelOk = /daily satellite image, \d{4}-\d{2}-\d{2}, not a live camera/.test(info.gibsLabel);
  const nasaChecks = {
    gibsLabelOk: OFFLINE ? /Blue Marble/.test(info.gibsLabel) : dayLabelOk,
    gibsTile200: !NET || tiles200.length > 0,
    eventsShown: info.eventsListed > 0 && info.eventsStatus.length > 0,
    // M4 fix r1/r2: both event lines name the set they count (open events reported in the last N days).
    eventsSetNamed: /open natural events reported in the last \d+ days/.test(info.eventsStatus) && /(Saved copy from|Live from NASA EONET).* All \d+ open natural events reported in the last \d+ days/.test(info.eventsSource),
    photoShown: info.photo !== null && info.photoLoaded > 0 && /Photo: NASA, Image and Video Library, iss/.test(info.photoCaption),
    creditsOk: info.creditsHasGibs,
  };
  const result = {
    url,
    mode: NET ? 'network' : OFFLINE ? 'offline' : 'mocked',
    viewport: `${w}x${h}`,
    screenshot: out,
    first,
    second,
    latNumeric,
    moved,
    ...info,
    ref,
    offlineLabelOk,
    nasaChecks,
    gibsTiles: { total: gibsResponses.length, status200: tiles200.length, sample: gibsResponses.slice(0, 3) },
    consoleErrors,
    pageErrors,
    requests: {
      ...requests,
      blocked: requests.blocked.length,
      blockedUrls: requests.blocked,
      refusedOffline: requests.refusedOffline.length,
      refusedOfflineUrls: requests.refusedOffline,
    },
  };
  console.log(JSON.stringify(result, null, 2));
  failed =
    !latNumeric ||
    !moved ||
    consoleErrors.length > 0 ||
    pageErrors.length > 0 ||
    info.trackPaths < 2 ||
    !offlineLabelOk ||
    Object.values(nasaChecks).includes(false);
  const offlineNote = OFFLINE ? `, network off (${requests.refusedOffline.length} request(s) refused), label says built into this page` : '';
  console.log(
    failed
      ? 'SMOKE FAIL'
      : `SMOKE PASS: #lat ${second.lat}, marker moved, ${info.trackPaths} track paths, 0 console errors${offlineNote}; ` +
          `map label "${info.gibsLabel}"${NET ? `, ${tiles200.length} GIBS tile(s) HTTP 200` : ''}; ${info.eventsListed} event line(s); photo ${info.photo}`,
  );
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
