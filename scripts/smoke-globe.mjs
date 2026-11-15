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
  }));
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
  await page.focus('#globe');
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
    await page.goto(withView('auto'), { waitUntil: 'load' });
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
    await page.goto(withView('auto'), { waitUntil: 'load' });
    const c = { name: 'reduced motion', decided: await decided(page) };
    c.atLoad = await state(page);
    c.consoleErrors = [...errors];
    c.ok = c.atLoad.view === 'flat' && c.atLoad.why === 'reduced-motion' && errors.length === 0;
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
    await page.goto(withView('auto'), { waitUntil: 'load' });
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
  return cases;
}
