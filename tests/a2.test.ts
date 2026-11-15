// A2 "What the plan hands you": the calendar file and the one-page briefing. No network: every
// service is answered from a hand-made table or a fixture (planner-helpers.ts).
import { describe, expect, it } from 'vitest';
import ypsiFixture from './fixtures/passes-ypsilanti-2026-11-14.json';
import { TEST_KEY } from './fixtures/test-key.mjs';
import { cloudReply, ctxWith, mockFetch, QUIET_NEWS, SIMPLE, YPSI_LAT } from './planner-helpers';
import { runFixedPlan } from '../src/agent/fixedPlan';
import { greatCircleKm } from '../src/orbit/orbit';
import { audit } from '../src/agent/audit';
import { CLASS_QUESTIONS } from '../src/agent/briefing';
import { runAgent } from '../src/agent/loop';
import { gemini } from '../src/agent/providers';
import { passTexts, runTool, whatItFliesOver, type RunContext } from '../src/agent/tools';
import { foldLine, passToIcs } from '../src/passes/ics';

const first = ypsiFixture.passes[0];
/** The fixture's first pass in UTC, worked out from its EST text alone: "17:56:28" EST + 5 h. */
const utcOf = (date: string, hms: string) => new Date(`${date}T${hms}-05:00`).toISOString().replace(/[-:]/g, '').replace('.000', '');
const FIX_START = utcOf(first.date, first.start); // 20261114T225628Z
const FIX_END = utcOf(first.date, first.end);
const bytes = (s: string) => new TextEncoder().encode(s).length;
/** RFC 5545 unfolding: a CRLF followed by one space joins two lines. */
const unfold = (t: string) => t.replace(/\r\n /g, '');

/** A run with the engine's own tool calls, cloud 36% at every hour, quiet station news. */
async function ypsiRun(): Promise<{ ctx: RunContext; toolTexts: string[] }> {
  const { fetch } = mockFetch({ openMeteo: () => cloudReply('America/Detroit', -18000, () => 36), exa: () => QUIET_NEWS });
  const ctx = ctxWith(fetch);
  const found = (await runTool(ctx, 'findCity', { name: 'Ypsilanti' })) as { candidates: { placeId: string }[] };
  await runTool(ctx, 'planLeg', { placeId: found.candidates[0].placeId, nights: null });
  await runTool(ctx, 'stationNews', { query: 'ISS news this week' });
  await runTool(ctx, 'orbitDataAge', {});
  // whatItFliesOver is an engine step (writeBriefing calls it); its result joins this run's tool results.
  const flies = await whatItFliesOver(ctx, 'ypsilanti-1', 'model');
  return { ctx, toolTexts: [...ctx.toolTexts, JSON.stringify(flies)] };
}

