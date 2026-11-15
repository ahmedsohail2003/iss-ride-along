// P1 "First-screen clarity": when the plan picks a later pass than the first screen's "Next time you
// can see it" line, the card says why in one engine-written line. No network: Open-Meteo and Exa are
// answered from hand-made tables (planner-helpers.ts); the orbit numbers are M5's Ypsilanti fixture.
import { describe, expect, it } from 'vitest';
import { cloudReply, ctxWith, mockFetch, QUIET_NEWS } from './planner-helpers';
import { buildCard, earliestPassFor, runFixedPlan, WHY_NOT_NEXT } from '../src/agent/fixedPlan';
import { audit } from '../src/agent/audit';
import { passTexts, runTool, type RunContext } from '../src/agent/tools';

/** 100% cloud in the hour of the first Ypsilanti pass (Sat Nov 14, 5:56 PM EST = 22:56 UTC), 36% after. */
const firstHourCloudy = (t: number) => (t < Date.UTC(2026, 10, 14, 23) / 1000 ? 100 : 36);
const whyLines = (lines: string[]) => lines.filter((l) => l.startsWith(WHY_NOT_NEXT));

function services(cloudFor: (t: number) => number) {
  return mockFetch({ openMeteo: () => cloudReply('America/Detroit', -18000, cloudFor), exa: () => QUIET_NEWS }).fetch;
}

/** The model's path: the engine's tools called through runTool, so ctx.toolTexts holds every tool result. */
async function toolRun(cloudFor: (t: number) => number, nights: string[] | null) {
  const ctx = ctxWith(services(cloudFor));
  const found = (await runTool(ctx, 'findCity', { name: 'Ypsilanti' })) as { candidates: { placeId: string }[] };
  const leg = (await runTool(ctx, 'planLeg', { placeId: found.candidates[0].placeId, nights })) as { bestInThisLeg: string };
  await runTool(ctx, 'showPass', { passId: leg.bestInThisLeg, why: 'Highest score.' });
  return { ctx, card: buildCard(ctx, ctx.shown, ctx.why ?? '') };
}

const firstOf = (ctx: RunContext) => earliestPassFor(ctx, [...ctx.places.values()][0])!;

describe('P1 the "why not the next pass" line (src/agent/fixedPlan.ts whyNotNextLine)', () => {
  it('earliest pass 100% cloud, a later one 36%: exactly one line, naming the earlier time and "100%"', async () => {
    const ctx = ctxWith(services(firstHourCloudy));
    const r = await runFixedPlan(ctx, { place: 'Ypsilanti', nights: null, earliest: null, latest: null });
    const first = firstOf(ctx);
    expect(first.cloud).toBe(100);
    expect(r.card.passId).not.toBe(first.id);
    const chosen = ctx.passes.get(r.card.passId!)!;
    expect(chosen.cloud).toBe(36);
    const why = whyLines(r.card.lines);
    expect(why).toHaveLength(1);
    const t = passTexts(ctx, first);
    expect(why[0]).toContain(`${t.night} at ${t.start}`);
    expect(why[0]).toContain('100%');
    expect(why[0]).toContain('36%');
    console.log(`(P1 a) chosen ${chosen.id} "${r.card.headline}" | ${why[0]}`);
  });

  it('the line\'s numbers pass the number audit against the run\'s own tool results (0 unverified)', async () => {
    const { ctx, card } = await toolRun(firstHourCloudy, null);
    const why = whyLines(card.lines);
    expect(why).toHaveLength(1);
    const a = audit(why[0], ctx.toolTexts, '');
    expect(a.tokens.length).toBeGreaterThanOrEqual(4); // the day, the clock time, 100 and 36
    expect(a.flagged).toEqual([]);
    expect(a.badge).toBe('audit: 0 unverified numbers');
  });

  it('when the chosen pass is the earliest one, there is no such line', async () => {
    const ctx = ctxWith(services(() => 36));
    const r = await runFixedPlan(ctx, { place: 'Ypsilanti', nights: null, earliest: null, latest: null });
    expect(r.card.passId).toBe(firstOf(ctx).id);
    expect(whyLines(r.card.lines)).toHaveLength(0);
    expect(r.card.lines.join(' ')).not.toContain(WHY_NOT_NEXT);
  });

  it('earliest pass outside the chosen nights: the line says so, and its numbers still pass the audit', async () => {
    const { ctx, card } = await toolRun(() => 36, ['2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19']);
    const why = whyLines(card.lines);
    expect(why).toHaveLength(1);
    expect(why[0]).toContain('outside your nights or times (not on your nights)');
    expect(why[0]).toContain(passTexts(ctx, firstOf(ctx)).start);
    expect(audit(why[0], ctx.toolTexts, '').flagged).toEqual([]);
  });
});
