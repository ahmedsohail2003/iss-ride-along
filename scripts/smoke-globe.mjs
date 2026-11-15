// G1: the 3D globe's checks for scripts/smoke.mjs (--view 3d and --view auto). Kept in their own file so
// smoke.mjs stays readable; smoke.mjs passes in the page, the browser and its own helpers.
//
// Pixels are read from the screen (Playwright screenshots of the canvas, decoded with decodePng), never by
// reading the canvas back later; window.__iss3d's sample() and shade() read one pixel inside the page's own
// draw (PLAN.md 4e, "How a headless check sees the scene").
import { decodePng } from './ndvi-decode.mjs';

const D = Math.PI / 180;
/** Great-circle angle (degrees) between two latitude/longitude points. */
export function sepDeg(lat1, lon1, lat2, lon2) {
  const x = Math.sin(((lat2 - lat1) * D) / 2) ** 2 + Math.cos(lat1 * D) * Math.cos(lat2 * D) * Math.sin(((lon2 - lon1) * D) / 2) ** 2;
  return (2 * Math.asin(Math.min(1, Math.sqrt(x)))) / D;
}
/** The point `distDeg` away from (lat, lon) along `bearingDeg` (0 = north, 90 = east). */
export function destination(lat, lon, bearingDeg, distDeg) {
  const la = lat * D, lo = lon * D, b = bearingDeg * D, d = distDeg * D;
  const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
  const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
  return { lat: la2 / D, lon: ((((lo2 / D + 180) % 360) + 360) % 360) - 180 };
}
const lonDiff = (a, b) => Math.abs(((((a - b + 180) % 360) + 360) % 360) - 180);

/** Screenshot the globe's canvas and decode it. */
async function shot(page, path) {
  const buf = await page.locator('#globe canvas').screenshot(path ? { path } : {});
  return decodePng(buf);
}
/** Per-channel median of the (2k+1)x(2k+1) pixels round the middle. */
function middleMedian(img, k = 4) {
  const cx = Math.floor(img.width / 2), cy = Math.floor(img.height / 2);
  const ch = [[], [], []];
  for (let y = cy - k; y <= cy + k; y++)
    for (let x = cx - k; x <= cx + k; x++) {
      const o = (y * img.width + x) * 4;
      for (let c = 0; c < 3; c++) ch[c].push(img.pixels[o + c]);
    }
  return ch.map((a) => a.sort((p, q) => p - q)[Math.floor(a.length / 2)]);
}
/** Pixels matching `rgb` within `tol` per channel: all of them, and the ones within `r` px of the middle. */
function findColour(img, rgb, tol, r) {
  const cx = img.width / 2, cy = img.height / 2;
  const all = [];
  for (let y = 0; y < img.height; y++)
    for (let x = 0; x < img.width; x++) {
      const o = (y * img.width + x) * 4;
      if (Math.abs(img.pixels[o] - rgb[0]) <= tol && Math.abs(img.pixels[o + 1] - rgb[1]) <= tol && Math.abs(img.pixels[o + 2] - rgb[2]) <= tol) all.push([x + 0.5, y + 0.5]);
    }
  const near = all.filter(([x, y]) => Math.hypot(x - cx, y - cy) <= r);
  const meanX = all.length ? all.reduce((s, p) => s + p[0], 0) / all.length : null;
  return { count: all.length, near: near.length, meanX, midX: cx };
}

const isShown = (page, sel) =>
  page.evaluate((s) => {
    const e = document.querySelector(s);
    if (!e) return false;
    const r = e.getBoundingClientRect();
    return getComputedStyle(e).display !== 'none' && r.width > 0 && r.height > 0;
  }, sel);
const builtInTiles = (page) => page.$$eval('#map .leaflet-tile-loaded', (ts) => ts.filter((t) => /^(data:|file:)/.test(t.src)).length);
const glAlive = (page) =>
  page.evaluate(() => {
    const c = document.querySelector('#globe canvas');
    if (!c || document.body.dataset.view !== '3d') return false;
    const gl = c.getContext('webgl2');
    return !!gl && !gl.isContextLost();
  });

export async function waitForGlobe(page, timeout = 20_000) {
  return page
    .waitForFunction(() => document.body.dataset.view === '3d' && document.getElementById('globe')?.dataset.image === 'loaded' && Number(document.getElementById('globe')?.dataset.frames ?? 0) > 3, null, { timeout })
    .then(() => true)
    .catch(() => false);
}

/**
 * The four-place picture check and the station-marker check (G1, moved here unchanged by R2 so the --gpu run
 * uses the same code): fills g.image and g.marker and returns the four checks.
 */
