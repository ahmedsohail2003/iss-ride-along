// Fingerprint of everything that goes into the built page: index.html plus every file under src/.
// vite.config.ts writes it into the build as <meta name="iss-source-hash">, and smoke.mjs recomputes
// it before opening a page, so a page built before the latest source change fails the smoke test
// instead of being checked as if it were current (M4 fix r2: the r1 source fix was tested, but the
// page on disk was the older build).
//
//   node scripts/source-hash.mjs        prints the hash of the current source
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SOURCE_HASH_META = 'iss-source-hash';
const TEXT = /\.(ts|js|mjs|json|html|css|tle|txt|md|svg)$/i;

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)],
  );
}

export function sourceHash(root = process.cwd()) {
  const files = [resolve(root, 'index.html'), ...walk(resolve(root, 'src'))]
    .map((f) => ({ f, rel: relative(root, f).split('\\').join('/') }))
    .sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
  const h = createHash('sha256');
  for (const { f, rel } of files) {
    let bytes = readFileSync(f);
    // Line endings can change on checkout (core.autocrlf); they do not change the page.
    if (TEXT.test(rel)) bytes = Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'), 'utf8');
    h.update(rel).update('\0').update(bytes).update('\0');
  }
  return h.digest('hex').slice(0, 16);
}

// The hash a built page carries, or null if it has none (built before this check existed).
export function builtHash(html) {
  const m = html.match(new RegExp(`<meta name="${SOURCE_HASH_META}" content="([0-9a-f]+)"`));
  return m ? m[1] : null;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) console.log(sourceHash());
