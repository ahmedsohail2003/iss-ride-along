// Smoke test: open the built page in headless Chrome, check the tracker runs, save a screenshot.
//
//   node scripts/smoke.mjs                      dist/index.html from file://, network mocked
//   node scripts/smoke.mjs --net                real network; also presses "Check against reference"
//   node scripts/smoke.mjs --url <url> --out evidence/x.png --size 390x844
//
// Default (mocked) mode: the CelesTrak request is answered with the TLE saved in src/data/, every
// other non-file request is blocked and counted, so the run is the same on any network.
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
const url = opt('--url', pathToFileURL(resolve('dist/index.html')).href);
const out = resolve(opt('--out', 'evidence/m1.png'));
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
const requests = { file: 0, mockedCelestrak: 0, blocked: [], network: [] };

const browser = await chromium.launch({ channel: 'chrome', headless: true });
let failed = false;
try {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith('file:') || u.startsWith('data:') || u.startsWith('blob:')) {
      requests.file++;
      return route.continue();
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
  const result = {
    url,
    mode: NET ? 'network' : 'mocked',
    viewport: `${w}x${h}`,
    screenshot: out,
    first,
    second,
    latNumeric,
    moved,
    ...info,
    ref,
    consoleErrors,
    pageErrors,
    requests: { ...requests, blocked: requests.blocked.length, blockedUrls: requests.blocked },
  };
  console.log(JSON.stringify(result, null, 2));
  failed = !latNumeric || !moved || consoleErrors.length > 0 || pageErrors.length > 0 || info.trackPaths < 2;
  console.log(failed ? 'SMOKE FAIL' : `SMOKE PASS: #lat ${second.lat}, marker moved, ${info.trackPaths} track paths, 0 console errors`);
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
