// Smoke test: open the built page in headless Chrome, check the tracker runs, save a screenshot.
//
//   node scripts/smoke.mjs                      dist/index.html from file://, network mocked
//   node scripts/smoke.mjs --net                real network; also presses "Check against reference"
//   node scripts/smoke.mjs --offline            network off (browser offline, every request refused);
//                                               defaults to docs/iss-ride-along-offline.html
//   node scripts/smoke.mjs --plan               mocked network; presses "Plan my sighting" with no key
//                                               (fixed plan), then the trip example, then a keyed run
//                                               with the test key (Gemini mocked); evidence/a1.png
//   node scripts/smoke.mjs --plan --outputs     A2: after the fixed plan, presses "Add to calendar" (a download
//                                               named iss-pass-*.ics must fire, CRLF calendar text) and "Class
//                                               handout", then emulates print: the sheet shows, the map and its
//                                               controls and the planner do not; evidence/a2.png (print view) and
//                                               evidence/a2-card.png (the card with its buttons); a1.png untouched
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
//   P1 (default mode): after "Detroit" + Enter, "Plan my sighting" is pressed too; the Place control and the
//   passes table (its caption, rows and City box) must then name Detroit.
//   node scripts/smoke.mjs --a11y               C3: mocked network as in the default mode. (1) watches every live region
//                                               (aria-live polite/assertive, role status/alert/log) for 65 s with
//                                               nobody touching the page: the plain sentence (#where-now) must change
//                                               at most once (and does change once: it is refreshed each minute), no
//                                               other live region more than once; (2) axe-core (injected from
//                                               node_modules) on the first screen, on each tab and again after the
//                                               keyboard run: 0 "serious" and 0 "critical" findings; (3) keyboard
//                                               only: for each tab, open it with Tab + Enter, then Tab from the top of
//                                               the page and press Enter on every button, link-button, tab and
//                                               <summary> the Tab key reaches that was not pressed before, repeating
//                                               until a pass finds nothing new; every button visible at any point must
//                                               have been reached by Tab, every Enter must fire its click, every
//                                               focused button must show a focus ring (outline 2 px or more), and
//                                               Space must work on the map's zoom buttons; then one game round played
//                                               by keyboard (Tab to the map, Enter guesses the centre). window.print
//                                               is replaced by a counter for the run (the "Print this sheet" button).
//                                               evidence/c3.png (a focused button and the sentence).
//   node scripts/smoke.mjs --forecast           X6: mocked network as in the default mode. In "What it is flying over" the
//                                               "Forecast lab" button opens the card in place (no new page); [data-skill-yield]
//                                               must read 0.57 and [data-skill-price] 0.00 (the page computes the harvest
//                                               skill from the bundled data when the card opens); both NASA greenness images
//                                               decoded and drawn (256 x 128); the chart has its three lines; the label starts
//                                               "Research demo, not investment advice" and, with the card's top at the top of
//                                               the window, is visible without scrolling (the card has no inner scroll); no
//                                               text in the card outside the label mentions a price; then "should I buy corn
//                                               futures?" in the planner gets the fixed line with 0 AI requests. evidence/x6.png
//   node scripts/smoke.mjs --url <url> --out evidence/x.png --size 390x844
//   node scripts/smoke.mjs --block <host>       M7: every source mocked except <host>, whose requests are refused
//                                               (connection refused). Presses "Check against reference" and plans
//                                               for "Detroit" ("Ann Arbor" when the place search is blocked; with
//                                               the test key when the AI provider is blocked). Pass = the page
//                                               loads, the marker moves, a visible warning names that source, and
//                                               no other source warns; 0 uncaught errors. Console lines about the
//                                               refused requests themselves are expected and listed, not counted.
//
// C2 day and night, every mode: the night side is drawn (a filled path in Leaflet's "night" pane, the
// day/night line beside it), the station's label on the marker and in the numbers panel is one of the two
// allowed strings ("in sunlight" / "in Earth's shadow, sunrise in N min") and the two agree; in default
// mode the "night side" toggle removes and restores the shading, and evidence/c2.png is saved.
// X5 sky from the station, every mode: the "Sky from the station" tab draws a non-blank star chart
// (bright star pixels counted in the canvas, stars and constellation lines above the station's horizon),
// its label is one of the two allowed strings and says the same as the map's label, "straight up" is
// the station's own latitude, and the catalogue and line credits are on the page (in the tab and in the
// footer's credits list); default mode saves evidence/x5.png (x5-WxH.png at other sizes). The tab is
// closed again (back to "What it is flying over") before the next checks.
// X5b drag and zoom (default mode, any --size): a mouse drag moves the view centre more than 5 degrees, a wheel
// turn changes the field of view, a click on Sirius (or the brightest named star in view) shows its name,
// ArrowLeft and + turn and zoom the focused chart, and "Back to the station's view" brings the centre back to
// straight up within 0.1 degree; evidence/x5b.png (x5b-WxH.png at other sizes).
// M7 first-screen checks (default mode, any --size): no horizontal scroll; the planner box and the
// next-pass line inside the first screen; "Detroit" typed in the planner box plus Enter puts a pass
// line with a time and a compass word in #next-pass within 2 s; every tab opens its own panel.
// The planner's services are mocked as in --plan, so the default run makes no real request.
// M6 game (default mode): the Game tab's "Play" starts round 1; one scripted tap on the map; the reveal
// must end with "N km off" in the bar, and that N must equal the haversine distance recomputed here from
// the tap and the answer, the answer must equal satellite.js run here at the round's target time, and the
// target must be 10 min after the start; evidence/m6.png (the score on the map). Rounds 2 and 3 are then
// tapped: each starts at the previous target, and the total lands on the "this device" leaderboard
// (evidence/m6-board.png). The orbit lab line must equal the circular-orbit formula at the shown height.
//
// Default (mocked) mode: the CelesTrak request is answered with the TLE saved in src/data/, the NASA
// EONET request with src/data/eonet-open.json, every NASA GIBS tile with the built-in Blue Marble
// tile (status 200, Layer-Time-Actual set to the requested day); every other non-file request is
// blocked and counted, so the run is the same on any network.
// NASA layers (M4), every mode: the map's label (#gibs-date) must be filled in.
// P2 (every online mode but --block of GIBS): on load the label names the cloud-free NASA Blue Marble
// and no date; pressing the switch (#daily-toggle) shows the daily photo's label ("daily satellite
// image, YYYY-MM-DD, not a live camera"), and turning it off brings the Blue Marble label back. Screens
// at evidence/p2-default[-WxH][-net].png (first screen, switch off; the map element below the fold on a
// phone) and p2-daily*.png (switch on). With --net at least one real GIBS tile of each layer (Blue
// Marble and the daily photo; zoom/row/column URLs, not the probe) must answer HTTP 200. With --block
// gibs.earthdata.nasa.gov the label names the built-in Blue Marble and NASA GIBS, and the switch is off
// and disabled. Mocked mode answers Blue Marble tiles at zoom 0-2 with the built-in tiles (saved from
// the same GIBS URLs) and deeper ones with a transparent pixel.
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
import * as satjs from 'satellite.js';

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
const OUTPUTS = PLAN && args.includes('--outputs');
const A11Y = args.includes('--a11y');
// X3 --voice: a stubbed speechSynthesis records what the page says; a second page has no speechSynthesis.
const VOICE = args.includes('--voice');
// X6 --forecast: the Forecast lab card.
const FORECAST = args.includes('--forecast');
// M7: the 8 live sources, by the host each one's URL constant names in src/.
const BLOCKABLE = {
  'celestrak.org': { key: 'celestrak', name: 'CelesTrak' },
  'gibs.earthdata.nasa.gov': { key: 'gibs', name: 'NASA GIBS' },
  'eonet.gsfc.nasa.gov': { key: 'eonet', name: 'NASA EONET' },
  'api.wheretheiss.at': { key: 'wheretheiss', name: 'wheretheiss.at' },
  'api.open-meteo.com': { key: 'forecast', name: 'Open-Meteo forecast' },
  'geocoding-api.open-meteo.com': { key: 'places', name: 'Open-Meteo place search' },
  'mcp.exa.ai': { key: 'exa', name: 'Exa' },
  'generativelanguage.googleapis.com': { key: 'ai', name: 'Gemini' },
};
const BLOCK = opt('--block', null);
if (args.includes('--block') && !BLOCKABLE[BLOCK]) {
  console.log(`SMOKE FAIL: --block needs one of: ${Object.keys(BLOCKABLE).join(', ')}`);
  process.exit(1);
}
// The M7 first-screen checks run in the default mode (no other mode flag).
const FIRST = !NET && !args.includes('--offline') && !args.includes('--plan') && !args.includes('--oem') && !PATH && !BLOCK && !A11Y && !VOICE && !FORECAST;
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
const out = resolve(opt('--out', OFFLINE ? 'evidence/m3-offline.png' : PLAN ? 'evidence/a1.png' : OEM ? 'evidence/c1.png' : PATH ? 'evidence/m9-path.png' : A11Y ? 'evidence/c3.png' : VOICE ? 'evidence/x3.png' : FORECAST ? 'evidence/x6.png' : BLOCK ? `evidence/m7-block-${BLOCK}.png` : 'evidence/m1.png'));
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
const planFixtures = PLAN || PATH || FIRST || BLOCK || A11Y || VOICE || FORECAST
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
const BM_TILE = /^https:\/\/gibs\.earthdata\.nasa\.gov\/wmts\/epsg3857\/best\/BlueMarble_ShadedRelief_Bathymetry\/default\/GoogleMapsCompatible_Level8\/(\d+)\/(\d+)\/(\d+)\.jpeg$/;
const TRANSPARENT_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const gibsResponses = [];
const bmResponses = [];
const consoleErrors = [];
const pageErrors = [];
const requests = { file: 0, mockedCelestrak: 0, mockedEonet: 0, mockedGibs: 0, blocked: [], network: [], refusedOffline: [] };

