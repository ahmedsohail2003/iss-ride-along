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
// 8. (M9) docs/PRESENTER_PACK.md has exactly 10 judge questions; question 1 is the fixed "Who wrote the
//    code and how did you use AI?" and its answer names Claude Code, Fable 5.2, Opus 5.5, Ahmed and Zach;
//    the three agent questions and the provider question (with the status words) are among them; every
//    answer has a "File:" line whose backticked files all exist, and every `name()` on that line is
//    defined in one of those files. Its 90-second click path has at least 8 rows (smoke.mjs --path
//    presses them on the built page).
// 9. (M9b) docs/PRESENTING.md and docs/CUE_SHEET.md: every number in them appears in the build log's
//    evidence (`.autopilot/PROGRESS.md` beside the repo; a number with decimals may be a rounding of a
//    logged one; clock times, timecodes, list numbers and `code` are not counted as numbers); no part
//    that has not passed its verification run is named (the verdicts are read from the same log, or
//    from docs/VERIFICATION.md where the log is not present, as in CI, which then skips the number
//    rule and says so); every file path they name exists; every `#id` they name is an element id in
//    src/; the 2-minute script's spoken lines (the "> " lines) are 300 words or fewer.
// 10. (C2) Two phrases that overstate the science never appear in the public docs or in src/: "only at dawn
//    and dusk" and "only visible near dawn and dusk" (near midsummer at our latitude the station can be in
//    sunlight all night). The page's own wording: "You can see it only when you are in the dark and it is
//    still in sunlight, which happens in the hours after sunset and before sunrise."
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
  const files = ['README.md', 'HOW_IT_WORKS.md', 'CODE_TOUR.md', 'RUN.md', 'DEVPOST_DRAFT.md', 'docs/STUDY_CARDS.md', 'docs/PRESENTER_PACK.md', 'src/oem-ui.ts', 'src/orbit/oemAgreement.ts'];
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

