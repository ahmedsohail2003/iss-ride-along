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
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { freemem, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const FORCE = process.argv.includes('--force');
const OUT = resolve('docs/demo-backup.mp4');
const url = pathToFileURL(resolve('dist/index.html')).href;
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
  await say(`The plan card and the next-pass line (${caption})`);
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
  await say(`ISS Ride-Along: ${caption}`);
  await pause(4);
  const ref = await page.evaluate(() => document.getElementById('ref-result')?.textContent);
  console.log(`planner: ${note} (${planSeconds.toFixed(1)} s); model ${model ?? 'none'}; caption "${caption}"`);
  console.log(`reference result on screen: ${ref}`);
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
if (mb >= 25 || scanFailed) process.exit(1);
