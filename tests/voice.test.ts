// X3 "Listen": with a stubbed speechSynthesis, speak() is called once per minute with exactly the live
// region's text (C3's real 60-second timer in src/ui/whereRegion.ts, run on fake timers) and once per
// finished plan with exactly the result line (real fixed-plan cards from the Ypsilanti fixture); with no
// speechSynthesis in window the toggle is not shown.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runFixedPlan } from '../src/agent/fixedPlan';
import { initVoice, resultLine, VOICE_LABEL_OFF, VOICE_LABEL_ON, type VoiceWindow } from '../src/ui/voice';
import { startWhereRegion, WHERE_EVERY_MS } from '../src/ui/whereRegion';
import { cloudReply, ctxWith, mockFetch, NOW, satrec } from './planner-helpers';

/** A stub of the browser's speech: records each utterance's text and, for the minute test, what the
 * live region held at that moment. */
function stubWindow(region?: { textContent: string | null }) {
  const spoken: { text: string; regionAtCall: string | null }[] = [];
  let cancels = 0;
  class Utterance {
    constructor(public text: string) {}
  }
  const win: VoiceWindow = {
    speechSynthesis: {
      speak: (u) => spoken.push({ text: (u as Utterance).text, regionAtCall: region ? region.textContent : null }),
      cancel: () => cancels++,
    },
    SpeechSynthesisUtterance: Utterance,
  };
  return { win, spoken, cancels: () => cancels };
}

function fakeToggle() {
  const attrs: Record<string, string> = {};
  let onClick: (() => void) | null = null;
  return {
    hidden: true as boolean | string,
    textContent: null as string | null,
    attrs,
    setAttribute: (n: string, v: string) => void (attrs[n] = v),
    addEventListener: (_t: 'click', fn: () => void) => void (onClick = fn),
    click: () => onClick?.(),
    hasClick: () => onClick !== null,
  };
}
const fakeCaption = () => ({ hidden: true as boolean | string });
const fakeText = () => ({ textContent: '' as string | null });

describe('X3 voice: the live region, once a minute', () => {
  beforeEach(() => vi.useFakeTimers({ now: NOW }));
  afterEach(() => vi.useRealTimers());

  it('speaks exactly the region text at each 60-second refresh, never on its own, and stops when turned off', () => {
    const region = { textContent: '' as string | null, dataset: {} as Record<string, string | undefined> };
    const { win, spoken } = stubWindow(region);
    const toggle = fakeToggle();
    const caption = fakeCaption();
    const text = fakeText();
    const voice = initVoice({ win, toggle, caption, captionText: text });
    const where = startWhereRegion({ el: region, getSatrec: () => satrec, onText: (t) => voice.sayWhere(t) });
    // Load: the region is written, but the toggle is off, so nothing is spoken.
    expect(region.textContent).toMatch(/km up\.$/);
    expect(spoken).toHaveLength(0);
    toggle.click();
    expect(voice.isOn()).toBe(true);
    expect(toggle.textContent).toBe(VOICE_LABEL_ON);
    expect(toggle.attrs['aria-pressed']).toBe('true');
    // Turning it on does not speak by itself: the next words come with the next minute's refresh.
    expect(spoken).toHaveLength(0);
    // 5 minutes in 1-second steps (the page's per-second tick rate): exactly 5 calls, one per minute.
    const callSeconds: number[] = [];
    for (let s = 1; s <= 300; s++) {
      const before = spoken.length;
      vi.advanceTimersByTime(1000);
      if (spoken.length > before) callSeconds.push(s);
    }
    expect(spoken).toHaveLength(5);
    expect(callSeconds).toEqual([60, 120, 180, 240, 300]);
    for (const c of spoken) expect(c.text).toBe(c.regionAtCall);
    expect(spoken[4].text).toBe(region.textContent);
    // The caption shows the same words that were spoken.
    expect(text.textContent).toBe(region.textContent);
    expect(caption.hidden).toBe(false);
    // The station moves about 450 km a minute, so the sentence (and so the speech) changes.
    expect(new Set(spoken.map((c) => c.text)).size).toBeGreaterThan(1);
    console.log(`(X3 a) calls at ${callSeconds.join(', ')} s; first "${spoken[0].text}"; last "${spoken[4].text}"`);
    toggle.click();
    expect(toggle.textContent).toBe(VOICE_LABEL_OFF);
    expect(caption.hidden).toBe(true);
    vi.advanceTimersByTime(3 * WHERE_EVERY_MS);
    expect(spoken).toHaveLength(5);
    where.stop();
  });
});

