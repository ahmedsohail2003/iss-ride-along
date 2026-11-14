// One function, step(history) -> { calls: [{id, name, args}], text }, with two adapters behind it.
// Gemini: POST /v1beta/models/{model}:generateContent with the x-goog-api-key header (the endpoint
//   that made the first correct live call on Nov 14, 2026; recorded in FACTS.md). The model's turn is
//   sent back unchanged (it can carry a thoughtSignature), tool results as functionResponse parts.
// OpenAI: POST /v1/responses with Authorization: Bearer. Replies carry function_call items whose
//   arguments is a JSON string; results go back as function_call_output with the same call_id.
//   Tested with replies written by hand from OpenAI's function-calling guide, not live-tested.
// Only the content-type and key headers are sent. Keys are never logged or put in a URL.
import type { ToolDef } from './tools';

export interface Call {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export type Turn =
  | { role: 'user'; text: string }
  | { role: 'model'; calls: Call[]; text: string; raw: unknown }
  | { role: 'tool'; results: { id: string; name: string; output: unknown }[] };

export interface StepResult {
  calls: Call[];
  text: string;
  raw: unknown;
}

export class ProviderError extends Error {
  kind: 'auth' | 'rate' | 'http' | 'format';
  status: number;
  retryAfterS: number | null;
  constructor(kind: ProviderError['kind'], status: number, message: string, retryAfterS: number | null = null) {
    super(message);
    this.kind = kind;
    this.status = status;
    this.retryAfterS = retryAfterS;
  }
}

export interface Provider {
  name: 'gemini' | 'openai';
  model: string;
  endpoint: string;
  step(system: string, history: Turn[], tools: ToolDef[], signal?: AbortSignal): Promise<StepResult>;
}

export const GEMINI_MODELS = ['gemini-4-hydrogen', 'gemini-3.8-flash', 'gemini-3.5-flash-lite'];
export const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
export const OPENAI_MODEL = 'gpt-6.1-terra';
export const OPENAI_URL = 'https://api.openai.com/v1/responses';

async function failure(res: Response): Promise<ProviderError> {
  const body = await res.text().catch(() => '');
  const ra = Number(res.headers.get('retry-after'));
  const retry = Number.isFinite(ra) && ra > 0 ? ra : null;
  if (res.status === 401 || res.status === 403 || /API_KEY_INVALID|API key not valid/i.test(body)) {
    return new ProviderError('auth', res.status, `AI key refused (HTTP ${res.status})`);
  }
  if (res.status === 429) return new ProviderError('rate', 429, 'AI rate limit reached (HTTP 429)', retry);
  return new ProviderError('http', res.status, `AI provider error (HTTP ${res.status})`);
}

// ---------------------------------------------------------------- Gemini

interface GeminiPart {
  text?: string;
  thought?: boolean;
  functionCall?: { id?: string; name: string; args?: Record<string, unknown> };
}

export function geminiBody(system: string, history: Turn[], tools: ToolDef[]) {
  const contents = history.map((t) => {
    if (t.role === 'user') return { role: 'user', parts: [{ text: t.text }] };
    if (t.role === 'model') return t.raw;
    return {
      role: 'user',
      parts: t.results.map((r) => ({ functionResponse: { id: r.id, name: r.name, response: { result: r.output } } })),
    };
  });
  const functionDeclarations = tools.map((d) => {
    const props = (d.parameters as { properties?: object }).properties ?? {};
    return Object.keys(props).length ? { name: d.name, description: d.description, parameters: d.parameters } : { name: d.name, description: d.description };
  });
  return { systemInstruction: { parts: [{ text: system }] }, contents, tools: [{ functionDeclarations }] };
}

export function parseGemini(json: unknown): StepResult {
  const content = (json as { candidates?: { content?: { role?: string; parts?: GeminiPart[] } }[] })?.candidates?.[0]?.content;
  if (!content) throw new ProviderError('format', 200, 'AI reply had no content');
  const parts = content.parts ?? [];
  const calls = parts
    .filter((p) => p.functionCall)
    .map((p, i) => ({ id: p.functionCall!.id ?? `${p.functionCall!.name}-${i}`, name: p.functionCall!.name, args: p.functionCall!.args ?? {} }));
  const text = parts
    .filter((p) => typeof p.text === 'string' && !p.thought)
    .map((p) => p.text)
    .join('')
    .trim();
  return { calls, text, raw: { role: content.role ?? 'model', parts } };
}

export function gemini(apiKey: string, model: string, fetchFn: typeof fetch): Provider {
  const endpoint = `${GEMINI_BASE}/models/${model}:generateContent`;
  return {
    name: 'gemini',
    model,
    endpoint: 'generateContent',
    async step(system, history, tools, signal) {
      const res = await fetchFn(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(geminiBody(system, history, tools)),
        signal,
      });
      if (!res.ok) throw await failure(res);
      return parseGemini(await res.json());
    },
  };
}

// ---------------------------------------------------------------- OpenAI

interface OpenAIItem {
  type: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  content?: { type: string; text?: string }[];
}

export function openaiBody(model: string, system: string, history: Turn[], tools: ToolDef[]) {
  const input: unknown[] = [];
  for (const t of history) {
    if (t.role === 'user') input.push({ role: 'user', content: t.text });
    else if (t.role === 'model') input.push(...(t.raw as unknown[]));
    else for (const r of t.results) input.push({ type: 'function_call_output', call_id: r.id, output: JSON.stringify(r.output) });
  }
  return { model, instructions: system, input, tools };
}

export function parseOpenAI(json: unknown): StepResult {
  const output = (json as { output?: OpenAIItem[] })?.output;
  if (!Array.isArray(output)) throw new ProviderError('format', 200, 'AI reply had no output');
  const calls: Call[] = [];
  for (const it of output) {
    if (it.type !== 'function_call') continue;
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(it.arguments ?? '{}');
    } catch {
      args = {};
    }
    calls.push({ id: it.call_id ?? `${it.name}-${calls.length}`, name: it.name ?? '', args });
  }
  const text = output
    .filter((it) => it.type === 'message')
    .flatMap((it) => it.content ?? [])
    .filter((c) => c.type === 'output_text')
    .map((c) => c.text ?? '')
    .join('')
    .trim();
  return { calls, text, raw: output };
}

export function openai(apiKey: string, model: string, fetchFn: typeof fetch): Provider {
  return {
    name: 'openai',
    model,
    endpoint: 'responses',
    async step(system, history, tools, signal) {
      const res = await fetchFn(OPENAI_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(openaiBody(model, system, history, tools)),
        signal,
      });
      if (!res.ok) throw await failure(res);
      return parseOpenAI(await res.json());
    },
  };
}
