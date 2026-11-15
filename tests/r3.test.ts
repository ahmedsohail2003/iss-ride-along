// R3 "A place, never a sentence; a refused model is skipped": (A) placeFromSentence returns a place only,
// (B) a place text of more than 6 words or 60 characters is never sent to the place search, (C) a Gemini
// model id that answers 404, 403 or 429 is skipped at once for the rest of the page session, (D) the
// model picker in Settings. No network: the trip sentence's saved replies (tests/fixtures/
// gemini-trip-from-docs.json) answer the model, tripClouds() the weather, as in tests/r1.test.ts.
import { describe, expect, it } from 'vitest';
import geminiTrip from './fixtures/gemini-trip-from-docs.json';
import { TEST_KEY } from './fixtures/test-key.mjs';
import { ctxWith, mockFetch, TRIP, tripClouds } from './planner-helpers';
import { placeTooLong, runFixedPlan, safePlace, type Controls } from '../src/agent/fixedPlan';
import { runAgent } from '../src/agent/loop';
import { allRefusedText, gemini, GEMINI_MODELS, geminiAuto, modelOrder, newModelBook, type ModelBook } from '../src/agent/providers';
import { EXAMPLES, placeFromSentence, plannerSettingsHtml } from '../src/ui/plannerPanel';
import { KeyStore, SESSION_KEY } from '../src/ui/settings';

const DEFAULTS: Controls = { place: 'Ypsilanti', nights: null, earliest: null, latest: '20:30' };
const [M1, M2, M3] = GEMINI_MODELS;
const refusal = (status: number) => () => Response.json({ error: { code: status, message: 'refused' } }, { status });

describe('R3 (A) placeFromSentence returns a place, never a sentence', () => {
  const ten = 'we will be out near the lake all week long';
  const table: [string, string | null][] = [
    ['Detroit', 'Detroit'],
    ['Ann Arbor, Michigan', 'Ann Arbor, Michigan'],
    ['  chicago, il ', 'chicago, il'],
    ['Detroit, this weekend after dinner', 'Detroit'],
    ['Canton, this weekend after dinner', 'Canton'],
    ['Detroit, after 9', 'Detroit'],
    ['Ypsilanti until Monday, then Chicago Tuesday to Thursday, kids asleep by 8:30', 'Ypsilanti'],
    [ten, null],
    ['Detroit tomorrow after 9', null],
    ['this weekend after dinner, Detroit', null],
    [EXAMPLES.trip, null],
    [EXAMPLES.simple, null],
    ['', null],
  ];
  for (const [text, want] of table) {
    it(`"${text}" -> ${want === null ? 'null' : `"${want}"`}`, () => {
      const got = placeFromSentence(text);
      expect(got).toBe(want);
      if (got !== null) {
        // never the sentence: a place written out is at most 3 parts of at most 3 words
        expect(got.split(',').every((p) => p.trim().split(/\s+/).length <= 3)).toBe(true);
      }
    });
  }

  it('a trip sentence (not the built-in example string) gives null or a place of at most 3 words', () => {
    const got = placeFromSentence('Ypsilanti until Monday, then Chicago Tuesday to Thursday, kids asleep by 8:30');
    expect(got === null || got.split(/\s+/).length <= 3).toBe(true);
    expect(ten.split(/\s+/)).toHaveLength(10);
  });
});

describe('R3 (B) a place text that is too long is never sent to the place search', () => {
  it('placeTooLong: more than 6 words or more than 60 characters', () => {
    expect(placeTooLong('Detroit')).toBe(false);
    expect(placeTooLong('one two three four five six')).toBe(false);
    expect(placeTooLong('one two three four five six seven')).toBe(true);
    expect(placeTooLong('x'.repeat(60))).toBe(false);
    expect(placeTooLong('x'.repeat(61))).toBe(true);
    expect(safePlace({ ...DEFAULTS, place: 'Detroit' })).toEqual({ place: 'Detroit', note: null });
  });

  it('the fixed plan: a 9-word sentence is replaced by the Place box value, with a plain note', async () => {
    const m = mockFetch({ openMeteo: tripClouds, places: () => ({ results: [] }) });
    const ctx = ctxWith(m.fetch);
    const r = await runFixedPlan(ctx, { ...DEFAULTS, place: 'Canton this weekend after dinner with the kids please', plainPlace: 'Chicago' });
    expect(ctx.trace.find((t) => t.tool === 'findCity')!.input).toBe('name: "Chicago"');
    expect(m.calls.urls.filter((u) => u.includes('geocoding')).some((u) => /weekend|Canton/.test(u))).toBe(false);
    expect(r.card.headline).toContain('Chicago');
    expect(r.placeNote).toBe('What you typed is too long to be a place name, so the plan uses the Place box below ("Chicago") instead.');
  });

  it('the fixed plan: a 61-character place with an empty Place box uses Ypsilanti', async () => {
    const m = mockFetch({ openMeteo: tripClouds, places: () => ({ results: [] }) });
    const ctx = ctxWith(m.fetch);
    const r = await runFixedPlan(ctx, { ...DEFAULTS, place: 'y'.repeat(61), plainPlace: '' });
    expect(ctx.trace[0].input).toBe('name: "Ypsilanti"');
    expect(m.calls.urls.some((u) => u.includes('geocoding'))).toBe(false);
    expect(r.placeNote).toContain('("Ypsilanti")');
  });

  it('the AI-failure fallback (loop.ts): a long place is replaced by the Place box, named in the reason', async () => {
    const m = mockFetch({ openMeteo: tripClouds, places: () => ({ results: [] }), model: refusal(401) });
    const ctx = ctxWith(m.fetch);
    const r = await runAgent({
      sentence: 'somewhere quiet far from the city lights this weekend',
      provider: gemini(TEST_KEY, M1, m.fetch),
      ctx,
      controls: { ...DEFAULTS, place: 'somewhere quiet far from the city lights this weekend', plainPlace: 'Detroit' },
    });
    expect(r.mode).toBe('fixed plan');
    expect(r.fallbackReason).toBe('AI key refused (HTTP 401); this is the plan for Detroit without AI');
    expect(r.placeNote).toContain('("Detroit")');
    expect(m.calls.urls.some((u) => u.includes('geocoding'))).toBe(false);
    expect(r.card.headline).toContain('Detroit');
  });
});

