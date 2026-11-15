// Live check of the sighting planner: runs the page's own loop module (never a second copy) against a
// real provider, prints every trace with its seconds and model calls, and checks the live sources.
//
//   node --env-file=<key file> scripts/check-agent.mjs --provider gemini --runs 3 "Ypsilanti, before 8:30 PM, any night this week"
//   node --env-file=<key file> scripts/check-agent.mjs --provider gemini --runs 1 --record "<sentence>"
//   node scripts/check-agent.mjs --provider openai          (no key -> SKIPPED no key, exit 0)
//
// Keys come only from the process environment (GEMINI_API_KEY, OPENAI_API_KEY, EXA_API_KEY), loaded by
// Node's --env-file; this script never opens a key file. Before anything is printed or written, every
// key value found in the environment is replaced by [key]. --record saves reply bodies only (never
// request headers or addresses) to evidence/a1-live-{n}.json. Runs are 60 seconds apart; on a 429 the
// script waits the reply's Retry-After (or 60 s) once and tries that run again.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MODULES = ['/src/agent/loop.ts', '/src/agent/tools.ts', '/src/agent/providers.ts', '/src/agent/fixedPlan.ts', '/src/agent/score.ts', '/src/orbit/orbit.ts', '/src/orbit/track.ts', '/src/weather/openMeteo.ts', '/src/news/exaMcp.ts', '/src/agent/places.ts'];

async function loadWithVite() {
  const { loadTs } = await import('./load-ts.mjs');
  const { mods, close } = await loadTs(MODULES);
  const [loop, tools, providers, fixedPlan, score, orbit, track, openMeteo, exa, places] = mods;
  return { loop, tools, providers, fixedPlan, score, orbit, track, openMeteo, exa, places, close };
}

/** What kind of address a request went to (recorded instead of the address itself). */
function kindOf(url) {
  if (url.includes('generativelanguage.googleapis.com')) return url.includes(':generateContent') ? 'gemini' : 'gemini-models';
  if (url.includes('api.openai.com')) return url.includes('/responses') ? 'openai' : 'openai-models';
  if (url.includes('geocoding-api.open-meteo.com')) return 'places';
  if (url.includes('api.open-meteo.com')) return 'open-meteo';
  if (url.includes('mcp.exa.ai')) return 'exa';
  return 'other';
}