function checkCalendarText(text: string) {
  expect(text.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
  expect(text.endsWith('END:VCALENDAR\r\n')).toBe(true);
  expect(text.match(/BEGIN:VEVENT/g)?.length).toBe(1);
  expect(text.match(/END:VEVENT/g)?.length).toBe(1);
  // every line ends CRLF: no bare LF and no bare CR anywhere
  expect(/[^\r]\n/.test(text) || /\r[^\n]/.test(text)).toBe(false);
  const lines = text.split('\r\n');
  expect(lines.pop()).toBe('');
  for (const l of lines) expect(bytes(l)).toBeLessThanOrEqual(75);
  const u = unfold(text);
  for (const f of ['VERSION:2.0', 'PRODID:', 'UID:', 'DTSTAMP:', 'SUMMARY:', 'DESCRIPTION:', 'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-PT10M', 'END:VALARM'])
    expect(u, f).toContain(f);
  return u;
}

describe('A2 calendar file (src/passes/ics.ts)', () => {
  it("the fixture's first Ypsilanti pass: one VEVENT, DTSTART/DTEND equal the fixture in UTC to the second, 10-minute alarm, CRLF, <= 75 bytes", async () => {
    const { ctx } = await ypsiRun();
    const engine = ctx.passes.get('ypsilanti-1')!;
    // the engine's first pass is the fixture's first pass (M5: start within 1.3 s)
    expect(Math.abs(engine.pass.start.getTime() - Date.parse(`${first.date}T${first.start}-05:00`))).toBeLessThan(5000);
    const pass = { ...engine.pass, start: new Date(`${first.date}T${first.start}-05:00`), end: new Date(`${first.date}T${first.end}-05:00`) };
    const f = passToIcs(pass, { name: 'Ypsilanti, Michigan', timeZone: 'America/Detroit' }, { now: ctx.now() });
    const u = checkCalendarText(f.text);
    expect(FIX_START).toBe('20261114T225628Z');
    expect(u).toMatch(new RegExp(`^DTSTART:${FIX_START}$`, 'm'));
    expect(u).toMatch(new RegExp(`^DTEND:${FIX_END}$`, 'm'));
    expect(f.filename).toBe('iss-pass-ypsilanti-2026-11-14.ics');
    console.log(`A2 ics: ${f.filename}, ${f.text.split('\r\n').length - 1} lines, longest ${Math.max(...f.text.split('\r\n').map(bytes))} bytes, DTSTART ${FIX_START}, DTEND ${FIX_END}`);
  });

  it('makeCalendarFile for the engine pass id: same checks, times = the engine pass to the second', async () => {
    const { ctx } = await ypsiRun();
    const out = (await runTool(ctx, 'makeCalendarFile', { passId: 'ypsilanti-1' })) as { prepared: string };
    expect(out.prepared).toMatch(/^iss-pass-ypsilanti-2026-11-14\.ics$/);
    const file = ctx.outputs.calendar!.file;
    const u = checkCalendarText(file.text);
    const p = ctx.passes.get('ypsilanti-1')!.pass;
    const z = (d: Date) => new Date(Math.round(d.getTime() / 1000) * 1000).toISOString().replace(/[-:]/g, '').replace('.000', '');
    expect(u).toMatch(new RegExp(`^DTSTART:${z(p.start)}$`, 'm'));
    expect(u).toMatch(new RegExp(`^DTEND:${z(p.end)}$`, 'm'));
    // the description carries the card's numbers, written by the engine
    const t = passTexts(ctx, ctx.passes.get('ypsilanti-1')!);
    expect(u).toContain(`Look ${t.look} at ${t.start}`);
    expect(u).toContain(`climbs to ${t.peak}`);
  });

  it('folding: a long line with 2-byte characters is split at <= 75 bytes, never inside a character, and unfolds to the original', () => {
    const line = `DESCRIPTION:${'climbs to 63° in the SE; '.repeat(12)}`;
    const parts = foldLine(line);
    expect(parts.length).toBeGreaterThan(3);
    for (const p of parts) expect(bytes(p)).toBeLessThanOrEqual(75);
    for (const p of parts.slice(1)) expect(p.startsWith(' ')).toBe(true);
    expect(parts.map((p, i) => (i ? p.slice(1) : p)).join('')).toBe(line);
    expect(parts.join('')).not.toContain('�');
  });

  it('a calendar request for an id the engine never returned is refused', async () => {
    const { ctx } = await ypsiRun();
    const out = (await runTool(ctx, 'makeCalendarFile', { passId: 'ypsilanti-99' })) as { error?: string };
    expect(out.error).toMatch(/^refused/);
    expect(ctx.outputs.calendar).toBeNull();
    expect(ctx.trace.at(-1)).toMatchObject({ tool: 'makeCalendarFile', ok: false });
  });
});

describe('A2 briefing (src/agent/briefing.ts)', () => {
  it("the family sheet for the fixture's first pass: only numbers present in that pass's tool results (audit: 0 unverified numbers)", async () => {
    const { ctx, toolTexts } = await ypsiRun();
    await runTool(ctx, 'writeBriefing', { passId: 'ypsilanti-1', kind: 'family' });
    const sheet = ctx.outputs.sheets.get('family')!;
    // audited against the tool results the run produced (findCity, planLeg, stationNews, orbitDataAge, whatItFliesOver)
    const a = audit(sheet.text, toolTexts, '');
    expect(a.flagged).toEqual([]);
    expect(a.badge).toBe('audit: 0 unverified numbers');
    expect(sheet.audit.badge).toBe('audit: 0 unverified numbers');
    // the audit has teeth: one planted number on the sheet is caught
    expect(audit(`${sheet.text}\nIt flies at 512 km.`, toolTexts, '').flagged).toEqual(['512']);
    console.log(`A2 family sheet: ${a.tokens.length} numbers on the sheet, ${a.badge}`);
  });

  it('the class handout has the pass time, direction, peak height, the cloud value with its source, and 3 questions with no digits', async () => {
    const { ctx, toolTexts } = await ypsiRun();
    await runTool(ctx, 'writeBriefing', { passId: 'ypsilanti-1', kind: 'class' });
    const sheet = ctx.outputs.sheets.get('class')!;
    const t = passTexts(ctx, ctx.passes.get('ypsilanti-1')!);
    expect(t.start).toBe('5:56 PM');
    expect(sheet.text).toContain(`${t.night} at ${t.start}`);
    expect(sheet.text).toContain(`Start looking ${t.look}`);
    expect(sheet.text).toContain(`in the ${t.peakDirection}`);
    expect(sheet.text).toContain(`It climbs to ${t.peak} above the horizon`);
    expect(sheet.text).toContain('Cloud 36% for that hour (Open-Meteo, fetched 12:36 PM)');
    expect(sheet.questions).toHaveLength(3);
    expect(sheet.questions).toEqual(CLASS_QUESTIONS);
    for (const q of sheet.questions) expect(/\d/.test(q), q).toBe(false);
    expect(audit(sheet.text, toolTexts, '').badge).toBe('audit: 0 unverified numbers');
    expect(sheet.blocks.map((b) => b.heading)).toContain(`What it flies over in the 10 minutes before ${t.start}`);
    expect(sheet.text).toContain('NASA EONET');
  });

  it("the model's note: at most 3 sentences, and a made-up number in it is flagged on the sheet's badge", async () => {
    const { ctx } = await ypsiRun();
    await runTool(ctx, 'writeBriefing', { passId: 'ypsilanti-1', kind: 'family', note: 'Bring a jacket. It reaches 63° at 5:56 PM. It flies 512 km up. A fourth sentence.' });
    const sheet = ctx.outputs.sheets.get('family')!;
    expect(sheet.note).toBe('Bring a jacket. It reaches 63° at 5:56 PM. It flies 512 km up.');
    expect(sheet.audit.flagged).toEqual(['512']);
    expect(ctx.trace.at(-1)).toMatchObject({ tool: 'writeBriefing', ok: false });
  });

  it('a briefing request for an id the engine never returned is refused (and before any planLeg, even a real-looking id)', async () => {
    const { ctx } = await ypsiRun();
    const out = (await runTool(ctx, 'writeBriefing', { passId: 'ypsilanti-99', kind: 'class' })) as { error?: string };
    expect(out.error).toMatch(/^refused: pass id "ypsilanti-99" was not returned by the engine/);
    expect(ctx.outputs.sheets.size).toBe(0);
    expect(ctx.trace.at(-1)).toMatchObject({ tool: 'writeBriefing', ok: false });
    const fresh = ctxWith(mockFetch({}).fetch);
    const out2 = (await runTool(fresh, 'writeBriefing', { passId: 'ypsilanti-1', kind: 'family' })) as { error?: string };
    expect(out2.error).toMatch(/^refused/);
    expect(fresh.outputs.sheets.size).toBe(0);
  });

  it('run by the agent: scripted model replies call makeCalendarFile and writeBriefing next to showPass; both are prepared, nothing else happens', async () => {
    const call = (id: string, name: string, args: unknown) => ({ functionCall: { id, name, args } });
    const reply = (parts: unknown[]) => ({ candidates: [{ content: { role: 'model', parts }, finishReason: 'STOP' }] });
    const replies = [
      reply([call('c1', 'findCity', { name: 'Ypsilanti' })]),
      reply([call('c2', 'planLeg', { placeId: 'ypsilanti', nights: ['2026-11-14'], earliest: '', latest: '' }), call('c3', 'stationNews', { query: 'ISS news' })]),
      reply([call('c4', 'showPass', { passId: 'ypsilanti-1', why: 'It climbs to 63°.' }), call('c5', 'makeCalendarFile', { passId: 'ypsilanti-1' }), call('c6', 'writeBriefing', { passId: 'ypsilanti-1', kind: 'class' })]),
      reply([{ text: 'Go out at 5:56 PM.' }]),
    ];
    const { fetch } = mockFetch({ openMeteo: () => cloudReply('America/Detroit', -18000, () => 36), exa: () => QUIET_NEWS, model: (n) => Response.json(replies[n - 1]) });
    const ctx = ctxWith(fetch);
    const r = await runAgent({ sentence: `${SIMPLE}, and a class handout with a reminder`, provider: gemini(TEST_KEY, 'gemini-4-hydrogen', fetch), ctx, controls: { place: 'Ypsilanti', nights: null, earliest: null, latest: '20:30' } });
    expect(r.mode).toBe('ai');
    expect(r.audit!.unverified).toBe(0);
    expect(ctx.outputs.calendar?.file.filename).toBe('iss-pass-ypsilanti-2026-11-14.ics');
    expect(ctx.outputs.sheets.get('class')?.audit.unverified).toBe(0);
    const tools = ctx.trace.map((t) => t.tool);
    expect(tools).toEqual(expect.arrayContaining(['showPass', 'makeCalendarFile', 'whatItFliesOver', 'writeBriefing']));
  });
});

describe('A2 step 4: a nearby clear place when every allowed pass is clouded out (fixed plan)', () => {
  const EVERY_NIGHT = { place: 'Ypsilanti', nights: null, earliest: null, latest: null };

  it('Ypsilanti 100% cloud, Detroit clear: the card names Detroit with its straight-line distance and engine numbers, and shows no pass', async () => {
    const { fetch, calls } = mockFetch({
      openMeteo: (url) => (/latitude=([-\d.]+)/.exec(url)![1] === YPSI_LAT ? cloudReply('America/Detroit', -18000, () => 100) : cloudReply('America/Detroit', -18000, () => 0)),
      exa: () => QUIET_NEWS,
    });
    const ctx = ctxWith(fetch);
    const r = await runFixedPlan(ctx, EVERY_NIGHT);
    expect(r.card.kind).toBe('none');
    expect(ctx.trace.filter((t) => t.tool === 'showPass')).toHaveLength(0);
    const near = r.card.lines.filter((l) => l.startsWith('Nearby: '));
    expect(near).toHaveLength(1);
    // the distance, recomputed here from the two places' coordinates (Ypsilanti 42.24, -83.61; Detroit 42.3319, -83.082)
    const km = Math.round(greatCircleKm(42.24, -83.61, 42.3319, -83.082));
    expect(km).toBe(45);
    // direction by hand: 0.0919 deg north = 10.2 km, 0.528 deg east x cos(42.3 deg) = 43.4 km -> atan2(43.4, 10.2) = 76.8 deg -> ENE (56.25-78.75)
    expect(near[0]).toMatch(new RegExp(`^Nearby: Detroit, United States of America, ${km} km ENE in a straight line: cloud 0% at its pass .+ at \\d{1,2}:\\d{2} [AP]M \\(not shown`));
    // the pass it names is one the engine returned for Detroit, and its time is the card's text for it
    const d = [...ctx.passes.values()].filter((i) => i.place.id === 'detroit');
    expect(d.length).toBeGreaterThan(0);
    expect(d.some((i) => near[0].includes(`${passTexts(ctx, i).night} at ${passTexts(ctx, i).start}`))).toBe(true);
    expect(ctx.trace.filter((t) => t.tool === 'listVisiblePasses').map((t) => t.input)).toEqual(['place: Ypsilanti, Michigan', 'place: Detroit, United States of America']);
    expect(calls.urls.filter((u) => u.startsWith('https://api.open-meteo.com/'))).toHaveLength(2);
    console.log(`A2 step 4: ${near[0]}`);
  });

  it('a clear Ypsilanti never looks at other places; a clouded-out Detroit too gives no line', async () => {
    const clear = mockFetch({ openMeteo: () => cloudReply('America/Detroit', -18000, () => 36), exa: () => QUIET_NEWS });
    const r1 = await runFixedPlan(ctxWith(clear.fetch), EVERY_NIGHT);
    expect(r1.card.kind).toBe('pass');
    expect(clear.calls.urls.filter((u) => u.startsWith('https://api.open-meteo.com/'))).toHaveLength(1);
    const allCloud = mockFetch({ openMeteo: () => cloudReply('America/Detroit', -18000, () => 100), exa: () => QUIET_NEWS });
    const r2 = await runFixedPlan(ctxWith(allCloud.fetch), EVERY_NIGHT);
    expect(r2.card.kind).toBe('none');
    expect(r2.card.lines.filter((l) => l.startsWith('Nearby: '))).toHaveLength(0);
    expect(allCloud.calls.urls.filter((u) => u.startsWith('https://api.open-meteo.com/'))).toHaveLength(2);
  });
});
