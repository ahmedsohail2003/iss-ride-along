// X6 Forecast lab: the harvest backtest on the bundled data (src/data/altdata.json), the no-peeking test,
// the stored price result and the label, the greenness decode of the two bundled NASA images, and the
// money-question check before the model. No network.
//
// The no-peeking test is shown failing on purpose with X6_LEAK=1 (the backtest then fits every year on
// ALL years, its own future included):  X6_LEAK=1 npx vitest run tests/altdata.test.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { harvestBacktest, type ByYear, type TrainPicker } from '../src/altdata/backtest';
import { ALTDATA, cardHtml, cornBeltInView, labelHtml, LABEL_START, runHarvest } from '../src/altdata/card';
import { decodePng, meanGreenness, parseColourKey } from '../scripts/ndvi-decode.mjs';
import { runAgent } from '../src/agent/loop';
import { MONEY_LINE, isMoneyQuestion } from '../src/agent/money';
import { gemini } from '../src/agent/providers';
import { ctxWith, mockFetch, scripted } from './planner-helpers';
import { TEST_KEY } from './fixtures/test-key.mjs';

const h = runHarvest();
const allYears: TrainPicker = (years) => years;
const PICK: TrainPicker | undefined = process.env.X6_LEAK ? allYears : undefined;

describe('X6 harvest backtest on the bundled data', () => {
  it('skill 0.567 over 31 test years from 1994, 2004 absent; errors 9.76 and 6.42; 2012 row; 30 of 31 in range; 2026 forecast 182.6', () => {
    const r12 = h.rows.find((r) => r.year === 2012)!;
    console.log(
      `(X6) skill ${h.skill.toFixed(4)} over ${h.n} test years ${h.first}-${h.last}, missing ${h.missing.join(',')}; ` +
        `RMSE trend ${h.rmseTrend.toFixed(3)} satellite ${h.rmseSatellite.toFixed(3)} last-year ${h.rmseLastYear.toFixed(3)}; ` +
        `2012 trend ${r12.trend.toFixed(2)} satellite ${r12.satellite.toFixed(2)} actual ${r12.actual}; in 80% range ${h.hits}/${h.n}; ` +
        `2026 forecast ${h.forecast!.value.toFixed(2)} (${h.forecast!.low.toFixed(1)}-${h.forecast!.high.toFixed(1)}), trend ${h.forecast!.trend.toFixed(2)}`,
    );
    expect(Math.abs(h.skill - 0.567)).toBeLessThanOrEqual(0.005);
    expect(h.n).toBe(31);
    expect(h.first).toBe(1994);
    expect(h.last).toBe(2025);
    expect(h.rows.some((r) => r.year === 2004)).toBe(false);
    expect(h.missing).toEqual([2004]);
    expect(Math.abs(h.rmseTrend - 9.76)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(h.rmseSatellite - 6.42)).toBeLessThanOrEqual(0.05);
    expect(Math.abs(r12.trend - 158.3)).toBeLessThanOrEqual(0.2);
    expect(Math.abs(r12.satellite - 142.1)).toBeLessThanOrEqual(0.2);
    expect(r12.actual.toFixed(1)).toBe('123.1');
    expect(h.hits).toBe(30);
    expect(Math.abs(h.forecast!.value - 182.6)).toBeLessThanOrEqual(0.3);
    expect(Math.abs(h.rmseLastYear - 12.84)).toBeLessThanOrEqual(0.05);
  });
});

/** Every forecast (trend and satellite) for 2010 and earlier, to 6 decimals. */
function upTo2010(signal: ByYear, yields: ByYear, train?: TrainPicker) {
  const r = harvestBacktest(signal, yields, { lastYear: 2025, forecastYear: 2026, train });
  return r.rows.filter((x) => x.year <= 2010).map((x) => `${x.year}:${x.trend.toFixed(6)}:${x.satellite.toFixed(6)}`);
}
const doubledAfter2010 = (o: ByYear) => Object.fromEntries(Object.entries(o).map(([y, v]) => [y, Number(y) > 2010 ? 2 * v : v]));

describe('X6 no peeking: a forecast never sees its own future', () => {
  it('doubling every yield after 2010 leaves every forecast for 2010 and earlier unchanged (6 decimals)', () => {
    const before = upTo2010(ALTDATA.signal, ALTDATA.yields, PICK);
    const after = upTo2010(ALTDATA.signal, doubledAfter2010(ALTDATA.yields), PICK);
    expect(before.length).toBe(16); // 1994-2010 without 2004
    expect(after).toEqual(before);
  });
  it('doubling every VHI value after 2010 leaves every forecast for 2010 and earlier unchanged (6 decimals)', () => {
    const before = upTo2010(ALTDATA.signal, ALTDATA.yields, PICK);
    const after = upTo2010(doubledAfter2010(ALTDATA.signal), ALTDATA.yields, PICK);
    expect(after).toEqual(before);
  });
  it('control: the same check catches a version that fits on all years', () => {
    const before = upTo2010(ALTDATA.signal, ALTDATA.yields, allYears);
    expect(upTo2010(ALTDATA.signal, doubledAfter2010(ALTDATA.yields), allYears)).not.toEqual(before);
    expect(upTo2010(doubledAfter2010(ALTDATA.signal), ALTDATA.yields, allYears)).not.toEqual(before);
  });
});

const text = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

