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
// 9. (M9b; B4; T1) docs/PRESENTING.md, docs/CUE_SHEET.md, the DEV post draft docs/DEV_POST.md and the
//    final Devpost text DEVPOST_DRAFT.md (the text a teammate pastes): every
//    number in them appears in the build log's
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
// 11. (B3) The "## What we learned" section of the submission kit (`SUBMISSION.md` beside the repo; the
//    Best Beginner words): every number in it appears in the build log (same rule as 9); its
//    `- Who wrote the code: "..."` line is word for word from question 1 of docs/PRESENTER_PACK.md and
//    names Claude Code, Fable 5.2, Opus 5.5 and Ahmed; it keeps one line each for Quinn, Denim and
//    Armeis, and no line they wrote says "we coded", "I programmed" or "we wrote the code". A line still
//    marked [FILL] is printed as "wait", not as a failure: those words are the teammate's own. Skipped,
//    and said so, where the kit is not present (CI).
// 12. (B4) The DEV post draft docs/DEV_POST.md (besides rules 6, 9 and 10): it discloses the AI build
//    (names Claude Code, Fable 5.2, Opus 5.5 and Ahmed), carries the #mlhacks tag and the line "Not
//    affiliated with or endorsed by NASA", stays "published: false" (publishing is a human step), and
//    never says "we coded", "I programmed" or "we wrote the code".
// 13. (T1) The final Devpost text DEVPOST_DRAFT.md (besides rules 6, 9 and 10): the honesty lines are in
//    it (Claude Code, Fable 5.2, Opus 5.5, Ahmed; Gemini live-tested; the OpenAI adapter "not
//    live-tested"; "Not affiliated with or endorsed by NASA"; CelesTrak as US Space Force data; "not
//    investment advice"; the RoBuff line); "accurate to" and "in progress" appear nowhere (every part is
//    VERIFIED, so what is open is listed as not done); nobody says "we coded" or "we wrote the code";
//    its test count is the README table's; "Built with" has three.js. Its story block (the markdown
//    box) is 900 words or fewer without the three teammates' own lines, has no table and no HTML,
//    carries the kit's 3D paragraph word for word (where the kit is present), words "who wrote the code"
//    as question 1 of docs/PRESENTER_PACK.md does, and keeps one line each for Quinn, Denim and Armeis
//    ("wait" while a line is still marked [FILL], as in rule 11).
// Exit 0 when everything holds, 1 otherwise. Offline, no dependencies.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MAX_LINES = 120;
const problems = [];
const passes = [];
const waits = []; // not failures: words a named person still has to write
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
  const files = ['README.md', 'HOW_IT_WORKS.md', 'CODE_TOUR.md', 'RUN.md', 'DEVPOST_DRAFT.md', 'docs/STUDY_CARDS.md', 'docs/PRESENTER_PACK.md', 'docs/DEV_POST.md', 'src/oem-ui.ts', 'src/orbit/oemAgreement.ts'];
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

// ---- The build log and the number rule, shared by checks 9 and 11.
const LOG = join(root, '..', '.autopilot', 'PROGRESS.md');
const haveLog = existsSync(LOG);
const log = haveLog ? readFileSync(LOG, 'utf8') : '';
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

// ---- 9. Presentation plan and cue sheet (M9b).
{
  const DOCS = ['docs/PRESENTING.md', 'docs/CUE_SHEET.md', 'docs/DEV_POST.md', 'DEVPOST_DRAFT.md']; // DEV_POST.md: B4; DEVPOST_DRAFT.md: T1

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
    ['P2', 'the clear map', /blue marble|clear map/i], // T1: the parts the 3D text names
    ['G1', 'the 3D globe', /3D globe|three\.js/i],
    ['G3', 'the scroll story', /scroll story/i],
  ];
  const verdictSource = haveLog ? log : existsSync(join(root, 'docs/VERIFICATION.md')) ? read('docs/VERIFICATION.md') : '';
  const verified = new Set([...verdictSource.matchAll(/^(?:- )?([A-Z]\d+[a-z]?) VERIFIED\b/gm)].map((m) => m[1]));

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