/** The trip replies in order; any request to a model id in `refuse` gets that status instead. */
function tripRefusing(refuse: Record<string, number>, book: ModelBook = newModelBook(), chosen: string | null = null) {
  let good = 0;
  const holder: { urls: string[] } = { urls: [] };
  const m = mockFetch({
    openMeteo: tripClouds,
    model: () => {
      const url = holder.urls.at(-1)!;
      const id = Object.keys(refuse).find((k) => url.includes(`/models/${k}:`));
      return id ? refusal(refuse[id])() : Response.json(geminiTrip.replies[good++] ?? geminiTrip.replies.at(-1));
    },
  });
  holder.urls = m.calls.urls;
  const ctx = ctxWith(m.fetch);
  const p = runAgent({ sentence: TRIP, provider: geminiAuto(TEST_KEY, m.fetch, book, chosen), ctx, controls: DEFAULTS });
  const modelUrls = () => m.calls.urls.filter((u) => u.includes('generativelanguage'));
  return { p, ctx, calls: m.calls, modelUrls, book };
}

const switched = (ctx: { trace: { tool: string; summary: string; input: string }[] }) => ctx.trace.filter((t) => t.tool === 'switchModel');
const askedAgain = (ctx: { trace: { tool: string }[] }) => ctx.trace.filter((t) => t.tool === 'askAgain');