describe('X6 price result and the label', () => {
  it('the stored price result has skill between -0.06 and +0.06 over 23 test years, and no price series is bundled', () => {
    const p = ALTDATA.price;
    console.log(`(X6) price skill ${p.skill} over ${p.n} years ${p.first}-${p.last}, from ${p.from}`);
    expect(p.skill).toBeGreaterThanOrEqual(-0.06);
    expect(p.skill).toBeLessThanOrEqual(0.06);
    expect(p.n).toBe(23);
    const raw = readFileSync(resolve('src/data/altdata.json'), 'utf8');
    expect(raw).not.toMatch(/"(19|20)\d\d-(0[1-9]|1[0-2])"\s*:/);
  });
  it('the rendered label holds the fixed words and the same skill figures the functions return', () => {
    const html = cardHtml(h);
    const label = /<p class="fc-label" data-fc-label>(.*?)<\/p>/.exec(html)![1];
    const t = text(label);
    console.log(`(X6) label: ${t}`);
    expect(t.startsWith(LABEL_START)).toBe(true);
    expect(t).toContain('Research demo, not investment advice');
    expect(/data-skill-yield>([^<]*)</.exec(label)![1]).toBe(h.skill.toFixed(2));
    expect(/data-skill-price>([^<]*)</.exec(label)![1]).toBe(ALTDATA.price.skill.toFixed(2));
    expect(t).toBe(
      "Research demo, not investment advice. A retrospective test with today's data: each year's forecast used only earlier years " +
        '(31 test years, 1994-2025; 2004 skipped for a gap in the satellite record). Harvest forecast skill against the trend line: 0.57 ' +
        '(0 = no better than the trend line, 1 = perfect). The same satellite signal tested on the corn price from September to December: ' +
        'skill 0.00 against "no change" over 23 years: no measurable skill. This page shows no price forecast.',
    );
  });
  it('no element on the card contains a price forecast: outside the label the card never mentions a price', () => {
    const html = cardHtml(h);
    const rest = text(html.replace(/<p class="fc-label" data-fc-label>.*?<\/p>/, ''));
    expect(rest).not.toMatch(/price|\$|dollar|cents|futures|buy|sell/i);
    expect(text(html)).not.toMatch(/\$\s*\d|per bushel|price (will|to reach|forecast:)/i);
  });
  it('a harvest skill at 0 or below says "no better than the trend line" and hides the 2026 forecast', () => {
    const worse = { ...h, skill: -0.1 };
    expect(text(labelHtml(worse, ALTDATA.price))).toContain('-0.10, no better than the trend line');
    expect(cardHtml(worse)).not.toContain('data-forecast');
    expect(cardHtml(h)).toContain('data-forecast="182.6"');
  });
});

describe('X6 greenness read back from the two bundled NASA images', () => {
  it('decoding each image with the bundled GIBS colour key gives the stored values (0.762 in 2012, 0.866 in 2026)', () => {
    const key = parseColourKey(readFileSync(resolve('src/data/gibs-ndvi-colormap.xml'), 'utf8'));
    for (const [day, file, expected] of [
      ['2012-07-27', 'src/data/ndvi-cornbelt-2012.png', 0.762],
      ['2026-07-28', 'src/data/ndvi-cornbelt-2026.png', 0.866],
    ] as const) {
      const g = meanGreenness(decodePng(readFileSync(resolve(file))), key);
      console.log(`(X6) ${day}: ${g.width}x${g.height}, ${g.visible} visible, ${g.matched} matched, NDVI ${g.low!.toFixed(4)}-${g.high!.toFixed(4)} (mean ${g.mean!.toFixed(4)})`);
      expect(g.matched).toBe(g.visible);
      expect(Math.abs(g.mean! - expected)).toBeLessThan(0.0005);
      expect(Math.abs(g.mean! - ALTDATA.ndvi[day].mean)).toBeLessThan(0.0001);
    }
  });
});

describe('X6 central Iowa in the station footprint', () => {
  it('in view with the station over Des Moines at 420 km, not in view with it over Lisbon', () => {
    expect(cornBeltInView(41.6, -93.6, 420)).toBe(true);
    expect(cornBeltInView(38.7, -9.1, 420)).toBe(false);
  });
});

describe('X6 step 7: money questions never reach the model', () => {
  it('"should I buy corn futures?" returns the fixed line and the model stub is called 0 times', async () => {
    const { fetch, calls } = mockFetch({ model: scripted([{ candidates: [{ content: { role: 'model', parts: [{ text: 'Buy.' }] }, finishReason: 'STOP' }] }]) });
    const ctx = ctxWith(fetch);
    const r = await runAgent({
      sentence: 'should I buy corn futures?',
      provider: gemini(TEST_KEY, 'gemini-4-hydrogen', fetch),
      ctx,
      controls: { place: 'Ypsilanti', nights: null, earliest: null, latest: null },
    });
    expect(r.card.headline).toBe(MONEY_LINE);
    expect(MONEY_LINE).toBe('The planner does not give financial advice. The Forecast lab shows what satellites can and cannot forecast.');
    expect(r.modelCalls).toBe(0);
    expect(calls.model).toBe(0);
    expect(calls.urls).toEqual([]);
  });
  it('catches buying, selling, investing, stocks and futures; leaves sighting plans alone', () => {
    for (const q of ['should I buy corn futures?', 'Is it time to sell my wheat contracts', 'what stocks should I invest in', 'Will the corn price go up, should I buy?', 'trading tips please'])
      expect(isMoneyQuestion(q), q).toBe(true);
    for (const q of ['Ypsilanti, before 8:30 PM, any night this week', 'Ypsilanti until Monday, then Chicago Tuesday to Thursday, kids in bed by 8:30', 'Should I buy a telescope to see the ISS?', 'Detroit'])
      expect(isMoneyQuestion(q), q).toBe(false);
  });
});
