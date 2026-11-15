// Backup demo capture: headless Chrome plays the demo path on dist/index.html, Playwright records it
// (1280x720 webm, no audio), ffmpeg converts it to docs/demo-backup.mp4 (h264).
//
//   node scripts/record-demo.mjs            needs AC power and 0.8 GB free RAM (PLAN.md section 3)
//   node scripts/record-demo.mjs --force    skip the AC-power check
//
// Captions are drawn into the page by this script only (the app itself is unchanged).
// Not enough RAM after one 60 s wait, or on battery: prints DEFERRED and exits 0.
//
// M7: the video opens with a planner run on the real network. With GEMINI_API_KEY in the process
// environment (loaded by Node itself: node --env-file=<key file> scripts/record-demo.mjs), the key is
// put into the tab's sessionStorage by addInitScript, the same place the "keep until this tab is
// closed" tick box uses, so the settings box is never opened on camera; the trip example is planned
// by the AI. Without a key the stranger's path is shown: "Detroit" + Enter, fixed plan, no AI.
// Playwright tracing and HAR recording stay off (a HAR would hold the key header). The caption names
// the model id from the request address (the key is in a header, never in the address) or says
// "fixed plan, no AI"; it is also written to docs/demo-backup.txt. Last, scripts/scan-secrets.mjs
// runs over evidence/ and docs/ and must print nothing.
//
// M10: after the reference check, one short captioned scene per part verified later (the plain
// sentence, day and night, the daily-photo switch, the NASA layers, the Forecast lab, the sky from the
// station with a drag and a zoom, one game round, read aloud, the calendar file and sheets). A scene
// that fails is printed and makes the script exit 1, as do a file of 25 MB or more and a video over 180 s.
//
// G4: the video opens the demo address (?view=3d) the way the team will, on this laptop's own graphics
// chip (headless Chrome with no SwiftShader flags, as `smoke.mjs --view auto --gpu` launches it). It
// waits for the globe, shows the globe turning to the chosen pass and one drag, scrolls once through the
// story below the tool, then the rest as before (the daily-photo switch and Play open the flat page, as
// built); at the end it presses "3D" to come back to the globe. If the globe never appears (no frames,
// no image), the recording stops with GLOBE FAIL and exit 1, and docs/demo-backup.mp4 is not replaced.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { freemem, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const FORCE = process.argv.includes('--force');
const OUT = resolve('docs/demo-backup.mp4');
const url = pathToFileURL(resolve('dist/index.html')).href + '?view=3d';
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const FFPROBE = process.env.FFPROBE || 'ffprobe';

function onAcPower() {
  try {
    const s = execFileSync('powershell', ['-NoProfile', '-Command', '(Get-CimInstance Win32_Battery).BatteryStatus'], {
      encoding: 'utf8',
    }).trim();
    return s === '' || s.split(/\s+/).some((v) => v === '2'); // no battery = desktop = AC; 2 = on AC
  } catch {
    return true;
  }
}

if (!FORCE && !onAcPower()) {
  console.log('DEFERRED on battery: record-demo runs on AC power only (or pass --force)');
  process.exit(0);
}
const gb = () => freemem() / 1024 ** 3;
if (gb() < 0.8) {
  console.log(`free RAM ${gb().toFixed(2)} GB < 0.8 GB; waiting 60 s and retrying once`);
  await new Promise((r) => setTimeout(r, 60_000));
  if (gb() < 0.8) {
    console.log(`DEFERRED low RAM (${gb().toFixed(2)} GB free)`);
    process.exit(0);
  }
}

const KEY = process.env.GEMINI_API_KEY || '';
const recordedAt = new Date();
const clock = recordedAt.toLocaleString('en-US', { timeZone: 'America/Detroit', dateStyle: 'medium', timeStyle: 'short' }) + ' EST';