export async function pictureChecks({ page, g, evidence, STATION }) {
  const C = {};
  // The NASA image, on the sphere and the right way round: night shade off, turnTo, screenshot, middle 9x9.
  await page.uncheck('#night-toggle');
  g.image = [];
  const places = [
    { name: 'Arabia', lat: 23, lon: 45, red: true },
    { name: 'central Australia', lat: -25, lon: 135, red: true },
    { name: 'mid-Atlantic', lat: 23, lon: -45, red: false },
    { name: 'sea south of Japan', lat: 25, lon: 135, red: false },
  ];
  for (const p of places) {
    await page.evaluate(([a, b]) => window.__iss3d.turnTo(a, b), [p.lat, p.lon]);
    await page.waitForTimeout(150);
    const img = await shot(page, p.name === 'Arabia' ? evidence('g1-arabia') : undefined);
    const med = middleMedian(img);
    const smp = await page.evaluate(([a, b]) => window.__iss3d.sample(a, b), [p.lat, p.lon]);
    const diff = med[0] - med[2];
    const ok = p.red ? diff >= 30 : -diff >= 12;
    const sampleAgrees = Math.sign(smp[0] - smp[2]) === Math.sign(diff) && diff !== 0;
    g.image.push({ ...p, screenshotMedian: med, redMinusBlue: diff, sample: smp, ok, sampleAgrees });
  }
  C.imageRightWayRound = g.image.every((r) => r.ok);
  C.sampleAgreesInSign = g.image.every((r) => r.sampleAgrees);

  // The marker where the engine says: turnTo the readout's latitude and longitude, then 30 degrees east.
  const at = await page.evaluate(() => {
    const lat = +document.getElementById('lat').textContent;
    const lon = +document.getElementById('lon').textContent;
    window.__iss3d.turnTo(lat, lon);
    return { lat, lon };
  });
  await page.waitForTimeout(100);
  const m1 = findColour(await shot(page, evidence('g1-marker')), STATION, 24, 3);
  await page.evaluate(([a, b]) => window.__iss3d.turnTo(a, b + 30), [at.lat, at.lon]);
  await page.waitForTimeout(100);
  const img2 = await shot(page);
  const m2 = findColour(img2, STATION, 24, 10);
  g.marker = { at, centred: m1, east30: m2 };
  C.markerAtMiddle = m1.near > 0;
  C.marker30EastNotMiddleAndLeft = m2.near === 0 && m2.count > 0 && m2.meanX < m2.midX;
  await page.check('#night-toggle');
  return C;
}

/**
 * --view 3d, default mode: every G1 globe check that is not the game (smoke.mjs plays the game round itself).
 * `subsolarAt(ms)` is subsolarPoint recomputed in Node (src/orbit/daynight.ts through scripts/load-ts.mjs).
 */
export async function globeChecks({ page, w, h, evidence, subsolarAt }) {
  const g = { checks: {} };
  const C = g.checks;
  g.ready = await waitForGlobe(page);
  const base = await page.evaluate(() => ({
    view: document.body.dataset.view,
    why: document.body.dataset.viewWhy,
    renderer: document.getElementById('globe').dataset.renderer,
    frames: Number(document.getElementById('globe').dataset.frames),
    drawCalls: Number(document.getElementById('globe').dataset.drawCalls),
    mapShown: getComputedStyle(document.getElementById('map')).display !== 'none',
    stationRgb: window.__iss3d?.STATION_RGB ?? null,
    headerH: document.querySelector('header.top').getBoundingClientRect().height,
  }));
  Object.assign(g, base);
  g.webgl = await glAlive(page);
  C.view3d = g.ready && base.view === '3d' && !base.mapShown;
  C.webglContext = g.webgl;
  C.framesOver3 = base.frames > 3;
  C.drawCallsUnder20 = base.drawCalls > 0 && base.drawCalls < 20;
  const STATION = base.stationRgb ?? [255, 0, 255];

  // First screen in 3D: the planner and the next-pass line inside the window at scroll 0, no sideways scroll.
  await page.evaluate(() => window.scrollTo(0, 0));
  g.first = await page.evaluate(() => {
    const box = (sel) => {
      const r = document.querySelector(sel)?.getBoundingClientRect();
      return r ? { top: r.top, bottom: r.bottom, left: r.left, right: r.right } : null;
    };
    return { vw: window.innerWidth, vh: window.innerHeight, scrollY: window.scrollY, planner: box('section.planner[aria-labelledby="planner-h"]'), nextPass: box('#next-pass'), hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth };
  });
  const inside = (b) => !!b && b.top >= 0 && b.left >= 0 && b.bottom <= g.first.vh && b.right <= g.first.vw;
  C.plannerAndNextPassInFirstScreen = g.first.scrollY === 0 && inside(g.first.planner) && inside(g.first.nextPass);
  C.noSidewaysScroll = !g.first.hScroll;
  if (w >= 1000) await page.screenshot({ path: evidence('g1-page') });

  // The station: data-station-lat/lon against #lat/#lon, twice 2.5 s apart.
  const readStation = () =>
    page.evaluate(() => {
      const ds = document.getElementById('globe').dataset;
      return { lat: +ds.stationLat, lon: +ds.stationLon, textLat: +document.getElementById('lat').textContent, textLon: +document.getElementById('lon').textContent };
    });
  g.station1 = await readStation();
  await page.waitForTimeout(2500);
  g.station2 = await readStation();
  const near = (s) => Math.abs(s.lat - s.textLat) <= 0.1 && lonDiff(s.lon, s.textLon) <= 0.1;
  C.stationMatchesReadout = near(g.station1) && near(g.station2);
  C.stationMovesIn2_5s = g.station1.lat !== g.station2.lat || g.station1.lon !== g.station2.lon;

  // The Sun: data-subsolar-lat/lon against subsolarPoint(now) recomputed here.
  const sun = await page.evaluate(() => ({ lat: +document.getElementById('globe').dataset.subsolarLat, lon: +document.getElementById('globe').dataset.subsolarLon, at: Date.now() }));
  const node = subsolarAt(sun.at);
  g.subsolar = { page: sun, node: { lat: node.latDeg, lon: node.lonDeg } };
  C.subsolarMatchesNode = Math.abs(sun.lat - node.latDeg) <= 0.1 && lonDiff(sun.lon, node.lonDeg) <= 0.1;

  // Day and night shading alone (shade(): the image replaced by white, the night shade on).
  const shade = (lat, lon) => page.evaluate(([a, b]) => window.__iss3d.shade(a, b), [lat, lon]);
  const anti = { lat: -sun.lat, lon: ((sun.lon + 360) % 360) - 180 };
  g.shade = { subsolar: await shade(sun.lat, sun.lon), opposite: await shade(anti.lat, anti.lon), pairs: [] };
  for (const bearing of [0, 90, 180, 270]) {
    const day = destination(sun.lat, sun.lon, bearing, 90 - 12);
    const night = destination(sun.lat, sun.lon, bearing, 90 + 12);
    g.shade.pairs.push({ bearing, day: await shade(day.lat, day.lon), night: await shade(night.lat, night.lon) });
  }
  C.shadeSubsolarOver200 = g.shade.subsolar > 200;
  C.shadeOppositeUnder60 = g.shade.opposite < 60;
  C.shadeDayBrighterThanNight = g.shade.pairs.every((p) => p.day > p.night);

  g.trackPoints = await page.evaluate(() => Number(document.getElementById('globe').dataset.trackPoints));
  C.trackPointsOver300 = g.trackPoints > 300;

  // The NASA image at four places and the marker where the engine says (pictureChecks, shared with R2's --gpu run).
  Object.assign(C, await pictureChecks({ page, g, evidence, STATION }));

  // A drag turns the view, not the station; it draws every frame while dragged.
  await page.evaluate(() => window.__iss3d.turnTo(20, -40));
  const box = await page.locator('#globe canvas').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  const c0 = await page.evaluate(() => window.__iss3d.centre());
  const f0 = await page.evaluate(() => Number(document.getElementById('globe').dataset.frames));
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  const t0 = Date.now();
  for (let k = 1; k <= 15; k++) {
    await page.mouse.move(cx + (k / 15) * 0.3 * box.width, cy + (k / 15) * 0.1 * box.height);
    await page.waitForTimeout(Math.max(0, t0 + k * 33 - Date.now()));
  }
  const f1 = await page.evaluate(() => Number(document.getElementById('globe').dataset.frames));
  const dragMs = Date.now() - t0;
  await page.mouse.up();
  const c1 = await page.evaluate(() => window.__iss3d.centre());
  const st = await readStation();
  g.drag = { from: c0, to: c1, movedDeg: sepDeg(c0.lat, c0.lon, c1.lat, c1.lon), framesDuring: f1 - f0, dragMs, station: st };
  C.dragMovesCentreOver5 = g.drag.movedDeg > 5;
  C.dragLeavesStation = near(st);
  C.dragDrawsEveryFrame = g.drag.framesDuring >= 10;
  await page.screenshot({ path: evidence('g1-drag'), fullPage: false });

  // The switch: Flat page shows the map (built-in tiles, 2 orbit lines, the night shade); 3D brings the globe back.
  await page.click('#view-flat');
  await page.waitForTimeout(400);
  g.flat = await page.evaluate(() => ({
    view: document.body.dataset.view,
    tracks: document.querySelectorAll('.leaflet-overlay-pane path.track-line').length,
    night: document.querySelectorAll('.leaflet-night-pane path.night-shade').length,
    headerH: document.querySelector('header.top').getBoundingClientRect().height,
  }));
  // G2: the new look keeps the header no taller than the flat page's (the planner stays on the first screen)
  g.header = { h3d: base.headerH, hFlat: g.flat.headerH };
  C.headerNoTallerIn3d = g.header.h3d <= g.header.hFlat;
  g.flat.mapShown = await isShown(page, '#map');
  g.flat.globeShown = await isShown(page, '#globe');
  g.flat.tiles = await builtInTiles(page);
  C.flatPageShowsMap = g.flat.view === 'flat' && g.flat.mapShown && !g.flat.globeShown && g.flat.tiles > 0 && g.flat.tracks === 2 && g.flat.night === 1;
  await page.click('#view-3d');
  await page.waitForTimeout(400);
  g.back = { view: await page.evaluate(() => document.body.dataset.view), globeShown: await isShown(page, '#globe'), webgl: await glAlive(page) };
  C.view3dBringsGlobeBack = g.back.view === '3d' && g.back.globeShown && g.back.webgl;

  // Ticking the daily photo in 3D lands on the flat map, dated.
  await page.check('#daily-toggle');
  await page.waitForFunction(() => ['loaded', 'failed'].includes(document.body.dataset.daily ?? ''), null, { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(300);
  g.daily = await page.evaluate(() => ({ view: document.body.dataset.view, why: document.body.dataset.viewWhy, label: document.getElementById('gibs-date').textContent, daily: document.body.dataset.daily }));
  g.daily.mapShown = await isShown(page, '#map');
  C.dailyToggleLandsOnFlatDated = g.daily.view === 'flat' && g.daily.mapShown && /\d{4}-\d{2}-\d{2}/.test(g.daily.label);
  await page.uncheck('#daily-toggle');
  await page.click('#view-3d');
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, 0));
  return g;
}

