// ISS Ride-Along: the live tracker (M1) with NASA layers (M4), the pass predictor (M5) and the check
// against NASA's own trajectory (C1, src/oem-ui.ts). Every second
// the page runs SGP4 (satellite.js) on the station's orbit elements and moves the marker; a button
// compares our answer with wheretheiss.at; src/nasa/layers.ts draws what the station is flying over;
// src/passes-ui.ts lists when it can be seen from a chosen place; src/orbit/daynight.ts shades the night
// side of the map and labels the station "in sunlight" or "in Earth's shadow" (C2); src/ui/game.ts is
// the guessing game (M6) and src/orbit/lab.ts the orbit lab line under the numbers. C3: src/ui/sentence.ts
// writes the plain sentence above the map ("110 km northeast of Detroit, ..."), which is the page's one
// screen-reader live region for the position and changes once a minute; the per-second numbers are not announced.
// X5: src/sky/skyPanel.ts draws the stars and constellations above the station right now (the Sky tab).
// G1: src/globe/ is the 3D globe (three.js) in the map's place, fed by the same calls as the flat map; since G2 the
// page opens on it where the device can (DEFAULT_VIEW 'auto'); src/globe/view.ts holds the switch and that rule.
// G2: the chosen pass is drawn on the globe too (src/globe/geo.ts passPoints), and the 3D view wears its own
// black look (src/globe/look.ts, the colours; src/style.css, the rules under body[data-view="3d"]).
// G3: the Sky tab's stars behind the globe (src/globe/stars.ts) and, in the 3D view only, the scroll story #story
// under the tabs (src/globe/storyUi.ts; the camera for each scene from src/globe/story.ts).
import 'leaflet/dist/leaflet.css';
import './fonts.css';
import './style.css';
import * as L from 'leaflet';
import tleText from './data/iss.tle?raw';
import meta from './data/snapshot-meta.json';
import { stateAt } from './orbit/orbit';
import { nightLine, sunlightLabel } from './orbit/daynight';
import { ageLevel, formatAge, groundTrack, periodMinutes } from './orbit/track';
import { compareWithReference } from './orbit/compare';
import { initialElements, refreshElements, type Elements } from './elements';
import { fetchReference } from './reference';
import { belowPanelHtml, creditsHtml, initNasaLayers, WORLD } from './nasa/layers';
import { initPassPanel, nextPassHtml, passPanelHtml } from './passes-ui';
import { initPlanner, plannerPanelHtml, plannerResultHtml, plannerSettingsHtml } from './ui/plannerPanel';
import { fmtClock, fmtDay } from './agent/format';
import { initOemPanel, oemPanelHtml } from './oem-ui';
import { clearSource, warningsHtml, warnSource } from './ui/warnings';
import { initTabs, tabsHtml } from './ui/tabs';
import { briefSheetHtml } from './ui/outputs';
import { accuracyHtml, recordReference, renderAccuracy } from './ui/accuracy';
import { gameBarHtml, gameHtml, initGame } from './ui/game';
import { orbitLabLine } from './orbit/lab';
import { startWhereRegion } from './ui/whereRegion';
import { initVoice, voiceHtml } from './ui/voice';
import { initSkyPanel, skyPanelHtml } from './sky/skyPanel';
import { initView } from './globe/view';
import { createGlobe, type Globe, type GlobeStyle } from './globe/globe';
import { DEFAULT_STYLE, DOTS_ON } from './globe/dots';
import { passLabel, stationLabel } from './globe/hud';
import { passTexts } from './agent/tools';
import { orbitPoints, passPoints, type OrbitPoint } from './globe/geo';
import { applyLook } from './globe/look';
import { subsolarPoint } from './orbit/daynight';
import globeImageUrl from './data/globe/bluemarble-2048.jpg';
import { STORY_ON } from './globe/story';
import { initStory, storyHtml } from './globe/storyUi';
import { codeLinkHtml, heroHtml, initLook2, markSvg } from './ui/hero';