// ---- 10. Phrases that overstate when the station can be seen (C2).
{
  const BANNED = ['only at dawn and dusk', 'only visible near dawn and dusk'];
  const docs = ['README.md', 'HOW_IT_WORKS.md', 'CODE_TOUR.md', 'RUN.md', 'DEVPOST_DRAFT.md', 'index.html'];
  if (existsSync(join(root, 'docs')))
    for (const e of readdirSync(join(root, 'docs'))) if (e.endsWith('.md')) docs.push(`docs/${e}`);
  const files = [...docs.filter((f) => existsSync(join(root, f))), ...codeFiles('src')];
  for (const f of files) {
    const text = read(f).replace(/\s+/g, ' ').toLowerCase();
    for (const b of BANNED) if (text.includes(b)) problems.push(`${f}: says "${b}" (overstated: say "in the hours after sunset and before sunrise")`);
  }
  passes.push(`wording: neither "${BANNED.join('" nor "')}" in ${files.length} files (public docs and src/)`);
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

// ---- 8. Presenter pack (M9): 10 questions, question 1 fixed, a real file behind every answer.
{
  const PACK = 'docs/PRESENTER_PACK.md';
  if (!existsSync(join(root, PACK))) problems.push(`${PACK} is missing`);
  else {
    const pack = read(PACK);
    const section = (heading) => {
      const start = pack.search(new RegExp(`^## ${heading}`, 'm'));
      if (start < 0) return null;
      const rest = pack.slice(start + 3);
      const end = rest.search(/^## /m);
      return end < 0 ? rest : rest.slice(0, end);
    };
    const qs = section('10 judge questions');
    if (qs === null) problems.push(`${PACK} has no "## 10 judge questions" section`);
    else {
      const blocks = qs.split(/^### /m).slice(1);
      if (blocks.length !== 10) problems.push(`${PACK}: ${blocks.length} judge questions, expected 10`);
      const allCode = new Set([...codeFiles('src'), ...codeFiles('scripts'), ...codeFiles('tests')]);
      let files = 0;
      let fns = 0;
      blocks.forEach((b, i) => {
        const title = b.split('\n')[0].trim();
        const fileLine = b.split('\n').find((l) => /^Files?:/.test(l));
        if (!fileLine) {
          problems.push(`${PACK} question ${i + 1} ("${title}") has no "File:" line`);
          return;
        }
        const named = [...fileLine.matchAll(/`([\w./-]+\.(?:ts|mjs|js|json|md|yml))`/g)].map((m) => m[1]);
        if (!named.length) problems.push(`${PACK} question ${i + 1}: the File: line names no file`);
        for (const f of named) {
          files++;
          if (existsSync(join(root, f))) passes.push(`[pack Q${i + 1}] file exists: ${f}`);
          else problems.push(`[pack Q${i + 1}] file not found: ${f}`);
        }
        for (const [, name] of fileLine.matchAll(CALL_RE)) {
          fns++;
          const where = named.filter((f) => allCode.has(f) && defines(read(f), name));
          if (where.length) passes.push(`[pack Q${i + 1}] ${name}() defined in ${where.join(', ')}`);
          else problems.push(`[pack Q${i + 1}] ${name}() is not defined in any file on its File: line (${named.join(', ')})`);
        }
      });
      const q1 = blocks[0] ?? '';
      if (q1.split('\n')[0].trim() !== '1. Who wrote the code and how did you use AI?') problems.push(`${PACK}: question 1 is not the fixed "Who wrote the code and how did you use AI?"`);
      for (const must of ['Claude Code', 'Fable 5.2', 'Opus 5.5', 'Ahmed', 'Zach']) {
        if (!q1.includes(must)) problems.push(`${PACK}: question 1's answer does not name "${must}"`);
      }
      const titles = blocks.map((b) => b.split('\n')[0].toLowerCase());
      for (const [label, re] of [
        ['why an agent', /why an agent/],
        ['making numbers up', /making numbers up/],
        ['no key or a failed search', /no key.*failed search/],
        ['which AI / provider', /which ai/],
      ]) {
        if (!titles.some((t) => re.test(t))) problems.push(`${PACK}: no question about "${label}"`);
      }
      const provider = blocks.find((b) => /which ai/i.test(b.split('\n')[0])) ?? '';
      if (!/live-tested/.test(provider) || !/tested with saved replies, not live-tested/.test(provider)) problems.push(`${PACK}: the provider answer does not use the status words`);
      passes.push(`${PACK}: ${blocks.length} questions, question 1 fixed, ${files} file references and ${fns} function references behind the answers checked`);
    }
    const path = section('The 90-second click path');
    const rows = path === null ? [] : path.split('\n').filter((l) => /^\|\s*\d+\s*\|/.test(l));
    if (rows.length < 8) problems.push(`${PACK}: the 90-second click path has ${rows.length} rows (expected at least 8)`);
    else passes.push(`${PACK}: click path has ${rows.length} rows (pressed by node scripts/smoke.mjs --path)`);
  }
}

// ---- 9. Presentation plan and cue sheet (M9b).
{
  const DOCS = ['docs/PRESENTING.md', 'docs/CUE_SHEET.md'];
  const LOG = join(root, '..', '.autopilot', 'PROGRESS.md');
  const haveLog = existsSync(LOG);
  const log = haveLog ? readFileSync(LOG, 'utf8') : '';

  // Parts that must not be named until their milestone's verdict line says VERIFIED.
  const UNBUILT = [
    ['M6', 'the game', /\bgame\b|orbit lab|leaderboard|guessing/i],
    ['M7', 'the new first screen', /first screen|where are you\?/i],
    ['A2', 'the calendar file and briefing', /calendar file|\.ics\b|briefing|class handout/i],
    ['C2', 'day and night', /day[ -]and[ -]night|day\/night|terminator|earth.s shadow/i],
    ['C3', 'the plain sentence and screen-reader region', /screen[ -]reader|plain sentence for where/i],
    ['X5', 'the sky view', /sky view|constellation|sky from the station/i],
    ['X3', 'reading the answer aloud', /speech synthesis|text to speech|reads? the answer aloud/i],
    ['X6', 'the forecast lab', /forecast lab|harvest/i],
  ];
  const verdictSource = haveLog ? log : existsSync(join(root, 'docs/VERIFICATION.md')) ? read('docs/VERIFICATION.md') : '';
  const verified = new Set([...verdictSource.matchAll(/^(?:- )?([A-Z]\d+[a-z]?) VERIFIED\b/gm)].map((m) => m[1]));

  // Numbers: strip code, links and addresses, clock times and timecodes, list and heading numbers.
  const NUM_RE = /(?<![\w.,])\d[\d,]*(?:\.\d+)?(?![\w])/g;
  const numbers = (text) =>
    [...text.matchAll(NUM_RE)].map((m) => m[0].replace(/,+$/, '').replace(/,/g, '')).filter((s) => /\d$/.test(s));
  const prose = (text) =>
    text
      .replace(/`[^`\n]*`/g, ' ')
      .replace(/\]\([^)]*\)/g, '] ')
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ')
      .replace(/^(\s*(?:#+\s*|[-*>]\s*)?)\d+[.)](?=\s)/gm, '$1');
  const logNums = numbers(log);
  const decimals = (s) => (s.includes('.') ? s.split('.')[1].length : 0);
  const inLog = (s) => {
    const x = Number(s);
    const d = decimals(s);
    return logNums.some((p) => (d === 0 ? Number(p) === x : decimals(p) >= d && Number(p).toFixed(d) === Number(s).toFixed(d)));
  };

  const srcIds = new Set(codeFiles('src').flatMap((f) => [...read(f).matchAll(/\bid="([\w-]+)"/g)].map((m) => m[1])));

  for (const doc of DOCS) {
    if (!existsSync(join(root, doc))) {
      problems.push(`${doc} is missing`);
      continue;
    }
    const text = read(doc);
    const plain = prose(text);

    if (haveLog) {
      const nums = numbers(plain);
      const missing = [...new Set(nums.filter((n) => !inLog(n)))];
      for (const n of missing) problems.push(`${doc}: the number ${n} is not in .autopilot/PROGRESS.md`);
      if (!missing.length) passes.push(`${doc}: all ${nums.length} numbers found in .autopilot/PROGRESS.md (clock times and list numbers not counted)`);
    } else passes.push(`${doc}: number rule SKIPPED (.autopilot/PROGRESS.md is not in this checkout)`);

    let named = 0;
    for (const [id, label, re] of UNBUILT) {
      if (verified.has(id)) continue;
      const m = text.match(re);
      if (m) problems.push(`${doc}: names ${label} ("${m[0]}"), but ${id} is not VERIFIED`);
      else named++;
    }
    passes.push(`${doc}: names none of the ${named} parts that are not VERIFIED (verdicts from ${haveLog ? 'PROGRESS.md' : 'docs/VERIFICATION.md'}: ${[...verified].join(', ')})`);

    const paths = new Set();
    for (const [, p] of text.matchAll(/`([\w./-]+\.(?:ts|mjs|js|json|css|html|md|yml|mp4|png|tle|txt))`/g)) paths.add(p);
    for (const [, p] of text.matchAll(/\]\(((?!https?:|#)[^)\s#]+)(?:#[^)]*)?\)/g)) paths.add(relative(root, join(root, dirname(doc), p)).replace(/\\/g, '/'));
    let found = 0;
    for (const p of paths) {
      if (existsSync(join(root, p))) found++;
      else problems.push(`${doc}: file not found: ${p}`);
    }
    passes.push(`${doc}: ${found} of ${paths.size} file paths exist`);

    const ids = [...new Set([...text.matchAll(/`#([\w-]+)`/g)].map((m) => m[1]))];
    for (const id of ids) if (!srcIds.has(id)) problems.push(`${doc}: #${id} is not an element id in src/`);
    passes.push(`${doc}: ${ids.filter((i) => srcIds.has(i)).length} of ${ids.length} element ids found in src/`);
  }

  if (existsSync(join(root, DOCS[0]))) {
    const text = read(DOCS[0]);
    const start = text.search(/^## .*2-minute/m);
    if (start < 0) problems.push(`${DOCS[0]} has no "## ... 2-minute ..." script section`);
    else {
      const rest = text.slice(start + 3);
      const end = rest.search(/^## /m);
      const section = end < 0 ? rest : rest.slice(0, end);
      const spoken = section
        .split('\n')
        .filter((l) => /^>\s/.test(l))
        .map((l) => l.replace(/^>\s*/, '').replace(/\*\*[^*]+:\*\*/g, ''))
        .join(' ');
      const words = spoken.split(/\s+/).filter((w) => /[\w\d]/.test(w)).length;
      if (words === 0) problems.push(`${DOCS[0]}: the 2-minute script has no spoken ("> ") lines`);
      else if (words > 300) problems.push(`${DOCS[0]}: the 2-minute script is ${words} spoken words (limit 300)`);
      else passes.push(`${DOCS[0]}: the 2-minute script is ${words} spoken words (limit 300)`);
    }
  }
}

for (const p of passes) console.log(`ok   ${p}`);
for (const p of problems) console.log(`FAIL ${p}`);
console.log(problems.length ? `DOCS FAIL: ${problems.length} problem(s)` : 'DOCS PASS');
process.exit(problems.length ? 1 : 0);