/** --view 3d --a11y: the globe's own keyboard checks (run before the walk). */
export async function globeKeyboard(page) {
  const k = {};
  // Reached by the keyboard (Tab from the button before it), so the focus ring is the one a keyboard user sees.
  await page.focus('#view-flat');
  await page.keyboard.press('Tab');
  k.ringPx = await page.evaluate(() => {
    const cs = getComputedStyle(document.activeElement);
    return document.activeElement.id === 'globe' && cs.outlineStyle !== 'none' ? parseFloat(cs.outlineWidth) : 0;
  });
  const c0 = await page.evaluate(() => window.__iss3d.centre());
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(600);
  const c1 = await page.evaluate(() => window.__iss3d.centre());
  k.arrowMovedDeg = sepDeg(c0.lat, c0.lon, c1.lat, c1.lon);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(400);
  return k;
}

/**
 * G2 --view 3d --plan: before "Plan my sighting" is pressed, watch #globe for the pass arriving
 * (data-pass-points set by setPass). From that moment this script, not the page, counts the frames drawn in
 * the first 0.5 s and reads centre() every 50 ms for 2 s.
 */
export async function armTurnWatch(page) {
  await page.evaluate(() => {
    const host = document.getElementById('globe');
    window.__turnWatch = null;
    const mo = new MutationObserver(() => {
      if (window.__turnWatch || !(Number(host.dataset.passPoints) > 0)) return;
      mo.disconnect();
      const t0 = performance.now();
      const w = (window.__turnWatch = { f0: Number(host.dataset.frames), f500: null, centres: [] });
      setTimeout(() => (w.f500 = Number(host.dataset.frames)), 500);
      const poll = () => {
        const c = window.__iss3d.centre();
        w.centres.push({ ms: Math.round(performance.now() - t0), lat: c?.lat ?? null, lon: c?.lon ?? null });
        if (performance.now() - t0 < 2000) setTimeout(poll, 50);
      };
      poll();
    });
    mo.observe(host, { attributes: true, attributeFilter: ['data-pass-points'] });
  });
}