const workDir = mkdtempSync(join(tmpdir(), 'iss-demo-'));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
let webm;
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: workDir, size: { width: 1280, height: 720 } },
  });
  if (KEY) await context.addInitScript((k) => sessionStorage.setItem('iss-ride-along-keys', JSON.stringify({ gemini: k })), KEY);
  const page = await context.newPage();
  const models = new Set();
  page.on('request', (r) => {
    const m = /generativelanguage\.googleapis\.com\/v1beta\/models\/([^/:?]+):generateContent/.exec(r.url());
    if (m) models.add(m[1]);
  });
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => /\d/.test(document.getElementById('lat')?.textContent ?? ''));
  // G4: the globe, drawn on the real chip, before any scene is recorded.
  const globeOk = await page
    .waitForFunction(() => document.body.dataset.view === '3d' && document.getElementById('globe')?.dataset.image === 'loaded' && Number(document.getElementById('globe')?.dataset.frames ?? 0) > 3, null, { timeout: 20_000 })
    .then(() => true)
    .catch(() => false);
  const renderer = await page.evaluate(() => document.getElementById('globe')?.dataset.renderer ?? null);
  console.log(`globe: ${globeOk ? 'shown' : 'NOT shown'}; renderer ${renderer}`);
  if (!globeOk) {
    console.log('GLOBE FAIL: the globe did not appear; docs/demo-backup.mp4 is not replaced');
    await browser.close();
    rmSync(workDir, { recursive: true, force: true });
    process.exit(1);
  }
  await page.evaluate(() => {
    const c = document.createElement('div');
    c.id = 'demo-caption';
    c.style.cssText =
      'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);max-width:1100px;z-index:10000;' +
      'background:rgba(5,8,20,0.88);color:#fff;font:600 22px system-ui,Segoe UI,sans-serif;' +
      'padding:10px 18px;border-radius:8px;border:1px solid #7fdbff;text-align:center';
    document.body.appendChild(c);
  });
  const say = (t) => page.evaluate((x) => (document.getElementById('demo-caption').textContent = x), t);
  const pause = (s) => page.waitForTimeout(s * 1000);
  const mode = KEY ? 'with a Gemini key' : 'fixed plan, no AI';
  await say(`ISS Ride-Along, Hack the Nest 2026. Recorded ${clock}, ${mode}`);
  await pause(4);
  await say('Where will you be, and when are you free? Type it in your own words');
  if (KEY) await page.click('button.example[data-example="trip"]');
  else await page.fill('#plan-sentence', 'Detroit');
  await pause(4);
  await say(KEY ? 'The AI chooses which engine steps to run; every number comes from our own orbit engine' : 'Press Enter: the next time you can see it, computed in your browser');
  const t0 = Date.now();
  await page.press('#plan-sentence', 'Enter');
  await page.waitForFunction(() => /Planned by the AI|Fixed plan/.test(document.getElementById('plan-note')?.textContent ?? ''), null, { timeout: 40_000 }).catch(() => {});
  const planSeconds = (Date.now() - t0) / 1000;
  const note = await page.textContent('#plan-note');
  const aiUsed = /Planned by the AI/.test(note ?? '');
  const model = [...models][0] ?? null;
  const caption = aiUsed && model ? `recorded ${clock} with Gemini ${model}` : `recorded ${clock}, fixed plan, no AI`;
  await pause(Math.max(0, 3 - planSeconds));
  await say(`The globe turns to the chosen pass; the plan card and the next-pass line (${caption})`);
  await pause(7);
  await page.locator('#plan-trace').scrollIntoViewIfNeeded();
  await say('Steps: which tool ran, who chose it and what came back');
  await pause(6);
  await page.evaluate(() => window.scrollTo(0, 0));
  await say('Where the station is right now: our own orbit math (SGP4), updated every second');
  await pause(6);
  await say('How accurate is this? An independent tracker, and NASA mission control\'s own trajectory');
  await page.click('#check-ref');
  await pause(8);

  // M10: one short scene for each part verified after the 8:26 PM recording. Each scene is guarded:
  // if one fails, the video carries on and the failure is printed (and makes the script exit 1).
  const scenes = [];
  const scene = async (name, fn) => {
    const s0 = Date.now();
    try {
      await fn();
      scenes.push({ name, ok: true, s: (Date.now() - s0) / 1000 });
    } catch (e) {
      scenes.push({ name, ok: false, s: (Date.now() - s0) / 1000, error: String(e?.message ?? e).split('\n')[0] });
    }
  };
  const top = () => page.evaluate(() => window.scrollTo(0, 0));
  const toView = (sel) => page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'start' }), sel);
  const openTab = async (id) => {
    await page.click(`#tab-btn-${id}`);
    await toView(`#tab-btn-${id}`);
  };

  // G4: the globe itself (one drag) and one pass through the scroll story below the tool.
  await scene('the 3D globe (G1, G2)', async () => {
    await top();
    await page.locator('#globe').scrollIntoViewIfNeeded();
    await say('A 3D globe drawn from our own orbit math: the station, its last and next orbit, the night side, what the crew can see');
    await pause(3);
    const b = await page.locator('#globe canvas').boundingBox();
    await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.5);
    await page.mouse.down();
    for (let k = 1; k <= 30; k++) {
      await page.mouse.move(b.x + b.width * (0.5 - 0.008 * k), b.y + b.height * (0.5 + 0.002 * k));
      await page.waitForTimeout(30);
    }
    await page.mouse.up();
    await say('Drag to turn it: computed positions drawn on NASA\'s Blue Marble, not a live camera. "Flat page" is one press away');
    await pause(4);
  });
  await scene('scroll story (G3)', async () => {
    const ids = await page.$$eval('#story .scene', (es) => es.map((e) => e.id));
    if (ids.length !== 6) throw new Error(`#story has ${ids.length} scenes`);
    await say('Below the tool, a short story turns the globe as you scroll, with the real stars behind it');
    for (const id of ids) {
      await page.evaluate((i) => document.getElementById(i).scrollIntoView({ block: 'center', behavior: 'smooth' }), id);
      await pause(2.5);
    }
    await top();
    await pause(1);
  });
  await scene('plain sentence (C3)', async () => {
    await top();
    const where = (await page.textContent('#where-now'))?.trim();
    if (!where) throw new Error('#where-now is empty');
    await say(`One plain sentence for where it is, read once a minute to screen readers: "${where}"`);
    await pause(6);
  });
  await scene('day and night (C2)', async () => {
    const sunlit = (await page.textContent('#sunlit'))?.trim();
    await say(`The shaded half of the Earth is night right now. The station: ${sunlit}`);
    await pause(6);
  });
  await scene('daily photo switch (P2)', async () => {
    await page.waitForFunction(() => !document.getElementById('daily-toggle')?.disabled, null, { timeout: 8000 });
    await page.check('#daily-toggle');
    await say('One switch shows NASA\'s satellite photo of the day, clouds and all, on the flat page (it opens there by design)');
    await pause(6);
    await page.uncheck('#daily-toggle');
  });
  await scene('NASA layers (M4)', async () => {
    await openTab('nasa');
    await say('Under the station: NASA\'s open natural events in view, and an astronaut photo, each dated and credited');
    await pause(6);
  });
  await scene('forecast lab (X6)', async () => {
    await page.click('#forecast-open');
    await page.waitForFunction(() => !document.getElementById('forecast-card')?.hidden, null, { timeout: 5000 });
    await toView('#forecast-lab');
    const y = (await page.textContent('[data-skill-yield]'))?.trim();
    const p = (await page.textContent('[data-skill-price]'))?.trim();
    await say(`Forecast lab: satellite greenness forecast the US corn harvest with skill ${y}; the corn price: ${p}. Research demo, not investment advice`);
    await pause(9);
  });
  await scene('sky from the station (X5, X5b)', async () => {
    await openTab('sky');
    await page.waitForFunction(() => !!document.getElementById('sky-canvas')?.dataset.drawnAt, null, { timeout: 10_000 });
    await page.evaluate(() => document.getElementById('sky-canvas').scrollIntoView({ block: 'center' }));
    await say('The sky above the station right now: 1,627 stars and 88 constellations. Drag to look around, scroll to zoom');
    await pause(3);
    const b = await page.locator('#sky-canvas').boundingBox();
    await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.5);
    await page.mouse.down();
    for (let k = 1; k <= 20; k++) await page.mouse.move(b.x + b.width * (0.5 - 0.012 * k), b.y + b.height * (0.5 + 0.006 * k));
    await page.mouse.up();
    await pause(2);
    await page.mouse.wheel(0, -400);
    await pause(2);
    await page.click('#sky-reset');
    await say('"Back to the station\'s view" follows the station again');
    await pause(3);
  });
  await scene('game (M6)', async () => {
    await openTab('game');
    await say('Game: tap where the station will be in 10 minutes. The score is how many km you were off');
    await pause(3);
    await page.click('#game-start');
    await page.waitForFunction(() => document.body.dataset.game === 'guessing', null, { timeout: 5000 });
    let box = await page.locator('#map').boundingBox();
    for (let k = 0; k < 30; k++) {
      await page.waitForTimeout(100);
      const again = await page.locator('#map').boundingBox();
      if (again.y === box.y && again.x === box.x) break;
      box = again;
    }
    await pause(1);
    await page.mouse.click(box.x + 0.62 * box.width, box.y + 0.62 * box.height);
    await page.waitForFunction(() => ['scored', 'done'].includes(document.body.dataset.game ?? ''), null, { timeout: 8000 });
    const score = (await page.textContent('#game-score'))?.trim();
    await say(`Round 1: ${score}. The answer is our own orbit math, run 10 minutes ahead`);
    await pause(6);
    await page.click('#game-stop');
  });
  await scene('read aloud (X3)', async () => {
    await top();
    if (!(await page.isVisible('#voice-toggle'))) throw new Error('#voice-toggle not shown (no speechSynthesis)');
    await page.locator('#voice-toggle').scrollIntoViewIfNeeded();
    await say('"Read aloud" speaks that sentence and the plan with the browser\'s own voice (this video has no sound)');
    await pause(5);
  });
  await scene('calendar file and sheets (A2)', async () => {
    await page.locator('#plan-outputs').scrollIntoViewIfNeeded();
    await say('For the chosen pass: a calendar file, a family sheet and a class handout');
    await pause(5);
  });

  await scene('back to the globe (G4)', async () => {
    await top();
    await page.click('#view-3d');
    await page.waitForFunction(() => document.body.dataset.view === '3d', null, { timeout: 5000 });
    await say('Press "3D" and the globe is back');
    await pause(3);
  });
  await top();
  await say(`ISS Ride-Along: ${caption}`);
  await pause(4);
  const ref = await page.evaluate(() => document.getElementById('ref-result')?.textContent);
  console.log(`planner: ${note} (${planSeconds.toFixed(1)} s); model ${model ?? 'none'}; caption "${caption}"`);
  console.log(`reference result on screen: ${ref}`);
  for (const s of scenes) console.log(`scene ${s.ok ? 'ok  ' : 'FAIL'} ${s.name} (${s.s.toFixed(1)} s)${s.ok ? '' : `: ${s.error}`}`);
  globalThis.__scenesFailed = scenes.filter((s) => !s.ok).length;
  globalThis.__caption = caption;
  await context.close(); // flushes the video
  webm = readdirSync(workDir).find((f) => f.endsWith('.webm'));
} finally {
  await browser.close();
}

