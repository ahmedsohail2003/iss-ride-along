// ISS Ride-Along: the live tracker (M1) with NASA layers (M4), the pass predictor (M5) and the check
// against NASA's own trajectory (C1, src/oem-ui.ts). Every second
// the page runs SGP4 (satellite.js) on the station's orbit elements and moves the marker; a button
// compares our answer with wheretheiss.at; src/nasa/layers.ts draws what the station is flying over;
// src/passes-ui.ts lists when it can be seen from a chosen place; src/orbit/daynight.ts shades the night
// side of the map and labels the station "in sunlight" or "in Earth's shadow" (C2).
import 'leaflet/dist/leaflet.css';
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

// M7: the first screen answers a stranger's question, "can I see it, and when?": the map, the planner
// box, the next-pass line for the chosen place and a small "How accurate is this?" card. Everything
// else opens from the tabs under it (anything built later gets a tab too).
const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <header class="top">
    <h1>ISS Ride-Along</h1>
    <p class="tag">Where the International Space Station is right now, and when you can see it, computed in your browser from public orbit data.</p>
  </header>
  ${warningsHtml}
  <main class="layout">
    <section class="map-wrap">
      <div id="map" role="img" aria-label="World map with the space station's position and path"></div>
      <p class="small legend">
        <span class="key key-iss"></span> ISS now
        <span class="key key-past"></span> last orbit
        <span class="key key-next"></span> next orbit
        <span class="key key-view"></span> station's view
        <label class="night-toggle"><input type="checkbox" id="night-toggle" checked> <span class="key key-night"></span> night side</label>
        · <span id="gibs-date"></span>
        <span id="pass-key" hidden><span class="key key-pass"></span> <span id="pass-key-text"></span></span>
      </p>
      <dl class="readout">
        <div><dt>Latitude</dt><dd><span id="lat">-</span>°</dd></div>
        <div><dt>Longitude</dt><dd><span id="lon">-</span>°</dd></div>
        <div><dt>Altitude</dt><dd><span id="alt">-</span> km</dd></div>
        <div><dt>Speed <span class="small">(orbital, not over the ground)</span></dt><dd><span id="speed">-</span> km/h</dd></div>
        <div><dt>Time</dt><dd id="clock">-</dd></div>
        <div><dt>Station</dt><dd id="sunlit">-</dd></div>
      </dl>
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
      { id: 'accuracy', label: 'Accuracy and sources', html: accuracyHtml },
      { id: 'settings', label: 'Settings', html: `<section class="card">${plannerSettingsHtml}</section>` },
    ],
    'nasa',
  )}
  ${creditsHtml}
  <p class="small foot">Orbit data: CelesTrak (US Space Force data, not NASA). Reference: wheretheiss.at
    (not NASA). Not affiliated with or endorsed by NASA.</p>
  ${briefSheetHtml}
`;

const $ = (id: string) => document.getElementById(id)!;

// ---- Orbit elements: newest of embedded and saved now; one live fetch in the background.
const embeddedRetrieved = new Date(meta.files['iss.tle'].retrievedAt);
let elements: Elements = initialElements(tleText, embeddedRetrieved);

// ---- Map: built-in Blue Marble tiles (zoom 0-2) plus NASA layers, drawn by src/nasa/layers.ts.
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
  document.body.dataset.nightPoints = String(n.polygon.length);
}
const nightToggle = document.getElementById('night-toggle') as HTMLInputElement;
nightToggle.addEventListener('change', () => {
  if (nightToggle.checked) nightLayer.addTo(map);
  else nightLayer.remove();
});

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
  $('clock').textContent = `${now.toISOString().slice(11, 19)} UTC`;
  marker.setLatLng([s.latDeg, s.lonDeg]);
  nasa.update(s.latDeg, s.lonDeg, s.altKm);
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

tick();
drawTrack(new Date());
drawNight(new Date());
const passPanel = initPassPanel(() => elements.satrec);
const oemPanel = initOemPanel(() => elements.satrec);
renderAccuracy();
initTabs((id) => {
  if (id === 'accuracy') renderAccuracy();
  // Leaflet measures its container; nothing in a tab holds a map, so no resize is needed.
});
setInterval(renderAccuracy, 30_000);
setInterval(tick, 1000);
setInterval(() => {
  drawTrack(new Date());
  drawNight(new Date());
}, 60_000);

// ---- "Plan my sighting" (A1): the chosen pass is drawn on the map (its arc and the point under the
// station at its highest moment) and the map moves there.
const passArc = L.polyline([], { color: '#ff5fa2', weight: 5, opacity: 0.95, className: 'pass-arc' }).addTo(map);
const passPeak = L.circleMarker([0, 0], { radius: 7, color: '#ff5fa2', fillOpacity: 0.9, className: 'pass-peak' });
initPlanner({
  getSatrec: () => elements.satrec,
  getEpoch: () => elements.epoch,
  getEvents: () => nasa.getEvents(),
  onShow: (info, ctx) => {
    const p = info.pass;
    const mins = (p.end.getTime() - p.start.getTime()) / 60_000;
    passArc.setLatLngs(groundTrack(elements.satrec, p.start, 0, mins, 5));
    const s = stateAt(elements.satrec, p.peak);
    if (s) {
      passPeak.setLatLng([s.latDeg, s.lonDeg]).addTo(map);
      map.setView([s.latDeg, s.lonDeg], Math.max(map.getZoom(), 3));
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
