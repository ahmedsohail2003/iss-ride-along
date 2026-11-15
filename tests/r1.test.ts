// R1 "One retry when the AI is slow": tests (a)-(d) of PLAN.md R1's acceptance, plus the edges of the
// rule (a later step, a 5xx, a 401 that is not retried, too little time left, the last model id).
// No network: the trip sentence's saved replies (tests/fixtures/gemini-trip-from-docs.json) answer the
// model, tripClouds() the weather; the slow replies are promises that never settle, on the fake clock.
import { afterEach, describe, expect, it, vi } from 'vitest';
import geminiTrip from './fixtures/gemini-trip-from-docs.json';
import geminiSimple from './fixtures/gemini-simple-from-docs.json';
import { TEST_KEY } from './fixtures/test-key.mjs';
import { ctxWith, mockFetch, NOW, scripted, SIMPLE, TRIP, tripClouds } from './planner-helpers';
import type { Controls } from '../src/agent/fixedPlan';
import { LIMITS, runAgent } from '../src/agent/loop';
import { gemini, GEMINI_MODELS } from '../src/agent/providers';

const DEFAULTS: Controls = { place: 'Ypsilanti', nights: null, earliest: null, latest: '20:30' };
const SILENT = () => new Promise<Response>(() => {});

/** The trip replies in order, except that the model calls named in `bad` get the given reply instead. */
function tripWith(bad: Record<number, () => Response | Promise<Response>>) {
  let good = 0;
  return (n: number) => (bad[n] ? bad[n]() : Response.json(geminiTrip.replies[good++] ?? geminiTrip.replies.at(-1)));
}

function trip(model: (n: number) => Response | Promise<Response>, limits = LIMITS, modelId = GEMINI_MODELS[0]) {
  const m = mockFetch({ openMeteo: tripClouds, model });
  const ctx = ctxWith(m.fetch);
  const p = runAgent({ sentence: TRIP, provider: gemini(TEST_KEY, modelId, m.fetch), ctx, controls: DEFAULTS, limits });
  const modelUrls = () => m.calls.urls.filter((u) => u.includes('generativelanguage'));
  return { p, ctx, calls: m.calls, modelUrls };
}

const asked = (ctx: { trace: { tool: string; summary: string }[] }) => ctx.trace.filter((t) => /asked again/.test(t.summary));

afterEach(() => {
  vi.useRealTimers();
});

describe('R1 (a) a slow reply is asked once more', () => {
  it('first reply silent for 15 s, second fine: result "ai", one "asked again" row, audit 0, inside 30 s (fake clock)', async () => {
    vi.useFakeTimers({ now: NOW });
    const t = trip(tripWith({ 1: SILENT }));
    const t0 = Date.now();
    await vi.advanceTimersByTimeAsync(31_000);
    const r = await t.p;
    expect(r.mode).toBe('ai');
    expect(r.card.passId).toBe('chicago-7');
    expect(r.audit!.badge).toBe('audit: 0 unverified numbers');
    const rows = asked(t.ctx);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ tool: 'askAgain', by: 'loop', input: 'model: gemini-3.8-flash', summary: 'the AI was slow (no reply in 15 seconds), asked again' });
    expect(rows[0].n).toBe(1);
    expect(r.seconds).toBeLessThanOrEqual(30);
    expect(r.seconds).toBeGreaterThanOrEqual(15);
    // 4 saved replies + the silent one; the retry and every later step go to the next model id.
    expect(r.modelCalls).toBe(geminiTrip.replies.length + 1);
    expect(t.calls.model).toBe(r.modelCalls);
    const urls = t.modelUrls();
    expect(urls[0]).toContain('/models/gemini-4-hydrogen:generateContent');
    expect(urls.slice(1).every((u) => u.includes('/models/gemini-3.8-flash:generateContent'))).toBe(true);
    console.log(`(a) ${r.mode}, ${r.card.passId}, ${r.seconds.toFixed(1)} s on the fake clock (started ${(t0 - NOW.getTime()) / 1000} s), ${r.modelCalls} model calls, ${r.audit!.badge}; row: ${rows[0].summary}`);
  });

  it('a later step silent (call 3, as in M10\'s live run): still "ai", one "asked again" row, the earlier rows kept', async () => {
    vi.useFakeTimers({ now: NOW });
    const t = trip(tripWith({ 3: SILENT }));
    await vi.advanceTimersByTimeAsync(31_000);
    const r = await t.p;
    expect(r.mode).toBe('ai');
    expect(r.card.passId).toBe('chicago-7');
    expect(r.audit!.badge).toBe('audit: 0 unverified numbers');
    expect(asked(t.ctx)).toHaveLength(1);
    const at = t.ctx.trace.findIndex((x) => x.tool === 'askAgain');
    expect(t.ctx.trace.slice(0, at).filter((x) => x.by === 'model').length).toBeGreaterThan(0);
    expect(r.seconds).toBeLessThanOrEqual(30);
    console.log(`(a) later step: ${r.mode}, ${r.seconds.toFixed(1)} s, ${r.modelCalls} model calls, askAgain is row ${at + 1} of ${t.ctx.trace.length}`);
  });
});