describe('R3 (C) a refused model id is skipped at once for the rest of the page session', () => {
  for (const [status, word] of [
    [429, 'quota'],
    [404, 'not found'],
    [403, 'not allowed for this key'],
  ] as const) {
    it(`${status} on the first id: the second is used at once, one Steps row says so, and the first is not asked again in the session`, async () => {
      const book = newModelBook();
      const t0 = Date.now();
      const t = tripRefusing({ [M1]: status }, book);
      const r = await t.p;
      expect(Date.now() - t0).toBeLessThan(5_000);
      expect(r.mode).toBe('ai');
      expect(r.card.passId).toBe('chicago-7');
      expect(r.audit!.badge).toBe('audit: 0 unverified numbers');
      const rows = switched(t.ctx);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ by: 'loop', input: `model: ${M2}`, summary: `${M1} was refused (${status}, ${word}); using ${M2}`, ok: false });
      expect(askedAgain(t.ctx)).toHaveLength(0);
      // every request counts as a model call: the refused one plus the 4 saved replies
      expect(r.modelCalls).toBe(geminiTrip.replies.length + 1);
      expect(t.calls.model).toBe(r.modelCalls);
      const urls = t.modelUrls();
      expect(urls[0]).toContain(`/models/${M1}:generateContent`);
      expect(urls.slice(1).every((u) => u.includes(`/models/${M2}:generateContent`))).toBe(true);
      expect(book.refused.get(M1)).toBe(status);
      // A second run in the same page session (same book): the refused id is never asked.
      const again = tripRefusing({ [M1]: status }, book);
      const r2 = await again.p;
      expect(r2.mode).toBe('ai');
      expect(again.modelUrls().some((u) => u.includes(`/models/${M1}:`))).toBe(false);
      expect(switched(again.ctx)).toHaveLength(0);
      expect(r2.modelCalls).toBe(geminiTrip.replies.length);
      console.log(`(C) ${status}: ${r.mode}, ${r.modelCalls} model calls, row: ${rows[0].summary}; second run ${r2.modelCalls} calls, none to ${M1}`);
    });
  }

  it('every id refused (429): the fixed plan at once, the reason names the status and what to do', async () => {
    const t0 = Date.now();
    const t = tripRefusing({ [M1]: 429, [M2]: 429, [M3]: 429 });
    const r = await t.p;
    expect(Date.now() - t0).toBeLessThan(5_000);
    expect(r.mode).toBe('fixed plan');
    expect(r.fallbackReason).toBe(
      "Gemini refused all 3 model names (429): this key's free quota is used up for now. Wait a minute, or pick another model in Settings; this is the plan for Ypsilanti without AI",
    );
    expect(r.modelCalls).toBe(3);
    expect(t.calls.model).toBe(3);
    expect(t.modelUrls().map((u) => /models\/([^:]+):/.exec(u)![1])).toEqual([M1, M2, M3]);
    const rows = switched(t.ctx);
    expect(rows.map((x) => x.summary)).toEqual([`${M1} was refused (429, quota); using ${M2}`, `${M2} was refused (429, quota); using ${M3}`, `${M3} was refused (429, quota); no other model name left`]);
    expect(t.ctx.trace.some((x) => x.by === 'fixed plan')).toBe(true);
    console.log(`(C) all refused: ${r.fallbackReason}`);
  });

  it('every id refused with mixed answers: the reason names each status', () => {
    const book = newModelBook();
    book.refused.set(M1, 404);
    book.refused.set(M2, 404);
    book.refused.set(M3, 404);
    expect(allRefusedText(book)).toBe('Gemini refused all 3 model names (404): these model names are not offered to this key. Pick another model in Settings');
    book.refused.set(M2, 429);
    expect(allRefusedText(book)).toMatch(/^Gemini refused all 3 model names \(429, 404\): this key's free quota/);
  });

  it('a later run after every id was refused starts afresh (so "wait a minute" works without a reload)', async () => {
    const book = newModelBook();
    for (const m of GEMINI_MODELS) book.refused.set(m, 429);
    const t = tripRefusing({}, book);
    const r = await t.p;
    expect(r.mode).toBe('ai');
    expect(t.modelUrls()[0]).toContain(`/models/${M1}:`);
  });

  it('R1 still applies to a 5xx with the failover provider: asked once more on the next id, no switch row', async () => {
    let good = 0;
    let n = 0;
    const m = mockFetch({ openMeteo: tripClouds, model: () => (++n === 1 ? Response.json({}, { status: 503 }) : Response.json(geminiTrip.replies[good++] ?? geminiTrip.replies.at(-1))) });
    const ctx = ctxWith(m.fetch);
    const book = newModelBook();
    const r = await runAgent({ sentence: TRIP, provider: geminiAuto(TEST_KEY, m.fetch, book), ctx, controls: DEFAULTS });
    expect(r.mode).toBe('ai');
    expect(askedAgain(ctx)).toHaveLength(1);
    expect(askedAgain(ctx)[0]).toMatchObject({ input: `model: ${M2}` });
    expect(switched(ctx)).toHaveLength(0);
    expect(book.refused.size).toBe(0);
  });
});

describe('R3 (D) the model picker', () => {
  it('a chosen model is tried first, then the others in list order', async () => {
    expect(modelOrder(M3)).toEqual([M3, M1, M2]);
    expect(modelOrder(null)).toEqual(GEMINI_MODELS);
    expect(modelOrder('not-a-model')).toEqual(GEMINI_MODELS);
    const t = tripRefusing({}, newModelBook(), M3);
    const r = await t.p;
    expect(r.mode).toBe('ai');
    expect(t.modelUrls().every((u) => u.includes(`/models/${M3}:`))).toBe(true);
    // the chosen id refused: the first id in the list is next
    const t2 = tripRefusing({ [M3]: 429 }, newModelBook(), M3);
    const r2 = await t2.p;
    expect(r2.mode).toBe('ai');
    expect(switched(t2.ctx)[0].summary).toBe(`${M3} was refused (429, quota); using ${M1}`);
  });

  it('the Settings box has a labelled "Gemini model" select with Automatic and one option per id', () => {
    expect(plannerSettingsHtml).toContain('<label>Gemini model <select id="gemini-model">');
    expect(plannerSettingsHtml).toContain('<option value="">Automatic (the first that answers)</option>');
    for (const m of GEMINI_MODELS) expect(plannerSettingsHtml).toContain(`<option value="${m}">${m}</option>`);
  });

  it('the choice is kept the same way as the key: memory, or this tab\'s sessionStorage with the tick box', () => {
    const m = new Map<string, string>();
    const session = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
    const store = new KeyStore(session);
    store.setGeminiModel(M2);
    expect(store.geminiModel()).toBe(M2);
    expect(m.size).toBe(0);
    store.setKeep(true);
    expect(JSON.parse(m.get(SESSION_KEY)!).geminiModel).toBe(M2);
    expect(new KeyStore(session).geminiModel()).toBe(M2);
    store.setKeep(false);
    expect(m.size).toBe(0);
  });
});