// M7: the first screen answers a stranger's question, "can I see it, and when?": the map, the planner
// box, the next-pass line for the chosen place and a small "How accurate is this?" card. Everything
// else opens from the tabs under it (anything built later gets a tab too).
const app = document.querySelector<HTMLDivElement>('#app')!;
applyLook(document.documentElement);
app.innerHTML = `
  <header class="top">
    <h1>${markSvg}ISS Ride-Along</h1>
    <span class="look-badge">3D globe</span>
    <p class="tag">Where the International Space Station is right now, and when you can see it, computed in your browser from public orbit data.</p>
    ${codeLinkHtml}
  </header>
  ${warningsHtml}
  <main class="layout">
    <section class="map-wrap" aria-label="Where the station is">
      ${heroHtml}
      <p id="where-now" class="where-now" aria-live="polite" aria-atomic="true"></p>
${voiceHtml}
      ${gameBarHtml}
      <div class="map-slot">
        <div id="view-switch" class="view-switch" role="group" aria-label="How to show the Earth">
          <button type="button" id="view-3d" aria-pressed="false">3D</button>
          <button type="button" id="view-flat" aria-pressed="true">Flat page</button>
        </div>
        <p id="view-note" class="view-note" hidden></p>
        <div id="map" role="region" aria-label="World map with the space station's position and path. Arrow keys move the map; plus and minus zoom."></div>
        <div id="globe" role="region" tabindex="0" aria-label="3D globe with the space station's position, its last and next orbit, the night side and the area the crew can see. Arrow keys turn the globe; plus and minus zoom."></div>
        ${DOTS_ON ? `<div id="style-switch" class="style-switch" role="group" aria-label="How to draw the globe">
          <button type="button" id="style-photo" aria-pressed="true">Photo</button>
          <button type="button" id="style-dots" aria-pressed="false">Dots</button>
        </div>` : ''}
      </div>
      <p class="small legend">
        <span class="key key-iss"></span> ISS now
        <span class="key key-past"></span> last orbit
        <span class="key key-next"></span> next orbit
        <span class="key key-view"></span> station's view
        <label class="night-toggle"><input type="checkbox" id="night-toggle" checked> <span class="key key-night"></span> night side</label>
        <label class="night-toggle"><input type="checkbox" id="daily-toggle" disabled> Daily satellite photo (with clouds)</label>
        · <span id="gibs-date"></span>
        <span id="pass-key" hidden><span class="key key-pass"></span> <span id="pass-key-text"></span></span>
      </p>
      <dl class="readout" aria-live="off">
        <div><dt>Latitude</dt><dd><span id="lat">-</span>°</dd></div>
        <div><dt>Longitude</dt><dd><span id="lon">-</span>°</dd></div>
        <div><dt>Altitude</dt><dd><span id="alt">-</span> km</dd></div>
        <div><dt>Speed <span class="small">(orbital, not over the ground)</span></dt><dd><span id="speed">-</span> km/h</dd></div>
        <div><dt>Time</dt><dd id="clock">-</dd></div>
        <div><dt>Station</dt><dd id="sunlit">-</dd></div>
      </dl>
      <p class="small lab-line"><span id="orbit-lab">-</span> <span class="lab-const">(circular orbit: speed = √(GM ÷ r), time = 2πr ÷ speed, with GM = 398,600.4418 km³/s² and r = 6,378.137 km + height)</span></p>
      <p class="small why-sun">You can see it only when you are in the dark and it is still in sunlight, which happens in the hours after sunset and before sunrise.</p>
      <p id="data-age" class="age"></p>
    </section>
    <aside class="side">
      ${plannerPanelHtml}
      ${nextPassHtml}
      ${plannerResultHtml}
      <section class="card acc-card" aria-labelledby="acc-h">
        <h2 id="acc-h">How accurate is this?</h2>
        ${oemPanelHtml}
        <button id="check-ref" type="button">Check against reference</button>
        <p id="ref-result" class="ref-result" aria-live="polite"></p>
        <button type="button" class="linkish" data-open-tab="accuracy">Every measured number, and what is computed vs fetched</button>
      </section>
    </aside>
  </main>
  ${tabsHtml(
    [
      { id: 'passes', label: 'All passes', html: passPanelHtml },
      { id: 'nasa', label: 'What it is flying over', html: belowPanelHtml },
      { id: 'sky', label: 'Sky from the station', html: skyPanelHtml },
      { id: 'game', label: 'Game', html: gameHtml },
      { id: 'accuracy', label: 'Accuracy and sources', html: accuracyHtml },
      { id: 'settings', label: 'Settings', html: `<section class="card">${plannerSettingsHtml}</section>` },
    ],
    'nasa',
  )}
  ${STORY_ON ? storyHtml : ''}
  <footer>
  ${creditsHtml}
  <p class="small foot">Orbit data: CelesTrak (US Space Force data, not NASA). Reference: wheretheiss.at
    (not NASA). Not affiliated with or endorsed by NASA.</p>
  </footer>
  ${briefSheetHtml}
`;