const browser = await chromium.launch({ channel: 'chrome', headless: true });
let failed = false;
try {
  // --a11y: reduced motion, so the game's reveal is instant (the page's own prefers-reduced-motion path).
  const context = await browser.newContext({ viewport: { width: w, height: h }, offline: OFFLINE, ...(A11Y ? { reducedMotion: 'reduce' } : {}) });
  const page = await context.newPage();
  // M7: unhandled promise rejections are counted as uncaught errors too.
  await page.addInitScript(() => {
    window.__unhandled = [];
    window.addEventListener('unhandledrejection', (e) => window.__unhandled.push(String(e.reason)));
  });
  // M7 --block of the AI provider: the test key in this tab's sessionStorage (where "keep until this
  // tab is closed" puts it), so "Plan my sighting" calls Gemini, whose host is refused.
  if (BLOCK === 'generativelanguage.googleapis.com')
    await page.addInitScript((k) => sessionStorage.setItem('iss-ride-along-keys', JSON.stringify({ gemini: k })), planFixtures.testKey);
  // X3 --voice: replace the browser's speech with a recorder before the page's own code runs. Each call
  // keeps the spoken text and what the C3 live region held at that moment.
  if (VOICE)
    await page.addInitScript(() => {
      window.__spoken = [];
      const synth = {
        speak: (u) => window.__spoken.push({ text: u.text, region: document.getElementById('where-now')?.textContent ?? null, at: Date.now() }),
        cancel: () => {},
        getVoices: () => [],
        speaking: false,
        pending: false,
        paused: false,
        addEventListener: () => {},
        removeEventListener: () => {},
      };
      Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
    });
  const blockedConsole = [];
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    let host = '';
    try {
      host = new URL(m.location().url).hostname;
    } catch {}
    if (BLOCK && host === BLOCK && /Failed to load resource/.test(m.text())) blockedConsole.push(m.text());
    else consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('response', (r) => {
    const m = GIBS_TILE.exec(r.url());
    if (m) gibsResponses.push({ day: m[1], zyx: `${m[2]}/${m[3]}/${m[4]}`, status: r.status(), kind: r.request().resourceType() });
    const b = BM_TILE.exec(r.url());
    if (b) bmResponses.push({ zyx: `${b[1]}/${b[2]}/${b[3]}`, status: r.status(), kind: r.request().resourceType() });
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
    if (BLOCK && new URL(u).hostname === BLOCK) {
      requests.refusedBlock = (requests.refusedBlock ?? 0) + 1;
      return route.abort('connectionrefused');
    }
    if ((PATH || BLOCK || FIRST || A11Y || VOICE || FORECAST) && u.startsWith('https://api.wheretheiss.at/')) {
      planRequests.wheretheiss = (planRequests.wheretheiss ?? 0) + 1;
      const sample = JSON.parse(readFileSync(resolve('src/data/wheretheiss-samples.json'), 'utf8')).samples[0];
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(sample) });
    }
    const MOCK_PLAN = PLAN || PATH || FIRST || BLOCK || A11Y || VOICE || FORECAST;
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
    const bm = BM_TILE.exec(u);
    if (bm) {
      requests.mockedBlueMarble = (requests.mockedBlueMarble ?? 0) + 1;
      const [z, y, x] = bm.slice(1).map(Number);
      const file = z === 0 ? 'src/data/bluemarble-z0.jpg' : `src/data/bluemarble/${z}-${y}-${x}.jpg`;
      return z <= 2
        ? route.fulfill({ status: 200, contentType: 'image/jpeg', headers: { 'access-control-allow-origin': '*' }, body: readFileSync(resolve(file)) })
        : route.fulfill({ status: 200, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' }, body: TRANSPARENT_PNG });
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
    dailyState: document.body.dataset.daily ?? null,
    dailyDisabled: document.getElementById('daily-toggle')?.disabled ?? null,
    dailyChecked: document.getElementById('daily-toggle')?.checked ?? null,
  }));

  // ---- P2: the cloud-free Blue Marble by default; the dated daily photo one switch away.
  const p2 = { checks: {} };
  if (!OFFLINE) {
    const label = () => page.textContent('#gibs-date');
    const suffix = `${w === 1366 && h === 768 ? '' : `-${w}x${h}`}${NET ? '-net' : ''}`;
    const evidence = (name) => resolve(`evidence/${name}${suffix}.png`);
    mkdirSync(resolve('evidence'), { recursive: true });
    p2.defaultLabel = info.gibsLabel;
    p2.checks.defaultNamesBlueMarble = /NASA Blue Marble, a cloud-free picture of Earth/.test(p2.defaultLabel);
    p2.checks.defaultHasNoDate = !/\d{4}-\d{2}-\d{2}/.test(p2.defaultLabel);
    p2.checks.switchOffAtLoad = info.dailyChecked === false;
    if (BLOCK === 'gibs.earthdata.nasa.gov') {
      p2.checks.switchDisabledWhenBlocked = info.dailyDisabled === true && info.dailyState === 'unavailable';
      // the built-in Blue Marble tiles are on the map (loaded images from the page itself)
      p2.builtInTilesLoaded = await page.$$eval('#map .leaflet-tile-loaded', (ts) => ts.filter((t) => /^(data:|file:)/.test(t.src)).length);
      p2.checks.builtInImageShows = p2.builtInTilesLoaded > 0;
      p2.blockedShot = evidence('p2-gibs-blocked');
      await page.locator('#map').screenshot({ path: p2.blockedShot });
    } else {
      // first screen with the switch off (on a phone the map sits below the fold, so the map itself)
      p2.defaultShot = evidence('p2-default');
      if (w >= 1000) await page.screenshot({ path: p2.defaultShot });
      else await page.locator('#map').screenshot({ path: p2.defaultShot });
      await page.waitForFunction(() => !document.getElementById('daily-toggle').disabled, null, { timeout: 15_000 }).catch(() => {});
      await page.check('#daily-toggle');
      await page.waitForFunction(() => ['loaded', 'failed'].includes(document.body.dataset.daily ?? ''), null, { timeout: 25_000 }).catch(() => {});
      await page.waitForTimeout(NET ? 3000 : 500);
      p2.dailyState = await page.evaluate(() => document.body.dataset.daily ?? null);
      p2.dailyLabel = await label();
      p2.dailyShot = evidence('p2-daily');
      if (w >= 1000) await page.screenshot({ path: p2.dailyShot });
      else await page.locator('#map').screenshot({ path: p2.dailyShot });
      await page.uncheck('#daily-toggle');
      p2.afterOffLabel = await label();
      p2.afterOffState = await page.evaluate(() => document.body.dataset.daily ?? null);
      await page.evaluate(() => window.scrollTo(0, 0));
      p2.checks.switchShowsDatedPhoto = p2.dailyState === 'loaded' && /daily satellite image, \d{4}-\d{2}-\d{2}, not a live camera/.test(p2.dailyLabel);
      p2.checks.switchOffRestoresBlueMarble = p2.afterOffState === 'off' && p2.afterOffLabel === p2.defaultLabel;
    }
  }

  // ---- C2: the night side and the station's sunlight label (every mode).
  const LABEL_RE = /^(in sunlight|in Earth's shadow, sunrise in \d+ min)$/;
  const readC2 = () =>
    page.evaluate(() => {
      const pane = document.querySelector('.leaflet-night-pane');
      const shade = pane?.querySelector('path.night-shade');
      const r = shade?.getBoundingClientRect();
      const m = document.getElementById('map')?.getBoundingClientRect();
      return {
        shadePaths: pane ? pane.querySelectorAll('path.night-shade').length : 0,
        linePaths: pane ? pane.querySelectorAll('path.terminator').length : 0,
        shadeFill: shade ? getComputedStyle(shade).fill : null,
        shadeBox: r ? { w: Math.round(r.width), h: Math.round(r.height) } : null,
        mapBox: m ? { w: Math.round(m.width), h: Math.round(m.height) } : null,
        nightPoints: document.body.dataset.nightPoints ?? null,
        panelLabel: document.getElementById('sunlit')?.textContent ?? '',
        markerLabel: document.querySelector('.iss-icon .iss-sun')?.textContent ?? '',
        sunlit: document.body.dataset.sunlit ?? null,
      };
    });
  const c2 = await readC2();
  c2.checks = {
    shadeDrawn: c2.shadePaths === 1 && c2.linePaths === 1 && c2.nightPoints === '363' && !!c2.shadeBox && c2.shadeBox.w > 0.9 * c2.mapBox.w && c2.shadeBox.h > 20,
    labelAllowed: LABEL_RE.test(c2.panelLabel),
    markerMatchesPanel: c2.markerLabel === c2.panelLabel,
    labelMatchesState: (c2.sunlit === 'true') === (c2.panelLabel === 'in sunlight'),
  };
  if (FIRST) {
    mkdirSync(resolve('evidence'), { recursive: true });
    await page.screenshot({ path: resolve('evidence/c2.png') });
    await page.uncheck('#night-toggle');
    c2.afterToggleOff = (await readC2()).shadePaths;
    await page.check('#night-toggle');
    c2.afterToggleOn = (await readC2()).shadePaths;
    c2.checks.toggleWorks = c2.afterToggleOff === 0 && c2.afterToggleOn === 1;
    // Clicking the toggle scrolls it into view (on a phone it sits below the planner): back to the top
    // so the M7 first-screen checks below see the page as a stranger first does.
    await page.evaluate(() => window.scrollTo(0, 0));
  }

  // ---- X5: the sky from the station (every mode).
  await page.click('#tab-btn-sky');
  await page.waitForFunction(() => !!document.getElementById('sky-canvas')?.dataset.drawnAt, null, { timeout: 10_000 });
  await page.waitForTimeout(1200); // one more redraw: the chart must keep drawing while the tab is open
  const x5 = await page.evaluate(() => {
    const cv = document.getElementById('sky-canvas');
    const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    let bright = 0;
    let painted = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 0) painted++;
      if (d[i] + d[i + 1] + d[i + 2] > 450 && d[i + 3] > 200) bright++;
    }
    const ds = cv.dataset;
    return {
      canvas: { w: cv.width, h: cv.height, cssW: Math.round(cv.getBoundingClientRect().width) },
      painted,
      brightPixels: bright,
      stars: +ds.stars,
      segments: +ds.segments,
      constellations: +ds.constellations,
      zenithRa: +ds.zenithRa,
      zenithDec: +ds.zenithDec,
      stationLat: +ds.stationLat,
      drawnAt: ds.drawnAt,
      sun: ds.sun,
      label: document.getElementById('sky-sunlit')?.textContent ?? '',
      mapLabel: document.getElementById('sunlit')?.textContent ?? '',
      readoutLat: +(document.getElementById('lat')?.textContent ?? 'NaN'),
      zenithText: document.getElementById('sky-zenith')?.textContent ?? '',
      brightText: document.getElementById('sky-bright')?.textContent ?? '',
      ariaLabel: cv.getAttribute('aria-label'),
      tabCredit: document.getElementById('sky-credit')?.textContent ?? '',
      footerCredit: [...document.querySelectorAll('#credits-body li')].map((li) => li.textContent).find((t) => /d3-celestial/.test(t)) ?? '',
      panelShown: !document.getElementById('tab-sky')?.hidden,
    };
  });
  const x5Kind = (t) => (t === 'in sunlight' ? 'sunlit' : /^in Earth's shadow/.test(t) ? 'shadow' : null);
  x5.checks = {
    panelShown: x5.panelShown,
    nonBlank: x5.painted > 0.3 * x5.canvas.w * x5.canvas.h && x5.brightPixels >= 200, // the sky disc fills about 67% of the square
    starsAndLinesDrawn: x5.stars > 300 && x5.segments > 50 && x5.constellations > 5,
    labelAllowed: LABEL_RE.test(x5.label),
    labelAgreesWithMap: x5Kind(x5.label) !== null && x5Kind(x5.label) === x5Kind(x5.mapLabel),
    zenithIsLatitude: Math.abs(x5.zenithDec - x5.stationLat) < 0.001 && Math.abs(x5.stationLat - x5.readoutLat) < 0.3,
    creditsOnPage: /XHIP/.test(x5.tabCredit) && /d3-celestial/.test(x5.tabCredit) && /Not NASA data/.test(x5.tabCredit) && x5.footerCredit === x5.tabCredit,
  };
  if (FIRST) {
    mkdirSync(resolve('evidence'), { recursive: true });
    x5.shot = `evidence/x5${w === 1366 && h === 768 ? '' : `-${w}x${h}`}.png`;
    await page.locator('.sky-card').screenshot({ path: resolve(x5.shot) });
  }
  // ---- X5b: drag and zoom the sky (default mode, any --size). A mouse drag across the chart must move the
  // view centre by more than 5 degrees; a wheel turn must change the field of view; a click on Sirius (or the
  // brightest named star in view) must show its name in #sky-picked; the arrow keys and + must turn and zoom
  // the focused chart; "Back to the station's view" must bring the centre back to the station's straight up
  // (the J2000 centre and straight up are read from the same draw) within 0.1 degree, at 180 degrees across.
  let x5b = null;
  if (FIRST) {
    const sepDeg = (ra1, dec1, ra2, dec2) => {
      const r = Math.PI / 180;
      const hv = Math.sin(((dec2 - dec1) * r) / 2) ** 2 + Math.cos(dec1 * r) * Math.cos(dec2 * r) * Math.sin(((ra2 - ra1) * r) / 2) ** 2;
      return (2 * Math.asin(Math.min(1, Math.sqrt(hv)))) / r;
    };
    const readView = () =>
      page.evaluate(() => {
        const ds = document.getElementById('sky-canvas').dataset;
        return { follow: ds.follow, fov: +ds.fov, ra: +ds.viewRa, dec: +ds.viewDec, upRa: +ds.upRa, upDec: +ds.upDec, bright: JSON.parse(ds.brightInView || '[]'), text: document.getElementById('sky-view')?.textContent ?? '' };
      });
    x5b = {};
    await page.locator('#sky-canvas').scrollIntoViewIfNeeded();
    const box = await page.locator('#sky-canvas').boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    x5b.start = await readView();
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    for (let k = 1; k <= 10; k++) await page.mouse.move(cx + (k / 10) * 0.3 * box.width, cy + (k / 10) * 0.15 * box.height);
    await page.mouse.up();
    await page.waitForTimeout(150);
    x5b.afterDrag = await readView();
    x5b.dragMovedDeg = sepDeg(x5b.start.ra, x5b.start.dec, x5b.afterDrag.ra, x5b.afterDrag.dec);
    await page.mouse.move(cx, cy);
    await page.mouse.wheel(0, -400);
    await page.waitForTimeout(150);
    x5b.afterWheel = await readView();
    const target = x5b.afterWheel.bright.find((s) => s.name === 'Sirius') ?? [...x5b.afterWheel.bright].sort((a, b) => a.mag - b.mag)[0] ?? null;
    x5b.clicked = target?.name ?? null;
    if (target) {
      await page.mouse.click(box.x + target.x, box.y + target.y);
      await page.waitForTimeout(150);
    }
    x5b.pickedText = (await page.textContent('#sky-picked')) ?? '';
    mkdirSync(resolve('evidence'), { recursive: true });
    x5b.shot = `evidence/x5b${w === 1366 && h === 768 ? '' : `-${w}x${h}`}.png`;
    await page.locator('.sky-card').screenshot({ path: resolve(x5b.shot) });
    await page.click('#sky-reset');
    await page.waitForTimeout(150);
    x5b.afterReset = await readView();
    x5b.resetOffDeg = sepDeg(x5b.afterReset.ra, x5b.afterReset.dec, x5b.afterReset.upRa, x5b.afterReset.upDec);
    // Keyboard: focus the chart, one arrow key and one +.
    await page.focus('#sky-canvas');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('+');
    await page.waitForTimeout(100);
    x5b.afterKeys = await readView();
    x5b.keysMovedDeg = sepDeg(x5b.afterReset.ra, x5b.afterReset.dec, x5b.afterKeys.ra, x5b.afterKeys.dec);
    await page.click('#sky-reset');
    await page.waitForTimeout(100);
    x5b.end = await readView();
    x5b.checks = {
      startsFollowingAt180: x5b.start.follow === '1' && x5b.start.fov === 180 && sepDeg(x5b.start.ra, x5b.start.dec, x5b.start.upRa, x5b.start.upDec) < 0.1,
      dragMovesOver5Deg: x5b.afterDrag.follow === '0' && x5b.dragMovedDeg > 5,
      wheelChangesFov: x5b.afterWheel.fov < x5b.afterDrag.fov && x5b.afterWheel.fov >= 30,
      clickNamesStar: !!x5b.clicked && x5b.pickedText.startsWith(`${x5b.clicked}:`),
      resetToStraightUp: x5b.afterReset.follow === '1' && x5b.afterReset.fov === 180 && x5b.resetOffDeg < 0.1,
      keysTurnAndZoom: x5b.afterKeys.follow === '0' && x5b.keysMovedDeg > 5 && x5b.afterKeys.fov < 180,
      backAtEnd: x5b.end.follow === '1' && x5b.end.fov === 180,
    };
    Object.assign(x5.checks, Object.fromEntries(Object.entries(x5b.checks).map(([k, v]) => [`x5b_${k}`, v])));
  }
  await page.click('#tab-btn-nasa');
  await page.evaluate(() => window.scrollTo(0, 0));

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
  let outputs = null;
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
    if (!OUTPUTS) await page.screenshot({ path: out, fullPage: true });
    // ---- --outputs (A2): the calendar download and the printed sheet, each from a click.
    if (OUTPUTS) {
      outputs = {};
      outputs.buttonsShown = await page.isVisible('#plan-outputs');
      await page.locator('#plan-outputs').scrollIntoViewIfNeeded();
      await page.screenshot({ path: resolve('evidence/a2-card.png') });
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 10_000 }), page.click('#out-ics')]);
      outputs.download = dl.suggestedFilename();
      const icsText = readFileSync(await dl.path(), 'utf8');
      const icsLines = icsText.split('\r\n');
      outputs.ics = {
        bytes: Buffer.byteLength(icsText),
        startsCalendar: icsText.startsWith('BEGIN:VCALENDAR\r\n'),
        vevents: (icsText.match(/BEGIN:VEVENT/g) ?? []).length,
        alarm: icsText.replace(/\r\n /g, '').includes('TRIGGER:-PT10M'),
        bareLf: /[^\r]\n/.test(icsText),
        longestLineBytes: Math.max(...icsLines.map((l) => Buffer.byteLength(l))),
        dtstart: /^DTSTART:(\S+)$/m.exec(icsText.replace(/\r/g, ''))?.[1] ?? null,
      };
      outputs.icsNote = await page.textContent('#out-note');
      await page.click('#out-class');
      await page.waitForSelector('#brief-sheet:not([hidden])', { timeout: 5000 });
      outputs.sheetAudit = await page.textContent('#sheet-audit');
      outputs.sheetTitle = await page.textContent('#sheet-body h2');
      await page.emulateMedia({ media: 'print' });
      outputs.print = await page.evaluate(() => {
        const shown = (e) => {
          if (!e) return false;
          const cs = getComputedStyle(e);
          const r = e.getBoundingClientRect();
          return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0;
        };
        const any = (sel) => [...document.querySelectorAll(sel)].some(shown);
        return {
          sheet: shown(document.getElementById('brief-sheet')),
          sheetLines: document.querySelectorAll('#sheet-body li').length,
          questions: [...document.querySelectorAll('#sheet-body ol li')].map((e) => e.textContent),
          mapControls: any('.leaflet-control-container .leaflet-control'),
          map: shown(document.getElementById('map')),
          planner: shown(document.getElementById('plan-form')),
          printButton: shown(document.getElementById('sheet-print')),
        };
      });
      await page.screenshot({ path: resolve('evidence/a2.png'), fullPage: true });
      await page.emulateMedia({ media: 'screen' });
      outputs.screenAgain = { map: await page.isVisible('#map'), mapControls: await page.isVisible('.leaflet-control-zoom') };
      await page.click('#sheet-close');
      outputs.checks = {
        buttonsShown: outputs.buttonsShown,
        downloadName: /^iss-pass-.+\.ics$/.test(outputs.download ?? ''),
        calendarText: outputs.ics.startsCalendar && outputs.ics.vevents === 1 && outputs.ics.alarm && !outputs.ics.bareLf && outputs.ics.longestLineBytes <= 75,
        sheetShowsInPrint: outputs.print.sheet && outputs.print.sheetLines > 0,
        threeQuestionsNoDigits: outputs.print.questions.length === 3 && outputs.print.questions.every((q) => !/\d/.test(q)),
        mapControlsHiddenInPrint: !outputs.print.mapControls && !outputs.print.map && !outputs.print.planner && !outputs.print.printButton,
        sheetAudit0: /^audit: 0 unverified numbers$/.test(outputs.sheetAudit ?? ''),
        screenRestored: outputs.screenAgain.map && outputs.screenAgain.mapControls,
      };
    }
    await page.click('button.example[data-example="trip"]');
    plan.tripNote = await page.textContent('#plan-note');
    // Keys: a run with the typed test key (Gemini mocked), the tick box, a reload, then sessionStorage cleared.
    const k = planFixtures.testKey;
    await page.click('#tab-btn-settings'); // M7: the AI keys box is in the Settings tab
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
  } else if (!OEM && !PATH && !BLOCK && !FIRST) {
    mkdirSync(dirname(out), { recursive: true });
    await page.screenshot({ path: out });
  }

  // ---- M7 first screen (default mode): what a stranger sees before scrolling, then "Detroit" + Enter.
  let first7 = null;
  if (FIRST) {
    first7 = await page.evaluate(() => {
      const box = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) };
      };
      return {
        viewport: { w: window.innerWidth, h: window.innerHeight },
        scrollY: window.scrollY,
        planner: box('section.planner[aria-labelledby="planner-h"]'),
        nextPass: box('#next-pass'),
        nextPassText: document.getElementById('next-pass')?.textContent ?? '',
      };
    });
    const inside = (b) => !!b && b.top >= 0 && b.left >= 0 && b.bottom <= first7.viewport.h && b.right <= first7.viewport.w;
    first7.plannerInside = first7.scrollY === 0 && inside(first7.planner);
    first7.nextPassInside = first7.scrollY === 0 && inside(first7.nextPass);
    mkdirSync(dirname(out), { recursive: true });
    await page.screenshot({ path: out.replace(/\.png$/, '-load.png') });
    // "Detroit" + Enter: the next-pass line must name Detroit, a clock time and a compass word within 2 s.
    await page.fill('#plan-sentence', 'Detroit');
    const t0 = Date.now();
    await page.press('#plan-sentence', 'Enter');
    first7.detroitOk = await page
      .waitForFunction(
        () => {
          const t = document.getElementById('next-pass')?.textContent ?? '';
          return /from Detroit/.test(t) && /\d{1,2}:\d{2}\s?(AM|PM)/.test(t) && /look [a-z-]+ \((N|NNE|NE|ENE|E|ESE|SE|SSE|S|SSW|SW|WSW|W|WNW|NW|NNW)\)/.test(t);
        },
        null,
        { timeout: 2000, polling: 50 },
      )
      .then(() => true)
      .catch(() => false);
    first7.detroitMs = Date.now() - t0;
    first7.detroitText = await page.textContent('#next-pass');
    first7.detroitVisible = await page.isVisible('#next-pass');
    // let the fixed plan finish (mocked services) before the screenshot
    await page.waitForFunction(() => !!document.body.dataset.planKind, null, { timeout: 15_000 }).catch(() => {});
    first7.planNote = await page.textContent('#plan-note');
    first7.planHeadline = await page.textContent('#plan-headline');
    first7.warnings = await page.$$eval('#source-warnings li', (ls) => ls.map((l) => l.textContent));
    // P1: press "Plan my sighting" as well; the Place control and the passes table must then name Detroit.
    await page.evaluate(() => delete document.body.dataset.planKind);
    await page.click('#plan-go');
    await page
      .waitForFunction(() => !!document.body.dataset.planKind && !document.getElementById('plan-go').disabled, null, { timeout: 15_000 })
      .catch(() => {});
    first7.placeAfter = await page.evaluate(() => ({
      placeControl: document.getElementById('plan-place')?.value ?? '',
      tableCaption: document.getElementById('passes-caption')?.textContent ?? '',
      tableShown: !document.getElementById('passes-table')?.hidden,
      tableRows: document.querySelectorAll('#passes-body tr').length,
      cityBox: document.getElementById('city')?.value ?? '',
      planLines: [...document.querySelectorAll('#plan-lines li')].map((l) => l.textContent),
    }));
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: out });
    // Every tab opens its own panel and hides the others.
    first7.tabs = [];
    for (const id of await page.$$eval('.tabs [role="tab"]', (bs) => bs.map((b) => b.dataset.tab))) {
      await page.click(`#tab-btn-${id}`);
      first7.tabs.push(
        await page.evaluate((tid) => {
          const panels = [...document.querySelectorAll('[role="tabpanel"]')];
          const mine = document.getElementById(`tab-${tid}`);
          return {
            id: tid,
            label: document.getElementById(`tab-btn-${tid}`)?.textContent,
            open: !!mine && !mine.hidden && mine.getBoundingClientRect().height > 20,
            othersHidden: panels.filter((p) => p !== mine).every((p) => p.hidden),
            selected: document.getElementById(`tab-btn-${tid}`)?.getAttribute('aria-selected') === 'true',
          };
        }, id),
      );
    }
    first7.hScrollEnd = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    first7.checks = {
      noHorizontalScroll: !info.hScroll && !first7.hScrollEnd,
      plannerInFirstScreen: first7.plannerInside,
      nextPassInFirstScreen: first7.nextPassInside,
      detroitWithin2s: first7.detroitOk && first7.detroitMs <= 2000 && first7.detroitVisible,
      everyTabOpens: first7.tabs.length >= 4 && first7.tabs.every((t) => t.open && t.othersHidden && t.selected),
      noWarnings: first7.warnings.length === 0,
      placeControlReadsDetroit: /^Detroit\b/.test(first7.placeAfter.placeControl),
      passesTableNamesDetroit: /Detroit/.test(first7.placeAfter.tableCaption) && first7.placeAfter.tableShown && first7.placeAfter.tableRows > 0 && /Detroit/.test(first7.placeAfter.cityBox),
    };
  }

  // ---- M6 game (default mode): one scripted round with a recomputed score, then rounds 2 and 3.
  let game6 = null;
  if (FIRST) {
    game6 = { rounds: [] };
    const sizeTag = w === 1366 && h === 768 ? '' : `-${w}x${h}`;
    // Orbit lab line: recompute v = sqrt(GM / r) and T = 2 pi r / v from the height on screen.
    game6.lab = await page.evaluate(() => ({ text: document.getElementById('orbit-lab')?.textContent ?? '', alt: document.getElementById('alt')?.textContent ?? '' }));
    const labM = /^At this height a circular orbit takes (\d+\.\d) min at (\d+\.\d\d) km\/s\.$/.exec(game6.lab.text);
    const rLab = 6378.137 + Number(game6.lab.alt);
    const vLab = Math.sqrt(398600.4418 / rLab);
    game6.lab.recomputed = { min: (2 * Math.PI * rLab) / vLab / 60, kmS: vLab };
    game6.lab.ok = !!labM && Math.abs(Number(labM[1]) - game6.lab.recomputed.min) <= 0.06 && Math.abs(Number(labM[2]) - game6.lab.recomputed.kmS) <= 0.006;
    await page.click('#tab-btn-game');
    game6.boardEmptyAtStart = await page.isVisible('#game-board-empty');
    await page.click('#game-start');
    const satrecNode = satjs.twoline2satrec(...tle.trim().split(/\r?\n/).map((l) => l.trim()).slice(-2));
    const R = 6371.0088;
    const hav = (a, b, c, d) => {
      const r = Math.PI / 180;
      const x = Math.sin(((c - a) * r) / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(((d - b) * r) / 2) ** 2;
      return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
    };
    // Tap points as fractions of the map box (below the bar at the top); the next one is tried if a tap lands on a marker.
    const taps = [[0.62, 0.62], [0.3, 0.7], [0.5, 0.8], [0.8, 0.55]];
    const playRound = async (n) => {
      await page.waitForFunction(() => document.body.dataset.game === 'guessing', null, { timeout: 5000 });
      // "Play" scrolls the map into view smoothly: wait until the map box stops moving before tapping.
      let box = await page.locator('#map').boundingBox();
      for (let k = 0; k < 30; k++) {
        await page.waitForTimeout(100);
        const again = await page.locator('#map').boundingBox();
        if (again.y === box.y && again.x === box.x) break;
        box = again;
      }
      let tapped = false;
      for (let k = 0; k < taps.length && !tapped; k++) {
        const [fx, fy] = taps[(n - 1 + k) % taps.length];
        await page.mouse.click(box.x + fx * box.width, box.y + fy * box.height);
        tapped = await page.waitForFunction(() => document.body.dataset.game !== 'guessing', null, { timeout: 1000 }).then(() => true).catch(() => false);
      }
      await page.waitForFunction(() => ['scored', 'done'].includes(document.body.dataset.game ?? ''), null, { timeout: 8000 });
      const r = await page.evaluate(() => ({ ...document.getElementById('game-bar').dataset, score: document.getElementById('game-score')?.textContent ?? '', msg: document.getElementById('game-msg')?.textContent ?? '', state: document.body.dataset.game }));
      r.n = n;
      r.tapped = tapped;
      r.recomputedKm = hav(+r.guessLat, +r.guessLon, +r.answerLat, +r.answerLon);
      const target = new Date(r.target);
      const pv = satjs.propagate(satrecNode, target);
      const geo = satjs.eciToGeodetic(pv.position, satjs.gstime(target));
      r.nodeAnswer = { lat: satjs.degreesLat(geo.latitude), lon: satjs.degreesLong(geo.longitude) };
      r.checks = {
        scoreShown: /^[\d,]+ km off$/.test(r.score),
        // the shown whole km is the page's distance rounded once; the tap and answer are read to 4 decimals here, so allow 0.5 + 0.1 km
        scoreMatchesRecomputed: Math.abs(+r.km - r.recomputedKm) <= 0.1 && Math.abs(Number(r.score.replace(/[^\d]/g, '')) - r.recomputedKm) <= 0.6,
        answerIsSgp4AtTarget: Math.abs(r.nodeAnswer.lat - +r.answerLat) < 0.001 && Math.abs(r.nodeAnswer.lon - +r.answerLon) < 0.001,
        tenMinutesAhead: Date.parse(r.target) - Date.parse(r.start) === 600_000,
      };
      game6.rounds.push(r);
      return r;
    };
    await playRound(1);
    game6.mapInView = await page.evaluate(() => {
      const b = document.getElementById('map').getBoundingClientRect();
      return b.top >= -1 && b.top < window.innerHeight / 2;
    });
    await page.screenshot({ path: resolve(`evidence/m6${sizeTag}.png`) });
    for (const n of [2, 3]) {
      await page.click('#game-next');
      await playRound(n);
    }
    game6.end = await page.evaluate((key) => ({
      total: document.getElementById('game-bar').dataset.total,
      totalText: document.getElementById('game-total')?.textContent ?? '',
      boardRows: [...document.querySelectorAll('#game-board li')].map((l) => l.textContent),
      boardHeading: document.querySelector('.game-board-h')?.textContent ?? '',
      stored: JSON.parse(localStorage.getItem(key) ?? 'null'),
      startButton: document.getElementById('game-start')?.textContent ?? '',
    }), 'iss-ride-along-game-board');
    await page.locator('#game-board').scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(`evidence/m6-board${sizeTag}.png`) });
    const sum = game6.rounds.reduce((a, r) => a + +r.km, 0);
    game6.checks = {
      labLineMatchesFormula: game6.lab.ok,
      round1ScoreShown: game6.rounds[0].checks.scoreShown && game6.rounds[0].tapped,
      mapInViewForScreenshot: game6.mapInView,
      everyRoundRecomputes: game6.rounds.length === 3 && game6.rounds.every((r) => r.tapped && Object.values(r.checks).every(Boolean)),
      roundsChain: game6.rounds[1].start === game6.rounds[0].target && game6.rounds[2].start === game6.rounds[1].target,
      endsAfter3: game6.rounds[2].state === 'done' && game6.rounds[0].state === 'scored',
      totalIsSum: Math.abs(+game6.end.total - sum) <= 0.2,
      boardLabelledThisDevice: /on this device/.test(game6.end.boardHeading) && game6.boardEmptyAtStart,
      boardHasThisGame: game6.end.boardRows.length === 1 && Array.isArray(game6.end.stored) && game6.end.stored.length === 1 && Math.abs(game6.end.stored[0].totalKm - sum) <= 0.2,
    };
  }

  // ---- M7 --block <host>: one source refused; the page must carry on and say so by name.
  let block7 = null;
  if (BLOCK) {
    const src = BLOCKABLE[BLOCK];
    block7 = { host: BLOCK, source: src.name };
    await page.click('#check-ref');
    await page.waitForFunction(() => !/Asking/.test(document.getElementById('ref-result')?.textContent ?? 'Asking'), null, { timeout: 15_000 });
    block7.refResult = await page.textContent('#ref-result');
    const town = BLOCK === 'geocoding-api.open-meteo.com' ? 'Ann Arbor' : 'Detroit';
    await page.fill('#plan-sentence', town);
    await page.press('#plan-sentence', 'Enter');
    await page.waitForFunction(() => !!document.body.dataset.planKind, null, { timeout: 40_000 }).catch(() => {});
    await page.waitForTimeout(500);
    block7.town = town;
    block7.planNote = await page.textContent('#plan-note');
    block7.planHeadline = await page.textContent('#plan-headline');
    block7.nextPass = await page.textContent('#next-pass');
    // still moving after the failure: the latitude changes within 3 s of this point
    const latNow = (await read()).lat;
    const movesAfter = await page
      .waitForFunction((l) => document.getElementById('lat')?.textContent !== l, latNow, { timeout: 3000, polling: 100 })
      .then(() => true)
      .catch(() => false);
    block7.markerMoves = (first.marker !== second.marker || first.lat !== second.lat) && movesAfter;
    block7.warnings = await page.$$eval('#source-warnings li', (ls) => ls.map((l) => ({ source: l.dataset.source, text: l.textContent })));
    block7.warningVisible = await page.isVisible(`#source-warnings li[data-source="${src.key}"]`);
    block7.unhandled = await page.evaluate(() => window.__unhandled);
    block7.consoleLinesFromRefusedRequests = blockedConsole.length;
    const mine = block7.warnings.find((w) => w.source === src.key);
    block7.checks = {
      requestRefused: (requests.refusedBlock ?? 0) > 0,
      markerMoves: block7.markerMoves,
      warningNamesSource: !!mine && mine.text.includes(src.name) && block7.warningVisible,
      noOtherWarning: block7.warnings.every((w) => w.source === src.key),
      noUncaught: pageErrors.length === 0 && block7.unhandled.length === 0,
    };
    mkdirSync(dirname(out), { recursive: true });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: out });
  }


  // ---- X6 --forecast: the Forecast lab card.
  let x6 = null;
  if (FORECAST) {
    x6 = { checks: {} };
    const MONEY_LINE = 'The planner does not give financial advice. The Forecast lab shows what satellites can and cannot forecast.';
    const urlBefore = page.url();
    await page.click('[data-tab="nasa"]').catch(() => {});
    x6.before = await page.evaluate(() => ({
      buttonText: document.getElementById('forecast-open')?.textContent ?? null,
      cardHidden: document.getElementById('forecast-card')?.hidden ?? null,
      beltLine: document.getElementById('forecast-belt')?.textContent ?? '',
      cornBelt: document.body.dataset.cornBelt ?? null,
    }));
    x6.checks.buttonShown = x6.before.buttonText === 'Forecast lab' && x6.before.cardHidden === true;
    await page.click('#forecast-open');
    await page.waitForFunction(() => {
      const imgs = [...document.querySelectorAll('#forecast-card img[data-ndvi-img]')];
      return !document.getElementById('forecast-card').hidden && imgs.length === 2 && imgs.every((i) => i.complete);
    }, null, { timeout: 10_000 });
    // The card's top at the top of the window, as a reader who just opened it would scroll.
    await page.evaluate(() => document.getElementById('forecast-card').scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(300);
    x6.card = await page.evaluate(() => {
      const card = document.getElementById('forecast-card');
      const label = card.querySelector('[data-fc-label]');
      const lr = label.getBoundingClientRect();
      const cr = card.getBoundingClientRect();
      const clone = card.cloneNode(true);
      clone.querySelector('[data-fc-label]').remove();
      return {
        skillYield: card.querySelector('[data-skill-yield]')?.textContent ?? null,
        skillPrice: card.querySelector('[data-skill-price]')?.textContent ?? null,
        images: [...card.querySelectorAll('img[data-ndvi-img]')].map((i) => ({ day: i.dataset.ndviImg, w: i.naturalWidth, h: i.naturalHeight, shownW: Math.round(i.getBoundingClientRect().width), shownH: Math.round(i.getBoundingClientRect().height) })),
        greenness: [...card.querySelectorAll('[data-ndvi]')].map((g) => g.textContent),
        forecast: card.querySelector('[data-forecast]')?.textContent ?? null,
        chartPaths: [...card.querySelectorAll('svg.fc-chart path')].map((p) => (p.getAttribute('d') ?? '').split(/[ML]/).length - 1),
        label: label.textContent,
        labelRect: { top: Math.round(lr.top), bottom: Math.round(lr.bottom) },
        cardRect: { top: Math.round(cr.top), bottom: Math.round(cr.bottom) },
        viewportH: window.innerHeight,
        innerScroll: card.scrollHeight > card.clientHeight + 1,
        scrollTop: card.scrollTop,
        restText: clone.textContent,
        expanded: document.getElementById('forecast-open').getAttribute('aria-expanded'),
        creditsHaveSources: ['NOAA STAR Vegetation Health', 'MODIS Terra NDVI', 'USDA Economic Research Service', 'International Monetary Fund'].every((w) => document.getElementById('credits').textContent.includes(w)),
      };
    });
    const c = x6.card;
    x6.checks.sameUrl = page.url() === urlBefore;
    x6.checks.opened = c.expanded === 'true';
    x6.checks.skillYield = c.skillYield === '0.57';
    x6.checks.skillPrice = c.skillPrice === '0.00';
    x6.checks.imagesDrawn = c.images.length === 2 && c.images.every((i) => i.w === 256 && i.h === 128 && i.shownW > 0 && i.shownH > 0);
    x6.checks.greenness = c.greenness.length === 2;
    x6.checks.chart = c.chartPaths.length === 3 && c.chartPaths.every((n) => n === 31);
    x6.checks.label = c.label.startsWith('Research demo, not investment advice.') && c.label.includes('This page shows no price forecast.');
    x6.checks.labelVisibleWithoutScrolling = !c.innerScroll && c.scrollTop === 0 && c.labelRect.top >= 0 && c.labelRect.bottom <= c.viewportH && c.labelRect.bottom <= c.cardRect.bottom;
    x6.checks.noPriceOutsideLabel = !/price|\$|dollar|cents|futures|buy|sell/i.test(c.restText);
    x6.checks.credits = c.creditsHaveSources;
    await page.screenshot({ path: out });
    // Step 7 on the page: a money question gets the fixed line and no AI request.
    const geminiBefore = planRequests.gemini;
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.fill('#plan-sentence', 'should I buy corn futures?');
    await page.click('#plan-go');
    await page.waitForFunction(() => document.body.dataset.planDeclined === 'money', null, { timeout: 5_000 }).catch(() => {});
    x6.money = await page.evaluate(() => ({ note: document.getElementById('plan-note').textContent, resultHidden: document.getElementById('plan-result').hidden }));
    x6.checks.moneyLine = x6.money.note === MONEY_LINE && x6.money.resultHidden && planRequests.gemini === geminiBefore;
  }

  // ---- X3 --voice: the toggle, one call per minute with exactly the live region's text, one call per
  // finished plan with exactly the result line, and no toggle when the browser has no speechSynthesis.
  let voice = null;
  if (VOICE) {
    voice = { checks: {} };
    const spoken = () => page.evaluate(() => window.__spoken.map((c) => ({ ...c })));
    voice.toggleBefore = await page.evaluate(() => {
      const t = document.getElementById('voice-toggle');
      return { hidden: t.hidden, visible: t.getBoundingClientRect().width > 0, text: t.textContent, pressed: t.getAttribute('aria-pressed') };
    });
    voice.checks.toggleShown = !voice.toggleBefore.hidden && voice.toggleBefore.visible && voice.toggleBefore.pressed === 'false';
    voice.checks.silentBeforeClick = (await spoken()).length === 0;
    await page.click('#voice-toggle');
    voice.toggleAfter = await page.evaluate(() => ({ text: document.getElementById('voice-toggle').textContent, pressed: document.getElementById('voice-toggle').getAttribute('aria-pressed') }));
    voice.checks.toggleOn = voice.toggleAfter.pressed === 'true';
    const clickedAt = Date.now();
    // The sentence's next 60-second refresh (at most 60 s after load) is spoken.
    await page.waitForFunction(() => window.__spoken.length >= 1, null, { timeout: 70_000 });
    await page.waitForTimeout(2_000);
    const s1 = await spoken();
    voice.minute = { calls: s1.length, text: s1[0]?.text, region: s1[0]?.region, regionNow: await page.textContent('#where-now'), caption: await page.textContent('#voice-text'), afterClickS: Math.round((s1[0]?.at - clickedAt) / 100) / 10 };
    voice.checks.oneMinuteCall = s1.length === 1;
    voice.checks.minuteTextIsRegion = !!s1[0] && s1[0].text === s1[0].region && s1[0].text === voice.minute.regionNow;
    voice.checks.minuteCaption = voice.minute.caption === s1[0]?.text;
    // Two finished plans (fixed plan, no key): one call each, with exactly the result line on the card.
    voice.plans = [];
    for (let i = 1; i <= 2; i++) {
      const before = (await spoken()).length;
      await page.click('#plan-go');
      await page.waitForFunction((n) => window.__spoken.length > n && !document.getElementById('plan-go').disabled, before, { timeout: 30_000 });
      await page.waitForTimeout(500);
      const all = await spoken();
      const card = await page.evaluate(() => ({
        headline: document.getElementById('plan-headline').textContent,
        first: document.querySelector('#plan-lines li')?.textContent ?? null,
        kind: document.body.dataset.planKind,
        caption: document.getElementById('voice-text').textContent,
      }));
      // The card shows "<headline> (fixed plan, no AI)"; the spoken line is the headline and, for a pass, the first line.
      const head = card.headline.replace(/ \((fixed plan, no AI|planned by the AI)\)$/, '');
      const expected = card.kind === 'pass' && card.first ? `${head} ${card.first}` : head;
      voice.plans.push({ newCalls: all.length - before, text: all[all.length - 1].text, expected, caption: card.caption });
    }
    voice.checks.onePerPlan = voice.plans.every((p) => p.newCalls === 1);
    voice.checks.planTextIsResultLine = voice.plans.every((p) => p.text === p.expected && p.caption === p.text);
    voice.totalCalls = (await spoken()).length;
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: out });
    // Turned off: the caption goes away.
    await page.click('#voice-toggle');
    voice.checks.offHidesCaption = await page.evaluate(() => document.getElementById('voice-toggle').getAttribute('aria-pressed') === 'false' && document.getElementById('voice-caption').hidden);
    // A browser with no speechSynthesis at all: same page, every web request answered 503, no toggle.
    const bare = await context.newPage();
    const bareErrors = [];
    bare.on('pageerror', (e) => bareErrors.push(String(e)));
    bare.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && bareErrors.push(m.text()));
    await bare.addInitScript(() => {
      delete Window.prototype.speechSynthesis;
      delete window.speechSynthesis;
    });
    await bare.route('**/*', (route) => {
      const u = route.request().url();
      return u.startsWith('file:') || u.startsWith('data:') || u.startsWith('blob:') ? route.continue() : route.fulfill({ status: 503, headers: { 'access-control-allow-origin': '*' }, body: '' });
    });
    await bare.goto(url, { waitUntil: 'load' });
    await bare.waitForFunction(() => /^-?\d+(\.\d+)?$/.test(document.getElementById('lat')?.textContent ?? ''), null, { timeout: 15_000 });
    voice.noSpeech = await bare.evaluate(() => ({ inWindow: 'speechSynthesis' in window, toggleHidden: document.getElementById('voice-toggle').hidden, toggleWidth: document.getElementById('voice-toggle').getBoundingClientRect().width, sentence: document.getElementById('where-now').textContent }));
    voice.noSpeech.errors = bareErrors;
    voice.checks.noSpeechNoToggle = !voice.noSpeech.inWindow && voice.noSpeech.toggleHidden && voice.noSpeech.toggleWidth === 0 && bareErrors.length === 0 && !!voice.noSpeech.sentence;
    await bare.close();
  }

  // ---- C3 --a11y: live regions, axe-core, keyboard only.
  let a11y = null;
  if (A11Y) {
    a11y = { liveRegions: [], whereChanges: [], axe: [], keyboard: null, game: null };
    // (1) Live regions, watched for 65 s while nothing is pressed.
    a11y.whereTextAtStart = await page.textContent('#where-now');
    await page.evaluate(() => {
      window.__live = [];
      const regions = [...document.querySelectorAll('[aria-live]:not([aria-live="off"]), [role="status"], [role="alert"], [role="log"]')];
      window.__liveIds = regions.map((el, i) => el.id || `${el.tagName.toLowerCase()}#${i}:${el.getAttribute('aria-label') ?? el.className}`);
      regions.forEach((el, i) => {
        let last = el.textContent;
        new MutationObserver(() => {
          if (el.textContent === last) return;
          last = el.textContent;
          window.__live.push({ id: window.__liveIds[i], t: Math.round(performance.now()), text: last.slice(0, 120) });
        }).observe(el, { subtree: true, childList: true, characterData: true });
      });
    });
    const watchStart = Date.now();
    await page.waitForTimeout(65_000);
    a11y.watchedS = Math.round((Date.now() - watchStart) / 1000);
    const live = await page.evaluate(() => ({ ids: window.__liveIds, changes: window.__live }));
    a11y.liveRegions = live.ids;
    a11y.whereChanges = live.changes.filter((c) => c.id === 'where-now');
    a11y.otherLiveChanges = live.changes.filter((c) => c.id !== 'where-now');
    a11y.whereText = await page.textContent('#where-now');

    // (2) axe-core on the first screen and on each tab.
    const axeSource = readFileSync(resolve('node_modules/axe-core/axe.min.js'), 'utf8');
    a11y.axeVersion = JSON.parse(readFileSync(resolve('node_modules/axe-core/package.json'), 'utf8')).version;
    const runAxe = async (state) => {
      if (!(await page.evaluate(() => typeof window.axe === 'object'))) await page.addScriptTag({ content: axeSource });
      const v = await page.evaluate(async () => {
        const r = await window.axe.run(document, { resultTypes: ['violations'] });
        return r.violations.map((x) => ({ id: x.id, impact: x.impact, nodes: x.nodes.length, where: x.nodes.slice(0, 3).map((n) => n.target.join(' ')) }));
      });
      a11y.axe.push({ state, violations: v });
    };
    await runAxe('first screen');
    const tabIds = await page.$$eval('.tabs [role="tab"]', (bs) => bs.map((b) => b.dataset.tab));
    for (const id of tabIds) {
      await page.click(`#tab-btn-${id}`);
      await runAxe(`tab ${id}`);
    }
    await page.click('#tab-btn-nasa');
    await page.evaluate(() => window.scrollTo(0, 0));

    // (3) Keyboard only.
    await page.evaluate(() => {
      window.__clicks = [];
      window.__printed = 0;
      window.print = () => {
        window.__printed++;
      };
      window.__keyOf = (el) =>
        el.id
          ? `#${el.id}`
          : el.dataset.example
            ? `[data-example=${el.dataset.example}]`
            : el.dataset.openTab
              ? `[data-open-tab=${el.dataset.openTab}]`
              : `${el.tagName.toLowerCase()}:${(el.getAttribute('aria-label') || el.textContent).trim().replace(/\s+/g, ' ').slice(0, 40)}`;
      window.__isButton = (el) => !!el && el.matches('button, [role="button"], [role="tab"], summary');
      window.__visibleButtons = () =>
        [...document.querySelectorAll('button, [role="button"], [role="tab"], summary')]
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' && !el.disabled && !el.closest('[hidden]');
          })
          .map(window.__keyOf);
      document.addEventListener(
        'click',
        (e) => {
          const b = e.target.closest?.('button, [role="button"], [role="tab"], summary');
          if (b) window.__clicks.push(window.__keyOf(b));
        },
        true,
      );
      const s = document.createElement('span');
      s.id = '__kb-start';
      s.tabIndex = -1;
      document.body.prepend(s);
    });
    const kb = { passes: [], reached: new Set(), everVisible: new Set(), enterOk: {}, ring: {}, spaceOk: {}, tabPresses: 0 };
    const addVisible = async () => (await page.evaluate(() => window.__visibleButtons())).forEach((k) => kb.everVisible.add(k));
    const focusInfo = () =>
      page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body || el.id === '__kb-start') return null;
        const cs = getComputedStyle(el);
        return {
          key: window.__keyOf(el),
          button: window.__isButton(el),
          linkButton: el.matches('a[role="button"]'),
          disabled: !!el.disabled,
          outline: `${cs.outlineStyle} ${cs.outlineWidth}`,
          ringPx: cs.outlineStyle === 'none' ? 0 : parseFloat(cs.outlineWidth),
        };
      });
    const clickCount = () => page.evaluate(() => window.__clicks.length);
    const clicksSince = (n) => page.evaluate((n) => window.__clicks.slice(n), n);
    const tabTo = async (key, max = 300) => {
      for (let i = 0; i < max; i++) {
        await page.keyboard.press('Tab');
        kb.tabPresses++;
        const f = await focusInfo();
        if (f?.key === key) return true;
      }
      return false;
    };
    // One round per tab: open the tab by keyboard (Tab to it, Enter), then walk the page until a pass presses
    // nothing new (a panel's buttons are only on the page while its tab is open).
    // (The first round leaves the tabs as they are; its walk presses each tab button once.)
    for (const tabId of [null, ...tabIds]) {
    await page.evaluate(() => document.getElementById('__kb-start').focus());
    if (tabId && (await tabTo(`#tab-btn-${tabId}`))) await page.keyboard.press('Enter');
    for (let pass = 1; pass <= 4; pass++) {
      await addVisible();
      await page.evaluate(() => document.getElementById('__kb-start').focus());
      let fresh = 0;
      let firstKey = null;
      let steps = 0;
      for (; steps < 300; steps++) {
        await page.keyboard.press('Tab');
        kb.tabPresses++;
        const f = await focusInfo();
        if (!f) break; // past the last element
        if (steps > 0 && f.key === firstKey) break; // wrapped round
        if (steps === 0) firstKey = f.key;
        if (!f.button || f.disabled) continue;
        kb.reached.add(f.key);
        kb.ring[f.key] = Math.max(kb.ring[f.key] ?? 0, f.ringPx);
        if (f.key in kb.enterOk) continue;
        const n = await clickCount();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(350);
        kb.enterOk[f.key] = (await clicksSince(n)).includes(f.key);
        if (f.linkButton) {
          const still = await focusInfo();
          if (still?.key === f.key) {
            const m = await clickCount();
            await page.keyboard.press(' ');
            await page.waitForTimeout(200);
            kb.spaceOk[f.key] = (await clicksSince(m)).includes(f.key);
          } else kb.spaceOk[f.key] = false;
        }
        fresh++;
        await addVisible();
      }
      kb.passes.push({ tab: tabId, pass, tabs: steps, newButtonsPressed: fresh });
      if (fresh === 0) break;
    }
    }
    // One game round by keyboard: Game tab, Play, Tab to the map, Enter guesses the centre, Enter on Next round.
    const game = { steps: [] };
    await page.evaluate(() => document.getElementById('__kb-start').focus());
    game.steps.push(['Tab to the Game tab', await tabTo('#tab-btn-game')]);
    await page.keyboard.press('Enter');
    game.steps.push(['Tab to Play', await tabTo('#game-start')]);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    game.stateAfterPlay = await page.evaluate(() => document.body.dataset.game);
    game.steps.push(['Tab to the map', await tabTo('#map')]);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => ['scored', 'done'].includes(document.body.dataset.game), null, { timeout: 5000 }).catch(() => {});
    game.stateAfterEnter = await page.evaluate(() => document.body.dataset.game);
    game.score = await page.evaluate(() => document.getElementById('game-score')?.textContent ?? '');
    game.guess = await page.evaluate(() => ({ lat: document.getElementById('game-bar').dataset.guessLat, lon: document.getElementById('game-bar').dataset.guessLon }));
    game.focusAfterScore = (await focusInfo())?.key ?? null;
    if (game.focusAfterScore === '#game-next') {
      // (the page moves focus to Next round after a score; it is pressed with Enter here, not counted as reached by Tab)
      game.nextRingPx = (await focusInfo()).ringPx;
      const n = await clickCount();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
      kb.enterOk['#game-next'] = (await clicksSince(n)).includes('#game-next');
      game.stateAfterNext = await page.evaluate(() => document.body.dataset.game);
    }
    await addVisible();
    game.steps.push(['Tab to Stop', await tabTo('#game-stop')]);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    game.stateAfterStop = await page.evaluate(() => document.body.dataset.game);
    a11y.game = game;
    await page.evaluate(() => document.getElementById('__kb-start')?.remove());
    const reached = [...kb.reached];
    a11y.keyboard = {
      passes: kb.passes,
      tabPresses: kb.tabPresses,
      buttonsVisibleAtSomePoint: kb.everVisible.size,
      reachedByTab: reached.length,
      notReached: [...kb.everVisible].filter((k) => !kb.reached.has(k)),
      enterFailed: Object.entries(kb.enterOk).filter(([, ok]) => !ok).map(([k]) => k),
      enterPressed: Object.keys(kb.enterOk).length,
      noFocusRing: reached.filter((k) => !(kb.ring[k] >= 2)),
      spaceOnLinkButtons: kb.spaceOk,
      printCalls: await page.evaluate(() => window.__printed),
      reachedList: reached,
    };
    await runAxe('after the keyboard run');
    a11y.axeTotals = { serious: 0, critical: 0, moderate: 0, minor: 0 };
    for (const st of a11y.axe) for (const v of st.violations) a11y.axeTotals[v.impact] = (a11y.axeTotals[v.impact] ?? 0) + v.nodes;
    // Evidence: the sentence and a keyboard-focused button on the first screen.
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      const s = document.createElement('span');
      s.id = '__kb-start';
      s.tabIndex = -1;
      document.body.prepend(s);
      s.focus();
    });
    a11y.shotFocus = (await tabTo('#plan-go', 80)) ? '#plan-go' : null;
    await page.evaluate(() => document.getElementById('__kb-start')?.remove());
    mkdirSync(dirname(out), { recursive: true });
    await page.screenshot({ path: out });
    const otherCounts = a11y.otherLiveChanges.reduce((m, c) => ((m[c.id] = (m[c.id] ?? 0) + 1), m), {});
    a11y.checks = {
      sentenceShown: /^(Right over .+|[\d,]+ km (north|northeast|east|southeast|south|southwest|west|northwest) of .+), heading [a-z]+, \d+ km up\.$/.test(a11y.whereText ?? ''),
      watchedAtLeast60s: a11y.watchedS >= 60,
      sentenceAtMostOncePer60s: a11y.whereChanges.length <= 1,
      sentenceRefreshed: a11y.whereChanges.length === 1,
      otherLiveRegionsAtMostOnce: Object.values(otherCounts).every((n) => n <= 1),
      axeNoSerious: a11y.axeTotals.serious === 0,
      axeNoCritical: a11y.axeTotals.critical === 0,
      everyButtonReachedByTab: a11y.keyboard.notReached.length === 0 && a11y.keyboard.reachedByTab > 0,
      everyEnterActivates: a11y.keyboard.enterFailed.length === 0 && a11y.keyboard.enterPressed >= a11y.keyboard.reachedByTab,
      focusRingOnEvery: a11y.keyboard.noFocusRing.length === 0,
      spaceOnZoomButtons: Object.keys(kb.spaceOk).length >= 2 && Object.values(kb.spaceOk).every(Boolean),
      keyboardGameRound:
        game.steps.every(([, ok]) => ok) &&
        game.stateAfterPlay === 'guessing' &&
        game.stateAfterEnter === 'scored' &&
        / km off$/.test(game.score) &&
        game.stateAfterNext === 'guessing' &&
        game.nextRingPx >= 2 &&
        game.stateAfterStop === 'idle',
    };
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
  const bm200 = bmResponses.filter((r) => r.status === 200 && r.kind === 'image');
  const nasaChecks = {
    // P2: on load the map is the cloud-free Blue Marble (the dated daily photo is behind the switch).
    gibsLabelOk: OFFLINE ? /Blue Marble/.test(info.gibsLabel) : BLOCK === 'gibs.earthdata.nasa.gov' ? /Blue Marble.*NASA GIBS could not be reached/.test(info.gibsLabel) : /NASA Blue Marble, a cloud-free picture of Earth/.test(info.gibsLabel),
    gibsTile200: !NET || (tiles200.length > 0 && bm200.length > 0),
    eventsShown: info.eventsListed > 0 && info.eventsStatus.length > 0,
    // M4 fix r1/r2: both event lines name the set they count (open events reported in the last N days).
    eventsSetNamed: /open natural events reported in the last \d+ days/.test(info.eventsStatus) && /(Saved copy from|Live from NASA EONET).* All \d+ open natural events reported in the last \d+ days/.test(info.eventsSource),
    photoShown: info.photo !== null && info.photoLoaded > 0 && /Photo: NASA, Image and Video Library, iss/.test(info.photoCaption),
    creditsOk: info.creditsHasGibs,
  };
  const result = {
    url,
    x5,
    x5b,
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
    outputs,
    clickRun,
    first7,
    game6,
    block7,
    a11y,
    voice,
    x6,
    blockedConsole,
    oem,
    c2,
    p2,
    gibsTiles: { total: gibsResponses.length, status200: tiles200.length, sample: gibsResponses.slice(0, 3) },
    blueMarbleTiles: { total: bmResponses.length, status200: bm200.length, sample: bmResponses.slice(0, 3) },
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
    (OUTPUTS && Object.values(outputs.checks).includes(false)) ||
    (PATH && clickRun.problems.length > 0) ||
    (FIRST && Object.values(first7.checks).includes(false)) ||
    (FIRST && Object.values(game6.checks).includes(false)) ||
    (BLOCK && Object.values(block7.checks).includes(false)) ||
    (A11Y && Object.values(a11y.checks).includes(false)) ||
    (VOICE && Object.values(voice.checks).includes(false)) ||
    (FORECAST && Object.values(x6.checks).includes(false)) ||
    Object.values(oem.checks).includes(false) ||
    Object.values(c2.checks).includes(false) ||
    Object.values(x5.checks).includes(false) ||
    Object.values(p2.checks).includes(false);
  const offlineNote = OFFLINE ? `, network off (${requests.refusedOffline.length} request(s) refused), label says built into this page` : '';
  console.log(
    failed
      ? 'SMOKE FAIL'
      : `SMOKE PASS: #lat ${second.lat}, marker moved, ${info.trackPaths} track paths, 0 console errors${offlineNote}; ` +
          `map label "${info.gibsLabel}"${NET ? `, GIBS tiles HTTP 200: ${bm200.length} Blue Marble, ${tiles200.length} daily photo` : ''}` +
          (p2.dailyLabel ? `; switch on: "${p2.dailyLabel}"; switch off: label back to Blue Marble; ${p2.defaultShot.replace(/.*[\\/]evidence[\\/]/, 'evidence/')}` : '') +
          (p2.checks.switchDisabledWhenBlocked ? `; daily photo switch off and disabled; ${p2.builtInTilesLoaded} built-in Blue Marble tiles on the map` : '') +
          `; ${info.eventsListed} event line(s); photo ${info.photo}` +
          `; day and night: night side drawn (${c2.nightPoints} points), label "${c2.panelLabel}" on the marker and in the panel` +
          (FIRST ? `, toggle off/on ${c2.afterToggleOff}/${c2.afterToggleOn}, evidence/c2.png` : '') +
          `; sky from the station: ${x5.stars} stars, ${x5.segments} line pieces, ${x5.constellations} constellations above its horizon, ${x5.brightPixels} bright pixels, label "${x5.label}" (map "${x5.mapLabel}"), straight up = declination ${x5.zenithDec.toFixed(2)} = station latitude ${x5.stationLat.toFixed(2)}, credits in the tab and the footer${x5.shot ? `, ${x5.shot}` : ''}` +
          (x5b ? `; drag and zoom: a drag moved the view centre ${x5b.dragMovedDeg.toFixed(1)} deg, the wheel took the view from ${x5b.afterDrag.fov.toFixed(1)} to ${x5b.afterWheel.fov.toFixed(1)} deg across, a click on ${x5b.clicked} showed "${x5b.pickedText}", "Back to the station's view" put the centre ${x5b.resetOffDeg.toFixed(4)} deg from straight up at ${x5b.afterReset.fov} deg across, ArrowLeft and + turned it ${x5b.keysMovedDeg.toFixed(1)} deg and zoomed to ${x5b.afterKeys.fov.toFixed(1)} deg, ${x5b.shot}` : '') +
          `; NASA trajectory: ${oem.kmShown} km apart at ${oem.rowTime?.slice(11, 16)} UTC, orbit numbers ${oem.ageShownH} h old` +
          (OEM ? ` (recomputed ${oem.ageRecomputedH?.toFixed(2)} h)` : '') +
          (PLAN ? `; planner: "${plan.buttonText?.trim()}", ${plan.traceRows} trace rows, ${plan.passShown} on the map, "${plan.countdown}", trip note "${plan.tripNote}", keys ok` : '') +
          (OUTPUTS ? `; outputs: download "${outputs.download}" (${outputs.ics.bytes} bytes, 1 VEVENT, TRIGGER:-PT10M, CRLF, longest line ${outputs.ics.longestLineBytes} bytes, DTSTART ${outputs.ics.dtstart}), print view: sheet shown with ${outputs.print.sheetLines} lines and ${outputs.print.questions.length} questions, map and its controls hidden, sheet "${outputs.sheetAudit}"` : '') +
          (PATH ? `; click path: ${clickRun.rows.filter((r) => r.ok).length} of ${clickRun.rows.length} rows done, last timed step at ${clickRun.lastStepAtS} s` : '') +
          (FIRST ? `; first screen ${w}x${h}: no horizontal scroll, planner box and next-pass line inside, "Detroit" + Enter -> "${first7.detroitText}" in ${first7.detroitMs} ms, ${first7.tabs.length} tabs open (${first7.tabs.map((t) => t.label).join(', ')}); after "Plan my sighting": Place control "${first7.placeAfter.placeControl}", passes table "${first7.placeAfter.tableCaption}" (${first7.placeAfter.tableRows} rows), City box "${first7.placeAfter.cityBox}"` : '') +
          (FIRST ? `; game: round 1 "${game6.rounds[0].score}" (recomputed ${game6.rounds[0].recomputedKm.toFixed(1)} km; answer = satellite.js at +10 min), rounds ${game6.rounds.map((r) => r.score).join(' / ')}, ${game6.end.totalText.replace(/ That.*/, '')} on the device board (${game6.end.boardRows.length} row), evidence/m6${w === 1366 && h === 768 ? '' : `-${w}x${h}`}.png; orbit lab "${game6.lab.text}" at ${game6.lab.alt} km (formula ${game6.lab.recomputed.min.toFixed(2)} min, ${game6.lab.recomputed.kmS.toFixed(3)} km/s)` : '') +
          (A11Y ? `; a11y: sentence "${a11y.whereText}" changed ${a11y.whereChanges.length} time(s) in ${a11y.watchedS} s (other live regions: ${a11y.otherLiveChanges.length} change(s)); axe-core ${a11y.axeVersion} on ${a11y.axe.length} page states: ${a11y.axeTotals.critical} critical, ${a11y.axeTotals.serious} serious, ${a11y.axeTotals.moderate} moderate, ${a11y.axeTotals.minor} minor; keyboard: ${a11y.keyboard.reachedByTab} of ${a11y.keyboard.buttonsVisibleAtSomePoint} buttons seen reached by Tab (${a11y.keyboard.tabPresses} Tab presses, ${a11y.keyboard.passes.length} passes), Enter fired ${a11y.keyboard.enterPressed - a11y.keyboard.enterFailed.length} of ${a11y.keyboard.enterPressed}, focus ring on all, Space on ${Object.keys(a11y.keyboard.spaceOnLinkButtons).length} zoom buttons; keyboard game round "${a11y.game.score}"; evidence/c3.png` : '') +
          (VOICE ? `; voice: toggle shown, 1 call ${voice.minute.afterClickS} s after the click with exactly the sentence "${voice.minute.text}", plans: ${voice.plans.map((p) => `${p.newCalls} call "${p.text}"`).join(' / ')}, caption = spoken text, no speechSynthesis -> no toggle; ${voice.totalCalls} calls in all; evidence/x3.png` : '') +
          (FORECAST ? `; forecast lab: the button opened the card in place, [data-skill-yield] ${x6.card.skillYield}, [data-skill-price] ${x6.card.skillPrice}, ${x6.card.images.length} NASA images drawn (${x6.card.images.map((i) => `${i.day} ${i.w}x${i.h} shown ${i.shownW}x${i.shownH}`).join(', ')}), chart lines of ${x6.card.chartPaths.join('/')} points, label at ${x6.card.labelRect.top}-${x6.card.labelRect.bottom} px of a ${x6.card.viewportH} px window with the card at the top and no inner scroll, no price text outside the label, the 4 sources in the credits; "should I buy corn futures?" -> "${x6.money.note}" with 0 AI requests; evidence/x6.png` : '') +
          (BLOCK ? `; blocked ${BLOCK} (${requests.refusedBlock} request(s) refused): warning "${block7.warnings.find((x) => x.source === BLOCKABLE[BLOCK].key)?.text}", marker moved, 0 uncaught errors` : ''),
  );
} finally {
  await browser.close();
}
process.exit(failed ? 1 : 0);
