// "Plan my sighting": the sentence box, the plain controls, the result card, the trace panel, the
// "From the live web" box and the settings box. With no key the button runs the fixed plan.
// Every piece of text that comes from the web or from a model goes on the page with textContent,
// never as HTML.
import type { SatRec } from 'satellite.js';
import { NO_NEWS_TEXT } from '../news/exaMcp';
import { CREDIT_OPEN_METEO } from '../weather/openMeteo';
import { runFixedPlan, type Controls, type PlanResult } from '../agent/fixedPlan';
import { nextDates, weekdayOf } from '../agent/format';
import { runAgent, type AgentResult } from '../agent/loop';
import { gemini, GEMINI_MODELS, openai, OPENAI_MODEL } from '../agent/providers';
import { newContext, SEARCH_DAYS, type PassInfo, type RunContext, type TraceRow } from '../agent/tools';
import { KeyStore, PRIVACY_LINE, STATUS, type KeyName } from './settings';
import { builtInMatches, type AgentPlace } from '../agent/places';
import { NEWS_DOWN_TEXT } from '../news/exaMcp';
import { clearSource, warnSource } from './warnings';
import { recordPlanRun } from './accuracy';
import { initOutputs, outputsHtml } from './outputs';
import type { EonetEvent } from '../nasa/eonet';

export const EXAMPLES = {
  trip: 'Ypsilanti until Monday, then Chicago Tuesday to Thursday, kids in bed by 8:30',
  simple: 'Ypsilanti, before 8:30 PM, any night this week',
};
export const NEEDS_AI_TEXT = 'this one needs the AI: add a key in settings';

/**
 * M7, no key: a stranger types just a town ("Detroit") and presses Enter. A built-in name, or up to
 * three words with no digits (sent to the place search), is used as the place; anything longer is a
 * sentence that needs the AI, so the plain controls are used. The two examples use the plain controls.
 */
export function placeFromSentence(text: string): string | null {
  const t = text.trim();
  if (!t || t === EXAMPLES.trip || t === EXAMPLES.simple) return null;
  if (builtInMatches(t).length) return t;
  const words = t.split(',')[0].trim().split(/\s+/);
  return words.length <= 3 && !/\d/.test(t) ? t : null;
}

export const plannerPanelHtml = `
  <section class="card planner" aria-labelledby="planner-h">
    <h2 id="planner-h">Where will you be, and when are you free?</h2>
    <form id="plan-form" class="plan-form">
      <label class="grow">A town, or your week in your own words (press Enter)
        <input id="plan-sentence" autocomplete="off" placeholder="${EXAMPLES.trip}" />
      </label>
      <div class="examples">
        <span class="small">Examples:</span>
        <button type="button" class="example" data-example="trip">${EXAMPLES.trip}</button>
        <button type="button" class="example" data-example="simple">${EXAMPLES.simple}</button>
      </div>
      <fieldset class="plain-controls">
        <legend>Plain controls (the fixed plan uses these)</legend>
        <label>Place <input id="plan-place" list="city-list" autocomplete="off" value="Ypsilanti" /></label>
        <label>Earliest <input id="plan-earliest" type="time" /></label>
        <label>Latest <input id="plan-latest" type="time" value="20:30" /></label>
        <span id="plan-nights" class="nights"></span>
      </fieldset>
      <button type="submit" id="plan-go">Plan my sighting <span id="plan-mode"></span></button>
    </form>
    <p id="plan-note" class="plan-note" aria-live="polite"></p>
  </section>
`;

/** M7: the plan's answer sits under the first screen's next-pass line, so that line stays in view. */
export const plannerResultHtml = `
  <section id="plan-result" class="card planner plan-result" aria-label="Your plan" hidden>
    <div id="plan-card" class="plan-card" hidden>
      <p id="plan-fallback" class="plan-fallback" hidden></p>
      <h3 id="plan-headline"></h3>
      <ul id="plan-lines"></ul>
      <p id="plan-why"></p>
      <p id="plan-orbit" class="plan-orbit" hidden></p>
      <p id="plan-countdown" class="countdown" aria-live="off"></p>
      <p id="plan-audit" class="audit" hidden></p>
${outputsHtml}
    </div>
    <div id="plan-cols" class="plan-cols" hidden>
      <div class="news-box">
        <h3>From the live web</h3>
        <p id="news-query" class="small"></p>
        <ul id="news-list"></ul>
        <p id="news-note" class="small"></p>
        <p class="small">Web items are quoted with their date and link, not checked by us, and never used for a number.</p>
      </div>
      <div class="trace-box">
        <h3>Steps</h3>
        <ol id="plan-trace"></ol>
      </div>
    </div>
  </section>
`;