/**
 * G2 --view 3d --plan, after the fixed plan: the pass on the globe against the engine run here in Node (the
 * page's own TypeScript through scripts/load-ts.mjs, the TLE the mocked CelesTrak reply serves): the pass is
 * recomputed for the planned place from the moment the button was pressed.
 */
export async function globePassChecks({ page, clickAt, tle, orbit, passes, places }) {
  const r = { checks: {} };
  const C = r.checks;
  await page.waitForFunction(() => window.__turnWatch && window.__turnWatch.f500 !== null && window.__turnWatch.centres.at(-1)?.ms >= 2000, null, { timeout: 10_000 }).catch(() => {});
  const got = await page.evaluate(() => ({
    watch: window.__turnWatch,
    pass: window.__iss3d?.pass() ?? null,
    ds: { ...document.getElementById('globe').dataset },
    placeInput: document.getElementById('plan-place')?.value ?? '',
    passShown: document.body.dataset.passShown ?? null,
  }));
  r.passShown = got.passShown;
  r.points = Number(got.ds.passPoints);
  C.passPointsOver10 = r.points > 10 && got.pass?.points.length === r.points;
  // the planned place: the fixed plan's place box (empty means Ypsilanti), from the page's built-in list
  const name = got.placeInput.trim() || 'Ypsilanti';
  const place = places.builtInMatches(name)[0];
  r.place = place ? { name: place.name, lat: place.latDeg, lon: place.lonDeg } : { name, lat: null, lon: null };
  r.city = { lat: Number(got.ds.cityLat), lon: Number(got.ds.cityLon) };
  C.cityIsPlannedPlace = !!place && Math.abs(r.city.lat - place.latDeg) <= 0.01 && lonDiff(r.city.lon, place.lonDeg) <= 0.01 && (got.passShown ?? '').startsWith(`${place.id}-`);
  // the pass recomputed in Node from the press of the button: the one that starts when the globe's arc starts
  const satrec = orbit.satrecFromTle(tle);
  const found = place ? passes.predictForPlace(satrec, { name: place.name, latDeg: place.latDeg, lonDeg: place.lonDeg, heightM: place.heightM }, new Date(clickAt), 7).passes : [];
  const pts = got.pass?.points ?? [];
  const first = pts[0];
  const last = pts.at(-1);
  const p = first ? found.find((q) => Math.abs(q.start.getTime() - Date.parse(first.t)) <= 5000) : null;
  r.nodePasses = found.length;
  if (p && first && last) {
    const rise = orbit.stateAt(satrec, p.start);
    const set = orbit.stateAt(satrec, p.end);
    const peak = orbit.stateAt(satrec, p.peak);
    r.node = { start: p.start.toISOString().slice(0, 19), end: p.end.toISOString().slice(0, 19), peak: p.peak.toISOString().slice(0, 19), peakLat: peak.latDeg, peakLon: peak.lonDeg };
    r.firstOffDeg = sepDeg(first.lat, first.lon, rise.latDeg, rise.lonDeg);
    r.lastOffDeg = sepDeg(last.lat, last.lon, set.latDeg, set.lonDeg);
    C.firstPointIsRise = r.firstOffDeg <= 0.1;
    C.lastPointIsSet = r.lastOffDeg <= 0.1;
    const w = got.watch;
    const offs = (w?.centres ?? []).filter((c) => c.lat !== null).map((c) => ({ ms: c.ms, off: sepDeg(c.lat, c.lon, peak.latDeg, peak.lonDeg) }));
    r.reachedMs = offs.find((c) => c.off <= 5)?.ms ?? null;
    r.finalOffDeg = offs.at(-1)?.off ?? 999;
    r.centreTrace = offs.filter((_, i) => i % 4 === 0).map((c) => `${c.ms}:${c.off.toFixed(1)}`);
    C.centreOnHighestPointWithin2s = r.reachedMs !== null && r.reachedMs <= 2000 && r.finalOffDeg <= 5;
    r.framesIn500 = w && w.f500 !== null ? w.f500 - w.f0 : null;
    C.framesInFirst500msAtLeast8 = r.framesIn500 !== null && r.framesIn500 >= 8;
  } else {
    r.firstOffDeg = r.lastOffDeg = r.finalOffDeg = 999;
    r.node = { start: null, end: null };
    r.problem = `no pass recomputed in Node starts at the globe arc's first point (${first?.t ?? 'none'}); Node found ${found.length}`;
    C.firstPointIsRise = C.lastPointIsSet = C.centreOnHighestPointWithin2s = C.framesInFirst500msAtLeast8 = false;
  }
  return r;
}

/**
 * --view auto: the four fallback cases, each in its own browser context of the same (SwiftShader) browser.
 * `newPage(contextOptions, initScript)` makes a page with smoke.mjs's mocked network and error counters.
 */
