// Docs check: the presenter docs must point at code that really exists.
//
//   node scripts/check-docs.mjs
//
// 1. Every file named in CODE_TOUR.md (in backticks) exists.
// 2. Every function on a stop's "Functions:" line is defined in one of that stop's files.
// 3. Every other `name()` mentioned in CODE_TOUR.md is defined somewhere in src/, scripts/ or tests/.
// 4. HOW_IT_WORKS.md and CODE_TOUR.md are each under 120 lines; RUN.md exists.
// 5. Every `node scripts/*.mjs` and `npm run <script>` in RUN.md exists.
// 6. (C1) The words "accurate to" never appear near the NASA trajectory gap (we say "apart": NASA's file
//    is also a prediction): no "accurate to" within 300 characters of "NASA" plus "trajectory"/"OEM" in the
//    public docs and the panel's source.
// 7. (M8) README.md has a "## How we test" section, and every command it names exists: each
//    `node scripts/*.mjs` file, each `npm run <script>` and `npm test` in package.json, `npx tsc` as a
//    devDependency, and the workflow file it points to.
// Exit 0 when everything holds, 1 otherwise. Offline, no dependencies.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_LINES = 120;
const problems = [];
const passes = [];
const read = (rel) => readFileSync(join(root, rel), 'utf8');
const lineCount = (text) => text.replace(/\n$/, '').split('\n').length;
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const PATH_RE = /`([\w./-]+\/[\w.-]+\.(?:ts|mjs|js|json|css|html|md|yml|tle|jpg))`/g;
const CALL_RE = /`([A-Za-z_$][\w$]*)\(\)`/g;

/** True if `source` defines `name` as a function, a const/let/var, or names it in an export list. */
function defines(source, name) {
  const n = escape(name);
  return (
    new RegExp(`\\bfunction\\s*\\*?\\s+${n}\\s*[(<]`).test(source) ||
    new RegExp(`\\b(?:const|let|var)\\s+${n}\\s*[=:]`).test(source) ||
    new RegExp(`export\\s*\\{[^}]*\\b${n}\\b[^}]*\\}`).test(source)
  );
}

function codeFiles(dir) {
  const out = [];
  for (const entry of readdirSync(join(root, dir))) {
    const rel = join(dir, entry);
    if (statSync(join(root, rel)).isDirectory()) out.push(...codeFiles(rel));
    else if (/\.(ts|mjs|js)$/.test(entry)) out.push(relative(root, join(root, rel)).replace(/\\/g, '/'));
  }
  return out;
}

// ---- 4. Line limits.
for (const doc of ['HOW_IT_WORKS.md', 'CODE_TOUR.md', 'RUN.md']) {
  if (!existsSync(join(root, doc))) {
    problems.push(`${doc} is missing`);
    continue;
  }
  const n = lineCount(read(doc));
  if (doc === 'RUN.md') passes.push(`${doc} exists (${n} lines)`);
  else if (n < MAX_LINES) passes.push(`${doc}: ${n} lines (< ${MAX_LINES})`);
  else problems.push(`${doc}: ${n} lines, limit is under ${MAX_LINES}`);
}