/** The AI keys box; M7 puts it in the Settings tab. */
export const plannerSettingsHtml = `
    <details id="plan-settings" class="plan-settings">
      <summary>Settings: AI keys</summary>
      <label>Provider <select id="set-provider"><option value="gemini">Gemini</option><option value="openai">OpenAI</option></select></label>
      <label>Gemini key <input id="key-gemini" type="password" autocomplete="off" /></label> <span class="small" id="status-gemini"></span>
      <label>OpenAI key <input id="key-openai" type="password" autocomplete="off" /></label> <span class="small" id="status-openai"></span>
      <label>Exa key (optional) <input id="key-exa" type="password" autocomplete="off" /></label> <span class="small" id="status-exa"></span>
      <label class="tick"><input id="key-keep" type="checkbox" /> keep until this tab is closed</label>
      <p class="small" id="ai-calls">AI calls this session: 0</p>
      <p class="small">${PRIVACY_LINE}</p>
      <p class="small">${CREDIT_OPEN_METEO}. Web search by Exa.</p>
    </details>
`;

export interface PlannerHooks {
  getSatrec: () => SatRec;
  getEpoch: () => Date;
  /** A2: the NASA EONET events on the map (live list or saved copy), for the briefing. */
  getEvents?: () => { list: EonetEvent[]; source: string };
  /** Draw the chosen pass on the map (arc + peak) and return nothing. */
  onShow: (info: PassInfo, ctx: RunContext) => void;
  /** M7: the place the run is for (a built-in match before the run, the found place after it). */
  onPlace?: (p: AgentPlace) => void;
}

const viewerTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export function initPlanner(h: PlannerHooks) {
  const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const store = new KeyStore(sessionStorage);
  let aiCalls = 0;
  let countdownTimer: ReturnType<typeof setInterval> | undefined;
  const showOutputs = initOutputs();

  // ---- nights check boxes (today plus 5 days)
  const dates = nextDates(new Date(), viewerTz(), SEARCH_DAYS);
  $('plan-nights').replaceChildren(
    ...dates.map((d) => {
      const l = document.createElement('label');
      l.className = 'night';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = true;
      cb.value = d;
      l.append(cb, ` ${weekdayOf(d)} ${Number(d.slice(8))}`);
      return l;
    }),
  );

  // ---- settings
  const keyInputs: Record<KeyName, HTMLInputElement> = { gemini: $('key-gemini'), openai: $('key-openai'), exa: $('key-exa') };
  const keep = $<HTMLInputElement>('key-keep');
  const providerSel = $<HTMLSelectElement>('set-provider');
  for (const k of Object.keys(keyInputs) as KeyName[]) {
    keyInputs[k].value = store.get(k);
    $(`status-${k}`).textContent = STATUS[k];
    keyInputs[k].addEventListener('input', () => {
      store.set(k, keyInputs[k].value);
      if (k !== 'exa') providerSel.value = store.defaultProvider() ?? providerSel.value;
      updateMode();
    });
  }
  keep.checked = store.keep;
  keep.addEventListener('change', () => store.setKeep(keep.checked));
  providerSel.value = store.defaultProvider() ?? 'gemini';
  providerSel.addEventListener('change', updateMode);

  function activeProvider(): 'gemini' | 'openai' | null {
    const p = providerSel.value as 'gemini' | 'openai';
    return store.get(p) ? p : store.defaultProvider();
  }
  function updateMode() {
    const p = activeProvider();
    $('plan-mode').textContent = p ? `(AI: ${p === 'gemini' ? 'Gemini' : 'OpenAI'})` : '(fixed plan, no AI)';
    document.body.dataset.planMode = p ? 'ai' : 'fixed';
  }
  updateMode();

  // ---- examples
  const sentence = $<HTMLInputElement>('plan-sentence');
  for (const b of document.querySelectorAll<HTMLButtonElement>('.example')) {
    b.addEventListener('click', () => {
      const which = b.dataset.example as keyof typeof EXAMPLES;
      sentence.value = EXAMPLES[which];
      // The plain controls take the first place, every night and the same latest time.
      $<HTMLInputElement>('plan-place').value = 'Ypsilanti';
      $<HTMLInputElement>('plan-latest').value = '20:30';
      for (const cb of document.querySelectorAll<HTMLInputElement>('#plan-nights input')) cb.checked = true;
      if (which === 'trip' && !activeProvider()) {
        $('plan-note').textContent = `The trip has two places: ${NEEDS_AI_TEXT}. The fixed plan below covers the first place only (Ypsilanti).`;
        document.body.dataset.planNote = 'needs-ai';
      } else {
        $('plan-note').textContent = activeProvider() ? '' : 'No AI key: the fixed plan uses the plain controls below the box.';
        document.body.dataset.planNote = '';
      }
    });
  }

  function controls(placeOverride: string | null = null): Controls {
    const nights = [...document.querySelectorAll<HTMLInputElement>('#plan-nights input')].filter((c) => c.checked).map((c) => c.value);
    return {
      place: placeOverride ?? ($<HTMLInputElement>('plan-place').value.trim() || 'Ypsilanti'),
      nights: nights.length === dates.length ? null : nights,
      earliest: $<HTMLInputElement>('plan-earliest').value || null,
      latest: $<HTMLInputElement>('plan-latest').value || null,
    };
  }

  // ---- trace
  const traceList = $('plan-trace');
  function addRow(r: TraceRow) {
    const li = document.createElement('li');
    li.className = r.ok ? 'trace-row' : 'trace-row trace-bad';
    const head = document.createElement('strong');
    head.textContent = r.tool;
    const by = document.createElement('span');
    by.className = 'small';
    by.textContent = ` (${r.by === 'loop' ? 'added by the loop' : r.by === 'model' ? 'chosen by the AI' : r.by === 'button' ? 'your click' : 'fixed plan'}, ${r.ms} ms) `;
    const input = document.createElement('code');
    input.textContent = r.input;
    const sum = document.createElement('div');
    sum.className = 'small';
    sum.textContent = r.summary;
    li.append(head, by, input, sum);
    traceList.append(li);
  }

  function showResult(r: PlanResult | AgentResult, ctx: RunContext) {
    const card = $('plan-card');
    card.hidden = false;
    const fb = $('plan-fallback');
    fb.hidden = !r.fallbackReason;
    fb.textContent = r.fallbackReason ?? '';
    $('plan-headline').textContent = `${r.card.headline} (${r.mode === 'ai' ? 'planned by the AI' : 'fixed plan, no AI'})`;
    $('plan-lines').replaceChildren(
      ...r.card.lines.map((l) => {
        const li = document.createElement('li');
        li.textContent = l;
        return li;
      }),
    );
    // The model's words, with any number the audit could not trace highlighted.
    const why = $('plan-why');
    why.replaceChildren();
    const a = 'audit' in r ? r.audit : null;
    const words = a ? [ctx.why ?? '', (r as AgentResult).text].filter(Boolean).join(' ') : r.card.why;
    if (a) {
      let at = 0;
      for (const t of a.tokens) {
        why.append(words.slice(at, t.index));
        const span = document.createElement('span');
        span.textContent = t.text;
        if (!t.ok) {
          span.className = 'unverified';
          span.title = 'not from our engine';
        }
        why.append(span);
        at = t.index + t.text.length;
      }
      why.append(words.slice(at));
    } else why.textContent = words;
    const orbit = $('plan-orbit');
    orbit.hidden = !r.card.orbitLine;
    orbit.textContent = r.card.orbitLine ?? '';
    const au = $('plan-audit');
    au.hidden = !a;
    au.textContent = a?.badge ?? '';
    au.className = a && a.unverified ? 'audit audit-bad' : 'audit';
    document.body.dataset.planKind = r.card.kind;

    // news box
    const n = ctx.news;
    $('news-query').textContent = n ? `Search text: "${n.query}"` : '';
    $('news-list').replaceChildren(
      ...(n?.shown ?? []).map((i) => {
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.href = i.url;
        link.rel = 'noopener noreferrer';
        link.target = '_blank';
        link.textContent = i.title;
        li.append(`${i.published!.toISOString().slice(0, 10)}: `, link);
        return li;
      }),
    );
    $('news-note').textContent = n?.message ?? (n && !n.shown.length ? NO_NEWS_TEXT : '');

    // countdown to the start of the chosen pass
    clearInterval(countdownTimer);
    const cd = $('plan-countdown');
    const start = r.card.startMs;
    const info = r.card.passId ? ctx.passes.get(r.card.passId) : undefined;
    if (start && info) {
      const end = info.pass.end.getTime();
      const tick = () => {
        const now = Date.now();
        if (now < start) {
          const s = Math.round((start - now) / 1000);
          const hh = Math.floor(s / 3600);
          const mm = Math.floor((s % 3600) / 60);
          cd.textContent = `Starts in ${hh} h ${String(mm).padStart(2, '0')} min ${String(s % 60).padStart(2, '0')} s`;
        } else cd.textContent = now < end ? 'Happening now: look up!' : 'This pass is over: plan again.';
      };
      tick();
      countdownTimer = setInterval(tick, 1000);
    } else cd.textContent = '';
  }

  // ---- M7: a source that failed during the run gets a named warning; the card is still shown.
  function warnFromRun(r: PlanResult | AgentResult, ctx: RunContext, p: 'gemini' | 'openai' | null) {
    const failed = (tool: string, test: (row: TraceRow) => boolean) => ctx.trace.some((row) => row.tool === tool && !row.ok && test(row));
    if (failed('cloudForecast', (row) => /unavailable/.test(row.summary)))
      warnSource('forecast', 'Open-Meteo forecast could not be reached: the cloud cover is unknown, so every pass is counted as 50% cloud.');
    if (failed('findCity', (row) => /place search unavailable/.test(row.summary)))
      warnSource('places', 'Open-Meteo place search could not be reached: only the built-in list of places works (Ypsilanti and 150 cities).');
    if (failed('stationNews', (row) => row.summary.startsWith(NEWS_DOWN_TEXT)))
      warnSource('exa', 'Exa (the live web search) could not be reached: no station news this time; the pass times do not depend on it.');
    if (p && r.fallbackReason)
      warnSource('ai', `${p === 'gemini' ? 'Gemini' : 'OpenAI'} (the AI provider) could not be used: ${r.fallbackReason}.`);
  }

  // ---- run
  const go = $<HTMLButtonElement>('plan-go');
  $('plan-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    go.disabled = true;
    traceList.replaceChildren();
    const ctx = newContext({
      now: () => new Date(),
      satrec: h.getSatrec(),
      epoch: h.getEpoch(),
      fetch: (...a) => fetch(...a),
      viewerTimeZone: viewerTz(),
      exaKey: store.get('exa') || undefined,
      onShow: h.onShow,
      onTrace: addRow,
      events: h.getEvents,
    });
    const p = activeProvider();
    const text = sentence.value.trim();
    // M7: the place typed alone goes straight to the next-pass line when it is a built-in name.
    // With a key the AI reads the sentence; a lone town is still the place its fallback plan uses.
    const lonePlace = placeFromSentence(text);
    const typedPlace = p ? null : lonePlace;
    const early = builtInMatches(p ? text : (typedPlace ?? controls().place))[0];
    if (early) h.onPlace?.(early);
    for (const k of ['forecast', 'places', 'exa', 'ai'] as const) clearSource(k);
    $('plan-cols').hidden = false;
    $('plan-result').hidden = false;
    try {
      let r: PlanResult | AgentResult;
      if (p && text) {
        $('plan-note').textContent = 'Planning with the AI (at most 6 AI calls, 30 seconds)...';
        const provider = p === 'gemini' ? gemini(store.get('gemini'), GEMINI_MODELS[0], (...a) => fetch(...a)) : openai(store.get('openai'), OPENAI_MODEL, (...a) => fetch(...a));
        const ar = await runAgent({
          sentence: text,
          provider,
          ctx,
          controls: controls(lonePlace),
          onModelCall: () => {
            aiCalls++;
            $('ai-calls').textContent = `AI calls this session: ${aiCalls}`;
          },
        });
        r = ar;
        $('plan-note').textContent = `${ar.mode === 'ai' ? 'Planned by the AI' : 'Fixed plan'} in ${ar.seconds.toFixed(1)} s with ${ar.modelCalls} AI call${ar.modelCalls === 1 ? '' : 's'}.`;
      } else {
        r = await runFixedPlan(ctx, controls(typedPlace));
        if (!p && text && sentence.value === EXAMPLES.trip) $('plan-note').textContent = `The trip has two places: ${NEEDS_AI_TEXT}. This is the fixed plan for the first place only (Ypsilanti).`;
        else if (!p && typedPlace) $('plan-note').textContent = `Fixed plan, no AI, for "${typedPlace}" (the times and nights are the plain controls below the box).`;
        else if (!p && text && text !== EXAMPLES.simple) $('plan-note').textContent = `A sentence like this one needs the AI: add a key in Settings. Fixed plan, no AI: the plain controls below the box were used.`;
        else if (!p) $('plan-note').textContent = 'Fixed plan, no AI: the plain controls below the box were used.';
      }
      showResult(r, ctx);
      showOutputs(ctx, r.card.kind === 'pass' ? r.card.passId : null);
      const where = ctx.shown?.place ?? [...ctx.places.values()][0];
      if (where) h.onPlace?.(where);
      warnFromRun(r, ctx, p);
      recordPlanRun('audit' in r && r.audit ? { checked: r.audit.tokens.length, unverified: r.audit.unverified } : null);
    } catch (err) {
      $('plan-note').textContent = `The planner hit an error: ${(err as Error).message}`;
    } finally {
      go.disabled = false;
    }
  });
}