export async function autoCases({ newPage, baseUrl }) {
  const cases = [];
  const withView = (v) => {
    const u = new URL(baseUrl);
    u.searchParams.set('view', v);
    return u.href;
  };
  // G2: DEFAULT_VIEW is 'auto', so cases 1 to 3 and the two below open the plain address with no flag.
  const plain = (() => {
    const u = new URL(baseUrl);
    u.searchParams.delete('view');
    return u.href;
  })();
  const decided = (page) => page.waitForFunction(() => !!document.body.dataset.viewWhy, null, { timeout: 15_000 }).then(() => true).catch(() => false);
  const state = (page) =>
    page.evaluate(() => ({ view: document.body.dataset.view, why: document.body.dataset.viewWhy, note: !document.getElementById('view-note').hidden && document.getElementById('view-note').getBoundingClientRect().height > 0, noteText: document.getElementById('view-note').textContent, probe: document.body.dataset.viewProbe ?? null }));

  // (1) WebGL made unavailable.
  {
    const { page, errors, close } = await newPage({}, () => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        return /webgl/i.test(type) ? null : orig.call(this, type, ...rest);
      };
    });
    await page.goto(plain, { waitUntil: 'load' });
    const c = { name: 'no WebGL', decided: await decided(page) };
    c.atLoad = await state(page);
    await page.click('#view-3d');
    await page.waitForTimeout(500);
    c.afterPress = await state(page);
    c.consoleErrors = [...errors];
    c.ok = c.atLoad.view === 'flat' && c.atLoad.why === 'no-webgl' && c.atLoad.note && c.afterPress.view === 'flat' && c.afterPress.why === 'no-webgl' && c.afterPress.note && errors.length === 0;
    cases.push(c);
    await close();
  }
  // (2) Reduced motion.
  {
    const { page, errors, close } = await newPage({ reducedMotion: 'reduce' });
    await page.goto(plain, { waitUntil: 'load' });
    const c = { name: 'reduced motion', decided: await decided(page) };
    c.atLoad = await state(page);
    // R2: pressing 3D from this flat start faces the station: the globe's centre within 5 degrees of it.
    await page.click('#view-3d');
    c.globe = await waitForGlobe(page);
    c.pressed = await pressCentre(page);
    c.consoleErrors = [...errors];
    c.ok = c.atLoad.view === 'flat' && c.atLoad.why === 'reduced-motion' && c.globe && c.pressed.view === '3d' && c.pressed.why === 'press' && c.pressed.offDeg !== null && c.pressed.offDeg <= 5 && errors.length === 0;
    cases.push(c);
    await close();
  }
  // (3) The software renderer as launched (no stand-ins): every context the page made is released.
  {
    const { page, errors, close } = await newPage({}, () => {
      window.__glContexts = [];
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        const ctx = orig.call(this, type, ...rest);
        if (ctx && /webgl/i.test(type) && !window.__glContexts.includes(ctx)) window.__glContexts.push(ctx);
        return ctx;
      };
    });
    const t0 = Date.now();
    await page.goto(plain, { waitUntil: 'load' });
    const c = { name: 'software renderer', decided: await decided(page) };
    await page.waitForTimeout(Math.max(0, t0 + 2000 - Date.now()));
    c.at2s = await state(page);
    await page.waitForTimeout(Math.max(0, t0 + 10_000 - Date.now()));
    c.at10s = await state(page);
    c.contexts = await page.evaluate(() => window.__glContexts.map((g) => ({ lost: g.isContextLost() })));
    c.consoleErrors = [...errors];
    c.ok =
      c.at2s.view === 'flat' && ['software', 'caveat'].includes(c.at2s.why) && c.at2s.note &&
      c.at10s.view === c.at2s.view && c.at10s.why === c.at2s.why &&
      c.contexts.length >= 1 && c.contexts.every((x) => x.lost) && errors.length === 0;
    cases.push(c);
    await close();
  }
  // (4) ?view=3d, then the context is lost: the flat map within 1 s, its tiles showing.
  {
    const { page, errors, close } = await newPage({});
    await page.goto(withView('3d'), { waitUntil: 'load' });
    const c = { name: 'context lost', globe: await waitForGlobe(page) };
    c.before = await state(page);
    const ms = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const t = performance.now();
          document.querySelector('#globe canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext();
          const check = () => (document.body.dataset.view === 'flat' ? resolve(performance.now() - t) : performance.now() - t > 3000 ? resolve(null) : requestAnimationFrame(check));
          check();
        }),
    );
    c.flatAfterMs = ms === null ? null : Math.round(ms);
    await page.waitForTimeout(500);
    c.after = await state(page);
    c.mapShown = await isShown(page, '#map');
    c.tiles = await builtInTiles(page);
    c.consoleErrors = [...errors];
    c.ok = c.globe && c.before.view === '3d' && c.flatAfterMs !== null && c.flatAfterMs <= 1000 && c.after.view === 'flat' && c.after.why === 'lost' && c.mapShown && c.tiles > 0 && errors.length === 0;
    cases.push(c);
    await close();
  }
  // (5) and (6) G2: the good and the slow branch end to end. Stand-ins that live only in this script: the
  // renderer name is answered as a hardware one, the caveat attribute is removed from the page's request, and
  // the frame timestamps the page's requestAnimationFrame callbacks get are handed out by this script, `gap` ms
  // apart per real frame (every callback in one frame gets the same stamp, as in a browser).
  for (const [gap, name] of [[16, 'good device'], [40, 'slow device']]) {
    const { page, errors, close } = await newPage({}, (gapMs) => {
      window.__glContexts = [];
      const HW = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)';
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, attrs, ...rest) {
        let a = attrs;
        if (a && typeof a === 'object' && 'failIfMajorPerformanceCaveat' in a) {
          a = { ...a };
          delete a.failIfMajorPerformanceCaveat;
        }
        const ctx = a === undefined ? orig.call(this, type) : orig.call(this, type, a, ...rest);
        if (ctx && /webgl/i.test(type) && !window.__glContexts.includes(ctx)) window.__glContexts.push(ctx);
        return ctx;
      };
      const gp = WebGL2RenderingContext.prototype.getParameter;
      WebGL2RenderingContext.prototype.getParameter = function (pname) {
        const ext = this.getExtension('WEBGL_debug_renderer_info');
        if (ext && pname === ext.UNMASKED_RENDERER_WEBGL) return HW;
        return gp.call(this, pname);
      };
      const raf = window.requestAnimationFrame.bind(window);
      let lastReal = -1;
      let fake = 0;
      window.requestAnimationFrame = (cb) =>
        raf((real) => {
          if (real !== lastReal) {
            lastReal = real;
            fake += gapMs;
          }
          cb(fake);
        });
    }, gap);
    const live = () => page.evaluate(() => window.__glContexts.filter((g) => !g.isContextLost()).length);
    const t0 = Date.now();
    await page.goto(plain, { waitUntil: 'load' });
    const c = { name, gapMs: gap, decided: await decided(page) };
    await page.waitForTimeout(Math.max(0, t0 + 2000 - Date.now()));
    c.at2s = await state(page);
    c.live2s = await live();
    await page.waitForTimeout(Math.max(0, t0 + 10_000 - Date.now()));
    c.at10s = await state(page);
    c.live10s = await live();
    c.contexts = await page.evaluate(() => window.__glContexts.length);
    c.renderer = await page.evaluate(() => document.getElementById('globe')?.dataset.renderer ?? null);
    c.consoleErrors = [...errors];
    c.ok =
      gap === 16
        ? c.at2s.view === '3d' && c.at10s.view === '3d' && c.at2s.why === 'auto' && c.at10s.why === 'auto' && c.live2s === 1 && c.live10s === 1 && errors.length === 0
        : c.at2s.view === 'flat' && c.at2s.why === 'slow' && c.at10s.view === 'flat' && c.at10s.why === 'slow' && c.at2s.note && c.contexts >= 1 && c.live2s === 0 && c.live10s === 0 && errors.length === 0;
    cases.push(c);
    await close();
  }
  // (7) R2: no frames delivered at load (a page the browser is not drawing). The same stand-ins as (5), and this
  // script also holds back every requestAnimationFrame callback until it lets frames through. At load: flat,
  // why not "slow", no "too slow" text anywhere on the page. Then the page is hidden (no re-run: it is not a
  // change to visible), frames are let through and the page is made visible again: 3D with why "auto".
  {
    const { page, errors, close } = await newPage({}, () => {
      window.__glContexts = [];
      const HW = 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)';
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, attrs, ...rest) {
        let a = attrs;
        if (a && typeof a === 'object' && 'failIfMajorPerformanceCaveat' in a) {
          a = { ...a };
          delete a.failIfMajorPerformanceCaveat;
        }
        const ctx = a === undefined ? orig.call(this, type) : orig.call(this, type, a, ...rest);
        if (ctx && /webgl/i.test(type) && !window.__glContexts.includes(ctx)) window.__glContexts.push(ctx);
        return ctx;
      };
      const gp = WebGL2RenderingContext.prototype.getParameter;
      WebGL2RenderingContext.prototype.getParameter = function (pname) {
        const ext = this.getExtension('WEBGL_debug_renderer_info');
        if (ext && pname === ext.UNMASKED_RENDERER_WEBGL) return HW;
        return gp.call(this, pname);
      };
      window.__vis = 'visible';
      Object.defineProperty(document, 'visibilityState', { get: () => window.__vis, configurable: true });
      Object.defineProperty(document, 'hidden', { get: () => window.__vis !== 'visible', configurable: true });
      window.__setVis = (v) => {
        window.__vis = v;
        document.dispatchEvent(new Event('visibilitychange'));
      };
      const raf = window.requestAnimationFrame.bind(window);
      let lastReal = -1;
      let fake = 0;
      const held = [];
      window.__frames = false;
      window.__heldFrames = 0;
      const run = (cb) =>
        raf((real) => {
          if (real !== lastReal) {
            lastReal = real;
            fake += 16;
          }
          cb(fake);
        });
      window.requestAnimationFrame = (cb) => {
        if (window.__frames) return run(cb);
        held.push(cb);
        window.__heldFrames++;
        return 0;
      };
      window.__letFramesThrough = () => {
        window.__frames = true;
        held.splice(0).forEach(run);
      };
    });
    const live = () => page.evaluate(() => window.__glContexts.filter((g) => !g.isContextLost()).length);
    const tooSlowText = () => page.evaluate(() => /too slow/i.test(document.body.innerText));
    const t0 = Date.now();
    await page.goto(plain, { waitUntil: 'load' });
    const c = { name: 'no frames at load', decided: await decided(page) };
    await page.waitForTimeout(Math.max(0, t0 + 3000 - Date.now()));
    c.atLoad = await state(page);
    c.atLoad.tooSlowText = await tooSlowText();
    c.atLoad.heldFrames = await page.evaluate(() => window.__heldFrames);
    c.liveAtLoad = await live();
    await page.evaluate(() => window.__setVis('hidden'));
    await page.waitForTimeout(500);
    c.whileHidden = await state(page);
    await page.evaluate(() => {
      window.__letFramesThrough();
      window.__setVis('visible');
    });
    const t1 = Date.now();
    c.switched = await page.waitForFunction(() => document.body.dataset.view === '3d', null, { timeout: 5000 }).then(() => true).catch(() => false);
    c.switchMs = Date.now() - t1;
    await page.waitForTimeout(1000);
    c.after = await state(page);
    c.after.tooSlowText = await tooSlowText();
    c.liveAfter = await live();
    c.contexts = await page.evaluate(() => window.__glContexts.length);
    c.consoleErrors = [...errors];
    c.ok =
      c.atLoad.view === 'flat' && c.atLoad.why !== 'slow' && c.atLoad.why === 'no-frames' && !c.atLoad.note && !c.atLoad.tooSlowText && c.atLoad.heldFrames > 0 && c.liveAtLoad === 0 &&
      c.whileHidden.view === 'flat' && c.whileHidden.why === 'no-frames' &&
      c.switched && c.after.view === '3d' && c.after.why === 'auto' && !c.after.tooSlowText && c.liveAfter === 1 && c.contexts === 2 && errors.length === 0;
    cases.push(c);
    await close();
  }
  return cases;
}

