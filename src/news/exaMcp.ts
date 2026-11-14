// Live web search through Exa's hosted MCP endpoint (MCP: a standard way for AI apps to call tools).
// POST https://mcp.exa.ai/mcp, a JSON-RPC "tools/call" of web_search_exa; the reply is an event
// stream whose "data:" line holds the result text, one block per item with Title:, URL:, Published:.
// The endpoint has no date filter, so our code keeps only items dated within the last 7 days.
// Web text is shown as quoted, dated, linked items "not checked by us" and never feeds a number.

export const EXA_MCP_URL = 'https://mcp.exa.ai/mcp';
export const NEWS_DAYS = 7;
export const MAX_SHOWN = 3;
export const NO_NEWS_TEXT = 'no station news found from the last 7 days';
export const NEWS_DOWN_TEXT = 'live web search unavailable';
export const FIXED_QUERY = 'International Space Station ISS news this week: reboost, engine burn, docking, spacewalk';
export const OBJECTIVE =
  'Newest posts about the International Space Station orbit, engine burns, reboosts, dockings and spacewalks, with their publication dates.';
const BURN = /reboost|orbit raise|orbit-raising|engine burn|avoidance man(?:oeu|eu)vre/i;

export interface NewsItem {
  title: string;
  url: string;
  published: Date | null;
}

export interface NewsResult {
  ok: boolean;
  query: string;
  /** Items Exa returned (all of them, before our date filter). */
  returned: number;
  /** At most 3 items dated within the last 7 days, newest first. */
  shown: NewsItem[];
  /** A shown item dated after the orbit numbers' epoch whose title mentions an engine burn. */
  burn: NewsItem | null;
  /** Plain line for the box when nothing is shown, or when the search failed. */
  message: string | null;
  status?: number;
}

/** The query must be about the station; anything else is refused before any request is made. */
export function checkQuery(query: string): string | null {
  if (typeof query !== 'string' || !query.trim()) return 'empty search text';
  if (!/\bISS\b|space station/i.test(query)) return 'refused: the search text must contain "ISS" or "space station"';
  return null;
}

export function requestBody(query: string) {
  return {
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/call',
    params: { name: 'web_search_exa', arguments: { query, numResults: 10, objective: OBJECTIVE } },
  };
}

/** The result text inside Exa's reply (event stream "data:" lines or plain JSON). */
export function replyText(body: string): string {
  const dataLines = body
    .split(/\r?\n/)
    .filter((l) => l.startsWith('data:'))
    .map((l) => l.slice(5).trim());
  const chunks = dataLines.length ? dataLines : [body.trim()];
  const texts: string[] = [];
  for (const c of chunks) {
    try {
      const j = JSON.parse(c);
      if (j.error) throw new Error(`Exa error: ${j.error.message ?? 'unknown'}`);
      for (const part of j.result?.content ?? []) if (part.type === 'text' && typeof part.text === 'string') texts.push(part.text);
    } catch (e) {
      if ((e as Error).message.startsWith('Exa error')) throw e;
    }
  }
  return texts.join('\n');
}

/** Split the result text into items. Undated or unparseable dates become null. */
export function parseItems(text: string): NewsItem[] {
  const blocks = text.split(/^(?=Title:)/m).filter((b) => b.startsWith('Title:'));
  return blocks.map((b) => {
    const line = (k: string) => new RegExp(`^${k}:\\s*(.*)$`, 'm').exec(b)?.[1]?.trim() ?? '';
    const pub = line('Published');
    const d = pub && pub !== 'N/A' ? new Date(pub) : null;
    return { title: line('Title'), url: line('URL'), published: d && !Number.isNaN(d.getTime()) ? d : null };
  });
}

/** Keep https items dated within the last 7 days (not in the future), newest first, at most 3. */
export function keepRecent(items: NewsItem[], now: Date): NewsItem[] {
  const from = now.getTime() - NEWS_DAYS * 86_400_000;
  return items
    .filter((i) => i.title && /^https:\/\//.test(i.url) && i.published)
    .filter((i) => i.published!.getTime() >= from && i.published!.getTime() <= now.getTime() + 3_600_000)
    .sort((a, b) => b.published!.getTime() - a.published!.getTime())
    .slice(0, MAX_SHOWN);
}

export function burnItem(shown: NewsItem[], epoch: Date): NewsItem | null {
  return shown.find((i) => i.published && i.published.getTime() > epoch.getTime() && BURN.test(i.title)) ?? null;
}

export function newsFromReply(query: string, body: string, now: Date, epoch: Date): NewsResult {
  const items = parseItems(replyText(body));
  const shown = keepRecent(items, now);
  return { ok: true, query, returned: items.length, shown, burn: burnItem(shown, epoch), message: shown.length ? null : NO_NEWS_TEXT };
}

export interface SearchOptions {
  fetch: typeof fetch;
  now: Date;
  epoch: Date;
  exaKey?: string;
  signal?: AbortSignal;
}

export async function searchStationNews(query: string, o: SearchOptions): Promise<NewsResult> {
  const refused = checkQuery(query);
  if (refused) return { ok: false, query, returned: 0, shown: [], burn: null, message: refused };
  const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json, text/event-stream' };
  if (o.exaKey) headers['x-api-key'] = o.exaKey;
  try {
    const res = await o.fetch(EXA_MCP_URL, { method: 'POST', headers, body: JSON.stringify(requestBody(query)), signal: o.signal });
    if (!res.ok) return { ok: false, query, returned: 0, shown: [], burn: null, message: res.status === 429 ? `${NEWS_DOWN_TEXT} (rate limited)` : NEWS_DOWN_TEXT, status: res.status };
    return { ...newsFromReply(query, await res.text(), o.now, o.epoch), status: res.status };
  } catch {
    return { ok: false, query, returned: 0, shown: [], burn: null, message: NEWS_DOWN_TEXT };
  }
}