// G6: the card look (body.look2) and the tag pills on three cards; the hero copy and the header are in the HTML above.
initLook2();

const $ = (id: string) => document.getElementById(id)!;

// ---- Orbit elements: newest of embedded and saved now; one live fetch in the background.
const embeddedRetrieved = new Date(meta.files['iss.tle'].retrievedAt);
let elements: Elements = initialElements(tleText, embeddedRetrieved);

// ---- Map: the cloud-free Blue Marble (built-in tiles, zoom 0-2; GIBS to zoom 8 online) plus NASA layers,
// the daily photo behind the #daily-toggle switch, drawn by src/nasa/layers.ts.
const map = L.map('map', {
  minZoom: 1,
  maxZoom: 6,
  zoomSnap: 0.25,
  maxBounds: WORLD,
  maxBoundsViscosity: 1,
  worldCopyJump: false,
  attributionControl: true,
});
map.attributionControl.setPrefix('Leaflet');
// The station never goes past 51.6 degrees of latitude, so frame the band it flies over.
map.fitBounds([
  [-62, -180],
  [72, 180],
]);
const nasa = initNasaLayers(map);

// ---- C2: the night side of the Earth, in its own pane under every line and marker (tiles are at 200,
// overlays at 400). Redrawn every minute (the line moves a quarter of a degree a minute).
map.createPane('night').style.zIndex = '350';
const nightShade = L.polygon([], { pane: 'night', stroke: false, fillColor: '#000814', fillOpacity: 0.55, interactive: false, className: 'night-shade' });
const terminator = L.polyline([], { pane: 'night', color: '#ffd166', weight: 1, opacity: 0.7, interactive: false, className: 'terminator' });
const nightLayer = L.layerGroup([nightShade, terminator]).addTo(map);
function drawNight(now: Date) {
  const n = nightLine(now);
  nightShade.setLatLngs(n.polygon);
  terminator.setLatLngs(n.line);
  const sun = subsolarPoint(now);
  view?.globe()?.setSun(sun.latDeg, sun.lonDeg);
  document.body.dataset.nightPoints = String(n.polygon.length);
}
const nightToggle = document.getElementById('night-toggle') as HTMLInputElement;
nightToggle.addEventListener('change', () => {
  if (nightToggle.checked) nightLayer.addTo(map);
  else nightLayer.remove();
  view?.globe()?.setNight(nightToggle.checked);
});

// ---- G1: the 3D globe in the map's place (src/globe/). `view` is set further down, once the map is drawn.
type ViewApi = ReturnType<typeof initView<Globe>>;
let view: ViewApi | undefined;
/** Hand the globe everything the flat map shows, from the same engine calls. */
function feedGlobe(g: Globe, now = new Date()) {
  const s = stateAt(elements.satrec, now);
  if (s) g.setStation(s.latDeg, s.lonDeg, s.altKm);
  const sun = subsolarPoint(now);
  g.setSun(sun.latDeg, sun.lonDeg);
  const t = orbitPoints(elements.satrec, now, periodMinutes(elements.satrec));
  g.setTrack(t.past, t.next);
  g.setNight(nightToggle.checked);
  if (shownPass) g.setPass(shownPass.points, shownPass.city, shownPass.peak, false);
  g.setStyle(globeStyle);
  g.setLabels(stationLabel($('alt').textContent ?? '', $('speed').textContent ?? ''), passHud);
}
// ---- G5: the globe's style (Photo / Dots), kept for the tab like the view choice. G6: the default is one
// constant, DEFAULT_STYLE in src/globe/dots.ts (every smoke run names the style it wants).
const STYLE_STORAGE_KEY = 'iss-ride-along-style';
let globeStyle: GlobeStyle = (() => {
  if (!DOTS_ON) return 'photo';
  try {
    const saved = sessionStorage.getItem(STYLE_STORAGE_KEY);
    return saved === 'dots' || saved === 'photo' ? saved : DEFAULT_STYLE;
  } catch {
    return DEFAULT_STYLE;
  }
})();
/** G5: the chosen pass's label (the town, and the night and start as the plan card prints them). */
let passHud: [string, string] | null = null;
function setGlobeStyle(s: GlobeStyle, save: boolean) {
  globeStyle = s;
  document.getElementById('style-photo')?.setAttribute('aria-pressed', String(s === 'photo'));
  document.getElementById('style-dots')?.setAttribute('aria-pressed', String(s === 'dots'));
  if (save) {
    try {
      sessionStorage.setItem(STYLE_STORAGE_KEY, s);
    } catch {
      /* storage refused: the choice lasts until the page is closed */
    }
  }
  view?.globe()?.setStyle(s);
}
/** G2: the pass "Plan my sighting" last showed, kept so a globe made later draws it too. */
let shownPass: { points: OrbitPoint[]; city: { lat: number; lon: number }; peak: { lat: number; lon: number } } | null = null;