/** R2: the view, its reason, and the globe's centre against the station (degrees apart) right after a press. */
export async function pressCentre(page) {
  return page.evaluate(() => {
    const ds = document.getElementById('globe').dataset;
    const c = window.__iss3d?.centre() ?? null;
    return { view: document.body.dataset.view, why: document.body.dataset.viewWhy, centre: c, station: { lat: +ds.stationLat, lon: +ds.stationLon } };
  }).then((r) => ({ ...r, offDeg: r.centre ? sepDeg(r.centre.lat, r.centre.lon, r.station.lat, r.station.lon) : null }));
}

/**
 * G3 --view 3d --story: the stars and the scroll story. data-stars is 1627; scrolling each #scene-<id> into view
 * sets #globe[data-scene] to that id within 2 s; in "now" centre() comes within 5 degrees of data-station-lat/lon,
 * and in "daynight" the dot product of centre() with the Sun's direction (from data-subsolar-lat/lon) within 0.15
 * of zero (each given 3 s more to ease there); the height in #scene-now is the text of #alt; while the story is on
 * screen the canvas is fixed to the whole window and no ancestor carries a transform; no sideways scroll; after a
 * scripted 3-second scroll through the story the median frameMs() of the frames it drew is printed; scrolling back
 * to the top puts the canvas back in its slot.
 */
