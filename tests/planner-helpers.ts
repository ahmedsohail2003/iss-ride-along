// Shared fixtures for the planner tests: the orbit numbers and "now" of M5's Ypsilanti fixture,
// hand-made cloud tables in Open-Meteo's reply shape, Exa replies, and a fetch that answers each
// service from them (no network).
import fx from './fixtures/passes-ypsilanti-2026-11-14.json';
import * as sat from '../src/orbit/satellite-lite';
import { elementEpoch } from '../src/orbit/track';
import { newContext, type RunContext } from '../src/agent/tools';

export const satrec = sat.twoline2satrec(fx.tle.line1, fx.tle.line2);
export const EPOCH = elementEpoch(satrec);
/** Fixed "now": the start of the fixture's window, Sat Nov 14 2026, 12:36 PM EST. */
export const NOW = new Date(fx.window.startUtc);
export const SIMPLE = 'Ypsilanti, before 8:30 PM, any night this week';
export const TRIP = 'Ypsilanti until Monday, then Chicago Tuesday to Thursday, kids in bed by 8:30';
export const YPSI_LAT = '42.24';

/** An Open-Meteo-shaped reply: hourly rows from local midnight Nov 14 for 7 days. */
export function cloudReply(timeZone: string, utcOffsetS: number, cloudFor: (hourStartS: number) => number) {
  const start = Date.UTC(2026, 10, 14) / 1000 - utcOffsetS;
  const time: number[] = [];
  const cloud: number[] = [];
  for (let h = 0; h < 24 * 7; h++) {
    const t = start + h * 3600;
    time.push(t);
    cloud.push(cloudFor(t));
  }
  return {
    timezone: timeZone,
    utc_offset_seconds: utcOffsetS,
    hourly: { time, cloud_cover: cloud, cloud_cover_low: cloud, cloud_cover_mid: cloud.map(() => 0), cloud_cover_high: cloud.map(() => 0) },
  };
}

export interface ExaItem {
  title: string;
  url?: string;
  published?: string | null;
  text?: string;
}

/** An Exa hosted-MCP reply (event stream) with the given items. */
export function exaReply(items: ExaItem[]): string {
  const text = items
    .map((i) => `Title: ${i.title}\nURL: ${i.url ?? 'https://example.org/station-news'}\nPublished: ${i.published ?? 'N/A'}\nAuthor: N/A\nHighlights:\n${i.text ?? 'Station news.'}`)
    .join('\n\n');
  return `event: message\ndata: ${JSON.stringify({ result: { content: [{ type: 'text', text }] }, jsonrpc: '2.0', id: 1 })}\n\n`;
}

export const QUIET_NEWS = exaReply([{ title: 'Crew runs science on the ISS', published: '2026-11-12T15:00:00.000Z' }]);

export interface Calls {
  urls: string[];
  headers: Record<string, string>[];
  model: number;
}

export interface Routes {
  /** body for api.open-meteo.com (gets the request URL) */
  openMeteo?: (url: string) => unknown;
  exa?: () => string;
  /** One reply per model call, in order. A function gives a Response or a promise of one. */
  model?: (n: number, init: RequestInit) => Response | Promise<Response>;
  places?: () => unknown;
}

export function mockFetch(r: Routes): { fetch: typeof fetch; calls: Calls } {
  const calls: Calls = { urls: [], headers: [], model: 0 };
  const f = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.urls.push(url);
    calls.headers.push({ ...(init.headers as Record<string, string>) });
    if (url.startsWith('https://api.open-meteo.com/')) return Response.json(r.openMeteo ? r.openMeteo(url) : { error: true }, { status: r.openMeteo ? 200 : 503 });
    if (url.startsWith('https://geocoding-api.open-meteo.com/')) return Response.json(r.places ? r.places() : { results: [] });
    if (url.startsWith('https://mcp.exa.ai/')) return new Response(r.exa ? r.exa() : QUIET_NEWS, { status: 200, headers: { 'content-type': 'text/event-stream' } });
    if (url.includes('generativelanguage.googleapis.com') || url.includes('api.openai.com')) {
      calls.model++;
      if (!r.model) return new Response('{}', { status: 500 });
      return r.model(calls.model, init);
    }
    return new Response('', { status: 404 });
  }) as typeof fetch;
  return { fetch: f, calls };
}

/** Replies from a fixture file, one per model call. */
export function scripted(replies: unknown[]) {
  return (n: number) => Response.json(replies[n - 1] ?? replies[replies.length - 1]);
}

export function ctxWith(f: typeof fetch, now: Date = NOW): RunContext {
  return newContext({ now: () => now, satrec, epoch: EPOCH, fetch: f, viewerTimeZone: 'America/Detroit' });
}

/** Ypsilanti and Chicago clouds for the trip test (worked out in planner.test.ts). */
export function tripClouds(url: string) {
  const lat = /latitude=([-\d.]+)/.exec(url)![1];
  if (lat === YPSI_LAT) {
    // 100% on the nights the sentence puts the user in Ypsilanti (Sat 14 - Mon 16), clear after.
    return cloudReply('America/Detroit', -18000, (t) => (t < Date.UTC(2026, 10, 17, 5) / 1000 ? 100 : 0));
  }
  return cloudReply('America/Chicago', -21600, () => 0);
}
