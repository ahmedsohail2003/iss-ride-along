// Smoke test: open the built page in headless Chrome, check the tracker runs, save a screenshot.
//
//   node scripts/smoke.mjs                      dist/index.html from file://, network mocked
//   node scripts/smoke.mjs --net                real network; also presses "Check against reference"
//   node scripts/smoke.mjs --offline            network off (browser offline, every request refused);
//                                               defaults to docs/iss-ride-along-offline.html
//   node scripts/smoke.mjs --plan               mocked network; presses "Plan my sighting" with no key
//                                               (fixed plan), then the trip example, then a keyed run
//                                               with the test key (Gemini mocked); evidence/a1.png
//   node scripts/smoke.mjs --oem                mocked network; the NASA trajectory panel (C1): a gap in km,
//                                               its row time, and the orbit numbers' age, which must equal
//                                               row time minus the TLE epoch (recomputed here) within 0.1 h;
//                                               evidence/c1.png
//   node scripts/smoke.mjs --path               mocked network (wheretheiss.at answered with a saved sample,
//                                               Gemini with a canned reply and the test key); reads the
//                                               "90-second click path" table in docs/PRESENTER_PACK.md and
//                                               does every row: the element exists, is visible and shows the
//                                               quoted words, the action works, the "then you see" element
//                                               appears; evidence/m9-path.png
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
const PLAN = args.includes('--plan');
const OEM = args.includes('--oem');
const PATH = args.includes('--path');
// --path: the click path rows from the presenter pack (M9). Columns: Step | When | Do | Where on screen |
// Then you see | Say. "Do" is `look`, `click`, `key` (type the test key) or `tick`; "Where" is a backticked
// CSS selector, optionally followed by the quoted words the element must show.
function readClickPath() {
  const pack = readFileSync(resolve('docs/PRESENTER_PACK.md'), 'utf8');
  const start = pack.search(/^## The 90-second click path/m);
  if (start < 0) return [];
  const rest = pack.slice(start + 3);
  const end = rest.search(/^## /m);
  const section = end < 0 ? rest : rest.slice(0, end);
  return section
    .split('\n')
    .filter((l) => /^\|\s*\d+\s*\|/.test(l))
    .map((l) => {
      const c = l.split('|').slice(1, -1).map((s) => s.trim());
      const tick = (s) => /`([^`]+)`/.exec(s)?.[1] ?? null;
      return {
        step: Number(c[0]),
        when: c[1],
        action: tick(c[2]),
        selector: tick(c[3]),
        label: /"([^"]+)"/.exec(c[3].replace(/`[^`]*`/g, ''))?.[1] ?? null,
        then: tick(c[4]),
      };
    });
}
const clickPath = PATH ? readClickPath() : [];
if (NET && OFFLINE) {
  console.log('SMOKE FAIL: --net and --offline cannot be used together');
  process.exit(1);
}
const defaultFile = OFFLINE ? 'docs/iss-ride-along-offline.html' : 'dist/index.html';
const url = opt('--url', pathToFileURL(resolve(defaultFile)).href);
const out = resolve(opt('--out', OFFLINE ? 'evidence/m3-offline.png' : PLAN ? 'evidence/a1.png' : OEM ? 'evidence/c1.png' : PATH ? 'evidence/m9-path.png' : 'evidence/m1.png'));
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
// --plan: the planner's services answered from the saved real replies in tests/fixtures/.
const planFixtures = PLAN || PATH
  ? {
      openMeteo: JSON.stringify(JSON.parse(readFileSync(resolve('tests/fixtures/openmeteo-ypsilanti.json'), 'utf8')).reply),
      exa: JSON.parse(readFileSync(resolve('tests/fixtures/exa-station-news.json'), 'utf8')).reply,
      gemini: JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text: 'No pass is worth going out for in your window.' }] }, finishReason: 'STOP' }] }),
      testKey: (await import('../tests/fixtures/test-key.mjs')).TEST_KEY,
    }
  : null;
