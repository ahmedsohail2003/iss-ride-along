// The NASA layers on the page (M4): the built-in Blue Marble map (zoom 0-2, works offline), the
// dated GIBS daily image on top when online, the horizon footprint, EONET events inside it, and a
// curated astronaut photo of a place in view. Pure logic lives in footprint.ts, eonet.ts, gibs.ts
// and photos.ts; this file only draws.
import * as L from 'leaflet';
import worldTile from '../data/bluemarble-z0.jpg';
import eonetSnapshot from '../data/eonet-open.json';
import photosData from '../data/photos.json';
import meta from '../data/snapshot-meta.json';
import { footprintRadiusKm, splitByFootprint, type WithDistance } from './footprint';
import { EONET_SET, eonetRawCount, fetchEonet, parseEonet, type EonetEvent } from './eonet';
import { GIBS_LAYER, GIBS_MAX_NATIVE_ZOOM, gibsTemplate, pickGibsDay, probeGibs } from './gibs';
import { photoCreditLine, photoDay, type CuratedPhoto } from './photos';
import * as C from './credits';
import { clearSource, warnSource } from '../ui/warnings';

const blueMarbleTiles = import.meta.glob('../data/bluemarble/*.jpg', { eager: true, import: 'default' }) as Record<string, string>;
const thumbs = import.meta.glob('../data/photos/*.jpg', { eager: true, import: 'default' }) as Record<string, string>;

export const WORLD: L.LatLngBoundsExpression = [
  [-85.0511, -180],
  [85.0511, 180],
];
const EVENTS_REFRESH_MS = 5000;

