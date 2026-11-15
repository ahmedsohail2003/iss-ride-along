// The no-key mode: "fixed plan, no AI". The same engine steps as the agent, in a fixed order, for
// one place: findCity -> listVisiblePasses -> cloudForecast -> scorePasses -> stationNews ->
// (orbitDataAge when the news shows an engine burn) -> showPass for the top-scoring pass.
// This is also where every failed AI run ends (bad key, rate limit, slow reply, 30-second limit).
import { NO_NEWS_TEXT } from '../news/exaMcp';
import { compass } from '../orbit/passes';
import { fmtClock } from './format';
import { MIN_SCORE, normaliseHM, NO_PASS_TEXT, scorePass, UNKNOWN_CLOUD } from './score';
import { nearbyPlaces } from './places';
import { measuredLine } from '../orbit/oemAgreement';
import { cloudForecast, FIXED_QUERY, findCity, listVisiblePasses, orbitDataAge, passTexts, placeLabel, planLeg, roughForecast, showPass, stationNews, zoneOf, type By, type PassInfo, type RunContext } from './tools';

/** A2 step 4: when every allowed pass is clouded out, up to 2 built-in places within 100 km are tried. */
export const NEARBY_KM = 100;
export const NEARBY_MAX = 2;

/**
 * A2 step 4, a nearby clear place: listVisiblePasses and cloudForecast for up to 2 built-in places
 * within 100 km, the same nights and times. One line per place with an allowed pass worth going out
 * for: the place, its straight-line distance and direction, and engine numbers only (never directions
 * for driving). The pass is named, not shown on the map.
 */
export async function nearbyClear(ctx: RunContext, home: PassInfo['place'], c: Controls, by: By): Promise<string[]> {
  const lines: string[] = [];
  for (const n of nearbyPlaces(home, NEARBY_KM).slice(0, NEARBY_MAX)) {
    ctx.places.set(n.place.id, n.place);
    const infos = await listVisiblePasses(ctx, n.place.id, by);
    if (!infos.length) continue;
    await cloudForecast(ctx, infos, by);
    const tz = zoneOf(ctx, n.place);
    const w = { nights: c.nights, earliest: normaliseHM(c.earliest), latest: normaliseHM(c.latest) };
    for (const i of infos) i.scored = scorePass({ id: i.id, start: i.pass.start, peakElDeg: i.pass.peakElDeg, cloud: i.cloud }, w, tz);
    const best = infos.filter((i) => i.scored!.allowed && i.scored!.score >= MIN_SCORE).sort((a, b) => b.scored!.score - a.scored!.score)[0];
    if (!best) continue;
    const t = passTexts(ctx, best);
    lines.push(`Nearby: ${placeLabel(n.place)}, ${Math.round(n.km)} km ${compass(n.bearingDeg)} in a straight line: cloud ${t.cloud} at its pass ${t.night} at ${t.start} (not shown; plan for that place to see it).`);
  }
  return lines;
}

export interface Controls {
  /** Place name for findCity (a built-in name, or any town for the place search). */
  place: string;
  /** Local dates "YYYY-MM-DD"; null = every night. */
  nights: string[] | null;
  earliest: string | null;
  latest: string | null;
}

export interface Card {
  kind: 'pass' | 'none';
  headline: string;
  lines: string[];
  /** The model's or the fixed rule's reason, plain text. */
  why: string;
  /** The "pass times may have shifted" line, or the no-search line, or null. */
  orbitLine: string | null;
  passId: string | null;
  /** Peak time, ms, for the countdown. */
  startMs: number | null;
}

export interface PlanResult {
  mode: 'ai' | 'fixed plan';
  card: Card;
  /** Set when an AI run ended in the fixed plan: the reason, in one plain line. */
  fallbackReason: string | null;
}

/** The engine writes every number on the card from the chosen pass. */
export function buildCard(ctx: RunContext, info: PassInfo | null, why: string, bestOutside: PassInfo | null = null): Card {
  const orbitLine = orbitNewsLine(ctx);
  if (!info) {
    const lines = bestOutside
      ? [`Best pass outside your window: ${passTexts(ctx, bestOutside).night} at ${passTexts(ctx, bestOutside).start} in ${placeLabel(bestOutside.place)} (not shown).`]
      : [];
    return { kind: 'none', headline: `${NO_PASS_TEXT[0].toUpperCase()}${NO_PASS_TEXT.slice(1)}.`, lines, why, orbitLine, passId: null, startMs: null };
  }
  const t = passTexts(ctx, info);
  const f = ctx.forecasts.get(info.place.id);
  const tz = zoneOf(ctx, info.place);
  const lines = [
    `Look ${t.look} at ${t.start}; it climbs to ${t.peak} in the ${compass(info.pass.peakAzDeg)} and is visible for ${t.length}.`,
    info.cloud === null
      ? 'Cloud: unknown (no forecast for that hour; counted as 50%).'
      : `Cloud ${t.cloud} for that hour (Open-Meteo, fetched ${fmtClock(f!.fetchedAt, tz)}).`,
  ];
  if (roughForecast(ctx, info)) lines.push('That is more than 72 hours ahead: the cloud forecast this far ahead is rough.');
  const notNext = whyNotNextLine(ctx, info);
  if (notNext) lines.push(notNext);
  lines.push('Never look at the Sun.');
  return {
    kind: 'pass',
    headline: `Go out ${t.night} at ${t.start} in ${t.place}.`,
    lines,
    why,
    orbitLine,
    passId: info.id,
    startMs: info.pass.start.getTime(),
  };
}

export const WHY_NOT_NEXT = 'Why not the next pass';