export async function main({
  argv = process.argv.slice(2),
  env = process.env,
  fetchFn = globalThis.fetch,
  log = (s) => console.log(s),
  error = (s) => console.error(s),
  outDir = join(root, 'evidence'),
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  load = loadWithVite,
  now = () => new Date(),
} = {}) {
  const secrets = Object.entries(env)
    .filter(([k, v]) => /KEY|TOKEN|SECRET/i.test(k) && typeof v === 'string' && v.length >= 8)
    .map(([, v]) => v);
  const redact = (s) => secrets.reduce((acc, k) => acc.split(k).join('[key]'), String(s));
  const say = (s) => log(redact(s));
  const warn = (s) => error(redact(s));
  const write = (path, obj) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, redact(JSON.stringify(obj, null, 1)) + '\n');
  };

  const opt = (name, def) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : def;
  };
  const providerName = opt('--provider', 'gemini');
  const runs = Number(opt('--runs', '1'));
  const record = argv.includes('--record');
  const valued = new Set(['--provider', '--runs']);
  const sentence = argv.filter((a, i) => !a.startsWith('--') && !valued.has(argv[i - 1])).join(' ').trim() || 'Ypsilanti, before 8:30 PM, any night this week';

  const keyName = providerName === 'openai' ? 'OPENAI_API_KEY' : 'GEMINI_API_KEY';
  const key = env[keyName];
  if (!key) {
    say(`${providerName}: key not found (${keyName} is not set)`);
    say('SKIPPED no key');
    return 0;
  }
  say(`${providerName}: key found (${keyName})`);

  const m = await load();
  try {
    // ---- every request goes through here; reply bodies are kept for --record
    let replies = [];
    const recFetch = async (url, init) => {
      const res = await fetchFn(url, init);
      const body = await res.text();
      replies.push({ kind: kindOf(String(url)), status: res.status, body });
      return new Response(body, { status: res.status, headers: res.headers });
    };

    // ---- model id
    let model;
    if (providerName === 'gemini') {
      const r = await recFetch(`${m.providers.GEMINI_BASE}/models?pageSize=200`, { headers: { 'x-goog-api-key': key } });
      if (!r.ok) {
        say(`gemini: ListModels HTTP ${r.status}`);
        model = m.providers.GEMINI_MODELS[0];
      } else {
        const ids = ((await r.json()).models ?? []).map((x) => String(x.name).replace('models/', ''));
        model = m.providers.GEMINI_MODELS.find((x) => ids.includes(x)) ?? m.providers.GEMINI_MODELS[0];
      }
    } else {
      const r = await recFetch('https://api.openai.com/v1/models', { headers: { authorization: `Bearer ${key}` } });
      model = m.providers.OPENAI_MODEL;
      if (r.ok) {
        const ids = ((await r.json()).data ?? []).map((x) => x.id);
        if (!ids.includes(model)) say(`openai: ${model} not in /v1/models`);
      } else say(`openai: /v1/models HTTP ${r.status}`);
    }
    const endpoint = providerName === 'gemini' ? 'generateContent' : 'responses';
    say(`model: ${model} · endpoint: ${endpoint}`);

    // ---- the live sources
    const tle = readFileSync(join(root, 'src/data/iss.tle'), 'utf8');
    const satrec = m.orbit.satrecFromTle(tle);
    const epoch = m.track.elementEpoch(satrec);
    const tz = 'America/Detroit';
    try {
      const f = await m.openMeteo.fetchForecast(42.24, -83.61, recFetch, now);
      say(`open-meteo: OK ${f.hours.length} (hourly rows, ${f.timeZone})`);
    } catch (e) {
      say(`open-meteo: FAIL ${e.message}`);
    }
    try {
      const r = await recFetch(`${m.places.GEOCODE_URL}?name=Ypsilanti&count=3&language=en&format=json`);
      const c = m.places.parseGeocode(await r.json());
      say(c.length && c[0].region.startsWith('Michigan') ? `places: OK (${c.length} candidates, first ${c[0].name}, ${c[0].region})` : `places: FAIL (${c.length} candidates)`);
    } catch (e) {
      say(`places: FAIL ${e.message}`);
    }
    const n = await m.exa.searchStationNews(m.exa.FIXED_QUERY, { fetch: recFetch, now: now(), epoch, exaKey: env.EXA_API_KEY || undefined });
    if (n.ok) say(`exa: OK ${n.shown.length}/${n.returned}${env.EXA_API_KEY ? ' (keyed)' : ' (no key)'}`);
    else if (n.status === 429) say(`exa: SKIPPED rate limited`);
    else say(`exa: FAIL ${n.message}`);

    // ---- the runs
    let code = 0;
    for (let i = 1; i <= runs; i++) {
      if (i > 1) {
        say('waiting 60 s before the next run');
        await sleep(60_000);
      }
      let result;
      let ctx;
      for (let attempt = 1; attempt <= 2; attempt++) {
        replies = [];
        const runNow = now();
        ctx = m.tools.newContext({ now, satrec, epoch, fetch: recFetch, viewerTimeZone: tz, exaKey: env.EXA_API_KEY || undefined });
        const provider = providerName === 'gemini' ? m.providers.gemini(key, model, recFetch) : m.providers.openai(key, model, recFetch);
        result = await m.loop.runAgent({ sentence, provider, ctx, controls: { place: 'Ypsilanti', nights: null, earliest: null, latest: '20:30' } });
        result.startedAt = runNow;
        const rate = replies.find((r) => (r.kind === 'gemini' || r.kind === 'openai') && r.status === 429);
        // R1: the loop itself asks again once after a 429; only a run that still ended without the AI is rerun.
        if (rate && result.mode !== 'ai' && attempt === 1) {
          say(`run ${i}: model replied 429: ${rate.body.slice(0, 400)}`);
          say('waiting 60 s (Retry-After) and trying this run once more');
          await sleep(60_000);
          continue;
        }
        break;
      }
      say(`\n=== run ${i} of ${runs}: "${sentence}"`);
      for (const r of ctx.trace) say(`  ${String(r.n).padStart(2)} ${r.tool.padEnd(17)} ${r.by.padEnd(10)} ${String(r.ms).padStart(5)} ms  ${r.input}\n       -> ${r.summary}`);
      const shown = ctx.shown;
      const allowedByFixedRule = shown ? !!shown.scored?.allowed : null;
      const refused = ctx.trace.filter((r) => r.tool === 'showPass' && /^refused/.test(r.summary)).length;
      say(`  result: ${result.mode}${result.fallbackReason ? ` (${result.fallbackReason})` : ''}`);
      say(`  card: ${result.card.headline}`);
      for (const l of result.card.lines) say(`        ${l}`);
      if (result.card.orbitLine) say(`        ${result.card.orbitLine}`);
      say(`  words: ${[ctx.why, result.text].filter(Boolean).join(' | ')}`);
      say(`  ${result.audit ? result.audit.badge : 'audit: not run (fixed plan)'}${result.audit?.flagged.length ? ` -> ${result.audit.flagged.join(', ')}` : ''}`);
      const legs = ctx.trace.filter((r) => r.tool === 'scorePasses').map((r, k) => `${ctx.trace.filter((x) => x.tool === 'listVisiblePasses')[k]?.input ?? '?'} [${r.input}]`);
      say(`  legs: ${legs.join(' | ') || 'none'}`);
      say(`  chosen: ${shown ? `${shown.id} (allowed by the fixed rule: ${allowedByFixedRule ? 'yes' : 'NO'})` : 'none'} · refused showPass ids: ${refused}`);
      say(`  seconds: ${result.seconds.toFixed(1)} · model calls: ${result.modelCalls}`);
      if (record) {
        let k = 1;
        if (existsSync(outDir)) for (const f of readdirSync(outDir)) {
          const mm = /^a1-live-(\d+)\.json$/.exec(f);
          if (mm) k = Math.max(k, Number(mm[1]) + 1);
        }
        const path = resolve(outDir, `a1-live-${k}.json`);
        write(path, {
          recorded: 'live',
          note: 'Reply bodies only, in the order they arrived; no request headers and no addresses (kind names the service).',
          provider: providerName,
          model,
          endpoint,
          sentence,
          now: result.startedAt.toISOString(),
          timeZone: tz,
          tleEpoch: epoch.toISOString(),
          seconds: result.seconds,
          modelCalls: result.modelCalls,
          mode: result.mode,
          fallbackReason: result.fallbackReason,
          chosen: shown?.id ?? null,
          allowedByFixedRule,
          audit: result.audit ? { badge: result.audit.badge, flagged: result.audit.flagged } : null,
          words: [ctx.why, result.text].filter(Boolean).join(' '),
          trace: ctx.trace,
          replies,
        });
        say(`  recorded: ${path.replace(root, '.').replace(/\\/g, '/')}`);
      }
    }
    return code;
  } catch (e) {
    warn(`check-agent failed: ${e?.stack ?? e}`);
    return 1;
  } finally {
    await m.close?.();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => process.exit(code));
}