// M7: a larger marker with an "ISS" label, so a stranger finds it at once.
const issIcon = L.divIcon({
  className: 'iss-icon',
  html: '<span class="iss-dot"></span><span class="iss-ring"></span><span class="iss-label">ISS</span><span class="iss-sun"></span>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});
const marker = L.marker([0, 0], { icon: issIcon, keyboard: false, title: 'International Space Station' }).addTo(map);
const pastLine = L.polyline([], { color: '#ffd166', weight: 2, opacity: 0.9, className: 'track-line' }).addTo(map);
const nextLine = L.polyline([], { color: '#7fdbff', weight: 2, opacity: 0.9, dashArray: '6 6', className: 'track-line' }).addTo(map);

function drawTrack(now: Date) {
  const p = periodMinutes(elements.satrec);
  pastLine.setLatLngs(groundTrack(elements.satrec, now, -p, 0));
  nextLine.setLatLngs(groundTrack(elements.satrec, now, 0, p));
  const g = view?.globe();
  if (g) {
    const t = orbitPoints(elements.satrec, now, p);
    g.setTrack(t.past, t.next);
  }
}

// ---- Readout, refreshed every second.
const fmt = (x: number, d: number) => x.toFixed(d);
const sourceText: Record<Elements['source'], string> = {
  live: 'downloaded just now',
  saved: 'saved on this device',
  embedded: 'built into this page',
};

function renderAge(now: Date) {
  const level = ageLevel(elements.epoch, now);
  const age = formatAge(now.getTime() - elements.epoch.getTime());
  const warn =
    level === 'stale'
      ? ' Position may be off by tens of km; reconnect to refresh.'
      : level === 'aging'
        ? ' Position may be off by a few km.'
        : '';
  const el = $('data-age');
  el.className = `age age-${level}`;
  el.textContent =
    `Orbit data age: ${age} (element set from ${elements.epoch.toISOString().slice(0, 16).replace('T', ' ')} UTC, ` +
    `${sourceText[elements.source]}).${warn}`;
  document.body.dataset.elements = elements.source;
}

function tick() {
  const now = new Date();
  const s = stateAt(elements.satrec, now);
  if (!s) return;
  $('lat').textContent = fmt(s.latDeg, 2);
  $('lon').textContent = fmt(s.lonDeg, 2);
  $('alt').textContent = fmt(s.altKm, 1);
  $('speed').textContent = Math.round(s.speedKmS * 3600).toLocaleString('en-US');
  $('orbit-lab').textContent = orbitLabLine(s.altKm);
  $('clock').textContent = `${now.toISOString().slice(11, 19)} UTC`;
  marker.setLatLng([s.latDeg, s.lonDeg]);
  nasa.update(s.latDeg, s.lonDeg, s.altKm);
  // G1: the globe gets the same state every second (and the Sun, which moves 0.25 degree a minute).
  const g = view?.globe();
  const sunNow = subsolarPoint(now);
  if (g) {
    g.setStation(s.latDeg, s.lonDeg, s.altKm);
    g.setSun(sunNow.latDeg, sunNow.lonDeg);
    // G5: the label on the globe copies the readout's own texts
    g.setLabels(stationLabel($('alt').textContent ?? '', $('speed').textContent ?? ''), passHud);
  }
  // G3: the story's numbers, the same values and text as the readout
  story?.update({
    now,
    lat: s.latDeg,
    lon: s.lonDeg,
    altText: $('alt').textContent ?? '',
    altKm: s.altKm,
    speedText: $('speed').textContent ?? '',
    periodMin: periodMinutes(elements.satrec),
    sun: { lat: sunNow.latDeg, lon: sunNow.lonDeg },
  });
  // C2: the same shadow test as the pass list, so the label and the passes never disagree.
  const sun = sunlightLabel(elements.satrec, now);
  if (sun) {
    $('sunlit').textContent = sun.text;
    const tag = marker.getElement()?.querySelector('.iss-sun');
    if (tag) tag.textContent = sun.text;
    document.body.dataset.sunlit = String(sun.sunlit);
  }
  renderAge(now);
}

// ---- X3: the speaker toggle (hidden when the browser has no speechSynthesis), off until clicked.
const voice = initVoice({
  win: window as unknown as Parameters<typeof initVoice>[0]['win'],
  toggle: $('voice-toggle'),
  caption: $('voice-caption'),
  captionText: $('voice-text'),
});

// G3: the scroll story (3D view only); made before the first tick so its numbers are filled at once.
const story = STORY_ON ? initStory({ getGlobe: () => view?.globe() ?? null, isOn3d: () => view?.current() === '3d' }) : null;
tick();
drawTrack(new Date());
drawNight(new Date());
// G1: the view switch decides now that the flat page is drawn (so the screen is never blank).
view = initView<Globe>({
  host: $('globe'),
  btn3d: $('view-3d') as HTMLButtonElement,
  btnFlat: $('view-flat') as HTMLButtonElement,
  note: $('view-note'),
  makeGlobe: (canvas, gl, renderer) => createGlobe({ host: $('globe'), canvas, gl, renderer, imageUrl: globeImageUrl, sizeFrom: $('map') }),
  onGlobe: (g) => {
    feedGlobe(g);
    story?.sync();
  },
  onFlat: () => {
    map.invalidateSize();
    story?.sync();
  },
});
// The two actions that need the flat map open it first (a press: it wins over ?view=3d and is saved).
($('daily-toggle') as HTMLInputElement).addEventListener('change', (e) => {
  if ((e.target as HTMLInputElement).checked && view?.current() === '3d') view.press('flat');
});
// C3: the plain sentence above the map, set now and then once a minute (src/ui/whereRegion.ts); X3 reads
// exactly that text aloud when the toggle is on.
startWhereRegion({ el: $('where-now'), getSatrec: () => elements.satrec, onText: (t) => voice.sayWhere(t) });
const passPanel = initPassPanel(() => elements.satrec);
const oemPanel = initOemPanel(() => elements.satrec);
renderAccuracy();
// X5: the star chart redraws every second while its tab is open.
const skyPanel = initSkyPanel({ getSatrec: () => elements.satrec, isOpen: () => !document.getElementById('tab-sky')!.hidden });
initTabs((id) => {
  if (id === 'accuracy') renderAccuracy();
  if (id === 'sky') skyPanel.draw();
  // Leaflet measures its container; nothing in a tab holds a map, so no resize is needed.
});
setInterval(renderAccuracy, 30_000);
// M6: the game plays on the main map (a tap places the guess); its panel is the Game tab.
initGame({ map, getSatrec: () => elements.satrec, onStart: () => view?.current() === '3d' && view.press('flat') });
setInterval(tick, 1000);
// G5: the Photo / Dots switch (a corner of the globe, 3D view only).
setGlobeStyle(globeStyle, false);
document.getElementById('style-photo')?.addEventListener('click', () => setGlobeStyle('photo', true));
document.getElementById('style-dots')?.addEventListener('click', () => setGlobeStyle('dots', true));
setInterval(() => {
  drawTrack(new Date());
  drawNight(new Date());
}, 60_000);

// C3: Space activates the map's zoom buttons too (Leaflet draws them as links with role="button", which
// browsers activate with Enter only); real <button>s already take Enter and Space.
document.addEventListener('keydown', (e) => {
  const t = e.target as HTMLElement | null;
  if (e.key === ' ' && t?.matches('a[role="button"]')) {
    e.preventDefault();
    t.click();
  }
});

// ---- "Plan my sighting" (A1): the chosen pass is drawn on the map (its arc and the point under the
// station at its highest moment) and the map moves there.
const passArc = L.polyline([], { color: '#ff5fa2', weight: 5, opacity: 0.95, className: 'pass-arc' }).addTo(map);
const passPeak = L.circleMarker([0, 0], { radius: 7, color: '#ff5fa2', fillOpacity: 0.9, className: 'pass-peak' });
initPlanner({
  getSatrec: () => elements.satrec,
  getEpoch: () => elements.epoch,
  getEvents: () => nasa.getEvents(),
  // X3: once per finished plan, the result line is read aloud (when the toggle is on).
  onResult: (card) => voice.sayPlan(card),
  onShow: (info, ctx) => {
    const p = info.pass;
    const mins = (p.end.getTime() - p.start.getTime()) / 60_000;
    passArc.setLatLngs(groundTrack(elements.satrec, p.start, 0, mins, 5));
    const s = stateAt(elements.satrec, p.peak);
    if (s) {
      passPeak.setLatLng([s.latDeg, s.lonDeg]).addTo(map);
      map.setView([s.latDeg, s.lonDeg], Math.max(map.getZoom(), 3));
      // G2: the same pass on the globe, rise to set at the station's height, and the turn to its highest point.
      shownPass = { points: passPoints(elements.satrec, p.start, p.end), city: { lat: info.place.latDeg, lon: info.place.lonDeg }, peak: { lat: s.latDeg, lon: s.lonDeg } };
      const card = passTexts(ctx, info);
      passHud = passLabel(info.place.name, card.night, card.start);
      view?.globe()?.setLabels(stationLabel($('alt').textContent ?? '', $('speed').textContent ?? ''), passHud);
      view?.globe()?.setPass(shownPass.points, shownPass.city, shownPass.peak, true);
    }
    const tz = info.place.timeZone ?? ctx.viewerTimeZone;
    $('pass-key').hidden = false;
    $('pass-key-text').textContent =
      `chosen pass, ${fmtDay(p.peak, tz)} ${fmtClock(p.peak, tz)} at its highest`;
    document.body.dataset.passShown = info.id;
  },
  // M7: the next-pass line follows the place the plan is for.
  onPlace: (p) => passPanel.showPlace({ name: `${p.name}, ${p.region}`, latDeg: p.latDeg, lonDeg: p.lonDeg, heightM: p.heightM, timeZone: p.timeZone ?? undefined }),
});

// One live fetch per page load. When the browser reports no network (Wi-Fi off, the double-clicked
// offline copy) the page skips it and makes no request at all, then tries once if the connection returns.
function refreshOnce() {
  const fallback = () =>
    warnSource(
      'celestrak',
      `CelesTrak could not be reached: the position uses the orbit numbers ${sourceText[elements.source]} ` +
        `(element set from ${elements.epoch.toISOString().slice(0, 16).replace('T', ' ')} UTC).`,
    );
  refreshElements(elements, fallback).then((fresh) => {
    if (!fresh) return;
    clearSource('celestrak');
    elements = fresh;
    tick();
    drawTrack(new Date());
    passPanel.refresh();
    oemPanel.refresh();
  });
}
if (navigator.onLine === false) window.addEventListener('online', refreshOnce, { once: true });
else refreshOnce();

// ---- "Check against reference": one wheretheiss.at request per click.
const btn = $('check-ref') as HTMLButtonElement;
btn.addEventListener('click', async () => {
  const out = $('ref-result');
  btn.disabled = true;
  out.textContent = 'Asking wheretheiss.at...';
  try {
    const ref = await fetchReference();
    const c = compareWithReference(elements.satrec, ref);
    if (!c) throw new Error('our orbit model could not compute that instant');
    out.dataset.errorKm = c.errorKm.toFixed(3);
    recordReference(c.errorKm, c.at);
    clearSource('wheretheiss');
    out.innerHTML =
      `<strong id="ref-km">${fmt(c.errorKm, 2)} km</strong> from wheretheiss.at at ${c.at.toISOString().slice(11, 19)} UTC. ` +
      `Altitude differs by ${fmt(Math.abs(c.dAltKm), 3)} km, speed by ${fmt(Math.abs(c.dSpeedKmH), 1)} km/h. ` +
      `<span class="small">Both run independent code on public orbit data (their copy may be a different update), so this checks our math, not the station's true position.</span>`;
  } catch (e) {
    out.textContent = `Could not reach wheretheiss.at (${(e as Error).name === 'AbortError' ? 'timed out' : 'no answer'}). The tracker keeps running on its own orbit numbers.`;
    warnSource('wheretheiss', 'wheretheiss.at (the independent reference tracker) could not be reached: no live check this time; the tracker keeps running.');
  } finally {
    btn.disabled = false;
  }
});
