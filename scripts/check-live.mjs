// Live check: our position for "now" against wheretheiss.at, the same comparison the page's
// "Check against reference" button makes.
//
//   node scripts/check-live.mjs
//
// error_km uses the orbit elements the page would use: a live CelesTrak fetch if it answers,
// otherwise the copy saved in src/data/iss.tle. error_km_same_elements propagates the element set
// wheretheiss.at itself reports, which isolates our math from the age of the data.
// Without network it prints "SKIPPED offline" and exits 0. Exit 1 if error_km >= 2.
// Requests: one to wheretheiss.at positions, one to its /tles, at most one to CelesTrak.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as sat from 'satellite.js';

const EARTH_RADIUS_KM = 6371.0088;
const LIMIT_KM = 2;

const satrecFromTle = (text) => {
  const lines = text.trim().split(/\r?\n/).map((l) => l.trim());
  return sat.twoline2satrec(lines.at(-2), lines.at(-1));
};
const epochIso = (satrec) => new Date((satrec.jdsatepoch - 2440587.5) * 86400000).toISOString();

function stateAt(satrec, date) {
  const pv = sat.propagate(satrec, date);
  if (!pv || !pv.position) return null;
  const geo = sat.eciToGeodetic(pv.position, sat.gstime(date));
  const v = pv.velocity;
  return {
    latDeg: sat.degreesLat(geo.latitude),
    lonDeg: sat.degreesLong(geo.longitude),
    altKm: geo.height,
    speedKmH: Math.hypot(v.x, v.y, v.z) * 3600,
  };
}

function greatCircleKm(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

async function get(url, as = 'json') {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return as === 'json' ? res.json() : res.text();
}

function compare(satrec, ref) {
  const s = stateAt(satrec, new Date(ref.timestamp * 1000));
  return {
    km: greatCircleKm(s.latDeg, s.lonDeg, ref.latitude, ref.longitude),
    dAltKm: s.altKm - ref.altitude,
    dSpeedKmH: s.speedKmH - ref.velocity,
  };
}

let ref;
try {
  ref = await get('https://api.wheretheiss.at/v1/satellites/25544?units=kilometers');
} catch (e) {
  console.log(`SKIPPED offline (wheretheiss.at not reachable: ${e.cause?.code ?? e.name})`);
  process.exit(0);
}

let elementsFrom = 'celestrak live';
let tleText;
try {
  tleText = await get('https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE', 'text');
  if (!/^1 25544/m.test(tleText)) throw new Error('no ISS TLE in reply');
} catch (e) {
  elementsFrom = `src/data/iss.tle (CelesTrak not reachable: ${e.cause?.code ?? e.message})`;
  tleText = readFileSync(resolve('src/data/iss.tle'), 'utf8');
}
const ours = satrecFromTle(tleText);
const app = compare(ours, ref);

let same = null;
let theirEpoch = null;
try {
  const t = await get('https://api.wheretheiss.at/v1/satellites/25544/tles?format=json');
  const theirs = sat.twoline2satrec(t.line1, t.line2);
  theirEpoch = epochIso(theirs);
  same = compare(theirs, ref);
} catch (e) {
  same = { error: e.message };
}

const r = (x, d = 3) => (typeof x === 'number' ? Number(x.toFixed(d)) : x);
console.log(
  JSON.stringify(
    {
      at: new Date(ref.timestamp * 1000).toISOString(),
      reference: { lat: r(ref.latitude, 4), lon: r(ref.longitude, 4), alt_km: r(ref.altitude), velocity_kmh: r(ref.velocity, 1) },
      elements: elementsFrom,
      our_epoch: epochIso(ours),
      their_epoch: theirEpoch,
      error_km: r(app.km),
      d_alt_km: r(app.dAltKm),
      d_speed_kmh: r(app.dSpeedKmH, 2),
      error_km_same_elements: r(same?.km),
      d_alt_km_same_elements: r(same?.dAltKm),
      d_speed_kmh_same_elements: r(same?.dSpeedKmH, 2),
    },
    null,
    2,
  ),
);
const pass = app.km < LIMIT_KM;
console.log(`${pass ? 'PASS' : 'FAIL'}: error_km ${app.km.toFixed(3)} ${pass ? '<' : '>='} ${LIMIT_KM}`);
process.exit(pass ? 0 : 1);
