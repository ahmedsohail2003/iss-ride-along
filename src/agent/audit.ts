// The number audit. Every number, clock time and date in the model's sentences must equal a number
// text that a tool returned in this run, or a number in the user's own sentence. Anything else is
// marked "not from our engine" and counted on the badge ("audit: N unverified numbers").
// Matching is exact after a fixed normal form: spaces trimmed, "pm"/"p.m." written "PM", and a unit
// sign (% or °) not part of the number ("34 degrees" and "34°" are the same number text "34").
// The one allowance: a time the user typed without AM/PM ("8:30") also matches "8:30 AM" and "8:30 PM".

const TOKEN = /\d{4}-\d{2}-\d{2}|\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp]\.?\s*[Mm]\.?)?|\d+(?:[.,]\d+)*/g;

export interface Token {
  text: string;
  norm: string;
  index: number;
  ok: boolean;
}

export interface AuditResult {
  tokens: Token[];
  unverified: number;
  flagged: string[];
  badge: string;
}

export function normToken(t: string): string {
  const s = t.replace(/[  ]/g, ' ').trim();
  const m = /^(\d{1,2}:\d{2}(?::\d{2})?)\s*([AaPp])\.?\s*[Mm]\.?$/.exec(s);
  if (m) return `${m[1]} ${m[2].toUpperCase()}M`;
  return s.replace(/,(?=\d{3}\b)/g, '');
}

export function tokensOf(text: string): { text: string; norm: string; index: number }[] {
  const out: { text: string; norm: string; index: number }[] = [];
  for (const m of String(text ?? '').matchAll(TOKEN)) out.push({ text: m[0], norm: normToken(m[0]), index: m.index ?? 0 });
  return out;
}

/** The set of allowed number texts: every token in the tool results and in the user's sentence. */
export function allowedSet(toolTexts: string[], userSentence: string): Set<string> {
  const set = new Set<string>();
  for (const t of toolTexts) {
    for (const k of tokensOf(t)) {
      set.add(k.norm);
      const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k.norm);
      if (iso) {
        set.add(iso[1]);
        set.add(String(Number(iso[3])));
      }
    }
  }
  for (const k of tokensOf(userSentence)) {
    set.add(k.norm);
    if (/^\d{1,2}:\d{2}$/.test(k.norm)) {
      set.add(`${k.norm} AM`);
      set.add(`${k.norm} PM`);
    }
  }
  return set;
}

export function audit(modelText: string, toolTexts: string[], userSentence: string): AuditResult {
  const allowed = allowedSet(toolTexts, userSentence);
  const tokens = tokensOf(modelText).map((t) => ({ ...t, ok: allowed.has(t.norm) }));
  const flagged = tokens.filter((t) => !t.ok).map((t) => t.text);
  return { tokens, unverified: flagged.length, flagged, badge: `audit: ${flagged.length} unverified number${flagged.length === 1 ? '' : 's'}` };
}