const tripReplies = PATH ? JSON.parse(readFileSync(resolve('tests/fixtures/gemini-trip-from-docs.json'), 'utf8')).replies : [];
const planRequests = { openMeteo: 0, exa: 0, gemini: 0, geminiUrls: [], geminiKeyHeader: 0 };
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
    if (PATH && u.startsWith('https://api.wheretheiss.at/')) {
      planRequests.wheretheiss = (planRequests.wheretheiss ?? 0) + 1;
      const sample = JSON.parse(readFileSync(resolve('src/data/wheretheiss-samples.json'), 'utf8')).samples[0];
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(sample) });
    }
    const MOCK_PLAN = PLAN || PATH;
    if (MOCK_PLAN && u.startsWith('https://api.open-meteo.com/')) {
      planRequests.openMeteo++;
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: planFixtures.openMeteo });
    }
    if (MOCK_PLAN && u.startsWith('https://mcp.exa.ai/')) {
      planRequests.exa++;
      return route.fulfill({ status: 200, contentType: 'text/event-stream', headers: { 'access-control-allow-origin': '*' }, body: planFixtures.exa });
    }
    if (MOCK_PLAN && u.startsWith('https://generativelanguage.googleapis.com/')) {
      planRequests.gemini++;
      planRequests.geminiUrls.push(u);
      if (route.request().headers()['x-goog-api-key'] === planFixtures.testKey) planRequests.geminiKeyHeader++;
      // --path: the trip sentence's hand-built replies (tests/fixtures/gemini-trip-from-docs.json, "from docs,
      // not live"), one per call in order, so the Steps list fills the way it does at the table.
      const body = PATH ? JSON.stringify(tripReplies[Math.min(planRequests.gemini - 1, tripReplies.length - 1)]) : planFixtures.gemini;
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body });
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

  // ---- --plan: the sighting planner (A1)
  let plan = null;
  if (PLAN) {
    plan = {};
    plan.buttonText = await page.textContent('#plan-go');
    await page.click('#plan-go');
    await page.waitForFunction(() => !!document.body.dataset.planKind, null, { timeout: 15_000 });
    await page.waitForTimeout(1200);
    Object.assign(
      plan,
      await page.evaluate(() => ({
        traceRows: document.querySelectorAll('#plan-trace li').length,
        traceTools: [...document.querySelectorAll('#plan-trace li strong')].map((e) => e.textContent),
        kind: document.body.dataset.planKind,
        headline: document.getElementById('plan-headline')?.textContent ?? '',
        passShown: document.body.dataset.passShown ?? null,
        arcPaths: [...document.querySelectorAll('path.pass-arc')].filter((p) => (p.getAttribute('d') ?? '').length > 10).length,
        countdown: document.getElementById('plan-countdown')?.textContent ?? '',
        news: document.querySelectorAll('#news-list li').length,
        newsNote: document.getElementById('news-note')?.textContent ?? '',
      })),
    );
    mkdirSync(dirname(out), { recursive: true });
    await page.screenshot({ path: out, fullPage: true });
    await page.click('button.example[data-example="trip"]');
    plan.tripNote = await page.textContent('#plan-note');
    // Keys: a run with the typed test key (Gemini mocked), the tick box, a reload, then sessionStorage cleared.
    const k = planFixtures.testKey;
    await page.click('#plan-settings summary');
    await page.fill('#key-gemini', k);
    await page.check('#key-keep');
    await page.click('button.example[data-example="simple"]');
    plan.modeWithKey = await page.textContent('#plan-mode');
    await page.click('#plan-go');
    await page.waitForFunction(() => /Planned by the AI|Fixed plan/.test(document.getElementById('plan-note')?.textContent ?? ''), null, { timeout: 20_000 });
    plan.keyedNote = await page.textContent('#plan-note');
    // localStorage already holds the tracker's own orbit-data copy (M1); the key must be in none of it.
    const lsScan = (key) => page.evaluate((kk) => ({ names: Object.keys(localStorage), withKey: Object.keys(localStorage).filter((n) => (localStorage.getItem(n) ?? '').includes(kk) || n.includes(kk)).length }), key);
    plan.localStorage = await lsScan(k);
    plan.urlHasKey = page.url().includes(k);
    await page.reload({ waitUntil: 'load' });
    plan.keptAfterReload = (await page.inputValue('#key-gemini')) === k;
    await page.evaluate(() => sessionStorage.clear());
    await page.reload({ waitUntil: 'load' });
    plan.goneAfterClear = (await page.inputValue('#key-gemini')) === '';
    plan.localStorageEnd = await lsScan(k);
    plan.requests = { ...planRequests, geminiUrlHasKey: planRequests.geminiUrls.some((u) => u.includes(k)), geminiUrls: planRequests.geminiUrls.length };
    plan.checks = {
      fixedLabel: /fixed plan, no AI/.test(plan.buttonText ?? ''),
      traceRows5: plan.traceRows >= 5,
      passOnMap: plan.arcPaths > 0 && !!plan.passShown,
      countdown: /Starts in|Happening now|This pass is over/.test(plan.countdown),
      tripNeedsAi: /this one needs the AI/.test(plan.tripNote ?? ''),
      keyedRun: plan.requests.gemini >= 1 && plan.requests.geminiKeyHeader === plan.requests.gemini && !plan.requests.geminiUrlHasKey,
      keyNotInLocalStorage: plan.localStorage.withKey === 0 && plan.localStorageEnd.withKey === 0,
      noKeyInAddress: !plan.urlHasKey,
      keptAfterReload: plan.keptAfterReload,
      goneAfterClear: plan.goneAfterClear,
    };
  } else if (!OEM && !PATH) {
    mkdirSync(dirname(out), { recursive: true });
    await page.screenshot({ path: out });
  }

  // ---- --path: the presenter pack's 90-second click path (M9), row by row.
  let clickRun = null;
  if (PATH) {
    clickRun = { rows: [], problems: [] };
    if (clickPath.length < 8) clickRun.problems.push(`click path has ${clickPath.length} rows, expected at least 8`);
    const secs = clickPath.map((s) => /^(\d+):(\d{2})$/.exec(s.when)).filter(Boolean).map((m) => Number(m[1]) * 60 + Number(m[2]));
    clickRun.lastStepAtS = secs.length ? Math.max(...secs) : null;
    if (clickRun.lastStepAtS === null || clickRun.lastStepAtS > 90) clickRun.problems.push(`last timed step at ${clickRun.lastStepAtS} s (limit 90 s)`);
    for (const s of clickPath) {
      const r = { step: s.step, when: s.when, action: s.action, selector: s.selector, label: s.label, then: s.then };
      try {
        if (!['look', 'click', 'key', 'tick'].includes(s.action)) throw new Error(`unknown action ${s.action}`);
        if (!s.selector) throw new Error('no selector');
        const loc = page.locator(s.selector).first();
        await loc.waitFor({ state: 'attached', timeout: 5000 });
        await loc.scrollIntoViewIfNeeded({ timeout: 5000 });
        r.visible = await loc.isVisible();
        r.text = ((await loc.textContent()) ?? '').replace(/\s+/g, ' ').trim().slice(0, 90);
        r.labelOk = !s.label || r.text.includes(s.label);
        if (s.action === 'click') await loc.click({ timeout: 5000 });
        if (s.action === 'key') await loc.fill(planFixtures.testKey, { timeout: 5000 });
        if (s.action === 'tick') await loc.check({ timeout: 5000 });
        if (s.then) {
          const t = page.locator(s.then).first();
          await t.waitFor({ state: 'visible', timeout: 20_000 });
          // A form field only has to be visible (it may still be empty); anything else must show text.
          const isField = await t.evaluate((el) => ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
          r.thenText = isField ? `(field) ${await t.inputValue()}`.trim() : ((await t.textContent()) ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
          r.thenOk = isField || r.thenText.length > 0;
        }
        r.ok = r.visible && r.labelOk && (s.then ? r.thenOk : true);
      } catch (e) {
        r.ok = false;
        r.error = String(e.message ?? e).split('\n')[0];
      }
      if (!r.ok) clickRun.problems.push(`step ${s.step} (${s.action} ${s.selector}) failed${r.error ? `: ${r.error}` : ''}`);
      clickRun.rows.push(r);
    }
    clickRun.keyNotInLocalStorage = await page.evaluate((kk) => Object.keys(localStorage).every((n) => !(localStorage.getItem(n) ?? '').includes(kk)), planFixtures.testKey);
    if (!clickRun.keyNotInLocalStorage) clickRun.problems.push('the test key ended up in localStorage');
    clickRun.requests = { wheretheiss: planRequests.wheretheiss ?? 0, gemini: planRequests.gemini, openMeteo: planRequests.openMeteo, exa: planRequests.exa };
    mkdirSync(dirname(out), { recursive: true });
    await page.screenshot({ path: out, fullPage: true });
  }

  // ---- NASA trajectory panel (C1), every mode: a gap in km at a row time, with the orbit numbers' age.
  const oem = await page.evaluate(() => {
    const el = document.getElementById('oem-gap');
    return {
      text: el?.textContent ?? '',
      gapKm: el?.dataset.gapKm ?? null,
      rowTime: el?.dataset.rowTime ?? null,
      measured: document.getElementById('oem-measured')?.textContent ?? '',
      growth: document.getElementById('oem-growth')?.textContent ?? '',
      chartPoints: Number(document.getElementById('oem-chart')?.dataset.points ?? 0),
      credit: /ISS trajectory ephemeris \(OEM\), NASA Johnson Space Center/.test(document.getElementById('credits-body')?.textContent ?? ''),
    };
  });
  {
    const km = /our position and NASA's are (\d+(?:\.\d+)?) km apart/.exec(oem.text);
    const shownAge = /orbit numbers (-?\d+(?:\.\d+)?) h old/.exec(oem.text);
    const shownTime = /^At (\d{2}:\d{2}) UTC/.exec(oem.text);
    oem.kmShown = km ? Number(km[1]) : null;
    oem.ageShownH = shownAge ? Number(shownAge[1]) : null;
    oem.checks = {
      kmNumber: oem.kmShown !== null && Number.isFinite(oem.kmShown),
      rowTimeShown: !!shownTime && !!oem.rowTime && oem.rowTime.slice(11, 16) === shownTime[1],
      ageShown: oem.ageShownH !== null,
      noAccurateTo: !/accurate to/i.test(oem.text + oem.measured + oem.growth),
      measuredLine: /^Measured at this age: about \d+(\.\d) km apart/.test(oem.measured),
      chart: oem.chartPoints >= 2,
      credit: oem.credit,
    };
    if (OEM) {
      // The age recomputed here from the TLE the mocked CelesTrak reply serves (src/data/iss.tle), by
      // reading its epoch columns directly (not the page's code): age = row time - epoch.
      const l1 = readFileSync(resolve('src/data/iss.tle'), 'utf8').split(/\r?\n/).find((l) => l.startsWith('1 '));
      const yy = Number(l1.slice(18, 20));
      const doy = Number(l1.slice(20, 32));
      const epochMs = Date.UTC(yy < 57 ? 2000 + yy : 1900 + yy, 0, 1) + (doy - 1) * 86_400_000;
      oem.ageRecomputedH = oem.rowTime ? (Date.parse(oem.rowTime) - epochMs) / 3_600_000 : null;
      oem.checks.ageMatches = oem.ageRecomputedH !== null && oem.ageShownH !== null && Math.abs(oem.ageRecomputedH - oem.ageShownH) <= 0.1;
      oem.checks.rowNotAfterNow = !!oem.rowTime && Date.parse(oem.rowTime) <= Date.now() && Date.now() - Date.parse(oem.rowTime) < 5 * 60_000;
      mkdirSync(dirname(out), { recursive: true });
      await page.locator('#oem-panel').scrollIntoViewIfNeeded();
      await page.screenshot({ path: out });
    }
  }

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
    plan,
    clickRun,
    oem,
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
    Object.values(nasaChecks).includes(false) ||
    (PLAN && Object.values(plan.checks).includes(false)) ||
    (PATH && clickRun.problems.length > 0) ||
    Object.values(oem.checks).includes(false);
  const offlineNote = OFFLINE ? `, network off (${requests.refusedOffline.length} request(s) refused), label says built into this page` : '';
  console.log(
    failed
      ? 'SMOKE FAIL'
      : `SMOKE PASS: #lat ${second.lat}, marker moved, ${info.trackPaths} track paths, 0 console errors${offlineNote}; ` +
          `map label "${info.gibsLabel}"${NET ? `, ${tiles200.length} GIBS tile(s) HTTP 200` : ''}; ${info.eventsListed} event line(s); photo ${info.photo}` +
          `; NASA trajectory: ${oem.kmShown} km apart at ${oem.rowTime?.slice(11, 16)} UTC, orbit numbers ${oem.ageShownH} h old` +
          (OEM ? ` (recomputed ${oem.ageRecomputedH?.toFixed(2)} h)` : '') +
          (PLAN ? `; planner: "${plan.buttonText?.trim()}", ${plan.traceRows} trace rows, ${plan.passShown} on the map, "${plan.countdown}", trip note "${plan.tripNote}", keys ok` : '') +
          (PATH ? `; click path: ${clickRun.rows.filter((r) => r.ok).length} of ${clickRun.rows.length} rows done, last timed step at ${clickRun.lastStepAtS} s` : ''),
  );
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
