// Placeholder page for M0 (setup). The live tracker arrives in M1.
import './style.css';
import tleText from './data/iss.tle?raw';
import meta from './data/snapshot-meta.json';
import { satrecFromTle, stateAt } from './orbit/orbit';

const app = document.querySelector<HTMLDivElement>('#app')!;
const state = stateAt(satrecFromTle(tleText), new Date());
const tleFile = meta.files['iss.tle'];

app.innerHTML = `
  <h1>ISS Ride-Along</h1>
  <p>Setup build. The live tracker comes next.</p>
  <p>Embedded orbit data (CelesTrak, US Space Force data, not NASA), element set epoch
    <code>${tleFile.tleEpoch}</code>.</p>
  <p>Computed now from that data: latitude <span id="lat">${state ? state.latDeg.toFixed(2) : 'n/a'}</span>,
    longitude <span id="lon">${state ? state.lonDeg.toFixed(2) : 'n/a'}</span>.</p>
  <p class="small">Not affiliated with or endorsed by NASA.</p>
`;
