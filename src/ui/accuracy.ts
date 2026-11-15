// M7 steps 3 and 4: the "Accuracy and sources" tab. Every measured number with its sample count,
// and the "computed vs fetched" table. Numbers are worked out here from the saved files (the 10
// wheretheiss.at samples, the Heavens-Above list, check-oem.mjs's table) or read from the live
// panels, never typed in by hand.
import refSamples from '../data/wheretheiss-samples.json';
import passFixture from '../../tests/fixtures/passes-ypsilanti-2026-11-14.json';
import { satrecFromTle } from '../orbit/orbit';
import { compareWithReference, type ReferenceSample } from '../orbit/compare';
import { agreementWith, type PassFixture } from '../orbit/passes';
import { agreement } from '../orbit/oemAgreement';
import { oemDetailsHtml } from '../oem-ui';

export const accuracyHtml = `
  <section class="card accuracy" aria-labelledby="accuracy-h">
    <h2 id="accuracy-h">Every measured number, with how many samples it rests on</h2>
    <ul id="accuracy-list" class="accuracy-list"></ul>
    ${oemDetailsHtml}
    <h3>What the page works out itself, and what it fetches</h3>
    <div class="table-wrap">
      <table id="sources-table" class="sources-table">
        <thead><tr><th>On the page</th><th>Computed or fetched</th><th>From where, and when</th></tr></thead>
        <tbody>
          <tr><td>Where the station is, its height and speed, the orbit lines</td><td>computed in your browser</td><td>SGP4 (satellite.js) every second, on orbit numbers fetched from CelesTrak when the page opens (or the copy built into the page)</td></tr>
          <tr><td>When you can see it (the next-pass line, the passes table)</td><td>computed in your browser</td><td>our own pass search on the same orbit numbers</td></tr>
          <tr><td>The area the station can see (the circle)</td><td>computed in your browser</td><td>from the station's height</td></tr>
          <tr><td>The gap to NASA's trajectory</td><td>computed in your browser</td><td>against NASA's trajectory file, saved when the page was built</td></tr>
          <tr><td>The map image</td><td>built in, and fetched</td><td>NASA Blue Marble (cloud-free, no date): built into the page, sharper tiles from NASA GIBS when the page opens. The daily satellite photo (dated, with clouds): NASA GIBS, only when you turn on its switch</td></tr>
          <tr><td>Natural events under the station</td><td>fetched</td><td>NASA EONET, when the page opens (the saved copy if it cannot be reached)</td></tr>
          <tr><td>Astronaut photos</td><td>saved when the page was built</td><td>NASA Image and Video Library, chosen by hand</td></tr>
          <tr><td>The reference position</td><td>fetched</td><td>wheretheiss.at, when you press "Check against reference"</td></tr>
          <tr><td>Cloud cover on the plan card</td><td>fetched</td><td>from Open-Meteo when you plan</td></tr>
          <tr><td>A town that is not in the built-in list</td><td>fetched</td><td>Open-Meteo place search, when you plan</td></tr>
          <tr><td>Station news on the plan card</td><td>fetched</td><td>fetched through Exa, not checked by us; never used for a number</td></tr>
          <tr><td>Which pass the plan picks, and why</td><td>chosen by the AI (with your key) or by the fixed rule</td><td>every number on the card is written by our engine; the audit marks any number in the AI's words that the engine did not return</td></tr>
        </tbody>
      </table>
    </div>
  </section>
`;

interface Live {
  ref: { km: number; at: Date } | null;
  refPresses: number;
  audit: { checked: number; unverified: number } | null;
  aiRuns: number;
  fixedRuns: number;
}
const live: Live = { ref: null, refPresses: 0, audit: null, aiRuns: 0, fixedRuns: 0 };

/** The 10 saved wheretheiss.at samples against our SGP4 on the element set that tracker used. */
function referenceTest() {
  const satrec = satrecFromTle(`${refSamples.tle.line1}\n${refSamples.tle.line2}`);
  const cs = (refSamples.samples as ReferenceSample[]).map((s) => compareWithReference(satrec, s)).filter((c) => c !== null);
  return {
    n: cs.length,
    km: Math.max(...cs.map((c) => c.errorKm)),
    alt: Math.max(...cs.map((c) => Math.abs(c.dAltKm))),
    speed: Math.max(...cs.map((c) => Math.abs(c.dSpeedKmH))),
  };
}

const ref10 = referenceTest();
const fx = passFixture as PassFixture;
const ha = agreementWith(fx);

function li(text: string): HTMLLIElement {
  const el = document.createElement('li');
  el.textContent = text;
  return el;
}

export function renderAccuracy(): void {
  const ul = document.getElementById('accuracy-list');
  if (!ul) return;
  const gapEl = document.getElementById('oem-gap');
  const gapKm = gapEl?.dataset.gapKm;
  const rowTime = gapEl?.dataset.rowTime;
  const w = agreement.within12h;
  ul.replaceChildren(
    li(
      `Reference test, 10 saved samples: our position against wheretheiss.at at ${ref10.n} saved moments (same element set): ` +
        `at most ${ref10.km.toFixed(4)} km apart, height within ${ref10.alt.toFixed(4)} km, speed within ${ref10.speed.toFixed(4)} km/h.`,
    ),
    li(
      live.ref
        ? `Live reference check: ${live.ref.km.toFixed(2)} km from wheretheiss.at at ${live.ref.at.toISOString().slice(11, 19)} UTC (1 sample per press; ${live.refPresses} press${live.refPresses === 1 ? '' : 'es'} this visit).`
        : 'Live reference check: press "Check against reference" for a new sample (1 sample per press; none yet this visit).',
    ),
    li(
      `Passes against Heavens-Above (${fx.observer.name}, their list saved once by hand): ${ha.matched} of ${ha.refCount} passes found, ` +
        `start times within ${ha.maxStartS.toFixed(1)} s, end times within ${ha.maxEndS.toFixed(1)} s, highest point within ${ha.maxPeakDeg.toFixed(1)}°.`,
    ),
    li(
      gapKm && rowTime
        ? `NASA's trajectory, now: ${Number(gapKm).toFixed(1)} km apart at NASA's row time ${rowTime.slice(11, 16)} UTC (1 row).`
        : "NASA's trajectory, now: the built-in file does not cover this moment.",
    ),
    li(
      `NASA's trajectory, measured once (${agreement.measuredOn}, scripts/check-oem.mjs): within 12 h of the orbit numbers' time, ` +
        `${w.rows} rows, at most ${w.maxKm.toFixed(3)} km apart, median ${w.medianKm.toFixed(3)} km.`,
    ),
    li(
      live.audit
        ? `Planner audit, last AI run: ${live.audit.checked} number${live.audit.checked === 1 ? '' : 's'} in the AI's words checked against the engine, ${live.audit.unverified} not traced (${live.aiRuns} AI run${live.aiRuns === 1 ? '' : 's'} and ${live.fixedRuns} fixed-plan run${live.fixedRuns === 1 ? '' : 's'} this visit).`
        : `Planner audit: no AI run yet this visit (${live.fixedRuns} fixed-plan run${live.fixedRuns === 1 ? '' : 's'}; the fixed plan writes every number from the engine).`,
    ),
  );
}

export function recordReference(km: number, at: Date): void {
  live.ref = { km, at };
  live.refPresses++;
  renderAccuracy();
}

export function recordPlanRun(audit: { checked: number; unverified: number } | null): void {
  if (audit) {
    live.audit = audit;
    live.aiRuns++;
  } else live.fixedRuns++;
  renderAccuracy();
}