// ---- 1-3. CODE_TOUR.md files and functions, stop by stop.
if (existsSync(join(root, 'CODE_TOUR.md'))) {
  const tour = read('CODE_TOUR.md');
  const allCode = [...codeFiles('src'), ...codeFiles('scripts'), ...codeFiles('tests')];
  const sourceOf = new Map(allCode.map((f) => [f, read(f)]));
  const stops = tour.split(/^## /m).slice(1);
  let fileCount = 0;
  let fnCount = 0;
  for (const stop of stops) {
    const title = stop.split('\n')[0].trim();
    const files = [...new Set([...stop.matchAll(PATH_RE)].map((m) => m[1]))];
    for (const f of files) {
      fileCount++;
      if (!existsSync(join(root, f))) problems.push(`[${title}] file not found: ${f}`);
    }
    const fnLine = stop.split('\n').find((l) => /^\s*-\s*Functions?:/.test(l)) ?? '';
    const listed = [...fnLine.matchAll(CALL_RE)].map((m) => m[1]);
    for (const name of listed) {
      fnCount++;
      const where = files.filter((f) => sourceOf.has(f) && defines(sourceOf.get(f), name));
      if (where.length) passes.push(`[${title}] ${name}() defined in ${where.join(', ')}`);
      else problems.push(`[${title}] ${name}() is not defined in any of this stop's files: ${files.join(', ') || '(none)'}`);
    }
    const mentioned = [...new Set([...stop.matchAll(CALL_RE)].map((m) => m[1]))].filter((n) => !listed.includes(n));
    for (const name of mentioned) {
      fnCount++;
      const where = allCode.filter((f) => defines(sourceOf.get(f), name));
      if (where.length) passes.push(`[${title}] ${name}() (mentioned) defined in ${where[0]}`);
      else problems.push(`[${title}] ${name}() is mentioned but not defined anywhere in src/, scripts/ or tests/`);
    }
  }
  if (stops.length === 0) problems.push('CODE_TOUR.md has no "## " stops');
  passes.push(`CODE_TOUR.md: ${stops.length} stops, ${fileCount} file references, ${fnCount} function references checked`);
}

// ---- 5. RUN.md commands.
if (existsSync(join(root, 'RUN.md'))) {
  const run = read('RUN.md');
  const scripts = JSON.parse(read('package.json')).scripts ?? {};
  for (const [, f] of run.matchAll(/node (scripts\/[\w.-]+\.mjs)/g)) {
    if (!existsSync(join(root, f))) problems.push(`RUN.md: ${f} not found`);
  }
  for (const [, s] of run.matchAll(/npm run ([\w:-]+)/g)) {
    if (!(s in scripts)) problems.push(`RUN.md: "npm run ${s}" is not a script in package.json`);
  }
  if (/\bnpm test\b/.test(run) && !('test' in scripts)) problems.push('RUN.md: "npm test" but package.json has no test script');
  passes.push('RUN.md: every node scripts/*.mjs and npm run command checked against the repo');
}

// ---- 6. Wording next to the NASA trajectory gap (C1).
{
  const files = ['README.md', 'HOW_IT_WORKS.md', 'CODE_TOUR.md', 'RUN.md', 'DEVPOST_DRAFT.md', 'docs/STUDY_CARDS.md', 'src/oem-ui.ts', 'src/orbit/oemAgreement.ts'];
  let checked = 0;
  for (const f of files) {
    if (!existsSync(join(root, f))) continue;
    checked++;
    const text = read(f);
    for (const m of text.matchAll(/accurate to/gi)) {
      const near = text.slice(Math.max(0, m.index - 300), m.index + 300);
      if (/NASA/.test(near) && /trajectory|OEM/.test(near)) problems.push(`${f}: "accurate to" next to the NASA trajectory gap (say "apart")`);
    }
  }
  passes.push(`wording: no "accurate to" near the NASA trajectory gap in ${checked} files`);
}

// ---- 7. README "How we test": every command named there exists (M8).
if (existsSync(join(root, 'README.md'))) {
  const readme = read('README.md');
  const start = readme.search(/^## How we test\b/m);
  if (start < 0) problems.push('README.md has no "## How we test" section');
  else {
    const rest = readme.slice(start + 3);
    const end = rest.search(/^## /m);
    const section = end < 0 ? rest : rest.slice(0, end);
    const pkg = JSON.parse(read('package.json'));
    const scripts = pkg.scripts ?? {};
    const dev = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    let n = 0;
    for (const [, f] of section.matchAll(/node (scripts\/[\w.-]+\.mjs)/g)) {
      n++;
      if (!existsSync(join(root, f))) problems.push(`README "How we test": ${f} not found`);
    }
    for (const [, s] of section.matchAll(/npm run ([\w:-]+)/g)) {
      n++;
      if (!(s in scripts)) problems.push(`README "How we test": "npm run ${s}" is not a script in package.json`);
    }
    if (/\bnpm test\b/.test(section)) {
      n++;
      if (!('test' in scripts)) problems.push('README "How we test": "npm test" but package.json has no test script');
    }
    if (/\bnpx tsc\b/.test(section)) {
      n++;
      if (!('typescript' in dev)) problems.push('README "How we test": "npx tsc" but typescript is not in package.json');
    }
    for (const [, f] of section.matchAll(/`(\.github\/workflows\/[\w.-]+\.ya?ml)`/g)) {
      n++;
      if (!existsSync(join(root, f))) problems.push(`README "How we test": ${f} not found`);
    }
    if (n === 0) problems.push('README "How we test" names no command');
    passes.push(`README "How we test": ${n} commands and files checked against the repo`);
  }
}

for (const p of passes) console.log(`ok   ${p}`);
for (const p of problems) console.log(`FAIL ${p}`);
console.log(problems.length ? `DOCS FAIL: ${problems.length} problem(s)` : 'DOCS PASS');
process.exit(problems.length ? 1 : 0);