describe('R1 (b) a second failure ends in the fixed plan', () => {
  it('both replies silent: the fixed plan with the reason named, by 31 s, after exactly one retry', async () => {
    vi.useFakeTimers({ now: NOW });
    const t = trip(SILENT);
    const t0 = Date.now();
    await vi.advanceTimersByTimeAsync(31_000);
    const r = await t.p;
    expect((Date.now() - t0) / 1000).toBeLessThanOrEqual(31);
    expect(r.seconds).toBeLessThanOrEqual(31);
    expect(r.mode).toBe('fixed plan');
    expect(r.fallbackReason).toMatch(/^AI took too long \(.+\); this is the plan for Ypsilanti without AI$/);
    expect(asked(t.ctx)).toHaveLength(1);
    expect(t.calls.model).toBe(2);
    expect(r.modelCalls).toBe(2);
    expect(t.ctx.trace.some((x) => x.by === 'fixed plan')).toBe(true);
    console.log(`(b) ${r.mode} at ${r.seconds.toFixed(1)} s (fake clock), ${r.modelCalls} model calls: ${r.fallbackReason}`);
  });

  it('a 429 on both tries: the fixed plan with the 429 reason, exactly as before R1', async () => {
    const t = trip(() => Response.json({ error: { code: 429 } }, { status: 429 }));
    const r = await t.p;
    expect(r.mode).toBe('fixed plan');
    expect(r.fallbackReason).toBe('AI rate limit reached (HTTP 429); this is the plan for Ypsilanti without AI');
    expect(asked(t.ctx)).toHaveLength(1);
    expect(t.calls.model).toBe(2);
  });
});

describe('R1 (c) a 429 or a 5xx, then a good reply', () => {
  for (const [label, status, words] of [
    ['429', 429, 'the AI was busy (HTTP 429), asked again'],
    ['503', 503, 'the AI service had an error (HTTP 503), asked again'],
  ] as const) {
    it(`${label} then the saved replies: result "ai" with audit 0 and one "asked again" row`, async () => {
      const t = trip(tripWith({ 1: () => Response.json({ error: { code: status } }, { status }) }));
      const r = await t.p;
      expect(r.mode).toBe('ai');
      expect(r.card.passId).toBe('chicago-7');
      expect(r.audit!.badge).toBe('audit: 0 unverified numbers');
      const rows = asked(t.ctx);
      expect(rows).toHaveLength(1);
      expect(rows[0].summary).toBe(words);
      expect(r.modelCalls).toBe(geminiTrip.replies.length + 1);
      console.log(`(c) ${label}: ${r.mode}, ${r.card.passId}, ${r.modelCalls} model calls, row: ${rows[0].summary}`);
    });
  }

  it('a 401 is not retried: one model call, the fixed plan, the key reason', async () => {
    const t = trip(() => Response.json({ error: { code: 401 } }, { status: 401 }));
    const r = await t.p;
    expect(r.mode).toBe('fixed plan');
    expect(r.fallbackReason).toBe('AI key refused (HTTP 401); this is the plan for Ypsilanti without AI');
    expect(asked(t.ctx)).toHaveLength(0);
    expect(t.calls.model).toBe(1);
  });

  it('the last model id in GEMINI_MODELS asks the same model again', async () => {
    const last = GEMINI_MODELS.at(-1)!;
    const t = trip(tripWith({ 1: () => Response.json({ error: { code: 503 } }, { status: 503 }) }), LIMITS, last);
    const r = await t.p;
    expect(r.mode).toBe('ai');
    expect(t.modelUrls().every((u) => u.includes(`/models/${last}:generateContent`))).toBe(true);
    expect(asked(t.ctx)[0].input).toBe(`model: ${last}`);
  });

  it('no retry when less than 5 s of the whole-plan limit is left: the fixed plan at once', async () => {
    vi.useFakeTimers({ now: NOW });
    const t = trip(tripWith({ 1: SILENT }), { ...LIMITS, runMs: 18_000 });
    await vi.advanceTimersByTimeAsync(19_000);
    const r = await t.p;
    expect(r.mode).toBe('fixed plan');
    expect(r.fallbackReason).toBe('AI took too long (no reply in 15 seconds); this is the plan for Ypsilanti without AI');
    expect(asked(t.ctx)).toHaveLength(0);
    expect(t.calls.model).toBe(1);
  });
});

describe('R1 (d) no retry when the replies are fine', () => {
  for (const [label, sentence, file] of [
    ['trip', TRIP, geminiTrip],
    ['simple', SIMPLE, geminiSimple],
  ] as const) {
    it(`${label} sentence: model calls = the ${file.replies.length} saved replies, no "asked again" row`, async () => {
      const m = mockFetch({ openMeteo: tripClouds, model: scripted(file.replies) });
      const ctx = ctxWith(m.fetch);
      const r = await runAgent({ sentence, provider: gemini(TEST_KEY, GEMINI_MODELS[0], m.fetch), ctx, controls: DEFAULTS });
      expect(r.mode).toBe('ai');
      expect(asked(ctx)).toHaveLength(0);
      expect(ctx.trace.some((x) => x.tool === 'askAgain')).toBe(false);
      expect(r.modelCalls).toBe(file.replies.length);
      expect(m.calls.model).toBe(file.replies.length);
      console.log(`(d) ${label}: ${r.modelCalls} model calls, ${m.calls.model} requests, 0 retries`);
    });
  }
});
