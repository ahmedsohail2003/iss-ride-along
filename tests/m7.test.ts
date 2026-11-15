// M7: the first screen's two pieces of logic. A stranger types only a town and presses Enter
// (placeFromSentence), and the next-pass line is the first pass of the same engine the passes
// table uses, in words a stranger reads (nextPassText).
import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { satrecFromTle } from '../src/orbit/orbit';
import { compass, predictForPlace, type PassFixture } from '../src/orbit/passes';
import { nextPassText, YPSILANTI } from '../src/passes-ui';
import { EXAMPLES, placeFromSentence } from '../src/ui/plannerPanel';

const fx: PassFixture = JSON.parse(readFileSync(new URL('./fixtures/passes-ypsilanti-2026-11-14.json', import.meta.url), 'utf8'));
const satrec = satrecFromTle(`${fx.tle.line1}\n${fx.tle.line2}`);
const from = new Date(fx.window.startUtc);

describe('M7 placeFromSentence: a town typed alone is the place', () => {
  test('built-in names and short names are places; the examples and long sentences are not', () => {
    expect(placeFromSentence('Detroit')).toBe('Detroit');
    expect(placeFromSentence('  chicago, il ')).toBe('chicago, il');
    expect(placeFromSentence('Ann Arbor')).toBe('Ann Arbor');
    expect(placeFromSentence(EXAMPLES.trip)).toBeNull();
    expect(placeFromSentence(EXAMPLES.simple)).toBeNull();
    expect(placeFromSentence('Detroit tomorrow after 9')).toBeNull();
    // R3: a place, never the sentence after it
    expect(placeFromSentence('Detroit, this weekend after dinner')).toBe('Detroit');
    expect(placeFromSentence('')).toBeNull();
  });
});

describe('M7 nextPassText: the first-screen line', () => {
  test('Ypsilanti: the first pass of the engine, with its day, time, compass word and minutes', () => {
    const { text, pass } = nextPassText(satrec, YPSILANTI, from);
    const first = predictForPlace(satrec, YPSILANTI, from, 5).passes[0];
    expect(pass?.start.getTime()).toBe(first.start.getTime());
    const dir = compass(first.startAzDeg);
    expect(text).toContain(`Next time you can see it from ${YPSILANTI.name}:`);
    expect(text).toContain(`(${dir})`);
    expect(text).toMatch(/\d{1,2}:\d{2} (AM|PM), look [a-z-]+ \([NSEW]{1,3}\), \d+ min/);
    console.log(`(m7) ${text}`);
  });
  test('a place with no visible pass says so instead of a time', () => {
    const { text, pass } = nextPassText(satrec, { name: 'Alert', latDeg: 82.5, lonDeg: -62.3 }, from);
    expect(pass).toBeNull();
    expect(text.startsWith('Alert: ')).toBe(true);
  });
});