describe('X3 voice: the plan, once per finished plan', () => {
  const PLAIN = { place: 'Ypsilanti', nights: null, earliest: null, latest: null };

  it('speaks exactly the result line of each card: headline, then where to look', async () => {
    const { win, spoken } = stubWindow();
    const toggle = fakeToggle();
    const caption = fakeCaption();
    const text = fakeText();
    const voice = initVoice({ win, toggle, caption, captionText: text });
    voice.setOn(true);
    const clear = mockFetch({ openMeteo: () => cloudReply('America/Detroit', -18000, () => 0) });
    const r1 = await runFixedPlan(ctxWith(clear.fetch), PLAIN);
    expect(r1.card.kind).toBe('pass');
    voice.sayPlan(r1.card);
    expect(spoken).toHaveLength(1);
    expect(spoken[0].text).toBe(resultLine(r1.card));
    expect(spoken[0].text).toBe(`${r1.card.headline} ${r1.card.lines[0]}`);
    expect(spoken[0].text).toMatch(/^Go out .+ at .+ in Ypsilanti.+\. Look [NSEW]{1,3} at /);
    expect(text.textContent).toBe(spoken[0].text);
    // A second plan (no pass in a 1-minute window) gives one more call, with its headline alone.
    const r2 = await runFixedPlan(ctxWith(clear.fetch), { ...PLAIN, earliest: '03:00', latest: '03:01' });
    expect(r2.card.kind).toBe('none');
    voice.sayPlan(r2.card);
    expect(spoken).toHaveLength(2);
    expect(spoken[1].text).toBe(r2.card.headline);
    console.log(`(X3 b) plan 1: "${spoken[0].text}" | plan 2: "${spoken[1].text}"`);
  });

  it('says nothing while the toggle is off', async () => {
    const { win, spoken } = stubWindow();
    const voice = initVoice({ win, toggle: fakeToggle(), caption: fakeCaption(), captionText: fakeText() });
    voice.sayPlan({ kind: 'none', headline: 'No visible pass in your window.', lines: [] });
    voice.sayWhere('110 km northeast of Detroit, United States, heading east, 418 km up.');
    expect(spoken).toHaveLength(0);
  });
});

describe('X3 voice: a browser without speech', () => {
  it('no speechSynthesis in window: the toggle stays hidden, has no click handler, and nothing throws', () => {
    const win: VoiceWindow = {};
    expect('speechSynthesis' in win).toBe(false);
    const toggle = fakeToggle();
    toggle.hidden = false;
    const caption = fakeCaption();
    const voice = initVoice({ win, toggle, caption, captionText: fakeText() });
    expect(voice.supported).toBe(false);
    expect(toggle.hidden).toBe(true);
    expect(toggle.hasClick()).toBe(false);
    voice.setOn(true);
    expect(voice.isOn()).toBe(false);
    voice.sayWhere('anything');
    expect(caption.hidden).toBe(true);
  });

  it('with speechSynthesis the toggle is shown', () => {
    const toggle = fakeToggle();
    initVoice({ win: stubWindow().win, toggle, caption: fakeCaption(), captionText: fakeText() });
    expect(toggle.hidden).toBe(false);
    expect(toggle.textContent).toBe(VOICE_LABEL_OFF);
    expect(toggle.attrs['aria-pressed']).toBe('false');
  });
});
