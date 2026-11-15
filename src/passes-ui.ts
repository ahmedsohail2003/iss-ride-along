// "When can I see it?" (M5): the next 5 days of visible passes for Ypsilanti, any of the 150 built-in
// cities, typed coordinates or (on the hosted page only) the browser's location. The search itself is
// src/orbit/passes.ts; this file only reads the form and writes the table.
import type { SatRec } from 'satellite.js';
import citiesData from './data/cities.json';
import fixture from '../tests/fixtures/passes-ypsilanti-2026-11-14.json';
import { agreementWith, compass, predictForPlace, type PassFixture, type Place, type VisiblePass } from './orbit/passes';

interface City {
  name: string;
  country: string;
  lat: number;
  lon: number;
}

interface NamedPlace extends Place {
  /** IANA time zone to print times in; undefined = the viewer's own time zone. */
  timeZone?: string;
}

/** The event's town (and the point the test fixture uses); not in the 150-city list. */
export const YPSILANTI: NamedPlace = {
  name: 'Ypsilanti, Michigan',
  latDeg: 42.24,
  lonDeg: -83.61,
  heightM: 220,
  timeZone: 'America/Detroit',
};

const DAYS = 5;

// M7: the first screen carries the heading "When can I see it?" (#passes-h) and the one-line answer
// for the chosen place (#next-pass); the full table below sits in the "All passes" tab.
export const nextPassHtml = `
  <section class="card next-box" aria-labelledby="passes-h">
    <h2 id="passes-h">When can I see it?</h2>
    <p id="next-pass" class="next-pass" aria-live="polite">-</p>
  </section>
`;

const COMPASS_WORDS: Record<string, string> = {
  N: 'north', NNE: 'north-northeast', NE: 'northeast', ENE: 'east-northeast', E: 'east', ESE: 'east-southeast',
  SE: 'southeast', SSE: 'south-southeast', S: 'south', SSW: 'south-southwest', SW: 'southwest', WSW: 'west-southwest',
  W: 'west', WNW: 'west-northwest', NW: 'northwest', NNW: 'north-northwest',
};

/** "Next time you can see it from {place}: {day} {time}, look {direction}, {minutes} min", from the pass engine. */
export function nextPassText(satrec: SatRec, p: NamedPlace, now: Date): { text: string; pass: VisiblePass | null } {
  const tz = p.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const r = predictForPlace(satrec, p, now, DAYS);
  const next = r.passes[0];
  if (r.message || !next) return { text: `${p.name}: ${r.message ?? `no visible pass in the next ${DAYS} days.`}`, pass: null };
  const dir = compass(next.startAzDeg);
  const mins = Math.max(1, Math.round((next.end.getTime() - next.start.getTime()) / 60_000));
  const clock = next.start.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' });
  return {
    text:
      `Next time you can see it from ${p.name}: ${fmtDay(next.start, tz)} ${clock}, look ${COMPASS_WORDS[dir]} (${dir}), ${mins} min` +
      ` (${p.timeZone ? `local time in ${p.name.split(',')[0]}` : 'your time zone'}).`,
    pass: next,
  };
}

export const passPanelHtml = `
  <section class="card passes" aria-labelledby="passes-all-h">
    <h2 id="passes-all-h">All visible passes</h2>
    <p class="small">Visible passes in the next ${DAYS} days: the station at least 10° above your horizon,
      your sky dark (Sun 6° or more below the horizon) and the station still in sunlight.</p>
    <form id="place-form" class="place-form">
      <label class="grow">City
        <input id="city" list="city-list" autocomplete="off" placeholder="Type a city" />
      </label>
      <datalist id="city-list"></datalist>
      <label>Latitude <input id="lat-in" type="number" step="any" min="-90" max="90" inputmode="decimal" /></label>
      <label>Longitude <input id="lon-in" type="number" step="any" min="-180" max="180" inputmode="decimal" /></label>
      <button type="submit">Show passes</button>
      <button type="button" id="use-location" hidden>Use my location</button>
    </form>
    <p id="passes-status" class="passes-status" aria-live="polite"></p>
    <div class="table-wrap">
      <table id="passes-table" hidden>
        <thead><tr><th>Day</th><th>Appears</th><th>Highest</th><th>Disappears</th><th>Length</th></tr></thead>
        <tbody id="passes-body"></tbody>
      </table>
    </div>
    <p id="passes-tz" class="small"></p>
    <p id="passes-agree" class="small"></p>
  </section>
`;

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const cityLabel = (c: City) => `${c.name}, ${c.country}`;

function fmtTime(d: Date, timeZone: string): string {
  return d.toLocaleTimeString('en-US', { timeZone, hour: 'numeric', minute: '2-digit', second: '2-digit' });
}
function fmtDay(d: Date, timeZone: string): string {
  return d.toLocaleDateString('en-US', { timeZone, weekday: 'short', month: 'short', day: 'numeric' });
}
function fmtLength(p: VisiblePass): string {
  const s = Math.round((p.end.getTime() - p.start.getTime()) / 1000);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
}
const appears = { rises: 'rises', 'leaves-shadow': "comes out of Earth's shadow", 'sky-darkens': 'sky gets dark', window: 'already up' };
const disappears = { sets: 'sets', 'enters-shadow': "fades into Earth's shadow", 'sky-brightens': 'sky gets light', window: 'still up' };