export async function storyChecks({ page, evidence }) {
  const s = { scenes: [], checks: {} };
  s.globeShown = await waitForGlobe(page);
  s.stars = await page.evaluate(() => document.getElementById('globe').dataset.stars);
  s.ids = await page.$$eval('#story .scene', (es) => es.map((e) => e.id));
  const ids = ['now', 'orbit', 'daynight', 'view', 'sky', 'real'];
  const unitOf = (lat, lon) => [Math.cos(lat * D) * Math.cos(lon * D), Math.sin(lat * D), -Math.cos(lat * D) * Math.sin(lon * D)];
  const state = () =>
    page.evaluate(() => {
      const g = document.getElementById('globe');
      const c = g.querySelector('canvas');
      const r = c.getBoundingClientRect();
      const anc = [];
      for (let e = c.parentElement; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (cs.transform !== 'none' || cs.filter !== 'none' || (cs.contain && /paint|layout|strict|content/.test(cs.contain)) || cs.willChange.includes('transform')) anc.push(e.id || e.tagName);
      }
      return {
        scene: g.dataset.scene,
        centre: window.__iss3d.centre(),
        station: { lat: Number(g.dataset.stationLat), lon: Number(g.dataset.stationLon) },
        sun: { lat: Number(g.dataset.subsolarLat), lon: Number(g.dataset.subsolarLon) },
        storyOn: document.body.classList.contains('story-on'),
        canvas: { position: getComputedStyle(c).position, w: r.width, h: r.height, top: r.top, left: r.left, pointer: getComputedStyle(c).pointerEvents },
        win: { w: document.documentElement.clientWidth, h: window.innerHeight },
        transformedAncestors: anc,
        hScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        altText: document.getElementById('alt').textContent,
        storyAlt: document.getElementById('story-alt')?.textContent ?? null,
        frames: Number(g.dataset.frames),
      };
    });
  for (const id of ids) {
    const t0 = Date.now();
    await page.evaluate((i) => document.getElementById(`scene-${i}`).scrollIntoView({ block: 'center' }), id);
    let st = await state();
    while (st.scene !== id && Date.now() - t0 < 2000) {
      await page.waitForTimeout(50);
      st = await state();
    }
    const row = { id, scene: st.scene, ms: Date.now() - t0, storyOn: st.storyOn, canvas: st.canvas, win: st.win, transformedAncestors: st.transformedAncestors, hScroll: st.hScroll };
    if (id === 'now' || id === 'daynight') {
      const measure = (x) =>
        id === 'now' ? sepDeg(x.centre.lat, x.centre.lon, x.station.lat, x.station.lon) : Math.abs(unitOf(x.centre.lat, x.centre.lon).reduce((a, v, k) => a + v * unitOf(x.sun.lat, x.sun.lon)[k], 0));
      const limit = id === 'now' ? 5 : 0.15;
      const t1 = Date.now();
      while (!(st.centre && measure(st) <= limit) && Date.now() - t1 < 3000) {
        await page.waitForTimeout(100);
        st = await state();
      }
      row.settleMs = Date.now() - t1;
      row.firstWithin = st.centre ? measure(st) : null;
      await page.waitForTimeout(1500); // and once more after the camera has had time to settle
      st = await state();
      row.value = st.centre ? measure(st) : null;
      row.centre = st.centre;
      if (id === 'now') {
        row.station = st.station;
        row.altText = st.altText;
        row.storyAlt = st.storyAlt;
      } else row.sun = st.sun;
    }
    if (id === 'now' || id === 'sky') {
      if (id === 'sky') await page.waitForTimeout(1500); // let the camera settle for the picture
      await page.screenshot({ path: evidence(`g3-story-${id}`) });
    }
    s.scenes.push(row);
  }
  // a scripted 3-second scroll from the top of the story to its end; the gaps between the frames drawn meanwhile
  const top = await page.evaluate(() => {
    const r = document.getElementById('story').getBoundingClientRect();
    return { from: window.scrollY + r.top, to: window.scrollY + r.bottom - window.innerHeight };
  });
  await page.evaluate((y) => window.scrollTo(0, y), top.from);
  await page.waitForTimeout(400);
  const f0 = (await state()).frames;
  await page.evaluate(
    ({ from, to }) =>
      new Promise((done) => {
        const t0 = performance.now();
        const step = (t) => {
          const k = Math.min(1, (t - t0) / 3000);
          window.scrollTo(0, from + (to - from) * k);
          if (k < 1) requestAnimationFrame(step);
          else done();
        };
        requestAnimationFrame(step);
      }),
    top,
  );
  const f1 = (await state()).frames;
  const gaps = await page.evaluate(() => window.__iss3d.frameMs());
  s.scroll = { framesDrawn: f1 - f0, gapsUsed: Math.min(gaps.length, Math.max(0, f1 - f0 - 1)) };
  const used = gaps.slice(gaps.length - s.scroll.gapsUsed).sort((a, b) => a - b);
  s.scroll.medianFrameMs = used.length ? used[Math.floor(used.length / 2)] : null;
  s.scroll.hScroll = (await state()).hScroll;
  // back to the top: the story is off and the canvas is back in the map's slot
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  s.back = await state();
  const now = s.scenes.find((r) => r.id === 'now');
  const dn = s.scenes.find((r) => r.id === 'daynight');
  s.checks = {
    globeShown: s.globeShown,
    stars1627: s.stars === '1627',
    sixScenesInOrder: JSON.stringify(s.ids) === JSON.stringify(ids.map((i) => `scene-${i}`)),
    eachSceneWithin2s: s.scenes.every((r) => r.scene === r.id && r.ms <= 2000),
    nowCentreWithin5Deg: now.value !== null && now.value <= 5,
    daynightDotWithin015: dn.value !== null && dn.value <= 0.15,
    nowHeightIsAltText: !!now.altText && now.storyAlt === now.altText,
    canvasFillsWindowInStory: s.scenes.every((r) => r.storyOn && r.canvas.position === 'fixed' && Math.abs(r.canvas.w - r.win.w) <= 1 && Math.abs(r.canvas.h - r.win.h) <= 1 && r.canvas.top === 0 && r.canvas.left === 0 && r.canvas.pointer === 'none'),
    noTransformedAncestor: s.scenes.every((r) => r.transformedAncestors.length === 0),
    noSidewaysScroll: s.scenes.every((r) => !r.hScroll) && !s.scroll.hScroll && !s.back.hScroll,
    scrollDrewFrames: s.scroll.medianFrameMs !== null,
    backToSlotAtTop: !s.back.storyOn && s.back.scene === '' && s.back.canvas.position !== 'fixed',
  };
  return s;
}

