// The page gives the AI run longer than the loop's default: 60 s for one reply, 2 minutes for the plan.
import { describe, expect, it } from 'vitest';
import { LIMITS } from '../src/agent/loop';
import { PAGE_LIMITS } from '../src/ui/plannerPanel';

describe("the page's limits for the AI run", () => {
  it('are 60 s for one reply and 120 s for the whole plan, with the same 6 calls', () => {
    expect(PAGE_LIMITS).toEqual({ maxCalls: 6, replyMs: 60_000, runMs: 120_000 });
  });
  it("leave the loop's own default at 15 s and 30 s", () => {
    expect(LIMITS).toEqual({ maxCalls: 6, replyMs: 15_000, runMs: 30_000 });
  });
});
