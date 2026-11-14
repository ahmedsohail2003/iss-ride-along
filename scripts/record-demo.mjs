// Backup demo capture: headless Chrome plays the demo path on dist/index.html, Playwright records it
// (1280x720 webm, no audio), ffmpeg converts it to docs/demo-backup.mp4 (h264).
//
//   node scripts/record-demo.mjs            needs AC power and 0.8 GB free RAM (PLAN.md section 3)
//   node scripts/record-demo.mjs --force    skip the AC-power check
//
// Captions are drawn into the page by this script only (the app itself is unchanged).
// Not enough RAM after one 60 s wait, or on battery: prints DEFERRED and exits 0.
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
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

const shots = [
  // [seconds on screen, caption, action before the caption]
  [5, 'ISS Ride-Along, built at Hack the Nest 2026', null],
  [7, 'Where the International Space Station is right now: our own orbit math (SGP4), updated every second', null],
  [6, 'Solid line: the last orbit. Dashed line: the next orbit, about 92 minutes each', null],
  [9, 'Check against reference: wheretheiss.at, an independent tracker on the same public orbit data', 'check'],
  [6, 'The orbit data age is always on screen, so you know how fresh the numbers are', null],
];

const workDir = mkdtempSync(join(tmpdir(), 'iss-demo-'));
const browser = await chromium.launch({ channel: 'chrome', headless: true });
let webm;
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: workDir, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
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
  for (const [secs, caption, action] of shots) {
    await page.evaluate((t) => (document.getElementById('demo-caption').textContent = t), caption);
    if (action === 'check') await page.click('#check-ref');
    await page.waitForTimeout(secs * 1000);
  }
  const ref = await page.evaluate(() => document.getElementById('ref-result')?.textContent);
  console.log(`reference result on screen: ${ref}`);
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
console.log(
  `wrote ${OUT}: ${(statSync(OUT).size / 1024 / 1024).toFixed(2)} MB, ${Number(p.format.duration).toFixed(1)} s, ` +
    `${p.streams[0].width}x${p.streams[0].height} ${p.streams[0].codec_name}`,
);