/**
 * R2 --view auto --gpu: the real graphics chip, no stand-ins. (1) The plain address (DEFAULT_VIEW 'auto', the
 * device check on the chip as launched) must end on data-view "3d" with why "auto" within 10 s, with a renderer
 * that names the Intel chip and not SwiftShader; then the four-place picture check and the station-marker
 * check, and 0 console errors. (2) ?view=flat, then 3D pressed: the globe's centre within 5 degrees of the station.
 * `why` says in plain words what went wrong when the chip was not reached.
 */
export async function gpuRun({ newPage, baseUrl, evidence }) {
  const r = { checks: {} };
  const C = r.checks;
  const plain = new URL(baseUrl);
  plain.searchParams.delete('view');
  const flat = new URL(baseUrl);
  flat.searchParams.set('view', 'flat');
  const state = (page) =>
    page.evaluate(() => ({ view: document.body.dataset.view, why: document.body.dataset.viewWhy ?? null, probe: document.body.dataset.viewProbe ?? null, renderer: document.getElementById('globe')?.dataset.renderer ?? null }));
  {
    const { page, errors, close } = await newPage({});
    const t0 = Date.now();
    await page.goto(plain.href, { waitUntil: 'load' });
    const ended = await page
      .waitForFunction(() => document.body.dataset.view === '3d' && document.body.dataset.viewWhy === 'auto', null, { timeout: Math.max(1, t0 + 10_000 - Date.now()) })
      .then(() => true)
      .catch(() => false);
    r.endMs = Date.now() - t0;
    r.end = await state(page);
    // the renderer the device check saw (data-view-probe), the same string the globe carries in data-renderer
    let probe = null;
    try {
      probe = JSON.parse(r.end.probe ?? 'null');
    } catch {}
    r.renderer = probe?.renderer || r.end.renderer || '';
    C.rendererIsIntel = /intel/i.test(r.renderer);
    C.rendererNotSwiftShader = r.renderer !== '' && !/swiftshader/i.test(r.renderer);
    C.ends3dAutoWithin10s = ended && r.endMs <= 10_000;
    if (!C.rendererIsIntel || !C.rendererNotSwiftShader)
      r.why = r.renderer ? `headless Chrome reached "${r.renderer}", not the Intel chip` : `the device check made no hardware context (why "${r.end.why}")`;
    else if (!ended) r.why = `the page stayed on "${r.end.view}" with why "${r.end.why}" (probe ${r.end.probe})`;
    if (ended && (await waitForGlobe(page))) {
      const g = {};
      Object.assign(C, await pictureChecks({ page, g, evidence, STATION: (await page.evaluate(() => window.__iss3d?.STATION_RGB)) ?? [255, 0, 255] }));
      r.image = g.image;
      r.marker = g.marker;
    } else C.pictureAndMarkerRan = false;
    r.consoleErrors = [...errors];
    C.noConsoleErrors = errors.length === 0;
    await close();
  }
  {
    const { page, errors, close } = await newPage({});
    await page.goto(flat.href, { waitUntil: 'load' });
    await page.waitForFunction(() => document.body.dataset.viewWhy === 'flag', null, { timeout: 15_000 }).catch(() => {});
    await page.click('#view-3d');
    r.pressedGlobe = await waitForGlobe(page);
    r.pressed = await pressCentre(page);
    C.pressFromFlatFacesStation = r.pressedGlobe && r.pressed.view === '3d' && r.pressed.why === 'press' && r.pressed.offDeg !== null && r.pressed.offDeg <= 5;
    r.pressErrors = [...errors];
    C.noConsoleErrorsAfterPress = errors.length === 0;
    await close();
  }
  return r;
}