/** P1: the earliest upcoming visible pass for this place (the one the first screen's "Next time" line names). */
export function earliestPassFor(ctx: RunContext, place: PassInfo['place']): PassInfo | null {
  let first: PassInfo | null = null;
  for (const i of ctx.passes.values()) if (i.place.id === place.id && (!first || i.pass.start < first.pass.start)) first = i;
  return first;
}

/**
 * P1: when the chosen pass is not the earliest one, one line saying why, built by the engine from the
 * fixed score's own parts of the two passes (outside the nights or times, cloud, peak height), in the
 * card's own number texts. Null when the chosen pass is the earliest, or the earliest was never scored.
 */
export function whyNotNextLine(ctx: RunContext, info: PassInfo): string | null {
  const next = earliestPassFor(ctx, info.place);
  if (!next || next.id === info.id || !next.scored || !info.scored) return null;
  const n = passTexts(ctx, next);
  const c = passTexts(ctx, info);
  const head = `${WHY_NOT_NEXT}, ${n.night} at ${n.start}:`;
  if (!next.scored.allowed) {
    const outside = next.scored.reasons.filter((r) => /^(not on your nights|before your earliest time|after your latest time)$/.test(r));
    return `${head} it is outside your nights or times (${outside.join(', ')}); this one is inside them.`;
  }
  const cloudText = (i: PassInfo, t: ReturnType<typeof passTexts>) => (i.cloud === null ? 'unknown cloud (counted as 50%)' : `${t.cloud} cloud`);
  const parts: string[] = [];
  const mine: string[] = [];
  if (next.scored.cloudUsed > info.scored.cloudUsed) {
    parts.push(`has ${cloudText(next, n)}`);
    mine.push(`has ${cloudText(info, c)}`);
  }
  if (next.pass.peakElDeg < info.pass.peakElDeg && n.peak !== c.peak) {
    parts.push(`climbs only to ${n.peak}`);
    mine.push(`climbs to ${c.peak}`);
  }
  if (parts.length) return `${head} it ${parts.join(' and ')}; this one ${mine.join(' and ')}.`;
  // Neither part is worse (an AI pick against the fixed rule): give the two fixed scores.
  return `${head} it scores ${next.scored.score.toFixed(2)} on the fixed rule; this one scores ${info.scored.score.toFixed(2)}.`;
}

export function orbitNewsLine(ctx: RunContext): string | null {
  const n = ctx.news;
  const epochText = `${ctx.epoch.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
  // C1: the gap measured against NASA's trajectory at the orbit numbers' current age.
  const measured = measuredLine((ctx.now().getTime() - ctx.epoch.getTime()) / 3_600_000);
  if (n?.burn) {
    return (
      `A web item dated after our orbit numbers mentions an engine burn (${n.burn.title}, ${n.burn.published!.toISOString().slice(0, 10)}; not checked by us). ` +
      `Pass times may have shifted since ${epochText}; plan again on the day of the pass.` +
      (measured ? ` Before any burn, our math was ${measured}.` : '')
    );
  }
  if (!n || !n.ok) return 'This prediction assumes no engine burn since the orbit numbers were issued.';
  return null;
}

export function fixedReason(info: PassInfo): string {
  const s = info.scored!;
  return `Highest score of the allowed passes: ${s.score.toFixed(2)} (height ${Math.round(info.pass.peakElDeg)}° of 90, cloud ${info.cloud === null ? 'unknown' : `${Math.round(info.cloud)}%`}).`;
}

export async function runFixedPlan(ctx: RunContext, c: Controls, fallbackReason: string | null = null): Promise<PlanResult> {
  const found = await findCity(ctx, c.place, 'fixed plan');
  const first = found.candidates[0];
  if (!first) {
    return {
      mode: 'fixed plan',
      fallbackReason,
      card: { kind: 'none', headline: `"${c.place}" is not in our list: pick the nearest city or type latitude and longitude.`, lines: [], why: '', orbitLine: null, passId: null, startMs: null },
    };
  }
  await planLeg(ctx, { placeId: first.placeId, nights: c.nights, earliest: c.earliest, latest: c.latest }, 'fixed plan');
  await stationNews(ctx, FIXED_QUERY, 'fixed plan');
  if (ctx.news?.burn && !ctx.ageCalled) await orbitDataAge(ctx, 'fixed plan');
  const infos = [...ctx.passes.values()].filter((i) => i.place.id === first.placeId && i.scored);
  const allowed = infos.filter((i) => i.scored!.allowed).sort((a, b) => b.scored!.score - a.scored!.score || a.pass.start.getTime() - b.pass.start.getTime());
  const best = allowed.length && allowed[0].scored!.score >= 0.05 ? allowed[0] : null;
  if (best) {
    await showPass(ctx, best.id, fixedReason(best), 'fixed plan');
    return { mode: 'fixed plan', fallbackReason, card: buildCard(ctx, best, ctx.why ?? '') };
  }
  const outside = infos.filter((i) => !i.scored!.allowed && i.scored!.score >= 0.05).sort((a, b) => b.scored!.score - a.scored!.score)[0] ?? null;
  const card = buildCard(ctx, null, 'Every allowed pass scores under 0.05.', outside);
  // A2 step 4: every allowed pass clouded out (cloud 50% or more) -> try up to 2 places within 100 km.
  if (allowed.length && allowed.every((i) => (i.cloud ?? UNKNOWN_CLOUD) >= 50)) card.lines.push(...(await nearbyClear(ctx, first.placeId ? ctx.places.get(first.placeId)! : allowed[0].place, c, 'fixed plan')));
  return { mode: 'fixed plan', fallbackReason, card };
}

export { NO_NEWS_TEXT };
