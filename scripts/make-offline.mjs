// Copy the built single-file page to docs/iss-ride-along-offline.html, the file teammates double-click
// (or receive as a Discord attachment) to run the tracker with no server and no internet.
//
//   npm run offline            build, then this script
//   node scripts/make-offline.mjs
//
// Fails (exit 1) if dist/index.html is missing, loads anything over http(s) as a script, stylesheet
// or image, or is 8 MB or larger (Discord's attachment limit; PLAN.md M3).
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const LIMIT_BYTES = 8 * 1024 * 1024;
const src = resolve('dist/index.html');
const out = resolve('docs/iss-ride-along-offline.html');

if (!existsSync(src)) {
  console.log('OFFLINE FAIL: dist/index.html not found; run npm run build first');
  process.exit(1);
}

const html = readFileSync(src, 'utf8');
// A tag that pulls code, styles or images from the network would break the page with Wi-Fi off.
const external = [...html.matchAll(/<(script|link|img)\b[^>]*\b(?:src|href)\s*=\s*["']?https?:/gi)].map((m) => m[0]);
const bytes = statSync(src).size;
const problems = [];
if (external.length) problems.push(`${external.length} tag(s) load from http(s): ${external.join(' | ')}`);
if (bytes >= LIMIT_BYTES) problems.push(`${bytes} bytes is not under the 8 MB limit (${LIMIT_BYTES} bytes)`);

if (problems.length) {
  for (const p of problems) console.log(`OFFLINE FAIL: ${p}`);
  process.exit(1);
}

mkdirSync(resolve('docs'), { recursive: true });
copyFileSync(src, out);
const sha = createHash('sha256').update(readFileSync(out)).digest('hex');
console.log(
  JSON.stringify(
    { file: 'docs/iss-ride-along-offline.html', bytes, mb: +(bytes / 1024 / 1024).toFixed(3), limitBytes: LIMIT_BYTES, externalTags: 0, sha256: sha },
    null,
    2,
  ),
);
console.log(`OFFLINE PASS: docs/iss-ride-along-offline.html ${bytes} bytes (${(bytes / 1024 / 1024).toFixed(2)} MB, limit 8 MB)`);
