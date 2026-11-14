// Smoke test: open the built page in headless Chrome, check the tracker runs, save a screenshot.
//
//   node scripts/smoke.mjs                      dist/index.html from file://, network mocked
//   node scripts/smoke.mjs --net                real network; also presses "Check against reference"
//   node scripts/smoke.mjs --offline            network off (browser offline, every request refused);
//                                               defaults to docs/iss-ride-along-offline.html
//   node scripts/smoke.mjs --url <url> --out evidence/x.png --size 390x844
//
// Default (mocked) mode: the CelesTrak request is answered with the TLE saved in src/data/, every
// other non-file request is blocked and counted, so the run is the same on any network.
// Offline mode: the browser context is offline and every non-file request is aborted as
// "internet disconnected" (CelesTrak included), so the page must run on the orbit data built into it;
// it also requires the age label to say so.
// RAM rule (PLAN.md section 3): runs at 0.8 GB free or more; below that it waits 60 s, retries once,
// then prints DEFERRED and exits 0 (not a failure).
import { chromium } from 'playwright-core';
import { mkdirSync, readFileSync } from 'node:fs';
import { freemem } from 'node:os';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

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
const consoleErrors = [];
const pageErrors = [];
const requests = { file: 0, mockedCelestrak: 0, blocked: [], network: [], refusedOffline: [] };

const browser = await chromium.launch({ channel: 'chrome', headless: true });
let failed = false;
try {
  const context = await browser.newContext({ viewport: { width: w, height: h }, offline: OFFLINE });
  const page = await context.newPage();
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  page.on('pageerror', (e) => pageErrors.push(String(e)));
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
  const first = await read();
  await page.waitForTimeout(2500);
  const second = await read();
  const info = await page.evaluate(() => ({
    trackPaths: document.querySelectorAll('.leaflet-overlay-pane path').length,
    dataAge: document.getElementById('data-age')?.textContent,
    ageClass: document.getElementById('data-age')?.className,
    elements: document.body.dataset.elements,
    hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
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
  failed = !latNumeric || !moved || consoleErrors.length > 0 || pageErrors.length > 0 || info.trackPaths < 2 || !offlineLabelOk;
  const offlineNote = OFFLINE ? `, network off (${requests.refusedOffline.length} request(s) refused), label says built into this page` : '';
  console.log(
    failed
      ? 'SMOKE FAIL'
      : `SMOKE PASS: #lat ${second.lat}, marker moved, ${info.trackPaths} track paths, 0 console errors${offlineNote}`,
  );
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
