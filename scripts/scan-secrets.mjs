// M7: the M8 secret-scan pattern (the same regular expression as the publish workflow,
// .github/workflows/pages.yml) over every json, txt, har and log file in evidence/ and docs/,
// plus the literal value of any key in the environment (GEMINI_API_KEY, OPENAI_API_KEY,
// EXA_API_KEY), which is never printed. Prints one line per hit and nothing when clean.
//
//   node scripts/scan-secrets.mjs            exit 0 and no output when clean, exit 1 on any hit
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

// Copied from pages.yml (git grep -E there; a JavaScript regex here, same alternatives). One literal
// is split in two so that this file does not trip the workflow's own scan of tracked files.
const PATTERN = new RegExp(
  [
    String.raw`(api_key|apikey|access_token)\s*[=:]\s*['"]?[A-Za-z0-9_-]{16,}`,
    'DEMO' + '_KEY',
    'AIza[0-9A-Za-z_-]{20,}',
    'ghp_[0-9A-Za-z]{30,}',
    String.raw`\bsk-[A-Za-z0-9_-]{20,}`,
    String.raw`x-goog-api-key['"]?\s*[:=]\s*['"]?[A-Za-z0-9_-]{20,}`,
    'Bearer [A-Za-z0-9_-]{20,}',
  ].join('|'),
);
const EXT = new Set(['.json', '.txt', '.har', '.log']);
const keys = ['GEMINI_API_KEY', 'OPENAI_API_KEY', 'EXA_API_KEY'].map((n) => [n, process.env[n]]).filter(([, v]) => v && v.length >= 8);

function* files(dir) {
  let names = [];
  try {
    names = readdirSync(dir);
  } catch {
    return;
  }
  for (const n of names) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (EXT.has(extname(n).toLowerCase())) yield p;
  }
}

let hits = 0;
for (const dir of ['evidence', 'docs'].map((d) => resolve(d))) {
  for (const f of files(dir)) {
    const lines = readFileSync(f, 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      const where = `${relative(process.cwd(), f)}:${i + 1}`;
      if (PATTERN.test(line)) {
        hits++;
        console.log(`${where}: matches the secret-scan pattern`);
      }
      for (const [name, value] of keys)
        if (line.includes(value)) {
          hits++;
          console.log(`${where}: holds the value of ${name}`);
        }
    });
  }
}
process.exit(hits ? 1 : 0);
