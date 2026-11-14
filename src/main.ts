// ISS Ride-Along, M1: the live tracker. Every second the page runs SGP4 (satellite.js) on the
// station's orbit elements and moves the marker; a button compares our answer with wheretheiss.at.
import 'leaflet/dist/leaflet.css';
import './style.css';
import * as L from 'leaflet';
import tleText from './data/iss.tle?raw';
import meta from './data/snapshot-meta.json';
import worldTile from './data/bluemarble-z0.jpg';
import { stateAt } from './orbit/orbit';
import { ageLevel, formatAge, groundTrack, periodMinutes } from './orbit/track';
import { compareWithReference } from './orbit/compare';
import { initialElements, refreshElements, type Elements } from './elements';
import { fetchReference } from './reference';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <header class="top">
    <h1>ISS Ride-Along</h1>
    <p class="tag">Where the International Space Station is right now, computed in your browser from public orbit data.</p>
  </header>
  <main class="layout">
    <section class="map-wrap">
      <div id="map" role="img" aria-label="World map with the space station's position and path"></div>
      <p class="small legend">
        <span class="key key-past"></span> last orbit
        <span class="key key-next"></span> next orbit
        · Base map: NASA Blue Marble (one built-in low-resolution image, so it works offline).
      </p>
    </section>
    <aside class="panel">
      <dl class="readout">
        <div><dt>Latitude</dt><dd><span id="lat">-</span>°</dd></div>
        <div><dt>Longitude</dt><dd><span id="lon">-</span>°</dd></div>
        <div><dt>Altitude</dt><dd><span id="alt">-</span> km</dd></div>
        <div class="wide"><dt>Speed</dt><dd><span id="speed">-</span> km/h</dd>
          <dd class="small">orbital speed, not speed over the ground</dd></div>
        <div class="wide"><dt>Time</dt><dd id="clock">-</dd></div>
      </dl>
      <p id="data-age" class="age"></p>
      <button id="check-ref" type="button">Check against reference</button>
      <p id="ref-result" class="ref-result" aria-live="polite"></p>
      <p class="small">Orbit data: CelesTrak (US Space Force data, not NASA). Reference: wheretheiss.at
        (not NASA). Not affiliated with or endorsed by NASA.</p>
    </aside>
  </main>
`;

const $ = (id: string) => document.getElementById(id)!;

// ---- Orbit elements: newest of embedded and saved now; one live fetch in the background.
const embeddedRetrieved = new Date(meta.files['iss.tle'].retrievedAt);
let elements: Elements = initialElements(tleText, embeddedRetrieved);

// ---- Map: one embedded Web Mercator world tile (zoom 0) stretched over the whole map.
const WORLD: L.LatLngBoundsExpression = [
  [-85.0511, -180],
  [85.0511, 180],
];
const map = L.map('map', {
  minZoom: 1,
  maxZoom: 4,
  zoomSnap: 0.25,
  maxBounds: WORLD,
  maxBoundsViscosity: 1,
  worldCopyJump: false,
  attributionControl: true,
});
map.attributionControl.setPrefix('Leaflet');
L.imageOverlay(worldTile, WORLD, { attribution: 'Imagery: NASA EOSDIS GIBS, Blue Marble' }).addTo(map);
// The station never goes past 51.6 degrees of latitude, so frame the band it flies over.
map.fitBounds([
  [-62, -180],
  [72, 180],
]);

const issIcon = L.divIcon({
  className: 'iss-icon',
  html: '<span class="iss-dot"></span><span class="iss-ring"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});
const marker = L.marker([0, 0], { icon: issIcon, keyboard: false, title: 'International Space Station' }).addTo(map);
const pastLine = L.polyline([], { color: '#ffd166', weight: 2, opacity: 0.9 }).addTo(map);
const nextLine = L.polyline([], { color: '#7fdbff', weight: 2, opacity: 0.9, dashArray: '6 6' }).addTo(map);

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
  renderAge(now);
}

tick();
drawTrack(new Date());
setInterval(tick, 1000);
setInterval(() => drawTrack(new Date()), 60_000);

// One live fetch per page load. When the browser reports no network (Wi-Fi off, the double-clicked
// offline copy) the page skips it and makes no request at all, then tries once if the connection returns.
function refreshOnce() {
  refreshElements(elements).then((fresh) => {
    if (!fresh) return;
    elements = fresh;
    tick();
    drawTrack(new Date());
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
    out.innerHTML =
      `<strong id="ref-km">${fmt(c.errorKm, 2)} km</strong> from wheretheiss.at at ${c.at.toISOString().slice(11, 19)} UTC. ` +
      `Altitude differs by ${fmt(Math.abs(c.dAltKm), 3)} km, speed by ${fmt(Math.abs(c.dSpeedKmH), 1)} km/h. ` +
      `<span class="small">Both run independent code on public orbit data (their copy may be a different update), so this checks our math, not the station's true position.</span>`;
  } catch (e) {
    out.textContent = `Could not reach wheretheiss.at (${(e as Error).name === 'AbortError' ? 'timed out' : 'offline?'}). The tracker keeps running on the orbit data above.`;
  } finally {
    btn.disabled = false;
  }
});