function row(p: VisiblePass, tz: string): string {
  const deg = (x: number) => `${Math.round(x)}°`;
  return `<tr>
    <td>${fmtDay(p.start, tz)}</td>
    <td>${fmtTime(p.start, tz)}<br><span class="small">${compass(p.startAzDeg)}, ${deg(p.startElDeg)} up, ${appears[p.startsBy]}</span></td>
    <td>${fmtTime(p.peak, tz)}<br><span class="small"><strong>${deg(p.peakElDeg)}</strong> up, ${compass(p.peakAzDeg)}</span></td>
    <td>${fmtTime(p.end, tz)}<br><span class="small">${compass(p.endAzDeg)}, ${deg(p.endElDeg)} up, ${disappears[p.endsBy]}</span></td>
    <td>${fmtLength(p)}</td>
  </tr>`;
}

export interface PassPanel {
  /** Re-run the search for the current place (call after the orbit data changes). */
  refresh(): void;
  /** Show this place in the table and in the first screen's next-pass line. */
  showPlace(p: NamedPlace): void;
}

export type { NamedPlace };

export function initPassPanel(getSatrec: () => SatRec): PassPanel {
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const cities = citiesData as City[];
  const byLabel = new Map<string, NamedPlace>();
  byLabel.set(YPSILANTI.name, YPSILANTI);
  for (const c of cities) byLabel.set(cityLabel(c), { name: cityLabel(c), latDeg: c.lat, lonDeg: c.lon });
  $('city-list').innerHTML = [...byLabel.keys()].map((k) => `<option value="${esc(k)}"></option>`).join('');

  const cityIn = $<HTMLInputElement>('city');
  const latIn = $<HTMLInputElement>('lat-in');
  const lonIn = $<HTMLInputElement>('lon-in');
  const status = $('passes-status');
  let place: NamedPlace = YPSILANTI;

  function show(p: NamedPlace) {
    place = p;
    const line = nextPassText(getSatrec(), p, new Date());
    const np = $('next-pass');
    np.textContent = line.text;
    np.dataset.place = p.name;
    if (line.pass) np.dataset.start = line.pass.start.toISOString();
    else delete np.dataset.start;
    cityIn.value = byLabel.has(p.name) ? p.name : '';
    latIn.value = p.latDeg.toFixed(2);
    lonIn.value = p.lonDeg.toFixed(2);
    const tz = p.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
    const r = predictForPlace(getSatrec(), p, new Date(), DAYS);
    const table = $('passes-table');
    document.body.dataset.passCount = String(r.passes.length);
    if (r.message) {
      status.textContent = r.message;
      table.hidden = true;
      $('passes-body').innerHTML = '';
    } else {
      const next = r.passes[0];
      status.innerHTML =
        `<strong>${r.passes.length} visible pass${r.passes.length === 1 ? '' : 'es'}</strong> from ${esc(p.name)} in the next ${DAYS} days. ` +
        `Next: ${fmtDay(next.start, tz)} at ${fmtTime(next.start, tz)}, look ${compass(next.startAzDeg)}.`;
      $('passes-body').innerHTML = r.passes.map((x) => row(x, tz)).join('');
      table.hidden = false;
    }
    $('passes-tz').textContent =
      `Times are ${p.timeZone ? `local time in ${p.name}` : 'in your time zone'} (${tz}). ` +
      `Directions are compass points from you; "up" is the angle above the horizon (90° = straight overhead). ` +
      `Searched in ${Math.round(r.searchMs)} ms with the orbit data shown above; older orbit data shifts these times.`;
  }

  cityIn.addEventListener('change', () => {
    const p = byLabel.get(cityIn.value.trim());
    if (p) show(p);
    else status.textContent = 'Pick a city from the list, or type a latitude and longitude.';
  });

  $('place-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const named = byLabel.get(cityIn.value.trim());
    const lat = Number(latIn.value);
    const lon = Number(lonIn.value);
    const typedValid = latIn.value !== '' && lonIn.value !== '' && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
    // A named city wins unless its coordinates were edited by hand.
    if (named && Math.abs(named.latDeg - lat) < 0.005 && Math.abs(named.lonDeg - lon) < 0.005) return show(named);
    if (typedValid) return show({ name: `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`, latDeg: lat, lonDeg: lon });
    if (named) return show(named);
    status.textContent = 'Latitude must be between -90 and 90, longitude between -180 and 180.';
  });

  // "Use my location": hosted page only. The double-clicked offline file (file://) shows the city list.
  const geoBtn = $<HTMLButtonElement>('use-location');
  if (location.protocol !== 'file:' && 'geolocation' in navigator) {
    geoBtn.hidden = false;
    geoBtn.addEventListener('click', () => {
      status.textContent = 'Asking your browser for your location (it stays on this page)...';
      navigator.geolocation.getCurrentPosition(
        (pos) => show({ name: 'your location', latDeg: pos.coords.latitude, lonDeg: pos.coords.longitude }),
        () => (status.textContent = 'Location not available. Pick a city or type a latitude and longitude.'),
        { timeout: 10_000, maximumAge: 600_000 },
      );
    });
  }

  // The measured agreement line: our search re-run on the saved Heavens-Above list, with the same
  // orbit data that list was made from, every time the page loads.
  const fx = fixture as PassFixture;
  const a = agreementWith(fx);
  $('passes-agree').textContent =
    `Checked against Heavens-Above for ${fx.observer.name}, Nov 14-18, 2026 (their list saved once by hand, same orbit data): ` +
    `${a.matched} of ${a.refCount} passes found (we found ${a.ourCount}), start times within ${a.maxStartS.toFixed(1)} s, ` +
    `end times within ${a.maxEndS.toFixed(1)} s, highest point within ${a.maxPeakDeg.toFixed(1)}°.`;

  show(YPSILANTI);
  return { refresh: () => show(place), showPlace: show };
}