mkdirSync(resolve('docs'), { recursive: true });
execFileSync(
  FFMPEG,
  ['-y', '-loglevel', 'error', '-i', join(workDir, webm), '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '23', '-movflags', '+faststart', '-an', OUT],
  { stdio: 'inherit' },
);
rmSync(workDir, { recursive: true, force: true });
const probe = execFileSync(
  FFPROBE,
  ['-v', 'error', '-show_entries', 'format=duration:stream=width,height,codec_name', '-of', 'json', OUT],
  { encoding: 'utf8' },
);
const p = JSON.parse(probe);
const mb = statSync(OUT).size / 1024 / 1024;
console.log(
  `wrote ${OUT}: ${mb.toFixed(2)} MB, ${Number(p.format.duration).toFixed(1)} s, ` +
    `${p.streams[0].width}x${p.streams[0].height} ${p.streams[0].codec_name}`,
);
writeFileSync(resolve('docs/demo-backup.txt'), `docs/demo-backup.mp4: ${globalThis.__caption}. Screen capture of the built page, no sound, ${Number(p.format.duration).toFixed(0)} s.\n`);
// The M8 scan pattern (and the key's own value) over evidence/ and docs/: must print nothing.
let scanFailed = false;
try {
  execFileSync(process.execPath, [resolve('scripts/scan-secrets.mjs')], { stdio: 'inherit' });
} catch {
  scanFailed = true;
}
console.log(scanFailed ? 'SCAN FAIL: see the lines above' : 'scan over evidence/ and docs/: no hits');
const tooLong = Number(p.format.duration) > 180;
if (tooLong) console.log('TOO LONG: over 180 s');
if (globalThis.__scenesFailed) console.log(`SCENES FAILED: ${globalThis.__scenesFailed}`);
if (mb >= 25 || scanFailed || tooLong || globalThis.__scenesFailed) process.exit(1);