/** Blue Marble tiles built into the page: zoom 0 (1 tile), 1 (4) and 2 (16); scaled up beyond 2. */
class EmbeddedBlueMarble extends L.TileLayer {
  getTileUrl(c: L.Coords): string {
    if (c.z === 0) return worldTile;
    return blueMarbleTiles[`../data/bluemarble/${c.z}-${c.y}-${c.x}.jpg`] ?? L.Util.emptyImageUrl;
  }
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
const km = (x: number) => `${Math.round(x).toLocaleString('en-US')} km`;
const utcMinute = (d: Date) => `${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
const CATEGORY_COLOR: Record<string, string> = {
  Wildfires: '#ff7b54',
  'Severe Storms': '#c792ea',
  'Sea and Lake Ice': '#a0e7ff',
  Volcanoes: '#ff4d4d',
};

/** The NASA panel (events and photo); M7 puts it in the "What it is flying over" tab. */
export const belowPanelHtml = `
  <section class="below" aria-label="What the station is flying over">
    <div class="card">
      <h2>In the station's view</h2>
      <p id="footprint" class="small"></p>
      <p id="events-status" class="events-status" aria-live="polite">Loading NASA EONET events...</p>
      <ul id="events-list" class="events-list"></ul>
      <p id="events-source" class="small"></p>
    </div>
    <div class="card" id="photo-card">
      <h2>Astronaut photo <span class="small">(curated)</span></h2>
      <p id="photo-status" class="small"></p>
      <figure class="photo">
        <img id="photo-img" alt="" width="200" height="133" />
        <figcaption id="photo-caption" class="small"></figcaption>
      </figure>
    </div>
  </section>
`;

/** Credits stay outside the tabs, at the foot of the page, so they are always one click away. */
export const creditsHtml = `
  <details id="credits" class="credits">
    <summary>Credits and data sources</summary>
    <div id="credits-body"></div>
  </details>
`;

export interface NasaLayers {
  /** Call every tick with the station's position; redraws the footprint, refreshes lists every 5 s. */
  update(latDeg: number, lonDeg: number, altKm: number): void;
  /** A2: the events on the map now (live list or saved copy) and where they came from. */
  getEvents(): { list: EonetEvent[]; source: string };
}

export function initNasaLayers(map: L.Map): NasaLayers {
  const $ = (id: string) => document.getElementById(id)!;
  const photos = (photosData as CuratedPhoto[]).map((p) => ({
    ...p,
    thumb: thumbs[`../data/photos/${p.nasa_id}.jpg`] ?? '',
  }));

  // ---- Base map (always) and the dated GIBS daily image (online only).
  new EmbeddedBlueMarble('', {
    maxNativeZoom: 2,
    noWrap: true,
    bounds: WORLD,
    attribution: 'Imagery: NASA EOSDIS GIBS, Blue Marble',
  }).addTo(map);

  const gibsLabel = $('gibs-date');
  const setGibs = (state: string, text: string) => {
    document.body.dataset.gibs = state;
    gibsLabel.textContent = text;
  };
  setGibs('none', 'Map: built-in NASA Blue Marble image (no daily satellite image while offline).');

  async function startGibs() {
    setGibs('probing', 'Map: asking NASA GIBS for the latest daily satellite image...');
    const choice = await pickGibsDay(new Date(), probeGibs);
    if (!choice.day) {
      setGibs('unreachable', 'Map: built-in NASA Blue Marble image (NASA GIBS could not be reached).');
      warnSource('gibs', 'NASA GIBS (the daily satellite image) could not be reached: the map shows the built-in NASA Blue Marble image instead.');
      return;
    }
    const day = choice.day;
    document.body.dataset.gibsDay = day;
    const layer = L.tileLayer(gibsTemplate(day), {
      maxNativeZoom: GIBS_MAX_NATIVE_ZOOM,
      noWrap: true,
      bounds: WORLD,
      attribution: `NASA GIBS, ${GIBS_LAYER.replace(/_/g, ' ')}, ${day}`,
    });
    let loaded = 0;
    let failed = 0;
    const note = choice.how === 'assumed' ? ' (GIBS did not confirm the date, so the page uses two days ago)' : '';
    layer.on('tileload', () => {
      loaded++;
      if (document.body.dataset.gibs !== 'loaded')
        setGibs('loaded', `Map: daily satellite image, ${day}, not a live camera (NASA GIBS, MODIS Terra true colour)${note}. Black stripes = gaps between the satellite's daily passes.`);
      clearSource('gibs');
    });
    layer.on('tileerror', () => {
      failed++;
      if (loaded === 0 && failed >= 4) {
        map.removeLayer(layer);
        setGibs('failed', `Map: the daily satellite image for ${day} did not load; showing the built-in NASA Blue Marble image.`);
        warnSource('gibs', `NASA GIBS map tiles for ${day} did not load: the map shows the built-in NASA Blue Marble image instead.`);
      }
    });
    layer.addTo(map);
  }

  // ---- Footprint circle, event markers and photo markers.
  const footprint = L.circle([0, 0], {
    radius: 1,
    color: '#7fdbff',
    weight: 1.5,
    fillColor: '#7fdbff',
    fillOpacity: 0.08,
    interactive: false,
  }).addTo(map);
  const eventLayer = L.layerGroup().addTo(map);
  const photoLayer = L.layerGroup().addTo(map);
  for (const p of photos) {
    L.circleMarker([p.lat, p.lon], { radius: 4, color: '#3ecf8e', weight: 2, fillOpacity: 0.6 })
      .bindTooltip(`NASA astronaut photo: ${esc(p.place)}`)
      .addTo(photoLayer);
  }

  // ---- Events: the saved copy now, one live request when online.
  const snapMeta = meta.files['eonet-open.json'];
  let events: EonetEvent[] = parseEonet(eonetSnapshot);
  let rawEventCount = eonetRawCount(eonetSnapshot);
  let eventsSource = `Saved copy from ${utcMinute(new Date(snapMeta.retrievedAt))} (built into this page).`;
  const markers = new Map<string, L.CircleMarker>();

  function drawEventMarkers() {
    eventLayer.clearLayers();
    markers.clear();
    for (const e of events) {
      const m = L.circleMarker([e.lat, e.lon], {
        radius: 3,
        color: CATEGORY_COLOR[e.category] ?? '#f5f5f5',
        weight: 1,
        fillOpacity: 0.7,
      }).bindTooltip(`${esc(e.title)} (${esc(e.category)})`);
      m.addTo(eventLayer);
      markers.set(e.id, m);
    }
  }
  drawEventMarkers();

  async function startEonet() {
    const live = await fetchEonet();
    if (!live) {
      eventsSource += ' The live list could not be loaded.';
      warnSource('eonet', `NASA EONET could not be reached: the natural events are the saved copy from ${utcMinute(new Date(snapMeta.retrievedAt))}.`);
    } else {
      clearSource('eonet');
      events = live.events;
      rawEventCount = live.rawCount;
      eventsSource = `Live from NASA EONET, fetched ${utcMinute(new Date())}.`;
      drawEventMarkers();
      lastInView = '';
    }
    lastList = 0;
  }

  function categorySummary(): string {
    const counts = new Map<string, number>();
    for (const e of events) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([c, n]) => `${c} ${n}`)
      .join(', ');
  }

  const eventLine = (d: WithDistance<EonetEvent>) => {
    const e = d.item;
    const mag = e.magnitude ? `, ${esc(e.magnitude)}` : '';
    const src = e.sources.length ? `source ${esc(e.sources.join(', '))}` : 'source not given';
    return `<strong>${esc(e.title)}</strong> · ${esc(e.category)}${mag} · ${esc(e.date.slice(0, 10))} · ${src} · ${km(d.km)} from the point under the station`;
  };

  let lastList = 0;
  let lastInView = '';
  let lastPhoto = '';

  function renderLists(lat: number, lon: number, altKm: number) {
    const ev = splitByFootprint(events, lat, lon, altKm);
    $('footprint').textContent =
      `The circle on the map is the station's view: every place within ${km(ev.radiusKm)} of the point under it ` +
      `(${km(2 * ev.radiusKm)} across at ${altKm.toFixed(1)} km altitude) can see the station above its horizon.`;
    const ids = ev.inView.map((d) => d.item.id).join(',');
    if (ids !== lastInView) {
      for (const [id, m] of markers) {
        const on = ev.inView.some((d) => d.item.id === id);
        m.setStyle({ radius: on ? 6 : 3, weight: on ? 2 : 1, color: on ? '#ffffff' : CATEGORY_COLOR[events.find((e) => e.id === id)!.category] ?? '#f5f5f5' });
      }
      lastInView = ids;
    }
    const status = $('events-status');
    const list = $('events-list');
    status.dataset.inView = String(ev.inView.length);
    if (ev.inView.length) {
      status.textContent = `${ev.inView.length} of the ${events.length} ${EONET_SET} ${ev.inView.length === 1 ? 'is' : 'are'} in the station's view right now:`;
      const shown = ev.inView.slice(0, 6);
      list.innerHTML =
        shown.map((d) => `<li>${eventLine(d)}</li>`).join('') +
        (ev.inView.length > shown.length ? `<li class="small">and ${ev.inView.length - shown.length} more</li>` : '');
    } else if (ev.nearest) {
      status.textContent = `None of the ${events.length} ${EONET_SET} is in the station's view right now. Nearest one:`;
      list.innerHTML = `<li>${eventLine(ev.nearest)}</li>`;
    } else {
      status.textContent = `NASA EONET lists no ${EONET_SET}.`;
      list.innerHTML = '';
    }
    const skipped = rawEventCount - events.length;
    $('events-source').textContent =
      `${eventsSource} All ${events.length} ${EONET_SET} (${categorySummary()})` +
      (skipped > 0 ? `; ${skipped} more had no usable position.` : '.');

    const ph = splitByFootprint(photos, lat, lon, altKm);
    const pick = ph.inView[0] ?? ph.nearest;
    if (!pick) return;
    const inView = ph.inView.length > 0;
    const key = `${pick.item.nasa_id}:${inView}`;
    const statusText = inView
      ? `In view now: ${pick.item.place}, ${km(pick.km)} from the point under the station.`
      : `No curated photo is of a place in view right now. Nearest: ${pick.item.place}, ${km(pick.km)} away.`;
    $('photo-status').textContent = statusText;
    if (key === lastPhoto) return;
    lastPhoto = key;
    const p = pick.item;
    const img = $('photo-img') as HTMLImageElement;
    img.src = p.thumb;
    img.alt = p.title;
    img.classList.toggle('not-in-view', !inView);
    $('photo-card').dataset.nasaId = p.nasa_id;
    $('photo-caption').innerHTML =
      `${esc(p.title)} · taken ${photoDay(p)} · <span class="credit">${esc(photoCreditLine(p))}</span> · ` +
      `<a href="${esc(p.page)}" target="_blank" rel="noopener">images.nasa.gov</a>`;
  }

  // ---- Credits panel.
  $('credits-body').innerHTML = `
    <ul>
      <li>${esc(C.CREDIT_GIBS)}</li>
      <li>${esc(C.CREDIT_GIBS_LAYERS)}</li>
      <li>${esc(C.CREDIT_EONET)}. ${esc(C.CREDIT_EONET_SOURCES)}</li>
      <li>${esc(C.CREDIT_PHOTOS)}
        <ul class="small">${photos.map((p) => `<li>${esc(p.place)}: ${esc(photoCreditLine(p))}</li>`).join('')}</ul></li>
      <li>${esc(C.CREDIT_CELESTRAK)}</li>
      <li>${esc(C.CREDIT_WHERETHEISS)}</li>
      <li>${esc(C.creditOem(meta.files['iss-oem.json'].CREATION_DATE))}</li>
      <li>${esc(C.CREDIT_ERFA)}</li>
      <li>${esc(C.CREDIT_CITIES)}, retrieved ${esc(meta.files['cities.json'].retrievedAt.slice(0, 10))}.</li>
      <li>${esc(C.CREDIT_HEAVENS_ABOVE)}</li>
      <li>${esc(C.CREDIT_NOT_NASA)}</li>
    </ul>`;

  // ---- Network: nothing at all while the browser is offline; one try each when it comes back.
  const goOnline = () => {
    startGibs();
    startEonet();
  };
  if (navigator.onLine === false) {
    eventsSource += ' Offline: the live list will load when the connection returns.';
    window.addEventListener('online', goOnline, { once: true });
  } else goOnline();

  return {
    getEvents: () => ({
      list: events,
      source: eventsSource.startsWith('Live') ? eventsSource.replace(/^Live from NASA EONET, fetched (.*)\.$/, 'NASA EONET, live list fetched $1') : `NASA EONET, saved copy from ${utcMinute(new Date(snapMeta.retrievedAt))}`,
    }),
    update(lat, lon, altKm) {
      footprint.setLatLng([lat, lon]);
      footprint.setRadius(footprintRadiusKm(altKm) * 1000);
      const now = Date.now();
      if (now - lastList >= EVENTS_REFRESH_MS) {
        lastList = now;
        renderLists(lat, lon, altKm);
      }
    },
  };
}