// ---- 11. "What we learned", the Best Beginner words in the submission kit (B3).
{
  const KIT = join(root, '..', 'SUBMISSION.md'); // beside the repo, like the build log
  const PACK = 'docs/PRESENTER_PACK.md';
  const LABEL = 'SUBMISSION.md "What we learned"';
  const PEOPLE = ['Quinn', 'Denim', 'Armeis']; // the three at their first hackathon
  const MUST = ['Claude Code', 'Fable 5.2', 'Opus 5.5', 'Ahmed'];
  const OVERCLAIM = /\b(?:we|i)\s+(?:all\s+)?(?:coded|programmed|wrote\s+(?:all\s+)?(?:of\s+)?(?:the|this|our|its)\s+code)\b/i;
  const flat = (s) => s.replace(/\s+/g, ' ').trim();

  if (!existsSync(KIT)) passes.push(`${LABEL}: SKIPPED (the submission kit is not in this checkout)`);
  else {
    const kit = readFileSync(KIT, 'utf8');
    const start = kit.search(/^## What we learned\b/m);
    if (start < 0) problems.push('SUBMISSION.md has no "## What we learned" section');
    else {
      const rest = kit.slice(start + 3);
      const end = rest.search(/^## /m);
      const section = '## ' + (end < 0 ? rest : rest.slice(0, end));

      // (a) Every number in the section is in the build log.
      if (haveLog) {
        const nums = numbers(prose(section));
        const missing = [...new Set(nums.filter((n) => !inLog(n)))];
        for (const n of missing) problems.push(`${LABEL}: the number ${n} is not in .autopilot/PROGRESS.md`);
        if (!missing.length) passes.push(`${LABEL}: all ${nums.length} numbers found in .autopilot/PROGRESS.md (clock times and list numbers not counted)`);
      } else passes.push(`${LABEL}: number rule SKIPPED (.autopilot/PROGRESS.md is not in this checkout)`);

      // (b) "Who wrote the code" is question 1's own sentence, not a new wording.
      const q1 = existsSync(join(root, PACK))
        ? flat(read(PACK).split(/^### /m).find((b) => b.startsWith('1. Who wrote the code')) ?? '')
        : '';
      const who = section.match(/^- Who wrote the code: "([^"\n]+)"/m);
      if (!q1) problems.push(`${LABEL}: question 1 ("Who wrote the code ...") not found in ${PACK}, so the line cannot be compared`);
      else if (!who) problems.push(`${LABEL}: no line of the form - Who wrote the code: "..."`);
      else {
        const said = flat(who[1]).replace(/[.!]+$/, '');
        const lacks = MUST.filter((m) => !said.includes(m));
        if (!q1.includes(said)) problems.push(`${LABEL}: "Who wrote the code" is not worded as in question 1 of ${PACK}: "${said}"`);
        else if (lacks.length) problems.push(`${LABEL}: "Who wrote the code" does not name ${lacks.join(', ')}`);
        else passes.push(`${LABEL}: "Who wrote the code" is word for word from question 1 of ${PACK} and names ${MUST.join(', ')}`);
      }

      // (c) One line per first-timer, in their own words; none of them says the team wrote the code.
      const filled = [];
      const waiting = [];
      for (const name of PEOPLE) {
        const at = section.search(new RegExp(`^- ${name}:`, 'm'));
        if (at < 0) {
          problems.push(`${LABEL}: no "- ${name}:" line`);
          continue;
        }
        const own = section.slice(at).split(/\n(?=- |\s*\n|#)/)[0].replace(new RegExp(`^- ${name}:`), '').trim();
        if (!own || /\[FILL\]/.test(own)) waiting.push(name);
        else {
          filled.push(name);
          const m = own.match(OVERCLAIM);
          if (m) problems.push(`${LABEL}: ${name}'s line says "${m[0]}"; question 1 says who wrote the code (say what you tested, checked or learned)`);
        }
      }
      if (filled.length) passes.push(`${LABEL}: ${filled.length} of ${PEOPLE.length} first-timers' own lines are in (${filled.join(', ')})`);
      if (waiting.length) waits.push(`${LABEL}: ${waiting.length} of ${PEOPLE.length} lines still to be written by the person named (${waiting.join(', ')}); the Best Beginner words are not complete until all are in`);
    }
  }
}

// ---- 12. The DEV post draft (B4): AI disclosure, tag, NASA line, still a draft, no overclaim.
{
  const POST = 'docs/DEV_POST.md';
  if (!existsSync(join(root, POST))) problems.push(`${POST} is missing`);
  else {
    const post = read(POST);
    const before = problems.length;
    for (const must of ['Claude Code', 'Fable 5.2', 'Opus 5.5', 'Ahmed', '#mlhacks', 'Not affiliated with or endorsed by NASA']) {
      if (!post.includes(must)) problems.push(`${POST}: does not contain "${must}"`);
    }
    if (!/^published:\s*false\s*$/m.test(post)) problems.push(`${POST}: front matter is not "published: false" (publishing waits for a human)`);
    const over = post.match(/\b(?:we|i)\s+(?:all\s+)?(?:coded|programmed|wrote\s+(?:all\s+)?(?:of\s+)?(?:the|this|our|its)\s+code)\b/i);
    if (over) problems.push(`${POST}: says "${over[0]}" (the code was written by Claude Code; say what was checked or learned)`);
    if (problems.length === before) passes.push(`${POST}: AI disclosure (Claude Code, Fable 5.2, Opus 5.5, Ahmed), #mlhacks, the NASA line, "published: false", no overclaim`);
  }
}

// ---- 13. The final Devpost text (T1): honesty lines, no stale wording, the story block's shape.
{
  const DRAFT = 'DEVPOST_DRAFT.md';
  const PACK = 'docs/PRESENTER_PACK.md';
  const KIT = join(root, '..', 'SUBMISSION.md');
  const PEOPLE = ['Quinn', 'Denim', 'Armeis'];
  const OVERCLAIM = /\b(?:we|i)\s+(?:all\s+)?(?:coded|programmed|wrote\s+(?:all\s+)?(?:of\s+)?(?:the|this|our|its)\s+code)\b/i;
  const flat = (s) => s.replace(/\s+/g, ' ').trim();
  if (!existsSync(join(root, DRAFT))) problems.push(`${DRAFT} is missing`);
  else {
    const draft = read(DRAFT).replace(/\r\n/g, '\n'); // a clean export on Windows may come out with CRLF
    const before = problems.length;
    const one = flat(draft);

    // (a) The honesty lines.
    const MUST = [
      'Claude Code',
      'Fable 5.2',
      'Opus 5.5',
      'Ahmed',
      'live-tested with Gemini',
      'not live-tested',
      'Not affiliated with or endorsed by NASA',
      'US Space Force tracking data, not NASA',
      'not investment advice',
      "modelled on Ahmed's earlier RoBuff page; all code was written new at this event",
    ];
    for (const must of MUST) if (!one.includes(must)) problems.push(`${DRAFT}: does not contain "${must}"`);
    if (problems.length === before)
      passes.push(`${DRAFT}: the ${MUST.length} honesty lines are in (AI tools and how, Gemini live-tested, OpenAI not live-tested, the NASA line, CelesTrak as US Space Force data, not investment advice, the RoBuff line)`);

    // (b) Wording that must not come back.
    const mid = problems.length;
    for (const [re, why] of [
      [/accurate to/i, 'the gap to NASA is a distance apart, never accuracy'],
      [/in progress/i, 'every part is VERIFIED; say what is not done under "Not done yet"'],
    ]) {
      const m = draft.match(re);
      if (m) problems.push(`${DRAFT}: says "${m[0]}" (${why})`);
    }
    const over = draft.match(OVERCLAIM);
    if (over) problems.push(`${DRAFT}: says "${over[0]}" (the code was written by Claude Code; say what was tested, checked or learned)`);
    if (problems.length === mid) passes.push(`${DRAFT}: no "accurate to", no "in progress", nobody is said to have written the code but the AI tools`);

    // (c) The test count is the README table's.
    const mine = draft.match(/(\d+) of \1 automated tests/);
    const theirs = existsSync(join(root, 'README.md')) ? read('README.md').match(/\| `npm test` \|[^\n]*?\| (\d+) of \1 passed/) : null;
    if (!mine) problems.push(`${DRAFT}: no "N of N automated tests" line`);
    else if (!theirs) problems.push(`README.md: the "How we test" table has no "N of N passed" result for npm test, so ${DRAFT}'s count cannot be compared`);
    else if (mine[1] !== theirs[1]) problems.push(`${DRAFT}: says ${mine[1]} automated tests, the README table says ${theirs[1]}`);
    else passes.push(`${DRAFT}: ${mine[1]} automated tests, the same count as the README "How we test" table`);

    // (d) "Built with" has three.js.
    const built = draft.match(/^## Box F[^\n]*\n+```text\n([^`]*)\n```/m);
    if (!built) problems.push(`${DRAFT}: no "## Box F" built-with box`);
    else if (!/three\.js/.test(built[1])) problems.push(`${DRAFT}: "Built with" does not list three.js`);
    else passes.push(`${DRAFT}: "Built with" lists three.js`);

    // (e) The story block.
    const box = draft.match(/```markdown\n([\s\S]*?)\n```/);
    if (!box) problems.push(`${DRAFT}: no story block (a markdown box)`);
    else {
      const story = box[1];
      const lines = story.split('\n');
      const own = (l) => PEOPLE.some((n) => l.startsWith(`- ${n}:`));
      const count = (ls) => ls.join(' ').split(/\s+/).filter(Boolean).length;
      const words = count(lines.filter((l) => !own(l)));
      const all = count(lines);
      if (words > 900) problems.push(`${DRAFT}: the story block is ${words} words without the teammates' own lines (limit 900)`);
      else passes.push(`${DRAFT}: the story block is ${words} words without the three teammates' own lines, ${all} with them (limit 900)`);
      const table = lines.find((l) => /^\s*\|/.test(l));
      const html = story.match(/<[A-Za-z/!][^>]*>/);
      if (table) problems.push(`${DRAFT}: the story block has a table row ("${table.slice(0, 40)}"); Devpost's story field does not take tables`);
      if (html) problems.push(`${DRAFT}: the story block has HTML ("${html[0]}")`);
      if (!table && !html) passes.push(`${DRAFT}: the story block has no table and no HTML`);

      // The 3D paragraph, as written in the kit.
      if (!existsSync(KIT)) passes.push(`${DRAFT}: 3D paragraph comparison SKIPPED (the submission kit is not in this checkout)`);
      else {
        const para = readFileSync(KIT, 'utf8').match(/^"(Where the device can draw it smoothly[^\n]*)"\r?$/m);
        if (!para) problems.push('SUBMISSION.md: the 3D paragraph ("Where the device can draw it smoothly ...") was not found');
        else if (!story.includes(para[1])) problems.push(`${DRAFT}: the story block does not carry the kit's 3D paragraph word for word`);
        else passes.push(`${DRAFT}: the story block carries the kit's 3D paragraph word for word (${para[1].split(/\s+/).length} words)`);
      }

      // "Who wrote the code" is question 1's own sentence.
      const q1 = existsSync(join(root, PACK)) ? flat(read(PACK).split(/^### /m).find((b) => b.startsWith('1. Who wrote the code')) ?? '') : '';
      const who = flat(story).match(/The code was written by .{0,200}?\bAhmed\b/);
      if (!q1) problems.push(`${DRAFT}: question 1 ("Who wrote the code ...") not found in ${PACK}, so the line cannot be compared`);
      else if (!who) problems.push(`${DRAFT}: the story block has no "The code was written by ... Ahmed" sentence`);
      else if (!q1.includes(who[0])) problems.push(`${DRAFT}: "who wrote the code" is not worded as in question 1 of ${PACK}: "${who[0]}"`);
      else passes.push(`${DRAFT}: "who wrote the code" is word for word from question 1 of ${PACK}`);

      // One line per first-timer, theirs to write.
      const filled = [];
      const waiting = [];
      for (const name of PEOPLE) {
        const line = lines.find((l) => l.startsWith(`- ${name}:`));
        if (!line) {
          problems.push(`${DRAFT}: the story block has no "- ${name}:" line under "What we learned"`);
          continue;
        }
        const ownWords = line.replace(`- ${name}:`, '').trim();
        if (!ownWords || /\[FILL\b/.test(ownWords)) waiting.push(name);
        else {
          filled.push(name);
          const m = ownWords.match(OVERCLAIM);
          if (m) problems.push(`${DRAFT}: ${name}'s line says "${m[0]}"; the story says who wrote the code (say what you tested, checked or learned)`);
        }
      }
      if (filled.length) passes.push(`${DRAFT}: ${filled.length} of ${PEOPLE.length} first-timers' own lines are in (${filled.join(', ')})`);
      if (waiting.length)
        waits.push(`${DRAFT} "What we learned": ${waiting.length} of ${PEOPLE.length} lines still to be written by the person named (${waiting.join(', ')}); a line still empty at paste time is deleted, never written for them`);
    }
  }
}

for (const p of passes) console.log(`ok   ${p}`);
for (const p of waits) console.log(`wait ${p}`);
for (const p of problems) console.log(`FAIL ${p}`);
console.log(problems.length ? `DOCS FAIL: ${problems.length} problem(s)` : 'DOCS PASS');
process.exit(problems.length ? 1 : 0);
